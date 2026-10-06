# Manager Panel Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-built hiring manager panel look like the user-approved mockup `docs/design/hiring-manager-mockup.html` (screens 1, 2, 3, 4, 5, 6, 7, 8; not 4b), with soft icon tiles, big choice cards and one filled button per screen, while every flow, server action and problem code stays as it is.

**Architecture:** The look is added as opt-in variants on the shared visual blocks (`ChoiceCardGroup look`, `PathSteps look`, `StepScreen illustrationSize="flow"`, `EmptyState variant`) whose default markup is frozen by before/after render tests, plus two small new parts (`IconTile`, `positionIcon`). Each manager screen then switches to those variants. Flow logic (hash steps, waits, refusal-to-step maps, the server actions and their inputs) is not touched; where a screen's state shape changes (the position step's cards replace the combobox), the same `createOpeningAction` input comes out.

**Tech Stack:** Next.js 16.3.4 (App Router, server components), React 19.2.8, Tailwind CSS 4 tokens in `src/app/globals.css`, lucide-react 1.42.0, next-intl 4 (`useMT`, `managerT`), vitest 5 render tests with `renderToStaticMarkup`.

**Spec:** `docs/design/hiring-manager-mockup.html` (the authority for the LOOK) and `docs/design/HIRING-VISUAL-FLOW.md` section 4 (v4: rules P, W1-W10, KG1-KG5; the authority for BEHAVIOUR). Where they conflict, the mockup wins on look and v4 wins on behaviour.

## Global Constraints

