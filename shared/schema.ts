import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, index, uniqueIndex, real, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Check if pgvector is available (Railway doesn't support it)
// Using TEXT to store JSON-serialized embeddings as fallback
const PGVECTOR_AVAILABLE = process.env.PGVECTOR_ENABLED === 'true';

// Custom type for pgvector (falls back to TEXT for compatibility)
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    // Use TEXT for Railway compatibility, vector(1536) when pgvector is available
    return PGVECTOR_AVAILABLE ? 'vector(1536)' : 'text';
  },
  toDriver(value: number[]): string {
    return PGVECTOR_AVAILABLE ? `[${value.join(',')}]` : JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    if (PGVECTOR_AVAILABLE) {
      return JSON.parse(value.replace(/^\[/, '[').replace(/\]$/, ']'));
    }
    return JSON.parse(value);
  },
});

// Vector Embeddings table for persistent RAG (pgvector or TEXT fallback)
export const vectorEmbeddings = pgTable("vector_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  embedding: text("embedding").notNull(), // Using TEXT for Railway compatibility
  contentHash: text("content_hash").notNull(), // SHA-256 for deduplication
  documentType: text("document_type").notNull(), // 'regulation', 'case', 'procedure', 'document', 'calculation'
  source: text("source"), // 'IRS', 'FASB', 'IFRS', 'GST_ACT', etc.
  jurisdiction: text("jurisdiction"), // 'US', 'IN', 'UK', 'EU', etc.
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  tags: jsonb("tags").default([]),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  contentHashIdx: uniqueIndex("vector_embeddings_content_hash_idx").on(table.contentHash),
  documentTypeIdx: index("vector_embeddings_document_type_idx").on(table.documentType),
  jurisdictionIdx: index("vector_embeddings_jurisdiction_idx").on(table.jurisdiction),
  sourceIdx: index("vector_embeddings_source_idx").on(table.source),
}));

// Knowledge graph nodes for persistent graph storage
export const knowledgeNodes = pgTable("knowledge_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nodeType: text("node_type").notNull(), // 'concept', 'entity', 'regulation', 'case', 'procedure'
  label: text("label").notNull(),
  properties: jsonb("properties").default({}),
  source: text("source"),
  confidence: real("confidence").default(1.0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  nodeTypeIdx: index("knowledge_nodes_type_idx").on(table.nodeType),
  labelIdx: index("knowledge_nodes_label_idx").on(table.label),
}));

// Knowledge graph edges for relationships
export const knowledgeEdges = pgTable("knowledge_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromNodeId: varchar("from_node_id").notNull().references(() => knowledgeNodes.id, { onDelete: "cascade" }),
  toNodeId: varchar("to_node_id").notNull().references(() => knowledgeNodes.id, { onDelete: "cascade" }),
  edgeType: text("edge_type").notNull(), // 'related_to', 'part_of', 'depends_on', 'supersedes', 'references'
  weight: real("weight").default(1.0),
  properties: jsonb("properties").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  fromNodeIdx: index("knowledge_edges_from_idx").on(table.fromNodeId),
  toNodeIdx: index("knowledge_edges_to_idx").on(table.toNodeId),
  edgeTypeIdx: index("knowledge_edges_type_idx").on(table.edgeType),
}));

// Regulatory alerts for real-time monitoring
export const regulatoryAlerts = pgTable("regulatory_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  fullContent: text("full_content"),
  source: text("source").notNull(), // 'IRS', 'FASB', 'GST_COUNCIL', 'HMRC', etc.
  jurisdiction: text("jurisdiction").notNull(),
  alertType: text("alert_type").notNull(), // 'new_regulation', 'amendment', 'deadline', 'guidance'
  severity: text("severity").notNull().default("medium"), // 'low', 'medium', 'high', 'critical'
  effectiveDate: timestamp("effective_date"),
  externalUrl: text("external_url"),
  perplexityQuery: text("perplexity_query"), // Query used to fetch this
  isProcessed: boolean("is_processed").notNull().default(false),
  tags: jsonb("tags").default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  jurisdictionIdx: index("regulatory_alerts_jurisdiction_idx").on(table.jurisdiction),
  alertTypeIdx: index("regulatory_alerts_alert_type_idx").on(table.alertType),
  severityIdx: index("regulatory_alerts_severity_idx").on(table.severity),
  createdAtIdx: index("regulatory_alerts_created_at_idx").on(table.createdAt),
}));

// ===========================================
// SUPERINTELLIGENCE LEARNING TABLES
// ===========================================

// User feedback on individual messages (for continuous learning)
export const messageFeedback = pgTable("message_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars, or -1/+1 for thumbs
  feedbackType: text("feedback_type").notNull().default("rating"), // 'rating', 'thumbs', 'correction'
  comment: text("comment"), // Optional user comment
  correctedResponse: text("corrected_response"), // If user provided correction
  isHelpful: boolean("is_helpful"), // Thumbs up/down
  tags: jsonb("tags").default([]), // ['inaccurate', 'incomplete', 'hallucination', 'perfect']
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  messageIdIdx: index("message_feedback_message_id_idx").on(table.messageId),
  conversationIdIdx: index("message_feedback_conversation_id_idx").on(table.conversationId),
  userIdIdx: index("message_feedback_user_id_idx").on(table.userId),
  ratingIdx: index("message_feedback_rating_idx").on(table.rating),
  createdAtIdx: index("message_feedback_created_at_idx").on(table.createdAt),
}));

// Fine-tuning dataset for continuous model improvement
export const finetuningDataset = pgTable("finetuning_dataset", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "set null" }),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  
  // Training example format (OpenAI format)
  systemPrompt: text("system_prompt").notNull(),
  userMessage: text("user_message").notNull(),
  assistantResponse: text("assistant_response").notNull(),
  
  // Classification metadata
  domain: text("domain").notNull(), // 'tax', 'audit', 'financial_planning', 'compliance'
  jurisdiction: text("jurisdiction"), // 'US', 'IN', 'CA', 'UK', 'TR'
  complexity: text("complexity").notNull().default("standard"), // 'quick', 'standard', 'deep', 'calculation'
  chatMode: text("chat_mode"), // 'standard', 'deep-research', 'calculation', etc.
  
  // Quality metrics
  averageRating: real("average_rating"), // Aggregated from feedback
  feedbackCount: integer("feedback_count").notNull().default(0),
  qualityScore: real("quality_score"), // Computed quality (0-1)
  
  // Fine-tuning management
  isApproved: boolean("is_approved"), // Manual review - null means pending, no default
  isUsed: boolean("is_used").notNull().default(false), // Already used in fine-tuning
  usedInJobId: text("used_in_job_id"), // OpenAI fine-tuning job ID
  
  // Source tracking
  sourceType: text("source_type").notNull().default("interaction"), // 'interaction', 'feedback', 'manual'
  sourceId: text("source_id"), // Reference to source record
  
  // Review tracking
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  
  // Metadata
  tags: jsonb("tags").default([]),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  domainIdx: index("finetuning_dataset_domain_idx").on(table.domain),
  jurisdictionIdx: index("finetuning_dataset_jurisdiction_idx").on(table.jurisdiction),
  qualityScoreIdx: index("finetuning_dataset_quality_score_idx").on(table.qualityScore),
  isApprovedIdx: index("finetuning_dataset_is_approved_idx").on(table.isApproved),
  isUsedIdx: index("finetuning_dataset_is_used_idx").on(table.isUsed),
  createdAtIdx: index("finetuning_dataset_created_at_idx").on(table.createdAt),
}));

// Interaction logs for learning pipeline (full context capture)
export const interactionLogs = pgTable("interaction_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull(),
  
  // Query classification
  query: text("query").notNull(),
  queryClassification: jsonb("query_classification"), // Full triage result
  
  // Context used
  retrievedContextIds: jsonb("retrieved_context_ids").default([]), // Vector doc IDs used
  retrievedContextScores: jsonb("retrieved_context_scores").default([]), // Similarity scores
  
  // Response data
  response: text("response").notNull(),
  modelUsed: text("model_used"),
  tokensUsed: integer("tokens_used"),
  responseTimeMs: integer("response_time_ms"),
  
  // Quality tracking
  complianceResult: jsonb("compliance_result"), // From ComplianceSentinel
  userRating: integer("user_rating"), // Copied from feedback for quick access
  
  // Learning flags
  needsReview: boolean("needs_review").notNull().default(false),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  conversationIdIdx: index("interaction_logs_conversation_id_idx").on(table.conversationId),
  userIdIdx: index("interaction_logs_user_id_idx").on(table.userId),
  userRatingIdx: index("interaction_logs_user_rating_idx").on(table.userRating),
  needsReviewIdx: index("interaction_logs_needs_review_idx").on(table.needsReview),
  createdAtIdx: index("interaction_logs_created_at_idx").on(table.createdAt),
}));

