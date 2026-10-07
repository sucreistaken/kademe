import { z } from "zod";
import { activityPayloadSchema, stagePayloadSchema, type ActivityPayload, type StagePayload } from "@/solutions/hiring/rules/patches";
import { signUndo, verifyUndo } from "../assessment/edit/undo-token";

/**
 * The "Geri al" strip after an "AI'a söyle" revision (HIRING-UX 5.20). The
 * token carries what the revision replaced (every stage, or one question) and
 * the builder's undo signature over it (undo-token.ts: same organisation,
 * opening and draft version, ten minutes). The server accepts it back only
 * unchanged, and validates the content again with the payload schemas, so
 * nothing the browser could have edited reaches the draft.
 *
 * Shape: `<base64url JSON>.<expires>.<mac>`.
 */
export type ReviseUndo = { kind: "all"; stages: StagePayload[] } | { kind: "activity"; activityId: string; payload: ActivityPayload };
export type UndoScope = { orgId: string; openingId: string; versionId: string };
type Options = { secret?: string; now?: number };

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all"), stages: z.array(stagePayloadSchema).max(50) }),
  z.object({ kind: z.literal("activity"), activityId: z.uuid(), payload: activityPayloadSchema }),
]);

const subjectOf = (scope: UndoScope, undo: ReviseUndo, json: string) => ({
  ...scope,
  kind: undo.kind === "all" ? ("revise-all" as const) : ("revise-activity" as const),
  stageId: undo.kind === "activity" ? undo.activityId : "",
  index: 0,
  payload: json,
});

export function packReviseUndo(scope: UndoScope, undo: ReviseUndo, options?: Options): string {
  const json = JSON.stringify(undo);
  return `${Buffer.from(json, "utf8").toString("base64url")}.${signUndo(subjectOf(scope, undo, json), options)}`;
}

/** The revision's previous content, or null when the token is not one this server handed out for this draft (or it expired). */
export function unpackReviseUndo(scope: UndoScope, token: string, options?: Options): ReviseUndo | null {
  if (typeof token !== "string" || token.length > 2_000_000) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  let json: string;
  let raw: unknown;
  try {
    json = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return null;
  // The signature is over the exact string that was signed, never a re-serialised one.
  return verifyUndo(subjectOf(scope, parsed.data, json), token.slice(dot + 1), options) ? parsed.data : null;
}
