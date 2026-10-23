"use client";

import { useState } from "react";
import { ChevronDown, Eraser, Pencil, PenLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import { NotesLayer } from "@/components/candidate/exam/notes/NotesLayer";
import { MAX_TEXT } from "@/components/candidate/exam/notes/notes-model";
import { useNotes } from "@/components/candidate/exam/notes/use-notes";
import { UmlautBar, insertAt } from "@/components/candidate/exam/umlaut-bar";

const BUTTON =
  "flex size-8 items-center justify-center rounded-[8px] border border-transparent text-ink-2 hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink aria-pressed:border-edge aria-pressed:bg-cream aria-pressed:text-ink";
const MODE =
  "h-7 rounded-[6px] px-3 text-[13px] font-medium text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm";

export type PadMode = "type" | "draw";

/**
 * A small notes pad: typed notes (default) or pen drawing. Stays in this browser
 * tab; never graded. `collapsible` adds a header toggle (used on the speaking
 * screen, where space is tight); the notes are kept while it is folded.
 * `defaultOpen={false}` starts it folded so the first screen fits without scrolling.
 */
export function ScratchPad({
  token,
  sectionPosition,
  padKey,
  collapsible = false,
  defaultOpen = true,
  initialMode = "type",
  className,
}: {
  token: string;
  sectionPosition: number;
  padKey: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  initialMode?: PadMode;
  className?: string;
}) {
  const t = useNotes(token, sectionPosition, "pad", padKey);
  const n = useT("notes");
  const { tool, setTool, clear, undo, canUndo, data, setData } = t;
  const [mode, setModeState] = useState<PadMode>(initialMode);
  const [open, setOpen] = useState(defaultOpen);
  const [textEl, setTextEl] = useState<HTMLTextAreaElement | null>(null);
  const text = data.text ?? "";

  const setMode = (next: PadMode) => {
    setModeState(next);
    // Typing never leaves the pen armed over the textarea; drawing starts with the pen in hand.
    setTool(next === "draw" ? "pen" : "none");
  };
  const setText = (value: string) => setData((prev) => ({ ...prev, text: value || undefined }));

  return (
    <section aria-label={n("pad")} className={cn("mt-4 rounded-[14px] border border-line bg-surface p-3", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="me-2 flex items-center gap-1 text-[13px] font-semibold text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
          >
            <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90 rtl:rotate-90")} aria-hidden="true" />
            <Pencil className="size-3.5" aria-hidden="true" />
            {n("pad")}
          </button>
        ) : (
          <span className="me-2 text-[13px] font-semibold text-ink-2">{n("pad")}</span>
        )}
        {open ? (
          <>
            <div role="group" aria-label={n("modeLabel")} className="me-1 flex rounded-[8px] bg-cream p-0.5">
              <button type="button" aria-pressed={mode === "type"} onClick={() => setMode("type")} className={MODE}>
                {n("modeType")}
              </button>
              <button type="button" aria-pressed={mode === "draw"} onClick={() => setMode("draw")} className={MODE}>
                {n("modeDraw")}
              </button>
            </div>
            {mode === "draw" ? (
              <>
                <button type="button" title={n("pen")} aria-label={n("pen")} aria-pressed={tool === "pen"} onClick={() => setTool(tool === "pen" ? "none" : "pen")} className={BUTTON}>
                  <PenLine className="size-4" aria-hidden="true" />
                </button>
                <button type="button" title={n("eraser")} aria-label={n("eraser")} aria-pressed={tool === "eraser"} onClick={() => setTool(tool === "eraser" ? "none" : "eraser")} className={BUTTON}>
                  <Eraser className="size-4" aria-hidden="true" />
                </button>
              </>
            ) : null}
            <button type="button" title={n("clear")} aria-label={n("clear")} onClick={() => clear(mode === "draw" ? "strokes" : "text")} className={BUTTON}>
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
          </>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2">
          {mode === "type" ? (
            <>
              <textarea
                ref={setTextEl}
                lang="de"
                aria-label={n("pad")}
                placeholder={n("textPlaceholder")}
                value={text}
                maxLength={MAX_TEXT}
                rows={5}
                onChange={(e) => setText(e.target.value)}
                className="h-[140px] w-full resize-none rounded-[10px] border border-line bg-canvas px-3 py-2 text-[15px] leading-[1.55] text-ink"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
              />
              <UmlautBar onInsert={(ch) => setText(insertAt(textEl, ch, text))} />
            </>
          ) : (
            <NotesLayer controller={t} pen marks={false} className="h-[180px] w-full rounded-[10px] border border-line bg-canvas">
              {null}
            </NotesLayer>
          )}
          <p className="mt-2 text-[12.5px] text-muted">{n("padHint")}</p>
        </div>
      ) : null}
    </section>
  );
}