// Note: Session table is managed by connect-pg-simple library (not Drizzle)
// Table name: user_sessions (created automatically by the library)

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  lastFailedLogin: timestamp("last_failed_login"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: text("mfa_secret"),
  mfaBackupCodes: text("mfa_backup_codes").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'business', 'personal', 'family'
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("profiles_user_id_idx").on(table.userId),
  typeIdx: index("profiles_type_idx").on(table.type),
  // Unique constraint: Only one personal profile per user
  uniquePersonalPerUser: uniqueIndex("profiles_user_personal_unique_idx")
    .on(table.userId)
    .where(sql`${table.type} = 'personal'`),
}));

export const profileMembers = pgTable("profile_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  relationship: text("relationship"), // 'spouse', 'child', 'parent', 'other'
  role: text("role").notNull().default("member"), // 'owner', 'admin', 'member', 'viewer'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  profileIdIdx: index("profile_members_profile_id_idx").on(table.profileId),
}));

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  profileId: varchar("profile_id").references(() => profiles.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  metadata: text("metadata"), // AI-generated subtitle describing conversation context
  preview: text("preview"),
  pinned: boolean("pinned").notNull().default(false),
  isShared: boolean("is_shared").notNull().default(false),
  sharedToken: varchar("shared_token").unique(),
  // User feedback fields - simple, direct user input (NOT calculated)
  qualityScore: integer("quality_score"), // 1-5 rating from user
  resolved: boolean("resolved").default(false), // Did this conversation resolve the user's issue?
  userFeedback: text("user_feedback"), // Optional text feedback from user
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdProfileIdUpdatedAtIdx: index("conversations_user_profile_updated_idx")
    .on(table.userId, table.profileId, table.updatedAt),
  pinnedIdx: index("conversations_pinned_idx").on(table.pinned),
  sharedTokenIdx: index("conversations_shared_token_idx").on(table.sharedToken),
  qualityScoreIdx: index("conversations_quality_score_idx").on(table.qualityScore),
  resolvedIdx: index("conversations_resolved_idx").on(table.resolved),
  // NEW: Index for search/filtering by metadata
  metadataIdx: index("conversations_metadata_idx").on(table.metadata),
  // NEW: Index for pagination by creation time
  userCreatedIdx: index("conversations_user_created_idx").on(table.userId, table.createdAt),
}));

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  modelUsed: text("model_used"),
  routingDecision: jsonb("routing_decision"),
  calculationResults: jsonb("calculation_results"),
  metadata: jsonb("metadata"),
  tokensUsed: integer("tokens_used"),
  excelFilename: text("excel_filename"),
  excelBuffer: text("excel_buffer"),
  artifactIds: jsonb("artifact_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // NEW: Index for fetching conversation messages with pagination
  conversationCreatedIdx: index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  // NEW: Index for analytics queries by user
  roleCreatedIdx: index("messages_role_created_idx").on(table.role, table.createdAt),
}));

/**
 * Rolling LLM-generated summary of older turns + an accumulated facts glossary.
 * One row per conversation. Regenerated every ~10 new turns so long conversations
 * don't lose early context when the raw-message window slides past turn 1.
 */
