-- Platform core, expand step. Reviewed by hand; see
-- docs/superpowers/plans/2026-10-04-core-separation.md, Task 2.
--
-- Everything here is additive or loosens a constraint, so code written for the
-- old shape keeps working. Columns that become required are added nullable,
-- backfilled, and only then set NOT NULL. Migration 0003 drops what this one
-- makes redundant.
CREATE TYPE "public"."solution" AS ENUM('LANGUAGE_EXAM', 'HIRING');--> statement-breakpoint
ALTER TYPE "public"."link_status" ADD VALUE 'RETAKE_AVAILABLE';--> statement-breakpoint
CREATE TABLE "exam_assessments" (
	"assessment_id" uuid PRIMARY KEY NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"blueprint_name" text NOT NULL,
	"blueprint_snapshot" jsonb NOT NULL,
	"mode" "exam_mode" NOT NULL,
	"claimed_level" "cefr_level",
	CONSTRAINT "claimed_for_verification" CHECK ("exam_assessments"."mode" <> 'LEVEL_VERIFICATION' OR "exam_assessments"."claimed_level" IS NOT NULL)
);
--> statement-breakpoint
-- Hand-written: every existing invitation is a language exam; copy its terms.
INSERT INTO "exam_assessments" ("assessment_id", "blueprint_id", "blueprint_name", "blueprint_snapshot", "mode", "claimed_level")
SELECT "id", "blueprint_id", "blueprint_name", "blueprint_snapshot", "mode", "claimed_level" FROM "assessments";--> statement-breakpoint
ALTER TABLE "assessments" DROP CONSTRAINT "claimed_for_verification";--> statement-breakpoint
DROP INDEX "one_attempt_per_assessment";--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "blueprint_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "blueprint_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "blueprint_snapshot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "mode" DROP NOT NULL;--> statement-breakpoint
-- Hand-written: add nullable, backfill, then require.
ALTER TABLE "assessments" ADD COLUMN "solution" "solution";--> statement-breakpoint
UPDATE "assessments" SET "solution" = 'LANGUAGE_EXAM';--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "solution" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "solution" "solution";--> statement-breakpoint
UPDATE "attempts" AS t SET "solution" = a."solution" FROM "assessments" AS a WHERE a."id" = t."assessment_id";--> statement-breakpoint
ALTER TABLE "attempts" ALTER COLUMN "solution" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "attempt_id" uuid;--> statement-breakpoint
UPDATE "media_assets" AS m SET "attempt_id" = r."attempt_id" FROM "section_runs" AS r WHERE r."id" = m."section_run_id";--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "media_assets" WHERE "attempt_id" IS NULL) THEN
    RAISE EXCEPTION 'media_assets: % row(s) have no section run, so their attempt cannot be derived. Resolve them by hand, then migrate again.',
      (SELECT count(*) FROM "media_assets" WHERE "attempt_id" IS NULL);
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "attempt_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "proctor_events" ADD COLUMN "segment_kind" text;--> statement-breakpoint
ALTER TABLE "proctor_events" ADD COLUMN "segment_run_id" uuid;--> statement-breakpoint
UPDATE "proctor_events" SET "segment_kind" = 'section_run', "segment_run_id" = "section_run_id" WHERE "section_run_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_assessments" ADD CONSTRAINT "exam_assessments_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_assessments" ADD CONSTRAINT "exam_assessments_blueprint_id_exam_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."exam_blueprints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_assessments_blueprint_idx" ON "exam_assessments" USING btree ("blueprint_id");--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_id_solution_unique" UNIQUE("id","solution");--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assessment_solution_fk" FOREIGN KEY ("assessment_id","solution") REFERENCES "public"."assessments"("id","solution") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_attempt_per_exam_assessment" ON "attempts" USING btree ("assessment_id") WHERE solution = 'LANGUAGE_EXAM';--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_number_per_assessment" ON "attempts" USING btree ("assessment_id","attempt_number");--> statement-breakpoint
CREATE INDEX "media_attempt_idx" ON "media_assets" USING btree ("attempt_id");--> statement-breakpoint
ALTER TABLE "proctor_events" ADD CONSTRAINT "proctor_events_segment_pair" CHECK (("proctor_events"."segment_kind" IS NULL) = ("proctor_events"."segment_run_id" IS NULL));
