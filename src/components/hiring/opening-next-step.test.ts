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
