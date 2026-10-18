"use client";

import { useRef } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Disclosure } from "@/components/visual/disclosure";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import type { TfngValue } from "@/lib/exam/types";
import { insertGap, nextId, pickedKindOfDraft, syncGaps, underscoresToMarkers, type EditorDraft } from "./item-editor-model";

export type SetDraft = (patch: Partial<EditorDraft> | ((d: EditorDraft) => Partial<EditorDraft>)) => void;

const FIELD = "h-11 bg-surface text-[15px]";
const LABEL = "mb-1.5 block text-[14px] font-semibold text-ink";
const SMALL = "inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[13.5px] font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:text-muted";
const ICON = "grid size-10 shrink-0 place-items-center rounded-[10px] text-muted hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";
const SEG = "inline-flex min-h-10 cursor-pointer items-center rounded-[10px] border px-3 text-[13.5px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";
const segClass = (on: boolean) => cn(SEG, on ? "border-accent bg-accent-soft font-semibold text-ink" : "border-line bg-surface text-ink-2 hover:bg-canvas");

const MAX_OPTIONS = 8;
const MAX_STATEMENTS = 10;
const MAX_ROWS = 10;
const MAX_TARGETS = 12;

/** The content step's body: the stem and the type's own fields, then the explanation. */
export function ContentFields({
  draft,
  set,
  mode,
  sharedText,
}: {
  draft: EditorDraft;
  set: SetDraft;
  mode: "create" | "edit";
  sharedText: { title: string; body: string } | null;
}) {
  const t = useMT("bankTools");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const gapType = draft.type === "GAP_FILL";

  function setPrompt(prompt: string) {
    set((d) => ({ prompt, ...(gapType ? { gaps: syncGaps(prompt, d.gaps) } : {}) }));
  }
  function addGap() {
    const at = promptRef.current?.selectionStart ?? draft.prompt.length;
    const next = insertGap(draft.prompt, at);
    setPrompt(next.prompt);
    requestAnimationFrame(() => {
      const el = promptRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  }

  return (
    <div className="space-y-7">
      {mode === "create" && draft.section !== "GRAMMAR" ? (
        <div className="space-y-3 rounded-xl border border-line bg-canvas p-4">
          <div>
            <label htmlFor="ed-text-title" className={LABEL}>
              {t("textTitle")}
            </label>
            <Input id="ed-text-title" value={draft.textTitle} maxLength={200} onChange={(e) => set({ textTitle: e.target.value })} className={FIELD} lang="de" />
          </div>
          <div>
            <label htmlFor="ed-text-body" className={LABEL}>
              {draft.section === "LISTENING" ? t("listeningText") : t("readingText")}
            </label>
            <Textarea id="ed-text-body" value={draft.textBody} maxLength={12000} rows={6} onChange={(e) => set({ textBody: e.target.value })} className="bg-surface text-[15px]" lang="de" />
          </div>
        </div>
      ) : null}
      {sharedText ? (
        <div className="rounded-xl border border-line bg-canvas px-4">
          <Disclosure label={<span className="text-[14px]">{t("sharedText", { title: sharedText.title })}</span>} variant="inline">
            <p lang="de" className="whitespace-pre-line text-[14px] leading-[1.6] text-ink-2">
              {sharedText.body}
            </p>
          </Disclosure>
        </div>
      ) : null}

      <div>
        <label htmlFor="ed-prompt" className={LABEL}>
          {t("prompt")}
        </label>
        <Textarea
          id="ed-prompt"
          ref={promptRef}
          value={draft.prompt}
          rows={3}
          maxLength={6000}
          lang="de"
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={() => {
            if (gapType && /_{3,}/.test(draft.prompt)) setPrompt(underscoresToMarkers(draft.prompt));
          }}
          aria-describedby={gapType ? "ed-gap-hint" : undefined}
          className="bg-surface text-[16px]"
        />
        {gapType ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" className={SMALL} onClick={addGap}>
              <Plus className="size-4" aria-hidden />
              {t("addGap")}
            </button>
            <p id="ed-gap-hint" className="text-[13px] text-muted">
              {t("gapHint")}
            </p>
          </div>
        ) : null}
      </div>

      {draft.type === "SINGLE_CHOICE" || draft.type === "MULTI_CHOICE" ? <ChoiceFields draft={draft} set={set} /> : null}
      {draft.type === "TRUE_FALSE_NG" ? <TfngFields draft={draft} set={set} /> : null}
      {draft.type === "GAP_FILL" ? <GapFields draft={draft} set={set} /> : null}
      {draft.type === "MATCHING" ? <MatchingFields draft={draft} set={set} /> : null}
      {draft.type === "SHORT_TEXT" ? (
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div>
            <label htmlFor="ed-accepted" className={LABEL}>
              {t("accepted")}
            </label>
            <Input id="ed-accepted" value={draft.accepted} lang="de" onChange={(e) => set({ accepted: e.target.value })} className={FIELD} />
          </div>
          <NumberField id="ed-maxchars" label={t("maxChars")} value={draft.maxChars} onChange={(maxChars) => set({ maxChars })} />
        </div>
      ) : null}
      {draft.type === "WRITING_PROMPT" || draft.type === "SPEAKING_PROMPT" ? <ProductiveFields draft={draft} set={set} /> : null}

      <div>
        <label htmlFor="ed-explanation" className={LABEL}>
          {t("explanation")}
        </label>
        <Textarea id="ed-explanation" value={draft.explanation} rows={2} maxLength={2000} onChange={(e) => set({ explanation: e.target.value })} className="bg-surface text-[15px]" />
      </div>
    </div>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <Input id={id} inputMode="numeric" value={Number.isFinite(value) ? String(value) : ""} onChange={(e) => onChange(e.target.value.trim() === "" ? Number.NaN : Number(e.target.value))} className={cn(FIELD, "tnum")} />
    </div>
  );
}

function ChoiceFields({ draft, set }: { draft: EditorDraft; set: SetDraft }) {
  const t = useMT("bankTools");
  const single = draft.type === "SINGLE_CHOICE";
  return (
    <fieldset>
      <legend className={LABEL}>{t("options")}</legend>
      <ol className="space-y-2">
        {draft.options.map((o, i) => {
          const letter = String.fromCharCode(65 + i);
          return (
            <li key={o.id} className="flex items-center gap-2">
              <span aria-hidden className="tnum grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">
                {letter}
              </span>
              <Input
                value={o.text}
                lang="de"
                aria-label={t("option", { letter })}
                onChange={(e) => set((d) => ({ options: d.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) }))}
                className={FIELD}
              />
              <label className={segClass(o.correct)}>
                <input
                  type={single ? "radio" : "checkbox"}
                  name="ed-correct"
                  className="sr-only"
                  checked={o.correct}
                  onChange={() =>
                    set((d) => ({
                      options: d.options.map((x) => (single ? { ...x, correct: x.id === o.id } : x.id === o.id ? { ...x, correct: !x.correct } : x)),
                    }))
                  }
                />
                {t("correct")}
              </label>
              <button
                type="button"
                className={ICON}
                disabled={draft.options.length <= 2}
                aria-label={t("removeNamed", { name: t("option", { letter }) })}
                onClick={() => set((d) => ({ options: d.options.filter((x) => x.id !== o.id) }))}
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className={cn(SMALL, "mt-3")}
        disabled={draft.options.length >= MAX_OPTIONS}
        onClick={() => set((d) => ({ options: [...d.options, { id: nextId(d.options.map((x) => x.id), ""), text: "", correct: false }] }))}
      >
        <Plus className="size-4" aria-hidden />
        {t("addOption")}
      </button>
    </fieldset>
  );
}

const TF: TfngValue[] = ["R", "F", "NG"];

function TfngFields({ draft, set }: { draft: EditorDraft; set: SetDraft }) {
  const t = useMT("bankTools");
  return (
    <fieldset>
      <legend className={LABEL}>{t("statements")}</legend>
      <ol className="space-y-4">
        {draft.statements.map((s, i) => {
          const name = t("statement", { n: i + 1 });
          return (
            <li key={s.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span aria-hidden className="tnum w-6 shrink-0 text-right text-[14px] font-semibold text-muted">
                  {i + 1}.
                </span>
                <Input value={s.text} lang="de" aria-label={name} onChange={(e) => set((d) => ({ statements: d.statements.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)) }))} className={FIELD} />
                <button type="button" className={ICON} disabled={draft.statements.length <= 1} aria-label={t("removeNamed", { name })} onClick={() => set((d) => ({ statements: d.statements.filter((x) => x.id !== s.id) }))}>
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2 pl-8">
                {TF.map((v) => (
                  <label key={v} className={segClass(s.answer === v)}>
                    <input type="radio" name={`ed-tf-${s.id}`} className="sr-only" checked={s.answer === v} onChange={() => set((d) => ({ statements: d.statements.map((x) => (x.id === s.id ? { ...x, answer: v } : x)) }))} />
                    {t(`answer${v}`)}
                  </label>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className={cn(SMALL, "mt-3")}
        disabled={draft.statements.length >= MAX_STATEMENTS}
        onClick={() => set((d) => ({ statements: [...d.statements, { id: nextId(d.statements.map((x) => x.id), "s"), text: "", answer: "" }] }))}
      >
        <Plus className="size-4" aria-hidden />
        {t("addStatement")}
      </button>
    </fieldset>
  );
}

function GapFields({ draft, set }: { draft: EditorDraft; set: SetDraft }) {
  const t = useMT("bankTools");
  const gaps = syncGaps(draft.prompt, draft.gaps);
  const patch = (id: string, p: Partial<EditorDraft["gaps"][number]>) => set((d) => ({ gaps: syncGaps(d.prompt, d.gaps).map((g) => (g.id === id ? { ...g, ...p } : g)) }));
  // An MC cloze gap always has choices and a word-bank gap never does: the kind is the item's, so the mode toggle is not offered.
  const kind = pickedKindOfDraft(draft);
  return (
    <fieldset>
      <legend className={LABEL}>{t("gaps")}</legend>
      {kind === "CLOZE" ? <p className="mb-3 text-[13px] text-muted">{t("clozeHint")}</p> : null}
      {gaps.length === 0 ? <p className="text-[14px] text-muted">{t("noGaps")}</p> : null}
      <ol className="space-y-4">
        {gaps.map((g, i) => {
          const name = t("gap", { n: i + 1 });
          return (
            <li key={g.id} className="space-y-2 rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-ink">
                  {name} <span className="font-normal text-muted">{`{{${g.id}}}`}</span>
                </span>
                {kind ? null : (
                  <div role="radiogroup" aria-label={name} className="flex gap-2">
                    {(["typed", "choice"] as const).map((m) => (
                      <label key={m} className={segClass(g.mode === m)}>
                        <input type="radio" name={`ed-gap-${g.id}`} className="sr-only" checked={g.mode === m} onChange={() => patch(g.id, { mode: m })} />
                        {m === "typed" ? t("gapTyped") : t("gapChoice")}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <label className="block text-[13px] text-muted">
                {kind ? t("gapAnswer") : t("gapAccepted")}
                <Input value={g.accepted} lang="de" onChange={(e) => patch(g.id, { accepted: e.target.value })} className={cn(FIELD, "mt-1")} />
              </label>
              {kind === "CLOZE" || (!kind && g.mode === "choice") ? (
                <label className="block text-[13px] text-muted">
                  {t("gapChoices")}
                  <Input value={g.choices} lang="de" onChange={(e) => patch(g.id, kind ? { choices: e.target.value, mode: "choice" } : { choices: e.target.value })} className={cn(FIELD, "mt-1")} />
                </label>
              ) : null}
            </li>
          );
        })}
      </ol>
      {kind === "WORDBANK" ? (
        <div className="mt-4">
          <label htmlFor="ed-distractors" className={LABEL}>
            {t("wordBankDistractors")}
          </label>
          <Input id="ed-distractors" value={draft.distractors} lang="de" aria-describedby="ed-distractors-hint" onChange={(e) => set({ distractors: e.target.value })} className={FIELD} />
          <p id="ed-distractors-hint" className="mt-1.5 text-[13px] text-muted">
            {t("wordBankHint")}
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}

function MatchingFields({ draft, set }: { draft: EditorDraft; set: SetDraft }) {
  const t = useMT("bankTools");
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className={LABEL}>{t("targets")}</legend>
        <p className="mb-2 text-[13px] text-muted">{t("extraTargetHint")}</p>
        <ol className="space-y-2">
          {draft.targets.map((r, i) => {
            const name = t("target", { n: i + 1 });
            return (
              <li key={r.id} className="flex items-center gap-2">
                <span aria-hidden className="tnum grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">
                  {i + 1}
                </span>
                <Input value={r.text} lang="de" aria-label={name} onChange={(e) => set((d) => ({ targets: d.targets.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)) }))} className={FIELD} />
                <button
                  type="button"
                  className={ICON}
                  disabled={draft.targets.length <= 2}
                  aria-label={t("removeNamed", { name })}
                  onClick={() => set((d) => ({ targets: d.targets.filter((x) => x.id !== r.id), rows: d.rows.map((row) => (row.target === r.id ? { ...row, target: "" } : row)) }))}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className={cn(SMALL, "mt-3")} disabled={draft.targets.length >= MAX_TARGETS} onClick={() => set((d) => ({ targets: [...d.targets, { id: nextId([...d.targets.map((x) => x.id), ...d.rows.map((x) => x.id)], "r"), text: "" }] }))}>
          <Plus className="size-4" aria-hidden />
          {t("addTarget")}
        </button>
      </fieldset>

      <fieldset>
        <legend className={LABEL}>{t("rows")}</legend>
        <ol className="space-y-3">
          {draft.rows.map((row, i) => {
            const name = t("row", { n: i + 1 });
            return (
              <li key={row.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto] sm:items-center">
                <Input value={row.text} lang="de" aria-label={name} onChange={(e) => set((d) => ({ rows: d.rows.map((x) => (x.id === row.id ? { ...x, text: e.target.value } : x)) }))} className={FIELD} />
                <select
                  aria-label={`${name}: ${t("pairsWith")}`}
                  value={row.target}
                  onChange={(e) => set((d) => ({ rows: d.rows.map((x) => (x.id === row.id ? { ...x, target: e.target.value } : x)) }))}
                  className="h-11 rounded-lg border border-input bg-surface px-2 text-[14px] text-ink"
                >
                  <option value="">{t("pickTarget")}</option>
                  {draft.targets.map((r, j) => (
                    <option key={r.id} value={r.id}>
                      {`${j + 1}. ${r.text || "..."}`.slice(0, 60)}
                    </option>
                  ))}
                </select>
                <button type="button" className={ICON} disabled={draft.rows.length <= 2} aria-label={t("removeNamed", { name })} onClick={() => set((d) => ({ rows: d.rows.filter((x) => x.id !== row.id) }))}>
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className={cn(SMALL, "mt-3")} disabled={draft.rows.length >= MAX_ROWS} onClick={() => set((d) => ({ rows: [...d.rows, { id: nextId([...d.rows.map((x) => x.id), ...d.targets.map((x) => x.id)], "l"), text: "", target: "" }] }))}>
          <Plus className="size-4" aria-hidden />
          {t("addRow")}
        </button>
      </fieldset>
    </div>
  );
}

function ProductiveFields({ draft, set }: { draft: EditorDraft; set: SetDraft }) {
  const t = useMT("bankTools");
  return (
    <div className="space-y-4">
      {draft.type === "WRITING_PROMPT" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="ed-min" label={t("minWords")} value={draft.minWords} onChange={(minWords) => set({ minWords })} />
          <NumberField id="ed-max" label={t("maxWords")} value={draft.maxWords} onChange={(maxWords) => set({ maxWords })} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ed-think" label={t("thinkSeconds")} value={draft.thinkSeconds} onChange={(thinkSeconds) => set({ thinkSeconds })} />
          <NumberField id="ed-answer" label={t("answerSeconds")} value={draft.answerSeconds} onChange={(answerSeconds) => set({ answerSeconds })} />
          <NumberField id="ed-takes" label={t("maxTakes")} value={draft.maxTakes} onChange={(maxTakes) => set({ maxTakes })} />
        </div>
      )}
      <div>
        <label htmlFor="ed-points" className={LABEL}>
          {t("contentPoints")}
        </label>
        <Textarea id="ed-points" value={draft.contentPoints} rows={4} lang="de" onChange={(e) => set({ contentPoints: e.target.value })} className="bg-surface text-[15px]" />
      </div>
      <div>
        <label htmlFor="ed-register" className={LABEL}>
          {t("register")}
        </label>
        <Input id="ed-register" value={draft.register} lang="de" maxLength={200} onChange={(e) => set({ register: e.target.value })} className={FIELD} />
      </div>
    </div>
  );
}
