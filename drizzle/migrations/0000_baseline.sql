CREATE TYPE "public"."ai_purpose" AS ENUM('ITEM_GENERATION', 'TTS', 'TRANSCRIPTION', 'WRITING_GRADING', 'SPEAKING_GRADING', 'PROCTOR_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."ai_review_status" AS ENUM('QUEUED', 'DONE', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."ai_verdict" AS ENUM('CONFIRMED', 'NOT_CONFIRMED', 'UNCLEAR');--> statement-breakpoint
CREATE TYPE "public"."blueprint_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."cefr_level" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
CREATE TYPE "public"."decider" AS ENUM('ENGINE', 'AI', 'TEACHER');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('WEBCAM_FRAME', 'SCREEN_FRAME', 'CLIP_VIDEO', 'CLIP_AUDIO');--> statement-breakpoint
CREATE TYPE "public"."evidence_trigger" AS ENUM('REFERENCE', 'PERIODIC', 'VIOLATION');--> statement-breakpoint
CREATE TYPE "public"."exam_mode" AS ENUM('PLACEMENT', 'LEVEL_VERIFICATION');--> statement-breakpoint
CREATE TYPE "public"."grading_status" AS ENUM('PENDING', 'AI_PROPOSED', 'AI_FAILED', 'CONFIRMED', 'OVERRIDDEN');--> statement-breakpoint
CREATE TYPE "public"."integrity_outcome" AS ENUM('VALID', 'RETAKE', 'INVALID');--> statement-breakpoint
CREATE TYPE "public"."item_origin" AS ENUM('SEED', 'TEACHER', 'AI');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('DRAFT', 'APPROVED', 'REJECTED', 'RETIRED');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('SINGLE_CHOICE', 'MULTI_CHOICE', 'TRUE_FALSE_NG', 'GAP_FILL', 'MATCHING', 'SHORT_TEXT', 'WRITING_PROMPT', 'SPEAKING_PROMPT');--> statement-breakpoint
CREATE TYPE "public"."link_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('tr', 'en');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('UPLOADING', 'READY', 'INCOMPLETE', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."proctor_event_type" AS ENUM('FULLSCREEN_EXIT', 'TAB_HIDDEN', 'FOCUS_LOST', 'SCREEN_SHARE_STOPPED', 'SCREEN_SHARE_WRONG_SURFACE', 'SECOND_SCREEN_DETECTED', 'CAMERA_LOST', 'MIC_LOST', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'CONTEXT_MENU', 'BLOCKED_SHORTCUT', 'PRINT_ATTEMPT', 'LARGE_TEXT_INSERT', 'WINDOW_RESIZED', 'EXTENSION_INJECTED', 'AUTOMATION', 'VIRTUAL_CAMERA', 'OFFLINE', 'PAGE_UNLOAD', 'RESUMED', 'DUPLICATE_TAB', 'NO_FACE', 'MULTIPLE_FACES', 'GAZE_AWAY', 'PHONE_DETECTED', 'VOICE_DETECTED', 'PROCTOR_MODEL_UNAVAILABLE', 'HEARTBEAT_GAP', 'SNAPSHOT_GAP', 'DUPLICATE_SESSION', 'IP_CHANGED', 'TERMINATED');--> statement-breakpoint
CREATE TYPE "public"."proctor_severity" AS ENUM('INFO', 'LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."proctor_source" AS ENUM('BROWSER', 'MODEL', 'SERVER');--> statement-breakpoint
CREATE TYPE "public"."result_status" AS ENUM('IN_PROGRESS', 'AWAITING_GRADING', 'AWAITING_REVIEW', 'FINAL');--> statement-breakpoint
CREATE TYPE "public"."run_completion" AS ENUM('PENDING', 'COMPLETE', 'PARTIAL', 'SKIPPED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."section" AS ENUM('GRAMMAR', 'READING', 'LISTENING', 'WRITING', 'SPEAKING');--> statement-breakpoint
CREATE TYPE "public"."teacher_flag_status" AS ENUM('OPEN', 'CONFIRMED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'TEACHER', 'REVIEWER');--> statement-breakpoint
CREATE TYPE "public"."verification_outcome" AS ENUM('PASS', 'FAIL', 'INCONCLUSIVE');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid,
	"meta" jsonb,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"media_retention_days" integer DEFAULT 180 NOT NULL,
	"candidate_retention_days" integer DEFAULT 730 NOT NULL,
	"evidence_retention_days" integer DEFAULT 90 NOT NULL,
	"contact_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_setup_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_setup_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'TEACHER' NOT NULL,
	"totp_secret" text,
	"totp_confirmed_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "exam_blueprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"mode" "exam_mode" NOT NULL,
	"status" "blueprint_status" DEFAULT 'DRAFT' NOT NULL,
	"config" jsonb NOT NULL,
	"created_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exam_result_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"field" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"changed_by" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"status" "result_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"computed" jsonb,
	"skill_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"overall_override" "cefr_level",
	"overall_override_reason" text,
	"final_overall" "cefr_level",
	"final_skills" jsonb,
	"final_outcome" "verification_outcome",
	"finalized_by" uuid,
	"finalized_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"released_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_results_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"section" "section" NOT NULL,
	"level" "cefr_level" NOT NULL,
	"difficulty" real NOT NULL,
	"type" "item_type" NOT NULL,
	"skill_tag" text NOT NULL,
	"stimulus_id" uuid,
	"order_in_stimulus" integer DEFAULT 0 NOT NULL,
	"prompt" text NOT NULL,
	"content" jsonb NOT NULL,
	"answer_key" jsonb NOT NULL,
	"rubric" jsonb,
	"explanation" text,
	"points" integer DEFAULT 1 NOT NULL,
	"status" "item_status" DEFAULT 'DRAFT' NOT NULL,
	"origin" "item_origin" DEFAULT 'TEACHER' NOT NULL,
	"ai_run_id" uuid,
	"created_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"exposure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "response_grading_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grading_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"reason" text NOT NULL,
	"changed_by" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "response_gradings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_response_id" uuid NOT NULL,
	"status" "grading_status" DEFAULT 'PENDING' NOT NULL,
	"task_level" "cefr_level" NOT NULL,
	"ai_proposal" jsonb,
	"ai_level" "cefr_level",
	"ai_run_id" uuid,
	"ai_model" text,
	"ai_error" text,
	"proposed_at" timestamp with time zone,
	"final_level" "cefr_level",
	"final_criteria" jsonb,
	"decider" "decider",
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "response_gradings_item_response_id_unique" UNIQUE("item_response_id")
);
--> statement-breakpoint
CREATE TABLE "stimuli" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"section" "section" NOT NULL,
	"level" "cefr_level" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"speakers" jsonb,
	"audio_key" text,
	"audio_mime" text,
	"audio_duration_ms" integer,
	"audio_source_hash" text,
	"origin" "item_origin" DEFAULT 'TEACHER' NOT NULL,
	"ai_run_id" uuid,
	"seed_key" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" "link_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"not_before" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts_allowed" integer DEFAULT 1 NOT NULL,
	"first_seen_ip" text,
	"first_seen_user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"blueprint_name" text NOT NULL,
	"blueprint_snapshot" jsonb NOT NULL,
	"mode" "exam_mode" NOT NULL,
	"claimed_level" "cefr_level",
	"locale" "locale" DEFAULT 'tr' NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claimed_for_verification" CHECK ("assessments"."mode" <> 'LEVEL_VERIFICATION' OR "assessments"."claimed_level" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_reason" text,
	"device_checked_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"integrity_summary" jsonb,
	"integrity_computed_at" timestamp with time zone,
	"integrity_outcome" "integrity_outcome",
	"integrity_note" text,
	"integrity_decided_by" uuid,
	"integrity_decided_at" timestamp with time zone,
	"terminated_at" timestamp with time zone,
	"termination_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"full_name" text,
	"email" text,
	"phone" text,
	"location" text,
	"extra" jsonb DEFAULT '{}'::jsonb,
	"deleted_at" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_run_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"item_snapshot" jsonb NOT NULL,
	"presentation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"answer" jsonb,
	"served_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"score" real,
	"is_correct" boolean,
	"theta_after" real,
	"se_after" real,
	"not_reached" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"section_run_id" uuid,
	"item_response_id" uuid,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"duration_ms" integer,
	"bytes" bigint,
	"checksum" text,
	"status" "media_status" DEFAULT 'UPLOADING' NOT NULL,
	"upload_id" text,
	"parts" jsonb DEFAULT '[]'::jsonb,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"section" "section" NOT NULL,
	"order_index" integer NOT NULL,
	"started_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"completion" "run_completion" DEFAULT 'PENDING' NOT NULL,
	"was_late" boolean DEFAULT false NOT NULL,
	"item_plan" jsonb,
	"task_levels" jsonb,
	"stimulus_plays" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stop_reason" text,
	"theta_mean" real,
	"theta_sd" real
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"language" text,
	"text" text NOT NULL,
	"words" jsonb DEFAULT '[]'::jsonb,
	"provider" text DEFAULT 'elevenlabs-scribe' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcripts_media_asset_id_unique" UNIQUE("media_asset_id")
);
--> statement-breakpoint
CREATE TABLE "proctor_ai_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "ai_review_status" DEFAULT 'QUEUED' NOT NULL,
	"verdict" "ai_verdict",
	"observations" jsonb,
	"summary" text,
	"confidence" real,
	"model" text,
	"ai_run_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "proctor_ai_reviews_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "proctor_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"section_run_id" uuid,
	"session_id" uuid,
	"client_event_id" text NOT NULL,
	"type" "proctor_event_type" NOT NULL,
	"severity" "proctor_severity" NOT NULL,
	"source" "proctor_source" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_ms" integer,
	"meta" jsonb,
	"teacher_status" "teacher_flag_status" DEFAULT 'OPEN' NOT NULL,
	"teacher_note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proctor_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"event_id" uuid,
	"kind" "evidence_kind" NOT NULL,
	"trigger" "evidence_trigger" NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" bigint,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"browser_signals" jsonb,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proctor_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"client_session_id" text NOT NULL,
	"env" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_state" jsonb,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"purpose" "ai_purpose" NOT NULL,
	"model" text NOT NULL,
	"prompt_hash" text,
	"input_ref" text,
	"output_ref" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(10, 6),
	"requested_by" uuid,
	"error" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"consent_text_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_setup_tokens" ADD CONSTRAINT "user_setup_tokens_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_setup_tokens" ADD CONSTRAINT "user_setup_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_setup_tokens" ADD CONSTRAINT "user_setup_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_blueprints" ADD CONSTRAINT "exam_blueprints_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_blueprints" ADD CONSTRAINT "exam_blueprints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_result_revisions" ADD CONSTRAINT "exam_result_revisions_result_id_exam_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."exam_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_result_revisions" ADD CONSTRAINT "exam_result_revisions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_stimulus_id_stimuli_id_fk" FOREIGN KEY ("stimulus_id") REFERENCES "public"."stimuli"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_grading_revisions" ADD CONSTRAINT "response_grading_revisions_grading_id_response_gradings_id_fk" FOREIGN KEY ("grading_id") REFERENCES "public"."response_gradings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_grading_revisions" ADD CONSTRAINT "response_grading_revisions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_gradings" ADD CONSTRAINT "response_gradings_item_response_id_item_responses_id_fk" FOREIGN KEY ("item_response_id") REFERENCES "public"."item_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_gradings" ADD CONSTRAINT "response_gradings_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_gradings" ADD CONSTRAINT "response_gradings_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stimuli" ADD CONSTRAINT "stimuli_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stimuli" ADD CONSTRAINT "stimuli_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stimuli" ADD CONSTRAINT "stimuli_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_links" ADD CONSTRAINT "assessment_links_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_blueprint_id_exam_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."exam_blueprints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_integrity_decided_by_users_id_fk" FOREIGN KEY ("integrity_decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_responses" ADD CONSTRAINT "item_responses_section_run_id_section_runs_id_fk" FOREIGN KEY ("section_run_id") REFERENCES "public"."section_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_responses" ADD CONSTRAINT "item_responses_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_section_run_id_section_runs_id_fk" FOREIGN KEY ("section_run_id") REFERENCES "public"."section_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_item_response_id_item_responses_id_fk" FOREIGN KEY ("item_response_id") REFERENCES "public"."item_responses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_runs" ADD CONSTRAINT "section_runs_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_ai_reviews" ADD CONSTRAINT "proctor_ai_reviews_event_id_proctor_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."proctor_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_ai_reviews" ADD CONSTRAINT "proctor_ai_reviews_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_events" ADD CONSTRAINT "proctor_events_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_events" ADD CONSTRAINT "proctor_events_section_run_id_section_runs_id_fk" FOREIGN KEY ("section_run_id") REFERENCES "public"."section_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_events" ADD CONSTRAINT "proctor_events_session_id_proctor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."proctor_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_events" ADD CONSTRAINT "proctor_events_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_evidence" ADD CONSTRAINT "proctor_evidence_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_evidence" ADD CONSTRAINT "proctor_evidence_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_evidence" ADD CONSTRAINT "proctor_evidence_event_id_proctor_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."proctor_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_sessions" ADD CONSTRAINT "proctor_sessions_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_texts" ADD CONSTRAINT "consent_texts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_consent_text_id_consent_texts_id_fk" FOREIGN KEY ("consent_text_id") REFERENCES "public"."consent_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_at_idx" ON "audit_logs" USING btree ("org_id","at");--> statement-breakpoint
CREATE INDEX "audit_subject_idx" ON "audit_logs" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_setup_tokens_user_idx" ON "user_setup_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_setup_tokens_org_idx" ON "user_setup_tokens" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "blueprints_org_idx" ON "exam_blueprints" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "result_revisions_idx" ON "exam_result_revisions" USING btree ("result_id","at");--> statement-breakpoint
CREATE INDEX "items_pool_idx" ON "items" USING btree ("org_id","section","level","status");--> statement-breakpoint
CREATE INDEX "items_stimulus_idx" ON "items" USING btree ("stimulus_id");--> statement-breakpoint
CREATE INDEX "grading_revisions_idx" ON "response_grading_revisions" USING btree ("grading_id","at");--> statement-breakpoint
CREATE INDEX "gradings_status_idx" ON "response_gradings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stimuli_org_section_level_idx" ON "stimuli" USING btree ("org_id","section","level");--> statement-breakpoint
CREATE INDEX "links_assessment_idx" ON "assessment_links" USING btree ("assessment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_link_per_assessment" ON "assessment_links" USING btree ("assessment_id") WHERE status <> 'EXPIRED';--> statement-breakpoint
CREATE INDEX "assessments_org_idx" ON "assessments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "assessments_candidate_idx" ON "assessments" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_attempt_per_assessment" ON "attempts" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "attempts_assessment_idx" ON "attempts" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "candidates_org_idx" ON "candidates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "candidates_email_idx" ON "candidates" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "item_response_sequence" ON "item_responses" USING btree ("section_run_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "item_response_item" ON "item_responses" USING btree ("section_run_id","item_id");--> statement-breakpoint
CREATE INDEX "item_responses_run_idx" ON "item_responses" USING btree ("section_run_id");--> statement-breakpoint
CREATE INDEX "media_run_idx" ON "media_assets" USING btree ("section_run_id");--> statement-breakpoint
CREATE INDEX "media_purge_idx" ON "media_assets" USING btree ("purge_after");--> statement-breakpoint
CREATE UNIQUE INDEX "section_run_per_attempt" ON "section_runs" USING btree ("attempt_id","section");--> statement-breakpoint
CREATE INDEX "section_runs_attempt_idx" ON "section_runs" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "section_runs_deadline_idx" ON "section_runs" USING btree ("deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "proctor_event_client_id" ON "proctor_events" USING btree ("attempt_id","client_event_id");--> statement-breakpoint
CREATE INDEX "proctor_events_attempt_idx" ON "proctor_events" USING btree ("attempt_id","started_at");--> statement-breakpoint
CREATE INDEX "proctor_evidence_attempt_idx" ON "proctor_evidence" USING btree ("attempt_id","captured_at");--> statement-breakpoint
CREATE INDEX "proctor_evidence_event_idx" ON "proctor_evidence" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "proctor_evidence_purge_idx" ON "proctor_evidence" USING btree ("purge_after");--> statement-breakpoint
CREATE UNIQUE INDEX "proctor_session_per_client" ON "proctor_sessions" USING btree ("attempt_id","client_session_id");--> statement-breakpoint
CREATE INDEX "proctor_sessions_attempt_idx" ON "proctor_sessions" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "ai_runs_org_at_idx" ON "ai_runs" USING btree ("org_id","at");--> statement-breakpoint
CREATE INDEX "consents_assessment_idx" ON "consents" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "deletion_requests_candidate_idx" ON "deletion_requests" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "outbox_org_idx" ON "message_outbox" USING btree ("org_id");