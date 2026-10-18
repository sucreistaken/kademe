import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({ useT: () => (key: string) => key }));

import { ListeningPlayer } from "./MediaItems";

const stimulus = (playsLeft: number) => ({ kind: "LISTENING" as const, title: "Gespraech", durationMs: 60_000, playsLeft, maxPlays: 2 });

const render = (playsLeft: number, gateKey?: string) =>
  renderToStaticMarkup(
    createElement(ListeningPlayer, {
      token: "tok",
      sectionPosition: 2,
      sequence: 4,
      stimulus: stimulus(playsLeft),
      engine: null,
      heading: "H1",
      gateKey,
    }),
  );

describe("ListeningPlayer read-first gate", () => {
  it("shows the heading and the gate card, not the player, before the recording was started", () => {
    const html = render(2, "k");
    expect(html).toContain("H1");
    expect(html).toContain("listenGate");
    expect(html).toContain("listenStart");
    expect(html).not.toContain("listenPlay");
  });

  it("shows the player once a play was counted", () => {
    const html = render(1, "k");
    expect(html).toContain("listenPlay");
    expect(html).not.toContain("listenGate");
  });

  it("has no gate without a gate key", () => {
    const html = render(2);
    expect(html).toContain("listenPlay");
    expect(html).not.toContain("listenStart");
  });

  it("draws the play button disabled only when no play is left (a busy one stays focusable)", () => {
    expect(render(1, "k")).toMatch(/<button type="button" class="[^"]*">listenPlay<\/button>/);
    expect(render(0, "k")).toMatch(/<button type="button" disabled="" class="[^"]*">listenPlay<\/button>/);
  });

  it("keeps the audio element while gated, so the start click can play it", () => {
    expect(render(2, "k")).toContain("<audio");
  });
});
