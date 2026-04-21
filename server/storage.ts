import { 
  type User, 
  type InsertUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type ModelRoutingLog,
  type UsageTracking,
  type Coupon,
  type InsertCoupon,
  type CouponUsage,
  type InsertCouponUsage
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserSubscription(userId: string, tier: string): Promise<User | undefined>;
  getAllSubscriptions(): Promise<any[]>;
  
  // Conversation management
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByShareToken(token: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string, profileId?: string | null): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<boolean>;
  
  // Message management
  getConversationMessages(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Model routing logs
  createRoutingLog(log: Partial<ModelRoutingLog>): Promise<ModelRoutingLog>;
  
  // Usage tracking
  getUsageForMonth(userId: string, month: string): Promise<UsageTracking | undefined>;
  incrementUsage(userId: string, month: string, queries?: number, documents?: number, tokens?: number): Promise<UsageTracking>;
  
  // Coupon management
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  getCoupon(id: string): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  getAllCoupons(): Promise<Coupon[]>;
  updateCoupon(id: string, updates: Partial<Coupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<boolean>;
  incrementCouponUsage(couponId: string): Promise<void>;
  getCouponUsageCount(couponId: string, userId?: string): Promise<number>;
  recordCouponUsage(usage: InsertCouponUsage): Promise<CouponUsage>;
  getCouponUsageHistory(couponId?: string, userId?: string): Promise<CouponUsage[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private routingLogs: Map<string, ModelRoutingLog>;
  private usage: Map<string, UsageTracking>;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.routingLogs = new Map();
    this.usage = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      subscriptionTier: "free",
      isAdmin: false,
      isSuperAdmin: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastFailedLogin: null,
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserSubscription(userId: string, tier: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (user) {
      user.subscriptionTier = tier;
      this.users.set(userId, user);
    }
    return user;
  }

  // Conversation methods
  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationByShareToken(token: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values())
      .find(conv => conv.sharedToken === token && conv.isShared);
  }

  async getUserConversations(userId: string, profileId?: string | null): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(conv => {
        if (conv.userId !== userId) return false;
        if (profileId !== undefined) {
          return conv.profileId === profileId;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async createConversation(insertConv: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      ...insertConv,
      profileId: insertConv.profileId || null,
      preview: insertConv.preview || null,
      metadata: insertConv.metadata || null,
      chatMode: insertConv.chatMode || 'standard',
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      pinned: false,
      isShared: false,
      sharedToken: null,
      qualityScore: null,
      resolved: null,
      userFeedback: null
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (conversation) {
      const updated = { ...conversation, ...updates, updatedAt: new Date() };
      this.conversations.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async deleteConversation(id: string): Promise<boolean> {
    return this.conversations.delete(id);
  }

  // Message methods
  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(insertMsg: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMsg,
      id,
      modelUsed: insertMsg.modelUsed || null,
      routingDecision: insertMsg.routingDecision || null,
      calculationResults: insertMsg.calculationResults || null,
      tokensUsed: insertMsg.tokensUsed || null,
      excelFilename: null,
      excelBuffer: null,
      metadata: insertMsg.metadata || null,
      createdAt: new Date()
    };
    this.messages.set(id, message);
    return message;
  }

  // Routing log methods
  async createRoutingLog(log: Partial<ModelRoutingLog>): Promise<ModelRoutingLog> {
    const id = randomUUID();
    const routingLog: ModelRoutingLog = {
      id,
      messageId: log.messageId!,
      queryClassification: log.queryClassification!,
      selectedModel: log.selectedModel!,
      routingReason: log.routingReason || null,
      confidence: log.confidence || null,
      alternativeModels: log.alternativeModels || null,
      processingTimeMs: log.processingTimeMs || null,
      tokensUsed: null,
      costUsd: null,
      createdAt: new Date()
    };
    this.routingLogs.set(id, routingLog);
    return routingLog;
  }

  // Usage tracking methods
  async getUsageForMonth(userId: string, month: string): Promise<UsageTracking | undefined> {
    const key = `${userId}-${month}`;
    return this.usage.get(key);
  }

  async incrementUsage(
    userId: string, 
    month: string, 
    queries: number = 0, 
    documents: number = 0, 
    tokens: number = 0
  ): Promise<UsageTracking> {
    const key = `${userId}-${month}`;
    let usage = this.usage.get(key);
    
    if (!usage) {
      usage = {
        id: randomUUID(),
        userId,
        month,
        queriesUsed: 0,
        documentsAnalyzed: 0,
        tokensUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    usage.queriesUsed += queries;
    usage.documentsAnalyzed += documents;
    usage.tokensUsed += tokens;
    usage.updatedAt = new Date();
    
    this.usage.set(key, usage);
    return usage;
  }

  async createCoupon(_coupon: InsertCoupon): Promise<Coupon> {
    throw new Error("MemStorage: Coupon management not implemented");
  }

  async getCoupon(_id: string): Promise<Coupon | undefined> {
    throw new Error("MemStorage: Coupon management not implemented");
  }

  async getCouponByCode(_code: string): Promise<Coupon | undefined> {
    throw new Error("MemStorage: Coupon management not implemented");
  }

  async getAllCoupons(): Promise<Coupon[]> {
    throw new Error("MemStorage: Coupon management not implemented");
  }

  async updateCoupon(_id: string, _updates: Partial<Coupon>): Promise<Coupon | undefined> {
    throw new Error("MemStorage: Coupon management not implemented");
  }

  async deleteCoupon(_id: string): Promise<boolean> {
    throw new Error("MemStorage: Coupon management not implemented");
  }

  async incrementCouponUsage(_couponId: string): Promise<void> {
    throw new Error("MemStorage: Coupon management not implemented");
  }

  async getCouponUsageCount(_couponId: string, _userId?: string): Promise<number> {
    throw new Error("MemStorage: Coupon management not implemented");
  }

  async recordCouponUsage(_usage: InsertCouponUsage): Promise<CouponUsage> {
    throw new Error("MemStorage: Coupon management not implemented");
  }

  async getCouponUsageHistory(_couponId?: string, _userId?: string): Promise<CouponUsage[]> {
    throw new Error("MemStorage: Coupon management not implemented");
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(userId, updated);
    return updated;
  }

  async getAllSubscriptions(): Promise<any[]> {
    throw new Error("MemStorage: Subscription management not implemented");
  }
}

export const storage = new MemStorage();
