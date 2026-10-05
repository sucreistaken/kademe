import { firstOpenIndex } from "@/solutions/hiring/rules/candidate-flow";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";
import type { CandidateResponseView, CurrentStage } from "@/solutions/hiring/rules/candidate-state";

/**
 * What the runner knows about one question's answer in this tab. `file`: a
 * file this tab finished uploading (the candidate's own name and size);
 * `uploading`: a file upload is in flight (the filled button waits for it).
 */
export type LocalAnswer = {
  text?: string;
  choiceIds?: string[];
  usedTextAlternative?: boolean;
  hasTake?: boolean;
  hasFile?: boolean;
  file?: { name: string; bytes: number };
  uploading?: boolean;
};

export function toLocal(r: CandidateResponseView): LocalAnswer {
  return { text: r.text, choiceIds: r.choiceIds, usedTextAlternative: r.usedTextAlternative, hasTake: r.recording !== null, hasFile: r.file !== null };
}

/**
 * Where a stage opens after a reload, a resume or a start that another tab
 * made first (ruling 2): the first question the candidate has not closed
 * (rules/candidate-flow firstOpenIndex), with every answer the server holds.
 */
export function resumeOf(responses: CandidateResponseView[]): { index: number; answers: Record<string, LocalAnswer> } {
  return {
    index: firstOpenIndex(responses.map((r) => r.closed)),
    answers: Object.fromEntries(responses.map((r) => [r.activityId, toLocal(r)])),
  };
}

/**
 * C25: the minutes the stage intro names. The clock counts down to a deadline
 * with any ALLOW_GRACE grace inside it, so the intro counts the grace too
 * (rounded up, like the landing's stage minutes): it never promises less time
 * than the clock then shows.
 */
export const introMinutes = (current: Pick<CurrentStage, "seconds" | "graceSeconds">) => Math.ceil((current.seconds + Math.max(0, current.graceSeconds)) / 60);

/** The tab's mirror of rules/candidate-flow responseAnswered, for the button's state only; the server decides. */
export function answeredLocally(a: Pick<CandidateActivity, "type" | "minChars">, answer: LocalAnswer): boolean {
  switch (a.type) {
    case "LONG_TEXT":
    case "SHORT_TEXT":
      return (answer.text ?? "").trim().length >= Math.max(1, a.minChars ?? 0);
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return (answer.choiceIds ?? []).length > 0;
    case "VIDEO":
    case "AUDIO":
      return !!answer.hasTake || (!!answer.usedTextAlternative && (answer.text ?? "").trim().length > 0);
    case "FILE_UPLOAD":
      return !!answer.hasFile;
  }
}

/** HIRING-UX 6.6: think, record and review each have their own filled button, so the runner shows none. */
export const ownsPrimary = (type: CandidateActivity["type"]) => type === "VIDEO" || type === "AUDIO";

export type PrimaryKey = "next" | "finishStage" | "finishAll";
export function primaryKey(index: number, count: number, lastStage: boolean): PrimaryKey {
  if (index < count - 1) return "next";
  return lastStage ? "finishAll" : "finishStage";
}

/** HIRING-UX 6: in the last 60 seconds only the clock's words change; it never blinks or turns red. */
export const isLastMinute = (ms: number) => ms > 0 && ms <= 60_000;
/** HIRING-UX 8.7: a screen reader hears the remaining time in whole minutes, once a minute. */
export const minutesLeft = (ms: number) => Math.ceil(ms / 60_000);

/**
 * HIRING-UX 6.8 keys 1-9 and the typing guard (ruling 5) live with the choice
 * cards now (Task 4 carry 7: core code may not import from hiring); the runner
 * keeps its names.
 */
export { isTypingTarget, keyIndex } from "@/components/visual/choice-keys";

/**
 * HIRING-UX 6.12, a second tab: each tab says hello on a BroadcastChannel; an
 * open tab answers "here"; a tab that hears "here" steps back and never
 * answers again, so a reload of the first tab is not blocked by it.
 */
export type TabMessage = { type: "hello" | "here"; id: string };
export function tabReply(own: string, message: TabMessage, blocked: boolean): { reply: TabMessage | null; blocked: boolean } {
  if (blocked) return { reply: null, blocked: true };
  if (message.id === own) return { reply: null, blocked: false };
  if (message.type === "hello") return { reply: { type: "here", id: own }, blocked: false };
  return { reply: null, blocked: true };
}
