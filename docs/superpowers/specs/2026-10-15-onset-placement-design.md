# onSET-style placement: design

Date: 2026-10-15. Branch `platform/solutions`. Status: approved in chat by the user ("Onaylıyorum"), spec for review.

## 1. Goal

The user wants the exam to work the way professional German tests work, so that a student has to really know
the language instead of picking the right option. This spec covers the first of two sub-projects: the
**placement** exam, modelled on onSET (C-test) and the Goethe-Institut placement test. The second sub-project,
a level check in the Goethe-Zertifikat module and Teil layout, gets its own spec after this one ships.

Today 292 of the 318 objective bank items are select-from-options; only 20 typed gaps and 6 C-tests make the
student produce the answer. The placement form opens with one B1 C-test and then 18 multiple-choice grammar
items.

## 2. Decisions (user, 2026-10-15)

- Both sub-projects, placement first.
- Speaking stays as it is: the task appears on screen, the student records an answer. No live interview.
- Placement shape: "onSET + Goethe". The multiple-choice grammar block is replaced by six C-tests, one per
  level A1 to C2, easy to hard. Reading, listening, writing and speaking stay.
- One section timer for the C-tests (30 minutes) with a "about 5 minutes per text" hint, not a hard per-text
  timer. The student may move between texts like in any other fixed section.
- The quick screen also becomes C-test only, gated by simulation (section 7).

## 3. Research basis

