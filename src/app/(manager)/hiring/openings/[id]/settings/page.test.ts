import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { ORG_TIMEZONE, orgDay } from "@/lib/org-timezone";
import { deadlineToDate } from "@/solutions/hiring/rules/opening-rules";

/**
 * The team and rules page (Task 20, carries 4 and 6): who sees it, who changes
 * it, what a closed opening offers, and the organisation's day for "today" and
 * the deadline (carry 1).
 */
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

const OPENING = "33333333-3333-4333-8333-333333333333";
const OWNER = "55555555-5555-4555-8555-555555555555";
const MANAGER = "66666666-6666-4666-8666-666666666666";
const REVIEWER = "77777777-7777-4777-8777-777777777777";
const OUTSIDER = "88888888-8888-4888-8888-888888888888";
const GONE = "99999999-9999-4999-8999-999999999999";

type Role = "OWNER" | "MANAGER" | "REVIEWER";
let viewer: { role: Role; view: boolean; edit: boolean };
let status: "DRAFT" | "OPEN" | "CLOSED";
const DEADLINE = deadlineToDate("2026-10-31");
const openingFor = vi.fn(async (id: string, need: "view" | "edit") => {
  if (!viewer.view) throw new Error("notFound");
  return {
    user: { id: viewer.role === "REVIEWER" ? REVIEWER : OWNER, orgId: "o1", email: "", name: "", role: viewer.role },
    opening: {
      id,
      name: "Tasarımcı · Ekim",
      positionName: "Tasarımcı",
      status,
      memberIds: [REVIEWER, GONE],
      decisionMakerId: OWNER,
      backupDecisionMakerId: null,
      minEvaluations: 2,
      blindMode: true,
      deadlineAt: DEADLINE,
      feedbackDays: 10,
      candidateContactEmail: null,
      updatedAt: new Date(),
    },
    access: { view: viewer.view, edit: viewer.edit },
    need,
  };
});
vi.mock("../access", () => ({ openingFor: (id: string, need: "view" | "edit") => openingFor(id, need) }));
vi.mock("../opening-header", () => ({ OpeningHeader: function OpeningHeader() {} }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "tr" }));
vi.mock("@/server/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/settings")>()),
  loadPanelUsers: async () => [
    { id: OWNER, name: "Sahip", email: "o@x.test", role: "OWNER", lastLoginAt: null, disabledAt: null },
    { id: MANAGER, name: "Yönetici", email: "m@x.test", role: "MANAGER", lastLoginAt: null, disabledAt: null },
    { id: REVIEWER, name: "Değerlendirici", email: "r@x.test", role: "REVIEWER", lastLoginAt: null, disabledAt: null },
    { id: OUTSIDER, name: "Başka", email: "b@x.test", role: "REVIEWER", lastLoginAt: null, disabledAt: null },
    { id: GONE, name: "Ayrıldı", email: "g@x.test", role: "MANAGER", lastLoginAt: null, disabledAt: new Date("2026-01-01T00:00:00Z") },
  ],
}));
vi.mock("@/components/hiring/opening-settings-form", () => ({ OpeningSettingsForm: function OpeningSettingsForm() {} }));
vi.mock("@/components/ui/undo-strip", () => ({ UndoStrip: function UndoStrip() {} }));
vi.mock("./actions", () => ({ closeOpeningAction: async function closeOpeningAction() {}, reopenOpeningAction: async function reopenOpeningAction() {} }));

import SettingsPage from "./page";
import { OpeningSettingsForm } from "@/components/hiring/opening-settings-form";
import { UndoStrip } from "@/components/ui/undo-strip";
import { OpeningHeader } from "../opening-header";
import { closeOpeningAction, reopenOpeningAction } from "./actions";

function find(node: ReactNode, match: (el: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, match));
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return [...(match(element) ? [element] : []), ...find(element.props?.children, match)];
}
const ofType = (type: unknown) => (el: ReactElement) => el.type === type;
const forms = (page: ReactNode, action: unknown) => find(page, (el) => el.type === "form" && el.props.action === action);
const text = (node: ReactNode): string =>
  !node || typeof node === "boolean"
    ? ""
    : typeof node === "string" || typeof node === "number"
      ? String(node)
      : Array.isArray(node)
        ? node.map(text).join("")
        : text((node as ReactElement<{ children?: ReactNode }>).props?.children);

