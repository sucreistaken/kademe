import { beforeEach, describe, expect, it, vi } from "vitest";

type Inserted = { table: string; values: Record<string, unknown> };
type Served = { dbKind: string; label: { tr: string; en: string }; accommodationRequests: boolean; candidate: { title: () => Promise<string> } };

const HIRING: Served = {
  dbKind: "HIRING",
  label: { tr: "İşe alım", en: "Hiring" },
  accommodationRequests: true,
  candidate: { title: async () => "Ürün Tasarımcısı · Ekim" },
};
const EXAM: Served = {
  dbKind: "LANGUAGE_EXAM",
  label: { tr: "Sınav", en: "Language exam" },
  accommodationRequests: false,
  candidate: { title: async () => "Almanca Seviye Tespit" },
};

const h = vi.hoisted(() => ({
  inserted: [] as Inserted[],
  solution: null as unknown,
  ctx: {
    assessment: { id: "a1", orgId: "o1", solution: "HIRING" },
    candidate: { id: "c1", fullName: "Elif Kaya", email: "elif@example.com" },
    contactEmail: "ekip@example.com",
    locale: "tr",
  },
}));

vi.mock("@/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  return {
    db: {
      insert: (table: never) => ({ values: async (values: Record<string, unknown>) => void h.inserted.push({ table: getTableName(table), values }) }),
    },
  };
});
vi.mock("@/lib/candidate-api", () => ({
  withSolution: (req: unknown, _p: unknown, handler: (r: unknown, c: unknown, s: unknown) => unknown) => handler(req, h.ctx, h.solution),
  message: () => "Bildirimin işe alım ekibine iletildi.",
  readJson: async (req: Request) => req.json(),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const params = Promise.resolve({ token: "t".repeat(43) });
const send = (body: unknown) => POST(new NextRequest("http://localhost/api/c/x/problem", { method: "POST", body: JSON.stringify(body) }), { params });
const outbox = () => h.inserted.find((i) => i.table === "message_outbox")?.values;

beforeEach(() => {
  h.inserted = [];
  h.solution = HIRING;
  h.ctx.assessment.solution = "HIRING";
});

describe("problem route", () => {
  it("files a new-link request in the invitation's organisation, next to the outbox message", async () => {
    expect((await send({ area: "LINK", message: "Aday yeni link talep etti." })).status).toBe(200);
    expect(h.inserted.map((i) => i.table).sort()).toEqual(["candidate_requests", "message_outbox"]);
    expect(h.inserted.find((i) => i.table === "candidate_requests")?.values).toEqual({
      orgId: "o1",
      assessmentId: "a1",
      kind: "NEW_LINK",
      message: "Aday yeni link talep etti.",
    });
  });

  it("bounds the new-link note to the 2000 the table allows", async () => {
    await send({ area: "LINK", message: "y".repeat(2600) });
    expect(h.inserted.find((i) => i.table === "candidate_requests")?.values.message).toBe("y".repeat(2000));
  });

  it("files no request where the solution does not read them (the exam)", async () => {
    h.solution = EXAM;
    h.ctx.assessment.solution = "LANGUAGE_EXAM";
    await send({ area: "LINK", message: "Yeni link" });
    expect(h.inserted.map((i) => i.table)).toEqual(["message_outbox"]);
  });

  it("writes only the outbox message for any other area", async () => {
    await send({ area: "DEVICE_CHECK", message: "Kamera açılmıyor" });
    expect(h.inserted.map((i) => i.table)).toEqual(["message_outbox"]);
  });

  it("words the team's mail neutrally for a hiring candidate, never as a student or an exam", async () => {
    await send({ area: "DEVICE_CHECK", message: "Kamera açılmıyor" });
    const mail = outbox()!;
    expect(mail.subject).toBe("Aday sorun bildirdi: Elif Kaya (DEVICE_CHECK)");
    expect(mail.body).toBe(
      "Aday: Elif Kaya <elif@example.com>\n" +
        "Değerlendirme: İşe alım · Ürün Tasarımcısı · Ekim\n" +
        "Cevap adresi: elif@example.com\n" +
        "Alan: DEVICE_CHECK\n" +
        "Mesaj: Kamera açılmıyor\n" +
        "Tarayıcı: -",
    );
    expect(`${mail.subject}\n${mail.body}`).not.toMatch(/Öğrenci|Sınav/);
    expect(mail).toMatchObject({ orgId: "o1", kind: "STUDENT_PROBLEM", toEmail: "ekip@example.com" });
  });

  it("keeps the exam's mail exactly as it was", async () => {
    h.solution = EXAM;
    h.ctx.assessment.solution = "LANGUAGE_EXAM";
    await send({ area: "SYSTEM_CHECK", message: "" });
    const mail = outbox()!;
    expect(mail.subject).toBe("Öğrenci sorun bildirdi: Elif Kaya (SYSTEM_CHECK)");
    expect(mail.body).toBe(
      "Öğrenci: Elif Kaya <elif@example.com>\n" +
        "Sınav: Almanca Seviye Tespit\n" +
        "Cevap adresi: elif@example.com\n" +
        "Alan: SYSTEM_CHECK\n" +
        "Mesaj: -\n" +
        "Tarayıcı: -",
    );
  });
});
