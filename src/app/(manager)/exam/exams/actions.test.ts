import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBlueprint } from "@/lib/exam/blueprint";
import { examTemplateByKey } from "@/lib/exam/templates";
import { PRESETS } from "@/lib/proctor/policy";
import type { CreateExamInput } from "./actions";

/** createExamAction (the exam wizard's last step) with a fake database that records what it inserts. */
const inserted: Array<Record<string, unknown>> = [];
const store = vi.hoisted(() => ({ locale: "tr" as "tr" | "en", coverageOk: true, coverageCalls: 0 }));

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
vi.mock("@/lib/exam/blueprint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/exam/blueprint")>()),
  bankCoverage: () => {
    store.coverageCalls += 1;
    return { ok: store.coverageOk, rows: [] };
  },
}));

import { createExamAction } from "./actions";

const blueprintRow = () => inserted.find((v) => v.config) as Record<string, unknown> & { config: ReturnType<typeof defaultBlueprint> };
const audits = () => inserted.filter((v) => v.action).map((v) => v.action);
const choicesOf = (config: ReturnType<typeof defaultBlueprint>) => config.sections.map((s) => ({ section: s.section, enabled: s.enabled, minutes: s.durationMinutes }));

const placement = examTemplateByKey("placement")!;
const base = (over: Partial<CreateExamInput> = {}): CreateExamInput => ({
  start: { kind: "template", key: "placement" },
  name: "",
  sections: choicesOf(placement.config),
  preset: placement.config.proctoring.preset,
  publish: true,
  ...over,
});

beforeEach(() => {
  inserted.length = 0;
  store.locale = "tr";
  store.coverageOk = true;
  store.coverageCalls = 0;
});

describe("createExamAction", () => {
  it("publishes the template unchanged under its name in the manager's language", async () => {
    const r = await createExamAction(base());
    expect(r).toEqual({ ok: true, id: "b1", name: placement.name.tr, status: "PUBLISHED" });
    expect(blueprintRow()).toMatchObject({ orgId: "o1", name: placement.name.tr, mode: "PLACEMENT", status: "PUBLISHED", config: placement.config, createdBy: "u1" });
    expect(blueprintRow().publishedAt).toBeInstanceOf(Date);
    expect(audits()).toEqual(["blueprint.create", "blueprint.publish"]);
    expect(store.coverageCalls).toBe(1);
  });

  it("names the template in English for an English panel, and a typed name wins", async () => {
    store.locale = "en";
    await createExamAction(base());
    expect(blueprintRow().name).toBe(placement.name.en);
    inserted.length = 0;
    expect(await createExamAction(base({ name: "  B1 Kurs Mai " }))).toMatchObject({ ok: true, name: "B1 Kurs Mai" });
    expect(blueprintRow().name).toBe("B1 Kurs Mai");
  });

  it("applies the sections, the minutes (held to 1..180) and the watching level", async () => {
    const sections = choicesOf(placement.config).map((c) =>
      c.section === "LISTENING" ? { ...c, enabled: false } : c.section === "GRAMMAR" ? { ...c, minutes: 999 } : c.section === "READING" ? { ...c, minutes: 20 } : c,
    );
    await createExamAction(base({ sections, preset: "OFF" }));
    const config = blueprintRow().config;
    expect(config.sections.find((s) => s.section === "LISTENING")?.enabled).toBe(false);
    expect(config.sections.find((s) => s.section === "GRAMMAR")?.durationMinutes).toBe(180);
    expect(config.sections.find((s) => s.section === "READING")?.durationMinutes).toBe(20);
    // Everything else of a section stays as the template had it.
    expect(config.sections.find((s) => s.section === "GRAMMAR")).toMatchObject({ adaptive: true, cTest: true, minItems: 10, maxItems: 16 });
    expect(config.proctoring).toEqual(PRESETS.OFF);
    expect(config.sections.map((s) => s.section)).toEqual(placement.config.sections.map((s) => s.section));
  });

  it("blank start: the mode's default config and the default name in the manager's language", async () => {
    const config = defaultBlueprint("LEVEL_VERIFICATION");
    const r = await createExamAction(base({ start: { kind: "blank", mode: "LEVEL_VERIFICATION" }, sections: choicesOf(config), preset: "STRICT" }));
    expect(r).toMatchObject({ ok: true, name: "Seviye doğrulama sınavı" });
    expect(blueprintRow()).toMatchObject({ mode: "LEVEL_VERIFICATION", config });
    store.locale = "en";
    inserted.length = 0;
    await createExamAction(base({ start: { kind: "blank", mode: "PLACEMENT" }, sections: choicesOf(defaultBlueprint("PLACEMENT")), preset: "STRICT" }));
    expect(blueprintRow()).toMatchObject({ name: "Placement test", mode: "PLACEMENT" });
  });

  it("a draft skips the bank check and opens as DRAFT", async () => {
    store.coverageOk = false;
    const r = await createExamAction(base({ publish: false }));
    expect(r).toMatchObject({ ok: true, status: "DRAFT" });
    expect(blueprintRow()).toMatchObject({ status: "DRAFT" });
    expect(blueprintRow().publishedAt).toBeUndefined();
    expect(audits()).toEqual(["blueprint.create"]);
    expect(store.coverageCalls).toBe(0);
  });

  it("does not publish what the bank cannot fill, and writes nothing", async () => {
    store.coverageOk = false;
    expect(await createExamAction(base())).toEqual({ ok: false, code: "COVERAGE" });
    expect(inserted).toEqual([]);
  });

  it("refuses an unknown template and an exam with no section on", async () => {
    expect(await createExamAction(base({ start: { kind: "template", key: "toefl" } }))).toEqual({ ok: false, code: "TEMPLATE" });
    expect(await createExamAction(base({ sections: choicesOf(placement.config).map((c) => ({ ...c, enabled: false })) }))).toEqual({ ok: false, code: "NO_SECTION" });
    expect(await createExamAction(base({ sections: [{ section: "BOGUS" as never, enabled: true, minutes: 10 }] }))).toEqual({ ok: false, code: "NO_SECTION" });
    expect(inserted).toEqual([]);
  });

  it("an unknown watching level falls back to STANDARD", async () => {
    await createExamAction(base({ preset: "PARANOID" as never }));
    expect(blueprintRow().config.proctoring).toEqual(PRESETS.STANDARD);
  });
});
