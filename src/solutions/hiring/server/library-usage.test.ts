import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { usageFromRows } from "./library-usage";

describe("hiring library usage", () => {
  it("counts each opening once per library row and marks it live when a published version of an open opening uses it", () => {
    const usage = usageFromRows([
      { ref: "c1", openingId: "o1", name: "Tasarımcı · Ekim", live: false },
      { ref: "c1", openingId: "o1", name: "Tasarımcı · Ekim", live: true },
      { ref: "c1", openingId: "o2", name: "Destek · Kasım", live: false },
      { ref: "c2", openingId: "o2", name: "Destek · Kasım", live: false },
    ]);
    expect(usage.c1).toEqual({
      total: 2,
      live: 1,
      items: [
        { label: "Tasarımcı · Ekim", href: "/hiring/openings/o1" },
        { label: "Destek · Kasım", href: "/hiring/openings/o2" },
      ],
    });
    expect(usage.c2.total).toBe(1);
    expect(usage.c2.live).toBe(0);
  });
});
