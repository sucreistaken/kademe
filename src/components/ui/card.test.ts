import * as React from "react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElement = React.ReactElement<Record<string, any>>;

describe("Card radius", () => {
  it("reads --card-radius (20px on :root) and falls back to the same 20px", () => {
    const el = Card({}) as AnyElement;
    expect(el.props.className.split(" ")).toContain("rounded-[var(--card-radius,20px)]");
  });

  it("stands on a solid lip, and only an elevated card floats", () => {
    expect((Card({}) as AnyElement).props.className.split(" ")).toContain("shadow-card");
    const elevated = (Card({ elevated: true }) as AnyElement).props.className.split(" ");
    expect(elevated).toContain("shadow-panel");
    expect(elevated).not.toContain("shadow-card");
  });

  it("still lets a caller override the radius", () => {
    const el = Card({ className: "rounded-none" }) as AnyElement;
    expect(el.props.className).toContain("rounded-none");
    expect(el.props.className).not.toContain("--card-radius");
  });
});
