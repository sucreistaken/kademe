import { UnknownLink } from "@/components/candidate/UnknownLink";
import { solutionPage, type PageSearchParams } from "@/lib/candidate-pages";

export const dynamic = "force-dynamic";

/** HIRING-UX 6.5-6.12: one stage of a staged assessment. Any other link sees the invalid-link card. */
export default async function CandidateStagePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; n: string }>;
  searchParams: PageSearchParams;
}) {
  const { token, n } = await params;
  const hosted = await solutionPage(token, "stage", searchParams, { n });
  return hosted !== undefined ? hosted : <UnknownLink token={token} />;
}
