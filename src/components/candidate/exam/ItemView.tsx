"use client";

import { useEffect, useId, useRef, useState } from "react";
import { matchingTargets, type CandidateItem } from "@/lib/exam/safe";
import { withPoolInstruction } from "@/lib/exam/ctest-instruction";
import { splitInstruction, splitPromptBlocks, splitTitle, type PromptBlock } from "@/lib/exam/prompt-instruction";
import { coverPointsFor } from "@/lib/exam/task-prompt";
import { tfngChoices } from "@/lib/exam/tfng-labels";
import type { ItemAnswer } from "@/lib/exam/types";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { ABOVE_FOOTER } from "@/components/visual/footer-action";
import { TaskExpectations } from "./TaskExpectations";
import { TaskPromptCard } from "./TaskPromptCard";
import { ClozeItem } from "./ClozeItem";
import { Instruction, radioKeys, TASK_LEFT, TASK_RIGHT, TASK_SPLIT } from "./item-parts";
import { useChipDrag } from "./use-chip-drag";

/**
 * One question, drawn from what the server sent and nothing else. Every
 * renderer is controlled: the answer lives in ExamRunner, which autosaves it
 * and sends it on "save and continue".
 *
 * German content carries `lang="de"` so screen readers and hyphenation use
 * German, and the whole exam is `translate="no"`.
 */

export type ItemProps = {
  item: CandidateItem;
  answer: ItemAnswer;
  onChange: (next: ItemAnswer) => void;
  disabled?: boolean;
  /** Group view: an earlier item already showed this instruction. Honoured by TFNG, CHOICE and MATCHING only. */
  hidePrompt?: boolean;
};

export function hasAnyAnswer(item: CandidateItem, a: ItemAnswer): boolean {
  switch (item.content.kind) {
    case "CHOICE":
      return (a.choiceIds?.length ?? 0) > 0;
    case "TFNG":
      return Object.keys(a.tfng ?? {}).length > 0;
    case "GAP":
      return Object.values(a.gaps ?? {}).some((v) => v.trim());
    case "MATCHING":
      return Object.values(a.matches ?? {}).some(Boolean);
    default:
      return (a.text?.trim().length ?? 0) > 0 || !!a.mediaAssetId;
  }
}

export function ItemView(props: ItemProps) {
  const { item } = props;
  switch (item.content.kind) {
    case "CHOICE":
      return <ChoiceItem {...props} />;
    case "TFNG":
      return <TfngItem {...props} />;
    case "GAP":
      return item.content.cloze ? <ClozeItem {...props} /> : <GapItem {...props} />;
    case "MATCHING":
      return <MatchingItem {...props} />;
    case "SHORT_TEXT":
      return <ShortTextItem {...props} />;
    case "WRITING":
      return <WritingItem {...props} />;
    default:
      return null;
  }
}

/**
 * The one place an item's prompt is drawn. An instruction ("Ergänzen Sie ...",
 * "Lesen Sie ...") gets a short block with a left rule so it reads apart from
 * the question or sentence it belongs to; the question itself is 17px semibold.
 * `whole`: the prompt only says how to answer (true/false, matching).
 */
function Prompt({ text, id, mode = "stem" }: { text: string; id?: string; mode?: "stem" | "whole" }) {
  // A "whole" prompt can hold the question as well ("Welche Anzeige passt?"): that is set as a stem.
  const blocks: PromptBlock[] =
    mode === "whole"
      ? splitPromptBlocks(text)
      : (() => {
          const { instruction, content } = splitInstruction(text, mode);
          return [...(instruction ? [{ kind: "instruction" as const, text: instruction }] : []), ...(content ? [{ kind: "question" as const, text: content }] : [])];
        })();
  return (
    <div id={id} lang="de" className="flex flex-col gap-3">
      {blocks.map((b, i) =>
        b.kind === "instruction" ? (
          <Instruction key={i} text={b.text} />
        ) : (
          <p key={i} className="whitespace-pre-line text-[17px] font-semibold leading-[1.6] text-ink">
            {b.text}
          </p>
        ),
      )}
    </div>
  );
}

/**
 * The next set of ticked options after a click on `id`. With `pick` set, a
 * click on an unticked box does nothing once `pick` boxes are ticked (same
 * array back); unticking always works.
 */
