# Handoff: continue plan 2b (hiring visual flow) in a new session

Written 2026-10-06 by the local controller session. Read this file first, then the ledger.

## Where things stand

- Branch `platform/solutions` (pushed to origin). `main` is production (739f218, the exam hotfix); `main` is
  already merged INTO this branch; nothing on this branch is merged to `main` or deployed.
- Plans done and reviewed: plan 1 (hiring library + openings), plan 2 (hiring candidate flow, final fix wave included).
- Plan in progress: **plan 2b, `docs/superpowers/plans/2026-10-06-hiring-visual-flow.md` (22 tasks)**.
  Design authority: `docs/design/HIRING-VISUAL-FLOW.md` v3 (user decisions K1-K8; the plan header adds K9-K11).
- Ledgers (every ruling, carry and benchmark note; binding, they override plan text):
  - `docs/superpowers/ledgers/2026-10-06-hiring-visual-flow/progress.md` (plan 2b; read it fully)
  - `docs/superpowers/ledgers/2026-10-06-hiring-visual-flow/preflight.md` (C1-C21)
  - `docs/superpowers/ledgers/2026-10-05-hiring-candidate-flow/progress.md` and `final-fix-findings.md` (plan 2)
  - `docs/superpowers/ledgers/2026-10-04-hiring-library-openings/progress.md` (plan 1)
  A task is done only when its ledger has a `Task N: complete` line. The next task is the first without one.

## How the work is run (superpowers:subagent-driven-development)

Per task: extract the brief (`task-brief PLAN N`), dispatch one implementer with the brief path plus the binding
ledger rulings and carries for that task, then a task review, fix rounds (resume the same implementer), a scoped
re-review, then the ledger line `Task N: complete`. After all tasks: one whole-plan review on the most capable
model and one fix wave. Verify every implementer claim yourself (git log, git status, full vitest run with a
name-by-name comparison to the previous run, file reads) before reporting it.

## Rules that bind every step (user rules in ~/.claude/CLAUDE.md of the user plus project memory)

- Chat with the user in Turkish; code, comments and commit messages in English. Never the em-dash character.
- Verify before claiming; separate what you saw from what you infer; report failures with output.
- Browser checks ONLY with Claude in Chrome in the user's own Chrome (never Playwright). A cloud session has no
  access to the user's Chrome: record browser checks as "doğrulanmadı" and leave them for a local session.
- Never touch the shared local DB `kademe`, production, Neon or the VM. Work DB is `kademe_platform`; use
  throw-away `*_check` copies for scripts and browser checks; drop them after. Pass `DATABASE_URL` explicitly to
  every verify/dev script. Never `pnpm db:seed` / `db:reset` on kademe or kademe_platform. Never write `.env`.
- Never `git checkout/switch/stash/reset`; exact-path `git add` only (never a directory); never push or merge
  to `main` without the user's explicit yes; migrating the shared DB and the production rollout happen only at
  the very end, with approval.
- Log in to the app only through /login with the seed password; never mint sessions or set cookies by script.
- Never PROCTOR_DEV_FAKE.
- The live language exam must not change behaviour; any shared file change needs before/after proof.

## Environment notes for a cloud session

- Gates that need no database: `pnpm exec tsc --noEmit`, `pnpm exec eslint src scripts`, `pnpm test`, `pnpm build`.
- `verify:exam`, `verify:hiring-flow`, `verify:guard` need PostgreSQL 17 with the branch schema (migrations
  0000-0013). Locally it runs in Docker (`kademe-db` on port 5434, user/password `kademe`). If the cloud
  environment cannot run Postgres, say so in each report and mark those gates "doğrulanmadı".
- Last verified suite: see the newest `Controller:` line in the plan 2b ledger.

## Open items to keep in mind

- User decisions of 2026-10-05/06 are recorded at the bottom of the plan 2b ledger (desktop-only hiring flow,
  "sen" on shared panel screens, Today next-task order, data-rights handling waits for plan 3, ElevenLabs stays).
- Benchmark list (real devices, camera, VoiceOver, Safari) is in docs/STATUS.md and the ledgers; it is done
  with the user at the end.
