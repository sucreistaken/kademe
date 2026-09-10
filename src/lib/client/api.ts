"use client";

/**
 * Thin client for `/api/c/*`. Every call carries the token from the URL and
 * nothing else: the server decides which stage, which activity and how much
 * time is left, so there is no id for this file to keep track of.
 */

export type ApiError = { error: string; message: string };

export function candidateApiBase(token: string) {
  return `/api/c/${encodeURIComponent(token)}`;
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = body as ApiError | null;
    throw Object.assign(new Error(err?.message ?? "Bir sorun oldu."), {
      code: err?.error ?? "UNKNOWN",
      status: res.status,
      body,
    });
  }
  return body as T;
}

export async function apiGet<T>(token: string, path: string): Promise<T> {
  return parse<T>(
    await fetch(`${candidateApiBase(token)}${path}`, { cache: "no-store" }),
  );
}

export async function apiSend<T>(
  token: string,
  path: string,
  body: unknown,
  method: "POST" | "PUT" = "POST",
): Promise<T> {
  return parse<T>(
    await fetch(`${candidateApiBase(token)}${path}`, {
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
