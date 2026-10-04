import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Content from "@/solutions/hiring/server/content";
import type * as LibraryWrite from "@/server/library-write";
import type * as Versions from "@/solutions/hiring/server/versions";
import type * as WeightSets from "@/solutions/hiring/server/weight-sets";
import { HiringConflict, HiringNotFound } from "@/solutions/hiring/server/errors";

/**
 * The scorecard's writes (Task 16 carries 1, 3, 4, 7): every action asks for
 * the right to edit this opening first (organisation-scoped load, role,
 * CLOSED) and writes with the session's organisation, never one from the
 * browser; every refusal comes back as a code, never a raw error.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
// isUuid lives beside the settings queries; nothing here reaches a database.
vi.mock("@/db", () => ({ db: {} }));

const OPENING = "33333333-3333-4333-8333-333333333333";
const DRAFT = "44444444-4444-4444-8444-444444444444";
const LIVE = "44444444-4444-4444-8444-444444444445";
const COMP = "66666666-6666-4666-8666-666666666666";
const OTHER = "66666666-6666-4666-8666-666666666667";

type Gate = { ok: true; role?: "OWNER" | "MANAGER" | "REVIEWER" } | { ok: false; code: "NOT_FOUND" | "CLOSED" | "FORBIDDEN" };
let gate: Gate = { ok: true };
const editableOpening = vi.fn(async (id: string) =>
  gate.ok ? { ok: true as const, user: { id: "u1", orgId: "o1", email: "", name: "", role: gate.role ?? "OWNER" }, opening: { id, status: "DRAFT" } } : gate,
);
vi.mock("../../access", () => ({ editableOpening: (id: string) => editableOpening(id) }));

const m = vi.hoisted(() => ({
  saveDraftWeights: vi.fn<typeof Versions.saveDraftWeights>(),
  versionsOf: vi.fn<typeof Versions.versionsOf>(),
  addWeightSet: vi.fn<typeof WeightSets.addWeightSet>(),
  saveAnchors: vi.fn<typeof LibraryWrite.saveAnchors>(),
  loadVersionContent: vi.fn<typeof Content.loadVersionContent>(),
}));
const forward = vi.hoisted(() => (name: string) => (...a: unknown[]) => (m[name as keyof typeof m] as (...x: unknown[]) => unknown)(...a));
vi.mock("@/solutions/hiring/server/versions", () => ({ saveDraftWeights: forward("saveDraftWeights"), versionsOf: forward("versionsOf") }));
vi.mock("@/solutions/hiring/server/weight-sets", () => ({ addWeightSet: forward("addWeightSet") }));
vi.mock("@/server/library-write", () => ({ saveAnchors: forward("saveAnchors") }));
vi.mock("@/solutions/hiring/server/content", () => ({ loadVersionContent: forward("loadVersionContent") }));

import { addWeightSetAction, saveAnchorsAction, saveDraftWeightsAction } from "./actions";

const text = (s: string) => ({ tr: s, en: "" });
const ANCHORS = { "1": text("bir"), "3": text("üç"), "5": text("beş") };
const weights = { versionId: DRAFT, enabled: true, weights: { [COMP]: 100 } };
const live = { versionId: LIVE, enabled: true, weights: { [COMP]: 100 }, reason: "Kalibrasyon" };

/** The opening's draft measures COMP with one video question. */
function draftMeasures(...ids: string[]) {
  m.versionsOf.mockResolvedValue([{ id: DRAFT, number: 2, status: "DRAFT", publishedAt: null, previewedAt: null, updatedAt: new Date(0) }]);
  m.loadVersionContent.mockResolvedValue({
    id: DRAFT,
    stages: [{ id: "s1", orderIndex: 0, activities: [{ id: "a1", orderIndex: 0, type: "VIDEO", competencyIds: ids }] }],
  } as unknown as Awaited<ReturnType<typeof Content.loadVersionContent>>);
}

