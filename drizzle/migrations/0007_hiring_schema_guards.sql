-- Reviewed by hand: the UNIQUE (id, org_id) on hiring_openings moved above the
-- composite foreign key that references it (drizzle-kit emits it after, and
-- Postgres refuses a foreign key without a unique target). The first DROP
-- names the 64-character default; Postgres cuts identifiers to 63
-- characters, so it matches the constraint 0005 created. DDL fires no row
-- triggers, so the 0006 freeze does not touch these statements.
ALTER TABLE "hiring_activity_competencies" DROP CONSTRAINT "hiring_activity_competencies_activity_id_hiring_activities_id_fk";
--> statement-breakpoint
ALTER TABLE "hiring_versions" DROP CONSTRAINT "hiring_versions_opening_id_hiring_openings_id_fk";
--> statement-breakpoint
ALTER TABLE "hiring_activity_competencies" ADD CONSTRAINT "hiring_activity_competencies_activity_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."hiring_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_openings" ADD CONSTRAINT "hiring_openings_id_org" UNIQUE("id","org_id");--> statement-breakpoint
ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_versions_opening_org_fk" FOREIGN KEY ("opening_id","org_id") REFERENCES "public"."hiring_openings"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_activities" ADD CONSTRAINT "hiring_activity_answer" CHECK ("hiring_activities"."answer_seconds" IS NULL OR "hiring_activities"."answer_seconds" > 0);--> statement-breakpoint
ALTER TABLE "hiring_activities" ADD CONSTRAINT "hiring_activity_order" CHECK ("hiring_activities"."order_index" >= 0);--> statement-breakpoint
ALTER TABLE "hiring_stages" ADD CONSTRAINT "hiring_stage_grace" CHECK ("hiring_stages"."grace_seconds" >= 0);--> statement-breakpoint
ALTER TABLE "hiring_stages" ADD CONSTRAINT "hiring_stage_order" CHECK ("hiring_stages"."order_index" >= 0);--> statement-breakpoint
ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_published_has_publisher" CHECK ("hiring_versions"."status" <> 'PUBLISHED' OR ("hiring_versions"."published_at" IS NOT NULL AND "hiring_versions"."published_by" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_version_number_positive" CHECK ("hiring_versions"."version_number" >= 1);--> statement-breakpoint
ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_default_locale_in_set" CHECK ("hiring_versions"."locale_set" ? "hiring_versions"."default_locale"::text);