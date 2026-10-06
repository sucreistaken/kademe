import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { routerJsonSchema } from "@/server/create/router";
import { creatorByKind, creatorsFor, solutionModule } from "./registry.server";
import type { Creator, SolutionModule } from "./types";

const fake = (kind: Creator["kind"], capability: Creator["capability"]): Creator => ({
  kind,
  capability,
  aiPurpose: null,
  label: { tr: kind, en: kind },
  routerGuide: "",
  paramsJsonSchema: { type: "object", properties: {} },
  validate: () => ({ ok: true, params: {} }),
  draft: async () => ({ ok: true, draft: {} }),
  apply: async () => ({ ok: false, code: "INVALID" }),
  renderReview: async () => null,
});

const modules = (): SolutionModule[] => [
  { ...solutionModule("HIRING")!, creators: [fake("POSITION", "library:write")] },
  { ...solutionModule("LANGUAGE_EXAM")!, creators: [fake("EXAM", "blueprint:write"), fake("QUESTION_SET", "bank:write")] },
];

describe("creators in the registry", () => {
  it("lists the creators a role may use, in registry order", () => {
    expect(creatorsFor({ role: "OWNER" }, modules()).map((c) => c.kind)).toEqual(["POSITION", "EXAM", "QUESTION_SET"]);
    expect(creatorsFor({ role: "MANAGER" }, modules()).map((c) => c.kind)).toEqual(["POSITION", "EXAM", "QUESTION_SET"]);
  });

  it("gives a reviewer no creator (no box, spec 4)", () => {
    expect(creatorsFor({ role: "REVIEWER" }, modules())).toEqual([]);
  });

  it("finds a creator by kind whoever asks, and null for none", () => {
    expect(creatorByKind("EXAM", modules())?.capability).toBe("blueprint:write");
    expect(creatorByKind("EXAM", [solutionModule("HIRING")!])).toBeNull();
  });
});

/** Keys Gemini's responseSchema accepts (src/lib/ai.ts GEMINI_SCHEMA_KEYS) plus additionalProperties, which toGeminiSchema drops. */
const ALLOWED = new Set(["type", "properties", "required", "items", "enum", "description", "nullable", "additionalProperties"]);
function badKeys(node: unknown, path = "$"): string[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => badKeys(n, `${path}[${i}]`));
  if (!node || typeof node !== "object") return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => {
    if (k === "properties") return Object.entries(v as Record<string, unknown>).flatMap(([name, child]) => badKeys(child, `${path}.${name}`));
    if (k === "enum") return (v as unknown[]).some((x) => x === "") ? [`${path}.enum has ""`] : [];
    return ALLOWED.has(k) ? badKeys(v, `${path}.${k}`) : [`${path}.${k}`];
  });
}

describe("the registered creators", () => {
  it("are POSITION from hiring, then EXAM and QUESTION_SET from the exam", () => {
    expect(creatorsFor({ role: "OWNER" }).map((c) => c.kind)).toEqual(["POSITION", "EXAM", "QUESTION_SET"]);
    expect(creatorsFor({ role: "MANAGER" }).map((c) => c.kind)).toEqual(["POSITION", "EXAM", "QUESTION_SET"]);
    expect(creatorsFor({ role: "REVIEWER" })).toEqual([]);
  });

  it("give the router a schema Gemini accepts, with no empty enum value", () => {
    expect(badKeys(routerJsonSchema(creatorsFor({ role: "OWNER" })))).toEqual([]);
  });

  it("write no em dash into the router guide", () => {
    for (const c of creatorsFor({ role: "OWNER" })) expect(c.routerGuide).not.toContain("\u2014");
  });
});