export const conversationSummaries = pgTable("conversation_summaries", {
  conversationId: varchar("conversation_id")
    .primaryKey()
    .references(() => conversations.id, { onDelete: "cascade" }),
  // LLM-generated paragraph summarising turns 1..coveredUpToTurn
  summaryText: text("summary_text").notNull(),
  // Highest turn index fully covered by the summary (0-based)
  coveredUpToTurn: integer("covered_up_to_turn").notNull(),
  // Accumulated entities/facts pulled from every turn so far
  //   { names: string[], amounts: string[], dates: string[], orgs: string[] }
  glossary: jsonb("glossary").$type<{
    names?: string[];
    amounts?: string[];
    dates?: string[];
    orgs?: string[];
  }>().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Per-turn conversation memory store with semantic-search embeddings.
 * Enables pgvector-based retrieval across the full history so long conversations
 * can surface relevant earlier turns by meaning, not just keywords.
 * The embedding column uses halfvec(3072) to match text-embedding-3-large
 * dimensionality while staying under pgvector's HNSW ~4000-dim ceiling.
 */
export const conversationMemoryEntries = pgTable("conversation_memory_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  turnIndex: integer("turn_index").notNull(),
  userMessage: text("user_message").notNull(),
  assistantMessage: text("assistant_message").notNull(),
  summary: text("summary").notNull(),
  topics: jsonb("topics").$type<string[]>().default([]),
  // embedding column is halfvec(3072) in DB; drizzle lacks a halfvec type so we
  // reference it as text and rely on raw SQL for inserts/queries.
  embedding: text("embedding"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const whiteboardArtifacts = pgTable("whiteboard_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  messageId: varchar("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  kind: text("kind").notNull(), // 'chart' | 'workflow' | 'mindmap' | 'flowchart' | 'spreadsheet' | 'checklist'
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").notNull(),
  // Mutable state separate from the immutable payload. Used by interactive artifacts
  // (currently only 'checklist') to track user/agent updates like which items are
  // checked. Shape depends on kind; for checklists: { checkedIds: string[], updatedAt: string }
  state: jsonb("state").$type<Record<string, unknown>>().default({}),
  canvasX: integer("canvas_x").notNull(),
  canvasY: integer("canvas_y").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  conversationSequenceIdx: index("whiteboard_conv_seq_idx")
    .on(table.conversationId, table.sequence),
  messageIdx: index("whiteboard_message_idx").on(table.messageId),
}));

export type WhiteboardArtifact = typeof whiteboardArtifacts.$inferSelect;
export type InsertWhiteboardArtifact = typeof whiteboardArtifacts.$inferInsert;

export const whiteboardArtifactKinds = [
  "checklist",
  "chart",
  "workflow",
  "mindmap",
  "flowchart",
  "spreadsheet",
] as const;
export type WhiteboardArtifactKind = typeof whiteboardArtifactKinds[number];

export const modelRoutingLogs = pgTable("model_routing_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  queryClassification: jsonb("query_classification").notNull(),
  selectedModel: text("selected_model").notNull(),
  routingReason: text("routing_reason"),
  confidence: integer("confidence"),
  alternativeModels: jsonb("alternative_models"),
  processingTimeMs: integer("processing_time_ms"),
  tokensUsed: integer("tokens_used"), // Total tokens consumed (prompt + completion)
  costUsd: integer("cost_usd"), // Cost in cents (divide by 100 for USD)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  queriesUsed: integer("queries_used").notNull().default(0),
  documentsAnalyzed: integer("documents_analyzed").notNull().default(0),
  tokensUsed: integer("tokens_used").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userLLMConfig = pgTable("user_llm_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  provider: text("provider").notNull().default("openai"),
  apiKey: text("api_key"),
  modelName: text("model_name"),
  endpoint: text("endpoint"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  category: text("category"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const ticketMessages = pgTable("ticket_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accountingIntegrations = pgTable("accounting_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  companyId: text("company_id"),
  companyName: text("company_name"),
  isActive: boolean("is_active").notNull().default(true),
  lastSync: timestamp("last_sync"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const gdprConsents = pgTable("gdpr_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  consentType: text("consent_type").notNull(),
  consented: boolean("consented").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const taxFileUploads = pgTable("tax_file_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vendor: text("vendor").notNull(), // 'drake', 'turbotax', 'hrblock', 'adp'
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  byteLength: integer("byte_length").notNull(),
  storageKey: text("storage_key").notNull(), // Encrypted file path/key
  encryptionNonce: text("encryption_nonce").notNull(), // IV for AES-256-GCM
  encryptedFileKey: text("encrypted_file_key").notNull(), // Per-file key encrypted with master key
  checksum: text("checksum").notNull(), // SHA-256 checksum for tamper detection
  scanStatus: text("scan_status").notNull().default("pending"), // 'pending', 'clean', 'infected', 'failed'
  scanDetails: jsonb("scan_details"),
  formType: text("form_type"), // '8949', 'client_data', 'w2', etc.
  importStatus: text("import_status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  importDetails: jsonb("import_details"),
  importedAt: timestamp("imported_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("tax_file_uploads_user_id_idx").on(table.userId),
  scanStatusIdx: index("tax_file_uploads_scan_status_idx").on(table.scanStatus),
  importStatusIdx: index("tax_file_uploads_import_status_idx").on(table.importStatus),
  vendorIdx: index("tax_file_uploads_vendor_idx").on(table.vendor),
}));

// Analytics Tables for AI Response Quality, Sentiment Analysis, and Behavior Prediction

export const conversationAnalytics = pgTable("conversation_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Quality Metrics
  qualityScore: integer("quality_score"), // 0-100
  responseRelevanceScore: integer("response_relevance_score"), // 0-100
  completenessScore: integer("completeness_score"), // 0-100
  clarityScore: integer("clarity_score"), // 0-100
  
  // Conversation Behavior Metrics
  totalMessages: integer("total_messages").notNull().default(0),
  averageResponseTime: integer("average_response_time"), // milliseconds
  conversationDuration: integer("conversation_duration"), // seconds
  wasAbandoned: boolean("was_abandoned").notNull().default(false),
  abandonmentPoint: integer("abandonment_point"), // message count when abandoned
  
  // User Satisfaction Indicators
  followUpQuestionCount: integer("follow_up_question_count").notNull().default(0),
  clarificationRequestCount: integer("clarification_request_count").notNull().default(0),
  userFrustrationDetected: boolean("user_frustration_detected").notNull().default(false),
  resolutionAchieved: boolean("resolution_achieved"),
  
  // Engagement Metrics
  topicsDiscussed: jsonb("topics_discussed"), // Array of topics
  domainCategories: jsonb("domain_categories"), // ['tax', 'audit', 'compliance', etc.]
  complexityLevel: text("complexity_level"), // 'simple', 'moderate', 'complex', 'expert'
  
  // AI Performance
  providerUsed: text("provider_used"), // Primary AI provider
  modelSwitchCount: integer("model_switch_count").notNull().default(0),
  fallbackTriggered: boolean("fallback_triggered").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  conversationIdIdx: index("conversation_analytics_conversation_id_idx").on(table.conversationId),
  userIdIdx: index("conversation_analytics_user_id_idx").on(table.userId),
  qualityScoreIdx: index("conversation_analytics_quality_score_idx").on(table.qualityScore),
  createdAtIdx: index("conversation_analytics_created_at_idx").on(table.createdAt),
}));

export const messageAnalytics = pgTable("message_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Sentiment Analysis
  userSentiment: text("user_sentiment"), // 'positive', 'neutral', 'negative', 'frustrated', 'satisfied'
  sentimentScore: integer("sentiment_score"), // -100 to 100
  emotionalTone: jsonb("emotional_tone"), // { anger: 0.1, joy: 0.7, etc. }
  
  // Message Quality (for assistant messages)
  responseQuality: integer("response_quality"), // 0-100
  accuracyScore: integer("accuracy_score"), // 0-100
  helpfulnessScore: integer("helpfulness_score"), // 0-100
  
  // User Intent Detection
  userIntent: text("user_intent"), // 'question', 'clarification', 'complaint', 'appreciation', etc.
  intentConfidence: integer("intent_confidence"), // 0-100
  
  // Response Characteristics
  responseLength: integer("response_length"), // characters
  technicalComplexity: text("technical_complexity"), // 'simple', 'moderate', 'advanced'
  containsCalculations: boolean("contains_calculations").notNull().default(false),
  containsCitations: boolean("contains_citations").notNull().default(false),
  
  // Timing
  processingTime: integer("processing_time"), // milliseconds
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  messageIdIdx: index("message_analytics_message_id_idx").on(table.messageId),
  conversationIdIdx: index("message_analytics_conversation_id_idx").on(table.conversationId),
  userIdIdx: index("message_analytics_user_id_idx").on(table.userId),
  sentimentIdx: index("message_analytics_sentiment_idx").on(table.userSentiment),
}));

export const userBehaviorPatterns = pgTable("user_behavior_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // Usage Patterns
  totalConversations: integer("total_conversations").notNull().default(0),
  averageConversationLength: integer("average_conversation_length"), // messages
  averageSessionDuration: integer("average_session_duration"), // minutes
  preferredTimeOfDay: text("preferred_time_of_day"), // 'morning', 'afternoon', 'evening', 'night'
  peakUsageDays: jsonb("peak_usage_days"), // Array of day names
  
  // Topic Preferences
  topTopics: jsonb("top_topics"), // Array of {topic: string, count: number}
  domainExpertise: jsonb("domain_expertise"), // {tax: 'intermediate', audit: 'beginner', etc.}
  
  // Engagement Metrics
  averageQualityScore: integer("average_quality_score"), // 0-100
  satisfactionTrend: text("satisfaction_trend"), // 'improving', 'declining', 'stable'
  churnRisk: text("churn_risk"), // 'low', 'medium', 'high'
  churnRiskScore: integer("churn_risk_score"), // 0-100
  
  // Behavioral Indicators
  frustrationFrequency: integer("frustration_frequency").notNull().default(0),
  abandonmentRate: integer("abandonment_rate"), // percentage
  followUpRate: integer("follow_up_rate"), // percentage
  
  // Predictions
  nextLikelyQuestion: text("next_likely_question"),
  nextLikelyTopic: text("next_likely_topic"),
  predictedReturnDate: timestamp("predicted_return_date"),
  
  // Value Indicators
  engagementScore: integer("engagement_score"), // 0-100
  potentialUpsellCandidate: boolean("potential_upsell_candidate").notNull().default(false),
  
  lastAnalyzedAt: timestamp("last_analyzed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("user_behavior_patterns_user_id_idx").on(table.userId),
  churnRiskIdx: index("user_behavior_patterns_churn_risk_idx").on(table.churnRisk),
  engagementScoreIdx: index("user_behavior_patterns_engagement_score_idx").on(table.engagementScore),
}));

export const sentimentTrends = pgTable("sentiment_trends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  
  // Aggregated Sentiment Metrics
  averageSentimentScore: integer("average_sentiment_score"), // -100 to 100
  positiveMessageCount: integer("positive_message_count").notNull().default(0),
  neutralMessageCount: integer("neutral_message_count").notNull().default(0),
  negativeMessageCount: integer("negative_message_count").notNull().default(0),
  frustratedMessageCount: integer("frustrated_message_count").notNull().default(0),
  
  // Quality Trends
  averageQualityScore: integer("average_quality_score"), // 0-100
  conversationCount: integer("conversation_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdDateIdx: index("sentiment_trends_user_id_date_idx").on(table.userId, table.date),
}));

// Guide test results — persistent multi-tester tracking for cagpt-guide.html
export const guideTestResults = pgTable("guide_test_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: text("test_id").notNull(),       // e.g. "conv-01"
  tester: text("tester").notNull(),         // testers display name (free text)
  status: text("status").notNull().default("pending"), // 'pass' | 'fail' | 'pending'
  notes: text("notes").default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  testIdIdx: index("guide_test_results_test_id_idx").on(table.testId),
  testerIdx: index("guide_test_results_tester_idx").on(table.tester),
  testIdTesterIdx: uniqueIndex("guide_test_results_test_id_tester_idx").on(table.testId, table.tester),
}));

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must not exceed 128 characters");

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
  name: z.string().min(1, "Name is required"),
});

export const insertProfileSchema = createInsertSchema(profiles).pick({
  userId: true,
  name: true,
  type: true,
  description: true,
  isDefault: true,
}).extend({
  name: z.string().min(1, "Profile name is required").max(100),
  type: z.enum(['business', 'personal', 'family']),
  description: z.string().max(500).optional(),
});

