CREATE TYPE "public"."actor_type" AS ENUM('ADMIN', 'SYSTEM', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'OFFICER');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('SENT', 'SCHEDULED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('NONE', 'VETERAN', 'SENIOR');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('PRIMARY', 'DEPENDENT');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('PENDING_RENEWAL', 'ACTIVE', 'LAPSED', 'NEW_PENDING');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('STRIPE', 'CASH', 'CHECK');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communications_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"recipient_filter" jsonb NOT NULL,
	"recipient_count" integer NOT NULL,
	"sent_by_admin_id" uuid NOT NULL,
	"sent_at" timestamp with time zone,
	"status" "broadcast_status" DEFAULT 'SENT' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"email_provider" text DEFAULT 'resend' NOT NULL,
	"resend_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text DEFAULT 'KY' NOT NULL,
	"zip" text NOT NULL,
	"phone" text,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"date_of_birth" date NOT NULL,
	"role" "member_role" NOT NULL,
	"is_veteran_disabled" boolean DEFAULT false NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"admin_role" "admin_role",
	"must_change_password" boolean DEFAULT false NOT NULL,
	"membership_number" integer,
	"driver_license_encrypted" text,
	"driver_license_state" text,
	"veteran_doc_encrypted" text,
	"veteran_doc_filename" text,
	"veteran_doc_mime_type" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"emergency_contact_relationship" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_email_unique" UNIQUE("email"),
	CONSTRAINT "member_membership_number_unique" UNIQUE("membership_number")
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"membership_year_id" uuid NOT NULL,
	"status" "membership_status" NOT NULL,
	"price_cents" integer NOT NULL,
	"discount_type" "discount_type" DEFAULT 'NONE' NOT NULL,
	"membership_tier_id" uuid,
	"enrolled_at" timestamp with time zone,
	"lapsed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_household_year_unique" UNIQUE("household_id","membership_year_id")
);
--> statement-breakpoint
CREATE TABLE "membership_tier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_tier_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "membership_year" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"renewal_deadline" timestamp with time zone NOT NULL,
	"capacity_cap" integer DEFAULT 350 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_year_year_unique" UNIQUE("year")
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"check_number" text,
	"recorded_by_admin_id" uuid,
	"status" "payment_status" NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "signup_event_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_year_id" uuid NOT NULL,
	"event_date" date NOT NULL,
	"event_start_time" time NOT NULL,
	"event_end_time" time NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"location" text DEFAULT '6701 Old Nest Egg Rd, Mt Sterling, KY 40353' NOT NULL,
	"notes" text,
	"updated_by_admin_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signup_event_config_membership_year_id_unique" UNIQUE("membership_year_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_member_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications_log" ADD CONSTRAINT "communications_log_sent_by_admin_id_member_id_fk" FOREIGN KEY ("sent_by_admin_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_membership_year_id_membership_year_id_fk" FOREIGN KEY ("membership_year_id") REFERENCES "public"."membership_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_membership_tier_id_membership_tier_id_fk" FOREIGN KEY ("membership_tier_id") REFERENCES "public"."membership_tier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_membership_id_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."membership"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_recorded_by_admin_id_member_id_fk" FOREIGN KEY ("recorded_by_admin_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_event_config" ADD CONSTRAINT "signup_event_config_membership_year_id_membership_year_id_fk" FOREIGN KEY ("membership_year_id") REFERENCES "public"."membership_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_event_config" ADD CONSTRAINT "signup_event_config_updated_by_admin_id_member_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");