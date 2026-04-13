CREATE TABLE "accounting_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expiry" timestamp,
	"company_id" text,
	"company_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_provider_costs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"tokens_used" integer NOT NULL,
	"cost_usd" integer NOT NULL,
	"request_count" integer NOT NULL,
	"user_id" varchar,
	"subscription_tier" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"expires_at" timestamp,
	"permissions" jsonb DEFAULT '["read"]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"quality_score" integer,
	"response_relevance_score" integer,
	"completeness_score" integer,
	"clarity_score" integer,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"average_response_time" integer,
	"conversation_duration" integer,
	"was_abandoned" boolean DEFAULT false NOT NULL,
	"abandonment_point" integer,
	"follow_up_question_count" integer DEFAULT 0 NOT NULL,
	"clarification_request_count" integer DEFAULT 0 NOT NULL,
	"user_frustration_detected" boolean DEFAULT false NOT NULL,
	"resolution_achieved" boolean,
	"topics_discussed" jsonb,
	"domain_categories" jsonb,
	"complexity_level" text,
	"provider_used" text,
	"model_switch_count" integer DEFAULT 0 NOT NULL,
	"fallback_triggered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"profile_id" varchar,
	"title" text NOT NULL,
	"metadata" text,
	"preview" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"shared_token" varchar,
	"quality_score" integer,
	"resolved" boolean DEFAULT false,
	"user_feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_shared_token_unique" UNIQUE("shared_token")
);
--> statement-breakpoint
CREATE TABLE "coupon_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_id" varchar,
	"discount_amount" integer NOT NULL,
	"used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"currency" text,
	"min_purchase_amount" integer,
	"max_discount_amount" integer,
	"applicable_plans" text[],
	"applicable_currencies" text[],
	"max_uses" integer,
	"max_uses_per_user" integer DEFAULT 1,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "deliverable_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" varchar NOT NULL,
	"version_id" varchar,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"format" text NOT NULL,
	"storage_key" text NOT NULL,
	"checksum" text NOT NULL,
	"byte_length" integer NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverable_instances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"profile_id" varchar,
	"conversation_id" varchar,
	"template_id" varchar,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"content_markdown" text NOT NULL,
	"variable_values" jsonb,
	"citation_summary" jsonb,
	"generated_with_chat_mode" text,
	"model_used" text,
	"tokens_used" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"finalized_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "deliverable_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"share_token" varchar NOT NULL,
	"recipient_email" text,
	"expires_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deliverable_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "deliverable_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"category" text,
	"content_template" text NOT NULL,
	"variable_schema" jsonb NOT NULL,
	"style_config" jsonb,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverable_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"content_markdown" text NOT NULL,
	"change_description" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finetuning_dataset" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar,
	"conversation_id" varchar,
	"system_prompt" text NOT NULL,
	"user_message" text NOT NULL,
	"assistant_response" text NOT NULL,
	"domain" text NOT NULL,
	"jurisdiction" text,
	"complexity" text DEFAULT 'standard' NOT NULL,
	"chat_mode" text,
	"average_rating" real,
	"feedback_count" integer DEFAULT 0 NOT NULL,
	"quality_score" real,
	"is_approved" boolean,
	"is_used" boolean DEFAULT false NOT NULL,
	"used_in_job_id" text,
	"source_type" text DEFAULT 'interaction' NOT NULL,
	"source_id" text,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forensic_cases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"profile_id" varchar,
	"conversation_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"status" text DEFAULT 'active' NOT NULL,
	"scope_metadata" jsonb,
	"overall_risk_score" integer,
	"severity_level" text,
	"total_documents" integer DEFAULT 0 NOT NULL,
	"total_findings" integer DEFAULT 0 NOT NULL,
	"critical_findings" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "forensic_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar,
	"filename" text NOT NULL,
	"document_type" text,
	"extracted_data" jsonb NOT NULL,
	"document_metadata" jsonb,
	"analysis_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forensic_evidence" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" varchar NOT NULL,
	"document_id" varchar,
	"evidence_type" text NOT NULL,
	"snippet_text" text,
	"data_extract" jsonb,
	"page_number" integer,
	"field_reference" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forensic_findings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"document_id" varchar,
	"finding_type" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"impacted_metrics" jsonb,
	"evidence_details" jsonb,
	"remediation_json" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "forensic_reconciliations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"source_document_id" varchar NOT NULL,
	"target_document_id" varchar NOT NULL,
	"reconciliation_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expected_value" integer,
	"actual_value" integer,
	"variance_amount" integer,
	"variance_percentage" integer,
	"reconciliation_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gdpr_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"consent_type" text NOT NULL,
	"consented" boolean NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interaction_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar,
	"message_id" varchar,
	"user_id" varchar NOT NULL,
	"query" text NOT NULL,
	"query_classification" jsonb,
	"retrieved_context_ids" jsonb DEFAULT '[]'::jsonb,
	"retrieved_context_scores" jsonb DEFAULT '[]'::jsonb,
	"response" text NOT NULL,
	"model_used" text,
	"tokens_used" integer,
	"response_time_ms" integer,
	"compliance_result" jsonb,
	"user_rating" integer,
	"needs_review" boolean DEFAULT false NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_edges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_node_id" varchar NOT NULL,
	"to_node_id" varchar NOT NULL,
	"edge_type" text NOT NULL,
	"weight" real DEFAULT 1,
	"properties" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_type" text NOT NULL,
	"label" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb,
	"source" text,
	"confidence" real DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"task_type" text NOT NULL,
	"schedule" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"duration" integer,
	"result" jsonb,
	"error" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_sentiment" text,
	"sentiment_score" integer,
	"emotional_tone" jsonb,
	"response_quality" integer,
	"accuracy_score" integer,
	"helpfulness_score" integer,
	"user_intent" text,
	"intent_confidence" integer,
	"response_length" integer,
	"technical_complexity" text,
	"contains_calculations" boolean DEFAULT false NOT NULL,
	"contains_citations" boolean DEFAULT false NOT NULL,
	"processing_time" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"feedback_type" text DEFAULT 'rating' NOT NULL,
	"comment" text,
	"corrected_response" text,
	"is_helpful" boolean,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"model_used" text,
	"routing_decision" jsonb,
	"calculation_results" jsonb,
	"metadata" jsonb,
	"tokens_used" integer,
	"excel_filename" text,
	"excel_buffer" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_routing_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"query_classification" jsonb NOT NULL,
	"selected_model" text NOT NULL,
	"routing_reason" text,
	"confidence" integer,
	"alternative_models" jsonb,
	"processing_time_ms" integer,
	"tokens_used" integer,
	"cost_usd" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_id" varchar,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"payment_gateway" text,
	"gateway_order_id" text,
	"gateway_payment_id" text,
	"gateway_signature" text,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_gateway_payment_id_unique" UNIQUE("gateway_payment_id")
);
--> statement-breakpoint
CREATE TABLE "profile_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"relationship" text,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"full_content" text,
	"source" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"effective_date" timestamp,
	"external_url" text,
	"perplexity_query" text,
	"is_processed" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roundtable_sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"query" text NOT NULL,
	"workflow_id" varchar DEFAULT 'default-roundtable' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_agent" varchar(100),
	"agent_outputs" jsonb DEFAULT '{}'::jsonb,
	"final_result" jsonb,
	"error" text,
	"error_code" varchar(50),
	"error_details" jsonb,
	"successful_agents" jsonb DEFAULT '[]'::jsonb,
	"failed_agents" jsonb DEFAULT '[]'::jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"conversation_id" varchar
);
--> statement-breakpoint
CREATE TABLE "scenario_comparisons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playbook_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"left_run_id" varchar NOT NULL,
	"right_run_id" varchar NOT NULL,
	"comparison_snapshot" jsonb NOT NULL,
	"title" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_conversation_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar NOT NULL,
	"metric_key" text NOT NULL,
	"metric_category" text,
	"numeric_value" integer,
	"percentage_value" integer,
	"currency_value" integer,
	"details_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_playbooks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"profile_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"baseline_config" jsonb NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"solvers_used" jsonb,
	"model_used" text,
	"provider_used" text,
	"results_snapshot" jsonb,
	"error_details" jsonb,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "scenario_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playbook_id" varchar,
	"comparison_id" varchar,
	"user_id" varchar NOT NULL,
	"share_token" varchar NOT NULL,
	"expires_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "scenario_variants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playbook_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_baseline" boolean DEFAULT false NOT NULL,
	"assumptions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"query" text NOT NULL,
	"domain" varchar(50) DEFAULT 'general' NOT NULL,
	"jurisdiction" varchar(50),
	"answer" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb,
	"related_questions" jsonb DEFAULT '[]'::jsonb,
	"model_used" varchar(100),
	"provider_used" varchar(50),
	"tokens_used" integer,
	"processing_time_ms" integer,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentiment_trends" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"average_sentiment_score" integer,
	"positive_message_count" integer DEFAULT 0 NOT NULL,
	"neutral_message_count" integer DEFAULT 0 NOT NULL,
	"negative_message_count" integer DEFAULT 0 NOT NULL,
	"frustrated_message_count" integer DEFAULT 0 NOT NULL,
	"average_quality_score" integer,
	"conversation_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"billing_cycle" text,
	"amount" integer,
	"currency" text DEFAULT 'USD',
	"payment_gateway" text,
	"gateway_subscription_id" text,
	"gateway_customer_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text,
	"assigned_to" varchar,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "system_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"message" text NOT NULL,
	"details" jsonb,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_file_uploads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"vendor" text NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_length" integer NOT NULL,
	"storage_key" text NOT NULL,
	"encryption_nonce" text NOT NULL,
	"encrypted_file_key" text NOT NULL,
	"checksum" text NOT NULL,
	"scan_status" text DEFAULT 'pending' NOT NULL,
	"scan_details" jsonb,
	"form_type" text,
	"import_status" text DEFAULT 'pending' NOT NULL,
	"import_details" jsonb,
	"imported_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_quotas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"queries_limit" integer DEFAULT 500 NOT NULL,
	"queries_used" integer DEFAULT 0 NOT NULL,
	"documents_limit" integer DEFAULT 10 NOT NULL,
	"documents_used" integer DEFAULT 0 NOT NULL,
	"profiles_limit" integer DEFAULT 1 NOT NULL,
	"scenarios_limit" integer DEFAULT 0 NOT NULL,
	"scenarios_used" integer DEFAULT 0 NOT NULL,
	"deliverables_limit" integer DEFAULT 0 NOT NULL,
	"deliverables_used" integer DEFAULT 0 NOT NULL,
	"stack_lessons_limit" integer DEFAULT 5 NOT NULL,
	"stack_lessons_used" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usage_quotas_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"month" text NOT NULL,
	"queries_used" integer DEFAULT 0 NOT NULL,
	"documents_analyzed" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_behavior_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"total_conversations" integer DEFAULT 0 NOT NULL,
	"average_conversation_length" integer,
	"average_session_duration" integer,
	"preferred_time_of_day" text,
	"peak_usage_days" jsonb,
	"top_topics" jsonb,
	"domain_expertise" jsonb,
	"average_quality_score" integer,
	"satisfaction_trend" text,
	"churn_risk" text,
	"churn_risk_score" integer,
	"frustration_frequency" integer DEFAULT 0 NOT NULL,
	"abandonment_rate" integer,
	"follow_up_rate" integer,
	"next_likely_question" text,
	"next_likely_topic" text,
	"predicted_return_date" timestamp,
	"engagement_score" integer,
	"potential_upsell_candidate" boolean DEFAULT false NOT NULL,
	"last_analyzed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_behavior_patterns_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_llm_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"api_key" text,
	"model_name" text,
	"endpoint" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_llm_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"subscription_tier" text DEFAULT 'free' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"last_failed_login" timestamp,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" text,
	"mfa_backup_codes" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vector_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"embedding" text NOT NULL,
	"content_hash" text NOT NULL,
	"document_type" text NOT NULL,
	"source" text,
	"jurisdiction" text,
	"effective_date" timestamp,
	"expiry_date" timestamp,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_credit_purchases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"package_id" text NOT NULL,
	"tier" text NOT NULL,
	"minutes_purchased" real NOT NULL,
	"amount_usd" real NOT NULL,
	"payment_id" varchar,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_credits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"balance_minutes" real DEFAULT 0 NOT NULL,
	"free_minutes_used" real DEFAULT 0 NOT NULL,
	"free_minutes_limit" real DEFAULT 30 NOT NULL,
	"spending_cap_usd" real,
	"preferred_voice" text DEFAULT 'en-US-JennyNeural',
	"preferred_language" text DEFAULT 'en-US',
	"preferred_accent" text DEFAULT 'neutral',
	"auto_speak" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"conversation_id" varchar,
	"tier" text NOT NULL,
	"stt_provider" text,
	"tts_provider" text,
	"stt_duration_seconds" real DEFAULT 0 NOT NULL,
	"tts_characters" integer DEFAULT 0 NOT NULL,
	"voice_used" text,
	"language_used" text,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"charged_usd" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_usage_daily" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"tier" text NOT NULL,
	"total_stt_seconds" real DEFAULT 0 NOT NULL,
	"total_tts_characters" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" real DEFAULT 0 NOT NULL,
	"total_charged_usd" real DEFAULT 0 NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "white_label_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"company_name" text NOT NULL,
	"company_logo" text,
	"primary_color" text DEFAULT '#3B82F6' NOT NULL,
	"secondary_color" text DEFAULT '#10B981' NOT NULL,
	"custom_domain" text,
	"email_footer" text,
	"report_header" text,
	"report_footer" text,
	"enable_watermark" boolean DEFAULT true NOT NULL,
	"watermark_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "white_label_configs_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "accounting_integrations" ADD CONSTRAINT "accounting_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_costs" ADD CONSTRAINT "ai_provider_costs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_analytics" ADD CONSTRAINT "conversation_analytics_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_analytics" ADD CONSTRAINT "conversation_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_assets" ADD CONSTRAINT "deliverable_assets_instance_id_deliverable_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."deliverable_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_assets" ADD CONSTRAINT "deliverable_assets_version_id_deliverable_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."deliverable_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_instances" ADD CONSTRAINT "deliverable_instances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_instances" ADD CONSTRAINT "deliverable_instances_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_instances" ADD CONSTRAINT "deliverable_instances_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_instances" ADD CONSTRAINT "deliverable_instances_template_id_deliverable_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."deliverable_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_shares" ADD CONSTRAINT "deliverable_shares_instance_id_deliverable_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."deliverable_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_shares" ADD CONSTRAINT "deliverable_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_templates" ADD CONSTRAINT "deliverable_templates_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_instance_id_deliverable_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."deliverable_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finetuning_dataset" ADD CONSTRAINT "finetuning_dataset_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finetuning_dataset" ADD CONSTRAINT "finetuning_dataset_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_cases" ADD CONSTRAINT "forensic_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_cases" ADD CONSTRAINT "forensic_cases_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_cases" ADD CONSTRAINT "forensic_cases_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_documents" ADD CONSTRAINT "forensic_documents_case_id_forensic_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."forensic_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_evidence" ADD CONSTRAINT "forensic_evidence_finding_id_forensic_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."forensic_findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_evidence" ADD CONSTRAINT "forensic_evidence_document_id_forensic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."forensic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_findings" ADD CONSTRAINT "forensic_findings_case_id_forensic_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."forensic_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_findings" ADD CONSTRAINT "forensic_findings_document_id_forensic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."forensic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_reconciliations" ADD CONSTRAINT "forensic_reconciliations_case_id_forensic_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."forensic_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_reconciliations" ADD CONSTRAINT "forensic_reconciliations_source_document_id_forensic_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."forensic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_reconciliations" ADD CONSTRAINT "forensic_reconciliations_target_document_id_forensic_documents_id_fk" FOREIGN KEY ("target_document_id") REFERENCES "public"."forensic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_consents" ADD CONSTRAINT "gdpr_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_from_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_to_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_analytics" ADD CONSTRAINT "message_analytics_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_analytics" ADD CONSTRAINT "message_analytics_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_analytics" ADD CONSTRAINT "message_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_routing_logs" ADD CONSTRAINT "model_routing_logs_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_members" ADD CONSTRAINT "profile_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_sessions" ADD CONSTRAINT "roundtable_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_comparisons" ADD CONSTRAINT "scenario_comparisons_playbook_id_scenario_playbooks_id_fk" FOREIGN KEY ("playbook_id") REFERENCES "public"."scenario_playbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_comparisons" ADD CONSTRAINT "scenario_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_comparisons" ADD CONSTRAINT "scenario_comparisons_left_run_id_scenario_runs_id_fk" FOREIGN KEY ("left_run_id") REFERENCES "public"."scenario_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_comparisons" ADD CONSTRAINT "scenario_comparisons_right_run_id_scenario_runs_id_fk" FOREIGN KEY ("right_run_id") REFERENCES "public"."scenario_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_conversation_links" ADD CONSTRAINT "scenario_conversation_links_scenario_id_scenario_playbooks_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenario_playbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_conversation_links" ADD CONSTRAINT "scenario_conversation_links_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_metrics" ADD CONSTRAINT "scenario_metrics_run_id_scenario_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scenario_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_playbooks" ADD CONSTRAINT "scenario_playbooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_playbooks" ADD CONSTRAINT "scenario_playbooks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_runs" ADD CONSTRAINT "scenario_runs_variant_id_scenario_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."scenario_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_runs" ADD CONSTRAINT "scenario_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_shares" ADD CONSTRAINT "scenario_shares_playbook_id_scenario_playbooks_id_fk" FOREIGN KEY ("playbook_id") REFERENCES "public"."scenario_playbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_shares" ADD CONSTRAINT "scenario_shares_comparison_id_scenario_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."scenario_comparisons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_shares" ADD CONSTRAINT "scenario_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_variants" ADD CONSTRAINT "scenario_variants_playbook_id_scenario_playbooks_id_fk" FOREIGN KEY ("playbook_id") REFERENCES "public"."scenario_playbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentiment_trends" ADD CONSTRAINT "sentiment_trends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_alerts" ADD CONSTRAINT "system_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_file_uploads" ADD CONSTRAINT "tax_file_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_behavior_patterns" ADD CONSTRAINT "user_behavior_patterns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_llm_config" ADD CONSTRAINT "user_llm_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_credit_purchases" ADD CONSTRAINT "voice_credit_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_credits" ADD CONSTRAINT "voice_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_usage" ADD CONSTRAINT "voice_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_usage" ADD CONSTRAINT "voice_usage_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_usage_daily" ADD CONSTRAINT "voice_usage_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "white_label_configs" ADD CONSTRAINT "white_label_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_provider_costs_date_idx" ON "ai_provider_costs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "ai_provider_costs_provider_idx" ON "ai_provider_costs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "ai_provider_costs_user_id_idx" ON "ai_provider_costs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_provider_costs_tier_idx" ON "ai_provider_costs" USING btree ("subscription_tier");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "conversation_analytics_conversation_id_idx" ON "conversation_analytics" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_analytics_user_id_idx" ON "conversation_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversation_analytics_quality_score_idx" ON "conversation_analytics" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "conversation_analytics_created_at_idx" ON "conversation_analytics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "conversations_user_profile_updated_idx" ON "conversations" USING btree ("user_id","profile_id","updated_at");--> statement-breakpoint
