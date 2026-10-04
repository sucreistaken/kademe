import type { AiCode } from "@/app/(manager)/hiring/openings/[id]/assessment/ai/result";
import type { ManagerMessages } from "@/i18n/manager";

export type AiKey = keyof ManagerMessages["hiringAi"] & string;
type Say = (key: AiKey, values?: Record<string, string | number>) => string;

/**
 * The sentence for every code an AI screen action answers (or a request that
 * never reached the server, NETWORK): never a raw error. A failed proposal
 * says why, in HIRING-UX 5.6's words ("Öneri üretilemedi: <neden>. ...").
 */
export function aiRefusal(code: AiCode | "NETWORK", t: Say): string {
  switch (code) {
    case "NOT_FOUND":
      return t("errNotFound");
    case "CLOSED":
      return t("errClosed");
    case "FORBIDDEN":
      return t("errForbidden");
    case "LIBRARY_FORBIDDEN":
      return t("errLibraryForbidden");
    case "INVALID":
      return t("errInvalid");
    case "NO_DRAFT":
      return t("errNoDraft");
    case "JOB_AD_TOO_SHORT":
      return t("jobAdTooShort");
    case "JOB_AD_TOO_LONG":
      return t("jobAdTooLong");
    case "RATE_LIMITED":
      return t("rateLimited");
    case "UNCONFIGURED":
      return t("unconfigured");
    case "PROVIDER_FAILED":
      return t("failed", { reason: t("reasonProvider") });
    case "SCHEMA_FAILED":
      return t("failed", { reason: t("reasonSchema") });
    case "COMPETENCY":
      return t("errCompetency");
    case "CHOICE_COMPETENCY":
      return t("choiceNoCompetency");
    case "TOO_MANY_COMPETENCIES":
      return t("errTooMany");
    case "STAGE_FULL":
      return t("errStageFull");
    case "NAME_REQUIRED":
      return t("errNameRequired");
    case "IN_USE":
      return t("errInUse");
    case "NOT_CREATED":
      return t("errNotCreated");
    case "NETWORK":
      return t("errNetwork");
    default: {
      // A new code is a type error here until it has its sentence.
      const unhandled: never = code;
      return unhandled;
    }
  }
}

/** After this long the usual "20-40 s" is no longer true; the line says so (a provider fallback took 3 minutes). */
export const SLOW_AFTER_SECONDS = 40;

/** The waiting line for `seconds` since "Önerileri üret". No client cap: the request runs until the server answers. */
export function waitingKey(seconds: number): "working" | "workingSlow" {
  return seconds >= SLOW_AFTER_SECONDS ? "workingSlow" : "working";
}

/** The note under a card whose "Geri al" was refused; NOT_FOUND clears the mark (session.ts clearsAcceptedMark) and says so. */
export function undoNote(code: AiCode | "NETWORK", t: Say): string {
  return code === "NOT_FOUND" ? t("goneElsewhere") : aiRefusal(code, t);
}
