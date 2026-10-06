import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}

const h = vi.hoisted(() => {
  const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
  return {
    DESKTOP_UA,
    headers: { "user-agent": DESKTOP_UA } as Record<string, string>,
    headersError: null as unknown,
    hctx: null as unknown,
    state: null as unknown,
    facts: { contact: "deniz@ornek.test", openingClosed: false, started: false } as Record<string, unknown>,
    setAssessmentLocale: vi.fn(async () => undefined),
    consent: { tr: "Rıza metni", en: "Consent text" } as { tr: string; en: string },
  };
});

vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
  // Like Next: a framework error (here the redirect) goes on up; anything else is left to the caller.
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Redirect) throw err;
  },
}));
vi.mock("@/lib/candidate-context", () => ({ setAssessmentLocale: h.setAssessmentLocale }));
vi.mock("../server/candidate", () => ({ loadHiringContext: async () => h.hctx, loadHiringState: async () => h.state, hiringProblemFacts: async () => h.facts }));
vi.mock("../server/consent", () => ({ loadConsentText: async () => ({ id: "ct", body: h.consent }) }));
vi.mock("@/components/hiring/candidate/landing", () => ({ Landing: function Landing() {} }));
vi.mock("@/components/hiring/candidate/closed", () => ({ ClosedCard: function ClosedCard() {} }));
vi.mock("@/components/candidate/LinkProblem", () => ({ LinkProblem: function LinkProblem() {} }));
vi.mock("@/components/hiring/candidate/link-problem", () => ({ HiringLinkProblem: function HiringLinkProblem() {} }));
vi.mock("@/components/hiring/candidate/frame", () => ({ HiringFrame: function HiringFrame() {} }));
vi.mock("@/components/candidate/UnknownLink", () => ({ UnknownLink: function UnknownLink() {} }));
vi.mock("@/components/hiring/candidate/device-check", () => ({ DeviceCheck: function DeviceCheck() {} }));
vi.mock("@/components/hiring/candidate/stage-runner", () => ({ StageRunner: function StageRunner() {} }));
vi.mock("@/components/hiring/candidate/practice", () => ({ Practice: function Practice() {} }));
vi.mock("@/components/hiring/candidate/done", () => ({ Done: function Done() {} }));
vi.mock("@/components/hiring/candidate/info-step", () => ({ InfoStep: function InfoStep() {} }));
vi.mock("next/headers", () => ({
  headers: async () => {
    if (h.headersError) throw h.headersError;
    return new Headers(h.headers);
  },
}));
vi.mock("@/components/hiring/candidate/desktop-gate", () => ({ DesktopGate: function DesktopGate() {} }));
vi.mock("@/components/hiring/candidate/desktop-only", () => ({ DesktopOnlyScreen: function DesktopOnlyScreen() {} }));

import { Landing } from "@/components/hiring/candidate/landing";
import { ClosedCard } from "@/components/hiring/candidate/closed";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { HiringLinkProblem } from "@/components/hiring/candidate/link-problem";
import { HiringFrame } from "@/components/hiring/candidate/frame";
import { UnknownLink } from "@/components/candidate/UnknownLink";
import { DeviceCheck } from "@/components/hiring/candidate/device-check";
import { StageRunner } from "@/components/hiring/candidate/stage-runner";
import { Practice } from "@/components/hiring/candidate/practice";
import { Done } from "@/components/hiring/candidate/done";
import { InfoStep } from "@/components/hiring/candidate/info-step";
import { createElement } from "react";
import { formatInviteDeadline } from "../rules/invitation";
import { zoneLabel } from "@/lib/org-timezone";
import { renderHiringPage } from "./pages";
import { DesktopGate } from "@/components/hiring/candidate/desktop-gate";
import { DesktopOnlyScreen } from "@/components/hiring/candidate/desktop-only";

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

const render = (slot: "landing" | "info" | "check" | "practice" | "stage" | "done", over: Record<string, unknown> = {}) =>
  renderHiringPage(slot, { token: "tok", resolved: { ok: true, ctx } as never, searchParams: {}, params: {}, ...over }) as Promise<ReactNode>;

