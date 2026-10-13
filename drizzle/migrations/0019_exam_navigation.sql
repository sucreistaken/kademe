ALTER TABLE "item_responses" ADD COLUMN "flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "section_runs" ADD COLUMN "navigable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "section_runs" ADD COLUMN "nav_cursor" integer;--> statement-breakpoint
ALTER TABLE "section_runs" ADD COLUMN "nav_review" boolean DEFAULT false NOT NULL;