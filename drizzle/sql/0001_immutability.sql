-- A published template version is frozen. A candidate who took v1 must keep
-- seeing exactly v1 forever, even after the manager edits the template.
-- Convention is not enough here, so the database enforces it.

CREATE OR REPLACE FUNCTION kademe_block_published_version_edit()
RETURNS trigger AS $$
BEGIN
  -- Allow the one transition that is legal: DRAFT -> PUBLISHED / ARCHIVED, and
  -- ARCHIVED status changes. Everything else on a published row is rejected.
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.status = 'PUBLISHED' THEN
      IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'ARCHIVED' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION
        'template_versions %: published versions are immutable (open a new draft instead)',
        OLD.id
        USING ERRCODE = '23514';
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.status = 'PUBLISHED' THEN
      RAISE EXCEPTION
        'template_versions %: published versions cannot be deleted', OLD.id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_versions_immutable ON template_versions;
CREATE TRIGGER trg_versions_immutable
  BEFORE UPDATE OR DELETE ON template_versions
  FOR EACH ROW EXECUTE FUNCTION kademe_block_published_version_edit();

-- The same protection for the content hanging off a published version.
CREATE OR REPLACE FUNCTION kademe_block_published_child_edit()
RETURNS trigger AS $$
DECLARE
  v_status version_status;
  v_id uuid;
BEGIN
  v_id := COALESCE(NEW.version_id, OLD.version_id);
  SELECT status INTO v_status FROM template_versions WHERE id = v_id;
  IF v_status = 'PUBLISHED' THEN
    RAISE EXCEPTION
      'cannot modify % of a published template version', TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stages_immutable ON stages;
CREATE TRIGGER trg_stages_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON stages
  FOR EACH ROW EXECUTE FUNCTION kademe_block_published_child_edit();

-- activities reach the version through their stage, so they need their own check.
CREATE OR REPLACE FUNCTION kademe_block_published_activity_edit()
RETURNS trigger AS $$
DECLARE
  v_status version_status;
BEGIN
  SELECT tv.status INTO v_status
    FROM stages s JOIN template_versions tv ON tv.id = s.version_id
   WHERE s.id = COALESCE(NEW.stage_id, OLD.stage_id);
  IF v_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'cannot modify activities of a published template version'
      USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activities_immutable ON activities;
CREATE TRIGGER trg_activities_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION kademe_block_published_activity_edit();
