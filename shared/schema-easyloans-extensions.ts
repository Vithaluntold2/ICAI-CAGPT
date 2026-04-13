/**
 * EasyLoans Module - Schema Extensions
 * New tables for complete DSA/Lending platform functionality
 * 
 * Add these to shared/schema.ts after the existing easyLoans tables
 */

import { pgTable, varchar, timestamp, text, integer, decimal, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema"; // Adjust import path as needed
import { 
  easyLoansInquiries, 
  easyLoansLeads, 
  easyLoansProducts, 
  easyLoansLenders 
} from "./schema"; // Adjust import path

// =============================================
// DOCUMENT MANAGEMENT
// =============================================

export const easyLoansDocuments = pgTable("easy_loans_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Ownership
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  inquiryId: varchar("inquiry_id").references(() => easyLoansInquiries.id, { onDelete: "cascade" }),
  leadId: varchar("lead_id").references(() => easyLoansLeads.id, { onDelete: "cascade" }),
  
  // Document Type
  documentType: varchar("document_type", { length: 100 }).notNull(), // 'pan_card', 'aadhar', 'bank_statement', 'salary_slip', 'itr', 'gst_certificate', 'property_papers', etc.
  documentCategory: varchar("document_category", { length: 50 }).notNull(), // 'identity', 'address', 'income', 'business', 'property'
  
  // File Details
  filename: varchar("filename", { length: 255 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  encryptedFileUrl: varchar("encrypted_file_url", { length: 500 }),
  fileType: varchar("file_type", { length: 50 }), // 'pdf', 'jpeg', 'png'
  fileSizeBytes: integer("file_size_bytes"),
  fileHash: varchar("file_hash", { length: 64 }), // SHA-256 for integrity
  
  // OCR/Extraction
  ocrStatus: varchar("ocr_status", { length: 50 }).default("pending"), // 'pending', 'processing', 'completed', 'failed'
  extractedText: text("extracted_text"),
  extractedData: jsonb("extracted_data"), // Structured data from document (PAN number, name, dates, etc.)
  ocrProvider: varchar("ocr_provider", { length: 50 }), // 'azure_document_intelligence', 'google_vision', 'aws_textract'
  ocrConfidenceScore: decimal("ocr_confidence_score", { precision: 5, scale: 2 }),
  
  // Verification
  verificationStatus: varchar("verification_status", { length: 50 }).notNull().default("pending"), // 'pending', 'verified', 'rejected', 'manual_review_required'
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  verificationMethod: varchar("verification_method", { length: 50 }), // 'automated', 'manual', 'api'
  rejectionReason: text("rejection_reason"),
  
  // Compliance
  isEncrypted: boolean("is_encrypted").notNull().default(true),
  retentionUntil: timestamp("retention_until"), // Auto-delete after this date
  deletedAt: timestamp("deleted_at"), // Soft delete
  
  // Metadata
  uploadedVia: varchar("uploaded_via", { length: 50 }), // 'web', 'mobile', 'admin'
  ipAddress: varchar("ip_address", { length: 45 }),
  tags: jsonb("tags"), // Array of strings for categorization
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("easy_loans_docs_user_idx").on(table.userId),
  inquiryIdx: index("easy_loans_docs_inquiry_idx").on(table.inquiryId),
  leadIdx: index("easy_loans_docs_lead_idx").on(table.leadId),
  typeIdx: index("easy_loans_docs_type_idx").on(table.documentType),
  statusIdx: index("easy_loans_docs_status_idx").on(table.verificationStatus),
}));

// =============================================
// APPLICATION STATUS TRACKING
// =============================================

export const easyLoansApplicationStatus = pgTable("easy_loans_application_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  leadId: varchar("lead_id").notNull().references(() => easyLoansLeads.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => easyLoansProducts.id),
  lenderId: varchar("lender_id").references(() => easyLoansLenders.id),
  
  // Status Workflow
  status: varchar("status", { length: 50 }).notNull().default("draft"), // 'draft', 'document_pending', 'submitted', 'under_review', 'documents_requested', 'approved', 'rejected', 'disbursed', 'closed'
  previousStatus: varchar("previous_status", { length: 50 }),
  statusChangedAt: timestamp("status_changed_at").notNull().defaultNow(),
  statusChangedBy: varchar("status_changed_by").references(() => users.id),
  
  // Lender Details
  lenderApplicationId: varchar("lender_application_id", { length: 100 }), // Lender's internal reference
  lenderStatus: varchar("lender_status", { length: 100 }), // Lender's status (may differ from ours)
  lenderComments: text("lender_comments"),
  lenderLastUpdated: timestamp("lender_last_updated"),
  
  // Approval Details
  approvedAmount: decimal("approved_amount", { precision: 15, scale: 2 }),
  approvedTenureMonths: integer("approved_tenure_months"),
  approvedInterestRate: decimal("approved_interest_rate", { precision: 5, scale: 2 }),
  approvalDate: timestamp("approval_date"),
  approvalValidUntil: timestamp("approval_validity"),
  
  // Rejection Details
  rejectionReason: varchar("rejection_reason", { length: 255 }),
  rejectionDetails: jsonb("rejection_details"),
  rejectionDate: timestamp("rejection_date"),
  canReapply: boolean("can_reapply").default(true),
  reapplyAfter: timestamp("reapply_after"),
  
  // Disbursement Details
  disbursedAmount: decimal("disbursed_amount", { precision: 15, scale: 2 }),
  disbursementDate: timestamp("disbursement_date"),
  disbursementMode: varchar("disbursement_mode", { length: 50 }), // 'bank_transfer', 'cheque', 'dd'
  disbursementReferenceNumber: varchar("disbursement_ref_number", { length: 100 }),
  
  // Documents Tracking
  pendingDocuments: jsonb("pending_documents"), // Array of document types needed
  documentsSubmittedAt: timestamp("documents_submitted_at"),
  documentsVerifiedAt: timestamp("documents_verified_at"),
  
  // Communication
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  
  // Timeline
  submittedToLenderAt: timestamp("submitted_to_lender_at"),
  lenderAcknowledgedAt: timestamp("lender_acknowledged_at"),
  turnaroundTimeHours: integer("turnaround_time_hours"), // Time from submission to decision
  
  // Metadata
  notes: text("notes"),
  internalTags: jsonb("internal_tags"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  leadIdx: index("easy_loans_app_status_lead_idx").on(table.leadId),
  statusIdx: index("easy_loans_app_status_idx").on(table.status),
  lenderIdx: index("easy_loans_app_status_lender_idx").on(table.lenderId),
  disbursementIdx: index("easy_loans_app_disbursement_idx").on(table.disbursementDate),
}));

