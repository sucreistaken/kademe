-- Reviewed by hand: one nullable column and one partial unique index on
-- exam_blueprints. template_key names the ready template (src/lib/exam/templates)
-- the invite form published an exam from, so the next invite with the same
-- template reuses that exam. Existing rows get null and stay out of the index.
-- A nullable column without a default rewrites nothing. No row is written.
ALTER TABLE "exam_blueprints" ADD COLUMN "template_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "blueprints_one_published_template" ON "exam_blueprints" USING btree ("org_id","template_key") WHERE status = 'PUBLISHED' AND template_key IS NOT NULL;