beforeEach(() => {
  gate = { ok: true };
  editableOpening.mockClear();
  for (const fn of Object.values(m)) fn.mockReset();
  m.saveDraftWeights.mockResolvedValue({ ok: true });
  m.addWeightSet.mockResolvedValue({ ok: true });
  m.saveAnchors.mockResolvedValue({ ok: true, anchors: { 1: text("bir"), 3: text("üç"), 5: text("beş") } });
  draftMeasures(COMP);
});

const CALLS = [
  ["saveDraftWeightsAction", () => saveDraftWeightsAction(OPENING, weights)],
  ["addWeightSetAction", () => addWeightSetAction(OPENING, live)],
  ["saveAnchorsAction", () => saveAnchorsAction(OPENING, COMP, ANCHORS)],
] as const;
const anyWrite = () => m.saveDraftWeights.mock.calls.length + m.addWeightSet.mock.calls.length + m.saveAnchors.mock.calls.length;

describe("scorecard actions: access", () => {
  it.each(CALLS)("%s asks for the right to edit this opening and answers its refusal as a code, writing nothing", async (_name, call) => {
    for (const code of ["NOT_FOUND", "CLOSED", "FORBIDDEN"] as const) {
      gate = { ok: false, code };
      await expect(call()).resolves.toEqual({ ok: false, code });
    }
    expect(editableOpening).toHaveBeenCalledWith(OPENING);
    expect(anyWrite()).toBe(0);
  });

  it("writes with the session's organisation and user, never ones from the browser", async () => {
    await saveDraftWeightsAction(OPENING, { ...weights, orgId: "evil" } as typeof weights);
    expect(m.saveDraftWeights).toHaveBeenCalledWith("o1", OPENING, { versionId: DRAFT, enabled: true, weights: { [COMP]: 100 } });
    await addWeightSetAction(OPENING, live);
    expect(m.addWeightSet).toHaveBeenCalledWith("o1", OPENING, live, "u1");
    await saveAnchorsAction(OPENING, COMP, ANCHORS);
    expect(m.saveAnchors).toHaveBeenCalledWith("o1", "u1", COMP, ANCHORS);
  });

  it("a malformed request is INVALID before any write", async () => {
    await expect(saveDraftWeightsAction(OPENING, { ...weights, versionId: "x" })).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(saveDraftWeightsAction(OPENING, { ...weights, weights: { "not-an-id": 100 } })).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(addWeightSetAction(OPENING, { ...live, reason: "x".repeat(1001) })).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(saveAnchorsAction(OPENING, "not-an-id", ANCHORS)).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(saveAnchorsAction(OPENING, COMP, { "7": text("x") } as unknown as typeof ANCHORS)).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(saveDraftWeightsAction(42 as unknown as string, weights)).resolves.toEqual({ ok: false, code: "INVALID" });
    expect(anyWrite()).toBe(0);
  });
});

