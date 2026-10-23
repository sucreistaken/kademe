CREATE TYPE "public"."result_level" AS ENUM('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
ALTER TABLE "exam_results" ALTER COLUMN "overall_override" SET DATA TYPE "public"."result_level" USING "overall_override"::text::"public"."result_level";--> statement-breakpoint
ALTER TABLE "exam_results" ALTER COLUMN "final_overall" SET DATA TYPE "public"."result_level" USING "final_overall"::text::"public"."result_level";--> statement-breakpoint
ALTER TABLE "response_gradings" ALTER COLUMN "ai_level" SET DATA TYPE "public"."result_level" USING "ai_level"::text::"public"."result_level";--> statement-breakpoint
ALTER TABLE "response_gradings" ALTER COLUMN "final_level" SET DATA TYPE "public"."result_level" USING "final_level"::text::"public"."result_level";