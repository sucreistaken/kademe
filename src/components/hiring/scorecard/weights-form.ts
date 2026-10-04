import { weightsProblem, weightsTotal } from "@/solutions/hiring/rules/weights";

/**
 * What the weights form shows as the reason "Puan kartını kaydet" is off.
 * MISSING: a measured competency has no weight (WEIGHTS_MISSING in the gate,
 * e.g. one added to a question after the weights were saved). NOT_WHOLE: a
 * value that is not a whole number 0-100. NOT_100: whole values, wrong total.
 */
export type WeightsFormProblem =
  | { code: "MISSING" | "NOT_WHOLE"; competencyId: string }
  | { code: "NOT_100"; total: number; gap: number };

/** Plain digits only: "1e2", "0x10", "70.5" and "-5" are not whole percentages a person typed. */
const WHOLE = /^\d{1,3}$/;

/**
 * Reads the typed values the way the rules will (Task 10 weightsProblem): the
 * first row at fault is named before any total, and the total counts only the
 * whole values, so the sentence never contradicts the total shown.
 */
export function readWeights(raw: Record<string, string>, used: string[]): { weights: Record<string, number>; total: number; problem: WeightsFormProblem | null } {
  const weights: Record<string, number> = {};
  let problem: WeightsFormProblem | null = null;
  for (const id of used) {
    const text = (Object.hasOwn(raw, id) ? raw[id] : "").trim();
    const value = WHOLE.test(text) ? Number(text) : Number.NaN;
    if (Number.isInteger(value) && value <= 100) weights[id] = value;
    else problem ??= { code: text === "" ? "MISSING" : "NOT_WHOLE", competencyId: id };
  }
  const total = weightsTotal(weights, used);
  if (!problem) {
    const rule = weightsProblem(weights, used);
    if (rule) problem = { code: "NOT_100", total: rule.total, gap: Math.abs(100 - rule.total) };
  }
  return { weights, total, problem };
}
