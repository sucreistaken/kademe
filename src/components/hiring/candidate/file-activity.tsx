"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileCheck, FileUp } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { UPLOAD_HOLD_PREFIX, holdCapture, releaseCapture } from "@/lib/client/capture-hold";
import type { FlushRegistry } from "@/lib/client/flush-registry";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import { DEFAULT_MAX_FILE_BYTES } from "@/solutions/hiring/rules/candidate-flow";
import { sessionDrafts } from "./draft-store";
import { ActivityHeader } from "./activity-header";
import { acceptAttr, fileProblem, megabytes, mimeOf, sizeLabel, typeList } from "./file-rules";
import { beginUploadNote, clearCutUpload, cutUploadKey, fileFailure, fileUploadDeps, markCutUpload, readCutUpload, sendFile } from "./file-upload";
import { recoveryFor } from "./runner-steps";
import type { ActivityProps } from "./text-activity";

/** G2: the footer's "Dosya seç" opens this input (it is not in the tab order itself, see FileActivity). */
export const fileInputId = (activityId: string) => `file-input-${activityId}`;

type Uploading = { name: string; percent: number; stalled: boolean };
/** `retry`: the same file, sent again (a dropped connection, a server hiccup); null for a refusal another try cannot change. */
type Problem = { message: string; retry: File | null };

