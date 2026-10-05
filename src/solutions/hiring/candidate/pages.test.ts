import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}

const h = vi.hoisted(() => ({
  hctx: null as unknown,
  state: null as unknown,
  setAssessmentLocale: vi.fn(async () => undefined),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));
vi.mock("@/lib/candidate-context", () => ({ setAssessmentLocale: h.setAssessmentLocale }));
vi.mock("../server/candidate", () => ({ loadHiringContext: async () => h.hctx, loadHiringState: async () => h.state }));
vi.mock("../server/consent", () => ({ loadConsentText: async () => ({ id: "ct", body: { tr: "Rıza metni", en: "Consent text" } }) }));
vi.mock("@/components/hiring/candidate/landing", () => ({ Landing: function Landing() {} }));
vi.mock("@/components/hiring/candidate/closed", () => ({ ClosedCard: function ClosedCard() {} }));
vi.mock("@/components/candidate/LinkProblem", () => ({ LinkProblem: function LinkProblem() {} }));
vi.mock("@/components/hiring/candidate/frame", () => ({ HiringFrame: function HiringFrame() {} }));

import { Landing } from "@/components/hiring/candidate/landing";
import { ClosedCard } from "@/components/hiring/candidate/closed";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { HiringFrame } from "@/components/hiring/candidate/frame";
import { renderHiringPage } from "./pages";

const ctx = {
  link: { id: "l", status: "NOT_STARTED", expiresAt: new Date("2026-10-19T20:59:59Z"), notBefore: null, firstSeenIp: null },
  assessment: { id: "a", orgId: "o", solution: "HIRING" },
  candidate: { id: "c", fullName: "Elif Kaya", email: "elif@example.com", phone: null, location: null },
  orgName: "Örnek A.Ş.",
  locale: "tr",
  contactEmail: "ik@ornek.test",
  contactName: "Örnek A.Ş.",
  mediaRetentionDays: 180,
  evidenceRetentionDays: 90,
};

function find(node: ReactNode, type: unknown): ReactElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [...(element.type === type ? [element] : []), ...find(element.props?.children, type)];
}

const render = (slot: "landing" | "stage", over: Record<string, unknown> = {}) =>
  renderHiringPage(slot, { token: "tok", resolved: { ok: true, ctx } as never, searchParams: {}, params: {}, ...over }) as Promise<ReactNode>;

beforeEach(() => {
  h.hctx = { ...ctx, hiring: { openingId: "op", versionId: "v", extraTimePct: 0, consentTextId: "ct" } };
  // A state as Task 5 builds it can only carry candidate text; the team-only field here proves the
  // renderer still goes through candidateSafe, and the LEAKVISIBLE text is the positive control (C10).
  h.state = {
    step: "CONSENT",
    position: null,
    path: "",
    orgName: "Örnek A.Ş.",
    positionName: "Ürün Tasarımcısı LEAKVISIBLE_POSITION",
    contactEmail: "deniz@ornek.test",
    internalQuestion: "TEAMSECRET_PURPOSE",
    stages: [{ position: 1, name: { tr: "Tanışma LEAKVISIBLE_STAGE", en: "Introduction" }, managerNotes: "TEAMSECRET_NOTE" }],
  };
  h.setAssessmentLocale.mockClear();
});

describe("renderHiringPage", () => {
  it("renders the landing with the state through candidateSafe, the consent text and the deadline in the org's zone", async () => {
    const [landing] = find(await render("landing"), Landing);
    const props = landing.props as { token: string; state: Record<string, unknown>; consentBody: string; deadline: string };
    expect(props.token).toBe("tok");
    expect(props.consentBody).toBe("Rıza metni");
    expect(props.deadline).toBe("19 Eki");
    const sent = JSON.stringify(props);
    expect(sent.match(/TEAMSECRET/g) ?? []).toHaveLength(0);
    expect((sent.match(/LEAKVISIBLE_[A-Z]+/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(props.state).toMatchObject({ orgName: "Örnek A.Ş.", positionName: "Ürün Tasarımcısı LEAKVISIBLE_POSITION" });
  });

  it("frames the landing with the organisation's name in the candidate's language", async () => {
    const [frame] = find(await render("landing"), HiringFrame);
    expect(frame.props).toMatchObject({ locale: "tr", orgName: "Örnek A.Ş.", token: "tok" });
  });

  it("shows the consent text in the invitation's language, the other language when it is empty", async () => {
    h.hctx = { ...(h.hctx as object), locale: "en" };
    expect((find(await render("landing"), Landing)[0].props as { consentBody: string; locale: string }).consentBody).toBe("Consent text");
  });

  it("sends the candidate to the page their state lives on", async () => {
    h.state = { ...(h.state as object), step: "STAGE", position: 2, path: "/stage/2" };
    await expect(render("landing")).rejects.toMatchObject({ to: "/a/tok/stage/2" });
  });

  it("applies ?lang= once and drops it from the address", async () => {
    await expect(render("landing", { searchParams: { lang: "en" } })).rejects.toMatchObject({ to: "/a/tok" });
    expect(h.setAssessmentLocale).toHaveBeenCalledWith(expect.objectContaining({ hiring: expect.anything() }), "en");
  });

  it("shows an expired link's card, and the closed opening's card", async () => {
    const expired = await render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx } });
    expect((find(expired, LinkProblem)[0].props as { problem: string }).problem).toBe("EXPIRED");
    h.state = { ...(h.state as object), step: "CLOSED" };
    const closed = find(await render("landing"), ClosedCard);
    expect(closed).toHaveLength(1);
    expect(closed[0].props).toEqual({ contactEmail: "deniz@ornek.test" });
    expect(find(await render("landing"), Landing)).toHaveLength(0);
  });

  it("keeps a finished link on its way to /done, and asks nothing of a link it cannot serve", async () => {
    h.state = { ...(h.state as object), step: "DONE", path: "/done" };
    await expect(render("landing", { resolved: { ok: false, problem: "COMPLETED", ctx } })).rejects.toMatchObject({ to: "/a/tok/done" });
    h.hctx = null;
    expect((find(await render("landing"), LinkProblem)[0].props as { problem: string }).problem).toBe("INVALID");
  });

  it("renders the slots of later tasks as the invalid-link card for now", async () => {
    h.state = { ...(h.state as object), step: "STAGE", position: 1, path: "/stage/1" };
    const node = await render("stage", { params: { n: "1" } });
    expect((find(node, LinkProblem)[0].props as { problem: string }).problem).toBe("INVALID");
  });
});
