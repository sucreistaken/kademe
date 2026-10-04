-- Makes the 0006 freeze safe under concurrency, and gives its refusal a name.
-- Hand-written. One statement per breakpoint: the migrator prepares each chunk.
--
-- 0006 read the parent version's status with a plain SELECT. A child INSERT's
-- foreign key check takes FOR KEY SHARE on the version, a child DELETE takes no
-- lock on it, and publishing (UPDATE status) takes FOR NO KEY UPDATE, which does
-- not conflict with FOR KEY SHARE. So under READ COMMITTED a child edit that saw
-- DRAFT could commit after a publish, and the published version would differ
-- from what the publish gate and the snapshot saw.
--
-- Now every parent lookup takes FOR SHARE on the version row, which conflicts
-- with FOR NO KEY UPDATE both ways: a publish waits for open child edits, and a
-- child edit that waits on an open publish re-reads the row once it commits,
-- sees PUBLISHED and is refused. The version trigger itself needs no lookup:
-- the UPDATE or DELETE already holds the row lock.
--
-- Every refusal now carries CONSTRAINT = 'hiring_version_frozen', a stable key
-- for the application (the messages are unchanged). The 0006 triggers call
-- these functions by name, so CREATE OR REPLACE is enough.
CREATE OR REPLACE FUNCTION hiring_block_published_version() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'hiring_versions %: a published version is immutable, open a new draft instead', OLD.id
      USING ERRCODE = '23514', CONSTRAINT = 'hiring_version_frozen';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION hiring_block_published_stage() RETURNS trigger AS $$
DECLARE
  v_status hiring_version_status;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT status INTO v_status FROM hiring_versions WHERE id = OLD.version_id FOR SHARE;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_stages %: belongs to a published version', OLD.id
        USING ERRCODE = '23514', CONSTRAINT = 'hiring_version_frozen';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT status INTO v_status FROM hiring_versions WHERE id = NEW.version_id FOR SHARE;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_stages: cannot be placed in a published version'
        USING ERRCODE = '23514', CONSTRAINT = 'hiring_version_frozen';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION hiring_block_published_activity() RETURNS trigger AS $$
DECLARE
  v_status hiring_version_status;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT v.status INTO v_status FROM hiring_stages s JOIN hiring_versions v ON v.id = s.version_id WHERE s.id = OLD.stage_id FOR SHARE OF v;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_activities %: belongs to a published version', OLD.id
        USING ERRCODE = '23514', CONSTRAINT = 'hiring_version_frozen';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT v.status INTO v_status FROM hiring_stages s JOIN hiring_versions v ON v.id = s.version_id WHERE s.id = NEW.stage_id FOR SHARE OF v;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_activities: cannot be placed in a published version'
        USING ERRCODE = '23514', CONSTRAINT = 'hiring_version_frozen';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION hiring_block_published_mapping() RETURNS trigger AS $$
DECLARE
  v_status hiring_version_status;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT v.status INTO v_status FROM hiring_activities a JOIN hiring_stages s ON s.id = a.stage_id JOIN hiring_versions v ON v.id = s.version_id WHERE a.id = OLD.activity_id FOR SHARE OF v;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_activity_competencies: belongs to a published version'
        USING ERRCODE = '23514', CONSTRAINT = 'hiring_version_frozen';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT v.status INTO v_status FROM hiring_activities a JOIN hiring_stages s ON s.id = a.stage_id JOIN hiring_versions v ON v.id = s.version_id WHERE a.id = NEW.activity_id FOR SHARE OF v;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_activity_competencies: cannot be placed in a published version'
        USING ERRCODE = '23514', CONSTRAINT = 'hiring_version_frozen';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
