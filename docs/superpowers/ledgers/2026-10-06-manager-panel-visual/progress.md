# SDD ledger - plan: docs/superpowers/plans/2026-10-06-manager-panel-visual.md
Spec: docs/design/hiring-manager-mockup.html (look) + docs/design/HIRING-VISUAL-FLOW.md section 4 (behaviour). Branch platform/solutions, main checkout (no worktree; same as plan 2b, user allows commits/pushes on this branch).

## Pre-flight scan
| Pair / task | Shared file or interface | Finding |
|---|---|---|
| T1 -> T3, T4, T8 | ChoiceCardGroup look="panel"/"panel-lg", ChoiceItem.tone "new", IconTile | T1 produces, others consume; names agree in plan text |
| T1 -> T5, T6 | IconTile, positionIcon | consistent |
| T2 -> T3, T4, T8 | FlowStep.illustration / aside, StepScreen illustrationSize "flow" | consistent |
| T3 + T4 | new-opening-form.tsx, hiring.*.json | sequential edits of one file; T4 runs after T3, no conflict |
| T5 | dashboard/page.tsx, next-task-card.tsx | exam rows must stay; plan pins the exam test unchanged |
| T6 | control-row.tsx, empty-state.tsx (frozen default), openings/page.tsx | consistent |
| T7 | path-steps.tsx (frozen default), [id]/page.tsx | consistent |
| T9 | copy-field.tsx (useCopyValue extract), invite-form.tsx | consistent |
| T4 self | text says "preselection rule stays (AI when ad)" | conflicts with controller R1 (plan addendum) |
| every task | hiring.tr/en.json key parity | messages.test.ts guards |

