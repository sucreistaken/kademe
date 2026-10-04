-- Reviewed by hand: the UNIQUE (id, opening_id, org_id) on hiring_versions moved
-- above the composite foreign key that references it (drizzle-kit emits it
-- after, and Postgres refuses a foreign key without a unique target). DDL fires
-- no row triggers, so the 0006 freeze of published versions is not touched.
CREATE TABLE "candidate_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_request_kind" CHECK ("candidate_requests"."kind" IN ('ACCOMMODATION', 'NEW_LINK'))
);
--> statement-breakpoint
CREATE TABLE "hiring_assessments" (
	"assessment_id" uuid PRIMARY KEY NOT NULL,
	"solution" "solution" DEFAULT 'HIRING' NOT NULL,
	"org_id" uuid NOT NULL,
	"opening_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"extra_time_pct" integer DEFAULT 0 NOT NULL,
	"extra_time_chosen_at" timestamp with time zone,
	"consent_text_id" uuid NOT NULL,
	"proctor_level" "hiring_proctor_level" DEFAULT 'OFF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hiring_assessment_is_hiring" CHECK ("hiring_assessments"."solution" = 'HIRING'),
	CONSTRAINT "hiring_extra_time_pct" CHECK ("hiring_assessments"."extra_time_pct" IN (0, 25, 50))
);
--> statement-breakpoint
CREATE TABLE "hiring_assignments" (
	"assessment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hiring_assignments_assessment_id_user_id_pk" PRIMARY KEY("assessment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "hiring_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_run_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"media_asset_id" uuid,
	"take_asset_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"file_asset_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"takes_used" integer DEFAULT 0 NOT NULL,
	"used_text_alternative" boolean DEFAULT false NOT NULL,
	"auto_score" real,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hiring_response_takes" CHECK ("hiring_responses"."takes_used" >= 0),
	CONSTRAINT "hiring_response_auto_score" CHECK ("hiring_responses"."auto_score" IS NULL OR ("hiring_responses"."auto_score" >= 0 AND "hiring_responses"."auto_score" <= 1))
);
--> statement-breakpoint
CREATE TABLE "hiring_stage_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"started_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"completion" "run_completion" DEFAULT 'PENDING' NOT NULL,
	"was_late" boolean DEFAULT false NOT NULL,
	"carried_from_stage_run_id" uuid,
	CONSTRAINT "hiring_stage_run_order" CHECK ("hiring_stage_runs"."order_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hiring_survey_responses" (
	"assessment_id" uuid PRIMARY KEY NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hiring_survey_rating" CHECK ("hiring_survey_responses"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "consent_texts" ADD COLUMN "solution" "solution" DEFAULT 'LANGUAGE_EXAM' NOT NULL;--> statement-breakpoint
ALTER TABLE "hiring_openings" ADD COLUMN "finish_survey_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_requests" ADD CONSTRAINT "candidate_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_requests" ADD CONSTRAINT "candidate_requests_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_requests" ADD CONSTRAINT "candidate_requests_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_versions_id_opening_org" UNIQUE("id","opening_id","org_id");--> statement-breakpoint
ALTER TABLE "hiring_assessments" ADD CONSTRAINT "hiring_assessments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_assessments" ADD CONSTRAINT "hiring_assessments_consent_text_id_consent_texts_id_fk" FOREIGN KEY ("consent_text_id") REFERENCES "public"."consent_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_assessments" ADD CONSTRAINT "hiring_assessments_assessment_fk" FOREIGN KEY ("assessment_id","solution") REFERENCES "public"."assessments"("id","solution") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_assessments" ADD CONSTRAINT "hiring_assessments_opening_fk" FOREIGN KEY ("opening_id","org_id") REFERENCES "public"."hiring_openings"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_assessments" ADD CONSTRAINT "hiring_assessments_version_fk" FOREIGN KEY ("version_id","opening_id","org_id") REFERENCES "public"."hiring_versions"("id","opening_id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_assignments" ADD CONSTRAINT "hiring_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_assignments" ADD CONSTRAINT "hiring_assignments_assessment_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."hiring_assessments"("assessment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_responses" ADD CONSTRAINT "hiring_responses_stage_run_id_hiring_stage_runs_id_fk" FOREIGN KEY ("stage_run_id") REFERENCES "public"."hiring_stage_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_responses" ADD CONSTRAINT "hiring_responses_activity_id_hiring_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."hiring_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_responses" ADD CONSTRAINT "hiring_responses_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_stage_runs" ADD CONSTRAINT "hiring_stage_runs_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_stage_runs" ADD CONSTRAINT "hiring_stage_runs_stage_id_hiring_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."hiring_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_stage_runs" ADD CONSTRAINT "hiring_stage_runs_carried_from_fk" FOREIGN KEY ("carried_from_stage_run_id") REFERENCES "public"."hiring_stage_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_survey_responses" ADD CONSTRAINT "hiring_survey_assessment_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."hiring_assessments"("assessment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_requests_org_created_idx" ON "candidate_requests" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "candidate_requests_assessment_idx" ON "candidate_requests" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "hiring_assessments_opening_idx" ON "hiring_assessments" USING btree ("opening_id");--> statement-breakpoint
CREATE INDEX "hiring_assignments_user_idx" ON "hiring_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hiring_response_per_activity" ON "hiring_responses" USING btree ("stage_run_id","activity_id");--> statement-breakpoint
CREATE INDEX "hiring_responses_media_idx" ON "hiring_responses" USING btree ("media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hiring_stage_run_per_attempt" ON "hiring_stage_runs" USING btree ("attempt_id","stage_id");--> statement-breakpoint
CREATE INDEX "hiring_stage_runs_deadline_idx" ON "hiring_stage_runs" USING btree ("deadline_at");
