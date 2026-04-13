/**
 * Context Management Service
 * Manages conversation context, history, and state across all professional modes
 */

import { EventEmitter } from 'events';
import type { ProfessionalMode } from '../../../shared/types/agentTypes';

export interface ConversationContext {
  id: string;
  userId: string;
  mode: ProfessionalMode;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Context state
  state: {
    currentStep?: string;
    variables: Record<string, any>;
    agentOutputs: Record<string, any>; // Keyed by agent ID
    userPreferences: Record<string, any>;
  };
  
  // Context metadata
  metadata: {
    messageCount: number;
    lastActivity: Date;
    userTier: string;
    tags: string[];
  };
}

export interface ContextSnapshot {
  conversationId: string;
  timestamp: Date;
  state: Record<string, any>;
  checksum: string;
}

/**
 * Context Manager
 * Central service for managing conversation context and state
 */
export class ContextManager extends EventEmitter {
  private contexts: Map<string, ConversationContext> = new Map();
  private snapshots: Map<string, ContextSnapshot[]> = new Map();
  private maxSnapshotsPerConversation = 50;

  /**
   * Create a new conversation context
   */
  async createContext(
    userId: string,
    mode: ProfessionalMode,
    options?: {
      title?: string;
      initialVariables?: Record<string, any>;
      userPreferences?: Record<string, any>;
      userTier?: string;
    }
  ): Promise<ConversationContext> {
    const context: ConversationContext = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      mode,
      title: options?.title,
      createdAt: new Date(),
      updatedAt: new Date(),
      state: {
        variables: options?.initialVariables || {},
        agentOutputs: {},
        userPreferences: options?.userPreferences || {},
      },
      metadata: {
        messageCount: 0,
        lastActivity: new Date(),
        userTier: options?.userTier || 'free',
        tags: [],
      },
    };

    this.contexts.set(context.id, context);
    this.emit('context:created', context);

