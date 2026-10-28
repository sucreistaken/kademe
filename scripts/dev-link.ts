/**
 * Mints a fresh student invitation for development and prints its link.
 *
 * Run with an explicit working database (it refuses the shared `kademe`
 * database, any other host and any port but 5434):
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm dev:link
 *   DATABASE_URL=... pnpm dev:link --claimed B1             # B1 verification exam
 *   DATABASE_URL=... pnpm dev:link --name "Ayşe Demir" --lang en
 *   DATABASE_URL=... pnpm dev:link --course B1.1            # Zwischentest B1.1 (A1.1 A1 A2.1 A2 B1.1 B1 B2.1 B2)
 *   DATABASE_URL=... pnpm dev:link --course B1 --form B     # Abschlusstest B1, form B
 *
 * A course test is published for the organisation on the way (the same
 * publisher the invite form uses), so its two forms must be in the bank
 * (`pnpm bank:topup`); without `--form` the student gets the form the email
 * has not sat yet, else A.
 */
import "dotenv/config";
import { refuseUnlessWorkingDb } from "../src/db/working-db-guard";
import { DEFAULT_CANDIDATE_LOCALE, isCandidateLocale, type CandidateLocale } from "../src/i18n/locale";
import { COURSE_KEYS, isCourseKey } from "../src/lib/exam/course/types";
import { isCourseForm } from "../src/lib/exam/course/forms";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { createInvitation } = await import("../src/server/invite");
  const course = arg("course");
  if (course !== undefined && !isCourseKey(course)) throw new Error(`unknown course test "${course}": use one of ${COURSE_KEYS.join(", ")}`);
  const form = arg("form");
  if (form !== undefined && !isCourseForm(form)) throw new Error(`unknown form "${form}": use A or B`);
  if (form !== undefined && course === undefined) throw new Error("--form belongs to --course");
  const claimed = arg("claimed") as "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | undefined;
  if (course !== undefined && claimed) throw new Error("a course test has no claimed level: use --course or --claimed, not both");
  const mode = course ? "COURSE_TEST" : claimed ? "LEVEL_VERIFICATION" : "PLACEMENT";
  const [org] = await db.select().from(s.organizations).limit(1);
  if (!org) throw new Error("no organisation: run pnpm db:seed first");
  const lang = isCandidateLocale(arg("lang")) ? (arg("lang") as CandidateLocale) : DEFAULT_CANDIDATE_LOCALE;

  let blueprint: typeof s.examBlueprints.$inferSelect | undefined;
  if (course !== undefined && isCourseKey(course)) {
    // The course test is a ready template: published on first use, only when the bank holds both forms.
    const { courseExamTemplate } = await import("../src/lib/exam/course/templates");
    const { ensureTemplateBlueprint } = await import("../src/server/template-blueprint");
    const { bankCoverage } = await import("../src/lib/exam/blueprint");
    const { bankCounts } = await import("../src/server/panel");
    const template = courseExamTemplate(course);
    const [user] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.orgId, org.id)).limit(1);
    if (!user) throw new Error("no user in the organisation: run pnpm db:seed first");
    const ensured = await ensureTemplateBlueprint(org.id, user.id, template, "en");
    if (!ensured.ok) {
      const missing = bankCoverage(await bankCounts(org.id), template.config, "COURSE_TEST", null).rows.filter((r) => !r.ok);
      const lines = missing.map((r) => `    ${r.courseForm} ${r.section}: ${r.available} of ${r.needed}`);
      throw new Error(`${template.germanName} is not covered by the bank (${ensured.code}). Load the course forms (pnpm bank:topup, then pnpm bank:tts).\n${lines.join("\n")}`);
    }
    blueprint = ensured.blueprint;
  } else {
    [blueprint] = await db
      .select()
      .from(s.examBlueprints)
      .where(and(eq(s.examBlueprints.mode, mode), eq(s.examBlueprints.status, "PUBLISHED")))
      .limit(1);
  }
  if (!blueprint) throw new Error(`no published ${mode} exam`);
  const result = await createInvitation({
    orgId: org.id,
    blueprintId: blueprint.id,
    fullName: arg("name") ?? "Dev Öğrenci",
    email: arg("email") ?? `dev-${Date.now()}@example.com`,
    claimedLevel: claimed ?? null,
    locale: lang,
    invitedBy: null,
    ...(form !== undefined && isCourseForm(form) ? { courseForm: form } : {}),
  });
  if (!result.ok) throw new Error(result.code);
  console.log(`\n  ${blueprint.name}${claimed ? ` (claimed ${claimed})` : ""}${result.courseForm ? ` (form ${result.courseForm})` : ""}\n  ${result.url}\n`);
  process.exit(0);
}

// Checked before the database module is even loaded: nothing connects to a refused url.
const refusal = refuseUnlessWorkingDb(process.env.DATABASE_URL);
if (refusal) {
  console.error(`Refusing: ${refusal}`);
  process.exit(2);
} else {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
