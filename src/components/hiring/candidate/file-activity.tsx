"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button, buttonVariants, DisabledReason } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import type { FlushRegistry } from "@/lib/client/flush-registry";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import { DEFAULT_MAX_FILE_BYTES } from "@/solutions/hiring/rules/candidate-flow";
import { sessionDrafts } from "./draft-store";
import { ActivityHeader } from "./activity-header";
import { acceptAttr, fileProblem, megabytes, mimeOf, sizeLabel, typeList } from "./file-rules";
import { clearCutUpload, cutUploadKey, fileFailure, fileUploadDeps, markCutUpload, readCutUpload, sendFile } from "./file-upload";
import { recoveryFor } from "./runner-steps";
import type { ActivityProps } from "./text-activity";

type Uploading = { name: string; percent: number; stalled: boolean };
/** `retry`: the same file, sent again (a dropped connection, a server hiccup); null for a refusal another try cannot change. */
type Problem = { message: string; retry: File | null };

const codeOf = (err: unknown) => (err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string" ? (err as { code: string }).code : "");

/**
 * HIRING-UX 6.9: a drop area and "Dosya seç", the accepted types and the size
 * written up front, a progress bar, "Değiştir". A wrong type, a file over the
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
  existing,
  uploads,
}: ActivityProps & { existing: { name: string; bytes: number } | null; uploads: FlushRegistry }) {
  const t = useT("hiringFile");
  const ids = useId();
  const inputId = `${ids}-file`;
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
    const outcome = await job;
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
      <ActivityHeader activity={activity} locale={locale} kicker={t("kicker")} headingRef={headingRef} />
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
        className={cn("rounded-2xl border border-dashed border-input bg-surface p-card-candidate text-center", over && "border-ink bg-canvas")}
      >
        <FileUp className="mx-auto size-6 text-muted" strokeWidth={1.5} aria-hidden />
        <p className="mt-2 text-[16px] leading-[26px] text-ink-2">{t("drop")}</p>
        <p id={limitsId} className="tnum mt-1 text-[14px] text-muted">
          {types ? t("limits", { types, mb }) : t("limitsAny", { mb })}
        </p>
        {/* A real file input, reachable with the keyboard; its visible label is the button-shaped text.
            M1: never `disabled` (that would drop the keyboard focus when an upload starts): while off it is
            aria-disabled, its picker does not open and a change is ignored. */}
        <input
          id={inputId}
          type="file"
          className="peer sr-only"
          accept={acceptAttr(accepted)}
          aria-disabled={off || undefined}
          aria-describedby={[limitsId, uploading ? whyId : null].filter(Boolean).join(" ")}
          onClick={(e) => {
            if (off) e.preventDefault();
          }}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <label
          htmlFor={inputId}
          aria-disabled={off || undefined}
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "mt-4 min-h-11 cursor-pointer text-[16px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
            off && "cursor-not-allowed text-muted hover:bg-surface",
          )}
        >
          {current ? t("change") : t("choose")}
        </label>
        {uploading ? (
          <DisabledReason id={whyId} className="mt-2 text-[14px]">
            {t("uploadingReason")}
          </DisabledReason>
        ) : null}
      </div>

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

      {current && !uploading ? (
        <p>
          <StatusDot tone="done" className="text-[16px] text-ink">
            <span className="tnum break-all">{t("uploaded", { name: current.name, size: sizeLabel(current.bytes, locale) })}</span>
          </StatusDot>
        </p>
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
