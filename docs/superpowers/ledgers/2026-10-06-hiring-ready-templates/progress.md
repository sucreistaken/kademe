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