// =============================================
// STATUS HISTORY (Audit Trail)
// =============================================

export const easyLoansStatusHistory = pgTable("easy_loans_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationStatusId: varchar("application_status_id").notNull().references(() => easyLoansApplicationStatus.id, { onDelete: "cascade" }),
  
  fromStatus: varchar("from_status", { length: 50 }),
  toStatus: varchar("to_status", { length: 50 }).notNull(),
  changedBy: varchar("changed_by").references(() => users.id),
  changeReason: text("change_reason"),
  changeSource: varchar("change_source", { length: 50 }), // 'user_action', 'lender_callback', 'admin_update', 'system_auto'
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  appStatusIdx: index("easy_loans_history_app_idx").on(table.applicationStatusId),
  timestampIdx: index("easy_loans_history_time_idx").on(table.createdAt),
}));

// =============================================
// LENDER INTEGRATIONS
// =============================================

export const easyLoansLenderIntegrations = pgTable("easy_loans_lender_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lenderId: varchar("lender_id").notNull().references(() => easyLoansLenders.id, { onDelete: "cascade" }),
  
  // Integration Type
  integrationType: varchar("integration_type", { length: 50 }).notNull(), // 'api', 'webhook', 'email', 'manual', 'sftp'
  integrationStatus: varchar("integration_status", { length: 50 }).notNull().default("inactive"), // 'active', 'inactive', 'testing', 'deprecated'
  
  // API Configuration
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  apiVersion: varchar("api_version", { length: 20 }),
  apiKeyEncrypted: text("api_key_encrypted"), // Never store plain text
  authType: varchar("auth_type", { length: 50 }), // 'api_key', 'oauth2', 'basic_auth', 'jwt'
  authCredentialsEncrypted: jsonb("auth_credentials_encrypted"),
  
  // Webhook Configuration
  webhookUrl: varchar("webhook_url", { length: 500 }),
  webhookSecret: text("webhook_secret_encrypted"),
  webhookEvents: jsonb("webhook_events"), // Array of event types to subscribe to
  
  // Features Supported
  supportsLeadSubmission: boolean("supports_lead_submission").default(false),
  supportsStatusCheck: boolean("supports_status_check").default(false),
  supportsDocumentUpload: boolean("supports_document_upload").default(false),
  supportsWebhookCallbacks: boolean("supports_webhook_callbacks").default(false),
  
  // Rate Limiting
  requestsPerMinute: integer("requests_per_minute"),
  requestsPerDay: integer("requests_per_day"),
  lastRequestAt: timestamp("last_request_at"),
  
  // Health Monitoring
  lastSuccessfulCallAt: timestamp("last_successful_call_at"),
  lastFailedCallAt: timestamp("last_failed_call_at"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  healthScore: decimal("health_score", { precision: 5, scale: 2 }), // 0-100
  
  // Configuration
  requestTimeout: integer("request_timeout_ms").default(30000),
  retryAttempts: integer("retry_attempts").default(3),
  customHeaders: jsonb("custom_headers"),
  customMapping: jsonb("custom_mapping"), // Field name mappings
  
  // Metadata
  testMode: boolean("test_mode").default(false),
  notes: text("notes"),
  activatedAt: timestamp("activated_at"),
  activatedBy: varchar("activated_by").references(() => users.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  lenderIdx: index("easy_loans_integrations_lender_idx").on(table.lenderId),
  statusIdx: index("easy_loans_integrations_status_idx").on(table.integrationStatus),
}));

