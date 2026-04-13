/**
 * Admin Routes for Training Data Management & Finetuning
 * 
 * Endpoints for:
 * - Training data review and approval
 * - Finetuning job management
 * - System status monitoring
 * 
 * Security Features:
 * - Session-cached admin check (no DB query per request)
 * - Audit logging for all mutations
 * - Bulk operation limits
 * - CSRF token validation on mutations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { finetuningDataset, messageFeedback, users, auditLogs } from '../../shared/schema';
import { eq, and, desc, asc, sql, or, ilike } from 'drizzle-orm';
import { finetuningOrchestrator } from '../services/core/finetuningOrchestrator';
import { continuousLearning } from '../services/core/continuousLearning';
import {
  getExpertReviewQueue,
  completeExpertReview,
  getQualityStatistics,
  QualityThresholds,
} from '../services/core/trainingDataQuality';
import crypto from 'crypto';

const router = Router();

// ================================
// Constants
// ================================

const BULK_OPERATION_LIMIT = 100; // Max items per bulk operation
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// ================================
// Types
// ================================

interface AdminSession {
  isAdmin: boolean;
  verifiedAt: number;
  userId: string;
}

// Extend session type
declare module 'express-session' {
  interface SessionData {
    adminCache?: AdminSession;
    csrfToken?: string;
  }
}

// ================================
// Audit Logger
// ================================

async function logAuditEvent(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details: Record<string, unknown>,
  req: Request
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
    });
  } catch (error) {
    console.error('[AuditLog] Failed to write audit log:', error);
    // Don't throw - audit log failure shouldn't block the operation
  }
}

// ================================
// Middleware: Admin Check (with session cache)
// ================================

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore - user attached by auth middleware
  const userId = req.user?.id || req.session?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check session cache first
    const adminCache = req.session?.adminCache;
    const now = Date.now();
    
    if (
      adminCache &&
      adminCache.userId === userId &&
      adminCache.isAdmin &&
      (now - adminCache.verifiedAt) < ADMIN_CACHE_TTL_MS
    ) {
      // Cache hit - skip DB query
      return next();
    }

    // Cache miss or expired - query DB
    const [user] = await db.select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.isAdmin) {
      // Clear any stale cache
      if (req.session) {
        req.session.adminCache = undefined;
      }
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Update session cache
    if (req.session) {
      req.session.adminCache = {
        isAdmin: true,
        verifiedAt: now,
        userId,
      };
    }

    next();
  } catch (error) {
    console.error('[AdminRoutes] Auth check failed:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

// ================================
// Middleware: CSRF Protection for mutations
// ================================

const validateCsrf = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET requests
  if (req.method === 'GET') {
    return next();
  }

  const csrfHeader = req.get('X-CSRF-Token');
  const sessionToken = req.session?.csrfToken;

  // If no session token exists, generate one (first request)
  if (!sessionToken) {
    const newToken = crypto.randomBytes(32).toString('hex');
    if (req.session) {
      req.session.csrfToken = newToken;
    }
    // For first request, we'll accept it but set the token
    // Client should include this token in subsequent requests
    res.setHeader('X-CSRF-Token', newToken);
    return next();
  }

  // Validate CSRF token
  if (!csrfHeader || csrfHeader !== sessionToken) {
    console.warn('[CSRF] Token mismatch', { 
      hasHeader: !!csrfHeader, 
      hasSession: !!sessionToken 
    });
    return res.status(403).json({ 
      error: 'CSRF token invalid or missing',
      hint: 'Include X-CSRF-Token header from previous response'
    });
  }

  next();
};

// ================================
// CSRF Token Endpoint
// ================================

router.get('/csrf-token', requireAdmin, (req: Request, res: Response) => {
  // Generate or return existing CSRF token
  if (!req.session?.csrfToken) {
    const token = crypto.randomBytes(32).toString('hex');
    if (req.session) {
      req.session.csrfToken = token;
    }
    return res.json({ token });
  }
  res.json({ token: req.session.csrfToken });
});

// Apply CSRF validation to all routes below
router.use(validateCsrf);

// ================================
// Training Data Endpoints
// ================================

/**
 * GET /api/admin/training-data
 * List training examples with filters
 */
