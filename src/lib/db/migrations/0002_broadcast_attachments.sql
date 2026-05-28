CREATE TABLE IF NOT EXISTS "broadcast_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid,
	"communications_log_id" uuid,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"is_inline" boolean DEFAULT false NOT NULL,
	"data" bytea NOT NULL,
	"created_by_admin_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broadcast_attachment_owner_check" CHECK ("draft_id" IS NOT NULL OR "communications_log_id" IS NOT NULL)
);--> statement-breakpoint
ALTER TABLE "broadcast_attachment" ADD CONSTRAINT "broadcast_attachment_communications_log_id_fk" FOREIGN KEY ("communications_log_id") REFERENCES "communications_log"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "broadcast_attachment" ADD CONSTRAINT "broadcast_attachment_created_by_admin_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "member"("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "broadcast_attachment_draft_id_idx" ON "broadcast_attachment" ("draft_id") WHERE "draft_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "broadcast_attachment_communications_log_id_idx" ON "broadcast_attachment" ("communications_log_id") WHERE "communications_log_id" IS NOT NULL;
