import { describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("@/server/create/test-fake-db")).proxyDb(fake) }));

import { examAdvancedCards } from "./advanced-cards";

describe("examAdvancedCards", () => {
  it("counts the exams that are not archived and the bank's approved and pending questions", async () => {
    fake.results = [[{ n: 3 }], [{ status: "APPROVED", n: 40 }, { status: "DRAFT", n: 5 }]];
    expect(await examAdvancedCards("o1", "tr")).toEqual([
      { key: "exams", title: "Sınavlar", lines: ["3 sınav"], href: "/exam/exams" },
      { key: "bank", title: "Soru bankası", lines: ["40 onaylı soru", "5 soru onay bekliyor"], href: "/exam/bank" },
    ]);
  });
});