    console.log(`[ContextManager] Created context ${context.id} for user ${userId} in mode ${mode}`);
    return context;
  }

  /**
   * Get context by ID
   */
  async getContext(contextId: string): Promise<ConversationContext | null> {
    return this.contexts.get(contextId) || null;
  }

  /**
   * Get all contexts for a user
   */
  async getUserContexts(
    userId: string,
    filters?: {
      mode?: ProfessionalMode;
      tags?: string[];
      limit?: number;
    }
  ): Promise<ConversationContext[]> {
    let contexts = Array.from(this.contexts.values())
      .filter(ctx => ctx.userId === userId);

    // Apply filters
    if (filters?.mode) {
      contexts = contexts.filter(ctx => ctx.mode === filters.mode);
    }
    if (filters?.tags && filters.tags.length > 0) {
      contexts = contexts.filter(ctx => 
        filters.tags!.some(tag => ctx.metadata.tags.includes(tag))
      );
    }

    // Sort by last activity (most recent first)
    contexts.sort((a, b) => 
      b.metadata.lastActivity.getTime() - a.metadata.lastActivity.getTime()
    );

    // Apply limit
    if (filters?.limit) {
      contexts = contexts.slice(0, filters.limit);
    }

    return contexts;
  }

  /**
   * Update context state
   */
  async updateContext(
    contextId: string,
    updates: {
      currentStep?: string;
      variables?: Record<string, any>;
      agentOutputs?: Record<string, any>;
      userPreferences?: Record<string, any>;
      title?: string;
      tags?: string[];
    }
  ): Promise<ConversationContext | null> {
    const context = this.contexts.get(contextId);
    if (!context) {
      console.warn(`[ContextManager] Context not found: ${contextId}`);
      return null;
    }

    // Create snapshot before update
    await this.createSnapshot(contextId);

    // Apply updates
    if (updates.currentStep !== undefined) {
      context.state.currentStep = updates.currentStep;
    }
    if (updates.variables) {
      context.state.variables = { ...context.state.variables, ...updates.variables };
    }
    if (updates.agentOutputs) {
      context.state.agentOutputs = { ...context.state.agentOutputs, ...updates.agentOutputs };
    }
    if (updates.userPreferences) {
      context.state.userPreferences = { ...context.state.userPreferences, ...updates.userPreferences };
    }
    if (updates.title !== undefined) {
      context.title = updates.title;
    }
    if (updates.tags) {
      context.metadata.tags = Array.from(new Set([...context.metadata.tags, ...updates.tags]));
    }

    context.updatedAt = new Date();
    context.metadata.lastActivity = new Date();

    this.emit('context:updated', context);
    console.log(`[ContextManager] Updated context ${contextId}`);

    return context;
  }

  /**
   * Increment message count
   */
  async incrementMessageCount(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (context) {
      context.metadata.messageCount++;
      context.metadata.lastActivity = new Date();
    }
  }

  /**
   * Store agent output in context
   */
  async storeAgentOutput(
    contextId: string,
    agentId: string,
    output: any
  ): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) return;

    context.state.agentOutputs[agentId] = {
      output,
      timestamp: new Date(),
    };

    context.updatedAt = new Date();
    this.emit('context:agent-output', { contextId, agentId, output });
  }

  /**
   * Get agent output from context
   */
  async getAgentOutput(contextId: string, agentId: string): Promise<any | null> {
    const context = this.contexts.get(contextId);
    if (!context) return null;

    const stored = context.state.agentOutputs[agentId];
    return stored ? stored.output : null;
  }

  /**
   * Create a snapshot of context state
   */
  private async createSnapshot(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) return;

    const snapshot: ContextSnapshot = {
      conversationId: contextId,
      timestamp: new Date(),
      state: JSON.parse(JSON.stringify(context.state)),
      checksum: this.generateChecksum(context.state),
    };

    if (!this.snapshots.has(contextId)) {
      this.snapshots.set(contextId, []);
    }

    const snapshotList = this.snapshots.get(contextId)!;
    snapshotList.push(snapshot);

    // Keep only last N snapshots
    if (snapshotList.length > this.maxSnapshotsPerConversation) {
      snapshotList.shift();
    }
  }

  /**
   * Restore context to a previous snapshot
   */
  async restoreSnapshot(
    contextId: string,
    snapshotIndex: number
  ): Promise<boolean> {
    const snapshotList = this.snapshots.get(contextId);
    if (!snapshotList || snapshotIndex >= snapshotList.length) {
      return false;
    }

    const snapshot = snapshotList[snapshotIndex];
    const context = this.contexts.get(contextId);
    if (!context) return false;

    context.state = JSON.parse(JSON.stringify(snapshot.state));
    context.updatedAt = new Date();

    this.emit('context:restored', { contextId, snapshotIndex });
    console.log(`[ContextManager] Restored context ${contextId} to snapshot ${snapshotIndex}`);

    return true;
  }

  /**
   * Get snapshot history
   */
  async getSnapshots(contextId: string): Promise<ContextSnapshot[]> {
    return this.snapshots.get(contextId) || [];
  }

  /**
   * Delete context and all associated data
   */
  async deleteContext(contextId: string): Promise<boolean> {
    const context = this.contexts.get(contextId);
    if (!context) return false;

    this.contexts.delete(contextId);
    this.snapshots.delete(contextId);

    this.emit('context:deleted', contextId);
    console.log(`[ContextManager] Deleted context ${contextId}`);

    return true;
  }

  /**
   * Clear old inactive contexts
   */
  async clearInactiveContexts(daysInactive: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    let deletedCount = 0;

    for (const [id, context] of Array.from(this.contexts.entries())) {
      if (context.metadata.lastActivity < cutoffDate) {
        await this.deleteContext(id);
        deletedCount++;
      }
    }

    console.log(`[ContextManager] Cleared ${deletedCount} inactive contexts`);
    return deletedCount;
  }

  /**
   * Get context statistics
   */
  getStatistics() {
    const contexts = Array.from(this.contexts.values());

    return {
      totalContexts: contexts.length,
      contextsByMode: contexts.reduce((acc, ctx) => {
        acc[ctx.mode] = (acc[ctx.mode] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalSnapshots: Array.from(this.snapshots.values())
        .reduce((sum, list) => sum + list.length, 0),
      averageMessagesPerContext: contexts.length > 0
        ? contexts.reduce((sum, ctx) => sum + ctx.metadata.messageCount, 0) / contexts.length
        : 0,
    };
  }

  /**
   * Generate checksum for state verification
   */
  private generateChecksum(state: any): string {
    const str = JSON.stringify(state);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// Singleton instance
export const contextManager = new ContextManager();
