import { headers } from "next/headers";
import { candidateLocaleFromAcceptLanguage, type CandidateLocale } from "@/i18n/locale";

/**
 * The language for a student screen when no assessment says which: an unknown,
 * mistyped or revoked link. Only the browser's preference is known then.
 */
export async function visitorLocale(): Promise<CandidateLocale> {
  return candidateLocaleFromAcceptLanguage((await headers()).get("accept-language"));
}
