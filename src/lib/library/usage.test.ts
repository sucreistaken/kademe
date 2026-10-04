import { describe, expect, it } from "vitest";
import { groupUsage, liveCount } from "./usage";

const entry = (total: number, live: number) => ({ total, live, items: [{ label: `x${total}`, href: `/x/${total}` }] });

describe("library usage", () => {
  it("groups each library row's usage by solution and skips solutions that do not use it", () => {
    const grouped = groupUsage(
      [
        { solution: "hiring", label: "İşe alım", usage: { positions: { p1: entry(2, 1) }, competencies: { c1: entry(3, 2) } } },
        { solution: "other", label: "Başka", usage: { positions: {}, competencies: { c1: entry(0, 0), c2: entry(1, 0) } } },
      ],
      { positionIds: ["p1", "p2"], competencyIds: ["c1", "c2"] },
    );
    expect(grouped.positions.p1.map((g) => g.solution)).toEqual(["hiring"]);
    expect(grouped.positions.p2).toEqual([]);
    expect(grouped.competencies.c1.map((g) => g.label)).toEqual(["İşe alım"]);
    expect(grouped.competencies.c2.map((g) => g.solution)).toEqual(["other"]);
    expect(liveCount(grouped.competencies.c1)).toBe(2);
  });
});
