"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { gapRowNumber, linkPassage } from "@/lib/exam/insertion-gaps";
import { passageBlocks } from "@/lib/exam/passage-blocks";
import type { CandidateItem } from "@/lib/exam/safe";
import type { ItemAnswer } from "@/lib/exam/types";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { ExamImage } from "./ExamImage";
import { LetterDisc, MatchPicker } from "./MatchPicker";
import { MatchUiProvider, useHasMatchUi, useMatchUi } from "./match-ui";
import { cardTitles, pickerChoices, targetViews, withMatch } from "./match-targets";

/**
 * Matching, the two ways it is answered. Every choice is made from one list
 * that opens on a click (MatchPicker); nothing is dragged.
 *
 *  - Text insertion whose gaps are found in the reading text: the gaps are
 *    buttons in the text (PassageBody, in the reading pane) and this column
 *    holds only the lettered sentences, as a reference that shows where each
 *    one has gone.
 *  - Every other matching item (and an insertion whose gaps cannot be found):
 *    each row is a numbered statement with one "Choose" button under it.
 *
 * Rows hold the aliased target ids the server sent; a cleared row is removed,
 * never stored as "".
 */

/** How the item is answered, said in the exam's language under the prompt. */
const INSERT_INSTRUCTION = "Klicken Sie auf eine Lücke im Text und wählen Sie den passenden Satz. Jeden Satz können Sie nur einmal verwenden.";
const INSERT_ROWS_INSTRUCTION = "Wählen Sie für jede Lücke den passenden Satz. Jeden Satz können Sie nur einmal verwenden.";
const PICTURE_INSTRUCTION = "Wählen Sie für jede Nummer das passende Bild.";
export const MATCH_INSTRUCTION = "Wählen Sie für jede Nummer die passende Antwort.";

export function matchInstruction(kind: { linked: boolean; gapRows: boolean; pictures: boolean }): string {
  if (kind.linked) return INSERT_INSTRUCTION;
  if (kind.gapRows) return INSERT_ROWS_INSTRUCTION;
  return kind.pictures ? PICTURE_INSTRUCTION : MATCH_INSTRUCTION;
}

type MatchingViewProps = {
  item: CandidateItem;
  answer: ItemAnswer;
  onChange: (next: ItemAnswer) => void;
  disabled?: boolean;
  hidePrompt?: boolean;
  /** The item's prompt, drawn by the caller. */
  prompt: ReactNode;
};

export function MatchingView(props: MatchingViewProps) {
  const shared = useHasMatchUi();
  // The reading pane shares the open list with this column through the exam's provider; any other page has none, so the item brings its own.
  return shared ? <MatchingBody {...props} /> : <MatchUiProvider><MatchingBody {...props} /></MatchUiProvider>;
}

