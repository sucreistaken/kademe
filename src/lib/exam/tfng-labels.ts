import type { TfngValue } from "./types";

/**
 * The German words a true/false/not-given statement is answered with. The
 * stored values stay R / F / NG; only the wording differs by exam family:
 * Richtig / Falsch / Nicht im Text (default) or, for ÖSD ZB1 and TestDaF style
 * items, Ja / Nein / Text sagt dazu nichts (`wording: "JA_NEIN"`).
 *
 * One mapping for the candidate screen and the teacher-facing bank editor.
 */
export type TfngWording = "JA_NEIN";

const DEFAULT_LABELS: Record<TfngValue, string> = { R: "Richtig", F: "Falsch", NG: "Nicht im Text" };
const JA_NEIN_LABELS: Record<TfngValue, string> = { R: "Ja", F: "Nein", NG: "Text sagt dazu nichts" };

export function tfngLabels(wording?: TfngWording): Record<TfngValue, string> {
  return wording === "JA_NEIN" ? JA_NEIN_LABELS : DEFAULT_LABELS;
}

/** The answer values offered for an item, in display order; `twoWay` drops NG. */
export function tfngChoices(opts: { twoWay?: boolean; wording?: TfngWording }): Array<[TfngValue, string]> {
  const labels = tfngLabels(opts.wording);
  const values: TfngValue[] = opts.twoWay ? ["R", "F"] : ["R", "F", "NG"];
  return values.map((v) => [v, labels[v]]);
}
