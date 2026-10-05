# Hiring Visual Flow (plan 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the hiring candidate flow and the most used manager screens the visual language of `docs/design/HIRING-VISUAL-FLOW.md` (desktop-only gate, illustrations, step screens with one filled button in a fixed footer, ring timers, cards and empty states) without changing what the server does, what the candidate is told is recorded, or how the live language exam behaves.

**Architecture:** Shared visual building blocks (`StepScreen`, `StepFooter`, `JourneyProgress`, `Illustration`, `ChoiceCard`, `TimerRing`, `StatusScreen`, ...) live in `src/components/visual/` with pure models in `.ts` files next to them, so both the core panel (Today, empty states) and hiring can import them. Candidate-only parts (the desktop gate, the hiring screens) stay in `src/components/hiring/candidate/`; the gate is applied inside `renderHiringPage` (solution code), never in the core `/a/[token]` layout the exam shares. Manager parts that the exam pages also render (`ManagerNav`, `PanelHeader` behind `PageHead`) change their look only, with before/after screenshots of the exam pages.

**Tech Stack:** Next.js 16.3.4 App Router (server components, `headers()` is async), React 19.2.8, Tailwind 4 + shadcn/ui (`src/components/ui`), lucide-react 1.42.0 (every icon name used below was checked in `node_modules`), next-intl 4 (`useT` / `useMT` typed namespaces), vitest (node environment, `src/**/*.test.ts`, `renderToStaticMarkup` for small components), pnpm, Drizzle ORM for the three new server reads (no migration), Claude in Chrome for browser checks.

**Spec:** `docs/design/HIRING-VISUAL-FLOW.md` version 3 (commit 53acc8f): section 0 (K1-K8), 2 (G1-G11 and P1-P11 in 4.2), 3 (3.0-3.12), 4 (4.3-4.6, 4.9), 5 (components), 6 (slices), 8 (acceptance). Also binding: `docs/design/HIRING-UX.md` (6, 8, 11), `docs/design/RULES.md`, `docs/STATUS.md` (invariants), the plan 2 ledger `.superpowers/sdd/2026-10-05-hiring-candidate-flow/progress.md` (rulings and carries quoted below) and `final-fix-findings.md` item 20.

**Depends on:** plan 2 complete on `platform/solutions` (HEAD 68d9442 for code, 53acc8f adds the design doc only). The ledger records 2256 tests at 68d9442; that number was not re-run while writing this plan, so Task 1 Step 1 records the real baseline.

## User decisions recorded for this plan (2026-10-05, in addition to K1-K8 of the design)

| # | Decision | Where it lands |
|---|---|---|
| K9 | Shared panel screens (Today, the menu, the panel's error page, Settings, Library) speak "sen". Exam-only manager screens keep "siz" until a plan touches them. | Task 14 (errorPage), Task 17 (`today.*`). Library and Settings copy move with M9/M10 (out of scope). |
| K10 | Today's "Sıradaki iş" priority: data-rights request > accommodation request > awaiting decision > oldest exam review. | Task 16 (`pickNextTask`), Task 17. "Awaiting decision" rows arrive with plan 3; the rank is reserved now. |
| K11 | "Linki e-postama gönder" waits for real mail sending: VG ships "Linki kopyala" only. Keyboard tablets (iPad with a keyboard, Android tablet with a mouse) are blocked like tablets. | Tasks 1-2. |

## Decisions taken in this plan (design ambiguities, resolved here; each is repeated in the task it touches)

1. **Shared visual components live in `src/components/visual/`, not `src/components/hiring/visual/`.** The ESLint rule in `eslint.config.mjs:11-35` forbids core files (Today, the panel, `EmptyState`) from importing `@/components/hiring/*`, and the design puts `EmptyState` with an illustration on the core Today screen (4.3). Candidate-only parts (gate, screens) stay in `src/components/hiring/candidate/`.
2. **The desktop gate runs in `renderHiringPage` (`src/solutions/hiring/candidate/pages.tsx`), not in `src/app/a/[token]/layout.tsx`.** That layout is core and wraps the exam's pages (K6). The gate covers the landing, `/info`, `/check`, `/practice` and `/stage/[n]`; it does not cover `/done`, `/rights`, the expired, not-yet and closed cards (a phone may ask for a new link or read a closing page; nothing is recorded there).
3. **The server's device reading fails open outside a request.** `headers()` throws in `scripts/verify-hiring-flow.ts` (it calls `solutionPage` outside Next, `scripts/verify-hiring-flow.ts:391-411`); there the page is treated as desktop. In a request it never throws. This keeps the rule "never block a real desktop" and the script green.
4. **`StepFooter` renders the filled button itself from a typed `FooterAction`.** A primary can only be disabled through its `waitReason`, which the footer prints next to it and links by `aria-describedby`, and a busy primary stays accent with `aria-disabled` and a spinner instead of turning pale. This is the fix for the "pale primary for 1-2 s without a reason" carry (STATUS item 23, Task 21 report concern 4); Task 10 Step 1 reproduces it first.
5. **The consent row "Kopma olursa ekip yeni hak verebilir" (design 3.2) is dropped.** No retake exists (C24 ruling) and `hiring-candidate-copy.test.ts:102` bans "yeniden hak" / "another go". The technical row instead names what is kept: IP address, browser, stage times, connection problems.
6. **Menu counts (P1 "Bugün 6") are deferred to plan 3.** A count in the layout would run every module's `today()` on every navigation. Icons ship in M1.
7. **Today gets two lanes:** `attention` (rows listed under "Dikkat isteyenler") and `task` (single requests that may become "Sıradaki iş", K10). Reviewers get no hiring rows (STATUS 321: requests are for people who run the opening).
8. **Hiring link problems get their own card** (`HiringLinkProblem`, a `StatusScreen`) with an honest failure and a retry. The core `LinkProblem` (exam) is not changed; its swallowed failure (`src/components/candidate/LinkProblem.tsx:49-57`) is recorded in STATUS as open for a separate user decision (live exam).
9. **An expired or not-yet link on a CLOSED opening, for a candidate who never started a stage, shows the closed card** (Task 18 carry "expired card says open on a closed opening"; Task 7 ruling 3: such a candidate cannot get a new link).
10. **`/info` (3.12) becomes a hiring screen (`InfoStep`).** The core `InfoForm` stays for the exam; the hiring screen fixes the raw error text and the < 16px inputs (Task 11 Minor 10 carry).
11. **The openings list keeps its route tabs** (counts and empty texts unchanged, M3 "Bitti sayılır") and draws cards up to 20 openings per tab, the table above that (4.4).
12. **Opening status tones follow P9:** DRAFT neutral, OPEN active, CLOSED `warn` (the lightest grey, "muted"); CLOSED was `done` (the darkest) before.
13. **The new-opening wizard shows the ad step only for a new position name.** A library position's ad lives on the position (`hiringNew.addJobAd` link stays on step 3).
14. **Overview `⋯` menu items are navigation links** (preview, team and rules where "Alımı kapat" lives with its undo strip). No new close action in a menu.
15. **Task 13 residual "retry-replaced pending draft"** is named in the ledger without detail (`progress.md:150`). This plan reads it as: a draft remembers only the newest sent-but-unconfirmed text, so an older save that lands after a newer one leaves the server holding a text the restore rule does not know, and the tab's newer typing is dropped on reload. The fix keeps the newest sent text and the two sent before it. This is an interpretation: if the controller reads the residual differently, skip the `older` part of Task 10 Steps 2-3 and record why.
16. **Design v4 (K12, `docs/design/HIRING-VISUAL-FLOW.md` version 4, commit 00d5af7) governs Part 2 (Tasks 14-23), and its H8 replaces decision 11:** the openings' route tabs become groups on one control view (`?tab=` links keep working) and the old card grid gives way to one control row per opening (Task 18); where an earlier decision differs for the manager part, v4 wins.

## Global Constraints

- Desktop-only hiring candidate flow (K2): phones and tablets get `DesktopOnlyScreen`; the decision rests on a definite server UA signal (`Sec-CH-UA-Mobile: ?1`, phone UA) or on two client signals together (`pointer: coarse` and no `any-pointer: fine` and no `getDisplayMedia`), or a tablet UA (K11); never on window width; a real desktop or laptop is never blocked (a narrow desktop window gets `NarrowWindowStrip`, and below 640px only a not-yet-started stage waits with "Pencereni büyüt, sonra başla."); the language exam's routes and `MobileBlock` are untouched (K6).
- Candidate leak rule: an unserved or other-solution token is answered exactly like an unknown token; client components get only values built from `candidateSafe(state)`; `DesktopOnlyScreen` and every preparation screen get no stage name and no question; every leak test plants `LEAKVISIBLE_*` (positive control, must be found in the state) and `TEAMSECRET_*` (must be found nowhere in props).
- Accessibility: focus moves to the new heading on every step change (`useStepFocus`), positions are announced in a polite live region, targets are at least 44px, candidate inputs are at least 16px, a disabled button states its reason next to it with `aria-describedby` (`id` + `-why`), motion follows `prefers-reduced-motion` (opacity only), illustrations are `aria-hidden` and `focusable="false"`.
- Honest copy: no screen promises what the code does not do (no reply promise to a hiring candidate, no surveillance claim on the desktop-only screen, no retake, no e-mail button).
- TR/EN parity: every key in both files (`src/i18n/messages.test.ts`); hiring candidate namespaces start with `hiring` so `src/i18n/hiring-candidate-copy.test.ts` checks them.
- "sen" on every hiring screen and on shared panel screens (K9); exam-only copy unchanged.
- The em-dash character (U+2014) appears nowhere: not in copy, code, comments, commit messages or this plan.
- Illustrations are inline SVG only (no `<img>`, no `<image>`, no `href`, no file), `aria-hidden="true"`, `focusable="false"`, colours only `var(--color-illus-line|fill|tint|sage|warm)` or `none`; never on a question screen (K1, G11).
- One filled button per screen, at a fixed place: `StepFooter` (candidate and wizard screens) or the `PanelHeader` primary slot (panel pages).
- Exam behaviour unchanged except where a task says so; every task that touches a file the exam renders lists it under "Shared with the exam" and takes before/after screenshots of the exam pages.
- Tests that pin copy (`src/i18n/hiring-candidate-copy.test.ts`, `src/i18n/messages.test.ts`) stay green; a pinned value changes only with a stated reason in the task.
- Pool rule: no global `db` inside a `db.transaction` callback (use the transaction's executor); this plan adds read-only queries only.
- Verify gates for every task: `pnpm exec tsc --noEmit`, `pnpm exec eslint src scripts`, `pnpm test` (the count only grows; a removed or renamed test title is named in the commit body with its reason); `pnpm build` where a page or route changes; `verify:exam` with `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform` and the dev server on 3100 after Tasks 14, 17 and 23; `verify:hiring-flow` on a fresh `kademe_flow_check` after Tasks 2, 5, 6, 13 and 23; `verify:guard` (dev server on 3100, `kademe_platform`) after Tasks 2, 13 and 23.
- Browser checks only with Claude in Chrome (`mcp__claude-in-chrome__*`, never Playwright), on a throw-away copy `kademe_ui_check` (`create database kademe_ui_check template kademe_platform`, after checking `pg_stat_activity` per `scripts/dev-hiring-link.ts:9-12`), dev server `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_ui_check pnpm dev --port 3100`, `PROCTOR_DEV_FAKE` unset, panel login only through `/login` (owner account in `docs/STATUS.md:50`), copy dropped at the end. The automation tab cannot prove a real camera, microphone or phone: such rows are written "doğrulanmadı, gerçek cihazda kullanıcıyla".
- Commits on `platform/solutions`, `git add` of the exact paths the task names, English message (imperative subject, body), ending with the two attribution lines given in Task 1 Step 9. Never `git checkout`, `git switch`, `git stash`, `git reset`, never push.

## File Structure

| Path | Responsibility | Task |
|---|---|---|
| `src/components/hiring/candidate/device-class.ts` (+ test) | `classifyDevice`, `serverDeviceClass`, width thresholds | 1 |
| `src/components/hiring/candidate/desktop-gate.tsx` | Client gate, `clientSignals`, `useWindowWidth`, `NarrowWindowStrip` | 2 |
| `src/components/hiring/candidate/desktop-only.tsx`, `copy-link.ts` (+ test) | "Bu değerlendirme bilgisayardan yapılır" with "Linki kopyala" and the wrong-detection report | 2, 3 |
| `src/solutions/hiring/candidate/pages.tsx` (+ test) | Gate wiring, landing props, info step, problem view | 2, 5, 6, 13 |
| `src/app/globals.css`, `src/components/ui/theme.test.ts` | `--color-illus-*` tokens; step keyframes and footer scroll padding | 3, 4 |
| `src/components/visual/illustrations.tsx` (+ test) | 15 inline SVG illustrations | 3 |
| `src/components/visual/*.ts` (+ tests) | Pure models: journey, ring, footer action, choice keys | 4 |
| `src/components/visual/*.tsx` | `StepScreen`, `StepFooter`, `JourneyProgress`, `QuestionProgress`, `Disclosure`, `IconRow`, `FactTiles`, `PathSteps`, `ChoiceCardGroup`, `TimerRing`, `StatusScreen`, `MediaStage` | 4 |
| `src/components/hiring/candidate/*.tsx` | Every candidate screen moved to the blocks above; `action-bar.tsx` deleted | 5-13 |
| `src/components/hiring/candidate/landing-model.ts` (+ test), `use-journey.ts` | Welcome and consent model, the footer's journey | 5 |
| `src/components/hiring/candidate/info-step.tsx`, `info-model.ts` (+ test) | Hiring `/info` | 6 |
| `src/components/hiring/candidate/device-steps.ts` (+ test) | Device check sub-steps and the Task 12 polish rules | 7, 8 |
| `src/components/hiring/candidate/take.ts`, `runner-steps.ts`, `draft-store.ts`, `file-upload.ts`, `done-model.ts` (+ tests) | Task 13, 14 and 15 carries; the finish's footer | 9-12 |
| `src/components/hiring/candidate/link-problem.tsx`, `problem-view.ts` (+ test), `footer-usage.test.ts` | Hiring link-problem card; no `ActionBar` left | 13 |
| `src/solutions/hiring/server/candidate.ts` (+ test) | `hiringProblemFacts` | 13 |
| `src/components/manager/nav.tsx`, `src/solutions/{types,registry}.ts`, manifests (+ test) | Menu icons; hiring's control view linked from Today (`overview`) | 14, 17 |
| `src/components/manager/panel-header.tsx`, `row-menu.tsx`, `page-title.tsx`, `src/components/panel/bits.tsx` (+ test) | `PanelHeader` behind `PageHead` and `PageTitle`, the `⋯` menu (panel parts live in `components/manager`: `boundary.test.ts` keeps hiring out of `components/panel`) | 14 |
| `src/components/manager/empty-state.tsx`, `src/components/hiring/status-vocabulary.ts` (+ tests) | Empty states, one status dictionary | 15 |
| `src/components/manager/flow-model.ts`, `guided-flow.tsx`, `summary-rows.tsx` (+ tests) | The guided-flow shell (K12, W1-W10) and summaries | 15 |
| `src/lib/today.ts` (+ test), `src/solutions/hiring/server/today.ts` (+ test), `src/solutions/hiring/module.ts` (+ test) | Today lanes, next task (K10 with C6), hiring rows | 16, 17 |
| `src/app/(manager)/dashboard/page.tsx`, `src/components/manager/next-task-card.tsx`, `invite-menu.tsx` | Today screen | 17 |
| `src/app/(manager)/hiring/openings/page.tsx`, `cockpit.ts` (+ test), `scroll-to.tsx`, `src/components/manager/control-row.tsx`, `src/components/hiring/opening-next-step.ts` (+ test), `src/solutions/hiring/server/{invitations,openings}.ts` (+ test) | The hiring control view (rows, groups, next step, facts) | 18 |
| `src/app/(manager)/hiring/openings/[id]/setup-steps.ts` (+ test), `setup-strip.ts` | A draft's setup path and its one-line strip | 18, 20 |
| `src/components/hiring/new-opening-form.tsx`, `new-opening-steps.ts` (+ test) | Guided "Alım aç" | 19 |
| `src/app/(manager)/hiring/openings/[id]/page.tsx`, `publish-view.tsx`, `opening-header.tsx`, `assessment/**/page.tsx`, `candidates/*` | The opening's control view, publish summary, setup line, notices | 20 |
| `src/components/hiring/opening-settings-form.tsx`, `rules-flows.ts` (+ tests), `src/app/(manager)/hiring/openings/[id]/settings/page.tsx` (+ test) | Team and rules: summary, four flows, close with undo | 21 |
| `src/components/hiring/invite/*` (+ test), `src/app/(manager)/hiring/invite/page.tsx` | Invite flow in the Sheet and on the page | 22 |
| `docs/design/HIRING-UX.md`, `docs/design/RULES.md`, `docs/design/HIRING-VISUAL-FLOW.md`, `docs/STATUS.md` | Superseded text, acceptance list, doc sweep, results | 2, 3, 23 |
| `src/i18n/messages/candidate.{tr,en}.json`, `hiring.{tr,en}.json`, `screens.{tr,en}.json`, `manager.{tr,en}.json`, `src/i18n/hiring-candidate-copy.test.ts`, `src/i18n/panel-copy.test.ts` | Copy and its rules | every UI task |

---

## Part 1: candidate side (VG, V1-V7)

### Task 1: VG part 1, `classifyDevice` and the width thresholds

**Files:**
- Create: `src/components/hiring/candidate/device-class.ts`
- Test: `src/components/hiring/candidate/device-class.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `@/components/hiring/candidate/device-class`):
  - `type DeviceClass = "desktop" | "phone" | "tablet" | "unknown"`
  - `type DeviceSignals = { ua: string; chMobile?: boolean | null; coarse?: boolean; anyFine?: boolean; hasDisplayMedia?: boolean; maxTouchPoints?: number }` (the four client fields are `undefined` on the server)
  - `classifyDevice(s: DeviceSignals): DeviceClass` (`"unknown"` only from server signals with a tablet-like UA)
  - `serverDeviceClass(h: { get(name: string): string | null } | null): DeviceClass` (`null`: no request, a script: `"desktop"`, decision 3)
  - `NARROW_LAYOUT_PX = 1024`, `NARROW_START_PX = 640`
  - `windowNotice(width: number): "none" | "narrow"`, `startWaitsForWidth(width: number): boolean`

- [ ] **Step 1: Record the baseline**

Run: `pnpm test 2>&1 | tail -5`
Expected: all passing; write the test and file counts into the task report (the ledger says 2256 at 68d9442; if the number differs, the report says so).

- [ ] **Step 2: Write the failing test**

```ts
// src/components/hiring/candidate/device-class.test.ts
import { describe, expect, it } from "vitest";
import { classifyDevice, NARROW_LAYOUT_PX, NARROW_START_PX, serverDeviceClass, startWaitsForWidth, windowNotice, type DeviceSignals } from "./device-class";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  androidPhone: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  androidPhoneReduced: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  firefoxAndroidPhone: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
  androidTablet: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  firefoxAndroidTablet: "Mozilla/5.0 (Android 14; Tablet; rv:131.0) Gecko/131.0 Firefox/131.0",
  ipadOld: "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windowsChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  chromebook: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  linuxDesktopSite: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  windowsPhone: "Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0 Mobile Safari/537.36 Edge/15.15063",
};

/** A desktop browser's own client signals: a fine pointer and screen sharing. */
const desk = { coarse: false, anyFine: true, hasDisplayMedia: true, maxTouchPoints: 0 };
/** A touch-only device: coarse pointer, no fine pointer, no screen sharing. */
const touch = { coarse: true, anyFine: false, hasDisplayMedia: false, maxTouchPoints: 5 };
const client = (ua: string, rest: Omit<DeviceSignals, "ua">) => classifyDevice({ ua, chMobile: null, ...rest });

describe("classifyDevice (HIRING-VISUAL-FLOW 3.0, K2, K11)", () => {
  it("knows a phone on the server from a phone UA or Sec-CH-UA-Mobile, whatever the client says", () => {
    for (const ua of [UA.iphone, UA.androidPhone, UA.androidPhoneReduced, UA.firefoxAndroidPhone, UA.windowsPhone]) {
      expect(classifyDevice({ ua }), ua).toBe("phone");
      expect(client(ua, desk), ua).toBe("phone");
    }
    expect(classifyDevice({ ua: UA.windowsChrome, chMobile: true })).toBe("phone");
  });

  it("blocks DevTools phone emulation on purpose: the browser sends a phone UA and ?1", () => {
    expect(classifyDevice({ ua: UA.iphone, chMobile: true, ...desk })).toBe("phone");
  });

  it("leaves a tablet UA undecided on the server and lets the client call it a tablet", () => {
    for (const ua of [UA.androidTablet, UA.firefoxAndroidTablet, UA.ipadOld]) {
      expect(classifyDevice({ ua, chMobile: false }), ua).toBe("unknown");
      expect(client(ua, touch), ua).toBe("tablet");
    }
  });

  it("blocks a keyboard tablet too (K11): a fine pointer next to a tablet UA is still a tablet", () => {
    expect(client(UA.androidTablet, { ...touch, anyFine: true })).toBe("tablet");
    // iPadOS in desktop mode says Macintosh; only its touch points tell it from a Mac.
    expect(classifyDevice({ ua: UA.macSafari })).toBe("desktop");
    expect(client(UA.macSafari, touch)).toBe("tablet");
    expect(client(UA.macSafari, { ...touch, anyFine: true })).toBe("tablet");
  });

  it("never blocks a real desktop or laptop (3.0 principle 1)", () => {
    expect(client(UA.macSafari, desk)).toBe("desktop");
    expect(client(UA.windowsChrome, desk)).toBe("desktop");
    expect(client(UA.chromebook, desk)).toBe("desktop");
    // A touch-screen laptop: touch alone is never a reason.
    expect(client(UA.windowsChrome, { coarse: true, anyFine: true, hasDisplayMedia: true, maxTouchPoints: 10 })).toBe("desktop");
    // A convertible folded into tablet mode still shares its screen.
    expect(client(UA.chromebook, { coarse: true, anyFine: false, hasDisplayMedia: true, maxTouchPoints: 10 })).toBe("desktop");
    // The server alone never blocks a desktop UA.
    expect(classifyDevice({ ua: UA.windowsChrome, chMobile: false })).toBe("desktop");
    expect(classifyDevice({ ua: "" })).toBe("desktop");
  });

  it("calls a touch-only device asking for the desktop site a tablet: both client signals agree", () => {
    expect(client(UA.linuxDesktopSite, touch)).toBe("tablet");
    expect(client(UA.linuxDesktopSite, { ...touch, hasDisplayMedia: true })).toBe("desktop");
  });

  it("reads the request headers, and treats no request (a script) as desktop (decision 3)", () => {
    const h = (pairs: Record<string, string>) => ({ get: (name: string) => pairs[name.toLowerCase()] ?? null });
    expect(serverDeviceClass(h({ "user-agent": UA.iphone }))).toBe("phone");
    expect(serverDeviceClass(h({ "user-agent": UA.windowsChrome, "sec-ch-ua-mobile": "?1" }))).toBe("phone");
    expect(serverDeviceClass(h({ "user-agent": UA.windowsChrome, "sec-ch-ua-mobile": "?0" }))).toBe("desktop");
    expect(serverDeviceClass(h({ "user-agent": UA.androidTablet, "sec-ch-ua-mobile": "?0" }))).toBe("unknown");
    expect(serverDeviceClass(h({}))).toBe("desktop");
    expect(serverDeviceClass(null)).toBe("desktop");
  });
});

describe("window width never decides the device, only what the screen says (3.0 principle 2)", () => {
  it("shows the narrow strip below 1024px and holds a stage start below 640px", () => {
    expect(NARROW_LAYOUT_PX).toBe(1024);
    expect(NARROW_START_PX).toBe(640);
    expect(windowNotice(1280)).toBe("none");
    expect(windowNotice(1024)).toBe("none");
    expect(windowNotice(1023)).toBe("narrow");
    expect(windowNotice(500)).toBe("narrow");
    expect(startWaitsForWidth(640)).toBe(false);
    expect(startWaitsForWidth(639)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/hiring/candidate/device-class.test.ts`
Expected: FAIL, "Failed to resolve import ./device-class".

- [ ] **Step 4: Write the implementation**

```ts
// src/components/hiring/candidate/device-class.ts
/**
 * HIRING-VISUAL-FLOW 3.0 (user decisions K2 and K11): the hiring candidate
 * flow is done on a computer. This file decides which device opened the link,
 * the same code on the server (request headers only) and in the browser (all
 * signals). The rules, in order:
 *
 * 1. A definite phone signal (Sec-CH-UA-Mobile ?1, a phone UA) is a phone.
 *    No laptop sends either; DevTools phone emulation does, on purpose.
 * 2. A tablet UA (iPad, Android without "Mobile", or "Macintosh" with touch
 *    points, which is iPadOS asking for the desktop site) is a tablet, with or
 *    without a keyboard (K11). The server cannot see touch points or pointers,
 *    so it says "unknown" and the browser decides.
 * 3. In the browser, a coarse-only pointer AND no screen sharing together are a
 *    tablet (a touch device asking for the desktop site). One weak signal alone
 *    (a touch screen, a small window) never blocks anyone.
 * 4. Everything else is a desktop. Window width is never an input here: a
 *    narrow desktop window gets a strip, never a block.
 *
 * The language exam has its own `isMobileDevice` (components/candidate/
 * MobileBlock.tsx); it is not touched (K6).
 */
export type DeviceClass = "desktop" | "phone" | "tablet" | "unknown";

export type DeviceSignals = {
  ua: string;
  /** Sec-CH-UA-Mobile ("?1" true, "?0" false), or userAgentData.mobile; null when not sent. */
  chMobile?: boolean | null;
  /** The browser's own signals; undefined on the server. */
  coarse?: boolean;
  anyFine?: boolean;
  hasDisplayMedia?: boolean;
  maxTouchPoints?: number;
};

const PHONE_UA = /iPhone|iPod|Windows Phone|Android.*Mobile/i;
const TABLET_UA = /iPad|Android(?!.*Mobile)/i;

export function classifyDevice(s: DeviceSignals): DeviceClass {
  if (s.chMobile === true || PHONE_UA.test(s.ua)) return "phone";
  const inBrowser = s.coarse !== undefined;
  const tabletUa = TABLET_UA.test(s.ua) || (/Macintosh/.test(s.ua) && (s.maxTouchPoints ?? 0) > 1);
  if (tabletUa) return inBrowser ? "tablet" : "unknown";
  if (!inBrowser) return "desktop";
  if (s.coarse && !s.anyFine && !s.hasDisplayMedia) return "tablet";
  return "desktop";
}

/**
 * The server's reading of a request. `null` means there is no request (a
 * script calling the page renderer): treated as a desktop, because the rule
 * that matters is never to block a real desktop (plan decision 3).
 */
export function serverDeviceClass(h: { get(name: string): string | null } | null): DeviceClass {
  if (!h) return "desktop";
  const mobile = h.get("sec-ch-ua-mobile");
  return classifyDevice({ ua: h.get("user-agent") ?? "", chMobile: mobile === "?1" ? true : mobile === "?0" ? false : null });
}

/** Below this a desktop window gets the "Pencere dar" strip; the layout falls to one column. */
export const NARROW_LAYOUT_PX = 1024;
/** Below this a stage that has not started waits; a started one is never held (time runs). */
export const NARROW_START_PX = 640;

export const windowNotice = (width: number): "none" | "narrow" => (width < NARROW_LAYOUT_PX ? "narrow" : "none");
export const startWaitsForWidth = (width: number): boolean => width < NARROW_START_PX;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/hiring/candidate/device-class.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4`
Expected: no output from tsc and eslint; tests = baseline + 8, 0 failed.

- [ ] **Step 7: Em-dash check on the new files**

Run: `grep -n $'\xe2\x80\x94' src/components/hiring/candidate/device-class.ts src/components/hiring/candidate/device-class.test.ts; echo "exit $?"`
Expected: `exit 1` (no match).

- [ ] **Step 8: No browser step**

Pure logic; the browser check is in Task 2.

- [ ] **Step 9: Commit**

```bash
git add src/components/hiring/candidate/device-class.ts src/components/hiring/candidate/device-class.test.ts
git commit -m "$(cat <<'MSG'
Classify the device that opens a hiring link

A phone is told from a definite signal (phone UA, Sec-CH-UA-Mobile ?1);
a tablet from its UA (keyboard tablets included, K11) or from two client
signals together; a desktop is never blocked and window width never
decides the device (HIRING-VISUAL-FLOW 3.0).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i
MSG
)"
```


---

### Task 2: VG part 2, the gate on the hiring pages, `DesktopOnlyScreen`, the narrow window

**Files:**
- Create: `src/components/hiring/candidate/copy-link.ts`, `src/components/hiring/candidate/copy-link.test.ts`
- Create: `src/components/hiring/candidate/desktop-gate.tsx` (client gate, `clientSignals`, `useWindowWidth`, `NarrowWindowStrip`)
- Create: `src/components/hiring/candidate/desktop-only.tsx`
- Modify: `src/solutions/hiring/candidate/pages.tsx:1-22` (imports), `:110-151` (gate around landing, info, check, stage, practice)
- Modify: `src/components/hiring/candidate/stage-intro.tsx:101-107` (start waits below 640px)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (new `hiringGate`; `hiringFrame.faqPhoneA`, `hiringLanding.needDevice`, `hiringDevice.deniedNotFound` changed)
- Modify: `src/i18n/hiring-candidate-copy.test.ts` (two new tests)
- Modify: `src/solutions/hiring/candidate/pages.test.ts:10-48` (mocks), new `describe("the desktop gate")`
- Modify: `docs/design/HIRING-UX.md:1161-1167` (6.15 replaced by the design's text)

**Shared with the exam:** none. `src/app/a/[token]/layout.tsx` and every core page stay as they are; the exam never reaches `renderHiringPage`.

**Interfaces:**
- Consumes: `classifyDevice`, `serverDeviceClass`, `startWaitsForWidth`, `windowNotice` (Task 1).
- Produces:
  - `copyLink(url: string, clipboard: { writeText(text: string): Promise<void> } | undefined): Promise<"copied" | "manual">`, `candidateLink(origin: string, token: string): string` (`copy-link.ts`)
  - `clientSignals(): DeviceSignals`, `useWindowWidth(): number`, `NarrowWindowStrip(): JSX.Element | null`, `DesktopGate(props: { serverClass: "desktop" | "unknown"; desktopOnly: ReactNode; children: ReactNode })` (`desktop-gate.tsx`)
  - `DesktopOnlyScreen(props: { token: string; minutes: number; deadlineDay: string; contactEmail: string | null })` (`desktop-only.tsx`; Task 3 adds its illustration inside the component, so the props never change)
  - Copy namespace `hiringGate` with keys `title, why, minutes, deadline, steps, step1, step2, copy, copied, manual, wrong, wrongSending, wrongSent, wrongSentContact, wrongFailed, reportMessage, narrow, narrowStart`.

- [ ] **Step 1: Write the failing tests (copy link, copy, pages)**

```ts
// src/components/hiring/candidate/copy-link.test.ts
import { describe, expect, it, vi } from "vitest";
import { candidateLink, copyLink } from "./copy-link";

describe("Linki kopyala on the desktop-only screen", () => {
  it("copies the very link the candidate opened, no other token", () => {
    expect(candidateLink("https://kademe.example", "Rl7fS-f_x")).toBe("https://kademe.example/a/Rl7fS-f_x");
    expect(candidateLink("https://kademe.example", "a/b")).toBe("https://kademe.example/a/a%2Fb");
  });

  it("says copied only when the clipboard took it, otherwise offers the link to copy by hand", async () => {
    const ok = { writeText: vi.fn(async () => undefined) };
    expect(await copyLink("u", ok)).toBe("copied");
    expect(ok.writeText).toHaveBeenCalledWith("u");
    expect(await copyLink("u", { writeText: async () => Promise.reject(new Error("denied")) })).toBe("manual");
    expect(await copyLink("u", undefined)).toBe("manual");
  });
});
```

Add to `src/i18n/hiring-candidate-copy.test.ts` (inside the `describe`, after the last `it`):

```ts
  it("says why the flow needs a computer without claiming any monitoring, and offers no e-mail button yet (3.0, K11)", () => {
    expect(tr.hiringGate.title).toBe("Bu değerlendirme bilgisayardan yapılır");
    expect(en.hiringGate.title).toBe("This assessment is done on a computer");
    expect(tr.hiringGate.why).toBe("İşe alım ekibi, değerlendirmenin bilgisayardan yapılmasını istiyor.");
    expect(en.hiringGate.why).toBe("The hiring team asks for this assessment to be done on a computer.");
    for (const text of [...strings(tr.hiringGate), ...strings(en.hiringGate)]) {
      expect(text).not.toMatch(/izlen|tam ekran|sekme|gözetim|monitor|full ?screen|\btabs?\b|proctor/i);
      expect(text).not.toMatch(/e-postama gönder|e-mail me/i);
    }
  });

  it("no longer says the assessment can be done on a phone (K2)", () => {
    expect(tr.hiringFrame.faqPhoneA).toBe("Hayır, bu değerlendirme bilgisayardan yapılır. Linki bilgisayarında aç.");
    expect(en.hiringFrame.faqPhoneA).toBe("No, this assessment is done on a computer. Open the link on your computer.");
    expect(tr.hiringLanding.needDevice).toBe("Bilgisayar");
    expect(en.hiringLanding.needDevice).toBe("A computer");
    for (const [, namespace] of [...hiringOf(tr), ...hiringOf(en)]) {
      for (const text of strings(namespace)) expect(text).not.toMatch(/Telefonu dik tut|Hold the phone upright|Telefon ya da bilgisayar|A phone or a computer|örneğin telefonunla|such as your phone/);
    }
  });
```

In `src/solutions/hiring/candidate/pages.test.ts`, extend the hoisted state (`:10-15`) with `headers: { "user-agent": DESKTOP_UA } as Record<string, string>` (declare `const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";` inside `vi.hoisted`, returned with the rest), add next to the other mocks (`:17-34`):

```ts
vi.mock("next/headers", () => ({ headers: async () => new Headers(h.headers) }));
vi.mock("@/components/hiring/candidate/desktop-gate", () => ({ DesktopGate: function DesktopGate() {} }));
vi.mock("@/components/hiring/candidate/desktop-only", () => ({ DesktopOnlyScreen: function DesktopOnlyScreen() {} }));
```

import them after the existing imports (`:36-48`):

```ts
import { DesktopGate } from "@/components/hiring/candidate/desktop-gate";
import { DesktopOnlyScreen } from "@/components/hiring/candidate/desktop-only";
```

reset in `beforeEach` (`:72-88`): `h.headers = { "user-agent": h.DESKTOP_UA };`, and append this block at the end of the file:

```ts
describe("the desktop gate (HIRING-VISUAL-FLOW 3.0, VG)", () => {
  const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const TABLET = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
  const stageState = () => ({
    ...(h.state as object),
    step: "STAGE",
    position: 2,
    path: "/stage/2",
    totalMinutes: 15,
    current: { position: 2, total: 2, stage: { id: "s2", name: { tr: "Vaka LEAKVISIBLE_STAGE", en: "Case" }, activities: [{ id: "q1", type: "LONG_TEXT", prompt: { tr: "Anlat LEAKVISIBLE_PROMPT", en: "Tell" }, managerNotes: "TEAMSECRET_NOTE" }] }, responses: [] },
  });

  it("gives a phone only the desktop-only screen: the minutes, the last day, the contact, and nothing of the stages", async () => {
    h.headers = { "user-agent": PHONE };
    h.state = { ...(h.state as object), totalMinutes: 15 };
    const landing = await render("landing");
    expect(find(landing, Landing)).toHaveLength(0);
    expect(find(landing, DesktopGate)).toHaveLength(0);
    const [only] = find(landing, DesktopOnlyScreen);
    expect(only.props).toEqual({ token: "tok", minutes: 15, deadlineDay: "19 Eki", contactEmail: "deniz@ornek.test" });
    // Inside the frame: the organisation, the language and Help stay in reach.
    expect(find(landing, HiringFrame)[0].props).toMatchObject({ orgName: "Örnek A.Ş.", token: "tok" });
    h.state = stageState();
    const stage = await render("stage", { params: { n: "2" } });
    expect(find(stage, StageRunner)).toHaveLength(0);
    const sent = JSON.stringify(find(stage, DesktopOnlyScreen)[0].props);
    expect(sent).not.toMatch(/LEAKVISIBLE|TEAMSECRET/);
    // Positive control: the state the page read does carry the stage's and the question's text.
    expect(JSON.stringify(h.state)).toMatch(/LEAKVISIBLE_STAGE[\s\S]*LEAKVISIBLE_PROMPT/);
  });

  it("treats Sec-CH-UA-Mobile ?1 as a phone whatever the UA says", async () => {
    h.headers = { "user-agent": h.DESKTOP_UA, "sec-ch-ua-mobile": "?1" };
    expect(find(await render("landing"), DesktopOnlyScreen)).toHaveLength(1);
  });

  it("hands a desktop the screen inside the client gate, with the same desktop-only screen in reserve", async () => {
    const node = await render("landing");
    const [gate] = find(node, DesktopGate);
    expect(gate.props).toMatchObject({ serverClass: "desktop" });
    expect(find(gate, Landing)).toHaveLength(1);
    const reserve = (gate.props as { desktopOnly: ReactElement }).desktopOnly;
    expect(reserve.type).toBe(DesktopOnlyScreen);
    expect(Object.keys(reserve.props as object).sort()).toEqual(["contactEmail", "deadlineDay", "minutes", "token"]);
  });

  it("leaves a tablet UA to the browser", async () => {
    h.headers = { "user-agent": TABLET, "sec-ch-ua-mobile": "?0" };
    expect(find(await render("landing"), DesktopGate)[0].props).toMatchObject({ serverClass: "unknown" });
  });

  it("does not gate the finish page or a link problem: a phone may read them", async () => {
    h.headers = { "user-agent": PHONE };
    const expired = await render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx } });
    expect(find(expired, DesktopOnlyScreen)).toHaveLength(0);
    h.state = { ...(h.state as object), step: "DONE", position: null, path: "/done", finished: { completedAt: "2026-10-05T09:00:00.000Z", stagesDone: 1, feedbackBy: "2026-10-12", survey: { enabled: false, answered: false } } };
    const done = await render("done", { resolved: { ok: false, problem: "COMPLETED", ctx } });
    expect(find(done, Done)).toHaveLength(1);
    expect(find(done, DesktopOnlyScreen)).toHaveLength(0);
  });
});
```

`find` (`pages.test.ts:62-67`) walks `props.children` only, so the existing tests still find `Landing`, `DeviceCheck`, `StageRunner` and `Practice` as children of `DesktopGate`; the reserve screen in the `desktopOnly` prop is not a child and adds nothing to them.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/hiring/candidate/copy-link.test.ts src/i18n/hiring-candidate-copy.test.ts src/solutions/hiring/candidate/pages.test.ts`
Expected: FAIL: `./copy-link` not found; `tr.hiringGate` undefined; the gate tests find no `DesktopOnlyScreen`.

- [ ] **Step 3: Copy (TR and EN)**

Add the namespace `hiringGate` to `candidate.tr.json` (after `hiringClosed`):

```json
"hiringGate": {
  "title": "Bu değerlendirme bilgisayardan yapılır",
  "why": "İşe alım ekibi, değerlendirmenin bilgisayardan yapılmasını istiyor.",
  "minutes": "~{minutes} dk",
  "deadline": "Son gün {date}",
  "steps": "Ne yapmalı",
  "step1": "Linki kopyala ya da e-postanı bilgisayarda aç.",
  "step2": "Bilgisayarındaki tarayıcıda linki aç.",
  "copy": "Linki kopyala",
  "copied": "Kopyalandı",
  "manual": "Kopyalanamadı. Linki seç ve kendin kopyala:",
  "wrong": "Bilgisayardayım ama bu ekranı görüyorum",
  "wrongSending": "Gönderiliyor",
  "wrongSent": "Bildirimin kaydedildi.",
  "wrongSentContact": "Bildirimin kaydedildi. Acil bir durumda <mail>{email}</mail> adresine yaz.",
  "wrongFailed": "Gönderilemedi. Bağlantını kontrol edip tekrar dener misin?",
  "reportMessage": "Aday bilgisayarda olduğunu söylüyor ama telefon ekranını görüyor.",
  "narrow": "Pencere dar. Daha rahat görmek için pencereni büyüt.",
  "narrowStart": "Pencereni büyüt, sonra başla."
}
```

and to `candidate.en.json`:

```json
"hiringGate": {
  "title": "This assessment is done on a computer",
  "why": "The hiring team asks for this assessment to be done on a computer.",
  "minutes": "~{minutes} min",
  "deadline": "Last day {date}",
  "steps": "What to do",
  "step1": "Copy the link or open your e-mail on a computer.",
  "step2": "Open the link in your computer's browser.",
  "copy": "Copy the link",
  "copied": "Copied",
  "manual": "Could not copy. Select the link and copy it yourself:",
  "wrong": "I'm on a computer but I see this screen",
  "wrongSending": "Sending",
  "wrongSent": "Your report was saved.",
  "wrongSentContact": "Your report was saved. If it is urgent, write to <mail>{email}</mail>.",
  "wrongFailed": "Could not send. Check your connection and try again?",
  "reportMessage": "The candidate says they are on a computer but sees the phone screen.",
  "narrow": "Your window is narrow. Make it wider to see everything comfortably.",
  "narrowStart": "Make your window wider, then start."
}
```

Change three values (keys unchanged):

| Key | TR | EN |
|---|---|---|
| `hiringFrame.faqPhoneA` | Hayır, bu değerlendirme bilgisayardan yapılır. Linki bilgisayarında aç. | No, this assessment is done on a computer. Open the link on your computer. |
| `hiringLanding.needDevice` | Bilgisayar | A computer |
| `hiringDevice.deniedNotFound` | Kamera ya da mikrofon bulunamadı. Takılı olduğundan emin ol ya da başka bir bilgisayarla dene. | We could not find a camera or microphone. Make sure one is connected, or try another computer. |

Reason for the changed values (stated in the commit): K2 makes the flow desktop-only, so the phone answers are untrue now (design 0 and 3.1).

- [ ] **Step 4: `copy-link.ts`**

```ts
// src/components/hiring/candidate/copy-link.ts
/** HIRING-VISUAL-FLOW 3.0: the link copied is the one the candidate opened; no new token is made. */
export const candidateLink = (origin: string, token: string) => `${origin}/a/${encodeURIComponent(token)}`;

/** "copied" only when the clipboard took it; otherwise the screen shows the link to copy by hand. */
export async function copyLink(url: string, clipboard: { writeText(text: string): Promise<void> } | undefined): Promise<"copied" | "manual"> {
  if (!clipboard) return "manual";
  try {
    await clipboard.writeText(url);
    return "copied";
  } catch {
    return "manual";
  }
}
```

- [ ] **Step 5: `desktop-gate.tsx`**

```tsx
// src/components/hiring/candidate/desktop-gate.tsx
"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { AppWindow } from "lucide-react";
import { useT } from "@/i18n/candidate-client";
import { classifyDevice, windowNotice, type DeviceSignals } from "./device-class";

/** Everything the browser can say about itself (3.0). Read only in the browser. */
export function clientSignals(): DeviceSignals {
  const matches = (query: string) => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: unknown } }).userAgentData;
  return {
    ua: navigator.userAgent,
    chMobile: typeof uaData?.mobile === "boolean" ? uaData.mobile : null,
    coarse: matches("(pointer: coarse)"),
    anyFine: matches("(any-pointer: fine)"),
    hasDisplayMedia: typeof navigator.mediaDevices?.getDisplayMedia === "function",
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

const noSubscribe = () => () => undefined;
const subscribeResize = (notify: () => void) => {
  window.addEventListener("resize", notify);
  return () => window.removeEventListener("resize", notify);
};

/** The window's width, live. The server and the first paint assume a wide window: nothing waits before the browser says so. */
export function useWindowWidth(): number {
  return useSyncExternalStore(subscribeResize, () => window.innerWidth, () => 1280);
}

/** 3.0: a narrow desktop window is never blocked; it is told, calmly, and the strip goes when the window grows. */
export function NarrowWindowStrip() {
  const t = useT("hiringGate");
  const width = useWindowWidth();
  if (windowNotice(width) === "none") return null;
  return (
    <p role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[26px] text-ink">
      <AppWindow className="mt-[3px] size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
      {t("narrow")}
    </p>
  );
}

/**
 * The browser's half of the gate. The server already answered a phone with the
 * desktop-only screen; here the browser looks again with every signal (an iPad
 * asking for the desktop site says "Macintosh" to the server). A tablet UA the
 * server could not decide renders nothing until the browser has decided.
 */
export function DesktopGate({ serverClass, desktopOnly, children }: { serverClass: "desktop" | "unknown"; desktopOnly: ReactNode; children: ReactNode }) {
  const device = useSyncExternalStore(noSubscribe, () => classifyDevice(clientSignals()), () => serverClass);
  if (device === "phone" || device === "tablet") return <>{desktopOnly}</>;
  if (device === "unknown") return null;
  return (
    <>
      <NarrowWindowStrip />
      {children}
    </>
  );
}
```

- [ ] **Step 6: `desktop-only.tsx`**

```tsx
// src/components/hiring/candidate/desktop-only.tsx
"use client";

import { useRef, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import { mailTo } from "./closed";
import { candidateLink, copyLink } from "./copy-link";

/**
 * HIRING-VISUAL-FLOW 3.0, the one phone screen: why (the team's choice, no
 * claim about monitoring), how long and until when (so the candidate can plan),
 * two steps, "Linki kopyala". "Linki e-postama gönder" waits for mail sending
 * (K11). A wrong detection is reported through the existing problem route,
 * which records the browser string; nothing else is stored. It receives no
 * stage name and no question (leak rule).
 */
export function DesktopOnlyScreen({
  token,
  minutes,
  deadlineDay,
  contactEmail,
}: {
  token: string;
  minutes: number;
  deadlineDay: string;
  contactEmail: string | null;
}) {
  const t = useT("hiringGate");
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");
  const [report, setReport] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const link = useRef("");
  const sentNote = useStepFocus<HTMLParagraphElement>(report === "sent" ? "sent" : "form");

  async function onCopy() {
    link.current = candidateLink(window.location.origin, token);
    setCopy(await copyLink(link.current, navigator.clipboard));
  }

  async function onWrong() {
    setReport("sending");
    try {
      await apiSend(token, "/problem", { area: "DESKTOP_GATE", message: t("reportMessage") });
      setReport("sent");
    } catch {
      setReport("failed");
    }
  }

  return (
    <div className="mx-auto max-w-[560px] pt-8 pb-10">
      <h1 className="mt-6 text-[28px] leading-9 font-semibold text-ink">{t("title")}</h1>
      <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{t("why")}</p>
      <ul className="tnum mt-4 flex flex-wrap gap-2 text-[14px] text-ink">
        <li className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3">
          <Clock className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
          {t("minutes", { minutes })}
        </li>
        <li className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3">
          <CalendarDays className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
          {t("deadline", { date: deadlineDay })}
        </li>
      </ul>
      <h2 className="mt-6 text-[16px] font-semibold text-ink">{t("steps")}</h2>
      <ol className="mt-2 space-y-2 text-[16px] leading-[26px] text-ink-2">
        {[t("step1"), t("step2")].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="tnum grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[14px] font-medium text-ink" aria-hidden>
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-8">
        <Button id="gate-copy" variant="primary" size="lg" className="min-h-12 w-full text-[16px]" onClick={onCopy}>
          {copy === "copied" ? t("copied") : t("copy")}
        </Button>
        <p role="status" className="mt-2 text-[14px] leading-[22px] text-ink">
          {copy === "manual" ? t("manual") : ""}
        </p>
        {copy === "manual" ? (
          <input readOnly value={link.current} onFocus={(e) => e.currentTarget.select()} aria-label={t("copy")} className="mt-1 h-12 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[16px] text-ink" />
        ) : null}
      </div>
      <div className="mt-6">
        {report === "sent" ? (
          <p ref={sentNote} tabIndex={-1} role="status" className="text-[14px] leading-[22px] text-ink">
            {contactEmail ? t.rich("wrongSentContact", { email: contactEmail, mail: mailTo(contactEmail) }) : t("wrongSent")}
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={onWrong}
              disabled={report === "sending"}
              className="inline-flex min-h-11 items-center text-left text-[14px] text-ink underline decoration-underline underline-offset-4 disabled:text-muted"
            >
              {report === "sending" ? t("wrongSending") : t("wrong")}
            </button>
            {report === "failed" ? (
              <p role="alert" className="mt-1 text-[14px] leading-[22px] text-ink">
                {t("wrongFailed")}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Wire the gate in `renderHiringPage`**

In `src/solutions/hiring/candidate/pages.tsx` add to the imports (`:1-22`):

```ts
import { headers } from "next/headers";
import { DesktopGate } from "@/components/hiring/candidate/desktop-gate";
import { DesktopOnlyScreen } from "@/components/hiring/candidate/desktop-only";
import { serverDeviceClass } from "@/components/hiring/candidate/device-class";
```

Add above `renderHiringPage` (after `problemCard`, `:83`):

```ts
/** The request's headers; null outside a request (a script calling the renderer): treated as a desktop (plan decision 3). */
async function requestHeaders(): Promise<{ get(name: string): string | null } | null> {
  try {
    return await headers();
  } catch {
    return null;
  }
}
```

Replace `:110-151` (from `const locale` to the end of `case "practice"`) with:

```tsx
  const locale: Locale = isLocale(h.locale) ? h.locale : DEFAULT_LOCALE;
  // Ruling C10: nothing below reads `state` directly; the client gets the stripped copy.
  const safe = candidateSafe(state);
  const frame = (children: ReactNode) => framed(token, locale, safe.orgName, safe.contactEmail, children);

  // HIRING-VISUAL-FLOW 3.0 (K2): a phone gets the desktop-only screen from the server and nothing
  // of the screen it asked for (the builder below never runs); the browser decides the rest. The
  // screen gets the minutes and the last day only: no stage name, no question (leak rule).
  const device = serverDeviceClass(await requestHeaders());
  const desktopOnly = (
    <DesktopOnlyScreen
      token={token}
      minutes={safe.totalMinutes}
      deadlineDay={formatInviteDay(orgDay(h.link.expiresAt, ORG_TIMEZONE), locale)}
      contactEmail={safe.contactEmail}
    />
  );
  const gated = async (screen: () => ReactNode | Promise<ReactNode>) =>
    device === "phone"
      ? frame(desktopOnly)
      : frame(
          <DesktopGate serverClass={device === "unknown" ? "unknown" : "desktop"} desktopOnly={desktopOnly}>
            {await screen()}
          </DesktopGate>,
        );

  switch (slot) {
    case "landing": {
      // A closed opening stops only a candidate who has not started (Task 5); the state says CLOSED then.
      if (safe.step === "CLOSED") return frame(<ClosedCard contactEmail={safe.contactEmail} />);
      return gated(async () => {
        // The text frozen on this invitation, never the organisation's newest one.
        // Shown in the other language (with its own lang) when this one is empty.
        const consent = pickTextLang((await loadConsentText(h.assessment.orgId, h.hiring.consentTextId)).body, locale);
        // The deadline in the invitation e-mail's words: the end of the org's day, the zone named.
        const deadline = formatInviteDeadline(orgDay(h.link.expiresAt, ORG_TIMEZONE), locale, zoneLabel(locale, ORG_TIMEZONE));
        return <Landing token={token} state={safe} consentBody={consent.text} consentLang={consent.lang} deadline={deadline} locale={locale} />;
      });
    }
    case "info":
      return gated(() => (
        <InfoForm
          token={token}
          initial={{ fullName: h.candidate.fullName ?? "", email: h.candidate.email ?? "", phone: h.candidate.phone ?? "", location: h.candidate.location ?? "" }}
        />
      ));
    case "check":
      // Two flags and the page's language: no question, stage or team text reaches the device check.
      return gated(() => <DeviceCheck token={token} camera={safe.devices.camera} practice={safe.practice} locale={locale} contactEmail={safe.contactEmail} />);
    case "stage":
      // Keyed by the stage, so the next stage starts from a fresh runner. The runner gets the
      // stripped candidate state only (no team field, no right answer: C10); the deadline in
      // the same words as the landing and the invitation e-mail.
      return gated(() => (
        <StageRunner
          key={safe.position ?? 0}
          token={token}
          initial={safe}
          deadline={formatInviteDeadline(orgDay(h.link.expiresAt, ORG_TIMEZONE), locale, zoneLabel(locale, ORG_TIMEZONE))}
          locale={locale}
        />
      ));
    case "practice":
      // HIRING-UX 6.4: the camera flag and the page's language only; the warm-up's question is its own, nothing of the version reaches it.
      return gated(() => <Practice token={token} camera={safe.devices.camera} locale={locale} />);
```

`case "done"` (`:152-161`) stays as it is: not gated (decision 2).

- [ ] **Step 8: Hold an unstarted stage in a very narrow window**

In `src/components/hiring/candidate/stage-intro.tsx` add the imports:

```ts
import { DisabledReason } from "@/components/ui/button";
import { useWindowWidth } from "./desktop-gate";
import { startWaitsForWidth } from "./device-class";
```

(`Button` is already imported from the same module: write `import { Button, DisabledReason } from "@/components/ui/button";` once). Inside the component, after `const t = useT("hiringStage");` add:

```ts
  const tg = useT("hiringGate");
  // 3.0: below 640px a stage that has not started waits with its reason; a started one is never held (the clock runs).
  const narrow = startWaitsForWidth(useWindowWidth());
```

and replace the bar at `:101-107` with:

```tsx
      <ActionBar>
        {/* Disabled while it works (its own label says so) or while the window is too narrow (the reason is next to it). */}
        <Button
          id="stage-start"
          variant="primary"
          size="lg"
          className="w-full text-[16px] sm:w-auto"
          disabled={busy || narrow}
          disabledReason={narrow ? tg("narrowStart") : undefined}
          onClick={onStart}
        >
          {busy ? t("starting") : t("start")}
        </Button>
        {narrow ? (
          <DisabledReason id="stage-start-why" className="mt-2 text-[14px]">
            {tg("narrowStart")}
          </DisabledReason>
        ) : null}
        {error}
      </ActionBar>
```

- [ ] **Step 9: Replace HIRING-UX 6.15**

In `docs/design/HIRING-UX.md` replace the body of `### 6.15 Mobil` (`:1161-1167`, the three bullets) with the design's text (HIRING-VISUAL-FLOW 0), quoted as one paragraph:

```markdown
### 6.15 Cihaz (yerine geçti: HIRING-VISUAL-FLOW 3.0, kullanıcı kararı K2, 2026-10-05)

İşe alım aday akışı gözetim seviyesinden bağımsız olarak **yalnızca bilgisayardan** yapılır.
Telefon ve tablet `DesktopOnlyScreen` görür: neden (dürüst, gözetim iddiası yok), linki kopyala,
isteğe bağlı "linki e-postama gönder" (sunucu ucu ve e-posta gönderimi gelince; K11 ile şimdilik
yok). Masaüstü düzeni 1280 ve 1440 için tasarlanır, 1024'te bozulmaz; 1024'ten dar bir masaüstü
penceresi engellenmez, tek sütuna iner ve "Pencereni büyüt" şeridi görür. Eski 6.15'in "telefonda
tamamen yapılabilir", "alt sabit dolu buton" ve "video dikey çerçeve" maddeleri geçersiz. Dokunma
hedefi ≥ 44px ve yazı ≥ 16px kuralları kalır (dokunmatik dizüstü ve erişilebilirlik için). Klavyeli
tablet de engellenir (K11).
```

- [ ] **Step 10: Run the tests**

Run: `pnpm exec vitest run src/components/hiring/candidate/copy-link.test.ts src/i18n/hiring-candidate-copy.test.ts src/solutions/hiring/candidate/pages.test.ts src/i18n/messages.test.ts`
Expected: PASS (copy-link 2, copy +2, pages +5, messages unchanged count).

- [ ] **Step 11: Gates and the verify scripts**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -15`
Expected: clean, build lists the same routes as before (79 per STATUS).

Then on a fresh check database:

```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_flow_check" -c "create database kademe_flow_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm verify:hiring-flow 2>&1 | tail -5
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_flow_check"
```

Expected: "all checks passed", 0 FAIL (the script calls `solutionPage` outside a request: `requestHeaders()` answers null, the pages render as on a desktop). Then the guard, with the dev server on 3100 over `kademe_platform`:

```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm dev --port 3100   # separate shell
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard 2>&1 | tail -3
lsof -nP -iTCP:3100 -sTCP:LISTEN -t | xargs kill
```

Expected: every line `ok`, 0 FAIL.

- [ ] **Step 12: Server check of the phone branch without a browser**

On `kademe_ui_check` (recipe in Global Constraints), `pnpm dev:hiring-link` prints a link; with the dev server on 3100:

```bash
LINK=<the printed /a/... path>
curl -s -A "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" "http://localhost:3100$LINK" | grep -c "Bu değerlendirme bilgisayardan yapılır"
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36" "http://localhost:3100$LINK" | grep -c "Bu değerlendirme bilgisayardan yapılır"
curl -s -A "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" "http://localhost:3100$LINK" | grep -c "LEAKVISIBLE\|TEAMSECRET"
```

Expected: `1`, `0`, `0` (run the last line with a link minted by `pnpm dev:hiring-link --sentinels`).

- [ ] **Step 13: Browser check (Claude in Chrome, desktop side only)**

Load the tools once with `ToolSearch` `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__javascript_tool`. Open the link in a new tab.
1. 1440 and 1280 wide: the landing renders as before (no strip, no desktop-only screen).
2. 1024: no strip. 1000: the strip "Pencere dar. Daha rahat görmek için pencereni büyüt." appears under the top bar; nothing else changes; widen to 1100: the strip is gone without a reload.
3. Tick consent, go on to the first stage intro (the fixture has a warm-up: "Isınmayı atla"). At 600 wide "Aşamayı başlat" is grey with "Pencereni büyüt, sonra başla." next to it, Tab reaches the button and the reader hears the reason (read_page shows `aria-describedby="stage-start-why"`); at 700 it is enabled.
4. EN switch: the strip reads "Your window is narrow. ...".
5. Write in the report: "Telefon ve tablet istemci dalı doğrulanmadı, gerçek cihazda kullanıcıyla (Claude in Chrome masaüstü)."
Stop the server, drop `kademe_ui_check`.

- [ ] **Step 14: Commit**

```bash
git add src/components/hiring/candidate/copy-link.ts src/components/hiring/candidate/copy-link.test.ts src/components/hiring/candidate/desktop-gate.tsx src/components/hiring/candidate/desktop-only.tsx src/components/hiring/candidate/stage-intro.tsx src/solutions/hiring/candidate/pages.tsx src/solutions/hiring/candidate/pages.test.ts src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json src/i18n/hiring-candidate-copy.test.ts docs/design/HIRING-UX.md
git commit -m "Open the hiring candidate flow on computers only

Phones get the desktop-only screen from the server; the browser decides
tablets (keyboard tablets too, K11). The screen copies the same link and
reports a wrong detection through the problem route; it gets no stage name
and no question. A narrow desktop window gets a strip, and below 640px an
unstarted stage waits with its reason. faqPhoneA, needDevice and
deniedNotFound no longer mention a phone (K2). HIRING-UX 6.15 replaced.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 3: V1, illustration tokens, the 15 illustrations, the superseded design text

**Files:**
- Modify: `src/app/globals.css:37-90` (`@theme`: five `--color-illus-*` tokens after the vault colours)
- Modify: `src/components/ui/theme.test.ts:29-42` (the tokens are pinned)
- Create: `src/components/visual/illustrations.tsx`, `src/components/visual/illustrations.test.ts`
- Modify: `src/components/hiring/candidate/desktop-only.tsx` (draws `desktopOnly` above the title)
- Modify: `docs/design/HIRING-UX.md:983-995` (6 "Ortak kurallar": one column, sticky button), `:1356-1359` (8.6), `docs/design/RULES.md:18-20` (rule 1), `:41-42` (rule 9)

**Shared with the exam:** `globals.css` only gains tokens; no existing token or class changes (the theme test proves the old values).

**Interfaces:**
- Consumes: `DesktopOnlyScreen` (Task 2).
- Produces:
  - `type IllustrationName = "welcome" | "consent" | "permission" | "warmup" | "stage" | "done" | "expired" | "closed" | "otherTab" | "desktopOnly" | "inviteReady" | "emptyToday" | "emptyOpenings" | "emptyCandidates" | "emptyLibrary"`
  - `ILLUSTRATION_NAMES: readonly IllustrationName[]` (15)
  - `Illustration(props: { name: IllustrationName; size?: "hero" | "spot" | "phone" | "small"; className?: string })`
  - Tailwind colours `illus-line`, `illus-fill`, `illus-tint`, `illus-sage`, `illus-warm` (from the tokens).

- [ ] **Step 1: Write the failing tests**

Add to `src/components/ui/theme.test.ts`, inside `describe("Kademe tokens keep their meaning")`:

```ts
  it.each([
    ["--color-illus-line", "#131311"],
    ["--color-illus-fill", "#eef6f3"],
    ["--color-illus-tint", "#cfe3da"],
    ["--color-illus-sage", "#9dc6b6"],
    ["--color-illus-warm", "#f1f0ec"],
  ])("illustration tone %s is %s (HIRING-VISUAL-FLOW 2.2: light tones only, never the accent)", (name, value) => {
    expect(theme[name]).toBe(value);
  });
```

Create `src/components/visual/illustrations.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Illustration, ILLUSTRATION_NAMES } from "./illustrations";

const ALLOWED = /^(none|var\(--color-illus-(line|fill|tint|sage|warm)\))$/;

describe("illustrations (HIRING-VISUAL-FLOW 2.2, K1)", () => {
  it("has the eleven candidate and four panel drawings", () => {
    expect(ILLUSTRATION_NAMES).toHaveLength(15);
    expect(new Set(ILLUSTRATION_NAMES).size).toBe(15);
  });

  it.each(ILLUSTRATION_NAMES)("%s is hidden from assistive tech, inline only, and drawn with the illustration tones", (name) => {
    const html = renderToStaticMarkup(createElement(Illustration, { name }));
    expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(html).toContain('focusable="false"');
    // No file, no link, no text to translate, nothing pulled from elsewhere.
    expect(html).not.toMatch(/<image|<img|href=|<text|<foreignObject|url\(/i);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toContain("--color-accent");
    const colours = [...html.matchAll(/\s(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThan(3);
    for (const colour of colours) expect(colour, `${name}: ${colour}`).toMatch(ALLOWED);
  });

  it("sizes by role: hero 400 wide at most, a spot 160, the phone screen 342", () => {
    expect(renderToStaticMarkup(createElement(Illustration, { name: "welcome", size: "hero" }))).toContain("max-w-[400px]");
    expect(renderToStaticMarkup(createElement(Illustration, { name: "closed", size: "spot" }))).toContain("w-[160px]");
    expect(renderToStaticMarkup(createElement(Illustration, { name: "desktopOnly", size: "phone" }))).toContain("max-w-[342px]");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/components/ui/theme.test.ts src/components/visual/illustrations.test.ts`
Expected: FAIL: the five tokens are `undefined`; `./illustrations` not found.

- [ ] **Step 3: Tokens**

In `src/app/globals.css`, inside `@theme`, after `--color-vault-text: #f2f1ed; /* body text on the dark ground */` add:

```css
  /*
   * Illustration tones (HIRING-VISUAL-FLOW 2.2, user decision K1). Drawings
   * never use the saturated accent: the only saturated green on a screen
   * stays the filled button. Used only by components/visual/illustrations.tsx.
   */
  --color-illus-line: #131311; /* = ink */
  --color-illus-fill: #eef6f3; /* = brand-soft */
  --color-illus-tint: #cfe3da;
  --color-illus-sage: #9dc6b6;
  --color-illus-warm: #f1f0ec;
```

- [ ] **Step 4: The drawings**

```tsx
// src/components/visual/illustrations.tsx
// kademe-owned
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * HIRING-VISUAL-FLOW 2.2 (K1): flat, calm spot drawings, hand-written inline
 * SVG. No people, no faces, no photo, no text inside the drawing; only the
 * illustration tones; hidden from assistive technology (the screen's title
 * carries the meaning). They appear only on welcome, consent, permission,
 * finish, problem and empty screens, never on a question screen (G11).
 * Static: no animation (2.3).
 */
export type IllustrationName =
  | "welcome"
  | "consent"
  | "permission"
  | "warmup"
  | "stage"
  | "done"
  | "expired"
  | "closed"
  | "otherTab"
  | "desktopOnly"
  | "inviteReady"
  | "emptyToday"
  | "emptyOpenings"
  | "emptyCandidates"
  | "emptyLibrary";

const LINE = "var(--color-illus-line)";
const FILL = "var(--color-illus-fill)";
const TINT = "var(--color-illus-tint)";
const SAGE = "var(--color-illus-sage)";
const WARM = "var(--color-illus-warm)";
const ink = { stroke: LINE, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

type Drawing = { width: number; height: number; body: ReactNode };

const DRAWINGS: Record<IllustrationName, Drawing> = {
  welcome: {
    width: 400,
    height: 220,
    body: (
      <>
        <rect x="0" y="0" width="400" height="220" rx="16" fill={WARM} />
        <rect x="40" y="150" width="320" height="10" rx="5" fill={TINT} {...ink} />
        <path d="M70 160 V205 M330 160 V205" {...ink} />
        <rect x="140" y="70" width="120" height="78" rx="6" fill={FILL} {...ink} />
        <rect x="152" y="82" width="96" height="54" rx="3" fill={SAGE} />
        <rect x="122" y="146" width="156" height="6" rx="3" fill={TINT} {...ink} />
        <rect x="290" y="118" width="30" height="30" rx="4" fill={SAGE} {...ink} />
        <path d="M305 118 C292 104 292 92 300 82 M305 118 C318 104 322 94 316 84" {...ink} />
        <ellipse cx="297" cy="94" rx="7" ry="4" fill={TINT} {...ink} />
        <ellipse cx="318" cy="96" rx="7" ry="4" fill={TINT} {...ink} />
        <rect x="80" y="124" width="26" height="24" rx="4" fill={FILL} {...ink} />
        <path d="M106 130 q10 0 10 8 q0 8 -10 8 M88 116 q-4 -6 0 -12 M98 116 q-4 -6 0 -12" {...ink} />
      </>
    ),
  },
  consent: {
    width: 160,
    height: 120,
    body: (
      <>
        <circle cx="80" cy="60" r="52" fill={WARM} />
        <path d="M80 22 L112 34 V60 C112 82 98 96 80 102 C62 96 48 82 48 60 V34 Z" fill={FILL} {...ink} />
        <path d="M64 60 L76 72 L98 48" {...ink} strokeWidth={2.5} />
      </>
    ),
  },
  permission: {
    width: 400,
    height: 220,
    body: (
      <>
        <rect x="20" y="20" width="360" height="180" rx="12" fill={WARM} {...ink} />
        <path d="M20 56 H380" {...ink} />
        <circle cx="38" cy="38" r="4" fill={TINT} />
        <circle cx="52" cy="38" r="4" fill={TINT} />
        <rect x="76" y="28" width="268" height="20" rx="10" fill={FILL} {...ink} />
        <circle cx="94" cy="38" r="9" fill={SAGE} {...ink} />
        <rect x="88" y="34" width="8" height="8" rx="1.5" {...ink} />
        <path d="M96 38 l4 -3 v6 z" {...ink} />
        <path d="M94 50 V64" {...ink} strokeDasharray="3 4" />
        <circle cx="94" cy="78" r="12" fill={TINT} {...ink} />
        <path d="M91 74 l4 -3 v14" {...ink} />
        <rect x="56" y="108" width="288" height="72" rx="8" fill={FILL} {...ink} />
        <path d="M76 128 H244 M76 146 H204 M76 164 H228" {...ink} />
      </>
    ),
  },
  warmup: {
    width: 160,
    height: 120,
    body: (
      <>
        <circle cx="80" cy="64" r="48" fill={WARM} />
        <rect x="56" y="58" width="44" height="40" rx="6" fill={FILL} {...ink} />
        <path d="M100 66 q14 0 14 12 q0 12 -14 12 M66 50 q-6 -8 0 -16 M78 50 q-6 -8 0 -16 M90 50 q-6 -8 0 -16" {...ink} />
        <path d="M48 104 H112" {...ink} />
      </>
    ),
  },
  stage: {
    width: 160,
    height: 120,
    body: (
      <>
        <rect x="0" y="0" width="160" height="120" rx="12" fill={WARM} />
        <path d="M20 100 C60 100 50 60 90 60 C120 60 120 30 140 30" fill="none" {...ink} strokeDasharray="4 5" />
        <path d="M40 100 V70 M40 70 h18 l-5 6 l5 6 h-18" fill={SAGE} {...ink} />
        <path d="M128 30 V8 M128 8 h18 l-5 6 l5 6 h-18" fill={TINT} {...ink} />
      </>
    ),
  },
  done: {
    width: 400,
    height: 200,
    body: (
      <>
        <rect x="0" y="0" width="400" height="200" rx="16" fill={WARM} />
        <rect x="120" y="70" width="160" height="104" rx="8" fill={FILL} {...ink} />
        <path d="M120 78 L200 132 L280 78" {...ink} />
        <circle cx="270" cy="72" r="20" fill={SAGE} {...ink} />
        <path d="M261 72 L268 79 L280 65" {...ink} strokeWidth={2.5} />
        <path d="M40 60 C80 30 110 40 130 30" {...ink} strokeDasharray="4 6" />
        <path d="M134 26 L162 16 L150 42 L144 32 Z" fill={TINT} {...ink} />
      </>
    ),
  },
  expired: {
    width: 160,
    height: 120,
    body: (
      <>
        <circle cx="80" cy="60" r="52" fill={WARM} />
        <path d="M58 24 H90 M58 96 H90 M62 24 C62 48 86 48 86 60 C86 72 62 72 62 96 M86 24 C86 48 62 48 62 60" fill="none" {...ink} />
        <path d="M66 92 C68 82 80 82 82 92 Z" fill={SAGE} {...ink} />
        <rect x="96" y="56" width="40" height="38" rx="5" fill={FILL} {...ink} />
        <path d="M96 66 H136 M106 52 V60 M126 52 V60" {...ink} />
        <rect x="106" y="74" width="8" height="8" rx="1" fill={TINT} />
      </>
    ),
  },
  closed: {
    width: 160,
    height: 120,
    body: (
      <>
        <rect x="0" y="0" width="160" height="120" rx="12" fill={WARM} />
        <rect x="52" y="14" width="56" height="96" rx="4" fill={FILL} {...ink} />
        <rect x="60" y="22" width="40" height="36" rx="2" fill={TINT} {...ink} />
        <rect x="60" y="66" width="40" height="36" rx="2" fill={TINT} {...ink} />
        <circle cx="98" cy="62" r="3" fill={SAGE} {...ink} />
        <path d="M30 110 H130" {...ink} />
      </>
    ),
  },
  otherTab: {
    width: 160,
    height: 120,
    body: (
      <>
        <rect x="0" y="0" width="160" height="120" rx="12" fill={WARM} />
        <rect x="18" y="20" width="84" height="64" rx="6" fill={FILL} {...ink} />
        <path d="M18 34 H102" {...ink} />
        <rect x="58" y="40" width="84" height="64" rx="6" fill={TINT} {...ink} />
        <path d="M58 54 H142 M70 70 H118 M70 84 H106" {...ink} />
      </>
    ),
  },
  desktopOnly: {
    width: 342,
    height: 140,
    body: (
      <>
        <rect x="0" y="0" width="342" height="140" rx="14" fill={WARM} />
        <rect x="40" y="30" width="44" height="80" rx="8" fill={FILL} {...ink} />
        <path d="M56 100 H68" {...ink} />
        <path d="M104 70 H200" {...ink} strokeDasharray="5 6" />
        <path d="M192 62 L204 70 L192 78" {...ink} />
        <rect x="222" y="34" width="84" height="56" rx="5" fill={FILL} {...ink} />
        <rect x="230" y="42" width="68" height="40" rx="2" fill={SAGE} />
        <rect x="210" y="90" width="108" height="8" rx="4" fill={TINT} {...ink} />
      </>
    ),
  },
  inviteReady: {
    width: 96,
    height: 96,
    body: (
      <>
        <circle cx="48" cy="48" r="44" fill={WARM} />
        <rect x="18" y="44" width="30" height="16" rx="8" fill={FILL} {...ink} transform="rotate(-30 33 52)" />
        <rect x="40" y="32" width="30" height="16" rx="8" fill={TINT} {...ink} transform="rotate(-30 55 40)" />
        <path d="M62 70 L84 60 L76 80 L71 72 Z" fill={SAGE} {...ink} />
      </>
    ),
  },
  emptyToday: {
    width: 160,
    height: 120,
    body: (
      <>
        <rect x="0" y="0" width="160" height="120" rx="12" fill={WARM} />
        <rect x="70" y="18" width="64" height="84" rx="6" fill={FILL} {...ink} />
        <path d="M80 38 l4 4 l8 -8 M98 38 H124 M80 58 l4 4 l8 -8 M98 58 H124 M80 78 l4 4 l8 -8 M98 78 H124" {...ink} />
        <rect x="24" y="64" width="30" height="30" rx="5" fill={SAGE} {...ink} />
        <path d="M54 70 q10 0 10 9 q0 9 -10 9 M32 56 q-4 -6 0 -12 M44 56 q-4 -6 0 -12" {...ink} />
      </>
    ),
  },
  emptyOpenings: {
    width: 160,
    height: 120,
    body: (
      <>
        <rect x="0" y="0" width="160" height="120" rx="12" fill={WARM} />
        <rect x="26" y="20" width="108" height="76" rx="6" fill={FILL} {...ink} />
        <rect x="44" y="40" width="40" height="30" rx="3" fill={TINT} {...ink} transform="rotate(-6 64 55)" />
        <circle cx="64" cy="38" r="4" fill={SAGE} {...ink} />
        <path d="M50 96 L44 110 M110 96 L116 110" {...ink} />
      </>
    ),
  },
  emptyCandidates: {
    width: 160,
    height: 120,
    body: (
      <>
        <rect x="0" y="0" width="160" height="120" rx="12" fill={WARM} />
        <path d="M34 50 L80 34 L126 50 L80 66 Z" fill={TINT} {...ink} />
        <path d="M34 50 V90 L80 106 L126 90 V50 M80 66 V106" fill={FILL} {...ink} />
      </>
    ),
  },
  emptyLibrary: {
    width: 160,
    height: 120,
    body: (
      <>
        <rect x="0" y="0" width="160" height="120" rx="12" fill={WARM} />
        <path d="M24 92 H136 M24 52 H136" {...ink} />
        <rect x="36" y="22" width="12" height="30" rx="2" fill={SAGE} {...ink} />
        <rect x="50" y="26" width="12" height="26" rx="2" fill={TINT} {...ink} />
        <rect x="66" y="28" width="10" height="24" rx="2" fill={FILL} {...ink} transform="rotate(12 71 40)" />
        <rect x="96" y="66" width="12" height="26" rx="2" fill={TINT} {...ink} />
      </>
    ),
  },
};

export const ILLUSTRATION_NAMES = Object.keys(DRAWINGS) as IllustrationName[];

const SIZE = {
  hero: "w-full max-w-[400px] lg:max-w-[340px] xl:max-w-[400px]",
  spot: "w-[160px]",
  phone: "w-full max-w-[342px]",
  small: "w-24",
} as const;

export function Illustration({ name, size = "spot", className }: { name: IllustrationName; size?: keyof typeof SIZE; className?: string }) {
  const drawing = DRAWINGS[name];
  return (
    <svg
      viewBox={`0 0 ${drawing.width} ${drawing.height}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("h-auto shrink-0", SIZE[size], className)}
    >
      {drawing.body}
    </svg>
  );
}
```

The `ink` spread carries `stroke`, so every stroked shape names its colour; shapes without a stroke name their `fill`; the root `fill="none"` covers the rest (an SVG shape without a fill would otherwise be black).

- [ ] **Step 5: The phone screen gets its drawing**

In `src/components/hiring/candidate/desktop-only.tsx` add `import { Illustration } from "@/components/visual/illustrations";` and, as the first child of the root `<div>`, `<Illustration name="desktopOnly" size="phone" />`.

- [ ] **Step 6: Run the tests**

Run: `pnpm exec vitest run src/components/ui/theme.test.ts src/components/visual/illustrations.test.ts src/solutions/hiring/candidate/pages.test.ts`
Expected: PASS (theme +5, illustrations 17, pages unchanged).

- [ ] **Step 7: The superseded design text**

`docs/design/HIRING-UX.md`, section 6 "Ortak kurallar" (`:985-990`): replace the bullet "Tek sütun. Okuma metni en fazla 640px, video ekranları 960px, çerçeve 1000px (RULES.md)." with "Tek karar (G1). Hazırlık ve bitiş ekranları iki bölge (başlık solda ~400px, içerik sağda ~520px), soru ekranları tek odaklı (yazılı ve seçmeli 760px, video ve ses iki bölge); çerçeve 1000px; 1024'ten dar pencerede tek sütun (HIRING-VISUAL-FLOW G10)." and the bullet "Her ekranda tek dolu buton. Mobilde dolu buton altta sabit çubukta (güvenli alan payıyla)." with "Her ekranda tek dolu buton, hep aynı yerde: görünüm alanının altına yapışık `StepFooter`'ın sağında, kapalıysa nedeni solunda (HIRING-VISUAL-FLOW G9)."

`### 8.6 İkon ve görsel` (`:1356-1359`): replace the body with "`lucide-react` (zaten bağımlılık): anlam taşıyan ikon nötr kutuda (40px, `bg-secondary`), 20px, 1.75 çizgi (HIRING-VISUAL-FLOW G5). Çizim (illüstrasyon) yalnızca karşılama, onay, cihaz izni, bitti, sorun, 'bilgisayardan aç' ve panelin boş durum ekranlarında; soru ekranında asla (kullanıcı kararı K1, HIRING-VISUAL-FLOW 2.2). Çizimler satır içi SVG, `aria-hidden`, yalnızca `--color-illus-*` tonları, doygun accent yok. Aday tarafında şirket logosu varsa ilk görsel odur."

`docs/design/RULES.md` rule 1 (`:18-20`): append "Illustrations never use the accent: they draw with the five `--color-illus-*` tones only (HIRING-VISUAL-FLOW 2.2)." Rule 9 (`:41-42`): replace "one column, one decision per screen." with "one decision per screen (preparation and finish screens may use two regions, question screens keep one focus; HIRING-VISUAL-FLOW G10)."

- [ ] **Step 8: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && grep -rn $'\xe2\x80\x94' src/components/visual docs/design/HIRING-UX.md docs/design/RULES.md src/app/globals.css; echo "dash exit $?"`
Expected: clean, `dash exit 1`.

- [ ] **Step 9: Browser check**

On `kademe_ui_check` with the dev server on 3100, open `/dev/ui` (logged in through `/login`) only to confirm the app still builds its CSS (the new tokens add nothing visible yet). In the candidate tab nothing visible changes in this task except on a phone (not testable in Claude in Chrome: "doğrulanmadı, gerçek telefonda"). Run `curl -s -A "<iPhone UA from Task 2 Step 12>" http://localhost:3100<link> | grep -c 'aria-hidden="true" focusable="false"'`: expected `1`.

- [ ] **Step 10: Commit**

```bash
git add src/app/globals.css src/components/ui/theme.test.ts src/components/visual/illustrations.tsx src/components/visual/illustrations.test.ts src/components/hiring/candidate/desktop-only.tsx docs/design/HIRING-UX.md docs/design/RULES.md
git commit -m "Add the illustration tones and the fifteen inline drawings

Five named light tones (never the accent) and hand-written SVG drawings,
hidden from assistive tech, with no file, link or text. The phone screen
gets its drawing. HIRING-UX 6 and 8.6 and RULES 1 and 9 now say what K1
and G9/G10 decided.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 4: V2 part 1, the shared building blocks and their pure models

**Files:**
- Create (models): `src/components/visual/journey.ts`, `ring.ts`, `footer-action.ts`, `choice-keys.ts`
- Create (tests): `src/components/visual/models.test.ts`, `src/components/visual/blocks.test.ts`
- Create (components): `src/components/visual/step-screen.tsx`, `step-footer.tsx`, `journey-progress.tsx`, `question-progress.tsx`, `disclosure.tsx`, `icon-row.tsx`, `fact-tiles.tsx`, `path-steps.tsx`, `choice-card.tsx`, `timer-ring.tsx`, `status-screen.tsx`, `media-stage.tsx`
- Modify: `src/app/globals.css:314-322` (after `@keyframes rec-pulse`: `step-in`, `fade-in`; the step footer scroll padding)

**Shared with the exam:** `globals.css` gains two keyframes and one `:has()` rule scoped to `[data-step-footer]`, which no exam page renders.

**Interfaces:**
- Consumes: `Illustration`, `IllustrationName` (Task 3); `formatCountdown` from `@/lib/timer`; `Collapsible*` from `@/components/ui/collapsible`; `Button`, `buttonVariants`, `DisabledReason` from `@/components/ui/button`; `Spinner` from `@/components/ui/spinner`.
- Produces (exact exports, used by Tasks 5-22):
  - `journey.ts`: `type JourneyKey = "prep" | "device" | "warmup" | "questions"`; `journeySteps(input: { device: boolean; warmup: boolean }): JourneyKey[]`; `journeyPosition(steps: JourneyKey[], at: JourneyKey): { current: number; total: number }`
  - `ring.ts`: `ringGeometry(input: { remainingMs: number; totalMs: number; size: 96 | 128 }): { radius: number; circumference: number; offset: number; ratio: number; seconds: number }`; `lastSeconds(ms: number): boolean`
  - `footer-action.ts`: `type FooterAction = { kind: "button"; id: string; label: string; onClick: () => void; busy?: boolean; busyLabel?: string; waitReason?: string | null } | { kind: "link"; id: string; label: string; href: string }`; `footerButtonState(action: Extract<FooterAction, { kind: "button" }>): { mode: "ready" | "busy" | "waiting"; label: string; reason: string | null; describedBy: string | undefined }`
  - `choice-keys.ts`: `choiceLetter(index: number): string`; `choiceShortcut(index: number): string | null`
  - `StepScreen(props: { layout: "split" | "single"; illustration?: IllustrationName; illustrationSize?: "hero" | "spot"; kicker?: ReactNode; title: ReactNode; titleRef?: Ref<HTMLHeadingElement>; lead?: ReactNode; aside?: ReactNode; children?: ReactNode; width?: 640 | 760 | 1000 })`
  - `StepFooter(props: { primary?: FooterAction | null; secondary?: FooterAction | null; back?: { label: string; onClick?: () => void; href?: string } | null; journey?: { steps: number; current: number; label: string } | null; hint?: string | null; note?: ReactNode; placement?: "viewport" | "sticky" })` (`hint`: a calm line left of the button when it does not wait, e.g. "Süre, bastığında başlar.")
  - `JourneyProgress(props: { steps: number; current: number; label: string })`, `QuestionProgress(props: { total: number; current: number })`
  - `Disclosure(props: { label: ReactNode; icon?: LucideIcon; defaultOpen?: boolean; variant?: "row" | "inline"; children: ReactNode; className?: string })`
  - `IconRow(props: { icon: LucideIcon; title: ReactNode; detail?: ReactNode; tone?: "default" | "negative" })`
  - `FactTiles(props: { items: Array<{ icon: LucideIcon; value: string; label: string }> })`
  - `PathSteps(props: { steps: Array<{ title: ReactNode; detail?: ReactNode; state?: "done" | "current" | "todo"; action?: ReactNode }>; label?: string })`
  - `type ChoiceItem = { value: string; label: ReactNode; marker?: string | LucideIcon; shortcut?: string | null; description?: ReactNode; disabled?: boolean }`; `ChoiceCardGroup(props: { type: "single" | "multi"; name: string; value: string[]; onChange(next: string[]): void; items: ChoiceItem[]; size?: "md" | "square"; columns?: 1 | 2 | 3 | 5; labelledBy?: string; describedBy?: string; disabled?: boolean })`
  - `TimerRing(props: { remainingMs: number; totalMs: number; label: string; caption: string; size?: 96 | 128 })`
  - `StatusScreen(props: { illustration?: IllustrationName; title: ReactNode; titleRef?: Ref<HTMLHeadingElement>; body?: ReactNode; children?: ReactNode; footer?: ReactNode })`
  - `MediaStage(props: { question: ReactNode; preview: ReactNode; below?: ReactNode })`

- [ ] **Step 1: Write the failing model tests**

```ts
// src/components/visual/models.test.ts
import { describe, expect, it } from "vitest";
import { choiceLetter, choiceShortcut } from "./choice-keys";
import { footerButtonState } from "./footer-action";
import { journeyPosition, journeySteps } from "./journey";
import { lastSeconds, ringGeometry } from "./ring";

describe("the journey (G3): Hazırlık · Cihaz · Isınma · Sorular", () => {
  it("drops the device and warm-up parts the assessment does not have", () => {
    expect(journeySteps({ device: true, warmup: true })).toEqual(["prep", "device", "warmup", "questions"]);
    expect(journeySteps({ device: true, warmup: false })).toEqual(["prep", "device", "questions"]);
    expect(journeySteps({ device: false, warmup: false })).toEqual(["prep", "questions"]);
  });

  it("numbers the part a screen belongs to, 1-based", () => {
    const steps = journeySteps({ device: true, warmup: true });
    expect(journeyPosition(steps, "prep")).toEqual({ current: 1, total: 4 });
    expect(journeyPosition(steps, "questions")).toEqual({ current: 4, total: 4 });
    expect(journeyPosition(journeySteps({ device: false, warmup: false }), "questions")).toEqual({ current: 2, total: 2 });
  });

  it("refuses a part the journey does not have (a screen that should not exist)", () => {
    expect(() => journeyPosition(["prep", "questions"], "device")).toThrow(/device/);
  });
});

describe("the ring timer (K4)", () => {
  it("shortens a step every second, never in between, and never turns past empty or full", () => {
    const full = ringGeometry({ remainingMs: 30_000, totalMs: 30_000, size: 128 });
    expect(full.ratio).toBe(1);
    expect(full.offset).toBe(0);
    expect(full.seconds).toBe(30);
    // 29.4 s left reads as 30 (the clock shows whole seconds, the ring agrees with it).
    expect(ringGeometry({ remainingMs: 29_400, totalMs: 30_000, size: 128 }).seconds).toBe(30);
    const half = ringGeometry({ remainingMs: 15_000, totalMs: 30_000, size: 128 });
    expect(half.ratio).toBe(0.5);
    expect(half.offset).toBeCloseTo(half.circumference / 2, 6);
    expect(ringGeometry({ remainingMs: -5, totalMs: 30_000, size: 96 })).toMatchObject({ ratio: 0, seconds: 0 });
    expect(ringGeometry({ remainingMs: 99_000, totalMs: 30_000, size: 96 }).ratio).toBe(1);
    expect(ringGeometry({ remainingMs: 1000, totalMs: 0, size: 96 }).ratio).toBe(0);
  });

  it("fits the stroke inside the box", () => {
    expect(ringGeometry({ remainingMs: 1, totalMs: 1, size: 128 }).radius).toBe(58);
    expect(ringGeometry({ remainingMs: 1, totalMs: 1, size: 96 }).radius).toBe(42);
  });

  it("names the last ten seconds only by its words (3.8: no red, no blink)", () => {
    expect(lastSeconds(10_000)).toBe(true);
    expect(lastSeconds(10_001)).toBe(false);
    expect(lastSeconds(0)).toBe(false);
  });
});

describe("the footer's filled button (G2, G9, plan decision 4)", () => {
  const base = { kind: "button" as const, id: "next", label: "Sonraki soru", onClick: () => undefined };

  it("is ready with nothing to wait for", () => {
    expect(footerButtonState(base)).toEqual({ mode: "ready", label: "Sonraki soru", reason: null, describedBy: undefined });
  });

  it("never waits without saying why, next to it, linked by id + -why", () => {
    expect(footerButtonState({ ...base, waitReason: "Bir seçenek seç." })).toEqual({ mode: "waiting", label: "Sonraki soru", reason: "Bir seçenek seç.", describedBy: "next-why" });
  });

  it("while it works keeps its filled look and says so on itself (never pale for a second without a word)", () => {
    expect(footerButtonState({ ...base, busy: true, busyLabel: "Kaydediliyor", waitReason: "x" })).toEqual({ mode: "busy", label: "Kaydediliyor", reason: null, describedBy: undefined });
    expect(footerButtonState({ ...base, busy: true }).label).toBe("Sonraki soru");
  });
});

describe("choice cards (G6, 3.7)", () => {
  it("marks choices with letters and offers keys 1-9 only", () => {
    expect([0, 1, 2, 25].map(choiceLetter)).toEqual(["A", "B", "C", "Z"]);
    expect(choiceLetter(26)).toBe("27");
    expect(choiceShortcut(0)).toBe("1");
    expect(choiceShortcut(8)).toBe("9");
    expect(choiceShortcut(9)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/components/visual/models.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: The models**

```ts
// src/components/visual/journey.ts
/** HIRING-VISUAL-FLOW G3: the preparation journey; parts the assessment does not have are dropped (2, 3 or 4 parts). */
export type JourneyKey = "prep" | "device" | "warmup" | "questions";

export function journeySteps(input: { device: boolean; warmup: boolean }): JourneyKey[] {
  return ["prep", ...(input.device ? (["device"] as const) : []), ...(input.warmup ? (["warmup"] as const) : []), "questions"];
}

export function journeyPosition(steps: JourneyKey[], at: JourneyKey): { current: number; total: number } {
  const index = steps.indexOf(at);
  if (index < 0) throw new Error(`journey has no "${at}" part`);
  return { current: index + 1, total: steps.length };
}
```

```ts
// src/components/visual/ring.ts
/**
 * K4: the think and answer clocks are a ring. It shortens one step per second
 * (whole seconds, like the digits in its middle), never slides, never turns
 * red; the stroke sits inside the box.
 */
const STROKE = 6;

export function ringGeometry(input: { remainingMs: number; totalMs: number; size: 96 | 128 }) {
  const radius = input.size / 2 - STROKE;
  const circumference = 2 * Math.PI * radius;
  const seconds = Math.max(0, Math.ceil(input.remainingMs / 1000));
  const ratio = input.totalMs > 0 ? Math.min(1, (seconds * 1000) / input.totalMs) : 0;
  return { radius, circumference, offset: circumference * (1 - ratio), ratio, seconds };
}

/** 3.8: in the last ten seconds only the caption changes ("Son saniyeler"). */
export const lastSeconds = (ms: number) => ms > 0 && ms <= 10_000;
```

```ts
// src/components/visual/footer-action.ts
/**
 * G2, G9 and plan decision 4: the one filled button of a step screen, as data,
 * so the footer draws it and no screen can disable it without a reason. A
 * button that works keeps its filled look (aria-disabled and a spinner, its
 * label says what it does); a button that waits for the candidate turns grey
 * and its reason stands next to it, linked by `id` + `-why`.
 */
export type FooterAction =
  | { kind: "button"; id: string; label: string; onClick: () => void; busy?: boolean; busyLabel?: string; waitReason?: string | null }
  | { kind: "link"; id: string; label: string; href: string };

export function footerButtonState(action: Extract<FooterAction, { kind: "button" }>) {
  if (action.busy) return { mode: "busy" as const, label: action.busyLabel ?? action.label, reason: null, describedBy: undefined };
  if (action.waitReason) return { mode: "waiting" as const, label: action.label, reason: action.waitReason, describedBy: `${action.id}-why` };
  return { mode: "ready" as const, label: action.label, reason: null, describedBy: undefined };
}
```

```ts
// src/components/visual/choice-keys.ts
/** 3.7: a letter is the visible mark of a choice; the digits 1-9 are its keyboard shortcut (shown as a key). */
export const choiceLetter = (index: number) => (index < 26 ? String.fromCharCode(65 + index) : String(index + 1));
export const choiceShortcut = (index: number) => (index < 9 ? String(index + 1) : null);
```

Run: `pnpm exec vitest run src/components/visual/models.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 4: Write the failing block tests**

```ts
// src/components/visual/blocks.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Clock } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ChoiceCardGroup } from "./choice-card";
import { IconRow } from "./icon-row";
import { JourneyProgress } from "./journey-progress";
import { PathSteps } from "./path-steps";
import { StatusScreen } from "./status-screen";
import { StepFooter } from "./step-footer";
import { StepScreen } from "./step-screen";
import { TimerRing } from "./timer-ring";

const html = (type: Parameters<typeof createElement>[0], props: Record<string, unknown>) => renderToStaticMarkup(createElement(type as never, props as never));
const noop = () => undefined;

describe("StepFooter (G9)", () => {
  it("draws a waiting button grey, with its reason next to it and linked", () => {
    const out = html(StepFooter, { primary: { kind: "button", id: "consent-go", label: "Kabul et ve başla", onClick: noop, waitReason: "Önce kutuyu işaretle." } });
    expect(out).toMatch(/<button[^>]*id="consent-go"[^>]*disabled=""/);
    expect(out).toMatch(/<button[^>]*aria-describedby="consent-go-why"/);
    expect(out).toMatch(/<p id="consent-go-why"[^>]*>Önce kutuyu işaretle\.<\/p>/);
    expect(out).toContain("data-step-footer");
  });

  it("keeps a working button filled, aria-disabled and busy, never grey", () => {
    const out = html(StepFooter, { primary: { kind: "button", id: "next", label: "Sonraki soru", busyLabel: "Kaydediliyor", busy: true, onClick: noop } });
    expect(out).toMatch(/<button[^>]*aria-disabled="true"/);
    expect(out).toMatch(/<button[^>]*aria-busy="true"/);
    expect(out).not.toMatch(/<button[^>]*disabled=""/);
    expect(out).toContain("bg-accent");
    expect(out).toContain("Kaydediliyor");
  });

  it("draws a link as a real anchor with the filled look, the way back as a text button, and the journey on its edge", () => {
    const out = html(StepFooter, {
      primary: { kind: "link", id: "practice-ready", label: "Hazırım", href: "/a/t/stage/1" },
      back: { label: "Isınmayı atla", href: "/a/t/stage/1" },
      journey: { steps: 4, current: 3, label: "Isınma · Adım 3 / 4" },
    });
    expect(out).toMatch(/<a[^>]*href="\/a\/t\/stage\/1"[^>]*id="practice-ready"|<a[^>]*id="practice-ready"[^>]*href="\/a\/t\/stage\/1"/);
    expect(out).toContain("Isınmayı atla");
    expect(out).toMatch(/<ol[^>]*aria-label="Isınma · Adım 3 \/ 4"/);
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("leaves the content uncovered: a spacer the height of the bar comes first", () => {
    expect(html(StepFooter, { primary: null })).toMatch(/^<div aria-hidden="true" class="h-\[112px\]/);
    expect(html(StepFooter, { primary: null, placement: "sticky" })).not.toContain("h-[112px]");
  });
});

describe("JourneyProgress (G3)", () => {
  it("is a list with one current step and a visible-to-readers label", () => {
    const out = html(JourneyProgress, { steps: 3, current: 2, label: "Cihaz · Adım 2 / 3" });
    expect(out.match(/<li/g)).toHaveLength(3);
    expect(out).toMatch(/<li[^>]*aria-current="step"/);
  });
});

describe("TimerRing (K4)", () => {
  it("is one image to a screen reader, with the time in words, and shows the digits in tabular figures", () => {
    const out = html(TimerRing, { remainingMs: 18_000, totalMs: 30_000, label: "Düşünme süren 0:18", caption: "düşünme" });
    expect(out).toMatch(/^<div role="img" aria-label="Düşünme süren 0:18"/);
    expect(out).toContain("tnum");
    expect(out).toContain("0:18");
    expect(out).toContain("stroke-dashoffset");
  });
});

describe("ChoiceCardGroup (G6)", () => {
  it("is native radios in cards, the chosen one checked, letters as marks and keys as a hint", () => {
    const out = html(ChoiceCardGroup, {
      type: "single",
      name: "q1",
      value: ["b"],
      onChange: noop,
      items: [
        { value: "a", label: "Bir", marker: "A", shortcut: "1" },
        { value: "b", label: "İki", marker: "B", shortcut: "2" },
      ],
    });
    expect(out.match(/<input[^>]*type="radio"/g)).toHaveLength(2);
    expect(out).toMatch(/<input[^>]*value="b"[^>]*checked=""|<input[^>]*checked=""[^>]*value="b"/);
    expect(out).toContain("<kbd");
    expect(out).toMatch(/role="radiogroup"/);
  });

  it("uses checkboxes for multiple choice", () => {
    expect(html(ChoiceCardGroup, { type: "multi", name: "q2", value: [], onChange: noop, items: [{ value: "a", label: "Bir" }] })).toMatch(/type="checkbox"/);
  });
});

describe("StatusScreen, IconRow and PathSteps", () => {
  it("StatusScreen leads with a hidden drawing and a heading", () => {
    const out = html(StatusScreen, { illustration: "closed", title: "Bu pozisyon için değerlendirme kapandı", body: "İlgin için teşekkürler." });
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"[\s\S]*<h1[^>]*>Bu pozisyon için değerlendirme kapandı<\/h1>/);
  });

  it("IconRow puts a meaningful icon in a neutral box, hidden from readers", () => {
    const out = html(IconRow, { icon: Clock, title: "Bağlantı ve yükleme sorunları" });
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(out).toContain("bg-secondary");
  });

  it("PathSteps marks the current step for readers and draws done steps with a check", () => {
    const out = html(PathSteps, { steps: [{ title: "Bir", state: "done" }, { title: "İki", state: "current" }, { title: "Üç" }] });
    expect(out.match(/<li/g)).toHaveLength(3);
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("StepScreen split puts the title region first and becomes one column below 1024px", () => {
    const out = html(StepScreen, { layout: "split", title: "Merhaba Elif", illustration: "welcome", lead: "Kısa." });
    expect(out).toContain("lg:grid-cols-");
    expect(out).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Merhaba Elif<\/h1>/);
  });
});
```

Run: `pnpm exec vitest run src/components/visual/blocks.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 5: The components**

```tsx
// src/components/visual/step-screen.tsx
// kademe-owned
import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import { Illustration, type IllustrationName } from "./illustrations";

/**
 * G4, G10: a preparation or finish screen has two regions (title, one
 * sentence and a drawing on the left, the content on the right); a question
 * screen has one focus. Below 1024px both fall to one column. The title takes
 * focus on a step change (the caller passes useStepFocus's ref).
 */
export function StepScreen({
  layout,
  illustration,
  illustrationSize = "hero",
  kicker,
  title,
  titleRef,
  lead,
  aside,
  children,
  width = 760,
}: {
  layout: "split" | "single";
  illustration?: IllustrationName;
  illustrationSize?: "hero" | "spot";
  kicker?: ReactNode;
  title: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  lead?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  width?: 640 | 760 | 1000;
}) {
  // A spot drawing (160px) sits above the title, a hero drawing (400px) under the lead.
  const head = (
    <div className="min-w-0">
      {illustration && illustrationSize === "spot" ? <Illustration name={illustration} size="spot" className="mb-6" /> : null}
      {kicker ? <p className="text-[14px] leading-[22px] text-muted">{kicker}</p> : null}
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="mt-2 text-[28px] leading-9 font-semibold text-ink outline-none lg:text-[34px] lg:leading-[42px] xl:text-[40px] xl:leading-[48px]"
      >
        {title}
      </h1>
      {lead ? <div className="mt-3 text-[16px] leading-[26px] text-ink-2">{lead}</div> : null}
      {illustration && illustrationSize === "hero" ? <Illustration name={illustration} size="hero" className="mt-8" /> : null}
      {aside ? <div className="mt-6">{aside}</div> : null}
    </div>
  );
  if (layout === "single") {
    return (
      <section className={cn("mx-auto pt-10 pb-6 motion-safe:animate-[step-in_200ms_ease-out] motion-reduce:animate-[fade-in_200ms_ease-out]", width === 640 ? "max-w-[640px]" : width === 1000 ? "max-w-[1000px]" : "max-w-[760px]")}>
        {head}
        {children ? <div className="mt-8">{children}</div> : null}
      </section>
    );
  }
  return (
    <section className="grid gap-8 pt-10 pb-6 motion-safe:animate-[step-in_200ms_ease-out] motion-reduce:animate-[fade-in_200ms_ease-out] lg:grid-cols-[minmax(0,340px)_minmax(0,520px)] lg:justify-between xl:grid-cols-[minmax(0,400px)_minmax(0,520px)]">
      {head}
      <div className="min-w-0">{children}</div>
    </section>
  );
}
```

```tsx
// src/components/visual/journey-progress.tsx
// kademe-owned
import { cn } from "@/lib/cn";

/** G3: the preparation journey as a list of parts; numbers only, never a stage name (leak rule). */
export function JourneyProgress({ steps, current, label }: { steps: number; current: number; label: string }) {
  return (
    <ol aria-label={label} className="flex h-1 w-full gap-1">
      {Array.from({ length: steps }, (_, i) => (
        <li key={i} aria-current={i + 1 === current ? "step" : undefined} className="relative h-1 flex-1 overflow-hidden rounded-full bg-hairline">
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-0 left-0 rounded-full bg-ink-3 transition-[width] duration-[240ms] ease-soft motion-reduce:transition-none",
              i + 1 < current ? "w-full" : i + 1 === current ? "w-1/2" : "w-0",
            )}
          />
          <span className="sr-only">{i + 1}</span>
        </li>
      ))}
    </ol>
  );
}
```

```tsx
// src/components/visual/question-progress.tsx
// kademe-owned
import { cn } from "@/lib/cn";

/** 3.6: one part per question of the stage; the words "Soru n / m" next to it are what a reader hears. */
export function QuestionProgress({ total, current }: { total: number; current: number }) {
  return (
    <div aria-hidden className="flex h-1 w-full gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-1 flex-1 rounded-full", i + 1 < current ? "bg-ink-3" : i + 1 === current ? "bg-ink-3/60" : "bg-hairline")} />
      ))}
    </div>
  );
}
```

```tsx
// src/components/visual/step-footer.tsx
// kademe-owned
"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { footerButtonState, type FooterAction } from "./footer-action";
import { JourneyProgress } from "./journey-progress";

function Action({ action, variant }: { action: FooterAction; variant: "primary" | "secondary" }) {
  const size = "h-[52px] min-w-[200px] px-6 text-[16px]";
  if (action.kind === "link") {
    return (
      <Link id={action.id} href={action.href} className={cn(buttonVariants({ variant, size: "lg" }), size)}>
        {action.label}
      </Link>
    );
  }
  const state = footerButtonState(action);
  return (
    <button
      type="button"
      id={action.id}
      data-slot="button"
      className={cn(buttonVariants({ variant, size: "lg" }), size, state.mode === "busy" && "cursor-wait")}
      disabled={state.mode === "waiting"}
      aria-disabled={state.mode === "busy" || undefined}
      aria-busy={state.mode === "busy" || undefined}
      aria-describedby={state.describedBy}
      onClick={state.mode === "ready" ? action.onClick : undefined}
    >
      {state.mode === "busy" ? <Spinner aria-hidden className="size-4" role={undefined} aria-label={undefined} /> : null}
      {state.label}
    </button>
  );
}

/**
 * G9: the bar under every candidate step screen (and the wizards of the
 * panel): the journey on its top edge, the way back on the left, the reason
 * and the one filled button on the right, always in the same place. On the
 * candidate side it is fixed to the bottom of the window with a spacer before
 * it, so it never covers the content; inside the panel it sticks to the bottom
 * of its column ("sticky"). Enter on a text field never presses it (it is a
 * plain button outside any form).
 */
export function StepFooter({
  primary,
  secondary,
  back,
  journey,
  hint,
  note,
  placement = "viewport",
}: {
  primary?: FooterAction | null;
  secondary?: FooterAction | null;
  back?: { label: string; onClick?: () => void; href?: string } | null;
  journey?: { steps: number; current: number; label: string } | null;
  hint?: string | null;
  note?: ReactNode;
  placement?: "viewport" | "sticky";
}) {
  const reason = primary && primary.kind === "button" ? footerButtonState(primary).reason : null;
  const backClass = "inline-flex min-h-11 items-center gap-1 rounded-lg text-[16px] text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";
  return (
    <>
      {placement === "viewport" ? <div aria-hidden="true" className="h-[112px]" /> : null}
      <div data-step-footer className={placement === "viewport" ? "fixed inset-x-0 bottom-0 z-30" : "sticky bottom-0 z-20"}>
        {journey ? <JourneyProgress steps={journey.steps} current={journey.current} label={journey.label} /> : null}
        <div className="border-t border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex min-h-[84px] max-w-[1000px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-7">
            <div className="min-w-0">
              {back ? (
                back.href ? (
                  <Link href={back.href} className={backClass}>
                    <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
                    {back.label}
                  </Link>
                ) : (
                  <button type="button" onClick={back.onClick} className={backClass}>
                    <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
                    {back.label}
                  </button>
                )
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              {journey ? (
                <span aria-hidden className="tnum text-[14px] text-muted">
                  {journey.label}
                </span>
              ) : null}
              {/* The reason is announced politely as it changes (the region exists before its words do). */}
              <div aria-live="polite">
                {reason && primary ? (
                  <p id={`${primary.id}-why`} className="max-w-[320px] text-right text-[14px] leading-[22px] text-muted">
                    {reason}
                  </p>
                ) : hint ? (
                  <p className="max-w-[320px] text-right text-[14px] leading-[22px] text-ink">{hint}</p>
                ) : null}
              </div>
              {secondary ? <Action action={secondary} variant="secondary" /> : null}
              {primary ? <Action action={primary} variant="primary" /> : null}
            </div>
          </div>
          {note ? <div className="mx-auto max-w-[1000px] px-4 pb-4 sm:px-7">{note}</div> : null}
        </div>
      </div>
    </>
  );
}
```

```tsx
// src/components/visual/disclosure.tsx
// kademe-owned
"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/cn";

/** G7: detail and legal text one click away; the label says what is behind it. Nothing is hidden for good. */
export function Disclosure({
  label,
  icon: Icon,
  defaultOpen = false,
  variant = "row",
  children,
  className,
}: {
  label: ReactNode;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  variant?: "row" | "inline";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn(variant === "row" && "border-y border-line", className)}>
      <CollapsibleTrigger
        className={cn(
          "group flex min-h-12 items-center gap-2 text-left text-[16px] text-ink",
          variant === "row" ? "w-full justify-between font-medium" : "underline decoration-underline underline-offset-4 hover:decoration-ink",
        )}
      >
        <span className="flex items-center gap-2">
          {Icon ? <Icon className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden /> : null}
          {label}
        </span>
        <ChevronDown className="size-4 shrink-0 transition-transform duration-[180ms] ease-soft group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
```

```tsx
// src/components/visual/icon-row.tsx
// kademe-owned
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** G5: an icon that carries meaning, in a neutral 40px box (never accent), with a title and an optional detail. */
export function IconRow({ icon: Icon, title, detail, tone = "default" }: { icon: LucideIcon; title: ReactNode; detail?: ReactNode; tone?: "default" | "negative" }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-ink">
        <Icon className={cn("size-5", tone === "negative" && "text-muted")} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 pt-2">
        <p className="text-[16px] leading-6 text-ink">{title}</p>
        {detail ? <p className="mt-0.5 text-[14px] leading-[22px] text-muted">{detail}</p> : null}
      </div>
    </div>
  );
}
```

```tsx
// src/components/visual/fact-tiles.tsx
// kademe-owned
import type { LucideIcon } from "lucide-react";

/** 3.1, 3.5: two or three facts the candidate plans with; the value first, its meaning under it. */
export function FactTiles({ items }: { items: Array<{ icon: LucideIcon; value: string; label: string }> }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map(({ icon: Icon, value, label }) => (
        <div key={label} className="flex min-w-0 flex-col-reverse gap-1 rounded-xl border border-line bg-surface p-3">
          <dt className="text-[13px] leading-5 text-muted">{label}</dt>
          <dd className="tnum flex items-center gap-2 text-[16px] leading-6 font-semibold text-ink">
            <Icon className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

```tsx
// src/components/visual/path-steps.tsx
// kademe-owned
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** "Nasıl gidecek", "Sırada ne var", the phone screen's steps and the panel's setup list: numbered, the current one marked. */
export function PathSteps({ steps, label }: { steps: Array<{ title: ReactNode; detail?: ReactNode; state?: "done" | "current" | "todo"; action?: ReactNode }>; label?: string }) {
  return (
    <ol aria-label={label} className="space-y-1">
      {steps.map((step, i) => (
        <li key={i} aria-current={step.state === "current" ? "step" : undefined} className="relative flex gap-3 pb-3 last:pb-0">
          <span
            className={cn(
              "tnum grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-medium",
              step.state === "done" ? "bg-ink text-white" : step.state === "current" ? "border-2 border-ink bg-surface text-ink" : "border border-line bg-surface text-muted",
            )}
            aria-hidden
          >
            {step.state === "done" ? <Check className="size-4" strokeWidth={2} /> : i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className={cn("text-[16px] leading-6", step.state === "todo" ? "text-ink-2" : "font-medium text-ink")}>{step.title}</p>
            {step.detail ? <p className="text-[14px] leading-[22px] text-muted">{step.detail}</p> : null}
            {step.action ? <div className="mt-2">{step.action}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
```

```tsx
// src/components/visual/choice-card.tsx
// kademe-owned
"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ChoiceItem = { value: string; label: ReactNode; marker?: string | LucideIcon; shortcut?: string | null; description?: ReactNode; disabled?: boolean };

/**
 * G6: a choice is a card you click; the chosen card is the active state
 * (accent edge, brand-soft ground). Native radios or checkboxes inside, so
 * the arrow keys, Space and a screen reader work as everywhere; the keys 1-9
 * are the caller's shortcut, shown here only as a hint.
 */
export function ChoiceCardGroup({
  type,
  name,
  value,
  onChange,
  items,
  size = "md",
  columns = 1,
  labelledBy,
  describedBy,
  disabled = false,
}: {
  type: "single" | "multi";
  name: string;
  value: string[];
  onChange(next: string[]): void;
  items: ChoiceItem[];
  size?: "md" | "square";
  columns?: 1 | 2 | 3 | 5;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  const toggle = (v: string) => onChange(type === "single" ? [v] : value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div
      role={type === "single" ? "radiogroup" : "group"}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", columns === 5 && "grid-cols-5")}
    >
      {items.map((item) => {
        const Marker = typeof item.marker === "string" || !item.marker ? null : item.marker;
        const off = disabled || item.disabled;
        return (
          <label
            key={item.value}
            className={cn(
              "relative flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface text-[16px] leading-6 text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas",
              "has-[:checked]:border-accent has-[:checked]:bg-brand-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              "has-[:disabled]:cursor-not-allowed has-[:disabled]:text-muted has-[:disabled]:hover:bg-surface",
              size === "square" ? "min-h-16 justify-center px-2 font-semibold" : "min-h-14 px-4 py-3",
            )}
          >
            <input
              type={type === "single" ? "radio" : "checkbox"}
              name={name}
              value={item.value}
              checked={value.includes(item.value)}
              disabled={off}
              onChange={() => toggle(item.value)}
              className="peer sr-only"
            />
            {typeof item.marker === "string" ? (
              <span aria-hidden className="tnum grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-[14px] font-medium text-ink peer-checked:border-accent">
                {item.marker}
              </span>
            ) : Marker ? (
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-ink">
                <Marker className="size-5" strokeWidth={1.75} />
              </span>
            ) : null}
            <span className={cn("min-w-0", size === "md" && "flex-1")}>
              <span className="block">{item.label}</span>
              {item.description ? <span className="mt-0.5 block text-[14px] leading-[22px] text-muted">{item.description}</span> : null}
            </span>
            {item.shortcut ? (
              <kbd aria-hidden className="tnum ml-auto hidden rounded-md border border-line bg-paper px-1.5 text-[13px] text-muted lg:inline">
                {item.shortcut}
              </kbd>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
```

```tsx
// src/components/visual/timer-ring.tsx
// kademe-owned
import { formatCountdown } from "@/lib/timer";
import { ringGeometry } from "./ring";

/**
 * K4, 3.8: the think and answer clock. Accent (the timer is one of the
 * accent's three places), whole seconds, no slide, never red. One image to a
 * screen reader; the caller's minute announcements stay as they are.
 */
export function TimerRing({ remainingMs, totalMs, label, caption, size = 128 }: { remainingMs: number; totalMs: number; label: string; caption: string; size?: 96 | 128 }) {
  const g = ringGeometry({ remainingMs, totalMs, size });
  const c = size / 2;
  return (
    <div role="img" aria-label={label} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" focusable="false" className="-rotate-90">
        <circle cx={c} cy={c} r={g.radius} fill="none" stroke="var(--color-hairline)" strokeWidth={6} />
        <circle cx={c} cy={c} r={g.radius} fill="none" stroke="var(--color-accent)" strokeWidth={6} strokeLinecap="round" strokeDasharray={g.circumference} strokeDashoffset={g.offset} />
      </svg>
      <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[24px] leading-8 font-semibold text-accent">{formatCountdown(g.seconds * 1000)}</span>
        <span className="text-[13px] leading-5 text-muted">{caption}</span>
      </span>
    </div>
  );
}
```

```tsx
// src/components/visual/status-screen.tsx
// kademe-owned
import type { ReactNode, Ref } from "react";
import { Illustration, type IllustrationName } from "./illustrations";

/** 3.11: a status or problem screen: a small drawing, a heading, one sentence, one way on (in the footer). */
export function StatusScreen({
  illustration,
  title,
  titleRef,
  body,
  children,
  footer,
}: {
  illustration?: IllustrationName;
  title: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  body?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[560px] pt-14 pb-6 text-center">
      {illustration ? <Illustration name={illustration} size="spot" className="mx-auto" /> : null}
      <h1 ref={titleRef} tabIndex={-1} className="mt-6 text-[28px] leading-9 font-semibold text-ink outline-none lg:text-[32px] lg:leading-10">
        {title}
      </h1>
      {body ? <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{body}</p> : null}
      {children ? <div className="mt-6 space-y-3 text-[16px] leading-[26px] text-ink-2">{children}</div> : null}
      {footer}
    </section>
  );
}
```

```tsx
// src/components/visual/media-stage.tsx
// kademe-owned
import type { ReactNode } from "react";

/** 3.4, 3.8: the question and its clock on the left, the candidate's own picture (or its place) on the right; one column below 1024px. */
export function MediaStage({ question, preview, below }: { question: ReactNode; preview: ReactNode; below?: ReactNode }) {
  return (
    <section className="grid gap-8 pt-8 pb-6 lg:grid-cols-[minmax(0,400px)_minmax(0,520px)] lg:justify-between">
      <div className="min-w-0 space-y-6">{question}</div>
      <div className="min-w-0">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-canvas">{preview}</div>
        {below ? <div className="mt-4">{below}</div> : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Motion and scroll padding**

Append to `src/app/globals.css` after the `rec-pulse` keyframes (`:314-322`):

```css
/* HIRING-VISUAL-FLOW 2.3: a step change inside one page fades in and rises 8px; reduced motion keeps only the fade. */
@keyframes step-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* G9: a focused field scrolled into view is never left under the fixed step footer. */
html:has([data-step-footer]) {
  scroll-padding-bottom: 120px;
}
```

- [ ] **Step 7: Run the tests**

Run: `pnpm exec vitest run src/components/visual`
Expected: PASS (models 10, blocks 12, illustrations 17).

If the `Spinner` props (`role`, `aria-label` set by the shadcn part, `src/components/ui/spinner.tsx`) leak into the button's accessible name, the busy test still passes; check with `read_page` in Task 5 that the button's name is "Kaydediliyor" only.

- [ ] **Step 8: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && grep -rn $'\xe2\x80\x94' src/components/visual; echo "dash exit $?"`
Expected: clean, `dash exit 1`. `src/components/ui/shadcn-vendored.test.ts` is untouched (no file under `ui/` changed).

- [ ] **Step 9: Browser check**

Nothing renders these blocks yet. Add them temporarily to nothing; the check is in Task 5.

- [ ] **Step 10: Commit**

```bash
git add src/components/visual src/app/globals.css
git commit -m "Add the shared step-screen building blocks

StepScreen, StepFooter (draws its one filled button from data: a waiting
button always says why, a working one keeps its filled look), the journey
and question progress, Disclosure, IconRow, FactTiles, PathSteps, choice
cards on native inputs, the ring timer, StatusScreen and MediaStage, with
their pure models tested.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 5: V3 part 1, the landing becomes Welcome and Consent (one URL, two steps)

**Files:**
- Create: `src/components/hiring/candidate/landing-model.ts`, `src/components/hiring/candidate/landing-model.test.ts`
- Create: `src/components/hiring/candidate/use-journey.ts` (the footer's journey for any preparation screen)
- Modify (rewrite of the render, same logic): `src/components/hiring/candidate/landing.tsx:1-272`
- Modify: `src/solutions/hiring/candidate/pages.tsx` (landing case from Task 2: pass `deadlineDay`)
- Modify: `src/solutions/hiring/candidate/pages.test.ts:91-104` (the landing's props include `deadlineDay`)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringLanding`: new keys only; `promise`, `whoPeople`, `consentLabel`, `signal*` unchanged)
- Modify: `src/i18n/hiring-candidate-copy.test.ts` (`whoShort` and the consent rows)

**Shared with the exam:** none (the exam's landing is `src/components/candidate/IntroConsent.tsx`, untouched).

**Interfaces:**
- Consumes: `StepScreen`, `StepFooter`, `FactTiles`, `PathSteps`, `IconRow`, `Disclosure`, `ChoiceCardGroup`, `journeySteps`, `journeyPosition` (Task 4); `Illustration` names `welcome`, `consent` (Task 3).
- Produces:
  - `landing-model.ts`: `CONSENT_HASH = "#consent"`; `type LandingStep = "welcome" | "consent"`; `landingStepOf(hash: string): LandingStep`; `welcomePath(input: { device: boolean; warmup: boolean }): Array<"device" | "warmup" | "questions" | "team">`; `bringList(devices: { camera: boolean; microphone: boolean }): Array<"quiet" | "cameraMic" | "mic" | "computer">`; `agreeWaitReason(accepted: boolean): "tickFirst" | null`
  - `Landing` props gain `deadlineDay: string` (the org day, `formatInviteDay`), keep `deadline: string` (shown in the details).
  - `use-journey.ts`: `useJourney(at: JourneyKey, input: { device: boolean; warmup: boolean }): { steps: number; current: number; label: string }` (label "Cihaz · Adım 2 / 4"), used by Tasks 6, 8, 9 and 10.
  - Copy namespace `hiringJourney`: `prep`, `device`, `warmup`, `questions`, `label`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/hiring/candidate/landing-model.test.ts
import { describe, expect, it } from "vitest";
import { agreeWaitReason, bringList, CONSENT_HASH, landingStepOf, welcomePath } from "./landing-model";

describe("the landing as two steps (K3, 3.1, 3.2)", () => {
  it("reads the step from the address's hash, so the browser's back button returns to Welcome", () => {
    expect(CONSENT_HASH).toBe("#consent");
    expect(landingStepOf("#consent")).toBe("consent");
    expect(landingStepOf("")).toBe("welcome");
    expect(landingStepOf("#other")).toBe("welcome");
  });

  it("lists only the parts this assessment has, and always the team at the end", () => {
    expect(welcomePath({ device: true, warmup: true })).toEqual(["device", "warmup", "questions", "team"]);
    expect(welcomePath({ device: true, warmup: false })).toEqual(["device", "questions", "team"]);
    expect(welcomePath({ device: false, warmup: false })).toEqual(["questions", "team"]);
  });

  it("asks for a camera only when a video question exists, a microphone for sound only, and always a computer (K2)", () => {
    expect(bringList({ camera: true, microphone: true })).toEqual(["quiet", "cameraMic", "computer"]);
    expect(bringList({ camera: false, microphone: true })).toEqual(["quiet", "mic", "computer"]);
    expect(bringList({ camera: false, microphone: false })).toEqual(["quiet", "computer"]);
  });

  it("holds 'Kabul et ve başla' until the box is ticked, and says why", () => {
    expect(agreeWaitReason(false)).toBe("tickFirst");
    expect(agreeWaitReason(true)).toBeNull();
  });
});
```

Add to `src/i18n/hiring-candidate-copy.test.ts`:

```ts
  it("names the reviewers in a short line on Welcome, honestly (3.1 whoShort)", () => {
    const t = { tr: candidateT("tr"), en: candidateT("en") };
    expect(t.tr("hiringLanding.whoShort", { count: 0 })).toBe("İşe alım ekibi, aynı ölçütlerle.");
    expect(t.tr("hiringLanding.whoShort", { count: 1 })).toBe("Ekipten bir kişi, aynı ölçütlerle.");
    expect(t.tr("hiringLanding.whoShort", { count: 3 })).toBe("En az 3 kişi, birbirinden bağımsız.");
    expect(t.en("hiringLanding.whoShort", { count: 1 })).toBe("One person on the team, same criteria.");
    expect(t.en("hiringLanding.whoShort", { count: 2 })).toBe("At least 2 people, independently.");
  });

  it("names the technical records on the consent screen and keeps the closing promise word for word (C24, plan decision 5)", () => {
    expect(tr.hiringLanding.rowTechnicalDetail).toBe("IP adresin ve tarayıcın, aşama saatleri, bağlantı sorunları");
    expect(en.hiringLanding.rowTechnicalDetail).toBe("Your IP address and browser, stage times, connection problems");
    expect(tr.hiringLanding.consentLabel).toBe("Kaydı ve cevaplarımın bu başvuru için değerlendirilmesini kabul ediyorum.");
  });
```

In `src/solutions/hiring/candidate/pages.test.ts`, the first test (`:91-104`): extend the props type with `deadlineDay: string` and add `expect(props.deadlineDay).toBe("19 Eki");` after the `deadline` expectations.

Run: `pnpm exec vitest run src/components/hiring/candidate/landing-model.test.ts src/i18n/hiring-candidate-copy.test.ts src/solutions/hiring/candidate/pages.test.ts`
Expected: FAIL (module missing, `whoShort` and `rowTechnicalDetail` missing, `deadlineDay` undefined).

- [ ] **Step 2: The model**

```ts
// src/components/hiring/candidate/landing-model.ts
/**
 * HIRING-VISUAL-FLOW 3.1 and 3.2 (K3): Welcome and Consent are two steps of
 * one page. The step lives in the address's hash, so the browser's back
 * button on Consent returns to Welcome (Next keeps the page mounted for a
 * hash change) and a reload stays where the candidate was.
 */
export const CONSENT_HASH = "#consent";
export type LandingStep = "welcome" | "consent";

export const landingStepOf = (hash: string): LandingStep => (hash === CONSENT_HASH ? "consent" : "welcome");

/** "Nasıl gidecek": the device check only when something is recorded, the warm-up only when the version has one. */
export function welcomePath(input: { device: boolean; warmup: boolean }): Array<"device" | "warmup" | "questions" | "team"> {
  return [...(input.device ? (["device"] as const) : []), ...(input.warmup ? (["warmup"] as const) : []), "questions", "team"];
}

/** "Yanına al": a quiet place, the devices the questions need, a computer (K2). */
export function bringList(devices: { camera: boolean; microphone: boolean }): Array<"quiet" | "cameraMic" | "mic" | "computer"> {
  return ["quiet", ...(devices.camera ? (["cameraMic"] as const) : devices.microphone ? (["mic"] as const) : []), "computer"];
}

export const agreeWaitReason = (accepted: boolean): "tickFirst" | null => (accepted ? null : "tickFirst");
```

- [ ] **Step 3: Copy (TR / EN), new keys in `hiringLanding`**

| Key | TR | EN |
|---|---|---|
| `subline` | Tanışmadan önce nasıl düşündüğünü görmek istiyoruz. Kendi zamanında yapacaksın. | We'd like to see how you think before we meet. Do it in your own time. |
| `factMinutesValue` | ~{minutes} dk | ~{minutes} min |
| `factMinutesLabel` | tahmini | estimated |
| `factStagesValue` | {count, plural, one {# aşama} other {# aşama}} | {count, plural, one {# stage} other {# stages}} |
| `factStagesLabel` | ara verebilirsin | take breaks between |
| `factDeadlineLabel` | son gün | last day |
| `pathTitle` | Nasıl gidecek | How it goes |
| `pathDevice` | Cihazını dene | Test your device |
| `pathDeviceDetail` | Kimse görmez. | Nobody sees it. |
| `pathWarmup` | Isın | Warm up |
| `pathWarmupDetail` | Gönderilmez. | Not sent. |
| `pathQuestions` | Soruları cevapla | Answer the questions |
| `pathQuestionsDetail` | Süre, sen başlatınca işler. | The clock starts when you do. |
| `pathTeam` | Ekip değerlendirir | The team reviews |
| `whoShort` | {count, plural, =0 {İşe alım ekibi, aynı ölçütlerle.} =1 {Ekipten bir kişi, aynı ölçütlerle.} other {En az # kişi, birbirinden bağımsız.}} | {count, plural, =0 {The hiring team, same criteria.} =1 {One person on the team, same criteria.} other {At least # people, independently.}} |
| `bringTitle` | Yanına al | Have with you |
| `bringQuiet` | Sessiz bir yer | A quiet place |
| `bringCameraMic` | Kamera ve mikrofon | Camera and mic |
| `bringMic` | Mikrofon | A microphone |
| `adjustRow` | Ek süre ya da başka bir düzenleme | Extra time or another adjustment |
| `extraShort` | Neden sorulmaz, onay beklenmez. Değerlendiriciler görmez. | No reason asked, no approval needed. Reviewers do not see it. |
| `footnote` | Yarıda bırakırsan aynı linkten devam edersin. | If you stop, the same link brings you back. |
| `continue` | Devam et | Continue |
| `consentTitle` | Neler kaydediliyor? | What gets recorded? |
| `groupRecorded` | Kaydedilir | Recorded |
| `groupNotRecorded` | Kaydedilmez | Not recorded |
| `rowVideo` | Video sorularında görüntün ve sesin | Your picture and voice in video questions |
| `rowAudio` | Ses sorularında sesin | Your voice in audio questions |
| `rowTechnical` | Teknik kayıtlar | Technical records |
| `rowTechnicalDetail` | IP adresin ve tarayıcın, aşama saatleri, bağlantı sorunları | Your IP address and browser, stage times, connection problems |
| `rowNotMonitored` | Ekranın, sekmelerin ve pencerelerin | Your screen, tabs and windows |
| `aiTitle` | Yapay zekâ seni puanlamaz | AI does not score you |
| `aiDetailRecorded` | Sıralamaz, elemez; yalnızca video ve ses cevaplarını yazıya döker. | It doesn't rank or reject you; it only transcribes your video and audio answers. |
| `aiDetail` | Sıralamaz, elemez. | It doesn't rank or reject you. |
| `detailsLong` | Ayrıntılar ve saklama süreleri | Details and how long we keep things |
| `agree` | Kabul et ve başla | Agree and start |
| `tickFirst` | Önce kutuyu işaretle. | Tick the box first. |
| `back` | Geri | Back |
| `deadlineFull` | Son tarih: {date} | Deadline: {date} |

New namespace `hiringJourney` (both files):

| Key | TR | EN |
|---|---|---|
| `prep` | Hazırlık | Getting ready |
| `device` | Cihaz | Device |
| `warmup` | Isınma | Warm-up |
| `questions` | Sorular | Questions |
| `label` | {part} · Adım {n} / {total} | {part} · Step {n} / {total} |

```ts
// src/components/hiring/candidate/use-journey.ts
"use client";

import { journeyPosition, journeySteps, type JourneyKey } from "@/components/visual/journey";
import { useT } from "@/i18n/candidate-client";

/** G3: the journey on a preparation screen's footer: the parts this assessment has, this screen's part, in words. */
export function useJourney(at: JourneyKey, input: { device: boolean; warmup: boolean }) {
  const t = useT("hiringJourney");
  const position = journeyPosition(journeySteps(input), at);
  return { steps: position.total, current: position.current, label: t("label", { part: t(at), n: position.current, total: position.total }) };
}
```

Unchanged on purpose: `promise` (pinned, `hiring-candidate-copy.test.ts:38-41`), `whoPeople` (pinned, moves into "Ayrıntılar"), `signalVIDEO_ANSWER`, `signalAUDIO_ANSWER`, `signalTECHNICAL` (pinned, shown in full in "Ayrıntılar"), `consentLabel`, `retentionMedia`, `retentionRecord`, the extra-time keys. Keys no longer rendered (`purpose`, `factStages`, `factMinutes`, `factDeadline`, `howTitle`, `how*`, `whoTitle`, `recordedTitle`, `notMonitored`, `details`, `needTitle`, `needQuiet`, `needCameraMic`, `needMic`, `needTime`, `adjustTitle`, `start`, `consentRequired`, `resume`) stay in the files (unused keys are harmless; a later copy cleanup may drop them).

- [ ] **Step 4: The screen**

Replace `src/components/hiring/candidate/landing.tsx` with:

```tsx
"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Accessibility, AudioLines, CalendarDays, Clock, EyeOff, Headphones, Laptop, Layers, Mic, Video, Wifi } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { Disclosure } from "@/components/visual/disclosure";
import { FactTiles } from "@/components/visual/fact-tiles";
import { IconRow } from "@/components/visual/icon-row";
import { PathSteps } from "@/components/visual/path-steps";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { nextPath } from "@/lib/candidate-routes";
import { pickTextLang } from "@/lib/i18n-text";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { mailTo } from "./closed";
import { agreeWaitReason, bringList, CONSENT_HASH, landingStepOf, welcomePath } from "./landing-model";
import { serverMessage } from "./server-message";
import { useJourney } from "./use-journey";

const SIGNAL_ROW = { VIDEO_ANSWER: { icon: Video, key: "rowVideo" }, AUDIO_ANSWER: { icon: Mic, key: "rowAudio" }, TECHNICAL: { icon: Wifi, key: "rowTechnical" } } as const;
const BRING_ICON = { quiet: Headphones, cameraMic: Video, mic: Mic, computer: Laptop } as const;
const EXTRA = ["0", "25", "50"] as const;

const subscribeHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  window.addEventListener("popstate", notify);
  return () => {
    window.removeEventListener("hashchange", notify);
    window.removeEventListener("popstate", notify);
  };
};

/**
 * HIRING-VISUAL-FLOW 3.1 and 3.2 (K3): Welcome says who, how long, how it goes
 * and what to have ready, and takes extra time without a reason; Consent says
 * exactly what is recorded (plan 2 monitors nothing: decision 5 of this plan
 * and C24), the fixed promise, the AI line, and the full text one click away.
 * No question is shown before consent. Consent posts to the core route, which
 * records the text frozen on this invitation. The minutes are the state's
 * total with extra time and any grace (C25).
 */
export function Landing({
  token,
  state,
  consentBody,
  consentLang,
  deadline,
  deadlineDay,
  locale,
}: {
  token: string;
  state: HiringCandidateState;
  consentBody: string;
  /** The language the consent text is shown in (the other one when the candidate's is empty). */
  consentLang: Locale;
  /** The full deadline in the e-mail's words; `deadlineDay` is the short day for the tile. */
  deadline: string;
  deadlineDay: string;
  locale: Locale;
}) {
  const t = useT("hiringLanding");
  const router = useRouter();
  const step = useSyncExternalStore(subscribeHash, () => landingStepOf(window.location.hash), () => "welcome" as const);
  const heading = useStepFocus<HTMLHeadingElement>(step);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState(state.extraTimePct);
  const [minutes, setMinutes] = useState(state.totalMinutes);
  const [extra, setExtra] = useState<"idle" | "saving" | "saved">("idle");
  const [extraError, setExtraError] = useState<string | null>(null);
  const recorded = state.devices.microphone;
  const intro = state.intro.body ? pickTextLang(state.intro.body, locale) : null;
  const journey = useJourney("prep", { device: recorded, warmup: state.practice });

  async function chooseExtra(value: string) {
    const before = pct;
    // The choice shows at once; the server's answer settles it (or puts the old one back).
    setPct(Number(value) as HiringCandidateState["extraTimePct"]);
    setExtra("saving");
    setExtraError(null);
    try {
      const updated = await apiSend<HiringCandidateState>(token, "/hiring/extra-time", { pct: Number(value) });
      setPct(updated.extraTimePct);
      setMinutes(updated.totalMinutes);
      setExtra("saved");
    } catch (err) {
      setPct(before);
      setExtraError(serverMessage(err) ?? t("failed"));
      setExtra("idle");
    }
  }

  async function agree() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<HiringCandidateState>(token, "/consent", { accepted: true });
      router.push(nextPath(token, next));
    } catch (err) {
      setError(serverMessage(err) ?? t("failed"));
      setBusy(false);
    }
  }

  const contact = state.contactEmail ? <p className="text-[14px] leading-[22px] text-muted">{t.rich("contact", { email: state.contactEmail, mail: mailTo(state.contactEmail) })}</p> : null;
  const rights = (
    <a href={`/a/${encodeURIComponent(token)}/rights`} className="inline-flex min-h-11 items-center text-[14px] text-ink underline decoration-underline underline-offset-4 hover:decoration-ink">
      {t("rights")}
    </a>
  );

  if (step === "welcome") {
    const extraLocked = state.extraTimeLocked;
    const extraNote = extraLocked ? t("extraLocked") : extra === "saving" ? t("extraSaving") : extra === "saved" ? t("extraSaved") : t("extraShort");
    const path = welcomePath({ device: recorded, warmup: state.practice });
    return (
      <>
        <StepScreen
          layout="split"
          illustration="welcome"
          kicker={`${state.orgName} · ${state.positionName}`}
          title={state.candidateName ? t("hello", { name: state.candidateName }) : t("helloNoName")}
          titleRef={heading}
          lead={<p lang={intro?.text && intro.lang !== locale ? intro.lang : undefined}>{intro?.text || t("subline")}</p>}
        >
          <div className="space-y-8">
            <FactTiles
              items={[
                { icon: Clock, value: t("factMinutesValue", { minutes }), label: t("factMinutesLabel") },
                { icon: Layers, value: t("factStagesValue", { count: state.stages.length }), label: t("factStagesLabel") },
                { icon: CalendarDays, value: deadlineDay, label: t("factDeadlineLabel") },
              ]}
            />
            <section aria-labelledby="landing-path">
              <h2 id="landing-path" className="mb-3 text-[18px] leading-7 font-semibold text-ink">
                {t("pathTitle")}
              </h2>
              <PathSteps
                steps={path.map((p) =>
                  p === "device"
                    ? { title: t("pathDevice"), detail: t("pathDeviceDetail") }
                    : p === "warmup"
                      ? { title: t("pathWarmup"), detail: t("pathWarmupDetail") }
                      : p === "questions"
                        ? { title: t("pathQuestions"), detail: t("pathQuestionsDetail") }
                        : { title: t("pathTeam"), detail: t("whoShort", { count: state.reviewers }) },
                )}
              />
            </section>
            <section aria-labelledby="landing-bring">
              <h2 id="landing-bring" className="mb-3 text-[18px] leading-7 font-semibold text-ink">
                {t("bringTitle")}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {bringList(state.devices).map((item) => {
                  const Icon = BRING_ICON[item];
                  const label = item === "quiet" ? t("bringQuiet") : item === "cameraMic" ? t("bringCameraMic") : item === "mic" ? t("bringMic") : t("needDevice");
                  return (
                    <li key={item} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[14px] text-ink">
                      <Icon className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
                      {label}
                    </li>
                  );
                })}
              </ul>
            </section>
            <Disclosure label={t("adjustRow")} icon={Accessibility}>
              <fieldset className="space-y-3">
                <legend id="landing-extra" className="text-[16px] font-medium text-ink">
                  {t("extraTitle")}
                </legend>
                <ChoiceCardGroup
                  type="single"
                  name="extra-time"
                  value={[String(pct)]}
                  onChange={([v]) => void chooseExtra(v)}
                  labelledBy="landing-extra"
                  describedBy="landing-extra-why"
                  disabled={extraLocked || extra === "saving"}
                  columns={3}
                  items={EXTRA.map((value) => ({ value, label: <span className="tnum">{value === "0" ? t("extraNone") : value === "25" ? t("extra25") : t("extra50")}</span> }))}
                />
                {/* The reason the choice is closed (C15), or what the choice did. */}
                <p id="landing-extra-why" role="status" className="text-[14px] leading-[22px] text-muted">
                  {extraNote}
                </p>
                {extraError ? (
                  <p role="alert" className="text-[14px] leading-[22px] text-ink">
                    {extraError}
                  </p>
                ) : null}
                <div>
                  <a
                    href={`/a/${encodeURIComponent(token)}/rights?type=accommodation`}
                    className="inline-flex min-h-11 items-center rounded-lg text-[16px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink"
                  >
                    {t("otherAdjustment")}
                  </a>
                  <p className="text-[14px] leading-[22px] text-muted">{t("otherBody")}</p>
                </div>
              </fieldset>
            </Disclosure>
            <p className="text-[14px] leading-[22px] text-muted">{t("footnote")}</p>
          </div>
        </StepScreen>
        <StepFooter
          journey={journey}
          primary={{
            kind: "button",
            id: "landing-continue",
            label: t("continue"),
            onClick: () => {
              // A hash change keeps this page mounted and gives the browser's back button a step to return to.
              window.location.hash = CONSENT_HASH;
              window.scrollTo({ top: 0 });
            },
          }}
        />
      </>
    );
  }

  const why = agreeWaitReason(accepted);
  return (
    <>
      <StepScreen
        layout="split"
        illustration="consent"
        illustrationSize="spot"
        title={t("consentTitle")}
        titleRef={heading}
        lead={<p className="text-[18px] leading-7 font-semibold text-ink">{t("promise")}</p>}
        aside={
          <div className="space-y-1">
            {rights}
            {contact}
          </div>
        }
      >
        <div className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-line bg-surface p-card-candidate" aria-labelledby="consent-recorded">
            <h2 id="consent-recorded" className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
              {t("groupRecorded")}
            </h2>
            {state.signals.map((signal) => (
              <IconRow key={signal} icon={SIGNAL_ROW[signal].icon} title={t(SIGNAL_ROW[signal].key)} detail={signal === "TECHNICAL" ? t("rowTechnicalDetail") : undefined} />
            ))}
            <div className="border-t border-line pt-4">
              <h2 className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">{t("groupNotRecorded")}</h2>
              <div className="mt-4">
                <IconRow icon={EyeOff} tone="negative" title={t("rowNotMonitored")} />
              </div>
            </div>
          </section>
          <div className="rounded-2xl border border-line bg-surface p-card-candidate">
            <IconRow icon={AudioLines} title={t("aiTitle")} detail={recorded ? t("aiDetailRecorded") : t("aiDetail")} />
          </div>
          <Disclosure label={t("detailsLong")}>
            <div className="space-y-3 text-[14px] leading-[22px] text-ink-2">
              <p>{t("whoPeople", { count: state.reviewers })}</p>
              {state.signals.map((signal) => (
                <p key={signal}>{t(`signal${signal}`)}</p>
              ))}
              <p className="whitespace-pre-line" lang={consentLang !== locale ? consentLang : undefined}>
                {consentBody}
              </p>
              <p className="tnum">{t("retentionMedia", { days: state.retention.mediaDays })}</p>
              <p className="tnum">{t("retentionRecord", { days: state.retention.candidateDays })}</p>
              <p className="tnum">{t("deadlineFull", { date: deadline })}</p>
            </div>
          </Disclosure>
          <label htmlFor="landing-consent" className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-brand-soft">
            <Checkbox id="landing-consent" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-[3px] size-5" />
            <span className="text-[16px] leading-[26px] text-ink">{t("consentLabel")}</span>
          </label>
        </div>
      </StepScreen>
      <StepFooter
        journey={journey}
        back={{ label: t("back"), onClick: () => window.history.back() }}
        primary={{ kind: "button", id: "landing-agree", label: t("agree"), busy, busyLabel: t("starting"), waitReason: why ? t(why) : null, onClick: () => void agree() }}
        note={
          error ? (
            <p role="alert" className="text-[14px] text-ink">
              {error}
            </p>
          ) : null
        }
      />
    </>
  );
}
```

Notes for the implementer: a reload on `#consent` opens Consent (the browser keeps the hash); "Geri" there goes back in history, which returns to Welcome when Welcome came first and otherwise leaves the page as the browser decides (it is the browser's back). If a reload on `#consent` followed by "Geri" leaves the page in the Chrome check, change the back action to `history.replaceState(null, "", window.location.pathname)` plus a `hashchange` dispatch, and record it.

- [ ] **Step 5: `pages.tsx` passes the short day**

In the landing builder (Task 2 Step 7) add `deadlineDay={formatInviteDay(orgDay(h.link.expiresAt, ORG_TIMEZONE), locale)}` to `<Landing ...>`.

- [ ] **Step 6: Run the tests**

Run: `pnpm exec vitest run src/components/hiring/candidate/landing-model.test.ts src/i18n/hiring-candidate-copy.test.ts src/solutions/hiring/candidate/pages.test.ts src/i18n/messages.test.ts`
Expected: PASS.

- [ ] **Step 7: Gates and the flow script**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -5`
Expected: clean. Then `verify:hiring-flow` on a fresh `kademe_flow_check` (commands in Task 2 Step 11): all ok (the script checks the landing node's frozen consent text; the prop names `consentBody` and `consentLang` are unchanged).

- [ ] **Step 8: Browser check (Claude in Chrome)**

`kademe_ui_check`, `pnpm dev:hiring-link`, dev server 3100. Open the link.
1. 1440: Welcome in two regions: kicker "Örnek A.Ş. · ...", "Merhaba Elif Kaya" 40/48, the drawing under the sentence; on the right three tiles (~N dk tahmini, 2 aşama ara verebilirsin, the day "son gün"), "Nasıl gidecek" with four numbered steps (device, warm-up, questions, team with "Ekipten bir kişi, aynı ölçütlerle."), "Yanına al" chips including "Bilgisayar", the closed "Ek süre ya da başka bir düzenleme" row, the footnote. The footer: journey bar on its top edge, "Hazırlık · Adım 1 / 4", one filled "Devam et". No other filled button. Screenshot `p2b-t5-welcome-1440`.
2. 1280 and 1024: same order; at 1024 the left region is 340 wide and the tiles stay three across. Screenshots. At 1000 (strip shows) the page is one column.
3. Open the adjustment row, pick +%25: "Kaydedildi. Sürelerin buna göre uzadı.", the minutes tile grows. Keyboard: Tab to the cards, arrow keys move the choice (native radios).
4. "Devam et": the address ends in `#consent`, focus is on "Neler kaydediliyor?" (read_page: the focused element is the h1). The card lists exactly the fixture's signals plus "Kaydedilmez · Ekranın, sekmelerin ve pencerelerin"; "Ayrıntılar ve saklama süreleri" opens the frozen hiring consent text, the full signal sentences and the retention numbers. "Kabul et ve başla" is grey with "Önce kutuyu işaretle." beside it and `aria-describedby="landing-agree-why"`.
5. Browser back: Welcome, with +%25 still chosen. Forward: Consent.
6. Tick (click anywhere on the card): the button turns filled; press it: "Hazırlanıyor" on a filled button with a spinner (not grey), then `/check`.
7. EN switch on both steps: every string English, no raw key. Em-dash count 0 (`get_page_text` then search for U+2014).
Stop the server; keep `kademe_ui_check` for Task 6 or drop it.

- [ ] **Step 9: Commit**

```bash
git add src/components/hiring/candidate/landing-model.ts src/components/hiring/candidate/landing-model.test.ts src/components/hiring/candidate/use-journey.ts src/components/hiring/candidate/landing.tsx src/solutions/hiring/candidate/pages.tsx src/solutions/hiring/candidate/pages.test.ts src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json src/i18n/hiring-candidate-copy.test.ts
git commit -m "Split the hiring landing into Welcome and Consent

One URL, two steps in the hash so the browser's back button returns to
Welcome. Welcome: three facts, how it goes, what to have, extra time in a
disclosure. Consent: what is recorded and what is not, the fixed promise,
the AI line, the full text and retention one click away, the whole card
ticks. The technical row names IP, browser, stage times and connection
problems; no retake is promised.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 6: V3 part 2, the hiring `/info` step (3.12) with honest errors and 16px fields

**Files:**
- Create: `src/components/hiring/candidate/info-model.ts`, `src/components/hiring/candidate/info-model.test.ts`
- Create: `src/components/hiring/candidate/info-step.tsx`
- Modify: `src/solutions/hiring/candidate/pages.tsx` (case `"info"`: `InfoStep` instead of the core `InfoForm`; the import of `InfoForm` at `:4` goes)
- Modify: `src/solutions/hiring/candidate/pages.test.ts` (mock and a test for the info slot)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (new namespace `hiringInfo`)

**Shared with the exam:** none. The core `src/components/candidate/InfoForm.tsx` stays the exam's form, unchanged (plan decision 10); the core `/api/c/[token]/info` route is called as before.

**Interfaces:**
- Consumes: `StepScreen`, `StepFooter` (Task 4); `useJourney` (Task 5); `serverMessage` (`./server-message`).
- Produces:
  - `info-model.ts`: `infoWaitReason(form: { fullName: string; email: string }): "name" | "email" | null` (the same rules as the route: name at least 2 characters trimmed, e-mail `^[^@\s]+@[^@\s]+\.[^@\s]+$`)
  - `InfoStep(props: { token: string; initial: { fullName: string; email: string; phone: string; location: string }; device: boolean; warmup: boolean })`

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/hiring/candidate/info-model.test.ts
import { describe, expect, it } from "vitest";
import { infoWaitReason } from "./info-model";

describe("the details step (3.12, Task 11 Minor 10 carry)", () => {
  it("waits for a name of two letters, then for an e-mail the server accepts, and says which", () => {
    expect(infoWaitReason({ fullName: " E ", email: "elif@ornek.test" })).toBe("name");
    expect(infoWaitReason({ fullName: "Elif Kaya", email: "elif@" })).toBe("email");
    expect(infoWaitReason({ fullName: "Elif Kaya", email: " elif@ornek.test " })).toBeNull();
  });
});
```

In `src/solutions/hiring/candidate/pages.test.ts` add `vi.mock("@/components/hiring/candidate/info-step", () => ({ InfoStep: function InfoStep() {} }));`, `import { InfoStep } from "@/components/hiring/candidate/info-step";`, and in `describe("renderHiringPage")`:

```ts
  it("renders the hiring details step with the candidate's own fields and the journey flags only (3.12)", async () => {
    h.state = { ...(h.state as object), step: "INFO", path: "/info", devices: { camera: true, microphone: true }, practice: true };
    const node = await render("info");
    const [info] = find(node, InfoStep);
    expect(info.props).toEqual({
      token: "tok",
      initial: { fullName: "Elif Kaya", email: "elif@example.com", phone: "", location: "" },
      device: true,
      warmup: true,
    });
    expect(JSON.stringify(info.props)).not.toMatch(/LEAKVISIBLE|TEAMSECRET/);
  });
```

(`render` is typed for five slots at `:69-70`; widen its first parameter to `"landing" | "info" | "check" | "practice" | "stage" | "done"`.)

Run: `pnpm exec vitest run src/components/hiring/candidate/info-model.test.ts src/solutions/hiring/candidate/pages.test.ts`
Expected: FAIL (module missing; `InfoStep` not rendered).

- [ ] **Step 2: The model and the copy**

```ts
// src/components/hiring/candidate/info-model.ts
/** 3.12: the button waits for what the core /info route would refuse, in the same order (NAME_REQUIRED, EMAIL_INVALID). */
export function infoWaitReason(form: { fullName: string; email: string }): "name" | "email" | null {
  if (form.fullName.trim().length < 2) return "name";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return "email";
  return null;
}
```

`hiringInfo` in `candidate.tr.json` / `candidate.en.json`:

| Key | TR | EN |
|---|---|---|
| `title` | Seni doğru kaydedelim | Let's get your details right |
| `body` | Sadece başvurunun sana ulaşması için. | Only so your application reaches you. |
| `fullName` | Ad ve soyad | Full name |
| `email` | E-posta | E-mail |
| `next` | Devam et | Continue |
| `saving` | Kaydediliyor | Saving |
| `name` | Ad ve soyadını yaz. | Write your full name. |
| `emailWait` | Geçerli bir e-posta adresi yaz. | Write a valid e-mail address. |
| `failed` | Kaydedilemedi. Tekrar dener misin? | Could not save. Try again? |

- [ ] **Step 3: The screen**

```tsx
// src/components/hiring/candidate/info-step.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { apiSend } from "@/lib/client/api";
import { nextPath } from "@/lib/candidate-routes";
import { useT } from "@/i18n/candidate-client";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { infoWaitReason } from "./info-model";
import { serverMessage } from "./server-message";
import { useJourney } from "./use-journey";

const FIELD = "mt-2 h-12 w-full rounded-[10px] border border-line-strong bg-surface px-3.5 text-[16px] text-ink outline-none focus:border-ink/40";

/**
 * HIRING-VISUAL-FLOW 3.12: only when the invitation lacks the e-mail. Two
 * fields at 16px (no zoom, readable), the button waits with the reason the
 * server would give, and a refusal is said in the server's words or ours,
 * never the browser's raw text (Task 11 Minor 10 carry). Phone and city keep
 * what the invitation has; they are not asked here.
 */
export function InfoStep({
  token,
  initial,
  device,
  warmup,
}: {
  token: string;
  initial: { fullName: string; email: string; phone: string; location: string };
  device: boolean;
  warmup: boolean;
}) {
  const t = useT("hiringInfo");
  const router = useRouter();
  const [form, setForm] = useState({ fullName: initial.fullName, email: initial.email });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const why = infoWaitReason(form);
  const journey = useJourney("prep", { device, warmup });

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<HiringCandidateState>(token, "/info", { ...form, phone: initial.phone, location: initial.location });
      router.push(nextPath(token, next));
    } catch (err) {
      setError(serverMessage(err) ?? t("failed"));
      setBusy(false);
    }
  }

  return (
    <>
      <StepScreen layout="split" title={t("title")} lead={<p>{t("body")}</p>}>
        <div className="space-y-5">
          <label className="block">
            <span className="text-[16px] font-medium text-ink">{t("fullName")}</span>
            <input className={FIELD} value={form.fullName} autoComplete="name" maxLength={120} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[16px] font-medium text-ink">{t("email")}</span>
            <input className={FIELD} type="email" value={form.email} autoComplete="email" maxLength={160} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
        </div>
      </StepScreen>
      <StepFooter
        journey={journey}
        primary={{ kind: "button", id: "info-next", label: t("next"), busy, busyLabel: t("saving"), waitReason: why === "name" ? t("name") : why === "email" ? t("emailWait") : null, onClick: () => void submit() }}
        note={
          error ? (
            <p role="alert" className="text-[14px] text-ink">
              {error}
            </p>
          ) : null
        }
      />
    </>
  );
}
```

- [ ] **Step 4: Wire it**

In `src/solutions/hiring/candidate/pages.tsx` replace `import { InfoForm } from "@/components/candidate/InfoForm";` with `import { InfoStep } from "@/components/hiring/candidate/info-step";` and the `case "info"` builder (Task 2 Step 7) with:

```tsx
    case "info":
      return gated(() => (
        <InfoStep
          token={token}
          initial={{ fullName: h.candidate.fullName ?? "", email: h.candidate.email ?? "", phone: h.candidate.phone ?? "", location: h.candidate.location ?? "" }}
          device={safe.devices.microphone}
          warmup={safe.practice}
        />
      ));
```

The `boundary.test.ts` coupling list may name `InfoForm`'s exam type import (preflight note "InfoForm keeps its exam type import"); hiring no longer imports `InfoForm`, so the list can only shrink. Run it in Step 5.

- [ ] **Step 5: Run the tests and gates**

Run: `pnpm exec vitest run src/components/hiring/candidate/info-model.test.ts src/solutions/hiring/candidate/pages.test.ts src/solutions/boundary.test.ts src/i18n && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4`
Expected: PASS and clean. If `boundary.test.ts` fails because a listed coupling no longer exists, remove that line from `KNOWN_COUPLINGS` (the list may only shrink; say so in the commit).

`verify:hiring-flow` on a fresh `kademe_flow_check` (Task 2 Step 11): the script's "info renders" check (Task 11 report) still finds a node; all ok.

- [ ] **Step 6: Browser check**

On `kademe_ui_check`: mint a link, then `docker exec kademe-db psql -U kademe -d kademe_ui_check -c "update candidates set email = null where full_name = 'Elif Kaya' and email like 'aday-%'"`; open it, Welcome, Consent, tick, agree: `/info` shows "Seni doğru kaydedelim" in two regions, the name filled, the e-mail empty; "Devam et" grey with "Geçerli bir e-posta adresi yaz." beside it; the field text is 16px (`javascript_tool`: `getComputedStyle(document.querySelector('input[type=email]')).fontSize` is `16px`). Type `elif@` then complete it: the button fills. Check the failure path: stop the dev server, press "Devam et": the note says "Kaydedilemedi. Tekrar dener misin?" (never "Failed to fetch"); start the server again, press again: `/check`. 1440, 1280, 1024 screenshots.

- [ ] **Step 7: Commit**

```bash
git add src/components/hiring/candidate/info-model.ts src/components/hiring/candidate/info-model.test.ts src/components/hiring/candidate/info-step.tsx src/solutions/hiring/candidate/pages.tsx src/solutions/hiring/candidate/pages.test.ts src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Give hiring its own details step

The hiring /info screen is a step screen with two 16px fields, the
reason the server would give next to the waiting button, and a refusal in
the server's words or ours, never the browser's raw text. The exam keeps
the core InfoForm unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

(add `src/solutions/boundary.test.ts` to `git add` only if Step 5 shrank its list.)

---

### Task 7: V4 part 1, the device check's sub-steps and the Task 12 polish rules as pure code

**Files:**
- Create: `src/components/hiring/candidate/device-steps.ts`, `src/components/hiring/candidate/device-steps.test.ts`
- Modify: `src/components/hiring/candidate/device-rows.ts:62` (in-app browsers: TikTok and Snapchat)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringDevice`: `micNoMeter`, `trialNoMeter`, `fixUnsupported`)

**Shared with the exam:** none.

**Interfaces:**
- Consumes: `deviceBlocker`, `fixKeyFor`, types `Blocker`, `DeniedKind`, `Permission`, `Trial` from `./device-rows` (unchanged API; `device-rows.test.ts` is not edited and must stay green).
- Produces (`device-steps.ts`):
  - `type DeviceStep = "open" | "denied" | "sound" | "quiet" | "trial" | "listen"`
  - `type StepInput = { camera: boolean; permission: Permission; heard: boolean; quiet: boolean; trial: Trial; denied: DeniedKind | null }`
  - `deviceStep(input: StepInput): { step: DeviceStep; primary: "open" | "retry" | "trial" | "continue" | null; wait: Blocker | "asking" | null }`
  - `type ReportKind = "devices" | "quiet" | "recorder"`; `type ReportState = "idle" | "sending" | "sent" | "failed"`; `NO_REPORTS: Record<ReportKind, ReportState>`; `withReport(reports: Record<ReportKind, ReportState>, kind: ReportKind, state: ReportState): Record<ReportKind, ReportState>`
  - `contextStalled(state: string): boolean` (`suspended` and Safari's `interrupted`)
  - `quietCopy(meterless: boolean): { mic: "micNoMeter" | "micQuietHint"; trial: "trialNoMeter" | "trialQuiet" }`
  - `unsupportedSteps(userAgent: string, maxTouchPoints: number): "fixinApp" | "fixUnsupported"`
  - `checkMemoryKey(token: string): string`; `readCheckMemory(storage: Pick<Storage, "getItem"> | null, key: string): { trialPlayed: boolean }`; `writeCheckMemory(storage: Pick<Storage, "setItem"> | null, key: string, memory: { trialPlayed: boolean }): void`
  - `shouldAutoOpen(input: { camera: boolean; cameraPermission: PermissionState | null; microphonePermission: PermissionState | null }): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/hiring/candidate/device-steps.test.ts
import { describe, expect, it } from "vitest";
import { deviceBlocker, fixKeyFor, type Permission, type Trial } from "./device-rows";
import {
  checkMemoryKey,
  contextStalled,
  deviceStep,
  NO_REPORTS,
  quietCopy,
  readCheckMemory,
  shouldAutoOpen,
  unsupportedSteps,
  withReport,
  writeCheckMemory,
  type StepInput,
} from "./device-steps";

const base: StepInput = { camera: true, permission: "idle", heard: false, quiet: false, trial: "none", denied: null };

describe("the device check as three sub-steps (HIRING-VISUAL-FLOW 3.3, G2)", () => {
  it("A: turn the devices on; the filled button is that action, waiting only while the browser asks", () => {
    expect(deviceStep(base)).toEqual({ step: "open", primary: "open", wait: null });
    expect(deviceStep({ ...base, permission: "asking" })).toEqual({ step: "open", primary: "open", wait: "asking" });
  });

  it("a refusal offers Tekrar dene, except where asking again cannot help (no camera access at all)", () => {
    expect(deviceStep({ ...base, permission: "denied", denied: "notAllowed" })).toEqual({ step: "denied", primary: "retry", wait: null });
    expect(deviceStep({ ...base, permission: "denied", denied: "unsupported" })).toEqual({ step: "denied", primary: null, wait: null });
  });

  it("B: the test recording, waiting for a voice first; an unheard microphone lets the trial prove it (Task 12 ruling)", () => {
    const granted = { ...base, permission: "granted" as const };
    expect(deviceStep(granted)).toEqual({ step: "sound", primary: "trial", wait: "sound" });
    expect(deviceStep({ ...granted, heard: true })).toEqual({ step: "trial", primary: "trial", wait: null });
    expect(deviceStep({ ...granted, quiet: true })).toEqual({ step: "quiet", primary: "trial", wait: null });
    expect(deviceStep({ ...granted, heard: true, trial: "recording" })).toEqual({ step: "trial", primary: "trial", wait: "trialRecording" });
  });

  it("C: can you see and hear yourself; 'Evet, devam et' waits until the recording was played", () => {
    const granted = { ...base, permission: "granted" as const, heard: true };
    expect(deviceStep({ ...granted, trial: "ready" })).toEqual({ step: "listen", primary: "continue", wait: "trialListen" });
    expect(deviceStep({ ...granted, trial: "played" })).toEqual({ step: "listen", primary: "continue", wait: null });
  });

  it("goes on only where the plan 2 rows say nothing blocks (device-rows stays the rule)", () => {
    const permissions: Permission[] = ["idle", "asking", "granted", "denied"];
    const trials: Trial[] = ["none", "recording", "ready", "played"];
    for (const camera of [true, false])
      for (const permission of permissions)
        for (const heard of [true, false])
          for (const quiet of [true, false])
            for (const trial of trials) {
              const input = { camera, permission, heard, quiet, trial, denied: permission === "denied" ? ("notAllowed" as const) : null };
              const s = deviceStep(input);
              const free = s.primary === "continue" && s.wait === null;
              expect(free, JSON.stringify(input)).toBe(deviceBlocker(input) === null);
            }
  });
});

describe("Task 12 polish carries", () => {
  it("keeps a report's state per row: a report sent from one row is not 'sent' in another", () => {
    const after = withReport(NO_REPORTS, "quiet", "sent");
    expect(after).toEqual({ devices: "idle", quiet: "sent", recorder: "idle" });
    expect(NO_REPORTS.quiet).toBe("idle");
  });

  it("treats Safari's interrupted sound context like a suspended one", () => {
    expect(contextStalled("suspended")).toBe(true);
    expect(contextStalled("interrupted")).toBe(true);
    expect(contextStalled("running")).toBe(false);
    expect(contextStalled("closed")).toBe(false);
  });

  it("never says 'we could not hear you' where it could not listen at all (no sound context)", () => {
    expect(quietCopy(true)).toEqual({ mic: "micNoMeter", trial: "trialNoMeter" });
    expect(quietCopy(false)).toEqual({ mic: "micQuietHint", trial: "trialQuiet" });
  });

  it("sends only an in-app browser to 'open it in your browser'; another browser without camera access gets its own words", () => {
    expect(unsupportedSteps("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0", 5)).toBe("fixinApp");
    expect(unsupportedSteps("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", 0)).toBe("fixUnsupported");
  });

  it("knows TikTok and Snapchat as in-app browsers", () => {
    expect(fixKeyFor("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_32.5.0 JsSdk/2.0 NetType/WIFI")).toBe("inApp");
    expect(fixKeyFor("Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 trill_310503 BytedanceWebview/d8a21c6")).toBe("inApp");
    expect(fixKeyFor("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.80.0.35 (like Safari/8617.1.17.10.12, panda)")).toBe("inApp");
  });

  it("survives a remount (a language switch): the played trial is remembered in the tab, and devices already allowed reopen without a prompt", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const key = checkMemoryKey("tok");
    expect(readCheckMemory(storage, key)).toEqual({ trialPlayed: false });
    writeCheckMemory(storage, key, { trialPlayed: true });
    expect(readCheckMemory(storage, key)).toEqual({ trialPlayed: true });
    expect(readCheckMemory({ getItem: () => "{broken" }, key)).toEqual({ trialPlayed: false });
    expect(readCheckMemory(null, key)).toEqual({ trialPlayed: false });
    expect(shouldAutoOpen({ camera: true, cameraPermission: "granted", microphonePermission: "granted" })).toBe(true);
    expect(shouldAutoOpen({ camera: true, cameraPermission: "prompt", microphonePermission: "granted" })).toBe(false);
    expect(shouldAutoOpen({ camera: false, cameraPermission: null, microphonePermission: "granted" })).toBe(true);
    // Firefox cannot be asked about "camera": unknown is not granted.
    expect(shouldAutoOpen({ camera: true, cameraPermission: null, microphonePermission: "granted" })).toBe(false);
  });
});
```

Run: `pnpm exec vitest run src/components/hiring/candidate/device-steps.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 2: The implementation**

```ts
// src/components/hiring/candidate/device-steps.ts
import { deviceBlocker, fixKeyFor, type Blocker, type DeniedKind, type Permission, type Trial } from "./device-rows";

/**
 * HIRING-VISUAL-FLOW 3.3: the device check as three sub-steps, each with a
 * filled button that is the next real action (G2): A turn the devices on, B
 * make a 5 second test, C "can you see and hear yourself?". The rows model
 * (device-rows.ts) stays the rule for what blocks: "Evet, devam et" goes only
 * where deviceBlocker says nothing does (tested over every input).
 */
export type DeviceStep = "open" | "denied" | "sound" | "quiet" | "trial" | "listen";
export type StepInput = { camera: boolean; permission: Permission; heard: boolean; quiet: boolean; trial: Trial; denied: DeniedKind | null };

export function deviceStep(input: StepInput): { step: DeviceStep; primary: "open" | "retry" | "trial" | "continue" | null; wait: Blocker | "asking" | null } {
  if (input.permission === "idle" || input.permission === "asking") return { step: "open", primary: "open", wait: input.permission === "asking" ? "asking" : null };
  if (input.permission === "denied") return { step: "denied", primary: input.denied === "unsupported" ? null : "retry", wait: null };
  if (input.trial === "ready" || input.trial === "played") return { step: "listen", primary: "continue", wait: deviceBlocker(input) };
  const recording = input.trial === "recording" ? ("trialRecording" as const) : null;
  if (!input.heard && !input.quiet) return { step: "sound", primary: "trial", wait: "sound" };
  return { step: input.heard ? "trial" : "quiet", primary: "trial", wait: recording };
}

/** Task 12 carry: each "Sorun bildir" keeps its own state, so a report from one row is never shown as sent in another. */
export type ReportKind = "devices" | "quiet" | "recorder";
export type ReportState = "idle" | "sending" | "sent" | "failed";
export const NO_REPORTS: Record<ReportKind, ReportState> = { devices: "idle", quiet: "idle", recorder: "idle" };
export const withReport = (reports: Record<ReportKind, ReportState>, kind: ReportKind, state: ReportState) => ({ ...reports, [kind]: state });

/** Task 12 carry: Safari reports "interrupted" for a context it holds back; it is waited for like "suspended". */
export const contextStalled = (state: string) => state === "suspended" || state === "interrupted";

/** Task 12 carry: without a sound context nothing was listened to, so "we could not hear you" would be untrue. */
export function quietCopy(meterless: boolean): { mic: "micNoMeter" | "micQuietHint"; trial: "trialNoMeter" | "trialQuiet" } {
  return meterless ? { mic: "micNoMeter", trial: "trialNoMeter" } : { mic: "micQuietHint", trial: "trialQuiet" };
}

/** Task 12 carry: "open it in Safari or Chrome from the menu" is for in-app browsers only. */
export const unsupportedSteps = (userAgent: string, maxTouchPoints: number): "fixinApp" | "fixUnsupported" =>
  fixKeyFor(userAgent, maxTouchPoints) === "inApp" ? "fixinApp" : "fixUnsupported";

/**
 * Task 12 carry (a language switch remounts /check): the tab remembers that
 * the test recording was played, and devices the browser already allows are
 * turned on again without asking, so the candidate is not sent back to step A.
 */
export const checkMemoryKey = (token: string) => `kademe-hiring-check:${token}`;

export function readCheckMemory(storage: Pick<Storage, "getItem"> | null, key: string): { trialPlayed: boolean } {
  try {
    const raw = storage?.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as { trialPlayed?: unknown }) : null;
    return { trialPlayed: parsed?.trialPlayed === true };
  } catch {
    return { trialPlayed: false };
  }
}

export function writeCheckMemory(storage: Pick<Storage, "setItem"> | null, key: string, memory: { trialPlayed: boolean }): void {
  try {
    storage?.setItem(key, JSON.stringify(memory));
  } catch {
    // A tab without storage starts the check again after a remount; nothing else depends on it.
  }
}

export function shouldAutoOpen(input: { camera: boolean; cameraPermission: PermissionState | null; microphonePermission: PermissionState | null }): boolean {
  if (input.microphonePermission !== "granted") return false;
  return input.camera ? input.cameraPermission === "granted" : true;
}
```

In `src/components/hiring/candidate/device-rows.ts:62` change the in-app pattern to:

```ts
  if (/FBAN|FBAV|Instagram|LinkedInApp|GSA\/|Line\/|; wv\)|musical_ly|BytedanceWebview|Snapchat/.test(userAgent)) return "inApp";
```

and add "TikTok, Snapchat" to the list in the comment above it (`:53-60`).

Copy, `hiringDevice` (new keys):

| Key | TR | EN |
|---|---|---|
| `micNoMeter` | Bu tarayıcıda ses seviyesini göremiyoruz. Deneme kaydını dinleyerek kontrol et. | This browser does not show us your sound level. Check by listening to the test recording. |
| `trialNoMeter` | Ses seviyesini göremedik. Deneme kaydını dinle; kendi sesini duyuyorsan devam edebilirsin. | We could not see your sound level. Listen to the test; if you hear yourself, you can go on. |
| `fixUnsupported` | Linki Chrome, Edge, Firefox ya da Safari'nin güncel bir sürümünde aç. | Open the link in an up-to-date Chrome, Edge, Firefox or Safari. |

- [ ] **Step 3: Run the tests**

Run: `pnpm exec vitest run src/components/hiring/candidate/device-steps.test.ts src/components/hiring/candidate/device-rows.test.ts src/i18n`
Expected: PASS; `device-rows.test.ts` passes unchanged (design V4 "device-rows.test.ts değişmeden geçiyor").

- [ ] **Step 4: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4`
Expected: clean.

- [ ] **Step 5: No browser step** (pure code; Task 8 renders it).

- [ ] **Step 6: Commit**

```bash
git add src/components/hiring/candidate/device-steps.ts src/components/hiring/candidate/device-steps.test.ts src/components/hiring/candidate/device-rows.ts src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Model the device check as three sub-steps

The filled button is the next real action (open, test, yes continue) and
goes on only where the rows say nothing blocks. The Task 12 polish rules
become pure code: report state per row, Safari's interrupted context, no
'we could not hear you' without a sound context, in-app steps only for
in-app browsers (TikTok and Snapchat added), and a remount that keeps the
played trial and reopens allowed devices.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 8: V4 part 2, the device check screen (split, big preview, three sub-steps, permission drawing)

**Files:**
- Modify (render rewritten, logic kept): `src/components/hiring/candidate/device-check.tsx:1-582`
- Modify: `src/components/hiring/candidate/device-steps.ts` (+ `splitFix`), `device-steps.test.ts`
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringDevice`: new step titles; `fix*`, `trialQuiet`, `micQuietHint` unchanged)
- Modify: `src/i18n/hiring-candidate-copy.test.ts` (titles pinned)

**Shared with the exam:** none (the exam's check is `src/components/candidate/SystemCheck*`, untouched).

**Interfaces:**
- Consumes: everything from Task 7; `StepScreen`, `StepFooter`, `PathSteps`, `Disclosure`, `Illustration` (`permission`); `useJourney` (Task 5); `sessionDrafts` (`./draft-store`).
- Produces: `splitFix(text: string): { first: string; rest: string | null }` (the browser's step, then the operating system's paragraph after the first newline). `DeviceCheck` props unchanged: `{ token; camera; practice; locale; contactEmail }` (pages.test pins them).

- [ ] **Step 1: Failing tests**

Add to `src/components/hiring/candidate/device-steps.test.ts` (and `splitFix` to its import):

```ts
describe("the refusal's two steps (3.3: browser first, the computer's settings behind 'Hâlâ olmuyor mu?')", () => {
  it("splits a fix at its first newline and keeps one-line fixes whole", () => {
    expect(splitFix("Adres çubuğu...\nHâlâ açılmıyorsa bilgisayarın...")).toEqual({ first: "Adres çubuğu...", rest: "Hâlâ açılmıyorsa bilgisayarın..." });
    expect(splitFix("Tek satır.")).toEqual({ first: "Tek satır.", rest: null });
  });
});
```

Add to `src/i18n/hiring-candidate-copy.test.ts`:

```ts
  it("titles the device check's sub-steps as questions or actions (3.3)", () => {
    expect(tr.hiringDevice.titleOpen).toBe("Kameranı açalım");
    expect(tr.hiringDevice.titleTrial).toBe("5 saniyelik bir deneme yap");
    expect(tr.hiringDevice.titleListen).toBe("Kendini görüp duyabiliyor musun?");
    expect(tr.hiringDevice.titleDenied).toBe("Kamera izni kapalı");
    expect(en.hiringDevice.yesContinue).toBe("Yes, continue");
    expect(tr.hiringDevice.leadTrial).toBe("Kendini izle ve dinle. Bu kayıt kimseye gitmez.");
  });
```

Run: `pnpm exec vitest run src/components/hiring/candidate/device-steps.test.ts src/i18n/hiring-candidate-copy.test.ts`
Expected: FAIL (`splitFix` missing, keys missing).

- [ ] **Step 2: `splitFix` and the copy**

Append to `device-steps.ts`:

```ts
/** 3.3: the browser's own step is shown; the operating system's paragraph (after the first newline) waits behind "Hâlâ olmuyor mu?". */
export function splitFix(text: string): { first: string; rest: string | null } {
  const at = text.indexOf("\n");
  return at < 0 ? { first: text, rest: null } : { first: text.slice(0, at), rest: text.slice(at + 1) };
}
```

New `hiringDevice` keys:

| Key | TR | EN |
|---|---|---|
| `titleOpen` | Kameranı açalım | Let's turn on your camera |
| `titleOpenMic` | Mikrofonunu açalım | Let's turn on your microphone |
| `leadOpen` | Önizleme yalnızca sende. Kayıt yapılmaz. | Only you see the preview. Nothing is recorded. |
| `leadOpenMic` | Sesin yalnızca sende kalır. Kayıt yapılmaz. | Your sound stays with you. Nothing is recorded. |
| `titleTrial` | 5 saniyelik bir deneme yap | Make a 5 second test |
| `leadTrial` | Kendini izle ve dinle. Bu kayıt kimseye gitmez. | Watch and listen to yourself. This goes to no one. |
| `leadTrialMic` | Kendini dinle. Bu kayıt kimseye gitmez. | Listen to yourself. This goes to no one. |
| `titleQuiet` | Sesini duyamadık | We could not hear you |
| `titleNoMeter` | Ses seviyesini göremiyoruz | We cannot see your sound level |
| `titleListen` | Kendini görüp duyabiliyor musun? | Can you see and hear yourself? |
| `titleListenMic` | Kendini duyabiliyor musun? | Can you hear yourself? |
| `titleDenied` | Kamera izni kapalı | Camera access is off |
| `titleDeniedMic` | Mikrofon izni kapalı | Microphone access is off |
| `leadDenied` | İki adımda açabilirsin. | Two steps to turn it on. |
| `titleUnreachable` | Kameraya ulaşamadık | We could not reach the camera |
| `titleUnreachableMic` | Mikrofona ulaşamadık | We could not reach the microphone |
| `stepReload` | Sayfayı yenile ya da Tekrar dene'ye bas. | Reload the page or press Try again. |
| `stillNot` | Hâlâ olmuyor mu? | Still not working? |
| `trialStart` | Deneme kaydını başlat | Start the test |
| `yesContinue` | Evet, devam et | Yes, continue |
| `now` | Şimdi | Now |
| `connShortOk` | İyi | Good |
| `connShortLow` | Düşük | Low |
| `connShortUnknown` | Ölçülemedi | Not measured |
| `cameraLater` | Kamera, izin verince burada açılır. | Your camera appears here once you allow it. |
| `playedBefore` | Deneme kaydını dinledin. | You listened to your test. |
| `rowsLabel` | Kontrol listesi | Checklist |

- [ ] **Step 3: The screen**

Replace `src/components/hiring/candidate/device-check.tsx` with the file below. The streams, the sound meter, the trial recorder, the bandwidth probe, the report and `proceed` are the plan 2 code (Task 12 and its fix round), with four changes: report state per row (`withReport`), `contextStalled` instead of `ctx.state === "suspended"`, `meterless` when no sound context exists, and the remount memory (the played trial is remembered; devices the browser already allows reopen without a prompt).

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/visual/disclosure";
import { Illustration } from "@/components/visual/illustrations";
import { PathSteps } from "@/components/visual/path-steps";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { stepFocusController, useStepFocus } from "@/hooks/use-step-focus";
import { apiSend, candidateApiBase } from "@/lib/client/api";
import { CHUNK_MS, pickRecorderMime } from "@/lib/client/recorder";
import { nextPath } from "@/lib/candidate-routes";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { mailTo } from "./closed";
import { HEARD_AT, deniedKind, deviceRows, fixKeyFor, formatMbps, isQuiet, mediaConstraints, peakLevel, uploadSpeed, type DeniedKind, type Permission, type Trial } from "./device-rows";
import { checkMemoryKey, contextStalled, deviceStep, NO_REPORTS, quietCopy, readCheckMemory, shouldAutoOpen, splitFix, unsupportedSteps, withReport, writeCheckMemory, type ReportKind, type ReportState } from "./device-steps";
import { sessionDrafts } from "./draft-store";
import { serverMessage } from "./server-message";
import { openTracked, stopAllStreams } from "./streams";
import { useJourney } from "./use-journey";

const TRIAL_MS = 5000;
const PROBE_BYTES = 512 * 1024;
/** A probe that has not answered by then is "Ölçülemedi"; the connection row never waits longer. */
const PROBE_TIMEOUT_MS = 10_000;

type Bandwidth = { state: "measuring" | "unknown" } | { state: "ok" | "low"; mbps: number };

function newSoundContext(): AudioContext {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctx();
}

async function permissionOf(name: "camera" | "microphone"): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions?.query({ name: name as PermissionName }))?.state ?? null;
  } catch {
    // Firefox does not know "camera": unknown is never taken as allowed.
    return null;
  }
}

/**
 * HIRING-VISUAL-FLOW 3.3: three sub-steps (turn the devices on, a 5 second
 * test, "can you see and hear yourself?"), the candidate's own picture as the
 * screen's picture on the right, a short checklist on the left. The filled
 * button is always the next real action (G2); it goes on only where the rows
 * model says nothing blocks (device-steps tests it). Nothing here is a
 * proctoring check; the test recording stays in this tab.
 *
 * Kept from plan 2 (Task 12 and its review): the sound context is made inside
 * the click; an unheard microphone lets the trial prove itself after 8 s; a
 * refusal, a missing device, a busy device and a browser without camera
 * access each get their own next step; every stream is registered and stopped
 * when the candidate goes on, the screen goes or the page is hidden.
 */
export function DeviceCheck({
  token,
  camera,
  practice,
  locale,
  contactEmail,
}: {
  token: string;
  camera: boolean;
  practice: boolean;
  locale: Locale;
  /** Named in a report's confirmation for an urgent problem (no reply is promised). */
  contactEmail: string | null;
}) {
  const t = useT("hiringDevice");
  const router = useRouter();
  const body = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const preview = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const meter = useRef<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const trialUrl = useRef<string | null>(null);
  const alive = useRef(false);
  const failure = useRef("");
  const memoryKey = checkMemoryKey(token);
  const [focus] = useState(stepFocusController);
  const [permission, setPermission] = useState<Permission>("idle");
  const [denied, setDenied] = useState<DeniedKind | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [meterless, setMeterless] = useState(false);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const [trial, setTrial] = useState<Trial>("none");
  const [trialFailed, setTrialFailed] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [bandwidth, setBandwidth] = useState<Bandwidth>({ state: "measuring" });
  const [reports, setReports] = useState<Record<ReportKind, ReportState>>(NO_REPORTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const journey = useJourney("device", { device: true, warmup: practice });
  const anySent = reports.devices === "sent" || reports.quiet === "sent" || reports.recorder === "sent";
  const sentNote = useStepFocus<HTMLParagraphElement>(anySent ? "sent" : "form");

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const probe = new AbortController();
    const probeTimer = window.setTimeout(() => probe.abort(), PROBE_TIMEOUT_MS);
    (async () => {
      try {
        const payload = new Uint8Array(PROBE_BYTES);
        for (let offset = 0; offset < payload.length; offset += 65_536) crypto.getRandomValues(payload.subarray(offset, offset + 65_536));
        const started = performance.now();
        const res = await fetch(`${candidateApiBase(token)}/bandwidth`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: payload, signal: probe.signal });
        if (!res.ok) throw new Error(String(res.status));
        const speed = uploadSpeed(PROBE_BYTES, performance.now() - started);
        if (!cancelled) setBandwidth(speed);
      } catch {
        if (!cancelled) setBandwidth({ state: "unknown" });
      } finally {
        window.clearTimeout(probeTimer);
      }
    })();
    const onHide = () => {
      stopAllStreams();
    };
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    const refs = { timer, recorder, meter, audio, stream, trialUrl };
    return () => {
      cancelled = true;
      alive.current = false;
      probe.abort();
      window.clearTimeout(probeTimer);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      if (refs.timer.current !== null) window.clearTimeout(refs.timer.current);
      const rec = refs.recorder.current;
      if (rec && rec.state !== "inactive") rec.stop();
      if (refs.meter.current !== null) window.clearInterval(refs.meter.current);
      void refs.audio.current?.close().catch(() => undefined);
      refs.audio.current = null;
      stopAllStreams();
      refs.stream.current = null;
      if (refs.trialUrl.current) URL.revokeObjectURL(refs.trialUrl.current);
      refs.trialUrl.current = null;
    };
  }, [token]);

  // The preview element is always mounted; it gets the stream once granted.
  useEffect(() => {
    const video = preview.current;
    if (permission !== "granted" || !camera || !video || !stream.current || video.srcObject === stream.current) return;
    video.srcObject = stream.current;
    void video.play().catch(() => undefined);
  }, [permission, camera]);

  function listen(media: MediaStream, ctx: AudioContext | null) {
    if (!ctx) {
      // No sound context: nothing to listen with, so the copy says so (Task 12 carry) and the trial is the proof.
      setMeterless(true);
      setQuiet(true);
      return;
    }
    try {
      audio.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const stop = () => {
        if (meter.current !== null) window.clearInterval(meter.current);
        meter.current = null;
      };
      const started = performance.now();
      let suspendedSince: number | null = null;
      const measure = () => {
        if (!alive.current || ctx.state === "closed") return stop();
        const now = performance.now();
        // Safari's "interrupted" is held back like "suspended" (Task 12 carry): asked again until it runs.
        if (contextStalled(ctx.state)) {
          suspendedSince ??= now;
          void ctx.resume().catch(() => undefined);
        } else suspendedSince = null;
        if (isQuiet({ heard: false, listenedMs: now - started, suspendedMs: suspendedSince === null ? 0 : now - suspendedSince })) setQuiet(true);
        analyser.getByteTimeDomainData(data);
        const peak = peakLevel(data);
        setLevel(Math.round(peak * 20) / 20);
        if (peak > HEARD_AT) {
          stop();
          setHeard(true);
          void ctx.close().catch(() => undefined);
          audio.current = null;
        }
      };
      meter.current = window.setInterval(measure, 50);
    } catch {
      setMeterless(true);
      setQuiet(true);
    }
  }

  async function openDevices() {
    setDenied(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      failure.current = "NoMediaDevices";
      setPermission("denied");
      setDenied("unsupported");
      return;
    }
    setPermission("asking");
    void audio.current?.close().catch(() => undefined);
    audio.current = null;
    let ctx: AudioContext | null = null;
    try {
      ctx = newSoundContext();
      void ctx.resume().catch(() => undefined);
    } catch {
      ctx = null;
    }
    try {
      const media = await openTracked(() => navigator.mediaDevices.getUserMedia(mediaConstraints(camera)), () => alive.current);
      if (!media) {
        void ctx?.close().catch(() => undefined);
        return;
      }
      stream.current = media;
      setPermission("granted");
      // A remount (a language switch) keeps the test the candidate already played (Task 12 carry).
      if (readCheckMemory(sessionDrafts(), memoryKey).trialPlayed) setTrial((now) => (now === "none" ? "played" : now));
      listen(media, ctx);
    } catch (err) {
      void ctx?.close().catch(() => undefined);
      failure.current = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "unknown";
      setPermission("denied");
      setDenied(deniedKind(err));
    }
  }

  // Devices this browser already allows open again by themselves after a remount; a first visit still waits for the click.
  const openRef = useRef(openDevices);
  useEffect(() => {
    openRef.current = openDevices;
  });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cameraPermission, microphonePermission] = await Promise.all([camera ? permissionOf("camera") : Promise.resolve(null), permissionOf("microphone")]);
      if (!cancelled && shouldAutoOpen({ camera, cameraPermission, microphonePermission })) void openRef.current();
    })();
    // A sound context made without a click may wait for one: the first click or key lets it run.
    const wake = () => void audio.current?.resume().catch(() => undefined);
    document.addEventListener("pointerdown", wake, { once: true });
    document.addEventListener("keydown", wake, { once: true });
    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", wake);
      document.removeEventListener("keydown", wake);
    };
  }, [camera]);

  function record() {
    const media = stream.current;
    if (!media || recorder.current) return;
    setTrialFailed(false);
    try {
      const mime = pickRecorderMime(camera ? "video" : "audio");
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      rec.onstop = () => {
        recorder.current = null;
        if (!alive.current) return;
        if (trialUrl.current) URL.revokeObjectURL(trialUrl.current);
        trialUrl.current = null;
        if (chunks.length === 0) {
          setSrc(null);
          setTrial("none");
          setTrialFailed(true);
          return;
        }
        trialUrl.current = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || mime || (camera ? "video/webm" : "audio/webm") }));
        setSrc(trialUrl.current);
        setTrial("ready");
      };
      rec.start(CHUNK_MS);
      recorder.current = rec;
      setTrial("recording");
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (rec.state === "recording") rec.stop();
      }, TRIAL_MS);
    } catch {
      recorder.current = null;
      setTrialFailed(true);
    }
  }

  function played() {
    setTrial("played");
    writeCheckMemory(sessionDrafts(), memoryKey, { trialPlayed: true });
  }

  async function sendReport(kind: ReportKind) {
    setReports((now) => withReport(now, kind, "sending"));
    const message = kind === "quiet" ? t("reportQuietMessage") : kind === "recorder" ? t("reportRecorderMessage") : `${t("reportMessage")} (${failure.current || "-"})`;
    try {
      await apiSend(token, "/problem", { area: "DEVICE_CHECK", message });
      setReports((now) => withReport(now, kind, "sent"));
    } catch {
      setReports((now) => withReport(now, kind, "failed"));
    }
  }

  async function proceed() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<HiringCandidateState>(token, "/device-check", {});
      stopAllStreams();
      stream.current = null;
      router.push(practice ? `/a/${encodeURIComponent(token)}/practice` : nextPath(token, next));
    } catch (err) {
      setError(serverMessage(err) ?? t("failed"));
      setBusy(false);
    }
  }

  const input = { camera, permission, heard, quiet, trial };
  const now = deviceStep({ ...input, denied });
  const rows = deviceRows(input);
  const words = quietCopy(meterless);
  const stepKey = permission === "denied" ? `denied:${denied}` : now.step;

  // Focus follows the step only when it was lost (on <body> or inside the step's own area), as in plan 2.
  useEffect(() => {
    const focused = document.activeElement;
    const lost = !focused || focused === document.body || !!body.current?.contains(focused);
    focus.onStep(stepKey, lost ? title.current : null);
  }, [focus, stepKey]);

  function reportControl(kind: ReportKind) {
    const state = reports[kind];
    if (state === "sent") {
      return (
        <p ref={sentNote} tabIndex={-1} role="status" className="text-[14px] leading-[22px] text-ink">
          {contactEmail ? t.rich("reportSentContact", { email: contactEmail, mail: mailTo(contactEmail) }) : t("reportSent")}
        </p>
      );
    }
    return (
      <div>
        <Button className="min-h-11 text-[16px]" onClick={() => void sendReport(kind)} disabled={state === "sending"} disabledReason={t("reporting")}>
          {state === "sending" ? t("reporting") : t("report")}
        </Button>
        {state === "failed" ? (
          <p role="alert" className="mt-2 text-[14px] leading-[22px] text-ink">
            {t("reportFailed")}
          </p>
        ) : null}
      </div>
    );
  }

  const heading =
    now.step === "open"
      ? camera
        ? t("titleOpen")
        : t("titleOpenMic")
      : now.step === "denied"
        ? denied === "notAllowed"
          ? camera
            ? t("titleDenied")
            : t("titleDeniedMic")
          : camera
            ? t("titleUnreachable")
            : t("titleUnreachableMic")
        : now.step === "quiet"
          ? meterless
            ? t("titleNoMeter")
            : t("titleQuiet")
          : now.step === "listen"
            ? camera
              ? t("titleListen")
              : t("titleListenMic")
            : t("titleTrial");
  const lead =
    now.step === "open"
      ? camera
        ? t("leadOpen")
        : t("leadOpenMic")
      : now.step === "denied"
        ? denied === "notAllowed"
          ? t("leadDenied")
          : denied === "notFound"
            ? t("deniedNotFound")
            : denied === "busy"
              ? t("deniedBusy")
              : denied === "unsupported"
                ? t("deniedUnsupported")
                : t("deniedOther")
        : now.step === "quiet"
          ? t(words.trial)
          : now.step === "listen"
            ? null
            : camera
              ? t("leadTrial")
              : t("leadTrialMic");

  /** The short status word of a checklist row. */
  function rowWord(id: (typeof rows)[number]["id"], state: (typeof rows)[number]["state"]) {
    if (id === "connection") return "mbps" in bandwidth ? (bandwidth.state === "ok" ? t("connShortOk") : t("connShortLow")) : bandwidth.state === "measuring" ? t("connMeasuring") : t("connShortUnknown");
    if (id === "microphone" && state === "done") return t("micHeard");
    return state === "done" ? t("ready") : state === "quiet" ? t("rowQuiet") : state === "active" ? t("now") : t("waiting");
  }

  const fix = permission === "denied" && (denied === "notAllowed" || denied === "other") ? splitFix(t(`fix${fixKeyFor(navigator.userAgent, navigator.maxTouchPoints ?? 0)}`)) : null;

  const left = (
    <div ref={body} className="space-y-6">
      <ul aria-label={t("rowsLabel")} className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map((row) => (
          <li key={row.id} aria-current={row.state === "active" ? "step" : undefined} className="flex min-h-12 items-center justify-between gap-4 px-4">
            <span className={cn("text-[16px] text-ink", row.state === "active" && "font-semibold")}>{t(`row${row.id}`)}</span>
            <span className="tnum text-[14px] text-muted">{rowWord(row.id, row.state)}</span>
          </li>
        ))}
      </ul>
      {bandwidth.state === "low" ? <p className="tnum text-[14px] leading-[22px] text-ink-2">{t("connLow", { mbps: formatMbps(bandwidth.mbps, locale) })}</p> : null}

      {now.step === "open" && denied !== "unsupported" ? (
        <p id="check-open-why" className="text-[16px] leading-[26px] text-ink-2">
          {camera ? t("cameraAsk") : t("micAsk")}
        </p>
      ) : null}

      {now.step === "denied" ? (
        <div className="space-y-4">
          {fix ? (
            <>
              <PathSteps steps={[{ title: fix.first, state: "current" }, { title: t("stepReload") }]} />
              <Disclosure label={t("stillNot")}>
                <div className="space-y-3">
                  {fix.rest ? <p className="text-[16px] leading-[26px] whitespace-pre-line text-ink-2">{fix.rest}</p> : null}
                  {reportControl("devices")}
                </div>
              </Disclosure>
            </>
          ) : (
            <>
              {denied === "unsupported" ? <p className="text-[16px] leading-[26px] text-ink-2">{t(unsupportedSteps(navigator.userAgent, navigator.maxTouchPoints ?? 0))}</p> : null}
              {reportControl("devices")}
            </>
          )}
        </div>
      ) : null}

      {now.step === "sound" || now.step === "trial" || now.step === "quiet" ? (
        <div className="space-y-3">
          <div role="meter" aria-label={t("micLevel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} className="h-2 w-full overflow-hidden rounded-full bg-hairline">
            <div className="h-2 rounded-full bg-accent transition-[width] duration-100 motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.round(level * 250))}%` }} />
          </div>
          {/* Task 12 carry: the hint is said when it appears (polite), and never claims we listened when we could not. */}
          <p role="status" className="text-[16px] leading-[26px] text-ink-2">
            {heard ? t("micHeard") : quiet ? t(words.mic) : t("micHint")}
          </p>
          {quiet && !heard ? reportControl("quiet") : null}
          {typeof MediaRecorder === "undefined" && permission === "granted" ? (
            <div className="space-y-3">
              <p className="text-[16px] leading-[26px] font-medium text-ink">{t("noRecorder")}</p>
              {reportControl("recorder")}
            </div>
          ) : null}
          {trialFailed ? (
            <p role="alert" className="text-[14px] leading-[22px] text-ink">
              {t("failed")}
            </p>
          ) : null}
        </div>
      ) : null}

      {now.step === "listen" ? (
        <div className="space-y-3">
          {trial === "ready" ? <p className="text-[16px] leading-[26px] text-ink-2">{t("trialListen")}</p> : null}
          {!src && trial === "played" ? <p className="text-[16px] leading-[26px] text-ink-2">{t("playedBefore")}</p> : null}
          {!camera && src ? <audio key={src} src={src} controls aria-label={t("trialPlayback")} onPlay={played} className="h-12 w-full" /> : null}
        </div>
      ) : null}
    </div>
  );

  const pictureVisible = camera && permission !== "denied" && !(now.step === "listen" && src);
  const right = camera ? (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-canvas">
      {permission === "denied" ? (
        <div className="grid size-full place-items-center p-6">
          <Illustration name="permission" size="hero" />
        </div>
      ) : null}
      {now.step === "listen" && src ? (
        <video key={src} src={src} controls playsInline aria-label={t("trialPlayback")} onPlay={played} className="size-full bg-canvas object-cover" />
      ) : null}
      <video ref={preview} muted playsInline className={cn("size-full object-cover", !pictureVisible && "hidden")} />
      {pictureVisible ? <span className="absolute top-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-[13px] leading-5 text-ink">{t("cameraPreview")}</span> : null}
      {pictureVisible && permission !== "granted" ? (
        <span className="absolute inset-0 grid place-items-center text-center">
          <span className="flex flex-col items-center gap-2 text-[14px] text-muted">
            <Camera className="size-8" strokeWidth={1.5} aria-hidden />
            {t("cameraLater")}
          </span>
        </span>
      ) : null}
    </div>
  ) : (
    <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl bg-canvas">
      {permission === "denied" ? <Illustration name="permission" size="hero" /> : <Mic className="size-12 text-muted" strokeWidth={1.5} aria-hidden />}
    </div>
  );

  const primary =
    now.primary === "open"
      ? { kind: "button" as const, id: "check-open", label: camera ? t("openDevices") : t("openMic"), busy: now.wait === "asking", busyLabel: t("asking"), onClick: () => void openDevices() }
      : now.primary === "retry"
        ? { kind: "button" as const, id: "check-retry", label: t("retry"), onClick: () => void openDevices() }
        : now.primary === "trial"
          ? {
              kind: "button" as const,
              id: "check-trial",
              label: trial === "none" ? t("trialStart") : t("trialAgain"),
              busy: trial === "recording",
              busyLabel: t("trialRecording"),
              waitReason: now.wait === "sound" ? t("blocksound") : null,
              onClick: record,
            }
          : now.primary === "continue"
            ? { kind: "button" as const, id: "check-next", label: t("yesContinue"), busy, busyLabel: t("going"), waitReason: now.wait === "trialListen" ? t("blocktrialListen") : null, onClick: () => void proceed() }
            : null;

  return (
    <>
      <StepScreen layout="split" title={heading} titleRef={title} lead={lead ? <p>{lead}</p> : undefined} aside={left}>
        {right}
      </StepScreen>
      <StepFooter
        journey={journey}
        primary={primary}
        secondary={now.step === "listen" ? { kind: "button", id: "check-again", label: t("trialAgain"), onClick: record } : null}
        note={
          error ? (
            <p role="alert" className="text-[14px] text-ink">
              {error}
            </p>
          ) : null
        }
      />
    </>
  );
}
```

The checklist and the step's body sit in `StepScreen`'s left region (`aside`), the picture in the right region: on a 1280 screen the picture is the largest thing on the page (design: "bu ürünün fotoğrafı"). `secondary` in "listen" is "Tekrar kaydet" (outline), so there is still one filled button.

- [ ] **Step 4: Run tests and gates**

Run: `pnpm exec vitest run src/components/hiring/candidate src/i18n src/solutions/hiring/candidate && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4`
Expected: PASS; `device-rows.test.ts` unchanged and green; pages.test's DeviceCheck props test unchanged and green.

- [ ] **Step 5: Browser check (Claude in Chrome) and what needs the user**

`kademe_ui_check`, full fixture (`pnpm dev:hiring-link`), dev server 3100, `PROCTOR_DEV_FAKE` unset. In Chrome the extension tab has a real camera only if the user's machine has one; the permission prompt is the browser's own.
1. 1440: "Kameranı açalım", the checklist (Kamera Şimdi, Mikrofon Sırada, Deneme kaydı Sırada, Bağlantı İyi/Düşük/Ölçülüyor), the camera placeholder with "Kamera, izin verince burada açılır." and the "Önizleme · kayıt yapılmıyor" chip; footer "Cihaz · Adım 2 / 4" and one filled "Kamerayı ve mikrofonu aç". Screenshot. 1280 and 1024 screenshots (picture 520 and 440 wide).
2. Press it. While the browser asks: the button stays filled with a spinner and "İzin bekleniyor" (not grey). Allow: the picture is live, the title is "5 saniyelik bir deneme yap", the button "Deneme kaydını başlat" is grey with "Sesini duymayı bekliyoruz. Birkaç kelime söyle." until a voice is heard (or 8 s pass: "Sesini duyamadık" step, reason gone).
3. Record: filled "Kaydediliyor, 5 saniye" with a spinner; then "Kendini görüp duyabiliyor musun?", the recording plays in the right region, "Evet, devam et" grey with "Deneme kaydını dinle, sonra ilerleyelim." until played; "Tekrar kaydet" outline beside it.
4. Language switch to EN on step 3 (Task 12 remount carry): after the reload of the page the devices come back without a prompt (the browser already allows them) and, once the test was played before the switch, the screen opens on "Can you see and hear yourself?" with "You listened to your test." and "Yes, continue" waiting only for the sound check (speak once or 8 s).
5. Refusal: in a fresh tab block the camera in the site settings, reload: "Kamera izni kapalı", the permission drawing in place of the picture, the browser's step and "Sayfayı yenile ya da Tekrar dene'ye bas." numbered, "Hâlâ olmuyor mu?" opens the macOS/Windows paragraph and "Sorun bildir". Send the report: only that row says "Bildirimin kaydedildi..." (per-row state).
6. Keyboard only through steps 1-3: Tab reaches each control, focus is visible, focus lands on the new title only when the pressed control went away.
7. Record in the report, verbatim: "Gerçek kamera, mikrofon, sessiz mikrofon, Safari 'interrupted', TikTok/Snapchat uygulama içi tarayıcı: doğrulanmadı, gerçek cihazda kullanıcıyla." (memory note: the automation tab cannot prove a real device).

- [ ] **Step 6: Commit**

```bash
git add src/components/hiring/candidate/device-check.tsx src/components/hiring/candidate/device-steps.ts src/components/hiring/candidate/device-steps.test.ts src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json src/i18n/hiring-candidate-copy.test.ts
git commit -m "Redraw the device check as three sub-steps around the camera picture

Turn on, test, 'can you see and hear yourself?': the filled button is
always that step's action and goes on only where the plan 2 rows say
nothing blocks. The picture fills the right region; a refusal shows the
permission drawing, the browser's step and the computer's settings behind
'Hâlâ olmuyor mu?'. Reports keep their own state per row, Safari's
interrupted context is waited for, a browser without a sound context is
not told it was unheard, and a language switch keeps the played test.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 9: V5, the warm-up and the video and audio questions (ring timers, picture on the right, notes behind a row) and the Task 14 carries

**Files:**
- Modify: `src/components/hiring/candidate/take.ts:134-143` (a take the server gave back stops listening), `:146-178` (+ `afterExhausted`)
- Modify: `src/components/hiring/candidate/take.test.ts` (two tests)
- Modify: `src/components/hiring/candidate/activity-header.tsx:14-49` (the kicker as a chip with an icon; the question 24/34; `large` removed)
- Modify (render rewritten, take logic kept): `src/components/hiring/candidate/recorded-activity.tsx:30-59` (props), `:70-101` (state), `:156-261` (settle and begin: the exhausted case), `:383-630` (render)
- Modify: `src/components/hiring/candidate/practice.tsx:19-71`
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringMedia`)

**Shared with the exam:** none (`src/lib/client/recorder.ts` is not touched; `practice.test.ts` keeps proving that `practice.tsx`, `local-sink.ts`, `recorded-activity.tsx` and `take.ts` never reach the network).

**Interfaces:**
- Consumes: `MediaStage`, `TimerRing`, `Disclosure`, `StepFooter`, `FooterAction`, `lastSeconds` (Task 4); `useJourney` (Task 5).
- Produces:
  - `take.ts`: `afterExhausted(input: { lastRef: string | null }): { phase: "review"; ref: string } | { phase: "failed" }`
  - `ActivityHeader(props: { activity: Pick<CandidateActivity, "id" | "prompt" | "note">; locale: Locale; kicker: string; icon?: LucideIcon; headingRef: Ref<HTMLHeadingElement> })`
  - `RecordedProps` changes: `reviewPrimary?: FooterAction` (was `React.ReactNode`); new `footerBack?: { label: string; href: string } | null`, `journey?: { steps: number; current: number; label: string } | null`.

- [ ] **Step 1: Failing tests (take)**

Add to `src/components/hiring/candidate/take.test.ts` (import `afterExhausted` with the others):

```ts
  it("stops listening for the page going away once the server gave the take back (NO_PARTS): nothing is left to keep (Task 14 carry)", async () => {
    const { sink, opened } = fakeSink(async () => Promise.reject(Object.assign(new Error("no parts"), { code: "NO_PARTS", status: 409 })));
    let handler: (() => void) | null = null;
    const unwatch = vi.fn(() => {
      handler = null;
    });
    const rec = new FakeRecorder();
    const take = await Take.begin({
      sink,
      mime: "video/webm",
      makeRecorder: () => rec,
      chunkMs: 5000,
      watchPageHide: (h) => {
        handler = h;
        return unwatch;
      },
    });
    take.stop();
    await expect(take.outcome).resolves.toMatchObject({ ok: false });
    expect(unwatch).toHaveBeenCalledTimes(1);
    expect(handler).toBeNull();
    expect(opened.abandon).not.toHaveBeenCalled();
  });

  it("after the last take was used up, 'Bu cevabı kullan' shows the take it will use, when this screen knows it (Task 14 carry)", () => {
    expect(afterExhausted({ lastRef: "take-2" })).toEqual({ phase: "review", ref: "take-2" });
    expect(afterExhausted({ lastRef: null })).toEqual({ phase: "failed" });
  });
```

Run: `pnpm exec vitest run src/components/hiring/candidate/take.test.ts`
Expected: FAIL (`unwatch` not called; `afterExhausted` missing).

- [ ] **Step 2: `take.ts`**

Replace `finish()` (`:134-143`) with:

```ts
  private finish(): Promise<TakeOutcome> {
    return this.opened.finish(this.durationMs ?? 0).then(
      (result): TakeOutcome => {
        this.settled = true;
        this.stopWatching();
        return { ok: true, result };
      },
      (error: unknown): TakeOutcome => {
        // Task 14 carry: a take the server gave back (NO_PARTS) has nothing left to keep on page hide.
        if (finishFailure(error) === "givenBack") {
          this.settled = true;
          this.stopWatching();
        }
        return { ok: false, error };
      },
    );
  }
```

and append:

```ts
/**
 * Task 14 carry: no take is left (TAKES_EXHAUSTED). When this screen knows the
 * newest take (it finished here, or the page opened on it), "Bu cevabı kullan"
 * shows that take; otherwise it says the last saved take is used.
 */
export function afterExhausted(input: { lastRef: string | null }): { phase: "review"; ref: string } | { phase: "failed" } {
  return input.lastRef ? { phase: "review", ref: input.lastRef } : { phase: "failed" };
}
```

`finishFailure` is defined below in the same file; a function declaration is hoisted, so the call inside the class is fine. `retry()` returns early when `settled`, so a given-back take is never finished again.

Run: `pnpm exec vitest run src/components/hiring/candidate/take.test.ts`
Expected: PASS.

- [ ] **Step 3: Copy (`hiringMedia`)**

Changed values (not pinned; the design's words, 3.8):

| Key | TR | EN |
|---|---|---|
| `start` | Kaydı başlat | Start recording |
| `useWriting` | Yazarak cevaplamam gerekiyor | I need to answer in writing |
| `useWritingAudio` | Yazarak cevaplamam gerekiyor | I need to answer in writing |

New keys:

| Key | TR | EN |
|---|---|---|
| `cameraLater` | Kamera, sen başlatınca açılır. | The camera opens when you start. |
| `micLater` | Mikrofon, sen başlatınca açılır. | The microphone opens when you start. |
| `notesShort` | Not al | Take notes |
| `thinkCaption` | düşünme | to think |
| `answerCaption` | kaldı | left |
| `lastSeconds` | Son saniyeler | Last seconds |
| `ringThink` | Düşünme süren {time} | Thinking time {time} |
| `ringAnswer` | Kalan cevap süresi {time} | Answer time left {time} |
| `useLastTake` | Kullanılacak cevap bu son çekimin. | This last take is the answer that will be used. |
| `exhaustedUse` | Kaydettiğin son çekim cevabın olarak kullanılır. | Your last saved take is used as your answer. |

`hiringPractice.badge` becomes "Isınma · kimse görmez" / "Warm-up · nobody sees it" (3.4).

- [ ] **Step 4: `ActivityHeader`**

Replace `ActivityHeader` (`activity-header.tsx:14-49`) with:

```tsx
/**
 * HIRING-UX 6.6-6.9, HIRING-VISUAL-FLOW 3.6: the kind of question as a small
 * chip with its icon, then the question as the screen's heading (24/34; it
 * takes focus when the question opens), then the team's note.
 */
export function ActivityHeader({
  activity,
  locale,
  kicker,
  icon: Icon,
  headingRef,
}: {
  activity: Pick<CandidateActivity, "id" | "prompt" | "note">;
  locale: Locale;
  kicker: string;
  icon?: LucideIcon;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="space-y-3">
      <p className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[14px] text-ink">
        {Icon ? <Icon className="size-4 text-muted" strokeWidth={1.75} aria-hidden /> : null}
        {kicker}
      </p>
      <h2 ref={headingRef} tabIndex={-1} id={`prompt-${activity.id}`} className="text-[24px] leading-[34px] font-medium whitespace-pre-line text-ink outline-none">
        <VersionText value={activity.prompt} locale={locale} />
      </h2>
      {pickTextLang(activity.note, locale).text ? (
        <p className="text-[16px] leading-[26px] whitespace-pre-line text-ink-2">
          <VersionText value={activity.note} locale={locale} />
        </p>
      ) : null}
    </div>
  );
}
```

Add `import type { LucideIcon } from "lucide-react";` and drop the now unused `cn` import.

- [ ] **Step 5: `RecordedActivity`**

Props (`:30-59`): replace the `reviewPrimary` line with

```ts
  /** The warm-up's filled button on the review ("Hazırım, değerlendirmeye başla"), next to "Tekrar çek". */
  reviewPrimary?: FooterAction;
  /** The warm-up's way out on the left of the footer ("Isınmayı atla"), and its journey. */
  footerBack?: { label: string; href: string } | null;
  journey?: { steps: number; current: number; label: string } | null;
  /** The chip above the question; the warm-up says "Isınma · kimse görmez", answers name the kind of question. */
  kicker?: string;
```

and add the imports:

```ts
import { Camera, Check, Mic, NotebookPen, Video } from "lucide-react";
import { Disclosure } from "@/components/visual/disclosure";
import type { FooterAction } from "@/components/visual/footer-action";
import { MediaStage } from "@/components/visual/media-stage";
import { lastSeconds } from "@/components/visual/ring";
import { StepFooter } from "@/components/visual/step-footer";
import { TimerRing } from "@/components/visual/timer-ring";
```

(remove `ActionBar`, `Button`, `DisabledReason` imports; `afterExhausted` joins the `./take` import).

State (`:70-101`): after `const [opening, setOpening] = useState(false);` add

```ts
  const [exhausted, setExhausted] = useState(false);
  const [level, setLevel] = useState(0);
  // The newest take this screen knows: the one the page opened on, or the last one finished here (Task 14 carry).
  const lastRef = useRef<string | null>(props.existingRef);
```

In `settle` (`:157-196`), in the `outcome.ok` branch after `take.current = null;` add `lastRef.current = outcome.result.ref ?? lastRef.current;`.

In `begin`'s `catch` (`:249-257`), replace the body with:

```ts
    } catch (err) {
      const why = startFailure(err);
      // No takes left on the server: none is offered here either (the "Tekrar dene" would only be refused again).
      usedRef.current = usedAfterStartFailure(err, usedRef.current, activity.maxTakes);
      setUsed(usedRef.current);
      setCanRetryFinish(false);
      closeStream();
      if (why === "noTakes") {
        // Task 14 carry: "Bu cevabı kullan" shows which take it uses, when this screen knows it.
        const next = afterExhausted({ lastRef: lastRef.current });
        setExhausted(true);
        if (next.phase === "review") {
          setNote(null);
          setPhase("review");
          void loadPlayback({ status: "READY", ref: next.ref });
          return;
        }
        setNote(t("noTakes"));
        setPhase("failed");
        return;
      }
      setNote(why === "server" ? (serverMessage(err) ?? t("failed")) : t("failed"));
      setPhase("failed");
    } finally {
```

Add the audio level while an audio answer records (3.8: real data, never decoration), after the self-view effect (`:330-337`):

```ts
  // 3.8: an audio answer shows the real level of the microphone it records (no animation of its own).
  useEffect(() => {
    if (phase !== "record" || !audioOnly || !stream.current) return;
    let ctx: AudioContext | null = null;
    let id: number | null = null;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream.current).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      id = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
        setLevel(Math.round(peak * 20) / 20);
      }, 100);
    } catch {
      // No level in this browser: the "Sesin kaydediliyor" line still says it records.
    }
    return () => {
      if (id !== null) window.clearInterval(id);
      void ctx?.close().catch(() => undefined);
      setLevel(0);
    };
  }, [phase, audioOnly]);
```

(`practice.test.ts` stays green: no fetch, no API import here.)

Replace the render (`:383-630`, from `if (writing && alternative)` to the end) with:

```tsx
  const footer = (props2: { primary?: FooterAction | null; secondary?: FooterAction | null; back?: { label: string; onClick?: () => void; href?: string } | null }) =>
    hidePrimary ? null : <StepFooter journey={props.journey ?? null} back={props2.back ?? (props.footerBack ?? null)} primary={props2.primary ?? null} secondary={props2.secondary ?? null} />;

  if (writing && alternative) {
    return (
      <div className="mx-auto max-w-[760px] space-y-4 pt-8">
        {alternative.node}
        <p className="text-[14px] leading-[22px] text-muted">{t("writingNote")}</p>
        {footer({
          back: {
            label: t("tryRecording"),
            onClick: () => {
              setWriting(false);
              alternative.onChoose(false);
            },
          },
          primary: {
            kind: "button",
            id: "send-written",
            label: t("sendWritten"),
            busy: disabled && alternative.ready,
            busyLabel: t("saving"),
            waitReason: !alternative.ready ? t("writtenRequired") : null,
            onClick: alternative.send,
          },
        })}
      </div>
    );
  }

  const takesLine = unlimited ? null : activity.maxTakes === 1 ? t("singleTake") : t("takesLeft", { count: left });
  const startWhy = timeUp ? t("timeUpReason") : null;
  const retakeOpen = (unlimited || activity.maxTakes > 1) && !timeUp && left > 0 && !exhausted;
  const reviewTitle = audioOnly ? t("reviewTitleAudio") : t("reviewTitle");
  const useAction: FooterAction = { kind: "button", id: "record-use", label: t("use"), busy: disabled && !timeUp, busyLabel: t("saving"), onClick: () => latest.current.onUse?.() };
  const announce =
    phase === "record"
      ? progress.stalled && mode === "answer"
        ? t("uploadStalled")
        : audioOnly
          ? t("recordingAudio")
          : t("recording")
      : phase === "saving"
        ? t("saving")
        : phase === "review"
          ? reviewTitle
          : phase === "saved"
            ? t("saved")
            : "";
  const ringLabel = (key: "ringThink" | "ringAnswer", ms: number) => t(key, { time: formatCountdown(ms) });

  const question = (
    <>
      <ActivityHeader
        activity={activity}
        locale={locale}
        kicker={`${props.kicker ?? (audioOnly ? t("audioKicker") : t("videoKicker"))}${takesLine ? ` · ${takesLine}` : ""}`}
        icon={audioOnly ? Mic : Video}
        headingRef={headingRef}
      />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      {phase === "think" && activity.thinkSeconds > 0 ? (
        <div className="flex items-center gap-5">
          <TimerRing
            remainingMs={thinkLeft}
            totalMs={activity.thinkSeconds * 1000}
            label={ringLabel("ringThink", thinkLeft)}
            caption={lastSeconds(thinkLeft) ? t("lastSeconds") : t("thinkCaption")}
          />
          <p className="text-[16px] leading-[26px] text-ink-2">
            {thinkLeft === 0 && activity.flexibleThink ? t("thinkOverFlexible") : !activity.flexibleThink ? t("thinkStrictNote") : t("thinkLabel")}
          </p>
        </div>
      ) : null}
      {phase === "record" || phase === "saving" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-5">
            <TimerRing remainingMs={recordLeft} totalMs={answerMs} label={ringLabel("ringAnswer", recordLeft)} caption={lastSeconds(recordLeft) ? t("lastSeconds") : t("answerCaption")} />
            <p className="text-[16px] leading-[26px] text-ink-2">{mode === "answer" ? t("autoStop") : t("autoStopPractice")}</p>
          </div>
          {mode === "answer" ? (
            <div>
              <div className="h-1 rounded-full bg-hairline" aria-hidden>
                <div className="h-1 rounded-full bg-ink-3 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
              </div>
              {/* 3.8: the upload says something only when it is slow. */}
              {progress.stalled ? <p className="mt-1 text-[14px] text-ink">{t("uploadStalled")}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {phase === "review" ? (
        <div className="space-y-2">
          <h3 className="text-[18px] font-semibold text-ink">{reviewTitle}</h3>
          {exhausted ? <p className="text-[16px] text-ink">{t("useLastTake")}</p> : null}
          {incomplete ? <p className="text-[16px] text-ink">{t("incomplete")}</p> : null}
          {!retakeOpen && takesLine && !unlimited ? <p className="text-[14px] text-muted">{timeUp ? t("timeUpReason") : t("takesLeft", { count: 0 })}</p> : null}
        </div>
      ) : null}
      {phase === "saved" ? (
        <div className="space-y-2">
          <p role="status" className="flex items-center gap-2 text-[18px] font-medium text-ink">
            <Check className="size-5" strokeWidth={2} aria-hidden />
            {t("saved")}
          </p>
          {incomplete ? <p className="text-[16px] text-ink">{t("incomplete")}</p> : null}
        </div>
      ) : null}
      {phase === "failed" ? (
        <div className="space-y-2">
          <p role="alert" className="text-[16px] text-ink">
            {note ?? t("failed")}
          </p>
          {exhausted ? <p className="text-[16px] text-ink-2">{t("exhaustedUse")}</p> : null}
        </div>
      ) : null}
      {phase === "think" ? (
        <Disclosure label={t("notesShort")} icon={NotebookPen}>
          <label className="block">
            <span className="sr-only">{t("notes")}</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="text-[16px] md:text-[16px]" />
            <span className="mt-1 block text-[14px] text-muted">{t("notesHint")}</span>
          </label>
        </Disclosure>
      ) : null}
      {mode === "answer" && alternative && (phase === "think" || (phase === "failed" && !canRetryFinish)) ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setWriting(true);
            alternative.onChoose(true);
          }}
          className="block min-h-11 text-left text-[16px] text-ink underline decoration-underline underline-offset-4 disabled:opacity-60"
        >
          {audioOnly ? t("useWritingAudio") : t("useWriting")}
        </button>
      ) : null}
    </>
  );

  const placeholder = (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-[14px] text-muted">
      {audioOnly ? <Mic className="size-8" strokeWidth={1.5} aria-hidden /> : <Camera className="size-8" strokeWidth={1.5} aria-hidden />}
      {audioOnly ? t("micLater") : t("cameraLater")}
    </span>
  );
  const preview =
    phase === "record" || phase === "saving" ? (
      audioOnly ? (
        <span className="absolute inset-0 flex items-end justify-center gap-2 pb-[30%]" aria-hidden>
          {[0.6, 0.85, 1, 0.85, 0.6].map((k, i) => (
            <span key={i} className="w-3 rounded-full bg-ink-3" style={{ height: `${Math.max(8, Math.round(level * k * 160))}px` }} />
          ))}
        </span>
      ) : (
        <>
          <video ref={self} muted playsInline className="size-full object-cover" />
          <span className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1 text-[13px] text-ink">
            <span className="size-2.5 rounded-full bg-ink motion-safe:animate-[rec-pulse_1.6s_ease-in-out_infinite]" aria-hidden />
            {phase === "saving" ? t("saving") : t("recording")}
          </span>
        </>
      )
    ) : phase === "review" && src ? (
      audioOnly ? (
        <span className="absolute inset-0 flex items-center px-6">
          <audio controls src={src} className="w-full" />
        </span>
      ) : (
        <video controls playsInline src={src} className="size-full bg-canvas object-cover" />
      )
    ) : phase === "review" && playbackWaiting ? (
      <span role="status" className="absolute inset-0 grid place-items-center px-6 text-center text-[16px] text-ink-2">
        {t("savingPlayback")}
      </span>
    ) : (
      placeholder
    );

  const primary: FooterAction | null =
    phase === "think"
      ? { kind: "button", id: "record-start", label: t("start"), busy: opening || (disabled && !timeUp), busyLabel: opening ? (audioOnly ? t("startingMic") : t("starting")) : t("saving"), waitReason: startWhy, onClick: () => void begin() }
      : phase === "record" || phase === "saving"
        ? { kind: "button", id: "record-finish", label: t("finish"), busy: phase === "saving", busyLabel: t("saving"), onClick: stopTake }
        : phase === "review"
          ? mode === "answer"
            ? useAction
            : (props.reviewPrimary ?? null)
          : phase === "saved"
            ? mode === "answer"
              ? useAction
              : null
            : canTryAgain({ canRetryFinish, maxTakes: activity.maxTakes, used }) && !exhausted
              ? { kind: "button", id: "record-again", label: t("tryAgain"), waitReason: !canRetryFinish && timeUp ? t("timeUpReason") : null, busy: disabled && !timeUp, busyLabel: t("saving"), onClick: tryAgain }
              : mode === "answer"
                ? useAction
                : null;
  const secondary: FooterAction | null =
    phase === "review" && retakeOpen ? { kind: "button", id: "record-retake", label: unlimited ? t("retakeFree") : t("retake", { count: left }), onClick: retake } : null;

  return (
    <>
      <MediaStage question={question} preview={preview} />
      {footer({ primary, secondary })}
    </>
  );
}
```

Notes for the implementer:
- `formatCountdown` is already imported (`:8`). `Textarea` stays imported.
- The written-alternative path and the `hidePrimary` case keep plan 2's rules: when the runner shows its own filled button (`hidePrimary`, a retry or a closed question) this screen draws no footer at all, so two fixed bars never stack.
- The "Kayıtta" dot stays ink with the 1.6 s pulse only under `motion-safe` (HIRING-UX 8.5).

- [ ] **Step 6: The warm-up**

Replace the body of `Practice` (`practice.tsx:19-71`) with:

```tsx
export function Practice({ token, camera, locale }: { token: string; camera: boolean; locale: Locale }) {
  const t = useT("hiringPractice");
  const sink = useMemo(() => localSink(), []);
  useEffect(() => () => sink.release(), [sink]);
  const heading = useStepFocus<HTMLHeadingElement>("practice");
  const [phase, setPhase] = useState<RecordedPhase>("think");
  const journey = useJourney("warmup", { device: true, warmup: true });
  const prompt = t("prompt");
  const next = `/a/${encodeURIComponent(token)}/stage/1`;
  const busy = phase === "record" || phase === "saving";
  return (
    <div className="pt-8">
      <p className="text-[16px] leading-[26px] text-ink-2">{t("why")}</p>
      <RecordedActivity
        mode="practice"
        activity={{
          id: "practice",
          type: camera ? "VIDEO" : "AUDIO",
          prompt: { tr: prompt, en: prompt },
          note: { tr: "", en: "" },
          thinkSeconds: 15,
          flexibleThink: true,
          answerSeconds: 30,
          maxTakes: Number.POSITIVE_INFINITY,
          textAlternativeEnabled: false,
        }}
        locale={locale}
        headingRef={heading}
        sink={sink}
        takesUsed={0}
        existingRef={null}
        playbackSrc={async (result) => result.localUrl ?? null}
        onPhase={setPhase}
        timeUp={false}
        disabled={false}
        journey={journey}
        // "Isınmayı atla" waits while a take records (the take must stop first: leaving drops it).
        footerBack={busy || phase === "review" ? null : { label: t("skip"), href: next }}
        reviewPrimary={{ kind: "link", id: "practice-ready", label: t("ready"), href: next }}
        kicker={t("badge")}
      />
    </div>
  );
}
```

Keep the imports it uses (`useEffect, useMemo, useState`, `useStepFocus`, `useT`, `Locale`, `localSink`, `RecordedActivity`, `RecordedPhase`) and add `import { useJourney } from "./use-journey";`; drop `Link` and `Button`. The chip "Isınma · kimse görmez" is the warm-up's `kicker`; the warm-up has unlimited takes, so no takes line follows it.

The stage runner's call (`stage-runner.tsx:383-412`) needs no change: it passes no `reviewPrimary`, `footerBack`, `journey` or `kicker`.

- [ ] **Step 7: Run tests and gates**

Run: `pnpm exec vitest run src/components/hiring/candidate src/i18n && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4`
Expected: PASS (take +2; `practice.test.ts` green: no network in the four files); clean.

- [ ] **Step 8: Browser check**

`kademe_ui_check`, full fixture, dev server 3100.
1. Warm-up at 1440: the chip "Isınma · kimse görmez", "Bugün nasıl geçti, kısaca anlat." 24/34, the ring with 0:15 and "düşünme", the right region a grey box with the camera icon and "Kamera, sen başlatınca açılır."; "Not al" closed; footer "Isınma · Adım 3 / 4", "Isınmayı atla" on the left, one filled "Kaydı başlat". The ring shortens once a second (two screenshots one second apart); `prefers-reduced-motion` (Chrome rendering emulation is not available in the extension: check that `transition` is `none` on the ring through `javascript_tool`, `getComputedStyle(document.querySelector('[role=img] circle:last-child')).transition`).
2. Start: the picture fills the right region with "Kayıtta"; the ring counts the answer with "kaldı"; "Cevabı bitir" is the one filled button; at 0:10 the caption reads "Son saniyeler", nothing turns red.
3. Review: the take plays on the right; "Hazırım, değerlendirmeye başla" filled (a link), "Tekrar çek" outline.
4. A stage video question (full fixture): same layout; the upload line moves under the ring, text only if stalled; "Bu cevabı kullan" after the take; with `maxTakes` 1 the review is skipped ("Kaydedildi.") and the next question opens after a second.
5. Task 14 exhausted case: on a 2-take question record twice (both takes used); reload: the page opens on the newest take's review (plan 2 behaviour, `existingRef`). TAKES_EXHAUSTED on a start needs a start refused by the server, which a single tab does not produce on its own; if it cannot be reached, write "tarayıcıda üretilemedi; `afterExhausted` birim testiyle kapsandı" in the report instead of a claim.
6. Audio question: the level bars move with the voice while recording (real microphone: "doğrulanmadı, gerçek cihazda" if the tab has none).
7. 1280 and 1024 screenshots of think, record, review.

- [ ] **Step 9: Commit**

```bash
git add src/components/hiring/candidate/take.ts src/components/hiring/candidate/take.test.ts src/components/hiring/candidate/activity-header.tsx src/components/hiring/candidate/recorded-activity.tsx src/components/hiring/candidate/practice.tsx src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Lay out the warm-up and recorded answers around the picture and a ring

Question and ring timer on the left, the candidate's picture (or its
place) on the right, notes behind a row, one filled button in the footer
per phase. A take the server gave back stops listening for page hide, and
after the last take is used up the screen shows the take that will be the
answer when it knows it (Task 14 carries).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 10: V6 part 1, stage intro, the runner's header and footer, written and choice questions, the pale-button fix and the Task 13 residuals

**Files:**
- Modify: `src/components/hiring/candidate/runner-steps.ts:30-48` (`closeQuestion` reports the commit before the submit), `runner-steps.test.ts`
- Modify: `src/components/hiring/candidate/draft-store.ts:18-19` (`Draft.older`), `:37-49` (read), `:71-89` (restore, send, saved), `draft-store.test.ts`
- Modify (rewrite): `src/components/hiring/candidate/stage-intro.tsx:1-111`
- Modify: `src/components/hiring/candidate/stage-runner.tsx:1-27` (imports), `:242-288` (`advance` uses `onCommitted`), `:290-347` (second tab and resume), `:428-544` (header, body, footer)
- Modify: `src/components/hiring/candidate/submit-delay.tsx:46` (above the footer)
- Modify: `src/components/hiring/candidate/text-activity.tsx:30-46` (`Saved`), `:130-161` (layout)
- Modify (render): `src/components/hiring/candidate/choice-activity.tsx:52-91`
- Modify: `src/components/hiring/candidate/help.tsx` (the FAQ list gains "Keep")
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringStage`, `hiringChoice`, `hiringFrame`)

**Shared with the exam:** none.

**Interfaces:**
- Consumes: `StepScreen`, `StepFooter` (with `hint`), `FactTiles`, `IconRow`, `QuestionProgress`, `ChoiceCardGroup`, `choiceLetter`, `choiceShortcut`, `StatusScreen`, `FooterAction` (Task 4); `useWindowWidth`, `startWaitsForWidth` (Tasks 1-2); `ActivityHeader` with `icon` (Task 9).
- Produces:
  - `closeQuestion(input: { last: boolean; skipCommit: boolean; commit(): Promise<HiringCandidateState>; submit(): Promise<void>; onCommitted?(next: HiringCandidateState): void }): Promise<CloseResult>` (`onCommitted` runs after a commit that landed, before the stage submit)
  - `type Draft = { text: string; base: string; pending?: string; older?: string[] }` (`older`: up to two earlier sent-but-unconfirmed texts)

- [ ] **Step 1: Reproduce the pale button before changing anything (STATUS item 23)**

On `kademe_ui_check` with the full fixture (`pnpm dev:hiring-link`), dev server 3100, reach stage 1's video question, record one take, press "Bu cevabı kullan". Right after, run in the page through `javascript_tool`:

```js
(() => { const log = []; const t0 = performance.now(); const id = setInterval(() => { const b = document.getElementById("activity-next") || document.getElementById("record-use"); const why = b && document.getElementById(b.id + "-why"); log.push([Math.round(performance.now() - t0), b?.id, b?.disabled, b?.textContent, !!why]); }, 100); setTimeout(() => { clearInterval(id); window.__pale = log; }, 3000); })()
```

then read `window.__pale`. Write into the report every sample where `disabled` is true and the reason element is missing, with the button's label (this is the "soluk, nedensiz" moment). After Step 8 the same script must show no sample with `disabled === true` and no reason: a working button is `aria-disabled` and filled, a waiting one has its `-why`.

- [ ] **Step 2: Failing tests (runner steps, drafts)**

Add to `src/components/hiring/candidate/runner-steps.test.ts`:

```ts
  it("hands the runner the commit's state before the stage submit, so a failed submit leaves the closed question closed (Task 13 residual)", async () => {
    const order: string[] = [];
    const committed = { step: "STAGE", current: { responses: [{ activityId: "q3", closed: true }] } } as never;
    await expect(
      closeQuestion({
        last: true,
        skipCommit: false,
        commit: async () => {
          order.push("commit");
          return committed;
        },
        onCommitted: (next) => {
          order.push("committed");
          expect(next).toBe(committed);
        },
        submit: async () => {
          order.push("submit");
          throw Object.assign(new Error("down"), { status: 503 });
        },
      }),
    ).rejects.toThrow("down");
    expect(order).toEqual(["commit", "committed", "submit"]);
  });
```

Add to `src/components/hiring/candidate/draft-store.test.ts`:

```ts
describe("an older save that lands after a newer one (Task 13 residual, plan decision 15)", () => {
  it("keeps the two earlier sent texts, so a reload still restores the tab's newest typing over either", () => {
    let copy = { text: "A", base: "" } as Draft;
    copy = draftAfterSend(copy, "A");
    copy = draftAfterSend({ ...copy, text: "AB" }, "AB");
    copy = { ...copy, text: "ABC" };
    expect(copy).toMatchObject({ pending: "AB", older: ["A"] });
    // The server's last write was the older "A" (it landed after "AB").
    expect(restoreText("A", copy)).toEqual({ text: "ABC", restored: true, drop: false });
    // Another device's text still wins.
    expect(restoreText("X", copy)).toEqual({ text: "X", restored: false, drop: true });
  });

  it("keeps at most two older texts and reads them back from storage", () => {
    let copy = { text: "", base: "" } as Draft;
    for (const sent of ["1", "12", "123", "1234"]) copy = draftAfterSend({ ...copy, text: sent }, sent);
    expect(copy.older).toEqual(["123", "12"]);
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    writeDraft(storage, "k", copy);
    expect(readDraft(storage, "k")).toEqual(copy);
  });
});
```

(import `draftAfterSend`, `restoreText`, `readDraft`, `writeDraft`, `type Draft` if the file does not already.)

Run: `pnpm exec vitest run src/components/hiring/candidate/runner-steps.test.ts src/components/hiring/candidate/draft-store.test.ts`
Expected: FAIL (`onCommitted` never called; `older` undefined).

- [ ] **Step 3: `closeQuestion` and the drafts**

`runner-steps.ts:30-48`:

```ts
export async function closeQuestion(input: {
  last: boolean;
  skipCommit: boolean;
  commit: () => Promise<HiringCandidateState>;
  submit: () => Promise<void>;
  /** Task 13 residual: the runner takes the committed state before the stage submit, so a failed submit shows the question closed. */
  onCommitted?: (next: HiringCandidateState) => void;
}): Promise<CloseResult> {
  // Fix round 2: only the last question's close may lead to the stage submit.
  if (input.skipCommit && !input.last) return { kind: "skipped" };
  if (!input.skipCommit) {
    try {
      const next = await input.commit();
      if (!input.last) return { kind: "advanced", next };
      input.onCommitted?.(next);
    } catch (err) {
      if (!(input.last && codeOf(err) === "ACTIVITY_CLOSED")) throw err;
    }
  }
  await input.submit();
  return { kind: "finished" };
}
```

`draft-store.ts`: the type becomes

```ts
/**
 * `pending`: a text whose save left but had no answer yet (fix round 2): the server may hold it already.
 * `older`: up to two earlier such texts (Task 13 residual): an older save can land after a newer one.
 */
export type Draft = { text: string; base: string; pending?: string; older?: string[] };
```

`readDraft` (`:37-49`) returns `older` when it is an array of strings:

```ts
    const { text, base, pending, older } = value as { text?: unknown; base?: unknown; pending?: unknown; older?: unknown };
    if (typeof text !== "string" || typeof base !== "string") return null;
    const draft: Draft = { text, base };
    if (typeof pending === "string") draft.pending = pending;
    if (Array.isArray(older) && older.every((o) => typeof o === "string") && older.length) draft.older = older.slice(0, 2);
    return draft;
```

`restoreText`, `draftAfterSend`, `draftAfterSaved` (`:71-89`):

```ts
export function restoreText(server: string, draft: Draft | null): { text: string; restored: boolean; drop: boolean } {
  if (!draft || draft.text === server) return { text: server, restored: false, drop: false };
  if (draft.base === server || draft.pending === server || draft.older?.includes(server)) return { text: draft.text, restored: true, drop: false };
  return { text: server, restored: false, drop: true };
}

/** A save of `sent` left for the server; the text sent before it is kept (two at most). */
export function draftAfterSend(draft: Draft, sent: string): Draft {
  const older = [draft.pending, ...(draft.older ?? [])].filter((o): o is string => typeof o === "string" && o !== sent).slice(0, 2);
  return older.length ? { ...draft, pending: sent, older } : { ...draft, pending: sent };
}

/** The server accepted `saved`: it is the new base; the copy is gone when nothing is left unsaved. */
export function draftAfterSaved(draft: Draft, saved: string): Draft | null {
  const pending = draft.pending === saved ? undefined : draft.pending;
  const older = draft.older?.filter((o) => o !== saved);
  if (pending === undefined && draft.text === saved) return null;
  const next: Draft = { text: draft.text, base: saved };
  if (pending !== undefined) next.pending = pending;
  if (older?.length) next.older = older;
  return next;
}
```

If an existing `draft-store.test.ts` expectation pins the old exact object after two sends in a row, it now also carries `older`: update that expectation and name it in the commit body ("draft-store: <title> now also expects older").

Run: `pnpm exec vitest run src/components/hiring/candidate/runner-steps.test.ts src/components/hiring/candidate/draft-store.test.ts`
Expected: PASS.

- [ ] **Step 4: Copy**

`hiringStage` new keys:

| Key | TR | EN |
|---|---|---|
| `factMinutes` | {minutes} dk | {minutes} min |
| `factMinutesLabel` | süre | time |
| `factQuestions` | {count, plural, one {# soru} other {# soru}} | {count, plural, one {# question} other {# questions}} |
| `factQuestionsLabel` | bu aşamada | in this stage |
| `factTakes` | {count, plural, one {# tekrar} other {# tekrar}} | {count, plural, one {# retake} other {# retakes}} |
| `factTakesLabel` | her cevapta | per answer |
| `requiredChoice` | Bir seçenek seç. | Pick an option. |
| `requiredText` | Önce cevabını yaz. | Write your answer first. |

`hiringChoice`: `single` becomes "Tek seçim" (unchanged), new `marker` "Seçenek {letter}" / "Option {letter}" (screen-reader prefix of a card). `hiringFrame` new `faqKeepQ` "Yazdıklarım kaybolur mu?" / "Will I lose what I write?", `faqKeepA` "Hayır. Yazdıkların kendiliğinden kaydedilir; sekmeyi kapatsan bile kalır." / "No. What you write saves itself and stays even if you close the tab." (3.6: `keeps` moves to Help).

- [ ] **Step 5: Stage intro (3.5)**

Replace `src/components/hiring/candidate/stage-intro.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Clock, CornerUpLeft, Flag, Hourglass, ListChecks, RotateCcw } from "lucide-react";
import { FactTiles } from "@/components/visual/fact-tiles";
import { IconRow } from "@/components/visual/icon-row";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { StageRule } from "@/solutions/hiring/rules/candidate-flow";
import type { CurrentStage } from "@/solutions/hiring/rules/candidate-state";
import { VersionText } from "./activity-header";
import { useWindowWidth } from "./desktop-gate";
import { startWaitsForWidth } from "./device-class";
import { introMinutes } from "./runner-model";

const RULE_ICON: Record<StageRule["kind"], typeof Clock> = {
  think: Hourglass,
  thinkStrict: Hourglass,
  takes: RotateCcw,
  noRetake: RotateCcw,
  noBack: CornerUpLeft,
  back: CornerUpLeft,
  lateAllowed: Clock,
};

/**
 * HIRING-UX 6.5 and 6.10, HIRING-VISUAL-FLOW 3.5: which stage (the company's
 * name for it), its time (the clock's own minutes, grace included: C25), the
 * questions and retakes as tiles, only the rules that apply as icon rows, and
 * "Süre, bastığında başlar." next to the one filled button. Between stages a
 * calm line says how the last one ended. Below 640px an unstarted stage waits
 * (3.0).
 */
export function StageIntro({
  current,
  deadline,
  locale,
  busy,
  error,
  lostPrevious,
  onStart,
  headingRef,
}: {
  current: CurrentStage;
  deadline: string;
  locale: Locale;
  busy: boolean;
  error: React.ReactNode;
  /** The server refused the previous stage's last words after its deadline (Minor 6). */
  lostPrevious: "text" | "choice" | null;
  onStart: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT("hiringStage");
  const tg = useT("hiringGate");
  const narrow = startWaitsForWidth(useWindowWidth());
  // Minor 9: a status that arrives with the page is not read out; it is filled in just after, so it is.
  const [announce, setAnnounce] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setAnnounce(true), 250);
    return () => window.clearTimeout(id);
  }, []);
  const rule = (r: StageRule) => {
    switch (r.kind) {
      case "think":
        return r.seconds !== null ? t("ruleThink", { seconds: r.seconds }) : t("ruleThinkAny");
      case "thinkStrict":
        return r.seconds !== null ? t("ruleThinkStrict", { seconds: r.seconds }) : t("ruleThinkStrictAny");
      case "takes":
        return r.count !== null ? t("ruleTakes", { count: r.count }) : t("ruleTakesAny");
      case "noRetake":
        return t("ruleNoRetake");
      case "noBack":
        return t("ruleNoBack");
      case "back":
        return t("ruleBack");
      case "lateAllowed":
        return t("ruleLate");
    }
  };
  const previousText = current.previous
    ? [
        current.previous.closedByClock ? t("previousTime", { n: current.previous.position }) : t("previousDone", { n: current.previous.position }),
        lostPrevious === "text" ? t("previousLost") : lostPrevious === "choice" ? t("previousLostChoice") : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const takes = current.rules.find((r): r is Extract<StageRule, { kind: "takes" }> => r.kind === "takes");
  const facts = [
    { icon: Clock, value: t("factMinutes", { minutes: introMinutes(current) }), label: t("factMinutesLabel") },
    { icon: ListChecks, value: t("factQuestions", { count: current.stage.activities.length }), label: t("factQuestionsLabel") },
    ...(takes && takes.count !== null ? [{ icon: RotateCcw, value: t("factTakes", { count: takes.count }), label: t("factTakesLabel") }] : []),
  ];
  const description = current.stage.description.tr.trim() || current.stage.description.en.trim();
  return (
    <>
      {current.previous ? (
        <div className="mx-auto max-w-[640px] pt-8">
          <p aria-hidden className="rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[26px] text-ink">
            {previousText}
          </p>
          <p role="status" className="sr-only">
            {announce ? previousText : ""}
          </p>
        </div>
      ) : null}
      <StepScreen
        layout="single"
        width={640}
        kicker={<span className="tnum tracking-[0.06em] uppercase">{t("stageOf", { n: current.position, total: current.total })}</span>}
        title={<VersionText value={current.stage.name} locale={locale} />}
        titleRef={headingRef}
        lead={
          description ? (
            <p className="whitespace-pre-line">
              <VersionText value={current.stage.description} locale={locale} />
            </p>
          ) : undefined
        }
      >
        <div className="space-y-6">
          <FactTiles items={facts} />
          <div className="space-y-4">
            {current.rules.map((r) => (
              <IconRow key={r.kind} icon={RULE_ICON[r.kind]} title={rule(r)} />
            ))}
            {current.last ? <IconRow icon={Flag} title={t("lastStage")} /> : null}
          </div>
          <p className="tnum text-[14px] text-muted">{t("deadline", { date: deadline })}</p>
          {error}
        </div>
      </StepScreen>
      <StepFooter
        hint={t("clockStarts")}
        primary={{ kind: "button", id: "stage-start", label: t("start"), busy, busyLabel: t("starting"), waitReason: narrow ? tg("narrowStart") : null, onClick: onStart }}
      />
    </>
  );
}
```

The stage's own name and description are candidate text from `candidateSafe(state)` (unchanged source); nothing else reaches the intro.

- [ ] **Step 6: The runner**

Imports (`stage-runner.tsx:1-27`): remove `ActionBar` and `DisabledReason` (`Button` stays only if still used; it is not after this step: remove it too); add

```ts
import type { FooterAction } from "@/components/visual/footer-action";
import { QuestionProgress } from "@/components/visual/question-progress";
import { StatusScreen } from "@/components/visual/status-screen";
import { StepFooter } from "@/components/visual/step-footer";
```

In `advance` (`:257-271`) pass the committed state to the runner before the submit:

```ts
        const result = await closeQuestion({
          last,
          skipCommit,
          commit: async () => {
            const answer = answerOf(target, answersRef.current[target.id]);
            const next = await withTimeout(
              apiSend<HiringCandidateState>(token, "/hiring/response/commit", { stagePosition: current.position, activityId: target.id, ...(answer === undefined ? {} : { answer }) }),
              REQUEST_MS,
            );
            clearDraft(sessionDrafts(), draftKey(token, current.position, runId, target.id));
            return next;
          },
          // Task 13 residual: a failed stage submit after this commit shows the question closed (closedHere).
          onCommitted: (next) => setState(next),
          submit: () => submit(false),
        });
```

Replace the second-tab and resume branches (`:290-347`) with:

```tsx
  if (blocked) {
    return (
      <>
        <p role="alert" className="sr-only">
          {t("otherTab")}
        </p>
        <StatusScreen illustration="otherTab" title={t("otherTab")} body={t("otherTabClosed")} />
        <StepFooter primary={{ kind: "button", id: "reload", label: t("reload"), onClick: reloadPage }} />
      </>
    );
  }

  const failureLine = failure ? (
    <p role="alert" className="mx-auto mt-4 max-w-[760px] text-[16px] leading-[26px] text-ink">
      {failure.stale ? t("stale") : failure.message}{" "}
      {failure.stale ? (
        <button type="button" onClick={reloadPage} className="min-h-11 underline decoration-underline underline-offset-4">
          {t("reload")}
        </button>
      ) : null}
    </p>
  ) : null;

  const retrying = !!failure?.retry && !busy;
  /** After a failed stage submit, the filled button sends the submit again (Minor 10: on the resume gate too). */
  const retry = () => {
    if (failure?.retry === "auto") return void submit(true);
    if (failure?.retry === "submit") return void submit(false);
  };

  if (phase === "intro")
    return <StageIntro current={current} deadline={deadline} locale={locale} busy={busy} error={failureLine} lostPrevious={lostPrevious} onStart={start} headingRef={heading} />;

  if (phase === "resume") {
    return (
      <>
        <StatusScreen title={t("resumeTitle")} titleRef={heading} body={<span className="tnum">{t("resumeBody", { time: formatCountdown(clock.remainingMs) })}</span>}>
          {activities.some((a) => a.type === "VIDEO" || a.type === "AUDIO") ? <p>{t("resumeDevices")}</p> : null}
          {timeUp ? (
            <p role="status" className="font-medium text-ink">
              {current.autoSubmit ? t("timeUpSaving") : t("timeUpLate")}
            </p>
          ) : null}
        </StatusScreen>
        {failureLine}
        <StepFooter primary={{ kind: "button", id: "resume", label: retrying ? t("retry") : t("resumeGo"), busy, busyLabel: t("busy"), onClick: retrying ? retry : () => setPhase("question") }} />
      </>
    );
  }
```

Replace the render from `const progress = progressOf(` (`:428`) to the end of the component (`:544`) with:

```tsx
  const progress = progressOf({ stagePosition: current.position, stageCount: current.total, activityIndex: index, activityCount: activities.length });
  const answered = activity ? answeredLocally(activity, answers[activity.id] ?? {}) : true;
  // Task 15: a file still uploading is not the answer yet; the close waits for it (the earlier file stays until then).
  const uploadingHere = !!activity && !!answers[activity.id]?.uploading;
  const key = primaryKey(index, activities.length, current.last);
  const required = activity?.type === "SINGLE_CHOICE" || activity?.type === "MULTI_CHOICE" ? t("requiredChoice") : activity?.type === "LONG_TEXT" || activity?.type === "SHORT_TEXT" ? t("requiredText") : t("requiredReason");
  // C15 and plan decision 4: a waiting button always says why next to it; a working one says so on itself.
  const why = retrying || busy ? null : delayed ? t("sendingReason") : locked ? t("timeUpSaving") : uploadingHere ? tf("waitReason") : activity?.required && !answered ? required : null;
  const lastMinute = isLastMinute(clock.remainingMs);
  const onPrimary = () => (retrying ? retry() : advance());
  const recorded = activity?.type === "VIDEO" || activity?.type === "AUDIO";
  const runnerFooter = !(activity && ownsPrimary(activity.type) && !retrying && !closedHere);
  const primary: FooterAction = { kind: "button", id: "activity-next", label: retrying ? t("retry") : t(key), busy, busyLabel: t("busy"), waitReason: why, onClick: onPrimary };
  const optional = activity && !activity.required && !answered && !busy && !closedHere && !uploadingHere ? t("optionalHint") : null;

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-hairline bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7">
        <div className="mx-auto flex max-w-[1000px] items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="tnum text-[14px] text-muted">
              {t("stageOf", { n: progress.n, total: progress.total })} · {t("questionOf", { n: index + 1, total: activities.length })}
            </p>
            <div className="mt-2 max-w-[520px]">
              <QuestionProgress total={activities.length} current={index + 1} />
            </div>
          </div>
          {current.deadlineAt ? (
            <p className="shrink-0 text-right">
              <span className="block text-[13px] text-muted">{lastMinute ? t("lastMinute") : t("remaining")}</span>
              <span className="tnum block text-[20px] leading-7 font-semibold text-accent">{formatCountdown(clock.remainingMs)}</span>
            </p>
          ) : null}
        </div>
      </div>
      {/* HIRING-UX 8.7: the time is spoken once a minute, never every second. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {current.deadlineAt && clock.remainingMs > 0 ? t("announceMinutes", { count: minutesLeft(clock.remainingMs) }) : ""}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {t("announce", { stage: current.position, stages: current.total, n: index + 1, total: activities.length })}
      </p>

      <div className={recorded ? "pt-4" : "mx-auto max-w-[760px] pt-8"}>
        {online ? null : (
          <p role="status" className="mx-auto mb-4 max-w-[760px] rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[26px] text-ink">
            {/* Minor 4: a written answer has no recording to speak of. */}
            {recorded
              ? t("offline")
              : activity && (activity.type === "SINGLE_CHOICE" || activity.type === "MULTI_CHOICE")
                ? t("offlineChoice")
                : activity?.type === "FILE_UPLOAD"
                  ? // M2: only an upload in flight is "in this tab" and resumes; otherwise the file is chosen once the connection is back.
                    uploadingHere
                    ? tf("offline")
                    : tf("offlineIdle")
                  : t("offlineText")}
          </p>
        )}
        {timeUp ? (
          <p role="status" className="mx-auto mb-4 max-w-[760px] text-[16px] font-medium text-ink">
            {current.autoSubmit ? t("timeUpSaving") : t("timeUpLate")}
          </p>
        ) : null}
        {body}
        {closedHere ? <p className="mx-auto mt-4 max-w-[760px] text-[16px] leading-[26px] text-ink-2">{t("closedQuestion")}</p> : null}
      </div>
      {failureLine}
      {runnerFooter ? (
        <StepFooter
          back={current.backNavigation && index > 0 && !inputsOff && !uploadingHere ? { label: t("previous"), onClick: () => setIndex(index - 1) } : null}
          primary={primary}
          note={optional ? <p className="text-[14px] text-muted">{optional}</p> : null}
        />
      ) : null}
      {delayed ? (
        <SubmitDelay
          onElapsed={() => void delayed()}
          onUndo={() => {
            undone.current = true;
            setDelayed(null);
          }}
        />
      ) : null}
    </div>
  );
}
```

The "Geri al" focus return (`:119-124`) still targets `document.getElementById("activity-next")`: the footer's button keeps that id.

`SubmitDelay` (`submit-delay.tsx:46`): change `bottom-6` to `bottom-[124px]` so the strip floats above the 84px footer and its journey edge.

- [ ] **Step 7: Written questions (3.6)**

`text-activity.tsx`: in `Saved` (`:30-46`) the idle state shows nothing (the reassurance moved to Help), and a saved state has a check:

```tsx
  if (status === "saved" && savedAt) {
    const seconds = Math.max(1, Math.round((now - savedAt) / 1000));
    const words = seconds < 5 ? t("savedNow") : seconds < 60 ? t("savedAgo", { seconds }) : t("savedMinutes", { minutes: Math.floor(seconds / 60) });
    return (
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-4" strokeWidth={2} aria-hidden />
        {words}
      </span>
    );
  }
  return <span />;
```

(`import { Check, PenLine } from "lucide-react";`). In the render (`:130-161`): `ActivityHeader` gets `icon={PenLine}`; the textarea class becomes `min-h-[280px] resize-y rounded-none border-0 bg-surface px-4 py-3 text-[16px] leading-[26px] md:text-[16px]` for `LONG_TEXT` (`short ? "min-h-24 ..." : "min-h-[280px] ..."`), `rows={short ? 3 : 10}` unchanged.

`help.tsx`: the FAQ list `(["Drop", "Camera", "Phone"] as const)` becomes `(["Drop", "Keep", "Camera", "Phone"] as const)`.

- [ ] **Step 8: Choice questions (3.7)**

Replace the render of `ChoiceActivity` (`choice-activity.tsx:52-91`, from `const row =` to the end) with:

```tsx
  return (
    <div className="space-y-5">
      <ActivityHeader activity={activity} locale={locale} kicker={multi ? t("multiKicker") : t("single")} icon={ListChecks} headingRef={headingRef} />
      {multi ? <p className="text-[16px] text-ink-2">{t("multi")}</p> : null}
      <ChoiceCardGroup
        type={multi ? "multi" : "single"}
        name={`choice-${activity.id}`}
        value={chosen}
        onChange={(next) => choose(next)}
        labelledBy={`prompt-${activity.id}`}
        disabled={disabled}
        columns={choices.length > 4 ? 2 : 1}
        items={choices.map((c, i) => ({
          value: c.id,
          marker: choiceLetter(i),
          shortcut: choiceShortcut(i),
          label: (
            <>
              <span className="sr-only">{t("marker", { letter: choiceLetter(i) })}: </span>
              <VersionText value={c.label} locale={locale} />
            </>
          ),
        }))}
      />
    </div>
  );
```

Imports: drop `Checkbox`, `RadioGroup`, `RadioGroupItem`; add `import { ListChecks } from "lucide-react";`, `import { ChoiceCardGroup } from "@/components/visual/choice-card";`, `import { choiceLetter, choiceShortcut } from "@/components/visual/choice-keys";`. `toggle` stays for the keys 1-9 listener; `choose` is called with the card group's next value. The `keys` hint line is gone (3.7: the key shows on the card on desktop).

- [ ] **Step 9: Tests and gates**

Run: `pnpm exec vitest run src/components/hiring/candidate src/i18n src/solutions/hiring && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4`
Expected: PASS; `runner-model.test.ts` (keys 1-9) unchanged and green; clean.

- [ ] **Step 10: Browser check**

`kademe_ui_check`, `pnpm dev:hiring-link --kind written` (text and choice stages) and the full fixture.
1. Stage intro 1440/1280/1024: "AŞAMA 1 / 2" kicker, the stage name 40/48, three tiles, icon rows for the rules, the deadline line; footer "Süre, bastığında başlar." left of one filled "Aşamayı başlat". At 600px it waits with "Pencereni büyüt, sonra başla.".
2. Written question: the chip "Yazılı cevap" with a pen, the question 24/34, a 280px field; typing shows "✓ Kaydedildi"; footer "Sonraki soru" waits with "Önce cevabını yaz." while empty (if required). Help lists "Yazdıklarım kaybolur mu?".
3. Choice: letter cards A, B, C, no radio dots, the key hint "1" on the right of each card at 1280; arrow keys and 1-3 pick; the reason "Bir seçenek seç."; more than four options: two columns.
4. Run the Step 1 script again after a video answer: no sample is `disabled` without its `-why` element; while saving the button reads "Kaydediliyor" on the filled accent with a spinner.
5. Last question of the last stage: "Değerlendirmeyi bitir" then the 8 s strip sits above the footer (not on it), "Geri al" returns focus to the button.
6. Task 13 residual: on a no-back stage, before pressing "Aşamayı bitir" on the last question, make the next stage submit fail once with `javascript_tool`:
   `(() => { const orig = window.fetch; let once = true; window.fetch = (input, init) => { const url = typeof input === "string" ? input : input.url; if (once && url.endsWith("/hiring/stage/submit")) { once = false; return Promise.reject(new TypeError("Failed to fetch")); } return orig(input, init); }; })()`
   Press it: the commit lands, the submit fails; the question now shows "Bu soru kapandı; aşamayı bitirebilirsin." with its field disabled (before this task it stayed editable), and "Tekrar dene" submits the stage.
7. Second tab: open the same stage link in a new tab: the old tab shows the two-window drawing, "Değerlendirmen başka bir sekmede açık. Orada devam et." and "Sayfayı yenile" filled.

- [ ] **Step 11: Commit**

```bash
git add src/components/hiring/candidate/runner-steps.ts src/components/hiring/candidate/runner-steps.test.ts src/components/hiring/candidate/draft-store.ts src/components/hiring/candidate/draft-store.test.ts src/components/hiring/candidate/stage-intro.tsx src/components/hiring/candidate/stage-runner.tsx src/components/hiring/candidate/submit-delay.tsx src/components/hiring/candidate/text-activity.tsx src/components/hiring/candidate/choice-activity.tsx src/components/hiring/candidate/help.tsx src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Move the stage screens onto the step footer and the new question layout

Stage intro with tiles and icon rules; question parts in the header; one
filled button in the footer that says why it waits and stays filled while
it works (the pale button of STATUS item 23 cannot happen); written
questions with a 280px field and a saved check; choices as letter cards
with key hints. Task 13 residuals: a failed stage submit after the last
commit shows the question closed, and a tab remembers its two earlier
sent texts so an older save landing late cannot drop newer typing.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 11: V6 part 2, the file question (G2: "Dosya seç" is the filled button) and the Task 15 N1 cut note

**Files:**
- Modify: `src/components/hiring/candidate/file-upload.ts:168-195` (+ `beginUploadNote`), `file-upload.test.ts`
- Modify: `src/components/hiring/candidate/file-activity.tsx:1-245` (input id helper, drop zone and file card, N1)
- Modify: `src/components/hiring/candidate/stage-runner.tsx` (the footer from Task 10: `Dosya seç` while the file question has no file)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringFile.drop`, new `size`, `chooseFromComputer`)

**Shared with the exam:** none.

**Interfaces:**
- Consumes: the runner footer (Task 10).
- Produces: `fileInputId(activityId: string): string` (exported from `file-activity.tsx`); `beginUploadNote(storage: DraftStorage | null, key: string): void` (`file-upload.ts`).

- [ ] **Step 1: Failing test (N1)**

Add to `src/components/hiring/candidate/file-upload.test.ts` (import `beginUploadNote`):

```ts
  it("forgets an earlier cut note as soon as a new upload starts; only a cut of the new upload marks it again (Task 15 N1)", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const key = cutUploadKey("tok", 1, "run-1", "act-1");
    markCutUpload(storage, key, "Eski.pdf");
    beginUploadNote(storage, key);
    expect(readCutUpload(storage, key)).toBeNull();
    markCutUpload(storage, key, "Yeni.pdf");
    expect(readCutUpload(storage, key)).toBe("Yeni.pdf");
  });
```

Run: `pnpm exec vitest run src/components/hiring/candidate/file-upload.test.ts`
Expected: FAIL (`beginUploadNote` is not exported).

- [ ] **Step 2: `beginUploadNote`**

Append after `clearCutUpload` in `file-upload.ts`:

```ts
/**
 * Task 15 N1: a cut note speaks about one upload. A new upload forgets the
 * old note at once (a reload during the new one must not name the old file);
 * if the new upload is cut, `onCut` marks it again with its own name.
 */
export function beginUploadNote(storage: DraftStorage | null, key: string): void {
  clearCutUpload(storage, key);
}
```

Run: `pnpm exec vitest run src/components/hiring/candidate/file-upload.test.ts`
Expected: PASS.

- [ ] **Step 3: Copy**

| Key | TR | EN |
|---|---|---|
| `hiringFile.drop` (changed) | Dosyanı buraya bırak | Drop your file here |
| `hiringFile.size` (new) | {size} · yüklendi | {size} · uploaded |
| `hiringFile.chooseFromComputer` (new) | Bilgisayarından dosya seç | Choose a file from your computer |

- [ ] **Step 4: The file question**

In `file-activity.tsx`:
1. Export the input's id and use it (replaces `const inputId = \`${ids}-file\`;` at `:51`):

```ts
/** G2: the footer's "Dosya seç" opens this input. */
export const fileInputId = (activityId: string) => `file-input-${activityId}`;
```

and inside the component `const inputId = fileInputId(activity.id);`.

2. In `upload()` (`:103-105`) forget the earlier cut note in the tab too: after `setCut(null);` add `beginUploadNote(sessionDrafts(), cutKey);` (import it from `./file-upload`).

3. Replace the drop zone and the "uploaded" line (`:148-221`) with:

```tsx
      {current && !uploading ? (
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-card-candidate">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary">
            <FileCheck className="size-5 text-ink" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-medium break-all text-ink">{current.name}</p>
            <p className="tnum text-[14px] text-muted">{t("size", { size: sizeLabel(current.bytes, locale) })}</p>
          </div>
          <label
            htmlFor={inputId}
            aria-disabled={off || undefined}
            className={cn("inline-flex min-h-11 cursor-pointer items-center text-[16px] text-ink underline decoration-underline underline-offset-4 peer-focus-visible:outline-2", off && "cursor-not-allowed text-muted")}
          >
            {t("change")}
          </label>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!off) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn("rounded-2xl border border-dashed border-input bg-surface px-card-candidate py-10 text-center", over && "border-ink bg-canvas")}
        >
          <FileUp className="mx-auto size-8 text-muted" strokeWidth={1.5} aria-hidden />
          <p className="mt-3 text-[16px] leading-[26px] text-ink">{t("drop")}</p>
          <p id={limitsId} className="tnum mt-2 flex flex-wrap justify-center gap-2 text-[14px] text-muted">
            {types ? <span className="rounded-full border border-line px-2.5 py-0.5">{types}</span> : null}
            <span className="rounded-full border border-line px-2.5 py-0.5">{t("limitsAny", { mb })}</span>
          </p>
          {uploading ? (
            <DisabledReason id={whyId} className="mt-2 text-[14px]">
              {t("uploadingReason")}
            </DisabledReason>
          ) : null}
        </div>
      )}
      {/* A real file input, reachable with the keyboard (its name says what it does); never `disabled` (M1). */}
      <input
        id={inputId}
        type="file"
        className="peer sr-only"
        accept={acceptAttr(accepted)}
        aria-label={t("chooseFromComputer")}
        aria-disabled={off || undefined}
        aria-describedby={[limitsId, uploading ? whyId : null].filter(Boolean).join(" ")}
        onClick={(e) => {
          if (off) e.preventDefault();
        }}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
```

(`limitsId` is rendered only in the drop zone; while a file card shows, `aria-describedby` points at a missing id: build it as `[current && !uploading ? null : limitsId, uploading ? whyId : null]`.) Imports: `FileCheck, FileUp` from lucide-react; drop `Button`'s `buttonVariants` use for the old label (keep `Button` for "Tekrar dene"); `StatusDot` is no longer used: remove it.

The progress block (`:202-213`), the cut line (`:223`), the problem block (`:225-238`) and the live region (`:240-242`) stay.

- [ ] **Step 5: The runner's footer for a file question**

In `stage-runner.tsx` (Task 10 render), next to `primary`:

```tsx
  // G2, 3.9: while the file question has no file, the filled button opens the picker; an optional one can still be passed with the outline "Sonraki soru".
  const fileInput = activity?.type === "FILE_UPLOAD" ? fileInputId(activity.id) : null;
  const needsFile = fileInput !== null && !answered && !uploadingHere && !inputsOff && !retrying;
  const chooseFile: FooterAction | null = needsFile ? { kind: "button", id: "file-choose", label: tf("choose"), onClick: () => document.getElementById(fileInput ?? "")?.click() } : null;
```

and pass `primary={chooseFile ?? primary}` and `secondary={chooseFile && !activity?.required ? { ...primary, id: "activity-skip" } : null}` to the runner's `StepFooter`. Import `fileInputId` from `./file-activity`. The "optional" note stays.

- [ ] **Step 6: Tests and gates**

Run: `pnpm exec vitest run src/components/hiring/candidate && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4`
Expected: PASS (`file-rules.test.ts`, `file-upload.test.ts` green), clean.

- [ ] **Step 7: Browser check**

`kademe_ui_check`, `pnpm dev:hiring-link --kind file`, dev server 3100.
1. The file question at 1440: chip "Dosya yükleme", the drop zone with the icon, "Dosyanı buraya bırak", chips "PDF" and "En fazla 1 MB"; footer one filled "Dosya seç"; pressing it opens the file picker (use `file_upload` to pick a small PDF from the scratchpad).
2. During the upload the bar moves, the footer's "Sonraki soru" waits with "Dosyan yükleniyor. Bitince devam edebilirsin.".
3. After: the card (file-check icon, name, "… · yüklendi", "Değiştir"); footer "Sonraki soru" filled.
4. N1: start a second upload of a larger file and reload mid-way: the cut note names the second file only; start a third upload and reload before it is cut: no stale note about the second.
5. An optional file question: published rows are frozen by triggers, so it cannot be made optional on the copy. If no fixture has one, write "isteğe bağlı dosya sorusu tarayıcıda görülmedi; kod yolu Step 5" in the report.
6. 1280 and 1024 screenshots.

- [ ] **Step 8: Commit**

```bash
git add src/components/hiring/candidate/file-upload.ts src/components/hiring/candidate/file-upload.test.ts src/components/hiring/candidate/file-activity.tsx src/components/hiring/candidate/stage-runner.tsx src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Make choosing the file the file question's filled button

Without a file the footer's filled button opens the picker; with one, a
file card with 'Değiştir' and 'Sonraki soru'. A new upload forgets the
earlier cut note at once (Task 15 N1).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 12: V7 part 1, the finish and the survey (3.10)

**Files:**
- Modify: `src/components/hiring/candidate/done-model.ts` (+ `doneFooter`), `done-model.test.ts`
- Modify (render rewritten, effects and send kept): `src/components/hiring/candidate/done.tsx:1-224`
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (`hiringDone`: `nextTitle`, `nextToday`, `sentToday`, `addComment`; pinned keys unchanged)

**Shared with the exam:** none (the exam's finish is `src/components/candidate/Finished.tsx`).

**Interfaces:**
- Consumes: `StepScreen`, `StepFooter`, `PathSteps`, `ChoiceCardGroup`, `Disclosure` (Task 4); `Illustration` `done` (Task 3).
- Produces: `doneFooter(input: { surveyEnabled: boolean; survey: "open" | "sending" | "sent" | "failed" | "closed" }): "send" | null`.

- [ ] **Step 1: Failing test**

Add to `src/components/hiring/candidate/done-model.test.ts` (import `doneFooter`):

```ts
describe("the finish page's one filled button (3.10)", () => {
  it("is 'Görüşünü gönder' only while the survey can be sent; a closing page has none", () => {
    expect(doneFooter({ surveyEnabled: true, survey: "open" })).toBe("send");
    expect(doneFooter({ surveyEnabled: true, survey: "sending" })).toBe("send");
    expect(doneFooter({ surveyEnabled: true, survey: "failed" })).toBe("send");
    expect(doneFooter({ surveyEnabled: true, survey: "sent" })).toBeNull();
    expect(doneFooter({ surveyEnabled: true, survey: "closed" })).toBeNull();
    expect(doneFooter({ surveyEnabled: false, survey: "open" })).toBeNull();
  });
});
```

Run: `pnpm exec vitest run src/components/hiring/candidate/done-model.test.ts`
Expected: FAIL.

- [ ] **Step 2: Model and copy**

Append to `done-model.ts`:

```ts
/** 3.10: the survey's send is the page's one filled button; without a survey to send, the finish is a closing page with none. */
export function doneFooter(input: { surveyEnabled: boolean; survey: "open" | "sending" | "sent" | "failed" | "closed" }): "send" | null {
  return input.surveyEnabled && (input.survey === "open" || input.survey === "sending" || input.survey === "failed") ? "send" : null;
}
```

| Key (`hiringDone`) | TR | EN |
|---|---|---|
| `nextTitle` | Sırada ne var | What happens next |
| `nextToday` | Bugün | Today |
| `sentToday` | Cevapların ekibe iletildi. | Your answers reached the team. |
| `addComment` | Yorum ekle | Add a comment |

Unchanged on purpose (pinned by `hiring-candidate-copy.test.ts:68-82`): `title`, `saved`, `next`, `surveyNote`; and `byDate`.

- [ ] **Step 3: The screen**

Replace the `return (...)` of `Done` (`done.tsx:99-223`) and its imports with:

```tsx
import { useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { Disclosure } from "@/components/visual/disclosure";
import { PathSteps } from "@/components/visual/path-steps";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { Textarea } from "@/components/ui/textarea";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { mailTo } from "./closed";
import { devicesLine, doneFooter, surveyAfterFailure, takeLastLostWords } from "./done-model";
import { sessionDrafts, type LostKind } from "./draft-store";
import { withTimeout } from "./runner-steps";
import { serverMessage } from "./server-message";
import { stopAllStreams } from "./streams";
```

```tsx
  const title = state.candidateName ? t("title", { name: state.candidateName }) : t("titleNoName");
  const saved = t("saved", { count: finished.stagesDone });
  const lostLine = lost === "text" ? t("lostText") : lost === "choice" ? t("lostChoice") : null;
  const devicesText = !stopped ? null : devices === "cameraAndMicrophone" ? t("devicesOff") : devices === "microphone" ? t("micOff") : null;
  const footer = doneFooter({ surveyEnabled: finished.survey.enabled, survey });
  const rights = { label: t("rights"), href: `/a/${encodeURIComponent(token)}/rights` };

  const summary = (
    <div className="space-y-6">
      {lostLine ? <p className="text-[16px] leading-[26px] text-ink-2">{lostLine}</p> : null}
      <section aria-labelledby="done-next" className="rounded-2xl border border-line bg-surface p-card-candidate">
        <h2 id="done-next" className="mb-4 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
          {t("nextTitle")}
        </h2>
        <PathSteps
          steps={[
            { title: t("nextToday"), detail: t("sentToday"), state: "done" },
            { title: t("next", { count: state.reviewers }) },
            { title: <span className="tnum">{t("byDate", { date: feedbackBy })}</span> },
          ]}
        />
      </section>
      <div className="space-y-1 text-[14px] leading-[22px] text-muted">
        {devicesText ? <p>{devicesText}</p> : null}
        {state.contactEmail ? <p>{t.rich("contact", { email: state.contactEmail, mail: mailTo(state.contactEmail) })}</p> : null}
      </div>
    </div>
  );

  const surveyBlock = finished.survey.enabled ? (
    <section aria-labelledby="survey-title" className="space-y-4">
      <h2 id="survey-title" ref={surveyHeading} tabIndex={-1} className="text-[20px] leading-7 font-semibold text-ink outline-none">
        {t("surveyTitle")}
      </h2>
      {survey === "sent" ? (
        <p role="status" className="text-[16px] leading-[26px] text-ink">
          {t("surveyThanks")}
        </p>
      ) : survey === "closed" ? (
        <p role="status" className="text-[16px] leading-[26px] text-ink">
          {error ?? t("surveyClosed")}
        </p>
      ) : (
        <>
          <ChoiceCardGroup
            type="single"
            name="survey-rating"
            size="square"
            columns={5}
            value={rating ? [rating] : []}
            onChange={([v]) => setRating(v)}
            labelledBy="survey-title"
            describedBy="survey-scale"
            disabled={survey === "sending"}
            items={RATINGS.map((value) => ({
              value,
              label: (
                <>
                  <span className="tnum" aria-hidden>
                    {value}
                  </span>
                  <span className="sr-only">{value === "1" ? `1, ${t("surveyLow")}` : value === "5" ? `5, ${t("surveyHigh")}` : value}</span>
                </>
              ),
            }))}
          />
          <div id="survey-scale" className="flex justify-between text-[14px] leading-[22px] text-muted">
            <span>{t("surveyLow")}</span>
            <span>{t("surveyHigh")}</span>
          </div>
          <Disclosure label={t("addComment")} icon={NotebookPen}>
            <label htmlFor="survey-comment" className="sr-only">
              {t("surveyComment")}
            </label>
            <Textarea
              id="survey-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              maxLength={COMMENT_MAX}
              disabled={survey === "sending"}
              rows={3}
              aria-describedby="survey-comment-count"
              className="resize-y bg-surface px-4 py-3 text-[16px] leading-[26px] md:text-[16px]"
            />
            <p id="survey-comment-count" className="tnum mt-1 text-right text-[14px] text-muted">
              {t("surveyCount", { used: comment.length, max: COMMENT_MAX })}
            </p>
          </Disclosure>
          <p className="text-[14px] leading-[22px] text-muted">{t("surveyNote")}</p>
          {survey === "failed" && error ? (
            <p role="alert" className="text-[14px] leading-[22px] text-ink">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  ) : null;

  return (
    <>
      {/* One polite line for a screen reader after the 8 second send navigates here (the button it pressed is gone). */}
      <p role="status" className="sr-only">
        {announce ? [title, saved, lostLine, devicesText].filter(Boolean).join(" ") : ""}
      </p>
      {surveyBlock ? (
        <StepScreen layout="split" illustration="done" title={title} lead={<p>{saved}</p>} aside={summary}>
          {surveyBlock}
        </StepScreen>
      ) : (
        <StepScreen layout="single" width={640} illustration="done" illustrationSize="spot" title={title} lead={<p>{saved}</p>}>
          {summary}
          <p className="mt-8">
            <a href={rights.href} className="inline-flex min-h-11 items-center text-[14px] text-muted underline decoration-underline underline-offset-4 hover:text-ink">
              {rights.label}
            </a>
          </p>
        </StepScreen>
      )}
      {surveyBlock ? (
        <StepFooter
          back={rights}
          primary={footer === "send" ? { kind: "button", id: "survey-send", label: t("surveySend"), busy: survey === "sending", busyLabel: t("surveySending"), waitReason: !rating ? t("surveyPick") : null, onClick: () => void send() } : null}
        />
      ) : null}
    </>
  );
}
```

(The state hooks, the effect that stops streams and reads the lost words, `send()` and `surveyAfterFailure` stay as they are at `:35-91`; `ActionBar`, `Button`, `DisabledReason`, `RadioGroup` and `RadioGroupItem` imports go. The `why` constant at `:97` goes.) The StepFooter's back slot shows "Veri hakların" with a chevron; it stays a real link.

- [ ] **Step 4: Tests and gates**

Run: `pnpm exec vitest run src/components/hiring/candidate src/i18n src/solutions/hiring/candidate && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4`
Expected: PASS (`done-model.test.ts` +1, the finish page tests in `pages.test.ts` unchanged), clean.

- [ ] **Step 5: Browser check**

`kademe_ui_check`, `pnpm dev:hiring-link --kind written`, finish both stages.
1. 1440: the done drawing under "Tamamlandı, teşekkürler Elif Kaya." and "Aşaman tamamlandı...", the "Sırada ne var" card (Bugün done, "Ekipten bir kişi değerlendirecek.", the date), the camera line only for a recorded assessment, the contact; on the right the survey: five square cards, the scale words, "Yorum ekle" closed, the note; footer "Veri hakların" left and "Görüşünü gönder" grey with "Önce 1 ile 5 arasında bir puan seç.".
2. Pick 4 (keyboard: arrow keys), the button fills; send: filled spinner "Gönderiliyor", then "Teşekkürler, görüşün iletildi." with focus on the survey heading and no filled button left.
3. Reload: the thanks (server says answered), no button. 1280 and 1024 screenshots.
4. An opening with the survey off (Team and rules switch on the copy, logged in through `/login`): the page is one centred column with the drawing above the title, no filled button, "Veri hakların" as a link.

- [ ] **Step 6: Commit**

```bash
git add src/components/hiring/candidate/done-model.ts src/components/hiring/candidate/done-model.test.ts src/components/hiring/candidate/done.tsx src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json
git commit -m "Lay out the finish as what happened, what comes next and the survey

The done drawing and a 'Sırada ne var' path on the left, the survey as
five cards with the comment behind a row on the right, its send as the
one filled button; without a survey the page closes with no button. The
pinned promise texts are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 13: V7 part 2, status screens (closed, link problems with an honest request), and the end of `ActionBar`

**Files:**
- Create: `src/components/hiring/candidate/problem-view.ts`, `problem-view.test.ts`
- Create: `src/components/hiring/candidate/link-problem.tsx`
- Create: `src/components/hiring/candidate/footer-usage.test.ts`
- Delete: `src/components/hiring/candidate/action-bar.tsx`
- Modify: `src/components/hiring/candidate/closed.tsx:16-30` (`ClosedCard` on `StatusScreen`)
- Modify: `src/solutions/hiring/server/candidate.ts:338-346` (+ `hiringProblemFacts`), `candidate.test.ts`
- Modify: `src/solutions/hiring/candidate/pages.tsx:68-104` (the problem branch), `pages.test.ts:24` (mock), `:132-146` (the expired-card test)
- Modify: `src/i18n/messages/candidate.tr.json`, `candidate.en.json` (new `hiringProblem`), `src/i18n/hiring-candidate-copy.test.ts`

**Shared with the exam:** none. The core `src/components/candidate/LinkProblem.tsx` is no longer rendered for a served hiring EXPIRED or NOT_YET link and is not changed; the exam keeps it exactly (its swallowed request failure at `LinkProblem.tsx:49-57` is recorded in STATUS by Task 22 as open for a separate user decision, plan decision 8).

**Interfaces:**
- Consumes: `StatusScreen`, `StepFooter` (Task 4); `sendRightsRequest` (`@/components/candidate/rights-send`, a generic "sent only when the server took it" helper); `linkRequestHint` (`@/components/candidate/request-wording`); `dateTime` (`@/i18n/dates`).
- Produces:
  - `hiringProblemView(input: { problem: "EXPIRED" | "NOT_YET" | "INVALID"; openingClosed: boolean; started: boolean }): "expired" | "notYet" | "closed" | "invalid"`
  - `hiringProblemFacts(h: HiringContext): Promise<{ contact: string | null; openingClosed: boolean; started: boolean }>`
  - `HiringLinkProblem(props: { token: string; problem: "EXPIRED" | "NOT_YET"; date: string | null; contactEmail: string | null })`

- [ ] **Step 1: Failing tests**

```ts
// src/components/hiring/candidate/problem-view.test.ts
import { describe, expect, it } from "vitest";
import { hiringProblemView } from "./problem-view";

describe("which card a served hiring link with a problem shows (Task 18 carry, plan decision 9)", () => {
  it("shows the expired and not-yet cards on an open opening", () => {
    expect(hiringProblemView({ problem: "EXPIRED", openingClosed: false, started: false })).toBe("expired");
    expect(hiringProblemView({ problem: "NOT_YET", openingClosed: false, started: false })).toBe("notYet");
  });

  it("never says the assessment is open when the opening is closed and the candidate never started: the closed card", () => {
    expect(hiringProblemView({ problem: "EXPIRED", openingClosed: true, started: false })).toBe("closed");
    expect(hiringProblemView({ problem: "NOT_YET", openingClosed: true, started: false })).toBe("closed");
  });

  it("lets a candidate who started ask for a new link on a closed opening (Task 7 ruling 3)", () => {
    expect(hiringProblemView({ problem: "EXPIRED", openingClosed: true, started: true })).toBe("expired");
  });

  it("leaves an invalid link to the core's card", () => {
    expect(hiringProblemView({ problem: "INVALID", openingClosed: false, started: false })).toBe("invalid");
  });
});
```

```ts
// src/components/hiring/candidate/footer-usage.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.join(process.cwd(), "src/components/hiring/candidate");

describe("one filled button at one place (G9)", () => {
  it("no hiring candidate screen keeps the old ActionBar: the footer draws the button", () => {
    expect(existsSync(path.join(dir, "action-bar.tsx"))).toBe(false);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
      expect(readFileSync(path.join(dir, file), "utf8"), file).not.toMatch(/action-bar|ActionBar/);
    }
  });

  it("every screen with a filled button draws it through StepFooter (positive control: the runner does)", () => {
    const runner = readFileSync(path.join(dir, "stage-runner.tsx"), "utf8");
    expect(runner).toMatch(/<StepFooter/);
    // The phone screen (desktop-only.tsx) has no footer: its one filled button is drawn in place.
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx") && f !== "desktop-only.tsx")) {
      const text = readFileSync(path.join(dir, file), "utf8");
      expect(text, file).not.toMatch(/variant="primary"/);
    }
  });
});
```

Add to `src/solutions/hiring/server/candidate.test.ts` (import `hiringProblemFacts`):

```ts
describe("hiringProblemFacts", () => {
  const h = { ...ctx(), hiring: { openingId: "op-1", versionId: VERSION, extraTimePct: 0 as const, consentTextId: "ct-1" } } as HiringContext;

  it("reads the opening's status and contact in the invitation's organisation, and whether a stage was ever started", async () => {
    fake.respond = (op) =>
      op.table === "hiring_openings" ? [{ status: "CLOSED", openingContact: null, orgContact: "ik@ornek.test" }] : op.table === "attempts" ? [{ startedAt: NOW }] : [];
    expect(await hiringProblemFacts(h)).toEqual({ contact: "ik@ornek.test", openingClosed: true, started: true });
    const opening = fake.ops.find((o) => o.table === "hiring_openings")!;
    expect(opening.params).toEqual(expect.arrayContaining(["op-1", ORG]));
    expect(fake.ops.find((o) => o.table === "attempts")!.params).toEqual(expect.arrayContaining([ASSESSMENT]));
  });

  it("says not started and not closed when there is no attempt and the opening is open", async () => {
    fake.respond = (op) => (op.table === "hiring_openings" ? [{ status: "OPEN", openingContact: "deniz@ornek.test", orgContact: "ik@ornek.test" }] : []);
    expect(await hiringProblemFacts(h)).toEqual({ contact: "deniz@ornek.test", openingClosed: false, started: false });
  });
});
```

Add to `src/i18n/hiring-candidate-copy.test.ts`:

```ts
  it("words a hiring link problem without a promise: no 'one click', no 'still open', no new link before it opens (Task 18 and final wave carries)", () => {
    for (const text of [...strings(tr.hiringProblem), ...strings(en.hiringProblem)]) expect(text).not.toMatch(/tek tıkla|one click|hâlâ açık|still open|dönülür|reply/i);
    for (const key of ["notYetBody", "notYetBodyDated"] as const) {
      expect(tr.hiringProblem[key]).not.toMatch(/yeni link/i);
      expect(en.hiringProblem[key]).not.toMatch(/new link/i);
    }
    expect(tr.hiringProblem.askFailed).toBe("Talebin gönderilemedi. Bağlantını kontrol edip tekrar dener misin?");
  });
```

Run: `pnpm exec vitest run src/components/hiring/candidate/problem-view.test.ts src/components/hiring/candidate/footer-usage.test.ts src/solutions/hiring/server/candidate.test.ts src/i18n/hiring-candidate-copy.test.ts`
Expected: FAIL (modules and keys missing; `action-bar.tsx` exists).

- [ ] **Step 2: The view, the facts, the copy**

```ts
// src/components/hiring/candidate/problem-view.ts
/**
 * A served hiring link that cannot be used now. The expired and not-yet cards
 * say the assessment can still be done; that is untrue on a closed opening for
 * someone who never started (the team cannot give them a new link: Task 7
 * ruling 3), so they get the closed card. An invalid link keeps the core card.
 */
export function hiringProblemView(input: { problem: "EXPIRED" | "NOT_YET" | "INVALID"; openingClosed: boolean; started: boolean }): "expired" | "notYet" | "closed" | "invalid" {
  if (input.problem === "INVALID") return "invalid";
  if (input.openingClosed && !input.started) return "closed";
  return input.problem === "EXPIRED" ? "expired" : "notYet";
}
```

In `src/solutions/hiring/server/candidate.ts`, after `hiringRequestContact` (`:338-346`):

```ts
/** What a link-problem page needs: whom to name, whether the opening closed, whether a stage was ever started (the newest attempt). */
export async function hiringProblemFacts(h: HiringContext): Promise<{ contact: string | null; openingClosed: boolean; started: boolean }> {
  const [row] = await db
    .select({ status: hiringOpenings.status, openingContact: hiringOpenings.candidateContactEmail, orgContact: organizations.contactEmail })
    .from(hiringOpenings)
    .innerJoin(organizations, eq(organizations.id, hiringOpenings.orgId))
    .where(and(eq(hiringOpenings.id, h.hiring.openingId), eq(hiringOpenings.orgId, h.assessment.orgId)))
    .limit(1);
  const [attempt] = await db
    .select({ startedAt: attempts.startedAt })
    .from(attempts)
    .where(eq(attempts.assessmentId, h.assessment.id))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1);
  return { contact: row?.openingContact ?? row?.orgContact ?? null, openingClosed: row?.status === "CLOSED", started: !!attempt?.startedAt };
}
```

(`attempts`, `desc`, `hiringOpenings`, `organizations` are already imported in this file.)

`hiringProblem` (new namespace):

| Key | TR | EN |
|---|---|---|
| `expiredTitle` | Bu linkin süresi dolmuş | This link has expired |
| `expiredBodyDated` | Link {date} tarihinde kapandı. Yeni bir link isteyebilirsin. | The link closed on {date}. You can ask for a new one. |
| `expiredBody` | Link kapandı. Yeni bir link isteyebilirsin. | The link closed. You can ask for a new one. |
| `notYetTitle` | Bu link henüz açılmadı | This link is not open yet |
| `notYetBodyDated` | Değerlendirme {date} tarihinde açılıyor. O saatten sonra aynı linkten girebilirsin. | The assessment opens on {date}. You can come in through the same link after that. |
| `notYetBody` | Değerlendirme henüz açılmadı. Aynı linkten daha sonra girebilirsin. | The assessment is not open yet. You can come in through the same link later. |
| `ask` | Yeni link iste | Ask for a new link |
| `asking` | Gönderiliyor | Sending |
| `askFailed` | Talebin gönderilemedi. Bağlantını kontrol edip tekrar dener misin? | Your request could not be sent. Check your connection and try again? |
| `retry` | Tekrar dene | Try again |
| `message` | Aday yeni link talep etti. | The candidate asked for a new link. |
| `contact` | Bir sorun olduğunu düşünüyorsan <mail>{email}</mail> adresine yazabilirsin. | If you think something is wrong, you can write to <mail>{email}</mail>. |

- [ ] **Step 3: The cards**

```tsx
// src/components/hiring/candidate/link-problem.tsx
"use client";

import { useState } from "react";
import { linkRequestHint } from "@/components/candidate/request-wording";
import { sendRightsRequest } from "@/components/candidate/rights-send";
import { StatusScreen } from "@/components/visual/status-screen";
import { StepFooter } from "@/components/visual/step-footer";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import { mailTo } from "./closed";

/**
 * HIRING-VISUAL-FLOW 3.11 for a served hiring link: expired (ask for a new
 * link, one filled button) or not open yet (no request: the same link works
 * then). The request reports the truth (final wave carry): "sent" only when
 * the server took it, otherwise the failure and "Tekrar dene"; no reply is
 * promised, the contact is named. Dates arrive formatted on the server.
 */
export function HiringLinkProblem({ token, problem, date, contactEmail }: { token: string; problem: "EXPIRED" | "NOT_YET"; date: string | null; contactEmail: string | null }) {
  const t = useT("hiringProblem");
  const th = useT("hiringRequest");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [reason, setReason] = useState<string | null>(null);
  const note = useStepFocus<HTMLParagraphElement>(state === "sent" ? "sent" : "form");

  async function ask() {
    setState("sending");
    setReason(null);
    // The rights form's helper: "sent" only when the server took it, the server's own words for a refusal.
    const result = await sendRightsRequest(() => apiSend(token, "/problem", { area: "LINK", message: t("message") }));
    if (result.status === "sent") return setState("sent");
    setReason(result.reason);
    setState("failed");
  }

  const hint = linkRequestHint({ sent: state === "sent", noReply: { email: contactEmail } });
  const hintText =
    hint.namespace === "hiringRequest" ? ("email" in hint ? th.rich(hint.key, { email: hint.email, mail: mailTo(hint.email) }) : th(hint.key)) : null;

  if (problem === "NOT_YET") {
    return (
      <StatusScreen illustration="expired" title={t("notYetTitle")} body={date ? t("notYetBodyDated", { date }) : t("notYetBody")}>
        {contactEmail ? <p>{t.rich("contact", { email: contactEmail, mail: mailTo(contactEmail) })}</p> : null}
      </StatusScreen>
    );
  }
  return (
    <>
      <StatusScreen illustration="expired" title={t("expiredTitle")} body={date ? t("expiredBodyDated", { date }) : t("expiredBody")}>
        {state === "sent" ? (
          <p ref={note} tabIndex={-1} role="status" className="text-ink">
            {hintText}
          </p>
        ) : (
          <>
            <p className="text-[14px] text-muted">{hintText}</p>
            {state === "failed" ? (
              <p role="alert" className="text-ink">
                {reason ?? t("askFailed")}
              </p>
            ) : null}
          </>
        )}
      </StatusScreen>
      {state === "sent" ? null : (
        <StepFooter primary={{ kind: "button", id: "ask-link", label: state === "failed" ? t("retry") : t("ask"), busy: state === "sending", busyLabel: t("asking"), onClick: () => void ask() }} />
      )}
    </>
  );
}
```

`closed.tsx`, replace `ClosedCard` (`:16-30`):

```tsx
/** HIRING-UX 6.14 "Alım kapandı", HIRING-VISUAL-FLOW 3.11: the closed door, thanks, and a person to write to. */
export function ClosedCard({ contactEmail }: { contactEmail: string | null }) {
  const t = useT("hiringClosed");
  return (
    <StatusScreen illustration="closed" title={t("title")} body={t("body")}>
      {contactEmail ? <p className="text-[14px] leading-[22px] text-muted">{t.rich("contact", { email: contactEmail, mail: mailTo(contactEmail) })}</p> : null}
    </StatusScreen>
  );
}
```

(`import { StatusScreen } from "@/components/visual/status-screen";`).

- [ ] **Step 4: The page's problem branch**

In `pages.tsx` import `HiringLinkProblem` (`@/components/hiring/candidate/link-problem`), `hiringProblemView` (`@/components/hiring/candidate/problem-view`), `hiringProblemFacts` (`../server/candidate`, next to the others) and `dateTime` (`@/i18n/dates`). Replace the branch at `:100-104` with:

```tsx
  if (!resolved.ok && resolved.problem !== "COMPLETED") {
    const locale = isLocale(resolved.ctx.locale) ? resolved.ctx.locale : DEFAULT_LOCALE;
    const facts = await hiringProblemFacts(h);
    const view = hiringProblemView({ problem: resolved.problem, openingClosed: facts.openingClosed, started: facts.started });
    const card =
      view === "closed" ? (
        <ClosedCard contactEmail={facts.contact} />
      ) : view === "invalid" ? (
        problemCard(token, locale, resolved.problem, resolved.ctx, facts.contact)
      ) : (
        <HiringLinkProblem
          token={token}
          problem={view === "expired" ? "EXPIRED" : "NOT_YET"}
          date={
            view === "expired"
              ? formatInviteDay(orgDay(resolved.ctx.link.expiresAt, ORG_TIMEZONE), locale)
              : resolved.ctx.link.notBefore
                ? dateTime(resolved.ctx.link.notBefore, locale)
                : null
          }
          contactEmail={facts.contact}
        />
      );
    return framed(token, locale, resolved.ctx.orgName, facts.contact, card);
  }
```

`problemCard` stays for the invalid case; `hiringRequestContact` is no longer called here (the module still uses it, `module.ts:53`).

In `pages.test.ts`: the `../server/candidate` mock (`:24`) gains `hiringProblemFacts: async () => h.facts` with `facts: { contact: "deniz@ornek.test", openingClosed: false, started: false }` in the hoisted state (reset in `beforeEach`); mock `@/components/hiring/candidate/link-problem` like the others; and the test "shows an expired link's card, and the closed opening's card" (`:132-146`) now finds `HiringLinkProblem` instead of `LinkProblem`:

```ts
    const expired = await render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx } });
    expect(find(expired, HiringLinkProblem)[0].props).toEqual({ token: "tok", problem: "EXPIRED", date: "19 Eki", contactEmail: "deniz@ornek.test" });
    expect(find(expired, LinkProblem)).toHaveLength(0);
```

(keep the rest of that test: the language switch and the frame's contact). Reason for the change, in the commit body: plan decision 8 (hiring's own honest card). Add one more test:

```ts
  it("shows the closed card, not 'ask for a new link', on a closed opening to a candidate who never started (plan decision 9)", async () => {
    h.facts = { contact: "deniz@ornek.test", openingClosed: true, started: false };
    const node = await render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx } });
    expect(find(node, ClosedCard)[0].props).toEqual({ contactEmail: "deniz@ornek.test" });
    expect(find(node, HiringLinkProblem)).toHaveLength(0);
    h.facts = { contact: "deniz@ornek.test", openingClosed: true, started: true };
    expect(find(await render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx } }), HiringLinkProblem)).toHaveLength(1);
  });
```

- [ ] **Step 5: Remove `ActionBar`**

`git rm src/components/hiring/candidate/action-bar.tsx` (every import went in Tasks 5, 8, 9, 10 and 12; `rg -n "action-bar|ActionBar" src` must print nothing first).

- [ ] **Step 6: Tests and gates**

Run: `pnpm exec vitest run src/components/hiring/candidate src/solutions/hiring src/i18n && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -5`
Expected: PASS and clean. Then `verify:hiring-flow` on a fresh `kademe_flow_check` (its expired check reads `"problem":"EXPIRED"` and the frame's `"orgName"`: both still there) and `verify:guard` with the dev server on 3100 over `kademe_platform` (Task 2 Step 11 commands): all ok.

- [ ] **Step 7: Browser check**

`kademe_ui_check`:
1. Expired: mint a link, `docker exec kademe-db psql -U kademe -d kademe_ui_check -c "update assessment_links set expires_at = now() - interval '1 day' where status = 'NOT_STARTED'"` (only links on the copy), open it: the hourglass drawing, "Bu linkin süresi dolmuş", "Link … tarihinde kapandı. Yeni bir link isteyebilirsin.", the hint naming the contact, one filled "Yeni link iste" in the footer. Stop the dev server, press: after the request fails the page says "Talebin gönderilemedi…" and the button reads "Tekrar dene" (never "Talebin iletildi"); start the server, press: "Talebin kaydedildi. Ekip yeni bir link gönderirse…" with focus on it, no button left. 1280 and 1024 screenshots.
2. Closed opening, not started: close the opening from the panel (Team and rules, logged in through `/login`) and open another expired link: the closed-door card "Bu pozisyon için değerlendirme kapandı".
3. Not yet: `update assessment_links set not_before = now() + interval '2 days'` on a fresh link: "Bu link henüz açılmadı", the date and time, no request button.
4. The exam's expired card (an exam link on the copy: `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_ui_check pnpm dev:link`, expired the same way): the core card as before. Proof that its code did not move: `git diff --stat 53acc8f -- src/components/candidate/LinkProblem.tsx src/components/candidate/request-wording.ts` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add src/components/hiring/candidate/problem-view.ts src/components/hiring/candidate/problem-view.test.ts src/components/hiring/candidate/link-problem.tsx src/components/hiring/candidate/footer-usage.test.ts src/components/hiring/candidate/closed.tsx src/solutions/hiring/server/candidate.ts src/solutions/hiring/server/candidate.test.ts src/solutions/hiring/candidate/pages.tsx src/solutions/hiring/candidate/pages.test.ts src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json src/i18n/hiring-candidate-copy.test.ts
git rm src/components/hiring/candidate/action-bar.tsx
git commit -m "Give hiring link problems an honest card and drop ActionBar

Expired and not-yet links of a served hiring invitation get their own
status screen: a new-link request says sent only when the server took it,
otherwise the failure and a retry; nothing promises a reply or a one-click
extension, and a not-yet link offers no new link. A closed opening shows a
candidate who never started the closed card. The closed card moves onto
StatusScreen. pages.test: the expired-card test now finds HiringLinkProblem
(plan decision 8). The exam's core LinkProblem is unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

## Part 2: manager panel (M1, M-W, M2, M3, M4, M5, M7, M8; design v4, K12)

Design v4 (`docs/design/HIRING-VISUAL-FLOW.md` version 4, commit 00d5af7: K12, H1-H9, W1-W10, KG1-KG5, 4.3-4.10, 5, 6, 8) governs this part; where an earlier decision of this plan differs, v4 wins (decision 11 is replaced by H8). Binding rulings applied here: C6 (only accommodation requests become Today's next task; data-rights requests are counted with a plain note), C9, C12, C13, C16, C17, C18, C19, C21 and the Task 4 carries (one filled button per screen; no `shortcut` prop on any panel choice card, so no keyboard shortcut needs `useChoiceShortcuts`).

**Two placement rules for every task below (found while checking this text against the repo):**
- New panel building blocks live in `src/components/manager/`, not `src/components/panel/`. `src/solutions/boundary.test.ts` treats `src/components/panel/` as the exam's panel (`EXAM_CODE`) and fails any hiring file that imports it (`OTHER_SOLUTION` has `@/components/panel/`); hiring pages need `PanelHeader`, `EmptyState`, `GuidedFlow`, `SummaryRows` and `ControlRow`. `src/components/manager/` is core (the ESLint core rule applies) and hiring already imports it (`PageTitle`, `RouteTabs`). Design 5 names `components/panel/`; this is the same kind of forced move as plan decision 1.
- A link whose target carries a hash (`…/settings#team-members`, `…#publish`) is a plain `<a>`, never `next/link`: the flows read the step with `useSyncExternalStore(subscribeHash, …)` (`src/lib/client/hash-step.ts`, ruling C16), which listens to `hashchange` and `popstate`; a client-side `Link` navigation fires neither.

Shared test helpers: server reads are tested on the fake database (`src/solutions/hiring/server/test-fake-db.ts`); "one after another" (ruling C21) is proved by recording, in `fake.respond`, how many statements were recorded when each one is answered (`[1, 2, 3, …]`; `Promise.all` would answer the later ones only after all were recorded).

### Task 14: M1 part 1, menu icons, `PanelHeader` behind `PageHead` and `PageTitle`, `RowMenu`, the panel error page in "sen"

**Files:**
- Modify: `src/solutions/types.ts:21` (`NavLink` gains `icon`), `src/solutions/registry.ts:17-54` (`NavGroupView` items carry `icon`; shared items get theirs), `src/solutions/registry.test.ts:57-63`
- Modify: `src/solutions/hiring/manifest.ts:14`, `src/solutions/language-exam/manifest.ts:13-17` (icons)
- Modify: `src/components/manager/nav.tsx:1-88` (draws the icon)
- Create: `src/components/manager/row-menu.tsx`, `src/components/manager/panel-header.tsx`, `src/components/manager/panel-header.test.ts`
- Modify: `src/components/panel/bits.tsx:1-2` (import), `:39-49` (`PageHead` renders `PanelHeader`), `src/components/manager/page-title.tsx:1-23` (`PageTitle` renders `PanelHeader`)
- Modify: `src/i18n/messages/manager.tr.json`, `manager.en.json` (`errorPage` in "sen", `nav.more`)
- Create: `src/i18n/panel-copy.test.ts` (shared panel namespaces speak "sen", K9)

**Shared with the exam (flag: M1 touches the live exam's screens):**
- `src/components/manager/nav.tsx` and `src/solutions/registry.ts`: the menu on every panel page, the exam's three items included (icons only; labels, order and links unchanged).
- `src/components/panel/bits.tsx` `PageHead`: the header of `/dashboard`, `/exam/students`, `/exam/students/new`, `/exam/exams`, `/exam/exams/new`, `/exam/bank` (title weight 700 becomes 600, tracking -0.02em becomes -0.01em, as the hiring pages already draw; same words, same action).
- `src/app/(manager)/error.tsx` copy (the panel's error boundary on exam pages too): "siz" becomes "sen" (K9).
Exam behaviour (links, forms, actions, data) does not change; Step 1 and Step 8 prove the pages' text is identical before and after.

**Interfaces:**
- Consumes: `DropdownMenu*` (`@/components/ui/dropdown-menu`), `Button`.
- Produces:
  - `type NavIcon = "sun" | "briefcase" | "users" | "file-text" | "library" | "id-card" | "target" | "settings"` (exported from `@/solutions/types`); `NavLink = { href: string; label: I18nLabel; icon: NavIcon }`; `NavGroupView.items: Array<{ href: string; label: string; icon: NavIcon }>`
  - `type RowMenuItem = { label: string; detail?: string; href?: string; onSelect?: () => void; disabledReason?: string }`; `RowMenu(props: { label: string; items: RowMenuItem[] })` (`@/components/manager/row-menu`). On hiring pages every item is a link (plan decision 14, kept by H8); `onSelect` exists for a later caller and is not used in plan 2b.
  - `PanelHeader(props: { kicker?: ReactNode; title: ReactNode; meta?: ReactNode; primary?: ReactNode; menu?: { label: string; items: RowMenuItem[] } })` (`@/components/manager/panel-header`)

- [ ] **Step 1: Before screenshots and page text (exam pages)**

On a fresh `kademe_ui_check` (Global Constraints recipe) with the dev server on 3100 and the current code, log in through `/login` (owner in `docs/STATUS.md:50`). For each of `/dashboard`, `/exam/students`, `/exam/students/new`, `/exam/exams`, `/exam/exams/new`, `/exam/bank`, `/hiring/openings`: take a screenshot at 1440 and 1280 into the session scratchpad as `shots/p2b-t14-before-<page>-<width>.png` and save `get_page_text` into `shots/p2b-t14-before-<page>.txt`. Keep the server and the copy for Step 8.

- [ ] **Step 2: Failing tests**

`src/solutions/registry.test.ts`, the menu test (`:57-63`) becomes (reason: items now carry their icon, P1):

```ts
  it("builds the HIRING-UX 4.1 menu with group headers and an icon per item: Today, Hiring, Exam, Library, Settings (P1)", () => {
    const nav = buildNav("tr", shared);
    expect(nav.map((g) => g.key)).toEqual(["today", "hiring", "language-exam", "library", "settings"]);
    expect(nav.map((g) => g.label)).toEqual([null, "İşe alım", "Sınav", "Kütüphane", null]);
    expect(nav[1].items).toEqual([{ href: "/hiring/openings", label: "Alımlar", icon: "briefcase" }]);
    expect(nav.flatMap((g) => g.items.map((i) => i.icon))).toEqual(["sun", "briefcase", "users", "file-text", "library", "id-card", "target", "settings"]);
    expect(buildNav("en", shared)[1].items[0].label).toBe("Openings");
  });
```

```ts
// src/components/manager/panel-header.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHead } from "@/components/panel/bits";
import { PageTitle } from "./page-title";
import { PanelHeader } from "./panel-header";

// Typed loosely, as in blocks.test.ts: createElement's overloads reject a component with required props here.
const html = (type: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(type as never, props as never));

describe("PanelHeader (P2)", () => {
  it("draws kicker, title, one meta line, the one filled action and the ⋯ menu", () => {
    const out = html(PanelHeader, {
      kicker: "Alımlar",
      title: "Ürün Tasarımcısı · Ekim",
      meta: "Yayında",
      primary: createElement("button", { id: "go" }, "Aday davet et"),
      menu: { label: "Diğer işlemler", items: [{ label: "Önizle", href: "/x" }] },
    });
    expect(out).toMatch(/<h1[^>]*>Ürün Tasarımcısı · Ekim<\/h1>/);
    expect(out).toContain("Alımlar");
    expect(out).toContain("Yayında");
    expect(out).toContain('id="go"');
    expect(out).toMatch(/<button[^>]*aria-label="Diğer işlemler"/);
  });

  it("is what the exam's PageHead and the hiring PageTitle draw, with their words unchanged", () => {
    const head = html(PageHead, { title: "Öğrenciler", sub: "12 öğrenci", action: createElement("a", { href: "/exam/students/new" }, "Öğrenci davet et") });
    expect(head).toBe(html(PanelHeader, { title: "Öğrenciler", meta: "12 öğrenci", primary: createElement("a", { href: "/exam/students/new" }, "Öğrenci davet et") }));
    const title = html(PageTitle, { eyebrow: "Tasarımcı", title: "Alım", sub: "Taslak" });
    expect(title).toBe(html(PanelHeader, { kicker: "Tasarımcı", title: "Alım", meta: "Taslak" }));
  });
});
```

```ts
// src/i18n/panel-copy.test.ts
import { describe, expect, it } from "vitest";
import managerTr from "@/i18n/messages/manager.tr.json";

/** K9: the panel's shared screens speak "sen"; exam-only screens keep "siz" until a plan touches them. */
const FORMAL = [/(?<!\p{L})siz(?!\p{L})/u, /\p{L}+(?:iniz|ınız|unuz|ünüz)(?!\p{L})/u, /\p{L}+(?:nizi|nızı|nuzu|nüzü)(?!\p{L})/u, /lütfen/iu, /\p{L}+(?:yiniz|yınız|abilirsiniz|ebilirsiniz)(?!\p{L})/u];
const strings = (value: unknown): string[] => (typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : []);

describe("shared panel copy (K9)", () => {
  it.each([["errorPage", managerTr.errorPage], ["nav", managerTr.nav]] as const)("%s speaks sen", (_name, namespace) => {
    for (const text of strings(namespace)) for (const pattern of FORMAL) expect(text).not.toMatch(pattern);
  });
});
```

Run: `pnpm exec vitest run src/solutions/registry.test.ts src/components/manager/panel-header.test.ts src/i18n/panel-copy.test.ts`
Expected: FAIL (no icon; no `PanelHeader`; `errorPage` says "Rolünüz", "yetkiniz", "dönebilirsiniz").

- [ ] **Step 3: Icons in the registry**

`src/solutions/types.ts:21`:

```ts
/** P1: the menu item's icon, by name (the menu is a client component; it maps the name to a lucide icon). */
export type NavIcon = "sun" | "briefcase" | "users" | "file-text" | "library" | "id-card" | "target" | "settings";
export type NavLink = { href: string; label: I18nLabel; icon: NavIcon };
```

`src/solutions/registry.ts`: `NavGroupView.items` becomes `Array<{ href: string; label: string; icon: NavIcon }>` (import `NavIcon` from `@/solutions/types` next to `I18nLabel`); in `buildNav` the shared items become `{ href: "/dashboard", label: shared.today, icon: "sun" }`, `{ href: "/library/positions", label: shared.library.positions, icon: "id-card" }`, `{ href: "/library/competencies", label: shared.library.competencies, icon: "target" }`, `{ href: "/settings", label: shared.settings, icon: "settings" }`, and solution items `m.nav.map((n) => ({ href: n.href, label: n.label[locale], icon: n.icon }))`.

`src/solutions/hiring/manifest.ts:14`: `nav: [{ href: "/hiring/openings", label: { tr: "Alımlar", en: "Openings" }, icon: "briefcase" }],`

`src/solutions/language-exam/manifest.ts:13-17`:

```ts
  nav: [
    { href: "/exam/students", label: { tr: "Öğrenciler", en: "Students" }, icon: "users" },
    { href: "/exam/exams", label: { tr: "Sınavlar", en: "Exams" }, icon: "file-text" },
    { href: "/exam/bank", label: { tr: "Soru bankası", en: "Question bank" }, icon: "library" },
  ],
```

`src/components/manager/nav.tsx`: after `import { usePathname } from "next/navigation";` add

```ts
import { Briefcase, FileText, IdCard, Library, Settings, Sun, Target, Users, type LucideIcon } from "lucide-react";
```

after `import type { NavGroupView } from "@/solutions/registry";` add

```ts
import type { NavIcon } from "@/solutions/types";

const ICONS: Record<NavIcon, LucideIcon> = { sun: Sun, briefcase: Briefcase, users: Users, "file-text": FileText, library: Library, "id-card": IdCard, target: Target, settings: Settings };
```

and in the items' `map` callback (`:68-79`) add `const Icon = ICONS[item.icon];` under `const active = …`, and render `<Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />` inside the `<Link>` before `{item.label}`. The active look (`ACTIVE`, `:32-36`) stays: brand-soft ground, accent text, the 2px line.

`src/solutions/types.ts` is in the ESLint allow list for core (`@/solutions/types`), so `nav.tsx` may import `NavIcon`.

- [ ] **Step 4: `RowMenu` and `PanelHeader`**

```tsx
// src/components/manager/row-menu.tsx
// kademe-owned
"use client";

import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type RowMenuItem = { label: string; detail?: string; href?: string; onSelect?: () => void; disabledReason?: string };

/**
 * P2, P5: the secondary actions of a header, a card or a table row behind
 * "⋯". A closed item shows its reason inside the menu (RULES 5); an item that
 * leads somewhere is a real link.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const body = (item: RowMenuItem) => (
    <span className="flex flex-col items-start">
      <span>{item.label}</span>
      {item.disabledReason || item.detail ? <span className="text-[12px] leading-4 text-muted">{item.disabledReason ?? item.detail}</span> : null}
    </span>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" aria-label={label}>
          <Ellipsis className="size-4" strokeWidth={1.75} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {items.map((item) =>
          item.disabledReason ? (
            <DropdownMenuItem key={item.label} disabled>
              {body(item)}
            </DropdownMenuItem>
          ) : item.href ? (
            <DropdownMenuItem key={item.label} asChild>
              <Link href={item.href}>{body(item)}</Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
              {body(item)}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

```tsx
// src/components/manager/panel-header.tsx
// kademe-owned
import type { ReactNode } from "react";
import { RowMenu, type RowMenuItem } from "./row-menu";

/**
 * P2: a page's head: kicker, title (26/32, 600), one meta line, at most one
 * filled action, everything else behind "⋯". The exam pages draw it through
 * PageHead, the hiring and library pages through PageTitle.
 */
export function PanelHeader({
  kicker,
  title,
  meta,
  primary,
  menu,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  primary?: ReactNode;
  menu?: { label: string; items: RowMenuItem[] };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <div className="mb-1 text-[13px] text-muted">{kicker}</div> : null}
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {meta ? <div className="mt-1 text-[14px] leading-[22px] text-muted">{meta}</div> : null}
      </div>
      {primary || menu ? (
        <div className="flex items-start gap-2">
          {menu ? <RowMenu label={menu.label} items={menu.items} /> : null}
          {primary ? <div className="flex flex-col items-end gap-1">{primary}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
```

`src/components/panel/bits.tsx`: add `import { PanelHeader } from "@/components/manager/panel-header";` after the `StudentStatus` import (`:2`) and replace `PageHead` (`:39-49`) with:

```tsx
/** The exam pages' head: since plan 2b the shared PanelHeader (P2); same title, sub line and action. */
export function PageHead({ title, sub, action }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return <PanelHeader title={title} meta={sub} primary={action} />;
}
```

`src/components/manager/page-title.tsx` becomes:

```tsx
import { PanelHeader } from "./panel-header";

/** Page heading for the hiring and library screens (HIRING-UX 8.4): the shared PanelHeader (P2). */
export function PageTitle({ title, sub, action, eyebrow }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return <PanelHeader kicker={eyebrow} title={title} meta={sub} primary={action} />;
}
```

(`PageTitle` used `<p>` for `sub`; `PanelHeader` uses `<div>` so a `sub` holding block elements, as `opening-header.tsx:54-61` passes, is valid HTML now.)

- [ ] **Step 5: Copy**

`manager.tr.json` `errorPage` (EN unchanged, it has no formal address):

| Key | TR (new) |
|---|---|
| `forbiddenTitle` | Rolün bunu yapamaz |
| `forbiddenBody` | Bu ekran ya da işlem için yetkin yok. Değerlendirici rolü yazma ve konuşma cevaplarını puanlar; sınav, banka ve davet işlemleri öğretmen ve sahip rollerine açıktır. |
| `genericBody` | Sayfa yüklenirken beklenmeyen bir hata oluştu. Yeniden deneyebilir ya da panele dönebilirsin. |

`nav.more` new: TR "Diğer işlemler", EN "More actions" (the `⋯` trigger's name; Task 20's overview menu uses it, ruling C18).

- [ ] **Step 6: Run tests and gates**

Run: `pnpm exec vitest run src/solutions src/components/manager src/components/panel src/i18n && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -5`
Expected: PASS and clean (the `legacy-routes.test.ts` that calls `buildNav` keeps passing: it reads hrefs; `src/solutions/boundary.test.ts` stays green: no hiring file imports `@/components/panel/`).

- [ ] **Step 7: The exam still passes**

With the dev server on 3100 over `kademe_platform` (stop the `kademe_ui_check` server first, or use another shell and check the port):

```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam 2>&1 | tail -3
```

Expected: every check `ok`, "All checks passed".

- [ ] **Step 8: After screenshots and text comparison**

Back on `kademe_ui_check` with this task's code (Claude in Chrome, logged in through `/login`), repeat Step 1 into `shots/p2b-t14-after-*`. For every page: `diff shots/p2b-t14-before-<page>.txt shots/p2b-t14-after-<page>.txt` prints nothing (icons are `aria-hidden`; words unchanged). Look at each before/after pair: only the menu icons and the title's weight differ. 1024: the menu still becomes the sheet below 1024px (unchanged). Keyboard: Tab through the menu, the focus ring is visible on each item, the icons are not focusable. Drop the copy.

- [ ] **Step 9: Commit**

```bash
git add src/solutions/types.ts src/solutions/registry.ts src/solutions/registry.test.ts src/solutions/hiring/manifest.ts src/solutions/language-exam/manifest.ts src/components/manager/nav.tsx src/components/manager/row-menu.tsx src/components/manager/panel-header.tsx src/components/manager/panel-header.test.ts src/components/panel/bits.tsx src/components/manager/page-title.tsx src/i18n/messages/manager.tr.json src/i18n/messages/manager.en.json src/i18n/panel-copy.test.ts
git commit -m "Give the panel menu icons and one page header

Every menu item draws its icon (P1; counts wait for plan 3). PageHead
(exam pages) and PageTitle (hiring, library) both render the new
PanelHeader with a slot for the ⋯ menu (RowMenu), in components/manager
(boundary.test keeps hiring out of components/panel). The panel's error
page speaks sen (K9). Exam pages: same words and actions, only the icons
and the title weight change (before/after page text identical,
verify:exam ok). registry.test: the menu test also expects the icons.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 15: M1 part 2 and M-W, `EmptyState`, the one status dictionary, and the guided-flow shell (`GuidedFlow`, `SummaryRows`)

**Files:**
- Create: `src/components/manager/empty-state.tsx`, `src/components/manager/empty-state.test.ts`
- Create: `src/components/hiring/status-vocabulary.ts`, `src/components/hiring/status-vocabulary.test.ts`
- Modify: `src/app/(manager)/hiring/openings/[id]/opening-header.tsx:3-5` (import), `:13-14` (`TONE` from the dictionary)
- Modify: `src/components/hiring/candidates/candidate-table.tsx:10-12` (import, `TONE` removed), `:101` (tone and strong word from the dictionary)
- Create: `src/components/manager/flow-model.ts`, `src/components/manager/flow-model.test.ts` (the pure model of every flow)
- Create: `src/components/manager/guided-flow.tsx`, `src/components/manager/summary-rows.tsx`, `src/components/manager/guided-flow.test.ts`
- Modify: `src/i18n/messages/manager.tr.json`, `manager.en.json` (new namespace `flow`), `src/i18n/panel-copy.test.ts` (`flow` joins the "sen" check)

**Shared with the exam:** none (`EmptyState` is new and used by Tasks 17 and 18; the exam's status tones in `bits.tsx` are not touched; `GuidedFlow` is never used on an exam page, design 4.12).

**Decision in this task:** the delta's `guided-flow.ts` model is named `flow-model.ts`. A `guided-flow.ts` next to `guided-flow.tsx` would make `@/components/manager/guided-flow` resolve to the `.ts` file (TypeScript tries `.ts` before `.tsx`), so the component could not be imported by its name.

**Interfaces:**
- Consumes: `Illustration`, `IllustrationName` (Task 3); `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyContent` (`@/components/ui/empty`); `StepScreen` (`{ layout; title; titleRef; lead; width?: 640 | 760 | 1000; enter? }`, `src/components/visual/step-screen.tsx:15-38`), `StepFooter` (`{ primary; secondary; back: { label; onClick?; href? }; journey: { steps; current; label }; note; placement: "sticky" }`, `step-footer.tsx:58-73`), `FooterAction` (`footer-action.ts:8-10`), `useStepFocus` (`src/hooks/use-step-focus.ts`), `subscribeHash`, `pushHash`, `leaveHashStep` (`src/lib/client/hash-step.ts`, the one hash helper of ruling C16).
- Produces:
  - `EmptyState(props: { illustration: IllustrationName; title: ReactNode; body?: ReactNode; action?: ReactNode; secondary?: ReactNode; className?: string })`
  - `OPENING_STATUS: Record<"DRAFT" | "OPEN" | "CLOSED", { tone: StatusTone; strong: boolean }>`, `CANDIDATE_STATUS: Record<CandidateProgress, { tone: StatusTone; strong: boolean }>`
  - `flow-model.ts`: `type FlowJourney = { steps: number; current: number }`; `flowStepOf<S extends string>(hash: string, input: { steps: readonly S[]; firstInvalid: S | null }): S`; `flowJourney<S extends string>(path: readonly S[], current: S, fallback?: S): FlowJourney`; `exitKey(dirty: boolean): "exit" | "exitUnsaved"`; `sameValue(a: unknown, b: unknown): boolean`; `summaryRows<T extends object, K extends keyof T & string>(before: T, after: T, fields: readonly K[]): Array<{ field: K; changed: boolean }>`; `isDirty(before, after, fields): boolean`; `stepOfProblem<P extends string, S extends string>(map: Partial<Record<P, S>>, problem: P): S | null`; `saveWait(changed: boolean): "noChanges" | null`
  - `guided-flow.tsx`: `type FlowStep = { id: string; title: ReactNode; lead?: ReactNode; layout: "single" | "split"; body: ReactNode; primary: FooterAction; secondary?: FooterAction | null; note?: ReactNode }`; `type FlowExit = { dirty: boolean; href: string } | { dirty: boolean; onClick: () => void }`; `useFlowStep<S extends string>(input: { steps: readonly S[]; firstInvalid: S | null; mode: "hash" | "memory" }): { step: S; moved: boolean; go(to: S): void; back(to?: S): void }`; `FlowHeader(props: { kicker: ReactNode; exit: FlowExit })`; `GuidedFlow(props: { kicker: ReactNode; step: FlowStep; journey: FlowJourney | null; back: { label: string; onClick?: () => void; href?: string } | null; exit?: FlowExit | null; enter?: boolean; container?: "page" | "sheet" })`
  - `summary-rows.tsx`: `type SummaryRow = { id: string; icon?: LucideIcon; label: ReactNode; value: ReactNode; detail?: ReactNode; changed?: boolean; problem?: ReactNode; edit?: { href: string } | { onClick: () => void } | null }`; `SummaryRows(props: { rows: SummaryRow[]; readOnly?: boolean; changeLabel: string; changedLabel: string })` (no hooks: server pages and client flows both draw it)

Tasks 19 (Alım aç), 20 (publish summary, rules card), 21 (team and rules) and 22 (invite) consume these names exactly.

- [ ] **Step 1: Failing tests (empty state and the dictionary)**

```ts
// src/components/hiring/status-vocabulary.test.ts
import { describe, expect, it } from "vitest";
import { CANDIDATE_STATUS, OPENING_STATUS } from "./status-vocabulary";

describe("one status dictionary (P9): the same dot and word everywhere, accent only for what is live", () => {
  it("opening: Taslak grey, Yayında accent, Kapalı the quietest grey", () => {
    expect(OPENING_STATUS).toEqual({ DRAFT: { tone: "neutral", strong: false }, OPEN: { tone: "active", strong: false }, CLOSED: { tone: "warn", strong: false } });
  });

  it("candidate: in progress is the only accent; an expired link is ink and bold", () => {
    expect(CANDIDATE_STATUS).toEqual({
      INVITED: { tone: "neutral", strong: false },
      OPENED: { tone: "neutral", strong: false },
      IN_PROGRESS: { tone: "active", strong: false },
      COMPLETED: { tone: "done", strong: false },
      EXPIRED: { tone: "warn", strong: true },
    });
  });
});
```

```ts
// src/components/manager/empty-state.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState (P4)", () => {
  it("is a drawing, a title, one sentence and one action, never a dead end", () => {
    const out = renderToStaticMarkup(
      createElement(EmptyState, { illustration: "emptyOpenings", title: "İlk alımını aç.", body: "İlan metnini yapıştırman yeterli.", action: createElement("a", { href: "/hiring/openings/new" }, "Alım aç") }),
    );
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(out).toContain("İlk alımını aç.");
    expect(out).toContain("İlan metnini yapıştırman yeterli.");
    expect(out).toContain('href="/hiring/openings/new"');
  });
});
```

Run: `pnpm exec vitest run src/components/hiring/status-vocabulary.test.ts src/components/manager/empty-state.test.ts`
Expected: FAIL, modules missing.

- [ ] **Step 2: Implementation (empty state and the dictionary)**

```ts
// src/components/hiring/status-vocabulary.ts
import type { StatusTone } from "@/components/ui/status-dot";
import type { CandidateProgress } from "@/solutions/hiring/rules/invitation";

/**
 * HIRING-VISUAL-FLOW P9: one dictionary for every place an opening or a
 * candidate shows its status (dot plus word, never a badge). Accent only for
 * what is live (OPEN, IN_PROGRESS); a closed opening is the quietest grey; an
 * expired link is the one status said in bold ink, because someone must act.
 */
type Entry = { tone: StatusTone; strong: boolean };

export const OPENING_STATUS: Record<"DRAFT" | "OPEN" | "CLOSED", Entry> = {
  DRAFT: { tone: "neutral", strong: false },
  OPEN: { tone: "active", strong: false },
  CLOSED: { tone: "warn", strong: false },
};

export const CANDIDATE_STATUS: Record<CandidateProgress, Entry> = {
  INVITED: { tone: "neutral", strong: false },
  OPENED: { tone: "neutral", strong: false },
  IN_PROGRESS: { tone: "active", strong: false },
  COMPLETED: { tone: "done", strong: false },
  EXPIRED: { tone: "warn", strong: true },
};
```

```tsx
// src/components/manager/empty-state.tsx
// kademe-owned
import type { ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Illustration, type IllustrationName } from "@/components/visual/illustrations";
import { cn } from "@/lib/cn";

/** P4: an empty list says what it is and leads on: a drawing, a title, one sentence, one action (a text link may follow). */
export function EmptyState({
  illustration,
  title,
  body,
  action,
  secondary,
  className,
}: {
  illustration: IllustrationName;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("border border-line bg-surface py-14", className)}>
      <Illustration name={illustration} size="spot" />
      <EmptyHeader>
        <EmptyTitle className="text-[18px] leading-7 font-semibold text-ink">{title}</EmptyTitle>
        {body ? <EmptyDescription className="text-[14px] leading-[22px] text-muted">{body}</EmptyDescription> : null}
      </EmptyHeader>
      {action || secondary ? (
        <EmptyContent>
          {action}
          {secondary}
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
```

`opening-header.tsx`: add `import { OPENING_STATUS } from "@/components/hiring/status-vocabulary";` after the `RouteTabs` import (`:5`), and `:13-14` becomes:

```ts
/** An opening's status dot, shared by the list and the opening pages (ruling C13), from the one dictionary (P9). */
export const TONE: Record<OpeningStatus, StatusTone> = { DRAFT: OPENING_STATUS.DRAFT.tone, OPEN: OPENING_STATUS.OPEN.tone, CLOSED: OPENING_STATUS.CLOSED.tone };
```

`candidate-table.tsx`: delete `const TONE = {...} as const;` (`:12`), add `import { CANDIDATE_STATUS } from "@/components/hiring/status-vocabulary";` before the `NewLinkButton` import (`:10`), and the status cell (`:101`) becomes:

```tsx
              <StatusDot tone={CANDIDATE_STATUS[row.progress].tone} className={CANDIDATE_STATUS[row.progress].strong ? "font-semibold text-ink" : undefined}>
                {t(`hiringCandidates.progress${row.progress}`)}
              </StatusDot>
```

- [ ] **Step 3: Failing tests (the guided-flow shell)**

```ts
// src/components/manager/flow-model.test.ts
import { describe, expect, it } from "vitest";
import { exitKey, flowJourney, flowStepOf, isDirty, saveWait, sameValue, stepOfProblem, summaryRows } from "./flow-model";

const steps = ["members", "decider", "min", "review"] as const;

describe("the step in the address (W3)", () => {
  it("opens the step the hash names, and the first step for no hash or an unknown one", () => {
    expect(flowStepOf("#decider", { steps, firstInvalid: null })).toBe("decider");
    expect(flowStepOf("", { steps, firstInvalid: null })).toBe("members");
    expect(flowStepOf("#nothing", { steps, firstInvalid: null })).toBe("members");
  });

  it("never skips a decision: a step past the first one not ready opens that one", () => {
    expect(flowStepOf("#review", { steps, firstInvalid: "decider" })).toBe("decider");
    expect(flowStepOf("#min", { steps, firstInvalid: "decider" })).toBe("decider");
    // A step before the gap, or the gap itself, opens as asked.
    expect(flowStepOf("#members", { steps, firstInvalid: "decider" })).toBe("members");
    expect(flowStepOf("#decider", { steps, firstInvalid: "decider" })).toBe("decider");
  });
});

describe("the journey and the exit (W2, W7)", () => {
  it("counts the main path, and a step outside it keeps the place of the step it came from", () => {
    expect(flowJourney(["person", "summary"], "person")).toEqual({ steps: 2, current: 1 });
    expect(flowJourney(["opening", "person", "summary"], "summary")).toEqual({ steps: 3, current: 3 });
    expect(flowJourney<string>(["person", "summary"], "language", "summary")).toEqual({ steps: 2, current: 2 });
  });

  it("says 'Kaydetmeden çık' only while something typed would be lost", () => {
    expect(exitKey(false)).toBe("exit");
    expect(exitKey(true)).toBe("exitUnsaved");
  });
});

describe("the summary (W5, P8)", () => {
  const saved = { memberIds: ["a", "b"], decisionMakerId: "d", minEvaluations: 2, deadline: null as string | null };

  it("marks only the rows whose value changed; the same people in another order is no change", () => {
    const now = { ...saved, memberIds: ["b", "a"], minEvaluations: 3 };
    expect(summaryRows(saved, now, ["memberIds", "decisionMakerId", "minEvaluations"])).toEqual([
      { field: "memberIds", changed: false },
      { field: "decisionMakerId", changed: false },
      { field: "minEvaluations", changed: true },
    ]);
    expect(isDirty(saved, now, ["memberIds"])).toBe(false);
    expect(isDirty(saved, now, ["memberIds", "minEvaluations"])).toBe(true);
  });

  it("compares lists as sets and everything else strictly", () => {
    expect(sameValue(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameValue(["a"], ["a", "b"])).toBe(false);
    expect(sameValue(null, "")).toBe(false);
    expect(sameValue(Number.NaN, Number.NaN)).toBe(true);
  });

  it("waits with 'Değişiklik yok.' while nothing changed", () => {
    expect(saveWait(false)).toBe("noChanges");
    expect(saveWait(true)).toBeNull();
  });
});

describe("a refusal opens its step (W8)", () => {
  it("maps a problem to its step, and leaves an unmapped one on the summary", () => {
    const map = { NAME: "person", DEADLINE_PAST: "deadline" } as const;
    expect(stepOfProblem<"NAME" | "DEADLINE_PAST" | "CLOSED", string>(map, "NAME")).toBe("person");
    expect(stepOfProblem<"NAME" | "DEADLINE_PAST" | "CLOSED", string>(map, "CLOSED")).toBeNull();
  });
});
```

```ts
// src/components/manager/guided-flow.test.ts
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { Users } from "lucide-react";
import { describe, expect, it } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";
import { GuidedFlow } from "./guided-flow";
import { SummaryRows } from "./summary-rows";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;
const noop = () => undefined;

const flow = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(
      Provider,
      { locale: "tr", messages: managerMessagesFor("tr"), timeZone: "Europe/Istanbul" },
      createElement(GuidedFlow as never, {
        kicker: "Ekip ve kurallar · Ekip",
        step: { id: "team-decider", title: "Kararı kim verecek?", layout: "split", body: createElement("p", null, "kartlar"), primary: { kind: "button", id: "flow-next", label: "Devam et", onClick: noop } },
        journey: { steps: 4, current: 2 },
        back: { label: "Geri", onClick: noop },
        exit: { dirty: false, onClick: noop },
        ...props,
      } as never),
    ),
  );

describe("GuidedFlow (K12, W1-W10)", () => {
  it("asks one question with one filled button, the heading ready to take the focus, and says where the step is", () => {
    const out = flow({});
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Kararı kim verecek\?<\/h1>/);
    expect(out).toContain("Adım 2 / 4");
    expect(out).toContain("Ekip ve kurallar · Ekip");
    expect(out).toContain(">Çık<");
  });

  it("says 'Kaydetmeden çık' while values changed, and never asks (no dialog)", () => {
    const out = flow({ exit: { dirty: true, href: "/hiring/openings" } });
    expect(out).toContain("Kaydetmeden çık");
    expect(out).not.toContain(">Çık<");
    expect(out).not.toMatch(/role="(alert)?dialog"/);
  });

  it("in a Sheet: a compact heading, no exit link of its own (the Sheet's close button is the exit)", () => {
    const out = flow({ container: "sheet", exit: null });
    expect(out).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Kararı kim verecek\?<\/h2>/);
    expect(out).not.toContain(">Çık<");
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
  });
});

describe("SummaryRows (W5, P8)", () => {
  const rows = [
    { id: "team", icon: Users, label: "Ekip", value: "Kadir Ay · Ece Yıldız", changed: true, edit: { onClick: noop } },
    { id: "min", label: "Kaç değerlendirme", value: "2", edit: { href: "/hiring/openings/o/settings#team-min" } },
  ];
  const render = (readOnly: boolean) => renderToStaticMarkup(createElement(SummaryRows, { rows, readOnly, changeLabel: "Değiştir", changedLabel: "değişti" }));

  it("marks a changed row and offers 'Değiştir' per row, a hash link as a plain anchor", () => {
    const out = render(false);
    expect(out.match(/· değişti/g)).toHaveLength(1);
    expect(out.match(/Değiştir<span class="sr-only">/g)).toHaveLength(2);
    expect(out).toContain('href="/hiring/openings/o/settings#team-min"');
  });

  it("read only: the same values, no 'Değiştir'", () => {
    const out = render(true);
    expect(out).toContain("Kadir Ay · Ece Yıldız");
    expect(out).not.toContain("Değiştir");
  });
});
```

In `src/i18n/panel-copy.test.ts`, the `it.each` list becomes `[["errorPage", managerTr.errorPage], ["nav", managerTr.nav], ["flow", managerTr.flow]] as const`.

Run: `pnpm exec vitest run src/components/manager/flow-model.test.ts src/components/manager/guided-flow.test.ts src/i18n/panel-copy.test.ts`
Expected: FAIL for the two new files (modules missing). `panel-copy.test.ts` still passes here because `strings(undefined)` is empty; `pnpm exec tsc --noEmit` reports `managerTr.flow` missing until Step 5 adds the namespace.

- [ ] **Step 4: The model, the shell and the summary rows**

```ts
// src/components/manager/flow-model.ts
/**
 * HIRING-VISUAL-FLOW 4.2 (W1-W10, K12): the pure core every guided flow of the
 * panel shares. A flow is a list of step ids; the step lives in the address's
 * hash (W3) or, inside a Sheet whose page owns the hash, in memory. Nothing
 * here touches the browser, so each rule has a test.
 */
export type FlowJourney = { steps: number; current: number };

/**
 * W3: the step the address asks for. An unknown hash opens the first step; a
 * step past the first one that is not ready yet opens that one instead (the
 * browser's forward button or a copied link never skips a decision).
 * `firstInvalid` must be one of `steps` (or null when every step is ready).
 */
export function flowStepOf<S extends string>(hash: string, input: { steps: readonly S[]; firstInvalid: S | null }): S {
  const asked = input.steps.find((s) => `#${s}` === hash) ?? input.steps[0];
  const stop = input.firstInvalid;
  if (stop !== null && input.steps.includes(stop) && input.steps.indexOf(asked) > input.steps.indexOf(stop)) return stop;
  return asked;
}

/**
 * W2, W10: "Adım n / N" for the footer. `path` is the main path the journey
 * counts; a step outside it (opened with "Değiştir" from a summary) shows the
 * place of `fallback`, so the bar never jumps back.
 */
export function flowJourney<S extends string>(path: readonly S[], current: S, fallback?: S): FlowJourney {
  const at = path.indexOf(current);
  const index = at >= 0 ? at : fallback !== undefined ? path.indexOf(fallback) : -1;
  return { steps: path.length, current: index + 1 };
}

/** W7, H6: the exit link says what leaving costs; it never asks. */
export const exitKey = (dirty: boolean): "exit" | "exitUnsaved" => (dirty ? "exitUnsaved" : "exit");

/** One decision compared with its saved value: a list is a set (choosing the same people in another order is no change); anything else strictly. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v) => b.includes(v)) && b.every((v) => a.includes(v));
  return Object.is(a, b);
}

/** P8, W5: one summary row per field of a flow, marked when it differs from what is saved. */
export function summaryRows<T extends object, K extends keyof T & string>(before: T, after: T, fields: readonly K[]): Array<{ field: K; changed: boolean }> {
  return fields.map((field) => ({ field, changed: !sameValue(before[field], after[field]) }));
}

/** W7: something in this flow differs from what is saved. */
export const isDirty = <T extends object, K extends keyof T & string>(before: T, after: T, fields: readonly K[]): boolean => summaryRows(before, after, fields).some((r) => r.changed);

/** W8: the step a server problem belongs to; null keeps it on the summary (rights, a closed opening, a lost connection). */
export function stepOfProblem<P extends string, S extends string>(map: Partial<Record<P, S>>, problem: P): S | null {
  return map[problem] ?? null;
}

/** P8: "Kaydet" waits with "Değişiklik yok." while nothing changed. */
export const saveWait = (changed: boolean): "noChanges" | null => (changed ? null : "noChanges");
```

```tsx
// src/components/manager/guided-flow.tsx
// kademe-owned
"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { FooterAction } from "@/components/visual/footer-action";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { useStepFocus } from "@/hooks/use-step-focus";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import { leaveHashStep, pushHash, subscribeHash } from "@/lib/client/hash-step";
import { exitKey, flowStepOf, type FlowJourney } from "./flow-model";

/** One screen of a guided flow (W1): one question as its title, its one decision as the body, the footer's one filled button. */
export type FlowStep = {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  layout: "single" | "split";
  body: ReactNode;
  primary: FooterAction;
  secondary?: FooterAction | null;
  /** Under the footer's bar: a refusal in the server's words, a "Düzelt ›" link. */
  note?: ReactNode;
};

/** W7: where leaving goes, and whether something typed would be lost (the label says so; nothing asks). */
export type FlowExit = { dirty: boolean; href: string } | { dirty: boolean; onClick: () => void };

const currentHash = () => window.location.hash;
const noHash = () => "";
const LINK =
  "inline-flex min-h-11 items-center text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";

/**
 * W3, W4: the step of a flow. On a page it lives in the address's hash (the
 * browser's back button steps back, a reload opens the same step, a link can
 * open a step); inside a Sheet, whose page owns the hash, it lives in memory.
 * The values live in the caller's one state, so no step change loses one.
 * `moved` turns true at the first step change on this page (2.3: the first
 * load never animates).
 */
export function useFlowStep<S extends string>(input: { steps: readonly S[]; firstInvalid: S | null; mode: "hash" | "memory" }) {
  const hash = useSyncExternalStore(subscribeHash, currentHash, noHash);
  const [memory, setMemory] = useState<S>(input.steps[0]);
  const [moved, setMoved] = useState(false);
  const mode = input.mode;
  // The browser's own back and forward buttons are a step change too.
  useEffect(() => (mode === "hash" ? subscribeHash(() => setMoved(true)) : undefined), [mode]);
  const step = flowStepOf(mode === "hash" ? hash : `#${memory}`, input);
  return {
    step,
    moved,
    go(to: S) {
      setMoved(true);
      if (mode === "hash") pushHash(`#${to}`);
      else setMemory(to);
    },
    /** The footer's "Geri": the browser's back on a page; in memory, the step named (or the one before). */
    back(to?: S) {
      setMoved(true);
      if (mode === "hash") leaveHashStep();
      else setMemory(to ?? input.steps[Math.max(0, input.steps.indexOf(step) - 1)]);
    },
  };
}

/** W2, W7: the flow's name on the left, the way out on the right ("Çık", or "Kaydetmeden çık" while values changed). */
export function FlowHeader({ kicker, exit }: { kicker: ReactNode; exit: FlowExit }) {
  const t = useMT("flow");
  const label = t(exitKey(exit.dirty));
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-2">
      <p className="min-w-0 truncate text-[14px] leading-[22px] text-muted">{kicker}</p>
      {"href" in exit ? (
        <Link href={exit.href} className={LINK}>
          {label}
        </Link>
      ) : (
        <button type="button" onClick={exit.onClick} className={LINK}>
          {label}
        </button>
      )}
    </div>
  );
}

/**
 * K12, W1-W10: a multi-field job as a guided flow inside the panel (the side
 * menu stays, D12). One step at a time: its question as the heading (focused on
 * every step change), its one decision, and the sticky footer with "‹ Geri",
 * "Adım n / N" and the one filled button. On a page the step is a StepScreen
 * (single 640px for fields, split for choices and summaries); in a Sheet
 * (480px) it is a compact column, and the Sheet's own close button is the
 * exit (W7). Never used on the exam's pages (4.12).
 */
export function GuidedFlow({
  kicker,
  step,
  journey,
  back,
  exit,
  enter = false,
  container = "page",
}: {
  kicker: ReactNode;
  step: FlowStep;
  journey: FlowJourney | null;
  back: { label: string; onClick?: () => void; href?: string } | null;
  /** Required on a page; a Sheet closes through its own button. */
  exit?: FlowExit | null;
  /** True once the step changed in place (useFlowStep's `moved`): only then the step fades in. */
  enter?: boolean;
  container?: "page" | "sheet";
}) {
  const t = useMT("flow");
  const heading = useStepFocus<HTMLHeadingElement>(step.id);
  const label = journey && journey.current > 0 ? t("stepLabel", { n: journey.current, total: journey.steps }) : null;
  const footer = (
    <StepFooter
      placement="sticky"
      primary={step.primary}
      secondary={step.secondary ?? null}
      back={back}
      journey={journey && label ? { steps: journey.steps, current: journey.current, label } : null}
      note={step.note}
    />
  );
  // W10: the position is said once per step, politely; the heading takes the focus.
  const position = label ? (
    <p aria-live="polite" className="sr-only">
      {label}
    </p>
  ) : null;
  if (container === "sheet") {
    return (
      <div className="flex min-h-full flex-col">
        <section key={step.id} className={cn("flex-1 space-y-4 pt-2 pb-6", enter && "motion-safe:animate-[step-in_200ms_ease-out] motion-reduce:animate-[fade-in_200ms_ease-out]")}>
          <h2 ref={heading} tabIndex={-1} className="text-[20px] leading-7 font-semibold text-ink outline-none">
            {step.title}
          </h2>
          {step.lead ? <div className="text-[14px] leading-[22px] text-ink-2">{step.lead}</div> : null}
          <div>{step.body}</div>
        </section>
        {position}
        {footer}
      </div>
    );
  }
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      {exit ? <FlowHeader kicker={kicker} exit={exit} /> : null}
      <div className="flex-1">
        <StepScreen key={step.id} layout={step.layout} width={step.layout === "single" ? 640 : 1000} title={step.title} titleRef={heading} lead={step.lead} enter={enter}>
          {step.body}
        </StepScreen>
      </div>
      {position}
      {footer}
    </div>
  );
}
```

```tsx
// src/components/manager/summary-rows.tsx
// kademe-owned
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SummaryRow = {
  id: string;
  icon?: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  /** P8: the value differs from the saved one. */
  changed?: boolean;
  /** W8: why this row stops the save, in the existing words. */
  problem?: ReactNode;
  /** "Değiştir ›": a step of this flow (onClick) or a page that changes it (href; a link with a hash is a plain anchor, so the page hears the hash change). */
  edit?: { href: string } | { onClick: () => void } | null;
};

const ACTION =
  "inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";

/**
 * W5, P8: a flow's summary and a read-only control card (the opening's rules,
 * the publish summary): one row per decision with its value, "değişti" when it
 * differs from the saved value (ink, not bold, no dot), and "Değiştir ›" to the
 * step or page that changes it. `readOnly` drops every "Değiştir" (a reviewer,
 * a closed opening). No hooks: server pages and client flows both draw it.
 */
export function SummaryRows({ rows, readOnly = false, changeLabel, changedLabel }: { rows: SummaryRow[]; readOnly?: boolean; changeLabel: string; changedLabel: string }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const Icon = row.icon;
        const edit = readOnly ? null : (row.edit ?? null);
        const words = (
          <>
            {changeLabel}
            <span className="sr-only">: {row.label}</span>
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </>
        );
        return (
          <li key={row.id} className="flex items-start gap-4 py-4">
            {Icon ? (
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-ink">
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-5 text-muted">{row.label}</p>
              <p className="mt-0.5 text-[15px] leading-6 break-words text-ink">
                {row.value}
                {row.changed ? <span className="ml-2 text-[13px] font-normal text-ink">· {changedLabel}</span> : null}
              </p>
              {row.detail ? <p className="mt-0.5 text-[13px] leading-5 text-muted">{row.detail}</p> : null}
              {row.problem ? <p className="mt-1 text-[13px] leading-5 font-medium text-ink">{row.problem}</p> : null}
            </div>
            {edit === null ? null : "onClick" in edit ? (
              <button type="button" onClick={edit.onClick} className={ACTION}>
                {words}
              </button>
            ) : edit.href.includes("#") ? (
              <a href={edit.href} className={ACTION}>
                {words}
              </a>
            ) : (
              <Link href={edit.href} className={ACTION}>
                {words}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

What the shell guarantees, for the flows of Tasks 19-22: one filled button (the step's `primary`, W6); the heading takes the focus on every step change and never on the first load (`useStepFocus`); the position is said once in a polite region (W10); the step is in the hash on a page and in memory in a Sheet (W3, D13); "Geri" and the browser's back keep every value, because the values live in the caller's one state (W4); leaving never asks, its words say what is lost (W7, H6).

- [ ] **Step 5: Copy (`flow`, new namespace in `manager.*.json`, "sen")**

| Key | TR | EN |
|---|---|---|
| `continue` | Devam et | Continue |
| `back` | Geri | Back |
| `backToSummary` | Özete dön | Back to the summary |
| `exit` | Çık | Leave |
| `exitUnsaved` | Kaydetmeden çık | Leave without saving |
| `change` | Değiştir | Change |
| `changed` | değişti | changed |
| `stepLabel` | Adım {n} / {total} | Step {n} / {total} |
| `noChanges` | Değişiklik yok. | Nothing has changed. |
| `skip` | Atla | Skip |

- [ ] **Step 6: Tests and gates**

Run: `pnpm exec vitest run src/components/hiring src/components/manager "src/app/(manager)/hiring" src/i18n && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4`
Expected: PASS and clean (`candidate-table.test.ts` reads rows, not tones; `boundary.test.ts` green).

- [ ] **Step 7: Browser check**

`kademe_ui_check` (Claude in Chrome, logged in through `/login`): `/hiring/openings?tab=closed` shows a closed opening's "Kapalı" with the light grey dot (close one first in Team and rules; was the darkest grey); the Candidates tab shows an expired link's "Link doldu" in bold ink and "Devam ediyor" with the accent dot. Screenshots at 1280. (`GuidedFlow` has no page of its own until Task 19; its render test stands for it here.)

- [ ] **Step 8: Commit**

```bash
git add src/components/manager/empty-state.tsx src/components/manager/empty-state.test.ts src/components/hiring/status-vocabulary.ts src/components/hiring/status-vocabulary.test.ts "src/app/(manager)/hiring/openings/[id]/opening-header.tsx" src/components/hiring/candidates/candidate-table.tsx src/components/manager/flow-model.ts src/components/manager/flow-model.test.ts src/components/manager/guided-flow.tsx src/components/manager/summary-rows.tsx src/components/manager/guided-flow.test.ts src/i18n/messages/manager.tr.json src/i18n/messages/manager.en.json src/i18n/panel-copy.test.ts
git commit -m "Add EmptyState, one status dictionary and the guided-flow shell

Empty lists get a drawing, a title, a sentence and an action (P4). Every
opening and candidate status reads its dot from one map (P9): a closed
opening is the quietest grey, an expired link is bold ink. GuidedFlow
(K12, W1-W10) draws one decision per step on StepScreen with the sticky
StepFooter, keeps the step in the hash (one helper, C16), moves the focus
to the heading on each step and says 'Kaydetmeden çık' while values
changed; SummaryRows marks what changed. The shared flow words speak sen.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 16: M2 part 1, Today's lanes, the next task (K10 with ruling C6) and hiring's own rows

**Files:**
- Modify: `src/solutions/types.ts:93-105` (`TodayTaskKind`; `TodayItem` lanes `attention` and `task`, and the optional `task`, `detail`, `attention`, `actionLabel`)
- Modify: `src/solutions/hiring/rules/invitation.ts:46` (`EXPIRING_SOON_MS` under `SURVEY_BATCH`, the one 48-hour window of ruling C16)
- Create: `src/lib/today.ts`, `src/lib/today.test.ts`
- Create: `src/solutions/hiring/server/today.ts`, `src/solutions/hiring/server/today.test.ts`
- Modify: `src/solutions/hiring/module.ts:18` (import), `:32-35` (`today: hiringToday`), `src/solutions/hiring/module.test.ts:23` (mock), `:44-47`
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (new `hiringToday`; `hiringCommon` gains the request, link and setup words the control views reuse)

**Shared with the exam:** `src/solutions/types.ts` (`TodayItem` gains optional fields and two lanes; the exam's `examToday` keeps returning `review` and `running` items, untouched); `src/lib/today.ts` is the queue's sort moved out of the dashboard page (the test pins that it is the same sort). The dashboard does not read the new lanes until Task 17, so nothing on screen changes in this task.

**Rulings applied:** C6 (the user's "yok plan 3 te gelsin", 2026-10-05): `hiringToday` makes a task of an accommodation request only; a data-rights request is counted in its opening's requests row, which carries a plain note that the panel cannot close it yet (no button leads anywhere it cannot be handled); `RANK` keeps `DATA_RIGHTS` first and `DECISION` third for plan 3. C21: the four reads run one after another. C16: the 48-hour window is `EXPIRING_SOON_MS`, which Task 18 reuses. v4 (4.3): the draft row's action reads "Kuruluma devam et" and opens the opening's overview, where the filled button opens the setup path's current step (Task 20).

**Interfaces:**
- Consumes: `can` (`@/lib/authorize`), `managerT` (`@/i18n/manager`), the fake database (`./test-fake-db`).
- Produces:
  - `type TodayTaskKind = "DATA_RIGHTS" | "ACCOMMODATION" | "DECISION"`; `TodayItem.lane: "review" | "running" | "attention" | "task"`; optional `task?: TodayTaskKind`, `detail?: string | null` (a task's quoted words; an attention row's plain note), `attention?: "requests" | "expiring" | "draft"`, `actionLabel?: string`
  - `EXPIRING_SOON_MS = 48 * 60 * 60 * 1000` (`@/solutions/hiring/rules/invitation`)
  - `reviewQueue(items: TodayItem[]): TodayItem[]`, `pickNextTask(items: TodayItem[]): TodayItem | null`, `attentionRows(items: TodayItem[]): TodayItem[]`, `todaySummary(items: TodayItem[]): { count: number; oldest: Date | null }` (`src/lib/today.ts`)
  - `hiringToday(orgId: string, userId: string, locale: Locale, now?: Date): Promise<TodayItem[]>`
  - Copy keys reused later: `hiringCommon.openRequests`, `rightsNote`, `expiringLinks`, `draftWaitingPublish`, `continueSetup` (Tasks 18, 20)

- [ ] **Step 1: Failing tests**

```ts
// src/lib/today.test.ts
import { describe, expect, it } from "vitest";
import type { TodayItem } from "@/solutions/types";
import { attentionRows, pickNextTask, reviewQueue, todaySummary } from "./today";

const at = (iso: string) => new Date(iso);
const item = (over: Partial<TodayItem>): TodayItem => ({ id: Math.random().toString(36), solution: "hiring", lane: "attention", title: "t", subtitle: null, href: "/x", sortAt: null, cells: [], ...over });
const review = (id: string, iso: string | null) => item({ id, solution: "language-exam", lane: "review", sortAt: iso ? at(iso) : null });

describe("Today's review queue keeps the exam's order exactly (M2: the exam rows do not change)", () => {
  it("is the same sort the dashboard used: review lane, oldest first, undated first", () => {
    const items = [review("b", "2026-10-03T10:00:00Z"), item({ lane: "running" }), review("a", "2026-10-01T10:00:00Z"), review("c", null)];
    const old = items.filter((i) => i.lane === "review").sort((a, b) => (a.sortAt?.getTime() ?? 0) - (b.sortAt?.getTime() ?? 0));
    expect(reviewQueue(items)).toEqual(old);
    expect(reviewQueue(items).map((i) => i.id)).toEqual(["c", "a", "b"]);
  });
});

describe("the next task (K10): data rights > accommodation > decision > the oldest exam review", () => {
  // Hiring emits only accommodation tasks in plan 2b (ruling C6); the reserved ranks are pinned here for plan 3.
  it("takes a data-rights request first, then an accommodation, the oldest of a kind first", () => {
    const items = [
      review("r1", "2026-09-01T00:00:00Z"),
      item({ id: "acc-new", lane: "task", task: "ACCOMMODATION", sortAt: at("2026-10-04T00:00:00Z") }),
      item({ id: "acc-old", lane: "task", task: "ACCOMMODATION", sortAt: at("2026-10-02T00:00:00Z") }),
      item({ id: "rights", lane: "task", task: "DATA_RIGHTS", sortAt: at("2026-10-05T00:00:00Z") }),
    ];
    expect(pickNextTask(items)?.id).toBe("rights");
    expect(pickNextTask(items.filter((i) => i.id !== "rights"))?.id).toBe("acc-old");
    expect(pickNextTask([item({ id: "d", lane: "task", task: "DECISION", sortAt: at("2026-10-01T00:00:00Z") }), review("r1", "2026-09-01T00:00:00Z")])?.id).toBe("d");
  });

  it("falls back to the oldest exam review, and to nothing", () => {
    expect(pickNextTask([review("new", "2026-10-03T00:00:00Z"), review("old", "2026-10-01T00:00:00Z")])?.id).toBe("old");
    expect(pickNextTask([item({ lane: "attention" }), item({ lane: "running" })])).toBeNull();
  });
});

describe("the attention list and the summary", () => {
  it("lists the attention lane only", () => {
    const rows = [item({ id: "a1" }), item({ id: "t", lane: "task", task: "ACCOMMODATION" }), review("r", null)];
    expect(attentionRows(rows).map((r) => r.id)).toEqual(["a1"]);
  });

  it("counts what waits for a person (tasks, attention rows, reviews) and names the oldest", () => {
    const rows = [item({ sortAt: at("2026-10-02T00:00:00Z") }), item({ lane: "task", task: "ACCOMMODATION", sortAt: at("2026-09-30T00:00:00Z") }), review("r", "2026-10-01T00:00:00Z"), item({ lane: "running" })];
    expect(todaySummary(rows)).toEqual({ count: 3, oldest: at("2026-09-30T00:00:00Z") });
    expect(todaySummary([])).toEqual({ count: 0, oldest: null });
  });
});
```

```ts
// src/solutions/hiring/server/today.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, type Op } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { hiringToday } from "./today";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const OP1 = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-05T09:00:00Z");
let role: "OWNER" | "MANAGER" | "REVIEWER";

function respond(op: Op): unknown[] {
  switch (op.table) {
    case "users":
      return [{ role }];
    case "candidate_requests":
      return [
        { id: "cr1", kind: "ACCOMMODATION", message: "Video yerine yazılı cevap verebilir miyim?", createdAt: new Date("2026-10-05T08:58:00Z"), name: "Ece Bal", openingId: OP1, openingName: "Ürün Tasarımcısı" },
        { id: "cr2", kind: "NEW_LINK", message: null, createdAt: new Date("2026-10-04T08:00:00Z"), name: "Can Demir", openingId: OP1, openingName: "Ürün Tasarımcısı" },
      ];
    case "deletion_requests":
      return [
        { id: "dr1", createdAt: new Date("2026-10-03T08:00:00Z"), openingId: OP1, openingName: "Ürün Tasarımcısı" },
        // The same request again through a second invitation of the same person: counted once.
        { id: "dr1", createdAt: new Date("2026-10-03T08:00:00Z"), openingId: OP1, openingName: "Ürün Tasarımcısı" },
      ];
    case "assessment_links":
      return [{ openingId: OP1, openingName: "Ürün Tasarımcısı" }, { openingId: OP1, openingName: "Ürün Tasarımcısı" }];
    case "hiring_versions":
      return [{ openingId: OP1, openingName: "Ürün Tasarımcısı", number: 2 }];
    default:
      return [];
  }
}

beforeEach(() => {
  role = "OWNER";
  fake.ops = [];
  fake.respond = respond;
});

describe("hiring's rows on Today (HIRING-VISUAL-FLOW 4.3, M2)", () => {
  it("gives a reviewer nothing and reads nothing past the role (STATUS 321: requests are for who runs the opening)", async () => {
    role = "REVIEWER";
    expect(await hiringToday(ORG, USER, "tr", NOW)).toEqual([]);
    expect(fake.ops.map((o) => o.table)).toEqual(["users"]);
  });

  it("offers each accommodation request as a possible next task; never a data-rights or a new-link request (ruling C6)", async () => {
    const tasks = (await hiringToday(ORG, USER, "tr", NOW)).filter((i) => i.lane === "task");
    expect(tasks.map((t) => [t.task, t.title])).toEqual([["ACCOMMODATION", "Ece Bal bir uyarlama istedi"]]);
    expect(tasks[0]).toMatchObject({ solution: "hiring", subtitle: "Ürün Tasarımcısı", detail: "Video yerine yazılı cevap verebilir miyim?", href: `/hiring/openings/${OP1}/candidates` });
  });

  it("lists per opening: open requests (data rights counted once, with a plain note), links expiring within 48 hours, a draft waiting with 'Kuruluma devam et'", async () => {
    const rows = (await hiringToday(ORG, USER, "tr", NOW)).filter((i) => i.lane === "attention");
    expect(rows.map((r) => [r.attention, r.title, r.subtitle, r.href])).toEqual([
      ["requests", "3 açık talep", "Ürün Tasarımcısı", `/hiring/openings/${OP1}/candidates`],
      ["expiring", "2 link 48 saatte doluyor", "Ürün Tasarımcısı", `/hiring/openings/${OP1}/candidates`],
      ["draft", "Taslak v2 yayın bekliyor", "Ürün Tasarımcısı", `/hiring/openings/${OP1}`],
    ]);
    expect(rows[0]).toMatchObject({ detail: "Biri veri hakkı talebi; panelden henüz kapatılmaz.", sortAt: new Date("2026-10-03T08:00:00Z") });
    expect(rows[2].actionLabel).toBe("Kuruluma devam et");
    expect(rows[1].detail ?? null).toBeNull();
  });

  it("reads only this organisation's rows and only open requests", async () => {
    await hiringToday(ORG, USER, "tr", NOW);
    for (const op of fake.ops) expect(op.params, op.table).toContain(ORG);
    expect(fake.ops.find((o) => o.table === "candidate_requests")!.where).toMatch(/"handled_at" is null/);
    expect(fake.ops.find((o) => o.table === "deletion_requests")!.where).toMatch(/"handled_at" is null/);
  });

  it("runs its reads one after another, never side by side (ruling C21: five connections shared with the live exam)", async () => {
    // A read that starts before the one before it answered would find more statements recorded than answered.
    const seen: number[] = [];
    fake.respond = (op) => {
      seen.push(fake.ops.length);
      return respond(op);
    };
    await hiringToday(ORG, USER, "tr", NOW);
    expect(fake.ops.map((o) => o.table)).toEqual(["users", "candidate_requests", "deletion_requests", "assessment_links", "hiring_versions"]);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });
});
```

`src/solutions/hiring/module.test.ts:44-47`, the first test becomes (reason: plan 2b gives hiring Today rows, M2):

```ts
  it("gives Today hiring's own rows and has no proctoring (plan 4)", async () => {
    expect(await hiringModule.today("o", "u", "tr")).toEqual([{ id: "row" }]);
    expect(t.hiringToday).toHaveBeenCalledWith("o", "u", "tr");
    expect(await hiringModule.proctorPolicy("a")).toBeNull();
  });
```

with, under the `./server/consent` mock (`:23`), `const t = vi.hoisted(() => ({ hiringToday: vi.fn(async () => [{ id: "row" }]) }));` and `vi.mock("./server/today", () => t);`.

Run: `pnpm exec vitest run src/lib/today.test.ts src/solutions/hiring/server/today.test.ts src/solutions/hiring/module.test.ts`
Expected: FAIL (modules missing; `module.today` returns `[]`).

- [ ] **Step 2: The contract and the window**

`src/solutions/types.ts`: the `TodayItem` block (`:93-105`, from its doc comment) becomes:

```ts
/** K10: the kinds of request that may become Today's next task, in priority order. DATA_RIGHTS and DECISION are reserved for plan 3 (ruling C6). */
export type TodayTaskKind = "DATA_RIGHTS" | "ACCOMMODATION" | "DECISION";

/** One row on the shared Today screen. */
export type TodayItem = {
  id: string;
  solution: SolutionKey;
  /**
   * "review": waiting for a person, oldest first (the exam's queue). "running": in progress now.
   * "attention": something to look at, listed under "Dikkat isteyenler". "task": one request that may
   * become "Sıradaki iş" (K10); tasks are not listed one by one (their opening's attention row counts them).
   */
  lane: "review" | "running" | "attention" | "task";
  title: string;
  subtitle: string | null;
  href: string;
  sortAt: Date | null;
  /** review: exactly four cells (detail, level, status, integrity). running: one dot. attention and task: none. */
  cells: TodayCell[];
  /** lane "task": its kind (K10). */
  task?: TodayTaskKind;
  /** lane "task": the candidate's own words, shown quoted. lane "attention": a plain note under the title. */
  detail?: string | null;
  /** lane "attention": which icon the row carries (inbox, clock, file). */
  attention?: "requests" | "expiring" | "draft";
  /** lane "attention": the row's own action words (default "Aç"). */
  actionLabel?: string;
};
```

`src/solutions/hiring/rules/invitation.ts`, under `SURVEY_BATCH` (`:46`):

```ts
/** A link that is not finished and expires within this window "needs attention" (Today and the openings' control view, ruling C16: one window). */
export const EXPIRING_SOON_MS = 48 * 60 * 60 * 1000;
```

- [ ] **Step 3: `src/lib/today.ts`**

```ts
import type { TodayItem, TodayTaskKind } from "@/solutions/types";

/**
 * HIRING-VISUAL-FLOW 4.3, M2: what the shared Today screen orders. The review
 * queue is the exam's, sorted exactly as the dashboard always did (oldest
 * first); the next task follows K10: a data-rights request (a legal clock),
 * then an accommodation request (a candidate waits), then a decision, then the
 * oldest review. In plan 2b hiring emits only accommodation tasks (ruling C6);
 * the data-rights and decision ranks are kept for plan 3.
 */
const RANK: Record<TodayTaskKind, number> = { DATA_RIGHTS: 0, ACCOMMODATION: 1, DECISION: 2 };
const time = (item: TodayItem) => item.sortAt?.getTime() ?? 0;

export function reviewQueue(items: TodayItem[]): TodayItem[] {
  return items.filter((i) => i.lane === "review").sort((a, b) => time(a) - time(b));
}

export function pickNextTask(items: TodayItem[]): TodayItem | null {
  const tasks = items.filter((i) => i.lane === "task" && i.task).sort((a, b) => RANK[a.task!] - RANK[b.task!] || time(a) - time(b));
  return tasks[0] ?? reviewQueue(items)[0] ?? null;
}

export const attentionRows = (items: TodayItem[]) => items.filter((i) => i.lane === "attention");

export function todaySummary(items: TodayItem[]): { count: number; oldest: Date | null } {
  const waiting = items.filter((i) => i.lane !== "running");
  const dated = waiting.map((i) => i.sortAt).filter((d): d is Date => d !== null);
  return { count: waiting.length, oldest: dated.length ? new Date(Math.min(...dated.map((d) => d.getTime()))) : null };
}
```

- [ ] **Step 4: `hiringToday`**

```ts
// src/solutions/hiring/server/today.ts
import { and, eq, gt, inArray, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { assessmentLinks, assessments, candidateRequests, candidates, deletionRequests, hiringAssessments, hiringOpenings, hiringVersions, users } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import type { TodayItem } from "@/solutions/types";
import { EXPIRING_SOON_MS } from "../rules/invitation";

const DETAIL_MAX = 140;

/**
 * HIRING-VISUAL-FLOW 4.3 (M2): hiring's rows on Today, for someone who runs
 * openings (owners and managers; a reviewer gets none: requests are for the
 * people who run the opening, STATUS 321). One "task" row per open
 * accommodation request (K10 may pick it as "Sıradaki iş"); per opening, one
 * "attention" row each for its open requests, its links expiring within 48
 * hours and a draft waiting to be published. Data-rights requests are not
 * tasks in plan 2b (ruling C6, the user's "plan 3 te gelsin"): they are
 * counted in the opening's requests row, which says so in a plain note; their
 * handling place and their top rank come with plan 3 (RANK keeps the order).
 *
 * Every read is scoped to the organisation and runs after the one before
 * (ruling C21: the pool of five connections is shared with the live exam's
 * writes). The candidate's name is shown to the people who run openings
 * (blind mode masks only non-runners, ruling C12).
 */
export async function hiringToday(orgId: string, userId: string, locale: Locale, now: Date = new Date()): Promise<TodayItem[]> {
  const [viewer] = await db
    .select({ role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId), isNull(users.disabledAt)))
    .limit(1);
  if (!viewer || !can({ role: viewer.role }, "opening:write")) return [];
  const t = managerT(locale);

  const requests = await db
    .select({ id: candidateRequests.id, kind: candidateRequests.kind, message: candidateRequests.message, createdAt: candidateRequests.createdAt, name: candidates.fullName, openingId: hiringAssessments.openingId, openingName: hiringOpenings.name })
    .from(candidateRequests)
    .innerJoin(hiringAssessments, and(eq(hiringAssessments.assessmentId, candidateRequests.assessmentId), eq(hiringAssessments.orgId, orgId)))
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringAssessments.openingId), eq(hiringOpenings.orgId, orgId)))
    .innerJoin(assessments, and(eq(assessments.id, candidateRequests.assessmentId), eq(assessments.orgId, orgId)))
    .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
    .where(and(eq(candidateRequests.orgId, orgId), isNull(candidateRequests.handledAt)));
  const rights = await db
    .select({ id: deletionRequests.id, createdAt: deletionRequests.createdAt, openingId: hiringAssessments.openingId, openingName: hiringOpenings.name })
    .from(deletionRequests)
    .innerJoin(candidates, and(eq(candidates.id, deletionRequests.candidateId), eq(candidates.orgId, orgId)))
    .innerJoin(assessments, and(eq(assessments.candidateId, candidates.id), eq(assessments.orgId, orgId), eq(assessments.solution, "HIRING")))
    .innerJoin(hiringAssessments, and(eq(hiringAssessments.assessmentId, assessments.id), eq(hiringAssessments.orgId, orgId)))
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringAssessments.openingId), eq(hiringOpenings.orgId, orgId)))
    .where(isNull(deletionRequests.handledAt));
  const links = await db
    .select({ openingId: hiringAssessments.openingId, openingName: hiringOpenings.name })
    .from(assessmentLinks)
    .innerJoin(hiringAssessments, and(eq(hiringAssessments.assessmentId, assessmentLinks.assessmentId), eq(hiringAssessments.orgId, orgId)))
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringAssessments.openingId), eq(hiringOpenings.orgId, orgId)))
    .where(and(inArray(assessmentLinks.status, ["NOT_STARTED", "IN_PROGRESS"]), gt(assessmentLinks.expiresAt, now), lt(assessmentLinks.expiresAt, new Date(now.getTime() + EXPIRING_SOON_MS))));
  const drafts = await db
    .select({ openingId: hiringVersions.openingId, openingName: hiringOpenings.name, number: hiringVersions.versionNumber })
    .from(hiringVersions)
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringVersions.openingId), eq(hiringOpenings.orgId, orgId)))
    .where(and(eq(hiringVersions.orgId, orgId), eq(hiringVersions.status, "DRAFT"), ne(hiringOpenings.status, "CLOSED")));

  const name = (n: string | null) => n ?? t("hiringToday.anonymous");
  const detail = (m: string | null) => (m ? (m.length > DETAIL_MAX ? `${m.slice(0, DETAIL_MAX - 1)}…` : m) : null);
  const candidatesTab = (id: string) => `/hiring/openings/${id}/candidates`;

  const tasks: TodayItem[] = requests
    .filter((r) => r.kind === "ACCOMMODATION")
    .map((r) => ({ id: `hiring:request:${r.id}`, solution: "hiring", lane: "task", task: "ACCOMMODATION", title: t("hiringToday.accommodation", { name: name(r.name) }), subtitle: r.openingName, detail: detail(r.message), href: candidatesTab(r.openingId), sortAt: r.createdAt, cells: [] }));

  // One row per opening and kind; a data-rights request reached through two invitations of the same person counts once.
  const perOpening = <T extends { openingId: string; openingName: string }>(rows: T[]) => {
    const groups = new Map<string, { name: string; rows: T[] }>();
    for (const row of rows) groups.set(row.openingId, { name: row.openingName, rows: [...(groups.get(row.openingId)?.rows ?? []), row] });
    return [...groups.entries()];
  };
  const open = [...requests.map((r) => ({ ...r, rights: false })), ...[...new Map(rights.map((r) => [`${r.openingId}:${r.id}`, r])).values()].map((r) => ({ ...r, rights: true }))];
  const attention: TodayItem[] = [
    ...perOpening(open).map(([id, g]): TodayItem => {
      const counted = g.rows.filter((r) => r.rights).length;
      return {
        id: `hiring:requests:${id}`,
        solution: "hiring",
        lane: "attention",
        attention: "requests",
        title: t("hiringCommon.openRequests", { count: g.rows.length }),
        subtitle: g.name,
        detail: counted ? t("hiringCommon.rightsNote", { count: counted }) : null,
        href: candidatesTab(id),
        sortAt: new Date(Math.min(...g.rows.map((r) => r.createdAt.getTime()))),
        cells: [],
      };
    }),
    ...perOpening(links).map(([id, g]): TodayItem => ({ id: `hiring:expiring:${id}`, solution: "hiring", lane: "attention", attention: "expiring", title: t("hiringCommon.expiringLinks", { count: g.rows.length }), subtitle: g.name, href: candidatesTab(id), sortAt: null, cells: [] })),
    ...drafts.map((d): TodayItem => ({
      id: `hiring:draft:${d.openingId}`,
      solution: "hiring",
      lane: "attention",
      attention: "draft",
      title: t("hiringCommon.draftWaitingPublish", { number: d.number }),
      subtitle: d.openingName,
      actionLabel: t("hiringCommon.continueSetup"),
      href: `/hiring/openings/${d.openingId}`,
      sortAt: null,
      cells: [],
    })),
  ];
  return [...tasks, ...attention];
}
```

`module.ts`: add `import { hiringToday } from "./server/today";` after the `hiringLibraryUsage` import (`:18`), and replace the `today()` that returns `[]` (`:32-35`) with:

```ts
  // Hiring's Today rows (M2): accommodation tasks and per-opening attention rows; decisions arrive with plan 3.
  today: hiringToday,
```

Copy (`hiring.tr.json` / `hiring.en.json`). New namespace `hiringToday`:

| Key | TR | EN |
|---|---|---|
| `accommodation` | {name} bir uyarlama istedi | {name} asked for an adjustment |
| `anonymous` | Bir aday | A candidate |

New keys in `hiringCommon` (Today, the openings' control view and the overview say the same words):

| Key | TR | EN |
|---|---|---|
| `openRequests` | {count, plural, one {# açık talep} other {# açık talep}} | {count, plural, one {# open request} other {# open requests}} |
| `rightsNote` | {count, plural, one {Biri veri hakkı talebi; panelden henüz kapatılmaz.} other {# tanesi veri hakkı talebi; panelden henüz kapatılmaz.}} | {count, plural, one {One is a data rights request; it cannot be closed in the panel yet.} other {# are data rights requests; they cannot be closed in the panel yet.}} |
| `expiringLinks` | {count, plural, one {# link 48 saatte doluyor} other {# link 48 saatte doluyor}} | {count, plural, one {# link expires within 48 hours} other {# links expire within 48 hours}} |
| `draftWaitingPublish` | Taslak v{number} yayın bekliyor | Draft v{number} waits to be published |
| `continueSetup` | Kuruluma devam et | Continue the setup |

`rightsNote` is the plain note of ruling C6: it says what is true today (the Candidates tab lists the request with "Veri hakkı talebi burada kapatılmaz.") and promises no date.

- [ ] **Step 5: Tests and gates**

Run: `pnpm exec vitest run src/lib/today.test.ts src/solutions && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4`
Expected: PASS and clean. `src/solutions/boundary.test.ts` (hiring never imports the exam) stays green: `today.ts` imports only core modules and hiring's own rules.

- [ ] **Step 6: No browser step** (the dashboard shows the rows in Task 17).

- [ ] **Step 7: Commit**

```bash
git add src/solutions/types.ts src/solutions/hiring/rules/invitation.ts src/lib/today.ts src/lib/today.test.ts src/solutions/hiring/server/today.ts src/solutions/hiring/server/today.test.ts src/solutions/hiring/module.ts src/solutions/hiring/module.test.ts src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Give Today attention and task lanes and hiring's own rows

Today items may now be attention rows (listed) or tasks (candidates for
the next task, K10). Hiring answers for people who run openings: a task
per accommodation request, and per opening its open requests, links
expiring within 48 hours and a waiting draft ('Kuruluma devam et'), all
in the organisation and read one after another (C21). Data-rights
requests are counted in the requests row with a plain note and are not
tasks before plan 3 (ruling C6; the rank stays reserved). One 48-hour
window for every view (C16). The exam's queue keeps its exact sort
(moved to lib/today). module.test: the empty-Today test now expects
hiring's rows (M2).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 17: M2 part 2, the Today screen (next task, needs attention, the link to the control view, the exam queue unchanged)

**Files:**
- Modify: `src/lib/today.ts` (+ `inviteEmphasis`), `src/lib/today.test.ts`
- Create: `src/components/manager/next-task-card.tsx`
- Modify: `src/components/manager/invite-menu.tsx:9`, `:13`, `:33`, `:36` (`variant` on both)
- Modify (render rewritten, data reads kept): `src/app/(manager)/dashboard/page.tsx:1-145`
- Modify: `src/solutions/types.ts:62` (`SolutionManifest.overview`, optional), `src/solutions/hiring/manifest.ts:14` (hiring's control view), `src/solutions/registry.test.ts:65` (new test before it)
- Modify: `src/i18n/messages/screens.tr.json`, `screens.en.json` (`today`), `src/i18n/panel-copy.test.ts` (`today` joins the "sen" check)

**Shared with the exam (flag: M2 changes the live exam's daily screen):** `/dashboard` is the exam's daily page. Kept identical: the review queue's rows (title, subtitle, the four cells, "İncele", the link, the order), the running list's rows, the "48 saat içinde dolacak linkler" card with its "7 gün uzat" form. Changed: the page head (one "Bugün" title and a summary line instead of "N sonuç incelemenizi bekliyor"), the queue's heading (solution and count), the empty queue's hint (K9), the running list behind a disclosure, the invite button's weight, the new hiring blocks (only for people who run openings) and one text link "Tüm alımların durumu ›" (design 4.3, H1) for everyone, since everyone sees the hiring menu. Step 1 and Step 7 compare the queue's rows before and after (ruling C17: the rows only, the heading and the empty hint change on purpose). The exam manifest gets no `overview`, so no exam link is added.

**Interfaces:**
- Consumes: `reviewQueue`, `pickNextTask`, `attentionRows`, `todaySummary`, `TodayItem.detail` and `actionLabel` (Task 16); `PanelHeader`, `EmptyState` (Tasks 14-15); `Disclosure` (Task 4); the manifests' `label` and the new `overview` through `solutionModules()` (each module spreads its manifest).
- Produces:
  - `inviteEmphasis(input: { next: boolean; attention: number }): "outline" | "filled" | "empty"` (`src/lib/today.ts`)
  - `NextTaskCard(props: { heading: string; solution: string; title: string; detail?: string | null; meta?: string | null; action: { label: string; href: string } })` (`@/components/manager/next-task-card`)
  - `InviteMenu(props: { label: string; items: ...; variant?: "primary" | "secondary" })`, `InviteUnavailable(props: { label: string; reason: string; variant?: "primary" | "secondary" })`
  - `SolutionManifest.overview?: { href: string; label: I18nLabel }`; hiring: `{ href: "/hiring/openings", label: { tr: "Tüm alımların durumu", en: "Where every opening stands" } }`

- [ ] **Step 1: Before (exam queue rows)**

On a fresh `kademe_ui_check`, dev server 3100, current code, Claude in Chrome: log in through `/login` as the owner, open `/dashboard`, screenshot at 1440 and 1280 (`shots/p2b-t17-before-*`), and save the queue's rows with `javascript_tool`:

```js
(() => {
  const queue = [...document.querySelectorAll("main section")].find((s) => s.querySelector("h2")?.textContent?.startsWith("İnceleme kuyruğu"));
  const rows = [...(queue?.querySelectorAll("a") ?? [])].map((a) => a.innerText);
  return [rows.length, ...rows].join("\n");
})()
```

into `shots/p2b-t17-before-queue.txt` (the first line is the row count; with no exam results waiting it is `0` and nothing follows, ruling C17).

- [ ] **Step 2: Failing tests**

Append to `src/lib/today.test.ts` (and import `inviteEmphasis` with the others):

```ts
describe("the invite button's weight on Today (4.3: one filled button)", () => {
  it("is outline when a next task holds the filled button, filled when only attention rows wait, and moves into the empty state otherwise", () => {
    expect(inviteEmphasis({ next: true, attention: 3 })).toBe("outline");
    expect(inviteEmphasis({ next: false, attention: 2 })).toBe("filled");
    expect(inviteEmphasis({ next: false, attention: 0 })).toBe("empty");
  });
});
```

In `src/i18n/panel-copy.test.ts`: `import screensTr from "@/i18n/messages/screens.tr.json";` under the manager import, and `["today", screensTr.today]` at the end of the `it.each` list.

In `src/solutions/registry.test.ts`, before `it("drops group headers when only one solution is registered"` (`:65`):

```ts
  it("links Today to hiring's control view only, under its own base path (H1)", () => {
    expect(SOLUTION_MANIFESTS.map((m) => m.overview?.href ?? null)).toEqual(["/hiring/openings", null]);
    for (const m of SOLUTION_MANIFESTS) if (m.overview) expect(m.overview.href.startsWith(`${m.basePath}/`)).toBe(true);
  });
```

Run: `pnpm exec vitest run src/lib/today.test.ts src/i18n/panel-copy.test.ts src/solutions/registry.test.ts`
Expected: FAIL (`inviteEmphasis` missing; `today.title` says "incelemenizi", `queueEmptyHint` "davet edin"; no `overview`).

- [ ] **Step 3: Model, manifest and copy**

Append to `src/lib/today.ts`:

```ts
/** 4.3: Today has one filled button: the next task's; without one, the invite (in the header, or in the empty state when nothing waits). */
export function inviteEmphasis(input: { next: boolean; attention: number }): "outline" | "filled" | "empty" {
  if (input.next) return "outline";
  return input.attention > 0 ? "filled" : "empty";
}
```

`src/solutions/types.ts`, under `nav: NavLink[];` (`:62`):

```ts
  /** HIRING-VISUAL-FLOW H1: the solution's control view, linked from Today under "Dikkat isteyenler". */
  overview?: { href: string; label: I18nLabel };
```

`src/solutions/hiring/manifest.ts`, under `nav` (`:14`): `overview: { href: "/hiring/openings", label: { tr: "Tüm alımların durumu", en: "Where every opening stands" } },`

`screens.*.json` `today` (changed and new keys; the rest unchanged):

| Key | TR | EN |
|---|---|---|
| `title` (changed) | Bugün | Today |
| `summary` (new) | {count, plural, =0 {Bekleyen iş yok.} other {# iş seni bekliyor.}} | {count, plural, =0 {Nothing is waiting.} one {# thing waits for you.} other {# things wait for you.}} |
| `oldest` (changed) | En eskisi {date}. | The oldest is from {date}. |
| `queueTitle` (changed) | İnceleme kuyruğu · {solution} ({count}) | Review queue · {solution} ({count}) |
| `queueEmptyHint` (changed) | Yeni bir öğrenci davet et; bitirdiğinde sonucu burada belirir. | Invite a student; their result appears here when they finish. |
| `nextTitle` | Sıradaki iş | Next up |
| `nextRequest` | Talebe bak | Look at the request |
| `attentionTitle` | Dikkat isteyenler | Needs attention |
| `open` | Aç | Open |
| `runningCount` | {title} ({count}) | {title} ({count}) |
| `emptyTitle` | Bugün bekleyen iş yok. | Nothing waits for you today. |
| `emptyBody` | Yeni bir aday ya da öğrenci davet edebilirsin. | You can invite a new candidate or student. |

Reason (commit body): K9, Today is a shared screen and speaks "sen"; the head no longer counts only exam results (4.3).

- [ ] **Step 4: `InviteMenu` with a weight**

In `invite-menu.tsx`, both components take `variant: "primary" | "secondary" = "primary"` (signatures `:9` and `:33`) and pass it to their `Button` (`:13` and `:36`, `variant={variant}`). Nothing else changes (the `invite-menu.test.ts` expectations hold: id, disabled, `aria-describedby`).

- [ ] **Step 5: `NextTaskCard`**

```tsx
// src/components/manager/next-task-card.tsx
// kademe-owned
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** 4.3: the one thing to do first today (K10), with the screen's one filled button. */
export function NextTaskCard({
  heading,
  solution,
  title,
  detail,
  meta,
  action,
}: {
  heading: string;
  solution: string;
  title: string;
  detail?: string | null;
  meta?: string | null;
  action: { label: string; href: string };
}) {
  return (
    <section aria-labelledby="today-next" className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id="today-next" className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
          {heading}
        </h2>
        <span className="text-[13px] text-muted">{solution}</span>
      </div>
      <p className="mt-3 text-[20px] leading-7 font-semibold text-ink">{title}</p>
      {detail ? <p className="mt-1 text-[14px] leading-[22px] text-ink-2">“{detail}”</p> : null}
      {meta ? <p className="tnum mt-1 text-[13px] text-muted">{meta}</p> : null}
      <div className="mt-4 flex justify-end">
        <Button asChild variant="primary">
          <Link id="today-next-action" href={action.href}>
            {action.label}
          </Link>
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: The page**

Replace `src/app/(manager)/dashboard/page.tsx` with (the queue row markup at `:77-91`, the running rows at `:104-111` and the expiring card at `:115-141` are moved over unchanged):

```tsx
import Link from "next/link";
import { ChevronRight, Clock, FileText, Inbox } from "lucide-react";
import { InviteMenu, InviteUnavailable } from "@/components/manager/invite-menu";
import { inviteChoice } from "@/components/manager/invite-choice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dot, Level, shortDateTime } from "@/components/panel/bits";
import { EmptyState } from "@/components/manager/empty-state";
import { NextTaskCard } from "@/components/manager/next-task-card";
import { PanelHeader } from "@/components/manager/panel-header";
import { Disclosure } from "@/components/visual/disclosure";
import { extendLink } from "@/app/(manager)/actions";
import { can } from "@/lib/authorize";
import { attentionRows, inviteEmphasis, pickNextTask, reviewQueue, todaySummary } from "@/lib/today";
import { expiringLinks } from "@/server/links";
import { requireUser } from "@/server/session";
import { inviteTargets } from "@/solutions/registry";
import { solutionModules } from "@/solutions/registry.server";
import type { TodayCell, TodayItem } from "@/solutions/types";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

const ATTENTION_ICON = { requests: Inbox, expiring: Clock, draft: FileText } as const;
const TEXT_LINK = "inline-flex min-h-11 items-center gap-0.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";

function Cell({ cell }: { cell: TodayCell }) {
  if (cell.kind === "text") return <span className="text-[13.5px] text-ink-2">{cell.text}</span>;
  if (cell.kind === "level") return <Level level={cell.text} muted={!cell.final} />;
  return <Dot tone={cell.tone}>{cell.text}</Dot>;
}

/**
 * "Today" (HIRING-VISUAL-FLOW 4.3): "what should I look at?". The next task
 * (K10) holds the one filled button; "Dikkat isteyenler" lists what needs a
 * look, each row with the action that fixes it; under it, each solution's own
 * control view ("Tüm alımların durumu ›", H1); the exam's review queue keeps
 * its rows, columns and order exactly; work in progress sits behind a
 * disclosure; the exam's expiring links keep their "7 gün uzat". No stat
 * tiles: every row leads to an action.
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const modules = solutionModules();
  const items: TodayItem[] = (await Promise.all(modules.map((m) => m.today(user.orgId, user.id, locale)))).flat();
  const labelOf = (key: TodayItem["solution"]) => modules.find((m) => m.key === key)?.label[locale] ?? "";
  const queue = reviewQueue(items);
  const next = pickNextTask(items);
  const attention = attentionRows(items);
  const summary = todaySummary(items);
  const running = items.filter((i) => i.lane === "running");
  // H1: a solution with a control view of its own (hiring's openings) is one link away; everyone who sees its menu sees the link.
  const overviews = modules.flatMap((m) => (m.overview ? [{ key: m.key, href: m.overview.href, label: m.overview.label[locale] }] : []));
  const expiring = await expiringLinks(user.orgId);
  // Extending a link needs the same right as inviting a student.
  const canExtend = can(user, "student:invite");
  // Every solution that can invite and that this user may invite for (HIRING-UX 4.5).
  const invite = inviteChoice(inviteTargets(), (capability) => can(user, capability), locale);
  const emphasis = inviteEmphasis({ next: next !== null, attention: attention.length });
  const inviteButton = (variant: "primary" | "secondary") =>
    invite.kind === "many" ? (
      <InviteMenu label={t("today.inviteMenu")} items={invite.items} variant={variant} />
    ) : invite.kind === "one" ? (
      <Button asChild variant={variant}>
        <Link href={invite.href}>{invite.label}</Link>
      </Button>
    ) : (
      <InviteUnavailable label={t("today.inviteMenu")} reason={t("today.noInvitePermission")} variant={variant} />
    );
  const queueLabel = queue[0] ? labelOf(queue[0].solution) : (modules.find((m) => m.key === "language-exam")?.label[locale] ?? "");

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <PanelHeader
        title={t("today.title")}
        meta={[t("today.summary", { count: summary.count }), summary.oldest ? t("today.oldest", { date: shortDateTime(summary.oldest, locale) }) : null].filter(Boolean).join(" ")}
        primary={emphasis === "empty" ? undefined : inviteButton(emphasis === "outline" ? "secondary" : "primary")}
      />

      {emphasis === "empty" && queue.length === 0 ? (
        <EmptyState className="mt-8" illustration="emptyToday" title={t("today.emptyTitle")} body={t("today.emptyBody")} action={inviteButton("primary")} />
      ) : null}

      {next ? (
        <div className="mt-8">
          <NextTaskCard
            heading={t("today.nextTitle")}
            solution={labelOf(next.solution)}
            title={next.title}
            detail={next.lane === "task" ? (next.detail ?? null) : null}
            meta={[next.subtitle, next.sortAt ? shortDateTime(next.sortAt, locale) : null].filter(Boolean).join(" · ") || null}
            action={{ label: next.lane === "task" ? t("today.nextRequest") : t("today.review"), href: next.href }}
          />
        </div>
      ) : null}

      {attention.length ? (
        <section className="mt-8" aria-labelledby="today-attention">
          <h2 id="today-attention" className="mb-3 text-[15px] font-semibold text-ink">
            {t("today.attentionTitle")}
          </h2>
          <Card className="divide-y divide-line">
            {attention.map((row) => {
              const Icon = ATTENTION_ICON[row.attention ?? "requests"];
              return (
                <Link key={row.id} href={row.href} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3 hover:bg-canvas">
                  <span className="grid size-9 place-items-center rounded-lg bg-secondary">
                    <Icon className="size-[18px] text-ink" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-ink">{row.title}</span>
                    {row.subtitle ? <span className="block truncate text-[12.5px] text-muted">{row.subtitle}</span> : null}
                    {/* Ruling C6: data-rights requests are counted here and said plainly; they are handled with plan 3. */}
                    {row.detail ? <span className="block text-[12.5px] text-muted">{row.detail}</span> : null}
                  </span>
                  <span className="text-[13px] text-muted">{labelOf(row.solution)}</span>
                  <span className="inline-flex items-center gap-0.5 text-[13px] font-medium text-ink">
                    {row.actionLabel ?? t("today.open")}
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                </Link>
              );
            })}
          </Card>
        </section>
      ) : null}

      {overviews.length ? (
        <p className="mt-3 flex flex-wrap gap-x-6">
          {overviews.map((o) => (
            <Link key={o.key} href={o.href} className={TEXT_LINK}>
              {o.label}
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          ))}
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("today.queueTitle", { solution: queueLabel, count: queue.length })}</h2>
        {queue.length === 0 ? (
          <Card className="px-6 py-8 text-center">
            <p className="text-[15px] font-medium text-ink">{t("today.queueEmpty")}</p>
            <p className="mt-1 text-[13.5px] text-muted">{t("today.queueEmptyHint")}</p>
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {queue.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className="grid grid-cols-1 items-center gap-2 px-5 py-4 hover:bg-canvas md:grid-cols-[1.6fr_1.3fr_0.6fr_1.4fr_1.2fr_auto]"
              >
                <span>
                  <span className="block text-[14.5px] font-semibold text-ink">{r.title}</span>
                  <span className="text-[12.5px] text-muted">{r.subtitle}</span>
                </span>
                {r.cells.map((cell, i) => (
                  <Cell key={i} cell={cell} />
                ))}
                <span className="text-[13px] font-medium text-ink underline decoration-underline underline-offset-2">{t("today.review")}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <Disclosure label={t("today.runningCount", { title: t("today.runningTitle"), count: running.length })}>
            <Card className="divide-y divide-line">
              {running.length === 0 ? (
                <p className="px-5 py-4 text-[13.5px] text-muted">{t("today.runningEmpty")}</p>
              ) : (
                running.map((r) => (
                  <Link key={r.id} href={r.href} className="flex items-center justify-between px-5 py-3 hover:bg-canvas">
                    <span className="text-[14px] font-medium text-ink">{r.title}</span>
                    {r.cells.map((cell, i) => (
                      <Cell key={i} cell={cell} />
                    ))}
                  </Link>
                ))
              )}
            </Card>
          </Disclosure>
        </section>
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("today.expiringTitle")}</h2>
          {sp.extended ? <p className="mb-2 text-[13px] text-muted">{t("today.extended")}</p> : null}
          <Card className="divide-y divide-line">
            {expiring.length === 0 ? (
              <p className="px-5 py-4 text-[13.5px] text-muted">-</p>
            ) : (
              expiring.map((e) => (
                <div key={e.link.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span>
                    <span className="block text-[14px] font-medium text-ink">{e.name}</span>
                    <span className="text-[12.5px] text-muted">{shortDateTime(e.link.expiresAt, locale)}</span>
                  </span>
                  {canExtend ? (
                    <form action={extendLink}>
                      <input type="hidden" name="linkId" value={e.link.id} />
                      <input type="hidden" name="back" value="/dashboard" />
                      <Button type="submit" size="sm">
                        {t("today.extend")}
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
```

When the next task is the oldest exam review, that review also stays in the queue below (the card is a pointer, the queue is the list); say so in the commit.

- [ ] **Step 7: Gates, verify:exam, after comparison**

Run: `pnpm exec vitest run src/lib src/i18n src/components src/solutions && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -5`, then `verify:exam` against `kademe_platform` (Task 14 Step 7 command).
Expected: clean; every check `ok`.

On `kademe_ui_check` with this code: the same `javascript_tool` call prints exactly `shots/p2b-t17-before-queue.txt` (count and rows; the heading is not part of it). Screenshots `shots/p2b-t17-after-*` at 1440, 1280, 1024.

Role check (log in through `/login` each time; the copy's users from `select email, role from users`; a hiring link from `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_ui_check pnpm dev:hiring-link`, ruling C13):
1. Owner, with an accommodation request (open the hiring link, "Bir ihtiyacın mı var?", "Başka bir düzenleme iste", send) and a data-rights request ("Veri hakların") on the same opening: "Sıradaki iş" is the accommodation request ("<ad> bir uyarlama istedi", the quoted words, the filled "Talebe bak"); the data-rights request is never the next task (ruling C6). "Dikkat isteyenler" lists "2 açık talep · <alım> · İşe alım · Aç" with the line "Biri veri hakkı talebi; panelden henüz kapatılmaz.", and a draft's "Taslak v1 yayın bekliyor … Kuruluma devam et ›" when the copy has one. Under it "Tüm alımların durumu ›" opens `/hiring/openings`. The invite button is outline.
2. A reviewer: no hiring row anywhere, "Tüm alımların durumu ›" still there (it lists only their openings, Task 18); the exam queue as for them before.
3. No requests, no reviews (a fresh copy): the empty drawing, "Bugün bekleyen iş yok.", the filled invite in the empty state, nothing filled in the header.
Drop the copy.

- [ ] **Step 8: Commit**

```bash
git add src/lib/today.ts src/lib/today.test.ts src/components/manager/next-task-card.tsx src/components/manager/invite-menu.tsx "src/app/(manager)/dashboard/page.tsx" src/solutions/types.ts src/solutions/hiring/manifest.ts src/solutions/registry.test.ts src/i18n/messages/screens.tr.json src/i18n/messages/screens.en.json src/i18n/panel-copy.test.ts
git commit -m "Lead Today with the next task and what needs attention

One title and a summary line, the next task (K10, accommodation only in
plan 2b per C6) with the screen's one filled button, 'Dikkat isteyenler'
from every solution with each row's own action and plain note, a link to
hiring's control view (H1), then the exam's review queue with its rows,
columns and order unchanged (before/after rows identical, C17), running
work behind a disclosure, the exam's expiring links as before. The invite
turns outline while a task holds the filled button; with nothing waiting
it sits in the empty state. Today speaks sen (K9). A next task that is
the oldest review also stays in the queue.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 18: M3, the control view at `/hiring/openings` (rows, groups, one next step; replaces the card grid)

**Files:**
- Modify: `src/solutions/hiring/server/openings.ts:31-40` (`OpeningListRow` gains `decisionMakerId`, `memberIds`), `:93` (the row carries them; `listOpenings` already reads both)
- Modify: `src/solutions/hiring/server/invitations.ts:1` (`gt`, `lt`), `:32` (`EXPIRING_SOON_MS` import), after `releasedSurvey` (`:844`, before `invitableOpenings`' comment at `:846`): `OpeningCardFacts`, `openingCardFacts`
- Modify: `src/solutions/hiring/server/invitations.test.ts:11` (import), new `describe` at the end
- Create: `src/app/(manager)/hiring/openings/[id]/setup-steps.ts`, `setup-steps.test.ts` (moved here from the old Task 20: the control view needs it first)
- Create: `src/components/hiring/opening-next-step.ts`, `opening-next-step.test.ts`
- Create: `src/components/manager/control-row.tsx`
- Create: `src/app/(manager)/hiring/openings/cockpit.ts`, `cockpit.test.ts`, `src/app/(manager)/hiring/openings/scroll-to.tsx`
- Modify (rewritten): `src/app/(manager)/hiring/openings/page.tsx:1-140`
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (`hiringOpenings` new keys and the route tabs' keys removed; `hiringCommon.teamShort`; `hiringOverview.rowPublish`, `setupCount`, `setupNext`)

**Shared with the exam:** none.

**Design and rulings:** 4.4, H1 (the control view is this page, the menu still says "Alımlar"), H8 (the route tabs become groups on one page: "Kurulumda", "Yayında", "Kapalı alımlar (n)" in a disclosure; `?tab=draft|open` scrolls to its group, `?tab=closed` opens the disclosure; this replaces plan decision 11 and the old Task 18's cards up to 20 and its `openingsLayout`), H9 and KG4 (a reviewer sees the openings they are on with counts only: the funnel and the expiring links; no requests, no team rule, no setup step; every row says "Aç ›"), KG1 (one row, one text action, no filled button on a row; the page's one filled button is "Alım aç", KG5), KG2 (the next step from one rule, `openingNextStep`), KG3 (it opens the flow that fixes it), D14 (the drafts' setup paths are read one after another while 300 ms last; the rest show "Kuruluma devam et ›" without a count), C6 (a data-rights request is counted with its plain note and never becomes the row's next step), C16 (`EXPIRING_SOON_MS`), C21 (every read one after another). A closed opening's row has one action, "Aç ›" (KG1); the overview of a closed opening already says "Ekip ve kurallarda yeniden aç" (design 4.4 also offers owners a second "Yeniden aç ›" on the row; one action per row wins).

**Interfaces:**
- Consumes: `listOpenings` (status filter and reviewer filter unchanged), `invitableOpenings`, `workingState`, `loadPanelUsers`, `readinessRows`, `rowHref`, `describeProblem`, `previewIsCurrent`, `canDecide`, `panelShortfall` (`src/components/hiring/invite/form-rules.ts:50`), `TONE` (Task 15), `EmptyState`, `PageTitle` (Tasks 14-15), `Disclosure` (Task 4), `EXPIRING_SOON_MS`, `hiringCommon.openRequests`, `rightsNote`, `expiringLinks`, `draftWaitingPublish`, `continueSetup` (Task 16).
- Produces:
  - `OpeningListRow` + `decisionMakerId: string | null; memberIds: string[]`
  - `type OpeningCardFacts = { invited: number; started: number; completed: number; expiringSoon: number; requests?: { open: number; rights: number } }`; `openingCardFacts(orgId: string, openingIds: string[], viewer: { runs: boolean }, now?: Date): Promise<Record<string, OpeningCardFacts>>` (Task 20 reads it on the overview)
  - `setup-steps.ts`: `type SetupKey = ReadinessKey | "publish"`; `SETUP_LABEL: Record<SetupKey, "rowAssessment" | … | "rowPublish">`; `type SetupRow = { key; state; href: string | null; row: ReadinessRow; fixText: string | null }`; `type SetupNext = { key: SetupKey; href: string }`; `setupProgress(rows, skipped?: readonly ReadinessKey[]): { done; total; left; current }`; `setupNext(rows, openingId, skipped?): SetupNext`; `teamHref(openingId, { memberCount, decisionMakerActive }): string`; `setupSkips(value: string | string[] | undefined): ReadinessKey[]`; `setupRowsOf(input: { state; opening: { id; memberIds; decisionMakerId }; people; t; locale }): SetupRow[]` (Tasks 20 and 21 use all of these)
  - `opening-next-step.ts`: `type OpeningNextKind = "setup" | "continueSetup" | "requests" | "team" | "expiring" | "draft" | "invite" | "candidates" | "open"`; `openingNextStep<K>(input: { id; status; runs; setup?: { key: K; href } | null; facts?; shortfall?; draftWaiting? }): { kind: OpeningNextKind; href: string; setupKey?: K }`; `cockpitTab(value): "draft" | "open" | "closed" | null`; `cockpitCounts(rows): { running; setup; waiting }`; `funnelShare(facts: { invited; started }): number`
  - `ControlRow(props: { title: ReactNode; href: string; status: ReactNode; progress?: ReactNode; attention?: Array<{ key: string; icon: LucideIcon; text: ReactNode; note?: ReactNode }>; facts?: ReactNode; next: { label: ReactNode; href: string } | null })` (`@/components/manager/control-row`)
  - `loadCockpit(user, t, locale, clock?): Promise<{ runs: boolean; drafts: CockpitRow[]; open: CockpitRow[]; closed: CockpitRow[] }>`, `SETUP_BUDGET_MS = 300`

- [ ] **Step 1: Failing tests**

```ts
// src/app/(manager)/hiring/openings/[id]/setup-steps.test.ts
import { describe, expect, it } from "vitest";
import { setupNext, setupProgress, setupSkips, teamHref } from "./setup-steps";

const OP = "33333333-3333-4333-8333-333333333333";
const base = `/hiring/openings/${OP}`;
const row = (key: "assessment" | "anchors" | "weights" | "team" | "preview", state: "done" | "missing" | "advisory", href: string | null = null) => ({ key, state, href });

describe("the draft's setup path (4.5, P6): Kurulum n / N and the one step to do now", () => {
  it("counts the readiness rows plus publishing, and points at the first row not done", () => {
    expect(setupProgress([row("assessment", "done"), row("anchors", "done"), row("team", "advisory"), row("preview", "advisory")])).toEqual({ done: 2, total: 5, left: 3, current: 2 });
    expect(setupProgress([row("assessment", "missing"), row("anchors", "done")])).toEqual({ done: 1, total: 3, left: 2, current: 0 });
  });

  it("points at publishing when every row is done", () => {
    expect(setupProgress([row("assessment", "done"), row("anchors", "done")])).toEqual({ done: 2, total: 3, left: 1, current: 2 });
  });

  it("passes a skipped advice step without counting it as done; a missing step cannot be skipped", () => {
    const rows = [row("assessment", "done"), row("team", "advisory"), row("preview", "advisory")];
    expect(setupProgress(rows, ["team"])).toEqual({ done: 1, total: 4, left: 3, current: 2 });
    expect(setupProgress(rows, ["team", "preview"]).current).toBe(3);
    expect(setupProgress([row("assessment", "missing")], ["team", "preview"]).current).toBe(0);
  });
});

describe("where 'Kuruluma devam et' goes (KG3, H7)", () => {
  it("to the first step not done, by the row's own link", () => {
    expect(setupNext([row("assessment", "done"), row("anchors", "missing", `${base}/assessment/scorecard?anchors=c1`)], OP)).toEqual({ key: "anchors", href: `${base}/assessment/scorecard?anchors=c1` });
    expect(setupNext([row("assessment", "missing", null)], OP)).toEqual({ key: "assessment", href: base });
  });

  it("to the team flow, at members while nobody is on the team, at the decision maker otherwise", () => {
    expect(teamHref(OP, { memberCount: 0, decisionMakerActive: false })).toBe(`${base}/settings#team-members`);
    expect(teamHref(OP, { memberCount: 2, decisionMakerActive: false })).toBe(`${base}/settings#team-decider`);
    expect(teamHref(OP, { memberCount: 0, decisionMakerActive: true })).toBe(`${base}/settings#team-members`);
    expect(setupNext([row("assessment", "done"), row("team", "advisory", teamHref(OP, { memberCount: 0, decisionMakerActive: true }))], OP)).toEqual({ key: "team", href: `${base}/settings#team-members` });
  });

  it("to the publish summary when every step is done or skipped", () => {
    expect(setupNext([row("assessment", "done"), row("anchors", "done")], OP)).toEqual({ key: "publish", href: `${base}#publish` });
    expect(setupNext([row("assessment", "done"), row("team", "advisory"), row("preview", "advisory")], OP, ["team", "preview"])).toEqual({ key: "publish", href: `${base}#publish` });
  });

  it("reads ?skip= as advice steps only, each once", () => {
    expect(setupSkips("team,preview,team,assessment")).toEqual(["team", "preview"]);
    expect(setupSkips(["preview", "x"])).toEqual(["preview"]);
    expect(setupSkips(undefined)).toEqual([]);
  });
});
```

```ts
// src/components/hiring/opening-next-step.test.ts
import { describe, expect, it } from "vitest";
import { cockpitCounts, cockpitTab, funnelShare, openingNextStep } from "./opening-next-step";

const id = "o1";
const base = "/hiring/openings/o1";
const live = (over: Partial<Parameters<typeof openingNextStep>[0]> = {}) =>
  openingNextStep({ id, status: "OPEN", runs: true, facts: { invited: 4, expiringSoon: 0, requests: { open: 0, rights: 0 } }, shortfall: false, draftWaiting: false, ...over });

describe("one next step per opening (KG2, 4.4)", () => {
  it("a draft: the setup path's next step, or 'Kuruluma devam et' when it was not computed", () => {
    expect(openingNextStep({ id, status: "DRAFT", runs: true, setup: { key: "team", href: `${base}/settings#team-members` } })).toEqual({ kind: "setup", href: `${base}/settings#team-members`, setupKey: "team" });
    expect(openingNextStep({ id, status: "DRAFT", runs: true, setup: null })).toEqual({ kind: "continueSetup", href: base });
  });

  it("a live opening, in order: requests, team below the rule, expiring links, a waiting draft, no invitation, the candidates", () => {
    const facts = { invited: 4, expiringSoon: 2, requests: { open: 1, rights: 0 } };
    expect(live({ facts, shortfall: true, draftWaiting: true })).toEqual({ kind: "requests", href: `${base}/candidates` });
    expect(live({ facts: { ...facts, requests: { open: 0, rights: 0 } }, shortfall: true, draftWaiting: true })).toEqual({ kind: "team", href: `${base}/settings#team-members` });
    expect(live({ facts: { ...facts, requests: { open: 0, rights: 0 } }, draftWaiting: true })).toEqual({ kind: "expiring", href: `${base}/candidates` });
    expect(live({ draftWaiting: true })).toEqual({ kind: "draft", href: base });
    expect(live({ facts: { invited: 0, expiringSoon: 0, requests: { open: 0, rights: 0 } } })).toEqual({ kind: "invite", href: "/hiring/invite?opening=o1" });
    expect(live()).toEqual({ kind: "candidates", href: `${base}/candidates` });
  });

  it("counts a data-rights request but never sends anyone to act on it before plan 3 (ruling C6)", () => {
    expect(live({ facts: { invited: 4, expiringSoon: 0, requests: { open: 0, rights: 2 } } }).kind).toBe("candidates");
  });

  it("a reviewer gets 'Aç' on every row, whatever waits (H9); a closed opening too (KG1)", () => {
    const facts = { invited: 4, expiringSoon: 2, requests: { open: 3, rights: 1 } };
    expect(openingNextStep({ id, status: "OPEN", runs: false, facts, shortfall: true })).toEqual({ kind: "open", href: base });
    expect(openingNextStep({ id, status: "DRAFT", runs: false, setup: { key: "team", href: "/x" } })).toEqual({ kind: "open", href: base });
    expect(openingNextStep({ id, status: "CLOSED", runs: true, facts })).toEqual({ kind: "open", href: base });
  });
});

describe("the control view's page rules (H8, KG4)", () => {
  it("keeps the old ?tab= links working", () => {
    expect(cockpitTab("draft")).toBe("draft");
    expect(cockpitTab("open")).toBe("open");
    expect(cockpitTab(["closed", "x"])).toBe("closed");
    expect(cockpitTab("all")).toBeNull();
    expect(cockpitTab(undefined)).toBeNull();
  });

  it("counts what is under way, in setup, and waiting for the viewer; closed openings are not under way", () => {
    const rows = [
      { status: "DRAFT" as const, next: { kind: "setup" as const } },
      { status: "DRAFT" as const, next: { kind: "continueSetup" as const } },
      { status: "OPEN" as const, next: { kind: "requests" as const } },
      { status: "OPEN" as const, next: { kind: "team" as const } },
      { status: "OPEN" as const, next: { kind: "candidates" as const } },
      { status: "CLOSED" as const, next: { kind: "open" as const } },
    ];
    expect(cockpitCounts(rows)).toEqual({ running: 5, setup: 2, waiting: 2 });
  });

  it("fills the small funnel with the share of invited people who started, never past full", () => {
    expect(funnelShare({ invited: 0, started: 0 })).toBe(0);
    expect(funnelShare({ invited: 8, started: 6 })).toBe(0.75);
    expect(funnelShare({ invited: 2, started: 3 })).toBe(1);
  });
});
```

Append to `src/solutions/hiring/server/invitations.test.ts` (and add `openingCardFacts` to its import at `:11`):

```ts
describe("openingCardFacts (4.4, H9, rulings C6 and C21)", () => {
  const OP2 = "99999999-9999-4999-8999-999999999999";
  const facts = (op: Op): unknown[] => {
    if (op.table === "hiring_assessments")
      return [
        { assessmentId: "a1", openingId: OPENING, candidateId: "c1" },
        { assessmentId: "a2", openingId: OPENING, candidateId: "c2" },
        { assessmentId: "a3", openingId: OP2, candidateId: "c3" },
      ];
    if (op.table === "attempts") return [{ assessmentId: "a1", completedAt: NOW }, { assessmentId: "a2", completedAt: null }];
    if (op.table === "assessment_links") return [{ assessmentId: "a3" }];
    if (op.table === "candidate_requests") return [{ assessmentId: "a2" }, { assessmentId: "a2" }];
    // The same data-rights request reached through two rows: counted once.
    if (op.table === "deletion_requests") return [{ id: "d1", candidateId: "c1" }, { id: "d1", candidateId: "c1" }];
    return [];
  };
  beforeEach(() => {
    fake.respond = facts;
  });

  it("counts invited, started and completed as the funnel does, links expiring within 48 hours, and the requests of someone who runs openings", async () => {
    expect(await openingCardFacts(ORG, [OPENING, OP2], { runs: true }, NOW)).toEqual({
      [OPENING]: { invited: 2, started: 2, completed: 1, expiringSoon: 0, requests: { open: 2, rights: 1 } },
      [OP2]: { invited: 1, started: 0, completed: 0, expiringSoon: 1, requests: { open: 0, rights: 0 } },
    });
    const invitations = fake.ops.find((o) => o.table === "hiring_assessments")!;
    expect(invitations.params).toContain(ORG);
    expect(invitations.joins.join(" ")).toContain('"candidates"."deleted_at" is null');
    expect(fake.ops.find((o) => o.table === "attempts")!.where).toContain('"attempts"."is_primary" = $');
    expect(fake.ops.find((o) => o.table === "candidate_requests")!.params).toContain(ORG);
    expect(fake.ops.find((o) => o.table === "deletion_requests")!.params).toContain(ORG);
    const links = fake.ops.find((o) => o.table === "assessment_links")!;
    // Dates reach the driver as ISO strings (as in candidate.test.ts:685).
    expect(links.params).toEqual(expect.arrayContaining([NOW.toISOString(), new Date(NOW.getTime() + 48 * 3600 * 1000).toISOString()]));
  });

  it("gives a reviewer counts only: no requests key, and no request is read (H9, STATUS 321)", async () => {
    const result = await openingCardFacts(ORG, [OPENING], { runs: false }, NOW);
    expect(result[OPENING]).toEqual({ invited: 2, started: 2, completed: 1, expiringSoon: 0 });
    expect(result[OPENING]).not.toHaveProperty("requests");
    expect(fake.ops.some((o) => o.table === "candidate_requests" || o.table === "deletion_requests")).toBe(false);
  });

  it("runs its reads one after another (ruling C21), and reads nothing for no openings", async () => {
    const seen: number[] = [];
    fake.respond = (op) => {
      seen.push(fake.ops.length);
      return facts(op);
    };
    await openingCardFacts(ORG, [OPENING, OP2], { runs: true }, NOW);
    expect(fake.ops.map((o) => o.table)).toEqual(["hiring_assessments", "attempts", "assessment_links", "candidate_requests", "deletion_requests"]);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
    fake.ops = [];
    expect(await openingCardFacts(ORG, [], { runs: true })).toEqual({});
    expect(await openingCardFacts(ORG, ["not-a-uuid"], { runs: true })).toEqual({});
    expect(fake.ops).toEqual([]);
  });
});
```

```ts
// src/app/(manager)/hiring/openings/cockpit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, type Op } from "@/solutions/hiring/server/test-fake-db";
import type { OpeningListRow } from "@/solutions/hiring/server/openings";

vi.mock("@/db", async () => ({ db: (await import("@/solutions/hiring/server/test-fake-db")).fakeDb() }));

const ORG = "11111111-1111-4111-8111-111111111111";
const D1 = "21111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";
const O1 = "33333333-3333-4333-8333-333333333333";

const listed = (id: string, status: OpeningListRow["status"], over: Partial<OpeningListRow> = {}): OpeningListRow => ({
  id,
  name: id,
  status,
  deadlineAt: null,
  positionName: "P",
  ownerName: null,
  liveNumber: status === "DRAFT" ? null : 1,
  draftNumber: null,
  decisionMakerId: null,
  memberIds: [],
  ...over,
});
const lists = vi.hoisted(() => ({ byStatus: {} as Record<string, unknown[]> }));
vi.mock("@/solutions/hiring/server/openings", () => ({ listOpenings: async (_org: string, _viewer: unknown, status: string) => lists.byStatus[status] ?? [] }));
const reads = vi.hoisted(() => ({ working: vi.fn(async () => ({})), people: vi.fn(async () => []) }));
vi.mock("@/solutions/hiring/server/working", () => ({ workingState: reads.working }));
vi.mock("@/server/settings", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/settings")>()), loadPanelUsers: reads.people }));
vi.mock("./[id]/setup-steps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./[id]/setup-steps")>()),
  // Two steps: the assessment is done, the team is advice.
  setupRowsOf: () => [
    { key: "assessment", state: "done", href: null },
    { key: "team", state: "advisory", href: `/hiring/openings/x/settings#team-members` },
  ],
}));

import { managerT } from "@/i18n/manager";
import { loadCockpit, SETUP_BUDGET_MS } from "./cockpit";

function respond(op: Op): unknown[] {
  if (op.table === "hiring_assessments") return [{ assessmentId: "a1", openingId: O1, candidateId: "c1" }];
  if (op.table === "candidate_requests") return [{ assessmentId: "a1" }];
  if (op.table === "hiring_openings") return [{ id: O1, name: "O1", deadlineAt: null, minEvaluations: 3 }];
  if (op.table === "hiring_versions") return [{ openingId: O1 }];
  if (op.table === "hiring_opening_members") return [{ openingId: O1, count: 1 }];
  return [];
}

const owner = { id: "u1", orgId: ORG, role: "OWNER" as const };
const reviewer = { id: "u2", orgId: ORG, role: "REVIEWER" as const };

beforeEach(() => {
  lists.byStatus = { DRAFT: [listed(D1, "DRAFT"), listed(D2, "DRAFT")], OPEN: [listed(O1, "OPEN")], CLOSED: [] };
  reads.working.mockClear();
  reads.people.mockClear();
  fake.ops = [];
  fake.respond = respond;
});

describe("the openings' control view (4.4, H9, D14)", () => {
  it("someone who runs openings: a draft's setup count and next step, a live opening's requests first", async () => {
    const cockpit = await loadCockpit(owner, managerT("tr"), "tr");
    expect(cockpit.runs).toBe(true);
    expect(cockpit.drafts.map((r) => [r.setup, r.next.kind, r.next.setupKey])).toEqual([
      [{ done: 1, total: 3 }, "setup", "team"],
      [{ done: 1, total: 3 }, "setup", "team"],
    ]);
    expect(cockpit.open[0]).toMatchObject({ facts: { invited: 1, requests: { open: 1, rights: 0 } }, shortfall: { evaluators: 1, min: 3 }, next: { kind: "requests" } });
    expect(reads.people).toHaveBeenCalledTimes(1);
  });

  it("a reviewer: counts only, no request field, no setup, no team rule, every row 'Aç' (H9, STATUS 321)", async () => {
    const cockpit = await loadCockpit(reviewer, managerT("tr"), "tr");
    const rows = [...cockpit.drafts, ...cockpit.open];
    expect(rows.map((r) => r.next.kind)).toEqual(["open", "open", "open"]);
    expect(cockpit.open[0].facts).not.toHaveProperty("requests");
    expect(rows.every((r) => r.setup === null && r.shortfall === null)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("requests");
    expect(fake.ops.some((o) => o.table === "candidate_requests" || o.table === "deletion_requests" || o.table === "hiring_openings")).toBe(false);
    expect(reads.working).not.toHaveBeenCalled();
    expect(reads.people).not.toHaveBeenCalled();
  });

  it("stops reading setup paths past the time budget; the rest say 'Kuruluma devam et' without a count (D14)", async () => {
    let now = 0;
    const clock = () => (now += SETUP_BUDGET_MS);
    const cockpit = await loadCockpit(owner, managerT("tr"), "tr", clock);
    expect(cockpit.drafts.map((r) => [r.setup?.total ?? null, r.next.kind])).toEqual([
      [3, "setup"],
      [null, "continueSetup"],
    ]);
    expect(reads.working).toHaveBeenCalledTimes(1);
  });
});
```

Run: `pnpm exec vitest run "src/app/(manager)/hiring/openings" src/components/hiring/opening-next-step.test.ts src/solutions/hiring/server/invitations.test.ts`
Expected: FAIL (modules and `openingCardFacts` missing).

- [ ] **Step 2: The server reads**

`openings.ts`: in `OpeningListRow` (`:31-40`) after `draftNumber` add

```ts
  /** The control view's setup path and team line (4.4) read these; listOpenings has them already. */
  decisionMakerId: string | null;
  memberIds: string[];
```

and in the returned row (after `draftNumber:` at `:93`): `decisionMakerId: r.decisionMakerId,` and `memberIds: members.filter((m) => m.openingId === r.id).map((m) => m.userId),`. (`tenancy.test.ts` checks the row count only; no other caller builds an `OpeningListRow`.)

`invitations.ts`: the `drizzle-orm` import (`:1`) gains `gt` and `lt`; the `../rules/invitation` import gains `EXPIRING_SOON_MS` (after `cleanInviteName,`, `:32`); after `releasedSurvey` insert:

```ts
/**
 * HIRING-VISUAL-FLOW 4.4 (KG1, KG4, H9): what an opening's row in the control
 * view says. `requests` is there only for someone who runs openings, and only
 * then are requests read at all (STATUS 321): open candidate requests
 * (accommodation, new link) and data-rights requests (counted, handled with
 * plan 3, ruling C6). A reviewer's facts have no `requests` key.
 */
export type OpeningCardFacts = {
  invited: number;
  started: number;
  completed: number;
  /** Links not finished that expire within EXPIRING_SOON_MS (a count, so a reviewer sees it too, H9). */
  expiringSoon: number;
  requests?: { open: number; rights: number };
};

/**
 * The facts of many openings at once. Invited, started and completed count
 * what the overview's funnel counts (openingFunnel): this organisation's
 * invitations of people not deleted, each counted once by its primary attempt.
 * Every read is scoped to the organisation (attempts, links and requests
 * through the invitations read first) and runs after the one before (ruling
 * C21: the pool of five connections is shared with the live exam's writes).
 */
export async function openingCardFacts(orgId: string, openingIds: string[], viewer: { runs: boolean }, now: Date = new Date()): Promise<Record<string, OpeningCardFacts>> {
  const ids = openingIds.filter(isUuid);
  if (ids.length === 0) return {};
  const blank = (): OpeningCardFacts => ({ invited: 0, started: 0, completed: 0, expiringSoon: 0, ...(viewer.runs ? { requests: { open: 0, rights: 0 } } : {}) });
  const facts: Record<string, OpeningCardFacts> = Object.fromEntries(ids.map((id) => [id, blank()]));
  const invitations = await db
    .select({ assessmentId: hiringAssessments.assessmentId, openingId: hiringAssessments.openingId, candidateId: candidates.id })
    .from(hiringAssessments)
    .innerJoin(assessments, and(eq(assessments.id, hiringAssessments.assessmentId), eq(assessments.orgId, orgId)))
    .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
    .where(and(eq(hiringAssessments.orgId, orgId), inArray(hiringAssessments.openingId, ids)));
  if (invitations.length === 0) return facts;
  const assessmentIds = invitations.map((i) => i.assessmentId);
  const tries = await db
    .select({ assessmentId: attempts.assessmentId, completedAt: attempts.completedAt })
    .from(attempts)
    .where(and(inArray(attempts.assessmentId, assessmentIds), eq(attempts.isPrimary, true), isNotNull(attempts.startedAt)));
  const expiring = await db
    .select({ assessmentId: assessmentLinks.assessmentId })
    .from(assessmentLinks)
    .where(
      and(
        inArray(assessmentLinks.assessmentId, assessmentIds),
        inArray(assessmentLinks.status, ["NOT_STARTED", "IN_PROGRESS"]),
        gt(assessmentLinks.expiresAt, now),
        lt(assessmentLinks.expiresAt, new Date(now.getTime() + EXPIRING_SOON_MS)),
      ),
    );
  const requests = viewer.runs
    ? await db
        .select({ assessmentId: candidateRequests.assessmentId })
        .from(candidateRequests)
        .where(and(eq(candidateRequests.orgId, orgId), inArray(candidateRequests.assessmentId, assessmentIds), isNull(candidateRequests.handledAt)))
    : [];
  const rights = viewer.runs
    ? await db
        .select({ id: deletionRequests.id, candidateId: deletionRequests.candidateId })
        .from(deletionRequests)
        .innerJoin(candidates, and(eq(candidates.id, deletionRequests.candidateId), eq(candidates.orgId, orgId)))
        .where(and(inArray(deletionRequests.candidateId, [...new Set(invitations.map((i) => i.candidateId))]), isNull(deletionRequests.handledAt)))
    : [];
  for (const inv of invitations) {
    const f = facts[inv.openingId];
    if (!f) continue;
    // One row per invitation, as the funnel counts it: its first primary attempt that started.
    const first = tries.find((a) => a.assessmentId === inv.assessmentId);
    f.invited += 1;
    if (first) f.started += 1;
    if (first?.completedAt) f.completed += 1;
    f.expiringSoon += expiring.filter((l) => l.assessmentId === inv.assessmentId).length;
    if (f.requests) f.requests.open += requests.filter((r) => r.assessmentId === inv.assessmentId).length;
  }
  // A data-rights request belongs to the person: counted once in each opening the person was invited to.
  for (const [openingId, f] of Object.entries(facts)) {
    if (!f.requests) continue;
    const people = new Set(invitations.filter((i) => i.openingId === openingId).map((i) => i.candidateId));
    f.requests.rights = new Set(rights.filter((r) => people.has(r.candidateId)).map((r) => r.id)).size;
  }
  return facts;
}
```

- [ ] **Step 3: The pure rules**

```ts
// src/app/(manager)/hiring/openings/[id]/setup-steps.ts
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { canDecide, type Viewer } from "@/solutions/hiring/rules/access";
import { previewIsCurrent } from "@/solutions/hiring/rules/versions";
import type { WorkingState } from "@/solutions/hiring/server/working";
import { describeProblem } from "./problems";
import { readinessRows, rowHref, type ReadinessKey, type ReadinessRow, type ReadinessState } from "./readiness";

/** A step of a draft's setup path (4.5): the readiness rows, then "Yayınla". */
export type SetupKey = ReadinessKey | "publish";
export type SetupRow = { key: ReadinessKey; state: ReadinessState; href: string | null; row: ReadinessRow; fixText: string | null };
export type SetupProgress = { done: number; total: number; left: number; current: number };
export type SetupNext = { key: SetupKey; href: string };

/** The step's words: the overview's row labels (hiringOverview.*). */
export const SETUP_LABEL = {
  assessment: "rowAssessment",
  anchors: "rowAnchors",
  weights: "rowWeights",
  team: "rowTeam",
  preview: "rowPreview",
  publish: "rowPublish",
} as const satisfies Record<SetupKey, string>;

/** Team and preview are advice (STATUS decision 7): "Atla ›" passes them; a missing row cannot be skipped. */
const SKIPPABLE: ReadonlySet<ReadinessKey> = new Set(["team", "preview"]);
const passed = (r: { key: ReadinessKey; state: ReadinessState }, skipped: readonly ReadinessKey[]) => r.state === "done" || (r.state === "advisory" && SKIPPABLE.has(r.key) && skipped.includes(r.key));

/**
 * HIRING-VISUAL-FLOW 4.5 (P6, H7): a draft's readiness rows read as one path
 * ending in "Yayınla". "Kurulum n / N" and "k adım kaldı" answer "how far am
 * I?"; `current` (the first row neither done nor skipped, else the publish
 * step) answers "what now?". Skipping never counts as done.
 */
export function setupProgress(rows: ReadonlyArray<{ key: ReadinessKey; state: ReadinessState }>, skipped: readonly ReadinessKey[] = []): SetupProgress {
  const done = rows.filter((r) => r.state === "done").length;
  const total = rows.length + 1;
  const firstOpen = rows.findIndex((r) => !passed(r, skipped));
  return { done, total, left: total - done, current: firstOpen < 0 ? rows.length : firstOpen };
}

/**
 * KG3, H7: where "Kuruluma devam et" and a cockpit row's "Sıradaki: … ›" go:
 * the first step neither done nor skipped, to the place that fixes it (the
 * row's href), and the publish summary when nothing is left before it.
 */
export function setupNext(rows: ReadonlyArray<Pick<SetupRow, "key" | "state" | "href">>, openingId: string, skipped: readonly ReadinessKey[] = []): SetupNext {
  const base = `/hiring/openings/${openingId}`;
  const next = rows.find((r) => !passed(r, skipped));
  if (!next) return { key: "publish", href: `${base}#publish` };
  return { key: next.key, href: next.href ?? base };
}

/** KG3: the team step opens the team flow (4.10) at the decision it lacks: who reviews while nobody is on the team, else who decides. */
export function teamHref(openingId: string, input: { memberCount: number; decisionMakerActive: boolean }): string {
  const base = `/hiring/openings/${openingId}/settings`;
  return input.memberCount > 0 && !input.decisionMakerActive ? `${base}#team-decider` : `${base}#team-members`;
}

/** `?skip=team,preview` after "Atla ›": only the advisory steps, each once. */
export function setupSkips(value: string | string[] | undefined): ReadinessKey[] {
  const raw = (Array.isArray(value) ? value.join(",") : (value ?? "")).split(",");
  return [...new Set(raw.filter((k): k is ReadinessKey => k === "team" || k === "preview"))];
}

/**
 * The setup rows of an opening's draft, with the page that fixes each one
 * (describeProblem's link for a gate problem). `people` are the
 * organisation's users (one loadPanelUsers per page): the team row asks for an
 * active owner or manager as decision maker. No draft or no content: no rows.
 */
export function setupRowsOf(input: {
  state: Pick<WorkingState, "draft" | "content" | "facts" | "problems">;
  opening: { id: string; memberIds: readonly string[]; decisionMakerId: string | null };
  people: ReadonlyArray<{ id: string; role: Viewer["role"]; disabledAt: Date | null }>;
  t: ReturnType<typeof managerT>;
  locale: Locale;
}): SetupRow[] {
  const { state, opening, people, t, locale } = input;
  const content = state.content;
  if (!state.draft || !content) return [];
  const decider = people.find((u) => u.id === opening.decisionMakerId && u.disabledAt === null);
  const team = { memberCount: opening.memberIds.length, decisionMakerActive: decider !== undefined && canDecide(decider.role) };
  const rows = readinessRows({ problems: state.problems, content, previewed: previewIsCurrent(state.draft), ...team });
  return rows.map((row) => {
    const fix = row.problem ? describeProblem(row.problem, { content, facts: state.facts, locale, openingId: opening.id }, t) : null;
    const href = row.key === "team" ? teamHref(opening.id, team) : rowHref(row, fix?.href, opening.id);
    return { key: row.key, state: row.state, href, row, fixText: fix?.text ?? null };
  });
}
```

```ts
// src/components/hiring/opening-next-step.ts
/**
 * HIRING-VISUAL-FLOW 4.4 (KG1-KG5, H8, H9): the openings' control view as
 * pure rules. Each opening is one row with one next step, chosen here by one
 * rule (KG2); each step opens the flow or page that fixes it (KG3).
 */
export type OpeningNextKind = "setup" | "continueSetup" | "requests" | "team" | "expiring" | "draft" | "invite" | "candidates" | "open";
export type OpeningNext<K extends string = string> = { kind: OpeningNextKind; href: string; setupKey?: K };

/**
 * KG2: the one next step of an opening's row.
 * - Someone who does not run openings (a reviewer, H9) and every closed opening: "Aç ›" (KG1: one action;
 *   the overview of a closed opening carries "Ekip ve kurallarda yeniden aç").
 * - Draft: the setup path's next step ("Sıradaki: Ekibi ata ›"); "Kuruluma devam et ›" to the overview when
 *   the step was not computed (the time budget, D14).
 * - Live, in this order: open candidate requests (data-rights requests are only counted, ruling C6),
 *   a team below the rule (panelShortfall), links expiring within 48 hours, a draft version waiting,
 *   no invitation yet, else the candidates.
 */
export function openingNextStep<K extends string>(input: {
  id: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  runs: boolean;
  setup?: { key: K; href: string } | null;
  facts?: { invited: number; expiringSoon: number; requests?: { open: number; rights: number } } | null;
  shortfall?: boolean;
  draftWaiting?: boolean;
}): OpeningNext<K> {
  const base = `/hiring/openings/${input.id}`;
  if (!input.runs || input.status === "CLOSED") return { kind: "open", href: base };
  if (input.status === "DRAFT") return input.setup ? { kind: "setup", href: input.setup.href, setupKey: input.setup.key } : { kind: "continueSetup", href: base };
  const facts = input.facts ?? { invited: 0, expiringSoon: 0 };
  if ((facts.requests?.open ?? 0) > 0) return { kind: "requests", href: `${base}/candidates` };
  if (input.shortfall) return { kind: "team", href: `${base}/settings#team-members` };
  if (facts.expiringSoon > 0) return { kind: "expiring", href: `${base}/candidates` };
  if (input.draftWaiting) return { kind: "draft", href: base };
  if (facts.invited === 0) return { kind: "invite", href: `/hiring/invite?opening=${input.id}` };
  return { kind: "candidates", href: `${base}/candidates` };
}

/** H8: the old route tabs become groups; `?tab=` keeps working (draft and open scroll to their group, closed opens the closed ones). */
export function cockpitTab(value: string | string[] | undefined): "draft" | "open" | "closed" | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "draft" || v === "open" || v === "closed" ? v : null;
}

/** KG4: the one-sentence summary's numbers: openings under way, in setup, and those whose next step waits for the viewer. */
export function cockpitCounts(rows: ReadonlyArray<{ status: "DRAFT" | "OPEN" | "CLOSED"; next: { kind: OpeningNextKind } }>): { running: number; setup: number; waiting: number } {
  const live = rows.filter((r) => r.status !== "CLOSED");
  return {
    running: live.length,
    setup: live.filter((r) => r.status === "DRAFT").length,
    waiting: live.filter((r) => r.status === "OPEN" && (["requests", "team", "expiring", "draft"] as OpeningNextKind[]).includes(r.next.kind)).length,
  };
}

/** The small funnel under a live row: how many of those invited started (0..1). */
export const funnelShare = (facts: { invited: number; started: number }): number => (facts.invited > 0 ? Math.min(1, facts.started / facts.invited) : 0);
```

- [ ] **Step 4: The row and the loader**

```tsx
// src/components/manager/control-row.tsx
// kademe-owned
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ControlAttention = { key: string; icon: LucideIcon; text: ReactNode; note?: ReactNode };

const ACTION =
  "inline-flex min-h-11 items-center gap-0.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";

/** A link to another page is a Next link; one with a hash is a plain anchor, so the flow on that page hears the hash (W3). */
function ToLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return href.includes("#") ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/**
 * KG1 (K12): one object, one row, one next step. The name opens the object;
 * status as dot and words; progress (a setup count or a small funnel); what
 * needs attention, only when something does; the facts (team, last day); and
 * one text action on the right ("Sıradaki: Ekibi ata ›"). No filled button on
 * a row: the page's one filled button is its own work (KG5). Columns line up
 * from 1024px; below it the row stacks.
 */
export function ControlRow({
  title,
  href,
  status,
  progress,
  attention = [],
  facts,
  next,
}: {
  title: ReactNode;
  href: string;
  status: ReactNode;
  progress?: ReactNode;
  attention?: ControlAttention[];
  facts?: ReactNode;
  next: { label: ReactNode; href: string } | null;
}) {
  return (
    <li className="grid gap-x-6 gap-y-2 px-5 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]">
      <div className="min-w-0">
        <ToLink href={href} className="text-[15px] leading-6 font-semibold text-ink hover:underline">
          {title}
        </ToLink>
        <div className="mt-1 text-[13px] leading-5">{status}</div>
      </div>
      <div className="min-w-0 text-[13px] leading-5 text-ink-2">{progress}</div>
      <ul className="min-w-0 space-y-1">
        {attention.map(({ key, icon: Icon, text, note }) => (
          <li key={key} className="flex gap-2 text-[13px] leading-5 text-ink">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0">
              {text}
              {note ? <span className="block text-muted">{note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="tnum min-w-0 text-[13px] leading-5 text-muted lg:text-right">{facts}</div>
      {next ? (
        <div className="flex justify-end lg:col-span-4">
          <ToLink href={next.href} className={ACTION}>
            {next.label}
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </ToLink>
        </div>
      ) : null}
    </li>
  );
}
```

```ts
// src/app/(manager)/hiring/openings/cockpit.ts
import { panelShortfall } from "@/components/hiring/invite/form-rules";
import { openingNextStep, type OpeningNext } from "@/components/hiring/opening-next-step";
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { can } from "@/lib/authorize";
import { loadPanelUsers } from "@/server/settings";
import type { Viewer } from "@/solutions/hiring/rules/access";
import { invitableOpenings, openingCardFacts, type OpeningCardFacts } from "@/solutions/hiring/server/invitations";
import { listOpenings, type OpeningListRow } from "@/solutions/hiring/server/openings";
import { workingState } from "@/solutions/hiring/server/working";
import { setupNext, setupProgress, setupRowsOf, type SetupKey } from "./[id]/setup-steps";

/** D14: the drafts' setup paths are read one draft after another until this much time went by; the rest say "Kuruluma devam et ›" without a count. */
export const SETUP_BUDGET_MS = 300;

export type CockpitRow = {
  opening: OpeningListRow;
  /** Live and closed openings (the funnel and the expiring links); null for a draft. */
  facts: OpeningCardFacts | null;
  /** A draft's "Kurulum n / N" for someone who runs openings; null otherwise or past the budget. */
  setup: { done: number; total: number } | null;
  /** A live opening's team below its rule (panelShortfall), for someone who runs openings. */
  shortfall: { evaluators: number; min: number } | null;
  next: OpeningNext<SetupKey>;
};

/**
 * HIRING-VISUAL-FLOW 4.4: everything the openings' control view shows, read
 * one statement after another (ruling C21). A reviewer's openings are only
 * the ones they are on (listOpenings), with counts only (H9): no request is
 * read, no setup path is computed, no team rule is checked. `clock` is the
 * budget's clock (tests pass their own).
 */
export async function loadCockpit(
  user: Viewer & { orgId: string },
  t: ReturnType<typeof managerT>,
  locale: Locale,
  clock: () => number = Date.now,
): Promise<{ runs: boolean; drafts: CockpitRow[]; open: CockpitRow[]; closed: CockpitRow[] }> {
  const runs = can(user, "opening:write");
  const drafts = await listOpenings(user.orgId, user, "DRAFT");
  const open = await listOpenings(user.orgId, user, "OPEN");
  const closed = await listOpenings(user.orgId, user, "CLOSED");
  const facts = await openingCardFacts(user.orgId, [...open, ...closed].map((o) => o.id), { runs });
  const invitable = runs && open.length > 0 ? await invitableOpenings(user.orgId) : [];
  const setups = new Map<string, { done: number; total: number; next: { key: SetupKey; href: string } }>();
  if (runs && drafts.length > 0) {
    const people = await loadPanelUsers(user.orgId);
    const started = clock();
    for (const draft of drafts) {
      if (clock() - started > SETUP_BUDGET_MS) break;
      const rows = setupRowsOf({ state: await workingState(user.orgId, draft.id), opening: draft, people, t, locale });
      if (rows.length === 0) continue;
      const progress = setupProgress(rows);
      setups.set(draft.id, { done: progress.done, total: progress.total, next: setupNext(rows, draft.id) });
    }
  }
  const row = (opening: OpeningListRow): CockpitRow => {
    const f = opening.status === "DRAFT" ? null : (facts[opening.id] ?? null);
    const setup = setups.get(opening.id) ?? null;
    const shortfall = runs && opening.status === "OPEN" ? panelShortfall(invitable.find((o) => o.id === opening.id) ?? null) : null;
    return {
      opening,
      facts: f,
      setup: setup ? { done: setup.done, total: setup.total } : null,
      shortfall,
      next: openingNextStep({
        id: opening.id,
        status: opening.status,
        runs,
        setup: setup?.next ?? null,
        facts: f,
        shortfall: shortfall !== null,
        draftWaiting: opening.liveNumber !== null && opening.draftNumber !== null,
      }),
    };
  };
  return { runs, drafts: drafts.map(row), open: open.map(row), closed: closed.map(row) };
}
```

```tsx
// src/app/(manager)/hiring/openings/scroll-to.tsx
"use client";

import { useEffect } from "react";

/** H8: an old `?tab=` link lands on its group: the page scrolls there once, after it is drawn. */
export function ScrollTo({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}
```

- [ ] **Step 5: The page**

Replace `src/app/(manager)/hiring/openings/page.tsx` with:

```tsx
import Link from "next/link";
import { Clock, FileText, Inbox, Users } from "lucide-react";
import { funnelShare, cockpitCounts, cockpitTab } from "@/components/hiring/opening-next-step";
import { PageTitle } from "@/components/manager/page-title";
import { ControlRow, type ControlAttention } from "@/components/manager/control-row";
import { EmptyState } from "@/components/manager/empty-state";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { Disclosure } from "@/components/visual/disclosure";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";
import { requireUser } from "@/server/session";
import { TONE } from "./[id]/opening-header";
import { SETUP_LABEL } from "./[id]/setup-steps";
import { loadCockpit, type CockpitRow } from "./cockpit";
import { ScrollTo } from "./scroll-to";

export const dynamic = "force-dynamic";

type T = ReturnType<typeof managerT>;

const NEXT_LABEL = {
  requests: "hiringOpenings.nextRequests",
  team: "hiringOpenings.nextTeam",
  expiring: "hiringOpenings.nextExpiring",
  invite: "hiringOpenings.nextInvite",
  candidates: "hiringOpenings.nextCandidates",
  open: "hiringOpenings.nextOpen",
  continueSetup: "hiringCommon.continueSetup",
  draft: "hiringCommon.continueSetup",
} as const;

/** One opening as a control row (KG1): status, progress, what needs attention, team and last day, and its one next step. */
function Row({ row, userId, runs, locale, t }: { row: CockpitRow; userId: string; runs: boolean; locale: Locale; t: T }) {
  const o = row.opening;
  const f = row.facts;
  const status = (
    <StatusDot tone={TONE[o.status]}>
      <span className="tnum">{[t(`hiringCommon.status${o.status}`), o.liveNumber ? `v${o.liveNumber}` : null].filter(Boolean).join(" · ")}</span>
    </StatusDot>
  );
  const progress =
    o.status === "DRAFT" ? (
      row.setup ? (
        <>
          <p className="tnum">{t("hiringOverview.setupCount", { done: row.setup.done, total: row.setup.total })}</p>
          <span aria-hidden className="mt-1.5 flex gap-1">
            {Array.from({ length: row.setup.total }, (_, i) => (
              <span key={i} className={cn("h-1.5 w-6 rounded-full", row.setup && i < row.setup.done ? "bg-ink-3" : "bg-hairline")} />
            ))}
          </span>
        </>
      ) : null
    ) : f && f.invited > 0 ? (
      <>
        <p className="tnum">{t("hiringOpenings.funnelLine", { invited: f.invited, started: f.started, completed: f.completed })}</p>
        <div aria-hidden className="mt-1.5 h-1.5 max-w-40 overflow-hidden rounded-full bg-hairline">
          <div className="h-1.5 rounded-full bg-ink-3" style={{ width: `${Math.round(funnelShare(f) * 100)}%` }} />
        </div>
      </>
    ) : (
      <p className="text-muted">{t("hiringOpenings.funnelEmpty")}</p>
    );
  const requests = f?.requests ? f.requests.open + f.requests.rights : 0;
  const attention: ControlAttention[] = [
    // H9: requests, the team rule and a waiting draft only for someone who runs openings (their facts alone carry them).
    ...(f?.requests && requests > 0
      ? [{ key: "requests", icon: Inbox, text: t("hiringCommon.openRequests", { count: requests }), note: f.requests.rights > 0 ? t("hiringCommon.rightsNote", { count: f.requests.rights }) : undefined }]
      : []),
    ...(row.shortfall ? [{ key: "team", icon: Users, text: t("hiringCommon.teamShort", { evaluators: row.shortfall.evaluators, min: row.shortfall.min }) }] : []),
    ...(f && f.expiringSoon > 0 ? [{ key: "expiring", icon: Clock, text: t("hiringCommon.expiringLinks", { count: f.expiringSoon }) }] : []),
    ...(runs && o.liveNumber && o.draftNumber ? [{ key: "draft", icon: FileText, text: t("hiringCommon.draftWaitingPublish", { number: o.draftNumber }) }] : []),
  ];
  const team =
    o.memberIds.length === 0 ? t("hiringOpenings.teamNone") : o.memberIds.length === 1 && o.memberIds[0] === userId ? t("hiringOpenings.teamOnlyYou") : t("hiringOpenings.teamCount", { count: o.memberIds.length });
  const facts = (
    <>
      <span className="block">{o.deadlineAt ? t("hiringCommon.deadline", { date: shortDate(o.deadlineAt, locale) }) : t("hiringCommon.noDeadline")}</span>
      <span className="block">{team}</span>
    </>
  );
  const next = row.next;
  const label = next.kind === "setup" && next.setupKey ? t("hiringOverview.setupNext", { step: t(`hiringOverview.${SETUP_LABEL[next.setupKey]}`) }) : t(NEXT_LABEL[next.kind === "setup" ? "continueSetup" : next.kind]);
  return (
    <ControlRow
      title={
        <>
          {o.name}
          <span className="block text-[13px] font-normal text-muted">{o.positionName}</span>
        </>
      }
      href={`/hiring/openings/${o.id}`}
      status={status}
      progress={progress}
      attention={attention}
      facts={facts}
      next={{ label, href: next.href }}
    />
  );
}

function Group({ id, title, columns, children }: { id: string; title: string; columns: [string, string, string, string]; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2 id={`${id}-title`} className="mb-3 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
        {title}
      </h2>
      <Card className="overflow-hidden">
        <div aria-hidden className="hidden gap-x-6 border-b border-line px-5 py-2 text-[12px] text-muted lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]">
          {columns.map((c, i) => (
            <span key={c} className={i === 3 ? "text-right" : undefined}>
              {c}
            </span>
          ))}
        </div>
        <ul className="divide-y divide-line">{children}</ul>
      </Card>
    </section>
  );
}

/**
 * HIRING-VISUAL-FLOW 4.4 (K12, H1, H8): the control view of hiring. Every
 * opening is one row with its one next step, in groups on one page: in setup,
 * live, and the closed ones behind a disclosure. The page's one filled button
 * is "Alım aç" (KG5). A reviewer sees the openings they are on, counts only
 * (H9). The old route tabs' links (`?tab=`) land on their group.
 */
export default async function OpeningsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const tab = cockpitTab(sp.tab);
  const { runs, drafts, open, closed } = await loadCockpit(user, t, locale);
  const total = drafts.length + open.length + closed.length;
  const addButton = runs ? (
    <Button asChild variant="primary">
      <Link href="/hiring/openings/new">{t("hiringOpenings.add")}</Link>
    </Button>
  ) : (
    <>
      <Button variant="primary" disabled disabledReason={t("hiringOpenings.noPermission")}>
        {t("hiringOpenings.add")}
      </Button>
      <DisabledReason>{t("hiringOpenings.noPermission")}</DisabledReason>
    </>
  );

  if (total === 0) {
    return (
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <PageTitle title={t("hiringOpenings.title")} sub={t("hiringOpenings.sub")} />
        {runs ? (
          <EmptyState className="mt-section" illustration="emptyOpenings" title={t("hiringOpenings.emptyTitle")} body={t("hiringOpenings.emptyBody")} action={addButton} />
        ) : (
          // A reviewer sees only the openings they work on and cannot open one: no button to stare at.
          <EmptyState className="mt-section" illustration="emptyOpenings" title={t("hiringOpenings.emptyViewerTitle")} body={t("hiringOpenings.emptyViewerBody")} />
        )}
      </main>
    );
  }

  const counts = cockpitCounts([...drafts, ...open, ...closed].map((r) => ({ status: r.opening.status, next: r.next })));
  const summary = runs
    ? [
        t("hiringOpenings.summaryRunning", { count: counts.running }),
        counts.setup > 0 ? t("hiringOpenings.summarySetup", { count: counts.setup }) : null,
        counts.waiting > 0 ? t("hiringOpenings.summaryWaiting", { count: counts.waiting }) : null,
      ]
        .filter(Boolean)
        .join(" ")
    : t("hiringOpenings.summaryViewer", { count: total });
  const rows = (list: CockpitRow[]) => list.map((row) => <Row key={row.opening.id} row={row} userId={user.id} runs={runs} locale={locale} t={t} />);

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <PageTitle title={t("hiringOpenings.title")} sub={summary} action={addButton} />
      {tab ? <ScrollTo id={`group-${tab}`} /> : null}
      <div className="mt-section space-y-section">
        {drafts.length ? (
          <Group
            id="group-draft"
            title={t("hiringOpenings.groupSetup", { count: drafts.length })}
            columns={[t("hiringOpenings.colName"), t("hiringOpenings.colSetup"), t("hiringOpenings.colAttention"), t("hiringOpenings.colDeadline")]}
          >
            {rows(drafts)}
          </Group>
        ) : null}
        {open.length ? (
          <Group
            id="group-open"
            title={t("hiringOpenings.groupLive", { count: open.length })}
            columns={[t("hiringOpenings.colName"), t("hiringOpenings.colFunnel"), t("hiringOpenings.colAttention"), t("hiringOpenings.colDeadline")]}
          >
            {rows(open)}
          </Group>
        ) : null}
        {closed.length ? (
          <section id="group-closed" className="scroll-mt-6">
            <Disclosure label={t("hiringOpenings.groupClosed", { count: closed.length })} defaultOpen={tab === "closed"}>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">{rows(closed)}</ul>
              </Card>
            </Disclosure>
          </section>
        ) : null}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Copy**

`hiringOpenings` new keys (`title`, `sub`, `add`, `colName`, `colFunnel`, `colDeadline`, `funnelEmpty`, `emptyTitle`, `emptyBody`, `noPermission`, `emptyViewerTitle`, `emptyViewerBody`, `draftWaiting` unchanged):

| Key | TR | EN |
|---|---|---|
| `groupSetup` | Kurulumda ({count}) | In setup ({count}) |
| `groupLive` | Yayında ({count}) | Live ({count}) |
| `groupClosed` | Kapalı alımlar ({count}) | Closed openings ({count}) |
| `summaryRunning` | {count, plural, =0 {Süren alım yok.} other {# alım sürüyor.}} | {count, plural, =0 {No opening is under way.} one {One opening is under way.} other {# openings are under way.}} |
| `summarySetup` | {count} tanesi kurulumda. | {count, plural, one {One is in setup.} other {# are in setup.}} |
| `summaryWaiting` | {count} tanesinde senden bir şey bekleniyor. | {count, plural, one {One is waiting for you.} other {# are waiting for you.}} |
| `summaryViewer` | {count, plural, =0 {Üyesi olduğun alım yok.} other {Üyesi olduğun # alım var.}} | {count, plural, =0 {You are not on any opening.} one {You are on one opening.} other {You are on # openings.}} |
| `colSetup` | Kurulum | Setup |
| `colAttention` | Dikkat | Needs attention |
| `funnelLine` | {invited} davet · {started} başladı · {completed} tamamladı | {invited} invited · {started} started · {completed} completed |
| `teamNone` | Ekipte kimse yok | Nobody on the team |
| `teamOnlyYou` | Ekip: yalnız sen | Team: only you |
| `teamCount` | {count, plural, one {Ekip: # kişi} other {Ekip: # kişi}} | {count, plural, one {Team: one person} other {Team: # people}} |
| `nextRequests` | Taleplere bak | See the requests |
| `nextTeam` | Ekibe ekle | Add to the team |
| `nextExpiring` | Linklere bak | See the links |
| `nextInvite` | Aday davet et | Invite a candidate |
| `nextCandidates` | Adaylara bak | See the candidates |
| `nextOpen` | Aç | Open |

Removed from `hiringOpenings` (no reader is left; the groups replace the tabs, H8): `tabsLabel`, `tabOpen`, `tabDraft`, `tabClosed`, `emptyTabTitle`, `emptyTabBody`, `colStatus`, `colOwner`.

`hiringCommon.teamShort`: TR "Ekipte {evaluators} değerlendirici var, kural {min} istiyor." EN "{evaluators, plural, one {The team has one evaluator} other {The team has # evaluators}}; the rule asks for {min}." (Task 22's invite summary says the same.)

`hiringOverview` new keys (the setup path's words, shared with Task 20):

| Key | TR | EN |
|---|---|---|
| `rowPublish` | Yayınla | Publish |
| `setupCount` | Kurulum {done} / {total} | Setup {done} / {total} |
| `setupNext` | Sıradaki: {step} | Next: {step} |

- [ ] **Step 7: Tests and gates**

Run: `pnpm exec vitest run src/components/hiring src/components/manager src/solutions/hiring/server "src/app/(manager)/hiring" src/i18n && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -5`
Expected: PASS and clean (`boundary.test.ts`: the page imports `@/components/manager/*`, never `@/components/panel/*`).

- [ ] **Step 8: Browser check and the D14 measure**

`kademe_ui_check` with two published openings (`DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_ui_check pnpm dev:hiring-link` twice mints two), one invitation that started, one open request, and two drafts (start them from "Alım aç"); Claude in Chrome, logged in through `/login`:
1. `/hiring/openings` at 1440: the summary sentence ("4 alım sürüyor. 2 tanesi kurulumda. 1 tanesinde senden bir şey bekleniyor." with the copy's numbers), "KURULUMDA (2)": each draft row with "● Taslak", "Kurulum n / N" and its bar, the team and last day, and "Sıradaki: <adım> ›"; "YAYINDA (2)" with the funnel line and bar, "1 açık talep" (with the data-rights note when one is filed), "1 link 48 saatte doluyor" after `update assessment_links set expires_at = now() + interval '1 day' where …` on the copy, and the row's one action ("Taleplere bak ›" first). One filled "Alım aç" in the header, no filled button on a row.
2. A draft's "Sıradaki: Ekibi ata ›" lands on `…/settings#team-members` (Task 21 opens the team flow there; until then the page shows the rules form) and a live row's "Aday davet et ›" on `/hiring/invite?opening=…`.
3. `?tab=closed` opens "Kapalı alımlar (n)"; `?tab=draft` and `?tab=open` scroll to their group.
4. A reviewer (log in through `/login`): only their openings, counts and expiring links, no request line, no team line, every action "Aç ›", the grey "Alım aç" with its reason.
5. Keyboard: Tab reaches each row's name, then its action; the focus ring is visible. 1280 and 1024 screenshots (the columns stack below 1024).
6. D14: make ten drafts on the copy (start "Alım aç" ten times), reload `/hiring/openings` three times and read `performance.getEntriesByType("navigation")[0].responseStart - performance.getEntriesByType("navigation")[0].requestStart` with `javascript_tool`; write the three numbers in the task report, and whether any draft row fell back to "Kuruluma devam et ›" (the 300 ms budget, `SETUP_BUDGET_MS`). The number is the local machine's, not production's.
7. A fresh copy without openings: the board drawing, "İlk alımını aç.", the sentence, "Alım aç".
Drop the copy.

- [ ] **Step 9: Commit**

```bash
git add src/solutions/hiring/server/openings.ts src/solutions/hiring/server/invitations.ts src/solutions/hiring/server/invitations.test.ts "src/app/(manager)/hiring/openings/[id]/setup-steps.ts" "src/app/(manager)/hiring/openings/[id]/setup-steps.test.ts" src/components/hiring/opening-next-step.ts src/components/hiring/opening-next-step.test.ts src/components/manager/control-row.tsx "src/app/(manager)/hiring/openings/cockpit.ts" "src/app/(manager)/hiring/openings/cockpit.test.ts" "src/app/(manager)/hiring/openings/scroll-to.tsx" "src/app/(manager)/hiring/openings/page.tsx" src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Turn the openings list into the hiring control view

Every opening is one row with one next step (K12, KG1-KG3): a draft's
setup count and the next setup step, a live opening's small funnel, what
needs attention and the action that fixes it, in groups on one page with
the closed ones behind a disclosure (H8; ?tab= links still land on their
group). A reviewer sees counts only and 'Aç' (H9). Reads run one after
another (C21); the drafts' setup paths stop after 300 ms and fall back to
'Kuruluma devam et' (D14). Data-rights requests are counted with a plain
note and never become the next step (C6). The route tabs' keys go.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 19: M4, "Alım aç" on `GuidedFlow` (three steps, the summary line on the last)

**Files:**
- Create: `src/components/hiring/new-opening-steps.ts`, `new-opening-steps.test.ts`
- Modify (render rewritten on `GuidedFlow`; the state, `onOpenChange`, `submit`, the refusal sentences and the 120-character AI rule kept): `src/components/hiring/new-opening-form.tsx:1-271`
- Modify: `src/app/(manager)/hiring/openings/new/page.tsx:1-38` (`?copy=` preselects a copy source; no `BackToOpenings`, no `PageTitle`: the flow draws its head)
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (`hiringNew` new keys; `sub`, `stepPosition`, `stepStart` removed)

**Shared with the exam:** none.

**Design and rulings:** 4.6 (three steps: position, the job ad only for a new position name (plan decision 13), how to start; the last step carries the one-line summary, H3, no separate summary step), W1-W8 on the Task 15 shell, `createOpeningAction` and its refusals unchanged (`new/actions.ts:19-22`; `POSITION_NAME_REQUIRED`, `POSITION_NOT_FOUND`, `JOB_AD_REQUIRED`, `COPY_SOURCE_NOT_FOUND` from `openings.ts:115`, and `INVALID`, `FAILED`). A refusal opens the step it is about with its existing sentence (`newOpeningStepOfRefusal`). "Kopyala" is not on any control row (KG1: one action per row): it lives in the overview's `⋯` only (Task 20, ruling C9); `?copy=` stays the way in. No `shortcut` prop on the choice cards (Task 4 carry).

**Interfaces:**
- Consumes: `createOpeningAction`, `CreateOpeningActionResult` (unchanged); `GuidedFlow`, `useFlowStep`, `FlowStep`, `flowStepOf`, `flowJourney`, `stepOfProblem` (Task 15); `ChoiceCardGroup` (Task 4); `hiringCommon.back` ("Alımlara dön"), `flow.continue`, `flow.back`.
- Produces:
  - `type NewOpeningStep = "position" | "ad" | "start"`; `type NewOpeningRefusal = Extract<CreateOpeningActionResult, { ok: false }>["code"]`
  - `newOpeningSteps(input: { newName: boolean }): NewOpeningStep[]`; `newOpeningStepOf(hash: string, input: { steps: NewOpeningStep[]; positionReady: boolean }): NewOpeningStep`; `createWait(input: { positionReady: boolean; start: "AI" | "COPY" | "BLANK"; copyFrom: string }): "needPosition" | "needCopySource" | null`; `newOpeningStepOfRefusal(code: NewOpeningRefusal): NewOpeningStep`
  - `NewOpeningForm` props gain `initialCopyId: string | null`.

- [ ] **Step 1: Failing tests**

```ts
// src/components/hiring/new-opening-steps.test.ts
import { describe, expect, it } from "vitest";
import { createWait, newOpeningStepOf, newOpeningStepOfRefusal, newOpeningSteps } from "./new-opening-steps";

describe("Alım aç as three steps (4.6, plan decision 13)", () => {
  it("asks for the job ad only for a new position name (a library position's ad lives on the position)", () => {
    expect(newOpeningSteps({ newName: true })).toEqual(["position", "ad", "start"]);
    expect(newOpeningSteps({ newName: false })).toEqual(["position", "start"]);
  });

  it("follows the address's hash so the browser's back button steps back, and never skips the position", () => {
    const steps = newOpeningSteps({ newName: true });
    expect(newOpeningStepOf("", { steps, positionReady: true })).toBe("position");
    expect(newOpeningStepOf("#ad", { steps, positionReady: true })).toBe("ad");
    expect(newOpeningStepOf("#start", { steps, positionReady: true })).toBe("start");
    expect(newOpeningStepOf("#start", { steps, positionReady: false })).toBe("position");
    expect(newOpeningStepOf("#ad", { steps: newOpeningSteps({ newName: false }), positionReady: true })).toBe("position");
  });

  it("waits for a position, then for a source when copying, with the existing reasons", () => {
    expect(createWait({ positionReady: false, start: "BLANK", copyFrom: "" })).toBe("needPosition");
    expect(createWait({ positionReady: true, start: "COPY", copyFrom: "" })).toBe("needCopySource");
    expect(createWait({ positionReady: true, start: "COPY", copyFrom: "o1" })).toBeNull();
    expect(createWait({ positionReady: true, start: "AI", copyFrom: "" })).toBeNull();
  });

  it("opens the step a refusal is about (W8): the position for a missing or gone position, the start for everything else", () => {
    expect(newOpeningStepOfRefusal("POSITION_NAME_REQUIRED")).toBe("position");
    expect(newOpeningStepOfRefusal("POSITION_NOT_FOUND")).toBe("position");
    expect(newOpeningStepOfRefusal("JOB_AD_REQUIRED")).toBe("start");
    expect(newOpeningStepOfRefusal("COPY_SOURCE_NOT_FOUND")).toBe("start");
    expect(newOpeningStepOfRefusal("INVALID")).toBe("start");
    expect(newOpeningStepOfRefusal("FAILED")).toBe("start");
  });
});
```

Run: `pnpm exec vitest run src/components/hiring/new-opening-steps.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 2: The model**

```ts
// src/components/hiring/new-opening-steps.ts
import type { CreateOpeningActionResult } from "@/app/(manager)/hiring/openings/new/actions";
import { flowStepOf, stepOfProblem } from "@/components/manager/flow-model";

/**
 * HIRING-VISUAL-FLOW 4.6 (P6, W1-W8): opening a hiring is rare and thought
 * through each time, so it is three steps with one question each. The step
 * lives in the hash (useFlowStep): the browser's back button steps back and
 * every typed value stays (one component, one state).
 */
export type NewOpeningStep = "position" | "ad" | "start";
/** Every refusal createOpeningAction can answer (unchanged: the server's four and the action's INVALID, FAILED). */
export type NewOpeningRefusal = Extract<CreateOpeningActionResult, { ok: false }>["code"];

/** Plan decision 13: the ad step only for a new position name (a library position's ad lives on the position). */
export const newOpeningSteps = (input: { newName: boolean }): NewOpeningStep[] => (input.newName ? ["position", "ad", "start"] : ["position", "start"]);

/** W3: the hash's step; without a position every step opens the position step. */
export function newOpeningStepOf(hash: string, input: { steps: NewOpeningStep[]; positionReady: boolean }): NewOpeningStep {
  return flowStepOf(hash, { steps: input.steps, firstInvalid: input.positionReady ? null : "position" });
}

/** The last step's "Alımı oluştur" waits for a position, then for a source when copying (the existing reasons). */
export function createWait(input: { positionReady: boolean; start: "AI" | "COPY" | "BLANK"; copyFrom: string }): "needPosition" | "needCopySource" | null {
  if (!input.positionReady) return "needPosition";
  return input.start === "COPY" && !input.copyFrom ? "needCopySource" : null;
}

const REFUSAL_STEP: Record<NewOpeningRefusal, NewOpeningStep> = {
  POSITION_NAME_REQUIRED: "position",
  POSITION_NOT_FOUND: "position",
  JOB_AD_REQUIRED: "start",
  COPY_SOURCE_NOT_FOUND: "start",
  INVALID: "start",
  FAILED: "start",
};

/** W8: a refusal of createOpeningAction opens the step it is about; the sentence stays the existing one. */
export const newOpeningStepOfRefusal = (code: NewOpeningRefusal): NewOpeningStep => stepOfProblem(REFUSAL_STEP, code) ?? "start";
```

- [ ] **Step 3: The flow**

Replace `src/components/hiring/new-opening-form.tsx` with:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Copy, FilePlus2, Plus, Sparkles } from "lucide-react";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { flowJourney } from "@/components/manager/flow-model";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { useMT } from "@/i18n/manager-client";
import { POSITION_JOB_AD_MAX, POSITION_NAME_MAX } from "@/lib/library/positions";
import { createOpeningAction } from "@/app/(manager)/hiring/openings/new/actions";
import { createWait, newOpeningStepOf, newOpeningStepOfRefusal, newOpeningSteps, type NewOpeningRefusal, type NewOpeningStep } from "./new-opening-steps";

export type PositionOption = { id: string; name: string; hasJobAd: boolean; competencyCount: number; weightsEqual: boolean };
type Start = "AI" | "COPY" | "BLANK";

const ICONS = { AI: Sparkles, COPY: Copy, BLANK: FilePlus2 } as const;
const ALL_STEPS: NewOpeningStep[] = ["position", "ad", "start"];

/**
 * HIRING-UX 5.3 as HIRING-VISUAL-FLOW 4.6 (K12): which position, the job ad
 * (a new position only, plan decision 13), how to start; one question per step
 * on GuidedFlow, every value kept across the steps and the browser's buttons.
 * The last step carries the one-line summary (H3: no separate summary step)
 * and "Alımı oluştur". createOpeningAction, its refusals and the 120-character
 * AI rule are unchanged; a refusal opens its step with its existing sentence.
 */
export function NewOpeningForm({
  positions,
  sources,
  initialPositionId,
  initialCopyId,
}: {
  positions: PositionOption[];
  sources: Array<{ id: string; name: string; detail: string }>;
  initialPositionId: string | null;
  initialCopyId: string | null;
}) {
  const t = useMT("hiringNew");
  const common = useMT("hiringCommon");
  const flow = useMT("flow");
  const router = useRouter();
  const initialPicked = positions.find((p) => p.id === initialPositionId) ?? null;
  const copySource = initialCopyId && sources.some((s) => s.id === initialCopyId) ? initialCopyId : "";
  const initialStart: Start = copySource ? "COPY" : "AI";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PositionOption | null>(initialPicked);
  const [newName, setNewName] = useState<string | null>(null);
  const [jobAd, setJobAd] = useState("");
  const [start, setStart] = useState<Start>(initialStart);
  const [copyFrom, setCopyFrom] = useState(copySource);
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<NewOpeningRefusal | null>(null);

  const hasAd = picked ? picked.hasJobAd : jobAd.trim().length > 0;
  // The recommended path is pre-selected, and falls back to "blank" while there is no ad.
  const effective: Start = start === "AI" && !hasAd ? "BLANK" : start;
  const positionReady = picked !== null || (newName !== null && newName.trim().length > 0);
  const steps = newOpeningSteps({ newName: newName !== null });
  const nav = useFlowStep({ steps: ALL_STEPS, firstInvalid: positionReady ? null : "position", mode: "hash" });
  // The hash may name the ad step of a library position: the model sends it on to the right step.
  const step = newOpeningStepOf(`#${nav.step}`, { steps, positionReady });
  const index = steps.indexOf(step);
  const wait = createWait({ positionReady, start: effective, copyFrom });
  const typed = query.trim();
  const exists = positions.some((p) => p.name.toLocaleLowerCase("tr") === typed.toLocaleLowerCase("tr"));
  const dirty = picked?.id !== initialPicked?.id || newName !== null || jobAd !== "" || start !== initialStart || copyFrom !== copySource;

  const refusalText: Record<NewOpeningRefusal, string> = {
    POSITION_NAME_REQUIRED: t("needPosition"),
    POSITION_NOT_FOUND: t("positionGone"),
    JOB_AD_REQUIRED: t("startAiDisabled"),
    COPY_SOURCE_NOT_FOUND: t("copySourceGone"),
    INVALID: t("failed"),
    FAILED: t("failed"),
  };

  // Closing the picker keeps what was typed: an exact match is picked, any other name
  // becomes the new position unless a position is already picked.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next || !typed) return;
    const match = positions.find((p) => p.name.toLocaleLowerCase("tr") === typed.toLocaleLowerCase("tr"));
    if (match) {
      setPicked(match);
      setNewName(null);
    } else if (!picked) {
      setPicked(null);
      setNewName(typed);
    }
  }

  function submit() {
    setRefusal(null);
    startTransition(async () => {
      try {
        const result = await createOpeningAction({
          position: picked ? { kind: "existing", id: picked.id } : { kind: "new", name: newName ?? "", jobDescription: jobAd },
          start: effective,
          copyFrom: effective === "COPY" ? copyFrom : null,
        });
        if (result.ok) router.push(result.next);
        else {
          setRefusal(result.code);
          if (newOpeningStepOfRefusal(result.code) !== step) nav.go(newOpeningStepOfRefusal(result.code));
        }
      } catch {
        setRefusal("FAILED");
      }
    });
  }

  const note =
    refusal && newOpeningStepOfRefusal(refusal) === step ? (
      <p role="alert" className="text-[14px] font-medium text-ink">
        {refusalText[refusal]}
      </p>
    ) : null;
  const next = (to: NewOpeningStep | undefined) => () => {
    if (to) nav.go(to);
  };

  const options: Array<[Start, string, string]> = [
    ["AI", t("startAi"), t("startAiBody")],
    // "Önceki bir alımdan kopyala" is hidden while there is nothing to copy (HIRING-UX 5.3).
    ...(sources.length ? ([["COPY", t("startCopy"), t("startCopyBody")]] as Array<[Start, string, string]>) : []),
    ["BLANK", t("startBlank"), t("startBlankBody")],
  ];
  const positionName = picked?.name ?? newName ?? "";
  const summary = [
    positionName,
    hasAd ? t("summaryAd") : t("summaryNoAd"),
    effective === "AI" ? t("summaryAi") : effective === "COPY" ? t("summaryCopy", { name: sources.find((s) => s.id === copyFrom)?.name ?? "-" }) : t("summaryBlank"),
  ].join(" · ");

  const screens: Record<NewOpeningStep, FlowStep> = {
    position: {
      id: "position",
      title: t("stepPositionTitle"),
      lead: <p>{t("stepPositionLead")}</p>,
      layout: "split",
      primary: { kind: "button", id: "new-opening-next", label: flow("continue"), waitReason: positionReady ? null : t("needPosition"), onClick: next(steps[index + 1]) },
      note,
      body: (
        <div className="space-y-3">
          <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={open} aria-label={t("positionPick")} className="h-12 w-full justify-between font-normal">
                <span className={picked || newName ? "truncate text-ink" : "truncate text-muted"}>{picked?.name ?? newName ?? t("positionPick")}</span>
                <ChevronsUpDown className="size-4 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
              <Command>
                <CommandInput placeholder={t("positionSearch")} value={query} onValueChange={setQuery} maxLength={POSITION_NAME_MAX} />
                <CommandList>
                  {/* "No position with this name" only once something is typed. */}
                  {typed ? <CommandEmpty>{t("positionNone")}</CommandEmpty> : null}
                  {positions.length ? (
                    <CommandGroup>
                      {positions.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.id}
                          keywords={[p.name]}
                          data-checked={picked?.id === p.id}
                          onSelect={() => {
                            setPicked(p);
                            setNewName(null);
                            setRefusal(null);
                            setOpen(false);
                          }}
                        >
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {typed && !exists ? (
                    <CommandGroup forceMount>
                      <CommandItem
                        value={`__new__${typed}`}
                        keywords={[typed]}
                        forceMount
                        onSelect={() => {
                          setPicked(null);
                          setNewName(typed);
                          setRefusal(null);
                          setOpen(false);
                        }}
                      >
                        <Plus className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                        {t("positionCreate", { name: typed })}
                      </CommandItem>
                    </CommandGroup>
                  ) : null}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {picked ? (
            <p className="tnum text-[14px] text-muted">
              {picked.competencyCount ? t("profileSummary", { count: picked.competencyCount, weights: picked.weightsEqual ? t("weightsEqual") : t("weightsSet") }) : t("profileEmpty")}
            </p>
          ) : null}
        </div>
      ),
    },
    ad: {
      id: "ad",
      title: t("stepAdTitle"),
      lead: <p>{t("jobAdHint")}</p>,
      layout: "split",
      primary: { kind: "button", id: "new-opening-next", label: jobAd.trim() ? flow("continue") : t("continueWithoutAd"), onClick: next(steps[index + 1]) },
      note,
      body: (
        <div className="space-y-2">
          <Label htmlFor="new-opening-ad">{t("jobAd")}</Label>
          <Textarea id="new-opening-ad" rows={14} maxLength={POSITION_JOB_AD_MAX} value={jobAd} onChange={(e) => setJobAd(e.target.value)} className="text-[16px]" />
        </div>
      ),
    },
    start: {
      id: "start",
      title: t("stepStartTitle"),
      layout: "split",
      primary: { kind: "button", id: "new-opening-create", label: t("create"), busy: pending, busyLabel: t("creating"), waitReason: wait ? t(wait) : null, onClick: submit },
      note,
      body: (
        <div className="space-y-4">
          <ChoiceCardGroup
            type="single"
            name="new-opening-start"
            value={[effective]}
            onChange={([v]) => setStart(v as Start)}
            items={options.map(([value, title, body]) => ({
              value,
              marker: ICONS[value],
              label: title,
              disabled: value === "AI" && !hasAd,
              description:
                value === "AI" && !hasAd ? (
                  <>
                    {t("startAiDisabled")}
                    {/* A library position without an ad: the ad is added on the position, not here. */}
                    {picked ? (
                      <>
                        {" "}
                        <Link href={`/library/positions/${picked.id}`} className="relative z-10 font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                          {t("addJobAd")}
                        </Link>
                      </>
                    ) : null}
                  </>
                ) : (
                  body
                ),
            }))}
          />
          {effective === "COPY" ? (
            <div className="space-y-2">
              <Label htmlFor="new-opening-copy">{t("copyFrom")}</Label>
              <Select value={copyFrom} onValueChange={setCopyFrom}>
                <SelectTrigger id="new-opening-copy" className="w-full">
                  <SelectValue placeholder={t("copyFrom")} />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="truncate">{s.name}</span>
                      <span className="tnum truncate text-muted">{s.detail}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {/* H3, W5: a short create flow's last step says every decision in one line. */}
          {positionReady ? <p className="text-[14px] leading-[22px] text-ink-2">{summary}</p> : null}
        </div>
      ),
    },
  };

  return (
    <GuidedFlow
      kicker={t("title")}
      step={screens[step]}
      journey={flowJourney(steps, step)}
      back={index === 0 ? { label: common("back"), href: "/hiring/openings" } : { label: flow("back"), onClick: () => nav.back() }}
      exit={{ dirty, href: "/hiring/openings" }}
      enter={nav.moved}
    />
  );
}
```

`new/page.tsx` becomes:

```tsx
import { NewOpeningForm } from "@/components/hiring/new-opening-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { shortDate } from "@/lib/format";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";
import { copySources, positionOptions } from "@/solutions/hiring/server/openings";

export const dynamic = "force-dynamic";

/**
 * HIRING-UX 5.3 as the guided flow of HIRING-VISUAL-FLOW 4.6. `?position=` (a library position page)
 * pre-selects an active position; `?copy=` (the overview's "Kopyala") pre-selects a copy source.
 */
export default async function NewOpeningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("opening:write");
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const [positions, rows] = await Promise.all([positionOptions(user.orgId), copySources(user.orgId)]);
  // Same-named openings are told apart by state and date in the copy picker.
  const sources = rows.map((r) => ({
    id: r.id,
    name: r.name,
    detail: t("hiringNew.copySourceDetail", { status: t(`hiringCommon.status${r.status}`), date: shortDate(r.createdAt, locale) }),
  }));
  const initial = typeof sp.position === "string" && isUuid(sp.position) ? sp.position : null;
  const copy = typeof sp.copy === "string" && isUuid(sp.copy) ? sp.copy : null;
  // The flow draws its own head (the flow's name and "Çık") and its steps' titles (W2).
  return (
    <main className="mx-auto max-w-[1080px] px-page pt-6">
      <NewOpeningForm positions={positions} sources={sources} initialPositionId={initial} initialCopyId={copy} />
    </main>
  );
}
```

- [ ] **Step 4: Copy (`hiringNew`, new keys; `jobAdHint`, `needPosition`, `needCopySource`, `startAiDisabled`, `create`, `creating` and the refusal sentences unchanged)**

| Key | TR | EN |
|---|---|---|
| `stepPositionTitle` | Hangi pozisyon için? | Which position is it for? |
| `stepPositionLead` | Kütüphanedeki bir pozisyonu seç ya da yeni bir ad yaz. | Pick a position from the library or type a new name. |
| `stepAdTitle` | İlan metnin var mı? | Do you have a job ad? |
| `stepStartTitle` | Nasıl başlayalım? | How shall we start? |
| `continueWithoutAd` | İlan metni olmadan devam et | Continue without a job ad |
| `summaryAd` | ilan metni var | job ad added |
| `summaryNoAd` | ilan metni yok | no job ad |
| `summaryAi` | AI taslağı | AI draft |
| `summaryCopy` | {name} kopyası | copy of {name} |
| `summaryBlank` | boş başlangıç | blank start |

Removed (no reader is left: the flow's head and step titles replace them): `sub`, `stepPosition`, `stepStart`. The step 2 lead reuses `jobAdHint` ("İsteğe bağlı ama önerilir. AI taslağı için 120 karakter yeter.", the rule the form already states). Generic words ("Devam et", "Geri", "Çık", "Kaydetmeden çık", "Adım n / N") come from `flow` (Task 15).

- [ ] **Step 5: Tests and gates**

Run: `pnpm exec vitest run src/components/hiring src/components/manager "src/app/(manager)/hiring/openings" && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -5`
Expected: PASS and clean (the create action's tests are untouched; `git diff --stat "src/app/(manager)/hiring/openings/new/actions.ts" src/solutions/hiring/server/openings.ts` shows no change in this task).

- [ ] **Step 6: Browser check**

`kademe_ui_check`, Claude in Chrome, logged in through `/login`:
1. `/hiring/openings/new` at 1440: the flow's head "Alım aç" with "Çık" on the right, "Hangi pozisyon için?" left, the picker right, the sticky footer inside the page column (the side menu stays visible, D12): "‹ Alımlara dön", "Adım 1 / 2" (library position) or "1 / 3" (new name), "Devam et" grey with "Pozisyon adını yaz." until a position is picked; the exit reads "Kaydetmeden çık" once something is chosen.
2. Type a new name, "Devam et": "İlan metnin var mı?", the big field, the button reads "İlan metni olmadan devam et" while empty, "Devam et" with text; browser back returns to step 1 with the name kept; forward keeps the ad; a reload on `#start` opens step 3 only when the position is set (else step 1).
3. Step 3: three cards with icons; AI is closed with "İlan metni ekleyince açılır." when there is no ad; choose copy: the source picker appears and "Alımı oluştur" waits with "Kopyalanacak alımı seç."; the summary line reads "<pozisyon> · ilan metni var · <alım> kopyası"; pick one, create: the overview (or the AI flow when AI was chosen).
4. `/hiring/openings/new?copy=<id>`: step 3 opens on "Önceki bir alımdan kopyala" with that source chosen once a position is picked.
5. Focus moves to each step's title (`document.activeElement` is the `h1` after "Devam et"); keyboard through all steps; 1280 and 1024 screenshots.

- [ ] **Step 7: Commit**

```bash
git add src/components/hiring/new-opening-steps.ts src/components/hiring/new-opening-steps.test.ts src/components/hiring/new-opening-form.tsx "src/app/(manager)/hiring/openings/new/page.tsx" src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Guide 'Alım aç' through one question per step

Which position, the job ad (new positions only), how to start: one step
each on GuidedFlow with the sticky footer inside the page, the step in
the hash so the browser's back button steps back with every value kept,
and the last step's one-line summary (H3). A refusal opens the step it
is about with its existing sentence. The create action, its refusals and
the 120-character AI rule are unchanged; ?copy= preselects the source.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 20: M5, the opening's control view (setup path, publish summary, funnel tiles, attention, rules card, `⋯` menu), the setup line on a draft's pages, and the Candidates tab's notices

**Files:**
- Create: `src/app/(manager)/hiring/openings/[id]/setup-strip.ts`, `src/app/(manager)/hiring/openings/[id]/publish-view.tsx`
- Modify (rewritten): `src/app/(manager)/hiring/openings/[id]/opening-header.tsx:1-75` (`PanelHeader` with `menu`, the setup line under the tabs; `TONE` as Task 15 left it, `AssessmentTabs` unchanged)
- Modify (rewritten, reads kept): `src/app/(manager)/hiring/openings/[id]/page.tsx:1-329`
- Modify (the setup line; the builder's and scorecard's own components are not touched): `src/app/(manager)/hiring/openings/[id]/assessment/page.tsx:13`, `:33`, `:44`; `src/app/(manager)/hiring/openings/[id]/assessment/ai/page.tsx:11`, `:42`, `:48`; `src/app/(manager)/hiring/openings/[id]/assessment/edit/page.tsx:15`, `:48`, `:64`; `src/app/(manager)/hiring/openings/[id]/assessment/scorecard/page.tsx:20`, `:50`, `:121`; `src/app/(manager)/hiring/openings/[id]/assessment/preview/page.tsx:11`, `:30`, `:37`
- Modify: `src/app/(manager)/hiring/openings/[id]/assessment/preview/page.test.ts:30` (the leak test never reaches a database: `setupStrip` mocked)
- Modify: `src/app/(manager)/hiring/openings/[id]/candidates/notices.ts` (+ `noticeVoice`), `notices.test.ts`, `src/app/(manager)/hiring/openings/[id]/candidates/page.tsx:17`, `:66-80`
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (`hiringOverview`, `hiringCommon`, `hiringCandidates.noticeNotDone`; six `hiringOverview` state words removed)

**Shared with the exam:** none.

**Design and rulings:** 4.5, H7 (a draft's one filled button is "Kuruluma devam et"; "Yayınla" is filled only on the publish summary), the setup path as one `PathSteps` list ending in "Yayınla" with "Kurulum n / N · k adım kaldı"; team and preview are advice and carry "Atla ›" (`?skip=`, nothing stored; STATUS decision 7), the publish summary at `#publish` (both views drawn on the server, `PublishSwitch` picks by the hash, D13, C16), the "Bu alımın kuralları" card on a live opening (`SummaryRows readOnly`, one link "Kuralları değiştir ›"), the `⋯` menu of links (plan decision 14: Önizle, Ekip ve kurallar, and "Kopyala" only for someone who may open an opening, ruling C9, one key `hiringCommon.copyOpening`), the funnel as tiles, "Dikkat isteyenler" (requests only for someone who runs openings, the expiring count for everyone: H9 and ruling C18's open point decided this way; the data-rights note of C6), the setup line on a draft's other pages (4.5: builder, scorecard, preview, team and rules; also the assessment summary and the AI draft tabs, which are the same draft's pages; not on the overview, whose setup card says the same one line lower). `publishOpeningAction`, its gate, reasons and notices are unchanged (`[id]/actions.ts:15-47`). `PendingButton` stays the only reader of a form's status (`pending-button.test.ts`): the publish footer keeps its own "sent" state.

**Interfaces:**
- Consumes: `setupRowsOf`, `setupProgress`, `setupNext`, `setupSkips`, `SETUP_LABEL`, `teamHref` (Task 18), `openingCardFacts` (Task 18), `PanelHeader`, `RowMenuItem` (Task 14), `SummaryRows` (Task 15), `PathSteps` (`{ steps: { title; detail?; state?; action? }[]; label?; locale? }`, Task 4), `StepScreen`, `StepFooter` (Task 4), `stepFocusController` (`src/hooks/use-step-focus.ts`), `subscribeHash`, `leaveHashStep` (C16), `rowAction`, `describeProblem`, `canDecide`, `nav.more` (Task 14), `flow.change`, `flow.changed`, `flow.skip` (Task 15), `hiringCommon.continueSetup`, `openRequests`, `rightsNote`, `expiringLinks` (Task 16), `hiringOpenings.nextRequests`, `nextExpiring`, `hiringOverview.rowPublish`, `setupCount`, `setupNext` (Task 18), `hiringSettings.teamTitle`, `candidateTitle`, `fairTitle` (existing).
- Produces:
  - `type SetupStripData = { done: number; total: number; next: SetupNext }`; `setupStrip(input: { orgId: string; opening: OpeningDetail; access: { edit: boolean }; t; locale; state?: WorkingState }): Promise<SetupStripData | null>` (null for anything but a draft its viewer may edit, before any read; Task 21 calls it on team and rules)
  - `OpeningHeader` props gain `menu?: RowMenuItem[]` and `setup?: SetupStripData | null`
  - `PublishSwitch(props: { summary: ReactNode; children: ReactNode })`, `PublishFooter(props: { formId: string; reason: string | null; fix: { label: string; href: string } | null; labels: { publish: string; publishing: string; back: string } })`
  - `noticeVoice(notice: { warn: boolean }): { role: "alert" | "status"; lead: boolean }`
  - Copy keys reused by Task 21: `hiringCommon.rulesTeam`, `rulesNoDecider`, `rulesContact`, `rulesBlindOn`, `rulesBlindOff`, `rulesSurveyOn`, `rulesSurveyOff`

- [ ] **Step 1: Failing test**

Add to `candidates/notices.test.ts` (import `noticeVoice` with `candidatesNotice`):

```ts
describe("noticeVoice (Task 18 carry: a refusal is not told by its dot alone)", () => {
  it("says a refusal or failure as an alert with a lead word; a success as a status line", () => {
    expect(noticeVoice({ warn: true })).toEqual({ role: "alert", lead: true });
    expect(noticeVoice({ warn: false })).toEqual({ role: "status", lead: false });
  });
});
```

Run: `pnpm exec vitest run "src/app/(manager)/hiring/openings/[id]/candidates/notices.test.ts"`
Expected: FAIL (`noticeVoice` missing). The overview's behaviour is pinned by the existing `page.test.ts` (invite button and reasons, the funnel words, the median, the survey batch, "Yayına hazırlık" under a new draft), which must stay green unchanged, and by the browser steps; the pure parts it uses were tested in Task 18.

- [ ] **Step 2: Notices**

Append to `candidates/notices.ts`:

```ts
/** Task 18 carry: a refusal is said in words ("Yapılmadı:") and as an alert, not only by its grey dot. */
export function noticeVoice(notice: { warn: boolean }): { role: "alert" | "status"; lead: boolean } {
  return notice.warn ? { role: "alert", lead: true } : { role: "status", lead: false };
}
```

`candidates/page.tsx`: the notices import (`:17`) gains `noticeVoice`, and the notice block (`:66-80`) becomes:

```tsx
      {notice ? (
        <UrlNotice params={NOTICE_PARAMS}>
          {notice.warn ? (
            // A refusal or a failure: an alert, a lead word and the warn dot (Task 18 fix round 1 and the plan 2b carry).
            <p role={noticeVoice(notice).role} className="mt-6">
              <StatusDot tone="warn" className="items-start text-ink [&>span:first-child]:mt-[7px]">
                <span className="text-[14px] leading-5">
                  <strong className="font-semibold">{t("hiringCandidates.noticeNotDone")}</strong> {t(`hiringCandidates.${notice.key}`)}
                </span>
              </StatusDot>
            </p>
          ) : (
            <p role={noticeVoice(notice).role} className="mt-6 text-[14px] font-medium text-ink">
              {t(`hiringCandidates.${notice.key}`)}
            </p>
          )}
        </UrlNotice>
      ) : null}
```

- [ ] **Step 3: The setup line and the publish view**

```ts
// src/app/(manager)/hiring/openings/[id]/setup-strip.ts
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { loadPanelUsers } from "@/server/settings";
import type { OpeningDetail } from "@/solutions/hiring/server/openings";
import { workingState, type WorkingState } from "@/solutions/hiring/server/working";
import { setupNext, setupProgress, setupRowsOf, type SetupNext } from "./setup-steps";

export type SetupStripData = { done: number; total: number; next: SetupNext };

/**
 * HIRING-VISUAL-FLOW 4.5: the one-line path ("Kurulum 2 / 5 · Sıradaki: Ekibi
 * ata ›") on a draft opening's pages (the assessment's tabs, team and rules)
 * for someone who may edit it. Null for anything else, before any read. A page
 * that already read the working state passes it; the people are read once.
 */
export async function setupStrip(input: {
  orgId: string;
  opening: OpeningDetail;
  access: { edit: boolean };
  t: ReturnType<typeof managerT>;
  locale: Locale;
  state?: WorkingState;
}): Promise<SetupStripData | null> {
  const { orgId, opening, access, t, locale } = input;
  if (opening.status !== "DRAFT" || !access.edit) return null;
  const state = input.state ?? (await workingState(orgId, opening.id));
  if (!state.draft) return null;
  const people = await loadPanelUsers(orgId);
  const rows = setupRowsOf({ state, opening, people, t, locale });
  if (rows.length === 0) return null;
  const progress = setupProgress(rows);
  return { done: progress.done, total: progress.total, next: setupNext(rows, opening.id) };
}
```

```tsx
// src/app/(manager)/hiring/openings/[id]/publish-view.tsx
"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { StepFooter } from "@/components/visual/step-footer";
import { stepFocusController } from "@/hooks/use-step-focus";
import { leaveHashStep, subscribeHash } from "@/lib/client/hash-step";

const onPublish = () => window.location.hash === "#publish";
const notOnPublish = () => false;

/**
 * HIRING-VISUAL-FLOW 4.5, D13: the overview and its publish summary are both
 * drawn on the server; the address's hash picks one (`#publish`, the setup
 * path's last step). Opening the summary in place moves the focus to its
 * heading (W10); the first load never moves it.
 */
export function PublishSwitch({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const shown = useSyncExternalStore(subscribeHash, onPublish, notOnPublish);
  const [focus] = useState(stepFocusController);
  useEffect(() => {
    focus.onStep(shown ? "publish" : "overview", shown ? document.querySelector<HTMLElement>("#publish-summary h1") : null);
  }, [focus, shown]);
  return <>{shown && summary ? summary : children}</>;
}

/**
 * The publish summary's footer (W6): "‹ Genel bakış" back, the one filled
 * "Yayınla" that sends the summary's form to publishOpeningAction (unchanged),
 * waiting with the gate's first problem in the existing words, a "Düzelt"
 * link under it. Once sent the button stays filled, says "Yayınlanıyor" and
 * takes no second click; the action always answers with a redirect, which
 * draws the page again (PendingButton stays the one reader of the form's
 * status, pending-button.test.ts).
 */
export function PublishFooter({
  formId,
  reason,
  fix,
  labels,
}: {
  formId: string;
  reason: string | null;
  fix: { label: string; href: string } | null;
  labels: { publish: string; publishing: string; back: string };
}) {
  const [sent, setSent] = useState(false);
  return (
    <StepFooter
      placement="sticky"
      back={{ label: labels.back, onClick: leaveHashStep }}
      primary={{
        kind: "button",
        id: "publish-opening",
        label: labels.publish,
        busy: sent,
        busyLabel: labels.publishing,
        waitReason: reason,
        onClick: () => {
          setSent(true);
          document.querySelector<HTMLFormElement>(`#${formId}`)?.requestSubmit();
        },
      }}
      note={
        reason && fix ? (
          <a href={fix.href} className="text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink">
            {fix.label}
          </a>
        ) : null
      }
    />
  );
}
```

`opening-header.tsx` becomes:

```tsx
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { RouteTabs } from "@/components/manager/route-tabs";
import { OPENING_STATUS } from "@/components/hiring/status-vocabulary";
import { PanelHeader } from "@/components/manager/panel-header";
import type { RowMenuItem } from "@/components/manager/row-menu";
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { shortDate } from "@/lib/format";
import type { OpeningStatus, OpeningDetail } from "@/solutions/hiring/server/openings";
import type { SetupStripData } from "./setup-strip";
import { SETUP_LABEL } from "./setup-steps";

type T = ReturnType<typeof managerT>;

/** An opening's status dot, shared by the list and the opening pages (ruling C13), from the one dictionary (P9). */
export const TONE: Record<OpeningStatus, StatusTone> = { DRAFT: OPENING_STATUS.DRAFT.tone, OPEN: OPENING_STATUS.OPEN.tone, CLOSED: OPENING_STATUS.CLOSED.tone };

/** The way back to the openings list, above every opening page. */
export function BackToOpenings({ t }: { t: T }) {
  return (
    <Link
      href="/hiring/openings"
      className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-[13px] text-muted transition-colors duration-[120ms] ease-out hover:text-ink"
    >
      <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
      {t("hiringCommon.back")}
    </Link>
  );
}

/**
 * HIRING-UX 5.4 with HIRING-VISUAL-FLOW P2 and 4.5: name, status, deadline,
 * the page's one filled action, the "⋯" menu of links (plan decision 14), and
 * the opening's route tabs. Only tabs whose route exists are listed (ruling
 * C7). On a draft's pages (for someone who may edit it) one line under the
 * tabs says where the setup path stands and opens its next step; it is a text
 * link and never competes with the page's own filled button.
 */
export function OpeningHeader({
  opening,
  active,
  locale,
  t,
  action,
  menu,
  setup,
}: {
  opening: OpeningDetail;
  active: "overview" | "candidates" | "assessment" | "settings";
  locale: Locale;
  t: T;
  action?: React.ReactNode;
  menu?: RowMenuItem[];
  setup?: SetupStripData | null;
}) {
  const base = `/hiring/openings/${opening.id}`;
  const stripLink = setup ? (
    <>
      {t("hiringOverview.setupNext", { step: t(`hiringOverview.${SETUP_LABEL[setup.next.key]}`) })}
      <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
    </>
  ) : null;
  const linkClass = "inline-flex min-h-11 items-center gap-0.5 font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";
  return (
    <div className="space-y-6">
      <BackToOpenings t={t} />
      <PanelHeader
        kicker={opening.positionName}
        title={opening.name}
        meta={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusDot tone={TONE[opening.status]}>{t(`hiringCommon.status${opening.status}`)}</StatusDot>
            <span className="tnum text-[13px]">
              {opening.deadlineAt ? t("hiringCommon.deadline", { date: shortDate(opening.deadlineAt, locale) }) : t("hiringCommon.noDeadline")}
            </span>
          </span>
        }
        primary={action}
        menu={menu?.length ? { label: t("nav.more"), items: menu } : undefined}
      />
      <div className="space-y-2">
        <RouteTabs
          label={t("hiringCommon.tabsLabel")}
          items={[
            { href: base, label: t("hiringCommon.tabOverview"), active: active === "overview" },
            { href: `${base}/candidates`, label: t("hiringCommon.tabCandidates"), active: active === "candidates" },
            { href: `${base}/assessment`, label: t("hiringCommon.tabAssessment"), active: active === "assessment" },
            { href: `${base}/settings`, label: t("hiringCommon.tabSettings"), active: active === "settings" },
          ]}
        />
        {setup ? (
          <p className="tnum flex flex-wrap items-center gap-x-2 text-[14px] text-ink-2">
            <span>{t("hiringOverview.setupCount", { done: setup.done, total: setup.total })}</span>
            <span aria-hidden>·</span>
            {/* A step with a hash (team and rules' flow, the publish summary) is a plain anchor, so that page hears it (W3). */}
            {setup.next.href.includes("#") ? (
              <a href={setup.next.href} className={linkClass}>
                {stripLink}
              </a>
            ) : (
              <Link href={setup.next.href} className={linkClass}>
                {stripLink}
              </Link>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The assessment's own tabs (HIRING-UX 4.3): the summary with the version
 * history, the builder, the AI draft, the scorecard and the candidate preview.
 */
export function AssessmentTabs({ openingId, active, t }: { openingId: string; active: "summary" | "edit" | "ai" | "scorecard" | "preview"; t: T }) {
  const base = `/hiring/openings/${openingId}/assessment`;
  return (
    <RouteTabs
      size="sm"
      label={t("hiringCommon.assessmentTabsLabel")}
      items={[
        { href: base, label: t("hiringCommon.tabSummary"), active: active === "summary" },
        { href: `${base}/edit`, label: t("hiringCommon.tabBuilder"), active: active === "edit" },
        { href: `${base}/ai`, label: t("hiringCommon.tabAi"), active: active === "ai" },
        { href: `${base}/scorecard`, label: t("hiringCommon.tabScorecard"), active: active === "scorecard" },
        { href: `${base}/preview`, label: t("hiringCommon.tabPreview"), active: active === "preview" },
      ]}
    />
  );
}
```

(`opening-header.test.ts` keeps passing: it finds `RouteTabs` anywhere in the tree.)

- [ ] **Step 4: The overview**

Replace `src/app/(manager)/hiring/openings/[id]/page.tsx` with:

```tsx
import { Fragment } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, EyeOff, Inbox, Users } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InviteSheet } from "@/components/hiring/invite/invite-sheet";
import { SummaryRows, type SummaryRow } from "@/components/manager/summary-rows";
import { UrlNotice } from "@/components/ui/url-notice";
import { StatusDot } from "@/components/ui/status-dot";
import { PathSteps } from "@/components/visual/path-steps";
import { StepScreen } from "@/components/visual/step-screen";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { noticeOf, one } from "@/lib/url-notice";
import { shortDate } from "@/lib/format";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { loadPanelUsers } from "@/server/settings";
import { canDecide } from "@/solutions/hiring/rules/access";
import { orderedStages, totalSeconds } from "@/solutions/hiring/rules/content";
import type { PublishProblem } from "@/solutions/hiring/rules/gate";
import { previewIsCurrent } from "@/solutions/hiring/rules/versions";
import { SURVEY_BATCH } from "@/solutions/hiring/rules/invitation";
import { invitableOpenings, openingCardFacts, openingFunnel } from "@/solutions/hiring/server/invitations";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "./access";
import { publishOpeningAction, type PublishNotice } from "./actions";
import { funnelView } from "./funnel";
import { inviteWaitReason } from "./invite-wait";
import { OpeningHeader } from "./opening-header";
import { describeProblem } from "./problems";
import { PublishFooter, PublishSwitch } from "./publish-view";
import { rowAction } from "./readiness";
import { SETUP_LABEL, setupNext, setupProgress, setupRowsOf, setupSkips } from "./setup-steps";

export const dynamic = "force-dynamic";

const NOTICES: Record<PublishNotice, "publishRefused" | "publishNoDraft" | "publishClosed" | "publishInvalid" | "publishFailed"> = {
  refused: "publishRefused",
  nodraft: "publishNoDraft",
  closed: "publishClosed",
  invalid: "publishInvalid",
  failed: "publishFailed",
};

/** The redirect after "Yayınla" brings one of these; shown once, then taken out of the address. */
const NOTICE_PARAMS = ["publish", "published"] as const;

const LINK = "font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";
const TEXT_ACTION = "inline-flex min-h-11 items-center gap-0.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";

/** A link inside the opening: with a hash (the publish summary, team and rules' flow) a plain anchor, so the page hears the hash (W3). */
function To({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return href.includes("#") ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/**
 * HIRING-VISUAL-FLOW 4.5 (K12): one opening's control view. A draft: its
 * setup path as one list ("Kurulum n / N · k adım kaldı"), the one filled
 * "Kuruluma devam et" opening the next step (H7), and the publish summary at
 * `#publish` with the filled "Yayınla". Live: the funnel as tiles, what needs
 * attention, and the opening's rules in one card. The "⋯" menu holds links
 * only (plan decision 14). The publish gate, its reasons and notices are the
 * existing ones.
 */
export default async function OpeningOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const [state, people, funnel, invitable] = await Promise.all([
    workingState(user.orgId, opening.id),
    loadPanelUsers(user.orgId),
    openingFunnel(user.orgId, opening.id),
    access.edit ? invitableOpenings(user.orgId) : Promise.resolve([]),
  ]);
  // After the reads above, never beside them (ruling C21). Requests only for someone who runs openings (H9).
  const facts = (await openingCardFacts(user.orgId, [opening.id], { runs: canDecide(user.role) }))[opening.id] ?? null;
  // The opening as the invite form needs it: OPEN, of this organisation (invitableOpenings).
  const target = invitable.find((o) => o.id === opening.id) ?? null;
  const view = funnelView(funnel, opening.finishSurveyEnabled);
  const number = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 1 });
  const content = state.content;
  const describe = (p: PublishProblem) => (content ? describeProblem(p, { content, facts: state.facts, locale, openingId: opening.id }, t) : null);
  const closed = opening.status === "CLOSED";
  const base = `/hiring/openings/${opening.id}`;
  const reason = closed
    ? t("hiringOverview.closedBody")
    : !access.edit
      ? t("hiringCommon.noPermission")
      : state.problems.length
        ? (describe(state.problems[0])?.text ?? null)
        : null;
  const published = /^\d{1,6}$/.test(one(sp.published) ?? "") ? one(sp.published)! : null;
  const notice = noticeOf(sp, "publish", NOTICES);
  const waitReason = inviteWaitReason(closed, access.edit, t);

  // The setup path (4.5): the readiness rows, the advice steps passed with "Atla" (?skip=), then "Yayınla".
  const setupRows = setupRowsOf({ state, opening, people, t, locale });
  const skipped = setupSkips(sp.skip);
  const progress = setupProgress(setupRows, skipped);
  const next = setupNext(setupRows, opening.id, skipped);
  const draftOpening = opening.status === "DRAFT";

  // H7: a draft's one filled button continues the setup; "Yayınla" is filled only on the publish summary.
  const action = draftOpening ? (
    access.edit ? (
      <Button asChild variant="primary">
        {next.href.includes("#") ? <a href={next.href}>{t("hiringCommon.continueSetup")}</a> : <Link href={next.href}>{t("hiringCommon.continueSetup")}</Link>}
      </Button>
    ) : null
  ) : target ? (
    <InviteSheet opening={target} today={orgDay()} zone={zoneLabel(locale)} />
  ) : (
    // The same button waiting with the Candidates tab's reason (Task 19 ruling 2, RULES 5).
    <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:max-w-[360px] sm:items-end sm:text-right">
      <Button id="invite-candidate" variant="primary" disabled disabledReason={waitReason}>
        {t("hiringOverview.invite")}
      </Button>
      <DisabledReason id="invite-candidate-why">{waitReason}</DisabledReason>
    </div>
  );

  // Plan decision 14 and ruling C9: links only; "Kopyala" only for someone who may open an opening.
  const menu = [
    { label: t("hiringOverview.menuPreview"), href: `${base}/assessment/preview` },
    { label: t("hiringOverview.menuSettings"), detail: t("hiringOverview.menuSettingsDetail"), href: `${base}/settings` },
    ...(can(user, "opening:write") ? [{ label: t("hiringCommon.copyOpening"), href: `/hiring/openings/new?copy=${opening.id}` }] : []),
  ];

  const pathSteps = [
    ...setupRows.map((row, i) => {
      const current = i === progress.current;
      const detail =
        row.state === "done"
          ? undefined
          : row.row.reason === "NO_COMPETENCIES"
            ? t("hiringOverview.anchorsNoCompetency")
            : row.row.reason === "NO_DECISION_MAKER"
              ? t("hiringOverview.teamNoDecisionMaker")
              : row.state === "advisory"
                ? t("hiringOverview.advisory")
                : (row.fixText ?? undefined);
      const words = row.key === "team" ? "goTeam" : row.href ? rowAction(row.href) : null;
      return {
        title: t(`hiringOverview.${SETUP_LABEL[row.key]}`),
        detail,
        state: row.state === "done" ? ("done" as const) : current ? ("current" as const) : ("todo" as const),
        action:
          current && access.edit && row.href && words ? (
            <span className="flex flex-wrap items-center gap-x-5">
              <To href={row.href} className={TEXT_ACTION}>
                {t(`hiringOverview.${words}`)}
                <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
              </To>
              {row.state === "advisory" ? (
                // STATUS decision 7: advice never blocks; "Atla" passes it for this visit (the address remembers, nothing is stored).
                <Link href={`${base}?skip=${[...skipped, row.key].join(",")}`} className={TEXT_ACTION}>
                  {t("flow.skip")}
                  <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                </Link>
              ) : null}
            </span>
          ) : undefined,
      };
    }),
    {
      title: t("hiringOverview.rowPublish"),
      state: progress.current === setupRows.length ? ("current" as const) : ("todo" as const),
      action:
        progress.current === setupRows.length && access.edit && !closed ? (
          <a href="#publish" className={TEXT_ACTION}>
            {t("hiringOverview.goPublish")}
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </a>
        ) : undefined,
    },
  ];

  // The publish summary (#publish, the path's last step): what goes live, each row with "Değiştir ›".
  const decider = people.find((u) => u.id === opening.decisionMakerId) ?? null;
  const first = state.problems[0] ? describe(state.problems[0]) : null;
  const stages = content ? orderedStages(content) : [];
  const teamValue = t("hiringCommon.rulesTeam", { count: opening.memberIds.length, decider: decider?.name ?? t("hiringCommon.rulesNoDecider") });
  const deadlineValue = opening.deadlineAt ? t("hiringCommon.deadline", { date: shortDate(opening.deadlineAt, locale) }) : t("hiringCommon.noDeadline");
  const publishRows: SummaryRow[] =
    state.draft && content
      ? [
          {
            id: "version",
            label: t("hiringOverview.publishVersion"),
            value: t("hiringOverview.publishVersionValue", {
              number: state.draft.number,
              stages: stages.length,
              questions: stages.reduce((sum, s) => sum + s.activities.length, 0),
              minutes: Math.round(totalSeconds(content) / 60),
            }),
            problem: first?.text,
            edit: { href: `${base}/assessment/edit` },
          },
          { id: "team", icon: Users, label: t("hiringSettings.teamTitle"), value: teamValue, edit: { href: `${base}/settings#team-members` } },
          { id: "deadline", icon: CalendarDays, label: t("hiringOverview.publishDeadline"), value: deadlineValue, edit: { href: `${base}/settings#contact-deadline` } },
          {
            id: "preview",
            label: t("hiringOverview.publishPreview"),
            value: previewIsCurrent(state.draft) ? t("hiringOverview.publishPreviewDone") : t("hiringOverview.publishPreviewNot"),
            edit: { href: `${base}/assessment/preview` },
          },
        ]
      : [];
  const publishSummary =
    state.draft && content && access.edit && !closed ? (
      <div id="publish-summary">
        <form id="publish-form" action={publishOpeningAction}>
          <input type="hidden" name="openingId" value={opening.id} />
          <input type="hidden" name="back" value="overview" />
          <StepScreen layout="split" title={t("hiringOverview.publishSummaryTitle")} lead={<p>{t("hiringOverview.publishNote")}</p>}>
            <SummaryRows rows={publishRows} changeLabel={t("flow.change")} changedLabel={t("flow.changed")} />
          </StepScreen>
          <PublishFooter
            formId="publish-form"
            reason={reason}
            fix={first?.href ? { label: t("hiringOverview.fixProblem"), href: first.href } : null}
            labels={{ publish: t("hiringOverview.publish"), publishing: t("hiringOverview.publishing"), back: t("hiringOverview.backToOverview") }}
          />
        </form>
      </div>
    ) : null;

  const requests = facts?.requests ? facts.requests.open + facts.requests.rights : 0;
  const rulesRows: SummaryRow[] = [
    { id: "team", icon: Users, label: t("hiringSettings.teamTitle"), value: teamValue },
    { id: "contact", icon: CalendarDays, label: t("hiringSettings.candidateTitle"), value: t("hiringCommon.rulesContact", { deadline: deadlineValue, days: opening.feedbackDays }) },
    {
      id: "fair",
      icon: EyeOff,
      label: t("hiringSettings.fairTitle"),
      value: [opening.blindMode ? t("hiringCommon.rulesBlindOn") : t("hiringCommon.rulesBlindOff"), opening.finishSurveyEnabled ? t("hiringCommon.rulesSurveyOn") : t("hiringCommon.rulesSurveyOff")].join(" · "),
    },
  ];

  return (
    // Header and body share one width, so the filled button stays next to the list it depends on.
    <main className="mx-auto max-w-[960px] px-page py-8">
      <OpeningHeader opening={opening} active="overview" locale={locale} t={t} action={action} menu={menu} />
      {published ? (
        <UrlNotice params={NOTICE_PARAMS}>
          <p role="status" className="mt-6 flex items-center gap-2 text-[14px] text-ink">
            <StatusDot tone="active">
              <span className="tnum text-[14px] text-ink">{t("hiringOverview.published", { number: published })}</span>
            </StatusDot>
          </p>
        </UrlNotice>
      ) : null}
      {closed ? (
        // "Yeniden aç" lives on team and rules; an owner or manager is pointed there.
        <p className="mt-6 text-[14px] text-ink">
          {t("hiringOverview.closedNotice")}{" "}
          {canDecide(user.role) ? (
            <Link href={`${base}/settings`} className={LINK}>
              {t("hiringOverview.goReopen")}
            </Link>
          ) : null}
        </p>
      ) : null}
      {notice ? (
        <UrlNotice params={NOTICE_PARAMS}>
          <p role="status" className="mt-6 text-[14px] font-medium text-ink">
            {t(`hiringOverview.${notice}`)}
          </p>
        </UrlNotice>
      ) : null}

      <PublishSwitch summary={publishSummary}>
        <div className="mt-section space-y-section">
          {state.draft ? (
            <Card className="p-card">
              <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.readinessTitle")}</h2>
              <p className="tnum mt-0.5 text-[13px] text-muted">
                {t("hiringOverview.draftPending", { number: state.draft.number })} · {t("hiringOverview.setupCount", { done: progress.done, total: progress.total })} ·{" "}
                {t("hiringOverview.setupLeft", { count: progress.left })}
              </p>
              <div className="mt-4">
                <PathSteps steps={pathSteps} label={t("hiringOverview.readinessTitle")} locale={locale} />
              </div>
            </Card>
          ) : null}
          {/* HIRING-UX 5.4: the funnel while published, also under a new draft once candidates exist. */}
          {!state.draft || view ? (
            <Card className="p-card">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.funnelTitle")}</h2>
                {view ? (
                  <Link href={`${base}/candidates`} className={`text-[13px] ${LINK}`}>
                    {t("hiringOverview.funnelAll")}
                  </Link>
                ) : null}
              </div>
              {view ? (
                <>
                  {/* FunnelTiles (5): three boxes with a chevron between them; the share bar shows how many of those invited got this far. */}
                  <dl className="mt-3 flex items-stretch gap-2">
                    {view.steps.map((s, i) => (
                      <Fragment key={s.key}>
                        {i > 0 ? <ChevronRight className="size-4 shrink-0 self-center text-muted" strokeWidth={1.75} aria-hidden /> : null}
                        <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-3">
                          <dt className="text-[13px] text-muted">{t(`hiringOverview.funnel_${s.key}`)}</dt>
                          <dd className="tnum text-[24px] leading-8 font-semibold text-ink">{s.count}</dd>
                          {i > 0 && view.steps[0].count > 0 ? (
                            <div className="mt-1 h-1 rounded-full bg-hairline" aria-hidden>
                              <div className="h-1 rounded-full bg-ink-3" style={{ width: `${Math.round(Math.min(1, s.count / view.steps[0].count) * 100)}%` }} />
                            </div>
                          ) : null}
                        </div>
                      </Fragment>
                    ))}
                  </dl>
                  {view.time ? (
                    <p className="tnum mt-3 text-[13px] text-ink">
                      {t("hiringOverview.funnelMedian", { minutes: view.time.median })}
                      {view.time.estimate !== null ? ` · ${t("hiringOverview.funnelEstimate", { minutes: view.time.estimate })}` : ""}
                      {view.time.over ? <span className="mt-1 block text-muted">{t("hiringOverview.funnelOver")}</span> : null}
                    </p>
                  ) : null}
                  <div className="mt-4 border-t border-line pt-3">
                    <h3 className="text-[14px] font-semibold text-ink">{t("hiringOverview.experienceTitle")}</h3>
                    {view.experience.kind === "off" ? (
                      <p className="mt-1 text-[13px] text-muted">{t("hiringOverview.experienceOff")}</p>
                    ) : view.experience.kind === "waiting" ? (
                      <p className="tnum mt-1 text-[13px] text-muted">{t("hiringOverview.experienceWaiting", { needed: view.experience.needed })}</p>
                    ) : (
                      <>
                        <p className="tnum mt-1 text-[14px] text-ink">
                          {t("hiringOverview.experienceAverage", { average: number.format(view.experience.average), count: view.experience.count })}
                        </p>
                        <p className="tnum mt-0.5 text-[12px] text-muted">{t("hiringOverview.experienceBatch", { batch: SURVEY_BATCH })}</p>
                        {view.experience.comments.length ? (
                          // Task 19 ruling 1 and fix round 1: a few released comments in a fixed shuffled order, no rating or date.
                          <>
                            <p className="mt-2 text-[12px] text-muted">{t("hiringOverview.experienceComments")}</p>
                            <ul className="mt-1 space-y-1">
                              {view.experience.comments.map((comment, i) => (
                                <li key={i} className="text-[13px] break-words whitespace-pre-line text-ink-2">
                                  {comment}
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[13px] text-muted">{closed ? t("hiringOverview.closedBody") : t("hiringOverview.funnelEmpty")}</p>
              )}
            </Card>
          ) : null}
          {/* H9: requests only for someone who runs openings (their facts alone carry them); the expiring count for everyone. */}
          {facts && (requests > 0 || facts.expiringSoon > 0) ? (
            <Card className="p-card">
              <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.attentionTitle")}</h2>
              <ul className="mt-2 divide-y divide-line">
                {requests > 0 ? (
                  <li>
                    <Link href={`${base}/candidates`} className="flex items-center gap-3 py-3 text-[14px] text-ink hover:bg-canvas">
                      <Inbox className="size-[18px] text-muted" strokeWidth={1.75} aria-hidden />
                      <span className="flex-1">
                        {t("hiringCommon.openRequests", { count: requests })}
                        {/* Ruling C6: counted, said plainly, handled with plan 3. */}
                        {facts.requests && facts.requests.rights > 0 ? <span className="block text-[13px] text-muted">{t("hiringCommon.rightsNote", { count: facts.requests.rights })}</span> : null}
                      </span>
                      <span className="inline-flex items-center text-[13px] font-medium">
                        {t("hiringOpenings.nextRequests")}
                        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                      </span>
                    </Link>
                  </li>
                ) : null}
                {facts.expiringSoon > 0 ? (
                  <li>
                    <Link href={`${base}/candidates`} className="flex items-center gap-3 py-3 text-[14px] text-ink hover:bg-canvas">
                      <Clock className="size-[18px] text-muted" strokeWidth={1.75} aria-hidden />
                      <span className="flex-1">{t("hiringCommon.expiringLinks", { count: facts.expiringSoon })}</span>
                      <span className="inline-flex items-center text-[13px] font-medium">
                        {t("hiringOpenings.nextExpiring")}
                        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                      </span>
                    </Link>
                  </li>
                ) : null}
              </ul>
            </Card>
          ) : null}
          {opening.status === "OPEN" ? (
            // 4.5: the opening's rules at a glance; changing them is team and rules' work (4.10). A reviewer reads them.
            <Card className="p-card">
              <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.rulesTitle")}</h2>
              <SummaryRows rows={rulesRows} readOnly changeLabel={t("flow.change")} changedLabel={t("flow.changed")} />
              {access.edit ? (
                <div className="flex justify-end">
                  <Link href={`${base}/settings`} className={TEXT_ACTION}>
                    {t("hiringOverview.changeRules")}
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </Link>
                </div>
              ) : null}
            </Card>
          ) : null}
          {state.live ? (
            <Card className="p-card">
              <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.liveTitle")}</h2>
              <p className="tnum mt-2 text-[13px] text-muted">
                {t("hiringOverview.liveBody", { number: state.live.number, date: state.live.publishedAt ? shortDate(state.live.publishedAt, locale) : "-" })}
              </p>
            </Card>
          ) : null}
        </div>
      </PublishSwitch>
    </main>
  );
}
```

- [ ] **Step 5: The setup line on the draft's assessment pages**

In each of the five pages, add the import after the `opening-header` import, the line after the page's `notFound()` on missing content, and `setup={setup}` on its `OpeningHeader`:

| Page | Import (after) | Line after | Header |
|---|---|---|---|
| `assessment/page.tsx` | `:13`, `import { setupStrip } from "../setup-strip";` | `:33` `if (!content) notFound();` | `:44` |
| `assessment/ai/page.tsx` | `:11`, `import { setupStrip } from "../../setup-strip";` | `:42` `if (!content) notFound();` | `:48` |
| `assessment/edit/page.tsx` | `:15`, same | `:48` `if (!content) notFound();` | `:64` |
| `assessment/scorecard/page.tsx` | `:20`, same | `:50` `if (!pick \|\| !state.content) notFound();` | `:121` |
| `assessment/preview/page.tsx` | `:11`, same | `:30` `if (!content) notFound();` | `:37` |

The line (each page already holds `user`, `opening`, `access`, `t`, `locale` and its own `state` from `workingState`, so only the people are read, and only for a draft its viewer may edit):

```ts
  const setup = await setupStrip({ orgId: user.orgId, opening, access, t, locale, state });
```

and the header: `<OpeningHeader opening={opening} active="assessment" locale={locale} t={t} setup={setup} />`.

`assessment/preview/page.test.ts`, under the `../../opening-header` mock (`:30`): `vi.mock("../../setup-strip", () => ({ setupStrip: async () => null }));` (reason: the leak test's database throws on any read; the setup line is not what it tests).

- [ ] **Step 6: Copy**

`hiringOverview` new keys:

| Key | TR | EN |
|---|---|---|
| `setupLeft` | {count, plural, one {# adım kaldı.} other {# adım kaldı.}} | {count, plural, one {# step left.} other {# steps left.}} |
| `attentionTitle` | Dikkat isteyenler | Needs attention |
| `rulesTitle` | Bu alımın kuralları | This opening's rules |
| `changeRules` | Kuralları değiştir | Change the rules |
| `menuPreview` | Adayın göreceğini önizle | Preview what candidates see |
| `menuSettings` | Ekip ve kurallar | Team and rules |
| `menuSettingsDetail` | Alımı kapatmak da burada. | Closing the opening is there too. |
| `goPublish` | Yayın özetine bak | See the publish summary |
| `publishSummaryTitle` | Yayına hazır mı? | Ready to publish? |
| `publishVersion` | Yayınlanacak değerlendirme | Assessment to publish |
| `publishVersionValue` | v{number} · {stages} aşama · {questions} soru · ~{minutes} dk | v{number} · {stages, plural, one {# stage} other {# stages}} · {questions, plural, one {# question} other {# questions}} · ~{minutes} min |
| `publishDeadline` | Son gün | Last day |
| `publishPreview` | Adayın göreceği | What candidates see |
| `publishPreviewDone` | Önizlendi | Previewed |
| `publishPreviewNot` | Önizlenmedi; önerilir, yayını engellemez. | Not previewed; recommended, does not block publishing. |
| `fixProblem` | Düzelt | Fix it |
| `backToOverview` | Genel bakış | Overview |

Removed from `hiringOverview` (the old readiness `Row` was their only reader; `PathSteps` says the state to a screen reader itself): `stateDone`, `stateMissing`, `stateAdvisory`, `srDone`, `srMissing`, `srAdvisory`. Kept and reused: `readinessTitle`, `draftPending`, `rowAssessment`, `rowAnchors`, `rowWeights`, `rowTeam`, `rowPreview`, `advisory`, `goBuilder`, `goScorecard`, `goTeam`, `goPreview`, `goLibrary`, `anchorsNoCompetency`, `teamNoDecisionMaker`, `publish`, `publishing`, `publishNote` (the summary's lead), and every publish notice.

`hiringCommon` new keys (the opening's rules in one line each; Task 21's summary says the same):

| Key | TR | EN |
|---|---|---|
| `copyOpening` | Kopyala | Copy |
| `rulesTeam` | {count, plural, =0 {Değerlendirici yok} other {# değerlendirici}} · karar: {decider} | {count, plural, =0 {No reviewers} one {One reviewer} other {# reviewers}} · decides: {decider} |
| `rulesNoDecider` | kimse seçilmedi | nobody chosen |
| `rulesContact` | {deadline} · {days} günde dönüş | {deadline} · reply within {days} days |
| `rulesBlindOn` | Kimlik gizli | Identity hidden |
| `rulesBlindOff` | Kimlik açık | Identity shown |
| `rulesSurveyOn` | bitiş anketi açık | finish survey on |
| `rulesSurveyOff` | bitiş anketi kapalı | finish survey off |

`hiringCandidates.noticeNotDone`: TR "Yapılmadı:" EN "Not done:".

- [ ] **Step 7: Tests and gates**

Run: `pnpm exec vitest run "src/app/(manager)/hiring" src/solutions/hiring src/components src/i18n && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -5`
Expected: PASS and clean; the overview's `page.test.ts` passes unchanged (its fake database answers `openingCardFacts`' reads with rows that name no opening, so no attention card), `pending-button.test.ts` and `boundary.test.ts` green. `git diff --stat "src/app/(manager)/hiring/openings/[id]/actions.ts"` shows no change.

- [ ] **Step 8: Browser check**

`kademe_ui_check`, Claude in Chrome, logged in through `/login`:
1. A new draft (start one from "Alım aç"): the header's filled "Kuruluma devam et" and the `⋯` menu ("Adayın göreceğini önizle", "Ekip ve kurallar" with "Alımı kapatmak da burada.", "Kopyala"); no grey "Yayınla" anywhere on the page. "Yayına hazırlık", "Taslak v1 henüz yayınlanmadı. · Kurulum 1 / 5 · 4 adım kaldı." (the copy's numbers), the numbered path with the current step's action ("Kurucuya git ›" or "Ekibi ata ›") and, on the team or preview step, "Atla ›"; the last row "Yayınla". "Atla ›" moves the current marker to the next step (the address gains `?skip=`).
2. Finish the steps (or skip the advice): the path's last row offers "Yayın özetine bak ›"; it opens "Yayına hazır mı?" in place (the address ends in `#publish`, the focus is on the title): version, team, last day and preview rows with "Değiştir ›", the sticky footer with "‹ Genel bakış" and the filled "Yayınla". With a gate problem (empty a question's text in the builder first) "Yayınla" is grey with the problem's sentence and "Düzelt" under the bar. Publish: the overview with "v1 yayınlandı." and the filled "Aday davet et". Browser back from the summary returns to the overview.
3. The builder, the scorecard and the preview of a draft show "Kurulum n / N · Sıradaki: <adım> ›" under the tabs; a published opening's pages do not.
4. A published opening with invitations and an open request: three tiles with chevrons and share bars, the median line, "Dikkat isteyenler" with "1 açık talep · Taleplere bak ›" (and the data-rights note when one is filed) and, after setting a link to expire in a day (`update assessment_links set expires_at = now() + interval '1 day' where …`), "1 link 48 saatte doluyor"; "Bu alımın kuralları" with team, contact and fair-review rows and "Kuralları değiştir ›". A reviewer: the expiring line but no request line, the rules card without the link, no "Kopyala" in `⋯`.
5. Candidates tab: extend a link of a closed opening (or any refusal path from plan 2 Task 18's browser steps): the notice reads "Yapılmadı: …" with the warn dot; `read_page` shows `role="alert"`.
6. 1280 and 1024 screenshots; keyboard to the `⋯` and through its items, and through the path's actions.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(manager)/hiring/openings/[id]/setup-strip.ts" "src/app/(manager)/hiring/openings/[id]/publish-view.tsx" "src/app/(manager)/hiring/openings/[id]/opening-header.tsx" "src/app/(manager)/hiring/openings/[id]/page.tsx" "src/app/(manager)/hiring/openings/[id]/assessment/page.tsx" "src/app/(manager)/hiring/openings/[id]/assessment/ai/page.tsx" "src/app/(manager)/hiring/openings/[id]/assessment/edit/page.tsx" "src/app/(manager)/hiring/openings/[id]/assessment/scorecard/page.tsx" "src/app/(manager)/hiring/openings/[id]/assessment/preview/page.tsx" "src/app/(manager)/hiring/openings/[id]/assessment/preview/page.test.ts" "src/app/(manager)/hiring/openings/[id]/candidates/notices.ts" "src/app/(manager)/hiring/openings/[id]/candidates/notices.test.ts" "src/app/(manager)/hiring/openings/[id]/candidates/page.tsx" src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Make the overview the opening's control view with a setup path

A draft reads 'Kurulum n / N' as one path ending in 'Yayınla', its one
filled button 'Kuruluma devam et' opens the next step (H7), advice steps
can be skipped, and '#publish' shows the publish summary with the filled
'Yayınla' on the unchanged action. A draft's other pages show the path
in one line under the tabs. A live opening shows the funnel as tiles,
what needs attention and its rules in one card. The header's ⋯ holds
links (Kopyala only for who may open an opening, C9). Candidates-tab
refusals say 'Yapılmadı:' as an alert. preview page.test: the setup line
is mocked (its database throws by design).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 21 (new): M7, team and rules as a summary, four short flows, and "Alımı kapat" with its undo

**Files:**
- Create: `src/components/hiring/rules-flows.ts`, `rules-flows.test.ts`
- Modify (rewritten on `GuidedFlow`; the export name `OpeningSettingsForm`, its props and the rules for disabled people, stale decision makers, the deadline's earliest day and the feedback parsing kept): `src/components/hiring/opening-settings-form.tsx:1-324`
- Create: `src/components/hiring/opening-settings-form.test.ts`
- Modify: `src/app/(manager)/hiring/openings/[id]/settings/page.tsx:1-103` (the setup line, the close action under the summary, the width)
- Modify: `src/app/(manager)/hiring/openings/[id]/settings/page.test.ts:51` (`setupStrip` mocked: the test's database throws on any read)
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (`hiringSettings` new keys; `choose`, `closeTitle` removed)

**Shared with the exam:** none.

**Design and rulings:** 4.10, H2 (one field, one step: the name), H5 (M7 joins plan 2b), D10 (four short flows: team; candidate contact; fair review and the survey; the name; each saves through the one existing action with every field, those outside the flow as loaded), D13 (steps in the hash: `#team-members`, `#team-decider`, `#team-min`, `#team-review`, `#contact-deadline`, `#contact-feedback`, `#contact-email`, `#contact-review`, `#fair-blind`, `#fair-survey`, `#fair-review`, `#name`; no new route), W5 (a summary step with "değişti" marks; "Kaydet" waits with "Değişiklik yok." while nothing changed), W8 (a step's "Devam et" waits for its own fields' problems from `openingRulesProblems`; a server refusal opens the step it is about with its existing `p*` sentence; `NOT_FOUND`, `FORBIDDEN`, `CLOSED`, `INVALID` and a failure stay on the summary step with their `err*` / `saveFailed` sentence), H6 (leaving never asks; the values go back to the saved ones), P7 (the independence rule is a lock and a sentence, not a setting), RULES 4 ("Alımı kapat" closes at once, the 8-second strip gives it back, no dialog). Server actions and codes unchanged: `saveOpeningRulesAction(openingId, input)` (`settings/actions.ts:37`), `SaveRulesResult` (`settings/result.ts:11-14`), `closeOpeningAction` (`:62`), `reopenOpeningAction` (`:75`); `RulesProblem` and `openingRulesProblems` (`src/solutions/hiring/rules/opening-rules.ts:19-30`, `:42-70`). A reviewer and a closed opening read the summary only. After a team save the setup line under the tabs (Task 20's `setupStrip`, refreshed by `router.refresh()`) names the next step; nothing redirects (4.10). No `shortcut` prop on any choice card (Task 4 carry).

**Interfaces:**
- Consumes: `GuidedFlow`, `useFlowStep`, `FlowStep`, `flowJourney`, `isDirty`, `saveWait`, `summaryRows`, `stepOfProblem`, `SummaryRows` (Task 15); `ChoiceCardGroup`, `Disclosure`, `IconRow` (Task 4); `clearHash`, `subscribeHash` (C16); `setupStrip` (Task 20); `formatInviteDay` (`src/solutions/hiring/rules/invitation.ts:335`); `hiringCommon.rulesTeam`, `rulesNoDecider`, `rulesContact`, `rulesBlindOn`, `rulesBlindOff`, `rulesSurveyOn`, `rulesSurveyOff` (Task 20), `hiringCommon.deadline`, `noDeadline`, `tabSettings`, `flow.*`.
- Produces:
  - `rules-flows.ts`: `type RulesFlow = "team" | "contact" | "fair" | "name"`; `type RulesStep` (the twelve ids above); `RULES_FLOWS: Record<RulesFlow, readonly RulesStep[]>`; `FLOW_FIELDS: Record<RulesFlow, readonly (keyof OpeningRulesInput)[]>`; `rulesStepOf(problem: RulesProblem): RulesStep`; `flowOfStep(step: RulesStep): RulesFlow`; `rulesRoute(hash: string): { flow: RulesFlow; step: RulesStep } | null`; `stepWait(step, value, check: { users; today; savedDeadline }): RulesProblem | null`; `firstInvalidStep(flow, value, check): RulesStep | null`; `saveInput(saved, value, flow): OpeningRulesInput`
  - `OpeningSettingsForm` props gain `children?: ReactNode` (the page's close action, shown under the summary only)

- [ ] **Step 1: Failing tests**

```ts
// src/components/hiring/rules-flows.test.ts
import { describe, expect, it } from "vitest";
import type { OpeningRulesInput, RulesProblem } from "@/solutions/hiring/rules/opening-rules";
import { FLOW_FIELDS, RULES_FLOWS, firstInvalidStep, flowOfStep, rulesRoute, rulesStepOf, saveInput, stepWait } from "./rules-flows";

const users = [
  { id: "owner", role: "OWNER" as const, disabled: false },
  { id: "rev", role: "REVIEWER" as const, disabled: false },
  { id: "gone", role: "MANAGER" as const, disabled: true },
];
const saved: OpeningRulesInput = {
  name: "Tasarımcı · Ekim",
  memberIds: ["rev"],
  decisionMakerId: "owner",
  backupDecisionMakerId: null,
  minEvaluations: 1,
  blindMode: false,
  deadline: "2026-10-31",
  feedbackDays: 7,
  candidateContactEmail: "",
  finishSurveyEnabled: true,
};
const check = { users, today: "2026-10-06", savedDeadline: saved.deadline };

describe("team and rules as four short flows (4.10, D10)", () => {
  it("opens a flow's step from the hash; any other hash is the summary", () => {
    expect(rulesRoute("#team-decider")).toEqual({ flow: "team", step: "team-decider" });
    expect(rulesRoute("#contact-review")).toEqual({ flow: "contact", step: "contact-review" });
    expect(rulesRoute("#name")).toEqual({ flow: "name", step: "name" });
    expect(rulesRoute("")).toBeNull();
    expect(rulesRoute("#publish")).toBeNull();
    expect(flowOfStep("fair-survey")).toBe("fair");
  });

  it("puts every rules problem on the step that fixes it (W8)", () => {
    const all: RulesProblem[] = ["NAME_REQUIRED", "MEMBER_UNKNOWN", "DECISION_MAKER_REQUIRED", "DECISION_MAKER_ROLE", "BACKUP_SAME", "BACKUP_ROLE", "MIN_EVALUATIONS", "DEADLINE_INVALID", "DEADLINE_PAST", "FEEDBACK_DAYS", "EMAIL"];
    expect(Object.fromEntries(all.map((p) => [p, rulesStepOf(p)]))).toEqual({
      NAME_REQUIRED: "name",
      MEMBER_UNKNOWN: "team-members",
      DECISION_MAKER_REQUIRED: "team-decider",
      DECISION_MAKER_ROLE: "team-decider",
      BACKUP_SAME: "team-decider",
      BACKUP_ROLE: "team-decider",
      MIN_EVALUATIONS: "team-min",
      DEADLINE_INVALID: "contact-deadline",
      DEADLINE_PAST: "contact-deadline",
      FEEDBACK_DAYS: "contact-feedback",
      EMAIL: "contact-email",
    });
    // No field belongs to two flows; twelve steps in all (three summaries among them).
    expect(Object.values(FLOW_FIELDS).flat()).toHaveLength(new Set(Object.values(FLOW_FIELDS).flat()).size);
    expect(Object.values(RULES_FLOWS).flat()).toHaveLength(12);
  });

  it("lets a step's 'Devam et' wait only for its own fields' problems, in the existing rules' words", () => {
    const value = { ...saved, decisionMakerId: "gone", feedbackDays: 0 };
    expect(stepWait("team-decider", value, check)).toBe("DECISION_MAKER_ROLE");
    expect(stepWait("team-members", value, check)).toBeNull();
    expect(stepWait("contact-feedback", value, check)).toBe("FEEDBACK_DAYS");
    // A passed deadline left as it is stays valid; a changed one may not be in the past.
    expect(stepWait("contact-deadline", { ...saved, deadline: "2026-10-01" }, { ...check, savedDeadline: "2026-10-01" })).toBeNull();
    expect(stepWait("contact-deadline", { ...saved, deadline: "2026-10-01" }, check)).toBe("DEADLINE_PAST");
  });

  it("never lets a link skip a step that waits", () => {
    expect(firstInvalidStep("team", { ...saved, decisionMakerId: null }, check)).toBe("team-decider");
    expect(firstInvalidStep("team", saved, check)).toBeNull();
    expect(firstInvalidStep("contact", { ...saved, candidateContactEmail: "x@" }, check)).toBe("contact-email");
  });

  it("sends the flow's own fields as chosen and every other field as loaded (pass-through)", () => {
    const value = { ...saved, name: "Yeni ad", memberIds: ["rev", "owner"], feedbackDays: 14, blindMode: true };
    expect(saveInput(saved, value, "contact")).toEqual({ ...saved, feedbackDays: 14 });
    expect(saveInput(saved, value, "team")).toEqual({ ...saved, memberIds: ["rev", "owner"] });
    expect(saveInput(saved, value, "fair")).toEqual({ ...saved, blindMode: true });
    expect(saveInput(saved, value, "name")).toEqual({ ...saved, name: "Yeni ad" });
  });
});
```

```ts
// src/components/hiring/opening-settings-form.test.ts
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("@/app/(manager)/hiring/openings/[id]/settings/actions", () => ({ saveOpeningRulesAction: vi.fn() }));

import { OpeningSettingsForm } from "./opening-settings-form";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;

const users = [
  { id: "owner", name: "Kadir Ay", role: "OWNER" as const, disabled: false },
  { id: "rev", name: "Ece Yıldız", role: "REVIEWER" as const, disabled: false },
];
const initial = {
  name: "Tasarımcı · Ekim",
  memberIds: ["rev"],
  decisionMakerId: "owner",
  backupDecisionMakerId: null,
  minEvaluations: 2,
  blindMode: false,
  deadline: "2026-10-31",
  feedbackDays: 7,
  candidateContactEmail: "",
  finishSurveyEnabled: true,
};
const render = (canEdit: boolean, closed = false) =>
  renderToStaticMarkup(
    createElement(
      Provider,
      { locale: "tr", messages: managerMessagesFor("tr"), timeZone: "Europe/Istanbul" },
      createElement(OpeningSettingsForm, { openingId: "o1", initial, users, today: "2026-10-06", zone: "Türkiye saati", canEdit, closed }, createElement("p", null, "KAPAT-EYLEMİ")),
    ),
  );

describe("team and rules: the summary (4.10, P7, H9)", () => {
  it("shows the four groups with 'Değiştir' each, the locked rule, and the page's close action under them", () => {
    const out = render(true);
    for (const words of ["Ekip", "Aday iletişimi", "Adil değerlendirme", "Alım adı", "1 değerlendirici · karar: Kadir Ay", "Ece Yıldız · Her adayı en az 2 kişi değerlendirir.", "7 günde dönüş", "Kimlik açık · bitiş anketi açık"]) {
      expect(out).toContain(words);
    }
    expect(out.match(/Değiştir<span class="sr-only">/g)).toHaveLength(4);
    expect(out).toContain("Değerlendiriciler birbirinin puanını kendi puanlarını gönderince görür");
    expect(out).toContain("KAPAT-EYLEMİ");
  });

  it("a reviewer and a closed opening read the same summary: no 'Değiştir', no close action", () => {
    for (const out of [render(false), render(true, true)]) {
      expect(out).toContain("1 değerlendirici · karar: Kadir Ay");
      expect(out).not.toContain("Değiştir");
      expect(out).not.toContain("KAPAT-EYLEMİ");
    }
  });
});
```

`settings/page.test.ts`, under the `../opening-header` mock (`:51`):

```ts
// The setup line reads the draft; this page test never reaches a database.
vi.mock("../setup-strip", () => ({ setupStrip: async () => null }));
```

(The page test's other expectations stay as they are: the form's props, the close form with its `PendingButton` "Alımı kapat" / "Kapatılıyor" (now the form's child), the reopen card, the undo strip.)

Run: `pnpm exec vitest run src/components/hiring/rules-flows.test.ts src/components/hiring/opening-settings-form.test.ts "src/app/(manager)/hiring/openings/[id]/settings"`
Expected: FAIL (`rules-flows` missing; the summary words and "Değiştir" rows do not exist; the page has no `setupStrip` import yet, so its mock is unused and the page test still passes).

- [ ] **Step 2: The flows as pure rules**

```ts
// src/components/hiring/rules-flows.ts
import { stepOfProblem } from "@/components/manager/flow-model";
import { openingRulesProblems, type OpeningRulesInput, type PanelUser, type RulesProblem } from "@/solutions/hiring/rules/opening-rules";

/**
 * HIRING-VISUAL-FLOW 4.10 (H2, H5, D10, W1-W8): team and rules as a read-only
 * summary and four short flows, each step in the hash on the same page (D13).
 * Every flow saves through the one existing action with every field: the
 * fields outside the flow go back as loaded, so a flow changes only its own.
 */
export type RulesFlow = "team" | "contact" | "fair" | "name";
export type RulesStep =
  | "team-members"
  | "team-decider"
  | "team-min"
  | "team-review"
  | "contact-deadline"
  | "contact-feedback"
  | "contact-email"
  | "contact-review"
  | "fair-blind"
  | "fair-survey"
  | "fair-review"
  | "name";
type Field = keyof OpeningRulesInput;

export const RULES_FLOWS: Record<RulesFlow, readonly RulesStep[]> = {
  team: ["team-members", "team-decider", "team-min", "team-review"],
  contact: ["contact-deadline", "contact-feedback", "contact-email", "contact-review"],
  fair: ["fair-blind", "fair-survey", "fair-review"],
  name: ["name"],
};

/** The fields each flow decides (its summary's rows and what it may change). */
export const FLOW_FIELDS: Record<RulesFlow, readonly Field[]> = {
  team: ["memberIds", "decisionMakerId", "backupDecisionMakerId", "minEvaluations"],
  contact: ["deadline", "feedbackDays", "candidateContactEmail"],
  fair: ["blindMode", "finishSurveyEnabled"],
  name: ["name"],
};

/** W8: every problem the rules (and the server) can name, on the step that fixes it. */
const PROBLEM_STEP: Record<RulesProblem, RulesStep> = {
  NAME_REQUIRED: "name",
  MEMBER_UNKNOWN: "team-members",
  DECISION_MAKER_REQUIRED: "team-decider",
  DECISION_MAKER_ROLE: "team-decider",
  BACKUP_SAME: "team-decider",
  BACKUP_ROLE: "team-decider",
  MIN_EVALUATIONS: "team-min",
  DEADLINE_INVALID: "contact-deadline",
  DEADLINE_PAST: "contact-deadline",
  FEEDBACK_DAYS: "contact-feedback",
  EMAIL: "contact-email",
};

export const rulesStepOf = (problem: RulesProblem): RulesStep => stepOfProblem(PROBLEM_STEP, problem) ?? "name";

const ALL_STEPS = Object.values(RULES_FLOWS).flat();

/** The flow a step belongs to. */
export const flowOfStep = (step: RulesStep): RulesFlow => (Object.keys(RULES_FLOWS) as RulesFlow[]).find((flow) => RULES_FLOWS[flow].includes(step)) ?? "name";

/** W3: the address's hash as a flow and its step; any other hash is the summary (null). */
export function rulesRoute(hash: string): { flow: RulesFlow; step: RulesStep } | null {
  const step = ALL_STEPS.find((s) => `#${s}` === hash);
  return step ? { flow: flowOfStep(step), step } : null;
}

type Check = { users: PanelUser[]; today: string; savedDeadline: string | null };

/** W8: the first problem of the rules that this step fixes, or null ("Devam et" goes on). */
export function stepWait(step: RulesStep, value: OpeningRulesInput, check: Check): RulesProblem | null {
  return openingRulesProblems(value, check.users, check.today, check.savedDeadline).find((p) => PROBLEM_STEP[p] === step) ?? null;
}

/** W3: the first step of the flow that waits; a link past it opens it. */
export function firstInvalidStep(flow: RulesFlow, value: OpeningRulesInput, check: Check): RulesStep | null {
  return RULES_FLOWS[flow].find((step) => stepWait(step, value, check) !== null) ?? null;
}

/** D10: what a flow sends: its own fields as chosen, every other field as loaded. */
export function saveInput(saved: OpeningRulesInput, value: OpeningRulesInput, flow: RulesFlow): OpeningRulesInput {
  const out: OpeningRulesInput = { ...saved };
  for (const field of FLOW_FIELDS[flow]) Object.assign(out, { [field]: value[field] });
  return out;
}
```

- [ ] **Step 3: The summary and the four flows**

Replace `src/components/hiring/opening-settings-form.tsx` with:

```tsx
"use client";

import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { CalendarDays, EyeOff, Lock, Tag, Users } from "lucide-react";
import { flowJourney, isDirty, saveWait, summaryRows } from "@/components/manager/flow-model";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { SummaryRows, type SummaryRow } from "@/components/manager/summary-rows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { Disclosure } from "@/components/visual/disclosure";
import { IconRow } from "@/components/visual/icon-row";
import { useMT } from "@/i18n/manager-client";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locale";
import { clearHash, subscribeHash } from "@/lib/client/hash-step";
import { canDecide } from "@/solutions/hiring/rules/access";
import { formatInviteDay } from "@/solutions/hiring/rules/invitation";
import { openingRulesProblems, type OpeningRulesInput, type RulesProblem } from "@/solutions/hiring/rules/opening-rules";
import { saveOpeningRulesAction } from "@/app/(manager)/hiring/openings/[id]/settings/actions";
import { FLOW_FIELDS, RULES_FLOWS, firstInvalidStep, rulesRoute, rulesStepOf, saveInput, stepWait, type RulesFlow, type RulesStep } from "./rules-flows";

export type SettingsUser = { id: string; name: string; role: "OWNER" | "MANAGER" | "REVIEWER"; disabled: boolean };

type Notice = { kind: "saved"; renamed: string | null } | { kind: "problem"; problem: RulesProblem } | { kind: "code"; code: "NOT_FOUND" | "FORBIDDEN" | "CLOSED" | "INVALID" } | { kind: "failed" };

const NONE = "none";
const REVIEW: Record<RulesFlow, RulesStep> = { team: "team-review", contact: "contact-review", fair: "fair-review", name: "name" };
/** A whole number as typed, or NaN (which the rules refuse) for anything else. */
const wholeNumber = (text: string) => (/^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN);
const currentHash = () => window.location.hash;
const noHash = () => "";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("tr"))
    .join("");

/**
 * HIRING-UX 5.18 as HIRING-VISUAL-FLOW 4.10 (K12, H2, H5, D10): the rules'
 * summary, and each group changed in its own short flow on GuidedFlow (team;
 * candidate contact; fair review and the survey; the name). The step lives in
 * the hash (#team-members ...), so a control view's link opens the right one.
 * Every flow saves through saveOpeningRulesAction with every field (those
 * outside the flow as loaded); the same rules as the server
 * (openingRulesProblems) make each step's "Devam et" wait, and a refusal
 * opens the step it is about with its existing sentence. Leaving never asks
 * (H6). A reviewer and a closed opening read the summary only. `children` is
 * the page's "Alımı kapat", shown under the summary.
 */
export function OpeningSettingsForm({
  openingId,
  initial,
  users,
  today,
  zone,
  canEdit,
  closed,
  children,
}: {
  openingId: string;
  initial: OpeningRulesInput;
  users: SettingsUser[];
  /** The organisation's calendar day (orgDay), so the form and the server agree on "past". */
  today: string;
  /** The organisation's time zone name, said next to the deadline. */
  zone: string;
  canEdit: boolean;
  closed: boolean;
  children?: ReactNode;
}) {
  const t = useMT("hiringSettings");
  const common = useMT("hiringCommon");
  const flowT = useMT("flow");
  const appLocale = useLocale();
  const locale = isLocale(appLocale) ? appLocale : DEFAULT_LOCALE;
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [feedbackText, setFeedbackText] = useState(String(initial.feedbackDays));
  const [pickDay, setPickDay] = useState(initial.deadline !== null);
  const [fromSummary, setFromSummary] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, start] = useTransition();

  const hash = useSyncExternalStore(subscribeHash, currentHash, noHash);
  const route = canEdit && !closed ? rulesRoute(hash) : null;
  const flow: RulesFlow = route?.flow ?? "team";
  const check = { users, today, savedDeadline: saved.deadline };
  const nav = useFlowStep({ steps: RULES_FLOWS[flow], firstInvalid: firstInvalidStep(flow, value, check), mode: "hash" });
  const step = nav.step;
  const steps = RULES_FLOWS[flow];
  const index = steps.indexOf(step);
  const changed = isDirty(saved, value, FLOW_FIELDS[flow]);

  const set = <K extends keyof OpeningRulesInput>(key: K, v: OpeningRulesInput[K]) => {
    setNotice(null);
    setValue((s) => ({ ...s, [key]: v }));
  };
  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.name ?? null;
  const deciders = users.filter((u) => !u.disabled && canDecide(u.role));
  // A disabled person stays listed while they are still on the panel, so they can be taken off it.
  const panel = users.filter((u) => !u.disabled || saved.memberIds.includes(u.id));
  // A saved decision maker who can no longer decide stays visible, marked, until someone else is chosen; it cannot be chosen again.
  const stale = (id: string | null) => (id && !deciders.some((u) => u.id === id) ? (users.find((u) => u.id === id) ?? null) : null);
  const personCard = (u: SettingsUser, disabled = false) => ({
    value: u.id,
    label: u.name,
    marker: initials(u.name),
    description: u.disabled ? t("inactive") : t(`role${u.role}`),
    disabled,
  });
  const deciderItems = (id: string | null) => [...(stale(id) ? [personCard(stale(id)!, true)] : []), ...deciders.map((u) => personCard(u))];
  const activeReviewers = value.memberIds.filter((id) => users.some((u) => u.id === id && !u.disabled)).length;
  const deadlineText = (day: string | null) => (day ? common("deadline", { date: formatInviteDay(day, locale) }) : common("noDeadline"));
  const blindText = (on: boolean) => (on ? common("rulesBlindOn") : common("rulesBlindOff"));
  const surveyText = (on: boolean | undefined) => (on ?? true ? common("rulesSurveyOn") : common("rulesSurveyOff"));

  function leave() {
    setValue(saved);
    setFeedbackText(String(saved.feedbackDays));
    setPickDay(saved.deadline !== null);
    setFromSummary(false);
    clearHash();
  }
  function open(target: RulesFlow) {
    setNotice(null);
    nav.go(RULES_FLOWS[target][0]);
  }
  function edit(target: RulesStep) {
    setFromSummary(true);
    nav.go(target);
  }

  function save() {
    const sent = saveInput(saved, value, flow);
    setNotice(null);
    start(async () => {
      try {
        const res = await saveOpeningRulesAction(openingId, sent);
        if (res.ok) {
          // A name another opening already has was numbered on the server: show what was stored.
          const stored = { ...sent, name: res.name };
          setSaved(stored);
          setValue(stored);
          setNotice({ kind: "saved", renamed: res.name !== sent.name.trim() ? res.name : null });
          setFromSummary(false);
          clearHash();
          router.refresh();
        } else if ("problems" in res) {
          const problem = res.problems[0];
          if (!problem) return setNotice({ kind: "failed" });
          setNotice({ kind: "problem", problem });
          if (rulesStepOf(problem) !== step) nav.go(rulesStepOf(problem));
        } else setNotice({ kind: "code", code: res.code });
      } catch {
        setNotice({ kind: "failed" });
      }
    });
  }

  // W8: the server's refusal in its existing words, on the step it is about (or on the summary step).
  const refusal =
    notice?.kind === "problem" && rulesStepOf(notice.problem) === step
      ? t(`p${notice.problem}`)
      : (notice?.kind === "code" || notice?.kind === "failed") && step === REVIEW[flow]
        ? notice.kind === "code"
          ? t(`err${notice.code}`)
          : t("saveFailed")
        : null;
  const note = refusal ? (
    <p role="alert" className="text-[14px] font-medium text-ink">
      {refusal}
    </p>
  ) : null;

  if (!route) {
    const decider = nameOf(saved.decisionMakerId);
    const backup = nameOf(saved.backupDecisionMakerId);
    const rows: SummaryRow[] = [
      {
        id: "team",
        icon: Users,
        label: t("teamTitle"),
        value: common("rulesTeam", { count: saved.memberIds.length, decider: decider ?? common("rulesNoDecider") }),
        detail: [saved.memberIds.map(nameOf).filter(Boolean).join(", "), t("summaryMin", { count: saved.minEvaluations }), backup ? t("backupLine", { name: backup }) : null].filter(Boolean).join(" · "),
        edit: { onClick: () => open("team") },
      },
      {
        id: "contact",
        icon: CalendarDays,
        label: t("candidateTitle"),
        value: common("rulesContact", { deadline: deadlineText(saved.deadline), days: saved.feedbackDays }),
        detail: saved.candidateContactEmail || t("noEmail"),
        edit: { onClick: () => open("contact") },
      },
      { id: "fair", icon: EyeOff, label: t("fairTitle"), value: [blindText(saved.blindMode), surveyText(saved.finishSurveyEnabled)].join(" · "), edit: { onClick: () => open("fair") } },
      { id: "name", icon: Tag, label: t("name"), value: saved.name, edit: { onClick: () => open("name") } },
    ];
    return (
      <div className="space-y-section">
        {notice?.kind === "saved" ? (
          <p role="status" className="text-[14px] font-medium text-ink">
            {notice.renamed ? t("savedRenamed", { name: notice.renamed }) : t("saved")}
          </p>
        ) : null}
        <Card className="p-card">
          <SummaryRows rows={rows} readOnly={!canEdit || closed} changeLabel={flowT("change")} changedLabel={flowT("changed")} />
          {/* P7: the fixed rule is not a setting: a lock and a sentence. */}
          <div className="border-t border-line pt-4">
            <IconRow icon={Lock} title={t("independence")} detail={t("independenceLocked")} />
          </div>
        </Card>
        {canEdit && !closed ? children : null}
      </div>
    );
  }

  const wait = (s: RulesStep): string | null => {
    if (s === "contact-deadline" && pickDay && !value.deadline) return t("pDEADLINE_INVALID");
    const problem = stepWait(s, value, check);
    return problem ? t(`p${problem}`) : null;
  };
  const forward: FlowStep["primary"] = {
    kind: "button",
    id: "rules-next",
    label: fromSummary ? flowT("backToSummary") : flowT("continue"),
    waitReason: wait(step),
    onClick: () => {
      setFromSummary(false);
      nav.go(fromSummary ? REVIEW[flow] : steps[index + 1]);
    },
  };
  const whole = openingRulesProblems(saveInput(saved, value, flow), users, today, saved.deadline);
  const saveAction: FlowStep["primary"] = {
    kind: "button",
    id: "rules-save",
    label: t("save"),
    busy: pending,
    busyLabel: t("saving"),
    waitReason: saveWait(changed) ? flowT("noChanges") : whole[0] ? t(`p${whole[0]}`) : null,
    onClick: save,
  };
  // A problem outside this step (a saved decision maker who left, say) is fixed where it lives.
  const fix =
    changed && whole[0] && !refusal ? (
      <Button size="sm" onClick={() => edit(rulesStepOf(whole[0]))}>
        {flowT("change")}
      </Button>
    ) : null;
  const marks = Object.fromEntries(summaryRows(saved, value, FLOW_FIELDS[flow]).map((r) => [r.field, r.changed])) as Partial<Record<keyof OpeningRulesInput, boolean>>;
  const review = (rows: SummaryRow[], extra?: ReactNode): FlowStep => ({
    id: REVIEW[flow],
    title: t("reviewTitle"),
    layout: "split",
    primary: saveAction,
    note: note ?? fix,
    body: (
      <div className="space-y-4">
        <SummaryRows rows={rows} changeLabel={flowT("change")} changedLabel={flowT("changed")} />
        {extra}
      </div>
    ),
  });

  const screens: Record<RulesStep, FlowStep> = {
    "team-members": {
      id: "team-members",
      title: t("stepMembersTitle"),
      lead: <p>{t("membersHint")}</p>,
      layout: "split",
      primary: forward,
      note,
      body: (
        <ChoiceCardGroup
          type="multi"
          name="rules-members"
          value={value.memberIds}
          onChange={(ids) => set("memberIds", ids)}
          // A disabled person can be taken off the panel but not put back on it.
          items={panel.map((u) => personCard(u, u.disabled && !value.memberIds.includes(u.id)))}
        />
      ),
    },
    "team-decider": {
      id: "team-decider",
      title: t("stepDeciderTitle"),
      lead: <p>{t("decisionMakerHint")}</p>,
      layout: "split",
      primary: forward,
      note,
      body: (
        <div className="space-y-4">
          <ChoiceCardGroup type="single" name="rules-decider" value={value.decisionMakerId ? [value.decisionMakerId] : []} onChange={([id]) => set("decisionMakerId", id ?? null)} items={deciderItems(value.decisionMakerId)} />
          <Disclosure label={t("backup")} defaultOpen={value.backupDecisionMakerId !== null}>
            <ChoiceCardGroup
              type="single"
              name="rules-backup"
              value={[value.backupDecisionMakerId ?? NONE]}
              onChange={([id]) => set("backupDecisionMakerId", !id || id === NONE ? null : id)}
              items={[{ value: NONE, label: t("noBackup") }, ...deciderItems(value.backupDecisionMakerId)]}
            />
          </Disclosure>
        </div>
      ),
    },
    "team-min": {
      id: "team-min",
      title: t("stepMinTitle"),
      lead: <p>{t("minEvaluationsOverride")}</p>,
      layout: "split",
      primary: forward,
      note,
      body: (
        <div className="space-y-3">
          <ChoiceCardGroup
            type="single"
            name="rules-min"
            size="square"
            columns={5}
            value={[String(value.minEvaluations)]}
            onChange={([n]) => set("minEvaluations", Number(n))}
            items={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: <span className="tnum">{n}</span> }))}
          />
          {value.minEvaluations > activeReviewers ? <p className="tnum text-[14px] text-ink">{t("minEvaluationsShort", { count: activeReviewers, min: value.minEvaluations })}</p> : null}
        </div>
      ),
    },
    "team-review": review([
      { id: "members", label: t("members"), value: value.memberIds.map(nameOf).filter(Boolean).join(", ") || "-", changed: marks.memberIds, edit: { onClick: () => edit("team-members") } },
      {
        id: "decider",
        label: t("decisionMaker"),
        value: nameOf(value.decisionMakerId) ?? "-",
        detail: value.backupDecisionMakerId ? t("backupLine", { name: nameOf(value.backupDecisionMakerId) ?? "-" }) : undefined,
        changed: marks.decisionMakerId || marks.backupDecisionMakerId,
        edit: { onClick: () => edit("team-decider") },
      },
      { id: "min", label: t("minEvaluations"), value: <span className="tnum">{value.minEvaluations}</span>, changed: marks.minEvaluations, edit: { onClick: () => edit("team-min") } },
    ]),
    "contact-deadline": {
      id: "contact-deadline",
      title: t("stepDeadlineTitle"),
      lead: <p>{t("deadlineHint", { zone })}</p>,
      layout: "split",
      primary: forward,
      note,
      body: (
        <div className="space-y-4">
          <ChoiceCardGroup
            type="single"
            name="rules-deadline"
            value={[pickDay ? "day" : NONE]}
            onChange={([v]) => {
              setPickDay(v === "day");
              if (v !== "day") set("deadline", null);
            }}
            items={[
              { value: NONE, label: t("deadlineNone") },
              { value: "day", label: t("deadlinePick") },
            ]}
          />
          {pickDay ? (
            <div className="space-y-2">
              <Label htmlFor="rules-deadline-day">{t("deadline")}</Label>
              <Input
                id="rules-deadline-day"
                type="date"
                className="tnum w-56 text-[16px]"
                // The earliest day applies only to a new value; a passed deadline left as it is stays valid.
                min={value.deadline === saved.deadline ? undefined : today}
                value={value.deadline ?? ""}
                onChange={(e) => set("deadline", e.target.value || null)}
              />
            </div>
          ) : null}
        </div>
      ),
    },
    "contact-feedback": {
      id: "contact-feedback",
      title: t("stepFeedbackTitle"),
      lead: <p>{t("feedbackHint", { days: Number.isNaN(value.feedbackDays) ? "-" : value.feedbackDays })}</p>,
      layout: "single",
      primary: forward,
      note,
      body: (
        <div className="space-y-3">
          <Label htmlFor="rules-feedback">{t("feedbackDays")}</Label>
          <Input
            id="rules-feedback"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            className="tnum w-32 text-[16px]"
            value={feedbackText}
            onChange={(e) => {
              setFeedbackText(e.target.value);
              set("feedbackDays", wholeNumber(e.target.value));
            }}
          />
          <div className="flex flex-wrap gap-2">
            {[3, 7, 14].map((days) => (
              <Button
                key={days}
                size="sm"
                onClick={() => {
                  setFeedbackText(String(days));
                  set("feedbackDays", days);
                }}
              >
                {t("feedbackQuick", { days })}
              </Button>
            ))}
          </div>
        </div>
      ),
    },
    "contact-email": {
      id: "contact-email",
      title: t("stepEmailTitle"),
      lead: <p>{t("emailLead")}</p>,
      layout: "single",
      primary: forward,
      note,
      body: (
        <div className="space-y-2">
          <Label htmlFor="rules-email">{t("contactEmail")}</Label>
          <Input id="rules-email" type="email" autoComplete="off" maxLength={200} className="text-[16px]" value={value.candidateContactEmail} onChange={(e) => set("candidateContactEmail", e.target.value)} />
        </div>
      ),
    },
    "contact-review": review([
      { id: "deadline", label: t("deadline"), value: deadlineText(value.deadline), changed: marks.deadline, edit: { onClick: () => edit("contact-deadline") } },
      { id: "feedback", label: t("feedbackDays"), value: <span className="tnum">{Number.isNaN(value.feedbackDays) ? "-" : value.feedbackDays}</span>, changed: marks.feedbackDays, edit: { onClick: () => edit("contact-feedback") } },
      { id: "email", label: t("contactEmail"), value: value.candidateContactEmail || t("noEmail"), changed: marks.candidateContactEmail, edit: { onClick: () => edit("contact-email") } },
    ]),
    "fair-blind": {
      id: "fair-blind",
      title: t("stepBlindTitle"),
      lead: <p>{t("blindModeHint")}</p>,
      layout: "split",
      primary: forward,
      note,
      body: (
        <ChoiceCardGroup
          type="single"
          name="rules-blind"
          value={[value.blindMode ? "hide" : "show"]}
          onChange={([v]) => set("blindMode", v === "hide")}
          items={[
            { value: "show", label: t("blindShow") },
            { value: "hide", label: t("blindHide") },
          ]}
        />
      ),
    },
    "fair-survey": {
      id: "fair-survey",
      title: t("stepSurveyTitle"),
      lead: <p>{t("finishSurveyHint")}</p>,
      layout: "split",
      primary: forward,
      note,
      body: (
        <ChoiceCardGroup
          type="single"
          name="rules-survey"
          value={[(value.finishSurveyEnabled ?? true) ? "on" : "off"]}
          onChange={([v]) => set("finishSurveyEnabled", v === "on")}
          items={[
            { value: "on", label: t("surveyOn") },
            { value: "off", label: t("surveyOff") },
          ]}
        />
      ),
    },
    "fair-review": review(
      [
        { id: "blind", label: t("blindMode"), value: blindText(value.blindMode), changed: marks.blindMode, edit: { onClick: () => edit("fair-blind") } },
        { id: "survey", label: t("finishSurvey"), value: surveyText(value.finishSurveyEnabled), changed: marks.finishSurveyEnabled, edit: { onClick: () => edit("fair-survey") } },
      ],
      <IconRow icon={Lock} title={t("independence")} detail={t("independenceLocked")} />,
    ),
    // H2: one field, one step, its own "Kaydet".
    name: {
      id: "name",
      title: t("stepNameTitle"),
      layout: "single",
      primary: saveAction,
      note,
      body: (
        <div className="space-y-2">
          <Label htmlFor="rules-name">{t("name")}</Label>
          <Input id="rules-name" maxLength={200} className="text-[16px]" value={value.name} onChange={(e) => set("name", e.target.value)} />
        </div>
      ),
    },
  };

  return (
    <GuidedFlow
      kicker={`${common("tabSettings")} · ${flow === "team" ? t("teamTitle") : flow === "contact" ? t("candidateTitle") : flow === "fair" ? t("fairTitle") : t("name")}`}
      step={screens[step]}
      journey={steps.length > 1 ? flowJourney(steps, step) : null}
      back={index === 0 ? { label: flowT("backToSummary"), onClick: leave } : { label: flowT("back"), onClick: () => nav.back() }}
      exit={{ dirty: changed, onClick: leave }}
      enter={nav.moved}
    />
  );
}
```

- [ ] **Step 4: The page**

Replace `src/app/(manager)/hiring/openings/[id]/settings/page.tsx` with:

```tsx
import { Card } from "@/components/ui/card";
import { UndoStrip } from "@/components/ui/undo-strip";
import { OpeningSettingsForm, type SettingsUser } from "@/components/hiring/opening-settings-form";
import { PendingButton } from "@/components/ui/pending-button";
import { UrlNotice } from "@/components/ui/url-notice";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { one } from "@/lib/url-notice";
import { loadPanelUsers } from "@/server/settings";
import { canDecide } from "@/solutions/hiring/rules/access";
import { openingFor } from "../access";
import { OpeningHeader } from "../opening-header";
import { setupStrip } from "../setup-strip";
import { closeOpeningAction, reopenOpeningAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * HIRING-UX 5.18 as HIRING-VISUAL-FLOW 4.10 "Ekip ve kurallar": the rules'
 * summary and its four short flows (OpeningSettingsForm). Everyone who may see
 * the opening sees this page (a reviewer outside the team gets the 404 of
 * openingFor); only an owner or manager of an opening that is not closed
 * changes it. "Alımı kapat" is a text action under the summary: it closes at
 * once and the 8-second strip gives it back (RULES 4, no dialog). A closed
 * opening is read-only, and an owner or manager gets "Yeniden aç" as the
 * page's one filled button.
 */
export default async function OpeningSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const [all, sp] = await Promise.all([loadPanelUsers(user.orgId), searchParams]);
  // 4.5: the draft's setup path, one line under the tabs (after the read above, ruling C21).
  const setup = await setupStrip({ orgId: user.orgId, opening, access, t, locale });
  const closed = opening.status === "CLOSED";
  const runs = canDecide(user.role);
  // Someone who only reads the opening sees the people on it, not the organisation's whole user list.
  const onOpening = new Set([...opening.memberIds, opening.decisionMakerId, opening.backupDecisionMakerId]);
  const users: SettingsUser[] = all
    .filter((u) => access.edit || onOpening.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, role: u.role, disabled: u.disabledAt !== null }));

  return (
    <main className="mx-auto max-w-[1080px] px-page py-8">
      <OpeningHeader opening={opening} active="settings" locale={locale} t={t} setup={setup} />
      {closed ? (
        <Card className="mt-section space-y-3 p-card">
          <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringSettings.closedTitle")}</h2>
          <p className="text-[13px] text-muted">{runs ? t("hiringSettings.closedBody") : t("hiringSettings.closedReadOnly")}</p>
          {runs ? (
            <form action={reopenOpeningAction}>
              <input type="hidden" name="openingId" value={opening.id} />
              <PendingButton variant="primary" label={t("hiringSettings.reopen")} pendingLabel={t("hiringSettings.reopening")} />
            </form>
          ) : null}
        </Card>
      ) : null}
      <div className="mt-section">
        <OpeningSettingsForm
          // A reopen gives the form fresh values; a save keeps the form (and its "Kaydedildi.").
          // `initial.deadline` is also the saved day: a passed deadline blocks only a change.
          key={opening.status}
          openingId={opening.id}
          canEdit={access.edit}
          closed={closed}
          today={orgDay()}
          zone={zoneLabel(locale)}
          users={users}
          initial={{
            name: opening.name,
            memberIds: opening.memberIds,
            decisionMakerId: opening.decisionMakerId,
            backupDecisionMakerId: opening.backupDecisionMakerId,
            minEvaluations: opening.minEvaluations,
            blindMode: opening.blindMode,
            deadline: opening.deadlineAt ? orgDay(opening.deadlineAt) : null,
            feedbackDays: opening.feedbackDays,
            candidateContactEmail: opening.candidateContactEmail ?? "",
            finishSurveyEnabled: opening.finishSurveyEnabled,
          }}
        >
          {access.edit ? (
            // Shown under the summary only, never inside a flow (the form draws it there).
            <div className="space-y-1">
              <form action={closeOpeningAction}>
                <input type="hidden" name="openingId" value={opening.id} />
                <PendingButton label={t("hiringSettings.close")} pendingLabel={t("hiringSettings.closing")} />
              </form>
              <p className="text-[13px] text-muted">{t("hiringSettings.closeBody")}</p>
            </div>
          ) : null}
        </OpeningSettingsForm>
      </div>
      {one(sp.closed) === "1" && closed && runs ? (
        // Shown once after closing; a reload does not bring the strip back.
        <UrlNotice params={["closed"]}>
          <UndoStrip message={t("hiringSettings.closedUndo")} action={reopenOpeningAction} hiddenFields={{ openingId: opening.id }} />
        </UrlNotice>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 5: Copy (`hiringSettings`, new keys; every `p<PROBLEM>`, `err<CODE>`, `saved`, `savedRenamed`, `saveFailed`, `closeBody`, `closedUndo`, `close`, `closing`, `reopen`, `reopening`, `closedTitle`, `closedBody`, `closedReadOnly` and the field labels and hints unchanged)**

| Key | TR | EN |
|---|---|---|
| `stepMembersTitle` | Kim değerlendirecek? | Who will review? |
| `stepDeciderTitle` | Kararı kim verecek? | Who will decide? |
| `stepMinTitle` | Her adayı kaç kişi değerlendirsin? | How many people review each candidate? |
| `stepDeadlineTitle` | Son gün ne zaman? | When is the last day? |
| `stepFeedbackTitle` | Adaya kaç günde dönmeyi söz veriyorsun? | Within how many days do you promise a reply? |
| `stepEmailTitle` | Aday sorusunu kime yazsın? | Where can candidates write with a question? |
| `stepBlindTitle` | Değerlendiriciler adayın kimliğini görsün mü? | Do reviewers see who the candidate is? |
| `stepSurveyTitle` | Aday bitince kısa bir anket görsün mü? | Does the candidate get a short survey at the end? |
| `stepNameTitle` | Alımın adı ne olsun? | What is the opening called? |
| `reviewTitle` | Değişikliklere son bir bak | Take a last look at the changes |
| `deadlineNone` | Son gün yok | No last day |
| `deadlinePick` | Bir gün seç | Choose a day |
| `blindShow` | Görsün | They see it |
| `blindHide` | Gizle | Hide it |
| `surveyOn` | Evet, görsün | Yes, show it |
| `surveyOff` | Hayır | No |
| `emailLead` | İsteğe bağlı; boş bırakabilirsin. | Optional; you can leave it empty. |
| `feedbackQuick` | {days} gün | {days} days |
| `summaryMin` | Her adayı en az {count} kişi değerlendirir. | {count, plural, one {Each candidate is reviewed by at least one person.} other {Each candidate is reviewed by at least # people.}} |
| `backupLine` | Yedek: {name} | Backup: {name} |
| `noEmail` | İletişim e-postası yok | No contact e-mail |

Removed (no reader is left): `choose` (the old select's placeholder), `closeTitle` (the close card's heading; the action is a text action under the summary now). Generic words ("Devam et", "Özete dön", "Çık", "Kaydetmeden çık", "Değiştir", "değişti", "Değişiklik yok.") come from `flow`.

- [ ] **Step 6: Tests and gates**

Run: `pnpm exec vitest run src/components/hiring "src/app/(manager)/hiring" src/solutions/hiring/rules src/i18n && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -5`
Expected: PASS and clean; `opening-rules.test.ts` and `settings/actions.test.ts` pass unchanged (`git diff --stat src/solutions/hiring/rules "src/app/(manager)/hiring/openings/[id]/settings/actions.ts" "src/app/(manager)/hiring/openings/[id]/settings/result.ts"` is empty).

- [ ] **Step 7: Browser check**

`kademe_ui_check` with a draft and a published opening, Claude in Chrome, logged in through `/login`:
1. A draft's "Ekip ve kurallar": the setup line under the tabs, the summary card (Ekip, Aday iletişimi, Adil değerlendirme, Alım adı, each with "Değiştir ›"; the lock line), "Alımı kapat" with its sentence under it.
2. "Değiştir" on Ekip: the address ends in `#team-members`, "Kim değerlendirecek?" with person cards (a disabled person only while on the team, and only to take off), "‹ Özete dön", "Adım 1 / 4", "Devam et"; the exit reads "Kaydetmeden çık" once a card changes. "Kararı kim verecek?": cards of owners and managers, a saved decision maker who left marked and closed, "Yedek karar veren" behind its disclosure. "Her adayı kaç kişi değerlendirsin?": five square cards, the short-team line when the number is above the team. The summary step marks the changed rows "değişti"; "Kaydet" waits with "Değişiklik yok." when nothing changed. Save: back on the summary with "Kaydedildi." and the setup line's next step (no redirect).
3. Browser back and forward walk the steps and keep the values; a reload on `#team-min` opens that step; a link to `#team-review` while the decision maker is empty opens `#team-decider` (W3).
4. Aday iletişimi: "Son gün yok" / "Bir gün seç" with the date (a past day only refused when it is a change), the reply days with 3 / 7 / 14 quick choices, the optional e-mail; "Kaydet" with a bad e-mail: the e-mail step opens with "Geçerli bir e-posta yaz." (the client stops it first; to see the server's refusal path, disable a saved decision maker in another tab and save the contact flow: the team's decision-maker step opens with "Karar veren aktif bir sahip ya da yönetici olmalı.").
5. Adil değerlendirme: two cards each with the existing hint as the step's only text; the summary step ends with the lock line. Alımın adı: one step with "Kaydet"; a name another opening has comes back numbered with the existing "savedRenamed" sentence.
6. "Alımı kapat": closes at once (no dialog), the page comes back with the 8-second "Alım kapatıldı. Geri al" strip; "Geri al" reopens it. A closed opening: the read-only summary, the filled "Yeniden aç".
7. A reviewer on the team: the summary without any "Değiştir" and without "Alımı kapat"; `#team-members` in the address shows the summary too.
8. Focus on each step's title, 44px targets, keyboard through a whole flow; 1280 and 1024 screenshots.

- [ ] **Step 8: Commit**

```bash
git add src/components/hiring/rules-flows.ts src/components/hiring/rules-flows.test.ts src/components/hiring/opening-settings-form.tsx src/components/hiring/opening-settings-form.test.ts "src/app/(manager)/hiring/openings/[id]/settings/page.tsx" "src/app/(manager)/hiring/openings/[id]/settings/page.test.ts" src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Turn team and rules into a summary with four short flows

The tab is the opening's rules at a glance; each group changes in its
own guided flow (team, candidate contact, fair review and survey, the
name), steps in the hash, one decision each, a summary step marking what
changed with one 'Kaydet' (K12, D10). Every flow saves through the
unchanged action with the fields outside it as loaded; a refusal opens
the step it is about with its existing sentence. 'Alımı kapat' stays a
one-click action with its 8-second undo. settings page.test: the setup
line is mocked (its database throws by design).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 22: M8, the invite as a guided flow (person, summary, ready) in the Sheet and on `/hiring/invite`

**Files:**
- Modify: `src/components/hiring/invite/form-rules.ts:1-73` (`personWait` out of `inviteReason`; `InviteStep`, `INVITE_STEPS`, `invitePath`, `inviteFirstInvalid`, `inviteStepOf`, `deadlineRow`), `form-rules.test.ts:3` (import) and two new `describe`s at the end
- Modify (rewritten on `GuidedFlow`; `submit`, the list parsing and preview, the duplicate path and both ready views kept): `src/components/hiring/invite/invite-form.tsx:1-419`
- Modify: `src/components/hiring/invite/invite-sheet.tsx:41-44` (the opening's name under the title; `container="sheet"`)
- Modify: `src/app/(manager)/hiring/invite/page.tsx:38-55` (the flow draws its head; the no-openings card keeps `PageTitle`)
- Modify: `src/i18n/messages/hiring.tr.json`, `hiring.en.json` (`hiringInvite` new keys; `many`, `chooseOpening` removed)

**Shared with the exam:** none (Today's invite menu links to `/hiring/invite`; its own look changed in Task 17).

**Design and rulings:** 4.9, D11 (person, then a summary where the language and the last day already hold their defaults and open their own step with "Değiştir"; the opening is a step only on the page with more than one invitable opening), W1-W8 on the Task 15 shell, C19 (the page's head and the Sheet's description name the opening), KG3 (the short-team line's link opens the team flow, `…/settings#team-members`, as a plain anchor). In the Sheet the steps live in memory (the overview owns the hash, `#publish`); the Sheet's own close button is the exit and `sheetLocked` keeps it open while a request runs or a link is shown (unchanged). Server actions and codes unchanged: `inviteCandidateAction` (`src/app/(manager)/hiring/invite/actions.ts:94`), `inviteManyAction` (`:114`), `InviteOneResult` (`:16-18`: `InviteRefusal`, `invitations.ts:88-98`, plus `FORBIDDEN`, `FAILED`), the `allowDuplicate` path. `inviteReason`, `panelShortfall`, `sheetLocked`, `deadlineInputValue` keep their behaviour (`form-rules.test.ts` unchanged). The "bir daha gösterilmez" note, the pasted list's preview and row results, `lead`, `panelShort`, `onceNote*`, `err*`, `reason*` keep their words (`lead` becomes the person step's lead).

**Interfaces:**
- Consumes: `GuidedFlow`, `useFlowStep`, `FlowStep`, `flowJourney`, `stepOfProblem`, `SummaryRows` (Task 15); `ChoiceCardGroup`, `Disclosure`, `Illustration` (`inviteReady`), `StepScreen` (Tasks 3-4); `hiringCommon.teamShort` (Task 18), `hiringCommon.back`, `deadline`, `noDeadline`; `flow.*`.
- Produces:
  - `personWait(input: { mode: "single" | "many"; fullName: string; email: string; rows: InviteRow[] }): "name" | "email" | "noRows" | "rows" | null`
  - `type InviteStep = "opening" | "person" | "summary" | "language" | "deadline"`; `INVITE_STEPS: InviteStep[]`; `invitePath(input: { pickOpening: boolean }): InviteStep[]`; `inviteFirstInvalid(input: { opening; pickOpening; mode; fullName; email; rows }): InviteStep | null`; `inviteStepOf(code: Extract<InviteOneResult, { ok: false }>["code"]): InviteStep`
  - `deadlineRow(input: { opening: InviteOpening | null; deadline: string | null; today: string }): { kind: "pickOpening" } | { kind: "day"; day: string }`
  - `InviteForm` props gain `container?: "page" | "sheet"` (default `"page"`)

- [ ] **Step 1: Failing tests**

Append to `src/components/hiring/invite/form-rules.test.ts` and widen its import (`:3`) to `import { INVITE_STEPS, deadlineInputValue, deadlineRow, inviteFirstInvalid, inviteReason, inviteStepOf, invitePath, panelShortfall, personWait, sheetLocked, type InviteOpening } from "./form-rules";`:

```ts
describe("the invite as a guided flow (4.9, D11)", () => {
  const rows = parseInviteRows("Elif Kaya, elif@example.com\nCan, can@");
  it("walks the person and the summary, with the opening first only where more than one can be chosen", () => {
    expect(invitePath({ pickOpening: false })).toEqual(["person", "summary"]);
    expect(invitePath({ pickOpening: true })).toEqual(["opening", "person", "summary"]);
    expect(INVITE_STEPS).toEqual(["opening", "person", "summary", "language", "deadline"]);
  });

  it("never lets a link skip the opening or the person", () => {
    const person = { mode: "single" as const, fullName: "Elif Kaya", email: "elif@example.com", rows: [] };
    expect(inviteFirstInvalid({ ...person, opening: null, pickOpening: true })).toBe("opening");
    expect(inviteFirstInvalid({ ...person, opening, pickOpening: true, email: "elif@" })).toBe("person");
    expect(inviteFirstInvalid({ ...person, opening, pickOpening: false })).toBeNull();
    expect(inviteFirstInvalid({ ...person, opening, pickOpening: false, mode: "many", rows: rows.rows })).toBe("person");
  });

  it("waits on the person step for the person's own reason, in the existing words' keys", () => {
    expect(personWait({ mode: "single", fullName: "E", email: "elif@example.com", rows: [] })).toBe("name");
    expect(personWait({ mode: "single", fullName: "Elif Kaya", email: "elif", rows: [] })).toBe("email");
    expect(personWait({ mode: "many", fullName: "", email: "", rows: [] })).toBe("noRows");
    expect(personWait({ mode: "many", fullName: "", email: "", rows: rows.rows })).toBe("rows");
    expect(personWait({ mode: "single", fullName: "Elif Kaya", email: "elif@example.com", rows: [] })).toBeNull();
  });

  it("opens the step a refusal is about; the opening's own state, the role and a failure stay on the summary (W8)", () => {
    expect(inviteStepOf("NAME")).toBe("person");
    expect(inviteStepOf("EMAIL")).toBe("person");
    expect(inviteStepOf("DUPLICATE")).toBe("person");
    expect(inviteStepOf("DEADLINE_INVALID")).toBe("deadline");
    expect(inviteStepOf("DEADLINE_PAST")).toBe("deadline");
    expect(inviteStepOf("NOT_FOUND")).toBe("opening");
    for (const code of ["CLOSED", "NOT_PUBLISHED", "OPENING_DEADLINE_PASSED", "NO_EVALUATORS", "FORBIDDEN", "FAILED"] as const) expect(inviteStepOf(code)).toBe("summary");
  });
});

describe("the last-day row (4.9: never an empty value next to 'Değiştir')", () => {
  const withDay = { ...opening, deadlineDay: "2026-10-19" };
  it("asks for an opening first when none is chosen", () => {
    expect(deadlineRow({ opening: null, deadline: null, today: "2026-10-05" })).toEqual({ kind: "pickOpening" });
  });

  it("shows the day the server will use", () => {
    expect(deadlineRow({ opening: withDay, deadline: null, today: "2026-10-05" })).toEqual({ kind: "day", day: "2026-10-19" });
    expect(deadlineRow({ opening: withDay, deadline: "2026-10-10", today: "2026-10-05" })).toEqual({ kind: "day", day: "2026-10-10" });
  });
});
```

Run: `pnpm exec vitest run src/components/hiring/invite/form-rules.test.ts`
Expected: FAIL (the new exports are missing).

- [ ] **Step 2: The rules**

`src/components/hiring/invite/form-rules.ts` becomes:

```ts
import type { InviteOneResult } from "@/app/(manager)/hiring/invite/actions";
import { stepOfProblem } from "@/components/manager/flow-model";
import { cleanInviteName, isEmail, linkExpiryDay, type InviteRow } from "@/solutions/hiring/rules/invitation";

/**
 * An opening the invite form offers: OPEN, of the session's organisation
 * (invitableOpenings). `evaluators` counts the active panel the invitation
 * copies; `minEvaluations` is the decision minimum; `deadlineDay` is the
 * opening's last day in the organisation's zone.
 */
export type InviteOpening = { id: string; name: string; live: boolean; evaluators: number; minEvaluations: number; deadlineDay: string | null };
export type FormReason = "noOpening" | "notPublished" | "noEvaluators" | "openingDeadline" | "deadline" | "name" | "email" | "noRows" | "rows";

/**
 * HIRING-UX 5.11 "Erken doğrulama": the one reason the invite button waits,
 * the opening's first (published? a team? its own deadline still ahead?),
 * then the chosen day, then the person or the pasted list. The server checks
 * all of it again.
 */
export function inviteReason(input: {
  opening: InviteOpening | null;
  mode: "single" | "many";
  fullName: string;
  email: string;
  rows: InviteRow[];
  deadline: string | null;
  today: string;
}): FormReason | null {
  if (!input.opening) return "noOpening";
  if (!input.opening.live) return "notPublished";
  if (input.opening.evaluators === 0) return "noEvaluators";
  if (input.opening.deadlineDay && input.opening.deadlineDay < input.today) return "openingDeadline";
  if (input.deadline && input.deadline < input.today) return "deadline";
  return personWait(input);
}

/** The person step's own reason (4.9 W8): the name and e-mail, or the pasted list. */
export function personWait(input: { mode: "single" | "many"; fullName: string; email: string; rows: InviteRow[] }): "name" | "email" | "noRows" | "rows" | null {
  if (input.mode === "single") {
    // The server's rule (cleanInviteName), so the button never lets through a name it refuses.
    if (cleanInviteName(input.fullName) === null) return "name";
    if (!isEmail(input.email)) return "email";
    return null;
  }
  if (input.rows.length === 0) return "noRows";
  if (input.rows.some((r) => r.problem !== null)) return "rows";
  return null;
}

/**
 * HIRING-VISUAL-FLOW 4.9 (D11): the invite as a guided flow. The main path is
 * the person and the summary, with the opening first on the page when more
 * than one is invitable; the language and the last day open from the summary
 * ("Değiştir") with their defaults already in it.
 */
export type InviteStep = "opening" | "person" | "summary" | "language" | "deadline";
export const INVITE_STEPS: InviteStep[] = ["opening", "person", "summary", "language", "deadline"];
export const invitePath = (input: { pickOpening: boolean }): InviteStep[] => (input.pickOpening ? ["opening", "person", "summary"] : ["person", "summary"]);

/** W3: the first step that is not ready (the opening, then the person); a link past it opens it. */
export function inviteFirstInvalid(input: { opening: InviteOpening | null; pickOpening: boolean; mode: "single" | "many"; fullName: string; email: string; rows: InviteRow[] }): InviteStep | null {
  if (!input.opening && input.pickOpening) return "opening";
  return personWait(input) ? "person" : null;
}

type InviteCode = Extract<InviteOneResult, { ok: false }>["code"];
const REFUSAL_STEP: Partial<Record<InviteCode, InviteStep>> = {
  NAME: "person",
  EMAIL: "person",
  DUPLICATE: "person",
  DEADLINE_INVALID: "deadline",
  DEADLINE_PAST: "deadline",
  NOT_FOUND: "opening",
};

/**
 * W8: the step a refusal of inviteCandidateAction / inviteManyAction is about,
 * shown there with its existing sentence (hiringInvite.err*); the opening's
 * own state (closed, not published, its deadline, no evaluators), the role and
 * a failure stay on the summary. A Sheet has no opening step: the caller falls
 * back to the summary.
 */
export const inviteStepOf = (code: InviteCode): InviteStep => stepOfProblem(REFUSAL_STEP, code) ?? "summary";

/**
 * HIRING-VISUAL-FLOW 4.9: the "Son gün" row says the day the server will use
 * (linkExpiryDay), or, before an opening is chosen, that one must be chosen
 * first (the page used to show only "Değiştir" next to nothing).
 */
export function deadlineRow(input: { opening: InviteOpening | null; deadline: string | null; today: string }): { kind: "pickOpening" } | { kind: "day"; day: string } {
  if (!input.opening) return { kind: "pickOpening" };
  return { kind: "day", day: linkExpiryDay({ chosen: input.deadline, openingDeadlineDay: input.opening.deadlineDay, today: input.today }) };
}

/**
 * A live opening whose active panel is smaller than its decision minimum
 * (ledger, Task 11 carry): the invitation still opens (the candidate is told
 * "at least n" with n = min(minimum, assigned)), but the manager sees the
 * numbers so the team can be filled before decisions. An empty panel is not
 * a shortfall here: the button already waits for it.
 */
export function panelShortfall(opening: InviteOpening | null): { evaluators: number; min: number } | null {
  if (!opening || !opening.live || opening.evaluators === 0) return null;
  return opening.evaluators < opening.minEvaluations ? { evaluators: opening.evaluators, min: opening.minEvaluations } : null;
}

/**
 * The Sheet stays open while a request runs or links are shown: Escape and a
 * click outside would drop a link that is shown only once. Its close button
 * still closes it.
 */
export function sheetLocked(state: { pending: boolean; done: boolean }): boolean {
  return state.pending || state.done;
}

/**
 * The day the date field shows: the day the server will use (linkExpiryDay
 * holds a later day to the opening's deadline), except a past day, which
 * stays as typed so the reason next to the button speaks about what is seen.
 */
export function deadlineInputValue(input: { opening: InviteOpening | null; deadline: string | null; today: string }): string {
  if (!input.opening) return "";
  if (input.deadline !== null && input.deadline < input.today) return input.deadline;
  return linkExpiryDay({ chosen: input.deadline, openingDeadlineDay: input.opening.deadlineDay, today: input.today });
}
```

- [ ] **Step 3: The flow**

Replace `src/components/hiring/invite/invite-form.tsx` with:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { ClipboardPaste, UserRoundPlus } from "lucide-react";
import { flowJourney } from "@/components/manager/flow-model";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { SummaryRows } from "@/components/manager/summary-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusDot } from "@/components/ui/status-dot";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { Disclosure } from "@/components/visual/disclosure";
import { Illustration } from "@/components/visual/illustrations";
import { StepScreen } from "@/components/visual/step-screen";
import { useMT } from "@/i18n/manager-client";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { firstInviteLines, formatInviteDay, MAX_INVITE_ROWS, parseInviteRows } from "@/solutions/hiring/rules/invitation";
import { inviteCandidateAction, inviteManyAction, type InviteOneResult } from "@/app/(manager)/hiring/invite/actions";
import { CopyField } from "./copy-field";
import {
  INVITE_STEPS,
  deadlineInputValue,
  deadlineRow,
  inviteFirstInvalid,
  inviteReason,
  inviteStepOf,
  invitePath,
  panelShortfall,
  personWait,
  sheetLocked,
  type InviteOpening,
  type InviteStep,
} from "./form-rules";

type Ready = Extract<InviteOneResult, { ok: true }>;
type Refusal = Extract<InviteOneResult, { ok: false }>;
type Done =
  | { kind: "one"; result: Ready }
  | {
      kind: "many";
      ok: Array<{ line: number; fullName: string; email: string; result: Ready }>;
      failed: Array<{ line: number; fullName: string; result: Refusal }>;
    };

const LINK = "underline decoration-underline underline-offset-4";

/**
 * HIRING-UX 5.11 as HIRING-VISUAL-FLOW 4.9 (K12, D11): the invite as a guided
 * flow. The opening (on the page, when more than one is invitable), then the
 * person (one candidate or a pasted list), then a summary where the language
 * and the last day already hold their defaults and open their own step with
 * "Değiştir". The summary's "Linki oluştur" calls the same actions with the
 * same refusals; a refusal opens the step it is about (inviteStepOf). On
 * success the link is shown once with "Linki kopyala" as the filled button
 * and the ready message behind a disclosure; a pasted list keeps its own
 * ready view. Both end with "Adaylara git" (C13). In a Sheet the steps live in
 * memory (its page owns the hash) and `onLockChange` keeps the Sheet open
 * while a request runs or links are shown (sheetLocked).
 */
export function InviteForm({
  openings,
  initialOpeningId,
  today,
  zone,
  onDone,
  onLockChange,
  container = "page",
}: {
  openings: InviteOpening[];
  initialOpeningId: string | null;
  today: string;
  zone: string;
  onDone?: () => void;
  onLockChange?: (locked: boolean) => void;
  container?: "page" | "sheet";
}) {
  const t = useMT("hiringInvite");
  const common = useMT("hiringCommon");
  const flow = useMT("flow");
  const appLocale = useLocale();
  const uiLocale: Locale = isLocale(appLocale) ? appLocale : DEFAULT_LOCALE;
  const [openingId, setOpeningId] = useState<string>(
    initialOpeningId && openings.some((o) => o.id === initialOpeningId) ? initialOpeningId : openings.length === 1 ? openings[0].id : "",
  );
  const opening = openings.find((o) => o.id === openingId) ?? null;
  const [mode, setMode] = useState<"single" | "many">("single");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [locale, setLocale] = useState<Locale>("tr");
  const [deadline, setDeadline] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [fromSummary, setFromSummary] = useState(false);
  const [pending, start] = useTransition();
  const [refusal, setRefusal] = useState<{ result: Refusal; name: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const parsed = useMemo(() => parseInviteRows(text), [text]);
  const reason = inviteReason({ opening, mode, fullName, email, rows: parsed.rows, deadline, today });
  const short = panelShortfall(opening);
  // The day the server will use (linkExpiryDay): the chosen one held to the opening's deadline, else the deadline, else 14 days.
  const openingDeadline = opening?.deadlineDay && opening.deadlineDay >= today ? opening.deadlineDay : null;
  const day = deadlineRow({ opening, deadline, today });
  const doneHeading = useRef<HTMLHeadingElement>(null);

  // The opening is a step only on the page and only when there is a choice to make.
  const pickOpening = container === "page" && openings.length > 1;
  const path = invitePath({ pickOpening });
  const steps = pickOpening ? INVITE_STEPS : INVITE_STEPS.filter((s) => s !== "opening");
  const nav = useFlowStep({ steps, firstInvalid: inviteFirstInvalid({ opening, pickOpening, mode, fullName, email, rows: parsed.rows }), mode: container === "page" ? "hash" : "memory" });
  const step = nav.step;
  const dirty = fullName !== "" || email !== "" || text !== "" || deadline !== null || locale !== "tr";

  useEffect(() => {
    if (done) doneHeading.current?.focus();
  }, [done]);

  const locked = sheetLocked({ pending, done: done !== null });
  useEffect(() => {
    onLockChange?.(locked);
  }, [locked, onLockChange]);

  /** A change to what is being sent retires the last refusal: it spoke about the previous input. */
  function edit(change: () => void) {
    setRefusal(null);
    change();
  }

  function reset() {
    setDone(null);
    setRefusal(null);
    setFullName("");
    setEmail("");
    setText("");
    setFromSummary(false);
    // "Başka aday davet et" goes back to the person and keeps the opening and the language (4.9).
    nav.go("person");
  }

  /** W8: the step a refusal belongs to; the opening step exists only where it was offered. */
  const refusalStep = (code: Refusal["code"]): InviteStep => {
    const at = inviteStepOf(code);
    return at === "opening" && !pickOpening ? "summary" : at;
  };

  function submit(allowDuplicate = false) {
    setRefusal(null);
    const name = fullName;
    start(async () => {
      try {
        if (mode === "single") {
          const result = await inviteCandidateAction({ openingId, fullName, email: email.trim(), locale, deadline, allowDuplicate });
          if (result.ok) setDone({ kind: "one", result });
          else {
            setRefusal({ result, name });
            if (refusalStep(result.code) !== step) nav.go(refusalStep(result.code));
          }
          return;
        }
        // Only the rows that are read travel (the server cuts the same way).
        const { results } = await inviteManyAction({ openingId, text: firstInviteLines(text), locale, deadline });
        // Line 0 is a refusal of the whole list (role, opening, day) or malformed input.
        const whole = results.find((r) => r.line === 0);
        if (whole && !whole.result.ok) {
          setRefusal({ result: whole.result, name: "" });
          if (refusalStep(whole.result.code) !== step) nav.go(refusalStep(whole.result.code));
          return;
        }
        if (results.length === 0) {
          setRefusal({ result: { ok: false, code: "FAILED" }, name: "" });
          return;
        }
        setDone({
          kind: "many",
          ok: results.flatMap((r) => (r.result.ok ? [{ line: r.line, fullName: r.fullName, email: r.email, result: r.result }] : [])),
          failed: results.flatMap((r) => (r.result.ok ? [] : [{ line: r.line, fullName: r.fullName, result: r.result }])),
        });
      } catch {
        // A dropped connection or a server error: the calm message, never the raw one.
        setRefusal({ result: { ok: false, code: "FAILED" }, name: "" });
      }
    });
  }

  // C13: the way to the opening's Candidates tab after a link is shown; from a Sheet it also closes the Sheet.
  const toCandidates = openingId ? (
    <Link href={`/hiring/openings/${openingId}/candidates`} onClick={onDone} className={`inline-flex min-h-10 items-center text-[14px] font-medium text-ink ${LINK}`}>
      {t("toCandidates")}
    </Link>
  ) : null;
  const after = (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={reset} className={`min-h-10 text-[14px] font-medium text-ink ${LINK}`}>
        {t("another")}
      </button>
      {toCandidates}
      {onDone ? (
        <Button variant="ghost" onClick={onDone}>
          {t("close")}
        </Button>
      ) : null}
    </div>
  );

  if (done?.kind === "one") {
    const body = (
      <div className="space-y-5">
        <CopyField id="invite-link" label={t("linkLabel")} value={done.result.url} primary copyLabel={t("copyLink")} />
        <Disclosure label={t("showMessage")}>
          <CopyField id="invite-message" label={t("messageLabel")} value={done.result.message.body} multiline copyLabel={t("copyMessage")} />
        </Disclosure>
        <p className="text-[14px] text-ink-2">{t("onceNote")}</p>
        {after}
      </div>
    );
    // 4.9: the ready screen, one of the panel's two success moments with a small drawing.
    return container === "page" ? (
      <StepScreen layout="single" width={640} illustration="inviteReady" illustrationSize="spot" title={t("readyTitle")} titleRef={doneHeading} lead={<p className="tnum">{t("readyBody", { name: done.result.name, date: done.result.expires })}</p>}>
        {body}
      </StepScreen>
    ) : (
      <div className="space-y-5">
        <Illustration name="inviteReady" size="small" />
        <div>
          <h2 ref={doneHeading} tabIndex={-1} className="text-[18px] leading-7 font-semibold text-ink outline-none">
            {t("readyTitle")}
          </h2>
          <p className="tnum mt-1 text-[14px] text-muted">{t("readyBody", { name: done.result.name, date: done.result.expires })}</p>
        </div>
        {body}
      </div>
    );
  }

  if (done?.kind === "many") {
    const all = done.ok.map((r) => `${r.fullName}\t${r.email}\t${r.result.url}`).join("\n");
    const duplicates = done.failed.some((f) => f.result.code === "DUPLICATE");
    return (
      <div className="space-y-5">
        <div>
          <h2 ref={doneHeading} tabIndex={-1} className="tnum text-[16px] leading-6 font-semibold text-ink outline-none">
            {t("manyReady", { count: done.ok.length })}
          </h2>
          {done.failed.length ? <p className="tnum mt-1 text-[14px] text-ink">{t("manyFailed", { count: done.failed.length })}</p> : null}
        </div>
        {done.failed.length ? (
          <div className="space-y-1">
            <ul className="space-y-1 text-[13px] leading-5 text-ink">
              {done.failed.map((f) => (
                <li key={f.line}>
                  {f.result.code === "DUPLICATE"
                    ? t("rowDuplicateResult", { line: f.line, name: f.fullName, date: f.result.existing?.invitedAt ?? "" })
                    : t("rowErrorResult", { line: f.line, name: f.fullName, error: t(`err${f.result.code}`) })}
                </li>
              ))}
            </ul>
            {duplicates ? <p className="text-[13px] text-muted">{t("manyDuplicateNote")}</p> : null}
          </div>
        ) : null}
        {done.ok.length ? (
          <>
            <CopyField id="invite-all" label={t("allLinks")} value={all} multiline primary copyLabel={t("copyAll")} />
            <ul className="space-y-4">
              {done.ok.map((r) => (
                <li key={r.line} className="space-y-3 rounded-xl border border-line p-4">
                  <p className="text-[14px] text-ink">
                    <span className="font-medium">{r.fullName}</span> <span className="text-muted">{r.email}</span>
                  </p>
                  <CopyField id={`invite-link-${r.line}`} label={t("linkFor", { name: r.fullName })} value={r.result.url} copyLabel={t("copyLink")} />
                  <details className="group">
                    <summary className="min-h-10 cursor-pointer py-2 text-[13px] font-medium text-ink">{t("messageFor", { name: r.fullName })}</summary>
                    <CopyField id={`invite-message-${r.line}`} label={t("messageLabel")} value={r.result.message.body} multiline copyLabel={t("copyMessage")} />
                  </details>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-muted">{t("onceNoteMany")}</p>
          </>
        ) : null}
        {after}
      </div>
    );
  }

  // W8: a refusal in its existing words, on the step it is about ("Yine de davet et" for a duplicate).
  const refusalNote =
    refusal && refusalStep(refusal.result.code) === step ? (
      <div role="alert" className="space-y-2 text-[14px] text-ink">
        {refusal.result.code === "DUPLICATE" ? (
          <>
            <p className="font-medium">{t("duplicate", { name: refusal.name.replace(/\s+/g, " ").trim(), date: refusal.result.existing?.invitedAt ?? "" })}</p>
            <p className="text-muted">{t("duplicateHelp")}</p>
            <Button size="sm" onClick={() => submit(true)} id="invite-anyway">
              {t("inviteAnyway")}
            </Button>
          </>
        ) : (
          <p className="font-medium">{t(`err${refusal.result.code}`)}</p>
        )}
      </div>
    ) : null;
  // The opening's own blockers on the summary come with the way to fix them.
  const fixLink =
    reason === "notPublished" && opening ? (
      <Link href={`/hiring/openings/${opening.id}/assessment`} className={`text-[14px] font-medium text-ink ${LINK}`}>
        {t("goAssessment")}
      </Link>
    ) : (reason === "noEvaluators" || reason === "openingDeadline") && opening ? (
      <Link href={`/hiring/openings/${opening.id}/settings`} className={`text-[14px] font-medium text-ink ${LINK}`}>
        {t("goTeam")}
      </Link>
    ) : null;
  const toSummary = () => {
    setFromSummary(false);
    nav.go("summary");
  };
  const change = (to: InviteStep) => () => {
    setFromSummary(true);
    nav.go(to);
  };
  const personReason = personWait({ mode, fullName, email, rows: parsed.rows });
  const dayText = day.kind === "pickOpening" ? t("pickOpeningFirst") : t("deadlineValue", { date: formatInviteDay(day.day, uiLocale), zone });

  const screens: Record<InviteStep, FlowStep> = {
    opening: {
      id: "opening",
      title: t("stepOpeningTitle"),
      layout: "split",
      primary: { kind: "button", id: "invite-next", label: fromSummary ? flow("backToSummary") : flow("continue"), waitReason: opening ? null : t("reasonnoOpening"), onClick: () => (fromSummary ? toSummary() : nav.go("person")) },
      note: refusalNote,
      body: (
        <ChoiceCardGroup
          type="single"
          name="invite-opening"
          value={openingId ? [openingId] : []}
          onChange={([v]) => edit(() => setOpeningId(v ?? ""))}
          items={openings.map((o) => ({ value: o.id, label: o.name, description: o.deadlineDay ? common("deadline", { date: formatInviteDay(o.deadlineDay, uiLocale) }) : common("noDeadline") }))}
        />
      ),
    },
    person: {
      id: "person",
      title: t("stepPersonTitle"),
      lead: <p>{t("lead")}</p>,
      layout: "single",
      primary: { kind: "button", id: "invite-next", label: fromSummary ? flow("backToSummary") : flow("continue"), waitReason: personReason ? t(`reason${personReason}`) : null, onClick: toSummary },
      note: refusalNote,
      body: (
        <div className="space-y-field">
          <p id="invite-mode-label" className="sr-only">
            {t("modeLabel")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="invite-mode"
            labelledBy="invite-mode-label"
            columns={2}
            value={[mode]}
            onChange={([v]) => edit(() => setMode(v as "single" | "many"))}
            items={[
              { value: "single", label: t("single"), marker: UserRoundPlus },
              { value: "many", label: t("modeList"), marker: ClipboardPaste },
            ]}
          />
          {mode === "single" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="invite-name">{t("fullName")}</Label>
                <Input id="invite-name" autoComplete="off" maxLength={120} className="text-[16px]" value={fullName} onChange={(e) => edit(() => setFullName(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t("email")}</Label>
                <Input id="invite-email" type="email" autoComplete="off" maxLength={160} className="text-[16px]" value={email} onChange={(e) => edit(() => setEmail(e.target.value))} />
              </div>
            </>
          ) : (
            // The pasted list, its live problems and its preview: plan 2's code, unchanged.
            <div className="space-y-2">
              <Label htmlFor="invite-paste">{t("pasteLabel")}</Label>
              <Textarea id="invite-paste" rows={6} className="max-h-72 overflow-y-auto" value={text} onChange={(e) => edit(() => setText(e.target.value))} aria-describedby="invite-paste-hint invite-paste-rows" />
              <p id="invite-paste-hint" className="text-[13px] text-muted">
                {t("pasteHint", { max: MAX_INVITE_ROWS })}
              </p>
              <div id="invite-paste-rows" aria-live="polite" className="space-y-1">
                {parsed.rows.some((r) => r.problem) ? (
                  <ul className="space-y-1 text-[13px] text-ink">
                    {parsed.rows
                      .filter((r) => r.problem)
                      .map((r) => (
                        <li key={r.line} className="tnum">
                          <StatusDot tone="warn" className="text-ink">
                            {t(`row${r.problem!}`, { line: r.line })}
                          </StatusDot>
                        </li>
                      ))}
                  </ul>
                ) : null}
                {parsed.tooMany ? <p className="text-[13px] text-ink">{t("tooMany", { max: MAX_INVITE_ROWS })}</p> : null}
                {parsed.rows.length > 0 && !parsed.rows.some((r) => r.problem) ? <p className="tnum text-[13px] text-muted">{t("rowsReady", { count: parsed.rows.length })}</p> : null}
              </div>
              {parsed.rows.length > 0 ? (
                // What will be stored, row by row (fix round 2): outside the live region, so only the count and the problems are announced.
                <section aria-labelledby="invite-preview-title" className="space-y-2 pt-2">
                  <h3 id="invite-preview-title" className="text-[13px] font-medium text-ink">
                    {t("previewTitle")}
                  </h3>
                  <ul aria-labelledby="invite-preview-title" tabIndex={0} className="max-h-60 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                    {parsed.rows.map((r) => (
                      <li key={r.line} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-[13px] leading-5">
                        <span className="tnum w-14 shrink-0 text-muted">{t("previewLine", { line: r.line })}</span>
                        <span className={r.problem === "NAME" ? "text-muted italic" : "font-medium text-ink"}>{r.fullName || t("previewNoName")}</span>
                        <span className={r.problem === "EMAIL" ? "text-muted italic" : "text-muted"}>{r.email || t("previewNoEmail")}</span>
                        {r.problem ? (
                          <StatusDot tone="warn" className="text-ink">
                            {t(`preview${r.problem}`)}
                          </StatusDot>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      ),
    },
    summary: {
      id: "summary",
      title: t("summaryTitle"),
      layout: "split",
      primary: {
        kind: "button",
        id: "invite-create",
        label: mode === "single" ? t("create") : t("createMany", { count: parsed.rows.length }),
        busy: pending,
        busyLabel: t("creating"),
        waitReason: reason ? t(`reason${reason}`) : null,
        onClick: () => submit(false),
      },
      note: refusalNote ?? fixLink,
      body: (
        <div className="space-y-4">
          <SummaryRows
            rows={[
              ...(pickOpening && opening ? [{ id: "opening", label: t("opening"), value: opening.name, edit: { onClick: change("opening") } }] : []),
              mode === "single"
                ? { id: "person", label: t("personRow"), value: [fullName.trim(), email.trim()].filter(Boolean).join(" · "), edit: { onClick: change("person") } }
                : { id: "person", label: t("listRow"), value: t("rowsReady", { count: parsed.rows.length }), edit: { onClick: change("person") } },
              { id: "language", label: t("language"), value: <span lang={locale}>{t(locale)}</span>, edit: { onClick: change("language") } },
              { id: "deadline", label: t("deadline"), value: <span className="tnum">{dayText}</span>, edit: opening ? { onClick: change("deadline") } : null },
            ]}
            changeLabel={flow("change")}
            changedLabel={flow("changed")}
          />
          {short && opening ? (
            <p className="flex flex-wrap items-center gap-x-3 text-[14px] text-ink">
              <StatusDot tone="warn" className="text-ink">
                <span className="tnum">{common("teamShort", { evaluators: short.evaluators, min: short.min })}</span>
              </StatusDot>
              {/* KG3: straight to the team flow's first step (4.10); a plain anchor, so that page hears the hash. */}
              <a href={`/hiring/openings/${opening.id}/settings#team-members`} className={`text-[14px] font-medium text-ink ${LINK}`}>
                {t("goTeam")}
              </a>
            </p>
          ) : opening && opening.live && opening.evaluators > 0 ? (
            <p className="tnum text-[14px] text-muted">{t("evaluators", { count: opening.evaluators })}</p>
          ) : null}
        </div>
      ),
    },
    language: {
      id: "language",
      title: t("stepLanguageTitle"),
      layout: "split",
      primary: { kind: "button", id: "invite-next", label: flow("backToSummary"), onClick: toSummary },
      body: (
        <ChoiceCardGroup
          type="single"
          name="invite-language"
          columns={2}
          value={[locale]}
          onChange={([v]) => edit(() => setLocale(v as Locale))}
          items={(["tr", "en"] as const).map((l) => ({ value: l, label: <span lang={l}>{t(l)}</span> }))}
        />
      ),
    },
    deadline: {
      id: "deadline",
      title: t("stepDeadlineTitle"),
      lead: <p className="tnum">{dayText}</p>,
      layout: "single",
      primary: { kind: "button", id: "invite-next", label: flow("backToSummary"), waitReason: reason === "deadline" ? t("reasondeadline") : null, onClick: toSummary },
      note: refusalNote,
      body: opening ? (
        <div className="space-y-2">
          <Label htmlFor="invite-deadline">{t("deadline")}</Label>
          <Input
            id="invite-deadline"
            type="date"
            min={today}
            max={openingDeadline ?? undefined}
            value={deadlineInputValue({ opening, deadline, today })}
            onChange={(e) => edit(() => setDeadline(e.target.value || null))}
            className="tnum w-56 text-[16px]"
            aria-describedby={openingDeadline ? "invite-deadline-max" : undefined}
          />
          {openingDeadline ? (
            <p id="invite-deadline-max" className="text-[13px] text-muted">
              {t("deadlineMax", { date: formatInviteDay(openingDeadline, uiLocale) })}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[14px] text-muted">{t("pickOpeningFirst")}</p>
      ),
    },
  };

  const first = path[0];
  return (
    <GuidedFlow
      container={container}
      // C19: the page names the opening the link is for.
      kicker={opening ? `${t("title")} · ${opening.name}` : t("title")}
      step={screens[step]}
      journey={flowJourney(path, step, "summary")}
      back={
        step === first
          ? container === "page"
            ? { label: common("back"), href: "/hiring/openings" }
            : null
          : step === "language" || step === "deadline"
            ? { label: flow("backToSummary"), onClick: toSummary }
            : { label: flow("back"), onClick: () => nav.back(path[Math.max(0, path.indexOf(step) - 1)]) }
      }
      exit={container === "page" ? { dirty, href: "/hiring/openings" } : null}
      enter={nav.moved}
    />
  );
}
```

- [ ] **Step 4: The Sheet and the page**

`invite-sheet.tsx` (`:41-44`): the description and the form's wrapper become

```tsx
          {/* C19: the Sheet names the opening the link is for; the once-only note moved to the person step's lead. */}
          <SheetDescription className="text-[13px] leading-5 text-muted">{opening.name}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col px-6">
          <InviteForm key={open ? "open" : "closed"} container="sheet" openings={[opening]} initialOpeningId={opening.id} today={today} zone={zone} onDone={() => change(false)} onLockChange={setLocked} />
```

(the sticky footer sits at the bottom of the Sheet's scroll area, `SheetContent` already scrolls).

`src/app/(manager)/hiring/invite/page.tsx` becomes:

```tsx
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/manager/page-title";
import { InviteForm } from "@/components/hiring/invite/invite-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { one } from "@/lib/url-notice";
import { requireUser } from "@/server/session";
import { invitableOpenings } from "@/solutions/hiring/server/invitations";

export const dynamic = "force-dynamic";

/**
 * HIRING-UX 5.11 as a page (`?opening=` preselects); the opening pages open
 * the same form in a Sheet. A reviewer reads why there is no form; the
 * actions refuse them too.
 */
export default async function HiringInvitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  if (!can(user, "opening:write")) {
    return (
      <main className="mx-auto max-w-[720px] px-page py-8">
        <PageTitle title={t("hiringInvite.title")} />
        <Card className="mt-section space-y-2 p-card">
          <p className="text-[14px] text-ink">{t("hiringInvite.noPermission")}</p>
          <Link href="/hiring/openings" className="text-[14px] font-medium text-ink underline decoration-underline underline-offset-4">
            {t("hiringInvite.goOpenings")}
          </Link>
        </Card>
      </main>
    );
  }
  const openings = await invitableOpenings(user.orgId);
  if (openings.length === 0) {
    return (
      <main className="mx-auto max-w-[720px] px-page py-8">
        <PageTitle title={t("hiringInvite.title")} />
        <Card className="mt-section space-y-2 p-card">
          <p className="text-[14px] text-ink">{t("hiringInvite.noOpenings")}</p>
          <Link href="/hiring/openings" className="text-[14px] font-medium text-ink underline decoration-underline underline-offset-4">
            {t("hiringInvite.goOpenings")}
          </Link>
        </Card>
      </main>
    );
  }
  // 4.9: the guided flow draws its own head ("Aday davet et · <alım>", "Çık") and its steps.
  return (
    <main className="mx-auto max-w-[1080px] px-page pt-6">
      <InviteForm container="page" openings={openings} initialOpeningId={one(sp.opening) ?? null} today={orgDay()} zone={zoneLabel(locale)} />
    </main>
  );
}
```

- [ ] **Step 5: Copy (`hiringInvite`, new keys)**

| Key | TR | EN |
|---|---|---|
| `modeList` | Liste yapıştır | Paste a list |
| `pickOpeningFirst` | Önce alım seç | Choose an opening first |
| `showMessage` | Hazır mesajı gör | See the ready message |
| `stepOpeningTitle` | Hangi alım için? | Which opening is it for? |
| `stepPersonTitle` | Kimi davet ediyorsun? | Who are you inviting? |
| `stepLanguageTitle` | Aday hangi dilde görsün? | Which language does the candidate see? |
| `stepDeadlineTitle` | Link ne zamana kadar açık kalsın? | Until when does the link stay open? |
| `summaryTitle` | Her şey doğru mu? | Is everything right? |
| `personRow` | Kişi | Person |
| `listRow` | Liste | List |

Removed (no reader is left): `many` (the old radio's second label; the card says `modeList`), `chooseOpening` (the old select's placeholder). `modeLabel` now names the mode cards for a screen reader; `readyTitle` and `readyBody` stay the ready screen's heading and line.

- [ ] **Step 6: Tests and gates**

Run: `pnpm exec vitest run src/components/hiring/invite "src/app/(manager)/hiring/invite" src/i18n && pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -5`
Expected: PASS (`form-rules.test.ts` +6 tests, the old ones unchanged; `actions.test.ts` unchanged), clean. `git diff --stat "src/app/(manager)/hiring/invite/actions.ts" src/solutions/hiring/server/invitations.ts` shows no change in this task.

- [ ] **Step 7: Browser check (and the 30 seconds / 3 clicks measure)**

`kademe_ui_check` with a published opening (`DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_ui_check pnpm dev:hiring-link`), Claude in Chrome, logged in through `/login`:
1. Overview, "Aday davet et": the Sheet shows the title and the opening's name, "Kimi davet ediyorsun?" with the once-only lead, two mode cards, name and e-mail; the sticky footer with "Adım 1 / 2" and "Devam et" grey with "Adayın adını ve soyadını yaz." beside it until filled.
2. "Devam et": "Her şey doğru mu?" with Kişi, Dil (Türkçe), Son gün (the opening's day or 14 days, with the zone) and a "Değiştir ›" on each; the short-team line with "Ekip ve kurallara git" only when the team is short (it opens the team flow at `#team-members`). "Değiştir" on Dil: two cards and "Özete dön"; on Son gün: the date field (the opening's last day as its maximum) and "Özete dön"; "‹ Geri" from the summary returns to the person with the values kept.
3. "Davet linkini oluştur": the drawing, "Davet linki hazır", "<ad> için link oluşturuldu. Son gün …", the link with the filled "Linki kopyala", "Hazır mesajı gör" closed (opens the message and its copy button), the once-only note, "Başka aday davet et" (back to the person, opening and language kept) and "Adaylara git". Escape does not close the Sheet while the link shows.
4. Measure from the overview: open, type name and e-mail, "Devam et", "Davet linkini oluştur", "Linki kopyala"; write the seconds and the clicks (target about 30 s and 3 clicks, design 4.9; the number is the automation's, not a person's).
5. A duplicate: invite the same e-mail again: the person step opens with the existing duplicate sentence and "Yine de davet et".
6. `/hiring/invite` with two invitable openings (mint a second one): "Aday davet et" with "Çık" on the right, "Hangi alım için?" with a card per opening and its last day, then the person, the summary; the head reads "Aday davet et · <alım>" once one is chosen (C19); the address carries `#person`, `#summary`; browser back steps back.
7. "Liste yapıştır" with 3 rows, one broken: the problems and the preview as before, "Devam et" grey with "Önce listedeki işaretli satırları düzelt."; fixed: the summary says "3 aday davete hazır." and the button "3 adayı davet et".
8. 1280 and 1024 screenshots of the Sheet and the page; focus on each step's title.

- [ ] **Step 8: Commit**

```bash
git add src/components/hiring/invite/form-rules.ts src/components/hiring/invite/form-rules.test.ts src/components/hiring/invite/invite-form.tsx src/components/hiring/invite/invite-sheet.tsx "src/app/(manager)/hiring/invite/page.tsx" src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Guide the invite through the person and a summary

The invite is a guided flow (K12, D11): the opening where there is a
choice, the person or the pasted list, then a summary where the language
and the last day hold their defaults and open their own step. The
summary's 'Davet linkini oluştur' calls the unchanged actions; a refusal
opens the step it is about with its existing sentence. Ready: a small
drawing, the link with the one filled copy button, the message behind a
disclosure, the once-only note. The Sheet and the page name the opening
(C19); the Sheet keeps its lock.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

---

### Task 23: Close plan 2b: acceptance list, the doc sweep, STATUS, every gate, leak and accessibility scans

**Files:**
- Modify: `docs/design/HIRING-UX.md` (section 11 gains the design's acceptance items, HIRING-VISUAL-FLOW 8; the doc-sweep lines of Step 2)
- Modify: `docs/design/HIRING-VISUAL-FLOW.md` (Step 2's sweep, only where a line is still stale)
- Modify: `docs/STATUS.md` ("Doğrulananlar", "Hâlâ doğrulanmadı", "Kararlar ve sapmalar", "Bilinen küçük pürüzler")

**Shared with the exam:** none (docs); the gates run the exam's scripts.

**Interfaces:** none (no code).

- [ ] **Step 1: The acceptance list**

Append to `docs/design/HIRING-UX.md` section 11 the 22 items of HIRING-VISUAL-FLOW section 8 (version 4), word for word, under a line "Görsel akış ve rehberli panel (plan 2b, HIRING-VISUAL-FLOW 8):". Count them after pasting (`grep -c` on the pasted block): 22.

- [ ] **Step 2: The doc sweep (carries named in the ledger)**

Read each line first; change it only if it still says the old thing, and list in the commit body what was changed and what was already right:
- `docs/design/HIRING-VISUAL-FLOW.md` 2.2: the drawings' path is `src/components/visual/illustrations.tsx` and the sizes are the ones Task 3 built (hero 400, spot 160, phone 342, small 96) (Task 3 carry; v4 fixed the path, check the sizes).
- `docs/design/HIRING-UX.md:58`: the persona's "akşam telefonundan açabilir" becomes a computer (K2) (Task 3 carry).
- `docs/design/HIRING-UX.md` 8.7: "once a minute" against the ring's 30 s / 10 s milestones (Task 4 carry): the ring's rule (`ringMilestone`, `src/components/visual/ring.ts`) is what is built.
- `docs/design/HIRING-UX.md:715` ("Mobil görünüm" in the manager preview) and `:1109` ("Mobilde doğrudan dosya seçici/kamera"): stale under K2 (Task 2 carry); say "1024 genişlik" and "bilgisayarda dosya seçici" or mark them as superseded by HIRING-VISUAL-FLOW 3.0 and 4.7.
- `docs/design/HIRING-VISUAL-FLOW.md` section 5: the panel parts live in `src/components/manager/` (boundary.test.ts, see Part 2's placement rule), the pure flow model is `flow-model.ts`.

- [ ] **Step 3: Every gate, with numbers**

```bash
pnpm exec tsc --noEmit && echo TSC-OK
pnpm exec eslint src scripts && echo ESLINT-OK
pnpm test 2>&1 | tail -6
pnpm build 2>&1 | tail -20
```

With the dev server on 3100 over `kademe_platform` (check `pg_stat_activity` first; another session may hold it):

```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam 2>&1 | tail -3
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard 2>&1 | tail -3
```

On fresh check databases, every command with its explicit `DATABASE_URL` (ruling C13):

```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_flow_check" -c "create database kademe_flow_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm verify:hiring-flow 2>&1 | tail -5
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm verify:hiring-setup 2>&1 | tail -5
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm verify:hiring-immutability 2>&1 | tail -5
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_flow_check"
```

Expected: TSC-OK, ESLINT-OK, tests all passing (write the count and the file count), the same route count as before plan 2b (no route was added: the flows live in hashes, D13), every verify line `ok` and 0 FAIL. `kademe_platform` row counts before and after the two exam scripts are equal (`verify:guard` deletes its own audit and outbox rows since the plan 2 final wave): compare `select count(*)` of `audit_logs`, `message_outbox`, `assessments` before and after. A worktree without `.env` builds with the dummy `DATABASE_URL` of the ledger's ruling (nothing is contacted).

- [ ] **Step 4: Em-dash and banned words**

```bash
git diff --name-only --diff-filter=d 53acc8f HEAD | xargs grep -n $'\xe2\x80\x94'; echo "dash exit $?"
pnpm exec vitest run src/i18n 2>&1 | tail -4
```

Expected: `dash exit 1` (no match); the copy tests (banned words, "sen" on the shared panel namespaces including `flow` and `today`, em-dash in dictionaries, TR/EN parity) pass.

- [ ] **Step 5: Page-level leak scan (C10) on the new screens**

On `kademe_ui_check` with `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_ui_check pnpm dev:hiring-link --sentinels` and the dev server on 3100, for the landing (both steps: the consent step's text is in the same document), `/check`, a stage, `/done` and the phone screen (`curl -A "<iPhone UA>" "$URL"` with the printed URL): fetch the document and the RSC payload (`curl -H "RSC: 1"`), count `TEAMSECRET` (must be 0) and `LEAKVISIBLE` (at least 1 where the screen shows version text; the phone screen and `/check` show none by design: there the positive control is the landing's count on the same link, and the same sentinel link with a desktop UA). Panel (H9): logged in through `/login` as a reviewer on the opening, save `/hiring/openings` and the overview's text with `get_page_text`: no request count, no team line, no setup step, every row's action "Aç". Write both tables into STATUS.

- [ ] **Step 6: Accessibility scan and the final walk (Claude in Chrome)**

Inject axe-core from cdnjs (as plan 2 Task 21 did) on: Welcome, Consent, `/info`, `/check` (each sub-step reachable in the tab), warm-up, stage intro, written, choice, video (think), file, done with survey, done without survey, expired card, closed card, second-tab screen; panel `/dashboard` (owner and reviewer), `/hiring/openings` (owner and reviewer, closed group open), `/hiring/openings/new` (each step), an overview (draft with its setup path, `#publish`, published with the rules card), team and rules (the summary and one step of each flow, its summary step), the invite Sheet (person, summary, ready) and page (opening step). Expected: 0 serious or critical; record the moderate ones. Walk the acceptance list of Step 1 at 1440, 1280 and 1024, keyboard only for one full candidate run and for one full team flow, and write each item as seen or "doğrulanmadı" with the reason. Phones, tablets, a keyboard tablet, a real camera and microphone, Safari's interrupted sound context and the TikTok and Snapchat in-app browsers stay "doğrulanmadı, gerçek cihazda kullanıcıyla" unless the user ran them.

- [ ] **Step 7: STATUS**

In `docs/STATUS.md`:
- "Doğrulananlar": a row "İşe alım plan 2b, görsel akış ve rehberli panel (yerel, <date>)" with the numbers from Steps 3-6, the screenshots' folder, Task 18's D14 timings and what was not verified.
- "Kararlar ve sapmalar": K9, K10 (with ruling C6 and the user's 2026-10-05 answer), K11, K12 with their dates; design v4's H1-H9 and D10-D15 in one line each; this plan's decisions 1-15 in one line each, with decision 11 marked "replaced by H8 (groups on one page, `?tab=` kept)" and the old Task 18 card grid marked "replaced by control rows (KG1)"; Part 2's placement rules (panel parts in `src/components/manager/` because `boundary.test.ts` keeps hiring out of `src/components/panel/`; hash links as plain anchors); "HIRING-UX 6.15, 8.6, 6 Ortak kurallar ve RULES 1, 9 yerine geçti (Tasks 2, 3); HIRING-UX 5.3, 5.11 and 5.18's form layouts replaced as interaction by HIRING-VISUAL-FLOW 4.6, 4.9, 4.10 (Tasks 19, 21, 22)".
- "Hâlâ doğrulanmadı": the real-device rows above; "the exam's core LinkProblem still shows 'Talebin iletildi' when the new-link request fails (LinkProblem.tsx:49-57): hiring has its honest card (plan 2b decision 8); changing the live exam is a separate user decision"; "menu counts (P1) wait for plan 3"; "data-rights requests: counted on Today, the control view and the overview with a plain note; their handling place and their top rank on Today come with plan 3 (ruling C6)"; "Task 13 residual 'retry-replaced pending draft' was fixed as interpreted in plan 2b decision 15"; "Android tablet in desktop-site mode with a mouse passes the gate (Task 1 carry, design limit)"; the six open user questions of HIRING-VISUAL-FLOW section 7 and the delta's section 3 (cockpit placement, full-screen flows, four rules flows or one, invite step count, the exam's forms as flows, what reviewers see).
- "Bilinen küçük pürüzler": item 23's pale button is closed by Task 10 (with the Step 1 reproduction's finding written next to it); every deferred minor of the ledger's Tasks 6-22 that is still open, one line each.

- [ ] **Step 8: Commit**

```bash
git add docs/design/HIRING-UX.md docs/design/HIRING-VISUAL-FLOW.md docs/STATUS.md
git commit -m "Record plan 2b: acceptance list, doc sweep and verified results

HIRING-UX 11 gains the visual-flow and guided-panel acceptance items. The
doc sweep fixes the lines the ledger named as stale. STATUS records the
gates, the verify scripts, the leak and accessibility scans, the user
decisions K9-K12, design v4's H1-H9 and D10-D15, the plan's decisions,
and what still needs a real device or a user decision.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDtAyXSrWFU6rGP5PKRh5i"
```

If Step 2 changed nothing in `HIRING-VISUAL-FLOW.md`, leave that path out of `git add` and say so in the commit body.

---

## Out of scope for plan 2b, and where it goes

| Item | Where |
|---|---|
| M6 assessment workspace (one level of tabs, Kurucu and Puan kartı as a segmented choice, AI draft and preview as actions, `LanguageTabs`, "1024" preview instead of "Mobil görünüm"; the weights as one decision step and the anchors flow in the scorecard Sheet, design 4.7) | Next plan, in parallel with plan 3 or right after (HIRING-VISUAL-FLOW 6.1); it does not collide with plan 3's screens |
| M9 library (position and competency flows, their control views, the anchor flow, `AnchorLadder`, the scale as one step, empty states) and the Library copy in "sen" (K9) | Same as M6 |
| M10 settings (summary with one-step edits, section navigation), the user invite flow (`inviteUser`, `src/app/(manager)/settings/actions.ts:176`), login and setup layout, and their copy in "sen" (K9) | Same as M6; M10 touches shared screens (login): before/after screenshots and outside the exam window |
| P3-a Candidates tab, P3-b candidate detail and decision rail, P3-c review and scoring, P3-d compare (design 4.8, "Tekrar iste" as a W flow) | Plan 3 (K5), with HIRING-VISUAL-FLOW 4.8 as its input |
| Data-rights requests as Today's top task with a place to handle them (ruling C6, the user's answer) | Plan 3 (the `DATA_RIGHTS` rank is reserved in `RANK`) |
| E1 exam list empty states and heads; the exam's forms as flows (D15, design open question 8) | Last, optional, outside the exam window, with before/after screenshots and `verify:exam`; the forms only on a user decision |
| Menu counts (P1 "Bugün 6") | Plan 3, with a count query (plan decision 6) |
| "Awaiting decision" next tasks (K10 rank 3) | Plan 3 (the `DECISION` task kind is reserved in Task 16) |
| "Linki e-postama gönder" on the phone screen | When real mail sending exists (K11, design open question 1) |
| The exam's link-request card telling the truth on a failed request | A separate user decision for the live exam (plan decision 8) |
| "Telefondan açtı, bilgisayara geçmedi" hint on the Candidates tab | Plan 3 (design 3.0, not designed yet) |
| `DirtyBar` | Not built (H4); a long editor that needs it later adds it locally |
| A flow's state kept across a reload of its values (sessionStorage) | Not built (H6); local to `GuidedFlow` if the user asks |

## Self-review (done while writing; the executor re-checks the first two after each task)

1. **Spec coverage.** VG: Tasks 1-2 (rules table of 3.0 in `classifyDevice`, server and client halves, phone screen with copy-link only, narrow strip, < 640 hold, `faqPhoneA`, `needDevice`, 6.15 text). V1: Task 3 (tokens, 15 drawings, 8.6, 6 Ortak kurallar, RULES 1 and 9). V2: Task 4 (every component of section 5's candidate table; `FunnelTiles` is drawn in place in Task 20 because the overview's tests read its words; `MediaStage` takes `question`/`preview` instead of a `state` prop because the caller already knows its phase); the `ActionBar` migration happens screen by screen in Tasks 5-12 and ends in Task 13 (a test proves no `ActionBar` is left). V3: Tasks 5-6 (Welcome, Consent, `whoShort`, `/info`). V4: Tasks 7-8. V5: Task 9. V6: Tasks 10-11. V7: Tasks 12-13. Design v4's manager part (6, "Plan 2b'nin yönetici kısmı"): M1 Tasks 14-15 (`ManagerNav` icons, `PanelHeader`, `RowMenu`, `EmptyState`, status dictionary), M-W Task 15 (`GuidedFlow`, `FlowHeader`, `SummaryRows`, the pure `flow-model.ts`, the `flow` words), M2 Tasks 16-17 (lanes, K10 with C6, the link to the control view, the draft row's "Kuruluma devam et"), M3 Task 18 (`ControlRow`, groups, `openingNextStep`, reviewer counts only, `?tab=`, D14), M4 Task 19, M5 Task 20 (setup path, publish summary, rules card, `⋯`, the setup line on a draft's pages), M7 Task 21 (summary, four flows, close with undo), M8 Task 22 (person, summary, ready; Sheet and page). `SetupPath` of design 5 is `PathSteps` with `setupProgress`/`setupNext` (Task 18) and its strip variant is `OpeningHeader`'s `setup` line (Task 20), not a separate component; `FunnelTiles` is drawn in place (Task 20). Acceptance (section 8, 22 items): Task 23. Carries: phone copy (Task 2), InfoForm (Task 6), Task 12 polish list (Tasks 7-8), Task 14 (Task 9), Task 15 N1 (Task 11), Task 18 expired-on-closed (Task 13) and visual-only notices (Task 20), pale primary (Tasks 4 and 10), Task 13 residuals (Task 10), LinkProblem honest failure for hiring and the exam marked (Task 13, Task 23), `expiredBody` and NOT_YET wording (Task 13), the doc-sweep carries of Tasks 2, 3 and 4 (Task 23 Step 2).
2. **Placeholders.** None: every code step carries its code (full files for new and rewritten files, exact edits with their anchors for the rest); every commit message ends with the two attribution lines in full.
3. **Type consistency.** `FooterAction` (Task 4) is used with the same fields in Tasks 5-22; `StepFooter`'s `note` and `placement` exist from Task 4; `useJourney` (Task 5) returns `{ steps, current, label }`, the shape `StepFooter.journey` takes, and `GuidedFlow` builds the same shape from `flowJourney`'s `{ steps, current }` and `flow.stepLabel`; `GuidedFlow`, `useFlowStep`, `FlowStep`, `FlowExit` (Task 15) are what Tasks 19, 21 and 22 call, `SummaryRows` what Tasks 20, 21 and 22 draw; `setupRowsOf`, `setupProgress`, `setupNext`, `setupSkips`, `teamHref`, `SETUP_LABEL` (Task 18) are what Task 20's overview and `setupStrip` and Task 21's page (through `setupStrip`) use; `openingNextStep` and `OpeningCardFacts` (Task 18) are what Task 20's overview reads (`requests` present only for someone who runs openings); `EXPIRING_SOON_MS` (Task 16) is the one window Tasks 16 and 18 use; `TodayItem.lane`, `task`, `detail`, `attention`, `actionLabel` (Task 16) are what Task 17 reads; `hiringCommon.openRequests`, `rightsNote`, `expiringLinks`, `draftWaitingPublish`, `continueSetup` (Task 16), `teamShort` (Task 18) and `rules*` (Task 20) are the one wording Today, the control view, the overview, team and rules and the invite summary share; `DesktopOnlyScreen` props stay `{ token, minutes, deadlineDay, contactEmail, stageRunning }` from Task 2's fix round on; `HiringLinkProblem` keeps a `problem` prop, which `verify:hiring-flow` reads (`"problem":"EXPIRED"`).
