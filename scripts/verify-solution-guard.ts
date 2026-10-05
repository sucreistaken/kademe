/**
 * Spec 6 and 7: a solution's candidate endpoints never answer another
 * solution's invitation, and the answer is indistinguishable from an unknown
 * token. Runs against a dev server (default http://localhost:3100) on the same
 * database as DATABASE_URL. Adds its invitations, and for the hiring positive
 * control a DRAFT opening (a draft is deletable, a published one is not), and
 * removes all of them at the end.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard
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
  const { and, eq, inArray, sql } = await import("drizzle-orm");
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

  // A HIRING invitation of core rows only: no hiring terms, so no endpoint serves it.
  const personIds: string[] = [];
  type LinkShape = { status: "NOT_STARTED" | "IN_PROGRESS" | "EXPIRED" | "COMPLETED"; expiresAt?: Date; notBefore?: Date };
  async function hiringInvitation(status: LinkShape["status"], shape: Omit<LinkShape, "status"> = {}, label: string = status) {
    const token = mintToken();
    const [person] = await db.insert(s.candidates).values({ orgId: org.id, fullName: `Guard hiring ${label}`, email: `guard-h-${label.replace(/\W+/g, "-")}-${Date.now()}@example.com` }).returning();
    personIds.push(person.id);
    const [hiring] = await db.insert(s.assessments).values({ orgId: org.id, candidateId: person.id, solution: "HIRING", locale: "tr" }).returning();
    await db.insert(s.assessmentLinks).values({ assessmentId: hiring.id, tokenHash: token.hash, status, expiresAt: shape.expiresAt ?? new Date(Date.now() + 86_400_000), notBefore: shape.notBefore ?? null });
    return { ...token, assessmentId: hiring.id };
  }
  const token = await hiringInvitation("NOT_STARTED");

  // The positive control: a HIRING invitation WITH hiring terms. Its row needs an
  // opening and a version; a DRAFT one, which the database lets us delete again
  // (a published version is frozen for good). Removed in the finally below.
  const draft: { positionId?: string; openingId?: string; consentTextId?: string; consentCreated?: boolean } = {};
  async function hiringInvitationWithTerms(status: LinkShape["status"], label: string) {
    if (!draft.openingId) {
      const [position] = await db.insert(s.positions).values({ orgId: org.id, name: `Guard position ${Date.now()}` }).returning();
      draft.positionId = position.id;
      const [opening] = await db.insert(s.hiringOpenings).values({ orgId: org.id, positionId: position.id, name: "Guard opening (draft)" }).returning();
      draft.openingId = opening.id;
      const [existing] = await db.select().from(s.consentTexts).where(and(eq(s.consentTexts.orgId, org.id), eq(s.consentTexts.solution, "HIRING"))).limit(1);
      if (existing) draft.consentTextId = existing.id;
      else {
        const [created] = await db.insert(s.consentTexts).values({ orgId: org.id, version: 1, solution: "HIRING", body: { tr: "Guard", en: "Guard" } }).returning();
        draft.consentTextId = created.id;
        draft.consentCreated = true;
      }
    }
    const [version] = await db.select().from(s.hiringVersions).where(eq(s.hiringVersions.openingId, draft.openingId!)).limit(1);
    const versionId = version?.id ?? (await db.insert(s.hiringVersions).values({ orgId: org.id, openingId: draft.openingId!, versionNumber: 1 }).returning())[0].id;
    const invitation = await hiringInvitation(status, {}, label);
    await db.insert(s.hiringAssessments).values({ assessmentId: invitation.assessmentId, orgId: org.id, openingId: draft.openingId!, versionId, consentTextId: draft.consentTextId! });
    return invitation;
  }

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

    // Every hiring endpoint (Task 9), every link state (ruling C6), with a live positive control.
    const HIRING_ENDPOINTS = [
      ["POST", "/hiring/stage/start"],
      ["POST", "/hiring/stage/submit"],
      ["PUT", "/hiring/response"],
      ["POST", "/hiring/response/commit"],
      ["POST", "/hiring/extra-time"],
      ["POST", "/hiring/media/init"],
      ["GET", "/hiring/media/play"],
      ["POST", "/hiring/survey"],
    ] as const;
    const bodyFor = (method: "GET" | "POST" | "PUT") => (method === "GET" ? undefined : {});
    const day = 86_400_000;
    const bare = [
      ["NOT_STARTED", token.raw],
      ["IN_PROGRESS", (await hiringInvitation("IN_PROGRESS")).raw],
      ["EXPIRED", (await hiringInvitation("EXPIRED")).raw],
      ["COMPLETED", (await hiringInvitation("COMPLETED")).raw],
      ["past its expiry", (await hiringInvitation("NOT_STARTED", { expiresAt: new Date(Date.now() - day) }, "past-expiry")).raw],
      ["not yet open", (await hiringInvitation("NOT_STARTED", { notBefore: new Date(Date.now() + day) }, "not-yet")).raw],
    ] as const;
    const withTerms = [
      ["NOT_STARTED", (await hiringInvitationWithTerms("NOT_STARTED", "terms NOT_STARTED")).raw],
      ["EXPIRED", (await hiringInvitationWithTerms("EXPIRED", "terms EXPIRED")).raw],
    ] as const;

    console.log("\nHiring endpoints refuse an exam invitation and a HIRING invitation without hiring terms, in every link state");
    for (const [method, path] of HIRING_ENDPOINTS) {
      const unknownRes = await call(method, `/api/c/${"v".repeat(43)}${path}`, bodyFor(method));
      for (const [label, raw] of [["exam", exam.rawToken], ...bare.map(([state, raw]) => [`hiring without terms, ${state}`, raw] as const)] as const) {
        const r = await call(method, `/api/c/${raw}${path}`, bodyFor(method));
        if (r.status === 404 && JSON.stringify(r.json) === JSON.stringify(unknownRes.json)) ok(`${label} link, ${method} ${path}: 404, same as unknown`);
        else bad(`${label} link, ${method} ${path}: ${r.status} ${JSON.stringify(r.json)} vs unknown ${unknownRes.status} ${JSON.stringify(unknownRes.json)}`);
      }
    }

    console.log("\nPositive control: a HIRING invitation WITH hiring terms reaches every hiring endpoint");
    for (const [method, path] of HIRING_ENDPOINTS) {
      for (const [state, raw] of withTerms) {
        // An empty body: the endpoint answers (bad input, or the link's own problem) and writes nothing.
        const r = await call(method, `/api/c/${raw}${path}`, bodyFor(method));
        if (r.status !== 404 && typeof r.json?.error === "string" && r.json.error !== "INVALID") ok(`hiring with terms, ${state}, ${method} ${path}: ${r.status} ${r.json.error}`);
        else bad(`hiring with terms, ${state}, ${method} ${path}: ${r.status} ${JSON.stringify(r.json)} (expected a non-404 answer)`);
      }
    }

    console.log("\nExam endpoints still refuse a HIRING invitation WITH hiring terms");
    for (const [method, path] of [["PUT", "/exam/answer"], ["POST", "/exam/section/start"], ["POST", "/exam/media/init"]] as const) {
      const unknownRes = await call(method, `/api/c/${"t".repeat(43)}${path}`, {});
      const r = await call(method, `/api/c/${withTerms[0][1]}${path}`, {});
      if (r.status === 404 && JSON.stringify(r.json) === JSON.stringify(unknownRes.json)) ok(`hiring with terms, ${method} ${path}: 404, same as unknown`);
      else bad(`hiring with terms, ${method} ${path}: ${r.status} ${JSON.stringify(r.json)}`);
    }

    console.log("\nCore endpoints refuse a HIRING invitation without hiring terms");
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
    const expired = await hiringInvitation("EXPIRED", {}, "EXPIRED 2");
    const completed = await hiringInvitation("COMPLETED", {}, "COMPLETED 2");
    await sameAsUnknown("EXPIRED hiring link, PUT /exam/answer", expired.raw, {});
    await sameAsUnknown("COMPLETED hiring link, POST /exam/section/start", completed.raw, {}, "POST", "/exam/section/start");
    await sameAsUnknown("EXPIRED hiring link, legacy PUT /answer", expired.raw, {}, "PUT", "/answer");
    await sameAsUnknown("tr hiring link, Accept-Language en", token.raw, { "accept-language": "en" });
    await sameAsUnknown("COMPLETED hiring link, Accept-Language en", completed.raw, { "accept-language": "en" });

    const [seen] = await db.select({ ip: s.assessmentLinks.firstSeenIp }).from(s.assessmentLinks).where(eq(s.assessmentLinks.tokenHash, token.hash));
    if (seen && seen.ip === null) ok("an exam endpoint does not record first-seen on a hiring link");
    else bad(`first_seen_ip on the hiring link: ${JSON.stringify(seen)}`);

    console.log("\nShared core endpoints answer a hiring invitation like an unknown token");
    const keysOf = (j: Record<string, unknown> | null) => Object.keys(j ?? {}).sort().join(",");
    for (const [label, raw] of [["open", token.raw], ["EXPIRED", expired.raw]] as const) {
      for (const [method, path, body] of [
        ["GET", "/consent", undefined],
        ["POST", "/bandwidth", {}],
        ["POST", "/rights", { kind: "ACCESS" }],
        ["POST", "/media/part-urls", {}],
      ] as const) {
        const unknownRes = await call(method, `/api/c/${"z".repeat(43)}${path}`, body);
        const r = await call(method, `/api/c/${raw}${path}`, body);
        if (r.status === 404 && r.status === unknownRes.status && keysOf(r.json) === keysOf(unknownRes.json) && r.json?.error === "INVALID" && r.json?.error === unknownRes.json?.error)
          ok(`${label} hiring link, ${method} ${path}: 404 INVALID, same as unknown`);
        else bad(`${label} hiring link, ${method} ${path}: ${r.status} ${JSON.stringify(r.json)} vs unknown ${unknownRes.status} ${JSON.stringify(unknownRes.json)}`);
      }
    }
    const [seenAfter] = await db.select({ ip: s.assessmentLinks.firstSeenIp }).from(s.assessmentLinks).where(eq(s.assessmentLinks.tokenHash, token.hash));
    if (seenAfter && seenAfter.ip === null) ok("shared core endpoints do not record first-seen on a hiring link");
    else bad(`first_seen_ip after the core calls: ${JSON.stringify(seenAfter)}`);
    const requests = await db.select({ id: s.deletionRequests.id }).from(s.deletionRequests).where(inArray(s.deletionRequests.candidateId, personIds));
    if (requests.length === 0) ok("no deletion request was written for a hiring invitation");
    else bad(`${requests.length} deletion request(s) written for hiring candidates`);

    console.log("\nThe rights page renders a hiring invitation like an unknown token");
    // Visible text only: scripts (RSC payload) and tags removed, the token itself masked.
    const page = async (raw: string) => {
      const res = await fetch(`${BASE}/a/${raw}/rights`);
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<style[\s\S]*?<\/style>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .split(raw).join("<token>")
        .replace(/\s+/g, " ")
        .trim();
      return { status: res.status, html, text };
    };
    const unknownRights = await page("w".repeat(43));
    for (const [label, raw, name] of [["open", token.raw, "Guard hiring NOT_STARTED"], ["EXPIRED", expired.raw, "Guard hiring EXPIRED"]] as const) {
      const r = await page(raw);
      if (r.status === unknownRights.status && r.text === unknownRights.text && !r.html.includes(name) && r.text.includes("Bu link geçerli değil"))
        ok(`${label} hiring link, GET /a/<token>/rights: ${r.status}, same visible text as unknown, no name`);
      else bad(`${label} hiring link, GET /a/<token>/rights: ${r.status} vs unknown ${unknownRights.status}; name shown: ${r.html.includes(name)}; text: ${r.text.slice(0, 200)} | unknown: ${unknownRights.text.slice(0, 200)}`);
    }
    const examRights = await page(exam.rawToken);
    if (examRights.status === 200 && examRights.html.includes("Guard exam") && !examRights.text.includes("Bu link geçerli değil"))
      ok("exam link, GET /a/<token>/rights: 200, the rights form with the name");
    else bad(`exam link, GET /a/<token>/rights: ${examRights.status}; text: ${examRights.text.slice(0, 200)}`);

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
    // People first (their invitations, hiring terms, links and attempts cascade), then the draft.
    for (const id of personIds) await db.delete(s.candidates).where(eq(s.candidates.id, id));
    await db.delete(s.candidates).where(eq(s.candidates.id, exam.candidateId));
    if (draft.openingId) await db.delete(s.hiringOpenings).where(eq(s.hiringOpenings.id, draft.openingId));
    if (draft.consentCreated && draft.consentTextId) await db.delete(s.consentTexts).where(eq(s.consentTexts.id, draft.consentTextId));
    if (draft.positionId) await db.delete(s.positions).where(eq(s.positions.id, draft.positionId));
  }

  const people = [...personIds, exam.candidateId];
  const leftovers = await db.execute<{ n: number }>(sql`
    select (select count(*) from candidates where id in ${people})
         + (select count(*) from assessments where candidate_id in ${people})
         + (select count(*) from hiring_openings where id = ${draft.openingId ?? null})
         + (select count(*) from positions where id = ${draft.positionId ?? null}) as n`);
  if (Number(leftovers[0]?.n ?? -1) === 0) ok("cleanup: no guard invitation, hiring term or draft opening is left");
  else bad(`cleanup left ${leftovers[0]?.n} row(s)`);

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
