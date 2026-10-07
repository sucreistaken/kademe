import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Versions from "@/solutions/hiring/server/versions";
import { emptyActivity, type StagePayload } from "@/solutions/hiring/rules/patches";
import { HiringConflict, HiringInvalid, HiringNotFound } from "@/solutions/hiring/server/errors";
import { signUndo } from "./undo-token";

/**
 * The builder's writes (carries 3, 4, 5): every action asks for the right to
 * edit this opening first and writes with the session's organisation, never
 * one from the browser; every refusal comes back as a code with field paths,
 * never a raw error; an undo restores losslessly only what the server handed
 * out, validated again.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

const OPENING = "33333333-3333-4333-8333-333333333333";
const STAGE = "44444444-4444-4444-8444-444444444444";
const ACTIVITY = "55555555-5555-4555-8555-555555555555";
const COMP = "66666666-6666-4666-8666-666666666666";
type Gate = { ok: true } | { ok: false; code: "NOT_FOUND" | "CLOSED" | "FORBIDDEN" };
let gate: Gate = { ok: true };
let viewer = { status: "DRAFT" as "DRAFT" | "OPEN" | "CLOSED", edit: true };
const editableOpening = vi.fn(async (id: string) =>
  gate.ok ? { ok: true as const, user: { id: "u1", orgId: "o1", role: "OWNER" }, opening: { id, status: "DRAFT" } } : gate,
);
vi.mock("../../access", () => ({
  editableOpening: (id: string) => editableOpening(id),
  openingFor: async (id: string) => ({
    user: { id: "u1", orgId: "o1", role: "OWNER" },
    opening: { id, status: viewer.status },
    access: { view: true, edit: viewer.edit },
  }),
}));

const v = vi.hoisted(() => ({
  addStage: vi.fn<typeof Versions.addStage>(),
  updateStage: vi.fn<typeof Versions.updateStage>(),
  moveStage: vi.fn<typeof Versions.moveStage>(),
  deleteStage: vi.fn<typeof Versions.deleteStage>(),
  insertStage: vi.fn<typeof Versions.insertStage>(),
  addActivity: vi.fn<typeof Versions.addActivity>(),
  updateActivity: vi.fn<typeof Versions.updateActivity>(),
  moveActivity: vi.fn<typeof Versions.moveActivity>(),
  deleteActivity: vi.fn<typeof Versions.deleteActivity>(),
  insertActivity: vi.fn<typeof Versions.insertActivity>(),
  setActivityCompetencies: vi.fn<typeof Versions.setActivityCompetencies>(),
  ensureDraftVersion: vi.fn<typeof Versions.ensureDraftVersion>(),
  versionsOf: vi.fn<typeof Versions.versionsOf>(),
}));
vi.mock("@/solutions/hiring/server/versions", () => Object.fromEntries(Object.entries(v).map(([name, fn]) => [name, (...a: unknown[]) => (fn as (...x: unknown[]) => unknown)(...a)])));

import {
  addActivityAction,
  addStageAction,
  deleteActivityAction,
  deleteStageAction,
  moveActivityAction,
  moveStageAction,
  restoreActivityFormAction,
  restoreStageFormAction,
  saveActivityAction,
  saveStageAction,
  setCompetenciesAction,
  startDraftAction,
} from "./actions";

const STAGE_PAYLOAD: StagePayload = {
  name: { tr: "Tanışma", en: "Intro" },
  description: { tr: "", en: "" },
  internalPurpose: null,
  durationSeconds: 600,
  graceSeconds: 0,
  onTimeout: "AUTO_SUBMIT",
  backNavigation: false,
  activities: [{ ...emptyActivity("VIDEO"), competencyIds: [COMP] }],
};
const ACTIVITY_PAYLOAD = { ...emptyActivity("VIDEO"), competencyIds: [COMP] };

beforeEach(() => {
  gate = { ok: true };
  viewer = { status: "DRAFT", edit: true };
  editableOpening.mockClear();
  for (const fn of Object.values(v)) fn.mockReset();
  draftNow("v2");
});

/** The opening's current draft: undo tickets are bound to it (review minor 4). */
function draftNow(versionId: string | null) {
  v.versionsOf.mockResolvedValue([
    { id: "v1", number: 1, status: "PUBLISHED", publishedAt: new Date(), previewedAt: null, updatedAt: new Date(0) },
    ...(versionId ? [{ id: versionId, number: Number(versionId.slice(1)), status: "DRAFT" as const, publishedAt: null, previewedAt: null, updatedAt: new Date(0) }] : []),
  ]);
}