router.get('/training-data', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      status = 'pending',  // 'pending' | 'approved' | 'rejected' | 'all'
      domain,
      jurisdiction,
      search,  // New: search parameter for filtering
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    const conditions = [];
    
    if (status === 'pending') {
      conditions.push(sql`is_approved IS NULL`);
    } else if (status === 'approved') {
      conditions.push(eq(finetuningDataset.isApproved, true));
    } else if (status === 'rejected') {
      conditions.push(eq(finetuningDataset.isApproved, false));
    }

    if (domain) {
      conditions.push(eq(finetuningDataset.domain, domain as string));
    }

    if (jurisdiction) {
      conditions.push(eq(finetuningDataset.jurisdiction, jurisdiction as string));
    }

    // Add search functionality across text fields
    if (search && typeof search === 'string') {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          ilike(finetuningDataset.userMessage, searchTerm),
          ilike(finetuningDataset.assistantResponse, searchTerm),
          ilike(finetuningDataset.systemPrompt, searchTerm)
        )
      );
    }

    // Get total count
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(finetuningDataset)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get paginated results
    const orderColumn = sortBy === 'qualityScore' 
      ? finetuningDataset.qualityScore 
      : finetuningDataset.createdAt;
    
    const orderDirection = sortOrder === 'asc' ? asc : desc;

    const examples = await db.select({
      id: finetuningDataset.id,
      systemPrompt: finetuningDataset.systemPrompt,
      userMessage: finetuningDataset.userMessage,
      assistantResponse: finetuningDataset.assistantResponse,
      domain: finetuningDataset.domain,
      jurisdiction: finetuningDataset.jurisdiction,
      qualityScore: finetuningDataset.qualityScore,
      isApproved: finetuningDataset.isApproved,
      isUsed: finetuningDataset.isUsed,
      createdAt: finetuningDataset.createdAt,
      sourceType: finetuningDataset.sourceType,
      sourceId: finetuningDataset.sourceId,
    })
      .from(finetuningDataset)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderDirection(orderColumn))
      .limit(limitNum)
      .offset(offset);

    res.json({
      data: examples,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limitNum),
      },
    });

  } catch (error) {
    console.error('[AdminRoutes] Error fetching training data:', error);
    res.status(500).json({ error: 'Failed to fetch training data' });
  }
});

/**
 * GET /api/admin/training-data/:id
 * Get single training example details
 */
router.get('/training-data/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [example] = await db.select()
      .from(finetuningDataset)
      .where(eq(finetuningDataset.id, id))
      .limit(1);

    if (!example) {
      return res.status(404).json({ error: 'Training example not found' });
    }

    res.json(example);

  } catch (error) {
    console.error('[AdminRoutes] Error fetching training example:', error);
    res.status(500).json({ error: 'Failed to fetch training example' });
  }
});

/**
 * PATCH /api/admin/training-data/:id/approve
 * Approve or reject a training example
 */
router.patch('/training-data/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, rejectionReason } = req.body;
    // @ts-ignore
    const userId = req.user?.id || req.session?.userId;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved field is required (boolean)' });
    }

    // Get the example before update for audit log
    const [before] = await db.select({ 
      isApproved: finetuningDataset.isApproved,
      domain: finetuningDataset.domain 
    })
      .from(finetuningDataset)
      .where(eq(finetuningDataset.id, id))
      .limit(1);

    if (!before) {
      return res.status(404).json({ error: 'Training example not found' });
    }

    await db.update(finetuningDataset)
      .set({
        isApproved: approved,
        rejectionReason: approved ? null : (rejectionReason || null),
        reviewedAt: new Date(),
      })
      .where(eq(finetuningDataset.id, id));

    // Audit log
    await logAuditEvent(
      userId || 'unknown',
      approved ? 'training_data.approve' : 'training_data.reject',
      'finetuning_dataset',
      id,
      {
        previousStatus: before.isApproved,
        newStatus: approved,
        rejectionReason: rejectionReason || null,
        domain: before.domain,
      },
      req
    );

    const [updated] = await db.select()
      .from(finetuningDataset)
      .where(eq(finetuningDataset.id, id))
      .limit(1);

    // Integrate continuous learning - update model from feedback
    try {
      await continuousLearning.updateFromFeedback({
        exampleId: id,
        approved,
        feedback: rejectionReason || (approved ? 'Approved for training' : 'Rejected'),
        domain: before.domain || 'general',
        userId: userId || 'unknown',
      });
    } catch (learningError) {
      console.warn('[AdminRoutes] Continuous learning update failed:', learningError);
      // Don't fail the request if learning update fails
    }

    res.json({ 
      success: true, 
      message: approved ? 'Example approved' : 'Example rejected',
      data: updated,
    });

  } catch (error) {
    console.error('[AdminRoutes] Error updating training example:', error);
    res.status(500).json({ error: 'Failed to update training example' });
  }
});

