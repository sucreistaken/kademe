import { redirect } from "next/navigation";
import { CandidateIntl } from "@/components/candidate/Intl";
import { StageRunner } from "@/components/candidate/StageRunner";
import { candidateSafe } from "@/lib/candidate-safe";
import { stepPath } from "@/lib/candidate-routes";
import { enter } from "@/app/a/[token]/shared";

export const dynamic = "force-dynamic";

/**
 * The stage number is in the URL for the candidate's benefit, not as an
 * instruction: if it does not match the stage the server says they are on, they
 * are sent to the right one. Typing a different number changes nothing.
 */
export default async function CandidateStagePage({
  params,
}: {
  params: Promise<{ token: string; n: string }>;
}) {
  const { token, n } = await params;
  const entry = await enter(token, "STAGE");
  if (entry.kind === "problem") return entry.node;

  const state = entry.state;
  if (String(state.stage?.position ?? 1) !== n) {
    redirect(stepPath(token, state));
  }

  return (
    <CandidateIntl locale={entry.locale}>
      <StageRunner token={token} initial={candidateSafe(state)} />
    </CandidateIntl>
  );
}
