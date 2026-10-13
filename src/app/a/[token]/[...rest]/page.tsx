import { notFound } from "next/navigation";

/**
 * Any path under a candidate link that no page serves (a mistyped or cut-off
 * address). Next sends unmatched URLs to the root 404, which knows nothing of
 * the candidate; calling notFound() here shows the candidate's own screen
 * (../not-found.tsx) in their language with the way back to their link.
 */
export default function UnknownCandidatePath(): never {
  notFound();
}
