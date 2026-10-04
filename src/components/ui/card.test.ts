import * as React from "react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElement = React.ReactElement<Record<string, any>>;

describe("Card radius", () => {
  it("reads --card-radius and falls back to the 14px the exam cards draw", () => {
    const el = Card({}) as AnyElement;
    expect(el.props.className.split(" ")).toContain("rounded-[var(--card-radius,14px)]");
  });

  it("still lets a caller override the radius", () => {
    const el = Card({ className: "rounded-none" }) as AnyElement;
    expect(el.props.className).toContain("rounded-none");
    expect(el.props.className).not.toContain("--card-radius");
  });
});
