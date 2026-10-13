import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => {
  const inner = (await import("@/server/create/test-fake-db")).proxyDb(fake) as Record<string | symbol, unknown>;
  // The fake records chains; a transaction runs its callback on the same fake.
  const db = new Proxy(inner, { get: (target, prop) => (prop === "transaction" ? (fn: (tx: unknown) => unknown) => fn(inner) : target[prop]) });
  return { db };
});

import { readSheet, templateCsv } from "@/lib/exam/bank-sheet";
import { difficultyFor } from "@/lib/exam/difficulty";
import { bulkApproveItems, importSheetRows, saveBankItem } from "./bank-items";
import type { SaveItemInput } from "@/components/panel/item-editor-model";

const manager: SessionUser = { id: "u1", orgId: "o1", email: "m@x", name: "M", role: "MANAGER" };
const reviewer: SessionUser = { ...manager, role: "REVIEWER" };

const calls = (op: string) => fake.calls.filter(([o]) => o === op).map(([, a]) => a[0]);

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
});

describe("importSheetRows", () => {
  it("writes the template as drafts of origin TEACHER, one shared text, Kolay / Orta / Zor as numbers", async () => {
    const sheet = readSheet(templateCsv("tr").text);
    if (!sheet.ok) throw new Error("template");
    fake.results = [[{ id: "stim-1" }], Array.from({ length: 7 }, (_, i) => ({ id: `item-${i}` })), []];
    const r = await importSheetRows(manager, sheet.rows, { section: "GRAMMAR", level: "B1", within: "HARD" }, {});
    expect(r.created).toBe(7);
    expect(r.failed).toEqual([]);

    const [stimulus, rows, audit] = calls("values") as [Record<string, unknown>, Array<Record<string, unknown>>, Record<string, unknown>];
    expect(stimulus).toMatchObject({ orgId: "o1", section: "READING", level: "A2", title: "Neue Nachbarin", origin: "TEACHER", createdBy: "u1", speakers: null });
    expect(rows).toHaveLength(7);
    for (const row of rows) expect(row).toMatchObject({ orgId: "o1", status: "DRAFT", origin: "TEACHER", createdBy: "u1", level: "A2" });
    // The template's TFNG row says Kolay; the others take the file's default, Zor.
    expect(rows.map((x) => x.difficulty)).toEqual([
      difficultyFor("A2", "HARD"),
      difficultyFor("A2", "HARD"),
      difficultyFor("A2", "EASY"),
      difficultyFor("A2", "HARD"),
      difficultyFor("A2", "HARD"),
      difficultyFor("A2", "HARD"),
      difficultyFor("A2", "HARD"),
    ]);
    // The reading questions hang off the one text, in file order.
    expect(rows.filter((x) => x.stimulusId === "stim-1").map((x) => [x.type, x.orderInStimulus])).toEqual([
      ["TRUE_FALSE_NG", 1],
      ["MATCHING", 2],
    ]);
    expect(rows.find((x) => x.type === "SINGLE_CHOICE")).toMatchObject({ stimulusId: null, orderInStimulus: 0, skillTag: "grammar.teacher" });
    expect(audit).toMatchObject({ action: "bank.import", meta: { created: 7, failed: 0, texts: 1 } });
  });

  it("leaves broken rows out and writes nothing when no row is valid", async () => {
    const rows = [{ line: 2, cells: { type: "SINGLE_CHOICE", question: "kaputt", answer: "a" } }];
    const r = await importSheetRows(manager, rows, { section: "GRAMMAR", level: "B1", within: "MID" }, {});
    expect(r.created).toBe(0);
    expect(r.failed.map((f) => f.line)).toEqual([2]);
    expect(fake.calls).toEqual([]);
  });
});

const choiceInput = (over: Partial<SaveItemInput> = {}): SaveItemInput => ({
  id: "6f1d3b8e-8f43-4a8c-9f0e-0a9a7c1e2b3d",
  type: "SINGLE_CHOICE",
  section: "GRAMMAR",
  level: "A2",
  within: "HARD",
  prompt: "Ich ___ müde.",
  content: { kind: "CHOICE", options: [{ id: "a", text: "bin" }, { id: "b", text: "bist" }, { id: "c", text: "ist" }] },
  key: { kind: "CHOICE", correct: ["a"] },
  rubric: null,
  explanation: "",
  text: null,
  ...over,
});

