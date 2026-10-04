# Hiring Library and Openings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the platform its organisation library (rating scale, competencies with behavioural anchors and observation tags, positions with a competency profile) and give the hiring solution everything up to a published, locked assessment: openings, team and rules, the assessment builder, the AI draft, the scorecard with weights, the candidate preview and the publish gate, while every hiring candidate endpoint keeps answering exactly like an unknown token.

**Architecture:** The library is core (`src/db/schema/library.ts`, `src/server/library*.ts`, `src/lib/library/*`, `/library/*` pages) and knows no solution table; it learns "where is this used" through an optional `library.usage()` hook on the solution contract. Hiring lives in `src/solutions/hiring/` (pure rules in `rules/`, database code in `server/`, AI in `ai/`), its pages in `src/app/(manager)/hiring/**` and its components in `src/components/hiring/**`; core reaches it only through the registries. A new manifest flag `candidateFlowLive` lets the hiring module be registered for the panel while every core candidate route and page still treats its invitations as unknown tokens until plan 2 flips the flag. A published version and everything under it is frozen by database triggers in a hand-written versioned migration; the scorecard (anchors, tags, weights) is copied into the version at publish so later library edits never change it.

**Tech Stack:** Next.js 16.3.4 App Router (server actions, `params` and `searchParams` are Promises), React 19.2.8, Tailwind 4 + shadcn/ui (`src/components/ui`, style radix-nova), Drizzle ORM 0.45.2 + drizzle-kit 0.31.10 (versioned migrations in `drizzle/migrations`), postgres.js, PostgreSQL 17 (Docker container `kademe-db`, port 5434), zod 4, next-intl 4, vitest 5, tsx, pnpm 11, Gemini through `src/lib/ai.ts` + `src/lib/ai-runs.ts`, Claude in Chrome for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-04-hiring-solution-design.md` (sections 1, 2.1 openings and members, 2.2, 2.3, 6, 8, 9 plan 1). Also binding: `docs/superpowers/specs/2026-10-03-platform-solutions-design.md` (core contract, sections 2, 3, 6), `docs/design/HIRING-UX.md` (sections 0-5 for these screens: 3.3, 3.9, 4.1-4.3, 4.6, 5.2-5.10, 5.18; section 8 visuals; 11 per-screen checklist), `docs/design/RULES.md`, `docs/STATUS.md` (invariants), and the core-separation final review notes in `.superpowers/sdd/2026-10-04-core-separation/progress.md` ("Left to hiring plans").

**Depends on:** the core separation plan, complete on `platform/solutions` at `992962d` (649 tests, `verify:exam` and `verify:guard` green on `kademe_platform`).

## Global Constraints

- Every schema change is a reviewed migration: edit `src/db/schema`, `pnpm db:generate --name <x>`, read the generated SQL, then prove it equal to the TypeScript schema with `pnpm db:fingerprint` on two fresh throw-away databases (one built by `drizzle-kit push --force`, one by `pnpm db:migrate`). Trigger or data-moving SQL is hand-written (`pnpm db:generate --custom --name <x>`), pinned by static checks in `src/db/migrations-sql.test.ts`, and proven on a throw-away database by a script.
- Migrations are applied to `kademe_platform` only: `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate`. Throw-away databases are named `kademe_*_check`, created and dropped in the same step through `docker exec kademe-db psql -U kademe -d postgres`.
- Never run `pnpm db:seed` or `pnpm db:reset` on a shared database. The library starter content is written by the idempotent `seedLibrary()`; it runs against `kademe_platform` only, through `pnpm db:seed-library` (which refuses any other host, port or the shared `kademe` database) or the in-app "Başlangıç içeriğini ekle" button.
- The shared `kademe` database and production are out of scope. No command in this plan connects to them.
- Exam behaviour is unchanged: `pnpm verify:exam` passes after every task that changes `kademe_platform` or the core (Tasks 1, 2, 4, 6, 8, 9, 14, 21), and `pnpm verify:guard` (dev server on 3100, same database) after every task that touches the registry or a candidate route (Tasks 1, 6, 14, 21).
- Hiring invitations are not served yet: every core candidate endpoint and the `/a/[token]/rights` page answer a HIRING token exactly like an unknown token (same status, same body, browser language, no first-seen record) until plan 2 sets `candidateFlowLive: true` on the hiring manifest.
- Core never imports `@/solutions/hiring/*` (ESLint `no-restricted-imports`); hiring never imports the exam (`src/solutions/boundary.test.ts`).
- UI: shadcn primitives from `src/components/ui` only; never add `badge`, `alert-dialog`, `chart`, `toast`, `sonner`. RULES.md: one filled button per screen (`variant="primary"`), a disabled button states its reason next to it with `<DisabledReason>` (never a tooltip), status is `StatusDot` (dot plus text), no "are you sure" dialog and no `alert`/`confirm` (undo: `UndoStrip` or an inline "Geri al"), accent only on the primary button, the active state and timers. New hiring and library screens set `--card-radius: 12px` once on their layout root. Page title 26/32 600, section title 16/24 600, body 14/22, meta 13/20 muted (HIRING-UX 8.4). Every number, score and date uses `.tnum`.
- Copy: Turkish first, English second, for every string; the TR and EN dictionaries have identical keys (`src/i18n/messages.test.ts`); the em-dash character (U+2014) appears nowhere: not in copy, code, comments, seed data or commit messages (a test scans the dictionaries and the seed data).
- AI never scores, ranks, shortlists or decides (HIRING-UX 3.9, R12). This plan adds exactly three `ai_purpose` values: `HIRING_DRAFT`, `ANCHOR_DRAFT`, `QUESTION_CHECK`. Every model call goes through `callJson` in `src/lib/ai-runs.ts` (one `ai_runs` row per call, failures included). AI output is shown as proposals; nothing is written to the database until a person accepts a proposal, and every acceptance can be undone.
- Browser checks use Claude in Chrome only (`mcp__claude-in-chrome__*`), never Playwright. The dev server is started only as `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm dev --port 3100` and stopped with `lsof -nP -iTCP:3100 -sTCP:LISTEN -t | xargs kill`. Before starting, check the port: if another session already listens on 3100, coordinate instead of killing it. `PROCTOR_DEV_FAKE` is never set. Panel login on `kademe_platform`: `kadiraycareer@gmail.com` / `kademe-dev-2026`.
- Commits on branch `platform/solutions`, `git add` only the files the task names, English message (imperative subject, body), last line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git checkout`, `git switch`, `git stash` or `git reset`.
- Gates for every task: `pnpm exec tsc --noEmit`, `pnpm exec eslint src scripts`, `pnpm test` (649 tests at the start; the count only grows and no earlier test name disappears unless the task rewrites that file), plus `pnpm build` where the task adds or changes routes.
- Code, identifiers, comments and commit messages in English. Read the relevant guide in `node_modules/next/dist/docs/` before using a Next API not already used in this repo.

## Decisions taken in this plan (open points from the specs and the core review)

1. **Hiring stays invisible to candidates through a manifest flag, not through "no invitations".** `SolutionManifest.candidateFlowLive: boolean`; `candidateSolution(kind)` in `registry.server.ts` returns a module only when the flag is on, and `withCandidate` (default `acceptSolution`), `withSolution` and the rights page use it. Reason: the panel needs the module registered now (menu, library usage), `verify:guard` already writes HIRING rows straight into the database, and a stray HIRING row must never reach module methods that plan 2 has not written. Flipping one boolean in plan 2 is the whole switch.
2. **`inviteHref` becomes `string | null`;** Today's invite button uses the first solution that can invite (`inviteTargets()`), not `modules[0]`. Hiring declares `null` until plan 2, so Today keeps "Öğrenci davet et" even though hiring is first in the menu.
3. **Library "where used" is a contract hook** (`SolutionModule.library?.usage(orgId, refs)`), so `/library/*` (core) shows "İşe alım · 2" without importing hiring. A position's "Bu pozisyon için alım aç" comes from an optional `positionAction` on the manifest for the same reason.
4. **Competencies get two columns the spec does not list:** `seed_key` (idempotent seeding, unique per org) and `reviewed_at` (HIRING-UX 5.10 "Kademe başlangıç içeriği, ekibiniz incelemedi" until someone ticks "İncelendi"). Positions get `team`, `skills`, `languages` as the spec's "ekip, beceriler, diller".
5. **One rating scale per organisation in this plan** (`is_default`, partial unique index). The scales tab edits level names (Owner only); "Skala ekle" is not built (HIRING-UX calls it rare; YAGNI).
6. **Draft weights live on the draft version** (`weights_enabled`, `draft_weights`), published weights live in `hiring_weight_sets` (first set written at publish from the scorecard, later sets need a reason, stored in a new `reason` column). Position profile weights are importance (0-100, any sum) and are normalised to integers summing to 100 by largest remainder; a measured competency missing from the profile counts as the profile's average.
7. **Publish gate = spec 2.2 rules plus three obvious ones** (a stage needs a name and at least one question, a question needs text, an archived competency blocks). HIRING-UX 5.4's readiness rows "Ekip atandı" and "Önizleme yapıldı" are shown but do not block publishing: the server gate in the data spec is binding, a team can be added after publishing (invitations only exist in plan 2), and "previewed" cannot be proven.
8. **Editing a published version is explicit:** when the latest version is published and there is no draft, the builder shows the live content read-only with the HIRING-UX sentence and one filled button "Düzenlemeye başla" that creates v(n+1) as a copy. This avoids mapping ids of the live version onto the copy.
9. **Order is changed with "Yukarı taşı / Aşağı taşı" buttons, not drag and drop,** and only within a stage. Order columns are plain indexes (not unique) so moves, deletes and undo-restores never fight a unique constraint; the server renumbers 0..n-1 after each change. The "at most two competencies per question" rule IS a database rule: `order_index IN (0, 1)` plus `UNIQUE (activity_id, order_index)`.
10. **AI proposals are not stored.** They live in the AI page's state; reloading means generating again (one more `ai_runs` row). A card is shown only when its quote is found in the job ad (HIRING-UX 5.6); a new-competency card hidden for that reason is also removed from the questions that referenced it. A stage card that measures a new competency can be accepted only after that competency card is accepted ("Önce X yetkinliğini kabul et."). Generating writes the job ad onto the position only when the position had none.
11. **Question check = rules + AI.** A deterministic protected-trait check (marital status, age, origin, children, pregnancy, religion, ethnicity, disability, politics, union) runs live in the builder without any network call; "Soruları kontrol et" adds the AI's `QUESTION_CHECK` findings. AI findings whose excerpt is not in the question are dropped.
12. **Proctoring level is not edited in this plan.** `hiring_versions.proctor_level` exists (default `BASIC`, spec), but the Gözetim block of 5.18 belongs to plan 4: a per-version column cannot change on a published version, which contradicts 5.18's "new invitations get the new rule" (see "Spec issues" in the hand-over). `consent_text_id` stays null until plan 2 decides consent per version.
13. **Opening access:** OWNER and MANAGER see and edit every opening (capability `opening:write`); a REVIEWER sees only openings where they are a member, decision maker or backup, read-only; anyone else gets 404 (the opening's existence is not revealed). Decision maker and backup must be OWNER or MANAGER. `min_evaluations` (1-5, default 2) is the single "each candidate is evaluated by at least N" number; plan 2 decides how assignments are drawn.
14. **Tabs of an opening in this plan:** Genel bakış, Değerlendirme (builder, AI, scorecard, preview as a second row), Ekip ve kurallar. "Adaylar" and "Karşılaştır" appear in plans 2 and 3 (RULES 7: no links to pages that do not exist). Today gets no hiring rows yet (`today()` returns `[]`).

## File Structure

| Path | Responsibility |
|---|---|
| `src/solutions/types.ts` | Contract: `candidateFlowLive`, `inviteHref: string \| null`, `positionAction?`, `library?.usage`, `LibraryRefs`, `LibraryUsage`. |
| `src/solutions/registry.ts`, `registry.server.ts` (+ tests) | Hiring registered first; `candidateSolution()`, `inviteTargets()`, `buildNav()` with the Library group. |
| `src/lib/candidate-api.ts` (+ test), `src/app/a/[token]/rights/page.tsx` (+ test) | Serve candidates only for a live module. |
| `src/db/schema/enums.ts` | `observation_polarity`, hiring enums, three new `ai_purpose` values. |
| `src/db/schema/library.ts` | `rating_scales`, `scale_levels`, `competencies`, `competency_anchors`, `observation_tags`, `positions`, `position_competencies`. |
| `src/db/schema/hiring.ts` | `hiring_openings`, `hiring_opening_members`, `hiring_versions`, `hiring_stages`, `hiring_activities`, `hiring_activity_competencies`, `hiring_weight_sets`, `hiring_weights`, jsonb types (`ScorecardSnapshot`, `HiringActivityConfig`, `AnswerExamples`). |
| `drizzle/migrations/0004_library.sql`, `0005_hiring_openings.sql` | Generated, reviewed. |
| `drizzle/migrations/0006_hiring_immutability.sql` | Hand-written triggers. |
| `src/db/migrations-sql.test.ts` | Static checks for 0004-0006. |
| `scripts/verify-hiring-immutability.ts` | Trigger behaviour on a throw-away database. |
| `src/db/library-seed-data.ts` (+ test), `src/db/library-seed.ts`, `scripts/seed-library.ts` | Starter library (8 competencies TR+EN, anchors 1/3/5, tags, 5-level scale); idempotent seeding. |
| `src/lib/library/anchors.ts` (+ test), `src/lib/library/usage.ts` (+ test) | Pure: required anchor levels, anchor quality hint, usage grouping. |
| `src/lib/library/anchor-draft.ts` (+ test), `src/server/anchor-draft-job.ts` | `ANCHOR_DRAFT` prompt, schema, parsing; the logged call. |
| `src/server/library.ts`, `src/server/library-write.ts` | Library read model (with usage through the registry) and writes. |
| `src/lib/authorize.ts` (+ test) | `library:write`, `library:scale`, `opening:write`. |
| `src/app/(manager)/library/**` | Library pages and actions. |
| `src/components/library/*` | Competency form, scale form, position form, usage block, anchor assist. |
| `src/components/manager/page-title.tsx`, `route-tabs.tsx` | Shared heading and route tabs for new screens. |
| `src/solutions/hiring/rules/*` (+ tests) | Pure: content types, publish gate, weights, scorecard snapshot, candidate view, access, patches, opening rules. |
| `src/solutions/hiring/server/*` | Openings, versions, publish, weight sets, library usage, content loading. |
| `src/solutions/hiring/ai/*` (+ tests) | `HIRING_DRAFT` and `QUESTION_CHECK`: prompts, schemas, parsing, visibility. |
| `src/solutions/hiring/manifest.ts`, `module.ts` (+ test) | The hiring solution as the core sees it. |
| `scripts/verify-hiring-setup.ts` | Openings, versions, publish, weights end to end on a throw-away database. |
| `src/app/(manager)/hiring/**` | Openings list, new, overview, builder, AI, scorecard, preview, settings. |
| `src/components/hiring/**` | Client components for those screens. |
| `src/i18n/messages/library.{tr,en}.json`, `hiring.{tr,en}.json`, `manager.{tr,en}.json`, `src/i18n/manager.ts`, `src/i18n/messages.test.ts` | Copy. |
| `eslint.config.mjs`, `src/solutions/boundary.test.ts` | Hiring folders exempt from the core rule; hiring never imports the exam. |
| `src/app/(manager)/layout.tsx`, `dashboard/page.tsx`, `src/lib/legacy-routes.test.ts` | Library labels in the menu, invite target, menu-links-exist test. |
| `docs/STATUS.md` | What exists, what was verified, how to run it. |

---

### Task 1: Serve candidates only for a live solution module

**Files:**
- Modify: `src/solutions/types.ts`
- Modify: `src/solutions/language-exam/manifest.ts`
- Modify: `src/solutions/registry.server.ts`
- Modify: `src/lib/candidate-api.ts`
- Modify: `src/app/a/[token]/rights/page.tsx`
- Modify: `scripts/verify-solution-guard.ts` (one log label)
- Test: `src/solutions/registry.test.ts`, `src/lib/candidate-api.test.ts` (rewritten around a stubbed registry), `src/app/a/[token]/rights/page.test.ts`

**Interfaces:**
- Produces: `SolutionManifest.candidateFlowLive: boolean`.
- Produces: `candidateSolution(kind: SolutionKind, modules?: readonly SolutionModule[]): SolutionModule | null` in `@/solutions/registry.server`.
- Behaviour: `withCandidate` without `acceptSolution`, `withSolution`, and `/a/[token]/rights` treat a solution as unknown unless `candidateSolution(kind)` returns a module.

- [ ] **Step 1: Write the failing registry test**

Add to `src/solutions/registry.test.ts` (keep every existing test; extend the import line):

```ts
import { candidateSolution, solutionModule, solutionModules } from "./registry.server";
import type { SolutionModule } from "./types";

describe("candidate flow", () => {
  it("serves candidates only for a registered module whose candidate flow is live", () => {
    const exam = solutionModule("LANGUAGE_EXAM")!;
    const hiringNotLive = {
      ...exam,
      key: "hiring",
      dbKind: "HIRING",
      basePath: "/hiring",
      candidateFlowLive: false,
    } as SolutionModule;
    expect(exam.candidateFlowLive).toBe(true);
    expect(candidateSolution("LANGUAGE_EXAM")?.key).toBe("language-exam");
    expect(candidateSolution("HIRING", [exam])).toBeNull();
    expect(candidateSolution("HIRING", [exam, hiringNotLive])).toBeNull();
    expect(candidateSolution("HIRING", [exam, { ...hiringNotLive, candidateFlowLive: true }])?.key).toBe("hiring");
  });
});
```

- [ ] **Step 2: Rewrite the candidate API test around a stubbed registry**

Replace `src/lib/candidate-api.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// A solution the platform will not serve must be turned away before anything
// touches the database.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

const resolveToken = vi.fn();
const recordFirstSeen = vi.fn();
vi.mock("@/lib/candidate-context", () => ({
  resolveToken: (...args: unknown[]) => resolveToken(...args),
  recordFirstSeen: (...args: unknown[]) => recordFirstSeen(...args),
}));

/**
 * A stubbed registry: which solutions have a module and which of those serve
 * candidates. The real registry's rule is tested in registry.test.ts; here the
 * question is only whether the candidate API follows it.
 */
type Stub = { registered: boolean; live: boolean };
const registry: Record<string, Stub> = {};
vi.mock("@/solutions/registry.server", () => {
  const find = (kind: string) =>
    registry[kind]?.registered ? { key: kind.toLowerCase(), dbKind: kind, candidateFlowLive: registry[kind].live } : null;
  return {
    solutionModule: find,
    candidateSolution: (kind: string) => {
      const m = find(kind);
      return m && m.candidateFlowLive ? m : null;
    },
  };
});

import { NextRequest } from "next/server";
import { withCandidate, withSolution } from "@/lib/candidate-api";
import type { CandidateContext, LinkProblem } from "@/lib/candidate-context";

function ctx(solution: CandidateContext["assessment"]["solution"]): CandidateContext {
  return {
    link: { id: "l", status: "NOT_STARTED", expiresAt: new Date(), notBefore: null, firstSeenIp: null },
    assessment: { id: "a", orgId: "o", solution },
    candidate: { id: "c", fullName: null, email: null, phone: null, location: null },
    orgName: "Org",
    locale: "tr",
    contactEmail: null,
    contactName: null,
    mediaRetentionDays: 180,
    evidenceRetentionDays: 90,
  };
}

async function call(token: string, options: Parameters<typeof withCandidate>[3] = {}) {
  const req = new NextRequest(`http://localhost/api/c/${token}/consent`, { method: "GET" });
  const handler = vi.fn(async () => new Response("handled"));
  const res = await withCandidate(req, Promise.resolve({ token }), handler, options);
  return { res, handler };
}

async function snapshot(res: Response) {
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
}

beforeEach(() => {
  for (const key of Object.keys(registry)) delete registry[key];
  registry.LANGUAGE_EXAM = { registered: true, live: true };
  resolveToken.mockReset();
  recordFirstSeen.mockReset();
});

describe("withCandidate without acceptSolution", () => {
  const links: Array<[string, LinkProblem | null, Partial<CandidateContext["link"]>]> = [
    ["open", null, {}],
    ["EXPIRED", "EXPIRED", { status: "EXPIRED" }],
  ];

  async function expectUnknown(problem: LinkProblem | null, link: Partial<CandidateContext["link"]>) {
    resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    const unknown = await call("unknown-token-of-sufficient-length");
    const hiring = { ...ctx("HIRING"), link: { ...ctx("HIRING").link, ...link } };
    resolveToken.mockResolvedValueOnce(problem ? { ok: false, problem, ctx: hiring } : { ok: true, ctx: hiring });
    const other = await call("hiring-token-of-sufficient-length");
    expect(await snapshot(other.res)).toEqual(await snapshot(unknown.res));
    expect(other.res.status).toBe(404);
    expect(other.handler).not.toHaveBeenCalled();
    expect(recordFirstSeen).not.toHaveBeenCalled();
  }

  it.each(links)("answers a %s HIRING link with no module like an unknown token", async (_name, problem, link) => {
    await expectUnknown(problem, link);
  });

  it.each(links)("answers a %s HIRING link whose module is registered but not live like an unknown token", async (_name, problem, link) => {
    registry.HIRING = { registered: true, live: false };
    await expectUnknown(problem, link);
  });

  it("lets a HIRING invitation through once its candidate flow is live (plan 2 flips the flag)", async () => {
    registry.HIRING = { registered: true, live: true };
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const { res, handler } = await call("hiring-token-of-sufficient-length");
    expect(await res.text()).toBe("handled");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("still tolerates link problems for a live solution when allowProblems says so", async () => {
    const exam = { ...ctx("LANGUAGE_EXAM"), link: { ...ctx("LANGUAGE_EXAM").link, status: "EXPIRED" as const } };
    resolveToken.mockResolvedValueOnce({ ok: false, problem: "EXPIRED", ctx: exam });
    const { res, handler } = await call("exam-token-of-sufficient-length", { allowProblems: ["EXPIRED"] });
    expect(await res.text()).toBe("handled");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("lets a LANGUAGE_EXAM invitation reach the handler", async () => {
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("LANGUAGE_EXAM") });
    const { res, handler } = await call("exam-token-of-sufficient-length");
    expect(await res.text()).toBe("handled");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(recordFirstSeen).toHaveBeenCalledTimes(1);
  });
});

describe("withSolution", () => {
  async function solutionCall(token: string) {
    const req = new NextRequest(`http://localhost/api/c/${token}/state`, { method: "GET" });
    const handler = vi.fn(async () => new Response("handled"));
    const res = await withSolution(req, Promise.resolve({ token }), handler);
    return { res, handler };
  }

  it("hands the live module to the handler", async () => {
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("LANGUAGE_EXAM") });
    const { handler } = await solutionCall("exam-token-of-sufficient-length");
    expect(handler.mock.calls[0][2]).toMatchObject({ dbKind: "LANGUAGE_EXAM" });
  });

  it("answers a registered but not live solution like an unknown token", async () => {
    registry.HIRING = { registered: true, live: false };
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const { res, handler } = await solutionCall("hiring-token-of-sufficient-length");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("INVALID");
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Pin the rights page to the same rule**

In `src/app/a/[token]/rights/page.test.ts`, add after the `vi.mock("@/lib/candidate-context", ...)` block:

```ts
// Stubbed registry: the exam is live, hiring is registered but not live yet.
vi.mock("@/solutions/registry.server", () => ({
  candidateSolution: (kind: string) => (kind === "LANGUAGE_EXAM" ? { key: "language-exam", dbKind: kind, candidateFlowLive: true } : null),
}));
```

and rename the `it.each` title `"renders %s HIRING link (no module) exactly like an unknown token"` to `"renders %s HIRING link (no live candidate flow) exactly like an unknown token"`. Nothing else in that file changes.

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/solutions/registry.test.ts src/lib/candidate-api.test.ts "src/app/a/[token]/rights/page.test.ts"`
Expected: FAIL. `candidateSolution` is not exported from `registry.server` (registry test), the exam manifest has no `candidateFlowLive`, and the rights page imports `solutionModule`, which the stub does not provide.

- [ ] **Step 5: Add the flag to the contract and the exam manifest**

In `src/solutions/types.ts`, inside `interface SolutionManifest`, after `inviteHref: string;` add:

```ts
  /**
   * True once this solution's candidate screens and endpoints exist. Until
   * then every core candidate route and page answers its invitations exactly
   * like an unknown token, even though the panel already uses the module.
   */
  candidateFlowLive: boolean;
```

In `src/solutions/language-exam/manifest.ts`, after `inviteHref: "/exam/students/new",` add `candidateFlowLive: true,`.

- [ ] **Step 6: Add `candidateSolution` to the server registry**

Append to `src/solutions/registry.server.ts`:

```ts
/**
 * The module that answers this solution's candidates, or null. A registered
 * solution whose candidate flow is not live yet is treated exactly like an
 * unregistered one by every core candidate route and page (spec 6: no leak).
 * `modules` exists for tests; production code passes nothing.
 */
export function candidateSolution(
  kind: SolutionKind,
  modules: readonly SolutionModule[] = MODULES,
): SolutionModule | null {
  const found = modules.find((m) => m.dbKind === kind) ?? null;
  return found && found.candidateFlowLive ? found : null;
}
```

- [ ] **Step 7: Use it in the candidate API and the rights page**

In `src/lib/candidate-api.ts`:
- change the import to `import { candidateSolution } from "@/solutions/registry.server";`
- in `CandidateRouteOptions.acceptSolution`'s doc comment replace `Defaults to "the solution has a registered module".` with `Defaults to "the solution has a module whose candidate flow is live".`
- replace the default in `withCandidate`:

```ts
  // Default: only solutions whose candidate flow is live are served, so no core
  // route can reveal an invitation of a solution that cannot answer for it yet.
  const accept = options.acceptSolution ?? ((kind: SolutionKind) => candidateSolution(kind) !== null);
```

- in `withSolution` replace `const solution = solutionModule(ctx.assessment.solution);` with `const solution = candidateSolution(ctx.assessment.solution);` and `{ ...options, acceptSolution: (kind) => solutionModule(kind) !== null },` with `{ ...options, acceptSolution: (kind) => candidateSolution(kind) !== null },`; in its doc comment replace "no registered module" with "no live candidate flow".

In `src/app/a/[token]/rights/page.tsx`: import `candidateSolution` instead of `solutionModule`, use `resolved.ctx && candidateSolution(resolved.ctx.assessment.solution)`, and in the doc comment replace "a solution with no registered module" with "a solution whose candidate flow is not live".

In `scripts/verify-solution-guard.ts` change the log line `"\nCore endpoints refuse a solution with no registered module"` to `"\nCore endpoints refuse a solution with no live candidate flow"`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/solutions/registry.test.ts src/lib/candidate-api.test.ts "src/app/a/[token]/rights/page.test.ts"`
Expected: PASS.

- [ ] **Step 9: Gates, exam and guard**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
lsof -nP -iTCP:3100 -sTCP:LISTEN    # must print nothing; otherwise coordinate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm dev --port 3100   # run in the background
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard
lsof -nP -iTCP:3100 -sTCP:LISTEN -t | xargs kill
```
Expected: tsc and eslint exit 0; vitest passes with more tests than 649; both verify scripts print only `ok` lines and exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/solutions/types.ts src/solutions/language-exam/manifest.ts src/solutions/registry.server.ts src/solutions/registry.test.ts src/lib/candidate-api.ts src/lib/candidate-api.test.ts "src/app/a/[token]/rights/page.tsx" "src/app/a/[token]/rights/page.test.ts" scripts/verify-solution-guard.ts
git commit -m "Serve candidates only for a solution whose candidate flow is live" -m "The manifest gains candidateFlowLive and the server registry candidateSolution(). Core candidate endpoints, withSolution and the rights page use it, so the hiring module can be registered for the panel while its invitations are still answered exactly like unknown tokens. The candidate API test now runs against a stubbed registry." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Library schema and migration 0004

**Files:**
- Modify: `src/db/schema/enums.ts`
- Create: `src/db/schema/library.ts`
- Modify: `src/db/schema/index.ts`
- Modify: `src/lib/ai-runs.ts` (derive `AiPurpose` from the enum)
- Create (generated): `drizzle/migrations/0004_library.sql`, `drizzle/migrations/meta/0004_snapshot.json`, `drizzle/migrations/meta/_journal.json` (modified)
- Test: `src/db/migrations-sql.test.ts`

**Interfaces:**
- Produces tables and Drizzle objects: `ratingScales`, `scaleLevels`, `competencies`, `competencyAnchors`, `observationTags`, `positions`, `positionCompetencies`; enum `observationPolarity` (`POSITIVE`, `NEGATIVE`); `ai_purpose` gains `ANCHOR_DRAFT`.
- Produces: `type AiPurpose = (typeof aiPurpose.enumValues)[number]` in `@/lib/ai-runs`.

- [ ] **Step 1: Write the failing static test**

Append to `src/db/migrations-sql.test.ts`:

```ts
describe("0004_library", () => {
  const sql = read("0004_library");

  it.each([
    "rating_scales",
    "scale_levels",
    "competencies",
    "competency_anchors",
    "observation_tags",
    "positions",
    "position_competencies",
  ])("creates %s", (table) => {
    expect(sql).toContain(`CREATE TABLE "${table}"`);
  });

  it("adds the AI purpose in place instead of recreating the enum", () => {
    expect(sql).toContain(`ALTER TYPE "public"."ai_purpose" ADD VALUE 'ANCHOR_DRAFT';`);
    expect(sql).not.toMatch(/DROP TYPE/);
  });

  it("only adds: no table, column or type is dropped", () => {
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN|TYPE)/);
  });

  it("keeps one default scale per organisation in the database", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX "one_default_scale_per_org" ON "rating_scales" USING btree \("org_id"\) WHERE is_default/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/db/migrations-sql.test.ts`
Expected: FAIL with `ENOENT ... 0004_library.sql`.

- [ ] **Step 3: Add the enum values**

In `src/db/schema/enums.ts`, add `"ANCHOR_DRAFT", // proposed 1-5 behavioural anchors for a competency; a person accepts or edits them` as the last value of `aiPurpose`, and append:

```ts
/** Observation tags under a competency: evidence for (+) or against (-). */
export const observationPolarity = pgEnum("observation_polarity", ["POSITIVE", "NEGATIVE"]);
```

- [ ] **Step 4: Write the library schema**

Create `src/db/schema/library.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./org";
import { observationPolarity } from "./enums";
import type { I18nText } from "./types";

/**
 * The organisation's library (hiring solution design 1). Positions,
 * competencies and rating scales belong to the organisation, not to a
 * solution: hiring reads them today, position analysis and performance reviews
 * will read them later. Nothing here knows a solution table. A solution copies
 * what it needs when it publishes, so editing the library never changes a
 * published assessment.
 *
 * Nothing is deleted: rows are archived and stay readable.
 */
export const ratingScales = pgTable(
  "rating_scales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minValue: integer("min_value").notNull().default(1),
    maxValue: integer("max_value").notNull().default(5),
    /** One default per organisation; new competencies use it. */
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rating_scales_org_idx").on(t.orgId),
    uniqueIndex("one_default_scale_per_org").on(t.orgId).where(sql`is_default`),
    check("rating_scale_range", sql`${t.minValue} < ${t.maxValue}`),
  ],
);

/** The general name of each level (HIRING-UX 3.3); competency anchors fill it in. */
export const scaleLevels = pgTable(
  "scale_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scaleId: uuid("scale_id")
      .notNull()
      .references(() => ratingScales.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    label: jsonb("label").$type<I18nText>().notNull(),
  },
  (t) => [uniqueIndex("scale_level_value").on(t.scaleId, t.value)],
);

export const competencies = pgTable(
  "competencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: jsonb("name").$type<I18nText>().notNull(),
    /** For the team; never shown to a candidate. */
    description: jsonb("description").$type<I18nText>().notNull().default({ tr: "", en: "" }),
    scaleId: uuid("scale_id")
      .notNull()
      .references(() => ratingScales.id, { onDelete: "restrict" }),
    /** Set on Kademe starter content only; makes seeding idempotent. */
    seedKey: text("seed_key"),
    /**
     * When the team confirmed the definition. Null on starter content until
     * someone ticks "İncelendi" (HIRING-UX 5.10); set at creation otherwise.
     */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("competencies_org_idx").on(t.orgId),
    uniqueIndex("competency_seed_key_per_org").on(t.orgId, t.seedKey),
  ],
);

/**
 * The competency's own behavioural anchor for one level. Levels 1, 3 and 5 are
 * required before anything that measures the competency can be published; 2
 * and 4 are optional (HIRING-UX 3.3).
 */
export const competencyAnchors = pgTable(
  "competency_anchors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    body: jsonb("body").$type<I18nText>().notNull(),
  },
  (t) => [uniqueIndex("competency_anchor_value").on(t.competencyId, t.value)],
);

/**
 * Clickable evidence chips under a competency. Ids are stable: a removed tag is
 * archived, never deleted, because published scorecards copy tag ids.
 */
export const observationTags = pgTable(
  "observation_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "cascade" }),
    polarity: observationPolarity("polarity").notNull(),
    label: jsonb("label").$type<I18nText>().notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("observation_tags_competency_idx").on(t.competencyId)],
);

/** A role's lasting definition (HIRING-UX 4.2). An opening is a hiring process for it. */
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    team: text("team"),
    shortDescription: text("short_description"),
    /** The job ad. The AI draft reads it. */
    jobDescription: text("job_description"),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    languages: jsonb("languages").$type<string[]>().notNull().default([]),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("positions_org_idx").on(t.orgId)],
);

/**
 * The position's competency profile: which competencies the role needs, how
 * much each matters (0-100, any sum; an opening scales them to 100) and,
 * optionally, the level expected.
 */
export const positionCompetencies = pgTable(
  "position_competencies",
  {
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "restrict" }),
    weight: integer("weight").notNull().default(50),
    expectedLevel: integer("expected_level"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.positionId, t.competencyId] }),
    index("position_competencies_competency_idx").on(t.competencyId),
    check("position_competency_weight", sql`${t.weight} BETWEEN 0 AND 100`),
    check(
      "position_competency_expected_level",
      sql`${t.expectedLevel} IS NULL OR ${t.expectedLevel} BETWEEN 1 AND 5`,
    ),
  ],
);
```

Add `export * from "./library";` to `src/db/schema/index.ts` after `export * from "./compliance";`.

In `src/lib/ai-runs.ts` replace the hand-written `AiPurpose` union with:

```ts
import type { aiPurpose } from "@/db/schema";

/** Every purpose the database accepts; a new one is a migration, not a string. */
export type AiPurpose = (typeof aiPurpose.enumValues)[number];
```

(keep the existing `aiRuns` value import from `@/db/schema` on its own line).

- [ ] **Step 5: Generate and review the migration**

```bash
pnpm db:generate --name library
```
Read `drizzle/migrations/0004_library.sql`. Expected: `CREATE TYPE "public"."observation_polarity"`, `ALTER TYPE "public"."ai_purpose" ADD VALUE 'ANCHOR_DRAFT';`, seven `CREATE TABLE`, the foreign keys, indexes and checks above, and no `DROP`. If drizzle-kit wrote a drop-and-recreate of `ai_purpose` instead of `ADD VALUE`, replace those statements with the single line `ALTER TYPE "public"."ai_purpose" ADD VALUE 'ANCHOR_DRAFT';--> statement-breakpoint` and add the comment `-- Reviewed by hand: ADD VALUE keeps every existing ai_runs row.` at the top. Do not edit `meta/*`.

- [ ] **Step 6: Prove the migration equals the schema, then apply it**

```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_push_check" -c "create database kademe_push_check" -c "drop database if exists kademe_mig_check" -c "create database kademe_mig_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm exec drizzle-kit push --force < /dev/null
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm -s db:fingerprint > /tmp/kademe-push.fp
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm -s db:fingerprint > /tmp/kademe-mig.fp
diff /tmp/kademe-push.fp /tmp/kademe-mig.fp && echo IDENTICAL
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_push_check" -c "drop database kademe_mig_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate
```
Expected: `IDENTICAL`; the last command prints `migrations applied`. Stop any dev server this session started before migrating.

- [ ] **Step 7: Run the tests and the gates**

```bash
pnpm exec vitest run src/db/migrations-sql.test.ts src/db/migration-files.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
Expected: PASS everywhere; verify:exam prints only `ok` lines.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema/enums.ts src/db/schema/library.ts src/db/schema/index.ts src/lib/ai-runs.ts drizzle/migrations src/db/migrations-sql.test.ts
git commit -m "Add the organisation library tables" -m "Migration 0004 adds rating scales and levels, competencies with behavioural anchors and observation tags, positions and their competency profile, and the ANCHOR_DRAFT AI purpose. The fingerprint of a migrated database equals a pushed one. AiPurpose is now derived from the enum." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Anchor rules and the idempotent starter library

**Files:**
- Create: `src/lib/library/anchors.ts`, `src/lib/library/anchors.test.ts`
- Create: `src/db/library-seed-data.ts`, `src/db/library-seed-data.test.ts`
- Create: `src/db/library-seed.ts`
- Create: `scripts/seed-library.ts`
- Modify: `package.json` (script `db:seed-library`)
- Modify: `src/db/seed.ts` (fresh local databases get the library too)

**Interfaces:**
- Produces in `@/lib/library/anchors`: `REQUIRED_ANCHOR_LEVELS: readonly [1, 3, 5]`, `MAX_TAGS_PER_SIDE = 6`, `hasText(t: I18nText | null | undefined): boolean`, `missingAnchorLevels(anchors: Partial<Record<number, I18nText>>): number[]`, `type AnchorHint = "ADJECTIVE" | "TOO_SHORT"`, `anchorHint(text: string, locale: Locale): AnchorHint | null`.
- Produces in `@/db/library-seed-data`: `DEFAULT_SCALE`, `SEED_COMPETENCIES: CompetencySeed[]`.
- Produces in `@/db/library-seed`: `ensureDefaultScale(orgId: string): Promise<{ id: string; created: boolean }>`, `seedLibrary(orgId: string): Promise<{ scaleCreated: boolean; competenciesCreated: number }>`.
- Produces: `pnpm db:seed-library` (local 5434 only, refuses the shared `kademe` database).

- [ ] **Step 1: Write the failing anchor tests**

Create `src/lib/library/anchors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { anchorHint, hasText, missingAnchorLevels, REQUIRED_ANCHOR_LEVELS } from "./anchors";

describe("anchors", () => {
  it("requires levels 1, 3 and 5", () => {
    expect(REQUIRED_ANCHOR_LEVELS).toEqual([1, 3, 5]);
  });

  it("counts a level as written when either language has text", () => {
    expect(hasText({ tr: "  ", en: "" })).toBe(false);
    expect(hasText({ tr: "", en: "Asks a question" })).toBe(true);
    expect(hasText(null)).toBe(false);
  });

  it("lists the required levels that are missing, in order", () => {
    expect(missingAnchorLevels({})).toEqual([1, 3, 5]);
    expect(missingAnchorLevels({ 1: { tr: "a", en: "" }, 5: { tr: " ", en: "" } })).toEqual([3, 5]);
    expect(missingAnchorLevels({ 1: { tr: "a", en: "" }, 3: { tr: "b", en: "" }, 5: { tr: "c", en: "" } })).toEqual([]);
  });

  it("flags a trait word instead of a behaviour (HIRING-UX 5.10)", () => {
    expect(anchorHint("İyi iletişimci", "tr")).toBe("ADJECTIVE");
    expect(anchorHint("Çok iyi ve güçlü bir iletişimci", "tr")).toBe("ADJECTIVE");
    expect(anchorHint("A strong, confident communicator", "en")).toBe("ADJECTIVE");
  });

  it("flags a definition too short to describe a behaviour", () => {
    expect(anchorHint("Soruyu özetler", "tr")).toBe("TOO_SHORT");
  });

  it("accepts an observable behaviour, even with one trait word in a long sentence", () => {
    expect(anchorHint("Karşı tarafın sorusunu kendi cümleleriyle özetler.", "tr")).toBeNull();
    expect(anchorHint("Sets expectations up front, delivers bad news in time and follows up in writing.", "en")).toBeNull();
    expect(anchorHint("", "tr")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/library/anchors.test.ts`
Expected: FAIL with `Cannot find module './anchors'`.

- [ ] **Step 3: Implement the anchor rules**

Create `src/lib/library/anchors.ts`:

```ts
import type { I18nText } from "@/db/schema/types";
import type { Locale } from "@/i18n/locale";

/**
 * Behavioural anchors (HIRING-UX 3.3). A competency's levels 1, 3 and 5 must be
 * written before anything that measures it is published; 2 and 4 are optional.
 * Pure: the library form, the publish gate and the scorecard share it.
 */
export const REQUIRED_ANCHOR_LEVELS = [1, 3, 5] as const;
export const ANCHOR_LEVELS = [1, 2, 3, 4, 5] as const;

/** HIRING-UX 5.10: at most six observation tags on each side. */
export const MAX_TAGS_PER_SIDE = 6;

/** Written in at least one language. A one-language org must not be blocked. */
export function hasText(text: I18nText | null | undefined): boolean {
  return !!text && (text.tr.trim().length > 0 || text.en.trim().length > 0);
}

export function missingAnchorLevels(anchors: Partial<Record<number, I18nText>>): number[] {
  return REQUIRED_ANCHOR_LEVELS.filter((level) => !hasText(anchors[level]));
}

export type AnchorHint = "ADJECTIVE" | "TOO_SHORT";

/**
 * Words that describe a person instead of something a reviewer can observe.
 * The check is a nudge (HIRING-UX 5.10 "kural tabanlı"), never a gate.
 */
const TRAIT_WORDS: Record<Locale, readonly string[]> = {
  tr: ["iyi", "güçlü", "başarılı", "mükemmel", "harika", "yetersiz", "zayıf", "kötü", "etkili", "iletişimci", "özgüvenli", "yetenekli", "çalışkan"],
  en: ["good", "strong", "excellent", "great", "poor", "weak", "bad", "effective", "communicator", "confident", "talented", "hardworking"],
};

export function anchorHint(text: string, locale: Locale): AnchorHint | null {
  const words = text.toLocaleLowerCase(locale === "tr" ? "tr" : "en").match(/[\p{L}']+/gu) ?? [];
  if (words.length === 0) return null;
  const traits = words.filter((w) => TRAIT_WORDS[locale].includes(w)).length;
  if (traits > 0 && traits / words.length >= 0.2) return "ADJECTIVE";
  if (words.length < 4) return "TOO_SHORT";
  return null;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run src/lib/library/anchors.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing seed data test**

Create `src/db/library-seed-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { anchorHint, MAX_TAGS_PER_SIDE } from "@/lib/library/anchors";
import { DEFAULT_SCALE, SEED_COMPETENCIES } from "./library-seed-data";

describe("library starter content", () => {
  it("has the HIRING-UX 3.3 level names", () => {
    expect(DEFAULT_SCALE.levels.map((l) => l.label.tr)).toEqual(["Belirgin eksik", "Kısmen", "Beklenen düzeyde", "Güçlü", "Örnek düzeyde"]);
    expect(DEFAULT_SCALE.levels.map((l) => l.label.en)).toEqual(["Clear gap", "Partly there", "Meets the bar", "Strong", "Exceptional"]);
  });

  it("ships the eight competencies of the old product, keys unique", () => {
    const keys = SEED_COMPETENCIES.map((c) => c.key);
    expect(keys).toEqual(["communication", "problem_solving", "initiative", "commercial", "technical", "organisation", "teamwork", "customer"]);
  });

  it.each(SEED_COMPETENCIES.map((c) => [c.key, c] as const))("%s has anchors 1, 3 and 5 in both languages, written as behaviours", (_key, c) => {
    for (const level of [1, 3, 5] as const) {
      expect(c.anchors[level].tr.trim().length, `${level} tr`).toBeGreaterThan(20);
      expect(c.anchors[level].en.trim().length, `${level} en`).toBeGreaterThan(20);
      expect(anchorHint(c.anchors[level].tr, "tr"), `${level} tr`).toBeNull();
      expect(anchorHint(c.anchors[level].en, "en"), `${level} en`).toBeNull();
    }
  });

  it("keeps at most six tags on each side, every tag in both languages", () => {
    for (const c of SEED_COMPETENCIES) {
      expect(c.positive.length).toBeLessThanOrEqual(MAX_TAGS_PER_SIDE);
      expect(c.negative.length).toBeLessThanOrEqual(MAX_TAGS_PER_SIDE);
      for (const tag of [...c.positive, ...c.negative]) expect(tag.tr && tag.en).toBeTruthy();
    }
  });

  it("never uses an em dash", () => {
    expect(JSON.stringify({ DEFAULT_SCALE, SEED_COMPETENCIES })).not.toContain("\u2014");
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm exec vitest run src/db/library-seed-data.test.ts`
Expected: FAIL with `Cannot find module './library-seed-data'`.

- [ ] **Step 7: Write the starter content**

Create `src/db/library-seed-data.ts` (tags carried over from `610da60:src/db/seed.ts`, anchors new):

```ts
import type { I18nText } from "./schema/types";

/**
 * Kademe's starter library. A new organisation never meets an empty library
 * (old product decision, HIRING-UX 5.10); every row is labelled "Kademe
 * başlangıç içeriği, ekibiniz incelemedi" until the team reviews it.
 * Anchors describe what a reviewer can observe in an answer, never a trait.
 */
const i18n = (tr: string, en: string): I18nText => ({ tr, en });

export const DEFAULT_SCALE = {
  name: "Kademe 1-5",
  levels: [
    { value: 1, label: i18n("Belirgin eksik", "Clear gap") },
    { value: 2, label: i18n("Kısmen", "Partly there") },
    { value: 3, label: i18n("Beklenen düzeyde", "Meets the bar") },
    { value: 4, label: i18n("Güçlü", "Strong") },
    { value: 5, label: i18n("Örnek düzeyde", "Exceptional") },
  ],
} as const;

export type CompetencySeed = {
  key: string;
  name: I18nText;
  description: I18nText;
  anchors: Record<1 | 3 | 5, I18nText>;
  positive: I18nText[];
  negative: I18nText[];
};

export const SEED_COMPETENCIES: CompetencySeed[] = [
  {
    key: "communication",
    name: i18n("İletişim", "Communication"),
    description: i18n(
      "Karmaşık bir düşünceyi dinleyicisine göre, sırayla ve örnekle anlatabilme.",
      "Explaining a complex idea in order, with examples, calibrated to the listener.",
    ),
    anchors: {
      1: i18n(
        "Cevap soruyla bağlantısız ya da dağınık; dinleyen ana fikri çıkaramıyor ve örnek yok.",
        "The answer drifts from the question or is disordered; the listener cannot pick out the main point and there is no example.",
      ),
      3: i18n(
        "Ana fikri başta söylüyor, sırayla anlatıyor ve en az bir somut örnek veriyor.",
        "States the main point first, explains in order and gives at least one concrete example.",
      ),
      5: i18n(
        "Anlatımı dinleyicinin bilgisine göre ayarlıyor, olası soruyu önceden cevaplıyor ve kısa bir özetle bitiriyor.",
        "Adjusts the explanation to what the listener knows, answers the likely follow-up in advance and closes with a short summary.",
      ),
    },
    positive: [
      i18n("Net ve yapılandırılmış anlattı", "Clear and structured"),
      i18n("Dinleyiciye göre sadeleştirdi", "Adapted to the listener"),
      i18n("Örnekle somutlaştırdı", "Grounded it in an example"),
      i18n("Sorulanı doğru anladı", "Understood what was asked"),
    ],
    negative: [
      i18n("Soruyu dağıttı", "Drifted off the question"),
      i18n("Terimlerin arkasına saklandı", "Hid behind jargon"),
      i18n("Sorunun bir kısmını yanıtsız bıraktı", "Left part of the question unanswered"),
    ],
  },
  {
    key: "problem_solving",
    name: i18n("Problem Çözme", "Problem Solving"),
    description: i18n(
      "Sorunu doğru tanımlama, varsayımları görünür kılma ve seçenekleri gerekçeyle daraltma.",
      "Framing the real problem, surfacing assumptions, and narrowing options with stated reasoning.",
    ),
    anchors: {
      1: i18n(
        "Sorunu tanımlamadan tek bir çözüme atlıyor ve varsayımlarını söylemiyor.",
        "Jumps to a single fix without defining the problem and does not state any assumption.",
      ),
      3: i18n(
        "Sorunu kendi cümleleriyle tanımlıyor, en az iki seçenek sayıyor ve birini gerekçesiyle seçiyor.",
        "Defines the problem in their own words, lists at least two options and picks one with a reason.",
      ),
      5: i18n(
        "Belirtiyi nedenden ayırıyor, önce hangi bilgiyi toplayacağını söylüyor ve seçtiği çözümün nasıl sınanacağını anlatıyor.",
        "Separates symptom from cause, says which information they would gather first and explains how the chosen fix would be tested.",
      ),
    },
    positive: [
      i18n("Sorunu yeniden tanımladı", "Reframed the problem"),
      i18n("Varsayımlarını açıkça söyledi", "Stated assumptions out loud"),
      i18n("Birden fazla seçenek üretti", "Produced more than one option"),
      i18n("Kararının gerekçesini verdi", "Gave the reason behind the choice"),
    ],
    negative: [
      i18n("Tek çözüme erken kilitlendi", "Locked onto one solution too early"),
      i18n("Nedeni belirtiyle karıştırdı", "Confused cause with symptom"),
      i18n("Çözümü test edilebilir değil", "Solution is not testable"),
    ],
  },
  {
    key: "initiative",
    name: i18n("İnisiyatif", "Initiative"),
    description: i18n(
      "Belirsizlikte kendi kararıyla ilerleme ve sonucu sahiplenme.",
      "Moving forward under uncertainty on their own call, and owning the outcome.",
    ),
    anchors: {
      1: i18n(
        "Anlattığı örneklerde işi başkası başlatmış ya da bitirmiş; kendi adımını ayırt etmiyor.",
        "In the examples given someone else started or finished the work; does not separate out their own step.",
      ),
      3: i18n(
        "Kendi başlattığı bir işi anlatıyor ve belirsiz kalan bir noktada nasıl karar verdiğini söylüyor.",
        "Describes work they started themselves and says how they decided at a point that was unclear.",
      ),
      5: i18n(
        "Kimse istemeden bir riski fark edip harekete geçtiği bir örnek veriyor, sonucu ve kendi payını ölçüyle anlatıyor.",
        "Gives an example of spotting a risk and acting on it unasked, and describes the result and their own share with a measure.",
      ),
    },
    positive: [
      i18n("Riski kendi söyledi", "Named the risk unprompted"),
      i18n("Sormadan bir sonraki adımı önerdi", "Proposed the next step unprompted"),
      i18n("Sahiplendiği bir iş anlattı", "Described work they owned"),
      i18n("Belirsizliğe rağmen ilerledi", "Moved forward despite ambiguity"),
    ],
    negative: [
      i18n("Onay beklediğini ima etti", "Implied they were waiting for approval"),
      i18n("Sorumluluğu devretti", "Handed responsibility elsewhere"),
      i18n("Kendi katkısını ayırt edemedi", "Could not separate their own contribution"),
    ],
  },
  {
    key: "commercial",
    name: i18n("Satış Bakışı", "Commercial Sense"),
    description: i18n(
      "İşi müşterinin kazancına bağlama, itirazı karşılama ve değeri ölçülebilir anlatma.",
      "Tying the work to customer gain, handling objections, and expressing value in measurable terms.",
    ),
    anchors: {
      1: i18n(
        "Ürünün özelliklerini sayıyor ama müşterinin kazancına bağlamıyor; itirazı geçiştiriyor.",
        "Lists product features without tying them to the customer's gain and brushes the objection aside.",
      ),
      3: i18n(
        "Müşterinin bağlamını soruyor, faydayı onun işine bağlıyor ve itiraza doğrudan cevap veriyor.",
        "Asks about the customer's context, ties the benefit to their business and answers the objection directly.",
      ),
      5: i18n(
        "Değeri sayıyla anlatıyor (süre, maliyet, gelir), itirazı bir sonraki adıma çeviriyor ve o adımı netleştiriyor.",
        "Expresses value as a number (time, cost, revenue), turns the objection into a next step and makes that step explicit.",
      ),
    },
    positive: [
      i18n("Müşterinin işine bağladı", "Connected it to the customer's business"),
      i18n("İtirazı doğrudan karşıladı", "Met the objection head on"),
      i18n("Değeri sayıyla ifade etti", "Expressed value as a number"),
      i18n("Bir sonraki adımı netleştirdi", "Made the next step explicit"),
    ],
    negative: [
      i18n("Özellik anlattı, fayda anlatmadı", "Described features, not benefit"),
      i18n("Fiyatı ilk savunma aracı yaptı", "Reached for price as the first defence"),
      i18n("Müşterinin bağlamını sormadı", "Never asked about the customer's context"),
    ],
  },
  {
    key: "technical",
    name: i18n("Teknik Bilgi", "Technical Knowledge"),
    description: i18n(
      "Alanın kavramlarını yerinde kullanma, sınırlarını ve ödünleşimlerini bilme.",
      "Using the field's concepts correctly, and knowing their limits and trade-offs.",
    ),
    anchors: {
      1: i18n(
        "Kavramı yanlış yerde kullanıyor ya da yalnızca tanımını tekrarlıyor; uygulamadan örnek yok.",
        "Uses the concept in the wrong place or only repeats its definition; there is no example from practice.",
      ),
      3: i18n(
        "Doğru kavramı doğru yerde kullanıyor ve kendi işinden bir uygulama örneği veriyor.",
        "Uses the right concept in the right place and gives an example from their own work.",
      ),
      5: i18n(
        "Seçeneklerin ödünleşimini adıyla anlatıyor, bilmediği noktayı açıkça söylüyor ve nasıl öğreneceğini belirtiyor.",
        "Names the trade-offs between options, says plainly what they do not know and how they would find out.",
      ),
    },
    positive: [
      i18n("Doğru kavramı doğru yerde kullandı", "Used the right concept in the right place"),
      i18n("Ödünleşimi adıyla anlattı", "Named the trade-off"),
      i18n("Uygulamadan örnek verdi", "Gave an example from practice"),
      i18n("Bilmediği yeri bilmediğini söyledi", "Said plainly what they did not know"),
    ],
    negative: [
      i18n("Tanım doğru, uygulaması yok", "Definition right, application missing"),
      i18n("Kavramları birbirine karıştırdı", "Mixed up the concepts"),
      i18n("Ezber cevap verdi", "Gave a memorised answer"),
    ],
  },
  {
    key: "organisation",
    name: i18n("Organizasyon", "Organisation"),
    description: i18n(
      "İşi adımlara bölme, önceliği gerekçeyle seçme ve takibini kurma.",
      "Breaking work into steps, choosing priority with a reason, and setting up follow-up.",
    ),
    anchors: {
      1: i18n(
        "İşi adımlara bölmüyor; her şeyi aynı anda yapmayı öneriyor, süre ve sıra vermiyor.",
        "Does not break the work into steps; proposes doing everything at once and gives no order or timeline.",
      ),
      3: i18n(
        "İşi adımlara bölüyor, önceliği bir gerekçeyle seçiyor ve kabaca bir takvim veriyor.",
        "Breaks the work into steps, picks the priority with a reason and gives a rough timeline.",
      ),
      5: i18n(
        "Adımlar arasındaki bağımlılıkları söylüyor, gecikme olursa neyi keseceğini belirtiyor ve takibi nasıl yapacağını anlatıyor.",
        "States the dependencies between steps, says what they would cut if something slips and explains how they would follow up.",
      ),
    },
    positive: [
      i18n("İşi adımlara böldü", "Broke the work into steps"),
      i18n("Önceliği gerekçesiyle seçti", "Chose priority with a reason"),
      i18n("Süre ve kapsamı birlikte düşündü", "Considered time and scope together"),
      i18n("Takibi nasıl kuracağını söyledi", "Said how they would follow up"),
    ],
    negative: [
      i18n("Her şeyi aynı anda yapmayı önerdi", "Proposed doing everything at once"),
      i18n("Bağımlılıkları atladı", "Skipped the dependencies"),
      i18n("Planı takvimsiz kaldı", "Plan had no timeline"),
    ],
  },
  {
    key: "teamwork",
    name: i18n("Takım Çalışması", "Teamwork"),
    description: i18n(
      "Ortak sonucu birlikte üretme, anlaşmazlığı işi ilerletecek şekilde çözme.",
      "Producing a shared outcome together, and resolving disagreement in a way that moves work forward.",
    ),
    anchors: {
      1: i18n(
        "Başarıyı tek başına anlatıyor ya da sorunu ekibe yüklüyor; anlaşmazlığın nasıl çözüldüğünü söylemiyor.",
        "Tells the success as a solo story or puts the problem on the team, and does not say how a disagreement was resolved.",
      ),
      3: i18n(
        "Başkasının katkısını adıyla anıyor ve bir anlaşmazlığı konuşarak nasıl çözdüğünü anlatıyor.",
        "Credits someone else's contribution by name and describes how they talked a disagreement through.",
      ),
      5: i18n(
        "Anlaşmazlığı veriyle çözdüğü bir örnek veriyor, kendi fikrinden vazgeçtiği anı ve ortak kararı nasıl sahiplendiğini anlatıyor.",
        "Gives an example of settling a disagreement with evidence, the moment they gave up their own idea and how they owned the shared decision.",
      ),
    },
    positive: [
      i18n("Başkasının katkısını adıyla andı", "Credited someone else's contribution"),
      i18n("Anlaşmazlığı örnekle çözdü", "Resolved disagreement with evidence"),
      i18n("Yardım istediği yeri anlattı", "Described where they asked for help"),
      i18n("Ortak kararı sahiplendi", "Owned the shared decision"),
    ],
    negative: [
      i18n("Başarıyı tek başına anlattı", "Told the success as a solo story"),
      i18n("Çatışmadan kaçındığını söyledi", "Said they avoided the conflict"),
      i18n("Ekibi suçladı", "Blamed the team"),
    ],
  },
  {
    key: "customer",
    name: i18n("Müşteri Odağı", "Customer Focus"),
    description: i18n(
      "Müşterinin gerçek sorununu anlama, beklentiyi yönetme ve sözünü takip etme.",
      "Understanding the customer's real problem, managing expectations, and following through.",
    ),
    anchors: {
      1: i18n(
        "Müşterinin sorununu sormadan süreci anlatıyor ve şikâyeti kendine yönelik algılıyor.",
        "Explains the process without asking about the customer's problem and takes the complaint as aimed at them.",
      ),
      3: i18n(
        "Önce müşterinin sorununu kendi cümleleriyle doğruluyor, sonra ne yapacağını ve ne zaman döneceğini söylüyor.",
        "First confirms the customer's problem in their own words, then says what they will do and when they will get back.",
      ),
      5: i18n(
        "Beklentiyi baştan netleştiriyor, kötü haberi zamanında veriyor ve geri bildirimi somut bir değişikliğe çevirdiği bir örnek anlatıyor.",
        "Sets expectations up front, delivers bad news in time and describes an example of turning feedback into a concrete change.",
      ),
    },
    positive: [
      i18n("Önce müşterinin sorununu anladı", "Understood the customer's problem first"),
      i18n("Geri bildirimi karara dönüştürdü", "Turned feedback into a decision"),
      i18n("Beklentiyi baştan netleştirdi", "Set expectations up front"),
      i18n("Kötü haberi zamanında verdi", "Delivered bad news in time"),
    ],
    negative: [
      i18n("Süreci müşterinin önüne koydu", "Put process ahead of the customer"),
      i18n("Şikayeti kişisel algıladı", "Took the complaint personally"),
      i18n("Sözünü takip etmedi", "Did not follow through on a promise"),
    ],
  },
];
```

- [ ] **Step 8: Run it to verify it passes**

Run: `pnpm exec vitest run src/db/library-seed-data.test.ts`
Expected: PASS. If an anchor is flagged by `anchorHint`, rewrite that sentence as an observable behaviour; do not loosen the hint.

- [ ] **Step 9: Write the idempotent seeding**

Create `src/db/library-seed.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { competencies, competencyAnchors, observationTags, ratingScales, scaleLevels } from "@/db/schema";
import { DEFAULT_SCALE, SEED_COMPETENCIES } from "./library-seed-data";

/**
 * Writes the starter library for one organisation. Safe to run any number of
 * times: the default scale is created only when the organisation has none, and
 * a competency only when no row carries its seed key, so a renamed, edited or
 * archived starter competency is never touched again.
 */
export async function ensureDefaultScale(orgId: string): Promise<{ id: string; created: boolean }> {
  const find = async () =>
    (
      await db
        .select({ id: ratingScales.id })
        .from(ratingScales)
        .where(and(eq(ratingScales.orgId, orgId), eq(ratingScales.isDefault, true)))
        .limit(1)
    )[0];
  const existing = await find();
  if (existing) return { id: existing.id, created: false };
  const created = await db.transaction(async (tx) => {
    const [scale] = await tx
      .insert(ratingScales)
      .values({ orgId, name: DEFAULT_SCALE.name, minValue: 1, maxValue: 5, isDefault: true })
      .onConflictDoNothing()
      .returning({ id: ratingScales.id });
    if (!scale) return null;
    await tx.insert(scaleLevels).values(DEFAULT_SCALE.levels.map((l) => ({ scaleId: scale.id, value: l.value, label: { ...l.label } })));
    return scale.id;
  });
  if (created) return { id: created, created: true };
  // Another request created it between the two statements.
  const raced = await find();
  if (!raced) throw new Error(`organisation ${orgId} has no default rating scale`);
  return { id: raced.id, created: false };
}

export async function seedLibrary(orgId: string): Promise<{ scaleCreated: boolean; competenciesCreated: number }> {
  const scale = await ensureDefaultScale(orgId);
  let competenciesCreated = 0;
  for (const item of SEED_COMPETENCIES) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(competencies)
        .values({ orgId, name: item.name, description: item.description, scaleId: scale.id, seedKey: item.key })
        .onConflictDoNothing()
        .returning({ id: competencies.id });
      if (!row) return;
      competenciesCreated += 1;
      await tx.insert(competencyAnchors).values(
        ([1, 3, 5] as const).map((value) => ({ competencyId: row.id, value, body: item.anchors[value] })),
      );
      await tx.insert(observationTags).values([
        ...item.positive.map((label, i) => ({ competencyId: row.id, polarity: "POSITIVE" as const, label, orderIndex: i })),
        ...item.negative.map((label, i) => ({
          competencyId: row.id,
          polarity: "NEGATIVE" as const,
          label,
          orderIndex: item.positive.length + i,
        })),
      ]);
    });
  }
  return { scaleCreated: scale.created, competenciesCreated };
}
```

Create `scripts/seed-library.ts`:

```ts
/**
 * Writes the starter library (default scale, eight competencies with anchors
 * and tags) for every organisation in the database. Idempotent. Local only:
 * refuses anything but the Docker database on port 5434 and refuses the shared
 * `kademe` database, which other sessions use.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:seed-library
 */
import "dotenv/config";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5434") {
    console.error(`Refusing: not the local database on port 5434 (${url.hostname}:${url.port}).`);
    process.exit(2);
  }
  if (url.pathname === "/kademe") {
    console.error("Refusing: kademe is the shared database. Use kademe_platform.");
    process.exit(2);
  }
  const { db } = await import("@/db");
  const { organizations } = await import("@/db/schema");
  const { seedLibrary } = await import("@/db/library-seed");
  for (const org of await db.select({ id: organizations.id, name: organizations.name }).from(organizations)) {
    const result = await seedLibrary(org.id);
    console.log(`${org.name}: scale ${result.scaleCreated ? "created" : "kept"}, competencies created ${result.competenciesCreated}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add to `package.json` scripts: `"db:seed-library": "tsx scripts/seed-library.ts",`.

In `src/db/seed.ts` add `import { seedLibrary } from "./library-seed";` and, right after the line that inserts `consentTexts`, add:

```ts
  log("Writing the starter library...");
  await seedLibrary(org.id);
```

- [ ] **Step 10: Run the seeding twice on the working database**

```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:seed-library
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:seed-library
docker exec kademe-db psql -U kademe -d kademe_platform -Atc "select count(*) from competencies; select count(*) from competency_anchors; select count(*) from observation_tags; select count(*) from scale_levels"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe pnpm db:seed-library; echo "exit $?"
```
Expected: first run `scale created, competencies created 8`; second run `scale kept, competencies created 0`; counts `8`, `24`, `56`, `5` (one organisation); the last command prints `Refusing: kademe is the shared database...` and `exit 2`.

- [ ] **Step 11: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
git add src/lib/library/anchors.ts src/lib/library/anchors.test.ts src/db/library-seed-data.ts src/db/library-seed-data.test.ts src/db/library-seed.ts scripts/seed-library.ts package.json src/db/seed.ts
git commit -m "Seed the starter library idempotently" -m "Eight competencies from the old product with new behavioural anchors for levels 1, 3 and 5 in Turkish and English, their observation tags, and the five-level scale of HIRING-UX 3.3. seedLibrary() keys on seed_key, so running it again changes nothing. pnpm db:seed-library refuses every database but the local working one. Anchor rules (required levels, trait-word hint) are pure and shared." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Library read model, usage hook and capabilities

**Files:**
- Modify: `src/solutions/types.ts`
- Create: `src/lib/library/usage.ts`, `src/lib/library/usage.test.ts`
- Create: `src/server/library.ts`
- Modify: `src/lib/authorize.ts`, `src/lib/authorize.test.ts`

**Interfaces:**
- Consumes: `solutionModules()` from `@/solutions/registry.server`; `missingAnchorLevels` from Task 3.
- Produces in `@/solutions/types`:
  - `type LibraryRefs = { positionIds: string[]; competencyIds: string[] }`
  - `type LibraryUsageEntry = { total: number; live: number; items: Array<{ label: string; href: string }> }`
  - `type LibraryUsage = { positions: Record<string, LibraryUsageEntry>; competencies: Record<string, LibraryUsageEntry> }`
  - `SolutionManifest.positionAction?: { label: I18nLabel; href(positionId: string): string }`
  - `SolutionModule.library?: { usage(orgId: string, refs: LibraryRefs): Promise<LibraryUsage> }`
- Produces in `@/lib/library/usage`: `type UsageGroup = { solution: string; label: string; entry: LibraryUsageEntry }`, `groupUsage(results: SolutionUsage[], refs: LibraryRefs): { positions: Record<string, UsageGroup[]>; competencies: Record<string, UsageGroup[]> }`, `liveCount(groups: UsageGroup[]): number`.
- Produces in `@/server/library`: `loadDefaultScale(orgId): Promise<ScaleView | null>`, `listCompetencies(orgId): Promise<CompetencyRow[]>`, `loadCompetency(orgId, id): Promise<CompetencyDetail | null>`, `listPositions(orgId): Promise<PositionRow[]>`, `loadPosition(orgId, id): Promise<PositionDetail | null>`, `libraryUsage(orgId, refs, locale)`, `activeCompetencyOptions(orgId): Promise<Array<{ id: string; name: I18nText }>>`.
- Produces capabilities `"library:write"` (OWNER, MANAGER), `"library:scale"` (OWNER), `"opening:write"` (OWNER, MANAGER).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/library/usage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupUsage, liveCount } from "./usage";

const entry = (total: number, live: number) => ({ total, live, items: [{ label: `x${total}`, href: `/x/${total}` }] });

describe("library usage", () => {
  it("groups each library row's usage by solution and skips solutions that do not use it", () => {
    const grouped = groupUsage(
      [
        { solution: "hiring", label: "İşe alım", usage: { positions: { p1: entry(2, 1) }, competencies: { c1: entry(3, 2) } } },
        { solution: "other", label: "Başka", usage: { positions: {}, competencies: { c1: entry(0, 0), c2: entry(1, 0) } } },
      ],
      { positionIds: ["p1", "p2"], competencyIds: ["c1", "c2"] },
    );
    expect(grouped.positions.p1.map((g) => g.solution)).toEqual(["hiring"]);
    expect(grouped.positions.p2).toEqual([]);
    expect(grouped.competencies.c1.map((g) => g.label)).toEqual(["İşe alım"]);
    expect(grouped.competencies.c2.map((g) => g.solution)).toEqual(["other"]);
    expect(liveCount(grouped.competencies.c1)).toBe(2);
  });
});
```

Append to `src/lib/authorize.test.ts`:

```ts
describe("library and hiring capabilities", () => {
  it("lets owners and managers write the library and openings, and only owners rename scale levels", () => {
    for (const capability of ["library:write", "opening:write"] as const) {
      expect(can(user("OWNER"), capability)).toBe(true);
      expect(can(user("MANAGER"), capability)).toBe(true);
      expect(can(user("REVIEWER"), capability)).toBe(false);
    }
    expect(can(user("OWNER"), "library:scale")).toBe(true);
    expect(can(user("MANAGER"), "library:scale")).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/lib/library/usage.test.ts src/lib/authorize.test.ts`
Expected: FAIL (`Cannot find module './usage'`; TypeScript in vitest does not check the capability strings, so the authorize test fails on `false` for the new capabilities).

- [ ] **Step 3: Extend the contract**

In `src/solutions/types.ts` add after `export type CandidateStepState = { step: string };`:

```ts
/** Library rows a screen asks about (HIRING-UX 4.2 "Nerede kullanılıyor"). */
export type LibraryRefs = { positionIds: string[]; competencyIds: string[] };
export type LibraryUsageEntry = {
  /** Everything in this solution that uses the row (e.g. openings). */
  total: number;
  /** Of those, how many have a published assessment that copied the row. */
  live: number;
  items: Array<{ label: string; href: string }>;
};
export type LibraryUsage = {
  positions: Record<string, LibraryUsageEntry>;
  competencies: Record<string, LibraryUsageEntry>;
};
```

Inside `interface SolutionManifest`, after `candidateFlowLive: boolean;` add:

```ts
  /** An action this solution offers on a position page (the primary button there). */
  positionAction?: { label: I18nLabel; href(positionId: string): string };
```

Inside `interface SolutionModule`, after the `attempts` block add:

```ts
  /** Where this solution uses library rows. Optional: a solution that never reads the library omits it. */
  library?: {
    usage(orgId: string, refs: LibraryRefs): Promise<LibraryUsage>;
  };
```

- [ ] **Step 4: Implement usage grouping and the capabilities**

Create `src/lib/library/usage.ts`:

```ts
import type { LibraryRefs, LibraryUsage, LibraryUsageEntry } from "@/solutions/types";

export type SolutionUsage = { solution: string; label: string; usage: LibraryUsage };
export type UsageGroup = { solution: string; label: string; entry: LibraryUsageEntry };

/**
 * One list per library row, grouped by solution (HIRING-UX 4.2 rule 2). A
 * solution that does not use the row adds no group, so a new solution adds a
 * group without the library screen changing.
 */
export function groupUsage(results: SolutionUsage[], refs: LibraryRefs) {
  const pick = (kind: "positions" | "competencies", id: string): UsageGroup[] =>
    results.flatMap((r) => {
      const entry = r.usage[kind][id];
      return entry && entry.total > 0 ? [{ solution: r.solution, label: r.label, entry }] : [];
    });
  return {
    positions: Object.fromEntries(refs.positionIds.map((id) => [id, pick("positions", id)])) as Record<string, UsageGroup[]>,
    competencies: Object.fromEntries(refs.competencyIds.map((id) => [id, pick("competencies", id)])) as Record<string, UsageGroup[]>,
  };
}

/** Published assessments that keep the old definition after an edit (HIRING-UX 4.2 rule 1). */
export function liveCount(groups: UsageGroup[]): number {
  return groups.reduce((n, g) => n + g.entry.live, 0);
}
```

In `src/lib/authorize.ts` add `| "library:write" | "library:scale" | "opening:write"` to `Capability`; add `"library:write", "library:scale", "opening:write"` to `OWNER`, and `"library:write", "opening:write"` to `MANAGER`.

- [ ] **Step 5: Write the read model**

Create `src/server/library.ts`:

```ts
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  competencies,
  competencyAnchors,
  observationTags,
  positionCompetencies,
  positions,
  ratingScales,
  scaleLevels,
  type I18nText,
} from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { missingAnchorLevels } from "@/lib/library/anchors";
import { groupUsage, type SolutionUsage } from "@/lib/library/usage";
import { solutionModules } from "@/solutions/registry.server";
import type { LibraryRefs } from "@/solutions/types";

/** Read model for the organisation library (core: no solution table here). */

export type ScaleView = {
  id: string;
  name: string;
  minValue: number;
  maxValue: number;
  levels: Array<{ value: number; label: I18nText }>;
};

export async function loadDefaultScale(orgId: string): Promise<ScaleView | null> {
  const [scale] = await db
    .select()
    .from(ratingScales)
    .where(and(eq(ratingScales.orgId, orgId), eq(ratingScales.isDefault, true)))
    .limit(1);
  if (!scale) return null;
  const levels = await db
    .select({ value: scaleLevels.value, label: scaleLevels.label })
    .from(scaleLevels)
    .where(eq(scaleLevels.scaleId, scale.id))
    .orderBy(asc(scaleLevels.value));
  return { id: scale.id, name: scale.name, minValue: scale.minValue, maxValue: scale.maxValue, levels };
}

export type CompetencyRow = {
  id: string;
  name: I18nText;
  seededUnreviewed: boolean;
  archivedAt: Date | null;
  missingLevels: number[];
  positiveTags: number;
  negativeTags: number;
};

export async function listCompetencies(orgId: string): Promise<CompetencyRow[]> {
  const rows = await db.select().from(competencies).where(eq(competencies.orgId, orgId)).orderBy(asc(competencies.createdAt));
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];
  const [anchors, tags] = await Promise.all([
    db.select().from(competencyAnchors).where(inArray(competencyAnchors.competencyId, ids)),
    db
      .select({ competencyId: observationTags.competencyId, polarity: observationTags.polarity })
      .from(observationTags)
      .where(and(inArray(observationTags.competencyId, ids), isNull(observationTags.archivedAt))),
  ]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    seededUnreviewed: r.seedKey !== null && r.reviewedAt === null,
    archivedAt: r.archivedAt,
    missingLevels: missingAnchorLevels(
      Object.fromEntries(anchors.filter((a) => a.competencyId === r.id).map((a) => [a.value, a.body])),
    ),
    positiveTags: tags.filter((t) => t.competencyId === r.id && t.polarity === "POSITIVE").length,
    negativeTags: tags.filter((t) => t.competencyId === r.id && t.polarity === "NEGATIVE").length,
  }));
}

export type CompetencyDetail = {
  id: string;
  name: I18nText;
  description: I18nText;
  seededUnreviewed: boolean;
  archivedAt: Date | null;
  anchors: Partial<Record<number, I18nText>>;
  tags: Array<{ id: string; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText }>;
};

export async function loadCompetency(orgId: string, id: string): Promise<CompetencyDetail | null> {
  const [row] = await db
    .select()
    .from(competencies)
    .where(and(eq(competencies.id, id), eq(competencies.orgId, orgId)))
    .limit(1);
  if (!row) return null;
  const [anchors, tags] = await Promise.all([
    db.select().from(competencyAnchors).where(eq(competencyAnchors.competencyId, id)),
    db
      .select()
      .from(observationTags)
      .where(and(eq(observationTags.competencyId, id), isNull(observationTags.archivedAt)))
      .orderBy(asc(observationTags.orderIndex)),
  ]);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    seededUnreviewed: row.seedKey !== null && row.reviewedAt === null,
    archivedAt: row.archivedAt,
    anchors: Object.fromEntries(anchors.map((a) => [a.value, a.body])),
    tags: tags.map((t) => ({ id: t.id, polarity: t.polarity, label: t.label })),
  };
}

/** Competencies a new profile row or question may pick: not archived. */
export async function activeCompetencyOptions(orgId: string): Promise<Array<{ id: string; name: I18nText }>> {
  return db
    .select({ id: competencies.id, name: competencies.name })
    .from(competencies)
    .where(and(eq(competencies.orgId, orgId), isNull(competencies.archivedAt)))
    .orderBy(asc(competencies.createdAt));
}

export type PositionRow = { id: string; name: string; team: string | null; competencyCount: number; archivedAt: Date | null };

export async function listPositions(orgId: string): Promise<PositionRow[]> {
  return db
    .select({
      id: positions.id,
      name: positions.name,
      team: positions.team,
      archivedAt: positions.archivedAt,
      competencyCount: sql<number>`(select count(*)::int from ${positionCompetencies} pc where pc.position_id = ${positions.id})`,
    })
    .from(positions)
    .where(eq(positions.orgId, orgId))
    .orderBy(asc(positions.name));
}

export type PositionDetail = {
  id: string;
  name: string;
  team: string | null;
  shortDescription: string | null;
  jobDescription: string | null;
  skills: string[];
  languages: string[];
  archivedAt: Date | null;
  profile: Array<{ competencyId: string; name: I18nText; weight: number; expectedLevel: number | null; archived: boolean }>;
};

export async function loadPosition(orgId: string, id: string): Promise<PositionDetail | null> {
  const [row] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.id, id), eq(positions.orgId, orgId)))
    .limit(1);
  if (!row) return null;
  const profile = await db
    .select({
      competencyId: positionCompetencies.competencyId,
      weight: positionCompetencies.weight,
      expectedLevel: positionCompetencies.expectedLevel,
      name: competencies.name,
      archivedAt: competencies.archivedAt,
    })
    .from(positionCompetencies)
    .innerJoin(competencies, eq(competencies.id, positionCompetencies.competencyId))
    .where(eq(positionCompetencies.positionId, id))
    .orderBy(asc(positionCompetencies.orderIndex));
  return {
    id: row.id,
    name: row.name,
    team: row.team,
    shortDescription: row.shortDescription,
    jobDescription: row.jobDescription,
    skills: row.skills,
    languages: row.languages,
    archivedAt: row.archivedAt,
    profile: profile.map((p) => ({
      competencyId: p.competencyId,
      name: p.name,
      weight: p.weight,
      expectedLevel: p.expectedLevel,
      archived: p.archivedAt !== null,
    })),
  };
}

/** Asks every registered solution where these rows are used (contract hook, spec 3). */
export async function libraryUsage(orgId: string, refs: LibraryRefs, locale: Locale) {
  const results: SolutionUsage[] = await Promise.all(
    solutionModules()
      .filter((m) => m.library)
      .map(async (m) => ({ solution: m.key, label: m.label[locale], usage: await m.library!.usage(orgId, refs) })),
  );
  return groupUsage(results, refs);
}
```

- [ ] **Step 6: Run the tests to verify they pass, then the gates**

```bash
pnpm exec vitest run src/lib/library/usage.test.ts src/lib/authorize.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
Expected: PASS; verify:exam only `ok` lines (the contract changed; the exam module has no `library` hook and keeps working).

- [ ] **Step 7: Commit**

```bash
git add src/solutions/types.ts src/lib/library/usage.ts src/lib/library/usage.test.ts src/server/library.ts src/lib/authorize.ts src/lib/authorize.test.ts
git commit -m "Add the library read model and the usage hook" -m "The library is core and learns where a row is used through an optional library.usage() hook on the solution contract, grouped per solution. A manifest may offer a positionAction. New capabilities: library:write and opening:write for owners and managers, library:scale for owners." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Competency and scale screens

**Files:**
- Create: `src/db/executor.ts`
- Create: `src/lib/i18n-text.ts`, `src/lib/i18n-text.test.ts`
- Create: `src/server/library-write.ts`
- Create: `src/app/(manager)/library/layout.tsx`, `src/app/(manager)/library/actions.ts`
- Create: `src/app/(manager)/library/competencies/page.tsx`, `.../competencies/new/page.tsx`, `.../competencies/[id]/page.tsx`
- Create: `src/components/manager/page-title.tsx`, `src/components/manager/route-tabs.tsx`, `src/components/manager/i18n-pair.tsx`
- Create: `src/components/library/competency-form.tsx`, `src/components/library/new-competency-form.tsx`, `src/components/library/scale-form.tsx`, `src/components/library/usage-block.tsx`
- Create: `src/i18n/messages/library.tr.json`, `src/i18n/messages/library.en.json`
- Modify: `src/i18n/manager.ts`, `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes: Task 3 (`seedLibrary`, `ensureDefaultScale`, anchor rules), Task 4 (read model, `libraryUsage`, `liveCount`, capabilities).
- Produces: `type Executor` in `@/db/executor` (the database or a transaction).
- Produces: `pickText(text: I18nText | null | undefined, locale: Locale): string` in `@/lib/i18n-text`.
- Produces in `@/server/library-write`: `cleanText`, `createCompetency(orgId, actorId, input: { name; description; anchors?: AnchorInput }, x?: Executor)`, `saveCompetency(orgId, actorId, id, input: CompetencyInput)`, `setCompetencyArchived(orgId, actorId, id, archived)`, `saveScaleLabels(orgId, actorId, levels)`, types `AnchorInput`, `TagInput`, `CompetencyInput`.
- Produces components: `PageTitle`, `RouteTabs`, `I18nPair`, `UsageBlock`, `CompetencyForm` (Task 7 adds the AI assist inside it).
- Produces dictionary namespaces `libCompetencies`, `libScales` (`library.*.json`).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/i18n-text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickText } from "./i18n-text";

describe("pickText", () => {
  it("prefers the viewer's language and falls back to the other one", () => {
    expect(pickText({ tr: "İletişim", en: "Communication" }, "en")).toBe("Communication");
    expect(pickText({ tr: "İletişim", en: " " }, "en")).toBe("İletişim");
    expect(pickText(null, "tr")).toBe("");
  });
});
```

In `src/i18n/messages.test.ts` add the imports

```ts
import libraryTr from "@/i18n/messages/library.tr.json";
import libraryEn from "@/i18n/messages/library.en.json";
```

add `["library", libraryTr, libraryEn],` to `PAIRS`, add `libraryTr` to the array in "manager namespaces do not collide across the three files" (rename the test to "manager namespaces do not collide across files"), and add:

```ts
  it("no message contains an em dash (HIRING-UX E5)", () => {
    for (const [name, tr, en] of PAIRS) {
      expect(JSON.stringify([tr, en]), name).not.toContain("\u2014");
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/lib/i18n-text.test.ts src/i18n/messages.test.ts`
Expected: FAIL (`Cannot find module './i18n-text'`, `Cannot find module '@/i18n/messages/library.tr.json'`).

- [ ] **Step 3: Add the small shared pieces**

Create `src/db/executor.ts`:

```ts
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

/**
 * The database or a transaction on it. Helpers that must run inside a caller's
 * transaction take one of these instead of importing `db`.
 */
export type Executor = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;
```

Create `src/lib/i18n-text.ts`:

```ts
import type { I18nText } from "@/db/schema/types";
import type { Locale } from "@/i18n/locale";

/** The text in the viewer's language, or the other language when that one is empty. */
export function pickText(text: I18nText | null | undefined, locale: Locale): string {
  if (!text) return "";
  const own = text[locale].trim();
  return own || text[locale === "tr" ? "en" : "tr"].trim();
}
```

Create `src/components/manager/page-title.tsx`:

```tsx
/** Page heading for the new screens (HIRING-UX 8.4: 26/32, 600, -0.01em). */
export function PageTitle({
  title,
  sub,
  action,
  eyebrow,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-[13px] text-muted">{eyebrow}</div> : null}
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {sub ? <p className="mt-1 text-[14px] leading-[22px] text-muted">{sub}</p> : null}
      </div>
      {action ? <div className="flex flex-col items-end gap-1">{action}</div> : null}
    </div>
  );
}
```

Create `src/components/manager/route-tabs.tsx`:

```tsx
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Tabs that are routes (HIRING-UX 5.4 "route sekmeleri"). The active tab is one
 * of the three places accent may appear.
 */
export function RouteTabs({
  label,
  items,
  size = "md",
}: {
  label: string;
  items: Array<{ href: string; label: string; active: boolean }>;
  size?: "md" | "sm";
}) {
  return (
    <nav aria-label={label} className="flex gap-6 overflow-x-auto border-b border-line">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 transition-colors",
            size === "md" ? "py-3 text-[14px]" : "py-2 text-[13px]",
            item.active ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

Create `src/components/manager/i18n-pair.tsx`:

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { I18nText } from "@/db/schema/types";

/** One text in Turkish and English side by side: Turkish first (RULES copy rule). */
export function I18nPair({
  label,
  value,
  onChange,
  multiline = false,
  hint,
  disabled = false,
}: {
  label: string;
  value: I18nText;
  onChange: (next: I18nText) => void;
  multiline?: boolean;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] text-ink">{label}</Label>
      <div className="grid gap-2 md:grid-cols-2">
        {(["tr", "en"] as const).map((lang) =>
          multiline ? (
            <Textarea
              key={lang}
              aria-label={`${label} (${lang.toUpperCase()})`}
              placeholder={lang.toUpperCase()}
              value={value[lang]}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
            />
          ) : (
            <Input
              key={lang}
              aria-label={`${label} (${lang.toUpperCase()})`}
              placeholder={lang.toUpperCase()}
              value={value[lang]}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
            />
          ),
        )}
      </div>
      {hint}
    </div>
  );
}
```

Create `src/components/library/usage-block.tsx`:

```tsx
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { UsageGroup } from "@/lib/library/usage";

/** HIRING-UX 4.2 rule 2: "Nerede kullanılıyor", grouped by solution. */
export function UsageBlock({
  title,
  empty,
  groups,
  lineLabel,
}: {
  title: string;
  empty: string;
  groups: UsageGroup[];
  lineLabel: (group: UsageGroup) => string;
}) {
  return (
    <Card className="p-card">
      <h2 className="text-[16px] leading-6 font-semibold text-ink">{title}</h2>
      {groups.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map((g) => (
            <div key={g.solution}>
              <p className="tnum text-[13px] font-medium text-ink">{lineLabel(g)}</p>
              <ul className="mt-1 space-y-1">
                {g.entry.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-[13px] text-ink-2 underline decoration-underline underline-offset-2 hover:text-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Write the library writes**

Create `src/server/library-write.ts`:

```ts
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { ensureDefaultScale } from "@/db/library-seed";
import { auditLogs, competencies, competencyAnchors, observationTags, ratingScales, scaleLevels, type I18nText } from "@/db/schema";
import { hasText, MAX_TAGS_PER_SIDE, missingAnchorLevels } from "@/lib/library/anchors";

/** Library writes. Every write is scoped by organisation and leaves an audit row. */

export const cleanText = (t: I18nText): I18nText => ({ tr: t.tr.trim(), en: t.en.trim() });

export async function audit(
  x: Executor,
  orgId: string,
  actorId: string,
  action: string,
  subjectType: string,
  subjectId: string,
  meta?: Record<string, unknown>,
) {
  await x.insert(auditLogs).values({ orgId, actorId, action, subjectType, subjectId, meta: meta ?? null });
}

export type AnchorInput = Partial<Record<"1" | "2" | "3" | "4" | "5", I18nText>>;
export type TagInput = { id: string | null; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText };
export type CompetencyInput = {
  name: I18nText;
  description: I18nText;
  anchors: AnchorInput;
  tags: TagInput[];
  markReviewed: boolean;
};
export type CompetencyWriteError = "NAME_REQUIRED" | "ANCHORS_REQUIRED" | "TOO_MANY_TAGS" | "NOT_FOUND";

export function anchorRecord(input: AnchorInput): Record<number, I18nText> {
  const out: Record<number, I18nText> = {};
  for (const [level, body] of Object.entries(input)) if (body && hasText(body)) out[Number(level)] = cleanText(body);
  return out;
}

async function replaceAnchors(x: Executor, competencyId: string, anchors: Record<number, I18nText>) {
  // Anchors are copied into a version at publish, nothing refers to their ids.
  await x.delete(competencyAnchors).where(eq(competencyAnchors.competencyId, competencyId));
  const rows = Object.entries(anchors).map(([value, body]) => ({ competencyId, value: Number(value), body }));
  if (rows.length) await x.insert(competencyAnchors).values(rows);
}

export async function createCompetency(
  orgId: string,
  actorId: string,
  input: { name: I18nText; description: I18nText; anchors?: AnchorInput },
  x: Executor = db,
): Promise<{ ok: true; id: string } | { ok: false; code: "NAME_REQUIRED" }> {
  if (!hasText(input.name)) return { ok: false, code: "NAME_REQUIRED" };
  const scale = await ensureDefaultScale(orgId);
  const [row] = await x
    .insert(competencies)
    .values({ orgId, name: cleanText(input.name), description: cleanText(input.description), scaleId: scale.id, reviewedAt: new Date() })
    .returning({ id: competencies.id });
  await replaceAnchors(x, row.id, anchorRecord(input.anchors ?? {}));
  await audit(x, orgId, actorId, "library.competency.create", "competency", row.id);
  return { ok: true, id: row.id };
}

export async function saveCompetency(
  orgId: string,
  actorId: string,
  id: string,
  input: CompetencyInput,
): Promise<{ ok: true } | { ok: false; code: CompetencyWriteError }> {
  if (!hasText(input.name)) return { ok: false, code: "NAME_REQUIRED" };
  const anchors = anchorRecord(input.anchors);
  if (missingAnchorLevels(anchors).length) return { ok: false, code: "ANCHORS_REQUIRED" };
  const tags = input.tags.map((t) => ({ ...t, label: cleanText(t.label) })).filter((t) => hasText(t.label));
  for (const side of ["POSITIVE", "NEGATIVE"] as const) {
    if (tags.filter((t) => t.polarity === side).length > MAX_TAGS_PER_SIDE) return { ok: false, code: "TOO_MANY_TAGS" };
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: competencies.id, reviewedAt: competencies.reviewedAt })
      .from(competencies)
      .where(and(eq(competencies.id, id), eq(competencies.orgId, orgId)))
      .for("update");
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };
    const now = new Date();
    await tx
      .update(competencies)
      .set({
        name: cleanText(input.name),
        description: cleanText(input.description),
        updatedAt: now,
        ...(input.markReviewed && !row.reviewedAt ? { reviewedAt: now } : {}),
      })
      .where(eq(competencies.id, id));
    await replaceAnchors(tx, id, anchors);
    // Tag ids are kept: a published scorecard copies them. A removed tag is archived.
    const existing = await tx
      .select({ id: observationTags.id })
      .from(observationTags)
      .where(and(eq(observationTags.competencyId, id), isNull(observationTags.archivedAt)));
    const keep = new Set(tags.flatMap((t) => (t.id ? [t.id] : [])));
    const gone = existing.map((e) => e.id).filter((tagId) => !keep.has(tagId));
    if (gone.length) await tx.update(observationTags).set({ archivedAt: now }).where(inArray(observationTags.id, gone));
    for (const [orderIndex, tag] of tags.entries()) {
      if (tag.id) {
        await tx
          .update(observationTags)
          .set({ label: tag.label, polarity: tag.polarity, orderIndex, archivedAt: null })
          .where(and(eq(observationTags.id, tag.id), eq(observationTags.competencyId, id)));
      } else {
        await tx.insert(observationTags).values({ competencyId: id, polarity: tag.polarity, label: tag.label, orderIndex });
      }
    }
    await audit(tx, orgId, actorId, "library.competency.save", "competency", id, { markReviewed: input.markReviewed });
    return { ok: true as const };
  });
}

export async function setCompetencyArchived(orgId: string, actorId: string, id: string, archived: boolean): Promise<boolean> {
  const rows = await db
    .update(competencies)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(competencies.id, id), eq(competencies.orgId, orgId)))
    .returning({ id: competencies.id });
  if (rows.length) await audit(db, orgId, actorId, archived ? "library.competency.archive" : "library.competency.restore", "competency", id);
  return rows.length > 0;
}

export async function saveScaleLabels(
  orgId: string,
  actorId: string,
  levels: Array<{ value: number; label: I18nText }>,
): Promise<{ ok: boolean }> {
  if (levels.some((l) => !hasText(l.label))) return { ok: false };
  const [scale] = await db
    .select({ id: ratingScales.id })
    .from(ratingScales)
    .where(and(eq(ratingScales.orgId, orgId), eq(ratingScales.isDefault, true)))
    .limit(1);
  if (!scale) return { ok: false };
  await db.transaction(async (tx) => {
    for (const level of levels) {
      await tx
        .update(scaleLevels)
        .set({ label: cleanText(level.label) })
        .where(and(eq(scaleLevels.scaleId, scale.id), eq(scaleLevels.value, level.value)));
    }
    await audit(tx, orgId, actorId, "library.scale.save", "rating_scale", scale.id);
  });
  return { ok: true };
}
```

- [ ] **Step 5: Write the server actions**

Create `src/app/(manager)/library/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { seedLibrary } from "@/db/library-seed";
import {
  createCompetency,
  saveCompetency,
  saveScaleLabels,
  setCompetencyArchived,
  type CompetencyInput,
  type CompetencyWriteError,
} from "@/server/library-write";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";

const i18n = z.object({ tr: z.string().max(2000), en: z.string().max(2000) });
const level = z.enum(["1", "2", "3", "4", "5"]);

const competencySchema = z.object({
  name: i18n,
  description: i18n,
  anchors: z.partialRecord(level, i18n),
  tags: z.array(z.object({ id: z.uuid().nullable(), polarity: z.enum(["POSITIVE", "NEGATIVE"]), label: i18n })).max(24),
  markReviewed: z.boolean(),
});

export type LibraryActionResult = { ok: true } | { ok: false; code: CompetencyWriteError | "INVALID" };

/** The "Başlangıç içeriğini ekle" button: same idempotent seeding as the script. */
export async function startLibraryAction() {
  const user = await requireUser("library:write");
  await seedLibrary(user.orgId);
  revalidatePath("/library/competencies");
}

export async function createCompetencyAction(input: { name: { tr: string; en: string }; description: { tr: string; en: string } }) {
  const user = await requireUser("library:write");
  const parsed = z.object({ name: i18n, description: i18n }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "INVALID" as const };
  const result = await createCompetency(user.orgId, user.id, parsed.data);
  if (!result.ok) return result;
  redirect(`/library/competencies/${result.id}`);
}

export async function saveCompetencyAction(id: string, input: CompetencyInput): Promise<LibraryActionResult> {
  const user = await requireUser("library:write");
  const parsed = competencySchema.safeParse(input);
  if (!isUuid(id) || !parsed.success) return { ok: false, code: "INVALID" };
  const result = await saveCompetency(user.orgId, user.id, id, parsed.data);
  if (result.ok) revalidatePath(`/library/competencies/${id}`);
  return result;
}

export async function archiveCompetencyAction(formData: FormData) {
  const user = await requireUser("library:write");
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return;
  await setCompetencyArchived(user.orgId, user.id, id, true);
  redirect(`/library/competencies/${id}?archived=1`);
}

export async function restoreCompetencyAction(formData: FormData) {
  const user = await requireUser("library:write");
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return;
  await setCompetencyArchived(user.orgId, user.id, id, false);
  redirect(`/library/competencies/${id}`);
}

export async function saveScaleAction(levels: Array<{ value: number; label: { tr: string; en: string } }>) {
  const user = await requireUser("library:scale");
  const parsed = z.array(z.object({ value: z.number().int().min(1).max(5), label: i18n })).max(5).safeParse(levels);
  if (!parsed.success) return { ok: false };
  const result = await saveScaleLabels(user.orgId, user.id, parsed.data);
  if (result.ok) revalidatePath("/library/competencies");
  return result;
}
```

(`z.partialRecord` and `z.uuid()` are zod 4 APIs; the repo is on zod `^4.5.4`.)

- [ ] **Step 6: Write the dictionaries**

Create `src/i18n/messages/library.tr.json`:

```json
{
  "libCompetencies": {
    "title": "Yetkinlikler",
    "sub": "Kurumun yetkinlik tanımları, çapaları ve gözlem etiketleri. İşe alım ve ileride diğer araçlar buradan okur.",
    "tabsLabel": "Kütüphane sekmeleri",
    "tabList": "Yetkinlikler",
    "tabScales": "Puan skalaları",
    "add": "Yetkinlik ekle",
    "emptyTitle": "Kütüphane henüz kurulmadı",
    "emptyBody": "Kademe'nin 8 başlangıç yetkinliğini çapaları ve gözlem etiketleriyle ekleyebilirsin. Sonra hepsini ekibinle düzenlersin.",
    "start": "Başlangıç içeriğini ekle",
    "colName": "Yetkinlik",
    "colAnchors": "Çapalar",
    "colTags": "Gözlem etiketleri",
    "colUsage": "Nerede kullanılıyor",
    "anchorsDone": "Çapalar tamam",
    "anchorsMissing": "Seviye {level} tanımı eksik",
    "tagCount": "{positive} olumlu · {negative} olumsuz",
    "seeded": "Kademe başlangıç içeriği, ekibiniz incelemedi",
    "archivedTitle": "Arşivdekiler ({count})",
    "back": "Yetkinliklere dön",
    "archivedNote": "Arşivde. Yeni sorularda seçilemez, eski değerlendirmeler okunur kalır.",
    "name": "Ad",
    "description": "Tanım",
    "descriptionHint": "Ekip için. Adaya hiç gösterilmez.",
    "anchorsTitle": "Çapalar",
    "anchorsSub": "Her seviyede gözlenebilir bir davranış yaz. 1, 3 ve 5 zorunlu; 2 ve 4 isteğe bağlı.",
    "optional": "isteğe bağlı",
    "hintAdjective": "Bu tanım bir davranış değil, bir sıfat. Gözlenebilir bir davranış yaz: \"karşı tarafın sorusunu kendi cümleleriyle özetler\".",
    "hintShort": "Bu tanım çok kısa. Değerlendiricinin cevapta neyi göreceğini bir cümleyle yaz.",
    "tagsTitle": "Gözlem etiketleri",
    "tagsSub": "Değerlendiricinin tek tıkla işaretlediği kanıtlar. Her yönde en fazla 6.",
    "tagsPositive": "Olumlu",
    "tagsNegative": "Olumsuz",
    "tag": "Etiket",
    "addTag": "Etiket ekle",
    "removeTag": "Kaldır",
    "tagLimit": "Bu yönde en fazla {max} etiket olabilir.",
    "liveNote": "Bu değişiklik yeni sürümlere uygulanır. Yayındaki {count} değerlendirme eski tanımı kullanmaya devam eder.",
    "markReviewed": "Ekibimiz bu tanımı inceledi",
    "save": "Kaydet",
    "saving": "Kaydediliyor",
    "saved": "Kaydedildi.",
    "saveFailed": "Kaydedilemedi. Tekrar dene.",
    "nameRequired": "Yetkinliğe bir ad ver.",
    "anchorRequired": "Seviye {level} tanımını yaz.",
    "noPermission": "Rolün kütüphaneyi değiştiremez.",
    "archive": "Arşivle",
    "archiveHint": "Arşivlenen yetkinlik yeni sorularda seçilemez; onu kullanan değerlendirmeler değişmez.",
    "restore": "Arşivden çıkar",
    "archivedUndo": "Yetkinlik arşivlendi.",
    "usageTitle": "Nerede kullanılıyor",
    "usageEmpty": "Henüz hiçbir yerde kullanılmıyor.",
    "usageLine": "{solution} · {count}",
    "newTitle": "Yeni yetkinlik",
    "newSub": "Önce ad ve tanım. Çapaları ve etiketleri bir sonraki ekranda yazarsın.",
    "create": "Oluştur",
    "creating": "Oluşturuluyor"
  },
  "libScales": {
    "sub": "Genel seviye adları. Her yetkinliğin çapaları bu iskeleti doldurur.",
    "level": "Seviye",
    "noEvidence": "Kanıt yok: ortalamaya girmez, 1 ile aynı değildir.",
    "save": "Kaydet",
    "saving": "Kaydediliyor",
    "saved": "Kaydedildi.",
    "saveFailed": "Kaydedilemedi. Tekrar dene.",
    "readOnly": "Seviye adlarını yalnızca sahip değiştirebilir.",
    "labelRequired": "Her seviyeye bir ad ver."
  }
}
```

Create `src/i18n/messages/library.en.json`:

```json
{
  "libCompetencies": {
    "title": "Competencies",
    "sub": "Your organisation's competency definitions, anchors and observation tags. Hiring, and later other tools, read them from here.",
    "tabsLabel": "Library tabs",
    "tabList": "Competencies",
    "tabScales": "Rating scales",
    "add": "Add a competency",
    "emptyTitle": "The library is not set up yet",
    "emptyBody": "Add Kademe's 8 starter competencies with their anchors and observation tags. You then edit all of them with your team.",
    "start": "Add the starter content",
    "colName": "Competency",
    "colAnchors": "Anchors",
    "colTags": "Observation tags",
    "colUsage": "Where it is used",
    "anchorsDone": "Anchors complete",
    "anchorsMissing": "Level {level} definition missing",
    "tagCount": "{positive} positive · {negative} negative",
    "seeded": "Kademe starter content, not reviewed by your team",
    "archivedTitle": "Archived ({count})",
    "back": "Back to competencies",
    "archivedNote": "Archived. It cannot be picked for new questions; past assessments stay readable.",
    "name": "Name",
    "description": "Definition",
    "descriptionHint": "For the team. Never shown to a candidate.",
    "anchorsTitle": "Anchors",
    "anchorsSub": "Write an observable behaviour for each level. 1, 3 and 5 are required; 2 and 4 are optional.",
    "optional": "optional",
    "hintAdjective": "This reads as a trait, not a behaviour. Write something a reviewer can observe: \"summarises the other person's question in their own words\".",
    "hintShort": "This definition is very short. Say in one sentence what the reviewer will see in the answer.",
    "tagsTitle": "Observation tags",
    "tagsSub": "Evidence a reviewer marks with one click. At most 6 on each side.",
    "tagsPositive": "Positive",
    "tagsNegative": "Negative",
    "tag": "Tag",
    "addTag": "Add a tag",
    "removeTag": "Remove",
    "tagLimit": "At most {max} tags on this side.",
    "liveNote": "This change applies to new versions. {count, plural, one {# live assessment keeps} other {# live assessments keep}} the previous definition.",
    "markReviewed": "Our team reviewed this definition",
    "save": "Save",
    "saving": "Saving",
    "saved": "Saved.",
    "saveFailed": "Could not save. Try again.",
    "nameRequired": "Give the competency a name.",
    "anchorRequired": "Write the level {level} definition.",
    "noPermission": "Your role cannot change the library.",
    "archive": "Archive",
    "archiveHint": "An archived competency cannot be picked for new questions; assessments that use it do not change.",
    "restore": "Restore",
    "archivedUndo": "Competency archived.",
    "usageTitle": "Where it is used",
    "usageEmpty": "Not used anywhere yet.",
    "usageLine": "{solution} · {count}",
    "newTitle": "New competency",
    "newSub": "Name and definition first. You write anchors and tags on the next screen.",
    "create": "Create",
    "creating": "Creating"
  },
  "libScales": {
    "sub": "General level names. Each competency's anchors fill in this frame.",
    "level": "Level",
    "noEvidence": "No evidence: left out of the average, not the same as 1.",
    "save": "Save",
    "saving": "Saving",
    "saved": "Saved.",
    "saveFailed": "Could not save. Try again.",
    "readOnly": "Only an owner can rename the levels.",
    "labelRequired": "Give every level a name."
  }
}
```

In `src/i18n/manager.ts` import the two files (`libraryTr`, `libraryEn`), add `& typeof libraryTr` to `ManagerMessages`, spread `...libraryTr` into `tr` and `...libraryEn` into `en`, and add `library.*.json   organisation library (positions, competencies, scales).` to the comment listing the files.

- [ ] **Step 7: Write the competency components**

Create `src/components/library/competency-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { I18nPair } from "@/components/manager/i18n-pair";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { ANCHOR_LEVELS, anchorHint, hasText, MAX_TAGS_PER_SIDE, REQUIRED_ANCHOR_LEVELS } from "@/lib/library/anchors";
import { saveCompetencyAction } from "@/app/(manager)/library/actions";

export type FormTag = { key: string; id: string | null; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText };
export type CompetencyFormValue = {
  name: I18nText;
  description: I18nText;
  anchors: Record<number, I18nText>;
  tags: FormTag[];
};

const empty = (): I18nText => ({ tr: "", en: "" });

/**
 * HIRING-UX 5.10. Saving is explicit ("Kaydet", no autosave): the library is an
 * organisation asset, so a change should be deliberate. Levels 1, 3 and 5 are
 * required; the trait-word hint is advice and never blocks.
 */
export function CompetencyForm({
  id,
  initial,
  levels,
  canWrite,
  seededUnreviewed,
  liveCount,
  locale,
}: {
  id: string;
  initial: CompetencyFormValue;
  levels: Array<{ value: number; label: I18nText }>;
  canWrite: boolean;
  seededUnreviewed: boolean;
  liveCount: number;
  locale: Locale;
}) {
  const t = useMT("libCompetencies");
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [markReviewed, setMarkReviewed] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"saved" | "error" | null>(null);

  const missing = REQUIRED_ANCHOR_LEVELS.filter((level) => !hasText(value.anchors[level]));
  const reason = !canWrite
    ? t("noPermission")
    : !hasText(value.name)
      ? t("nameRequired")
      : missing.length
        ? t("anchorRequired", { level: missing[0] })
        : null;
  const levelName = (v: number) => {
    const label = levels.find((l) => l.value === v)?.label;
    return label ? label[locale] || label.tr : String(v);
  };
  const side = (polarity: FormTag["polarity"]) => value.tags.filter((tag) => tag.polarity === polarity);
  const setTag = (key: string, label: I18nText) =>
    setValue((v) => ({ ...v, tags: v.tags.map((tag) => (tag.key === key ? { ...tag, label } : tag)) }));
  const removeTag = (key: string) => setValue((v) => ({ ...v, tags: v.tags.filter((tag) => tag.key !== key) }));
  const addTag = (polarity: FormTag["polarity"]) =>
    setValue((v) => ({ ...v, tags: [...v.tags, { key: crypto.randomUUID(), id: null, polarity, label: empty() }] }));

  function save() {
    setResult(null);
    start(async () => {
      const res = await saveCompetencyAction(id, {
        name: value.name,
        description: value.description,
        anchors: Object.fromEntries(ANCHOR_LEVELS.map((l) => [String(l), value.anchors[l] ?? empty()])),
        tags: value.tags.map(({ id: tagId, polarity, label }) => ({ id: tagId, polarity, label })),
        markReviewed,
      });
      setResult(res.ok ? "saved" : "error");
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-section">
      <Card className="space-y-field p-card">
        <I18nPair label={t("name")} value={value.name} disabled={!canWrite} onChange={(name) => setValue((v) => ({ ...v, name }))} />
        <I18nPair
          label={t("description")}
          multiline
          disabled={!canWrite}
          hint={<p className="text-[13px] text-muted">{t("descriptionHint")}</p>}
          value={value.description}
          onChange={(description) => setValue((v) => ({ ...v, description }))}
        />
      </Card>

      <Card className="space-y-field p-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("anchorsTitle")}</h2>
            <p className="text-[13px] text-muted">{t("anchorsSub")}</p>
          </div>
          {/* Task 7: the AI anchor assist goes here. */}
        </div>
        {ANCHOR_LEVELS.map((level) => {
          const body = value.anchors[level] ?? empty();
          const hint = (body.tr.trim() ? anchorHint(body.tr, "tr") : null) ?? (body.en.trim() ? anchorHint(body.en, "en") : null);
          const required = (REQUIRED_ANCHOR_LEVELS as readonly number[]).includes(level);
          return (
            <I18nPair
              key={level}
              multiline
              disabled={!canWrite}
              label={`${level} · ${levelName(level)}${required ? "" : ` (${t("optional")})`}`}
              value={body}
              onChange={(next) => setValue((v) => ({ ...v, anchors: { ...v.anchors, [level]: next } }))}
              hint={hint ? <p className="text-[13px] text-muted">{t(hint === "ADJECTIVE" ? "hintAdjective" : "hintShort")}</p> : null}
            />
          );
        })}
      </Card>

      <Card className="p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("tagsTitle")}</h2>
        <p className="text-[13px] text-muted">{t("tagsSub")}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {(["POSITIVE", "NEGATIVE"] as const).map((polarity) => (
            <div key={polarity} className="space-y-3">
              <h3 className="text-[14px] font-semibold text-ink">{t(polarity === "POSITIVE" ? "tagsPositive" : "tagsNegative")}</h3>
              {side(polarity).map((tag) => (
                <div key={tag.key} className="flex items-start gap-2">
                  <Input aria-label={`${t("tag")} TR`} placeholder="TR" disabled={!canWrite} value={tag.label.tr} onChange={(e) => setTag(tag.key, { ...tag.label, tr: e.target.value })} />
                  <Input aria-label={`${t("tag")} EN`} placeholder="EN" disabled={!canWrite} value={tag.label.en} onChange={(e) => setTag(tag.key, { ...tag.label, en: e.target.value })} />
                  {canWrite ? (
                    <Button variant="ghost" size="sm" onClick={() => removeTag(tag.key)}>
                      {t("removeTag")}
                    </Button>
                  ) : null}
                </div>
              ))}
              {!canWrite ? null : side(polarity).length >= MAX_TAGS_PER_SIDE ? (
                <DisabledReason>{t("tagLimit", { max: MAX_TAGS_PER_SIDE })}</DisabledReason>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => addTag(polarity)}>
                  {t("addTag")}
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {liveCount > 0 ? <p className="text-[13px] text-muted">{t("liveNote", { count: liveCount })}</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        {seededUnreviewed && canWrite ? (
          <label className="flex items-center gap-2 text-[14px] text-ink">
            <Checkbox checked={markReviewed} onCheckedChange={(c) => setMarkReviewed(c === true)} />
            {t("markReviewed")}
          </label>
        ) : null}
        <Button variant="primary" onClick={save} disabled={pending || reason !== null} disabledReason={reason ?? undefined}>
          {pending ? t("saving") : t("save")}
        </Button>
        {reason ? <DisabledReason>{reason}</DisabledReason> : null}
        {result === "saved" ? <span role="status" className="text-[13px] text-muted">{t("saved")}</span> : null}
        {result === "error" ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
      </div>
    </div>
  );
}
```

Create `src/components/library/new-competency-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { I18nPair } from "@/components/manager/i18n-pair";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { hasText } from "@/lib/library/anchors";
import { createCompetencyAction } from "@/app/(manager)/library/actions";

export function NewCompetencyForm() {
  const t = useMT("libCompetencies");
  const [name, setName] = useState<I18nText>({ tr: "", en: "" });
  const [description, setDescription] = useState<I18nText>({ tr: "", en: "" });
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const reason = hasText(name) ? null : t("nameRequired");
  return (
    <Card className="space-y-field p-card">
      <I18nPair label={t("name")} value={name} onChange={setName} />
      <I18nPair label={t("description")} multiline value={description} onChange={setDescription} />
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="primary"
          disabled={pending || reason !== null}
          disabledReason={reason ?? undefined}
          onClick={() =>
            start(async () => {
              const result = await createCompetencyAction({ name, description });
              if (result && !result.ok) setFailed(true);
            })
          }
        >
          {pending ? t("creating") : t("create")}
        </Button>
        {reason ? <DisabledReason>{reason}</DisabledReason> : null}
        {failed ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
      </div>
    </Card>
  );
}
```

Create `src/components/library/scale-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { I18nPair } from "@/components/manager/i18n-pair";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { hasText } from "@/lib/library/anchors";
import { saveScaleAction } from "@/app/(manager)/library/actions";

/** HIRING-UX 5.10 scales tab: level names, editable by owners only. */
export function ScaleForm({ levels, canEdit }: { levels: Array<{ value: number; label: I18nText }>; canEdit: boolean }) {
  const t = useMT("libScales");
  const [rows, setRows] = useState(levels);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"saved" | "error" | null>(null);
  const reason = !canEdit ? t("readOnly") : rows.some((r) => !hasText(r.label)) ? t("labelRequired") : null;
  return (
    <Card className="space-y-field p-card">
      <p className="text-[13px] text-muted">{t("sub")}</p>
      {rows.map((row) => (
        <I18nPair
          key={row.value}
          label={`${t("level")} ${row.value}`}
          value={row.label}
          disabled={!canEdit}
          onChange={(label) => setRows((rs) => rs.map((r) => (r.value === row.value ? { ...r, label } : r)))}
        />
      ))}
      <p className="text-[13px] text-muted">{t("noEvidence")}</p>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="primary"
          disabled={pending || reason !== null}
          disabledReason={reason ?? undefined}
          onClick={() =>
            start(async () => {
              const res = await saveScaleAction(rows);
              setResult(res.ok ? "saved" : "error");
            })
          }
        >
          {pending ? t("saving") : t("save")}
        </Button>
        {reason ? <DisabledReason>{reason}</DisabledReason> : null}
        {result === "saved" ? <span role="status" className="text-[13px] text-muted">{t("saved")}</span> : null}
        {result === "error" ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
      </div>
    </Card>
  );
}
```

- [ ] **Step 8: Write the pages**

Create `src/app/(manager)/library/layout.tsx`:

```tsx
/** New screens use the 12px card of HIRING-UX 8.3, set once here (RULES.md shadcn section). */
export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ "--card-radius": "12px" } as React.CSSProperties}>{children}</div>;
}
```

Create `src/app/(manager)/library/competencies/page.tsx`:

```tsx
import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle } from "@/components/manager/page-title";
import { RouteTabs } from "@/components/manager/route-tabs";
import { ScaleForm } from "@/components/library/scale-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { pickText } from "@/lib/i18n-text";
import { libraryUsage, listCompetencies, loadDefaultScale, type CompetencyRow } from "@/server/library";
import { requireUser } from "@/server/session";
import { startLibraryAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CompetenciesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const tab = sp.tab === "scales" ? "scales" : "list";
  const canWrite = can(user, "library:write");
  const scale = await loadDefaultScale(user.orgId);

  if (!scale) {
    return (
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <PageTitle title={t("libCompetencies.title")} sub={t("libCompetencies.sub")} />
        <Empty className="mt-section border border-line">
          <EmptyHeader>
            <EmptyTitle>{t("libCompetencies.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("libCompetencies.emptyBody")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <form action={startLibraryAction}>
              <Button type="submit" variant="primary" disabled={!canWrite} disabledReason={canWrite ? undefined : t("libCompetencies.noPermission")}>
                {t("libCompetencies.start")}
              </Button>
            </form>
            {!canWrite ? <DisabledReason>{t("libCompetencies.noPermission")}</DisabledReason> : null}
          </EmptyContent>
        </Empty>
      </main>
    );
  }

  const tabs = (
    <RouteTabs
      label={t("libCompetencies.tabsLabel")}
      items={[
        { href: "/library/competencies", label: t("libCompetencies.tabList"), active: tab === "list" },
        { href: "/library/competencies?tab=scales", label: t("libCompetencies.tabScales"), active: tab === "scales" },
      ]}
    />
  );

  if (tab === "scales") {
    return (
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <PageTitle title={t("libCompetencies.title")} sub={t("libCompetencies.sub")} />
        <div className="mt-6">{tabs}</div>
        <div className="mt-section max-w-[880px]">
          <ScaleForm levels={scale.levels} canEdit={can(user, "library:scale")} />
        </div>
      </main>
    );
  }

  const rows = await listCompetencies(user.orgId);
  const usage = await libraryUsage(user.orgId, { positionIds: [], competencyIds: rows.map((r) => r.id) }, locale);
  const active = rows.filter((r) => !r.archivedAt);
  const archived = rows.filter((r) => r.archivedAt);

  const table = (list: CompetencyRow[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("libCompetencies.colName")}</TableHead>
          <TableHead>{t("libCompetencies.colAnchors")}</TableHead>
          <TableHead>{t("libCompetencies.colTags")}</TableHead>
          <TableHead>{t("libCompetencies.colUsage")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((row) => {
          const groups = usage.competencies[row.id] ?? [];
          return (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/library/competencies/${row.id}`} className="font-medium text-ink hover:underline">
                  {pickText(row.name, locale)}
                </Link>
                {row.seededUnreviewed ? <p className="text-[12px] text-muted">{t("libCompetencies.seeded")}</p> : null}
              </TableCell>
              <TableCell>
                {row.missingLevels.length ? (
                  <StatusDot tone="warn">{t("libCompetencies.anchorsMissing", { level: row.missingLevels[0] })}</StatusDot>
                ) : (
                  <StatusDot tone="done">{t("libCompetencies.anchorsDone")}</StatusDot>
                )}
              </TableCell>
              <TableCell className="tnum text-[13px] text-muted">
                {t("libCompetencies.tagCount", { positive: row.positiveTags, negative: row.negativeTags })}
              </TableCell>
              <TableCell className="tnum text-[13px] text-muted">
                {groups.length ? groups.map((g) => t("libCompetencies.usageLine", { solution: g.label, count: g.entry.total })).join(", ") : "-"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <PageTitle
        title={t("libCompetencies.title")}
        sub={t("libCompetencies.sub")}
        action={
          canWrite ? (
            <Button asChild variant="primary">
              <Link href="/library/competencies/new">{t("libCompetencies.add")}</Link>
            </Button>
          ) : (
            <>
              <Button variant="primary" disabled disabledReason={t("libCompetencies.noPermission")}>
                {t("libCompetencies.add")}
              </Button>
              <DisabledReason>{t("libCompetencies.noPermission")}</DisabledReason>
            </>
          )
        }
      />
      <div className="mt-6">{tabs}</div>
      <Card className="mt-section overflow-x-auto">{table(active)}</Card>
      {archived.length ? (
        <Collapsible className="mt-section">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {t("libCompetencies.archivedTitle", { count: archived.length })}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-3 overflow-x-auto">{table(archived)}</Card>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </main>
  );
}
```

Create `src/app/(manager)/library/competencies/new/page.tsx`:

```tsx
import Link from "next/link";
import { PageTitle } from "@/components/manager/page-title";
import { NewCompetencyForm } from "@/components/library/new-competency-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function NewCompetencyPage() {
  await requireUser("library:write");
  const t = managerT(await managerLocale());
  return (
    <main className="mx-auto max-w-[880px] px-page py-8">
      <Link href="/library/competencies" className="text-[13px] text-muted hover:text-ink">
        {t("libCompetencies.back")}
      </Link>
      <div className="mt-3">
        <PageTitle title={t("libCompetencies.newTitle")} sub={t("libCompetencies.newSub")} />
      </div>
      <div className="mt-section">
        <NewCompetencyForm />
      </div>
    </main>
  );
}
```

Create `src/app/(manager)/library/competencies/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UndoStrip } from "@/components/ui/undo-strip";
import { PageTitle } from "@/components/manager/page-title";
import { CompetencyForm, type CompetencyFormValue } from "@/components/library/competency-form";
import { UsageBlock } from "@/components/library/usage-block";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { pickText } from "@/lib/i18n-text";
import { liveCount } from "@/lib/library/usage";
import { libraryUsage, loadCompetency, loadDefaultScale, type CompetencyDetail } from "@/server/library";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";
import { archiveCompetencyAction, restoreCompetencyAction } from "../../actions";

export const dynamic = "force-dynamic";

function formValue(c: CompetencyDetail): CompetencyFormValue {
  return {
    name: c.name,
    description: c.description,
    anchors: Object.fromEntries([1, 2, 3, 4, 5].map((l) => [l, c.anchors[l] ?? { tr: "", en: "" }])),
    tags: c.tags.map((tag) => ({ key: tag.id, id: tag.id, polarity: tag.polarity, label: tag.label })),
  };
}

export default async function CompetencyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const locale = await managerLocale();
  const t = managerT(locale);
  const competency = await loadCompetency(user.orgId, id);
  if (!competency) notFound();
  const [scale, usage, sp] = await Promise.all([
    loadDefaultScale(user.orgId),
    libraryUsage(user.orgId, { positionIds: [], competencyIds: [id] }, locale),
    searchParams,
  ]);
  const groups = usage.competencies[id] ?? [];
  const canWrite = can(user, "library:write");

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <Link href="/library/competencies" className="text-[13px] text-muted hover:text-ink">
        {t("libCompetencies.back")}
      </Link>
      <div className="mt-3">
        <PageTitle
          title={pickText(competency.name, locale)}
          sub={competency.archivedAt ? t("libCompetencies.archivedNote") : competency.seededUnreviewed ? t("libCompetencies.seeded") : undefined}
        />
      </div>
      <div className="mt-section grid gap-section lg:grid-cols-[minmax(0,1fr)_320px]">
        <CompetencyForm
          id={competency.id}
          initial={formValue(competency)}
          levels={scale?.levels ?? []}
          canWrite={canWrite && !competency.archivedAt}
          seededUnreviewed={competency.seededUnreviewed}
          liveCount={liveCount(groups)}
          locale={locale}
        />
        <aside className="space-y-6">
          <UsageBlock
            title={t("libCompetencies.usageTitle")}
            empty={t("libCompetencies.usageEmpty")}
            groups={groups}
            lineLabel={(g) => t("libCompetencies.usageLine", { solution: g.label, count: g.entry.total })}
          />
          {canWrite ? (
            <form action={competency.archivedAt ? restoreCompetencyAction : archiveCompetencyAction} className="space-y-2">
              <input type="hidden" name="id" value={competency.id} />
              <Button type="submit" variant="secondary" size="sm">
                {competency.archivedAt ? t("libCompetencies.restore") : t("libCompetencies.archive")}
              </Button>
              {competency.archivedAt ? null : <p className="text-[13px] text-muted">{t("libCompetencies.archiveHint")}</p>}
            </form>
          ) : null}
        </aside>
      </div>
      {sp.archived && competency.archivedAt ? (
        <UndoStrip message={t("libCompetencies.archivedUndo")} action={restoreCompetencyAction} hiddenFields={{ id: competency.id }} />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 9: Run the tests, then the gates and build**

```bash
pnpm exec vitest run src/lib/i18n-text.test.ts src/i18n/messages.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS; build lists `/library/competencies`, `/library/competencies/new`, `/library/competencies/[id]`.

- [ ] **Step 10: Check in the browser (Claude in Chrome)**

Start the dev server (Global Constraints), log in, then:
1. `/library/competencies`: 8 rows, every row "Çapalar tamam", the meta line "Kademe başlangıç içeriği, ekibiniz incelemedi", exactly one filled button ("Yetkinlik ekle").
2. Open "İletişim": anchors 1, 3, 5 filled, 2 and 4 empty and marked "isteğe bağlı". Clear level 3 TR and EN: the filled "Kaydet" is disabled and "Seviye 3 tanımını yaz." appears next to it. Type "İyi iletişimci" in level 3: the trait hint appears. Write a behaviour, tick "Ekibimiz bu tanımı inceledi", save: "Kaydedildi."; back on the list the meta line is gone for İletişim.
3. "Arşivle": the undo strip appears for 8 seconds; "Geri al" restores it.
4. `?tab=scales`: five levels with the HIRING-UX 3.3 names; as Owner they are editable.
5. `/library/competencies/new`: the button is disabled with "Yetkinliğe bir ad ver." until a name is typed; creating opens the new competency.
Stop the dev server. Close the tabs you opened.

- [ ] **Step 11: Commit**

```bash
git add src/db/executor.ts src/lib/i18n-text.ts src/lib/i18n-text.test.ts src/server/library-write.ts "src/app/(manager)/library" src/components/manager/page-title.tsx src/components/manager/route-tabs.tsx src/components/manager/i18n-pair.tsx src/components/library src/i18n/messages/library.tr.json src/i18n/messages/library.en.json src/i18n/manager.ts src/i18n/messages.test.ts
git commit -m "Add the competency and rating scale screens" -m "/library/competencies lists the organisation's competencies with anchor status, tags and usage; the detail edits name, definition, anchors (1, 3, 5 required, trait-word hint), observation tags (stable ids, archived when removed) and the reviewed mark, with an explicit save, archive and an 8 second undo. The scales tab renames levels for owners. An empty library offers the starter content. The dictionaries reject the em dash." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Position screens and the Library menu group

**Files:**
- Modify: `src/server/library-write.ts` (positions)
- Modify: `src/app/(manager)/library/actions.ts` (positions)
- Create: `src/app/(manager)/library/positions/page.tsx`, `.../positions/new/page.tsx`, `.../positions/[id]/page.tsx`
- Create: `src/components/library/position-form.tsx`, `src/components/library/new-position-form.tsx`
- Modify: `src/i18n/messages/library.tr.json`, `library.en.json` (namespace `libPositions`), `src/i18n/messages/manager.tr.json`, `manager.en.json` (nav keys)
- Modify: `src/solutions/registry.ts` (`buildNav` Library group), `src/app/(manager)/layout.tsx`
- Test: `src/solutions/registry.test.ts`, `src/lib/legacy-routes.test.ts`

**Interfaces:**
- Consumes: Task 4 (`loadPosition`, `listPositions`, `activeCompetencyOptions`, `positionAction` on manifests), Task 5 components.
- Produces in `@/server/library-write`: `type PositionInput = { name: string; team: string; shortDescription: string; jobDescription: string; skills: string[]; languages: string[]; profile: Array<{ competencyId: string; weight: number; expectedLevel: number | null }> }`, `createPosition(orgId, actorId, input: { name: string; jobDescription?: string; team?: string }, x?: Executor): Promise<{ ok: true; id: string } | { ok: false; code: "NAME_REQUIRED" }>`, `savePosition(orgId, actorId, id, input: PositionInput)`, `setPositionArchived(orgId, actorId, id, archived)`.
- Produces: `buildNav(locale, shared: { today: string; settings: string; library: { label: string; positions: string; competencies: string } }, manifests?: readonly SolutionManifest[])`.

- [ ] **Step 1: Write the failing menu tests**

In `src/solutions/registry.test.ts` replace the test "builds the HIRING-UX 4.1 menu: Today, solutions, Settings, no group header for a single solution" with:

```ts
  const shared = { today: "Bugün", settings: "Ayarlar", library: { label: "Kütüphane", positions: "Pozisyonlar", competencies: "Yetkinlikler" } };

  it("builds the HIRING-UX 4.1 menu: Today, solutions, Library, Settings, no group header for a single solution", () => {
    const nav = buildNav("tr", shared, [languageExamManifest]);
    expect(nav.map((g) => g.key)).toEqual(["today", "language-exam", "library", "settings"]);
    expect(nav[1].label).toBeNull();
    expect(nav[2].label).toBeNull();
    expect(nav[1].items.map((i) => i.label)).toEqual(["Öğrenciler", "Sınavlar", "Soru bankası"]);
    expect(nav[2].items).toEqual([
      { href: "/library/positions", label: "Pozisyonlar" },
      { href: "/library/competencies", label: "Yetkinlikler" },
    ]);
  });

  it("shows group headers once there is more than one solution", () => {
    const second = { ...languageExamManifest, key: "hiring", dbKind: "HIRING", basePath: "/hiring", label: { tr: "İşe alım", en: "Hiring" } } as SolutionManifest;
    const nav = buildNav("tr", shared, [second, languageExamManifest]);
    expect(nav.map((g) => g.label)).toEqual([null, "İşe alım", "Sınav", "Kütüphane", null]);
  });
```

and add `import { languageExamManifest } from "./language-exam/manifest";` and `SolutionManifest` to the type import.

In `src/lib/legacy-routes.test.ts` replace the `describe("menu", ...)` block with:

```ts
describe("menu", () => {
  it("links only to pages that exist (RULES.md rule 7)", () => {
    const groups = buildNav("tr", { today: "", settings: "", library: { label: "", positions: "", competencies: "" } });
    for (const href of groups.flatMap((g) => g.items.map((i) => i.href))) {
      expect(existsSync(path.join(manager, href, "page.tsx")), href).toBe(true);
    }
    for (const m of SOLUTION_MANIFESTS) {
      if (m.inviteHref) expect(existsSync(path.join(manager, m.inviteHref, "page.tsx")), m.inviteHref).toBe(true);
    }
  });
});
```

with `import { buildNav, SOLUTION_MANIFESTS } from "@/solutions/registry";`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/solutions/registry.test.ts src/lib/legacy-routes.test.ts`
Expected: FAIL (`buildNav` ignores the third argument and has no library group; `/library/positions/page.tsx` does not exist).

- [ ] **Step 3: Add the Library group to the menu**

In `src/solutions/registry.ts` replace `buildNav` with:

```ts
export type LibraryLabels = { label: string; positions: string; competencies: string };

/**
 * The panel menu (HIRING-UX 4.1): Today, one group per solution, the shared
 * Library, Settings. Group headers appear only when more than one solution is
 * registered ("nobody sees the menu of something they do not use").
 */
export function buildNav(
  locale: Locale,
  shared: { today: string; settings: string; library: LibraryLabels },
  manifests: readonly SolutionManifest[] = SOLUTION_MANIFESTS,
): NavGroupView[] {
  const several = manifests.length > 1;
  return [
    { key: "today", label: null, items: [{ href: "/dashboard", label: shared.today }] },
    ...manifests.map((m) => ({
      key: m.key,
      label: several ? m.label[locale] : null,
      items: m.nav.map((n) => ({ href: n.href, label: n.label[locale] })),
    })),
    {
      key: "library",
      label: several ? shared.library.label : null,
      items: [
        { href: "/library/positions", label: shared.library.positions },
        { href: "/library/competencies", label: shared.library.competencies },
      ],
    },
    { key: "settings", label: null, items: [{ href: "/settings", label: shared.settings }] },
  ];
}
```

In `src/app/(manager)/layout.tsx` change the `buildNav` call to:

```tsx
  const groups = buildNav(locale, {
    today: t("nav.dashboard"),
    settings: t("nav.settings"),
    library: { label: t("nav.library"), positions: t("nav.positions"), competencies: t("nav.competencies") },
  });
```

In `src/i18n/messages/manager.tr.json` add to `nav`: `"library": "Kütüphane", "positions": "Pozisyonlar", "competencies": "Yetkinlikler"`; in `manager.en.json`: `"library": "Library", "positions": "Positions", "competencies": "Competencies"`.

- [ ] **Step 4: Write the position writes and actions**

Append to `src/server/library-write.ts` (add `positionCompetencies`, `positions` to the schema import):

```ts
export type PositionInput = {
  name: string;
  team: string;
  shortDescription: string;
  jobDescription: string;
  skills: string[];
  languages: string[];
  profile: Array<{ competencyId: string; weight: number; expectedLevel: number | null }>;
};

const orNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);
const list = (items: string[]) => [...new Set(items.map((s) => s.trim()).filter(Boolean))].slice(0, 30);

/** HIRING-UX 4.2 rule 4: an opening can create its position in place; it is still an org row. */
export async function createPosition(
  orgId: string,
  actorId: string,
  input: { name: string; jobDescription?: string; team?: string },
  x: Executor = db,
): Promise<{ ok: true; id: string } | { ok: false; code: "NAME_REQUIRED" }> {
  if (!input.name.trim()) return { ok: false, code: "NAME_REQUIRED" };
  const [row] = await x
    .insert(positions)
    .values({ orgId, name: input.name.trim(), team: orNull(input.team), jobDescription: orNull(input.jobDescription) })
    .returning({ id: positions.id });
  await audit(x, orgId, actorId, "library.position.create", "position", row.id);
  return { ok: true, id: row.id };
}

export async function savePosition(
  orgId: string,
  actorId: string,
  id: string,
  input: PositionInput,
): Promise<{ ok: true } | { ok: false; code: "NAME_REQUIRED" | "NOT_FOUND" | "COMPETENCY" }> {
  if (!input.name.trim()) return { ok: false, code: "NAME_REQUIRED" };
  const ids = [...new Set(input.profile.map((p) => p.competencyId))];
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: positions.id })
      .from(positions)
      .where(and(eq(positions.id, id), eq(positions.orgId, orgId)))
      .for("update");
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };
    if (ids.length) {
      const owned = await tx
        .select({ id: competencies.id })
        .from(competencies)
        .where(and(eq(competencies.orgId, orgId), inArray(competencies.id, ids)));
      if (owned.length !== ids.length) return { ok: false as const, code: "COMPETENCY" as const };
    }
    await tx
      .update(positions)
      .set({
        name: input.name.trim(),
        team: orNull(input.team),
        shortDescription: orNull(input.shortDescription),
        jobDescription: orNull(input.jobDescription),
        skills: list(input.skills),
        languages: list(input.languages),
        updatedAt: new Date(),
      })
      .where(eq(positions.id, id));
    // The profile is copied into an opening at publish; nothing refers to these rows.
    await tx.delete(positionCompetencies).where(eq(positionCompetencies.positionId, id));
    const seen = new Set<string>();
    const rows = input.profile
      .filter((p) => (seen.has(p.competencyId) ? false : (seen.add(p.competencyId), true)))
      .map((p, orderIndex) => ({ positionId: id, competencyId: p.competencyId, weight: p.weight, expectedLevel: p.expectedLevel, orderIndex }));
    if (rows.length) await tx.insert(positionCompetencies).values(rows);
    await audit(tx, orgId, actorId, "library.position.save", "position", id, { competencies: rows.length });
    return { ok: true as const };
  });
}

export async function setPositionArchived(orgId: string, actorId: string, id: string, archived: boolean): Promise<boolean> {
  const rows = await db
    .update(positions)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(positions.id, id), eq(positions.orgId, orgId)))
    .returning({ id: positions.id });
  if (rows.length) await audit(db, orgId, actorId, archived ? "library.position.archive" : "library.position.restore", "position", id);
  return rows.length > 0;
}
```

Append to `src/app/(manager)/library/actions.ts` (add `createPosition, savePosition, setPositionArchived, type PositionInput` to the `@/server/library-write` import):

```ts
const positionSchema = z.object({
  name: z.string().max(160),
  team: z.string().max(160),
  shortDescription: z.string().max(1000),
  jobDescription: z.string().max(20000),
  skills: z.array(z.string().max(80)).max(30),
  languages: z.array(z.string().max(40)).max(10),
  profile: z
    .array(z.object({ competencyId: z.uuid(), weight: z.number().int().min(0).max(100), expectedLevel: z.number().int().min(1).max(5).nullable() }))
    .max(20),
});

export async function createPositionAction(input: { name: string; team: string; jobDescription: string }) {
  const user = await requireUser("library:write");
  const parsed = z.object({ name: z.string().max(160), team: z.string().max(160), jobDescription: z.string().max(20000) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "INVALID" as const };
  const result = await createPosition(user.orgId, user.id, parsed.data);
  if (!result.ok) return result;
  redirect(`/library/positions/${result.id}`);
}

export async function savePositionAction(id: string, input: PositionInput) {
  const user = await requireUser("library:write");
  const parsed = positionSchema.safeParse(input);
  if (!isUuid(id) || !parsed.success) return { ok: false as const, code: "INVALID" as const };
  const result = await savePosition(user.orgId, user.id, id, parsed.data);
  if (result.ok) revalidatePath(`/library/positions/${id}`);
  return result;
}

export async function archivePositionAction(formData: FormData) {
  const user = await requireUser("library:write");
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return;
  await setPositionArchived(user.orgId, user.id, id, true);
  redirect(`/library/positions/${id}?archived=1`);
}

export async function restorePositionAction(formData: FormData) {
  const user = await requireUser("library:write");
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return;
  await setPositionArchived(user.orgId, user.id, id, false);
  redirect(`/library/positions/${id}`);
}
```

- [ ] **Step 5: Add the position copy**

Add to `src/i18n/messages/library.tr.json` the namespace:

```json
  "libPositions": {
    "title": "Pozisyonlar",
    "sub": "Bir rolün neyi gerektirdiği: tanım, ilan metni ve yetkinlik profili.",
    "add": "Pozisyon ekle",
    "emptyTitle": "Henüz pozisyon yok",
    "emptyBody": "Pozisyon, bir rolün neyi gerektirdiğini tek yerde tutar. İşe alım ve ileride diğer araçlar buradan okur.",
    "colName": "Pozisyon",
    "colTeam": "Ekip",
    "colCompetencies": "Yetkinlik",
    "colUsage": "Nerede kullanılıyor",
    "competencyCount": "{count} yetkinlik",
    "back": "Pozisyonlara dön",
    "archivedTitle": "Arşivdekiler ({count})",
    "archivedNote": "Arşivde. Yeni alımlarda seçilemez.",
    "name": "Ad",
    "team": "Ekip",
    "shortDescription": "Kısa tanım",
    "jobDescription": "İlan metni",
    "jobDescriptionHint": "AI taslağı bu metni okur. 120 karakter yeter, daha uzunu daha iyi.",
    "skills": "Beceriler",
    "languages": "Diller",
    "commaHint": "Virgülle ayır.",
    "profileTitle": "Yetkinlik profili",
    "profileSub": "Rolün gerektirdiği yetkinlikler ve önemleri. Ağırlıklar alımda %100'e oranlanır.",
    "competency": "Yetkinlik",
    "weight": "Önem (0-100)",
    "expectedLevel": "Beklenen seviye",
    "noExpectedLevel": "Belirtilmedi",
    "addCompetency": "Yetkinlik ekle",
    "removeCompetency": "Kaldır",
    "noMoreCompetencies": "Kütüphanedeki tüm yetkinlikler profilde.",
    "archivedCompetency": "arşivde",
    "profileEmpty": "Henüz yetkinlik yok. Alım açınca puan kartı eşit ağırlıkla başlar.",
    "save": "Kaydet",
    "saving": "Kaydediliyor",
    "saved": "Kaydedildi.",
    "saveFailed": "Kaydedilemedi. Tekrar dene.",
    "nameRequired": "Pozisyon adını yaz.",
    "weightInvalid": "Önem 0 ile 100 arasında bir tam sayı olmalı.",
    "noPermission": "Rolün kütüphaneyi değiştiremez.",
    "archive": "Arşivle",
    "restore": "Arşivden çıkar",
    "archivedUndo": "Pozisyon arşivlendi.",
    "usageTitle": "Nerede kullanılıyor",
    "usageEmpty": "Henüz hiçbir alımda kullanılmıyor.",
    "usageLine": "{solution} · {count}",
    "newTitle": "Yeni pozisyon",
    "newSub": "Ad yeterli. İlan metnini eklersen AI taslağı ondan öneri çıkarır.",
    "create": "Oluştur",
    "creating": "Oluşturuluyor"
  }
```

and to `library.en.json`:

```json
  "libPositions": {
    "title": "Positions",
    "sub": "What a role requires: definition, job ad and competency profile.",
    "add": "Add a position",
    "emptyTitle": "No positions yet",
    "emptyBody": "A position keeps what a role requires in one place. Hiring, and later other tools, read it from here.",
    "colName": "Position",
    "colTeam": "Team",
    "colCompetencies": "Competencies",
    "colUsage": "Where it is used",
    "competencyCount": "{count, plural, one {# competency} other {# competencies}}",
    "back": "Back to positions",
    "archivedTitle": "Archived ({count})",
    "archivedNote": "Archived. It cannot be picked for new openings.",
    "name": "Name",
    "team": "Team",
    "shortDescription": "Short description",
    "jobDescription": "Job ad",
    "jobDescriptionHint": "The AI draft reads this text. 120 characters are enough; longer is better.",
    "skills": "Skills",
    "languages": "Languages",
    "commaHint": "Separate with commas.",
    "profileTitle": "Competency profile",
    "profileSub": "The competencies the role requires and how much each matters. An opening scales the weights to 100%.",
    "competency": "Competency",
    "weight": "Importance (0-100)",
    "expectedLevel": "Expected level",
    "noExpectedLevel": "Not set",
    "addCompetency": "Add a competency",
    "removeCompetency": "Remove",
    "noMoreCompetencies": "Every competency in the library is in the profile.",
    "archivedCompetency": "archived",
    "profileEmpty": "No competencies yet. An opening's scorecard then starts with equal weights.",
    "save": "Save",
    "saving": "Saving",
    "saved": "Saved.",
    "saveFailed": "Could not save. Try again.",
    "nameRequired": "Write the position's name.",
    "weightInvalid": "Importance must be a whole number from 0 to 100.",
    "noPermission": "Your role cannot change the library.",
    "archive": "Archive",
    "restore": "Restore",
    "archivedUndo": "Position archived.",
    "usageTitle": "Where it is used",
    "usageEmpty": "Not used in any opening yet.",
    "usageLine": "{solution} · {count}",
    "newTitle": "New position",
    "newSub": "A name is enough. Add the job ad and the AI draft proposes questions from it.",
    "create": "Create",
    "creating": "Creating"
  }
```

- [ ] **Step 6: Write the position components**

Create `src/components/library/position-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { pickText } from "@/lib/i18n-text";
import { savePositionAction } from "@/app/(manager)/library/actions";

export type PositionFormValue = {
  name: string;
  team: string;
  shortDescription: string;
  jobDescription: string;
  skills: string;
  languages: string;
  profile: Array<{ competencyId: string; weight: string; expectedLevel: string; archived: boolean }>;
};

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const validWeight = (w: string) => /^\d{1,3}$/.test(w) && Number(w) <= 100;

/** HIRING-UX 5.9: definition, job ad and the competency profile, saved explicitly. */
export function PositionForm({
  id,
  initial,
  options,
  levels,
  canWrite,
  primary,
  locale,
}: {
  id: string;
  initial: PositionFormValue;
  options: Array<{ id: string; name: I18nText }>;
  levels: Array<{ value: number; label: I18nText }>;
  canWrite: boolean;
  /** False when a solution's position action is the screen's filled button. */
  primary: boolean;
  locale: Locale;
}) {
  const t = useMT("libPositions");
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"saved" | "error" | null>(null);
  const set = <K extends keyof PositionFormValue>(key: K, v: PositionFormValue[K]) => setValue((s) => ({ ...s, [key]: v }));
  const used = new Set(value.profile.map((p) => p.competencyId));
  const free = options.filter((o) => !used.has(o.id));
  const nameOf = (cid: string) => pickText(options.find((o) => o.id === cid)?.name, locale);
  const reason = !canWrite
    ? t("noPermission")
    : !value.name.trim()
      ? t("nameRequired")
      : value.profile.some((p) => !validWeight(p.weight))
        ? t("weightInvalid")
        : null;

  function save() {
    setResult(null);
    start(async () => {
      const res = await savePositionAction(id, {
        name: value.name,
        team: value.team,
        shortDescription: value.shortDescription,
        jobDescription: value.jobDescription,
        skills: split(value.skills),
        languages: split(value.languages),
        profile: value.profile.map((p) => ({
          competencyId: p.competencyId,
          weight: Number(p.weight),
          expectedLevel: p.expectedLevel === "none" ? null : Number(p.expectedLevel),
        })),
      });
      setResult(res.ok ? "saved" : "error");
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-section">
      <Card className="space-y-field p-card">
        <div className="grid gap-field md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pos-name">{t("name")}</Label>
            <Input id="pos-name" value={value.name} disabled={!canWrite} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos-team">{t("team")}</Label>
            <Input id="pos-team" value={value.team} disabled={!canWrite} onChange={(e) => set("team", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pos-short">{t("shortDescription")}</Label>
          <Textarea id="pos-short" value={value.shortDescription} disabled={!canWrite} onChange={(e) => set("shortDescription", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pos-ad">{t("jobDescription")}</Label>
          <Textarea id="pos-ad" rows={8} value={value.jobDescription} disabled={!canWrite} onChange={(e) => set("jobDescription", e.target.value)} />
          <p className="text-[13px] text-muted">{t("jobDescriptionHint")}</p>
        </div>
        <div className="grid gap-field md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pos-skills">{t("skills")}</Label>
            <Input id="pos-skills" value={value.skills} disabled={!canWrite} onChange={(e) => set("skills", e.target.value)} />
            <p className="text-[13px] text-muted">{t("commaHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos-langs">{t("languages")}</Label>
            <Input id="pos-langs" value={value.languages} disabled={!canWrite} onChange={(e) => set("languages", e.target.value)} />
            <p className="text-[13px] text-muted">{t("commaHint")}</p>
          </div>
        </div>
      </Card>

      <Card className="p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("profileTitle")}</h2>
        <p className="text-[13px] text-muted">{t("profileSub")}</p>
        {value.profile.length === 0 ? <p className="mt-4 text-[13px] text-muted">{t("profileEmpty")}</p> : null}
        <div className="mt-4 space-y-3">
          {value.profile.map((row, index) => (
            <div key={row.competencyId} className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_140px_200px_auto]">
              <span className="text-[14px] text-ink">
                {nameOf(row.competencyId)}
                {row.archived ? <span className="ml-2 text-[12px] text-muted">({t("archivedCompetency")})</span> : null}
              </span>
              <Input
                aria-label={`${t("weight")}: ${nameOf(row.competencyId)}`}
                inputMode="numeric"
                className="tnum"
                value={row.weight}
                disabled={!canWrite}
                onChange={(e) => set("profile", value.profile.map((p, i) => (i === index ? { ...p, weight: e.target.value } : p)))}
              />
              <Select
                value={row.expectedLevel}
                disabled={!canWrite}
                onValueChange={(v) => set("profile", value.profile.map((p, i) => (i === index ? { ...p, expectedLevel: v } : p)))}
              >
                <SelectTrigger aria-label={`${t("expectedLevel")}: ${nameOf(row.competencyId)}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noExpectedLevel")}</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l.value} value={String(l.value)}>
                      {l.value} · {pickText(l.label, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canWrite ? (
                <Button variant="ghost" size="sm" onClick={() => set("profile", value.profile.filter((_, i) => i !== index))}>
                  {t("removeCompetency")}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        {canWrite ? (
          free.length ? (
            <div className="mt-4 max-w-[360px]">
              <Select
                value=""
                onValueChange={(cid) => set("profile", [...value.profile, { competencyId: cid, weight: "50", expectedLevel: "none", archived: false }])}
              >
                <SelectTrigger aria-label={t("addCompetency")}>
                  <SelectValue placeholder={t("addCompetency")} />
                </SelectTrigger>
                <SelectContent>
                  {free.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {pickText(o.name, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-muted">{t("noMoreCompetencies")}</p>
          )
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button variant={primary ? "primary" : "secondary"} onClick={save} disabled={pending || reason !== null} disabledReason={reason ?? undefined}>
          {pending ? t("saving") : t("save")}
        </Button>
        {reason ? <DisabledReason>{reason}</DisabledReason> : null}
        {result === "saved" ? <span role="status" className="text-[13px] text-muted">{t("saved")}</span> : null}
        {result === "error" ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
      </div>
    </div>
  );
}
```

Create `src/components/library/new-position-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import { createPositionAction } from "@/app/(manager)/library/actions";

export function NewPositionForm() {
  const t = useMT("libPositions");
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const reason = name.trim() ? null : t("nameRequired");
  return (
    <Card className="space-y-field p-card">
      <div className="space-y-2">
        <Label htmlFor="new-pos-name">{t("name")}</Label>
        <Input id="new-pos-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pos-team">{t("team")}</Label>
        <Input id="new-pos-team" value={team} onChange={(e) => setTeam(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pos-ad">{t("jobDescription")}</Label>
        <Textarea id="new-pos-ad" rows={8} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
        <p className="text-[13px] text-muted">{t("jobDescriptionHint")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="primary"
          disabled={pending || reason !== null}
          disabledReason={reason ?? undefined}
          onClick={() =>
            start(async () => {
              const result = await createPositionAction({ name, team, jobDescription });
              if (result && !result.ok) setFailed(true);
            })
          }
        >
          {pending ? t("creating") : t("create")}
        </Button>
        {reason ? <DisabledReason>{reason}</DisabledReason> : null}
        {failed ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
      </div>
    </Card>
  );
}
```

- [ ] **Step 7: Write the position pages**

Create `src/app/(manager)/library/positions/page.tsx`:

```tsx
import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle } from "@/components/manager/page-title";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { libraryUsage, listPositions, type PositionRow } from "@/server/library";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function PositionsPage() {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const canWrite = can(user, "library:write");
  const rows = await listPositions(user.orgId);
  const usage = await libraryUsage(user.orgId, { positionIds: rows.map((r) => r.id), competencyIds: [] }, locale);
  const addButton = canWrite ? (
    <Button asChild variant="primary">
      <Link href="/library/positions/new">{t("libPositions.add")}</Link>
    </Button>
  ) : (
    <>
      <Button variant="primary" disabled disabledReason={t("libPositions.noPermission")}>
        {t("libPositions.add")}
      </Button>
      <DisabledReason>{t("libPositions.noPermission")}</DisabledReason>
    </>
  );

  if (rows.length === 0) {
    return (
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <PageTitle title={t("libPositions.title")} sub={t("libPositions.sub")} />
        <Empty className="mt-section border border-line">
          <EmptyHeader>
            <EmptyTitle>{t("libPositions.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("libPositions.emptyBody")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{addButton}</EmptyContent>
        </Empty>
      </main>
    );
  }

  const table = (list: PositionRow[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("libPositions.colName")}</TableHead>
          <TableHead>{t("libPositions.colTeam")}</TableHead>
          <TableHead>{t("libPositions.colCompetencies")}</TableHead>
          <TableHead>{t("libPositions.colUsage")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((row) => {
          const groups = usage.positions[row.id] ?? [];
          return (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/library/positions/${row.id}`} className="font-medium text-ink hover:underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell className="text-[13px] text-muted">{row.team ?? "-"}</TableCell>
              <TableCell className="tnum text-[13px] text-muted">{t("libPositions.competencyCount", { count: row.competencyCount })}</TableCell>
              <TableCell className="tnum text-[13px] text-muted">
                {groups.length ? groups.map((g) => t("libPositions.usageLine", { solution: g.label, count: g.entry.total })).join(", ") : "-"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
  const active = rows.filter((r) => !r.archivedAt);
  const archived = rows.filter((r) => r.archivedAt);

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <PageTitle title={t("libPositions.title")} sub={t("libPositions.sub")} action={addButton} />
      <Card className="mt-section overflow-x-auto">{table(active)}</Card>
      {archived.length ? (
        <Collapsible className="mt-section">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {t("libPositions.archivedTitle", { count: archived.length })}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-3 overflow-x-auto">{table(archived)}</Card>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </main>
  );
}
```

Create `src/app/(manager)/library/positions/new/page.tsx`:

```tsx
import Link from "next/link";
import { PageTitle } from "@/components/manager/page-title";
import { NewPositionForm } from "@/components/library/new-position-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function NewPositionPage() {
  await requireUser("library:write");
  const t = managerT(await managerLocale());
  return (
    <main className="mx-auto max-w-[880px] px-page py-8">
      <Link href="/library/positions" className="text-[13px] text-muted hover:text-ink">
        {t("libPositions.back")}
      </Link>
      <div className="mt-3">
        <PageTitle title={t("libPositions.newTitle")} sub={t("libPositions.newSub")} />
      </div>
      <div className="mt-section">
        <NewPositionForm />
      </div>
    </main>
  );
}
```

Create `src/app/(manager)/library/positions/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UndoStrip } from "@/components/ui/undo-strip";
import { PageTitle } from "@/components/manager/page-title";
import { PositionForm } from "@/components/library/position-form";
import { UsageBlock } from "@/components/library/usage-block";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { activeCompetencyOptions, libraryUsage, loadDefaultScale, loadPosition } from "@/server/library";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";
import { SOLUTION_MANIFESTS } from "@/solutions/registry";
import { archivePositionAction, restorePositionAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function PositionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const locale = await managerLocale();
  const t = managerT(locale);
  const position = await loadPosition(user.orgId, id);
  if (!position) notFound();
  const [options, scale, usage, sp] = await Promise.all([
    activeCompetencyOptions(user.orgId),
    loadDefaultScale(user.orgId),
    libraryUsage(user.orgId, { positionIds: [id], competencyIds: [] }, locale),
    searchParams,
  ]);
  const canWrite = can(user, "library:write");
  // The first solution that offers an action on a position owns the filled button (HIRING-UX 5.9).
  const action = position.archivedAt ? null : SOLUTION_MANIFESTS.find((m) => m.positionAction)?.positionAction ?? null;
  // A profile row whose competency was archived stays listed, by its stored name.
  const allOptions = [
    ...options,
    ...position.profile.filter((p) => p.archived).map((p) => ({ id: p.competencyId, name: p.name })),
  ];

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <Link href="/library/positions" className="text-[13px] text-muted hover:text-ink">
        {t("libPositions.back")}
      </Link>
      <div className="mt-3">
        <PageTitle
          title={position.name}
          sub={position.archivedAt ? t("libPositions.archivedNote") : position.team ?? undefined}
          action={
            action ? (
              <Button asChild variant="primary">
                <Link href={action.href(position.id)}>{action.label[locale]}</Link>
              </Button>
            ) : undefined
          }
        />
      </div>
      <div className="mt-section grid gap-section lg:grid-cols-[minmax(0,1fr)_320px]">
        <PositionForm
          id={position.id}
          locale={locale}
          canWrite={canWrite && !position.archivedAt}
          primary={!action}
          options={allOptions}
          levels={scale?.levels ?? []}
          initial={{
            name: position.name,
            team: position.team ?? "",
            shortDescription: position.shortDescription ?? "",
            jobDescription: position.jobDescription ?? "",
            skills: position.skills.join(", "),
            languages: position.languages.join(", "),
            profile: position.profile.map((p) => ({
              competencyId: p.competencyId,
              weight: String(p.weight),
              expectedLevel: p.expectedLevel === null ? "none" : String(p.expectedLevel),
              archived: p.archived,
            })),
          }}
        />
        <aside className="space-y-6">
          <UsageBlock
            title={t("libPositions.usageTitle")}
            empty={t("libPositions.usageEmpty")}
            groups={usage.positions[id] ?? []}
            lineLabel={(g) => t("libPositions.usageLine", { solution: g.label, count: g.entry.total })}
          />
          {canWrite ? (
            <form action={position.archivedAt ? restorePositionAction : archivePositionAction}>
              <input type="hidden" name="id" value={position.id} />
              <Button type="submit" variant="secondary" size="sm">
                {position.archivedAt ? t("libPositions.restore") : t("libPositions.archive")}
              </Button>
            </form>
          ) : null}
        </aside>
      </div>
      {sp.archived && position.archivedAt ? (
        <UndoStrip message={t("libPositions.archivedUndo")} action={restorePositionAction} hiddenFields={{ id: position.id }} />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 8: Run the tests, the gates, the build, exam and guard**

```bash
pnpm exec vitest run src/solutions/registry.test.ts src/lib/legacy-routes.test.ts src/i18n/messages.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
then start the dev server, run `pnpm verify:guard` with the same `DATABASE_URL`, and keep the server for Step 9.
Expected: all PASS, verify scripts only `ok`.

- [ ] **Step 9: Check in the browser (Claude in Chrome)**

1. The side menu shows Bugün, the exam entries, Pozisyonlar, Yetkinlikler, Ayarlar (no group headers: one solution is registered).
2. `/library/positions` empty state: the copy of HIRING-UX 5.9 and one filled button. Add "Kıdemli Ürün Tasarımcısı" with a job ad; the detail opens.
3. Add İletişim (weight 60) and Problem Çözme (weight 20, expected level 3); type "abc" in a weight: the filled "Kaydet" is disabled with "Önem 0 ile 100 arasında bir tam sayı olmalı."; fix it and save: "Kaydedildi."; reload: values kept.
4. Archive the position: undo strip; "Geri al" restores. At 1024px wide nothing overflows horizontally.
Stop the dev server; close your tabs.

- [ ] **Step 10: Commit**

```bash
git add src/server/library-write.ts "src/app/(manager)/library" src/components/library src/i18n/messages/library.tr.json src/i18n/messages/library.en.json src/i18n/messages/manager.tr.json src/i18n/messages/manager.en.json src/solutions/registry.ts src/solutions/registry.test.ts "src/app/(manager)/layout.tsx" src/lib/legacy-routes.test.ts
git commit -m "Add the position screens and the Library menu group" -m "/library/positions lists positions with their team, competency count and usage; the detail edits the definition, job ad, skills, languages and the competency profile (importance 0-100, optional expected level), saved explicitly, with archive and undo. A solution's positionAction, when one exists, becomes the filled button. The menu gains the shared Library group (HIRING-UX 4.1), and the menu test now walks buildNav." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: AI anchor proposals (ANCHOR_DRAFT)

**Files:**
- Create: `src/lib/ai-json.ts`, `src/lib/ai-json.test.ts`
- Create: `src/lib/library/anchor-draft.ts`, `src/lib/library/anchor-draft.test.ts`
- Create: `src/server/anchor-draft-job.ts`
- Modify: `src/app/(manager)/library/actions.ts`
- Create: `src/components/library/anchor-assist.tsx`
- Modify: `src/components/library/competency-form.tsx`
- Modify: `src/i18n/messages/library.tr.json`, `library.en.json` (namespace `libAnchorAi`)

**Interfaces:**
- Produces in `@/lib/ai-json`: `parseModelJson(text: string): { ok: true; value: unknown } | { ok: false; problem: string }`, `withoutEmDash(text: string): string`, `buildRepairMessages(original: AiMessage[], brokenAnswer: string, problem: string): AiMessage[]`.
- Produces in `@/lib/library/anchor-draft`: `ANCHOR_DRAFT_JSON_SCHEMA`, `type AnchorProposal = Record<1 | 2 | 3 | 4 | 5, I18nText>`, `type AnchorDraftRequest`, `buildAnchorMessages(r: AnchorDraftRequest): AiMessage[]`, `parseAnchorAnswer(text: string): { ok: true; anchors: AnchorProposal } | { ok: false; problem: string }`.
- Produces in `@/server/anchor-draft-job`: `draftAnchors(orgId, userId, competencyId, request): Promise<{ status: "OK"; anchors: AnchorProposal } | { status: "UNCONFIGURED" } | { status: "FAILED" }>`.
- Produces action `draftAnchorsAction(competencyId: string, input: { name: I18nText; description: I18nText })`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/ai-json.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRepairMessages, parseModelJson, withoutEmDash } from "./ai-json";

describe("model JSON packaging", () => {
  it("unwraps a code fence and trims chatter around the object", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseModelJson('Here you go: {"a":2} hope it helps')).toEqual({ ok: true, value: { a: 2 } });
  });

  it("reports an answer with no object at all", () => {
    expect(parseModelJson("no json here").ok).toBe(false);
  });

  it("replaces the em dash, which this product never prints", () => {
    expect(withoutEmDash("Somut \u2014 ölçülebilir")).toBe("Somut, ölçülebilir");
  });

  it("sends the broken answer back once with the reason", () => {
    const messages = buildRepairMessages([{ role: "user", content: "q" }], "broken", "missing level3Tr");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[2].content).toContain("missing level3Tr");
  });
});
```

Create `src/lib/library/anchor-draft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ANCHOR_DRAFT_JSON_SCHEMA, buildAnchorMessages, parseAnchorAnswer } from "./anchor-draft";

const full = {
  level1Tr: "Soruyu cevaplamıyor ve örnek vermiyor.",
  level1En: "Does not answer the question and gives no example.",
  level2Tr: "",
  level2En: "",
  level3Tr: "Ana fikri başta söylüyor ve bir örnek veriyor.",
  level3En: "States the main point first and gives one example.",
  level4Tr: "",
  level4En: "",
  level5Tr: "Dinleyiciye göre ayarlıyor \u2014 ve özetliyor.",
  level5En: "Adjusts to the listener and summarises.",
};

describe("anchor proposals", () => {
  it("asks for every level in both languages and states the limits", () => {
    expect((ANCHOR_DRAFT_JSON_SCHEMA.required as string[]).length).toBe(10);
    const messages = buildAnchorMessages({
      name: { tr: "İletişim", en: "Communication" },
      description: { tr: "", en: "" },
      levels: [{ value: 3, label: { tr: "Beklenen düzeyde", en: "Meets the bar" } }],
    });
    expect(messages[0].content).toMatch(/never score, rank or judge a real person/i);
    expect(messages[1].content).toContain("İletişim");
    expect(messages[1].content).toContain("Beklenen düzeyde");
  });

  it("returns levels 1 to 5 and strips the em dash", () => {
    const parsed = parseAnchorAnswer(JSON.stringify(full));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.anchors[3].tr).toBe(full.level3Tr);
    expect(parsed.anchors[2]).toEqual({ tr: "", en: "" });
    expect(parsed.anchors[5].tr).not.toContain("\u2014");
  });

  it("rejects an answer without a required level", () => {
    const parsed = parseAnchorAnswer(JSON.stringify({ ...full, level3Tr: " ", level3En: "" }));
    expect(parsed.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/lib/ai-json.test.ts src/lib/library/anchor-draft.test.ts`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement the shared JSON helpers**

Create `src/lib/ai-json.ts`:

```ts
import type { AiMessage } from "@/lib/ai";

/**
 * Packaging tolerance for model answers, shared by every AI purpose: a code
 * fence is unwrapped and an answer that narrates around its JSON is cut back to
 * the outermost object. Nothing about the content is forgiven here; callers
 * validate with zod and reject what does not match.
 */
export function parseModelJson(text: string): { ok: true; value: unknown } | { ok: false; problem: string } {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith("```") ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim() : trimmed;
  try {
    return { ok: true, value: JSON.parse(unfenced) };
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start === -1 || end <= start) return { ok: false, problem: "no JSON object in the answer" };
    try {
      return { ok: true, value: JSON.parse(unfenced.slice(start, end + 1)) };
    } catch (error) {
      return { ok: false, problem: `JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}

/** The product never prints an em dash (RULES.md); a model sometimes does. */
export function withoutEmDash(text: string): string {
  return text.replace(/\s*\u2014\s*/g, ", ");
}

/** The single repair attempt: the broken answer goes back with the reason it was rejected. */
export function buildRepairMessages(original: AiMessage[], brokenAnswer: string, problem: string): AiMessage[] {
  return [
    ...original,
    { role: "assistant", content: brokenAnswer.slice(0, 20_000) },
    {
      role: "user",
      content: [
        "This answer did not match the schema and could not be used:",
        problem.slice(0, 1500),
        "",
        "Give the same proposal again as one JSON object that matches the schema exactly.",
        "Return only JSON, no explanation, no code fence.",
      ].join("\n"),
    },
  ];
}
```

- [ ] **Step 4: Implement the anchor prompt and parser**

Create `src/lib/library/anchor-draft.ts`:

```ts
import { z } from "zod";
import type { I18nText } from "@/db/schema/types";
import type { AiMessage } from "@/lib/ai";
import { parseModelJson, withoutEmDash } from "@/lib/ai-json";
import { hasText, REQUIRED_ANCHOR_LEVELS } from "./anchors";

/**
 * ANCHOR_DRAFT (HIRING-UX 3.9, 5.10): proposed 1-5 behavioural anchors for one
 * competency. A proposal: the person reads it, edits it and saves it, or not.
 * It never describes a real candidate.
 */
const KEYS = [1, 2, 3, 4, 5].flatMap((l) => [`level${l}Tr`, `level${l}En`]);
const line = z.string().max(600);
const anchorDraftSchema = z.object(Object.fromEntries(KEYS.map((k) => [k, line])) as Record<string, typeof line>);

export const ANCHOR_DRAFT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: KEYS,
  properties: Object.fromEntries(KEYS.map((k) => [k, { type: "string" }])),
};

export type AnchorProposal = Record<1 | 2 | 3 | 4 | 5, I18nText>;
export type AnchorDraftRequest = {
  name: I18nText;
  description: I18nText;
  levels: Array<{ value: number; label: I18nText }>;
};

const SYSTEM_PROMPT = `You write behavioural anchors for one competency on a 1 to 5 rating scale. A hiring team will read your proposal, edit it and decide whether to use it.

Rules:
- Each level describes what a reviewer can observe in a candidate's answer: what the candidate says or does. Never a personality trait, never an adjective about the person.
- Level 1 is a clear gap, 3 meets the bar for the role, 5 is exceptional. Levels 2 and 4 sit between their neighbours.
- One or two concrete sentences per level.
- Nothing about age, gender, family, health, religion, origin, politics or any other protected characteristic.
- You never score, rank or judge a real person; you only describe levels.
- Turkish fields are natural Turkish, not translated English. English fields are plain English.
- Never use the em dash character.`;

export function buildAnchorMessages(request: AnchorDraftRequest): AiMessage[] {
  const levels = request.levels.map((l) => `${l.value}: ${l.label.tr} / ${l.label.en}`).join("\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `Yetkinlik / Competency: ${request.name.tr} / ${request.name.en}`,
        `Tanım / Definition: ${request.description.tr || "-"} / ${request.description.en || "-"}`,
        "",
        "Seviye adları / Level names:",
        levels,
        "",
        "Fill level1Tr ... level5En. Every field must be filled.",
      ].join("\n"),
    },
  ];
}

export function parseAnchorAnswer(text: string): { ok: true; anchors: AnchorProposal } | { ok: false; problem: string } {
  const json = parseModelJson(text);
  if (!json.ok) return json;
  const parsed = anchorDraftSchema.safeParse(json.value);
  if (!parsed.success) {
    return { ok: false, problem: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const value = parsed.data;
  const anchors = Object.fromEntries(
    ([1, 2, 3, 4, 5] as const).map((l) => [
      l,
      { tr: withoutEmDash(value[`level${l}Tr`].trim()), en: withoutEmDash(value[`level${l}En`].trim()) },
    ]),
  ) as AnchorProposal;
  const missing = REQUIRED_ANCHOR_LEVELS.filter((l) => !hasText(anchors[l]));
  if (missing.length) return { ok: false, problem: `levels ${missing.join(", ")} are empty` };
  return { ok: true, anchors };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/ai-json.test.ts src/lib/library/anchor-draft.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the logged call, the action and the assist card**

Create `src/server/anchor-draft-job.ts`:

```ts
import { getAiProvider } from "@/lib/ai";
import { buildRepairMessages } from "@/lib/ai-json";
import { callJson, recordAiRun } from "@/lib/ai-runs";
import { ANCHOR_DRAFT_JSON_SCHEMA, buildAnchorMessages, parseAnchorAnswer, type AnchorDraftRequest, type AnchorProposal } from "@/lib/library/anchor-draft";

export type AnchorDraftOutcome = { status: "OK"; anchors: AnchorProposal } | { status: "UNCONFIGURED" } | { status: "FAILED" };

/** One proposal, one repair attempt at most; every call leaves an ai_runs row (callJson). Writes nothing else. */
export async function draftAnchors(orgId: string, userId: string, competencyId: string, request: AnchorDraftRequest): Promise<AnchorDraftOutcome> {
  if (!getAiProvider().available) return { status: "UNCONFIGURED" };
  const meta = { orgId, purpose: "ANCHOR_DRAFT" as const, inputRef: competencyId, requestedBy: userId };
  const messages = buildAnchorMessages(request);
  try {
    const first = await callJson("kademe_anchor_draft", ANCHOR_DRAFT_JSON_SCHEMA, messages, meta);
    const parsed = parseAnchorAnswer(first.response.text);
    if (parsed.ok) return { status: "OK", anchors: parsed.anchors };
    const second = await callJson(
      "kademe_anchor_draft",
      ANCHOR_DRAFT_JSON_SCHEMA,
      buildRepairMessages(messages, first.response.text, parsed.problem),
      meta,
    );
    const repaired = parseAnchorAnswer(second.response.text);
    if (repaired.ok) return { status: "OK", anchors: repaired.anchors };
    await recordAiRun({ ...meta, model: second.response.model, error: `repair still invalid: ${repaired.problem}` });
    return { status: "FAILED" };
  } catch {
    return { status: "FAILED" };
  }
}
```

Append to `src/app/(manager)/library/actions.ts` (imports: `draftAnchors` from `@/server/anchor-draft-job`, `loadCompetency, loadDefaultScale` from `@/server/library`):

```ts
export async function draftAnchorsAction(competencyId: string, input: { name: { tr: string; en: string }; description: { tr: string; en: string } }) {
  const user = await requireUser("library:write");
  const parsed = z.object({ name: i18n, description: i18n }).safeParse(input);
  if (!isUuid(competencyId) || !parsed.success) return { status: "FAILED" as const };
  if (!(await loadCompetency(user.orgId, competencyId))) return { status: "FAILED" as const };
  const scale = await loadDefaultScale(user.orgId);
  return draftAnchors(user.orgId, user.id, competencyId, { ...parsed.data, levels: scale?.levels ?? [] });
}
```

Add to `src/i18n/messages/library.tr.json`:

```json
  "libAnchorAi": {
    "suggest": "AI ile çapa öner",
    "working": "Öneriler hazırlanıyor, genelde 10-20 sn.",
    "label": "AI önerisi. Alanlara yazmadan hiçbir şey değişmez; kaydetmeden önce oku ve düzelt.",
    "apply": "Önerileri alanlara yaz",
    "dismiss": "Kapat",
    "failed": "Öneri üretilemedi. Çapaları kendin yazabilirsin.",
    "unconfigured": "AI bağlı değil. Çapaları kendin yazabilirsin.",
    "applied": "Öneriler alanlara yazıldı. Kaydetmeden önce oku ve düzelt.",
    "needName": "Önce yetkinliğe bir ad ver."
  }
```

and to `library.en.json`:

```json
  "libAnchorAi": {
    "suggest": "Suggest anchors with AI",
    "working": "Preparing suggestions, usually 10-20 s.",
    "label": "AI suggestion. Nothing changes until you copy it into the fields; read and correct it before saving.",
    "apply": "Copy suggestions into the fields",
    "dismiss": "Close",
    "failed": "No suggestion could be made. You can write the anchors yourself.",
    "unconfigured": "AI is not connected. You can write the anchors yourself.",
    "applied": "Suggestions copied into the fields. Read and correct them before saving.",
    "needName": "Give the competency a name first."
  }
```

Create `src/components/library/anchor-assist.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { hasText } from "@/lib/library/anchors";
import type { AnchorProposal } from "@/lib/library/anchor-draft";
import { draftAnchorsAction } from "@/app/(manager)/library/actions";

type State = { kind: "idle" } | { kind: "ready"; anchors: AnchorProposal } | { kind: "failed"; unconfigured: boolean } | { kind: "applied" };

/**
 * "AI ile çapa öner" (HIRING-UX 5.10): a proposal card. Copying it into the
 * fields is a click, saving is another; the AI never writes the competency.
 */
export function AnchorAssist({
  competencyId,
  name,
  description,
  onApply,
}: {
  competencyId: string;
  name: I18nText;
  description: I18nText;
  onApply: (anchors: AnchorProposal) => void;
}) {
  const t = useMT("libAnchorAi");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pending, start] = useTransition();
  const reason = hasText(name) ? null : t("needName");

  return (
    <div className="w-full space-y-3 md:w-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          disabled={pending || reason !== null}
          disabledReason={reason ?? undefined}
          onClick={() =>
            start(async () => {
              const result = await draftAnchorsAction(competencyId, { name, description });
              setState(result.status === "OK" ? { kind: "ready", anchors: result.anchors } : { kind: "failed", unconfigured: result.status === "UNCONFIGURED" });
            })
          }
        >
          {t("suggest")}
        </Button>
        {reason ? <DisabledReason>{reason}</DisabledReason> : null}
      </div>
      {pending ? (
        <Card className="space-y-2 p-card" aria-busy>
          <p className="text-[13px] text-muted">{t("working")}</p>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </Card>
      ) : null}
      {state.kind === "failed" ? <p className="text-[13px] text-muted">{state.unconfigured ? t("unconfigured") : t("failed")}</p> : null}
      {state.kind === "applied" ? <p role="status" className="text-[13px] text-muted">{t("applied")}</p> : null}
      {state.kind === "ready" ? (
        <Card className="space-y-3 p-card">
          <p className="text-[13px] text-muted">{t("label")}</p>
          <ol className="space-y-2">
            {([1, 2, 3, 4, 5] as const).map((level) => (
              <li key={level} className="text-[14px] text-ink">
                <span className="tnum mr-2 font-semibold">{level}</span>
                {state.anchors[level].tr || "-"}
                <span className="block text-[13px] text-muted">{state.anchors[level].en}</span>
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onApply(state.anchors);
                setState({ kind: "applied" });
              }}
            >
              {t("apply")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setState({ kind: "idle" })}>
              {t("dismiss")}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
```

In `src/components/library/competency-form.tsx` import `AnchorAssist` and replace the comment `{/* Task 7: the AI anchor assist goes here. */}` with:

```tsx
          {canWrite ? (
            <AnchorAssist
              competencyId={id}
              name={value.name}
              description={value.description}
              onApply={(anchors) => setValue((v) => ({ ...v, anchors: { ...v.anchors, ...anchors } }))}
            />
          ) : null}
```

- [ ] **Step 7: Gates, build and a live check**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Then in Chrome (dev server on `kademe_platform`): on a competency, "AI ile çapa öner" shows the waiting card, then a proposal card labelled as AI; nothing in the fields changes until "Önerileri alanlara yaz"; after copying, nothing is stored until "Kaydet" (reload discards it). Check the run was logged:
```bash
docker exec kademe-db psql -U kademe -d kademe_platform -Atc "select purpose, model, error is null from ai_runs where purpose = 'ANCHOR_DRAFT' order by at desc limit 3"
```
Expected: at least one `ANCHOR_DRAFT|gemini-...|t` row. If no AI key is configured in `.env`, the card says "AI bağlı değil..." and the row check is skipped; record that in the task report (not verified live).

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai-json.ts src/lib/ai-json.test.ts src/lib/library/anchor-draft.ts src/lib/library/anchor-draft.test.ts src/server/anchor-draft-job.ts "src/app/(manager)/library/actions.ts" src/components/library/anchor-assist.tsx src/components/library/competency-form.tsx src/i18n/messages/library.tr.json src/i18n/messages/library.en.json
git commit -m "Propose competency anchors with AI" -m "ANCHOR_DRAFT asks Gemini for observable 1-5 anchors in Turkish and English, validates them, repairs once and logs every call in ai_runs. The proposal is a card: copying it into the form and saving are two separate deliberate clicks. Shared helpers parse model JSON and strip the em dash." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Hiring schema and migration 0005

**Files:**
- Modify: `src/db/schema/enums.ts`
- Create: `src/db/schema/hiring.ts`
- Modify: `src/db/schema/index.ts`
- Create (generated): `drizzle/migrations/0005_hiring_openings.sql`, `meta/0005_snapshot.json`, `meta/_journal.json` (modified)
- Test: `src/db/migrations-sql.test.ts`

**Interfaces:**
- Produces enums `hiringOpeningStatus` (`DRAFT`, `OPEN`, `CLOSED`), `hiringVersionStatus` (`DRAFT`, `PUBLISHED`), `hiringProctorLevel` (`OFF`, `BASIC`, `STANDARD`, `STRICT`), `hiringActivityType` (`VIDEO`, `AUDIO`, `LONG_TEXT`, `SHORT_TEXT`, `SINGLE_CHOICE`, `MULTI_CHOICE`, `FILE_UPLOAD`), `hiringStageTimeout` (`AUTO_SUBMIT`, `AUTO_CLOSE`, `ALLOW_GRACE`, `ALLOW_LATE`), `hiringMemberRole` (`EVALUATOR`); `ai_purpose` gains `HIRING_DRAFT`, `QUESTION_CHECK`.
- Produces tables `hiringOpenings`, `hiringOpeningMembers`, `hiringVersions`, `hiringStages`, `hiringActivities`, `hiringActivityCompetencies`, `hiringWeightSets`, `hiringWeights`.
- Produces types `HiringActivityConfig`, `AnswerExamples`, `ScorecardSnapshot`, `HiringLocale` exported from `@/db/schema`.

- [ ] **Step 1: Write the failing static test**

Append to `src/db/migrations-sql.test.ts`:

```ts
describe("0005_hiring_openings", () => {
  const sql = read("0005_hiring_openings");

  it.each([
    "hiring_openings",
    "hiring_opening_members",
    "hiring_versions",
    "hiring_stages",
    "hiring_activities",
    "hiring_activity_competencies",
    "hiring_weight_sets",
    "hiring_weights",
  ])("creates %s", (table) => {
    expect(sql).toContain(`CREATE TABLE "${table}"`);
  });

  it("adds the two hiring AI purposes in place, and no purpose that scores or ranks", () => {
    expect(sql).toContain(`ALTER TYPE "public"."ai_purpose" ADD VALUE 'HIRING_DRAFT';`);
    expect(sql).toContain(`ALTER TYPE "public"."ai_purpose" ADD VALUE 'QUESTION_CHECK';`);
    expect(sql).not.toMatch(/ADD VALUE '[A-Z_]*(SCOR|RANK|DECI|EMOTION|PERSONAL)[A-Z_]*'/);
  });

  it("keeps the database rules of spec 2.2", () => {
    expect(sql).toMatch(/CONSTRAINT "hiring_at_most_two_competencies" CHECK \("hiring_activity_competencies"\."order_index" IN \(0, 1\)\)/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "hiring_activity_competency_slot"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "one_draft_per_opening" ON "hiring_versions" USING btree \("opening_id"\) WHERE status = 'DRAFT'/);
    expect(sql).toMatch(/CONSTRAINT "hiring_published_has_scorecard"/);
  });

  it("only adds", () => {
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN|TYPE)/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/db/migrations-sql.test.ts`
Expected: FAIL with `ENOENT ... 0005_hiring_openings.sql`.

- [ ] **Step 3: Add the enums**

In `src/db/schema/enums.ts`, append `"HIRING_DRAFT", // a hiring assessment proposed from a job ad; a person accepts each card` and `"QUESTION_CHECK", // flags leading, double, vague or protected-trait questions; suggestions only` to `aiPurpose` (after `ANCHOR_DRAFT`), and append:

```ts
/** Hiring (hiring solution design 2). A published version is frozen by triggers (migration 0006). */
export const hiringOpeningStatus = pgEnum("hiring_opening_status", ["DRAFT", "OPEN", "CLOSED"]);
export const hiringVersionStatus = pgEnum("hiring_version_status", ["DRAFT", "PUBLISHED"]);
export const hiringProctorLevel = pgEnum("hiring_proctor_level", ["OFF", "BASIC", "STANDARD", "STRICT"]);
export const hiringActivityType = pgEnum("hiring_activity_type", [
  "VIDEO",
  "AUDIO",
  "LONG_TEXT",
  "SHORT_TEXT",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "FILE_UPLOAD",
]);
export const hiringStageTimeout = pgEnum("hiring_stage_timeout", ["AUTO_SUBMIT", "AUTO_CLOSE", "ALLOW_GRACE", "ALLOW_LATE"]);
export const hiringMemberRole = pgEnum("hiring_member_role", ["EVALUATOR"]);
```

- [ ] **Step 4: Write the hiring schema**

Create `src/db/schema/hiring.ts`:

```ts
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./org";
import { consentTexts } from "./compliance";
import { competencies, positions } from "./library";
import {
  hiringActivityType,
  hiringMemberRole,
  hiringOpeningStatus,
  hiringProctorLevel,
  hiringStageTimeout,
  hiringVersionStatus,
  locale,
} from "./enums";
import type { I18nText } from "./types";

/**
 * Hiring solution tables (hiring solution design 2). Core tables never refer
 * to these; these refer to the core and to the organisation library.
 */

export type HiringLocale = "tr" | "en";

/** Per-question settings; only the keys of the question's type are set. */
export type HiringActivityConfig = {
  /** SINGLE_CHOICE / MULTI_CHOICE. `correct` never reaches a candidate. */
  choices?: Array<{ id: string; label: I18nText; correct?: boolean }>;
  /** LONG_TEXT / SHORT_TEXT */
  minChars?: number;
  maxChars?: number;
  /** FILE_UPLOAD */
  acceptedMimeTypes?: string[];
  maxFileBytes?: number;
  /** VIDEO / AUDIO: a written answer the candidate may choose instead (HIRING-UX A7). */
  textAlternativeEnabled?: boolean;
};

/** "İyi cevap örnekleri" for levels 1, 3 and 5 of this question (HIRING-UX 3.1), team language. */
export type AnswerExamples = { 1?: string; 3?: string; 5?: string };

/** Copied into the version at publish and never changed again (hiring solution design 2.3). */
export type ScorecardSnapshot = {
  scale: { min: number; max: number; levels: Array<{ value: number; label: I18nText }> };
  competencies: Array<{
    id: string;
    name: I18nText;
    anchors: Record<number, I18nText>;
    tags: Array<{ id: string; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText }>;
    weight: number;
  }>;
  weightsEnabled: boolean;
};

const emptyText: I18nText = { tr: "", en: "" };

/** A hiring process for one position, with a start and an end (HIRING-UX 4.2). */
export const hiringOpenings = pgTable(
  "hiring_openings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    status: hiringOpeningStatus("status").notNull().default("DRAFT"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    decisionMakerId: uuid("decision_maker_id").references(() => users.id, { onDelete: "set null" }),
    backupDecisionMakerId: uuid("backup_decision_maker_id").references(() => users.id, { onDelete: "set null" }),
    blindMode: boolean("blind_mode").notNull().default(false),
    /** Submitted evaluations a decision needs without an override (HIRING-UX 3.10). */
    minEvaluations: integer("min_evaluations").notNull().default(2),
    /** The dated promise on the candidate's finish screen. */
    feedbackDays: integer("feedback_days").notNull().default(7),
    candidateContactEmail: text("candidate_contact_email"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("hiring_openings_org_status_idx").on(t.orgId, t.status),
    index("hiring_openings_position_idx").on(t.positionId),
    check("hiring_min_evaluations", sql`${t.minEvaluations} BETWEEN 1 AND 5`),
    check("hiring_feedback_days", sql`${t.feedbackDays} BETWEEN 1 AND 60`),
  ],
);

/** The opening's default panel; copied onto each invitation in plan 2. */
export const hiringOpeningMembers = pgTable(
  "hiring_opening_members",
  {
    openingId: uuid("opening_id")
      .notNull()
      .references(() => hiringOpenings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: hiringMemberRole("role").notNull().default("EVALUATOR"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.openingId, t.userId] }), index("hiring_opening_members_user_idx").on(t.userId)],
);

/** One assessment per opening, versioned automatically: publish = lock, edit = new draft. */
export const hiringVersions = pgTable(
  "hiring_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    openingId: uuid("opening_id")
      .notNull()
      .references(() => hiringOpenings.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: hiringVersionStatus("status").notNull().default("DRAFT"),
    defaultLocale: locale("default_locale").notNull().default("tr"),
    localeSet: jsonb("locale_set").$type<HiringLocale[]>().notNull().default(["tr"]),
    introTitle: jsonb("intro_title").$type<I18nText>(),
    introBody: jsonb("intro_body").$type<I18nText>(),
    consentTextId: uuid("consent_text_id").references(() => consentTexts.id, { onDelete: "restrict" }),
    proctorLevel: hiringProctorLevel("proctor_level").notNull().default("BASIC"),
    practiceEnabled: boolean("practice_enabled").notNull().default(true),
    scorecard: jsonb("scorecard").$type<ScorecardSnapshot>(),
    /** Draft only: weighting on or off, and the percentages per competency id. */
    weightsEnabled: boolean("weights_enabled").notNull().default(false),
    draftWeights: jsonb("draft_weights").$type<Record<string, number>>(),
    previewedAt: timestamp("previewed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("hiring_version_number").on(t.openingId, t.versionNumber),
    uniqueIndex("one_draft_per_opening").on(t.openingId).where(sql`status = 'DRAFT'`),
    check("hiring_published_has_scorecard", sql`${t.status} <> 'PUBLISHED' OR ${t.scorecard} IS NOT NULL`),
  ],
);

export const hiringStages = pgTable(
  "hiring_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => hiringVersions.id, { onDelete: "cascade" }),
    /** Plain index, renumbered 0..n-1 by the server after every change. */
    orderIndex: integer("order_index").notNull(),
    name: jsonb("name").$type<I18nText>().notNull(),
    description: jsonb("description").$type<I18nText>().notNull().default(emptyText),
    /** Team only. */
    internalPurpose: text("internal_purpose"),
    durationSeconds: integer("duration_seconds").notNull().default(600),
    graceSeconds: integer("grace_seconds").notNull().default(0),
    onTimeout: hiringStageTimeout("on_timeout").notNull().default("AUTO_SUBMIT"),
    backNavigation: boolean("back_navigation").notNull().default(false),
  },
  (t) => [
    index("hiring_stages_version_idx").on(t.versionId, t.orderIndex),
    check("hiring_stage_duration", sql`${t.durationSeconds} BETWEEN 60 AND 7200`),
  ],
);

export const hiringActivities = pgTable(
  "hiring_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => hiringStages.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    type: hiringActivityType("type").notNull(),
    required: boolean("required").notNull().default(true),
    /* shown to the candidate */
    prompt: jsonb("prompt").$type<I18nText>().notNull(),
    note: jsonb("note").$type<I18nText>().notNull().default(emptyText),
    /* team only: never selected for a candidate (candidate view whitelist) */
    internalQuestion: text("internal_question"),
    expectedBehaviours: jsonb("expected_behaviours").$type<string[]>().notNull().default([]),
    redFlags: jsonb("red_flags").$type<string[]>().notNull().default([]),
    managerNotes: text("manager_notes"),
    answerExamples: jsonb("answer_examples").$type<AnswerExamples>().notNull().default({}),
    /* timing */
    thinkSeconds: integer("think_seconds").notNull().default(60),
    /** True: when think time ends, recording does not start by itself (HIRING-UX A5). */
    flexibleThink: boolean("flexible_think").notNull().default(true),
    answerSeconds: integer("answer_seconds"),
    /** 2 = one retake (HIRING-UX 0 #10). */
    maxTakes: integer("max_takes").notNull().default(2),
    config: jsonb("config").$type<HiringActivityConfig>().notNull().default({}),
  },
  (t) => [
    index("hiring_activities_stage_idx").on(t.stageId, t.orderIndex),
    check("hiring_activity_takes", sql`${t.maxTakes} BETWEEN 1 AND 5`),
    check("hiring_activity_think", sql`${t.thinkSeconds} BETWEEN 0 AND 600`),
  ],
);

/** The 1-2 competencies a question measures. Choice questions measure none. */
export const hiringActivityCompetencies = pgTable(
  "hiring_activity_competencies",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => hiringActivities.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.competencyId] }),
    uniqueIndex("hiring_activity_competency_slot").on(t.activityId, t.orderIndex),
    index("hiring_activity_competencies_competency_idx").on(t.competencyId),
    check("hiring_at_most_two_competencies", sql`${t.orderIndex} IN (0, 1)`),
  ],
);

/**
 * Weights after publishing (old rule kept): a change is a new set with a
 * reason; scores keep the set they were computed with (HIRING-UX R10). The
 * first set is written at publish from the scorecard.
 */
export const hiringWeightSets = pgTable(
  "hiring_weight_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => hiringVersions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    /** Active = weighting is on with this set. No active set = plain average. */
    isActive: boolean("is_active").notNull().default(false),
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("hiring_weight_sets_version_idx").on(t.versionId),
    uniqueIndex("one_active_weight_set").on(t.versionId).where(sql`is_active`),
  ],
);

export const hiringWeights = pgTable(
  "hiring_weights",
  {
    weightSetId: uuid("weight_set_id")
      .notNull()
      .references(() => hiringWeightSets.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "restrict" }),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.weightSetId, t.competencyId] }),
    check("hiring_weight_percentage", sql`${t.percentage} BETWEEN 0 AND 100`),
  ],
);
```

Add `export * from "./hiring";` to `src/db/schema/index.ts` after `export * from "./library";`.

- [ ] **Step 5: Generate, review, prove, apply**

```bash
pnpm db:generate --name hiring_openings
```
Read `drizzle/migrations/0005_hiring_openings.sql`. Expected: six `CREATE TYPE`, two `ALTER TYPE "public"."ai_purpose" ADD VALUE`, eight `CREATE TABLE`, foreign keys, indexes and checks as above, no `DROP`. Same `ai_purpose` fallback as Task 2 Step 5 if drizzle-kit recreates the enum. Then run exactly the fingerprint and apply commands of Task 2 Step 6. Expected: `IDENTICAL`, `migrations applied`.

- [ ] **Step 6: Tests, gates, exam**

```bash
pnpm exec vitest run src/db/migrations-sql.test.ts src/db/migration-files.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema/enums.ts src/db/schema/hiring.ts src/db/schema/index.ts drizzle/migrations src/db/migrations-sql.test.ts
git commit -m "Add the hiring opening and assessment tables" -m "Migration 0005 adds openings, their team, versioned assessments with stages, questions and the competencies each question measures (at most two, enforced by a check and a unique slot), and weight sets for after publishing, plus the HIRING_DRAFT and QUESTION_CHECK AI purposes. One draft per opening and a scorecard on every published version are database rules." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Freeze published versions in the database (migration 0006)

**Files:**
- Create: `scripts/verify-hiring-immutability.ts`
- Modify: `package.json` (script `verify:hiring-immutability`)
- Create (custom, hand-written): `drizzle/migrations/0006_hiring_immutability.sql`, `meta/0006_snapshot.json`, `meta/_journal.json` (modified)
- Test: `src/db/migrations-sql.test.ts`

**Interfaces:**
- Produces database behaviour: UPDATE or DELETE of a `PUBLISHED` `hiring_versions` row, and INSERT, UPDATE or DELETE of any `hiring_stages`, `hiring_activities` or `hiring_activity_competencies` row that belongs (before or after the change) to a published version, raises SQLSTATE `23514`. Publishing (`DRAFT` to `PUBLISHED`) is allowed. `hiring_weight_sets` and `hiring_weights` stay writable.
- Produces: `pnpm verify:hiring-immutability` (only against a database whose name ends in `_check`).

- [ ] **Step 1: Write the failing behaviour script**

Create `scripts/verify-hiring-immutability.ts`:

```ts
/**
 * Proves the hiring immutability triggers (migration 0006) on a real database.
 * It writes rows, so it refuses any database whose name does not end in
 * "_check". Build one with every migration applied, run, drop it.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm verify:hiring-immutability
 */
import "dotenv/config";
import postgres from "postgres";

let failed = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => {
  failed += 1;
  console.log(`  FAIL ${m}`);
};

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
  if (!url.pathname.endsWith("_check")) {
    console.error(`Refusing: ${url.pathname} is not a throw-away *_check database.`);
    process.exit(2);
  }
  const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const json = (v: unknown) => sql.json(v as Parameters<typeof sql.json>[0]);
  const text = { tr: "Metin", en: "Text" };

  /** 23514 = check_violation (triggers and CHECKs), 23505 = unique_violation. */
  async function refused(label: string, run: () => Promise<unknown>, expected = "23514") {
    try {
      await run();
      bad(`${label}: was allowed`);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === expected) ok(`${label}: refused (${expected})`);
      else bad(`${label}: ${code} ${(error as Error).message}`);
    }
  }
  async function allowed(label: string, run: () => Promise<unknown>) {
    try {
      await run();
      ok(label);
    } catch (error) {
      bad(`${label}: ${(error as Error).message}`);
    }
  }

  const [org] = await sql`insert into organizations (name) values ('Immutability check') returning id`;
  const [scale] = await sql`insert into rating_scales (org_id, name, is_default) values (${org.id}, 'Default', true) returning id`;
  const [c1] = await sql`insert into competencies (org_id, name, scale_id) values (${org.id}, ${json(text)}, ${scale.id}) returning id`;
  const [c2] = await sql`insert into competencies (org_id, name, scale_id) values (${org.id}, ${json(text)}, ${scale.id}) returning id`;
  const [c3] = await sql`insert into competencies (org_id, name, scale_id) values (${org.id}, ${json(text)}, ${scale.id}) returning id`;
  const [position] = await sql`insert into positions (org_id, name) values (${org.id}, 'Check') returning id`;
  const [opening] = await sql`insert into hiring_openings (org_id, position_id, name) values (${org.id}, ${position.id}, 'Check') returning id`;
  const [v1] = await sql`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening.id}, 1) returning id`;
  const [stage] = await sql`insert into hiring_stages (version_id, order_index, name) values (${v1.id}, 0, ${json(text)}) returning id`;
  const [act] = await sql`insert into hiring_activities (stage_id, order_index, type, prompt) values (${stage.id}, 0, 'VIDEO', ${json(text)}) returning id`;

  console.log("\nA draft version is editable");
  await allowed("add a first competency", () => sql`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act.id}, ${c1.id}, 0)`);
  await allowed("add a second competency", () => sql`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act.id}, ${c2.id}, 1)`);
  await refused("a third competency on one question", () => sql`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act.id}, ${c3.id}, 2)`);
  await allowed("remove the second competency", () => sql`delete from hiring_activity_competencies where activity_id = ${act.id} and competency_id = ${c2.id}`);
  await allowed("update a draft stage", () => sql`update hiring_stages set duration_seconds = 700 where id = ${stage.id}`);
  await allowed("update a draft question", () => sql`update hiring_activities set think_seconds = 30 where id = ${act.id}`);
  await refused("publish without a scorecard", () => sql`update hiring_versions set status = 'PUBLISHED' where id = ${v1.id}`);

  console.log("\nPublishing is the one legal change");
  const scorecard = { scale: { min: 1, max: 5, levels: [] }, competencies: [], weightsEnabled: false };
  await allowed("publish v1", () => sql`update hiring_versions set status = 'PUBLISHED', published_at = now(), scorecard = ${json(scorecard)} where id = ${v1.id}`);

  console.log("\nA published version and everything under it is frozen");
  await refused("update the published version", () => sql`update hiring_versions set intro_title = ${json(text)} where id = ${v1.id}`);
  await refused("delete the published version", () => sql`delete from hiring_versions where id = ${v1.id}`);
  await refused("update a published stage", () => sql`update hiring_stages set duration_seconds = 900 where id = ${stage.id}`);
  await refused("delete a published stage", () => sql`delete from hiring_stages where id = ${stage.id}`);
  await refused("add a stage to a published version", () => sql`insert into hiring_stages (version_id, order_index, name) values (${v1.id}, 1, ${json(text)})`);
  await refused("update a published question", () => sql`update hiring_activities set think_seconds = 90 where id = ${act.id}`);
  await refused("delete a published question", () => sql`delete from hiring_activities where id = ${act.id}`);
  await refused("add a question to a published stage", () => sql`insert into hiring_activities (stage_id, order_index, type, prompt) values (${stage.id}, 1, 'VIDEO', ${json(text)})`);
  await refused("add a competency to a published question", () => sql`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act.id}, ${c2.id}, 1)`);
  await refused("remove a competency from a published question", () => sql`delete from hiring_activity_competencies where activity_id = ${act.id}`);

  console.log("\nMoving draft rows into a published version is refused too");
  const [v2] = await sql`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening.id}, 2) returning id`;
  const [stage2] = await sql`insert into hiring_stages (version_id, order_index, name) values (${v2.id}, 0, ${json(text)}) returning id`;
  const [act2] = await sql`insert into hiring_activities (stage_id, order_index, type, prompt) values (${stage2.id}, 0, 'VIDEO', ${json(text)}) returning id`;
  await refused("move a draft stage into the published version", () => sql`update hiring_stages set version_id = ${v1.id} where id = ${stage2.id}`);
  await refused("move a draft question into a published stage", () => sql`update hiring_activities set stage_id = ${stage.id} where id = ${act2.id}`);
  await allowed("edit the new draft", () => sql`update hiring_stages set duration_seconds = 800 where id = ${stage2.id}`);
  await refused(
    "a second draft for the same opening",
    () => sql`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening.id}, 3)`,
    "23505",
  );

  console.log("\nWeight sets stay writable after publishing (HIRING-UX R10)");
  await allowed("add a weight set to the published version", () => sql`insert into hiring_weight_sets (version_id, label, reason) values (${v1.id}, 'v1-b', 'check')`);

  await sql.end();
  console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add to `package.json` scripts: `"verify:hiring-immutability": "tsx scripts/verify-hiring-immutability.ts",`.

- [ ] **Step 2: Run it on a database without the triggers to verify it fails**

```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_hiring_check" -c "create database kademe_hiring_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm verify:hiring-immutability; echo "exit $?"
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_hiring_check"
```
Expected: the draft section and "publish v1" pass (the two-competency check and the scorecard check come from migration 0005); the lines under "A published version ... is frozen" print `FAIL ...: was allowed` (once the unguarded delete has removed v1, later lines may fail with a foreign key or "0 rows" instead, which is still a FAIL); the second-draft line passes (unique index from 0005); the script ends with `exit 1`.

- [ ] **Step 3: Write the static test**

Append to `src/db/migrations-sql.test.ts`:

```ts
describe("0006_hiring_immutability", () => {
  const sql = read("0006_hiring_immutability");

  it.each([
    ["hiring_versions", "BEFORE UPDATE OR DELETE"],
    ["hiring_stages", "BEFORE INSERT OR UPDATE OR DELETE"],
    ["hiring_activities", "BEFORE INSERT OR UPDATE OR DELETE"],
    ["hiring_activity_competencies", "BEFORE INSERT OR UPDATE OR DELETE"],
  ])("guards %s", (table, when) => {
    expect(sql).toMatch(new RegExp(`CREATE TRIGGER \\w+ ${when} ON "${table}" FOR EACH ROW`));
  });

  it("refuses with a check violation, never by silently skipping the row", () => {
    expect(sql).toContain("ERRCODE = '23514'");
    expect(sql).not.toMatch(/RETURN NULL/);
  });

  it("checks both the old and the new parent, so rows cannot be moved into a published version", () => {
    expect(sql.match(/TG_OP <> 'INSERT'/g)?.length).toBe(3);
    expect(sql.match(/TG_OP <> 'DELETE'/g)?.length).toBe(3);
  });

  it("leaves weight sets writable after publishing", () => {
    expect(sql).not.toMatch(/ON "hiring_weight/);
  });

  it("sends one statement per chunk (the migrator prepares each chunk)", () => {
    for (const chunk of sql.split("--> statement-breakpoint")) {
      const outside = chunk.replace(/\$\$[\s\S]*?\$\$/g, "").replace(/--.*$/gm, "");
      expect((outside.match(/;/g) ?? []).length, chunk.slice(0, 80)).toBeLessThanOrEqual(1);
    }
  });
});
```

Run: `pnpm exec vitest run src/db/migrations-sql.test.ts` - Expected: FAIL with `ENOENT ... 0006_hiring_immutability.sql`.

- [ ] **Step 4: Write the migration**

```bash
pnpm db:generate --custom --name hiring_immutability
```
This creates an empty `drizzle/migrations/0006_hiring_immutability.sql` and its snapshot. Replace the file's content with:

```sql
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
```

(Deleting an organisation still cascades through openings into a published version and is refused by these triggers; the old product had the same property and nothing deletes organisations. `TRUNCATE ... CASCADE` in `src/db/seed.ts` fires no row triggers.)

- [ ] **Step 5: Verify behaviour, fingerprint and apply**

```bash
pnpm exec vitest run src/db/migrations-sql.test.ts src/db/migration-files.test.ts
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_hiring_check" -c "create database kademe_hiring_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm verify:hiring-immutability; echo "exit $?"
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_hiring_check"
```
Expected: static tests PASS; every script line `ok`, `all checks passed`, `exit 0`. Then run the fingerprint commands of Task 2 Step 6 (triggers are not part of the fingerprint; it must still print `IDENTICAL`) and apply to `kademe_platform`.

- [ ] **Step 6: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
git add scripts/verify-hiring-immutability.ts package.json drizzle/migrations src/db/migrations-sql.test.ts
git commit -m "Freeze published hiring versions with database triggers" -m "Migration 0006 (hand-written) refuses any change to a published version and to the stages, questions and competency mappings under it, checking both the old and the new parent so draft rows cannot be moved in. Publishing itself and later weight sets stay allowed. verify:hiring-immutability proves it on a throw-away database." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Hiring rules (gate, weights, scorecard, candidate view, access) and the solution boundary

**Files:**
- Create: `src/solutions/hiring/rules/content.ts`, `content.test.ts`, `test-fixtures.ts`
- Create: `src/solutions/hiring/rules/gate.ts`, `gate.test.ts`
- Create: `src/solutions/hiring/rules/weights.ts`, `weights.test.ts`
- Create: `src/solutions/hiring/rules/scorecard.ts`, `scorecard.test.ts`
- Create: `src/solutions/hiring/rules/candidate-view.ts`, `candidate-view.test.ts`
- Create: `src/solutions/hiring/rules/access.ts`, `access.test.ts`
- Create: `src/solutions/hiring/rules/versions.ts`, `versions.test.ts`
- Modify: `eslint.config.mjs`, `src/solutions/boundary.test.ts`

**Interfaces:**
- Produces in `rules/content`: `ACTIVITY_TYPES`, `type ActivityType`, `type StageTimeout`, `isChoice(t)`, `isRecorded(t)`, `MAX_COMPETENCIES_PER_ACTIVITY = 2`, `type ContentActivity`, `type ContentStage`, `type VersionContent`, `type CompetencyFacts`, `usedCompetencyIds(content): string[]`, `totalSeconds(content): number`.
- Produces in `rules/gate`: `type PublishProblem`, `publishProblems(content: VersionContent, facts: ReadonlyMap<string, CompetencyFacts>): PublishProblem[]`, `STRUCTURE_PROBLEMS`, `ANCHOR_PROBLEMS`.
- Produces in `rules/weights`: `evenSplit(n): number[]`, `toPercentages(raw: number[]): number[]`, `defaultWeights(used: string[], profile: Array<{ competencyId: string; weight: number }>): Record<string, number>`, `weightsTotal(weights, used): number`, `weightsProblem(weights, used): { total: number } | null`.
- Produces in `rules/scorecard`: `buildScorecard(input: { content: VersionContent; facts: ReadonlyMap<string, CompetencyFacts>; scale: ScorecardSnapshot["scale"]; profile: Array<{ competencyId: string; weight: number }> }): ScorecardSnapshot`.
- Produces in `rules/candidate-view`: `type CandidateVersion`, `type CandidateStage`, `type CandidateActivity`, `toCandidateVersion(content: { stages: ContentStage[] }): CandidateVersion`.
- Produces in `rules/access`: `type Viewer`, `type OpeningPeople`, `openingAccess(viewer, people): { view: boolean; edit: boolean }`, `canDecide(role): boolean`.
- Produces in `rules/versions`: `type VersionSummary = { id: string; number: number; status: "DRAFT" | "PUBLISHED"; publishedAt: Date | null; previewedAt: Date | null }`, `workingVersions(list): { draft: VersionSummary | null; live: VersionSummary | null }`.

- [ ] **Step 1: Write the content types and fixtures**

Create `src/solutions/hiring/rules/content.ts`:

```ts
import type { AnswerExamples, HiringActivityConfig } from "@/db/schema";
import type { I18nText } from "@/db/schema/types";
import type { Locale } from "@/i18n/locale";

/**
 * The shape of one hiring assessment version as the rules see it. Pure: the
 * server loads it (server/content.ts), the rules judge it, the screens show it.
 */
export const ACTIVITY_TYPES = ["VIDEO", "AUDIO", "LONG_TEXT", "SHORT_TEXT", "SINGLE_CHOICE", "MULTI_CHOICE", "FILE_UPLOAD"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type StageTimeout = "AUTO_SUBMIT" | "AUTO_CLOSE" | "ALLOW_GRACE" | "ALLOW_LATE";

/** Choice questions are auto-scored into the separate knowledge score and measure no competency. */
export const isChoice = (type: ActivityType) => type === "SINGLE_CHOICE" || type === "MULTI_CHOICE";
export const isRecorded = (type: ActivityType) => type === "VIDEO" || type === "AUDIO";
export const MAX_COMPETENCIES_PER_ACTIVITY = 2;

export type ContentActivity = {
  id: string;
  orderIndex: number;
  type: ActivityType;
  required: boolean;
  prompt: I18nText;
  note: I18nText;
  internalQuestion: string | null;
  expectedBehaviours: string[];
  redFlags: string[];
  managerNotes: string | null;
  answerExamples: AnswerExamples;
  thinkSeconds: number;
  flexibleThink: boolean;
  answerSeconds: number | null;
  maxTakes: number;
  config: HiringActivityConfig;
  competencyIds: string[];
};

export type ContentStage = {
  id: string;
  orderIndex: number;
  name: I18nText;
  description: I18nText;
  internalPurpose: string | null;
  durationSeconds: number;
  graceSeconds: number;
  onTimeout: StageTimeout;
  backNavigation: boolean;
  activities: ContentActivity[];
};

export type VersionContent = {
  id: string;
  number: number;
  status: "DRAFT" | "PUBLISHED";
  defaultLocale: Locale;
  localeSet: Locale[];
  weightsEnabled: boolean;
  draftWeights: Record<string, number> | null;
  previewedAt: Date | null;
  stages: ContentStage[];
};

/** What the rules need to know about a library competency. */
export type CompetencyFacts = {
  id: string;
  name: I18nText;
  archived: boolean;
  anchors: Partial<Record<number, I18nText>>;
  tags: Array<{ id: string; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText; archived: boolean }>;
};

/** Competencies the questions measure, in the order they first appear. Choice questions measure none. */
export function usedCompetencyIds(content: { stages: ContentStage[] }): string[] {
  const seen: string[] = [];
  for (const stage of content.stages) {
    for (const activity of stage.activities) {
      if (isChoice(activity.type)) continue;
      for (const id of activity.competencyIds) if (!seen.includes(id)) seen.push(id);
    }
  }
  return seen;
}

export function totalSeconds(content: { stages: ContentStage[] }): number {
  return content.stages.reduce((sum, stage) => sum + stage.durationSeconds, 0);
}
```

Create `src/solutions/hiring/rules/test-fixtures.ts` (used by the rule tests only):

```ts
import type { CompetencyFacts, ContentActivity, ContentStage, VersionContent } from "./content";

export function activity(id: string, over: Partial<ContentActivity> = {}): ContentActivity {
  return {
    id,
    orderIndex: 0,
    type: "VIDEO",
    required: true,
    prompt: { tr: "Bir örnek anlat.", en: "" },
    note: { tr: "", en: "" },
    internalQuestion: null,
    expectedBehaviours: [],
    redFlags: [],
    managerNotes: null,
    answerExamples: {},
    thinkSeconds: 60,
    flexibleThink: true,
    answerSeconds: 120,
    maxTakes: 2,
    config: {},
    competencyIds: [],
    ...over,
  };
}

export function stage(id: string, activities: ContentActivity[], over: Partial<ContentStage> = {}): ContentStage {
  return {
    id,
    orderIndex: 0,
    name: { tr: "Aşama", en: "" },
    description: { tr: "", en: "" },
    internalPurpose: null,
    durationSeconds: 600,
    graceSeconds: 0,
    onTimeout: "AUTO_SUBMIT",
    backNavigation: false,
    activities,
    ...over,
  };
}

export function content(stages: ContentStage[], over: Partial<VersionContent> = {}): VersionContent {
  return { id: "v1", number: 1, status: "DRAFT", defaultLocale: "tr", localeSet: ["tr"], weightsEnabled: false, draftWeights: null, previewedAt: null, stages, ...over };
}

export function facts(id: string, over: Partial<CompetencyFacts> = {}): CompetencyFacts {
  return {
    id,
    name: { tr: `Yetkinlik ${id}`, en: `Competency ${id}` },
    archived: false,
    anchors: { 1: { tr: "bir", en: "one" }, 3: { tr: "üç", en: "three" }, 5: { tr: "beş", en: "five" } },
    tags: [],
    ...over,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/solutions/hiring/rules/content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hiringActivityType } from "@/db/schema/enums";
import { ACTIVITY_TYPES, usedCompetencyIds } from "./content";
import { activity, stage } from "./test-fixtures";

describe("hiring content", () => {
  it("knows exactly the database's activity types", () => {
    expect([...ACTIVITY_TYPES]).toEqual([...hiringActivityType.enumValues]);
  });

  it("lists measured competencies in first-appearance order and ignores choice questions", () => {
    const stages = [
      stage("s1", [activity("a1", { competencyIds: ["c2"] }), activity("q", { type: "MULTI_CHOICE", competencyIds: ["c9"] })]),
      stage("s2", [activity("a2", { competencyIds: ["c1", "c2"] })]),
    ];
    expect(usedCompetencyIds({ stages })).toEqual(["c2", "c1"]);
  });
});
```

Create `src/solutions/hiring/rules/gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { publishProblems } from "./gate";
import { activity, content, facts, stage } from "./test-fixtures";

const two = () => new Map([["c1", facts("c1")], ["c2", facts("c2")]]);
const opt = (id: string, correct = false) => ({ id, label: { tr: id, en: "" }, correct });

describe("publish gate (hiring solution design 2.2, HIRING-UX R2)", () => {
  it("passes a complete draft", () => {
    expect(publishProblems(content([stage("s1", [activity("a1", { competencyIds: ["c1", "c2"] })])]), two())).toEqual([]);
  });

  it("needs at least one stage", () => {
    expect(publishProblems(content([]), two())).toEqual([{ code: "NO_STAGE" }]);
  });

  it("needs a named stage with at least one question", () => {
    expect(publishProblems(content([stage("s1", [], { name: { tr: " ", en: "" } })]), two())).toEqual([
      { code: "EMPTY_STAGE_NAME", stageId: "s1" },
      { code: "EMPTY_STAGE", stageId: "s1" },
    ]);
  });

  it("needs the question's text", () => {
    const draft = content([stage("s1", [activity("a1", { prompt: { tr: "", en: " " }, competencyIds: ["c1"] })])]);
    expect(publishProblems(draft, two())).toEqual([{ code: "EMPTY_PROMPT", activityId: "a1" }]);
  });

  it("needs one or two competencies on every question that is not a choice", () => {
    const draft = content([stage("s1", [activity("a1"), activity("a2", { competencyIds: ["c1", "c2", "c3"] })])]);
    expect(publishProblems(draft, new Map([...two(), ["c3", facts("c3")]]))).toEqual([
      { code: "NO_COMPETENCY", activityId: "a1" },
      { code: "TOO_MANY_COMPETENCIES", activityId: "a2" },
    ]);
  });

  it("keeps choice questions out of competencies and needs options and a right answer", () => {
    const choice = (id: string, type: "SINGLE_CHOICE" | "MULTI_CHOICE", choices: ReturnType<typeof opt>[], competencyIds: string[] = []) =>
      activity(id, { type, config: { choices }, competencyIds });
    const draft = content([
      stage("s1", [
        choice("single-none", "SINGLE_CHOICE", [opt("a"), opt("b")]),
        choice("single-two", "SINGLE_CHOICE", [opt("a", true), opt("b", true)]),
        choice("multi-none", "MULTI_CHOICE", [opt("a"), opt("b"), opt("c")]),
        choice("one-option", "SINGLE_CHOICE", [opt("a", true)]),
        choice("with-competency", "SINGLE_CHOICE", [opt("a", true), opt("b")], ["c1"]),
        choice("fine", "MULTI_CHOICE", [opt("a", true), opt("b", true), opt("c")]),
      ]),
    ]);
    expect(publishProblems(draft, two())).toEqual([
      { code: "CHOICE_NEEDS_ANSWER", activityId: "single-none" },
      { code: "CHOICE_NEEDS_ANSWER", activityId: "single-two" },
      { code: "CHOICE_NEEDS_ANSWER", activityId: "multi-none" },
      { code: "CHOICE_NEEDS_OPTIONS", activityId: "one-option" },
      { code: "CHOICE_WITH_COMPETENCY", activityId: "with-competency" },
    ]);
  });

  it("needs anchors 1, 3 and 5 of every measured competency", () => {
    const draft = content([stage("s1", [activity("a1", { competencyIds: ["c1"] })])]);
    const thin = new Map([["c1", facts("c1", { anchors: { 1: { tr: "x", en: "" }, 3: { tr: " ", en: "" } } })]]);
    expect(publishProblems(draft, thin)).toEqual([
      { code: "ANCHOR_MISSING", competencyId: "c1", level: 3 },
      { code: "ANCHOR_MISSING", competencyId: "c1", level: 5 },
    ]);
  });

  it("refuses an archived or unknown competency", () => {
    const draft = content([stage("s1", [activity("a1", { competencyIds: ["c1", "gone"] })])]);
    expect(publishProblems(draft, new Map([["c1", facts("c1", { archived: true })]]))).toEqual([
      { code: "COMPETENCY_ARCHIVED", competencyId: "c1" },
      { code: "COMPETENCY_MISSING", competencyId: "gone" },
    ]);
  });

  it("checks weights only when weighting is on", () => {
    const stages = [stage("s1", [activity("a1", { competencyIds: ["c1", "c2"] })])];
    expect(publishProblems(content(stages, { weightsEnabled: false, draftWeights: { c1: 10 } }), two())).toEqual([]);
    expect(publishProblems(content(stages, { weightsEnabled: true, draftWeights: { c1: 60, c2: 35 } }), two())).toEqual([
      { code: "WEIGHTS_NOT_100", total: 95 },
    ]);
    expect(publishProblems(content(stages, { weightsEnabled: true, draftWeights: { c1: 60, c2: 40 } }), two())).toEqual([]);
  });
});
```

Create `src/solutions/hiring/rules/weights.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultWeights, evenSplit, toPercentages, weightsProblem } from "./weights";

describe("weights", () => {
  it("splits evenly, earlier rows take the remainder", () => {
    expect(evenSplit(3)).toEqual([34, 33, 33]);
    expect(evenSplit(0)).toEqual([]);
  });

  it("scales importance to whole percentages (largest remainder, ties to the earlier row)", () => {
    expect(toPercentages([50, 25, 25])).toEqual([50, 25, 25]);
    expect(toPercentages([2, 1])).toEqual([67, 33]);
    expect(toPercentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(toPercentages([0, 0])).toEqual([50, 50]);
    expect(toPercentages([0, 50])).toEqual([0, 100]);
  });

  it("always adds up to exactly 100", () => {
    for (let seed = 1; seed < 300; seed += 1) {
      const raw = Array.from({ length: (seed % 7) + 1 }, (_, i) => (seed * (i + 3) * 37) % 101);
      expect(toPercentages(raw).reduce((a, b) => a + b, 0), String(raw)).toBe(100);
    }
  });

  it("takes defaults from the position profile; a measured competency missing from it counts as the profile's average", () => {
    const profile = [
      { competencyId: "c1", weight: 60 },
      { competencyId: "c2", weight: 20 },
    ];
    expect(defaultWeights(["c1", "c2"], profile)).toEqual({ c1: 75, c2: 25 });
    expect(defaultWeights(["c1", "c2", "c3"], profile)).toEqual({ c1: 50, c2: 17, c3: 33 });
    expect(defaultWeights(["c1", "c2"], [])).toEqual({ c1: 50, c2: 50 });
  });

  it("accepts whole percentages adding up to exactly 100 over the measured competencies", () => {
    expect(weightsProblem({ c1: 60, c2: 40 }, ["c1", "c2"])).toBeNull();
    expect(weightsProblem({ c1: 60, c2: 35 }, ["c1", "c2"])).toEqual({ total: 95 });
    expect(weightsProblem({ c1: 60.5, c2: 39.5 }, ["c1", "c2"])).toEqual({ total: 100 });
    expect(weightsProblem({ c1: 100, gone: 50 }, ["c1"])).toBeNull();
  });
});
```

Create `src/solutions/hiring/rules/scorecard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildScorecard } from "./scorecard";
import { activity, content, facts, stage } from "./test-fixtures";

const scale = { min: 1, max: 5, levels: [{ value: 3, label: { tr: "Beklenen düzeyde", en: "Meets the bar" } }] };
const library = () =>
  new Map([
    ["c1", facts("c1")],
    [
      "c2",
      facts("c2", {
        anchors: { 1: { tr: "bir", en: "one" }, 2: { tr: " ", en: "" }, 3: { tr: "üç", en: "" }, 5: { tr: "beş", en: "" } },
        tags: [
          { id: "t1", polarity: "POSITIVE", label: { tr: "Örnek verdi", en: "Gave an example" }, archived: false },
          { id: "t2", polarity: "NEGATIVE", label: { tr: "eski", en: "old" }, archived: true },
        ],
      }),
    ],
    ["unused", facts("unused")],
  ]);
const draft = content([
  stage("s1", [
    activity("a1", { competencyIds: ["c2"] }),
    activity("a2", { competencyIds: ["c1", "c2"] }),
    activity("q", { type: "SINGLE_CHOICE" }),
  ]),
]);

describe("scorecard snapshot (hiring solution design 2.3)", () => {
  it("lists the measured competencies in the order they first appear, and nothing else", () => {
    expect(buildScorecard({ content: draft, facts: library(), scale, profile: [] }).competencies.map((c) => c.id)).toEqual(["c2", "c1"]);
  });

  it("copies the written anchors and the tags that are not archived", () => {
    const [c2] = buildScorecard({ content: draft, facts: library(), scale, profile: [] }).competencies;
    expect(Object.keys(c2.anchors)).toEqual(["1", "3", "5"]);
    expect(c2.tags).toEqual([{ id: "t1", polarity: "POSITIVE", label: { tr: "Örnek verdi", en: "Gave an example" } }]);
  });

  it("uses profile defaults when weighting is off and the draft's weights when it is on", () => {
    const off = buildScorecard({
      content: draft,
      facts: library(),
      scale,
      profile: [
        { competencyId: "c1", weight: 60 },
        { competencyId: "c2", weight: 20 },
      ],
    });
    expect(off.weightsEnabled).toBe(false);
    expect(off.competencies.map((c) => c.weight)).toEqual([25, 75]);
    const on = buildScorecard({ content: { ...draft, weightsEnabled: true, draftWeights: { c1: 30, c2: 70 } }, facts: library(), scale, profile: [] });
    expect(on.weightsEnabled).toBe(true);
    expect(on.competencies.map((c) => c.weight)).toEqual([70, 30]);
  });

  it("is a copy: editing the library afterwards changes nothing in it", () => {
    const lib = library();
    const snapshot = buildScorecard({ content: draft, facts: lib, scale, profile: [] });
    lib.get("c2")!.anchors[3]!.tr = "değişti";
    lib.get("c2")!.tags[0].label.tr = "değişti";
    scale.levels[0].label.tr = "değişti";
    expect(snapshot.competencies[0].anchors[3].tr).toBe("üç");
    expect(snapshot.competencies[0].tags[0].label.tr).toBe("Örnek verdi");
    expect(snapshot.scale.levels[0].label.tr).toBe("Beklenen düzeyde");
  });
});
```

Create `src/solutions/hiring/rules/candidate-view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toCandidateVersion } from "./candidate-view";
import { activity, content, stage } from "./test-fixtures";

const SECRET = "SECRET";
const draft = content([
  stage(
    "s1",
    [
      activity("a1", {
        competencyIds: ["comp-secret"],
        internalQuestion: `${SECRET} purpose`,
        expectedBehaviours: [`${SECRET} behaviour`],
        redFlags: [`${SECRET} flag`],
        managerNotes: `${SECRET} note`,
        answerExamples: { 1: `${SECRET} one`, 3: `${SECRET} three`, 5: `${SECRET} five` },
        config: { textAlternativeEnabled: true },
      }),
      activity("a2", {
        type: "SINGLE_CHOICE",
        config: {
          choices: [
            { id: "x", label: { tr: "Evet", en: "Yes" }, correct: true },
            { id: "y", label: { tr: "Hayır", en: "No" } },
          ],
        },
      }),
    ],
    { internalPurpose: `${SECRET} stage purpose` },
  ),
]);

describe("candidate view (HIRING-UX 5.8, spec 7)", () => {
  it("never carries a team-only field, the competency mapping or the right answer", () => {
    const text = JSON.stringify(toCandidateVersion(draft));
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("comp-secret");
    expect(text).not.toContain("correct");
  });

  it("is built from a whitelist", () => {
    const view = toCandidateVersion(draft);
    expect(Object.keys(view.stages[0]).sort()).toEqual(["activities", "description", "durationSeconds", "id", "name"]);
    expect(Object.keys(view.stages[0].activities[0]).sort()).toEqual(
      [
        "acceptedMimeTypes",
        "answerSeconds",
        "choices",
        "flexibleThink",
        "id",
        "maxChars",
        "maxFileBytes",
        "maxTakes",
        "minChars",
        "note",
        "prompt",
        "required",
        "textAlternativeEnabled",
        "thinkSeconds",
        "type",
      ].sort(),
    );
    expect(view.stages[0].activities[1].choices).toEqual([
      { id: "x", label: { tr: "Evet", en: "Yes" } },
      { id: "y", label: { tr: "Hayır", en: "No" } },
    ]);
    expect(view.totalSeconds).toBe(600);
  });
});
```

Create `src/solutions/hiring/rules/access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canDecide, openingAccess } from "./access";

const people = { decisionMakerId: "dm", backupDecisionMakerId: "bk", memberIds: ["m1"] };

describe("opening access", () => {
  it("lets owners and managers see and edit every opening", () => {
    expect(openingAccess({ id: "x", role: "OWNER" }, people)).toEqual({ view: true, edit: true });
    expect(openingAccess({ id: "x", role: "MANAGER" }, people)).toEqual({ view: true, edit: true });
  });

  it("lets a reviewer see an opening only as a member, decision maker or backup, never edit it", () => {
    for (const id of ["m1", "dm", "bk"]) expect(openingAccess({ id, role: "REVIEWER" }, people)).toEqual({ view: true, edit: false });
    expect(openingAccess({ id: "stranger", role: "REVIEWER" }, people)).toEqual({ view: false, edit: false });
  });

  it("lets only owners and managers decide (HIRING-UX 4.6)", () => {
    expect(canDecide("OWNER")).toBe(true);
    expect(canDecide("MANAGER")).toBe(true);
    expect(canDecide("REVIEWER")).toBe(false);
  });
});
```

Create `src/solutions/hiring/rules/versions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { workingVersions } from "./versions";

const v = (number: number, status: "DRAFT" | "PUBLISHED") => ({ id: `v${number}`, number, status, publishedAt: null, previewedAt: null });

describe("working versions", () => {
  it("finds the draft and the newest published version (list is newest first)", () => {
    expect(workingVersions([v(3, "DRAFT"), v(2, "PUBLISHED"), v(1, "PUBLISHED")])).toMatchObject({ draft: { id: "v3" }, live: { id: "v2" } });
    expect(workingVersions([v(1, "DRAFT")])).toMatchObject({ draft: { id: "v1" }, live: null });
    expect(workingVersions([])).toEqual({ draft: null, live: null });
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm exec vitest run src/solutions/hiring/rules`
Expected: FAIL with missing modules (`./gate`, `./weights`, `./scorecard`, `./candidate-view`, `./access`, `./versions`); `content.test.ts` passes.

- [ ] **Step 4: Implement the rules**

Create `src/solutions/hiring/rules/weights.ts`:

```ts
/**
 * Competency weights (HIRING-UX 5.7). Position profile weights are importance
 * on 0-100 with any sum; an opening works in whole percentages summing to 100.
 */
export function evenSplit(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, i) => (i < remainder ? base + 1 : base));
}

/** Largest remainder; ties go to the earlier row, so the result is stable. */
export function toPercentages(raw: number[]): number[] {
  if (raw.length === 0) return [];
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return evenSplit(raw.length);
  const exact = raw.map((r) => (r / sum) * 100);
  const result = exact.map(Math.floor);
  let left = 100 - result.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    result[i] += 1;
    left -= 1;
  }
  return result;
}

export function defaultWeights(used: string[], profile: Array<{ competencyId: string; weight: number }>): Record<string, number> {
  const byId = new Map(profile.map((p) => [p.competencyId, p.weight]));
  const present = used.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const fallback = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 1;
  const percentages = toPercentages(used.map((id) => byId.get(id) ?? fallback));
  return Object.fromEntries(used.map((id, i) => [id, percentages[i]]));
}

export function weightsTotal(weights: Record<string, number>, used: string[]): number {
  return used.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
}

/** Null when every measured competency has a whole percentage 0-100 and they add up to 100. */
export function weightsProblem(weights: Record<string, number>, used: string[]): { total: number } | null {
  const total = weightsTotal(weights, used);
  const whole = used.every((id) => {
    const w = weights[id] ?? 0;
    return Number.isInteger(w) && w >= 0 && w <= 100;
  });
  return whole && total === 100 ? null : { total };
}
```

Create `src/solutions/hiring/rules/gate.ts`:

```ts
import { hasText, missingAnchorLevels } from "@/lib/library/anchors";
import { isChoice, MAX_COMPETENCIES_PER_ACTIVITY, usedCompetencyIds, type CompetencyFacts, type VersionContent } from "./content";
import { weightsProblem } from "./weights";

export type PublishProblem =
  | { code: "NO_STAGE" }
  | { code: "EMPTY_STAGE_NAME"; stageId: string }
  | { code: "EMPTY_STAGE"; stageId: string }
  | { code: "EMPTY_PROMPT"; activityId: string }
  | { code: "NO_COMPETENCY"; activityId: string }
  | { code: "TOO_MANY_COMPETENCIES"; activityId: string }
  | { code: "CHOICE_WITH_COMPETENCY"; activityId: string }
  | { code: "CHOICE_NEEDS_OPTIONS"; activityId: string }
  | { code: "CHOICE_NEEDS_ANSWER"; activityId: string }
  | { code: "COMPETENCY_MISSING"; competencyId: string }
  | { code: "COMPETENCY_ARCHIVED"; competencyId: string }
  | { code: "ANCHOR_MISSING"; competencyId: string; level: number }
  | { code: "WEIGHTS_NOT_100"; total: number };

/** Readiness rows (HIRING-UX 5.4): "Değerlendirme kuruldu" and "Puan kartında her yetkinliğin çapası var". */
export const STRUCTURE_PROBLEMS: ReadonlyArray<PublishProblem["code"]> = [
  "NO_STAGE",
  "EMPTY_STAGE_NAME",
  "EMPTY_STAGE",
  "EMPTY_PROMPT",
  "NO_COMPETENCY",
  "TOO_MANY_COMPETENCIES",
  "CHOICE_WITH_COMPETENCY",
  "CHOICE_NEEDS_OPTIONS",
  "CHOICE_NEEDS_ANSWER",
];
export const ANCHOR_PROBLEMS: ReadonlyArray<PublishProblem["code"]> = ["COMPETENCY_MISSING", "COMPETENCY_ARCHIVED", "ANCHOR_MISSING", "WEIGHTS_NOT_100"];

/**
 * The server-side publish gate. Every reason the draft cannot be published, in
 * screen order; an empty list means it can. Pure: the caller loads the draft
 * and the library facts inside the publishing transaction.
 */
export function publishProblems(content: VersionContent, facts: ReadonlyMap<string, CompetencyFacts>): PublishProblem[] {
  const problems: PublishProblem[] = [];
  if (content.stages.length === 0) problems.push({ code: "NO_STAGE" });
  for (const stage of content.stages) {
    if (!hasText(stage.name)) problems.push({ code: "EMPTY_STAGE_NAME", stageId: stage.id });
    if (stage.activities.length === 0) problems.push({ code: "EMPTY_STAGE", stageId: stage.id });
    for (const activity of stage.activities) {
      if (!hasText(activity.prompt)) problems.push({ code: "EMPTY_PROMPT", activityId: activity.id });
      if (isChoice(activity.type)) {
        if (activity.competencyIds.length > 0) problems.push({ code: "CHOICE_WITH_COMPETENCY", activityId: activity.id });
        const choices = (activity.config.choices ?? []).filter((c) => hasText(c.label));
        const correct = choices.filter((c) => c.correct).length;
        if (choices.length < 2) problems.push({ code: "CHOICE_NEEDS_OPTIONS", activityId: activity.id });
        else if (activity.type === "SINGLE_CHOICE" ? correct !== 1 : correct < 1) {
          problems.push({ code: "CHOICE_NEEDS_ANSWER", activityId: activity.id });
        }
      } else if (activity.competencyIds.length === 0) {
        problems.push({ code: "NO_COMPETENCY", activityId: activity.id });
      } else if (activity.competencyIds.length > MAX_COMPETENCIES_PER_ACTIVITY) {
        problems.push({ code: "TOO_MANY_COMPETENCIES", activityId: activity.id });
      }
    }
  }
  const used = usedCompetencyIds(content);
  for (const id of used) {
    const f = facts.get(id);
    if (!f) {
      problems.push({ code: "COMPETENCY_MISSING", competencyId: id });
      continue;
    }
    if (f.archived) problems.push({ code: "COMPETENCY_ARCHIVED", competencyId: id });
    for (const level of missingAnchorLevels(f.anchors)) problems.push({ code: "ANCHOR_MISSING", competencyId: id, level });
  }
  if (content.weightsEnabled) {
    const problem = weightsProblem(content.draftWeights ?? {}, used);
    if (problem) problems.push({ code: "WEIGHTS_NOT_100", total: problem.total });
  }
  return problems;
}
```

Create `src/solutions/hiring/rules/scorecard.ts`:

```ts
import type { ScorecardSnapshot } from "@/db/schema";
import type { I18nText } from "@/db/schema/types";
import { hasText } from "@/lib/library/anchors";
import { usedCompetencyIds, type CompetencyFacts, type VersionContent } from "./content";
import { defaultWeights } from "./weights";

/**
 * The scorecard copied into a version at publish (hiring solution design 2.3).
 * Scoring screens read anchors and tags from here, never from the library, so
 * a later library edit cannot change what a score meant. A deep copy.
 */
export function buildScorecard(input: {
  content: VersionContent;
  facts: ReadonlyMap<string, CompetencyFacts>;
  scale: ScorecardSnapshot["scale"];
  profile: Array<{ competencyId: string; weight: number }>;
}): ScorecardSnapshot {
  const used = usedCompetencyIds(input.content);
  // Defaults are stored even when weighting is off, so switching it on later starts from the profile.
  const weights = input.content.weightsEnabled && input.content.draftWeights ? input.content.draftWeights : defaultWeights(used, input.profile);
  const snapshot: ScorecardSnapshot = {
    scale: input.scale,
    competencies: used.map((id) => {
      const f = input.facts.get(id);
      if (!f) throw new Error(`competency ${id} has no library facts`);
      const anchors: Record<number, I18nText> = {};
      for (const [level, body] of Object.entries(f.anchors)) {
        if (body && hasText(body)) anchors[Number(level)] = { tr: body.tr.trim(), en: body.en.trim() };
      }
      return {
        id,
        name: f.name,
        anchors,
        tags: f.tags.filter((t) => !t.archived).map((t) => ({ id: t.id, polarity: t.polarity, label: t.label })),
        weight: weights[id] ?? 0,
      };
    }),
    weightsEnabled: input.content.weightsEnabled,
  };
  return structuredClone(snapshot);
}
```

Create `src/solutions/hiring/rules/candidate-view.ts`:

```ts
import type { I18nText } from "@/db/schema/types";
import type { ActivityType, ContentStage } from "./content";

export type CandidateActivity = {
  id: string;
  type: ActivityType;
  required: boolean;
  prompt: I18nText;
  note: I18nText;
  thinkSeconds: number;
  flexibleThink: boolean;
  answerSeconds: number | null;
  maxTakes: number;
  choices: Array<{ id: string; label: I18nText }> | null;
  minChars: number | null;
  maxChars: number | null;
  acceptedMimeTypes: string[] | null;
  maxFileBytes: number | null;
  textAlternativeEnabled: boolean;
};
export type CandidateStage = { id: string; name: I18nText; description: I18nText; durationSeconds: number; activities: CandidateActivity[] };
export type CandidateVersion = { stages: CandidateStage[]; totalSeconds: number };

/**
 * What a candidate may see of a version, built field by field (a whitelist,
 * like the exam's toCandidateItem). Team-only fields, answer examples, the
 * competency mapping and a choice question's right answer are never copied.
 * The preview renders exactly this (HIRING-UX 5.8); plan 2's candidate API
 * sends the same.
 */
export function toCandidateVersion(content: { stages: ContentStage[] }): CandidateVersion {
  const stages = content.stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    description: stage.description,
    durationSeconds: stage.durationSeconds,
    activities: stage.activities.map(
      (a): CandidateActivity => ({
        id: a.id,
        type: a.type,
        required: a.required,
        prompt: a.prompt,
        note: a.note,
        thinkSeconds: a.thinkSeconds,
        flexibleThink: a.flexibleThink,
        answerSeconds: a.answerSeconds,
        maxTakes: a.maxTakes,
        choices: a.config.choices ? a.config.choices.map((c) => ({ id: c.id, label: c.label })) : null,
        minChars: a.config.minChars ?? null,
        maxChars: a.config.maxChars ?? null,
        acceptedMimeTypes: a.config.acceptedMimeTypes ?? null,
        maxFileBytes: a.config.maxFileBytes ?? null,
        textAlternativeEnabled: a.config.textAlternativeEnabled ?? false,
      }),
    ),
  }));
  return structuredClone({ stages, totalSeconds: stages.reduce((sum, s) => sum + s.durationSeconds, 0) });
}
```

Create `src/solutions/hiring/rules/access.ts`:

```ts
export type Viewer = { id: string; role: "OWNER" | "MANAGER" | "REVIEWER" };
export type OpeningPeople = { decisionMakerId: string | null; backupDecisionMakerId: string | null; memberIds: string[] };

/**
 * Who sees and edits an opening (plan decision 13). Owners and managers run
 * openings; a reviewer sees only the openings they work on. A reviewer outside
 * the team gets a 404, so an opening's existence is not revealed.
 */
export function openingAccess(viewer: Viewer, people: OpeningPeople): { view: boolean; edit: boolean } {
  const edit = viewer.role === "OWNER" || viewer.role === "MANAGER";
  const view =
    edit ||
    people.memberIds.includes(viewer.id) ||
    people.decisionMakerId === viewer.id ||
    people.backupDecisionMakerId === viewer.id;
  return { view, edit };
}

/** HIRING-UX 4.6: a decision maker (or backup) is an owner or a manager. */
export function canDecide(role: Viewer["role"]): boolean {
  return role === "OWNER" || role === "MANAGER";
}
```

Create `src/solutions/hiring/rules/versions.ts`:

```ts
export type VersionSummary = {
  id: string;
  number: number;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  previewedAt: Date | null;
};

/** The draft being edited and the newest published version; `list` is newest first. */
export function workingVersions(list: VersionSummary[]): { draft: VersionSummary | null; live: VersionSummary | null } {
  return {
    draft: list.find((v) => v.status === "DRAFT") ?? null,
    live: list.find((v) => v.status === "PUBLISHED") ?? null,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/solutions/hiring/rules`
Expected: PASS.

- [ ] **Step 6: Open the hiring folders in the boundary rules**

In `eslint.config.mjs` change the core rule's `ignores` to:

```js
    ignores: ["src/solutions/**", "src/app/**/exam/**", "src/app/**/hiring/**", "src/components/hiring/**"],
```

In `src/solutions/boundary.test.ts` add to `EXEMPT` (after `/^src\/app\/.*\/exam\//,`):

```ts
  /^src\/app\/.*\/hiring\//,
  /^src\/components\/hiring\//,
```

and append:

```ts
/** A solution never imports another solution (spec 2: each one is a folder on the core). */
const HIRING_CODE = [/^src\/solutions\/hiring\//, /^src\/app\/.*\/hiring\//, /^src\/components\/hiring\//];
const OTHER_SOLUTION = [...EXAM_IMPORT, /["']@\/solutions\/language-exam/, /["']@\/components\/panel\//, /["']@\/components\/candidate\/exam\//];

describe("solutions do not import each other", () => {
  it("the pattern list recognises an exam import", () => {
    expect(OTHER_SOLUTION.some((re) => re.test('import { loadState } from "@/lib/exam-flow";'))).toBe(true);
    expect(OTHER_SOLUTION.some((re) => re.test('import { PageHead } from "@/components/panel/bits";'))).toBe(true);
  });

  it("hiring code never imports the exam", () => {
    const root = process.cwd();
    const hiring = files(path.join(root, "src"))
      .map((f) => path.relative(root, f).split(path.sep).join("/"))
      .filter((f) => HIRING_CODE.some((re) => re.test(f)));
    expect(hiring.length).toBeGreaterThan(0);
    const offenders = hiring.filter((f) => OTHER_SOLUTION.some((re) => re.test(readFileSync(path.join(root, f), "utf8"))));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 7: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
git add src/solutions/hiring/rules eslint.config.mjs src/solutions/boundary.test.ts
git commit -m "Add the hiring rules: publish gate, weights, scorecard, candidate view, access" -m "Pure and tested: the publish gate of spec 2.2 (plus named stages, question text, archived competencies), largest-remainder weights from the position profile, the deep-copied scorecard snapshot, the candidate whitelist the preview and plan 2 share, and who sees or edits an opening. Hiring folders are exempt from the core import rule, and a test keeps hiring from importing the exam." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Hiring data layer: openings, versions and draft editing

**Files:**
- Create: `src/solutions/hiring/rules/patches.ts`, `src/solutions/hiring/rules/patches.test.ts`
- Create: `src/solutions/hiring/server/errors.ts`
- Create: `src/solutions/hiring/server/content.ts`
- Create: `src/solutions/hiring/server/versions.ts`
- Create: `src/solutions/hiring/server/openings.ts`
- Create: `scripts/verify-hiring-setup.ts`
- Modify: `package.json` (script `verify:hiring-setup`)

**Interfaces:**
- Consumes: Task 6 `createPosition`, Task 3 `ensureDefaultScale`, Task 10 rules, `Executor`.
- Produces in `rules/patches`: `stagePatchSchema`, `activityPatchSchema`, `stagePayloadSchema`, `activityPayloadSchema`, types `StagePatch`, `ActivityPatch`, `StagePayload`, `ActivityPayload`, `defaultsFor(type: ActivityType)`, `stagePayloadOf(stage: ContentStage): StagePayload`, `activityPayloadOf(a: ContentActivity): ActivityPayload`, `emptyActivity(type): ActivityPayload`.
- Produces in `server/errors`: `class HiringNotFound(what: string)`, `type ConflictCode = "NO_DRAFT" | "COMPETENCY" | "CHOICE_COMPETENCY" | "TOO_MANY_COMPETENCIES"`, `class HiringConflict(code: ConflictCode)`.
- Produces in `server/content`: `loadVersionContent(versionId, x?): Promise<VersionContent | null>`, `loadCompetencyFacts(orgId, ids, x?): Promise<Map<string, CompetencyFacts>>`, `loadScaleSnapshot(orgId, x?): Promise<ScorecardSnapshot["scale"]>`, `positionProfile(positionId, x?): Promise<Array<{ competencyId: string; weight: number }>>`.
- Produces in `server/versions`: `versionsOf(openingId, x?)`, `latestWeights(x, versionId)`, `cloneContent(x, from, to)`, `ensureDraftVersion(orgId, openingId): Promise<{ versionId: string; created: boolean }>`, `addStage`, `updateStage`, `moveStage`, `deleteStage` (returns `{ payload: StagePayload; index: number }`), `insertStage(orgId, openingId, payload, index?)`, `addActivity`, `updateActivity`, `moveActivity`, `deleteActivity` (returns `{ payload: ActivityPayload; stageId: string; index: number }`), `insertActivity(orgId, openingId, stageId, payload, index?)`, `setActivityCompetencies`, `saveDraftWeights(orgId, openingId, { enabled, weights })`. Every function takes `orgId` and `openingId` and works on that opening's draft only.
- Produces in `server/openings`: `type OpeningDetail`, `type OpeningListRow`, `loadOpening(orgId, id)`, `listOpenings(orgId, viewer, status)`, `copySources(orgId)`, `type CreateOpeningInput`, `createOpening(user, input): Promise<{ ok: true; openingId: string; next: string } | { ok: false; code: "POSITION_NAME_REQUIRED" | "POSITION_NOT_FOUND" | "JOB_AD_REQUIRED" | "COPY_SOURCE_NOT_FOUND" }>`.
- Produces: `pnpm verify:hiring-setup` (refuses any database whose name does not end in `_check`).

- [ ] **Step 1: Write the failing patch tests**

Create `src/solutions/hiring/rules/patches.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { activityPatchSchema, defaultsFor, stagePayloadOf, stagePayloadSchema } from "./patches";
import { activity, stage } from "./test-fixtures";

describe("hiring patches", () => {
  it("gives each question type its HIRING-UX 5.5 defaults", () => {
    expect(defaultsFor("VIDEO")).toMatchObject({ thinkSeconds: 60, flexibleThink: true, answerSeconds: 120, maxTakes: 2, config: { textAlternativeEnabled: false } });
    expect(defaultsFor("LONG_TEXT")).toMatchObject({ thinkSeconds: 0, answerSeconds: null, config: { minChars: 0, maxChars: 3000 } });
    expect(defaultsFor("SINGLE_CHOICE").config.choices).toHaveLength(2);
    expect(defaultsFor("FILE_UPLOAD").config).toMatchObject({ acceptedMimeTypes: ["application/pdf"] });
  });

  it("refuses values the candidate timer or the database cannot live with", () => {
    expect(activityPatchSchema.safeParse({ maxTakes: 9 }).success).toBe(false);
    expect(activityPatchSchema.safeParse({ answerSeconds: 5 }).success).toBe(false);
    expect(activityPatchSchema.safeParse({ answerExamples: { 2: "x" } }).success).toBe(false);
    expect(activityPatchSchema.safeParse({ config: { unknown: true } }).success).toBe(false);
    expect(activityPatchSchema.safeParse({ prompt: { tr: "Anlat.", en: "" }, maxTakes: 3 }).success).toBe(true);
  });

  it("turns a stage into a payload that validates again (undo and copy use it)", () => {
    const payload = stagePayloadOf(stage("s", [activity("a", { competencyIds: ["00000000-0000-4000-8000-000000000001"] })]));
    expect(stagePayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload.activities[0]).not.toHaveProperty("id");
  });
});
```

Run: `pnpm exec vitest run src/solutions/hiring/rules/patches.test.ts` - Expected: FAIL with `Cannot find module './patches'`.

- [ ] **Step 2: Implement the patches**

Create `src/solutions/hiring/rules/patches.ts`:

```ts
import { z } from "zod";
import { ACTIVITY_TYPES, type ActivityType, type ContentActivity, type ContentStage } from "./content";

/** What the builder may change, validated on the server before any write. */
const text = (max: number) => z.object({ tr: z.string().max(max), en: z.string().max(max) });
const choiceSchema = z.object({ id: z.string().min(1).max(40), label: text(300), correct: z.boolean().optional() });

export const activityConfigSchema = z
  .object({
    choices: z.array(choiceSchema).max(10).optional(),
    minChars: z.number().int().min(0).max(20000).optional(),
    maxChars: z.number().int().min(1).max(20000).optional(),
    acceptedMimeTypes: z.array(z.string().max(100)).max(10).optional(),
    maxFileBytes: z.number().int().min(1).max(50 * 1024 * 1024).optional(),
    textAlternativeEnabled: z.boolean().optional(),
  })
  .strict();

const activityFields = {
  type: z.enum(ACTIVITY_TYPES),
  required: z.boolean(),
  prompt: text(2000),
  note: text(600),
  internalQuestion: z.string().max(1000).nullable(),
  expectedBehaviours: z.array(z.string().max(300)).max(10),
  redFlags: z.array(z.string().max(300)).max(10),
  managerNotes: z.string().max(2000).nullable(),
  answerExamples: z.object({ 1: z.string().max(600).optional(), 3: z.string().max(600).optional(), 5: z.string().max(600).optional() }).strict(),
  thinkSeconds: z.number().int().min(0).max(600),
  flexibleThink: z.boolean(),
  answerSeconds: z.number().int().min(30).max(1800).nullable(),
  maxTakes: z.number().int().min(1).max(5),
  config: activityConfigSchema,
};

export const activityPatchSchema = z.object(activityFields).partial().strict();
export const activityPayloadSchema = z.object({ ...activityFields, competencyIds: z.array(z.uuid()).max(2) });

const stageFields = {
  name: text(300),
  description: text(2000),
  internalPurpose: z.string().max(1000).nullable(),
  durationSeconds: z.number().int().min(60).max(7200),
  graceSeconds: z.number().int().min(0).max(600),
  onTimeout: z.enum(["AUTO_SUBMIT", "AUTO_CLOSE", "ALLOW_GRACE", "ALLOW_LATE"]),
  backNavigation: z.boolean(),
};
export const stagePatchSchema = z.object(stageFields).partial().strict();
export const stagePayloadSchema = z.object({ ...stageFields, activities: z.array(activityPayloadSchema).max(20) });

export type ActivityPatch = z.infer<typeof activityPatchSchema>;
export type ActivityPayload = z.infer<typeof activityPayloadSchema>;
export type StagePatch = z.infer<typeof stagePatchSchema>;
export type StagePayload = z.infer<typeof stagePayloadSchema>;

/** HIRING-UX 5.5 defaults: 60 s flexible think time, 2 min answer, one retake. */
export function defaultsFor(type: ActivityType): Pick<ActivityPayload, "thinkSeconds" | "flexibleThink" | "answerSeconds" | "maxTakes" | "config"> {
  switch (type) {
    case "VIDEO":
    case "AUDIO":
      return { thinkSeconds: 60, flexibleThink: true, answerSeconds: 120, maxTakes: 2, config: { textAlternativeEnabled: false } };
    case "LONG_TEXT":
      return { thinkSeconds: 0, flexibleThink: true, answerSeconds: null, maxTakes: 1, config: { minChars: 0, maxChars: 3000 } };
    case "SHORT_TEXT":
      return { thinkSeconds: 0, flexibleThink: true, answerSeconds: null, maxTakes: 1, config: { minChars: 0, maxChars: 300 } };
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return {
        thinkSeconds: 0,
        flexibleThink: true,
        answerSeconds: null,
        maxTakes: 1,
        config: {
          choices: [
            { id: "a", label: { tr: "", en: "" } },
            { id: "b", label: { tr: "", en: "" } },
          ],
        },
      };
    case "FILE_UPLOAD":
      return { thinkSeconds: 0, flexibleThink: true, answerSeconds: null, maxTakes: 1, config: { acceptedMimeTypes: ["application/pdf"], maxFileBytes: 10 * 1024 * 1024 } };
  }
}

export function emptyActivity(type: ActivityType): ActivityPayload {
  return {
    type,
    required: true,
    prompt: { tr: "", en: "" },
    note: { tr: "", en: "" },
    internalQuestion: null,
    expectedBehaviours: [],
    redFlags: [],
    managerNotes: null,
    answerExamples: {},
    ...defaultsFor(type),
    competencyIds: [],
  };
}

export function activityPayloadOf(a: ContentActivity): ActivityPayload {
  return {
    type: a.type,
    required: a.required,
    prompt: a.prompt,
    note: a.note,
    internalQuestion: a.internalQuestion,
    expectedBehaviours: a.expectedBehaviours,
    redFlags: a.redFlags,
    managerNotes: a.managerNotes,
    answerExamples: a.answerExamples,
    thinkSeconds: a.thinkSeconds,
    flexibleThink: a.flexibleThink,
    answerSeconds: a.answerSeconds,
    maxTakes: a.maxTakes,
    config: a.config,
    competencyIds: a.competencyIds,
  };
}

export function stagePayloadOf(stage: ContentStage): StagePayload {
  return {
    name: stage.name,
    description: stage.description,
    internalPurpose: stage.internalPurpose,
    durationSeconds: stage.durationSeconds,
    graceSeconds: stage.graceSeconds,
    onTimeout: stage.onTimeout,
    backNavigation: stage.backNavigation,
    activities: stage.activities.map(activityPayloadOf),
  };
}
```

Run: `pnpm exec vitest run src/solutions/hiring/rules/patches.test.ts` - Expected: PASS.

- [ ] **Step 3: Write the failing end-to-end script (openings and editing)**

Create `scripts/verify-hiring-setup.ts`:

```ts
/**
 * End to end check of the hiring setup (plan 1), in process, against a
 * THROW-AWAY database (name ends in _check) with every migration applied:
 * openings, versions, draft editing, copying; Task 12 adds publishing.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm verify:hiring-setup
 */
import "dotenv/config";

let failed = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => {
  failed += 1;
  console.log(`  FAIL ${m}`);
};
const check = (condition: boolean, label: string, detail?: string) => (condition ? ok(label) : bad(detail ? `${label}: ${detail}` : label));

async function expectCode(label: string, run: () => Promise<unknown>, code: string) {
  try {
    await run();
    bad(`${label}: was allowed`);
  } catch (error) {
    const got = (error as { code?: string }).code;
    if (got === code) ok(label);
    else bad(`${label}: ${got ?? ""} ${(error as Error).message}`);
  }
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
  if (!url.pathname.endsWith("_check")) {
    console.error(`Refusing: ${url.pathname} is not a throw-away *_check database.`);
    process.exit(2);
  }
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { seedLibrary } = await import("@/db/library-seed");
  const { createPosition, savePosition } = await import("@/server/library-write");
  const openings = await import("@/solutions/hiring/server/openings");
  const versions = await import("@/solutions/hiring/server/versions");
  const { loadVersionContent } = await import("@/solutions/hiring/server/content");

  const [org] = await db.insert(s.organizations).values({ name: "Hiring setup check" }).returning();
  const [owner] = await db
    .insert(s.users)
    .values({ orgId: org.id, email: `owner-${Date.now()}@check.local`, name: "Check Owner", role: "OWNER", passwordHash: "x" })
    .returning();
  const user = { id: owner.id, orgId: org.id, email: owner.email, name: owner.name, role: "OWNER" as const };
  await seedLibrary(org.id);
  const library = await db.select().from(s.competencies).where(eq(s.competencies.orgId, org.id));
  const byKey = (key: string) => library.find((c) => c.seedKey === key)!.id;
  const communication = byKey("communication");
  const problem = byKey("problem_solving");

  console.log("\nA position with a profile");
  const position = await createPosition(org.id, owner.id, { name: "Kıdemli Ürün Tasarımcısı", jobDescription: "Ürün ekibimize kullanıcı araştırmasını yönetecek bir tasarımcı arıyoruz." });
  if (!position.ok) throw new Error("position");
  await savePosition(org.id, owner.id, position.id, {
    name: "Kıdemli Ürün Tasarımcısı",
    team: "Ürün",
    shortDescription: "",
    jobDescription: "Ürün ekibimize kullanıcı araştırmasını yönetecek bir tasarımcı arıyoruz.",
    skills: [],
    languages: [],
    profile: [
      { competencyId: communication, weight: 60, expectedLevel: 3 },
      { competencyId: problem, weight: 20, expectedLevel: null },
    ],
  });
  ok("position saved with İletişim 60 and Problem Çözme 20");

  console.log("\nOpening an opening");
  const created = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null, locale: "tr" });
  if (!created.ok) throw new Error(created.code);
  const id = created.openingId;
  const opening = await openings.loadOpening(org.id, id);
  check(opening?.status === "DRAFT" && opening.ownerId === owner.id && opening.decisionMakerId === owner.id, "DRAFT, owned and decided by its creator");
  check(created.next === `/hiring/openings/${id}/assessment/edit`, "a blank start lands in the builder", created.next);
  const [v1] = await versions.versionsOf(id);
  check(v1?.number === 1 && v1.status === "DRAFT", "v1 is a draft");
  const refused = await openings.createOpening(user, { position: { kind: "new", name: "İlansız", jobDescription: " " }, start: "AI", copyFrom: null, locale: "tr" });
  check(!refused.ok && refused.code === "JOB_AD_REQUIRED", "an AI start without a job ad is refused");
  const positionsNow = await db.select().from(s.positions).where(eq(s.positions.orgId, org.id));
  check(positionsNow.length === 1, "and it wrote nothing", `${positionsNow.length} positions`);

  console.log("\nEditing the draft");
  const s1 = await versions.addStage(org.id, id);
  await versions.updateStage(org.id, id, s1, { name: { tr: "Tanışma", en: "Introduction" }, durationSeconds: 480 });
  const a1 = await versions.addActivity(org.id, id, s1, "VIDEO");
  await versions.updateActivity(org.id, id, a1, { prompt: { tr: "Son projende bir sorunu nasıl çözdüğünü anlat.", en: "" } });
  await versions.setActivityCompetencies(org.id, id, a1, [communication, problem]);
  await expectCode("a third competency is refused", () => versions.setActivityCompetencies(org.id, id, a1, [communication, problem, byKey("teamwork")]), "TOO_MANY_COMPETENCIES");
  const choice = await versions.addActivity(org.id, id, s1, "SINGLE_CHOICE");
  await expectCode("a choice question cannot measure a competency", () => versions.setActivityCompetencies(org.id, id, choice, [communication]), "CHOICE_COMPETENCY");
  const s2 = await versions.addStage(org.id, id);
  const s3 = await versions.addStage(org.id, id);
  await versions.moveStage(org.id, id, s3, -1);
  let content = await loadVersionContent(v1.id);
  check(content!.stages.map((x) => x.id).join() === [s1, s3, s2].join(), "moving a stage up swaps it with its neighbour");
  check(content!.stages.map((x) => x.orderIndex).join() === "0,1,2", "order stays 0..n-1");
  const removed = await versions.deleteStage(org.id, id, s1);
  content = await loadVersionContent(v1.id);
  check(content!.stages.length === 2 && content!.stages.every((x, i) => x.orderIndex === i), "deleting renumbers the rest");
  const restored = await versions.insertStage(org.id, id, removed.payload, removed.index);
  content = await loadVersionContent(v1.id);
  check(
    content!.stages[0].id === restored && content!.stages[0].activities.length === 2 && content!.stages[0].activities[0].competencyIds.length === 2,
    "undo puts the stage back in place with its questions and competencies",
  );
  await versions.deleteStage(org.id, id, s2);
  await versions.deleteStage(org.id, id, s3);
  const other = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null, locale: "tr" });
  if (!other.ok) throw new Error(other.code);
  await expectCode("a stage of one opening cannot be edited through another", () => versions.updateStage(org.id, other.openingId, restored, { durationSeconds: 300 }), "NOT_FOUND");

  console.log("\nCopying an opening");
  const copy = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "COPY", copyFrom: id, locale: "tr" });
  if (!copy.ok) throw new Error(copy.code);
  const [copyVersion] = await versions.versionsOf(copy.openingId);
  const copied = await loadVersionContent(copyVersion.id);
  const source = await loadVersionContent(v1.id);
  check(copied!.stages.length === source!.stages.length && copied!.stages[0].activities.length === source!.stages[0].activities.length, "same structure");
  check(copied!.stages[0].id !== source!.stages[0].id, "new ids; the source is untouched");

  // TASK 12: publishing checks go here.

  console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add to `package.json` scripts: `"verify:hiring-setup": "tsx scripts/verify-hiring-setup.ts",`.

Run it on a fresh throw-away database (same create, migrate, run, drop sequence as Task 9 Step 5 with `pnpm verify:hiring-setup`). Expected: the script stops with `Cannot find module '@/solutions/hiring/server/openings'`, exit 1.

- [ ] **Step 4: Write the errors and content loaders**

Create `src/solutions/hiring/server/errors.ts`:

```ts
/** Thrown when an id is not in the caller's organisation, opening or draft. Pages answer 404. */
export class HiringNotFound extends Error {
  readonly code = "NOT_FOUND";
  constructor(readonly what: string) {
    super(`${what} not found`);
    this.name = "HiringNotFound";
  }
}

export type ConflictCode = "NO_DRAFT" | "COMPETENCY" | "CHOICE_COMPETENCY" | "TOO_MANY_COMPETENCIES";

/** A request that is well formed but not allowed in the current state. */
export class HiringConflict extends Error {
  constructor(readonly code: ConflictCode) {
    super(code);
    this.name = "HiringConflict";
  }
}
```

Create `src/solutions/hiring/server/content.ts`:

```ts
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import {
  competencies,
  competencyAnchors,
  hiringActivities,
  hiringActivityCompetencies,
  hiringStages,
  hiringVersions,
  observationTags,
  positionCompetencies,
  ratingScales,
  scaleLevels,
  type ScorecardSnapshot,
} from "@/db/schema";
import type { CompetencyFacts, VersionContent } from "../rules/content";

export async function loadVersionContent(versionId: string, x: Executor = db): Promise<VersionContent | null> {
  const [version] = await x.select().from(hiringVersions).where(eq(hiringVersions.id, versionId)).limit(1);
  if (!version) return null;
  const stages = await x.select().from(hiringStages).where(eq(hiringStages.versionId, versionId)).orderBy(asc(hiringStages.orderIndex), asc(hiringStages.id));
  const stageIds = stages.map((st) => st.id);
  const activities = stageIds.length
    ? await x.select().from(hiringActivities).where(inArray(hiringActivities.stageId, stageIds)).orderBy(asc(hiringActivities.orderIndex), asc(hiringActivities.id))
    : [];
  const activityIds = activities.map((a) => a.id);
  const mappings = activityIds.length
    ? await x
        .select()
        .from(hiringActivityCompetencies)
        .where(inArray(hiringActivityCompetencies.activityId, activityIds))
        .orderBy(asc(hiringActivityCompetencies.orderIndex))
    : [];
  return {
    id: version.id,
    number: version.versionNumber,
    status: version.status,
    defaultLocale: version.defaultLocale,
    localeSet: version.localeSet,
    weightsEnabled: version.weightsEnabled,
    draftWeights: version.draftWeights,
    previewedAt: version.previewedAt,
    stages: stages.map((st) => ({
      id: st.id,
      orderIndex: st.orderIndex,
      name: st.name,
      description: st.description,
      internalPurpose: st.internalPurpose,
      durationSeconds: st.durationSeconds,
      graceSeconds: st.graceSeconds,
      onTimeout: st.onTimeout,
      backNavigation: st.backNavigation,
      activities: activities
        .filter((a) => a.stageId === st.id)
        .map((a) => ({
          id: a.id,
          orderIndex: a.orderIndex,
          type: a.type,
          required: a.required,
          prompt: a.prompt,
          note: a.note,
          internalQuestion: a.internalQuestion,
          expectedBehaviours: a.expectedBehaviours,
          redFlags: a.redFlags,
          managerNotes: a.managerNotes,
          answerExamples: a.answerExamples,
          thinkSeconds: a.thinkSeconds,
          flexibleThink: a.flexibleThink,
          answerSeconds: a.answerSeconds,
          maxTakes: a.maxTakes,
          config: a.config,
          competencyIds: mappings.filter((m) => m.activityId === a.id).map((m) => m.competencyId),
        })),
    })),
  };
}

export async function loadCompetencyFacts(orgId: string, ids: string[], x: Executor = db): Promise<Map<string, CompetencyFacts>> {
  if (ids.length === 0) return new Map();
  const rows = await x.select().from(competencies).where(and(eq(competencies.orgId, orgId), inArray(competencies.id, ids)));
  const found = rows.map((r) => r.id);
  if (found.length === 0) return new Map();
  const [anchors, tags] = await Promise.all([
    x.select().from(competencyAnchors).where(inArray(competencyAnchors.competencyId, found)),
    x.select().from(observationTags).where(inArray(observationTags.competencyId, found)).orderBy(asc(observationTags.orderIndex)),
  ]);
  return new Map(
    rows.map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        archived: c.archivedAt !== null,
        anchors: Object.fromEntries(anchors.filter((a) => a.competencyId === c.id).map((a) => [a.value, a.body])),
        tags: tags
          .filter((t) => t.competencyId === c.id)
          .map((t) => ({ id: t.id, polarity: t.polarity, label: t.label, archived: t.archivedAt !== null })),
      },
    ]),
  );
}

export async function loadScaleSnapshot(orgId: string, x: Executor = db): Promise<ScorecardSnapshot["scale"]> {
  const [scale] = await x
    .select()
    .from(ratingScales)
    .where(and(eq(ratingScales.orgId, orgId), eq(ratingScales.isDefault, true)))
    .limit(1);
  if (!scale) throw new Error(`organisation ${orgId} has no default rating scale`);
  const levels = await x.select({ value: scaleLevels.value, label: scaleLevels.label }).from(scaleLevels).where(eq(scaleLevels.scaleId, scale.id)).orderBy(asc(scaleLevels.value));
  return { min: scale.minValue, max: scale.maxValue, levels };
}

export async function positionProfile(positionId: string, x: Executor = db): Promise<Array<{ competencyId: string; weight: number }>> {
  return x
    .select({ competencyId: positionCompetencies.competencyId, weight: positionCompetencies.weight })
    .from(positionCompetencies)
    .where(eq(positionCompetencies.positionId, positionId))
    .orderBy(asc(positionCompetencies.orderIndex));
}
```

- [ ] **Step 5: Write versions and draft editing**

Create `src/solutions/hiring/server/versions.ts`:

```ts
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { competencies, hiringActivities, hiringActivityCompetencies, hiringOpenings, hiringStages, hiringVersions, hiringWeightSets, hiringWeights } from "@/db/schema";
import { isChoice, MAX_COMPETENCIES_PER_ACTIVITY, usedCompetencyIds, type ActivityType } from "../rules/content";
import {
  activityPatchSchema,
  activityPayloadOf,
  activityPayloadSchema,
  defaultsFor,
  emptyActivity,
  stagePatchSchema,
  stagePayloadOf,
  stagePayloadSchema,
  type ActivityPatch,
  type ActivityPayload,
  type StagePatch,
  type StagePayload,
} from "../rules/patches";
import { workingVersions, type VersionSummary } from "../rules/versions";
import { weightsProblem } from "../rules/weights";
import { loadVersionContent } from "./content";
import { HiringConflict, HiringNotFound } from "./errors";

/**
 * Versions of an opening's assessment. Every edit goes to the opening's single
 * draft; a published version is frozen by the database (migration 0006).
 * Edits lock the opening row so two editors renumber in turn.
 */

export async function versionsOf(openingId: string, x: Executor = db): Promise<VersionSummary[]> {
  return x
    .select({
      id: hiringVersions.id,
      number: hiringVersions.versionNumber,
      status: hiringVersions.status,
      publishedAt: hiringVersions.publishedAt,
      previewedAt: hiringVersions.previewedAt,
    })
    .from(hiringVersions)
    .where(eq(hiringVersions.openingId, openingId))
    .orderBy(desc(hiringVersions.versionNumber));
}

async function lockOpening(x: Executor, orgId: string, openingId: string) {
  const [row] = await x
    .select({ id: hiringOpenings.id })
    .from(hiringOpenings)
    .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, orgId)))
    .for("update");
  if (!row) throw new HiringNotFound("opening");
}

async function draftOf(x: Executor, orgId: string, openingId: string): Promise<string> {
  await lockOpening(x, orgId, openingId);
  const { draft } = workingVersions(await versionsOf(openingId, x));
  if (!draft) throw new HiringConflict("NO_DRAFT");
  return draft.id;
}

async function stageIds(x: Executor, versionId: string): Promise<string[]> {
  const rows = await x.select({ id: hiringStages.id }).from(hiringStages).where(eq(hiringStages.versionId, versionId)).orderBy(asc(hiringStages.orderIndex), asc(hiringStages.id));
  return rows.map((r) => r.id);
}

async function activityIds(x: Executor, stageId: string): Promise<string[]> {
  const rows = await x
    .select({ id: hiringActivities.id })
    .from(hiringActivities)
    .where(eq(hiringActivities.stageId, stageId))
    .orderBy(asc(hiringActivities.orderIndex), asc(hiringActivities.id));
  return rows.map((r) => r.id);
}

async function renumberStages(x: Executor, ids: string[]) {
  for (const [orderIndex, id] of ids.entries()) await x.update(hiringStages).set({ orderIndex }).where(eq(hiringStages.id, id));
}

async function renumberActivities(x: Executor, ids: string[]) {
  for (const [orderIndex, id] of ids.entries()) await x.update(hiringActivities).set({ orderIndex }).where(eq(hiringActivities.id, id));
}

async function ownStage(x: Executor, versionId: string, stageId: string) {
  const [row] = await x
    .select({ id: hiringStages.id })
    .from(hiringStages)
    .where(and(eq(hiringStages.id, stageId), eq(hiringStages.versionId, versionId)))
    .limit(1);
  if (!row) throw new HiringNotFound("stage");
}

async function ownActivity(x: Executor, versionId: string, activityId: string): Promise<{ stageId: string; type: ActivityType }> {
  const [row] = await x
    .select({ stageId: hiringActivities.stageId, type: hiringActivities.type })
    .from(hiringActivities)
    .innerJoin(hiringStages, eq(hiringStages.id, hiringActivities.stageId))
    .where(and(eq(hiringActivities.id, activityId), eq(hiringStages.versionId, versionId)))
    .limit(1);
  if (!row) throw new HiringNotFound("activity");
  return row;
}

/** A question may only measure the organisation's own, active competencies. */
async function assertCompetencies(x: Executor, orgId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = await x
    .select({ id: competencies.id })
    .from(competencies)
    .where(and(eq(competencies.orgId, orgId), inArray(competencies.id, unique), isNull(competencies.archivedAt)));
  if (rows.length !== unique.length) throw new HiringConflict("COMPETENCY");
}

async function insertActivityRow(x: Executor, stageId: string, orderIndex: number, payload: ActivityPayload): Promise<string> {
  const { competencyIds, ...fields } = payload;
  const [row] = await x.insert(hiringActivities).values({ stageId, orderIndex, ...fields }).returning({ id: hiringActivities.id });
  const ids = isChoice(payload.type) ? [] : competencyIds.slice(0, MAX_COMPETENCIES_PER_ACTIVITY);
  if (ids.length) {
    await x.insert(hiringActivityCompetencies).values(ids.map((competencyId, i) => ({ activityId: row.id, competencyId, orderIndex: i })));
  }
  return row.id;
}

async function insertStageRows(x: Executor, versionId: string, orderIndex: number, payload: StagePayload): Promise<string> {
  const { activities, ...fields } = payload;
  const [row] = await x.insert(hiringStages).values({ versionId, orderIndex, ...fields }).returning({ id: hiringStages.id });
  for (const [i, activity] of activities.entries()) await insertActivityRow(x, row.id, i, activity);
  return row.id;
}

export async function cloneContent(x: Executor, fromVersionId: string, toVersionId: string) {
  const source = await loadVersionContent(fromVersionId, x);
  if (!source) throw new HiringNotFound("version");
  for (const stage of source.stages) await insertStageRows(x, toVersionId, stage.orderIndex, stagePayloadOf(stage));
}

/** The newest weight set of a published version: what the next draft starts from. */
export async function latestWeights(
  x: Executor,
  versionId: string,
): Promise<{ enabled: boolean; weights: Record<string, number>; label: string; reason: string | null; createdAt: Date } | null> {
  const [set] = await x.select().from(hiringWeightSets).where(eq(hiringWeightSets.versionId, versionId)).orderBy(desc(hiringWeightSets.createdAt)).limit(1);
  if (!set) return null;
  const rows = await x.select().from(hiringWeights).where(eq(hiringWeights.weightSetId, set.id));
  return {
    enabled: set.isActive,
    weights: Object.fromEntries(rows.map((r) => [r.competencyId, Number(r.percentage)])),
    label: set.label,
    reason: set.reason,
    createdAt: set.createdAt,
  };
}

/**
 * The opening's draft, opened from the newest published version when there is
 * none (HIRING-UX 5.5: editing a published assessment creates v(n+1)).
 */
export async function ensureDraftVersion(orgId: string, openingId: string): Promise<{ versionId: string; created: boolean }> {
  return db.transaction(async (tx) => {
    await lockOpening(tx, orgId, openingId);
    const list = await versionsOf(openingId, tx);
    const { draft, live } = workingVersions(list);
    if (draft) return { versionId: draft.id, created: false };
    const [source] = live ? await tx.select().from(hiringVersions).where(eq(hiringVersions.id, live.id)) : [];
    const weights = live ? await latestWeights(tx, live.id) : null;
    const [created] = await tx
      .insert(hiringVersions)
      .values({
        orgId,
        openingId,
        versionNumber: (list[0]?.number ?? 0) + 1,
        defaultLocale: source?.defaultLocale ?? "tr",
        localeSet: source?.localeSet ?? ["tr"],
        introTitle: source?.introTitle ?? null,
        introBody: source?.introBody ?? null,
        proctorLevel: source?.proctorLevel ?? "BASIC",
        practiceEnabled: source?.practiceEnabled ?? true,
        weightsEnabled: weights?.enabled ?? false,
        draftWeights: weights?.enabled ? weights.weights : null,
      })
      .returning({ id: hiringVersions.id });
    if (live) await cloneContent(tx, live.id, created.id);
    return { versionId: created.id, created: true };
  });
}

export async function addStage(orgId: string, openingId: string): Promise<string> {
  return db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const ids = await stageIds(tx, versionId);
    return insertStageRows(tx, versionId, ids.length, {
      name: { tr: "", en: "" },
      description: { tr: "", en: "" },
      internalPurpose: null,
      durationSeconds: 600,
      graceSeconds: 0,
      onTimeout: "AUTO_SUBMIT",
      backNavigation: false,
      activities: [],
    });
  });
}

export async function updateStage(orgId: string, openingId: string, stageId: string, patch: StagePatch) {
  const parsed = stagePatchSchema.parse(patch);
  await db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    await ownStage(tx, versionId, stageId);
    await tx.update(hiringStages).set(parsed).where(eq(hiringStages.id, stageId));
  });
}

export async function moveStage(orgId: string, openingId: string, stageId: string, direction: -1 | 1) {
  await db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const ids = await stageIds(tx, versionId);
    const i = ids.indexOf(stageId);
    if (i === -1) throw new HiringNotFound("stage");
    const j = i + direction;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await renumberStages(tx, ids);
  });
}

export async function deleteStage(orgId: string, openingId: string, stageId: string): Promise<{ payload: StagePayload; index: number }> {
  return db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const content = await loadVersionContent(versionId, tx);
    const index = content!.stages.findIndex((st) => st.id === stageId);
    if (index === -1) throw new HiringNotFound("stage");
    const payload = stagePayloadOf(content!.stages[index]);
    await tx.delete(hiringStages).where(eq(hiringStages.id, stageId));
    await renumberStages(tx, await stageIds(tx, versionId));
    return { payload, index };
  });
}

/** Undo of a delete, and an accepted AI stage card. */
export async function insertStage(orgId: string, openingId: string, payload: StagePayload, index: number | null = null): Promise<string> {
  const parsed = stagePayloadSchema.parse(payload);
  return db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    await assertCompetencies(tx, orgId, parsed.activities.flatMap((a) => (isChoice(a.type) ? [] : a.competencyIds)));
    const ids = await stageIds(tx, versionId);
    const at = index === null ? ids.length : Math.max(0, Math.min(index, ids.length));
    const id = await insertStageRows(tx, versionId, at, parsed);
    await renumberStages(tx, [...ids.slice(0, at), id, ...ids.slice(at)]);
    return id;
  });
}

export async function addActivity(orgId: string, openingId: string, stageId: string, type: ActivityType): Promise<string> {
  return db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    await ownStage(tx, versionId, stageId);
    const ids = await activityIds(tx, stageId);
    return insertActivityRow(tx, stageId, ids.length, emptyActivity(type));
  });
}

export async function updateActivity(orgId: string, openingId: string, activityId: string, patch: ActivityPatch) {
  const parsed = activityPatchSchema.parse(patch);
  await db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const current = await ownActivity(tx, versionId, activityId);
    let next: ActivityPatch = parsed;
    if (parsed.type && parsed.type !== current.type) {
      // A new type brings that type's settings; explicit fields in the patch still win.
      next = { ...defaultsFor(parsed.type), ...parsed };
      if (isChoice(parsed.type)) await tx.delete(hiringActivityCompetencies).where(eq(hiringActivityCompetencies.activityId, activityId));
    }
    await tx.update(hiringActivities).set(next).where(eq(hiringActivities.id, activityId));
  });
}

export async function moveActivity(orgId: string, openingId: string, activityId: string, direction: -1 | 1) {
  await db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const { stageId } = await ownActivity(tx, versionId, activityId);
    const ids = await activityIds(tx, stageId);
    const i = ids.indexOf(activityId);
    const j = i + direction;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await renumberActivities(tx, ids);
  });
}

export async function deleteActivity(orgId: string, openingId: string, activityId: string): Promise<{ payload: ActivityPayload; stageId: string; index: number }> {
  return db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const { stageId } = await ownActivity(tx, versionId, activityId);
    const content = await loadVersionContent(versionId, tx);
    const activities = content!.stages.find((st) => st.id === stageId)!.activities;
    const index = activities.findIndex((a) => a.id === activityId);
    const payload = activityPayloadOf(activities[index]);
    await tx.delete(hiringActivities).where(eq(hiringActivities.id, activityId));
    await renumberActivities(tx, await activityIds(tx, stageId));
    return { payload, stageId, index };
  });
}

export async function insertActivity(orgId: string, openingId: string, stageId: string, payload: ActivityPayload, index: number | null = null): Promise<string> {
  const parsed = activityPayloadSchema.parse(payload);
  return db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    await ownStage(tx, versionId, stageId);
    await assertCompetencies(tx, orgId, isChoice(parsed.type) ? [] : parsed.competencyIds);
    const ids = await activityIds(tx, stageId);
    const at = index === null ? ids.length : Math.max(0, Math.min(index, ids.length));
    const id = await insertActivityRow(tx, stageId, at, parsed);
    await renumberActivities(tx, [...ids.slice(0, at), id, ...ids.slice(at)]);
    return id;
  });
}

export async function setActivityCompetencies(orgId: string, openingId: string, activityId: string, competencyIds: string[]) {
  const ids = [...new Set(competencyIds)];
  await db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const current = await ownActivity(tx, versionId, activityId);
    if (isChoice(current.type) && ids.length) throw new HiringConflict("CHOICE_COMPETENCY");
    if (ids.length > MAX_COMPETENCIES_PER_ACTIVITY) throw new HiringConflict("TOO_MANY_COMPETENCIES");
    await assertCompetencies(tx, orgId, ids);
    await tx.delete(hiringActivityCompetencies).where(eq(hiringActivityCompetencies.activityId, activityId));
    if (ids.length) {
      await tx.insert(hiringActivityCompetencies).values(ids.map((competencyId, orderIndex) => ({ activityId, competencyId, orderIndex })));
    }
  });
}

/** HIRING-UX 5.7 for a draft: weighting off means a plain average; on needs 100%. */
export async function saveDraftWeights(
  orgId: string,
  openingId: string,
  input: { enabled: boolean; weights: Record<string, number> },
): Promise<{ ok: true } | { ok: false; total: number }> {
  return db.transaction(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const content = await loadVersionContent(versionId, tx);
    const used = usedCompetencyIds(content!);
    const weights = Object.fromEntries(used.map((id) => [id, input.weights[id] ?? 0]));
    if (input.enabled) {
      const problem = weightsProblem(weights, used);
      if (problem) return { ok: false as const, total: problem.total };
    }
    await tx
      .update(hiringVersions)
      .set({ weightsEnabled: input.enabled, draftWeights: input.enabled ? weights : null, updatedAt: new Date() })
      .where(eq(hiringVersions.id, versionId));
    return { ok: true as const };
  });
}
```

- [ ] **Step 6: Write openings**

Create `src/solutions/hiring/server/openings.ts`:

```ts
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, hiringOpeningMembers, hiringOpenings, hiringVersions, positions, users } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { createPosition } from "@/server/library-write";
import { isUuid } from "@/server/settings";
import { openingAccess, type Viewer } from "../rules/access";
import { workingVersions } from "../rules/versions";
import { cloneContent, versionsOf } from "./versions";

export type OpeningStatus = "DRAFT" | "OPEN" | "CLOSED";
export type OpeningDetail = typeof hiringOpenings.$inferSelect & { positionName: string; memberIds: string[] };

export async function loadOpening(orgId: string, id: string): Promise<OpeningDetail | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({ opening: hiringOpenings, positionName: positions.name })
    .from(hiringOpenings)
    .innerJoin(positions, eq(positions.id, hiringOpenings.positionId))
    .where(and(eq(hiringOpenings.id, id), eq(hiringOpenings.orgId, orgId)))
    .limit(1);
  if (!row) return null;
  const members = await db.select({ userId: hiringOpeningMembers.userId }).from(hiringOpeningMembers).where(eq(hiringOpeningMembers.openingId, id));
  return { ...row.opening, positionName: row.positionName, memberIds: members.map((m) => m.userId) };
}

export type OpeningListRow = {
  id: string;
  name: string;
  status: OpeningStatus;
  deadlineAt: Date | null;
  positionName: string;
  ownerName: string | null;
  liveNumber: number | null;
  draftNumber: number | null;
};

/** HIRING-UX 5.2. A reviewer sees only the openings they work on. */
export async function listOpenings(orgId: string, viewer: Viewer, status: OpeningStatus): Promise<OpeningListRow[]> {
  const rows = await db
    .select({
      id: hiringOpenings.id,
      name: hiringOpenings.name,
      status: hiringOpenings.status,
      deadlineAt: hiringOpenings.deadlineAt,
      decisionMakerId: hiringOpenings.decisionMakerId,
      backupDecisionMakerId: hiringOpenings.backupDecisionMakerId,
      positionName: positions.name,
      ownerName: users.name,
    })
    .from(hiringOpenings)
    .innerJoin(positions, eq(positions.id, hiringOpenings.positionId))
    .leftJoin(users, eq(users.id, hiringOpenings.ownerId))
    .where(and(eq(hiringOpenings.orgId, orgId), eq(hiringOpenings.status, status)))
    .orderBy(desc(hiringOpenings.createdAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [members, versions] = await Promise.all([
    db.select().from(hiringOpeningMembers).where(inArray(hiringOpeningMembers.openingId, ids)),
    db
      .select({ openingId: hiringVersions.openingId, number: hiringVersions.versionNumber, status: hiringVersions.status })
      .from(hiringVersions)
      .where(inArray(hiringVersions.openingId, ids))
      .orderBy(desc(hiringVersions.versionNumber)),
  ]);
  return rows
    .filter(
      (r) =>
        openingAccess(viewer, {
          decisionMakerId: r.decisionMakerId,
          backupDecisionMakerId: r.backupDecisionMakerId,
          memberIds: members.filter((m) => m.openingId === r.id).map((m) => m.userId),
        }).view,
    )
    .map((r) => {
      const own = versions.filter((v) => v.openingId === r.id);
      return {
        id: r.id,
        name: r.name,
        status: r.status,
        deadlineAt: r.deadlineAt,
        positionName: r.positionName,
        ownerName: r.ownerName,
        liveNumber: own.find((v) => v.status === "PUBLISHED")?.number ?? null,
        draftNumber: own.find((v) => v.status === "DRAFT")?.number ?? null,
      };
    });
}

/** Openings whose assessment can be copied into a new one (HIRING-UX 5.3 "Önceki bir alımdan kopyala"). */
export async function copySources(orgId: string): Promise<Array<{ id: string; name: string }>> {
  const rows = await db
    .select({ id: hiringOpenings.id, name: hiringOpenings.name })
    .from(hiringOpenings)
    .where(eq(hiringOpenings.orgId, orgId))
    .orderBy(desc(hiringOpenings.createdAt));
  return rows;
}

export type CreateOpeningInput = {
  position: { kind: "existing"; id: string } | { kind: "new"; name: string; jobDescription: string };
  start: "AI" | "COPY" | "BLANK";
  copyFrom: string | null;
  locale: Locale;
};

export type CreateOpeningResult =
  | { ok: true; openingId: string; next: string }
  | { ok: false; code: "POSITION_NAME_REQUIRED" | "POSITION_NOT_FOUND" | "JOB_AD_REQUIRED" | "COPY_SOURCE_NOT_FOUND" };

const monthName = (locale: Locale) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", { month: "long", timeZone: "Europe/Istanbul" }).format(new Date());

/**
 * HIRING-UX 5.3. Everything is checked before anything is written, so a refused
 * start leaves no stray position behind. The creator owns the opening and is
 * its first decision maker; v1 is an empty draft or a copy.
 */
export async function createOpening(user: { id: string; orgId: string }, input: CreateOpeningInput): Promise<CreateOpeningResult> {
  return db.transaction(async (tx) => {
    let position: { id: string | null; name: string; jobDescription: string | null };
    if (input.position.kind === "new") {
      if (!input.position.name.trim()) return { ok: false as const, code: "POSITION_NAME_REQUIRED" as const };
      position = { id: null, name: input.position.name.trim(), jobDescription: input.position.jobDescription.trim() || null };
    } else {
      if (!isUuid(input.position.id)) return { ok: false as const, code: "POSITION_NOT_FOUND" as const };
      const [row] = await tx
        .select({ id: positions.id, name: positions.name, jobDescription: positions.jobDescription })
        .from(positions)
        .where(and(eq(positions.id, input.position.id), eq(positions.orgId, user.orgId), isNull(positions.archivedAt)))
        .limit(1);
      if (!row) return { ok: false as const, code: "POSITION_NOT_FOUND" as const };
      position = row;
    }
    if (input.start === "AI" && !position.jobDescription?.trim()) return { ok: false as const, code: "JOB_AD_REQUIRED" as const };
    let sourceVersionId: string | null = null;
    if (input.start === "COPY") {
      const [source] =
        input.copyFrom && isUuid(input.copyFrom)
          ? await tx
              .select({ id: hiringOpenings.id })
              .from(hiringOpenings)
              .where(and(eq(hiringOpenings.id, input.copyFrom), eq(hiringOpenings.orgId, user.orgId)))
              .limit(1)
          : [];
      const { live, draft } = source ? workingVersions(await versionsOf(source.id, tx)) : { live: null, draft: null };
      sourceVersionId = (live ?? draft)?.id ?? null;
      if (!sourceVersionId) return { ok: false as const, code: "COPY_SOURCE_NOT_FOUND" as const };
    }

    let positionId = position.id;
    if (!positionId) {
      const created = await createPosition(user.orgId, user.id, { name: position.name, jobDescription: position.jobDescription ?? "" }, tx);
      if (!created.ok) return { ok: false as const, code: "POSITION_NAME_REQUIRED" as const };
      positionId = created.id;
    }
    const [opening] = await tx
      .insert(hiringOpenings)
      .values({ orgId: user.orgId, positionId, name: `${position.name} · ${monthName(input.locale)}`, ownerId: user.id, decisionMakerId: user.id })
      .returning({ id: hiringOpenings.id });
    const [version] = await tx.insert(hiringVersions).values({ orgId: user.orgId, openingId: opening.id, versionNumber: 1 }).returning({ id: hiringVersions.id });
    if (sourceVersionId) await cloneContent(tx, sourceVersionId, version.id);
    await tx.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "hiring.opening.create",
      subjectType: "hiring_opening",
      subjectId: opening.id,
      meta: { positionId, start: input.start, copyFrom: input.start === "COPY" ? input.copyFrom : null },
    });
    const base = `/hiring/openings/${opening.id}`;
    return { ok: true as const, openingId: opening.id, next: input.start === "AI" ? `${base}/assessment/ai` : `${base}/assessment/edit` };
  });
}
```

- [ ] **Step 7: Run the script to verify it passes, then the gates**

```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_hiring_check" -c "create database kademe_hiring_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm verify:hiring-setup; echo "exit $?"
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_hiring_check"
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
```
Expected: every line `ok`, `all checks passed`, `exit 0`; gates PASS.

- [ ] **Step 8: Commit**

```bash
git add src/solutions/hiring/rules/patches.ts src/solutions/hiring/rules/patches.test.ts src/solutions/hiring/server scripts/verify-hiring-setup.ts package.json
git commit -m "Add the hiring data layer for openings and draft editing" -m "Openings are created from an existing or a new position (checked before anything is written), blank or as a copy of another opening's assessment. Every builder edit goes to the opening's single draft under a row lock, keeps order 0..n-1, validates with zod and refuses competencies of another organisation, archived ones, more than two, or any on a choice question. Deleting returns a payload that undo inserts back in place. verify:hiring-setup proves it on a throw-away database." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Publishing and weight sets

**Files:**
- Create: `src/solutions/hiring/server/publish.ts`
- Create: `src/solutions/hiring/server/weight-sets.ts`
- Modify: `scripts/verify-hiring-setup.ts`

**Interfaces:**
- Consumes: Tasks 10 and 11.
- Produces in `server/publish`: `type PublishOutcome = { ok: true; versionId: string; number: number } | { ok: false; problems: PublishProblem[] }`, `publishDraft(orgId: string, openingId: string, userId: string): Promise<PublishOutcome>`.
- Produces in `server/weight-sets`: `addWeightSet(orgId, openingId, input: { enabled: boolean; weights: Record<string, number>; reason: string }, userId): Promise<{ ok: true } | { ok: false; code: "NO_LIVE" | "REASON_REQUIRED" | "NOT_100"; total?: number }>`.

- [ ] **Step 1: Extend the script with the failing publishing checks**

In `scripts/verify-hiring-setup.ts`, add to the imports inside `main` (after the `loadVersionContent` import):

```ts
  const { publishDraft } = await import("@/solutions/hiring/server/publish");
  const { addWeightSet } = await import("@/solutions/hiring/server/weight-sets");
  const { saveCompetency, createCompetency } = await import("@/server/library-write");
  const postgres = (await import("postgres")).default;
```

and replace the line `  // TASK 12: publishing checks go here.` with:

```ts
  console.log("\nThe publish gate");
  const bare = await createCompetency(org.id, owner.id, { name: { tr: "Analitik düşünme", en: "" }, description: { tr: "", en: "" } });
  if (!bare.ok) throw new Error("competency");
  const [live1] = await versions.versionsOf(id);
  const firstStage = (await loadVersionContent(live1.id))!.stages[0];
  const videoId = firstStage.activities[0].id;
  const choiceId = firstStage.activities[1].id;
  await versions.setActivityCompetencies(org.id, id, videoId, [communication, bare.id]);
  let outcome = await publishDraft(org.id, id, owner.id);
  check(
    !outcome.ok && outcome.problems.some((p) => p.code === "ANCHOR_MISSING" && p.competencyId === bare.id && p.level === 1),
    "a competency without anchors blocks publishing",
    JSON.stringify(outcome),
  );
  check(!outcome.ok && outcome.problems.some((p) => p.code === "CHOICE_NEEDS_ANSWER" || p.code === "CHOICE_NEEDS_OPTIONS"), "so does a choice question without options");
  check((await versions.versionsOf(id))[0].status === "DRAFT", "a refused publish changes nothing");
  await saveCompetency(org.id, owner.id, bare.id, {
    name: { tr: "Analitik düşünme", en: "" },
    description: { tr: "", en: "" },
    anchors: {
      1: { tr: "Veriye bakmadan sonuca atlıyor.", en: "" },
      3: { tr: "Veriyi iki boyutta ayırıyor ve bir sonuç çıkarıyor.", en: "" },
      5: { tr: "Veriyi ayırıyor, sonucu sınıyor ve eksik veriyi söylüyor.", en: "" },
    },
    tags: [],
    markReviewed: false,
  });
  await versions.updateActivity(org.id, id, choiceId, {
    prompt: { tr: "Hangisi bir kullanıcı araştırması yöntemidir?", en: "" },
    config: {
      choices: [
        { id: "a", label: { tr: "Görüşme", en: "Interview" }, correct: true },
        { id: "b", label: { tr: "Fatura", en: "Invoice" } },
      ],
    },
  });
  await versions.setActivityCompetencies(org.id, id, videoId, [communication, problem]);
  outcome = await publishDraft(org.id, id, owner.id);
  check(outcome.ok, "a complete draft publishes", JSON.stringify(outcome));

  console.log("\nWhat publishing wrote");
  const [published] = await db.select().from(s.hiringVersions).where(eq(s.hiringVersions.id, live1.id));
  check(published.status === "PUBLISHED" && published.publishedBy === owner.id && published.publishedAt !== null, "v1 is published, by whom and when");
  check(published.scorecard!.competencies.map((c) => c.id).join() === [communication, problem].join(), "the scorecard lists exactly the measured competencies");
  check(published.scorecard!.competencies.map((c) => c.weight).join() === "75,25", "weights come from the profile, scaled to 100", published.scorecard!.competencies.map((c) => c.weight).join());
  check(published.scorecard!.weightsEnabled === false, "weighting is off by default (plain average)");
  const sets = await db.select().from(s.hiringWeightSets).where(eq(s.hiringWeightSets.versionId, live1.id));
  check(sets.length === 1 && sets[0].isActive === false, "the first weight set is written from the scorecard");
  check((await openings.loadOpening(org.id, id))?.status === "OPEN", "the opening is open");

  console.log("\nThe library changes, the published scorecard does not");
  const anchorBefore = published.scorecard!.competencies[0].anchors[3].tr;
  await db.update(s.competencyAnchors).set({ body: { tr: "DEĞİŞTİ", en: "" } }).where(eq(s.competencyAnchors.competencyId, communication));
  const [after] = await db.select().from(s.hiringVersions).where(eq(s.hiringVersions.id, live1.id));
  check(after.scorecard!.competencies[0].anchors[3].tr === anchorBefore, "anchor text in v1 is unchanged");

  console.log("\nThe database refuses edits to the published version");
  const raw = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await expectCode("a direct update of a published stage", () => raw`update hiring_stages set duration_seconds = 900 where id = ${firstStage.id}`, "23514");
  await raw.end();
  await expectCode("the builder has no draft to edit", () => versions.addStage(org.id, id), "NO_DRAFT");

  console.log("\nWeights after publishing (HIRING-UX 5.7, R10)");
  const refusedReason = await addWeightSet(org.id, id, { enabled: true, weights: { [communication]: 70, [problem]: 30 }, reason: " " }, owner.id);
  check(!refusedReason.ok && refusedReason.code === "REASON_REQUIRED", "a reason is required");
  const refused95 = await addWeightSet(org.id, id, { enabled: true, weights: { [communication]: 70, [problem]: 25 }, reason: "Kalibrasyon" }, owner.id);
  check(!refused95.ok && refused95.code === "NOT_100" && refused95.total === 95, "the total must be 100");
  const added = await addWeightSet(org.id, id, { enabled: true, weights: { [communication]: 70, [problem]: 30 }, reason: "Kalibrasyon sonrası" }, owner.id);
  check(added.ok, "a new weight set with a reason is added");
  const setsAfter = await db.select().from(s.hiringWeightSets).where(eq(s.hiringWeightSets.versionId, live1.id));
  check(setsAfter.length === 2 && setsAfter.filter((x) => x.isActive).length === 1, "it is the one active set");
  const [stillSame] = await db.select().from(s.hiringVersions).where(eq(s.hiringVersions.id, live1.id));
  check(stillSame.scorecard!.competencies.map((c) => c.weight).join() === "75,25", "the published scorecard keeps its weights");

  console.log("\nEditing after publishing opens v2");
  const draft2 = await versions.ensureDraftVersion(org.id, id);
  check(draft2.created, "v2 is created");
  const again = await versions.ensureDraftVersion(org.id, id);
  check(!again.created && again.versionId === draft2.versionId, "asking again returns the same draft");
  const v2content = await loadVersionContent(draft2.versionId);
  check(v2content!.number === 2 && v2content!.stages.length === 1 && v2content!.stages[0].id !== firstStage.id, "v2 is a copy with new ids");
  check(v2content!.weightsEnabled && v2content!.draftWeights?.[communication] === 70, "v2 starts from the newest weight set");
  await versions.updateStage(org.id, id, v2content!.stages[0].id, { durationSeconds: 900 });
  const v1content = await loadVersionContent(live1.id);
  check(v1content!.stages[0].durationSeconds === firstStage.durationSeconds, "editing v2 leaves v1 alone");
  outcome = await publishDraft(org.id, id, owner.id);
  check(outcome.ok && outcome.number === 2, "v2 publishes");
  const finalList = await versions.versionsOf(id);
  check(finalList.map((v) => `${v.number}${v.status[0]}`).join() === "2P,1P", "both versions stay published", finalList.map((v) => `${v.number}${v.status}`).join());
```

Run it on a fresh throw-away database (Task 11 Step 7 commands). Expected: FAIL with `Cannot find module '@/solutions/hiring/server/publish'`.

- [ ] **Step 2: Implement publishing**

Create `src/solutions/hiring/server/publish.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, hiringOpenings, hiringVersions, hiringWeightSets, hiringWeights } from "@/db/schema";
import { usedCompetencyIds } from "../rules/content";
import { publishProblems, type PublishProblem } from "../rules/gate";
import { buildScorecard } from "../rules/scorecard";
import { workingVersions } from "../rules/versions";
import { loadCompetencyFacts, loadScaleSnapshot, loadVersionContent, positionProfile } from "./content";
import { HiringConflict, HiringNotFound } from "./errors";
import { versionsOf } from "./versions";

export type PublishOutcome = { ok: true; versionId: string; number: number } | { ok: false; problems: PublishProblem[] };

/**
 * Publish = lock (hiring solution design 2.2-2.3). In one transaction, under
 * the opening's row lock: run the gate on the draft as stored, copy the
 * scorecard (anchors, tags, weights) into the version, write the first weight
 * set, open the opening. After this the triggers of migration 0006 refuse every
 * change to the version.
 */
export async function publishDraft(orgId: string, openingId: string, userId: string): Promise<PublishOutcome> {
  return db.transaction(async (tx) => {
    const [opening] = await tx
      .select()
      .from(hiringOpenings)
      .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, orgId)))
      .for("update");
    if (!opening) throw new HiringNotFound("opening");
    const { draft } = workingVersions(await versionsOf(openingId, tx));
    if (!draft) throw new HiringConflict("NO_DRAFT");
    const content = (await loadVersionContent(draft.id, tx))!;
    const used = usedCompetencyIds(content);
    const facts = await loadCompetencyFacts(orgId, used, tx);
    const problems = publishProblems(content, facts);
    if (problems.length) return { ok: false as const, problems };

    const scorecard = buildScorecard({
      content,
      facts,
      scale: await loadScaleSnapshot(orgId, tx),
      profile: await positionProfile(opening.positionId, tx),
    });
    const now = new Date();
    await tx
      .update(hiringVersions)
      .set({ status: "PUBLISHED", scorecard, publishedAt: now, publishedBy: userId, updatedAt: now })
      .where(and(eq(hiringVersions.id, draft.id), eq(hiringVersions.status, "DRAFT")));
    const [set] = await tx
      .insert(hiringWeightSets)
      .values({ versionId: draft.id, label: `v${draft.number}`, isActive: scorecard.weightsEnabled, createdBy: userId })
      .returning({ id: hiringWeightSets.id });
    if (scorecard.competencies.length) {
      await tx.insert(hiringWeights).values(scorecard.competencies.map((c) => ({ weightSetId: set.id, competencyId: c.id, percentage: c.weight.toFixed(2) })));
    }
    if (opening.status === "DRAFT") {
      await tx.update(hiringOpenings).set({ status: "OPEN", updatedAt: now }).where(eq(hiringOpenings.id, openingId));
    }
    await tx.insert(auditLogs).values({
      orgId,
      actorId: userId,
      action: "hiring.version.publish",
      subjectType: "hiring_version",
      subjectId: draft.id,
      meta: { openingId, number: draft.number, competencies: used.length, weightsEnabled: scorecard.weightsEnabled },
    });
    return { ok: true as const, versionId: draft.id, number: draft.number };
  });
}
```

Create `src/solutions/hiring/server/weight-sets.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, hiringOpenings, hiringVersions, hiringWeightSets, hiringWeights } from "@/db/schema";
import { workingVersions } from "../rules/versions";
import { weightsProblem } from "../rules/weights";
import { HiringNotFound } from "./errors";
import { versionsOf } from "./versions";

/**
 * A weight change after publishing is a new set with a reason (HIRING-UX 5.7):
 * scores already given keep the set they were computed with, and the published
 * scorecard is never touched. Recomputing is a separate step (plan 3).
 */
export async function addWeightSet(
  orgId: string,
  openingId: string,
  input: { enabled: boolean; weights: Record<string, number>; reason: string },
  userId: string,
): Promise<{ ok: true } | { ok: false; code: "NO_LIVE" | "REASON_REQUIRED" | "NOT_100"; total?: number }> {
  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, code: "REASON_REQUIRED" };
  return db.transaction(async (tx) => {
    const [opening] = await tx
      .select({ id: hiringOpenings.id })
      .from(hiringOpenings)
      .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, orgId)))
      .for("update");
    if (!opening) throw new HiringNotFound("opening");
    const { live } = workingVersions(await versionsOf(openingId, tx));
    if (!live) return { ok: false as const, code: "NO_LIVE" as const };
    const [version] = await tx.select({ scorecard: hiringVersions.scorecard }).from(hiringVersions).where(eq(hiringVersions.id, live.id));
    const used = version.scorecard!.competencies.map((c) => c.id);
    const weights = Object.fromEntries(used.map((id) => [id, input.weights[id] ?? 0]));
    if (input.enabled) {
      const problem = weightsProblem(weights, used);
      if (problem) return { ok: false as const, code: "NOT_100" as const, total: problem.total };
    }
    await tx.update(hiringWeightSets).set({ isActive: false }).where(eq(hiringWeightSets.versionId, live.id));
    const [set] = await tx
      .insert(hiringWeightSets)
      .values({ versionId: live.id, label: new Date().toISOString().slice(0, 10), isActive: input.enabled, reason, createdBy: userId })
      .returning({ id: hiringWeightSets.id });
    await tx.insert(hiringWeights).values(used.map((competencyId) => ({ weightSetId: set.id, competencyId, percentage: (weights[competencyId] ?? 0).toFixed(2) })));
    await tx.insert(auditLogs).values({
      orgId,
      actorId: userId,
      action: "hiring.weights.add",
      subjectType: "hiring_version",
      subjectId: live.id,
      meta: { weightSetId: set.id, enabled: input.enabled, weights, reason },
    });
    return { ok: true as const };
  });
}
```

- [ ] **Step 3: Run the script to verify it passes, then the gates**

Run the Task 11 Step 7 commands again. Expected: every line `ok`, `all checks passed`, `exit 0`; gates PASS.

- [ ] **Step 4: Commit**

```bash
git add src/solutions/hiring/server/publish.ts src/solutions/hiring/server/weight-sets.ts scripts/verify-hiring-setup.ts
git commit -m "Publish hiring assessments and change weights after publishing" -m "publishDraft runs the gate inside a locked transaction, copies the scorecard into the version, writes the first weight set and opens the opening. A later weight change is a new active set with a reason; the published scorecard never changes. The end-to-end script now proves the gate, the snapshot against library edits, the database refusal, weight sets and the v2 draft." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: Openings list, "Alım aç" and the opening overview

**Files:**
- Create: `src/i18n/messages/hiring.tr.json`, `src/i18n/messages/hiring.en.json`
- Modify: `src/i18n/manager.ts`, `src/i18n/messages.test.ts`
- Modify: `src/solutions/hiring/server/openings.ts` (`positionOptions`)
- Create: `src/solutions/hiring/server/working.ts`
- Create: `src/app/(manager)/hiring/layout.tsx`
- Create: `src/app/(manager)/hiring/openings/page.tsx`
- Create: `src/app/(manager)/hiring/openings/new/page.tsx`, `src/app/(manager)/hiring/openings/new/actions.ts`
- Create: `src/app/(manager)/hiring/openings/[id]/access.ts`, `[id]/problems.ts`, `[id]/opening-header.tsx`, `[id]/actions.ts`, `[id]/page.tsx`
- Create: `src/components/hiring/new-opening-form.tsx`

**Interfaces:**
- Consumes: Tasks 10-12.
- Produces in `server/working`: `type WorkingState = { list; draft; live; content: VersionContent | null; facts: Map<string, CompetencyFacts>; problems: PublishProblem[] }`, `workingState(orgId, openingId): Promise<WorkingState>` (content = the draft if there is one, else the newest published version; problems only for a draft).
- Produces in `server/openings`: `positionOptions(orgId): Promise<Array<{ id: string; name: string; hasJobAd: boolean; competencyCount: number; weightsEqual: boolean }>>`.
- Produces in `[id]/access.ts`: `openingFor(openingId: string, need: "view" | "edit"): Promise<{ user: SessionUser; opening: OpeningDetail; access: { view: boolean; edit: boolean } }>` (404 when not visible, `ForbiddenError("opening:write")` when not editable).
- Produces in `[id]/problems.ts`: `describeProblem(problem, ctx: { content: VersionContent; facts: ReadonlyMap<string, CompetencyFacts>; locale: Locale; openingId: string }, t): { text: string; href: string }`.
- Produces in `[id]/opening-header.tsx`: `OpeningHeader({ opening, active: "overview" | "assessment" | "settings", locale, t, action? })` and `AssessmentTabs({ openingId, active: "edit" | "ai" | "scorecard" | "preview", t })`.
- Produces in `[id]/actions.ts`: `publishOpeningAction(formData)` (fields `openingId`, `back`: `"overview" | "builder"`).
- Produces dictionary namespaces `hiringCommon`, `hiringOpenings`, `hiringNew`, `hiringOverview`, `hiringGate`.

- [ ] **Step 1: Write the failing dictionary test**

In `src/i18n/messages.test.ts` import `hiringTr` / `hiringEn` from `@/i18n/messages/hiring.{tr,en}.json`, add `["hiring", hiringTr, hiringEn]` to `PAIRS` and `hiringTr` to the collision list.

Run: `pnpm exec vitest run src/i18n/messages.test.ts` - Expected: FAIL (`Cannot find module '@/i18n/messages/hiring.tr.json'`).

- [ ] **Step 2: Write the dictionaries**

Create `src/i18n/messages/hiring.tr.json`:

```json
{
  "hiringCommon": {
    "statusDRAFT": "Taslak",
    "statusOPEN": "Yayında",
    "statusCLOSED": "Kapalı",
    "tabsLabel": "Alım sekmeleri",
    "tabOverview": "Genel bakış",
    "tabAssessment": "Değerlendirme",
    "tabSettings": "Ekip ve kurallar",
    "assessmentTabsLabel": "Değerlendirme sekmeleri",
    "tabBuilder": "Kurucu",
    "tabAi": "AI taslağı",
    "tabScorecard": "Puan kartı",
    "tabPreview": "Önizleme",
    "back": "Alımlara dön",
    "deadline": "Son tarih {date}",
    "noDeadline": "Son tarih yok",
    "versionLive": "Yayında: v{number}",
    "versionDraft": "Taslak: v{number}",
    "noPermission": "Rolün bu alımı değiştiremez."
  },
  "hiringOpenings": {
    "title": "Alımlar",
    "sub": "Her alım bir pozisyon için açılmış, başı ve sonu olan bir işe alım sürecidir.",
    "add": "Alım aç",
    "tabsLabel": "Alım durumları",
    "tabOpen": "Açık ({count})",
    "tabDraft": "Taslak ({count})",
    "tabClosed": "Kapalı ({count})",
    "colName": "Alım",
    "colStatus": "Durum",
    "colFunnel": "Adaylar",
    "colDeadline": "Son tarih",
    "colOwner": "Alım sahibi",
    "funnelEmpty": "Henüz davet yok",
    "emptyTitle": "İlk alımını aç.",
    "emptyBody": "İlan metnini yapıştırman yeterli, gerisini birlikte kuralım.",
    "emptyTabTitle": "Bu sekmede alım yok.",
    "emptyTabBody": "Diğer sekmelere bak ya da yeni bir alım aç.",
    "noPermission": "Rolün alım açamaz."
  },
  "hiringNew": {
    "title": "Alım aç",
    "sub": "Pozisyonu seç ya da yaz, sonra nasıl başlayacağını seç.",
    "stepPosition": "1. Pozisyon",
    "positionPick": "Pozisyon seç ya da yeni yaz",
    "positionSearch": "Pozisyon ara ya da yeni ad yaz",
    "positionNone": "Bu adla pozisyon yok.",
    "positionCreate": "\"{name}\" adıyla yeni pozisyon",
    "jobAd": "İlan metni",
    "jobAdHint": "İsteğe bağlı ama önerilir. AI taslağı için 120 karakter yeter.",
    "profileSummary": "{count} yetkinlik · {weights}",
    "weightsEqual": "ağırlıklar eşit",
    "weightsSet": "ağırlıklar belirli",
    "profileEmpty": "Yetkinlik profili yok; puan kartını sonra kurarsın.",
    "stepStart": "2. Nasıl başlayalım?",
    "startAi": "İlan metninden AI taslağı",
    "startAiBody": "Önerilen. İlandan aşama ve soru önerileri çıkar; hiçbiri sen kabul etmeden eklenmez.",
    "startAiDisabled": "İlan metni ekleyince açılır.",
    "startCopy": "Önceki bir alımdan kopyala",
    "startCopyBody": "Bir alımın değerlendirmesini olduğu gibi kopyala, sonra düzenle.",
    "copyFrom": "Kopyalanacak alım",
    "startBlank": "Boş başla",
    "startBlankBody": "İlk aşamayı kendin eklersin.",
    "create": "Alımı oluştur",
    "creating": "Oluşturuluyor",
    "needPosition": "Pozisyon adını yaz.",
    "needCopySource": "Kopyalanacak alımı seç.",
    "failed": "Alım oluşturulamadı. Tekrar dene."
  },
  "hiringOverview": {
    "readinessTitle": "Yayına hazırlık",
    "rowAssessment": "Değerlendirme kuruldu",
    "rowAnchors": "Puan kartında her yetkinliğin çapası var",
    "rowTeam": "Ekip atandı",
    "rowPreview": "Önizleme yapıldı",
    "advisory": "Önerilir, yayını engellemez.",
    "goBuilder": "Kurucuya git",
    "goScorecard": "Puan kartına git",
    "goTeam": "Ekibi ata",
    "goPreview": "Önizle",
    "publish": "Yayınla",
    "publishNote": "Yayınlanan sürüm değişmez; sonradan düzenlemek yeni bir sürüm açar.",
    "published": "v{number} yayınlandı.",
    "publishRefused": "Yayınlanamadı. Eksikler aşağıda.",
    "invite": "Aday davet et",
    "inviteLater": "Aday daveti, aday ekranları hazır olunca açılır.",
    "liveTitle": "Yayındaki değerlendirme",
    "liveBody": "v{number}, {date} tarihinde yayınlandı.",
    "draftPending": "Taslak v{number} henüz yayınlanmadı.",
    "funnelTitle": "Adaylar",
    "funnelEmpty": "Henüz aday yok. Davet açıldığında huni burada görünür.",
    "closedBody": "Bu alım kapalı. Yeni davet yapılamaz."
  },
  "hiringGate": {
    "stageLabel": "Aşama {n}",
    "activityLabel": "Aşama {stage}, soru {n}",
    "noStage": "Henüz aşama yok. İlk aşamayı ekle.",
    "emptyStageName": "{stage} için bir ad yaz.",
    "emptyStage": "{stage} boş; en az bir soru ekle.",
    "emptyPrompt": "{activity}: soru metni boş.",
    "noCompetency": "{activity} hiçbir yetkinliği ölçmüyor.",
    "tooMany": "{activity} en fazla 2 yetkinlik ölçebilir.",
    "choiceWithCompetency": "{activity}: seçmeli soru yetkinlik ölçmez, bilgi skoruna gider.",
    "choiceOptions": "{activity}: en az iki seçenek yaz.",
    "choiceAnswer": "{activity}: doğru cevabı işaretle.",
    "competencyMissing": "Bir yetkinlik kütüphanede bulunamadı; o soruda yeniden seç.",
    "competencyArchived": "{competency} arşivde; o soruda başka bir yetkinlik seç.",
    "anchorMissing": "Puan kartında {competency} için {level}. seviye çapası eksik.",
    "weights": "Ağırlık toplamı %{total}; %100 olmalı."
  }
}
```

Create `src/i18n/messages/hiring.en.json`:

```json
{
  "hiringCommon": {
    "statusDRAFT": "Draft",
    "statusOPEN": "Live",
    "statusCLOSED": "Closed",
    "tabsLabel": "Opening tabs",
    "tabOverview": "Overview",
    "tabAssessment": "Assessment",
    "tabSettings": "Team and rules",
    "assessmentTabsLabel": "Assessment tabs",
    "tabBuilder": "Builder",
    "tabAi": "AI draft",
    "tabScorecard": "Scorecard",
    "tabPreview": "Preview",
    "back": "Back to openings",
    "deadline": "Deadline {date}",
    "noDeadline": "No deadline",
    "versionLive": "Live: v{number}",
    "versionDraft": "Draft: v{number}",
    "noPermission": "Your role cannot change this opening."
  },
  "hiringOpenings": {
    "title": "Openings",
    "sub": "Each opening is a hiring process for one position, with a start and an end.",
    "add": "Open a role",
    "tabsLabel": "Opening states",
    "tabOpen": "Open ({count})",
    "tabDraft": "Draft ({count})",
    "tabClosed": "Closed ({count})",
    "colName": "Opening",
    "colStatus": "Status",
    "colFunnel": "Candidates",
    "colDeadline": "Deadline",
    "colOwner": "Owner",
    "funnelEmpty": "No invitations yet",
    "emptyTitle": "Open your first role.",
    "emptyBody": "Paste the job ad and we'll build the rest together.",
    "emptyTabTitle": "No openings in this tab.",
    "emptyTabBody": "Check the other tabs or open a new role.",
    "noPermission": "Your role cannot open a role."
  },
  "hiringNew": {
    "title": "Open a role",
    "sub": "Pick or type the position, then choose how to start.",
    "stepPosition": "1. Position",
    "positionPick": "Pick a position or type a new one",
    "positionSearch": "Search positions or type a new name",
    "positionNone": "No position with this name.",
    "positionCreate": "New position \"{name}\"",
    "jobAd": "Job ad",
    "jobAdHint": "Optional but recommended. 120 characters are enough for the AI draft.",
    "profileSummary": "{count, plural, one {# competency} other {# competencies}} · {weights}",
    "weightsEqual": "equal weights",
    "weightsSet": "weights set",
    "profileEmpty": "No competency profile; you set up the scorecard later.",
    "stepStart": "2. How do we start?",
    "startAi": "Draft from the job ad with AI",
    "startAiBody": "Recommended. Proposes stages and questions from the ad; nothing is added until you accept it.",
    "startAiDisabled": "Available once there is a job ad.",
    "startCopy": "Copy a previous opening",
    "startCopyBody": "Copy an opening's assessment as it is, then edit it.",
    "copyFrom": "Opening to copy",
    "startBlank": "Start blank",
    "startBlankBody": "You add the first stage yourself.",
    "create": "Create the opening",
    "creating": "Creating",
    "needPosition": "Type the position's name.",
    "needCopySource": "Pick the opening to copy.",
    "failed": "The opening could not be created. Try again."
  },
  "hiringOverview": {
    "readinessTitle": "Ready to publish",
    "rowAssessment": "Assessment built",
    "rowAnchors": "Every competency on the scorecard has its anchors",
    "rowTeam": "Team assigned",
    "rowPreview": "Previewed",
    "advisory": "Recommended; does not block publishing.",
    "goBuilder": "Open the builder",
    "goScorecard": "Open the scorecard",
    "goTeam": "Assign the team",
    "goPreview": "Preview",
    "publish": "Publish",
    "publishNote": "A published version does not change; editing later opens a new version.",
    "published": "v{number} published.",
    "publishRefused": "Could not publish. What is missing is listed below.",
    "invite": "Invite a candidate",
    "inviteLater": "Inviting candidates opens once the candidate screens are ready.",
    "liveTitle": "Live assessment",
    "liveBody": "v{number}, published on {date}.",
    "draftPending": "Draft v{number} is not published yet.",
    "funnelTitle": "Candidates",
    "funnelEmpty": "No candidates yet. The funnel appears here once invitations open.",
    "closedBody": "This opening is closed. No new invitations."
  },
  "hiringGate": {
    "stageLabel": "Stage {n}",
    "activityLabel": "Stage {stage}, question {n}",
    "noStage": "No stage yet. Add the first one.",
    "emptyStageName": "Give {stage} a name.",
    "emptyStage": "{stage} is empty; add at least one question.",
    "emptyPrompt": "{activity}: the question text is empty.",
    "noCompetency": "{activity} measures no competency.",
    "tooMany": "{activity} can measure at most 2 competencies.",
    "choiceWithCompetency": "{activity}: a choice question measures no competency; it feeds the knowledge score.",
    "choiceOptions": "{activity}: write at least two options.",
    "choiceAnswer": "{activity}: mark the right answer.",
    "competencyMissing": "A competency is no longer in the library; pick it again on that question.",
    "competencyArchived": "{competency} is archived; pick another competency on that question.",
    "anchorMissing": "On the scorecard, {competency} has no level {level} anchor.",
    "weights": "Weights add up to {total}%; they must add up to 100%."
  }
}
```

In `src/i18n/manager.ts` merge the two files the same way as `library.*.json` (type, `tr`, `en`, comment line `hiring.*.json    hiring screens.`).

Run: `pnpm exec vitest run src/i18n/messages.test.ts` - Expected: PASS.

- [ ] **Step 3: Add the server helpers**

Append to `src/solutions/hiring/server/openings.ts` (add `positionCompetencies` to the schema import and `sql` to the drizzle import):

```ts
/** Positions an opening may start from (HIRING-UX 5.3): with "has a job ad" and the profile summary. */
export async function positionOptions(orgId: string) {
  const rows = await db
    .select({
      id: positions.id,
      name: positions.name,
      hasJobAd: sql<boolean>`coalesce(length(trim(${positions.jobDescription})) > 0, false)`,
      competencyCount: sql<number>`(select count(*)::int from ${positionCompetencies} pc where pc.position_id = ${positions.id})`,
      distinctWeights: sql<number>`(select count(distinct pc.weight)::int from ${positionCompetencies} pc where pc.position_id = ${positions.id})`,
    })
    .from(positions)
    .where(and(eq(positions.orgId, orgId), isNull(positions.archivedAt)))
    .orderBy(positions.name);
  return rows.map((r) => ({ id: r.id, name: r.name, hasJobAd: r.hasJobAd, competencyCount: r.competencyCount, weightsEqual: r.distinctWeights <= 1 }));
}
```

Create `src/solutions/hiring/server/working.ts`:

```ts
import type { CompetencyFacts, VersionContent } from "../rules/content";
import { publishProblems, type PublishProblem } from "../rules/gate";
import { workingVersions, type VersionSummary } from "../rules/versions";
import { loadCompetencyFacts, loadVersionContent } from "./content";
import { versionsOf } from "./versions";

export type WorkingState = {
  list: VersionSummary[];
  draft: VersionSummary | null;
  live: VersionSummary | null;
  /** The draft when there is one, otherwise the newest published version. */
  content: VersionContent | null;
  facts: Map<string, CompetencyFacts>;
  /** The publish gate on the draft; empty when there is no draft. */
  problems: PublishProblem[];
};

export async function workingState(orgId: string, openingId: string): Promise<WorkingState> {
  const list = await versionsOf(openingId);
  const { draft, live } = workingVersions(list);
  const shown = draft ?? live;
  const content = shown ? await loadVersionContent(shown.id) : null;
  const ids = content ? [...new Set(content.stages.flatMap((st) => st.activities.flatMap((a) => a.competencyIds)))] : [];
  const facts = await loadCompetencyFacts(orgId, ids);
  return { list, draft, live, content, facts, problems: draft && content ? publishProblems(content, facts) : [] };
}
```

- [ ] **Step 4: Write the opening page helpers**

Create `src/app/(manager)/hiring/layout.tsx`:

```tsx
/** Hiring screens use the 12px card of HIRING-UX 8.3, set once here. */
export default function HiringLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ "--card-radius": "12px" } as React.CSSProperties}>{children}</div>;
}
```

Create `src/app/(manager)/hiring/openings/[id]/access.ts`:

```ts
import { notFound } from "next/navigation";
import { ForbiddenError } from "@/lib/authorize";
import { requireUser } from "@/server/session";
import { openingAccess } from "@/solutions/hiring/rules/access";
import { loadOpening } from "@/solutions/hiring/server/openings";

/**
 * Every opening page and action starts here. An opening the viewer may not see
 * answers 404 (its existence is not revealed); one they may see but not change
 * throws ForbiddenError, which the panel's error boundary explains.
 */
export async function openingFor(openingId: string, need: "view" | "edit") {
  const user = await requireUser();
  const opening = await loadOpening(user.orgId, openingId);
  if (!opening) notFound();
  const access = openingAccess(user, {
    decisionMakerId: opening.decisionMakerId,
    backupDecisionMakerId: opening.backupDecisionMakerId,
    memberIds: opening.memberIds,
  });
  if (!access.view) notFound();
  if (need === "edit" && !access.edit) throw new ForbiddenError("opening:write");
  return { user, opening, access };
}
```

Create `src/app/(manager)/hiring/openings/[id]/problems.ts`:

```ts
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { pickText } from "@/lib/i18n-text";
import type { CompetencyFacts, VersionContent } from "@/solutions/hiring/rules/content";
import type { PublishProblem } from "@/solutions/hiring/rules/gate";

type T = ReturnType<typeof managerT>;

/** One gate problem as a sentence and the place that fixes it (HIRING-UX R2: "Yayınla" states its reason). */
export function describeProblem(
  problem: PublishProblem,
  ctx: { content: VersionContent; facts: ReadonlyMap<string, CompetencyFacts>; locale: Locale; openingId: string },
  t: T,
): { text: string; href: string } {
  const base = `/hiring/openings/${ctx.openingId}/assessment`;
  const stage = (stageId: string) => t("hiringGate.stageLabel", { n: ctx.content.stages.findIndex((s) => s.id === stageId) + 1 });
  const activity = (activityId: string) => {
    for (const [i, s] of ctx.content.stages.entries()) {
      const j = s.activities.findIndex((a) => a.id === activityId);
      if (j >= 0) return t("hiringGate.activityLabel", { stage: i + 1, n: j + 1 });
    }
    return "";
  };
  const competency = (id: string) => pickText(ctx.facts.get(id)?.name, ctx.locale);
  switch (problem.code) {
    case "NO_STAGE":
      return { text: t("hiringGate.noStage"), href: `${base}/edit` };
    case "EMPTY_STAGE_NAME":
      return { text: t("hiringGate.emptyStageName", { stage: stage(problem.stageId) }), href: `${base}/edit?stage=${problem.stageId}` };
    case "EMPTY_STAGE":
      return { text: t("hiringGate.emptyStage", { stage: stage(problem.stageId) }), href: `${base}/edit?stage=${problem.stageId}` };
    case "EMPTY_PROMPT":
      return { text: t("hiringGate.emptyPrompt", { activity: activity(problem.activityId) }), href: `${base}/edit?activity=${problem.activityId}` };
    case "NO_COMPETENCY":
      return { text: t("hiringGate.noCompetency", { activity: activity(problem.activityId) }), href: `${base}/edit?activity=${problem.activityId}` };
    case "TOO_MANY_COMPETENCIES":
      return { text: t("hiringGate.tooMany", { activity: activity(problem.activityId) }), href: `${base}/edit?activity=${problem.activityId}` };
    case "CHOICE_WITH_COMPETENCY":
      return { text: t("hiringGate.choiceWithCompetency", { activity: activity(problem.activityId) }), href: `${base}/edit?activity=${problem.activityId}` };
    case "CHOICE_NEEDS_OPTIONS":
      return { text: t("hiringGate.choiceOptions", { activity: activity(problem.activityId) }), href: `${base}/edit?activity=${problem.activityId}` };
    case "CHOICE_NEEDS_ANSWER":
      return { text: t("hiringGate.choiceAnswer", { activity: activity(problem.activityId) }), href: `${base}/edit?activity=${problem.activityId}` };
    case "COMPETENCY_MISSING":
      return { text: t("hiringGate.competencyMissing"), href: `${base}/edit` };
    case "COMPETENCY_ARCHIVED":
      return { text: t("hiringGate.competencyArchived", { competency: competency(problem.competencyId) }), href: `${base}/edit` };
    case "ANCHOR_MISSING":
      return { text: t("hiringGate.anchorMissing", { competency: competency(problem.competencyId), level: problem.level }), href: `${base}/scorecard` };
    case "WEIGHTS_NOT_100":
      return { text: t("hiringGate.weights", { total: problem.total }), href: `${base}/scorecard` };
  }
}
```

Create `src/app/(manager)/hiring/openings/[id]/opening-header.tsx`:

```tsx
import Link from "next/link";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { PageTitle } from "@/components/manager/page-title";
import { RouteTabs } from "@/components/manager/route-tabs";
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { shortDate } from "@/lib/format";
import type { OpeningDetail } from "@/solutions/hiring/server/openings";

type T = ReturnType<typeof managerT>;
const TONE: Record<OpeningDetail["status"], StatusTone> = { DRAFT: "neutral", OPEN: "active", CLOSED: "done" };

/** HIRING-UX 5.4: name, status, deadline, and the opening's route tabs (only routes that exist). */
export function OpeningHeader({
  opening,
  active,
  locale,
  t,
  action,
}: {
  opening: OpeningDetail;
  active: "overview" | "assessment" | "settings";
  locale: Locale;
  t: T;
  action?: React.ReactNode;
}) {
  const base = `/hiring/openings/${opening.id}`;
  return (
    <div className="space-y-6">
      <Link href="/hiring/openings" className="text-[13px] text-muted hover:text-ink">
        {t("hiringCommon.back")}
      </Link>
      <PageTitle
        eyebrow={opening.positionName}
        title={opening.name}
        sub={
          <span className="flex flex-wrap items-center gap-4">
            <StatusDot tone={TONE[opening.status]}>{t(`hiringCommon.status${opening.status}`)}</StatusDot>
            <span className="tnum">{opening.deadlineAt ? t("hiringCommon.deadline", { date: shortDate(opening.deadlineAt, locale) }) : t("hiringCommon.noDeadline")}</span>
          </span>
        }
        action={action}
      />
      <RouteTabs
        label={t("hiringCommon.tabsLabel")}
        items={[
          { href: base, label: t("hiringCommon.tabOverview"), active: active === "overview" },
          { href: `${base}/assessment/edit`, label: t("hiringCommon.tabAssessment"), active: active === "assessment" },
          { href: `${base}/settings`, label: t("hiringCommon.tabSettings"), active: active === "settings" },
        ]}
      />
    </div>
  );
}

export function AssessmentTabs({ openingId, active, t }: { openingId: string; active: "edit" | "ai" | "scorecard" | "preview"; t: T }) {
  const base = `/hiring/openings/${openingId}/assessment`;
  return (
    <RouteTabs
      size="sm"
      label={t("hiringCommon.assessmentTabsLabel")}
      items={[
        { href: `${base}/edit`, label: t("hiringCommon.tabBuilder"), active: active === "edit" },
        { href: `${base}/ai`, label: t("hiringCommon.tabAi"), active: active === "ai" },
        { href: `${base}/scorecard`, label: t("hiringCommon.tabScorecard"), active: active === "scorecard" },
        { href: `${base}/preview`, label: t("hiringCommon.tabPreview"), active: active === "preview" },
      ]}
    />
  );
}
```

(If `shortDate` in `@/lib/format` has a different signature than `(date: Date, locale: Locale)`, use `shortDate` from `@/i18n/dates`, which has that signature.)

Create `src/app/(manager)/hiring/openings/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { publishDraft } from "@/solutions/hiring/server/publish";
import { openingFor } from "./access";

/** "Yayınla" on the overview and in the builder bar. The gate runs again on the server. */
export async function publishOpeningAction(formData: FormData) {
  const openingId = String(formData.get("openingId") ?? "");
  const back = formData.get("back") === "builder" ? "builder" : "overview";
  const { user, opening } = await openingFor(openingId, "edit");
  const result = await publishDraft(user.orgId, opening.id, user.id);
  revalidatePath("/hiring/openings/[id]", "layout");
  const target = back === "builder" ? `/hiring/openings/${opening.id}/assessment/edit` : `/hiring/openings/${opening.id}`;
  redirect(result.ok ? `${target}?published=${result.number}` : `${target}?publish=refused`);
}
```

- [ ] **Step 5: Write the openings list and the new-opening flow**

Create `src/app/(manager)/hiring/openings/page.tsx`:

```tsx
import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle } from "@/components/manager/page-title";
import { RouteTabs } from "@/components/manager/route-tabs";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { shortDate } from "@/lib/format";
import { requireUser } from "@/server/session";
import { listOpenings, type OpeningStatus } from "@/solutions/hiring/server/openings";

export const dynamic = "force-dynamic";

const TONE: Record<OpeningStatus, StatusTone> = { DRAFT: "neutral", OPEN: "active", CLOSED: "done" };
const TABS = [
  ["open", "OPEN", "tabOpen"],
  ["draft", "DRAFT", "tabDraft"],
  ["closed", "CLOSED", "tabClosed"],
] as const;

/** HIRING-UX 5.2: which openings are live and which are stuck. A table, not cards. */
export default async function OpeningsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const lists = await Promise.all(TABS.map(([, status]) => listOpenings(user.orgId, user, status)));
  const total = lists.reduce((n, l) => n + l.length, 0);
  const tabIndex = Math.max(0, TABS.findIndex(([key]) => key === sp.tab));
  const rows = lists[tabIndex];
  const canWrite = can(user, "opening:write");
  const addButton = canWrite ? (
    <Button asChild variant="primary">
      <Link href="/hiring/openings/new">{t("hiringOpenings.add")}</Link>
    </Button>
  ) : (
    <>
      <Button variant="primary" disabled disabledReason={t("hiringOpenings.noPermission")}>
        {t("hiringOpenings.add")}
      </Button>
      <DisabledReason>{t("hiringOpenings.noPermission")}</DisabledReason>
    </>
  );

  if (total === 0) {
    return (
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <PageTitle title={t("hiringOpenings.title")} sub={t("hiringOpenings.sub")} />
        <Empty className="mt-section border border-line">
          <EmptyHeader>
            <EmptyTitle>{t("hiringOpenings.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("hiringOpenings.emptyBody")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{addButton}</EmptyContent>
        </Empty>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <PageTitle title={t("hiringOpenings.title")} sub={t("hiringOpenings.sub")} action={addButton} />
      <div className="mt-6">
        <RouteTabs
          label={t("hiringOpenings.tabsLabel")}
          items={TABS.map(([key, , label], i) => ({
            href: `/hiring/openings?tab=${key}`,
            label: t(`hiringOpenings.${label}`, { count: lists[i].length }),
            active: i === tabIndex,
          }))}
        />
      </div>
      {rows.length === 0 ? (
        <Empty className="mt-section border border-line">
          <EmptyHeader>
            <EmptyTitle>{t("hiringOpenings.emptyTabTitle")}</EmptyTitle>
            <EmptyDescription>{t("hiringOpenings.emptyTabBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="mt-section overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("hiringOpenings.colName")}</TableHead>
                <TableHead>{t("hiringOpenings.colStatus")}</TableHead>
                <TableHead>{t("hiringOpenings.colFunnel")}</TableHead>
                <TableHead>{t("hiringOpenings.colDeadline")}</TableHead>
                <TableHead>{t("hiringOpenings.colOwner")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/hiring/openings/${row.id}`} className="font-medium text-ink hover:underline">
                      {row.name}
                    </Link>
                    <p className="text-[12px] text-muted">{row.positionName}</p>
                  </TableCell>
                  <TableCell>
                    <StatusDot tone={TONE[row.status]}>
                      {t(`hiringCommon.status${row.status}`)}
                      {row.liveNumber ? ` · v${row.liveNumber}` : ""}
                    </StatusDot>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted">{t("hiringOpenings.funnelEmpty")}</TableCell>
                  <TableCell className="tnum text-[13px] text-muted">{row.deadlineAt ? shortDate(row.deadlineAt, locale) : "-"}</TableCell>
                  <TableCell className="text-[13px] text-muted">{row.ownerName ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </main>
  );
}
```

Create `src/app/(manager)/hiring/openings/new/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { managerLocale } from "@/i18n/manager-locale";
import { requireUser } from "@/server/session";
import { createOpening } from "@/solutions/hiring/server/openings";

const schema = z.object({
  position: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("existing"), id: z.uuid() }),
    z.object({ kind: z.literal("new"), name: z.string().max(160), jobDescription: z.string().max(20000) }),
  ]),
  start: z.enum(["AI", "COPY", "BLANK"]),
  copyFrom: z.uuid().nullable(),
});

export async function createOpeningAction(input: z.input<typeof schema>) {
  const user = await requireUser("opening:write");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "INVALID" as const };
  const result = await createOpening(user, { ...parsed.data, locale: await managerLocale() });
  if (result.ok) revalidatePath("/hiring/openings");
  return result;
}
```

Create `src/components/hiring/new-opening-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import { createOpeningAction } from "@/app/(manager)/hiring/openings/new/actions";

export type PositionOption = { id: string; name: string; hasJobAd: boolean; competencyCount: number; weightsEqual: boolean };
type Start = "AI" | "COPY" | "BLANK";

/** HIRING-UX 5.3: one page, two blocks, not a wizard. */
export function NewOpeningForm({
  positions,
  sources,
  initialPositionId,
}: {
  positions: PositionOption[];
  sources: Array<{ id: string; name: string }>;
  initialPositionId: string | null;
}) {
  const t = useMT("hiringNew");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PositionOption | null>(positions.find((p) => p.id === initialPositionId) ?? null);
  const [newName, setNewName] = useState<string | null>(null);
  const [jobAd, setJobAd] = useState("");
  const [start, setStart] = useState<Start>("AI");
  const [copyFrom, setCopyFrom] = useState("");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const hasAd = picked ? picked.hasJobAd : jobAd.trim().length > 0;
  // The recommended path is pre-selected, and falls back to "blank" while there is no ad.
  const effective: Start = start === "AI" && !hasAd ? "BLANK" : start;
  const positionReady = picked !== null || (newName !== null && newName.trim().length > 0);
  const reason = !positionReady ? t("needPosition") : effective === "COPY" && !copyFrom ? t("needCopySource") : null;

  function submit() {
    setFailed(false);
    startTransition(async () => {
      const result = await createOpeningAction({
        position: picked ? { kind: "existing", id: picked.id } : { kind: "new", name: newName ?? "", jobDescription: jobAd },
        start: effective,
        copyFrom: effective === "COPY" ? copyFrom : null,
      });
      if (result.ok) router.push(result.next);
      else setFailed(true);
    });
  }

  const options: Array<[Start, string, string]> = [
    ["AI", t("startAi"), t("startAiBody")],
    ...(sources.length ? ([["COPY", t("startCopy"), t("startCopyBody")]] as Array<[Start, string, string]>) : []),
    ["BLANK", t("startBlank"), t("startBlankBody")],
  ];

  return (
    <div className="space-y-section">
      <Card className="space-y-field p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("stepPosition")}</h2>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between md:w-[480px]">
              {picked?.name ?? newName ?? t("positionPick")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
            <Command>
              <CommandInput placeholder={t("positionSearch")} value={query} onValueChange={setQuery} />
              <CommandList>
                <CommandEmpty>{t("positionNone")}</CommandEmpty>
                <CommandGroup>
                  {positions.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.name}
                      onSelect={() => {
                        setPicked(p);
                        setNewName(null);
                        setOpen(false);
                      }}
                    >
                      {p.name}
                    </CommandItem>
                  ))}
                  {query.trim() && !positions.some((p) => p.name.toLocaleLowerCase("tr") === query.trim().toLocaleLowerCase("tr")) ? (
                    <CommandItem
                      value={`__new__${query}`}
                      onSelect={() => {
                        setPicked(null);
                        setNewName(query.trim());
                        setOpen(false);
                      }}
                    >
                      {t("positionCreate", { name: query.trim() })}
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {picked ? (
          <p className="tnum text-[13px] text-muted">
            {picked.competencyCount
              ? t("profileSummary", { count: picked.competencyCount, weights: picked.weightsEqual ? t("weightsEqual") : t("weightsSet") })
              : t("profileEmpty")}
          </p>
        ) : null}
        {newName !== null ? (
          <div className="space-y-2">
            <Label htmlFor="new-opening-ad">{t("jobAd")}</Label>
            <Textarea id="new-opening-ad" rows={8} value={jobAd} onChange={(e) => setJobAd(e.target.value)} />
            <p className="text-[13px] text-muted">{t("jobAdHint")}</p>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-field p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("stepStart")}</h2>
        <RadioGroup value={effective} onValueChange={(v) => setStart(v as Start)} className="grid gap-3 md:grid-cols-3">
          {options.map(([value, title, body]) => {
            const disabled = value === "AI" && !hasAd;
            return (
              <label
                key={value}
                className="flex cursor-pointer gap-3 rounded-xl border border-line p-4 has-[[data-state=checked]]:border-ink has-[:disabled]:cursor-not-allowed"
              >
                <RadioGroupItem value={value} disabled={disabled} aria-describedby={`start-${value}`} />
                <span>
                  <span className="block text-[14px] font-medium text-ink">{title}</span>
                  <span id={`start-${value}`} className="block text-[13px] text-muted">
                    {disabled ? t("startAiDisabled") : body}
                  </span>
                </span>
              </label>
            );
          })}
        </RadioGroup>
        {effective === "COPY" ? (
          <div className="max-w-[480px] space-y-2">
            <Label>{t("copyFrom")}</Label>
            <Select value={copyFrom} onValueChange={setCopyFrom}>
              <SelectTrigger aria-label={t("copyFrom")}>
                <SelectValue placeholder={t("copyFrom")} />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary" onClick={submit} disabled={pending || reason !== null} disabledReason={reason ?? undefined}>
          {pending ? t("creating") : t("create")}
        </Button>
        {reason ? <DisabledReason>{reason}</DisabledReason> : null}
        {failed ? <span role="status" className="text-[13px] text-destructive">{t("failed")}</span> : null}
      </div>
    </div>
  );
}
```

Create `src/app/(manager)/hiring/openings/new/page.tsx`:

```tsx
import Link from "next/link";
import { PageTitle } from "@/components/manager/page-title";
import { NewOpeningForm } from "@/components/hiring/new-opening-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";
import { copySources, positionOptions } from "@/solutions/hiring/server/openings";

export const dynamic = "force-dynamic";

export default async function NewOpeningPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("opening:write");
  const t = managerT(await managerLocale());
  const sp = await searchParams;
  const [positions, sources] = await Promise.all([positionOptions(user.orgId), copySources(user.orgId)]);
  return (
    <main className="mx-auto max-w-[1080px] px-page py-8">
      <Link href="/hiring/openings" className="text-[13px] text-muted hover:text-ink">
        {t("hiringCommon.back")}
      </Link>
      <div className="mt-3">
        <PageTitle title={t("hiringNew.title")} sub={t("hiringNew.sub")} />
      </div>
      <div className="mt-section">
        <NewOpeningForm positions={positions} sources={sources} initialPositionId={sp.position && isUuid(sp.position) ? sp.position : null} />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Write the overview**

Create `src/app/(manager)/hiring/openings/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { shortDate } from "@/lib/format";
import { ANCHOR_PROBLEMS, STRUCTURE_PROBLEMS } from "@/solutions/hiring/rules/gate";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "./access";
import { publishOpeningAction } from "./actions";
import { OpeningHeader } from "./opening-header";
import { describeProblem } from "./problems";

export const dynamic = "force-dynamic";

function Row({ done, label, detail, href, action, advisory }: { done: boolean; label: string; detail?: string; href: string; action: string; advisory?: string }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <StatusDot tone={done ? "done" : "warn"} className={done ? undefined : "font-semibold text-ink"}>
          {label}
        </StatusDot>
        {!done && detail ? <p className="mt-1 pl-3.5 text-[13px] text-muted">{detail}</p> : null}
        {!done && advisory ? <p className="mt-1 pl-3.5 text-[12px] text-muted">{advisory}</p> : null}
      </div>
      {!done ? (
        <Link href={href} className="text-[13px] font-medium text-ink underline decoration-underline underline-offset-2">
          {action}
        </Link>
      ) : null}
    </li>
  );
}

/** HIRING-UX 5.4: "Bu alım nerede, sıradaki adımım ne?" */
export default async function OpeningOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const state = await workingState(user.orgId, opening.id);
  const base = `/hiring/openings/${opening.id}`;
  const describe = (p: (typeof state.problems)[number]) =>
    describeProblem(p, { content: state.content!, facts: state.facts, locale, openingId: opening.id }, t);
  const structure = state.problems.filter((p) => STRUCTURE_PROBLEMS.includes(p.code));
  const anchors = state.problems.filter((p) => ANCHOR_PROBLEMS.includes(p.code));
  const reason = !access.edit ? t("hiringCommon.noPermission") : state.problems.length ? describe(state.problems[0]).text : null;

  const action = state.draft ? (
    <form action={publishOpeningAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="openingId" value={opening.id} />
      <input type="hidden" name="back" value="overview" />
      <Button type="submit" variant="primary" disabled={reason !== null} disabledReason={reason ?? undefined}>
        {t("hiringOverview.publish")}
      </Button>
      {reason ? <DisabledReason>{reason}</DisabledReason> : <p className="text-[12px] text-muted">{t("hiringOverview.publishNote")}</p>}
    </form>
  ) : (
    <>
      <Button variant="primary" disabled disabledReason={opening.status === "CLOSED" ? t("hiringOverview.closedBody") : t("hiringOverview.inviteLater")}>
        {t("hiringOverview.invite")}
      </Button>
      <DisabledReason>{opening.status === "CLOSED" ? t("hiringOverview.closedBody") : t("hiringOverview.inviteLater")}</DisabledReason>
    </>
  );

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="overview" locale={locale} t={t} action={action} />
      {sp.published ? <p role="status" className="mt-6 text-[14px] text-ink">{t("hiringOverview.published", { number: sp.published })}</p> : null}
      {sp.publish === "refused" ? <p role="status" className="mt-6 text-[14px] text-ink">{t("hiringOverview.publishRefused")}</p> : null}

      <div className="mt-section grid gap-section lg:grid-cols-[minmax(0,1fr)_360px]">
        {state.draft ? (
          <Card className="p-card">
            <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.readinessTitle")}</h2>
            <p className="tnum text-[13px] text-muted">{t("hiringOverview.draftPending", { number: state.draft.number })}</p>
            <ul className="mt-2 divide-y divide-line">
              <Row
                done={structure.length === 0}
                label={t("hiringOverview.rowAssessment")}
                detail={structure[0] ? describe(structure[0]).text : undefined}
                href={structure[0] ? describe(structure[0]).href : `${base}/assessment/edit`}
                action={t("hiringOverview.goBuilder")}
              />
              <Row
                done={anchors.length === 0}
                label={t("hiringOverview.rowAnchors")}
                detail={anchors[0] ? describe(anchors[0]).text : undefined}
                href={`${base}/assessment/scorecard`}
                action={t("hiringOverview.goScorecard")}
              />
              <Row
                done={opening.memberIds.length > 0}
                label={t("hiringOverview.rowTeam")}
                advisory={t("hiringOverview.advisory")}
                href={`${base}/settings`}
                action={t("hiringOverview.goTeam")}
              />
              <Row
                done={state.draft.previewedAt !== null}
                label={t("hiringOverview.rowPreview")}
                advisory={t("hiringOverview.advisory")}
                href={`${base}/assessment/preview`}
                action={t("hiringOverview.goPreview")}
              />
            </ul>
          </Card>
        ) : (
          <Card className="p-card">
            <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.funnelTitle")}</h2>
            <p className="mt-2 text-[13px] text-muted">{opening.status === "CLOSED" ? t("hiringOverview.closedBody") : t("hiringOverview.funnelEmpty")}</p>
          </Card>
        )}
        {state.live ? (
          <Card className="p-card">
            <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.liveTitle")}</h2>
            <p className="tnum mt-2 text-[13px] text-muted">
              {t("hiringOverview.liveBody", { number: state.live.number, date: state.live.publishedAt ? shortDate(state.live.publishedAt, locale) : "-" })}
            </p>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Gates, build, browser check**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS; build lists `/hiring/openings`, `/hiring/openings/new`, `/hiring/openings/[id]`.

In Chrome (dev server on `kademe_platform`; hiring is not in the menu yet, open the URLs directly):
1. `/hiring/openings` with no openings: the HIRING-UX 5.2 empty copy and one filled "Alım aç".
2. `/hiring/openings/new`: the AI card says "İlan metni ekleyince açılır." until a position with an ad is picked or an ad is typed for a new one; with nothing picked the button says "Pozisyon adını yaz."; type a new name "Destek Uzmanı", paste an ad, keep the AI path, create: lands on `/assessment/ai` (404 until Task 17; that is expected now). Go back and create one with "Boş başla" for the position from Task 6: lands on `/assessment/edit` (404 until Task 15).
3. `/hiring/openings/<id>`: header with position eyebrow, "Taslak" dot, "Son tarih yok", three tabs; readiness list with "Değerlendirme kuruldu" not done ("Henüz aşama yok. İlk aşamayı ekle."), "Yayınla" disabled with that sentence next to it.
4. `/hiring/openings?tab=draft` lists both drafts.
Stop the server; close your tabs.

- [ ] **Step 8: Commit**

```bash
git add src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json src/i18n/manager.ts src/i18n/messages.test.ts src/solutions/hiring/server/openings.ts src/solutions/hiring/server/working.ts "src/app/(manager)/hiring" src/components/hiring/new-opening-form.tsx
git commit -m "Add the openings list, opening creation and the opening overview" -m "/hiring/openings lists openings by state with a reviewer seeing only their own; /hiring/openings/new picks or creates the position and starts from an AI draft (only with a job ad), a copy or blank; the overview shows the readiness list with each gate problem as a sentence and a link, and Yayınla disabled with its reason until the server gate passes. Opening pages answer 404 to a viewer outside the team." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Register the hiring solution (menu, Today, library usage)

**Files:**
- Modify: `src/solutions/types.ts` (`inviteHref: string | null`)
- Create: `src/solutions/hiring/manifest.ts`, `src/solutions/hiring/module.ts`, `src/solutions/hiring/module.test.ts`
- Create: `src/solutions/hiring/server/library-usage.ts`, `src/solutions/hiring/server/library-usage.test.ts`
- Modify: `src/solutions/registry.ts` (`SOLUTION_MANIFESTS`, `inviteTargets`), `src/solutions/registry.server.ts`
- Modify: `src/app/(manager)/dashboard/page.tsx`
- Test: `src/solutions/registry.test.ts` (rewritten)

**Interfaces:**
- Consumes: Task 1 flag, Task 4 hooks, Task 6 `buildNav`.
- Produces: `hiringManifest` (key `hiring`, `basePath` `/hiring`, `nav` `[/hiring/openings]`, `inviteHref: null`, `candidateFlowLive: false`, `positionAction` to `/hiring/openings/new?position=<id>`), `hiringModule`.
- Produces: `inviteTargets(manifests?): Array<{ key: SolutionKey; href: string }>` in `@/solutions/registry`.
- Produces: `usageFromRows(rows: Array<{ ref: string; openingId: string; name: string; live: boolean }>): Record<string, LibraryUsageEntry>` and `hiringLibraryUsage(orgId, refs)` in `server/library-usage`.

- [ ] **Step 1: Rewrite the registry test for two solutions**

Replace `src/solutions/registry.test.ts` with:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { buildNav, inviteTargets, manifestByKind, SOLUTION_MANIFESTS } from "./registry";
import { candidateSolution, solutionModule, solutionModules } from "./registry.server";
import { languageExamManifest } from "./language-exam/manifest";
import type { SolutionManifest, SolutionModule } from "./types";

const shared = { today: "Bugün", settings: "Ayarlar", library: { label: "Kütüphane", positions: "Pozisyonlar", competencies: "Yetkinlikler" } };

describe("solution registry", () => {
  it("knows both solutions by their database kind, hiring first (HIRING-UX 4.1)", () => {
    expect(SOLUTION_MANIFESTS.map((m) => m.key)).toEqual(["hiring", "language-exam"]);
    expect(manifestByKind("HIRING")?.key).toBe("hiring");
    expect(solutionModule("HIRING")?.key).toBe("hiring");
    expect(solutionModule("LANGUAGE_EXAM")?.key).toBe("language-exam");
  });

  it("keeps manifests and modules in the same order with the same keys", () => {
    expect(solutionModules().map((m) => m.key)).toEqual(SOLUTION_MANIFESTS.map((m) => m.key));
  });

  it("keeps every solution's menu and invite link under its own base path", () => {
    for (const m of SOLUTION_MANIFESTS) {
      expect(m.nav.length).toBeGreaterThan(0);
      for (const item of m.nav) expect(item.href.startsWith(`${m.basePath}/`), item.href).toBe(true);
      if (m.inviteHref) expect(m.inviteHref.startsWith(`${m.basePath}/`)).toBe(true);
    }
    expect(new Set(SOLUTION_MANIFESTS.map((m) => m.dbKind)).size).toBe(SOLUTION_MANIFESTS.length);
  });

  it("does not serve hiring candidates until plan 2 turns the flag on", () => {
    expect(manifestByKind("HIRING")?.candidateFlowLive).toBe(false);
    expect(candidateSolution("HIRING")).toBeNull();
    expect(candidateSolution("LANGUAGE_EXAM")?.key).toBe("language-exam");
  });

  it("serves candidates only for a registered module whose flow is live (stubbed registry)", () => {
    const exam = solutionModule("LANGUAGE_EXAM")!;
    const fake = { ...exam, key: "hiring", dbKind: "HIRING", candidateFlowLive: false } as SolutionModule;
    expect(candidateSolution("HIRING", [exam])).toBeNull();
    expect(candidateSolution("HIRING", [exam, fake])).toBeNull();
    expect(candidateSolution("HIRING", [exam, { ...fake, candidateFlowLive: true }])?.key).toBe("hiring");
  });

  it("maps exam steps to the same screens as before", () => {
    const m = manifestByKind("LANGUAGE_EXAM")!;
    expect(m.candidateStepPath("tok", { step: "CONSENT" })).toBe("/a/tok");
    expect(m.candidateStepPath("tok", { step: "INFO" })).toBe("/a/tok/info");
    expect(m.candidateStepPath("tok", { step: "CHECK" })).toBe("/a/tok/check");
    expect(m.candidateStepPath("tok", { step: "ITEM" })).toBe("/a/tok/exam");
    expect(m.candidateStepPath("tok", { step: "DONE" })).toBe("/a/tok/done");
    expect(m.candidateStepPath("tok", { step: "SOMETHING_ELSE" })).toBe("/a/tok");
  });

  it("builds the HIRING-UX 4.1 menu with group headers: Today, Hiring, Exam, Library, Settings", () => {
    const nav = buildNav("tr", shared);
    expect(nav.map((g) => g.key)).toEqual(["today", "hiring", "language-exam", "library", "settings"]);
    expect(nav.map((g) => g.label)).toEqual([null, "İşe alım", "Sınav", "Kütüphane", null]);
    expect(nav[1].items).toEqual([{ href: "/hiring/openings", label: "Alımlar" }]);
    expect(buildNav("en", shared)[1].items[0].label).toBe("Openings");
  });

  it("drops group headers when only one solution is registered", () => {
    const nav = buildNav("tr", shared, [languageExamManifest]);
    expect(nav.map((g) => g.label)).toEqual([null, null, null, null]);
  });

  it("invites from Today with the first solution that can invite, not the first in the menu", () => {
    expect(inviteTargets()).toEqual([{ key: "language-exam", href: "/exam/students/new" }]);
    const noInvite = { ...languageExamManifest, inviteHref: null } as SolutionManifest;
    expect(inviteTargets([noInvite])).toEqual([]);
  });

  it("offers hiring's action on a position page", () => {
    expect(manifestByKind("HIRING")?.positionAction?.href("p1")).toBe("/hiring/openings/new?position=p1");
  });
});
```

Run: `pnpm exec vitest run src/solutions/registry.test.ts` - Expected: FAIL (hiring is not registered, `inviteTargets` does not exist).

- [ ] **Step 2: Write the failing module and usage tests**

Create `src/solutions/hiring/module.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { hiringModule } from "./module";

const ctx = {} as Parameters<typeof hiringModule.candidate.loadState>[0];

describe("hiring module before the candidate flow exists", () => {
  it("adds nothing to Today yet and has no proctoring", async () => {
    expect(await hiringModule.today("o", "u", "tr")).toEqual([]);
    expect(await hiringModule.proctorPolicy("a")).toBeNull();
    expect(await hiringModule.attempts.openSegment("t")).toBeNull();
  });

  it("refuses every candidate call loudly instead of guessing", async () => {
    await expect(hiringModule.candidate.loadState(ctx)).rejects.toThrow(/not live/);
    await expect(hiringModule.candidate.title(ctx)).rejects.toThrow(/not live/);
    await expect(hiringModule.candidate.heartbeat(ctx)).rejects.toThrow(/not live/);
    await expect(hiringModule.attempts.terminate("t")).rejects.toThrow(/not live/);
  });
});
```

Create `src/solutions/hiring/server/library-usage.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { usageFromRows } from "./library-usage";

describe("hiring library usage", () => {
  it("counts each opening once per library row and marks it live when a published version of an open opening uses it", () => {
    const usage = usageFromRows([
      { ref: "c1", openingId: "o1", name: "Tasarımcı · Ekim", live: false },
      { ref: "c1", openingId: "o1", name: "Tasarımcı · Ekim", live: true },
      { ref: "c1", openingId: "o2", name: "Destek · Kasım", live: false },
      { ref: "c2", openingId: "o2", name: "Destek · Kasım", live: false },
    ]);
    expect(usage.c1).toEqual({
      total: 2,
      live: 1,
      items: [
        { label: "Tasarımcı · Ekim", href: "/hiring/openings/o1" },
        { label: "Destek · Kasım", href: "/hiring/openings/o2" },
      ],
    });
    expect(usage.c2.total).toBe(1);
    expect(usage.c2.live).toBe(0);
  });
});
```

Run: `pnpm exec vitest run src/solutions/hiring/module.test.ts src/solutions/hiring/server/library-usage.test.ts` - Expected: FAIL (missing modules).

- [ ] **Step 3: Make the invite link optional in the contract**

In `src/solutions/types.ts` change `inviteHref: string;` to:

```ts
  /** Where "invite" on Today leads for this solution; null while it cannot invite yet. */
  inviteHref: string | null;
```

- [ ] **Step 4: Write the hiring manifest, module and usage**

Create `src/solutions/hiring/manifest.ts`:

```ts
import type { SolutionManifest } from "@/solutions/types";

/**
 * Hiring as the panel sees it (HIRING-UX 4.1, 4.3). Candidates are not served
 * yet: candidateFlowLive stays false until plan 2 (hiring-candidate-flow)
 * builds the candidate screens and endpoints, and inviteHref stays null until
 * invitations exist.
 */
export const hiringManifest: SolutionManifest = {
  key: "hiring",
  dbKind: "HIRING",
  basePath: "/hiring",
  label: { tr: "İşe alım", en: "Hiring" },
  nav: [{ href: "/hiring/openings", label: { tr: "Alımlar", en: "Openings" } }],
  inviteHref: null,
  candidateFlowLive: false,
  candidateStepPath: (token: string) => `/a/${encodeURIComponent(token)}`,
  positionAction: {
    label: { tr: "Bu pozisyon için alım aç", en: "Open a role for this position" },
    href: (positionId: string) => `/hiring/openings/new?position=${encodeURIComponent(positionId)}`,
  },
};
```

Create `src/solutions/hiring/server/library-usage.ts`:

```ts
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { hiringActivities, hiringActivityCompetencies, hiringOpenings, hiringStages, hiringVersions } from "@/db/schema";
import type { LibraryRefs, LibraryUsage, LibraryUsageEntry } from "@/solutions/types";

/** One entry per library row: each opening once, live when any of its rows is live. */
export function usageFromRows(rows: Array<{ ref: string; openingId: string; name: string; live: boolean }>): Record<string, LibraryUsageEntry> {
  const out: Record<string, LibraryUsageEntry> = {};
  // ref -> opening id -> already counted as live
  const seen = new Map<string, Map<string, boolean>>();
  for (const row of rows) {
    const entry = (out[row.ref] ??= { total: 0, live: 0, items: [] });
    const openings = seen.get(row.ref) ?? new Map<string, boolean>();
    seen.set(row.ref, openings);
    if (!openings.has(row.openingId)) {
      openings.set(row.openingId, false);
      entry.total += 1;
      entry.items.push({ label: row.name, href: `/hiring/openings/${row.openingId}` });
    }
    if (row.live && !openings.get(row.openingId)) {
      openings.set(row.openingId, true);
      entry.live += 1;
    }
  }
  return out;
}

/** HIRING-UX 4.2 rule 2 for hiring: which openings use a position or a competency. */
export async function hiringLibraryUsage(orgId: string, refs: LibraryRefs): Promise<LibraryUsage> {
  const positionRows = refs.positionIds.length
    ? await db
        .select({ ref: hiringOpenings.positionId, openingId: hiringOpenings.id, name: hiringOpenings.name, status: hiringOpenings.status })
        .from(hiringOpenings)
        .where(and(eq(hiringOpenings.orgId, orgId), inArray(hiringOpenings.positionId, refs.positionIds)))
    : [];
  const competencyRows = refs.competencyIds.length
    ? await db
        .selectDistinct({
          ref: hiringActivityCompetencies.competencyId,
          openingId: hiringOpenings.id,
          name: hiringOpenings.name,
          openingStatus: hiringOpenings.status,
          versionStatus: hiringVersions.status,
        })
        .from(hiringActivityCompetencies)
        .innerJoin(hiringActivities, eq(hiringActivities.id, hiringActivityCompetencies.activityId))
        .innerJoin(hiringStages, eq(hiringStages.id, hiringActivities.stageId))
        .innerJoin(hiringVersions, eq(hiringVersions.id, hiringStages.versionId))
        .innerJoin(hiringOpenings, eq(hiringOpenings.id, hiringVersions.openingId))
        .where(and(eq(hiringOpenings.orgId, orgId), inArray(hiringActivityCompetencies.competencyId, refs.competencyIds)))
    : [];
  return {
    positions: usageFromRows(positionRows.map((r) => ({ ref: r.ref, openingId: r.openingId, name: r.name, live: r.status === "OPEN" }))),
    competencies: usageFromRows(
      competencyRows.map((r) => ({ ref: r.ref, openingId: r.openingId, name: r.name, live: r.openingStatus === "OPEN" && r.versionStatus === "PUBLISHED" })),
    ),
  };
}
```

Create `src/solutions/hiring/module.ts`:

```ts
import type { SolutionModule } from "@/solutions/types";
import { hiringManifest } from "./manifest";
import { hiringLibraryUsage } from "./server/library-usage";

/** Thrown if a candidate path ever reaches hiring before plan 2; the core never routes one here (candidateFlowLive). */
function notLive(what: string): never {
  throw new Error(`hiring candidate flow is not live yet (${what}); plan 2 builds it`);
}

export const hiringModule: SolutionModule = {
  ...hiringManifest,
  // Hiring's Today rows (waiting reviews, decisions) arrive with plan 3.
  async today() {
    return [];
  },
  // Proctoring for hiring arrives with plan 4.
  async proctorPolicy() {
    return null;
  },
  candidate: {
    async loadState() {
      return notLive("loadState");
    },
    async title() {
      return notLive("title");
    },
    async heartbeat() {
      return notLive("heartbeat");
    },
  },
  attempts: {
    async openSegment() {
      return null;
    },
    async terminate() {
      return notLive("terminate");
    },
    async onMediaComplete() {
      return notLive("onMediaComplete");
    },
  },
  library: { usage: hiringLibraryUsage },
};
```

- [ ] **Step 5: Register it and fix Today's invite**

In `src/solutions/registry.ts`: import `hiringManifest` from `@/solutions/hiring/manifest`; set `SOLUTION_MANIFESTS = [hiringManifest, languageExamManifest]` (update its comment: "hiring first, HIRING-UX 4.1"); and append:

```ts
/**
 * Solutions Today can invite for, in menu order. Today must not pick the first
 * solution blindly: hiring is first in the menu but cannot invite until plan 2.
 */
export function inviteTargets(manifests: readonly SolutionManifest[] = SOLUTION_MANIFESTS): Array<{ key: SolutionManifest["key"]; href: string }> {
  return manifests.flatMap((m) => (m.inviteHref ? [{ key: m.key, href: m.inviteHref }] : []));
}
```

In `src/solutions/registry.server.ts`: import `hiringModule` from `@/solutions/hiring/module` and set `MODULES = [hiringModule, languageExamModule]`.

In `src/app/(manager)/dashboard/page.tsx`: import `inviteTargets` from `@/solutions/registry` and replace `const inviteHref = modules[0]?.inviteHref ?? "/dashboard";` with:

```tsx
  // The first solution that can invite. Hiring is first in the menu but invites only from plan 2 on.
  const inviteHref = inviteTargets()[0]?.href ?? "/dashboard";
```

- [ ] **Step 6: Run the tests, gates, build, exam and guard**

```bash
pnpm exec vitest run src/solutions src/lib/candidate-api.test.ts "src/app/a/[token]/rights/page.test.ts" src/lib/legacy-routes.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
Start the dev server, then `DATABASE_URL=... pnpm verify:guard` (it must print only `ok`: hiring is now registered, every core candidate endpoint and the rights page must still answer a HIRING token like an unknown one). Keep the server for Step 7.

- [ ] **Step 7: Browser check (Claude in Chrome)**

1. The menu shows group headers İŞE ALIM (Alımlar), SINAV (Öğrenciler, Sınavlar, Soru bankası), KÜTÜPHANE (Pozisyonlar, Yetkinlikler), then Ayarlar; "Alımlar" is active on `/hiring/openings/...`.
2. `/dashboard` still says "Öğrenci davet et" and leads to `/exam/students/new`.
3. The position page from Task 6 now has the filled "Bu pozisyon için alım aç" and an outline "Kaydet"; the button opens `/hiring/openings/new` with that position picked.
4. İletişim's "Nerede kullanılıyor" lists "İşe alım · n" once an opening's question measures it (after Task 15) or stays "Henüz hiçbir yerde kullanılmıyor." now; the position used by the Task 13 openings shows "İşe alım · 2".
Stop the server; close your tabs.

- [ ] **Step 8: Commit**

```bash
git add src/solutions/types.ts src/solutions/hiring/manifest.ts src/solutions/hiring/module.ts src/solutions/hiring/module.test.ts src/solutions/hiring/server/library-usage.ts src/solutions/hiring/server/library-usage.test.ts src/solutions/registry.ts src/solutions/registry.server.ts src/solutions/registry.test.ts "src/app/(manager)/dashboard/page.tsx"
git commit -m "Register the hiring solution for the panel, not for candidates" -m "Hiring is first in the grouped menu (Alımlar), reports where it uses library rows and offers 'Bu pozisyon için alım aç' on positions. Its candidate flow stays off (candidateFlowLive false), so every core candidate endpoint still answers its invitations like unknown tokens, and Today's invite button now picks the first solution that can invite instead of the first in the menu. The registry test covers both solutions and a stubbed one." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: Assessment builder (`/assessment/edit`)

**Files:**
- Create: `src/app/(manager)/hiring/openings/[id]/assessment/page.tsx` (redirect)
- Create: `src/app/(manager)/hiring/openings/[id]/assessment/edit/result.ts`, `edit/actions.ts`, `edit/page.tsx`
- Create: `src/components/hiring/builder/use-saver.ts`, `builder.tsx`, `stage-editor.tsx`, `activity-editor.tsx`
- Modify: `src/components/ui/undo-strip.tsx` (optional `onSubmitted`)
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (namespace `hiringBuilder`)

**Interfaces:**
- Consumes: Task 11 version functions, Task 13 helpers (`openingFor`, `workingState`, `describeProblem`, `OpeningHeader`, `AssessmentTabs`, `publishOpeningAction`).
- Produces: `type ActionResult<T> = { ok: true; value: T; at: string } | { ok: false; code: string }` in `edit/result.ts`.
- Produces server actions in `edit/actions.ts`: `startDraftAction(formData)`, `addStageAction(openingId)`, `saveStageAction(openingId, stageId, patch)`, `moveStageAction(openingId, stageId, direction)`, `deleteStageAction(openingId, stageId)`, `restoreStageFormAction(formData)`, `addActivityAction(openingId, stageId, type)`, `saveActivityAction(openingId, activityId, patch)`, `moveActivityAction(openingId, activityId, direction)`, `deleteActivityAction(openingId, activityId)`, `restoreActivityFormAction(formData)`, `setCompetenciesAction(openingId, activityId, ids)`.
- Produces: `Builder` client component with a `checkSlot?: React.ReactNode` prop for the bar (Task 18 fills it); `useSaver()`.
- Produces dictionary namespace `hiringBuilder`.

- [ ] **Step 1: Let the undo strip report a submit**

In `src/components/ui/undo-strip.tsx` add the optional prop `onSubmitted?: () => void;` (doc comment: "Called when 'Geri al' is pressed, so the caller can forget what it was holding.") to the props, destructure it, and change the form to `<form action={action} className="contents" onSubmit={() => onSubmitted?.()}>`. Nothing else changes; existing callers pass nothing.

- [ ] **Step 2: Write the actions**

Create `src/app/(manager)/hiring/openings/[id]/assessment/edit/result.ts`:

```ts
/** What every builder action answers; `at` feeds "Kaydedildi 14:02". */
export type ActionResult<T> = { ok: true; value: T; at: string } | { ok: false; code: string };
```

Create `src/app/(manager)/hiring/openings/[id]/assessment/edit/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { activityPayloadSchema, stagePayloadSchema, type ActivityPatch, type StagePatch } from "@/solutions/hiring/rules/patches";
import type { ActivityType } from "@/solutions/hiring/rules/content";
import { HiringConflict, HiringNotFound } from "@/solutions/hiring/server/errors";
import {
  addActivity,
  addStage,
  deleteActivity,
  deleteStage,
  ensureDraftVersion,
  insertActivity,
  insertStage,
  moveActivity,
  moveStage,
  setActivityCompetencies,
  updateActivity,
  updateStage,
} from "@/solutions/hiring/server/versions";
import { openingFor } from "../../access";
import type { ActionResult } from "./result";

/**
 * Builder writes (HIRING-UX 5.5). Every action checks the opening and the
 * user's right to edit it, then hands a validated change to the draft. A
 * refused change answers with a code; anything else is a real error.
 */
async function run<T>(openingId: string, work: (orgId: string) => Promise<T>): Promise<ActionResult<T>> {
  const { user } = await openingFor(openingId, "edit");
  try {
    const value = await work(user.orgId);
    revalidatePath("/hiring/openings/[id]", "layout");
    return { ok: true, value, at: new Date().toISOString() };
  } catch (error) {
    if (error instanceof HiringConflict || error instanceof HiringNotFound) return { ok: false, code: error.code };
    if (error instanceof ZodError) return { ok: false, code: "INVALID" };
    throw error;
  }
}

/** "Düzenlemeye başla": opens v(n+1) as a copy of the live version. */
export async function startDraftAction(formData: FormData) {
  const openingId = String(formData.get("openingId") ?? "");
  const { user } = await openingFor(openingId, "edit");
  await ensureDraftVersion(user.orgId, openingId);
  revalidatePath("/hiring/openings/[id]", "layout");
  redirect(`/hiring/openings/${openingId}/assessment/edit`);
}

export async function addStageAction(openingId: string) {
  return run(openingId, (orgId) => addStage(orgId, openingId));
}
export async function saveStageAction(openingId: string, stageId: string, patch: StagePatch) {
  return run(openingId, (orgId) => updateStage(orgId, openingId, stageId, patch));
}
export async function moveStageAction(openingId: string, stageId: string, direction: -1 | 1) {
  return run(openingId, (orgId) => moveStage(orgId, openingId, stageId, direction));
}
export async function deleteStageAction(openingId: string, stageId: string) {
  return run(openingId, (orgId) => deleteStage(orgId, openingId, stageId));
}
export async function addActivityAction(openingId: string, stageId: string, type: ActivityType) {
  return run(openingId, (orgId) => addActivity(orgId, openingId, stageId, type));
}
export async function saveActivityAction(openingId: string, activityId: string, patch: ActivityPatch) {
  return run(openingId, (orgId) => updateActivity(orgId, openingId, activityId, patch));
}
export async function moveActivityAction(openingId: string, activityId: string, direction: -1 | 1) {
  return run(openingId, (orgId) => moveActivity(orgId, openingId, activityId, direction));
}
export async function deleteActivityAction(openingId: string, activityId: string) {
  return run(openingId, (orgId) => deleteActivity(orgId, openingId, activityId));
}
export async function setCompetenciesAction(openingId: string, activityId: string, ids: string[]) {
  return run(openingId, (orgId) => setActivityCompetencies(orgId, openingId, activityId, ids));
}

/** The 8 second undo strip after deleting a stage. */
export async function restoreStageFormAction(formData: FormData) {
  const openingId = String(formData.get("openingId") ?? "");
  const { user } = await openingFor(openingId, "edit");
  const payload = stagePayloadSchema.parse(JSON.parse(String(formData.get("payload") ?? "null")));
  const index = Number(formData.get("index"));
  await insertStage(user.orgId, openingId, payload, Number.isInteger(index) ? index : null);
  revalidatePath("/hiring/openings/[id]", "layout");
}

/** The 8 second undo strip after deleting a question. */
export async function restoreActivityFormAction(formData: FormData) {
  const openingId = String(formData.get("openingId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  const { user } = await openingFor(openingId, "edit");
  const payload = activityPayloadSchema.parse(JSON.parse(String(formData.get("payload") ?? "null")));
  const index = Number(formData.get("index"));
  await insertActivity(user.orgId, openingId, stageId, payload, Number.isInteger(index) ? index : null);
  revalidatePath("/hiring/openings/[id]", "layout");
}
```

- [ ] **Step 3: Add the builder copy**

Add to `src/i18n/messages/hiring.tr.json`:

```json
  "hiringBuilder": {
    "candidateSide": "Adayın gördüğü",
    "teamSide": "Sadece ekip görür",
    "treeLabel": "Değerlendirme yapısı",
    "untitledStage": "Aşama {n}",
    "untitledActivity": "Adsız soru",
    "addStage": "Aşama ekle",
    "addActivity": "Soru ekle",
    "total": "{stages} aşama · {minutes} dk",
    "respectTime": "Adayın zamanına saygı: 30 dk altı önerilir.",
    "emptyTitle": "Değerlendirme henüz boş",
    "emptyBody": "İlan metninden AI taslağı al ya da ilk aşamayı kendin ekle.",
    "emptyAi": "AI taslağına git",
    "selectHint": "Soldan bir aşama ya da soru seç.",
    "stageName": "Aşama adı",
    "stageDescription": "Adaya açıklama",
    "stageMinutes": "Süre (dakika)",
    "stagePurpose": "Bu aşamanın amacı",
    "stageMinutesShort": "{minutes} dk",
    "prompt": "Soru metni",
    "note": "Adaya not",
    "type": "Soru tipi",
    "typeVIDEO": "Video",
    "typeAUDIO": "Ses",
    "typeLONG_TEXT": "Uzun yazı",
    "typeSHORT_TEXT": "Kısa yazı",
    "typeSINGLE_CHOICE": "Tek seçimli",
    "typeMULTI_CHOICE": "Çok seçimli",
    "typeFILE_UPLOAD": "Dosya",
    "required": "Zorunlu",
    "thinkSeconds": "Düşünme süresi (sn)",
    "flexibleThink": "Esnek: süre bitince kayıt kendiliğinden başlamaz",
    "answerSeconds": "Cevap süresi (sn)",
    "takes": "Tekrar hakkı",
    "takes1": "Tekrar yok",
    "takes2": "1 tekrar",
    "takes3": "2 tekrar",
    "textAlternative": "Yazılı alternatife izin ver",
    "textAlternativeHint": "Kayıt yapamayan aday cezasız olarak yazıyla cevaplar.",
    "minChars": "En az karakter",
    "maxChars": "En fazla karakter",
    "choices": "Seçenekler",
    "choiceCorrect": "Doğru cevap",
    "addChoice": "Seçenek ekle",
    "removeChoice": "Kaldır",
    "choiceKeyNote": "Doğru cevap adaya hiç gönderilmez.",
    "fileTypes": "İzin verilen dosyalar",
    "filePdf": "PDF",
    "fileWord": "Word",
    "fileImage": "Görsel (PNG, JPG)",
    "fileZip": "ZIP",
    "maxFileMb": "En büyük boyut (MB)",
    "purpose": "Amaç",
    "competencies": "Ölçtüğü yetkinlikler (en fazla 2)",
    "competencyLimit": "En fazla 2 yetkinlik seçilebilir; birini kaldırınca diğerleri açılır.",
    "choiceNoCompetency": "Seçmeli sorular yetkinlik ölçmez, bilgi skoruna gider.",
    "archived": "arşivde",
    "examplesTitle": "İyi cevap örnekleri",
    "examplesHint": "Yetkinlik çapasını bu soruya indir: bu soruda 1, 3 ve 5 neye benziyor?",
    "example1": "Seviye 1",
    "example3": "Seviye 3",
    "example5": "Seviye 5",
    "behaviours": "Beklenen davranışlar (her satıra bir)",
    "redFlags": "Kırmızı bayraklar (her satıra bir)",
    "managerNotes": "Değerlendiriciye not",
    "moveUp": "Yukarı taşı",
    "moveDown": "Aşağı taşı",
    "deleteStage": "Aşamayı sil",
    "deleteActivity": "Soruyu sil",
    "stageDeleted": "Aşama silindi.",
    "activityDeleted": "Soru silindi.",
    "saving": "Kaydediliyor",
    "savedAt": "Kaydedildi {time}",
    "saveRetrying": "Kaydedilemedi, tekrar deniyoruz.",
    "saveFailed": "Kaydedilemedi.",
    "saveRefused": "Bu değer kabul edilmedi; aralığı kontrol et.",
    "retry": "Tekrar dene",
    "preview": "Önizle",
    "publish": "Yayınla",
    "moreProblems": "ve {count} eksik daha",
    "startEditing": "Düzenlemeye başla",
    "liveNote": "Yayındaki v{live} değişmez. Değişiklikler v{next} olarak kaydedilir; yayındaki sürüme bağlı adayları etkilemez.",
    "readOnly": "Rolün değerlendirmeyi düzenleyemez.",
    "published": "v{number} yayınlandı.",
    "publishRefused": "Yayınlanamadı. Eksikleri tamamla."
  }
```

and to `hiring.en.json`:

```json
  "hiringBuilder": {
    "candidateSide": "What the candidate sees",
    "teamSide": "Team only",
    "treeLabel": "Assessment structure",
    "untitledStage": "Stage {n}",
    "untitledActivity": "Untitled question",
    "addStage": "Add a stage",
    "addActivity": "Add a question",
    "total": "{stages, plural, one {# stage} other {# stages}} · {minutes} min",
    "respectTime": "Respect the candidate's time: under 30 minutes is recommended.",
    "emptyTitle": "The assessment is empty",
    "emptyBody": "Get an AI draft from the job ad, or add the first stage yourself.",
    "emptyAi": "Open the AI draft",
    "selectHint": "Pick a stage or a question on the left.",
    "stageName": "Stage name",
    "stageDescription": "Description for the candidate",
    "stageMinutes": "Time (minutes)",
    "stagePurpose": "What this stage is for",
    "stageMinutesShort": "{minutes} min",
    "prompt": "Question",
    "note": "Note to the candidate",
    "type": "Question type",
    "typeVIDEO": "Video",
    "typeAUDIO": "Audio",
    "typeLONG_TEXT": "Long text",
    "typeSHORT_TEXT": "Short text",
    "typeSINGLE_CHOICE": "Single choice",
    "typeMULTI_CHOICE": "Multiple choice",
    "typeFILE_UPLOAD": "File",
    "required": "Required",
    "thinkSeconds": "Thinking time (s)",
    "flexibleThink": "Flexible: recording does not start by itself when time is up",
    "answerSeconds": "Answer time (s)",
    "takes": "Retakes",
    "takes1": "No retake",
    "takes2": "1 retake",
    "takes3": "2 retakes",
    "textAlternative": "Allow a written alternative",
    "textAlternativeHint": "A candidate who cannot record answers in writing, without penalty.",
    "minChars": "Minimum characters",
    "maxChars": "Maximum characters",
    "choices": "Options",
    "choiceCorrect": "Right answer",
    "addChoice": "Add an option",
    "removeChoice": "Remove",
    "choiceKeyNote": "The right answer is never sent to the candidate.",
    "fileTypes": "Allowed files",
    "filePdf": "PDF",
    "fileWord": "Word",
    "fileImage": "Image (PNG, JPG)",
    "fileZip": "ZIP",
    "maxFileMb": "Largest size (MB)",
    "purpose": "Purpose",
    "competencies": "Competencies it measures (at most 2)",
    "competencyLimit": "At most 2 competencies; remove one to pick another.",
    "choiceNoCompetency": "Choice questions measure no competency; they feed the knowledge score.",
    "archived": "archived",
    "examplesTitle": "Good answer examples",
    "examplesHint": "Bring the competency anchor down to this question: what do 1, 3 and 5 look like here?",
    "example1": "Level 1",
    "example3": "Level 3",
    "example5": "Level 5",
    "behaviours": "Expected behaviours (one per line)",
    "redFlags": "Red flags (one per line)",
    "managerNotes": "Note to reviewers",
    "moveUp": "Move up",
    "moveDown": "Move down",
    "deleteStage": "Delete the stage",
    "deleteActivity": "Delete the question",
    "stageDeleted": "Stage deleted.",
    "activityDeleted": "Question deleted.",
    "saving": "Saving",
    "savedAt": "Saved {time}",
    "saveRetrying": "Could not save, trying again.",
    "saveFailed": "Could not save.",
    "saveRefused": "This value was not accepted; check the range.",
    "retry": "Try again",
    "preview": "Preview",
    "publish": "Publish",
    "moreProblems": "and {count} more",
    "startEditing": "Start editing",
    "liveNote": "The live v{live} does not change. Changes are saved as v{next}; candidates on the live version are not affected.",
    "readOnly": "Your role cannot edit the assessment.",
    "published": "v{number} published.",
    "publishRefused": "Could not publish. Complete what is missing."
  }
```

- [ ] **Step 4: Write the saver hook and the editors**

Create `src/components/hiring/builder/use-saver.ts`:

```ts
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/result";

export type SaverState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "refused" }
  | { kind: "error"; retry: () => void; retrying: boolean };

/**
 * One save line for the builder bar (HIRING-UX 5.5): "Kaydedildi 14:02", or
 * "Kaydedilemedi, tekrar deniyoruz." with one automatic retry after 3 s and a
 * manual "Tekrar dene". A change the server refused (a code) is not retried.
 */
export function useSaver() {
  const router = useRouter();
  const [state, setState] = useState<SaverState>({ kind: "idle" });

  async function run<T>(call: () => Promise<ActionResult<T>>, attempt = 0): Promise<ActionResult<T>> {
    setState({ kind: "saving" });
    let result: ActionResult<T>;
    try {
      result = await call();
    } catch {
      result = { ok: false, code: "NETWORK" };
    }
    if (result.ok) {
      setState({ kind: "saved", at: result.at });
      router.refresh();
      return result;
    }
    if (result.code !== "NETWORK") {
      setState({ kind: "refused" });
      return result;
    }
    const retrying = attempt === 0;
    setState({ kind: "error", retry: () => void run(call, 1), retrying });
    if (retrying) setTimeout(() => void run(call, 1), 3000);
    return result;
  }

  return { state, run };
}
```

Create `src/components/hiring/builder/stage-editor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import type { ContentStage } from "@/solutions/hiring/rules/content";
import type { StagePatch } from "@/solutions/hiring/rules/patches";

/** The stage's candidate text in the middle column and its purpose in the team column. */
export function StageEditor({
  stage,
  editable,
  onSave,
  onMove,
  onDelete,
}: {
  stage: ContentStage;
  editable: boolean;
  onSave: (patch: StagePatch) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const t = useMT("hiringBuilder");
  const [name, setName] = useState<I18nText>(stage.name);
  const [description, setDescription] = useState<I18nText>(stage.description);
  const [minutes, setMinutes] = useState(String(Math.round(stage.durationSeconds / 60)));
  const [purpose, setPurpose] = useState(stage.internalPurpose ?? "");

  return (
    <>
      <section className="space-y-field rounded-xl border border-line bg-surface p-card" aria-label={t("candidateSide")}>
        <h2 className="text-[13px] font-medium tracking-[0.06em] text-muted uppercase">{t("candidateSide")}</h2>
        {(["tr", "en"] as const).map((lang) => (
          <div key={lang} className="space-y-2">
            <Label htmlFor={`stage-name-${lang}`}>{`${t("stageName")} (${lang.toUpperCase()})`}</Label>
            <Input
              id={`stage-name-${lang}`}
              value={name[lang]}
              disabled={!editable}
              onChange={(e) => setName({ ...name, [lang]: e.target.value })}
              onBlur={() => onSave({ name })}
            />
          </div>
        ))}
        {(["tr", "en"] as const).map((lang) => (
          <div key={lang} className="space-y-2">
            <Label htmlFor={`stage-desc-${lang}`}>{`${t("stageDescription")} (${lang.toUpperCase()})`}</Label>
            <Textarea
              id={`stage-desc-${lang}`}
              value={description[lang]}
              disabled={!editable}
              onChange={(e) => setDescription({ ...description, [lang]: e.target.value })}
              onBlur={() => onSave({ description })}
            />
          </div>
        ))}
        <div className="max-w-[200px] space-y-2">
          <Label htmlFor="stage-minutes">{t("stageMinutes")}</Label>
          <Input
            id="stage-minutes"
            type="number"
            min={1}
            max={120}
            className="tnum"
            value={minutes}
            disabled={!editable}
            onChange={(e) => setMinutes(e.target.value)}
            onBlur={() => {
              const m = Number(minutes);
              if (Number.isInteger(m) && m >= 1 && m <= 120) onSave({ durationSeconds: m * 60 });
            }}
          />
        </div>
        {editable ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onMove(-1)}>
              {t("moveUp")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onMove(1)}>
              {t("moveDown")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              {t("deleteStage")}
            </Button>
          </div>
        ) : null}
      </section>
      <section className="space-y-field rounded-xl bg-vault p-card text-vault-text" aria-label={t("teamSide")}>
        <h2 className="text-[13px] font-medium tracking-[0.06em] text-vault-label uppercase">{t("teamSide")}</h2>
        <div className="space-y-2">
          <Label htmlFor="stage-purpose" className="text-vault-label">
            {t("stagePurpose")}
          </Label>
          <Textarea
            id="stage-purpose"
            className="border-vault-line bg-vault-box text-vault-text"
            value={purpose}
            disabled={!editable}
            onChange={(e) => setPurpose(e.target.value)}
            onBlur={() => onSave({ internalPurpose: purpose.trim() || null })}
          />
        </div>
      </section>
    </>
  );
}
```

Create `src/components/hiring/builder/activity-editor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { HiringActivityConfig } from "@/db/schema";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import { ACTIVITY_TYPES, isChoice, isRecorded, MAX_COMPETENCIES_PER_ACTIVITY, type ContentActivity } from "@/solutions/hiring/rules/content";
import type { ActivityPatch } from "@/solutions/hiring/rules/patches";

const FILE_TYPES = [
  ["filePdf", ["application/pdf"]],
  ["fileWord", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
  ["fileImage", ["image/png", "image/jpeg"]],
  ["fileZip", ["application/zip"]],
] as const;

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const vaultField = "border-vault-line bg-vault-box text-vault-text";

/**
 * HIRING-UX 5.5 middle and right columns for one question. Text saves on blur,
 * switches and selects save at once; the parent's saver shows the result.
 */
export function ActivityEditor({
  activity,
  competencies,
  editable,
  onSave,
  onSetCompetencies,
  onMove,
  onDelete,
}: {
  activity: ContentActivity;
  competencies: Array<{ id: string; name: string; archived: boolean }>;
  editable: boolean;
  onSave: (patch: ActivityPatch) => void;
  onSetCompetencies: (ids: string[]) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const t = useMT("hiringBuilder");
  const [a, setA] = useState(activity);
  const [behaviours, setBehaviours] = useState(activity.expectedBehaviours.join("\n"));
  const [redFlags, setRedFlags] = useState(activity.redFlags.join("\n"));
  const [numbers, setNumbers] = useState({
    thinkSeconds: String(activity.thinkSeconds),
    answerSeconds: activity.answerSeconds === null ? "" : String(activity.answerSeconds),
    minChars: String(activity.config.minChars ?? ""),
    maxChars: String(activity.config.maxChars ?? ""),
    maxFileMb: activity.config.maxFileBytes ? String(Math.round(activity.config.maxFileBytes / 1024 / 1024)) : "",
  });
  const setConfig = (config: HiringActivityConfig, save: boolean) => {
    setA({ ...a, config });
    if (save) onSave({ config });
  };
  const int = (s: string) => (/^\d+$/.test(s) ? Number(s) : null);
  const choices = a.config.choices ?? [];

  return (
    <>
      <section className="space-y-field rounded-xl border border-line bg-surface p-card" aria-label={t("candidateSide")}>
        <h2 className="text-[13px] font-medium tracking-[0.06em] text-muted uppercase">{t("candidateSide")}</h2>
        <Tabs defaultValue="tr">
          <TabsList>
            <TabsTrigger value="tr">TR</TabsTrigger>
            <TabsTrigger value="en">EN</TabsTrigger>
          </TabsList>
          {(["tr", "en"] as const).map((lang) => (
            <TabsContent key={lang} value={lang} className="space-y-field pt-3">
              <div className="space-y-2">
                <Label htmlFor={`prompt-${lang}`}>{t("prompt")}</Label>
                <Textarea
                  id={`prompt-${lang}`}
                  rows={4}
                  className="text-[16px]"
                  value={a.prompt[lang]}
                  disabled={!editable}
                  onChange={(e) => setA({ ...a, prompt: { ...a.prompt, [lang]: e.target.value } })}
                  onBlur={() => onSave({ prompt: a.prompt })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`note-${lang}`}>{t("note")}</Label>
                <Textarea
                  id={`note-${lang}`}
                  value={a.note[lang]}
                  disabled={!editable}
                  onChange={(e) => setA({ ...a, note: { ...a.note, [lang]: e.target.value } })}
                  onBlur={() => onSave({ note: a.note })}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="grid gap-field md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("type")}</Label>
            <Select value={a.type} disabled={!editable} onValueChange={(type) => onSave({ type: type as ContentActivity["type"] })}>
              <SelectTrigger aria-label={t("type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`type${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-3 pt-7 text-[14px] text-ink">
            <Switch checked={a.required} disabled={!editable} onCheckedChange={(required) => (setA({ ...a, required }), onSave({ required }))} />
            {t("required")}
          </label>
        </div>

        {isRecorded(a.type) ? (
          <div className="grid gap-field md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="think">{t("thinkSeconds")}</Label>
              <Input
                id="think"
                type="number"
                min={0}
                max={600}
                className="tnum"
                value={numbers.thinkSeconds}
                disabled={!editable}
                onChange={(e) => setNumbers({ ...numbers, thinkSeconds: e.target.value })}
                onBlur={() => {
                  const v = int(numbers.thinkSeconds);
                  if (v !== null) onSave({ thinkSeconds: v });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">{t("answerSeconds")}</Label>
              <Input
                id="answer"
                type="number"
                min={30}
                max={1800}
                className="tnum"
                value={numbers.answerSeconds}
                disabled={!editable}
                onChange={(e) => setNumbers({ ...numbers, answerSeconds: e.target.value })}
                onBlur={() => {
                  const v = int(numbers.answerSeconds);
                  if (v !== null) onSave({ answerSeconds: v });
                }}
              />
            </div>
            <label className="flex items-center gap-3 text-[14px] text-ink md:col-span-2">
              <Switch
                checked={a.flexibleThink}
                disabled={!editable}
                onCheckedChange={(flexibleThink) => (setA({ ...a, flexibleThink }), onSave({ flexibleThink }))}
              />
              {t("flexibleThink")}
            </label>
            <div className="space-y-2">
              <Label>{t("takes")}</Label>
              <Select value={String(a.maxTakes)} disabled={!editable} onValueChange={(v) => (setA({ ...a, maxTakes: Number(v) }), onSave({ maxTakes: Number(v) }))}>
                <SelectTrigger aria-label={t("takes")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("takes1")}</SelectItem>
                  <SelectItem value="2">{t("takes2")}</SelectItem>
                  <SelectItem value="3">{t("takes3")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="flex items-center gap-3 text-[14px] text-ink">
                <Switch
                  checked={a.config.textAlternativeEnabled ?? false}
                  disabled={!editable}
                  onCheckedChange={(on) => setConfig({ ...a.config, textAlternativeEnabled: on }, true)}
                />
                {t("textAlternative")}
              </label>
              <p className="pl-12 text-[13px] text-muted">{t("textAlternativeHint")}</p>
            </div>
          </div>
        ) : null}

        {a.type === "LONG_TEXT" || a.type === "SHORT_TEXT" ? (
          <div className="grid gap-field md:grid-cols-2">
            {(["minChars", "maxChars"] as const).map((key) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{t(key)}</Label>
                <Input
                  id={key}
                  type="number"
                  min={0}
                  max={20000}
                  className="tnum"
                  value={numbers[key]}
                  disabled={!editable}
                  onChange={(e) => setNumbers({ ...numbers, [key]: e.target.value })}
                  onBlur={() => {
                    const v = int(numbers[key]);
                    if (v !== null) setConfig({ ...a.config, [key]: v }, true);
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}

        {isChoice(a.type) ? (
          <div className="space-y-3">
            <Label>{t("choices")}</Label>
            {choices.map((choice) => (
              <div key={choice.id} className="grid items-center gap-2 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="flex items-center gap-2 text-[13px] text-muted">
                  <Checkbox
                    checked={choice.correct === true}
                    disabled={!editable}
                    aria-label={t("choiceCorrect")}
                    onCheckedChange={(checked) =>
                      setConfig(
                        {
                          ...a.config,
                          choices: choices.map((c) =>
                            a.type === "SINGLE_CHOICE" ? { ...c, correct: c.id === choice.id && checked === true } : c.id === choice.id ? { ...c, correct: checked === true } : c,
                          ),
                        },
                        true,
                      )
                    }
                  />
                  {t("choiceCorrect")}
                </label>
                {(["tr", "en"] as const).map((lang) => (
                  <Input
                    key={lang}
                    placeholder={lang.toUpperCase()}
                    aria-label={`${t("choices")} ${lang.toUpperCase()}`}
                    value={choice.label[lang]}
                    disabled={!editable}
                    onChange={(e) =>
                      setConfig({ ...a.config, choices: choices.map((c) => (c.id === choice.id ? { ...c, label: { ...c.label, [lang]: e.target.value } } : c)) }, false)
                    }
                    onBlur={() => onSave({ config: a.config })}
                  />
                ))}
                {editable ? (
                  <Button variant="ghost" size="sm" onClick={() => setConfig({ ...a.config, choices: choices.filter((c) => c.id !== choice.id) }, true)}>
                    {t("removeChoice")}
                  </Button>
                ) : null}
              </div>
            ))}
            {editable && choices.length < 10 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfig({ ...a.config, choices: [...choices, { id: crypto.randomUUID().slice(0, 8), label: { tr: "", en: "" } }] }, true)}
              >
                {t("addChoice")}
              </Button>
            ) : null}
            <p className="text-[13px] text-muted">{t("choiceKeyNote")}</p>
          </div>
        ) : null}

        {a.type === "FILE_UPLOAD" ? (
          <div className="space-y-3">
            <Label>{t("fileTypes")}</Label>
            <div className="flex flex-wrap gap-4">
              {FILE_TYPES.map(([key, mimes]) => {
                const on = mimes.every((m) => (a.config.acceptedMimeTypes ?? []).includes(m));
                return (
                  <label key={key} className="flex items-center gap-2 text-[14px] text-ink">
                    <Checkbox
                      checked={on}
                      disabled={!editable}
                      onCheckedChange={(checked) => {
                        const current = (a.config.acceptedMimeTypes ?? []).filter((m) => !(mimes as readonly string[]).includes(m));
                        setConfig({ ...a.config, acceptedMimeTypes: checked === true ? [...current, ...mimes] : current }, true);
                      }}
                    />
                    {t(key)}
                  </label>
                );
              })}
            </div>
            <div className="max-w-[200px] space-y-2">
              <Label htmlFor="max-mb">{t("maxFileMb")}</Label>
              <Input
                id="max-mb"
                type="number"
                min={1}
                max={50}
                className="tnum"
                value={numbers.maxFileMb}
                disabled={!editable}
                onChange={(e) => setNumbers({ ...numbers, maxFileMb: e.target.value })}
                onBlur={() => {
                  const v = int(numbers.maxFileMb);
                  if (v !== null && v >= 1 && v <= 50) setConfig({ ...a.config, maxFileBytes: v * 1024 * 1024 }, true);
                }}
              />
            </div>
          </div>
        ) : null}

        {editable ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onMove(-1)}>
              {t("moveUp")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onMove(1)}>
              {t("moveDown")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              {t("deleteActivity")}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="space-y-field rounded-xl bg-vault p-card text-vault-text" aria-label={t("teamSide")}>
        <h2 className="text-[13px] font-medium tracking-[0.06em] text-vault-label uppercase">{t("teamSide")}</h2>
        <div className="space-y-2">
          <Label htmlFor="purpose" className="text-vault-label">
            {t("purpose")}
          </Label>
          <Textarea
            id="purpose"
            className={vaultField}
            value={a.internalQuestion ?? ""}
            disabled={!editable}
            onChange={(e) => setA({ ...a, internalQuestion: e.target.value })}
            onBlur={() => onSave({ internalQuestion: a.internalQuestion?.trim() || null })}
          />
        </div>
        <div className="space-y-2">
          <p className="text-[13px] text-vault-label">{t("competencies")}</p>
          {isChoice(a.type) ? (
            <p className="text-[13px] text-vault-label">{t("choiceNoCompetency")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {competencies
                  .filter((c) => !c.archived || a.competencyIds.includes(c.id))
                  .map((c) => {
                    const on = a.competencyIds.includes(c.id);
                    const blocked = !on && a.competencyIds.length >= MAX_COMPETENCIES_PER_ACTIVITY;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        disabled={!editable || blocked}
                        onClick={() => {
                          const ids = on ? a.competencyIds.filter((x) => x !== c.id) : [...a.competencyIds, c.id];
                          setA({ ...a, competencyIds: ids });
                          onSetCompetencies(ids);
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[13px] transition-colors",
                          on ? "border-vault-text bg-vault-text text-vault" : "border-vault-chip text-vault-text hover:border-vault-text",
                          blocked && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {c.name}
                        {c.archived ? ` (${t("archived")})` : ""}
                      </button>
                    );
                  })}
              </div>
              {a.competencyIds.length >= MAX_COMPETENCIES_PER_ACTIVITY ? <p className="text-[13px] text-vault-label">{t("competencyLimit")}</p> : null}
            </>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-[13px] text-vault-label">{t("examplesTitle")}</p>
          <p className="text-[12px] text-vault-label">{t("examplesHint")}</p>
          {([1, 3, 5] as const).map((level) => (
            <div key={level} className="space-y-1">
              <Label htmlFor={`example-${level}`} className="text-vault-label">
                {t(`example${level}`)}
              </Label>
              <Textarea
                id={`example-${level}`}
                className={vaultField}
                value={a.answerExamples[level] ?? ""}
                disabled={!editable}
                onChange={(e) => setA({ ...a, answerExamples: { ...a.answerExamples, [level]: e.target.value } })}
                onBlur={() => onSave({ answerExamples: a.answerExamples })}
              />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="behaviours" className="text-vault-label">
            {t("behaviours")}
          </Label>
          <Textarea id="behaviours" className={vaultField} value={behaviours} disabled={!editable} onChange={(e) => setBehaviours(e.target.value)} onBlur={() => onSave({ expectedBehaviours: lines(behaviours) })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="red-flags" className="text-vault-label">
            {t("redFlags")}
          </Label>
          <Textarea id="red-flags" className={vaultField} value={redFlags} disabled={!editable} onChange={(e) => setRedFlags(e.target.value)} onBlur={() => onSave({ redFlags: lines(redFlags) })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manager-notes" className="text-vault-label">
            {t("managerNotes")}
          </Label>
          <Textarea
            id="manager-notes"
            className={vaultField}
            value={a.managerNotes ?? ""}
            disabled={!editable}
            onChange={(e) => setA({ ...a, managerNotes: e.target.value })}
            onBlur={() => onSave({ managerNotes: a.managerNotes?.trim() || null })}
          />
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 5: Write the builder shell**

Create `src/components/hiring/builder/builder.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { AlignLeft, CircleDot, ListChecks, Mic, Paperclip, Type, Video } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UndoStrip } from "@/components/ui/undo-strip";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { clockTime } from "@/lib/format";
import { pickText } from "@/lib/i18n-text";
import { ACTIVITY_TYPES, totalSeconds, type ActivityType, type ContentStage } from "@/solutions/hiring/rules/content";
import type { ActivityPayload, StagePayload } from "@/solutions/hiring/rules/patches";
import { publishOpeningAction } from "@/app/(manager)/hiring/openings/[id]/actions";
import {
  addActivityAction,
  addStageAction,
  deleteActivityAction,
  deleteStageAction,
  moveActivityAction,
  moveStageAction,
  restoreActivityFormAction,
  restoreStageFormAction,
  saveActivityAction,
  saveStageAction,
  setCompetenciesAction,
  startDraftAction,
} from "@/app/(manager)/hiring/openings/[id]/assessment/edit/actions";
import { ActivityEditor } from "./activity-editor";
import { StageEditor } from "./stage-editor";
import { useSaver } from "./use-saver";

export const TYPE_ICON: Record<ActivityType, typeof Video> = {
  VIDEO: Video,
  AUDIO: Mic,
  LONG_TEXT: AlignLeft,
  SHORT_TEXT: Type,
  SINGLE_CHOICE: CircleDot,
  MULTI_CHOICE: ListChecks,
  FILE_UPLOAD: Paperclip,
};

type Selection = { kind: "stage" | "activity"; id: string } | null;
type Undo =
  | { kind: "stage"; payload: StagePayload; index: number }
  | { kind: "activity"; payload: ActivityPayload; stageId: string; index: number }
  | null;

/**
 * HIRING-UX 5.5 (canvas Y2): structure on the left, what the candidate sees in
 * the middle, the team-only vault on the right, and a sticky bar with the save
 * line, the question check, preview and the one filled "Yayınla".
 */
export function Builder({
  openingId,
  mode,
  versionNumber,
  liveNumber,
  stages,
  competencies,
  problems,
  initial,
  locale,
  canEdit,
  checkSlot,
}: {
  openingId: string;
  mode: "draft" | "live";
  versionNumber: number;
  liveNumber: number | null;
  stages: ContentStage[];
  competencies: Array<{ id: string; name: string; archived: boolean }>;
  problems: Array<{ text: string; href: string }>;
  initial: { stageId: string | null; activityId: string | null };
  locale: Locale;
  canEdit: boolean;
  checkSlot?: React.ReactNode;
}) {
  const t = useMT("hiringBuilder");
  const saver = useSaver();
  const editable = canEdit && mode === "draft";
  const firstActivity = stages[0]?.activities[0];
  const [selection, setSelection] = useState<Selection>(
    initial.activityId
      ? { kind: "activity", id: initial.activityId }
      : initial.stageId
        ? { kind: "stage", id: initial.stageId }
        : firstActivity
          ? { kind: "activity", id: firstActivity.id }
          : stages[0]
            ? { kind: "stage", id: stages[0].id }
            : null,
  );
  const [undo, setUndo] = useState<Undo>(null);
  const minutes = Math.round(totalSeconds({ stages }) / 60);
  const selectedStage = selection?.kind === "stage" ? stages.find((s) => s.id === selection.id) ?? null : null;
  const selectedActivity = selection?.kind === "activity" ? stages.flatMap((s) => s.activities).find((a) => a.id === selection.id) ?? null : null;

  async function addStage() {
    const res = await saver.run(() => addStageAction(openingId));
    if (res.ok) setSelection({ kind: "stage", id: res.value });
  }
  async function addActivity(stageId: string, type: ActivityType) {
    const res = await saver.run(() => addActivityAction(openingId, stageId, type));
    if (res.ok) setSelection({ kind: "activity", id: res.value });
  }
  async function removeStage(stageId: string) {
    const res = await saver.run(() => deleteStageAction(openingId, stageId));
    if (res.ok) {
      setUndo({ kind: "stage", ...res.value });
      setSelection(null);
    }
  }
  async function removeActivity(activityId: string) {
    const res = await saver.run(() => deleteActivityAction(openingId, activityId));
    if (res.ok) {
      setUndo({ kind: "activity", ...res.value });
      setSelection(null);
    }
  }

  const saveLine =
    saver.state.kind === "saving"
      ? t("saving")
      : saver.state.kind === "saved"
        ? t("savedAt", { time: clockTime(new Date(saver.state.at)).slice(0, 5) })
        : saver.state.kind === "refused"
          ? t("saveRefused")
          : saver.state.kind === "error"
            ? saver.state.retrying
              ? t("saveRetrying")
              : t("saveFailed")
            : "";
  const publishReason = !canEdit ? t("readOnly") : problems[0]?.text ?? null;

  return (
    <>
      {stages.length === 0 && editable ? (
        <Card className="mt-section p-card text-center">
          <p className="text-[16px] font-semibold text-ink">{t("emptyTitle")}</p>
          <p className="mt-1 text-[14px] text-muted">{t("emptyBody")}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button asChild variant="secondary">
              <Link href={`/hiring/openings/${openingId}/assessment/ai`}>{t("emptyAi")}</Link>
            </Button>
            <Button variant="secondary" onClick={addStage}>
              {t("addStage")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mt-section grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)]">
          <nav aria-label={t("treeLabel")} className="space-y-4">
            {stages.map((stage, si) => (
              <div key={stage.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelection({ kind: "stage", id: stage.id })}
                  aria-current={selection?.id === stage.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[14px] font-semibold text-ink hover:bg-subtle",
                    selection?.id === stage.id && "bg-brand-soft",
                  )}
                >
                  <span className="truncate">{pickText(stage.name, locale) || t("untitledStage", { n: si + 1 })}</span>
                  <span className="tnum shrink-0 text-[12px] font-normal text-muted">{t("stageMinutesShort", { minutes: Math.round(stage.durationSeconds / 60) })}</span>
                </button>
                <ul className="space-y-1 pl-2">
                  {stage.activities.map((activity) => {
                    const Icon = TYPE_ICON[activity.type];
                    return (
                      <li key={activity.id}>
                        <button
                          type="button"
                          onClick={() => setSelection({ kind: "activity", id: activity.id })}
                          aria-current={selection?.id === activity.id ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-subtle",
                            selection?.id === activity.id && "bg-brand-soft text-ink",
                          )}
                        >
                          <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                          <span className="truncate">{pickText(activity.prompt, locale) || t("untitledActivity")}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {editable ? (
                  <div className="pl-2">
                    <Select value="" onValueChange={(type) => void addActivity(stage.id, type as ActivityType)}>
                      <SelectTrigger size="sm" aria-label={t("addActivity")} className="w-full">
                        <SelectValue placeholder={t("addActivity")} />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`type${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ))}
            {editable ? (
              <Button variant="ghost" size="sm" onClick={addStage}>
                {t("addStage")}
              </Button>
            ) : null}
            <p className="tnum text-[13px] text-muted">{t("total", { stages: stages.length, minutes })}</p>
            {minutes > 30 ? <p className="text-[13px] text-muted">{t("respectTime")}</p> : null}
          </nav>

          {selectedActivity ? (
            <ActivityEditor
              key={`${selectedActivity.id}:${selectedActivity.type}`}
              activity={selectedActivity}
              competencies={competencies}
              editable={editable}
              onSave={(patch) => void saver.run(() => saveActivityAction(openingId, selectedActivity.id, patch))}
              onSetCompetencies={(ids) => void saver.run(() => setCompetenciesAction(openingId, selectedActivity.id, ids))}
              onMove={(direction) => void saver.run(() => moveActivityAction(openingId, selectedActivity.id, direction))}
              onDelete={() => void removeActivity(selectedActivity.id)}
            />
          ) : selectedStage ? (
            <StageEditor
              key={selectedStage.id}
              stage={selectedStage}
              editable={editable}
              onSave={(patch) => void saver.run(() => saveStageAction(openingId, selectedStage.id, patch))}
              onMove={(direction) => void saver.run(() => moveStageAction(openingId, selectedStage.id, direction))}
              onDelete={() => void removeStage(selectedStage.id)}
            />
          ) : (
            <p className="text-[14px] text-muted lg:col-span-2">{t("selectHint")}</p>
          )}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-panel-soft lg:left-[240px]">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-page py-3">
          <span role="status" className="tnum min-w-[160px] text-[13px] text-muted">
            {saveLine}
            {saver.state.kind === "error" ? (
              <Button variant="ghost" size="sm" className="ml-2" onClick={saver.state.retry}>
                {t("retry")}
              </Button>
            ) : null}
          </span>
          {checkSlot}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Button asChild variant="secondary">
              <Link href={`/hiring/openings/${openingId}/assessment/preview`}>{t("preview")}</Link>
            </Button>
            {mode === "draft" ? (
              <form action={publishOpeningAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="openingId" value={openingId} />
                <input type="hidden" name="back" value="builder" />
                {publishReason ? (
                  <DisabledReason>
                    {publishReason}
                    {problems.length > 1 ? ` ${t("moreProblems", { count: problems.length - 1 })}` : ""}
                  </DisabledReason>
                ) : null}
                <Button type="submit" variant="primary" disabled={publishReason !== null} disabledReason={publishReason ?? undefined}>
                  {t("publish")}
                </Button>
              </form>
            ) : (
              <form action={startDraftAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="openingId" value={openingId} />
                <p className="max-w-[420px] text-[13px] text-muted">{t("liveNote", { live: liveNumber ?? versionNumber, next: versionNumber + 1 })}</p>
                <Button type="submit" variant="primary" disabled={!canEdit} disabledReason={canEdit ? undefined : t("readOnly")}>
                  {t("startEditing")}
                </Button>
                {!canEdit ? <DisabledReason>{t("readOnly")}</DisabledReason> : null}
              </form>
            )}
          </div>
        </div>
      </div>

      {undo ? (
        <UndoStrip
          key={JSON.stringify(undo).length + (undo.kind === "stage" ? "s" : "a") + undo.index}
          message={undo.kind === "stage" ? t("stageDeleted") : t("activityDeleted")}
          action={undo.kind === "stage" ? restoreStageFormAction : restoreActivityFormAction}
          onSubmitted={() => setUndo(null)}
          hiddenFields={{
            openingId,
            payload: JSON.stringify(undo.payload),
            index: String(undo.index),
            ...(undo.kind === "activity" ? { stageId: undo.stageId } : {}),
          }}
        />
      ) : null}
    </>
  );
}
```

(The bar starts after the 240px sidebar at `lg:` like the exam editor bar; the page adds `pb-32` so the bar never covers the last field. The undo strip sits above the bar; both are the only shadowed elements: a sticky panel and the strip, RULES 6.)

- [ ] **Step 6: Write the pages**

Create `src/app/(manager)/hiring/openings/[id]/assessment/page.tsx`:

```tsx
import { redirect } from "next/navigation";

/** HIRING-UX 4.3 lists /assessment; the builder is its first sub-page. */
export default async function AssessmentIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/hiring/openings/${id}/assessment/edit`);
}
```

Create `src/app/(manager)/hiring/openings/[id]/assessment/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Builder } from "@/components/hiring/builder/builder";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { pickText } from "@/lib/i18n-text";
import { activeCompetencyOptions } from "@/server/library";
import { isUuid } from "@/server/settings";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../../access";
import { AssessmentTabs, OpeningHeader } from "../../opening-header";
import { describeProblem } from "../../problems";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const [state, options] = await Promise.all([workingState(user.orgId, opening.id), activeCompetencyOptions(user.orgId)]);
  if (!state.content) notFound();
  const archived = [...state.facts.values()].filter((f) => f.archived);
  const competencies = [
    ...options.map((o) => ({ id: o.id, name: pickText(o.name, locale), archived: false })),
    ...archived.map((f) => ({ id: f.id, name: pickText(f.name, locale), archived: true })),
  ];
  const problems = state.problems.map((p) => describeProblem(p, { content: state.content!, facts: state.facts, locale, openingId: opening.id }, t));

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8 pb-32">
      <OpeningHeader opening={opening} active="assessment" locale={locale} t={t} />
      <div className="mt-4">
        <AssessmentTabs openingId={opening.id} active="edit" t={t} />
      </div>
      {sp.published ? <p role="status" className="mt-4 text-[14px] text-ink">{t("hiringBuilder.published", { number: sp.published })}</p> : null}
      {sp.publish === "refused" ? <p role="status" className="mt-4 text-[14px] text-ink">{t("hiringBuilder.publishRefused")}</p> : null}
      <Builder
        openingId={opening.id}
        mode={state.draft ? "draft" : "live"}
        versionNumber={state.content.number}
        liveNumber={state.live?.number ?? null}
        stages={state.content.stages}
        competencies={competencies}
        problems={problems}
        initial={{
          stageId: sp.stage && isUuid(sp.stage) ? sp.stage : null,
          activityId: sp.activity && isUuid(sp.activity) ? sp.activity : null,
        }}
        locale={locale}
        canEdit={access.edit}
      />
    </main>
  );
}
```

- [ ] **Step 7: Gates, build, browser check**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS. In Chrome (dev server on `kademe_platform`), on the blank opening from Task 13:
1. Empty builder shows two outline starts; "Aşama ekle" adds "Aşama 1"; type the name TR, tab out: the bar says "Kaydedildi hh:mm".
2. "Soru ekle" → Video: middle shows TR/EN tabs, type, Zorunlu, think 60, answer 120, "1 tekrar", flexible on; right (dark) shows Amaç, competencies, 1/3/5 examples. Pick İletişim and Problem Çözme: the other chips are disabled and the limit sentence appears.
3. Add a "Tek seçimli" question: the right column says choice questions measure no competency; mark one option correct; the other cannot also be correct (single choice).
4. "Yayınla" is disabled with the first gate sentence and "ve N eksik daha"; fixing everything enables it; publish: "v1 yayınlandı." and the builder is read-only with "Düzenlemeye başla" and the live note; pressing it opens v2 with the same content.
5. Delete a question in v2: the undo strip appears; "Geri al" puts it back at the same place.
6. Type 5 in "Cevap süresi": the bar says "Bu değer kabul edilmedi; aralığı kontrol et."
Stop the server; close your tabs.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/undo-strip.tsx "src/app/(manager)/hiring/openings/[id]/assessment" src/components/hiring/builder src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Add the hiring assessment builder" -m "HIRING-UX 5.5: stages and questions on the left with up and down moves, the candidate's side in the middle (TR/EN text, type settings, choices with a hidden right answer, file types, written alternative) and the team-only vault on the right (purpose, at most two competencies, 1/3/5 answer examples, behaviours, red flags, reviewer note). Fields save on blur with one automatic retry; deletes have an 8 second undo; Yayınla states the first gate problem until the draft passes. A published version is read-only with Düzenlemeye başla, which opens the next version." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 16: Scorecard and weights (`/assessment/scorecard`)

**Files:**
- Modify: `src/server/library-write.ts` (`saveAnchors`)
- Modify: `src/solutions/hiring/server/content.ts` (`loadScorecard`), `src/solutions/hiring/server/weight-sets.ts` (`liveWeights`)
- Create: `src/app/(manager)/hiring/openings/[id]/assessment/scorecard/actions.ts`, `scorecard/page.tsx`
- Create: `src/components/hiring/scorecard/scorecard-view.tsx`, `src/components/hiring/scorecard/anchor-sheet.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (namespace `hiringScorecard`)

**Interfaces:**
- Consumes: Task 10 (`usedCompetencyIds`, `defaultWeights`, `weightsTotal`, `weightsProblem`), Task 11 (`saveDraftWeights`, `latestWeights`), Task 12 (`addWeightSet`).
- Produces: `saveAnchors(orgId, actorId, competencyId, input: AnchorInput): Promise<{ ok: true } | { ok: false; code: "ANCHORS_REQUIRED" | "NOT_FOUND" }>`; `loadScorecard(versionId): Promise<ScorecardSnapshot | null>`; `liveWeights(versionId)`.
- Produces actions: `saveDraftWeightsAction(openingId, { enabled, weights })`, `addWeightSetAction(openingId, { enabled, weights, reason })`, `saveAnchorsAction(openingId, competencyId, anchors)`.

- [ ] **Step 1: Add the server pieces**

Append to `src/server/library-write.ts`:

```ts
/** The scorecard's "Düzenle" (HIRING-UX 5.7): anchors only, still a library write. */
export async function saveAnchors(
  orgId: string,
  actorId: string,
  competencyId: string,
  input: AnchorInput,
): Promise<{ ok: true } | { ok: false; code: "ANCHORS_REQUIRED" | "NOT_FOUND" }> {
  const anchors = anchorRecord(input);
  if (missingAnchorLevels(anchors).length) return { ok: false, code: "ANCHORS_REQUIRED" };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: competencies.id })
      .from(competencies)
      .where(and(eq(competencies.id, competencyId), eq(competencies.orgId, orgId)))
      .for("update");
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };
    await replaceAnchors(tx, competencyId, anchors);
    await tx.update(competencies).set({ updatedAt: new Date() }).where(eq(competencies.id, competencyId));
    await audit(tx, orgId, actorId, "library.competency.anchors", "competency", competencyId);
    return { ok: true as const };
  });
}
```

Append to `src/solutions/hiring/server/content.ts`:

```ts
/** The scorecard a published version copied at publish; null on a draft. */
export async function loadScorecard(versionId: string, x: Executor = db): Promise<ScorecardSnapshot | null> {
  const [row] = await x.select({ scorecard: hiringVersions.scorecard }).from(hiringVersions).where(eq(hiringVersions.id, versionId)).limit(1);
  return row?.scorecard ?? null;
}
```

Append to `src/solutions/hiring/server/weight-sets.ts` (import `latestWeights` from `./versions`):

```ts
/** The weights a published version is scored with now: its newest set. */
export async function liveWeights(versionId: string) {
  return latestWeights(db, versionId);
}
```

- [ ] **Step 2: Write the actions**

Create `src/app/(manager)/hiring/openings/[id]/assessment/scorecard/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/authorize";
import { saveAnchors } from "@/server/library-write";
import { HiringConflict } from "@/solutions/hiring/server/errors";
import { saveDraftWeights } from "@/solutions/hiring/server/versions";
import { addWeightSet } from "@/solutions/hiring/server/weight-sets";
import { openingFor } from "../../access";

const weightsSchema = z.object({ enabled: z.boolean(), weights: z.record(z.string(), z.number().int().min(0).max(100)) });
const i18n = z.object({ tr: z.string().max(2000), en: z.string().max(2000) });

export async function saveDraftWeightsAction(openingId: string, input: { enabled: boolean; weights: Record<string, number> }) {
  const { user } = await openingFor(openingId, "edit");
  const parsed = weightsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "INVALID" as const };
  try {
    const result = await saveDraftWeights(user.orgId, openingId, parsed.data);
    if (!result.ok) return { ok: false as const, code: "NOT_100" as const, total: result.total };
    revalidatePath("/hiring/openings/[id]", "layout");
    return { ok: true as const };
  } catch (error) {
    if (error instanceof HiringConflict) return { ok: false as const, code: error.code };
    throw error;
  }
}

export async function addWeightSetAction(openingId: string, input: { enabled: boolean; weights: Record<string, number>; reason: string }) {
  const { user } = await openingFor(openingId, "edit");
  const parsed = weightsSchema.extend({ reason: z.string().max(1000) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "INVALID" as const };
  const result = await addWeightSet(user.orgId, openingId, parsed.data, user.id);
  if (result.ok) revalidatePath("/hiring/openings/[id]", "layout");
  return result;
}

export async function saveAnchorsAction(openingId: string, competencyId: string, anchors: Partial<Record<"1" | "2" | "3" | "4" | "5", { tr: string; en: string }>>) {
  const { user } = await openingFor(openingId, "edit");
  authorize(user, "library:write");
  const parsed = z.partialRecord(z.enum(["1", "2", "3", "4", "5"]), i18n).safeParse(anchors);
  if (!parsed.success || !z.uuid().safeParse(competencyId).success) return { ok: false as const, code: "INVALID" as const };
  const result = await saveAnchors(user.orgId, user.id, competencyId, parsed.data);
  if (result.ok) {
    revalidatePath("/hiring/openings/[id]", "layout");
    revalidatePath(`/library/competencies/${competencyId}`);
  }
  return result;
}
```

- [ ] **Step 3: Add the copy**

Add to `hiring.tr.json`:

```json
  "hiringScorecard": {
    "matrixTitle": "Neyi, hangi soruyla ölçüyoruz?",
    "colCompetency": "Yetkinlik",
    "colCount": "Ölçüm",
    "measured": "Ölçülüyor",
    "singleQuestion": "Tek soruyla ölçülüyor",
    "anchorsOk": "Çapalar tamam",
    "anchorsMissing": "Seviye {level} tanımı eksik",
    "editAnchors": "Düzenle",
    "knowledgeLine": "Bilgi testi: {count} seçmeli soru. Ayrı gösterilir, genel puana karışmaz.",
    "emptyTitle": "Henüz hiçbir soru bir yetkinlik ölçmüyor.",
    "emptyBody": "Kurucuda her soruya ölçtüğü yetkinliği ekle.",
    "goBuilder": "Kurucuya git",
    "weightsTitle": "Ağırlıklar",
    "weightsEqual": "Ağırlıklar eşit",
    "weightsEqualHint": "Açıkken genel puan, yetkinlik puanlarının düz ortalamasıdır.",
    "weightsDefaultHint": "Varsayılan değerler pozisyon profilinden gelir.",
    "weightFor": "{competency} ağırlığı (%)",
    "total": "Toplam %{total}",
    "missing": "Toplam %{total}, %{gap} eksik.",
    "over": "Toplam %{total}, %{gap} fazla.",
    "ruleTitle": "Karar kuralı",
    "ruleBody": "Genel puan = yetkinlik puanlarının (ağırlıklı) ortalaması. Her yetkinlik puanı = değerlendiricilerin ortalaması. Bilgi testi ayrı gösterilir.",
    "save": "Puan kartını kaydet",
    "saving": "Kaydediliyor",
    "saved": "Kaydedildi.",
    "saveFailed": "Kaydedilemedi. Tekrar dene.",
    "reason": "Değişikliğin gerekçesi",
    "reasonRequired": "Değişikliğin gerekçesini yaz.",
    "liveWeightsNote": "Mevcut puanlar eski ağırlıklarla kalır. Yeniden hesaplamak ayrı bir adımdır.",
    "liveMode": "Yayındaki v{number} puan kartı. Çapalar ve yetkinlikler yayında değişmez; ağırlık değişikliği yeni bir ağırlık seti olarak kaydedilir.",
    "activeSet": "Etkin ağırlık seti: {label}",
    "noEdit": "Rolün puan kartını değiştiremez.",
    "noCompetencies": "Önce sorulara yetkinlik ekle.",
    "sheetTitle": "{competency}: çapalar",
    "sheetDescription": "Çapalar kütüphanede yaşar. Değişiklik yeni sürümlere uygulanır; yayındaki değerlendirmeler eski tanımı kullanır.",
    "sheetSave": "Çapaları kaydet",
    "sheetRequired": "Seviye {level} tanımını yaz.",
    "sheetNoPermission": "Rolün kütüphaneyi değiştiremez."
  }
```

and to `hiring.en.json`:

```json
  "hiringScorecard": {
    "matrixTitle": "What do we measure, with which question?",
    "colCompetency": "Competency",
    "colCount": "Measured",
    "measured": "Measured",
    "singleQuestion": "Measured by one question only",
    "anchorsOk": "Anchors complete",
    "anchorsMissing": "Level {level} definition missing",
    "editAnchors": "Edit",
    "knowledgeLine": "Knowledge test: {count, plural, one {# choice question} other {# choice questions}}. Shown separately, never mixed into the overall score.",
    "emptyTitle": "No question measures a competency yet.",
    "emptyBody": "In the builder, add the competency each question measures.",
    "goBuilder": "Open the builder",
    "weightsTitle": "Weights",
    "weightsEqual": "Equal weights",
    "weightsEqualHint": "When on, the overall score is the plain average of the competency scores.",
    "weightsDefaultHint": "Defaults come from the position profile.",
    "weightFor": "Weight of {competency} (%)",
    "total": "Total {total}%",
    "missing": "Total {total}%, {gap}% missing.",
    "over": "Total {total}%, {gap}% too much.",
    "ruleTitle": "Decision rule",
    "ruleBody": "Overall score = the (weighted) average of the competency scores. Each competency score = the reviewers' average. The knowledge test is shown separately.",
    "save": "Save the scorecard",
    "saving": "Saving",
    "saved": "Saved.",
    "saveFailed": "Could not save. Try again.",
    "reason": "Reason for the change",
    "reasonRequired": "Write the reason for the change.",
    "liveWeightsNote": "Existing scores keep the old weights. Recalculating is a separate step.",
    "liveMode": "The live v{number} scorecard. Anchors and competencies do not change once live; a weight change is saved as a new weight set.",
    "activeSet": "Active weight set: {label}",
    "noEdit": "Your role cannot change the scorecard.",
    "noCompetencies": "Add competencies to the questions first.",
    "sheetTitle": "{competency}: anchors",
    "sheetDescription": "Anchors live in the library. A change applies to new versions; live assessments keep the previous definition.",
    "sheetSave": "Save the anchors",
    "sheetRequired": "Write the level {level} definition.",
    "sheetNoPermission": "Your role cannot change the library."
  }
```

- [ ] **Step 4: Write the anchor sheet and the scorecard view**

Create `src/components/hiring/scorecard/anchor-sheet.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, DisabledReason } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { I18nPair } from "@/components/manager/i18n-pair";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { hasText, REQUIRED_ANCHOR_LEVELS } from "@/lib/library/anchors";
import { saveAnchorsAction } from "@/app/(manager)/hiring/openings/[id]/assessment/scorecard/actions";

/** HIRING-UX 5.7: anchors are edited in a Sheet, without leaving the scorecard. */
export function AnchorSheet({
  openingId,
  competency,
  levels,
  canEdit,
  onClose,
}: {
  openingId: string;
  competency: { id: string; name: string; anchors: Record<number, I18nText> };
  levels: Array<{ value: number; label: string }>;
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useMT("hiringScorecard");
  const router = useRouter();
  const [anchors, setAnchors] = useState(competency.anchors);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const missing = REQUIRED_ANCHOR_LEVELS.filter((l) => !hasText(anchors[l]));
  const reason = !canEdit ? t("sheetNoPermission") : missing.length ? t("sheetRequired", { level: missing[0] }) : null;
  return (
    <Sheet open onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>{t("sheetTitle", { competency: competency.name })}</SheetTitle>
          <SheetDescription>{t("sheetDescription")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-field px-4">
          {levels.map((level) => (
            <I18nPair
              key={level.value}
              multiline
              disabled={!canEdit}
              label={`${level.value} · ${level.label}`}
              value={anchors[level.value] ?? { tr: "", en: "" }}
              onChange={(next) => setAnchors({ ...anchors, [level.value]: next })}
            />
          ))}
          <div className="flex flex-wrap items-center gap-3 pb-6">
            <Button
              variant="primary"
              disabled={pending || reason !== null}
              disabledReason={reason ?? undefined}
              onClick={() =>
                start(async () => {
                  const result = await saveAnchorsAction(
                    openingId,
                    competency.id,
                    Object.fromEntries(Object.entries(anchors).map(([k, v]) => [k, v])) as Partial<Record<"1" | "2" | "3" | "4" | "5", I18nText>>,
                  );
                  if (result.ok) {
                    router.refresh();
                    onClose();
                  } else setFailed(true);
                })
              }
            >
              {t("sheetSave")}
            </Button>
            {reason ? <DisabledReason>{reason}</DisabledReason> : null}
            {failed ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

Create `src/components/hiring/scorecard/scorecard-view.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusDot } from "@/components/ui/status-dot";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { weightsTotal } from "@/solutions/hiring/rules/weights";
import { addWeightSetAction, saveDraftWeightsAction } from "@/app/(manager)/hiring/openings/[id]/assessment/scorecard/actions";
import { AnchorSheet } from "./anchor-sheet";

export type ScorecardRow = { id: string; name: string; missingLevels: number[]; measuredBy: string[]; anchors: Record<number, I18nText> };

/** HIRING-UX 5.7: matrix, anchor status, weights (collapsed, equal by default), decision rule. */
export function ScorecardView({
  openingId,
  mode,
  liveNumber,
  activeSetLabel,
  rows,
  columns,
  choiceCount,
  initialEnabled,
  initialWeights,
  levels,
  canEdit,
  canEditAnchors,
}: {
  openingId: string;
  mode: "draft" | "live";
  liveNumber: number | null;
  activeSetLabel: string | null;
  rows: ScorecardRow[];
  columns: Array<{ id: string; label: string; title: string }>;
  choiceCount: number;
  initialEnabled: boolean;
  initialWeights: Record<string, number>;
  levels: Array<{ value: number; label: string }>;
  canEdit: boolean;
  canEditAnchors: boolean;
}) {
  const t = useMT("hiringScorecard");
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [weights, setWeights] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.id, String(initialWeights[r.id] ?? 0)])));
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState<ScorecardRow | null>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"saved" | "error" | null>(null);

  const numeric = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, /^\d+$/.test(v) ? Number(v) : NaN]));
  const total = weightsTotal(Object.fromEntries(Object.entries(numeric).map(([k, v]) => [k, Number.isNaN(v) ? 0 : v])), rows.map((r) => r.id));
  const gap = Math.abs(100 - total);
  const saveReason = !canEdit
    ? t("noEdit")
    : rows.length === 0
      ? t("noCompetencies")
      : enabled && total !== 100
        ? total < 100
          ? t("missing", { total, gap })
          : t("over", { total, gap })
        : mode === "live" && reason.trim().length < 3
          ? t("reasonRequired")
          : null;

  function save() {
    setResult(null);
    const payload = { enabled, weights: Object.fromEntries(Object.entries(numeric).map(([k, v]) => [k, Number.isNaN(v) ? 0 : v])) };
    start(async () => {
      const res = mode === "draft" ? await saveDraftWeightsAction(openingId, payload) : await addWeightSetAction(openingId, { ...payload, reason });
      setResult(res.ok ? "saved" : "error");
      if (res.ok) {
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-section space-y-section">
      {mode === "live" ? (
        <p className="text-[13px] text-muted">
          {t("liveMode", { number: liveNumber ?? 0 })}
          {activeSetLabel ? ` ${t("activeSet", { label: activeSetLabel })}` : ""}
        </p>
      ) : null}

      <Card className="p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("matrixTitle")}</h2>
        {rows.length === 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-[14px] text-ink">{t("emptyTitle")}</p>
            <p className="text-[13px] text-muted">{t("emptyBody")}</p>
            <Link href={`/hiring/openings/${openingId}/assessment/edit`} className="text-[13px] font-medium text-ink underline decoration-underline underline-offset-2">
              {t("goBuilder")}
            </Link>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colCompetency")}</TableHead>
                  {columns.map((c) => (
                    <TableHead key={c.id} className="tnum text-center">
                      <abbr title={c.title} className="no-underline">
                        {c.label}
                      </abbr>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">{t("colCount")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="font-medium text-ink">{row.name}</span>
                      {row.measuredBy.length === 1 ? <p className="text-[12px] text-muted">{t("singleQuestion")}</p> : null}
                    </TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.id} className="text-center">
                        {row.measuredBy.includes(c.id) ? (
                          <span className="inline-block size-2 rounded-full bg-ink" role="img" aria-label={t("measured")} />
                        ) : null}
                      </TableCell>
                    ))}
                    <TableCell className="tnum text-right">{row.measuredBy.length}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.missingLevels.length ? (
                        <StatusDot tone="warn" className="font-semibold text-ink">
                          {t("anchorsMissing", { level: row.missingLevels[0] })}
                        </StatusDot>
                      ) : (
                        <StatusDot tone="done">{t("anchorsOk")}</StatusDot>
                      )}
                      {mode === "draft" ? (
                        <Button variant="ghost" size="sm" className="ml-2" onClick={() => setEditing(row)}>
                          {t("editAnchors")}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {choiceCount > 0 ? <p className="mt-3 text-[13px] text-muted">{t("knowledgeLine", { count: choiceCount })}</p> : null}
      </Card>

      <Collapsible defaultOpen={initialEnabled} className="rounded-xl border border-line bg-surface p-card">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            {t("weightsTitle")}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-field">
          <div className="space-y-1">
            <label className="flex items-center gap-3 text-[14px] text-ink">
              <Switch checked={!enabled} disabled={!canEdit} onCheckedChange={(equal) => setEnabled(!equal)} />
              {t("weightsEqual")}
            </label>
            <p className="pl-12 text-[13px] text-muted">{enabled ? t("weightsDefaultHint") : t("weightsEqualHint")}</p>
          </div>
          {enabled
            ? rows.map((row) => {
                const value = Number.isNaN(numeric[row.id]) ? 0 : numeric[row.id];
                return (
                  <div key={row.id} className="grid items-center gap-3 md:grid-cols-[minmax(0,240px)_100px_minmax(0,1fr)]">
                    <Label htmlFor={`w-${row.id}`} className="text-[14px] text-ink">
                      {row.name}
                    </Label>
                    <Input
                      id={`w-${row.id}`}
                      aria-label={t("weightFor", { competency: row.name })}
                      inputMode="numeric"
                      className="tnum"
                      value={weights[row.id]}
                      disabled={!canEdit}
                      onChange={(e) => setWeights({ ...weights, [row.id]: e.target.value })}
                    />
                    <div className="h-1.5 rounded-full bg-hairline" aria-hidden>
                      <div className="h-1.5 rounded-full bg-ink-3" style={{ width: `${Math.min(100, value)}%` }} />
                    </div>
                  </div>
                );
              })
            : null}
          {enabled ? <p className="tnum text-[14px] font-medium text-ink">{t("total", { total })}</p> : null}
          {mode === "live" ? (
            <div className="space-y-2">
              <Label htmlFor="weights-reason">{t("reason")}</Label>
              <Textarea id="weights-reason" value={reason} disabled={!canEdit} onChange={(e) => setReason(e.target.value)} />
              <p className="text-[13px] text-muted">{t("liveWeightsNote")}</p>
            </div>
          ) : null}
        </CollapsibleContent>
      </Collapsible>

      <Card className="p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("ruleTitle")}</h2>
        <p className="mt-2 text-[14px] text-ink-2">{t("ruleBody")}</p>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary" onClick={save} disabled={pending || saveReason !== null} disabledReason={saveReason ?? undefined}>
          {pending ? t("saving") : t("save")}
        </Button>
        {saveReason ? <DisabledReason>{saveReason}</DisabledReason> : null}
        {result === "saved" ? <span role="status" className="text-[13px] text-muted">{t("saved")}</span> : null}
        {result === "error" ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
      </div>

      {editing ? <AnchorSheet openingId={openingId} competency={editing} levels={levels} canEdit={canEditAnchors} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
```

- [ ] **Step 5: Write the page**

Create `src/app/(manager)/hiring/openings/[id]/assessment/scorecard/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { ScorecardView, type ScorecardRow } from "@/components/hiring/scorecard/scorecard-view";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { pickText } from "@/lib/i18n-text";
import { missingAnchorLevels } from "@/lib/library/anchors";
import { loadDefaultScale } from "@/server/library";
import { isChoice, usedCompetencyIds } from "@/solutions/hiring/rules/content";
import { defaultWeights } from "@/solutions/hiring/rules/weights";
import { loadScorecard, positionProfile } from "@/solutions/hiring/server/content";
import { liveWeights } from "@/solutions/hiring/server/weight-sets";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../../access";
import { AssessmentTabs, OpeningHeader } from "../../opening-header";

export const dynamic = "force-dynamic";

export default async function ScorecardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const [state, scale] = await Promise.all([workingState(user.orgId, opening.id), loadDefaultScale(user.orgId)]);
  if (!state.content) notFound();
  const content = state.content;
  const all = content.stages.flatMap((s, si) => s.activities.map((a, ai) => ({ a, label: `${si + 1}.${ai + 1}`, title: pickText(a.prompt, locale) })));
  const measuring = all.filter((x) => !isChoice(x.a.type));
  const columns = measuring.map((x) => ({ id: x.a.id, label: x.label, title: x.title }));
  const measuredBy = (cid: string) => measuring.filter((x) => x.a.competencyIds.includes(cid)).map((x) => x.a.id);

  let rows: ScorecardRow[];
  let enabled: boolean;
  let weights: Record<string, number>;
  let activeSetLabel: string | null = null;
  if (state.draft) {
    const used = usedCompetencyIds(content);
    const profile = await positionProfile(opening.positionId);
    rows = used.map((cid) => {
      const f = state.facts.get(cid);
      return {
        id: cid,
        name: pickText(f?.name, locale),
        missingLevels: f ? missingAnchorLevels(f.anchors) : [1, 3, 5],
        measuredBy: measuredBy(cid),
        anchors: Object.fromEntries([1, 2, 3, 4, 5].map((l) => [l, f?.anchors[l] ?? { tr: "", en: "" }])),
      };
    });
    enabled = content.weightsEnabled;
    weights = content.draftWeights ?? defaultWeights(used, profile);
  } else {
    const [card, latest] = await Promise.all([loadScorecard(state.live!.id), liveWeights(state.live!.id)]);
    if (!card) notFound();
    rows = card.competencies.map((c) => ({ id: c.id, name: pickText(c.name, locale), missingLevels: [], measuredBy: measuredBy(c.id), anchors: c.anchors }));
    enabled = latest?.enabled ?? card.weightsEnabled;
    weights = latest?.weights ?? Object.fromEntries(card.competencies.map((c) => [c.id, c.weight]));
    activeSetLabel = latest?.label ?? null;
  }

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="assessment" locale={locale} t={t} />
      <div className="mt-4">
        <AssessmentTabs openingId={opening.id} active="scorecard" t={t} />
      </div>
      <ScorecardView
        openingId={opening.id}
        mode={state.draft ? "draft" : "live"}
        liveNumber={state.live?.number ?? null}
        activeSetLabel={activeSetLabel}
        rows={rows}
        columns={columns}
        choiceCount={all.length - measuring.length}
        initialEnabled={enabled}
        initialWeights={weights}
        levels={(scale?.levels ?? []).map((l) => ({ value: l.value, label: pickText(l.label, locale) }))}
        canEdit={access.edit}
        canEditAnchors={access.edit && can(user, "library:write")}
      />
    </main>
  );
}
```

- [ ] **Step 6: Gates, build, browser check, commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
In Chrome on the v2 draft from Task 15: the matrix has one row per measured competency, dots in the right columns, "Tek soruyla ölçülüyor" under single-question rows; a competency with a missing level 3 shows "Seviye 3 tanımı eksik" and "Düzenle" opens the Sheet; saving it clears the row (and the overview readiness row). Open "Ağırlıklar", switch "Ağırlıklar eşit" off: inputs prefilled from the position profile (75/25 for 60/20), total "Toplam %100"; change to 70/25: the filled button is disabled with "Toplam %95, %5 eksik."; set 70/30 and save. Publish v2 from the builder, return here: the page says it shows the live v2 card, a reason is required, and saving adds a set without changing the published card. Stop the server; close your tabs.

```bash
git add src/server/library-write.ts src/solutions/hiring/server/content.ts src/solutions/hiring/server/weight-sets.ts "src/app/(manager)/hiring/openings/[id]/assessment/scorecard" src/components/hiring/scorecard src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Add the scorecard and weights screen" -m "HIRING-UX 5.7: a matrix of competencies by question with single-question notes, anchor status with a Sheet that edits the library anchors in place, weights collapsed and equal by default with profile-based defaults, a live total and a disabled save stating the gap, and the decision rule. On a published version the card is read from its snapshot and a weight change needs a reason and becomes a new set." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 17: AI draft from the job ad (HIRING_DRAFT, `/assessment/ai`)

**Files:**
- Create: `src/solutions/hiring/ai/draft.ts`, `src/solutions/hiring/ai/draft.test.ts`
- Create: `src/solutions/hiring/ai/draft-job.ts`
- Create: `src/solutions/hiring/server/draft-context.ts`
- Modify: `src/server/library-write.ts` (`findOrCreateCompetency`, `removeCompetencyIfUnused`, `setPositionJobAdIfEmpty`)
- Create: `src/app/(manager)/hiring/openings/[id]/assessment/ai/actions.ts`, `ai/page.tsx`
- Create: `src/components/hiring/ai/ai-draft.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (namespace `hiringAi`)

**Interfaces:**
- Consumes: `callJson`, `recordAiRun` (`@/lib/ai-runs`), `getAiProvider` (`@/lib/ai`), `parseModelJson`, `withoutEmDash`, `buildRepairMessages` (Task 7), `insertStage`, `deleteStage`, `ensureDraftVersion` (Task 11), `defaultsFor`, `emptyActivity`, `stagePayloadSchema` (Task 11).
- Produces in `ai/draft`: `SUGGESTABLE_TYPES`, `DRAFT_BUDGET`, `JOB_AD_MIN_CHARS = 40`, `JOB_AD_THIN_CHARS = 120`, `JOB_AD_MAX_CHARS = 20000`, `jobAdProblem(text)`, `isJobAdThin(text)`, `HIRING_DRAFT_JSON_SCHEMA`, types `HiringDraft`, `StageSuggestion`, `ActivitySuggestion`, `CompetencySuggestion`, `DraftRequest`, `buildDraftMessages(r)`, `parseDraftAnswer(text)`, `normalizeDraft(draft, { locales, libraryIds })`, `draftTotalSeconds(draft)`, `checkDraftBudget(draft)`, `quoteFound(quote, jobAd)`, `visibleProposals(draft, jobAd): { stages; newCompetencies; hidden }`, `pendingCompetencies(stage, newCompetencies, accepted)`, `stagePayloadFrom(stage, competencies, accepted): StagePayload`.
- Produces in `ai/draft-job`: `generateHiringDraft(input): Promise<DraftOutcome>` with `DraftOutcome = { status: "OK"; draft; budgetWarning: string | null } | { status: "UNCONFIGURED" } | { status: "FAILED"; code: "PROVIDER_FAILED" | "SCHEMA_FAILED" }`.
- Produces in `@/server/library-write`: `findOrCreateCompetency(orgId, actorId, proposal): Promise<{ ok: true; id: string; created: boolean } | { ok: false; code: "NAME_REQUIRED" }>`, `removeCompetencyIfUnused(orgId, actorId, id): Promise<{ ok: boolean }>`, `setPositionJobAdIfEmpty(orgId, positionId, text): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `src/solutions/hiring/ai/draft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { stagePayloadSchema } from "../rules/patches";
import {
  buildDraftMessages,
  checkDraftBudget,
  jobAdProblem,
  normalizeDraft,
  parseDraftAnswer,
  pendingCompetencies,
  quoteFound,
  stagePayloadFrom,
  visibleProposals,
  type ActivitySuggestion,
  type CompetencySuggestion,
  type HiringDraft,
  type StageSuggestion,
} from "./draft";

const AD = "Ürün ekibimize kullanıcı araştırmasını yönetecek bir tasarımcı arıyoruz. Paydaşlara bulguları sade bir dille anlatabilmelisin. Veriyle karar verirsin.";
const LIB = "00000000-0000-4000-8000-000000000001";

const activity = (key: string, over: Partial<ActivitySuggestion> = {}): ActivitySuggestion => ({
  key,
  type: "VIDEO",
  promptTr: "Bir araştırma bulgusunu paydaşlara nasıl anlattığını anlat.",
  promptEn: "",
  purpose: "Bulguyu sade anlatma",
  expectedBehaviours: ["Ana bulguyu başta söyler"],
  redFlags: ["Jargona saklanır"],
  example1: "Bulguyu sıralamadan anlatır.",
  example3: "Bulguyu ve bir örneği verir.",
  example5: "Dinleyiciye göre ayarlar ve özetler.",
  competencyKeys: ["comm"],
  thinkSeconds: 60,
  answerSeconds: 120,
  quote: "Paydaşlara bulguları sade bir dille anlatabilmelisin",
  ...over,
});
const stage = (key: string, activities: ActivitySuggestion[], over: Partial<StageSuggestion> = {}): StageSuggestion => ({
  key,
  nameTr: "Araştırma",
  nameEn: "",
  descriptionTr: "",
  descriptionEn: "",
  purpose: "",
  durationSeconds: 480,
  quote: "kullanıcı araştırmasını yönetecek bir tasarımcı",
  activities,
  ...over,
});
const competency = (key: string, over: Partial<CompetencySuggestion> = {}): CompetencySuggestion => ({
  key,
  libraryId: "",
  nameTr: "Veriyle karar",
  nameEn: "",
  descriptionTr: "",
  descriptionEn: "",
  anchor1Tr: "Veriye bakmadan karar verir.",
  anchor1En: "",
  anchor3Tr: "Kararını bir veriyle gerekçelendirir.",
  anchor3En: "",
  anchor5Tr: "Veriyi sınar ve eksik veriyi söyler.",
  anchor5En: "",
  quote: "Veriyle karar verirsin",
  ...over,
});
const draft = (over: Partial<HiringDraft> = {}): HiringDraft => ({
  stages: [stage("s1", [activity("a1")])],
  competencies: [competency("comm", { libraryId: LIB, nameTr: "İletişim", quote: "" }), competency("data")],
  ...over,
});

describe("hiring AI draft: prompt and parsing", () => {
  it("states the limits: no scoring, no choice questions, quotes from the ad, sen", () => {
    const [system, user] = buildDraftMessages({
      positionName: "Ürün Tasarımcısı",
      jobAd: AD,
      locales: ["tr"],
      teamLocale: "tr",
      library: [{ id: LIB, name: "İletişim", inProfile: true }],
    });
    expect(system.content).toMatch(/never score, rank, shortlist or reject/i);
    expect(system.content).toMatch(/never propose single or multiple choice/i);
    expect(system.content).toMatch(/quote/i);
    expect(system.content).toContain('"sen"');
    expect(user.content).toContain(AD);
    expect(user.content).toContain(`${LIB}`);
  });

  it("parses a valid answer and rejects one without stages", () => {
    expect(parseDraftAnswer("```json\n" + JSON.stringify(draft()) + "\n```").ok).toBe(true);
    expect(parseDraftAnswer(JSON.stringify({ stages: [], competencies: [] })).ok).toBe(false);
  });

  it("checks the job ad's length both ways", () => {
    expect(jobAdProblem("kısa")).toBe("TOO_SHORT");
    expect(jobAdProblem("x".repeat(20_001))).toBe("TOO_LONG");
    expect(jobAdProblem(AD)).toBeNull();
  });
});

describe("hiring AI draft: normalising", () => {
  it("keeps at most 4 stages and 2 known competencies per question, and forgets unknown library ids", () => {
    const many = draft({
      stages: Array.from({ length: 6 }, (_, i) => stage(`s${i}`, [activity(`a${i}`, { competencyKeys: ["comm", "data", "ghost", "comm"] })])),
      competencies: [competency("comm", { libraryId: LIB }), competency("data", { libraryId: "not-in-library" })],
    });
    const n = normalizeDraft(many, { locales: ["tr"], libraryIds: new Set([LIB]) });
    expect(n.stages).toHaveLength(4);
    expect(n.stages[0].activities[0].competencyKeys).toEqual(["comm", "data"]);
    expect(n.competencies.find((c) => c.key === "data")?.libraryId).toBe("");
  });

  it("blanks English when the version is Turkish only, and gives text questions no thinking time", () => {
    const n = normalizeDraft(draft({ stages: [stage("s1", [activity("a1", { type: "LONG_TEXT", promptEn: "Tell us", thinkSeconds: 90 })])] }), {
      locales: ["tr"],
      libraryIds: new Set([LIB]),
    });
    expect(n.stages[0].activities[0].promptEn).toBe("");
    expect(n.stages[0].activities[0].thinkSeconds).toBe(0);
  });

  it("flags a draft no candidate would finish", () => {
    const long = draft({ stages: Array.from({ length: 4 }, (_, i) => stage(`s${i}`, [activity(`a${i}`)], { durationSeconds: 700 })) });
    expect(checkDraftBudget(long)).toMatch(/Toplam süre/);
    expect(checkDraftBudget(draft())).toBeNull();
  });
});

describe("hiring AI draft: which proposals are shown (HIRING-UX 5.6)", () => {
  it("finds a quote regardless of case, spacing and quote marks, and ignores a too short one", () => {
    expect(quoteFound('"paydaşlara bulguları   sade bir dille"', AD)).toBe(true);
    expect(quoteFound("Liderlik deneyimi şart", AD)).toBe(false);
    expect(quoteFound("Veri", AD)).toBe(false);
  });

  it("hides a card whose quote is not in the ad, question by question", () => {
    const d = draft({
      stages: [
        stage("s1", [activity("a1"), activity("a2", { quote: "Takım liderliği yaptın" })]),
        stage("s2", [activity("a3")], { quote: "Bu cümle ilanda yok" }),
      ],
    });
    const v = visibleProposals(d, AD);
    expect(v.stages.map((s) => s.key)).toEqual(["s1"]);
    expect(v.stages[0].activities.map((a) => a.key)).toEqual(["a1"]);
    expect(v.hidden).toBe(2);
  });

  it("shows new competencies with a quote only, and drops a hidden one from the questions", () => {
    const d = draft({
      stages: [stage("s1", [activity("a1", { competencyKeys: ["comm", "ghost"] })])],
      competencies: [competency("comm", { libraryId: LIB, quote: "" }), competency("data"), competency("ghost", { quote: "ilanda olmayan bir cümle" })],
    });
    const v = visibleProposals(d, AD);
    expect(v.newCompetencies.map((c) => c.key)).toEqual(["data"]);
    expect(v.stages[0].activities[0].competencyKeys).toEqual(["comm"]);
  });

  it("asks for a new competency to be accepted before a stage that measures it", () => {
    const s = stage("s1", [activity("a1", { competencyKeys: ["comm", "data"] })]);
    const fresh = [competency("data")];
    expect(pendingCompetencies(s, fresh, {}).map((c) => c.key)).toEqual(["data"]);
    expect(pendingCompetencies(s, fresh, { data: "id-data" })).toEqual([]);
  });

  it("turns an accepted stage card into a payload the builder accepts", () => {
    const s = stage("s1", [activity("a1", { competencyKeys: ["comm", "data"] }), activity("a2", { type: "SHORT_TEXT", competencyKeys: ["data"] })]);
    const accepted = { data: "00000000-0000-4000-8000-000000000002" };
    const payload = stagePayloadFrom(s, [competency("comm", { libraryId: LIB }), competency("data")], accepted);
    expect(stagePayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload.activities[0].competencyIds).toEqual([LIB, accepted.data]);
    expect(payload.activities[0].answerExamples).toEqual({ 1: "Bulguyu sıralamadan anlatır.", 3: "Bulguyu ve bir örneği verir.", 5: "Dinleyiciye göre ayarlar ve özetler." });
    expect(payload.activities[1].answerSeconds).toBeNull();
    expect(payload.activities[1].thinkSeconds).toBe(0);
  });
});
```

Run: `pnpm exec vitest run src/solutions/hiring/ai/draft.test.ts` - Expected: FAIL with `Cannot find module './draft'`.

- [ ] **Step 2: Implement the draft rules**

Create `src/solutions/hiring/ai/draft.ts` (ported from `610da60:src/lib/template-draft.ts`, adapted to the new model):

```ts
import { z } from "zod";
import type { Locale } from "@/i18n/locale";
import type { AiMessage } from "@/lib/ai";
import { parseModelJson, withoutEmDash } from "@/lib/ai-json";
import { emptyActivity, type StagePayload } from "../rules/patches";

/**
 * HIRING_DRAFT (HIRING-UX 3.9, 5.6): a job ad to an assessment proposal. Pure:
 * schema, prompt, validation, normalising, and which cards are shown. Nothing
 * here writes; a proposal becomes a stage only when a person accepts its card.
 *
 * Choice questions are never suggested: their answer key feeds the knowledge
 * score, and deciding what counts as right is the manager's call.
 */
export const SUGGESTABLE_TYPES = ["VIDEO", "AUDIO", "LONG_TEXT", "SHORT_TEXT", "FILE_UPLOAD"] as const;

const LIMITS = {
  stageSeconds: { min: 60, max: 7200 },
  thinkSeconds: { min: 0, max: 600 },
  answerSeconds: { min: 30, max: 1800 },
  maxStages: 4,
  maxActivitiesPerStage: 5,
  maxCompetencies: 8,
  maxListItems: 6,
} as const;

/** What an assessment may cost a candidate (old product, measured: the first real run asked 106 minutes). */
export const DRAFT_BUDGET = {
  totalTargetSeconds: 1500,
  totalMinSeconds: 900,
  totalMaxSeconds: 1800,
  maxStages: LIMITS.maxStages,
  stageMaxSeconds: 720,
  mediaAnswerMaxSeconds: 180,
  fileUploadStages: 1,
} as const;

export const JOB_AD_MIN_CHARS = 40;
export const JOB_AD_THIN_CHARS = 120;
export const JOB_AD_MAX_CHARS = 20_000;

export function jobAdProblem(text: string): null | "TOO_SHORT" | "TOO_LONG" {
  const length = text.trim().length;
  if (length < JOB_AD_MIN_CHARS) return "TOO_SHORT";
  if (length > JOB_AD_MAX_CHARS) return "TOO_LONG";
  return null;
}

export function isJobAdThin(text: string): boolean {
  const length = text.trim().length;
  return length >= JOB_AD_MIN_CHARS && length < JOB_AD_THIN_CHARS;
}

const seconds = z.number().int().min(0).max(100_000);
const str = (max: number) => z.string().max(max);

const activitySchema = z.object({
  key: z.string().min(1).max(40),
  type: z.enum(SUGGESTABLE_TYPES),
  promptTr: z.string().min(1).max(2000),
  promptEn: str(2000),
  purpose: str(1000),
  expectedBehaviours: z.array(str(300)).max(20),
  redFlags: z.array(str(300)).max(20),
  example1: str(600),
  example3: str(600),
  example5: str(600),
  competencyKeys: z.array(str(40)).max(6),
  thinkSeconds: seconds,
  answerSeconds: seconds,
  quote: str(600),
});

const stageSchema = z.object({
  key: z.string().min(1).max(40),
  nameTr: z.string().min(1).max(160),
  nameEn: str(160),
  descriptionTr: str(1000),
  descriptionEn: str(1000),
  purpose: str(1000),
  durationSeconds: seconds,
  quote: str(600),
  activities: z.array(activitySchema).min(1).max(20),
});

const competencySchema = z.object({
  key: z.string().min(1).max(40),
  libraryId: str(64),
  nameTr: z.string().min(1).max(160),
  nameEn: str(160),
  descriptionTr: str(600),
  descriptionEn: str(600),
  anchor1Tr: str(600),
  anchor1En: str(600),
  anchor3Tr: str(600),
  anchor3En: str(600),
  anchor5Tr: str(600),
  anchor5En: str(600),
  quote: str(600),
});

export const hiringDraftSchema = z.object({
  stages: z.array(stageSchema).min(1).max(20),
  competencies: z.array(competencySchema).max(20),
});

export type HiringDraft = z.infer<typeof hiringDraftSchema>;
export type StageSuggestion = z.infer<typeof stageSchema>;
export type ActivitySuggestion = z.infer<typeof activitySchema>;
export type CompetencySuggestion = z.infer<typeof competencySchema>;

const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const S = { type: "string" };
const I = { type: "integer" };
const A = { type: "array", items: { type: "string" } };

/** Kept by hand in the strict shape (every property required, no extras); Gemini gets it through toGeminiSchema. */
export const HIRING_DRAFT_JSON_SCHEMA: Record<string, unknown> = obj({
  stages: {
    type: "array",
    items: obj({
      key: S,
      nameTr: S,
      nameEn: S,
      descriptionTr: S,
      descriptionEn: S,
      purpose: S,
      durationSeconds: I,
      quote: S,
      activities: {
        type: "array",
        items: obj({
          key: S,
          type: { type: "string", enum: [...SUGGESTABLE_TYPES] },
          promptTr: S,
          promptEn: S,
          purpose: S,
          expectedBehaviours: A,
          redFlags: A,
          example1: S,
          example3: S,
          example5: S,
          competencyKeys: A,
          thinkSeconds: I,
          answerSeconds: I,
          quote: S,
        }),
      },
    }),
  },
  competencies: {
    type: "array",
    items: obj({
      key: S,
      libraryId: S,
      nameTr: S,
      nameEn: S,
      descriptionTr: S,
      descriptionEn: S,
      anchor1Tr: S,
      anchor1En: S,
      anchor3Tr: S,
      anchor3En: S,
      anchor5Tr: S,
      anchor5En: S,
      quote: S,
    }),
  },
});

export type DraftRequest = {
  positionName: string;
  jobAd: string;
  /** Languages the version is written in; English fields stay empty without "en". */
  locales: Locale[];
  /** Language of the team-only fields (purpose, behaviours, flags, examples). */
  teamLocale: Locale;
  /** The organisation's active competencies, profile ones first. */
  library: Array<{ id: string; name: string; inProfile: boolean }>;
};

const SYSTEM_PROMPT = `You design structured, asynchronous candidate assessments. You are drafting a proposal for a hiring team that will accept, edit or delete each item by hand.

Hard limits:
- You never score, rank, shortlist or reject a candidate, and you never suggest a feature that would. You design how the evaluation is conducted; people evaluate.
- You never propose inferring emotion, personality, confidence or mental state from video, voice or face.
- You never propose questions about age, gender, marital or family status, pregnancy, health or disability, religion, ethnicity, origin, sexual orientation, political views or union membership.
- You never propose single or multiple choice questions. Use only VIDEO, AUDIO, LONG_TEXT, SHORT_TEXT and FILE_UPLOAD.
- Every question is about job relevant behaviour, a work sample, or reasoning the job ad actually asks for.
- Every stage, question and new competency carries "quote": a sentence or phrase copied word for word from the job ad that justifies it. If you cannot quote the ad, leave the item out.

Competencies:
- Every question measures one or two competencies, listed by key in competencyKeys.
- Reuse the organisation's competencies: for each one you use, add an entry with its exact libraryId and name. Prefer the ones marked "profile".
- Only when the ad needs something the library lacks, add a new competency with libraryId "" and write its behavioural anchors for levels 1, 3 and 5 (what a reviewer observes, never a trait).
- example1, example3 and example5 describe what an answer at level 1, 3 and 5 looks like for THIS question.

Writing:
- Candidate facing Turkish text addresses the candidate with "sen", warmly, in natural Turkish.
- Team-only fields (purpose, expectedBehaviours, redFlags, example1/3/5) are written in the team language given below.
- Never use the em dash character.

Timing:
- The whole assessment fits in 15 to 30 minutes, about 25 is the target. Propose 3 or 4 stages, never more.
- No stage exceeds 12 minutes. For VIDEO and AUDIO, thinkSeconds is 30 to 120 and answerSeconds 60 to 180. For written answers thinkSeconds is 0.
- FILE_UPLOAD appears in at most one stage, only if the ad asks for a work sample.`;

export function buildDraftMessages(request: DraftRequest): AiMessage[] {
  const library = request.library.length
    ? request.library.map((c) => `- ${c.id} | ${c.name}${c.inProfile ? " | profile" : ""}`).join("\n")
    : "(kütüphane boş)";
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `Pozisyon: ${request.positionName}`,
        "",
        "İş ilanı metni:",
        '"""',
        request.jobAd.trim(),
        '"""',
        "",
        "Kurumun yetkinlikleri (libraryId | ad):",
        library,
        "",
        `Ekip dili: ${request.teamLocale === "en" ? "English" : "Türkçe"}.`,
        request.locales.includes("en")
          ? "Bu değerlendirme Türkçe ve İngilizce yayınlanacak: *Tr ve *En alanlarını doldur."
          : "Bu değerlendirme yalnızca Türkçe yayınlanacak: *En alanlarını boş dize bırak.",
        "İlan bir öğeyi desteklemiyorsa önerme. Az ve isabetli öneri, çok ve genel öneriden iyidir.",
      ].join("\n"),
    },
  ];
}

export type DraftParse = { ok: true; draft: HiringDraft } | { ok: false; problem: string };

export function parseDraftAnswer(text: string): DraftParse {
  const json = parseModelJson(text);
  if (!json.ok) return json;
  const parsed = hiringDraftSchema.safeParse(json.value);
  if (!parsed.success) {
    return { ok: false, problem: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
  }
  return { ok: true, draft: parsed.data };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));
const clean = (s: string) => withoutEmDash(s.trim());
const cleanList = (items: string[]) => items.map(clean).filter(Boolean).slice(0, LIMITS.maxListItems);
const unique = <T extends { key: string }>(items: T[]) => items.filter((item, i) => items.findIndex((x) => x.key === item.key) === i);

/** Brings a valid draft inside what the product can store and a candidate can finish. */
export function normalizeDraft(draft: HiringDraft, options: { locales: Locale[]; libraryIds: ReadonlySet<string> }): HiringDraft {
  const en = (s: string) => (options.locales.includes("en") ? clean(s) : "");
  const competencies = unique(draft.competencies)
    .slice(0, LIMITS.maxCompetencies)
    .map((c) => ({
      ...c,
      libraryId: options.libraryIds.has(c.libraryId) ? c.libraryId : "",
      nameTr: clean(c.nameTr),
      nameEn: en(c.nameEn),
      descriptionTr: clean(c.descriptionTr),
      descriptionEn: en(c.descriptionEn),
      anchor1Tr: clean(c.anchor1Tr),
      anchor1En: en(c.anchor1En),
      anchor3Tr: clean(c.anchor3Tr),
      anchor3En: en(c.anchor3En),
      anchor5Tr: clean(c.anchor5Tr),
      anchor5En: en(c.anchor5En),
      quote: c.quote.trim(),
    }));
  const known = new Set(competencies.map((c) => c.key));
  const stages = unique(draft.stages)
    .slice(0, LIMITS.maxStages)
    .map((stage) => {
      const activities = unique(stage.activities.filter((a) => a.promptTr.trim().length > 0))
        .slice(0, LIMITS.maxActivitiesPerStage)
        .map((a) => {
          const recorded = a.type === "VIDEO" || a.type === "AUDIO";
          return {
            ...a,
            promptTr: clean(a.promptTr),
            promptEn: en(a.promptEn),
            purpose: clean(a.purpose),
            expectedBehaviours: cleanList(a.expectedBehaviours),
            redFlags: cleanList(a.redFlags),
            example1: clean(a.example1),
            example3: clean(a.example3),
            example5: clean(a.example5),
            competencyKeys: [...new Set(a.competencyKeys)].filter((k) => known.has(k)).slice(0, 2),
            thinkSeconds: recorded ? clamp(a.thinkSeconds, LIMITS.thinkSeconds.min, LIMITS.thinkSeconds.max) : 0,
            answerSeconds: clamp(a.answerSeconds, LIMITS.answerSeconds.min, LIMITS.answerSeconds.max),
            quote: a.quote.trim(),
          };
        });
      const needed = activities.reduce((sum, a) => sum + a.thinkSeconds + a.answerSeconds, 0);
      return {
        ...stage,
        nameTr: clean(stage.nameTr),
        nameEn: en(stage.nameEn),
        descriptionTr: clean(stage.descriptionTr),
        descriptionEn: en(stage.descriptionEn),
        purpose: clean(stage.purpose),
        durationSeconds: clamp(Math.max(stage.durationSeconds, needed + 60), LIMITS.stageSeconds.min, LIMITS.stageSeconds.max),
        quote: stage.quote.trim(),
        activities,
      };
    })
    .filter((stage) => stage.activities.length > 0);
  return { stages, competencies };
}

export function draftTotalSeconds(draft: HiringDraft): number {
  return draft.stages.reduce((sum, s) => sum + s.durationSeconds, 0);
}

/** Null when a candidate could finish it; otherwise the reasons, used for the one repair attempt and the on-screen note. */
export function checkDraftBudget(draft: HiringDraft): string | null {
  const minutes = (s: number) => Math.round(s / 60);
  const problems: string[] = [];
  const total = draftTotalSeconds(draft);
  if (total > DRAFT_BUDGET.totalMaxSeconds) {
    problems.push(`Toplam süre ${minutes(total)} dakika, en fazla ${minutes(DRAFT_BUDGET.totalMaxSeconds)} dakika olmalı (hedef ${minutes(DRAFT_BUDGET.totalTargetSeconds)}).`);
  }
  if (draft.stages.length > DRAFT_BUDGET.maxStages) problems.push(`${draft.stages.length} aşama var, en fazla ${DRAFT_BUDGET.maxStages} olmalı.`);
  for (const stage of draft.stages) {
    if (stage.durationSeconds > DRAFT_BUDGET.stageMaxSeconds) {
      problems.push(`"${stage.nameTr}" aşaması ${minutes(stage.durationSeconds)} dakika, en fazla ${minutes(DRAFT_BUDGET.stageMaxSeconds)} dakika olmalı.`);
    }
    for (const a of stage.activities) {
      if ((a.type === "VIDEO" || a.type === "AUDIO") && a.answerSeconds > DRAFT_BUDGET.mediaAnswerMaxSeconds) {
        problems.push(`"${stage.nameTr}" aşamasında ${a.answerSeconds} saniyelik bir ${a.type} cevabı var; kayıtlı cevap en fazla ${DRAFT_BUDGET.mediaAnswerMaxSeconds} saniye olmalı, yazılı bir görevse tipi LONG_TEXT olmalı.`);
      }
    }
  }
  const uploads = draft.stages.filter((s) => s.activities.some((a) => a.type === "FILE_UPLOAD")).length;
  if (uploads > DRAFT_BUDGET.fileUploadStages) problems.push(`${uploads} aşamada dosya isteniyor, en fazla ${DRAFT_BUDGET.fileUploadStages} aşamada olmalı.`);
  return problems.length ? problems.join(" ") : null;
}

const normalizeText = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/["'“”‘’«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.,;:!?…\s-]+|[.,;:!?…\s-]+$/g, "");

/** HIRING-UX 5.6: a card's "Neden?" is a quote from the ad; a quote not found in the ad hides the card. */
export function quoteFound(quote: string, jobAd: string): boolean {
  const q = normalizeText(quote);
  return q.length >= 8 && normalizeText(jobAd).includes(q);
}

export function visibleProposals(draft: HiringDraft, jobAd: string): { stages: StageSuggestion[]; newCompetencies: CompetencySuggestion[]; hidden: number } {
  let hidden = 0;
  const newCompetencies = draft.competencies.filter((c) => {
    if (c.libraryId) return false;
    const ok = quoteFound(c.quote, jobAd);
    if (!ok) hidden += 1;
    return ok;
  });
  // A question may only refer to a library competency or a new one whose card is shown.
  const usable = new Set([...draft.competencies.filter((c) => c.libraryId).map((c) => c.key), ...newCompetencies.map((c) => c.key)]);
  const stages = draft.stages.flatMap((stage) => {
    if (!quoteFound(stage.quote, jobAd)) {
      hidden += 1;
      return [];
    }
    const activities = stage.activities
      .filter((a) => {
        const ok = quoteFound(a.quote, jobAd);
        if (!ok) hidden += 1;
        return ok;
      })
      .map((a) => ({ ...a, competencyKeys: a.competencyKeys.filter((k) => usable.has(k)) }));
    return activities.length ? [{ ...stage, activities }] : [];
  });
  return { stages, newCompetencies, hidden };
}

/** New competencies a stage measures that have not been accepted yet ("Önce X yetkinliğini kabul et."). */
export function pendingCompetencies(stage: StageSuggestion, newCompetencies: CompetencySuggestion[], accepted: Record<string, string>): CompetencySuggestion[] {
  const keys = new Set(stage.activities.flatMap((a) => a.competencyKeys));
  return newCompetencies.filter((c) => keys.has(c.key) && !accepted[c.key]);
}

/** An accepted stage card as the builder's insert payload. */
export function stagePayloadFrom(stage: StageSuggestion, competencies: CompetencySuggestion[], accepted: Record<string, string>): StagePayload {
  const idFor = (key: string) => {
    const c = competencies.find((x) => x.key === key);
    return c ? c.libraryId || accepted[key] || null : null;
  };
  return {
    name: { tr: stage.nameTr, en: stage.nameEn },
    description: { tr: stage.descriptionTr, en: stage.descriptionEn },
    internalPurpose: stage.purpose || null,
    durationSeconds: clamp(stage.durationSeconds, 60, 7200),
    graceSeconds: 0,
    onTimeout: "AUTO_SUBMIT",
    backNavigation: false,
    activities: stage.activities.map((a) => {
      const recorded = a.type === "VIDEO" || a.type === "AUDIO";
      const examples: Record<string, string> = {};
      if (a.example1) examples[1] = a.example1;
      if (a.example3) examples[3] = a.example3;
      if (a.example5) examples[5] = a.example5;
      return {
        ...emptyActivity(a.type),
        prompt: { tr: a.promptTr, en: a.promptEn },
        internalQuestion: a.purpose || null,
        expectedBehaviours: a.expectedBehaviours.slice(0, 10),
        redFlags: a.redFlags.slice(0, 10),
        answerExamples: examples,
        thinkSeconds: recorded ? a.thinkSeconds : 0,
        answerSeconds: recorded ? clamp(a.answerSeconds, 30, 1800) : null,
        competencyIds: a.competencyKeys.map(idFor).filter((x): x is string => x !== null).slice(0, 2),
      };
    }),
  };
}
```

Run: `pnpm exec vitest run src/solutions/hiring/ai/draft.test.ts` - Expected: PASS.

- [ ] **Step 3: Write the logged call and the library helpers**

Create `src/solutions/hiring/ai/draft-job.ts`:

```ts
import { getAiProvider } from "@/lib/ai";
import { buildRepairMessages } from "@/lib/ai-json";
import { callJson, recordAiRun } from "@/lib/ai-runs";
import { buildDraftMessages, checkDraftBudget, HIRING_DRAFT_JSON_SCHEMA, normalizeDraft, parseDraftAnswer, type DraftRequest, type HiringDraft } from "./draft";

export type DraftOutcome =
  | { status: "OK"; draft: HiringDraft; budgetWarning: string | null }
  | { status: "UNCONFIGURED" }
  | { status: "FAILED"; code: "PROVIDER_FAILED" | "SCHEMA_FAILED" };

/**
 * One drafting run: prompt, validate, repair once, and every call in ai_runs
 * (callJson). Writes nothing else: the screen shows cards and a person accepts
 * them one by one.
 */
export async function generateHiringDraft(input: DraftRequest & { orgId: string; userId: string; openingId: string }): Promise<DraftOutcome> {
  if (!getAiProvider().available) return { status: "UNCONFIGURED" };
  const meta = { orgId: input.orgId, purpose: "HIRING_DRAFT" as const, inputRef: input.openingId, requestedBy: input.userId };
  const options = { locales: input.locales, libraryIds: new Set(input.library.map((c) => c.id)) };
  const messages = buildDraftMessages(input);
  let firstText: string;
  try {
    firstText = (await callJson("kademe_hiring_draft", HIRING_DRAFT_JSON_SCHEMA, messages, meta)).response.text;
  } catch {
    return { status: "FAILED", code: "PROVIDER_FAILED" };
  }
  const parsed = parseDraftAnswer(firstText);
  const problem = parsed.ok ? checkDraftBudget(normalizeDraft(parsed.draft, options)) : parsed.problem;
  if (parsed.ok && !problem) return { status: "OK", draft: normalizeDraft(parsed.draft, options), budgetWarning: null };

  let second: Awaited<ReturnType<typeof callJson>>;
  try {
    second = await callJson("kademe_hiring_draft", HIRING_DRAFT_JSON_SCHEMA, buildRepairMessages(messages, firstText, problem!), meta);
  } catch {
    return { status: "FAILED", code: "PROVIDER_FAILED" };
  }
  const repaired = parseDraftAnswer(second.response.text);
  if (!repaired.ok) {
    await recordAiRun({ ...meta, model: second.response.model, error: `repair still invalid: ${repaired.problem}` });
    return { status: "FAILED", code: "SCHEMA_FAILED" };
  }
  const draft = normalizeDraft(repaired.draft, options);
  // A second overrun is shown, not thrown away: every card carries its minutes and can be skipped.
  return { status: "OK", draft, budgetWarning: checkDraftBudget(draft) };
}
```

Create `src/solutions/hiring/server/draft-context.ts`:

```ts
import { activeCompetencyOptions } from "@/server/library";
import { positionProfile } from "./content";

/** The library as the AI sees it: active competencies, the position's profile first. */
export async function draftLibrary(orgId: string, positionId: string) {
  const [options, profile] = await Promise.all([activeCompetencyOptions(orgId), positionProfile(positionId)]);
  const inProfile = new Set(profile.map((p) => p.competencyId));
  const ordered = [...options.filter((o) => inProfile.has(o.id)), ...options.filter((o) => !inProfile.has(o.id))];
  return ordered.map((o) => ({ id: o.id, name: o.name.tr || o.name.en, inProfile: inProfile.has(o.id) }));
}
```

Append to `src/server/library-write.ts` (add `isNull` is already imported; add `positions` to the schema import if missing):

```ts
/** An accepted AI competency card (HIRING-UX 5.6): an existing name is reused, otherwise it joins the library. */
export async function findOrCreateCompetency(
  orgId: string,
  actorId: string,
  proposal: { name: I18nText; description: I18nText; anchors: AnchorInput },
): Promise<{ ok: true; id: string; created: boolean } | { ok: false; code: "NAME_REQUIRED" }> {
  if (!hasText(proposal.name)) return { ok: false, code: "NAME_REQUIRED" };
  const wanted = [proposal.name.tr, proposal.name.en].map((n) => n.trim().toLocaleLowerCase("tr")).filter(Boolean);
  const rows = await db
    .select({ id: competencies.id, name: competencies.name })
    .from(competencies)
    .where(and(eq(competencies.orgId, orgId), isNull(competencies.archivedAt)));
  const existing = rows.find((r) => [r.name.tr, r.name.en].some((n) => wanted.includes(n.trim().toLocaleLowerCase("tr"))));
  if (existing) return { ok: true, id: existing.id, created: false };
  const created = await createCompetency(orgId, actorId, proposal);
  return created.ok ? { ok: true, id: created.id, created: true } : created;
}

/**
 * Undo of an accepted AI competency. Deletes it only while nothing uses it:
 * every reference to a competency (profiles, questions, weights) is ON DELETE
 * RESTRICT, so the database refuses a used one and this answers ok: false.
 */
export async function removeCompetencyIfUnused(orgId: string, actorId: string, id: string): Promise<{ ok: boolean }> {
  try {
    const rows = await db
      .delete(competencies)
      .where(and(eq(competencies.id, id), eq(competencies.orgId, orgId)))
      .returning({ id: competencies.id });
    if (rows.length) await audit(db, orgId, actorId, "library.competency.remove-unused", "competency", id);
    return { ok: rows.length > 0 };
  } catch (error) {
    // drizzle wraps the driver error; the SQLSTATE is on its cause.
    const code = (error as { cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
    if (code === "23503") return { ok: false };
    throw error;
  }
}

/** The AI screen saves the pasted job ad onto the position, but never overwrites one the team wrote. */
export async function setPositionJobAdIfEmpty(orgId: string, positionId: string, text: string): Promise<void> {
  const [row] = await db
    .select({ jobDescription: positions.jobDescription })
    .from(positions)
    .where(and(eq(positions.id, positionId), eq(positions.orgId, orgId)))
    .limit(1);
  if (!row || (row.jobDescription ?? "").trim()) return;
  await db.update(positions).set({ jobDescription: text.trim(), updatedAt: new Date() }).where(eq(positions.id, positionId));
}
```

- [ ] **Step 4: Write the actions**

Create `src/app/(manager)/hiring/openings/[id]/assessment/ai/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/authorize";
import { findOrCreateCompetency, removeCompetencyIfUnused, setPositionJobAdIfEmpty } from "@/server/library-write";
import { managerLocale } from "@/i18n/manager-locale";
import { jobAdProblem } from "@/solutions/hiring/ai/draft";
import { generateHiringDraft } from "@/solutions/hiring/ai/draft-job";
import { stagePayloadSchema, type StagePayload } from "@/solutions/hiring/rules/patches";
import { draftLibrary } from "@/solutions/hiring/server/draft-context";
import { HiringConflict, HiringNotFound } from "@/solutions/hiring/server/errors";
import { deleteStage, ensureDraftVersion, insertStage } from "@/solutions/hiring/server/versions";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../../access";

const i18n = z.object({ tr: z.string().max(2000), en: z.string().max(2000) });

/** "Önerileri üret": a proposal only; the job ad is saved onto an empty position. */
export async function generateDraftAction(openingId: string, jobAd: string) {
  const { user, opening } = await openingFor(openingId, "edit");
  const problem = jobAdProblem(jobAd);
  if (problem) return { status: "INVALID_AD" as const, problem };
  await setPositionJobAdIfEmpty(user.orgId, opening.positionId, jobAd);
  const [state, library] = await Promise.all([workingState(user.orgId, openingId), draftLibrary(user.orgId, opening.positionId)]);
  return generateHiringDraft({
    orgId: user.orgId,
    userId: user.id,
    openingId,
    positionName: opening.positionName,
    jobAd,
    locales: state.content?.localeSet ?? ["tr"],
    teamLocale: await managerLocale(),
    library,
  });
}

/** "Kabul et" on a stage card: written to the draft (a draft is opened first if only a published version exists). */
export async function acceptStageAction(openingId: string, payload: StagePayload) {
  const { user } = await openingFor(openingId, "edit");
  const parsed = stagePayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, code: "INVALID" };
  try {
    await ensureDraftVersion(user.orgId, openingId);
    const stageId = await insertStage(user.orgId, openingId, parsed.data);
    revalidatePath("/hiring/openings/[id]", "layout");
    return { ok: true as const, stageId };
  } catch (error) {
    if (error instanceof HiringConflict || error instanceof HiringNotFound) return { ok: false as const, code: error.code };
    throw error;
  }
}

/** "Geri al" on an accepted stage card. */
export async function removeAcceptedStageAction(openingId: string, stageId: string) {
  const { user } = await openingFor(openingId, "edit");
  try {
    await deleteStage(user.orgId, openingId, stageId);
    revalidatePath("/hiring/openings/[id]", "layout");
    return { ok: true as const };
  } catch (error) {
    if (error instanceof HiringConflict || error instanceof HiringNotFound) return { ok: false as const, code: error.code };
    throw error;
  }
}

/** "Kabul et" on a new-competency card: "Kütüphaneye eklenir, diğer alımlar da kullanabilir." */
export async function acceptCompetencyAction(
  openingId: string,
  proposal: { name: { tr: string; en: string }; description: { tr: string; en: string }; anchors: Partial<Record<"1" | "3" | "5", { tr: string; en: string }>> },
) {
  const { user } = await openingFor(openingId, "edit");
  authorize(user, "library:write");
  const parsed = z.object({ name: i18n, description: i18n, anchors: z.partialRecord(z.enum(["1", "3", "5"]), i18n) }).safeParse(proposal);
  if (!parsed.success) return { ok: false as const, code: "INVALID" as const };
  const result = await findOrCreateCompetency(user.orgId, user.id, parsed.data);
  if (result.ok) revalidatePath("/library/competencies");
  return result;
}

/** "Geri al" on an accepted competency card: removes it only if this acceptance created it and nothing uses it. */
export async function undoCompetencyAction(openingId: string, competencyId: string, created: boolean) {
  const { user } = await openingFor(openingId, "edit");
  authorize(user, "library:write");
  if (!created || !z.uuid().safeParse(competencyId).success) return { ok: true as const };
  return removeCompetencyIfUnused(user.orgId, user.id, competencyId);
}
```

- [ ] **Step 5: Add the copy**

Add to `hiring.tr.json`:

```json
  "hiringAi": {
    "boundary": "AI değerlendirmeyi tasarlamaya yardım eder; adayı puanlamaz, sıralamaz, elemez. Hiçbir öneri sen kabul etmeden eklenmez.",
    "jobAd": "İlan metni",
    "jobAdThin": "İlan kısa; öneriler genel kalabilir.",
    "jobAdTooShort": "İlan metni çok kısa; en az birkaç cümle yaz.",
    "jobAdTooLong": "İlan metni çok uzun; yalnızca ilanın kendisini yapıştır.",
    "generate": "Önerileri üret",
    "regenerate": "Yeniden üret",
    "working": "Öneriler hazırlanıyor, genelde 20-40 sn.",
    "failed": "Öneri üretilemedi. İlan metnin duruyor; tekrar deneyebilir ya da boş başlayabilirsin.",
    "unconfigured": "AI bağlı değil. Değerlendirmeyi kurucuda kendin kurabilirsin.",
    "budget": "Toplam {minutes} dk çıktı; 30 dk altına indirmek için bir aşamayı silmeyi düşün.",
    "hidden": "İlanda dayanağı bulunmayan {count} öneri gösterilmedi.",
    "toBuilder": "Kabul edilenlerle kurucuya geç",
    "stageCard": "Aşama önerisi",
    "competencyCard": "Yeni yetkinlik önerisi",
    "competencyCardNote": "Kütüphaneye eklenir, diğer alımlar da kullanabilir.",
    "why": "Neden?",
    "minutes": "{minutes} dk",
    "measures": "Ölçer: {names}",
    "examples": "Örnek cevaplar: 1 · {one} / 3 · {three} / 5 · {five}",
    "accept": "Kabul et",
    "edit": "Düzenle",
    "doneEditing": "Bitti",
    "remove": "Sil",
    "removed": "Öneri kaldırıldı.",
    "restore": "Geri al",
    "accepted": "Kabul edildi.",
    "undo": "Geri al",
    "acceptFirst": "Önce şu yetkinliği kabul et: {names}.",
    "acceptFailed": "Eklenemedi. Tekrar dene.",
    "undoBlocked": "Bu yetkinlik artık kullanılıyor; kütüphanede kalıyor.",
    "noPermission": "Rolün değerlendirmeyi değiştiremez.",
    "promptLabel": "Soru metni (TR)"
  }
```

and to `hiring.en.json`:

```json
  "hiringAi": {
    "boundary": "AI helps design the assessment; it never scores, ranks or rejects a candidate. Nothing is added until you accept it.",
    "jobAd": "Job ad",
    "jobAdThin": "The ad is short; suggestions may stay generic.",
    "jobAdTooShort": "The job ad is too short; write at least a few sentences.",
    "jobAdTooLong": "The job ad is too long; paste only the ad itself.",
    "generate": "Generate suggestions",
    "regenerate": "Generate again",
    "working": "Preparing suggestions, usually 20-40 s.",
    "failed": "No suggestions could be made. Your job ad is still here; try again or start blank.",
    "unconfigured": "AI is not connected. You can build the assessment yourself in the builder.",
    "budget": "The total came to {minutes} min; consider deleting a stage to get under 30 min.",
    "hidden": "{count, plural, one {# suggestion was} other {# suggestions were}} hidden because the ad does not support them.",
    "toBuilder": "Continue to the builder with what you accepted",
    "stageCard": "Stage suggestion",
    "competencyCard": "New competency suggestion",
    "competencyCardNote": "It joins the library; other openings can use it too.",
    "why": "Why?",
    "minutes": "{minutes} min",
    "measures": "Measures: {names}",
    "examples": "Example answers: 1 · {one} / 3 · {three} / 5 · {five}",
    "accept": "Accept",
    "edit": "Edit",
    "doneEditing": "Done",
    "remove": "Remove",
    "removed": "Suggestion removed.",
    "restore": "Undo",
    "accepted": "Accepted.",
    "undo": "Undo",
    "acceptFirst": "Accept this competency first: {names}.",
    "acceptFailed": "Could not add it. Try again.",
    "undoBlocked": "This competency is in use now; it stays in the library.",
    "noPermission": "Your role cannot change the assessment.",
    "promptLabel": "Question (TR)"
  }
```

- [ ] **Step 6: Write the AI screen**

Create `src/components/hiring/ai/ai-draft.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import {
  draftTotalSeconds,
  isJobAdThin,
  jobAdProblem,
  pendingCompetencies,
  stagePayloadFrom,
  visibleProposals,
  type CompetencySuggestion,
  type HiringDraft,
  type StageSuggestion,
} from "@/solutions/hiring/ai/draft";
import {
  acceptCompetencyAction,
  acceptStageAction,
  generateDraftAction,
  removeAcceptedStageAction,
  undoCompetencyAction,
} from "@/app/(manager)/hiring/openings/[id]/assessment/ai/actions";

/** The record without one key. */
const without = <V,>(record: Record<string, V>, key: string): Record<string, V> => Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

type Outcome = { kind: "none" } | { kind: "failed" } | { kind: "unconfigured" } | { kind: "ready"; draft: HiringDraft; budgetWarning: string | null; jobAd: string };

/**
 * HIRING-UX 5.6 (canvas Y3): proposal cards, none applied by itself. Accept,
 * edit and remove are all reversible; a stage that measures a new competency
 * waits until that competency is accepted.
 */
export function AiDraft({
  openingId,
  initialJobAd,
  libraryNames,
  canEdit,
}: {
  openingId: string;
  initialJobAd: string;
  libraryNames: Record<string, string>;
  canEdit: boolean;
}) {
  const t = useMT("hiringAi");
  const [jobAd, setJobAd] = useState(initialJobAd);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "none" });
  const [pending, start] = useTransition();
  const [acceptedStages, setAcceptedStages] = useState<Record<string, string>>({});
  const [acceptedCompetencies, setAcceptedCompetencies] = useState<Record<string, { id: string; created: boolean }>>({});
  const [removed, setRemoved] = useState<Record<string, true>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, StageSuggestion>>({});
  const [message, setMessage] = useState<string | null>(null);

  const adProblem = jobAdProblem(jobAd);
  const generateReason = !canEdit ? t("noPermission") : adProblem === "TOO_SHORT" ? t("jobAdTooShort") : adProblem === "TOO_LONG" ? t("jobAdTooLong") : null;
  const visible = outcome.kind === "ready" ? visibleProposals(outcome.draft, outcome.jobAd) : null;
  const acceptedIds = Object.fromEntries(Object.entries(acceptedCompetencies).map(([k, v]) => [k, v.id]));
  const nameOf = (key: string) => {
    if (outcome.kind !== "ready") return key;
    const c = outcome.draft.competencies.find((x) => x.key === key);
    return c ? (c.libraryId ? libraryNames[c.libraryId] ?? c.nameTr : c.nameTr) : key;
  };

  function generate() {
    setMessage(null);
    start(async () => {
      const result = await generateDraftAction(openingId, jobAd);
      if (result.status === "OK") setOutcome({ kind: "ready", draft: result.draft, budgetWarning: result.budgetWarning, jobAd });
      else if (result.status === "UNCONFIGURED") setOutcome({ kind: "unconfigured" });
      else setOutcome({ kind: "failed" });
      setAcceptedStages({});
      setRemoved({});
      setEdits({});
    });
  }

  function acceptStage(stage: StageSuggestion) {
    if (outcome.kind !== "ready") return;
    start(async () => {
      const result = await acceptStageAction(openingId, stagePayloadFrom(stage, outcome.draft.competencies, acceptedIds));
      if (result.ok) setAcceptedStages((s) => ({ ...s, [stage.key]: result.stageId }));
      else setMessage(t("acceptFailed"));
    });
  }

  function undoStage(key: string) {
    const stageId = acceptedStages[key];
    start(async () => {
      const result = await removeAcceptedStageAction(openingId, stageId);
      if (result.ok) setAcceptedStages((s) => without(s, key));
    });
  }

  function acceptCompetency(c: CompetencySuggestion) {
    start(async () => {
      const result = await acceptCompetencyAction(openingId, {
        name: { tr: c.nameTr, en: c.nameEn },
        description: { tr: c.descriptionTr, en: c.descriptionEn },
        anchors: { 1: { tr: c.anchor1Tr, en: c.anchor1En }, 3: { tr: c.anchor3Tr, en: c.anchor3En }, 5: { tr: c.anchor5Tr, en: c.anchor5En } },
      });
      if (result.ok) setAcceptedCompetencies((s) => ({ ...s, [c.key]: { id: result.id, created: result.created } }));
      else setMessage(t("acceptFailed"));
    });
  }

  function undoCompetency(key: string) {
    const accepted = acceptedCompetencies[key];
    start(async () => {
      const result = await undoCompetencyAction(openingId, accepted.id, accepted.created);
      if (result.ok) setAcceptedCompetencies((s) => without(s, key));
      else setMessage(t("undoBlocked"));
    });
  }

  const stageView = (original: StageSuggestion) => {
    const stage = edits[original.key] ?? original;
    const isAccepted = !!acceptedStages[stage.key];
    const isRemoved = !!removed[stage.key];
    const waiting = visible ? pendingCompetencies(stage, visible.newCompetencies, acceptedIds) : [];
    const acceptReason = !canEdit ? t("noPermission") : waiting.length ? t("acceptFirst", { names: waiting.map((c) => c.nameTr).join(", ") }) : null;
    if (isRemoved) {
      return (
        <Card key={stage.key} className="flex items-center justify-between p-card">
          <span className="text-[13px] text-muted">{t("removed")}</span>
          <Button variant="ghost" size="sm" onClick={() => setRemoved((r) => without(r, stage.key))}>
            {t("restore")}
          </Button>
        </Card>
      );
    }
    return (
      <Card key={stage.key} className="space-y-3 p-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[12px] tracking-[0.06em] text-muted uppercase">{t("stageCard")}</p>
            <h3 className="text-[16px] leading-6 font-semibold text-ink">{stage.nameTr}</h3>
          </div>
          <span className="tnum text-[13px] text-muted">{t("minutes", { minutes: Math.round(stage.durationSeconds / 60) })}</span>
        </div>
        <p className="text-[13px] text-muted">
          <span className="font-medium text-ink">{t("why")}</span> &ldquo;{stage.quote}&rdquo;
        </p>
        <ol className="space-y-3">
          {stage.activities.map((a, i) => (
            <li key={a.key} className="rounded-lg border border-line p-3">
              {editing === stage.key ? (
                <div className="space-y-2">
                  <Label htmlFor={`ai-prompt-${a.key}`}>{t("promptLabel")}</Label>
                  <Textarea
                    id={`ai-prompt-${a.key}`}
                    value={a.promptTr}
                    onChange={(e) =>
                      setEdits((all) => ({
                        ...all,
                        [stage.key]: { ...stage, activities: stage.activities.map((x, j) => (j === i ? { ...x, promptTr: e.target.value } : x)) },
                      }))
                    }
                  />
                </div>
              ) : (
                <p className="text-[14px] text-ink">{a.promptTr}</p>
              )}
              <p className="mt-1 text-[12px] text-muted">{t("measures", { names: a.competencyKeys.map(nameOf).join(", ") || "-" })}</p>
              <p className="mt-1 text-[12px] text-muted">{t("examples", { one: a.example1 || "-", three: a.example3 || "-", five: a.example5 || "-" })}</p>
              <p className="mt-1 text-[12px] text-muted">
                <span className="font-medium">{t("why")}</span> &ldquo;{a.quote}&rdquo;
              </p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          {isAccepted ? (
            <>
              <span role="status" className="text-[13px] text-muted">{t("accepted")}</span>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => undoStage(stage.key)}>
                {t("undo")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" disabled={pending || acceptReason !== null} disabledReason={acceptReason ?? undefined} onClick={() => acceptStage(stage)}>
                {t("accept")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(editing === stage.key ? null : stage.key)}>
                {editing === stage.key ? t("doneEditing") : t("edit")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRemoved((r) => ({ ...r, [stage.key]: true }))}>
                {t("remove")}
              </Button>
              {acceptReason ? <DisabledReason>{acceptReason}</DisabledReason> : null}
            </>
          )}
        </div>
      </Card>
    );
  };

  const anyAccepted = Object.keys(acceptedStages).length > 0;

  return (
    <div className="mt-section space-y-section">
      <p className="text-[13px] text-muted">{t("boundary")}</p>
      <Card className="space-y-field p-card">
        <Label htmlFor="ai-job-ad">{t("jobAd")}</Label>
        <Textarea id="ai-job-ad" rows={10} value={jobAd} disabled={!canEdit} onChange={(e) => setJobAd(e.target.value)} />
        {isJobAdThin(jobAd) ? <p className="text-[13px] text-muted">{t("jobAdThin")}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          {/* One filled button: "Önerileri üret" until something is accepted, then "Kabul edilenlerle kurucuya geç". */}
          <Button variant={anyAccepted ? "secondary" : "primary"} disabled={pending || generateReason !== null} disabledReason={generateReason ?? undefined} onClick={generate}>
            {outcome.kind === "ready" ? t("regenerate") : t("generate")}
          </Button>
          {generateReason ? <DisabledReason>{generateReason}</DisabledReason> : null}
          {anyAccepted ? (
            <Button asChild variant="primary">
              <Link href={`/hiring/openings/${openingId}/assessment/edit`}>{t("toBuilder")}</Link>
            </Button>
          ) : null}
        </div>
      </Card>

      {pending && outcome.kind !== "ready" ? (
        <div className="space-y-3" aria-busy>
          <p className="text-[13px] text-muted">{t("working")}</p>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : null}
      {outcome.kind === "failed" ? <p className="text-[14px] text-ink">{t("failed")}</p> : null}
      {outcome.kind === "unconfigured" ? <p className="text-[14px] text-ink">{t("unconfigured")}</p> : null}
      {message ? <p role="status" className="text-[13px] text-destructive">{message}</p> : null}

      {outcome.kind === "ready" && visible ? (
        <div className="space-y-4">
          {outcome.budgetWarning ? <p className="text-[13px] text-muted">{t("budget", { minutes: Math.round(draftTotalSeconds(outcome.draft) / 60) })}</p> : null}
          {visible.hidden > 0 ? <p className="text-[13px] text-muted">{t("hidden", { count: visible.hidden })}</p> : null}
          {visible.newCompetencies.map((c) => (
            <Card key={c.key} className="space-y-2 p-card">
              <p className="text-[12px] tracking-[0.06em] text-muted uppercase">{t("competencyCard")}</p>
              <h3 className="text-[16px] leading-6 font-semibold text-ink">{c.nameTr}</h3>
              <p className="text-[13px] text-muted">{t("competencyCardNote")}</p>
              <ul className="space-y-1 text-[13px] text-ink-2">
                <li>1 · {c.anchor1Tr}</li>
                <li>3 · {c.anchor3Tr}</li>
                <li>5 · {c.anchor5Tr}</li>
              </ul>
              <p className="text-[12px] text-muted">
                <span className="font-medium">{t("why")}</span> &ldquo;{c.quote}&rdquo;
              </p>
              <div className="flex gap-2">
                {acceptedCompetencies[c.key] ? (
                  <>
                    <span role="status" className="text-[13px] text-muted">{t("accepted")}</span>
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => undoCompetency(c.key)}>
                      {t("undo")}
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" disabled={pending || !canEdit} disabledReason={canEdit ? undefined : t("noPermission")} onClick={() => acceptCompetency(c)}>
                    {t("accept")}
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {visible.stages.map(stageView)}
        </div>
      ) : null}
    </div>
  );
}
```

Create `src/app/(manager)/hiring/openings/[id]/assessment/ai/page.tsx`:

```tsx
import { AiDraft } from "@/components/hiring/ai/ai-draft";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { pickText } from "@/lib/i18n-text";
import { activeCompetencyOptions, loadPosition } from "@/server/library";
import { openingFor } from "../../access";
import { AssessmentTabs, OpeningHeader } from "../../opening-header";

export const dynamic = "force-dynamic";

export default async function AiDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const [position, options] = await Promise.all([loadPosition(user.orgId, opening.positionId), activeCompetencyOptions(user.orgId)]);
  return (
    <main className="mx-auto max-w-[1080px] px-page py-8">
      <OpeningHeader opening={opening} active="assessment" locale={locale} t={t} />
      <div className="mt-4">
        <AssessmentTabs openingId={opening.id} active="ai" t={t} />
      </div>
      <AiDraft
        openingId={opening.id}
        initialJobAd={position?.jobDescription ?? ""}
        libraryNames={Object.fromEntries(options.map((o) => [o.id, pickText(o.name, locale)]))}
        canEdit={access.edit}
      />
    </main>
  );
}
```

- [ ] **Step 7: Gates, build, a live run**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
In Chrome (dev server on `kademe_platform`, `.env` has the Gemini key): open the AI-start opening from Task 13. The job ad is prefilled. "Önerileri üret" shows the waiting copy and skeleton cards, then cards: each with "Neden?" quoting the ad, the competencies it measures and the 1/3/5 examples. Nothing appears in the builder yet. A stage measuring a new competency shows "Önce şu yetkinliği kabul et: X." until that card is accepted. Accept one stage: "Kabul edildi." and the filled button becomes "Kabul edilenlerle kurucuya geç"; "Geri al" removes it from the builder; accept again and go to the builder: the stage is there with its questions, competencies and examples. Check the log:
```bash
docker exec kademe-db psql -U kademe -d kademe_platform -Atc "select purpose, error is null, at from ai_runs where purpose = 'HIRING_DRAFT' order by at desc limit 3"
```
Expected: `HIRING_DRAFT|t|...` (a repair adds a second row). If no key is configured, the screen says "AI bağlı değil..." and the live part is recorded as not verified. Stop the server; close your tabs.

- [ ] **Step 8: Commit**

```bash
git add src/solutions/hiring/ai src/solutions/hiring/server/draft-context.ts src/server/library-write.ts "src/app/(manager)/hiring/openings/[id]/assessment/ai" src/components/hiring/ai src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Draft a hiring assessment from the job ad with AI" -m "HIRING_DRAFT proposes stages, questions with the competencies they measure and 1/3/5 answer examples, and new competencies with anchors, each with a quote from the ad. A card whose quote is not in the ad is not shown; no choice questions are ever proposed; the budget is checked and repaired once; every call is in ai_runs. Cards are accepted, edited or removed one by one and every acceptance can be undone; a stage waits for the new competency it measures. Generating saves the ad onto a position that had none." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 18: Question check (QUESTION_CHECK) in the builder bar

**Files:**
- Create: `src/solutions/hiring/ai/question-check.ts`, `src/solutions/hiring/ai/question-check.test.ts`
- Create: `src/solutions/hiring/ai/question-check-job.ts`
- Create: `src/app/(manager)/hiring/openings/[id]/assessment/edit/check-actions.ts`
- Create: `src/components/hiring/builder/question-check.tsx`
- Modify: `src/app/(manager)/hiring/openings/[id]/assessment/edit/page.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (namespace `hiringCheck`)

**Interfaces:**
- Produces in `ai/question-check`: `type FindingKind = "LEADING" | "DOUBLE" | "PROTECTED" | "VAGUE"`, `type Finding = { activityId: string; kind: FindingKind; excerpt: string; note: string | null; source: "RULE" | "AI" }`, `type CheckedActivity = { id: string; prompt: I18nText }`, `protectedTraitFindings(activities): Finding[]`, `QUESTION_CHECK_JSON_SCHEMA`, `buildQuestionCheckMessages(activities, teamLocale)`, `parseQuestionCheck(text, activities): { ok: true; findings: Finding[] } | { ok: false; problem: string }`, `mergeFindings(rule, ai): Finding[]`.
- Produces in `ai/question-check-job`: `runQuestionCheck(input): Promise<{ status: "OK"; findings: Finding[] } | { status: "UNCONFIGURED" } | { status: "FAILED" }>`.
- Produces action `checkQuestionsAction(openingId)`.

- [ ] **Step 1: Write the failing tests**

Create `src/solutions/hiring/ai/question-check.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildQuestionCheckMessages, mergeFindings, parseQuestionCheck, protectedTraitFindings, type CheckedActivity } from "./question-check";

const q = (id: string, tr: string, en = ""): CheckedActivity => ({ id, prompt: { tr, en } });

describe("question check: the rule part (no network)", () => {
  it.each([
    ["Evli misin, çocuğun var mı?"],
    ["Kaç yaşındasın?"],
    ["Nerelisin?"],
    ["Yaşın kaç?"],
  ])("flags a protected trait in %s", (text) => {
    expect(protectedTraitFindings([q("a", text)]).map((f) => f.kind)).toContain("PROTECTED");
  });

  it("flags the English forms too", () => {
    expect(protectedTraitFindings([q("a", "", "Are you married?")])).toHaveLength(1);
    expect(protectedTraitFindings([q("a", "", "How old are you?")])).toHaveLength(1);
  });

  it("leaves job related questions alone", () => {
    expect(
      protectedTraitFindings([
        q("a", "Bir müşteri şikâyetini nasıl çözdüğünü anlat."),
        q("b", "Ekip arkadaşını dinlediğin ve fikrini değiştirdiğin bir anı anlat."),
        q("c", "", "How do you manage a backlog when priorities change?"),
      ]),
    ).toEqual([]);
  });
});

describe("question check: the AI part", () => {
  const activities = [q("a1", "Bu harika ürünü neden seviyorsun ve ekibe nasıl uyarsın?"), q("a2", "Bir hatanı anlat.")];

  it("asks for suggestions only and never for a judgement of a person", () => {
    const [system] = buildQuestionCheckMessages(activities, "tr");
    expect(system.content).toMatch(/suggestions only/i);
    expect(system.content).toMatch(/never rewrite/i);
  });

  it("keeps findings that quote the question, and drops invented ones", () => {
    const answer = JSON.stringify({
      findings: [
        { activityId: "a1", kind: "LEADING", excerpt: "Bu harika ürünü neden seviyorsun", note: "Cevabı \u2014 önceden veriyor." },
        { activityId: "a1", kind: "DOUBLE", excerpt: "ve ekibe nasıl uyarsın", note: "İki soru." },
        { activityId: "a2", kind: "VAGUE", excerpt: "ilanda olmayan bir cümle", note: "x" },
        { activityId: "ghost", kind: "VAGUE", excerpt: "Bir hatanı", note: "x" },
      ],
    });
    const parsed = parseQuestionCheck(answer, activities);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.findings.map((f) => `${f.activityId}:${f.kind}`)).toEqual(["a1:LEADING", "a1:DOUBLE"]);
    expect(parsed.findings[0].note).not.toContain("\u2014");
    expect(parsed.findings.every((f) => f.source === "AI")).toBe(true);
  });

  it("merges rule and AI findings without repeating one", () => {
    const rule = protectedTraitFindings([q("a", "Evli misin?")]);
    const ai = [{ activityId: "a", kind: "PROTECTED" as const, excerpt: "Evli misin", note: "x", source: "AI" as const }];
    expect(mergeFindings(rule, ai)).toHaveLength(1);
    expect(mergeFindings(rule, ai)[0].source).toBe("RULE");
  });
});
```

Run: `pnpm exec vitest run src/solutions/hiring/ai/question-check.test.ts` - Expected: FAIL with `Cannot find module './question-check'`.

- [ ] **Step 2: Implement the check**

Create `src/solutions/hiring/ai/question-check.ts`:

```ts
import { z } from "zod";
import type { I18nText } from "@/db/schema/types";
import type { Locale } from "@/i18n/locale";
import type { AiMessage } from "@/lib/ai";
import { parseModelJson, withoutEmDash } from "@/lib/ai-json";

/**
 * Question check (HIRING-UX 3.9, 5.5 bar): flags leading, double-barrelled,
 * vague and protected-trait questions. Suggestions only; the person edits the
 * question. The protected-trait part is a word rule that runs without any
 * network call; the AI part (QUESTION_CHECK) adds the judgement calls.
 */
export type FindingKind = "LEADING" | "DOUBLE" | "PROTECTED" | "VAGUE";
export type Finding = { activityId: string; kind: FindingKind; excerpt: string; note: string | null; source: "RULE" | "AI" };
export type CheckedActivity = { id: string; prompt: I18nText };

const PREFIXES: Record<Locale, string[]> = {
  tr: ["evli", "bekar", "bekâr", "hamile", "nereli", "mezhep", "mezheb", "etnik", "engelli", "siyasi", "sendika", "çocuk", "çocuğ", "dini"],
  en: ["married", "marital", "pregnan", "religio", "ethnic", "disabilit", "politic", "union", "children"],
};
const EXACT: Record<Locale, string[]> = { tr: ["din", "yaş", "yaşın", "yaşınız"], en: ["age"] };
const PHRASES: Record<Locale, string[]> = {
  tr: ["kaç yaş", "doğum yılı", "doğum tarih"],
  en: ["how old", "where are you from", "year of birth"],
};

function protectedHit(text: string, locale: Locale): string | null {
  const lower = text.toLocaleLowerCase(locale === "tr" ? "tr" : "en");
  const phrase = PHRASES[locale].find((p) => lower.includes(p));
  if (phrase) return phrase;
  const words = lower.match(/\p{L}+/gu) ?? [];
  return words.find((w) => EXACT[locale].includes(w) || PREFIXES[locale].some((p) => w.startsWith(p))) ?? null;
}

export function protectedTraitFindings(activities: CheckedActivity[]): Finding[] {
  const findings: Finding[] = [];
  for (const a of activities) {
    const hit = protectedHit(a.prompt.tr, "tr") ?? protectedHit(a.prompt.en, "en");
    if (hit) findings.push({ activityId: a.id, kind: "PROTECTED", excerpt: hit, note: null, source: "RULE" });
  }
  return findings;
}

const KINDS = ["LEADING", "DOUBLE", "PROTECTED", "VAGUE"] as const;
const answerSchema = z.object({
  findings: z.array(z.object({ activityId: z.string().max(64), kind: z.enum(KINDS), excerpt: z.string().max(300), note: z.string().max(600) })).max(40),
});

export const QUESTION_CHECK_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["activityId", "kind", "excerpt", "note"],
        properties: {
          activityId: { type: "string" },
          kind: { type: "string", enum: [...KINDS] },
          excerpt: { type: "string" },
          note: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You review interview questions written by a hiring team. You give suggestions only; the team decides and edits.

Flag a question when:
- LEADING: it suggests the expected answer or praises something the candidate must then defend.
- DOUBLE: it asks two things at once.
- PROTECTED: it touches age, gender, marital or family status, pregnancy, health or disability, religion, ethnicity, origin, sexual orientation, political views or union membership.
- VAGUE: a reasonable candidate could not tell what a good answer covers.

Rules:
- "excerpt" is copied word for word from the question.
- "note" says in one sentence, in the team language, what to change. Never rewrite the question for the team, and never judge a candidate.
- Return an empty list when nothing needs flagging.
- Never use the em dash character.`;

export function buildQuestionCheckMessages(activities: CheckedActivity[], teamLocale: Locale): AiMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `Team language: ${teamLocale === "en" ? "English" : "Türkçe"}.`,
        "Questions (activityId | TR | EN):",
        ...activities.map((a) => `- ${a.id} | ${a.prompt.tr} | ${a.prompt.en}`),
      ].join("\n"),
    },
  ];
}

const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();

/** Drops findings about unknown questions and excerpts the question does not contain. */
export function parseQuestionCheck(text: string, activities: CheckedActivity[]): { ok: true; findings: Finding[] } | { ok: false; problem: string } {
  const json = parseModelJson(text);
  if (!json.ok) return json;
  const parsed = answerSchema.safeParse(json.value);
  if (!parsed.success) return { ok: false, problem: parsed.error.issues.slice(0, 4).map((i) => i.message).join("; ") };
  const byId = new Map(activities.map((a) => [a.id, a]));
  const findings = parsed.data.findings.flatMap((f): Finding[] => {
    const a = byId.get(f.activityId);
    const excerpt = norm(f.excerpt);
    if (!a || excerpt.length < 3) return [];
    if (!norm(a.prompt.tr).includes(excerpt) && !norm(a.prompt.en).includes(excerpt)) return [];
    return [{ activityId: f.activityId, kind: f.kind, excerpt: f.excerpt.trim(), note: withoutEmDash(f.note.trim()) || null, source: "AI" }];
  });
  return { ok: true, findings };
}

export function mergeFindings(rule: Finding[], ai: Finding[]): Finding[] {
  const seen = new Set(rule.map((f) => `${f.activityId}:${f.kind}`));
  return [...rule, ...ai.filter((f) => !seen.has(`${f.activityId}:${f.kind}`))];
}
```

Run: `pnpm exec vitest run src/solutions/hiring/ai/question-check.test.ts` - Expected: PASS.

- [ ] **Step 3: Write the logged call and the action**

Create `src/solutions/hiring/ai/question-check-job.ts`:

```ts
import type { Locale } from "@/i18n/locale";
import { getAiProvider } from "@/lib/ai";
import { callJson } from "@/lib/ai-runs";
import { buildQuestionCheckMessages, parseQuestionCheck, QUESTION_CHECK_JSON_SCHEMA, type CheckedActivity, type Finding } from "./question-check";

/** One QUESTION_CHECK call, logged in ai_runs; a broken answer is dropped, not repaired (the rule part still stands). */
export async function runQuestionCheck(input: {
  orgId: string;
  userId: string;
  openingId: string;
  activities: CheckedActivity[];
  teamLocale: Locale;
}): Promise<{ status: "OK"; findings: Finding[] } | { status: "UNCONFIGURED" } | { status: "FAILED" }> {
  if (!getAiProvider().available) return { status: "UNCONFIGURED" };
  if (input.activities.length === 0) return { status: "OK", findings: [] };
  try {
    const { response } = await callJson("kademe_question_check", QUESTION_CHECK_JSON_SCHEMA, buildQuestionCheckMessages(input.activities, input.teamLocale), {
      orgId: input.orgId,
      purpose: "QUESTION_CHECK",
      inputRef: input.openingId,
      requestedBy: input.userId,
    });
    const parsed = parseQuestionCheck(response.text, input.activities);
    return parsed.ok ? { status: "OK", findings: parsed.findings } : { status: "FAILED" };
  } catch {
    return { status: "FAILED" };
  }
}
```

Create `src/app/(manager)/hiring/openings/[id]/assessment/edit/check-actions.ts`:

```ts
"use server";

import { managerLocale } from "@/i18n/manager-locale";
import { hasText } from "@/lib/library/anchors";
import { runQuestionCheck } from "@/solutions/hiring/ai/question-check-job";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../../access";

/** "AI ile kontrol et": suggestions about the draft's questions; nothing is written. */
export async function checkQuestionsAction(openingId: string) {
  const { user } = await openingFor(openingId, "edit");
  const state = await workingState(user.orgId, openingId);
  const activities = (state.content?.stages ?? []).flatMap((s) => s.activities.filter((a) => hasText(a.prompt)).map((a) => ({ id: a.id, prompt: a.prompt })));
  return runQuestionCheck({ orgId: user.orgId, userId: user.id, openingId, activities, teamLocale: await managerLocale() });
}
```

- [ ] **Step 4: Add the copy**

Add to `hiring.tr.json`:

```json
  "hiringCheck": {
    "count": "Soru kontrolü: {count} öneri",
    "label": "Öneriler; soruyu sen değiştirirsin. Kural kontrolü her zaman çalışır, AI kontrolü isteğe bağlıdır.",
    "none": "Şu an bir öneri yok.",
    "kindLEADING": "Yönlendirici soru",
    "kindDOUBLE": "İki soruyu birleştiriyor",
    "kindPROTECTED": "Korunan bir özelliğe dokunuyor olabilir",
    "kindVAGUE": "Belirsiz ifade",
    "sourceRULE": "Kural",
    "sourceAI": "AI",
    "runAi": "AI ile kontrol et",
    "running": "Kontrol ediliyor",
    "failed": "AI kontrolü yapılamadı; kural kontrolü geçerli.",
    "unconfigured": "AI bağlı değil; yalnızca kural kontrolü çalışıyor.",
    "goTo": "Soruya git"
  }
```

and to `hiring.en.json`:

```json
  "hiringCheck": {
    "count": "Question check: {count, plural, one {# suggestion} other {# suggestions}}",
    "label": "Suggestions; you change the question. The rule check always runs, the AI check is optional.",
    "none": "No suggestions right now.",
    "kindLEADING": "Leading question",
    "kindDOUBLE": "Asks two things at once",
    "kindPROTECTED": "May touch a protected characteristic",
    "kindVAGUE": "Vague wording",
    "sourceRULE": "Rule",
    "sourceAI": "AI",
    "runAi": "Check with AI",
    "running": "Checking",
    "failed": "The AI check could not run; the rule check stands.",
    "unconfigured": "AI is not connected; only the rule check runs.",
    "goTo": "Go to the question"
  }
```

- [ ] **Step 5: Write the bar component and wire it in**

Create `src/components/hiring/builder/question-check.tsx`:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMT } from "@/i18n/manager-client";
import { mergeFindings, protectedTraitFindings, type CheckedActivity, type Finding } from "@/solutions/hiring/ai/question-check";
import { checkQuestionsAction } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/check-actions";

/** "Soru kontrolü: 1 öneri" (HIRING-UX 5.5): rule findings live, AI findings on request; never applied by itself. */
export function QuestionCheck({
  openingId,
  activities,
  labels,
  canRun,
}: {
  openingId: string;
  activities: CheckedActivity[];
  labels: Record<string, string>;
  canRun: boolean;
}) {
  const t = useMT("hiringCheck");
  const rule = useMemo(() => protectedTraitFindings(activities), [activities]);
  const [ai, setAi] = useState<Finding[]>([]);
  const [state, setState] = useState<"idle" | "failed" | "unconfigured">("idle");
  const [pending, start] = useTransition();
  const findings = mergeFindings(rule, ai);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="tnum">
          {t("count", { count: findings.length })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] space-y-3" align="start">
        <p className="text-[12px] text-muted">{t("label")}</p>
        {findings.length === 0 ? (
          <p className="text-[13px] text-ink">{t("none")}</p>
        ) : (
          <ul className="space-y-3">
            {findings.map((f) => (
              <li key={`${f.activityId}:${f.kind}`} className="space-y-1">
                <p className="text-[13px] font-medium text-ink">
                  {labels[f.activityId] ?? ""} · {t(`kind${f.kind}`)} · <span className="text-muted">{t(`source${f.source}`)}</span>
                </p>
                <p className="text-[13px] text-muted">&ldquo;{f.excerpt}&rdquo;</p>
                {f.note ? <p className="text-[13px] text-ink-2">{f.note}</p> : null}
                <Link
                  href={`/hiring/openings/${openingId}/assessment/edit?activity=${f.activityId}`}
                  className="text-[13px] font-medium text-ink underline decoration-underline underline-offset-2"
                >
                  {t("goTo")}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {canRun ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await checkQuestionsAction(openingId);
                if (result.status === "OK") {
                  setAi(result.findings);
                  setState("idle");
                } else setState(result.status === "UNCONFIGURED" ? "unconfigured" : "failed");
              })
            }
          >
            {pending ? t("running") : t("runAi")}
          </Button>
        ) : null}
        {state !== "idle" ? <p className="text-[13px] text-muted">{t(state)}</p> : null}
      </PopoverContent>
    </Popover>
  );
}
```

In `src/app/(manager)/hiring/openings/[id]/assessment/edit/page.tsx`: import `QuestionCheck`; before `return`, build

```tsx
  const checked = state.content.stages.flatMap((s) => s.activities.map((a) => ({ id: a.id, prompt: a.prompt })));
  const labels = Object.fromEntries(
    state.content.stages.flatMap((s, si) => s.activities.map((a, ai) => [a.id, t("hiringGate.activityLabel", { stage: si + 1, n: ai + 1 })])),
  );
```

and pass to `<Builder ...>` the props `key={sp.activity ?? sp.stage ?? "start"}` (so "Soruya git" re-selects) and `checkSlot={state.draft ? <QuestionCheck openingId={opening.id} activities={checked} labels={labels} canRun={access.edit} /> : null}`.

- [ ] **Step 6: Gates, build, live check, commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
In Chrome: in the v2 draft write a question "Evli misin ve kaç yaşındasın?": after the save the bar shows "Soru kontrolü: 1 öneri" without any network call (the Network panel shows no `QUESTION_CHECK` request); open it: "Korunan bir özelliğe dokunuyor olabilir · Kural", "Soruya git" selects that question. "AI ile kontrol et" adds AI findings (or says AI is not connected); the question text is unchanged until you edit it. Confirm `select purpose from ai_runs where purpose = 'QUESTION_CHECK'` has a row after the AI run. Stop the server; close your tabs.

```bash
git add src/solutions/hiring/ai/question-check.ts src/solutions/hiring/ai/question-check.test.ts src/solutions/hiring/ai/question-check-job.ts "src/app/(manager)/hiring/openings/[id]/assessment/edit" src/components/hiring/builder/question-check.tsx src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Check interview questions in the builder" -m "A word rule flags questions that touch protected characteristics as you type, with no network call; QUESTION_CHECK adds leading, double and vague findings on request, logged in ai_runs. Findings whose excerpt is not in the question are dropped. Everything is a suggestion with a link to the question; nothing is rewritten." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Candidate preview (`/assessment/preview`)

**Files:**
- Modify: `src/solutions/hiring/server/versions.ts` (`markPreviewed`)
- Create: `src/app/(manager)/hiring/openings/[id]/assessment/preview/actions.ts`, `preview/page.tsx`
- Create: `src/components/hiring/preview/preview.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (namespace `hiringPreview`)

**Interfaces:**
- Consumes: `toCandidateVersion` (Task 10), `candidateSafe` (`@/lib/candidate-safe`).
- Produces: `markPreviewed(orgId, openingId): Promise<void>` (stamps the draft only), action `markPreviewedAction(openingId)`.

- [ ] **Step 1: Add the stamp and the action**

Append to `src/solutions/hiring/server/versions.ts`:

```ts
/** "Önizleme yapıldı" (HIRING-UX 5.4). Only a draft is stamped; a published version is frozen. */
export async function markPreviewed(orgId: string, openingId: string): Promise<void> {
  await db
    .update(hiringVersions)
    .set({ previewedAt: new Date() })
    .where(and(eq(hiringVersions.openingId, openingId), eq(hiringVersions.orgId, orgId), eq(hiringVersions.status, "DRAFT")));
}
```

Create `src/app/(manager)/hiring/openings/[id]/assessment/preview/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { markPreviewed } from "@/solutions/hiring/server/versions";
import { openingFor } from "../../access";

/** Called once when an editor opens the preview; a reviewer's visit stamps nothing. */
export async function markPreviewedAction(openingId: string) {
  const { user, access } = await openingFor(openingId, "view");
  if (!access.edit) return;
  await markPreviewed(user.orgId, openingId);
  revalidatePath("/hiring/openings/[id]", "page");
}
```

- [ ] **Step 2: Add the copy**

Add to `hiring.tr.json`:

```json
  "hiringPreview": {
    "strip": "Önizleme · cevaplar kaydedilmez · kamera açılmaz",
    "mobile": "Mobil görünüm",
    "back": "Kurucuya dön",
    "language": "Değerlendirme dili",
    "introBody": "{stages} aşama · yaklaşık {minutes} dakika",
    "stageOf": "Aşama {n} / {total}",
    "stageTime": "Bu aşama için {minutes} dakika",
    "stageMinutes": "{minutes} dk",
    "start": "Başla",
    "next": "Sonraki",
    "finishStage": "Aşamayı bitir",
    "finish": "Bitir",
    "doneTitle": "Bitti, teşekkürler.",
    "doneBody": "Önizleme burada biter. Gerçek aday burada tarihli bir geri dönüş sözü ve bir insanın e-postasını görür.",
    "think": "Düşünme süresi: {seconds} sn",
    "thinkFlexible": "Düşünme süresi: {seconds} sn; süre bitince kayıt kendiliğinden başlamaz.",
    "answer": "Cevap süresi: {seconds} sn",
    "takesNone": "Tekrar hakkı yok",
    "takes": "{count} tekrar hakkın var",
    "cameraOff": "Kamera önizlemede açılmaz.",
    "textAlternative": "Kayıt yapamıyorsan yazılı cevap verebilirsin.",
    "chars": "En az {min}, en fazla {max} karakter",
    "files": "Dosya yükle · en fazla {mb} MB",
    "pickFile": "Dosya seç",
    "optional": "İsteğe bağlı",
    "empty": "Önizlenecek bir şey yok. Önce kurucuda bir aşama ve soru ekle."
  }
```

and to `hiring.en.json`:

```json
  "hiringPreview": {
    "strip": "Preview · answers are not saved · the camera stays off",
    "mobile": "Mobile view",
    "back": "Back to the builder",
    "language": "Assessment language",
    "introBody": "{stages, plural, one {# stage} other {# stages}} · about {minutes} minutes",
    "stageOf": "Stage {n} of {total}",
    "stageTime": "{minutes} minutes for this stage",
    "stageMinutes": "{minutes} min",
    "start": "Start",
    "next": "Next",
    "finishStage": "Finish the stage",
    "finish": "Finish",
    "doneTitle": "Done, thank you.",
    "doneBody": "The preview ends here. A real candidate sees a dated reply promise and a person's email here.",
    "think": "Thinking time: {seconds} s",
    "thinkFlexible": "Thinking time: {seconds} s; recording does not start by itself when it ends.",
    "answer": "Answer time: {seconds} s",
    "takesNone": "No retake",
    "takes": "{count, plural, one {# retake} other {# retakes}} left",
    "cameraOff": "The camera stays off in the preview.",
    "textAlternative": "If you cannot record, you can answer in writing.",
    "chars": "At least {min}, at most {max} characters",
    "files": "Upload a file · up to {mb} MB",
    "pickFile": "Choose a file",
    "optional": "Optional",
    "empty": "Nothing to preview yet. Add a stage and a question in the builder first."
  }
```

- [ ] **Step 3: Write the preview**

Create `src/components/hiring/preview/preview.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { pickText } from "@/lib/i18n-text";
import type { CandidateActivity, CandidateVersion } from "@/solutions/hiring/rules/candidate-view";
import { markPreviewedAction } from "@/app/(manager)/hiring/openings/[id]/assessment/preview/actions";

type Step = { kind: "intro" } | { kind: "stage"; stage: number } | { kind: "activity"; stage: number; activity: number } | { kind: "done" };

function steps(version: CandidateVersion): Step[] {
  return [
    { kind: "intro" },
    ...version.stages.flatMap((s, si): Step[] => [{ kind: "stage", stage: si }, ...s.activities.map((_, ai): Step => ({ kind: "activity", stage: si, activity: ai }))]),
    { kind: "done" },
  ];
}

/**
 * HIRING-UX 5.8: the candidate's flow built only from the candidate view
 * (toCandidateVersion through candidateSafe), so "what the candidate sees" is
 * shown, not claimed. Nothing is saved, the camera never starts; the filled
 * button belongs to the candidate's frame, not to the strip.
 */
export function Preview({ openingId, openingName, version, defaultLocale }: { openingId: string; openingName: string; version: CandidateVersion; defaultLocale: Locale }) {
  const t = useMT("hiringPreview");
  const [index, setIndex] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [lang, setLang] = useState<Locale>(defaultLocale);
  const all = steps(version);
  const step = all[index];
  const text = (v: { tr: string; en: string }) => pickText(v, lang);

  useEffect(() => {
    void markPreviewedAction(openingId);
  }, [openingId]);

  const primaryLabel =
    step.kind === "intro"
      ? t("start")
      : step.kind === "done"
        ? null
        : step.kind === "activity" && step.activity === version.stages[step.stage].activities.length - 1
          ? step.stage === version.stages.length - 1
            ? t("finish")
            : t("finishStage")
          : t("next");

  function body(): React.ReactNode {
    if (version.stages.length === 0) return <p className="text-[16px] text-ink">{t("empty")}</p>;
    if (step.kind === "intro") {
      return (
        <div className="space-y-3">
          <h1 className="text-[28px] leading-9 font-semibold text-ink">{openingName}</h1>
          <p className="tnum text-[16px] text-ink-2">{t("introBody", { stages: version.stages.length, minutes: Math.round(version.totalSeconds / 60) })}</p>
          <ol className="space-y-2">
            {version.stages.map((s, i) => (
              <li key={s.id} className="tnum text-[16px] text-ink">
                {i + 1}. {text(s.name)} · {t("stageMinutes", { minutes: Math.round(s.durationSeconds / 60) })}
              </li>
            ))}
          </ol>
        </div>
      );
    }
    if (step.kind === "done") {
      return (
        <div className="space-y-2">
          <h1 className="text-[28px] leading-9 font-semibold text-ink">{t("doneTitle")}</h1>
          <p className="text-[16px] text-ink-2">{t("doneBody")}</p>
        </div>
      );
    }
    const stage = version.stages[step.stage];
    if (step.kind === "stage") {
      return (
        <div className="space-y-3">
          <p className="tnum text-[14px] text-muted">{t("stageOf", { n: step.stage + 1, total: version.stages.length })}</p>
          <h1 className="text-[28px] leading-9 font-semibold text-ink">{text(stage.name)}</h1>
          {text(stage.description) ? <p className="text-[16px] text-ink-2">{text(stage.description)}</p> : null}
          <p className="tnum text-[16px] text-ink">{t("stageTime", { minutes: Math.round(stage.durationSeconds / 60) })}</p>
        </div>
      );
    }
    return <ActivityView activity={stage.activities[step.activity]} lang={lang} />;
  }

  return (
    <div className="mt-section space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3">
        <span className="text-[13px] font-medium text-ink">{t("strip")}</span>
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <Switch checked={mobile} onCheckedChange={setMobile} />
          {t("mobile")}
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink">
          {t("language")}
          <Button variant="ghost" size="xs" aria-pressed={lang === "tr"} onClick={() => setLang("tr")}>
            TR
          </Button>
          <Button variant="ghost" size="xs" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            EN
          </Button>
        </label>
        <Link href={`/hiring/openings/${openingId}/assessment/edit`} className="ml-auto text-[13px] font-medium text-ink underline decoration-underline underline-offset-2">
          {t("back")}
        </Link>
      </div>
      <div className={cn("mx-auto rounded-2xl border border-line bg-paper", mobile ? "w-[390px] p-5" : "max-w-[1000px] p-card-candidate")} lang={lang}>
        <div className="mb-6 h-1 rounded-full bg-hairline" aria-hidden>
          <div className="h-1 rounded-full bg-ink-3" style={{ width: `${Math.round((index / Math.max(1, all.length - 1)) * 100)}%` }} />
        </div>
        {body()}
        {primaryLabel && version.stages.length > 0 ? (
          <div className="mt-8 flex justify-end">
            <Button variant="primary" size="lg" onClick={() => setIndex((i) => Math.min(all.length - 1, i + 1))}>
              {primaryLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActivityView({ activity, lang }: { activity: CandidateActivity; lang: Locale }) {
  const t = useMT("hiringPreview");
  const text = (v: { tr: string; en: string }) => pickText(v, lang);
  const recorded = activity.type === "VIDEO" || activity.type === "AUDIO";
  return (
    <div className="space-y-4">
      {!activity.required ? <p className="text-[13px] text-muted">{t("optional")}</p> : null}
      <p className={cn("text-ink", recorded ? "text-[22px] leading-8 font-medium" : "text-[18px] leading-7")}>{text(activity.prompt)}</p>
      {text(activity.note) ? <p className="text-[16px] text-ink-2">{text(activity.note)}</p> : null}
      {recorded ? (
        <div className="space-y-2">
          <div className="grid h-[220px] place-items-center rounded-xl bg-panel text-[14px] text-vault-label">{t("cameraOff")}</div>
          <p className="tnum text-[14px] text-ink">{activity.flexibleThink ? t("thinkFlexible", { seconds: activity.thinkSeconds }) : t("think", { seconds: activity.thinkSeconds })}</p>
          {activity.answerSeconds ? <p className="tnum text-[14px] text-ink">{t("answer", { seconds: activity.answerSeconds })}</p> : null}
          <p className="tnum text-[14px] text-ink">{activity.maxTakes > 1 ? t("takes", { count: activity.maxTakes - 1 }) : t("takesNone")}</p>
          {activity.textAlternativeEnabled ? <p className="text-[14px] text-ink-2">{t("textAlternative")}</p> : null}
        </div>
      ) : null}
      {activity.type === "LONG_TEXT" || activity.type === "SHORT_TEXT" ? (
        <div className="space-y-1">
          <Textarea rows={activity.type === "LONG_TEXT" ? 8 : 3} aria-label={text(activity.prompt)} />
          <p className="tnum text-[13px] text-muted">{t("chars", { min: activity.minChars ?? 0, max: activity.maxChars ?? 0 })}</p>
        </div>
      ) : null}
      {activity.type === "SINGLE_CHOICE" && activity.choices ? (
        <RadioGroup className="space-y-2">
          {activity.choices.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-4 text-[16px] text-ink">
              <RadioGroupItem value={c.id} />
              {text(c.label)}
            </label>
          ))}
        </RadioGroup>
      ) : null}
      {activity.type === "MULTI_CHOICE" && activity.choices ? (
        <div className="space-y-2">
          {activity.choices.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-4 text-[16px] text-ink">
              <Checkbox />
              {text(c.label)}
            </label>
          ))}
        </div>
      ) : null}
      {activity.type === "FILE_UPLOAD" ? (
        <div className="space-y-2">
          <p className="tnum text-[14px] text-ink">{t("files", { mb: Math.round((activity.maxFileBytes ?? 0) / 1024 / 1024) })}</p>
          <Button variant="secondary" disabled disabledReason={t("strip")}>
            {t("pickFile")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
```

Create `src/app/(manager)/hiring/openings/[id]/assessment/preview/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Preview } from "@/components/hiring/preview/preview";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { candidateSafe } from "@/lib/candidate-safe";
import { toCandidateVersion } from "@/solutions/hiring/rules/candidate-view";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../../access";
import { AssessmentTabs, OpeningHeader } from "../../opening-header";

export const dynamic = "force-dynamic";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, opening } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const state = await workingState(user.orgId, opening.id);
  if (!state.content) notFound();
  // The same whitelist plan 2's candidate API uses, then the generic last line of defence.
  const version = candidateSafe(toCandidateVersion(state.content));
  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="assessment" locale={locale} t={t} />
      <div className="mt-4">
        <AssessmentTabs openingId={opening.id} active="preview" t={t} />
      </div>
      <Preview openingId={opening.id} openingName={opening.name} version={version} defaultLocale={state.content.defaultLocale} />
    </main>
  );
}
```

(The disabled "Dosya seç" carries its reason through `disabledReason`, and the strip above states the same reason in words on every screen of the preview.)

- [ ] **Step 4: Gates, build, browser check, commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
In Chrome: open the preview of the v2 draft; walk intro, stage intro, each question type, the end screen; toggle "Mobil görünüm" (390px frame) and EN. Then save the page HTML from the page (Claude in Chrome `get_page_text` or `javascript_tool` returning `document.documentElement.outerHTML`) and search it for the internal sentinel texts you typed into "Amaç", "Kırmızı bayraklar", the 1/3/5 examples and for the word `correct`: none may appear. Back on the overview, "Önizleme yapıldı" is done. Stop the server; close your tabs.

```bash
git add src/solutions/hiring/server/versions.ts "src/app/(manager)/hiring/openings/[id]/assessment/preview" src/components/hiring/preview src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Add the candidate preview" -m "HIRING-UX 5.8: the candidate's flow (intro, stage intros, every question type, end screen) rendered only from the candidate view whitelist passed through candidateSafe, with a strip saying nothing is saved and the camera stays off, a 390px mobile frame and a language switch. Opening it as an editor marks the draft as previewed." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Team and rules (`/hiring/openings/[id]/settings`)

**Files:**
- Create: `src/solutions/hiring/rules/opening-rules.ts`, `src/solutions/hiring/rules/opening-rules.test.ts`
- Modify: `src/solutions/hiring/server/openings.ts` (`saveOpeningRules`, `setOpeningClosed`)
- Create: `src/app/(manager)/hiring/openings/[id]/settings/actions.ts`, `settings/page.tsx`
- Create: `src/components/hiring/opening-settings-form.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (namespace `hiringSettings`)

**Interfaces:**
- Produces in `rules/opening-rules`: `type OpeningRulesInput = { name: string; memberIds: string[]; decisionMakerId: string | null; backupDecisionMakerId: string | null; minEvaluations: number; blindMode: boolean; deadline: string | null; feedbackDays: number; candidateContactEmail: string }`, `type RulesProblem`, `openingRulesProblems(input, users: Array<{ id: string; role: "OWNER" | "MANAGER" | "REVIEWER"; disabled: boolean }>, today: string): RulesProblem[]`, `deadlineToDate(day: string): Date`.
- Produces in `server/openings`: `saveOpeningRules(orgId, actorId, openingId, input): Promise<{ ok: true } | { ok: false; problems: RulesProblem[] }>`, `setOpeningClosed(orgId, actorId, openingId, closed: boolean): Promise<void>`.

- [ ] **Step 1: Write the failing rules test**

Create `src/solutions/hiring/rules/opening-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deadlineToDate, openingRulesProblems, type OpeningRulesInput } from "./opening-rules";

const users = [
  { id: "owner", role: "OWNER" as const, disabled: false },
  { id: "manager", role: "MANAGER" as const, disabled: false },
  { id: "reviewer", role: "REVIEWER" as const, disabled: false },
  { id: "gone", role: "MANAGER" as const, disabled: true },
];
const ok: OpeningRulesInput = {
  name: "Tasarımcı · Ekim",
  memberIds: ["reviewer", "manager"],
  decisionMakerId: "owner",
  backupDecisionMakerId: "manager",
  minEvaluations: 2,
  blindMode: false,
  deadline: "2026-10-31",
  feedbackDays: 7,
  candidateContactEmail: "ik@example.com",
};

describe("opening rules (HIRING-UX 5.18, 4.6)", () => {
  it("accepts a complete set of rules", () => {
    expect(openingRulesProblems(ok, users, "2026-10-04")).toEqual([]);
  });

  it("needs a decision maker who is an active owner or manager, and a different backup", () => {
    expect(openingRulesProblems({ ...ok, decisionMakerId: null }, users, "2026-10-04")).toContain("DECISION_MAKER_REQUIRED");
    expect(openingRulesProblems({ ...ok, decisionMakerId: "reviewer" }, users, "2026-10-04")).toContain("DECISION_MAKER_ROLE");
    expect(openingRulesProblems({ ...ok, decisionMakerId: "gone" }, users, "2026-10-04")).toContain("DECISION_MAKER_ROLE");
    expect(openingRulesProblems({ ...ok, backupDecisionMakerId: "owner" }, users, "2026-10-04")).toContain("BACKUP_SAME");
    expect(openingRulesProblems({ ...ok, backupDecisionMakerId: "reviewer" }, users, "2026-10-04")).toContain("BACKUP_ROLE");
  });

  it("lets anyone active be an evaluator", () => {
    expect(openingRulesProblems({ ...ok, memberIds: ["gone"] }, users, "2026-10-04")).toContain("MEMBER_UNKNOWN");
    expect(openingRulesProblems({ ...ok, memberIds: ["nobody"] }, users, "2026-10-04")).toContain("MEMBER_UNKNOWN");
  });

  it("keeps the numbers, the date and the address in range", () => {
    const problems = openingRulesProblems(
      { ...ok, name: " ", minEvaluations: 6, feedbackDays: 0, deadline: "2026-10-03", candidateContactEmail: "not-an-address" },
      users,
      "2026-10-04",
    );
    expect(problems).toEqual(["NAME_REQUIRED", "MIN_EVALUATIONS", "FEEDBACK_DAYS", "DEADLINE_PAST", "EMAIL"]);
    expect(openingRulesProblems({ ...ok, deadline: null, candidateContactEmail: "" }, users, "2026-10-04")).toEqual([]);
  });

  it("turns a deadline day into the end of that day in Istanbul", () => {
    expect(deadlineToDate("2026-10-31").toISOString()).toBe("2026-10-31T20:59:59.000Z");
  });
});
```

Run: `pnpm exec vitest run src/solutions/hiring/rules/opening-rules.test.ts` - Expected: FAIL with `Cannot find module './opening-rules'`.

- [ ] **Step 2: Implement the rules**

Create `src/solutions/hiring/rules/opening-rules.ts`:

```ts
import { canDecide } from "./access";

export type OpeningRulesInput = {
  name: string;
  memberIds: string[];
  decisionMakerId: string | null;
  backupDecisionMakerId: string | null;
  minEvaluations: number;
  blindMode: boolean;
  /** YYYY-MM-DD in the organisation's time zone, or null for no deadline. */
  deadline: string | null;
  feedbackDays: number;
  candidateContactEmail: string;
};

export type RulesProblem =
  | "NAME_REQUIRED"
  | "DECISION_MAKER_REQUIRED"
  | "DECISION_MAKER_ROLE"
  | "BACKUP_SAME"
  | "BACKUP_ROLE"
  | "MEMBER_UNKNOWN"
  | "MIN_EVALUATIONS"
  | "FEEDBACK_DAYS"
  | "DEADLINE_PAST"
  | "EMAIL";

type PanelUser = { id: string; role: "OWNER" | "MANAGER" | "REVIEWER"; disabled: boolean };

/** HIRING-UX 5.18 and 4.6, shared by the form (the disabled reason) and the server (the refusal). */
export function openingRulesProblems(input: OpeningRulesInput, users: PanelUser[], today: string): RulesProblem[] {
  const problems: RulesProblem[] = [];
  const active = (id: string | null) => users.find((u) => u.id === id && !u.disabled) ?? null;
  if (!input.name.trim()) problems.push("NAME_REQUIRED");
  if (!input.decisionMakerId) problems.push("DECISION_MAKER_REQUIRED");
  else {
    const dm = active(input.decisionMakerId);
    if (!dm || !canDecide(dm.role)) problems.push("DECISION_MAKER_ROLE");
  }
  if (input.backupDecisionMakerId) {
    if (input.backupDecisionMakerId === input.decisionMakerId) problems.push("BACKUP_SAME");
    else {
      const backup = active(input.backupDecisionMakerId);
      if (!backup || !canDecide(backup.role)) problems.push("BACKUP_ROLE");
    }
  }
  if (input.memberIds.some((id) => !active(id))) problems.push("MEMBER_UNKNOWN");
  if (!Number.isInteger(input.minEvaluations) || input.minEvaluations < 1 || input.minEvaluations > 5) problems.push("MIN_EVALUATIONS");
  if (!Number.isInteger(input.feedbackDays) || input.feedbackDays < 1 || input.feedbackDays > 60) problems.push("FEEDBACK_DAYS");
  if (input.deadline && input.deadline < today) problems.push("DEADLINE_PAST");
  const email = input.candidateContactEmail.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("EMAIL");
  return problems;
}

/** The end of the deadline day in Europe/Istanbul (UTC+3 all year). */
export function deadlineToDate(day: string): Date {
  return new Date(`${day}T23:59:59+03:00`);
}
```

Run: `pnpm exec vitest run src/solutions/hiring/rules/opening-rules.test.ts` - Expected: PASS.

- [ ] **Step 3: Add the server writes**

Append to `src/solutions/hiring/server/openings.ts` (imports: `loadPanelUsers` from `@/server/settings`, `openingRulesProblems, deadlineToDate, type OpeningRulesInput, type RulesProblem` from `../rules/opening-rules`, `HiringNotFound` from `./errors`):

```ts
/** HIRING-UX 5.18 "Kaydet": team, fairness and candidate contact, checked with the same rules as the form. */
export async function saveOpeningRules(
  orgId: string,
  actorId: string,
  openingId: string,
  input: OpeningRulesInput,
): Promise<{ ok: true } | { ok: false; problems: RulesProblem[] }> {
  const users = (await loadPanelUsers(orgId)).map((u) => ({ id: u.id, role: u.role, disabled: u.disabledAt !== null }));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const problems = openingRulesProblems(input, users, today);
  if (problems.length) return { ok: false, problems };
  return db.transaction(async (tx) => {
    const [opening] = await tx
      .select({ id: hiringOpenings.id })
      .from(hiringOpenings)
      .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, orgId)))
      .for("update");
    if (!opening) throw new HiringNotFound("opening");
    await tx
      .update(hiringOpenings)
      .set({
        name: input.name.trim(),
        decisionMakerId: input.decisionMakerId,
        backupDecisionMakerId: input.backupDecisionMakerId,
        minEvaluations: input.minEvaluations,
        blindMode: input.blindMode,
        deadlineAt: input.deadline ? deadlineToDate(input.deadline) : null,
        feedbackDays: input.feedbackDays,
        candidateContactEmail: input.candidateContactEmail.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(hiringOpenings.id, openingId));
    await tx.delete(hiringOpeningMembers).where(eq(hiringOpeningMembers.openingId, openingId));
    const members = [...new Set(input.memberIds)];
    if (members.length) await tx.insert(hiringOpeningMembers).values(members.map((userId) => ({ openingId, userId })));
    await tx.insert(auditLogs).values({
      orgId,
      actorId,
      action: "hiring.opening.rules",
      subjectType: "hiring_opening",
      subjectId: openingId,
      meta: { members, decisionMakerId: input.decisionMakerId, backupDecisionMakerId: input.backupDecisionMakerId, minEvaluations: input.minEvaluations, blindMode: input.blindMode },
    });
    return { ok: true as const };
  });
}

/** Close or reopen (undo of close). A reopened opening is OPEN when it has a published version, else DRAFT. */
export async function setOpeningClosed(orgId: string, actorId: string, openingId: string, closed: boolean): Promise<void> {
  const { live } = workingVersions(await versionsOf(openingId));
  const status: OpeningStatus = closed ? "CLOSED" : live ? "OPEN" : "DRAFT";
  const rows = await db
    .update(hiringOpenings)
    .set({ status, closedAt: closed ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, orgId)))
    .returning({ id: hiringOpenings.id });
  if (!rows.length) throw new HiringNotFound("opening");
  await db.insert(auditLogs).values({ orgId, actorId, action: closed ? "hiring.opening.close" : "hiring.opening.reopen", subjectType: "hiring_opening", subjectId: openingId });
}
```

- [ ] **Step 4: Add the copy**

Add to `hiring.tr.json`:

```json
  "hiringSettings": {
    "teamTitle": "Ekip",
    "name": "Alım adı",
    "members": "Değerlendiriciler",
    "membersHint": "Alımın varsayılan paneli; davet açıldığında her adaya kopyalanır.",
    "decisionMaker": "Karar veren",
    "backup": "Yedek karar veren",
    "noBackup": "Yok",
    "choose": "Seç",
    "minEvaluations": "Her adayı en az kaç kişi değerlendirsin",
    "fairTitle": "Adil değerlendirme",
    "blindMode": "Puanlamadan önce kimliği gizle",
    "blindModeHint": "Ad, e-posta, şehir ve dosya adları gizlenir. Videoda yüz ve ses görünür.",
    "independence": "Değerlendiriciler birbirinin puanını kendi puanlarını gönderince görür",
    "independenceLocked": "Her zaman açık. Bağımsız değerlendirme bu ürünün temel kuralıdır.",
    "candidateTitle": "Aday iletişimi",
    "deadline": "Son tarih",
    "feedbackDays": "Geri dönüş sözü (gün)",
    "feedbackHint": "Bitiş ekranında: tamamlandıktan sonra {days} gün içinde.",
    "contactEmail": "İletişim e-postası",
    "roleOWNER": "Sahip",
    "roleMANAGER": "Yönetici",
    "roleREVIEWER": "Değerlendirici",
    "save": "Kaydet",
    "saving": "Kaydediliyor",
    "saved": "Kaydedildi.",
    "saveFailed": "Kaydedilemedi. Tekrar dene.",
    "noPermission": "Rolün bu alımı değiştiremez.",
    "pNAME_REQUIRED": "Alıma bir ad ver.",
    "pDECISION_MAKER_REQUIRED": "Bir karar veren seç.",
    "pDECISION_MAKER_ROLE": "Karar veren aktif bir sahip ya da yönetici olmalı.",
    "pBACKUP_SAME": "Yedek karar veren, karar verenden farklı biri olmalı.",
    "pBACKUP_ROLE": "Yedek karar veren aktif bir sahip ya da yönetici olmalı.",
    "pMEMBER_UNKNOWN": "Seçilen bir değerlendirici artık aktif değil.",
    "pMIN_EVALUATIONS": "Değerlendirici sayısı 1 ile 5 arasında olmalı.",
    "pFEEDBACK_DAYS": "Geri dönüş sözü 1 ile 60 gün arasında olmalı.",
    "pDEADLINE_PAST": "Son tarih geçmişte olamaz.",
    "pEMAIL": "Geçerli bir e-posta yaz.",
    "closeTitle": "Alımı kapat",
    "closeBody": "Kapalı alıma yeni davet yapılamaz; değerlendirme ve kayıtlar okunur kalır.",
    "close": "Alımı kapat",
    "closedUndo": "Alım kapatıldı.",
    "reopen": "Yeniden aç"
  }
```

and to `hiring.en.json`:

```json
  "hiringSettings": {
    "teamTitle": "Team",
    "name": "Opening name",
    "members": "Reviewers",
    "membersHint": "The opening's default panel; copied to each candidate once invitations open.",
    "decisionMaker": "Decision maker",
    "backup": "Backup decision maker",
    "noBackup": "None",
    "choose": "Choose",
    "minEvaluations": "Each candidate is reviewed by at least",
    "fairTitle": "Fair review",
    "blindMode": "Hide identity before scoring",
    "blindModeHint": "Name, email, city and file names are hidden. Face and voice are visible in video.",
    "independence": "Reviewers see each other's scores once they submit their own",
    "independenceLocked": "Always on. Independent review is this product's core rule.",
    "candidateTitle": "Candidate contact",
    "deadline": "Deadline",
    "feedbackDays": "Reply promise (days)",
    "feedbackHint": "On the finish screen: within {days} days of completing.",
    "contactEmail": "Contact email",
    "roleOWNER": "Owner",
    "roleMANAGER": "Manager",
    "roleREVIEWER": "Reviewer",
    "save": "Save",
    "saving": "Saving",
    "saved": "Saved.",
    "saveFailed": "Could not save. Try again.",
    "noPermission": "Your role cannot change this opening.",
    "pNAME_REQUIRED": "Give the opening a name.",
    "pDECISION_MAKER_REQUIRED": "Choose a decision maker.",
    "pDECISION_MAKER_ROLE": "The decision maker must be an active owner or manager.",
    "pBACKUP_SAME": "The backup must be someone other than the decision maker.",
    "pBACKUP_ROLE": "The backup must be an active owner or manager.",
    "pMEMBER_UNKNOWN": "A chosen reviewer is no longer active.",
    "pMIN_EVALUATIONS": "The number of reviewers must be from 1 to 5.",
    "pFEEDBACK_DAYS": "The reply promise must be from 1 to 60 days.",
    "pDEADLINE_PAST": "The deadline cannot be in the past.",
    "pEMAIL": "Write a valid email address.",
    "closeTitle": "Close the opening",
    "closeBody": "A closed opening takes no new invitations; its assessment and records stay readable.",
    "close": "Close the opening",
    "closedUndo": "Opening closed.",
    "reopen": "Reopen"
  }
```

- [ ] **Step 5: Write the actions, the form and the page**

Create `src/app/(manager)/hiring/openings/[id]/settings/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { OpeningRulesInput } from "@/solutions/hiring/rules/opening-rules";
import { saveOpeningRules, setOpeningClosed } from "@/solutions/hiring/server/openings";
import { openingFor } from "../access";

const schema = z.object({
  name: z.string().max(200),
  memberIds: z.array(z.uuid()).max(50),
  decisionMakerId: z.uuid().nullable(),
  backupDecisionMakerId: z.uuid().nullable(),
  minEvaluations: z.number().int(),
  blindMode: z.boolean(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  feedbackDays: z.number().int(),
  candidateContactEmail: z.string().max(200),
});

export async function saveOpeningRulesAction(openingId: string, input: OpeningRulesInput) {
  const { user } = await openingFor(openingId, "edit");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, problems: [] };
  const result = await saveOpeningRules(user.orgId, user.id, openingId, parsed.data);
  if (result.ok) revalidatePath("/hiring/openings/[id]", "layout");
  return result;
}

export async function closeOpeningAction(formData: FormData) {
  const openingId = String(formData.get("openingId") ?? "");
  const { user } = await openingFor(openingId, "edit");
  await setOpeningClosed(user.orgId, user.id, openingId, true);
  revalidatePath("/hiring/openings", "layout");
  redirect(`/hiring/openings/${openingId}/settings?closed=1`);
}

export async function reopenOpeningAction(formData: FormData) {
  const openingId = String(formData.get("openingId") ?? "");
  const { user } = await openingFor(openingId, "edit");
  await setOpeningClosed(user.orgId, user.id, openingId, false);
  revalidatePath("/hiring/openings", "layout");
  redirect(`/hiring/openings/${openingId}/settings`);
}
```

Create `src/components/hiring/opening-settings-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMT } from "@/i18n/manager-client";
import { canDecide } from "@/solutions/hiring/rules/access";
import { openingRulesProblems, type OpeningRulesInput } from "@/solutions/hiring/rules/opening-rules";
import { saveOpeningRulesAction } from "@/app/(manager)/hiring/openings/[id]/settings/actions";

type PanelUser = { id: string; name: string; role: "OWNER" | "MANAGER" | "REVIEWER"; disabled: boolean };

/** HIRING-UX 5.18: one page, team, fair review and candidate contact; no settings maze. */
export function OpeningSettingsForm({
  openingId,
  initial,
  users,
  today,
  canEdit,
}: {
  openingId: string;
  initial: OpeningRulesInput;
  users: PanelUser[];
  today: string;
  canEdit: boolean;
}) {
  const t = useMT("hiringSettings");
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"saved" | "error" | null>(null);
  const set = <K extends keyof OpeningRulesInput>(key: K, v: OpeningRulesInput[K]) => setValue((s) => ({ ...s, [key]: v }));
  const problems = openingRulesProblems(value, users, today);
  const reason = !canEdit ? t("noPermission") : problems.length ? t(`p${problems[0]}`) : null;
  const active = users.filter((u) => !u.disabled);
  const deciders = active.filter((u) => canDecide(u.role));

  return (
    <div className="space-y-section">
      <Card className="space-y-field p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("teamTitle")}</h2>
        <div className="max-w-[480px] space-y-2">
          <Label htmlFor="opening-name">{t("name")}</Label>
          <Input id="opening-name" value={value.name} disabled={!canEdit} onChange={(e) => set("name", e.target.value)} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-[14px] font-medium text-ink">{t("members")}</legend>
          <p className="text-[13px] text-muted">{t("membersHint")}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {active.map((u) => (
              <label key={u.id} className="flex items-center gap-3 text-[14px] text-ink">
                <Checkbox
                  checked={value.memberIds.includes(u.id)}
                  disabled={!canEdit}
                  onCheckedChange={(c) => set("memberIds", c === true ? [...value.memberIds, u.id] : value.memberIds.filter((id) => id !== u.id))}
                />
                {u.name} <span className="text-[12px] text-muted">{t(`role${u.role}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-field md:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("decisionMaker")}</Label>
            <Select value={value.decisionMakerId ?? ""} disabled={!canEdit} onValueChange={(v) => set("decisionMakerId", v)}>
              <SelectTrigger aria-label={t("decisionMaker")}>
                <SelectValue placeholder={t("choose")} />
              </SelectTrigger>
              <SelectContent>
                {deciders.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("backup")}</Label>
            <Select value={value.backupDecisionMakerId ?? "none"} disabled={!canEdit} onValueChange={(v) => set("backupDecisionMakerId", v === "none" ? null : v)}>
              <SelectTrigger aria-label={t("backup")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noBackup")}</SelectItem>
                {deciders
                  .filter((u) => u.id !== value.decisionMakerId)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("minEvaluations")}</Label>
            <Select value={String(value.minEvaluations)} disabled={!canEdit} onValueChange={(v) => set("minEvaluations", Number(v))}>
              <SelectTrigger aria-label={t("minEvaluations")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="space-y-field p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("fairTitle")}</h2>
        <div className="space-y-1">
          <label className="flex items-center gap-3 text-[14px] text-ink">
            <Switch checked={value.blindMode} disabled={!canEdit} onCheckedChange={(v) => set("blindMode", v)} />
            {t("blindMode")}
          </label>
          <p className="pl-12 text-[13px] text-muted">{t("blindModeHint")}</p>
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-3 text-[14px] text-ink">
            <Lock className="size-4 text-muted" aria-hidden />
            {t("independence")}
          </p>
          <p className="pl-7 text-[13px] text-muted">{t("independenceLocked")}</p>
        </div>
      </Card>

      <Card className="space-y-field p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("candidateTitle")}</h2>
        <div className="grid gap-field md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="deadline">{t("deadline")}</Label>
            <Input id="deadline" type="date" className="tnum" value={value.deadline ?? ""} disabled={!canEdit} onChange={(e) => set("deadline", e.target.value || null)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-days">{t("feedbackDays")}</Label>
            <Input
              id="feedback-days"
              type="number"
              min={1}
              max={60}
              className="tnum"
              value={String(value.feedbackDays)}
              disabled={!canEdit}
              onChange={(e) => set("feedbackDays", Number(e.target.value))}
            />
            <p className="text-[13px] text-muted">{t("feedbackHint", { days: value.feedbackDays })}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">{t("contactEmail")}</Label>
            <Input id="contact-email" type="email" value={value.candidateContactEmail} disabled={!canEdit} onChange={(e) => set("candidateContactEmail", e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="primary"
          disabled={pending || reason !== null}
          disabledReason={reason ?? undefined}
          onClick={() =>
            start(async () => {
              const res = await saveOpeningRulesAction(openingId, value);
              setResult(res.ok ? "saved" : "error");
              if (res.ok) router.refresh();
            })
          }
        >
          {pending ? t("saving") : t("save")}
        </Button>
        {reason ? <DisabledReason>{reason}</DisabledReason> : null}
        {result === "saved" ? <span role="status" className="text-[13px] text-muted">{t("saved")}</span> : null}
        {result === "error" ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
      </div>
    </div>
  );
}
```

Create `src/app/(manager)/hiring/openings/[id]/settings/page.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UndoStrip } from "@/components/ui/undo-strip";
import { OpeningSettingsForm } from "@/components/hiring/opening-settings-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { loadPanelUsers } from "@/server/settings";
import { openingFor } from "../access";
import { OpeningHeader } from "../opening-header";
import { closeOpeningAction, reopenOpeningAction } from "./actions";

export const dynamic = "force-dynamic";

const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d);

export default async function OpeningSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const [users, sp] = await Promise.all([loadPanelUsers(user.orgId), searchParams]);
  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="settings" locale={locale} t={t} />
      <div className="mt-section">
        <OpeningSettingsForm
          openingId={opening.id}
          canEdit={access.edit}
          today={day(new Date())}
          users={users.map((u) => ({ id: u.id, name: u.name, role: u.role, disabled: u.disabledAt !== null }))}
          initial={{
            name: opening.name,
            memberIds: opening.memberIds,
            decisionMakerId: opening.decisionMakerId,
            backupDecisionMakerId: opening.backupDecisionMakerId,
            minEvaluations: opening.minEvaluations,
            blindMode: opening.blindMode,
            deadline: opening.deadlineAt ? day(opening.deadlineAt) : null,
            feedbackDays: opening.feedbackDays,
            candidateContactEmail: opening.candidateContactEmail ?? "",
          }}
        />
      </div>
      {access.edit ? (
        <Card className="mt-section space-y-3 p-card">
          <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringSettings.closeTitle")}</h2>
          <p className="text-[13px] text-muted">{t("hiringSettings.closeBody")}</p>
          <form action={opening.status === "CLOSED" ? reopenOpeningAction : closeOpeningAction}>
            <input type="hidden" name="openingId" value={opening.id} />
            <Button type="submit" variant="secondary">
              {opening.status === "CLOSED" ? t("hiringSettings.reopen") : t("hiringSettings.close")}
            </Button>
          </form>
        </Card>
      ) : null}
      {sp.closed && opening.status === "CLOSED" ? (
        <UndoStrip message={t("hiringSettings.closedUndo")} action={reopenOpeningAction} hiddenFields={{ openingId: opening.id }} />
      ) : null}
    </main>
  );
}
```

(A past deadline that was already saved shows up as a problem only when the opening is edited again; that is intended: a deadline is a promise to candidates. If the reviewer prefers, `DEADLINE_PAST` can be checked only when the value changed.)

- [ ] **Step 6: Gates, build, browser check, commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
In Chrome: on an opening's "Ekip ve kurallar": tick a reviewer as evaluator, set the backup to the decision maker: "Kaydet" is disabled with "Yedek karar veren, karar verenden farklı biri olmalı."; fix, set a deadline, save: "Kaydedildi."; the header shows the deadline; the overview's "Ekip atandı" is done. Log in as `ogretmen@kademe.local` (MANAGER) and confirm the page is editable; as a REVIEWER member (create one in /settings if none exists) the opening is visible read-only, and a REVIEWER who is not on the team gets a 404 for the same URL. "Alımı kapat" closes it with an 8 second undo; "Geri al" reopens. Stop the server; close your tabs.

```bash
git add src/solutions/hiring/rules/opening-rules.ts src/solutions/hiring/rules/opening-rules.test.ts src/solutions/hiring/server/openings.ts "src/app/(manager)/hiring/openings/[id]/settings" src/components/hiring/opening-settings-form.tsx src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Add the opening's team and rules" -m "HIRING-UX 5.18 on one page: name, reviewers, a decision maker and a backup who are active owners or managers, the minimum number of reviews, identity hiding, the locked independence rule, deadline, reply promise and contact email. The same pure rules give the form its disabled reason and make the server refuse. Closing an opening has an 8 second undo." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Status document and the final check

**Files:**
- Modify: `docs/STATUS.md`

**Interfaces:**
- Consumes: everything above. Produces: the record of what this plan verified, with command output, and what it did not.

- [ ] **Step 1: Run every gate from a clean tree**

```bash
git status --short           # must be empty before starting
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_hiring_check" -c "create database kademe_hiring_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm verify:hiring-immutability
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_hiring_check" -c "create database kademe_hiring_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm verify:hiring-setup
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_hiring_check"
```
Then start the dev server on `kademe_platform`, run `pnpm verify:guard`, keep it running for Step 2. Also run the em-dash scan over everything this plan added:
```bash
git diff --name-only 992962d HEAD | xargs grep -l $'\xe2\x80\x94' ; echo "exit $?"
```
Expected: every gate PASS, every verify line `ok`, the em-dash scan prints no file (`exit 1` from grep means "no match", which is the pass).

- [ ] **Step 2: One end-to-end walk in Chrome**

Claude in Chrome, logged in as the owner: Kütüphane > Pozisyonlar > a position > "Bu pozisyon için alım aç" > AI path > generate > accept two stages and one new competency > builder: add a choice question with a right answer > scorecard: fix any missing anchor in the Sheet, set weights 60/40 > preview (mobile and desktop) > Ekip ve kurallar: one reviewer, decision maker, deadline > overview: readiness all done > Yayınla > builder read-only > Düzenlemeye başla > v2. At each screen check HIRING-UX 11: one filled button, disabled buttons say why, status is dot plus text, no em dash, TR and then EN (switch the panel language once). Record which of the plan-1 items of HIRING-UX 2.1 this walk covers (R2, R12 partly, E1-E5) with what was seen; everything else stays "doğrulanmadı". Stop the server; close your tabs.

- [ ] **Step 3: Update STATUS.md**

In `docs/STATUS.md`:
- In "Çalıştırma" add: `pnpm db:seed-library` (yalnızca yerel 5434, `kademe` paylaşımlı veritabanını reddeder; kütüphane boşsa aynı içerik /library/competencies'teki "Başlangıç içeriğini ekle" ile de yazılır), `pnpm verify:hiring-immutability` and `pnpm verify:hiring-setup` (yalnızca adı `_check` ile biten geçici bir veritabanında).
- Add a row to "Doğrulananlar" titled "İşe alım plan 1 (yerel, kademe_platform)" with the actual numbers from Step 1 (test count, route count, verify outputs) and one sentence on the Chrome walk.
- In "Hâlâ doğrulanmadı" replace item 7 with: "İşe alımın aday akışı yok (plan 2): HIRING davetleri bilinçli olarak bilinmeyen token gibi cevaplanıyor (`candidateFlowLive: false`). Davet, inceleme, karar, gözetim plan 2-4." and add: "Canlı veritabanına 0004-0006 göçleri ve kütüphane tohumu uygulanmadı; canlıya çıkış ayrı onay." and, if Gemini was not reachable during Steps 7 of Tasks 7, 17 and 18, which AI runs were not seen live.
- In "Kararlar ve sapmalar" add one line per decision 1-14 of this plan (short form) and the spec issues listed in the plan hand-over.

Write the Turkish text without the em-dash character.

- [ ] **Step 4: Commit**

```bash
git add docs/STATUS.md
git commit -m "Record the hiring library and openings work in the status document" -m "What exists after plan 1, how to run the new scripts, what was verified with which numbers, the decisions taken, and what stays unverified (candidate flow, live AI runs if no key, production)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (hiring solution design and the user's scope list):**
- Library tables (spec 1) and the 8-competency TR+EN seed with anchors and tags: Tasks 2, 3. Library screens `/library/positions`, `/[id]`, `/library/competencies`, `/[id]`, scales tab: Tasks 5, 6. Where-used and the "live versions keep the old definition" note: Tasks 4, 14. Anchor AI (ANCHOR_DRAFT): Task 7.
- Hiring module registered without live candidate endpoints (flag), registry and candidate API tests around a stubbed registry, ESLint and ratchet exemptions, `SolutionKey`/`basePath` unions (already contain hiring; no change needed), Today invite not `modules[0]`, Library group in `buildNav`: Tasks 1, 6, 10, 14.
- `hiring_openings`, `hiring_opening_members`, versions, stages, activities, activity competencies, weight sets (spec 2.1-2.3): Task 8. Immutability trigger: Task 9. Publish gate, scorecard snapshot, weight normalisation, first weight set, later sets with reason: Tasks 10, 12, 16.
- Screens `/hiring/openings`, `/new`, `/[id]`, `/assessment/edit`, `/ai`, `/scorecard`, `/preview`, `/settings`: Tasks 13, 15, 16, 17, 19, 20. AI purposes HIRING_DRAFT, ANCHOR_DRAFT, QUESTION_CHECK: Tasks 2, 8, 7, 17, 18. Sidebar Hiring group (Alımlar) and Library group: Tasks 6, 14.
- Not in this plan by design: `hiring_assignments`, `hiring_decision_reasons` and everything from spec 2.4-5 and 7 (plans 2-4); `/hiring/candidates`, `/compare`, `/invite`, `/settings/hiring`; proctoring level editing (decision 12); "Skala ekle" (decision 5); dnd (decision 9).

**Placeholder scan:** every code step carries the code; the two parenthetical "if the reviewer prefers" notes (Tasks 19, 20) describe an alternative, not missing work.

**Type consistency checked:** `ActionResult<T>` (Task 15) is what `useSaver.run` consumes; `StagePayload`/`ActivityPayload` (Task 11) flow through `deleteStage` → undo → `insertStage` and through `stagePayloadFrom` (Task 17); `VersionContent.previewedAt` is filled by `loadVersionContent` and read by the overview through `VersionSummary.previewedAt`; `CompetencyFacts` (Task 10) is what `loadCompetencyFacts` (Task 11) returns; `openingFor` returns `{ user, opening, access }` everywhere; `describeProblem` takes `{ content, facts, locale, openingId }` everywhere; `inviteHref: string | null` changes in Task 14 together with every reader (`legacy-routes.test.ts` already tolerates null since Task 6).
