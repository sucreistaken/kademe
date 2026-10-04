-- Reviewed by hand: the UNIQUE (id, org_id) on assessments moved to the top,
-- above the two composite foreign keys that reference it (drizzle-kit emits it
-- after them, and Postgres refuses a foreign key without a unique target).
-- The single-column candidate_requests -> assessments key is replaced by the
-- organisation-tied one; both tables are empty. DDL fires no row triggers, so
-- the 0006 freeze of published hiring versions is not touched.
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_id_org_unique" UNIQUE("id","org_id");--> statement-breakpoint
ALTER TABLE "candidate_requests" DROP CONSTRAINT "candidate_requests_assessment_id_assessments_id_fk";
--> statement-breakpoint
ALTER TABLE "candidate_requests" ADD CONSTRAINT "candidate_requests_assessment_org_fk" FOREIGN KEY ("assessment_id","org_id") REFERENCES "public"."assessments"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_assessments" ADD CONSTRAINT "hiring_assessments_org_fk" FOREIGN KEY ("assessment_id","org_id") REFERENCES "public"."assessments"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hiring_responses_activity_idx" ON "hiring_responses" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "hiring_stage_runs_stage_idx" ON "hiring_stage_runs" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "hiring_stage_runs_carried_from_idx" ON "hiring_stage_runs" USING btree ("carried_from_stage_run_id") WHERE carried_from_stage_run_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_requests" ADD CONSTRAINT "candidate_request_message_length" CHECK (char_length("candidate_requests"."message") <= 2000);--> statement-breakpoint
ALTER TABLE "hiring_responses" ADD CONSTRAINT "hiring_response_takes_max" CHECK ("hiring_responses"."takes_used" <= 5);--> statement-breakpoint
ALTER TABLE "hiring_survey_responses" ADD CONSTRAINT "hiring_survey_comment_length" CHECK (char_length("hiring_survey_responses"."comment") <= 2000);