-- Reviewed by hand: one nullable column and two checks on hiring_stage_runs.
-- closed_by records how a run ended (CANDIDATE or CLOCK) and stays null while
-- the run is open. Existing rows (none while the candidate flow is not live)
-- get null, which both checks accept; a nullable column without a default
-- rewrites nothing. No row is written.
ALTER TABLE "hiring_stage_runs" ADD COLUMN "closed_by" text;--> statement-breakpoint
ALTER TABLE "hiring_stage_runs" ADD CONSTRAINT "hiring_stage_run_closed_by" CHECK ("hiring_stage_runs"."closed_by" IN ('CANDIDATE', 'CLOCK'));--> statement-breakpoint
ALTER TABLE "hiring_stage_runs" ADD CONSTRAINT "hiring_stage_run_closed_by_closed" CHECK ("hiring_stage_runs"."closed_by" IS NULL OR "hiring_stage_runs"."submitted_at" IS NOT NULL);