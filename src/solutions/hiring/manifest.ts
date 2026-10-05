import type { CandidateStepState, SolutionManifest } from "@/solutions/types";

/**
 * Hiring as the panel and the core see it (HIRING-UX 4.1, 4.3). The candidate
 * flow is built in plan 2; candidateFlowLive is on since its Task 10, after
 * verify:hiring-flow proved the endpoints end to end with a leak scan, and
 * Today offers the invite screen since Task 20.
 */
export const hiringManifest: SolutionManifest = {
  key: "hiring",
  dbKind: "HIRING",
  basePath: "/hiring",
  label: { tr: "İşe alım", en: "Hiring" },
  nav: [{ href: "/hiring/openings", label: { tr: "Alımlar", en: "Openings" } }],
  inviteHref: "/hiring/invite",
  inviteLabel: { tr: "Aday davet et", en: "Invite a candidate" },
  inviteCapability: "opening:write",
  candidateFlowLive: true,
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
