ALTER TABLE "assessments" DROP CONSTRAINT "assessments_blueprint_id_exam_blueprints_id_fk";
--> statement-breakpoint
ALTER TABLE "proctor_events" DROP CONSTRAINT "proctor_events_section_run_id_section_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "assessments" DROP COLUMN "blueprint_id";--> statement-breakpoint
ALTER TABLE "assessments" DROP COLUMN "blueprint_name";--> statement-breakpoint
ALTER TABLE "assessments" DROP COLUMN "blueprint_snapshot";--> statement-breakpoint
ALTER TABLE "assessments" DROP COLUMN "mode";--> statement-breakpoint
ALTER TABLE "assessments" DROP COLUMN "claimed_level";--> statement-breakpoint
ALTER TABLE "proctor_events" DROP COLUMN "section_run_id";