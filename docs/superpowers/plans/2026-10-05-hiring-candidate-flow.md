# Hiring Candidate Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a manager invite candidates to an opening's live (published) assessment version and let each candidate take it end to end through `/a/[token]` (landing with consent, details, device check, warm-up, timed stages with every activity type, save and resume, done with a short survey, data rights), with the server owning every clock and every answer, and with the hiring candidate API proven to leak nothing team-only before `candidateFlowLive` turns on.

**Architecture:** The core keeps owning the token, the link, consent, media upload and the `/a/[token]/*` URLs; it learns four new optional or required hooks on the solution contract (`candidate.serves`, `candidate.consentText`, `candidate.renderPage`, `attempts.closeExpired`) so core pages and endpoints dispatch to hiring without importing it. Hiring adds five tables (`hiring_assessments`, `hiring_assignments`, `hiring_stage_runs`, `hiring_responses`, `hiring_survey_responses`) in one reviewed migration, pure rules in `src/solutions/hiring/rules/` (stage clock with chosen extra time, write order, answer sanitising, the candidate state built only from `toCandidateVersion`), database code in `src/solutions/hiring/server/`, endpoints under `/api/c/[token]/hiring/*` answered only through `candidateJson`, server-rendered candidate pages in `src/solutions/hiring/candidate/pages.tsx` and client screens in `src/components/hiring/candidate/`. Manager side: invite (single and pasted list), the opening's Candidates tab, the overview funnel, the finish-survey switch and per-solution invite on Today.

**Tech Stack:** Next.js 16.3.4 App Router (server components, route handlers and server actions; `params` and `searchParams` are Promises; route groups exist but are not needed here), React 19.2.8, Tailwind 4 + shadcn/ui (`src/components/ui`), Drizzle ORM 0.45.2 + drizzle-kit 0.31.10 (versioned migrations in `drizzle/migrations`), postgres.js, PostgreSQL 17 (Docker `kademe-db`, port 5434), zod 4, next-intl 4, vitest 5 (node environment, `src/**/*.test.ts`), tsx, pnpm, MediaRecorder + the core chunked uploader (`src/lib/client/recorder.ts`), ElevenLabs Scribe through the core transcription queue, Claude in Chrome for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-04-hiring-solution-design.md` (2.1 assignments, 2.4 invitation/run/response, 4 visibility as it applies to the candidate list, 5 proctoring left for plan 4, 7 candidate API, 8 tests, 9 plan 2). Also binding: `docs/superpowers/specs/2026-10-03-platform-solutions-design.md` (2 core vs solution, 3 contract, 4 candidate routes, 6 leak rule), `docs/design/HIRING-UX.md` (2.1 A1-A12 and E1-E5, 4.4 candidate site map, 5.1 Today invite, 5.4 funnel, 5.11 invite, 5.12 columns used by the opening's Candidates tab, 5.18 finish survey switch, 6.1-6.15 candidate screens, 7.2 "Ne kaydediliyor" card, 8 tokens and motion, 10 "sen", 11 per-screen checklist), `docs/design/RULES.md`, `docs/STATUS.md` (invariants). Conventions and carries: `docs/superpowers/plans/2026-10-04-hiring-library-openings.md` and its ledger `.superpowers/sdd/2026-10-04-hiring-library-openings/progress.md` ("Carry to plan 2", final review deferred list).

**Depends on:** hiring plan 1, complete on `platform/solutions` at `794b363` (1453 tests in 117 files, `verify:exam` 24 ok and `verify:guard` 31 ok on `kademe_platform`, migrations 0000-0009).

## Scope boundary

In this plan:
- Invitations to an OPEN opening's newest published version: candidate, core invitation, link, `hiring_assessments` (frozen version, consent text, extra time, proctoring level), `hiring_assignments` (the opening's active panel copied at invite), outbox row with the ready message, audit row. Single invite and a pasted list (up to 50 rows), from `/hiring/invite` (page) and as a Sheet from the opening pages.
- A new link for an existing invitation (the old one stops working), "7 gün uzat" through the core `extendLink`, open candidate requests (accommodation, new link, data rights) per candidate with "Tamam".
- The opening's "Adaylar" tab (status dot and text, progress "2/3 aşama", invited, last activity, link expiry, requests; names masked for reviewers when blind mode is on), the overview's invite button, the three-step funnel (Davet, Başladı, Tamamladı) with median time against the estimate, the candidate experience block (only with 5 or more survey answers), the 5.18 finish-survey switch.
- Today: one invite target per solution, labelled per solution, a menu when the user may invite for more than one.
- The candidate flow under the existing core URLs: `/a/[token]` landing and consent (6.1, 7.2 card), `/info` (6.2), `/check` (6.3, only when the version has a video or audio question), `/practice` (6.4, nothing sent), `/stage/[n]` (6.5 intro, 6.6 video and audio with flexible think time, takes and review, 6.7 text, 6.8 choice with keys 1-9, 6.9 file, 6.10 between stages with the final 8 second undo, 6.11 time-up, 6.12 offline strip, resume gate, second tab), `/done` (6.13 without the decision status line), `/rights` (data rights plus accommodation request), link problems (6.14: invalid, not yet, expired with "Yeni link iste", completed, opening closed).
- Candidate API `/api/c/[token]/hiring/*`: `stage/start`, `stage/submit`, `response` (autosave, PUT and POST for beacons), `response/commit`, `extra-time`, `media/init` (recording and file), `media/play` (own take, for the review step), `survey`. Core endpoints answer hiring through the contract: `state`, `consent`, `info`, `device-check`, `heartbeat`, `media/*`, `problem`, `rights`, `bandwidth`.
- Media: recordings and files through the core multipart upload; completion attaches to the response (`onMediaComplete`); recordings are transcribed by the core queue with no language forced; abandoned uploads are salvaged by hiring's own cron sweep; stage runs whose clock ran out are closed by the cron.
- Retention: every hiring row hangs off the core invitation or attempt and is removed with the candidate (cascade, proven by the verify script); hiring media stays on the candidate clock until plan 3 adds a decision anchor.
- `candidateFlowLive: true` on the hiring manifest (Task 10), with the leak rule proven by unit sentinels with a positive control, by the end-to-end script over real endpoint responses, and by `verify:guard`.

Not in this plan (plans 3 and 4, or later):
- Reviewer scoring, evaluations, decisions, the candidate detail page, comparison, divergence, retakes (`hiring_retake_requests`, `RETAKE_AVAILABLE`), the decision status line on `/done` (6.13 "Adaya durumu göster") and the `status` endpoint, `/hiring/candidates` (all openings) and its tabs, Today's hiring rows and "Talepler" section, editing assignments after invite, `visibility.ts`.
- Proctoring: no BASIC preset, no proctoring level editing, no hiring proctor UI. **What the candidate sees about proctoring in plan 2: nothing is monitored.** `hiring_assessments.proctor_level` is frozen as `OFF` at invite, `proctorPolicy()` stays `null`, the browser proctoring engine is never started on a hiring page, and the "Ne kaydediliyor" card lists only what plan 2 really records: video answers (if any), audio answers (if any) and technical upload and connection facts, plus the fixed closing sentence of HIRING-UX 7.2. Plan 4 copies the version's level onto new invitations and widens the card.
- Real e-mail sending (no provider; the invite is copied by the manager and written to `message_outbox`, as for the exam), the 60 second "Nasıl işliyor" video, `.ics` for a not-yet-open link, editing hiring consent texts (settings 5.19), the "Linki e-postama gönder" button.

## Global Constraints

- Every schema change is a reviewed migration: edit `src/db/schema`, `pnpm db:generate --name <x>`, read the generated SQL, move a UNIQUE that a composite foreign key references above that key by hand (drizzle-kit emits it after; Postgres refuses the key otherwise, as in 0007), then prove it equal to the TypeScript schema with `pnpm db:fingerprint` on two fresh throw-away databases (one `drizzle-kit push --force`, one `pnpm db:migrate`); grep the push log for `error` too (drizzle-kit can exit 0 after an SQL error). Pin the important constraints in `src/db/migrations-sql.test.ts`. Additive only: no DROP, no UPDATE of existing rows, nothing that touches a published hiring version (`hiring_versions`, `hiring_stages`, `hiring_activities`, `hiring_activity_competencies` rows are frozen by triggers).
- Tenancy: every new table has `org_id` or a documented parent chain that ends in a row with `org_id`; every server read and write filters by the caller's organisation (the token's invitation on the candidate side, the session's organisation on the manager side). A foreign key to `users` on a row that must survive is `ON DELETE RESTRICT`. Constraint names are at most 63 characters (name long foreign keys explicitly).
- Migrations are applied to `kademe_platform` only: `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate`. Throw-away databases are named `kademe_*_check`, created and dropped in the same step through `docker exec kademe-db psql -U kademe -d postgres`. Anything that publishes a hiring version (frozen rows that cannot be deleted) runs on a throw-away `kademe_ui_check` (browser) or `kademe_flow_check` (script) database, never on `kademe_platform`.
- The shared `kademe` database and production are out of scope. No command in this plan connects to them. Never run `pnpm db:seed` or `pnpm db:reset` on a shared database.
- Exam behaviour is unchanged: `pnpm verify:exam` passes after every task that changes the core or `kademe_platform` (Tasks 1, 2, 3, 8, 9, 10, 21) and `pnpm verify:guard` (dev server on 3100, same database) after every task that touches a candidate route or the registry (Tasks 2, 3, 9, 10, 21).
- Leak rule (platform spec 6, hiring spec 7, plan 1 carries): every hiring candidate body is built from `toCandidateVersion` (through `buildCandidateState`) and answered only through `candidateJson`; a server page passes client components only `candidateSafe` values built the same way. Team-only fields (`internal*`, expected behaviours, red flags, manager notes, answer examples, a choice's `correct`, competency ids, scorecard, weights) never leave the server. Every leak test plants sentinels in team-only fields AND a visible sentinel as a positive control that must be found.
- Every hiring candidate endpoint and page first proves: the invitation is `HIRING`, the hiring module is live, and the invitation has hiring terms (`candidate.serves`). Anything else is answered exactly like an unknown token (same status, same body, browser language, no first-seen record).
- `candidateFlowLive` stays `false` until Task 10, which flips it in the same commit as the end-to-end leak proof. No hiring invitation can be created by a user before Task 17 (the invite screen); the manifest's `inviteHref` stays `null` until Task 20 puts it on Today.
- Core never imports `@/solutions/hiring/*` or `@/components/hiring/*` (ESLint `no-restricted-imports`); hiring never imports the exam (`src/solutions/boundary.test.ts`); the `KNOWN_COUPLINGS` list may only shrink.
- Candidate UI (HIRING-UX 6): address is "sen"; one filled button per screen, on phones in a sticky bottom bar with the safe-area inset; a disabled button states its reason next to it (`DisabledReason`, never a tooltip); clocks are accent, `.tnum`, do not blink or turn red, and only their text changes in the last 60 seconds ("Son 1 dakika"); a screen reader hears the remaining time at most once a minute (`aria-live="polite"`); focus moves to each new screen's heading (`useStepFocus`) with a polite live region naming the position; targets are at least 44px, candidate input text at least 16px; reading width 640px, video screens 960px, frame 1000px; no word "uyarı", "ihlal", "şüpheli", "hile", "başarısız" (EN "warning", "violation", "suspicious", "cheat", "fail") in candidate hiring copy (test); motion per HIRING-UX 8.5 (recording dot pulses 1.6 s only with `motion-safe`).
- Manager UI: RULES.md as in plan 1 (shadcn parts from `src/components/ui`, one filled button, `DisabledReason`, `StatusDot`, no confirm dialogs, `UndoStrip` or inline undo, `.tnum` on numbers and dates, `--card-radius: 12px` from the hiring layout).
- Dates and times shown to a candidate are formatted on the server in the organisation's zone (`shortDate`/`dateTime` from `@/i18n/dates`, which default to `ORG_TIMEZONE`) and passed down as strings; the candidate provider gets `timeZone={ORG_TIMEZONE}`. Dates the manager sees use `@/lib/format` as in plan 1.
- Copy: every string Turkish and English with identical keys (`src/i18n/messages.test.ts`); the em-dash character (U+2014) appears nowhere: not in copy, code, comments, SQL, commit messages or this plan.
- AI: this plan adds no `ai_purpose` value and makes no model call. Transcription stays the core ElevenLabs queue (`enqueueTranscription`). Any later AI call in the hiring flow calls `aiLimitReached` first (plan 1 carry).
- Browser checks use Claude in Chrome only (`mcp__claude-in-chrome__*`), never Playwright. The dev server is started only as `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/<db> pnpm dev --port 3100` and stopped with `lsof -nP -iTCP:3100 -sTCP:LISTEN -t | xargs kill`; if another session already listens on 3100, coordinate instead of killing it. `PROCTOR_DEV_FAKE` is never set. The automation tab cannot prove a real camera, microphone or recording (memory note): such rows are written "doğrulanmadı, gerçek cihazda kullanıcıyla" unless the user ran them.
- Commits on branch `platform/solutions`, `git add` only the exact paths the task names, English message (imperative subject, body), last line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git checkout`, `git switch`, `git stash` or `git reset`.
- Gates for every task: `pnpm exec tsc --noEmit`, `pnpm exec eslint src scripts`, `pnpm test` (1453 tests at the start; the count only grows and no earlier test title disappears unless the task says it replaces it), plus `pnpm build` where the task adds or changes routes or pages.
- Code, identifiers, comments and commit messages in English. Read the relevant guide in `node_modules/next/dist/docs/` before using a Next API this repo does not already use.

## Decisions taken in this plan

1. **The contract grows by hooks, not imports.** `SolutionModule.candidate` gains `serves?(ctx)` (an invitation without the solution's own row is answered like an unknown token), `consentText(ctx)` (the consent copy shown and recorded) and `renderPage?(slot, input)` (a solution renders the core candidate pages it needs; omitted, the core's own exam pages render as before); `attempts` gains `closeExpired?(now, limit)` for the cron. The manifest gains `inviteLabel`, `inviteCapability`, `transcriptionHint` and `accommodationRequests`; `CandidateStepState` gains an optional `position`.
2. **One set of URLs.** `/a/[token]`, `/info`, `/check`, `/done` stay core pages that ask `solutionPage()` first; `/practice` and `/stage/[n]` are new core route files that only dispatch (an exam or unknown token sees the invalid-link card). No route group, no ESLint exemption.
3. **Consent texts carry a solution** (`consent_texts.solution`, default `LANGUAGE_EXAM` for every existing row); `getConsentText` filters by it, so the exam text is never shown to a hiring candidate and back. The invitation freezes the organisation's current hiring consent text (`hiring_assessments.consent_text_id`), created from a built-in TR/EN text on first need. `hiring_versions.consent_text_id` stays null (published rows are frozen; editing hiring consent texts is settings work).
4. **Assignments copy the whole active panel at invite** (spec 2.1 and the existing 5.18 hint "davet açıldığında her adaya kopyalanır"); HIRING-UX 5.18's per-candidate count with rotation is not built. `min_evaluations` stays the decision threshold. Inviting needs at least one active evaluator ("Önce ekibe en az bir değerlendirici ekle."). The landing says the real number of assigned people.
5. **Extra time** is 0, 25 or 50 percent, chosen without a reason on the landing (before or after consent) and changeable while no stage is running; it applies to every stage started afterwards: `deadline_at = started_at + ceil(duration × (100 + pct) / 100)` (+ grace for `ALLOW_GRACE`), written once at stage start. Reviewers never get the number; the opening's Candidates tab shows owners and managers only "Süre uyarlaması uygulandı".
6. **A response row exists for every question of a started stage** (created at stage start), so a stage closed by the clock scores unanswered choice questions 0 and nothing is guessed later. `answered_at` means "the candidate closed this question" (moved on, submitted, or the stage closed with content); whether it has content is derived from the payload and media.
7. **Write order is the server's.** Without back navigation, a write must name the first open question of the running stage; a closed question cannot be written. With back navigation, any question of the running stage can be written until the stage is submitted.
8. **Takes are counted on the server** from the response's own take list (`take_asset_ids`), counting uploads that are UPLOADING, READY or INCOMPLETE under a row lock; a failed upload gives the take back. The newest take is the answer and supersedes a typed alternative.
9. **The review step plays the take back from storage** (`/hiring/media/play`, a 10 minute signed URL), so no recording is ever held in browser memory (iOS rule of the recorder). The warm-up keeps its 30 second take in memory only, and never touches the network (static test plus a network check in the browser).
10. **Choice questions score 1 or 0:** single choice is right when the chosen id is the right one; multiple choice only when the chosen set equals the right set. Unanswered is 0 once the stage closes. The candidate never learns it.
11. **A file question takes one file;** "Değiştir" uploads a new one that replaces it on completion. Size is checked when the upload opens (declared bytes) and again on completion (stored bytes).
12. **A closed opening stops candidates who have not started any stage** ("Bu pozisyon için değerlendirme kapandı."); a candidate already inside may finish. A finished candidate always reaches `/done`.
13. **The final submit is delayed, not confirmed:** the last action of the last stage shows "Gönderiliyor · Geri al 8" for 8 seconds, then commits the open question and submits; "Geri al" sends nothing. Earlier stages submit at once and land on the next stage's intro with "Aşama 1 tamamlandı. Cevapların kaydedildi."
14. **Candidate requests reuse `deletion_requests`** (its `kind` is text): `ACCOMMODATION` from `/rights?type=accommodation` (only for solutions with `accommodationRequests`), `NEW_LINK` written by the core problem route when the area is `LINK`. The opening's Candidates tab lists the open ones with "Tamam" (sets `handled_by`, `handled_at`).
15. **The survey** (`hiring_survey_responses`, one per invitation, 1-5 plus optional text) is shown on `/done` when the opening's `finish_survey_enabled` is on (default on, switch on 5.18). The overview shows the average and the last three comments only from 5 answers.
16. **The invite link expires at the end of the chosen day** in `ORG_TIMEZONE`: default the opening's deadline when it is still ahead, otherwise 14 days from today; "Değiştir" picks another day (not in the past). A new link keeps the later of the old expiry and 7 days from now.
17. **`candidateFlowLive` flips in Task 10**, after the server side is complete and the end-to-end script has proven the leak rule over real responses, and before the candidate screens, because every screen's browser check needs live endpoints. Until Task 17 no user can create a hiring invitation (no invite UI; `inviteHref` stays null until Task 20); scripts create them only in throw-away databases, and a hiring token on a not-yet-built screen gets the invalid-link card. (Listed as an open question.)
18. **The Today invite button** offers each solution the user may invite for: one target is a plain link with that solution's label ("Aday davet et" / "Öğrenci davet et"), two are a "Davet et" menu.
19. **No hiring proctoring**, see Scope. `proctorPolicy()` stays null; the device check is hiring's own camera/microphone/trial screen, not the exam's `SystemCheck`.
20. **Plan 1 carries handled here:** the URL notice defers its `replaceState` (`setTimeout 0`) so a full page load cannot resurrect the parameter; the preview's progress bar uses the same `progressOf` definition as the candidate pages; `useStepFocus` plus a polite live region on every candidate step; org-day formatting for everything a candidate reads.

## File Structure

| Path | Responsibility |
|---|---|
| `src/db/schema/compliance.ts` | `consent_texts.solution`. |
| `src/db/schema/hiring.ts` | `hiring_openings.finish_survey_enabled`, UNIQUE (id, opening_id, org_id) on versions, the five new tables, `HiringResponsePayload`. |
| `drizzle/migrations/0010_hiring_candidate_flow.sql` (+ meta) | Generated, reviewed migration. |
| `src/db/migrations-sql.test.ts` | Pins 0010. |
| `src/solutions/types.ts` | Contract additions (Decision 1). |
| `src/solutions/registry.ts`, `registry.server.ts` (+ test) | `transcriptionHintFor`, `inviteTargets()` with label and capability, `servingSolution`. |
| `src/solutions/language-exam/manifest.ts`, `module.ts` | Exam's values for the new contract fields. |
| `src/lib/candidate-api.ts` (+ tests) | Serve only invitations a live module serves. |
| `src/lib/candidate-context.ts` (+ test) | `getConsentText` by solution. |
| `src/lib/transcribe-job.ts` | Language hint from the manifest. |
| `src/app/api/cron/close-expired/route.ts`, `src/lib/close-expired.ts` (+ test) | Modules' `closeExpired`; exam salvage only exam uploads. |
| `src/app/api/c/[token]/consent/route.ts`, `rights/route.ts`, `problem/route.ts` (+ tests) | Consent through the module, accommodation, new-link request. |
| `src/lib/candidate-pages.ts` (+ test), `src/components/candidate/UnknownLink.tsx` | Core page dispatch. |
| `src/app/a/[token]/{page,info/page,check/page,done/page,rights/page}.tsx`, `practice/page.tsx`, `stage/[n]/page.tsx` | Core pages asking the solution first. |
| `src/components/candidate/InfoForm.tsx`, `RightsForm.tsx` | `path` from the state; accommodation kind. |
| `src/lib/client/recorder.ts` (+ test) | `ChunkedUploader.open` takes the init body. |
| `src/components/ui/url-notice.tsx`, `src/lib/url-notice.ts` (+ test) | Deferred `replaceState` (carry). |
| `src/solutions/hiring/rules/candidate-flow.ts` (+ test) | Extra time, deadline, write order, sanitising, answered, auto score, completion, stage rules, progress, step paths. |
| `src/solutions/hiring/rules/disclosure.ts` (+ test) | Recorded signals (7.2), devices needed, estimated minutes. |
| `src/solutions/hiring/rules/candidate-state.ts` (+ test) | The candidate state, built only from `toCandidateVersion`; sentinel test. |
| `src/solutions/hiring/rules/invitation.ts` (+ test) | Invite message, pasted list parsing, expiry day, candidate progress, `SURVEY_MIN_ANSWERS`. |
| `src/solutions/hiring/consent-default.ts` | Built-in hiring consent text TR/EN. |
| `src/solutions/hiring/server/consent.ts` (+ test) | `ensureHiringConsentText`. |
| `src/solutions/hiring/server/invitations.ts` (+ test) | Create, new link, candidates of an opening, requests, funnel, survey summary. |
| `src/solutions/hiring/server/candidate.ts` (+ test) | Context, state, start, save, commit, submit, extra time, heartbeat, media open/attach/play, survey, cron close and salvage. |
| `src/solutions/hiring/manifest.ts`, `module.ts` (+ test) | Live hiring module. |
| `src/solutions/hiring/server/candidate-route.ts` | `withHiringCandidate`. |
| `src/app/api/c/[token]/hiring/**/route.ts` (+ tests) | Hiring candidate endpoints. |
| `scripts/verify-hiring-flow.ts`, `scripts/dev-hiring-link.ts`, `scripts/verify-solution-guard.ts` | End-to-end proof, a link for browser checks, the guard after the flip. |
| `src/solutions/hiring/candidate/pages.tsx` | Server renderer for every hiring candidate page. |
| `src/components/hiring/candidate/*` | Frame, help, landing, device check, warm-up, recording sinks (upload, in-memory), recorder screen, stage runner, text, choice and file questions (`file-rules.ts` + test), done. |
| `src/i18n/messages/candidate.{tr,en}.json`, `src/i18n/hiring-candidate-copy.test.ts` | Candidate copy and its word rules. |
| `src/app/(manager)/hiring/invite/**`, `src/components/hiring/invite/*` | Invite page, Sheet, actions, form rules (+ test), copy field. |
| `src/app/(manager)/hiring/openings/[id]/candidates/**`, `src/components/hiring/candidates/*` | The opening's Candidates tab, its table and the new-link dialog. |
| `src/app/(manager)/hiring/openings/[id]/page.tsx`, `funnel.ts` (+ test), `opening-header.tsx`, `settings/**`, `src/components/hiring/opening-settings-form.tsx`, `src/solutions/hiring/rules/opening-rules.ts` | Invite button, funnel, experience, survey switch. |
| `src/app/(manager)/dashboard/page.tsx`, `src/components/manager/invite-menu.tsx`, `invite-choice.ts` (+ test) | Today invite per solution. |
| `src/i18n/messages/hiring.{tr,en}.json`, `screens.{tr,en}.json` | Manager copy. |
| `src/components/hiring/preview/preview.tsx`, `steps.ts` (+ test) | Same progress definition as the candidate pages. |
| `src/app/globals.css` | `rec-pulse` keyframes for the recording dot. |
| `package.json` | `verify:hiring-flow`, `dev:hiring-link`. |
| `docs/STATUS.md` | Results. |

---

### Task 1: Schema and migration 0010 (invitations, runs, responses, survey)

**Files:**
- Modify: `src/db/schema/compliance.ts` (consent text solution)
- Modify: `src/db/schema/hiring.ts` (opening column, version unique, five tables, payload type)
- Create (generated): `drizzle/migrations/0010_hiring_candidate_flow.sql`, `drizzle/migrations/meta/0010_snapshot.json`, `drizzle/migrations/meta/_journal.json` (modified)
- Test: `src/db/migrations-sql.test.ts`

**Interfaces:**
- Consumes: `solution`, `runCompletion`, `hiringProctorLevel` enums; `assessments`, `attempts`, `mediaAssets` (`./assessment`); `consentTexts` (`./compliance`); `hiringOpenings`, `hiringVersions`, `hiringStages`, `hiringActivities` (same file).
- Produces (all exported from `@/db/schema`):
  - `consentTexts.solution` (`"LANGUAGE_EXAM" | "HIRING"`, default `LANGUAGE_EXAM`).
  - `hiringOpenings.finishSurveyEnabled: boolean` (default true).
  - `type HiringResponsePayload = { text?: string; choiceIds?: string[]; usedTextAlternative?: boolean; file?: { name: string; bytes: number; mime: string }; pendingFile?: { assetId: string; name: string; bytes: number; mime: string } }`.
  - `hiringAssessments` (`assessmentId` PK, `solution`, `orgId`, `openingId`, `versionId`, `extraTimePct`, `extraTimeChosenAt`, `consentTextId`, `proctorLevel`, `createdAt`).
  - `hiringAssignments` (`assessmentId`, `userId`, `createdAt`; PK both).
  - `hiringStageRuns` (`id`, `attemptId`, `stageId`, `orderIndex`, `startedAt`, `deadlineAt`, `submittedAt`, `lastHeartbeatAt`, `completion`, `wasLate`, `carriedFromStageRunId`).
  - `hiringResponses` (`id`, `stageRunId`, `activityId`, `payload`, `mediaAssetId`, `takeAssetIds`, `fileAssetIds`, `takesUsed`, `usedTextAlternative`, `autoScore`, `answeredAt`, `createdAt`, `updatedAt`).
  - `hiringSurveyResponses` (`assessmentId` PK, `rating`, `comment`, `createdAt`).

- [ ] **Step 1: Write the failing static test**

Append to `src/db/migrations-sql.test.ts`:

```ts
describe("0010_hiring_candidate_flow", () => {
  const sql = read("0010_hiring_candidate_flow");

  it.each(["hiring_assessments", "hiring_assignments", "hiring_stage_runs", "hiring_responses", "hiring_survey_responses"])("creates %s", (table) => {
    expect(sql).toContain(`CREATE TABLE "${table}"`);
  });

  it("gives every consent text a solution, the exam's for every existing row", () => {
    expect(sql).toMatch(/ALTER TABLE "consent_texts" ADD COLUMN "solution" "solution" DEFAULT 'LANGUAGE_EXAM' NOT NULL;/);
  });

  it("turns the finish survey on by default", () => {
    expect(sql).toMatch(/ALTER TABLE "hiring_openings" ADD COLUMN "finish_survey_enabled" boolean DEFAULT true NOT NULL;/);
  });

  it("ties an invitation to a HIRING invitation and to one version of one opening of its organisation", () => {
    expect(sql).toMatch(/CONSTRAINT "hiring_assessment_is_hiring" CHECK \("hiring_assessments"\."solution" = 'HIRING'\)/);
    expect(sql).toMatch(/CONSTRAINT "hiring_extra_time_pct" CHECK \("hiring_assessments"\."extra_time_pct" IN \(0, 25, 50\)\)/);
    expect(sql).toMatch(/"hiring_assessments_assessment_fk" FOREIGN KEY \("assessment_id","solution"\) REFERENCES "public"\."assessments"\("id","solution"\) ON DELETE cascade/);
    expect(sql).toMatch(/"hiring_assessments_opening_fk" FOREIGN KEY \("opening_id","org_id"\) REFERENCES "public"\."hiring_openings"\("id","org_id"\)/);
    expect(sql).toMatch(/"hiring_assessments_version_fk" FOREIGN KEY \("version_id","opening_id","org_id"\) REFERENCES "public"\."hiring_versions"\("id","opening_id","org_id"\)/);
  });

  it("creates the version UNIQUE before the foreign key that needs it", () => {
    const unique = sql.indexOf(`ADD CONSTRAINT "hiring_versions_id_opening_org" UNIQUE("id","opening_id","org_id")`);
    const fk = sql.indexOf(`"hiring_assessments_version_fk" FOREIGN KEY`);
    expect(unique).toBeGreaterThanOrEqual(0);
    expect(fk).toBeGreaterThan(unique);
  });

  it("keeps one run per stage and attempt and one response per question and run", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX "hiring_stage_run_per_attempt" ON "hiring_stage_runs" USING btree \("attempt_id","stage_id"\)/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "hiring_response_per_activity" ON "hiring_responses" USING btree \("stage_run_id","activity_id"\)/);
  });

  it("keeps assignments when a user would be deleted (users are disabled, never deleted)", () => {
    expect(sql).toMatch(/"hiring_assignments_user_id_users_id_fk" FOREIGN KEY \("user_id"\) REFERENCES "public"\."users"\("id"\) ON DELETE restrict/);
  });

  it("keeps a response when its media is purged, and ranges in the database", () => {
    expect(sql).toMatch(/"hiring_responses_media_asset_id_media_assets_id_fk" FOREIGN KEY \("media_asset_id"\) REFERENCES "public"\."media_assets"\("id"\) ON DELETE set null/);
    expect(sql).toMatch(/CONSTRAINT "hiring_survey_rating" CHECK \("hiring_survey_responses"\."rating" BETWEEN 1 AND 5\)/);
    expect(sql).toMatch(/CONSTRAINT "hiring_response_auto_score" CHECK/);
  });

  it("names every constraint within Postgres' 63 characters", () => {
    const names = [...sql.matchAll(/CONSTRAINT "([^"]+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(5);
    for (const name of names) expect(name.length, name).toBeLessThanOrEqual(63);
  });

  it("only adds, and never touches a frozen hiring version", () => {
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN|TYPE|CONSTRAINT|INDEX)/);
    expect(sql).not.toMatch(/\bUPDATE\b/);
    expect(sql).not.toMatch(/ALTER TABLE "hiring_(stages|activities|activity_competencies)"/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/db/migrations-sql.test.ts`
Expected: FAIL with `ENOENT ... 0010_hiring_candidate_flow.sql`.

- [ ] **Step 3: Give consent texts a solution**

In `src/db/schema/compliance.ts`, change the enum import to `import { aiPurpose, locale, solution } from "./enums";` and add this column to `consentTexts` after `orgId`:

```ts
  /** Which solution's candidates read this text: the exam's and hiring's consent copy differ. */
  solution: solution("solution").notNull().default("LANGUAGE_EXAM"),
```

- [ ] **Step 4: Add the hiring columns and tables**

In `src/db/schema/hiring.ts`:

1. Change the pg-core import to:
```ts
import { boolean, check, foreignKey, index, integer, jsonb, numeric, pgTable, primaryKey, real, text, timestamp, unique, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
```
and the other imports to:
```ts
import { organizations, users } from "./org";
import { consentTexts } from "./compliance";
import { competencies, positions } from "./library";
import { assessments, attempts, mediaAssets } from "./assessment";
import {
  hiringActivityType,
  hiringMemberRole,
  hiringOpeningStatus,
  hiringProctorLevel,
  hiringStageTimeout,
  hiringVersionStatus,
  locale,
  runCompletion,
  solution,
} from "./enums";
```
2. Replace the tenancy paragraph of the file's header comment with:
```ts
 * Tenancy: `org_id` lives on `hiring_openings`, `hiring_versions` and
 * `hiring_assessments`. A version's opening must belong to the version's
 * organisation (composite foreign key, migration 0007), and an invitation's
 * version must belong to its opening and both to the invitation's
 * organisation (composite foreign keys, migration 0010). Every other table
 * reaches its organisation through its parent chain: stage -> version,
 * activity -> stage, weight set -> version, member -> opening, assignment ->
 * invitation, stage run -> attempt -> core invitation (org_id), response ->
 * stage run, survey answer -> invitation. Every write must load the parent
 * through a query that filters by the caller's org_id (or, on the candidate
 * side, by the token's own invitation), and a linked library row or user must
 * be checked to belong to the same organisation in that query. The server code
 * in src/solutions/hiring/server owns this check and tests it.
```
3. In `hiringOpenings`, after `candidateContactEmail`, add:
```ts
    /** HIRING-UX 5.18 / 6.13: the short experience survey on the candidate's finish screen. */
    finishSurveyEnabled: boolean("finish_survey_enabled").notNull().default(true),
```
4. In the `hiringVersions` table callback, after `uniqueIndex("one_draft_per_opening")...`, add:
```ts
    /** Target of the invitation's composite key: a version, its opening and its organisation together. */
    unique("hiring_versions_id_opening_org").on(t.id, t.openingId, t.orgId),
```
5. After the `AnswerExamples` type, add:
```ts
/** A candidate's answer to one question, as stored. Recordings and files are attached by the server, never named by the client. */
export type HiringResponsePayload = {
  text?: string;
  choiceIds?: string[];
  /** A video or audio question answered in writing (HIRING-UX A7), shown to reviewers as the penalty-free alternative. */
  usedTextAlternative?: boolean;
  /** FILE_UPLOAD: the attached file as the candidate named it (one file per question). */
  file?: { name: string; bytes: number; mime: string };
  /** FILE_UPLOAD: an upload that was opened and has not completed yet. */
  pendingFile?: { assetId: string; name: string; bytes: number; mime: string };
};
```
6. Append at the end of the file:
```ts
/**
 * One person invited to one opening's published version (hiring solution
 * design 2.4). The version, the consent text and the proctoring level are
 * frozen here at invite, so a later version or setting never changes what
 * this candidate was promised.
 */
export const hiringAssessments = pgTable(
  "hiring_assessments",
  {
    assessmentId: uuid("assessment_id").primaryKey(),
    /** Always HIRING: with assessment_id it references assessments(id, solution). */
    solution: solution("solution").notNull().default("HIRING"),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    openingId: uuid("opening_id").notNull(),
    versionId: uuid("version_id").notNull(),
    /** 0, 25 or 50; chosen by the candidate without a reason (HIRING-UX 6.1). Never read for reviewers. */
    extraTimePct: integer("extra_time_pct").notNull().default(0),
    extraTimeChosenAt: timestamp("extra_time_chosen_at", { withTimezone: true }),
    consentTextId: uuid("consent_text_id")
      .notNull()
      .references(() => consentTexts.id, { onDelete: "restrict" }),
    /** Plan 2 freezes OFF; plan 4 copies the version's level onto new invitations. */
    proctorLevel: hiringProctorLevel("proctor_level").notNull().default("OFF"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("hiring_assessments_opening_idx").on(t.openingId),
    check("hiring_assessment_is_hiring", sql`${t.solution} = 'HIRING'`),
    check("hiring_extra_time_pct", sql`${t.extraTimePct} IN (0, 25, 50)`),
    foreignKey({
      name: "hiring_assessments_assessment_fk",
      columns: [t.assessmentId, t.solution],
      foreignColumns: [assessments.id, assessments.solution],
    }).onDelete("cascade"),
    /** NO ACTION (checked at the end of the statement), so deleting an organisation still cascades through both parents. */
    foreignKey({
      name: "hiring_assessments_opening_fk",
      columns: [t.openingId, t.orgId],
      foreignColumns: [hiringOpenings.id, hiringOpenings.orgId],
    }),
    foreignKey({
      name: "hiring_assessments_version_fk",
      columns: [t.versionId, t.openingId, t.orgId],
      foreignColumns: [hiringVersions.id, hiringVersions.openingId, hiringVersions.orgId],
    }),
  ],
);

/** Who evaluates this candidate: the opening's active panel, copied at invite (spec 2.1). */
export const hiringAssignments = pgTable(
  "hiring_assignments",
  {
    assessmentId: uuid("assessment_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.assessmentId, t.userId] }),
    index("hiring_assignments_user_idx").on(t.userId),
    foreignKey({
      name: "hiring_assignments_assessment_fk",
      columns: [t.assessmentId],
      foreignColumns: [hiringAssessments.assessmentId],
    }).onDelete("cascade"),
  ],
);

/** One stage inside one attempt. Owns the authoritative clock (written once at start). */
export const hiringStageRuns = pgTable(
  "hiring_stage_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    /** NO ACTION: a stage with runs belongs to a published version, which the triggers never let go. */
    stageId: uuid("stage_id")
      .notNull()
      .references(() => hiringStages.id),
    orderIndex: integer("order_index").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    completion: runCompletion("completion").notNull().default("PENDING"),
    wasLate: boolean("was_late").notNull().default(false),
    /** Retakes (plan 3): a stage outside the retake scope points at the run it carries over. */
    carriedFromStageRunId: uuid("carried_from_stage_run_id"),
  },
  (t) => [
    uniqueIndex("hiring_stage_run_per_attempt").on(t.attemptId, t.stageId),
    index("hiring_stage_runs_deadline_idx").on(t.deadlineAt),
    check("hiring_stage_run_order", sql`${t.orderIndex} >= 0`),
    foreignKey({
      name: "hiring_stage_runs_carried_from_fk",
      columns: [t.carriedFromStageRunId],
      foreignColumns: [t.id as AnyPgColumn],
    }).onDelete("set null"),
  ],
);

/** The candidate's answer to one question in one stage run (hiring solution design 2.4). */
export const hiringResponses = pgTable(
  "hiring_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageRunId: uuid("stage_run_id")
      .notNull()
      .references(() => hiringStageRuns.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => hiringActivities.id),
    payload: jsonb("payload").$type<HiringResponsePayload>().notNull().default({}),
    /** The take that is the answer (the newest one). Purging media leaves the response. */
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    /** Every take opened for this question, oldest first; takes are counted from these rows. */
    takeAssetIds: jsonb("take_asset_ids").$type<string[]>().notNull().default([]),
    fileAssetIds: jsonb("file_asset_ids").$type<string[]>().notNull().default([]),
    takesUsed: integer("takes_used").notNull().default(0),
    usedTextAlternative: boolean("used_text_alternative").notNull().default(false),
    /** Choice questions only, 0..1, for the separate knowledge score; never sent to the candidate. */
    autoScore: real("auto_score"),
    /** When the candidate closed this question (moved on, submitted, or the stage closed). */
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("hiring_response_per_activity").on(t.stageRunId, t.activityId),
    index("hiring_responses_media_idx").on(t.mediaAssetId),
    check("hiring_response_takes", sql`${t.takesUsed} >= 0`),
    check("hiring_response_auto_score", sql`${t.autoScore} IS NULL OR (${t.autoScore} >= 0 AND ${t.autoScore} <= 1)`),
  ],
);

/** HIRING-UX 6.13: the optional experience survey, one answer per invitation. */
export const hiringSurveyResponses = pgTable(
  "hiring_survey_responses",
  {
    assessmentId: uuid("assessment_id").primaryKey(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("hiring_survey_rating", sql`${t.rating} BETWEEN 1 AND 5`),
    foreignKey({
      name: "hiring_survey_assessment_fk",
      columns: [t.assessmentId],
      foreignColumns: [hiringAssessments.assessmentId],
    }).onDelete("cascade"),
  ],
);
```

- [ ] **Step 5: Generate and review the migration**

```bash
pnpm db:generate --name hiring_candidate_flow
```
Read `drizzle/migrations/0010_hiring_candidate_flow.sql`. Expected: two `ALTER TABLE ... ADD COLUMN` (`consent_texts.solution`, `hiring_openings.finish_survey_enabled`), five `CREATE TABLE`, `ADD CONSTRAINT "hiring_versions_id_opening_org" UNIQUE("id","opening_id","org_id")`, the foreign keys and indexes, no `DROP`, no `UPDATE`. drizzle-kit emits the UNIQUE after the foreign keys: move the line `ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_versions_id_opening_org" UNIQUE("id","opening_id","org_id");--> statement-breakpoint` above the first `ALTER TABLE "hiring_assessments" ADD CONSTRAINT` line, and add at the top of the file:

```sql
-- Reviewed by hand: the UNIQUE (id, opening_id, org_id) on hiring_versions moved
-- above the composite foreign key that references it (drizzle-kit emits it
-- after, and Postgres refuses a foreign key without a unique target). DDL fires
-- no row triggers, so the 0006 freeze of published versions is not touched.
```
Do not edit `meta/*`.

- [ ] **Step 6: Prove the migration equals the schema, then apply it**

Stop any dev server this session started. Then:
```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_push_check" -c "create database kademe_push_check" -c "drop database if exists kademe_mig_check" -c "create database kademe_mig_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm exec drizzle-kit push --force < /dev/null 2>&1 | tee /tmp/kademe-push.log
grep -i "error" /tmp/kademe-push.log && echo "PUSH LOG HAS AN ERROR" || echo "push log clean"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm -s db:fingerprint > /tmp/kademe-push.fp
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm -s db:fingerprint > /tmp/kademe-mig.fp
diff /tmp/kademe-push.fp /tmp/kademe-mig.fp && echo IDENTICAL
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_push_check" -c "drop database kademe_mig_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate
docker exec kademe-db psql -U kademe -d kademe_platform -Atc "select solution, count(*) from consent_texts group by 1"
```
Expected: `push log clean`, `IDENTICAL`, `migrations applied`, and every existing consent text reported as `LANGUAGE_EXAM`.

- [ ] **Step 7: Run the tests and the gates**

```bash
pnpm exec vitest run src/db/migrations-sql.test.ts src/db/migration-files.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
Expected: PASS everywhere; `verify:exam` prints only `ok` lines.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema/compliance.ts src/db/schema/hiring.ts src/db/migrations-sql.test.ts drizzle/migrations/0010_hiring_candidate_flow.sql drizzle/migrations/meta/0010_snapshot.json drizzle/migrations/meta/_journal.json
git commit -m "Add the hiring invitation, run, response and survey tables

Migration 0010 gives consent texts a solution (every existing row stays the
exam's), adds the finish survey switch to openings and creates
hiring_assessments, hiring_assignments, hiring_stage_runs, hiring_responses
and hiring_survey_responses with composite tenancy keys. Additive only; no
published hiring version is touched.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Contract hooks, serving check, consent by solution, transcription hint, cron hook

**Files:**
- Modify: `src/solutions/types.ts` (whole file below)
- Modify: `src/solutions/registry.ts`, `src/solutions/registry.server.ts`
- Modify: `src/solutions/language-exam/manifest.ts`, `src/solutions/language-exam/module.ts`
- Modify: `src/solutions/hiring/manifest.ts`, `src/solutions/hiring/module.ts`, `src/solutions/hiring/module.test.ts`
- Modify: `src/lib/candidate-api.ts`, `src/lib/candidate-context.ts`, `src/lib/transcribe-job.ts`
- Modify: `src/app/api/c/[token]/consent/route.ts`, `src/app/api/cron/close-expired/route.ts`
- Test: `src/solutions/registry.test.ts`, `src/lib/candidate-api.test.ts`, `src/lib/candidate-context.test.ts` (new), `src/app/api/c/[token]/consent/route.test.ts` (new)

**Interfaces:**
- Produces (types, `@/solutions/types`): `CandidateStepState = { step: string; position?: number | null }`; `CandidatePageSlot = "landing" | "info" | "check" | "practice" | "stage" | "done"`; `CandidatePageInput = { token: string; resolved: ResolveResult & { ctx: CandidateContext }; searchParams: Record<string, string | string[] | undefined>; params: Record<string, string> }`; `ConsentTextRow`.
- Produces (manifest): `inviteLabel: I18nLabel`, `inviteCapability: Capability`, `transcriptionHint: string | null`, `accommodationRequests: boolean`.
- Produces (module): `candidate.serves?(ctx): Promise<boolean>`, `candidate.consentText(ctx): Promise<ConsentTextRow>`, `candidate.renderPage?(slot, input): Promise<ReactNode>`, `attempts.closeExpired?(now: Date, limit: number): Promise<{ scanned: number; closed: number }>`.
- Produces: `servingSolution(ctx: CandidateContext, modules?): Promise<SolutionModule | null>` (`@/solutions/registry.server`); `transcriptionHintFor(kind: SolutionKind | null, manifests?): string | null` and `inviteTargets(manifests?): InviteTarget[]` with `InviteTarget = { key: SolutionKey; href: string; label: I18nLabel; capability: Capability }` (`@/solutions/registry`).
- Behaviour: `withCandidate` without `acceptSolution` and `withSolution` answer an invitation that no live module serves (`servingSolution` null) exactly like an unknown token; `getConsentText(ctx)` reads only texts of `ctx.assessment.solution`; the consent route uses the module's `consentText`.

- [ ] **Step 1: Write the failing tests**

1. `src/lib/candidate-context.test.ts` (new):

```ts
import { describe, expect, it, vi } from "vitest";
import type { CandidateContext } from "./candidate-context";

const seen = vi.hoisted(() => ({ where: null as null | { sql: string; params: unknown[] } }));

vi.mock("@/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const { SQL } = await import("drizzle-orm");
  const dialect = new PgDialect();
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: () => chain,
    from: () => chain,
    where: (condition: unknown) => {
      if (condition instanceof SQL) seen.where = dialect.sqlToQuery(condition);
      return chain;
    },
    orderBy: () => chain,
    limit: async () => [{ id: "ct-1", orgId: "o1", solution: "HIRING", version: 3, body: { tr: "Metin", en: "Text" } }],
  });
  return { db: chain };
});

import { getConsentText } from "./candidate-context";

describe("getConsentText", () => {
  it("reads the newest consent text of the invitation's own solution, so exam and hiring copy never cross", async () => {
    const ctx = { assessment: { id: "a1", orgId: "o1", solution: "HIRING" } } as CandidateContext;
    const text = await getConsentText(ctx);
    expect(text.id).toBe("ct-1");
    expect(seen.where?.sql).toContain('"consent_texts"."org_id" = $1');
    expect(seen.where?.sql).toContain('"consent_texts"."solution" = $2');
    expect(seen.where?.params).toEqual(["o1", "HIRING"]);
  });
});
```

2. `src/app/api/c/[token]/consent/route.test.ts` (new):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  ctx: { assessment: { id: "a1", orgId: "o1", solution: "HIRING" }, locale: "tr" },
  consentText: vi.fn(async () => ({ id: "ct-hiring", version: 2, body: { tr: "İşe alım metni", en: "Hiring text" } })),
  loadState: vi.fn(async () => ({ step: "INFO" })),
  recordConsent: vi.fn(async () => undefined),
  hasConsented: vi.fn(async () => false),
  getConsentText: vi.fn(async () => {
    throw new Error("the core text must not be read for a solution that names its own");
  }),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/candidate-context", () => ({
  getConsentText: h.getConsentText,
  hasConsented: h.hasConsented,
  recordConsent: h.recordConsent,
}));
vi.mock("@/lib/candidate-api", () => ({
  withSolution: (req: unknown, _params: unknown, handler: (r: unknown, c: unknown, s: unknown) => unknown) =>
    handler(req, h.ctx, { candidate: { consentText: h.consentText, loadState: h.loadState } }),
  badRequest: () => new Response(JSON.stringify({ error: "CONSENT_REQUIRED" }), { status: 400 }),
  clientIp: () => "127.0.0.1",
  userAgent: () => "test",
  readJson: async (req: Request) => req.json(),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const params = Promise.resolve({ token: "t".repeat(43) });

beforeEach(() => {
  h.consentText.mockClear();
  h.recordConsent.mockClear();
});

describe("consent route", () => {
  it("shows the copy the solution names for this invitation", async () => {
    const res = await GET(new NextRequest("http://localhost/api/c/x/consent"), { params });
    expect(await res.json()).toMatchObject({ version: 2, body: "İşe alım metni" });
    expect(h.consentText).toHaveBeenCalledTimes(1);
  });

  it("records exactly that text's id", async () => {
    const res = await POST(new NextRequest("http://localhost/api/c/x/consent", { method: "POST", body: JSON.stringify({ accepted: true }) }), { params });
    expect(res.status).toBe(200);
    expect(h.recordConsent).toHaveBeenCalledWith(h.ctx, "ct-hiring", "127.0.0.1", "test");
  });
});
```

3. In `src/lib/candidate-api.test.ts`:
   - Replace the `Stub` type and the registry mock with:
```ts
type Stub = { registered: boolean; live: boolean; serves?: boolean };
const registry: Record<string, Stub> = {};
vi.mock("@/solutions/registry.server", () => {
  const find = (kind: string) =>
    registry[kind]?.registered ? { key: kind.toLowerCase(), dbKind: kind, candidateFlowLive: registry[kind].live } : null;
  const candidateSolution = (kind: string) => {
    const m = find(kind);
    return m && m.candidateFlowLive ? m : null;
  };
  return {
    solutionModule: find,
    candidateSolution,
    servingSolution: async (ctx: { assessment: { solution: string } }) => {
      const m = candidateSolution(ctx.assessment.solution);
      return m && (registry[ctx.assessment.solution]?.serves ?? true) ? m : null;
    },
  };
});
```
   - Add inside `describe("withCandidate without acceptSolution", ...)`:
```ts
  it.each(links)("answers a %s HIRING link whose live module does not serve it (no hiring terms) like an unknown token", async (_name, problem, link) => {
    registry.HIRING = { registered: true, live: true, serves: false };
    await expectUnknown(problem, link);
  });
```
   - Add inside `describe("withSolution", ...)`:
```ts
  it("answers a live solution that does not serve the invitation like an unknown token", async () => {
    registry.HIRING = { registered: true, live: true, serves: false };
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const { res, handler } = await solutionCall("hiring-token-of-sufficient-length");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("INVALID");
    expect(handler).not.toHaveBeenCalled();
  });

  it("hands the serving module to the handler once the serving check passed", async () => {
    registry.HIRING = { registered: true, live: true, serves: true };
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const { handler } = await solutionCall("hiring-token-of-sufficient-length");
    expect(handler.mock.calls[0][2]).toMatchObject({ dbKind: "HIRING" });
  });
```

4. In `src/solutions/registry.test.ts`:
   - Change the registry import line to `import { buildNav, inviteTargets, manifestByKind, SOLUTION_MANIFESTS, transcriptionHintFor } from "./registry";` and the server import to `import { candidateSolution, servingSolution, solutionModule, solutionModules } from "./registry.server";`.
   - Replace the body of the test `"invites from Today with the first solution that can invite, not the first in the menu"` with:
```ts
    expect(inviteTargets()).toEqual([
      { key: "language-exam", href: "/exam/students/new", label: { tr: "Öğrenci davet et", en: "Invite a student" }, capability: "student:invite" },
    ]);
    const noInvite = { ...languageExamManifest, inviteHref: null } as SolutionManifest;
    expect(inviteTargets([noInvite])).toEqual([]);
```
   - Append:
```ts
describe("contract additions (plan 2)", () => {
  it("transcribes exam recordings as German and lets the provider detect hiring answers", () => {
    expect(transcriptionHintFor("LANGUAGE_EXAM")).toBe("de");
    expect(transcriptionHintFor("HIRING")).toBeNull();
    expect(transcriptionHintFor(null)).toBeNull();
  });

  it("offers accommodation requests where the solution reads them", () => {
    expect(manifestByKind("HIRING")?.accommodationRequests).toBe(true);
    expect(manifestByKind("LANGUAGE_EXAM")?.accommodationRequests).toBe(false);
  });

  it("serves an invitation only through a live module that serves it", async () => {
    const exam = solutionModule("LANGUAGE_EXAM")!;
    const ctxOf = (solution: "HIRING" | "LANGUAGE_EXAM") => ({ assessment: { id: "a", orgId: "o", solution } }) as Parameters<typeof servingSolution>[0];
    const hiring = (serves: boolean) =>
      ({ ...exam, key: "hiring", dbKind: "HIRING", candidateFlowLive: true, candidate: { ...exam.candidate, serves: async () => serves } }) as SolutionModule;
    expect((await servingSolution(ctxOf("LANGUAGE_EXAM"), [exam]))?.key).toBe("language-exam");
    expect(await servingSolution(ctxOf("HIRING"), [exam, hiring(false)])).toBeNull();
    expect((await servingSolution(ctxOf("HIRING"), [exam, hiring(true)]))?.key).toBe("hiring");
    expect(await servingSolution(ctxOf("HIRING"), [exam, { ...hiring(true), candidateFlowLive: false }])).toBeNull();
  });
});
```

5. In `src/solutions/hiring/module.test.ts`, add `await expect(hiringModule.candidate.consentText(ctx)).rejects.toThrow(/not live/);` to the test `"refuses every candidate call loudly instead of guessing"`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/lib/candidate-context.test.ts src/app/api/c/\[token\]/consent/route.test.ts src/lib/candidate-api.test.ts src/solutions/registry.test.ts src/solutions/hiring/module.test.ts`
Expected: FAIL (solution not in the WHERE; `consentText` not called; serves ignored; `transcriptionHintFor` not exported; `consentText` not a function).

- [ ] **Step 3: Replace `src/solutions/types.ts`**

```ts
import type { ReactNode } from "react";
import type { StatusTone } from "@/components/ui/status-dot";
import type { consentTexts, mediaAssets } from "@/db/schema";
import type { solution } from "@/db/schema/enums";
import type { Locale } from "@/i18n/locale";
import type { Capability } from "@/lib/authorize";
import type { CandidateContext, ResolveResult } from "@/lib/candidate-context";
import type { ProctoringPolicy } from "@/lib/proctor/policy";

/**
 * The solution contract (spec 3). Core code knows solutions only through
 * these types and the two registries; ESLint forbids importing a solution's
 * folder from anywhere else.
 */

/** The database value. A new solution adds one value to the `solution` enum. */
export type SolutionKind = (typeof solution.enumValues)[number];
export type SolutionKey = "language-exam" | "hiring";
export type I18nLabel = { tr: string; en: string };
export type NavLink = { href: string; label: I18nLabel };
/** The part of a solution's candidate state the core routes on. `position` is the running part's number, when the solution has one. */
export type CandidateStepState = { step: string; position?: number | null };

/** The pages `/a/[token]/*` hosts. A solution renders the ones its flow uses (renderPage). */
export type CandidatePageSlot = "landing" | "info" | "check" | "practice" | "stage" | "done";
export type CandidatePageInput = {
  token: string;
  /** The resolved link, problems included: the solution decides how an expired or finished link of its own looks. */
  resolved: ResolveResult & { ctx: CandidateContext };
  searchParams: Record<string, string | string[] | undefined>;
  /** Route parameters beyond the token, e.g. `{ n: "2" }` on /stage/[n]. */
  params: Record<string, string>;
};
export type ConsentTextRow = typeof consentTexts.$inferSelect;

/** Library rows a screen asks about (HIRING-UX 4.2 "Nerede kullanılıyor"). */
export type LibraryRefs = { positionIds: string[]; competencyIds: string[] };
export type LibraryUsageEntry = {
  /** Everything in this solution that uses the row (e.g. openings). */
  total: number;
  /** Of those, the open openings whose published version uses the row. */
  live: number;
  /** Only what the viewer may open; total - items.length are counted but not named. */
  items: Array<{ label: string; href: string }>;
};
/** Who asks: a solution names and links only what this person may open. */
export type LibraryViewer = { id: string; role: "OWNER" | "MANAGER" | "REVIEWER" };
export type LibraryUsage = {
  positions: Record<string, LibraryUsageEntry>;
  competencies: Record<string, LibraryUsageEntry>;
};

/** Client-safe: plain data and pure functions only. */
export interface SolutionManifest {
  key: SolutionKey;
  dbKind: SolutionKind;
  basePath: "/exam" | "/hiring";
  /** Menu group header (shown only when more than one solution is registered). */
  label: I18nLabel;
  /** Menu entries, in menu order. Only routes that exist (RULES.md rule 7). */
  nav: NavLink[];
  /** Where "invite" on Today leads for this solution; null while it cannot invite yet. */
  inviteHref: string | null;
  /** The words of this solution's invite on Today ("Aday davet et"), and who may use it. */
  inviteLabel: I18nLabel;
  inviteCapability: Capability;
  /**
   * True once this solution's candidate screens and endpoints exist. Until
   * then every core candidate route and page answers its invitations exactly
   * like an unknown token, even though the panel already uses the module.
   */
  candidateFlowLive: boolean;
  /** Language hint for transcribing this solution's recordings; null lets the provider detect it. */
  transcriptionHint: string | null;
  /** True when this solution reads accommodation requests (HIRING-UX 6.1 "Başka düzenleme"). */
  accommodationRequests: boolean;
  /** An action this solution offers on a position page (the primary button there). */
  positionAction?: { label: I18nLabel; href(positionId: string): string };
  /** Where `/a/[token]` sends the candidate for a given state of this solution. */
  candidateStepPath(token: string, state: CandidateStepState): string;
}

export type TodayCell =
  | { kind: "text"; text: string }
  | { kind: "level"; text: string | null; final: boolean }
  | { kind: "dot"; tone: StatusTone; text: string };

/** One row on the shared Today screen. */
export type TodayItem = {
  id: string;
  solution: SolutionKey;
  /** "review": waiting for a person, oldest first. "running": in progress now. */
  lane: "review" | "running";
  title: string;
  subtitle: string | null;
  href: string;
  sortAt: Date | null;
  /** review: exactly four cells (detail, level, status, integrity). running: one dot. */
  cells: TodayCell[];
};

/** A running part of an attempt, as the solution names it (proctor_events.segment_*). */
export type SegmentRef = { kind: string; runId: string };
export type MediaAssetRow = typeof mediaAssets.$inferSelect;

/** Server-only: everything a solution answers for the core. */
export interface SolutionModule extends SolutionManifest {
  /** Rows for the shared Today screen. */
  today(orgId: string, userId: string, locale: Locale): Promise<TodayItem[]>;
  /** The proctoring policy frozen on this invitation; null when the solution has no proctoring. */
  proctorPolicy(assessmentId: string): Promise<ProctoringPolicy | null>;
  candidate: {
    /**
     * False when this invitation lacks the solution's own terms (no row of its
     * own); the core then answers it exactly like an unknown token. Omitted:
     * every invitation of this solution is served.
     */
    serves?(ctx: CandidateContext): Promise<boolean>;
    /** The state document the candidate screens read; its `step` drives routing. */
    loadState(ctx: CandidateContext): Promise<CandidateStepState>;
    /** What the invitation is called, for problem reports. */
    title(ctx: CandidateContext): Promise<string>;
    /** Keeps the solution's clock alive; returns the running deadline, if any. */
    heartbeat(ctx: CandidateContext): Promise<{ deadlineAt: Date | null }>;
    /** The consent copy this invitation shows and records (a consent_texts row). */
    consentText(ctx: CandidateContext): Promise<ConsentTextRow>;
    /** Renders a core candidate page for this solution. Omitted: the core's own pages (the exam's) render. */
    renderPage?(slot: CandidatePageSlot, input: CandidatePageInput): Promise<ReactNode>;
  };
  attempts: {
    /** The timed part of the attempt that is running now, for proctoring records. */
    openSegment(attemptId: string): Promise<SegmentRef | null>;
    /** Close whatever is open and finish the attempt (termination by policy). */
    terminate(attemptId: string): Promise<void>;
    /** A recording finished uploading; attach it wherever the solution keeps answers. */
    onMediaComplete(asset: MediaAssetRow): Promise<void>;
    /** Cron: close this solution's timed parts whose clock ran out. Omitted: the core's own sweep covers it. */
    closeExpired?(now: Date, limit: number): Promise<{ scanned: number; closed: number }>;
  };
  /** Where this solution uses library rows. Optional: a solution that never reads the library omits it. */
  library?: {
    /** `viewer` null asks for counts only (no names, no links), e.g. an "is it used" check. */
    usage(orgId: string, refs: LibraryRefs, viewer: LibraryViewer | null): Promise<LibraryUsage>;
  };
}
```

- [ ] **Step 4: Registries**

In `src/solutions/registry.ts`:
- Change the type import to `import type { I18nLabel, SolutionKey, SolutionKind, SolutionManifest } from "@/solutions/types";` and add `import type { Capability } from "@/lib/authorize";`.
- Replace `inviteTargets` with:
```ts
export type InviteTarget = { key: SolutionKey; href: string; label: I18nLabel; capability: Capability };

/**
 * Solutions Today can invite for, in menu order, with their own label and the
 * capability that invite needs. Today shows only the ones the user may use.
 */
export function inviteTargets(manifests: readonly SolutionManifest[] = SOLUTION_MANIFESTS): InviteTarget[] {
  return manifests.flatMap((m) => (m.inviteHref ? [{ key: m.key, href: m.inviteHref, label: m.inviteLabel, capability: m.inviteCapability }] : []));
}

/** The language hint for transcribing a solution's recordings; null lets the provider detect it. */
export function transcriptionHintFor(kind: SolutionKind | null, manifests: readonly SolutionManifest[] = SOLUTION_MANIFESTS): string | null {
  if (!kind) return null;
  return manifests.find((m) => m.dbKind === kind)?.transcriptionHint ?? null;
}
```

In `src/solutions/registry.server.ts`, add `import type { CandidateContext } from "@/lib/candidate-context";` and append:
```ts
/**
 * The live module that serves this invitation, or null. Null for an unknown
 * or not-live solution and for an invitation the module does not serve (no row
 * of its own). Every core candidate route and page answers null exactly like an
 * unknown token (spec 6). `modules` exists for tests.
 */
export async function servingSolution(
  ctx: CandidateContext,
  modules: readonly SolutionModule[] = MODULES,
): Promise<SolutionModule | null> {
  const found = candidateSolution(ctx.assessment.solution, modules);
  if (!found) return null;
  if (found.candidate.serves && !(await found.candidate.serves(ctx))) return null;
  return found;
}
```

- [ ] **Step 5: Exam and hiring manifests and modules**

In `src/solutions/language-exam/manifest.ts`, after `inviteHref`, add:
```ts
  inviteLabel: { tr: "Öğrenci davet et", en: "Invite a student" },
  inviteCapability: "student:invite",
```
and after `candidateFlowLive: true,`:
```ts
  // Speaking answers are German whatever the interface language is (unchanged behaviour).
  transcriptionHint: "de",
  accommodationRequests: false,
```

In `src/solutions/language-exam/module.ts`, change the candidate-context import to `import { getConsentText, type CandidateContext } from "@/lib/candidate-context";` and add inside `candidate: { ... }` after `heartbeat`:
```ts
    async consentText(ctx) {
      return getConsentText(ctx);
    },
```

In `src/solutions/hiring/manifest.ts`, after `inviteHref: null,` add:
```ts
  inviteLabel: { tr: "Aday davet et", en: "Invite a candidate" },
  inviteCapability: "opening:write",
```
and after `candidateFlowLive: false,`:
```ts
  // Candidates answer in their own language; the provider detects it.
  transcriptionHint: null,
  accommodationRequests: true,
```

In `src/solutions/hiring/module.ts`, add inside `candidate: { ... }` after `heartbeat`:
```ts
    async consentText() {
      return notLive("consentText");
    },
```

- [ ] **Step 6: The candidate API serves only what a live module serves**

In `src/lib/candidate-api.ts`:
- Change the registry import to `import { servingSolution } from "@/solutions/registry.server";`.
- Below `unknownTokenResponse`, add:
```ts
/** The module withCandidate found for a context, so withSolution does not ask twice. */
const servedBy = new WeakMap<CandidateContext, SolutionModule>();
```
- In `withCandidate`, replace the block from `// Default: only solutions whose candidate flow is live` up to and including its `if (resolved.ctx && !accept(...)) { ... }` with:
```ts
  // Default: only invitations a live module serves (servingSolution), so no core
  // route can reveal an invitation of a solution that cannot answer for it, or an
  // invitation that lacks its solution's own terms.
  if (resolved.ctx) {
    if (options.acceptSolution) {
      if (!options.acceptSolution(resolved.ctx.assessment.solution)) return unknownTokenResponse(req);
    } else {
      const module = await servingSolution(resolved.ctx);
      if (!module) return unknownTokenResponse(req);
      servedBy.set(resolved.ctx, module);
    }
  }
```
- Update the `acceptSolution` doc comment's last sentence to: `Defaults to "a live module serves this invitation" (servingSolution).`
- Replace `withSolution` with:
```ts
/**
 * `withCandidate` for core endpoints whose answer depends on the solution
 * (state, consent, proctoring). An invitation no live module serves gets the
 * unknown-token 404. The check runs inside `withCandidate`, as soon as the
 * token resolves, so it cannot be told apart from an unknown token by the
 * link's state either.
 */
export function withSolution(
  req: NextRequest,
  params: Promise<{ token: string }>,
  handler: SolutionHandler,
  options: CandidateRouteOptions = {},
): Promise<Response> {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const solution = servedBy.get(ctx) ?? (await servingSolution(ctx));
      if (!solution) return notFoundForSolution(request);
      return handler(request, ctx, solution);
    },
    // The serving check is the default; an `acceptSolution` in `options` is dropped.
    { ...options, acceptSolution: undefined },
  );
}
```

- [ ] **Step 7: Consent by solution**

In `src/lib/candidate-context.ts`, replace `getConsentText` with:
```ts
/** The newest consent text of the invitation's own solution: the exam's and hiring's copy differ. */
export async function getConsentText(ctx: CandidateContext) {
  const [text] = await db
    .select()
    .from(consentTexts)
    .where(and(eq(consentTexts.orgId, ctx.assessment.orgId), eq(consentTexts.solution, ctx.assessment.solution)))
    .orderBy(desc(consentTexts.version))
    .limit(1);
  if (!text) throw new Error(`no ${ctx.assessment.solution} consent text configured for this organisation`);
  return text;
}
```

Replace `src/app/api/c/[token]/consent/route.ts` with:
```ts
import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { hasConsented, recordConsent } from "@/lib/candidate-context";
import { badRequest, clientIp, readJson, userAgent, withSolution } from "@/lib/candidate-api";

/** The exact consent copy on screen, with the version that will be recorded. The solution names the text. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withSolution(req, params, async (_req, ctx, solution) => {
    const text = await solution.candidate.consentText(ctx);
    return candidateJson({
      version: text.version,
      body: text.body[ctx.locale] || text.body.tr,
      accepted: await hasConsented(ctx.assessment.id),
    });
  });
}

/**
 * Records which version of the consent copy was accepted, when, and from where.
 * A year later this is what proves what the candidate actually agreed to.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withSolution(req, params, async (request, ctx, solution) => {
    const body = await readJson<{ accepted?: boolean }>(request);
    if (!body?.accepted) {
      return badRequest(ctx, "CONSENT_REQUIRED");
    }
    if (!(await hasConsented(ctx.assessment.id))) {
      const text = await solution.candidate.consentText(ctx);
      await recordConsent(ctx, text.id, clientIp(request), userAgent(request));
    }
    return candidateJson(await solution.candidate.loadState(ctx));
  });
}
```

- [ ] **Step 8: Transcription hint and the cron hook**

In `src/lib/transcribe-job.ts`, add `import { transcriptionHintFor } from "@/solutions/registry";`, add `solution: assessments.solution,` to the first select (next to `locale: assessments.locale`), and replace the `languageHint` line and its comment with:
```ts
      // The solution names the language: the exam's speaking answers are German
      // whatever the interface language is; a hiring candidate answers in their own
      // language, which the provider detects (null). Still only a hint.
      languageHint: transcriptionHintFor(row.solution),
```

In `src/app/api/cron/close-expired/route.ts`, add `import { solutionModules } from "@/solutions/registry.server";` and replace the last two statements of `POST` (from `const runs = ...` to the `return`) with:
```ts
  const runs = await closeExpiredRuns(now, BATCH);
  const links = await expireLinks(now);
  // Solutions with their own timed parts close them here (hiring stage runs).
  const solutions: Record<string, unknown> = {};
  for (const module of solutionModules()) {
    if (!module.attempts.closeExpired) continue;
    try {
      solutions[module.key] = await module.attempts.closeExpired(now, BATCH);
    } catch (error) {
      console.error(`[close-expired] ${module.key} sweep failed`, error);
      solutions[module.key] = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  return Response.json({ at: now.toISOString(), runs, links, uploads, solutions });
```

- [ ] **Step 9: Run the tests and the gates**

```bash
pnpm exec vitest run src/lib/candidate-context.test.ts src/app/api/c/\[token\]/consent/route.test.ts src/lib/candidate-api.test.ts src/lib/candidate-api.registered-hiring.test.ts src/solutions/registry.test.ts src/solutions/hiring/module.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
```
Expected: PASS. One expectation changed by design (declared): `registry.test.ts` "invites from Today with the first solution that can invite, not the first in the menu" now also expects the label and capability.

- [ ] **Step 10: Exam and guard unchanged**

```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm dev --port 3100   # separate shell, check the port first
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard
lsof -nP -iTCP:3100 -sTCP:LISTEN -t | xargs kill
```
Expected: `verify:exam` only `ok`; `verify:guard` 31 `ok` (hiring is still not live, so every check keeps its meaning).

- [ ] **Step 11: Commit**

```bash
git add src/solutions/types.ts src/solutions/registry.ts src/solutions/registry.server.ts src/solutions/registry.test.ts src/solutions/language-exam/manifest.ts src/solutions/language-exam/module.ts src/solutions/hiring/manifest.ts src/solutions/hiring/module.ts src/solutions/hiring/module.test.ts src/lib/candidate-api.ts src/lib/candidate-api.test.ts src/lib/candidate-context.ts src/lib/candidate-context.test.ts src/lib/transcribe-job.ts "src/app/api/c/[token]/consent/route.ts" "src/app/api/c/[token]/consent/route.test.ts" src/app/api/cron/close-expired/route.ts
git commit -m "Grow the solution contract for the hiring candidate flow

The contract gains candidate.serves, candidate.consentText,
candidate.renderPage and attempts.closeExpired, and the manifest gains the
invite label and capability, the transcription hint and accommodation
requests. Core candidate routes now serve only invitations a live module
serves, consent texts are read per solution, transcription asks the
manifest for its language, and the cron runs each module's own sweep.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Core candidate pages ask the solution first; accommodation and new-link requests

**Files:**
- Create: `src/lib/candidate-pages.ts`, `src/components/candidate/UnknownLink.tsx`
- Create: `src/app/a/[token]/practice/page.tsx`, `src/app/a/[token]/stage/[n]/page.tsx`
- Modify: `src/app/a/[token]/page.tsx`, `info/page.tsx`, `check/page.tsx`, `done/page.tsx`, `rights/page.tsx`
- Modify: `src/components/candidate/InfoForm.tsx`, `src/components/candidate/RightsForm.tsx`, `src/lib/candidate-routes.ts`
- Modify: `src/app/api/c/[token]/rights/route.ts`, `src/app/api/c/[token]/problem/route.ts`
- Modify: `src/i18n/messages/candidate.tr.json`, `src/i18n/messages/candidate.en.json` (`rights` namespace)
- Test: `src/lib/candidate-pages.test.ts`, `src/lib/candidate-routes.test.ts`, `src/app/a/[token]/rights/page.test.ts`, `src/app/api/c/[token]/rights/route.test.ts`, `src/app/api/c/[token]/problem/route.test.ts`

**Interfaces:**
- Consumes: `servingSolution` (Task 2), `CandidatePageSlot`, `CandidatePageInput`, `manifestByKind(kind).accommodationRequests`.
- Produces: `solutionPage(token: string, slot: CandidatePageSlot, searchParams?: PageSearchParams, params?: Record<string, string>): Promise<ReactNode | undefined>` and `type PageSearchParams` in `@/lib/candidate-pages`; `<UnknownLink token />`; `nextPath(token: string, state: { step: string; path?: string }): string` in `@/lib/candidate-routes` (`path` is relative to `/a/[token]`); `RightsForm` props `{ token: string; kinds?: RightsKind[]; initialKind?: RightsKind | null }` with `type RightsKind = "ACCESS" | "COPY" | "DELETE" | "ACCOMMODATION"` exported from `@/components/candidate/RightsForm`.
- Behaviour: every `/a/[token]/*` page returns the solution's page when a live module that serves the invitation has `renderPage`; otherwise it renders exactly as before (exam), and `/practice` and `/stage/[n]` show the invalid-link card. `POST /rights` accepts `ACCOMMODATION` only for solutions with `accommodationRequests`. `POST /problem` with `area: "LINK"` also writes a `deletion_requests` row of kind `NEW_LINK`.

- [ ] **Step 1: Write the failing tests**

1. `src/lib/candidate-pages.test.ts` (new):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  resolveToken: vi.fn(),
  module: null as null | { candidate: { renderPage?: (...args: unknown[]) => Promise<unknown> } },
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/candidate-context", () => ({ resolveToken: h.resolveToken }));
vi.mock("@/solutions/registry.server", () => ({ servingSolution: async () => h.module }));

import { solutionPage } from "./candidate-pages";

const ctx = { assessment: { id: "a1", orgId: "o1", solution: "HIRING" } };

beforeEach(() => {
  h.resolveToken.mockReset();
  h.module = null;
});

describe("solutionPage", () => {
  it("leaves an unknown token to the core page", async () => {
    h.resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    expect(await solutionPage("t", "landing")).toBeUndefined();
  });

  it("leaves an invitation no live module serves to the core page", async () => {
    h.resolveToken.mockResolvedValueOnce({ ok: true, ctx });
    expect(await solutionPage("t", "landing")).toBeUndefined();
  });

  it("leaves a module without its own pages (the exam) to the core page", async () => {
    h.resolveToken.mockResolvedValueOnce({ ok: true, ctx });
    h.module = { candidate: {} };
    expect(await solutionPage("t", "landing")).toBeUndefined();
  });

  it("asks a module with its own pages, problems, search and route params included", async () => {
    const resolved = { ok: false, problem: "EXPIRED", ctx };
    h.resolveToken.mockResolvedValueOnce(resolved);
    const renderPage = vi.fn(async () => "PAGE");
    h.module = { candidate: { renderPage } };
    const page = await solutionPage("tok", "stage", Promise.resolve({ lang: "en" }), { n: "2" });
    expect(page).toBe("PAGE");
    expect(renderPage).toHaveBeenCalledWith("stage", { token: "tok", resolved, searchParams: { lang: "en" }, params: { n: "2" } });
  });
});
```

2. `src/lib/candidate-routes.test.ts` (new):

```ts
import { describe, expect, it } from "vitest";
import { nextPath } from "./candidate-routes";

describe("nextPath", () => {
  it("follows the page a solution's state names, relative to the token", () => {
    expect(nextPath("tok", { step: "STAGE", path: "/stage/2" })).toBe("/a/tok/stage/2");
    expect(nextPath("t k", { step: "CONSENT", path: "" })).toBe("/a/t%20k");
  });

  it("keeps the exam's own step mapping when the state names no path", () => {
    expect(nextPath("tok", { step: "CHECK" })).toBe("/a/tok/check");
    expect(nextPath("tok", { step: "ITEM" })).toBe("/a/tok/exam");
  });
});
```

3. `src/app/api/c/[token]/rights/route.test.ts` (new):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inserted: [] as unknown[],
  ctx: { assessment: { id: "a1", orgId: "o1", solution: "HIRING" }, candidate: { id: "c1" }, locale: "tr" },
}));

vi.mock("@/db", () => ({ db: { insert: () => ({ values: async (v: unknown) => void h.inserted.push(v) }) } }));
vi.mock("@/lib/candidate-api", () => ({
  withCandidate: (req: unknown, _p: unknown, handler: (r: unknown, c: unknown) => unknown) => handler(req, h.ctx),
  badRequest: (_ctx: unknown, code: string) => new Response(JSON.stringify({ error: code }), { status: 400 }),
  message: () => "ok",
  readJson: async (req: Request) => req.json(),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const params = Promise.resolve({ token: "t".repeat(43) });
const send = (body: unknown) => POST(new NextRequest("http://localhost/api/c/x/rights", { method: "POST", body: JSON.stringify(body) }), { params });

beforeEach(() => {
  h.inserted = [];
  h.ctx.assessment.solution = "HIRING";
});

describe("rights route", () => {
  it("records an accommodation request for a solution that reads them", async () => {
    const res = await send({ kind: "ACCOMMODATION", message: "Video yerine yazılı cevap" });
    expect(res.status).toBe(200);
    expect(h.inserted).toEqual([{ candidateId: "c1", kind: "ACCOMMODATION", message: "Video yerine yazılı cevap" }]);
  });

  it("refuses an accommodation request where the solution does not read them", async () => {
    h.ctx.assessment.solution = "LANGUAGE_EXAM";
    const res = await send({ kind: "ACCOMMODATION" });
    expect(res.status).toBe(400);
    expect(h.inserted).toEqual([]);
  });

  it("still takes the three data rights requests", async () => {
    for (const kind of ["ACCESS", "COPY", "DELETE"]) expect((await send({ kind })).status).toBe(200);
    expect(h.inserted).toHaveLength(3);
  });
});
```

4. `src/app/api/c/[token]/problem/route.test.ts` (new):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inserted: [] as Array<{ table: string; values: Record<string, unknown> }>,
  ctx: {
    assessment: { id: "a1", orgId: "o1", solution: "HIRING" },
    candidate: { id: "c1", fullName: "Elif Kaya", email: "elif@example.com" },
    contactEmail: "ekip@example.com",
    locale: "tr",
  },
}));

vi.mock("@/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  return {
    db: {
      insert: (table: never) => ({ values: async (values: Record<string, unknown>) => void h.inserted.push({ table: getTableName(table), values }) }),
    },
  };
});
vi.mock("@/lib/candidate-api", () => ({
  withSolution: (req: unknown, _p: unknown, handler: (r: unknown, c: unknown, s: unknown) => unknown) =>
    handler(req, h.ctx, { candidate: { title: async () => "Ürün Tasarımcısı · Ekim" } }),
  message: () => "Bildirimin işe alım ekibine iletildi.",
  readJson: async (req: Request) => req.json(),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const params = Promise.resolve({ token: "t".repeat(43) });
const send = (body: unknown) => POST(new NextRequest("http://localhost/api/c/x/problem", { method: "POST", body: JSON.stringify(body) }), { params });

beforeEach(() => {
  h.inserted = [];
});

describe("problem route", () => {
  it("files a new-link request the team can see, next to the outbox message", async () => {
    await send({ area: "LINK", message: "Aday yeni link talep etti." });
    expect(h.inserted.map((i) => i.table).sort()).toEqual(["deletion_requests", "message_outbox"]);
    expect(h.inserted.find((i) => i.table === "deletion_requests")?.values).toEqual({ candidateId: "c1", kind: "NEW_LINK", message: "Aday yeni link talep etti." });
  });

  it("writes only the outbox message for any other area", async () => {
    await send({ area: "DEVICE_CHECK", message: "Kamera açılmıyor" });
    expect(h.inserted.map((i) => i.table)).toEqual(["message_outbox"]);
  });
});
```

5. In `src/app/a/[token]/rights/page.test.ts`:
   - Replace the registry mock with:
```ts
// Stubbed registry: the exam is live and serves its invitations; hiring is live only in the tests that say so.
const serving = vi.hoisted(() => ({ hiring: false }));
vi.mock("@/solutions/registry.server", () => ({
  servingSolution: async (ctx: { assessment: { solution: string } }) =>
    ctx.assessment.solution === "LANGUAGE_EXAM"
      ? { key: "language-exam", dbKind: "LANGUAGE_EXAM", candidateFlowLive: true, accommodationRequests: false }
      : serving.hiring
        ? { key: "hiring", dbKind: "HIRING", candidateFlowLive: true, accommodationRequests: true }
        : null,
}));
```
   - Change `render` to accept an optional search: `async function render(resolved: unknown, search: Record<string, string> = {}) { resolveToken.mockResolvedValueOnce(resolved); return (await CandidateRightsPage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve(search) })) as ReactElement; }`, add `serving.hiring = false;` in a `beforeEach` (import `beforeEach` from vitest), and keep the existing tests.
   - Add a `find` helper and two tests:
```ts
function find(node: ReactNode, type: unknown): ReactElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [...(element.type === type ? [element] : []), ...find(element.props?.children, type)];
}

it("offers the exam's candidates only the three data rights", async () => {
  const page = await render({ ok: true, ctx: ctx("LANGUAGE_EXAM", "NOT_STARTED") });
  expect(find(page, RightsForm)[0].props).toMatchObject({ kinds: ["ACCESS", "COPY", "DELETE"], initialKind: null });
});

it("offers a live hiring invitation the accommodation request, preselected from ?type=accommodation", async () => {
  serving.hiring = true;
  const page = await render({ ok: true, ctx: ctx("HIRING", "NOT_STARTED") }, { type: "accommodation" });
  expect(find(page, RightsForm)[0].props).toMatchObject({ kinds: ["ACCOMMODATION", "ACCESS", "COPY", "DELETE"], initialKind: "ACCOMMODATION" });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/lib/candidate-pages.test.ts src/lib/candidate-routes.test.ts "src/app/api/c/[token]/rights/route.test.ts" "src/app/api/c/[token]/problem/route.test.ts" "src/app/a/[token]/rights/page.test.ts"`
Expected: FAIL (modules and exports missing, ACCOMMODATION refused, no NEW_LINK row, RightsForm has no `kinds`).

- [ ] **Step 3: The dispatch helper and the unknown-link card**

`src/lib/candidate-pages.ts`:
```ts
import type { ReactNode } from "react";
import { resolveToken, type CandidateContext, type ResolveResult } from "@/lib/candidate-context";
import { servingSolution } from "@/solutions/registry.server";
import type { CandidatePageSlot } from "@/solutions/types";

export type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Every `/a/[token]/*` page asks here first (platform spec 4: the URLs are the
 * core's, the content is the solution's). A live module that serves this
 * invitation and renders its own candidate pages answers with its page, link
 * problems included. Anything else (the exam, which keeps the core pages, an
 * unknown token, a solution that does not serve this invitation) returns
 * undefined and the core page renders exactly as before.
 */
export async function solutionPage(
  token: string,
  slot: CandidatePageSlot,
  searchParams?: PageSearchParams,
  params: Record<string, string> = {},
): Promise<ReactNode | undefined> {
  const resolved = await resolveToken(token);
  if (!resolved.ctx) return undefined;
  const module = await servingSolution(resolved.ctx);
  if (!module?.candidate.renderPage) return undefined;
  return module.candidate.renderPage(slot, {
    token,
    resolved: resolved as ResolveResult & { ctx: CandidateContext },
    searchParams: searchParams ? await searchParams : {},
    params,
  });
}
```

`src/components/candidate/UnknownLink.tsx`:
```tsx
import { CandidateIntl } from "@/components/candidate/Intl";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { CandidateShell } from "@/components/candidate/Shell";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { ORG_TIMEZONE } from "@/lib/org-timezone";

/** The invalid-link card in the default language: what any page shows for a token it does not serve. */
export function UnknownLink({ token }: { token: string }) {
  return (
    <CandidateIntl locale={DEFAULT_LOCALE} timeZone={ORG_TIMEZONE}>
      <CandidateShell locale={DEFAULT_LOCALE} header={false}>
        <LinkProblem token={token} locale={DEFAULT_LOCALE} problem="INVALID" contactEmail="destek@kademe.local" />
      </CandidateShell>
    </CandidateIntl>
  );
}
```

- [ ] **Step 4: The pages**

`src/app/a/[token]/practice/page.tsx`:
```tsx
import { UnknownLink } from "@/components/candidate/UnknownLink";
import { solutionPage, type PageSearchParams } from "@/lib/candidate-pages";

export const dynamic = "force-dynamic";

/** HIRING-UX 6.4, the warm-up question. Only a solution with a warm-up renders it; any other link sees the invalid-link card. */
export default async function CandidatePracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: PageSearchParams;
}) {
  const { token } = await params;
  const hosted = await solutionPage(token, "practice", searchParams);
  return hosted !== undefined ? hosted : <UnknownLink token={token} />;
}
```

`src/app/a/[token]/stage/[n]/page.tsx`:
```tsx
import { UnknownLink } from "@/components/candidate/UnknownLink";
import { solutionPage, type PageSearchParams } from "@/lib/candidate-pages";

export const dynamic = "force-dynamic";

/** HIRING-UX 6.5-6.12: one stage of a staged assessment. Any other link sees the invalid-link card. */
export default async function CandidateStagePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; n: string }>;
  searchParams: PageSearchParams;
}) {
  const { token, n } = await params;
  const hosted = await solutionPage(token, "stage", searchParams, { n });
  return hosted !== undefined ? hosted : <UnknownLink token={token} />;
}
```

In `src/app/a/[token]/page.tsx`, add `import { solutionPage } from "@/lib/candidate-pages";` and, right after `const { token } = await params;`:
```ts
  const hosted = await solutionPage(token, "landing", searchParams);
  if (hosted !== undefined) return hosted;
```
Do the same in `info/page.tsx` (slot `"info"`) and `check/page.tsx` (slot `"check"`). In `done/page.tsx`, change the signature to
```ts
export default async function DonePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: PageSearchParams;
}) {
```
import `solutionPage, type PageSearchParams` from `@/lib/candidate-pages`, and add after `const { token } = await params;`:
```ts
  const hosted = await solutionPage(token, "done", searchParams);
  if (hosted !== undefined) return hosted;
```

Replace `src/app/a/[token]/rights/page.tsx` with:
```tsx
import { CandidateShell } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { RightsForm, type RightsKind } from "@/components/candidate/RightsForm";
import { resolveToken } from "@/lib/candidate-context";
import type { PageSearchParams } from "@/lib/candidate-pages";
import { servingSolution } from "@/solutions/registry.server";
import { candidateT } from "@/i18n/candidate";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";

export const dynamic = "force-dynamic";

const DATA_RIGHTS: RightsKind[] = ["ACCESS", "COPY", "DELETE"];

/**
 * Data rights stay reachable on a link that has expired or already been
 * completed: those are exactly the moments a candidate wants their answers back
 * or deleted. Only an invalid token gets an error screen here.
 *
 * An invitation no live module serves is treated as an invalid token, the same
 * rule the candidate API applies by default: the page must not reveal the
 * person's name or language for a token no module answers. A solution that
 * reads accommodation requests (hiring) offers that request first;
 * `?type=accommodation` (the landing's "Başka düzenleme") preselects it.
 */
export default async function CandidateRightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: PageSearchParams;
}) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  const module = resolved.ctx ? await servingSolution(resolved.ctx) : null;
  const ctx = module ? resolved.ctx : undefined;
  const locale = (ctx?.locale as Locale | undefined) ?? DEFAULT_LOCALE;
  const t = candidateT(locale);

  if (!ctx || !module) {
    return (
      <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
        <CandidateShell locale={locale} header={false}>
          <LinkProblem
            token={token}
            locale={locale}
            problem="INVALID"
            contactEmail="destek@kademe.local"
          />
        </CandidateShell>
      </CandidateIntl>
    );
  }

  const kinds: RightsKind[] = module.accommodationRequests ? ["ACCOMMODATION", ...DATA_RIGHTS] : DATA_RIGHTS;
  const sp = searchParams ? await searchParams : {};
  const initialKind: RightsKind | null = module.accommodationRequests && sp.type === "accommodation" ? "ACCOMMODATION" : null;

  return (
    <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
      <CandidateShell
        locale={locale}
        meta={t("header.rights", {
          name: ctx.candidate.fullName ?? t("header.candidate"),
        })}
      >
        <RightsForm token={token} kinds={kinds} initialKind={initialKind} />
      </CandidateShell>
    </CandidateIntl>
  );
}
```

- [ ] **Step 5: The forms**

In `src/lib/candidate-routes.ts`, append:
```ts
/**
 * Where to go after a core step (consent, details, device check) answered with
 * a solution's state: the path the state names, else the exam's mapping.
 */
export function nextPath(token: string, state: { step: string; path?: string }): string {
  // A solution's state names its page relative to /a/[token] ("" for the landing).
  return state.path !== undefined ? `/a/${encodeURIComponent(token)}${state.path}` : stepPath(token, state as Pick<CandidateState, "step">);
}
```

In `src/components/candidate/InfoForm.tsx`, change the routes import to `import { nextPath } from "@/lib/candidate-routes";` and in `submit()` replace the two lines from `const next = ...` with:
```ts
      const next = await apiSend<CandidateState & { path?: string }>(token, "/info", form);
      router.push(nextPath(token, next));
```

In `src/components/candidate/RightsForm.tsx`:
- Replace `type Kind = ...` and `OPTIONS` with:
```ts
export type RightsKind = "ACCESS" | "COPY" | "DELETE" | "ACCOMMODATION";

const OPTIONS: Record<RightsKind, { titleKey: "accessTitle" | "copyTitle" | "deleteTitle" | "accommodationTitle"; bodyKey: "accessBody" | "copyBody" | "deleteBody" | "accommodationBody" }> = {
  ACCOMMODATION: { titleKey: "accommodationTitle", bodyKey: "accommodationBody" },
  ACCESS: { titleKey: "accessTitle", bodyKey: "accessBody" },
  COPY: { titleKey: "copyTitle", bodyKey: "copyBody" },
  DELETE: { titleKey: "deleteTitle", bodyKey: "deleteBody" },
};
```
- Change the signature to `export function RightsForm({ token, kinds = ["ACCESS", "COPY", "DELETE"], initialKind = null }: { token: string; kinds?: RightsKind[]; initialKind?: RightsKind | null })`, the state to `useState<RightsKind | null>(initialKind)`, and the options loop to `{kinds.map((kindOption) => { const option = OPTIONS[kindOption]; return ( <label key={kindOption} ... checked={kind === kindOption} onChange={() => setKind(kindOption)} ... ); })}` with the same markup as today (`kind === option.kind` becomes `kind === kindOption`).

Add to the `rights` namespace of `candidate.tr.json`:
```json
"accommodationTitle": "Bir düzenlemeye ihtiyacım var",
"accommodationBody": "Video yerine yazılı cevap, altyazı ya da farklı bir zaman gibi. Talebin ekibe gider, değerlendirmen bundan etkilenmez."
```
and to `candidate.en.json`:
```json
"accommodationTitle": "I need an adjustment",
"accommodationBody": "For example a written answer instead of video, captions or another time. Your request goes to the team and does not affect your assessment."
```

- [ ] **Step 6: The routes**

Replace `src/app/api/c/[token]/rights/route.ts` with:
```ts
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { deletionRequests } from "@/db/schema";
import { candidateJson } from "@/lib/candidate-safe";
import { badRequest, message, readJson, withCandidate } from "@/lib/candidate-api";
import { manifestByKind } from "@/solutions/registry";

type Kind = "ACCESS" | "DELETE" | "COPY" | "ACCOMMODATION";
type Body = { kind?: Kind; message?: string };

const DATA_RIGHTS: readonly string[] = ["ACCESS", "DELETE", "COPY"];

/**
 * The candidate asking to see, copy or delete their data, or (where the
 * solution reads them) for an accommodation. It lands in the team's queue;
 * nothing is deleted or changed automatically from here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const body = await readJson<Body>(request);
      const kind = body?.kind;
      const accommodation = kind === "ACCOMMODATION" && manifestByKind(ctx.assessment.solution)?.accommodationRequests === true;
      if (!kind || (!DATA_RIGHTS.includes(kind) && !accommodation)) {
        return badRequest(ctx, "KIND_REQUIRED");
      }
      await db.insert(deletionRequests).values({
        candidateId: ctx.candidate.id,
        kind,
        message: (body?.message ?? "").slice(0, 2000) || null,
      });
      return candidateJson({
        received: true,
        message: message(ctx.locale, "RIGHTS_RECEIVED"),
      });
    },
    {
      limit: 10,
      windowMs: 60_000,
      allowProblems: ["EXPIRED", "NOT_YET", "COMPLETED"],
    },
  );
}
```

In `src/app/api/c/[token]/problem/route.ts`, add `deletionRequests` to the schema import and, right after the `messageOutbox` insert, add:
```ts
      // "Yeni link iste" also files a request the team sees next to the candidate
      // (hiring's Candidates tab); the outbox row alone reaches nobody until mail exists.
      if (area === "LINK") {
        await db.insert(deletionRequests).values({ candidateId: ctx.candidate.id, kind: "NEW_LINK", message: note || null });
      }
```

- [ ] **Step 7: Run the tests and the gates**

```bash
pnpm exec vitest run src/lib/candidate-pages.test.ts src/lib/candidate-routes.test.ts "src/app/api/c/[token]/rights/route.test.ts" "src/app/api/c/[token]/problem/route.test.ts" "src/app/a/[token]/rights/page.test.ts" src/i18n/messages.test.ts src/solutions/boundary.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
Then start the dev server on `kademe_platform` (port 3100, check first), run `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard`, and stop it.
Expected: PASS; `pnpm build` lists `/a/[token]/practice` and `/a/[token]/stage/[n]`; `verify:exam` and `verify:guard` only `ok`. `boundary.test.ts` passes with `KNOWN_COUPLINGS` unchanged (`candidate-pages.ts` imports no exam module).

- [ ] **Step 8: Browser check (Claude in Chrome)**

With the dev server on `kademe_platform`: `pnpm dev:link` prints an exam link; open it: the exam landing renders exactly as before (title, sections, consent). Open `/a/<that token>/stage/1` and `/a/<that token>/practice`: the invalid-link card in Turkish. Open `/a/<that token>/rights`: three options (no accommodation). Stop the server.

- [ ] **Step 9: Commit**

```bash
git add src/lib/candidate-pages.ts src/lib/candidate-pages.test.ts src/components/candidate/UnknownLink.tsx "src/app/a/[token]/practice/page.tsx" "src/app/a/[token]/stage/[n]/page.tsx" "src/app/a/[token]/page.tsx" "src/app/a/[token]/info/page.tsx" "src/app/a/[token]/check/page.tsx" "src/app/a/[token]/done/page.tsx" "src/app/a/[token]/rights/page.tsx" "src/app/a/[token]/rights/page.test.ts" src/components/candidate/InfoForm.tsx src/components/candidate/RightsForm.tsx src/lib/candidate-routes.ts src/lib/candidate-routes.test.ts "src/app/api/c/[token]/rights/route.ts" "src/app/api/c/[token]/rights/route.test.ts" "src/app/api/c/[token]/problem/route.ts" "src/app/api/c/[token]/problem/route.test.ts" src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Let core candidate pages render a solution's own screens

Every /a/[token] page asks solutionPage() first; a live module that serves
the invitation and renders its own pages answers, anything else renders as
before. /practice and /stage/[n] are new core routes that only dispatch.
The rights page offers accommodation requests where the solution reads
them, and a new-link request is filed where the team can see it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pure rules of the candidate flow

**Files:**
- Create: `src/solutions/hiring/rules/candidate-flow.ts`
- Test: `src/solutions/hiring/rules/candidate-flow.test.ts`

**Interfaces:**
- Consumes: `computeDeadline`, `acceptsWrite`, `SUBMIT_SLACK_MS` (`@/lib/timer`); `decideClose` (`@/lib/stage-timeout`); `hasText` (`@/lib/library/anchors`); `isChoice`, `isRecorded`, `ActivityType`, `ContentActivity`, `StageTimeout` (`./content`); `HiringResponsePayload`, `HiringActivityConfig` (`@/db/schema`).
- Produces (all exported from `src/solutions/hiring/rules/candidate-flow.ts`):
  - `EXTRA_TIME_OPTIONS = [0, 25, 50] as const`, `type ExtraTimePct = 0 | 25 | 50`, `isExtraTimePct(v: unknown): v is ExtraTimePct`.
  - `effectiveSeconds(durationSeconds: number, pct: ExtraTimePct): number`.
  - `stageDeadline(startedAt: Date, stage: { durationSeconds: number; graceSeconds: number; onTimeout: StageTimeout }, pct: ExtraTimePct): Date`.
  - `isOverdue(run: { startedAt: Date | null; deadlineAt: Date | null; submittedAt: Date | null }, onTimeout: StageTimeout, now: Date): boolean`.
  - `MAX_TEXT_CHARS = 20000`, `DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024`, `maxCharsOf(a)`, `minCharsOf(a)` with `a: { type: ActivityType; config: HiringActivityConfig }`.
  - `sanitizeResponse(a, raw: unknown, previous: HiringResponsePayload): HiringResponsePayload`.
  - `responseAnswered(a, payload: HiringResponsePayload, hasTake: boolean): boolean`.
  - `autoScore(a: Pick<ContentActivity, "type" | "config">, payload: HiringResponsePayload): number | null`.
  - `missingRequired(activities: Array<{ id: string; required: boolean }>, answered: (id: string) => boolean): string[]`.
  - `runCompletion(input: { reason: "SUBMIT" | "CLOCK"; late: boolean; behaviour: StageTimeout; requiredCount: number; answeredRequired: number; answeredAny: number }): { completion: "COMPLETE" | "PARTIAL" | "EXPIRED"; late: boolean }`.
  - `type WriteRefusal = "NO_STAGE" | "STAGE_MISMATCH" | "STAGE_NOT_STARTED" | "STAGE_EXPIRED" | "ACTIVITY_NOT_FOUND" | "ACTIVITY_CLOSED" | "ACTIVITY_ORDER"` and `writeRefusal(input: { current: { position: number; startedAt: Date | null; deadlineAt: Date | null; onTimeout: StageTimeout; backNavigation: boolean } | null; position: unknown; activityId: unknown; activities: Array<{ id: string; closed: boolean }>; now: Date }): WriteRefusal | null`.
  - `type StageRule` and `stageRules(stage: { activities: Array<{ type: ActivityType; thinkSeconds: number; flexibleThink: boolean; maxTakes: number }> }, options: { backNavigation: boolean; onTimeout: StageTimeout }): StageRule[]`.
  - `progressOf(input: { stagePosition: number; stageCount: number; activityIndex: number; activityCount: number }): { n: number; total: number; ratio: number }`.
  - `type HiringStep = "CONSENT" | "INFO" | "CHECK" | "STAGE" | "DONE" | "CLOSED"`, `hiringStepSuffix(step: HiringStep, position: number | null): string` (relative to `/a/[token]`: `""`, `"/info"`, `"/check"`, `"/stage/2"`, `"/done"`) and `hiringStepPath(token: string, step: HiringStep, position: number | null): string`.
  - `firstOpenIndex(closed: boolean[]): number`, `extraTimeRefusal(runs: Array<{ startedAt: Date | null; submittedAt: Date | null }>): "EXTRA_TIME_LOCKED" | null`, `cleanFileName(raw: unknown): string`.

- [ ] **Step 1: Write the failing test**

`src/solutions/hiring/rules/candidate-flow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { activity } from "./test-fixtures";
import {
  autoScore,
  cleanFileName,
  effectiveSeconds,
  extraTimeRefusal,
  firstOpenIndex,
  hiringStepPath,
  hiringStepSuffix,
  isExtraTimePct,
  isOverdue,
  maxCharsOf,
  missingRequired,
  progressOf,
  responseAnswered,
  runCompletion,
  sanitizeResponse,
  stageDeadline,
  stageRules,
  writeRefusal,
} from "./candidate-flow";

const T0 = new Date("2026-10-05T09:00:00.000Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe("stage clock with the candidate's extra time (spec 2.4)", () => {
  it("knows only 0, 25 and 50 percent", () => {
    expect([0, 25, 50].every(isExtraTimePct)).toBe(true);
    expect([10, "25", null, 100].some(isExtraTimePct)).toBe(false);
  });

  it("stretches the stage by the chosen percentage, rounded up to a whole second", () => {
    expect(effectiveSeconds(600, 0)).toBe(600);
    expect(effectiveSeconds(600, 25)).toBe(750);
    expect(effectiveSeconds(601, 50)).toBe(902);
  });

  it("writes the deadline from the start, adding grace only for ALLOW_GRACE", () => {
    const stage = { durationSeconds: 600, graceSeconds: 60, onTimeout: "AUTO_SUBMIT" as const };
    expect(stageDeadline(T0, stage, 25).toISOString()).toBe(at(750).toISOString());
    expect(stageDeadline(T0, { ...stage, onTimeout: "ALLOW_GRACE" }, 0).toISOString()).toBe(at(660).toISOString());
  });

  it("calls a run overdue only after the deadline plus the write slack, never for ALLOW_LATE", () => {
    const run = { startedAt: T0, deadlineAt: at(600), submittedAt: null };
    expect(isOverdue(run, "AUTO_SUBMIT", at(603))).toBe(false);
    expect(isOverdue(run, "AUTO_SUBMIT", at(606))).toBe(true);
    expect(isOverdue(run, "ALLOW_LATE", at(6000))).toBe(false);
    expect(isOverdue({ ...run, submittedAt: at(500) }, "AUTO_SUBMIT", at(6000))).toBe(false);
    expect(isOverdue({ startedAt: null, deadlineAt: null, submittedAt: null }, "AUTO_SUBMIT", at(6000))).toBe(false);
  });
});

describe("answers as the server keeps them", () => {
  it("cuts text to the question's limit and keeps nothing else the candidate sent", () => {
    const short = activity("a", { type: "SHORT_TEXT", config: { maxChars: 5 } });
    expect(sanitizeResponse(short, { text: "1234567", choiceIds: ["x"], file: { name: "evil" } }, {})).toEqual({ text: "12345" });
    expect(maxCharsOf(activity("b", { type: "LONG_TEXT", config: {} }))).toBe(3000);
    expect(maxCharsOf(activity("c", { type: "SHORT_TEXT", config: {} }))).toBe(300);
    expect(maxCharsOf(activity("d", { type: "LONG_TEXT", config: { maxChars: 999999 } }))).toBe(20000);
  });

  it("keeps only choices the candidate could see, one for a single choice, without repeats", () => {
    const config = { choices: [{ id: "a", label: { tr: "A", en: "" } }, { id: "b", label: { tr: "B", en: "" }, correct: true }, { id: "c", label: { tr: "", en: "" } }] };
    const single = activity("s", { type: "SINGLE_CHOICE", config });
    const multi = activity("m", { type: "MULTI_CHOICE", config });
    expect(sanitizeResponse(single, { choiceIds: ["b", "a"] }, {})).toEqual({ choiceIds: ["b"] });
    expect(sanitizeResponse(multi, { choiceIds: ["a", "a", "c", "zz", 4] }, {})).toEqual({ choiceIds: ["a"] });
  });

  it("takes a written alternative for a recording only where the team allowed it", () => {
    const allowed = activity("v", { type: "VIDEO", config: { textAlternativeEnabled: true } });
    const notAllowed = activity("w", { type: "VIDEO", config: {} });
    expect(sanitizeResponse(allowed, { usedTextAlternative: true, text: "Yazıyla" }, {})).toEqual({ usedTextAlternative: true, text: "Yazıyla" });
    expect(sanitizeResponse(notAllowed, { usedTextAlternative: true, text: "Yazıyla" }, {})).toEqual({});
  });

  it("never lets the client name or drop an attached file", () => {
    const file = activity("f", { type: "FILE_UPLOAD", config: {} });
    const previous = { file: { name: "cv.pdf", bytes: 10, mime: "application/pdf" } };
    expect(sanitizeResponse(file, { file: null, text: "x" }, previous)).toEqual(previous);
  });

  it("knows when a question has an answer", () => {
    expect(responseAnswered(activity("t", { type: "LONG_TEXT", config: { minChars: 3 } }), { text: " ab " }, false)).toBe(false);
    expect(responseAnswered(activity("t", { type: "LONG_TEXT", config: { minChars: 3 } }), { text: "abc" }, false)).toBe(true);
    expect(responseAnswered(activity("c", { type: "SINGLE_CHOICE" }), { choiceIds: [] }, false)).toBe(false);
    expect(responseAnswered(activity("v", { type: "VIDEO" }), {}, true)).toBe(true);
    expect(responseAnswered(activity("v", { type: "VIDEO" }), { usedTextAlternative: true, text: "  " }, false)).toBe(false);
    expect(responseAnswered(activity("f", { type: "FILE_UPLOAD" }), { pendingFile: { assetId: "x", name: "a", bytes: 1, mime: "a" } }, false)).toBe(false);
    expect(responseAnswered(activity("f", { type: "FILE_UPLOAD" }), { file: { name: "a", bytes: 1, mime: "a" } }, false)).toBe(true);
  });

  it("scores a choice question 1 or 0 and nothing else at all", () => {
    const config = { choices: [{ id: "a", label: { tr: "A", en: "" }, correct: true }, { id: "b", label: { tr: "B", en: "" }, correct: true }, { id: "c", label: { tr: "C", en: "" } }] };
    const multi = activity("m", { type: "MULTI_CHOICE", config });
    expect(autoScore(multi, { choiceIds: ["b", "a"] })).toBe(1);
    expect(autoScore(multi, { choiceIds: ["a"] })).toBe(0);
    expect(autoScore(multi, { choiceIds: ["a", "b", "c"] })).toBe(0);
    expect(autoScore(multi, {})).toBe(0);
    expect(autoScore(activity("v", { type: "VIDEO" }), {})).toBeNull();
    expect(autoScore(activity("n", { type: "SINGLE_CHOICE", config: { choices: [{ id: "a", label: { tr: "A", en: "" } }] } }), { choiceIds: ["a"] })).toBeNull();
  });

  it("lists the required questions still without an answer", () => {
    const answered = new Set(["b"]);
    expect(missingRequired([{ id: "a", required: true }, { id: "b", required: true }, { id: "c", required: false }], (id) => answered.has(id))).toEqual(["a"]);
  });
});

describe("closing a stage", () => {
  const counts = { requiredCount: 2, answeredRequired: 2, answeredAny: 2 };
  it("a submit with every required answer is COMPLETE, with one missing PARTIAL", () => {
    expect(runCompletion({ reason: "SUBMIT", late: false, behaviour: "AUTO_SUBMIT", ...counts })).toEqual({ completion: "COMPLETE", late: false });
    expect(runCompletion({ reason: "SUBMIT", late: true, behaviour: "ALLOW_LATE", ...counts, answeredRequired: 1 })).toEqual({ completion: "PARTIAL", late: true });
  });

  it("the clock keeps what was written: PARTIAL with something, EXPIRED with nothing, always late", () => {
    expect(runCompletion({ reason: "CLOCK", late: false, behaviour: "AUTO_SUBMIT", ...counts, answeredRequired: 1, answeredAny: 1 })).toEqual({ completion: "PARTIAL", late: true });
    expect(runCompletion({ reason: "CLOCK", late: false, behaviour: "AUTO_SUBMIT", requiredCount: 2, answeredRequired: 0, answeredAny: 0 })).toEqual({ completion: "EXPIRED", late: true });
    expect(runCompletion({ reason: "CLOCK", late: false, behaviour: "AUTO_CLOSE", ...counts })).toEqual({ completion: "EXPIRED", late: true });
  });
});

describe("write order (decision 7)", () => {
  const current = { position: 1, startedAt: T0, deadlineAt: at(600), onTimeout: "AUTO_SUBMIT" as const, backNavigation: false };
  const activities = [
    { id: "a1", closed: true },
    { id: "a2", closed: false },
    { id: "a3", closed: false },
  ];
  const ask = (over: Partial<Parameters<typeof writeRefusal>[0]>) => writeRefusal({ current, position: 1, activityId: "a2", activities, now: at(10), ...over });

  it("accepts the first open question of the running stage", () => {
    expect(ask({})).toBeNull();
  });

  it("refuses a stale tab, an unstarted or expired stage, an unknown, closed or later question", () => {
    expect(ask({ current: null })).toBe("NO_STAGE");
    expect(ask({ position: 2 })).toBe("STAGE_MISMATCH");
    expect(ask({ position: "1" })).toBe("STAGE_MISMATCH");
    expect(ask({ current: { ...current, startedAt: null, deadlineAt: null } })).toBe("STAGE_NOT_STARTED");
    expect(ask({ now: at(606) })).toBe("STAGE_EXPIRED");
    expect(ask({ activityId: "zz" })).toBe("ACTIVITY_NOT_FOUND");
    expect(ask({ activityId: "a1" })).toBe("ACTIVITY_CLOSED");
    expect(ask({ activityId: "a3" })).toBe("ACTIVITY_ORDER");
  });

  it("with back navigation, any question of the running stage may be written", () => {
    const back = { ...current, backNavigation: true };
    expect(ask({ current: back, activityId: "a1" })).toBeNull();
    expect(ask({ current: back, activityId: "a3" })).toBeNull();
  });

  it("an ALLOW_LATE stage keeps accepting after its deadline", () => {
    expect(ask({ current: { ...current, onTimeout: "ALLOW_LATE" }, now: at(6000) })).toBeNull();
  });

  it("resumes at the first open question", () => {
    expect(firstOpenIndex([true, false, false])).toBe(1);
    expect(firstOpenIndex([true, true])).toBe(1);
    expect(firstOpenIndex([])).toBe(0);
  });
});

describe("what the stage intro promises (HIRING-UX 6.5)", () => {
  const video = (over: Record<string, unknown> = {}) => ({ type: "VIDEO" as const, thinkSeconds: 30, flexibleThink: true, maxTakes: 2, ...over });
  it("says think time, retakes and that there is no way back, only where they apply", () => {
    expect(stageRules({ activities: [video(), video()] }, { backNavigation: false, onTimeout: "AUTO_SUBMIT" })).toEqual([
      { kind: "think", seconds: 30 },
      { kind: "takes", count: 1 },
      { kind: "noBack" },
    ]);
    expect(stageRules({ activities: [{ type: "LONG_TEXT", thinkSeconds: 0, flexibleThink: true, maxTakes: 1 }] }, { backNavigation: true, onTimeout: "ALLOW_LATE" })).toEqual([{ kind: "back" }, { kind: "lateAllowed" }]);
  });

  it("says when recording starts by itself and when numbers differ between questions", () => {
    expect(stageRules({ activities: [video({ flexibleThink: false }), video({ thinkSeconds: 60, maxTakes: 1 })] }, { backNavigation: false, onTimeout: "AUTO_SUBMIT" })).toEqual([
      { kind: "thinkStrict", seconds: null },
      { kind: "takes", count: null },
      { kind: "noBack" },
    ]);
    expect(stageRules({ activities: [video({ maxTakes: 1 })] }, { backNavigation: false, onTimeout: "AUTO_SUBMIT" })).toContainEqual({ kind: "noRetake" });
  });
});

describe("progress and paths", () => {
  it("one definition of progress: done stages plus the share of the current stage", () => {
    expect(progressOf({ stagePosition: 1, stageCount: 2, activityIndex: 0, activityCount: 4 })).toEqual({ n: 1, total: 2, ratio: 0 });
    expect(progressOf({ stagePosition: 2, stageCount: 2, activityIndex: 2, activityCount: 4 })).toEqual({ n: 2, total: 2, ratio: 0.75 });
    expect(progressOf({ stagePosition: 1, stageCount: 0, activityIndex: 0, activityCount: 0 }).ratio).toBe(0);
  });

  it("maps every step to its page", () => {
    expect(hiringStepSuffix("CONSENT", null)).toBe("");
    expect(hiringStepSuffix("STAGE", 3)).toBe("/stage/3");
    expect(hiringStepPath("t k", "CONSENT", null)).toBe("/a/t%20k");
    expect(hiringStepPath("tok", "CLOSED", null)).toBe("/a/tok");
    expect(hiringStepPath("tok", "INFO", null)).toBe("/a/tok/info");
    expect(hiringStepPath("tok", "CHECK", null)).toBe("/a/tok/check");
    expect(hiringStepPath("tok", "STAGE", 2)).toBe("/a/tok/stage/2");
    expect(hiringStepPath("tok", "DONE", null)).toBe("/a/tok/done");
  });

  it("locks extra time only while a stage is running", () => {
    expect(extraTimeRefusal([])).toBeNull();
    expect(extraTimeRefusal([{ startedAt: T0, submittedAt: at(5) }])).toBeNull();
    expect(extraTimeRefusal([{ startedAt: T0, submittedAt: null }])).toBe("EXTRA_TIME_LOCKED");
  });

  it("keeps a file's own name but never a path or a control character", () => {
    expect(cleanFileName("C:\\Users\\elif\\Özgeçmiş.pdf")).toBe("Özgeçmiş.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("a\u0000b\nc.pdf")).toBe("abc.pdf");
    expect(cleanFileName(42)).toBe("dosya");
    expect(cleanFileName("x".repeat(300) + ".pdf").length).toBe(200);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/solutions/hiring/rules/candidate-flow.test.ts`
Expected: FAIL with `Failed to resolve import "./candidate-flow"`.

- [ ] **Step 3: Write the rules**

`src/solutions/hiring/rules/candidate-flow.ts`:

```ts
import type { HiringActivityConfig, HiringResponsePayload } from "@/db/schema";
import { hasText } from "@/lib/library/anchors";
import { decideClose } from "@/lib/stage-timeout";
import { acceptsWrite, computeDeadline, SUBMIT_SLACK_MS } from "@/lib/timer";
import { isChoice, isRecorded, type ActivityType, type ContentActivity, type StageTimeout } from "./content";

/**
 * The hiring candidate flow's rules (hiring solution design 2.4, HIRING-UX 6).
 * Pure: the server applies them under locks, the screens use the same ones to
 * explain themselves, the tests pin them.
 */

/** HIRING-UX 6.1: the candidate picks extra time without giving a reason. */
export const EXTRA_TIME_OPTIONS = [0, 25, 50] as const;
export type ExtraTimePct = (typeof EXTRA_TIME_OPTIONS)[number];
export const isExtraTimePct = (value: unknown): value is ExtraTimePct => value === 0 || value === 25 || value === 50;

/** Seconds on this candidate's stage clock: duration × (100 + pct) / 100, rounded up. */
export function effectiveSeconds(durationSeconds: number, pct: ExtraTimePct): number {
  return Math.ceil((durationSeconds * (100 + pct)) / 100);
}

/**
 * Written once, when the stage starts; a reload reads it back and nothing moves
 * it. ALLOW_GRACE bakes its grace into the deadline (lib/stage-timeout).
 */
export function stageDeadline(
  startedAt: Date,
  stage: { durationSeconds: number; graceSeconds: number; onTimeout: StageTimeout },
  pct: ExtraTimePct,
): Date {
  return computeDeadline(startedAt, effectiveSeconds(stage.durationSeconds, pct), stage.onTimeout === "ALLOW_GRACE" ? stage.graceSeconds : 0);
}

/** The clock ran out and the server closes the run. ALLOW_LATE never closes by itself. */
export function isOverdue(
  run: { startedAt: Date | null; deadlineAt: Date | null; submittedAt: Date | null },
  onTimeout: StageTimeout,
  now: Date,
): boolean {
  if (!run.startedAt || !run.deadlineAt || run.submittedAt) return false;
  if (onTimeout === "ALLOW_LATE") return false;
  return now.getTime() > run.deadlineAt.getTime() + SUBMIT_SLACK_MS;
}

export const MAX_TEXT_CHARS = 20_000;
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;

type Shape = { type: ActivityType; config: HiringActivityConfig };

/** The longest text the server keeps for this question (the builder's defaults: 3000 long, 300 short). */
export function maxCharsOf(a: Shape): number {
  const own = a.type === "LONG_TEXT" ? (a.config.maxChars ?? 3000) : a.type === "SHORT_TEXT" ? (a.config.maxChars ?? 300) : isRecorded(a.type) ? 3000 : 0;
  return Math.min(own, MAX_TEXT_CHARS);
}

export function minCharsOf(a: Shape): number {
  return a.type === "LONG_TEXT" || a.type === "SHORT_TEXT" ? (a.config.minChars ?? 0) : 0;
}

/** Choice ids the candidate was shown: labelled ones only, like the candidate view. */
function visibleChoiceIds(a: Shape): Set<string> {
  return new Set((a.config.choices ?? []).filter((c) => hasText(c.label)).map((c) => c.id));
}

/**
 * What the server stores from a candidate's save. Only the fields of the
 * question's type are read, trimmed to their limits; the parts the server
 * attaches itself (a file, an upload in progress) are kept from `previous`
 * whatever the client sends.
 */
export function sanitizeResponse(a: Shape, raw: unknown, previous: HiringResponsePayload): HiringResponsePayload {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: HiringResponsePayload = {};
  if (previous.file) out.file = previous.file;
  if (previous.pendingFile) out.pendingFile = previous.pendingFile;
  switch (a.type) {
    case "LONG_TEXT":
    case "SHORT_TEXT":
      if (typeof input.text === "string") out.text = input.text.slice(0, maxCharsOf(a));
      else if (previous.text !== undefined) out.text = previous.text;
      break;
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE": {
      if (Array.isArray(input.choiceIds)) {
        const valid = visibleChoiceIds(a);
        const ids = [...new Set(input.choiceIds.filter((x): x is string => typeof x === "string" && valid.has(x)))];
        out.choiceIds = a.type === "SINGLE_CHOICE" ? ids.slice(0, 1) : ids;
      } else if (previous.choiceIds) out.choiceIds = previous.choiceIds;
      break;
    }
    case "VIDEO":
    case "AUDIO":
      // The written alternative exists only where the team switched it on (HIRING-UX A7).
      if (a.config.textAlternativeEnabled && input.usedTextAlternative === true) {
        out.usedTextAlternative = true;
        out.text = typeof input.text === "string" ? input.text.slice(0, maxCharsOf(a)) : (previous.text ?? "");
      }
      break;
    case "FILE_UPLOAD":
      break;
  }
  return out;
}

/** True when the question carries an answer: text long enough, a choice, a usable take, a written alternative, an attached file. */
export function responseAnswered(a: Shape, payload: HiringResponsePayload, hasTake: boolean): boolean {
  switch (a.type) {
    case "LONG_TEXT":
    case "SHORT_TEXT":
      return (payload.text ?? "").trim().length >= Math.max(1, minCharsOf(a));
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return (payload.choiceIds ?? []).length > 0;
    case "VIDEO":
    case "AUDIO":
      return hasTake || (!!payload.usedTextAlternative && (payload.text ?? "").trim().length > 0);
    case "FILE_UPLOAD":
      return !!payload.file;
  }
}

/**
 * Decision 10: 1 when the chosen set equals the right set, else 0; null for a
 * question that is not a choice or has no right answer. Never shown to the candidate.
 */
export function autoScore(a: Pick<ContentActivity, "type" | "config">, payload: HiringResponsePayload): number | null {
  if (!isChoice(a.type)) return null;
  const right = (a.config.choices ?? []).filter((c) => c.correct).map((c) => c.id).sort();
  if (right.length === 0) return null;
  const chosen = [...new Set(payload.choiceIds ?? [])].sort();
  return chosen.length === right.length && chosen.every((id, i) => id === right[i]) ? 1 : 0;
}

export function missingRequired(activities: Array<{ id: string; required: boolean }>, answered: (id: string) => boolean): string[] {
  return activities.filter((a) => a.required && !answered(a.id)).map((a) => a.id);
}

/**
 * How a stage run ends. A submit is COMPLETE or PARTIAL by the required
 * answers. The clock keeps whatever was written (lib/stage-timeout
 * decideClose): COMPLETE or PARTIAL when there is something, EXPIRED when
 * there is nothing or the team chose AUTO_CLOSE; always late.
 */
export function runCompletion(input: {
  reason: "SUBMIT" | "CLOCK";
  late: boolean;
  behaviour: StageTimeout;
  requiredCount: number;
  answeredRequired: number;
  answeredAny: number;
}): { completion: "COMPLETE" | "PARTIAL" | "EXPIRED"; late: boolean } {
  const byCounts = input.answeredRequired >= input.requiredCount ? "COMPLETE" : "PARTIAL";
  if (input.reason === "SUBMIT") return { completion: byCounts, late: input.late };
  const decided = decideClose({ behaviour: input.behaviour, requiredCount: input.requiredCount, answeredRequired: input.answeredRequired, answeredAny: input.answeredAny });
  if (decided.action === "LEAVE_OPEN") return { completion: byCounts, late: true };
  return { completion: decided.completion, late: true };
}

export type WriteRefusal =
  | "NO_STAGE"
  | "STAGE_MISMATCH"
  | "STAGE_NOT_STARTED"
  | "STAGE_EXPIRED"
  | "ACTIVITY_NOT_FOUND"
  | "ACTIVITY_CLOSED"
  | "ACTIVITY_ORDER";

/**
 * Decision 7: every write names the stage and the question it believes it is
 * on; the server refuses rather than guess. `activities` are the running
 * stage's questions in order, `closed` when the candidate already closed one.
 */
export function writeRefusal(input: {
  current: { position: number; startedAt: Date | null; deadlineAt: Date | null; onTimeout: StageTimeout; backNavigation: boolean } | null;
  position: unknown;
  activityId: unknown;
  activities: Array<{ id: string; closed: boolean }>;
  now: Date;
}): WriteRefusal | null {
  const { current } = input;
  if (!current) return "NO_STAGE";
  if (input.position !== current.position) return "STAGE_MISMATCH";
  if (!current.startedAt || !current.deadlineAt) return "STAGE_NOT_STARTED";
  if (!acceptsWrite(current.deadlineAt, current.onTimeout, input.now)) return "STAGE_EXPIRED";
  const target = input.activities.find((a) => a.id === input.activityId);
  if (!target) return "ACTIVITY_NOT_FOUND";
  if (current.backNavigation) return null;
  if (target.closed) return "ACTIVITY_CLOSED";
  const firstOpen = input.activities.find((a) => !a.closed);
  if (firstOpen && firstOpen.id !== target.id) return "ACTIVITY_ORDER";
  return null;
}

export type StageRule =
  | { kind: "think"; seconds: number | null }
  | { kind: "thinkStrict"; seconds: number | null }
  | { kind: "takes"; count: number | null }
  | { kind: "noRetake" }
  | { kind: "noBack" }
  | { kind: "back" }
  | { kind: "lateAllowed" };

/** One value when every item agrees, else null (the copy then says "her soruda yazar"). */
const common = (values: number[]): number | null => (values.length && values.every((v) => v === values[0]) ? values[0] : null);

/**
 * HIRING-UX 6.5: only the rules that apply to this stage, in a fixed order:
 * think time (and whether recording starts by itself), retakes, going back,
 * finishing late.
 */
export function stageRules(
  stage: { activities: Array<{ type: ActivityType; thinkSeconds: number; flexibleThink: boolean; maxTakes: number }> },
  options: { backNavigation: boolean; onTimeout: StageTimeout },
): StageRule[] {
  const rules: StageRule[] = [];
  const recorded = stage.activities.filter((a) => isRecorded(a.type));
  const thinking = recorded.filter((a) => a.thinkSeconds > 0);
  if (thinking.length) {
    const seconds = common(thinking.map((a) => a.thinkSeconds));
    rules.push(thinking.some((a) => !a.flexibleThink) ? { kind: "thinkStrict", seconds } : { kind: "think", seconds });
  }
  if (recorded.length) {
    const retakes = recorded.map((a) => a.maxTakes - 1);
    if (retakes.every((r) => r === 0)) rules.push({ kind: "noRetake" });
    else rules.push({ kind: "takes", count: common(retakes) });
  }
  rules.push(options.backNavigation ? { kind: "back" } : { kind: "noBack" });
  if (options.onTimeout === "ALLOW_LATE") rules.push({ kind: "lateAllowed" });
  return rules;
}

/**
 * HIRING-UX 6: the thin bar and "Aşama 2 / 3". One definition for the candidate
 * pages and the preview: finished stages plus the share of the current stage.
 */
export function progressOf(input: { stagePosition: number; stageCount: number; activityIndex: number; activityCount: number }): { n: number; total: number; ratio: number } {
  if (input.stageCount <= 0) return { n: input.stagePosition, total: 0, ratio: 0 };
  const within = input.activityCount > 0 ? input.activityIndex / input.activityCount : 0;
  const ratio = Math.min(1, Math.max(0, (input.stagePosition - 1 + within) / input.stageCount));
  return { n: input.stagePosition, total: input.stageCount, ratio };
}

export type HiringStep = "CONSENT" | "INFO" | "CHECK" | "STAGE" | "DONE" | "CLOSED";

/**
 * The page each step lives on, relative to /a/[token]: the state carries it
 * without the token (the core forms do not know the solution, the server does
 * not keep the raw token). A closed opening is told on the landing.
 */
export function hiringStepSuffix(step: HiringStep, position: number | null): string {
  switch (step) {
    case "CONSENT":
    case "CLOSED":
      return "";
    case "INFO":
      return "/info";
    case "CHECK":
      return "/check";
    case "STAGE":
      return `/stage/${position ?? 1}`;
    case "DONE":
      return "/done";
  }
}

export function hiringStepPath(token: string, step: HiringStep, position: number | null): string {
  return `/a/${encodeURIComponent(token)}${hiringStepSuffix(step, position)}`;
}

/** Where a resumed stage opens: the first question the candidate has not closed (the last when all are). */
export function firstOpenIndex(closed: boolean[]): number {
  const open = closed.findIndex((c) => !c);
  return open === -1 ? Math.max(0, closed.length - 1) : open;
}

/** Decision 5: extra time changes only while no stage is running. */
export function extraTimeRefusal(runs: Array<{ startedAt: Date | null; submittedAt: Date | null }>): "EXTRA_TIME_LOCKED" | null {
  return runs.some((r) => r.startedAt && !r.submittedAt) ? "EXTRA_TIME_LOCKED" : null;
}

/** A file's own name without any path or control character, at most 200 characters. */
export function cleanFileName(raw: unknown): string {
  if (typeof raw !== "string") return "dosya";
  const base = raw.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (clean || "dosya").slice(0, 200);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run src/solutions/hiring/rules/candidate-flow.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
git add src/solutions/hiring/rules/candidate-flow.ts src/solutions/hiring/rules/candidate-flow.test.ts
git commit -m "Add the pure rules of the hiring candidate flow

Extra time and the stage deadline written once, overdue runs, answer
sanitising per question type, answered and auto score, how a run closes,
write order, the stage intro's rules, one progress definition, step paths
and file names.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The candidate state, built only from the candidate view (leak sentinels)

**Files:**
- Create: `src/solutions/hiring/rules/disclosure.ts`, `src/solutions/hiring/rules/candidate-state.ts`
- Test: `src/solutions/hiring/rules/disclosure.test.ts`, `src/solutions/hiring/rules/candidate-state.test.ts`

**Interfaces:**
- Consumes: `toCandidateVersion`, `CandidateVersion`, `CandidateStage` (`./candidate-view`); `orderedStages`, `orderedActivities`, `isRecorded`, `ContentStage` (`./content`); Task 4's `effectiveSeconds`, `hiringStepSuffix`, `responseAnswered`, `stageRules`, `ExtraTimePct`, `HiringStep`, `StageRule`; `candidateSafe` (`@/lib/candidate-safe`, tests).
- Produces:
  - `disclosure.ts`: `type RecordedSignal = "VIDEO_ANSWER" | "AUDIO_ANSWER" | "TECHNICAL"`; `recordedSignals(version: CandidateVersion): RecordedSignal[]`; `devicesNeeded(version: CandidateVersion): { camera: boolean; microphone: boolean }`; `estimatedMinutes(version: CandidateVersion, pct: ExtraTimePct): number`.
  - `candidate-state.ts`: `type CandidateResponseView`, `type CurrentStage`, `type HiringCandidateState`, `type StateInput`, `buildCandidateState(input: StateInput): HiringCandidateState` (field lists below).

- [ ] **Step 1: Write the failing tests**

`src/solutions/hiring/rules/disclosure.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toCandidateVersion } from "./candidate-view";
import { devicesNeeded, estimatedMinutes, recordedSignals } from "./disclosure";
import { activity, content, stage } from "./test-fixtures";

const version = (types: Array<"VIDEO" | "AUDIO" | "LONG_TEXT">) =>
  toCandidateVersion(content([stage("s1", types.map((type, i) => activity(`a${i}`, { type, orderIndex: i })), { durationSeconds: 601 })]));

describe("what the landing says is recorded (HIRING-UX 7.2, A3)", () => {
  it("names video and audio answers only when the version has them, and always the technical log", () => {
    expect(recordedSignals(version(["VIDEO", "LONG_TEXT"]))).toEqual(["VIDEO_ANSWER", "TECHNICAL"]);
    expect(recordedSignals(version(["AUDIO"]))).toEqual(["AUDIO_ANSWER", "TECHNICAL"]);
    expect(recordedSignals(version(["LONG_TEXT"]))).toEqual(["TECHNICAL"]);
  });

  it("asks for the camera only for video and the microphone for video or audio", () => {
    expect(devicesNeeded(version(["VIDEO"]))).toEqual({ camera: true, microphone: true });
    expect(devicesNeeded(version(["AUDIO"]))).toEqual({ camera: false, microphone: true });
    expect(devicesNeeded(version(["LONG_TEXT"]))).toEqual({ camera: false, microphone: false });
  });

  it("estimates whole minutes with the chosen extra time", () => {
    expect(estimatedMinutes(version(["LONG_TEXT"]), 0)).toBe(11);
    expect(estimatedMinutes(version(["LONG_TEXT"]), 50)).toBe(16);
  });
});
```

`src/solutions/hiring/rules/candidate-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { candidateSafe } from "@/lib/candidate-safe";
import { buildCandidateState, type StateInput } from "./candidate-state";
import { activity, content, stage } from "./test-fixtures";

const SECRET = "TEAMSECRET";
const VISIBLE = "LEAKVISIBLE";
const COMP = "77777777-7777-4777-8777-777777777777";
const T0 = new Date("2026-10-05T09:00:00.000Z");

const secretStages = content([
  stage(
    "s1",
    [
      activity("a1", {
        orderIndex: 0,
        prompt: { tr: `${VISIBLE}_PROMPT`, en: "" },
        competencyIds: [COMP],
        internalQuestion: `${SECRET}_purpose`,
        expectedBehaviours: [`${SECRET}_behaviour`],
        redFlags: [`${SECRET}_flag`],
        managerNotes: `${SECRET}_note`,
        answerExamples: { 1: `${SECRET}_one`, 3: `${SECRET}_three`, 5: `${SECRET}_five` },
        config: { textAlternativeEnabled: true },
      }),
      activity("a2", {
        orderIndex: 1,
        type: "SINGLE_CHOICE",
        config: { choices: [{ id: "x", label: { tr: `${VISIBLE}_CHOICE`, en: "" }, correct: true }, { id: "y", label: { tr: "Hayır", en: "" } }] },
      }),
    ],
    { name: { tr: `${VISIBLE}_STAGE`, en: "" }, internalPurpose: `${SECRET}_stage`, durationSeconds: 600 },
  ),
  stage("s2", [activity("b1", { type: "LONG_TEXT", config: {} })], { orderIndex: 1, durationSeconds: 300 }),
]).stages;

function input(over: Partial<StateInput> = {}): StateInput {
  return {
    now: T0,
    orgName: "Örnek A.Ş.",
    contactEmail: "ekip@ornek.com",
    retention: { mediaDays: 180, candidateDays: 730 },
    opening: { status: "OPEN", positionName: "Ürün Tasarımcısı", finishSurveyEnabled: true, feedbackDays: 7 },
    version: { stages: secretStages, introTitle: null, introBody: null, practiceEnabled: true },
    invitation: {
      candidateName: "Elif Kaya",
      candidateEmail: "elif@example.com",
      extraTimePct: 0,
      reviewers: 3,
      consented: true,
      deviceChecked: true,
      started: false,
      completedAt: null,
      surveyAnswered: false,
    },
    runs: [],
    responses: [],
    ...over,
  };
}

const started = (over: Partial<StateInput> = {}) =>
  input({
    invitation: { ...input().invitation, started: true },
    runs: [{ stageId: "s1", startedAt: T0, deadlineAt: new Date(T0.getTime() + 600_000), submittedAt: null, wasLate: false }],
    responses: [
      { stageId: "s1", activityId: "a1", payload: {}, takesUsed: 1, answeredAt: null, recording: { ref: "m1", status: "READY", durationMs: 4000 } },
      { stageId: "s1", activityId: "a2", payload: { choiceIds: ["x"] }, takesUsed: 0, answeredAt: null, recording: null },
    ],
    ...over,
  });

describe("the candidate state leaks nothing team-only (spec 7, positive control included)", () => {
  it("shows the visible sentinels and none of the team's", () => {
    const sent = JSON.stringify(candidateSafe(buildCandidateState(started())));
    // Positive control: the same search finds what the candidate must see.
    expect(sent).toContain(`${VISIBLE}_PROMPT`);
    expect(sent).toContain(`${VISIBLE}_STAGE`);
    expect(sent).toContain(`${VISIBLE}_CHOICE`);
    expect(sent).not.toContain(SECRET);
    expect(sent).not.toContain(COMP);
    expect(sent).not.toMatch(/correct|internal|expectedBehaviour|redFlag|managerNote|answerExample|competenc|autoScore/i);
  });

  it("uses no field name the last-line filter would strip, so candidateSafe changes nothing", () => {
    for (const state of [buildCandidateState(input({ invitation: { ...input().invitation, consented: false } })), buildCandidateState(started())]) {
      expect(candidateSafe(state)).toEqual(state);
    }
  });
});

describe("where the candidate is", () => {
  it("walks consent, details, device check, then the first open stage", () => {
    expect(buildCandidateState(input({ invitation: { ...input().invitation, consented: false } })).step).toBe("CONSENT");
    expect(buildCandidateState(input({ invitation: { ...input().invitation, candidateEmail: null } })).step).toBe("INFO");
    expect(buildCandidateState(input({ invitation: { ...input().invitation, deviceChecked: false } })).step).toBe("CHECK");
    const state = buildCandidateState(input());
    expect(state).toMatchObject({ step: "STAGE", position: 1, path: "/stage/1" });
  });

  it("skips the device check when the version records nothing", () => {
    const textOnly = content([stage("s1", [activity("t", { type: "LONG_TEXT", config: {} })])]).stages;
    const state = buildCandidateState(input({ version: { ...input().version, stages: textOnly }, invitation: { ...input().invitation, deviceChecked: false } }));
    expect(state.step).toBe("STAGE");
    expect(state.devices).toEqual({ camera: false, microphone: false });
  });

  it("stops a candidate who has not started when the opening closes, but lets one inside finish", () => {
    expect(buildCandidateState(input({ opening: { ...input().opening, status: "CLOSED" } })).step).toBe("CLOSED");
    expect(buildCandidateState(started({ opening: { ...input().opening, status: "CLOSED" } })).step).toBe("STAGE");
  });

  it("is DONE once the attempt is complete, with the survey offered once", () => {
    const state = buildCandidateState(input({ invitation: { ...input().invitation, started: true, completedAt: T0 } }));
    expect(state.step).toBe("DONE");
    expect(state.path).toBe("/done");
    expect(state.finished).toEqual({ completedAt: T0.toISOString(), stagesDone: 0, feedbackBy: new Date(T0.getTime() + 7 * 86_400_000).toISOString(), survey: { enabled: true, answered: false } });
  });
});

describe("the running stage", () => {
  it("carries the server clock, the rules, and each answer with its state", () => {
    const state = buildCandidateState(started());
    expect(state.current).toMatchObject({
      position: 1,
      total: 2,
      seconds: 600,
      startedAt: T0.toISOString(),
      deadlineAt: new Date(T0.getTime() + 600_000).toISOString(),
      remainingMs: 600_000,
      autoSubmit: true,
      last: false,
      previous: null,
    });
    expect(state.current?.responses).toEqual([
      { activityId: "a1", text: "", choiceIds: [], usedTextAlternative: false, takesUsed: 1, recording: { ref: "m1", status: "READY", durationMs: 4000 }, file: null, answered: true, closed: false },
      { activityId: "a2", text: "", choiceIds: ["x"], usedTextAlternative: false, takesUsed: 0, recording: null, file: null, answered: true, closed: false },
    ]);
    expect(state.extraTimeLocked).toBe(true);
  });

  it("does not count a failed take as an answer", () => {
    const state = buildCandidateState(
      started({ responses: [{ stageId: "s1", activityId: "a1", payload: {}, takesUsed: 1, answeredAt: null, recording: { ref: "m1", status: "FAILED", durationMs: null } }] }),
    );
    expect(state.current?.responses[0]).toMatchObject({ recording: null, answered: false });
  });

  it("tells the next stage how the previous one ended, and stretches minutes by the extra time", () => {
    const state = buildCandidateState(
      input({
        invitation: { ...input().invitation, started: true, extraTimePct: 50 },
        runs: [{ stageId: "s1", startedAt: T0, deadlineAt: T0, submittedAt: T0, wasLate: true }],
      }),
    );
    expect(state).toMatchObject({ step: "STAGE", position: 2 });
    expect(state.current).toMatchObject({ previous: { position: 1, closedByClock: true }, last: true, seconds: 450, startedAt: null, remainingMs: null });
    expect(state.stages.map((s) => [s.minutes, s.done])).toEqual([
      [15, true],
      [8, false],
    ]);
    expect(state.totalMinutes).toBe(23);
    expect(state.extraTimeLocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/solutions/hiring/rules/disclosure.test.ts src/solutions/hiring/rules/candidate-state.test.ts`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Write `disclosure.ts`**

```ts
import { effectiveSeconds, type ExtraTimePct } from "./candidate-flow";
import type { CandidateVersion } from "./candidate-view";

/**
 * HIRING-UX 7.2 and A3: the landing names every signal that is recorded and
 * nothing else. Plan 2 records no monitoring signal (proctoring level OFF on
 * every invitation): only recorded answers and the technical log (upload
 * completeness and the last heartbeat of each stage). Plan 4 adds rows by level.
 */
export type RecordedSignal = "VIDEO_ANSWER" | "AUDIO_ANSWER" | "TECHNICAL";

const typesOf = (version: CandidateVersion) => new Set(version.stages.flatMap((s) => s.activities.map((a) => a.type)));

export function recordedSignals(version: CandidateVersion): RecordedSignal[] {
  const types = typesOf(version);
  const signals: RecordedSignal[] = [];
  if (types.has("VIDEO")) signals.push("VIDEO_ANSWER");
  if (types.has("AUDIO")) signals.push("AUDIO_ANSWER");
  signals.push("TECHNICAL");
  return signals;
}

/** What the device check proves and the landing lists under "İhtiyacın olanlar". */
export function devicesNeeded(version: CandidateVersion): { camera: boolean; microphone: boolean } {
  const types = typesOf(version);
  return { camera: types.has("VIDEO"), microphone: types.has("VIDEO") || types.has("AUDIO") };
}

/** Whole minutes on this candidate's clocks, extra time included. */
export function estimatedMinutes(version: CandidateVersion, pct: ExtraTimePct): number {
  return Math.ceil(version.stages.reduce((sum, s) => sum + effectiveSeconds(s.durationSeconds, pct), 0) / 60);
}
```

- [ ] **Step 4: Write `candidate-state.ts`**

```ts
import type { HiringResponsePayload } from "@/db/schema";
import type { I18nText } from "@/db/schema/types";
import { effectiveSeconds, hiringStepSuffix, responseAnswered, stageRules, type ExtraTimePct, type HiringStep, type StageRule } from "./candidate-flow";
import { toCandidateVersion, type CandidateStage } from "./candidate-view";
import { orderedActivities, orderedStages, type ContentStage } from "./content";
import { devicesNeeded, estimatedMinutes, recordedSignals, type RecordedSignal } from "./disclosure";

/**
 * Everything a hiring candidate's screens are built from (hiring solution
 * design 7). The ONLY source of question and stage text is
 * toCandidateVersion: the team-only fields never enter this object. The rest is
 * the candidate's own data. Field names avoid every name candidateSafe strips,
 * so the last-line filter changes nothing (a test proves it).
 */

export type CandidateResponseView = {
  activityId: string;
  text: string;
  choiceIds: string[];
  usedTextAlternative: boolean;
  takesUsed: number;
  /** The newest usable take; `ref` is the candidate's own upload reference (for playback). */
  recording: { ref: string; status: "UPLOADING" | "READY" | "INCOMPLETE"; durationMs: number | null } | null;
  file: { name: string; bytes: number } | null;
  answered: boolean;
  /** The candidate already closed this question (moved on). */
  closed: boolean;
};

export type CurrentStage = {
  position: number;
  total: number;
  stage: CandidateStage;
  /** Seconds on this candidate's clock (extra time included, grace not). */
  seconds: number;
  startedAt: string | null;
  deadlineAt: string | null;
  serverNow: string;
  remainingMs: number | null;
  backNavigation: boolean;
  /** The client submits when the clock reaches 0 (every timeout rule but ALLOW_LATE). */
  autoSubmit: boolean;
  rules: StageRule[];
  responses: CandidateResponseView[];
  /** The stage just before this one, for "Aşama 1 tamamlandı" or "Süre doldu" (HIRING-UX 6.10, 6.11). */
  previous: { position: number; closedByClock: boolean } | null;
  last: boolean;
};

export type HiringCandidateState = {
  step: HiringStep;
  position: number | null;
  /** The page this state lives on, relative to /a/[token] (rules/candidate-flow hiringStepSuffix). */
  path: string;
  orgName: string;
  positionName: string;
  candidateName: string | null;
  intro: { title: I18nText | null; body: I18nText | null };
  stages: Array<{ position: number; name: I18nText; minutes: number; questions: number; done: boolean }>;
  totalMinutes: number;
  reviewers: number;
  signals: RecordedSignal[];
  devices: { camera: boolean; microphone: boolean };
  extraTimePct: ExtraTimePct;
  extraTimeLocked: boolean;
  practice: boolean;
  contactEmail: string | null;
  retention: { mediaDays: number; candidateDays: number };
  current: CurrentStage | null;
  /** `feedbackBy`: the dated promise on the finish screen (completion + the opening's feedback days). */
  finished: { completedAt: string; stagesDone: number; feedbackBy: string; survey: { enabled: boolean; answered: boolean } } | null;
};

export type StateInput = {
  now: Date;
  orgName: string;
  contactEmail: string | null;
  retention: { mediaDays: number; candidateDays: number };
  opening: { status: "DRAFT" | "OPEN" | "CLOSED"; positionName: string; finishSurveyEnabled: boolean; feedbackDays: number };
  version: { stages: ContentStage[]; introTitle: I18nText | null; introBody: I18nText | null; practiceEnabled: boolean };
  invitation: {
    candidateName: string | null;
    candidateEmail: string | null;
    extraTimePct: ExtraTimePct;
    reviewers: number;
    consented: boolean;
    deviceChecked: boolean;
    /** A stage of this attempt has started. */
    started: boolean;
    completedAt: Date | null;
    surveyAnswered: boolean;
  };
  runs: Array<{ stageId: string; startedAt: Date | null; deadlineAt: Date | null; submittedAt: Date | null; wasLate: boolean }>;
  responses: Array<{
    stageId: string;
    activityId: string;
    payload: HiringResponsePayload;
    takesUsed: number;
    answeredAt: Date | null;
    recording: { ref: string; status: "UPLOADING" | "READY" | "INCOMPLETE" | "FAILED"; durationMs: number | null } | null;
  }>;
};

export function buildCandidateState(input: StateInput): HiringCandidateState {
  const view = toCandidateVersion({ stages: input.version.stages });
  const content = orderedStages({ stages: input.version.stages });
  const pct = input.invitation.extraTimePct;
  const runOf = (stageId: string) => input.runs.find((r) => r.stageId === stageId) ?? null;
  const devices = devicesNeeded(view);
  const inv = input.invitation;

  const openIndex = view.stages.findIndex((s) => !runOf(s.id)?.submittedAt);
  let step: HiringStep;
  if (inv.completedAt) step = "DONE";
  else if (input.opening.status === "CLOSED" && !inv.started) step = "CLOSED";
  else if (!inv.consented) step = "CONSENT";
  else if (!inv.candidateName || !inv.candidateEmail) step = "INFO";
  else if (devices.microphone && !inv.deviceChecked) step = "CHECK";
  else step = openIndex === -1 ? "DONE" : "STAGE";
  const position = step === "STAGE" ? openIndex + 1 : null;

  let current: CurrentStage | null = null;
  if (step === "STAGE") {
    const stageView = view.stages[openIndex];
    const stageContent = content[openIndex];
    const run = runOf(stageView.id);
    const deadline = run?.deadlineAt ?? null;
    const before = openIndex > 0 ? runOf(view.stages[openIndex - 1].id) : null;
    current = {
      position: openIndex + 1,
      total: view.stages.length,
      stage: stageView,
      seconds: effectiveSeconds(stageView.durationSeconds, pct),
      startedAt: run?.startedAt?.toISOString() ?? null,
      deadlineAt: deadline?.toISOString() ?? null,
      serverNow: input.now.toISOString(),
      remainingMs: deadline ? Math.max(0, deadline.getTime() - input.now.getTime()) : null,
      backNavigation: stageContent.backNavigation,
      autoSubmit: stageContent.onTimeout !== "ALLOW_LATE",
      rules: stageRules(stageView, { backNavigation: stageContent.backNavigation, onTimeout: stageContent.onTimeout }),
      responses: orderedActivities(stageContent).map((activity): CandidateResponseView => {
        const row = input.responses.find((r) => r.stageId === stageContent.id && r.activityId === activity.id);
        const payload = row?.payload ?? {};
        const take = row?.recording && row.recording.status !== "FAILED" ? { ref: row.recording.ref, status: row.recording.status, durationMs: row.recording.durationMs } : null;
        return {
          activityId: activity.id,
          text: payload.text ?? "",
          choiceIds: payload.choiceIds ?? [],
          usedTextAlternative: !!payload.usedTextAlternative,
          takesUsed: row?.takesUsed ?? 0,
          recording: take,
          file: payload.file ? { name: payload.file.name, bytes: payload.file.bytes } : null,
          answered: responseAnswered(activity, payload, take !== null),
          closed: !!row?.answeredAt,
        };
      }),
      previous: openIndex > 0 ? { position: openIndex, closedByClock: !!before?.wasLate } : null,
      last: openIndex === view.stages.length - 1,
    };
  }

  return {
    step,
    position,
    path: hiringStepSuffix(step, position),
    orgName: input.orgName,
    positionName: input.opening.positionName,
    candidateName: inv.candidateName,
    intro: { title: input.version.introTitle, body: input.version.introBody },
    stages: view.stages.map((s, i) => ({
      position: i + 1,
      name: s.name,
      minutes: Math.ceil(effectiveSeconds(s.durationSeconds, pct) / 60),
      questions: s.activities.length,
      done: !!runOf(s.id)?.submittedAt,
    })),
    totalMinutes: estimatedMinutes(view, pct),
    reviewers: inv.reviewers,
    signals: recordedSignals(view),
    devices,
    extraTimePct: pct,
    extraTimeLocked: !!inv.completedAt || input.runs.some((r) => r.startedAt && !r.submittedAt),
    practice: input.version.practiceEnabled && devices.microphone,
    contactEmail: input.contactEmail,
    retention: input.retention,
    current,
    finished: inv.completedAt
      ? {
          completedAt: inv.completedAt.toISOString(),
          stagesDone: input.runs.filter((r) => r.submittedAt).length,
          feedbackBy: new Date(inv.completedAt.getTime() + input.opening.feedbackDays * 86_400_000).toISOString(),
          survey: { enabled: input.opening.finishSurveyEnabled, answered: inv.surveyAnswered },
        }
      : null,
  };
}
```

- [ ] **Step 5: Run them to verify they pass**

Run: `pnpm exec vitest run src/solutions/hiring/rules/disclosure.test.ts src/solutions/hiring/rules/candidate-state.test.ts`
Expected: PASS.

- [ ] **Step 6: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
git add src/solutions/hiring/rules/disclosure.ts src/solutions/hiring/rules/disclosure.test.ts src/solutions/hiring/rules/candidate-state.ts src/solutions/hiring/rules/candidate-state.test.ts
git commit -m "Build the hiring candidate state from the candidate view only

The state every hiring candidate screen reads: the step and its path, the
stages with this candidate's minutes, what is recorded, the running stage
with its server clock, rules and answers, and the finish. Sentinel tests
with a positive control prove no team-only field is in it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pure rules of inviting (message, pasted list, expiry day, progress)

**Files:**
- Create: `src/solutions/hiring/rules/invitation.ts`
- Test: `src/solutions/hiring/rules/invitation.test.ts`

**Interfaces:**
- Consumes: `Locale` (`@/i18n/locale`).
- Produces:
  - `isEmail(value: string): boolean`; `MAX_INVITE_ROWS = 50`; `SURVEY_MIN_ANSWERS = 5` (re-exported by `server/invitations.ts`).
  - `inviteMessage(input: { locale: Locale; candidateName: string; orgName: string; positionName: string; url: string; deadline: string; minutes: number; contactEmail: string | null }): { subject: string; body: string }` (`deadline` is already formatted for the candidate's language).
  - `type InviteRow = { line: number; fullName: string; email: string; problem: "NAME" | "EMAIL" | "DUPLICATE" | null }` and `parseInviteRows(text: string): { rows: InviteRow[]; tooMany: boolean }`.
  - `addDays(day: string, days: number): string` and `linkExpiryDay(input: { chosen: string | null; openingDeadlineDay: string | null; today: string }): string` (all `YYYY-MM-DD`).
  - `type CandidateProgress = "INVITED" | "OPENED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED"` and `candidateProgress(input: { linkStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "RETAKE_AVAILABLE"; linkExpiresAt: Date; firstSeen: boolean; started: boolean; completed: boolean; now: Date }): CandidateProgress`.

- [ ] **Step 1: Write the failing test**

`src/solutions/hiring/rules/invitation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addDays, candidateProgress, inviteMessage, isEmail, linkExpiryDay, parseInviteRows } from "./invitation";

describe("the ready message (HIRING-UX 5.11)", () => {
  const base = { candidateName: "Elif Kaya", orgName: "Örnek A.Ş.", positionName: "Ürün Tasarımcısı", url: "https://kademe.test/a/abc", deadline: "14 Eki", minutes: 25, contactEmail: "deniz@ornek.com" };

  it("speaks to the candidate in Turkish with sen, with the name, the link, the deadline and a person to write to", () => {
    const { subject, body } = inviteMessage({ ...base, locale: "tr" });
    expect(subject).toBe("Örnek A.Ş.: Ürün Tasarımcısı değerlendirmesi");
    expect(body).toContain("Merhaba Elif Kaya,");
    expect(body).toContain("https://kademe.test/a/abc");
    expect(body).toContain("Son tarih: 14 Eki.");
    expect(body).toContain("yaklaşık 25 dakikada");
    expect(body).toContain("deniz@ornek.com");
    expect(body).not.toMatch(/sınız|siniz|iniz\b|ınız\b/);
  });

  it("has an English version and leaves the contact line out when there is none", () => {
    const { subject, body } = inviteMessage({ ...base, locale: "en", contactEmail: null, deadline: "14 Oct" });
    expect(subject).toBe("Örnek A.Ş.: Ürün Tasarımcısı assessment");
    expect(body).toContain("Hi Elif Kaya,");
    expect(body).toContain("Deadline: 14 Oct.");
    expect(body).not.toContain("write to");
  });

  it("never contains an em dash", () => {
    for (const locale of ["tr", "en"] as const) expect(JSON.stringify(inviteMessage({ ...base, locale }))).not.toContain("\u2014");
  });
});

describe("a pasted list of candidates", () => {
  it("reads name and e-mail in either order with comma, semicolon or tab, and skips blank lines", () => {
    const { rows, tooMany } = parseInviteRows('Elif Kaya, elif@example.com\n\n"ali@example.com";Ali Veli\nCan Demir\tcan@example.com\n');
    expect(tooMany).toBe(false);
    expect(rows).toEqual([
      { line: 1, fullName: "Elif Kaya", email: "elif@example.com", problem: null },
      { line: 3, fullName: "Ali Veli", email: "ali@example.com", problem: null },
      { line: 4, fullName: "Can Demir", email: "can@example.com", problem: null },
    ]);
  });

  it("marks a row without a name, with a bad e-mail, or repeating an e-mail", () => {
    const { rows } = parseInviteRows("elif@example.com\nAli, ali@\nElif Kaya, ELIF@example.com\nX, x@y.co");
    expect(rows.map((r) => r.problem)).toEqual(["NAME", "EMAIL", "DUPLICATE", "NAME"]);
  });

  it("takes at most 50 rows and says so", () => {
    const text = Array.from({ length: 51 }, (_, i) => `Aday ${i}, aday${i}@example.com`).join("\n");
    const { rows, tooMany } = parseInviteRows(text);
    expect(rows).toHaveLength(50);
    expect(tooMany).toBe(true);
  });

  it("checks e-mail the same way everywhere", () => {
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail("a b@c.co")).toBe(false);
  });
});

describe("the link's last day (decision 16)", () => {
  it("is the chosen day, else the opening's deadline while it is ahead, else 14 days from today", () => {
    expect(linkExpiryDay({ chosen: "2026-11-01", openingDeadlineDay: "2026-10-20", today: "2026-10-05" })).toBe("2026-11-01");
    expect(linkExpiryDay({ chosen: null, openingDeadlineDay: "2026-10-20", today: "2026-10-05" })).toBe("2026-10-20");
    expect(linkExpiryDay({ chosen: null, openingDeadlineDay: "2026-10-01", today: "2026-10-05" })).toBe("2026-10-19");
    expect(linkExpiryDay({ chosen: null, openingDeadlineDay: null, today: "2026-12-25" })).toBe("2027-01-08");
  });

  it("adds calendar days across month and year ends", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("where a candidate stands (the opening's Candidates tab)", () => {
  const now = new Date("2026-10-05T09:00:00Z");
  const future = new Date("2026-10-10T09:00:00Z");
  const base = { linkStatus: "NOT_STARTED" as const, linkExpiresAt: future, firstSeen: false, started: false, completed: false, now };
  it("moves from invited to opened to in progress to completed", () => {
    expect(candidateProgress(base)).toBe("INVITED");
    expect(candidateProgress({ ...base, firstSeen: true })).toBe("OPENED");
    expect(candidateProgress({ ...base, linkStatus: "IN_PROGRESS", firstSeen: true, started: true })).toBe("IN_PROGRESS");
    expect(candidateProgress({ ...base, linkStatus: "COMPLETED", started: true, completed: true })).toBe("COMPLETED");
  });

  it("calls an unopened link past its date expired, but never a started one", () => {
    expect(candidateProgress({ ...base, linkExpiresAt: new Date("2026-10-01T00:00:00Z") })).toBe("EXPIRED");
    expect(candidateProgress({ ...base, linkStatus: "EXPIRED" })).toBe("EXPIRED");
    expect(candidateProgress({ ...base, linkStatus: "IN_PROGRESS", started: true, linkExpiresAt: new Date("2026-10-01T00:00:00Z") })).toBe("IN_PROGRESS");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/solutions/hiring/rules/invitation.test.ts`
Expected: FAIL with `Failed to resolve import "./invitation"`.

- [ ] **Step 3: Write the rules**

`src/solutions/hiring/rules/invitation.ts`:

```ts
import type { Locale } from "@/i18n/locale";

/** Inviting a candidate (HIRING-UX 5.11), pure. */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const isEmail = (value: string): boolean => EMAIL_RE.test(value.trim());
export const MAX_INVITE_ROWS = 50;
/** The overview shows the candidate experience only from this many survey answers (HIRING-UX 5.4: no noisy signal). */
export const SURVEY_MIN_ANSWERS = 5;

/**
 * The ready message the manager copies (and the outbox keeps): in the
 * candidate's language, "sen", with the name, the link, the deadline, the
 * expected time and a person to write to.
 */
export function inviteMessage(input: {
  locale: Locale;
  candidateName: string;
  orgName: string;
  positionName: string;
  url: string;
  deadline: string;
  minutes: number;
  contactEmail: string | null;
}): { subject: string; body: string } {
  const { candidateName: name, orgName: org, positionName: position, url, deadline, minutes, contactEmail } = input;
  if (input.locale === "en") {
    return {
      subject: `${org}: ${position} assessment`,
      body: [
        `Hi ${name},`,
        `We prepared a short assessment for your application for ${position} at ${org}. You can complete it in your own time, in about ${minutes} minutes.`,
        `To start: ${url}`,
        `Deadline: ${deadline}. If you stop halfway, the same link brings you back to where you left off.`,
        ...(contactEmail ? [`If anything goes wrong, write to ${contactEmail}.`] : []),
      ].join("\n\n"),
    };
  }
  return {
    subject: `${org}: ${position} değerlendirmesi`,
    body: [
      `Merhaba ${name},`,
      `${org} için yaptığın ${position} başvurusu için kısa bir değerlendirme hazırladık. Kendi zamanında, yaklaşık ${minutes} dakikada tamamlayabilirsin.`,
      `Başlamak için: ${url}`,
      `Son tarih: ${deadline}. Yarıda bırakırsan aynı linkten kaldığın yerden devam edersin.`,
      ...(contactEmail ? [`Bir sorun olursa ${contactEmail} adresine yazabilirsin.`] : []),
    ].join("\n\n"),
  };
}

export type InviteRow = { line: number; fullName: string; email: string; problem: "NAME" | "EMAIL" | "DUPLICATE" | null };

const unquote = (cell: string) => cell.trim().replace(/^"(.*)"$/, "$1").trim();

/**
 * "Birden fazla aday": one candidate per line, a name and an e-mail separated
 * by a comma, semicolon or tab, in either order. Blank lines are skipped; a
 * row without a name, with a bad e-mail or repeating an earlier e-mail is
 * marked, never dropped, so the manager sees which line to fix.
 */
export function parseInviteRows(text: string): { rows: InviteRow[]; tooMany: boolean } {
  const rows: InviteRow[] = [];
  const seen = new Set<string>();
  let tooMany = false;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    if (rows.length === MAX_INVITE_ROWS) {
      tooMany = true;
      break;
    }
    const cells = lines[i].split(/[\t;,]/).map(unquote).filter(Boolean);
    const emailCell = cells.find((c) => c.includes("@")) ?? "";
    const fullName = cells.filter((c) => c !== emailCell).join(" ").trim();
    const email = emailCell.trim();
    const key = email.toLowerCase();
    const problem: InviteRow["problem"] = !isEmail(email) ? "EMAIL" : fullName.length < 2 ? "NAME" : seen.has(key) ? "DUPLICATE" : null;
    if (isEmail(email)) seen.add(key);
    rows.push({ line: i + 1, fullName, email, problem });
  }
  return { rows, tooMany };
}

/** A calendar day (YYYY-MM-DD) plus `days`, by the calendar, not by 24 hour steps. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Decision 16: the chosen day, else the opening's deadline while it is ahead, else 14 days from today. */
export function linkExpiryDay(input: { chosen: string | null; openingDeadlineDay: string | null; today: string }): string {
  if (input.chosen) return input.chosen;
  if (input.openingDeadlineDay && input.openingDeadlineDay >= input.today) return input.openingDeadlineDay;
  return addDays(input.today, 14);
}

export type CandidateProgress = "INVITED" | "OPENED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

/** One word for the Candidates tab: an unopened link past its date is expired, a started one never is. */
export function candidateProgress(input: {
  linkStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "RETAKE_AVAILABLE";
  linkExpiresAt: Date;
  firstSeen: boolean;
  started: boolean;
  completed: boolean;
  now: Date;
}): CandidateProgress {
  if (input.completed) return "COMPLETED";
  if (input.started) return "IN_PROGRESS";
  if (input.linkStatus === "EXPIRED" || input.linkExpiresAt.getTime() < input.now.getTime()) return "EXPIRED";
  return input.firstSeen ? "OPENED" : "INVITED";
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run src/solutions/hiring/rules/invitation.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
git add src/solutions/hiring/rules/invitation.ts src/solutions/hiring/rules/invitation.test.ts
git commit -m "Add the pure rules of inviting hiring candidates

The ready message in the candidate's language, the pasted list with marked
rows, the link's last day and one word for where a candidate stands.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Invitations on the server (create, new link, candidates, requests, funnel)

**Files:**
- Create: `src/solutions/hiring/consent-default.ts`, `src/solutions/hiring/server/consent.ts`, `src/solutions/hiring/server/invitations.ts`
- Modify: `src/solutions/hiring/server/test-fake-db.ts` (chain gains `groupBy`, `onConflictDoNothing`, `onConflictDoUpdate`)
- Test: `src/solutions/hiring/server/consent.test.ts`, `src/solutions/hiring/server/invitations.test.ts`

**Interfaces:**
- Consumes: Task 1 tables; Task 6 `inviteMessage`, `isEmail`, `linkExpiryDay`, `candidateProgress`, `CandidateProgress`; `deadlineToDate` (`../rules/opening-rules`); `workingVersions` (`../rules/versions`); `versionsOf` (`./versions`); `mintToken` (`@/lib/auth`); `orgDay`, `zonedDayStart` (`@/lib/org-timezone`); `shortDate` (`@/i18n/dates`); `isUuid` (`@/server/settings`).
- Produces:
  - `HIRING_CONSENT_TR`, `HIRING_CONSENT_EN` (`consent-default.ts`).
  - `ensureHiringConsentText(orgId: string, x?: Executor): Promise<string>` (the id).
  - `type InviteInput = { openingId: string; fullName: string; email: string; locale: Locale; deadline: string | null; allowDuplicate?: boolean }`, `type InviteRefusal = "NOT_FOUND" | "CLOSED" | "NOT_PUBLISHED" | "NO_EVALUATORS" | "NAME" | "EMAIL" | "DEADLINE_INVALID" | "DEADLINE_PAST" | "DUPLICATE"`, `type InviteOutcome = { ok: true; assessmentId: string; candidateId: string; url: string; expiresAt: Date; message: { subject: string; body: string } } | { ok: false; code: InviteRefusal; existing?: { assessmentId: string; invitedAt: Date } }`.
  - `createHiringInvitation(user: { id: string; orgId: string }, input: InviteInput, options?: { baseUrl?: string; now?: Date }): Promise<InviteOutcome>`.
  - `type NewLinkOutcome = { ok: true; url: string; expiresAt: Date; name: string; message: { subject: string; body: string } } | { ok: false; code: "NOT_FOUND" | "COMPLETED" | "CLOSED" }` and `newHiringLink(user: { id: string; orgId: string }, openingId: string, assessmentId: string, options?: { baseUrl?: string; now?: Date }): Promise<NewLinkOutcome>`.
  - `type OpeningCandidateRow = { assessmentId: string; candidateId: string; seq: number; name: string | null; email: string | null; locale: Locale; invitedAt: Date; link: { id: string; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "RETAKE_AVAILABLE"; expiresAt: Date } | null; progress: CandidateProgress; stagesDone: number; stageCount: number; lastActivityAt: Date | null; completedAt: Date | null; adapted: boolean; requests: Array<{ id: string; kind: string; message: string | null; createdAt: Date }> }` (requests only for `viewer.runs`) and `listOpeningCandidates(orgId: string, openingId: string, viewer: { runs: boolean; blindMode: boolean }, now?: Date): Promise<OpeningCandidateRow[]>`.
  - `markRequestHandled(user: { id: string; orgId: string }, openingId: string, requestId: string): Promise<boolean>`.
  - `median(values: number[]): number | null`; `type OpeningFunnel = { invited: number; started: number; completed: number; medianMinutes: number | null; estimateMinutes: number | null; survey: { count: number; average: number | null; latest: Array<{ rating: number; comment: string; at: Date }> } }` and `openingFunnel(orgId: string, openingId: string): Promise<OpeningFunnel>`.

- [ ] **Step 1: Extend the shared fake database**

In `src/solutions/hiring/server/test-fake-db.ts`, add to the `chain` object (next to `limit`):
```ts
    groupBy: () => chain,
    onConflictDoNothing: () => chain,
    onConflictDoUpdate: () => chain,
```

- [ ] **Step 2: Write the failing tests**

`src/solutions/hiring/server/consent.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, writesOf } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { HIRING_CONSENT_EN, HIRING_CONSENT_TR } from "../consent-default";
import { ensureHiringConsentText } from "./consent";

const ORG = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  fake.ops = [];
});

describe("ensureHiringConsentText", () => {
  it("returns the organisation's newest hiring text without writing", async () => {
    fake.respond = (op) => (op.table === "consent_texts" && op.kind === "select" ? [{ id: "ct-1", version: 2 }] : []);
    expect(await ensureHiringConsentText(ORG)).toBe("ct-1");
    const read = fake.ops.find((o) => o.table === "consent_texts")!;
    expect(read.where).toContain('"consent_texts"."solution" = $');
    expect(read.params).toEqual(expect.arrayContaining([ORG, "HIRING"]));
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("writes the built-in hiring text once when the organisation has none, under the organisation's lock", async () => {
    fake.respond = (op) => (op.kind === "insert" ? [{ id: "ct-new" }] : op.table === "organizations" ? [{ id: ORG }] : []);
    expect(await ensureHiringConsentText(ORG)).toBe("ct-new");
    expect(fake.ops.find((o) => o.table === "organizations")?.lock).toBe("update");
    const [insert] = writesOf(fake.ops);
    expect(insert.values).toEqual({ orgId: ORG, solution: "HIRING", version: 1, body: { tr: HIRING_CONSENT_TR, en: HIRING_CONSENT_EN } });
  });

  it("promises no monitoring, no AI scoring, and says who sees the answers", () => {
    expect(HIRING_CONSENT_TR).toContain("izlenmez");
    expect(HIRING_CONSENT_TR).toContain("puanlamaz");
    expect(HIRING_CONSENT_EN).toContain("not monitored");
    for (const text of [HIRING_CONSENT_TR, HIRING_CONSENT_EN]) expect(text).not.toContain("\u2014");
  });
});
```

`src/solutions/hiring/server/invitations.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, writesOf, type Op } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));
vi.mock("./consent", () => ({ ensureHiringConsentText: async () => "ct-1" }));

import { createHiringInvitation, listOpeningCandidates, markRequestHandled, median, newHiringLink } from "./invitations";

const ORG = "11111111-1111-4111-8111-111111111111";
const OPENING = "22222222-2222-4222-8222-222222222222";
const VERSION = "33333333-3333-4333-8333-333333333333";
const USER = "44444444-4444-4444-8444-444444444444";
const EVAL_A = "55555555-5555-4555-8555-555555555555";
const EVAL_B = "66666666-6666-4666-8666-666666666666";
const ASSESSMENT = "77777777-7777-4777-8777-777777777777";
const NOW = new Date("2026-10-05T09:00:00Z");
const user = { id: USER, orgId: ORG };
const input = { openingId: OPENING, fullName: "Elif Kaya", email: "elif@example.com", locale: "tr" as const, deadline: null };

type World = { opening: Record<string, unknown> | null; versions: unknown[]; panel: unknown[]; existing: unknown[] };
let world: World;

function respond(op: Op): unknown[] {
  if (op.kind === "select" && op.table === "hiring_openings") return world.opening ? [world.opening] : [];
  if (op.kind === "select" && op.table === "hiring_versions") return world.versions;
  if (op.kind === "select" && op.table === "hiring_opening_members") return world.panel;
  if (op.kind === "select" && op.table === "hiring_assessments") return world.existing;
  if (op.kind === "select" && op.table === "hiring_stages") return [{ total: 1500 }];
  if (op.kind === "select" && op.table === "organizations") return [{ name: "Örnek A.Ş.", contactEmail: "ik@ornek.com" }];
  if (op.kind === "select" && op.table === "positions") return [{ name: "Ürün Tasarımcısı" }];
  if (op.kind === "insert" && op.table === "candidates") return [{ id: "c-1" }];
  if (op.kind === "insert" && op.table === "assessments") return [{ id: ASSESSMENT, createdAt: NOW }];
  return [];
}

beforeEach(() => {
  fake.ops = [];
  fake.respond = respond;
  world = {
    opening: { id: OPENING, status: "OPEN", deadlineAt: null, positionId: "p-1", candidateContactEmail: "deniz@ornek.com" },
    versions: [{ id: VERSION, number: 1, status: "PUBLISHED", publishedAt: NOW, previewedAt: null, updatedAt: NOW }],
    panel: [{ userId: EVAL_A }, { userId: EVAL_B }],
    existing: [],
  };
});

describe("createHiringInvitation", () => {
  it("refuses a missing name or a bad e-mail before reading anything", async () => {
    expect(await createHiringInvitation(user, { ...input, fullName: " " }, { now: NOW })).toEqual({ ok: false, code: "NAME" });
    expect(await createHiringInvitation(user, { ...input, email: "elif@" }, { now: NOW })).toEqual({ ok: false, code: "EMAIL" });
    expect(await createHiringInvitation(user, { ...input, deadline: "2026-02-30" }, { now: NOW })).toEqual({ ok: false, code: "DEADLINE_INVALID" });
    expect(await createHiringInvitation(user, { ...input, deadline: "2026-10-01" }, { now: NOW })).toEqual({ ok: false, code: "DEADLINE_PAST" });
    expect(fake.ops).toEqual([]);
  });

  it("reads the opening of the caller's organisation and holds it against a close", async () => {
    await createHiringInvitation(user, input, { now: NOW });
    const read = fake.ops.find((o) => o.table === "hiring_openings")!;
    expect(read.where).toContain('"hiring_openings"."org_id" = $');
    expect(read.params).toEqual(expect.arrayContaining([OPENING, ORG]));
    expect(read.lock).toBe("share");
  });

  it.each([
    ["an unknown opening", { opening: null }, "NOT_FOUND"],
    ["a closed opening", { opening: { id: OPENING, status: "CLOSED", deadlineAt: null, positionId: "p-1", candidateContactEmail: null } }, "CLOSED"],
    ["an opening without a published version", { versions: [{ id: VERSION, number: 1, status: "DRAFT", publishedAt: null, previewedAt: null, updatedAt: NOW }] }, "NOT_PUBLISHED"],
    ["an opening without an active evaluator", { panel: [] }, "NO_EVALUATORS"],
  ] as const)("refuses %s and writes nothing", async (_label, change, code) => {
    world = { ...world, ...change } as World;
    expect(await createHiringInvitation(user, input, { now: NOW })).toEqual({ ok: false, code });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("refuses an e-mail already invited to this opening, naming that invitation", async () => {
    world.existing = [{ assessmentId: "old", invitedAt: NOW }];
    expect(await createHiringInvitation(user, input, { now: NOW })).toEqual({ ok: false, code: "DUPLICATE", existing: { assessmentId: "old", invitedAt: NOW } });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("writes the person, the HIRING invitation, its frozen terms, the panel, one link, the ready message and the audit row", async () => {
    const result = await createHiringInvitation(user, input, { now: NOW, baseUrl: "https://kademe.test" });
    expect(result.ok).toBe(true);
    const writes = writesOf(fake.ops);
    expect(writes.map((w) => w.table)).toEqual(["candidates", "assessments", "hiring_assessments", "hiring_assignments", "assessment_links", "message_outbox", "audit_logs"]);
    expect(writes[1].values).toMatchObject({ orgId: ORG, candidateId: "c-1", solution: "HIRING", locale: "tr", invitedBy: USER });
    expect(writes[2].values).toEqual({ assessmentId: ASSESSMENT, orgId: ORG, openingId: OPENING, versionId: VERSION, consentTextId: "ct-1", proctorLevel: "OFF", extraTimePct: 0 });
    expect(writes[3].values).toEqual([
      { assessmentId: ASSESSMENT, userId: EVAL_A },
      { assessmentId: ASSESSMENT, userId: EVAL_B },
    ]);
    expect(writes[4].values).toMatchObject({ assessmentId: ASSESSMENT, status: "NOT_STARTED", attemptsAllowed: 1 });
    const outbox = writes[5].values as { kind: string; toEmail: string; subject: string; body: string };
    expect(outbox).toMatchObject({ kind: "INVITE", toEmail: "elif@example.com", subject: "Örnek A.Ş.: Ürün Tasarımcısı değerlendirmesi" });
    expect(outbox.body).toContain("yaklaşık 25 dakikada");
    expect(outbox.body).toContain("deniz@ornek.com");
    if (result.ok) {
      expect(result.url.startsWith("https://kademe.test/a/")).toBe(true);
      expect(outbox.body).toContain(result.url);
      expect(result.message.body).toBe(outbox.body);
      // 14 days from 5 Oct, the end of that day in the organisation's zone.
      expect(result.expiresAt.toISOString().slice(0, 10)).toBe("2026-10-19");
    }
    expect(writes[6].values).toMatchObject({ orgId: ORG, actorId: USER, action: "hiring.candidate.invite", subjectType: "assessment", subjectId: ASSESSMENT });
  });

  it("keeps a duplicate when the manager asked for it on purpose", async () => {
    world.existing = [{ assessmentId: "old", invitedAt: NOW }];
    expect((await createHiringInvitation(user, { ...input, allowDuplicate: true }, { now: NOW })).ok).toBe(true);
  });
});

describe("newHiringLink", () => {
  it("expires the old link and issues one that keeps the progress state", async () => {
    fake.respond = (op) => {
      if (op.kind === "select" && op.table === "hiring_assessments")
        return [{ assessmentId: ASSESSMENT, versionId: VERSION, openingStatus: "OPEN", positionId: "p-1", candidateContactEmail: null, name: "Elif Kaya", email: "elif@example.com", locale: "en" }];
      if (op.kind === "select" && op.table === "assessment_links") return [{ id: "l-old", status: "IN_PROGRESS", expiresAt: new Date("2026-10-06T20:59:59Z") }];
      return respond(op);
    };
    const result = await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW, baseUrl: "https://kademe.test" });
    expect(result.ok).toBe(true);
    const writes = writesOf(fake.ops);
    expect(writes[0]).toMatchObject({ kind: "update", table: "assessment_links", values: { status: "EXPIRED" } });
    expect(writes[1]).toMatchObject({ kind: "insert", table: "assessment_links", values: { assessmentId: ASSESSMENT, status: "IN_PROGRESS" } });
    expect(writes.map((w) => w.table)).toContain("message_outbox");
    expect(writes.map((w) => w.table)).toContain("audit_logs");
    if (result.ok) expect(result.expiresAt.getTime()).toBeGreaterThan(new Date("2026-10-11T00:00:00Z").getTime());
  });

  it("does not replace the link of a finished candidate", async () => {
    fake.respond = (op) => {
      if (op.kind === "select" && op.table === "hiring_assessments")
        return [{ assessmentId: ASSESSMENT, versionId: VERSION, openingStatus: "OPEN", positionId: "p-1", candidateContactEmail: null, name: "Elif", email: "e@x.co", locale: "tr" }];
      if (op.kind === "select" && op.table === "assessment_links") return [{ id: "l", status: "COMPLETED", expiresAt: NOW }];
      return [];
    };
    expect(await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).toEqual({ ok: false, code: "COMPLETED" });
    expect(writesOf(fake.ops)).toEqual([]);
  });
});

describe("listOpeningCandidates", () => {
  const rows = [
    { assessmentId: "a1", candidateId: "c1", name: "Elif Kaya", email: "elif@example.com", locale: "tr", invitedAt: NOW, versionId: VERSION, extraTimePct: 25, firstSeenAt: null },
    { assessmentId: "a2", candidateId: "c2", name: "Can Demir", email: "can@example.com", locale: "en", invitedAt: NOW, versionId: VERSION, extraTimePct: 0, firstSeenAt: null },
  ];
  function world2(op: Op): unknown[] {
    if (op.table === "hiring_assessments") return rows;
    if (op.table === "assessment_links") return [{ id: "l1", assessmentId: "a1", status: "IN_PROGRESS", expiresAt: NOW, firstSeenIp: "1.2.3.4", createdAt: NOW }];
    if (op.table === "attempts") return [{ id: "t1", assessmentId: "a1", startedAt: NOW, completedAt: null }];
    if (op.table === "hiring_stage_runs") return [{ attemptId: "t1", startedAt: NOW, submittedAt: NOW, lastHeartbeatAt: null }];
    if (op.table === "hiring_stages") return [{ versionId: VERSION, count: 3 }];
    if (op.table === "deletion_requests") return [{ id: "r1", candidateId: "c2", kind: "NEW_LINK", message: null, createdAt: NOW }];
    return [];
  }

  it("reads only the caller's organisation and opening", async () => {
    fake.respond = world2;
    await listOpeningCandidates(ORG, OPENING, { runs: true, blindMode: false }, NOW);
    const read = fake.ops.find((o) => o.table === "hiring_assessments")!;
    expect(read.where).toContain('"hiring_assessments"."org_id" = $');
    expect(read.params).toEqual(expect.arrayContaining([ORG, OPENING]));
  });

  it("shows progress, requests and the adaptation flag to someone who runs the opening", async () => {
    fake.respond = world2;
    const list = await listOpeningCandidates(ORG, OPENING, { runs: true, blindMode: false }, NOW);
    expect(list[0]).toMatchObject({ seq: 1, name: "Elif Kaya", progress: "IN_PROGRESS", stagesDone: 1, stageCount: 3, adapted: true, requests: [] });
    expect(list[1]).toMatchObject({ seq: 2, name: "Can Demir", link: null, adapted: false, requests: [{ id: "r1", kind: "NEW_LINK", message: null, createdAt: NOW }] });
  });

  it("never tells a reviewer about extra time, and hides identity when blind mode is on", async () => {
    fake.respond = world2;
    const list = await listOpeningCandidates(ORG, OPENING, { runs: false, blindMode: true }, NOW);
    expect(list.map((r) => [r.name, r.email, r.adapted, r.requests.length])).toEqual([
      [null, null, false, 0],
      [null, null, false, 0],
    ]);
    expect(JSON.stringify(list)).not.toContain("Elif");
  });
});

describe("markRequestHandled", () => {
  it("closes only a request of a candidate invited to this opening of this organisation", async () => {
    fake.respond = (op) => (op.kind === "select" ? [] : []);
    expect(await markRequestHandled(user, OPENING, "88888888-8888-4888-8888-888888888888")).toBe(false);
    expect(writesOf(fake.ops)).toEqual([]);
    fake.ops = [];
    fake.respond = (op) => (op.kind === "select" ? [{ id: "r1" }] : [{ id: "r1" }]);
    expect(await markRequestHandled(user, OPENING, "88888888-8888-4888-8888-888888888888")).toBe(true);
    const select = fake.ops[0];
    expect(select.params).toEqual(expect.arrayContaining([ORG, OPENING]));
    expect(writesOf(fake.ops)[0]).toMatchObject({ table: "deletion_requests", values: { handledBy: USER } });
  });
});

describe("median", () => {
  it("is the middle value, the mean of the two middle ones, or null", () => {
    expect(median([])).toBeNull();
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 40, 20, 30])).toBe(25);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm exec vitest run src/solutions/hiring/server/consent.test.ts src/solutions/hiring/server/invitations.test.ts`
Expected: FAIL with unresolved imports.

- [ ] **Step 4: The built-in consent text and its writer**

`src/solutions/hiring/consent-default.ts`:
```ts
/**
 * The hiring consent text an organisation gets when it has none (decision 3).
 * It describes exactly what plan 2 records: answers, files, video and audio of
 * recorded questions, and technical upload and connection facts; no
 * monitoring. A level with monitoring (plan 4) needs a new text version.
 */
export const HIRING_CONSENT_TR =
  "Bu değerlendirme, bu pozisyona yaptığın başvuruyu değerlendirmek için hazırlandı. Cevapların (yazdıkların, seçimlerin, yüklediğin dosyalar ve video ya da ses sorularında görüntün ve sesin) ve teknik kayıtlar (yüklemelerin tamamlanıp tamamlanmadığı, bağlantının son görüldüğü an) saklanır. Bu değerlendirmede ekranın, sekmelerin ya da pencere hareketlerin izlenmez. Cevaplarını yalnızca bu pozisyonun işe alım ekibi görür; ekipteki değerlendiriciler aynı sorular ve aynı ölçütlerle, birbirinden bağımsız puanlar. Yapay zekâ seni puanlamaz, sıralamaz ya da elemez; yalnızca video ve ses cevaplarını yazıya döker (bunun için kayıtlar ElevenLabs'e gönderilir). Duygu, kişilik ya da yüz tanıma yapılmaz. Hiçbir kayıt seni otomatik olarak elemez; kararı insanlar verir. Kayıtlar kurumun belirlediği süre boyunca saklanır, sonra silinir. Verilerinle ilgili taleplerini bu sayfadaki veri hakları bağlantısından iletebilirsin.";

export const HIRING_CONSENT_EN =
  "This assessment was prepared to evaluate your application for this role. Your answers (what you write, your choices, the files you upload, and your picture and voice in video or audio questions) and technical records (whether uploads completed, when the connection was last seen) are kept. Your screen, tabs and windows are not monitored in this assessment. Only this role's hiring team sees your answers; the evaluators on the team score them independently, with the same questions and the same criteria. AI does not score, rank or reject you; it only transcribes your video and audio answers (the recordings are sent to ElevenLabs for that). No emotion, personality or face recognition is used. Nothing here rejects you automatically; people make the decision. Records are kept for the period the organisation sets and then deleted. You can send requests about your data from the data rights link on this page.";
```

`src/solutions/hiring/server/consent.ts`:
```ts
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { consentTexts, organizations } from "@/db/schema";
import { HIRING_CONSENT_EN, HIRING_CONSENT_TR } from "../consent-default";

/**
 * The organisation's current hiring consent text, created from the built-in
 * text on first need (decision 3). The organisation row is locked first, so two
 * invitations at the same moment write one text, not two.
 */
export async function ensureHiringConsentText(orgId: string, x: Executor = db): Promise<string> {
  const newest = () =>
    x
      .select({ id: consentTexts.id, version: consentTexts.version })
      .from(consentTexts)
      .where(and(eq(consentTexts.orgId, orgId), eq(consentTexts.solution, "HIRING")))
      .orderBy(desc(consentTexts.version))
      .limit(1);
  const [found] = await newest();
  if (found) return found.id;
  await x.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).for("update");
  const [again] = await newest();
  if (again) return again.id;
  const [created] = await x
    .insert(consentTexts)
    .values({ orgId, solution: "HIRING", version: 1, body: { tr: HIRING_CONSENT_TR, en: HIRING_CONSENT_EN } })
    .returning({ id: consentTexts.id });
  return created.id;
}
```

- [ ] **Step 5: Invitations**

`src/solutions/hiring/server/invitations.ts`:
```ts
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import {
  assessmentLinks,
  assessments,
  attempts,
  auditLogs,
  candidates,
  deletionRequests,
  hiringAssessments,
  hiringAssignments,
  hiringOpeningMembers,
  hiringOpenings,
  hiringStageRuns,
  hiringStages,
  hiringSurveyResponses,
  messageOutbox,
  organizations,
  positions,
  users,
} from "@/db/schema";
import { shortDate } from "@/i18n/dates";
import type { Locale } from "@/i18n/locale";
import { mintToken } from "@/lib/auth";
import { orgDay, zonedDayStart } from "@/lib/org-timezone";
import { isUuid } from "@/server/settings";
import { candidateProgress, inviteMessage, isEmail, linkExpiryDay, SURVEY_MIN_ANSWERS, type CandidateProgress } from "../rules/invitation";
import { deadlineToDate } from "../rules/opening-rules";
import { workingVersions } from "../rules/versions";
import { ensureHiringConsentText } from "./consent";
import { versionsOf } from "./versions";

/**
 * Inviting candidates to an opening (HIRING-UX 5.11) and the opening's view of
 * them. Every read and write is scoped to the caller's organisation; the
 * opening is read FOR SHARE while an invitation is written, so a close
 * (FOR UPDATE) waits until the invitation exists or refuses it.
 */

export type InviteInput = { openingId: string; fullName: string; email: string; locale: Locale; deadline: string | null; allowDuplicate?: boolean };
export type InviteRefusal = "NOT_FOUND" | "CLOSED" | "NOT_PUBLISHED" | "NO_EVALUATORS" | "NAME" | "EMAIL" | "DEADLINE_INVALID" | "DEADLINE_PAST" | "DUPLICATE";
export type InviteOutcome =
  | { ok: true; assessmentId: string; candidateId: string; url: string; expiresAt: Date; message: { subject: string; body: string } }
  | { ok: false; code: InviteRefusal; existing?: { assessmentId: string; invitedAt: Date } };

const origin = (baseUrl?: string) => baseUrl ?? process.env.APP_ORIGIN ?? "http://localhost:3100";

/** The words of the ready message: organisation, position, minutes on the clock (without extra time), contact. */
async function messageParts(x: Executor, orgId: string, positionId: string, versionId: string) {
  const [[org], [position], [length]] = await Promise.all([
    x.select({ name: organizations.name, contactEmail: organizations.contactEmail }).from(organizations).where(eq(organizations.id, orgId)).limit(1),
    x.select({ name: positions.name }).from(positions).where(and(eq(positions.id, positionId), eq(positions.orgId, orgId))).limit(1),
    x.select({ total: sql<number>`coalesce(sum(${hiringStages.durationSeconds}), 0)::int` }).from(hiringStages).where(eq(hiringStages.versionId, versionId)),
  ]);
  return { orgName: org?.name ?? "", orgContact: org?.contactEmail ?? null, positionName: position?.name ?? "", minutes: Math.ceil(Number(length?.total ?? 0) / 60) };
}

export async function createHiringInvitation(
  user: { id: string; orgId: string },
  input: InviteInput,
  options: { baseUrl?: string; now?: Date } = {},
): Promise<InviteOutcome> {
  const now = options.now ?? new Date();
  const fullName = input.fullName.trim().slice(0, 120);
  const email = input.email.trim().slice(0, 160);
  if (fullName.length < 2) return { ok: false, code: "NAME" };
  if (!isEmail(email)) return { ok: false, code: "EMAIL" };
  const today = orgDay(now);
  if (input.deadline !== null) {
    if (!zonedDayStart(input.deadline)) return { ok: false, code: "DEADLINE_INVALID" };
    if (input.deadline < today) return { ok: false, code: "DEADLINE_PAST" };
  }
  if (!isUuid(input.openingId)) return { ok: false, code: "NOT_FOUND" };

  return db.transaction(async (tx) => {
    const [opening] = await tx
      .select({ id: hiringOpenings.id, status: hiringOpenings.status, deadlineAt: hiringOpenings.deadlineAt, positionId: hiringOpenings.positionId, candidateContactEmail: hiringOpenings.candidateContactEmail })
      .from(hiringOpenings)
      .where(and(eq(hiringOpenings.id, input.openingId), eq(hiringOpenings.orgId, user.orgId)))
      .for("share");
    if (!opening) return { ok: false as const, code: "NOT_FOUND" as const };
    if (opening.status === "CLOSED") return { ok: false as const, code: "CLOSED" as const };
    const { live } = workingVersions(await versionsOf(user.orgId, opening.id, tx));
    if (opening.status !== "OPEN" || !live) return { ok: false as const, code: "NOT_PUBLISHED" as const };

    // Decision 4: the opening's active panel, the organisation's own users only.
    const panel = await tx
      .select({ userId: hiringOpeningMembers.userId })
      .from(hiringOpeningMembers)
      .innerJoin(users, and(eq(users.id, hiringOpeningMembers.userId), eq(users.orgId, user.orgId), isNull(users.disabledAt)))
      .where(eq(hiringOpeningMembers.openingId, opening.id))
      .orderBy(asc(hiringOpeningMembers.userId));
    if (panel.length === 0) return { ok: false as const, code: "NO_EVALUATORS" as const };

    if (!input.allowDuplicate) {
      const [existing] = await tx
        .select({ assessmentId: hiringAssessments.assessmentId, invitedAt: assessments.createdAt })
        .from(hiringAssessments)
        .innerJoin(assessments, eq(assessments.id, hiringAssessments.assessmentId))
        .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
        .where(and(eq(hiringAssessments.orgId, user.orgId), eq(hiringAssessments.openingId, opening.id), sql`lower(${candidates.email}) = lower(${email})`))
        .orderBy(desc(assessments.createdAt))
        .limit(1);
      if (existing) return { ok: false as const, code: "DUPLICATE" as const, existing };
    }

    const consentTextId = await ensureHiringConsentText(user.orgId, tx);
    const parts = await messageParts(tx, user.orgId, opening.positionId, live.id);
    const day = linkExpiryDay({ chosen: input.deadline, openingDeadlineDay: opening.deadlineAt ? orgDay(opening.deadlineAt) : null, today });
    const expiresAt = deadlineToDate(day);
    const token = mintToken();
    const url = `${origin(options.baseUrl)}/a/${token.raw}`;

    const [person] = await tx.insert(candidates).values({ orgId: user.orgId, fullName, email }).returning({ id: candidates.id });
    const [assessment] = await tx
      .insert(assessments)
      .values({ orgId: user.orgId, candidateId: person.id, solution: "HIRING", locale: input.locale, invitedBy: user.id })
      .returning({ id: assessments.id, createdAt: assessments.createdAt });
    await tx.insert(hiringAssessments).values({
      assessmentId: assessment.id,
      orgId: user.orgId,
      openingId: opening.id,
      versionId: live.id,
      consentTextId,
      proctorLevel: "OFF",
      extraTimePct: 0,
    });
    await tx.insert(hiringAssignments).values(panel.map((p) => ({ assessmentId: assessment.id, userId: p.userId })));
    await tx.insert(assessmentLinks).values({ assessmentId: assessment.id, tokenHash: token.hash, status: "NOT_STARTED", expiresAt, attemptsAllowed: 1 });
    const message = inviteMessage({
      locale: input.locale,
      candidateName: fullName,
      orgName: parts.orgName,
      positionName: parts.positionName,
      url,
      deadline: shortDate(expiresAt, input.locale),
      minutes: parts.minutes,
      contactEmail: opening.candidateContactEmail ?? parts.orgContact,
    });
    await tx.insert(messageOutbox).values({ orgId: user.orgId, kind: "INVITE", toEmail: email, subject: message.subject, body: message.body });
    await tx.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "hiring.candidate.invite",
      subjectType: "assessment",
      subjectId: assessment.id,
      meta: { openingId: opening.id, versionId: live.id, evaluators: panel.length, expiresAt: expiresAt.toISOString() },
    });
    return { ok: true as const, assessmentId: assessment.id, candidateId: person.id, url, expiresAt, message };
  });
}

export type NewLinkOutcome =
  | { ok: true; url: string; expiresAt: Date; name: string; message: { subject: string; body: string } }
  | { ok: false; code: "NOT_FOUND" | "COMPLETED" | "CLOSED" };

const DAY_MS = 86_400_000;

/**
 * "Yeni link üret": the old link stops working (EXPIRED, kept for history), a
 * new one keeps the progress state and lives at least seven more days. A
 * finished candidate keeps their link (it is their way back to /done).
 */
export async function newHiringLink(
  user: { id: string; orgId: string },
  openingId: string,
  assessmentId: string,
  options: { baseUrl?: string; now?: Date } = {},
): Promise<NewLinkOutcome> {
  if (!isUuid(openingId) || !isUuid(assessmentId)) return { ok: false, code: "NOT_FOUND" };
  const now = options.now ?? new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        assessmentId: hiringAssessments.assessmentId,
        versionId: hiringAssessments.versionId,
        openingStatus: hiringOpenings.status,
        positionId: hiringOpenings.positionId,
        candidateContactEmail: hiringOpenings.candidateContactEmail,
        name: candidates.fullName,
        email: candidates.email,
        locale: assessments.locale,
      })
      .from(hiringAssessments)
      .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringAssessments.openingId), eq(hiringOpenings.orgId, user.orgId)))
      .innerJoin(assessments, eq(assessments.id, hiringAssessments.assessmentId))
      .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
      .where(and(eq(hiringAssessments.assessmentId, assessmentId), eq(hiringAssessments.orgId, user.orgId), eq(hiringAssessments.openingId, openingId)))
      .limit(1);
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };
    if (row.openingStatus === "CLOSED") return { ok: false as const, code: "CLOSED" as const };
    const [old] = await tx
      .select({ id: assessmentLinks.id, status: assessmentLinks.status, expiresAt: assessmentLinks.expiresAt })
      .from(assessmentLinks)
      .where(and(eq(assessmentLinks.assessmentId, assessmentId), ne(assessmentLinks.status, "EXPIRED")))
      .for("update");
    if (old?.status === "COMPLETED") return { ok: false as const, code: "COMPLETED" as const };
    if (old) await tx.update(assessmentLinks).set({ status: "EXPIRED" }).where(eq(assessmentLinks.id, old.id));
    const week = deadlineToDate(orgDay(new Date(now.getTime() + 7 * DAY_MS)));
    const expiresAt = old && old.expiresAt.getTime() > week.getTime() ? old.expiresAt : week;
    const token = mintToken();
    const url = `${origin(options.baseUrl)}/a/${token.raw}`;
    await tx.insert(assessmentLinks).values({
      assessmentId,
      tokenHash: token.hash,
      status: old?.status === "IN_PROGRESS" ? "IN_PROGRESS" : "NOT_STARTED",
      expiresAt,
      attemptsAllowed: 1,
    });
    const parts = await messageParts(tx, user.orgId, row.positionId, row.versionId);
    const message = inviteMessage({
      locale: row.locale,
      candidateName: row.name ?? "",
      orgName: parts.orgName,
      positionName: parts.positionName,
      url,
      deadline: shortDate(expiresAt, row.locale),
      minutes: parts.minutes,
      contactEmail: row.candidateContactEmail ?? parts.orgContact,
    });
    if (row.email) await tx.insert(messageOutbox).values({ orgId: user.orgId, kind: "INVITE", toEmail: row.email, subject: message.subject, body: message.body });
    await tx.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "hiring.candidate.link",
      subjectType: "assessment",
      subjectId: assessmentId,
      meta: { openingId, replaced: old?.id ?? null, expiresAt: expiresAt.toISOString() },
    });
    return { ok: true as const, url, expiresAt, name: row.name ?? "", message };
  });
}

export type OpeningCandidateRow = {
  assessmentId: string;
  candidateId: string;
  /** Invitation order, 1-based: "Aday 3" when identity is hidden. */
  seq: number;
  name: string | null;
  email: string | null;
  locale: Locale;
  invitedAt: Date;
  link: { id: string; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "RETAKE_AVAILABLE"; expiresAt: Date } | null;
  progress: CandidateProgress;
  stagesDone: number;
  stageCount: number;
  lastActivityAt: Date | null;
  completedAt: Date | null;
  /** "Süre uyarlaması uygulandı", only for someone who runs the opening; never the percentage (HIRING-UX A6). */
  adapted: boolean;
  /** The candidate's open requests (accommodation, new link, data rights); only for someone who runs the opening. */
  requests: Array<{ id: string; kind: string; message: string | null; createdAt: Date }>;
};

const latest = (...dates: Array<Date | null>) => dates.reduce<Date | null>((a, b) => (b && (!a || b > a) ? b : a), null);

/**
 * The opening's Candidates tab. `viewer.runs` (owner or manager) sees the
 * adaptation flag and acts on links and requests; a reviewer with blind mode
 * on gets no name and no e-mail at all (HIRING-UX 3.8; plan 3 lifts it after
 * their own submission).
 */
export async function listOpeningCandidates(
  orgId: string,
  openingId: string,
  viewer: { runs: boolean; blindMode: boolean },
  now: Date = new Date(),
): Promise<OpeningCandidateRow[]> {
  if (!isUuid(openingId)) return [];
  const rows = await db
    .select({
      assessmentId: hiringAssessments.assessmentId,
      candidateId: candidates.id,
      name: candidates.fullName,
      email: candidates.email,
      locale: assessments.locale,
      invitedAt: assessments.createdAt,
      versionId: hiringAssessments.versionId,
      extraTimePct: hiringAssessments.extraTimePct,
    })
    .from(hiringAssessments)
    .innerJoin(assessments, eq(assessments.id, hiringAssessments.assessmentId))
    .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
    .where(and(eq(hiringAssessments.orgId, orgId), eq(hiringAssessments.openingId, openingId)))
    .orderBy(asc(assessments.createdAt), asc(hiringAssessments.assessmentId));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.assessmentId);
  const [links, attemptRows, counts, requests] = await Promise.all([
    db
      .select({ id: assessmentLinks.id, assessmentId: assessmentLinks.assessmentId, status: assessmentLinks.status, expiresAt: assessmentLinks.expiresAt, firstSeenIp: assessmentLinks.firstSeenIp, createdAt: assessmentLinks.createdAt })
      .from(assessmentLinks)
      .where(inArray(assessmentLinks.assessmentId, ids))
      .orderBy(desc(assessmentLinks.createdAt)),
    db
      .select({ id: attempts.id, assessmentId: attempts.assessmentId, startedAt: attempts.startedAt, completedAt: attempts.completedAt })
      .from(attempts)
      .where(inArray(attempts.assessmentId, ids)),
    db
      .select({ versionId: hiringStages.versionId, count: sql<number>`count(*)::int` })
      .from(hiringStages)
      .where(inArray(hiringStages.versionId, [...new Set(rows.map((r) => r.versionId))]))
      .groupBy(hiringStages.versionId),
    db
      .select({ id: deletionRequests.id, candidateId: deletionRequests.candidateId, kind: deletionRequests.kind, message: deletionRequests.message, createdAt: deletionRequests.createdAt })
      .from(deletionRequests)
      .where(and(inArray(deletionRequests.candidateId, rows.map((r) => r.candidateId)), isNull(deletionRequests.handledAt)))
      .orderBy(asc(deletionRequests.createdAt)),
  ]);
  const attemptIds = attemptRows.map((a) => a.id);
  const runs = attemptIds.length
    ? await db
        .select({ attemptId: hiringStageRuns.attemptId, startedAt: hiringStageRuns.startedAt, submittedAt: hiringStageRuns.submittedAt, lastHeartbeatAt: hiringStageRuns.lastHeartbeatAt })
        .from(hiringStageRuns)
        .where(inArray(hiringStageRuns.attemptId, attemptIds))
    : [];
  const mask = viewer.blindMode && !viewer.runs;
  return rows.map((r, i) => {
    const link = links.find((l) => l.assessmentId === r.assessmentId) ?? null;
    const attempt = attemptRows.find((a) => a.assessmentId === r.assessmentId) ?? null;
    const own = attempt ? runs.filter((run) => run.attemptId === attempt.id) : [];
    return {
      assessmentId: r.assessmentId,
      candidateId: r.candidateId,
      seq: i + 1,
      name: mask ? null : r.name,
      email: mask ? null : r.email,
      locale: r.locale,
      invitedAt: r.invitedAt,
      link: link ? { id: link.id, status: link.status, expiresAt: link.expiresAt } : null,
      progress: candidateProgress({
        linkStatus: link?.status ?? "EXPIRED",
        linkExpiresAt: link?.expiresAt ?? new Date(0),
        firstSeen: !!link?.firstSeenIp,
        started: !!attempt?.startedAt,
        completed: !!attempt?.completedAt,
        now,
      }),
      stagesDone: own.filter((run) => run.submittedAt).length,
      stageCount: counts.find((c) => c.versionId === r.versionId)?.count ?? 0,
      lastActivityAt: latest(...own.flatMap((run) => [run.startedAt, run.submittedAt, run.lastHeartbeatAt])),
      completedAt: attempt?.completedAt ?? null,
      adapted: viewer.runs && r.extraTimePct > 0,
      requests: viewer.runs ? requests.filter((q) => q.candidateId === r.candidateId).map((q) => ({ id: q.id, kind: q.kind, message: q.message, createdAt: q.createdAt })) : [],
    };
  });
}

/** "Tamam" on a candidate's request: only a request of a person invited to this opening of this organisation. */
export async function markRequestHandled(user: { id: string; orgId: string }, openingId: string, requestId: string): Promise<boolean> {
  if (!isUuid(openingId) || !isUuid(requestId)) return false;
  const [found] = await db
    .select({ id: deletionRequests.id })
    .from(deletionRequests)
    .innerJoin(assessments, eq(assessments.candidateId, deletionRequests.candidateId))
    .innerJoin(hiringAssessments, eq(hiringAssessments.assessmentId, assessments.id))
    .where(and(eq(deletionRequests.id, requestId), eq(hiringAssessments.orgId, user.orgId), eq(hiringAssessments.openingId, openingId), isNull(deletionRequests.handledAt)))
    .limit(1);
  if (!found) return false;
  const done = await db
    .update(deletionRequests)
    .set({ handledBy: user.id, handledAt: new Date() })
    .where(and(eq(deletionRequests.id, found.id), isNull(deletionRequests.handledAt)))
    .returning({ id: deletionRequests.id });
  return done.length > 0;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type OpeningFunnel = {
  invited: number;
  started: number;
  completed: number;
  medianMinutes: number | null;
  estimateMinutes: number | null;
  survey: { count: number; average: number | null; latest: Array<{ rating: number; comment: string; at: Date }> };
};

export { SURVEY_MIN_ANSWERS };

/** HIRING-UX 5.4 in plan 2: Davet, Başladı, Tamamladı; median time against the live version's estimate; the survey. */
export async function openingFunnel(orgId: string, openingId: string): Promise<OpeningFunnel> {
  const empty: OpeningFunnel = { invited: 0, started: 0, completed: 0, medianMinutes: null, estimateMinutes: null, survey: { count: 0, average: null, latest: [] } };
  if (!isUuid(openingId)) return empty;
  const invited = await db
    .select({ assessmentId: hiringAssessments.assessmentId, versionId: hiringAssessments.versionId })
    .from(hiringAssessments)
    .innerJoin(assessments, eq(assessments.id, hiringAssessments.assessmentId))
    .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
    .where(and(eq(hiringAssessments.orgId, orgId), eq(hiringAssessments.openingId, openingId)));
  if (invited.length === 0) return empty;
  const ids = invited.map((r) => r.assessmentId);
  const [attemptRows, survey] = await Promise.all([
    db.select({ startedAt: attempts.startedAt, completedAt: attempts.completedAt }).from(attempts).where(and(inArray(attempts.assessmentId, ids), isNotNull(attempts.startedAt))),
    db
      .select({ rating: hiringSurveyResponses.rating, comment: hiringSurveyResponses.comment, at: hiringSurveyResponses.createdAt })
      .from(hiringSurveyResponses)
      .where(inArray(hiringSurveyResponses.assessmentId, ids))
      .orderBy(desc(hiringSurveyResponses.createdAt)),
  ]);
  const { live } = workingVersions(await versionsOf(orgId, openingId));
  const [length] = live
    ? await db.select({ total: sql<number>`coalesce(sum(${hiringStages.durationSeconds}), 0)::int` }).from(hiringStages).where(eq(hiringStages.versionId, live.id))
    : [];
  const done = attemptRows.filter((a) => a.completedAt && a.startedAt);
  const enough = survey.length >= SURVEY_MIN_ANSWERS;
  const minutes = median(done.map((a) => (a.completedAt!.getTime() - a.startedAt!.getTime()) / 60_000));
  return {
    invited: invited.length,
    started: attemptRows.length,
    completed: done.length,
    medianMinutes: minutes === null ? null : Math.round(minutes),
    estimateMinutes: length ? Math.ceil(Number(length.total) / 60) : null,
    survey: {
      count: survey.length,
      average: enough ? Math.round((survey.reduce((s, r) => s + r.rating, 0) / survey.length) * 10) / 10 : null,
      latest: enough ? survey.filter((r) => r.comment && r.comment.trim()).slice(0, 3).map((r) => ({ rating: r.rating, comment: r.comment!.trim(), at: r.at })) : [],
    },
  };
}
```

- [ ] **Step 6: Run them to verify they pass**

Run: `pnpm exec vitest run src/solutions/hiring/server/consent.test.ts src/solutions/hiring/server/invitations.test.ts src/solutions/hiring/server`
Expected: PASS (every earlier hiring server test still passes with the extended fake).

- [ ] **Step 7: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
git add src/solutions/hiring/consent-default.ts src/solutions/hiring/server/consent.ts src/solutions/hiring/server/consent.test.ts src/solutions/hiring/server/invitations.ts src/solutions/hiring/server/invitations.test.ts src/solutions/hiring/server/test-fake-db.ts
git commit -m "Invite hiring candidates on the server

An invitation freezes the opening's live version, the organisation's
hiring consent text (created from a built-in text on first need) and
proctoring OFF, copies the active panel as assignments, mints one link,
and writes the ready message and an audit row. A new link replaces the
old one; the opening sees its candidates, their requests and its funnel.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The candidate flow on the server (state, clocks, answers, media, survey, cron)

**Files:**
- Create: `src/solutions/hiring/server/candidate.ts`
- Modify: `src/lib/close-expired.ts` (the exam's salvage takes only exam uploads)
- Test: `src/solutions/hiring/server/candidate.test.ts`, `src/lib/close-expired.test.ts` (new)

**Interfaces:**
- Consumes: Tasks 1, 4, 5; `loadVersionContent` (`./content`); `currentAttempt`, `hasConsented`, `CandidateContext` (`@/lib/candidate-context`); `failMedia`, `normaliseFileMime`, `normaliseMime`, `resolveOwnedMedia` (`@/lib/candidate-media`); `getStorage`, `mediaKey` (`@/lib/storage`); `submitDecision`, `SUBMIT_SLACK_MS` (`@/lib/timer`); `decideSalvage`, `SALVAGE_MIN_AGE_MS` (`@/lib/stage-timeout`); `enqueueTranscription` (`@/lib/queue`); `isTranscribableMime` (`@/lib/transcription`); `MediaAssetRow` (`@/solutions/types`).
- Produces (all from `src/solutions/hiring/server/candidate.ts`):
  - `type HiringContext = CandidateContext & { hiring: { openingId: string; versionId: string; extraTimePct: ExtraTimePct; consentTextId: string } }`; `loadHiringContext(ctx: CandidateContext): Promise<HiringContext | null>`; `hiringServes(ctx: CandidateContext): Promise<boolean>`.
  - `loadHiringState(h: HiringContext, now?: Date): Promise<HiringCandidateState>` (closes runs the clock ended and finishes a complete attempt first).
  - `type StartRefusal = "NO_STAGE" | "NOT_READY" | "STAGE_MISMATCH" | "OPENING_CLOSED"`; `startStage(h, position: unknown, now?: Date): Promise<{ ok: true } | { ok: false; code: StartRefusal }>`.
  - `saveResponse(h, input: { position: unknown; activityId: unknown; answer: unknown }, now?: Date): Promise<{ ok: true; at: string } | { ok: false; code: WriteRefusal }>`.
  - `commitResponse(h, input: { position: unknown; activityId: unknown; answer?: unknown }, now?: Date): Promise<{ ok: true } | { ok: false; code: WriteRefusal | "REQUIRED_MISSING" }>`.
  - `type SubmitRefusal = "NO_STAGE" | "STAGE_MISMATCH" | "STAGE_NOT_STARTED" | "REQUIRED_MISSING"`; `submitStage(h, position: unknown, now?: Date): Promise<{ ok: true } | { ok: false; code: SubmitRefusal; missing?: string[] }>`.
  - `setExtraTime(h, pct: unknown, now?: Date): Promise<{ ok: true } | { ok: false; code: "EXTRA_TIME_INVALID" | "EXTRA_TIME_LOCKED" | "ALREADY_COMPLETED" }>`.
  - `stageHeartbeat(h, now?: Date): Promise<{ deadlineAt: Date | null }>`; `runningSegment(attemptId: string): Promise<{ kind: string; runId: string } | null>`.
  - `type MediaRefusal = WriteRefusal | "NOT_A_RECORDING" | "NOT_A_FILE" | "TAKES_EXHAUSTED" | "FILE_TYPE_REJECTED" | "FILE_TOO_LARGE" | "FILE_EMPTY"`; `type UploadOpened = { uploadRef: string; mime: string; minPartBytes: number; proxy: boolean; partTargets: Array<{ partNumber: number; url: string; proxy: boolean }> }`; `openUpload(h, input: { position: unknown; activityId: unknown; kind: unknown; mime: unknown; name?: unknown; bytes?: unknown }, now?: Date): Promise<{ ok: true; upload: UploadOpened } | { ok: false; code: MediaRefusal }>`.
  - `attachMedia(asset: MediaAssetRow): Promise<void>` (the module's `onMediaComplete`).
  - `playbackUrl(h, ref: unknown): Promise<string | null>`.
  - `saveSurvey(h, input: { rating: unknown; comment: unknown }): Promise<{ ok: true } | { ok: false; code: "NOT_FINISHED" | "SURVEY_OFF" | "SURVEY_INVALID" | "ALREADY_ANSWERED" }>`.
  - `hiringTitle(h): Promise<string>`.
  - `closeExpiredStageRuns(now?: Date, limit?: number): Promise<{ scanned: number; closed: number }>`; `salvageHiringUploads(now?: Date, limit?: number): Promise<{ scanned: number; salvaged: number; failed: number; skipped: number }>`.

- [ ] **Step 1: Write the failing tests**

`src/lib/close-expired.test.ts` (new):

```ts
import { describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({ wheres: [] as string[] }));

vi.mock("@/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const { SQL } = await import("drizzle-orm");
  const dialect = new PgDialect();
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "from", "leftJoin", "innerJoin", "orderBy", "limit"]) chain[name] = () => chain;
  chain.where = (condition: unknown) => {
    if (condition instanceof SQL) seen.wheres.push(dialect.sqlToQuery(condition).sql);
    return chain;
  };
  chain.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve([]).then(resolve);
  return { db: chain };
});
vi.mock("@/lib/storage", () => ({ getStorage: () => ({}) }));

import { salvageAbandonedUploads } from "./close-expired";

describe("the exam's upload salvage", () => {
  it("takes only uploads that belong to an exam section; other solutions salvage their own", async () => {
    await salvageAbandonedUploads(new Date("2026-10-05T09:00:00Z"), 5);
    expect(seen.wheres[0]).toContain('"media_assets"."section_run_id" is not null');
  });
});
```

`src/solutions/hiring/server/candidate.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, writesOf, type Op } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));
vi.mock("@/lib/queue", () => ({ enqueueTranscription: vi.fn(async () => true) }));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    minPartBytes: 0,
    initUpload: async () => ({ uploadId: "up-1" }),
    signPartUrls: async (_key: string, _id: string, numbers: number[]) => numbers.map((n) => ({ partNumber: n, url: `/p/${n}`, proxy: true })),
  }),
  mediaKey: (i: { orgId: string; assessmentId: string; stageRunId: string; mediaId: string }) => `media/${i.orgId}/${i.assessmentId}/${i.stageRunId}/${i.mediaId}.webm`,
}));

import type { CandidateContext } from "@/lib/candidate-context";
import { attachMedia, closeExpiredStageRuns, loadHiringContext, openUpload, saveResponse, setExtraTime, startStage, submitStage, type HiringContext } from "./candidate";

const ORG = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT = "22222222-2222-4222-8222-222222222222";
const VERSION = "33333333-3333-4333-8333-333333333333";
const ATTEMPT = "44444444-4444-4444-8444-444444444444";
const RUN = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2026-10-05T09:00:00.000Z");

const ctx = (solution: "HIRING" | "LANGUAGE_EXAM" = "HIRING"): CandidateContext => ({
  link: { id: "link-1", status: "NOT_STARTED", expiresAt: new Date("2026-10-19T00:00:00Z"), notBefore: null, firstSeenIp: null },
  assessment: { id: ASSESSMENT, orgId: ORG, solution },
  candidate: { id: "c-1", fullName: "Elif Kaya", email: "elif@example.com", phone: null, location: null },
  orgName: "Örnek A.Ş.",
  locale: "tr",
  contactEmail: null,
  contactName: null,
  mediaRetentionDays: 180,
  evidenceRetentionDays: 90,
});
const h = (): HiringContext => ({ ...ctx(), hiring: { openingId: "op-1", versionId: VERSION, extraTimePct: 0, consentTextId: "ct-1" } });

type World = {
  stages: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
  attempt: Record<string, unknown>;
  runs: Array<Record<string, unknown>>;
  responses: Array<Record<string, unknown>>;
  media: Array<Record<string, unknown>>;
  consented: boolean;
  pct: number;
};
let world: World;

const stageRow = (id: string, orderIndex: number, over: Record<string, unknown> = {}) => ({
  id, versionId: VERSION, orderIndex, name: { tr: `Aşama ${orderIndex + 1}`, en: "" }, description: { tr: "", en: "" }, internalPurpose: null,
  durationSeconds: 600, graceSeconds: 0, onTimeout: "AUTO_SUBMIT", backNavigation: false, ...over,
});
const activityRow = (id: string, stageId: string, orderIndex: number, over: Record<string, unknown> = {}) => ({
  id, stageId, orderIndex, type: "LONG_TEXT", required: true, prompt: { tr: "Anlat.", en: "" }, note: { tr: "", en: "" }, internalQuestion: null,
  expectedBehaviours: [], redFlags: [], managerNotes: null, answerExamples: {}, thinkSeconds: 0, flexibleThink: true, answerSeconds: null, maxTakes: 1, config: {}, ...over,
});

function respond(op: Op): unknown[] {
  if (op.kind === "select") {
    switch (op.table) {
      case "hiring_assessments":
        // One row serves both reads: the context (openingId, versionId, extraTimePct, consentTextId) and the start's `pct`.
        return [{ assessmentId: ASSESSMENT, openingId: "op-1", versionId: VERSION, extraTimePct: world.pct, consentTextId: "ct-1", pct: world.pct }];
      case "hiring_versions":
        return [{ id: VERSION, versionNumber: 1, status: "PUBLISHED", defaultLocale: "tr", localeSet: ["tr"], weightsEnabled: false, draftWeights: null, previewedAt: null }];
      case "hiring_stages":
        return world.stages;
      case "hiring_activities":
        return world.activities;
      case "hiring_activity_competencies":
        return [];
      case "attempts":
        return [world.attempt];
      case "hiring_stage_runs":
        return world.runs;
      case "hiring_responses":
        return world.responses;
      case "media_assets":
        return world.media;
      case "consents":
        return world.consented ? [{ id: "consent-1" }] : [];
      case "hiring_openings":
        return [{ status: "OPEN" }];
    }
    return [];
  }
  if (op.kind === "insert" && op.table === "hiring_stage_runs") return [{ id: RUN }];
  if (op.kind === "insert" && op.table === "media_assets") return [{ id: "m-new", mime: "video/webm", attemptId: ATTEMPT }];
  if (op.kind === "update" && op.table === "hiring_stage_runs") return [{ id: RUN }];
  return [];
}

beforeEach(() => {
  fake.ops = [];
  fake.respond = respond;
  world = {
    stages: [stageRow("s1", 0), stageRow("s2", 1)],
    activities: [activityRow("a1", "s1", 0), activityRow("a2", "s1", 1, { required: false }), activityRow("b1", "s2", 0)],
    attempt: { id: ATTEMPT, assessmentId: ASSESSMENT, attemptNumber: 1, startedAt: null, completedAt: null, terminatedAt: null, deviceCheckedAt: null },
    runs: [],
    responses: [],
    media: [],
    consented: true,
    pct: 25,
  };
});

describe("loadHiringContext", () => {
  it("never reads anything for another solution's invitation", async () => {
    expect(await loadHiringContext(ctx("LANGUAGE_EXAM"))).toBeNull();
    expect(fake.ops).toEqual([]);
  });

  it("reads the invitation's own hiring terms by its id and organisation", async () => {
    const found = await loadHiringContext(ctx());
    expect(found?.hiring).toEqual({ openingId: "op-1", versionId: VERSION, extraTimePct: 25, consentTextId: "ct-1" });
    expect(fake.ops[0].where).toContain('"hiring_assessments"."org_id" = $');
    expect(fake.ops[0].params).toEqual(expect.arrayContaining([ASSESSMENT, ORG]));
  });

  it("answers null when the invitation has no hiring row", async () => {
    fake.respond = () => [];
    expect(await loadHiringContext(ctx())).toBeNull();
  });
});

describe("startStage", () => {
  it("writes the deadline once, from now plus the chosen extra time, under the attempt's lock", async () => {
    const result = await startStage(h(), 1, NOW);
    expect(result).toEqual({ ok: true });
    expect(fake.ops.find((o) => o.table === "attempts" && o.lock === "update")).toBeTruthy();
    const run = writesOf(fake.ops).find((w) => w.kind === "insert" && w.table === "hiring_stage_runs")!;
    expect(run.values).toEqual({ attemptId: ATTEMPT, stageId: "s1", orderIndex: 0, startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 750_000) });
    const responses = writesOf(fake.ops).find((w) => w.kind === "insert" && w.table === "hiring_responses")!;
    expect(responses.values).toEqual([
      { stageRunId: RUN, activityId: "a1" },
      { stageRunId: RUN, activityId: "a2" },
    ]);
    const link = writesOf(fake.ops).find((w) => w.table === "assessment_links")!;
    expect(link.values).toEqual({ status: "IN_PROGRESS" });
  });

  it("is idempotent: a started stage is left exactly as it is", async () => {
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
    expect(await startStage(h(), 1, new Date(NOW.getTime() + 60_000))).toEqual({ ok: true });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("refuses another stage's number and a candidate who skipped the steps before", async () => {
    expect(await startStage(h(), 2, NOW)).toEqual({ ok: false, code: "STAGE_MISMATCH" });
    world.consented = false;
    expect(await startStage(h(), 1, NOW)).toEqual({ ok: false, code: "NOT_READY" });
    expect(writesOf(fake.ops)).toEqual([]);
  });
});

describe("saveResponse", () => {
  it("keeps what the server attached and writes only an open question when there is no way back", async () => {
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
    world.responses = [
      { id: "r1", stageRunId: RUN, activityId: "a1", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
      { id: "r2", stageRunId: RUN, activityId: "a2", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
    ];
    const result = await saveResponse(h(), { position: 1, activityId: "a1", answer: { text: "Merhaba", choiceIds: ["x"] } }, NOW);
    expect(result).toEqual({ ok: true, at: NOW.toISOString() });
    const write = writesOf(fake.ops).find((w) => w.table === "hiring_responses")!;
    expect(write.values).toMatchObject({ payload: { text: "Merhaba" }, usedTextAlternative: false });
    expect(write.where).toContain('"hiring_responses"."answered_at" is null');
  });

  it("refuses the second question while the first is open", async () => {
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
    world.responses = [
      { id: "r1", stageRunId: RUN, activityId: "a1", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
      { id: "r2", stageRunId: RUN, activityId: "a2", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
    ];
    expect(await saveResponse(h(), { position: 1, activityId: "a2", answer: { text: "x" } }, NOW)).toEqual({ ok: false, code: "ACTIVITY_ORDER" });
  });
});

describe("submitStage", () => {
  const running = () => {
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
    world.responses = [
      { id: "r1", stageRunId: RUN, activityId: "a1", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
      { id: "r2", stageRunId: RUN, activityId: "a2", payload: { text: "isteğe bağlı" }, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
    ];
  };

  it("refuses while a required answer is missing and time is left, naming it", async () => {
    running();
    expect(await submitStage(h(), 1, new Date(NOW.getTime() + 60_000))).toEqual({ ok: false, code: "REQUIRED_MISSING", missing: ["a1"] });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("closes the stage once its time is over, keeping what was written", async () => {
    running();
    expect(await submitStage(h(), 1, new Date(NOW.getTime() + 601_000))).toEqual({ ok: true });
    const closes = writesOf(fake.ops).filter((w) => w.table === "hiring_stage_runs");
    expect(closes[0].values).toEqual({ submittedAt: new Date(NOW.getTime() + 601_000) });
    expect(closes[1].values).toEqual({ completion: "PARTIAL", wasLate: true });
  });
});

describe("setExtraTime", () => {
  it("refuses a value outside 0, 25 and 50 and a change while a stage runs", async () => {
    expect(await setExtraTime(h(), 30, NOW)).toEqual({ ok: false, code: "EXTRA_TIME_INVALID" });
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: NOW, submittedAt: null }];
    expect(await setExtraTime(h(), 50, NOW)).toEqual({ ok: false, code: "EXTRA_TIME_LOCKED" });
  });

  it("stores the choice for the stages that start afterwards", async () => {
    const hh = h();
    expect(await setExtraTime(hh, 50, NOW)).toEqual({ ok: true });
    expect(writesOf(fake.ops).find((w) => w.table === "hiring_assessments")?.values).toEqual({ extraTimePct: 50, extraTimeChosenAt: NOW });
    expect(hh.hiring.extraTimePct).toBe(50);
  });
});

describe("openUpload", () => {
  const recorded = () => {
    world.activities = [activityRow("v1", "s1", 0, { type: "VIDEO", maxTakes: 2 })];
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
  };

  it("counts takes on the server and gives a failed one back", async () => {
    recorded();
    world.responses = [{ id: "r1", stageRunId: RUN, activityId: "v1", payload: {}, takeAssetIds: ["m1", "m2"], fileAssetIds: [], answeredAt: null }];
    world.media = [{ id: "m1", status: "READY", durationMs: 1 }, { id: "m2", status: "FAILED", durationMs: null }];
    const opened = await openUpload(h(), { position: 1, activityId: "v1", kind: "recording", mime: "video/webm" }, NOW);
    expect(opened.ok).toBe(true);
    const take = writesOf(fake.ops).find((w) => w.table === "hiring_responses")!;
    expect(take.values).toMatchObject({ takeAssetIds: ["m1", "m2", "m-new"], takesUsed: 2 });
    if (opened.ok) expect(opened.upload).toMatchObject({ uploadRef: "m-new", minPartBytes: 0, proxy: true });
  });

  it("refuses a take beyond the question's limit", async () => {
    recorded();
    world.responses = [{ id: "r1", stageRunId: RUN, activityId: "v1", payload: {}, takeAssetIds: ["m1", "m2"], fileAssetIds: [], answeredAt: null }];
    world.media = [{ id: "m1", status: "READY", durationMs: 1 }, { id: "m2", status: "UPLOADING", durationMs: null }];
    expect(await openUpload(h(), { position: 1, activityId: "v1", kind: "recording", mime: "video/webm" }, NOW)).toEqual({ ok: false, code: "TAKES_EXHAUSTED" });
  });

  it("refuses a file type the question does not take and a file over its size", async () => {
    world.activities = [activityRow("f1", "s1", 0, { type: "FILE_UPLOAD", config: { acceptedMimeTypes: ["application/pdf"], maxFileBytes: 1000 } })];
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
    world.responses = [{ id: "r1", stageRunId: RUN, activityId: "f1", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null }];
    expect(await openUpload(h(), { position: 1, activityId: "f1", kind: "file", mime: "image/png", name: "a.png", bytes: 10 }, NOW)).toEqual({ ok: false, code: "FILE_TYPE_REJECTED" });
    expect(await openUpload(h(), { position: 1, activityId: "f1", kind: "file", mime: "application/pdf", name: "a.pdf", bytes: 1001 }, NOW)).toEqual({ ok: false, code: "FILE_TOO_LARGE" });
    expect(writesOf(fake.ops)).toEqual([]);
  });
});

describe("attachMedia", () => {
  const asset = (id: string, over: Record<string, unknown> = {}) => ({ id, attemptId: ATTEMPT, status: "READY", mime: "video/webm", bytes: 100, ...over }) as never;

  it("makes the newest take the answer, superseding a written alternative", async () => {
    fake.respond = (op) =>
      op.kind === "select" ? [{ response: { id: "r1", takeAssetIds: ["m1", "m2"], payload: { usedTextAlternative: true, text: "yazdım" } }, activity: { type: "VIDEO", config: {} } }] : [];
    await attachMedia(asset("m2"));
    expect(writesOf(fake.ops)[0].values).toMatchObject({ mediaAssetId: "m2", usedTextAlternative: false, payload: { text: "yazdım" } });
  });

  it("ignores an older take that finishes late", async () => {
    fake.respond = (op) => (op.kind === "select" ? [{ response: { id: "r1", takeAssetIds: ["m1", "m2"], payload: {} }, activity: { type: "VIDEO", config: {} } }] : []);
    await attachMedia(asset("m1"));
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("attaches a finished file under the name the candidate gave it, and refuses one bigger than allowed", async () => {
    const row = (max: number) => [{ response: { id: "r1", takeAssetIds: [], payload: { pendingFile: { assetId: "f1", name: "Özgeçmiş.pdf", bytes: 100, mime: "application/pdf" } } }, activity: { type: "FILE_UPLOAD", config: { maxFileBytes: max } } }];
    fake.respond = (op) => (op.kind === "select" ? row(1000) : []);
    await attachMedia(asset("f1", { mime: "application/pdf" }));
    expect(writesOf(fake.ops)[0].values).toEqual({ fileAssetIds: ["f1"], payload: { file: { name: "Özgeçmiş.pdf", bytes: 100, mime: "application/pdf" } }, updatedAt: expect.any(Date) });
    fake.ops = [];
    fake.respond = (op) => (op.kind === "select" ? row(50) : []);
    await attachMedia(asset("f1", { mime: "application/pdf" }));
    expect(writesOf(fake.ops)[0].values).toEqual({ payload: {}, updatedAt: expect.any(Date) });
  });
});

describe("closeExpiredStageRuns", () => {
  it("looks only at runs past their deadline plus the slack, never ALLOW_LATE", async () => {
    fake.respond = () => [];
    await closeExpiredStageRuns(NOW, 10);
    const query = fake.ops[0];
    expect(query.table).toBe("hiring_stage_runs");
    expect(query.where).toContain('"hiring_stage_runs"."submitted_at" is null');
    expect(query.where).toContain('"hiring_stages"."on_timeout" <> $');
    expect(query.params).toContain("ALLOW_LATE");
    // Drizzle sends timestamps as ISO strings.
    expect(query.params).toContain(new Date(NOW.getTime() - 5_000).toISOString());
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/lib/close-expired.test.ts src/solutions/hiring/server/candidate.test.ts`
Expected: FAIL (`section_run_id is not null` missing; `./candidate` unresolved).

- [ ] **Step 3: The exam's salvage takes only exam uploads**

In `src/lib/close-expired.ts`, inside `salvageAbandonedUploads`, add `isNotNull(mediaAssets.sectionRunId),` as the first condition of the `and(...)` in the `.where(...)`, with this comment above the `and(`:
```ts
      // Only the exam's own uploads (they carry their section run). Every
      // other solution salvages its uploads itself (attempts.closeExpired) and
      // attaches them to its own answers.
```

- [ ] **Step 4: Write `src/solutions/hiring/server/candidate.ts`**

```ts
import { and, asc, desc, eq, inArray, isNotNull, isNull, like, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import {
  assessmentLinks,
  assessments,
  attempts,
  candidates,
  hiringActivities,
  hiringAssessments,
  hiringAssignments,
  hiringOpenings,
  hiringResponses,
  hiringStageRuns,
  hiringStages,
  hiringSurveyResponses,
  hiringVersions,
  mediaAssets,
  organizations,
  positions,
  type HiringResponsePayload,
} from "@/db/schema";
import { currentAttempt, hasConsented, type CandidateContext } from "@/lib/candidate-context";
import { failMedia, normaliseFileMime, normaliseMime, resolveOwnedMedia } from "@/lib/candidate-media";
import { enqueueTranscription } from "@/lib/queue";
import { decideSalvage, SALVAGE_MIN_AGE_MS } from "@/lib/stage-timeout";
import { getStorage, mediaKey } from "@/lib/storage";
import { submitDecision, SUBMIT_SLACK_MS } from "@/lib/timer";
import { isTranscribableMime } from "@/lib/transcription";
import type { MediaAssetRow } from "@/solutions/types";
import {
  autoScore,
  cleanFileName,
  DEFAULT_MAX_FILE_BYTES,
  extraTimeRefusal,
  isExtraTimePct,
  isOverdue,
  missingRequired,
  responseAnswered,
  runCompletion,
  sanitizeResponse,
  stageDeadline,
  writeRefusal,
  type ExtraTimePct,
  type WriteRefusal,
} from "../rules/candidate-flow";
import { buildCandidateState, type HiringCandidateState } from "../rules/candidate-state";
import { toCandidateVersion } from "../rules/candidate-view";
import { isChoice, isRecorded, orderedActivities, orderedStages, type ContentActivity, type ContentStage, type VersionContent } from "../rules/content";
import { devicesNeeded } from "../rules/disclosure";
import { loadVersionContent } from "./content";

/**
 * The hiring candidate flow on the server (hiring solution design 2.4, 7).
 *
 * The rules this file keeps:
 *  - The token's invitation is the only credential; every id is derived from
 *    it, and every read is scoped to that invitation and its organisation.
 *  - The server owns the clock: a stage's deadline is written once, at start,
 *    under the attempt's row lock; a reload reads it back.
 *  - The server owns the order: a write names its stage and question and is
 *    refused rather than guessed (rules/candidate-flow writeRefusal).
 *  - Nothing the candidate receives is built from anything but
 *    toCandidateVersion and the candidate's own rows (rules/candidate-state).
 *  - Answers are never lost: the clock closes a stage with what was written,
 *    a late recording still attaches, an abandoned upload is salvaged.
 */

export type HiringContext = CandidateContext & {
  hiring: { openingId: string; versionId: string; extraTimePct: ExtraTimePct; consentTextId: string };
};

type RunRow = typeof hiringStageRuns.$inferSelect;
type ResponseRow = typeof hiringResponses.$inferSelect;
type Flow = { content: VersionContent; stages: ContentStage[]; attempt: typeof attempts.$inferSelect; runs: RunRow[] };

/** The invitation's own hiring terms, or null (not a hiring invitation, or none of its own). */
export async function loadHiringContext(ctx: CandidateContext): Promise<HiringContext | null> {
  if (ctx.assessment.solution !== "HIRING") return null;
  const [row] = await db
    .select({
      openingId: hiringAssessments.openingId,
      versionId: hiringAssessments.versionId,
      extraTimePct: hiringAssessments.extraTimePct,
      consentTextId: hiringAssessments.consentTextId,
    })
    .from(hiringAssessments)
    .where(and(eq(hiringAssessments.assessmentId, ctx.assessment.id), eq(hiringAssessments.orgId, ctx.assessment.orgId)))
    .limit(1);
  if (!row) return null;
  return {
    ...ctx,
    hiring: {
      openingId: row.openingId,
      versionId: row.versionId,
      extraTimePct: isExtraTimePct(row.extraTimePct) ? row.extraTimePct : 0,
      consentTextId: row.consentTextId,
    },
  };
}

/** The contract's `serves`: a HIRING invitation without its own row is answered like an unknown token. */
export async function hiringServes(ctx: CandidateContext): Promise<boolean> {
  return (await loadHiringContext(ctx)) !== null;
}

async function loadFlow(h: HiringContext, x: Executor = db): Promise<Flow> {
  const content = await loadVersionContent(h.assessment.orgId, h.hiring.versionId, x);
  if (!content) throw new Error(`hiring version ${h.hiring.versionId} of invitation ${h.assessment.id} is missing`);
  const { attempt } = await currentAttempt(h.assessment);
  const runs = await x.select().from(hiringStageRuns).where(eq(hiringStageRuns.attemptId, attempt.id));
  return { content, stages: orderedStages(content), attempt, runs };
}

/** The first stage this attempt has not submitted, with its run if it has one. */
function currentOf(flow: Pick<Flow, "stages" | "runs">): { index: number; stage: ContentStage; run: RunRow | null } | null {
  for (let index = 0; index < flow.stages.length; index += 1) {
    const stage = flow.stages[index];
    const run = flow.runs.find((r) => r.stageId === stage.id) ?? null;
    if (!run?.submittedAt) return { index, stage, run };
  }
  return null;
}

async function lockAttempt(x: Executor, attemptId: string) {
  await x.select({ id: attempts.id }).from(attempts).where(eq(attempts.id, attemptId)).for("update");
}

/** Takes per response: how many are usable (not FAILED) and the newest usable one. */
async function takeInfo(x: Executor, rows: ResponseRow[]) {
  const ids = rows.flatMap((r) => r.takeAssetIds);
  const media = ids.length
    ? await x.select({ id: mediaAssets.id, status: mediaAssets.status, durationMs: mediaAssets.durationMs }).from(mediaAssets).where(inArray(mediaAssets.id, ids))
    : [];
  const byId = new Map(media.map((m) => [m.id, m]));
  return (row: ResponseRow) => {
    const usable = row.takeAssetIds.map((id) => byId.get(id)).filter((m) => m && m.status !== "FAILED");
    const newest = [...row.takeAssetIds].reverse().map((id) => byId.get(id)).find((m) => m && m.status !== "FAILED") ?? null;
    return { usable: usable.length, newest };
  };
}

/** The server's own check that consent, details and (when something is recorded) the device check happened. */
async function ready(h: HiringContext, flow: Flow): Promise<boolean> {
  if (!(await hasConsented(h.assessment.id))) return false;
  if (!h.candidate.fullName || !h.candidate.email) return false;
  if (devicesNeeded(toCandidateVersion(flow.content)).microphone && !flow.attempt.deviceCheckedAt) return false;
  return true;
}

/**
 * Closes one run, idempotently (the first claim wins): every question with
 * content counts as closed now, choice questions get their score (0 when
 * unanswered), and the completion follows rules/candidate-flow runCompletion.
 */
async function closeRun(x: Executor, run: RunRow, stage: ContentStage, reason: "SUBMIT" | "CLOCK", late: boolean, now: Date): Promise<boolean> {
  const claimed = await x
    .update(hiringStageRuns)
    .set({ submittedAt: now })
    .where(and(eq(hiringStageRuns.id, run.id), isNull(hiringStageRuns.submittedAt)))
    .returning({ id: hiringStageRuns.id });
  if (claimed.length === 0) return false;
  const rows = await x.select().from(hiringResponses).where(eq(hiringResponses.stageRunId, run.id));
  const takes = await takeInfo(x, rows);
  let requiredCount = 0;
  let answeredRequired = 0;
  let answeredAny = 0;
  for (const activity of orderedActivities(stage)) {
    const row = rows.find((r) => r.activityId === activity.id);
    const answered = row ? responseAnswered(activity, row.payload, takes(row).usable > 0) : false;
    if (activity.required) {
      requiredCount += 1;
      if (answered) answeredRequired += 1;
    }
    if (answered) answeredAny += 1;
    if (!row) continue;
    await x
      .update(hiringResponses)
      .set({
        answeredAt: row.answeredAt ?? (answered ? now : null),
        autoScore: isChoice(activity.type) ? autoScore(activity, answered ? row.payload : {}) : null,
        usedTextAlternative: !!row.payload.usedTextAlternative,
        updatedAt: now,
      })
      .where(eq(hiringResponses.id, row.id));
  }
  const ended = runCompletion({ reason, late, behaviour: stage.onTimeout, requiredCount, answeredRequired, answeredAny });
  await x.update(hiringStageRuns).set({ completion: ended.completion, wasLate: ended.late }).where(eq(hiringStageRuns.id, run.id));
  return true;
}

/** The last stage closes the attempt: attempt completed, link COMPLETED, the person's last contact now. */
async function finishIfDone(x: Executor, attemptId: string, assessmentId: string, candidateId: string, stageIds: string[], now: Date): Promise<boolean> {
  const runs = await x.select({ stageId: hiringStageRuns.stageId, submittedAt: hiringStageRuns.submittedAt }).from(hiringStageRuns).where(eq(hiringStageRuns.attemptId, attemptId));
  if (stageIds.length === 0 || !stageIds.every((id) => runs.some((r) => r.stageId === id && r.submittedAt))) return false;
  await x.update(attempts).set({ completedAt: now }).where(and(eq(attempts.id, attemptId), isNull(attempts.completedAt)));
  await x
    .update(assessmentLinks)
    .set({ status: "COMPLETED" })
    .where(and(eq(assessmentLinks.assessmentId, assessmentId), inArray(assessmentLinks.status, ["NOT_STARTED", "IN_PROGRESS"])));
  // The candidate clock of retention counts from the last contact.
  await x.update(candidates).set({ lastContactAt: now }).where(eq(candidates.id, candidateId));
  return true;
}

export async function loadHiringState(h: HiringContext, now: Date = new Date()): Promise<HiringCandidateState> {
  let flow = await loadFlow(h);
  let changed = false;
  for (const stage of flow.stages) {
    const run = flow.runs.find((r) => r.stageId === stage.id);
    if (run && isOverdue(run, stage.onTimeout, now)) {
      const closed = await db.transaction(async (tx) => {
        await lockAttempt(tx, flow.attempt.id);
        return closeRun(tx, run, stage, "CLOCK", true, now);
      });
      changed = changed || closed;
    }
  }
  if (!flow.attempt.completedAt && (await finishIfDone(db, flow.attempt.id, h.assessment.id, h.candidate.id, flow.stages.map((s) => s.id), now))) changed = true;
  if (changed) flow = await loadFlow(h);

  const [meta] = await db
    .select({
      orgName: organizations.name,
      orgContact: organizations.contactEmail,
      mediaDays: organizations.mediaRetentionDays,
      candidateDays: organizations.candidateRetentionDays,
      openingStatus: hiringOpenings.status,
      openingContact: hiringOpenings.candidateContactEmail,
      finishSurveyEnabled: hiringOpenings.finishSurveyEnabled,
      feedbackDays: hiringOpenings.feedbackDays,
      positionName: positions.name,
      introTitle: hiringVersions.introTitle,
      introBody: hiringVersions.introBody,
      practiceEnabled: hiringVersions.practiceEnabled,
    })
    .from(hiringOpenings)
    .innerJoin(organizations, eq(organizations.id, hiringOpenings.orgId))
    .innerJoin(positions, and(eq(positions.id, hiringOpenings.positionId), eq(positions.orgId, hiringOpenings.orgId)))
    .innerJoin(hiringVersions, and(eq(hiringVersions.id, h.hiring.versionId), eq(hiringVersions.orgId, hiringOpenings.orgId)))
    .where(and(eq(hiringOpenings.id, h.hiring.openingId), eq(hiringOpenings.orgId, h.assessment.orgId)))
    .limit(1);
  if (!meta) throw new Error(`hiring opening ${h.hiring.openingId} of invitation ${h.assessment.id} is missing`);
  const [reviewers] = await db.select({ n: sql<number>`count(*)::int` }).from(hiringAssignments).where(eq(hiringAssignments.assessmentId, h.assessment.id));
  const [survey] = await db.select({ id: hiringSurveyResponses.assessmentId }).from(hiringSurveyResponses).where(eq(hiringSurveyResponses.assessmentId, h.assessment.id)).limit(1);
  const current = currentOf(flow);
  const rows = current?.run ? await db.select().from(hiringResponses).where(eq(hiringResponses.stageRunId, current.run.id)) : [];
  const takes = await takeInfo(db, rows);

  return buildCandidateState({
    now,
    orgName: meta.orgName,
    contactEmail: meta.openingContact ?? meta.orgContact,
    retention: { mediaDays: meta.mediaDays, candidateDays: meta.candidateDays },
    opening: { status: meta.openingStatus, positionName: meta.positionName, finishSurveyEnabled: meta.finishSurveyEnabled, feedbackDays: meta.feedbackDays },
    version: { stages: flow.content.stages, introTitle: meta.introTitle, introBody: meta.introBody, practiceEnabled: meta.practiceEnabled },
    invitation: {
      candidateName: h.candidate.fullName,
      candidateEmail: h.candidate.email,
      extraTimePct: h.hiring.extraTimePct,
      reviewers: Number(reviewers?.n ?? 0),
      consented: await hasConsented(h.assessment.id),
      deviceChecked: !!flow.attempt.deviceCheckedAt,
      started: flow.runs.some((r) => r.startedAt),
      completedAt: flow.attempt.completedAt,
      surveyAnswered: !!survey,
    },
    runs: flow.runs.map((r) => ({ stageId: r.stageId, startedAt: r.startedAt, deadlineAt: r.deadlineAt, submittedAt: r.submittedAt, wasLate: r.wasLate })),
    responses: rows.map((r) => {
      const t = takes(r);
      return {
        stageId: current!.stage.id,
        activityId: r.activityId,
        payload: r.payload,
        takesUsed: t.usable,
        answeredAt: r.answeredAt,
        recording: t.newest ? { ref: t.newest.id, status: t.newest.status, durationMs: t.newest.durationMs } : null,
      };
    }),
  });
}

export type StartRefusal = "NO_STAGE" | "NOT_READY" | "STAGE_MISMATCH" | "OPENING_CLOSED";

/**
 * Starts the current stage's clock: one run with its deadline (extra time read
 * inside the lock), one response row per question (decision 6), the attempt
 * and the link marked as started. Idempotent: a started stage is left as it is.
 */
export async function startStage(h: HiringContext, position: unknown, now: Date = new Date()): Promise<{ ok: true } | { ok: false; code: StartRefusal }> {
  const before = await loadFlow(h);
  return db.transaction(async (tx) => {
    await lockAttempt(tx, before.attempt.id);
    const runs = await tx.select().from(hiringStageRuns).where(eq(hiringStageRuns.attemptId, before.attempt.id));
    const flow: Flow = { ...before, runs };
    const current = currentOf(flow);
    if (!current) return { ok: false as const, code: "NO_STAGE" as const };
    if (position !== current.index + 1) return { ok: false as const, code: "STAGE_MISMATCH" as const };
    if (!(await ready(h, flow))) return { ok: false as const, code: "NOT_READY" as const };
    if (current.run?.startedAt) return { ok: true as const };
    if (!runs.some((r) => r.startedAt)) {
      // Decision 12: a closed opening stops only candidates who have not started.
      const [opening] = await tx
        .select({ status: hiringOpenings.status })
        .from(hiringOpenings)
        .where(and(eq(hiringOpenings.id, h.hiring.openingId), eq(hiringOpenings.orgId, h.assessment.orgId)))
        .limit(1);
      if (opening?.status === "CLOSED") return { ok: false as const, code: "OPENING_CLOSED" as const };
    }
    const [terms] = await tx.select({ pct: hiringAssessments.extraTimePct }).from(hiringAssessments).where(eq(hiringAssessments.assessmentId, h.assessment.id)).limit(1);
    const pct: ExtraTimePct = isExtraTimePct(terms?.pct) ? terms.pct : 0;
    const [run] = await tx
      .insert(hiringStageRuns)
      .values({ attemptId: flow.attempt.id, stageId: current.stage.id, orderIndex: current.index, startedAt: now, deadlineAt: stageDeadline(now, current.stage, pct) })
      .onConflictDoNothing()
      .returning({ id: hiringStageRuns.id });
    const activities = orderedActivities(current.stage);
    if (run && activities.length) {
      await tx
        .insert(hiringResponses)
        .values(activities.map((a) => ({ stageRunId: run.id, activityId: a.id })))
        .onConflictDoNothing();
    }
    await tx.update(attempts).set({ startedAt: now }).where(and(eq(attempts.id, flow.attempt.id), isNull(attempts.startedAt)));
    await tx.update(assessmentLinks).set({ status: "IN_PROGRESS" }).where(and(eq(assessmentLinks.id, h.link.id), eq(assessmentLinks.status, "NOT_STARTED")));
    return { ok: true as const };
  });
}

type Target = { run: RunRow; stage: ContentStage; activity: ContentActivity; response: ResponseRow };

/** The running stage's question this write names, or the refusal (rules/candidate-flow writeRefusal). */
async function writeTarget(h: HiringContext, x: Executor, position: unknown, activityId: unknown, now: Date): Promise<{ ok: true; target: Target } | { ok: false; code: WriteRefusal }> {
  const flow = await loadFlow(h, x);
  const current = currentOf(flow);
  const rows = current?.run ? await x.select().from(hiringResponses).where(eq(hiringResponses.stageRunId, current.run.id)) : [];
  const activities = current ? orderedActivities(current.stage) : [];
  const refusal = writeRefusal({
    current: current
      ? { position: current.index + 1, startedAt: current.run?.startedAt ?? null, deadlineAt: current.run?.deadlineAt ?? null, onTimeout: current.stage.onTimeout, backNavigation: current.stage.backNavigation }
      : null,
    position,
    activityId,
    activities: activities.map((a) => ({ id: a.id, closed: !!rows.find((r) => r.activityId === a.id)?.answeredAt })),
    now,
  });
  if (refusal) return { ok: false, code: refusal };
  const activity = activities.find((a) => a.id === activityId)!;
  const response = rows.find((r) => r.activityId === activity.id);
  if (!current?.run || !response) return { ok: false, code: "ACTIVITY_NOT_FOUND" };
  return { ok: true, target: { run: current.run, stage: current.stage, activity, response } };
}

/** Autosave of one question. Nothing is closed or scored until the candidate moves on. */
export async function saveResponse(
  h: HiringContext,
  input: { position: unknown; activityId: unknown; answer: unknown },
  now: Date = new Date(),
): Promise<{ ok: true; at: string } | { ok: false; code: WriteRefusal }> {
  return db.transaction(async (tx) => {
    const found = await writeTarget(h, tx, input.position, input.activityId, now);
    if (!found.ok) return found;
    const { target } = found;
    // Locked, so an upload attached meanwhile is part of `previous` and kept.
    const [row] = await tx.select().from(hiringResponses).where(eq(hiringResponses.id, target.response.id)).for("update");
    const payload = sanitizeResponse(target.activity, input.answer, row?.payload ?? target.response.payload);
    await tx
      .update(hiringResponses)
      .set({ payload, usedTextAlternative: !!payload.usedTextAlternative, updatedAt: now })
      .where(target.stage.backNavigation ? eq(hiringResponses.id, target.response.id) : and(eq(hiringResponses.id, target.response.id), isNull(hiringResponses.answeredAt)));
    return { ok: true as const, at: now.toISOString() };
  });
}

/** "Sonraki soru": closes the question (with the answer sent along, if any); a required one needs an answer. */
export async function commitResponse(
  h: HiringContext,
  input: { position: unknown; activityId: unknown; answer?: unknown },
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; code: WriteRefusal | "REQUIRED_MISSING" }> {
  return db.transaction(async (tx) => {
    const found = await writeTarget(h, tx, input.position, input.activityId, now);
    if (!found.ok) return found;
    const { target } = found;
    const [row] = await tx.select().from(hiringResponses).where(eq(hiringResponses.id, target.response.id)).for("update");
    const current = row ?? target.response;
    const payload = input.answer === undefined ? current.payload : sanitizeResponse(target.activity, input.answer, current.payload);
    const takes = await takeInfo(tx, [current]);
    const answered = responseAnswered(target.activity, payload, takes(current).usable > 0);
    if (target.activity.required && !answered) return { ok: false as const, code: "REQUIRED_MISSING" as const };
    await tx
      .update(hiringResponses)
      .set({
        payload,
        answeredAt: now,
        autoScore: isChoice(target.activity.type) ? autoScore(target.activity, payload) : null,
        usedTextAlternative: !!payload.usedTextAlternative,
        updatedAt: now,
      })
      .where(eq(hiringResponses.id, current.id));
    return { ok: true as const };
  });
}

export type SubmitRefusal = "NO_STAGE" | "STAGE_MISMATCH" | "STAGE_NOT_STARTED" | "REQUIRED_MISSING";

/**
 * "Aşamayı bitir" and the client's submit at 0:00. Before the deadline every
 * required question needs an answer; after it the stage closes with what it
 * has (lib/timer submitDecision). The last stage finishes the attempt.
 */
export async function submitStage(
  h: HiringContext,
  position: unknown,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; code: SubmitRefusal; missing?: string[] }> {
  const before = await loadFlow(h);
  return db.transaction(async (tx) => {
    await lockAttempt(tx, before.attempt.id);
    const runs = await tx.select().from(hiringStageRuns).where(eq(hiringStageRuns.attemptId, before.attempt.id));
    const flow: Flow = { ...before, runs };
    const current = currentOf(flow);
    if (!current) return { ok: false as const, code: "NO_STAGE" as const };
    if (position !== current.index + 1) return { ok: false as const, code: "STAGE_MISMATCH" as const };
    const run = current.run;
    if (!run?.startedAt) return { ok: false as const, code: "STAGE_NOT_STARTED" as const };
    const rows = await tx.select().from(hiringResponses).where(eq(hiringResponses.stageRunId, run.id));
    const takes = await takeInfo(tx, rows);
    const activities = orderedActivities(current.stage);
    const missing = missingRequired(activities, (id) => {
      const row = rows.find((r) => r.activityId === id);
      const activity = activities.find((a) => a.id === id)!;
      return !!row && responseAnswered(activity, row.payload, takes(row).usable > 0);
    });
    const decision = submitDecision({ deadlineAt: run.deadlineAt, behaviour: current.stage.onTimeout, missingRequired: missing.length, now });
    if (decision.kind === "REJECT_REQUIRED") return { ok: false as const, code: "REQUIRED_MISSING" as const, missing };
    await closeRun(tx, run, current.stage, decision.expired ? "CLOCK" : "SUBMIT", decision.late, now);
    await finishIfDone(tx, flow.attempt.id, h.assessment.id, h.candidate.id, flow.stages.map((s) => s.id), now);
    return { ok: true as const };
  });
}

/** Decision 5: 0, 25 or 50, changeable while no stage runs; stages started afterwards get it. */
export async function setExtraTime(
  h: HiringContext,
  pct: unknown,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; code: "EXTRA_TIME_INVALID" | "EXTRA_TIME_LOCKED" | "ALREADY_COMPLETED" }> {
  if (!isExtraTimePct(pct)) return { ok: false, code: "EXTRA_TIME_INVALID" };
  const before = await loadFlow(h);
  if (before.attempt.completedAt) return { ok: false, code: "ALREADY_COMPLETED" };
  return db.transaction(async (tx) => {
    await lockAttempt(tx, before.attempt.id);
    const runs = await tx.select().from(hiringStageRuns).where(eq(hiringStageRuns.attemptId, before.attempt.id));
    if (extraTimeRefusal(runs)) return { ok: false as const, code: "EXTRA_TIME_LOCKED" as const };
    await tx
      .update(hiringAssessments)
      .set({ extraTimePct: pct, extraTimeChosenAt: now })
      .where(and(eq(hiringAssessments.assessmentId, h.assessment.id), eq(hiringAssessments.orgId, h.assessment.orgId)));
    h.hiring.extraTimePct = pct;
    return { ok: true as const };
  });
}

/** The core heartbeat: marks the running stage alive (salvage waits for a quiet tab) and returns its deadline. */
export async function stageHeartbeat(h: HiringContext, now: Date = new Date()): Promise<{ deadlineAt: Date | null }> {
  const [run] = await db
    .select({ id: hiringStageRuns.id, deadlineAt: hiringStageRuns.deadlineAt })
    .from(hiringStageRuns)
    .innerJoin(attempts, eq(attempts.id, hiringStageRuns.attemptId))
    .where(and(eq(attempts.assessmentId, h.assessment.id), isNotNull(hiringStageRuns.startedAt), isNull(hiringStageRuns.submittedAt)))
    .orderBy(asc(hiringStageRuns.orderIndex))
    .limit(1);
  if (!run) return { deadlineAt: null };
  await db.update(hiringStageRuns).set({ lastHeartbeatAt: now }).where(eq(hiringStageRuns.id, run.id));
  return { deadlineAt: run.deadlineAt };
}

/** The running stage run, named for proctoring records (spec 5: segment_kind 'stage_run'). */
export async function runningSegment(attemptId: string): Promise<{ kind: string; runId: string } | null> {
  const [run] = await db
    .select({ id: hiringStageRuns.id })
    .from(hiringStageRuns)
    .where(and(eq(hiringStageRuns.attemptId, attemptId), isNotNull(hiringStageRuns.startedAt), isNull(hiringStageRuns.submittedAt)))
    .limit(1);
  return run ? { kind: "stage_run", runId: run.id } : null;
}

export type MediaRefusal = WriteRefusal | "NOT_A_RECORDING" | "NOT_A_FILE" | "TAKES_EXHAUSTED" | "FILE_TYPE_REJECTED" | "FILE_TOO_LARGE" | "FILE_EMPTY";
export type UploadOpened = { uploadRef: string; mime: string; minPartBytes: number; proxy: boolean; partTargets: Array<{ partNumber: number; url: string; proxy: boolean }> };

/** Part targets handed out with the upload; more come from the core /media/part-urls. */
const PREFETCH_PARTS = 24;

/**
 * Opens one upload for the running question: a take of a video or audio
 * question (decision 8: counted on the server under the response's lock) or
 * the file of a file question (decision 11). The storage key is derived from
 * ids the server owns. A take whose storage upload cannot open is FAILED and
 * so given back.
 */
export async function openUpload(
  h: HiringContext,
  input: { position: unknown; activityId: unknown; kind: unknown; mime: unknown; name?: unknown; bytes?: unknown },
  now: Date = new Date(),
): Promise<{ ok: true; upload: UploadOpened } | { ok: false; code: MediaRefusal }> {
  const rawMime = typeof input.mime === "string" ? input.mime : undefined;
  const opened = await db.transaction(async (tx) => {
    const found = await writeTarget(h, tx, input.position, input.activityId, now);
    if (!found.ok) return found;
    const { target } = found;
    const [row] = await tx.select().from(hiringResponses).where(eq(hiringResponses.id, target.response.id)).for("update");
    const response = row ?? target.response;
    if (input.kind === "file") {
      if (target.activity.type !== "FILE_UPLOAD") return { ok: false as const, code: "NOT_A_FILE" as const };
      const mime = normaliseFileMime(rawMime, target.activity.config.acceptedMimeTypes);
      if (mime === null) return { ok: false as const, code: "FILE_TYPE_REJECTED" as const };
      const bytes = Number(input.bytes);
      if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false as const, code: "FILE_EMPTY" as const };
      if (bytes > (target.activity.config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES)) return { ok: false as const, code: "FILE_TOO_LARGE" as const };
      const [asset] = await tx
        .insert(mediaAssets)
        .values({ orgId: h.assessment.orgId, attemptId: target.run.attemptId, storageKey: "pending", mime, status: "UPLOADING", parts: [] })
        .returning();
      const payload: HiringResponsePayload = { ...response.payload, pendingFile: { assetId: asset.id, name: cleanFileName(input.name), bytes: Math.round(bytes), mime } };
      await tx.update(hiringResponses).set({ payload, updatedAt: now }).where(eq(hiringResponses.id, response.id));
      return { ok: true as const, asset, runId: target.run.id };
    }
    if (!isRecorded(target.activity.type)) return { ok: false as const, code: "NOT_A_RECORDING" as const };
    const used = (await takeInfo(tx, [response]))(response).usable;
    if (used >= target.activity.maxTakes) return { ok: false as const, code: "TAKES_EXHAUSTED" as const };
    const mime = normaliseMime(rawMime, target.activity.type === "AUDIO" ? "audio/webm" : "video/webm");
    const [asset] = await tx
      .insert(mediaAssets)
      .values({ orgId: h.assessment.orgId, attemptId: target.run.attemptId, storageKey: "pending", mime, status: "UPLOADING", parts: [] })
      .returning();
    await tx
      .update(hiringResponses)
      .set({ takeAssetIds: [...response.takeAssetIds, asset.id], takesUsed: used + 1, updatedAt: now })
      .where(eq(hiringResponses.id, response.id));
    return { ok: true as const, asset, runId: target.run.id };
  });
  if (!opened.ok) return opened;
  try {
    const storage = getStorage();
    const key = mediaKey({ orgId: h.assessment.orgId, assessmentId: h.assessment.id, stageRunId: opened.runId, mediaId: opened.asset.id, mime: opened.asset.mime });
    const { uploadId } = await storage.initUpload(key, opened.asset.mime);
    await db.update(mediaAssets).set({ storageKey: key, uploadId }).where(eq(mediaAssets.id, opened.asset.id));
    const partTargets = await storage.signPartUrls(key, uploadId, Array.from({ length: PREFETCH_PARTS }, (_, i) => i + 1));
    return { ok: true, upload: { uploadRef: opened.asset.id, mime: opened.asset.mime, minPartBytes: storage.minPartBytes, proxy: partTargets[0]?.proxy ?? true, partTargets } };
  } catch (error) {
    await failMedia(opened.asset.id);
    throw error;
  }
}

/** A response row whose take list or pending file names this asset. */
const ownsAsset = (assetId: string) =>
  sql`(${hiringResponses.takeAssetIds} @> ${JSON.stringify([assetId])}::jsonb OR ${hiringResponses.payload} -> 'pendingFile' ->> 'assetId' = ${assetId})`;

/**
 * The module's onMediaComplete (and the salvage's): a finished take becomes the
 * answer when it is the newest (decision 8), a finished file is attached under
 * the candidate's own name when it is complete and within its size (decision
 * 11). The response is found through the asset's own attempt. A completion
 * after the stage closed still attaches: the answer is the candidate's.
 */
export async function attachMedia(asset: MediaAssetRow): Promise<void> {
  const [row] = await db
    .select({ response: hiringResponses, activity: { type: hiringActivities.type, config: hiringActivities.config } })
    .from(hiringResponses)
    .innerJoin(hiringStageRuns, eq(hiringStageRuns.id, hiringResponses.stageRunId))
    .innerJoin(hiringActivities, eq(hiringActivities.id, hiringResponses.activityId))
    .where(and(eq(hiringStageRuns.attemptId, asset.attemptId), ownsAsset(asset.id)))
    .limit(1);
  if (!row) return;
  const { response, activity } = row;
  const now = new Date();
  if (activity.type === "FILE_UPLOAD") {
    const pending = response.payload.pendingFile;
    if (!pending || pending.assetId !== asset.id) return;
    const { pendingFile: _done, ...rest } = response.payload;
    void _done;
    const max = activity.config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    if (asset.status !== "READY" || (asset.bytes ?? 0) > max) {
      await db.update(hiringResponses).set({ payload: rest, updatedAt: now }).where(eq(hiringResponses.id, response.id));
      return;
    }
    await db
      .update(hiringResponses)
      .set({ fileAssetIds: [asset.id], payload: { ...rest, file: { name: pending.name, bytes: asset.bytes ?? pending.bytes, mime: asset.mime } }, updatedAt: now })
      .where(eq(hiringResponses.id, response.id));
    return;
  }
  if (response.takeAssetIds[response.takeAssetIds.length - 1] !== asset.id) return;
  const { usedTextAlternative: _alternative, ...payload } = response.payload;
  void _alternative;
  await db.update(hiringResponses).set({ mediaAssetId: asset.id, payload, usedTextAlternative: false, updatedAt: now }).where(eq(hiringResponses.id, response.id));
}

/** HIRING-UX 6.6 review: a short-lived URL to the candidate's own finished take. */
export async function playbackUrl(h: HiringContext, ref: unknown): Promise<string | null> {
  const owned = await resolveOwnedMedia(h, ref);
  if (!owned || (owned.asset.status !== "READY" && owned.asset.status !== "INCOMPLETE")) return null;
  return getStorage().getSignedUrl(owned.asset.storageKey, 600);
}

/** HIRING-UX 6.13: one survey answer per invitation, after the finish, when the opening asks for it. */
export async function saveSurvey(
  h: HiringContext,
  input: { rating: unknown; comment: unknown },
): Promise<{ ok: true } | { ok: false; code: "NOT_FINISHED" | "SURVEY_OFF" | "SURVEY_INVALID" | "ALREADY_ANSWERED" }> {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, code: "SURVEY_INVALID" };
  const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 1000) : "";
  const [state] = await db
    .select({ completedAt: attempts.completedAt, enabled: hiringOpenings.finishSurveyEnabled })
    .from(attempts)
    .innerJoin(hiringAssessments, eq(hiringAssessments.assessmentId, attempts.assessmentId))
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringAssessments.openingId), eq(hiringOpenings.orgId, hiringAssessments.orgId)))
    .where(and(eq(attempts.assessmentId, h.assessment.id), eq(hiringAssessments.orgId, h.assessment.orgId)))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1);
  if (!state?.completedAt) return { ok: false, code: "NOT_FINISHED" };
  if (!state.enabled) return { ok: false, code: "SURVEY_OFF" };
  const written = await db
    .insert(hiringSurveyResponses)
    .values({ assessmentId: h.assessment.id, rating, comment: comment || null })
    .onConflictDoNothing()
    .returning({ id: hiringSurveyResponses.assessmentId });
  return written.length ? { ok: true } : { ok: false, code: "ALREADY_ANSWERED" };
}

/** What a problem report calls this invitation: the opening's name, for the team. */
export async function hiringTitle(h: HiringContext): Promise<string> {
  const [row] = await db
    .select({ name: hiringOpenings.name })
    .from(hiringOpenings)
    .where(and(eq(hiringOpenings.id, h.hiring.openingId), eq(hiringOpenings.orgId, h.assessment.orgId)))
    .limit(1);
  return row?.name ?? "";
}

/**
 * Cron: closes stage runs whose clock ran out (deadline plus the write slack,
 * never ALLOW_LATE) for candidates who closed the tab, and finishes attempts
 * whose last stage that was. Idempotent: a closed run no longer matches.
 */
export async function closeExpiredStageRuns(now: Date = new Date(), limit = 50): Promise<{ scanned: number; closed: number }> {
  const due = new Date(now.getTime() - SUBMIT_SLACK_MS);
  const rows = await db
    .select({ run: hiringStageRuns, versionId: hiringStages.versionId, orgId: hiringAssessments.orgId, assessmentId: attempts.assessmentId, candidateId: assessments.candidateId })
    .from(hiringStageRuns)
    .innerJoin(hiringStages, eq(hiringStages.id, hiringStageRuns.stageId))
    .innerJoin(attempts, eq(attempts.id, hiringStageRuns.attemptId))
    .innerJoin(hiringAssessments, eq(hiringAssessments.assessmentId, attempts.assessmentId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(and(isNull(hiringStageRuns.submittedAt), isNotNull(hiringStageRuns.deadlineAt), lt(hiringStageRuns.deadlineAt, due), ne(hiringStages.onTimeout, "ALLOW_LATE")))
    .orderBy(asc(hiringStageRuns.deadlineAt))
    .limit(limit);
  let closed = 0;
  for (const row of rows) {
    try {
      const content = await loadVersionContent(row.orgId, row.versionId);
      const stages = content ? orderedStages(content) : [];
      const stage = stages.find((s) => s.id === row.run.stageId);
      if (!stage) continue;
      const done = await db.transaction(async (tx) => {
        await lockAttempt(tx, row.run.attemptId);
        const ok = await closeRun(tx, row.run, stage, "CLOCK", true, now);
        if (ok) await finishIfDone(tx, row.run.attemptId, row.assessmentId, row.candidateId, stages.map((s) => s.id), now);
        return ok;
      });
      if (done) closed += 1;
    } catch (error) {
      console.error(`[hiring] could not close stage run ${row.run.id}`, error);
    }
  }
  return { scanned: rows.length, closed };
}

/**
 * Cron: finalises hiring uploads whose browser never came back (lib/stage-timeout
 * decideSalvage on the owning stage run), as INCOMPLETE, and attaches them like
 * a completion would. The exam's sweep no longer takes these (Task 8 Step 3).
 */
export async function salvageHiringUploads(now: Date = new Date(), limit = 20): Promise<{ scanned: number; salvaged: number; failed: number; skipped: number }> {
  const oldEnough = new Date(now.getTime() - SALVAGE_MIN_AGE_MS);
  const rows = await db
    .select({ asset: mediaAssets })
    .from(mediaAssets)
    .innerJoin(attempts, eq(attempts.id, mediaAssets.attemptId))
    .where(and(eq(attempts.solution, "HIRING"), eq(mediaAssets.status, "UPLOADING"), lt(mediaAssets.createdAt, oldEnough), isNotNull(mediaAssets.uploadId), like(mediaAssets.storageKey, "media/%")))
    .orderBy(asc(mediaAssets.createdAt))
    .limit(limit);
  const result = { scanned: rows.length, salvaged: 0, failed: 0, skipped: 0 };
  const storage = getStorage();
  for (const { asset } of rows) {
    const [owner] = await db
      .select({ completion: hiringStageRuns.completion, deadlineAt: hiringStageRuns.deadlineAt, lastHeartbeatAt: hiringStageRuns.lastHeartbeatAt })
      .from(hiringResponses)
      .innerJoin(hiringStageRuns, eq(hiringStageRuns.id, hiringResponses.stageRunId))
      .where(and(eq(hiringStageRuns.attemptId, asset.attemptId), ownsAsset(asset.id)))
      .limit(1);
    if (decideSalvage({ assetCreatedAt: asset.createdAt, run: owner ?? null }, now).action === "SKIP") {
      result.skipped += 1;
      continue;
    }
    try {
      const { bytes, parts } = await storage.salvage(asset.storageKey, asset.uploadId!);
      if (bytes === 0) {
        await db.update(mediaAssets).set({ status: "FAILED" }).where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.status, "UPLOADING")));
        result.failed += 1;
        continue;
      }
      const [updated] = await db
        .update(mediaAssets)
        .set({ status: "INCOMPLETE", bytes, parts })
        .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.status, "UPLOADING")))
        .returning();
      if (!updated) {
        result.skipped += 1;
        continue;
      }
      await attachMedia(updated);
      if (isTranscribableMime(updated.mime)) await enqueueTranscription(updated.id);
      result.salvaged += 1;
    } catch (error) {
      console.error(`[hiring] salvage failed for ${asset.id}`, error);
    }
  }
  return result;
}
```


- [ ] **Step 5: Run them to verify they pass**

Run: `pnpm exec vitest run src/lib/close-expired.test.ts src/solutions/hiring/server/candidate.test.ts`
Expected: PASS.

- [ ] **Step 6: Gates, exam, commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
git add src/solutions/hiring/server/candidate.ts src/solutions/hiring/server/candidate.test.ts src/lib/close-expired.ts src/lib/close-expired.test.ts
git commit -m "Run the hiring candidate flow on the server

State built from the candidate view, stage start with the deadline written
once under the attempt lock, autosave and close in the server's order,
submit with the clock's rule, extra time, heartbeat, uploads with
server-counted takes and checked files, attachment of the newest take,
playback of the candidate's own take, the survey, and the cron's close and
salvage. The exam's salvage now takes only exam uploads.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The hiring module and the hiring candidate endpoints

**Files:**
- Modify: `src/solutions/hiring/module.ts`, `src/solutions/hiring/module.test.ts` (rewritten), `src/solutions/hiring/manifest.ts` (doc comment and `candidateStepPath`), `src/solutions/hiring/server/consent.ts`, `src/solutions/hiring/server/consent.test.ts`
- Create: `src/solutions/hiring/server/candidate-route.ts` (+ `candidate-route.test.ts`)
- Create: `src/app/api/c/[token]/hiring/stage/start/route.ts`, `stage/submit/route.ts`, `response/route.ts`, `response/commit/route.ts`, `extra-time/route.ts`, `media/init/route.ts`, `media/play/route.ts`, `survey/route.ts`
- Test: `src/app/api/c/[token]/hiring/stage/submit/route.test.ts`
- Modify: `src/i18n/messages/candidate.tr.json`, `src/i18n/messages/candidate.en.json` (`errors`)

**Interfaces:**
- Consumes: Task 8 (`loadHiringContext`, `hiringServes`, `loadHiringState`, `startStage`, `saveResponse`, `commitResponse`, `submitStage`, `setExtraTime`, `stageHeartbeat`, `runningSegment`, `openUpload`, `attachMedia`, `playbackUrl`, `saveSurvey`, `hiringTitle`, `closeExpiredStageRuns`, `salvageHiringUploads`), `withCandidate`, `notFoundForSolution`, `fail`, `readJson`, `message` (`@/lib/candidate-api`), `candidateJson`.
- Produces: `loadConsentText(orgId: string, id: string): Promise<ConsentTextRow>` (`server/consent.ts`); `withHiringCandidate(req, params, handler: (req: NextRequest, h: HiringContext) => Promise<Response>, options?: CandidateRouteOptions): Promise<Response>` and `refuse(h: HiringContext, code: ErrorCode, status: number): Response` (`server/candidate-route.ts`); the live hiring `SolutionModule` (all candidate and attempt hooks except `renderPage`, which Task 11 adds); the eight endpoints below. Every endpoint answers through `candidateJson`; its success body is the candidate state (`HiringCandidateState`) except `response` (`{ saved: true, at }`), `media/init` (`UploadOpened`), `media/play` (`{ src }`) and `survey` (`{ received: true }`).
- Request bodies: `stage/start`, `stage/submit`: `{ stagePosition: number }`; `response`, `response/commit`: `{ stagePosition: number; activityId: string; answer?: unknown }`; `extra-time`: `{ pct: 0 | 25 | 50 }`; `media/init`: `{ stagePosition: number; activityId: string; kind: "recording" | "file"; mime: string; name?: string; bytes?: number }`; `media/play`: GET `?ref=<uploadRef>`; `survey`: `{ rating: 1-5; comment?: string }`.
- Status codes: a refused write 409; bad input (`EXTRA_TIME_INVALID`, `FILE_TYPE_REJECTED`, `FILE_TOO_LARGE`, `FILE_EMPTY`, `NOT_A_FILE`, `NOT_A_RECORDING`, `SURVEY_INVALID`, `UPLOAD_NOT_FOUND`) 400; `REQUIRED_MISSING` 422 with `missing: string[]` (activity ids).

- [ ] **Step 1: Write the failing tests**

1. Append to `src/solutions/hiring/server/consent.test.ts`:
```ts
import { loadConsentText } from "./consent";

describe("loadConsentText", () => {
  it("reads the frozen text by its id inside the invitation's organisation", async () => {
    fake.respond = (op) => (op.table === "consent_texts" ? [{ id: "ct-9", orgId: ORG, solution: "HIRING", version: 1, body: { tr: "a", en: "b" } }] : []);
    expect((await loadConsentText(ORG, "ct-9")).id).toBe("ct-9");
    expect(fake.ops[0].params).toEqual(expect.arrayContaining(["ct-9", ORG]));
  });

  it("refuses loudly when the frozen text is gone (consents keep it with RESTRICT)", async () => {
    fake.respond = () => [];
    await expect(loadConsentText(ORG, "ct-9")).rejects.toThrow(/consent text/);
  });
});
```

2. `src/solutions/hiring/server/candidate-route.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ live: false, resolveToken: vi.fn(), loadHiringContext: vi.fn() }));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/candidate-context", () => ({ resolveToken: h.resolveToken, recordFirstSeen: async () => undefined }));
vi.mock("@/solutions/registry.server", () => ({ servingSolution: async () => null, candidateSolution: () => null }));
vi.mock("../manifest", () => ({ hiringManifest: { get candidateFlowLive() { return h.live; } } }));
vi.mock("./candidate", () => ({ loadHiringContext: h.loadHiringContext }));

import { NextRequest } from "next/server";
import { withHiringCandidate } from "./candidate-route";

const ctx = (solution: "HIRING" | "LANGUAGE_EXAM") => ({
  link: { id: "l", status: "NOT_STARTED", expiresAt: new Date(), notBefore: null, firstSeenIp: null },
  assessment: { id: "a", orgId: "o", solution },
  candidate: { id: "c", fullName: null, email: null, phone: null, location: null },
  orgName: "Org",
  locale: "tr",
  contactEmail: null,
  contactName: null,
  mediaRetentionDays: 180,
  evidenceRetentionDays: 90,
});

async function call(resolved: unknown) {
  h.resolveToken.mockResolvedValueOnce(resolved);
  const handler = vi.fn(async () => new Response("handled"));
  const res = await withHiringCandidate(new NextRequest("http://localhost/api/c/t/hiring/stage/start", { method: "POST" }), Promise.resolve({ token: "t".repeat(43) }), handler);
  return { res, handler, body: res.status === 404 ? await res.json() : null };
}

beforeEach(() => {
  h.live = false;
  h.resolveToken.mockReset();
  h.loadHiringContext.mockReset();
});

describe("withHiringCandidate", () => {
  it("answers everything like an unknown token while the flow is not live", async () => {
    const unknown = await call({ ok: false, problem: "INVALID" });
    const hiring = await call({ ok: true, ctx: ctx("HIRING") });
    expect(hiring.res.status).toBe(404);
    expect(hiring.body).toEqual(unknown.body);
    expect(hiring.handler).not.toHaveBeenCalled();
  });

  it("answers an exam invitation like an unknown token once live", async () => {
    h.live = true;
    const exam = await call({ ok: true, ctx: ctx("LANGUAGE_EXAM") });
    expect(exam.res.status).toBe(404);
    expect(exam.body?.error).toBe("INVALID");
    expect(h.loadHiringContext).not.toHaveBeenCalled();
  });

  it("answers a HIRING invitation without hiring terms like an unknown token", async () => {
    h.live = true;
    h.loadHiringContext.mockResolvedValueOnce(null);
    const res = await call({ ok: true, ctx: ctx("HIRING") });
    expect(res.res.status).toBe(404);
    expect(res.handler).not.toHaveBeenCalled();
  });

  it("hands the hiring context to the handler", async () => {
    h.live = true;
    h.loadHiringContext.mockResolvedValueOnce({ ...ctx("HIRING"), hiring: { openingId: "op", versionId: "v", extraTimePct: 0, consentTextId: "ct" } });
    const res = await call({ ok: true, ctx: ctx("HIRING") });
    expect(await res.res.text()).toBe("handled");
    expect(res.handler.mock.calls[0][1]).toMatchObject({ hiring: { versionId: "v" } });
  });
});
```

3. `src/app/api/c/[token]/hiring/stage/submit/route.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  hctx: { assessment: { id: "a", orgId: "o", solution: "HIRING" }, locale: "tr", hiring: { versionId: "v" } },
  submitStage: vi.fn(),
  loadHiringState: vi.fn(async () => ({ step: "STAGE", position: 2, path: "/stage/2", internalQuestion: "TEAMSECRET" })),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/solutions/hiring/server/candidate", () => ({ submitStage: h.submitStage, loadHiringState: h.loadHiringState, loadHiringContext: vi.fn() }));
// The real candidate API would load the registry (and with it every module); the route needs four helpers.
vi.mock("@/lib/candidate-api", () => ({
  readJson: async (req: Request) => req.json(),
  message: (_locale: string, code: string) => (code === "REQUIRED_MISSING" ? "Zorunlu soruları cevaplamadan aşamayı gönderemezsin." : code),
  fail: (_ctx: unknown, code: string, status: number) => Response.json({ error: code }, { status }),
  notFoundForSolution: () => Response.json({ error: "INVALID" }, { status: 404 }),
  withCandidate: () => {
    throw new Error("withHiringCandidate is replaced in this test");
  },
}));
vi.mock("@/solutions/hiring/server/candidate-route", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/solutions/hiring/server/candidate-route")>()),
  withHiringCandidate: (req: unknown, _p: unknown, handler: (r: unknown, c: unknown) => unknown) => handler(req, h.hctx),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const post = (body: unknown) => POST(new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ token: "t".repeat(43) }) });

describe("POST /hiring/stage/submit", () => {
  it("answers missing required answers with 422 and their ids, in the candidate's language", async () => {
    h.submitStage.mockResolvedValueOnce({ ok: false, code: "REQUIRED_MISSING", missing: ["a1"] });
    const res = await post({ stagePosition: 1 });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "REQUIRED_MISSING", message: "Zorunlu soruları cevaplamadan aşamayı gönderemezsin.", missing: ["a1"] });
  });

  it("answers a stale tab with 409", async () => {
    h.submitStage.mockResolvedValueOnce({ ok: false, code: "STAGE_MISMATCH" });
    expect((await post({ stagePosition: 1 })).status).toBe(409);
  });

  it("returns the next state through candidateJson (an internal field never survives)", async () => {
    h.submitStage.mockResolvedValueOnce({ ok: true });
    const res = await post({ stagePosition: 1 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ step: "STAGE", position: 2, path: "/stage/2" });
    expect(h.submitStage).toHaveBeenCalledWith(h.hctx, 1);
  });
});
```

4. Replace `src/solutions/hiring/module.test.ts` (its two tests "adds nothing to Today yet and has no proctoring" and "refuses every candidate call loudly instead of guessing" are replaced by the tests below; declare it in the task report):
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({
  calls: [] as string[],
  hctx: { assessment: { id: "a", orgId: "o", solution: "HIRING" }, hiring: { consentTextId: "ct-frozen" } },
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("./server/candidate", () => ({
  loadHiringContext: async (ctx: { assessment: { id: string } }) => (ctx.assessment.id === "a" ? s.hctx : null),
  hiringServes: async () => true,
  loadHiringState: async () => ({ step: "CONSENT" }),
  hiringTitle: async () => "Ürün Tasarımcısı · Ekim",
  stageHeartbeat: async () => ({ deadlineAt: null }),
  runningSegment: async () => ({ kind: "stage_run", runId: "r" }),
  attachMedia: async () => s.calls.push("attach"),
  salvageHiringUploads: async () => {
    s.calls.push("salvage");
    return { scanned: 0, salvaged: 0, failed: 0, skipped: 0 };
  },
  closeExpiredStageRuns: async () => {
    s.calls.push("close");
    return { scanned: 1, closed: 1 };
  },
}));
vi.mock("./server/consent", () => ({ loadConsentText: async (orgId: string, id: string) => ({ id, orgId }) }));

import { hiringModule } from "./module";

const ctx = (id: string) => ({ assessment: { id, orgId: "o", solution: "HIRING" } }) as Parameters<typeof hiringModule.candidate.loadState>[0];

beforeEach(() => {
  s.calls = [];
});

describe("the hiring module (plan 2)", () => {
  it("adds nothing to Today yet and has no proctoring (plan 3 and plan 4)", async () => {
    expect(await hiringModule.today("o", "u", "tr")).toEqual([]);
    expect(await hiringModule.proctorPolicy("a")).toBeNull();
  });

  it("answers the core from the invitation's hiring terms", async () => {
    expect(await hiringModule.candidate.loadState(ctx("a"))).toEqual({ step: "CONSENT" });
    expect(await hiringModule.candidate.title(ctx("a"))).toBe("Ürün Tasarımcısı · Ekim");
    expect(await hiringModule.candidate.consentText(ctx("a"))).toEqual({ id: "ct-frozen", orgId: "o" });
    expect(await hiringModule.attempts.openSegment("t")).toEqual({ kind: "stage_run", runId: "r" });
  });

  it("refuses loudly for an invitation without hiring terms instead of guessing", async () => {
    await expect(hiringModule.candidate.loadState(ctx("other"))).rejects.toThrow(/no hiring terms/);
  });

  it("never terminates an attempt (HIRING-UX R13) and salvages before it closes", async () => {
    await expect(hiringModule.attempts.terminate("t")).resolves.toBeUndefined();
    expect(await hiringModule.attempts.closeExpired!(new Date(), 10)).toEqual({ scanned: 1, closed: 1 });
    expect(s.calls).toEqual(["salvage", "close"]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/solutions/hiring/server/consent.test.ts src/solutions/hiring/server/candidate-route.test.ts "src/app/api/c/[token]/hiring/stage/submit/route.test.ts" src/solutions/hiring/module.test.ts`
Expected: FAIL (missing modules and exports).

- [ ] **Step 3: The frozen consent text**

Append to `src/solutions/hiring/server/consent.ts` (add `import type { ConsentTextRow } from "@/solutions/types";`):
```ts
/** The consent text frozen on an invitation, read inside its organisation. */
export async function loadConsentText(orgId: string, id: string, x: Executor = db): Promise<ConsentTextRow> {
  const [text] = await x
    .select()
    .from(consentTexts)
    .where(and(eq(consentTexts.id, id), eq(consentTexts.orgId, orgId)))
    .limit(1);
  if (!text) throw new Error(`consent text ${id} of organisation ${orgId} is missing`);
  return text;
}
```

- [ ] **Step 4: The module**

Replace `src/solutions/hiring/module.ts` with:
```ts
import type { CandidateContext } from "@/lib/candidate-context";
import type { SolutionModule } from "@/solutions/types";
import { hiringManifest } from "./manifest";
import {
  attachMedia,
  closeExpiredStageRuns,
  hiringServes,
  hiringTitle,
  loadHiringContext,
  loadHiringState,
  runningSegment,
  salvageHiringUploads,
  stageHeartbeat,
  type HiringContext,
} from "./server/candidate";
import { loadConsentText } from "./server/consent";
import { hiringLibraryUsage } from "./server/library-usage";

/** The core only routes invitations hiring serves (serves), so a missing row here is a bug, said loudly. */
async function requireHiring(ctx: CandidateContext): Promise<HiringContext> {
  const h = await loadHiringContext(ctx);
  if (!h) throw new Error(`assessment ${ctx.assessment.id} has no hiring terms`);
  return h;
}

/** Abandoned uploads per cron tick; storage is touched once per asset. */
const SALVAGE_BATCH = 20;

export const hiringModule: SolutionModule = {
  ...hiringManifest,
  // Hiring's Today rows (waiting reviews, decisions) arrive with plan 3.
  async today() {
    return [];
  },
  // No proctoring in plan 2: every invitation freezes proctor_level OFF (plan 4 adds levels).
  async proctorPolicy() {
    return null;
  },
  candidate: {
    serves: hiringServes,
    async loadState(ctx) {
      return loadHiringState(await requireHiring(ctx));
    },
    async title(ctx) {
      return hiringTitle(await requireHiring(ctx));
    },
    async heartbeat(ctx) {
      return stageHeartbeat(await requireHiring(ctx));
    },
    async consentText(ctx) {
      const h = await requireHiring(ctx);
      return loadConsentText(h.assessment.orgId, h.hiring.consentTextId);
    },
  },
  attempts: {
    openSegment: runningSegment,
    // HIRING-UX R13: nothing ends a hiring attempt by machine, at any level. The
    // core asks only when a proctoring policy enables termination, which hiring never does.
    async terminate() {},
    onMediaComplete: attachMedia,
    async closeExpired(now, limit) {
      // Salvage first, so a rescued take is attached before its stage closes.
      await salvageHiringUploads(now, SALVAGE_BATCH);
      return closeExpiredStageRuns(now, limit);
    },
  },
  library: { usage: hiringLibraryUsage },
};
```

In `src/solutions/hiring/manifest.ts`, replace the doc comment above `hiringManifest` with:
```ts
/**
 * Hiring as the panel and the core see it (HIRING-UX 4.1, 4.3). The candidate
 * flow is built in plan 2; candidateFlowLive turns on in its Task 10, once the
 * endpoints are proven to leak nothing, and inviteHref once the invite screen
 * exists and Today offers it (Task 20).
 */
```
and replace `candidateStepPath` with:
```ts
  // The hiring state names its own page; this maps a bare step for core callers.
  candidateStepPath: (token: string, state: CandidateStepState) => {
    const base = `/a/${encodeURIComponent(token)}`;
    if (state.step === "INFO") return `${base}/info`;
    if (state.step === "CHECK") return `${base}/check`;
    if (state.step === "STAGE") return `${base}/stage/${state.position ?? 1}`;
    if (state.step === "DONE") return `${base}/done`;
    return base;
  },
```
(change the type import to `import type { CandidateStepState, SolutionManifest } from "@/solutions/types";`).

- [ ] **Step 5: The route helper**

`src/solutions/hiring/server/candidate-route.ts`:
```ts
import type { NextRequest } from "next/server";
import { fail, notFoundForSolution, withCandidate, type CandidateRouteOptions, type ErrorCode } from "@/lib/candidate-api";
import { hiringManifest } from "../manifest";
import { loadHiringContext, type HiringContext } from "./candidate";

export type HiringHandler = (req: NextRequest, h: HiringContext) => Promise<Response>;

/**
 * `withCandidate` for `/api/c/[token]/hiring/*` (hiring solution design 7).
 * Anything that is not a HIRING invitation, a HIRING invitation while the
 * flow is not live, or one without hiring terms, is answered exactly like an
 * unknown token, before a single hiring table is written.
 */
export function withHiringCandidate(
  req: NextRequest,
  params: Promise<{ token: string }>,
  handler: HiringHandler,
  options: CandidateRouteOptions = {},
): Promise<Response> {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const h = await loadHiringContext(ctx);
      if (!h) return notFoundForSolution(request);
      return handler(request, h);
    },
    { ...options, acceptSolution: (kind) => kind === "HIRING" && hiringManifest.candidateFlowLive },
  );
}

/** A refusal in the candidate's language. */
export function refuse(h: HiringContext, code: ErrorCode, status: number): Response {
  return fail(h, code, status);
}

/** Bad input, as opposed to a state the candidate cannot change by retrying. */
export const INPUT_CODES = new Set<string>(["EXTRA_TIME_INVALID", "FILE_TYPE_REJECTED", "FILE_TOO_LARGE", "FILE_EMPTY", "NOT_A_FILE", "NOT_A_RECORDING", "SURVEY_INVALID", "UPLOAD_NOT_FOUND"]);
export const statusOf = (code: string) => (code === "REQUIRED_MISSING" ? 422 : INPUT_CODES.has(code) ? 400 : 409);
```

- [ ] **Step 6: The endpoints**

`src/app/api/c/[token]/hiring/stage/start/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { readJson } from "@/lib/candidate-api";
import { loadHiringState, startStage } from "@/solutions/hiring/server/candidate";
import { refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/** HIRING-UX 6.5 "Aşamayı başlat": starts the stage's clock once; a repeat leaves it as it is. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const body = await readJson<{ stagePosition?: number }>(request);
    const started = await startStage(h, body?.stagePosition);
    if (!started.ok) {
      const code = started.code === "NOT_READY" ? "STEPS_MISSING" : started.code;
      return refuse(h, code, statusOf(code));
    }
    return candidateJson(await loadHiringState(h));
  });
}
```

`src/app/api/c/[token]/hiring/stage/submit/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { message, readJson } from "@/lib/candidate-api";
import { loadHiringState, submitStage } from "@/solutions/hiring/server/candidate";
import { refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/**
 * "Aşamayı bitir", the final submit after its 8 second undo, and the client's
 * submit at 0:00. Missing required answers are named (422) while time is
 * left; after the deadline the stage closes with what it has.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const body = await readJson<{ stagePosition?: number }>(request);
    const submitted = await submitStage(h, body?.stagePosition);
    if (!submitted.ok) {
      if (submitted.code === "REQUIRED_MISSING") {
        return candidateJson({ error: "REQUIRED_MISSING", message: message(h.locale, "REQUIRED_MISSING"), missing: submitted.missing ?? [] }, { status: 422 });
      }
      return refuse(h, submitted.code, statusOf(submitted.code));
    }
    return candidateJson(await loadHiringState(h));
  });
}
```

`src/app/api/c/[token]/hiring/response/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { readJson } from "@/lib/candidate-api";
import { saveResponse } from "@/solutions/hiring/server/candidate";
import { refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

type Body = { stagePosition?: number; activityId?: string; answer?: unknown };

async function save(req: NextRequest, params: Promise<{ token: string }>) {
  return withHiringCandidate(
    req,
    params,
    async (request, h) => {
      const body = await readJson<Body>(request);
      const saved = await saveResponse(h, { position: body?.stagePosition, activityId: body?.activityId, answer: body?.answer });
      if (!saved.ok) return refuse(h, saved.code, statusOf(saved.code));
      return candidateJson({ saved: true, at: saved.at });
    },
    { limit: 600 },
  );
}

/** Autosave of the open question (HIRING-UX 6.7 "Kaydedildi"). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return save(req, params);
}

/** The same, for navigator.sendBeacon on page hide (beacons can only POST). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return save(req, params);
}
```

`src/app/api/c/[token]/hiring/response/commit/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { message, readJson } from "@/lib/candidate-api";
import { commitResponse, loadHiringState } from "@/solutions/hiring/server/candidate";
import { refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

type Body = { stagePosition?: number; activityId?: string; answer?: unknown };

/** "Sonraki soru" / "Bu cevabı kullan": closes the question; the reply is the next state. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const body = await readJson<Body>(request);
    const committed = await commitResponse(h, { position: body?.stagePosition, activityId: body?.activityId, answer: body && "answer" in body ? body.answer : undefined });
    if (!committed.ok) {
      if (committed.code === "REQUIRED_MISSING") {
        return candidateJson({ error: "REQUIRED_MISSING", message: message(h.locale, "REQUIRED_MISSING"), missing: [body?.activityId ?? ""] }, { status: 422 });
      }
      return refuse(h, committed.code, statusOf(committed.code));
    }
    return candidateJson(await loadHiringState(h));
  });
}
```

`src/app/api/c/[token]/hiring/extra-time/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { readJson } from "@/lib/candidate-api";
import { loadHiringState, setExtraTime } from "@/solutions/hiring/server/candidate";
import { refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/** HIRING-UX 6.1 "Ek süre, kendin seç": no reason asked, applied to stages started afterwards. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const body = await readJson<{ pct?: unknown }>(request);
    const chosen = await setExtraTime(h, body?.pct);
    if (!chosen.ok) return refuse(h, chosen.code, statusOf(chosen.code));
    return candidateJson(await loadHiringState(h));
  });
}
```

`src/app/api/c/[token]/hiring/media/init/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { readJson } from "@/lib/candidate-api";
import { openUpload } from "@/solutions/hiring/server/candidate";
import { refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

type Body = { stagePosition?: number; activityId?: string; kind?: string; mime?: string; name?: string; bytes?: number };

/**
 * Opens a take or a file upload for the running question before the first byte
 * exists; the parts and the completion go through the core /media/* routes.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const body = await readJson<Body>(request);
    const opened = await openUpload(h, { position: body?.stagePosition, activityId: body?.activityId, kind: body?.kind, mime: body?.mime, name: body?.name, bytes: body?.bytes });
    if (!opened.ok) return refuse(h, opened.code, statusOf(opened.code));
    return candidateJson(opened.upload);
  });
}
```

`src/app/api/c/[token]/hiring/media/play/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { playbackUrl } from "@/solutions/hiring/server/candidate";
import { refuse, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/** HIRING-UX 6.6 "Gözden geçir": a ten minute URL to the candidate's own finished take, nobody else's. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const src = await playbackUrl(h, new URL(request.url).searchParams.get("ref"));
    if (!src) return refuse(h, "UPLOAD_NOT_FOUND", 400);
    return candidateJson({ src });
  });
}
```

`src/app/api/c/[token]/hiring/survey/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { readJson } from "@/lib/candidate-api";
import { saveSurvey } from "@/solutions/hiring/server/candidate";
import { refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/** HIRING-UX 6.13: the optional survey on a finished (COMPLETED) link. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(
    req,
    params,
    async (request, h) => {
      const body = await readJson<{ rating?: unknown; comment?: unknown }>(request);
      const saved = await saveSurvey(h, { rating: body?.rating, comment: body?.comment });
      if (!saved.ok) return refuse(h, saved.code, statusOf(saved.code));
      return candidateJson({ received: true });
    },
    { limit: 10, allowProblems: ["COMPLETED"] },
  );
}
```

- [ ] **Step 7: Error copy**

Add to `errors` in `candidate.tr.json`:
```json
"STEPS_MISSING": "Başlamadan önceki adımlar tamamlanmadı. Sayfayı yenile.",
"OPENING_CLOSED": "Bu pozisyon için değerlendirme kapandı.",
"ACTIVITY_CLOSED": "Bu soruyu kapattın; geri dönülmüyor. Sayfayı yenile.",
"ACTIVITY_ORDER": "Bu sayfa güncel değil. Devam etmek için sayfayı yenile.",
"EXTRA_TIME_INVALID": "Ek süre için %25 ya da %50 seç.",
"EXTRA_TIME_LOCKED": "Ek süre bir aşama sürerken değişmez. Bu aşamayı bitirince seçebilirsin.",
"NOT_A_FILE": "Bu soru dosya istemiyor.",
"FILE_TOO_LARGE": "Dosya izin verilen boyuttan büyük.",
"FILE_EMPTY": "Dosya boş görünüyor. Başka bir dosya seç.",
"NOT_FINISHED": "Anket, değerlendirme bitince açılır.",
"SURVEY_OFF": "Bu değerlendirmede anket yok.",
"SURVEY_INVALID": "1 ile 5 arasında bir puan seç.",
"ALREADY_ANSWERED": "Görüşünü zaten gönderdin, teşekkürler."
```
and to `candidate.en.json`:
```json
"STEPS_MISSING": "The steps before the start are not complete. Reload the page.",
"OPENING_CLOSED": "The assessment for this role has closed.",
"ACTIVITY_CLOSED": "You already closed this question; it cannot be reopened. Reload the page.",
"ACTIVITY_ORDER": "This page is out of date. Reload it to continue.",
"EXTRA_TIME_INVALID": "Choose 25% or 50% extra time.",
"EXTRA_TIME_LOCKED": "Extra time cannot change while a stage is running. You can choose it after this stage.",
"NOT_A_FILE": "This question does not take a file.",
"FILE_TOO_LARGE": "The file is larger than allowed.",
"FILE_EMPTY": "The file looks empty. Choose another one.",
"NOT_FINISHED": "The survey opens once you finish.",
"SURVEY_OFF": "This assessment has no survey.",
"SURVEY_INVALID": "Choose a rating from 1 to 5.",
"ALREADY_ANSWERED": "You already sent your feedback, thank you."
```

- [ ] **Step 8: Run the tests and the gates**

```bash
pnpm exec vitest run src/solutions/hiring/server/consent.test.ts src/solutions/hiring/server/candidate-route.test.ts "src/app/api/c/[token]/hiring/stage/submit/route.test.ts" src/solutions/hiring/module.test.ts src/i18n/messages.test.ts src/solutions/boundary.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
Then the dev server on `kademe_platform` and `pnpm verify:guard`. Expected: PASS; `pnpm build` lists the eight `/api/c/[token]/hiring/...` routes; `verify:guard` 31 `ok` (hiring is still not live: every hiring endpoint answers a hiring token like an unknown one).

- [ ] **Step 9: Commit**

```bash
git add src/solutions/hiring/module.ts src/solutions/hiring/module.test.ts src/solutions/hiring/manifest.ts src/solutions/hiring/server/consent.ts src/solutions/hiring/server/consent.test.ts src/solutions/hiring/server/candidate-route.ts src/solutions/hiring/server/candidate-route.test.ts "src/app/api/c/[token]/hiring/stage/start/route.ts" "src/app/api/c/[token]/hiring/stage/submit/route.ts" "src/app/api/c/[token]/hiring/stage/submit/route.test.ts" "src/app/api/c/[token]/hiring/response/route.ts" "src/app/api/c/[token]/hiring/response/commit/route.ts" "src/app/api/c/[token]/hiring/extra-time/route.ts" "src/app/api/c/[token]/hiring/media/init/route.ts" "src/app/api/c/[token]/hiring/media/play/route.ts" "src/app/api/c/[token]/hiring/survey/route.ts" src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Wire the hiring module and its candidate endpoints

The hiring module answers the core from each invitation's frozen terms
(state, title, heartbeat, consent text, media completion, the cron's close
and salvage) and never terminates an attempt. Eight endpoints under
/api/c/[token]/hiring answer only live HIRING invitations with hiring
terms, always through candidateJson. Still not live for candidates.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Prove the flow end to end, then turn hiring candidates on

**Files:**
- Create: `scripts/hiring-fixture.ts`, `scripts/verify-hiring-flow.ts`, `scripts/dev-hiring-link.ts`
- Modify: `package.json` (`verify:hiring-flow`, `dev:hiring-link`)
- Modify: `src/solutions/hiring/manifest.ts` (`candidateFlowLive: true`)
- Modify: `src/solutions/registry.test.ts`, `src/lib/candidate-api.registered-hiring.test.ts` (rewritten), `scripts/verify-solution-guard.ts`

**Interfaces:**
- Consumes: everything of Tasks 1-9; `createOpening`, `saveOpeningRules` (`server/openings`); `addStage`, `updateStage`, `addActivity`, `updateActivity`, `setActivityCompetencies` (`server/versions`); `publishDraft` (`server/publish`); `seedLibrary` (`@/db/library-seed`); `createPosition` (`@/server/library-write`).
- Produces: `buildPublishedOpening(input: { orgId: string; ownerId: string; memberIds: string[]; sentinels?: boolean; kind?: "full" | "text" | "written" }): Promise<{ openingId: string; competencies: string[] }>` and `freshOrganisation(): Promise<{ orgId: string; ownerId: string; reviewerId: string }>` (`scripts/hiring-fixture.ts`, throw-away databases only); `pnpm verify:hiring-flow`; `pnpm dev:hiring-link [--kind text|written] [--lang en] [--name "..."]`; `hiringManifest.candidateFlowLive === true`.

The fixture's opening (the script and every later browser check use it):
- Stage 1 "Tanışma" (600 s, AUTO_SUBMIT, no going back): `VIDEO` (think 20 s flexible, answer 60 s, 2 takes, written alternative on, measures İletişim), `SINGLE_CHOICE` (choice `a` right), `LONG_TEXT` (20-2000 characters, measures Problem Çözme).
- Stage 2 "Vaka" (300 s): `FILE_UPLOAD` (PDF, 1 MB, measures Problem Çözme), `AUDIO` (think 10 s, answer 30 s, 1 take, measures İletişim), `SHORT_TEXT` optional (measures İletişim), `MULTI_CHOICE` (`a` and `b` right).
- `kind: "text"` builds one stage with a `LONG_TEXT` question only (no device check).
- `kind: "written"` builds no recorded question: stage 1 `LONG_TEXT`, `SINGLE_CHOICE`, optional `SHORT_TEXT`; stage 2 (going back allowed) `LONG_TEXT`, `MULTI_CHOICE`.
- With `sentinels`, visible texts end in `LEAKVISIBLE_STAGE`, `LEAKVISIBLE_PROMPT`, `LEAKVISIBLE_CHOICE` and every team-only field holds `TEAMSECRET_*`.

- [ ] **Step 1: The fixture**

`scripts/hiring-fixture.ts`:
```ts
/**
 * A published hiring opening for checks on THROW-AWAY databases (names ending
 * in _check): publishing freezes rows that can never be deleted, so this never
 * runs on kademe_platform or anything shared.
 */

export async function freshOrganisation(): Promise<{ orgId: string; ownerId: string; reviewerId: string }> {
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const stamp = Date.now();
  const [org] = await db.insert(s.organizations).values({ name: "Örnek A.Ş.", contactEmail: "ik@ornek.test" }).returning();
  const [owner] = await db.insert(s.users).values({ orgId: org.id, email: `owner-${stamp}@flow.local`, name: "Deniz Yılmaz", role: "OWNER", passwordHash: "x" }).returning();
  const [reviewer] = await db.insert(s.users).values({ orgId: org.id, email: `reviewer-${stamp}@flow.local`, name: "Ece Kaya", role: "REVIEWER", passwordHash: "x" }).returning();
  return { orgId: org.id, ownerId: owner.id, reviewerId: reviewer.id };
}

export async function buildPublishedOpening(input: {
  orgId: string;
  ownerId: string;
  memberIds: string[];
  sentinels?: boolean;
  kind?: "full" | "text" | "written";
}): Promise<{ openingId: string; competencies: string[] }> {
  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { seedLibrary } = await import("@/db/library-seed");
  const { createPosition } = await import("@/server/library-write");
  const openings = await import("@/solutions/hiring/server/openings");
  const versions = await import("@/solutions/hiring/server/versions");
  const { publishDraft } = await import("@/solutions/hiring/server/publish");

  const org = input.orgId;
  const user = { id: input.ownerId, orgId: org };
  await seedLibrary(org);
  const key = async (seedKey: string) =>
    (await db.select({ id: s.competencies.id }).from(s.competencies).where(and(eq(s.competencies.orgId, org), eq(s.competencies.seedKey, seedKey))))[0].id;
  const communication = await key("communication");
  const problem = await key("problem_solving");
  const visible = (label: string) => (input.sentinels ? ` LEAKVISIBLE_${label}` : "");
  const team = input.sentinels
    ? {
        internalQuestion: "TEAMSECRET_PURPOSE",
        expectedBehaviours: ["TEAMSECRET_BEHAVIOUR"],
        redFlags: ["TEAMSECRET_FLAG"],
        managerNotes: "TEAMSECRET_NOTE",
        answerExamples: { 1: "TEAMSECRET_ONE", 3: "TEAMSECRET_THREE", 5: "TEAMSECRET_FIVE" },
      }
    : {};

  const position = await createPosition(org, input.ownerId, { name: `Ürün Tasarımcısı ${Date.now()}` });
  if (!position.ok) throw new Error("position");
  const created = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null });
  if (!created.ok) throw new Error(created.code);
  const id = created.openingId;

  const s1 = await versions.addStage(org, id);
  await versions.updateStage(org, id, s1, {
    name: { tr: `Tanışma${visible("STAGE")}`, en: "Introduction" },
    description: { tr: "Kısa bir tanışma.", en: "A short introduction." },
    durationSeconds: 600,
    internalPurpose: input.sentinels ? "TEAMSECRET_STAGE_PURPOSE" : null,
  });
  if (input.kind === "written") {
    // Stage 1: long text, single choice, optional short text. Stage 2 (going back allowed): long text, multiple choice.
    const long = await versions.addActivity(org, id, s1, "LONG_TEXT");
    await versions.updateActivity(org, id, long, { prompt: { tr: "Son projende bir sorunu nasıl çözdüğünü anlat.", en: "Tell us how you solved a problem in your last project." }, config: { minChars: 20, maxChars: 2000 } });
    await versions.setActivityCompetencies(org, id, long, [problem]);
    const single = await versions.addActivity(org, id, s1, "SINGLE_CHOICE");
    await versions.updateActivity(org, id, single, {
      prompt: { tr: "Bir tasarım kararını kim onaylar?", en: "Who approves a design decision?" },
      config: { choices: [{ id: "a", label: { tr: "Ürün ekibi", en: "The product team" }, correct: true }, { id: "b", label: { tr: "Yalnız ben", en: "Only me" } }, { id: "c", label: { tr: "Satış ekibi", en: "The sales team" } }] },
    });
    const short = await versions.addActivity(org, id, s1, "SHORT_TEXT");
    await versions.updateActivity(org, id, short, { prompt: { tr: "Eklemek istediğin bir şey var mı?", en: "Anything you want to add?" }, required: false });
    await versions.setActivityCompetencies(org, id, short, [communication]);
    const s2 = await versions.addStage(org, id);
    await versions.updateStage(org, id, s2, { name: { tr: "Vaka", en: "Case" }, durationSeconds: 300, backNavigation: true });
    const caseText = await versions.addActivity(org, id, s2, "LONG_TEXT");
    await versions.updateActivity(org, id, caseText, { prompt: { tr: "Bir müşteriye kötü bir haberi nasıl verirdin?", en: "How would you give a client bad news?" } });
    await versions.setActivityCompetencies(org, id, caseText, [communication]);
    const multi = await versions.addActivity(org, id, s2, "MULTI_CHOICE");
    await versions.updateActivity(org, id, multi, {
      prompt: { tr: "Hangileri bir planın parçasıdır?", en: "Which belong in a plan?" },
      config: { choices: [{ id: "a", label: { tr: "Hedef", en: "Goal" }, correct: true }, { id: "b", label: { tr: "Takvim", en: "Timeline" }, correct: true }, { id: "c", label: { tr: "Hava durumu", en: "Weather" } }] },
    });
  } else if (input.kind === "text") {
    const only = await versions.addActivity(org, id, s1, "LONG_TEXT");
    await versions.updateActivity(org, id, only, { prompt: { tr: `Son projende bir sorunu nasıl çözdüğünü anlat.${visible("PROMPT")}`, en: "Tell us how you solved a problem in your last project." }, config: { minChars: 20, maxChars: 2000 }, ...team });
    await versions.setActivityCompetencies(org, id, only, [problem]);
  } else {
    const video = await versions.addActivity(org, id, s1, "VIDEO");
    await versions.updateActivity(org, id, video, {
      prompt: { tr: `Kendini kısaca tanıt ve bu role neden başvurduğunu anlat.${visible("PROMPT")}`, en: "Introduce yourself and tell us why you applied." },
      thinkSeconds: 20,
      flexibleThink: true,
      answerSeconds: 60,
      maxTakes: 2,
      config: { textAlternativeEnabled: true },
      ...team,
    });
    await versions.setActivityCompetencies(org, id, video, [communication]);
    const single = await versions.addActivity(org, id, s1, "SINGLE_CHOICE");
    await versions.updateActivity(org, id, single, {
      prompt: { tr: "Bir tasarım kararını kim onaylar?", en: "Who approves a design decision?" },
      config: {
        choices: [
          { id: "a", label: { tr: `Ürün ekibi${visible("CHOICE")}`, en: "The product team" }, correct: true },
          { id: "b", label: { tr: "Yalnız ben", en: "Only me" } },
        ],
      },
    });
    const long = await versions.addActivity(org, id, s1, "LONG_TEXT");
    await versions.updateActivity(org, id, long, { prompt: { tr: "Son projende bir sorunu nasıl çözdüğünü anlat.", en: "Tell us how you solved a problem in your last project." }, config: { minChars: 20, maxChars: 2000 } });
    await versions.setActivityCompetencies(org, id, long, [problem]);

    const s2 = await versions.addStage(org, id);
    await versions.updateStage(org, id, s2, { name: { tr: "Vaka", en: "Case" }, durationSeconds: 300 });
    const file = await versions.addActivity(org, id, s2, "FILE_UPLOAD");
    await versions.updateActivity(org, id, file, { prompt: { tr: "Hazırladığın kısa planı PDF olarak yükle.", en: "Upload your short plan as a PDF." }, config: { acceptedMimeTypes: ["application/pdf"], maxFileBytes: 1024 * 1024 } });
    await versions.setActivityCompetencies(org, id, file, [problem]);
    const audio = await versions.addActivity(org, id, s2, "AUDIO");
    await versions.updateActivity(org, id, audio, { prompt: { tr: "Planını bir müşteriye nasıl anlatırdın?", en: "How would you explain your plan to a client?" }, thinkSeconds: 10, answerSeconds: 30, maxTakes: 1 });
    await versions.setActivityCompetencies(org, id, audio, [communication]);
    const short = await versions.addActivity(org, id, s2, "SHORT_TEXT");
    await versions.updateActivity(org, id, short, { prompt: { tr: "Eklemek istediğin bir şey var mı?", en: "Anything you want to add?" }, required: false });
    await versions.setActivityCompetencies(org, id, short, [communication]);
    const multi = await versions.addActivity(org, id, s2, "MULTI_CHOICE");
    await versions.updateActivity(org, id, multi, {
      prompt: { tr: "Hangileri bir planın parçasıdır?", en: "Which belong in a plan?" },
      config: {
        choices: [
          { id: "a", label: { tr: "Hedef", en: "Goal" }, correct: true },
          { id: "b", label: { tr: "Takvim", en: "Timeline" }, correct: true },
          { id: "c", label: { tr: "Hava durumu", en: "Weather" } },
        ],
      },
    });
  }

  const rules = await openings.saveOpeningRules(org, input.ownerId, id, {
    name: `Ürün Tasarımcısı · Kontrol ${Date.now()}`,
    memberIds: input.memberIds,
    decisionMakerId: input.ownerId,
    backupDecisionMakerId: null,
    minEvaluations: 2,
    blindMode: false,
    deadline: null,
    feedbackDays: 7,
    candidateContactEmail: "deniz@ornek.test",
  });
  if (!rules.ok) throw new Error(`rules: ${rules.problems.join(",")}`);
  const published = await publishDraft(org, id, input.ownerId);
  if (!published.ok) throw new Error(`publish: ${published.problems.join(",")}`);
  return { openingId: id, competencies: [communication, problem] };
}
```

- [ ] **Step 2: Write the end-to-end script (the failing test)**

`scripts/verify-hiring-flow.ts`:
```ts
/**
 * End to end check of the hiring candidate flow (plan 2), in process, against a
 * THROW-AWAY database (name ends in _check) with every migration applied. It
 * calls the real route handlers with NextRequest, so every body it scans is a
 * real candidate response; recordings and files go to a temporary local disk.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm verify:hiring-flow
 */
import "dotenv/config";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

let failed = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => {
  failed += 1;
  console.log(`  FAIL ${m}`);
};
const check = (condition: boolean, label: string, detail?: unknown) => (condition ? ok(label) : bad(detail === undefined ? label : `${label}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`));

type Json = Record<string, unknown> & { error?: string; step?: string; position?: number; path?: string; current?: Record<string, unknown> | null };
type Handler = (req: unknown, ctx: { params: Promise<{ token: string }> }) => Promise<Response>;

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
  if (!url.pathname.endsWith("_check")) {
    console.error(`Refusing: ${url.pathname} is not a throw-away *_check database.`);
    process.exit(2);
  }
  // Local disk for this run, whatever the shell has.
  process.env.LOCAL_STORAGE_DIR = mkdtempSync(path.join(os.tmpdir(), "kademe-flow-"));
  for (const name of ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET"]) delete process.env[name];

  const { NextRequest } = await import("next/server");
  const { and, eq, sql } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { mintToken } = await import("@/lib/auth");
  const { buildPublishedOpening, freshOrganisation } = await import("./hiring-fixture");
  const { createHiringInvitation, listOpeningCandidates } = await import("@/solutions/hiring/server/invitations");
  const { hiringModule } = await import("@/solutions/hiring/module");

  const routes: Record<string, Handler> = {
    "GET /state": (await import("@/app/api/c/[token]/state/route")).GET as Handler,
    "POST /consent": (await import("@/app/api/c/[token]/consent/route")).POST as Handler,
    "POST /info": (await import("@/app/api/c/[token]/info/route")).POST as Handler,
    "POST /device-check": (await import("@/app/api/c/[token]/device-check/route")).POST as Handler,
    "POST /heartbeat": (await import("@/app/api/c/[token]/heartbeat/route")).POST as Handler,
    "PUT /media/part": (await import("@/app/api/c/[token]/media/part/route")).PUT as Handler,
    "POST /media/complete": (await import("@/app/api/c/[token]/media/complete/route")).POST as Handler,
    "POST /rights": (await import("@/app/api/c/[token]/rights/route")).POST as Handler,
    "POST /problem": (await import("@/app/api/c/[token]/problem/route")).POST as Handler,
    "PUT /exam/answer": (await import("@/app/api/c/[token]/exam/answer/route")).PUT as Handler,
    "POST /hiring/stage/start": (await import("@/app/api/c/[token]/hiring/stage/start/route")).POST as Handler,
    "POST /hiring/stage/submit": (await import("@/app/api/c/[token]/hiring/stage/submit/route")).POST as Handler,
    "PUT /hiring/response": (await import("@/app/api/c/[token]/hiring/response/route")).PUT as Handler,
    "POST /hiring/response/commit": (await import("@/app/api/c/[token]/hiring/response/commit/route")).POST as Handler,
    "POST /hiring/extra-time": (await import("@/app/api/c/[token]/hiring/extra-time/route")).POST as Handler,
    "POST /hiring/media/init": (await import("@/app/api/c/[token]/hiring/media/init/route")).POST as Handler,
    "GET /hiring/media/play": (await import("@/app/api/c/[token]/hiring/media/play/route")).GET as Handler,
    "POST /hiring/survey": (await import("@/app/api/c/[token]/hiring/survey/route")).POST as Handler,
  };
  /** Every body a candidate received, for the leak scan. */
  const sent: string[] = [];
  async function call(route: string, token: string, body?: unknown, query = "", raw?: Uint8Array): Promise<{ status: number; json: Json }> {
    const [method, pathPart] = route.split(" ");
    const req = new NextRequest(`http://localhost/api/c/${token}${pathPart}${query}`, {
      method,
      headers: raw ? { "content-type": "application/octet-stream" } : { "content-type": "application/json" },
      body: method === "GET" ? undefined : raw ? Buffer.from(raw) : JSON.stringify(body ?? {}),
    });
    const res = await routes[route](req, { params: Promise.resolve({ token }) });
    const text = await res.text();
    sent.push(text);
    return { status: res.status, json: (text ? JSON.parse(text) : {}) as Json };
  }
  const unknownToken = "u".repeat(43);

  console.log("\nA published opening, and an invitation to it");
  const team = await freshOrganisation();
  const fixture = await buildPublishedOpening({ orgId: team.orgId, ownerId: team.ownerId, memberIds: [team.ownerId, team.reviewerId], sentinels: true });
  const owner = { id: team.ownerId, orgId: team.orgId };
  const invite = await createHiringInvitation(owner, { openingId: fixture.openingId, fullName: "Elif Kaya", email: `elif-${Date.now()}@example.com`, locale: "tr", deadline: null }, { baseUrl: "https://kademe.test" });
  if (!invite.ok) throw new Error(`invite: ${invite.code}`);
  const token = invite.url.split("/a/")[1];
  const [terms] = await db.select().from(s.hiringAssessments).where(eq(s.hiringAssessments.assessmentId, invite.assessmentId));
  const assignments = await db.select().from(s.hiringAssignments).where(eq(s.hiringAssignments.assessmentId, invite.assessmentId));
  const [consentText] = await db.select().from(s.consentTexts).where(eq(s.consentTexts.id, terms.consentTextId));
  check(terms.proctorLevel === "OFF" && terms.extraTimePct === 0, "the invitation froze proctoring OFF and no extra time", terms);
  check(assignments.length === 2, "the active panel (owner and reviewer) is assigned", assignments.length);
  check(consentText?.solution === "HIRING", "with the organisation's hiring consent text, not the exam's", consentText?.solution);
  const [outbox] = await db.select().from(s.messageOutbox).where(and(eq(s.messageOutbox.orgId, team.orgId), eq(s.messageOutbox.kind, "INVITE")));
  check(!!outbox && outbox.body.includes(invite.url) && outbox.body.includes("Merhaba Elif Kaya"), "the ready message is in the outbox with the link");

  console.log("\nOther tokens are answered like unknown ones");
  const unknownStart = await call("POST /hiring/stage/start", unknownToken, { stagePosition: 1 });
  check(unknownStart.status === 404 && unknownStart.json.error === "INVALID", "an unknown token: 404 INVALID");
  const examPerson = await db.insert(s.candidates).values({ orgId: team.orgId, fullName: "Sınav Adayı", email: "exam@example.com" }).returning();
  const [examAssessment] = await db.insert(s.assessments).values({ orgId: team.orgId, candidateId: examPerson[0].id, solution: "LANGUAGE_EXAM", locale: "tr" }).returning();
  const examToken = mintToken();
  await db.insert(s.assessmentLinks).values({ assessmentId: examAssessment.id, tokenHash: examToken.hash, status: "NOT_STARTED", expiresAt: new Date(Date.now() + 86_400_000) });
  for (const route of ["POST /hiring/stage/start", "PUT /hiring/response", "POST /hiring/media/init", "POST /hiring/survey"]) {
    const r = await call(route, examToken.raw, {});
    check(r.status === 404 && JSON.stringify(r.json) === JSON.stringify(unknownStart.json), `an exam invitation on ${route}: same 404 as unknown`, r);
  }
  const bareToken = mintToken();
  const [barePerson] = await db.insert(s.candidates).values({ orgId: team.orgId, fullName: "Satırsız", email: "bare@example.com" }).returning();
  const [bare] = await db.insert(s.assessments).values({ orgId: team.orgId, candidateId: barePerson.id, solution: "HIRING", locale: "tr" }).returning();
  await db.insert(s.assessmentLinks).values({ assessmentId: bare.id, tokenHash: bareToken.hash, status: "NOT_STARTED", expiresAt: new Date(Date.now() + 86_400_000) });
  const bareState = await call("GET /state", bareToken.raw);
  const bareStart = await call("POST /hiring/stage/start", bareToken.raw, { stagePosition: 1 });
  check(bareState.status === 404 && bareStart.status === 404, "a HIRING invitation without hiring terms: 404 on core and hiring endpoints");
  const examOnHiring = await call("PUT /exam/answer", token, {});
  check(examOnHiring.status === 404 && examOnHiring.json.error === "INVALID", "an exam endpoint answers the hiring token like an unknown one");

  console.log("\nLanding, extra time, consent, device check");
  let state = await call("GET /state", token);
  check(state.status === 200 && state.json.step === "CONSENT" && state.json.path === "", "the landing comes first", state.json.step);
  state = await call("POST /hiring/extra-time", token, { pct: 25 });
  check(state.json.extraTimePct === 25, "+25% chosen before consent, no reason asked", state.json.extraTimePct);
  check((await call("POST /hiring/extra-time", token, { pct: 30 })).status === 400, "30% is refused");
  state = await call("POST /consent", token, { accepted: true });
  check(state.json.step === "CHECK" && state.json.path === "/check", "consent leads to the device check (name and e-mail came with the invitation)", state.json);
  const [consent] = await db.select().from(s.consents).where(eq(s.consents.assessmentId, invite.assessmentId));
  check(consent?.consentTextId === terms.consentTextId, "the consent recorded is the invitation's frozen text");
  const early = await call("POST /hiring/stage/start", token, { stagePosition: 1 });
  check(early.status === 409 && early.json.error === "STEPS_MISSING", "a stage cannot start before the device check", early.json);
  state = await call("POST /device-check", token);
  check(state.json.step === "STAGE" && state.json.path === "/stage/1", "then stage 1", state.json.path);

  console.log("\nStage 1: the clock is the server's");
  state = await call("POST /hiring/stage/start", token, { stagePosition: 1 });
  const current = state.json.current as { startedAt: string; deadlineAt: string; stage: { activities: Array<{ id: string; type: string }> } };
  const span = Date.parse(current.deadlineAt) - Date.parse(current.startedAt);
  check(span === 750_000, "the deadline is 600 s + 25% = 750 s after the start", span);
  const again = await call("POST /hiring/stage/start", token, { stagePosition: 1 });
  check((again.json.current as { deadlineAt: string }).deadlineAt === current.deadlineAt, "a second start moves nothing");
  const reread = await call("GET /state", token);
  check((reread.json.current as { deadlineAt: string }).deadlineAt === current.deadlineAt, "a reload reads the same deadline");
  const beat = await call("POST /heartbeat", token);
  check(beat.json.deadlineAt === current.deadlineAt, "the heartbeat reports that deadline");
  check((await call("POST /hiring/extra-time", token, { pct: 50 })).json.error === "EXTRA_TIME_LOCKED", "extra time is locked while the stage runs");
  const [video, single, long] = current.stage.activities;
  const outOfOrder = await call("PUT /hiring/response", token, { stagePosition: 1, activityId: single.id, answer: { choiceIds: ["a"] } });
  check(outOfOrder.status === 409 && outOfOrder.json.error === "ACTIVITY_ORDER", "the second question cannot be answered while the first is open", outOfOrder.json);

  console.log("\nA video answer with two takes, uploaded in parts");
  /** The stage the uploads below belong to; moves to 2 with the second stage. */
  let position = 1;
  async function record(activityId: string, kind: "recording" | "file", mime: string, bytes: Uint8Array, name?: string) {
    const opened = await call("POST /hiring/media/init", token, { stagePosition: position, activityId, kind, mime, name, bytes: bytes.byteLength });
    if (opened.status !== 200) return { opened, done: null };
    const ref = opened.json.uploadRef as string;
    await call("PUT /media/part", token, undefined, `?ref=${ref}&part=1`, bytes);
    const done = await call("POST /media/complete", token, { uploadRef: ref, durationMs: kind === "recording" ? 4000 : undefined });
    return { opened, done, ref };
  }
  const take1 = await record(video.id, "recording", "video/webm", new Uint8Array(2048).fill(7));
  const take2 = await record(video.id, "recording", "video/webm", new Uint8Array(4096).fill(9));
  check(take1.done?.json.status === "READY" && take2.done?.json.status === "READY", "both takes complete");
  const third = await call("POST /hiring/media/init", token, { stagePosition: 1, activityId: video.id, kind: "recording", mime: "video/webm" });
  check(third.status === 409 && third.json.error === "TAKES_EXHAUSTED", "a third take is refused by the server's count", third.json);
  const [videoResponse] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, video.id));
  check(videoResponse.mediaAssetId === take2.ref && videoResponse.takeAssetIds.length === 2, "the newest take is the answer", videoResponse);
  const play = await call("GET /hiring/media/play", token, undefined, `?ref=${take2.ref}`);
  check(typeof play.json.src === "string" && (play.json.src as string).length > 0, "the candidate can play their own take back");
  check((await call("POST /hiring/response/commit", token, { stagePosition: 1, activityId: video.id })).status === 200, "the video question closes");

  console.log("\nChoice and long text");
  await call("POST /hiring/response/commit", token, { stagePosition: 1, activityId: single.id, answer: { choiceIds: ["a"] } });
  const [singleResponse] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, single.id));
  check(singleResponse.autoScore === 1, "the right choice scores 1 on the server", singleResponse.autoScore);
  const tooShort = await call("POST /hiring/response/commit", token, { stagePosition: 1, activityId: long.id, answer: { text: "kısa" } });
  check(tooShort.status === 422 && tooShort.json.error === "REQUIRED_MISSING", "a required text under its minimum cannot close", tooShort.json);
  const saved = await call("PUT /hiring/response", token, { stagePosition: 1, activityId: long.id, answer: { text: "Önce kullanıcılarla konuştum, sonra iki seçeneği denedim." } });
  check(saved.json.saved === true, "autosave keeps the draft");
  const closedLong = await call("POST /hiring/response/commit", token, { stagePosition: 1, activityId: long.id });
  check(closedLong.status === 200, "the saved draft closes the question");
  state = await call("POST /hiring/stage/submit", token, { stagePosition: 1 });
  check(state.json.step === "STAGE" && state.json.position === 2, "stage 1 is submitted, stage 2 is next", state.json);
  check((state.json.current as { previous: { closedByClock: boolean } }).previous.closedByClock === false, "and stage 2 says stage 1 ended normally");

  console.log("\nStage 2: a file, then the clock ends it");
  position = 2;
  state = await call("POST /hiring/stage/start", token, { stagePosition: 2 });
  const [file] = (state.json.current as { stage: { activities: Array<{ id: string }> } }).stage.activities;
  const wrong = await call("POST /hiring/media/init", token, { stagePosition: 2, activityId: file.id, kind: "file", mime: "image/png", name: "plan.png", bytes: 100 });
  check(wrong.status === 400 && wrong.json.error === "FILE_TYPE_REJECTED", "a PNG is refused where a PDF is asked", wrong.json);
  const big = await call("POST /hiring/media/init", token, { stagePosition: 2, activityId: file.id, kind: "file", mime: "application/pdf", name: "plan.pdf", bytes: 2 * 1024 * 1024 });
  check(big.status === 400 && big.json.error === "FILE_TOO_LARGE", "a file over 1 MB is refused before upload", big.json);
  const pdf = await record(file.id, "file", "application/pdf", new TextEncoder().encode("%PDF-1.4 plan"), "C:\\Belgeler\\Plan Taslağı.pdf");
  check(pdf.done?.json.status === "READY", "the PDF uploads");
  const [fileResponse] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, file.id));
  check(fileResponse.payload.file?.name === "Plan Taslağı.pdf" && fileResponse.fileAssetIds[0] === pdf.ref, "and is attached under its own name, without the path", fileResponse.payload);
  await call("POST /hiring/response/commit", token, { stagePosition: 2, activityId: file.id });
  await db.execute(sql`update hiring_stage_runs set deadline_at = now() - interval '10 seconds' where attempt_id = (select id from attempts where assessment_id = ${invite.assessmentId}) and order_index = 1`);
  const late = await call("PUT /hiring/response", token, { stagePosition: 2, activityId: (state.json.current as { stage: { activities: Array<{ id: string }> } }).stage.activities[1].id, answer: {} });
  check(late.status === 409 && late.json.error === "STAGE_EXPIRED", "a write after the deadline is refused", late.json);
  const after = await call("GET /state", token);
  check(after.status === 200 && after.json.step === "DONE" && after.json.path === "/done", "the next read closes the stage and the attempt: DONE", after.json);
  const closedLink = await call("GET /state", token);
  check(closedLink.status === 409 && closedLink.json.error === "COMPLETED", "and the link is COMPLETED from then on", closedLink.json);
  const [attempt] = await db.select().from(s.attempts).where(eq(s.attempts.assessmentId, invite.assessmentId));
  const runs = await db.select().from(s.hiringStageRuns).where(eq(s.hiringStageRuns.attemptId, attempt.id));
  const second = runs.find((r) => r.orderIndex === 1)!;
  check(!!attempt.completedAt && second.wasLate && second.completion === "PARTIAL", "stage 2 closed late and PARTIAL (the file counts), the attempt is complete", { completion: second.completion, wasLate: second.wasLate });
  const multiRow = (await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.stageRunId, second.id))).find((r) => r.autoScore !== null);
  check(multiRow?.autoScore === 0, "the unanswered multiple choice scored 0 when the stage closed", multiRow?.autoScore);

  console.log("\nThe survey, once");
  check((await call("POST /hiring/survey", token, { rating: 5, comment: "Akıcıydı." })).json.received === true, "a finished candidate can leave the survey");
  check((await call("POST /hiring/survey", token, { rating: 4 })).json.error === "ALREADY_ANSWERED", "but only once");

  console.log("\nLeak scan over every body the candidate received");
  const all = sent.join("\n");
  for (const visible of ["LEAKVISIBLE_PROMPT", "LEAKVISIBLE_STAGE", "LEAKVISIBLE_CHOICE"]) check(all.includes(visible), `positive control: ${visible} reached the candidate`);
  check(!all.includes("TEAMSECRET"), "no team-only text reached the candidate", all.match(/TEAMSECRET_[A-Z_]+/g));
  for (const id of fixture.competencies) check(!all.includes(id), `competency ${id.slice(0, 8)} never reached the candidate`);
  check(!/"correct"|internalQuestion|expectedBehaviours|redFlags|managerNotes|answerExamples|autoScore|auto_score|scorecard/.test(all), "no team-only field name either");
  check(sent.length > 40, "the scan covered the whole walk", sent.length);

  console.log("\nRequests the team will see");
  const second2 = await createHiringInvitation(owner, { openingId: fixture.openingId, fullName: "Can Demir", email: `can-${Date.now()}@example.com`, locale: "en", deadline: null }, { baseUrl: "https://kademe.test" });
  if (!second2.ok) throw new Error(second2.code);
  const token2 = second2.url.split("/a/")[1];
  check((await call("POST /rights", token2, { kind: "ACCOMMODATION", message: "Altyazı" })).status === 200, "an accommodation request is accepted");
  await call("POST /problem", token2, { area: "LINK", message: "Yeni link" });
  const listed = await listOpeningCandidates(team.orgId, fixture.openingId, { runs: true, blindMode: false });
  const can = listed.find((r) => r.assessmentId === second2.assessmentId);
  check(can?.requests.map((r) => r.kind).sort().join() === "ACCOMMODATION,NEW_LINK", "both requests are on the candidate's row", can?.requests);
  const elif = listed.find((r) => r.assessmentId === invite.assessmentId);
  check(elif?.progress === "COMPLETED" && elif.adapted && elif.stagesDone === 2, "the finished candidate shows complete, adapted, 2/2", elif);
  const masked = await listOpeningCandidates(team.orgId, fixture.openingId, { runs: false, blindMode: true });
  check(masked.every((r) => r.name === null && r.email === null && !r.adapted), "a reviewer under blind mode sees no identity and no adaptation");
  const other = await freshOrganisation();
  check((await listOpeningCandidates(other.orgId, fixture.openingId, { runs: true, blindMode: false })).length === 0, "another organisation sees none of them");

  console.log("\nThe cron closes an abandoned stage");
  await call("POST /consent", token2, { accepted: true });
  await call("POST /device-check", token2);
  await call("POST /hiring/stage/start", token2, { stagePosition: 1 });
  await db.execute(sql`update hiring_stage_runs set deadline_at = now() - interval '1 minute' where attempt_id = (select id from attempts where assessment_id = ${second2.assessmentId})`);
  const swept = await hiringModule.attempts.closeExpired!(new Date(), 50);
  check(swept.closed >= 1, "closeExpired closed the run", swept);
  const [abandoned] = await db
    .select({ completion: s.hiringStageRuns.completion, wasLate: s.hiringStageRuns.wasLate })
    .from(s.hiringStageRuns)
    .innerJoin(s.attempts, eq(s.attempts.id, s.hiringStageRuns.attemptId))
    .where(eq(s.attempts.assessmentId, second2.assessmentId));
  check(abandoned.completion === "EXPIRED" && abandoned.wasLate, "as EXPIRED and late (nothing was written)", abandoned);

  console.log("\nRetention: deleting the person removes every hiring row");
  const [person] = await db.select({ id: s.assessments.candidateId }).from(s.assessments).where(eq(s.assessments.id, second2.assessmentId));
  await db.delete(s.candidates).where(eq(s.candidates.id, person.id));
  const leftovers = await db.execute<{ n: number }>(sql`
    select (select count(*) from hiring_assessments where assessment_id = ${second2.assessmentId})
         + (select count(*) from hiring_assignments where assessment_id = ${second2.assessmentId})
         + (select count(*) from attempts where assessment_id = ${second2.assessmentId})
         + (select count(*) from hiring_stage_runs r join attempts a on a.id = r.attempt_id where a.assessment_id = ${second2.assessmentId}) as n`);
  check(Number(leftovers[0]?.n ?? -1) === 0, "no invitation, assignment, attempt or run is left", leftovers[0]);

  console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add to `package.json` scripts, after `"verify:guard"`:
```json
    "verify:hiring-flow": "tsx scripts/verify-hiring-flow.ts",
    "dev:hiring-link": "tsx scripts/dev-hiring-link.ts",
```

- [ ] **Step 3: Run it to verify it fails while hiring is not live**

```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_flow_check" -c "create database kademe_flow_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm verify:hiring-flow
```
Expected: the invitation checks pass, then `FAIL the landing comes first` (every hiring token is answered 404 while `candidateFlowLive` is false), exit 1.

- [ ] **Step 4: Turn the flow on**

In `src/solutions/hiring/manifest.ts`, set `candidateFlowLive: true,`.

- [ ] **Step 5: Run it again**

```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm verify:hiring-flow
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_flow_check"
```
Expected: every line `ok`, `all checks passed`, exit 0. If a check fails, fix the code it names (never the check), and rerun on a fresh `kademe_flow_check`.

- [ ] **Step 6: The unit tests that pinned "not live"**

In `src/solutions/registry.test.ts`, replace the test `"does not serve hiring candidates until plan 2 turns the flag on"` with (declared replacement):
```ts
  it("serves hiring candidates since plan 2 proved the flow (Task 10)", () => {
    expect(manifestByKind("HIRING")?.candidateFlowLive).toBe(true);
    expect(candidateSolution("HIRING")?.key).toBe("hiring");
    expect(candidateSolution("LANGUAGE_EXAM")?.key).toBe("language-exam");
  });
```

Replace `src/lib/candidate-api.registered-hiring.test.ts` with (its three tests are replaced; declared):
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// The REAL registry and the real hiring module, with hiring live: a HIRING
// invitation is served only when it has hiring terms (serves); otherwise it is
// answered exactly like an unknown token (spec 6). Nothing touches a database.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

const h = vi.hoisted(() => ({ resolveToken: vi.fn(), recordFirstSeen: vi.fn(), terms: false }));
vi.mock("@/lib/candidate-context", () => ({ resolveToken: h.resolveToken, recordFirstSeen: h.recordFirstSeen }));
vi.mock("@/solutions/hiring/server/candidate", () => ({
  loadHiringContext: async () => null,
  hiringServes: async () => h.terms,
  loadHiringState: vi.fn(),
  hiringTitle: vi.fn(),
  stageHeartbeat: vi.fn(),
  runningSegment: vi.fn(),
  attachMedia: vi.fn(),
  closeExpiredStageRuns: vi.fn(),
  salvageHiringUploads: vi.fn(),
}));

import { NextRequest } from "next/server";
import { withCandidate, withSolution } from "@/lib/candidate-api";
import type { CandidateContext } from "@/lib/candidate-context";
import { candidateSolution } from "@/solutions/registry.server";

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

async function snapshot(res: Response) {
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
}

const req = (path: string) => new NextRequest(`http://localhost/api/c/token-of-sufficient-length${path}`);
const params = Promise.resolve({ token: "token-of-sufficient-length" });

beforeEach(() => {
  h.resolveToken.mockReset();
  h.recordFirstSeen.mockReset();
  h.terms = false;
});

describe("hiring live in the real registry", () => {
  it("is registered and live, so the checks below are about serves", () => {
    expect(candidateSolution("HIRING")?.key).toBe("hiring");
  });

  it("answers a HIRING invitation without hiring terms exactly like an unknown token", async () => {
    h.resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    const unknown = await withSolution(req("/state"), params, vi.fn(async () => new Response("handled")));
    h.resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const handler = vi.fn(async () => new Response("handled"));
    const hiring = await withSolution(req("/state"), params, handler);
    expect(hiring.status).toBe(404);
    expect(await snapshot(hiring)).toEqual(await snapshot(unknown));
    expect(handler).not.toHaveBeenCalled();
    expect(h.recordFirstSeen).not.toHaveBeenCalled();
  });

  it("serves a HIRING invitation with hiring terms", async () => {
    h.terms = true;
    h.resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const handler = vi.fn(async () => new Response("handled"));
    expect(await (await withSolution(req("/state"), params, handler)).text()).toBe("handled");
    expect(handler.mock.calls[0][2]).toMatchObject({ dbKind: "HIRING" });
  });

  it("an exam endpoint still answers a HIRING invitation like an unknown token", async () => {
    h.terms = true;
    h.resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    const unknown = await withCandidate(req("/exam/answer"), params, vi.fn(async () => new Response("handled")), { acceptSolution: (k) => k === "LANGUAGE_EXAM" });
    h.resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const handler = vi.fn(async () => new Response("handled"));
    const hiring = await withCandidate(req("/exam/answer"), params, handler, { acceptSolution: (k) => k === "LANGUAGE_EXAM" });
    expect(await snapshot(hiring)).toEqual(await snapshot(unknown));
    expect(handler).not.toHaveBeenCalled();
  });
});
```

In `scripts/verify-solution-guard.ts`:
- Replace `console.log("\nCore endpoints refuse a solution with no live candidate flow");` with `console.log("\nCore endpoints refuse a HIRING invitation without hiring terms");`.
- Right after the `for` loop that follows `console.log("\nExam endpoints refuse a hiring invitation");`, add:
```ts
    console.log("\nHiring endpoints refuse an exam invitation and a HIRING invitation without hiring terms");
    for (const [method, path] of [
      ["POST", "/hiring/stage/start"],
      ["PUT", "/hiring/response"],
      ["POST", "/hiring/media/init"],
      ["POST", "/hiring/survey"],
    ] as const) {
      const unknownRes = await call(method, `/api/c/${"v".repeat(43)}${path}`, {});
      for (const [label, raw] of [["exam", exam.rawToken], ["hiring without terms", token.raw]] as const) {
        const r = await call(method, `/api/c/${raw}${path}`, {});
        if (r.status === 404 && JSON.stringify(r.json) === JSON.stringify(unknownRes.json)) ok(`${label} link, ${method} ${path}: 404, same as unknown`);
        else bad(`${label} link, ${method} ${path}: ${r.status} ${JSON.stringify(r.json)}`);
      }
    }
```

- [ ] **Step 7: A link for browser checks**

`scripts/dev-hiring-link.ts`:
```ts
/**
 * Mints a hiring invitation for a browser check and prints its link. Only on a
 * THROW-AWAY copy (database name ending in _check), because it publishes an
 * opening (frozen rows). Uses the database's first organisation and its first
 * active owner, so the panel login of the copy works too.
 *
 *   docker exec kademe-db psql -U kademe -d postgres -c "create database kademe_ui_check template kademe_platform"
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_ui_check pnpm dev:hiring-link [--kind text|written] [--lang en] [--name "Elif Kaya"]
 */
import "dotenv/config";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
  if (!url.pathname.endsWith("_check")) {
    console.error(`Refusing: ${url.pathname} is not a throw-away *_check database (this publishes an opening).`);
    process.exit(2);
  }
  const { and, asc, eq, isNull } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { buildPublishedOpening } = await import("./hiring-fixture");
  const { createHiringInvitation } = await import("@/solutions/hiring/server/invitations");
  const [org] = await db.select().from(s.organizations).orderBy(asc(s.organizations.createdAt)).limit(1);
  if (!org) throw new Error("no organisation in this database");
  const [owner] = await db
    .select()
    .from(s.users)
    .where(and(eq(s.users.orgId, org.id), eq(s.users.role, "OWNER"), isNull(s.users.disabledAt)))
    .limit(1);
  if (!owner) throw new Error("no active owner in this organisation");
  const kind = arg("kind") === "text" ? "text" : arg("kind") === "written" ? "written" : "full";
  const { openingId } = await buildPublishedOpening({ orgId: org.id, ownerId: owner.id, memberIds: [owner.id], kind });
  const result = await createHiringInvitation(
    { id: owner.id, orgId: org.id },
    { openingId, fullName: arg("name") ?? "Elif Kaya", email: `aday-${Date.now()}@example.com`, locale: arg("lang") === "en" ? "en" : "tr", deadline: null },
    { baseUrl: process.env.VERIFY_BASE_URL ?? "http://localhost:3100" },
  );
  if (!result.ok) throw new Error(result.code);
  console.log(`opening: /hiring/openings/${openingId}`);
  console.log(result.url);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 8: All gates, exam and guard**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
Start the dev server on `kademe_platform` (port 3100, check first), then `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard`, stop it.
Expected: PASS; `verify:exam` only `ok`; `verify:guard` all `ok` (the 31 earlier checks keep their meaning through `serves`, plus 8 new hiring-endpoint lines).

- [ ] **Step 9: Commit**

```bash
git add scripts/hiring-fixture.ts scripts/verify-hiring-flow.ts scripts/dev-hiring-link.ts scripts/verify-solution-guard.ts package.json src/solutions/hiring/manifest.ts src/solutions/registry.test.ts src/lib/candidate-api.registered-hiring.test.ts
git commit -m "Prove the hiring candidate flow end to end and turn it on

verify:hiring-flow drives the real route handlers on a throw-away database:
invite, landing, extra time, consent, device check, a stage clock written
once, write order, two takes and a refused third, choice scoring, required
text, a checked PDF, the clock closing the last stage, the survey, the
requests the team sees, the cron, retention by cascade, and a leak scan
over every body with a positive control. Hiring candidates are now served.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Candidate pages: the renderer, the frame and the landing with consent (HIRING-UX 6.1, 7.2)

**Files:**
- Create: `src/solutions/hiring/candidate/pages.tsx` (+ `pages.test.ts`)
- Create: `src/components/hiring/candidate/frame.tsx`, `help.tsx`, `action-bar.tsx`, `landing.tsx`, `closed.tsx`
- Modify: `src/solutions/hiring/module.ts` (`renderPage`)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringFrame`, `hiringLanding`, `hiringClosed`)
- Create: `src/i18n/hiring-candidate-copy.test.ts`

**Interfaces:**
- Consumes: `loadHiringContext`, `loadHiringState`, `HiringContext` (Task 8); `loadConsentText` (Task 9); `HiringCandidateState` (Task 5); `nextPath` (Task 3); `apiSend` (`@/lib/client/api`); `shortDate` (`@/i18n/dates`); `pickTextLang` (`@/lib/i18n-text`); `candidateSafe`; `CandidateIntl`, `LinkProblem`, `CandidateShell`, `InfoForm` (core components).
- Produces:
  - `renderHiringPage(slot: CandidatePageSlot, input: CandidatePageInput): Promise<ReactNode>` (`src/solutions/hiring/candidate/pages.tsx`): problems, `?lang=`, redirect to the state's page, then the slot's screen. Slots `landing` and `info` render here; `check` (Task 12), `stage` (Task 13), `practice` (Task 14) and `done` (Task 16) render the invalid-link card until their task replaces the case.
  - `<HiringFrame locale orgName token>` (top bar: organisation, language, help; reading frame 1000px); `<Help token />`; `<ActionBar>` (one filled button; sticky at the bottom on phones with the safe-area inset); `<Landing token state consentBody deadline />`; `<ClosedCard contactEmail />`.
  - `hiringModule.candidate.renderPage`.

- [ ] **Step 1: Write the failing tests**

`src/i18n/hiring-candidate-copy.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import tr from "@/i18n/messages/candidate.tr.json";
import en from "@/i18n/messages/candidate.en.json";

/**
 * HIRING-UX 6 and A10: the hiring candidate screens speak to the candidate as
 * "sen", calmly, and never use the words of suspicion or failure.
 */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}
const hiringOf = (dict: Record<string, unknown>) => Object.entries(dict).filter(([name]) => name.startsWith("hiring"));

describe("hiring candidate copy", () => {
  it("has hiring namespaces to check", () => {
    expect(hiringOf(tr).length).toBeGreaterThan(0);
  });

  it.each([
    ["tr", tr, [/uyarı/i, /ihlal/i, /şüpheli/i, /hile/i, /başarısız/i]],
    ["en", en, [/warning/i, /violation/i, /suspicious/i, /cheat/i, /\bfail/i]],
  ] as const)("%s never says warning, violation, suspicious, cheat or fail", (_locale, dict, banned) => {
    for (const [name, namespace] of hiringOf(dict as Record<string, unknown>)) {
      for (const text of strings(namespace)) for (const word of banned) expect(text, `${name}: ${text}`).not.toMatch(word);
    }
  });

  it("speaks to the candidate as sen, never siz", () => {
    const formal = [/(?<!\p{L})siz(?!\p{L})/u, /\p{L}+(?:iniz|ınız|unuz|ünüz)(?!\p{L})/u, /lütfen/iu];
    for (const [name, namespace] of hiringOf(tr)) {
      for (const text of strings(namespace)) for (const pattern of formal) expect(text, `${name}: ${text}`).not.toMatch(pattern);
    }
  });
});
```

`src/solutions/hiring/candidate/pages.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}

const h = vi.hoisted(() => ({
  hctx: null as unknown,
  state: null as unknown,
  setAssessmentLocale: vi.fn(async () => undefined),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));
vi.mock("@/lib/candidate-context", () => ({ setAssessmentLocale: h.setAssessmentLocale }));
vi.mock("../server/candidate", () => ({ loadHiringContext: async () => h.hctx, loadHiringState: async () => h.state }));
vi.mock("../server/consent", () => ({ loadConsentText: async () => ({ id: "ct", body: { tr: "Rıza metni", en: "Consent text" } }) }));
vi.mock("@/components/hiring/candidate/landing", () => ({ Landing: function Landing() {} }));
vi.mock("@/components/hiring/candidate/closed", () => ({ ClosedCard: function ClosedCard() {} }));
vi.mock("@/components/candidate/LinkProblem", () => ({ LinkProblem: function LinkProblem() {} }));

import { Landing } from "@/components/hiring/candidate/landing";
import { ClosedCard } from "@/components/hiring/candidate/closed";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { renderHiringPage } from "./pages";

const ctx = {
  link: { id: "l", status: "NOT_STARTED", expiresAt: new Date("2026-10-19T20:59:59Z"), notBefore: null, firstSeenIp: null },
  assessment: { id: "a", orgId: "o", solution: "HIRING" },
  candidate: { id: "c", fullName: "Elif Kaya", email: "elif@example.com", phone: null, location: null },
  orgName: "Örnek A.Ş.",
  locale: "tr",
  contactEmail: "ik@ornek.test",
  contactName: "Örnek A.Ş.",
  mediaRetentionDays: 180,
  evidenceRetentionDays: 90,
};

function find(node: ReactNode, type: unknown): ReactElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [...(element.type === type ? [element] : []), ...find(element.props?.children, type)];
}

const render = (slot: "landing" | "stage", over: Record<string, unknown> = {}) =>
  renderHiringPage(slot, { token: "tok", resolved: { ok: true, ctx } as never, searchParams: {}, params: {}, ...over }) as Promise<ReactNode>;

beforeEach(() => {
  h.hctx = { ...ctx, hiring: { openingId: "op", versionId: "v", extraTimePct: 0, consentTextId: "ct" } };
  h.state = { step: "CONSENT", position: null, path: "", orgName: "Örnek A.Ş.", internalQuestion: "TEAMSECRET" };
  h.setAssessmentLocale.mockClear();
});

describe("renderHiringPage", () => {
  it("renders the landing with the state through candidateSafe, the consent text and the deadline in the org's zone", async () => {
    const [landing] = find(await render("landing"), Landing);
    const props = landing.props as { token: string; state: Record<string, unknown>; consentBody: string; deadline: string };
    expect(props.token).toBe("tok");
    expect(props.consentBody).toBe("Rıza metni");
    expect(props.deadline).toBe("19 Eki");
    expect(JSON.stringify(props.state)).not.toContain("TEAMSECRET");
  });

  it("sends the candidate to the page their state lives on", async () => {
    h.state = { ...(h.state as object), step: "STAGE", position: 2, path: "/stage/2" };
    await expect(render("landing")).rejects.toMatchObject({ to: "/a/tok/stage/2" });
  });

  it("applies ?lang= once and drops it from the address", async () => {
    await expect(render("landing", { searchParams: { lang: "en" } })).rejects.toMatchObject({ to: "/a/tok" });
    expect(h.setAssessmentLocale).toHaveBeenCalledWith(expect.objectContaining({ hiring: expect.anything() }), "en");
  });

  it("shows an expired link's card, and the closed opening's card", async () => {
    const expired = await render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx } });
    expect((find(expired, LinkProblem)[0].props as { problem: string }).problem).toBe("EXPIRED");
    h.state = { ...(h.state as object), step: "CLOSED" };
    expect(find(await render("landing"), ClosedCard)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/i18n/hiring-candidate-copy.test.ts src/solutions/hiring/candidate/pages.test.ts`
Expected: FAIL (no `hiring*` namespace yet; `./pages` unresolved).

- [ ] **Step 3: Copy**

Add to `candidate.tr.json`:
```json
"hiringFrame": {
  "help": "Yardım",
  "closeHelp": "Kapat",
  "helpTitle": "Sık sorulanlar",
  "faqDropQ": "Bağlantım koparsa ne olur?",
  "faqDropA": "Yazdıkların ve kayıtların saklanır. Aynı linkten kaldığın yerden devam edersin; süre işlemeye devam eder.",
  "faqCameraQ": "Kamera ya da mikrofon açılmıyor.",
  "faqCameraA": "Adres çubuğundaki kamera simgesinden izin ver, sonra sayfayı yenile. Olmazsa aşağıdan bize yaz.",
  "faqPhoneQ": "Telefonla yapabilir miyim?",
  "faqPhoneA": "Evet. Telefonu dik tut ve sessiz bir yer seç.",
  "report": "Sorun bildir",
  "reportPlaceholder": "Ne oldu? Kısaca yaz.",
  "reportSend": "Gönder",
  "reportSending": "Gönderiliyor",
  "reportSent": "Bildirimin iletildi. Genelde aynı gün dönülür.",
  "reportEmpty": "Önce ne olduğunu yaz.",
  "languages": "Dil seçimi"
},
"hiringLanding": {
  "hello": "Merhaba {name}",
  "helloNoName": "Merhaba",
  "purpose": "Bu değerlendirme, seninle tanışmadan önce nasıl düşündüğünü anlamamız için hazırlandı. Kendi zamanında, tek başına yapacaksın.",
  "factStages": "{count} aşama",
  "factMinutes": "Tahmini süre {minutes} dk",
  "factDeadline": "Son tarih {date}",
  "howTitle": "Nasıl işliyor",
  "howCheck": "Cihazını kontrol ediyoruz. Deneme kaydı kimseye gitmez.",
  "howPractice": "Bir ısınma sorusu var; gönderilmez, kimse görmez.",
  "howQuestions": "Sorular sırayla gelir. Her aşamanın süresi, sen başlattığında işlemeye başlar.",
  "howThink": "Video ve ses sorularında önce düşünme süren var.",
  "whoTitle": "Seni kim değerlendirecek",
  "whoPeople": "{count, plural, one {Cevaplarını ekipten bir kişi, aynı sorular ve aynı ölçütlerle değerlendirir.} other {Cevaplarını ekipten # kişi, aynı sorular ve aynı ölçütlerle, birbirinden bağımsız değerlendirir.}}",
  "whoAiRecorded": "Yapay zekâ seni puanlamaz, sıralamaz ya da elemez; yalnızca video ve ses cevaplarını yazıya döker.",
  "whoAi": "Yapay zekâ seni puanlamaz, sıralamaz ya da elemez.",
  "recordedTitle": "Bu değerlendirmede neler kaydediliyor",
  "signalVIDEO_ANSWER": "Video sorularında görüntün ve sesin kaydedilir.",
  "signalAUDIO_ANSWER": "Ses sorularında sesin kaydedilir.",
  "signalTECHNICAL": "Bağlantı ve yükleme sorunları kaydedilir; kopma yaşarsan ekip sana yeniden hak verebilir.",
  "notMonitored": "Ekranın, sekmelerin ve pencerelerin izlenmez.",
  "promise": "Hiçbir kayıt seni otomatik olarak elemez. Cevaplarına bir insan bakar ve sana sormadan aleyhine karar verilmez.",
  "details": "Ayrıntılar",
  "retentionMedia": "Video ve ses cevapların, karar verildikten {days} gün sonra silinir.",
  "retentionRecord": "Başvuru kaydın, son iletişimden {days} gün sonra silinir.",
  "processor": "Video ve ses cevaplarını yazıya dökmek için kayıtlar ElevenLabs'e gönderilir.",
  "needTitle": "İhtiyacın olanlar",
  "needQuiet": "Sessiz bir yer",
  "needCameraMic": "Kamera ve mikrofon",
  "needMic": "Mikrofon",
  "needTime": "Yaklaşık {minutes} dakika kesintisiz zaman",
  "needDevice": "Telefon ya da bilgisayar",
  "adjustTitle": "Bir ihtiyacın mı var?",
  "extraTitle": "Ek süre, kendin seç",
  "extraNone": "Ek süre yok",
  "extra25": "+%25",
  "extra50": "+%50",
  "extraBody": "Neden sorulmaz, onay beklenmez, hemen uygulanır. Değerlendiriciler bunu görmez.",
  "extraSaving": "Kaydediliyor",
  "extraSaved": "Kaydedildi. Sürelerin buna göre uzadı.",
  "extraLocked": "Bir aşama sürerken ek süre değişmez.",
  "otherAdjustment": "Başka bir düzenleme iste",
  "otherBody": "Video yerine yazılı cevap, altyazı ya da farklı bir zaman gibi. Talebin ekibe gider, değerlendirmen bundan etkilenmez.",
  "consentLabel": "Kaydı ve cevaplarımın bu başvuru için değerlendirilmesini kabul ediyorum.",
  "start": "Başlayalım",
  "starting": "Hazırlanıyor",
  "consentRequired": "Başlamak için onay kutusunu işaretle.",
  "resume": "Yarıda bırakırsan aynı linkten kaldığın yerden devam edersin.",
  "rights": "Veri hakların",
  "contact": "Bir sorun olursa: {email}",
  "failed": "Bir sorun oldu. Tekrar dener misin?"
},
"hiringClosed": {
  "title": "Bu pozisyon için değerlendirme kapandı",
  "body": "İlgin için teşekkürler.",
  "contact": "Bir yanlışlık olduğunu düşünüyorsan {email} adresine yazabilirsin."
}
```
and to `candidate.en.json`:
```json
"hiringFrame": {
  "help": "Help",
  "closeHelp": "Close",
  "helpTitle": "Common questions",
  "faqDropQ": "What if my connection drops?",
  "faqDropA": "What you wrote and recorded is kept. The same link brings you back to where you left off; the clock keeps running.",
  "faqCameraQ": "My camera or microphone does not open.",
  "faqCameraA": "Allow it from the camera icon in the address bar, then reload. If that does not help, write to us below.",
  "faqPhoneQ": "Can I do this on my phone?",
  "faqPhoneA": "Yes. Hold the phone upright and find a quiet place.",
  "report": "Report a problem",
  "reportPlaceholder": "What happened? Keep it short.",
  "reportSend": "Send",
  "reportSending": "Sending",
  "reportSent": "Your report was sent. The team usually replies the same day.",
  "reportEmpty": "Write what happened first.",
  "languages": "Language"
},
"hiringLanding": {
  "hello": "Hello {name}",
  "helloNoName": "Hello",
  "purpose": "This assessment helps us understand how you think before we meet. You do it on your own, in your own time.",
  "factStages": "{count, plural, one {# stage} other {# stages}}",
  "factMinutes": "About {minutes} min",
  "factDeadline": "Deadline {date}",
  "howTitle": "How it works",
  "howCheck": "We check your device. The test recording goes nowhere.",
  "howPractice": "There is a warm-up question; it is not sent and nobody sees it.",
  "howQuestions": "Questions come one at a time. Each stage's clock starts when you start that stage.",
  "howThink": "Video and audio questions give you thinking time first.",
  "whoTitle": "Who reviews your answers",
  "whoPeople": "{count, plural, one {One person on the team reviews your answers, with the same questions and criteria.} other {# people on the team review your answers independently, with the same questions and criteria.}}",
  "whoAiRecorded": "AI does not score, rank or reject you; it only transcribes your video and audio answers.",
  "whoAi": "AI does not score, rank or reject you.",
  "recordedTitle": "What this assessment records",
  "signalVIDEO_ANSWER": "Your video answers are recorded with sound.",
  "signalAUDIO_ANSWER": "Your audio answers are recorded.",
  "signalTECHNICAL": "Connection and upload problems are logged, so the team can give you another go if something breaks.",
  "notMonitored": "Your screen, tabs and windows are not monitored.",
  "promise": "Nothing here rejects you automatically. A person looks at your answers, and nothing counts against you without being checked.",
  "details": "Details",
  "retentionMedia": "Your video and audio answers are deleted {days} days after the decision.",
  "retentionRecord": "Your application record is deleted {days} days after the last contact.",
  "processor": "Recordings are sent to ElevenLabs to transcribe your video and audio answers.",
  "needTitle": "What you need",
  "needQuiet": "A quiet place",
  "needCameraMic": "A camera and a microphone",
  "needMic": "A microphone",
  "needTime": "About {minutes} minutes without interruptions",
  "needDevice": "A phone or a computer",
  "adjustTitle": "Need an adjustment?",
  "extraTitle": "Extra time, your choice",
  "extraNone": "No extra time",
  "extra25": "+25%",
  "extra50": "+50%",
  "extraBody": "We won't ask why and nobody has to approve it; it applies at once. Reviewers won't see it.",
  "extraSaving": "Saving",
  "extraSaved": "Saved. Your clocks are longer now.",
  "extraLocked": "Extra time cannot change while a stage is running.",
  "otherAdjustment": "Ask for another adjustment",
  "otherBody": "For example a written answer instead of video, captions or another time. Your request goes to the team and does not affect your assessment.",
  "consentLabel": "I agree to the recording and to my answers being reviewed for this application.",
  "start": "Let's begin",
  "starting": "Getting ready",
  "consentRequired": "Tick the box to begin.",
  "resume": "If you stop halfway, the same link brings you back to where you left off.",
  "rights": "Your data rights",
  "contact": "If something goes wrong: {email}",
  "failed": "Something went wrong. Could you try again?"
},
"hiringClosed": {
  "title": "This role's assessment has closed",
  "body": "Thank you for your interest.",
  "contact": "If you think this is a mistake, write to {email}."
}
```

- [ ] **Step 4: Frame, help, action bar, closed card**

`src/components/hiring/candidate/action-bar.tsx`:
```tsx
/**
 * HIRING-UX 6: the screen's one filled button, with its reason. On a phone it
 * sits in a bar fixed to the bottom (above the safe area); from `sm` up it is
 * part of the page.
 */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-line bg-paper/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur sm:static sm:mx-0 sm:mt-10 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      {children}
    </div>
  );
}
```

`src/components/hiring/candidate/help.tsx`:
```tsx
"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";

/** HIRING-UX 6: "Yardım" in the top bar: three answers and a way to reach a person. */
export function Help({ token }: { token: string }) {
  const t = useT("hiringFrame");
  const panel = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function send() {
    setState("sending");
    await apiSend(token, "/problem", { area: "HELP", message: text.trim() }).catch(() => undefined);
    setState("sent");
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 rounded-lg px-2 text-[14px] text-ink underline decoration-underline underline-offset-4 hover:decoration-ink"
      >
        {open ? t("closeHelp") : t("help")}
      </button>
      {open ? (
        <div id={panel} className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-overlay">
          <h2 className="text-[16px] font-semibold text-ink">{t("helpTitle")}</h2>
          <dl className="space-y-3 text-[14px] leading-[22px]">
            {(["Drop", "Camera", "Phone"] as const).map((k) => (
              <div key={k}>
                <dt className="font-medium text-ink">{t(`faq${k}Q`)}</dt>
                <dd className="text-ink-2">{t(`faq${k}A`)}</dd>
              </div>
            ))}
          </dl>
          {state === "sent" ? (
            <p role="status" className="text-[14px] text-ink">
              {t("reportSent")}
            </p>
          ) : (
            <div className="space-y-2">
              <label htmlFor={`${panel}-text`} className="text-[14px] font-medium text-ink">
                {t("report")}
              </label>
              <Textarea id={`${panel}-text`} rows={3} value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} placeholder={t("reportPlaceholder")} className="text-[16px]" />
              <Button id="help-send" size="sm" disabled={!text.trim() || state === "sending"} disabledReason={t("reportEmpty")} onClick={send}>
                {state === "sending" ? t("reportSending") : t("reportSend")}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
```

`src/components/hiring/candidate/frame.tsx`:
```tsx
import Link from "next/link";
import type { Locale } from "@/i18n/locale";
import { candidateT } from "@/i18n/candidate";
import { cn } from "@/lib/cn";
import { Help } from "./help";

const NAMES: Record<Locale, string> = { tr: "Türkçe", en: "English" };

/**
 * HIRING-UX 6 "Ortak kurallar": the company's name, the language and help on
 * top, one column below (1000px frame). The subtree carries `lang`, so a
 * screen reader and `uppercase` follow the candidate's language.
 */
export function HiringFrame({ locale, orgName, token, children }: { locale: Locale; orgName: string; token: string; children: React.ReactNode }) {
  const t = candidateT(locale);
  return (
    <div lang={locale} className="min-h-dvh bg-paper" style={{ "--card-radius": "12px" } as React.CSSProperties}>
      <header className="flex h-14 items-center justify-between gap-3 border-b border-hairline bg-surface px-4 sm:px-7">
        <span className="truncate text-[14px] font-semibold text-ink">{orgName}</span>
        <span className="flex items-center gap-1">
          <nav aria-label={t("hiringFrame.languages")} className="flex items-center">
            {(["tr", "en"] as const).map((l) =>
              l === locale ? (
                <span key={l} aria-current="true" className="px-2 text-[14px] font-medium text-ink">
                  {NAMES[l]}
                </span>
              ) : (
                <Link key={l} href={`?lang=${l}`} lang={l} className={cn("flex min-h-11 items-center px-2 text-[14px] text-muted underline decoration-underline underline-offset-4 hover:text-ink")}>
                  {NAMES[l]}
                </Link>
              ),
            )}
          </nav>
          <Help token={token} />
        </span>
      </header>
      <main className="mx-auto w-full max-w-[1000px] px-4 sm:px-7">{children}</main>
    </div>
  );
}
```

`src/components/hiring/candidate/closed.tsx`:
```tsx
"use client";

import { useT } from "@/i18n/candidate-client";

/** HIRING-UX 6.14 "Alım kapandı": thanks, and a person to write to. */
export function ClosedCard({ contactEmail }: { contactEmail: string | null }) {
  const t = useT("hiringClosed");
  return (
    <div className="mx-auto max-w-[640px] py-16">
      <h1 className="text-[28px] leading-9 font-semibold text-ink">{t("title")}</h1>
      <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{t("body")}</p>
      {contactEmail ? (
        <p className="mt-6 text-[14px] text-muted">
          {t.rich("contact", { email: contactEmail })}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: The landing**

`src/components/hiring/candidate/landing.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Mic, Video, Wifi } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiSend } from "@/lib/client/api";
import { nextPath } from "@/lib/candidate-routes";
import { pickTextLang } from "@/lib/i18n-text";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { ActionBar } from "./action-bar";

const ICONS = { VIDEO_ANSWER: Video, AUDIO_ANSWER: Mic, TECHNICAL: Wifi } as const;

/**
 * HIRING-UX 6.1: before the first question, the candidate knows what this is,
 * how long it takes, who reviews it and how, exactly what is recorded (A3:
 * nothing more, nothing less), what they need, and that they can choose extra
 * time without a reason. No question is shown here.
 */
export function Landing({ token, state, consentBody, deadline, locale }: { token: string; state: HiringCandidateState; consentBody: string; deadline: string; locale: Locale }) {
  const t = useT("hiringLanding");
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState(state.extraTimePct);
  const [minutes, setMinutes] = useState(state.totalMinutes);
  const [extra, setExtra] = useState<"idle" | "saving" | "saved">("idle");
  const recorded = state.devices.microphone;
  const intro = state.intro.body ? pickTextLang(state.intro.body, locale) : null;

  async function chooseExtra(value: string) {
    const next = Number(value);
    setExtra("saving");
    try {
      const updated = await apiSend<HiringCandidateState>(token, "/hiring/extra-time", { pct: next });
      setPct(updated.extraTimePct);
      setMinutes(updated.totalMinutes);
      setExtra("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
      setExtra("idle");
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<HiringCandidateState>(token, "/consent", { accepted: true });
      router.push(nextPath(token, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
      setBusy(false);
    }
  }

  const steps = [...(recorded ? [t("howCheck")] : []), ...(state.practice ? [t("howPractice")] : []), `${t("howQuestions")}${recorded ? ` ${t("howThink")}` : ""}`];

  return (
    <div className="mx-auto max-w-[640px] pt-10 pb-6 sm:pt-14">
      <p className="text-[14px] text-muted">
        {state.orgName} · {state.positionName}
      </p>
      <h1 className="mt-2 text-[28px] leading-9 font-semibold text-ink">{state.candidateName ? t("hello", { name: state.candidateName }) : t("helloNoName")}</h1>
      <p className="mt-3 text-[16px] leading-[26px] text-ink-2" lang={intro && intro.lang !== locale ? intro.lang : undefined}>
        {intro?.text || t("purpose")}
      </p>

      <ul className="tnum mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[16px] text-ink">
        <li>{t("factStages", { count: state.stages.length })}</li>
        <li>{t("factMinutes", { minutes })}</li>
        <li>{t("factDeadline", { date: deadline })}</li>
      </ul>

      <section className="mt-10">
        <h2 className="text-[20px] leading-7 font-semibold text-ink">{t("howTitle")}</h2>
        <ol className="mt-3 space-y-2 text-[16px] leading-[26px] text-ink-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="tnum font-medium text-ink">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-[20px] leading-7 font-semibold text-ink">{t("whoTitle")}</h2>
        <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{t("whoPeople", { count: state.reviewers })}</p>
        <p className="mt-2 text-[16px] leading-[26px] text-ink-2">{recorded ? t("whoAiRecorded") : t("whoAi")}</p>
      </section>

      <section className="mt-10 rounded-2xl border border-line bg-surface p-card-candidate">
        <h2 className="text-[20px] leading-7 font-semibold text-ink">{t("recordedTitle")}</h2>
        <ul className="mt-4 space-y-3 text-[16px] leading-[26px] text-ink">
          {state.signals.map((signal) => {
            const Icon = ICONS[signal];
            return (
              <li key={signal} className="flex gap-3">
                <Icon className="mt-1 size-5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
                <span>{t(`signal${signal}`)}</span>
              </li>
            );
          })}
          <li className="pl-8 text-ink-2">{t("notMonitored")}</li>
        </ul>
        <p className="mt-4 text-[16px] leading-[26px] font-medium text-ink">{t("promise")}</p>
        <Collapsible className="mt-4">
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-1 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4">
            {t("details")}
            <ChevronDown className="size-4 transition-transform duration-[180ms] ease-soft group-data-[state=open]:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 border-t border-line pt-3 text-[14px] leading-[22px] text-ink-2">
            <p className="whitespace-pre-line">{consentBody}</p>
            <p className="tnum">{t("retentionMedia", { days: state.retention.mediaDays })}</p>
            <p className="tnum">{t("retentionRecord", { days: state.retention.candidateDays })}</p>
            {recorded ? <p>{t("processor")}</p> : null}
          </CollapsibleContent>
        </Collapsible>
      </section>

      <section className="mt-10">
        <h2 className="text-[20px] leading-7 font-semibold text-ink">{t("needTitle")}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[16px] leading-[26px] text-ink-2">
          <li>{t("needQuiet")}</li>
          {state.devices.camera ? <li>{t("needCameraMic")}</li> : state.devices.microphone ? <li>{t("needMic")}</li> : null}
          <li className="tnum">{t("needTime", { minutes })}</li>
          <li>{t("needDevice")}</li>
        </ul>
      </section>

      <Collapsible className="mt-8 rounded-2xl border border-line bg-surface">
        <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between gap-2 px-card-candidate text-left text-[16px] font-medium text-ink">
          {t("adjustTitle")}
          <ChevronDown className="size-4 transition-transform duration-[180ms] ease-soft group-data-[state=open]:rotate-180" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 px-card-candidate pb-card-candidate">
          <fieldset>
            <legend className="text-[16px] font-medium text-ink">{t("extraTitle")}</legend>
            <RadioGroup value={String(pct)} onValueChange={chooseExtra} disabled={state.extraTimeLocked || extra === "saving"} className="mt-3 gap-2" aria-describedby="extra-why">
              {(["0", "25", "50"] as const).map((value) => (
                <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-4 text-[16px] text-ink has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-brand-soft">
                  <RadioGroupItem value={value} />
                  {value === "0" ? t("extraNone") : value === "25" ? t("extra25") : t("extra50")}
                </label>
              ))}
            </RadioGroup>
            <p id="extra-why" className="mt-2 text-[14px] leading-[22px] text-muted" role="status">
              {state.extraTimeLocked ? t("extraLocked") : extra === "saving" ? t("extraSaving") : extra === "saved" ? t("extraSaved") : t("extraBody")}
            </p>
          </fieldset>
          <div>
            <a href={`/a/${encodeURIComponent(token)}/rights?type=accommodation`} className="inline-flex min-h-11 items-center text-[16px] font-medium text-ink underline decoration-underline underline-offset-4">
              {t("otherAdjustment")}
            </a>
            <p className="text-[14px] leading-[22px] text-muted">{t("otherBody")}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <label className="mt-8 flex min-h-11 cursor-pointer items-start gap-3 text-[16px] leading-[26px] text-ink">
        <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-1 size-5" />
        <span>{t("consentLabel")}</span>
      </label>

      <ActionBar>
        <Button id="landing-start" variant="primary" size="lg" className="w-full" disabled={!accepted || busy} disabledReason={t("consentRequired")} onClick={start}>
          {busy ? t("starting") : t("start")}
        </Button>
        {!accepted ? <DisabledReason id="landing-start-why" className="mt-2 text-center">{t("consentRequired")}</DisabledReason> : null}
        {error ? (
          <p role="alert" className="mt-2 text-center text-[14px] text-ink">
            {error}
          </p>
        ) : null}
      </ActionBar>

      <p className="mt-6 text-center text-[14px] leading-[22px] text-muted">
        {t("resume")}{" "}
        <a href={`/a/${encodeURIComponent(token)}/rights`} className="underline decoration-underline underline-offset-4 hover:text-ink">
          {t("rights")}
        </a>
      </p>
      {state.contactEmail ? <p className="mt-1 text-center text-[14px] text-muted">{t("contact", { email: state.contactEmail })}</p> : null}
    </div>
  );
}
```

- [ ] **Step 6: The renderer**

`src/solutions/hiring/candidate/pages.tsx`:
```tsx
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CandidateIntl } from "@/components/candidate/Intl";
import { InfoForm } from "@/components/candidate/InfoForm";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { CandidateShell } from "@/components/candidate/Shell";
import { ClosedCard } from "@/components/hiring/candidate/closed";
import { HiringFrame } from "@/components/hiring/candidate/frame";
import { Landing } from "@/components/hiring/candidate/landing";
import { shortDate } from "@/i18n/dates";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { setAssessmentLocale, type CandidateContext, type LinkProblem as Problem } from "@/lib/candidate-context";
import { candidateSafe } from "@/lib/candidate-safe";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import type { CandidatePageInput, CandidatePageSlot } from "@/solutions/types";
import { loadHiringContext, loadHiringState } from "../server/candidate";
import { loadConsentText } from "../server/consent";

/**
 * Every hiring candidate page (HIRING-UX 4.4, 6). Like the exam's `enter()`:
 * the token is resolved on the server, the language is settled, and the
 * candidate is sent to the one page their state lives on; the client is never
 * asked where it thinks it is. Client components get only candidateSafe values
 * built from the candidate view (Task 5), and dates already formatted in the
 * organisation's zone.
 */

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/** The page a slot lives on, relative to /a/[token]. */
function suffixOf(slot: CandidatePageSlot, params: Record<string, string>): string {
  switch (slot) {
    case "landing":
      return "";
    case "info":
      return "/info";
    case "check":
      return "/check";
    case "practice":
      return "/practice";
    case "stage":
      return `/stage/${params.n ?? ""}`;
    case "done":
      return "/done";
  }
}

function problemPage(token: string, locale: Locale, problem: Problem, ctx?: CandidateContext): ReactNode {
  return (
    <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
      <CandidateShell locale={locale} header={false}>
        <LinkProblem
          token={token}
          locale={locale}
          problem={problem}
          expiresAt={ctx?.link.expiresAt.getTime()}
          notBefore={ctx?.link.notBefore?.getTime()}
          contactEmail={ctx?.contactEmail ?? "destek@kademe.local"}
          contactName={ctx?.contactName ?? null}
        />
      </CandidateShell>
    </CandidateIntl>
  );
}

export async function renderHiringPage(slot: CandidatePageSlot, input: CandidatePageInput): Promise<ReactNode> {
  const { token, resolved, searchParams, params } = input;
  const base = `/a/${encodeURIComponent(token)}`;
  // A finished link is the candidate's way back to /done (and the survey); every other problem has its card.
  if (!resolved.ok && resolved.problem !== "COMPLETED") return problemPage(token, resolved.ctx.locale as Locale, resolved.problem, resolved.ctx);
  const h = await loadHiringContext(resolved.ctx);
  if (!h) return problemPage(token, DEFAULT_LOCALE, "INVALID");

  // `?lang=` is applied once, written to the invitation and taken out of the address.
  const wanted = one(searchParams.lang);
  if (isLocale(wanted)) {
    if (wanted !== h.locale) await setAssessmentLocale(h, wanted);
    redirect(`${base}${suffixOf(slot, params)}`);
  }

  const state = await loadHiringState(h);
  const practiceAllowed = state.step === "STAGE" && state.position === 1 && !state.current?.startedAt && state.practice;
  if (slot === "practice" ? !practiceAllowed : state.path !== suffixOf(slot, params)) redirect(`${base}${state.path}`);

  const locale = h.locale as Locale;
  const safe = candidateSafe(state);
  const frame = (children: ReactNode) => (
    <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
      <HiringFrame locale={locale} orgName={state.orgName} token={token}>
        {children}
      </HiringFrame>
    </CandidateIntl>
  );

  switch (slot) {
    case "landing": {
      if (state.step === "CLOSED") return frame(<ClosedCard contactEmail={state.contactEmail} />);
      const consent = await loadConsentText(h.assessment.orgId, h.hiring.consentTextId);
      return frame(<Landing token={token} state={safe} consentBody={consent.body[locale] || consent.body.tr} deadline={shortDate(h.link.expiresAt, locale)} locale={locale} />);
    }
    case "info":
      return frame(
        <InfoForm
          token={token}
          initial={{ fullName: h.candidate.fullName ?? "", email: h.candidate.email ?? "", phone: h.candidate.phone ?? "", location: h.candidate.location ?? "" }}
        />,
      );
    // Replaced by Tasks 12 (check), 13 (stage), 14 (practice) and 16 (done).
    case "check":
    case "stage":
    case "practice":
    case "done":
      return problemPage(token, locale, "INVALID");
  }
}
```

- [ ] **Step 7: The module renders hiring pages**

In `src/solutions/hiring/module.ts`, add inside `candidate: { ... }` after `consentText`:
```ts
    async renderPage(slot, input) {
      // Loaded on demand: the candidate screens are not needed by any endpoint.
      const { renderHiringPage } = await import("./candidate/pages");
      return renderHiringPage(slot, input);
    },
```

- [ ] **Step 8: Run the tests and the gates**

```bash
pnpm exec vitest run src/i18n/hiring-candidate-copy.test.ts src/solutions/hiring/candidate/pages.test.ts src/i18n/messages.test.ts src/solutions/boundary.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS.

- [ ] **Step 9: Browser check (Claude in Chrome)**

Stop any dev server this session runs. Then:
```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_ui_check" -c "create database kademe_ui_check template kademe_platform"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_ui_check pnpm dev:hiring-link
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_ui_check pnpm dev --port 3100   # separate shell
```
Open the printed link. Check, and write down what you saw: "Merhaba Elif Kaya", organisation and position; three facts (2 aşama, minutes, the deadline as a day in Turkish); "Nasıl işliyor" with the device check, the warm-up and the think-time sentence; "Cevaplarını ekipten bir kişi..." (the fixture's panel is the owner alone); the "Ne kaydediliyor" card with exactly three rows (video, audio, technical) plus "Ekranın, sekmelerin ve pencerelerin izlenmez." and the promise; "Ayrıntılar" opens the hiring consent text (not the exam's camera and full-screen text) and the retention numbers; "Bir ihtiyacın mı var?" opens, +%25 saves ("Kaydedildi") and the minutes grow; "Başka bir düzenleme iste" leads to `/rights?type=accommodation` with that option selected (go back); "Başlayalım" is disabled with its reason until the box is ticked; one filled button on the screen; "English" switches every string and the address loses `?lang`. Resize to 390px wide (or check in the device toolbar): the button sits in a bar at the bottom. Press "Başlayalım": the address becomes `/check`, which shows the invalid-link card until Task 12 (expected). Stop the server; keep `kademe_ui_check` only if Task 12 follows right away in the same session, else drop it.

- [ ] **Step 10: Commit**

```bash
git add src/solutions/hiring/candidate/pages.tsx src/solutions/hiring/candidate/pages.test.ts src/components/hiring/candidate/frame.tsx src/components/hiring/candidate/help.tsx src/components/hiring/candidate/action-bar.tsx src/components/hiring/candidate/landing.tsx src/components/hiring/candidate/closed.tsx src/solutions/hiring/module.ts src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json src/i18n/hiring-candidate-copy.test.ts
git commit -m "Show hiring candidates their landing and consent

The hiring renderer resolves the token, settles the language and sends the
candidate to the page their state lives on. The landing says what the
assessment is, how long it takes, who reviews it, exactly what is recorded
(no monitoring in this plan), what is needed, and offers extra time without
a reason; consent is recorded against the invitation's frozen text.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Details and device check (HIRING-UX 6.2, 6.3)

**Files:**
- Create: `src/components/hiring/candidate/device-rows.ts` (+ `device-rows.test.ts`), `src/components/hiring/candidate/streams.ts` (+ `streams.test.ts`), `src/components/hiring/candidate/device-check.tsx`
- Modify: `src/solutions/hiring/candidate/pages.tsx` (the `check` case)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringCheck`)

**Interfaces:**
- Consumes: Task 11 (`renderHiringPage`, `HiringFrame`, `ActionBar`); core `/device-check`, `/bandwidth`, `/problem`; `pickRecorderMime` (`@/lib/client/recorder`); `nextPath`.
- Produces:
  - `device-rows.ts`: `type Permission = "idle" | "asking" | "granted" | "denied"`, `type Trial = "none" | "recording" | "ready" | "played"`, `type RowId = "camera" | "microphone" | "trial" | "connection"`, `type RowState = "active" | "done" | "waiting" | "info"`, `deviceRows(input: { camera: boolean; permission: Permission; heard: boolean; trial: Trial }): Array<{ id: RowId; state: RowState }>`, `type Blocker = "permission" | "permissionMic" | "sound" | "trialNone" | "trialRecording" | "trialListen"`, `deviceBlocker(input: same): Blocker | null`, `type FixKey = "chrome" | "safariMac" | "ios" | "android" | "firefox" | "other"`, `fixKeyFor(userAgent: string): FixKey`.
  - `streams.ts`: `trackStream(stream: MediaStream): MediaStream`, `stopAllStreams(): number` (how many tracks it stopped; Task 16 says "Kamera ve mikrofon kapatıldı" from it).
  - `<DeviceCheck token camera practice />` (client).

- [ ] **Step 1: Write the failing tests**

`src/components/hiring/candidate/device-rows.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { deviceBlocker, deviceRows, fixKeyFor } from "./device-rows";

const base = { camera: true, permission: "idle" as const, heard: false, trial: "none" as const };

describe("the device check rows (HIRING-UX 6.3)", () => {
  it("opens one row at a time: camera, microphone, trial; connection is information only", () => {
    expect(deviceRows(base)).toEqual([
      { id: "camera", state: "active" },
      { id: "microphone", state: "waiting" },
      { id: "trial", state: "waiting" },
      { id: "connection", state: "info" },
    ]);
    expect(deviceRows({ ...base, permission: "granted" }).map((r) => r.state)).toEqual(["done", "active", "waiting", "info"]);
    expect(deviceRows({ ...base, permission: "granted", heard: true }).map((r) => r.state)).toEqual(["done", "done", "active", "info"]);
    expect(deviceRows({ ...base, permission: "granted", heard: true, trial: "played" }).map((r) => r.state)).toEqual(["done", "done", "done", "info"]);
  });

  it("shows no camera row for an audio-only assessment", () => {
    expect(deviceRows({ ...base, camera: false }).map((r) => r.id)).toEqual(["microphone", "trial", "connection"]);
    expect(deviceRows({ ...base, camera: false })[0].state).toBe("active");
  });

  it("names the one thing the button waits for, and never the connection", () => {
    expect(deviceBlocker(base)).toBe("permission");
    expect(deviceBlocker({ ...base, camera: false })).toBe("permissionMic");
    expect(deviceBlocker({ ...base, permission: "granted" })).toBe("sound");
    expect(deviceBlocker({ ...base, permission: "granted", heard: true })).toBe("trialNone");
    expect(deviceBlocker({ ...base, permission: "granted", heard: true, trial: "recording" })).toBe("trialRecording");
    expect(deviceBlocker({ ...base, permission: "granted", heard: true, trial: "ready" })).toBe("trialListen");
    expect(deviceBlocker({ ...base, permission: "granted", heard: true, trial: "played" })).toBeNull();
  });

  it("gives step-by-step help for the browser in hand", () => {
    expect(fixKeyFor("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36")).toBe("chrome");
    expect(fixKeyFor("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15")).toBe("safariMac");
    expect(fixKeyFor("Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1")).toBe("ios");
    expect(fixKeyFor("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36")).toBe("android");
    expect(fixKeyFor("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0")).toBe("firefox");
    expect(fixKeyFor("curl/8")).toBe("other");
  });
});
```

`src/components/hiring/candidate/streams.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { stopAllStreams, trackStream } from "./streams";

const fakeStream = () => {
  const tracks = [{ stopped: false, readyState: "live", stop() { this.stopped = true; this.readyState = "ended"; } }, { stopped: false, readyState: "live", stop() { this.stopped = true; this.readyState = "ended"; } }];
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks };
};

describe("streams the hiring screens opened", () => {
  it("stops every live track they opened, once, and says how many", () => {
    const a = fakeStream();
    const b = fakeStream();
    trackStream(a.stream);
    trackStream(b.stream);
    expect(stopAllStreams()).toBe(4);
    expect([...a.tracks, ...b.tracks].every((t) => t.stopped)).toBe(true);
    expect(stopAllStreams()).toBe(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/components/hiring/candidate/device-rows.test.ts src/components/hiring/candidate/streams.test.ts`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: The rules and the stream registry**

`src/components/hiring/candidate/device-rows.ts`:
```ts
/**
 * HIRING-UX 6.3 as data: the active row opens, finished rows fold into one
 * "Hazır" line, the connection row informs and never blocks, and the button's
 * reason names the one thing it waits for.
 */
export type Permission = "idle" | "asking" | "granted" | "denied";
export type Trial = "none" | "recording" | "ready" | "played";
export type RowId = "camera" | "microphone" | "trial" | "connection";
export type RowState = "active" | "done" | "waiting" | "info";
type Input = { camera: boolean; permission: Permission; heard: boolean; trial: Trial };

export function deviceRows(input: Input): Array<{ id: RowId; state: RowState }> {
  const granted = input.permission === "granted";
  const rows: Array<{ id: RowId; state: RowState }> = [];
  if (input.camera) rows.push({ id: "camera", state: granted ? "done" : "active" });
  rows.push({ id: "microphone", state: input.heard && granted ? "done" : granted || !input.camera ? "active" : "waiting" });
  rows.push({ id: "trial", state: input.trial === "played" ? "done" : granted && input.heard ? "active" : "waiting" });
  rows.push({ id: "connection", state: "info" });
  return rows;
}

export type Blocker = "permission" | "permissionMic" | "sound" | "trialNone" | "trialRecording" | "trialListen";

export function deviceBlocker(input: Input): Blocker | null {
  if (input.permission !== "granted") return input.camera ? "permission" : "permissionMic";
  if (!input.heard) return "sound";
  if (input.trial === "none") return "trialNone";
  if (input.trial === "recording") return "trialRecording";
  if (input.trial === "ready") return "trialListen";
  return null;
}

export type FixKey = "chrome" | "safariMac" | "ios" | "android" | "firefox" | "other";

/** Which "Nasıl düzeltirim?" steps to show. Order matters: iOS and Android browsers also say "Safari". */
export function fixKeyFor(userAgent: string): FixKey {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Firefox\//i.test(userAgent)) return "firefox";
  if (/Chrome\/|Edg\//i.test(userAgent)) return "chrome";
  if (/Safari\//i.test(userAgent) && /Macintosh/i.test(userAgent)) return "safariMac";
  return "other";
}
```

`src/components/hiring/candidate/streams.ts`:
```ts
/**
 * Every camera or microphone stream a hiring screen opens is registered here,
 * so the finish screen can stop what is still live and truthfully say "Kamera
 * ve mikrofon kapatıldı" (HIRING-UX 6.13). Module state: one tab, one set.
 */
const open = new Set<MediaStream>();

export function trackStream(stream: MediaStream): MediaStream {
  open.add(stream);
  return stream;
}

export function stopAllStreams(): number {
  let stopped = 0;
  for (const stream of open) {
    for (const track of stream.getTracks()) {
      if (track.readyState !== "ended") {
        track.stop();
        stopped += 1;
      }
    }
  }
  open.clear();
  return stopped;
}
```

- [ ] **Step 4: Copy**

Add to `candidate.tr.json`:
```json
"hiringCheck": {
  "title": "Önce cihazını birlikte kontrol edelim",
  "body": "Bu adımı geçmeden soru gelmiyor. Böylece cevap verirken teknik bir sürprizle karşılaşmazsın.",
  "rowcamera": "Kamera",
  "rowmicrophone": "Mikrofon",
  "rowtrial": "Deneme kaydı",
  "rowconnection": "Bağlantı",
  "ready": "Hazır",
  "waiting": "Sırada",
  "cameraAsk": "Tarayıcın izin isteyecek. İzin verince görüntün burada görünür.",
  "micAsk": "Tarayıcın mikrofon için izin isteyecek.",
  "cameraPreview": "Önizleme · kayıt yapılmıyor",
  "openDevices": "Kamerayı ve mikrofonu aç",
  "openMic": "Mikrofonu aç",
  "micHint": "Normal sesinle birkaç kelime söyle.",
  "micHeard": "Sesin geliyor",
  "micLevel": "Ses seviyesi",
  "trialBody": "5 saniyelik bir deneme kaydı yap ve dinle. İstediğin kadar tekrar edebilirsin. Bu kayıt hiçbir yere gönderilmez.",
  "trialRecord": "Deneme kaydı yap",
  "trialAgain": "Tekrar kaydet",
  "trialRecording": "Kaydediliyor, 5 saniye",
  "trialListen": "Şimdi kaydını dinle.",
  "connMeasuring": "Ölçülüyor",
  "connOk": "{mbps} Mbps yükleme · yeterli",
  "connLow": "{mbps} Mbps yükleme · düşük. Mümkünse kablosuz ağa yaklaş; kayıtlar yine yüklenir, biraz geç.",
  "connUnknown": "Ölçülemedi. Yine de devam edebilirsin.",
  "deniedTitle": "İzin verilmedi",
  "deniedOther": "Kamera ya da mikrofona ulaşılamadı. Başka bir uygulama kullanıyor olabilir.",
  "howToFix": "Nasıl düzeltirim?",
  "fixchrome": "Adres çubuğunun solundaki simgeye tıkla, Kamera ve Mikrofon için İzin ver'i seç, sonra sayfayı yenile.",
  "fixsafariMac": "Safari menüsünden Bu Web Sitesi İçin Ayarlar'ı aç, Kamera ve Mikrofon için İzin Ver'i seç, sonra sayfayı yenile.",
  "fixios": "Ayarlar > Safari > Kamera ve Mikrofon'da İzin Ver ya da Sor'u seç, sonra bu sayfaya dönüp yenile.",
  "fixandroid": "Adres çubuğundaki kilit simgesine dokun, İzinler'de Kamera ve Mikrofon'a izin ver, sonra sayfayı yenile.",
  "fixfirefox": "Adres çubuğundaki kamera simgesine tıkla, engeli kaldır, sonra sayfayı yenile.",
  "fixother": "Tarayıcının ayarlarında bu siteye kamera ve mikrofon izni ver, sonra sayfayı yenile.",
  "report": "Sorun bildir",
  "reportSent": "Bildirimin iletildi. Genelde aynı gün dönülür.",
  "reportMessage": "Cihaz kontrolünde kamera ya da mikrofon açılmadı.",
  "toPractice": "Hazırım, ısınma sorusuna geç",
  "toStage": "Hazırım, ilk aşamaya geç",
  "going": "Hazırlanıyor",
  "blockpermission": "Önce kameraya ve mikrofona izin ver.",
  "blockpermissionMic": "Önce mikrofona izin ver.",
  "blocksound": "Sesini duymayı bekliyoruz. Birkaç kelime söyle.",
  "blocktrialNone": "Önce 5 saniyelik deneme kaydını yap.",
  "blocktrialRecording": "Kayıt sürüyor, birkaç saniye.",
  "blocktrialListen": "Deneme kaydını dinle, sonra ilerleyelim.",
  "failed": "Bir sorun oldu. Tekrar dener misin?"
}
```
and to `candidate.en.json`:
```json
"hiringCheck": {
  "title": "Let's check your device first",
  "body": "No question comes before this step, so nothing technical surprises you while you answer.",
  "rowcamera": "Camera",
  "rowmicrophone": "Microphone",
  "rowtrial": "Test recording",
  "rowconnection": "Connection",
  "ready": "Ready",
  "waiting": "Next",
  "cameraAsk": "Your browser will ask for permission. Once you allow it, you see yourself here.",
  "micAsk": "Your browser will ask for permission to use the microphone.",
  "cameraPreview": "Preview · not recording",
  "openDevices": "Turn on camera and microphone",
  "openMic": "Turn on the microphone",
  "micHint": "Say a few words in your normal voice.",
  "micHeard": "We can hear you",
  "micLevel": "Sound level",
  "trialBody": "Make a 5 second test recording and play it back. Repeat as often as you like. This recording is not sent anywhere.",
  "trialRecord": "Make a test recording",
  "trialAgain": "Record again",
  "trialRecording": "Recording, 5 seconds",
  "trialListen": "Now play it back.",
  "connMeasuring": "Measuring",
  "connOk": "{mbps} Mbps upload · enough",
  "connLow": "{mbps} Mbps upload · low. Move closer to the Wi-Fi if you can; recordings still upload, a little later.",
  "connUnknown": "Could not measure it. You can still go on.",
  "deniedTitle": "Permission was not given",
  "deniedOther": "We could not reach the camera or microphone. Another app may be using it.",
  "howToFix": "How do I fix this?",
  "fixchrome": "Click the icon left of the address bar, choose Allow for Camera and Microphone, then reload the page.",
  "fixsafariMac": "In the Safari menu open Settings for This Website, choose Allow for Camera and Microphone, then reload.",
  "fixios": "In Settings > Safari > Camera and Microphone choose Allow or Ask, then come back and reload.",
  "fixandroid": "Tap the lock icon in the address bar, allow Camera and Microphone under Permissions, then reload.",
  "fixfirefox": "Click the camera icon in the address bar, remove the block, then reload.",
  "fixother": "Allow camera and microphone for this site in your browser settings, then reload.",
  "report": "Report a problem",
  "reportSent": "Your report was sent. The team usually replies the same day.",
  "reportMessage": "Camera or microphone did not open during the device check.",
  "toPractice": "I'm ready, go to the warm-up",
  "toStage": "I'm ready, go to the first stage",
  "going": "Getting ready",
  "blockpermission": "Allow the camera and microphone first.",
  "blockpermissionMic": "Allow the microphone first.",
  "blocksound": "We are waiting to hear you. Say a few words.",
  "blocktrialNone": "Make the 5 second test recording first.",
  "blocktrialRecording": "Recording, a few seconds.",
  "blocktrialListen": "Play the test recording back, then we go on.",
  "failed": "Something went wrong. Could you try again?"
}
```

- [ ] **Step 5: The device check**

`src/components/hiring/candidate/device-check.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { apiSend, candidateApiBase } from "@/lib/client/api";
import { pickRecorderMime } from "@/lib/client/recorder";
import { nextPath } from "@/lib/candidate-routes";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { ActionBar } from "./action-bar";
import { deviceBlocker, deviceRows, fixKeyFor, type Permission, type RowId, type Trial } from "./device-rows";
import { trackStream } from "./streams";

const TRIAL_MS = 5000;
const PROBE_BYTES = 512 * 1024;

type Bandwidth = { state: "measuring" | "ok" | "low" | "unknown"; mbps?: string };

/**
 * HIRING-UX 6.3: camera (if a video question exists), microphone, a 5 second
 * trial the candidate plays back (kept in this tab only, never sent), and the
 * connection as information. One row is open at a time; finished rows fold
 * into "Hazır". Nothing here is a proctoring check (plan 2 has none).
 */
export function DeviceCheck({ token, camera, practice }: { token: string; camera: boolean; practice: boolean }) {
  const t = useT("hiringCheck");
  const router = useRouter();
  const preview = useRef<HTMLVideoElement | null>(null);
  const playback = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const trialUrl = useRef<string | null>(null);
  const [permission, setPermission] = useState<Permission>("idle");
  const [denied, setDenied] = useState<"notAllowed" | "other" | null>(null);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const [trial, setTrial] = useState<Trial>("none");
  const [src, setSrc] = useState<string | null>(null);
  const [bandwidth, setBandwidth] = useState<Bandwidth>({ state: "measuring" });
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fix, setFix] = useState<ReturnType<typeof fixKeyFor>>("other");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFix(fixKeyFor(navigator.userAgent));
    let cancelled = false;
    (async () => {
      try {
        const payload = new Uint8Array(PROBE_BYTES);
        for (let offset = 0; offset < payload.length; offset += 65_536) crypto.getRandomValues(payload.subarray(offset, offset + 65_536));
        const started = performance.now();
        const res = await fetch(`${candidateApiBase(token)}/bandwidth`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: payload });
        if (!res.ok) throw new Error(String(res.status));
        const mbps = (PROBE_BYTES * 8) / ((performance.now() - started) / 1000) / 1_000_000;
        if (!cancelled) setBandwidth({ state: mbps >= 2 ? "ok" : "low", mbps: mbps >= 10 ? String(Math.round(mbps)) : mbps.toFixed(1) });
      } catch {
        if (!cancelled) setBandwidth({ state: "unknown" });
      }
    })();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
      void audio.current?.close().catch(() => undefined);
      if (trialUrl.current) URL.revokeObjectURL(trialUrl.current);
    };
  }, [token]);

  async function open() {
    setPermission("asking");
    setDenied(null);
    try {
      const media = trackStream(await navigator.mediaDevices.getUserMedia(camera ? { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } } : { audio: true }));
      stream.current = media;
      setPermission("granted");
      if (preview.current && camera) {
        preview.current.srcObject = media;
        void preview.current.play().catch(() => undefined);
      }
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audio.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const measure = () => {
        if (ctx.state === "closed") return;
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const sample of data) peak = Math.max(peak, Math.abs(sample - 128) / 128);
        setLevel(peak);
        if (peak > 0.06) setHeard(true);
        requestAnimationFrame(measure);
      };
      measure();
    } catch (err) {
      setPermission("denied");
      setDenied(err instanceof Error && err.name === "NotAllowedError" ? "notAllowed" : "other");
    }
  }

  function record() {
    const media = stream.current;
    if (!media) return;
    const mime = pickRecorderMime(camera ? "video" : "audio");
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      if (trialUrl.current) URL.revokeObjectURL(trialUrl.current);
      trialUrl.current = URL.createObjectURL(new Blob(chunks, { type: mime || (camera ? "video/webm" : "audio/webm") }));
      setSrc(trialUrl.current);
      setTrial("ready");
    };
    recorder.start();
    setTrial("recording");
    window.setTimeout(() => recorder.state === "recording" && recorder.stop(), TRIAL_MS);
  }

  async function report() {
    await apiSend(token, "/problem", { area: "DEVICE_CHECK", message: t("reportMessage") }).catch(() => undefined);
    setReported(true);
  }

  async function proceed() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<HiringCandidateState>(token, "/device-check", {});
      stream.current?.getTracks().forEach((track) => track.stop());
      router.push(practice ? `/a/${encodeURIComponent(token)}/practice` : nextPath(token, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
      setBusy(false);
    }
  }

  const input = { camera, permission, heard, trial };
  const rows = deviceRows(input);
  const blocker = deviceBlocker(input);
  const label = (id: RowId) => t(`row${id}`);

  function body(id: RowId) {
    if (id === "camera" || (id === "microphone" && !camera && permission !== "granted")) {
      return (
        <div className="space-y-3">
          {camera ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-canvas">
              <video ref={preview} muted playsInline className="size-full object-cover" />
              <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-3 py-1 text-[13px] text-ink">{t("cameraPreview")}</span>
            </div>
          ) : null}
          <p className="text-[16px] leading-[26px] text-ink-2">{camera ? t("cameraAsk") : t("micAsk")}</p>
          {permission === "denied" ? (
            <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
              <p className="text-[16px] font-medium text-ink">{denied === "notAllowed" ? t("deniedTitle") : t("deniedOther")}</p>
              <details>
                <summary className="min-h-11 cursor-pointer py-2 text-[16px] text-ink underline decoration-underline underline-offset-4">{t("howToFix")}</summary>
                <p className="text-[16px] leading-[26px] text-ink-2">{t(`fix${fix}`)}</p>
              </details>
              {reported ? (
                <p role="status" className="text-[14px] text-ink">
                  {t("reportSent")}
                </p>
              ) : (
                <Button size="sm" onClick={report}>
                  {t("report")}
                </Button>
              )}
            </div>
          ) : (
            <Button onClick={open} disabled={permission === "asking"} disabledReason={camera ? t("cameraAsk") : t("micAsk")}>
              {camera ? t("openDevices") : t("openMic")}
            </Button>
          )}
        </div>
      );
    }
    if (id === "microphone") {
      return (
        <div className="space-y-2">
          <p className="text-[16px] leading-[26px] text-ink-2">{heard ? t("micHeard") : t("micHint")}</p>
          <div role="meter" aria-label={t("micLevel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} className="h-2 w-full overflow-hidden rounded-full bg-hairline">
            <div className="h-2 rounded-full bg-ink-3 transition-[width] duration-100" style={{ width: `${Math.min(100, Math.round(level * 250))}%` }} />
          </div>
        </div>
      );
    }
    if (id === "trial") {
      return (
        <div className="space-y-3">
          <p className="text-[16px] leading-[26px] text-ink-2">{t("trialBody")}</p>
          <Button onClick={record} disabled={trial === "recording"} disabledReason={t("trialRecording")}>
            {trial === "recording" ? t("trialRecording") : trial === "none" ? t("trialRecord") : t("trialAgain")}
          </Button>
          {src ? (
            <div className="space-y-2">
              {trial === "ready" ? <p className="text-[14px] text-muted">{t("trialListen")}</p> : null}
              <video ref={playback} src={src} controls playsInline onPlay={() => setTrial("played")} className={cn("w-full rounded-xl bg-canvas", camera ? "aspect-video" : "h-12")} />
            </div>
          ) : null}
        </div>
      );
    }
    return (
      <p className="tnum text-[16px] leading-[26px] text-ink-2">
        {bandwidth.state === "measuring" ? t("connMeasuring") : bandwidth.state === "unknown" ? t("connUnknown") : bandwidth.state === "ok" ? t("connOk", { mbps: bandwidth.mbps! }) : t("connLow", { mbps: bandwidth.mbps! })}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] pt-10 pb-6 sm:pt-14">
      <h1 className="text-[28px] leading-9 font-semibold text-ink">{t("title")}</h1>
      <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{t("body")}</p>
      <ol className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map((row) => (
          <li key={row.id} className="p-card-candidate">
            <div className="flex items-center justify-between gap-4">
              <h2 className={cn("text-[18px] leading-7", row.state === "active" ? "font-semibold text-ink" : "text-ink")}>{label(row.id)}</h2>
              {row.state === "done" ? (
                <span className="flex items-center gap-1 text-[14px] text-muted">
                  <Check className="size-4" strokeWidth={2} aria-hidden />
                  {t("ready")}
                </span>
              ) : row.state === "waiting" ? (
                <span className="text-[14px] text-muted">{t("waiting")}</span>
              ) : null}
            </div>
            {/* The camera stays mounted once granted so the preview keeps its stream. */}
            {row.state === "active" || row.state === "info" || (row.id === "camera" && permission === "granted") ? <div className={cn("mt-3", row.state === "done" && "hidden")}>{body(row.id)}</div> : null}
          </li>
        ))}
      </ol>
      <ActionBar>
        <Button id="check-next" variant="primary" size="lg" className="w-full" disabled={blocker !== null || busy} disabledReason={blocker ? t(`block${blocker}`) : undefined} onClick={proceed}>
          {busy ? t("going") : practice ? t("toPractice") : t("toStage")}
        </Button>
        {blocker ? <DisabledReason id="check-next-why" className="mt-2 text-center">{t(`block${blocker}`)}</DisabledReason> : null}
        {error ? (
          <p role="alert" className="mt-2 text-center text-[14px] text-ink">
            {error}
          </p>
        ) : null}
      </ActionBar>
    </div>
  );
}
```

- [ ] **Step 6: The page**

In `src/solutions/hiring/candidate/pages.tsx`, import `DeviceCheck` from `@/components/hiring/candidate/device-check`, take `"check"` out of the placeholder list, and add:
```tsx
    case "check":
      return frame(<DeviceCheck token={token} camera={state.devices.camera} practice={state.practice} />);
```

- [ ] **Step 7: Run the tests and the gates**

```bash
pnpm exec vitest run src/components/hiring/candidate src/i18n
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS.

- [ ] **Step 8: Browser check (Claude in Chrome)**

On `kademe_ui_check` (Task 11 Step 9 recipe; mint a new link with `pnpm dev:hiring-link`, dev server on 3100):
1. Details (6.2): before opening the link, run `docker exec kademe-db psql -U kademe -d kademe_ui_check -c "update candidates set email = null where full_name = 'Elif Kaya' and email like 'aday-%'"`; open the link, tick, "Başlayalım": the address is `/info`, "Seni doğru kaydedelim" with the name filled and e-mail empty; the button's reason says the e-mail is missing; fill it, "Devam et": `/check`.
2. Device check: rows Kamera (open), Mikrofon (Sırada), Deneme kaydı (Sırada), Bağlantı (a number or "Ölçülemedi"); "Hazırım, ısınma sorusuna geç" disabled with "Önce kameraya ve mikrofona izin ver." Press "Kamerayı ve mikrofonu aç". In the automation tab the camera usually cannot open: confirm "İzin verilmedi" or "Kamera ya da mikrofona ulaşılamadı", "Nasıl düzeltirim?" opens Chrome's steps, "Sorun bildir" shows "Bildirimin iletildi" (and a `STUDENT_PROBLEM` outbox row exists). If the camera does open, walk the rows to "Hazır" and the button enables.
3. With `--kind text`: a new link goes from consent straight to `/stage/1` (the device check is skipped; the stage page still shows the placeholder until Task 13).
Write "camera, microphone and trial playback: doğrulanmadı, gerçek cihazda kullanıcıyla" unless they really ran. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add src/components/hiring/candidate/device-rows.ts src/components/hiring/candidate/device-rows.test.ts src/components/hiring/candidate/streams.ts src/components/hiring/candidate/streams.test.ts src/components/hiring/candidate/device-check.tsx src/solutions/hiring/candidate/pages.tsx src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Add the hiring device check

Camera when a video question exists, microphone with a level, a 5 second
trial played back in the tab and never sent, and the connection as advice.
One row is open at a time, finished rows fold into Hazır, a denied
permission gets steps for the browser in hand and a way to report it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: The stage runner with written and choice questions (HIRING-UX 6.5, 6.7, 6.8, 6.10-6.12)

**Files:**
- Create: `src/components/hiring/candidate/runner-model.ts` (+ `runner-model.test.ts`), `autosave.ts`, `activity-header.tsx`, `text-activity.tsx`, `choice-activity.tsx`, `stage-intro.tsx`, `submit-delay.tsx`, `stage-runner.tsx`
- Modify: `src/solutions/hiring/candidate/pages.tsx` (the `stage` case)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringStage`, `hiringText`, `hiringChoice`)

**Interfaces:**
- Consumes: Task 4 (`progressOf`, `firstOpenIndex`, `StageRule`); Task 5 (`HiringCandidateState`, `CandidateResponseView`, `CurrentStage`); `CandidateActivity` (`rules/candidate-view`); Task 9 endpoints `stage/start`, `response`, `response/commit`, `stage/submit`; core `useStageClock` (`@/lib/client/use-stage-clock`, which also posts `/heartbeat`), `FlushRegistry`, `apiSend`, `apiBeacon`, `formatCountdown`, `SUBMIT_SLACK_MS`; `useStepFocus` (`@/hooks/use-step-focus`); `pickTextLang`.
- Produces:
  - `runner-model.ts`: `type LocalAnswer = { text?: string; choiceIds?: string[]; usedTextAlternative?: boolean; hasTake?: boolean; hasFile?: boolean }`; `toLocal(r: CandidateResponseView): LocalAnswer`; `answeredLocally(a: Pick<CandidateActivity, "type" | "minChars">, answer: LocalAnswer): boolean`; `ownsPrimary(type): boolean` (VIDEO, AUDIO); `type PrimaryKey = "next" | "finishStage" | "finishAll"`, `primaryKey(index: number, count: number, lastStage: boolean): PrimaryKey`; `isLastMinute(ms: number): boolean`; `minutesLeft(ms: number): number`; `keyIndex(key: string, count: number): number | null`; `type TabMessage = { type: "hello" | "here"; id: string }`, `tabReply(own: string, message: TabMessage, blocked: boolean): { reply: TabMessage | null; blocked: boolean }`.
  - `useAutosave(input: { token: string; position: number; activityId: string; flushes: FlushRegistry }): { save(answer: unknown, immediate?: boolean): void; status: "idle" | "saving" | "saved" | "error"; savedAt: number | null }`.
  - `<ActivityHeader activity locale kicker headingRef />`; `<TextActivity token position activity initial locale headingRef flushes onChange disabled alternative? />`; `<ChoiceActivity token position activity initial locale headingRef flushes onChange disabled />`; `<StageIntro ... />`; `<SubmitDelay onElapsed onUndo />`; `<StageRunner token initial deadline locale />`.
  - Activity components share one props shape, `ActivityProps` (exported from `text-activity.tsx`): `{ token: string; position: number; activity: CandidateActivity; initial: LocalAnswer; locale: Locale; headingRef: React.Ref<HTMLHeadingElement>; flushes: FlushRegistry; onChange(answer: LocalAnswer): void; disabled: boolean }`. Tasks 14 and 15 add `RecordedActivity` (which also gets `complete(answer?: unknown): void`, `timeUp: boolean`, `response: CandidateResponseView`) and `FileActivity`.

- [ ] **Step 1: Write the failing test**

`src/components/hiring/candidate/runner-model.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { answeredLocally, isLastMinute, keyIndex, minutesLeft, ownsPrimary, primaryKey, tabReply, toLocal } from "./runner-model";

describe("the stage runner's rules", () => {
  it("mirrors the server's answered rule for the button (the server still decides)", () => {
    expect(answeredLocally({ type: "LONG_TEXT", minChars: 5 }, { text: " abcd " })).toBe(false);
    expect(answeredLocally({ type: "SHORT_TEXT", minChars: null }, { text: "a" })).toBe(true);
    expect(answeredLocally({ type: "MULTI_CHOICE", minChars: null }, { choiceIds: [] })).toBe(false);
    expect(answeredLocally({ type: "VIDEO", minChars: null }, { hasTake: true })).toBe(true);
    expect(answeredLocally({ type: "AUDIO", minChars: null }, { usedTextAlternative: true, text: "yazdım" })).toBe(true);
    expect(answeredLocally({ type: "FILE_UPLOAD", minChars: null }, {})).toBe(false);
  });

  it("starts from what the server already holds", () => {
    expect(
      toLocal({ activityId: "a", text: "x", choiceIds: ["b"], usedTextAlternative: false, takesUsed: 1, recording: { ref: "m", status: "READY", durationMs: 1 }, file: null, answered: true, closed: false }),
    ).toEqual({ text: "x", choiceIds: ["b"], usedTextAlternative: false, hasTake: true, hasFile: false });
  });

  it("lets video and audio questions carry their own filled button", () => {
    expect(ownsPrimary("VIDEO")).toBe(true);
    expect(ownsPrimary("AUDIO")).toBe(true);
    expect(ownsPrimary("FILE_UPLOAD")).toBe(false);
    expect(ownsPrimary("LONG_TEXT")).toBe(false);
  });

  it("names the button: next question, finish the stage, finish the assessment", () => {
    expect(primaryKey(0, 3, false)).toBe("next");
    expect(primaryKey(2, 3, false)).toBe("finishStage");
    expect(primaryKey(2, 3, true)).toBe("finishAll");
  });

  it("changes only the clock's words in the last minute and speaks once a minute", () => {
    expect(isLastMinute(61_000)).toBe(false);
    expect(isLastMinute(60_000)).toBe(true);
    expect(isLastMinute(0)).toBe(false);
    expect(minutesLeft(420_001)).toBe(8);
    expect(minutesLeft(60_000)).toBe(1);
  });

  it("maps keys 1-9 onto the choices there are", () => {
    expect(keyIndex("1", 4)).toBe(0);
    expect(keyIndex("4", 4)).toBe(3);
    expect(keyIndex("5", 4)).toBeNull();
    expect(keyIndex("0", 4)).toBeNull();
    expect(keyIndex("a", 4)).toBeNull();
  });

  it("lets the first tab keep the assessment and tells a second one to step back", () => {
    expect(tabReply("first", { type: "hello", id: "second" }, false)).toEqual({ reply: { type: "here", id: "first" }, blocked: false });
    expect(tabReply("second", { type: "here", id: "first" }, false)).toEqual({ reply: null, blocked: true });
    expect(tabReply("first", { type: "hello", id: "first" }, false)).toEqual({ reply: null, blocked: false });
    // A tab that already stepped back never claims the assessment, so a reload of the first tab works.
    expect(tabReply("second", { type: "hello", id: "third" }, true)).toEqual({ reply: null, blocked: true });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/components/hiring/candidate/runner-model.test.ts`
Expected: FAIL with `Failed to resolve import "./runner-model"`.

- [ ] **Step 3: The runner's rules**

`src/components/hiring/candidate/runner-model.ts`:
```ts
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";
import type { CandidateResponseView } from "@/solutions/hiring/rules/candidate-state";

/** What the runner knows about one question's answer in this tab. */
export type LocalAnswer = { text?: string; choiceIds?: string[]; usedTextAlternative?: boolean; hasTake?: boolean; hasFile?: boolean };

export function toLocal(r: CandidateResponseView): LocalAnswer {
  return { text: r.text, choiceIds: r.choiceIds, usedTextAlternative: r.usedTextAlternative, hasTake: r.recording !== null, hasFile: r.file !== null };
}

/** The tab's mirror of rules/candidate-flow responseAnswered, for the button's state only; the server decides. */
export function answeredLocally(a: Pick<CandidateActivity, "type" | "minChars">, answer: LocalAnswer): boolean {
  switch (a.type) {
    case "LONG_TEXT":
    case "SHORT_TEXT":
      return (answer.text ?? "").trim().length >= Math.max(1, a.minChars ?? 0);
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return (answer.choiceIds ?? []).length > 0;
    case "VIDEO":
    case "AUDIO":
      return !!answer.hasTake || (!!answer.usedTextAlternative && (answer.text ?? "").trim().length > 0);
    case "FILE_UPLOAD":
      return !!answer.hasFile;
  }
}

/** HIRING-UX 6.6: think, record and review each have their own filled button, so the runner shows none. */
export const ownsPrimary = (type: CandidateActivity["type"]) => type === "VIDEO" || type === "AUDIO";

export type PrimaryKey = "next" | "finishStage" | "finishAll";
export function primaryKey(index: number, count: number, lastStage: boolean): PrimaryKey {
  if (index < count - 1) return "next";
  return lastStage ? "finishAll" : "finishStage";
}

/** HIRING-UX 6: in the last 60 seconds only the clock's words change; it never blinks or turns red. */
export const isLastMinute = (ms: number) => ms > 0 && ms <= 60_000;
/** HIRING-UX 8.7: a screen reader hears the remaining time in whole minutes, once a minute. */
export const minutesLeft = (ms: number) => Math.ceil(ms / 60_000);

/** HIRING-UX 6.8: keys 1-9 pick the choice in that place. */
export function keyIndex(key: string, count: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const index = Number(key) - 1;
  return index < count ? index : null;
}

/**
 * HIRING-UX 6.12, a second tab: each tab says hello on a BroadcastChannel; an
 * open tab answers "here"; a tab that hears "here" steps back and never
 * answers again, so a reload of the first tab is not blocked by it.
 */
export type TabMessage = { type: "hello" | "here"; id: string };
export function tabReply(own: string, message: TabMessage, blocked: boolean): { reply: TabMessage | null; blocked: boolean } {
  if (blocked) return { reply: null, blocked: true };
  if (message.id === own) return { reply: null, blocked: false };
  if (message.type === "hello") return { reply: { type: "here", id: own }, blocked: false };
  return { reply: null, blocked: true };
}
```

- [ ] **Step 4: Copy**

Add to `candidate.tr.json`:
```json
"hiringStage": {
  "stageOf": "Aşama {n} / {total}",
  "title": "Aşama {n} / {total} · {name}",
  "meta": "{minutes} dakika · {count} soru",
  "ruleThink": "Her soruda {seconds} sn düşünme süren var; süre dolunca kayıt kendiliğinden başlamaz.",
  "ruleThinkAny": "Video ve ses sorularında önce düşünme süren var; süre dolunca kayıt kendiliğinden başlamaz.",
  "ruleThinkStrict": "Her soruda {seconds} sn düşünme süren var; süre dolunca kayıt kendiliğinden başlar.",
  "ruleThinkStrictAny": "Düşünme süresi dolunca kayıt kendiliğinden başlar; süresi her soruda yazar.",
  "ruleTakes": "{count, plural, one {Her cevap için bir tekrar hakkın var.} other {Her cevap için # tekrar hakkın var.}}",
  "ruleTakesAny": "Bazı cevaplarda tekrar hakkın var; kaç tane olduğu soruda yazar.",
  "ruleNoRetake": "Kayıtlar tek seferde alınır, tekrar hakkı yok.",
  "ruleNoBack": "Bu aşamada önceki sorulara geri dönülmez.",
  "ruleBack": "Bu aşamada önceki sorulara dönüp cevabını değiştirebilirsin.",
  "ruleLate": "Süre dolsa da bitirebilirsin; geç gönderildiği ekibe görünür.",
  "clockStarts": "Süre, başlata bastığında işlemeye başlar.",
  "previousDone": "Aşama {n} tamamlandı. Cevapların kaydedildi.",
  "previousTime": "Aşama {n} için süre doldu. O ana kadarki cevapların kaydedildi.",
  "lastStage": "Son aşama. Bitirince cevapların ekibe gider ve değiştirilemez.",
  "deadline": "Son tarih {date}. Aşamalar arasında ara verebilirsin.",
  "start": "Aşamayı başlat",
  "starting": "Başlatılıyor",
  "resumeTitle": "Kaldığın yerden devam ediyorsun",
  "resumeBody": "Bu aşamada {time} kaldı.",
  "resumeDevices": "Tarayıcın kamera ve mikrofon iznini yeniden isteyebilir.",
  "resumeGo": "Devam et",
  "remaining": "Kalan süre",
  "lastMinute": "Son 1 dakika",
  "announceMinutes": "{count, plural, one {Kalan süre 1 dakika} other {Kalan süre # dakika}}",
  "timeUpLate": "Süre doldu. Yine de bitirebilirsin; geç gönderildiği ekibe görünür.",
  "timeUpSaving": "Süre doldu. Cevapların kaydediliyor.",
  "questionOf": "Soru {n} / {total}",
  "announce": "Aşama {stage} / {stages}, soru {n} / {total}",
  "optional": "İsteğe bağlı",
  "next": "Sonraki soru",
  "finishStage": "Aşamayı bitir",
  "finishAll": "Değerlendirmeyi bitir",
  "previous": "Önceki soru",
  "requiredReason": "Bu soru zorunlu. Cevaplayınca devam edebilirsin.",
  "optionalHint": "Bu soru isteğe bağlı; boş geçebilirsin.",
  "busy": "Kaydediliyor",
  "sending": "Gönderiliyor · {seconds}",
  "undo": "Geri al",
  "offline": "Bağlantın koptu. Kaydın duruyor, bağlantı gelince yüklemeye devam ediyoruz. Süre işlemeye devam ediyor.",
  "otherTab": "Değerlendirmen başka bir sekmede açık. Orada devam et.",
  "stale": "Bu sayfa güncel değil.",
  "reload": "Sayfayı yenile",
  "failed": "Bir sorun oldu. Tekrar dener misin?"
},
"hiringText": {
  "written": "Yazılı cevap",
  "short": "Kısa cevap",
  "placeholder": "Cevabını buraya yaz.",
  "count": "{used} / {max}",
  "minChars": "En az {count} karakter.",
  "savedAgo": "Kaydedildi · {seconds} sn önce",
  "savedNow": "Kaydedildi",
  "saving": "Kaydediliyor",
  "saveFailed": "Kaydedilemedi, tekrar deniyoruz.",
  "keeps": "Sekmeyi kapatsan bile yazdığın kalır."
},
"hiringChoice": {
  "single": "Tek seçim",
  "multiKicker": "Çoklu seçim",
  "multi": "Birden fazla seçebilirsin.",
  "keys": "Klavyede 1-{max} tuşlarıyla da seçebilirsin."
}
```
and to `candidate.en.json`:
```json
"hiringStage": {
  "stageOf": "Stage {n} / {total}",
  "title": "Stage {n} of {total} · {name}",
  "meta": "{minutes} minutes · {count, plural, one {# question} other {# questions}}",
  "ruleThink": "Each question gives you {seconds} s to think; recording does not start by itself when it ends.",
  "ruleThinkAny": "Video and audio questions give you thinking time first; recording does not start by itself when it ends.",
  "ruleThinkStrict": "Each question gives you {seconds} s to think; recording starts by itself when it ends.",
  "ruleThinkStrictAny": "Recording starts by itself when thinking time ends; each question shows how long it is.",
  "ruleTakes": "{count, plural, one {You have one retake for each answer.} other {You have # retakes for each answer.}}",
  "ruleTakesAny": "Some answers allow retakes; each question shows how many.",
  "ruleNoRetake": "Recordings are taken once; there is no retake.",
  "ruleNoBack": "You cannot go back to earlier questions in this stage.",
  "ruleBack": "You can go back and change earlier answers in this stage.",
  "ruleLate": "You can finish after the time is up; the team sees it was late.",
  "clockStarts": "The clock starts when you press start.",
  "previousDone": "Stage {n} is done. Your answers are saved.",
  "previousTime": "Time ran out for stage {n}. Your answers up to that moment are saved.",
  "lastStage": "This is the last stage. When you finish, your answers go to the team and cannot be changed.",
  "deadline": "Deadline {date}. You can take a break between stages.",
  "start": "Start the stage",
  "starting": "Starting",
  "resumeTitle": "You are picking up where you left off",
  "resumeBody": "{time} left in this stage.",
  "resumeDevices": "Your browser may ask for camera and microphone permission again.",
  "resumeGo": "Continue",
  "remaining": "Time left",
  "lastMinute": "Last minute",
  "announceMinutes": "{count, plural, one {1 minute left} other {# minutes left}}",
  "timeUpLate": "Time is up. You can still finish; the team sees it was late.",
  "timeUpSaving": "Time is up. Saving your answers.",
  "questionOf": "Question {n} / {total}",
  "announce": "Stage {stage} of {stages}, question {n} of {total}",
  "optional": "Optional",
  "next": "Next question",
  "finishStage": "Finish the stage",
  "finishAll": "Finish the assessment",
  "previous": "Previous question",
  "requiredReason": "This question is required. You can go on once you answer it.",
  "optionalHint": "This question is optional; you can leave it empty.",
  "busy": "Saving",
  "sending": "Sending · {seconds}",
  "undo": "Undo",
  "offline": "Your connection dropped. Your recording continues and uploads resume when the connection is back. The clock keeps running.",
  "otherTab": "Your assessment is open in another tab. Continue there.",
  "stale": "This page is out of date.",
  "reload": "Reload the page",
  "failed": "Something went wrong. Could you try again?"
},
"hiringText": {
  "written": "Written answer",
  "short": "Short answer",
  "placeholder": "Write your answer here.",
  "count": "{used} / {max}",
  "minChars": "At least {count} characters.",
  "savedAgo": "Saved · {seconds} s ago",
  "savedNow": "Saved",
  "saving": "Saving",
  "saveFailed": "Could not save, trying again.",
  "keeps": "What you write stays even if you close the tab."
},
"hiringChoice": {
  "single": "One choice",
  "multiKicker": "Multiple choice",
  "multi": "You can choose more than one.",
  "keys": "You can also use keys 1-{max}."
}
```

- [ ] **Step 5: Autosave and the shared header**

`src/components/hiring/candidate/autosave.ts`:
```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiBeacon, apiSend } from "@/lib/client/api";
import type { FlushRegistry } from "@/lib/client/flush-registry";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * HIRING-UX 6.7 "Kaydedildi · 4 sn önce": a debounced autosave of one question.
 * Saves are chained, so a slow earlier draft never overwrites a later one; a
 * closing tab sends the pending draft with a beacon; the runner flushes every
 * pending save before it closes a question or a stage (FlushRegistry).
 */
export function useAutosave(input: { token: string; position: number; activityId: string; flushes: FlushRegistry }, delayMs = 800) {
  const { token, position, activityId, flushes } = input;
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const pending = useRef<unknown>(undefined);
  const timer = useRef<number | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(() => {
    const answer = pending.current;
    if (answer !== undefined) {
      pending.current = undefined;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
      setStatus("saving");
      chain.current = chain.current
        .then(() => apiSend(token, "/hiring/response", { stagePosition: position, activityId, answer }, "PUT"))
        .then(
          () => {
            setStatus("saved");
            setSavedAt(Date.now());
          },
          () => setStatus("error"),
        );
    }
    return chain.current;
  }, [token, position, activityId]);

  const save = useCallback(
    (answer: unknown, immediate = false) => {
      pending.current = answer;
      if (timer.current) window.clearTimeout(timer.current);
      if (immediate) void flush();
      else timer.current = window.setTimeout(() => void flush(), delayMs);
    },
    [flush, delayMs],
  );

  useEffect(() => flushes.register(activityId, flush), [flushes, activityId, flush]);

  useEffect(() => {
    const onHide = () => {
      if (pending.current !== undefined) apiBeacon(token, "/hiring/response", { stagePosition: position, activityId, answer: pending.current });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [token, position, activityId]);

  return { save, status, savedAt };
}
```

`src/components/hiring/candidate/activity-header.tsx`:
```tsx
"use client";

import { pickTextLang } from "@/lib/i18n-text";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";

/** A version text in the candidate's language; a fallback in the other language carries its own `lang`. */
export function VersionText({ value, locale }: { value: { tr: string; en: string }; locale: Locale }) {
  const shown = pickTextLang(value, locale);
  return shown.lang === locale ? <>{shown.text}</> : <span lang={shown.lang}>{shown.text}</span>;
}

/**
 * HIRING-UX 6.6-6.9: the kind of question, then the question as the screen's
 * heading (it takes focus when the question opens), then the team's note.
 */
export function ActivityHeader({
  activity,
  locale,
  kicker,
  headingRef,
  large = false,
}: {
  activity: Pick<CandidateActivity, "id" | "prompt" | "note">;
  locale: Locale;
  kicker: string;
  headingRef: React.Ref<HTMLHeadingElement>;
  large?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-muted">{kicker}</p>
      <h2 ref={headingRef} tabIndex={-1} id={`prompt-${activity.id}`} className={cn("whitespace-pre-line text-ink outline-none", large ? "text-[22px] leading-8 font-medium" : "text-[18px] leading-7 font-medium")}>
        <VersionText value={activity.prompt} locale={locale} />
      </h2>
      {pickTextLang(activity.note, locale).text ? (
        <p className="whitespace-pre-line text-[16px] leading-[26px] text-ink-2">
          <VersionText value={activity.note} locale={locale} />
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Written and choice questions**

`src/components/hiring/candidate/text-activity.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { FlushRegistry } from "@/lib/client/flush-registry";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";
import { ActivityHeader } from "./activity-header";
import { useAutosave, type SaveStatus } from "./autosave";
import type { LocalAnswer } from "./runner-model";

export type ActivityProps = {
  token: string;
  position: number;
  activity: CandidateActivity;
  initial: LocalAnswer;
  locale: Locale;
  headingRef: React.Ref<HTMLHeadingElement>;
  flushes: FlushRegistry;
  onChange(answer: LocalAnswer): void;
  disabled: boolean;
};

function Saved({ status, savedAt }: { status: SaveStatus; savedAt: number | null }) {
  const t = useT("hiringText");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);
  if (status === "saving") return <span>{t("saving")}</span>;
  if (status === "error") return <span className="text-ink">{t("saveFailed")}</span>;
  if (status === "saved" && savedAt) {
    const seconds = Math.max(1, Math.round((now - savedAt) / 1000));
    return <span>{seconds < 5 ? t("savedNow") : t("savedAgo", { seconds })}</span>;
  }
  return <span>{t("keeps")}</span>;
}

/**
 * HIRING-UX 6.7: a wide field that saves itself, a counter, "Kaydedildi · 4 sn
 * önce". `alternative` is the written answer to a video or audio question
 * (HIRING-UX A7): saved flagged, so the team reads it as the penalty-free
 * alternative.
 */
export function TextActivity({ token, position, activity, initial, locale, headingRef, flushes, onChange, disabled, alternative = false, kicker }: ActivityProps & { alternative?: boolean; kicker?: string }) {
  const t = useT("hiringText");
  const [text, setText] = useState(initial.text ?? "");
  const { save, status, savedAt } = useAutosave({ token, position, activityId: activity.id, flushes });
  const short = activity.type === "SHORT_TEXT";
  const max = activity.maxChars ?? (short ? 300 : 3000);
  const min = activity.minChars ?? 0;
  const format = new Intl.NumberFormat(locale);

  function update(value: string) {
    const next = value.slice(0, max);
    setText(next);
    const answer: LocalAnswer = alternative ? { usedTextAlternative: true, text: next } : { text: next };
    save(answer);
    onChange(answer);
  }

  return (
    <div className="space-y-5">
      <ActivityHeader activity={activity} locale={locale} kicker={kicker ?? (short ? t("short") : t("written"))} headingRef={headingRef} />
      <div className="overflow-hidden rounded-xl border border-input bg-surface focus-within:border-ink/40">
        <Textarea
          aria-labelledby={`prompt-${activity.id}`}
          value={text}
          onChange={(e) => update(e.target.value)}
          disabled={disabled}
          rows={short ? 3 : 10}
          placeholder={t("placeholder")}
          className="min-h-24 resize-y rounded-none border-0 bg-surface px-4 py-3 text-[16px] leading-[26px] md:text-[16px]"
        />
        <div className="flex items-center justify-between gap-4 border-t border-hairline bg-paper px-4 py-2 text-[14px] text-muted" aria-live="polite">
          <Saved status={status} savedAt={savedAt} />
          <span className="tnum shrink-0">{t("count", { used: format.format(text.length), max: format.format(max) })}</span>
        </div>
      </div>
      {min > 0 && text.trim().length < min ? <p className="tnum text-[14px] text-muted">{t("minChars", { count: min })}</p> : null}
    </div>
  );
}
```

`src/components/hiring/candidate/choice-activity.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useT } from "@/i18n/candidate-client";
import { ActivityHeader, VersionText } from "./activity-header";
import { useAutosave } from "./autosave";
import { keyIndex } from "./runner-model";
import type { ActivityProps } from "./text-activity";

/**
 * HIRING-UX 6.8: large rows to click or tap, keys 1-9, "Birden fazla
 * seçebilirsin" only for multiple choice, and no right or wrong feedback.
 */
export function ChoiceActivity({ token, position, activity, initial, locale, headingRef, flushes, onChange, disabled }: ActivityProps) {
  const t = useT("hiringChoice");
  const multi = activity.type === "MULTI_CHOICE";
  const choices = activity.choices ?? [];
  const [chosen, setChosen] = useState<string[]>(initial.choiceIds ?? []);
  const { save } = useAutosave({ token, position, activityId: activity.id, flushes });

  function choose(next: string[]) {
    setChosen(next);
    save({ choiceIds: next }, true);
    onChange({ choiceIds: next });
  }
  const toggle = (id: string) => (multi ? choose(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]) : choose([id]));
  // The listener reads the latest toggle through a ref, so it is bound once per question.
  const latest = useRef(toggle);
  useEffect(() => {
    latest.current = toggle;
  });
  const ids = choices.map((c) => c.id).join(",");

  useEffect(() => {
    if (disabled) return;
    const list = ids.split(",");
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = keyIndex(e.key, list.length);
      if (i === null) return;
      e.preventDefault();
      latest.current(list[i]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [disabled, ids]);

  const row =
    "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[24px] text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-brand-soft";
  const number = (i: number) => <span className="tnum w-5 shrink-0 text-[14px] text-muted" aria-hidden>{i + 1}</span>;

  return (
    <div className="space-y-5">
      <ActivityHeader activity={activity} locale={locale} kicker={multi ? t("multiKicker") : t("single")} headingRef={headingRef} />
      {multi ? <p className="text-[16px] text-ink-2">{t("multi")}</p> : null}
      {multi ? (
        <div role="group" aria-labelledby={`prompt-${activity.id}`} className="space-y-2">
          {choices.map((c, i) => (
            <label key={c.id} className={row}>
              {number(i)}
              <Checkbox checked={chosen.includes(c.id)} onCheckedChange={() => toggle(c.id)} disabled={disabled} className="size-5" />
              <VersionText value={c.label} locale={locale} />
            </label>
          ))}
        </div>
      ) : (
        <RadioGroup aria-labelledby={`prompt-${activity.id}`} value={chosen[0] ?? ""} onValueChange={(v) => choose([v])} disabled={disabled} className="gap-2">
          {choices.map((c, i) => (
            <label key={c.id} className={row}>
              {number(i)}
              <RadioGroupItem value={c.id} />
              <VersionText value={c.label} locale={locale} />
            </label>
          ))}
        </RadioGroup>
      )}
      <p className="tnum text-[14px] text-muted">{t("keys", { max: Math.min(9, choices.length) })}</p>
    </div>
  );
}
```

- [ ] **Step 7: Stage intro and the final delay**

`src/components/hiring/candidate/stage-intro.tsx`:
```tsx
"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { StageRule } from "@/solutions/hiring/rules/candidate-flow";
import type { CurrentStage } from "@/solutions/hiring/rules/candidate-state";
import { ActionBar } from "./action-bar";
import { VersionText } from "./activity-header";

/**
 * HIRING-UX 6.5 and 6.10: which stage, how long, how many questions, only the
 * rules that apply, and that the clock starts with the button. Between stages
 * it says how the last one ended; before the last one, that finishing sends
 * everything.
 */
export function StageIntro({ current, deadline, locale, busy, onStart, headingRef }: { current: CurrentStage; deadline: string; locale: Locale; busy: boolean; onStart: () => void; headingRef: React.Ref<HTMLHeadingElement> }) {
  const t = useT("hiringStage");
  const rule = (r: StageRule) => {
    switch (r.kind) {
      case "think":
        return r.seconds !== null ? t("ruleThink", { seconds: r.seconds }) : t("ruleThinkAny");
      case "thinkStrict":
        return r.seconds !== null ? t("ruleThinkStrict", { seconds: r.seconds }) : t("ruleThinkStrictAny");
      case "takes":
        return r.count !== null ? t("ruleTakes", { count: r.count }) : t("ruleTakesAny");
      case "noRetake":
        return t("ruleNoRetake");
      case "noBack":
        return t("ruleNoBack");
      case "back":
        return t("ruleBack");
      case "lateAllowed":
        return t("ruleLate");
    }
  };
  return (
    <div className="mx-auto max-w-[640px] pt-10 pb-6 sm:pt-14">
      {current.previous ? (
        <p role="status" className="mb-6 text-[16px] leading-[26px] text-ink">
          {current.previous.closedByClock ? t("previousTime", { n: current.previous.position }) : t("previousDone", { n: current.previous.position })}
        </p>
      ) : null}
      <h1 ref={headingRef} tabIndex={-1} className="tnum text-[28px] leading-9 font-semibold text-ink outline-none">
        {t("stageOf", { n: current.position, total: current.total })} · <VersionText value={current.stage.name} locale={locale} />
      </h1>
      {current.stage.description.tr || current.stage.description.en ? (
        <p className="mt-3 text-[16px] leading-[26px] text-ink-2">
          <VersionText value={current.stage.description} locale={locale} />
        </p>
      ) : null}
      <p className="tnum mt-4 text-[16px] text-ink">{t("meta", { minutes: Math.ceil(current.seconds / 60), count: current.stage.activities.length })}</p>
      <ul className="mt-5 list-disc space-y-2 pl-5 text-[16px] leading-[26px] text-ink-2">
        {current.rules.map((r) => (
          <li key={r.kind}>{rule(r)}</li>
        ))}
      </ul>
      {current.last ? <p className="mt-5 text-[16px] leading-[26px] font-medium text-ink">{t("lastStage")}</p> : null}
      <p className="mt-5 text-[16px] font-medium text-ink">{t("clockStarts")}</p>
      <ActionBar>
        <Button id="stage-start" variant="primary" size="lg" className="w-full sm:w-auto" disabled={busy} disabledReason={t("starting")} onClick={onStart}>
          {busy ? t("starting") : t("start")}
        </Button>
      </ActionBar>
      <p className="tnum mt-6 text-[14px] text-muted">{t("deadline", { date: deadline })}</p>
    </div>
  );
}
```

`src/components/hiring/candidate/submit-delay.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/candidate-client";

const SECONDS = 8;

/**
 * HIRING-UX 6.10: finishing the last stage is the one action that cannot be
 * taken back, so it waits 8 seconds with "Geri al" instead of asking "emin
 * misin" (EXAM-UX rule 6). Nothing is sent until the time is up.
 */
export function SubmitDelay({ onElapsed, onUndo }: { onElapsed: () => void; onUndo: () => void }) {
  const t = useT("hiringStage");
  const [left, setLeft] = useState(SECONDS);
  const fired = useRef(false);
  // The runner re-renders four times a second (its clock): keep the latest callback
  // in a ref so the one-second timer is not restarted by every render.
  const elapsed = useRef(onElapsed);
  useEffect(() => {
    elapsed.current = onElapsed;
  });
  useEffect(() => {
    if (left <= 0) {
      if (!fired.current) {
        fired.current = true;
        elapsed.current();
      }
      return;
    }
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div role="status" aria-live="polite" className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 shadow-overlay">
        <span className="tnum text-[16px] text-ink">{t("sending", { seconds: left })}</span>
        <Button onClick={onUndo}>{t("undo")}</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: The runner**

`src/components/hiring/candidate/stage-runner.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DisabledReason } from "@/components/ui/button";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { FlushRegistry } from "@/lib/client/flush-registry";
import { useStageClock } from "@/lib/client/use-stage-clock";
import { formatCountdown, SUBMIT_SLACK_MS } from "@/lib/timer";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import { firstOpenIndex, progressOf } from "@/solutions/hiring/rules/candidate-flow";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { ActionBar } from "./action-bar";
import { ChoiceActivity } from "./choice-activity";
import { answeredLocally, isLastMinute, minutesLeft, ownsPrimary, primaryKey, tabReply, toLocal, type LocalAnswer, type TabMessage } from "./runner-model";
import { StageIntro } from "./stage-intro";
import { SubmitDelay } from "./submit-delay";
import { TextActivity } from "./text-activity";

const STALE = new Set(["STAGE_MISMATCH", "ACTIVITY_CLOSED", "ACTIVITY_ORDER", "NO_STAGE", "STAGE_EXPIRED"]);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type Failure = { message: string; stale: boolean };
const failureOf = (err: unknown, fallback: string): Failure => {
  const code = (err as { code?: string }).code ?? "";
  return { message: err instanceof Error && err.message ? err.message : fallback, stale: STALE.has(code) };
};

/**
 * One stage (HIRING-UX 6.5-6.12): the intro, a resume gate after a reload,
 * one question at a time under the server's clock, and the way out (the next
 * stage's intro, or the finish after an 8 second delay). The client decides
 * nothing that matters: every write names its stage and question, and the
 * server answers with the next state.
 */
export function StageRunner({ token, initial, deadline, locale }: { token: string; initial: HiringCandidateState; deadline: string; locale: Locale }) {
  const t = useT("hiringStage");
  const router = useRouter();
  const [state, setState] = useState(initial);
  const current = state.current!;
  const activities = current.stage.activities;
  const [phase, setPhase] = useState<"intro" | "resume" | "question">(current.startedAt ? "resume" : "intro");
  const [index, setIndex] = useState(() => firstOpenIndex(current.responses.map((r) => r.closed)));
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(() => Object.fromEntries(current.responses.map((r) => [r.activityId, toLocal(r)])));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [delayed, setDelayed] = useState<null | (() => Promise<void>)>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [offline, setOffline] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const flushes = useMemo(() => new FlushRegistry(), []);
  const activity = activities[Math.min(index, activities.length - 1)];
  const heading = useStepFocus<HTMLHeadingElement>(`${phase}-${index}`);
  const base = `/a/${encodeURIComponent(token)}`;

  const go = useCallback(
    (next: HiringCandidateState) => {
      router.replace(`${base}${next.path}`);
      router.refresh();
    },
    [router, base],
  );

  const submit = useCallback(
    async (auto: boolean) => {
      setBusy(true);
      setFailure(null);
      await flushes.flushAll();
      try {
        let next: HiringCandidateState;
        try {
          next = await apiSend<HiringCandidateState>(token, "/hiring/stage/submit", { stagePosition: current.position });
        } catch (err) {
          // At 0:00 the request can race the server's own clock; past the slack the server closes the stage either way.
          if (!auto) throw err;
          await wait(SUBMIT_SLACK_MS + 1000);
          next = await apiSend<HiringCandidateState>(token, "/hiring/stage/submit", { stagePosition: current.position });
        }
        go(next);
      } catch (err) {
        const f = failureOf(err, t("failed"));
        // The server already moved on (a closed stage): show where the candidate really is.
        if (auto && f.stale) router.refresh();
        setFailure(f);
        setBusy(false);
      }
    },
    [flushes, token, current.position, go, router, t],
  );

  const clock = useStageClock(token, { serverNow: Date.parse(current.serverNow), deadlineAt: current.deadlineAt ? Date.parse(current.deadlineAt) : null }, () => {
    setTimeUp(true);
    setDelayed(null);
    if (current.autoSubmit) void submit(true);
  });

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    // The browser's state, read once after mount (the server cannot know it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const id = crypto.randomUUID();
    const channel = new BroadcastChannel(`kademe-hiring-${token}`);
    let isBlocked = false;
    channel.onmessage = (e: MessageEvent<TabMessage>) => {
      const { reply, blocked: nowBlocked } = tabReply(id, e.data, isBlocked);
      if (reply) channel.postMessage(reply);
      if (nowBlocked && !isBlocked) {
        isBlocked = true;
        setBlocked(true);
      }
    };
    channel.postMessage({ type: "hello", id } satisfies TabMessage);
    return () => channel.close();
  }, [token]);

  async function start() {
    setBusy(true);
    setFailure(null);
    try {
      const next = await apiSend<HiringCandidateState>(token, "/hiring/stage/start", { stagePosition: current.position });
      setState(next);
      setIndex(0);
      setPhase("question");
    } catch (err) {
      setFailure(failureOf(err, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  /** Closes the open question (with its latest answer) and moves on; the last question also closes the stage. */
  async function advance(answer?: unknown) {
    const last = index === activities.length - 1;
    const run = async () => {
      setDelayed(null);
      setBusy(true);
      setFailure(null);
      await flushes.flushAll();
      try {
        const next = await apiSend<HiringCandidateState>(token, "/hiring/response/commit", { stagePosition: current.position, activityId: activity.id, ...(answer === undefined ? {} : { answer }) });
        if (!last) {
          setState(next);
          setIndex((i) => i + 1);
          setBusy(false);
          return;
        }
        await submit(false);
      } catch (err) {
        setFailure(failureOf(err, t("failed")));
        setBusy(false);
      }
    };
    if (last && current.last) setDelayed(() => run);
    else await run();
  }

  const progress = progressOf({ stagePosition: current.position, stageCount: current.total, activityIndex: phase === "question" ? index : 0, activityCount: activities.length });
  const answered = answeredLocally(activity, answers[activity.id] ?? {});
  const disabledReason = activity.required && !answered ? t("requiredReason") : null;
  const lastMinute = isLastMinute(clock.remainingMs);

  if (blocked) {
    return (
      <div className="mx-auto max-w-[640px] py-16">
        <p role="alert" className="text-[18px] leading-7 text-ink">
          {t("otherTab")}
        </p>
      </div>
    );
  }

  if (phase === "intro") return <StageIntro current={current} deadline={deadline} locale={locale} busy={busy} onStart={start} headingRef={heading} />;

  if (phase === "resume") {
    return (
      <div className="mx-auto max-w-[640px] pt-10 pb-6 sm:pt-14">
        <h1 ref={heading} tabIndex={-1} className="text-[28px] leading-9 font-semibold text-ink outline-none">
          {t("resumeTitle")}
        </h1>
        <p className="tnum mt-3 text-[16px] leading-[26px] text-ink">{t("resumeBody", { time: formatCountdown(clock.remainingMs) })}</p>
        {activities.some((a) => a.type === "VIDEO" || a.type === "AUDIO") ? <p className="mt-2 text-[16px] leading-[26px] text-ink-2">{t("resumeDevices")}</p> : null}
        <ActionBar>
          <Button id="resume" variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => setPhase("question")}>
            {t("resumeGo")}
          </Button>
        </ActionBar>
      </div>
    );
  }

  const common = {
    token,
    position: current.position,
    activity,
    initial: answers[activity.id] ?? {},
    locale,
    headingRef: heading,
    flushes,
    onChange: (answer: LocalAnswer) => setAnswers((all) => ({ ...all, [activity.id]: { ...all[activity.id], ...answer } })),
    disabled: busy || (timeUp && current.autoSubmit),
  };

  let body: React.ReactNode = null;
  switch (activity.type) {
    case "LONG_TEXT":
    case "SHORT_TEXT":
      body = <TextActivity key={activity.id} {...common} />;
      break;
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      body = <ChoiceActivity key={activity.id} {...common} />;
      break;
    // VIDEO and AUDIO arrive with Task 14, FILE_UPLOAD with Task 15.
    default:
      body = null;
  }

  const key = primaryKey(index, activities.length, current.last);
  const sendAnswer = () => {
    const a = answers[activity.id] ?? {};
    if (activity.type === "LONG_TEXT" || activity.type === "SHORT_TEXT") return { text: a.text ?? "" };
    if (activity.type === "SINGLE_CHOICE" || activity.type === "MULTI_CHOICE") return { choiceIds: a.choiceIds ?? [] };
    return undefined;
  };

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-hairline bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="tnum text-[14px] text-muted">
              {t("stageOf", { n: progress.n, total: progress.total })} · {t("questionOf", { n: index + 1, total: activities.length })}
            </p>
            <div className="mt-2 h-1 rounded-full bg-hairline" aria-hidden>
              <div className="h-1 rounded-full bg-ink-3 transition-[width] duration-[180ms] ease-soft" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
            </div>
          </div>
          {current.deadlineAt ? (
            <p className="shrink-0 text-right">
              <span className="block text-[13px] text-muted">{lastMinute ? t("lastMinute") : t("remaining")}</span>
              <span className="tnum block text-[20px] leading-7 font-semibold text-accent">{formatCountdown(clock.remainingMs)}</span>
            </p>
          ) : null}
        </div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {t("announceMinutes", { count: minutesLeft(clock.remainingMs) })}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {t("announce", { stage: current.position, stages: current.total, n: index + 1, total: activities.length })}
      </p>

      <div className={activity.type === "VIDEO" ? "mx-auto max-w-[960px] pt-8" : "mx-auto max-w-[640px] pt-8"}>
        {offline ? (
          <p role="status" className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[26px] text-ink">
            {t("offline")}
          </p>
        ) : null}
        {timeUp ? (
          <p role="status" className="mb-4 text-[16px] font-medium text-ink">
            {current.autoSubmit ? t("timeUpSaving") : t("timeUpLate")}
          </p>
        ) : null}
        {body}
        {failure ? (
          <p role="alert" className="mt-4 text-[16px] text-ink">
            {failure.stale ? t("stale") : failure.message}{" "}
            {failure.stale ? (
              <button type="button" onClick={() => router.refresh()} className="min-h-11 underline decoration-underline underline-offset-4">
                {t("reload")}
              </button>
            ) : null}
          </p>
        ) : null}
        {ownsPrimary(activity.type) ? null : (
          <ActionBar>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button
                id="activity-next"
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
                disabled={busy || disabledReason !== null || delayed !== null || (timeUp && current.autoSubmit)}
                disabledReason={disabledReason ?? t("busy")}
                onClick={() => void advance(sendAnswer())}
              >
                {busy ? t("busy") : t(key)}
              </Button>
              {current.backNavigation && index > 0 ? (
                <button type="button" onClick={() => setIndex((i) => i - 1)} className="min-h-11 text-[16px] text-ink underline decoration-underline underline-offset-4">
                  {t("previous")}
                </button>
              ) : null}
            </div>
            {disabledReason ? (
              <DisabledReason id="activity-next-why" className="mt-2">
                {disabledReason}
              </DisabledReason>
            ) : !activity.required && !answered ? (
              <p className="mt-2 text-[14px] text-muted">{t("optionalHint")}</p>
            ) : null}
          </ActionBar>
        )}
      </div>
      {delayed ? <SubmitDelay onElapsed={() => void delayed()} onUndo={() => setDelayed(null)} /> : null}
    </div>
  );
}
```

In `src/solutions/hiring/candidate/pages.tsx`, import `StageRunner` from `@/components/hiring/candidate/stage-runner`, take `"stage"` out of the placeholder list, and add:
```tsx
    case "stage":
      // Keyed by the stage, so the next stage starts from a fresh runner.
      return frame(<StageRunner key={state.position ?? 0} token={token} initial={safe} deadline={shortDate(h.link.expiresAt, locale)} locale={locale} />);
```

- [ ] **Step 9: Run the tests and the gates**

```bash
pnpm exec vitest run src/components/hiring/candidate src/i18n src/solutions/hiring/candidate
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS.

- [ ] **Step 10: Browser check (Claude in Chrome)**

On a fresh `kademe_ui_check` with `pnpm dev:hiring-link --kind written` and the dev server on 3100:
1. Landing, consent: straight to `/stage/1` (no device check: nothing is recorded). The intro reads "Aşama 1 / 2 · Tanışma", "10 dakika · 3 soru", "Bu aşamada önceki sorulara geri dönülmez.", "Süre, başlata bastığında işlemeye başlar.", the deadline line; "Aşamayı başlat" is the one filled button.
2. Start: the clock shows about 10:00 in accent and counts down; "Aşama 1 / 2 · Soru 1 / 3" with the thin bar. Focus is on the question (press Tab once: the next focus is the field).
3. Long text: "Sonraki soru" is disabled with "Bu soru zorunlu..." until 20 characters; "Kaydedildi" appears after typing stops; the counter reads "25 / 2.000"; reload the page: the resume gate ("Kaldığın yerden devam ediyorsun", minutes left, "Devam et") and the typed text is still there; the clock did not reset.
4. "Sonraki soru": single choice. Press keys 2 then 1: the selection moves; "Klavyede 1-3 tuşlarıyla da seçebilirsin."; no right or wrong is ever shown. Next: the optional short text says "Bu soru isteğe bağlı; boş geçebilirsin." and "Aşamayı bitir".
5. Open the same link in a second tab: it says "Değerlendirmen başka bir sekmede açık. Orada devam et."; close it.
6. "Aşamayı bitir": `/stage/2` shows "Aşama 1 tamamlandı. Cevapların kaydedildi.", "Son aşama...", the going-back rule. Start; answer the long text; "Önceki soru" is not offered on the first question but is on the second (going back allowed); go back and change the text; forward to the multiple choice ("Birden fazla seçebilirsin."); choose two; "Değerlendirmeyi bitir": the strip "Gönderiliyor · 8" counts down; press "Geri al": nothing is sent (no `/hiring/stage/submit` in the network list); press again and wait: the page moves to `/done` (the placeholder card until Task 16).
7. Time-up: mint another `--kind written` link, start stage 1, then `docker exec kademe-db psql -U kademe -d kademe_ui_check -c "update hiring_stage_runs set deadline_at = now() + interval '20 seconds' where submitted_at is null and started_at is not null"` and reload: the clock reads under 0:20 with "Son 1 dakika"; at 0:00 "Süre doldu. Cevapların kaydediliyor." and the page moves to stage 2's intro with "Aşama 1 için süre doldu. O ana kadarki cevapların kaydedildi."
8. Narrow window (390px): the button bar is fixed at the bottom; the field and choices are 16px; nothing overflows.
Stop the server; drop `kademe_ui_check` unless Task 14 follows at once.

- [ ] **Step 11: Commit**

```bash
git add src/components/hiring/candidate/runner-model.ts src/components/hiring/candidate/runner-model.test.ts src/components/hiring/candidate/autosave.ts src/components/hiring/candidate/activity-header.tsx src/components/hiring/candidate/text-activity.tsx src/components/hiring/candidate/choice-activity.tsx src/components/hiring/candidate/stage-intro.tsx src/components/hiring/candidate/submit-delay.tsx src/components/hiring/candidate/stage-runner.tsx src/solutions/hiring/candidate/pages.tsx src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Run hiring stages with written and choice questions

The stage intro says only the rules that apply and that the clock starts
with the button; a reload opens a resume gate with the time left; questions
come one at a time under the server's calm clock, save themselves, take
keys 1-9 for choices, and close in the server's order. The last stage
waits 8 seconds with Geri al before it sends. Time-up, a dropped
connection and a second tab are said plainly.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Video and audio answers, and the warm-up (HIRING-UX 6.4, 6.6, A4, A5, A7)

**Files:**
- Modify: `src/lib/client/recorder.ts` (`ChunkedUploader.open` takes the init body) (+ `src/lib/client/recorder.test.ts`, new)
- Modify: `src/app/globals.css` (the recording dot's pulse)
- Create: `src/components/hiring/candidate/recording-sink.ts`, `upload-sink.ts`, `local-sink.ts`, `recorded-activity.tsx`, `practice.tsx` (+ `practice.test.ts`)
- Modify: `src/components/hiring/candidate/stage-runner.tsx` (VIDEO and AUDIO), `src/solutions/hiring/candidate/pages.tsx` (the `practice` case)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringMedia`, `hiringPractice`)

**Interfaces:**
- Consumes: Task 13 (`StageRunner`, `ActivityProps`, `TextActivity`, `ActivityHeader`, `ActionBar`, `answeredLocally`); Task 12 (`trackStream`); Task 9 endpoints `media/init` (kind `recording`), `media/play`; core `/media/part`, `/media/part-done`, `/media/part-urls`, `/media/complete`; `pickRecorderMime`, `CHUNK_MS`, `apiGet`, `apiBeacon`.
- Produces:
  - `ChunkedUploader.open(token: string, initPath: string, body: Record<string, unknown>, mime: string, onStatus?)` posts `{ ...body, mime }` (the exam's call is unchanged: it passes `{ sectionPosition, sequence }`).
  - `recording-sink.ts`: `type RecordingResult = { status: "READY" | "INCOMPLETE"; ref: string | null; localUrl?: string }`, `type TakeProgress = { ratio: number; stalled: boolean }`, `interface OpenTake { push(chunk: Blob): void; finish(durationMs: number): Promise<RecordingResult>; abandon(durationMs: number): void }`, `interface RecordingSink { open(mime: string, onProgress?: (p: TakeProgress) => void): Promise<OpenTake> }`.
  - `uploadSink(token: string, stagePosition: number, activityId: string): RecordingSink` (server takes, parts while recording); `localSink(): RecordingSink & { release(): void }` (memory only, never the network).
  - `<RecordedActivity mode activity locale headingRef sink takesUsed existingRef playbackSrc onTake? onUse? timeUp disabled alternative? />`; `<Practice token camera />`.

- [ ] **Step 1: Write the failing tests**

`src/lib/client/recorder.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ apiSend: vi.fn(async (_token: string, _path: string, body: { mime: string }) => ({ uploadRef: "r", mime: body.mime, minPartBytes: 0, proxy: true, partTargets: [] })) }));
vi.mock("@/lib/client/api", () => ({ apiSend: h.apiSend, candidateApiBase: (t: string) => `/api/c/${t}` }));

import { ChunkedUploader } from "./recorder";

describe("ChunkedUploader.open", () => {
  it("sends the solution's own init body with the mime", async () => {
    await ChunkedUploader.open("tok", "/hiring/media/init", { stagePosition: 1, activityId: "a1", kind: "recording" }, "video/webm");
    expect(h.apiSend).toHaveBeenLastCalledWith("tok", "/hiring/media/init", { stagePosition: 1, activityId: "a1", kind: "recording", mime: "video/webm" });
  });

  it("keeps the exam's body exactly as before", async () => {
    await ChunkedUploader.open("tok", "/exam/media/init", { sectionPosition: 2, sequence: 3 }, "video/mp4");
    expect(h.apiSend).toHaveBeenLastCalledWith("tok", "/exam/media/init", { sectionPosition: 2, sequence: 3, mime: "video/mp4" });
  });
});
```

`src/components/hiring/candidate/practice.test.ts`:
```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HIRING-UX A4: the warm-up sends nothing. The warm-up page, its in-memory
 * sink and the shared recorder component never reach for the network; the
 * answer upload is injected only on the stage page. (The browser check also
 * reads the network list.)
 */
const NETWORK = /@\/lib\/client\/api|fetch\(|sendBeacon|apiSend|apiGet|apiBeacon|ChunkedUploader|upload-sink/;

describe("the warm-up", () => {
  it.each(["practice.tsx", "local-sink.ts", "recorded-activity.tsx"])("%s has no way to the network", (file) => {
    const text = readFileSync(path.join(process.cwd(), "src/components/hiring/candidate", file), "utf8");
    expect(text).not.toMatch(NETWORK);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/lib/client/recorder.test.ts src/components/hiring/candidate/practice.test.ts`
Expected: FAIL (the exam-shaped body loses `activityId`/`kind`; the component files do not exist).

- [ ] **Step 3: The uploader takes the solution's body**

In `src/lib/client/recorder.ts`, replace the doc comment and signature of `static async open` with:
```ts
  /**
   * Opens the upload through the solution's init endpoint (`initPath`, e.g.
   * "/exam/media/init" or "/hiring/media/init"), which names what the take
   * belongs to from `body` and refuses a tab that is out of date. After this
   * call the upload is addressed by `uploadRef` alone; the parts and the
   * completion are core routes.
   */
  static async open(
    token: string,
    initPath: string,
    body: Record<string, unknown>,
    mime: string,
    onStatus?: (status: UploaderStatus) => void,
  ) {
    const init = await apiSend<InitResponse>(token, initPath, { ...body, mime });
    return new ChunkedUploader(token, init, onStatus);
  }
```

In `src/app/globals.css`, append:
```css
/* HIRING-UX 8.5: the recording dot breathes (1 to .45 over 1.6 s); used with motion-safe only. */
@keyframes rec-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
```

- [ ] **Step 4: Sinks**

`src/components/hiring/candidate/recording-sink.ts`:
```ts
/** Where a take's bytes go: the server while recording (answers), or this tab's memory (the warm-up). */
export type RecordingResult = { status: "READY" | "INCOMPLETE"; ref: string | null; localUrl?: string };
export type TakeProgress = { ratio: number; stalled: boolean };
export interface OpenTake {
  push(chunk: Blob): void;
  finish(durationMs: number): Promise<RecordingResult>;
  /** The tab is going away mid-take: keep what landed (an INCOMPLETE answer, never nothing). */
  abandon(durationMs: number): void;
}
export interface RecordingSink {
  open(mime: string, onProgress?: (p: TakeProgress) => void): Promise<OpenTake>;
}
```

`src/components/hiring/candidate/upload-sink.ts`:
```ts
"use client";

import { apiBeacon } from "@/lib/client/api";
import { ChunkedUploader } from "@/lib/client/recorder";
import type { OpenTake, RecordingSink } from "./recording-sink";

/**
 * An answer's take: opened on the server (which counts takes), uploaded in
 * parts while the candidate talks (core recorder, iOS-safe), completed by the
 * core /media/complete, which attaches the newest take to the answer.
 */
export function uploadSink(token: string, stagePosition: number, activityId: string): RecordingSink {
  return {
    async open(mime, onProgress): Promise<OpenTake> {
      const uploader = await ChunkedUploader.open(token, "/hiring/media/init", { stagePosition, activityId, kind: "recording" }, mime, (s) => {
        const total = s.uploadedBytes + s.queuedBytes;
        onProgress?.({ ratio: total > 0 ? s.uploadedBytes / total : 0, stalled: s.stalled });
      });
      return {
        push: (chunk) => uploader.push(chunk),
        async finish(durationMs) {
          const done = await uploader.finish(durationMs);
          return { status: done.status === "INCOMPLETE" ? "INCOMPLETE" : "READY", ref: uploader.uploadRef };
        },
        abandon(durationMs) {
          apiBeacon(token, "/media/complete", { uploadRef: uploader.uploadRef, durationMs, incomplete: true });
        },
      };
    },
  };
}
```

`src/components/hiring/candidate/local-sink.ts`:
```ts
"use client";

import type { OpenTake, RecordingSink } from "./recording-sink";

/**
 * The warm-up's take (HIRING-UX 6.4, A4): kept in this tab's memory, played
 * back from a blob URL, never sent anywhere. A 30 second take is small enough
 * to hold; answers never use this.
 */
export function localSink(): RecordingSink & { release(): void } {
  const urls: string[] = [];
  return {
    async open(mime): Promise<OpenTake> {
      const chunks: Blob[] = [];
      return {
        push: (chunk) => void chunks.push(chunk),
        async finish() {
          const url = URL.createObjectURL(new Blob(chunks, { type: mime }));
          urls.push(url);
          return { status: "READY", ref: null, localUrl: url };
        },
        abandon: () => {
          chunks.length = 0;
        },
      };
    },
    release: () => {
      for (const url of urls.splice(0)) URL.revokeObjectURL(url);
    },
  };
}
```

- [ ] **Step 5: Copy**

Add to `candidate.tr.json`:
```json
"hiringMedia": {
  "videoKicker": "Video cevabı",
  "audioKicker": "Sesli cevap",
  "thinkLabel": "Düşünme süresi",
  "thinkOverFlexible": "Düşünme süren doldu. Hazır olduğunda başlat.",
  "thinkStrictNote": "Süre dolunca kayıt kendiliğinden başlar.",
  "cameraOff": "Kamera şu an kapalı.",
  "micOff": "Mikrofon şu an kapalı.",
  "notes": "Notların",
  "notesHint": "Notların yalnızca bu sayfada kalır, kimseye gitmez.",
  "start": "Hazırım, kaydı başlat",
  "starting": "Kamera açılıyor",
  "startingMic": "Mikrofon açılıyor",
  "recording": "Kayıtta",
  "recordingAudio": "Sesin kaydediliyor",
  "answerLeft": "Kalan cevap süresi",
  "uploading": "Cevabın arka planda yükleniyor · %{percent}",
  "uploadStalled": "Bağlantı yavaşladı, yüklemeyi sürdürüyoruz.",
  "finish": "Cevabı bitir",
  "autoStop": "Süre dolunca kayıt kendiliğinden biter ve cevabın kaydedilir.",
  "saving": "Kaydediliyor",
  "saved": "Kaydedildi.",
  "incomplete": "Bağlantı koptuğu için kaydın bir kısmı yüklenemedi; elimizdeki kadarı kaydedildi.",
  "reviewTitle": "Kaydını izle",
  "reviewTitleAudio": "Kaydını dinle",
  "use": "Bu cevabı kullan",
  "retake": "{count, plural, one {Tekrar çek (bir hakkın kaldı)} other {Tekrar çek (# hakkın kaldı)}}",
  "retakeFree": "Tekrar çek",
  "takesLeft": "{count, plural, =0 {Tekrar hakkın kalmadı} one {Bir tekrar hakkın var} other {# tekrar hakkın var}}",
  "singleTake": "Tek çekim: tekrar hakkı yok.",
  "noTakes": "Bu soru için çekim hakkın kalmadı.",
  "failed": "Kayıt tamamlanamadı. Hakkın gitmedi, tekrar deneyebilirsin.",
  "tryAgain": "Tekrar dene",
  "deviceError": "Kamera ya da mikrofona ulaşamadık. Adres çubuğundaki simgeden izin verip tekrar dene.",
  "useWriting": "Kamerada konuşmak yerine yazmam gerekiyor",
  "useWritingAudio": "Konuşmak yerine yazmam gerekiyor",
  "writingKicker": "Video sorusunun yazılı cevabı",
  "writingKickerAudio": "Ses sorusunun yazılı cevabı",
  "writingNote": "Yazılı cevabın ekibe bu şekilde işaretli gider ve aynı ölçütlerle değerlendirilir.",
  "tryRecording": "Kayıt ile cevaplamayı dene",
  "sendWritten": "Cevabı gönder ve devam et",
  "writtenRequired": "Önce cevabını yaz."
},
"hiringPractice": {
  "badge": "Isınma · gönderilmez, kimse görmez",
  "prompt": "Bugün nasıl geçti, kısaca anlat.",
  "why": "İstediğin kadar deneyebilirsin. Kaydın yalnızca bu sekmede kalır.",
  "ready": "Hazırım, değerlendirmeye başla",
  "skip": "Isınmayı atla"
}
```
and to `candidate.en.json`:
```json
"hiringMedia": {
  "videoKicker": "Video answer",
  "audioKicker": "Audio answer",
  "thinkLabel": "Thinking time",
  "thinkOverFlexible": "Your thinking time is over. Start when you are ready.",
  "thinkStrictNote": "Recording starts by itself when the time is up.",
  "cameraOff": "The camera is off now.",
  "micOff": "The microphone is off now.",
  "notes": "Your notes",
  "notesHint": "Your notes stay on this page and go nowhere.",
  "start": "I'm ready, start recording",
  "starting": "Opening the camera",
  "startingMic": "Opening the microphone",
  "recording": "Recording",
  "recordingAudio": "Your voice is being recorded",
  "answerLeft": "Answer time left",
  "uploading": "Your answer uploads in the background · {percent}%",
  "uploadStalled": "The connection is slow; the upload keeps going.",
  "finish": "Finish the answer",
  "autoStop": "When the time is up, recording stops by itself and your answer is saved.",
  "saving": "Saving",
  "saved": "Saved.",
  "incomplete": "Part of your recording could not upload because the connection dropped; what we have is saved.",
  "reviewTitle": "Watch your recording",
  "reviewTitleAudio": "Listen to your recording",
  "use": "Use this answer",
  "retake": "{count, plural, one {Record again (one retake left)} other {Record again (# retakes left)}}",
  "retakeFree": "Record again",
  "takesLeft": "{count, plural, =0 {No retakes left} one {One retake left} other {# retakes left}}",
  "singleTake": "One take: no retake.",
  "noTakes": "You have no takes left for this question.",
  "failed": "The recording did not finish. Your take was not used; you can try again.",
  "tryAgain": "Try again",
  "deviceError": "We could not reach the camera or microphone. Allow it from the icon in the address bar and try again.",
  "useWriting": "I need to write instead of speaking on camera",
  "useWritingAudio": "I need to write instead of speaking",
  "writingKicker": "Written answer to a video question",
  "writingKickerAudio": "Written answer to an audio question",
  "writingNote": "Your written answer reaches the team marked as such and is reviewed with the same criteria.",
  "tryRecording": "Try answering with a recording",
  "sendWritten": "Send the answer and continue",
  "writtenRequired": "Write your answer first."
},
"hiringPractice": {
  "badge": "Warm-up · not sent, nobody sees it",
  "prompt": "How has your day been? Tell us briefly.",
  "why": "Try as often as you like. Your recording stays in this tab only.",
  "ready": "I'm ready, start the assessment",
  "skip": "Skip the warm-up"
}
```

- [ ] **Step 6: The recorder screen**

`src/components/hiring/candidate/recorded-activity.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHUNK_MS, pickRecorderMime } from "@/lib/client/recorder";
import { cn } from "@/lib/cn";
import { formatCountdown } from "@/lib/timer";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";
import { ActionBar } from "./action-bar";
import { ActivityHeader } from "./activity-header";
import type { OpenTake, RecordingResult, RecordingSink, TakeProgress } from "./recording-sink";
import { trackStream } from "./streams";

type Phase = "think" | "record" | "saving" | "review" | "saved" | "failed";
const WARMUP_MS = 3000;

export type RecordedProps = {
  mode: "answer" | "practice";
  activity: Pick<CandidateActivity, "id" | "type" | "prompt" | "note" | "thinkSeconds" | "flexibleThink" | "answerSeconds" | "maxTakes" | "textAlternativeEnabled">;
  locale: Locale;
  headingRef: React.Ref<HTMLHeadingElement>;
  sink: RecordingSink;
  /** Usable takes the server already holds (a reload cannot buy new ones). */
  takesUsed: number;
  /** The newest finished take after a reload: the screen opens on its review. */
  existingRef: string | null;
  playbackSrc(result: RecordingResult): Promise<string | null>;
  onTake?(result: RecordingResult): void;
  /** "Bu cevabı kullan" (answers only); the warm-up has none. */
  onUse?(): void;
  timeUp: boolean;
  disabled: boolean;
  /** HIRING-UX A7: the written alternative, rendered and sent by the runner. */
  alternative?: { node: React.ReactNode; ready: boolean; onChoose(using: boolean): void; send(): void } | null;
};

/**
 * HIRING-UX 6.6: think with the camera off (flexible: recording does not start
 * by itself), record with a small self view, a calm "Kayıtta" dot, the answer
 * time and the upload under it, then review (use it or record again) while
 * takes are left. Retakes skip the think time. A tab that dies mid-take keeps
 * what landed. Nothing in this file reaches the network: the sink does.
 */
export function RecordedActivity(props: RecordedProps) {
  const { mode, activity, locale, headingRef, sink, playbackSrc, onTake, onUse, timeUp, disabled, alternative } = props;
  const t = useT("hiringMedia");
  const audioOnly = activity.type === "AUDIO";
  const answerMs = (activity.answerSeconds ?? 120) * 1000;
  const unlimited = !Number.isFinite(activity.maxTakes);
  const [phase, setPhase] = useState<Phase>(props.existingRef ? "review" : "think");
  const [writing, setWriting] = useState(false);
  const [used, setUsed] = useState(props.takesUsed);
  const usedRef = useRef(props.takesUsed);
  const [thinkLeft, setThinkLeft] = useState(activity.thinkSeconds * 1000);
  const [recordLeft, setRecordLeft] = useState(answerMs);
  const [progress, setProgress] = useState<TakeProgress>({ ratio: 0, stalled: false });
  const [src, setSrc] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [opening, setOpening] = useState(false);
  const self = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pending = useRef<Promise<MediaStream | null> | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const take = useRef<OpenTake | null>(null);
  const startedAt = useRef(0);
  const beginning = useRef(false);
  const retakesLeft = unlimited ? Infinity : Math.max(0, activity.maxTakes - Math.max(used, 1));

  const closeStream = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    pending.current = null;
  }, []);

  /** One stream at a time, however often it is asked for (warm-up, start, retake). */
  const openStream = useCallback(() => {
    if (stream.current?.getTracks().some((track) => track.readyState === "live")) return Promise.resolve(stream.current);
    pending.current ??= navigator.mediaDevices
      .getUserMedia(audioOnly ? { audio: true } : { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } })
      .then((media) => {
        stream.current = trackStream(media);
        return media;
      })
      .catch(() => null)
      .finally(() => {
        pending.current = null;
      });
    return pending.current;
  }, [audioOnly]);

  const finishTake = useCallback(async () => {
    const opened = take.current;
    if (!opened) return;
    setPhase("saving");
    closeStream();
    try {
      const result = await opened.finish(Date.now() - startedAt.current);
      take.current = null;
      onTake?.(result);
      if (result.status === "INCOMPLETE") setNote(t("incomplete"));
      if (unlimited || activity.maxTakes - usedRef.current > 0) {
        setSrc(await playbackSrc(result));
        setPhase("review");
      } else {
        setPhase("saved");
        if (mode === "answer") window.setTimeout(() => onUse?.(), 1000);
      }
    } catch {
      setNote(t("failed"));
      setPhase("failed");
    }
  }, [closeStream, onTake, t, unlimited, activity.maxTakes, playbackSrc, mode, onUse]);

  const begin = useCallback(async () => {
    if (beginning.current || disabled) return;
    beginning.current = true;
    setNote(null);
    setOpening(true);
    const media = await openStream();
    setOpening(false);
    if (!media) {
      setNote(t("deviceError"));
      setPhase("failed");
      beginning.current = false;
      return;
    }
    try {
      const wanted = pickRecorderMime(audioOnly ? "audio" : "video");
      const mime = wanted || (audioOnly ? "audio/webm" : "video/webm");
      const opened = await sink.open(mime, setProgress);
      take.current = opened;
      usedRef.current += 1;
      setUsed(usedRef.current);
      const rec = new MediaRecorder(media, wanted ? { mimeType: wanted } : undefined);
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) opened.push(e.data);
      };
      rec.onstop = () => void finishTake();
      rec.start(CHUNK_MS);
      startedAt.current = Date.now();
      setRecordLeft(answerMs);
      setProgress({ ratio: 0, stalled: false });
      setPhase("record");
    } catch (err) {
      const code = (err as { code?: string }).code;
      setNote(code === "TAKES_EXHAUSTED" ? t("noTakes") : t("failed"));
      setPhase("failed");
      closeStream();
    } finally {
      beginning.current = false;
    }
  }, [disabled, openStream, t, audioOnly, sink, finishTake, answerMs, closeStream]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  // A take opened before a reload: review it.
  const existing = props.existingRef;
  useEffect(() => {
    if (!existing) return;
    let cancelled = false;
    void playbackSrc({ status: "READY", ref: existing }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
    // The existing take is read once per question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  // Think time, camera off. Strict mode warms the camera up 3 s before the end and starts by itself.
  useEffect(() => {
    if (phase !== "think" || writing || activity.thinkSeconds === 0) return;
    const endsAt = Date.now() + activity.thinkSeconds * 1000;
    const id = window.setInterval(() => {
      const leftMs = Math.max(0, endsAt - Date.now());
      setThinkLeft(leftMs);
      if (!activity.flexibleThink && leftMs <= WARMUP_MS) void openStream();
      if (leftMs === 0) {
        window.clearInterval(id);
        if (!activity.flexibleThink) void begin();
      }
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, writing, activity.thinkSeconds, activity.flexibleThink]);

  // The answer clock; at its end the recording stops by itself.
  useEffect(() => {
    if (phase !== "record") return;
    const id = window.setInterval(() => {
      const leftMs = Math.max(0, startedAt.current + answerMs - Date.now());
      setRecordLeft(leftMs);
      if (leftMs === 0) {
        window.clearInterval(id);
        stop();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, answerMs, stop]);

  // The stage's time ran out: what is recorded so far is the answer.
  useEffect(() => {
    if (timeUp && phase === "record") stop();
  }, [timeUp, phase, stop]);

  // The self view shows the stream the recorder records.
  useEffect(() => {
    if (phase !== "record" || audioOnly) return;
    if (self.current && stream.current && self.current.srcObject !== stream.current) {
      self.current.srcObject = stream.current;
      void self.current.play().catch(() => undefined);
    }
  }, [phase, audioOnly]);

  // A tab that goes away mid-take keeps what landed; leaving the question closes the camera.
  useEffect(() => {
    const onHide = () => {
      if (take.current && recorder.current?.state === "recording") take.current.abandon(Date.now() - startedAt.current);
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
      closeStream();
    };
  }, [closeStream]);

  function retake() {
    setSrc(null);
    setNote(null);
    void begin();
  }

  if (writing && alternative) {
    return (
      <div className="space-y-4">
        {alternative.node}
        <p className="text-[14px] leading-[22px] text-muted">{t("writingNote")}</p>
        <ActionBar>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button id="send-written" variant="primary" size="lg" className="w-full sm:w-auto" disabled={disabled || !alternative.ready} disabledReason={t("writtenRequired")} onClick={alternative.send}>
              {t("sendWritten")}
            </Button>
            <button
              type="button"
              onClick={() => {
                setWriting(false);
                alternative.onChoose(false);
              }}
              className="min-h-11 text-[16px] text-ink underline decoration-underline underline-offset-4"
            >
              {t("tryRecording")}
            </button>
          </div>
          {!alternative.ready ? <DisabledReason id="send-written-why" className="mt-2">{t("writtenRequired")}</DisabledReason> : null}
        </ActionBar>
      </div>
    );
  }

  const takesLine = unlimited ? null : activity.maxTakes === 1 ? t("singleTake") : t("takesLeft", { count: retakesLeft });
  const writeLink =
    mode === "answer" && alternative && (phase === "think" || phase === "failed") ? (
      <button
        type="button"
        onClick={() => {
          setWriting(true);
          alternative.onChoose(true);
        }}
        className="mt-4 block min-h-11 text-[16px] text-ink underline decoration-underline underline-offset-4"
      >
        {audioOnly ? t("useWritingAudio") : t("useWriting")}
      </button>
    ) : null;

  return (
    <div className="space-y-6">
      <ActivityHeader activity={activity} locale={locale} kicker={`${audioOnly ? t("audioKicker") : t("videoKicker")}${takesLine ? ` · ${takesLine}` : ""}`} headingRef={headingRef} large />

      {phase === "think" ? (
        <div className="space-y-4">
          {activity.thinkSeconds > 0 ? (
            <div>
              <p className="text-[14px] text-muted">{t("thinkLabel")}</p>
              <p className="tnum text-[32px] leading-9 font-semibold text-accent">{formatCountdown(thinkLeft)}</p>
              <p className="mt-1 text-[16px] text-ink-2">
                {thinkLeft === 0 && activity.flexibleThink ? t("thinkOverFlexible") : !activity.flexibleThink ? t("thinkStrictNote") : audioOnly ? t("micOff") : t("cameraOff")}
              </p>
            </div>
          ) : null}
          <label className="block">
            <span className="text-[14px] font-medium text-ink">{t("notes")}</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 text-[16px] md:text-[16px]" />
            <span className="mt-1 block text-[14px] text-muted">{t("notesHint")}</span>
          </label>
          <ActionBar>
            <Button id="record-start" variant="primary" size="lg" className="w-full sm:w-auto" disabled={disabled || opening} disabledReason={audioOnly ? t("startingMic") : t("starting")} onClick={() => void begin()}>
              {opening ? (audioOnly ? t("startingMic") : t("starting")) : t("start")}
            </Button>
          </ActionBar>
        </div>
      ) : null}

      {phase === "record" || phase === "saving" ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="flex items-center gap-2 text-[16px] font-medium text-ink">
              <span className="size-2.5 rounded-full bg-ink motion-safe:animate-[rec-pulse_1.6s_ease-in-out_infinite]" aria-hidden />
              {phase === "saving" ? t("saving") : audioOnly ? t("recordingAudio") : t("recording")}
            </p>
            <p className="text-right">
              <span className="block text-[13px] text-muted">{t("answerLeft")}</span>
              <span className="tnum block text-[32px] leading-9 font-semibold text-accent">{formatCountdown(recordLeft)}</span>
            </p>
          </div>
          {!audioOnly ? <video ref={self} muted playsInline className="ml-auto aspect-[3/4] w-32 rounded-xl bg-canvas object-cover sm:aspect-video sm:w-56" /> : null}
          {mode === "answer" ? (
            <div aria-live="polite">
              <div className="h-1 rounded-full bg-hairline" aria-hidden>
                <div className="h-1 rounded-full bg-ink-3 transition-[width] duration-300" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
              </div>
              <p className="tnum mt-1 text-[14px] text-muted">{progress.stalled ? t("uploadStalled") : t("uploading", { percent: Math.round(progress.ratio * 100) })}</p>
            </div>
          ) : null}
          <p className="text-[14px] text-muted">{t("autoStop")}</p>
          <ActionBar>
            <Button id="record-finish" variant="primary" size="lg" className="w-full sm:w-auto" disabled={phase === "saving"} disabledReason={t("saving")} onClick={stop}>
              {phase === "saving" ? t("saving") : t("finish")}
            </Button>
          </ActionBar>
        </div>
      ) : null}

      {phase === "review" ? (
        <div className="space-y-4">
          <h3 className="text-[18px] font-semibold text-ink">{audioOnly ? t("reviewTitleAudio") : t("reviewTitle")}</h3>
          {src ? audioOnly ? <audio controls src={src} className="w-full" /> : <video controls playsInline src={src} className="aspect-[3/4] w-full max-w-[640px] rounded-xl bg-canvas sm:aspect-video" /> : null}
          {note ? <p className="text-[16px] text-ink">{note}</p> : null}
          <ActionBar>
            <div className="flex flex-wrap items-center gap-3">
              {mode === "answer" && onUse ? (
                <Button id="record-use" variant="primary" size="lg" className="w-full sm:w-auto" disabled={disabled} disabledReason={t("saving")} onClick={onUse}>
                  {t("use")}
                </Button>
              ) : null}
              {retakesLeft > 0 ? (
                <Button size="lg" className="w-full sm:w-auto" disabled={disabled || timeUp} disabledReason={t("saving")} onClick={retake}>
                  {unlimited ? t("retakeFree") : t("retake", { count: retakesLeft })}
                </Button>
              ) : null}
            </div>
          </ActionBar>
        </div>
      ) : null}

      {phase === "saved" ? (
        <p role="status" className={cn("text-[18px] font-medium text-ink")}>
          {t("saved")} {note}
        </p>
      ) : null}

      {phase === "failed" ? (
        <div className="space-y-3">
          <p role="alert" className="text-[16px] text-ink">
            {note ?? t("failed")}
          </p>
          {retakesLeft > 0 || used < activity.maxTakes ? (
            <ActionBar>
              <Button variant="primary" size="lg" className="w-full sm:w-auto" disabled={disabled} disabledReason={t("saving")} onClick={retake}>
                {t("tryAgain")}
              </Button>
            </ActionBar>
          ) : null}
        </div>
      ) : null}

      {writeLink}
    </div>
  );
}
```

- [ ] **Step 7: The warm-up**

`src/components/hiring/candidate/practice.tsx`:
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useStepFocus } from "@/hooks/use-step-focus";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import { ActionBar } from "./action-bar";
import { localSink } from "./local-sink";
import { RecordedActivity } from "./recorded-activity";

/**
 * HIRING-UX 6.4: the same recorder with a neutral question, 15 s to think, 30 s
 * to answer, as many takes as wanted, nothing sent (A4). After one take the
 * page's filled button leads to the assessment; before it, "Isınmayı atla".
 */
export function Practice({ token, camera, locale }: { token: string; camera: boolean; locale: Locale }) {
  const t = useT("hiringPractice");
  const sink = useMemo(() => localSink(), []);
  useEffect(() => () => sink.release(), [sink]);
  const heading = useStepFocus<HTMLHeadingElement>("practice");
  const [hasTake, setHasTake] = useState(false);
  const prompt = t("prompt");
  const next = `/a/${encodeURIComponent(token)}/stage/1`;
  return (
    <div className="mx-auto max-w-[960px] pt-8 pb-6">
      <p className="inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[14px] text-ink">{t("badge")}</p>
      <p className="mt-3 mb-6 text-[16px] leading-[26px] text-ink-2">{t("why")}</p>
      <RecordedActivity
        mode="practice"
        activity={{ id: "practice", type: camera ? "VIDEO" : "AUDIO", prompt: { tr: prompt, en: prompt }, note: { tr: "", en: "" }, thinkSeconds: 15, flexibleThink: true, answerSeconds: 30, maxTakes: Number.POSITIVE_INFINITY, textAlternativeEnabled: false }}
        locale={locale}
        headingRef={heading}
        sink={sink}
        takesUsed={0}
        existingRef={null}
        playbackSrc={async (result) => result.localUrl ?? null}
        onTake={() => setHasTake(true)}
        timeUp={false}
        disabled={false}
      />
      {hasTake ? (
        <ActionBar>
          <Button asChild variant="primary" size="lg" className="w-full sm:w-auto">
            <Link href={next}>{t("ready")}</Link>
          </Button>
        </ActionBar>
      ) : (
        <p className="mt-8">
          <Link href={next} className="inline-flex min-h-11 items-center text-[16px] text-ink underline decoration-underline underline-offset-4">
            {t("skip")}
          </Link>
        </p>
      )}
    </div>
  );
}
```

In `pages.tsx`, import `Practice` from `@/components/hiring/candidate/practice`, take `"practice"` out of the placeholder list, and add:
```tsx
    case "practice":
      return frame(<Practice token={token} camera={state.devices.camera} locale={locale} />);
```

- [ ] **Step 8: The runner records answers**

In `src/components/hiring/candidate/stage-runner.tsx`: add the imports `import { apiGet } from "@/lib/client/api";` (next to `apiSend`), `import { RecordedActivity } from "./recorded-activity";`, `import { uploadSink } from "./upload-sink";`, add `const tm = useT("hiringMedia");` under `const t = useT("hiringStage");`, and add these cases to the `switch (activity.type)` before `default`:
```tsx
    case "VIDEO":
    case "AUDIO": {
      const response = current.responses.find((r) => r.activityId === activity.id);
      const local = answers[activity.id] ?? {};
      body = (
        <RecordedActivity
          key={activity.id}
          mode="answer"
          activity={activity}
          locale={locale}
          headingRef={heading}
          sink={uploadSink(token, current.position, activity.id)}
          takesUsed={response?.takesUsed ?? 0}
          existingRef={response?.recording?.ref ?? null}
          playbackSrc={async (result) => (result.ref ? (await apiGet<{ src: string }>(token, `/hiring/media/play?ref=${encodeURIComponent(result.ref)}`)).src : null)}
          onTake={() => common.onChange({ hasTake: true })}
          onUse={() => void advance(local.usedTextAlternative ? { usedTextAlternative: true, text: local.text ?? "" } : undefined)}
          timeUp={timeUp}
          disabled={common.disabled}
          alternative={
            activity.textAlternativeEnabled
              ? {
                  node: <TextActivity {...common} alternative kicker={activity.type === "AUDIO" ? tm("writingKickerAudio") : tm("writingKicker")} />,
                  ready: answeredLocally({ type: "LONG_TEXT", minChars: null }, local),
                  onChoose: (using) => common.onChange({ usedTextAlternative: using }),
                  send: () => void advance({ usedTextAlternative: true, text: local.text ?? "" }),
                }
              : null
          }
        />
      );
      break;
    }
```
and change the comment above `default:` to `// FILE_UPLOAD arrives with Task 15.`

- [ ] **Step 9: Run the tests and the gates**

```bash
pnpm exec vitest run src/lib/client/recorder.test.ts src/components/hiring/candidate src/i18n
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
Expected: PASS; `verify:exam` unchanged (the exam's speaking upload uses the same body).

- [ ] **Step 10: Browser check (Claude in Chrome), and what needs the user**

On a fresh `kademe_ui_check` (full fixture, `pnpm dev:hiring-link`, dev server 3100):
1. Warm-up: after the device check the address is `/practice`; "Isınma · gönderilmez, kimse görmez"; "Isınmayı atla" is a link and the think timer counts 0:15 in accent. Open the network list (`read_network_requests`), clear it, press "Hazırım, kaydı başlat": if the camera opens, record, stop, play it back, record again; the list shows no request to `/api/` during the warm-up (A4). If the automation tab has no camera, the screen says "Kamera ya da mikrofona ulaşamadık..." and "Tekrar dene"; the network list is still empty.
2. "Isınmayı atla": `/stage/1` intro lists "Her soruda 20 sn düşünme süren var; süre dolunca kayıt kendiliğinden başlamaz.", "Her cevap için bir tekrar hakkın var.", "Bu aşamada önceki sorulara geri dönülmez."
3. Start: the video question shows "Video cevabı · Bir tekrar hakkın var", the think countdown, "Kamera şu an kapalı.", the notes field; at 0:00 it says "Düşünme süren doldu. Hazır olduğunda başlat." and nothing starts by itself (A5).
4. "Kamerada konuşmak yerine yazmam gerekiyor": the written alternative with its kicker and note; "Cevabı gönder ve devam et" is disabled with "Önce cevabını yaz." until text exists; send it: the next question opens; in the database `select used_text_alternative from hiring_responses order by updated_at desc limit 1` is `t` (A7).
5. Real camera and microphone, takes, review, a 10 second network cut during a take (A2), iPhone Safari and Android Chrome: "doğrulanmadı, gerçek cihazda kullanıcıyla" unless the user runs them now with you on their device (in that case write exactly what was seen, and `select status, bytes, duration_ms from media_assets order by created_at desc limit 3`).
Stop the server.

- [ ] **Step 11: Commit**

```bash
git add src/lib/client/recorder.ts src/lib/client/recorder.test.ts src/app/globals.css src/components/hiring/candidate/recording-sink.ts src/components/hiring/candidate/upload-sink.ts src/components/hiring/candidate/local-sink.ts src/components/hiring/candidate/recorded-activity.tsx src/components/hiring/candidate/practice.tsx src/components/hiring/candidate/practice.test.ts src/components/hiring/candidate/stage-runner.tsx src/solutions/hiring/candidate/pages.tsx src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Record hiring video and audio answers, and add the warm-up

Think with the camera off (recording never starts by itself in flexible
mode), record with a small self view and a calm dot while parts upload,
review the take from storage and use it or record again while takes are
left, or answer in writing where the team allows it. The warm-up uses the
same recorder with an in-memory sink and sends nothing.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: File answers (HIRING-UX 6.9)

**Files:**
- Create: `src/components/hiring/candidate/file-rules.ts` (+ `file-rules.test.ts`), `src/components/hiring/candidate/file-activity.tsx`
- Modify: `src/components/hiring/candidate/stage-runner.tsx` (FILE_UPLOAD)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringFile`)

**Interfaces:**
- Consumes: Task 13 `ActivityProps`, `ActivityHeader`; Task 14 `ChunkedUploader.open` with a body; Task 9 `media/init` (kind `file`); core `/media/part*`, `/media/complete`.
- Produces: `file-rules.ts`: `mimeLabel(mime: string): string`, `typeList(accepted: string[] | null, locale: Locale): string | null`, `type FileProblem = "type" | "size" | "empty"`, `fileProblem(file: { type: string; size: number }, accepted: string[] | null, maxBytes: number | null): FileProblem | null`, `megabytes(bytes: number, locale: Locale): string`; `<FileActivity {...ActivityProps} existing={{ name, bytes } | null} />`.

- [ ] **Step 1: Write the failing test**

`src/components/hiring/candidate/file-rules.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fileProblem, megabytes, mimeLabel, typeList } from "./file-rules";

describe("what a file question takes (HIRING-UX 6.9)", () => {
  it("names types the way people know them", () => {
    expect(mimeLabel("application/pdf")).toBe("PDF");
    expect(mimeLabel("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCX");
    expect(mimeLabel("image/png")).toBe("PNG");
    expect(mimeLabel("text/csv")).toBe("CSV");
    expect(typeList(["application/pdf", "image/png", "image/jpeg"], "en")).toBe("PDF, PNG or JPG");
    expect(typeList(["application/pdf", "image/png", "image/jpeg"], "tr")).toBe("PDF, PNG veya JPG");
    expect(typeList([], "tr")).toBeNull();
  });

  it("says the size in megabytes in the candidate's language", () => {
    expect(megabytes(20 * 1024 * 1024, "tr")).toBe("20");
    expect(megabytes(1.5 * 1024 * 1024, "tr")).toBe("1,5");
    expect(megabytes(1.5 * 1024 * 1024, "en")).toBe("1.5");
  });

  it("refuses a wrong type, a file over the size and an empty file before uploading", () => {
    expect(fileProblem({ type: "image/png", size: 10 }, ["application/pdf"], 1000)).toBe("type");
    expect(fileProblem({ type: "application/pdf", size: 1001 }, ["application/pdf"], 1000)).toBe("size");
    expect(fileProblem({ type: "application/pdf", size: 0 }, ["application/pdf"], 1000)).toBe("empty");
    expect(fileProblem({ type: "application/pdf", size: 10 }, ["application/pdf"], 1000)).toBeNull();
    expect(fileProblem({ type: "", size: 10 }, null, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/components/hiring/candidate/file-rules.test.ts`
Expected: FAIL with `Failed to resolve import "./file-rules"`.

- [ ] **Step 3: The rules**

`src/components/hiring/candidate/file-rules.ts`:
```ts
import type { Locale } from "@/i18n/locale";

const LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "application/zip": "ZIP",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "text/plain": "TXT",
  "text/csv": "CSV",
};

/** "PDF" for application/pdf; an unknown type by its own short name. */
export const mimeLabel = (mime: string) => LABELS[mime] ?? (mime.split("/")[1] ?? mime).toUpperCase();

/** "PDF, DOCX ya da PNG" in the candidate's language; null when any type is fine. */
export function typeList(accepted: string[] | null, locale: Locale): string | null {
  if (!accepted || accepted.length === 0) return null;
  return new Intl.ListFormat(locale === "tr" ? "tr-TR" : "en-GB", { type: "disjunction" }).format(accepted.map(mimeLabel));
}

export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export function megabytes(bytes: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

export type FileProblem = "type" | "size" | "empty";

/** Checked before the upload; the server checks the same again (and the stored size on completion). */
export function fileProblem(file: { type: string; size: number }, accepted: string[] | null, maxBytes: number | null): FileProblem | null {
  if (file.size <= 0) return "empty";
  if (accepted && accepted.length > 0 && !accepted.includes(file.type)) return "type";
  if (file.size > (maxBytes ?? DEFAULT_MAX_BYTES)) return "size";
  return null;
}
```

(Checked on this machine's Node ICU: en-GB prints "PDF, PNG or JPG", tr-TR "PDF, PNG veya JPG".)

- [ ] **Step 4: Copy**

Add to `candidate.tr.json`:
```json
"hiringFile": {
  "kicker": "Dosya yükleme",
  "drop": "Dosyayı buraya bırak ya da seç.",
  "choose": "Dosya seç",
  "change": "Değiştir",
  "limits": "{types} · en fazla {mb} MB",
  "limitsAny": "En fazla {mb} MB",
  "uploading": "Yükleniyor · %{percent}",
  "uploaded": "{name} · yüklendi",
  "wrongType": "Bu dosya türü kabul edilmiyor. {types} yükle.",
  "tooBig": "Bu dosya {mb} MB'tan büyük. Daha küçük bir dosya yükle.",
  "empty": "Dosya boş görünüyor. Başka bir dosya seç.",
  "failed": "Dosya yüklenemedi. Tekrar dener misin?"
}
```
and to `candidate.en.json`:
```json
"hiringFile": {
  "kicker": "File upload",
  "drop": "Drop the file here or choose it.",
  "choose": "Choose a file",
  "change": "Change",
  "limits": "{types} · up to {mb} MB",
  "limitsAny": "Up to {mb} MB",
  "uploading": "Uploading · {percent}%",
  "uploaded": "{name} · uploaded",
  "wrongType": "This file type is not accepted. Upload {types}.",
  "tooBig": "This file is larger than {mb} MB. Upload a smaller one.",
  "empty": "The file looks empty. Choose another one.",
  "failed": "The file did not upload. Could you try again?"
}
```

- [ ] **Step 5: The file question**

`src/components/hiring/candidate/file-activity.tsx`:
```tsx
"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { ChunkedUploader } from "@/lib/client/recorder";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import { ActivityHeader } from "./activity-header";
import { DEFAULT_MAX_BYTES, fileProblem, megabytes, typeList } from "./file-rules";
import type { ActivityProps } from "./text-activity";

/** Above the 5 MiB multipart floor of object storage; local disk takes any size. */
const SLICE_BYTES = 8 * 1024 * 1024;

/**
 * HIRING-UX 6.9: a drop area and "Dosya seç", the accepted types and the size
 * written up front, a progress bar, "Değiştir". The upload is the core's
 * multipart path; the server attaches the file under the candidate's name only
 * once it is complete and within its size.
 */
export function FileActivity({ token, position, activity, locale, headingRef, onChange, disabled, existing }: ActivityProps & { existing: { name: string; bytes: number } | null }) {
  const t = useT("hiringFile");
  const input = useRef<HTMLInputElement | null>(null);
  const [current, setCurrent] = useState(existing);
  const [percent, setPercent] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const accepted = activity.acceptedMimeTypes;
  const max = activity.maxFileBytes ?? DEFAULT_MAX_BYTES;
  const types = typeList(accepted, locale);
  const mb = megabytes(max, locale);

  async function upload(file: File) {
    const found = fileProblem(file, accepted, max);
    if (found) {
      setProblem(found === "type" ? t("wrongType", { types: types ?? "" }) : found === "size" ? t("tooBig", { mb }) : t("empty"));
      return;
    }
    setProblem(null);
    setPercent(0);
    onChange({ hasFile: false });
    try {
      const uploader = await ChunkedUploader.open(
        token,
        "/hiring/media/init",
        { stagePosition: position, activityId: activity.id, kind: "file", name: file.name, bytes: file.size },
        file.type || "application/octet-stream",
        (s) => setPercent(Math.round((s.uploadedBytes / file.size) * 100)),
      );
      for (let offset = 0; offset < file.size; offset += SLICE_BYTES) uploader.push(file.slice(offset, offset + SLICE_BYTES));
      const done = await uploader.finish(0);
      if (done.status !== "READY") throw new Error("incomplete");
      setCurrent({ name: file.name, bytes: file.size });
      onChange({ hasFile: true });
    } catch (err) {
      const code = (err as { code?: string }).code;
      setProblem(code === "FILE_TOO_LARGE" ? t("tooBig", { mb }) : code === "NOT_A_FILE" ? t("wrongType", { types: types ?? "" }) : code === "FILE_EMPTY" ? t("empty") : t("failed"));
      onChange({ hasFile: current !== null });
    } finally {
      setPercent(null);
    }
  }

  return (
    <div className="space-y-5">
      <ActivityHeader activity={activity} locale={locale} kicker={t("kicker")} headingRef={headingRef} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !disabled && percent === null) void upload(file);
        }}
        className={cn("rounded-2xl border border-dashed border-input bg-surface p-card-candidate text-center", over && "border-ink bg-canvas")}
      >
        <FileUp className="mx-auto size-6 text-muted" strokeWidth={1.5} aria-hidden />
        <p className="mt-2 text-[16px] text-ink-2">{t("drop")}</p>
        <p className="tnum mt-1 text-[14px] text-muted">{types ? t("limits", { types, mb }) : t("limitsAny", { mb })}</p>
        <input
          ref={input}
          type="file"
          hidden
          accept={accepted?.join(",") || undefined}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        <Button className="mt-4" disabled={disabled || percent !== null} disabledReason={t("uploading", { percent: percent ?? 0 })} onClick={() => input.current?.click()}>
          {current ? t("change") : t("choose")}
        </Button>
      </div>
      {percent !== null ? (
        <div aria-live="polite">
          <div className="h-1 rounded-full bg-hairline" aria-hidden>
            <div className="h-1 rounded-full bg-ink-3 transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
          <p className="tnum mt-1 text-[14px] text-muted">{t("uploading", { percent })}</p>
        </div>
      ) : null}
      {current && percent === null ? (
        <p role="status">
          <StatusDot tone="done" className="text-[16px] text-ink">
            {t("uploaded", { name: current.name })}
          </StatusDot>
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-[16px] text-ink">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
```

In `stage-runner.tsx`, import `FileActivity` from `./file-activity`, add before `default`:
```tsx
    case "FILE_UPLOAD": {
      const response = current.responses.find((r) => r.activityId === activity.id);
      body = <FileActivity key={activity.id} {...common} existing={response?.file ?? null} />;
      break;
    }
```
and remove the `// FILE_UPLOAD arrives with Task 15.` comment (the `default` branch stays, returning `null`, for an unknown future type).

- [ ] **Step 6: Run the tests and the gates**

```bash
pnpm exec vitest run src/components/hiring/candidate src/i18n
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS.

- [ ] **Step 7: Browser check (Claude in Chrome)**

Full fixture on a fresh `kademe_ui_check`; get to stage 2 (use the written alternative for the video, then the choice and the long text). The file question reads "PDF · en fazla 1 MB". Use `mcp__claude-in-chrome__file_upload` with a small PNG: "Bu dosya türü kabul edilmiyor. PDF yükle." and no `/hiring/media/init` request; with a small PDF named `Plan Taslağı.pdf`: the bar fills, "Plan Taslağı.pdf · yüklendi", "Değiştir"; `select payload->'file' from hiring_responses where payload ? 'file'` shows the name; "Sonraki soru" is enabled only after the upload. At 390px the area and the button fit. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add src/components/hiring/candidate/file-rules.ts src/components/hiring/candidate/file-rules.test.ts src/components/hiring/candidate/file-activity.tsx src/components/hiring/candidate/stage-runner.tsx src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Take hiring file answers

The accepted types and size are said up front, a wrong type or size is
refused before anything uploads, the file goes through the core multipart
path with a progress bar, and Değiştir replaces it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: The finish, with a dated promise and the survey (HIRING-UX 6.13, A9)

**Files:**
- Create: `src/components/hiring/candidate/done.tsx`
- Modify: `src/solutions/hiring/candidate/pages.tsx` (the `done` case; the placeholder list is gone), `src/solutions/hiring/candidate/pages.test.ts`
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringDone`)

**Interfaces:**
- Consumes: Task 5 `finished.feedbackBy`, `finished.survey`; Task 9 `POST /hiring/survey`; Task 12 `stopAllStreams`; `shortDate`.
- Produces: `<Done token state feedbackBy />` (client); `renderHiringPage("done", ...)` for a COMPLETED link.

- [ ] **Step 1: Write the failing test**

Append to `src/solutions/hiring/candidate/pages.test.ts`:
```ts
vi.mock("@/components/hiring/candidate/done", () => ({ Done: function Done() {} }));
import { Done } from "@/components/hiring/candidate/done";

describe("the finish page", () => {
  it("opens on a finished (COMPLETED) link with the promise date in the organisation's zone", async () => {
    h.state = {
      step: "DONE",
      position: null,
      path: "/done",
      orgName: "Örnek A.Ş.",
      finished: { completedAt: "2026-10-05T09:00:00.000Z", stagesDone: 2, feedbackBy: "2026-10-12T22:30:00.000Z", survey: { enabled: true, answered: false } },
    };
    const page = (await renderHiringPage("done", { token: "tok", resolved: { ok: false, problem: "COMPLETED", ctx } as never, searchParams: {}, params: {} })) as ReactNode;
    const [done] = find(page, Done);
    // 22:30 UTC is already 13 Oct in Istanbul.
    expect((done.props as { feedbackBy: string }).feedbackBy).toBe("13 Eki");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/solutions/hiring/candidate/pages.test.ts`
Expected: FAIL (the `done` slot still renders the placeholder card; `Done` not found).

- [ ] **Step 3: Copy**

Add to `candidate.tr.json`:
```json
"hiringDone": {
  "title": "Tamamlandı, teşekkürler {name}.",
  "titleNoName": "Tamamlandı, teşekkürler.",
  "saved": "{count, plural, one {Aşaman kaydedildi ve ekibe iletildi.} other {# aşamanın hepsi kaydedildi ve ekibe iletildi.}}",
  "next": "{count, plural, one {Cevaplarını ekipten bir kişi değerlendirecek.} other {Cevaplarını ekipten # kişi değerlendirecek.}}",
  "byDate": "{date} tarihine kadar sana dönülecek.",
  "contact": "Sorun olursa: {email}",
  "devicesOff": "Kamera ve mikrofon kapatıldı.",
  "surveyTitle": "Bu deneyim nasıldı?",
  "surveyLow": "Hiç iyi değildi",
  "surveyHigh": "Çok iyiydi",
  "surveyComment": "Eklemek istediğin bir şey var mı? (isteğe bağlı)",
  "surveyNote": "Cevabın değerlendirmeni etkilemez; ekip yalnızca toplu sonucu görür.",
  "surveySend": "Görüşünü gönder",
  "surveySending": "Gönderiliyor",
  "surveyPick": "Önce 1 ile 5 arasında bir puan seç.",
  "surveyThanks": "Teşekkürler, görüşün iletildi.",
  "surveyFailed": "Gönderilemedi. Tekrar dener misin?",
  "rights": "Veri hakların"
}
```
and to `candidate.en.json`:
```json
"hiringDone": {
  "title": "Done, thank you {name}.",
  "titleNoName": "Done, thank you.",
  "saved": "{count, plural, one {Your stage is saved and sent to the team.} other {All # stages are saved and sent to the team.}}",
  "next": "{count, plural, one {One person on the team will review your answers.} other {# people on the team will review your answers.}}",
  "byDate": "You will hear back by {date}.",
  "contact": "If something is wrong: {email}",
  "devicesOff": "The camera and microphone are off.",
  "surveyTitle": "How was this experience?",
  "surveyLow": "Not good at all",
  "surveyHigh": "Very good",
  "surveyComment": "Anything to add? (optional)",
  "surveyNote": "Your answer does not affect your assessment; the team only sees the overall result.",
  "surveySend": "Send your feedback",
  "surveySending": "Sending",
  "surveyPick": "Choose a rating from 1 to 5 first.",
  "surveyThanks": "Thank you, your feedback was sent.",
  "surveyFailed": "It did not send. Could you try again?",
  "rights": "Your data rights"
}
```

- [ ] **Step 4: The finish screen**

`src/components/hiring/candidate/done.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { ActionBar } from "./action-bar";
import { stopAllStreams } from "./streams";

/**
 * HIRING-UX 6.13: done, thanks, what happens next, by when and who to write
 * to; the devices are switched off first and the candidate is told so; then
 * the optional survey. Without the survey the page has no filled button: it is
 * a closing page. (The decision's status line arrives with plan 3.)
 */
export function Done({ token, state, feedbackBy }: { token: string; state: HiringCandidateState; feedbackBy: string }) {
  const t = useT("hiringDone");
  const finished = state.finished!;
  const [devicesOff, setDevicesOff] = useState(false);
  const [rating, setRating] = useState<string>("");
  const [comment, setComment] = useState("");
  const [survey, setSurvey] = useState<"open" | "sending" | "sent" | "failed">(finished.survey.answered ? "sent" : "open");

  useEffect(() => {
    stopAllStreams();
    // The tracks this tab opened are stopped above; only then is it said.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevicesOff(true);
  }, []);

  async function send() {
    setSurvey("sending");
    try {
      await apiSend(token, "/hiring/survey", { rating: Number(rating), comment });
      setSurvey("sent");
    } catch (err) {
      setSurvey((err as { code?: string }).code === "ALREADY_ANSWERED" ? "sent" : "failed");
    }
  }

  const showSurvey = finished.survey.enabled;
  return (
    <div className="mx-auto max-w-[640px] pt-10 pb-6 sm:pt-14">
      <h1 className="text-[28px] leading-9 font-semibold text-ink">{state.candidateName ? t("title", { name: state.candidateName }) : t("titleNoName")}</h1>
      <p className="mt-3 text-[16px] leading-[26px] text-ink">{t("saved", { count: finished.stagesDone })}</p>
      <div className="mt-6 space-y-2 rounded-2xl border border-line bg-surface p-card-candidate text-[16px] leading-[26px] text-ink">
        <p>{t("next", { count: state.reviewers })}</p>
        <p className="tnum font-medium">{t("byDate", { date: feedbackBy })}</p>
        {state.contactEmail ? <p>{t("contact", { email: state.contactEmail })}</p> : null}
      </div>
      {devicesOff && state.devices.microphone ? (
        <p role="status" className="mt-4 flex items-center gap-2 text-[14px] text-muted">
          <span className="size-1.5 rounded-full bg-ink-3" aria-hidden />
          {t("devicesOff")}
        </p>
      ) : null}

      {showSurvey ? (
        <section className="mt-10">
          <h2 className="text-[20px] leading-7 font-semibold text-ink">{t("surveyTitle")}</h2>
          {survey === "sent" ? (
            <p role="status" className="mt-3 text-[16px] text-ink">
              {t("surveyThanks")}
            </p>
          ) : (
            <>
              <RadioGroup value={rating} onValueChange={setRating} aria-label={t("surveyTitle")} className="mt-4 grid grid-cols-5 gap-2">
                {["1", "2", "3", "4", "5"].map((value) => (
                  <label key={value} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[16px] text-ink has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-brand-soft">
                    <RadioGroupItem value={value} className="sr-only" />
                    <span className="tnum">{value}</span>
                  </label>
                ))}
              </RadioGroup>
              <div className="mt-1 flex justify-between text-[14px] text-muted">
                <span>{t("surveyLow")}</span>
                <span>{t("surveyHigh")}</span>
              </div>
              <label className="mt-4 block">
                <span className="text-[14px] font-medium text-ink">{t("surveyComment")}</span>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 1000))} rows={3} className="mt-1 text-[16px] md:text-[16px]" />
              </label>
              <p className="mt-2 text-[14px] text-muted">{t("surveyNote")}</p>
              <ActionBar>
                <Button id="survey-send" variant="primary" size="lg" className="w-full sm:w-auto" disabled={!rating || survey === "sending"} disabledReason={t("surveyPick")} onClick={send}>
                  {survey === "sending" ? t("surveySending") : t("surveySend")}
                </Button>
                {!rating ? <DisabledReason id="survey-send-why" className="mt-2">{t("surveyPick")}</DisabledReason> : null}
                {survey === "failed" ? (
                  <p role="alert" className="mt-2 text-[14px] text-ink">
                    {t("surveyFailed")}
                  </p>
                ) : null}
              </ActionBar>
            </>
          )}
        </section>
      ) : null}

      <p className="mt-10 text-center text-[14px]">
        <a href={`/a/${encodeURIComponent(token)}/rights`} className="inline-flex min-h-11 items-center text-muted underline decoration-underline underline-offset-4 hover:text-ink">
          {t("rights")}
        </a>
      </p>
    </div>
  );
}
```

In `pages.tsx`, import `Done` from `@/components/hiring/candidate/done`, delete the placeholder `case` group, and add:
```tsx
    case "done":
      return frame(<Done token={token} state={safe} feedbackBy={state.finished ? shortDate(new Date(state.finished.feedbackBy), locale) : ""} />);
```
(After this task every slot renders its own screen; the switch is exhaustive, so TypeScript stops any slot from being forgotten.)

- [ ] **Step 5: Run the tests and the gates**

```bash
pnpm exec vitest run src/solutions/hiring/candidate src/components/hiring/candidate src/i18n
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS.

- [ ] **Step 6: Browser check (Claude in Chrome)**

`--kind written` link on a fresh `kademe_ui_check`; walk to the end (Task 13 Step 10) and let the 8 second delay pass: `/done` shows "Tamamlandı, teşekkürler Elif Kaya.", "2 aşamanın hepsi kaydedildi ve ekibe iletildi.", "Cevaplarını ekipten bir kişi değerlendirecek.", "<date> tarihine kadar sana dönülecek." (7 days after today, in Turkish), the contact line, the survey with "Görüşünü gönder" disabled until a number is chosen; choose 5 and a comment, send: "Teşekkürler, görüşün iletildi."; reload: the survey stays answered; open the original link again: the same `/done` page (A9: the same link is the way back). English: every line switches. Stop the server; drop `kademe_ui_check`.

- [ ] **Step 7: Commit**

```bash
git add src/components/hiring/candidate/done.tsx src/solutions/hiring/candidate/pages.tsx src/solutions/hiring/candidate/pages.test.ts src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Close the hiring flow with a dated promise and the survey

The finish page says everything was sent, who reviews it, by when the
candidate hears back and who to write to, switches the devices off and
says so, and offers the optional survey once. The same link brings the
candidate back here.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Inviting from the panel: page and Sheet, one candidate or a pasted list (HIRING-UX 5.11)

**Files:**
- Modify: `src/solutions/hiring/server/invitations.ts` (+ `invitations.test.ts`): `invitableOpenings`
- Create: `src/components/hiring/invite/form-rules.ts` (+ `form-rules.test.ts`), `src/components/hiring/invite/invite-form.tsx`, `src/components/hiring/invite/invite-sheet.tsx`, `src/components/hiring/invite/copy-field.tsx`
- Create: `src/app/(manager)/hiring/invite/page.tsx`, `src/app/(manager)/hiring/invite/actions.ts` (+ `actions.test.ts`)
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (`hiringInvite`)

**Interfaces:**
- Consumes: Task 6 (`parseInviteRows`, `isEmail`, `InviteRow`, `MAX_INVITE_ROWS`); Task 7 (`createHiringInvitation`, `InviteRefusal`); `loadOpening` (`server/openings`), `openingAccess`, `can`, `requireUser`, `managerLocale`, `managerT`, `useMT`, `PageTitle`, `orgDay`, `zoneLabel`, shadcn `Sheet`, `Input`, `Label`, `Textarea`, `RadioGroup`, `Select`, `Button`, `DisabledReason`.
- Produces:
  - `invitableOpenings(orgId: string): Promise<InviteOpening[]>` with `type InviteOpening = { id: string; name: string; live: boolean; evaluators: number; deadlineDay: string | null }` (exported from `form-rules.ts`, client-safe).
  - `form-rules.ts`: `type FormReason = "noOpening" | "notPublished" | "noEvaluators" | "deadline" | "name" | "email" | "noRows" | "rows"`; `inviteReason(input: { opening: InviteOpening | null; mode: "single" | "many"; fullName: string; email: string; rows: InviteRow[]; deadline: string | null; today: string }): FormReason | null`.
  - Actions: `inviteCandidateAction(input: unknown): Promise<InviteOneResult>` and `inviteManyAction(input: unknown): Promise<{ results: Array<{ line: number; fullName: string; email: string; result: InviteOneResult }> }>` with `type InviteOneResult = { ok: true; url: string; name: string; expires: string; message: { subject: string; body: string } } | { ok: false; code: InviteRefusal | "FORBIDDEN" | "FAILED"; existing?: { invitedAt: string } }`.
  - `<InviteForm openings initialOpeningId today zone onDone? />`, `<InviteSheet opening today zone label />` (its trigger is the page's filled "Aday davet et"), `<CopyField label value />`.
  - Route `/hiring/invite?opening=<id>`.

- [ ] **Step 1: Write the failing tests**

`src/components/hiring/invite/form-rules.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseInviteRows } from "@/solutions/hiring/rules/invitation";
import { inviteReason, type InviteOpening } from "./form-rules";

const opening: InviteOpening = { id: "o", name: "Tasarımcı · Ekim", live: true, evaluators: 2, deadlineDay: null };
const base = { opening, mode: "single" as const, fullName: "Elif Kaya", email: "elif@example.com", rows: [], deadline: null, today: "2026-10-05" };

describe("why the invite button waits (HIRING-UX 5.11 early validation)", () => {
  it("names the opening's problem first", () => {
    expect(inviteReason({ ...base, opening: null })).toBe("noOpening");
    expect(inviteReason({ ...base, opening: { ...opening, live: false } })).toBe("notPublished");
    expect(inviteReason({ ...base, opening: { ...opening, evaluators: 0 } })).toBe("noEvaluators");
  });

  it("then the deadline, then the person", () => {
    expect(inviteReason({ ...base, deadline: "2026-10-04" })).toBe("deadline");
    expect(inviteReason({ ...base, fullName: "E" })).toBe("name");
    expect(inviteReason({ ...base, email: "elif@" })).toBe("email");
    expect(inviteReason(base)).toBeNull();
  });

  it("for a pasted list, needs rows and no marked row", () => {
    expect(inviteReason({ ...base, mode: "many" })).toBe("noRows");
    expect(inviteReason({ ...base, mode: "many", rows: parseInviteRows("Elif Kaya, elif@example.com\nAli, ali@").rows })).toBe("rows");
    expect(inviteReason({ ...base, mode: "many", rows: parseInviteRows("Elif Kaya, elif@example.com").rows })).toBeNull();
  });
});
```

Append to `src/solutions/hiring/server/invitations.test.ts`:
```ts
import { invitableOpenings } from "./invitations";

describe("invitableOpenings", () => {
  it("lists the organisation's open openings with whether they are live and how many active evaluators they have", async () => {
    fake.respond = (op) => {
      if (op.table === "hiring_openings") return [{ id: "o1", name: "A", deadlineAt: null }, { id: "o2", name: "B", deadlineAt: new Date("2026-10-20T20:59:59Z") }];
      if (op.table === "hiring_versions") return [{ openingId: "o1" }];
      if (op.table === "hiring_opening_members") return [{ openingId: "o1", count: 2 }];
      return [];
    };
    expect(await invitableOpenings(ORG)).toEqual([
      { id: "o1", name: "A", live: true, evaluators: 2, deadlineDay: null },
      { id: "o2", name: "B", live: false, evaluators: 0, deadlineDay: "2026-10-20" },
    ]);
    const read = fake.ops.find((o) => o.table === "hiring_openings")!;
    expect(read.params).toEqual(expect.arrayContaining([ORG, "OPEN"]));
  });
});
```

`src/app/(manager)/hiring/invite/actions.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  user: { id: "u", orgId: "o", email: "", name: "", role: "MANAGER" as "OWNER" | "MANAGER" | "REVIEWER" },
  opening: { id: "11111111-1111-4111-8111-111111111111", status: "OPEN", decisionMakerId: null, backupDecisionMakerId: null, memberIds: [] as string[] } as Record<string, unknown> | null,
  create: vi.fn(),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/server/session", () => ({ requireUser: async () => h.user }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "tr" }));
vi.mock("@/solutions/hiring/server/openings", () => ({ loadOpening: async () => h.opening }));
vi.mock("@/solutions/hiring/server/invitations", () => ({ createHiringInvitation: h.create }));

import { inviteCandidateAction, inviteManyAction } from "./actions";

const input = { openingId: "11111111-1111-4111-8111-111111111111", fullName: "Elif Kaya", email: "elif@example.com", locale: "tr", deadline: null };

beforeEach(() => {
  h.user.role = "MANAGER";
  h.opening = { id: input.openingId, status: "OPEN", decisionMakerId: null, backupDecisionMakerId: null, memberIds: [] };
  h.create.mockReset();
  h.create.mockResolvedValue({ ok: true, assessmentId: "a", candidateId: "c", url: "https://k/a/x", expiresAt: new Date("2026-10-19T20:59:59Z"), message: { subject: "s", body: "b" } });
});

describe("inviteCandidateAction", () => {
  it("refuses a reviewer before anything is written", async () => {
    h.user.role = "REVIEWER";
    expect(await inviteCandidateAction(input)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(h.create).not.toHaveBeenCalled();
  });

  it("refuses a closed opening and an opening of another organisation", async () => {
    h.opening = { ...h.opening!, status: "CLOSED" };
    expect(await inviteCandidateAction(input)).toEqual({ ok: false, code: "CLOSED" });
    h.opening = null;
    expect(await inviteCandidateAction(input)).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("invites with the session's organisation and user, and gives the link once with its day in the org's zone", async () => {
    const result = await inviteCandidateAction(input);
    expect(h.create).toHaveBeenCalledWith({ id: "u", orgId: "o" }, { openingId: input.openingId, fullName: "Elif Kaya", email: "elif@example.com", locale: "tr", deadline: null, allowDuplicate: false });
    expect(result).toEqual({ ok: true, url: "https://k/a/x", name: "Elif Kaya", expires: "19 Eki", message: { subject: "s", body: "b" } });
  });

  it("refuses malformed input", async () => {
    expect(await inviteCandidateAction({ ...input, locale: "de" })).toEqual({ ok: false, code: "FAILED" });
  });
});

describe("inviteManyAction", () => {
  it("invites each valid row on its own and reports each result", async () => {
    h.create.mockResolvedValueOnce({ ok: false, code: "DUPLICATE", existing: { assessmentId: "x", invitedAt: new Date("2026-10-01T10:00:00Z") } });
    const { results } = await inviteManyAction({ openingId: input.openingId, text: "Elif Kaya, elif@example.com\nCan Demir, can@example.com\nBozuk, bozuk@", locale: "en", deadline: null });
    expect(results.map((r) => [r.line, r.result.ok])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(h.create).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/components/hiring/invite/form-rules.test.ts src/solutions/hiring/server/invitations.test.ts "src/app/(manager)/hiring/invite/actions.test.ts"`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Rules and the server read**

`src/components/hiring/invite/form-rules.ts`:
```ts
import { isEmail, type InviteRow } from "@/solutions/hiring/rules/invitation";

export type InviteOpening = { id: string; name: string; live: boolean; evaluators: number; deadlineDay: string | null };
export type FormReason = "noOpening" | "notPublished" | "noEvaluators" | "deadline" | "name" | "email" | "noRows" | "rows";

/**
 * HIRING-UX 5.11 "Erken doğrulama": the one reason the invite button waits,
 * the opening's first (published? a team?), then the day, then the person or
 * the pasted list. The server checks all of it again.
 */
export function inviteReason(input: {
  opening: InviteOpening | null;
  mode: "single" | "many";
  fullName: string;
  email: string;
  rows: InviteRow[];
  deadline: string | null;
  today: string;
}): FormReason | null {
  if (!input.opening) return "noOpening";
  if (!input.opening.live) return "notPublished";
  if (input.opening.evaluators === 0) return "noEvaluators";
  if (input.deadline && input.deadline < input.today) return "deadline";
  if (input.mode === "single") {
    if (input.fullName.trim().length < 2) return "name";
    if (!isEmail(input.email)) return "email";
    return null;
  }
  if (input.rows.length === 0) return "noRows";
  if (input.rows.some((r) => r.problem !== null)) return "rows";
  return null;
}
```

Append to `src/solutions/hiring/server/invitations.ts` (add `hiringVersions` to the schema import):
```ts
/** The organisation's OPEN openings with what the invite form needs (only callers who run openings use it). */
export async function invitableOpenings(orgId: string): Promise<Array<{ id: string; name: string; live: boolean; evaluators: number; deadlineDay: string | null }>> {
  const rows = await db
    .select({ id: hiringOpenings.id, name: hiringOpenings.name, deadlineAt: hiringOpenings.deadlineAt })
    .from(hiringOpenings)
    .where(and(eq(hiringOpenings.orgId, orgId), eq(hiringOpenings.status, "OPEN")))
    .orderBy(desc(hiringOpenings.createdAt), desc(hiringOpenings.id));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [live, members] = await Promise.all([
    db
      .select({ openingId: hiringVersions.openingId })
      .from(hiringVersions)
      .where(and(inArray(hiringVersions.openingId, ids), eq(hiringVersions.orgId, orgId), eq(hiringVersions.status, "PUBLISHED"))),
    db
      .select({ openingId: hiringOpeningMembers.openingId, count: sql<number>`count(*)::int` })
      .from(hiringOpeningMembers)
      .innerJoin(users, and(eq(users.id, hiringOpeningMembers.userId), eq(users.orgId, orgId), isNull(users.disabledAt)))
      .where(inArray(hiringOpeningMembers.openingId, ids))
      .groupBy(hiringOpeningMembers.openingId),
  ]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    live: live.some((v) => v.openingId === r.id),
    evaluators: Number(members.find((m) => m.openingId === r.id)?.count ?? 0),
    deadlineDay: r.deadlineAt ? orgDay(r.deadlineAt) : null,
  }));
}
```

- [ ] **Step 4: Actions**

`src/app/(manager)/hiring/invite/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/lib/authorize";
import { shortDate } from "@/lib/format";
import { managerLocale } from "@/i18n/manager-locale";
import { requireUser } from "@/server/session";
import { openingAccess } from "@/solutions/hiring/rules/access";
import { parseInviteRows } from "@/solutions/hiring/rules/invitation";
import { createHiringInvitation, type InviteRefusal } from "@/solutions/hiring/server/invitations";
import { loadOpening } from "@/solutions/hiring/server/openings";

export type InviteOneResult =
  | { ok: true; url: string; name: string; expires: string; message: { subject: string; body: string } }
  | { ok: false; code: InviteRefusal | "FORBIDDEN" | "FAILED"; existing?: { invitedAt: string } };

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const oneSchema = z.object({ openingId: z.uuid(), fullName: z.string().max(120), email: z.string().max(160), locale: z.enum(["tr", "en"]), deadline: day, allowDuplicate: z.boolean().optional() });
const manySchema = z.object({ openingId: z.uuid(), text: z.string().max(20_000), locale: z.enum(["tr", "en"]), deadline: day });

/** Who may invite here: someone who runs openings (opening:write), on an opening of their organisation that is not closed. */
async function gate(openingId: string) {
  const user = await requireUser();
  if (!can(user, "opening:write")) return { ok: false as const, code: "FORBIDDEN" as const };
  const opening = await loadOpening(user.orgId, openingId);
  if (!opening) return { ok: false as const, code: "NOT_FOUND" as const };
  const access = openingAccess(user, { decisionMakerId: opening.decisionMakerId, backupDecisionMakerId: opening.backupDecisionMakerId, memberIds: opening.memberIds, status: opening.status });
  if (opening.status === "CLOSED") return { ok: false as const, code: "CLOSED" as const };
  if (!access.edit) return { ok: false as const, code: "FORBIDDEN" as const };
  return { ok: true as const, user };
}

async function inviteOne(user: { id: string; orgId: string }, input: z.infer<typeof oneSchema>): Promise<InviteOneResult> {
  const locale = await managerLocale();
  try {
    const result = await createHiringInvitation(
      { id: user.id, orgId: user.orgId },
      { openingId: input.openingId, fullName: input.fullName, email: input.email, locale: input.locale, deadline: input.deadline, allowDuplicate: input.allowDuplicate ?? false },
    );
    if (!result.ok) return { ok: false, code: result.code, ...(result.existing ? { existing: { invitedAt: shortDate(result.existing.invitedAt, locale) } } : {}) };
    return { ok: true, url: result.url, name: input.fullName.trim(), expires: shortDate(result.expiresAt, locale), message: result.message };
  } catch (error) {
    console.error("[hiring] invite failed", error);
    return { ok: false, code: "FAILED" };
  }
}

/** HIRING-UX 5.11 "Davet linkini oluştur": one candidate; the link is returned once and never stored. */
export async function inviteCandidateAction(input: unknown): Promise<InviteOneResult> {
  const parsed = oneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "FAILED" };
  const gated = await gate(parsed.data.openingId);
  if (!gated.ok) return gated;
  const result = await inviteOne(gated.user, parsed.data);
  if (result.ok) revalidatePath(`/hiring/openings/${parsed.data.openingId}`, "layout");
  return result;
}

/** "Birden fazla aday": each valid row is its own invitation; marked rows are skipped and reported by the form. */
export async function inviteManyAction(input: unknown): Promise<{ results: Array<{ line: number; fullName: string; email: string; result: InviteOneResult }> }> {
  const parsed = manySchema.safeParse(input);
  if (!parsed.success) return { results: [] };
  const gated = await gate(parsed.data.openingId);
  if (!gated.ok) return { results: [{ line: 0, fullName: "", email: "", result: gated }] };
  const results = [];
  for (const row of parseInviteRows(parsed.data.text).rows.filter((r) => r.problem === null)) {
    const result = await inviteOne(gated.user, { openingId: parsed.data.openingId, fullName: row.fullName, email: row.email, locale: parsed.data.locale, deadline: parsed.data.deadline });
    results.push({ line: row.line, fullName: row.fullName, email: row.email, result });
  }
  revalidatePath(`/hiring/openings/${parsed.data.openingId}`, "layout");
  return { results };
}
```

- [ ] **Step 5: Copy**

Add to `hiring.tr.json`:
```json
"hiringInvite": {
  "title": "Aday davet et",
  "lead": "Davet linki bir kez oluşturulur; adaya e-postayla ya da mesajla sen gönderirsin.",
  "noPermission": "Rolün aday davet edemez.",
  "opening": "Alım",
  "chooseOpening": "Alım seç",
  "noOpenings": "Davet açılacak alım yok. Önce bir alımın değerlendirmesini yayınla.",
  "goOpenings": "Alımlara git",
  "fullName": "Ad soyad",
  "email": "E-posta",
  "language": "Adayın dili",
  "tr": "Türkçe",
  "en": "English",
  "deadline": "Son gün",
  "deadlineValue": "{date} sonuna kadar ({zone})",
  "change": "Değiştir",
  "many": "Birden fazla aday",
  "single": "Tek aday",
  "pasteLabel": "Her satıra bir aday: ad soyad, e-posta",
  "pasteHint": "Virgül, noktalı virgül ya da sekme ile ayırabilirsin. En fazla 50 satır.",
  "rowNAME": "Satır {line}: ad soyad eksik.",
  "rowEMAIL": "Satır {line}: e-posta geçerli değil.",
  "rowDUPLICATE": "Satır {line}: bu e-posta listede iki kez var.",
  "tooMany": "İlk 50 satır alındı; kalanları ayrı bir davette gönder.",
  "rowsReady": "{count} aday davete hazır.",
  "evaluators": "{count, plural, one {Bir değerlendirici atanacak.} other {# değerlendirici atanacak.}}",
  "create": "Davet linkini oluştur",
  "createMany": "{count} adayı davet et",
  "creating": "Oluşturuluyor",
  "reasonnoOpening": "Önce bir alım seç.",
  "reasonnotPublished": "Önce değerlendirmeyi yayınla.",
  "reasonnoEvaluators": "Önce ekibe en az bir değerlendirici ekle.",
  "reasondeadline": "Son gün geçmişte olamaz.",
  "reasonname": "Adayın adını ve soyadını yaz.",
  "reasonemail": "Geçerli bir e-posta yaz.",
  "reasonnoRows": "Önce en az bir aday yapıştır.",
  "reasonrows": "Önce listedeki işaretli satırları düzelt.",
  "goAssessment": "Değerlendirmeye git",
  "goTeam": "Ekip ve kurallara git",
  "duplicate": "{name} bu alımda zaten davetli ({date}).",
  "duplicateHelp": "Linkini kaybettiyse Adaylar sekmesinden yeni link üret. Yine de ikinci bir davet açabilirsin.",
  "inviteAnyway": "Yine de davet et",
  "readyTitle": "Davet linki hazır",
  "readyBody": "{name} için link oluşturuldu. Son gün {date}.",
  "linkLabel": "Davet linki",
  "copyLink": "Linki kopyala",
  "copied": "Kopyalandı",
  "messageLabel": "Hazır mesaj",
  "copyMessage": "Mesajı kopyala",
  "onceNote": "Bu link bir daha gösterilmez; kaybolursa Adaylar sekmesinden yeni link üretebilirsin.",
  "another": "Başka aday davet et",
  "close": "Kapat",
  "toCandidates": "Adaylara git",
  "manyReady": "{count, plural, one {Bir davet hazır.} other {# davet hazır.}}",
  "manyFailed": "{count, plural, one {Bir satır davet edilemedi.} other {# satır davet edilemedi.}}",
  "copyAll": "Tümünü kopyala",
  "errNOT_FOUND": "Bu alım artık yok ya da göremiyorsun.",
  "errCLOSED": "Bu alım kapalı; davet açılamaz.",
  "errNOT_PUBLISHED": "Önce değerlendirmeyi yayınla.",
  "errNO_EVALUATORS": "Önce ekibe en az bir değerlendirici ekle.",
  "errNAME": "Adayın adını ve soyadını yaz.",
  "errEMAIL": "Geçerli bir e-posta yaz.",
  "errDEADLINE_INVALID": "Geçerli bir gün seç.",
  "errDEADLINE_PAST": "Son gün geçmişte olamaz.",
  "errDUPLICATE": "Bu e-posta bu alımda zaten davetli.",
  "errFORBIDDEN": "Rolün bu alıma davet açamaz.",
  "errFAILED": "Davet oluşturulamadı. Tekrar dene."
}
```
and to `hiring.en.json`:
```json
"hiringInvite": {
  "title": "Invite a candidate",
  "lead": "The invitation link is created once; you send it to the candidate by e-mail or message.",
  "noPermission": "Your role cannot invite candidates.",
  "opening": "Opening",
  "chooseOpening": "Choose an opening",
  "noOpenings": "No opening is open for invitations. Publish an opening's assessment first.",
  "goOpenings": "Go to openings",
  "fullName": "Full name",
  "email": "E-mail",
  "language": "Candidate's language",
  "tr": "Türkçe",
  "en": "English",
  "deadline": "Last day",
  "deadlineValue": "Until the end of {date} ({zone})",
  "change": "Change",
  "many": "More than one candidate",
  "single": "One candidate",
  "pasteLabel": "One candidate per line: full name, e-mail",
  "pasteHint": "Separate with a comma, semicolon or tab. Up to 50 lines.",
  "rowNAME": "Line {line}: the name is missing.",
  "rowEMAIL": "Line {line}: the e-mail is not valid.",
  "rowDUPLICATE": "Line {line}: this e-mail is in the list twice.",
  "tooMany": "The first 50 lines were taken; send the rest in another invitation.",
  "rowsReady": "{count, plural, one {One candidate is ready to invite.} other {# candidates are ready to invite.}}",
  "evaluators": "{count, plural, one {One evaluator will be assigned.} other {# evaluators will be assigned.}}",
  "create": "Create the invitation link",
  "createMany": "{count, plural, one {Invite one candidate} other {Invite # candidates}}",
  "creating": "Creating",
  "reasonnoOpening": "Choose an opening first.",
  "reasonnotPublished": "Publish the assessment first.",
  "reasonnoEvaluators": "Add at least one evaluator to the team first.",
  "reasondeadline": "The last day cannot be in the past.",
  "reasonname": "Write the candidate's full name.",
  "reasonemail": "Write a valid e-mail.",
  "reasonnoRows": "Paste at least one candidate first.",
  "reasonrows": "Fix the marked lines first.",
  "goAssessment": "Go to the assessment",
  "goTeam": "Go to team and rules",
  "duplicate": "{name} is already invited to this opening ({date}).",
  "duplicateHelp": "If they lost the link, create a new one on the Candidates tab. You can still open a second invitation.",
  "inviteAnyway": "Invite anyway",
  "readyTitle": "The invitation link is ready",
  "readyBody": "A link was created for {name}. Last day {date}.",
  "linkLabel": "Invitation link",
  "copyLink": "Copy the link",
  "copied": "Copied",
  "messageLabel": "Ready message",
  "copyMessage": "Copy the message",
  "onceNote": "This link is not shown again; if it is lost, create a new one on the Candidates tab.",
  "another": "Invite another candidate",
  "close": "Close",
  "toCandidates": "Go to candidates",
  "manyReady": "{count, plural, one {One invitation is ready.} other {# invitations are ready.}}",
  "manyFailed": "{count, plural, one {One line could not be invited.} other {# lines could not be invited.}}",
  "copyAll": "Copy all",
  "errNOT_FOUND": "This opening no longer exists or you cannot see it.",
  "errCLOSED": "This opening is closed; no invitation can be opened.",
  "errNOT_PUBLISHED": "Publish the assessment first.",
  "errNO_EVALUATORS": "Add at least one evaluator to the team first.",
  "errNAME": "Write the candidate's full name.",
  "errEMAIL": "Write a valid e-mail.",
  "errDEADLINE_INVALID": "Choose a valid day.",
  "errDEADLINE_PAST": "The last day cannot be in the past.",
  "errDUPLICATE": "This e-mail is already invited to this opening.",
  "errFORBIDDEN": "Your role cannot invite to this opening.",
  "errFAILED": "The invitation could not be created. Try again."
}
```
(TR `rowsReady` and `createMany` are plain `{count}` sentences, "3 aday davete hazır." and "3 adayı davet et"; EN uses plurals. Both files have the same keys, which `src/i18n` key-parity tests check.)

- [ ] **Step 6: Components**

`src/components/hiring/invite/copy-field.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMT } from "@/i18n/manager-client";

/** A value to copy: shown read-only (selectable), with one copy button; "Kopyalandı" for two seconds. */
export function CopyField({ id, label, value, multiline = false, primary = false, copyLabel }: { id: string; label: string; value: string; multiline?: boolean; primary?: boolean; copyLabel: string }) {
  const t = useMT("hiringInvite");
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.select();
    }
  }
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} readOnly value={value} rows={8} className="w-full rounded-lg border border-input bg-canvas px-3 py-2 text-[14px] leading-[22px] text-ink" />
      ) : (
        <input id={id} readOnly value={value} className="h-10 w-full rounded-lg border border-input bg-canvas px-3 text-[14px] text-ink" onFocus={(e) => e.currentTarget.select()} />
      )}
      <Button variant={primary ? "primary" : "secondary"} onClick={copy}>
        {copied ? t("copied") : copyLabel}
      </Button>
    </div>
  );
}
```

`src/components/hiring/invite/invite-form.tsx`:
```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import { parseInviteRows } from "@/solutions/hiring/rules/invitation";
import { inviteCandidateAction, inviteManyAction, type InviteOneResult } from "@/app/(manager)/hiring/invite/actions";
import { CopyField } from "./copy-field";
import { inviteReason, type InviteOpening } from "./form-rules";

type Done =
  | { kind: "one"; result: Extract<InviteOneResult, { ok: true }> }
  | { kind: "many"; ok: Array<{ fullName: string; email: string; url: string }>; failed: Array<{ line: number; fullName: string; code: string }> };

/**
 * HIRING-UX 5.11: the opening (preselected), the person, their language and
 * the last day (from the opening, "Değiştir" to choose another), or a pasted
 * list. The button waits with its reason. On success the link is shown once
 * with "Linki kopyala" as the filled button and the ready message below.
 */
export function InviteForm({ openings, initialOpeningId, today, zone, onDone }: { openings: InviteOpening[]; initialOpeningId: string | null; today: string; zone: string; onDone?: () => void }) {
  const t = useMT("hiringInvite");
  const [openingId, setOpeningId] = useState<string>(initialOpeningId && openings.some((o) => o.id === initialOpeningId) ? initialOpeningId : openings.length === 1 ? openings[0].id : "");
  const opening = openings.find((o) => o.id === openingId) ?? null;
  const [mode, setMode] = useState<"single" | "many">("single");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [locale, setLocale] = useState<"tr" | "en">("tr");
  const [changing, setChanging] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [refusal, setRefusal] = useState<Extract<InviteOneResult, { ok: false }> | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const parsed = useMemo(() => parseInviteRows(text), [text]);
  const reason = inviteReason({ opening, mode, fullName, email, rows: parsed.rows, deadline, today });
  const shownDay = deadline ?? opening?.deadlineDay ?? null;

  function reset() {
    setDone(null);
    setRefusal(null);
    setFullName("");
    setEmail("");
    setText("");
  }

  function submit(allowDuplicate = false) {
    setRefusal(null);
    start(async () => {
      if (mode === "single") {
        const result = await inviteCandidateAction({ openingId, fullName, email, locale, deadline, allowDuplicate });
        if (result.ok) setDone({ kind: "one", result });
        else setRefusal(result);
        return;
      }
      const { results } = await inviteManyAction({ openingId, text, locale, deadline });
      setDone({
        kind: "many",
        ok: results.flatMap((r) => (r.result.ok ? [{ fullName: r.fullName, email: r.email, url: r.result.url }] : [])),
        failed: results.flatMap((r) => (r.result.ok ? [] : [{ line: r.line, fullName: r.fullName, code: r.result.code }])),
      });
    });
  }

  if (done?.kind === "one") {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("readyTitle")}</h2>
          <p className="tnum mt-1 text-[14px] text-muted">{t("readyBody", { name: done.result.name, date: done.result.expires })}</p>
        </div>
        <CopyField id="invite-link" label={t("linkLabel")} value={done.result.url} primary copyLabel={t("copyLink")} />
        <CopyField id="invite-message" label={t("messageLabel")} value={done.result.message.body} multiline copyLabel={t("copyMessage")} />
        <p className="text-[13px] text-muted">{t("onceNote")}</p>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={reset} className="text-[14px] font-medium text-ink underline decoration-underline underline-offset-4">
            {t("another")}
          </button>
          {onDone ? (
            <Button variant="ghost" onClick={onDone}>
              {t("close")}
            </Button>
          ) : opening ? (
            <Link href={`/hiring/openings/${opening.id}/candidates`} className="text-[14px] text-ink underline decoration-underline underline-offset-4">
              {t("toCandidates")}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  if (done?.kind === "many") {
    const all = done.ok.map((r) => `${r.fullName}\t${r.email}\t${r.url}`).join("\n");
    return (
      <div className="space-y-5">
        <p className="text-[14px] text-ink">
          {t("manyReady", { count: done.ok.length })} {done.failed.length ? t("manyFailed", { count: done.failed.length }) : null}
        </p>
        {done.ok.length ? <CopyField id="invite-all" label={t("linkLabel")} value={all} multiline primary copyLabel={t("copyAll")} /> : null}
        {done.failed.length ? (
          <ul className="space-y-1 text-[13px] text-ink">
            {done.failed.map((f) => (
              <li key={f.line}>
                {f.fullName || `#${f.line}`}: {t(`err${f.code}` as "errFAILED")}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-[13px] text-muted">{t("onceNote")}</p>
        <button type="button" onClick={reset} className="text-[14px] font-medium text-ink underline decoration-underline underline-offset-4">
          {t("another")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-field">
      {openings.length > 1 || !opening ? (
        <div className="space-y-2">
          <Label htmlFor="invite-opening">{t("opening")}</Label>
          <Select value={openingId} onValueChange={setOpeningId}>
            <SelectTrigger id="invite-opening" className="w-full">
              <SelectValue placeholder={t("chooseOpening")} />
            </SelectTrigger>
            <SelectContent>
              {openings.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-[14px] text-ink">
          <span className="text-muted">{t("opening")}:</span> {opening.name}
        </p>
      )}
      {opening && opening.live && opening.evaluators > 0 ? <p className="text-[13px] text-muted">{t("evaluators", { count: opening.evaluators })}</p> : null}

      <RadioGroup value={mode} onValueChange={(v) => setMode(v as "single" | "many")} className="flex gap-4" aria-label={t("many")}>
        {(["single", "many"] as const).map((m) => (
          <label key={m} className="flex min-h-10 items-center gap-2 text-[14px] text-ink">
            <RadioGroupItem value={m} />
            {t(m)}
          </label>
        ))}
      </RadioGroup>

      {mode === "single" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="invite-name">{t("fullName")}</Label>
            <Input id="invite-name" autoComplete="off" maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("email")}</Label>
            <Input id="invite-email" type="email" autoComplete="off" maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="invite-paste">{t("pasteLabel")}</Label>
          <Textarea id="invite-paste" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="text-[13px] text-muted">{t("pasteHint")}</p>
          <ul className="space-y-1 text-[13px]">
            {parsed.rows.filter((r) => r.problem).map((r) => (
              <li key={r.line} className="text-ink">
                {t(`row${r.problem!}`, { line: r.line })}
              </li>
            ))}
          </ul>
          {parsed.tooMany ? <p className="text-[13px] text-ink">{t("tooMany")}</p> : null}
          {parsed.rows.length && !parsed.rows.some((r) => r.problem) ? <p className="tnum text-[13px] text-muted">{t("rowsReady", { count: parsed.rows.length })}</p> : null}
        </div>
      )}

      <div className="space-y-2">
        <Label id="invite-language">{t("language")}</Label>
        <RadioGroup value={locale} onValueChange={(v) => setLocale(v as "tr" | "en")} className="flex gap-4" aria-labelledby="invite-language">
          {(["tr", "en"] as const).map((l) => (
            <label key={l} className="flex min-h-10 items-center gap-2 text-[14px] text-ink">
              <RadioGroupItem value={l} />
              {t(l)}
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-deadline">{t("deadline")}</Label>
        {changing ? (
          <Input id="invite-deadline" type="date" min={today} value={deadline ?? shownDay ?? ""} onChange={(e) => setDeadline(e.target.value || null)} className="w-48" />
        ) : (
          <p className="tnum flex items-center gap-3 text-[14px] text-ink">
            {shownDay ? t("deadlineValue", { date: shownDay, zone }) : null}
            <button type="button" onClick={() => setChanging(true)} className="text-[13px] underline decoration-underline underline-offset-4">
              {t("change")}
            </button>
          </p>
        )}
      </div>

      {refusal ? (
        <div role="alert" className="space-y-2 rounded-xl border border-line bg-surface p-4 text-[14px] text-ink">
          {refusal.code === "DUPLICATE" ? (
            <>
              <p>{t("duplicate", { name: fullName, date: refusal.existing?.invitedAt ?? "" })}</p>
              <p className="text-muted">{t("duplicateHelp")}</p>
              <Button size="sm" onClick={() => submit(true)}>
                {t("inviteAnyway")}
              </Button>
            </>
          ) : (
            <p>{t(`err${refusal.code}`)}</p>
          )}
        </div>
      ) : null}

      <div className="space-y-1">
        <Button id="invite-create" variant="primary" disabled={reason !== null || pending} disabledReason={reason ? t(`reason${reason}`) : t("creating")} onClick={() => submit(false)}>
          {pending ? t("creating") : mode === "single" ? t("create") : t("createMany", { count: parsed.rows.length })}
        </Button>
        {reason ? (
          <DisabledReason id="invite-create-why">
            {t(`reason${reason}`)}{" "}
            {reason === "notPublished" && opening ? (
              <Link href={`/hiring/openings/${opening.id}/assessment`} className="underline decoration-underline underline-offset-4">
                {t("goAssessment")}
              </Link>
            ) : reason === "noEvaluators" && opening ? (
              <Link href={`/hiring/openings/${opening.id}/settings`} className="underline decoration-underline underline-offset-4">
                {t("goTeam")}
              </Link>
            ) : null}
          </DisabledReason>
        ) : null}
      </div>
    </div>
  );
}
```

`src/components/hiring/invite/invite-sheet.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMT } from "@/i18n/manager-client";
import type { InviteOpening } from "./form-rules";
import { InviteForm } from "./invite-form";

/** HIRING-UX 5.11: every "Aday davet et" opens this Sheet from the right; /hiring/invite is the same form as a page. */
export function InviteSheet({ opening, today, zone }: { opening: InviteOpening; today: string; zone: string }) {
  const t = useMT("hiringInvite");
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button id="invite-candidate" variant="primary">
          {t("title")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("lead")}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <InviteForm key={open ? "open" : "closed"} openings={[opening]} initialOpeningId={opening.id} today={today} zone={zone} onDone={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 7: The page**

`src/app/(manager)/hiring/invite/page.tsx`:
```tsx
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/manager/page-title";
import { InviteForm } from "@/components/hiring/invite/invite-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { one } from "@/lib/url-notice";
import { requireUser } from "@/server/session";
import { invitableOpenings } from "@/solutions/hiring/server/invitations";

export const dynamic = "force-dynamic";

/** HIRING-UX 5.11 as a page (`?opening=` preselects); the opening pages open the same form in a Sheet. */
export default async function HiringInvitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  if (!can(user, "opening:write")) {
    return (
      <main className="mx-auto max-w-[720px] px-page py-8">
        <PageTitle title={t("hiringInvite.title")} />
        <p className="mt-section text-[14px] text-ink">{t("hiringInvite.noPermission")}</p>
      </main>
    );
  }
  const openings = await invitableOpenings(user.orgId);
  return (
    <main className="mx-auto max-w-[720px] px-page py-8">
      <PageTitle title={t("hiringInvite.title")} sub={t("hiringInvite.lead")} />
      <Card className="mt-section p-card">
        {openings.length === 0 ? (
          <div className="space-y-2">
            <p className="text-[14px] text-ink">{t("hiringInvite.noOpenings")}</p>
            <Link href="/hiring/openings" className="text-[14px] font-medium text-ink underline decoration-underline underline-offset-4">
              {t("hiringInvite.goOpenings")}
            </Link>
          </div>
        ) : (
          <InviteForm openings={openings} initialOpeningId={one(sp.opening) ?? null} today={orgDay()} zone={zoneLabel(locale)} />
        )}
      </Card>
    </main>
  );
}
```

- [ ] **Step 8: Run the tests and the gates**

```bash
pnpm exec vitest run src/components/hiring/invite "src/app/(manager)/hiring/invite" src/solutions/hiring/server src/i18n
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS; `pnpm build` lists `/hiring/invite`.

- [ ] **Step 9: Browser check (Claude in Chrome)**

Fresh `kademe_ui_check` (template of `kademe_platform`); `pnpm dev:hiring-link` once (it publishes an opening owned by the panel owner, with the owner on the panel); dev server on 3100; log in as `kadiraycareer@gmail.com` / `kademe-dev-2026`. Open `/hiring/invite`: the opening is preselected when it is the only one; "Bir değerlendirici atanacak."; the button waits with "Adayın adını ve soyadını yaz."; fill name and e-mail, choose English, "Değiştir" the day to a later date; "Davet linkini oluştur": "Davet linki hazır", the link, "Linki kopyala" is the filled button, the ready message is in English with the name, link, day and "about N minutes"; time it from opening `/hiring/invite` to the copied link (R14 target: 30 s, 4 clicks; write the number). Invite the same e-mail again: the duplicate note with the date and "Yine de davet et". "Birden fazla aday": paste three lines, one with a bad e-mail: "Satır 3: e-posta geçerli değil." and the button waits; fix it; "3 adayı davet et": three links and "Tümünü kopyala". Open one of the links in a new tab: the candidate landing in the chosen language. Stop the server; keep `kademe_ui_check` only if Task 18 follows at once.

- [ ] **Step 10: Commit**

```bash
git add src/solutions/hiring/server/invitations.ts src/solutions/hiring/server/invitations.test.ts src/components/hiring/invite/form-rules.ts src/components/hiring/invite/form-rules.test.ts src/components/hiring/invite/invite-form.tsx src/components/hiring/invite/invite-sheet.tsx src/components/hiring/invite/copy-field.tsx "src/app/(manager)/hiring/invite/page.tsx" "src/app/(manager)/hiring/invite/actions.ts" "src/app/(manager)/hiring/invite/actions.test.ts" src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Invite hiring candidates from the panel

/hiring/invite and a Sheet on the opening pages: one candidate or a pasted
list, the candidate's language and the last day, with the button waiting
on the one thing missing (a published assessment, a team, a name). The
link is shown once with the ready message to copy; a repeated e-mail is
named with its date.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: The opening's Candidates tab, new links and requests (HIRING-UX 5.12, A6, A8)

**Files:**
- Modify: `src/lib/url-notice.ts`, `src/lib/url-notice.test.ts`, `src/components/ui/url-notice.tsx` (deferred `replaceState`, plan 1 carry)
- Modify: `src/app/(manager)/hiring/openings/[id]/opening-header.tsx`, `opening-header.test.ts` (tab "Adaylar")
- Create: `src/app/(manager)/hiring/openings/[id]/candidates/page.tsx`, `src/app/(manager)/hiring/openings/[id]/candidates/actions.ts` (+ `actions.test.ts`)
- Create: `src/components/hiring/candidates/candidate-table.tsx`, `src/components/hiring/candidates/new-link-button.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (`hiringCommon.tabCandidates`, `hiringCandidates`)

**Interfaces:**
- Consumes: Task 7 (`listOpeningCandidates`, `OpeningCandidateRow`, `newHiringLink`, `NewLinkOutcome`, `markRequestHandled`); Task 17 (`invitableOpenings`, `InviteSheet`, `CopyField`); core `extendLink` (`@/app/(manager)/actions`, org-scoped, audits `link.extend`, redirects with `?extended=1`; its capability `student:invite` belongs to OWNER and MANAGER, the same roles as `opening:write`); `openingFor`, `editableOpening` (`../access`); `ago`, `shortDate`.
- Produces:
  - `scheduleNoticeCleanup(win: NoticeWindow, names: readonly string[]): () => void` and `type NoticeWindow` in `@/lib/url-notice`.
  - `OpeningHeader` `active` gains `"candidates"`; tab order: Genel bakış, Adaylar, Değerlendirme, Ekip ve kurallar.
  - Actions: `newLinkAction(openingId: string, assessmentId: string): Promise<{ ok: true; url: string; expires: string; name: string; message: { subject: string; body: string } } | { ok: false; code: "NOT_FOUND" | "COMPLETED" | "CLOSED" | "FORBIDDEN" }>`; `markRequestAction(formData: FormData): Promise<void>` (fields `openingId`, `requestId`; redirects with `?handled=1`).
  - Route `/hiring/openings/[id]/candidates`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/url-notice.test.ts`:
```ts
import { vi } from "vitest";
import { scheduleNoticeCleanup, type NoticeWindow } from "./url-notice";

describe("taking the notice out of the address (plan 1 carry)", () => {
  function fakeWindow(href: string) {
    const calls: string[] = [];
    const win: NoticeWindow = {
      location: { pathname: href.split("?")[0], search: href.includes("?") ? `?${href.split("?")[1].split("#")[0]}` : "", hash: "" },
      history: { state: { __NA: true }, replaceState: (_s: unknown, _t: string, url?: string | URL | null) => void calls.push(String(url)) },
      setTimeout: (fn: () => void, ms?: number) => globalThis.setTimeout(fn, ms) as unknown as number,
      clearTimeout: (id: number) => globalThis.clearTimeout(id as unknown as NodeJS.Timeout),
    };
    return { win, calls };
  }

  it("waits a tick, so Next's own history write on a full page load cannot bring the parameter back", () => {
    vi.useFakeTimers();
    const { win, calls } = fakeWindow("/hiring/openings/o1/candidates?handled=1");
    scheduleNoticeCleanup(win, ["handled"]);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(0);
    expect(calls).toEqual(["/hiring/openings/o1/candidates"]);
    vi.useRealTimers();
  });

  it("keeps Next's history state and does nothing when unmounted first or when there is nothing to take out", () => {
    vi.useFakeTimers();
    const a = fakeWindow("/x?handled=1");
    let kept: unknown = null;
    a.win.history.replaceState = (state: unknown) => void (kept = state);
    scheduleNoticeCleanup(a.win, ["handled"]);
    vi.advanceTimersByTime(0);
    expect(kept).toEqual({ __NA: true });
    const b = fakeWindow("/x?handled=1");
    scheduleNoticeCleanup(b.win, ["handled"])();
    vi.advanceTimersByTime(0);
    expect(b.calls).toEqual([]);
    const c = fakeWindow("/x?tab=1");
    scheduleNoticeCleanup(c.win, ["handled"]);
    vi.advanceTimersByTime(0);
    expect(c.calls).toEqual([]);
    vi.useRealTimers();
  });
});
```

In `src/app/(manager)/hiring/openings/[id]/opening-header.test.ts`, replace the `expect(items).toEqual([...])` with:
```ts
    expect(items).toEqual([
      { href: base, label: "Genel bakış", active: false },
      { href: `${base}/candidates`, label: "Adaylar", active: false },
      { href: `${base}/assessment`, label: "Değerlendirme", active: false },
      { href: `${base}/settings`, label: "Ekip ve kurallar", active: true },
    ]);
```

`src/app/(manager)/hiring/openings/[id]/candidates/actions.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  gate: { ok: true, user: { id: "u", orgId: "o" }, opening: { id: "op" } } as Record<string, unknown>,
  newLink: vi.fn(),
  mark: vi.fn(async () => true),
  redirected: "",
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirected = to;
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "tr" }));
vi.mock("../access", () => ({ editableOpening: async () => h.gate }));
vi.mock("@/solutions/hiring/server/invitations", () => ({ newHiringLink: h.newLink, markRequestHandled: h.mark }));

import { markRequestAction, newLinkAction } from "./actions";

beforeEach(() => {
  h.gate = { ok: true, user: { id: "u", orgId: "o" }, opening: { id: "op" } };
  h.newLink.mockReset();
  h.mark.mockClear();
});

describe("newLinkAction", () => {
  it("asks the opening's edit right first and passes the session's user", async () => {
    h.gate = { ok: false, code: "CLOSED" };
    expect(await newLinkAction("op", "a1")).toEqual({ ok: false, code: "CLOSED" });
    expect(h.newLink).not.toHaveBeenCalled();
    h.gate = { ok: true, user: { id: "u", orgId: "o" }, opening: { id: "op" } };
    h.newLink.mockResolvedValue({ ok: true, url: "https://k/a/y", expiresAt: new Date("2026-10-19T20:59:59Z"), name: "Elif Kaya", message: { subject: "s", body: "b" } });
    expect(await newLinkAction("op", "a1")).toEqual({ ok: true, url: "https://k/a/y", expires: "19 Eki", name: "Elif Kaya", message: { subject: "s", body: "b" } });
    expect(h.newLink).toHaveBeenCalledWith({ id: "u", orgId: "o" }, "op", "a1");
  });
});

describe("markRequestAction", () => {
  it("closes the request for this opening and comes back with a notice", async () => {
    const form = new FormData();
    form.set("openingId", "op");
    form.set("requestId", "r1");
    await expect(markRequestAction(form)).rejects.toThrow("NEXT_REDIRECT");
    expect(h.mark).toHaveBeenCalledWith({ id: "u", orgId: "o" }, "op", "r1");
    expect(h.redirected).toBe("/hiring/openings/op/candidates?handled=1");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/lib/url-notice.test.ts "src/app/(manager)/hiring/openings/[id]"`
Expected: FAIL (`scheduleNoticeCleanup` missing, the header has three tabs, `./actions` missing).

- [ ] **Step 3: The deferred notice cleanup**

Append to `src/lib/url-notice.ts`:
```ts
export type NoticeWindow = {
  location: { pathname: string; search: string; hash: string };
  history: { state: unknown; replaceState(state: unknown, unused: string, url?: string | URL | null): void };
  setTimeout(fn: () => void, ms?: number): number;
  clearTimeout(id: number): void;
};

/**
 * Takes the notice parameters out of the address one tick later. On a full
 * page load (a native form POST before hydration, an opened URL) Next writes
 * its own history entry after the first effects; a replaceState before that is
 * overwritten and a later router.refresh brings the parameter back (plan 1
 * review). Next's history state is kept. Returns the cancel for unmount.
 */
export function scheduleNoticeCleanup(win: NoticeWindow, names: readonly string[]): () => void {
  const id = win.setTimeout(() => {
    const next = withoutParams(`${win.location.pathname}${win.location.search}${win.location.hash}`, names);
    if (next !== null) win.history.replaceState(win.history.state, "", next);
  }, 0);
  return () => win.clearTimeout(id);
}
```

Replace the body of `UrlNotice` in `src/components/ui/url-notice.tsx` (import `scheduleNoticeCleanup` instead of `withoutParams`; append to the doc comment "Deferred one tick (scheduleNoticeCleanup) so a full page load cannot resurrect it."):
```tsx
export function UrlNotice({ params, children }: { params: readonly string[]; children: React.ReactNode }) {
  const key = params.join(",");
  useEffect(() => scheduleNoticeCleanup(window, key.split(",")), [key]);
  return <>{children}</>;
}
```

- [ ] **Step 4: The tab**

In `opening-header.tsx` set `active: "overview" | "candidates" | "assessment" | "settings";` and add the second item:
```tsx
          { href: `${base}/candidates`, label: t("hiringCommon.tabCandidates"), active: active === "candidates" },
```
Add `"tabCandidates": "Adaylar"` / `"tabCandidates": "Candidates"` to `hiringCommon` in `hiring.tr.json` / `hiring.en.json`.

- [ ] **Step 5: Copy**

Add to `hiring.tr.json`:
```json
"hiringCandidates": {
  "title": "Adaylar",
  "empty": "Bu alıma henüz aday davet edilmedi.",
  "emptyRuns": "İlk adayı davet et; link oluşturulunca burada görünür.",
  "emptyNotLive": "Aday davet etmek için önce değerlendirmeyi yayınla.",
  "colSeq": "#",
  "colCandidate": "Aday",
  "colStatus": "Durum",
  "colProgress": "İlerleme",
  "colLast": "Son hareket",
  "colLink": "Link",
  "masked": "Aday {seq}",
  "progressINVITED": "Davet edildi",
  "progressOPENED": "Linki açtı",
  "progressIN_PROGRESS": "Devam ediyor",
  "progressCOMPLETED": "Tamamladı",
  "progressEXPIRED": "Linkin süresi doldu",
  "stages": "{done}/{total} aşama",
  "adapted": "Süre uyarlaması uygulandı",
  "linkUntil": "{date} sonuna kadar",
  "linkDone": "Kullanıldı",
  "newLink": "Yeni link üret",
  "newLinkHelp": "Eski link hemen çalışmaz olur; aday kaldığı yerden devam eder.",
  "newLinkCreating": "Oluşturuluyor",
  "newLinkReady": "{name} için yeni link hazır. Son gün {date}.",
  "extend": "7 gün uzat",
  "extended": "Linkin süresi 7 gün uzatıldı.",
  "requestsTitle": "Açık talepler",
  "requestACCOMMODATION": "Uyarlama talebi",
  "requestNEW_LINK": "Yeni link talebi",
  "requestACCESS": "Verilerine erişim talebi",
  "requestCOPY": "Veri kopyası talebi",
  "requestDELETE": "Veri silme talebi",
  "requestOther": "Talep",
  "requestHandled": "Talep kapatıldı.",
  "done": "Tamam",
  "errNOT_FOUND": "Bu aday bu alımda yok.",
  "errCOMPLETED": "Aday değerlendirmeyi tamamladı; yeni link gerekmez.",
  "errCLOSED": "Bu alım kapalı.",
  "errFORBIDDEN": "Rolün bu alımda link üretemez."
}
```
and to `hiring.en.json`:
```json
"hiringCandidates": {
  "title": "Candidates",
  "empty": "No candidate has been invited to this opening yet.",
  "emptyRuns": "Invite the first candidate; once the link is created it shows here.",
  "emptyNotLive": "Publish the assessment first to invite candidates.",
  "colSeq": "#",
  "colCandidate": "Candidate",
  "colStatus": "Status",
  "colProgress": "Progress",
  "colLast": "Last activity",
  "colLink": "Link",
  "masked": "Candidate {seq}",
  "progressINVITED": "Invited",
  "progressOPENED": "Opened the link",
  "progressIN_PROGRESS": "In progress",
  "progressCOMPLETED": "Completed",
  "progressEXPIRED": "Link expired",
  "stages": "{done}/{total} stages",
  "adapted": "Time adaptation applied",
  "linkUntil": "Until the end of {date}",
  "linkDone": "Used",
  "newLink": "Create a new link",
  "newLinkHelp": "The old link stops working at once; the candidate continues where they left off.",
  "newLinkCreating": "Creating",
  "newLinkReady": "A new link for {name} is ready. Last day {date}.",
  "extend": "Extend by 7 days",
  "extended": "The link was extended by 7 days.",
  "requestsTitle": "Open requests",
  "requestACCOMMODATION": "Adaptation request",
  "requestNEW_LINK": "New link request",
  "requestACCESS": "Data access request",
  "requestCOPY": "Data copy request",
  "requestDELETE": "Data deletion request",
  "requestOther": "Request",
  "requestHandled": "The request was closed.",
  "done": "Done",
  "errNOT_FOUND": "This candidate is not in this opening.",
  "errCOMPLETED": "The candidate has finished; no new link is needed.",
  "errCLOSED": "This opening is closed.",
  "errFORBIDDEN": "Your role cannot create links in this opening."
}
```

- [ ] **Step 6: Actions**

`src/app/(manager)/hiring/openings/[id]/candidates/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { shortDate } from "@/lib/format";
import { managerLocale } from "@/i18n/manager-locale";
import { markRequestHandled, newHiringLink } from "@/solutions/hiring/server/invitations";
import { editableOpening } from "../access";

export type NewLinkResult =
  | { ok: true; url: string; expires: string; name: string; message: { subject: string; body: string } }
  | { ok: false; code: "NOT_FOUND" | "COMPLETED" | "CLOSED" | "FORBIDDEN" };

/** "Yeni link üret": the old link stops at once; the new one is shown once (HIRING-UX 5.12). */
export async function newLinkAction(openingId: string, assessmentId: string): Promise<NewLinkResult> {
  if (typeof openingId !== "string" || typeof assessmentId !== "string") return { ok: false, code: "NOT_FOUND" };
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  const outcome = await newHiringLink({ id: gate.user.id, orgId: gate.user.orgId }, openingId, assessmentId);
  if (!outcome.ok) return outcome;
  revalidatePath(`/hiring/openings/${openingId}/candidates`);
  const locale = await managerLocale();
  return { ok: true, url: outcome.url, expires: shortDate(outcome.expiresAt, locale), name: outcome.name, message: outcome.message };
}

/** "Tamam" on a candidate's request. */
export async function markRequestAction(formData: FormData): Promise<void> {
  const openingId = String(formData.get("openingId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const gate = await editableOpening(openingId);
  if (!gate.ok) redirect(`/hiring/openings/${encodeURIComponent(openingId)}/candidates`);
  await markRequestHandled({ id: gate.user.id, orgId: gate.user.orgId }, openingId, requestId);
  revalidatePath(`/hiring/openings/${openingId}/candidates`);
  redirect(`/hiring/openings/${openingId}/candidates?handled=1`);
}
```

- [ ] **Step 7: Components and the page**

`src/components/hiring/candidates/new-link-button.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMT } from "@/i18n/manager-client";
import { newLinkAction, type NewLinkResult } from "@/app/(manager)/hiring/openings/[id]/candidates/actions";
import { CopyField } from "@/components/hiring/invite/copy-field";

/** One quiet button per row; the new link opens in a dialog, shown once, with the ready message. */
export function NewLinkButton({ openingId, assessmentId }: { openingId: string; assessmentId: string }) {
  const t = useMT("hiringCandidates");
  const ti = useMT("hiringInvite");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<NewLinkResult | null>(null);
  return (
    <>
      <Button variant="ghost" size="sm" disabled={pending} disabledReason={t("newLinkCreating")} title={t("newLinkHelp")} onClick={() => start(async () => setResult(await newLinkAction(openingId, assessmentId)))}>
        {pending ? t("newLinkCreating") : t("newLink")}
      </Button>
      <Dialog open={result !== null} onOpenChange={(open) => (open ? null : setResult(null))}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("newLink")}</DialogTitle>
            <DialogDescription>{result?.ok ? t("newLinkReady", { name: result.name, date: result.expires }) : result ? t(`err${result.code}`) : ""}</DialogDescription>
          </DialogHeader>
          {result?.ok ? (
            <div className="space-y-4">
              <CopyField id={`new-link-${assessmentId}`} label={ti("linkLabel")} value={result.url} primary copyLabel={ti("copyLink")} />
              <CopyField id={`new-message-${assessmentId}`} label={ti("messageLabel")} value={result.message.body} multiline copyLabel={ti("copyMessage")} />
              <p className="text-[13px] text-muted">{ti("onceNote")}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

`src/components/hiring/candidates/candidate-table.tsx`:
```tsx
import { extendLink } from "@/app/(manager)/actions";
import { markRequestAction } from "@/app/(manager)/hiring/openings/[id]/candidates/actions";
import { PendingButton } from "@/components/ui/pending-button";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { ago, shortDate } from "@/lib/format";
import type { OpeningCandidateRow } from "@/solutions/hiring/server/invitations";
import { NewLinkButton } from "./new-link-button";

const TONE = { INVITED: "neutral", OPENED: "neutral", IN_PROGRESS: "active", COMPLETED: "done", EXPIRED: "warn" } as const;
const KNOWN_REQUESTS = new Set(["ACCOMMODATION", "NEW_LINK", "ACCESS", "COPY", "DELETE"]);

/**
 * HIRING-UX 5.12: one row per candidate, in invitation order. Someone who runs
 * the opening acts on links and requests; a reviewer only reads (with blind
 * mode, "Aday 3" instead of a name). Never the extra-time percentage (A6).
 */
export function CandidateTable({ rows, openingId, edit, locale, t, now }: { rows: OpeningCandidateRow[]; openingId: string; edit: boolean; locale: Locale; t: ReturnType<typeof managerT>; now: Date }) {
  const back = `/hiring/openings/${openingId}/candidates`;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">{t("hiringCandidates.colSeq")}</TableHead>
          <TableHead>{t("hiringCandidates.colCandidate")}</TableHead>
          <TableHead>{t("hiringCandidates.colStatus")}</TableHead>
          <TableHead>{t("hiringCandidates.colProgress")}</TableHead>
          <TableHead>{t("hiringCandidates.colLast")}</TableHead>
          <TableHead>{t("hiringCandidates.colLink")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.assessmentId} className="align-top">
            <TableCell className="tnum text-muted">{row.seq}</TableCell>
            <TableCell>
              <p className="font-medium text-ink">{row.name ?? t("hiringCandidates.masked", { seq: row.seq })}</p>
              {row.email ? <p className="text-[13px] text-muted">{row.email}</p> : null}
              {row.adapted ? <p className="mt-1 text-[13px] text-muted">{t("hiringCandidates.adapted")}</p> : null}
              {row.requests.length ? (
                <ul className="mt-2 space-y-2" aria-label={t("hiringCandidates.requestsTitle")}>
                  {row.requests.map((request) => (
                    <li key={request.id} className="rounded-lg border border-line p-2 text-[13px]">
                      <p className="font-medium text-ink">{KNOWN_REQUESTS.has(request.kind) ? t(`hiringCandidates.request${request.kind as "NEW_LINK"}`) : t("hiringCandidates.requestOther")}</p>
                      {request.message ? <p className="mt-0.5 text-ink-2">{request.message}</p> : null}
                      <p className="tnum mt-0.5 text-muted">{ago(request.createdAt, locale, now)}</p>
                      {edit ? (
                        <form action={markRequestAction} className="mt-1">
                          <input type="hidden" name="openingId" value={openingId} />
                          <input type="hidden" name="requestId" value={request.id} />
                          <PendingButton size="sm" label={t("hiringCandidates.done")} pendingLabel={t("hiringCandidates.done")} />
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </TableCell>
            <TableCell>
              <StatusDot tone={TONE[row.progress]}>{t(`hiringCandidates.progress${row.progress}`)}</StatusDot>
            </TableCell>
            <TableCell className="tnum">{t("hiringCandidates.stages", { done: row.stagesDone, total: row.stageCount })}</TableCell>
            <TableCell className="tnum text-muted">{row.lastActivityAt ? ago(row.lastActivityAt, locale, now) : ""}</TableCell>
            <TableCell>
              {row.progress === "COMPLETED" ? (
                <span className="text-[13px] text-muted">{t("hiringCandidates.linkDone")}</span>
              ) : (
                <div className="space-y-1">
                  {row.link ? <p className="tnum text-[13px] text-muted">{t("hiringCandidates.linkUntil", { date: shortDate(row.link.expiresAt, locale) })}</p> : null}
                  {edit ? (
                    <div className="flex flex-wrap gap-1">
                      <NewLinkButton openingId={openingId} assessmentId={row.assessmentId} />
                      {row.link && (row.progress === "EXPIRED" || row.progress === "INVITED" || row.progress === "OPENED") ? (
                        <form action={extendLink}>
                          <input type="hidden" name="linkId" value={row.link.id} />
                          <input type="hidden" name="back" value={back} />
                          <PendingButton size="sm" label={t("hiringCandidates.extend")} pendingLabel={t("hiringCandidates.extend")} />
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```
(`PendingButton` takes `label`, `pendingLabel`, `variant` "primary" | "secondary" and `size` "sm" | "md"; `StatusDot` tones are `active`, `done`, `neutral`, `warn`; both read from the current files.)

`src/app/(manager)/hiring/openings/[id]/candidates/page.tsx`:
```tsx
import { Card } from "@/components/ui/card";
import { UrlNotice } from "@/components/ui/url-notice";
import { CandidateTable } from "@/components/hiring/candidates/candidate-table";
import { InviteSheet } from "@/components/hiring/invite/invite-sheet";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { one } from "@/lib/url-notice";
import { invitableOpenings, listOpeningCandidates } from "@/solutions/hiring/server/invitations";
import { openingFor } from "../access";
import { OpeningHeader } from "../opening-header";

export const dynamic = "force-dynamic";

/** HIRING-UX 5.12 "Adaylar": who was invited, where they are, their links and their open requests. */
export default async function OpeningCandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const runs = can(user, "opening:write");
  const now = new Date();
  const [rows, invitable, sp] = await Promise.all([
    listOpeningCandidates(user.orgId, opening.id, { runs, blindMode: opening.blindMode }, now),
    access.edit ? invitableOpenings(user.orgId) : Promise.resolve([]),
    searchParams,
  ]);
  const target = invitable.find((o) => o.id === opening.id) ?? null;
  const notice = one(sp.handled) === "1" ? t("hiringCandidates.requestHandled") : one(sp.extended) === "1" ? t("hiringCandidates.extended") : null;

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="candidates" locale={locale} t={t} action={target ? <InviteSheet opening={target} today={orgDay()} zone={zoneLabel(locale)} /> : null} />
      {notice ? (
        <UrlNotice params={["handled", "extended"]}>
          <p role="status" className="mt-section text-[13px] text-ink">
            {notice}
          </p>
        </UrlNotice>
      ) : null}
      <Card className="mt-section p-card">
        {rows.length === 0 ? (
          <div className="space-y-1">
            <p className="text-[14px] text-ink">{t("hiringCandidates.empty")}</p>
            {access.edit ? <p className="text-[13px] text-muted">{target?.live ? t("hiringCandidates.emptyRuns") : t("hiringCandidates.emptyNotLive")}</p> : null}
          </div>
        ) : (
          <CandidateTable rows={rows} openingId={opening.id} edit={access.edit} locale={locale} t={t} now={now} />
        )}
      </Card>
    </main>
  );
}
```

- [ ] **Step 8: Run the tests and the gates**

```bash
pnpm exec vitest run src/lib/url-notice.test.ts "src/app/(manager)/hiring" src/i18n
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS; the build lists `/hiring/openings/[id]/candidates`.

- [ ] **Step 9: Browser check (Claude in Chrome)**

On `kademe_ui_check` after Task 17 (or a fresh one with two `pnpm dev:hiring-link` invitations, one walked to the end with `--kind written`): open the opening's "Adaylar" tab: the rows with "Davet edildi" / "Devam ediyor" / "Tamamladı", "1/2 aşama", "Son hareket"; on a candidate's landing use "Linkim çalışmıyor" (the problem form, area LINK), and "Uyarlama talebi" from `/rights?type=accommodation`; reload the tab: both requests with the message; "Tamam": "Talep kapatıldı."; reload: the notice is gone and stays gone after a second reload (the deferred cleanup). "Yeni link üret": the dialog with the link once; the old link now shows the invalid-link card; the new one opens where the candidate left off. Set extra time 25 on one candidate (`select extra_time_pct from hiring_assessments`), check the row reads "Süre uyarlaması uygulandı" without a number. Log in as a reviewer on the team with blind mode on: "Aday 1", no e-mail, no adaptation line, no requests, no buttons. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add src/lib/url-notice.ts src/lib/url-notice.test.ts src/components/ui/url-notice.tsx "src/app/(manager)/hiring/openings/[id]/opening-header.tsx" "src/app/(manager)/hiring/openings/[id]/opening-header.test.ts" "src/app/(manager)/hiring/openings/[id]/candidates/page.tsx" "src/app/(manager)/hiring/openings/[id]/candidates/actions.ts" "src/app/(manager)/hiring/openings/[id]/candidates/actions.test.ts" src/components/hiring/candidates/candidate-table.tsx src/components/hiring/candidates/new-link-button.tsx src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Add the opening's Candidates tab

One row per invited candidate with where they are, their link and their
open requests; owners and managers create a new link (shown once), extend
an unopened one and close requests, a reviewer only reads and sees no
names under blind mode. The URL notice now leaves the address one tick
later so a full page load cannot bring it back.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Overview funnel and invite, the survey switch, the preview's bar (HIRING-UX 5.4, 5.18, 6.13)

**Files:**
- Create: `src/app/(manager)/hiring/openings/[id]/funnel.ts` (+ `funnel.test.ts`)
- Modify: `src/app/(manager)/hiring/openings/[id]/page.tsx` (the invite Sheet replaces the disabled button; the funnel card)
- Modify: `src/solutions/hiring/rules/opening-rules.ts` (`finishSurveyEnabled?`), `src/solutions/hiring/server/openings.ts`, `src/solutions/hiring/server/openings.test.ts`
- Modify: `src/app/(manager)/hiring/openings/[id]/settings/actions.ts`, `actions.test.ts`, `settings/page.tsx`, `src/components/hiring/opening-settings-form.tsx`
- Modify: `src/components/hiring/preview/steps.ts`, `steps.test.ts`, `preview.tsx` (the bar)
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (`hiringOverview`, `hiringSettings`)

**Interfaces:**
- Consumes: Task 7 (`openingFunnel`, `OpeningFunnel`); Task 6 `SURVEY_MIN_ANSWERS` (`@/solutions/hiring/rules/invitation`, pure, so the funnel test loads no database module); Task 17 (`invitableOpenings`, `InviteSheet`); Task 4 `progressOf` from `@/solutions/hiring/rules/candidate-flow` (imported as `flowProgress`, since `steps.ts` has its own `progressOf`).
- Produces:
  - `type FunnelView = { steps: Array<{ key: "invited" | "started" | "completed"; count: number }>; time: { median: number; estimate: number | null; over: boolean } | null; experience: { kind: "off" } | { kind: "waiting"; count: number; needed: number } | { kind: "shown"; average: number; count: number; latest: Array<{ rating: number; comment: string; at: Date }> } }` and `funnelView(f: OpeningFunnel, surveyEnabled: boolean): FunnelView | null` (null with no invitation).
  - `OpeningRulesInput.finishSurveyEnabled?: boolean` (left out = unchanged).
  - `barOf(version: CandidateVersion, step: Step): number` (0..1) in `steps.ts`.

- [ ] **Step 1: Write the failing tests**

`src/app/(manager)/hiring/openings/[id]/funnel.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { OpeningFunnel } from "@/solutions/hiring/server/invitations";
import { funnelView } from "./funnel";

const base: OpeningFunnel = { invited: 12, started: 9, completed: 7, medianMinutes: 34, estimateMinutes: 30, survey: { count: 3, average: null, latest: [] } };

describe("the overview's funnel (HIRING-UX 5.4)", () => {
  it("is nothing before the first invitation", () => {
    expect(funnelView({ ...base, invited: 0 }, true)).toBeNull();
  });

  it("counts invited, started, completed and compares the median time with the estimate", () => {
    const view = funnelView(base, true)!;
    expect(view.steps).toEqual([
      { key: "invited", count: 12 },
      { key: "started", count: 9 },
      { key: "completed", count: 7 },
    ]);
    expect(view.time).toEqual({ median: 34, estimate: 30, over: false });
    expect(funnelView({ ...base, medianMinutes: 40 }, true)!.time).toEqual({ median: 40, estimate: 30, over: true });
    expect(funnelView({ ...base, medianMinutes: null }, true)!.time).toBeNull();
  });

  it("shows the experience only from five answers, and says it is off when the survey is off", () => {
    expect(funnelView(base, true)!.experience).toEqual({ kind: "waiting", count: 3, needed: 5 });
    const shown = funnelView({ ...base, survey: { count: 6, average: 4.3, latest: [{ rating: 5, comment: "Net", at: new Date(0) }] } }, true)!;
    expect(shown.experience).toEqual({ kind: "shown", average: 4.3, count: 6, latest: [{ rating: 5, comment: "Net", at: new Date(0) }] });
    expect(funnelView(base, false)!.experience).toEqual({ kind: "off" });
  });
});
```

Append to `src/solutions/hiring/server/openings.test.ts`, inside the `saveOpeningRules` describe:
```ts
  it("saves the finish survey switch when the form sends it, and leaves it alone when it does not", async () => {
    await saveOpeningRules(ORG, OWNER, OPENING, input({ finishSurveyEnabled: false }));
    expect(writesOf(fake.ops)[0].values).toMatchObject({ finishSurveyEnabled: false });
    expect((writesOf(fake.ops).at(-1)!.values as { meta: Record<string, unknown> }).meta).toMatchObject({ finishSurveyEnabled: false });
    fake.ops = [];
    await saveOpeningRules(ORG, OWNER, OPENING, input());
    expect(writesOf(fake.ops)[0].values).not.toHaveProperty("finishSurveyEnabled");
  });
```

Append to `src/app/(manager)/hiring/openings/[id]/settings/actions.test.ts`, inside `describe("saveOpeningRulesAction")`:
```ts
  it("passes the finish survey switch through", async () => {
    await saveOpeningRulesAction(OPENING, { ...rules, finishSurveyEnabled: false });
    expect(saveOpeningRules).toHaveBeenCalledWith("o1", "u1", OPENING, { ...rules, finishSurveyEnabled: false });
  });
```

In `src/components/hiring/preview/steps.test.ts`, import `barOf` too and add:
```ts
  it("fills the bar with the same rule the candidate pages use", () => {
    expect(stepsOf(version).map((s) => barOf(version, s))).toEqual([0, 0, 0, 0.25, 0.5, 0.5, 1]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run "src/app/(manager)/hiring/openings/[id]" src/solutions/hiring/server/openings.test.ts src/components/hiring/preview/steps.test.ts`
Expected: FAIL (`./funnel` and `barOf` missing; `finishSurveyEnabled` is not in the update; the schema strips it).

- [ ] **Step 3: The funnel view and the bar**

`src/app/(manager)/hiring/openings/[id]/funnel.ts`:
```ts
import { SURVEY_MIN_ANSWERS } from "@/solutions/hiring/rules/invitation";
import type { OpeningFunnel } from "@/solutions/hiring/server/invitations";

export type FunnelView = {
  steps: Array<{ key: "invited" | "started" | "completed"; count: number }>;
  time: { median: number; estimate: number | null; over: boolean } | null;
  experience:
    | { kind: "off" }
    | { kind: "waiting"; count: number; needed: number }
    | { kind: "shown"; average: number; count: number; latest: Array<{ rating: number; comment: string; at: Date }> };
};

/** "Over" when candidates take a quarter longer than the estimate: worth a look at the timings. */
const OVER = 1.25;

/** HIRING-UX 5.4 in plan 2: the counts, the time against the estimate, and the experience from five answers. */
export function funnelView(f: OpeningFunnel, surveyEnabled: boolean): FunnelView | null {
  if (f.invited === 0) return null;
  return {
    steps: [
      { key: "invited", count: f.invited },
      { key: "started", count: f.started },
      { key: "completed", count: f.completed },
    ],
    time: f.medianMinutes === null ? null : { median: f.medianMinutes, estimate: f.estimateMinutes, over: f.estimateMinutes !== null && f.medianMinutes > f.estimateMinutes * OVER },
    experience:
      f.survey.average !== null
        ? { kind: "shown", average: f.survey.average, count: f.survey.count, latest: f.survey.latest }
        : !surveyEnabled
          ? { kind: "off" }
          : { kind: "waiting", count: f.survey.count, needed: SURVEY_MIN_ANSWERS },
  };
}
```
(Answers gathered before the survey was switched off still show once there are five.)

In `src/components/hiring/preview/steps.ts`, add the import `import { progressOf as flowProgress } from "@/solutions/hiring/rules/candidate-flow";` and:
```ts
/** The thin bar's fill: the candidate pages' rule (stages done plus the share of the current stage), 1 at the end. */
export function barOf(version: CandidateVersion, step: Step): number {
  if (step.kind === "intro") return 0;
  if (step.kind === "done") return 1;
  const stage = version.stages[step.stage];
  return flowProgress({
    stagePosition: step.stage + 1,
    stageCount: version.stages.length,
    activityIndex: step.kind === "activity" ? step.activity : 0,
    activityCount: stage.activities.length,
  }).ratio;
}
```
In `preview.tsx`, import `barOf`, and replace the bar's inner `style` with `style={{ width: `${Math.round(barOf(version, step) * 100)}%` }}` (the `index`/`total` arithmetic goes; keep `index` where `useStepFocus` uses it).

- [ ] **Step 4: The survey switch**

In `src/solutions/hiring/rules/opening-rules.ts`, add to `OpeningRulesInput`:
```ts
  /** The finish survey (HIRING-UX 6.13); left out by callers that do not show it, which keeps the saved value. */
  finishSurveyEnabled?: boolean;
```
In `saveOpeningRules` (`src/solutions/hiring/server/openings.ts`), add to the `.set({...})` object after `candidateContactEmail,`:
```ts
        ...(input.finishSurveyEnabled === undefined ? {} : { finishSurveyEnabled: input.finishSurveyEnabled }),
```
and to the audit `meta` after `candidateContactEmail`:
```ts
        ...(input.finishSurveyEnabled === undefined ? {} : { finishSurveyEnabled: input.finishSurveyEnabled }),
```
In `settings/actions.ts`, add to the zod `schema`: `finishSurveyEnabled: z.boolean().optional(),`.
In `settings/page.tsx`, add `finishSurveyEnabled: opening.finishSurveyEnabled,` to `initial`.
In `src/components/hiring/opening-settings-form.tsx`, at the end of the "Aday iletişimi" card (after the grid that holds the deadline, feedback days and contact e-mail), add:
```tsx
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Switch
              id="finish-survey"
              checked={value.finishSurveyEnabled ?? true}
              disabled={locked}
              onCheckedChange={(v) => set("finishSurveyEnabled", v)}
              aria-describedby="finish-survey-hint"
            />
            <Label htmlFor="finish-survey" className="text-[14px] font-normal text-ink">
              {t("finishSurvey")}
            </Label>
          </div>
          <p id="finish-survey-hint" className="pl-12 text-[13px] text-muted">
            {t("finishSurveyHint")}
          </p>
        </div>
```
Copy, `hiringSettings` TR: `"finishSurvey": "Bitişte kısa anket"`, `"finishSurveyHint": "Aday bitiş ekranında 1-5 arası puan ve isteğe bağlı yorum bırakabilir. Değerlendirmeyi etkilemez; ekip yalnızca 5 cevaptan sonra toplu sonucu görür."`; EN: `"finishSurvey": "Short survey at the finish"`, `"finishSurveyHint": "On the finish screen the candidate can leave a 1-5 rating and an optional comment. It does not affect the assessment; the team sees only the overall result, from 5 answers."`.

- [ ] **Step 5: The overview**

In `src/app/(manager)/hiring/openings/[id]/page.tsx`:
1. Imports: `import { InviteSheet } from "@/components/hiring/invite/invite-sheet";`, `import { orgDay, zoneLabel } from "@/lib/org-timezone";`, `import { invitableOpenings, openingFunnel } from "@/solutions/hiring/server/invitations";`, `import { funnelView } from "./funnel";`.
2. Load with the rest: `const [state, people, funnel, invitable] = await Promise.all([workingState(user.orgId, opening.id), loadPanelUsers(user.orgId), openingFunnel(user.orgId, opening.id), access.edit ? invitableOpenings(user.orgId) : Promise.resolve([])]);` and after it `const target = invitable.find((o) => o.id === opening.id) ?? null; const view = funnelView(funnel, opening.finishSurveyEnabled); const number = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 1 });`.
3. Replace the `else` branch of `action` (the disabled "Aday davet et") with:
```tsx
  ) : target ? (
    <InviteSheet opening={target} today={orgDay()} zone={zoneLabel(locale)} />
  ) : (
    <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:max-w-[360px] sm:items-end sm:text-right">
      <Button id="invite-candidate" variant="primary" disabled disabledReason={closed ? t("hiringOverview.closedBody") : !access.edit ? t("hiringCommon.noPermission") : t("hiringOverview.inviteLater")}>
        {t("hiringOverview.invite")}
      </Button>
      <DisabledReason id="invite-candidate-why">{closed ? t("hiringOverview.closedBody") : !access.edit ? t("hiringCommon.noPermission") : t("hiringOverview.inviteLater")}</DisabledReason>
    </div>
  );
```
4. Replace the funnel `Card` (the `else` of `state.draft ? ...`) with:
```tsx
          <Card className="p-card">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.funnelTitle")}</h2>
              {view ? (
                <Link href={`/hiring/openings/${opening.id}/candidates`} className="text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                  {t("hiringOverview.funnelAll")}
                </Link>
              ) : null}
            </div>
            {view ? (
              <>
                <dl className="mt-3 grid grid-cols-3 gap-4">
                  {view.steps.map((s) => (
                    <div key={s.key}>
                      <dt className="text-[13px] text-muted">{t(`hiringOverview.funnel_${s.key}`)}</dt>
                      <dd className="tnum text-[24px] leading-8 font-semibold text-ink">{s.count}</dd>
                    </div>
                  ))}
                </dl>
                {view.time ? (
                  <p className="tnum mt-3 text-[13px] text-ink">
                    {t("hiringOverview.funnelMedian", { minutes: view.time.median })}
                    {view.time.estimate !== null ? ` · ${t("hiringOverview.funnelEstimate", { minutes: view.time.estimate })}` : ""}
                    {view.time.over ? <span className="mt-1 block text-muted">{t("hiringOverview.funnelOver")}</span> : null}
                  </p>
                ) : null}
                <div className="mt-4 border-t border-line pt-3">
                  <h3 className="text-[14px] font-semibold text-ink">{t("hiringOverview.experienceTitle")}</h3>
                  {view.experience.kind === "off" ? (
                    <p className="mt-1 text-[13px] text-muted">{t("hiringOverview.experienceOff")}</p>
                  ) : view.experience.kind === "waiting" ? (
                    <p className="tnum mt-1 text-[13px] text-muted">{t("hiringOverview.experienceWaiting", { needed: view.experience.needed, count: view.experience.count })}</p>
                  ) : (
                    <>
                      <p className="tnum mt-1 text-[14px] text-ink">{t("hiringOverview.experienceAverage", { average: number.format(view.experience.average), count: view.experience.count })}</p>
                      <ul className="mt-2 space-y-1">
                        {view.experience.latest.map((c, i) => (
                          <li key={i} className="text-[13px] text-ink-2">
                            <span className="tnum text-muted">{c.rating}/5 · </span>
                            {c.comment}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-2 text-[13px] text-muted">{closed ? t("hiringOverview.closedBody") : t("hiringOverview.funnelEmpty")}</p>
            )}
          </Card>
```
Copy, `hiringOverview` TR: `"funnelAll": "Tüm adaylar"`, `"funnel_invited": "Davet"`, `"funnel_started": "Başladı"`, `"funnel_completed": "Tamamladı"`, `"funnelMedian": "Ortanca süre {minutes} dk"`, `"funnelEstimate": "tahmin {minutes} dk"`, `"funnelOver": "Adaylar tahminden belirgin uzun sürüyor; aşama sürelerine bakmak isteyebilirsin."`, `"experienceTitle": "Aday deneyimi"`, `"experienceOff": "Bitiş anketi kapalı."`, `"experienceWaiting": "{needed} cevap gelince görünür; şu an {count}."`, `"experienceAverage": "{average}/5 · {count} cevap"`; and change `"funnelEmpty"` to `"Henüz aday yok. İlk daveti açınca huni burada görünür."`. EN: `"funnelAll": "All candidates"`, `"funnel_invited": "Invited"`, `"funnel_started": "Started"`, `"funnel_completed": "Completed"`, `"funnelMedian": "Median time {minutes} min"`, `"funnelEstimate": "estimate {minutes} min"`, `"funnelOver": "Candidates take clearly longer than the estimate; you may want to look at the stage timings."`, `"experienceTitle": "Candidate experience"`, `"experienceOff": "The finish survey is off."`, `"experienceWaiting": "Shows from {needed} answers; {count} so far."`, `"experienceAverage": "{average}/5 · {count} answers"`, `"funnelEmpty": "No candidates yet. The funnel shows here once you send the first invitation."`. `inviteLater` now reads TR "Davet için değerlendirmeyi yayınla ve ekibe bir değerlendirici ekle." / EN "To invite, publish the assessment and add an evaluator to the team.".

- [ ] **Step 6: Run the tests and the gates**

```bash
pnpm exec vitest run "src/app/(manager)/hiring" src/solutions/hiring src/components/hiring src/i18n
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS.

- [ ] **Step 7: Browser check (Claude in Chrome)**

On `kademe_ui_check` with a few invitations (one walked to the end): the overview shows "Aday davet et" as the filled button opening the Sheet; the funnel with the three counts, "Ortanca süre ... dk · tahmin ... dk", "Aday deneyimi" with "5 cevap gelince görünür; şu an 1." (the shown state needs five finished candidates with answers; `funnel.test.ts` proves it, and in the browser it is "doğrulanmadı" unless five exist). "Ekip ve kurallar": the switch "Bitişte kısa anket"; turn it off, "Kaydet"; a finished candidate's `/done` no longer shows the survey. The preview's bar grows question by question and is full on the end screen. Stop the server; drop `kademe_ui_check`.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(manager)/hiring/openings/[id]/funnel.ts" "src/app/(manager)/hiring/openings/[id]/funnel.test.ts" "src/app/(manager)/hiring/openings/[id]/page.tsx" src/solutions/hiring/rules/opening-rules.ts src/solutions/hiring/server/openings.ts src/solutions/hiring/server/openings.test.ts "src/app/(manager)/hiring/openings/[id]/settings/actions.ts" "src/app/(manager)/hiring/openings/[id]/settings/actions.test.ts" "src/app/(manager)/hiring/openings/[id]/settings/page.tsx" src/components/hiring/opening-settings-form.tsx src/components/hiring/preview/steps.ts src/components/hiring/preview/steps.test.ts src/components/hiring/preview/preview.tsx src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Show the hiring funnel and open invitations from the overview

The overview's filled button now opens the invite Sheet once the opening
is live and has a team, and the funnel card counts invited, started and
completed with the median time against the estimate and the candidate
experience from five answers. The finish survey gets its switch on team
and rules, and the preview's bar uses the candidate pages' progress rule.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Today invites for each solution the user may use (HIRING-UX 4.5)

**Files:**
- Create: `src/components/manager/invite-choice.ts` (+ `invite-choice.test.ts`), `src/components/manager/invite-menu.tsx`
- Modify: `src/solutions/hiring/manifest.ts` (`inviteHref: "/hiring/invite"`), `src/solutions/registry.test.ts`
- Modify: `src/app/(manager)/dashboard/page.tsx`
- Modify: `src/i18n/messages/screens.tr.json`, `screens.en.json` (`today.inviteMenu`, `today.noInvitePermission`)

**Interfaces:**
- Consumes: Task 2 `inviteTargets(): InviteTarget[]` with `InviteTarget = { key; href; label: I18nLabel; capability: Capability }`; `can`.
- Produces: `type InviteChoice = { kind: "none" } | { kind: "one"; href: string; label: string } | { kind: "many"; items: Array<{ key: string; href: string; label: string }> }` and `inviteChoice(targets: InviteTarget[], allowed: (capability: Capability) => boolean, locale: Locale): InviteChoice`; `<InviteMenu label items />`.

- [ ] **Step 1: Write the failing tests**

`src/components/manager/invite-choice.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { InviteTarget } from "@/solutions/registry";
import { inviteChoice } from "./invite-choice";

const hiring: InviteTarget = { key: "hiring", href: "/hiring/invite", label: { tr: "Aday davet et", en: "Invite a candidate" }, capability: "opening:write" };
const exam: InviteTarget = { key: "language-exam", href: "/exam/students/new", label: { tr: "Öğrenci davet et", en: "Invite a student" }, capability: "student:invite" };

describe("Today's invite button (HIRING-UX 4.5)", () => {
  it("is one link with the solution's own label when one solution is allowed", () => {
    expect(inviteChoice([hiring, exam], (c) => c === "student:invite", "tr")).toEqual({ kind: "one", href: "/exam/students/new", label: "Öğrenci davet et" });
  });

  it("is a menu in menu order when more than one is allowed", () => {
    expect(inviteChoice([hiring, exam], () => true, "en")).toEqual({
      kind: "many",
      items: [
        { key: "hiring", href: "/hiring/invite", label: "Invite a candidate" },
        { key: "language-exam", href: "/exam/students/new", label: "Invite a student" },
      ],
    });
  });

  it("is nothing to click when none is allowed", () => {
    expect(inviteChoice([hiring, exam], () => false, "tr")).toEqual({ kind: "none" });
  });
});
```

In `src/solutions/registry.test.ts`, replace the body of `"invites from Today with the first solution that can invite, not the first in the menu"` (rename it `"lists every solution that can invite, in menu order, with its label and capability"`) with:
```ts
    expect(inviteTargets()).toEqual([
      { key: "hiring", href: "/hiring/invite", label: { tr: "Aday davet et", en: "Invite a candidate" }, capability: "opening:write" },
      { key: "language-exam", href: "/exam/students/new", label: { tr: "Öğrenci davet et", en: "Invite a student" }, capability: "student:invite" },
    ]);
    const noInvite = { ...languageExamManifest, inviteHref: null } as SolutionManifest;
    expect(inviteTargets([noInvite])).toEqual([]);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/components/manager/invite-choice.test.ts src/solutions/registry.test.ts`
Expected: FAIL (`./invite-choice` missing; hiring has no `inviteHref`).

- [ ] **Step 3: Implement**

`src/components/manager/invite-choice.ts`:
```ts
import type { Locale } from "@/i18n/locale";
import type { Capability } from "@/lib/authorize";
import type { InviteTarget } from "@/solutions/registry";

export type InviteChoice = { kind: "none" } | { kind: "one"; href: string; label: string } | { kind: "many"; items: Array<{ key: string; href: string; label: string }> };

/** One allowed solution: its own button. More: a menu, "Davet et". None: the disabled button with its reason. */
export function inviteChoice(targets: InviteTarget[], allowed: (capability: Capability) => boolean, locale: Locale): InviteChoice {
  const items = targets.filter((t) => allowed(t.capability)).map((t) => ({ key: t.key, href: t.href, label: t.label[locale] }));
  if (items.length === 0) return { kind: "none" };
  if (items.length === 1) return { kind: "one", href: items[0].href, label: items[0].label };
  return { kind: "many", items };
}
```

`src/components/manager/invite-menu.tsx`:
```tsx
"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Today's "Davet et" when the user may invite for more than one solution. */
export function InviteMenu({ label, items }: { label: string; items: Array<{ key: string; href: string; label: string }> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id="today-invite" variant="primary">
          {label}
          <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem key={item.key} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

In `src/solutions/hiring/manifest.ts`, set `inviteHref: "/hiring/invite",`.

In `src/app/(manager)/dashboard/page.tsx`:
1. Imports: add `import { InviteMenu } from "@/components/manager/invite-menu";` and `import { inviteChoice } from "@/components/manager/invite-choice";`.
2. Replace the three lines from `const canInvite = ...` to `const inviteHref = ...` with:
```ts
  // Every solution that can invite and that this user may invite for (HIRING-UX 4.5).
  const invite = inviteChoice(inviteTargets(), (capability) => can(user, capability), locale);
```
3. Replace the `action={...}` of `PageHead` with:
```tsx
        action={
          invite.kind === "many" ? (
            <InviteMenu label={t("today.inviteMenu")} items={invite.items} />
          ) : invite.kind === "one" ? (
            <Button asChild variant="primary">
              <Link href={invite.href}>{invite.label}</Link>
            </Button>
          ) : (
            <div className="flex flex-col items-end">
              <Button variant="primary" disabled disabledReason={t("today.noInvitePermission")}>
                {t("today.inviteMenu")}
              </Button>
              <DisabledReason>{t("today.noInvitePermission")}</DisabledReason>
            </div>
          )
        }
```
(`locale` is already read on this page: `const locale = await managerLocale();`.)

Copy in `screens.tr.json` / `screens.en.json`, `today`: add `"inviteMenu": "Davet et"` / `"inviteMenu": "Invite"`, and change `"noInvitePermission"` to `"Rolün davet açamaz."` / `"Your role cannot send invitations."`. (`today.invite` stays: the exam's own pages use it; `grep -rn "today.invite\"" src` before removing anything.)

- [ ] **Step 4: Run the tests and the gates**

```bash
pnpm exec vitest run src/components/manager src/solutions/registry.test.ts src/lib/legacy-routes.test.ts src/i18n
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS; `legacy-routes.test.ts` now also proves `/hiring/invite/page.tsx` exists.

- [ ] **Step 5: Browser check (Claude in Chrome)**

`/dashboard` as the owner: "Davet et" opens a menu with "Aday davet et" and "Öğrenci davet et"; each item goes to its screen; keyboard: Enter opens the menu, arrows move, Escape closes. As a reviewer: the disabled button with "Rolün davet açamaz.". Switch the panel to English: "Invite", "Invite a candidate", "Invite a student".

- [ ] **Step 6: Commit**

```bash
git add src/components/manager/invite-choice.ts src/components/manager/invite-choice.test.ts src/components/manager/invite-menu.tsx src/solutions/hiring/manifest.ts src/solutions/registry.test.ts "src/app/(manager)/dashboard/page.tsx" src/i18n/messages/screens.tr.json src/i18n/messages/screens.en.json
git commit -m "Invite from Today for every solution the user may use

Hiring now offers /hiring/invite. Today shows one button with the
solution's own label when the user may invite for one solution, a Davet
et menu when for more, and the disabled button with its reason when for
none.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Full verification, the HIRING-UX walk, and STATUS

**Files:**
- Modify: `docs/STATUS.md`

**Interfaces:**
- Consumes: every earlier task; `pnpm verify:exam`, `verify:guard`, `verify:hiring-flow`, `verify:hiring-setup`, `verify:hiring-immutability`, `dev:hiring-link`.
- Produces: the "Doğrulananlar" and "Hâlâ doğrulanmadı" entries for plan 2, each with its command output or "doğrulanmadı".

- [ ] **Step 1: Gates on `kademe_platform`**

```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate
pnpm exec tsc --noEmit
pnpm exec eslint src scripts
pnpm test 2>&1 | tail -5
pnpm build 2>&1 | tail -40
```
Expected: `tsc` and `eslint` print nothing; `pnpm test` reports every file and test passing (write the two numbers; plan 1 ended at 1453 tests in 117 files); `pnpm build` lists the new routes `/a/[token]/practice`, `/a/[token]/stage/[n]`, `/hiring/invite`, `/hiring/openings/[id]/candidates` and the eight `/api/c/[token]/hiring/*` routes (write the route count).

- [ ] **Step 2: The exam and the guard did not move**

Start the dev server on 3100 against `kademe_platform` (`DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm dev --port 3100`), then:
```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam 2>&1 | tail -30
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard 2>&1 | tail -40
```
Expected: `verify:exam` all checks passed (24 `ok` before plan 2; write the number); `verify:guard` all `ok` including the Task 10 additions (an invitation without hiring rows answers like an unknown token). Stop the server.

- [ ] **Step 3: Hiring scripts on throw-away databases**

```bash
for db in kademe_flow_check kademe_setup_check kademe_immut_check; do
  docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists $db" -c "create database $db"
  DATABASE_URL=postgresql://kademe:kademe@localhost:5434/$db pnpm db:migrate
done
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm verify:hiring-flow 2>&1 | tail -60
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_setup_check pnpm verify:hiring-setup 2>&1 | tail -10
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_immut_check pnpm verify:hiring-immutability 2>&1 | tail -10
for db in kademe_flow_check kademe_setup_check kademe_immut_check; do
  docker exec kademe-db psql -U kademe -d postgres -c "drop database $db"
done
```
Expected: each prints its `ok` lines and `all checks passed` with no `FAIL` (plan 1: setup 188, immutability 43; write the new numbers). If one fails: fix the code, never the check, and rerun on fresh databases.

- [ ] **Step 4: Fingerprint of 0010**

Stop the dev server first. Then, the same commands as Task 1 Step 6:
```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_push_check" -c "create database kademe_push_check" -c "drop database if exists kademe_mig_check" -c "create database kademe_mig_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm exec drizzle-kit push --force < /dev/null 2>&1 | tee /tmp/kademe-push.log
grep -i "error" /tmp/kademe-push.log && echo "PUSH LOG HAS AN ERROR" || echo "push log clean"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm -s db:fingerprint > /tmp/kademe-push.fp
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm -s db:fingerprint > /tmp/kademe-mig.fp
diff /tmp/kademe-push.fp /tmp/kademe-mig.fp && echo IDENTICAL
wc -l < /tmp/kademe-mig.fp
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_push_check" -c "drop database kademe_mig_check"
```
Expected: `push log clean`, `IDENTICAL` (write the line count). Repeated here because no later task may have touched the schema without a migration.

- [ ] **Step 5: Em-dash and banned words**

```bash
git diff --name-only --diff-filter=d 794b363 HEAD | xargs perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}/; close ARGV if eof'; echo "em-dash scan done"
node -e 'const bad = /ihlal|hile|şüpheli|başarısız|violation|cheat|suspicious/i; for (const f of ["tr", "en"]) { const m = require("./src/i18n/messages/candidate." + f + ".json"); for (const [ns, v] of Object.entries(m)) if (ns.startsWith("hiring")) for (const [k, t] of Object.entries(v)) if (bad.test(String(t))) console.log(f, ns, k, t); } console.log("banned word scan done")'
```
Expected: each command prints only its closing line ("em-dash scan done", "banned word scan done"); any line above it names a file and line, or a namespace and key, to fix (`hiring-candidate-copy.test.ts` checks the same words in tests; this is the file-level look for A10 and E5). Note: the exam's own candidate keys are outside this check and are not changed by plan 2.

- [ ] **Step 6: Walk the acceptance list in Chrome (Claude in Chrome only)**

Fresh `kademe_ui_check` (`create database kademe_ui_check template kademe_platform`), dev server on 3100 with `DATABASE_URL` pointing at it, and `PROCTOR_DEV_FAKE` unset (check `env | grep PROCTOR` prints nothing; the memory note "No fake flags on handover" is why). Load the browser tools once: `ToolSearch` with `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp,mcp__claude-in-chrome__read_network_requests,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__form_input,mcp__claude-in-chrome__file_upload,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__get_page_text`. Never use the Playwright tools.

For each item write one line for STATUS: what was seen, or "doğrulanmadı" and why.
1. **A1**: with a stopwatch (two `Date.now()` reads through `javascript_tool`): open a fresh `--kind written` link, skip nothing that is required, measure link open to first question visible (target 3 minutes, device check 60 s; the written fixture has no device rows, so measure the device check on a full-fixture link separately).
2. **A3**: on the landing, list what is said before "Başla": duration, stage count, last day, reviewer count, what AI does and does not, every recorded signal ("Ne kaydediliyor"), retention, the rights link. Then compare "Ne kaydediliyor" with what the full fixture actually stores (`select kind from media_assets` and the response payload keys after a walk): signals stored but not listed must be 0.
3. **A4, A5, A7**: as in Task 14 Step 10 (network list empty during the warm-up; flexible think does not start recording; the written alternative is one click and stored with `used_text_alternative = t`).
4. **A6**: choose 25% extra time on the details page without any reason field; the reviewer's Candidates tab shows no percentage and no reason (Task 18 Step 9).
5. **A8**: on a running stage note the remaining time, reload twice: the time continues from the server (never back to the start, never longer), the "Kaldığın yerden" screen appears, answers are there.
6. **A9**: the finish shows a date and a human e-mail; reopening the same link shows `/done`. The status line after a decision is plan 3: write "durum satırı plan 3".
7. **A10**: Step 5's file search plus the rendered pages' text (`get_page_text` on landing, check, stage, done): none of the banned words.
8. **A11**: axe-core is not a project dependency. Inject it from cdnjs through `javascript_tool` (`const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/<version>/axe.min.js"`, pick the current version listed on cdnjs at the time), then `await axe.run()` and count `violations` with `impact` `serious` or `critical` on landing, details, check, stage intro, a text question, a choice question, the file question, done. If the script is blocked (CSP) or cdnjs is unreachable, write "axe doğrulanmadı" and do the keyboard pass alone: Tab through each page, every control reachable and visible on focus, choice keys 1-9. Touch targets: `javascript_tool` listing interactive elements smaller than 44x44 px.
9. **A2, real camera, iPhone Safari, Android Chrome**: "doğrulanmadı, gerçek cihazla kullanıcıyla" unless the user runs them in this session; if they do, write exactly what they saw.
10. **A12**: pilot target, not measurable locally: "pilot".
11. **R14**: time Today, "Davet et", "Aday davet et", fill, "Davet linkini oluştur", "Linki kopyala" (target 30 s, 4 clicks after the form is filled; write both numbers).
12. **E1-E5** on every new screen (candidate: landing, details, check, practice, stage intro, each question type, resume, done; panel: `/hiring/invite`, the Sheet, Candidates, overview funnel, the settings switch, Today menu): one filled button, disabled buttons say why, empty/loading/error states (the Candidates tab empty, the invite form's waiting reason; the stage's offline strip only if the user switches DevTools to offline, otherwise "offline şeridi doğrulanmadı", since the automation tab cannot cut its own network), TR and EN (switch both sides), accent only on the filled button, active state and counters, no em-dash.
Drop `kademe_ui_check` and stop the server at the end.

- [ ] **Step 7: Write STATUS**

In `docs/STATUS.md`:
1. The "Son güncelleme" line: `2026-10-05 (işe alım plan 2, aday akışı, platform/solutions dalında, yerelde doğrulandı; canlıya çıkmadı)`.
2. Add a row to "Doğrulananlar (komut çıktısıyla)" titled `İşe alım plan 2, aday akışı (yerel, 2026-10-05)` with the numbers from Steps 1-5 (tests and files, routes, `verify:exam` and `verify:guard` counts, `verify:hiring-flow` / `verify:hiring-setup` / `verify:hiring-immutability` counts with "0 FAIL", fingerprint line count and `IDENTICAL`, "no em-dash") and one sentence per Chrome item from Step 6 that was seen.
3. In "Hâlâ doğrulanmadı": replace item 7 ("İşe alımın aday akışı yok") with what is now true: the candidate flow is live behind invitations; review, decision, comparison and proctoring are plans 3-4; the candidate's status line after a decision is plan 3; candidates are never monitored in plan 2 (`proctor_level` frozen OFF). Add each Step 6 item written as "doğrulanmadı" with its reason, and the open questions below that the controller has not ruled on.
4. Under "Kararlar ve sapmalar", one line per decision from this plan's "Decisions" list that differs from HIRING-UX (full-panel assignments instead of rotation; multi choice scored by exact set; requests in `deletion_requests`; consent frozen per invitation; a closed opening stops only unstarted candidates; no 60 second explainer video).
Write in Turkish, like the rest of the file, with no em-dash.

- [ ] **Step 8: Commit**

```bash
git add docs/STATUS.md
git commit -m "Record the hiring candidate flow verification in STATUS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (HIRING-UX and the controller's scope):**

| Requirement | Task |
|---|---|
| Invite to the live version (form, pasted list, link once, message, duplicate) | 7, 17 |
| Per-opening candidate list with status, new link, extend, requests | 7, 18 |
| `hiring_assessments`, assignments, stage runs, responses, survey (tenancy, RESTRICT to users, additive 0010) | 1 |
| Landing with everything A3 lists, consent per version (frozen per invitation) | 5, 7, 11 |
| Details (only what is missing), extra time 0/25/50 without a reason | 3, 8, 12 |
| Device check with plain fixes, only the devices this version needs | 5, 12 |
| Warm-up that sends nothing | 14 |
| Stages with server clocks, resume, auto submit, grace, back navigation | 4, 8, 13 |
| Video, audio (think, takes, review, written alternative), long and short text, single and multi choice, file | 13, 14, 15 |
| Never lose an answer (autosave, beacon on pagehide, flush before commit, parts while recording, INCOMPLETE kept) | 13, 14 |
| Done with a dated promise, human contact, devices off, survey | 16 |
| Media upload and transcription hooks reused from core | 2, 8, 9 |
| Rights page and accommodation request | 3 |
| E-mail sending reuse (`message_outbox`) | 7 |
| Retention hook (`attempts.closeExpired`, salvage, the core retention job reads `media_assets`) | 2, 8, 9 |
| `candidateFlowLive` flip with leak proof (sentinels, positive control, `candidateSafe`) | 5, 9, 10 |
| Overview funnel, survey switch, preview bar | 19 |
| Today invite per solution | 20 |
| Proctoring: what the candidate sees | Scope boundary; 5 (`recordedSignals`), 11 |
| Plan 1 carries (url-notice deferral, progress rule, step focus, org day, aiLimitReached, finish-survey column) | 1, 4, 11-18, 19 |

`aiLimitReached` has no new call site: plan 2 adds no AI call (transcription is the core job, which already checks its own limits); written as a constraint so plan 3's AI review starts from it.

Gaps left on purpose (plans 3-4, listed in "Open questions"): the candidate's status line after a decision (A9 second half), reviewer scoring and blind-mode lifting, proctoring levels.

**2. Placeholder scan:** searched the plan for "TBD", "TODO", "implement later", "similar to Task", "add appropriate", "handle edge cases": no hits in task steps. Two steps tell the implementer to read a value at run time rather than guess it: Task 21 Step 6 (the current axe-core version on cdnjs) and the browser checks that write down measured numbers.

**3. Type consistency:** checked by name across tasks: `HiringCandidateState` (`path` relative, `finished.feedbackBy`), `CurrentStage`, `CandidateResponseView`, `LocalAnswer` (`hasTake`, `hasFile`), `ActivityProps`, `RecordingSink`/`OpenTake`/`RecordingResult`, `ChunkedUploader.open(token, initPath, body, mime, onStatus?)`, `OpeningCandidateRow.requests[].message`, `InviteOpening`, `InviteTarget`, `NewLinkOutcome`, `OpeningFunnel`, `StageRule.kind`. `ActivityHeader` takes `Pick<CandidateActivity, "id" | "prompt" | "note">` so the warm-up can use it.

## Open questions for the controller

1. **Flip timing.** `candidateFlowLive` turns on in Task 10, before the candidate screens (Tasks 11-16), because their browser checks need live endpoints. No user can create a hiring invitation until Task 17, so nothing is reachable in between; scripts create invitations only in `*_check` databases. Acceptable, or should the flip move to Task 16?
2. **Assignments.** Every active member of the opening's panel becomes an assignment at invitation time; HIRING-UX's rotation (N of M reviewers) is not built. Rotation belongs with plan 3's queue.
3. **Consent.** The hiring consent text is frozen per invitation (`hiring_assessments.consent_text_id`); `hiring_versions.consent_text_id` stays null. Plan 4 needs a proctoring-level-specific text; is a per-version text then required, or stays per invitation?
4. **Closed opening.** Closing stops only candidates who have not started; a started candidate may finish. HIRING-UX does not say; confirm.
5. **Choice scoring.** Multi choice scores 1 only for the exact set, else 0 (no partial credit). Confirm, or partial credit in plan 3?
6. **Requests storage.** Accommodation and new-link requests reuse `deletion_requests` (text `kind`), next to data rights. Fine as a stopgap, or a `candidate_requests` table in plan 3 (Today shows accommodation requests only from plan 3)?
7. **Deferred to plan 3:** the candidate's status line and status endpoint after a decision (A9 second half); reviewer views of answers; blind mode lifting after a reviewer's own submission.
8. **Proctoring.** `proctor_level` is frozen OFF and the browser proctoring engine never starts for hiring; the landing says so. Plan 4 decides levels and copy.
9. **Not built:** the 60 second explainer video on the landing (HIRING-UX 6.1 mentions it); the stage grace period is baked into the deadline the server stores rather than shown as a separate clock.
10. **Capability coincidence.** The Candidates tab's "7 gün uzat" reuses the core `extendLink`, which asks `student:invite`; today that is the same roles as `opening:write` (OWNER, MANAGER). If roles diverge later, hiring needs its own extend action.
