/**
 * What the candidate is told after asking for a new link or filing a rights
 * request. The core's own wording (the exam's) promises a reply; a solution
 * that keeps no such promise (hiring, decided by the caller through
 * `noReply`) gets wording without one, naming whom to write to when it is
 * urgent (`email`), or nobody when there is no address.
 */
export type NoReply = { email: string | null };

export type LinkHint =
  | { namespace: "linkProblem"; key: "requestHint" | "requestSentHint" }
  | { namespace: "linkProblem"; key: "requestHintNamed"; name: string }
  | { namespace: "hiringRequest"; key: "linkHint" | "linkSentHint"; email: string }
  | { namespace: "hiringRequest"; key: "linkHintPlain" | "linkSentHintPlain" };

export type RightsSent =
  | { namespace: "rights"; key: "sentBody" }
  | { namespace: "hiringRequest"; key: "rightsSent"; email: string }
  | { namespace: "hiringRequest"; key: "rightsSentPlain" };

export function linkRequestHint(input: { sent: boolean; contactName?: string | null; noReply?: NoReply }): LinkHint {
  const { sent, contactName, noReply } = input;
  if (noReply) {
    if (noReply.email) return { namespace: "hiringRequest", key: sent ? "linkSentHint" : "linkHint", email: noReply.email };
    return { namespace: "hiringRequest", key: sent ? "linkSentHintPlain" : "linkHintPlain" };
  }
  if (sent) return { namespace: "linkProblem", key: "requestSentHint" };
  return contactName ? { namespace: "linkProblem", key: "requestHintNamed", name: contactName } : { namespace: "linkProblem", key: "requestHint" };
}

export function rightsSentBody(noReply: NoReply | undefined): RightsSent {
  if (!noReply) return { namespace: "rights", key: "sentBody" };
  return noReply.email ? { namespace: "hiringRequest", key: "rightsSent", email: noReply.email } : { namespace: "hiringRequest", key: "rightsSentPlain" };
}
