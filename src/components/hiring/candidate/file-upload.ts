"use client";

import { apiBeacon, apiSend } from "@/lib/client/api";
import { ChunkedUploader, PATIENT_RETRY, type UploaderStatus } from "@/lib/client/recorder";
import type { DraftStorage } from "./draft-store";
import { isRetryable } from "./save-queue";
import { serverMessage } from "./server-message";
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
 * The slices handed to the uploader (fix round 1, I1). Object storage
 * coalesces them until a part reaches its 5 MiB floor, so its parts are three
 * slices (6 MiB) and the last one smaller; local disk takes each slice as a
 * part, so a large file shows progress in steps without one proxied request
 * per quarter megabyte.
 */
export const SLICE_BYTES = 2 * 1024 * 1024;
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
type CompleteBody = { uploadRef: string; durationMs: number; incomplete: boolean };

export type FileUploadDeps = {
  open(onStatus: (status: UploaderStatus) => void): Promise<FileUploaderLike>;
  /** The page is going away: the core completion as a beacon. */
  beacon(body: CompleteBody): void;
  /** The core completion, sent now (a part was given up: the file cannot be whole). */
  complete(body: CompleteBody): Promise<unknown>;
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
  // Fix round 1 (I1): a given-up part means the file can never be whole. Waiting for the
  // finish would wait for every later part's own patient cycle (minutes each), so the
  // first status that shows the uploader interrupted settles the upload at once.
  let opened: FileUploaderLike | null = null;
  // Once given up or settled, the uploader's later tries (it drains in the background) are not this upload's progress any more.
  let quiet = false;
  let markGivenUp: () => void = () => undefined;
  const givenUp = new Promise<"givenUp">((resolve) => (markGivenUp = () => resolve("givenUp")));
  const report = (s: UploaderStatus) => {
    if (quiet) return;
    if (opened?.interrupted) {
      quiet = true;
      markGivenUp();
      return;
    }
    const percent = file.size > 0 ? Math.min(100, Math.floor((s.uploadedBytes / file.size) * 100)) : 0;
    onProgress({ percent, stalled: s.stalled });
  };

  let uploader: FileUploaderLike;
  for (let attempt = 0; ; attempt += 1) {
    try {
      uploader = await deps.open(report);
      opened = uploader;
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
    if (uploader.interrupted) {
      quiet = true;
      markGivenUp();
    }
    const finishing = finishPatiently(() => uploader.finish(0), pause);
    const first = await Promise.race([finishing, givenUp]);
    if (first === "givenUp") {
      // The later finish still runs (its completion answers with the status already set); nothing waits for it.
      finishing.catch(() => undefined);
      // Closed now: the parts still waiting are refused (UPLOAD_CLOSED) and leave the queue
      // at once, and the server keeps the earlier file as the answer.
      await finishPatiently(() => deps.complete({ uploadRef: uploader.uploadRef, durationMs: 0, incomplete: true }), pause).catch(() => undefined);
      return { ok: false, error: notWhole("INCOMPLETE") };
    }
    const done = first;
    return done.status === "READY" ? { ok: true } : { ok: false, error: notWhole(done.status) };
  } catch (error) {
    return { ok: false, error };
  } finally {
    settled = true;
    quiet = true;
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
    complete: (body) => apiSend(token, "/media/complete", body),
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

/** The name of a cut upload, if the tab remembers one. Reading changes nothing (fix round 1, M4). */
export function readCutUpload(storage: DraftStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Forgets the cut upload: the question has a whole file again. */
export function clearCutUpload(storage: DraftStorage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Task 15 N1: a cut note speaks about one upload. A new upload forgets the
 * old note at once (a reload during the new one must not name the old file);
 * if the new upload is cut, `onCut` marks it again with its own name.
 */
export function beginUploadNote(storage: DraftStorage | null, key: string): void {
  clearCutUpload(storage, key);
}

const errCode = (err: unknown) => (err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string" ? (err as { code: string }).code : "");

/** Refusals of the core upload routes (parts, completion, rate limit): the file did not arrive, and another try may work. */
const UPLOAD_ROUTE_CODES = new Set(["NO_PARTS", "UPLOAD_CLOSED", "UPLOAD_NOT_FOUND", "RATE_LIMITED"]);

/**
 * What a file question says when an upload ended without the file (fix round
 * 1, I2): the file's own problem in the question's words; "Dosya
 * yüklenemedi" with a retry for a dropped connection, a cut file or a refusal
 * of the core upload routes (whose own words speak of recordings); any other
 * refusal in the server's words (the candidate's language), with a retry only
 * when another try can change it. `hasTypes`: the question names its types.
 */
export function fileFailure(
  err: unknown,
  hasTypes: boolean,
): { key: "tooBig" | "wrongType" | "empty" | "failed"; retry: boolean } | { server: string; retry: boolean } {
  const code = errCode(err);
  if (code === "FILE_TOO_LARGE") return { key: "tooBig", retry: false };
  if ((code === "FILE_TYPE_REJECTED" || code === "NOT_A_FILE") && hasTypes) return { key: "wrongType", retry: false };
  if (code === "FILE_EMPTY") return { key: "empty", retry: false };
  if (UPLOAD_ROUTE_CODES.has(code)) return { key: "failed", retry: true };
  const said = serverMessage(err);
  if (said === null) return { key: "failed", retry: true };
  return { server: said, retry: isRetryable(err) };
}
