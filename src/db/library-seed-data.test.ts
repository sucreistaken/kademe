import { describe, expect, it } from "vitest";
import { anchorHint, MAX_TAGS_PER_SIDE } from "@/lib/library/anchors";
import { DEFAULT_SCALE, SEED_COMPETENCIES } from "./library-seed-data";

describe("library starter content", () => {
  it("has the HIRING-UX 3.3 level names", () => {
    expect(DEFAULT_SCALE.levels.map((l) => l.label.tr)).toEqual(["Belirgin eksik", "Kısmen", "Beklenen düzeyde", "Güçlü", "Örnek düzeyde"]);
    expect(DEFAULT_SCALE.levels.map((l) => l.label.en)).toEqual(["Clear gap", "Partly there", "Meets the bar", "Strong", "Exceptional"]);
  });

  it("ships the eight competencies of the old product, keys unique", () => {
    const keys = SEED_COMPETENCIES.map((c) => c.key);
    expect(keys).toEqual(["communication", "problem_solving", "initiative", "commercial", "technical", "organisation", "teamwork", "customer"]);
  });

  it.each(SEED_COMPETENCIES.map((c) => [c.key, c] as const))("%s has anchors 1, 3 and 5 in both languages, written as behaviours", (_key, c) => {
    for (const level of [1, 3, 5] as const) {
      expect(c.anchors[level].tr.trim().length, `${level} tr`).toBeGreaterThan(20);
      expect(c.anchors[level].en.trim().length, `${level} en`).toBeGreaterThan(20);
      expect(anchorHint(c.anchors[level].tr, "tr"), `${level} tr`).toBeNull();
      expect(anchorHint(c.anchors[level].en, "en"), `${level} en`).toBeNull();
    }
  });

  it("keeps at most six tags on each side, every tag in both languages", () => {
    for (const c of SEED_COMPETENCIES) {
      expect(c.positive.length).toBeLessThanOrEqual(MAX_TAGS_PER_SIDE);
      expect(c.negative.length).toBeLessThanOrEqual(MAX_TAGS_PER_SIDE);
      for (const tag of [...c.positive, ...c.negative]) expect(tag.tr && tag.en).toBeTruthy();
    }
  });

  it("never uses an em dash", () => {
    expect(JSON.stringify({ DEFAULT_SCALE, SEED_COMPETENCIES })).not.toContain(String.fromCharCode(0x2014));
  });
});
