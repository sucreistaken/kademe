/** What the rights form shows after a send: the confirmation, or a failure it can retry. */
export type RightsSendResult = { status: "sent" } | { status: "failed"; reason: string | null };

/**
 * Sends a rights request and reports the truth: "sent" only when the server
 * took it. A refusal carries the server's own words (it answers in the
 * candidate's language with a code); a dropped connection carries none, so
 * the candidate never sees the browser's raw text.
 */
export async function sendRightsRequest(send: () => Promise<unknown>): Promise<RightsSendResult> {
  try {
    await send();
    return { status: "sent" };
  } catch (err) {
    return { status: "failed", reason: refusalText(err) };
  }
}

function refusalText(err: unknown): string | null {
  if (!(err instanceof Error) || !("code" in err) || !("status" in err)) return null;
  const { code, status } = err as Error & { code: unknown; status: unknown };
  return typeof code === "string" && code !== "UNKNOWN" && typeof status === "number" && err.message ? err.message : null;
}
