-- An assessment must never have two usable links at the same time.
--
-- Two live tokens for one candidate means a link the manager believes they
-- revoked still opens the assessment, and it makes "which link did they use"
-- unanswerable in an audit. A retake deliberately reuses the SAME link (its
-- status moves to RETAKE_AVAILABLE and attempts_allowed goes up), so one usable
-- link per assessment is the correct rule rather than a limitation.
--
-- Expired links are excluded so history is kept: a superseded link stays in the
-- table as an EXPIRED row instead of being deleted.

-- Retire any pre-existing duplicates, keeping the most recently created one.
UPDATE assessment_links l
   SET status = 'EXPIRED'
 WHERE l.status <> 'EXPIRED'
   AND EXISTS (
     SELECT 1 FROM assessment_links newer
      WHERE newer.assessment_id = l.assessment_id
        AND newer.status <> 'EXPIRED'
        AND (newer.created_at, newer.id) > (l.created_at, l.id)
   );

DROP INDEX IF EXISTS one_active_link_per_assessment;
CREATE UNIQUE INDEX one_active_link_per_assessment
    ON assessment_links (assessment_id)
 WHERE status <> 'EXPIRED';
