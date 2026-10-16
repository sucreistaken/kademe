import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SECTION_LOOK, SectionTile, type SectionKey } from "./section-look";

const SECTIONS: SectionKey[] = ["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"];

describe("sections are icon + word, never five colours", () => {
  it.each(SECTIONS)("%s uses the neutral tile", (s) => {
    expect(SECTION_LOOK[s].color).toBe("neutral");
    expect(renderToStaticMarkup(createElement(SectionTile, { section: s }))).toContain("bg-cream");
  });

  it("keeps one distinct icon per section", () => {
    expect(new Set(SECTIONS.map((s) => SECTION_LOOK[s].icon)).size).toBe(5);
  });
});