- **onSET-Deutsch** (g.a.s.t.): eight C-test texts, 20 gaps each, exactly 5 minutes per text, 40 minutes in all;
  first and last sentence intact, the second half of every second word deleted; reports A2 to C1.
  Secondary (search summaries of these pages, PDFs not read in full): [FU Berlin test info](https://www.sprachenzentrum.fu-berlin.de/downloads/testinfo-onset-de-en.pdf),
  [Uni Hamburg](https://uni-hamburg.de/en/allgemeinsprachen/sprachtests/onset.html).
- **Goethe-Institut placement test**: adaptive, 70 tasks of reading (vocabulary and grammar included) and
  listening, at most 60 minutes; a talk with a teacher can follow to refine the level.
  Secondary (search summary of goethe.de institute pages, not read in full), e.g.
  [Goethe-Institut Athen](https://www.goethe.de/ins/gr/de/sta/ath/kur/tst.html).
- **C-test scoring**: professionally each text is a "super-item" scored as the number of correct gaps and
  analysed with a polytomous Rasch model (rating scale or partial credit), which handles the local dependence
  between gaps of one text. Secondary (search summary): [Eckes 2011, PTAM](https://www.gast.de/fileadmin/gast.de/GAST/4_PDF/2-Forschung-Entwicklung/Publikationen/Eckes_PTAM_2011-4.pdf).
- Neither test has a separate multiple-choice grammar block.

## 4. Student-facing shape

**Yerleştirme sınavı (placement)**

| Section | Today | New |
|---|---|---|
| GRAMMAR | 1 B1 C-test + 18 MC items (3 per level), 17 min | 6 C-tests (A1, A2, B1, B2, C1, C2), 30 min |
| READING | 4 texts A2-C1, 18 min | unchanged |
| LISTENING | 3 clips A2-B2, 13 min | unchanged |
| WRITING | 1 task, 10 min | unchanged |
| SPEAKING | 2 tasks, 6 min | unchanged |
| Total | about 64 min | about 77 min |

The GRAMMAR section intro tells the student: six short texts, from easy to hard, about five minutes each, type
only the missing letters. The template summary text (TR and EN) is updated to the new length and shape.

**Hızlı seviye taraması (quick screen)**: GRAMMAR only, 3 C-tests (A2, B1, B2), 15 minutes, if section 7 passes.

Existing exams keep their stored config: templates are copied when an exam is created.

## 5. Engine

### 5.1 Config

`sectionConfigSchema` gains `cTestLevels: Cefr[]` (optional, GRAMMAR only, no duplicates). When present it
replaces the single opening C-test: the section serves one C-test per listed level. The old `cTest: true`
keeps its meaning when `cTestLevels` is absent, so stored configs stay valid. A GRAMMAR section whose
distribution is all zeros and which has `cTestLevels` is a valid pure C-test section.

### 5.2 Plan

`planFixedSection`: for each listed level, one C-test picked at random from the bank at that level, ordered by
level (easy to hard), followed by the regular form (empty for the new templates). A level with no C-test in the
bank is skipped, as the single opening is today. In an adaptive section the listed C-tests are served first, in
the same order, before the engine picks; the engine still never picks a C-test.

### 5.3 C-test weight in the estimate

Today one C-test enters the EAP as a single fractional observation, so a 20-gap text weighs as much as one
multiple-choice item. With six C-tests and no other grammar items the GRAMMAR estimate would rest on about six
observations instead of nineteen.

`Observation` gains an optional `weight` (default 1); the log-likelihood term is multiplied by it. A C-test's
weight is its gap count divided by 4 (a 20-gap text weighs 5). This approximates the super-item treatment:
more than one item, less than 20 independent ones, because gaps of one text are not independent. The divisor is
an uncalibrated choice, documented in `docs/EXAM-ENGINE.md`, to be replaced by a partial credit model once real
data exists. One helper builds an observation from a stored item snapshot and score, and every place that builds
observations (`replay`, the section close paths in `exam-flow.ts`, `reestimate-run.ts`, the trajectory writer)
uses it, so the weight cannot be forgotten in one of them.

### 5.4 Coverage, labels, review

- `bankCoverage` asks for one C-test at each listed level.
- The item count label (`itemsLabel`) counts the listed C-tests.
- The exam review screen lists a missing C-test per level, as it does for the single opening today.
- No new editor control: the templates set `cTestLevels`; the editor keeps it when other fields change.

## 6. Content

Twelve new C-tests, two per level, written with the existing `cTest()` builder (`src/db/seed-bank/ctest.ts`),
so every level has three and students of one cohort do not all get the same text.

- 70 to 100 words (A1 may be shorter), about 20 gaps, first and last sentence intact.
- Neutral everyday or work topics from the DTZ Handlungsfelder; no culture-specific trivia, no upsetting topics
  (research doc, section 3).
- Original wording; nothing copied from Goethe, telc, onSET or publishers.
- `within: "MID"`, like the existing six.
- Reach production through `pnpm bank:topup` (adds new seed items to every organisation).
- Not reviewed by a native German teacher; they carry the existing starter-content label.

## 7. Quick screen gate

Before changing the quick screen, measure today's quick-screen form and the C-test-only form with the same
simulation. The new form ships only if, at every level A1 to C1, exact placement is not lower and within-one is
not lower than today's. Otherwise the quick screen stays as it is and the numbers are recorded in
`docs/EXAM-ENGINE.md`.

## 8. Verification

- Unit tests: config schema (valid lists, rejected duplicates, `cTestLevels` outside GRAMMAR); plan order and
  skipping of missing levels; weighted EAP (weight 1 equals today; weight 5 equals five copies); every
  observation path uses the weight; coverage rows; bank seed counts (3 C-tests per level).
- Simulation in `templates.test.ts`: the placement form with six weighted C-tests, students spread across each
  band, and a text-level random effect (sd 0.5 logit) so that gap dependence does not flatter the result. Gate:
  not worse than today at A1-C1 (exact 68-80%, within one 99-100% in the long run), as for section 7.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Local browser run in Chrome (Claude in Chrome): create a placement exam from the template, take the GRAMMAR
  section with six C-tests, close it, see the result and the teacher's per-gap view.

## 9. Rollout

Code to `main` and the VM as in `docs/STATUS.md`; then `bank:topup --production` for the twelve new texts. No
migration: `cTestLevels` lives in the JSON config. Existing exams are unchanged; a school that wants the new
shape creates a new exam from the template.

## 10. Out of scope

- Goethe-format level check (next spec).
- Hard per-text timers.
- New item types (yes/no vocabulary with pseudowords, dictation).
- Native-teacher review of the bank and a real partial credit calibration; both need people or data, not code.