// =============================================
// INTEGRATION LOGS
// =============================================

export const easyLoansIntegrationLogs = pgTable("easy_loans_integration_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: varchar("integration_id").notNull().references(() => easyLoansLenderIntegrations.id, { onDelete: "cascade" }),
  leadId: varchar("lead_id").references(() => easyLoansLeads.id),
  
  // Request Details
  requestType: varchar("request_type", { length: 50 }).notNull(), // 'lead_submission', 'status_check', 'document_upload'
  requestMethod: varchar("request_method", { length: 10 }), // 'GET', 'POST', 'PUT'
  requestUrl: varchar("request_url", { length: 500 }),
  requestHeaders: jsonb("request_headers"),
  requestBody: jsonb("request_body"),
  requestSentAt: timestamp("request_sent_at").notNull().defaultNow(),
  
  // Response Details
  responseStatus: integer("response_status"),
  responseHeaders: jsonb("response_headers"),
  responseBody: jsonb("response_body"),
  responseReceivedAt: timestamp("response_received_at"),
  responseDurationMs: integer("response_duration_ms"),
  
  // Error Handling
  isSuccess: boolean("is_success").notNull().default(false),
  errorMessage: text("error_message"),
  errorCode: varchar("error_code", { length: 100 }),
  retryAttempt: integer("retry_attempt").default(1),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  integrationIdx: index("easy_loans_int_logs_integration_idx").on(table.integrationId),
  leadIdx: index("easy_loans_int_logs_lead_idx").on(table.leadId),
  timestampIdx: index("easy_loans_int_logs_time_idx").on(table.createdAt),
  successIdx: index("easy_loans_int_logs_success_idx").on(table.isSuccess),
}));

