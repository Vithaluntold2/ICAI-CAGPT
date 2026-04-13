/**
 * Continuous Learning Service
 * Handles feedback capture, finetuning dataset creation, and model improvement loops
 * 
 * This service uses the existing schema tables:
 * - messageFeedback: User feedback on individual messages
 * - finetuningDataset: Training examples for model improvement
 * - interactionLogs: Full context capture for learning pipeline
 */

import { EventEmitter } from 'events';
import { db } from '../../db';
import { messageFeedback, finetuningDataset, interactionLogs, messages, users } from '../../../shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import type { QueryClassification } from '../queryTriage';
import {
  checkFeedbackRateLimit,
  assessTrainingDataQuality,
  requestExpertReview,
  QualityThresholds,
  type QualityAssessment,
} from './trainingDataQuality';

// ================================
// Types
// ================================

export interface FeedbackData {
  messageId: string;
  conversationId: string;
  userId: string;
  rating?: number; // 1-5
  thumbs?: 'up' | 'down';
  correctedContent?: string;
  feedbackText?: string;
  tags?: string[];
}

export interface TrainingExample {
  id: string;
  userMessage: string;
  assistantResponse: string;
  domain: string;
  jurisdiction?: string;
  qualityScore: number;
  isApproved: boolean | null;
  metadata: Record<string, unknown>;
}

export interface LearningMetrics {
  totalFeedback: number;
  positiveRate: number;
  negativeRate: number;
  averageRating: number;
  trainingExamples: number;
  approvedExamples: number;
  domainBreakdown: Record<string, number>;
}

// ================================
// Configuration
// ================================

interface ContinuousLearningConfig {
  minQualityScore: number;
  autoApproveThreshold: number;
  feedbackWindowHours: number;
  minExamplesForTraining: number;
  negativeFeedbackWeight: number;
}

const DEFAULT_CONFIG: ContinuousLearningConfig = {
  // Using research-based thresholds from trainingDataQuality.ts
  // See QualityThresholds for rationale documentation
  minQualityScore: QualityThresholds.MINIMUM, // 0.50 - research-backed minimum
  autoApproveThreshold: QualityThresholds.AUTO_APPROVE, // 0.90 - only exceptional examples
  feedbackWindowHours: 24,
  minExamplesForTraining: 500, // OpenAI recommends 500-1000+ for finetuning
  negativeFeedbackWeight: 2.0,
};

// ================================
// Continuous Learning Service
// ================================

class ContinuousLearningService extends EventEmitter {
  private config: ContinuousLearningConfig;

  constructor(config: Partial<ContinuousLearningConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[ContinuousLearning] Service initialized');
  }

  // ================================
  // Feedback Collection
  // ================================

  /**
   * Record user feedback for a message
   * Uses existing messageFeedback schema
   * 
   * SECURITY: Includes rate limiting and anti-gaming protection
   */
  async recordFeedback(feedback: FeedbackData): Promise<string> {
    try {
      // Anti-gaming: Check rate limits first
      const rateCheck = checkFeedbackRateLimit(feedback.userId);
      if (!rateCheck.allowed) {
        console.warn(`[ContinuousLearning] Rate limit exceeded for user ${feedback.userId}: ${rateCheck.reason}`);
        throw new Error(`Rate limit exceeded: ${rateCheck.reason}. Retry after ${Math.ceil((rateCheck.retryAfterMs || 0) / 1000)} seconds.`);
      }
      
      // Convert thumbs to isHelpful boolean
      const isHelpful = feedback.thumbs === 'up' ? true : 
                       feedback.thumbs === 'down' ? false : null;
      
      // Determine feedback type
      const feedbackType = feedback.correctedContent ? 'correction' :
                          feedback.thumbs ? 'thumbs' : 'rating';
      
      const [result] = await db.insert(messageFeedback).values({
        messageId: feedback.messageId,
        conversationId: feedback.conversationId,
        userId: feedback.userId,
        rating: feedback.rating || 0,
        feedbackType,
        comment: feedback.feedbackText || null,
        correctedResponse: feedback.correctedContent || null,
        isHelpful,
        tags: feedback.tags || [],
      }).returning({ id: messageFeedback.id });

      // Update interaction log to mark feedback received
      await this.updateInteractionFeedbackStatus(feedback.conversationId, feedback.messageId);

      this.emit('feedback:recorded', { 
        feedbackId: result.id, 
        messageId: feedback.messageId,
        sentiment: isHelpful ? 'positive' : 'negative',
      });

      console.log(`[ContinuousLearning] Recorded feedback ${result.id} for message ${feedback.messageId}`);

      // Check if we should create a training example
      await this.processNewFeedback(result.id, feedback);

      return result.id;

    } catch (error) {
      console.error('[ContinuousLearning] Failed to record feedback:', error);
      throw error;
    }
  }