beforeEach(() => {
  h.headers = { "user-agent": h.DESKTOP_UA };
  h.headersError = null;
  h.facts = { contact: "deniz@ornek.test", openingClosed: false, started: false };
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
    const props = landing.props as { token: string; state: Record<string, unknown>; consentBody: string; consentLang: string; deadline: string; deadlineWhen: string; deadlineZone: string };
    expect(props.token).toBe("tok");
    expect(props.consentBody).toBe("Rıza metni");
    expect(props.consentLang).toBe("tr");
    // The same words as the invitation e-mail: the end of the org's day, the zone named.
    expect(props.deadline).toBe(formatInviteDeadline("2026-10-19", "tr", zoneLabel("tr")));
    expect(props.deadline).toMatch(/^19 Eki 23:59 \(.+\)$/);
    // Welcome's tile: the same day and time, the zone under it (review fix 6).
    expect(props.deadlineWhen).toBe("19 Eki 23:59");
    expect(props.deadlineZone).toBe(zoneLabel("tr"));
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
    // Hiring's own honest card (plan 2b decision 8), naming the opening's contact; the core card is gone here.
    expect(find(expired, HiringLinkProblem)[0].props).toEqual({ token: "tok", problem: "EXPIRED", date: "19 Eki", contactEmail: "deniz@ornek.test" });
    expect(find(expired, LinkProblem)).toHaveLength(0);
    // Inside the hiring frame: the organisation, the language switch and Help stay in reach, and the switch works there.
    await expect(render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx }, searchParams: { lang: "en" } })).rejects.toMatchObject({ to: "/a/tok" });
    // An expired card's Help names the same contact: the opening's, else the organisation's.
    expect(find(expired, HiringFrame)[0].props).toMatchObject({ orgName: "Örnek A.Ş.", locale: "tr", token: "tok", contactEmail: "deniz@ornek.test" });
    h.state = { ...(h.state as object), step: "CLOSED" };
    const closed = find(await render("landing"), ClosedCard);
    expect(closed).toHaveLength(1);
    expect(closed[0].props).toEqual({ contactEmail: "deniz@ornek.test" });
    expect(find(await render("landing"), Landing)).toHaveLength(0);
  });

  it("shows the closed card, not 'ask for a new link', on a closed opening to a candidate who never started (plan decision 9)", async () => {
    h.facts = { contact: "deniz@ornek.test", openingClosed: true, started: false };
    const node = await render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx } });
    expect(find(node, ClosedCard)[0].props).toEqual({ contactEmail: "deniz@ornek.test" });
    expect(find(node, HiringLinkProblem)).toHaveLength(0);
    expect(find(await render("landing", { resolved: { ok: false, problem: "NOT_YET", ctx } }), ClosedCard)).toHaveLength(1);
    h.facts = { contact: "deniz@ornek.test", openingClosed: true, started: true };
    expect(find(await render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx } }), HiringLinkProblem)).toHaveLength(1);
  });

  it("shows a not-yet link its opening time and no request, and gives the cards only candidate facts (leak rule)", async () => {
    const notYet = { ...ctx, link: { ...ctx.link, notBefore: new Date("2026-10-08T07:00:00Z") }, orgName: "Örnek LEAKVISIBLE_ORG" };
    // A facts read that grew a team field must not reach the card: the page picks what it hands on.
    h.facts = { contact: "deniz@ornek.test", openingClosed: false, started: false, internal: "TEAMSECRET_FACT" };
    const node = await render("landing", { resolved: { ok: false, problem: "NOT_YET", ctx: notYet } });
    const [card] = find(node, HiringLinkProblem);
    expect(card.props).toEqual({ token: "tok", problem: "NOT_YET", date: "8 Eki 10:00", contactEmail: "deniz@ornek.test" });
    // Positive control: the frame carries the organisation's name; no team text is anywhere in the tree.
    expect(JSON.stringify(node)).toMatch(/LEAKVISIBLE_ORG/);
    expect(JSON.stringify(node)).not.toMatch(/TEAMSECRET/);
    expect(find(await render("landing", { resolved: { ok: false, problem: "NOT_YET", ctx } }), HiringLinkProblem)[0].props).toMatchObject({ date: null });
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

  it("renders the device check with the devices, the warm-up flag and the contact for an urgent report only, inside the frame", async () => {
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
    expect(check.props).toEqual({ token: "tok", camera: true, practice: true, locale: "tr", contactEmail: "deniz@ornek.test" });
    // No question text and no team text reaches the device page; the frame still names the organisation (positive control).
    expect(JSON.stringify(check.props)).not.toMatch(/LEAKVISIBLE|TEAMSECRET/);
    // Help names the opening's contact (final review I1).
    expect(find(node, HiringFrame)[0].props).toMatchObject({ orgName: "Örnek A.Ş.", locale: "tr", contactEmail: "deniz@ornek.test" });
    expect(find(node, LinkProblem)).toHaveLength(0);
    h.state = { ...(h.state as object), devices: { camera: false, microphone: true }, practice: false };
    expect(find(await render("check"), DeviceCheck)[0].props).toMatchObject({ camera: false, practice: false });
  });

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

  it("keeps the details step inside the frame and the desktop gate, and the whole tree free of team text, with a positive control (3.12)", async () => {
    h.state = { ...(h.state as object), step: "INFO", path: "/info", devices: { camera: true, microphone: true }, practice: true };
    h.hctx = { ...(h.hctx as object), candidate: { ...ctx.candidate, fullName: "Elif LEAKVISIBLE_OWNNAME", email: null } };
    const node = await render("info");
    expect(find(node, HiringFrame)[0].props).toMatchObject({ orgName: "Örnek A.Ş.", token: "tok" });
    expect(find(find(node, DesktopGate)[0], InfoStep)).toHaveLength(1);
    // Positive control: the candidate's own text does reach this tree, the team's never does.
    expect(JSON.stringify(node)).toMatch(/LEAKVISIBLE_OWNNAME/);
    expect(JSON.stringify(node)).not.toMatch(/TEAMSECRET|LEAKVISIBLE_POSITION|LEAKVISIBLE_STAGE/);
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
    // Help names the opening's contact (final review I1).
    expect(find(node, HiringFrame)[0].props).toMatchObject({ orgName: "Örnek A.Ş.", locale: "tr", contactEmail: "deniz@ornek.test" });
    expect(find(node, LinkProblem)).toHaveLength(0);
  });

  it("renders the warm-up with the camera flag and the language only, inside the frame (Task 14)", async () => {
    // Stage 1 not started, the warm-up switched on: the slot is open. The state carries question,
    // stage and team text (sentinels); none of it reaches the warm-up, which has its own question.
    h.state = {
      ...(h.state as object),
      step: "STAGE",
      position: 1,
      path: "/stage/1",
      practice: true,
      devices: { camera: true, microphone: true },
      current: {
        position: 1,
        startedAt: null,
        stage: { id: "s1", name: { tr: "Tanışma LEAKVISIBLE_STAGE", en: "Intro" }, internalPurpose: "TEAMSECRET_STAGE_PURPOSE", activities: [{ id: "q1", type: "VIDEO", prompt: { tr: "Anlat LEAKVISIBLE_PROMPT", en: "Tell" }, managerNotes: "TEAMSECRET_NOTE" }] },
        responses: [],
      },
    };
    const node = await render("practice");
    const [practice] = find(node, Practice);
    expect(practice.props).toEqual({ token: "tok", camera: true, locale: "tr" });
    expect(JSON.stringify(practice.props)).not.toMatch(/LEAKVISIBLE|TEAMSECRET/);
    // Positive control: the same state does carry the sentinels the warm-up is kept from, and the frame names the organisation.
    expect(JSON.stringify(h.state)).toMatch(/LEAKVISIBLE_PROMPT/);
    // Help names the opening's contact (final review I1).
    expect(find(node, HiringFrame)[0].props).toMatchObject({ orgName: "Örnek A.Ş.", locale: "tr", contactEmail: "deniz@ornek.test" });
    expect(find(node, LinkProblem)).toHaveLength(0);
    // An audio-only version: the warm-up records sound only.
    h.state = { ...(h.state as object), devices: { camera: false, microphone: true } };
    expect(find(await render("practice"), Practice)[0].props).toMatchObject({ camera: false });
  });

  it("sends a candidate away from the warm-up when it is off or stage 1 has started", async () => {
    const base = { step: "STAGE", position: 1, path: "/stage/1", devices: { camera: true, microphone: true } };
    h.state = { ...(h.state as object), ...base, practice: false, current: { position: 1, startedAt: null } };
    await expect(render("practice")).rejects.toMatchObject({ to: "/a/tok/stage/1" });
    h.state = { ...(h.state as object), ...base, practice: true, current: { position: 1, startedAt: "2026-10-05T10:00:00Z" } };
    await expect(render("practice")).rejects.toMatchObject({ to: "/a/tok/stage/1" });
  });

});

