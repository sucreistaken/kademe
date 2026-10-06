/**
 * HIRING-VISUAL-FLOW 4.2 (W1-W10, K12): the pure core every guided flow of the
 * panel shares. A flow is a list of step ids; the step lives in the address's
 * hash (W3) or, inside a Sheet whose page owns the hash, in memory. Nothing
 * here touches the browser, so each rule has a test.
 */
export type FlowJourney = { steps: number; current: number };

/**
 * W3: the step the address asks for. An unknown hash opens the first step; a
 * step past the first one that is not ready yet opens that one instead (the
 * browser's forward button or a copied link never skips a decision).
 * `firstInvalid` must be one of `steps` (or null when every step is ready).
 */
export function flowStepOf<S extends string>(hash: string, input: { steps: readonly S[]; firstInvalid: S | null }): S {
  const asked = input.steps.find((s) => `#${s}` === hash) ?? input.steps[0];
  const stop = input.firstInvalid;
  if (stop !== null && input.steps.includes(stop) && input.steps.indexOf(asked) > input.steps.indexOf(stop)) return stop;
  return asked;
}

/**
 * W2, W10: "Adım n / N" for the footer. `path` is the main path the journey
 * counts; a step outside it (opened with "Değiştir" from a summary) shows the
 * place of `fallback`, so the bar never jumps back.
 */
export function flowJourney<S extends string>(path: readonly S[], current: S, fallback?: S): FlowJourney {
  const at = path.indexOf(current);
  const index = at >= 0 ? at : fallback !== undefined ? path.indexOf(fallback) : -1;
  return { steps: path.length, current: index + 1 };
}

/** W7, H6: the exit link says what leaving costs; it never asks. */
export const exitKey = (dirty: boolean): "exit" | "exitUnsaved" => (dirty ? "exitUnsaved" : "exit");

/** One decision compared with its saved value: a list is a set (choosing the same people in another order is no change); anything else strictly. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v) => b.includes(v)) && b.every((v) => a.includes(v));
  return Object.is(a, b);
}

/** P8, W5: one summary row per field of a flow, marked when it differs from what is saved. */
export function summaryRows<T extends object, K extends keyof T & string>(before: T, after: T, fields: readonly K[]): Array<{ field: K; changed: boolean }> {
  return fields.map((field) => ({ field, changed: !sameValue(before[field], after[field]) }));
}

/** W7: something in this flow differs from what is saved. */
export const isDirty = <T extends object, K extends keyof T & string>(before: T, after: T, fields: readonly K[]): boolean => summaryRows(before, after, fields).some((r) => r.changed);

/** W8: the step a server problem belongs to; null keeps it on the summary (rights, a closed opening, a lost connection). */
export function stepOfProblem<P extends string, S extends string>(map: Partial<Record<P, S>>, problem: P): S | null {
  return map[problem] ?? null;
}

/** P8: "Kaydet" waits with "Değişiklik yok." while nothing changed. */
export const saveWait = (changed: boolean): "noChanges" | null => (changed ? null : "noChanges");
