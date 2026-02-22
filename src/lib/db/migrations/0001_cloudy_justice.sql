ALTER TYPE "public"."membership_status" ADD VALUE 'REMOVED';--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "removal_reason" text;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "removal_notes" text;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "removed_at" timestamp with time zone;