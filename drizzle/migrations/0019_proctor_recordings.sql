CREATE TYPE "public"."proctor_recording_kind" AS ENUM('CAMERA', 'SCREEN');--> statement-breakpoint
CREATE TABLE "proctor_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"session_id" uuid,
	"kind" "proctor_recording_kind" NOT NULL,
	"run_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"bytes" bigint NOT NULL,
	"mime" text NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purge_after" timestamp with time zone,
	CONSTRAINT "proctor_recordings_positive" CHECK ("proctor_recordings"."duration_ms" > 0 AND "proctor_recordings"."bytes" > 0 AND "proctor_recordings"."sequence" >= 0)
);
--> statement-breakpoint
ALTER TABLE "proctor_recordings" ADD CONSTRAINT "proctor_recordings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_recordings" ADD CONSTRAINT "proctor_recordings_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_recordings" ADD CONSTRAINT "proctor_recordings_session_id_proctor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."proctor_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proctor_recording_segment" ON "proctor_recordings" USING btree ("attempt_id","kind","run_id","sequence");--> statement-breakpoint
CREATE INDEX "proctor_recordings_attempt_idx" ON "proctor_recordings" USING btree ("attempt_id","started_at");--> statement-breakpoint
CREATE INDEX "proctor_recordings_purge_idx" ON "proctor_recordings" USING btree ("purge_after");