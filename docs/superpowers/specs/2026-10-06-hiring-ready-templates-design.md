# Ready hiring templates: design

Date: 2026-10-06. Branch `platform/solutions`. Status: approved in chat by the user ("tamam"), spec for review.
Hand-off it builds on: `docs/superpowers/NEXT-templates.md`. Visual authority: `docs/design/hiring-manager-mockup.html`
frames 4 and 4b.

## 1. Goal

A manager opens an opening, picks **"Hazır şablondan başla"**, chooses a role and gets an assessment that can be
published right away: stages, questions of the right types and timings, competencies linked to every open question,
scorecard anchors (1/3/5), expected behaviours and red flags, and weights adding up to 100. Only the advisory
readiness rows (team, preview) may remain. The content must measure the role, not fill space.

Out of scope here (own spec and plan, after this one): the exam side's three level-test blueprints (quick screen,
placement, four-skill level check) and the item bank growth. Section 8 records what is already decided for it.

## 2. Decisions (user, 2026-10-06)

- 20 roles in one batch: 8 generic, 8 language-school, 4 extra (section 6).
- Templates are the recommended start ("Önerilen"); AI stays a plain option (less AI rule).
- A template may fill the **position** too, but only where it is empty: profile competencies when the position has
  none, job ad when it has none. A filled position is never changed. (The user said the current positions will be
  rewritten anyway.)
- The German teacher roles get a German proficiency stage (section 6.3).
- Templates never call AI at runtime. AI may help draft offline; every text is reviewed and lives in the repo.

## 3. Where templates live

Typed TypeScript data in `src/solutions/hiring/templates/`:

- `types.ts`: `HiringTemplate` = key, group (`GENERIC` | `LANGUAGE_SCHOOL` | `EXTRA`), role name (tr/en), short
  summary, job ad (tr/en), icon name, competency weights by key, stages. A stage reuses `stagePayloadSchema`'s
  fields; an activity reuses `activityPayloadSchema`'s fields with `competencyKeys: string[]` instead of
  `competencyIds`.
- `competencies.ts`: the template competencies. The 8 starter keys come from `SEED_COMPETENCIES`
  (`src/db/library-seed-data.ts`), not copied. New ones, each with name, description, 1/3/5 anchors, positive and
  negative observation tags, all in TR and EN: `accuracy`, `didactics`, `german_proficiency`, `resilience`,
  `integrity`, `design_craft`, `classroom_management`, `exam_expertise`.
- One file per role (`customer-support.ts`, `german-teacher-adult.ts`, ...) and `index.ts` exporting `TEMPLATES`
  in gallery order plus `templateByKey`.

Why code and not DB rows: reviewed in git, typed, testable without a database, same in every organisation, no
migration. A school-specific template store is a later idea, not needed now.

## 4. Materialising a template

`createOpening` (`src/solutions/hiring/server/openings.ts`) accepts `start: "TEMPLATE"` plus `templateKey`. The old
values `AI | COPY | BLANK` keep their behaviour. Unknown key answers `TEMPLATE_NOT_FOUND` before anything is
written. Inside the same transaction, after the opening and v1 rows:

1. **Competencies** (`ensureTemplateCompetencies(tx, orgId, actorId, keys)` in `server/templates.ts`): for each key,
   in order: an org row with `seed_key = key` (unarchived and audited if it was archived, because the manager chose
   a template that measures it); else an active org row whose TR or EN name matches (same rule as
   `findOrCreateCompetency`), so a team's own "İletişim" is reused; else a new row with `seed_key = key`,
   `reviewed_at` null (starter content), anchors 1/3/5 and observation tags. Uses the default scale
   (`ensureDefaultScale`). Returns key to id.
   A reused competency whose anchors 1, 3 or 5 are missing gets the template's text only for the missing levels.
2. **Stages and questions**: template stages map to `StagePayload` with keys turned into ids, then the existing
   `insertStageRows` writes them (exported from `versions.ts` for this, together with `assertCompetencies`).
3. **Weights**: `weightsEnabled = true`, `draftWeights` = the template's weights by id. Template weights are whole
   numbers adding up to 100 (a test pins it).
4. **Position** (only for an empty position): profile rows from the template weights, job ad from the template.
5. Audit row `hiring.opening.create` with `start: "TEMPLATE", templateKey`.
6. `next` = the builder (`/assessment/edit`), so the manager sees and can change every question.

## 5. Screens

- Start step (mockup 4): `start-choices.ts` gets a fourth entry `TEMPLATE`, first, with the "Önerilen" badge and
  the `layout-template` icon. AI loses nothing else, gains nothing.
- Gallery step (mockup 4b, `#template`, "Hangi şablon?"): group tabs or headings (Genel, Dil okulu, Diğer); each
  card shows role, stage count, question count, minutes, up to 3 competency chips and "Önizle". "Önizle" opens a
  read-only Sheet with the stages and the candidate-facing prompts. A position whose name matches a template is
  preselected (plain case-insensitive match, no AI).
