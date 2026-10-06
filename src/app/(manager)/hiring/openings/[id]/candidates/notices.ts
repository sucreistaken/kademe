import { noticeOf, one, type SearchParams } from "@/lib/url-notice";
import type { ExtendNotice, RequestNotice } from "./actions";

/** Every notice the tab's actions come back with; shown once, then taken out of the address. */
export const NOTICE_PARAMS = ["handled", "extended", "extend", "request"] as const;

export type CandidatesNoticeKey =
  | "requestHandled"
  | "extended"
  | "extendClosed"
  | "extendForbidden"
  | "extendNotFound"
  | "extendCompleted"
  | "extendStarted"
  | "extendFailed"
  | "requestClosed"
  | "requestForbidden"
  | "requestNotFound"
  | "requestFailed";

const EXTEND: Record<ExtendNotice, CandidatesNoticeKey> = {
  closed: "extendClosed",
  forbidden: "extendForbidden",
  notfound: "extendNotFound",
  completed: "extendCompleted",
  started: "extendStarted",
  failed: "extendFailed",
};
const REQUEST: Record<RequestNotice, CandidatesNoticeKey> = {
  closed: "requestClosed",
  forbidden: "requestForbidden",
  notfound: "requestNotFound",
  failed: "requestFailed",
};

/**
 * The notice the address carries, as a hiringCandidates key, and whether it
 * is a refusal or a failure (`warn`: drawn as a warning, never like a success;
 * Task 18 fix round 1).
 */
export function candidatesNotice(sp: SearchParams): { key: CandidatesNoticeKey; warn: boolean } | null {
  if (one(sp.handled) === "1") return { key: "requestHandled", warn: false };
  if (one(sp.extended) === "1") return { key: "extended", warn: false };
  const extend = noticeOf(sp, "extend", EXTEND);
  if (extend) return { key: extend, warn: true };
  const request = noticeOf(sp, "request", REQUEST);
  if (request) return { key: request, warn: true };
  return null;
}

/** Task 18 carry: a refusal is said in words ("Yapılmadı:") and as an alert, not only by its grey dot. */
export function noticeVoice(notice: { warn: boolean }): { role: "alert" | "status"; lead: boolean } {
  return notice.warn ? { role: "alert", lead: true } : { role: "status", lead: false };
}
