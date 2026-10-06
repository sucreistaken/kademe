# SDD ledger, plan: docs/superpowers/plans/2026-10-06-hiring-ready-templates.md

Spec: docs/superpowers/specs/2026-10-06-hiring-ready-templates-design.md
Workspace (briefs, reports, packages, git-ignored): .superpowers/sdd/2026-10-06-hiring-ready-templates/
PLAN BASE: 729bd3c

## Pre-flight scan

| Pair / task | Produces vs consumes | Found |
|---|---|---|
| T1 -> T2 | materialise, templateCompetencyKeys, templateByKey, templateCompetency, TEMPLATES, templateMinutes, templateQuestionCount | names and signatures match |
| T1 -> T3..T7 | index.ts TEMPLATES list, build.ts builders, templates.test.ts bar | match; role counts 1+4+3+4+4+4 = 20 |
| T2 -> T8 | templateCards(locale), TemplateCard, start TEMPLATE + templateKey, TEMPLATE_NOT_FOUND | match |
| T2 -> T9 | createOpening TEMPLATE, ensureTemplateCompetencies | match |
| T1 self | test idOf gives RFC v4-shaped uuids; customer-support: 5 questions, 4 open, 3 competencies 40/35/25 | consistent with T2's expected counts |
| T5 self | stage 3 long text says "german_proficiency + role's second key"; test wants exactly 3 competencies | consistent if stage 3 only uses the role's own 3 keys |
| T7 vs T1 test | HR single "which question must not be asked" would put banned phrases (married, religion) in option labels; T1 test bans them in the whole template JSON | conflict |
| T8 self | badge on ChoiceCardGroup without a new shared prop | consistent |
| T9 self | needs local Postgres on 5434 | runs locally here |

