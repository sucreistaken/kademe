# Grading calibration, 2026-10-25

Question (owner, 2026-10-25): does the AI grade writing and speaking correctly, against fixed standards, and can A0
come out? This folder holds the answer in numbers. Everything here is produced by `pnpm grading:calibrate`
(`scripts/grading-calibration.ts`); the fixtures are in `src/lib/exam/grading-calibration/`.

## What is measured

- 85 original learner answers (61 written, 24 spoken as a recogniser's transcript with made-up but fixed word
  timings) to 12 writing and 6 speaking tasks of the starter bank, two per level where the bank has them. Each has the
  level a trained Goethe / telc rater gives it for that task (the cap included: an answer never counts for more than one
  level above its task), the flags it should get and a one line justification. Targets: 17 A0 (blank, dots only, Turkish
  or English instead of German, a few words, the task text copied back or read aloud), 13 A1, 19 A2, 13 B1, 15 B2, 7 C1
  and a single C2 (a C2 level is too thin to judge). 25 of the 85 are traps: task copied (7), over the cap (6),
  memorised template (5), off topic but fluent (3), very long but error-ridden (3), short but excellent (1).
- Every fixture goes through the real grading path (`gradeAnswer`, the function the grading job calls), three times,
  against the real model (`gemini-3.6-flash`), with no database write.
- The targets are the author's. To see whether anyone else holds them, three Claude Opus agents rated all 85 answers
  blind (task, answer, length or timing figures, the A0 and cap rules; no targets, no fixtures file, no grader output):
  they gave the target level on 84% of the fixtures and were within one level on 99% (mean difference 0.0). The 14
  fixtures where they differ are "contested" (`blind-ratings.ts`); most are the upper edge of B2 and C1 and the two
  conventions (a memorised template or an off topic text is credited less by the blind raters). The tables report
  agreement on all 85 and on the 71 uncontested ones.
- Goals set for this work: exact agreement at least 70%, within one level at least 95%, every A0 fixture A0 in every run,
  no proposal above the task cap, repeated runs agree at least 90% (pairwise, over the three runs of each fixture).

## Rounds

| round | model | settings | runs | fixtures | exact | within one | exact (uncontested) | A0 misses | above cap | runs agree (pairwise) | all runs equal | goals |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| round-0-baseline | gemini-3.6-flash | temperature default | 3 | 85 | 49.4% | 96.5% | 52.6% | 10/17 | 0 | 96.0% | 94.0% | not met |
| round-1 | gemini-3.6-flash | temperature default | 3 | 85 | 75.7% | 99.2% | 82.6% | 0/17 | 0 | 86.7% | 80.0% | not met |
| round-2a-temp0 | gemini-3.6-flash | temperature 0 | 3 | 85 | 74.9% | 100.0% | 82.6% | 0/17 | 0 | 91.4% | 87.1% | met |
| round-2b-prompt3 | gemini-3.6-flash | temperature default | 3 | 85 | 81.6% | 100.0% | 86.4% | 0/17 | 0 | 91.4% | 87.1% | met |
| round-3-prompt3-temp0 | gemini-3.6-flash | temperature 0 | 3 | 85 | 82.0% | 100.0% | 86.9% | 0/17 | 0 | 89.8% | 84.7% | not met |
| round-4-median3 | gemini-3.6-flash | temperature default, median of 3 | 3 | 85 | 81.6% | 100.0% | 86.4% | 0/17 | 0 | 90.6% | 85.9% | met |
| round-4b-replicate-of-2b | gemini-3.6-flash | temperature default | 3 | 85 | 79.6% | 100.0% | 85.0% | 0/17 | 0 | 90.6% | 85.9% | met |
| round-5-final | gemini-3.6-flash | temperature default | 3 | 85 | 83.5% | 100.0% | 87.8% | 0/17 | 0 | 92.2% | 88.2% | met |

Mean signed bias by target level (levels above the target are positive):