async function render(sp: Record<string, string> = {}) {
  return (await SettingsPage({ params: Promise.resolve({ id: OPENING }), searchParams: Promise.resolve(sp) })) as ReactElement;
}
const formProps = (page: ReactNode) => {
  const found = find(page, ofType(OpeningSettingsForm));
  expect(found).toHaveLength(1);
  return found[0].props as Record<string, unknown> & { users: Array<{ id: string; disabled: boolean }>; initial: Record<string, unknown> };
};

beforeEach(() => {
  viewer = { role: "OWNER", view: true, edit: true };
  status = "DRAFT";
  openingFor.mockClear();
});

describe("team and rules page", () => {
  it("asks only to see the opening, and is the header's settings tab", async () => {
    const page = await render();
    expect(openingFor).toHaveBeenCalledWith(OPENING, "view");
    expect(find(page, ofType(OpeningHeader))[0].props).toMatchObject({ active: "settings" });
  });

  it("an owner or manager edits: the whole organisation to choose from, today and the deadline in the organisation's zone, and 'Alımı kapat'", async () => {
    for (const role of ["OWNER", "MANAGER"] as const) {
      viewer = { role, view: true, edit: true };
      const page = await render();
      const props = formProps(page);
      expect(props).toMatchObject({ canEdit: true, closed: false, today: orgDay(), zone: ORG_TIMEZONE });
      expect(props.users.map((u) => u.id)).toEqual([OWNER, MANAGER, REVIEWER, OUTSIDER, GONE]);
      expect(props.users.find((u) => u.id === GONE)?.disabled).toBe(true);
      expect(JSON.stringify(props.users)).not.toContain("@x.test");
      expect(props.initial).toMatchObject({ deadline: "2026-10-31", memberIds: [REVIEWER, GONE], decisionMakerId: OWNER, feedbackDays: 10, candidateContactEmail: "" });
      expect(forms(page, closeOpeningAction)).toHaveLength(1);
      expect(forms(page, reopenOpeningAction)).toHaveLength(0);
    }
  });

  it("a reviewer on the team reads it: no close or reopen, and only the people on this opening", async () => {
    viewer = { role: "REVIEWER", view: true, edit: false };
    const page = await render();
    const props = formProps(page);
    expect(props).toMatchObject({ canEdit: false, closed: false });
    expect(props.users.map((u) => u.id)).toEqual([OWNER, REVIEWER, GONE]);
    expect(forms(page, closeOpeningAction)).toHaveLength(0);
    expect(forms(page, reopenOpeningAction)).toHaveLength(0);
  });

  it("a reviewer outside the team gets the 404", async () => {
    viewer = { role: "REVIEWER", view: false, edit: false };
    await expect(render()).rejects.toThrow("notFound");
  });

  it("a closed opening is read-only and offers an owner or manager 'Yeniden aç' as the one filled button", async () => {
    status = "CLOSED";
    viewer = { role: "MANAGER", view: true, edit: false };
    const page = await render();
    expect(formProps(page)).toMatchObject({ canEdit: false, closed: true });
    expect(forms(page, closeOpeningAction)).toHaveLength(0);
    const reopen = forms(page, reopenOpeningAction);
    expect(reopen).toHaveLength(1);
    const buttons = find(reopen[0], (el) => el.props.type === "submit");
    expect(buttons.map((b) => [b.props.variant, text(b)])).toEqual([["primary", "Yeniden aç"]]);
    expect(find(page, ofType(UndoStrip))).toHaveLength(0);
  });

  it("right after closing, the undo strip reopens it", async () => {
    status = "CLOSED";
    viewer = { role: "OWNER", view: true, edit: false };
    const strip = find(await render({ closed: "1" }), ofType(UndoStrip));
    expect(strip).toHaveLength(1);
    expect(strip[0].props).toMatchObject({ action: reopenOpeningAction, hiddenFields: { openingId: OPENING }, message: "Alım kapatıldı." });
  });

  it("a reviewer on a closed opening reads it and cannot reopen it", async () => {
    status = "CLOSED";
    viewer = { role: "REVIEWER", view: true, edit: false };
    const page = await render({ closed: "1" });
    expect(forms(page, reopenOpeningAction)).toHaveLength(0);
    expect(find(page, ofType(UndoStrip))).toHaveLength(0);
    expect(text(page)).toContain("Bu alım kapalı. Ekip ve kurallar okunur kalır.");
  });
});