describe("the finish page", () => {
  it("opens on a finished (COMPLETED) link with the promise date in the organisation's zone", async () => {
    h.state = {
      step: "DONE",
      position: null,
      path: "/done",
      orgName: "Örnek A.Ş.",
      // Fix round 1 (I2): the state carries the promise frozen at completion as the org's calendar
      // day (the zone is applied once, at the finish: rules/invitation feedbackDay); the page names it.
      finished: { completedAt: "2026-10-05T09:00:00.000Z", stagesDone: 2, feedbackBy: "2026-10-13", survey: { enabled: true, answered: false } },
    };
    const page = (await renderHiringPage("done", { token: "tok", resolved: { ok: false, problem: "COMPLETED", ctx } as never, searchParams: {}, params: {} })) as ReactNode;
    const [done] = find(page, Done);
    expect((done.props as { feedbackBy: string }).feedbackBy).toBe("13 Eki");
  });

  it("renders the finish with the candidate state only, inside the frame, and never the invalid-link card", async () => {
    h.state = {
      ...(h.state as object),
      step: "DONE",
      position: null,
      path: "/done",
      candidateName: "Elif Kaya",
      reviewers: 2,
      devices: { camera: true, microphone: true },
      finished: { completedAt: "2026-10-05T09:00:00.000Z", stagesDone: 2, feedbackBy: "2026-10-12", survey: { enabled: true, answered: true } },
    };
    h.hctx = { ...(h.hctx as object), locale: "en" };
    const node = await render("done", { resolved: { ok: false, problem: "COMPLETED", ctx } });
    const [done] = find(node, Done);
    const props = done.props as { token: string; feedbackBy: string; state: Record<string, unknown> };
    expect(props.token).toBe("tok");
    expect(props.feedbackBy).toBe("12 Oct");
    expect(props.state).toMatchObject({ candidateName: "Elif Kaya", reviewers: 2, contactEmail: "deniz@ornek.test", finished: { stagesDone: 2, survey: { enabled: true, answered: true } } });
    const sent = JSON.stringify(props);
    // Positive control: candidate text reaches the finish; no team text, score or right answer does (C10).
    expect((sent.match(/LEAKVISIBLE_[A-Z]+/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(sent.match(/TEAMSECRET/g) ?? []).toHaveLength(0);
    expect(sent).not.toMatch(/"correct"|autoScore|score/i);
    expect(find(node, HiringFrame)[0].props).toMatchObject({ orgName: "Örnek A.Ş.", locale: "en", token: "tok" });
    expect(find(node, LinkProblem)).toHaveLength(0);
  });

  it("keeps a finished candidate on /done: the landing, a stage and the warm-up all send them back", async () => {
    h.state = { ...(h.state as object), step: "DONE", position: null, path: "/done", finished: { completedAt: "2026-10-05T09:00:00.000Z", stagesDone: 1, feedbackBy: "2026-10-12", survey: { enabled: false, answered: false } } };
    const completed = { resolved: { ok: false, problem: "COMPLETED", ctx } };
    await expect(render("landing", completed)).rejects.toMatchObject({ to: "/a/tok/done" });
    await expect(render("stage", { ...completed, params: { n: "1" } })).rejects.toMatchObject({ to: "/a/tok/done" });
    await expect(render("practice", completed)).rejects.toMatchObject({ to: "/a/tok/done" });
    await expect(render("check", completed)).rejects.toMatchObject({ to: "/a/tok/done" });
  });

  it("sends a candidate who has not finished away from /done", async () => {
    h.state = { ...(h.state as object), step: "STAGE", position: 2, path: "/stage/2", finished: null };
    await expect(render("done")).rejects.toMatchObject({ to: "/a/tok/stage/2" });
  });
});

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

  /** Every gated slot, each with a state that carries visible (LEAKVISIBLE) and team (TEAMSECRET) text. */
  const gatedSlots = (): Array<[slot: "landing" | "info" | "check" | "practice" | "stage", state: object, over: Record<string, unknown>]> => {
    const base = { ...(h.state as object), totalMinutes: 15 };
    const devices = { camera: true, microphone: true };
    const stage1 = { position: 1, total: 2, startedAt: null, stage: { id: "s1", name: { tr: "Tanışma LEAKVISIBLE_STAGE", en: "Intro" }, internalPurpose: "TEAMSECRET_STAGE_PURPOSE", activities: [{ id: "q1", type: "VIDEO", prompt: { tr: "Anlat LEAKVISIBLE_PROMPT", en: "Tell" }, managerNotes: "TEAMSECRET_NOTE" }] }, responses: [] };
    return [
      ["landing", base, {}],
      ["info", { ...base, step: "INFO", path: "/info" }, {}],
      ["check", { ...base, step: "CHECK", path: "/check", devices, practice: true }, {}],
      ["practice", { ...base, step: "STAGE", position: 1, path: "/stage/1", devices, practice: true, current: stage1 }, {}],
      ["stage", stageState(), { params: { n: "2" } }],
    ];
  };

  it("gives a phone only the desktop-only screen on all five gated pages: the minutes, the last day, the contact, and nothing of the stages", async () => {
    h.headers = { "user-agent": PHONE };
    const slots = gatedSlots();
    for (const [slot, state, over] of slots) {
      h.state = state;
      const node = await render(slot, over);
      for (const screen of [Landing, InfoStep, DeviceCheck, Practice, StageRunner, DesktopGate]) expect(find(node, screen), slot).toHaveLength(0);
      const [only] = find(node, DesktopOnlyScreen);
      expect(only.props, slot).toEqual({ token: "tok", minutes: 15, deadlineDay: "19 Eki", contactEmail: "deniz@ornek.test", stageRunning: false });
      // Inside the frame: the organisation, the language and Help stay in reach.
      expect(find(node, HiringFrame)[0].props, slot).toMatchObject({ orgName: "Örnek A.Ş.", token: "tok" });
      // The whole tree the page returns (functions dropped) carries no stage, question or team text...
      expect(JSON.stringify(node), slot).not.toMatch(/LEAKVISIBLE|TEAMSECRET/);
      // ...while the state the page read does (positive control).
      expect(JSON.stringify(h.state), slot).toMatch(/LEAKVISIBLE[\s\S]*TEAMSECRET|TEAMSECRET[\s\S]*LEAKVISIBLE/);
    }
    // Positive control for the scan itself: the same states on a desktop put visible text in the tree.
    h.headers = { "user-agent": h.DESKTOP_UA };
    for (const [slot, state, over] of slots.filter(([slot]) => slot === "landing" || slot === "stage")) {
      h.state = state;
      expect(JSON.stringify(await render(slot, over)), slot).toMatch(/LEAKVISIBLE/);
    }
  });

  it("tells a phone that a stage is running when it is, and only then (fix round M7)", async () => {
    h.headers = { "user-agent": PHONE };
    h.state = { ...stageState(), current: { ...stageState().current, startedAt: "2026-10-05T10:00:00.000Z" } };
    expect(find(await render("stage", { params: { n: "2" } }), DesktopOnlyScreen)[0].props).toMatchObject({ stageRunning: true });
    h.state = stageState();
    expect(find(await render("stage", { params: { n: "2" } }), DesktopOnlyScreen)[0].props).toMatchObject({ stageRunning: false });
  });

  it("lets a framework error from headers() through and reads any other failure as no request (fix round M1)", async () => {
    h.headersError = new Redirect("/elsewhere");
    await expect(render("landing")).rejects.toMatchObject({ to: "/elsewhere" });
    h.headersError = new Error("headers was called outside a request scope");
    expect(find(await render("landing"), DesktopGate)[0].props).toMatchObject({ serverClass: "desktop" });
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
    expect(Object.keys(reserve.props as object).sort()).toEqual(["contactEmail", "deadlineDay", "minutes", "stageRunning", "token"]);
  });

  it("leaves a tablet UA to the browser", async () => {
    h.headers = { "user-agent": TABLET, "sec-ch-ua-mobile": "?0" };
    expect(find(await render("landing"), DesktopGate)[0].props).toMatchObject({ serverClass: "unknown" });
  });

  it("does not gate the finish page or a link problem: a phone may read them", async () => {
    h.headers = { "user-agent": PHONE };
    const expired = await render("landing", { resolved: { ok: false, problem: "EXPIRED", ctx } });
    expect(find(expired, DesktopOnlyScreen)).toHaveLength(0);
    expect(find(expired, HiringLinkProblem)).toHaveLength(1);
    h.state = { ...(h.state as object), step: "DONE", position: null, path: "/done", finished: { completedAt: "2026-10-05T09:00:00.000Z", stagesDone: 1, feedbackBy: "2026-10-12", survey: { enabled: false, answered: false } } };
    const done = await render("done", { resolved: { ok: false, problem: "COMPLETED", ctx } });
    expect(find(done, Done)).toHaveLength(1);
    expect(find(done, DesktopOnlyScreen)).toHaveLength(0);
  });
});
