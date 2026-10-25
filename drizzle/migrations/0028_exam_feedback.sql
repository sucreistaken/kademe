CREATE TABLE "exam_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"overall" smallint NOT NULL,
	"clarity" smallint,
	"usability" smallint,
	"technical_problem" boolean,
	"comment" text,
	"locale" "locale" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_feedback_assessment_unique" UNIQUE("assessment_id"),
	CONSTRAINT "exam_feedback_overall_range" CHECK ("exam_feedback"."overall" BETWEEN 1 AND 5),
	CONSTRAINT "exam_feedback_clarity_range" CHECK ("exam_feedback"."clarity" IS NULL OR "exam_feedback"."clarity" BETWEEN 1 AND 5),
	CONSTRAINT "exam_feedback_usability_range" CHECK ("exam_feedback"."usability" IS NULL OR "exam_feedback"."usability" BETWEEN 1 AND 5),
	CONSTRAINT "exam_feedback_comment_length" CHECK (char_length("exam_feedback"."comment") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "exam_feedback" ADD CONSTRAINT "exam_feedback_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_feedback" ADD CONSTRAINT "exam_feedback_assessment_org_fk" FOREIGN KEY ("assessment_id","org_id") REFERENCES "public"."assessments"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_feedback_org_created_idx" ON "exam_feedback" USING btree ("org_id","created_at");