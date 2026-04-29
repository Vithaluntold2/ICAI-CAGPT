/**
 * Hybrid Job Queue - Redis (fast) + In-Memory (fallback)
 * 
 * Strategy:
 * - Redis + Bull: Production-grade job queue (when REDIS_URL is set)
 * - In-Memory: Fallback for development or when Redis unavailable
 * 
 * Handles: title generation, analytics, file processing
 */

import Bull, { Queue, Job } from 'bull';
import { getRedisClient } from './hybridCache';
import { generateConversationTitle } from './conversationTitleGenerator';
import { storage } from '../pgStorage';
import { AnalyticsProcessor } from './analyticsProcessor';

// Check if Redis is available
const redisUrl = process.env.REDIS_URL;
const useRedis = !!redisUrl;

// =============================================================================
// REDIS-BASED QUEUES (Production - when Redis available)
// =============================================================================

let titleGenerationQueue: Queue | null = null;
let analyticsQueue: Queue | null = null;
let fileProcessingQueue: Queue | null = null;
let synthesizerQueue: Queue | null = null;

if (useRedis && redisUrl) {
  console.log('[JobQueue] ✓ Using Redis + Bull for job queues');

  titleGenerationQueue = new Bull('conversation-titles', redisUrl, {
    prefix: 'luca',
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  });

  analyticsQueue = new Bull('analytics', redisUrl, {
    prefix: 'luca',
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 200
    }
  });

  fileProcessingQueue = new Bull('file-processing', redisUrl, {
    prefix: 'luca',
    defaultJobOptions: {
      attempts: 2,
      timeout: 60000,
      removeOnComplete: 50,
      removeOnFail: 200
    }
  });

  synthesizerQueue = new Bull('roundtable-synthesizer', redisUrl, {
    prefix: 'luca',
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
      timeout: 30000,
    }
  });

  // Process synthesizer jobs. Lazy-import the processor to avoid pulling
  // the synthesizer + provider stack into queue startup paths.
  synthesizerQueue.process(async (job: Job) => {
    const { processSynthesizerJob } = await import('./roundtable/synthesizerJob');
    return processSynthesizerJob(job);
  });

  synthesizerQueue.on('failed', (job, err) => {
    console.error(`[SynthesizerQueue] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  // Process title generation jobs
  titleGenerationQueue.process(async (job: Job) => {
    const { conversationId, query } = job.data;
    console.log(`[TitleQueue] Processing job ${job.id} for conversation ${conversationId}`);
    
    try {
      const { title, metadata } = await generateConversationTitle(query);
      await storage.updateConversation(conversationId, { title, metadata });
      console.log(`[TitleQueue] ✓ Generated title: "${title}"`);
      return { success: true, title, metadata };
    } catch (error) {
      console.error(`[TitleQueue] ✗ Failed:`, error);
      throw error;
    }
  });

  // Process analytics jobs
  analyticsQueue.process(async (job: Job) => {
    const { messageId, conversationId, userId, role, content, previousMessages } = job.data;
    console.log(`[AnalyticsQueue] Processing message ${messageId}`);
    
    try {
      await AnalyticsProcessor.processMessage({
        messageId, conversationId, userId, role, content, previousMessages
      });
      return { success: true };
    } catch (error) {
      console.error(`[AnalyticsQueue] Failed:`, error);
      return { success: false };
    }
  });

  // Process file jobs
  fileProcessingQueue.process(async (job: Job) => {
    const { fileId } = job.data;
    console.log(`[FileQueue] Processing file ${fileId}`);
    return { success: true, fileId };
  });

  // Event handlers
  titleGenerationQueue.on('completed', (job, result) => {
    console.log(`[TitleQueue] Job ${job.id} completed`);
  });

  titleGenerationQueue.on('failed', (job, err) => {
    console.error(`[TitleQueue] Job ${job?.id} failed:`, err.message);
  });
}

// =============================================================================
// IN-MEMORY FALLBACK (Development - when Redis not available)
// =============================================================================

interface MemoryJob {
  id: string;
  type: 'title' | 'analytics' | 'file' | 'synthesizer';
  data: any;
  attempts: number;
  maxAttempts: number;
}

const pendingJobs: MemoryJob[] = [];
let isProcessing = false;

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function processMemoryJob(job: MemoryJob): Promise<boolean> {
  try {
    switch (job.type) {
      case 'title': {
        const { conversationId, query } = job.data;
        const { title, metadata } = await generateConversationTitle(query);
        await storage.updateConversation(conversationId, { title, metadata });
        console.log(`[MemoryQueue] ✓ Generated title: "${title}"`);
        return true;
      }
      case 'analytics': {
        await AnalyticsProcessor.processMessage(job.data);
        return true;
      }
      case 'file': {
        console.log(`[MemoryQueue] Processing file ${job.data.fileId}`);
        return true;
      }
      case 'synthesizer': {
        const { processSynthesizerJob } = await import('./roundtable/synthesizerJob');
        // Throws on failure — caught by the surrounding try/catch which returns
        // false, triggering the memory-queue retry mechanism below.
        await processSynthesizerJob({ data: job.data, attemptsMade: job.attempts } as any);
        return true;
      }
      default:
        return false;
    }
  } catch (error) {
    console.error(`[MemoryQueue] Job ${job.id} failed:`, error);
    return false;
  }
}

async function processMemoryQueue(): Promise<void> {
  if (isProcessing || pendingJobs.length === 0) return;
  
  isProcessing = true;
  
  while (pendingJobs.length > 0) {
    const job = pendingJobs.shift()!;
    const success = await processMemoryJob(job);
    
    if (!success && job.attempts < job.maxAttempts) {
      job.attempts++;
      setTimeout(() => {
        pendingJobs.push(job);
        processMemoryQueue();
      }, 2000 * job.attempts);
    }
  }
  
  isProcessing = false;
}

// =============================================================================
// PUBLIC API - Same interface regardless of Redis/Memory backend
// =============================================================================

export function addTitleGenerationJob(conversationId: string, query: string): string {
  if (useRedis && titleGenerationQueue) {
    titleGenerationQueue.add({ conversationId, query })
      .catch(err => console.error('[JobQueue] Failed to queue title:', err));
    return `redis_${Date.now()}`;
  }
  
  // Fallback to memory queue
  const jobId = generateJobId();
  pendingJobs.push({
    id: jobId,
    type: 'title',
    data: { conversationId, query },
    attempts: 0,
    maxAttempts: 3
  });
  setImmediate(() => processMemoryQueue());
  return jobId;
}

export function addAnalyticsJob(data: {
  messageId: string;
  conversationId: string;
  userId: string;
  role: string;
  content: string;
  previousMessages?: any[];
}): string {
  if (useRedis && analyticsQueue) {
    analyticsQueue.add(data)
      .catch(err => console.error('[JobQueue] Failed to queue analytics:', err));
    return `redis_${Date.now()}`;
  }
  
  const jobId = generateJobId();
  pendingJobs.push({
    id: jobId,
    type: 'analytics',
    data,
    attempts: 0,
    maxAttempts: 2
  });
  setImmediate(() => processMemoryQueue());
  return jobId;
}

export function addFileProcessingJob(fileId: string, filePath: string, userId: string): string {
  if (useRedis && fileProcessingQueue) {
    fileProcessingQueue.add({ fileId, filePath, userId })
      .catch(err => console.error('[JobQueue] Failed to queue file:', err));
    return `redis_${Date.now()}`;
  }
  
  const jobId = generateJobId();
  pendingJobs.push({
    id: jobId,
    type: 'file',
    data: { fileId, filePath, userId },
    attempts: 0,
    maxAttempts: 2
  });
  setImmediate(() => processMemoryQueue());
  return jobId;
}

export function addSynthesizerJob(data: {
  threadId: string;
  agentId: string;
  agentName: string;
  panelId: string;
}): string {
  if (useRedis && synthesizerQueue) {
    synthesizerQueue.add(data)
      .catch(err => console.error('[JobQueue] Failed to queue synthesizer:', err));
    return `redis_${Date.now()}`;
  }

  const jobId = generateJobId();
  pendingJobs.push({
    id: jobId,
    type: 'synthesizer',
    data,
    attempts: 0,
    maxAttempts: 3
  });
  setImmediate(() => processMemoryQueue());
  return jobId;
}

export async function getQueueStats() {
  if (useRedis && titleGenerationQueue && analyticsQueue && fileProcessingQueue) {
    const [titleStats, analyticsStats, fileStats, synthStats] = await Promise.all([
      titleGenerationQueue.getJobCounts(),
      analyticsQueue.getJobCounts(),
      fileProcessingQueue.getJobCounts(),
      synthesizerQueue ? synthesizerQueue.getJobCounts() : Promise.resolve({}),
    ]);

    return {
      titleGeneration: titleStats,
      analytics: analyticsStats,
      fileProcessing: fileStats,
      synthesizer: synthStats,
      backend: 'redis',
      status: 'ready'
    };
  }

  // Memory queue stats
  return {
    titleGeneration: { waiting: pendingJobs.filter(j => j.type === 'title').length, active: isProcessing ? 1 : 0 },
    analytics: { waiting: pendingJobs.filter(j => j.type === 'analytics').length, active: 0 },
    fileProcessing: { waiting: pendingJobs.filter(j => j.type === 'file').length, active: 0 },
    synthesizer: { waiting: pendingJobs.filter(j => j.type === 'synthesizer').length, active: 0 },
    backend: 'memory',
    status: 'ready'
  };
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('[JobQueue] Shutting down...');
  
  if (useRedis && titleGenerationQueue && analyticsQueue && fileProcessingQueue) {
    await Promise.all([
      titleGenerationQueue.close(),
      analyticsQueue.close(),
      fileProcessingQueue.close(),
      synthesizerQueue ? synthesizerQueue.close() : Promise.resolve(),
    ]);
  }
  
  console.log('[JobQueue] Closed');
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Log which backend is being used
if (!useRedis) {
  console.log('[JobQueue] ✓ Using in-memory job queue (set REDIS_URL for Redis)');
}
