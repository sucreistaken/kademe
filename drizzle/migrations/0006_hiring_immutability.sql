-- A published hiring version is frozen (hiring solution design 2.2). Every
-- candidate invited to v2 must see exactly v2, and every score given against
-- v2 must keep meaning what it meant. Convention is not enough, so the database
-- refuses. Adapted from the old product's drizzle/sql/0001_immutability.sql
-- (610da60), with one addition: child rows are checked against their OLD and
-- their NEW parent, so a draft row cannot be moved into a published version.
-- Hand-written. One statement per breakpoint: the migrator prepares each chunk.
CREATE OR REPLACE FUNCTION hiring_block_published_version() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'hiring_versions %: a published version is immutable, open a new draft instead', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER hiring_versions_immutable BEFORE UPDATE OR DELETE ON "hiring_versions" FOR EACH ROW EXECUTE FUNCTION hiring_block_published_version();--> statement-breakpoint
CREATE OR REPLACE FUNCTION hiring_block_published_stage() RETURNS trigger AS $$
DECLARE
  v_status hiring_version_status;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT status INTO v_status FROM hiring_versions WHERE id = OLD.version_id;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_stages %: belongs to a published version', OLD.id USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT status INTO v_status FROM hiring_versions WHERE id = NEW.version_id;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_stages: cannot be placed in a published version' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER hiring_stages_immutable BEFORE INSERT OR UPDATE OR DELETE ON "hiring_stages" FOR EACH ROW EXECUTE FUNCTION hiring_block_published_stage();--> statement-breakpoint
CREATE OR REPLACE FUNCTION hiring_block_published_activity() RETURNS trigger AS $$
DECLARE
  v_status hiring_version_status;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT v.status INTO v_status FROM hiring_stages s JOIN hiring_versions v ON v.id = s.version_id WHERE s.id = OLD.stage_id;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_activities %: belongs to a published version', OLD.id USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT v.status INTO v_status FROM hiring_stages s JOIN hiring_versions v ON v.id = s.version_id WHERE s.id = NEW.stage_id;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_activities: cannot be placed in a published version' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER hiring_activities_immutable BEFORE INSERT OR UPDATE OR DELETE ON "hiring_activities" FOR EACH ROW EXECUTE FUNCTION hiring_block_published_activity();--> statement-breakpoint
CREATE OR REPLACE FUNCTION hiring_block_published_mapping() RETURNS trigger AS $$
DECLARE
  v_status hiring_version_status;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT v.status INTO v_status FROM hiring_activities a JOIN hiring_stages s ON s.id = a.stage_id JOIN hiring_versions v ON v.id = s.version_id WHERE a.id = OLD.activity_id;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_activity_competencies: belongs to a published version' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT v.status INTO v_status FROM hiring_activities a JOIN hiring_stages s ON s.id = a.stage_id JOIN hiring_versions v ON v.id = s.version_id WHERE a.id = NEW.activity_id;
    IF v_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'hiring_activity_competencies: cannot be placed in a published version' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER hiring_activity_competencies_immutable BEFORE INSERT OR UPDATE OR DELETE ON "hiring_activity_competencies" FOR EACH ROW EXECUTE FUNCTION hiring_block_published_mapping();