function MatchingBody({ item, answer, onChange, disabled, hidePrompt, prompt }: MatchingViewProps) {
  const ti = useT("examItems");
  const uid = useId();
  const ui = useMatchUi();
  if (item.content.kind !== "MATCHING") return null;
  const rows = item.content.left;
  const rowOrder = rows.map((l) => l.id);
  const matches = answer.matches ?? {};
  // The advert titles and the gap markers live in the reading text beside the item.
  const reading = item.stimulus?.kind === "READING" ? item.stimulus : null;
  const views = targetViews(item.content.right, reading ? cardTitles(reading.text, reading.title) : undefined);
  const link = reading ? linkPassage(passageBlocks(reading.text, reading.title), rows) : null;
  const gallery = views.filter((v) => v.image);
  const gapRows = link !== null || rows.every((l) => gapRowNumber(l.text) !== null);
  // Text insertion uses each sentence once, so a sentence picked for a second gap leaves the first; other matching may share a target.
  const setRow = (rowId: string, targetId: string | null) => onChange({ matches: withMatch(matches, rowId, targetId, gapRows) });
  // A row is named by its gap number in an insertion item, else by its place in the list.
  const rowNumber = (rowId: string) => link?.numbers.get(rowId) ?? (gapRows ? gapRowNumber(rows.find((l) => l.id === rowId)?.text ?? "") : null) ?? rowOrder.indexOf(rowId) + 1;
  const hintFor = (usedBy: string[]) => ti(gapRows ? "insertUsedIn" : "matchUsedAt", { n: usedBy.map(rowNumber).join(", ") });
  const instruction = matchInstruction({ linked: link !== null, gapRows, pictures: gallery.length > 0 });

  // A click on a sentence of the list goes to the gap whose list is open, like a click inside that list.
  const place = (targetId: string) => {
    if (disabled || !ui.openRow || !rowOrder.includes(ui.openRow)) return;
    setRow(ui.openRow, targetId);
    ui.closeRow(ui.openRow);
  };

  return (
    <div>
      {hidePrompt ? null : prompt}
      {/* On a page of several items with the same prompt, the note is said once too. */}
      {hidePrompt ? null : (
        <p lang="de" className="mt-3 text-[14px] text-ink-2">
          {instruction}
        </p>
      )}
      {gallery.length > 0 ? (
        <div className="mt-4 grid max-w-[720px] grid-cols-2 gap-3 sm:grid-cols-3">
          {gallery.map((v) => (
            <figure key={v.id} lang="de" className="m-0 min-w-0">
              <div className="relative">
                <ExamImage sequence={item.sequence} image={v.image!} />
                <span className="absolute start-2 top-2 flex size-8 items-center justify-center rounded-full bg-white text-[15px] font-semibold text-ink shadow-sm">{v.badge}</span>
              </div>
              {v.caption ? <figcaption className="mt-1.5 text-[14px] text-ink-2">{v.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : null}
      {link ? (
        <ol aria-label={ti("matchTargets")} data-insert-list="" dir="ltr" className="mt-4 flex flex-col gap-2">
          {views.map((v) => {
            const holders = rows.filter((l) => matches[l.id] === v.id).map((l) => l.id);
            const used = holders.length > 0;
            const where = holders.map(rowNumber).join(", ");
            return (
              <li
                key={v.id}
                data-insert-sentence={v.id}
                onClick={() => place(v.id)}
                className={cn(
                  "flex items-start gap-3 rounded-[10px] border px-3.5 py-2.5 text-[15px] leading-[1.5]",
                  used ? "border-line bg-canvas text-ink-3" : "border-line-strong bg-surface text-ink",
                  ui.openRow && !disabled && "cursor-pointer hover:border-accent",
                )}
              >
                <LetterDisc badge={v.badge} tone={v.disc} />
                <span lang="de" className="min-w-0 flex-1 pt-0.5">
                  {v.label}
                </span>
                {used ? (
                  <span className="tnum mt-0.5 shrink-0 rounded-full bg-cream px-2 py-0.5 text-[12px] font-bold text-ink-2">
                    <span aria-hidden>{`→ ${where}`}</span>
                    <span className="sr-only">{ti("insertUsedIn", { n: where })}</span>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {rows.map((l, n) => {
            const chosen = views.find((v) => v.id === matches[l.id]);
            const textId = `${uid}-row${n}`;
            const buttonId = `${uid}-pick${n}`;
            const open = ui.openRow === l.id && !disabled;
            return (
              <li key={l.id} data-match-row={l.id} dir="ltr" className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-[10px] border border-line bg-surface px-4 py-3.5">
                <span aria-hidden className="tnum mt-0.5 flex size-7 items-center justify-center rounded-full bg-cream text-[13px] font-bold text-ink-2">
                  {n + 1}
                </span>
                <p id={textId} lang="de" className="text-[16px] leading-[1.55] text-ink">
                  {l.text}
                </p>
                <div className="col-start-2">
                  <MatchPicker
                    wide
                    rowId={l.id}
                    choices={pickerChoices(views, matches, l.id, rowOrder, hintFor)}
                    clearLabel={chosen ? ti("matchClear") : null}
                    listLabel={`${n + 1}: ${ti("matchTargets")}`}
                    disabled={disabled}
                    onPick={(targetId) => setRow(l.id, targetId)}
                    triggerId={buttonId}
                    triggerLabelledBy={`${textId} ${buttonId}`}
                    triggerAttrs={{ "data-match-trigger": l.id }}
                    triggerClassName={cn(
                      "flex h-11 w-full max-w-[34rem] items-center gap-3 rounded-[10px] border px-3 text-start text-[15px] transition-colors hover:border-accent disabled:cursor-not-allowed",
                      open ? "border-accent bg-accent-soft text-ink" : chosen ? "border-ink-2 bg-surface text-ink" : "border-line-strong bg-surface text-ink-2",
                    )}
                    triggerChildren={
                      <>
                        {chosen ? (
                          <>
                            <LetterDisc badge={chosen.badge} tone={chosen.disc} />
                            <span lang="de" className="min-w-0 flex-1 truncate font-semibold">
                              {chosen.label}
                            </span>
                          </>
                        ) : (
                          <span className="min-w-0 flex-1">{ti("matchPlaceholder")}</span>
                        )}
                        <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={2.5} />
                      </>
                    }
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
