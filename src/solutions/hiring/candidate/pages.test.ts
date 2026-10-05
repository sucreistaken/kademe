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
  consent: { tr: "Rıza metni", en: "Consent text" } as { tr: string; en: string },
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));
vi.mock("@/lib/candidate-context", () => ({ setAssessmentLocale: h.setAssessmentLocale }));
vi.mock("../server/candidate", () => ({ loadHiringContext: async () => h.hctx, loadHiringState: async () => h.state }));
vi.mock("../server/consent", () => ({ loadConsentText: async () => ({ id: "ct", body: h.consent }) }));
vi.mock("@/components/hiring/candidate/landing", () => ({ Landing: function Landing() {} }));
vi.mock("@/components/hiring/candidate/closed", () => ({ ClosedCard: function ClosedCard() {} }));
vi.mock("@/components/candidate/LinkProblem", () => ({ LinkProblem: function LinkProblem() {} }));
vi.mock("@/components/hiring/candidate/frame", () => ({ HiringFrame: function HiringFrame() {} }));
vi.mock("@/components/candidate/UnknownLink", () => ({ UnknownLink: function UnknownLink() {} }));
vi.mock("@/components/hiring/candidate/device-check", () => ({ DeviceCheck: function DeviceCheck() {} }));
vi.mock("@/components/hiring/candidate/stage-runner", () => ({ StageRunner: function StageRunner() {} }));

import { Landing } from "@/components/hiring/candidate/landing";
import { ClosedCard } from "@/components/hiring/candidate/closed";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { HiringFrame } from "@/components/hiring/candidate/frame";
import { UnknownLink } from "@/components/candidate/UnknownLink";
import { DeviceCheck } from "@/components/hiring/candidate/device-check";
import { StageRunner } from "@/components/hiring/candidate/stage-runner";
import { createElement } from "react";
import { formatInviteDeadline } from "../rules/invitation";
import { zoneLabel } from "@/lib/org-timezone";
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

const render = (slot: "landing" | "check" | "stage" | "done", over: Record<string, unknown> = {}) =>
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
  h.consent = { tr: "Rıza metni", en: "Consent text" };
});