describe("saveBankItem", () => {
  const existing = (over: Record<string, unknown> = {}) => [{ id: "6f1d3b8e-8f43-4a8c-9f0e-0a9a7c1e2b3d", type: "SINGLE_CHOICE", section: "GRAMMAR", level: "A2", difficulty: -1.25, status: "APPROVED", ...over }];

  it("keeps an approved item approved, records who approved the saved version, and keeps a calibrated difficulty in the same band", async () => {
    fake.results = [existing()];
    expect(await saveBankItem(manager, choiceInput())).toEqual({ ok: true, id: "6f1d3b8e-8f43-4a8c-9f0e-0a9a7c1e2b3d", status: "APPROVED" });
    const [set] = calls("set") as Array<Record<string, unknown>>;
    expect(set).not.toHaveProperty("status");
    expect(set).toMatchObject({ prompt: "Ich ___ müde.", level: "A2", difficulty: -1.25, reviewedBy: "u1" });
    expect(calls("values")).toEqual([expect.objectContaining({ action: "bank.edit", subjectId: "6f1d3b8e-8f43-4a8c-9f0e-0a9a7c1e2b3d", meta: { status: "APPROVED" } })]);
  });

  it("moves the number when the word changes", async () => {
    fake.results = [existing({ status: "DRAFT" })];
    await saveBankItem(manager, choiceInput({ within: "EASY" }));
    const [set] = calls("set") as Array<Record<string, unknown>>;
    expect(set.difficulty).toBe(difficultyFor("A2", "EASY"));
    expect(set).not.toHaveProperty("reviewedBy");
  });

  it("refuses an invalid item before touching the database", async () => {
    const res = await saveBankItem(manager, choiceInput({ key: { kind: "CHOICE", correct: [] } }));
    expect(res).toEqual({ ok: false, code: "INVALID", problems: [{ code: "SINGLE_KEY_COUNT" }] });
    expect(fake.calls).toEqual([]);
  });

  it("refuses an approved item to someone who may not approve, and a changed type", async () => {
    fake.results = [existing()];
    expect(await saveBankItem(reviewer, choiceInput())).toEqual({ ok: false, code: "NO_RIGHT" });
    fake.results = [existing({ type: "MULTI_CHOICE" })];
    expect(await saveBankItem(manager, choiceInput())).toEqual({ ok: false, code: "LOCKED" });
    fake.results = [[]];
    expect(await saveBankItem(manager, choiceInput())).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(calls("set")).toEqual([]);
  });

  it("creates a draft, with its own reading text when given, and refuses listening without a script", async () => {
    fake.results = [[{ id: "stim-9" }], [{ id: "new-1" }], []];
    const res = await saveBankItem(manager, choiceInput({ id: null, section: "READING", text: { title: "", body: "Ein kurzer Text über das Wetter in Berlin heute." } }));
    expect(res).toEqual({ ok: true, id: "new-1", status: "DRAFT" });
    const [stim, item, audit] = calls("values") as Array<Record<string, unknown>>;
    expect(stim).toMatchObject({ section: "READING", title: "Ein kurzer Text über das Wetter ...", origin: "TEACHER" });
    expect(item).toMatchObject({ status: "DRAFT", origin: "TEACHER", stimulusId: "stim-9", orderInStimulus: 1, difficulty: difficultyFor("A2", "HARD") });
    expect(audit).toMatchObject({ action: "bank.create", subjectId: "new-1" });

    fake.calls = [];
    expect(await saveBankItem(manager, choiceInput({ id: null, section: "LISTENING" }))).toEqual({ ok: false, code: "NEEDS_TEXT" });
    expect(await saveBankItem(manager, choiceInput({ id: null, section: "WRITING" }))).toEqual({ ok: false, code: "TYPE" });
    expect(fake.calls).toEqual([]);
  });
});

describe("bulkApproveItems", () => {
  const good = { type: "SINGLE_CHOICE", section: "GRAMMAR", prompt: "Ich ___ müde.", content: { kind: "CHOICE", options: [{ id: "a", text: "bin" }, { id: "b", text: "bist" }, { id: "c", text: "ist" }] }, answerKey: { kind: "CHOICE", correct: ["a"] }, rubric: null, status: "DRAFT", audioKey: null };

  it("approves only what the single approval would, and counts the rest", async () => {
    fake.results = [
      [
        { ...good, id: "ok-1" },
        { ...good, id: "bad-1", answerKey: { kind: "CHOICE", correct: [] } },
        { ...good, id: "listen-1", section: "LISTENING" },
        { ...good, id: "listen-2", section: "LISTENING", audioKey: "bank/audio/x.mp3" },
        { ...good, id: "done-1", status: "APPROVED" },
      ],
    ];
    const r = await bulkApproveItems(manager, ["ok-1", "bad-1", "listen-1", "listen-2", "done-1", "gone-1", "ok-1"]);
    expect(r).toEqual({ approved: 2, invalid: 1, noAudio: 1, skipped: 3 });
    expect(calls("set")).toEqual([expect.objectContaining({ status: "APPROVED", reviewedBy: "u1" })]);
    const audit = calls("values")[0] as Array<Record<string, unknown>>;
    expect(audit.map((a) => [a.action, a.subjectId, a.meta])).toEqual([
      ["bank.approved", "ok-1", { via: "bulk" }],
      ["bank.approved", "listen-2", { via: "bulk" }],
    ]);
  });

  it("writes nothing when nothing passes", async () => {
    fake.results = [[{ ...good, id: "bad-1", prompt: "" }]];
    expect(await bulkApproveItems(manager, ["bad-1"])).toEqual({ approved: 0, invalid: 1, noAudio: 0, skipped: 0 });
    expect(calls("set")).toEqual([]);
  });
});
