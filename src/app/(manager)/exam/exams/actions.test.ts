import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBlueprint } from "@/lib/exam/blueprint";
import { examTemplateByKey } from "@/lib/exam/templates";

/** createBlueprint with a fake database that records what it inserts. */
const inserted: Array<Record<string, unknown>> = [];
const store = { locale: "tr" as "tr" | "en" };

function insertChain() {
  let values: Record<string, unknown> = {};
  const chain = {
    values: (v: Record<string, unknown>) => {
      values = v;
      inserted.push(v);
      return chain;
    },
    returning: () => chain,
    then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(values.config ? [{ id: "b1", ...values }] : []).then(resolve, reject),
  };
  return chain;
}

vi.mock("@/db", () => ({ db: { insert: () => insertChain() } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("@/server/session", () => ({
  requireUser: async () => ({ id: "u1", orgId: "o1", email: "m@x", name: "M", role: "MANAGER" }),
}));
vi.mock("@/server/panel", () => ({ bankCounts: async () => [] }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => store.locale }));

import { createBlueprint } from "./actions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

const blueprintRow = () => inserted.find((v) => v.config);

beforeEach(() => {
  inserted.length = 0;
  store.locale = "tr";
});

describe("createBlueprint", () => {
  it("blank start: the mode's default config and default name, as before", async () => {
    await expect(createBlueprint(form({ name: "", mode: "LEVEL_VERIFICATION" }))).rejects.toThrow("REDIRECT /exam/exams/b1");
    expect(blueprintRow()).toMatchObject({ name: "Seviye doğrulama sınavı", mode: "LEVEL_VERIFICATION", status: "DRAFT", config: defaultBlueprint("LEVEL_VERIFICATION") });
  });

  it("blank start with an empty template field stays a blank start", async () => {
    await expect(createBlueprint(form({ name: "Mein Test", mode: "PLACEMENT", template: "" }))).rejects.toThrow("REDIRECT /exam/exams/b1");
    expect(blueprintRow()).toMatchObject({ name: "Mein Test", mode: "PLACEMENT", config: defaultBlueprint("PLACEMENT") });
  });

  it("a template gives its mode, config and name, whatever the mode radio says", async () => {
    const t = examTemplateByKey("level-check")!;
    await expect(createBlueprint(form({ name: "", mode: "PLACEMENT", template: "level-check" }))).rejects.toThrow("REDIRECT /exam/exams/b1");
    expect(blueprintRow()).toMatchObject({ name: t.name.tr, mode: "LEVEL_VERIFICATION", config: t.config });
  });

  it("names the exam in the manager's language", async () => {
    store.locale = "en";
    const t = examTemplateByKey("quick-screen")!;
    await expect(createBlueprint(form({ template: "quick-screen" }))).rejects.toThrow("REDIRECT /exam/exams/b1");
    expect(blueprintRow()).toMatchObject({ name: t.name.en, mode: "PLACEMENT", config: t.config });
  });

  it("a typed name beats the template's name", async () => {
    await expect(createBlueprint(form({ name: "  B1 Kurs Mai ", template: "placement" }))).rejects.toThrow("REDIRECT /exam/exams/b1");
    expect(blueprintRow()).toMatchObject({ name: "B1 Kurs Mai", config: examTemplateByKey("placement")!.config });
  });

  it("an unknown template creates nothing and goes back with an error", async () => {
    await expect(createBlueprint(form({ template: "toefl" }))).rejects.toThrow("REDIRECT /exam/exams/new?error=template");
    expect(inserted).toEqual([]);
  });
});