export function toggleTick(picked: readonly string[], id: string, pick?: number): readonly string[] {
  if (picked.includes(id)) return picked.filter((x) => x !== id);
  if (pick !== undefined && picked.length >= pick) return picked;
  return [...picked, id];
}

function ChoiceItem({ item, answer, onChange, disabled, hidePrompt }: ItemProps) {
  const t = useT("exam");
  const promptId = useId();
  const [fullHint, setFullHint] = useState(false);
  const fullTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(fullTimer.current), []);
  if (item.content.kind !== "CHOICE") return null;
  const multiple = item.content.multiple;
  const pick = multiple ? item.content.pick : undefined;
  const picked = new Set(answer.choiceIds ?? []);
  const toggle = (id: string) => {
    if (multiple) {
      const before = answer.choiceIds ?? [];
      const next = toggleTick(before, id, pick);
      if (next === before) {
        // Full: nothing changes, the counter says so for a moment.
        setFullHint(true);
        window.clearTimeout(fullTimer.current);
        fullTimer.current = window.setTimeout(() => setFullHint(false), 1600);
        return;
      }
      onChange({ choiceIds: [...next] });
    } else onChange({ choiceIds: [id] });
  };
  return (
    <div>
      {hidePrompt ? (
        <span id={promptId} lang="de" className="sr-only">
          {item.prompt}
        </span>
      ) : (
        <>
          <Prompt text={item.prompt} id={promptId} />
          {pick !== undefined ? null : <p className="mt-2 text-[12.5px] text-muted">{multiple ? t("pickMany") : t("pickOne")}</p>}
        </>
      )}
      {pick !== undefined ? (
        // German exam instruction plus a live counter; never a red state, "full" only turns the count to ink and semibold.
        <p lang="de" className="mt-2 flex items-baseline gap-3 text-[14px] text-ink-2">
          <span>{`Kreuzen Sie ${pick} Antworten an.`}</span>
          <span aria-live="polite" className={cn("tnum text-[13px]", fullHint ? "font-semibold text-ink" : "text-muted")}>
            {`${picked.size}/${pick}`}
          </span>
        </p>
      ) : null}
      <div role={multiple ? "group" : "radiogroup"} aria-labelledby={promptId} lang="de" className="mt-4 flex flex-col gap-2">
        {item.content.options.map((o, i) => {
          const on = picked.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={on}
              disabled={disabled}
              onClick={() => toggle(o.id)}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-[10px] border bg-surface px-4 py-3 text-start text-[16px] transition-colors",
                on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink hover:border-line-strong",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center text-[12px] font-semibold",
                  multiple ? "rounded-[5px]" : "rounded-full",
                  on ? "bg-accent text-white" : "border border-line-strong text-muted",
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span lang="de">{o.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * True / false / not given. The buttons carry the German words of the
 * instruction ("Richtig", "Falsch", "Nicht im Text", or "Ja", "Nein", "Text
 * sagt dazu nichts" for Ja/Nein items), the exam's language;
 * bare letters confused students (school feedback 2026-10-16).
 */
function TfngItem({ item, answer, onChange, disabled, hidePrompt }: ItemProps) {
  const uid = useId();
  if (item.content.kind !== "TFNG") return null;
  const values = tfngChoices({ twoWay: item.content.twoWay, wording: item.content.wording });
  return (
    <div>
      {hidePrompt ? null : <Prompt text={item.prompt} mode="whole" />}
      <div className={cn("flex flex-col gap-3", hidePrompt ? "mt-1" : "mt-4")}>
        {item.content.statements.map((s, n) => {
          const picked = answer.tfng?.[s.id];
          const textId = `${uid}-s${n}`;
          return (
            <div key={s.id} lang="de" className="rounded-[10px] border border-line bg-surface px-4 py-3">
              <p id={textId} lang="de" className="text-[16px] leading-[1.55] text-ink">
                {s.text}
              </p>
              <div role="radiogroup" aria-labelledby={textId} className="mt-2.5 flex flex-wrap gap-2">
                {values.map(([v, label], i) => {
                  const on = picked === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      lang="de"
                      tabIndex={on || (!picked && i === 0) ? 0 : -1}
                      disabled={disabled}
                      onKeyDown={radioKeys}
                      onClick={() => onChange({ tfng: { ...(answer.tfng ?? {}), [s.id]: v } })}
                      className={cn(
                        "flex h-10 min-w-12 items-center justify-center rounded-[8px] border px-3 text-[14px] font-semibold",
                        on ? "border-accent bg-accent text-white" : "border-line-strong text-ink-2 hover:border-accent hover:text-ink",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const UMLAUTS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"];

/** Inserts a character at the caret of the last focused field. */
function UmlautBar({ onInsert }: { onInsert: (ch: string) => void }) {
  const t = useT("exam");
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-label={t("umlautBar")}>
      {UMLAUTS.map((ch) => (
        <button
          key={ch}
          type="button"
          // Keep focus in the field so the character lands at the caret.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(ch)}
          className="size-8 rounded-[6px] border border-line bg-surface text-[15px] text-ink hover:bg-canvas"
        >
          {ch}
        </button>
      ))}
    </div>
  );
}

function insertAt(el: HTMLInputElement | HTMLTextAreaElement | null, ch: string, current: string) {
  if (!el) return current + ch;
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + ch + current.slice(end);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + ch.length, start + ch.length);
  });
  return next;
}

const NO_ASSIST = {
  spellCheck: false,
  autoCorrect: "off",
  autoCapitalize: "off",
  autoComplete: "off",
  "data-gramm": "false",
  "data-gramm_editor": "false",
  "data-enable-grammarly": "false",
} as const;

/**
 * C-test pool: which pool entry sits in which gap. Rebuilt from the saved
 * strings on every render (the first unused equal entry wins, so duplicates
 * work); a saved string that is in no pool entry, such as an answer typed
 * before the pool existed, stays in its gap as plain text.
 */
export function poolPlacement(pool: string[], gapIds: string[], gaps: Record<string, string> | undefined) {
  const used = new Set<number>();
  const at = new Map<string, number>();
  for (const id of gapIds) {
    const v = gaps?.[id];
    if (!v || !v.trim()) continue;
    const idx = pool.findIndex((p, i) => p === v && !used.has(i));
    if (idx >= 0) {
      used.add(idx);
      at.set(id, idx);
    }
  }
  return { used, at };
}

function GapItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  const ti = useT("examItems");
  const lastFocused = useRef<{ id: string; el: HTMLInputElement } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const { drag, onPointerDown, isDragClick } = useChipDrag<number>({
    dropAt: (x, y) => (document.elementFromPoint(x, y)?.closest("[data-gap-slot]") as HTMLElement | null)?.dataset.gapSlot ?? null,
    onDrop: (idx, gapId) => place(idx, gapId),
    disabled: !!disabled,
  });
  if (item.content.kind !== "GAP") return null;
  // C-test: word parts (attached to the stems); word bank: whole words in slots without stems.
  const pool = item.content.pool ?? null;
  const wordBank = !!pool && !item.content.attached;
  const open = !!item.content.open;
  const placement = pool ? poolPlacement(pool, item.content.gaps.map((g) => g.id), answer.gaps) : null;
  const gaps = new Map(item.content.gaps.map((g) => [g.id, g]));
  // The stored C-test instruction asks to type letters; with the pool the student drags parts instead.
  // A word bank carries its own instruction.
  const prompt = pool && !wordBank ? withPoolInstruction(item.prompt) : item.prompt;
  const { instruction, content: lead } = splitInstruction(prompt, "stem");
  // A word-bank or open text has a German title as its second paragraph: it heads the text, it is not its first line.
  const { title, text: passage } = wordBank || open ? splitTitle(lead) : { title: null, text: lead };
  const parts = passage.split(/(\{\{[A-Za-z0-9_-]+\}\})/g);
  const set = (id: string, value: string) => onChange({ gaps: { ...(answer.gaps ?? {}), [id]: value } });
  // Going back to "Seçin" removes the gap's answer instead of storing "".
  const pick = (id: string, value: string) => {
    if (value) return set(id, value);
    const rest = { ...(answer.gaps ?? {}) };
    delete rest[id];
    onChange({ gaps: rest });
  };
  // Pool mode: a chip lands in a gap by drag or click and goes back by clicking the gap.
  const slotIds = item.content.gaps.filter((g) => !g.choices).map((g) => g.id);
  const filled = (id: string) => !!answer.gaps?.[id]?.trim();
  const place = (idx: number, gapId: string) => {
    if (!pool || disabled) return;
    set(gapId, pool[idx]);
    setSelected(null);
  };
  const clickChip = (idx: number) => {
    const target = selected ?? slotIds.find((id) => !filled(id));
    if (target) place(idx, target);
  };
  const clickSlot = (id: string) => {
    if (disabled) return;
    if (filled(id)) {
      pick(id, "");
      setSelected(null);
    } else setSelected(selected === id ? null : id);
  };
  const slotWidth = `${Math.max(4, ...(pool ?? []).map((c) => c.length)) + (wordBank ? 3 : 2)}ch`;
  const typed = !pool && item.content.gaps.some((g) => !g.choices);
  const attached = !!item.content.attached;
  const marker = (part: string | undefined) => part?.match(/^\{\{([A-Za-z0-9_-]+)\}\}$/) ?? null;
  // "Boşluk 1", "Boşluk 2" in the order the gaps appear in the text.
  const gapNo = new Map(parts.flatMap((p) => marker(p)?.[1] ?? []).map((id, i) => [id, i + 1]));
  const gapLabel = (id: string) => ti("gapLabel", { n: gapNo.get(id) ?? 0 });
  // C-test: the word stem right before a gap is drawn together with its input,
  // so the two read as one word and never break across lines.
  const stemOf = (i: number): string => {
    if (!attached || i === 0 || marker(parts[i - 1])) return "";
    return parts[i - 1].match(/[\p{L}\p{N}]+$/u)?.[0] ?? "";
  };
  return (
    <div>
      {instruction ? (
        <div lang="de" className="mb-4">
          <Instruction text={instruction} />
        </div>
      ) : null}
      {title ? (
        <h3 lang="de" className="mb-2 text-[20px] font-bold leading-[1.3] text-ink">
          {title}
        </h3>
      ) : null}
      {/* A C-test or open passage is long running text, so it stays medium; a single sentence is the question and gets the stem weight. */}
      <p lang="de" className={cn("whitespace-pre-line text-[17px] leading-[2.1] text-ink", attached || open ? "font-medium" : "font-semibold")}>
        {parts.map((part, i) => {
          const m = marker(part);
          if (!m) {
            const nextStem = marker(parts[i + 1]) ? stemOf(i + 1) : "";
            return <span key={i}>{nextStem ? part.slice(0, part.length - nextStem.length) : part}</span>;
          }
          const gap = gaps.get(m[1]);
          if (!gap) return <span key={i}>____</span>;
          const value = answer.gaps?.[gap.id] ?? "";
          if (pool && !gap.choices) {
            const stem = stemOf(i);
            const isSelected = selected === gap.id && !value;
            return (
              <span key={i} className="whitespace-nowrap">
                {stem}
                <button
                  type="button"
                  lang="de"
                  disabled={disabled}
                  aria-label={`${gapLabel(gap.id)}: ${value || ti("gapEmpty")}`}
                  aria-pressed={isSelected}
                  data-gap-slot={gap.id}
                  onClick={() => clickSlot(gap.id)}
                  // Same width for every slot of the item (longest chip), so the size says nothing about the part.
                  style={{ minWidth: slotWidth }}
                  className={cn(
                    "ms-0 me-0.5 inline-flex h-8 items-center rounded-[6px] border align-middle text-[16px] leading-none text-ink",
                    wordBank ? "mx-0.5 justify-center px-2" : "justify-start px-0.5",
                    value ? "border-line-strong bg-surface" : "border-dashed border-line-strong bg-canvas",
                    (isSelected || drag?.over === gap.id) && "border-solid border-accent bg-accent-soft ring-2 ring-accent",
                  )}
                >
                  {value || (wordBank ? <span className="tnum text-[13px] text-muted">{gapNo.get(gap.id)}</span> : null)}
                </button>
              </span>
            );
          }
          if (attached && !gap.choices) {
            const stem = stemOf(i);
            return (
              <span key={i} className="whitespace-nowrap">
                {stem}
                <input
                  value={value}
                  disabled={disabled}
                  aria-label={gapLabel(gap.id)}
                  onFocus={(e) => (lastFocused.current = { id: gap.id, el: e.currentTarget })}
                  onChange={(e) => set(gap.id, e.target.value)}
                  // The missing part is as long as the stem or one letter longer.
                  size={Math.max(stem.length + 1, value.length + 1, 2)}
                  className="ms-0 me-0.5 h-8 rounded-[6px] border border-line-strong bg-surface px-1 text-[16px] text-ink"
                  {...NO_ASSIST}
                />
              </span>
            );
          }
          return gap.choices ? (
            <select
              key={i}
              value={value}
              disabled={disabled}
              aria-label={gapLabel(gap.id)}
              onChange={(e) => pick(gap.id, e.target.value)}
              className="mx-1 h-9 rounded-[8px] border border-line-strong bg-surface px-2 text-[16px] text-ink"
            >
              <option value="">{t("matchingPick")}</option>
              {gap.choices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input
              key={i}
              value={value}
              disabled={disabled}
              aria-label={gapLabel(gap.id)}
              onFocus={(e) => (lastFocused.current = { id: gap.id, el: e.currentTarget })}
              onChange={(e) => set(gap.id, e.target.value)}
              // Open cloze: one width for every gap, so the size says nothing about the word (the key never reaches the browser).
              size={open ? Math.max(10, value.length + 2) : Math.max(8, value.length + 2)}
              className="mx-1 h-9 rounded-[8px] border border-line-strong bg-surface px-2 text-[16px] text-ink"
              {...NO_ASSIST}
            />
          );
        })}
      </p>
      {pool && placement ? (
        // Stays just above the fixed bottom bar (and above a notice over it), so the parts are in reach while the text scrolls.
        // Capped at about a third of the window (scrolls inside), so the text keeps most of the screen.
        <div
          style={{ bottom: ABOVE_FOOTER }}
          className="sticky z-10 mt-4 max-h-[32dvh] overflow-y-auto overscroll-contain border-t border-hairline bg-canvas pb-2 pt-2"
        >
          <div role="group" aria-label={ti(wordBank ? "wordPool" : "ctestPool")}>
            {/* The chips are German, so left to right even on an Arabic page; the group's label stays in the interface language. */}
            <div lang="de" className="flex flex-wrap gap-1.5">
              {pool.map((chip, idx) =>
                placement.used.has(idx) ? null : (
                  <button
                    key={idx}
                    type="button"
                    lang="de"
                    disabled={disabled}
                    onPointerDown={(e) => onPointerDown(e, idx)}
                    onClick={() => {
                      if (!isDragClick()) clickChip(idx);
                    }}
                    className={cn(
                      "h-8 min-w-8 cursor-grab touch-none select-none rounded-[8px] border border-line-strong bg-surface px-2.5 text-[15px] text-ink hover:bg-canvas",
                      wordBank && "h-9 px-3 text-[16px]",
                      drag?.key === idx && "opacity-40",
                    )}
                  >
                    {chip}
                  </button>
                ),
              )}
            </div>
          </div>
          {drag && pool ? (
            <div
              aria-hidden
              lang="de"
              style={{ left: drag.x, top: drag.y }}
              className="pointer-events-none fixed z-50 flex h-9 -translate-x-1/2 -translate-y-1/2 items-center rounded-[8px] border border-accent bg-surface px-3 text-[16px] text-ink shadow-lg"
            >
              {pool[drag.key]}
            </div>
          ) : null}
        </div>
      ) : null}
      {typed ? (
        <UmlautBar
          onInsert={(ch) => {
            const f = lastFocused.current;
            if (!f) return;
            set(f.id, insertAt(f.el, ch, answer.gaps?.[f.id] ?? ""));
          }}
        />
      ) : null}
    </div>
  );
}

/** A matching answer with one row set, or removed when `targetId` is null. Never stores "". */
export function withMatch(matches: Record<string, string> | undefined, rowId: string, targetId: string | null) {
  const next = { ...(matches ?? {}) };
  if (targetId) next[rowId] = targetId;
  else delete next[rowId];
  return next;
}

/** Matching instruction shown above the rows, in the exam's language. */
const MATCH_INSTRUCTION = "Ziehen Sie den passenden Buchstaben in jede Zeile oder klicken Sie ihn an.";

/**
 * Matching: the targets stay in view as a lettered list and every row picks a
 * letter. A target picked in another row is faded but still allowed, because
 * some formats ("Keine Anzeige passt", "beide") fit more than one row. Rows
 * hold the aliased target ids the server sent; a cleared row is removed, never
 * stored as "".
 */
function MatchingItem({ item, answer, onChange, disabled, hidePrompt }: ItemProps) {
  const ti = useT("examItems");
  const uid = useId();
  // Same pointer drag as GapItem. The letter buttons in each row stay the click and keyboard path.
  const { drag, onPointerDown, isDragClick } = useChipDrag<string>({
    dropAt: (x, y) => (document.elementFromPoint(x, y)?.closest("[data-match-drop]") as HTMLElement | null)?.dataset.matchDrop ?? null,
    onDrop: (targetId, rowId) => setRow(rowId, targetId),
    disabled: !!disabled,
  });
  // Row picked by clicking its card; the next tray click lands there, like GapItem's selected slot.
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  if (item.content.kind !== "MATCHING") return null;
  const targets = matchingTargets(item.content.right);
  const rows = item.content.left;
  const matches = answer.matches ?? {};
  const used = new Set(Object.values(matches).filter(Boolean));
  const setRow = (rowId: string, targetId: string | null) => {
    onChange({ matches: withMatch(matches, rowId, targetId) });
    setSelectedRow(null);
  };
  const clickTarget = (targetId: string) => {
    const row = selectedRow ?? rows.find((l) => !matches[l.id])?.id;
    if (row) setRow(row, targetId);
  };
  // "Anzeige A" says nothing the letter does not: the texts are in the reading
  // passage, so the list is left out and only a "0" target is explained.
  const bare = targets.every((r) => r.badge === "0" || /^(?:\p{L}+\s+)?[A-Z]$/u.test(r.label.trim()));
  const zero = targets.find((r) => r.badge === "0");
  const dragged = drag ? targets.find((r) => r.id === drag.key) : undefined;
  return (
    <div>
      {hidePrompt ? null : <Prompt text={item.prompt} mode="whole" />}
      {/* On a page of several items with the same prompt, the drag note is said once too. */}
      {hidePrompt ? null : (
        <p lang="de" className="mt-3 text-[14px] text-ink-2">
          {MATCH_INSTRUCTION}
        </p>
      )}
      {/* Stays under the page header while the rows scroll, so every row can take a drop. */}
      <div aria-hidden data-match-tray lang={bare ? undefined : "de"} dir={bare ? "ltr" : undefined} className="sticky top-14 z-10 -mx-1 mt-3 flex flex-wrap gap-2 bg-canvas px-1 py-2">
        {targets.map((r) => {
          const elsewhere = used.has(r.id);
          return (
            <button
              key={r.id}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              title={r.label}
              onPointerDown={(e) => onPointerDown(e, r.id)}
              onClick={() => {
                if (!isDragClick()) clickTarget(r.id);
              }}
              className={cn(
                "flex min-h-9 max-w-full cursor-grab touch-none select-none items-start gap-2 rounded-[8px] border bg-surface px-2.5 py-1.5 text-start text-[14px] leading-[1.45] text-ink hover:border-accent",
                elsewhere ? "border-dashed border-line-strong opacity-60" : "border-line-strong",
                drag?.key === r.id && "opacity-40",
              )}
            >
              <span className="font-semibold">{r.badge}</span>
              {bare ? null : (
                <span lang="de" className="text-ink-2">
                  {r.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* The tray above already lists every target in full, so no second list. */}
      {bare && zero ? (
        <p lang="de" className="mt-3 text-[14px] text-ink-2">
          0 = {zero.label}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2.5">
        {item.content.left.map((l, n) => {
          const chosen = targets.find((r) => r.id === matches[l.id]);
          const rowId = `${uid}-row${n}`;
          return (
            <div
              key={l.id}
              data-match-row
              data-match-drop={l.id}
              onClick={(e) => {
                // Empty space of the card selects the row; its buttons keep their own clicks.
                if (disabled || (e.target as HTMLElement).closest("button")) return;
                setSelectedRow(selectedRow === l.id ? null : l.id);
              }}
              className={cn(
                "rounded-[10px] border bg-surface px-4 py-3",
                chosen ? "border-line-strong" : "border-line",
                (drag?.over === l.id || selectedRow === l.id) && "ring-2 ring-accent",
              )}
            >
              <p id={rowId} lang="de" className="text-[15px] leading-[1.55] text-ink">
                {l.text}
              </p>
              <div role="radiogroup" aria-labelledby={rowId} lang="de" className="mt-2.5 flex flex-wrap gap-1.5">
                {targets.map((r, i) => {
                  const on = chosen?.id === r.id;
                  const elsewhere = !on && used.has(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${r.badge}: ${r.label}${elsewhere ? `, ${ti("matchUsedElsewhere")}` : ""}`}
                      title={r.label}
                      tabIndex={on || (!chosen && i === 0) ? 0 : -1}
                      disabled={disabled}
                      onKeyDown={radioKeys}
                      onClick={() => setRow(l.id, r.id)}
                      className={cn(
                        "flex h-10 min-w-10 items-center justify-center rounded-[8px] border px-2 text-[14px] font-semibold",
                        on
                          ? "border-accent bg-accent text-white"
                          : elsewhere
                            ? "border-dashed border-line-strong text-muted hover:border-accent hover:text-ink"
                            : "border-line-strong text-ink-2 hover:border-accent hover:text-ink",
                      )}
                    >
                      {r.badge}
                    </button>
                  );
                })}
              </div>
              {/* One line, reserved even when empty, so a pick never moves the rows below. */}
              <div className="mt-2 flex h-6 items-center justify-between gap-3">
                <p lang="de" title={chosen?.label} className="min-w-0 truncate text-[14px] text-ink-2">
                  {chosen && !bare ? (
                    <>
                      <span aria-hidden>→ </span>
                      {chosen.label}
                    </>
                  ) : null}
                </p>
                {chosen ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      // The button goes away with the pick; keep keyboard focus in the row.
                      const first = e.currentTarget.closest("[data-match-row]")?.querySelector<HTMLButtonElement>('[role="radio"]');
                      setRow(l.id, null);
                      window.setTimeout(() => first?.focus(), 0);
                    }}
                    className="shrink-0 text-[13px] text-muted underline decoration-underline underline-offset-2 hover:text-ink"
                  >
                    {ti("matchClear")}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {drag && dragged ? (
        <div
          aria-hidden
          style={{ left: drag.x, top: drag.y }}
          className="pointer-events-none fixed z-50 flex h-9 -translate-x-1/2 -translate-y-1/2 items-center rounded-[8px] border border-accent bg-surface px-3 text-[14px] font-semibold text-ink shadow-lg"
        >
          {dragged.badge}
        </div>
      ) : null}
    </div>
  );
}

function ShortTextItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  const ref = useRef<HTMLInputElement | null>(null);
  const promptId = useId();
  if (item.content.kind !== "SHORT_TEXT") return null;
  return (
    <div>
      <Prompt text={item.prompt} id={promptId} />
      <input
        ref={ref}
        lang="de"
        aria-labelledby={promptId}
        value={answer.text ?? ""}
        maxLength={item.content.maxChars}
        disabled={disabled}
        placeholder={t("shortPlaceholder")}
        onChange={(e) => onChange({ text: e.target.value })}
        className="mt-4 h-12 w-full rounded-[10px] border border-line-strong bg-surface px-4 text-[16px] text-ink"
        {...NO_ASSIST}
      />
      <UmlautBar onInsert={(ch) => onChange({ text: insertAt(ref.current, ch, answer.text ?? "") })} />
    </div>
  );
}

export function WritingItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const promptId = useId();
  const expectId = useId();
  const pointsId = useId();
  if (item.content.kind !== "WRITING") return null;
  const coverShown = coverPointsFor(item.prompt, item.content.studentPoints).length > 0;
  const words = (answer.text ?? "").trim().split(/\s+/u).filter(Boolean).length;
  const { minWords, maxWords } = item.content;
  return (
    <div className={TASK_SPLIT}>
      <div className={TASK_LEFT}>
        <TaskPromptCard text={item.prompt} id={promptId} points={item.content.studentPoints} pointsId={pointsId} />
        <TaskExpectations id={expectId} section="WRITING" minWords={minWords} maxWords={maxWords} />
      </div>
      <div className={TASK_RIGHT}>
      <textarea
        ref={ref}
        lang="de"
        aria-labelledby={promptId}
        aria-describedby={coverShown ? `${pointsId} ${expectId}` : expectId}
        value={answer.text ?? ""}
        disabled={disabled}
        placeholder={t("writingPlaceholder")}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={14}
        className="w-full resize-y rounded-[10px] border border-line-strong bg-surface px-4 py-3 text-[16px] leading-[1.65] text-ink lg:min-h-0 lg:flex-1 lg:resize-none"
        {...NO_ASSIST}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <UmlautBar onInsert={(ch) => onChange({ text: insertAt(ref.current, ch, answer.text ?? "") })} />
        <span className={cn("tnum text-[13px]", words < minWords || words > maxWords ? "text-muted" : "text-ink")}>
          {t("words", { n: words })} · {t("wordsRange", { min: minWords, max: maxWords })}
        </span>
      </div>
      </div>
    </div>
  );
}
