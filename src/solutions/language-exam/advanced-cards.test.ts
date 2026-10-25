import { describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("@/server/create/test-fake-db")).proxyDb(fake) }));

// The feedback totals have their own tests (src/server/exam-feedback.test.ts); here only the card is read.
const totals = vi.hoisted(() => ({ value: { count: 0, averageOverall: null as number | null, averageClarity: null, averageUsability: null, technicalAnswered: 0, technicalYes: 0 } }));
vi.mock("@/server/exam-feedback", () => ({ feedbackTotals: async () => totals.value }));

import { examAdvancedCards } from "./advanced-cards";

describe("examAdvancedCards", () => {
  it("counts the exams that are not archived and the bank's approved and pending questions, and shows the feedback card", async () => {
    fake.results = [[{ n: 3 }], [{ status: "APPROVED", n: 40 }, { status: "DRAFT", n: 5 }]];
    totals.value = { ...totals.value, count: 12, averageOverall: 4.3 };
    expect(await examAdvancedCards("o1", "tr")).toEqual([
      { key: "exams", title: "Sınavlar", lines: ["3 sınav"], href: "/exam/exams" },
      { key: "bank", title: "Soru bankası", lines: ["40 onaylı soru", "5 soru onay bekliyor"], href: "/exam/bank" },
      { key: "feedback", title: "Öğrenci geri bildirimleri", lines: ["12 yanıt", "Ortalama 5 üzerinden 4,3"], href: "/exam/feedback", linkLabel: "Geri bildirimleri aç" },
    ]);
  });

  it("says there is no feedback yet instead of an average of nothing", async () => {
    fake.results = [[{ n: 0 }], []];
    totals.value = { ...totals.value, count: 0, averageOverall: null };
    const cards = await examAdvancedCards("o1", "en");
    expect(cards.at(-1)).toEqual({ key: "feedback", title: "Student feedback", lines: ["No responses yet"], href: "/exam/feedback", linkLabel: "Open feedback" });
  });
});
