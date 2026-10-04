import type { SolutionModule } from "@/solutions/types";
import { hiringManifest } from "./manifest";
import { hiringLibraryUsage } from "./server/library-usage";

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
    async onMediaComplete() {
      return notLive("onMediaComplete");
    },
  },
  library: { usage: hiringLibraryUsage },
};
