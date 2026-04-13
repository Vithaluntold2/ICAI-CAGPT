import { z } from "zod";
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

// Zod schemas for validation
export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  subscription_tier: z.enum(["free", "plus", "professional", "enterprise"]).optional().default("free"),
  is_admin: z.boolean().optional().default(false),
  email_verified: z.boolean().optional().default(false),
  email_verified_at: z.string().optional(),
  created_at: z.string().optional()
});

export const insertSupportTicketSchema = z.object({
  user_id: z.string(),
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).default("open"),
  category: z.string().optional()
});

export const insertTicketMessageSchema = z.object({
  ticket_id: z.string(),
  user_id: z.string(),
  message: z.string().min(1),
  is_internal: z.boolean().default(false)
});

export const insertUserLLMConfigSchema = z.object({
  user_id: z.string(),
  provider: z.enum(["openai", "claude", "gemini", "azure-openai"]),
  model_name: z.string(),
  api_key: z.string(),
  api_endpoint: z.string().optional(),
  is_active: z.boolean().default(true)
});

export const insertCouponSchema = z.object({
  code: z.string().min(1),
  description: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.number().min(0),
  currency: z.string().optional().default("usd"),
  max_uses: z.number().optional(),
  max_uses_per_user: z.number().optional().default(1),
  minimum_amount: z.number().optional(),
  max_discount_amount: z.number().optional(),
  applicable_plans: z.array(z.string()).optional(),
  applicable_currencies: z.array(z.string()).optional(),
  expires_at: z.string().optional(),
  is_active: z.boolean().default(true)
});

export const insertForensicCaseSchema = z.object({
  user_id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  case_type: z.enum(["fraud", "audit", "compliance", "investigation"]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["active", "closed", "archived"]).default("active")
});

export const insertScenarioPlaybookSchema = z.object({
  user_id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  scenario_type: z.enum(["tax", "audit", "compliance", "financial"]),
  base_assumptions: z.record(z.any()).optional(),
  is_template: z.boolean().default(false),
  is_public: z.boolean().default(false)
});

// Drizzle table definitions - SQLite compatible
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  subscription_tier: text("subscription_tier").notNull().default("free"),
  is_admin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  email_verified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  email_verified_at: text("email_verified_at"),
  failed_login_attempts: integer("failed_login_attempts").notNull().default(0),
  locked_until: text("locked_until"),
  last_failed_login: text("last_failed_login"),
  mfa_enabled: integer("mfa_enabled", { mode: "boolean" }).notNull().default(false),
  mfa_secret: text("mfa_secret"),
  mfa_backup_codes: text("mfa_backup_codes"),
  created_at: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updated_at: text("updated_at").notNull().default("CURRENT_TIMESTAMP")
});

// Core conversation and profile tables
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  user_id: text("user_id"),
  name: text("name").notNull(),
  description: text("description"),
  is_default: integer("is_default", { mode: "boolean" }).notNull().default(false),
  type: text("type").default("personal"), // "personal", "family", etc.
  created_at: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updated_at: text("updated_at").notNull().default("CURRENT_TIMESTAMP")
});