// =============================================
// COMMISSION TRACKING
// =============================================

export const easyLoansCommissions = pgTable("easy_loans_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  leadId: varchar("lead_id").notNull().references(() => easyLoansLeads.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => easyLoansProducts.id),
  lenderId: varchar("lender_id").references(() => easyLoansLenders.id),
  dsaUserId: varchar("dsa_user_id").notNull().references(() => users.id),
  
  // Loan Details
  loanAmount: decimal("loan_amount", { precision: 15, scale: 2 }).notNull(),
  disbursedAmount: decimal("disbursed_amount", { precision: 15, scale: 2 }),
  disbursementDate: timestamp("disbursement_date"),
  
  // Commission Calculation
  commissionType: varchar("commission_type", { length: 50 }).notNull(), // 'percentage', 'flat', 'tiered'
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }), // % or flat amount
  commissionAmount: decimal("commission_amount", { precision: 15, scale: 2 }).notNull(),
  calculationBasis: varchar("calculation_basis", { length: 50 }), // 'loan_amount', 'disbursed_amount'
  
  // TDS & Taxes
  tdsPercent: decimal("tds_percent", { precision: 5, scale: 2 }).default("10.00"),
  tdsAmount: decimal("tds_amount", { precision: 15, scale: 2 }),
  gstPercent: decimal("gst_percent", { precision: 5, scale: 2 }).default("18.00"),
  gstAmount: decimal("gst_amount", { precision: 15, scale: 2 }),
  netPayable: decimal("net_payable", { precision: 15, scale: 2 }).notNull(),
  
  // Payment Status
  paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("pending"), // 'pending', 'approved', 'processing', 'paid', 'rejected', 'disputed'
  paymentDueDate: timestamp("payment_due_date"),
  paymentApprovedBy: varchar("payment_approved_by").references(() => users.id),
  paymentApprovedAt: timestamp("payment_approved_at"),
  
  // Payout Details
  payoutId: varchar("payout_id"), // Links to payouts batch
  paidDate: timestamp("paid_date"),
  paymentMode: varchar("payment_mode", { length: 50 }), // 'bank_transfer', 'upi', 'cheque'
  paymentReferenceNumber: varchar("payment_reference_number", { length: 100 }),
  bankAccountLast4: varchar("bank_account_last4", { length: 4 }),
  
  // Dispute Handling
  disputeReason: text("dispute_reason"),
  disputeRaisedAt: timestamp("dispute_raised_at"),
  disputeResolvedAt: timestamp("dispute_resolved_at"),
  disputeResolution: text("dispute_resolution"),
  
  // Compliance
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  invoiceUrl: varchar("invoice_url", { length: 500 }),
  invoiceGeneratedAt: timestamp("invoice_generated_at"),
  
  // Metadata
  notes: text("notes"),
  tags: jsonb("tags"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  leadIdx: index("easy_loans_commissions_lead_idx").on(table.leadId),
  dsaIdx: index("easy_loans_commissions_dsa_idx").on(table.dsaUserId),
  statusIdx: index("easy_loans_commissions_status_idx").on(table.paymentStatus),
  payoutIdx: index("easy_loans_commissions_payout_idx").on(table.payoutId),
  disbursementIdx: index("easy_loans_commissions_disbursement_idx").on(table.disbursementDate),
}));

// =============================================
// PAYOUT BATCHES
// =============================================