export const insertProfileMemberSchema = createInsertSchema(profileMembers).pick({
  profileId: true,
  name: true,
  email: true,
  relationship: true,
  role: true,
}).extend({
  name: z.string().min(1, "Member name is required").max(100),
  email: z.string().email().optional(),
  relationship: z.enum(['spouse', 'child', 'parent', 'other']).optional(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  userId: true,
  profileId: true,
  title: true,
  metadata: true,
  preview: true,
});

// Schema for updating conversation feedback (user ratings/feedback)
export const updateConversationFeedbackSchema = z.object({
  qualityScore: z.number().int().min(1).max(5).optional(),
  resolved: z.boolean().optional(),
  userFeedback: z.string().max(1000).optional(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
  modelUsed: true,
  tokensUsed: true,
}).extend({
  routingDecision: z.any().optional(),
  calculationResults: z.any().optional(),
  metadata: z.any().optional(),
});

export const insertUserLLMConfigSchema = createInsertSchema(userLLMConfig).pick({
  userId: true,
  provider: true,
  apiKey: true,
  modelName: true,
  endpoint: true,
  isEnabled: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).pick({
  userId: true,
  subject: true,
  description: true,
  priority: true,
  category: true,
}).extend({
  subject: z.string().min(1).max(200),
  description: z.string().min(10),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

export const insertTicketMessageSchema = createInsertSchema(ticketMessages).pick({
  ticketId: true,
  userId: true,
  message: true,
  isInternal: true,
});

export const insertAccountingIntegrationSchema = createInsertSchema(accountingIntegrations).pick({
  userId: true,
  provider: true,
  accessToken: true,
  refreshToken: true,
  tokenExpiry: true,
  companyId: true,
  companyName: true,
});

export const insertTaxFileUploadSchema = createInsertSchema(taxFileUploads).pick({
  userId: true,
  vendor: true,
  filename: true,
  originalFilename: true,
  mimeType: true,
  byteLength: true,
  storageKey: true,
  encryptionNonce: true,
  encryptedFileKey: true,
  checksum: true,
  formType: true,
}).extend({
  vendor: z.enum(['drake', 'turbotax', 'hrblock', 'adp']),
  mimeType: z.enum(['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']),
  byteLength: z.number().max(50 * 1024 * 1024), // 50MB max
});

export const insertConversationAnalyticsSchema = createInsertSchema(conversationAnalytics).pick({
  conversationId: true,
  userId: true,
  qualityScore: true,
  responseRelevanceScore: true,
  completenessScore: true,
  clarityScore: true,
  totalMessages: true,
  averageResponseTime: true,
  conversationDuration: true,
  wasAbandoned: true,
  abandonmentPoint: true,
  followUpQuestionCount: true,
  clarificationRequestCount: true,
  userFrustrationDetected: true,
  resolutionAchieved: true,
  topicsDiscussed: true,
  domainCategories: true,
  complexityLevel: true,
  providerUsed: true,
  modelSwitchCount: true,
  fallbackTriggered: true,
});

export const insertMessageAnalyticsSchema = createInsertSchema(messageAnalytics).pick({
  messageId: true,
  conversationId: true,
  userId: true,
  userSentiment: true,
  sentimentScore: true,
  emotionalTone: true,
  responseQuality: true,
  accuracyScore: true,
  helpfulnessScore: true,
  userIntent: true,
  intentConfidence: true,
  responseLength: true,
  technicalComplexity: true,
  containsCalculations: true,
  containsCitations: true,
  processingTime: true,
});

export const insertUserBehaviorPatternsSchema = createInsertSchema(userBehaviorPatterns).pick({
  userId: true,
  totalConversations: true,
  averageConversationLength: true,
  averageSessionDuration: true,
  preferredTimeOfDay: true,
  peakUsageDays: true,
  topTopics: true,
  domainExpertise: true,
  averageQualityScore: true,
  satisfactionTrend: true,
  churnRisk: true,
  churnRiskScore: true,
  frustrationFrequency: true,
  abandonmentRate: true,
  followUpRate: true,
  nextLikelyQuestion: true,
  nextLikelyTopic: true,
  predictedReturnDate: true,
  engagementScore: true,
  potentialUpsellCandidate: true,
});

export const insertSentimentTrendsSchema = createInsertSchema(sentimentTrends).pick({
  userId: true,
  date: true,
  averageSentimentScore: true,
  positiveMessageCount: true,
  neutralMessageCount: true,
  negativeMessageCount: true,
  frustratedMessageCount: true,
  averageQualityScore: true,
  conversationCount: true,
});

// ============================================================================
// MVP FEATURES: Regulatory Scenario Simulator
// ============================================================================

export const scenarioPlaybooks = pgTable("scenario_playbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  profileId: varchar("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // 'tax_strategy', 'entity_comparison', 'deduction_analysis', 'audit_risk'
  
  // Master scenario configuration
  baselineConfig: jsonb("baseline_config").notNull(), // jurisdiction, entityType, taxYear, income, etc.
  
  isTemplate: boolean("is_template").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdProfileIdIdx: index("scenario_playbooks_user_profile_idx").on(table.userId, table.profileId),
  categoryIdx: index("scenario_playbooks_category_idx").on(table.category),
}));

export const scenarioVariants = pgTable("scenario_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playbookId: varchar("playbook_id").notNull().references(() => scenarioPlaybooks.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  description: text("description"),
  isBaseline: boolean("is_baseline").notNull().default(false),
  
  // Variant-specific assumptions and variables
  assumptions: jsonb("assumptions").notNull(), // overrides/extends baseline config
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  playbookIdBaselineIdx: index("scenario_variants_playbook_baseline_idx").on(table.playbookId, table.isBaseline),
}));

export const scenarioRuns = pgTable("scenario_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  variantId: varchar("variant_id").notNull().references(() => scenarioVariants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  
  // Solver execution metadata
  solversUsed: jsonb("solvers_used"), // Array of solver names
  modelUsed: text("model_used"),
  providerUsed: text("provider_used"),
  
  // Results summary
  resultsSnapshot: jsonb("results_snapshot"), // Complete calculation results
  errorDetails: jsonb("error_details"),
  
  processingTimeMs: integer("processing_time_ms"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  variantIdIdx: index("scenario_runs_variant_id_idx").on(table.variantId),
  statusIdx: index("scenario_runs_status_idx").on(table.status),
}));

export const scenarioMetrics = pgTable("scenario_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => scenarioRuns.id, { onDelete: "cascade" }),
  
  metricKey: text("metric_key").notNull(), // 'total_tax_liability', 'effective_rate', 'qbi_deduction', 'audit_risk_score'
  metricCategory: text("metric_category"), // 'tax', 'financial', 'risk', 'compliance'
  
  // Materialized values for fast comparison
  numericValue: integer("numeric_value"),
  percentageValue: integer("percentage_value"), // stored as basis points (1% = 100)
  currencyValue: integer("currency_value"), // stored as cents
  
  // Full details
  detailsJson: jsonb("details_json"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  runIdMetricKeyIdx: index("scenario_metrics_run_metric_idx").on(table.runId, table.metricKey),
  categoryIdx: index("scenario_metrics_category_idx").on(table.metricCategory),
}));

export const scenarioComparisons = pgTable("scenario_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playbookId: varchar("playbook_id").notNull().references(() => scenarioPlaybooks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  leftRunId: varchar("left_run_id").notNull().references(() => scenarioRuns.id, { onDelete: "cascade" }),
  rightRunId: varchar("right_run_id").notNull().references(() => scenarioRuns.id, { onDelete: "cascade" }),
  
  // Pairwise comparison snapshot
  comparisonSnapshot: jsonb("comparison_snapshot").notNull(), // side-by-side metrics, deltas, recommendations
  
  // Presentation metadata
  title: text("title"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  playbookIdIdx: index("scenario_comparisons_playbook_idx").on(table.playbookId),
  leftRightIdx: index("scenario_comparisons_runs_idx").on(table.leftRunId, table.rightRunId),
}));

export const scenarioShares = pgTable("scenario_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playbookId: varchar("playbook_id").references(() => scenarioPlaybooks.id, { onDelete: "cascade" }),
  comparisonId: varchar("comparison_id").references(() => scenarioComparisons.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  shareToken: varchar("share_token").notNull().unique(),
  expiresAt: timestamp("expires_at"),
  
  viewCount: integer("view_count").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  shareTokenIdx: index("scenario_shares_token_idx").on(table.shareToken),
  playbookIdIdx: index("scenario_shares_playbook_idx").on(table.playbookId),
}));

export const scenarioConversationLinks = pgTable("scenario_conversation_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scenarioId: varchar("scenario_id").notNull().references(() => scenarioPlaybooks.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  scenarioConversationIdx: index("scenario_conversation_links_idx").on(table.scenarioId, table.conversationId),
}));

// ============================================================================
// MVP FEATURES: Client Deliverable Composer
// ============================================================================

