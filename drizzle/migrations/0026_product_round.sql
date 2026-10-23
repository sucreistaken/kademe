ALTER TABLE "assessments" ALTER COLUMN "locale" SET DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "exam_results" ADD COLUMN "level_shown" boolean;--> statement-breakpoint
ALTER TABLE "stimuli" ADD COLUMN "max_plays" smallint;--> statement-breakpoint
CREATE INDEX "candidates_org_email_lower_idx" ON "candidates" USING btree ("org_id",lower("email"));--> statement-breakpoint
ALTER TABLE "stimuli" ADD CONSTRAINT "stimuli_max_plays_range" CHECK ("stimuli"."max_plays" IS NULL OR "stimuli"."max_plays" BETWEEN 1 AND 3);