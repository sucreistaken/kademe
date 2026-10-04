import type { ActionCode } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/result";
import type { ManagerMessages } from "@/i18n/manager";

export type BuilderKey = keyof ManagerMessages["hiringBuilder"] & string;

/**
 * The sentence for a refused builder write (carry 4): every code the actions
 * answer has its own, never a raw error. An INVALID answer is named by its
 * first field path (rules/patches ranges): a time, a count, a size, or a text
 * that is too long.
 */
export function fieldKey(path: string): BuilderKey {
  const [head, second] = path.split(".");
  switch (head) {
    case "durationSeconds":
      return "errStageMinutes";
    case "thinkSeconds":
      return "errThink";
    case "answerSeconds":
      return "errAnswer";
    case "maxTakes":
      return "errTakes";
    case "config":
      if (second === "minChars" || second === "maxChars") return "errChars";
      if (second === "maxFileBytes") return "errFileSize";
      if (second === "choices") return path.split(".").length > 3 ? "errTooLong" : "errChoices";
      return "saveRefused";
    case "name":
    case "description":
    case "internalPurpose":
    case "prompt":
    case "note":
    case "internalQuestion":
    case "managerNotes":
    case "expectedBehaviours":
    case "redFlags":
    case "answerExamples":
      return "errTooLong";
    default:
      return "saveRefused";
  }
}

export function refusalKey(code: ActionCode | "NETWORK", fields: readonly string[] = [], context: "edit" | "undo" = "edit"): BuilderKey {
  switch (code) {
    case "INVALID":
      return fields[0] ? fieldKey(fields[0]) : "saveRefused";
    case "NO_DRAFT":
      return "errNoDraft";
    case "CLOSED":
      return "errClosed";
    case "FORBIDDEN":
      return "errForbidden";
    case "STAGE_FULL":
      return context === "undo" ? "errStageFullUndo" : "errStageFull";
    case "COMPETENCY":
      return "errCompetency";
    case "CHOICE_COMPETENCY":
      return "errChoiceCompetency";
    case "TOO_MANY_COMPETENCIES":
      return "errTooMany";
    case "NOT_FOUND":
      return "errNotFound";
    case "UNDO_EXPIRED":
      return "errUndoExpired";
    case "NETWORK":
      return "saveFailed";
    default: {
      // A new code is a type error here until it has its sentence.
      const unhandled: never = code;
      return unhandled;
    }
  }
}
