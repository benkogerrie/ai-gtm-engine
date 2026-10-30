ALTER TYPE "public"."outreach_status" ADD VALUE 'DRY_RUN_COMPLETED' BEFORE 'REJECTED';--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_prevent_update ON audit_events;--> statement-breakpoint
CREATE TRIGGER audit_events_prevent_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_events_append_only();--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_prevent_delete ON audit_events;--> statement-breakpoint
CREATE TRIGGER audit_events_prevent_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_events_append_only();