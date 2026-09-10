"use client";

import { apiSend, candidateApiBase } from "@/lib/client/api";

/**
 * Records and uploads at the same time.
 *
 * The rule that shapes this file: never hold a whole recording in memory. iOS
 * Safari kills the page on a MediaRecorder run past roughly a minute if the
 * blob is kept around, and the candidate can be on any device. So MediaRecorder
 * runs with a five second timeslice and each chunk leaves as soon as it can.
 *
 * "As soon as it can" differs by storage. Object storage refuses multipart
 * parts under 5 MiB, so chunks are coalesced up to `minPartBytes` and no
 * further, which bounds memory at one part. Local development storage reports
 * `minPartBytes: 0` and every five second chunk goes out on its own.
 */

export type RecorderKind = "video" | "audio";

/** Safari first, because Safari is where the failure mode lives. */
const VIDEO_MIME_ORDER = [
  "video/mp4;codecs=h264",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

const AUDIO_MIME_ORDER = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
];

export function pickRecorderMime(kind: RecorderKind): string {
  if (typeof MediaRecorder === "undefined") return "";
  const order = kind === "audio" ? AUDIO_MIME_ORDER : VIDEO_MIME_ORDER;
  for (const mime of order) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export const CHUNK_MS = 5000;

type PartTarget = { partNumber: number; url: string; proxy: boolean };

type InitResponse = {
  uploadRef: string;
  mime: string;
  minPartBytes: number;
  proxy: boolean;
  partTargets: PartTarget[];
};

export type UploadedPart = { partNumber: number; etag: string; bytes: number };

export type UploaderStatus = {
  uploadedBytes: number;
  queuedBytes: number;
  stalled: boolean;
};

/**
 * Sequential part uploader. Parts must arrive in order for the assembled file
 * to be playable, so there is exactly one in flight at a time; a failure is
 * retried three times before the recording is treated as interrupted.
 */
export class ChunkedUploader {
  private buffer: Blob[] = [];
  private bufferedBytes = 0;
  private nextPartNumber = 1;
  private targets = new Map<number, PartTarget>();
  private queue: Promise<void> = Promise.resolve();
  readonly parts: UploadedPart[] = [];
  private uploadedBytes = 0;
  private failed = false;

  constructor(
    private readonly token: string,
    private readonly init: InitResponse,
    private readonly onStatus?: (status: UploaderStatus) => void,
  ) {
    for (const target of init.partTargets) this.targets.set(target.partNumber, target);
  }

  get uploadRef() {
    return this.init.uploadRef;
  }

  get mime() {
    return this.init.mime;
  }

  get interrupted() {
    return this.failed;
  }

  static async open(
    token: string,
    activityIndex: number,
    mime: string,
    onStatus?: (status: UploaderStatus) => void,
  ) {
    const init = await apiSend<InitResponse>(token, "/media/init", {
      activityIndex,
      mime,
    });
    return new ChunkedUploader(token, init, onStatus);
  }

  /** Called on every MediaRecorder chunk. Returns immediately. */
  push(chunk: Blob) {
    if (chunk.size === 0) return;
    this.buffer.push(chunk);
    this.bufferedBytes += chunk.size;
    this.report();
    if (this.bufferedBytes >= this.init.minPartBytes) this.flush(false);
  }

  private flush(last: boolean) {
    if (this.buffer.length === 0) return;
    if (!last && this.bufferedBytes < this.init.minPartBytes) return;

    const partNumber = this.nextPartNumber++;
    const body = new Blob(this.buffer, { type: this.init.mime });
    this.buffer = [];
    this.bufferedBytes = 0;

    this.queue = this.queue.then(() => this.sendPart(partNumber, body));
  }

  private async targetFor(partNumber: number): Promise<PartTarget> {
    const known = this.targets.get(partNumber);
    if (known) return known;
    const more = await apiSend<{ partTargets: PartTarget[] }>(
      this.token,
      "/media/part-urls",
      { uploadRef: this.init.uploadRef, from: partNumber, count: 24 },
    );
    for (const target of more.partTargets) this.targets.set(target.partNumber, target);
    return (
      this.targets.get(partNumber) ?? { partNumber, url: "", proxy: true }
    );
  }

  private proxyUrl(partNumber: number) {
    return `${candidateApiBase(this.token)}/media/part?ref=${encodeURIComponent(
      this.init.uploadRef,
    )}&part=${partNumber}`;
  }

  private async sendPart(partNumber: number, body: Blob) {
    const target = await this.targetFor(partNumber);
    const url = target.proxy ? this.proxyUrl(partNumber) : target.url;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await fetch(url, { method: "PUT", body });
        if (!res.ok) throw new Error(`part ${partNumber}: ${res.status}`);

        let etag = (res.headers.get("etag") ?? "").replaceAll('"', "");
        if (target.proxy && !etag) {
          const json = (await res.json().catch(() => null)) as
            | { etag?: string }
            | null;
          etag = json?.etag ?? "";
        }

        this.parts.push({ partNumber, etag, bytes: body.size });
        this.uploadedBytes += body.size;
        this.report(false);

        // On the direct-to-bucket path the server never saw these bytes, so it
        // is told which part landed. Otherwise the proxy route already knows.
        if (!target.proxy) {
          await apiSend(this.token, "/media/part-done", {
            uploadRef: this.init.uploadRef,
            partNumber,
            etag,
            bytes: body.size,
          }).catch(() => undefined);
        }
        return;
      } catch {
        this.report(true);
        if (attempt === 3) {
          this.failed = true;
          return;
        }
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }

  private report(stalled = false) {
    this.onStatus?.({
      uploadedBytes: this.uploadedBytes,
      queuedBytes: this.bufferedBytes,
      stalled,
    });
  }

  /** Flushes the tail, waits for the queue, then assembles the object. */
  async finish(activityIndex: number, durationMs: number) {
    this.flush(true);
    await this.queue;
    return apiSend<{ status: string; bytes: number; durationMs: number | null }>(
      this.token,
      "/media/complete",
      {
        uploadRef: this.init.uploadRef,
        activityIndex,
        durationMs,
        incomplete: this.failed,
      },
    );
  }
}