| round | A1 | A2 | B1 | B2 | C1 | C2 |
|---|---|---|---|---|---|---|
| round-0-baseline | +0.51 | +0.42 | +0.54 | +0.56 | +0.57 | +0 |
| round-1 | +0.26 | +0.26 | +0.1 | +0.44 | +0.43 | +0 |
| round-2a-temp0 | +0.13 | +0.26 | +0.18 | +0.38 | +0.48 | +0 |
| round-2b-prompt3 | +0.21 | +0.09 | +0.1 | +0.4 | +0.29 | +0 |
| round-3-prompt3-temp0 | +0.15 | +0.12 | +0.08 | +0.4 | +0.29 | +0 |
| round-4-median3 | +0.15 | +0.14 | +0.08 | +0.47 | +0.24 | +0 |
| round-4b-replicate-of-2b | +0.21 | +0.21 | +0.08 | +0.44 | +0.33 | +0 |
| round-5-final | +0.13 | +0.12 | +0.08 | +0.42 | +0.19 | +0 |

## What each round changed

Round 0 is the grader as it was at `72fdb20`, untouched. Rounds 1 to 5 each change what is named; "met" is the five goals
above. Rounds 2b, 4b and 5 use the same prompt text (small code changes in between, none that touch these fixtures), so
the spread between them (exact 79.6 to 83.5%, runs agree 90.6 to 92.2%) is the noise of the measurement.

- **Round 0, baseline.** Exact 49.4%, within one 96.5%, and a steady offset: the grader was one level too generous on
  about half of all answers (mean +0.4 to +0.6 on every target level from A1 to C1), the same way in every run, which is
  why repeated runs agreed (96%) and why that figure is not a virtue. It graded a flawless text of three short main
  clauses A2 ("fully accurate throughout the text without any errors"), an A2 answer with a verb-position error B1, a clean
  B2 forum post C1: errors were counted, structure was not. 10 of the 17 A0 answers were not A0: the seven that were the
  task text copied back or read aloud got A1 (the model said A0 each time, the code raised it because the pasted task is
  German), a list of single words got A1, and the two empty ones (nothing, three dots) never reached a level
  (`AI_FAILED`, no proposal). Every spoken proposal that reached the model carried `A0_RAISED`, because the guard raised
  the A0 that pronunciation (not assessable) always had. `TOO_SHORT` was raised in 44 runs on answers that were not short
  (precision 17%).
- **Round 1, rules and prompt v2.** Objective cases are decided by `grading-rules.ts` without a model: nothing written
  (EMPTY), the task text pasted or read aloud (COPIED_TASK), not German (NOT_GERMAN, by function words of English, Turkish,
  Spanish or Arabic script), a few words with no sentence (FEW_WORDS); all A0 (Pre-A1), flagged, `ai_model = 'rule'`.
  `TOO_SHORT` comes from the word count only (below half of the minimum). The A0 guard and the cap ignore a criterion
  that is not assessable. Prompt: levels are absolute and a flawless answer of A1 structures is A1; the highest level met
  consistently, the lower one when in doubt; ACCURACY at most one level above RANGE; length is not level; only the
  candidate's own language counts (copied or memorised passages do not); an off topic text gets TASK_ACHIEVEMENT A1 at
  most and its language is still graded; `overallLevel` is the lower median; descriptors carry German structure and error
  signs; one anchor answer per level. Result: exact 75.7%, A0 17 of 17, all flags 100% precise and complete. Runs
  agreed less (86.7%): the offset that had made them agree was gone and the borderline answers flipped.
- **Round 2a, temperature 0 (seeded).** Same prompt as round 1. Runs agree 91.4%, exact 74.9%.
- **Round 2b, pattern counts.** The user message carries a text-search count (subordinate clauses by type, relative
  clauses, Konjunktiv II, participles, zu-infinitives, two-part connectors, long compounds) next to the word count, the
  prompt says to read RANGE from it and not to infer a level from the absence of errors, and the RANGE descriptors no
  longer give modal verbs to A2. Exact 81.6% (from 75.7%), A2 bias +0.26 (round 1) to +0.09.
- **Round 3, 2b with temperature 0.** No gain (exact 82.0%, runs agree 89.8%, against 81.6% and 91.4% without): the
  provider default stays.
- **Round 4, median of three model answers per run** (`--samples 3`, same prompt). Exact 81.6%, runs agree 90.6%, the
  same as one answer per run, at three times the calls. The runs that still disagree are largely the same answers in
  every round (nine fixtures were unstable in at least three of the four rounds compared: memorised templates, very
  long error-ridden answers, the B1/B2 and C1/C2 edges, a clean A1 text): the model flips on a text that is between two
  levels, which sampling more does not remove. `--samples` stays in the harness and in `gradeAnswer`, not enabled.
