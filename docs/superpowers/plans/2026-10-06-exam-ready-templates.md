# Exam Ready Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A school starts an exam from one of three ready, research-based blueprints (quick screen, placement, four-skill level check); the seed bank grows so they publish; placement results show a sublevel and flag borderline students for a teacher.

**Architecture:** Typed exam templates in `src/lib/exam/templates.ts` (zod-valid `BlueprintConfig` per template), picked on `/exam/exams/new` and passed to `createBlueprint`. Bank growth is seed data plus an idempotent top-up script for existing organisations. Sublevel and borderline are pure functions over the pooled posterior, stored on the computed result and shown in the student result view.

**Tech Stack:** Next.js 16.3.4, React 19, drizzle-orm, zod 4, next-intl, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-hiring-ready-templates-design.md` section 8 (exam side), research facts below. User approval 2026-10-06: "hepsini hallet, getirilecek tüm özellikleri direkt".

## Global Constraints

- Read `AGENTS.md`; read `node_modules/next/dist/docs/` before any Next API the touched files do not already use.
- Never the em-dash (U+2014) anywhere (code, copy, comments, commits, seed content; `bank-seed.test.ts` checks the bank).
- Code, comments, commits in English; manager copy in Turkish "sen" form plus English, keys in both message files (parity test). German items: correct standard German.
- Existing defaults (`defaultBlueprint`) and existing blueprints keep their behaviour; existing tests pass.
- Never touch the DBs `kademe` or `kademe_platform`, production or the VM; DB checks only on `*_check` databases.
- Gates per task: `pnpm exec tsc --noEmit` (run `pnpm exec next typegen` first in a fresh worktree), `pnpm exec eslint src scripts`, the task's tests. Branch `platform/solutions`, never main.
- Verified research facts (only these may be stated as exam facts): Goethe-Zertifikat B1 four modules, 60/100 per module, modules separately; telc Deutsch B1 60% in written and oral part separately; placement tests of Goethe/telc/onSET/Oxford run about 30-45 minutes; EF SET: placing too high is worse than too low; DTZ and Goethe use a second look for borderline productive results.

## Research blueprint (binding numbers)

| Template key | Mode | Sections (minutes, items) | Notes |
|---|---|---|---|
| `quick-screen` | PLACEMENT | GRAMMAR adaptive 15 min, minItems 15, maxItems 30, targetSe 0.5; all other sections disabled | "Hızlı seviye taraması" for a first talk with a course advisor; result visibility OVERALL, autoRelease true, proctoring the lightest preset that exists |
| `placement` | PLACEMENT | GRAMMAR adaptive 12 min (10-16, SE 0.45); READING adaptive 12 min (5-8, SE 0.55); LISTENING adaptive 12 min (5-8, SE 0.55); WRITING 1 task 10 min; SPEAKING 2 tasks 6 min | ~52 min; "Yerleştirme sınavı" for class placement; visibility OVERALL, autoRelease false (teacher confirms) |
| `level-check` | LEVEL_VERIFICATION | READING 25 min fixed RELATIVE 2/6/2; LISTENING 20 min 2/5/2; GRAMMAR 15 min 3/6/3; WRITING 2 tasks 25 min; SPEAKING 2 tasks 12 min | ~97 min, Goethe/telc shape; passRules overallAtLeastClaimed true, minSkillOffset -1, requiredSkills ["SPEAKING"], minHoldProbability 0.5; visibility FULL after release |

Every template must pass `blueprintConfigSchema` and `bankCoverage` against the grown seed bank.

---

### Task E1: Exam templates and the template picker

**Files:** Create `src/lib/exam/templates.ts` (+ `templates.test.ts`); modify `src/app/(manager)/exam/exams/new/page.tsx`, `src/app/(manager)/exam/exams/actions.ts` (`createBlueprint`), message files.

- `EXAM_TEMPLATES: Array<{ key; mode; name: I18nText; summary: I18nText; config: BlueprintConfig }>` with the three rows above; `examTemplateByKey(key)`.
- The new-exam page shows three template cards first (name, summary, mode, `estimatedMinutes`, enabled sections), the first marked "Önerilen", then the existing blank start (mode radio). Reuse the hiring panel look (`ChoiceCardGroup look="panel"`) if the page can; no new props on shared blocks.
- `createBlueprint` accepts an optional `template` form field: when present and known, the blueprint takes the template's name (unless the manager typed one), mode and config; unknown key returns the existing error path. Blank start unchanged.
- Tests: each template validates with the schema; `bankCoverage` passes against counts built from `SEED_BANK` (this will only pass after E2 adds writing tasks for `level-check`'s 2 writing tasks; until then mark that one assertion with the needed count and let E2 make it pass, or build E1 after E2's counts; coordinate via the controller); the action picks the template config; blank start unchanged.

### Task E2: Grow the seed bank and top up existing organisations

**Files:** `src/db/seed-bank/writing.ts`, `speaking.ts`, `grammar.ts` (C-test items), `src/db/seed-bank/bank-seed.test.ts`, new `scripts/bank-topup.ts` + `package.json` script `bank:topup`.

- Writing: from 2 to 4 tasks per level (A1-C2), each with contentPoints and register in the existing `task()` shape, level-appropriate (A1 short message, C2 argumentative text).
- Speaking: from 3 to 4 tasks per level.
- C-test: one GAP_FILL item per level in GRAMMAR, a short coherent German text (first and last sentence intact, second half of every second word missing, about 15-20 typed gaps `Wo{{g1}}` with the completion as the accepted answer, accept common spelling variants where they are equally correct). Skill tag `grammar.ctest`.
- `bank-seed.test.ts`: raise minimums to writing >= 4, speaking >= 4 per level; one C-test per level with >= 15 gaps.
- `scripts/bank-topup.ts`: for one organisation (`--org <id>` or all orgs), insert seed items and stimuli that the org does not have yet, matched by a stable key (add `seedKey` to items if the items table has none: check `src/db/schema/exam.ts`; if a migration is needed, write it with drizzle-kit in the project's migration style and say so in the report). Idempotent: a second run inserts nothing. Refuses non-`*_check` databases unless `--allow-working-db` is given (reuse `src/db/working-db-guard.ts`).
- Check on a throw-away `kademe_bank_check` DB: seed, run top-up twice, counts grow once.

### Task E3: Placement sublevel and borderline review

**Files:** `src/lib/exam/cefr.ts` or a new `src/lib/exam/placement.ts` (+ tests), `src/lib/exam/result.ts` (+ tests), the student result view under `src/app/(manager)/exam/students/[id]/` and its message keys.

- `sublevelOf(theta)`: within the level band from `CUTS`, lower half = `.1`, upper half = `.2` (A1.1 ... C1.2; C2 has no split). Only for PLACEMENT, only from the pooled objective posterior.
- `borderline`: true when the pooled posterior's mean is within 0.25 logits of a cut, or its sd > 0.6, or a productive skill differs from the objective level by >= 1 band. When borderline, the recommended class is the lower of the two candidate levels ("emin değilsek alta yerleştir") and the view says "Sınırda: kısa bir öğretmen görüşmesi önerilir".
- `ComputedResult` gains optional `placement: { sublevel: string | null; borderline: boolean; reasons: string[] } | null`; LEVEL_VERIFICATION unchanged; old stored results without the field still render.
- Tests: band edges, C2, borderline triggers, verification untouched.

### Task E4: Gates, DB check, Chrome, hand-off

- tsc, eslint, full `pnpm test`, `pnpm build`.
- DB: on a throw-away DB create each template blueprint and publish it (coverage passes).
- Chrome (Claude in Chrome, own server on a `*_check` DB): new exam page shows the three templates; create the placement exam; publish.
- STATUS section, memory, ledger.
