"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { CandidateMessages } from "@/i18n/candidate";

/**
 * Typed access to one namespace of the candidate dictionary.
 *
 * next-intl types `useTranslations` through a global `AppConfig` augmentation,
 * but that global would have to be either the candidate dictionary or the
 * manager one, and this application renders both. So the namespace is typed
 * here instead: a key that does not exist in `candidate.tr.json` is a compile
 * error, and the manager side can do the same with its own dictionary.
 */
export type Values = Record<string, string | number | Date>;

export type RichValues = Record<
  string,
  string | number | Date | ((chunks: ReactNode) => ReactNode)
>;

export type TypedT<Namespace extends keyof CandidateMessages> = {
  (key: keyof CandidateMessages[Namespace] & string, values?: Values): string;
  /** For a message that wraps part of itself in a link or emphasis. */
  rich(
    key: keyof CandidateMessages[Namespace] & string,
    values?: RichValues,
  ): ReactNode;
};

export function useT<Namespace extends keyof CandidateMessages>(
  namespace: Namespace,
): TypedT<Namespace> {
  return useTranslations(namespace as string) as unknown as TypedT<Namespace>;
}
