import type { SolutionModule } from "@/solutions/types";
import { hiringManifest } from "./manifest";
import { attachMedia, closeExpiredStageRuns, salvageHiringUploads } from "./server/candidate";
import { hiringLibraryUsage } from "./server/library-usage";

/** Abandoned uploads per cron tick; storage is touched once per asset. */
const SALVAGE_BATCH = 20;

/** Thrown if a candidate path ever reaches hiring before plan 2; the core never routes one here (candidateFlowLive). */
function notLive(what: string): never {
  throw new Error(`hiring candidate flow is not live yet (${what}); plan 2 builds it`);
}

export const hiringModule: SolutionModule = {
  ...hiringManifest,
  // Hiring's Today rows (waiting reviews, decisions) arrive with plan 3.
  async today() {
    return [];
  },
  // Proctoring for hiring arrives with plan 4.
  async proctorPolicy() {
    return null;
  },
  candidate: {
    async loadState() {
      return notLive("loadState");
    },
    async title() {
      return notLive("title");
    },
    async heartbeat() {
      return notLive("heartbeat");
    },
    async consentText() {
      return notLive("consentText");
    },
  },
  attempts: {
    async openSegment() {
      return null;
    },
    async terminate() {
      return notLive("terminate");
    },
    onMediaComplete: attachMedia,
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
