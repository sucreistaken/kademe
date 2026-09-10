"use client";

import { useTranslations } from "next-intl";
import type { ManagerMessages } from "@/i18n/manager";
import type { RichValues, Values } from "@/i18n/candidate-client";

/**
 * Typed access to one namespace of the manager dictionary.
 *
 * Same reasoning as `useT` on the candidate side: next-intl types
 * `useTranslations` through a global `AppConfig` augmentation, and that global
 * would have to be either the candidate dictionary or the manager one while
 * this application renders both. Typing the namespace here keeps a missing key
 * a compile error on both sides.
 */
export type TypedMT<Namespace extends keyof ManagerMessages> = {
  (key: keyof ManagerMessages[Namespace] & string, values?: Values): string;
  rich(
    key: keyof ManagerMessages[Namespace] & string,
    values?: RichValues,
  ): React.ReactNode;
};

export function useMT<Namespace extends keyof ManagerMessages>(
  namespace: Namespace,
): TypedMT<Namespace> {
  return useTranslations(namespace as string) as unknown as TypedMT<Namespace>;
}