describe("weights", () => {
  it("a weight that is not whole reaches the rules, which name it NOT_WHOLE (never INVALID, never NOT_100)", async () => {
    m.saveDraftWeights.mockResolvedValue({ ok: false, code: "NOT_WHOLE", total: 100 });
    await expect(saveDraftWeightsAction(OPENING, { ...weights, weights: { [COMP]: 99.5 } })).resolves.toEqual({ ok: false, code: "NOT_WHOLE", total: 100 });
    expect(m.saveDraftWeights.mock.calls[0][2]).toMatchObject({ weights: { [COMP]: 99.5 } });
  });

  it("passes a measured competency left out (WEIGHTS_MISSING) and a live change that changes nothing (NO_CHANGE) through", async () => {
    m.saveDraftWeights.mockResolvedValueOnce({ ok: false, code: "WEIGHTS_MISSING", competencyId: COMP });
    await expect(saveDraftWeightsAction(OPENING, weights)).resolves.toEqual({ ok: false, code: "WEIGHTS_MISSING", competencyId: COMP });
    m.addWeightSet.mockResolvedValueOnce({ ok: false, code: "NO_CHANGE" });
    await expect(addWeightSetAction(OPENING, live)).resolves.toEqual({ ok: false, code: "NO_CHANGE" });
  });

  it("passes the rules' NOT_100 with its total, and STALE", async () => {
    m.saveDraftWeights.mockResolvedValueOnce({ ok: false, code: "NOT_100", total: 95 });
    await expect(saveDraftWeightsAction(OPENING, weights)).resolves.toEqual({ ok: false, code: "NOT_100", total: 95 });
    m.saveDraftWeights.mockResolvedValueOnce({ ok: false, code: "STALE" });
    await expect(saveDraftWeightsAction(OPENING, weights)).resolves.toEqual({ ok: false, code: "STALE" });
  });

  it("a draft published meanwhile (NO_DRAFT), a closed opening and a vanished one are codes, not errors", async () => {
    m.saveDraftWeights.mockRejectedValueOnce(new HiringConflict("NO_DRAFT"));
    await expect(saveDraftWeightsAction(OPENING, weights)).resolves.toEqual({ ok: false, code: "NO_DRAFT" });
    m.saveDraftWeights.mockRejectedValueOnce(new HiringConflict("CLOSED"));
    await expect(saveDraftWeightsAction(OPENING, weights)).resolves.toEqual({ ok: false, code: "CLOSED" });
    m.addWeightSet.mockRejectedValueOnce(new HiringConflict("CLOSED"));
    await expect(addWeightSetAction(OPENING, live)).resolves.toEqual({ ok: false, code: "CLOSED" });
    m.addWeightSet.mockRejectedValueOnce(new HiringNotFound("opening"));
    await expect(addWeightSetAction(OPENING, live)).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("a live weight change passes STALE, REASON_REQUIRED, NO_LIVE and NOT_WHOLE through as codes", async () => {
    for (const result of [
      { ok: false as const, code: "STALE" as const },
      { ok: false as const, code: "REASON_REQUIRED" as const },
      { ok: false as const, code: "NO_LIVE" as const },
      { ok: false as const, code: "NOT_WHOLE" as const, total: 100 },
    ]) {
      m.addWeightSet.mockResolvedValueOnce(result);
      await expect(addWeightSetAction(OPENING, live)).resolves.toEqual(result);
    }
  });

  it("an unexpected error is not swallowed", async () => {
    m.addWeightSet.mockRejectedValueOnce(new Error("db down"));
    await expect(addWeightSetAction(OPENING, live)).rejects.toThrow("db down");
  });
});

describe("anchors", () => {
  it("needs the library:write capability as well as the right to edit the opening", async () => {
    gate = { ok: true, role: "REVIEWER" };
    await expect(saveAnchorsAction(OPENING, COMP, ANCHORS)).resolves.toEqual({ ok: false, code: "LIBRARY_FORBIDDEN" });
    expect(anyWrite()).toBe(0);
  });

  it("edits only a competency this opening's draft measures, read within the session's organisation", async () => {
    await expect(saveAnchorsAction(OPENING, OTHER, ANCHORS)).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
    expect(m.versionsOf).toHaveBeenCalledWith("o1", OPENING);
    expect(m.loadVersionContent).toHaveBeenCalledWith("o1", DRAFT);
    expect(anyWrite()).toBe(0);
  });

  it("without a draft (the scorecard is live) anchors are not edited here: NO_DRAFT", async () => {
    m.versionsOf.mockResolvedValue([{ id: LIVE, number: 1, status: "PUBLISHED", publishedAt: new Date(), previewedAt: null, updatedAt: new Date(0) }]);
    await expect(saveAnchorsAction(OPENING, COMP, ANCHORS)).resolves.toEqual({ ok: false, code: "NO_DRAFT" });
    expect(anyWrite()).toBe(0);
  });

  it("answers the stored anchors, so the Sheet adopts them, and passes ANCHORS_REQUIRED, ARCHIVED and NOT_FOUND through", async () => {
    await expect(saveAnchorsAction(OPENING, COMP, ANCHORS)).resolves.toEqual({ ok: true, anchors: { 1: text("bir"), 3: text("üç"), 5: text("beş") } });
    for (const code of ["ANCHORS_REQUIRED", "ARCHIVED", "NOT_FOUND"] as const) {
      m.saveAnchors.mockResolvedValueOnce({ ok: false, code });
      await expect(saveAnchorsAction(OPENING, COMP, ANCHORS)).resolves.toEqual({ ok: false, code });
    }
  });
});
