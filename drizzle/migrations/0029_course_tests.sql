ALTER TYPE "public"."ai_purpose" ADD VALUE 'COURSE_RUBRIC';--> statement-breakpoint
ALTER TYPE "public"."exam_mode" ADD VALUE 'COURSE_TEST';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "course_form" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "course_order" integer;--> statement-breakpoint
ALTER TABLE "response_gradings" ADD COLUMN "course_proposal" jsonb;--> statement-breakpoint
ALTER TABLE "response_gradings" ADD COLUMN "course_points" jsonb;--> statement-breakpoint
ALTER TABLE "stimuli" ADD COLUMN "course_form" text;--> statement-breakpoint
CREATE INDEX "items_course_form_idx" ON "items" USING btree ("org_id","course_form","section","course_order");