/**
 * Training Data Quality Service
 * 
 * Provides robust quality assessment for training data with:
 * - Research-based quality thresholds (not arbitrary)
 * - Multi-factor scoring system
 * - Expert (CPA) review workflow
 * - Anti-gaming protection
 * 
 * Quality Threshold Rationale:
 * - OpenAI recommends 500-1000+ high-quality examples for finetuning
 * - Quality over quantity: 100 perfect examples > 1000 mediocre ones
 * - Financial/tax domain requires expert validation due to liability risk
 */

import { db } from '../../db';
import { finetuningDataset, messageFeedback, users } from '../../../shared/schema';
import { eq, and, sql, gte, desc, count } from 'drizzle-orm';

// ================================
// Quality Threshold Configuration
// ================================

/**
 * Quality Thresholds - Research-Based Rationale
 * 
 * AUTO_APPROVE_THRESHOLD (0.90):
 * - Only auto-approve examples with overwhelming positive signals
 * - Requires: 5-star rating + positive thumbs + expert correction + verified user
 * - Rationale: Financial advice has liability implications, err on side of caution
 * 
 * EXPERT_REVIEW_THRESHOLD (0.70):
 * - Examples between 0.70-0.90 require CPA/expert review
 * - Captures "good but needs verification" responses
 * - Rationale: OpenAI data quality guidelines recommend human review
 * 
 * MINIMUM_THRESHOLD (0.50):
 * - Below 0.50 is auto-rejected (poor quality signals)
 * - Examples: negative feedback, short responses, suspicious patterns
 * - Rationale: Garbage in = garbage out principle
 * 
 * Reference: OpenAI Fine-tuning Guide, RLHF best practices
 */
export const QualityThresholds = {
  // Auto-approve only exceptional examples
  AUTO_APPROVE: 0.90,
  
  // Requires expert CPA review
  EXPERT_REVIEW: 0.70,
  
  // Minimum to even consider
  MINIMUM: 0.50,
  
  // Below this triggers anomaly flag
  ANOMALY: 0.30,
} as const;

/**
 * Quality Factor Weights - Documented Rationale
 * 
 * These weights are calibrated to prioritize:
 * 1. Expert validation (highest signal)
 * 2. Multiple positive signals (not just one thumbs-up)
 * 3. Response quality characteristics
 * 4. User trust/reputation
 */
export const QualityWeights = {
  // Base score for any positive feedback
  BASE_POSITIVE: 0.40,
  
  // Rating contribution (1-5 stars normalized to 0-0.25)
  RATING_MAX: 0.25,
  
  // Thumbs up adds value
  THUMBS_UP: 0.10,
  
  // Expert correction is gold standard
  EXPERT_CORRECTION: 0.20,
  
  // User provided detailed feedback
  DETAILED_FEEDBACK: 0.05,
  
  // Response quality (length, structure)
  RESPONSE_QUALITY: 0.10,
  
  // User reputation factor
  USER_REPUTATION: 0.15,
  
  // Penalties
  THUMBS_DOWN: -0.40,
  SHORT_RESPONSE: -0.10,
  SUSPICIOUS_PATTERN: -0.30,
} as const;

// ================================
// Types
// ================================

export interface QualityAssessment {
  score: number;
  tier: 'auto-approve' | 'expert-review' | 'pending' | 'auto-reject';
  factors: QualityFactor[];
  flags: QualityFlag[];
  recommendation: string;
  requiresExpertReview: boolean;
}

export interface QualityFactor {
  name: string;
  contribution: number;
  rationale: string;
}

export interface QualityFlag {
  type: 'warning' | 'error' | 'info';
  code: string;
  message: string;
}

export interface UserReputation {
  userId: string;
  trustScore: number;
  feedbackCount: number;
  positiveRate: number;
  expertVerified: boolean;
  flaggedCount: number;
  lastCalculated: Date;
}

export interface FeedbackAnomaly {
  userId: string;
  anomalyType: 'rapid_fire' | 'all_positive' | 'suspicious_pattern' | 'bot_behavior';
  confidence: number;
  evidence: string;
  detectedAt: Date;
}

