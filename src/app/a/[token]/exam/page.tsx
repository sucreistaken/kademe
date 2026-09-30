import { CandidateShell } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { ExamRunner } from "@/components/candidate/exam/ExamRunner";
import { candidateSafe } from "@/lib/candidate-safe";
import { enter, type SearchParams } from "@/app/a/[token]/shared";

export const dynamic = "force-dynamic";

/**
 * Section introductions and questions. The language switch is gone from here
 * on purpose: changing language in the middle of a question moves the ground
 * under the student.
 */
export default async function ExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const { token } = await params;
  const entry = await enter(token, ["SECTION_INTRO", "ITEM"], searchParams, `/a/${token}/exam`);
  if (entry.kind === "problem") return entry.node;
  return (
    <CandidateIntl locale={entry.locale}>
      <CandidateShell locale={entry.locale} header={entry.state.step === "SECTION_INTRO"}>
        <ExamRunner token={token} initial={candidateSafe(entry.state)} />
      </CandidateShell>
    </CandidateIntl>
  );
}
