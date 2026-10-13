import type { NextRequest } from "next/server";
import { can } from "@/lib/authorize";
import { auditRecordingView } from "@/server/recordings";
import { currentUser } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * The player calls this when someone first presses play on an attempt's
 * recording, so the audit log can answer "who watched this student's exam".
 * Written once per person and attempt per half hour (see auditRecordingView).
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!can(user, "media:view")) return Response.json({ error: "forbidden" }, { status: 403 });
  let attemptId: unknown = null;
  try {
    attemptId = ((await req.json()) as { attemptId?: unknown })?.attemptId;
  } catch {
    attemptId = null;
  }
  if (typeof attemptId !== "string" || !(await auditRecordingView(user, attemptId))) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
