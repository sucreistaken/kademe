"use client";

import { Eraser, PenLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import { NotesLayer } from "@/components/candidate/exam/notes/NotesLayer";
import { useNotes } from "@/components/candidate/exam/notes/use-notes";

const BUTTON =
  "flex size-8 items-center justify-center rounded-[8px] border border-transparent text-ink-2 hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink aria-pressed:border-edge aria-pressed:bg-cream aria-pressed:text-ink";

/** A small pen-only pad under the listening player. Stays in this browser tab; never graded. */
export function ScratchPad({ token, sectionPosition, padKey }: { token: string; sectionPosition: number; padKey: string }) {
  const t = useNotes(token, sectionPosition, "pad", padKey);
  const n = useT("notes");
  const { tool, setTool, clear, undo, canUndo } = t;
  return (
    <section aria-label={n("pad")} className="mt-4 rounded-[14px] border border-line bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <span className="me-2 text-[13px] font-semibold text-ink-2">{n("pad")}</span>
        <button type="button" title={n("pen")} aria-label={n("pen")} aria-pressed={tool === "pen"} onClick={() => setTool(tool === "pen" ? "none" : "pen")} className={BUTTON}>
          <PenLine className="size-4" aria-hidden="true" />
        </button>
        <button type="button" title={n("eraser")} aria-label={n("eraser")} aria-pressed={tool === "eraser"} onClick={() => setTool(tool === "eraser" ? "none" : "eraser")} className={BUTTON}>
          <Eraser className="size-4" aria-hidden="true" />
        </button>
        <button type="button" title={n("clear")} aria-label={n("clear")} onClick={clear} className={BUTTON}>
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
        {canUndo ? (
          <span role="status" className="ms-1 flex items-center gap-2 text-[13px] text-ink-2">
            {n("cleared")}
            <button type="button" onClick={undo} className="font-semibold text-ink underline underline-offset-2">
              {n("undo")}
            </button>
          </span>
        ) : null}
      </div>
      <NotesLayer controller={t} pen marks={false} className={cn("h-[180px] w-full rounded-[10px] border border-line bg-canvas")}>
        {null}
      </NotesLayer>
      <p className="mt-2 text-[12.5px] text-muted">{n("padHint")}</p>
    </section>
  );
}
