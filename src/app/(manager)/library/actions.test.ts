import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth";
import type * as LibraryWrite from "@/server/library-write";
import type * as LibraryRead from "@/server/library";
import type * as AnchorJob from "@/server/anchor-draft-job";
import type * as AiLimit from "@/lib/ai-limit";

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
const createPosition = vi.fn<typeof LibraryWrite.createPosition>();
const savePosition = vi.fn<typeof LibraryWrite.savePosition>();
const setPositionArchived = vi.fn<typeof LibraryWrite.setPositionArchived>();
vi.mock("@/server/library-write", () => ({
  startLibrary: (...a: Parameters<typeof LibraryWrite.startLibrary>) => startLibrary(...a),
  createCompetency: (...a: Parameters<typeof LibraryWrite.createCompetency>) => createCompetency(...a),
  saveCompetency: (...a: Parameters<typeof LibraryWrite.saveCompetency>) => saveCompetency(...a),
  setCompetencyArchived: (...a: Parameters<typeof LibraryWrite.setCompetencyArchived>) => setCompetencyArchived(...a),
  saveScaleLabels: (...a: Parameters<typeof LibraryWrite.saveScaleLabels>) => saveScaleLabels(...a),
  createPosition: (...a: Parameters<typeof LibraryWrite.createPosition>) => createPosition(...a),
  savePosition: (...a: Parameters<typeof LibraryWrite.savePosition>) => savePosition(...a),
  setPositionArchived: (...a: Parameters<typeof LibraryWrite.setPositionArchived>) => setPositionArchived(...a),
}));

const loadCompetency = vi.fn<typeof LibraryRead.loadCompetency>();
const loadDefaultScale = vi.fn<typeof LibraryRead.loadDefaultScale>();
vi.mock("@/server/library", () => ({
  loadCompetency: (...a: Parameters<typeof LibraryRead.loadCompetency>) => loadCompetency(...a),
  loadDefaultScale: (...a: Parameters<typeof LibraryRead.loadDefaultScale>) => loadDefaultScale(...a),
}));
const aiLimitReached = vi.fn<typeof AiLimit.aiLimitReached>();
vi.mock("@/lib/ai-limit", () => ({
  aiLimitReached: (...a: Parameters<typeof AiLimit.aiLimitReached>) => aiLimitReached(...a),
}));
const draftAnchors = vi.fn<typeof AnchorJob.draftAnchors>();
vi.mock("@/server/anchor-draft-job", () => ({
  draftAnchors: (...a: Parameters<typeof AnchorJob.draftAnchors>) => draftAnchors(...a),
}));