/**
 * POST /api/admin/training-data/bulk-approve
 * Bulk approve/reject training examples
 * Limited to BULK_OPERATION_LIMIT items per request
 */
router.post('/training-data/bulk-approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ids, approved, rejectionReason } = req.body;
    // @ts-ignore
    const userId = req.user?.id || req.session?.userId;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    // Enforce bulk operation limit
    if (ids.length > BULK_OPERATION_LIMIT) {
      return res.status(400).json({ 
        error: `Bulk operations limited to ${BULK_OPERATION_LIMIT} items per request`,
        provided: ids.length,
        limit: BULK_OPERATION_LIMIT,
      });
    }

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved field is required (boolean)' });
    }

    let updatedCount = 0;
    for (const id of ids) {
      await db.update(finetuningDataset)
        .set({
          isApproved: approved,
          rejectionReason: approved ? null : (rejectionReason || null),
          reviewedAt: new Date(),
        })
        .where(eq(finetuningDataset.id, id));
      updatedCount++;
    }

    // Audit log for bulk operation
    await logAuditEvent(
      userId || 'unknown',
      approved ? 'training_data.bulk_approve' : 'training_data.bulk_reject',
      'finetuning_dataset',
      null,
      {
        affectedIds: ids,
        count: updatedCount,
        rejectionReason: rejectionReason || null,
      },
      req
    );

    res.json({ 
      success: true, 
      message: `${updatedCount} examples ${approved ? 'approved' : 'rejected'}`,
      count: updatedCount,
    });

  } catch (error) {
    console.error('[AdminRoutes] Error bulk updating:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

/**
 * DELETE /api/admin/training-data/:id
 * Delete a training example
 */
router.delete('/training-data/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // @ts-ignore
    const userId = req.user?.id || req.session?.userId;

    // Get example before delete for audit
    const [example] = await db.select({
      domain: finetuningDataset.domain,
      isApproved: finetuningDataset.isApproved,
    })
      .from(finetuningDataset)
      .where(eq(finetuningDataset.id, id))
      .limit(1);

    await db.delete(finetuningDataset)
      .where(eq(finetuningDataset.id, id));

    // Audit log
    await logAuditEvent(
      userId || 'unknown',
      'training_data.delete',
      'finetuning_dataset',
      id,
      {
        domain: example?.domain,
        wasApproved: example?.isApproved,
      },
      req
    );

    res.json({ success: true, message: 'Example deleted' });

  } catch (error) {
    console.error('[AdminRoutes] Error deleting training example:', error);
    res.status(500).json({ error: 'Failed to delete training example' });
  }
});

// ================================
// Finetuning Endpoints
// ================================

/**
 * GET /api/admin/finetuning/status
 * Get finetuning system status
 */
router.get('/finetuning/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = await finetuningOrchestrator.getStatus();
    res.json(status);
  } catch (error) {
    console.error('[AdminRoutes] Error getting finetuning status:', error);
    res.status(500).json({ error: 'Failed to get finetuning status' });
  }
});

/**
 * GET /api/admin/finetuning/jobs
 * List all finetuning jobs
 */
router.get('/finetuning/jobs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const jobs = finetuningOrchestrator.getJobs();
    res.json({ jobs });
  } catch (error) {
    console.error('[AdminRoutes] Error getting jobs:', error);
    res.status(500).json({ error: 'Failed to get finetuning jobs' });
  }
});

/**
 * GET /api/admin/finetuning/jobs/:id
 * Get specific job details
 */
