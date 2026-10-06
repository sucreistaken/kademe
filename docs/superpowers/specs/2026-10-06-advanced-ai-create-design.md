# Advanced: one place, AI first

Date: 2026-10-06. Branch `platform/solutions`. Status: approach approved in chat by the user ("1. yol ... hemen
implementasyona başla"); the user asked to skip section-by-section review and start building.

Builds on commit `531bdc5` (ready exam templates in the invite form, Exams and Question bank behind an exam-side
"Advanced" page).

## 1. Goal

The manager types what they want in one sentence and gets a finished, reviewable draft:

- "B1 yerleştirme sınavı, 40 dakika, okuma ağırlıklı" -> an exam ready to use in the invite form.
- "Almanca öğretmeni arıyoruz, ilan metni şu: ..." -> a position with its competency profile (and new competencies
  with 1/3/5 anchors), one click away from opening a hiring round.
- "B2 dinleme için 10 soru, konu iş hayatı" -> new draft questions in the bank, approved on the same screen.

If the request is unclear the AI asks at most 3 short questions (with choices where possible) before drafting. It
never guesses a value it was not given and cannot default safely.

The current manual screens stay, one level down ("Elle düzenle"), for fine tuning.

## 2. Decisions (user, 2026-10-06)

- Interaction model A: one box, full draft, cards to accept / edit / delete; clarifying questions when needed.
- One "Advanced" place for both solutions. The top-level "Library" group and the exam-side "Advanced" item go away.
- Approach 1: a small router step plus the generators that already exist. No free-form agent that writes to the DB.
- Language: code and commits English; UI copy TR and EN; no em-dash anywhere.

## 3. Menu

```
Bugün
Alımlar          (hiring)
Öğrenciler       (exam)
Gelişmiş         (core, /advanced)
Ayarlar
```

- `buildNav` drops the Library group and adds one core item "Gelişmiş" / "Advanced" (`/advanced`, icon `library`),
  active under `/advanced`, `/library`, `/exam/exams`, `/exam/bank`.
- The exam manifest drops its `/exam/advanced` item. `/exam/advanced` redirects (307) to `/advanced`.
- Group headers: with the Library group gone the menu still has two solution groups; headers stay as today.

## 4. The Advanced page (`/advanced`)

Top to bottom:

1. **Create box.** One textarea ("Ne kurmak istiyorsun?"), three example chips that fill it, one primary button
   "Taslak hazırla". Under it a single line naming what it can build: exam, position, question set.
2. **Current draft** (when one is open): questions, or the review cards (section 6).
3. **What you have**, one compact card per area, contributed by the solutions through the registry:
   Exams (count, link `/exam/exams`), Question bank (approved count, pending count, link `/exam/bank`), Positions
   (count, link `/library/positions`), Competencies (count, link `/library/competencies`). Each card has one link,
   "Elle düzenle". No other buttons.
4. **Recent drafts**: the last 5 of this user (kind, one-line summary, status, link to reopen if still open).

Only users with at least one creator capability see the box; a REVIEWER sees the cards only.

## 5. Architecture

### 5.1 Creators (per solution)

A solution contributes **creators** through its server module (new optional `SolutionModule.creators`). Core code
never imports a solution folder; it reaches creators only through `solutionModules()`.

```ts
type CreatorKind = "EXAM" | "QUESTION_SET" | "POSITION";

interface Creator<P, D> {
  kind: CreatorKind;
  capability: Capability;                 // EXAM: blueprint:write, QUESTION_SET: bank:write, POSITION: library:write
  label: I18nLabel;                       // "Sınav", "Soru seti", "Pozisyon"
  /** Router guide: what the parameters mean, which are required, allowed values. Plain text, English. */
  routerGuide: string;
  /** JSON schema (subset Gemini accepts) for this creator's parameters, used inside the router schema. */
  paramsJsonSchema: object;
  /** Zod check of the router's parameters. Returns the missing or invalid fields as questions, not an error. */
  validate(raw: unknown, locale: Locale): { ok: true; params: P } | { ok: false; questions: CreateQuestion[] };
  /** Build the draft. May call AI and may write DRAFT-only rows (see 5.4). Never publishes. */
  draft(ctx: CreatorCtx, params: P): Promise<DraftResult<D>>;
  /** Apply the accepted draft. Writes through existing write functions. Returns where to go next. */
  apply(ctx: CreatorCtx, draft: D, edits: unknown): Promise<ApplyResult>;
  /** Server-rendered summary data for the review cards (client component per kind renders it). */
}
```

Language exam module provides `EXAM` and `QUESTION_SET`; hiring module provides `POSITION` (positions are org-level
library assets, but the template set and the AI draft generator that fill them live in hiring).

### 5.2 Router (core)

`src/server/create/router.ts`. One AI call (`callJson` through `runWithRepair`, new `ai_purpose` value
`CREATE_ROUTER`, one migration). Input: the request text, earlier questions and answers (at most 2 rounds), the
user's locale, and the creators the user may use (kind, label, guide, params schema). Output schema:

```json
{ "kind": "EXAM" | "QUESTION_SET" | "POSITION" | "UNSUPPORTED",
  "params": { ... },                      // only the chosen creator's params
  "questions": [ { "id": "minutes", "text": "...", "choices": ["15", "40", "60"] } ],   // 0..3
  "summary": "one line, user language" }
```

Then core runs `creator.validate(params)`. Missing required values become questions even if the AI did not ask.
Rules:

- At most 3 questions per round, at most 2 rounds. After round 2 a still-missing value takes the creator's
  documented default if it has one; otherwise the draft stops with "Şunu bilmem gerekiyor: ..." and a link to the
  manual screen.
- `UNSUPPORTED`: the page shows what it can build and the manual links. No retry loop.
- The router never writes to the DB except `ai_runs` and the draft row (5.3).

### 5.3 Draft persistence

New table `creation_drafts` (one migration with the enum value):

| column | type | note |
|---|---|---|
| id | uuid pk | |
| org_id, user_id | uuid fk | owner; only the creator's user reads it |
| request | text | the original sentence, max 4000 chars |
| rounds | jsonb | `[{questions, answers}]` |
| kind | enum creation_kind null | set when routed |
| params | jsonb null | validated params |
| draft | jsonb null | creator draft payload |
| status | enum `ASKING`, `DRAFTED`, `APPLIED`, `DISCARDED`, `FAILED` | |
| result_href | text null | where `apply` sent the user |
| created_at, updated_at | timestamptz | |

Why a table and not sessionStorage (hiring's AI page uses sessionStorage): a refresh or a second tab must not lose
a 30-second AI result, "Recent drafts" needs it, and it gives an audit trail. Drafts older than 30 days that are not
`APPLIED` are deleted by the existing daily retention cron (`/api/cron/purge-retention`).

Audit rows: `create.route`, `create.draft`, `create.apply`, `create.discard`.

### 5.4 Creators in detail

**EXAM** (language exam)

- Params: `mode` (PLACEMENT | VERIFICATION; required), `claimedLevel` (A1..C2, required when VERIFICATION),
  `targetMinutes` (10..120, default from the nearest template), `skills` (subset of the 5 sections, default from the
  template), `emphasis` (a section or none), `speakingRequired` (bool), `name` (optional; generated otherwise).
- Draft (deterministic, no AI beyond the router): start from the nearest of the 3 templates (by mode, minutes,
  skills), switch sections on/off, scale `durationMinutes` to the target with the emphasis section getting the
  larger share, keep every value inside `sectionConfigSchema` limits, parse with `blueprintConfigSchema`. Then run
  `bankCoverage(bankCounts(org), cfg, mode, claimed)`.
- Cards: name, mode, each section (minutes, adaptive or fixed), total minutes, coverage (ok or "B2 dinleme: 3 soru
  eksik").
- Edits on the card: name, minutes per section, section on/off.
- Apply: coverage ok -> insert and publish the blueprint (same rules as `ensureTemplateBlueprint`, but not linked to
  a template key) and go to `/exam/students/new?exam=<id>` with the exam preselected. Coverage gaps -> save as
  DRAFT, and the result offers one button per gap "Eksik soruları üret", which opens a new QUESTION_SET draft with
  the gap's section and level prefilled (no router call).

**QUESTION_SET** (language exam)

- Params: one or more `{section, level, itemType?, count, topic?}`; total count at most 20, each spec split into
  `generationSpecSchema` batches of at most 10. `itemType` defaults to the section's first allowed type.
- Draft: runs `generateItems` per batch (existing, synchronous, writes DRAFT items with origin AI). The draft payload
  stores the created item ids. This is the one creator whose draft writes rows; they are DRAFT bank items that never
  reach an exam until approved, which is how the bank works today.
- Cards: each item (stem, options, correct answer, level, section), with "Onayla" / "Reddet" per item and "Hepsini
  onayla". Listening items show "Ses dosyası onaydan sonra üretilir" and reuse the bank's audio action.
- Apply: approve the kept items (`bank:approve` needed; without it they stay pending and the screen says so), reject
  the removed ones. Discarding the draft rejects every item it created.

**POSITION** (hiring)

- Params: `name` (required), `jobAd` (optional text), `team` (optional).
- Draft:
  1. `matchTemplate(name)` hits one of the 20 ready templates -> use its job ad (if the user gave none), its
     competencies and weights. No AI call.
  2. Otherwise a job ad is needed: if none was given and the name is all there is, the router's validate step asks
     one question ("Kısa bir görev tanımı ya da ilan metni yazar mısın?", at least 40 characters). Then the hiring
     draft generator produces competencies with anchors. `generateHiringDraft` currently requires an `openingId`;
     it becomes optional (used only as `inputRef`). Stage suggestions from that call are dropped here: stages
     belong to an opening and keep being drafted on the opening's AI page.
- Cards: name, job ad (collapsed), competency profile rows (name, weight, "yeni" or "kütüphanede var"), anchors 1/3/5
  for new competencies. Edits: weights (must add to 100), remove a competency, edit anchor text.
- Apply: `createPosition` + profile via `savePosition`, competencies via `findOrCreateCompetency` (an existing one
  with the same name is reused, never overwritten). Then two links: "Pozisyonu aç" and "Bu pozisyon için alım aç"
  (existing `positionAction`, which goes to the opening flow where the AI stage draft already works).

### 5.5 Server actions and waiting

`src/app/(manager)/advanced/actions.ts`: `startCreate(text)`, `answerQuestions(draftId, answers)`,
`applyDraft(draftId, edits)`, `discardDraft(draftId)`. Every action: `requireUser`, the creator's capability,
`aiLimitReached(org, user, purpose)` before any AI call, draft ownership check (org and user), audit row.

AI work runs inline in the action as everywhere else in the app (no queue). The page shows the same waiting pattern
as the hiring AI page: skeleton cards, "Taslak hazırlanıyor, genelde 10-40 sn", "Hâlâ çalışıyor" after 40 seconds.
Route segment `maxDuration = 120`.

### 5.6 Errors

| Case | What the user sees |
|---|---|
| AI not configured | "AI şu an kapalı." + the manual links. Draft row FAILED. |
| Rate limit | "Çok sık denedin, birkaç dakika sonra tekrar dene." No AI call. |
| Router or creator schema failure after the repair round | "Taslak hazırlanamadı. Tekrar dene ya da elle kur." Draft FAILED, request text kept in the box. |
| Coverage gap (EXAM) | Saved as draft exam, gap buttons (5.4). |
| No permission for the routed kind | Router only offers allowed creators; a forged kind gets 403. |

## 6. Review screen

One component per kind (client), shared frame: summary line, cards, a single-line "Değiştirmek istediğin bir şey
var mı?" box that sends the change back through the creator's draft step (one more AI round for POSITION and
QUESTION_SET; for EXAM the router maps it to new params), "Onayla" (primary), "Vazgeç" (text).

## 7. Boundaries

- Core: `/advanced` page, actions, router, `creation_drafts`, the creator types in `src/solutions/types.ts`.
- Language exam: `src/solutions/language-exam/create/{exam,question-set}.ts` and their review components.
- Hiring: `src/solutions/hiring/create/position.ts` and its review component.
- Core reaches creators and the Advanced cards through `solutionModules()` (server) and manifests (client), so the
  ESLint and `boundary.test.ts` rules hold without new exceptions.

## 8. Testing

- Unit (vitest, AI mocked as in `draft-job.test.ts`): router parse and validate (missing values become questions,
  round limit, UNSUPPORTED, forbidden kind), each creator's draft and apply (EXAM config scaling stays inside
  schema limits for every template x minutes 10..120; coverage gap path; QUESTION_SET batching and approve/reject;
  POSITION template hit, AI path, existing competency reuse, weights sum), actions (capability, rate limit,
  ownership), nav (Library group gone, Advanced active prefixes), i18n parity.
- `tsc`, `eslint src scripts`, `pnpm test`, `pnpm build`, migration fingerprint on throw-away `_check` DBs.
- Claude in Chrome on a throw-away `_check` DB, with a real Gemini key if one is configured locally: one request per
  kind, one clarifying-question round, one coverage gap, Recent drafts after refresh. Anything not run is reported
  as not verified.

## 9. Out of scope

- A chat that keeps memory across drafts; editing existing exams or positions through the box ("change my B1 exam").
- Opening a hiring round directly from the box (it links into the existing flow).
- Production rollout: separate approval (needs migrations 0015 and this one).