Ruling: R1 refined: on the start step nothing is preselected from the job ad; `?copy=` still preselects COPY (explicit intent from a copy link); with no pick, "Devam et"/"Alımı oluştur" waits with a new reason "Nasıl başlayacağını seç." / "Pick how to start." (both files) - user asked for less AI - cost if wrong: one extra click per opening, easy to revert.
Ruling: R2 deviations accepted as listed in the plan's addendum - they follow product rules (no amber, shared PanelHeader) - cost if wrong: small visual diffs vs mockup.
BASE T1: 7556a45 (implementer a1f712d35e2308b0e, sonnet)
Task 1: implementer DONE_WITH_CONCERNS 23a4327 (2802 tests, 227 files). Review (sonnet): spec ok, Approved, 0 Critical/Important.
- ⚠️1 resolved by controller: choice-card.tsx diff changes 3 lines (import, ChoiceItem type split, grid class now `look === "default" ? "grid gap-2" : "grid gap-3"`), default output identical, and the frozen test passes against it, so the capture equals the pre-change default.
- ⚠️2 carried to Task 10 browser check: `group-has-[:checked]/choice:bg-surface` actually turns the tile white when a panel card is selected.
Task 1: minor (deferred): orphaned G6 JSDoc now sits on PanelChoice, ChoiceCardGroup has none; test comment says captured at dd1f34e (was 7556a45); panel tests miss disabled/tone-new-string/panel-lg mt-1 cases; positionIcon substring matches can misfire (presentation only); ring colour hard-coded rgb (plan-mandated).
Task 1: complete (commits 7556a45..23a4327, review clean)
BASE T2: 23a4327
Task 2: implementer DONE 5b475e0 (2805 tests, 228 files). Review (sonnet): spec ok, Approved. ⚠️ trailer: controller attribution (Opus 5.5) is correct for this session. ⚠️ aside in single: controller read step-screen.tsx:54, aside is in the shared head, drawn in both layouts.
Task 2: minor (deferred): guided-flow test not seen red first; Sheet aside only containment-tested; flow size tested only in split layout.
Task 2: complete (commits 23a4327..5b475e0, review clean)
BASE T3: 5b475e0
Task 3: implementer DONE 6845807 (2809 tests). Review (opus): spec ok, Approved, 0 Critical/Important. ⚠️ browser look carried to Task 10 (dashed new card, radio at right, name field on "Yeni bir pozisyon", typed library name + Devam et goes to start).
Task 3: minor (deferred): PositionOption.weightsEqual + server distinctWeights now dead data; no interaction tests for NEW/nameDraft/filter (SSR-only by brief); search Input lacks maxLength. Commit trailer of 6845807 says Sonnet (not amended, history kept).
- Carry to Task 4: start-step summary must use the trimmed new name ((newName ?? "").trim()).
Task 3: complete (commits 5b475e0..6845807, review clean)
BASE T4: 6845807
Ruling: T4 fallback: when AI was chosen and the ad is removed, start becomes null (wait 'Nasıl başlayacağını seç.') instead of silently BLANK - consistent with R1, no silent choice - cost if wrong: one click; revert is the 'effective' line in new-opening-form.tsx.
Task 4: implementer DONE_WITH_CONCERNS b7bb605 (2814 tests). Review (opus): Needs fixes, 1 Important: AI start only hidden (not cleared) when the ad goes away, so it is re-selected when the ad returns and dirty is wrong.
Task 4: minor (deferred): last-step and wait tests render the same input (could merge); pill check icon shows before the start is chosen; defensive `?? null` in onChange.
Task 4: fix round 1/5 (1 addressed, 0 open; commit 7b35538). Re-review (sonnet): addressed, no new breakage.
Task 4: minor (deferred): render-phase reset in the form is covered only through the pure helper startAfterAdChange.
Task 4: complete (commits 6845807..7b35538, review clean after 1 fix round)
BASE T5: 7b35538
Task 5: implementer DONE 4ee2be7 (2817 tests). Controller: exam block "live exam" 5/5 passed, diff hunks only in "hiring's rows on Today". Review (sonnet): Approved, 0 Critical/Important.
Task 5: minor (deferred): next-task test regex alternation is weak (filled()==1 covers it); solution chip hidden below sm; red step skipped.
Task 5: complete (commits 7b35538..4ee2be7, review clean)
BASE T6: 4ee2be7
Task 6: implementer DONE 460335a. Controller: full pnpm test at 460335a, 229 files / 2822 tests passed. Review (sonnet): Approved, 0 Critical/Important.
Task 6: minor (deferred): funnelShare in opening-next-step.ts now unused (dead export + test); row tile hidden below lg (unstated); "Kurulumda\n1" assertion whitespace-fragile.
Task 6: complete (commits 4ee2be7..460335a, review clean)
BASE T7: 460335a
Task 7: implementer DONE 39393ae. Controller: full pnpm test at 39393ae 230 files / 2825 passed. Review (sonnet): Approved, 0 Critical/Important.
Task 7: minor (deferred): the setup section's h2 is now the count ("Kurulum 3 / 5 · ...") instead of "Yayına hazırlık" (mockup-mandated); "Taslak n" line under the lead. Narrow-width squeeze: N/A, the manager panel is desktop-first (min 1024, v4 section 4); check at 1024 in Task 10.
Task 7: complete (commits 460335a..39393ae, review clean)
BASE T8: 39393ae
Task 8: implementer DONE 45d233e. Controller: full pnpm test 230 / 2828 passed; opening-settings-form.test.ts 12 -> 15 tests, 15/15. Review (sonnet): Approved, 0 Critical/Important.
Task 8: minor (deferred): two-branch membersCount line repeats the t() call (brief-mandated); initials found by class regex.
Task 8: complete (commits 39393ae..45d233e, review clean)
BASE T9: 45d233e
Task 9: implementer DONE 87ff7da. Controller: full pnpm test 231 / 2831 passed; invite-menu not in diff. Review (sonnet): Approved, 0 Critical/Important.
Task 9: minor (deferred): double "Kopyalandı" announcement (button + status); no copy-behaviour tests; TEXT_ACTION/LINK near-duplicates.
- ⚠️ carried to Task 10: Sheet does not close on Escape while the ready link shows.
Task 9: complete (commits 45d233e..87ff7da, review clean)
BASE T10: 87ff7da
Task 10 (controller, Chrome at window 1440x900, viewport 1440x723): gates tsc 0, eslint 0, build 0 (79 routes), pnpm test 231/2831 at 87ff7da; sweep only matches absence assertions in tests.
- Screens seen: 2 Alımlar pass; 3 position cards pass (40px tile stays soft when chosen, as the mockup); 4 start step pass (none preselected, wait "Nasıl başlayacağını seç.", chosen big tile turns white rgb(255,255,255), button enabled); 5 setup path pass; 6 team flow pass; 7 invite ready: content pass, Escape holds the Sheet in a clean run (2 real presses); an earlier run where a synthetic JS Escape was dispatched first ended with the Sheet closed, not reproduced. 1 Bugün: card look pass, attention rows not seen (no hiring attention rows in the data). 8 empty state: not checked live (needs an org with no openings). Console errors: none after tracking began.
- Finding F1: invite ready "Linki kopyala" at 766-806px below a 723px viewport (drawing 320px).
- Finding F2: NextTaskCard draws the inviteReady drawing on an exam next task (live exam's Today changes look; drawing means "link sent", wrong for "review").
Ruling: F2: the drawing shows only when the next task is a hiring task; an exam next task keeps the card without a drawing - the live exam screen should not change look, and the drawing's meaning fits invitations - cost if wrong: the exam card looks plainer than the hiring one.
Ruling: F1: the Sheet's ready drawing shrinks so the filled "Linki kopyala" is visible without scrolling at a 1440x723 and 1280x680 viewport (e.g. size "small"/spot or hidden below a height breakpoint) - the one filled button must be reachable - cost if wrong: a smaller success drawing.
Task 10: fix 07d2734 (F1 Sheet drawing size small + hidden under 700px height; F2 NextTaskCard withDrawing only for hiring). Controller in Chrome: "Linki kopyala" at 542-582 in a 723px viewport (drawing 96px); exam next-task card has no drawing (screenshot 709). 1280x680 not measurable (window resize does not change the viewport on this machine).
Task 10: complete (commits 87ff7da..07d2734; gates and browser check by controller)
FINAL REVIEW (opus, 7556a45..07d2734): 0 Critical, 1 Important (expiring/clock attention tile is accent, Global Constraints say neutral), Minors 2-7; frozen defaults proven byte-identical against 7556a45 in a temp worktree; exam untouched except NextTaskCard look.
Ruling: final #2 (NextTaskCard restyle also on the exam card: shadow, 22px title, button left, "·" eyebrow) accepted - no behaviour change, exam test passes, drawing gated by F2 - cost if wrong: small visual change on the live exam's Today card when this reaches main.
Ruling: final #4, #6, #7 and the remaining ledger minors stay deferred (low impact on a desktop-first panel).
FINAL FIX WAVE: f02f19f (clock tile neutral via IconTile color, globals.css comments, InviteReady lang, G6 JSDoc placement, test comment sha, funnelShare removed). Controller: full pnpm test 231 / 2832 passed, em-dash 0. Re-review (sonnet): all 6 addressed, no new breakage.
PLAN COMPLETE (7556a45..f02f19f).