export const easyLoansPayouts = pgTable("easy_loans_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Batch Details
  batchNumber: varchar("batch_number", { length: 100 }).notNull().unique(),
  payoutPeriodStart: timestamp("payout_period_start").notNull(),
  payoutPeriodEnd: timestamp("payout_period_end").notNull(),
  
  // Totals
  totalCommissions: integer("total_commissions").notNull(),
  totalGrossAmount: decimal("total_gross_amount", { precision: 15, scale: 2 }).notNull(),
  totalTdsAmount: decimal("total_tds_amount", { precision: 15, scale: 2 }).notNull(),
  totalGstAmount: decimal("total_gst_amount", { precision: 15, scale: 2 }).notNull(),
  totalNetAmount: decimal("total_net_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("draft"), // 'draft', 'approved', 'processing', 'completed', 'failed'
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  // Processing
  processedBy: varchar("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  processingMode: varchar("processing_mode", { length: 50 }), // 'bulk_transfer', 'individual', 'api'
  
  // Bank Details
  bankReferenceNumber: varchar("bank_reference_number", { length: 100 }),
  bankStatementUrl: varchar("bank_statement_url", { length: 500 }),
  
  // Metadata
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("easy_loans_payouts_status_idx").on(table.status),
  periodIdx: index("easy_loans_payouts_period_idx").on(table.payoutPeriodStart, table.payoutPeriodEnd),
}));

// =============================================
// NOTIFICATIONS QUEUE
// =============================================

export const easyLoansNotificationsQueue = pgTable("easy_loans_notifications_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Recipient
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Notification Type
  notificationType: varchar("notification_type", { length: 50 }).notNull(), // 'status_update', 'document_request', 'disbursement', 'approval', 'rejection'
  channel: varchar("channel", { length: 50 }).notNull(), // 'email', 'sms', 'whatsapp', 'in_app', 'push'
  priority: varchar("priority", { length: 20 }).notNull().default("normal"), // 'low', 'normal', 'high', 'urgent'
  
  // Content
  subject: varchar("subject", { length: 255 }),
  body: text("body").notNull(),
  templateId: varchar("template_id", { length: 100 }),
  templateVariables: jsonb("template_variables"),
  
  // Links
  leadId: varchar("lead_id").references(() => easyLoansLeads.id),
  inquiryId: varchar("inquiry_id").references(() => easyLoansInquiries.id),
  
  // Delivery Details
  recipientEmail: varchar("recipient_email", { length: 255 }),
  recipientPhone: varchar("recipient_phone", { length: 20 }),
  recipientWhatsapp: varchar("recipient_whatsapp", { length: 20 }),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending', 'sent', 'failed', 'bounced'
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  
  // Provider Details
  provider: varchar("provider", { length: 50 }), // 'sendgrid', 'twilio', 'whatsapp_business', 'firebase'
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  providerResponse: jsonb("provider_response"),
  
  // Tracking
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for"),
  expiresAt: timestamp("expires_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("easy_loans_notif_queue_user_idx").on(table.userId),
  statusIdx: index("easy_loans_notif_queue_status_idx").on(table.status),
  channelIdx: index("easy_loans_notif_queue_channel_idx").on(table.channel),
  scheduledIdx: index("easy_loans_notif_queue_scheduled_idx").on(table.scheduledFor),
}));

// =============================================
// CONSENT LOGS (GDPR Compliance)
// =============================================

export const easyLoansConsentLogs = pgTable("easy_loans_consent_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Consent Type
  consentType: varchar("consent_type", { length: 100 }).notNull(), // 'data_processing', 'credit_check', 'document_storage', 'marketing', 'third_party_sharing'
  consentVersion: varchar("consent_version", { length: 20 }).notNull(), // Track T&C versions
  
  // Action
  action: varchar("action", { length: 50 }).notNull(), // 'granted', 'revoked', 'updated'
  consentGiven: boolean("consent_given").notNull(),
  
  // Context
  source: varchar("source", { length: 100 }), // 'web', 'mobile', 'email_link', 'sms_link'
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Linked Entities
  inquiryId: varchar("inquiry_id").references(() => easyLoansInquiries.id),
  leadId: varchar("lead_id").references(() => easyLoansLeads.id),
  
  // Metadata
  consentText: text("consent_text"), // Store the exact consent text shown
  consentUrl: varchar("consent_url", { length: 500 }), // Link to T&C document
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("easy_loans_consent_user_idx").on(table.userId),
  typeIdx: index("easy_loans_consent_type_idx").on(table.consentType),
  actionIdx: index("easy_loans_consent_action_idx").on(table.action),
}));