export const profileMembers = sqliteTable("profile_members", {
  id: text("id").primaryKey(),
  profile_id: text("profile_id"),
  user_id: text("user_id"),
  role: text("role").notNull().default("member"),
  created_at: text("created_at").notNull().default("CURRENT_TIMESTAMP")
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  user_id: text("user_id"),
  profile_id: text("profile_id"),
  title: text("title"),
  preview: text("preview"),
  pinned: boolean("pinned").default(false),
  is_shared: boolean("is_shared").default(false),
  shared_token: text("shared_token"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey(),
  conversation_id: varchar("conversation_id").references(() => conversations.id),
  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // Store AI response metadata, attachments, etc.
  model_used: varchar("model_used"),
  routing_decision: text("routing_decision"),
  calculation_results: jsonb("calculation_results"),
  tokens_used: integer("tokens_used"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

// Auth and verification tables  
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  token: text("token").notNull().unique(),
  expires_at: timestamp("expires_at").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  token: text("token").notNull().unique(),
  expires_at: timestamp("expires_at").notNull(),
  used_at: timestamp("used_at"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  key_hash: text("key_hash").notNull(),
  scopes: text("scopes").array(),
  is_active: boolean("is_active").default(true),
  expires_at: timestamp("expires_at"),
  rate_limit: integer("rate_limit").default(1000),
  last_used: timestamp("last_used"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  revoked_at: timestamp("revoked_at")
});

// Support and tracking tables
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const ticketMessages = pgTable("ticket_messages", {
  id: varchar("id").primaryKey(),
  ticket_id: varchar("ticket_id").references(() => supportTickets.id),
  user_id: varchar("user_id").references(() => users.id),
  content: text("content").notNull(),
  is_staff_reply: boolean("is_staff_reply").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  month: text("month").notNull(),
  queries: integer("queries").notNull().default(0),
  documents: integer("documents").notNull().default(0),
  tokens: integer("tokens").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const modelRoutingLogs = pgTable("model_routing_logs", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  message_id: varchar("message_id").references(() => messages.id),
  query: text("query"),
  model: text("model"),
  response: text("response"),
  tokens_used: integer("tokens_used"),
  query_classification: text("query_classification"),
  selected_model: text("selected_model"),
  routing_reason: text("routing_reason"),
  confidence: integer("confidence"),
  alternative_models: jsonb("alternative_models"),
  processing_time_ms: integer("processing_time_ms"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

// Coupon system tables
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discount_type: text("discount_type").notNull(), // "percentage" | "fixed"
  discount_value: integer("discount_value").notNull(),
  currency: text("currency").default("usd"), // For fixed amount coupons
  max_uses: integer("max_uses"),
  current_uses: integer("current_uses").notNull().default(0),
  max_uses_per_user: integer("max_uses_per_user").default(1),
  minimum_amount: integer("minimum_amount"), // Minimum purchase amount in cents
  max_discount_amount: integer("max_discount_amount"), // Maximum discount for percentage coupons
  applicable_plans: jsonb("applicable_plans"), // Array of plan names this coupon applies to
  applicable_currencies: jsonb("applicable_currencies"), // Array of currencies this coupon applies to
  expires_at: timestamp("expires_at"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const couponUsage = pgTable("coupon_usage", {
  id: varchar("id").primaryKey(),
  coupon_id: varchar("coupon_id").references(() => coupons.id),
  user_id: varchar("user_id").references(() => users.id),
  used_at: timestamp("used_at").notNull().defaultNow()
});

// Analytics tables
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resource_id: text("resource_id"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const accountingIntegrations = pgTable("accounting_integrations", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  provider: text("provider").notNull(),
  access_token: text("access_token").notNull(),
  refresh_token: text("refresh_token"),
  expires_at: timestamp("expires_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const gdprConsents = pgTable("gdpr_consents", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  consent_type: text("consent_type").notNull(),
  consented: boolean("consented").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const deliverableTemplates = pgTable("deliverable_templates", {
  id: varchar("id").primaryKey(),
  owner_user_id: varchar("owner_user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  category: text("category"),
  content_template: text("content_template").notNull(),
  variable_schema: jsonb("variable_schema").notNull(),
  style_config: jsonb("style_config"),
  is_system: boolean("is_system").notNull().default(false),
  is_default: boolean("is_default").notNull().default(false),
  is_public: boolean("is_public").notNull().default(false),
  usage_count: integer("usage_count").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const deliverableInstances = pgTable("deliverable_instances", {
  id: varchar("id").primaryKey(),
  template_id: varchar("template_id").references(() => deliverableTemplates.id),
  user_id: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  content_markdown: text("content_markdown"),
  variable_values: jsonb("variable_values"),
  status: text("status").notNull().default("draft"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const deliverableAssets = pgTable("deliverable_assets", {
  id: varchar("id").primaryKey(),
  instance_id: varchar("instance_id").references(() => deliverableInstances.id),
  filename: text("filename").notNull(),
  mime_type: text("mime_type").notNull(),
  format: text("format").notNull(),
  storage_key: text("storage_key").notNull(),
  checksum: text("checksum").notNull(),
  byte_length: integer("byte_length").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const taxFileUploads = pgTable("tax_file_uploads", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").notNull().references(() => users.id),
  filename: text("filename").notNull(),
  original_filename: text("original_filename").notNull(),
  mime_type: text("mime_type").notNull(),
  byte_length: integer("byte_length").notNull(),
  checksum_sha256: text("checksum_sha256").notNull(),
  vendor: text("vendor"),
  form_type: text("form_type"), // "w2", "1099", "1040", etc.
  scan_status: text("scan_status").default("pending"), // "pending", "clean", "infected"
  import_status: text("import_status").default("pending"), // "pending", "success", "failed"
  storage_key: text("storage_key"),
  encrypted_file_key: text("encrypted_file_key"),
  encryption_nonce: text("encryption_nonce"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const forensicCases = pgTable("forensic_cases", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  case_type: text("case_type").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("active"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const forensicDocuments = pgTable("forensic_documents", {
  id: varchar("id").primaryKey(),
  case_id: varchar("case_id").references(() => forensicCases.id),
  filename: text("filename").notNull(),
  document_type: text("document_type").notNull(),
  analysis_status: text("analysis_status").notNull().default("pending"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const forensicFindings = pgTable("forensic_findings", {
  id: varchar("id").primaryKey(),
  case_id: varchar("case_id").references(() => forensicCases.id),
  finding_type: text("finding_type").notNull(),
  severity: text("severity").notNull(),
  description: text("description").notNull(),
  evidence: jsonb("evidence"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const scenarioPlaybooks = pgTable("scenario_playbooks", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  scenario_type: text("scenario_type").notNull(),
  base_assumptions: jsonb("base_assumptions"),
  is_template: boolean("is_template").notNull().default(false),
  is_public: boolean("is_public").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const scenarioVariants = pgTable("scenario_variants", {
  id: varchar("id").primaryKey(),
  playbook_id: varchar("playbook_id").references(() => scenarioPlaybooks.id),
  name: text("name").notNull(),
  assumptions: jsonb("assumptions"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const scenarioRuns = pgTable("scenario_runs", {
  id: varchar("id").primaryKey(),
  variant_id: varchar("variant_id").references(() => scenarioVariants.id),
  results: jsonb("results"),
  execution_time_ms: integer("execution_time_ms"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const scenarioMetrics = pgTable("scenario_metrics", {
  id: varchar("id").primaryKey(),
  run_id: varchar("run_id").references(() => scenarioRuns.id),
  metric_name: text("metric_name").notNull(),
  metric_value: jsonb("metric_value"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("usd"),
  status: text("status").notNull(),
  payment_method: text("payment_method"),
  provider: text("provider").notNull(),
  provider_payment_id: text("provider_payment_id"),
  razorpay_payment_id: text("razorpay_payment_id"),
  razorpay_signature: text("razorpay_signature"),
  failure_reason: text("failure_reason"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

// Analytics schemas
export const conversationAnalytics = pgTable("conversation_analytics", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  conversation_id: varchar("conversation_id"),
  session_duration: integer("session_duration"),
  message_count: integer("message_count"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const userBehaviorPatterns = pgTable("user_behavior_patterns", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  pattern_type: text("pattern_type").notNull(),
  pattern_data: jsonb("pattern_data"),
  confidence_score: integer("confidence_score"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const sentimentTrends = pgTable("sentiment_trends", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  sentiment_score: integer("sentiment_score"),
  trend_period: text("trend_period"),
  analysis_date: timestamp("analysis_date").notNull().defaultNow()
});

export const messageAnalytics = pgTable("message_analytics", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  message_id: varchar("message_id"),
  conversation_id: varchar("conversation_id"),
  
  // Basic message metrics
  response_time_ms: integer("response_time_ms"),
  token_count: integer("token_count"),
  response_length: integer("response_length"),
  
  // User sentiment analysis (for user messages)
  user_sentiment: text("user_sentiment"), // positive, negative, neutral
  sentiment_score: numeric("sentiment_score", { precision: 3, scale: 2 }), // -1 to 1
  emotional_tone: text("emotional_tone"), // happy, frustrated, curious, urgent, etc.
  user_intent: text("user_intent"), // question, request, complaint, etc.
  intent_confidence: numeric("intent_confidence", { precision: 3, scale: 2 }), // 0 to 1
  
  // Response quality assessment (for assistant messages)
  response_quality: integer("response_quality"), // 0 to 100
  accuracy_score: numeric("accuracy_score", { precision: 3, scale: 2 }), // 0 to 1
  helpfulness_score: numeric("helpfulness_score", { precision: 3, scale: 2 }), // 0 to 1
  technical_complexity: integer("technical_complexity"), // 1 to 10
  contains_calculations: boolean("contains_calculations"),
  contains_citations: boolean("contains_citations"),
  
  created_at: timestamp("created_at").notNull().defaultNow()
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  plan: text("plan").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  billing_cycle: text("billing_cycle").notNull(),
  amount: integer("amount").notNull(),
  current_period_end: timestamp("current_period_end"),
  cancelled_at: timestamp("cancelled_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const usageQuotas = pgTable("usage_quotas", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  plan: text("plan").notNull(),
  queries_used: integer("queries_used").notNull().default(0),
  queries_limit: integer("queries_limit").notNull(),
  documents_used: integer("documents_used").notNull().default(0),
  documents_limit: integer("documents_limit").notNull(),
  profiles_used: integer("profiles_used").notNull().default(0),
  profiles_limit: integer("profiles_limit").notNull(),
  scenarios_used: integer("scenarios_used").notNull().default(0),
  scenarios_limit: integer("scenarios_limit").notNull(),
  deliverables_used: integer("deliverables_used").notNull().default(0),
  deliverables_limit: integer("deliverables_limit").notNull(),
  reset_date: timestamp("reset_date").notNull().defaultNow(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

export const userLLMConfigs = pgTable("user_llm_configs", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  provider: text("provider").notNull(), // "openai", "claude", "gemini", "azure-openai"
  model_name: text("model_name").notNull(),
  api_key: text("api_key").notNull(),
  api_endpoint: text("api_endpoint"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Profile and conversation types
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;
export type ProfileMember = typeof profileMembers.$inferSelect;
export type InsertProfileMember = typeof profileMembers.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = {
  id?: string;
  user_id?: string;
  profile_id?: string | null;
  title?: string | null;
  preview?: string | null;
  pinned?: boolean | null;
  is_shared?: boolean | null;
  shared_token?: string | null;
  created_at?: Date;
  updated_at?: Date;
};
export type Message = typeof messages.$inferSelect;
export type InsertMessage = {
  id?: string;
  conversation_id?: string;
  role: string;
  content: string;
  metadata?: any;
  model_used?: string | null;
  routing_decision?: string | null;
  calculation_results?: any;
  tokens_used?: number | null;
  created_at?: Date;
};

// Auth and verification types
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// Support and tracking types  
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type InsertTicketMessage = typeof ticketMessages.$inferInsert;
export type UsageTracking = typeof usageTracking.$inferSelect;
export type InsertUsageTracking = typeof usageTracking.$inferInsert;
export type ModelRoutingLog = typeof modelRoutingLogs.$inferSelect;
export type InsertModelRoutingLog = typeof modelRoutingLogs.$inferInsert;

// Coupon types
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;
export type CouponUsage = typeof couponUsage.$inferSelect;
export type InsertCouponUsage = typeof couponUsage.$inferInsert;

// Analytics and integration types
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type AccountingIntegration = typeof accountingIntegrations.$inferSelect;
export type InsertAccountingIntegration = typeof accountingIntegrations.$inferInsert;
export type GdprConsent = typeof gdprConsents.$inferSelect;
export type InsertGdprConsent = typeof gdprConsents.$inferInsert;

// Existing deliverable and business logic types
export type DeliverableTemplate = typeof deliverableTemplates.$inferSelect;
export type InsertDeliverableTemplate = typeof deliverableTemplates.$inferInsert;
export type DeliverableInstance = typeof deliverableInstances.$inferSelect;
export type InsertDeliverableInstance = typeof deliverableInstances.$inferInsert;
export type DeliverableAsset = typeof deliverableAssets.$inferSelect;
export type InsertDeliverableAsset = typeof deliverableAssets.$inferInsert;
export type TaxFileUpload = typeof taxFileUploads.$inferSelect;
export type InsertTaxFileUpload = typeof taxFileUploads.$inferInsert;
export type ForensicCase = typeof forensicCases.$inferSelect;
export type InsertForensicCase = typeof forensicCases.$inferInsert;
export type ForensicDocument = typeof forensicDocuments.$inferSelect;
export type InsertForensicDocument = typeof forensicDocuments.$inferInsert;
export type ForensicFinding = typeof forensicFindings.$inferSelect;
export type InsertForensicFinding = typeof forensicFindings.$inferInsert;
export type ScenarioPlaybook = typeof scenarioPlaybooks.$inferSelect;
export type InsertScenarioPlaybook = typeof scenarioPlaybooks.$inferInsert;
export type ScenarioVariant = typeof scenarioVariants.$inferSelect;
export type InsertScenarioVariant = typeof scenarioVariants.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
export type UsageQuota = typeof usageQuotas.$inferSelect;
export type InsertUsageQuota = typeof usageQuotas.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;