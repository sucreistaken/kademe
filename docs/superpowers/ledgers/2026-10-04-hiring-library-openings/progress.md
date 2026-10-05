# SDD ledger - plan: docs/superpowers/plans/2026-10-04-hiring-library-openings.md
Spec: docs/superpowers/specs/2026-10-04-hiring-solution-design.md + docs/design/HIRING-UX.md + platform spec. Branch platform/solutions. Start HEAD after plan commit. Work DB kademe_platform.

## Rulings (before execution)
- Ruling: accept the plan author's 16 open-point decisions (candidateFlowLive flag; inviteHref null + inviteTargets; library usage hook; seed_key/reviewed_at; one scale per org; draft weights on version, weight sets with reason; profile weight = importance, largest remainder; publish gate = spec 2.2 + 3 obvious rules, team/preview advisory; published builder read-only, "start editing" opens v(n+1); up/down ordering; AI proposals not persisted, quotes verified; question check keyword layer + optional AI; proctoring and consent_text_id out of this plan; access OWNER/MANAGER all, REVIEWER own openings read-only; UndoStrip onSubmitted; publish not undoable with inline notice) - why: each follows the specs or fills a spec gap with the smallest choice - cost if wrong: per-item rework, listed in the final rulings.
- Ruling: spec conflict proctor_level (HIRING-UX 5.18 editable on a live opening vs locked version) -> decided in plan 4; plan 1 does not edit proctoring.
- Ruling: assignment model (HIRING-UX 5.18 per-candidate count/rotation vs spec 2.1 copy panel at invite) -> decided in plan 2.
- Ruling: the 24 competency anchor sentences written by the plan author need team review; competencies.reviewed_at drives the "ekibiniz incelemedi" label so this is visible in the product.
- Ruling: pre-flight scan delegated to a subagent (plan is ~13k lines; reading it in the controller would flood context); the controller reads the resulting table and rules on each row - cost if wrong: a conflict the scanner missed surfaces in a task review instead.

## Pre-flight scan (subagent)