// =============================================
// AUDIT LOGS
// =============================================

export const easyLoansAuditLogs = pgTable("easy_loans_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Actor
  actorId: varchar("actor_id").references(() => users.id),
  actorType: varchar("actor_type", { length: 50 }), // 'user', 'admin', 'system', 'api'
  actorIpAddress: varchar("actor_ip_address", { length: 45 }),
  
  // Action
  action: varchar("action", { length: 100 }).notNull(), // 'create', 'read', 'update', 'delete', 'export', 'share'
  entityType: varchar("entity_type", { length: 100 }).notNull(), // 'profile', 'inquiry', 'document', 'lead'
  entityId: varchar("entity_id").notNull(),
  
  // Changes
  changesBefore: jsonb("changes_before"), // State before action
  changesAfter: jsonb("changes_after"), // State after action
  
  // Context
  reason: text("reason"),
  source: varchar("source", { length: 100 }), // 'web_ui', 'mobile_app', 'api', 'admin_panel'
  requestId: varchar("request_id", { length: 100 }), // Trace request across services
  
  // Compliance
  dataAccessPurpose: varchar("data_access_purpose", { length: 255 }), // Required for GDPR
  legalBasis: varchar("legal_basis", { length: 100 }), // 'consent', 'legitimate_interest', 'contract'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  actorIdx: index("easy_loans_audit_actor_idx").on(table.actorId),
  entityIdx: index("easy_loans_audit_entity_idx").on(table.entityType, table.entityId),
  timestampIdx: index("easy_loans_audit_time_idx").on(table.createdAt),
  actionIdx: index("easy_loans_audit_action_idx").on(table.action),
}));

// =============================================
// CREDIT REPORTS CACHE
// =============================================

export const easyLoansCreditReports = pgTable("easy_loans_credit_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  inquiryId: varchar("inquiry_id").references(() => easyLoansInquiries.id),
  
  // Bureau Details
  bureau: varchar("bureau", { length: 50 }).notNull(), // 'cibil', 'experian', 'equifax', 'crif_highmark'
  reportType: varchar("report_type", { length: 50 }).notNull(), // 'individual', 'commercial'
  reportId: varchar("report_id", { length: 100 }), // Bureau's report ID
  
  // Score
  creditScore: integer("credit_score"),
  scoreDate: timestamp("score_date"),
  scoreVersion: varchar("score_version", { length: 20 }),
  
  // Report Data
  reportData: jsonb("report_data").notNull(), // Full parsed report
  rawReport: text("raw_report"), // Original XML/JSON from bureau
  reportPdfUrl: varchar("report_pdf_url", { length: 500 }),
  
  // Summary
  totalAccounts: integer("total_accounts"),
  activeAccounts: integer("active_accounts"),
  closedAccounts: integer("closed_accounts"),
  totalCreditLimit: decimal("total_credit_limit", { precision: 15, scale: 2 }),
  totalOutstanding: decimal("total_outstanding", { precision: 15, scale: 2 }),
  utilizationPercent: decimal("utilization_percent", { precision: 5, scale: 2 }),
  
  // Payment History
  onTimePayments: integer("on_time_payments"),
  latePayments: integer("late_payments"),
  defaults: integer("defaults"),
  settledAccounts: integer("settled_accounts"),
  writtenOffAccounts: integer("written_off_accounts"),
  
  // Inquiries
  hardInquiriesLast6Months: integer("hard_inquiries_last_6_months"),
  hardInquiriesLast12Months: integer("hard_inquiries_last_12_months"),
  
  // Age of Credit
  oldestAccountMonths: integer("oldest_account_months"),
  averageAccountAgeMonths: integer("average_account_age_months"),
  
  // Status
  fetchStatus: varchar("fetch_status", { length: 50 }).notNull().default("pending"), // 'pending', 'success', 'failed', 'expired'
  fetchedAt: timestamp("fetched_at"),
  fetchError: text("fetch_error"),
  
  // Caching
  expiresAt: timestamp("expires_at"), // Reports valid for 30-90 days
  isStale: boolean("is_stale").default(false),
  
  // Cost Tracking
  costAmount: decimal("cost_amount", { precision: 10, scale: 2 }),
  costCurrency: varchar("cost_currency", { length: 3 }).default("INR"),
  
  // Consent
  consentId: varchar("consent_id").references(() => easyLoansConsentLogs.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("easy_loans_credit_user_idx").on(table.userId),
  bureauIdx: index("easy_loans_credit_bureau_idx").on(table.bureau),
  scoreIdx: index("easy_loans_credit_score_idx").on(table.creditScore),
  expiryIdx: index("easy_loans_credit_expiry_idx").on(table.expiresAt),
}));

