# SDD ledger, plan: docs/superpowers/plans/2026-10-06-exam-ready-templates.md
BASE: 86e81f3
Ruling: plan written at requirements level (no full code) because the user asked for speed; reviews carry the quality bar. Cost if wrong: more review rounds.
Chrome check of the hiring AI draft (2026-10-06, :3102 on kademe_ui_check): ilan metni -> Önerileri üret -> real Gemini suggestions in 21 s with quotes and 1/3/5 examples -> accepted one -> builder shows the stage and the video question.
E3: implementer 58ed5e1 (worktree), cherry-picked without conflict. Controller: vitest exam/server/app exam/i18n 259/259, tsc 0. Review (opus): Approved, 0 Critical/Important.
E3: minor (deferred): borderline advice keeps showing after FINAL or an overall override; no test for a mean exactly at a cut or exactly 0.25 away.
E3: open product question for the user: a two-band productive gap lowers the recommendation two levels (plan literal); alternative cap at one level below the objective level.
E3: complete.
E1: implementer 1f0465b (worktree), cherry-picked without conflict. Controller: vitest exam/server/app exam/i18n/components 1021/1021, tsc 0. Ruling: quick-screen uses STANDARD proctoring (not OFF): a screen still needs some integrity signal. Cost if wrong: one preset value. Review dispatched (opus).
E1: review (opus): Approved, 0 Critical/Important; template numbers match the research table exactly.
E1: minor (deferred): unused exams.namePlaceholder key; no render test for NewExamForm; blank-start name now capped at 120 chars (same as saveBlueprint).
E1: complete (795f505).
E2: implementer 06b0df2 (worktree), cherry-picked as 3b4e3d6 without conflict (bank 229 -> 253, C-tests computed by ctest.ts, items.seed_key migration 0014, idempotent top-up; agent's check DB run: +24 then +0). Controller: full suite first run 1 failure (boundary.test.ts: new src/server/bank-topup.ts not listed as an exam module); controller fixed the list (20a4688), full suite 241 files 3032/3032.
E2: review (opus): Needs fixes, 3 Important: C-test served in ~90% of adaptive GRAMMAR runs and eats 12-15 min sections; whole-word answers score 0 with a detached input; two missing correct variants (C1 "nommen", C2 "chätzung").
Ruling: C-tests never enter automatic selection; a GRAMMAR flag `cTest` serves one C-test first at the anchor level (onSET-style routing); placement enables it with GRAMMAR 17 min (total 57). Cost if wrong: one more blueprint field.
Ruling: the top-up stays local-only; running it on production (and deploying migration 0014) is a separate user decision. Until then production keeps 229 items.
E2: fix round 1 dispatched.
E2: fix round 1 (commits d5ba666, da92619, 144fc4d): C-tests out of automatic selection, `cTest` opening flag, placement GRAMMAR 17 min (total 57), whole-word answers accepted, input attached to the stem, two variants, minors. Re-review (opus): all addressed, no new Critical/Important; minors: attached gap with choices would lose its stem, itemsLabel counts the opening even without a C-test, bank page coverage table still counts C-tests as items, no editor toggle for cTest.
E2: complete.
E4 (controller): pnpm test 242 files 3055/3055; tsc 0; eslint 0; pnpm build exit 0 (worktree at 144fc4d); verify:exam on a fresh seeded kademe_exam_check: 24 ok, 0 FAIL, "All checks passed"; bank there 253 items, 253 with seed_key, 6 C-tests. Chrome (:3102 on kademe_exam_check): /exam/exams/new shows the 3 templates (15 / 57 / 97 min) and the blank start; created and published all three (DB: PUBLISHED; placement GRAMMAR cTest true, 17 min); editor said "Tüm bölümler için bankada yeterli soru var".
Not done: a student taking the placement exam with the C-test in a browser; the whole-plan final review (per-task reviews and re-reviews only, user asked for speed); production rollout of migration 0014 and the top-up (needs the user's decision).
Open product question: a two-band productive gap lowers the placement recommendation two levels (E3).
PLAN COMPLETE.
