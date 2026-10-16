ALTER TYPE "public"."ai_purpose" ADD VALUE 'STUDENT_FEEDBACK';--> statement-breakpoint
ALTER TYPE "public"."proctor_event_type" ADD VALUE IF NOT EXISTS 'SECOND_SCREEN_UNVERIFIABLE' BEFORE 'CAMERA_LOST';--> statement-breakpoint
ALTER TABLE "exam_results" ADD COLUMN "student_feedback" jsonb;