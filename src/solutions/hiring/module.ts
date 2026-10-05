import type { CandidateContext } from "@/lib/candidate-context";
import type { SolutionModule } from "@/solutions/types";
import { hiringManifest } from "./manifest";
import {
  attachMedia,
  closeExpiredStageRuns,
  hiringServes,
  hiringTitle,
  loadHiringContext,
  loadHiringState,
  runningSegment,
  salvageHiringUploads,
  stageHeartbeat,
  type HiringContext,
} from "./server/candidate";
import { loadConsentText } from "./server/consent";
import { hiringLibraryUsage } from "./server/library-usage";

/** The core only routes invitations hiring serves (serves), so a missing row here is a bug, said loudly. */
async function requireHiring(ctx: CandidateContext): Promise<HiringContext> {
  const h = await loadHiringContext(ctx);
  if (!h) throw new Error(`assessment ${ctx.assessment.id} has no hiring terms`);
  return h;
}

/** Abandoned uploads per cron tick; storage is touched once per asset. */
const SALVAGE_BATCH = 20;

export const hiringModule: SolutionModule = {
  ...hiringManifest,
  // Hiring's Today rows (waiting reviews, decisions) arrive with plan 3.
  async today() {
    return [];
  },
  // No proctoring in plan 2: every invitation freezes proctor_level OFF (plan 4 adds levels).
  async proctorPolicy() {
    return null;
  },
  candidate: {
    serves: hiringServes,
    async loadState(ctx) {
      return loadHiringState(await requireHiring(ctx));
    },
    async title(ctx) {
      return hiringTitle(await requireHiring(ctx));
    },
    async heartbeat(ctx) {
      return stageHeartbeat(await requireHiring(ctx));
    },
    async consentText(ctx) {
      const h = await requireHiring(ctx);
      return loadConsentText(h.assessment.orgId, h.hiring.consentTextId);
    },
  },
  attempts: {
    openSegment: runningSegment,
    // HIRING-UX R13: nothing ends a hiring attempt by machine, at any level. The
    // core asks only when a proctoring policy enables termination, which hiring never does.
    async terminate() {},
    // attachMedia never throws: a failure is logged and decided again on the question's next upload event.
    onMediaComplete: attachMedia,
    // A failed take gives its place back: the newest finished take becomes the answer again.
    onMediaFailed: attachMedia,
    async closeExpired(now, limit) {
      // Salvage first, so a rescued take is attached before its stage closes.
      // Best effort: a storage outage must not keep stages open.
      try {
        await salvageHiringUploads(now, SALVAGE_BATCH);
      } catch (error) {
        console.error("[hiring] upload salvage sweep failed", error);
      }
      return closeExpiredStageRuns(now, limit);
    },
  },
  library: { usage: hiringLibraryUsage },
};
