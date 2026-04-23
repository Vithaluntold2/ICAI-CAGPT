import { eq, and, desc, sql as drizzleSql, count, isNull, gte, lte, between } from "drizzle-orm";
import { db, withDbRetry } from "./db";
import { encryptApiKey, decryptApiKey, maskApiKey } from "./utils/encryption";
import { 
  users, 
  profiles,
  profileMembers,
  conversations, 
  messages, 
  modelRoutingLogs, 
  usageTracking,
  userLLMConfig,
  supportTickets,
  ticketMessages,
  auditLogs,
  accountingIntegrations,
  gdprConsents,
  taxFileUploads,
  subscriptions,
  coupons,
  couponUsage,
  apiKeys,
  whiteLabelConfigs,
  systemAlerts,
  maintenanceTasks,
  aiProviderCosts,
  roundtableSessions,
  type User,
  type Profile,
  type InsertProfile,
  type ProfileMember,
  type InsertProfileMember,
  type Conversation,
  type Message,
  type InsertUser,
  type InsertConversation,
  type InsertMessage,
  type UserLLMConfig,
  type InsertUserLLMConfig,
  type SupportTicket,
  type InsertSupportTicket,
  type TicketMessage,
  type InsertTicketMessage,
  type AuditLog,
  type AccountingIntegration,
  type InsertAccountingIntegration,
  type GdprConsent,
  type TaxFileUpload,
  type InsertTaxFileUpload,
  type Coupon,
  type InsertCoupon,
  type CouponUsage,
  type InsertCouponUsage,
  type InsertSystemAlert,
  type InsertMaintenanceTask,
  type InsertAIProviderCost,
  type RoundtableSession,
  type InsertRoundtableSession
} from "@shared/schema";
import type { IStorage } from "./storage";