  /**
   * Update interaction log to mark feedback received
   */
  private async updateInteractionFeedbackStatus(conversationId: string, messageId: string): Promise<void> {
    try {
      await db.update(interactionLogs)
        .set({ userRating: 1 }) // Mark as having feedback
        .where(and(
          eq(interactionLogs.conversationId, conversationId),
          eq(interactionLogs.messageId, messageId)
        ));
    } catch (error) {
      // Non-critical, just log
      console.warn('[ContinuousLearning] Could not update interaction log:', error);
    }
  }

  // ================================
  // Interaction Logging
  // ================================

  /**
   * Log an interaction for learning purposes
   * Uses existing interactionLogs schema
   */
  async logInteraction(params: {
    userId: number;
    conversationId: number;
    messageId?: number;
    query: string;
    response: string;
    classification?: QueryClassification;
    modelUsed?: string;
    retrievalTimeMs?: number;
    totalTimeMs?: number;
    contextUsed?: string[];
  }): Promise<string> {
    try {
      const [result] = await db.insert(interactionLogs).values({
        userId: String(params.userId),
        conversationId: String(params.conversationId),
        messageId: params.messageId ? String(params.messageId) : null,
        query: params.query,
        response: params.response,
        queryClassification: params.classification || null,
        modelUsed: params.modelUsed || null,
        tokensUsed: 0,
        responseTimeMs: params.totalTimeMs || null,
        retrievedContextIds: params.contextUsed || [],
        retrievedContextScores: [],
        needsReview: false,
      }).returning({ id: interactionLogs.id });

      return result.id;

    } catch (error) {
      console.error('[ContinuousLearning] Failed to log interaction:', error);
      throw error;
    }
  }

  // ================================
  // Training Data Generation
  // ================================

