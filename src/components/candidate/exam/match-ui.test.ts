import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { closedState, MatchUiProvider, MatchUiScope, useMatchUi } from "./match-ui";

describe("closedState", () => {
  it("shuts the list of the row that asked, when it is the open one", () => {
    expect(closedState({ scope: 3, row: "l1" }, 3, "l1")).toEqual({ scope: 3, row: null });
  });

  it("leaves another row's list open: the old list closes after the click that opened the new one", () => {
    const open = { scope: 3, row: "l2" };
    expect(closedState(open, 3, "l1")).toBe(open);
  });

  it("leaves a list of another question alone", () => {
    const open = { scope: 3, row: "l1" };
    expect(closedState(open, 4, "l1")).toBe(open);
  });
});

function Probe() {
  const ui = useMatchUi();
  return createElement("span", null, `${ui.openRow ?? "none"}|${ui.inline}`);
}

describe("the shared open list", () => {
  it("starts closed, wherever it is provided or not", () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>none|false</span>");
    expect(renderToStaticMarkup(createElement(MatchUiScope, { scope: 1 }, createElement(Probe)))).toContain("none|false");
  });

  it("shows the row a script has opened, inline", () => {
    expect(renderToStaticMarkup(createElement(MatchUiProvider, { openRow: "g1", inline: true }, createElement(Probe)))).toBe("<span>g1|true</span>");
    expect(renderToStaticMarkup(createElement(MatchUiProvider, { openRow: null, inline: true }, createElement(Probe)))).toBe("<span>none|true</span>");
  });
});
