import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AiLimit from "@/lib/ai-limit";
import type * as Job from "@/solutions/hiring/ai/question-check-job";
import type * as Working from "@/solutions/hiring/server/working";

/**
 * "AI ile kontrol et" (Task 18 carries 1, 2, 5): the right to edit this opening
 * is asked first (organisation-scoped load, role, CLOSED); only the DRAFT's
 * saved questions are checked; the AI is asked only under the limit and only
 * when there is a question with text; the team language is the version's,
 * never the viewer's; and every refusal is a code. Nothing is written.
 */
vi.mock("@/db", () => ({ db: {} }));
// The viewer's language is English here; the version's is Turkish: the check must follow the version.
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "en" }));

const OPENING = "33333333-3333-4333-8333-333333333333";
const A1 = "44444444-4444-4444-8444-444444444444";
const A2 = "55555555-5555-4555-8555-555555555555";
const A3 = "66666666-6666-4666-8666-666666666666";

type Gate = { ok: true } | { ok: false; code: "NOT_FOUND" | "CLOSED" | "FORBIDDEN" };
let gate: Gate = { ok: true };
const editableOpening = vi.fn(async (id: string) =>
  gate.ok ? { ok: true as const, user: { id: "u1", orgId: "o1", email: "", name: "", role: "OWNER" }, opening: { id, status: "DRAFT" } } : gate,
);
vi.mock("../../access", () => ({ editableOpening: (id: string) => editableOpening(id) }));

const m = vi.hoisted(() => ({
  workingState: vi.fn<typeof Working.workingState>(),
  aiLimitReached: vi.fn<typeof AiLimit.aiLimitReached>(),
  runQuestionCheck: vi.fn<typeof Job.runQuestionCheck>(),
}));
vi.mock("@/solutions/hiring/server/working", () => ({ workingState: (...a: Parameters<typeof Working.workingState>) => m.workingState(...a) }));
vi.mock("@/lib/ai-limit", () => ({ aiLimitReached: (...a: Parameters<typeof AiLimit.aiLimitReached>) => m.aiLimitReached(...a) }));
vi.mock("@/solutions/hiring/ai/question-check-job", () => ({ runQuestionCheck: (...a: Parameters<typeof Job.runQuestionCheck>) => m.runQuestionCheck(...a) }));

import { checkQuestionsAction } from "./check-actions";

type State = Awaited<ReturnType<typeof Working.workingState>>;
const activity = (id: string, orderIndex: number, tr: string, en = "") => ({ id, orderIndex, prompt: { tr, en } });
/** A draft (or only a live version) whose second stage comes first in the array, to prove the order is the builder's. */
function stateWith(opts: { draft?: boolean; defaultLocale?: "tr" | "en" } = {}): State {
  const draft = opts.draft ?? true;
  const version = { id: draft ? "v2" : "v1", number: draft ? 2 : 1 };
  return {
    list: [],
    draft: draft ? version : null,
    live: draft ? null : version,
    content: {
      id: version.id,
      defaultLocale: opts.defaultLocale ?? "tr",
      stages: [
        { id: "s2", orderIndex: 1, activities: [activity(A3, 0, "Evli misin?")] },
        { id: "s1", orderIndex: 0, activities: [activity(A2, 1, "", "Tell us about a mistake."), activity(A1, 0, "   ", "")] },
      ],
    },
    facts: new Map(),
    problems: [],
  } as unknown as State;
}

beforeEach(() => {
  gate = { ok: true };
  editableOpening.mockClear();
  m.workingState.mockReset().mockResolvedValue(stateWith());
  m.aiLimitReached.mockReset().mockResolvedValue(false);
  m.runQuestionCheck.mockReset().mockResolvedValue({ status: "OK", findings: [] });
});

