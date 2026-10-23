import { describe, expect, it } from "vitest";
import { isControlTarget, SKIP } from "@/components/candidate/exam/notes/dom-text";

const fakeEl = (matches: boolean) => ({ closest: (sel: string) => (sel === SKIP && matches ? {} : null) });

describe("isControlTarget", () => {
  it("lets presses on controls through and takes plain text", () => {
    expect(isControlTarget(fakeEl(true))).toBe(true);
    expect(isControlTarget(fakeEl(false))).toBe(false);
    expect(isControlTarget(null)).toBe(false);
    expect(isControlTarget({})).toBe(false);
  });
  it("covers buttons, inputs, labels, chips and draggables", () => {
    for (const part of ["button", "input", "label", "[draggable='true']", "[data-notes-skip]"]) expect(SKIP).toContain(part);
  });
});