  /**
   * Process new feedback to potentially create training examples
   * 
   * ENHANCED: Now uses research-based quality assessment with:
   * - Multi-factor scoring (rating, thumbs, correction, user reputation)
   * - Anti-gaming detection
   * - Expert review workflow for non-auto-approved examples
   */
  private async processNewFeedback(feedbackId: string, feedback: FeedbackData): Promise<void> {
    // Only create training examples from positive feedback or corrections
    const isPositive = feedback.thumbs === 'up' || (feedback.rating && feedback.rating >= 4);
    const hasCorrection = !!feedback.correctedContent;

    if (!isPositive && !hasCorrection) {
      return; // Skip negative feedback without corrections
    }

    try {
      // Get the original message and conversation
      const interaction = await this.getInteractionByMessage(feedback.conversationId, feedback.messageId);
      
      if (!interaction) {
        console.warn(`[ContinuousLearning] No interaction found for message ${feedback.messageId}`);
        return;
      }

      // Check if user is an expert (CPA/admin)
      const isExpertCorrection = hasCorrection && await this.isUserExpert(feedback.userId);

      // Use the new multi-factor quality assessment
      const assessment: QualityAssessment = await assessTrainingDataQuality({
        messageId: feedback.messageId,
        userId: feedback.userId,
        rating: feedback.rating,
        thumbs: feedback.thumbs,
        hasCorrection,
        isExpertCorrection,
        feedbackText: feedback.feedbackText,
        responseLength: interaction.response.length,
        responseHasStructure: this.hasStructuredResponse(interaction.response),
      });

      // Log quality assessment details
      console.log(`[ContinuousLearning] Quality assessment for ${feedback.messageId}:`);
      console.log(`  Score: ${assessment.score.toFixed(3)} | Tier: ${assessment.tier}`);
      assessment.factors.forEach(f => console.log(`  Factor: ${f.name} (${f.contribution > 0 ? '+' : ''}${f.contribution.toFixed(3)})`));
      if (assessment.flags.length > 0) {
        console.log(`  Flags: ${assessment.flags.map(f => f.code).join(', ')}`);
      }

      // Check minimum threshold
      if (assessment.score < this.config.minQualityScore) {
        console.log(`[ContinuousLearning] Quality score ${assessment.score.toFixed(3)} below minimum threshold (${this.config.minQualityScore}), auto-rejecting`);
        this.emit('training:example-rejected', { 
          feedbackId, 
          qualityScore: assessment.score,
          reason: 'Below minimum quality threshold',
        });
        return;
      }

      // Create training example
      const output = hasCorrection ? feedback.correctedContent! : interaction.response;
      
      // Determine approval status based on tier
      let isApproved: boolean | null = null;
      if (assessment.tier === 'auto-approve') {
        isApproved = true;
      } else if (assessment.tier === 'auto-reject') {
        isApproved = false;
      }
      // 'expert-review' and 'pending' remain null (requires review)
      
      const [result] = await db.insert(finetuningDataset).values({
        messageId: feedback.messageId,
        conversationId: feedback.conversationId,
        systemPrompt: 'You are CA GPT, an ICAI-aligned accounting superintelligence and expert CA advisor.',
        userMessage: interaction.query,
        assistantResponse: output,
        domain: interaction.domain || 'general_accounting',
        jurisdiction: interaction.jurisdiction || null,
        complexity: interaction.complexity || 'standard',
        qualityScore: assessment.score,
        isApproved,
        sourceType: hasCorrection ? 'feedback' : 'interaction',
        sourceId: feedbackId,
        metadata: {
          modelUsed: interaction.modelUsed,
          wasCorrection: hasCorrection,
          isExpertCorrection,
          originalRating: feedback.rating,
          feedbackId,
          qualityAssessment: {
            tier: assessment.tier,
            factors: assessment.factors,
            flags: assessment.flags,
            recommendation: assessment.recommendation,
          },
        },
      }).returning({ id: finetuningDataset.id });

      console.log(`[ContinuousLearning] Created training example ${result.id} with quality ${assessment.score.toFixed(3)} (tier: ${assessment.tier})`);
      
      // If requires expert review, queue it
      if (assessment.requiresExpertReview && assessment.tier !== 'auto-reject') {
        await requestExpertReview(
          result.id,
          interaction.domain || 'general_accounting',
          assessment.score,
          assessment.flags
        );
        console.log(`[ContinuousLearning] Queued ${result.id} for expert (CPA) review`);
      }

      this.emit('training:example-created', { 
        exampleId: result.id,
        feedbackId, 
        qualityScore: assessment.score,
        tier: assessment.tier,
        requiresExpertReview: assessment.requiresExpertReview,
      });

    } catch (error) {
      console.error('[ContinuousLearning] Failed to process feedback:', error);
    }
  }

  /**
   * Check if a user has expert role (admin = CPA expert in this system)
   */
  private async isUserExpert(userId: string): Promise<boolean> {
    try {
      const [user] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      return user?.isAdmin === true;
    } catch {
      return false;
    }
  }

  /**
   * Check if response has structured formatting (headers, lists, etc.)
   */
  private hasStructuredResponse(response: string): boolean {
    const hasHeaders = /^#{1,3}\s/m.test(response);
    const hasBullets = /^[-*]\s/m.test(response);
    const hasNumberedList = /^\d+\.\s/m.test(response);
    const hasSections = response.split('\n\n').length >= 3;
    
    return hasHeaders || hasBullets || hasNumberedList || hasSections;
  }

