import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

/**
 * /hiring/invite (HIRING-VISUAL-FLOW 4.9): the guided flow for a role that may
 * invite, with every invitable opening of its own organisation; a reviewer
 * reads why there is no flow, and no opening (name, team, link) is read for
 * them (leak rule: candidate invitations only to people who may invite).
 */
type Role = "OWNER" | "MANAGER" | "REVIEWER";
let role: Role;
let openings: Array<{ id: string; name: string; live: boolean; evaluators: number; minEvaluations: number; deadlineDay: string | null }>;
const ORG = "11111111-1111-4111-8111-111111111111";
const invitable = vi.fn(async (orgId: string) => {
  void orgId;
  return openings;
});

vi.mock("@/server/session", () => ({ requireUser: async () => ({ id: "u", orgId: ORG, email: "", name: "", role }) }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "tr" }));
vi.mock("@/solutions/hiring/server/invitations", () => ({ invitableOpenings: (orgId: string) => invitable(orgId) }));
vi.mock("@/components/hiring/invite/invite-form", () => ({ InviteForm: function InviteForm() {} }));

import HiringInvitePage from "./page";
import { InviteForm } from "@/components/hiring/invite/invite-form";

/** Every element of a server-rendered tree (components are not called). */
function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const props = node.props as { children?: ReactNode };
  return [node, ...elements(props.children)];
}
/** The words and links of a server-rendered tree: text children and string props. */
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (!isValidElement(node)) return "";
  const props = node.props as Record<string, unknown>;
  const own = Object.entries(props).flatMap(([k, v]) => (k !== "children" && typeof v === "string" ? [v] : []));
  return [...own, text(props.children as ReactNode)].join(" ");
}

const page = async (sp: Record<string, string> = {}) => (await HiringInvitePage({ searchParams: Promise.resolve(sp) })) as ReactElement;

beforeEach(() => {
  role = "OWNER";
  openings = [{ id: "o1", name: "Tasarımcı · Ekim", live: true, evaluators: 2, minEvaluations: 2, deadlineDay: null }];
  invitable.mockClear();
});

describe("/hiring/invite (4.9)", () => {
  it("gives a role that may invite the guided flow as a page, with its organisation's openings and the preselection", async () => {
    const out = await page({ opening: "o1" });
    const forms = elements(out).filter((e) => e.type === InviteForm);
    expect(forms).toHaveLength(1);
    expect(forms[0].props).toMatchObject({ container: "page", openings, initialOpeningId: "o1" });
    expect(invitable).toHaveBeenCalledWith(ORG);
  });

  it("tells a reviewer why there is no flow and reads no opening for them", async () => {
    role = "REVIEWER";
    const out = await page();
    expect(elements(out).filter((e) => e.type === InviteForm)).toHaveLength(0);
    expect(text(out)).toContain("Rolün aday davet edemez.");
    expect(text(out)).not.toContain("Tasarımcı");
    expect(invitable).not.toHaveBeenCalled();
  });

  it("with no invitable opening says what to do first, and draws no flow", async () => {
    openings = [];
    const out = await page();
    expect(elements(out).filter((e) => e.type === InviteForm)).toHaveLength(0);
    expect(text(out)).toContain("Davet açılacak alım yok.");
    expect(text(out)).toContain("/hiring/openings");
  });
});
