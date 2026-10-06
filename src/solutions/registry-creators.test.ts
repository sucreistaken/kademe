import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

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
