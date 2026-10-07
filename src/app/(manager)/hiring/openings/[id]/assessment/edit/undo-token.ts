import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveSigningSecret } from "@/lib/signing-secret";

/**
 * "Geri al" hands a deleted stage or question back to the server. The client
 * only carries it: the server signs the exact payload string, its place and
 * its opening and draft version when it deletes, and accepts it back only
 * unchanged, for the same organisation, opening and draft, within a few minutes (the strip shows 8
 * seconds). The restore then validates the payload again with the schema, so
 * nothing the browser could have edited reaches the draft.
 */
export type UndoSubject = {
  orgId: string;
  openingId: string;
  /** The draft the item was deleted from: a ticket never restores into a later draft. */
  versionId: string;
  /** "revise-all" / "revise-activity": the wizard's "AI'a söyle" undo (setup/revise-undo.ts). */
  kind: "stage" | "activity" | "revise-all" | "revise-activity";
  /** The stage a question goes back into; the revised question for "revise-activity"; empty otherwise. */
  stageId: string;
  index: number;
  payload: string;
};

const LIFETIME_MS = 10 * 60 * 1000;

const secretOf = (options?: { secret?: string }) => options?.secret ?? resolveSigningSecret(process.env);

function mac(subject: UndoSubject, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify(["hiring-undo", subject.orgId, subject.openingId, subject.versionId, subject.kind, subject.stageId, subject.index, expiresAt, subject.payload]))
    .digest("hex");
}

export function signUndo(subject: UndoSubject, options?: { secret?: string; now?: number }): string {
  const expiresAt = (options?.now ?? Date.now()) + LIFETIME_MS;
  return `${expiresAt}.${mac(subject, expiresAt, secretOf(options))}`;
}

export function verifyUndo(subject: UndoSubject, token: string, options?: { secret?: string; now?: number }): boolean {
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d{1,15}$/.test(expires)) return false;
  const expiresAt = Number(expires);
  const now = options?.now ?? Date.now();
  if (expiresAt < now || expiresAt > now + LIFETIME_MS) return false;
  const a = Buffer.from(mac(subject, expiresAt, secretOf(options)), "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
