"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { matchingTargets, type CandidateItem } from "@/lib/exam/safe";
import type { ItemAnswer, TfngValue } from "@/lib/exam/types";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

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
 * True / false / not given. The buttons carry the letters the German
 * instruction uses (R, F, NG). NG is offered in listening too, because the
 * bank's listening items use it; it is worded for a recording there.
 */
function TfngItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  const ti = useT("examItems");
  const uid = useId();
  if (item.content.kind !== "TFNG") return null;
  const values: Array<[TfngValue, string]> = [
    ["R", t("tfR")],
    ["F", t("tfF")],
    ["NG", item.section === "LISTENING" ? ti("tfNgListening") : t("tfNG")],
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
                      tabIndex={on || (!picked && i === 0) ? 0 : -1}
                      disabled={disabled}
                      onKeyDown={radioKeys}
                      onClick={() => onChange({ tfng: { ...(answer.tfng ?? {}), [s.id]: v } })}
                      className={cn(
                        "flex h-10 items-center gap-2 rounded-[8px] border px-3 text-[14px] font-medium",
                        on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 min-w-6 items-center justify-center rounded-[5px] px-1 text-[12px] font-semibold",
                          on ? "bg-accent text-white" : "border border-line-strong text-muted",
                        )}
                      >
                        {v}
                      </span>
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

function GapItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  const ti = useT("examItems");
  const lastFocused = useRef<{ id: string; el: HTMLInputElement } | null>(null);
  if (item.content.kind !== "GAP") return null;
  const gaps = new Map(item.content.gaps.map((g) => [g.id, g]));
  const parts = item.prompt.split(/(\{\{[A-Za-z0-9_-]+\}\})/g);
  const set = (id: string, value: string) => onChange({ gaps: { ...(answer.gaps ?? {}), [id]: value } });
  // Going back to "Seçin" removes the gap's answer instead of storing "".
  const pick = (id: string, value: string) => {
    if (value) return set(id, value);
    const rest = { ...(answer.gaps ?? {}) };
    delete rest[id];
    onChange({ gaps: rest });
  };
  const typed = item.content.gaps.some((g) => !g.choices);
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
  if (item.content.kind !== "MATCHING") return null;
  const targets = matchingTargets(item.content.right);
  const matches = answer.matches ?? {};
  const used = new Set(Object.values(matches).filter(Boolean));
  const setRow = (rowId: string, targetId: string | null) => onChange({ matches: withMatch(matches, rowId, targetId) });
  return (
    <div>
      <Prompt text={item.prompt} />
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
      <p className="mt-4 text-[12.5px] text-muted">{ti("matchHint")}</p>
      <div className="mt-2 flex flex-col gap-2.5">
        {item.content.left.map((l, n) => {
          const chosen = targets.find((r) => r.id === matches[l.id]);
          const rowId = `${uid}-row${n}`;
          return (
            <div key={l.id} className={cn("rounded-[10px] border bg-surface px-4 py-3", chosen ? "border-line-strong" : "border-line")}>
              <p id={rowId} lang="de" className="text-[15px] leading-[1.55] text-ink">
                {l.text}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div role="radiogroup" aria-labelledby={rowId} className="flex flex-wrap gap-1.5">
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
                              ? "border-dashed border-line-strong text-muted opacity-60 hover:opacity-100"
                              : "border-line-strong text-ink-2 hover:border-accent hover:text-ink",
                        )}
                      >
                        {r.badge}
                      </button>
                    );
                  })}
                </div>
                {chosen ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setRow(l.id, null)}
                    className="text-[13px] text-muted underline decoration-underline underline-offset-2 hover:text-ink"
                  >
                    {ti("matchClear")}
                  </button>
                ) : null}
              </div>
              {chosen ? (
                <p lang="de" className="mt-2 text-[14px] leading-[1.5] text-ink-2">
                  <span aria-hidden>→ </span>
                  {chosen.label}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
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
      <Prompt text={item.prompt} id={promptId} />
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
