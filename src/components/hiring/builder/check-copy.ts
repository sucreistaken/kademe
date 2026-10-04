import type { CheckCode } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/check-result";
import type { ManagerMessages } from "@/i18n/manager";

export type CheckKey = keyof ManagerMessages["hiringCheck"] & string;
type Say = (key: CheckKey, values?: Record<string, string | number>) => string;

/**
 * The sentence for every code "AI ile kontrol et" can answer, plus two that
 * never reach the server: NETWORK (the request failed) and UNSAVED (typed text
 * could not be saved first, so the saved questions would be stale). Never a
 * raw code; the AI refusals say the word rule still stands.
 */
export function checkRefusal(code: CheckCode | "NETWORK" | "UNSAVED", t: Say): string {
  switch (code) {
    case "NOT_FOUND":
      return t("errNotFound");
    case "CLOSED":
      return t("errClosed");
    case "FORBIDDEN":
      return t("errForbidden");
    case "INVALID":
      return t("errInvalid");
    case "NO_DRAFT":
      return t("errNoDraft");
    case "RATE_LIMITED":
      return t("rateLimited");
    case "UNCONFIGURED":
      return t("unconfigured");
    case "PROVIDER_FAILED":
    case "SCHEMA_FAILED":
      return t("failed");
    case "NETWORK":
      return t("errNetwork");
    case "UNSAVED":
      return t("unsavedFirst");
    default: {
      // A new code is a type error here until it has its sentence.
      const unhandled: never = code;
      return unhandled;
    }
  }
}