export const deliverableTemplates = pgTable("deliverable_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "cascade" }), // null = system template
  
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'audit_plan', 'tax_memo', 'checklist', 'board_presentation', 'client_letter'
  category: text("category"), // 'tax', 'audit', 'compliance', 'advisory'
  
  // Template structure
  contentTemplate: text("content_template").notNull(), // Markdown with {{variables}}
  variableSchema: jsonb("variable_schema").notNull(), // JSON schema for variables
  
  // Styling and formatting
  styleConfig: jsonb("style_config"), // fonts, colors, layout preferences
  
  isSystem: boolean("is_system").notNull().default(false), // system vs user-created
  isDefault: boolean("is_default").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(false),
  
  usageCount: integer("usage_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  ownerTypeDefaultIdx: index("deliverable_templates_owner_type_default_idx")
    .on(table.ownerUserId, table.type, table.isDefault),
  typeIdx: index("deliverable_templates_type_idx").on(table.type),
}));

export const deliverableInstances = pgTable("deliverable_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  profileId: varchar("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  templateId: varchar("template_id").references(() => deliverableTemplates.id, { onDelete: "set null" }),
  
  title: text("title").notNull(),
  type: text("type").notNull(),
  
  status: text("status").notNull().default("draft"), // 'draft', 'generated', 'finalized', 'archived'
  
  // Content
  contentMarkdown: text("content_markdown").notNull(),
  variableValues: jsonb("variable_values"), // actual values used
  
  // Citations and sources
  citationSummary: jsonb("citation_summary"), // sources, regulations, standards referenced
  
  // AI generation metadata
  generatedWithChatMode: text("generated_with_chat_mode"),
  modelUsed: text("model_used"),
  tokensUsed: integer("tokens_used"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at"),
}, (table) => ({
  userProfileStatusIdx: index("deliverable_instances_user_profile_status_idx")
    .on(table.userId, table.profileId, table.status, table.updatedAt),
  conversationIdIdx: index("deliverable_instances_conversation_idx").on(table.conversationId),
}));

export const deliverableVersions = pgTable("deliverable_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull().references(() => deliverableInstances.id, { onDelete: "cascade" }),
  
  versionNumber: integer("version_number").notNull(),
  contentMarkdown: text("content_markdown").notNull(),
  changeDescription: text("change_description"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  instanceIdCreatedIdx: index("deliverable_versions_instance_created_idx")
    .on(table.instanceId, table.createdAt),
}));

export const deliverableAssets = pgTable("deliverable_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull().references(() => deliverableInstances.id, { onDelete: "cascade" }),
  versionId: varchar("version_id").references(() => deliverableVersions.id, { onDelete: "cascade" }),
  
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(), // 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'
  format: text("format").notNull(), // 'docx', 'pdf'
  
  storageKey: text("storage_key").notNull(),
  checksum: text("checksum").notNull(), // SHA-256
  byteLength: integer("byte_length").notNull(),
  
  downloadCount: integer("download_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  instanceIdIdx: index("deliverable_assets_instance_idx").on(table.instanceId),
}));

export const deliverableShares = pgTable("deliverable_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull().references(() => deliverableInstances.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  shareToken: varchar("share_token").notNull().unique(),
  recipientEmail: text("recipient_email"),
  expiresAt: timestamp("expires_at"),
  
  viewCount: integer("view_count").notNull().default(0),
  downloadCount: integer("download_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  shareTokenIdx: index("deliverable_shares_token_idx").on(table.shareToken),
  instanceIdIdx: index("deliverable_shares_instance_idx").on(table.instanceId),
}));

// ============================================================================
// MVP FEATURES: Forensic Document Intelligence
// ============================================================================

export const forensicCases = pgTable("forensic_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  profileId: varchar("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"), // 'revenue_analysis', 'expense_audit', 'reconciliation', 'fraud_detection'
  
  status: text("status").notNull().default("active"), // 'active', 'investigating', 'resolved', 'archived'
  
  // Scope metadata
  scopeMetadata: jsonb("scope_metadata"), // time period, entities involved, document types
  
  // Risk assessment
  overallRiskScore: integer("overall_risk_score"), // 0-100
  severityLevel: text("severity_level"), // 'low', 'medium', 'high', 'critical'
  
  // Summary stats
  totalDocuments: integer("total_documents").notNull().default(0),
  totalFindings: integer("total_findings").notNull().default(0),
  criticalFindings: integer("critical_findings").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  userProfileStatusIdx: index("forensic_cases_user_profile_status_idx")
    .on(table.userId, table.profileId, table.status),
  severityIdx: index("forensic_cases_severity_idx").on(table.severityLevel),
}));

export const forensicDocuments = pgTable("forensic_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => forensicCases.id, { onDelete: "cascade" }),
  
  // Source reference
  sourceType: text("source_type").notNull(), // 'upload', 'accounting_integration', 'tax_file'
  sourceId: varchar("source_id"), // reference to taxFileUploads.id or other source
  
  filename: text("filename").notNull(),
  documentType: text("document_type"), // 'invoice', 'receipt', 'bank_statement', 'w2', '1099', 'p_and_l', 'balance_sheet'
  
  // Extracted data (from Azure Document Intelligence)
  extractedData: jsonb("extracted_data").notNull(),
  documentMetadata: jsonb("document_metadata"), // confidence scores, field counts, etc.
  
  // Analysis status
  analysisStatus: text("analysis_status").notNull().default("pending"), // 'pending', 'analyzed', 'flagged', 'cleared'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  caseIdSourceIdx: index("forensic_documents_case_source_idx").on(table.caseId, table.sourceType),
  documentTypeIdx: index("forensic_documents_type_idx").on(table.documentType),
}));

export const forensicFindings = pgTable("forensic_findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => forensicCases.id, { onDelete: "cascade" }),
  documentId: varchar("document_id").references(() => forensicDocuments.id, { onDelete: "cascade" }),
  
  findingType: text("finding_type").notNull(), // 'mismatch', 'anomaly', 'missing_data', 'inconsistency', 'pattern_violation'
  severity: text("severity").notNull(), // 'info', 'low', 'medium', 'high', 'critical'
  
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  // Impacted metrics
  impactedMetrics: jsonb("impacted_metrics"), // {revenue: -27000, accounts_receivable: +15000}
  
  // Supporting details
  evidenceDetails: jsonb("evidence_details"), // specific values, field references, calculations
  remediationJson: jsonb("remediation_json"), // suggested fixes, next steps
  
  // Status tracking
  status: text("status").notNull().default("new"), // 'new', 'investigating', 'confirmed', 'false_positive', 'resolved'
  resolution: text("resolution"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  caseSeverityIdx: index("forensic_findings_case_severity_idx").on(table.caseId, table.severity),
  statusIdx: index("forensic_findings_status_idx").on(table.status),
}));

export const forensicReconciliations = pgTable("forensic_reconciliations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => forensicCases.id, { onDelete: "cascade" }),
  
  // Cross-document pairings
  sourceDocumentId: varchar("source_document_id").notNull().references(() => forensicDocuments.id, { onDelete: "cascade" }),
  targetDocumentId: varchar("target_document_id").notNull().references(() => forensicDocuments.id, { onDelete: "cascade" }),
  
  reconciliationType: text("reconciliation_type").notNull(), // 'invoice_to_payment', 'revenue_to_deposit', 'expense_to_receipt'
  
  status: text("status").notNull().default("pending"), // 'pending', 'matched', 'mismatched', 'partial_match'
  
  // Variance tracking
  expectedValue: integer("expected_value"), // in cents
  actualValue: integer("actual_value"), // in cents
  varianceAmount: integer("variance_amount"), // in cents
  variancePercentage: integer("variance_percentage"), // basis points
  
  // Analysis results
  reconciliationDetails: jsonb("reconciliation_details"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  caseStatusIdx: index("forensic_reconciliations_case_status_idx").on(table.caseId, table.status),
  documentsIdx: index("forensic_reconciliations_documents_idx").on(table.sourceDocumentId, table.targetDocumentId),
}));

export const forensicEvidence = pgTable("forensic_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  findingId: varchar("finding_id").notNull().references(() => forensicFindings.id, { onDelete: "cascade" }),
  documentId: varchar("document_id").references(() => forensicDocuments.id, { onDelete: "cascade" }),
  
  evidenceType: text("evidence_type").notNull(), // 'field_value', 'calculation', 'pattern', 'table_extract'
  
  // Supporting data
  snippetText: text("snippet_text"),
  dataExtract: jsonb("data_extract"), // structured data supporting the finding
  
  // Reference information
  pageNumber: integer("page_number"),
  fieldReference: text("field_reference"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  findingIdIdx: index("forensic_evidence_finding_idx").on(table.findingId),
}));

