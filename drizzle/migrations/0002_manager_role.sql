-- TEACHER becomes MANAGER: the platform hosts more than the exam now.
-- Reviewed by hand. drizzle-kit generated a drop-and-recreate of the enum,
-- which fails on every existing TEACHER row; RENAME VALUE keeps the rows, the
-- value's position and the column default (the default refers to the value,
-- not to its spelling, so it follows the rename).
ALTER TYPE "public"."user_role" RENAME VALUE 'TEACHER' TO 'MANAGER';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MANAGER';