import {
  archiveCompetencyAction,
  archivePositionAction,
  createCompetencyAction,
  createPositionAction,
  draftAnchorsAction,
  restoreCompetencyAction,
  restorePositionAction,
  saveCompetencyAction,
  savePositionAction,
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
const COMP = "99999999-9999-4999-8999-999999999999";
const position = (over: Partial<LibraryWrite.PositionInput> = {}): LibraryWrite.PositionInput => ({
  name: "Kıdemli Ürün Tasarımcısı",
  team: "",
  shortDescription: "",
  jobDescription: "",
  skills: [],
  languages: [],
  profile: [{ competencyId: COMP, weight: 60, expectedLevel: 3 }],
  ...over,
});
const allWrites = () => [
  startLibrary,
  createCompetency,
  saveCompetency,
  setCompetencyArchived,
  saveScaleLabels,
  createPosition,
  savePosition,
  setPositionArchived,
];

beforeEach(() => {
  for (const spy of allWrites()) spy.mockReset();
  saveCompetency.mockResolvedValue({ ok: true, tags: [] });
  saveScaleLabels.mockResolvedValue({ ok: true });
  savePosition.mockImplementation(async (_org, _actor, _id, value) => ({ ok: true, position: value }));
  createPosition.mockResolvedValue({ ok: true, id: ID });
  setPositionArchived.mockResolvedValue(true);
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

describe("position actions: capabilities", () => {
  it("refuses every position write to a REVIEWER and writes nothing", async () => {
    current = as("REVIEWER");
    await expect(createPositionAction({ name: "x", team: "", jobDescription: "" })).rejects.toThrow("missing capability: library:write");
    await expect(savePositionAction(ID, position())).rejects.toThrow("library:write");
    await expect(archivePositionAction(idForm())).rejects.toThrow("library:write");
    await expect(restorePositionAction(idForm())).rejects.toThrow("library:write");
    for (const spy of allWrites()) expect(spy).not.toHaveBeenCalled();
  });

  it("lets a MANAGER create, save, archive and restore a position of their own organisation", async () => {
    current = as("MANAGER");
    await expect(createPositionAction({ name: "Tasarımcı", team: "Ürün", jobDescription: "" })).rejects.toThrow(`redirect:/library/positions/${ID}`);
    expect(createPosition).toHaveBeenCalledWith(ORG, "user-MANAGER", { name: "Tasarımcı", team: "Ürün", jobDescription: "" });
    expect(await savePositionAction(ID, position())).toEqual({ ok: true, position: position() });
    expect(savePosition).toHaveBeenCalledWith(ORG, "user-MANAGER", ID, position());
    await expect(archivePositionAction(idForm())).rejects.toThrow(`redirect:/library/positions/${ID}?archived=1`);
    expect(setPositionArchived).toHaveBeenLastCalledWith(ORG, "user-MANAGER", ID, true);
    await expect(restorePositionAction(idForm())).rejects.toThrow(`redirect:/library/positions/${ID}`);
    expect(setPositionArchived).toHaveBeenLastCalledWith(ORG, "user-MANAGER", ID, false);
  });
});

describe("position actions: bounds", () => {
  it("refuses out-of-range input before any write", async () => {
    current = as("OWNER");
    const long = (n: number) => "a".repeat(n);
    const bad: LibraryWrite.PositionInput[] = [
      position({ name: long(161) }),
      position({ team: long(161) }),
      position({ shortDescription: long(1001) }),
      position({ jobDescription: long(20001) }),
      position({ skills: [long(81)] }),
      position({ skills: Array.from({ length: 31 }, (_, i) => `s${i}`) }),
      position({ languages: [long(41)] }),
      position({ languages: Array.from({ length: 11 }, (_, i) => `l${i}`) }),
      position({ profile: [{ competencyId: COMP, weight: 101, expectedLevel: null }] }),
      position({ profile: [{ competencyId: COMP, weight: 2.5, expectedLevel: null }] }),
      position({ profile: [{ competencyId: COMP, weight: 50, expectedLevel: 6 }] }),
      position({ profile: [{ competencyId: "not-a-uuid", weight: 50, expectedLevel: null }] }),
      position({ profile: Array.from({ length: 21 }, () => ({ competencyId: COMP, weight: 50, expectedLevel: null })) }),
    ];
    for (const value of bad) expect(await savePositionAction(ID, value)).toEqual({ ok: false, code: "INVALID" });
    expect(await savePositionAction("not-a-uuid", position())).toEqual({ ok: false, code: "INVALID" });
    expect(await createPositionAction({ name: long(161), team: "", jobDescription: "" })).toEqual({ ok: false, code: "INVALID" });
    expect(savePosition).not.toHaveBeenCalled();
    expect(createPosition).not.toHaveBeenCalled();

    await savePositionAction(ID, position({ name: long(160), profile: [{ competencyId: COMP, weight: 100, expectedLevel: 5 }] }));
    expect(savePosition).toHaveBeenCalledTimes(1);
  });

  it("ignores an archive or restore without a valid id", async () => {
    current = as("OWNER");
    const f = new FormData();
    f.set("id", "nope");
    await archivePositionAction(f);
    await restorePositionAction(f);
    expect(setPositionArchived).not.toHaveBeenCalled();
  });
});

describe("anchor draft action", () => {
  const detail = (archivedAt: Date | null = null): LibraryRead.CompetencyDetail => ({
    id: ID,
    name: text("İletişim"),
    description: text(""),
    seededUnreviewed: false,
    archivedAt,
    anchors: {},
    tags: [],
  });
  const levels = [{ value: 3, label: text("Beklenen") }];

  beforeEach(() => {
    loadCompetency.mockReset();
    loadDefaultScale.mockReset();
    draftAnchors.mockReset();
    loadCompetency.mockResolvedValue(detail());
    loadDefaultScale.mockResolvedValue({ id: "scale", name: "Varsayılan", minValue: 1, maxValue: 5, levels });
    draftAnchors.mockResolvedValue({ status: "UNCONFIGURED" });
    aiLimitReached.mockReset();
    aiLimitReached.mockResolvedValue(false);
  });

  it("refuses a REVIEWER before reading or calling the AI", async () => {
    current = as("REVIEWER");
    await expect(draftAnchorsAction(ID, { name: text("x"), description: text("") })).rejects.toThrow("missing capability: library:write");
    expect(loadCompetency).not.toHaveBeenCalled();
    expect(aiLimitReached).not.toHaveBeenCalled();
    expect(draftAnchors).not.toHaveBeenCalled();
  });

  it("asks for a draft for a MANAGER with the org's own competency and scale", async () => {
    current = as("MANAGER");
    expect(await draftAnchorsAction(ID, { name: text("İletişim"), description: text("Açık anlatır") })).toEqual({ status: "UNCONFIGURED" });
    expect(loadCompetency).toHaveBeenCalledWith(ORG, ID);
    expect(loadDefaultScale).toHaveBeenCalledWith(ORG);
    expect(aiLimitReached).toHaveBeenCalledWith(ORG, "user-MANAGER", "ANCHOR_DRAFT");
    expect(draftAnchors).toHaveBeenCalledWith(ORG, "user-MANAGER", ID, { name: text("İletişim"), description: text("Açık anlatır"), levels });
  });

  it("answers RATE_LIMITED over the AI limit and makes no call", async () => {
    current = as("MANAGER");
    aiLimitReached.mockResolvedValueOnce(true);
    expect(await draftAnchorsAction(ID, { name: text("İletişim"), description: text("") })).toEqual({ status: "RATE_LIMITED" });
    expect(draftAnchors).not.toHaveBeenCalled();
  });

  it("makes no call for bad input, another org's competency or an archived one", async () => {
    current = as("OWNER");
    expect(await draftAnchorsAction("not-a-uuid", { name: text("x"), description: text("") })).toEqual({ status: "FAILED" });
    expect(await draftAnchorsAction(ID, { name: text("a".repeat(121)), description: text("") })).toEqual({ status: "FAILED" });
    expect(await draftAnchorsAction(ID, { name: text(" "), description: text("") })).toEqual({ status: "FAILED" });
    loadCompetency.mockResolvedValueOnce(null);
    expect(await draftAnchorsAction(ID, { name: text("x"), description: text("") })).toEqual({ status: "FAILED" });
    loadCompetency.mockResolvedValueOnce(detail(new Date()));
    expect(await draftAnchorsAction(ID, { name: text("x"), description: text("") })).toEqual({ status: "FAILED" });
    expect(draftAnchors).not.toHaveBeenCalled();
  });
});
