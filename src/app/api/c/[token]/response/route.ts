import type { NextRequest } from "next/server";
import type { ResponsePayload } from "@/db/schema/types";
import { candidateJson } from "@/lib/candidate-safe";
import {
  activityAt,
  currentStage,
  loadResponses,
  saveResponse,
  writeWindow,
} from "@/lib/candidate-flow";
import { badRequest, conflict, readJson, withCandidate } from "@/lib/candidate-api";

type Body = {
  /**
   * Which stage the tab believes it is on, 1 based. Still not an id, but it is
   * what stops a tab left open on stage 2 from writing into stage 3's answers
   * after the candidate submitted from another tab: "current stage + index"
   * alone resolves to a real activity either way.
   */
  stagePosition?: number;
  /** Position of the activity inside the current stage. Never an id. */
  activityIndex?: number;
  text?: string;
  choiceIds?: string[];
  usedTextAlternative?: boolean;
};

/**
 * Draft autosave. The client names an activity by its position in the stage the
 * server already decided it is on, so there is no id it could tamper with.
 * Media answers do not come through here: they are written by media/complete.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (request, ctx) => {
    const body = await readJson<Body>(request);
    if (!body || typeof body.activityIndex !== "number") {
      return badRequest(ctx, "ACTIVITY_INDEX_REQUIRED");
    }

    const current = await currentStage(ctx);
    if (!current) return conflict(ctx, "NO_STAGE");
    const run = current.target.run;
    if (!run) return conflict(ctx, "STAGE_NOT_STARTED");

    // A missing position is treated like a wrong one: the only client that
    // omits it is one running code from before the check existed, and that is
    // a stale tab by definition.
    if (body.stagePosition !== current.target.position) {
      return conflict(ctx, "STAGE_MISMATCH");
    }

    const window = writeWindow(run, current.target.stage);
    if (!window.allowed) {
      return conflict(ctx, "STAGE_EXPIRED");
    }

    const activity = activityAt(current, body.activityIndex);
    if (!activity) return badRequest(ctx, "ACTIVITY_NOT_FOUND");

    const config = activity.config ?? {};
    const validChoices = new Set((config.choices ?? []).map((c) => c.id));

    const payload: ResponsePayload = {};
    if (typeof body.text === "string") {
      const max = config.maxChars ?? 20000;
      payload.text = body.text.slice(0, max);
    }
    if (Array.isArray(body.choiceIds)) {
      const picked = body.choiceIds.filter((id) => validChoices.has(id));
      payload.choiceIds =
        activity.type === "SINGLE_CHOICE" ? picked.slice(0, 1) : picked;
    }
    if (body.usedTextAlternative) payload.usedTextAlternative = true;

    // Keep whatever media the activity already has; only the text side is drafted.
    const rows = await loadResponses(run.id);
    const before = rows.find((r) => r.activityId === activity.id)?.payload;
    if (before?.mediaAssetId) payload.mediaAssetId = before.mediaAssetId;
    if (before?.fileAssetIds) payload.fileAssetIds = before.fileAssetIds;

    await saveResponse(run.id, activity, payload);
    return candidateJson({ saved: true, savedAt: Date.now() });
  });
}
