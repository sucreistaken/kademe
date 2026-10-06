-- Reviewed by hand: two new enums, one new ai_purpose value and one new table.
-- creation_drafts holds the Advanced box's drafts (spec 2026-10-06-advanced-ai-create-design 5.3),
-- one row per typed sentence, readable only by its user. ADD VALUE on ai_purpose is
-- not used by any statement in this file, so it is safe inside the migration's
-- transaction (PostgreSQL 12+). No existing row is read or written.
CREATE TYPE "public"."creation_kind" AS ENUM('EXAM', 'QUESTION_SET', 'POSITION');--> statement-breakpoint
CREATE TYPE "public"."creation_status" AS ENUM('ASKING', 'DRAFTED', 'APPLIED', 'DISCARDED', 'FAILED');--> statement-breakpoint
ALTER TYPE "public"."ai_purpose" ADD VALUE 'CREATE_ROUTER';--> statement-breakpoint
CREATE TABLE "creation_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"request" text NOT NULL,
	"rounds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kind" "creation_kind",
	"summary" text,
	"params" jsonb,
	"draft" jsonb,
	"status" "creation_status" DEFAULT 'ASKING' NOT NULL,
	"failure" text,
	"result" jsonb,
	"result_href" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creation_request_length" CHECK (char_length("creation_drafts"."request") <= 4000)
);
--> statement-breakpoint
ALTER TABLE "creation_drafts" ADD CONSTRAINT "creation_drafts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creation_drafts" ADD CONSTRAINT "creation_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creation_drafts_owner_idx" ON "creation_drafts" USING btree ("org_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "creation_drafts_created_idx" ON "creation_drafts" USING btree ("created_at");