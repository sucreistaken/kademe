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

/**
 * Hiring's choice of container: one whose chunks really arrive every
 * timeslice, so the parts leave while the candidate talks. Chrome now records
 * MP4 too, but (seen in Chrome 154 with a synthetic canvas stream) it handed
 * its MP4 data over only at stop: nothing for 21 seconds at a 5 second
 * timeslice, while WebM arrived every 5 seconds. So WebM comes first, except
 * on Apple's engine (Safari, and every browser on iOS), which keeps the
 * exam's MP4-first order, the one its recorder is proven with.
 */
export function pickChunkedRecorderMime(
  kind: RecorderKind,
  vendor: string = typeof navigator === "undefined" ? "" : navigator.vendor,
): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (vendor.startsWith("Apple")) return pickRecorderMime(kind);
  const order = kind === "audio" ? ["audio/webm;codecs=opus", "audio/webm", ...AUDIO_MIME_ORDER] : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", ...VIDEO_MIME_ORDER];
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
  /** Bytes recorded but not uploaded yet: the buffer plus the parts waiting in line. */
  queuedBytes: number;
  /** The last try of a part failed; stays true until a part lands again. */
  stalled: boolean;
};

/**
 * How hard a part is tried before it is given up (and the recording becomes
 * INCOMPLETE). `retryTargets`: a failed lookup of more part addresses is tried
 * again with the part instead of ending the queue. `partTimeoutMs`: a part
 * request that does not answer is aborted and tried again. `stopOnRefusal`: a
 * part the server refuses for good is given up at once.
 */
export type RetryPolicy = {
  attempts: number;
  delayMs(attempt: number): number;
  partTimeoutMs: number | null;
  retryTargets: boolean;
  stopOnRefusal: boolean;
};

/**
 * The exam's policy: three tries, 0.4 s and 0.8 s apart; a failed address
 * lookup is tried again with the part (production hotfix 739f218).
 */
const EXAM_RETRY: RetryPolicy = { attempts: 3, delayMs: (attempt) => 400 * attempt, partTimeoutMs: null, retryTargets: true, stopOnRefusal: false };

/**
 * Hiring's policy (HIRING-UX 6.12, A2): a connection that drops for a while
 * during a take must not cost the take. A part is tried for about two minutes
 * (1, 2, 4, then every 8 s) while the recording goes on and its parts wait in
 * line; a part the server refuses (4xx other than 408/429) is not tried again.
 */
export const PATIENT_RETRY: RetryPolicy = {
  attempts: 16,
  delayMs: (attempt) => Math.min(8000, 1000 * 2 ** (attempt - 1)),
  partTimeoutMs: 60_000,
  retryTargets: true,
  stopOnRefusal: true,
};

/** A refusal that another try cannot change (the upload is closed, the part is too large). */
const refusedForGood = (status: number) => status >= 400 && status < 500 && status !== 408 && status !== 429;

/**
 * Sequential part uploader. Parts must arrive in order for the assembled file
 * to be playable, so there is exactly one in flight at a time; a failure is
 * retried (three times for the exam, PATIENT_RETRY for hiring) before the
 * recording is treated as interrupted.
 */
export class ChunkedUploader {
  private buffer: Blob[] = [];
  private bufferedBytes = 0;
  private nextPartNumber = 1;
  private targets = new Map<number, PartTarget>();
  private queue: Promise<void> = Promise.resolve();
  readonly parts: UploadedPart[] = [];
  private uploadedBytes = 0;
  /** Bytes cut into parts that have not landed (or been given up) yet. */
  private waitingBytes = 0;
  private stalled = false;
  private failed = false;

  constructor(
    private readonly token: string,
    private readonly init: InitResponse,
    private readonly onStatus?: (status: UploaderStatus) => void,
    private readonly retry: RetryPolicy = EXAM_RETRY,
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

  /** Recorded bytes that have not landed yet (buffered, or cut into parts waiting in line). */
  get pendingBytes() {
    return this.bufferedBytes + this.waitingBytes;
  }

  /**
   * Opens the upload through the solution's init endpoint (`initPath`, e.g.
   * "/exam/media/init" or "/hiring/media/init"), which names what the take
   * belongs to from `body` and refuses a tab that is out of date. After this
   * call the upload is addressed by `uploadRef` alone; the parts and the
   * completion are core routes.
   */
  static async open(
    token: string,
    initPath: string,
    body: Record<string, unknown>,
    mime: string,
    onStatus?: (status: UploaderStatus) => void,
    retry?: RetryPolicy,
  ) {
    const init = await apiSend<InitResponse>(token, initPath, { ...body, mime });
    return new ChunkedUploader(token, init, onStatus, retry);
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
    this.waitingBytes += body.size;

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
    // With retryTargets (both policies) the lookup of the part's address
    // (part-urls, after the first batch) is tried with the part: if it threw
    // outside these tries, the queue would skip every later part and the take
    // would never be completed (main 739f218).
    let target = this.retry.retryTargets ? null : await this.targetFor(partNumber);

    for (let attempt = 1; attempt <= this.retry.attempts; attempt += 1) {
      try {
        target ??= await this.targetFor(partNumber);
        const url = target.proxy ? this.proxyUrl(partNumber) : target.url;
        const res = await this.put(url, body);
        if (!res.ok) {
          if (this.retry.stopOnRefusal && refusedForGood(res.status)) {
            // Tried again it would be refused again: what landed is kept, the take is INCOMPLETE.
            this.giveUp(body);
            return;
          }
          throw new Error(`part ${partNumber}: ${res.status}`);
        }

        let etag = (res.headers.get("etag") ?? "").replaceAll('"', "");
        if (target.proxy && !etag) {
          const json = (await res.json().catch(() => null)) as
            | { etag?: string }
            | null;
          etag = json?.etag ?? "";
        }

        this.parts.push({ partNumber, etag, bytes: body.size });
        this.uploadedBytes += body.size;
        this.waitingBytes -= body.size;
        this.stalled = false;
        this.report();

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
        this.stalled = true;
        this.report();
        if (attempt === this.retry.attempts) {
          this.giveUp(body);
          return;
        }
        await new Promise((r) => setTimeout(r, this.retry.delayMs(attempt)));
      }
    }
  }

  /** One part request; under a patient policy one that does not answer is aborted (and tried again). */
  private async put(url: string, body: Blob): Promise<Response> {
    const timeoutMs = this.retry.partTimeoutMs;
    if (timeoutMs === null) return fetch(url, { method: "PUT", body });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { method: "PUT", body, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private giveUp(body: Blob) {
    this.failed = true;
    this.waitingBytes -= body.size;
    this.report();
  }

  private report() {
    this.onStatus?.({
      uploadedBytes: this.uploadedBytes,
      queuedBytes: this.bufferedBytes + this.waitingBytes,
      stalled: this.stalled,
    });
  }

  /** Flushes the tail, waits for the queue, then assembles the object. */
  async finish(durationMs: number) {
    this.flush(true);
    await this.queue;
    return apiSend<{ status: string; bytes: number; durationMs: number | null }>(
      this.token,
      "/media/complete",
      {
        uploadRef: this.init.uploadRef,
        durationMs,
        incomplete: this.failed,
      },
    );
  }
}
