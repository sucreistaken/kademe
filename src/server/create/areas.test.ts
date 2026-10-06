import { describe, expect, it, vi } from "vitest";
import type { SolutionModule } from "@/solutions/types";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/solutions/registry.server", () => ({ solutionModules: () => [] }));
vi.mock("@/server/library", () => ({
  listPositions: async () => [{ archivedAt: null }, { archivedAt: new Date() }],
  listCompetencies: async () => [{ archivedAt: null }, { archivedAt: null }],
}));

import { advancedAreaCards } from "./areas";

describe("advancedAreaCards", () => {
  it("puts the solutions' cards first, then the library's, counting active rows", async () => {
    const modules = [
      {},
      { advancedCards: async (orgId: string) => [{ key: "exams", title: "Sınavlar", lines: [`org ${orgId}`], href: "/exam/exams" }] },
    ] as unknown as SolutionModule[];
    const cards = await advancedAreaCards("o1", "tr", modules);
    expect(cards.map((c) => [c.key, c.title, c.lines, c.href])).toEqual([
      ["exams", "Sınavlar", ["org o1"], "/exam/exams"],
      ["positions", "Pozisyonlar", ["1 pozisyon"], "/library/positions"],
      ["competencies", "Yetkinlikler", ["2 yetkinlik"], "/library/competencies"],
    ]);
  });
});