Scope: plan read in full (13347 lines, Tasks 1-21 + Self-Review), checked against the hiring spec, the platform spec, HIRING-UX (0, 3.3, 3.9, 4.1-4.6, 5.2-5.10, 5.18, 8.3-8.4, 10, 11), RULES.md and the code at ae00611. Read-only: no suite, no build, no tsc, no DB query was run. Scripted checks (scratchpad, not committed): every ```json block of the plan parsed and TR/EN keys compared per namespace (all 15 namespaces equal: libCompetencies 56, libScales 9, libPositions 49, libAnchorAi 9, hiringCommon 18, hiringOpenings 18, hiringNew 27, hiringOverview 22, hiringGate 15, hiringBuilder 84, hiringScorecard 38, hiringAi 33, hiringCheck 14, hiringPreview 26, hiringSettings 42); every literal `t("...")` in plan code resolved against those + existing dictionaries (0 missing); every `it(` in plan tests contains an `expect` (0 empty); the 24 seed anchors run through a Python copy of `anchorHint` (0 flagged); `grep -c` em-dash in the plan = 0, in existing dictionaries = 0, in docs/STATUS.md = 0. Conflict ids (C1..C26) are defined in table 4.

### 1. Task pairs that share a file or an interface

| Pair | Produced -> consumed (exact names) | Finding |
|---|---|---|
| T1-T4 | `src/solutions/types.ts`: T1 adds `candidateFlowLive: boolean;` after `inviteHref: string;`; T4 inserts `positionAction?` "after `candidateFlowLive: boolean;`" and `library?` after `attempts` | OK |
| T1-T6 | `src/solutions/registry.test.ts`: T1 appends `describe("candidate flow")` + import `candidateSolution`; T6 replaces the menu test and adds `languageExamManifest`, `SolutionManifest` imports | OK (disjoint edits); test title replaced, see C11 |
| T1-T14 | `candidateFlowLive` (T14 `hiringManifest.candidateFlowLive: false`); `candidateSolution(kind, modules = MODULES)` (T14 sets `MODULES = [hiringModule, languageExamModule]`); registry.test.ts rewritten whole by T14 with an equivalent candidate-flow test | OK; T14 doc-comment duplication C14 |
| T1-T21 | `scripts/verify-solution-guard.ts` log label "no live candidate flow"; T21 reruns `verify:guard` | OK |
| T2-T3 | `ratingScales` (`one_default_scale_per_org` partial unique), `scaleLevels`, `competencies` (`seed_key`, `competency_seed_key_per_org`), `competencyAnchors`, `observationTags` -> `ensureDefaultScale` / `seedLibrary` `onConflictDoNothing()` | OK (untargeted ON CONFLICT also matches a partial unique index) |
| T2-T4 | `seedKey`, `reviewedAt`, `archivedAt`, `positionCompetencies.weight/expectedLevel/orderIndex` -> `listCompetencies`, `loadCompetency`, `listPositions`, `loadPosition` | OK |
| T2-T5 | library tables -> `createCompetency` (`reviewedAt: new Date()`), `saveCompetency` (tag `archivedAt`), `saveScaleLabels` | OK |
| T2-T6 | `positions.team/shortDescription/jobDescription/skills/languages`, `positionCompetencies` -> `createPosition`, `savePosition` | OK |
| T2-T7 | `type AiPurpose = (typeof aiPurpose.enumValues)[number]` incl. `ANCHOR_DRAFT` -> `draftAnchors` meta `purpose: "ANCHOR_DRAFT"` | OK |
| T2-T8 | `enums.ts` (T8 appends after `ANCHOR_DRAFT`), `schema/index.ts` (export after `./library`), journal idx 4 -> 5, `migrations-sql.test.ts` appended; hiring FKs to `competencies`/`positions` | OK |
| T2-T9 | journal 0004 -> 0006; T9 script inserts `rating_scales(org_id,name,is_default)`, `competencies(org_id,name,scale_id)`, `positions(org_id,name)` | OK (columns match T2 schema) |
| T2-T11 | library tables -> `loadCompetencyFacts`, `loadScaleSnapshot`, `positionProfile` | OK |
| T2-T17 | `competencies`, `positions.jobDescription` -> `findOrCreateCompetency`, `removeCompetencyIfUnused` (DELETE), `setPositionJobAdIfEmpty` | CONFLICT C1 (T2's own schema doc says "Nothing is deleted") |
| T3-T4 | `missingAnchorLevels` -> `listCompetencies` | OK |
| T3-T5 | `ensureDefaultScale`, `seedLibrary`, `hasText`, `MAX_TAGS_PER_SIDE`, `ANCHOR_LEVELS`, `REQUIRED_ANCHOR_LEVELS`, `anchorHint` -> library-write, actions, CompetencyForm | OK; `ANCHOR_LEVELS` missing from T3 Interfaces (C15) |
| T3-T7 | `hasText`, `REQUIRED_ANCHOR_LEVELS` -> `parseAnchorAnswer` | OK |
| T3-T9 | `package.json` scripts `db:seed-library` then `verify:hiring-immutability` | OK (distinct keys) |
| T3-T10 | `hasText`, `missingAnchorLevels` -> `publishProblems`, `buildScorecard` | OK |
| T3-T11 | `seedLibrary` in `verify-hiring-setup.ts`; `package.json` `verify:hiring-setup` | OK |
| T3-T16 | `hasText`, `REQUIRED_ANCHOR_LEVELS` -> `AnchorSheet`; `missingAnchorLevels` -> scorecard page, `saveAnchors` | OK |
| T3-T18 | `hasText` -> `checkQuestionsAction` | OK |
| T3-T21 | STATUS line for `pnpm db:seed-library` | OK |
| T4-T5 | `loadDefaultScale`, `listCompetencies`, `loadCompetency`, `libraryUsage`, `liveCount`, `CompetencyRow`, `CompetencyDetail`, caps `library:write`, `library:scale` | OK |
| T4-T6 | `listPositions`, `loadPosition`, `activeCompetencyOptions`, `PositionRow`, `SolutionManifest.positionAction` | OK |
| T4-T7 | `loadCompetency`, `loadDefaultScale` -> `draftAnchorsAction` | OK |
| T4-T13 | capability `opening:write` -> `requireUser("opening:write")`, `can()` | OK |
| T4-T14 | `LibraryRefs`, `LibraryUsage`, `LibraryUsageEntry`, `library?.usage`, `positionAction` -> `hiringModule.library.usage = hiringLibraryUsage`, `hiringManifest.positionAction` | OK (arrow property satisfies method signature) |
| T4-T15 | `activeCompetencyOptions` -> builder page | OK |
| T4-T16 | `loadDefaultScale`, `library:write` -> scorecard page, `saveAnchorsAction` | OK |
| T4-T17 | `activeCompetencyOptions`, `loadPosition`, `library:write` -> `draftLibrary`, AI page, `acceptCompetencyAction` | OK |
| T5-T6 | `library-write.ts` (T6 appends, reuses `audit`, `Executor`), `library/actions.ts` (reuses `z`, `isUuid`, `requireUser`), `library.*.json` (+`libPositions`), `PageTitle`, `UsageBlock` | OK; dir-level `git add` C3; duplicated blocks C13 |
| T5-T7 | `competency-form.tsx` placeholder `{/* Task 7: the AI anchor assist goes here. */}` (exact text in T5), `actions.ts` `i18n` const, `library.*.json` (+`libAnchorAi`) | OK |
| T5-T11 | `Executor` (`PgDatabase<PostgresJsQueryResultHKT, typeof schema>`; `@/db` is built with `{ schema }`) -> versions/content/openings default `x = db` | OK |
| T5-T12 | `createCompetency`, `saveCompetency` (AnchorInput keys "1"/"3"/"5") in script | OK |
| T5-T13 | `messages.test.ts` (T5 renames collision test; T13 adds `hiringTr` there), `i18n/manager.ts` merge pattern, `PageTitle`, `RouteTabs`, `pickText` | OK; rename C11 |
| T5-T14 | `UsageBlock` / `liveNote` read `LibraryUsageEntry.total/live` produced by `hiringLibraryUsage` | OK |
| T5-T15 | `UndoStrip` used by T5 pages, T15 adds optional `onSubmitted`; `pickText` | OK (existing callers pass nothing) |
| T5-T16 | `library-write.ts`: T16 `saveAnchors` uses non-exported `replaceAnchors` and exported `anchorRecord`, `audit` in the same file; `I18nPair` in `AnchorSheet` | OK; `audit`/`anchorRecord` not in T5 Interfaces (C15) |
| T5-T17 | `library-write.ts`: T17 appends `findOrCreateCompetency` (uses `createCompetency`, `hasText`, `isNull`), `removeCompetencyIfUnused` | CONFLICT C1 |
| T5-T19 | `pickText` | OK |
| T5-T20 | `UndoStrip`, `PageTitle` via `OpeningHeader` | OK |
| T6-T7 | `library/actions.ts`, `library.*.json` | OK |
| T6-T11 | `createPosition(orgId, actorId, {name, jobDescription?, team?}, x?)` -> `createOpening` (tx); `savePosition` in script | OK |
| T6-T13 | positions rows -> `positionOptions`; position page `positionAction` link `?position=` -> `NewOpeningPage` `initialPositionId` | OK |
| T6-T14 | `registry.ts` (`buildNav(locale, shared, manifests?)`, Library group; T14 adds hiring first + `inviteTargets`), `registry.test.ts`, `legacy-routes.test.ts` (`if (m.inviteHref)` already tolerates T14's `string \| null`) | OK |
| T6-T17 | `library-write.ts` `positions` import added by T6 -> `setPositionJobAdIfEmpty` | OK |
| T7-T17 | `parseModelJson`, `withoutEmDash`, `buildRepairMessages` -> draft.ts / draft-job.ts | OK; repair block duplicated C13 |
| T7-T18 | `parseModelJson`, `withoutEmDash` -> question-check.ts | OK |
| T8-T9 | `hiring_version_status`, `version_id`/`stage_id`/`activity_id`, `one_draft_per_opening`, `hiring_published_has_scorecard` -> trigger functions and T9 script | OK; but `published_by ... onDelete: set null` + frozen-row trigger: C10 |
| T8-T10 | `AnswerExamples`, `HiringActivityConfig`, `ScorecardSnapshot`, `hiringActivityType.enumValues` -> content/scorecard rules, `content.test` | OK (enum order = `ACTIVITY_TYPES`) |
| T8-T11 | `weightsEnabled`, `draftWeights`, `previewedAt`, `localeSet`, stage/activity columns -> loaders and writers | OK |
| T8-T12 | `hiringWeightSets.reason/createdBy/isActive`, `one_active_weight_set`, `hiringWeights.percentage` numeric -> `publishDraft`, `addWeightSet` (`toFixed(2)`) | OK |
| T8-T14 | hiring tables -> `hiringLibraryUsage` joins | OK |
| T8-T16 | `hiringVersions.scorecard` -> `loadScorecard` | OK |
| T8-T17 | `ai_purpose` `HIRING_DRAFT` -> `generateHiringDraft` | OK |
| T8-T18 | `ai_purpose` `QUESTION_CHECK` -> `runQuestionCheck` | OK |
| T8-T19 | `previewed_at` -> `markPreviewed` | OK |
| T8-T20 | CHECKs `min_evaluations 1-5`, `feedback_days 1-60` -> `openingRulesProblems` uses the same ranges | OK |
| T9-T11 | triggers vs draft-only writes (`draftOf`, `cloneContent` into a new DRAFT); `package.json` | OK |
| T9-T12 | publish = one UPDATE DRAFT->PUBLISHED; script expects raw `23514` on a published stage | OK |
| T9-T16 | `saveDraftWeights` updates only the draft row; weight sets unguarded | OK |
| T9-T17 | `removeCompetencyIfUnused` relies on FK `23503` (RESTRICT) | Technically OK; behaviour conflicts with spec, C1 |
| T9-T19 | `markPreviewed` filters `status = 'DRAFT'` | OK |
| T9-T20 | `hiring_openings` is not guarded -> `saveOpeningRules`, `setOpeningClosed` | OK |
| T9-T21 | `verify:hiring-immutability` in the final check | OK |
| T10-T11 | `ContentStage/Activity`, `VersionContent`, `usedCompetencyIds`, `workingVersions`, `weightsProblem`, `test-fixtures` (used by `patches.test`) | OK |
| T10-T12 | `publishProblems`, `buildScorecard`, `workingVersions` | OK |
| T10-T13 | `STRUCTURE_PROBLEMS`, `ANCHOR_PROBLEMS`, `PublishProblem`, `openingAccess`, `VersionSummary` | OK; `WEIGHTS_NOT_100` sits under the anchors row, C12 |
| T10-T15 | `ACTIVITY_TYPES`, `isChoice`, `isRecorded`, `MAX_COMPETENCIES_PER_ACTIVITY`, `totalSeconds`; ESLint ignores `src/app/**/hiring/**`, `src/components/hiring/**` | OK |
| T10-T16 | `weightsTotal`, `defaultWeights`, `usedCompetencyIds`, `isChoice` | OK |
| T10-T17 | boundary test `HIRING_CODE` covers `src/solutions/hiring/ai` (imports only `@/lib/ai*`) | OK |
| T10-T18 | same boundary coverage | OK |
| T10-T19 | `toCandidateVersion`, `CandidateVersion`, `CandidateActivity` | OK |
| T10-T20 | `canDecide` -> `openingRulesProblems`, settings form | OK |
| T11-T12 | `verify-hiring-setup.ts` marker `// TASK 12: publishing checks go here.` (exact), versions/content/errors | OK (flow traced: 75/25, 23514, NO_DRAFT, "2P,1P") |
| T11-T13 | `openings.ts` (T13 appends `positionOptions`, adds `sql`, `positionCompetencies`), `versionsOf`, loaders -> `workingState`; `createOpening.next` URLs | OK |
| T11-T15 | all draft functions, `stagePayloadSchema`/`activityPayloadSchema`, `HiringConflict.code`/`HiringNotFound.code` -> edit actions | OK |
| T11-T16 | `content.ts` (T16 appends `loadScorecard`), `saveDraftWeights`, `latestWeights`, `positionProfile` | OK |
| T11-T17 | `insertStage`, `deleteStage`, `ensureDraftVersion`, `positionProfile`, `emptyActivity`, `stagePayloadSchema` | CONFLICT C5 (`ensureDraftVersion` called implicitly) |
| T11-T19 | `versions.ts` (T19 appends `markPreviewed`, existing imports suffice) | OK |
| T11-T20 | `openings.ts` (T20 appends; adds `loadPanelUsers`, `HiringNotFound`, opening-rules imports) | OK; import merge C16; hard-coded zone C6 |
| T11-T21 | `verify:hiring-setup` in the final check | OK |
| T12-T13 | `publishDraft` -> `publishOpeningAction` (`result.number`) | OK |
| T12-T16 | `weight-sets.ts` (T16 appends `liveWeights` importing `latestWeights` from `./versions`, no cycle), `addWeightSet` | OK |
| T13-T14 | `/hiring/openings/page.tsx` exists before T14 adds the nav entry checked by `legacy-routes.test` | OK |
| T13-T15 | `openingFor`, `OpeningHeader`, `AssessmentTabs`, `describeProblem`, `publishOpeningAction` (`openingId`, `back`), `workingState`, `hiring.*.json` | OK; tabs to routes not yet built C7 |
| T13-T16 | same helpers, json | OK |
| T13-T17 | `createOpening` AI path -> `/assessment/ai` (404 until T17); json | C7 |
| T13-T18 | `hiringGate.activityLabel` reused for check labels; json | OK |
| T13-T19 | readiness row reads `draft.previewedAt` written by T19; json | OK |
| T13-T20 | settings tab; `openings.ts`; readiness "Ekip atandı" reads `memberIds` written by T20; json | OK; C7 until T20 |
| T15-T16 | json; `AssessmentTabs` scorecard tab | OK |
| T15-T17 | builder empty state links `/assessment/ai`; json | C7 (transient) |
| T15-T18 | `edit/page.tsx` (T18 adds `key` + `checkSlot`), `Builder.checkSlot`, `src/components/hiring/builder` | OK |
| T15-T19 | builder "Önizle" links `/assessment/preview`; json | C7 (transient) |
| T15-T20 | `UndoStrip.onSubmitted` (T20 passes nothing); json | OK |
| T16-T17 | `library-write.ts` (distinct appended functions); json | OK |
| T16-T18 | `hiring.*.json` (distinct namespaces) | OK |
| T16-T19 | json | OK |
| T16-T20 | json | OK |
| T17-T18 | `src/solutions/hiring/ai/` folder (T17 adds the dir; T18 adds files by name); json | OK |
| T17-T19 | json | OK |
| T17-T20 | json | OK |
| T18-T19 | json | OK |
| T18-T20 | json | OK |
| T19-T20 | json | OK |
| T21-all | `docs/STATUS.md` sections "Çalıştırma", "Doğrulananlar", "Hâlâ doğrulanmadı" item 7, "Kararlar ve sapmalar" all exist at ae00611; em-dash scan range `992962d..HEAD` currently = only the plan file (0 em-dash) | OK |

### 2. Per task: self-consistency and assumptions about current code

| Task | Own text consistent? (tests vs code, files vs git add, migration no., i18n) | Assumptions about current code |
|---|---|---|
| 1 | Yes. Tests drive the code; git add = 9 files = Files list. | True: `solutionModule` at candidate-api.ts lines 131/176/181, the quoted doc strings, rights page `solutionModule(...)`, guard line 74 label, rights test `it.each` title, registry.test import line all exist verbatim. Old test titles renamed (C11). |
| 2 | Yes. 0004 follows journal idx 3; regexes match drizzle's output format seen in 0001/0003 (`ADD VALUE '...';`, `WHERE <expr>` partial index, inline `CONSTRAINT ... CHECK`). git add uses the `drizzle/migrations` dir (C3). | True: hand-written `AiPurpose` union in ai-runs.ts, `organizations` in ./org, `I18nText` in ./types, `aiRuns` value import stays. |
| 3 | Yes. 24 anchors pass the simulated `anchorHint`; 8x7 = 56 tags. git add = Files. | True: `src/db/seed.ts` has `log` (line 40) and the `consentTexts` insert (line 153); `dotenv` dependency; tsx resolves `@/` (existing scripts do). Step 10 targets the shared DB URL (C2); counts assume one org (C17); no verify:exam (C22). |
| 4 | Yes. Expected-failure reasoning correct (vitest does not type-check). | True: `Capability` union and `BY_ROLE` shape, `user()` helper in authorize.test.ts, `I18nText` exported from `@/db/schema`. |
| 5 | Yes. 65 keys used, all present; TR/EN equal; new em-dash test passes on today's dictionaries. git add uses dirs (C3). Test title rename (C11). | True: `Button` `disabledReason` + `DisabledReason`, variants primary/secondary/ghost, `StatusDot` tones `warn`/`done`, `Empty*`, `Collapsible`, `UndoStrip({message, action, hiddenFields})`, tokens `p-card`, `space-y-field`, `mt-section`, `px-page`, `text-destructive`, `text-ink-2`, `decoration-underline`, `requireUser(capability?)`, `isUuid`, `useMT`, `managerLocale`, `audit_logs` columns. |
| 6 | Yes. Layout edit keeps the strings `shell-labels.test.ts` reads; libPositions 49/49. git add uses dirs (C3). | True: `buildNav` current signature, layout call `buildNav(locale, { today, settings })`, legacy-routes `describe("menu")` block, `/settings/page.tsx` and `/dashboard/page.tsx` exist. |
| 7 | Yes (10 required keys; em-dash -> ", "). | True: `getAiProvider().available`, `callJson(schemaName, schema, messages, meta)`, `recordAiRun` needs `model` (given), `AiMessage` roles incl. `assistant`, `Skeleton`. AnchorAssist overwrite of 2/4 (C19). |
| 8 | Yes. 0005; six CREATE TYPE, two ADD VALUE appended (no BEFORE/AFTER). | True: `locale` pgEnum, `consentTexts` export. `published_by` set-null vs T9 trigger (C10); extra columns (C26). |
| 9 | Yes. 3 x `TG_OP <> 'INSERT'`/`'DELETE'`; one `;` per chunk; `--custom` makes 0006 + snapshot. | True: `scripts/schema-fingerprint.ts` reads columns, constraints, indexes, types only, so triggers do not break `IDENTICAL`. |
| 10 | Yes. All gate/weights/scorecard/candidate-view/access/versions expectations traced by hand against the code. | True: `boundary.test.ts` has `EXEMPT`, `EXAM_IMPORT`, `files()`; ESLint `ignores` array is where the plan says. |
| 11 | Yes. Script traced (undo at index 0, copy from draft, NOT_FOUND across openings). git add uses `src/solutions/hiring/server` dir (C3). Interfaces says it consumes `ensureDefaultScale` (unused, C15). | True: `users.passwordHash` required (given), `@/db` built with `{ schema }` so `Executor` default works, `isUuid` in `@/server/settings`. Hard-coded Istanbul month (C6). |
| 12 | Yes. git add = Files. | True for everything it consumes (Tasks 10-11). |
| 13 | Yes. 5 namespaces equal; keys used present. | True: `shortDate(date, locale)` exists in `@/lib/format` (the fallback note is unnecessary), `ForbiddenError(capability)`. Dead links until T15-T20 (C7); TONE duplicated (C13). |
| 14 | Yes. Only readers of `inviteHref` are dashboard, legacy-routes.test, registry.test (grep), all handled. | True: dashboard `const inviteHref = modules[0]?.inviteHref ?? "/dashboard";` verbatim; nav active uses `startsWith`. Duplicate doc comment (C14). |
| 15 | Yes. hiringBuilder 84/84. git add uses dirs (C3). | True: `SelectTrigger size="sm"`, `clockTime` returns `HH:MM:SS` (slice 0,5 ok), lucide `AlignLeft, CircleDot, ListChecks, Mic, Paperclip, Type, Video` exist in 1.42.0, `undo-strip.tsx` is Kademe-owned, tokens `bg-vault*`, `shadow-panel-soft`. `/assessment` redirect (C4). |
| 16 | Yes. hiringScorecard 38/38. | True: `Sheet*` exports, `side="right"`. Two filled buttons while the Sheet is open (C21). |
| 17 | Yes. draft.test traced (4 stages, keys filtered, quotes, payload validates). hiringAi 33/33. Interfaces lists `defaultsFor` (unused, C15). | True for consumed helpers. Spec conflicts C1, C5, C9. |
| 18 | Yes. Rule-word cases traced; hiringCheck 14/14. | True: `Popover`. Key collision (C20). |
| 19 | Yes. hiringPreview 26/26. | True: `candidateSafe<T>` exists in `@/lib/candidate-safe`; `bg-paper`, `p-card-candidate`, `bg-panel`, `Button size="xs"`. Disabled "Dosya seç" without adjacent reason (C8). |
| 20 | Yes. `deadlineToDate("2026-10-31")` = `20:59:59Z`; hiringSettings 42/42. | True: `loadPanelUsers` returns `name`, `role`, `disabledAt`. False/unverified: `ogretmen@kademe.local` existing in `kademe_platform` (C17). Hard-coded zone (C6); import merge (C16). |
| 21 | Yes. | True: STATUS sections and item 7 exist. `git status --short` "must be empty" can fail with parallel sessions (C17). |

### 3. Defects a reviewer would flag (from the defect list)

- Test that asserts nothing: none found (scripted).
- Verbatim duplication: `TONE` map in T13 `opening-header.tsx` and `openings/page.tsx`; Istanbul day formatter in T20 page (`day`) and `saveOpeningRules` (`today`); archive/restore action pairs (T5, T6); disabled-add-button block (T5, T6, T13); call + parse + repair + `recordAiRun` block (T7 `anchor-draft-job.ts`, T17 `draft-job.ts`); identical `layout.tsx` in library and hiring (C13).
- Missing TR or EN string: none (scripted).
- Em-dash in user-facing text: none (0 in the plan).
- Step aimed at the shared `kademe` DB: T3 Step 10 `DATABASE_URL=.../5434/kademe pnpm db:seed-library` (C2). No step touches production.
- git checkout/stash/reset/switch: none. `git add -A`: none; directory-level `git add` in T2, T5, T6, T8, T9, T10, T11, T13, T15, T16, T17, T19, T20 (C3).

### 4. Conflicts and proposed resolutions (spec is the authority)

| Id | Severity | Conflict | Proposed resolution |
|---|---|---|---|
| C1 | blocking | T17 `removeCompetencyIfUnused` hard-DELETEs a library competency on "Geri al"; hiring spec 1 "Silme yok, arşiv var", HIRING-UX 4.2 rule 3 and T2's own schema doc forbid deletion. | Undo of an accepted AI competency that this acceptance created calls `setCompetencyArchived(..., true)`; drop the DELETE and the 23503 branch; keep `undoBlocked` only for "already used, kept active". |
| C2 | should-rule | T3 Step 10 runs `db:seed-library` with `DATABASE_URL` pointing at the shared `kademe` DB, relying on the script's own guard; contradicts Global "No command in this plan connects to them". | Extract the URL guard into a pure `refuseUnlessWorkingDb(url)` with a unit test covering host, port and `/kademe`; delete the live command against `kademe`. |
| C3 | should-rule | Directory-level `git add` (`drizzle/migrations`, `src/app/(manager)/library`, `src/components/library`, `src/solutions/hiring/rules`, `.../server`, `.../ai`, `src/components/hiring/*`, route dirs) vs Global "git add only the files the task names"; several sessions share this repo. | Replace each dir with the exact files the task creates or modifies (migrations: the `.sql`, the `NNNN_snapshot.json`, `_journal.json`). |
| C4 | should-rule | HIRING-UX 4.3: `/hiring/openings/[id]/assessment` is "özet + sürüm geçmişi"; T15 makes it a redirect to `/edit`. | Build a minimal summary + version list page from `versionsOf()` (data already exists), or rule an explicit deferral recorded in STATUS. |
| C5 | should-rule | T17 `acceptStageAction` calls `ensureDraftVersion`, so accepting an AI card on a live opening silently opens v(n+1); ruling/decision 8 says editing a published version is explicit ("Düzenlemeye başla"). | When there is no draft, the AI screen shows the live note + "Düzenlemeye başla" (reuse `startDraftAction`) and `acceptStageAction` answers `NO_DRAFT` instead of creating one. |
| C6 | should-rule | T11 `monthName` and T20 (`deadlineToDate` "+03:00", `today`, `day`) hard-code `Europe/Istanbul`, while `@/lib/org-timezone` exports the env-configurable `ORG_TIMEZONE` and `zonedDayStart`. | Use `ORG_TIMEZONE` for formatting and a `zonedDayStart`-based end-of-day for the deadline; keep the test by asserting against the default zone. |
| C7 | should-rule | T13-T19 commit route tabs and links to pages built only later (`/assessment/edit` T15, `/ai` T17, `/scorecard` T16, `/preview` T19, `/settings` T20; builder links to `/ai`, `/preview`); RULES 7 and decision 14 say no links to pages that do not exist. | Each task adds its own tab/link when it adds the route (OpeningHeader/AssessmentTabs items and readiness links appended per task); T13 AI start stays but its 404 is listed in the task report. |
| C8 | should-rule | T19 disabled "Dosya seç" has `disabledReason` but no adjacent `<DisabledReason>`; RULES 5 requires the reason next to the button. | Render `<DisabledReason>` next to it (text: `hiringPreview.strip` or a dedicated key). |
| C9 | should-rule | HIRING-UX 5.6: the manager edits each card's competencies and 1/3/5 examples on the card; T17 edit mode edits only the TR prompt. | Extend edit mode to examples (and competency chips), or rule it deferred to the builder and note it in STATUS. |
| C10 | should-rule | T8 `hiring_versions.published_by ... onDelete: "set null"` plus T9 trigger: deleting a user who published becomes an UPDATE on a frozen row and is refused (same for org cascade, which the plan accepts). | Use `onDelete: "restrict"` (users are disabled, never deleted) or exempt FK-driven null-outs in the trigger; decide before 0005 is generated. |
| C11 | cosmetic | Test titles disappear without a whole-file rewrite (T1 rights `it.each`, T5 "collide across the three files", T6 menu test) vs Global gates text. | Allow explicit renames; each task report lists old -> new title. |
| C12 | cosmetic | Decision 7 says "spec 2.2 + three obvious rules"; the gate also has `CHOICE_NEEDS_OPTIONS`, `CHOICE_WITH_COMPETENCY`, `TOO_MANY_COMPETENCIES`, `COMPETENCY_MISSING`, `WEIGHTS_NOT_100`; `WEIGHTS_NOT_100` is shown under the "çapa" readiness row. | Update decision 7 wording; move `WEIGHTS_NOT_100` out of `ANCHOR_PROBLEMS` into its own readiness detail (or rename the row to cover the scorecard). |
| C13 | cosmetic | Verbatim/near-verbatim duplicated blocks listed in section 3. | Export `TONE` from `opening-header.tsx`; one `orgDay()` helper (with C6); optional `runWithRepair()` for AI jobs; leave the small page blocks. |
| C14 | cosmetic | T14 replaces `inviteHref: string;` with a new doc comment + line, leaving the old doc comment above it (two comments). | Replace the existing comment line together with the field. |
| C15 | cosmetic | Interfaces drift: T3 omits `ANCHOR_LEVELS`; T5 omits `audit`, `anchorRecord` (used by T6, T16, T17); T11 lists `ensureDefaultScale` and T17 lists `defaultsFor` as consumed but neither uses them. | Fix the Interfaces lines. |
| C16 | cosmetic | T20 says import `loadPanelUsers` from `@/server/settings` while `openings.ts` already imports `isUuid` from it. | Merge into the existing import. |
| C17 | cosmetic | Unverified environment assumptions: T3 expected counts assume one organisation in `kademe_platform`; T20 assumes `ogretmen@kademe.local` exists there; T21 needs an empty `git status` in a repo shared by parallel sessions. | Derive expected counts from `select count(*) from organizations`; create the MANAGER user if absent; T21 checks only paths this plan touched. |
| C18 | cosmetic | HIRING-UX details not built and not in the rulings: 5.5 empty draft has 2 starts (no "Kopyala"), 5.5 Breadcrumb; 5.6 failure copy without "<neden>"; 5.9 job ad collapsed to 500 chars; 5.10 "1 ile 3 arası" label and good/bad hints; 5.18 reviewers as multi Combobox and "bitiş anketi" switch (no column in spec 2.1); 5.7 `Progress`. | Record as accepted deviations in STATUS "Kararlar ve sapmalar" (T21), fix the cheap ones in their tasks if the controller prefers. |
| C19 | cosmetic | T7 `onApply` spreads all five AI levels, so empty 2/4 overwrite text the person wrote. | Merge only levels where `hasText` is true. |
| C20 | cosmetic | T18 React key `${activityId}:${kind}` collides when the AI returns two findings of the same kind on one question. | Add the index or excerpt to the key. |
| C21 | cosmetic | T16: page "Puan kartını kaydet" (filled) and Sheet "Çapaları kaydet" (filled) are visible together. | Accept (modal layer) or make the page button secondary while the Sheet is open. |
| C22 | cosmetic | Global: verify:exam after every task that changes `kademe_platform`, but T3 (seeds it) and the browser-check tasks write to it without verify:exam. | Add verify:exam to T3 Step 11; browser-check writes are data, not schema, so leave the rest. |
| C23 | cosmetic | T3 seed comment "A new organisation never meets an empty library" vs T5's designed empty state (orgs not created by `db:seed` start empty). | Keep the empty state; reword the comment. |
| C24 | cosmetic | T2/T8/T9 fingerprint files go to `/tmp`; the user's rules prefer the session scratchpad. | Use the scratchpad path in the commands. |
| C25 | cosmetic | Hiring spec 2.2 names the server gate `publishVersion`; the plan uses `publishDraft`. | Keep `publishDraft`, mention the mapping in STATUS. |
| C26 | cosmetic | Columns not in hiring spec 2.1-2.3 and not in the decision list: `hiring_versions.org_id`, `previewed_at`, `created_at`, `updated_at`; `hiring_openings.created_at/updated_at`; `hiring_weight_sets.created_by`. | Accept; add one line to STATUS decisions. |

Counts: blocking 1 (C1), should-rule 9 (C2-C10), cosmetic 16 (C11-C26). Already-ruled items (dnd vs up/down, proctoring out, assignment model, one scale, AI proposals not stored, publish not undoable) were not counted.

## Rulings on the pre-flight scan (controller, binding; implementers apply these over the plan text)
- Ruling C1 (blocking): Task 17 undo of an accepted AI competency ARCHIVES it (setCompetencyArchived), never DELETE; drop the 23503 branch - why: spec 1 / HIRING-UX 4.2 rule 3 "no delete, archive" - cost if wrong: none.
- Ruling C5: Task 17 acceptStageAction must not call ensureDraftVersion on a live opening; return NO_DRAFT and show the live note + "Düzenlemeye başla" on the AI screen - why: editing a published version is explicit - cost if wrong: one extra click.
- Ruling C3: every task commits exact file paths (migrations: the .sql, its snapshot, _journal.json), never whole directories - why: shared repo, plan rule.
- Ruling C10: hiring_versions.published_by (and any FK to users on frozen rows) is ON DELETE RESTRICT; users are disabled, never deleted - why: the frozen-row trigger would refuse a SET NULL anyway - cost if wrong: deleting a user who published needs a manual step.
- Ruling C7: a tab or link is added in the same task that adds its route (RULES 7) - why: no link to a page that does not exist.
- Ruling C2: Task 3 replaces the command aimed at the shared `kademe` DB with a unit test of the URL check - why: never point commands at the shared DB.
- Ruling C4: Task 15 builds a minimal `/assessment` summary + version history page (HIRING-UX 4.3) instead of a redirect - cost if wrong: a small extra page.
- Ruling C6: Tasks 11 and 20 use ORG_TIMEZONE / zonedDayStart, no hard-coded Europe/Istanbul or +03:00.
- Ruling C8: Task 19's disabled "Dosya seç" gets a visible DisabledReason (RULES 5).
- Ruling C9: Task 17's AI card lets the manager edit the measured competencies and the 1/3/5 answer examples as well as the prompt (HIRING-UX 5.6).
- Ruling C11-C26 (cosmetic): apply the scanner's proposed resolution as written in the table above.
BASE T1: ae00611
Task 1: complete (commits ae00611..dc25922, review clean). Controller: vitest 655/655; 6 old cases renamed, reviewer confirmed same inputs and assertions.
Task 1: minor (deferred): candidate-api test stub re-implements registered&&live; registry test lacks candidateSolution("HIRING") default assertion; withSolution double check (by design).
- Carry: tests that inspect vi.fn mock.calls need a typed vi.fn<Signature> (tsc TS2493 otherwise).
BASE T2: dc25922
Task 2: complete (commits dc25922..27005ee, review clean). Controller: 7 library tables on kademe_platform, kademe untouched, vitest 665/665 none missing.
Task 2: minor (deferred): migration test does not pin the unique indexes, weight/expected_level CHECKs and the two RESTRICT FKs; anchor/scale value range not in DB (app layer, 5-level scale only).
- Carry to Tasks 4, 11, 12, 15, 16 (any write that links library rows): FKs are single-column, so every write must check that linked competency/scale/position rows belong to the same org (tenancy in the query, with a test).
BASE T3: 27005ee
Task 3: complete (commits 27005ee..385c1a2, review clean). Controller: kademe_platform 8/24/56/5/1, reviewed_at null on all, kademe untouched, vitest 688/688 none missing.
Task 3: minor (deferred): working-db guard refuses only /kademe (could allowlist /kademe_platform); anchor trait words exact-match (Turkish inflections slip); seed copy nits (şikâyeti/Şikayeti, one tag tense); data test lacks non-empty name/description assertion.
BASE T4: 385c1a2
Task 4: complete (commits 385c1a2..02ed5cf, review clean). Controller: branch ok, reflog shows no checkout, vitest 697/697 none missing.
Task 4: minor (deferred): LibraryUsageEntry.live doc should say "open openings whose published version uses the row"; libraryUsage Promise.all (allSettled when a second hook exists).
- Carry to Task 13: new-opening position picker must exclude archived positions (no activePositions selector exists yet).
BASE T5: 02ed5cf
Task 5: implementer DONE 60b7d36. Controller: vitest 710/710; one title renamed ('three files' -> 'files', now 4 dictionaries) not mentioned by the implementer (C11 minor); library data restored (8/24/56, reviewed 0, archived 0); screenshots list and detail viewed (anchor hint shows).
Correction: the implementer DID list the test rename under "Test titles (C11)"; my "not mentioned" note above was wrong.
Task 5 review (opus): Needs fixes. Important 1: CompetencyForm keeps stale state after router.refresh (no key), so a second save archives and re-inserts newly added tags under new ids (breaks stable tag ids). Important 2: saveCompetency lock lacks archivedAt IS NULL; archived rows editable via the server. Minors: scale save accepts duplicates/partial/empty and audits no-ops; startLibraryAction seeds without audit; markReviewed audit even if no-op; 2000-char name/tag bounds; ensureDefaultScale ignores the caller tx; no tests for action capability checks; UndoStrip reappears on reload with ?archived=1.
- Ruling: fix round 1 = both Important + scale save validation (exact level set, no duplicates, no empty, no audit on no-op) + audit row for library seeding + markReviewed audited only when applied + tighter bounds for names (<=120) and tag labels (<=80) + tests for the capability checks of the library actions. Parked: ensureDefaultScale tx, UndoStrip ?archived=1 reload.
Task 5: fix round 1/5 (2 Important + 5 minors addressed, 0 open; commits 60b7d36..0a1fee7). Controller: vitest 722/722 none missing; library data intact.
Task 5: complete (commits 02ed5cf..0a1fee7, review clean after 1 fix round)
Task 5: minor (deferred): library.seed audit written after the seed commits (not same tx); scale save reads levels outside the write tx (extra audit row under a race); tag inputs lose focus after save; markReviewed checkbox not reset; ensureDefaultScale ignores caller tx; UndoStrip reappears with ?archived=1; HIRING-UX 5.10 parts not built ("1 ile 3 arası" label, example hints, "Skala ekle") -> STATUS in Task 21.
BASE T6: 0a1fee7
Task 6: complete (commits 0a1fee7..48f783b, review clean). Controller: vitest 742/742 (1 rename listed); competencies unchanged; 1 archived test position left (c906fc81). Reviewer confirmed the Task 4 listPositions count bug and its fix on real data.
Task 6: minor (deferred): competency read not FOR SHARE when linking; PositionForm has no key across archive/restore; competency archive test does not pin the state filter; 5.9 job-ad collapse not built (STATUS Task 21).
- Carry to Task 11: library-write.ts:251 languages must use POSITION_LANGUAGES_MAX (10), not the skills cap; createPosition default path (x = db) should run insert + audit in one transaction.
BASE T7: 48f783b
Task 7: implementer DONE b9fd87b (one live Gemini call; 2 ai_runs rows: a logged 503 retry + success).
- Ruling (ai_runs): a row is written only for an actual model call (a retry or repair that calls the model is a real call and gets a row); a validation failure without a call updates the existing run's error/status, no new row - why: ai_runs is the record of model calls.
- Ruling (apply): "Önerileri alanlara yaz" fills only EMPTY level fields; for a level that already has text the proposal is shown next to it with a per-level "Bununla değiştir" button - why: typed text must never be overwritten silently (C19 extended to non-empty proposals) - cost if wrong: one extra click per level.
Task 7 review (opus): Needs fixes. Important 1: ruling (a) violated (anchor-draft-job.ts:25 inserts a row without a call; first invalid answer not recorded on its run). Important 2: ruling (b) violated (mergeAnchorProposal overwrites typed levels; no per-level "Bununla değiştir"; card hides after apply). Important 3: no cap on paid AI calls (exam bank generate has none either).
- Ruling: fix round 1 = (a) via markAiRunError(runId, error) in ai-runs.ts + a shared runWithRepair() helper (Task 17 reuses it); (b) fill only empty levels, keep the card for skipped levels with per-level replace (TR "Bununla değiştir" / EN "Replace with this"); DB-backed AI rate limit helper (per user per purpose 10 / 10 min, per org 200 / day, RATE_LIMITED status with TR/EN copy, test) used by draftAnchorsAction; trim stray ", " in withoutEmDash. Parked: exam bank generate rate limit (follow-up, outside hiring plan 1); prompt still asks to fill 2/4 (ok under ruling b).
- Ruling: org AI cap counted per purpose (exam grading cannot lock out hiring); rolling 24 h window accepted.
Task 7: fix round 1/5 (3 Important + 1 minor addressed, 0 open; commits b9fd87b..e47b808). Controller: vitest 774/774; 3 old titles replaced by tests of the new behaviour (listed).
Task 7: complete (commits 48f783b..e47b808, review clean after 1 fix round)
Task 7: minor (deferred): markAiRunError scoped by id only (runId never user input); limiter check-then-insert race can exceed the soft cap by a burst; no server-only marker on ai-repair/ai-limit; exam bank generate uncapped (follow-up).
- Carry to Tasks 17 and 18: every new AI action calls aiLimitReached before any call (purpose HIRING_DRAFT / QUESTION_CHECK) and uses runWithRepair + markAiRunError; no ai_runs row without a model call.
BASE T8: e47b808
Task 8: complete (commits e47b808..e437c16, review clean). Controller: 6 migrations, 8 hiring tables, published_by RESTRICT, kademe untouched, vitest 793/793 none missing.
Task 8: minor -> ruled into Task 9 (cheap while tables are empty).
- Ruling (Task 9 addition): after the planned trigger migration 0006, Task 9 generates a schema-guard migration 0007: (1) explicit short FK name for hiring_activity_competencies.activity_id (default name is 64 chars, truncated to 63 by Postgres); (2) unique index hiring_openings(id, org_id) + composite FK hiring_versions(opening_id, org_id) -> hiring_openings(id, org_id); (3) CHECKs: grace_seconds >= 0, answer_seconds IS NULL OR > 0, order_index >= 0 on stages and activities, version_number >= 1, status = 'PUBLISHED' implies published_at and published_by NOT NULL, default_locale = ANY(locale_set) (or equivalent for the jsonb/array type); pinned in migrations-sql tests; fingerprint IDENTICAL; applied to kademe_platform only. Order matters: 0007 runs after the trigger exists, tables are empty so no frozen-row conflicts.
- Carry to plan 3: ScorecardSnapshot.weightsEnabled is history only after publish; weight sets are authoritative.
- Carry to plan 2: UX 5.18 finish-survey switch has no column yet.
Task 8: minor (deferred): report C26 list omitted weights_enabled/draft_weights (from the brief); published_has_scorecard expression and parent-chain cascades not pinned by tests; stage/activity order not unique (server renumbers).
BASE T9: e437c16
Task 9: implementer DONE 0bbe616 (0006 triggers) + 188869b (0007 guards).
- Carry (all migration tasks): `drizzle-kit push` can exit 0 after an SQL error (42830 seen); always grep the push log for "error" in addition to the fingerprint diff.
- Carry to Tasks 11, 12 (publishDraft): set published_at and published_by together; keep default_locale inside locale_set (0007 CHECKs).
Task 9 review (opus): Needs fixes. Important: child-trigger parent-status lookups take no lock; a concurrent child insert/delete and a publish (FOR NO KEY UPDATE vs FOR KEY SHARE do not conflict) can change a version after it is published (READ COMMITTED). Minors: refusals share 23514 without a constraint name; locale_set not constrained to a jsonb array; bypass via TRUNCATE / DISABLE TRIGGER / replica role (local app role is superuser + owner); script coverage gaps.
- Ruling: fix round 1 = new migration 0008 (do not edit 0006): CREATE OR REPLACE the three child functions with FOR SHARE / FOR SHARE OF v on the six parent lookups, and RAISE ... USING ERRCODE '23514', CONSTRAINT = 'hiring_version_frozen' in all trigger functions (version function too); add CHECK jsonb_typeof(locale_set) = 'array'; tests pin both; extend the behaviour script with the three uncovered cases (opening delete cascading through a draft with stages; opening delete refused when it has a published version; moving a draft mapping into a published activity) and assert the constraint name on refusals. A concurrency test is optional (two connections) if it can be made deterministic.
- Carry to Tasks 11 and 12 (BINDING): publishVersion/publishDraft must SELECT the version FOR UPDATE (by id AND org_id) before reading any gate input; app maps SQLSTATE 23514 + constraint 'hiring_version_frozen' to a user-facing "published, start editing a new version" error.
- Carry (ROLLOUT): the production DB role must be neither superuser nor owner of hiring tables (triggers protect against app bugs, not privileged actors); verify on the VM/Neon.
Task 9: fix round 1/5 (1 Important + 3 minor addressed, 0 open; commit 0ca4cc6, migrations 0008 locks + 0009 locale_set array). Controller: vitest 821/821 none missing; 10 migrations; 6 FOR SHARE clauses; own race run on a throw-away kademe_race_check (0000-0009): 43 ok, 0 FAIL, 3 race lines ok, DB dropped.
Task 9: complete (commits e437c16..0ca4cc6, review clean after 1 fix round)
- Ruling (residual race, Minor): FOR SHARE OF v leaves stage/activity rows unlocked, so moving a stage/activity across versions could slip into a published version. Ruled by app contract instead of a migration: the app never changes version_id / stage_id / activity_id of an existing child row (copy, never move) - why: one draft per opening, versions are copied - cost if wrong: a later "move" feature needs FOR SHARE OF s, v / a, s, v.
- Carry to Tasks 11, 12 (BINDING, adds to the earlier carry): publishDraft runs at READ COMMITTED (no REPEATABLE READ/SERIALIZABLE), first statement SELECT ... FROM hiring_versions WHERE id AND org_id FOR UPDATE, then gate reads, snapshot, update; never update a child row's parent id.
- Carry (ROLLOUT): a non-owner production role editing hiring children needs UPDATE privilege on hiring_versions (FOR SHARE requires it).
BASE T10: 0ca4cc6
Task 10: implementer DONE 7cce0c3.
- Ruling (gate vs DB ranges): the publish gate does not re-check stage duration / think time / max takes; Task 11 draft writes must validate those ranges against the DB CHECKs (with agreement tests) so a write never fails on a CHECK - why: PublishProblem codes are consumed by Tasks 13/15 - cost if wrong: a raw 23514 on save instead of a field message.
Task 10 review (opus): Needs fixes. Important: a measured competency missing from draftWeights is published at 0% (weights.ts:50, scorecard.ts:20/37); reachable on every re-edited live opening (v(n+1) inherits the newest weight set). Minors: C12 not applied; toPercentages float ties; candidate stage/choice literals not type-annotated; blank choice labels pass gate but reach candidate; openingAccess has no org input; boundary one-directional and @/components/hiring back door; scorecard order depends on loader; gate ignores locales; test quality (fixture mutation, config values, versions order).
- Ruling: fix round 1 = (1) weighting on: a used competency absent from weights -> WEIGHTS_NOT_100 (or a new code WEIGHTS_MISSING if cleaner; then it joins WEIGHT_PROBLEMS), gate test "weights saved, competency added"; (2) C12: new exported WEIGHT_PROBLEMS group holding WEIGHTS_NOT_100 (+ any new weights code), test that the groups partition every PublishProblem code exactly once; Task 13 shows a separate "Ağırlıklar" readiness row; (3) exact integer largest remainder with ties to the earlier row (fix the doc), guard non-finite sum; (4) annotate CandidateStage and the choice element type; (5) choices without a label: gate refuses (new code or folded into CHOICE_NEEDS_OPTIONS by counting only labelled choices AND refusing any blank label) and candidate view drops them; duplicate choice ids refused by the gate; (6) openingAccess: keep signature, document the org-scoped-load precondition + test; CLOSED opening: view yes, edit no for everyone (doc + test) - why: a closed opening is history; (7) boundary: reverse ratchet (exam code may not import @/solutions/hiring or @/components/hiring), add @/components/hiring/* to the core no-restricted-imports group, ratchet also catches relative paths into exam libs; (8) sort inside the rules by (orderIndex, id) for stages, activities, competencies, tags, + "build twice from shuffled input, identical JSON" test; (10) test quality fixes. Parked: (9) gate locale completeness -> STATUS note + Task 11/13 carry (the editor shows missing translations; publish allowed).
- Carry to Task 13: describeProblem copy for WEIGHTS_MISSING (TR/EN) and a separate 'Ağırlıklar' readiness row using WEIGHT_PROBLEMS.
Task 10: fix round 1/5 (1 Important + 8 minor addressed, 0 open; commit f752474). Controller: vitest 873/873; 1 title replaced (declared, confirmed by re-review).
Task 10: complete (commits 0ca4cc6..f752474, review clean after 1 fix round)
- Carry to Tasks 11 and 13: always pass `status` to openingAccess (optional field fails open when omitted); Task 13 gate-message switch needs a WEIGHTS_MISSING case.
Task 10: minor (deferred): candidate-view.ts:32-35 indentation; reverse ratchet does not list @/app/.../hiring imports.
BASE T11: f752474
Task 11: implementer DONE 4228c45.
- Carry to Tasks 12, 13, 16, 17, 20 (BINDING): Task 11 signatures take orgId (loadVersionContent(orgId, versionId, x?), positionProfile(orgId, positionId, x?), versionsOf(orgId, openingId, x?), latestWeights(x, orgId, versionId), cloneContent(x, orgId, from, to)); adapt the plan code; call-site list in task-11-report.md. Task 12 publish write uses frozenAsConflict/isFrozenRefusal.
- Carry to Task 15: handle HiringInvalid (code INVALID with field paths) in edit actions -> field messages TR/EN.
Task 11 review (opus): Needs fixes. Important: delete -> undo does not round-trip (archived competency kept on a question fails assertCompetencies on insert; a stage with > 20 questions fails stagePayloadSchema), so undo loses content permanently. Minors: listOpenings positions join lacks org predicate; loaders lack isUuid guard (raw 22P02); COPY start ignores the source's locales/intro/proctor/practice; lockOpening does not refuse CLOSED; positionProfile order lacks id tiebreak; COPY from a source draft reads without locking the source; Task 12 lock order.
- Ruling: fix round 1 = Important (undo tolerates kept archived competencies of the same org; per-stage cap of 20 questions enforced in addActivity/insertActivity with a typed error; script/unit test: delete then undo with a kept archived competency and with a full stage) + Minors 1, 2, 3 (COPY inherits default_locale/locale_set validated by versionLocalesSchema, intro, proctorLevel, practiceEnabled; not weights) , 4 (lockOpening reads status; draft writes and ensureDraftVersion refuse a CLOSED opening with new ConflictCode "CLOSED"), 5, 6 (lock the source opening FOR SHARE before cloning).
- Carry to Task 12 (AMENDS the earlier publish carry): publishDraft locks the opening FOR UPDATE (id AND org_id) first, then the version FOR UPDATE, then gate reads, snapshot, update; same lock order as Task 11 draft writes, so no 40P01; READ COMMITTED.
- Carry to Task 15: map ConflictCode "CLOSED" and HiringInvalid to TR/EN messages.
- Carry to Task 15: undo calls insertStage/insertActivity with { restore: true } (lossless); map STAGE_FULL, CLOSED, INVALID to TR/EN. Task 17 AI accept uses strict inserts (no restore).
Task 11: fix round 1/5 (1 Important + 6 minor addressed, 0 open; commit 2548ea5). Controller: vitest 941/941 none missing; kademe_platform hiring empty; no *_check DB left.
Task 11: complete (commits f752474..2548ea5, review clean after 1 fix round)
- Carry to Task 15: undo payloads are re-validated on the server (or kept server-side), never trusted from the client; STAGE_FULL on undo shown as a typed message.
Task 11: minor (deferred): no dedicated test for positionProfile tiebreak; cloneContent/insertStage do not re-check the 20 cap (nothing can exceed it).
BASE T12: 2548ea5
Task 12: implementer DONE 8b44183.
- Ruling (weight set with weighting off): store the scorecard's effective percentages (profile defaults via toPercentages) - why: the set records the weights actually applied and always fits the 0-100 integer CHECK - cost if wrong: one recompute rule.
- Carry (ROLLOUT): publish reads competencies FOR SHARE, so a non-owner production role needs UPDATE privilege on competencies (and on hiring_versions, earlier carry).
Task 12: complete (commits 2548ea5..8b44183, review clean: Approved, 0 Critical/Important)
- Carry to Task 15 (BINDING): addWeightSet gains an expected versionId (the live version the form was loaded for); if a newer version was published meanwhile, refuse with a typed STALE code and TR/EN copy "a new version went live, reload"; weightsProblem/addWeightSet distinguish NOT_WHOLE (non-integer or out of 0-100) from NOT_100 so the message never contradicts the shown total.
- Carry to plan 3: an inactive (weighting-off) weight set's stored percentages are not applied (plain average); v1 weight sets are frozen once v2 is live (decide in plan 3 if per-version sets are needed).
- Final-fix-wave list: verify-hiring-setup "anchor text in v1 is unchanged" check is tautological (use saveCompetency before v2 publish, assert v2 shows new text and v1 old); extract tenancy.test.ts fake DB to test-fake-db.ts; publish doc comment "one state of the library" only holds for competencies.
Task 12: minor (deferred): missing default scale is a plain Error; same-day weight-set label collision; latestWeights createdAt tie.
BASE T13: 8b44183
- Ruling (Task 13, C7 applied): Task 13 adds only routes it builds. After createOpening the browser goes to the opening overview `/hiring/openings/<id>` (not /assessment/ai or /edit, which 404 until T15/T17); OpeningHeader shows only the tabs whose routes exist (overview; T15/T20 append theirs); AssessmentTabs not rendered until T15; readiness rows link only to existing pages (otherwise plain text). Tasks 15 and 17 switch createOpening's `next` to their routes when they add them.
Task 13 review (opus): Needs fixes. Important: (1) readiness rows convey state only by aria-hidden dot colour, labels read as done, tones inverted vs HIRING-UX 8.2; (2) anchors row done when no competencies; (3) Yayınla has no pending state, double submit can show a wrong NO_DRAFT notice. Minors 4-12 (notice keys via `in`, CLOSED publish shows role error, narrow column at 1920, Radix arrow keys (likely fine), duplicate opening names, AI start dead end for a position without ad, empty-state copy, list hides pending draft, build-state copy).
- Ruling: fix round 1 = Importants 1-3 (visible state word + icon per row, sr-only state, 8.2 tones; anchors row not done with "Önce soru ekleyip yetkinlik seç." when nothing is measured; client submit button with useFormStatus pending "Yayınlanıyor", disabled while pending) + Minors 4 (Object.hasOwn), 5 (CLOSED -> ?publish=closed before the edit gate), 6 (header and body share one max width), 8 (createOpening appends " (2)", " (3)" to a duplicate name in the same org; copy select shows status and date), 9 (existing position without ad: link "İlan metnini pozisyona ekle" to /library/positions/<id>), 10 (empty CommandEmpty only after typing; keep typed name; viewer-specific empty state), 11 (list row shows "Taslak v<n> bekliyor" when a draft exists beside a live version), 12 (rewrite inviteLater without build-state wording). Skip 7 (Radix selects on arrow; one manual keyboard check noted for the final benchmark).
Task 13: fix round 1 implementer DONE 7ca9e68 (1001 tests).
- Ruling (choice-only draft): a version must measure at least one competency to publish; new gate code NO_COMPETENCY in ANCHOR_PROBLEMS (Task 10 rules, partition test, describeProblem TR/EN, readiness anchors row) - why: an assessment with no competency cannot be evaluated (spec: "düzgün değerlendirmeli"), and the readiness row then tells the truth - cost if wrong: a choice-only screening test needs one competency.
- Accepted: two openings created at the same instant can share a name (no unique index); cosmetic.
- Task 13 fix: ruling code named NO_MEASURED_COMPETENCY (NO_COMPETENCY already meant an open question without a competency).
Task 13: fix round 1/5 (3 Important + 8 minor + choice-only ruling addressed, 0 open; commits 7ca9e68, 45fbe0c). Controller: vitest 1003/1003 none missing; screenshots f1-02, f1-08 viewed.
Task 13: complete (commits 8b44183..45fbe0c, review clean after 1 fix round)
Task 13: minor (deferred): pending publish state proven by DOM log only (no screenshot); aria-busy pass-through through Button not traced; Radix arrow keys need one manual keyboard check at the final benchmark.
BASE T14: 45fbe0c
- Task 14: hiring_openings has no archived state; library usage counts every opening in total, live = PUBLISHED version of an OPEN opening (brief).
Task 14: complete (commits 45fbe0c..24f4b67, review clean: Approved, 0 Critical/Important). Controller: vitest 1011/1011; 6 registry titles gone, all declared (C11) and confirmed covered.
- Final-fix-wave list: fake-db test for hiringLibraryUsage SQL (org scope, OPEN/PUBLISHED); registry.test menu asserts exam and library item labels TR/EN again; registry.ts doc comment wrap.
Task 14: minor (deferred): position-page "Bu pozisyon için alım aç" and "İşe alım · n" not seen live (no active position / openings in kademe_platform): check in the final benchmark; rights page has no real-registry end-to-end test.
BASE T15: 24f4b67
- Ruling: the addWeightSet STALE / NOT_WHOLE carry moves to Task 16 (it builds the weights form; Task 15 has no weight-set code).
- Ruling (Task 15, C7 continued): Task 15 adds the "Değerlendirme" tab to OpeningHeader and AssessmentTabs with only existing routes (edit; summary page per C4); switches createOpening `next` for the BLANK and COPY starts to /assessment/edit; AI start keeps the overview until Task 17; builder links to /ai and /preview only when those routes exist (they do not yet: plain text or hidden); readiness rows that point at the builder get their href now.
Task 15: implementer DONE 091c237 (1079 tests; 2 titles renamed, declared).
Task 15 review (opus): Needs fixes. Important: (1) editors remount from server props and lose queued/failed typed text when switching items; (2) focus ring on the dark vault panel ~2.7:1 (layered utility loses to the unlayered global :focus-visible); (3) three columns only from 1536px, HIRING-UX 5.5 wants three columns at 1360. Minors 4-12.
- Ruling: fix round 1 = Importants 1-3 (editors built from withUnsaved(content, all queued entries: waiting, sent, failed); unlayered `.vault :focus-visible` outline in vault text colour, measured >= 3:1; container query on the editor width: two editor columns from ~760px, three-column layout at 1360) + Minors 4 (bind the undo token to the draft version id; replay inside the same draft accepted, bounded by STAGE_FULL and the user's own rights), 5 (Yayınla disabled with a reason while the queue holds unsaved values, or flush first), 6 (hide the "En fazla 2..." hint when not editable; read-only fields visibly read-only), 7 (assessment summary and builder share one page width), 8 (replay and overlay only when editable), 9 (retry re-sends a failed undo, or the bar offers no retry for it), 10 (revert the optimistic type on refusal), 11 (opening name month in the org's locale: find the org default locale; Task 13 code), 12 (undo-token imports the secret from a small module, not @/lib/storage).
- Benchmark item for the user (design, not a defect): the near-black "Sadece ekip görür" vault panel is per HIRING-UX 5.5 / canvas Y2; ask the user at the final benchmark whether "soft" wants it lighter.
- Task 15 fix: no per-org locale exists; opening names use the app default locale (TR). Benchmark item: two-column editor starts at ~760px editor width, so at 1280 viewport the panels stack (712px).
Task 15: fix round 1/5 (3 Important + 9 minor addressed, 0 open; commit 3594c1d). Controller: vitest 1084/1084, 1 title renamed (declared); screenshots f1-01, f1-03 viewed.
Task 15: complete (commits 24f4b67..3594c1d, review clean after 1 fix round)
Task 15: minor (deferred): structural network failure hides Tekrar dene while typed values also failed; possible one-frame stale flash after revalidatePath (unverified); a server-refused value is dropped from the queue (editor shows server text).
- Benchmark items: manual keyboard check of the "Soru ekle" menu (arrow/typeahead); panels stack at 1280 viewport (editor 712px < 740px threshold).
BASE T16: 3594c1d
- Ruling C21 (Task 16): while the anchor Sheet is open the page's "Puan kartını kaydet" is secondary (one filled primary per view, RULES).
- Ruling (Task 16, C7 continued): Task 16 adds the "Puan kartı" item to AssessmentTabs and gives readiness rows for anchors/weights their scorecard href now.
Task 16: implementer DONE 0d86ba9 (1118 tests, none missing).
Task 16 review (opus): Needs fixes. Important: (1) a draft hides the live scorecard and live weights with no note; (2) matrix headers "1.1" with hover-only abbr. Minors 3-11.
- Ruling: fix round 1 = Important 1 (draft mode note "Taslak v<n+1>. Yayındaki v<n> davetli adaylar için değişmeden kalır." + a switch Yayındaki v<n> / Taslak v<n+1> via ?version=live; live view uses the live version's content for measuredBy and columns; live weights changeable while a draft exists, guarded by STALE + reason) + Important 2 (visible legend under the matrix "1.1 · <prompt truncated>" + sr-only full name in each th) + Minors 4 (server enforces WEIGHTS_MISSING on draft weights instead of filling 0), 5 (live save needs a real change; no reason prompt right after a save), 6 (current weight set shown with a localized date and its reason), 7 (read-only Sheet uses readOnly or plain text, not disabled grey). Minor 3 -> final fix wave (gate NOT_WHOLE code). 10 -> benchmark keyboard check.
Task 16: fix round 1/5 (2 Important + 4 minor addressed, 0 open; commit 0ff6f66). Controller: vitest 1130/1130 none missing; screenshot f1-08 viewed.
Task 16: complete (commits 3594c1d..0ff6f66, review clean after 1 fix round)
- Final-fix-wave list: gate maps a NOT_WHOLE draft to WEIGHTS_NOT_100 (rules/gate.ts:92); scorecard sr-only column names shorter ("Soru 1.1"), the legend carries the full prompt; scorecard-view `savedSet` never cleared (stale "unchanged" after another user's save).
- Benchmark item: Escape closes the anchor Sheet (manual keyboard check).
BASE T17: 0ff6f66
- Ruling (Task 17, C7 continued): Task 17 adds the "AI taslağı" item to AssessmentTabs, switches createOpening `next` for the AI start to /assessment/ai, and gives the builder empty state its /ai link. Preview stays unlinked until Task 19.
- Ruling (Task 17, AI cost): generateHiringDraft is called only after aiLimitReached(org, user, HIRING_DRAFT) passes; RATE_LIMITED has TR/EN copy; the job uses runWithRepair (one repair) + markAiRunError; tests mock the provider; at most one live Gemini call in the browser check.
Task 17: implementer DONE b41f9b8 (1198 tests; 1 title renamed, declared; one live Gemini request -> 3 HIRING_DRAFT ai_runs rows incl. 2 logged 503 retries).
Task 17 review (opus): Needs fixes. Important: (1) team-only text (1/3/5 examples etc.) follows the manager's UI locale, not the version's (EN examples for a TR version); (2) after cards arrive the paid "Yeniden üret" stays the filled primary (HIRING-UX 5.6: "Kabul edilenlerle kurucuya geç"); (3) a failed or repeated generation wipes cards, accepts and edits with no undo; (4) reload loses proposals, double accept possible. Minors 5-11.
- Ruling: fix round 1 = Importants 1-4 (teamLocale = version defaultLocale + test; primary becomes "Kabul edilenlerle kurucuya geç" disabled with reason until something is accepted, regenerate secondary; a failed generate keeps the current cards and shows the refusal above them; a successful regenerate keeps the previous proposal restorable; sessionStorage per opening+version {generationId, draft, jobAd, budgetWarning, accepted, removed, edits}, re-parsed with the schema on load, discarded on version change or non-draft mode, try/catch; "already accepted" keyed by generationId + card key) + Minors 5 (hide duplicate quote), 6 (neutralise the delimiter in the ad), 7 (EN fields editable when the version has EN, or clear nameEn when TR name edited), 9 (copy: archived only), 10 (pasted ad kept in the same session entry). Minor 8 deferred (low risk, declared); 11 noted (limiter counts retry rows by ruling).
Task 17: fix round 1/5 (4 Important + 5 minor addressed, 0 open; commit 9ac80a8). Controller: vitest 1208/1208, 1 title renamed (declared); ai_runs unchanged.
Task 17: complete (commits 0ff6f66..9ac80a8, review clean after 1 fix round)
- Final-fix-wave list (priority): a persisted "accepted" mark outlives a stage/competency deleted elsewhere; undo answers NOT_FOUND and the card is stuck until a paid regenerate: on NOT_FOUND from undo, clear the mark. Also: persist effect could write an old session under a new version key (self-healing).
Task 17: minor (deferred): findOrCreateCompetency read-then-create race; archiveCompetencyIfUnused usage check outside the tx; proposals per tab; a card accepted from an older proposal can be accepted again from a newer one.
BASE T18: 9ac80a8
Task 18: implementer DONE c219f6d (1247 tests, none missing; 1 live QUESTION_CHECK call).
Task 18 review (opus): Needs fixes. Important: the protected-trait rule misses whole categories (gender, health/disability, pregnancy, political "siyasal", race/colour/origin, language, religion forms, marital forms, sexual orientation, ASCII-typed Turkish) and has avoidable false hits ("çocuk gelişimi", "office politics", "yaş grubu"). Minors 2-8.
- Ruling: fix round 1 = Important 1 exactly as the review recommends (category table per 6701 md. 3 / İş K. md. 5: age, gender, marital/family, pregnancy, health/disability, religion/sect/belief, race/colour/ethnic/origin/language, political views, union membership, sexual orientation; tr-locale lowercase + ASCII skeleton on text and patterns; both language lists on both fields; word-start stems, suffix allow-lists for short stems, phrases for ambiguous ones; two it.each tables positives per category TR/EN incl. uppercase İ/I and ASCII-typed, negatives incl. dinle, dinamik, yaşadığın, yaşam, engelleri aştın, eş zamanlı, office politics, children's-education role; calmer per-category note TR/EN) + Minors 2 (all hits per question grouped by category; keep the AI note when the rule finding has none), 3 (quote the matched words in original case), 4 (excerpt >= 2 words or ~8 chars; NFC, apostrophe folding, locale-correct lowercase per field), 5 (prefix data lines or JSON-encode), 6 (complete the AI PROTECTED definition; askerlik NOT flagged by default: it can be a legitimate job requirement in Turkey, the AI may note it as "may relate" only if the question asks status without job need), 7 (CLOSED shows errClosed; clearer aiReadOnly copy). 8 noted for the benchmark (unverified paths).
- Ruling (askerlik): not in the rule list - why: legally askable in Turkey when the job needs it (start date / travel) - cost if wrong: a missed flag, AI may still note it.
Task 18: fix round 1/5 (1 Important + 6 minor addressed, 0 open; commit c8c00fb). Controller: vitest 1326/1326, 4 titles renamed (declared, confirmed equal or stronger); own probe of unseen phrasings: 6/6 protected hit, 4/4 job questions (incl. askerlik) no hit.
Task 18: complete (commits 9ac80a8..c8c00fb, review clean after 1 fix round)
- Final-fix-wave list: narrow protected-terms "plan to have*" to family/child phrases (FAMILY false hit on "plan to have the release ready").
Task 18: minor (deferred, accepted "may touch" noise): how old / which party / hangi parti / husband* in unrelated senses; suffix after an apostrophe not matched.
BASE T19: c8c00fb
Task 19: implementer DONE 3b3b903 (1342 tests, none missing). Controller ran the preview page leak test (4/4) and read its assertions: sentinel, competency id, "correct", team-only field names absent; exact 9-key prop whitelist.
Task 19 review (opus): Needs fixes. Important: focus drops to body on Bitir / Önceki ekran / Baştan başla, and step changes are not announced. Minors 2-8.
- Ruling: fix round 1 = Important 1 (focus the frame heading/prompt on index change via tabIndex=-1 + ref, plus a polite live region with stage/question; the pattern is reusable for plan 2) + Minors 2 (frame headings h2; the question prompt is a heading), 3 (fallback text carries its own lang), 4 (toCandidateVersion copies I18nText as {tr, en} only + test with an extra key), 5 (readiness preview row is "done" only when previewed_at >= the draft's last content change; if the draft has no reliable change timestamp, defer to the final fix wave and say so), 6 (builder "Önizle" refuses with the unsaved reason like publish), 7 (progress text per HIRING-UX 6: thin bar + "Aşama 2 / 3"). Skip 8.
- Benchmark item (controller to run live): fetch the preview page's RSC/flight payload and document in Chrome and search for sentinel team-only strings (the T19 browser leak check was the implementer's; controller only ran page.test.ts).
  (benchmark leak check must include a positive control: put a sentinel into a candidate-visible field and confirm the same search finds it, then confirm 0 hits for team-only sentinels.)
- Controller live leak check DONE (replaces the benchmark item above): seeded a draft in kademe_platform with visible sentinels (LEAKVISIBLE_*) and team-only sentinels (TEAMSECRET_* in internal purpose, behaviours, red flags, manager notes, answer examples, stage purpose, internal opening name); in Chrome fetched the preview with RSC: 1 (23.5 KB), the plain document (54.7 KB) and live DOM + scripts (85.7 KB). Positive control: LEAKVISIBLE_PROMPT 1/1/2, LEAKVISIBLE_STAGE 1/2/3. Team-only content sentinels and field names: 0/0/0 each. Only TEAMSECRET_OPENINGNAME appears, located in the manager page's own h1 (OpeningHeader, outside the preview frame), as designed. Rows deleted; counts back to baseline; server stopped; tab closed.
Task 19: fix round 1 implementer DONE 2d53b02 (1352 tests). Minor 5 (preview stamp reset) deferred: no reliable draft change timestamp (updated_at only bumped by saveDraftWeights).
- Final-fix-wave list: preview stamp reset needs a draft content-change timestamp (bump hiring_versions.updated_at on every draft write, or a dedicated column).
Task 19: fix round 1/5 (1 Important + 5 minor addressed, Minor 5 deferred with confirmed rationale, 0 open; commit 2d53b02). Controller: vitest 1352/1352 none missing; live leak check with positive control passed.
Task 19: complete (commits c8c00fb..2d53b02, review clean after 1 fix round)
- Final-fix-wave list: done screen announced twice (live region repeats the focused h2); preview progress bar width vs stage text use different definitions (align in plan 2).
BASE T20: 2d53b02
- Ruling (Task 20, C7 continued): add the "Ayarlar" tab to OpeningHeader and give the readiness "Ekip atandı" row its /settings href. Closing/reopening an opening is explicit on this page; a CLOSED opening is read-only everywhere (Task 10 openingAccess, Task 11 lockOpening) and shows a "Yeniden aç" action for OWNER/MANAGER.
Task 20: implementer DONE aef6966 (1405 tests, none missing).
Task 20 review (opus): Needs fixes. Important: (1) DEADLINE_PAST blocks every save once the deadline passed; (2) close/reopen buttons have no pending state (likely first-click miss; a queued double close lands on the error boundary). Minors 3-9. Tab name "Ekip ve kurallar" accepted (HIRING-UX 4.3/5.4/5.18; avoids clash with the sidebar "Ayarlar") - clarifies the C7 ruling.
- Ruling: fix round 1 = Importants 1 (DEADLINE_PAST only when the deadline value changes; saved day read in the locked select; tests both ways) and 2 (useFormStatus pending buttons for close, reopen and the UndoStrip button, per publish-button.tsx; closeOpeningAction uses openingFor(view) + canDecide so a repeated close is a harmless redirect) + Minors 3 (select shows "Name (Devre dışı)"; team readiness row advisory when no active decision maker), 4 (advisory when minEvaluations > ticked reviewers + override copy), 5 (read users through tx), 6 (audit name and candidateContactEmail), 7 (closed overview notice links to the settings page), 8 (human-readable zone label, e.g. "Türkiye saati" / "Turkey time" derived from ORG_TIMEZONE via Intl), 9 (rename keeps names unique via uniqueOpeningName).
Task 20: fix round 1/5 (2 Important + 7 minor addressed, 0 open; commit 42a2c26). Controller: vitest 1413/1413, 0 failed (measurement blind-checked with an injected failing test: reported failed=1), 1 title renamed (declared, confirmed).
Task 20: complete (commits 2d53b02..42a2c26, review clean after 1 fix round)
Task 20: minor (deferred): closed overview says "closed" twice; PendingSubmitButton/UndoButton have no DOM test; UndoStrip live-checked on one of 7 call sites.
BASE T21: 42a2c26
- Ruling (Task 21): the end-to-end walk runs on a throw-away template copy `kademe_ui_check` of kademe_platform (publishing creates frozen rows that cannot be deleted), dropped afterwards; at most one live Gemini call (HIRING_DRAFT) and one QUESTION_CHECK; C17: the clean-tree check covers only paths this plan touched; STATUS also lists the final-fix-wave items as known open points until the final review runs.
Task 21: complete (commit 7c9a54a, STATUS only). Implementer gates: vitest 1413/1413, 67 routes, verify:exam 24 ok, verify:guard 31 ok, verify:hiring-immutability 43 ok, verify:hiring-setup 180 ok, em-dash scan 240 files clean. E2E walk on throw-away kademe_ui_check (dropped), TR then EN, through publish and v2; 3 ai_runs (2 HIRING_DRAFT incl. a Gemini 503 + NVIDIA fallback taking 3.0 min, 1 QUESTION_CHECK).
- Final-fix-wave list: AI draft waiting copy says 20-40 s but a provider fallback took 3 min: honest copy after ~40 s ("Hâlâ çalışıyor, sağlayıcı yavaş") and a client-side cap; next-intl ENVIRONMENT_FALLBACK timeZone warning on the scorecard page (pass ORG_TIMEZONE to the intl provider).
Final review (opus, ae00611..7c9a54a): With fixes, 0 Critical, 4 Important (snapshot tag order + schemaVersion; library usage reveals openings to reviewers; candidateSafe lacks hiring keys; rollout rehearsal only through 0003 + STATUS item 11), 11 minor; triage of the final-fix-wave list. Findings + rulings: final-fix-findings.md (items 1-22 to fix in ONE dispatch; deferred list at its end).
BASE FINAL FIX: 7c9a54a
Final fix wave: DONE (commits c32d087, 588d91d, 794b363). Controller: vitest 1453/1453, 117 files, 0 failed, none missing; candidateSafe names 8 hiring keys; schemaVersion 1. Re-review (opus): all 22 items addressed, no new Critical/Important.
- Carry to plan 2: url-notice replaceState may run before Next patches history on a full page load (native POST before hydration / direct URL open), so a later router.refresh can resurrect the param: defer the call (setTimeout 0) or check history.state.__NA. weights-form currentWeightSet matches by content (A->mine->B->A nit).
- Note: during the final wave the implementer was refused by the permission classifier when inserting a session row for a test reviewer; it then logged a throw-away test reviewer in via the login form on rev.localhost against the dropped kademe_ui_check copy. Surfaced to the user.
- Ruling: keep this plan's workspace (ledger) until the user's final benchmark: the final message lists every ruling from it - why: the user asked for the rulings list - cost if wrong: a git-ignored folder stays.
PLAN 1 COMPLETE: ae00611..794b363.
- User decision (2026-10-05): the shared local kademe DB migration and the production rollout happen only at the very end, after all hiring plans are done (still with explicit approval at that time).