const codeOf = (err: unknown) => (err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string" ? (err as { code: string }).code : "");

/**
 * HIRING-UX 6.9, G2: a drop area, the accepted types and the size written up
 * front as chips, a progress bar, and once a file is there a card with
 * "Değiştir". The filled "Dosya seç" is the runner's footer button (it clicks
 * the input below; `runner-footer.ts` fileFooter). A wrong type, a file over the
 * size or an empty file is refused before anything uploads; the server checks
 * the same again and its refusal is shown in the candidate's language.
 *
 * Replacing: the earlier file stays the answer until the new one is whole
 * (the server attaches a file only once complete and within its size), and
 * the screen says so. The stage's close waits for an upload in flight
 * (`uploads`, bounded like a take); a completion after the close still
 * attaches. Only the candidate's own name and size for the file are shown.
 */
export function FileActivity({
  token,
  position,
  run,
  activity,
  locale,
  headingRef,
  onChange,
  disabled,
  onRefused,
  reasonId,
  existing,
  uploads,
}: ActivityProps & { existing: { name: string; bytes: number } | null; uploads: FlushRegistry }) {
  const t = useT("hiringFile");
  const ids = useId();
  const inputId = fileInputId(activity.id);
  const input = useRef<HTMLInputElement>(null);
  const limitsId = `${ids}-limits`;
  const whyId = `${ids}-why`;
  const cutKey = cutUploadKey(token, position, run, activity.id);
  const [current, setCurrent] = useState(existing);
  const [uploading, setUploading] = useState<Uploading | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  // Mounted only in the browser after a click (the intro or the resume gate comes first), so the tab's note is
  // readable here. Reading changes nothing (M4); the note is forgotten when a file is whole again.
  const [cut, setCut] = useState(() => readCutUpload(sessionDrafts(), cutKey));
  const [over, setOver] = useState(false);
  const inFlight = useRef<Promise<unknown> | null>(null);
  const accepted = activity.acceptedMimeTypes;
  const max = activity.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const types = typeList(accepted, locale);
  const mb = megabytes(max, locale);
  const off = disabled || uploading !== null;
  // The file card replaces the drop zone while a file is whole and nothing uploads; the limits line lives only in the drop zone.
  const showCard = !!current && !uploading;
  const describedBy = [showCard ? null : limitsId, uploading ? whyId : null].filter(Boolean).join(" ") || undefined;

  // The stage's close (next question, finish, time up) waits for an upload in flight; leaving the question does not stop it.
  useEffect(() => uploads.register(`${activity.id}:file`, async () => void (await inFlight.current)), [uploads, activity.id]);

  // M3: a file dropped beside the area must not make the browser open it and leave the assessment.
  useEffect(() => {
    const keep = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", keep);
    window.addEventListener("drop", keep);
    return () => {
      window.removeEventListener("dragover", keep);
      window.removeEventListener("drop", keep);
    };
  }, []);

  /** I2: the file's own problem, "Dosya yüklenemedi" with a retry, or the server's own words (file-upload fileFailure). */
  function refusalMessage(err: unknown, file: File): Problem {
    const failure = fileFailure(err, types !== null);
    const retry = failure.retry ? file : null;
    if ("server" in failure) return { message: failure.server, retry };
    if (failure.key === "tooBig") return { message: t("tooBig", { mb }), retry };
    if (failure.key === "wrongType") return { message: t("wrongType", { types: types ?? "" }), retry };
    if (failure.key === "empty") return { message: t("empty"), retry };
    return { message: t("failed"), retry };
  }

  async function upload(file: File) {
    const mime = mimeOf(file, accepted);
    const found = fileProblem({ type: mime, size: file.size }, accepted, max);
    if (found) {
      setProblem({ message: found === "type" ? t("wrongType", { types: types ?? "" }) : found === "size" ? t("tooBig", { mb }) : t("empty"), retry: null });
      return;
    }
    setProblem(null);
    setCut(null);
    beginUploadNote(sessionDrafts(), cutKey);
    setUploading({ name: file.name, percent: 0, stalled: false });
    onChange({ uploading: true });
    const deps = fileUploadDeps({
      token,
      stagePosition: position,
      activityId: activity.id,
      name: file.name,
      bytes: file.size,
      mime,
      onCut: () => markCutUpload(sessionDrafts(), cutKey, file.name),
    });
    const job = sendFile(file, deps, ({ percent, stalled }) => setUploading({ name: file.name, percent, stalled }));
    inFlight.current = job;
    // The page is held until the upload settles, also after this question is left (the upload goes on
    // and the stage's close waits for it): the frame's language link would cut it (Task 5 fix round 2).
    const hold = `${UPLOAD_HOLD_PREFIX}${ids}`;
    holdCapture(hold);
    let outcome: Awaited<typeof job>;
    try {
      outcome = await job;
    } finally {
      releaseCapture(hold);
    }
    inFlight.current = null;
    setUploading(null);
    if (outcome.ok) {
      const done = { name: file.name, bytes: file.size };
      clearCutUpload(sessionDrafts(), cutKey);
      setCurrent(done);
      onChange({ uploading: false, hasFile: true, file: done });
      return;
    }
    onChange({ uploading: false });
    // This tab is behind the server (the stage closed, the question moved on): the runner says so with "Sayfayı yenile".
    if (recoveryFor(codeOf(outcome.error)) === "reload" && onRefused) {
      onRefused(outcome.error);
      return;
    }
    setProblem(refusalMessage(outcome.error, file));
  }

  const pick = (file: File | undefined) => {
    if (file && !off) void upload(file);
  };

  // Spoken at milestones only (a quarter at a time), never every percent.
  const milestone = uploading ? Math.floor(uploading.percent / 25) * 25 : null;
  const spoken = uploading ? (uploading.stalled ? t("stalled") : t("uploading", { percent: milestone ?? 0 })) : current ? t("uploaded", { name: current.name, size: sizeLabel(current.bytes, locale) }) : "";

  return (
    <div className="space-y-5">
      <ActivityHeader activity={activity} locale={locale} kicker={t("kicker")} icon={FileUp} headingRef={headingRef} />
      {showCard && current ? (
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-card-candidate">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary">
            <FileCheck className="size-5 text-ink" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-medium break-all text-ink">{current.name}</p>
            <p className="tnum text-[14px] text-muted">{t("size", { size: sizeLabel(current.bytes, locale) })}</p>
          </div>
          {/* C5: a real button (the input is out of the tab order; the footer's "Dosya seç" is the keyboard path when there is no file).
              Like the input it is never `disabled` (M1): while off it is aria-disabled and does nothing. */}
          <button
            type="button"
            aria-disabled={off || undefined}
            aria-describedby={off && reasonId ? reasonId : undefined}
            onClick={() => {
              if (!off) input.current?.click();
            }}
            className={cn("inline-flex min-h-11 items-center text-[16px] text-ink underline decoration-underline underline-offset-4", off ? "cursor-not-allowed text-muted" : "cursor-pointer")}
          >
            {t("change")}
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!off) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn("rounded-2xl border border-dashed border-input bg-surface px-card-candidate py-10 text-center", over && "border-ink bg-canvas")}
        >
          <FileUp className="mx-auto size-8 text-muted" strokeWidth={1.5} aria-hidden />
          <p className="mt-3 text-[16px] leading-[26px] text-ink">{t("drop")}</p>
          <p id={limitsId} className="tnum mt-2 flex flex-wrap justify-center gap-2 text-[14px] text-muted">
            {types ? <span className="rounded-full border border-line px-2.5 py-0.5">{types}</span> : null}
            <span className="rounded-full border border-line px-2.5 py-0.5">{t("limitsAny", { mb })}</span>
          </p>
          {uploading ? (
            <DisabledReason id={whyId} className="mt-2 text-[14px]">
              {t("uploadingReason")}
            </DisabledReason>
          ) : null}
        </div>
      )}
      {/* A real file input that the footer's "Dosya seç" and "Değiştir" open with a click. Out of the tab order (C5: two
          stops for one action would be noise), named for a screen reader, and never `disabled` (M1: that would drop the
          keyboard focus when an upload starts): while off it is aria-disabled, its picker does not open and a change is ignored. */}
      <input
        ref={input}
        id={inputId}
        type="file"
        tabIndex={-1}
        className="sr-only"
        accept={acceptAttr(accepted)}
        aria-label={t("chooseFromComputer")}
        aria-disabled={off || undefined}
        aria-describedby={describedBy}
        onClick={(e) => {
          if (off) e.preventDefault();
        }}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {uploading ? (
        <div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploading.percent} aria-label={uploading.name} className="h-1 rounded-full bg-hairline">
            <div className="h-1 rounded-full bg-ink-3 transition-[width] duration-300" style={{ width: `${uploading.percent}%` }} />
          </div>
          <p className="tnum mt-2 text-[14px] text-muted">
            <span className="text-ink">{uploading.name}</span> · {t("uploading", { percent: uploading.percent })}
          </p>
          {uploading.stalled ? <p className="mt-1 text-[14px] text-ink">{t("stalled")}</p> : null}
          {current ? <p className="mt-1 text-[14px] text-muted">{t("keepsPrevious", { name: current.name })}</p> : null}
        </div>
      ) : null}

      {cut && !uploading ? <p className="text-[16px] leading-[26px] text-ink">{t("cut", { name: cut })}</p> : null}

      {problem ? (
        <div role="alert" className="space-y-3">
          <p className="text-[16px] leading-[26px] text-ink">
            {problem.message}
            {current ? <> {t("keptPrevious", { name: current.name })}</> : null}
          </p>
          {/* Hidden while the runner holds the inputs (sending, time up): it says why itself. */}
          {problem.retry && !off ? (
            <Button className="min-h-11 text-[16px]" onClick={() => problem.retry && void upload(problem.retry)}>
              {t("retry")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {spoken}
      </p>
    </div>
  );
}
