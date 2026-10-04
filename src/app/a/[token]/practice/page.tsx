import { UnknownLink } from "@/components/candidate/UnknownLink";
import { solutionPage, type PageSearchParams } from "@/lib/candidate-pages";

export const dynamic = "force-dynamic";

/** HIRING-UX 6.4, the warm-up question. Only a solution with a warm-up renders it; any other link sees the invalid-link card. */
export default async function CandidatePracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: PageSearchParams;
}) {
  const { token } = await params;
  const hosted = await solutionPage(token, "practice", searchParams);
  return hosted !== undefined ? hosted : <UnknownLink token={token} />;
}
