CREATE TABLE "whiteboard_artifacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"message_id" varchar NOT NULL,
	"sequence" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb NOT NULL,
	"canvas_x" integer NOT NULL,
	"canvas_y" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "artifact_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "whiteboard_artifacts" ADD CONSTRAINT "whiteboard_artifacts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whiteboard_artifacts" ADD CONSTRAINT "whiteboard_artifacts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whiteboard_conv_seq_idx" ON "whiteboard_artifacts" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE INDEX "whiteboard_message_idx" ON "whiteboard_artifacts" USING btree ("message_id");