export class PostgresStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await withDbRetry(
      () => db.select().from(users).where(eq(users.id, id)).limit(1),
      'getUser',
    );
    return result[0] || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await withDbRetry(
      () => db.select().from(users).where(eq(users.email, email)).limit(1),
      'getUserByEmail',
    );
    return result[0] || undefined;
  }

  async createUser(data: InsertUser): Promise<User> {
    const result = await db.insert(users).values(data).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set(updates as any)
      .where(eq(users.id, id))
      .returning();
    return result[0] || undefined;
  }

  async updateUserSubscription(id: string, tier: string): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ subscriptionTier: tier })
      .where(eq(users.id, id))
      .returning();
    return result[0] || undefined;
  }

  async getAllSubscriptions(): Promise<any[]> {
    const result = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        plan: subscriptions.plan,
        currency: subscriptions.currency,
        status: subscriptions.status,
        billingCycle: subscriptions.billingCycle,
        amount: subscriptions.amount,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        createdAt: subscriptions.createdAt,
        user: {
          name: users.name,
          email: users.email,
        },
      })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.userId, users.id))
      .orderBy(desc(subscriptions.createdAt));
    
    return result;
  }

  async incrementFailedLoginAttempts(id: string): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MINUTES = 30;
    
    const updateData: any = {
      failedLoginAttempts: attempts,
      lastFailedLogin: new Date(),
    };
    
    // Lock account if max attempts reached
    if (attempts >= MAX_ATTEMPTS) {
      const lockoutEnd = new Date();
      lockoutEnd.setMinutes(lockoutEnd.getMinutes() + LOCKOUT_DURATION_MINUTES);
      updateData.lockedUntil = lockoutEnd;
    }
    
    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return result[0] || undefined;
  }

  async resetFailedLoginAttempts(id: string): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLogin: null
      })
      .where(eq(users.id, id))
      .returning();
    return result[0] || undefined;
  }

  async isAccountLocked(id: string): Promise<boolean> {
    const user = await this.getUser(id);
    if (!user || !user.lockedUntil) return false;
    
    const now = new Date();
    if (now < user.lockedUntil) {
      return true; // Still locked
    } else {
      // Lockout period expired, reset
      await this.resetFailedLoginAttempts(id);
      return false;
    }
  }

  async enableMFA(id: string, encryptedSecret: string, encryptedBackupCodes: string[]): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        mfaEnabled: true,
        mfaSecret: encryptedSecret,
        mfaBackupCodes: encryptedBackupCodes
      })
      .where(eq(users.id, id))
      .returning();
    return result[0] || undefined;
  }

  async disableMFA(id: string): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null
      })
      .where(eq(users.id, id))
      .returning();
    return result[0] || undefined;
  }

  async updateMFABackupCodes(id: string, encryptedBackupCodes: string[]): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ mfaBackupCodes: encryptedBackupCodes })
      .where(eq(users.id, id))
      .returning();
    return result[0] || undefined;
  }

  // Profile methods
  async getUserProfiles(userId: string): Promise<Profile[]> {
    return db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .orderBy(desc(profiles.isDefault), desc(profiles.createdAt));
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return result[0] || undefined;
  }

  async createProfile(data: InsertProfile): Promise<Profile> {
    // Enforce: Only one personal profile per user
    if (data.type === 'personal') {
      const existingPersonal = await db
        .select()
        .from(profiles)
        .where(
          and(
            eq(profiles.userId, data.userId),
            eq(profiles.type, 'personal')
          )
        )
        .limit(1);
      
      if (existingPersonal.length > 0) {
        throw new Error('User already has a personal profile');
      }
    }
    
    // If this is set as default, unset other defaults for this user
    if (data.isDefault) {
      await db
        .update(profiles)
        .set({ isDefault: false })
        .where(eq(profiles.userId, data.userId));
    }
    
    const result = await db.insert(profiles).values(data).returning();
    return result[0];
  }

  async updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile | undefined> {
    // Get the current profile
    const profile = await this.getProfile(id);
    if (!profile) return undefined;
    
    // Enforce: Prevent changing type to 'personal' if user already has one
    if (data.type === 'personal' && profile.type !== 'personal') {
      const existingPersonal = await db
        .select()
        .from(profiles)
        .where(
          and(
            eq(profiles.userId, profile.userId),
            eq(profiles.type, 'personal')
          )
        )
        .limit(1);
      
      if (existingPersonal.length > 0) {
        throw new Error('User already has a personal profile');
      }
    }
    
    // If setting as default, unset other defaults for this user
    if (data.isDefault) {
      await db
        .update(profiles)
        .set({ isDefault: false })
        .where(eq(profiles.userId, profile.userId));
    }

    const result = await db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteProfile(id: string): Promise<boolean> {
    const result = await db.delete(profiles).where(eq(profiles.id, id)).returning();
    return result.length > 0;
  }

  async getDefaultProfile(userId: string): Promise<Profile | undefined> {
    const result = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.userId, userId), eq(profiles.isDefault, true)))
      .limit(1);
    return result[0] || undefined;
  }

  // Profile member methods
  async getProfileMembers(profileId: string): Promise<ProfileMember[]> {
    return db
      .select()
      .from(profileMembers)
      .where(eq(profileMembers.profileId, profileId))
      .orderBy(desc(profileMembers.createdAt));
  }

  async getProfileMember(id: string): Promise<ProfileMember | undefined> {
    const result = await db.select().from(profileMembers).where(eq(profileMembers.id, id)).limit(1);
    return result[0] || undefined;
  }

  async createProfileMember(data: InsertProfileMember): Promise<ProfileMember> {
    const result = await db.insert(profileMembers).values(data).returning();
    return result[0];
  }

  async updateProfileMember(id: string, data: Partial<InsertProfileMember>): Promise<ProfileMember | undefined> {
    const result = await db
      .update(profileMembers)
      .set(data)
      .where(eq(profileMembers.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteProfileMember(id: string): Promise<boolean> {
    const result = await db.delete(profileMembers).where(eq(profileMembers.id, id)).returning();
    return result.length > 0;
  }

  // Conversation methods
  async getConversation(id: string): Promise<Conversation | undefined> {
    const result = await withDbRetry(
      () => db.select().from(conversations).where(eq(conversations.id, id)).limit(1),
      'getConversation',
    );
    return result[0] || undefined;
  }

  async getConversationByShareToken(token: string): Promise<Conversation | undefined> {
    const result = await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.sharedToken, token),
        eq(conversations.isShared, true)
      ))
      .limit(1);
    return result[0] || undefined;
  }

  async getUserConversations(userId: string, profileId?: string | null): Promise<Conversation[]> {
    const conditions = [eq(conversations.userId, userId)];
    if (profileId !== undefined) {
      if (profileId === null) {
        conditions.push(isNull(conversations.profileId));
      } else {
        conditions.push(eq(conversations.profileId, profileId));
      }
    }
    try {
      return await withDbRetry(
        () =>
          db
            .select()
            .from(conversations)
            .where(and(...conditions))
            .orderBy(desc(conversations.updatedAt)),
        'getUserConversations',
      );
    } catch (error: any) {
      console.error('[Storage] getUserConversations error:', error?.message || error);
      console.error('[Storage] getUserConversations stack:', error?.stack);
      throw error;
    }
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const result = await db.insert(conversations).values(data).returning();
    return result[0];
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation | undefined> {
    const result = await db
      .update(conversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const result = await db.delete(conversations).where(eq(conversations.id, id)).returning();
    return result.length > 0;
  }

  // Message methods
  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return withDbRetry(
      () =>
        db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversationId))
          .orderBy(messages.createdAt),
      'getConversationMessages',
    );
  }

  async getMessage(messageId: string): Promise<Message | undefined> {
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    return result[0];
  }

  async createMessage(
    data: InsertMessage & { id?: string; artifactIds?: string[] }
  ): Promise<Message> {
    const result = await db.insert(messages).values(data).returning();
    return result[0];
  }

  // Routing logs
  async createRoutingLog(data: {
    messageId: string;
    queryClassification: any;
    selectedModel: string;
    routingReason: string;
    confidence: number;
    alternativeModels: string[];
    processingTimeMs: number;
  }) {
    const result = await db.insert(modelRoutingLogs).values(data).returning();
    return result[0];
  }

  // Usage tracking
  async getUsageForMonth(userId: string, month: string) {
    const result = await db
      .select()
      .from(usageTracking)
      .where(and(eq(usageTracking.userId, userId), eq(usageTracking.month, month)))
      .limit(1);
    
    return result[0] || undefined;
  }

  async incrementUsage(
    userId: string,
    month: string,
    queries: number = 0,
    documents: number = 0,
    tokens: number = 0
  ) {
    const existing = await this.getUsageForMonth(userId, month);
    
    if (existing) {
      const result = await db
        .update(usageTracking)
        .set({
          queriesUsed: existing.queriesUsed + queries,
          documentsAnalyzed: existing.documentsAnalyzed + documents,
          tokensUsed: existing.tokensUsed + tokens,
          updatedAt: new Date()
        })
        .where(and(
          eq(usageTracking.userId, userId),
          eq(usageTracking.month, month)
        ))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(usageTracking).values({
        userId,
        month,
        queriesUsed: queries,
        documentsAnalyzed: documents,
        tokensUsed: tokens
      }).returning();
      return result[0];
    }
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getAdminKPIs() {
    const totalUsers = await db.select({ count: count() }).from(users);
    const totalConversations = await db.select({ count: count() }).from(conversations);
    const totalMessages = await db.select({ count: count() }).from(messages);
    
    const subscriptionCounts = await db
      .select({
        tier: users.subscriptionTier,
        count: drizzleSql<number>`cast(count(*) as int)`
      })
      .from(users)
      .groupBy(users.subscriptionTier);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeUsers = await db
      .select({ count: count() })
      .from(conversations)
      .where(drizzleSql`${conversations.createdAt} >= ${thirtyDaysAgo}`);

    return {
      totalUsers: totalUsers[0].count,
      totalConversations: totalConversations[0].count,
      totalMessages: totalMessages[0].count,
      subscriptionCounts,
      activeUsersLast30Days: activeUsers[0].count
    };
  }

  // User LLM Config methods
  async getUserLLMConfig(userId: string, includeMasked: boolean = true): Promise<UserLLMConfig & { apiKeyMasked?: string } | undefined> {
    const result = await db
      .select()
      .from(userLLMConfig)
      .where(eq(userLLMConfig.userId, userId))
      .limit(1);
    
    if (!result[0]) return undefined;
    
    const config = result[0];
    
    if (includeMasked && config.apiKey) {
      const decrypted = decryptApiKey(config.apiKey);
      return {
        ...config,
        apiKey: undefined as any,
        apiKeyMasked: maskApiKey(decrypted)
      };
    }
    
    return config;
  }

  async upsertUserLLMConfig(data: InsertUserLLMConfig): Promise<UserLLMConfig> {
    const dataToStore = { ...data };
    
    if (data.apiKey) {
      dataToStore.apiKey = encryptApiKey(data.apiKey);
    }
    
    const existing = await this.getUserLLMConfig(data.userId, false);
    
    if (existing) {
      const result = await db
        .update(userLLMConfig)
        .set({ ...dataToStore, updatedAt: new Date() })
        .where(eq(userLLMConfig.userId, data.userId))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(userLLMConfig).values(dataToStore).returning();
      return result[0];
    }
  }

  async getDecryptedLLMConfig(userId: string): Promise<UserLLMConfig | undefined> {
    const config = await this.getUserLLMConfig(userId, false);
    if (!config || !config.apiKey) return config;
    
    return {
      ...config,
      apiKey: decryptApiKey(config.apiKey)
    };
  }

  // Support Ticket methods
  async createSupportTicket(data: InsertSupportTicket): Promise<SupportTicket> {
    const result = await db.insert(supportTickets).values(data).returning();
    return result[0];
  }

  async getSupportTicket(id: string): Promise<SupportTicket | undefined> {
    const result = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, id))
      .limit(1);
    return result[0] || undefined;
  }

  async getUserSupportTickets(userId: string): Promise<SupportTicket[]> {
    return db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async getAllSupportTickets(): Promise<SupportTicket[]> {
    return db
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));
  }

  async updateSupportTicket(id: string, data: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const result = await db
      .update(supportTickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return result[0] || undefined;
  }

  async createTicketMessage(data: InsertTicketMessage): Promise<TicketMessage> {
    const result = await db.insert(ticketMessages).values(data).returning();
    return result[0];
  }

  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    return db
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(ticketMessages.createdAt);
  }

  async getUserAuditLogs(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  // Accounting Integration methods
  async createAccountingIntegration(data: InsertAccountingIntegration): Promise<AccountingIntegration> {
    const result = await db.insert(accountingIntegrations).values(data).returning();
    return result[0];
  }

  async getUserAccountingIntegrations(userId: string): Promise<AccountingIntegration[]> {
    return db
      .select()
      .from(accountingIntegrations)
      .where(eq(accountingIntegrations.userId, userId));
  }

  async updateAccountingIntegration(
    id: string,
    data: Partial<AccountingIntegration>
  ): Promise<AccountingIntegration | undefined> {
    const result = await db
      .update(accountingIntegrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accountingIntegrations.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteAccountingIntegration(id: string): Promise<boolean> {
    const result = await db
      .delete(accountingIntegrations)
      .where(eq(accountingIntegrations.id, id))
      .returning();
    return result.length > 0;
  }

  // GDPR Consent methods
  async createGdprConsent(data: {
    userId: string;
    consentType: string;
    consented: boolean;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<GdprConsent> {
    const result = await db.insert(gdprConsents).values(data).returning();
    return result[0];
  }

  async getUserGdprConsents(userId: string): Promise<GdprConsent[]> {
    return db
      .select()
      .from(gdprConsents)
      .where(eq(gdprConsents.userId, userId))
      .orderBy(desc(gdprConsents.createdAt));
  }

  async deleteUserData(userId: string): Promise<boolean> {
    await db.delete(users).where(eq(users.id, userId));
    return true;
  }

  async exportUserData(userId: string) {
    const user = await this.getUser(userId);
    const userConversations = await this.getUserConversations(userId);
    const tickets = await this.getUserSupportTickets(userId);
    const integrations = await this.getUserAccountingIntegrations(userId);
    const llmConfig = await this.getUserLLMConfig(userId);
    const consents = await this.getUserGdprConsents(userId);

    return {
      user,
      conversations: userConversations,
      tickets,
      integrations,
      llmConfig,
      consents
    };
  }

  // Tax file upload methods
  async createTaxFileUpload(data: InsertTaxFileUpload): Promise<TaxFileUpload> {
    const result = await db.insert(taxFileUploads).values(data).returning();
    return result[0];
  }

  async getTaxFileUpload(id: string): Promise<TaxFileUpload | undefined> {
    const result = await db
      .select()
      .from(taxFileUploads)
      .where(eq(taxFileUploads.id, id))
      .limit(1);
    return result[0] || undefined;
  }

  async getUserTaxFileUploads(userId: string, vendor?: string): Promise<TaxFileUpload[]> {
    if (vendor) {
      return db
        .select()
        .from(taxFileUploads)
        .where(and(
          eq(taxFileUploads.userId, userId),
          eq(taxFileUploads.vendor, vendor)
        ))
        .orderBy(desc(taxFileUploads.createdAt));
    }
    return db
      .select()
      .from(taxFileUploads)
      .where(eq(taxFileUploads.userId, userId))
      .orderBy(desc(taxFileUploads.createdAt));
  }

  async updateTaxFileUpload(
    id: string,
    data: Partial<TaxFileUpload>
  ): Promise<TaxFileUpload | undefined> {
    const result = await db
      .update(taxFileUploads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taxFileUploads.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteTaxFileUpload(id: string): Promise<boolean> {
    const result = await db
      .update(taxFileUploads)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(taxFileUploads.id, id))
      .returning();
    return result.length > 0;
  }

  async getTaxFilesByStatus(status: string): Promise<TaxFileUpload[]> {
    return db
      .select()
      .from(taxFileUploads)
      .where(eq(taxFileUploads.scanStatus, status))
      .orderBy(taxFileUploads.createdAt);
  }

  async updateTaxFileStatus(
    id: string,
    status: string,
    scanDetails: any
  ): Promise<TaxFileUpload | undefined> {
    const result = await db
      .update(taxFileUploads)
      .set({
        scanStatus: status,
        scanDetails,
        updatedAt: new Date()
      })
      .where(eq(taxFileUploads.id, id))
      .returning();
    return result[0] || undefined;
  }

  async createCoupon(data: InsertCoupon): Promise<Coupon> {
    const result = await db.insert(coupons).values(data).returning();
    return result[0];
  }

  async getCoupon(id: string): Promise<Coupon | undefined> {
    const result = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    return result[0] || undefined;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const result = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    return result[0] || undefined;
  }

  async getAllCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async updateCoupon(id: string, updates: Partial<Coupon>): Promise<Coupon | undefined> {
    const result = await db
      .update(coupons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    const result = await db.delete(coupons).where(eq(coupons.id, id)).returning();
    return result.length > 0;
  }

  async incrementCouponUsage(couponId: string): Promise<void> {
    await db
      .update(coupons)
      .set({ 
        usageCount: drizzleSql`${coupons.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(coupons.id, couponId));
  }

  async getCouponUsageCount(couponId: string, userId?: string): Promise<number> {
    if (userId) {
      const result = await db
        .select({ count: count() })
        .from(couponUsage)
        .where(and(
          eq(couponUsage.couponId, couponId),
          eq(couponUsage.userId, userId)
        ));
      return result[0]?.count || 0;
    } else {
      const coupon = await this.getCoupon(couponId);
      return coupon?.usageCount || 0;
    }
  }

  async recordCouponUsage(data: InsertCouponUsage): Promise<CouponUsage> {
    const result = await db.insert(couponUsage).values(data).returning();
    return result[0];
  }

  async getCouponUsageHistory(couponId?: string, userId?: string): Promise<CouponUsage[]> {
    if (couponId && userId) {
      return db.select().from(couponUsage).where(and(
        eq(couponUsage.couponId, couponId),
        eq(couponUsage.userId, userId)
      )).orderBy(desc(couponUsage.usedAt));
    } else if (couponId) {
      return db.select().from(couponUsage).where(eq(couponUsage.couponId, couponId)).orderBy(desc(couponUsage.usedAt));
    } else if (userId) {
      return db.select().from(couponUsage).where(eq(couponUsage.userId, userId)).orderBy(desc(couponUsage.usedAt));
    } else {
      return db.select().from(couponUsage).orderBy(desc(couponUsage.usedAt));
    }
  }

  // API Keys methods
  async getApiKeysByUserId(userId: string) {
    return db.select().from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKeyById(id: string) {
    const result = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    return result[0] || undefined;
  }

  async getApiKeyByHash(keyHash: string) {
    const result = await db.select().from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
      .limit(1);
    return result[0] || undefined;
  }

  async createApiKey(data: any) {
    const result = await db.insert(apiKeys).values(data).returning();
    return result[0];
  }

  async revokeApiKey(id: string) {
    const result = await db.update(apiKeys)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return result[0] || undefined;
  }

  async updateApiKeyLastUsed(id: string) {
    await db.update(apiKeys)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  // White-label configuration methods
  async getWhiteLabelConfig(userId: string) {
    const result = await db.select().from(whiteLabelConfigs)
      .where(eq(whiteLabelConfigs.userId, userId))
      .limit(1);
    return result[0] || undefined;
  }

  async upsertWhiteLabelConfig(data: any) {
    const existing = await this.getWhiteLabelConfig(data.userId);
    
    if (existing) {
      const result = await db.update(whiteLabelConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(whiteLabelConfigs.userId, data.userId))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(whiteLabelConfigs).values(data).returning();
      return result[0];
    }
  }

  // System Alerts methods
  async createSystemAlert(data: InsertSystemAlert) {
    // Validation: Check required fields and constraints
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    const validTypes = ['error', 'warning', 'info', 'success'];
    
    if (!validSeverities.includes(data.severity)) {
      throw new Error(`Invalid severity: ${data.severity}. Must be one of: ${validSeverities.join(', ')}`);
    }
    
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
    
    if (!data.message || data.message.trim().length === 0) {
      throw new Error('Alert message cannot be empty');
    }
    
    if (data.message.length > 5000) {
      throw new Error('Alert message too long (max 5000 characters)');
    }
    
    // Check for duplicate alerts created within the last hour
    if (data.sourceId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const duplicates = await db.select().from(systemAlerts)
        .where(and(
          eq(systemAlerts.source, data.source),
          eq(systemAlerts.sourceId, data.sourceId),
          eq(systemAlerts.message, data.message),
          gte(systemAlerts.createdAt, oneHourAgo)
        ))
        .limit(1);
      
      if (duplicates.length > 0) {
        console.warn(`[Alert] Duplicate alert suppressed: ${data.source}/${data.sourceId}`);
        return duplicates[0]; // Return existing alert instead of creating duplicate
      }
    }
    
    const result = await db.insert(systemAlerts).values(data).returning();
    return result[0];
  }

  async getAllSystemAlerts(limit = 50) {
    return db.select().from(systemAlerts)
      .orderBy(desc(systemAlerts.createdAt))
      .limit(limit);
  }

  async getUnacknowledgedAlerts() {
    return db.select().from(systemAlerts)
      .where(eq(systemAlerts.acknowledged, false))
      .orderBy(desc(systemAlerts.createdAt));
  }

  async acknowledgeAlert(alertId: string, userId: string) {
    const result = await db.update(systemAlerts)
      .set({ 
        acknowledged: true, 
        acknowledgedBy: userId, 
        acknowledgedAt: new Date() 
      })
      .where(eq(systemAlerts.id, alertId))
      .returning();
    return result[0];
  }

  async resolveAlert(alertId: string) {
    const result = await db.update(systemAlerts)
      .set({ resolvedAt: new Date() })
      .where(eq(systemAlerts.id, alertId))
      .returning();
    return result[0];
  }

  // Maintenance Tasks methods
  async createMaintenanceTask(data: InsertMaintenanceTask) {
    const result = await db.insert(maintenanceTasks).values(data).returning();
    return result[0];
  }

  async getAllMaintenanceTasks() {
    return db.select().from(maintenanceTasks)
      .orderBy(desc(maintenanceTasks.createdAt));
  }

  async getScheduledMaintenanceTasks() {
    const now = new Date();
    return db.select().from(maintenanceTasks)
      .where(and(
        eq(maintenanceTasks.status, 'scheduled'),
        lte(maintenanceTasks.nextRunAt, now)
      ))
      .orderBy(maintenanceTasks.nextRunAt);
  }

  async updateMaintenanceTask(taskId: string, updates: Partial<InsertMaintenanceTask>) {
    const result = await db.update(maintenanceTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(maintenanceTasks.id, taskId))
      .returning();
    return result[0];
  }

  async completeMaintenanceTask(taskId: string, result: any, error?: string) {
    const updates: any = { 
      status: error ? 'failed' : 'completed',
      lastRunAt: new Date(),
      result,
      updatedAt: new Date()
    };
    if (error) updates.error = error;
    
    const updated = await db.update(maintenanceTasks)
      .set(updates)
      .where(eq(maintenanceTasks.id, taskId))
      .returning();
    return updated[0];
  }

  // AI Provider Costs methods
  async logAIProviderCost(data: InsertAIProviderCost) {
    const result = await db.insert(aiProviderCosts).values(data).returning();
    return result[0];
  }

  async getAIProviderCosts(startDate?: Date, endDate?: Date, limit = 1000, offset = 0) {
    let baseQuery = db.select().from(aiProviderCosts);
    
    if (startDate && endDate) {
      return baseQuery
        .where(between(aiProviderCosts.date, startDate, endDate))
        .orderBy(desc(aiProviderCosts.date))
        .limit(Math.min(limit, 10000))
        .offset(offset);
    } else if (startDate) {
      return baseQuery
        .where(gte(aiProviderCosts.date, startDate))
        .orderBy(desc(aiProviderCosts.date))
        .limit(Math.min(limit, 10000))
        .offset(offset);
    } else if (endDate) {
      return baseQuery
        .where(lte(aiProviderCosts.date, endDate))
        .orderBy(desc(aiProviderCosts.date))
        .limit(Math.min(limit, 10000))
        .offset(offset);
    }
    
    return baseQuery
      .orderBy(desc(aiProviderCosts.date))
      .limit(Math.min(limit, 10000))
      .offset(offset);
  }

  async getAIProviderCostsByProvider(provider: string, startDate?: Date, endDate?: Date, limit = 1000, offset = 0) {
    if (startDate && endDate) {
      return db.select().from(aiProviderCosts)
        .where(and(
          eq(aiProviderCosts.provider, provider),
          between(aiProviderCosts.date, startDate, endDate)
        ))
        .orderBy(desc(aiProviderCosts.date))
        .limit(Math.min(limit, 10000))
        .offset(offset);
    } else if (startDate) {
      return db.select().from(aiProviderCosts)
        .where(and(
          eq(aiProviderCosts.provider, provider),
          gte(aiProviderCosts.date, startDate)
        ))
        .orderBy(desc(aiProviderCosts.date))
        .limit(Math.min(limit, 10000))
        .offset(offset);
    } else if (endDate) {
      return db.select().from(aiProviderCosts)
        .where(and(
          eq(aiProviderCosts.provider, provider),
          lte(aiProviderCosts.date, endDate)
        ))
        .orderBy(desc(aiProviderCosts.date))
        .limit(Math.min(limit, 10000))
        .offset(offset);
    }
    
    return db.select().from(aiProviderCosts)
      .where(eq(aiProviderCosts.provider, provider))
      .orderBy(desc(aiProviderCosts.date))
      .limit(Math.min(limit, 10000))
      .offset(offset);
  }

  async aggregateAIProviderCosts(startDate: Date, endDate: Date) {
    const result = await db.select({
      provider: aiProviderCosts.provider,
      totalCostCents: drizzleSql<number>`SUM(${aiProviderCosts.costUsd})`,
      totalTokens: drizzleSql<number>`SUM(${aiProviderCosts.tokensUsed})`,
      totalRequests: drizzleSql<number>`SUM(${aiProviderCosts.requestCount})`
    })
    .from(aiProviderCosts)
    .where(between(aiProviderCosts.date, startDate, endDate))
    .groupBy(aiProviderCosts.provider);
    
    return result;
  }

  // Audit Log methods (compliance requirement)
  async createAuditLog(data: { 
    userId: string; 
    action: string; 
    resourceType: string; 
    resourceId?: string; 
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const result = await db.insert(auditLogs).values(data).returning();
    return result[0];
  }

  async getAuditLogs(userId?: string, limit = 100, offset = 0) {
    if (userId) {
      return db.select().from(auditLogs)
        .where(eq(auditLogs.userId, userId))
        .orderBy(desc(auditLogs.timestamp))
        .limit(Math.min(limit, 5000))
        .offset(offset);
    }
    
    return db.select().from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(Math.min(limit, 5000))
      .offset(offset);
  }

  async getAuditLogsByResource(resourceType: string, resourceId: string, limit = 50) {
    return db.select().from(auditLogs)
      .where(and(
        eq(auditLogs.resourceType, resourceType),
        eq(auditLogs.resourceId, resourceId)
      ))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  // ============================================================================
  // ROUNDTABLE SESSION METHODS
  // ============================================================================

  async createRoundtableSession(data: InsertRoundtableSession): Promise<RoundtableSession> {
    const result = await db.insert(roundtableSessions).values(data).returning();
    return result[0];
  }

  async getRoundtableSession(sessionId: string): Promise<RoundtableSession | undefined> {
    const result = await db.select().from(roundtableSessions)
      .where(eq(roundtableSessions.id, sessionId))
      .limit(1);
    return result[0] || undefined;
  }

  async updateRoundtableSession(
    sessionId: string, 
    updates: Partial<Omit<RoundtableSession, 'id' | 'userId' | 'startedAt'>>
  ): Promise<RoundtableSession | undefined> {
    const result = await db.update(roundtableSessions)
      .set(updates as any)
      .where(eq(roundtableSessions.id, sessionId))
      .returning();
    return result[0] || undefined;
  }

  async getRoundtableSessionsByUser(userId: string, limit = 20): Promise<RoundtableSession[]> {
    return db.select().from(roundtableSessions)
      .where(eq(roundtableSessions.userId, userId))
      .orderBy(desc(roundtableSessions.startedAt))
      .limit(limit);
  }

  async deleteRoundtableSession(sessionId: string): Promise<boolean> {
    const result = await db.delete(roundtableSessions)
      .where(eq(roundtableSessions.id, sessionId))
      .returning();
    return result.length > 0;
  }

  async cleanupExpiredRoundtableSessions(olderThanHours = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const result = await db.delete(roundtableSessions)
      .where(lte(roundtableSessions.startedAt, cutoff))
      .returning();
    return result.length;
  }
}

export const storage = new PostgresStorage();
