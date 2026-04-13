/**
 * Background Job Queue - PostgreSQL Only
 * No Redis required - uses simple async processing
 * Handles: title generation, analytics, file processing
 */

import { generateConversationTitle } from './conversationTitleGenerator';
import { storage } from '../pgStorage';
import { AnalyticsProcessor } from './analyticsProcessor';

// Simple in-memory job queue for background processing
interface Job {
  id: string;
  type: 'title' | 'analytics' | 'file';
  data: any;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

const pendingJobs: Job[] = [];
let isProcessing = false;

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function processJob(job: Job): Promise<boolean> {
  try {
    switch (job.type) {
      case 'title': {
        const { conversationId, query } = job.data;
        console.log(`[JobQueue] Processing title job for conversation ${conversationId}`);
        
        const { title, metadata } = await generateConversationTitle(query);
        await storage.updateConversation(conversationId, { title, metadata });
        console.log(`[JobQueue] ✓ Generated title: "${title}"`);
        return true;
      }
      
      case 'analytics': {
        const { messageId, conversationId, userId, role, content, previousMessages } = job.data;
        console.log(`[JobQueue] Processing analytics for message ${messageId}`);
        
        await AnalyticsProcessor.processMessage({
          messageId,
          conversationId,
          userId,
          role,
          content,
          previousMessages
        });
        return true;
      }
      
      case 'file': {
        const { fileId } = job.data;
        console.log(`[JobQueue] Processing file ${fileId}`);
        // File processing logic handled elsewhere
        return true;
      }
      
      default:
        console.warn(`[JobQueue] Unknown job type: ${job.type}`);
        return false;
    }
  } catch (error) {
    console.error(`[JobQueue] Job ${job.id} failed:`, error);
    return false;
  }
}

async function processQueue(): Promise<void> {
  if (isProcessing || pendingJobs.length === 0) return;
  
  isProcessing = true;
  
  while (pendingJobs.length > 0) {
    const job = pendingJobs.shift()!;
    
    const success = await processJob(job);
    
    if (!success && job.attempts < job.maxAttempts) {
      job.attempts++;
      // Re-add to queue with delay
      setTimeout(() => {
        pendingJobs.push(job);
        processQueue();
      }, 2000 * job.attempts); // Exponential backoff
    }
  }
  
  isProcessing = false;
}

// Public API - mimics Bull queue interface

export function addTitleGenerationJob(conversationId: string, query: string): string {
  const jobId = generateJobId();
  
  pendingJobs.push({
    id: jobId,
    type: 'title',
    data: { conversationId, query },
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date()
  });
  
  // Process async
  setImmediate(() => processQueue());
  
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
  const jobId = generateJobId();
  
  pendingJobs.push({
    id: jobId,
    type: 'analytics',
    data,
    attempts: 0,
    maxAttempts: 2,
    createdAt: new Date()
  });
  
  setImmediate(() => processQueue());
  
  return jobId;
}

export function addFileProcessingJob(fileId: string, filePath: string, userId: string): string {
  const jobId = generateJobId();
  
  pendingJobs.push({
    id: jobId,
    type: 'file',
    data: { fileId, filePath, userId },
    attempts: 0,
    maxAttempts: 2,
    createdAt: new Date()
  });
  
  setImmediate(() => processQueue());
  
  return jobId;
}

export async function getQueueStats() {
  const titleJobs = pendingJobs.filter(j => j.type === 'title');
  const analyticsJobs = pendingJobs.filter(j => j.type === 'analytics');
  const fileJobs = pendingJobs.filter(j => j.type === 'file');
  
  return {
    titleGeneration: { 
      waiting: titleJobs.length, 
      active: isProcessing ? 1 : 0, 
      completed: 0, 
      failed: 0 
    },
    analytics: { 
      waiting: analyticsJobs.length, 
      active: 0, 
      completed: 0, 
      failed: 0 
    },
    fileProcessing: { 
      waiting: fileJobs.length, 
      active: 0, 
      completed: 0, 
      failed: 0 
    },
    storage: {
      type: 'in-memory',
      status: 'ready',
      ready: true
    }
  };
}

// Legacy exports for compatibility
export const titleGenerationQueue = null;
export const analyticsQueue = null;
export const fileProcessingQueue = null;
export const redisClient = null;

console.log('[JobQueue] ✓ Using in-memory job queue (PostgreSQL for data, no Redis needed)');
