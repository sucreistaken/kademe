import { describe, expect, it } from "vitest";
import { cockpitCounts, cockpitTab, openingNextStep } from "./opening-next-step";

const id = "o1";
const base = "/hiring/openings/o1";
const live = (over: Partial<Parameters<typeof openingNextStep>[0]> = {}) =>
  openingNextStep({ id, status: "OPEN", runs: true, facts: { invited: 4, expiringSoon: 0, requests: { open: 0, rights: 0 } }, noTeam: false, draftWaiting: false, ...over });

describe("one next step per opening (KG2, 4.4)", () => {
  it("a draft: the setup path's next step, or 'Kuruluma devam et' when it was not computed", () => {
    expect(openingNextStep({ id, status: "DRAFT", runs: true, setup: { key: "team", href: `${base}/settings#team-members` } })).toEqual({ kind: "setup", href: `${base}/settings#team-members`, setupKey: "team" });
    expect(openingNextStep({ id, status: "DRAFT", runs: true, setup: null })).toEqual({ kind: "continueSetup", href: base });
  });

  it("a live opening, in order: requests, an empty team, expiring links, a waiting draft, no invitation, the candidates", () => {
    const facts = { invited: 4, expiringSoon: 2, requests: { open: 1, rights: 0 } };
    expect(live({ facts, noTeam: true, draftWaiting: true })).toEqual({ kind: "requests", href: `${base}/candidates` });
    expect(live({ facts: { ...facts, requests: { open: 0, rights: 0 } }, noTeam: true, draftWaiting: true })).toEqual({ kind: "team", href: `${base}/settings#team-members` });
    expect(live({ facts: { ...facts, requests: { open: 0, rights: 0 } }, draftWaiting: true })).toEqual({ kind: "expiring", href: `${base}/candidates` });
    expect(live({ draftWaiting: true })).toEqual({ kind: "draft", href: base });
    expect(live({ facts: { invited: 0, expiringSoon: 0, requests: { open: 0, rights: 0 } } })).toEqual({ kind: "invite", href: "/hiring/invite?opening=o1" });
    expect(live()).toEqual({ kind: "candidates", href: `${base}/candidates` });
  });

  it("a live opening whose last day passed: the deadline step before the invite and the candidates, after what waits already (B-M3)", () => {
    expect(live({ deadlinePassed: true })).toEqual({ kind: "deadline", href: `${base}/settings#contact-deadline` });
    expect(live({ deadlinePassed: true, facts: { invited: 0, expiringSoon: 0, requests: { open: 0, rights: 0 } } }).kind).toBe("deadline");
    expect(live({ deadlinePassed: true, draftWaiting: true }).kind).toBe("draft");
    expect(live({ deadlinePassed: true, noTeam: true }).kind).toBe("team");
    expect(openingNextStep({ id, status: "OPEN", runs: false, deadlinePassed: true }).kind).toBe("open");
    expect(cockpitCounts([{ status: "OPEN", next: { kind: "deadline" } }]).waiting).toBe(1);
  });

  it("a live opening's waiting draft goes to the draft's next setup step when it was computed (B-M10, KG3)", () => {
    expect(live({ draftWaiting: true, setup: { key: "preview", href: `${base}/assessment/preview` } })).toEqual({ kind: "draft", href: `${base}/assessment/preview` });
    expect(live({ draftWaiting: true, setup: null })).toEqual({ kind: "draft", href: base });
  });

  it("counts a data-rights request but never sends anyone to act on it before plan 3 (ruling C6)", () => {
    expect(live({ facts: { invited: 4, expiringSoon: 0, requests: { open: 0, rights: 2 } } }).kind).toBe("candidates");
  });

  it("a reviewer gets 'Aç' on every row, whatever waits (H9); a closed opening too (KG1)", () => {
    const facts = { invited: 4, expiringSoon: 2, requests: { open: 3, rights: 1 } };
    expect(openingNextStep({ id, status: "OPEN", runs: false, facts, noTeam: true })).toEqual({ kind: "open", href: base });
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
});