- Read `AGENTS.md`: this Next.js differs from training data. This plan uses no new Next API (only `next/link` as the files already do). If a task needs any other Next API, read the guide under `node_modules/next/dist/docs/` first.
- Server actions, their inputs and their problem codes do not change: `createOpeningAction`, `publishOpeningAction`, `markPreviewedAction`, `saveOpeningRulesAction`, `closeOpeningAction`, `reopenOpeningAction`, `inviteCandidateAction`, `inviteManyAction`.
- The live language exam's screens (`/exam/**`) and the exam's rows on `/dashboard` (review queue, running list, expiring links with "7 gün uzat") keep their behaviour and markup; `src/app/(manager)/dashboard/page.test.ts` "what the live exam sees on Today" must pass unchanged.
- A shared block that the candidate side or the exam also draws (`ChoiceCardGroup`, `PathSteps`, `StepScreen`, `EmptyState`) only gains opt-in props; its default markup is frozen with `frozenMarkup` (Task 1) captured at the commit before the change.
- Look rules from the mockup: one filled button per screen; icon tiles are 40px rounded soft tiles (`bg-accent-soft`, accent icon; 52px on the big start cards); choice cards are large with the radio or checkbox mark at the right; selected = accent border + `bg-accent-soft` + 3px soft ring. Tokens only from `src/app/globals.css` (`accent` #0e6a57, `accent-soft` #f1f7f5, `line`, `hairline`, `line-mute`, `line-strong`, `underline`, `secondary`, `row-line`, `paper`, `ink-2`, `muted`, `shadow-panel-soft`).
- No amber: `globals.css` says "There is NO amber in this product". The mockup's warm tile (clock) and warm attention pills are drawn neutral (`bg-secondary`, ink) in this plan.
- Less AI (user, 2026-10-06): no `Sparkles` icon, no "Önerilen" / "Recommended" badge or word on the job-ad start; its label is "İlan metninden öneri al" / "Suggest from the job ad" with the plain `FileText` icon. Its server value stays `"AI"`.
- The ready-template start ("Hazır şablondan başla") and screen 4b are OUT of scope and must not appear (no dead options). The start choices come from one data list so a fourth card can be added later.
- Copy: Turkish and English through `src/i18n/messages/*.json` (both files get every new key; `src/i18n/messages.test.ts` checks key parity); hiring panel copy in "sen" form (`src/i18n/panel-copy.test.ts`). Code, comments and commit messages in English. Never the em-dash character.
- Lucide names used here exist in lucide-react 1.42.0 (checked): `Briefcase, Calculator, Calendar, ChartLine, Check, ChevronRight, ClipboardList, Code, Copy, FilePenLine, FilePlus, FileText, Handshake, Headset, Languages, PenTool, PhoneCall, Plus, Store, Truck, UserPlus, ArrowRight`. They render the class `lucide-<kebab-name>` (for example `lucide-file-text`), which the tests read.
- Gates per task: `pnpm exec tsc --noEmit`, `pnpm exec eslint src scripts`, the task's tests (`pnpm exec vitest run <files>`). Final task: full `pnpm test` and `pnpm build`.
- Browser checks only with Claude in Chrome (`mcp__claude-in-chrome__*`), never Playwright.
- Commits: English message, exact-path `git add`, end the message with the attribution lines of the session that runs the task. Branch `platform/solutions`; never main.

---

## File Structure

Created:
- `src/components/visual/frozen-markup.ts`: test helper; writes a block's default markup once (`CAPTURE_MARKUP=1`) and returns it for comparison.
- `src/components/visual/icon-tile.tsx`: `IconTile`, the 40px / 52px soft icon square.
- `src/components/hiring/position-icon.ts`: `positionIcon(name)`, a lucide icon for a position name.
- `src/components/hiring/start-choices.ts`: `startChoices()`, the ordered data list of "Nasıl başlayalım?" cards.
- `src/components/hiring/invite/invite-ready.tsx`: `InviteReady`, the invite's ready view (mockup 7).
- Tests: `src/components/visual/choice-card.test.ts`, `src/components/visual/step-screen.test.ts`, `src/components/visual/path-steps.test.ts`, `src/components/hiring/position-icon.test.ts`, `src/components/hiring/start-choices.test.ts`, `src/components/hiring/invite/invite-ready.test.ts`.
- Frozen markup (written by the capture runs): `src/components/visual/choice-card.default-markup.json`, `src/components/visual/step-screen.default-markup.json`, `src/components/visual/path-steps.default-markup.json`, `src/components/manager/empty-state.default-markup.json`.

Modified:
- `src/components/visual/choice-card.tsx`: `look` prop (`"default" | "panel" | "panel-lg"`), `ChoiceItem.tone: "new"`.
- `src/components/visual/illustrations.tsx`: size `flow`.
- `src/components/visual/step-screen.tsx`: `illustrationSize="flow"`.
- `src/components/visual/path-steps.tsx`: `look` prop (`"list" | "setup"`).
- `src/components/manager/guided-flow.tsx`: `FlowStep.illustration`, `FlowStep.aside`.
- `src/components/manager/control-row.tsx`: icon tile, meta line, inline action, attention pills.
- `src/components/manager/empty-state.tsx`: `variant` (`"card" | "page"`).
- `src/components/manager/next-task-card.tsx`: drawing, eyebrow, left button.
- `src/components/hiring/new-opening-steps.ts`: `matchPosition`, `visiblePositions`.
- `src/components/hiring/new-opening-form.tsx`: position cards (mockup 3), start cards (mockup 4).
- `src/components/hiring/opening-settings-form.tsx`: panel cards, drawing and count on the members step (mockup 6).
- `src/components/hiring/invite/copy-field.tsx`: `useCopyValue` hook (CopyField uses it, unchanged behaviour).
- `src/components/hiring/invite/invite-form.tsx`: single ready view through `InviteReady`.
- `src/app/(manager)/dashboard/page.tsx`: attention rows with tiles and chips (mockup 1).
- `src/app/(manager)/hiring/openings/page.tsx`: control rows, group counts, empty state (mockups 2, 8).
- `src/app/(manager)/hiring/openings/[id]/page.tsx`: setup card (mockup 5).
- `src/i18n/messages/hiring.tr.json`, `src/i18n/messages/hiring.en.json`: new and changed keys per task.
- `src/app/globals.css`: comment only (the mockup's accent tiles).
- Tests updated: `src/components/visual/blocks.test.ts` (unchanged expectations, only if a default class moved: none should), `src/components/manager/control-row.test.ts`, `src/components/manager/empty-state.test.ts`, `src/components/manager/guided-flow.test.ts`, `src/components/hiring/new-opening-steps.test.ts`, `src/components/hiring/new-opening-form.test.ts`, `src/components/hiring/opening-settings-form.test.ts`, `src/app/(manager)/dashboard/page.test.ts`, `src/app/(manager)/hiring/openings/page.test.ts`, `src/app/(manager)/hiring/openings/[id]/page.test.ts`.

Note: v4 names a `SetupPath` component; it does not exist at HEAD dd1f34e (`grep -rn SetupPath src` finds nothing). The setup path is drawn by `PathSteps` inside `src/app/(manager)/hiring/openings/[id]/page.tsx`; this plan gives `PathSteps` a `look="setup"` and does not invent `SetupPath`.

---

### Task 1: Panel look primitives (IconTile, positionIcon, ChoiceCardGroup looks)

Matches the mockup's `.tile.soft`, `.pcard` (screens 3, 6) and `.ccard` (screen 4).

**Files:**
- Create: `src/components/visual/frozen-markup.ts`
- Create: `src/components/visual/icon-tile.tsx`
- Create: `src/components/hiring/position-icon.ts`
- Modify: `src/components/visual/choice-card.tsx`
- Modify: `src/app/globals.css` (comment block at lines 28-33)
- Test: `src/components/visual/choice-card.test.ts`, `src/components/hiring/position-icon.test.ts`
- Generated: `src/components/visual/choice-card.default-markup.json`

**Interfaces:**
- Produces: `frozenMarkup(file: string, current: string[]): string[]`; `IconTile({ icon: LucideIcon; size?: "md" | "lg"; tone?: "soft" | "dashed"; className?: string })`; `positionIcon(name: string): LucideIcon`; `ChoiceCardGroup` prop `look?: "default" | "panel" | "panel-lg"`; `ChoiceItem.tone?: "new"`.

- [ ] **Step 1: Write the frozen-markup helper**

```ts
// src/components/visual/frozen-markup.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Test helper: the markup a shared block drew before a change. Run the test
 * once with CAPTURE_MARKUP=1 at the commit before the change: the current
 * markup is written to `file` (relative to the repository root). Every later
 * run returns what was written, so a default that moves by one class fails.
 */
export function frozenMarkup(file: string, current: string[]): string[] {
  const full = path.resolve(process.cwd(), file);
  if (process.env.CAPTURE_MARKUP === "1") writeFileSync(full, `${JSON.stringify(current, null, 2)}\n`);
  if (!existsSync(full)) throw new Error(`No frozen markup at ${file}: run this test once with CAPTURE_MARKUP=1 before changing the component.`);
  return JSON.parse(readFileSync(full, "utf8")) as string[];
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/components/visual/choice-card.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FileText, Headset, Plus } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ChoiceCardGroup } from "./choice-card";
import { frozenMarkup } from "./frozen-markup";

const noop = () => undefined;
const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(ChoiceCardGroup as never, props as never));

/** What the candidate screens and the panel drew before the panel looks existed (captured at dd1f34e). */
const CASES: Array<Record<string, unknown>> = [
  { type: "single", name: "q1", value: ["b"], onChange: noop, items: [{ value: "a", label: "Birinci", marker: "A", shortcut: "1" }, { value: "b", label: "İkinci", marker: "B", shortcut: "2", description: "Açıklama" }] },
  { type: "multi", name: "q2", value: ["x"], onChange: noop, labelledBy: "l", describedBy: "d", items: [{ value: "x", label: "Kadir Ay", marker: "KA", description: "Sahip" }, { value: "y", label: "Ece", disabled: true }] },
  { type: "single", name: "q3", value: [], onChange: noop, columns: 2, items: [{ value: "AI", label: "İlan", marker: FileText, description: "Gövde" }] },
  { type: "single", name: "q4", value: ["3"], onChange: noop, size: "square", columns: 5, items: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })) },
  { type: "single", name: "q5", value: [], onChange: noop, disabled: true, items: [{ value: "a", label: "Kapalı" }] },
];

describe("ChoiceCardGroup's default look stays as it was", () => {
  it("draws every default case exactly as before the panel looks", () => {
    const now = CASES.map(html);
    expect(now).toEqual(frozenMarkup("src/components/visual/choice-card.default-markup.json", now));
  });
});

describe("ChoiceCardGroup's panel looks (manager mockup 3, 4, 6)", () => {
  it("panel: an accent-soft icon tile, the radio mark at the right, the chosen card in accent with a soft ring", () => {
    const out = html({
      type: "single",
      name: "p",
      value: ["a"],
      onChange: noop,
      look: "panel",
      items: [
        { value: "a", label: "Müşteri Destek Uzmanı", description: "3 yetkinlik · ilan metni var", marker: Headset },
        { value: "new", label: "Yeni bir pozisyon", description: "Adını yaz", marker: Plus, tone: "new" },
      ],
    });
    expect(out).toContain("bg-accent-soft text-accent");
    expect(out).toContain("lucide-headset");
    expect(out).toContain("has-[:checked]:border-accent has-[:checked]:bg-accent-soft");
    expect(out).toContain("has-[:checked]:shadow-[0_0_0_3px_rgb(14_106_87/0.08)]");
    expect(out.match(/rounded-full peer-checked:border-\[6px\] peer-checked:border-accent/g)).toHaveLength(2);
    expect(out).toMatch(/<input type="radio" name="p" value="a" checked="" class="peer sr-only"\/>/);
    // The card that adds something new is dashed, its tile too.
    expect(out).toContain("border-dashed border-line bg-transparent");
    expect(out).toContain("border-[1.5px] border-dashed border-underline text-muted");
    // The panel cards offer no key hint.
    expect(out).not.toContain("<kbd");
  });

  it("panel, multi: initials in a round soft tile and a checkbox mark with its check", () => {
    const out = html({ type: "multi", name: "m", value: ["x"], onChange: noop, look: "panel", items: [{ value: "x", label: "Kadir Ay", marker: "KA", description: "Sahip" }] });
    expect(out).toMatch(/rounded-full bg-accent-soft font-bold text-accent[^"]*">KA</);
    expect(out).toContain("peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white");
    expect(out).toContain("lucide-check");
    expect(out).toMatch(/<input type="checkbox" name="m" value="x" checked=""/);
  });

  it("panel-lg: the big 52px tile, a 16px title and the radio at the top right", () => {
    const out = html({ type: "single", name: "s", value: [], onChange: noop, look: "panel-lg", items: [{ value: "AI", label: "İlan metninden öneri al", description: "Sorular önerilir.", marker: FileText }] });
    expect(out).toContain("size-[52px] rounded-xl");
    expect(out).toContain("lucide-file-text");
    expect(out).toContain("block font-semibold text-[16px] leading-6");
    expect(out).toContain("items-start rounded-2xl");
  });
});
```

```ts
// src/components/hiring/position-icon.test.ts
import { Briefcase, Calculator, ChartLine, ClipboardList, Code, Handshake, Headset, PenTool, PhoneCall, Store, Truck } from "lucide-react";
import { describe, expect, it } from "vitest";
import { positionIcon } from "./position-icon";

describe("positionIcon (manager mockup 2, 3: a tile per role)", () => {
  it.each([
    ["Müşteri Destek Uzmanı", Headset],
    ["Destek Uzmanı · Ekim", Headset],
    ["Customer Support", Headset],
    ["Çağrı Merkezi Temsilcisi", PhoneCall],
    ["Mağaza Satış Danışmanı", Store],
    ["Saha Satış", Handshake],
    ["Ürün Tasarımcısı", PenTool],
    ["Veri Analisti", ChartLine],
    ["Data Analyst", ChartLine],
    ["Yazılım Geliştirici", Code],
    ["Muhasebe Uzmanı", Calculator],
    ["Yönetici Asistanı", ClipboardList],
    ["Depo ve Lojistik Sorumlusu", Truck],
    ["Kalite Sorumlusu", Briefcase],
    ["", Briefcase],
  ] as const)("%s", (name, icon) => {
    expect(positionIcon(name)).toBe(icon);
  });
});
```

- [ ] **Step 3: Capture the default markup at HEAD, then see the new tests fail**

Run (before touching `choice-card.tsx`): `CAPTURE_MARKUP=1 pnpm exec vitest run src/components/visual/choice-card.test.ts`
Expected: the "default look" test PASSES and writes `src/components/visual/choice-card.default-markup.json`; the three "panel looks" tests FAIL (no `bg-accent-soft text-accent` in the output).

Run: `pnpm exec vitest run src/components/hiring/position-icon.test.ts`
Expected: FAIL, cannot resolve `./position-icon`.

- [ ] **Step 4: Write IconTile**

```tsx
// src/components/visual/icon-tile.tsx
// kademe-owned
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Manager mockup (2026-10-06): the panel's icon tile, a soft square with the
 * icon in the accent: 40px in rows and cards, 52px on the big start cards.
 * "dashed" marks a card that adds something new. Decorative: the row's own
 * words carry the meaning, so the tile is hidden from assistive technology.
 */
export function IconTile({ icon: Icon, size = "md", tone = "soft", className }: { icon: LucideIcon; size?: "md" | "lg"; tone?: "soft" | "dashed"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center",
        size === "lg" ? "size-[52px] rounded-xl" : "size-10 rounded-[10px]",
        tone === "soft" ? "bg-accent-soft text-accent" : "border-[1.5px] border-dashed border-underline text-muted",
        className,
      )}
    >
      <Icon className={size === "lg" ? "size-[26px]" : "size-[18px]"} strokeWidth={1.75} />
    </span>
  );
}
```

- [ ] **Step 5: Write positionIcon**

```ts
// src/components/hiring/position-icon.ts
import { Briefcase, Calculator, ChartLine, ClipboardList, Code, Handshake, Headset, PenTool, PhoneCall, Store, Truck, type LucideIcon } from "lucide-react";

/**
 * Manager mockup 2 and 3: every opening and position row carries a tile with
 * an icon for its role. Positions have no icon field, so the icon is read from
 * the name (Turkish and English words); the order matters (a store's sales
 * role is a store, a call centre's support role is a phone). Anything else is
 * a briefcase. Presentation only: nothing is stored or decided from it.
 */
const RULES: ReadonlyArray<readonly [RegExp, LucideIcon]> = [
  [/çağrı|call cent/, PhoneCall],
  [/destek|support|müşteri hizmet|customer/, Headset],
  [/mağaza|store|retail/, Store],
  [/satış|sales/, Handshake],
  [/tasarım|design/, PenTool],
  [/veri|data|analist|analyst/, ChartLine],
  [/yazılım|geliştirici|developer|engineer|mühendis/, Code],
  [/muhasebe|accountant|accounting|finans|finance/, Calculator],
  [/asistan|assistant|sekreter/, ClipboardList],
  [/depo|lojistik|warehouse|logistic/, Truck],
];

export function positionIcon(name: string): LucideIcon {
  // Both lower-casings: Turkish for "İ" and "I", plain for English names.
  const text = `${name.toLocaleLowerCase("tr")} ${name.toLowerCase()}`;
  return RULES.find(([pattern]) => pattern.test(text))?.[1] ?? Briefcase;
}
```

- [ ] **Step 6: Add the panel looks to ChoiceCardGroup**

In `src/components/visual/choice-card.tsx`:

1. Imports: change `import type { LucideIcon } from "lucide-react";` to

```tsx
import { Check, type LucideIcon } from "lucide-react";
```

and add `import { IconTile } from "./icon-tile";` after the `nextChoiceIndex` import.

2. Replace the `ChoiceItem` type with:

```tsx
export type ChoiceItem = {
  value: string;
  label: ReactNode;
  marker?: string | LucideIcon;
  shortcut?: string | null;
  description?: ReactNode;
  disabled?: boolean;
  /** Panel looks only: a card that adds something new (a new position), drawn dashed. */
  tone?: "new";
};
```

3. Add this component above `export function ChoiceCardGroup`:

```tsx
/**
 * Manager mockup 3, 4, 6: the panel's choice card. Big and soft: the icon tile
 * (or the person's initials) on the left, the title and one line, and the
 * radio or checkbox mark at the right, drawn from the native input before it
 * (peer). The chosen card has the accent edge, the accent-soft ground and a
 * soft ring; on "panel-lg" its tile turns white. The keyboard and the reader
 * work as on the default card (the same native input). No key hint here.
 */
function PanelChoice({
  item,
  type,
  name,
  checked,
  off,
  large,
  onToggle,
}: {
  item: ChoiceItem;
  type: "single" | "multi";
  name: string;
  checked: boolean;
  off: boolean;
  large: boolean;
  onToggle(): void;
}) {
  const Marker = typeof item.marker === "string" || !item.marker ? null : item.marker;
  return (
    <label
      className={cn(
        "group/choice relative flex cursor-pointer gap-4 border-[1.5px] text-ink transition-colors duration-[120ms] ease-out motion-reduce:transition-none",
        large ? "items-start rounded-2xl px-[22px] py-5" : "min-h-14 items-center rounded-[14px] px-[18px] py-4",
        item.tone === "new" ? "border-dashed border-line bg-transparent" : "border-line bg-surface hover:bg-canvas",
        "has-[:checked]:border-solid has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:shadow-[0_0_0_3px_rgb(14_106_87/0.08)]",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        "has-[:disabled]:cursor-not-allowed has-[:disabled]:border-dashed has-[:disabled]:text-muted has-[:disabled]:hover:bg-surface",
      )}
    >
      <input type={type === "single" ? "radio" : "checkbox"} name={name} value={item.value} checked={checked} disabled={off} onChange={onToggle} className="peer sr-only" />
      {typeof item.marker === "string" ? (
        <span
          aria-hidden
          className={cn(
            "tnum grid shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent group-has-[:checked]/choice:bg-surface",
            large ? "size-[52px] text-[15px]" : "size-10 text-[13px]",
          )}
        >
          {item.marker}
        </span>
      ) : Marker ? (
        <IconTile icon={Marker} size={large ? "lg" : "md"} tone={item.tone === "new" ? "dashed" : "soft"} className={large ? "group-has-[:checked]/choice:bg-surface" : undefined} />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block font-semibold", large ? "text-[16px] leading-6" : "text-[15px] leading-[22px]")}>{item.label}</span>
        {item.description ? (
          <span className={cn("mt-0.5 block", large ? "text-[14px] leading-5 text-ink-2" : "text-[13px] leading-5 text-muted")}>{item.description}</span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center border-[1.5px] border-line-mute text-transparent peer-disabled:border-dashed",
          large && "mt-1",
          type === "single" ? "size-5 rounded-full peer-checked:border-[6px] peer-checked:border-accent" : "size-[22px] rounded-md peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white",
        )}
      >
        {type === "multi" ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
      </span>
    </label>
  );
}
```

4. In `ChoiceCardGroup`'s props add `look = "default",` to the destructuring (after `disabled = false,`) and to the type `look?: "default" | "panel" | "panel-lg";` with the comment `/** "panel" and "panel-lg": the manager's cards (mockup 3, 4, 6); the default is the candidate side's card, unchanged. */`.

5. Change the container's class from

```tsx
      className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", columns === 5 && "grid-cols-5")}
```

to

```tsx
      className={cn(look === "default" ? "grid gap-2" : "grid gap-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", columns === 5 && "grid-cols-5")}
```

6. As the first lines inside `items.map((item) => {`, before `const Marker = ...`, add:

```tsx
        if (look !== "default") {
          return (
            <PanelChoice
              key={item.value}
              item={item}
              type={type}
              name={name}
              checked={value.includes(item.value)}
              off={disabled || Boolean(item.disabled)}
              large={look === "panel-lg"}
              onToggle={() => toggle(item.value)}
            />
          );
        }
```

The default branch below stays byte for byte as it is.

7. In `src/app/globals.css`, under the line ` *  - Card borders, background blocks and secondary buttons are NEVER accent-coloured.` add:

```css
 *  - User decision 2026-10-06 (docs/design/hiring-manager-mockup.html): the
 *    manager panel's icon tiles, chosen choice cards, setup-path markers and
 *    setup progress use the accent on accent-soft. Status stays dot + text.
```

- [ ] **Step 7: Run the tests**

Run: `pnpm exec vitest run src/components/visual/choice-card.test.ts src/components/hiring/position-icon.test.ts src/components/visual/blocks.test.ts`
Expected: PASS (the default markup equals the captured JSON; `blocks.test.ts` unchanged).

- [ ] **Step 8: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/visual/frozen-markup.ts src/components/visual/icon-tile.tsx src/components/hiring/position-icon.ts src/components/hiring/position-icon.test.ts src/components/visual/choice-card.tsx src/components/visual/choice-card.test.ts src/components/visual/choice-card.default-markup.json src/app/globals.css
git commit -m "Add the panel's icon tile and big choice card looks"
```

---

### Task 2: Guided flow drawing and aside (StepScreen "flow" size)

Matches the mockup's `.split .q` region: a spot drawing above the question (screens 3 and 6) and the summary pill under the lead (screen 4).

**Files:**
- Modify: `src/components/visual/illustrations.tsx:358-363` (SIZE)
- Modify: `src/components/visual/step-screen.tsx`
- Modify: `src/components/manager/guided-flow.tsx`
- Test: `src/components/visual/step-screen.test.ts` (create), `src/components/manager/guided-flow.test.ts` (append)
- Generated: `src/components/visual/step-screen.default-markup.json`

**Interfaces:**
- Consumes: `frozenMarkup` (Task 1).
- Produces: `Illustration size="flow"`; `StepScreen illustrationSize?: "hero" | "spot" | "flow"`; `FlowStep.illustration?: IllustrationName`, `FlowStep.aside?: ReactNode`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/visual/step-screen.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { frozenMarkup } from "./frozen-markup";
import { StepScreen } from "./step-screen";

const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(StepScreen as never, props as never));

/** The candidate side's and the panel's step screens before the "flow" drawing size (captured at the commit before Task 2). */
const CASES: Array<Record<string, unknown>> = [
  { layout: "split", title: "Merhaba Elif", illustration: "welcome", lead: "Kısa." },
  { layout: "single", width: 640, title: "Link hazır", illustration: "inviteReady", illustrationSize: "spot", kicker: "Aday davet et", children: createElement("p", null, "gövde") },
  { layout: "split", width: 1000, title: "Yayına hazır mı?", aside: createElement("p", null, "yan"), enter: true, children: createElement("p", null, "satırlar") },
  { layout: "single", width: 1000, title: "Tek" },
];

describe("StepScreen", () => {
  it("draws every existing case exactly as before", () => {
    const now = CASES.map(html);
    expect(now).toEqual(frozenMarkup("src/components/visual/step-screen.default-markup.json", now));
  });

  it("draws a 'flow' drawing above the title at the guided flow's size (manager mockup 3, 6)", () => {
    const out = html({ layout: "split", title: "Hangi pozisyon için?", illustration: "emptyOpenings", illustrationSize: "flow" });
    expect(out).toMatch(/<svg[^>]*class="h-auto shrink-0 w-\[200px\] xl:w-\[260px\] mb-6"/);
    expect(out.indexOf("<svg")).toBeLessThan(out.indexOf("Hangi pozisyon için?"));
  });
});
```

Append to `src/components/manager/guided-flow.test.ts` (inside the existing `describe("GuidedFlow (K12, W1-W10)", ...)` block, using its `flow` and `noop` helpers):

```ts
  it("draws the step's drawing above the question and its aside under the lead, on a page only (manager mockup 3, 4)", () => {
    const step = {
      id: "position",
      title: "Hangi pozisyon için?",
      lead: createElement("p", null, "Seç."),
      layout: "split",
      illustration: "emptyOpenings",
      aside: createElement("p", { id: "flow-aside" }, "Özet"),
      body: createElement("p", null, "kartlar"),
      primary: { kind: "button", id: "flow-next", label: "Devam et", onClick: noop },
    };
    const out = flow({ step });
    // emptyOpenings' tint circle: the drawing is there, above the question.
    expect(out).toContain('cx="134" cy="26" r="13"');
    expect(out.indexOf('cx="134" cy="26" r="13"')).toBeLessThan(out.indexOf("Hangi pozisyon için?"));
    expect(out).toContain('<p id="flow-aside">Özet</p>');
    // A Sheet is 480px: no drawing there, the aside stays.
    const sheet = flow({ step, container: "sheet", exit: null });
    expect(sheet).not.toContain('cx="134" cy="26" r="13"');
    expect(sheet).toContain('<p id="flow-aside">Özet</p>');
  });
```

- [ ] **Step 2: Capture, then see the new tests fail**

Run (before touching `step-screen.tsx`): `CAPTURE_MARKUP=1 pnpm exec vitest run src/components/visual/step-screen.test.ts`
Expected: "draws every existing case exactly as before" PASSES and writes the JSON; the "flow" test FAILS (no svg with the flow classes).

Run: `pnpm exec vitest run src/components/manager/guided-flow.test.ts`
Expected: the new test FAILS (no drawing, no aside).

- [ ] **Step 3: Implement**

`src/components/visual/illustrations.tsx`, in `const SIZE`, add after `small: "w-24",`:

```tsx
  // The guided flows' question region in the panel (manager mockup 3, 6).
  flow: "w-[200px] xl:w-[260px]",
```

`src/components/visual/step-screen.tsx`:
- prop type: `illustrationSize?: "hero" | "spot" | "flow";`
- replace the line

```tsx
      {illustration && illustrationSize === "spot" ? <Illustration name={illustration} size="spot" className="mb-6" /> : null}
```

with

```tsx
      {illustration && illustrationSize !== "hero" ? <Illustration name={illustration} size={illustrationSize} className="mb-6" /> : null}
```

- update the comment above it to: `// A spot (160px) or flow (200-260px) drawing sits above the title, a hero drawing (400px) under the lead.`

`src/components/manager/guided-flow.tsx`:
- add `import type { IllustrationName } from "@/components/visual/illustrations";`
- in `FlowStep` add after `lead?: ReactNode;`:

```tsx
  /** Manager mockup 3, 6: a spot drawing above the question, on a page only (a Sheet is too narrow). */
  illustration?: IllustrationName;
  /** Manager mockup 4: under the lead, the decisions so far in one line. */
  aside?: ReactNode;
```

- in the Sheet branch, after `{step.lead ? <div className="text-[14px] leading-[22px] text-ink-2">{step.lead}</div> : null}` add `{step.aside ? <div>{step.aside}</div> : null}`
- in the page branch replace the `StepScreen` element's opening tag with:

```tsx
        <StepScreen
          key={step.id}
          layout={step.layout}
          width={step.layout === "single" ? 640 : 1000}
          title={step.title}
          titleRef={heading}
          lead={step.lead}
          illustration={step.illustration}
          illustrationSize="flow"
          aside={step.aside}
          enter={enter}
        >
```

- [ ] **Step 4: Run the tests**

Run: `pnpm exec vitest run src/components/visual/step-screen.test.ts src/components/manager/guided-flow.test.ts src/components/visual/blocks.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/visual/illustrations.tsx src/components/visual/step-screen.tsx src/components/visual/step-screen.test.ts src/components/visual/step-screen.default-markup.json src/components/manager/guided-flow.tsx src/components/manager/guided-flow.test.ts
git commit -m "Let a guided flow step carry a drawing and an aside"
```

---

### Task 3: Alım aç step 1, position cards (mockup screen 3)

The combobox becomes big position cards (library positions with an icon tile and "3 yetkinlik · ilan metni var") and a dashed "Yeni bir pozisyon" card that opens a name field. The `createOpeningAction` input stays the same: `{ kind: "existing", id }` or `{ kind: "new", name, jobDescription }`. The old picker's rule "a typed name that is a library position's name is that position" is kept (`matchPosition`, applied on "Devam et").

**Files:**
- Modify: `src/components/hiring/new-opening-steps.ts`
- Modify: `src/components/hiring/new-opening-form.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `src/i18n/messages/hiring.en.json` (namespace `hiringNew`)
- Test: `src/components/hiring/new-opening-steps.test.ts`, `src/components/hiring/new-opening-form.test.ts`

**Interfaces:**
- Consumes: `ChoiceCardGroup look="panel"`, `ChoiceItem.tone` (Task 1); `positionIcon` (Task 1); `FlowStep.illustration` (Task 2).
- Produces: `matchPosition<P extends { id: string; name: string }>(list: readonly P[], name: string): P | null`; `visiblePositions<P extends { id: string; name: string }>(list: readonly P[], query: string, pickedId: string | null): P[]`; `POSITION_FILTER_FROM = 6`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/hiring/new-opening-steps.test.ts` (and add `matchPosition, visiblePositions` to its import from `./new-opening-steps`):

```ts
describe("the position cards (manager mockup 3)", () => {
  const list = [
    { id: "1", name: "Destek Uzmanı" },
    { id: "2", name: "Satış Uzmanı" },
    { id: "3", name: "İnsan Kaynakları" },
  ];

  it("a typed name that is a library position's name is that position, whatever its case and spaces (the old picker's rule)", () => {
    expect(matchPosition(list, "  destek uzmanı ")?.id).toBe("1");
    expect(matchPosition(list, "İNSAN KAYNAKLARI")?.id).toBe("3");
    expect(matchPosition(list, "Destek")).toBeNull();
    expect(matchPosition(list, "   ")).toBeNull();
  });

  it("filters the cards by the search and keeps the chosen card in view", () => {
    expect(visiblePositions(list, "", null).map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(visiblePositions(list, "uzman", null).map((p) => p.id)).toEqual(["1", "2"]);
    expect(visiblePositions(list, "satış", "1").map((p) => p.id)).toEqual(["1", "2"]);
  });
});
```

In `src/components/hiring/new-opening-form.test.ts`:

1. Let `render` take the positions: change its props type to `{ initialPositionId?: string | null; initialCopyId?: string | null; hash?: string; positions?: PositionOption[] }` and pass `positions: props.positions ?? [support, noAd],` instead of `positions: [support, noAd],`.

2. Replace the whole test `"a position from the library is ready: continue works, its profile shows, and the picker's name says the question and the choice"` with:

```ts
  it("a position from the library is ready: its card is chosen, continue works, two steps", () => {
    const out = render({ initialPositionId: support.id });
    expect(out).toMatch(/<button[^>]*id="new-opening-next"[^>]*>Devam et<\/button>/);
    expect(out).not.toContain("new-opening-next-why");
    expect(radio(out, support.id)).toContain('checked=""');
    // A library position has no ad step (plan decision 13): two steps.
    expect(out).toContain("Adım 1 / 2");
    // The preselection from the address is not a change: leaving loses nothing.
    expect(out).toContain(">Çık<");
    expect(out).not.toContain("Kaydetmeden çık");
  });

  it("shows the library positions as big cards with their role's tile and facts, and a dashed card for a new one (mockup 3)", () => {
    const out = render();
    expect(out).toMatch(/role="radiogroup" aria-labelledby="new-opening-position-label"/);
    expect(out).toMatch(/id="new-opening-position-label"[^>]*>Hangi pozisyon için\?</);
    expect(out).toContain("3 yetkinlik · ilan metni var");
    expect(out).toContain("Yetkinlik yok · ilan metni yok");
    expect(out).toContain("lucide-headset");
    expect(out).toContain("lucide-handshake");
    expect(out).toContain("Yeni bir pozisyon");
    expect(out).toContain("Adını yaz, gerisini birlikte kuralım.");
    expect(radio(out, "__new__")).not.toContain('checked=""');
    // The name field opens only once "Yeni bir pozisyon" is chosen; the old combobox is gone.
    expect(out).not.toContain('id="new-opening-name"');
    expect(out).not.toContain('role="combobox"');
    // The step's drawing (emptyOpenings) above the question.
    expect(out).toContain('cx="134" cy="26" r="13"');
    // Two positions need no search.
    expect(out).not.toContain('placeholder="Pozisyon ara"');
  });

  it("offers a search above the cards once the library has more than six positions", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...support, id: `0000000${i}-1111-4111-8111-111111111111`, name: `Pozisyon ${i}` }));
    expect(render({ positions: many })).toContain('placeholder="Pozisyon ara"');
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run src/components/hiring/new-opening-steps.test.ts src/components/hiring/new-opening-form.test.ts`
Expected: FAIL (`matchPosition` is not exported; no radiogroup for the positions; the combobox is still drawn).

- [ ] **Step 3: Add the pure helpers**

Append to `src/components/hiring/new-opening-steps.ts`:

```ts
/** Manager mockup 3: above this many library positions the cards get a search field. */
export const POSITION_FILTER_FROM = 6;

const fold = (text: string) => text.trim().toLocaleLowerCase("tr");

/**
 * The old picker's rule, kept: a new name that is a library position's name
 * (any case, outer spaces ignored) is that position, so "Devam et" picks it
 * instead of opening a second position of the same name.
 */
export function matchPosition<P extends { id: string; name: string }>(list: readonly P[], name: string): P | null {
  const wanted = fold(name);
  if (!wanted) return null;
  return list.find((p) => fold(p.name) === wanted) ?? null;
}

/** The cards the search shows, in the library's order; the chosen card always stays in view. */
export function visiblePositions<P extends { id: string; name: string }>(list: readonly P[], query: string, pickedId: string | null): P[] {
  const q = fold(query);
  return q ? list.filter((p) => p.id === pickedId || fold(p.name).includes(q)) : [...list];
}
```

- [ ] **Step 4: Add and remove copy**

In `hiringNew` of `src/i18n/messages/hiring.tr.json` add:

```json
    "positionFilter": "Pozisyon ara",
    "positionCardDetail": "{count, plural, =0 {Yetkinlik yok} other {# yetkinlik}} · {ad}",
    "positionNew": "Yeni bir pozisyon",
    "positionNewBody": "Adını yaz, gerisini birlikte kuralım.",
    "positionNewName": "Pozisyonun adı",
```

and in `src/i18n/messages/hiring.en.json`:

```json
    "positionFilter": "Search positions",
    "positionCardDetail": "{count, plural, =0 {No competencies} one {# competency} other {# competencies}} · {ad}",
    "positionNew": "A new position",
    "positionNewBody": "Type its name, we set up the rest together.",
    "positionNewName": "The position's name",
```

Then remove `positionPick`, `positionSearch`, `positionNone`, `positionCreate`, `profileSummary`, `weightsEqual`, `weightsSet`, `profileEmpty` from `hiringNew` in both files, after checking that nothing else reads them: `grep -rnE "\"(positionPick|positionSearch|positionNone|positionCreate|profileSummary|weightsEqual|weightsSet|profileEmpty)\"|t\(\"(positionPick|positionSearch|positionNone|positionCreate|profileSummary|weightsEqual|weightsSet|profileEmpty)\"" src | grep -v i18n/messages` must print only `src/components/hiring/new-opening-form.tsx` lines (`libPositions.profileEmpty` in `position-form.tsx` is another namespace and stays).

- [ ] **Step 5: Replace the position step in the form**

In `src/components/hiring/new-opening-form.tsx`:

1. Imports: change the lucide line to `import { Copy, FilePlus2, Plus, Sparkles } from "lucide-react";` (Task 4 changes it again); delete the imports of `Button`, `Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList`, `Popover, PopoverContent, PopoverTrigger`; add

```tsx
import { Input } from "@/components/ui/input";
import { positionIcon } from "./position-icon";
```

and add `matchPosition, POSITION_FILTER_FROM, visiblePositions,` to the import from `./new-opening-steps`.

2. Above `export function NewOpeningForm` add:

```tsx
/** The card that adds a position that is not in the library yet. */
const NEW = "__new__";
```

3. State: delete `const [open, setOpen] = useState(false);`; keep `query`; add after `const [newName, setNewName] = ...`:

```tsx
  // W4: the typed name stays while a library card is chosen, and comes back with "Yeni bir pozisyon".
  const [nameDraft, setNameDraft] = useState("");
```

4. Delete `const typed = query.trim();`, `const exists = ...` and the whole `function onOpenChange(...)`. Add in their place:

```tsx
  const shown = visiblePositions(positions, query, picked?.id ?? null);
  const positionValue = picked ? [picked.id] : newName !== null ? [NEW] : [];

  function choosePosition(id: string) {
    setRefusal(null);
    if (id === NEW) {
      setPicked(null);
      setNewName(nameDraft);
      return;
    }
    setPicked(positions.find((p) => p.id === id) ?? null);
    setNewName(null);
  }

  // "Devam et" on the position: a typed library name is that position (no ad step then).
  function continueFromPosition() {
    const match = picked ? null : matchPosition(positions, newName ?? "");
    if (match) {
      setPicked(match);
      setNewName(null);
      nav.go("start");
      return;
    }
    const to = steps[index + 1];
    if (to) nav.go(to);
  }
```

5. Replace the whole `position: { ... }` entry of `screens` with:

```tsx
    position: {
      id: "position",
      title: t("stepPositionTitle"),
      lead: <p>{t("stepPositionLead")}</p>,
      layout: "split",
      illustration: "emptyOpenings",
      primary: { kind: "button", id: "new-opening-next", label: flow("continue"), waitReason: positionReady ? null : t("needPosition"), onClick: continueFromPosition },
      note,
      body: (
        <div className="space-y-3">
          <span id="new-opening-position-label" className="sr-only">
            {t("stepPositionTitle")}
          </span>
          {positions.length > POSITION_FILTER_FROM ? (
            <Input aria-label={t("positionFilter")} placeholder={t("positionFilter")} value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 text-[16px]" />
          ) : null}
          <ChoiceCardGroup
            type="single"
            name="new-opening-position"
            labelledBy="new-opening-position-label"
            look="panel"
            value={positionValue}
            onChange={([v]) => (v ? choosePosition(v) : undefined)}
            items={[
              ...shown.map((p) => ({
                value: p.id,
                label: p.name,
                marker: positionIcon(p.name),
                description: t("positionCardDetail", { count: p.competencyCount, ad: p.hasJobAd ? t("summaryAd") : t("summaryNoAd") }),
              })),
              { value: NEW, label: t("positionNew"), description: t("positionNewBody"), marker: Plus, tone: "new" as const },
            ]}
          />
          {newName !== null && !picked ? (
            <div className="space-y-2">
              <Label htmlFor="new-opening-name">{t("positionNewName")}</Label>
              <Input
                id="new-opening-name"
                maxLength={POSITION_NAME_MAX}
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setNewName(e.target.value);
                  setRefusal(null);
                }}
                className="h-11 text-[16px]"
              />
            </div>
          ) : null}
        </div>
      ),
    },
```

6. Update the component's doc comment's first sentence to: `HIRING-UX 5.3 as HIRING-VISUAL-FLOW 4.6 (K12) in the look of the manager mockup (screens 3, 4): which position (cards, or a new name), the job ad (a new position only, plan decision 13), how to start;` and keep the rest.

- [ ] **Step 6: Run the tests**

Run: `pnpm exec vitest run src/components/hiring/new-opening-steps.test.ts src/components/hiring/new-opening-form.test.ts src/i18n/messages.test.ts src/i18n/panel-copy.test.ts`
Expected: PASS.

- [ ] **Step 7: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts`
Expected: no errors (no unused import of `Popover`, `Command`, `ChevronsUpDown`, `Button`).

- [ ] **Step 8: Commit**

```bash
git add src/components/hiring/new-opening-steps.ts src/components/hiring/new-opening-steps.test.ts src/components/hiring/new-opening-form.tsx src/components/hiring/new-opening-form.test.ts src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Show the opening's positions as big cards"
```

---

### Task 4: Alım aç, "Nasıl başlayalım?" big cards with less AI (mockup screen 4)

Three big cards from one data list in the mockup's order (copy, job ad, blank; copy only when there is something to copy), the job-ad card renamed "İlan metninden öneri al" with `FileText` and no badge, a lead "Sonra her şeyi değiştirebilirsin." and the decisions summary as an accent-soft pill with a check under it. The ready-template card is not in the list (later plan adds one entry). The start values sent to `createOpeningAction` stay `"AI" | "COPY" | "BLANK"`; the preselection rule stays (AI when there is an ad, else blank; copy when `?copy=`).

**Files:**
- Create: `src/components/hiring/start-choices.ts`
- Modify: `src/components/hiring/new-opening-form.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `src/i18n/messages/hiring.en.json` (namespace `hiringNew`)
- Test: `src/components/hiring/start-choices.test.ts` (create), `src/components/hiring/new-opening-form.test.ts`

**Interfaces:**
- Consumes: `ChoiceCardGroup look="panel-lg"` (Task 1), `FlowStep.aside` (Task 2).
- Produces: `type StartValue = "AI" | "COPY" | "BLANK"`; `type StartChoice = { value: StartValue; icon: LucideIcon; title: "startAi" | "startCopy" | "startBlank"; body: "startAiBody" | "startCopyBody" | "startBlankBody" }`; `startChoices(ctx: { hasCopySources: boolean }): StartChoice[]`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/hiring/start-choices.test.ts
import { Copy, FilePlus, FileText } from "lucide-react";
import { describe, expect, it } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";
import { startChoices } from "./start-choices";

describe("the start choices (manager mockup 4, less AI)", () => {
  it("lists copy, the job ad and blank in the mockup's order; copy only when there is something to copy", () => {
    expect(startChoices({ hasCopySources: true }).map((c) => c.value)).toEqual(["COPY", "AI", "BLANK"]);
    expect(startChoices({ hasCopySources: false }).map((c) => c.value)).toEqual(["AI", "BLANK"]);
  });

  it("draws plain file icons, never sparkles", () => {
    expect(startChoices({ hasCopySources: true }).map((c) => c.icon)).toEqual([Copy, FileText, FilePlus]);
  });

  it("names the job-ad start without 'AI' and without 'recommended', in both languages", () => {
    for (const locale of ["tr", "en"] as const) {
      const m = managerMessagesFor(locale).hiringNew;
      expect(m.startAi).not.toMatch(/\bAI\b|Önerilen|Recommended/);
      expect(m.startAiBody).not.toMatch(/\bAI\b|Önerilen|Recommended/);
      expect(m.summaryAi).not.toMatch(/\bAI\b/);
    }
  });
});
```

In `src/components/hiring/new-opening-form.test.ts`, replace the test `"the last step: three cards, the one-line summary, ..."` with:

```ts
  it("the last step: three big cards in the mockup's order, the summary pill, \"Alımı oluştur\" as the one filled button, and \"Geri\" one step back", () => {
    const out = render({ initialPositionId: support.id, hash: "#start" });
    expect(out).toMatch(/<h1[^>]*>Nasıl başlayalım\?<\/h1>/);
    expect(out).toContain("Sonra her şeyi değiştirebilirsin.");
    expect(out).toMatch(/role="radiogroup" aria-labelledby="new-opening-start-label"/);
    expect(out.indexOf('value="COPY"')).toBeLessThan(out.indexOf('value="AI"'));
    expect(out.indexOf('value="AI"')).toBeLessThan(out.indexOf('value="BLANK"'));
    expect(radio(out, "AI")).toContain('checked=""');
    expect(out).toContain("İlan metninden öneri al");
    expect(out).toContain("Önceki bir alımdan kopyala");
    expect(out).toContain("Boş başla");
    expect(out).toContain("size-[52px] rounded-xl");
    // Less AI: no sparkles, no badge, no ready-template card yet.
    expect(out).not.toContain("lucide-sparkles");
    expect(out).not.toContain("Önerilen");
    expect(out).not.toContain("Hazır şablon");
    expect(out).toContain("lucide-file-text");
    // The decisions in one line, as a pill with a check under the lead.
    expect(out).toMatch(/bg-accent-soft[^"]*text-accent[^"]*"><svg[^>]*lucide-check[\s\S]*?Destek Uzmanı · ilan metni var · ilan metninden öneri<\/p>/);
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
    expect(out).toMatch(/<button[^>]*id="new-opening-create"[^>]*>Alımı oluştur<\/button>/);
    expect(out).not.toContain("new-opening-create-why");
    expect(out).toContain("Adım 2 / 2");
    expect(out).toMatch(/<button type="button"[^>]*>.*Geri<\/button>/);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run src/components/hiring/start-choices.test.ts src/components/hiring/new-opening-form.test.ts`
Expected: FAIL (no `./start-choices`; the form still draws Sparkles and "AI taslağı").

- [ ] **Step 3: Write the data list**

```ts
// src/components/hiring/start-choices.ts
import { Copy, FilePlus, FileText, type LucideIcon } from "lucide-react";

/** The values createOpeningAction accepts for `start` (unchanged). */
export type StartValue = "AI" | "COPY" | "BLANK";

export type StartChoice = {
  value: StartValue;
  icon: LucideIcon;
  title: "startAi" | "startCopy" | "startBlank";
  body: "startAiBody" | "startCopyBody" | "startBlankBody";
};

type Context = { hasCopySources: boolean };

/**
 * Manager mockup 4 ("Nasıl başlayalım?"), user decision 2026-10-06 (less AI):
 * the cards in the mockup's order, each a plain file icon. Copying is offered
 * only when there is an opening to copy (HIRING-UX 5.3). The ready-template
 * start of the mockup is a later plan: it is one more entry here (and one
 * more value the action accepts), nothing else in the step changes.
 */
const CHOICES: ReadonlyArray<StartChoice & { shown(ctx: Context): boolean }> = [
  { value: "COPY", icon: Copy, title: "startCopy", body: "startCopyBody", shown: (ctx) => ctx.hasCopySources },
  { value: "AI", icon: FileText, title: "startAi", body: "startAiBody", shown: () => true },
  { value: "BLANK", icon: FilePlus, title: "startBlank", body: "startBlankBody", shown: () => true },
];

export function startChoices(ctx: Context): StartChoice[] {
  return CHOICES.filter((c) => c.shown(ctx)).map(({ value, icon, title, body }) => ({ value, icon, title, body }));
}
```

- [ ] **Step 4: Change the copy**

`src/i18n/messages/hiring.tr.json`, `hiringNew`: set

```json
    "jobAdHint": "İsteğe bağlı ama önerilir. Soru önerisi için 120 karakter yeter.",
    "startAi": "İlan metninden öneri al",
    "startAiBody": "Sorular ilan metnine göre önerilir; her birini sen onaylarsın.",
    "startCopyBody": "Bir alımın değerlendirmesini kopyala, istediğini değiştir.",
    "startBlankBody": "Aşamaları ve soruları kendin eklersin.",
    "summaryAi": "ilan metninden öneri",
```

and add `"stepStartLead": "Sonra her şeyi değiştirebilirsin.",`.

`src/i18n/messages/hiring.en.json`, `hiringNew`: set

```json
    "jobAdHint": "Optional but recommended. 120 characters are enough for suggestions.",
    "startAi": "Suggest from the job ad",
    "startAiBody": "Questions are suggested from the job ad; you approve each one.",
    "startCopyBody": "Copy an opening's assessment and change what you like.",
    "startBlankBody": "You add the stages and questions yourself.",
    "summaryAi": "suggested from the job ad",
```

and add `"stepStartLead": "You can change everything later.",`.

- [ ] **Step 5: Use the list in the form**

In `src/components/hiring/new-opening-form.tsx`:

1. Change the lucide import to `import { Check, Plus } from "lucide-react";`, add `import { startChoices, type StartValue } from "./start-choices";`.
2. Delete `type Start = "AI" | "COPY" | "BLANK";` and `const ICONS = { AI: Sparkles, COPY: Copy, BLANK: FilePlus2 } as const;`; replace every remaining `Start` type use (`initialStart: Start`, `useState<Start>`, `effective: Start`, `setStart(v as Start)`) with `StartValue`.
3. Delete the `const options: Array<[Start, string, string]> = [ ... ];` block and add in its place:

```tsx
  const choices = startChoices({ hasCopySources: sources.length > 0 });
```

4. Replace the whole `start: { ... }` entry of `screens` with:

```tsx
    start: {
      id: "start",
      title: t("stepStartTitle"),
      lead: <p>{t("stepStartLead")}</p>,
      // H3, W5: the decisions so far in one line, as the mockup's summary pill.
      aside: positionReady ? (
        <p className="inline-flex items-center gap-2 rounded-[10px] bg-accent-soft px-3 py-2 text-[14px] font-medium text-accent">
          <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          {summary}
        </p>
      ) : null,
      layout: "split",
      primary: { kind: "button", id: "new-opening-create", label: t("create"), busy: pending, busyLabel: t("creating"), waitReason: wait ? t(wait) : null, onClick: submit },
      note,
      body: (
        <div className="space-y-4">
          <span id="new-opening-start-label" className="sr-only">
            {t("stepStartTitle")}
          </span>
          <ChoiceCardGroup
            type="single"
            name="new-opening-start"
            labelledBy="new-opening-start-label"
            look="panel-lg"
            value={[effective]}
            onChange={([v]) => setStart(v as StartValue)}
            items={choices.map((c) => ({
              value: c.value,
              marker: c.icon,
              label: t(c.title),
              disabled: c.value === "AI" && !hasAd,
              description:
                c.value === "AI" && !hasAd ? (
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
                  t(c.body)
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
        </div>
      ),
    },
```

5. Fix the comment `// The recommended path is pre-selected, and falls back to "blank" while there is no ad.` to `// The job-ad start is pre-selected while there is an ad (unchanged rule), else "blank".`

- [ ] **Step 6: Run the tests**

Run: `pnpm exec vitest run src/components/hiring/start-choices.test.ts src/components/hiring/new-opening-form.test.ts src/components/hiring/new-opening-steps.test.ts src/i18n/messages.test.ts src/i18n/panel-copy.test.ts`
Expected: PASS. The tests for a library position without an ad (`radio(out, "AI")` disabled, summary "Satış Uzmanı · ilan metni yok · boş başlangıç") and for `?copy=` ("Destek 2025 kopyası") pass unchanged.

- [ ] **Step 7: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts`
Expected: no errors; `grep -rn "Sparkles" src/components/hiring` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add src/components/hiring/start-choices.ts src/components/hiring/start-choices.test.ts src/components/hiring/new-opening-form.tsx src/components/hiring/new-opening-form.test.ts src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Draw the opening's start as big cards and name the job-ad start plainly"
```

---

### Task 5: Bugün, the next task card and the attention rows (mockup screen 1)

The next task card gets the `inviteReady` drawing on its left, the eyebrow "SIRADAKİ İŞ · İŞE ALIM", a 22px title and the one filled button under the text. Attention rows get the 40px soft tile, a solution chip and "Aç ›". The exam's review queue, running list and expiring links are not touched.

**Files:**
- Modify: `src/components/manager/next-task-card.tsx`
- Modify: `src/app/(manager)/dashboard/page.tsx`
- Test: `src/app/(manager)/dashboard/page.test.ts`

**Interfaces:**
- Consumes: `IconTile` (Task 1).
- Produces: `NextTaskCard` with the same props as at HEAD.

- [ ] **Step 1: Write the failing tests**

In `src/app/(manager)/dashboard/page.test.ts`:

1. In `"makes the accommodation request the next task, quoted, ..."` replace the line with `"Sıradaki iş\nİşe alım\nEce Bal..."` by:

```ts
    expect(text(card)).toContain("Sıradaki iş\n·\nİşe alım\nEce Bal bir uyarlama istedi\n“Video yerine yazılı cevap verebilir miyim?”");
```

2. In `"reads in English with the same parts"` replace `expect(text(html)).toContain("Next up\nHiring");` by `expect(text(html)).toContain("Next up\n·\nHiring");`.

3. Append inside `describe("hiring's rows on Today", ...)`:

```ts
  it("draws the next task as the mockup's card: the drawing, the eyebrow and the one filled button under the text (mockup 1)", async () => {
    const html = await render([...EXAM(), accommodation, requestsRow]);
    const card = between(html, 'aria-labelledby="today-next"', "</section>");
    // inviteReady's tint circle.
    expect(card).toContain('cx="26" cy="26" r="9"');
    expect(card).toMatch(/<h2 id="today-next"[^>]*>Sıradaki iş<\/h2>/);
    expect(card).toMatch(/<a[^>]*data-variant="primary"[^>]*>Talebe bak<\/a>|<a[^>]*id="today-next-action"[^>]*>Talebe bak<\/a>/);
    expect(filled(html)).toBe(1);
  });

  it("gives every attention row a soft icon tile, its solution as a chip and its action as text (mockup 1)", async () => {
    const html = await render([accommodation, requestsRow, draftRow]);
    const list = between(html, 'aria-labelledby="today-attention"', "Tüm alımların durumu");
    expect(list.match(/bg-accent-soft text-accent/g)).toHaveLength(2);
    expect(list).toContain("lucide-inbox");
    expect(list).toContain("lucide-file-pen-line");
    expect(list.match(/rounded-full bg-row-line/g)).toHaveLength(2);
    expect(list).not.toContain("data-variant");
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run "src/app/(manager)/dashboard/page.test.ts"`
Expected: FAIL in the new and changed tests; "what the live exam sees on Today" PASSES.

- [ ] **Step 3: Rewrite NextTaskCard**

```tsx
// src/components/manager/next-task-card.tsx
// kademe-owned
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/visual/illustrations";

/**
 * 4.3 in the look of the manager mockup (screen 1): the one thing to do first
 * today (K10). A small drawing on the left, the eyebrow (what and for which
 * solution), the task in 22px, its quote and time, and the screen's one
 * filled button under the text.
 */
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
    <section aria-labelledby="today-next" className="flex items-center gap-7 rounded-2xl border border-line bg-surface px-[26px] py-[22px] shadow-panel-soft">
      <Illustration name="inviteReady" size="small" className="hidden w-[220px] md:block" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          <h2 id="today-next">{heading}</h2>
          <span aria-hidden>·</span>
          <span>{solution}</span>
        </div>
        <p className="mt-1.5 text-[22px] leading-7 font-semibold text-ink">{title}</p>
        {detail ? <p className="mt-1.5 text-[14.5px] leading-[22px] text-ink-2">“{detail}”</p> : null}
        {meta ? <p className="tnum mt-0.5 text-[13px] text-muted">{meta}</p> : null}
        <Button asChild variant="primary" className="mt-4">
          <Link id="today-next-action" href={action.href}>
            {action.label}
          </Link>
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Restyle the attention rows on Today**

In `src/app/(manager)/dashboard/page.tsx`:

1. Imports: change `import { ChevronRight, Clock, FileText, Inbox } from "lucide-react";` to `import { ArrowRight, ChevronRight, Clock, FilePenLine, Inbox } from "lucide-react";` and add `import { IconTile } from "@/components/visual/icon-tile";`.
2. `const ATTENTION_ICON = { requests: Inbox, expiring: Clock, draft: FilePenLine } as const;`
3. Replace the whole `{attention.length ? ( <section className="mt-8" aria-labelledby="today-attention"> ... </section> ) : null}` block with:

```tsx
      {attention.length ? (
        <section className="mt-8" aria-labelledby="today-attention">
          <h2 id="today-attention" className="mb-2.5 text-[12px] font-semibold tracking-[0.07em] text-muted uppercase">
            {t("today.attentionTitle")}
          </h2>
          <Card className="divide-y divide-hairline overflow-hidden">
            {attention.map((row) => {
              const Icon = ATTENTION_ICON[row.attention ?? "requests"];
              return (
                <Link key={row.id} href={row.href} className="flex items-center gap-3.5 px-[18px] py-3.5 hover:bg-canvas">
                  <IconTile icon={Icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{row.title}</span>
                    {row.subtitle ? <span className="block truncate text-[13px] text-muted">{row.subtitle}</span> : null}
                    {/* Ruling C6: data-rights requests are counted here and said plainly; they are handled with plan 3. */}
                    {row.detail ? <span className="block text-[13px] text-muted">{row.detail}</span> : null}
                  </span>
                  <span className="hidden rounded-full bg-row-line px-2.5 py-[3px] text-[12px] text-ink-2 sm:inline">{labelOf(row.solution)}</span>
                  <span className="inline-flex items-center gap-0.5 text-[14px] whitespace-nowrap text-ink underline decoration-underline underline-offset-[3px]">
                    {row.actionLabel ?? t("today.open")}
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                </Link>
              );
            })}
          </Card>
        </section>
      ) : null}
```

4. Replace the overview links' `const TEXT_LINK = ...` with `const TEXT_LINK = "inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-ink hover:underline";` and in the overviews block replace `<ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />` with `<ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />`. Leave the review queue, the running disclosure and the expiring links as they are.

- [ ] **Step 5: Run the tests**

Run: `pnpm exec vitest run "src/app/(manager)/dashboard/page.test.ts"`
Expected: PASS, including "keeps the review queue's rows exactly" and "keeps the running list's rows".

- [ ] **Step 6: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/manager/next-task-card.tsx "src/app/(manager)/dashboard/page.tsx" "src/app/(manager)/dashboard/page.test.ts"
git commit -m "Give Today's next task and attention rows the mockup's soft look"
```

---

### Task 6: Alımlar control view and its empty state (mockup screens 2 and 8)

Every opening row gets its role's tile, the name, status and one meta line ("Ekip: yalnız sen · Son tarih yok"), the setup segments in the accent, attention as quiet pills and the next step as an accent text action at the right. Group headings carry their count as a small pill; the column header row goes. The empty list becomes the open page empty state (big drawing, 24px title, "Alım aç" with a plus).

**Files:**
- Modify: `src/components/manager/control-row.tsx`
- Modify: `src/components/manager/empty-state.tsx`
- Modify: `src/app/(manager)/hiring/openings/page.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `src/i18n/messages/hiring.en.json` (namespace `hiringOpenings`)
- Test: `src/components/manager/control-row.test.ts`, `src/components/manager/empty-state.test.ts`, `src/app/(manager)/hiring/openings/page.test.ts`
- Generated: `src/components/manager/empty-state.default-markup.json`

**Interfaces:**
- Consumes: `IconTile`, `positionIcon`, `frozenMarkup` (Task 1).
- Produces: `ControlRow({ icon?: LucideIcon; title; href; status; meta?: ReactNode; progress?; attention?; next })` (the `facts` prop is replaced by `meta`); `EmptyState` prop `variant?: "card" | "page"`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/manager/control-row.test.ts` (add `Headset` to the lucide import):

```ts
describe("ControlRow in the mockup's look (screen 2)", () => {
  it("draws the role's tile, the meta line under the status, the attention as a quiet pill and the next step as an accent text action", () => {
    const out = renderToStaticMarkup(
      ControlRow({
        icon: Headset,
        title: "Destek Uzmanı · Ekim",
        href: "/hiring/openings/o1",
        status: "Taslak",
        meta: "Ekip: yalnız sen · Son tarih yok",
        attention: [{ key: "r", icon: Inbox, text: "2 açık talep" }],
        next: { label: "Sıradaki: Ekibi ata", href: "/hiring/openings/o1/settings#team-members" },
      }),
    );
    expect(out).toContain("lucide-headset");
    expect(out).toContain("bg-accent-soft text-accent");
    expect(out).toContain("Ekip: yalnız sen · Son tarih yok");
    expect(out).toMatch(/rounded-lg bg-secondary[^"]*">[\s\S]*?2 açık talep/);
    expect(out).toMatch(/<a[^>]*class="[^"]*font-semibold text-accent[^"]*"[^>]*>Sıradaki: Ekibi ata/);
    // No amber anywhere (globals.css).
    expect(out).not.toMatch(/amber|warn/);
  });
});
```

Append to `src/components/manager/empty-state.test.ts` (add `import { frozenMarkup } from "@/components/visual/frozen-markup";`):

```ts
describe("EmptyState's card look stays, the page look is the mockup's (screen 8)", () => {
  const CASES = [
    { illustration: "emptyOpenings", title: "İlk alımını aç.", body: "Bir cümle.", action: createElement("a", { href: "/hiring/openings/new" }, "Alım aç"), className: "mt-section" },
    { illustration: "emptyToday", title: "Bugün bekleyen iş yok." },
  ];
  const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(EmptyState as never, props as never));

  it("draws the card look exactly as before", () => {
    const now = CASES.map(html);
    expect(now).toEqual(frozenMarkup("src/components/manager/empty-state.default-markup.json", now));
  });

  it("page: no card, the big drawing, a 24px title and the sentence in ink-2", () => {
    const out = html({ variant: "page", illustration: "emptyOpenings", title: "İlk alımını aç.", body: "Bir cümle.", action: createElement("a", { href: "/x" }, "Alım aç") });
    expect(out).not.toContain("border border-line bg-surface py-14");
    expect(out).toContain("w-[380px] max-w-full");
    expect(out).toContain("mt-2 text-[24px] leading-8 font-semibold text-ink");
    expect(out).toContain("text-ink-2");
  });
});
```

In `src/app/(manager)/hiring/openings/page.test.ts`:

1. In the first test replace `expect(words).toContain("Kurulumda (1)");` by `expect(words).toContain("Kurulumda\n1");` and `expect(words).toContain("Yayında (1)");` by `expect(words).toContain("Yayında\n1");`.
2. Append inside `describe("the openings' control view page (4.4)", ...)`:

```ts
  it("draws each row with a role tile and the setup segments in the accent, without a column header row (mockup 2)", async () => {
    const html = await render();
    expect(html.match(/bg-accent-soft text-accent/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html.match(/h-\[5px\] w-\[26px\] rounded-\[3px\] bg-accent/g)).toHaveLength(2);
    expect(html).not.toContain("Son tarih</span>");
    expect(text(html)).toContain("Ekip: yalnız sen · Son tarih yok");
  });

  it("the empty list is the open page empty state with 'Alım aç' and its plus (mockup 8)", async () => {
    cockpit.value = { runs: true, drafts: [], open: [], closed: [] };
    const html = await render();
    expect(html).toContain("w-[380px] max-w-full");
    expect(html).not.toContain("border border-line bg-surface py-14");
    expect(html).toMatch(/<a[^>]*data-variant="primary"[^>]*><svg[^>]*lucide-plus/);
  });
```

- [ ] **Step 2: Capture, then see the new tests fail**

Run (before touching `empty-state.tsx`): `CAPTURE_MARKUP=1 pnpm exec vitest run src/components/manager/empty-state.test.ts`
Expected: "draws the card look exactly as before" PASSES and writes the JSON; the page-look test FAILS.

Run: `pnpm exec vitest run src/components/manager/control-row.test.ts "src/app/(manager)/hiring/openings/page.test.ts"`
Expected: the new and changed tests FAIL.

- [ ] **Step 3: Rewrite ControlRow**

```tsx
// src/components/manager/control-row.tsx
// kademe-owned
import { HashAwareLink } from "./hash-aware-link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "@/components/visual/icon-tile";

export type ControlAttention = { key: string; icon: LucideIcon; text: ReactNode; note?: ReactNode };

const ACTION =
  "inline-flex min-h-11 items-center gap-0.5 justify-self-start whitespace-nowrap text-[14px] font-semibold text-accent transition-colors duration-[120ms] ease-out hover:underline lg:justify-self-end";

/**
 * KG1 (K12) in the look of the manager mockup (screen 2): one object, one row,
 * one next step. The role's tile; the name (it opens the object), status as
 * dot and words and one meta line (team, last day); progress (a setup count
 * with segments, or the funnel line); what needs attention as quiet pills,
 * only when something does (no amber: globals.css); and one accent text
 * action at the right ("Sıradaki: Ekibi ata ›"). No filled button on a row:
 * the page's one filled button is its own work (KG5). Columns line up from
 * 1024px; below it the row stacks.
 */
export function ControlRow({
  icon,
  title,
  href,
  status,
  meta,
  progress,
  attention = [],
  next,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  href: string;
  status: ReactNode;
  meta?: ReactNode;
  progress?: ReactNode;
  attention?: ControlAttention[];
  next: { label: ReactNode; href: string } | null;
}) {
  return (
    <li className="grid items-center gap-x-[18px] gap-y-2 px-5 py-4 lg:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_auto]">
      {icon ? <IconTile icon={icon} className="hidden lg:grid" /> : <span className="hidden lg:block" />}
      <div className="min-w-0">
        <HashAwareLink href={href} className="text-[15px] leading-6 font-semibold text-ink hover:underline">
          {title}
        </HashAwareLink>
        <div className="mt-0.5 text-[13px] leading-5">{status}</div>
        {meta ? <div className="tnum mt-0.5 text-[13px] leading-5 text-muted">{meta}</div> : null}
      </div>
      <div className="min-w-0 text-[13px] leading-5 text-ink-2">{progress}</div>
      {/* KG4: the attention column says something only when something needs it (an empty list would still be announced). */}
      {attention.length ? (
        <ul className="min-w-0 space-y-1.5">
          {attention.map(({ key, icon: Icon, text, note }) => (
            <li key={key} className="text-[13px] leading-5 text-ink">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1">
                <Icon className="size-[15px] shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                {text}
              </span>
              {note ? <span className="mt-1 block text-muted">{note}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="hidden lg:block" />
      )}
      {next ? (
        <HashAwareLink href={next.href} className={ACTION}>
          {next.label}
          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
        </HashAwareLink>
      ) : (
        <span className="hidden lg:block" />
      )}
    </li>
  );
}
```

- [ ] **Step 4: Add the page look to EmptyState**

In `src/components/manager/empty-state.tsx` add the prop `variant = "card",` with type `variant?: "card" | "page";` and the doc line `"page" (manager mockup 8): no card, the drawing at 380px, a 24px title; the card look is unchanged.`, then change the body to:

```tsx
  const page = variant === "page";
  return (
    <Empty className={cn(page ? "mx-auto mt-[60px] max-w-[460px] border-0 bg-transparent p-0" : "border border-line bg-surface py-14", className)}>
      <Illustration name={illustration} size="spot" className={page ? "w-[380px] max-w-full" : undefined} />
      <EmptyHeader>
        <EmptyTitle role="heading" aria-level={2} className={page ? "mt-2 text-[24px] leading-8 font-semibold text-ink" : "text-[18px] leading-7 font-semibold text-ink"}>
          {title}
        </EmptyTitle>
        {body ? <EmptyDescription className={page ? "text-[14.5px] leading-[22px] text-ink-2" : "text-[14px] leading-[22px] text-muted"}>{body}</EmptyDescription> : null}
      </EmptyHeader>
      {action || secondary ? (
        <EmptyContent>
          {action}
          {secondary}
        </EmptyContent>
      ) : null}
    </Empty>
  );
```

- [ ] **Step 5: Add the group names**

`src/i18n/messages/hiring.tr.json`, `hiringOpenings`: add `"groupSetupName": "Kurulumda",` and `"groupLiveName": "Yayında",`. `src/i18n/messages/hiring.en.json`: add `"groupSetupName": "In setup",` and `"groupLiveName": "Live",`. Remove `groupSetup`, `groupLive`, `colName`, `colFunnel`, `colSetup`, `colAttention`, `colDeadline` from `hiringOpenings` in both files once `grep -rn "hiringOpenings.col\|hiringOpenings.groupSetup\"\|hiringOpenings.groupLive\"" src` shows only `openings/page.tsx` lines that this step removes (`libPositions.colName` and `libCompetencies.colName` are other namespaces and stay).

- [ ] **Step 6: Restyle the openings page**

In `src/app/(manager)/hiring/openings/page.tsx`:

1. Imports: `import { CalendarDays, Clock, FileText, Inbox, Plus, Users } from "lucide-react";`, `import { cockpitCounts, cockpitTab } from "@/components/hiring/opening-next-step";` (drop `funnelShare`), add `import { positionIcon } from "@/components/hiring/position-icon";`.
2. In `Row`, replace the `progress` expression with:

```tsx
  const progress =
    o.status === "CLOSED" ? null : o.status === "DRAFT" ? (
      row.setup ? (
        <>
          <p className="tnum">{t("hiringOverview.setupCount", { done: row.setup.done, total: row.setup.total })}</p>
          <span aria-hidden className="mt-1.5 flex gap-1">
            {Array.from({ length: row.setup.total }, (_, i) => (
              <span key={i} className={cn("h-[5px] w-[26px] rounded-[3px]", row.setup && i < row.setup.done ? "bg-accent" : "bg-line")} />
            ))}
          </span>
        </>
      ) : null
    ) : f && f.invited > 0 ? (
      <p className="tnum">{t("hiringOpenings.funnelLine", { invited: f.invited, started: f.started, completed: f.completed })}</p>
    ) : (
      <p className="text-muted">{t("hiringOpenings.funnelEmpty")}</p>
    );
```

3. Replace the `const facts = (...)` block with:

```tsx
  const meta = [team, o.deadlineAt ? t("hiringCommon.deadline", { date: shortDate(o.deadlineAt, locale) }) : t("hiringCommon.noDeadline")].join(" · ");
```

4. Replace the returned `<ControlRow ... />` with:

```tsx
  return (
    <ControlRow
      icon={positionIcon(o.positionName)}
      title={o.name}
      href={`/hiring/openings/${o.id}`}
      status={status}
      meta={meta}
      progress={progress}
      attention={attention}
      next={{ label, href: next.href }}
    />
  );
```

5. Replace `function Group(...)` with:

```tsx
function Group({ id, name, count, children }: { id: string; name: string; count: number; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2 id={`${id}-title`} className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.07em] text-muted uppercase">
        {name}
        <span className="tnum rounded-[10px] bg-secondary px-[7px] py-px tracking-normal text-ink-2">{count}</span>
      </h2>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-hairline">{children}</ul>
      </Card>
    </section>
  );
}
```

and the two uses with `<Group id="group-draft" name={t("hiringOpenings.groupSetupName")} count={drafts.length}>` and `<Group id="group-open" name={t("hiringOpenings.groupLiveName")} count={open.length}>`; in the closed card use `divide-hairline` as well.

6. `addButton`'s link: `<Link href="/hiring/openings/new"><Plus className="size-4" strokeWidth={2} aria-hidden />{t("hiringOpenings.add")}</Link>`.
7. Both `EmptyState` uses: drop `className="mt-section"` and add `variant="page"`.

- [ ] **Step 7: Run the tests**

Run: `pnpm exec vitest run src/components/manager/control-row.test.ts src/components/manager/empty-state.test.ts "src/app/(manager)/hiring/openings/page.test.ts" "src/app/(manager)/dashboard/page.test.ts" src/i18n/messages.test.ts`
Expected: PASS (Today's empty state still uses the card look).

- [ ] **Step 8: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/manager/control-row.tsx src/components/manager/control-row.test.ts src/components/manager/empty-state.tsx src/components/manager/empty-state.test.ts src/components/manager/empty-state.default-markup.json "src/app/(manager)/hiring/openings/page.tsx" "src/app/(manager)/hiring/openings/page.test.ts" src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Draw the openings' control rows and empty state in the mockup's look"
```

---

### Task 7: Draft overview, the setup path card (mockup screen 5)

The setup card gets the eyebrow "YAYINA HAZIRLIK", the count as a 22px heading ("Kurulum 2 / 5 · 3 adım kaldı."), the lead "Yayınlayınca adaylarını davet edebilirsin.", the `stage` drawing at the right, and the path rows in the setup look: 30px numbered circles, done in the accent with a check, the current row on accent-soft with its action at the right in the accent.

**Files:**
- Modify: `src/components/visual/path-steps.tsx`
- Modify: `src/app/(manager)/hiring/openings/[id]/page.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `src/i18n/messages/hiring.en.json` (namespace `hiringOverview`)
- Test: `src/components/visual/path-steps.test.ts` (create), `src/app/(manager)/hiring/openings/[id]/page.test.ts`
- Generated: `src/components/visual/path-steps.default-markup.json`

**Interfaces:**
- Consumes: `frozenMarkup` (Task 1).
- Produces: `PathSteps` prop `look?: "list" | "setup"` (default `"list"`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/visual/path-steps.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { frozenMarkup } from "./frozen-markup";
import { PathSteps } from "./path-steps";

const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(PathSteps as never, props as never));

/** The candidate side's paths and the panel's before the setup look (captured at the commit before Task 7). */
const CASES: Array<Record<string, unknown>> = [
  { label: "Yol", steps: [{ title: "Bir", state: "done" }, { title: "İki", state: "current", detail: "Ayrıntı", action: createElement("a", { href: "/x" }, "Git") }, { title: "Üç", state: "todo" }, { title: "Dört" }] },
  { locale: "en", steps: [{ title: "One", state: "done" }, { title: "Two", state: "current" }] },
];

describe("PathSteps", () => {
  it("draws the list look exactly as before", () => {
    const now = CASES.map(html);
    expect(now).toEqual(frozenMarkup("src/components/visual/path-steps.default-markup.json", now));
  });

  it("setup look: numbered 30px circles, done in the accent with a check, the current row on accent-soft with its action at the right (mockup 5)", () => {
    const out = html({ look: "setup", label: "Yayına hazırlık", steps: [{ title: "Değerlendirmeyi kur", state: "done", detail: "8 soru" }, { title: "Ekibi ata", state: "current", action: createElement("a", { href: "/t" }, "Ekibe ekle") }, { title: "Yayınla", state: "todo" }] });
    expect(out).toContain('<ol aria-label="Yayına hazırlık"');
    expect(out).toContain("border-accent bg-accent text-white");
    expect(out).toContain("lucide-check");
    expect(out).toMatch(/<li aria-current="step" class="[^"]*bg-accent-soft[^"]*">/);
    expect(out).toContain("border-accent bg-surface text-accent");
    expect(out).toMatch(/<div class="shrink-0"><a href="\/t">Ekibe ekle<\/a><\/div><\/li>/);
    expect(out).toContain('<span class="sr-only">tamamlandı</span>');
    expect(out).toContain('<span class="sr-only">sırada</span>');
  });
});
```

Append to `src/app/(manager)/hiring/openings/[id]/page.test.ts`, inside `describe("a draft's control view and its setup path (4.5, H7)", ...)` (add `import { Illustration } from "@/components/visual/illustrations";` and `SETUP_HEADING_ID` to the existing import from `./publish-view`, or a new `import { SETUP_HEADING_ID } from "./publish-view";` if it has none):

```ts
  it("draws the setup card as the mockup's: the count as the heading, the lead, the stage drawing and the path in the setup look (mockup 5)", async () => {
    const page = await render();
    const [path] = find(page, ofType(PathSteps));
    expect(path.props.look).toBe("setup");
    expect(find(page, (el) => el.type === Illustration && el.props.name === "stage")).toHaveLength(1);
    const [heading] = find(page, (el) => el.props.id === SETUP_HEADING_ID);
    expect(text(heading)).toBe("Kurulum 3 / 5 · 2 adım kaldı.");
    expect(text(page)).toContain("Yayınlayınca adaylarını davet edebilirsin.");
  });
```

- [ ] **Step 2: Capture, then see the new tests fail**

Run (before touching `path-steps.tsx`): `CAPTURE_MARKUP=1 pnpm exec vitest run src/components/visual/path-steps.test.ts`
Expected: "draws the list look exactly as before" PASSES and writes the JSON; the setup-look test FAILS.

Run: `pnpm exec vitest run "src/app/(manager)/hiring/openings/[id]/page.test.ts"`
Expected: the new test FAILS (`look` undefined).

- [ ] **Step 3: Add the setup look to PathSteps**

In `src/components/visual/path-steps.tsx` add the prop `look = "list",` with type `look?: "list" | "setup";` and the doc line `"setup" (manager mockup 5): the draft's setup card, full-width rows with the action at the right; "list" is unchanged.`, then as the first statement after `const words = STATE_WORDS[locale];` add:

```tsx
  if (look === "setup") {
    return (
      <ol aria-label={label} className="border-t border-hairline">
        {steps.map((step, i) => {
          const done = step.state === "done";
          const current = step.state === "current";
          return (
            <li key={i} aria-current={current ? "step" : undefined} className={cn("flex items-center gap-4 border-b border-hairline px-6 py-3.5 last:border-b-0", current && "bg-accent-soft")}>
              <span
                aria-hidden
                className={cn(
                  "tnum grid size-[30px] shrink-0 place-items-center rounded-full border-[1.5px] text-[13px] font-semibold",
                  done ? "border-accent bg-accent text-white" : current ? "border-accent bg-surface text-accent shadow-[0_0_0_4px_rgb(14_106_87/0.1)]" : "border-line-strong text-muted",
                )}
              >
                {done ? <Check className="size-4" strokeWidth={2} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[15px] leading-[22px] font-semibold", done ? "text-ink-2" : "text-ink")}>
                  {step.title}
                  {step.state === "done" || step.state === "todo" ? (
                    <>
                      {" "}
                      <span className="sr-only">{words[step.state]}</span>
                    </>
                  ) : null}
                </p>
                {step.detail ? <p className="text-[13px] leading-5 text-muted">{step.detail}</p> : null}
              </div>
              {step.action ? <div className="shrink-0">{step.action}</div> : null}
            </li>
          );
        })}
      </ol>
    );
  }
```

- [ ] **Step 4: Add the lead**

`src/i18n/messages/hiring.tr.json`, `hiringOverview`: `"setupLead": "Yayınlayınca adaylarını davet edebilirsin.",`. `src/i18n/messages/hiring.en.json`: `"setupLead": "Once it is live you can invite your candidates.",`.

- [ ] **Step 5: Redraw the setup card**

In `src/app/(manager)/hiring/openings/[id]/page.tsx`:

1. Add `import { Illustration } from "@/components/visual/illustrations";` and below `TEXT_ACTION`:

```tsx
/** Manager mockup 5: the current setup step's way on, in the accent. */
const PATH_ACTION = "inline-flex min-h-11 items-center gap-0.5 whitespace-nowrap text-[14px] font-semibold text-accent hover:underline";
```

2. In `pathSteps`, use `className={PATH_ACTION}` on the `HashAwareLink` of a current step and on the `PublishLink` of the publish step; the "Atla" `Link` keeps `TEXT_ACTION`.
3. Replace the whole `{state.draft ? ( <Card className="p-card"> <SetupFocusArea> ... </SetupFocusArea> </Card> ) : null}` block with:

```tsx
          {state.draft ? (
            <Card className="overflow-hidden">
              <SetupFocusArea>
                <div className="flex items-center justify-between gap-6 px-6 pt-5 pb-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{t("hiringOverview.readinessTitle")}</p>
                    {/* Where the focus lands back from the publish summary or after a path action goes away (W10). */}
                    <h2 id={SETUP_HEADING_ID} tabIndex={-1} className="tnum mt-1 text-[22px] leading-8 font-semibold text-ink outline-none">
                      {setupRows.length
                        ? `${t("hiringOverview.setupCount", { done: progress.done, total: progress.total })} · ${t("hiringOverview.setupLeft", { count: progress.left })}`
                        : t("hiringOverview.draftPending", { number: state.draft.number })}
                    </h2>
                    <p className="mt-1 text-[14.5px] leading-[22px] text-ink-2">{t("hiringOverview.setupLead")}</p>
                    {setupRows.length ? <p className="tnum mt-0.5 text-[13px] text-muted">{t("hiringOverview.draftPending", { number: state.draft.number })}</p> : null}
                  </div>
                  <Illustration name="stage" size="spot" className="hidden w-[200px] md:block" />
                </div>
                {setupRows.length ? <PathSteps look="setup" steps={pathSteps} label={t("hiringOverview.readinessTitle")} locale={locale} /> : null}
              </SetupFocusArea>
            </Card>
          ) : null}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm exec vitest run src/components/visual/path-steps.test.ts src/components/visual/blocks.test.ts "src/app/(manager)/hiring/openings/[id]/page.test.ts" src/i18n/messages.test.ts`
Expected: PASS (the existing tests still find "Yayına hazırlık", "Kurulum 3 / 5", "2 adım kaldı.", the step states and actions).

- [ ] **Step 7: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/visual/path-steps.tsx src/components/visual/path-steps.test.ts src/components/visual/path-steps.default-markup.json "src/app/(manager)/hiring/openings/[id]/page.tsx" "src/app/(manager)/hiring/openings/[id]/page.test.ts" src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Draw a draft's setup path as the mockup's numbered card"
```

---

### Task 8: Team and rules flows, people as big cards (mockup screen 6)

The team flow's people cards (members, decider, backup) and the two-choice cards (deadline, blind mode, survey) use the panel look; the members step gets the `emptyCandidates` drawing and a live line "2 kişi seçili, kural 2 istiyor." (with a check once the rule is met). The 1-5 square cards of "Her adayı kaç kişi değerlendirsin?" keep their look. Values, waits, the problem-to-step map and `saveOpeningRulesAction` are unchanged.

**Files:**
- Modify: `src/components/hiring/opening-settings-form.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `src/i18n/messages/hiring.en.json` (namespace `hiringSettings`)
- Test: `src/components/hiring/opening-settings-form.test.ts`

**Interfaces:**
- Consumes: `ChoiceCardGroup look="panel"` (Task 1), `FlowStep.illustration` (Task 2).

- [ ] **Step 1: Write the failing tests**

Append to `src/components/hiring/opening-settings-form.test.ts`:

```ts
describe("the team flow in the mockup's look (screen 6)", () => {
  it("#team-members: the drawing above the question, people as big cards with round initials and a checkbox at the right, and the count against the rule", () => {
    const out = render({ hash: "#team-members" });
    // emptyCandidates' shadow ellipse.
    expect(out).toContain('ellipse cx="80" cy="104" rx="42" ry="5"');
    expect(out).toMatch(/rounded-full bg-accent-soft font-bold text-accent[^"]*">KA</);
    expect(out).toContain("peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white");
    expect(out).toMatch(/<p aria-live="polite" class="text-\[14px\] text-ink">1 kişi seçili, kural 2 istiyor\.<\/p>/);
  });

  it("says the count with a check once the team meets the rule", () => {
    const out = render({ hash: "#team-members", values: { memberIds: ["owner", "rev"] } });
    expect(out).toMatch(/<p aria-live="polite" class="flex items-center gap-1\.5 text-\[14px\] text-accent"><svg[^>]*lucide-check[\s\S]*?2 kişi seçili, kural 2 istiyor\.<\/p>/);
  });

  it("#team-decider: the deciders as big radio cards; the 1-5 cards keep their square look", () => {
    expect(render({ hash: "#team-decider" })).toContain("rounded-full peer-checked:border-[6px] peer-checked:border-accent");
    const min = render({ hash: "#team-min" });
    expect(min).toContain("min-h-16");
    expect(min).not.toContain("peer-checked:border-[6px]");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run src/components/hiring/opening-settings-form.test.ts`
Expected: the three new tests FAIL; the existing ones PASS.

- [ ] **Step 3: Add the count line copy**

`src/i18n/messages/hiring.tr.json`, `hiringSettings`: `"membersCount": "{count} kişi seçili, kural {min} istiyor.",`. `src/i18n/messages/hiring.en.json`: `"membersCount": "{count} selected, the rule asks for {min}.",`.

- [ ] **Step 4: Use the panel look**

In `src/components/hiring/opening-settings-form.tsx`:

1. Lucide import: `import { CalendarDays, Check, EyeOff, Lock, Tag, Users } from "lucide-react";`.
2. Add `look="panel"` to every `ChoiceCardGroup` of the flows except the one with `size="square"` (the `"team-min"` step): the members group (`name="rules-members"`), the decider and backup groups (`name="rules-decider"` and the backup one under it), the deadline group (`"contact-deadline"`), the blind group (`"fair-blind"`) and the survey group (`"fair-survey"`).
3. Replace the `"team-members"` entry with:

```tsx
    "team-members": () => ({
      id: "team-members",
      title: t("stepMembersTitle"),
      lead: <p>{t("membersHint")}</p>,
      layout: "split",
      illustration: "emptyCandidates",
      primary: forward,
      note,
      body: (
        <div className="space-y-3">
          <ChoiceCardGroup
            type="multi"
            name="rules-members"
            look="panel"
            value={value.memberIds}
            onChange={(ids) => set("memberIds", ids)}
            // A disabled person can be taken off the panel but not put back on it.
            items={panel.map((u) => personCard(u, u.disabled && !value.memberIds.includes(u.id)))}
          />
          {/* Mockup 6: who is chosen against the rule, said politely as it changes. */}
          {activeReviewers >= value.minEvaluations ? (
            <p aria-live="polite" className="flex items-center gap-1.5 text-[14px] text-accent">
              <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              {t("membersCount", { count: activeReviewers, min: value.minEvaluations })}
            </p>
          ) : (
            <p aria-live="polite" className="text-[14px] text-ink">
              {t("membersCount", { count: activeReviewers, min: value.minEvaluations })}
            </p>
          )}
        </div>
      ),
    }),
```

- [ ] **Step 5: Run the tests**

Run: `pnpm exec vitest run src/components/hiring/opening-settings-form.test.ts src/i18n/messages.test.ts`
Expected: PASS.

- [ ] **Step 6: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/hiring/opening-settings-form.tsx src/components/hiring/opening-settings-form.test.ts src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Show the team flow's people as big cards with the count against the rule"
```

---

### Task 9: Aday davet et, the ready view (mockup screen 7)

The single-candidate ready view (Sheet and `/hiring/invite`) becomes: the `inviteReady` drawing, "Elif Kaya için link hazır", the once-only note as its sentence, the link in a monospace box, the language and last day with icons, the ready message behind its disclosure, and one row at the bottom: "Başka aday davet et" (with `UserPlus`), "Adaylara git", "Kapat" (Sheet only) as text, and the one filled "Linki kopyala" (with `Copy`) at the right. The list ready view (many) is not changed. `inviteCandidateAction`, `sheetLocked` and the flow's steps are unchanged.

**Files:**
- Create: `src/components/hiring/invite/invite-ready.tsx`
- Modify: `src/components/hiring/invite/copy-field.tsx`
- Modify: `src/components/hiring/invite/invite-form.tsx`
- Modify: `src/i18n/messages/hiring.tr.json`, `src/i18n/messages/hiring.en.json` (namespace `hiringInvite`)
- Test: `src/components/hiring/invite/invite-ready.test.ts` (create)

**Interfaces:**
- Consumes: `StepScreen`, `Illustration`, `Disclosure`, `CopyField`.
- Produces: `useCopyValue(id: string, value: string): { copied: boolean; copy(): Promise<void> }`; `InviteReady({ container: "page" | "sheet"; headingRef: Ref<HTMLHeadingElement>; name: string; url: string; expires: string; language: string; message: string; onAnother(): void; links?: ReactNode })`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/hiring/invite/invite-ready.test.ts
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";
import { InviteReady } from "./invite-ready";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;
const noop = () => undefined;

const render = (props: Record<string, unknown> = {}, locale: "tr" | "en" = "tr") =>
  renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: managerMessagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(InviteReady as never, {
        container: "sheet",
        headingRef: { current: null },
        name: "Elif Kaya",
        url: "https://kademe.app/a/BhLlRdoH",
        expires: "20 Eki",
        language: "Türkçe",
        message: "Merhaba Elif",
        onAnother: noop,
        links: createElement("a", { href: "/hiring/openings/o1/candidates" }, "Adaylara git"),
        ...props,
      } as never),
    ),
  );
const primary = (out: string) => out.match(/<button[^>]*data-variant="primary"[\s\S]*?<\/button>/g) ?? [];

describe("the invite's ready view (mockup 7)", () => {
  it("in the Sheet: the drawing, '<name> için link hazır', the once-only note, the link, its language and last day, and one filled 'Linki kopyala'", () => {
    const out = render();
    // inviteReady's tint circle.
    expect(out).toContain('cx="26" cy="26" r="9"');
    expect(out).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Elif Kaya için link hazır<\/h2>/);
    expect(out).toContain("Bu link bir daha gösterilmez; kapatmadan önce kopyala.");
    expect(out).toMatch(/<input id="invite-link" readonly="" value="https:\/\/kademe\.app\/a\/BhLlRdoH"[^>]*font-mono/);
    expect(out).toContain("lucide-languages");
    expect(out).toContain("Türkçe");
    expect(out).toContain("lucide-calendar");
    expect(out).toContain("Son tarih 20 Eki");
    expect(out).toContain("Hazır mesajı gör");
    const filled = primary(out);
    expect(filled).toHaveLength(1);
    expect(filled[0]).toContain("lucide-copy");
    expect(filled[0].replace(/<[^>]+>/g, "")).toBe("Linki kopyala");
    expect(out).toContain("lucide-user-plus");
    expect(out).toContain("Başka aday davet et");
    expect(out).toContain('href="/hiring/openings/o1/candidates"');
  });

  it("on the page: the same parts under the page's h1", () => {
    const out = render({ container: "page" });
    expect(out).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Elif Kaya için link hazır<\/h1>/);
    expect(primary(out)).toHaveLength(1);
  });

  it("speaks English", () => {
    const out = render({ language: "English" }, "en");
    expect(out).toContain("The link for Elif Kaya is ready");
    expect(out).toContain("Copy the link");
  });
});
```

Before relying on the last expectation, read `hiringInvite.copyLink` in `src/i18n/messages/hiring.en.json` and use its exact value in the test if it is not "Copy the link".

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run src/components/hiring/invite/invite-ready.test.ts`
Expected: FAIL, cannot resolve `./invite-ready`.

- [ ] **Step 3: Extract the copy hook**

In `src/components/hiring/invite/copy-field.tsx`, move the state, the timer, the effect and `copy()` into an exported hook and use it in `CopyField` (the markup does not change):

```tsx
/**
 * HIRING-UX 5.11: copies `value`; "Kopyalandı" for two seconds. Where the
 * clipboard is refused, the field `id` is focused and selected so the manager
 * can copy it by hand.
 */
export function useCopyValue(id: string, value: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => (timer.current ? window.clearTimeout(timer.current) : undefined), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
      field?.focus();
      field?.select();
    }
  }
  return { copied, copy };
}
```

and in `CopyField` replace the moved lines with `const { copied, copy } = useCopyValue(id, value);`.

- [ ] **Step 4: Add the title copy**

`src/i18n/messages/hiring.tr.json`, `hiringInvite`: `"readyFor": "{name} için link hazır",`. `src/i18n/messages/hiring.en.json`: `"readyFor": "The link for {name} is ready",`. After Step 6 remove `readyTitle` and `readyBody` from `hiringInvite` in both files if `grep -rn "readyTitle\|readyBody" src | grep -v i18n/messages` prints nothing.

- [ ] **Step 5: Write InviteReady**

```tsx
// src/components/hiring/invite/invite-ready.tsx
"use client";

import { Calendar, Copy, Languages, UserPlus } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/visual/disclosure";
import { Illustration } from "@/components/visual/illustrations";
import { StepScreen } from "@/components/visual/step-screen";
import { useMT } from "@/i18n/manager-client";
import { CopyField, useCopyValue } from "./copy-field";

const TEXT_ACTION = "inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";

/**
 * 4.9 in the look of the manager mockup (screen 7): one of the panel's two
 * success moments. The drawing, "<name> için link hazır", the once-only note
 * (full text, it matters), the link once in a monospace box, its language and
 * last day, the ready message behind its disclosure, and one row: "Başka aday
 * davet et" and the caller's links as text, the one filled "Linki kopyala" at
 * the right. Copying works as CopyField's (useCopyValue).
 */
export function InviteReady({
  container,
  headingRef,
  name,
  url,
  expires,
  language,
  message,
  onAnother,
  links,
}: {
  container: "page" | "sheet";
  headingRef: Ref<HTMLHeadingElement>;
  name: string;
  url: string;
  expires: string;
  language: string;
  message: string;
  onAnother(): void;
  links?: ReactNode;
}) {
  const t = useMT("hiringInvite");
  const common = useMT("hiringCommon");
  const { copied, copy } = useCopyValue("invite-link", url);
  const body = (
    <div className="space-y-4">
      <div>
        <label htmlFor="invite-link" className="sr-only">
          {t("linkLabel")}
        </label>
        <input
          id="invite-link"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-12 w-full rounded-[10px] border border-line bg-paper px-3.5 font-mono text-[13px] text-ink"
        />
      </div>
      <p className="tnum flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <Languages className="size-[15px]" strokeWidth={1.75} aria-hidden />
          {language}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-[15px]" strokeWidth={1.75} aria-hidden />
          {common("deadline", { date: expires })}
        </span>
      </p>
      <Disclosure label={t("showMessage")}>
        <CopyField id="invite-message" label={t("messageLabel")} value={message} multiline copyLabel={t("copyMessage")} />
      </Disclosure>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-hairline pt-4">
        <button type="button" onClick={onAnother} className={TEXT_ACTION}>
          <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
          {t("another")}
        </button>
        {links}
        <Button variant="primary" className="ml-auto" onClick={copy}>
          <Copy className="size-4" strokeWidth={1.75} aria-hidden />
          {copied ? t("copied") : t("copyLink")}
        </Button>
      </div>
      <span role="status" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
  if (container === "page") {
    return (
      <StepScreen layout="single" width={640} illustration="inviteReady" illustrationSize="spot" title={t("readyFor", { name })} titleRef={headingRef} lead={<p>{t("onceNote")}</p>}>
        {body}
      </StepScreen>
    );
  }
  return (
    <div className="space-y-4 pt-2 pb-8">
      <Illustration name="inviteReady" size="small" className="w-full max-w-[320px]" />
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-[24px] leading-8 font-semibold text-ink outline-none">
          {t("readyFor", { name })}
        </h2>
        <p className="mt-1.5 text-[14.5px] leading-[22px] text-ink-2">{t("onceNote")}</p>
      </div>
      {body}
    </div>
  );
}
```

- [ ] **Step 6: Use it in the invite form**

In `src/components/hiring/invite/invite-form.tsx`:

1. Add `import { InviteReady } from "./invite-ready";`.
2. Replace the whole `if (done?.kind === "one") { ... }` block with:

```tsx
  if (done?.kind === "one") {
    return (
      <InviteReady
        container={container}
        headingRef={doneHeading}
        name={done.result.name}
        url={done.result.url}
        expires={done.result.expires}
        language={t(locale)}
        message={done.result.message.body}
        onAnother={reset}
        links={
          <>
            {toCandidates}
            {onDone ? (
              <button type="button" onClick={onDone} className={`min-h-11 text-[14px] font-medium text-ink ${LINK}`}>
                {t("close")}
              </button>
            ) : null}
          </>
        }
      />
    );
  }
```

3. Remove the imports that are now unused (`Illustration`, `StepScreen` if the many view does not use them; ESLint names them). `after` stays for the list ready view.

- [ ] **Step 7: Run the tests**

Run: `pnpm exec vitest run src/components/hiring/invite/invite-ready.test.ts src/components/hiring/invite/invite-form.test.ts src/components/hiring/invite/form-rules.test.ts src/i18n/messages.test.ts`
Expected: PASS.

- [ ] **Step 8: Gates**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/hiring/invite/invite-ready.tsx src/components/hiring/invite/invite-ready.test.ts src/components/hiring/invite/copy-field.tsx src/components/hiring/invite/invite-form.tsx src/i18n/messages/hiring.tr.json src/i18n/messages/hiring.en.json
git commit -m "Show the invite's ready link as the mockup's success moment"
```

---

### Task 10: Full gates and the browser check in the user's Chrome

**Files:**
- No code change unless a check fails (then fix in the task that owns the file, with its test, and commit there).

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all test files PASS. Copy the summary line (files and tests passed) into the hand-off.

- [ ] **Step 2: Type, lint, build**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm build`
Expected: no errors; the build finishes (it runs `prebuild`, which fetches the proctor assets).

- [ ] **Step 3: Less-AI and no-template sweep**

Run: `grep -rn "Sparkles\|Önerilen\|Hazır şablon" src/components/hiring src/app/\(manager\)/hiring src/i18n/messages/hiring.*.json`
Expected: no match.

- [ ] **Step 4: Browser check (Claude in Chrome only, never Playwright)**

Load the tools in one call: ToolSearch `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__read_console_messages`.

Start the app the way this repository runs locally (port 3100, Postgres on 5434; `pnpm exec next dev -p 3100`), sign in as an owner. Open the mockup in a second tab: `file:///Users/sucreistaken/Desktop/Projects/recruitement/docs/design/hiring-manager-mockup.html`. Do every row below at **1440x900**, then again at **1280x800** (`resize_window`), and take a screenshot of each app screen next to the mockup frame it names. Record pass or the exact difference; a difference is a finding, not a fix in this step.

| # | Mockup frame | App address and state | Check |
|---|---|---|---|
| 1 | 1 · Bugün | `/dashboard` with an accommodation request and at least one attention row | Next-task card: drawing left, eyebrow "SIRADAKİ İŞ · İŞE ALIM", 22px title, filled "Talebe bak" under the text; attention rows: 40px soft green tiles, grey solution chip, underlined "Aç ›"; "Tüm alımların durumu →"; the exam's review queue looks exactly as before; one filled button on the screen |
| 2 | 2 · Alımlar | `/hiring/openings` with one draft and one live opening | Group headings uppercase with a count pill; rows: role tile, name, dot status, meta line, setup segments in green, quiet attention pills (no amber), green "Sıradaki: … ›" at the right; one filled "+ Alım aç"; no column header row |
| 3 | 3 · Alım aç, adım 1 | `/hiring/openings/new` | Drawing above "Hangi pozisyon için?"; position cards 40px tiles, radio at the right, the chosen one green with a soft ring; dashed "Yeni bir pozisyon" opens the name field; with more than six positions a search field above; footer "‹ Alımlara dön", "Adım 1 / n", "Devam et" |
| 4 | 4 · Alım aç, adım 3 | `/hiring/openings/new#start` after choosing a library position with a job ad | Lead "Sonra her şeyi değiştirebilirsin."; green summary pill with a check; three big cards in the order copy, "İlan metninden öneri al", "Boş başla", 52px tiles, file-text icon, no sparkles, no badge, no "Hazır şablondan başla"; the chosen card's tile turns white; one filled "Alımı oluştur" |
| 5 | 5 · Taslak alım | `/hiring/openings/<draft id>` | Setup card: eyebrow, "Kurulum n / N · k adım kaldı." heading, lead, stage drawing at the right; rows with 30px circles, done green with check, current row light green with its green action at the right; filled "Kuruluma devam et" in the header |
| 6 | 6 · Ekip akışı | `/hiring/openings/<id>/settings#team-members` | Drawing above "Kim değerlendirecek?"; people as big cards with round initials and a checkbox at the right; "n kişi seçili, kural m istiyor." (green with a check once met); "Devam et" |
| 7 | 7 · Davet hazır | "Aday davet et" Sheet on a live opening, create one link | Drawing, "<ad> için link hazır", once-only note, monospace link box, language and last day with icons, "Hazır mesajı gör", bottom row "Başka aday davet et" / "Adaylara git" / "Kapat" as text and one filled "Linki kopyala" with a copy icon; Escape does not close while the link shows |
| 8 | 8 · Boş durum | `/hiring/openings` in an organisation with no opening | No card, big drawing, "İlk alımını aç.", the sentence, filled "+ Alım aç" |

Also check at both sizes: the browser console has no new error (`read_console_messages`), keyboard focus is visible on the cards (Tab, arrow keys on the radio cards, Space on the checkbox cards), and the checked styles that use `group-has-[:checked]/choice` and `peer-checked` really apply (the big start card's tile turns white; the checkbox mark fills green).

- [ ] **Step 5: Hand-off**

Write in the hand-off: the `pnpm test` summary line, the build result, each table row's pass or difference at both sizes with the screenshot names, and what was not checked live. Do not claim a screen matches without its screenshot.

---

## Self-review

**Spec coverage (mockup screens):**
- 1 Bugün: Task 5 (next task card, attention tiles and chips, overview link). Header greeting "Günaydın Kadir" is not taken (see below).
- 2 Alımlar: Task 6 (tiles, meta line, segments, pills, accent action, count pills, "+ Alım aç").
- 3 Alım aç adım 1: Task 3 (cards, dashed new card, drawing) on Task 1 and 2 primitives.
- 4 Alım aç adım 3: Task 4 (big cards from data, less AI, lead, summary pill); the template card is excluded on purpose.
- 4b: out of scope (later plan), not built.
- 5 Taslak kurulum yolu: Task 7.
- 6 Ekip akışı: Task 8.
- 7 Davet hazır: Task 9.
- 8 Boş durum: Task 6.
- Browser check at 1440x900 and 1280x800 in Chrome: Task 10.
- Shared-file safety: frozen default markup for `ChoiceCardGroup` (Task 1), `StepScreen` (Task 2), `EmptyState` (Task 6), `PathSteps` (Task 7); the exam's Today rows by the existing `dashboard/page.test.ts` block (Task 5).

**Placeholder scan:** every code step carries its code; every test step its test code and command. The two "check before removing a key" steps name the exact grep.

**Type consistency:** `look` values `"default" | "panel" | "panel-lg"` (ChoiceCardGroup) and `"list" | "setup"` (PathSteps) are used with those names in Tasks 3, 4, 7, 8; `illustrationSize="flow"` (Task 2) matches `SIZE.flow`; `FlowStep.illustration` / `FlowStep.aside` (Task 2) are used in Tasks 3, 4, 8; `StartValue` (Task 4) replaces the form's local `Start`; `ControlRow` loses `facts` and gains `meta` (Task 6, its only caller is the openings page); `useCopyValue` (Task 9) is used by `CopyField` and `InviteReady`.

**Where the mockup is not matched without changing behaviour (decided here, for the user to confirm):**
- The warm (amber) clock tile and warm attention pills are drawn neutral: `globals.css` forbids amber.
- "Günaydın Kadir" is not used as Today's title: a time-of-day greeting needs the viewer's clock on a server page, and the exam's Today test pins the head ("Bugün").
- The job-ad start stays pre-selected when there is an ad (the existing rule); only its place (second), name, icon and badge change. Pre-selecting "Boş başla" instead would be a behaviour change for the user to decide.
- The mockup's footer says "Adım 1 / 4" because of the template step; the app says "Adım 1 / 2" or "1 / 3" until the template plan.
- "Ekibe yeni biri" (invite a new user from the team flow) is not added: it leaves the flow and drops unsaved values; it needs its own design.
- The live rows keep the funnel as one text line ("9 davet · 8 başladı · 8 tamamladı") instead of bold numbers with chevrons, and drop the grey bar.
- The opening row no longer prints the position name under the opening name (the mockup does not); the role tile stands for it.
- The Sheet's ready drawing is capped at 320px (the mockup lets the 96x96 drawing fill the 424px column, which would push "Linki kopyala" below the fold at 1280x800).
- Drawings now appear on the Today card, the position and team steps and the setup card; v4 section 4 allowed them only on empty states and the two success moments. The mockup wins on look.
- The accent now colours icon tiles, chosen cards, setup markers, setup segments and row actions; `globals.css` limited it to three places. Recorded as the user's decision in the token comment (Task 1).
- The flow header stays the existing thin bar (not the mockup's full-bleed paper band); the panel's page header and route tabs are not restyled, because `PanelHeader` is shared with the exam's pages.

## Controller rulings (2026-10-06)

- R1 (user: "daha az AI"): on the start step nothing is preselected, also when the position has a job ad. "Devam et" waits with the step's existing reason until the manager picks. This replaces the plan's "AI stays preselected" note in Task 4.
- R2: the other mockup deviations listed above are accepted as written (no amber, "Bugün" title, step counts without the template step, no "Ekibe yeni biri" card, funnel as one line, sheet drawing capped at 320px, PanelHeader untouched).
