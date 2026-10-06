import { describe, expect, it } from "vitest";
import { managerT } from "@/i18n/manager";
import { activity, content, stage } from "@/solutions/hiring/rules/test-fixtures";
import { setupNext, setupProgress, setupRowsOf, setupSkips, teamHref } from "./setup-steps";

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

describe("the team step counts active members only (B-M1)", () => {
  const OWNER = "55555555-5555-4555-8555-555555555555";
  const ECE = "66666666-6666-4666-8666-666666666666";
  const CAN = "77777777-7777-4777-8777-777777777777";
  const state = {
    draft: { id: "d", number: 1, status: "DRAFT", publishedAt: null, previewedAt: null, updatedAt: new Date(0) },
    content: content([stage("s1", [activity("a1", { competencyIds: ["c1"] })])], { id: "d" }),
    facts: new Map(),
    problems: [],
  } as unknown as Parameters<typeof setupRowsOf>[0]["state"];
  const people = (canDisabled: Date | null) => [
    { id: OWNER, role: "OWNER" as const, disabledAt: null },
    { id: ECE, role: "REVIEWER" as const, disabledAt: null },
    { id: CAN, role: "REVIEWER" as const, disabledAt: canDisabled },
  ];
  const team = (memberIds: string[], canDisabled: Date | null) =>
    setupRowsOf({ state, opening: { id: OP, memberIds, decisionMakerId: OWNER }, people: people(canDisabled), t: managerT("tr"), locale: "tr" }).find((r) => r.key === "team")!;

  it("is not done while one member is disabled, and opens the team's members step", () => {
    const row = team([ECE, CAN], new Date("2026-10-01T00:00:00Z"));
    expect([row.state, row.row.reason, row.href]).toEqual(["advisory", "DISABLED_MEMBER", `${base}/settings#team-members`]);
  });

  it("is not done when the only member is disabled (no active member counted)", () => {
    const row = team([CAN], new Date("2026-10-01T00:00:00Z"));
    expect([row.state, row.href]).toEqual(["advisory", `${base}/settings#team-members`]);
  });

  it("is done once every member is active and an active owner decides (positive control)", () => {
    expect(team([ECE, CAN], null).state).toBe("done");
  });
});
