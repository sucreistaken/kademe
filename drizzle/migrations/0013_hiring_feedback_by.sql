-- Reviewed by hand: one nullable column on hiring_assessments.
-- feedback_by freezes the reply promise of the finish screen (the org day the
-- candidate finished + the opening's feedback days), written once with the
-- completion. Existing rows get null (the state then computes it as before);
-- a nullable column without a default rewrites nothing. No row is written.
ALTER TABLE "hiring_assessments" ADD COLUMN "feedback_by" date;