CREATE INDEX "conversations_pinned_idx" ON "conversations" USING btree ("pinned");--> statement-breakpoint
CREATE INDEX "conversations_shared_token_idx" ON "conversations" USING btree ("shared_token");--> statement-breakpoint
CREATE INDEX "conversations_quality_score_idx" ON "conversations" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "conversations_resolved_idx" ON "conversations" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "conversations_metadata_idx" ON "conversations" USING btree ("metadata");--> statement-breakpoint
CREATE INDEX "conversations_user_created_idx" ON "conversations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "coupon_usage_coupon_id_idx" ON "coupon_usage" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "coupon_usage_user_id_idx" ON "coupon_usage" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_usage_unique_user_coupon_idx" ON "coupon_usage" USING btree ("coupon_id","user_id");--> statement-breakpoint
CREATE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "coupons_is_active_idx" ON "coupons" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "coupons_valid_until_idx" ON "coupons" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX "deliverable_assets_instance_idx" ON "deliverable_assets" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "deliverable_instances_user_profile_status_idx" ON "deliverable_instances" USING btree ("user_id","profile_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "deliverable_instances_conversation_idx" ON "deliverable_instances" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "deliverable_shares_token_idx" ON "deliverable_shares" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "deliverable_shares_instance_idx" ON "deliverable_shares" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "deliverable_templates_owner_type_default_idx" ON "deliverable_templates" USING btree ("owner_user_id","type","is_default");--> statement-breakpoint
CREATE INDEX "deliverable_templates_type_idx" ON "deliverable_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "deliverable_versions_instance_created_idx" ON "deliverable_versions" USING btree ("instance_id","created_at");--> statement-breakpoint
CREATE INDEX "finetuning_dataset_domain_idx" ON "finetuning_dataset" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "finetuning_dataset_jurisdiction_idx" ON "finetuning_dataset" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "finetuning_dataset_quality_score_idx" ON "finetuning_dataset" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "finetuning_dataset_is_approved_idx" ON "finetuning_dataset" USING btree ("is_approved");--> statement-breakpoint
CREATE INDEX "finetuning_dataset_is_used_idx" ON "finetuning_dataset" USING btree ("is_used");--> statement-breakpoint
CREATE INDEX "finetuning_dataset_created_at_idx" ON "finetuning_dataset" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "forensic_cases_user_profile_status_idx" ON "forensic_cases" USING btree ("user_id","profile_id","status");--> statement-breakpoint
CREATE INDEX "forensic_cases_severity_idx" ON "forensic_cases" USING btree ("severity_level");--> statement-breakpoint
CREATE INDEX "forensic_documents_case_source_idx" ON "forensic_documents" USING btree ("case_id","source_type");--> statement-breakpoint
CREATE INDEX "forensic_documents_type_idx" ON "forensic_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "forensic_evidence_finding_idx" ON "forensic_evidence" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "forensic_findings_case_severity_idx" ON "forensic_findings" USING btree ("case_id","severity");--> statement-breakpoint
CREATE INDEX "forensic_findings_status_idx" ON "forensic_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "forensic_reconciliations_case_status_idx" ON "forensic_reconciliations" USING btree ("case_id","status");--> statement-breakpoint
CREATE INDEX "forensic_reconciliations_documents_idx" ON "forensic_reconciliations" USING btree ("source_document_id","target_document_id");--> statement-breakpoint
CREATE INDEX "interaction_logs_conversation_id_idx" ON "interaction_logs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "interaction_logs_user_id_idx" ON "interaction_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interaction_logs_user_rating_idx" ON "interaction_logs" USING btree ("user_rating");--> statement-breakpoint
CREATE INDEX "interaction_logs_needs_review_idx" ON "interaction_logs" USING btree ("needs_review");--> statement-breakpoint
CREATE INDEX "interaction_logs_created_at_idx" ON "interaction_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "knowledge_edges_from_idx" ON "knowledge_edges" USING btree ("from_node_id");--> statement-breakpoint
CREATE INDEX "knowledge_edges_to_idx" ON "knowledge_edges" USING btree ("to_node_id");--> statement-breakpoint
CREATE INDEX "knowledge_edges_type_idx" ON "knowledge_edges" USING btree ("edge_type");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_type_idx" ON "knowledge_nodes" USING btree ("node_type");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_label_idx" ON "knowledge_nodes" USING btree ("label");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_status_idx" ON "maintenance_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_type_idx" ON "maintenance_tasks" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_next_run_idx" ON "maintenance_tasks" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "message_analytics_message_id_idx" ON "message_analytics" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_analytics_conversation_id_idx" ON "message_analytics" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "message_analytics_user_id_idx" ON "message_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_analytics_sentiment_idx" ON "message_analytics" USING btree ("user_sentiment");--> statement-breakpoint
CREATE INDEX "message_feedback_message_id_idx" ON "message_feedback" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_feedback_conversation_id_idx" ON "message_feedback" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "message_feedback_user_id_idx" ON "message_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_feedback_rating_idx" ON "message_feedback" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "message_feedback_created_at_idx" ON "message_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_role_created_idx" ON "messages" USING btree ("role","created_at");--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_subscription_id_idx" ON "payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_gateway_order_id_idx" ON "payments" USING btree ("gateway_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_gateway_payment_id_idx" ON "payments" USING btree ("gateway_payment_id");--> statement-breakpoint
CREATE INDEX "profile_members_profile_id_idx" ON "profile_members" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_type_idx" ON "profiles" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_personal_unique_idx" ON "profiles" USING btree ("user_id") WHERE "profiles"."type" = 'personal';--> statement-breakpoint
CREATE INDEX "regulatory_alerts_jurisdiction_idx" ON "regulatory_alerts" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "regulatory_alerts_alert_type_idx" ON "regulatory_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "regulatory_alerts_severity_idx" ON "regulatory_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "regulatory_alerts_created_at_idx" ON "regulatory_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "roundtable_sessions_user_id_idx" ON "roundtable_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "roundtable_sessions_status_idx" ON "roundtable_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "roundtable_sessions_started_at_idx" ON "roundtable_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "scenario_comparisons_playbook_idx" ON "scenario_comparisons" USING btree ("playbook_id");--> statement-breakpoint
CREATE INDEX "scenario_comparisons_runs_idx" ON "scenario_comparisons" USING btree ("left_run_id","right_run_id");--> statement-breakpoint
CREATE INDEX "scenario_conversation_links_idx" ON "scenario_conversation_links" USING btree ("scenario_id","conversation_id");--> statement-breakpoint
CREATE INDEX "scenario_metrics_run_metric_idx" ON "scenario_metrics" USING btree ("run_id","metric_key");--> statement-breakpoint
CREATE INDEX "scenario_metrics_category_idx" ON "scenario_metrics" USING btree ("metric_category");--> statement-breakpoint
CREATE INDEX "scenario_playbooks_user_profile_idx" ON "scenario_playbooks" USING btree ("user_id","profile_id");--> statement-breakpoint
CREATE INDEX "scenario_playbooks_category_idx" ON "scenario_playbooks" USING btree ("category");--> statement-breakpoint
CREATE INDEX "scenario_runs_variant_id_idx" ON "scenario_runs" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "scenario_runs_status_idx" ON "scenario_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scenario_shares_token_idx" ON "scenario_shares" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "scenario_shares_playbook_idx" ON "scenario_shares" USING btree ("playbook_id");--> statement-breakpoint
CREATE INDEX "scenario_variants_playbook_baseline_idx" ON "scenario_variants" USING btree ("playbook_id","is_baseline");--> statement-breakpoint
CREATE INDEX "search_history_user_id_idx" ON "search_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_history_domain_idx" ON "search_history" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "search_history_user_created_idx" ON "search_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "search_history_pinned_idx" ON "search_history" USING btree ("pinned");--> statement-breakpoint
CREATE INDEX "sentiment_trends_user_id_date_idx" ON "sentiment_trends" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_gateway_subscription_id_idx" ON "subscriptions" USING btree ("gateway_subscription_id");--> statement-breakpoint
CREATE INDEX "system_alerts_type_idx" ON "system_alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "system_alerts_severity_idx" ON "system_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "system_alerts_acknowledged_idx" ON "system_alerts" USING btree ("acknowledged");--> statement-breakpoint
CREATE INDEX "system_alerts_created_at_idx" ON "system_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "system_alerts_unique_idx" ON "system_alerts" USING btree ("source","source_id","message");--> statement-breakpoint
CREATE INDEX "tax_file_uploads_user_id_idx" ON "tax_file_uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tax_file_uploads_scan_status_idx" ON "tax_file_uploads" USING btree ("scan_status");--> statement-breakpoint
CREATE INDEX "tax_file_uploads_import_status_idx" ON "tax_file_uploads" USING btree ("import_status");--> statement-breakpoint
CREATE INDEX "tax_file_uploads_vendor_idx" ON "tax_file_uploads" USING btree ("vendor");--> statement-breakpoint
CREATE INDEX "usage_quotas_user_id_idx" ON "usage_quotas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_quotas_plan_idx" ON "usage_quotas" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "user_behavior_patterns_user_id_idx" ON "user_behavior_patterns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_behavior_patterns_churn_risk_idx" ON "user_behavior_patterns" USING btree ("churn_risk");--> statement-breakpoint
CREATE INDEX "user_behavior_patterns_engagement_score_idx" ON "user_behavior_patterns" USING btree ("engagement_score");--> statement-breakpoint
CREATE UNIQUE INDEX "vector_embeddings_content_hash_idx" ON "vector_embeddings" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "vector_embeddings_document_type_idx" ON "vector_embeddings" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "vector_embeddings_jurisdiction_idx" ON "vector_embeddings" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "vector_embeddings_source_idx" ON "vector_embeddings" USING btree ("source");--> statement-breakpoint
CREATE INDEX "voice_credit_purchases_user_id_idx" ON "voice_credit_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voice_credit_purchases_created_at_idx" ON "voice_credit_purchases" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_credits_user_id_idx" ON "voice_credits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voice_credits_tier_idx" ON "voice_credits" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "voice_usage_user_id_idx" ON "voice_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voice_usage_tier_idx" ON "voice_usage" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "voice_usage_created_at_idx" ON "voice_usage" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_usage_daily_user_date_idx" ON "voice_usage_daily" USING btree ("user_id","date","tier");--> statement-breakpoint
CREATE INDEX "voice_usage_daily_date_idx" ON "voice_usage_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "white_label_configs_user_id_idx" ON "white_label_configs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "white_label_configs_custom_domain_idx" ON "white_label_configs" USING btree ("custom_domain");