describe("checkQuestionsAction", () => {
  it.each(["NOT_FOUND", "CLOSED", "FORBIDDEN"] as const)("answers %s from the edit gate before reading or asking anything", async (code) => {
    gate = { ok: false, code };
    expect(await checkQuestionsAction(OPENING)).toEqual({ ok: false, code });
    expect(m.workingState).not.toHaveBeenCalled();
    expect(m.aiLimitReached).not.toHaveBeenCalled();
    expect(m.runQuestionCheck).not.toHaveBeenCalled();
  });

  it("refuses a malformed id without a lookup", async () => {
    expect(await checkQuestionsAction("not-a-uuid")).toEqual({ ok: false, code: "INVALID" });
    expect(await checkQuestionsAction(42 as unknown as string)).toEqual({ ok: false, code: "INVALID" });
    expect(editableOpening).not.toHaveBeenCalled();
  });

  it("reads the session's organisation and checks only the draft", async () => {
    m.workingState.mockResolvedValue(stateWith({ draft: false }));
    expect(await checkQuestionsAction(OPENING)).toEqual({ ok: false, code: "NO_DRAFT" });
    expect(m.workingState).toHaveBeenCalledWith("o1", OPENING);
    expect(m.runQuestionCheck).not.toHaveBeenCalled();
  });

  it("sends the draft's questions with text in builder order, in the version's language, for this user", async () => {
    const result = await checkQuestionsAction(OPENING);
    const checked = [
      { id: A2, prompt: { tr: "", en: "Tell us about a mistake." } },
      { id: A3, prompt: { tr: "Evli misin?", en: "" } },
    ];
    expect(m.aiLimitReached).toHaveBeenCalledWith("o1", "u1", "QUESTION_CHECK");
    expect(m.runQuestionCheck).toHaveBeenCalledWith({ orgId: "o1", userId: "u1", openingId: OPENING, activities: checked, teamLocale: "tr" });
    expect(result).toMatchObject({ ok: true, findings: [], checked });
  });

  it("uses an English version's language even for a Turkish viewer", async () => {
    m.workingState.mockResolvedValue(stateWith({ defaultLocale: "en" }));
    await checkQuestionsAction(OPENING);
    expect(m.runQuestionCheck.mock.calls[0][0].teamLocale).toBe("en");
  });

  it("asks nothing when over the AI limit", async () => {
    m.aiLimitReached.mockResolvedValue(true);
    expect(await checkQuestionsAction(OPENING)).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(m.runQuestionCheck).not.toHaveBeenCalled();
  });

  it("asks nothing, and counts nothing, when no question has text", async () => {
    const empty = stateWith();
    empty.content!.stages = [];
    m.workingState.mockResolvedValue(empty);
    expect(await checkQuestionsAction(OPENING)).toMatchObject({ ok: true, findings: [], checked: [] });
    expect(m.aiLimitReached).not.toHaveBeenCalled();
    expect(m.runQuestionCheck).not.toHaveBeenCalled();
  });

  it("passes the job's refusals on as codes", async () => {
    m.runQuestionCheck.mockResolvedValueOnce({ status: "UNCONFIGURED" });
    expect(await checkQuestionsAction(OPENING)).toEqual({ ok: false, code: "UNCONFIGURED" });
    m.runQuestionCheck.mockResolvedValueOnce({ status: "FAILED", code: "PROVIDER_FAILED" });
    expect(await checkQuestionsAction(OPENING)).toEqual({ ok: false, code: "PROVIDER_FAILED" });
    m.runQuestionCheck.mockResolvedValueOnce({ status: "FAILED", code: "SCHEMA_FAILED" });
    expect(await checkQuestionsAction(OPENING)).toEqual({ ok: false, code: "SCHEMA_FAILED" });
  });

  it("returns the AI's findings with the time of the check", async () => {
    const finding = { activityId: A3, kind: "PROTECTED" as const, excerpt: "Evli misin", note: "Çıkar.", source: "AI" as const };
    m.runQuestionCheck.mockResolvedValueOnce({ status: "OK", findings: [finding] });
    const result = await checkQuestionsAction(OPENING);
    expect(result.ok && result.findings).toEqual([finding]);
    expect(result.ok && !Number.isNaN(Date.parse(result.at))).toBe(true);
  });
});
