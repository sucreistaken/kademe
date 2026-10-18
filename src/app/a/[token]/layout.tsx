import { headers } from "next/headers";
import { ProctorProvider } from "@/components/candidate/proctor/ProctorProvider";
import { CandidateFrameProvider, type CandidateFrame } from "@/components/candidate/frame-context";
import { resolveToken } from "@/lib/candidate-context";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { isCandidateLocale, candidateLocaleFromAcceptLanguage } from "@/i18n/locale";

/**
 * Keeps one proctoring engine alive across the student pages. Soft navigation
 * between the check, the exam and the finish screen keeps the camera, the
 * screen share and fullscreen; only a hard reload drops them.
 *
 * It also resolves the candidate's frame (language, school, contact address)
 * for the error, not-found and loading boundaries below it, which render in
 * place of a page and so have none of the page's data. A failure here must not
 * take the page down (an error in this layout would skip those boundaries), so
 * it falls back to the browser's language and no school.
 */
export default async function StudentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div translate="no" className="notranslate">
      <CandidateFrameProvider value={await candidateFrame(token)}>
        <ProctorProvider token={token}>{children}</ProctorProvider>
      </CandidateFrameProvider>
    </div>
  );
}

async function candidateFrame(token: string): Promise<CandidateFrame> {
  const ctx = await resolveToken(token)
    .then((r) => r.ctx ?? null)
    .catch(() => null);
  const locale = ctx && isCandidateLocale(ctx.locale) ? ctx.locale : candidateLocaleFromAcceptLanguage((await headers()).get("accept-language"));
  return { token, locale, timeZone: ORG_TIMEZONE, orgName: ctx?.orgName ?? null, contactEmail: ctx?.contactEmail ?? null };
}
