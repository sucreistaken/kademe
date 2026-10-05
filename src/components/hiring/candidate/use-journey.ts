"use client";

import { journeyPosition, journeySteps, type JourneyKey } from "@/components/visual/journey";
import { useT } from "@/i18n/candidate-client";

/** G3: the journey on a preparation screen's footer: the parts this assessment has, this screen's part, in words. */
export function useJourney(at: JourneyKey, input: { device: boolean; warmup: boolean }) {
  const t = useT("hiringJourney");
  const position = journeyPosition(journeySteps(input), at);
  return { steps: position.total, current: position.current, label: t("label", { part: t(at), n: position.current, total: position.total }) };
}