- Confirming creates the opening as in section 4.

## 6. Content

### 6.1 Quality bar (every template)

- 2 stages, about 20-30 minutes in total. Stage 1 a short screen, stage 2 a work sample.
- Behavioural ("Son ... bir durumu anlat: ne oldu, sen ne yaptın, sonuç ne oldu?") and situational questions, each
  tied to 1-2 competencies. At least one realistic work sample per role.
- Every question: TR and EN prompt, type, think/answer seconds, takes, 2-4 expected behaviours, 1-3 red flags.
- Choice questions: one correct answer (single choice), plausible distractors, no competency (gate rule).
- No questions about age, family, religion, health, origin or similar. "Sen" form. Never the em-dash.
- Each template states 3 competencies with weights such as 40/35/25.

### 6.2 Roles

Generic (8): Müşteri Destek Uzmanı, Satış Temsilcisi, Çağrı Merkezi Temsilcisi, Muhasebe Uzmanı, Yönetici Asistanı,
Yazılım Geliştirici, Mağaza Satış Danışmanı, Depo ve Lojistik Sorumlusu.

Language school (8): Almanca Öğretmeni (yetişkin, genel kurs), Sınav Hazırlık Öğretmeni (Goethe/telc/ÖSD), Çocuk ve
Genç Almanca Öğretmeni, Online Almanca Öğretmeni, Kurs Danışmanı (satış ve kayıt), Öğrenci İşleri / Kayıt
Sorumlusu, Eğitim Koordinatörü, Sınav Sorumlusu (lisanslı merkez).

Extra (4): İnsan Kaynakları Uzmanı, Pazarlama Uzmanı, Ürün Tasarımcısı, Saha Satış Temsilcisi.

The per-role question outline the user approved is the chat list of 2026-10-06; the plan copies it into each
content task.

### 6.3 German proficiency stage (the four teacher roles)

A third stage "Almanca yeterlik", about 12 minutes, built on what the exam research found (Goethe/telc/DTZ use 60%
as the "met" line and level-relative writing rubrics):

- 8 single-choice items at B2-C1 (grammar, vocabulary, C-test style gaps written as choice items).
- 1 formal e-mail in German with 4 required content points (LONG_TEXT).
- 1 video, 2 minutes, explaining a topic in German.
- `german_proficiency` anchors: 1 = below B2 (frequent errors that block meaning), 3 = C1 (fluent, rare errors,
  register right), 5 = C2-like precision. Written from the CEFR descriptors already in `src/lib/exam/cefr-descriptors.ts`.

A school that wants a full four-skill level for a teacher can additionally send the exam side's level check
(section 8), a later step.

## 7. Testing

- Pure tests over `TEMPLATES`: each one, materialised against fake ids, gives `publishProblems(...) = []`; weights
  are whole and add up to 100; every key exists; every activity validates with `activityPayloadSchema`; choice
  questions have exactly one correct option; no text contains "—"; TR and EN are both filled.
- `createOpening` tests (fake DB, as `openings.test.ts`): TEMPLATE creates stages, links, weights; unknown key is
  refused with nothing written; reuse by seed key, by name, and the archived case; position filled only when empty;
  old start values unchanged.
- DB check script on a throw-away `*_check` database: create one opening per template, run the publish gate, expect
  only advisory rows.
- Chrome (Claude in Chrome only): one opening from each group up to "Yayınla", then the candidate flow once.
- tsc, eslint, full `pnpm test`, `pnpm build`.

## 8. Later: exam-side level tests (separate spec)

Recorded so it is not lost; the details are not designed yet.

- Three blueprints: quick screen (~15 min, adaptive grammar and vocabulary), placement (~45-50 min: grammar plus
  C-test, reading, listening, one short writing, two speaking recordings, sublevels), four-skill level check
  (~90 min, Goethe/telc shape, 60% per skill, DTZ-style decision).
- Facts checked in code on 2026-10-06: the current PLACEMENT default is 107 minutes, LEVEL_VERIFICATION 97
  (`estimatedMinutes(defaultBlueprint(...))`). Repo seed bank: 229 items; per level grammar 13, reading 11 (C2 12),
  listening 9, writing 2, speaking 3. Writing and speaking need more tasks. DB items added by teachers not counted.
- C-test as a format is not checked in code yet (maybe a `GAP_FILL` variant).
- Research sources: the agent report of 2026-10-06 (Goethe A1/B1 rules, telc B1, DTZ, onSET, Linguaskill, DET, EF
  SET). Goethe placement, telc TOP and EF bands came from search summaries only.

## 9. Not checked / for the hand-off

- An HR expert should review the questions; a German teacher trainer should review the proficiency stage. Neither
  has happened.
- The time estimates per template are not measured with real candidates.
