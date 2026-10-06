import { Copy, FilePlus, FileText, LayoutTemplate, type LucideIcon } from "lucide-react";

/** The values createOpeningAction accepts for `start`. */
export type StartValue = "TEMPLATE" | "AI" | "COPY" | "BLANK";

export type StartChoice = {
  value: StartValue;
  icon: LucideIcon;
  title: "startTemplate" | "startAi" | "startCopy" | "startBlank";
  body: "startTemplateBody" | "startAiBody" | "startCopyBody" | "startBlankBody";
  /** A small pill after the title; only the ready template has one. */
  badge?: "recommended";
};

type Context = { hasCopySources: boolean };

/**
 * Manager mockup 4 ("Nasıl başlayalım?"), user decision 2026-10-06 (less AI):
 * the cards in the mockup's order, each a plain icon. The ready template comes
 * first and is the one recommended start; the job-ad start gets no badge.
 * Copying is offered only when there is an opening to copy (HIRING-UX 5.3).
 */
const CHOICES: ReadonlyArray<StartChoice & { shown(ctx: Context): boolean }> = [
  { value: "TEMPLATE", icon: LayoutTemplate, title: "startTemplate", body: "startTemplateBody", badge: "recommended", shown: () => true },
  { value: "COPY", icon: Copy, title: "startCopy", body: "startCopyBody", shown: (ctx) => ctx.hasCopySources },
  { value: "AI", icon: FileText, title: "startAi", body: "startAiBody", shown: () => true },
  { value: "BLANK", icon: FilePlus, title: "startBlank", body: "startBlankBody", shown: () => true },
];

export function startChoices(ctx: Context): StartChoice[] {
  return CHOICES.filter((c) => c.shown(ctx)).map(({ value, icon, title, body, badge }) => (badge ? { value, icon, title, body, badge } : { value, icon, title, body }));
}