/** Every client-called write, with what it calls and the arguments after the organisation. */
const WRITES = [
  ["addStageAction", () => addStageAction(OPENING), v.addStage, [OPENING]],
  ["saveStageAction", () => saveStageAction(OPENING, STAGE, { durationSeconds: 600 }), v.updateStage, [OPENING, STAGE, { durationSeconds: 600 }]],
  ["moveStageAction", () => moveStageAction(OPENING, STAGE, -1), v.moveStage, [OPENING, STAGE, -1]],
  ["deleteStageAction", () => deleteStageAction(OPENING, STAGE), v.deleteStage, [OPENING, STAGE]],
  ["addActivityAction", () => addActivityAction(OPENING, STAGE, "VIDEO"), v.addActivity, [OPENING, STAGE, "VIDEO"]],
  ["saveActivityAction", () => saveActivityAction(OPENING, ACTIVITY, { required: false }), v.updateActivity, [OPENING, ACTIVITY, { required: false }]],
  ["moveActivityAction", () => moveActivityAction(OPENING, ACTIVITY, 1), v.moveActivity, [OPENING, ACTIVITY, 1]],
  ["deleteActivityAction", () => deleteActivityAction(OPENING, ACTIVITY), v.deleteActivity, [OPENING, ACTIVITY]],
  ["setCompetenciesAction", () => setCompetenciesAction(OPENING, ACTIVITY, [COMP]), v.setActivityCompetencies, [OPENING, ACTIVITY, [COMP]]],
] as const;

