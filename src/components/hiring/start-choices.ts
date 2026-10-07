/** The values createOpeningAction accepts for `start`. */
export type StartValue = "TEMPLATE" | "AI" | "COPY" | "BLANK";

export type AlternativeStart = {
  value: Exclude<StartValue, "AI">;
  /** hiringWizard.* */
  label: "altTemplate" | "altCopy" | "altBlank";
};

/**
 * HIRING-UX 5.20, user decision 2026-10-07: describing the role is the way in;
 * the other starts stay as small, plainly named links under it, each doing
 * exactly what it says. Copying is offered only when there is an opening to
 * copy from. No start is "recommended" (the old static badge misled).
 */
export function alternativeStarts(ctx: { hasCopySources: boolean }): AlternativeStart[] {
  const all: AlternativeStart[] = [
    { value: "TEMPLATE", label: "altTemplate" },
    { value: "COPY", label: "altCopy" },
    { value: "BLANK", label: "altBlank" },
  ];
  return all.filter((a) => a.value !== "COPY" || ctx.hasCopySources);
}