// ============================================================================
// Document Attachment Schema (for temporary chat file uploads)
// ============================================================================

// Stored in-memory with 24h retention, not persisted to database
export const documentAttachmentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  conversationId: z.string().nullable(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  storageKey: z.string(), // encrypted storage key
  checksum: z.string(), // SHA-256 for integrity
  uploadedAt: z.date(),
  expiresAt: z.date(), // 24h retention
});

export type DocumentAttachment = z.infer<typeof documentAttachmentSchema>;

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type ProfileMember = typeof profileMembers.$inferSelect;
export type InsertProfileMember = z.infer<typeof insertProfileMemberSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ModelRoutingLog = typeof modelRoutingLogs.$inferSelect;
export type UsageTracking = typeof usageTracking.$inferSelect;
export type UserLLMConfig = typeof userLLMConfig.$inferSelect;
export type InsertUserLLMConfig = z.infer<typeof insertUserLLMConfigSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
export type AccountingIntegration = typeof accountingIntegrations.$inferSelect;
export type InsertAccountingIntegration = z.infer<typeof insertAccountingIntegrationSchema>;
export type GdprConsent = typeof gdprConsents.$inferSelect;
export type TaxFileUpload = typeof taxFileUploads.$inferSelect;
export type InsertTaxFileUpload = z.infer<typeof insertTaxFileUploadSchema>;

// Analytics Types
export type ConversationAnalytics = typeof conversationAnalytics.$inferSelect;
export type InsertConversationAnalytics = z.infer<typeof insertConversationAnalyticsSchema>;
export type MessageAnalytics = typeof messageAnalytics.$inferSelect;
export type InsertMessageAnalytics = z.infer<typeof insertMessageAnalyticsSchema>;
export type UserBehaviorPatterns = typeof userBehaviorPatterns.$inferSelect;
export type InsertUserBehaviorPatterns = z.infer<typeof insertUserBehaviorPatternsSchema>;
export type SentimentTrends = typeof sentimentTrends.$inferSelect;
export type InsertSentimentTrends = z.infer<typeof insertSentimentTrendsSchema>;

// ============================================================================
// MVP FEATURES: Insert Schemas and Types
// ============================================================================

// Scenario Simulator
export const insertScenarioPlaybookSchema = createInsertSchema(scenarioPlaybooks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertScenarioVariantSchema = createInsertSchema(scenarioVariants).omit({ id: true, createdAt: true });
export const insertScenarioRunSchema = createInsertSchema(scenarioRuns).omit({ id: true, createdAt: true });
export const insertScenarioMetricSchema = createInsertSchema(scenarioMetrics).omit({ id: true, createdAt: true });
export const insertScenarioComparisonSchema = createInsertSchema(scenarioComparisons).omit({ id: true, createdAt: true });
export const insertScenarioShareSchema = createInsertSchema(scenarioShares).omit({ id: true, createdAt: true });
export const insertScenarioConversationLinkSchema = createInsertSchema(scenarioConversationLinks).omit({ id: true, createdAt: true });

export type ScenarioPlaybook = typeof scenarioPlaybooks.$inferSelect;
export type InsertScenarioPlaybook = z.infer<typeof insertScenarioPlaybookSchema>;
export type ScenarioVariant = typeof scenarioVariants.$inferSelect;
export type InsertScenarioVariant = z.infer<typeof insertScenarioVariantSchema>;
export type ScenarioRun = typeof scenarioRuns.$inferSelect;
export type InsertScenarioRun = z.infer<typeof insertScenarioRunSchema>;
export type ScenarioMetric = typeof scenarioMetrics.$inferSelect;
export type InsertScenarioMetric = z.infer<typeof insertScenarioMetricSchema>;
export type ScenarioComparison = typeof scenarioComparisons.$inferSelect;
export type InsertScenarioComparison = z.infer<typeof insertScenarioComparisonSchema>;
export type ScenarioShare = typeof scenarioShares.$inferSelect;
export type InsertScenarioShare = z.infer<typeof insertScenarioShareSchema>;
export type ScenarioConversationLink = typeof scenarioConversationLinks.$inferSelect;
export type InsertScenarioConversationLink = z.infer<typeof insertScenarioConversationLinkSchema>;

// Deliverable Composer
export const insertDeliverableTemplateSchema = createInsertSchema(deliverableTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDeliverableInstanceSchema = createInsertSchema(deliverableInstances).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDeliverableVersionSchema = createInsertSchema(deliverableVersions).omit({ id: true, createdAt: true });
export const insertDeliverableAssetSchema = createInsertSchema(deliverableAssets).omit({ id: true, createdAt: true });
export const insertDeliverableShareSchema = createInsertSchema(deliverableShares).omit({ id: true, createdAt: true });

export type DeliverableTemplate = typeof deliverableTemplates.$inferSelect;
export type InsertDeliverableTemplate = z.infer<typeof insertDeliverableTemplateSchema>;
export type DeliverableInstance = typeof deliverableInstances.$inferSelect;
export type InsertDeliverableInstance = z.infer<typeof insertDeliverableInstanceSchema>;
export type DeliverableVersion = typeof deliverableVersions.$inferSelect;
export type InsertDeliverableVersion = z.infer<typeof insertDeliverableVersionSchema>;
export type DeliverableAsset = typeof deliverableAssets.$inferSelect;
export type InsertDeliverableAsset = z.infer<typeof insertDeliverableAssetSchema>;
export type DeliverableShare = typeof deliverableShares.$inferSelect;
export type InsertDeliverableShare = z.infer<typeof insertDeliverableShareSchema>;

// Forensic Document Intelligence
export const insertForensicCaseSchema = createInsertSchema(forensicCases).omit({ id: true, createdAt: true, updatedAt: true });
export const insertForensicDocumentSchema = createInsertSchema(forensicDocuments).omit({ id: true, createdAt: true });
export const insertForensicFindingSchema = createInsertSchema(forensicFindings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertForensicReconciliationSchema = createInsertSchema(forensicReconciliations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertForensicEvidenceSchema = createInsertSchema(forensicEvidence).omit({ id: true, createdAt: true });

export type ForensicCase = typeof forensicCases.$inferSelect;
export type InsertForensicCase = z.infer<typeof insertForensicCaseSchema>;
export type ForensicDocument = typeof forensicDocuments.$inferSelect;
export type InsertForensicDocument = z.infer<typeof insertForensicDocumentSchema>;
export type ForensicFinding = typeof forensicFindings.$inferSelect;
export type InsertForensicFinding = z.infer<typeof insertForensicFindingSchema>;
export type ForensicReconciliation = typeof forensicReconciliations.$inferSelect;
export type InsertForensicReconciliation = z.infer<typeof insertForensicReconciliationSchema>;
export type ForensicEvidence = typeof forensicEvidence.$inferSelect;
export type InsertForensicEvidence = z.infer<typeof insertForensicEvidenceSchema>;

// Payment & Subscription Management
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(), // 'free', 'plus', 'professional', 'enterprise'
  status: text("status").notNull().default("active"), // 'active', 'cancelled', 'expired', 'past_due'
  billingCycle: text("billing_cycle"), // 'monthly', 'annual'
  amount: integer("amount"), // Amount in smallest currency unit (paise for INR, cents for USD)
  currency: text("currency").default("USD"), // 'USD', 'INR', 'AED', 'CAD', 'IDR', 'TRY'
  paymentGateway: text("payment_gateway"), // 'cashfree', 'razorpay'
  gatewaySubscriptionId: text("gateway_subscription_id"), // Cashfree or Razorpay subscription ID
  gatewayCustomerId: text("gateway_customer_id"), // Customer ID in payment gateway
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAt: timestamp("cancel_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("subscriptions_user_id_idx").on(table.userId),
  statusIdx: index("subscriptions_status_idx").on(table.status),
  gatewaySubscriptionIdIdx: index("subscriptions_gateway_subscription_id_idx").on(table.gatewaySubscriptionId),
}));

export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: text("discount_type").notNull(), // 'percentage', 'fixed'
  discountValue: integer("discount_value").notNull(), // Percentage (e.g., 25 for 25%) or fixed amount in cents
  currency: text("currency"), // Required for 'fixed' type discounts
  minPurchaseAmount: integer("min_purchase_amount"), // Minimum purchase amount in cents
  maxDiscountAmount: integer("max_discount_amount"), // Max discount cap in cents (for percentage)
  applicablePlans: text("applicable_plans").array(), // ['plus', 'professional', 'enterprise'] or null for all
  applicableCurrencies: text("applicable_currencies").array(), // ['USD', 'INR'] or null for all
  maxUses: integer("max_uses"), // null for unlimited
  maxUsesPerUser: integer("max_uses_per_user").default(1),
  usageCount: integer("usage_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  validFrom: timestamp("valid_from").notNull().defaultNow(),
  validUntil: timestamp("valid_until"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  codeIdx: index("coupons_code_idx").on(table.code),
  isActiveIdx: index("coupons_is_active_idx").on(table.isActive),
  validUntilIdx: index("coupons_valid_until_idx").on(table.validUntil),
}));

export const couponUsage = pgTable("coupon_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  discountAmount: integer("discount_amount").notNull(), // Actual discount applied in cents
  usedAt: timestamp("used_at").notNull().defaultNow(),
}, (table) => ({
  couponIdIdx: index("coupon_usage_coupon_id_idx").on(table.couponId),
  userIdIdx: index("coupon_usage_user_id_idx").on(table.userId),
  uniqueUserCoupon: uniqueIndex("coupon_usage_unique_user_coupon_idx").on(table.couponId, table.userId),
}));

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(), // Amount in smallest currency unit
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"), // 'pending', 'successful', 'failed', 'refunded'
  paymentMethod: text("payment_method"), // 'card', 'upi', 'netbanking', 'wallet'
  paymentGateway: text("payment_gateway"), // 'cashfree', 'razorpay'
  gatewayOrderId: text("gateway_order_id"), // Cashfree order_id or Razorpay order_id
  gatewayPaymentId: text("gateway_payment_id").unique(), // Unique to ensure idempotency
  gatewaySignature: text("gateway_signature"),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("payments_user_id_idx").on(table.userId),
  subscriptionIdIdx: index("payments_subscription_id_idx").on(table.subscriptionId),
  statusIdx: index("payments_status_idx").on(table.status),
  gatewayOrderIdIdx: index("payments_gateway_order_id_idx").on(table.gatewayOrderId),
  gatewayPaymentIdIdx: uniqueIndex("payments_gateway_payment_id_idx").on(table.gatewayPaymentId),
}));