router.get('/finetuning/jobs/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const job = finetuningOrchestrator.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('[AdminRoutes] Error getting job:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

/**
 * POST /api/admin/finetuning/trigger
 * Manually trigger finetuning
 */
router.post('/finetuning/trigger', requireAdmin, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user?.id || req.session?.userId;
    
    const job = await finetuningOrchestrator.manualTrigger();
    
    if (!job) {
      return res.status(400).json({ 
        error: 'Cannot trigger finetuning',
        message: 'Not enough approved training examples or a job is already running',
      });
    }

    // Audit log
    await logAuditEvent(
      userId || 'unknown',
      'finetuning.trigger',
      'finetuning_job',
      job.id,
      {
        examplesCount: job.examplesCount,
        baseModel: job.baseModel,
        triggeredManually: true,
      },
      req
    );

    res.json({ 
      success: true, 
      message: 'Finetuning job triggered',
      job,
    });

  } catch (error) {
    console.error('[AdminRoutes] Error triggering finetuning:', error);
    res.status(500).json({ error: 'Failed to trigger finetuning' });
  }
});

/**
 * POST /api/admin/finetuning/jobs/:id/cancel
 * Cancel a finetuning job
 */
router.post('/finetuning/jobs/:id/cancel', requireAdmin, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user?.id || req.session?.userId;
    
    const success = await finetuningOrchestrator.cancelJob(req.params.id);
    
    if (!success) {
      return res.status(400).json({ error: 'Could not cancel job' });
    }

    // Audit log
    await logAuditEvent(
      userId || 'unknown',
      'finetuning.cancel',
      'finetuning_job',
      req.params.id,
      { cancelledAt: new Date().toISOString() },
      req
    );

    res.json({ success: true, message: 'Job cancelled' });

  } catch (error) {
    console.error('[AdminRoutes] Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

/**
 * PATCH /api/admin/finetuning/config
 * Update finetuning configuration
 */
router.patch('/finetuning/config', requireAdmin, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user?.id || req.session?.userId;
    
    const { minExamplesThreshold, maxExamplesPerJob, minQualityScore, baseModel } = req.body;

    const previousConfig = finetuningOrchestrator.getConfig();
    
    const updates: Record<string, unknown> = {};
    if (typeof minExamplesThreshold === 'number') updates.minExamplesThreshold = minExamplesThreshold;
    if (typeof maxExamplesPerJob === 'number') updates.maxExamplesPerJob = maxExamplesPerJob;
    if (typeof minQualityScore === 'number') updates.minQualityScore = minQualityScore;
    if (typeof baseModel === 'string') updates.baseModel = baseModel;

    finetuningOrchestrator.updateConfig(updates);

    // Audit log
    await logAuditEvent(
      userId || 'unknown',
      'finetuning.config_update',
      'finetuning_config',
      null,
      {
        previousConfig,
        newConfig: finetuningOrchestrator.getConfig(),
        changes: updates,
      },
      req
    );

    res.json({ 
      success: true, 
      config: finetuningOrchestrator.getConfig(),
    });

  } catch (error) {
    console.error('[AdminRoutes] Error updating config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// ================================
// Statistics Endpoints
// ================================

/**
 * GET /api/admin/stats
 * Get training data and feedback statistics
 */
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Training data stats
    const [trainingStats] = await db.select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where is_approved is null)`,
      approved: sql<number>`count(*) filter (where is_approved = true)`,
      rejected: sql<number>`count(*) filter (where is_approved = false)`,
      used: sql<number>`count(*) filter (where is_used = true)`,
      avgQuality: sql<number>`avg(quality_score)`,
    }).from(finetuningDataset);

    // Feedback stats
    const [feedbackStats] = await db.select({
      total: sql<number>`count(*)`,
      positive: sql<number>`count(*) filter (where is_helpful = true)`,
      negative: sql<number>`count(*) filter (where is_helpful = false)`,
      withComments: sql<number>`count(*) filter (where comment is not null)`,
    }).from(messageFeedback);

    // Domain breakdown
    const domainBreakdown = await db.select({
      domain: finetuningDataset.domain,
      count: sql<number>`count(*)`,
    })
      .from(finetuningDataset)
      .groupBy(finetuningDataset.domain)
      .orderBy(desc(sql`count(*)`));

    // Jurisdiction breakdown
    const jurisdictionBreakdown = await db.select({
      jurisdiction: finetuningDataset.jurisdiction,
      count: sql<number>`count(*)`,
    })
      .from(finetuningDataset)
      .where(sql`jurisdiction is not null`)
      .groupBy(finetuningDataset.jurisdiction)
      .orderBy(desc(sql`count(*)`));

    // Finetuning status
    const finetuningStatus = await finetuningOrchestrator.getStatus();

    res.json({
      trainingData: {
        total: Number(trainingStats.total),
        pending: Number(trainingStats.pending),
        approved: Number(trainingStats.approved),
        rejected: Number(trainingStats.rejected),
        used: Number(trainingStats.used),
        averageQuality: Number(trainingStats.avgQuality || 0).toFixed(2),
      },
      feedback: {
        total: Number(feedbackStats.total),
        positive: Number(feedbackStats.positive),
        negative: Number(feedbackStats.negative),
        withComments: Number(feedbackStats.withComments),
        positiveRate: Number(feedbackStats.total) > 0 
          ? ((Number(feedbackStats.positive) / Number(feedbackStats.total)) * 100).toFixed(1)
          : 0,
      },
      domainBreakdown: domainBreakdown.map(d => ({
        domain: d.domain,
        count: Number(d.count),
      })),
      jurisdictionBreakdown: jurisdictionBreakdown.map(j => ({
        jurisdiction: j.jurisdiction,
        count: Number(j.count),
      })),
      finetuning: finetuningStatus,
    });

  } catch (error) {
    console.error('[AdminRoutes] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// ================================
// Expert Review Endpoints
// ================================

/**
 * GET /api/admin/expert-review/queue
 * Get the expert review queue
 */
router.get('/expert-review/queue', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { domain, priority, limit } = req.query;
    
    const queue = await getExpertReviewQueue({
      domain: domain as string | undefined,
      priority: priority as 'high' | 'medium' | 'low' | undefined,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.json({
      queue,
      thresholds: QualityThresholds,
      message: 'CPA/Expert review required for training data quality assurance',
    });

  } catch (error) {
    console.error('[AdminRoutes] Error getting expert review queue:', error);
    res.status(500).json({ error: 'Failed to get expert review queue' });
  }
});

/**
 * POST /api/admin/expert-review/:id/complete
 * Complete an expert review
 */
router.post('/expert-review/:id/complete', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, notes } = req.body;
    
    // @ts-ignore
    const userId = req.user?.id || req.session?.userId;
    
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved (boolean) is required' });
    }

    await completeExpertReview(id, String(userId), approved, notes);

    // Audit log
    await logAuditEvent(
      String(userId),
      approved ? 'expert_review.approve' : 'expert_review.reject',
      'training_data',
      id,
      { notes, approved },
      req
    );

    res.json({ 
      success: true, 
      message: `Example ${approved ? 'approved' : 'rejected'} by expert`,
    });

  } catch (error) {
    console.error('[AdminRoutes] Error completing expert review:', error);
    res.status(500).json({ error: 'Failed to complete expert review' });
  }
});

/**
 * GET /api/admin/quality-stats
 * Get detailed quality statistics
 */
router.get('/quality-stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await getQualityStatistics();

    res.json({
      ...stats,
      thresholds: {
        autoApprove: QualityThresholds.AUTO_APPROVE,
        expertReview: QualityThresholds.EXPERT_REVIEW,
        minimum: QualityThresholds.MINIMUM,
        anomaly: QualityThresholds.ANOMALY,
      },
      documentation: {
        autoApprove: 'Exceptional examples (>= 0.90) with multiple positive signals. Auto-approved.',
        expertReview: 'Good examples (0.70-0.89) requiring CPA validation before training use.',
        minimum: 'Marginal examples (0.50-0.69) need significant review.',
        anomaly: 'Below 0.30 triggers gaming detection. Auto-rejected.',
      },
    });

  } catch (error) {
    console.error('[AdminRoutes] Error getting quality stats:', error);
    res.status(500).json({ error: 'Failed to get quality statistics' });
  }
});

export default router;
