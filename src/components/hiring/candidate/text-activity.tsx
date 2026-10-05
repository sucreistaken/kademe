"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { FlushRegistry } from "@/lib/client/flush-registry";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";
import { ActivityHeader } from "./activity-header";
import { useAutosave, type SaveStatus } from "./autosave";
import { clearDraft, draftAfterSaved, draftAfterSend, draftKey, readDraft, restoreText, sessionDrafts, writeDraft, type Draft } from "./draft-store";
import type { LocalAnswer } from "./runner-model";

export type ActivityProps = {
  token: string;
  position: number;
  /** The stage run's identity (its start time): keys the tab's draft copies. */
  run: string;
  activity: CandidateActivity;
  initial: LocalAnswer;
  locale: Locale;
  headingRef: React.Ref<HTMLHeadingElement>;
  flushes: FlushRegistry;
  onChange(answer: LocalAnswer): void;
  disabled: boolean;
  /** The server refused a save (it moved on); the runner says what happened. */
  onRefused?(err: unknown): void;
};

function Saved({ status, savedAt }: { status: SaveStatus; savedAt: number | null }) {
  const t = useT("hiringText");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);
  if (status === "saving") return <span>{t("saving")}</span>;
  if (status === "error") return <span className="text-ink">{t("saveFailed")}</span>;
  if (status === "refused") return <span className="text-ink">{t("saveRefused")}</span>;
  if (status === "saved" && savedAt) {
    const seconds = Math.max(1, Math.round((now - savedAt) / 1000));
    if (seconds < 5) return <span>{t("savedNow")}</span>;
    return <span>{seconds < 60 ? t("savedAgo", { seconds }) : t("savedMinutes", { minutes: Math.floor(seconds / 60) })}</span>;
  }
  return <span>{t("keeps")}</span>;
}

/**
 * HIRING-UX 6.7: a wide field that saves itself, a counter, "Kaydedildi · 4 sn
 * önce". Leaving the field saves at once; the tab keeps its own copy, so a
 * reload that raced the last save still opens on the latest typing. `alternative` is the written answer
 * to a video or audio question (HIRING-UX A7): saved flagged, so the team
 * reads it as the penalty-free alternative.
 */
export function TextActivity({
  token,
  position,
  run,
  activity,
  initial,
  locale,
  headingRef,
  flushes,
  onChange,
  disabled,
  onRefused,
  alternative = false,
  kicker,
}: ActivityProps & { alternative?: boolean; kicker?: string }) {
  const t = useT("hiringText");
  const key = draftKey(token, position, run, activity.id);
  const server = initial.text ?? "";
  // Mounted only in the browser after a click (the intro or the resume gate comes first), so the tab's copy is readable here.
  const [start] = useState(() => restoreText(server, readDraft(sessionDrafts(), key)));
  const [text, setText] = useState(start.text);
  // The tab's copy as it stands: the latest typing, the server text this tab last knew (the copy is
  // restored only over it: Task 13 review) and a text whose save is on its way (fix round 2).
  const copy = useRef<Draft>({ text: start.text, base: server });
  const answerOf = useCallback((value: string): LocalAnswer => (alternative ? { usedTextAlternative: true, text: value } : { text: value }), [alternative]);
  const onSending = useCallback(
    (answer: unknown) => {
      copy.current = draftAfterSend(copy.current, (answer as LocalAnswer).text ?? "");
      writeDraft(sessionDrafts(), key, copy.current);
    },
    [key],
  );
  const onSaved = useCallback(
    (answer: unknown) => {
      const saved = (answer as LocalAnswer).text ?? "";
      const next = draftAfterSaved(copy.current, saved);
      // Nothing left to keep when the server holds what the field shows.
      if (next) writeDraft(sessionDrafts(), key, next);
      else clearDraft(sessionDrafts(), key);
      copy.current = next ?? { text: saved, base: saved };
    },
    [key],
  );
  const { save, flush, status, savedAt } = useAutosave({ token, position, activityId: activity.id, flushes, onRefused, onSaved, onSending });
  const short = activity.type === "SHORT_TEXT";
  const max = activity.maxChars ?? (short ? 300 : 3000);
  const min = activity.minChars ?? 0;
  const format = new Intl.NumberFormat(locale);

  // The tab held newer typing over the text the server still has (a reload raced the last save): save it now.
  // A copy typed over text that changed elsewhere since is dropped; the server's text stands.
  const restored = useRef(start.restored ? answerOf(start.text) : null);
  const dropped = useRef(start.drop);
  useEffect(() => {
    if (dropped.current) {
      dropped.current = false;
      clearDraft(sessionDrafts(), key);
    }
    const answer = restored.current;
    if (!answer) return;
    restored.current = null;
    save(answer, true);
    onChange(answer);
  }, [save, onChange, key]);

  function update(value: string) {
    const next = value.slice(0, max);
    setText(next);
    copy.current = { ...copy.current, text: next };
    writeDraft(sessionDrafts(), key, copy.current);
    const answer = answerOf(next);
    save(answer);
    onChange(answer);
  }

  return (
    <div className="space-y-5">
      <ActivityHeader activity={activity} locale={locale} kicker={kicker ?? (short ? t("short") : t("written"))} headingRef={headingRef} />
      <div className="overflow-hidden rounded-xl border border-input bg-surface focus-within:border-ink/40">
        <Textarea
          aria-labelledby={`prompt-${activity.id}`}
          aria-describedby={min > 0 ? `min-${activity.id}` : undefined}
          value={text}
          onChange={(e) => update(e.target.value)}
          onBlur={() => void flush()}
          disabled={disabled}
          maxLength={max}
          rows={short ? 3 : 10}
          placeholder={t("placeholder")}
          className="min-h-24 resize-y rounded-none border-0 bg-surface px-4 py-3 text-[16px] leading-[26px] md:text-[16px]"
        />
        <div className="flex items-center justify-between gap-4 border-t border-hairline bg-paper px-4 py-2 text-[14px] text-muted">
          <Saved status={status} savedAt={savedAt} />
          <span className="tnum shrink-0">{t("count", { used: format.format(text.length), max: format.format(max) })}</span>
        </div>
      </div>
      {/* Only a failed save is announced; "Kaydedildi" and the counter change too often to be read out. */}
      <p className="sr-only" aria-live="polite">
        {status === "error" ? t("saveFailed") : status === "refused" ? t("saveRefused") : ""}
      </p>
      {min > 0 ? (
        <p id={`min-${activity.id}`} className={text.trim().length < min ? "tnum text-[14px] text-muted" : "sr-only"}>
          {t("minChars", { count: min })}
        </p>
      ) : null}
    </div>
  );
}
