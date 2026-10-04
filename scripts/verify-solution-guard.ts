/**
 * Spec 6 and 7: a solution's candidate endpoints never answer another
 * solution's invitation, and the answer is indistinguishable from an unknown
 * token. Runs against a dev server (default http://localhost:3100) on the same
 * database as DATABASE_URL. Adds two invitations and removes them at the end.
 *
 *   DATABASE_URL=... pnpm verify:guard
 */
import "dotenv/config";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";
let failed = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => {
  failed += 1;
  console.log(`  FAIL ${m}`);
};

async function call(method: "GET" | "POST" | "PUT", path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { mintToken } = await import("../src/lib/auth");
  const { createInvitation } = await import("../src/server/invite");

  const [org] = await db.select().from(s.organizations).limit(1);
  const [placement] = await db.select().from(s.examBlueprints).where(eq(s.examBlueprints.mode, "PLACEMENT")).limit(1);
  if (!org || !placement) throw new Error("no organisation or placement exam in this database");

  const exam = await createInvitation({
    orgId: org.id, blueprintId: placement.id, fullName: "Guard exam", email: `guard-${Date.now()}@example.com`,
    claimedLevel: null, locale: "tr", invitedBy: null,
  });
  if (!exam.ok) throw new Error(exam.code);

  // A hiring invitation exists only as core rows until sub-project 3.
  const personIds: string[] = [];
  async function hiringInvitation(status: "NOT_STARTED" | "EXPIRED" | "COMPLETED") {
    const token = mintToken();
    const [person] = await db.insert(s.candidates).values({ orgId: org.id, fullName: `Guard hiring ${status}`, email: `guard-h-${status}-${Date.now()}@example.com` }).returning();
    personIds.push(person.id);
    const [hiring] = await db.insert(s.assessments).values({ orgId: org.id, candidateId: person.id, solution: "HIRING", locale: "tr" }).returning();
    await db.insert(s.assessmentLinks).values({ assessmentId: hiring.id, tokenHash: token.hash, status, expiresAt: new Date(Date.now() + 86_400_000) });
    return token;
  }
  const token = await hiringInvitation("NOT_STARTED");

  try {
    console.log("\nExam endpoints refuse a hiring invitation");
    for (const [method, path] of [
      ["PUT", "/exam/answer"],
      ["POST", "/exam/answer/commit"],
      ["POST", "/exam/section/start"],
      ["POST", "/exam/section/submit"],
      ["POST", "/exam/listening-audio"],
      ["POST", "/exam/media/init"],
      ["PUT", "/answer"],
    ] as const) {
      const r = await call(method, `/api/c/${token.raw}${path}`, {});
      if (r.status === 404 && r.json?.error === "INVALID") ok(`${method} ${path}: 404 INVALID`);
      else bad(`${method} ${path}: ${r.status} ${JSON.stringify(r.json)}`);
    }

    console.log("\nCore endpoints refuse a solution with no registered module");
    const state = await call("GET", `/api/c/${token.raw}/state`);
    if (state.status === 404) ok("GET /state: 404");
    else bad(`GET /state: ${state.status}`);

    console.log("\nThe answer looks like an unknown token");
    const unknown = await call("GET", `/api/c/${"x".repeat(43)}/state`);
    const hiringAnswer = await call("PUT", `/api/c/${token.raw}/exam/answer`, {});
    const keys = (j: Record<string, unknown> | null) => Object.keys(j ?? {}).sort().join(",");
    if (unknown.status === hiringAnswer.status && keys(unknown.json) === keys(hiringAnswer.json) && unknown.json?.error === hiringAnswer.json?.error)
      ok(`same status (${unknown.status}), same fields (${keys(unknown.json)}), same code`);
    else bad(`unknown ${unknown.status} ${JSON.stringify(unknown.json)} vs hiring ${hiringAnswer.status} ${JSON.stringify(hiringAnswer.json)}`);

    console.log("\nA closed hiring link and another language change nothing");
    const sameAsUnknown = async (label: string, raw: string, headers: Record<string, string>, method: "PUT" | "POST" = "PUT", path = "/exam/answer") => {
      const unknownRes = await call(method, `/api/c/${"y".repeat(43)}${path}`, {}, headers);
      const r = await call(method, `/api/c/${raw}${path}`, {}, headers);
      if (r.status === unknownRes.status && JSON.stringify(r.json) === JSON.stringify(unknownRes.json) && r.status === 404)
        ok(`${label}: 404, identical body (${JSON.stringify(r.json?.message)})`);
      else bad(`${label}: ${r.status} ${JSON.stringify(r.json)} vs unknown ${unknownRes.status} ${JSON.stringify(unknownRes.json)}`);
    };
    const expired = await hiringInvitation("EXPIRED");
    const completed = await hiringInvitation("COMPLETED");
    await sameAsUnknown("EXPIRED hiring link, PUT /exam/answer", expired.raw, {});
    await sameAsUnknown("COMPLETED hiring link, POST /exam/section/start", completed.raw, {}, "POST", "/exam/section/start");
    await sameAsUnknown("EXPIRED hiring link, legacy PUT /answer", expired.raw, {}, "PUT", "/answer");
    await sameAsUnknown("tr hiring link, Accept-Language en", token.raw, { "accept-language": "en" });
    await sameAsUnknown("COMPLETED hiring link, Accept-Language en", completed.raw, { "accept-language": "en" });

    const [seen] = await db.select({ ip: s.assessmentLinks.firstSeenIp }).from(s.assessmentLinks).where(eq(s.assessmentLinks.tokenHash, token.hash));
    if (seen && seen.ip === null) ok("an exam endpoint does not record first-seen on a hiring link");
    else bad(`first_seen_ip on the hiring link: ${JSON.stringify(seen)}`);

    console.log("\nThe exam invitation still reaches its endpoints");
    const examState = await call("GET", `/api/c/${exam.rawToken}/state`);
    if (examState.status === 200 && examState.json?.step === "CONSENT") ok("GET /state: 200 CONSENT");
    else bad(`GET /state: ${examState.status} ${JSON.stringify(examState.json)}`);
    const start = await call("POST", `/api/c/${exam.rawToken}/exam/section/start`, { sectionPosition: 1 });
    if (start.status === 409 && start.json?.error === "NOT_READY") ok("POST /exam/section/start before consent: 409 NOT_READY");
    else bad(`POST /exam/section/start: ${start.status} ${JSON.stringify(start.json)}`);
    const legacy = await call("PUT", `/api/c/${exam.rawToken}/answer`, { sectionPosition: 1, sequence: 1, answer: {} });
    if (legacy.status === 409) ok(`PUT /answer (legacy path, rewritten): 409 ${legacy.json?.error}`);
    else bad(`PUT /answer legacy: ${legacy.status} ${JSON.stringify(legacy.json)}`);
  } finally {
    for (const id of personIds) await db.delete(s.candidates).where(eq(s.candidates.id, id));
    await db.delete(s.candidates).where(eq(s.candidates.id, exam.candidateId));
  }

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
