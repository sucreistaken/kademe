"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { ChunkedUploader } from "@/lib/client/recorder";
import type { StageActivity } from "@/lib/candidate-flow";
import {
  ActivityKicker,
  ActivityPrompt,
} from "@/components/candidate/activities/shared";
import { useT } from "@/i18n/candidate-client";

/** Slice size for a file upload. Above the 5 MiB multipart floor either way. */
const SLICE_BYTES = 8 * 1024 * 1024;

export function FileActivity({
  token,
  activity,
  onAnswered,
}: {
  token: string;
  activity: StageActivity;
  onAnswered: (answered: boolean) => void;
}) {
  const t = useT("activity");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploaded, setUploaded] = useState<string[]>(
    activity.payload?.fileAssetIds ?? [],
  );
  const [names, setNames] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accepted = activity.config.acceptedMimeTypes ?? [];
  const maxBytes = activity.config.maxFileBytes ?? 25 * 1024 * 1024;

  async function upload(file: File) {
    if (accepted.length > 0 && !accepted.includes(file.type)) {
      setError(t("fileTypeRejected", { type: file.type || t("fileUnknownType") }));
      return;
    }
    if (file.size > maxBytes) {
      setError(t("fileTooBig", { mb: Math.round(maxBytes / 1024 / 1024) }));
      return;
    }

    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const uploader = await ChunkedUploader.open(
        token,
        activity.index,
        file.type || "application/octet-stream",
        (status) => {
          const total = status.uploadedBytes + status.queuedBytes;
          setProgress(total > 0 ? status.uploadedBytes / file.size : 0);
        },
      );
      for (let offset = 0; offset < file.size; offset += SLICE_BYTES) {
        uploader.push(file.slice(offset, offset + SLICE_BYTES));
      }
      await uploader.finish(activity.index, 0);
      setUploaded((prev) => [...prev, uploader.uploadRef]);
      setNames((prev) => [...prev, file.name]);
      setProgress(1);
      onAnswered(true);
    } catch {
      setError(t("fileFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ActivityKicker>{t("fileKicker")}</ActivityKicker>
      <ActivityPrompt prompt={activity.prompt} note={activity.note} />

      <Card className="mt-6 px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-ink">{t("filePick")}</div>
            <p className="mt-1 text-[13px] leading-[1.55] text-muted">
              {accepted.length > 0
                ? t("fileLimitsTypes", {
                    mb: Math.round(maxBytes / 1024 / 1024),
                    types: accepted.join(", "),
                  })
                : t("fileLimits", { mb: Math.round(maxBytes / 1024 / 1024) })}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept={accepted.join(",") || undefined}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            className="shrink-0 border-ink text-ink"
            disabled={busy}
            disabledReason={t("fileUploadingReason")}
            onClick={() => inputRef.current?.click()}
          >
            {busy
              ? t("fileUploading", { percent: Math.round(progress * 100) })
              : t("filePick")}
          </Button>
        </div>

        {uploaded.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            {uploaded.map((id, i) => (
              <li key={id}>
                <StatusDot tone="done">
                  {t("fileUploaded", { name: names[i] ?? t("fileUploadedFallback") })}
                </StatusDot>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
