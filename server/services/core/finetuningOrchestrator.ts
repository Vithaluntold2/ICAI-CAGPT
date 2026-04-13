/**
 * Finetuning Orchestrator Service
 * Automates the finetuning pipeline when training data thresholds are reached
 * 
 * Features:
 * - Monitors approved training examples count
 * - Triggers OpenAI finetuning jobs when thresholds are met
 * - Manages job lifecycle and model deployment
 * - Tracks finetuning history and model versions
 */

import { EventEmitter } from 'events';
import { db } from '../../db';
import { finetuningDataset } from '../../../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { continuousLearning } from './continuousLearning';

// ================================
// Types
// ================================

export interface FinetuningConfig {
  minExamplesThreshold: number;      // Minimum approved examples to trigger
  maxExamplesPerJob: number;         // Maximum examples per finetuning job
  minQualityScore: number;           // Minimum quality score for inclusion
  baseModel: string;                 // Base model to finetune
  suffixPrefix: string;              // Prefix for model suffix
  hyperparameters: {
    nEpochs?: number | 'auto';
    batchSize?: number | 'auto';
    learningRateMultiplier?: number | 'auto';
  };
}

export interface FinetuningJob {
  id: string;
  openaiJobId?: string;
  status: 'pending' | 'validating' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  baseModel: string;
  finetuningModel?: string;
  examplesCount: number;
  exampleIds: string[];
  trainingFileId?: string;
  validationFileId?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  metadata: Record<string, unknown>;
}

export interface FinetuningStatus {
  isEnabled: boolean;
  currentExamples: number;
  threshold: number;
  readyForFinetuning: boolean;
  activeJobs: FinetuningJob[];
  lastJobAt?: Date;
  latestModel?: string;
}

// ================================
// Configuration
// ================================

const DEFAULT_CONFIG: FinetuningConfig = {
  minExamplesThreshold: 100,
  maxExamplesPerJob: 1000,
  minQualityScore: 0.7,
  baseModel: 'gpt-4o-mini-2024-07-18',
  suffixPrefix: 'luca-accounting',
  hyperparameters: {
    nEpochs: 'auto',
    batchSize: 'auto',
    learningRateMultiplier: 'auto',
  },
};

// In-memory job tracking (in production, store in database)
const activeJobs: Map<string, FinetuningJob> = new Map();

// ================================
// Finetuning Orchestrator
// ================================

class FinetuningOrchestrator extends EventEmitter {
  private config: FinetuningConfig;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private isEnabled: boolean = false;

  constructor(config: Partial<FinetuningConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[FinetuningOrchestrator] Initialized');
  }

  // ================================
  // Lifecycle Management
  // ================================

  /**
   * Start the finetuning monitor
   */
  start(): void {
    if (this.checkIntervalId) {
      console.log('[FinetuningOrchestrator] Already running');
      return;
    }

    this.isEnabled = true;
    console.log('[FinetuningOrchestrator] Starting monitor...');

    // Check every hour if we have enough data
    this.checkIntervalId = setInterval(() => {
      this.checkAndTrigger();
    }, 60 * 60 * 1000);

    // Initial check
    this.checkAndTrigger();

    this.emit('monitor:started');
  }

