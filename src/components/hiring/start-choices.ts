import { Copy, FilePlus, FileText, type LucideIcon } from "lucide-react";

/** The values createOpeningAction accepts for `start` (unchanged). */
export type StartValue = "AI" | "COPY" | "BLANK";

export type StartChoice = {
  value: StartValue;
  icon: LucideIcon;
  title: "startAi" | "startCopy" | "startBlank";
  body: "startAiBody" | "startCopyBody" | "startBlankBody";
};

type Context = { hasCopySources: boolean };

/**
 * Manager mockup 4 ("Nasıl başlayalım?"), user decision 2026-10-06 (less AI):
 * the cards in the mockup's order, each a plain file icon. Copying is offered
 * only when there is an opening to copy (HIRING-UX 5.3). The ready-template
 * start of the mockup is a later plan: it is one more entry here (and one
 * more value the action accepts), nothing else in the step changes.
 */
const CHOICES: ReadonlyArray<StartChoice & { shown(ctx: Context): boolean }> = [
  { value: "COPY", icon: Copy, title: "startCopy", body: "startCopyBody", shown: (ctx) => ctx.hasCopySources },
  { value: "AI", icon: FileText, title: "startAi", body: "startAiBody", shown: () => true },
  { value: "BLANK", icon: FilePlus, title: "startBlank", body: "startBlankBody", shown: () => true },
];

export function startChoices(ctx: Context): StartChoice[] {
  return CHOICES.filter((c) => c.shown(ctx)).map(({ value, icon, title, body }) => ({ value, icon, title, body }));
}
