import type { SolutionManifest } from "@/solutions/types";

/**
 * Hiring as the panel sees it (HIRING-UX 4.1, 4.3). Candidates are not served
 * yet: candidateFlowLive stays false until plan 2 (hiring-candidate-flow)
 * builds the candidate screens and endpoints, and inviteHref stays null until
 * invitations exist.
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
  candidateStepPath: (token: string) => `/a/${encodeURIComponent(token)}`,
  positionAction: {
    label: { tr: "Bu pozisyon için alım aç", en: "Open a role for this position" },
    href: (positionId: string) => `/hiring/openings/new?position=${encodeURIComponent(positionId)}`,
  },
};
