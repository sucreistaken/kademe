import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, type Op } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { hiringToday } from "./today";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const OP1 = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-05T09:00:00Z");
let role: "OWNER" | "MANAGER" | "REVIEWER";

function respond(op: Op): unknown[] {
  switch (op.table) {
    case "users":
      return [{ role }];
    case "candidate_requests":
      return [
        { id: "cr1", kind: "ACCOMMODATION", message: "Video yerine yazılı cevap verebilir miyim?", createdAt: new Date("2026-10-05T08:58:00Z"), name: "Ece Bal", openingId: OP1, openingName: "Ürün Tasarımcısı" },
        { id: "cr2", kind: "NEW_LINK", message: null, createdAt: new Date("2026-10-04T08:00:00Z"), name: "Can Demir", openingId: OP1, openingName: "Ürün Tasarımcısı" },
      ];
    case "deletion_requests":
      return [
        { id: "dr1", createdAt: new Date("2026-10-03T08:00:00Z"), openingId: OP1, openingName: "Ürün Tasarımcısı" },
        // The same request again through a second invitation of the same person: counted once.
        { id: "dr1", createdAt: new Date("2026-10-03T08:00:00Z"), openingId: OP1, openingName: "Ürün Tasarımcısı" },
      ];
    case "assessment_links":
      return [{ openingId: OP1, openingName: "Ürün Tasarımcısı" }, { openingId: OP1, openingName: "Ürün Tasarımcısı" }];
    case "hiring_versions":
      return [{ openingId: OP1, openingName: "Ürün Tasarımcısı", number: 2 }];
    default:
      return [];
  }
}

beforeEach(() => {
  role = "OWNER";
  fake.ops = [];
  fake.respond = respond;
});

describe("hiring's rows on Today (HIRING-VISUAL-FLOW 4.3, M2)", () => {
  it("gives a reviewer nothing and reads nothing past the role (STATUS 321: requests are for who runs the opening)", async () => {
    role = "REVIEWER";
    expect(await hiringToday(ORG, USER, "tr", NOW)).toEqual([]);
    expect(fake.ops.map((o) => o.table)).toEqual(["users"]);
  });

  it("offers each accommodation request as a possible next task; never a data-rights or a new-link request (ruling C6)", async () => {
    const tasks = (await hiringToday(ORG, USER, "tr", NOW)).filter((i) => i.lane === "task");
    expect(tasks.map((t) => [t.task, t.title])).toEqual([["ACCOMMODATION", "Ece Bal bir uyarlama istedi"]]);
    expect(tasks[0]).toMatchObject({ solution: "hiring", subtitle: "Ürün Tasarımcısı", detail: "Video yerine yazılı cevap verebilir miyim?", href: `/hiring/openings/${OP1}/candidates` });
  });

  it("lists per opening: open requests (data rights counted once, with a plain note), links expiring within 48 hours, a draft waiting with 'Kuruluma devam et'", async () => {
    const rows = (await hiringToday(ORG, USER, "tr", NOW)).filter((i) => i.lane === "attention");
    expect(rows.map((r) => [r.attention, r.title, r.subtitle, r.href])).toEqual([
      ["requests", "3 açık talep", "Ürün Tasarımcısı", `/hiring/openings/${OP1}/candidates`],
      ["expiring", "2 link 48 saatte doluyor", "Ürün Tasarımcısı", `/hiring/openings/${OP1}/candidates`],
      ["draft", "Taslak v2 yayın bekliyor", "Ürün Tasarımcısı", `/hiring/openings/${OP1}`],
    ]);
    expect(rows[0]).toMatchObject({ detail: "Biri veri hakkı talebi; panelden henüz kapatılmaz.", sortAt: new Date("2026-10-03T08:00:00Z") });
    expect(rows[2].actionLabel).toBe("Kuruluma devam et");
    expect(rows[1].detail ?? null).toBeNull();
  });

  it("reads only this organisation's rows and only open requests", async () => {
    await hiringToday(ORG, USER, "tr", NOW);
    for (const op of fake.ops) expect(op.params, op.table).toContain(ORG);
    expect(fake.ops.find((o) => o.table === "candidate_requests")!.where).toMatch(/"handled_at" is null/);
    expect(fake.ops.find((o) => o.table === "deletion_requests")!.where).toMatch(/"handled_at" is null/);
  });

  it("leaves out deleted candidates and closed openings, as the Candidates tab does (fix round 1)", async () => {
    await hiringToday(ORG, USER, "tr", NOW);
    const op = (table: string) => fake.ops.find((o) => o.table === table)!;
    const deletedFilter = /"candidates"\."deleted_at" is null/;
    expect(op("candidate_requests").joins.join(" "), "requests").toMatch(deletedFilter);
    expect(op("deletion_requests").joins.join(" "), "data rights").toMatch(deletedFilter);
    expect(op("assessment_links").joins.join(" "), "expiring links").toMatch(deletedFilter);
    expect(op("assessment_links").where).toMatch(/"hiring_openings"\."status" <> \$\d+/);
    expect(op("assessment_links").params).toContain("CLOSED");
    expect(op("hiring_versions").where).toMatch(/"hiring_openings"\."status" <> \$\d+/);
  });

  it("shortens a long request to 140 characters by code points, never splitting an emoji (fix round 1)", async () => {
    const long = "😀".repeat(200);
    fake.respond = (op) =>
      op.table === "candidate_requests"
        ? [{ id: "cr9", kind: "ACCOMMODATION", message: long, createdAt: new Date("2026-10-05T08:00:00Z"), name: "Ece Bal", openingId: OP1, openingName: "Ürün Tasarımcısı" }]
        : respond(op);
    const [task] = (await hiringToday(ORG, USER, "tr", NOW)).filter((i) => i.lane === "task");
    const points = Array.from(task.detail!);
    expect(points).toHaveLength(140);
    expect(points.slice(0, 139).every((p) => p === "😀")).toBe(true);
    expect(points[139]).toBe("…");
    expect(task.detail).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });

  it("keeps a request of exactly 140 characters whole", async () => {
    const exact = "a".repeat(139) + "😀";
    fake.respond = (op) =>
      op.table === "candidate_requests"
        ? [{ id: "cr9", kind: "ACCOMMODATION", message: exact, createdAt: new Date("2026-10-05T08:00:00Z"), name: "Ece Bal", openingId: OP1, openingName: "Ürün Tasarımcısı" }]
        : respond(op);
    const [task] = (await hiringToday(ORG, USER, "tr", NOW)).filter((i) => i.lane === "task");
    expect(task.detail).toBe(exact);
  });

  it("runs its reads one after another, never side by side (ruling C21: five connections shared with the live exam)", async () => {
    // A read that starts before the one before it answered would find more statements recorded than answered.
    const seen: number[] = [];
    fake.respond = (op) => {
      seen.push(fake.ops.length);
      return respond(op);
    };
    await hiringToday(ORG, USER, "tr", NOW);
    expect(fake.ops.map((o) => o.table)).toEqual(["users", "candidate_requests", "deletion_requests", "assessment_links", "hiring_versions"]);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });
});