  /**
   * Get interaction details by message ID
   */
  private async getInteractionByMessage(
    conversationId: string,
    messageId: string
  ): Promise<{
    query: string;
    response: string;
    domain?: string;
    jurisdiction?: string;
    complexity?: string;
    modelUsed?: string;
  } | null> {
    try {
      // First try interaction logs
      const [log] = await db.select()
        .from(interactionLogs)
        .where(and(
          eq(interactionLogs.conversationId, conversationId),
          eq(interactionLogs.messageId, messageId)
        ))
        .limit(1);

      if (log) {
        const classification = log.queryClassification as QueryClassification | null;
        return {
          query: log.query,
          response: log.response,
          domain: classification?.domain,
          jurisdiction: classification?.jurisdiction?.[0],
          complexity: classification?.complexity,
          modelUsed: log.modelUsed || undefined,
        };
      }

      // Fallback to messages table
      const [message] = await db.select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!message) return null;

      // Get the previous user message as the query
      const [userMessage] = await db.select()
        .from(messages)
        .where(and(
          eq(messages.conversationId, conversationId),
          eq(messages.role, 'user')
        ))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return {
        query: userMessage?.content || '',
        response: message.content,
      };

    } catch (error) {
      console.error('[ContinuousLearning] Failed to get interaction:', error);
      return null;
    }
  }

  /**
   * Calculate quality score for a training example
   */
  private calculateQualityScore(
    feedback: FeedbackData,
    interaction: { query: string; response: string }
  ): number {
    let score = 0.5; // Base score

    // Rating contribution (0-0.3)
    if (feedback.rating) {
      score += (feedback.rating - 1) / 4 * 0.3;
    }

    // Thumbs contribution (0-0.2)
    if (feedback.thumbs === 'up') {
      score += 0.2;
    } else if (feedback.thumbs === 'down') {
      score -= 0.3;
    }

    // Correction provides high value (0.15)
    if (feedback.correctedContent) {
      score += 0.15;
    }

    // Written feedback shows engagement (0.1)
    if (feedback.feedbackText && feedback.feedbackText.length > 10) {
      score += 0.1;
    }

    // Response length quality (0-0.1)
    const responseLength = interaction.response.length;
    if (responseLength > 100 && responseLength < 5000) {
      score += 0.1;
    } else if (responseLength < 50 || responseLength > 10000) {
      score -= 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  // ================================
  // Training Dataset Management
  // ================================

  /**
   * Get approved training examples for finetuning
   */
  async getApprovedTrainingData(options?: {
    domain?: string;
    limit?: number;
    minQuality?: number;
  }): Promise<TrainingExample[]> {
    try {
      const results = await db.select()
        .from(finetuningDataset)
        .where(eq(finetuningDataset.isApproved, true))
        .limit(options?.limit || 1000);

      return results.map(r => ({
        id: r.id,
        userMessage: r.userMessage,
        assistantResponse: r.assistantResponse,
        domain: r.domain,
        jurisdiction: r.jurisdiction || undefined,
        qualityScore: Number(r.qualityScore) || 0,
        isApproved: r.isApproved,
        metadata: (r.metadata as Record<string, unknown>) || {},
      }));

    } catch (error) {
      console.error('[ContinuousLearning] Failed to get training data:', error);
      return [];
    }
  }

  /**
   * Export training data in JSONL format for finetuning
   */
  async exportTrainingDataJSONL(options?: {
    domain?: string;
    minQuality?: number;
  }): Promise<string> {
    const examples = await this.getApprovedTrainingData(options);
    
    return examples.map(ex => JSON.stringify({
      messages: [
        { role: 'system', content: 'You are CA GPT, an ICAI-aligned accounting superintelligence and expert CA advisor.' },
        { role: 'user', content: ex.userMessage },
        { role: 'assistant', content: ex.assistantResponse },
      ],
      metadata: {
        domain: ex.domain,
        jurisdiction: ex.jurisdiction,
        quality: ex.qualityScore,
      },
    })).join('\n');
  }

  /**
   * Approve a training example manually
   */
  async approveTrainingExample(exampleId: string, approved: boolean): Promise<void> {
    await db.update(finetuningDataset)
      .set({ isApproved: approved })
      .where(eq(finetuningDataset.id, exampleId));

    this.emit('training:example-updated', { exampleId, approved });
  }

  // ================================
  // Analytics & Metrics
  // ================================

  /**
   * Get learning metrics
   */
  async getMetrics(): Promise<LearningMetrics> {
    try {
      // Get feedback counts using isHelpful field
      const feedbackCounts = await db.select({
        total: sql<number>`COUNT(*)`,
        helpful: sql<number>`COUNT(*) FILTER (WHERE is_helpful = true)`,
        notHelpful: sql<number>`COUNT(*) FILTER (WHERE is_helpful = false)`,
        avgRating: sql<number>`AVG(rating)`,
      }).from(messageFeedback);

      const fc = feedbackCounts[0] || { total: 0, helpful: 0, notHelpful: 0, avgRating: 0 };

      // Get training example counts
      const trainingCounts = await db.select({
        total: sql<number>`COUNT(*)`,
        approved: sql<number>`COUNT(*) FILTER (WHERE is_approved = true)`,
      }).from(finetuningDataset);

      const tc = trainingCounts[0] || { total: 0, approved: 0 };

      // Get domain breakdown
      const domainBreakdown = await db.select({
        domain: finetuningDataset.domain,
        count: sql<number>`COUNT(*)`,
      })
        .from(finetuningDataset)
        .groupBy(finetuningDataset.domain);

      const domainMap: Record<string, number> = {};
      for (const d of domainBreakdown) {
        domainMap[d.domain] = Number(d.count);
      }

      return {
        totalFeedback: Number(fc.total) || 0,
        positiveRate: fc.total ? Number(fc.helpful) / Number(fc.total) : 0,
        negativeRate: fc.total ? Number(fc.notHelpful) / Number(fc.total) : 0,
        averageRating: Number(fc.avgRating) || 0,
        trainingExamples: Number(tc.total) || 0,
        approvedExamples: Number(tc.approved) || 0,
        domainBreakdown: domainMap,
      };

    } catch (error) {
      console.error('[ContinuousLearning] Failed to get metrics:', error);
      return {
        totalFeedback: 0,
        positiveRate: 0,
        negativeRate: 0,
        averageRating: 0,
        trainingExamples: 0,
        approvedExamples: 0,
        domainBreakdown: {},
      };
    }
  }

  /**
   * Get recent feedback for review
   */
  async getRecentFeedback(limit: number = 50): Promise<Array<{
    id: string;
    messageId: string;
    rating: number;
    isHelpful?: boolean;
    comment?: string;
    createdAt: Date;
  }>> {
    try {
      const results = await db.select({
        id: messageFeedback.id,
        messageId: messageFeedback.messageId,
        rating: messageFeedback.rating,
        isHelpful: messageFeedback.isHelpful,
        comment: messageFeedback.comment,
        createdAt: messageFeedback.createdAt,
      })
        .from(messageFeedback)
        .orderBy(desc(messageFeedback.createdAt))
        .limit(limit);

      return results.map(r => ({
        id: r.id,
        messageId: r.messageId,
        rating: r.rating,
        isHelpful: r.isHelpful ?? undefined,
        comment: r.comment ?? undefined,
        createdAt: r.createdAt,
      }));

    } catch (error) {
      console.error('[ContinuousLearning] Failed to get recent feedback:', error);
      return [];
    }
  }

  /**
   * Check if we have enough data for finetuning
   */
  async isReadyForFinetuning(): Promise<{ ready: boolean; current: number; required: number }> {
    const metrics = await this.getMetrics();
    return {
      ready: metrics.approvedExamples >= this.config.minExamplesForTraining,
      current: metrics.approvedExamples,
      required: this.config.minExamplesForTraining,
    };
  }
}

// ================================
// Singleton Export
// ================================

export const continuousLearning = new ContinuousLearningService();
export default continuousLearning;