describe("renderHiringPage", () => {
  it("renders the landing with the state through candidateSafe, the consent text and the deadline in the org's zone", async () => {
    const [landing] = find(await render("landing"), Landing);
    const props = landing.props as { token: string; state: Record<string, unknown>; consentBody: string; consentLang: string; deadline: string };
    expect(props.token).toBe("tok");
    expect(props.consentBody).toBe("Rıza metni");
    expect(props.consentLang).toBe("tr");
    // The same words as the invitation e-mail: the end of the org's day, the zone named.
    expect(props.deadline).toBe(formatInviteDeadline("2026-10-19", "tr", zoneLabel("tr")));
    expect(props.deadline).toMatch(/^19 Eki 23:59 \(.+\)$/);
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
    const consentOf = async () => find(await render("landing"), Landing)[0].props as { consentBody: string; consentLang: string };
    h.hctx = { ...(h.hctx as object), locale: "en" };
    expect(await consentOf()).toMatchObject({ consentBody: "Consent text", consentLang: "en" });
    h.consent = { tr: "Rıza metni", en: " " };
    expect(await consentOf()).toMatchObject({ consentBody: "Rıza metni", consentLang: "tr" });
    h.hctx = { ...(h.hctx as object), locale: "tr" };
    h.consent = { tr: "", en: "Consent text" };
    expect(await consentOf()).toMatchObject({ consentBody: "Consent text", consentLang: "en" });
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
    // Inside the hiring frame: the organisation, the language switch and Help stay in reach, and the switch works there.
    await expect(render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx }, searchParams: { lang: "en" } })).rejects.toMatchObject({ to: "/a/tok" });
    expect(find(expired, HiringFrame)[0].props).toMatchObject({ orgName: "Örnek A.Ş.", locale: "tr", token: "tok" });
    h.state = { ...(h.state as object), step: "CLOSED" };
    const closed = find(await render("landing"), ClosedCard);
    expect(closed).toHaveLength(1);
    expect(closed[0].props).toEqual({ contactEmail: "deniz@ornek.test" });
    expect(find(await render("landing"), Landing)).toHaveLength(0);
  });

  it("keeps a finished link on its way to /done, and asks nothing of a link it cannot serve", async () => {
    h.state = { ...(h.state as object), step: "DONE", path: "/done" };
    await expect(render("landing", { resolved: { ok: false, problem: "COMPLETED", ctx } })).rejects.toMatchObject({ to: "/a/tok/done" });
    // A token hiring cannot serve gets exactly the core unknown-link card: no frame, no organisation name.
    h.hctx = null;
    const unknown = await render("landing");
    expect(unknown).toEqual(createElement(UnknownLink, { token: "tok" }));
    expect(find(unknown, HiringFrame)).toHaveLength(0);
  });

  it("renders the device check with the devices and the warm-up flag only, inside the frame", async () => {
    h.state = {
      ...(h.state as object),
      step: "CHECK",
      path: "/check",
      devices: { camera: true, microphone: true },
      practice: true,
      stages: [{ position: 1, name: { tr: "Tanışma LEAKVISIBLE_STAGE", en: "Introduction" }, prompt: "LEAKVISIBLE_PROMPT", managerNotes: "TEAMSECRET_NOTE" }],
    };
    const node = await render("check");
    const [check] = find(node, DeviceCheck);
    expect(check.props).toEqual({ token: "tok", camera: true, practice: true, locale: "tr" });
    // No question text and no team text reaches the device page; the frame still names the organisation (positive control).
    expect(JSON.stringify(check.props)).not.toMatch(/LEAKVISIBLE|TEAMSECRET/);
    expect(find(node, HiringFrame)[0].props).toMatchObject({ orgName: "Örnek A.Ş.", locale: "tr" });
    expect(find(node, LinkProblem)).toHaveLength(0);
    h.state = { ...(h.state as object), devices: { camera: false, microphone: true }, practice: false };
    expect(find(await render("check"), DeviceCheck)[0].props).toMatchObject({ camera: false, practice: false });
  });

  it("sends a candidate who is past the device check away from /check", async () => {
    h.state = { ...(h.state as object), step: "STAGE", position: 1, path: "/stage/1", devices: { camera: true, microphone: true }, practice: false };
    await expect(render("check")).rejects.toMatchObject({ to: "/a/tok/stage/1" });
  });

  it("renders the stage runner with the candidate state only, keyed by the stage, inside the frame (Task 13)", async () => {
    h.state = {
      ...(h.state as object),
      step: "STAGE",
      position: 2,
      path: "/stage/2",
      current: {
        position: 2,
        total: 2,
        stage: {
          id: "s2",
          name: { tr: "Vaka LEAKVISIBLE_STAGE", en: "Case" },
          description: { tr: "", en: "" },
          durationSeconds: 300,
          internalPurpose: "TEAMSECRET_STAGE_PURPOSE",
          activities: [
            {
              id: "q1",
              type: "SINGLE_CHOICE",
              prompt: { tr: "Hangisi? LEAKVISIBLE_PROMPT", en: "Which?" },
              internalQuestion: "TEAMSECRET_PURPOSE",
              managerNotes: "TEAMSECRET_NOTE",
              competencyIds: ["TEAMSECRET_COMPETENCY"],
              choices: [{ id: "c1", label: { tr: "Bir LEAKVISIBLE_CHOICE", en: "One" }, correct: true }],
            },
          ],
        },
        responses: [],
      },
    };
    const node = await render("stage", { params: { n: "2" } });
    const [runner] = find(node, StageRunner);
    expect(runner.key).toBe("2");
    const props = runner.props as { token: string; locale: string; deadline: string; initial: { current: { position: number } } };
    expect(props).toMatchObject({ token: "tok", locale: "tr" });
    expect(props.initial.current.position).toBe(2);
    // The same deadline words as the landing and the invitation e-mail.
    expect(props.deadline).toBe(formatInviteDeadline("2026-10-19", "tr", zoneLabel("tr")));
    const sent = JSON.stringify(props);
    // Positive control: the question, its choice and the stage's name reach the runner (C10)...
    expect((sent.match(/LEAKVISIBLE_[A-Z]+/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // ...and no team text, competency or right answer does.
    expect(sent.match(/TEAMSECRET/g) ?? []).toHaveLength(0);
    expect(sent).not.toMatch(/"correct"/);
    expect(find(node, HiringFrame)[0].props).toMatchObject({ orgName: "Örnek A.Ş.", locale: "tr" });
    expect(find(node, LinkProblem)).toHaveLength(0);
  });

  it("renders the finish slot as the invalid-link card until Task 16", async () => {
    h.state = { ...(h.state as object), step: "DONE", path: "/done" };
    const node = await render("done");
    expect((find(node, LinkProblem)[0].props as { problem: string }).problem).toBe("INVALID");
    expect(find(node, StageRunner)).toHaveLength(0);
  });
});
