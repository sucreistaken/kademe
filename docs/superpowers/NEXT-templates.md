> DONE 2026-10-06: built by plan `docs/superpowers/plans/2026-10-06-hiring-ready-templates.md`; see the
> "Hazır işe alım şablonları" section in docs/STATUS.md and the ledger. This file is kept as the original brief.

# Next session: ready hiring templates (read this first)

Written 2026-10-06 by the local session, right before the user cleared the context. Branch
`platform/solutions` (pushed, HEAD 32c1ddb or later). `main` is production (739f218); nothing here is merged
or deployed.

## What the user asked for (their words, then the meaning)

- "hazır gerçekten çalışan yetkin şablonlar koyabilir misin", "ikisi birden, daha fazla yapabilirsin,
  ihtiyaç görecek, kur, sorularını iyi analiz et, iyi yap, oradaki gerçekten çalışsın", "düzgün olsun,
  gerçekten ölçsün, ayarla, doldur, hazır hale getir".
- Meaning: a manager opens an opening with **"Hazır şablondan başla"**, picks a role, and gets a real,
  publishable assessment: stages, questions of the right types, time limits, competencies linked to each
  question, scorecard anchors (1/3/5), expected behaviours and red flags for the team. Nothing left empty.
  It must measure the role, not be filler.
- Roles: generic ones AND language-school ones, more if useful. Minimum set:
  - Generic: Müşteri Destek Uzmanı, Satış Temsilcisi, Çağrı Merkezi Temsilcisi, Muhasebe Uzmanı,
    Yönetici Asistanı, Yazılım Geliştirici, Mağaza Satış Danışmanı, Depo ve Lojistik Sorumlusu.
  - Language school: Almanca Öğretmeni, Kurs Danışmanı (satış ve kayıt), Öğrenci İşleri / Kayıt Sorumlusu,
    Eğitim Koordinatörü.
  - Consider adding (judge need): İnsan Kaynakları Uzmanı, Pazarlama Uzmanı, Ürün Tasarımcısı, Saha Satış.
- Less AI (user rule): templates are the recommended start; AI stays a plain option, no sparkles/badge.
- Order already agreed: panel restyle first (DONE, plan `docs/superpowers/plans/2026-10-06-manager-panel-visual.md`),
  templates now.

## What exists to build on (verified in code 2026-10-06)

- Start choices are one data list: `src/components/hiring/start-choices.ts` (COPY, AI, BLANK). The template
  card is one more entry; mockup frame 4 shows it first with "Önerilen", frame 4b is the template gallery
  (`docs/design/hiring-manager-mockup.html`).
- Opening creation: `createOpening` in `src/solutions/hiring/server/openings.ts:151`; COPY resolves a source
  version and copies it (`sourceVersionId`, `inheritedSettings`). A template start needs the same result
  from in-code content instead of a source opening. `createOpeningAction` currently accepts
  `start: "AI" | "COPY" | "BLANK"`; adding `"TEMPLATE"` + `templateKey` is a server change: write it with
  tests, keep old values working.
- Activity types (pg enum `hiring_activity_type`, `src/db/schema/enums.ts:117`): VIDEO, AUDIO, LONG_TEXT,
  SHORT_TEXT, SINGLE_CHOICE, MULTI_CHOICE, FILE_UPLOAD. Activity columns (`hiring_activities`): prompt (tr/en),
  note, internal_question, expected_behaviours, red_flags, manager_notes, answer_examples, think_seconds,
  flexible_think, answer_seconds, max_takes, config, plus competency links (`hiring_activity_competencies`).
- Competency library: 8 starter competencies with 1/3/5 anchors in `src/db/library-seed-data.ts`
  (communication, problem_solving, initiative, commercial, technical, organisation, teamwork, customer).
  Templates should reuse these keys and add role-specific ones only when needed (e.g. teaching/didactics,
  German language level, accuracy for accounting), each with real 1/3/5 anchors in TR and EN.