describe("builder writes", () => {
  it.each(WRITES)("%s checks the right to edit and writes with the session's organisation", async (_name, call, fn, args) => {
    (fn as ReturnType<typeof vi.fn>).mockResolvedValue(
      fn === v.deleteStage ? { payload: STAGE_PAYLOAD, index: 0 } : fn === v.deleteActivity ? { payload: ACTIVITY_PAYLOAD, stageId: STAGE, index: 0 } : "new-id",
    );
    const result = await call();
    expect(editableOpening).toHaveBeenCalledWith(OPENING);
    expect(fn).toHaveBeenCalledWith("o1", ...args);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(new Date(result.at).toISOString()).toBe(result.at);
  });

  it.each(["NOT_FOUND", "CLOSED", "FORBIDDEN"] as const)("writes nothing and answers %s when the opening may not be edited", async (code) => {
    gate = { ok: false, code };
    for (const [, call, fn] of WRITES) {
      expect(await call()).toEqual({ ok: false, code });
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it.each(["NO_DRAFT", "CLOSED", "STAGE_FULL", "COMPETENCY", "CHOICE_COMPETENCY", "TOO_MANY_COMPETENCIES"] as const)("answers the draft's refusal %s as its code", async (code) => {
    v.addActivity.mockRejectedValue(new HiringConflict(code));
    expect(await addActivityAction(OPENING, STAGE, "VIDEO")).toEqual({ ok: false, code });
  });

  it("answers an invalid value with the paths of the refused fields", async () => {
    v.updateActivity.mockRejectedValue(new HiringInvalid([{ path: "answerSeconds", message: "Too small" }, { path: "config.maxChars", message: "Too big" }]));
    expect(await saveActivityAction(OPENING, ACTIVITY, { answerSeconds: 5 })).toEqual({ ok: false, code: "INVALID", fields: ["answerSeconds", "config.maxChars"] });
  });

  it("answers a row that is gone as NOT_FOUND", async () => {
    v.moveStage.mockRejectedValue(new HiringNotFound("stage"));
    expect(await moveStageAction(OPENING, STAGE, 1)).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("lets an unexpected error reach the caller", async () => {
    v.addStage.mockRejectedValue(new Error("connection lost"));
    await expect(addStageAction(OPENING)).rejects.toThrow("connection lost");
  });

  it("refuses an id that is not a string before anything runs", async () => {
    expect(await saveStageAction(OPENING, { evil: true } as unknown as string, {})).toEqual({ ok: false, code: "INVALID", fields: ["id"] });
    expect(v.updateStage).not.toHaveBeenCalled();
  });
});

describe("undo", () => {
  const stageForm = (over: Partial<Record<"payload" | "index" | "token" | "openingId", string>> = {}) => {
    const payload = over.payload ?? JSON.stringify(STAGE_PAYLOAD);
    const f = new FormData();
    f.set("openingId", over.openingId ?? OPENING);
    f.set("payload", payload);
    f.set("index", over.index ?? "1");
    f.set("token", over.token ?? signUndo({ orgId: "o1", openingId: OPENING, versionId: "v2", kind: "stage", stageId: "", index: 1, payload: JSON.stringify(STAGE_PAYLOAD) }));
    return f;
  };
  const activityForm = (over: Partial<Record<"stageId" | "token", string>> = {}) => {
    const payload = JSON.stringify(ACTIVITY_PAYLOAD);
    const f = new FormData();
    f.set("openingId", OPENING);
    f.set("stageId", over.stageId ?? STAGE);
    f.set("payload", payload);
    f.set("index", "0");
    f.set("token", over.token ?? signUndo({ orgId: "o1", openingId: OPENING, versionId: "v2", kind: "activity", stageId: STAGE, index: 0, payload }));
    return f;
  };

  it("a deleted stage comes back with a signed ticket", async () => {
    v.deleteStage.mockResolvedValue({ payload: STAGE_PAYLOAD, index: 1 });
    const result = await deleteStageAction(OPENING, STAGE);
    expect(result).toMatchObject({ ok: true, value: { payload: JSON.stringify(STAGE_PAYLOAD), index: 1 } });
    if (!result.ok) throw new Error("expected ok");
    v.insertStage.mockResolvedValue("restored");
    const f = new FormData();
    f.set("openingId", OPENING);
    f.set("payload", result.value.payload);
    f.set("index", String(result.value.index));
    f.set("token", result.value.token);
    expect(await restoreStageFormAction(f)).toMatchObject({ ok: true, value: "restored" });
  });

  it("restores a stage losslessly at its place, validated again", async () => {
    v.insertStage.mockResolvedValue("restored");
    expect(await restoreStageFormAction(stageForm())).toMatchObject({ ok: true, value: "restored" });
    expect(v.insertStage).toHaveBeenCalledWith("o1", OPENING, STAGE_PAYLOAD, 1, { restore: true });
  });

  it("refuses a payload or place the server did not hand out", async () => {
    const changed = JSON.stringify({ ...STAGE_PAYLOAD, name: { tr: "Başka", en: "Other" } });
    expect(await restoreStageFormAction(stageForm({ payload: changed }))).toEqual({ ok: false, code: "UNDO_EXPIRED" });
    expect(await restoreStageFormAction(stageForm({ index: "0" }))).toEqual({ ok: false, code: "UNDO_EXPIRED" });
    expect(await restoreStageFormAction(stageForm({ token: "1.abc" }))).toEqual({ ok: false, code: "UNDO_EXPIRED" });
    expect(await restoreActivityFormAction(activityForm({ stageId: "77777777-7777-4777-8777-777777777777" }))).toEqual({ ok: false, code: "UNDO_EXPIRED" });
    expect(v.insertStage).not.toHaveBeenCalled();
    expect(v.insertActivity).not.toHaveBeenCalled();
  });

  it("validates a signed payload again with the schema", async () => {
    const bad = JSON.stringify({ ...STAGE_PAYLOAD, durationSeconds: 5 });
    const token = signUndo({ orgId: "o1", openingId: OPENING, versionId: "v2", kind: "stage", stageId: "", index: 1, payload: bad });
    expect(await restoreStageFormAction(stageForm({ payload: bad, token }))).toEqual({ ok: false, code: "INVALID", fields: ["durationSeconds"] });
    const broken = "{not json";
    const token2 = signUndo({ orgId: "o1", openingId: OPENING, versionId: "v2", kind: "stage", stageId: "", index: 1, payload: broken });
    expect(await restoreStageFormAction(stageForm({ payload: broken, token: token2 }))).toEqual({ ok: false, code: "INVALID", fields: [] });
    expect(v.insertStage).not.toHaveBeenCalled();
  });

  it("restores a question with its competency into its stage", async () => {
    v.insertActivity.mockResolvedValue("restored");
    expect(await restoreActivityFormAction(activityForm())).toMatchObject({ ok: true, value: "restored" });
    expect(v.insertActivity).toHaveBeenCalledWith("o1", OPENING, STAGE, ACTIVITY_PAYLOAD, 0, { restore: true });
  });

  it("answers a full stage on undo with its own code", async () => {
    v.insertActivity.mockRejectedValue(new HiringConflict("STAGE_FULL"));
    expect(await restoreActivityFormAction(activityForm())).toEqual({ ok: false, code: "STAGE_FULL" });
  });

  it("refuses a ticket from another draft version: v2's delete never restores into v3", async () => {
    draftNow("v3");
    expect(await restoreActivityFormAction(activityForm())).toEqual({ ok: false, code: "UNDO_EXPIRED" });
    expect(v.insertActivity).not.toHaveBeenCalled();
  });

  it("answers NO_DRAFT when the draft was published meanwhile", async () => {
    draftNow(null);
    expect(await restoreActivityFormAction(activityForm())).toEqual({ ok: false, code: "NO_DRAFT" });
    expect(v.insertActivity).not.toHaveBeenCalled();
  });

  it("checks the right to edit before restoring", async () => {
    gate = { ok: false, code: "CLOSED" };
    expect(await restoreActivityFormAction(activityForm())).toEqual({ ok: false, code: "CLOSED" });
    expect(v.insertActivity).not.toHaveBeenCalled();
  });
});

describe("startDraftAction", () => {
  const form = () => {
    const f = new FormData();
    f.set("openingId", OPENING);
    return f;
  };
  const builder = `/hiring/openings/${OPENING}/assessment/edit`;

  it("opens the next version and returns to the builder", async () => {
    v.ensureDraftVersion.mockResolvedValue({ versionId: "v2", created: true });
    await expect(startDraftAction(form())).rejects.toThrow(`redirect:${builder}`);
    expect(v.ensureDraftVersion).toHaveBeenCalledWith("o1", OPENING);
  });

  it("opens the next version in the wizard's questions for 'Soruları düzenle' (back=setup, HIRING-UX 5.20)", async () => {
    v.ensureDraftVersion.mockResolvedValue({ versionId: "v2", created: true });
    const f = form();
    f.set("back", "setup");
    await expect(startDraftAction(f)).rejects.toThrow(`redirect:/hiring/openings/${OPENING}/setup#questions`);
  });

  it("says a closed opening stays as it is, before the role check", async () => {
    viewer = { status: "CLOSED", edit: false };
    await expect(startDraftAction(form())).rejects.toThrow(`redirect:${builder}?draft=closed`);
    expect(v.ensureDraftVersion).not.toHaveBeenCalled();
  });

  it("refuses a viewer who may not edit", async () => {
    viewer = { status: "OPEN", edit: false };
    await expect(startDraftAction(form())).rejects.toMatchObject({ name: "ForbiddenError" });
    expect(v.ensureDraftVersion).not.toHaveBeenCalled();
  });

  it("returns to the AI screen when it was started there, and to the builder for any other value", async () => {
    v.ensureDraftVersion.mockResolvedValue({ versionId: "v2", created: true });
    const fromAi = form();
    fromAi.set("back", "ai");
    await expect(startDraftAction(fromAi)).rejects.toThrow(`redirect:/hiring/openings/${OPENING}/assessment/ai`);
    v.ensureDraftVersion.mockRejectedValue(new HiringNotFound("opening"));
    await expect(startDraftAction(fromAi)).rejects.toThrow(`redirect:/hiring/openings/${OPENING}/assessment/ai?draft=failed`);
    const elsewhere = form();
    elsewhere.set("back", "https://evil.example");
    v.ensureDraftVersion.mockResolvedValue({ versionId: "v2", created: true });
    await expect(startDraftAction(elsewhere)).rejects.toThrow(`redirect:${builder}`);
  });

  it("answers a refusal with a notice, never a raw error", async () => {
    v.ensureDraftVersion.mockRejectedValue(new HiringConflict("CLOSED"));
    await expect(startDraftAction(form())).rejects.toThrow(`redirect:${builder}?draft=closed`);
    v.ensureDraftVersion.mockRejectedValue(new HiringNotFound("opening"));
    await expect(startDraftAction(form())).rejects.toThrow(`redirect:${builder}?draft=failed`);
  });
});
