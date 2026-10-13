"use client";

import { CandidateLoadingScreen } from "@/components/candidate/boundary-screens";

/** While a candidate page is prepared on the server: calm, and only after a short pause (see LoadingCard). */
export default function CandidateLoading() {
  return <CandidateLoadingScreen />;
}
