/**
 * Prints the public schema as sorted lines: every column (type, nullability,
 * default), constraint, index and enum. Column ORDER is ignored on purpose: a
 * migration that adds a column appends it, `drizzle-kit push` places it where
 * the TypeScript says, and both are the same schema.
 *
 *   DATABASE_URL=... pnpm db:fingerprint > /tmp/a.txt
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const rows = await sql<{ line: string }[]>`
    select 'column ' || c.table_name || '.' || c.column_name || ' ' || c.udt_name
           || ' null=' || c.is_nullable || ' default=' || coalesce(c.column_default, '-') as line
      from information_schema.columns c where c.table_schema = 'public'
    union all
    select 'constraint ' || cl.relname || '.' || co.conname || ' ' || pg_get_constraintdef(co.oid)
      from pg_constraint co
      join pg_class cl on cl.oid = co.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where n.nspname = 'public'
    union all
    select 'index ' || indexname || ' ' || indexdef from pg_indexes where schemaname = 'public'
    union all
    select 'enum ' || t.typname || ' ' || string_agg(e.enumlabel, ',' order by e.enumsortorder)
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
     group by t.typname
    order by 1`;
  for (const r of rows) console.log(r.line);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