Ruling: T7's HR option labels name the topic, not the question ("Adayın medeni durumunu sormak" / "Asking about the candidate's marital status"), so the banned-phrase test stays strict. Why: the test protects every template; an exemption would hide a real violation. Cost if wrong: one reworded question.
Ruling: the project keeps its ledgers in docs/superpowers/ledgers/ (committed), so this file is the ledger; the skill workspace only holds briefs, reports and review packages. Cost if wrong: none, git has both.
BASE T1: b7eacb8
Task 1: implementer DONE d2dcdb5 (types, build, 8 new competencies, materialise, index, customer-support, templates.test 7/7; tsc/eslint clean). Review dispatched (opus).
Task 1: review (opus): spec compliant, Needs fixes, 3 Important (german_proficiency B2 band + "native" benchmark; classroom_management TR "yoklama"; accuracy/resilience anchors not observable).
Ruling: german_proficiency 1 = B1 or lower, 3 = C1, 5 = C2 "full control", description names 2 = B2 and 4 = C1-C2; no "native" wording. Overrides the plan's "1 = below B2" because a B2 answer would match no anchor. Cost if wrong: anchor text rework.
Ruling: the teacher check in templates.test uses an explicit key set; BANNED gains politics phrases but not bare "parti" (matches "participate") nor "çocuk" (young-learners role). Cost if wrong: a test tweak.
Task 1: minor (deferred to content tasks): exam_expertise and accuracy questions must carry reference answers / planted-error lists in internalQuestion.
Task 1: fix round 1/5 (6 addressed, 2 open: duplicated 'dersin sonunda' at :226, 'yoklama yapıyor' at :61; commits d2dcdb5..45c214c). Re-review (sonnet).
Task 1: fix round 2/5 (2 addressed, 0 open; commit 10a7ddb). Controller-checked instead of a re-review: the diff is the two named strings only (2+/2-), grep for both bad phrasings = 0, vitest templates 7/7, tsc 0 lines.
Task 1: complete (commits b7eacb8..10a7ddb, review clean after 2 fix rounds)
BASE T2: 8683a74 (ledger commit on top of 10a7ddb)
Task 2: implementer DONE_WITH_CONCERNS 2bf4b4a (stopgap TEMPLATE_NOT_FOUND entries in new-opening-steps/form; onConflictDoNothing untested in fake DB; audit meta templateKey null on old starts; name-collision and concurrent seed-key race unguarded). Gate vitest 1221/1221 (implementer). Review dispatched (opus).
Task 2: review (opus): spec compliant, Approved, 0 Critical/Important. Controller re-ran: vitest hiring+db+app/hiring+components/hiring 122 files 1693/1693, tsc 0 lines.
Task 2: minor (deferred): two template keys matching one team competency by name collapse into one id (weights < 100); guard = skip a named row already used.
Task 2: minor (deferred): concurrent insert of the same seed_key throws a raw unique violation through createOpeningAction; fix = onConflictDoNothing + re-read by seed key.
Task 2: minor (deferred): ensureDefaultScale through a passed executor and the anchor onConflictDoNothing are not covered by the fake DB; Task 9 (fresh org, no library) must exercise them.
Task 2: carry to Task 8: re-point the stopgap TEMPLATE_NOT_FOUND entries (new-opening-steps.ts:45-46, new-opening-form.tsx:89-90) to the template step and its own sentence.
Task 2: complete (commits 8683a74..2bf4b4a, review clean)
BASE T3: 991bfb6
Task 3: implementer DONE b48b978 (sales, call centre, accountant, executive assistant; templates tests 27/27 re-run by controller). Review dispatched (opus).
Task 3: review (opus): spec compliant, Approved, 0 Critical/Important; every answer key checked by hand (VAT, journal entry, reconciliation, invoice, sales arithmetic, dates).
Ruling: call-centre stage-1 behavioural questions stay VIDEO (the task line says video; the content-common AUDIO rule is the default for phone work samples). Cost if wrong: two type changes.
Task 3: minor (deferred, content polish wave): call-centre invoice roleplay should also tag resilience; call-flow single options give the answer away by wording; EA calendar single lacks the meeting length and has weak distractors; EA flight prompt lacks departure city and flight time; accountant stage 1 too tight for retakes (singles first or 12 min); sales "facts above" back-reference; accuracy anchors coarse with exactly 2 planted errors (plan-mandated).
Task 3: complete (commits 991bfb6..b48b978, review clean)
BASE T4: 89512ce
Task 4: implementer DONE f88c047 (software dev, retail, warehouse; stage 1 sized 13-14 min for worst-case retakes, totals 34/26/34; templates tests 42/42 re-run by controller). Review dispatched (opus).
Task 4: review (opus): Needs fixes, 2 Important (warehouse accuracy-only story video cannot be scored against planted-error anchors; retail add-on campaign rule ambiguous), 5 minor. All answer keys and planted bugs verified by the reviewer in node.
Ruling: accuracy is measured only by planted-error work samples; story questions use another competency. Same defect exists in accountant.ts:26 (Task 3): added to the content polish wave. Cost if wrong: anchor/question retagging.
Ruling: the spec's "about 20-30 minutes" means typical completion; stage minutes are an AUTO_SUBMIT hard cap sized for worst-case retakes (up to the test's 35, 45 for teachers); stage descriptions say "En fazla N dakika". Cost if wrong: candidates see longer caps in the gallery.
Task 4: fix round 1 dispatched (I1, I2, M1-M5).
Task 4: fix round 1/5 (7 addressed, 0 open; commit 8227be6). Re-review (sonnet): all addressed. Controller: templates tests 42/42, retail 450 x 0.7 = 315, 600 + 315 = 915; checked by hand the stock scenarios (260 -> 130 >= 120; 240 -> 110, 10 short = intended trap) and the Wed 04:00 departure.
Task 3: minor (deferred, polish wave): EA inbox prompt lacks departure city and flight time; only internalQuestion says "Istanbul, about 1h10".
Task 4: complete (commits 89512ce..8227be6, review clean after 1 fix round)
BASE T5: 7b9e7fe
Ruling: user asked for speed (2026-10-06). Tasks 6, 7, 8, 9 run in parallel in separate worktrees (Task 5 on the main tree); each touches its own files, index.ts conflicts are resolved by the controller when cherry-picking (final order from the plan). Content reviews stay per task. Cost if wrong: merge conflicts in index.ts only.
Task 9: implementer DONE 193bf0a in a worktree (based at main by mistake, reset to 7b9e7fe), cherry-picked as cc93e01 without conflict. Agent run on kademe_templates_check: 64 ok, 0 FAIL, 8 templates (output saved in task-9-report.md). Report could not be written to the shared checkout from the worktree (isolation).
Task 9: review (sonnet): Approved, 0 Critical/Important.
Task 9: minor (deferred, final fix wave): third createOpening result unchecked before the "ad never replaced" check (line ~174); versionsOf(...)[0] assumed draft/published (lines ~119, ~214).
Task 9: complete (commit cc93e01, review clean); rerun with all 20 templates in Task 10.
Task 5: implementer DONE cb62cf7 on the main tree (4 teacher roles + german-proficiency-stage.ts; stage 3 is 20 min, proficiency video 1 take, totals 45). Controller: templates tests 62/62. Review dispatched (opus, German and exam facts).
Task 8: implementer DONE e4b936b in a worktree (reset from 739f218 to 7b9e7fe), cherry-picked as 80cfee8 without conflict. Controller: vitest components/hiring+i18n+app/hiring+solutions/hiring 120 files 1630/1630, tsc 0 lines.
Task 8: review (opus): Approved, 0 Critical/Important; no template content in client modules (only import type).
Task 8: minor (deferred): "Önizle" button inside the card label (long accessible name; shared block has no action slot); three radiogroups share one radio name; pill shows a preselected template before the gallery is opened; a TEMPLATE_NOT_FOUND refusal keeps the stale choice; no form-level test of the TEMPLATE path; fresh checkouts need `next typegen` before tsc.
Task 8: not verified in a browser (Sheet focus, badge colour, mockup 4b look); Chrome check after Task 10.
Task 8: complete (commit 80cfee8, review clean)
Task 7: implementer DONE e1b5817 in a worktree; cherry-picked as e67ed01 with an index.ts conflict (both sides appended to TEMPLATES), resolved by the controller to plan order; after: 0 markers, 16 roles, templates tests 82/82, tsc 0 lines, eslint clean. Review dispatched (opus).
Task 5: review (opus): Needs fixes, 2 Important: (1) exam-prep telc scoring task used wrong criteria names and a CEFR-level A-D scale, so the key (3 of 4 points = "B or C") was wrong; source of the error: the controller's dispatch facts (from the research agent) said telc A-D = CEFR levels; the official ZD B1 Übungstest says I Leitpunkte (A 4, B 3, C 2, D 0-1), II Kommunikative Gestaltung, III Formale Richtigkeit, 5/3/1/0 points. (2) C-test item 7 stem "anpa___" gives away two distractors. All 8 German keys checked: correct.
Ruling: keep the proficiency video at 1 take (spontaneous speech, reviewer agrees); check the recorder's technical-retry behaviour in Chrome. Cost if wrong: a candidate with a failed camera loses the oral C1 evidence.
Ruling: stage 3 of the teacher roles is 20 min (worst-case timing), not the plan's 12; totals 45. Cost if wrong: longer candidate time.
Task 5: fix round 1 dispatched.
Task 5: fix round 1/5 (2 Important + 4 minor addressed, 0 open; commit 74d4f60). Re-review (sonnet): all addressed. "D in I or III makes the letter 0" comes from the Task 5 reviewer's reading of the official telc ZD B1 Übungstest PDF (not re-checked by the controller). Controller: templates tests 103/103.
Task 5: complete (commits 4d9135b..74d4f60, review clean after 1 fix round)
Task 6: implementer DONE 0984f19 in a worktree; cherry-picked as 6a38d68 with the index.ts conflict resolved to the final plan order (20 templates, order verified by running TEMPLATES against the plan list). Controller added the plan's length-20 + group test (16daa33). Review dispatched (opus).
Task 7: review (opus): Needs fixes, 1 Important (field-sales route single: two distractor explanations give the wrong reason; key correct). Fix round 1 dispatched in the Task 7 worktree.
Polish wave (Task 3/4 deferred minors on call-centre, EA, accountant, sales) dispatched on the main tree.
Polish wave: commit da3f6bd (call-centre, EA, accountant, sales). Task 7 fix: f7865cb cherry-picked as 05ee20e (no conflict). Combined re-review (sonnet): all 11 findings addressed; route single brute-forced (only A, D, C, B feasible). Controller: templates tests 103/103.
Polish: minor (deferred): call-centre internalQuestion mis-describes option (c) (it swaps greet/verify, not skips greeting).
Task 7: complete (commits 80cfee8..05ee20e, review clean after 1 fix round)
Task 6: review (opus): Needs fixes, 3 Important (exam-centre unverified ID rule scored as exam knowledge; exam_expertise under-evidenced; student-services score-3 example misses the subtle error). Fix round 1 dispatched on the main tree (fresh opus fixer; the worktree was stale), also covering the sales stage-1 timing left by the polish wave and the "Bir kısa" wording in the four Task 6 files.
Task 6: fix round 1/5 (3 Important + minors addressed, 0 open; commit 6f21244). Re-review (sonnet): all addressed. 14 Oct 2026 = Wednesday (checked).
Task 6: complete (commits e67ed01..6f21244, review clean after 1 fix round)
Task 10 gates (controller, HEAD 6f21244): tsc exit 0; eslint src scripts exit 0; pnpm test 234 files, 2966/2966 passed (no ICU env failure this time); pnpm build exit 0 (run in the throw-away worktree ../recruitement-templates-ui at 6f21244, so the shared 3100 dev server's .next was not touched); verify:hiring-templates on a fresh kademe_templates_check: 124 ok, 0 FAIL, "Every template (20)", DB dropped; the guard refuses DATABASE_URL=.../kademe (pnpm exit 2).
Deferred minors still open: sales single correct option longest; call-centre option (c) note; Task 2 name-collision and seed-key race; Task 8 a11y items; Task 9 vacuous third check.
Chrome check (controller, Claude in Chrome, own server :3101 on kademe_ui_check built at 6f21244): new position "Almanca Öğretmeni" -> start step shows "Hazır şablondan başla · Önerilen" first, AI card without badge -> gallery lists 20 templates in 3 groups with meta and chips -> created from german-teacher-adult -> builder opened; overview readiness: assessment, anchors, weights "tamamlandı", only team and preview advisory, then "Yayınla". Not checked: the Önizle Sheet, the candidate flow.
WHOLE-PLAN REVIEW (opus): 0 Critical, 2 Important (customer-support stage 1 and call-centre stage 2 below the worst-case timing, no timing guard test; long prompts render as a 24px h2 on the candidate screen), 6 Minor. Verdict: ready after Important 1.
FINAL FIX WAVE dispatched: both Important + timing guard test + preview whitespace + profile/seed_key concurrency + verify-script check.
FINAL FIX WAVE: commit 82628f6 (timing of customer-support stage 1 and call-centre stage 2, worst-case timing guard test, call-centre note, long-prompt heading 18px above 200 chars, gallery preview line breaks, seed_key and profile conflict handling, verify-script third check). Re-review (sonnet): all addressed, no new Critical/Important. Controller: pnpm test full suite re-run after the wave (see the hand-off), eslint src scripts.
Residual (not fixed, recorded): two openings with different templates started at the same instant on one empty position may write profile rows from both; prompts over 200 chars written by teams also render at 18px now (intended).
PLAN COMPLETE.