  /**
   * Stop the finetuning monitor
   */
  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    this.isEnabled = false;
    console.log('[FinetuningOrchestrator] Stopped monitor');
    this.emit('monitor:stopped');
  }

  /**
   * Check if ready and trigger finetuning
   */
  async checkAndTrigger(): Promise<void> {
    try {
      const status = await this.getStatus();
      
      if (status.readyForFinetuning && status.activeJobs.length === 0) {
        console.log(`[FinetuningOrchestrator] Threshold reached (${status.currentExamples}/${status.threshold}), triggering finetuning...`);
        await this.triggerFinetuning();
      } else if (status.activeJobs.length > 0) {
        console.log(`[FinetuningOrchestrator] Active job in progress, skipping check`);
        // Check status of active jobs
        for (const job of status.activeJobs) {
          await this.checkJobStatus(job);
        }
      }
    } catch (error) {
      console.error('[FinetuningOrchestrator] Check failed:', error);
    }
  }

  // ================================
  // Finetuning Operations
  // ================================

  /**
   * Trigger a new finetuning job
   */
  async triggerFinetuning(): Promise<FinetuningJob | null> {
    try {
      // Get approved training examples
      const examples = await this.getTrainingExamples();
      
      if (examples.length < this.config.minExamplesThreshold) {
        console.log(`[FinetuningOrchestrator] Not enough examples: ${examples.length}/${this.config.minExamplesThreshold}`);
        return null;
      }

      // Create JSONL training file content
      const trainingData = await this.prepareTrainingData(examples);
      
      // Create job record
      const job: FinetuningJob = {
        id: `ftjob-${Date.now()}`,
        status: 'pending',
        baseModel: this.config.baseModel,
        examplesCount: examples.length,
        exampleIds: examples.map(e => e.id),
        createdAt: new Date(),
        metadata: {
          config: this.config,
          triggeredBy: 'automatic',
        },
      };

      activeJobs.set(job.id, job);
      this.emit('job:created', job);

      // Upload training file to OpenAI
      const trainingFileId = await this.uploadTrainingFile(trainingData, job.id);
      
      if (!trainingFileId) {
        job.status = 'failed';
        job.error = 'Failed to upload training file';
        this.emit('job:failed', job);
        return job;
      }

      job.trainingFileId = trainingFileId;
      job.status = 'validating';

      // Create finetuning job via OpenAI API
      const openaiJobId = await this.createOpenAIFinetuningJob(job);
      
      if (!openaiJobId) {
        job.status = 'failed';
        job.error = 'Failed to create OpenAI finetuning job';
        this.emit('job:failed', job);
        return job;
      }

      job.openaiJobId = openaiJobId;
      job.status = 'queued';
      job.startedAt = new Date();

      // Mark examples as used
      await this.markExamplesAsUsed(examples.map(e => e.id), job.id);

      console.log(`[FinetuningOrchestrator] Job created: ${job.id} (OpenAI: ${openaiJobId})`);
      this.emit('job:started', job);

      return job;

    } catch (error) {
      console.error('[FinetuningOrchestrator] Trigger failed:', error);
      return null;
    }
  }

  /**
   * Get approved training examples
   */
  private async getTrainingExamples(): Promise<Array<{
    id: string;
    systemPrompt: string;
    userMessage: string;
    assistantResponse: string;
    domain: string;
    qualityScore: number;
  }>> {
    const results = await db.select({
      id: finetuningDataset.id,
      systemPrompt: finetuningDataset.systemPrompt,
      userMessage: finetuningDataset.userMessage,
      assistantResponse: finetuningDataset.assistantResponse,
      domain: finetuningDataset.domain,
      qualityScore: finetuningDataset.qualityScore,
    })
      .from(finetuningDataset)
      .where(and(
        eq(finetuningDataset.isApproved, true),
        eq(finetuningDataset.isUsed, false),
        sql`quality_score >= ${this.config.minQualityScore}`
      ))
      .orderBy(desc(finetuningDataset.qualityScore))
      .limit(this.config.maxExamplesPerJob);

    return results.map(r => ({
      ...r,
      qualityScore: Number(r.qualityScore) || 0,
    }));
  }

  /**
   * Prepare training data in OpenAI JSONL format
   */
  private async prepareTrainingData(examples: Array<{
    systemPrompt: string;
    userMessage: string;
    assistantResponse: string;
  }>): Promise<string> {
    return examples.map(ex => JSON.stringify({
      messages: [
        { role: 'system', content: ex.systemPrompt },
        { role: 'user', content: ex.userMessage },
        { role: 'assistant', content: ex.assistantResponse },
      ],
    })).join('\n');
  }

  /**
   * Upload training file to OpenAI
   */
  private async uploadTrainingFile(content: string, jobId: string): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[FinetuningOrchestrator] No OpenAI API key');
      return null;
    }

    try {
      // Create a Blob from the content
      const blob = new Blob([content], { type: 'application/jsonl' });
      const formData = new FormData();
      formData.append('file', blob, `${jobId}.jsonl`);
      formData.append('purpose', 'fine-tune');

      const response = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[FinetuningOrchestrator] File upload failed:', error);
        return null;
      }

      const data = await response.json();
      console.log(`[FinetuningOrchestrator] Training file uploaded: ${data.id}`);
      return data.id;

    } catch (error) {
      console.error('[FinetuningOrchestrator] File upload error:', error);
      return null;
    }
  }

  /**
   * Create OpenAI finetuning job
   */
  private async createOpenAIFinetuningJob(job: FinetuningJob): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !job.trainingFileId) {
      return null;
    }

    try {
      const suffix = `${this.config.suffixPrefix}-${Date.now()}`;
      
      const response = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          training_file: job.trainingFileId,
          model: this.config.baseModel,
          suffix,
          hyperparameters: this.config.hyperparameters,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[FinetuningOrchestrator] Job creation failed:', error);
        return null;
      }

      const data = await response.json();
      console.log(`[FinetuningOrchestrator] OpenAI job created: ${data.id}`);
      return data.id;

    } catch (error) {
      console.error('[FinetuningOrchestrator] Job creation error:', error);
      return null;
    }
  }

  /**
   * Check status of an active job
   */
  private async checkJobStatus(job: FinetuningJob): Promise<void> {
    if (!job.openaiJobId) return;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return;

    try {
      const response = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${job.openaiJobId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      const previousStatus = job.status;

      // Map OpenAI status to our status
      switch (data.status) {
        case 'validating_files':
          job.status = 'validating';
          break;
        case 'queued':
          job.status = 'queued';
          break;
        case 'running':
          job.status = 'running';
          break;
        case 'succeeded':
          job.status = 'succeeded';
          job.finetuningModel = data.fine_tuned_model;
          job.completedAt = new Date();
          break;
        case 'failed':
          job.status = 'failed';
          job.error = data.error?.message || 'Unknown error';
          job.completedAt = new Date();
          break;
        case 'cancelled':
          job.status = 'cancelled';
          job.completedAt = new Date();
          break;
      }

      if (job.status !== previousStatus) {
        console.log(`[FinetuningOrchestrator] Job ${job.id} status: ${previousStatus} -> ${job.status}`);
        this.emit('job:status-changed', { job, previousStatus });

        if (job.status === 'succeeded') {
          this.emit('job:succeeded', job);
          console.log(`[FinetuningOrchestrator] 🎉 New model available: ${job.finetuningModel}`);
        } else if (job.status === 'failed') {
          this.emit('job:failed', job);
        }
      }

    } catch (error) {
      console.error('[FinetuningOrchestrator] Status check error:', error);
    }
  }

  /**
   * Mark examples as used in a finetuning job
   */
  private async markExamplesAsUsed(exampleIds: string[], jobId: string): Promise<void> {
    for (const id of exampleIds) {
      await db.update(finetuningDataset)
        .set({ 
          isUsed: true,
          usedInJobId: jobId,
        })
        .where(eq(finetuningDataset.id, id));
    }
    console.log(`[FinetuningOrchestrator] Marked ${exampleIds.length} examples as used`);
  }

  // ================================
  // Status & Management
  // ================================

  /**
   * Get current finetuning status
   */
  async getStatus(): Promise<FinetuningStatus> {
    const readiness = await continuousLearning.isReadyForFinetuning();
    
    // Get active jobs
    const active = Array.from(activeJobs.values())
      .filter(j => !['succeeded', 'failed', 'cancelled'].includes(j.status));

    // Get latest succeeded model
    const succeeded = Array.from(activeJobs.values())
      .filter(j => j.status === 'succeeded')
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));

    return {
      isEnabled: this.isEnabled,
      currentExamples: readiness.current,
      threshold: this.config.minExamplesThreshold,
      readyForFinetuning: readiness.ready,
      activeJobs: active,
      lastJobAt: succeeded[0]?.completedAt,
      latestModel: succeeded[0]?.finetuningModel,
    };
  }

  /**
   * Get all jobs
   */
  getJobs(): FinetuningJob[] {
    return Array.from(activeJobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): FinetuningJob | undefined {
    return activeJobs.get(jobId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = activeJobs.get(jobId);
    if (!job || !job.openaiJobId) return false;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return false;

    try {
      const response = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${job.openaiJobId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        job.status = 'cancelled';
        job.completedAt = new Date();
        this.emit('job:cancelled', job);
        return true;
      }
      return false;

    } catch (error) {
      console.error('[FinetuningOrchestrator] Cancel error:', error);
      return false;
    }
  }

  /**
   * Manually trigger finetuning (bypasses threshold check)
   */
  async manualTrigger(): Promise<FinetuningJob | null> {
    console.log('[FinetuningOrchestrator] Manual trigger initiated');
    return this.triggerFinetuning();
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<FinetuningConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('[FinetuningOrchestrator] Config updated');
    this.emit('config:updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): FinetuningConfig {
    return { ...this.config };
  }
}

// ================================
// Singleton Export
// ================================

export const finetuningOrchestrator = new FinetuningOrchestrator();
export default finetuningOrchestrator;
