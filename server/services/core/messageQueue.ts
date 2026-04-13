/**
 * Message Queue Service
 * Handles inter-agent communication and message passing
 */

import { EventEmitter } from 'events';

export interface AgentMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  conversationId: string;
  type: 'data' | 'command' | 'status' | 'error';
  payload: Record<string, any>;
  timestamp: Date;
  priority: number; // 1-10, higher is more urgent
  ttl?: number; // Time to live in milliseconds
}

export interface QueueStatistics {
  totalMessages: number;
  pendingMessages: number;
  processedMessages: number;
  failedMessages: number;
  averageProcessingTime: number;
}

/**
 * Message Queue
 * Priority queue for inter-agent messages with persistence
 */
export class MessageQueue extends EventEmitter {
  private queues: Map<string, AgentMessage[]> = new Map(); // Per-agent queues
  private inProgress: Map<string, AgentMessage> = new Map(); // Messages being processed
  private processed: Map<string, AgentMessage> = new Map();
  private failed: Map<string, { message: AgentMessage; error: string }> = new Map();
  private stats: QueueStatistics = {
    totalMessages: 0,
    pendingMessages: 0,
    processedMessages: 0,
    failedMessages: 0,
    averageProcessingTime: 0,
  };

  constructor() {
    super();
    this.startCleanupInterval();
  }

  /**
   * Send a message to an agent
   */
  send(message: Omit<AgentMessage, 'id' | 'timestamp'>): string {
    const fullMessage: AgentMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    // Initialize queue for recipient if doesn't exist
    if (!this.queues.has(message.toAgent)) {
      this.queues.set(message.toAgent, []);
    }

    // Add to queue
    const queue = this.queues.get(message.toAgent)!;
    queue.push(fullMessage);

    // Sort by priority (higher first)
    queue.sort((a, b) => b.priority - a.priority);

    this.stats.totalMessages++;
    this.stats.pendingMessages++;

    // Emit event for real-time processing
    this.emit('message:received', fullMessage);

    console.log(`[MessageQueue] Message ${fullMessage.id} sent to ${message.toAgent}`);
    return fullMessage.id;
  }

  /**
   * Clear all messages and reset stats (for testing)
   */
  clear(): void {
    this.queues.clear();
    this.inProgress.clear();
    this.processed.clear();
    this.failed.clear();
    this.stats = {
      totalMessages: 0,
      pendingMessages: 0,
      processedMessages: 0,
      failedMessages: 0,
      averageProcessingTime: 0,
    };
  }

  /**
   * Get next message for an agent (highest priority)
   */
  receive(agentId: string): AgentMessage | null {
    const queue = this.queues.get(agentId);
    if (!queue || queue.length === 0) return null;

    const message = queue.shift()!;
    
    // Check TTL
    if (message.ttl) {
      const age = Date.now() - message.timestamp.getTime();
      if (age > message.ttl) {
        console.warn(`[MessageQueue] Message ${message.id} expired (TTL: ${message.ttl}ms, Age: ${age}ms)`);
        this.markFailed(message.id, 'Message expired (TTL exceeded)');
        return this.receive(agentId); // Try next message
      }
    }

    // Track as in-progress
    this.inProgress.set(message.id, message);
    this.stats.pendingMessages--;
    return message;
  }

