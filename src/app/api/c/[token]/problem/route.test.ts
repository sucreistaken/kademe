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
  /** Where each write ran: "tx" inside the route's transaction, "db" outside it. */
  via: [] as string[],
  /** The executor fileCandidateRequestIn was handed. */
  fileExecutor: null as unknown,
  /** fileCandidateRequestIn's answer: false when a request of that kind is already open (dedup, Task 3 carry). */
  filed: true,
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
  const executor = (via: string) => ({
    insert: (table: never) => ({
      values: async (values: Record<string, unknown>) => {
        h.via.push(via);
        h.inserted.push({ table: getTableName(table), values });
      },
    }),
  });
  const tx = executor("tx");
  return { db: { ...executor("db"), transaction: async <T>(fn: (t: unknown) => Promise<T>) => fn(tx) } };
});
vi.mock("@/server/candidate-requests", () => ({
  // The dedup lives in fileCandidateRequestIn (its own test); a filed request is recorded like an insert.
  fileCandidateRequestIn: async (x: unknown, values: Record<string, unknown>) => {
    h.fileExecutor = x ?? null;
    if (h.filed) {
      h.via.push(x ? "tx" : "db");
      h.inserted.push({ table: "candidate_requests", values });
    }
    return { filed: h.filed };
  },
}));
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
  h.via = [];
  h.fileExecutor = null;
  h.filed = true;
  h.solution = HIRING;
  h.ctx.assessment.solution = "HIRING";
});

describe("problem route", () => {
  it("files a new-link request in the invitation's organisation, next to the outbox message, in one transaction", async () => {
    expect((await send({ area: "LINK", message: "Aday yeni link talep etti." })).status).toBe(200);
    expect(h.inserted.map((i) => i.table).sort()).toEqual(["candidate_requests", "message_outbox"]);
    // Both writes, or neither: the request and the team's mail run in the route's transaction.
    expect(h.via).toEqual(["tx", "tx"]);
    expect(h.fileExecutor).not.toBeNull();
    expect(h.inserted.find((i) => i.table === "candidate_requests")?.values).toEqual({
      orgId: "o1",
      assessmentId: "a1",
      kind: "NEW_LINK",
      message: "Aday yeni link talep etti.",
    });
  });

  it("answers the same to a second new-link request while the first is open, filing nothing new and mailing the team nothing new", async () => {
    h.filed = false;
    const res = await send({ area: "LINK", message: "Tekrar" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true });
    expect(h.inserted).toEqual([]);
  });

  it("bounds the new-link note to the 2000 the table allows", async () => {
    await send({ area: "LINK", message: "y".repeat(2600) });
    expect(h.inserted.find((i) => i.table === "candidate_requests")?.values.message).toBe("y".repeat(2000));
  });

  it("files no new-link request where the solution does not read them (the exam), only the problem report and the mail", async () => {
    h.solution = EXAM;
    h.ctx.assessment.solution = "LANGUAGE_EXAM";
    await send({ area: "LINK", message: "Yeni link" });
    expect(h.inserted.filter((i) => i.table === "candidate_requests").map((i) => i.values.kind)).toEqual(["PROBLEM"]);
    expect(h.inserted.map((i) => i.table).sort()).toEqual(["candidate_requests", "message_outbox"]);
  });

  it("files an exam report as a PROBLEM request (area: note) in the same transaction as the outbox row, and keeps the mail", async () => {
    h.solution = EXAM;
    h.ctx.assessment.solution = "LANGUAGE_EXAM";
    expect((await send({ area: "EXAM_END", message: "  Das Audio ist ausgefallen.  " })).status).toBe(200);
    expect(h.inserted.map((i) => i.table).sort()).toEqual(["candidate_requests", "message_outbox"]);
    expect(h.via).toEqual(["tx", "tx"]);
    expect(h.inserted.find((i) => i.table === "candidate_requests")?.values).toEqual({
      orgId: "o1",
      assessmentId: "a1",
      kind: "PROBLEM",
      message: "EXAM_END: Das Audio ist ausgefallen.",
    });
    expect(outbox()).toMatchObject({ kind: "STUDENT_PROBLEM", subject: "Öğrenci sorun bildirdi: Elif Kaya (EXAM_END)" });
  });

  it("files a PROBLEM request for every report (no dedupe)", async () => {
    h.solution = EXAM;
    h.ctx.assessment.solution = "LANGUAGE_EXAM";
    await send({ area: "EXAM_END", message: "bir" });
    await send({ area: "EXAM_END", message: "iki" });
    expect(h.inserted.filter((i) => i.table === "candidate_requests").map((i) => i.values.message)).toEqual(["EXAM_END: bir", "EXAM_END: iki"]);
  });

  it("files a report with no words as its area alone", async () => {
    h.solution = EXAM;
    h.ctx.assessment.solution = "LANGUAGE_EXAM";
    await send({ area: "SYSTEM_CHECK", message: "" });
    expect(h.inserted.find((i) => i.table === "candidate_requests")?.values.message).toBe("SYSTEM_CHECK");
  });

  it("bounds an exam report to the 2000 the table allows", async () => {
    h.solution = EXAM;
    h.ctx.assessment.solution = "LANGUAGE_EXAM";
    await send({ area: "EXAM_END", message: "y".repeat(2600) });
    const message = h.inserted.find((i) => i.table === "candidate_requests")?.values.message as string;
    expect(message).toHaveLength(2000);
    expect(message.startsWith("EXAM_END: yy")).toBe(true);
  });

  it("files no PROBLEM request for hiring (its behaviour is unchanged)", async () => {
    await send({ area: "HELP", message: "Yardım" });
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
