import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth";
import type * as LibraryWrite from "@/server/library-write";

/**
 * The library server actions run the real session check (`requireUser` and
 * `authorize`) against a faked session; the writes underneath are spies, so a
 * refused call is proven to write nothing.
 */
let current: SessionUser | null = null;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  resolveSession: async () => current,
}));

const startLibrary = vi.fn<typeof LibraryWrite.startLibrary>();
const createCompetency = vi.fn<typeof LibraryWrite.createCompetency>();
const saveCompetency = vi.fn<typeof LibraryWrite.saveCompetency>();
const setCompetencyArchived = vi.fn<typeof LibraryWrite.setCompetencyArchived>();
const saveScaleLabels = vi.fn<typeof LibraryWrite.saveScaleLabels>();
vi.mock("@/server/library-write", () => ({
  startLibrary: (...a: Parameters<typeof LibraryWrite.startLibrary>) => startLibrary(...a),
  createCompetency: (...a: Parameters<typeof LibraryWrite.createCompetency>) => createCompetency(...a),
  saveCompetency: (...a: Parameters<typeof LibraryWrite.saveCompetency>) => saveCompetency(...a),
  setCompetencyArchived: (...a: Parameters<typeof LibraryWrite.setCompetencyArchived>) => setCompetencyArchived(...a),
  saveScaleLabels: (...a: Parameters<typeof LibraryWrite.saveScaleLabels>) => saveScaleLabels(...a),
}));

import {
  archiveCompetencyAction,
  createCompetencyAction,
  restoreCompetencyAction,
  saveCompetencyAction,
  saveScaleAction,
  startLibraryAction,
} from "./actions";

const ORG = "11111111-1111-4111-8111-111111111111";
const ID = "33333333-3333-4333-8333-333333333333";
const as = (role: SessionUser["role"]): SessionUser => ({ id: `user-${role}`, orgId: ORG, email: "x@kademe.local", name: "X", role });
const text = (s: string) => ({ tr: s, en: s });
const input = (over: Partial<LibraryWrite.CompetencyInput> = {}): LibraryWrite.CompetencyInput => ({
  name: text("İletişim"),
  description: text(""),
  anchors: { "1": text("a b c d"), "3": text("a b c d"), "5": text("a b c d") },
  tags: [],
  markReviewed: false,
  ...over,
});
const idForm = () => {
  const f = new FormData();
  f.set("id", ID);
  return f;
};
const allWrites = () => [startLibrary, createCompetency, saveCompetency, setCompetencyArchived, saveScaleLabels];

beforeEach(() => {
  for (const spy of allWrites()) spy.mockReset();
  saveCompetency.mockResolvedValue({ ok: true, tags: [] });
  saveScaleLabels.mockResolvedValue({ ok: true });
});

describe("library actions: capabilities", () => {
  it("refuses every library:write action to a REVIEWER and writes nothing", async () => {
    current = as("REVIEWER");
    await expect(startLibraryAction()).rejects.toThrow("missing capability: library:write");
    await expect(createCompetencyAction({ name: text("x"), description: text("") })).rejects.toThrow("library:write");
    await expect(saveCompetencyAction(ID, input())).rejects.toThrow("library:write");
    await expect(archiveCompetencyAction(idForm())).rejects.toThrow("library:write");
    await expect(restoreCompetencyAction(idForm())).rejects.toThrow("library:write");
    for (const spy of allWrites()) expect(spy).not.toHaveBeenCalled();
  });

  it("refuses the scale save to a MANAGER and writes nothing", async () => {
    current = as("MANAGER");
    await expect(saveScaleAction([{ value: 1, label: text("x") }])).rejects.toThrow("missing capability: library:scale");
    expect(saveScaleLabels).not.toHaveBeenCalled();
  });

  it("lets a MANAGER save a competency of their own organisation", async () => {
    current = as("MANAGER");
    expect(await saveCompetencyAction(ID, input())).toEqual({ ok: true, tags: [] });
    expect(saveCompetency).toHaveBeenCalledWith(ORG, "user-MANAGER", ID, expect.objectContaining({ name: text("İletişim") }));
  });
});

describe("library actions: bounds", () => {
  it("refuses a name over 120 characters and a tag over 80, before any write", async () => {
    current = as("OWNER");
    const long = (n: number) => "a".repeat(n);
    expect(await saveCompetencyAction(ID, input({ name: { tr: long(121), en: "" } }))).toEqual({ ok: false, code: "INVALID" });
    expect(
      await saveCompetencyAction(ID, input({ tags: [{ id: null, polarity: "POSITIVE", label: { tr: long(81), en: "" } }] })),
    ).toEqual({ ok: false, code: "INVALID" });
    expect(await createCompetencyAction({ name: { tr: "", en: long(121) }, description: text("") })).toEqual({ ok: false, code: "INVALID" });
    expect(saveCompetency).not.toHaveBeenCalled();
    expect(createCompetency).not.toHaveBeenCalled();

    await saveCompetencyAction(ID, input({ name: text(long(120)), tags: [{ id: null, polarity: "POSITIVE", label: text(long(80)) }] }));
    expect(saveCompetency).toHaveBeenCalledTimes(1);
  });
});
