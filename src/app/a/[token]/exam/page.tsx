import { headers } from "next/headers";
import { CandidateShell } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { DesktopOnlyGate } from "@/components/candidate/DesktopOnlyGate";
import { mobileMoment, serverDeviceHint } from "@/components/candidate/device";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { ExamRunner } from "@/components/candidate/exam/ExamRunner";
import { candidateSafe } from "@/lib/candidate-safe";
import { supportedLocales } from "@/lib/candidate-context";
import { enter, type SearchParams } from "@/app/a/[token]/shared";

export const dynamic = "force-dynamic";

/**
 * Section introductions and questions. The language picker shows on the
 * introductions only (the runner decides): changing language in the middle of
 * a question moves the ground under the student. A phone or tablet gets the desktop-only screen instead of
 * the exam, whatever the proctoring (DesktopOnlyGate). The runner draws its
 * own header for the introduction and the questions alike, so the frame has
 * none: a brand bar here would double the exam bar, and be missing after a
 * reload.
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
  const p = entry.state.proctoring;
  const proctored = p.preset !== "OFF";
  return (
    <CandidateIntl locale={entry.locale} timeZone={ORG_TIMEZONE}>
      <CandidateShell locale={entry.locale} header={false} wide>
        <DesktopOnlyGate
          token={token}
          serverHint={serverDeviceHint(await headers())}
          need={{ camera: proctored && p.camera, screenShare: proctored && p.screenShare, writing: entry.state.sections.some((s) => s.section === "WRITING") }}
          moment={mobileMoment(entry.state)}
        >
          {/* Keyed by language so a switch on an introduction starts from the server's fresh state. */}
          <ExamRunner key={entry.locale} token={token} initial={candidateSafe(entry.state)} locales={supportedLocales(entry.ctx)} />
        </DesktopOnlyGate>
      </CandidateShell>
    </CandidateIntl>
  );
}