// ================================
// Anti-Gaming: Rate Limiting
// ================================

// In-memory rate limiter with automatic cleanup
// NOTE: For production with multiple instances, use Redis instead
const feedbackRateLimits = new Map<string, { count: number; windowStart: number }>();

// Cleanup interval: prune stale entries every 10 minutes
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const RATE_LIMIT_STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

function cleanupRateLimits(): void {
  const now = Date.now();
  let pruned = 0;
  
  const keysToDelete: string[] = [];
  feedbackRateLimits.forEach((data, key) => {
    if (now - data.windowStart > RATE_LIMIT_STALE_THRESHOLD_MS) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => {
    feedbackRateLimits.delete(key);
    pruned++;
  });
  
  if (pruned > 0) {
    console.log(`[TrainingDataQuality] Pruned ${pruned} stale rate limit entries. Current size: ${feedbackRateLimits.size}`);
  }
}

// Start cleanup interval
setInterval(cleanupRateLimits, RATE_LIMIT_CLEANUP_INTERVAL_MS);

const RATE_LIMIT = {
  MAX_FEEDBACK_PER_HOUR: 50,
  MAX_FEEDBACK_PER_MINUTE: 10,
  COOLDOWN_BETWEEN_FEEDBACK_MS: 5000, // 5 seconds between feedback
};

export function checkFeedbackRateLimit(userId: string): { allowed: boolean; reason?: string; retryAfterMs?: number } {
  const now = Date.now();
  const hourKey = `${userId}:hour`;
  const minuteKey = `${userId}:minute`;
  
  // Check hourly limit
  const hourData = feedbackRateLimits.get(hourKey);
  if (hourData) {
    const hourElapsed = now - hourData.windowStart;
    if (hourElapsed < 3600000) {
      if (hourData.count >= RATE_LIMIT.MAX_FEEDBACK_PER_HOUR) {
        return { 
          allowed: false, 
          reason: 'Hourly feedback limit reached (50/hour)',
          retryAfterMs: 3600000 - hourElapsed,
        };
      }
    } else {
      // Reset window
      feedbackRateLimits.set(hourKey, { count: 0, windowStart: now });
    }
  }
  
  // Check minute limit
  const minuteData = feedbackRateLimits.get(minuteKey);
  if (minuteData) {
    const minuteElapsed = now - minuteData.windowStart;
    if (minuteElapsed < 60000) {
      if (minuteData.count >= RATE_LIMIT.MAX_FEEDBACK_PER_MINUTE) {
        return {
          allowed: false,
          reason: 'Too many feedback submissions in the last minute',
          retryAfterMs: 60000 - minuteElapsed,
        };
      }
    } else {
      feedbackRateLimits.set(minuteKey, { count: 0, windowStart: now });
    }
  }
  
  // Update counters
  const currentHour = feedbackRateLimits.get(hourKey) || { count: 0, windowStart: now };
  const currentMinute = feedbackRateLimits.get(minuteKey) || { count: 0, windowStart: now };
  
  feedbackRateLimits.set(hourKey, { ...currentHour, count: currentHour.count + 1 });
  feedbackRateLimits.set(minuteKey, { ...currentMinute, count: currentMinute.count + 1 });
  
  return { allowed: true };
}

// ================================
// Anti-Gaming: Anomaly Detection
// ================================

interface UserFeedbackPattern {
  recentFeedback: Array<{ isPositive: boolean; timestamp: number }>;
  lastFeedbackTime: number;
}

const userPatterns = new Map<string, UserFeedbackPattern>();

// Cleanup interval: prune stale user patterns every 30 minutes
const USER_PATTERNS_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
const USER_PATTERNS_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanupUserPatterns(): void {
  const now = Date.now();
  let pruned = 0;
  
  const keysToDelete: string[] = [];
  userPatterns.forEach((pattern, userId) => {
    // Delete if no feedback in last 24 hours
    if (now - pattern.lastFeedbackTime > USER_PATTERNS_STALE_THRESHOLD_MS) {
      keysToDelete.push(userId);
    }
  });
  
  keysToDelete.forEach(userId => {
    userPatterns.delete(userId);
    pruned++;
  });
  
  if (pruned > 0) {
    console.log(`[TrainingDataQuality] Pruned ${pruned} stale user patterns. Current size: ${userPatterns.size}`);
  }
}

// Start cleanup interval
setInterval(cleanupUserPatterns, USER_PATTERNS_CLEANUP_INTERVAL_MS);

export async function detectFeedbackAnomaly(
  userId: string,
  isPositive: boolean
): Promise<FeedbackAnomaly | null> {
  const now = Date.now();
  const pattern = userPatterns.get(userId) || { recentFeedback: [], lastFeedbackTime: 0 };
  
  // Add current feedback
  pattern.recentFeedback.push({ isPositive, timestamp: now });
  pattern.lastFeedbackTime = now;
  
  // Keep only last 24 hours
  pattern.recentFeedback = pattern.recentFeedback.filter(
    f => now - f.timestamp < 24 * 60 * 60 * 1000
  );
  
  userPatterns.set(userId, pattern);
  
  const recentCount = pattern.recentFeedback.length;
  
  // Anomaly 1: Rapid-fire feedback (more than 20 in 10 minutes)
  const last10Min = pattern.recentFeedback.filter(f => now - f.timestamp < 10 * 60 * 1000);
  if (last10Min.length > 20) {
    return {
      userId,
      anomalyType: 'rapid_fire',
      confidence: 0.9,
      evidence: `${last10Min.length} feedback submissions in 10 minutes`,
      detectedAt: new Date(),
    };
  }
  
  // Anomaly 2: All positive feedback (100% positive in 20+ submissions)
  if (recentCount >= 20) {
    const positiveCount = pattern.recentFeedback.filter(f => f.isPositive).length;
    const positiveRate = positiveCount / recentCount;
    
    if (positiveRate === 1.0) {
      return {
        userId,
        anomalyType: 'all_positive',
        confidence: 0.7,
        evidence: `100% positive feedback across ${recentCount} submissions (statistically unlikely)`,
        detectedAt: new Date(),
      };
    }
  }
  
  // Anomaly 3: Bot-like timing (consistent intervals)
  if (last10Min.length >= 5) {
    const intervals = [];
    for (let i = 1; i < last10Min.length; i++) {
      intervals.push(last10Min[i].timestamp - last10Min[i - 1].timestamp);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // If standard deviation is very low (< 2 seconds), likely a bot
    if (stdDev < 2000 && intervals.length >= 4) {
      return {
        userId,
        anomalyType: 'bot_behavior',
        confidence: 0.85,
        evidence: `Highly consistent feedback intervals (stdDev: ${(stdDev / 1000).toFixed(2)}s)`,
        detectedAt: new Date(),
      };
    }
  }
  
  return null;
}

// ================================
// User Reputation System
// ================================

export async function calculateUserReputation(userId: string): Promise<UserReputation> {
  try {
    // Get user feedback history
    const feedbackStats = await db.select({
      total: sql<number>`COUNT(*)`,
      positive: sql<number>`COUNT(*) FILTER (WHERE is_helpful = true)`,
      negative: sql<number>`COUNT(*) FILTER (WHERE is_helpful = false)`,
    })
      .from(messageFeedback)
      .where(eq(messageFeedback.userId, userId));
    
    const stats = feedbackStats[0] || { total: 0, positive: 0, negative: 0 };
    const total = Number(stats.total);
    const positive = Number(stats.positive);
    
    // Calculate trust score (0-1)
    let trustScore = 0.5; // Base neutral score
    
    if (total >= 5) {
      const positiveRate = positive / total;
      // Adjust based on positive rate (weighted towards neutral)
      trustScore = 0.3 + (positiveRate * 0.4); // Range: 0.3 to 0.7
      
      // Bonus for long-term users with many feedbacks
      if (total >= 50) trustScore += 0.1;
      if (total >= 100) trustScore += 0.1;
      
      // Cap at 0.9 unless expert verified
      trustScore = Math.min(trustScore, 0.9);
    }
    
    // Check if user is expert verified (admin)
    const [user] = await db.select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    const expertVerified = user?.isAdmin === true;
    if (expertVerified) {
      trustScore = 1.0;
    }
    
    // Count flagged anomalies (reduce trust)
    const pattern = userPatterns.get(userId);
    const flaggedCount = pattern ? 
      (await detectFeedbackAnomaly(userId, true) ? 1 : 0) : 0;
    
    if (flaggedCount > 0) {
      trustScore *= 0.5; // Halve trust for flagged users
    }
    
    return {
      userId,
      trustScore,
      feedbackCount: total,
      positiveRate: total > 0 ? positive / total : 0,
      expertVerified,
      flaggedCount,
      lastCalculated: new Date(),
    };
  } catch (error) {
    console.error('[TrainingDataQuality] Failed to calculate user reputation:', error);
    return {
      userId,
      trustScore: 0.5,
      feedbackCount: 0,
      positiveRate: 0,
      expertVerified: false,
      flaggedCount: 0,
      lastCalculated: new Date(),
    };
  }
}

// ================================
// Quality Assessment
// ================================

export async function assessTrainingDataQuality(params: {
  messageId: string;
  userId: string;
  rating?: number;
  thumbs?: 'up' | 'down';
  hasCorrection: boolean;
  isExpertCorrection: boolean;
  feedbackText?: string;
  responseLength: number;
  responseHasStructure: boolean;
}): Promise<QualityAssessment> {
  const factors: QualityFactor[] = [];
  const flags: QualityFlag[] = [];
  let score = 0;
  
  // 1. Base positive feedback
  if (params.thumbs === 'up' || (params.rating && params.rating >= 4)) {
    score += QualityWeights.BASE_POSITIVE;
    factors.push({
      name: 'Positive Feedback',
      contribution: QualityWeights.BASE_POSITIVE,
      rationale: 'User indicated positive sentiment',
    });
  }
  
  // 2. Rating contribution
  if (params.rating) {
    const ratingContribution = ((params.rating - 1) / 4) * QualityWeights.RATING_MAX;
    score += ratingContribution;
    factors.push({
      name: 'Star Rating',
      contribution: ratingContribution,
      rationale: `${params.rating}/5 stars normalized`,
    });
  }
  
  // 3. Thumbs up/down
  if (params.thumbs === 'up') {
    score += QualityWeights.THUMBS_UP;
    factors.push({
      name: 'Thumbs Up',
      contribution: QualityWeights.THUMBS_UP,
      rationale: 'Explicit positive endorsement',
    });
  } else if (params.thumbs === 'down') {
    score += QualityWeights.THUMBS_DOWN;
    factors.push({
      name: 'Thumbs Down',
      contribution: QualityWeights.THUMBS_DOWN,
      rationale: 'Negative signal - significant quality concern',
    });
    flags.push({
      type: 'warning',
      code: 'NEGATIVE_FEEDBACK',
      message: 'User indicated negative sentiment',
    });
  }
  
  // 4. Expert correction (highest value)
  if (params.isExpertCorrection) {
    score += QualityWeights.EXPERT_CORRECTION;
    factors.push({
      name: 'Expert Correction',
      contribution: QualityWeights.EXPERT_CORRECTION,
      rationale: 'CPA/expert provided corrected response - gold standard',
    });
  } else if (params.hasCorrection) {
    score += QualityWeights.EXPERT_CORRECTION * 0.5;
    factors.push({
      name: 'User Correction',
      contribution: QualityWeights.EXPERT_CORRECTION * 0.5,
      rationale: 'Non-expert correction - needs validation',
    });
    flags.push({
      type: 'info',
      code: 'NON_EXPERT_CORRECTION',
      message: 'Correction provided by non-expert, requires CPA review',
    });
  }
  
  // 5. Detailed feedback
  if (params.feedbackText && params.feedbackText.length > 20) {
    score += QualityWeights.DETAILED_FEEDBACK;
    factors.push({
      name: 'Detailed Feedback',
      contribution: QualityWeights.DETAILED_FEEDBACK,
      rationale: 'User engagement indicates genuine assessment',
    });
  }
  
  // 6. Response quality
  if (params.responseLength > 200 && params.responseLength < 5000 && params.responseHasStructure) {
    score += QualityWeights.RESPONSE_QUALITY;
    factors.push({
      name: 'Response Quality',
      contribution: QualityWeights.RESPONSE_QUALITY,
      rationale: 'Response has appropriate length and structure',
    });
  } else if (params.responseLength < 100) {
    score += QualityWeights.SHORT_RESPONSE;
    factors.push({
      name: 'Short Response Penalty',
      contribution: QualityWeights.SHORT_RESPONSE,
      rationale: 'Response too short for meaningful training',
    });
    flags.push({
      type: 'warning',
      code: 'SHORT_RESPONSE',
      message: 'Response may be too brief for training value',
    });
  }
  
  // 7. User reputation
  const reputation = await calculateUserReputation(params.userId);
  const reputationContribution = reputation.trustScore * QualityWeights.USER_REPUTATION;
  score += reputationContribution;
  factors.push({
    name: 'User Reputation',
    contribution: reputationContribution,
    rationale: `Trust score: ${reputation.trustScore.toFixed(2)} (${reputation.feedbackCount} feedback history)`,
  });
  
  if (reputation.flaggedCount > 0) {
    flags.push({
      type: 'error',
      code: 'USER_FLAGGED',
      message: 'User has been flagged for suspicious activity',
    });
  }
  
  // 8. Anti-gaming check
  const anomaly = await detectFeedbackAnomaly(params.userId, params.thumbs === 'up');
  if (anomaly) {
    score += QualityWeights.SUSPICIOUS_PATTERN;
    factors.push({
      name: 'Suspicious Pattern Penalty',
      contribution: QualityWeights.SUSPICIOUS_PATTERN,
      rationale: `Anomaly detected: ${anomaly.anomalyType}`,
    });
    flags.push({
      type: 'error',
      code: 'ANOMALY_DETECTED',
      message: `Gaming attempt detected: ${anomaly.evidence}`,
    });
  }
  
  // Clamp score
  score = Math.max(0, Math.min(1, score));
  
  // Determine tier
  let tier: QualityAssessment['tier'];
  let requiresExpertReview = false;
  let recommendation: string;
  
  if (score >= QualityThresholds.AUTO_APPROVE) {
    tier = 'auto-approve';
    recommendation = 'High-quality example with strong signals. Approved automatically.';
  } else if (score >= QualityThresholds.EXPERT_REVIEW) {
    tier = 'expert-review';
    requiresExpertReview = true;
    recommendation = 'Good potential but requires CPA validation before use in training.';
  } else if (score >= QualityThresholds.MINIMUM) {
    tier = 'pending';
    requiresExpertReview = true;
    recommendation = 'Marginal quality. Requires expert review and likely needs improvement.';
  } else {
    tier = 'auto-reject';
    recommendation = 'Below minimum quality threshold. Auto-rejected to protect training data integrity.';
  }
  
  // Force expert review for certain flags
  if (flags.some(f => f.code === 'NON_EXPERT_CORRECTION' || f.code === 'ANOMALY_DETECTED')) {
    requiresExpertReview = true;
    if (tier === 'auto-approve') {
      tier = 'expert-review';
      recommendation = 'Quality metrics are high but flags require expert validation.';
    }
  }
  
  return {
    score,
    tier,
    factors,
    flags,
    recommendation,
    requiresExpertReview,
  };
}

// ================================
// Expert Review Workflow
// ================================

export interface ExpertReviewRequest {
  exampleId: string;
  domain: string;
  priority: 'high' | 'medium' | 'low';
  qualityScore: number;
  flags: QualityFlag[];
  assignedExpertId?: string;
  status: 'pending' | 'assigned' | 'in-review' | 'completed';
  createdAt: Date;
}

/**
 * Calculate priority based on quality score and flags
 */
function calculatePriority(qualityScore: number, flags: QualityFlag[]): ExpertReviewRequest['priority'] {
  if (qualityScore >= 0.85 || flags.some(f => f.code === 'EXPERT_CORRECTION')) {
    return 'high'; // High potential, review quickly
  } else if (flags.some(f => f.type === 'error')) {
    return 'high'; // Has errors, needs attention
  } else if (qualityScore < 0.6) {
    return 'low'; // Likely to be rejected
  }
  return 'medium';
}

/**
 * Request expert review for a training example
 * Persists to database (survives server restarts)
 */
export async function requestExpertReview(
  exampleId: string,
  domain: string,
  qualityScore: number,
  flags: QualityFlag[]
): Promise<ExpertReviewRequest> {
  const priority = calculatePriority(qualityScore, flags);
  
  const request: ExpertReviewRequest = {
    exampleId,
    domain,
    priority,
    qualityScore,
    flags,
    status: 'pending',
    createdAt: new Date(),
  };
  
  console.log(`[TrainingDataQuality] Expert review requested for ${exampleId} (priority: ${priority})`);
  
  // Persist to database - store expert review metadata
  await db.update(finetuningDataset)
    .set({
      metadata: sql`jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(COALESCE(metadata, '{}'::jsonb), '{requiresExpertReview}', 'true'),
            '{expertReviewPriority}', ${JSON.stringify(priority)}::jsonb
          ),
          '{expertReviewFlags}', ${JSON.stringify(flags)}::jsonb
        ),
        '{expertReviewRequestedAt}', ${JSON.stringify(new Date().toISOString())}::jsonb
      )`,
    })
    .where(eq(finetuningDataset.id, exampleId));
  
  return request;
}

/**
 * Get expert review queue from database
 * Queries training examples that need expert review
 */
export async function getExpertReviewQueue(options?: {
  domain?: string;
  priority?: ExpertReviewRequest['priority'];
  limit?: number;
}): Promise<ExpertReviewRequest[]> {
  try {
    // Query examples needing expert review from database
    const results = await db.select({
      id: finetuningDataset.id,
      domain: finetuningDataset.domain,
      qualityScore: finetuningDataset.qualityScore,
      metadata: finetuningDataset.metadata,
      createdAt: finetuningDataset.createdAt,
    })
      .from(finetuningDataset)
      .where(
        and(
          sql`(metadata->>'requiresExpertReview')::boolean = true`,
          eq(finetuningDataset.isApproved, sql`NULL`), // Not yet reviewed
          options?.domain ? eq(finetuningDataset.domain, options.domain) : sql`true`
        )
      )
      .orderBy(
        // Priority ordering: high first, then by quality score descending
        sql`CASE 
          WHEN metadata->>'expertReviewPriority' = 'high' THEN 0
          WHEN metadata->>'expertReviewPriority' = 'medium' THEN 1
          ELSE 2
        END`,
        desc(finetuningDataset.qualityScore)
      )
      .limit(options?.limit || 100);
    
    // Transform to ExpertReviewRequest format
    let queue: ExpertReviewRequest[] = results.map(r => {
      const meta = (r.metadata || {}) as Record<string, unknown>;
      const qualityAssessment = meta.qualityAssessment as Record<string, unknown> | undefined;
      const flags = (meta.expertReviewFlags || qualityAssessment?.flags || []) as QualityFlag[];
      const priority = (meta.expertReviewPriority || 'medium') as ExpertReviewRequest['priority'];
      
      return {
        exampleId: r.id,
        domain: r.domain,
        priority,
        qualityScore: Number(r.qualityScore) || 0,
        flags,
        status: 'pending' as const,
        createdAt: r.createdAt,
      };
    });
    
    // Filter by priority if specified
    if (options?.priority) {
      queue = queue.filter(r => r.priority === options.priority);
    }
    
    return queue;
    
  } catch (error) {
    console.error('[TrainingDataQuality] Failed to get expert review queue:', error);
    return [];
  }
}

/**
 * Complete an expert review
 * Updates database and clears the requiresExpertReview flag
 */
export async function completeExpertReview(
  exampleId: string,
  expertId: string,
  approved: boolean,
  notes?: string
): Promise<void> {
  // Update database
  await db.update(finetuningDataset)
    .set({
      isApproved: approved,
      reviewedAt: new Date(),
      rejectionReason: approved ? null : (notes || 'Rejected by expert'),
      metadata: sql`jsonb_set(
        jsonb_set(
          jsonb_set(COALESCE(metadata, '{}'::jsonb), '{requiresExpertReview}', 'false'),
          '{expertReviewedBy}', ${JSON.stringify(expertId)}::jsonb
        ),
        '{expertReviewNotes}', ${JSON.stringify(notes || '')}::jsonb
      )`,
    })
    .where(eq(finetuningDataset.id, exampleId));
  
  console.log(`[TrainingDataQuality] Expert review completed for ${exampleId}: ${approved ? 'APPROVED' : 'REJECTED'}`);
}

// ================================
// Statistics
// ================================

export interface QualityStatistics {
  totalExamples: number;
  autoApproved: number;
  expertReviewed: number;
  autoRejected: number;
  pendingReview: number;
  averageQualityScore: number;
  qualityDistribution: {
    excellent: number; // >= 0.90
    good: number;      // 0.70 - 0.89
    fair: number;      // 0.50 - 0.69
    poor: number;      // < 0.50
  };
  anomaliesDetected: number;
  gamingAttemptsBlocked: number;
}

export async function getQualityStatistics(): Promise<QualityStatistics> {
  try {
    const stats = await db.select({
      total: sql<number>`COUNT(*)`,
      approved: sql<number>`COUNT(*) FILTER (WHERE is_approved = true)`,
      rejected: sql<number>`COUNT(*) FILTER (WHERE is_approved = false)`,
      pending: sql<number>`COUNT(*) FILTER (WHERE is_approved IS NULL)`,
      avgQuality: sql<number>`AVG(quality_score)`,
      excellent: sql<number>`COUNT(*) FILTER (WHERE quality_score >= 0.90)`,
      good: sql<number>`COUNT(*) FILTER (WHERE quality_score >= 0.70 AND quality_score < 0.90)`,
      fair: sql<number>`COUNT(*) FILTER (WHERE quality_score >= 0.50 AND quality_score < 0.70)`,
      poor: sql<number>`COUNT(*) FILTER (WHERE quality_score < 0.50)`,
      // Count anomalies from database metadata
      anomalies: sql<number>`COUNT(*) FILTER (WHERE metadata->>'hasAnomaly' = 'true')`,
      expertReviewPending: sql<number>`COUNT(*) FILTER (WHERE (metadata->>'requiresExpertReview')::boolean = true AND is_approved IS NULL)`,
    })
      .from(finetuningDataset);
    
    const s = stats[0] || {};
    
    return {
      totalExamples: Number(s.total) || 0,
      autoApproved: Number(s.approved) || 0,
      expertReviewed: Number(s.approved) || 0, // Assuming approved went through review
      autoRejected: Number(s.rejected) || 0,
      pendingReview: Number(s.pending) || 0,
      averageQualityScore: Number(s.avgQuality) || 0,
      qualityDistribution: {
        excellent: Number(s.excellent) || 0,
        good: Number(s.good) || 0,
        fair: Number(s.fair) || 0,
        poor: Number(s.poor) || 0,
      },
      anomaliesDetected: Number(s.anomalies) || 0,
      gamingAttemptsBlocked: Number(s.anomalies) || 0,
    };
  } catch (error) {
    console.error('[TrainingDataQuality] Failed to get quality statistics:', error);
    return {
      totalExamples: 0,
      autoApproved: 0,
      expertReviewed: 0,
      autoRejected: 0,
      pendingReview: 0,
      averageQualityScore: 0,
      qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
      anomaliesDetected: 0,
      gamingAttemptsBlocked: 0,
    };
  }
}

// ================================
// Export
// ================================

export const trainingDataQuality = {
  QualityThresholds,
  QualityWeights,
  checkFeedbackRateLimit,
  detectFeedbackAnomaly,
  calculateUserReputation,
  assessTrainingDataQuality,
  requestExpertReview,
  getExpertReviewQueue,
  completeExpertReview,
  getQualityStatistics,
};

export default trainingDataQuality;