export const usageQuotas = pgTable("usage_quotas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  plan: text("plan").notNull().default("free"),
  queriesLimit: integer("queries_limit").notNull().default(500), // -1 for unlimited
  queriesUsed: integer("queries_used").notNull().default(0),
  documentsLimit: integer("documents_limit").notNull().default(10), // -1 for unlimited
  documentsUsed: integer("documents_used").notNull().default(0),
  profilesLimit: integer("profiles_limit").notNull().default(1),
  scenariosLimit: integer("scenarios_limit").notNull().default(0), // 0 for none, -1 for unlimited
  scenariosUsed: integer("scenarios_used").notNull().default(0),
  deliverablesLimit: integer("deliverables_limit").notNull().default(0),
  deliverablesUsed: integer("deliverables_used").notNull().default(0),
  // Stack/WealthWise Academy quotas
  stackLessonsLimit: integer("stack_lessons_limit").notNull().default(5), // -1 for unlimited, 5 for free tier
  stackLessonsUsed: integer("stack_lessons_used").notNull().default(0),
  resetAt: timestamp("reset_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("usage_quotas_user_id_idx").on(table.userId),
  planIdx: index("usage_quotas_plan_idx").on(table.plan),
}));

// API Keys for programmatic access
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // User-friendly name like "Production API"
  keyHash: text("key_hash").notNull().unique(), // SHA-256 hash of the key
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for identification (e.g., "luca_1234")
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
  expiresAt: timestamp("expires_at"),
  permissions: jsonb("permissions").default(['read']), // ['read', 'write', 'admin']
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("api_keys_user_id_idx").on(table.userId),
  keyHashIdx: uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
  keyPrefixIdx: index("api_keys_key_prefix_idx").on(table.keyPrefix),
}));

// White-label configuration for custom branding
export const whiteLabelConfigs = pgTable("white_label_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  companyName: text("company_name").notNull(),
  companyLogo: text("company_logo"), // URL or base64
  primaryColor: text("primary_color").notNull().default("#3B82F6"),
  secondaryColor: text("secondary_color").notNull().default("#10B981"),
  customDomain: text("custom_domain"),
  emailFooter: text("email_footer"), // Custom footer for reports
  reportHeader: text("report_header"), // Custom header text for reports
  reportFooter: text("report_footer"), // Custom footer text for reports
  enableWatermark: boolean("enable_watermark").notNull().default(true),
  watermarkText: text("watermark_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("white_label_configs_user_id_idx").on(table.userId),
  customDomainIdx: uniqueIndex("white_label_configs_custom_domain_idx").on(table.customDomain),
}));

// System Alerts for monitoring
export const systemAlerts = pgTable("system_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'error', 'warning', 'info', 'success'
  severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'
  source: text("source").notNull(), // 'API', 'Database', 'AI Provider', 'Job Queue', etc.
  sourceId: text("source_id"), // Optional identifier from source system for deduplication
  message: text("message").notNull(),
  details: jsonb("details"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  typeIdx: index("system_alerts_type_idx").on(table.type),
  severityIdx: index("system_alerts_severity_idx").on(table.severity),
  acknowledgedIdx: index("system_alerts_acknowledged_idx").on(table.acknowledged),
  createdAtIdx: index("system_alerts_created_at_idx").on(table.createdAt),
  // Unique index to prevent duplicate alerts within 1 hour
  uniqueAlertIdx: index("system_alerts_unique_idx").on(table.source, table.sourceId, table.message),
}));

// Audit Log for super admin actions (compliance requirement)
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // 'acknowledge_alert', 'resolve_alert', 'execute_maintenance', etc.
  resourceType: text("resource_type").notNull(), // 'alert', 'maintenance_task', 'user', 'system'
  resourceId: text("resource_id"), // ID of the affected resource
  details: jsonb("details"), // Action-specific details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
  timestampIdx: index("audit_logs_timestamp_idx").on(table.timestamp),
}));

// Maintenance Tasks for system operations
export const maintenanceTasks = pgTable("maintenance_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  taskType: text("task_type").notNull(), // 'cleanup', 'backup', 'optimization', 'migration'
  schedule: text("schedule"), // Cron expression or description
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'running', 'completed', 'failed', 'cancelled'
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  duration: integer("duration"), // Duration in seconds
  result: jsonb("result"), // Result details
  error: text("error"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("maintenance_tasks_status_idx").on(table.status),
  taskTypeIdx: index("maintenance_tasks_type_idx").on(table.taskType),
  nextRunIdx: index("maintenance_tasks_next_run_idx").on(table.nextRunAt),
}));

// AI Provider Costs tracking
export const aiProviderCosts = pgTable("ai_provider_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  provider: text("provider").notNull(), // 'openai', 'anthropic', 'google', 'azure-openai'
  model: text("model").notNull(),
  tokensUsed: integer("tokens_used").notNull(),
  costUsd: integer("cost_usd").notNull(), // Cost in cents (to avoid decimals)
  requestCount: integer("request_count").notNull(),
  userId: varchar("user_id").references(() => users.id),
  subscriptionTier: text("subscription_tier"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  dateIdx: index("ai_provider_costs_date_idx").on(table.date),
  providerIdx: index("ai_provider_costs_provider_idx").on(table.provider),
  userIdIdx: index("ai_provider_costs_user_id_idx").on(table.userId),
  tierIdx: index("ai_provider_costs_tier_idx").on(table.subscriptionTier),
}));

// Lenders removed


// Products and Eligibility removed


// Rate Slabs and Schemes removed


// Profiles, Inquiries and Leads removed


// Rate Sheets removed


// Finance Learner tables removed


// Learning tracking removed


// Remaining Learning tables removed


// Dynamic Loan Notifications removed

// Schemas and Types removed


// Insert schemas for payment tables
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUsageQuotaSchema = createInsertSchema(usageQuotas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, updatedAt: true, usageCount: true });
export const insertCouponUsageSchema = createInsertSchema(couponUsage).omit({ id: true, usedAt: true });
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWhiteLabelConfigSchema = createInsertSchema(whiteLabelConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSystemAlertSchema = createInsertSchema(systemAlerts).omit({ id: true, createdAt: true });
export const insertMaintenanceTaskSchema = createInsertSchema(maintenanceTasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAIProviderCostSchema = createInsertSchema(aiProviderCosts).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });

// Types for payment tables
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type UsageQuota = typeof usageQuotas.$inferSelect;
export type InsertUsageQuota = z.infer<typeof insertUsageQuotaSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type CouponUsage = typeof couponUsage.$inferSelect;
export type InsertCouponUsage = z.infer<typeof insertCouponUsageSchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type WhiteLabelConfig = typeof whiteLabelConfigs.$inferSelect;
export type InsertWhiteLabelConfig = z.infer<typeof insertWhiteLabelConfigSchema>;
export type SystemAlert = typeof systemAlerts.$inferSelect;
export type InsertSystemAlert = z.infer<typeof insertSystemAlertSchema>;
export type MaintenanceTask = typeof maintenanceTasks.$inferSelect;
export type InsertMaintenanceTask = z.infer<typeof insertMaintenanceTaskSchema>;
export type AIProviderCost = typeof aiProviderCosts.$inferSelect;
export type InsertAIProviderCost = z.infer<typeof insertAIProviderCostSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// ============================================
// VOICE CREDITS AND USAGE
// ============================================

// Voice credit balance for users
export const voiceCredits = pgTable("voice_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tier: text("tier").notNull().default("free"), // 'free', 'standard', 'premium'
  balanceMinutes: real("balance_minutes").notNull().default(0), // Remaining minutes
  freeMinutesUsed: real("free_minutes_used").notNull().default(0), // Monthly free tier usage
  freeMinutesLimit: real("free_minutes_limit").notNull().default(30), // 30 min/month free
  spendingCapUsd: real("spending_cap_usd"), // Optional monthly spending cap
  preferredVoice: text("preferred_voice").default("en-US-JennyNeural"),
  preferredLanguage: text("preferred_language").default("en-US"),
  preferredAccent: text("preferred_accent").default("neutral"), // User-defined accent for TTS
  autoSpeak: boolean("auto_speak").notNull().default(false), // Auto-speak responses
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: uniqueIndex("voice_credits_user_id_idx").on(table.userId),
  tierIdx: index("voice_credits_tier_idx").on(table.tier),
}));

// Voice credit purchase history
export const voiceCreditPurchases = pgTable("voice_credit_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  packageId: text("package_id").notNull(), // e.g., 'std-basic', 'prm-pro'
  tier: text("tier").notNull(), // 'standard', 'premium'
  minutesPurchased: real("minutes_purchased").notNull(),
  amountUsd: real("amount_usd").notNull(),
  paymentId: varchar("payment_id"), // Link to payment record
  status: text("status").notNull().default("completed"), // 'pending', 'completed', 'refunded'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("voice_credit_purchases_user_id_idx").on(table.userId),
  createdAtIdx: index("voice_credit_purchases_created_at_idx").on(table.createdAt),
}));

// Voice usage tracking (per-session)
export const voiceUsage = pgTable("voice_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  tier: text("tier").notNull(), // 'free', 'standard', 'premium'
  sttProvider: text("stt_provider"), // 'openai', 'deepgram', 'vosk'
  ttsProvider: text("tts_provider"), // 'openai', 'azure', 'elevenlabs', 'piper'
  sttDurationSeconds: real("stt_duration_seconds").notNull().default(0),
  ttsCharacters: integer("tts_characters").notNull().default(0),
  voiceUsed: text("voice_used"),
  languageUsed: text("language_used"),
  costUsd: real("cost_usd").notNull().default(0), // Our cost
  chargedUsd: real("charged_usd").notNull().default(0), // What user paid (with markup)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("voice_usage_user_id_idx").on(table.userId),
  tierIdx: index("voice_usage_tier_idx").on(table.tier),
  createdAtIdx: index("voice_usage_created_at_idx").on(table.createdAt),
}));

// Voice usage aggregates (daily rollup for faster queries)
export const voiceUsageDaily = pgTable("voice_usage_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  tier: text("tier").notNull(),
  totalSttSeconds: real("total_stt_seconds").notNull().default(0),
  totalTtsCharacters: integer("total_tts_characters").notNull().default(0),
  totalCostUsd: real("total_cost_usd").notNull().default(0),
  totalChargedUsd: real("total_charged_usd").notNull().default(0),
  sessionCount: integer("session_count").notNull().default(0),
}, (table) => ({
  userDateIdx: uniqueIndex("voice_usage_daily_user_date_idx").on(table.userId, table.date, table.tier),
  dateIdx: index("voice_usage_daily_date_idx").on(table.date),
}));

// Insert schemas for voice tables
export const insertVoiceCreditsSchema = createInsertSchema(voiceCredits).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVoiceCreditPurchaseSchema = createInsertSchema(voiceCreditPurchases).omit({ id: true, createdAt: true });
export const insertVoiceUsageSchema = createInsertSchema(voiceUsage).omit({ id: true, createdAt: true });
export const insertVoiceUsageDailySchema = createInsertSchema(voiceUsageDaily).omit({ id: true });

// Types for voice tables
export type VoiceCredits = typeof voiceCredits.$inferSelect;
export type InsertVoiceCredits = z.infer<typeof insertVoiceCreditsSchema>;
export type VoiceCreditPurchase = typeof voiceCreditPurchases.$inferSelect;
export type InsertVoiceCreditPurchase = z.infer<typeof insertVoiceCreditPurchaseSchema>;
export type VoiceUsage = typeof voiceUsage.$inferSelect;
export type InsertVoiceUsage = z.infer<typeof insertVoiceUsageSchema>;
export type VoiceUsageDaily = typeof voiceUsageDaily.$inferSelect;
export type InsertVoiceUsageDaily = z.infer<typeof insertVoiceUsageDailySchema>;

// ============================================================================
// ROUNDTABLE SESSIONS - AI Roundtable workflow persistence
// ============================================================================

export const roundtableSessions = pgTable("roundtable_sessions", {
  id: varchar("id").primaryKey(), // Session UUID
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  workflowId: varchar("workflow_id").notNull().default("default-roundtable"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, running, completed, failed, partial
  progress: integer("progress").notNull().default(0),
  currentAgent: varchar("current_agent", { length: 100 }),
  agentOutputs: jsonb("agent_outputs").default({}),
  finalResult: jsonb("final_result"),
  error: text("error"),
  errorCode: varchar("error_code", { length: 50 }),
  errorDetails: jsonb("error_details"),
  successfulAgents: jsonb("successful_agents").default([]),
  failedAgents: jsonb("failed_agents").default([]),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  conversationId: varchar("conversation_id"),
}, (table) => ({
  userIdIdx: index("roundtable_sessions_user_id_idx").on(table.userId),
  statusIdx: index("roundtable_sessions_status_idx").on(table.status),
  startedAtIdx: index("roundtable_sessions_started_at_idx").on(table.startedAt),
}));

// Insert schema for roundtable sessions
export const insertRoundtableSessionSchema = createInsertSchema(roundtableSessions).omit({ startedAt: true });

// Types for roundtable sessions
export type RoundtableSession = typeof roundtableSessions.$inferSelect;
export type InsertRoundtableSession = z.infer<typeof insertRoundtableSessionSchema>;

// ============================================================================
// SEARCH HISTORY - AI-powered search engine for accounting/tax/finance
// ============================================================================

export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  domain: varchar("domain", { length: 50 }).notNull().default("general"), // tax, audit, gaap_ifrs, compliance, advisory, general
  jurisdiction: varchar("jurisdiction", { length: 50 }),
  answer: text("answer").notNull(),
  citations: jsonb("citations").default([]), // Array of { title, url, snippet, domain, favicon }
  relatedQuestions: jsonb("related_questions").default([]), // Array of follow-up question strings
  modelUsed: varchar("model_used", { length: 100 }),
  providerUsed: varchar("provider_used", { length: 50 }),
  tokensUsed: integer("tokens_used"),
  processingTimeMs: integer("processing_time_ms"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("search_history_user_id_idx").on(table.userId),
  domainIdx: index("search_history_domain_idx").on(table.domain),
  userCreatedIdx: index("search_history_user_created_idx").on(table.userId, table.createdAt),
  pinnedIdx: index("search_history_pinned_idx").on(table.pinned),
}));

export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({
  id: true,
  createdAt: true,
});

export type SearchHistoryEntry = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
