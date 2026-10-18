"use client";

import { messagesFor } from "@/i18n/candidate";
import { DEFAULT_LOCALE, isCandidateLocale, type CandidateLocale } from "@/i18n/locale";

/**
 * Thin client for `/api/c/*`. Every call carries the token from the URL and
 * nothing else: the server decides which stage, which activity and how much
 * time is left, so there is no id for this file to keep track of.
 */

export type ApiError = { error: string; message: string };

export function candidateApiBase(token: string) {
  return `/api/c/${encodeURIComponent(token)}`;
}

/**
 * The language the candidate is reading: the candidate frame carries it on
 * its root (`lang` on CandidateShell), which is the first element in the body
 * with one. A text in German inside a question comes later in the document.
 */
export function pageLocale(): CandidateLocale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const lang = document.querySelector("body [lang]")?.getAttribute("lang") ?? document.documentElement?.lang;
  return isCandidateLocale(lang) ? lang : DEFAULT_LOCALE;
}

/**
 * A request that never reached the server: the browser rejects fetch with a
 * TypeError whose text depends on the browser ("Failed to fetch" in Chrome and
 * Edge, "Load failed" in Safari, "NetworkError when attempting to fetch
 * resource." in Firefox). That text must never reach a candidate.
 */
export function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError && /failed to fetch|load failed|networkerror|network request failed/i.test(err.message);
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (!isNetworkFailure(err)) throw err;
    throw Object.assign(new Error(messagesFor(pageLocale()).visual.networkError), {
      code: "NETWORK",
      status: 0,
      cause: err,
    });
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = body as ApiError | null;
    throw Object.assign(new Error(err?.message ?? messagesFor(pageLocale()).common.somethingWrong), {
      code: err?.error ?? "UNKNOWN",
      status: res.status,
      body,
    });
  }
  return body as T;
}

export async function apiGet<T>(token: string, path: string): Promise<T> {
  return parse<T>(
    await request(`${candidateApiBase(token)}${path}`, { cache: "no-store" }),
  );
}

export async function apiSend<T>(
  token: string,
  path: string,
  body: unknown,
  method: "POST" | "PUT" = "POST",
): Promise<T> {
  return parse<T>(
    await request(`${candidateApiBase(token)}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    }),
  );
}

/** Best effort, used on unload where a normal fetch would be cancelled. */
export function apiBeacon(token: string, path: string, body: unknown) {
  try {
    const blob = new Blob([JSON.stringify(body ?? {})], {
      type: "application/json",
    });
    return navigator.sendBeacon(`${candidateApiBase(token)}${path}`, blob);
  } catch {
    return false;
  }
}
