import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SessionUser } from "@/lib/auth";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => {
  const inner = (await import("@/server/create/test-fake-db")).proxyDb(fake) as Record<string | symbol, unknown>;
  return { db: new Proxy(inner, { get: (target, prop) => (prop === "transaction" ? (fn: (tx: unknown) => unknown) => fn(inner) : target[prop]) }) };
});

import { bankItem } from "./bank-scope";
import { bulkApproveItems, saveBankItem } from "./bank-items";
import type { SaveItemInput } from "@/components/panel/item-editor-model";

const manager: SessionUser = { id: "u1", orgId: "o1", email: "m@x", name: "M", role: "MANAGER" };
const dialect = new PgDialect();
const whereSql = (n = 0) => dialect.sqlToQuery(fake.calls.filter(([op]) => op === "where")[n][1][0] as never).sql;

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
});

/**
 * The bank screen shows the bank only (spec 2026-10-28, "Engine"): a course
 * test's rows are not listed, counted, opened, edited, approved or retired
 * there, not even by someone who knows an id.
 */
describe("the bank screen's scope", () => {
  it("is the organisation's rows without a course form", () => {
    const q = dialect.sqlToQuery(bankItem("o1")!);
    expect(q.sql).toBe('("items"."org_id" = $1 and "items"."course_form" is null)');
    expect(q.params).toEqual(["o1"]);
  });

  it("applies to the editor's save by id: a course row is not found", async () => {
    fake.results = [[]];
    const input: SaveItemInput = {
      id: "6f1d3b8e-8f43-4a8c-9f0e-0a9a7c1e2b3d",
      type: "SINGLE_CHOICE",
      section: "GRAMMAR",
      level: "A2",
      within: "MID",
      prompt: "Ich ___ müde.",
      content: { kind: "CHOICE", options: [{ id: "a", text: "bin" }, { id: "b", text: "bist" }, { id: "c", text: "ist" }] },
      key: { kind: "CHOICE", correct: ["a"] },
      rubric: null,
      explanation: "",
      text: null,
    };
    expect(await saveBankItem(manager, input)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(whereSql()).toContain('"items"."course_form" is null');
  });

  it("applies to the bulk approval: a course row is skipped, never approved", async () => {
    fake.results = [[]];
    const r = await bulkApproveItems(manager, ["6f1d3b8e-8f43-4a8c-9f0e-0a9a7c1e2b3d"]);
    expect(r).toEqual({ approved: 0, invalid: 0, noAudio: 0, skipped: 1 });
    expect(whereSql()).toContain('"items"."course_form" is null');
    expect(fake.calls.some(([op]) => op === "update")).toBe(false);
  });

  it("is the only way the bank screen's source filters items by organisation", () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && e.name !== "bank-scope.ts") files.push(p);
      }
    };
    walk(dir);
    // The list, the detail and edit pages, the actions and the writes are all in this folder.
    expect(files.map((f) => path.relative(dir, f)).sort()).toEqual(
      expect.arrayContaining(["[id]/edit/page.tsx", "[id]/page.tsx", "actions.ts", "bank-items.ts", "page.tsx"]),
    );
    const offenders = files.filter((f) => /\beq\(\s*items\.orgId\b/.test(readFileSync(f, "utf8"))).map((f) => path.relative(dir, f));
    expect(offenders, "start items queries from bankItem(orgId)").toEqual([]);
  });
});
