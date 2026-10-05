"use client";

import { apiBeacon } from "@/lib/client/api";
import { ChunkedUploader, PATIENT_RETRY, type UploaderStatus } from "@/lib/client/recorder";
import type { DraftStorage } from "./draft-store";
import { isRetryable } from "./save-queue";
import { finishPatiently } from "./upload-sink";

/**
 * A file answer's upload without React, so the ways it can end are unit
 * tested (ruling 3: a transient failure never loses the file).
 *
 * The file goes through the same path as a take: opened by the hiring init
 * (kind "file": the server checks the type, the size and that the question is
 * running, and keeps the earlier file as the answer until this one is whole),
 * sent in parts by the core uploader with the patient hiring policy, and
 * completed by the core /media/complete, which attaches it (also after the
 * stage closed). The file is never read here: slices are references the
 * browser streams from disk.
 */

/**
 * The slices handed to the uploader. Object storage coalesces them up to its
 * 5 MiB part floor; local disk takes each as a part, so even a 1 MB file shows
 * its progress in steps.
 */
export const SLICE_BYTES = 256 * 1024;
/** Pauses between tries of an init the connection dropped: 1, 2, 4 s. A refusal is not tried again. */
const OPEN_DELAYS_MS = [1000, 2000, 4000];
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The part of ChunkedUploader a file upload uses. */
export type FileUploaderLike = {
  readonly uploadRef: string;
  readonly interrupted: boolean;
  readonly pendingBytes: number;
  push(chunk: Blob): void;
  finish(durationMs: number): Promise<{ status: string; bytes: number }>;
};

export type FileProgress = { percent: number; stalled: boolean };

export type FileUploadDeps = {
  open(onStatus: (status: UploaderStatus) => void): Promise<FileUploaderLike>;
  /** The page is going away: the core completion as a beacon. */
  beacon(body: { uploadRef: string; durationMs: number; incomplete: boolean }): void;
  /** Registers `onHide` for the page going away (pagehide); returns its removal. */
  watchPageHide?(onHide: () => void): () => void;
  /** The page went away with parts still waiting: the screen after a reload says so. */
  onCut?(): void;
  wait?(ms: number): Promise<void>;
};

/** `ok: false`: refused (the server's code on `error`), given up after the tries, or cut short (never attached). */
export type FileOutcome = { ok: true } | { ok: false; error: unknown };

/**
 * A completion that did not come back READY: the file is not the answer
 * (attachMedia keeps the earlier one). No code and no status, so the screen
 * says its own words (serverMessage is null), never this one.
 */
const notWhole = (completion: string) => Object.assign(new Error("incomplete"), { completion });

/** Uploads one file; settles once it is the answer or could not be. Never rejects. */
export async function sendFile(file: Blob, deps: FileUploadDeps, onProgress: (p: FileProgress) => void): Promise<FileOutcome> {
  const pause = deps.wait ?? wait;
  const report = (s: UploaderStatus) => {
    const percent = file.size > 0 ? Math.min(100, Math.floor((s.uploadedBytes / file.size) * 100)) : 0;
    onProgress({ percent, stalled: s.stalled });
  };

  let uploader: FileUploaderLike;
  for (let attempt = 0; ; attempt += 1) {
    try {
      uploader = await deps.open(report);
      break;
    } catch (error) {
      if (!isRetryable(error) || attempt >= OPEN_DELAYS_MS.length) return { ok: false, error };
      await pause(OPEN_DELAYS_MS[attempt]);
    }
  }

  // Like a take (Task 14): from the start until settled, also after the question's screen is gone.
  let settled = false;
  let hidden = false;
  const unwatch = deps.watchPageHide?.(() => {
    if (settled || hidden) return;
    hidden = true;
    // Whole only when every part landed; a cut file is completed INCOMPLETE, so the server keeps the earlier answer.
    const incomplete = uploader.interrupted || uploader.pendingBytes > 0;
    deps.beacon({ uploadRef: uploader.uploadRef, durationMs: 0, incomplete });
    if (incomplete) deps.onCut?.();
  });

  try {
    for (let offset = 0; offset < file.size; offset += SLICE_BYTES) uploader.push(file.slice(offset, offset + SLICE_BYTES));
    const done = await finishPatiently(() => uploader.finish(0), pause);
    return done.status === "READY" ? { ok: true } : { ok: false, error: notWhole(done.status) };
  } catch (error) {
    return { ok: false, error };
  } finally {
    settled = true;
    unwatch?.();
  }
}

/** The production wiring: the hiring init (kind file), the patient part policy, the core completion beacon. */
export function fileUploadDeps(input: {
  token: string;
  stagePosition: number;
  activityId: string;
  name: string;
  bytes: number;
  mime: string;
  onCut?(): void;
}): FileUploadDeps {
  const { token, stagePosition, activityId, name, bytes, mime } = input;
  return {
    open: (onStatus) =>
      ChunkedUploader.open(token, "/hiring/media/init", { stagePosition, activityId, kind: "file", name, bytes }, mime || "application/octet-stream", onStatus, PATIENT_RETRY),
    beacon: (body) => void apiBeacon(token, "/media/complete", body),
    watchPageHide: (onHide) => {
      window.addEventListener("pagehide", onHide);
      return () => window.removeEventListener("pagehide", onHide);
    },
    onCut: input.onCut,
  };
}

/** By link, stage, the stage's run and question, like the text drafts (draft-store draftKey). */
export const cutUploadKey = (token: string, position: number, run: string, activityId: string) => `kademe-hiring-file-cut:${token}:${position}:${run}:${activityId}`;

/** The name of a file whose upload the page cut (the candidate's own name for it, nothing else). */
export function markCutUpload(storage: DraftStorage | null, key: string, name: string): void {
  try {
    storage?.setItem(key, name);
  } catch {
    // Without storage the screen after a reload shows only what the server holds.
  }
}

/** Reads the cut upload's name once and forgets it. */
export function takeCutUpload(storage: DraftStorage | null, key: string): string | null {
  try {
    const name = storage?.getItem(key) ?? null;
    if (name !== null) storage?.removeItem(key);
    return name;
  } catch {
    return null;
  }
}