// =============================================
// DSA HIERARCHY (Multi-Tenancy)
// =============================================

export const easyLoansDSAHierarchy = pgTable("easy_loans_dsa_hierarchy", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Hierarchy
  dsaUserId: varchar("dsa_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentDsaId: varchar("parent_dsa_id").references(() => users.id), // For sub-agents
  hierarchyLevel: integer("hierarchy_level").notNull().default(1), // 1=master, 2=sub, 3=sub-sub
  hierarchyPath: varchar("hierarchy_path", { length: 500 }), // Materialized path for queries
  
  // DSA Details
  dsaCode: varchar("dsa_code", { length: 50 }).notNull().unique(),
  dsaCompanyName: varchar("dsa_company_name", { length: 255 }),
  dsaType: varchar("dsa_type", { length: 50 }), // 'individual', 'company', 'partnership', 'franchise'
  
  // Territory
  assignedStates: jsonb("assigned_states"), // Array of states
  assignedCities: jsonb("assigned_cities"), // Array of cities
  assignedPincodes: jsonb("assigned_pincodes"), // Array of pincodes
  isExclusiveTerritory: boolean("is_exclusive_territory").default(false),
  
  // Commission Configuration
  customCommissionRates: jsonb("custom_commission_rates"), // Override default rates per lender/product
  commissionSplitPercent: decimal("commission_split_percent", { precision: 5, scale: 2 }), // If sub-agent
  
  // Limits & Permissions
  monthlyLeadLimit: integer("monthly_lead_limit"),
  currentMonthLeads: integer("current_month_leads").default(0),
  canCreateSubAgents: boolean("can_create_sub_agents").default(false),
  canAccessAnalytics: boolean("can_access_analytics").default(true),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("active"), // 'active', 'suspended', 'terminated'
  suspendedAt: timestamp("suspended_at"),
  suspensionReason: text("suspension_reason"),
  
  // Agreement
  agreementStartDate: timestamp("agreement_start_date"),
  agreementEndDate: timestamp("agreement_end_date"),
  agreementDocumentUrl: varchar("agreement_document_url", { length: 500 }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  dsaIdx: index("easy_loans_dsa_user_idx").on(table.dsaUserId),
  parentIdx: index("easy_loans_dsa_parent_idx").on(table.parentDsaId),
  codeIdx: index("easy_loans_dsa_code_idx").on(table.dsaCode),
  statusIdx: index("easy_loans_dsa_status_idx").on(table.status),
}));

// =============================================
// INSERT SCHEMAS
// =============================================

