import type { CandidateStepState, SolutionManifest } from "@/solutions/types";

/**
 * Hiring as the panel and the core see it (HIRING-UX 4.1, 4.3). The candidate
 * flow is built in plan 2; candidateFlowLive turns on in its Task 10, once the
 * endpoints are proven to leak nothing, and inviteHref once the invite screen
 * exists and Today offers it (Task 20).
 */
export const hiringManifest: SolutionManifest = {
  key: "hiring",
  dbKind: "HIRING",
  basePath: "/hiring",
  label: { tr: "İşe alım", en: "Hiring" },
  nav: [{ href: "/hiring/openings", label: { tr: "Alımlar", en: "Openings" } }],
  inviteHref: null,
  inviteLabel: { tr: "Aday davet et", en: "Invite a candidate" },
  inviteCapability: "opening:write",
  candidateFlowLive: false,
  // Candidates answer in their own language; the provider detects it.
  transcriptionHint: null,
  accommodationRequests: true,
  // The hiring state names its own page; this maps a bare step for core callers.
  candidateStepPath: (token: string, state: CandidateStepState) => {
    const base = `/a/${encodeURIComponent(token)}`;
    if (state.step === "INFO") return `${base}/info`;
    if (state.step === "CHECK") return `${base}/check`;
    if (state.step === "STAGE") return `${base}/stage/${state.position ?? 1}`;
    if (state.step === "DONE") return `${base}/done`;
    return base;
  },
  positionAction: {
    label: { tr: "Bu pozisyon için alım aç", en: "Open a role for this position" },
    href: (positionId: string) => `/hiring/openings/new?position=${encodeURIComponent(positionId)}`,
  },
};