- Publish gates (`STRUCTURE_PROBLEMS`, `ANCHOR_PROBLEMS`, `WEIGHT_PROBLEMS`, readiness rows in
  `src/app/(manager)/hiring/openings/[id]/readiness.ts`): a fresh template opening must pass all of them
  (only team and preview may stay "Önerilir"). Test this end to end.
- AI key: one Google AI key, `GOOGLE_AI_API_KEY` in local `.env` (works, checked with a real
  `gemini-3.6-flash` call). Templates must NOT depend on AI at runtime; AI may help draft content offline,
  but every question is reviewed and written into the repo.

## Quality bar for the content ("gerçekten ölçsün")

- Structured-interview practice: behavioural ("Son ... bir durumu anlat: ne oldu, sen ne yaptın, sonuç ne
  oldu?") and situational questions, each tied to 1-2 competencies; one realistic work sample per role where
  possible (e.g. reply to an angry customer email, a short accounting check, a mini lesson plan or a
  recorded 2-minute teaching moment for the German teacher, a call-centre roleplay by audio).
- Every question: clear prompt TR and EN, the right type and timing (think/answer seconds, takes),
  2-4 expected behaviours, 1-3 red flags, the competencies it measures. Choice questions have one correct
  answer and plausible distractors.
- 2 stages per role where it helps (short screen, then deeper work sample), ~15-30 minutes in total.
- No discriminatory or illegal questions (age, family, religion, health, etc.); "sen" form; never the
  em-dash character.
- Ask for an HR expert's review in the hand-off; say what was not checked.

## How to run it (project rules)

1. Brainstorm briefly (superpowers:brainstorming) only for the open design choice: where templates live
   (code module `src/solutions/hiring/templates/` with typed data + a loader vs DB rows) and how
   `createOpening` materialises them. Recommendation: typed TS data in the repo, materialised inside
   `createOpening`'s transaction, reusing the COPY path's version/activity writers.
2. Write the plan (superpowers:writing-plans), then run it with superpowers:subagent-driven-development
   (ledger, per-task review, final whole-plan review). Content tasks can be batched by role group.
3. Build the template card (first, "Önerilen") and the gallery step (mockup 4b) in the new-opening flow;
   the gallery shows role, stages, questions, minutes, competency chips, "Önizle".
4. Verify: tsc, eslint, full `pnpm test`, `pnpm build`; DB scripts on a throw-away `*_check` database
   (`verify:hiring-setup` etc.); in the user's Chrome (Claude in Chrome only) create an opening from each
   template group, check it reaches "Yayınla" with only advisory steps left, and take the candidate flow
   once.

## Rules that bind (user + project)

- Chat in Turkish; code, comments, commits in English; never the em-dash.
- Verify before claiming; show command output; separate seen from inferred.
- Commit and push on `platform/solutions` without asking; never `main` or production without the user's yes.
- Never touch the shared DB `kademe`, production or the VM. Use `kademe_platform` / throw-away `*_check` copies.
- Browser checks only with Claude in Chrome. On this machine the Chrome window does not shrink with
  resize_window (viewport stays 1440 wide); screenshots sometimes tile 2x2, use the zoom action or JS reads.

## Other open items (not this task, keep in mind)

- Second-screen proctoring fix for the LIVE exam is on branch `hotfix/second-screen` (worktree
  `../recruitement-proctor`, commit bec75f8, off main). Unit tests pass; waiting for the user's real test
  (STRICT blocks a second monitor at the check; the user's live bypass is still unexplained, ask how they
  did it). Its throw-away DB `kademe_proctor_check` and a dev server on 3200 may still be running.
- Plan 2b local checks (STATUS item 26: DB gates incl. `verify:hiring-flow`, leak scan, axe, keyboard tour)
  are still not run.
- Running locally right now (may be stale after a reboot): dev server 3100 on `kademe_ui_check`,
  mockup server 3999. Drop `kademe_ui_check` / `kademe_proctor_check` when done.
- The user pasted the Google AI key in chat; suggest rotating it later.
