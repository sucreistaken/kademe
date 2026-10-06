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
