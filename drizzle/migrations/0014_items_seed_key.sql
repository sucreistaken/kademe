-- Reviewed by hand: one nullable column and one unique index on items.
-- seed_key names the starter item a row came from (seed-bank/seed-key.ts), so
-- the bank top-up (scripts/bank-topup.ts) adds only what an organisation lacks.
-- Existing rows get null; the top-up backfills seed rows it can match. Nulls
-- never collide in a unique index, so teacher and AI items are unaffected. A
-- nullable column without a default rewrites nothing. No row is written.
ALTER TABLE "items" ADD COLUMN "seed_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "items_seed_key_per_org" ON "items" USING btree ("org_id","seed_key");