  /**
   * Get all pending messages for an agent
   */
  receiveAll(agentId: string): AgentMessage[] {
    const queue = this.queues.get(agentId);
    if (!queue) return [];

    const messages = [...queue];
    this.queues.set(agentId, []);
    this.stats.pendingMessages -= messages.length;

    return messages.filter(msg => {
      if (msg.ttl) {
        const age = Date.now() - msg.timestamp.getTime();
        if (age > msg.ttl) {
          this.markFailed(msg.id, 'Message expired (TTL exceeded)');
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Mark message as processed
   */
  markProcessed(messageId: string, processingTime: number): void {
    const message = this.findMessage(messageId);
    if (!message) {
      console.warn(`[MessageQueue] Cannot mark unknown message as processed: ${messageId}`);
      return;
    }

    // Remove from in-progress
    this.inProgress.delete(messageId);
    
    this.processed.set(messageId, message);
    this.stats.processedMessages++;

    // Update average processing time
    const count = this.stats.processedMessages;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (count - 1) + processingTime) / count;

    this.emit('message:processed', message);
    console.log(`[MessageQueue] Message ${messageId} processed in ${processingTime}ms`);
  }

  /**
   * Mark message as failed
   */
  markFailed(messageId: string, error: string): void {
    const message = this.findMessage(messageId);
    if (!message) {
      console.warn(`[MessageQueue] Cannot mark unknown message as failed: ${messageId}`);
      return;
    }

    // Remove from in-progress
    this.inProgress.delete(messageId);
    
    this.failed.set(messageId, { message, error });
    this.stats.failedMessages++;
    this.emit('message:failed', { message, error });
    console.error(`[MessageQueue] Message ${messageId} failed: ${error}`);
  }

  /**
   * Find message by ID across all queues
   */
  private findMessage(messageId: string): AgentMessage | null {
    // Check in-progress
    if (this.inProgress.has(messageId)) {
      return this.inProgress.get(messageId)!;
    }
    
    // Check processed
    if (this.processed.has(messageId)) {
      return this.processed.get(messageId)!;
    }

    // Check failed
    if (this.failed.has(messageId)) {
      return this.failed.get(messageId)!.message;
    }

    // Check pending queues
    for (const queue of Array.from(this.queues.values())) {
      const message = queue.find((msg: AgentMessage) => msg.id === messageId);
      if (message) return message;
    }

    return null;
  }

  /**
   * Get queue size for an agent
   */
  getQueueSize(agentId: string): number {
    const queue = this.queues.get(agentId);
    return queue ? queue.length : 0;
  }

  /**
   * Get statistics
   */
  getStatistics(): QueueStatistics {
    return { ...this.stats };
  }

  /**
   * Get messages by conversation
   */
  getMessagesByConversation(conversationId: string): {
    pending: AgentMessage[];
    processed: AgentMessage[];
    failed: Array<{ message: AgentMessage; error: string }>;
  } {
    const pending: AgentMessage[] = [];
    const processed: AgentMessage[] = [];
    const failed: Array<{ message: AgentMessage; error: string }> = [];

    // Pending
    for (const queue of Array.from(this.queues.values())) {
      pending.push(...queue.filter((msg: AgentMessage) => msg.conversationId === conversationId));
    }

    // Processed
    for (const msg of Array.from(this.processed.values())) {
      if (msg.conversationId === conversationId) {
        processed.push(msg);
      }
    }

    // Failed
    for (const entry of Array.from(this.failed.values())) {
      if (entry.message.conversationId === conversationId) {
        failed.push(entry);
      }
    }

    return { pending, processed, failed };
  }

  /**
   * Clear old messages periodically
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const oneHourAgo = Date.now() - 3600000;

      // Clean processed messages older than 1 hour
      for (const [id, message] of Array.from(this.processed.entries())) {
        if (message.timestamp.getTime() < oneHourAgo) {
          this.processed.delete(id);
        }
      }

      // Clean failed messages older than 1 hour
      for (const [id, entry] of Array.from(this.failed.entries())) {
        if (entry.message.timestamp.getTime() < oneHourAgo) {
          this.failed.delete(id);
        }
      }
    }, 600000); // Every 10 minutes
  }

  /**
   * Clear all messages for a conversation
   */
  clearConversation(conversationId: string): void {
    // Clear pending
    for (const [agentId, queue] of Array.from(this.queues.entries())) {
      const filtered = queue.filter((msg: AgentMessage) => msg.conversationId !== conversationId);
      const removed = queue.length - filtered.length;
      this.queues.set(agentId, filtered);
      this.stats.pendingMessages -= removed;
    }

    // Clear processed
    for (const [id, msg] of Array.from(this.processed.entries())) {
      if (msg.conversationId === conversationId) {
        this.processed.delete(id);
      }
    }

    // Clear failed
    for (const [id, entry] of Array.from(this.failed.entries())) {
      if (entry.message.conversationId === conversationId) {
        this.failed.delete(id);
      }
    }

    console.log(`[MessageQueue] Cleared all messages for conversation ${conversationId}`);
  }
}

// Singleton instance
export const messageQueue = new MessageQueue();
