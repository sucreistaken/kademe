ALTER TABLE "hiring_openings" ALTER COLUMN "min_evaluations" SET DEFAULT 1;--> statement-breakpoint
-- Hand-written: the "at least N evaluators" rule is gone; one submitted evaluation is enough everywhere.
UPDATE "hiring_openings" SET "min_evaluations" = 1 WHERE "min_evaluations" <> 1;
