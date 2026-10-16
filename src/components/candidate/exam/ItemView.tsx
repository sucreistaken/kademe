"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { matchingTargets, type CandidateItem } from "@/lib/exam/safe";
import type { ItemAnswer, TfngValue } from "@/lib/exam/types";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { TaskPromptCard } from "./TaskPromptCard";

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
      return <GapItem {...props} />;
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

function Prompt({ text, id }: { text: string; id?: string }) {
  return (
    <p id={id} lang="de" className="whitespace-pre-line text-[17px] font-medium leading-[1.6] text-ink">
      {text}
    </p>
  );
}

/**
 * Arrow keys, Home and End move through one radio group and pick, the way
 * native radio buttons do. Only the picked radio (or the first) is a tab stop.
 */
function radioKeys(e: KeyboardEvent<HTMLButtonElement>) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key] ?? 0;
  if (!step && e.key !== "Home" && e.key !== "End") return;
  const group = e.currentTarget.closest('[role="radiogroup"]');
  const radios = [...(group?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') ?? [])];
  const at = radios.indexOf(e.currentTarget);
  if (at < 0) return;
  e.preventDefault();
  const next =
    e.key === "Home" ? radios[0] : e.key === "End" ? radios[radios.length - 1] : radios[(at + step + radios.length) % radios.length];
  next.focus();
  next.click();
}

function ChoiceItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  const promptId = useId();
  if (item.content.kind !== "CHOICE") return null;
  const multiple = item.content.multiple;
  const picked = new Set(answer.choiceIds ?? []);
  const toggle = (id: string) => {
    if (multiple) {
      const next = new Set(picked);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange({ choiceIds: [...next] });
    } else onChange({ choiceIds: [id] });
  };
  return (
    <div>
      <Prompt text={item.prompt} id={promptId} />
      <p className="mt-2 text-[12.5px] text-muted">{multiple ? t("pickMany") : t("pickOne")}</p>
      <div role={multiple ? "group" : "radiogroup"} aria-labelledby={promptId} className="mt-4 flex flex-col gap-2">
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
                "flex min-h-12 w-full items-center gap-3 rounded-[10px] border bg-surface px-4 py-3 text-left text-[15px] transition-colors",
                on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong",
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
 * instruction ("Richtig", "Falsch", "Nicht im Text"), the exam's language;
 * bare letters confused students (school feedback 2026-10-16).
 */
function TfngItem({ item, answer, onChange, disabled }: ItemProps) {
  const uid = useId();
  if (item.content.kind !== "TFNG") return null;
  const values: Array<[TfngValue, string]> = [
    ["R", "Richtig"],
    ["F", "Falsch"],
    ["NG", "Nicht im Text"],
  ];
  return (
    <div>
      <Prompt text={item.prompt} />
      <div className="mt-4 flex flex-col gap-3">
        {item.content.statements.map((s, n) => {
          const picked = answer.tfng?.[s.id];
          const textId = `${uid}-s${n}`;
          return (
            <div key={s.id} className="rounded-[10px] border border-line bg-surface px-4 py-3">
              <p id={textId} lang="de" className="text-[15px] leading-[1.55] text-ink">
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

/** C-test instruction shown with the word-part pool, in the exam's language. */
const POOL_INSTRUCTION =
  "Ergänzen Sie die fehlenden Wortteile. Ziehen Sie die passenden Teile in die Lücken oder klicken Sie sie an. Einige Teile bleiben übrig.";

function GapItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  const ti = useT("examItems");
  const lastFocused = useRef<{ id: string; el: HTMLInputElement } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Pointer drag rather than HTML5 drag and drop: it also works with touch,
  // trackpads and pen, and a press without movement stays a click.
  const press = useRef<{ idx: number; x: number; y: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  const [drag, setDrag] = useState<{ idx: number; x: number; y: number; over: string | null } | null>(null);
  if (item.content.kind !== "GAP") return null;
  const pool = item.content.attached ? (item.content.pool ?? null) : null;
  const placement = pool ? poolPlacement(pool, item.content.gaps.map((g) => g.id), answer.gaps) : null;
  const gaps = new Map(item.content.gaps.map((g) => [g.id, g]));
  // The stored instruction asks to type letters; with the pool the student drags parts instead.
  const prompt = pool ? `${POOL_INSTRUCTION}\n\n${item.prompt.replace(/^[\s\S]*?\n\n/, "")}` : item.prompt;
  const parts = prompt.split(/(\{\{[A-Za-z0-9_-]+\}\})/g);
  const slotAt = (x: number, y: number) =>
    (document.elementFromPoint(x, y)?.closest("[data-gap-slot]") as HTMLElement | null)?.dataset.gapSlot ?? null;
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
      <p lang="de" className="whitespace-pre-line text-[17px] font-medium leading-[2.1] text-ink">
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
                  aria-label={`${gapLabel(gap.id)}: ${value || ti("ctestEmpty")}`}
                  aria-pressed={isSelected}
                  data-gap-slot={gap.id}
                  onClick={() => clickSlot(gap.id)}
                  // The missing part is as long as the stem or one letter longer.
                  style={{ minWidth: `${Math.max(stem.length + 1, 2)}ch` }}
                  className={cn(
                    "ml-0 mr-0.5 inline-block h-8 rounded-[6px] border px-1 align-baseline text-[16px] leading-[1.9] text-ink",
                    value ? "border-line-strong bg-surface" : "border-dashed border-line-strong bg-canvas",
                    (isSelected || drag?.over === gap.id) && "border-solid border-accent bg-accent-soft ring-2 ring-accent",
                  )}
                >
                  {value}
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
                  className="ml-0 mr-0.5 h-8 rounded-[6px] border border-line-strong bg-surface px-1 text-[16px] text-ink"
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
              size={Math.max(8, value.length + 2)}
              className="mx-1 h-9 rounded-[8px] border border-line-strong bg-surface px-2 text-[16px] text-ink"
              {...NO_ASSIST}
            />
          );
        })}
      </p>
      {pool && placement ? (
        // Stays just above the fixed bottom bar, so the parts are in reach while the text scrolls.
        <div
          style={{ bottom: "var(--step-footer-space, 112px)" }}
          className="sticky z-10 mt-4 border-t border-hairline bg-canvas pb-3 pt-3"
        >
          <p className="text-[14px] text-ink-2">{ti("ctestHint")}</p>
          <div role="group" aria-label={ti("ctestPool")} className="mt-2 flex flex-wrap gap-2">
            {pool.map((chip, idx) =>
              placement.used.has(idx) ? null : (
                <button
                  key={idx}
                  type="button"
                  lang="de"
                  disabled={disabled}
                  onPointerDown={(e) => {
                    if (disabled || e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    press.current = { idx, x: e.clientX, y: e.clientY, moved: false };
                  }}
                  onPointerMove={(e) => {
                    const p = press.current;
                    if (!p || p.idx !== idx) return;
                    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
                    p.moved = true;
                    setDrag({ idx, x: e.clientX, y: e.clientY, over: slotAt(e.clientX, e.clientY) });
                  }}
                  onPointerUp={(e) => {
                    const p = press.current;
                    press.current = null;
                    setDrag(null);
                    if (!p?.moved) return;
                    swallowClick.current = true;
                    const target = slotAt(e.clientX, e.clientY);
                    if (target) place(idx, target);
                  }}
                  onPointerCancel={() => {
                    press.current = null;
                    setDrag(null);
                  }}
                  onClick={() => {
                    if (swallowClick.current) {
                      swallowClick.current = false;
                      return;
                    }
                    clickChip(idx);
                  }}
                  className={cn(
                    "h-9 min-w-9 cursor-grab touch-none select-none rounded-[8px] border border-line-strong bg-surface px-3 text-[16px] text-ink hover:bg-canvas",
                    drag?.idx === idx && "opacity-40",
                  )}
                >
                  {chip}
                </button>
              ),
            )}
          </div>
          {drag && pool ? (
            <div
              aria-hidden
              lang="de"
              style={{ left: drag.x, top: drag.y }}
              className="pointer-events-none fixed z-50 flex h-9 -translate-x-1/2 -translate-y-1/2 items-center rounded-[8px] border border-accent bg-surface px-3 text-[16px] text-ink shadow-lg"
            >
              {pool[drag.idx]}
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
function MatchingItem({ item, answer, onChange, disabled }: ItemProps) {
  const ti = useT("examItems");
  const uid = useId();
  // Same pointer drag as GapItem. The letter buttons in each row stay the click and keyboard path.
  const press = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; over: string | null } | null>(null);
  if (item.content.kind !== "MATCHING") return null;
  const targets = matchingTargets(item.content.right);
  const matches = answer.matches ?? {};
  const used = new Set(Object.values(matches).filter(Boolean));
  const setRow = (rowId: string, targetId: string | null) => onChange({ matches: withMatch(matches, rowId, targetId) });
  // "Anzeige A" says nothing the letter does not: the texts are in the reading
  // passage, so the list is left out and only a "0" target is explained.
  const bare = targets.every((r) => r.badge === "0" || /^(?:\p{L}+\s+)?[A-Z]$/u.test(r.label.trim()));
  const zero = targets.find((r) => r.badge === "0");
  const rowAt = (x: number, y: number) =>
    (document.elementFromPoint(x, y)?.closest("[data-match-drop]") as HTMLElement | null)?.dataset.matchDrop ?? null;
  const dragged = drag ? targets.find((r) => r.id === drag.id) : undefined;
  return (
    <div>
      <Prompt text={item.prompt} />
      <p lang="de" className="mt-3 text-[14px] text-ink-2">
        {MATCH_INSTRUCTION}
      </p>
      <div aria-hidden data-match-tray className="mt-3 flex flex-wrap gap-2">
        {targets.map((r) => {
          const elsewhere = used.has(r.id);
          return (
            <button
              key={r.id}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              title={r.label}
              onPointerDown={(e) => {
                if (disabled || e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                press.current = { id: r.id, x: e.clientX, y: e.clientY, moved: false };
              }}
              onPointerMove={(e) => {
                const p = press.current;
                if (!p || p.id !== r.id) return;
                if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
                p.moved = true;
                setDrag({ id: r.id, x: e.clientX, y: e.clientY, over: rowAt(e.clientX, e.clientY) });
              }}
              onPointerUp={(e) => {
                const p = press.current;
                press.current = null;
                setDrag(null);
                if (!p?.moved) return;
                swallowClick.current = true;
                const rowId = rowAt(e.clientX, e.clientY);
                if (rowId) setRow(rowId, r.id);
              }}
              onPointerCancel={() => {
                press.current = null;
                setDrag(null);
              }}
              onClick={() => {
                // Only a drag acts here; clicking is what the letters in each row are for.
                swallowClick.current = false;
              }}
              className={cn(
                "flex h-9 max-w-full cursor-grab touch-none select-none items-center gap-2 rounded-[8px] border bg-surface px-2.5 text-[14px] text-ink hover:border-accent",
                elsewhere ? "border-dashed border-line-strong opacity-60" : "border-line-strong",
                drag?.id === r.id && "opacity-40",
              )}
            >
              <span className="font-semibold">{r.badge}</span>
              {bare ? null : (
                <span lang="de" className="max-w-[16rem] truncate text-ink-2">
                  {r.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {bare ? (
        zero ? (
          <p lang="de" className="mt-3 text-[14px] text-ink-2">
            0 = {zero.label}
          </p>
        ) : null
      ) : (
        <section aria-labelledby={`${uid}-targets`} className="mt-4 rounded-[12px] border border-line bg-canvas px-4 py-3">
          <h3 id={`${uid}-targets`} className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">
            {ti("matchTargets")}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {targets.map((r) => {
              const isUsed = used.has(r.id);
              return (
                <li key={r.id} className={cn("flex items-start gap-3", isUsed && "opacity-60")}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-[13px] font-semibold text-ink">
                    {r.badge}
                  </span>
                  <span lang="de" className="pt-0.5 text-[15px] leading-[1.5] text-ink">
                    {r.label}
                  </span>
                  {isUsed ? <span className="ml-auto shrink-0 pt-1 text-[12px] text-muted">✓ {ti("matchUsed")}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="mt-4 flex flex-col gap-2.5">
        {item.content.left.map((l, n) => {
          const chosen = targets.find((r) => r.id === matches[l.id]);
          const rowId = `${uid}-row${n}`;
          return (
            <div
              key={l.id}
              data-match-row
              data-match-drop={l.id}
              className={cn(
                "rounded-[10px] border bg-surface px-4 py-3",
                chosen ? "border-line-strong" : "border-line",
                drag?.over === l.id && "ring-2 ring-accent",
              )}
            >
              <p id={rowId} lang="de" className="text-[15px] leading-[1.55] text-ink">
                {l.text}
              </p>
              <div role="radiogroup" aria-labelledby={rowId} className="mt-2.5 flex flex-wrap gap-1.5">
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
  if (item.content.kind !== "WRITING") return null;
  const words = (answer.text ?? "").trim().split(/\s+/u).filter(Boolean).length;
  const { minWords, maxWords } = item.content;
  return (
    <div>
      <TaskPromptCard text={item.prompt} id={promptId} />
      <textarea
        ref={ref}
        lang="de"
        aria-labelledby={promptId}
        value={answer.text ?? ""}
        disabled={disabled}
        placeholder={t("writingPlaceholder")}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={14}
        className="mt-4 w-full resize-y rounded-[10px] border border-line-strong bg-surface px-4 py-3 text-[16px] leading-[1.65] text-ink"
        {...NO_ASSIST}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <UmlautBar onInsert={(ch) => onChange({ text: insertAt(ref.current, ch, answer.text ?? "") })} />
        <span className={cn("tnum text-[13px]", words < minWords || words > maxWords ? "text-muted" : "text-ink")}>
          {t("words", { n: words })} · {t("wordsRange", { min: minWords, max: maxWords })}
        </span>
      </div>
    </div>
  );
}
