"use client";

import { CandidateErrorScreen } from "@/components/candidate/boundary-screens";

/**
 * The candidate pages' error boundary. Without it a server error on a student
 * page was Next's bare 500 screen in English. It sits below the [token]
 * layout, so the proctoring engine and the candidate frame (language, school
 * contact) are still around it. In production the error's message is
 * redacted; only its digest is shown, as a code the school can pass on.
 */
export default function CandidateError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return <CandidateErrorScreen digest={error.digest} onRetry={retry ?? reset} />;
}
