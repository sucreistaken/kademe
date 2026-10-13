"use client";

import { CandidateNotFoundScreen } from "@/components/candidate/boundary-screens";

/**
 * A path under a candidate link that does not exist (the catch-all page next
 * to this file calls notFound()). The way on is the link itself: the server
 * sends the student to the step they are on.
 */
export default function CandidateNotFound() {
  return <CandidateNotFoundScreen />;
}
