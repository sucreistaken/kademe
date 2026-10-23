"use client";

import { Eraser, Highlighter, PenLine, Trash2, Underline } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import type { HighlightColor, NotesController, NotesTool } from "@/components/candidate/exam/notes/use-notes";

const SWATCH: Record<HighlightColor, string> = {
  yellow: "bg-[#ffec99]",
  green: "bg-[#c4eed0]",
  pink: "bg-[#fbcfe0]",
};
const COLOR_KEY = { yellow: "highlightYellow", green: "highlightGreen", pink: "highlightPink" } as const;
const COLORS: readonly HighlightColor[] = ["yellow", "green", "pink"];

const BUTTON =
  "flex size-8 items-center justify-center rounded-[8px] border border-transparent text-ink-2 hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink aria-pressed:border-edge aria-pressed:bg-cream aria-pressed:text-ink";

function ToolButton({
  label,
  pressed,
  onClick,
  children,
  className,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={onClick} className={cn(BUTTON, className)}>
      {children}
    </button>
  );
}

/**
 * The note tools above a passage: three highlighters, underline, pen (reading
 * only), eraser and clear. Clear acts at once and offers Undo for a few seconds.
 * Hidden entirely when the browser cannot paint highlights.
 */
export function NotesToolbar({ controller, pen = false, className }: { controller: NotesController; pen?: boolean; className?: string }) {
  const t = useT("notes");
  const { supported, tool, color, setTool, setColor, clear, undo, canUndo } = controller;
  if (supported !== true) return null;
  const toggle = (next: NotesTool) => setTool(tool === next ? "none" : next);
  return (
    <div role="toolbar" aria-label={t("toolbar")} className={cn("flex flex-wrap items-center gap-1", className)}>
      {COLORS.map((c) => (
        <ToolButton
          key={c}
          label={t(COLOR_KEY[c])}
          pressed={tool === "highlight" && color === c}
          onClick={() => {
            if (tool === "highlight" && color === c) setTool("none");
            else {
              setColor(c);
              setTool("highlight");
            }
          }}
        >
          <span className={cn("flex size-5 items-center justify-center rounded-[5px] border border-edge", SWATCH[c])}>
            <Highlighter className="size-3.5" aria-hidden="true" />
          </span>
        </ToolButton>
      ))}
      <ToolButton label={t("underline")} pressed={tool === "underline"} onClick={() => toggle("underline")}>
        <Underline className="size-4" aria-hidden="true" />
      </ToolButton>
      {pen ? (
        <ToolButton label={t("pen")} pressed={tool === "pen"} onClick={() => toggle("pen")}>
          <PenLine className="size-4" aria-hidden="true" />
        </ToolButton>
      ) : null}
      <ToolButton label={t("eraser")} pressed={tool === "eraser"} onClick={() => toggle("eraser")}>
        <Eraser className="size-4" aria-hidden="true" />
      </ToolButton>
      <ToolButton label={t("clear")} onClick={clear}>
        <Trash2 className="size-4" aria-hidden="true" />
      </ToolButton>
      {canUndo ? (
        <span role="status" className="ms-1 flex items-center gap-2 text-[13px] text-ink-2">
          {t("cleared")}
          <button type="button" onClick={undo} className="font-semibold text-ink underline underline-offset-2">
            {t("undo")}
          </button>
        </span>
      ) : null}
    </div>
  );
}