- **Round 5, final code.** The committed code after the last small changes (typed speaking answers, forms left out of the
  copy test, a stricter few-words rule, an English word that is also German dropped from the not-German list): exact 83.5% (87.8% on the 71 fixtures a blind rater also holds), within one 100%, every A0 fixture A0
  in every run, nothing above the task cap, runs agree 92.2%.

**What is left (round 5).** 19 fixtures still differ from the target in at least one run. Contested ones (the blind
raters did not give the target either): seven B2 answers the grader calls C1 (the blind raters called three of them C1),
a C1 answer it calls C2 in one run, two very long error-ridden answers it calls B1 (the blind raters called both B1), a
memorised template it places a level below the target (the blind raters placed it lower too). Uncontested: a C1 answer it
calls C2 in every run, two clean A1 texts it calls A2, two A2 speaking answers it sometimes calls B1, two B1 answers it
sometimes calls B2. The bias that is left is upward and small (+0.1 to +0.4 per level, largest at B2); the grader is never
two levels away from a target. Flag precision and recall are 100% on all five flags, but only OFF_TOPIC (12 expected) needs
judgement; the other four are decided by rules.

## The objective side: no German at all

`scripts/simulate-placement.ts` (1000 students per cell, seeds 2026 and 7), the live templates by the engine's own
overall rule with the chance rule (`chance.ts`), writing and speaking at the true level (a grader who is right: A0), a
student who guesses everything or leaves what he does not know blank. Share of students at A0, and for a level check
the share FAIL:

| template | guess: A0 (seed 2026 / 7) | blank: A0 (2026 / 7) | FAIL |
|---|---|---|---|
| placement | 95.5 / 95.6 | 100.0 / 100.0 | - |
| quick screen | 96.0 / 95.4 | 93.4 / 94.4 | - |
| level check, claim A1 | 95.6 / 94.7 | 100.0 / 100.0 | 100 |
| level check, claim A2 | 45.8 / 45.4 | 100.0 / 100.0 | 100 |

Only the A2 claim with guessing misses the 90% A0 target (45%; documented in `docs/EXAM-ENGINE.md`, "Sonuç"); the verification
result is FAIL for every one of these students anyway.

That simulation assumes the grader is right, so it does not test what the real flow does with an empty writing and
speaking answer. `scripts/verify-no-german.ts` takes the real flow on a copy of the database: invitation, sections, closing,
`openGradings`, result computation. Before this work an empty answer was `AI_FAILED` with no level, so the skill stayed
pending and a level check stayed INCONCLUSIVE, not FAIL (`result.test.ts` pins both). Now a rule proposes A0 for it.
Ten students per case, run twice (120 students): placement and both level checks, guessing at random (typed gaps left
empty) and leaving everything blank. 118 came out overall A0; the two exceptions were students who guessed at random
and came out A1 (one in a placement, one in the A2 check). Every level check student was FAIL, the example printed for
each case waits for a teacher (`AWAITING_REVIEW`), and a recording that arrives late reopens the rule's A0 while a
teacher's decision stays.


## Files

- `round-N-*.md`: summary, confusion matrix, one line per fixture, the misses in detail with the model's reasoning.
- `round-N-*.json`: every run (levels per criterion, flags, raw model level before the code checks, rationale).
- Rerun: `pnpm grading:calibrate --label name [--runs 3] [--samples 1] [--temperature 0] [--filter text]`; the round
  table: `pnpm grading:calibrate --table`. Needs `GOOGLE_AI_API_KEY`; the provider is pinned to Gemini so that no other
  model is measured by accident.

## Limits

- The answers are written by a model (Claude) and rated by models; no human Goethe or telc rater has seen them. They show
  whether the grader is consistent with fixed standards and with an independent reader, not that the standards are the
  exams' own. A human read of the 14 contested fixtures and of ten or so answers per level is the next step.
- 85 fixtures, 12 + 6 tasks: a level shows 10 to 20 times, a trap a few times. Percentages move by a point or two between
  identical runs (rounds 2b and 4b are the same configuration).
- Spoken answers are transcripts with synthetic timings; real recognition errors, real pauses and pronunciation are not
  tested. Picture tasks are not in the set.
- Tuned on this set, measured on this set. The rules in `grading-rules.ts` were written knowing the A0 fixtures; they are
  also tested on cases written afterwards (`grading-rules.test.ts`) and on every German text of the starter bank, but a
  fresh set would be the honest test of the prompt.
