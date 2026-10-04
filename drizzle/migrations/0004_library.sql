CREATE TYPE "public"."observation_polarity" AS ENUM('POSITIVE', 'NEGATIVE');--> statement-breakpoint
ALTER TYPE "public"."ai_purpose" ADD VALUE 'ANCHOR_DRAFT';--> statement-breakpoint
CREATE TABLE "competencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb DEFAULT '{"tr":"","en":""}'::jsonb NOT NULL,
	"scale_id" uuid NOT NULL,
	"seed_key" text,
	"reviewed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competency_anchors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competency_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"body" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observation_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competency_id" uuid NOT NULL,
	"polarity" "observation_polarity" NOT NULL,
	"label" jsonb NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "position_competencies" (
	"position_id" uuid NOT NULL,
	"competency_id" uuid NOT NULL,
	"weight" integer DEFAULT 50 NOT NULL,
	"expected_level" integer,
	"order_index" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "position_competencies_position_id_competency_id_pk" PRIMARY KEY("position_id","competency_id"),
	CONSTRAINT "position_competency_weight" CHECK ("position_competencies"."weight" BETWEEN 0 AND 100),
	CONSTRAINT "position_competency_expected_level" CHECK ("position_competencies"."expected_level" IS NULL OR "position_competencies"."expected_level" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"team" text,
	"short_description" text,
	"job_description" text,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_scales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_value" integer DEFAULT 1 NOT NULL,
	"max_value" integer DEFAULT 5 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_scale_range" CHECK ("rating_scales"."min_value" < "rating_scales"."max_value")
);
--> statement-breakpoint
CREATE TABLE "scale_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scale_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"label" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_scale_id_rating_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."rating_scales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_anchors" ADD CONSTRAINT "competency_anchors_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_tags" ADD CONSTRAINT "observation_tags_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_competencies" ADD CONSTRAINT "position_competencies_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_competencies" ADD CONSTRAINT "position_competencies_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_scales" ADD CONSTRAINT "rating_scales_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_levels" ADD CONSTRAINT "scale_levels_scale_id_rating_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."rating_scales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competencies_org_idx" ON "competencies" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competency_seed_key_per_org" ON "competencies" USING btree ("org_id","seed_key");--> statement-breakpoint
CREATE UNIQUE INDEX "competency_anchor_value" ON "competency_anchors" USING btree ("competency_id","value");--> statement-breakpoint
CREATE INDEX "observation_tags_competency_idx" ON "observation_tags" USING btree ("competency_id");--> statement-breakpoint
CREATE INDEX "position_competencies_competency_idx" ON "position_competencies" USING btree ("competency_id");--> statement-breakpoint
CREATE INDEX "positions_org_idx" ON "positions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rating_scales_org_idx" ON "rating_scales" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_default_scale_per_org" ON "rating_scales" USING btree ("org_id") WHERE is_default;--> statement-breakpoint
CREATE UNIQUE INDEX "scale_level_value" ON "scale_levels" USING btree ("scale_id","value");