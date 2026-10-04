CREATE TYPE "public"."hiring_activity_type" AS ENUM('VIDEO', 'AUDIO', 'LONG_TEXT', 'SHORT_TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'FILE_UPLOAD');--> statement-breakpoint
CREATE TYPE "public"."hiring_member_role" AS ENUM('EVALUATOR');--> statement-breakpoint
CREATE TYPE "public"."hiring_opening_status" AS ENUM('DRAFT', 'OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."hiring_proctor_level" AS ENUM('OFF', 'BASIC', 'STANDARD', 'STRICT');--> statement-breakpoint
CREATE TYPE "public"."hiring_stage_timeout" AS ENUM('AUTO_SUBMIT', 'AUTO_CLOSE', 'ALLOW_GRACE', 'ALLOW_LATE');--> statement-breakpoint
CREATE TYPE "public"."hiring_version_status" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
ALTER TYPE "public"."ai_purpose" ADD VALUE 'HIRING_DRAFT';--> statement-breakpoint
ALTER TYPE "public"."ai_purpose" ADD VALUE 'QUESTION_CHECK';--> statement-breakpoint
CREATE TABLE "hiring_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"type" "hiring_activity_type" NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"prompt" jsonb NOT NULL,
	"note" jsonb DEFAULT '{"tr":"","en":""}'::jsonb NOT NULL,
	"internal_question" text,
	"expected_behaviours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"red_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"manager_notes" text,
	"answer_examples" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"think_seconds" integer DEFAULT 60 NOT NULL,
	"flexible_think" boolean DEFAULT true NOT NULL,
	"answer_seconds" integer,
	"max_takes" integer DEFAULT 2 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "hiring_activity_takes" CHECK ("hiring_activities"."max_takes" BETWEEN 1 AND 5),
	CONSTRAINT "hiring_activity_think" CHECK ("hiring_activities"."think_seconds" BETWEEN 0 AND 600)
);
--> statement-breakpoint
CREATE TABLE "hiring_activity_competencies" (
	"activity_id" uuid NOT NULL,
	"competency_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	CONSTRAINT "hiring_activity_competencies_activity_id_competency_id_pk" PRIMARY KEY("activity_id","competency_id"),
	CONSTRAINT "hiring_at_most_two_competencies" CHECK ("hiring_activity_competencies"."order_index" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE "hiring_opening_members" (
	"opening_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "hiring_member_role" DEFAULT 'EVALUATOR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hiring_opening_members_opening_id_user_id_pk" PRIMARY KEY("opening_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "hiring_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "hiring_opening_status" DEFAULT 'DRAFT' NOT NULL,
	"deadline_at" timestamp with time zone,
	"owner_id" uuid,
	"decision_maker_id" uuid,
	"backup_decision_maker_id" uuid,
	"blind_mode" boolean DEFAULT false NOT NULL,
	"min_evaluations" integer DEFAULT 2 NOT NULL,
	"feedback_days" integer DEFAULT 7 NOT NULL,
	"candidate_contact_email" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hiring_min_evaluations" CHECK ("hiring_openings"."min_evaluations" BETWEEN 1 AND 5),
	CONSTRAINT "hiring_feedback_days" CHECK ("hiring_openings"."feedback_days" BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE TABLE "hiring_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb DEFAULT '{"tr":"","en":""}'::jsonb NOT NULL,
	"internal_purpose" text,
	"duration_seconds" integer DEFAULT 600 NOT NULL,
	"grace_seconds" integer DEFAULT 0 NOT NULL,
	"on_timeout" "hiring_stage_timeout" DEFAULT 'AUTO_SUBMIT' NOT NULL,
	"back_navigation" boolean DEFAULT false NOT NULL,
	CONSTRAINT "hiring_stage_duration" CHECK ("hiring_stages"."duration_seconds" BETWEEN 60 AND 7200)
);
--> statement-breakpoint
CREATE TABLE "hiring_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"opening_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "hiring_version_status" DEFAULT 'DRAFT' NOT NULL,
	"default_locale" "locale" DEFAULT 'tr' NOT NULL,
	"locale_set" jsonb DEFAULT '["tr"]'::jsonb NOT NULL,
	"intro_title" jsonb,
	"intro_body" jsonb,
	"consent_text_id" uuid,
	"proctor_level" "hiring_proctor_level" DEFAULT 'BASIC' NOT NULL,
	"practice_enabled" boolean DEFAULT true NOT NULL,
	"scorecard" jsonb,
	"weights_enabled" boolean DEFAULT false NOT NULL,
	"draft_weights" jsonb,
	"previewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hiring_published_has_scorecard" CHECK ("hiring_versions"."status" <> 'PUBLISHED' OR "hiring_versions"."scorecard" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "hiring_weight_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hiring_weights" (
	"weight_set_id" uuid NOT NULL,
	"competency_id" uuid NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	CONSTRAINT "hiring_weights_weight_set_id_competency_id_pk" PRIMARY KEY("weight_set_id","competency_id"),
	CONSTRAINT "hiring_weight_percentage" CHECK ("hiring_weights"."percentage" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "hiring_activities" ADD CONSTRAINT "hiring_activities_stage_id_hiring_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."hiring_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_activity_competencies" ADD CONSTRAINT "hiring_activity_competencies_activity_id_hiring_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."hiring_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_activity_competencies" ADD CONSTRAINT "hiring_activity_competencies_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_opening_members" ADD CONSTRAINT "hiring_opening_members_opening_id_hiring_openings_id_fk" FOREIGN KEY ("opening_id") REFERENCES "public"."hiring_openings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_opening_members" ADD CONSTRAINT "hiring_opening_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_openings" ADD CONSTRAINT "hiring_openings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_openings" ADD CONSTRAINT "hiring_openings_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_openings" ADD CONSTRAINT "hiring_openings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_openings" ADD CONSTRAINT "hiring_openings_decision_maker_id_users_id_fk" FOREIGN KEY ("decision_maker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_openings" ADD CONSTRAINT "hiring_openings_backup_decision_maker_id_users_id_fk" FOREIGN KEY ("backup_decision_maker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_stages" ADD CONSTRAINT "hiring_stages_version_id_hiring_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."hiring_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_versions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_versions_opening_id_hiring_openings_id_fk" FOREIGN KEY ("opening_id") REFERENCES "public"."hiring_openings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_versions_consent_text_id_consent_texts_id_fk" FOREIGN KEY ("consent_text_id") REFERENCES "public"."consent_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_weight_sets" ADD CONSTRAINT "hiring_weight_sets_version_id_hiring_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."hiring_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_weight_sets" ADD CONSTRAINT "hiring_weight_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_weights" ADD CONSTRAINT "hiring_weights_weight_set_id_hiring_weight_sets_id_fk" FOREIGN KEY ("weight_set_id") REFERENCES "public"."hiring_weight_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_weights" ADD CONSTRAINT "hiring_weights_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hiring_activities_stage_idx" ON "hiring_activities" USING btree ("stage_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "hiring_activity_competency_slot" ON "hiring_activity_competencies" USING btree ("activity_id","order_index");--> statement-breakpoint
CREATE INDEX "hiring_activity_competencies_competency_idx" ON "hiring_activity_competencies" USING btree ("competency_id");--> statement-breakpoint
CREATE INDEX "hiring_opening_members_user_idx" ON "hiring_opening_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "hiring_openings_org_status_idx" ON "hiring_openings" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "hiring_openings_position_idx" ON "hiring_openings" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "hiring_stages_version_idx" ON "hiring_stages" USING btree ("version_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "hiring_version_number" ON "hiring_versions" USING btree ("opening_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "one_draft_per_opening" ON "hiring_versions" USING btree ("opening_id") WHERE status = 'DRAFT';--> statement-breakpoint
CREATE INDEX "hiring_weight_sets_version_idx" ON "hiring_weight_sets" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_weight_set" ON "hiring_weight_sets" USING btree ("version_id") WHERE is_active;