export const insertEasyLoansDocumentSchema = createInsertSchema(easyLoansDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEasyLoansApplicationStatusSchema = createInsertSchema(easyLoansApplicationStatus).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEasyLoansStatusHistorySchema = createInsertSchema(easyLoansStatusHistory).omit({ id: true, createdAt: true });
export const insertEasyLoansLenderIntegrationSchema = createInsertSchema(easyLoansLenderIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEasyLoansIntegrationLogSchema = createInsertSchema(easyLoansIntegrationLogs).omit({ id: true, createdAt: true });
export const insertEasyLoansCommissionSchema = createInsertSchema(easyLoansCommissions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEasyLoansPayoutSchema = createInsertSchema(easyLoansPayouts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEasyLoansNotificationQueueSchema = createInsertSchema(easyLoansNotificationsQueue).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEasyLoansConsentLogSchema = createInsertSchema(easyLoansConsentLogs).omit({ id: true, createdAt: true });
export const insertEasyLoansAuditLogSchema = createInsertSchema(easyLoansAuditLogs).omit({ id: true, createdAt: true });
export const insertEasyLoansCreditReportSchema = createInsertSchema(easyLoansCreditReports).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEasyLoansDSAHierarchySchema = createInsertSchema(easyLoansDSAHierarchy).omit({ id: true, createdAt: true, updatedAt: true });

// =============================================
// TYPE EXPORTS
// =============================================

export type EasyLoansDocument = typeof easyLoansDocuments.$inferSelect;
export type InsertEasyLoansDocument = z.infer<typeof insertEasyLoansDocumentSchema>;

export type EasyLoansApplicationStatus = typeof easyLoansApplicationStatus.$inferSelect;
export type InsertEasyLoansApplicationStatus = z.infer<typeof insertEasyLoansApplicationStatusSchema>;

export type EasyLoansStatusHistory = typeof easyLoansStatusHistory.$inferSelect;
export type InsertEasyLoansStatusHistory = z.infer<typeof insertEasyLoansStatusHistorySchema>;

export type EasyLoansLenderIntegration = typeof easyLoansLenderIntegrations.$inferSelect;
export type InsertEasyLoansLenderIntegration = z.infer<typeof insertEasyLoansLenderIntegrationSchema>;

export type EasyLoansIntegrationLog = typeof easyLoansIntegrationLogs.$inferSelect;
export type InsertEasyLoansIntegrationLog = z.infer<typeof insertEasyLoansIntegrationLogSchema>;

export type EasyLoansCommission = typeof easyLoansCommissions.$inferSelect;
export type InsertEasyLoansCommission = z.infer<typeof insertEasyLoansCommissionSchema>;

export type EasyLoansPayout = typeof easyLoansPayouts.$inferSelect;
export type InsertEasyLoansPayout = z.infer<typeof insertEasyLoansPayoutSchema>;

export type EasyLoansNotificationQueue = typeof easyLoansNotificationsQueue.$inferSelect;
export type InsertEasyLoansNotificationQueue = z.infer<typeof insertEasyLoansNotificationQueueSchema>;

export type EasyLoansConsentLog = typeof easyLoansConsentLogs.$inferSelect;
export type InsertEasyLoansConsentLog = z.infer<typeof insertEasyLoansConsentLogSchema>;

export type EasyLoansAuditLog = typeof easyLoansAuditLogs.$inferSelect;
export type InsertEasyLoansAuditLog = z.infer<typeof insertEasyLoansAuditLogSchema>;

export type EasyLoansCreditReport = typeof easyLoansCreditReports.$inferSelect;
export type InsertEasyLoansCreditReport = z.infer<typeof insertEasyLoansCreditReportSchema>;

export type EasyLoansDSAHierarchy = typeof easyLoansDSAHierarchy.$inferSelect;
export type InsertEasyLoansDSAHierarchy = z.infer<typeof insertEasyLoansDSAHierarchySchema>;
