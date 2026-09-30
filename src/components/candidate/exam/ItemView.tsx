"use client";

import { useRef } from "react";
import type { CandidateItem } from "@/lib/exam/safe";
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
      return Object.keys(a.matches ?? {}).length > 0;
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

function Prompt({ text }: { text: string }) {
  return (
    <p lang="de" className="whitespace-pre-line text-[17px] font-medium leading-[1.6] text-ink">
      {text}
    </p>
  );
}

function ChoiceItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
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
      <Prompt text={item.prompt} />
      <p className="mt-2 text-[12.5px] text-muted">{multiple ? t("pickMany") : t("pickOne")}</p>
      <div role={multiple ? "group" : "radiogroup"} className="mt-4 flex flex-col gap-2">
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

function TfngItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  if (item.content.kind !== "TFNG") return null;
  const values: Array<[TfngValue, string]> = [
    ["R", t("tfR")],
    ["F", t("tfF")],
    ["NG", t("tfNG")],
  ];
  return (
    <div>
      <Prompt text={item.prompt} />
      <div className="mt-4 flex flex-col gap-3">
        {item.content.statements.map((s) => (
          <div key={s.id} className="rounded-[10px] border border-line bg-surface px-4 py-3">
            <p lang="de" className="text-[15px] leading-[1.55] text-ink">
              {s.text}
            </p>
            <div role="radiogroup" className="mt-2.5 flex flex-wrap gap-2">
              {values.map(([v, label]) => {
                const on = answer.tfng?.[s.id] === v;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={disabled}
                    onClick={() => onChange({ tfng: { ...(answer.tfng ?? {}), [s.id]: v } })}
                    className={cn(
                      "h-9 rounded-[8px] border px-3.5 text-[13.5px] font-medium",
                      on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
  const lastFocused = useRef<{ id: string; el: HTMLInputElement } | null>(null);
  if (item.content.kind !== "GAP") return null;
  const gaps = new Map(item.content.gaps.map((g) => [g.id, g]));
  const parts = item.prompt.split(/(\{\{[A-Za-z0-9_-]+\}\})/g);
  const set = (id: string, value: string) => onChange({ gaps: { ...(answer.gaps ?? {}), [id]: value } });
  const typed = item.content.gaps.some((g) => !g.choices);
  return (
    <div>
      <p lang="de" className="whitespace-pre-line text-[17px] font-medium leading-[2.1] text-ink">
        {parts.map((part, i) => {
          const m = part.match(/^\{\{([A-Za-z0-9_-]+)\}\}$/);
          if (!m) return <span key={i}>{part}</span>;
          const gap = gaps.get(m[1]);
          if (!gap) return <span key={i}>____</span>;
          const value = answer.gaps?.[gap.id] ?? "";
          return gap.choices ? (
            <select
              key={i}
              value={value}
              disabled={disabled}
              onChange={(e) => set(gap.id, e.target.value)}
              className="mx-1 h-9 rounded-[8px] border border-line-strong bg-surface px-2 text-[15px] text-ink"
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
              onFocus={(e) => (lastFocused.current = { id: gap.id, el: e.currentTarget })}
              onChange={(e) => set(gap.id, e.target.value)}
              size={Math.max(8, value.length + 2)}
              className="mx-1 h-9 rounded-[8px] border border-line-strong bg-surface px-2 text-[15px] text-ink"
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

function MatchingItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  if (item.content.kind !== "MATCHING") return null;
  const right = item.content.right;
  return (
    <div>
      <Prompt text={item.prompt} />
      <div className="mt-4 flex flex-col gap-2.5">
        {item.content.left.map((l) => (
          <div key={l.id} className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface px-4 py-3 md:flex-row md:items-center md:justify-between">
            <span lang="de" className="text-[15px] text-ink">
              {l.text}
            </span>
            <select
              value={answer.matches?.[l.id] ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ matches: { ...(answer.matches ?? {}), [l.id]: e.target.value } })}
              className="h-10 min-w-[220px] rounded-[8px] border border-line-strong bg-surface px-2 text-[14px] text-ink"
            >
              <option value="">{t("matchingPick")}</option>
              {right.map((r) => (
                <option key={r.id} value={r.id} lang="de">
                  {r.text}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShortTextItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  const ref = useRef<HTMLInputElement | null>(null);
  if (item.content.kind !== "SHORT_TEXT") return null;
  return (
    <div>
      <Prompt text={item.prompt} />
      <input
        ref={ref}
        lang="de"
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
  if (item.content.kind !== "WRITING") return null;
  const words = (answer.text ?? "").trim().split(/\s+/u).filter(Boolean).length;
  const { minWords, maxWords } = item.content;
  return (
    <div>
      <Prompt text={item.prompt} />
      <textarea
        ref={ref}
        lang="de"
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
