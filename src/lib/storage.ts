import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { S3Client } from "@aws-sdk/client-s3";

/**
 * Storage sits behind this interface so that the media pipeline never learns
 * whether it is talking to Cloudflare R2 or to a directory on disk. The shape is
 * deliberately S3 multipart: initUpload / uploadPart / completeUpload, because
 * that is the semantics the candidate recorder needs and the one R2 gives us.
 *
 * LocalStorageProvider is the development implementation and R2StorageProvider
 * the production one. Which one runs is decided by the environment alone, never
 * by code: see `getStorage()` at the bottom of this file and docs/STORAGE.md for
 * what the two implementations genuinely do differently.
 */

export type SignedPartTarget = {
  partNumber: number;
  /** Where the browser PUTs the bytes. */
  url: string;
  /**
   * True when the bytes travel through our own server instead of straight to
   * object storage. Local development is always a proxy; R2 never is.
   */
  proxy: boolean;
};

export type CompletedPart = {
  partNumber: number;
  etag: string;
  bytes: number;
};

/**
 * Thrown when a caller asks for a byte range that does not exist in the object.
 * It is a distinct type because the honest HTTP answer is 416 and not 404: a
 * player that is told "not found" gives up, one that is told "range not
 * satisfiable" asks again for something sane.
 */
export class RangeNotSatisfiableError extends Error {
  constructor(
    readonly key: string,
    readonly totalBytes: number,
  ) {
    super(`range not satisfiable for ${key} (${totalBytes} bytes)`);
    this.name = "RangeNotSatisfiableError";
  }
}

export interface StorageProvider {
  readonly name: string;
  /**
   * Smallest acceptable size for any part except the last one. S3 and R2 both
   * reject parts under 5 MiB, so the recorder coalesces its 5 second chunks up
   * to this number before flushing. Local storage has no such rule and reports
   * 0, which makes every chunk go out the moment it is produced.
   */
  readonly minPartBytes: number;
  /**
   * True when `getSignedUrl()` hands back an absolute URL that a third party
   * can fetch on its own. False for local development, where the URL is a path
   * on this server and means nothing outside the browser that is already here.
   *
   * Anything that passes a signed URL to somebody else (the transcriber is the
   * one caller that does) must branch on this rather than on `name`, so that a
   * third provider added later cannot silently inherit the wrong path.
   */
  readonly publicSignedUrls: boolean;

  initUpload(key: string, mime: string): Promise<{ uploadId: string }>;
  /** Server side part write. Used by the proxy route and by tests. */
  uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Uint8Array,
  ): Promise<CompletedPart>;
  /** Where the browser should PUT part `partNumber`. */
  signPartUrls(
    key: string,
    uploadId: string,
    partNumbers: number[],
  ): Promise<SignedPartTarget[]>;
  completeUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
  ): Promise<{ bytes: number }>;
  abortUpload(key: string, uploadId: string): Promise<void>;
  /**
   * The parts the storage itself believes it is holding for this upload, which
   * is not always what the caller thinks it uploaded. On the direct to bucket
   * path the browser reports each landed part back to us over a separate
   * request, and that request can be lost.
   */
  listParts(key: string, uploadId: string): Promise<CompletedPart[]>;
  /**
   * Salvage: assemble whatever parts survived, without being told what they
   * were. This is the path for a browser that died mid record and never sent
   * its completion. Returns zero parts when there is nothing to salvage.
   */
  salvage(
    key: string,
    uploadId: string,
  ): Promise<{ bytes: number; parts: CompletedPart[] }>;
  /**
   * Short lived read URL. The bucket itself is never public.
   *
   * Absolute for object storage, and a relative path for local development,
   * which is why anything handing this URL to a third party has to check
   * `publicSignedUrls` first.
   */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  /**
   * Reads an object back, optionally a byte range. The range matters: a video
   * element seeks by asking for one, and a server that ignores it hands back
   * the whole file and leaves the player unable to jump.
   *
   * Throws RangeNotSatisfiableError when the requested range starts past the
   * end of the object.
   */
  openStream(
    key: string,
    range?: { start: number; end: number },
  ): Promise<{
    bytes: number;
    totalBytes: number;
    stream: ReadableStream<Uint8Array>;
  }>;
  /**
   * Removes the object. Deleting something that is not there is not an error,
   * because the retention job has to be safe to run twice. Any multipart upload
   * left over for the same key that is old enough to be certainly abandoned is
   * cleaned up too, so that a delete does not leave parts behind that nothing
   * points at and the bucket keeps billing for.
   */
  delete(key: string): Promise<void>;
}

/**
 * SigV4 presigned URLs cannot outlive a week, and a caller asking for more gets
 * an error from the signer rather than a long URL. Clamped in both providers so
 * the two behave the same.
 */
const MAX_SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

/**
 * How old a multipart upload has to be before `delete()` treats it as abandoned
 * rather than in flight. A recording in progress is minutes old; anything older
 * than this is left over from a browser that never came back.
 */
const ORPHAN_UPLOAD_AGE_MS = 60 * 60 * 1000;

function clampTtl(expiresInSeconds: number): number {
  if (!Number.isFinite(expiresInSeconds)) return 60;
  return Math.max(
    1,
    Math.min(Math.floor(expiresInSeconds), MAX_SIGNED_URL_SECONDS),
  );
}

/**
 * Read per call rather than once at import, so a test or a verification script
 * can point storage at a temporary directory after this module has loaded.
 */
function localRoot(): string {
  return process.env.LOCAL_STORAGE_DIR
    ? path.resolve(process.env.LOCAL_STORAGE_DIR)
    : path.resolve(process.cwd(), ".storage");
}

/**
 * The secret behind local playback URLs. Pure so the rule can be tested
 * without mutating NODE_ENV: a fixed development string is fine on a laptop
 * and a forgeable URL to every recording in production, so there it is an
 * error, not a default.
 */
export function resolveSigningSecret(env: {
  AUTH_SECRET?: string;
  NODE_ENV?: string;
}): string {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;
  if (env.NODE_ENV === "production") {
    throw new Error(
      "[storage] AUTH_SECRET is not set. Local storage signs playback URLs with it, and production must not sign them with the development default.",
    );
  }
  return "dev-only-storage-secret";
}

function signingSecret(): string {
  return resolveSigningSecret(process.env);
}

/** Keys are server generated, but never trust one that walked in from a URL. */
export function assertSafeKey(key: string): string {
  if (
    !key ||
    key.startsWith("/") ||
    key.includes("..") ||
    key.includes("\\") ||
    !/^[A-Za-z0-9/._-]+$/.test(key)
  ) {
    throw new Error("unsafe storage key");
  }
  return key;
}

export function signLocalKey(key: string, expiresAtMs: number): string {
  return createHmac("sha256", signingSecret())
    .update(`${key}:${expiresAtMs}`)
    .digest("hex");
}

export function verifyLocalKeySignature(
  key: string,
  expiresAtMs: number,
  signature: string,
): boolean {
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;
  const expected = signLocalKey(key, expiresAtMs);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function emptyStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
}

function byNumber(a: CompletedPart, b: CompletedPart) {
  return a.partNumber - b.partNumber;
}

/**
 * Writes to disk under .storage/. Parts live next to the final object in a
 * `<key>.parts.<uploadId>/` directory until completeUpload concatenates them,
 * which mimics the way an interrupted S3 multipart upload leaves its parts
 * behind.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  readonly minPartBytes = 0;
  readonly publicSignedUrls = false;

  private readonly root: string;

  /** `root` is for tests and scripts. Production reads the environment. */
  constructor(root?: string) {
    this.root = root ? path.resolve(root) : localRoot();
  }

  private objectPath(key: string) {
    return path.join(this.root, assertSafeKey(key));
  }

  private partsDir(key: string, uploadId: string) {
    return path.join(this.root, `${assertSafeKey(key)}.parts.${uploadId}`);
  }

  private partFile(dir: string, partNumber: number) {
    return path.join(dir, `${String(partNumber).padStart(5, "0")}.part`);
  }

  async initUpload(key: string, mime: string) {
    const uploadId = randomUUID().replace(/-/g, "");
    const dir = this.partsDir(key, uploadId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "meta.json"), JSON.stringify({ key, mime }));
    return { uploadId };
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Uint8Array,
  ) {
    const dir = this.partsDir(key, uploadId);
    await mkdir(dir, { recursive: true });
    await writeFile(this.partFile(dir, partNumber), body);
    const etag = createHash("md5").update(body).digest("hex");
    return { partNumber, etag, bytes: body.byteLength };
  }

  async signPartUrls(key: string, uploadId: string, partNumbers: number[]) {
    // Nothing to sign: a local part always goes through the proxy route, which
    // re-derives the key from the candidate token rather than from the URL.
    return partNumbers.map((partNumber) => ({
      partNumber,
      url: "",
      proxy: true,
    }));
  }

  async completeUpload(key: string, uploadId: string, parts: CompletedPart[]) {
    const dir = this.partsDir(key, uploadId);
    const ordered = [...parts].sort(byNumber);
    const chunks: Buffer[] = [];
    for (const part of ordered) {
      const file = this.partFile(dir, part.partNumber);
      try {
        chunks.push(await readFile(file));
      } catch {
        throw new Error(
          `part ${part.partNumber} of ${key} is missing from local storage`,
        );
      }
    }
    const target = this.objectPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    const merged = Buffer.concat(chunks);
    await writeFile(target, merged);
    await rm(dir, { recursive: true, force: true });
    return { bytes: merged.byteLength };
  }

  async listParts(key: string, uploadId: string) {
    const dir = this.partsDir(key, uploadId);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return [];
    }
    const parts: CompletedPart[] = [];
    for (const name of names.filter((n) => n.endsWith(".part"))) {
      const info = await stat(path.join(dir, name));
      parts.push({
        partNumber: Number(name.slice(0, 5)),
        // Local completeUpload concatenates by part number and never looks at
        // an etag, so there is nothing to gain from hashing the file again.
        etag: "",
        bytes: info.size,
      });
    }
    return parts.sort(byNumber);
  }

  /** Salvages whatever parts made it to disk when the browser died mid record. */
  async salvage(key: string, uploadId: string) {
    const parts = await this.listParts(key, uploadId);
    if (parts.length === 0) return { bytes: 0, parts };
    const { bytes } = await this.completeUpload(key, uploadId, parts);
    return { bytes, parts };
  }

  /** @deprecated Use `salvage()`, which every provider implements. */
  async completeFromDisk(key: string, uploadId: string) {
    return this.salvage(key, uploadId);
  }

  async abortUpload(key: string, uploadId: string) {
    await rm(this.partsDir(key, uploadId), { recursive: true, force: true });
  }

  async getSignedUrl(key: string, expiresInSeconds: number) {
    const expires = Date.now() + clampTtl(expiresInSeconds) * 1000;
    const sig = signLocalKey(assertSafeKey(key), expires);
    return `/api/media/local/${key}?expires=${expires}&sig=${sig}`;
  }

  async delete(key: string) {
    await rm(this.objectPath(key), { force: true });
    await this.removeAbandonedParts(key);
  }

  /**
   * An asset deleted while it was still UPLOADING has no object to remove but
   * does have a parts directory, and nothing else would ever come back for it.
   */
  private async removeAbandonedParts(key: string) {
    const target = this.objectPath(key);
    const dir = path.dirname(target);
    const prefix = `${path.basename(target)}.parts.`;
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }
    const cutoff = Date.now() - ORPHAN_UPLOAD_AGE_MS;
    for (const name of names) {
      if (!name.startsWith(prefix)) continue;
      const full = path.join(dir, name);
      try {
        const info = await stat(full);
        if (info.mtimeMs > cutoff) continue;
        await rm(full, { recursive: true, force: true });
      } catch {
        // A directory that vanished under us is the outcome we wanted anyway.
      }
    }
  }

  async openStream(key: string, range?: { start: number; end: number }) {
    const target = this.objectPath(key);
    const info = await stat(target);

    if (info.size === 0) {
      if (range && range.start > 0) {
        throw new RangeNotSatisfiableError(key, 0);
      }
      return { bytes: 0, totalBytes: 0, stream: emptyStream() };
    }

    const start = range ? Math.max(0, Math.floor(range.start)) : 0;
    const end = range
      ? Math.min(info.size - 1, Math.floor(range.end))
      : info.size - 1;
    if (start >= info.size || start > end) {
      throw new RangeNotSatisfiableError(key, info.size);
    }

    return {
      bytes: end - start + 1,
      totalBytes: info.size,
      stream: Readable.toWeb(
        createReadStream(target, { start, end }),
      ) as unknown as ReadableStream<Uint8Array>,
    };
  }
}

/**
 * Cloudflare R2, S3 compatible. Selected as soon as the bucket credentials are
 * present in the environment. The candidate recorder code is identical either
 * way; only `proxy` flips to false so the parts go straight to the bucket.
 */
export class R2StorageProvider implements StorageProvider {
  readonly name = "r2";
  readonly minPartBytes = 5 * 1024 * 1024;
  readonly publicSignedUrls = true;

  private readonly bucket: string;
  /**
   * One client for the life of the provider. Building a new S3Client per call
   * meant a fresh HTTPS agent and connection pool for every signed URL, and the
   * review screen mints one per recording on the page.
   */
  private clientPromise: Promise<S3Client> | null = null;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  private client(): Promise<S3Client> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { S3Client } = await import("@aws-sdk/client-s3");
        return new S3Client({
          region: "auto",
          endpoint: process.env.R2_ENDPOINT,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
          },
        });
      })();
    }
    return this.clientPromise;
  }

  async initUpload(key: string, mime: string) {
    const { CreateMultipartUploadCommand } = await import("@aws-sdk/client-s3");
    const out = await (await this.client()).send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: assertSafeKey(key),
        ContentType: mime,
      }),
    );
    if (!out.UploadId) throw new Error("R2 did not return an upload id");
    return { uploadId: out.UploadId };
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Uint8Array,
  ) {
    const { UploadPartCommand } = await import("@aws-sdk/client-s3");
    const out = await (await this.client()).send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: assertSafeKey(key),
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      }),
    );
    return {
      partNumber,
      etag: (out.ETag ?? "").replaceAll('"', ""),
      bytes: body.byteLength,
    };
  }

  async signPartUrls(key: string, uploadId: string, partNumbers: number[]) {
    const { UploadPartCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.client();
    return Promise.all(
      partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await getSignedUrl(
          client,
          new UploadPartCommand({
            Bucket: this.bucket,
            Key: assertSafeKey(key),
            UploadId: uploadId,
            PartNumber: partNumber,
          }),
          { expiresIn: 3600 },
        ),
        proxy: false,
      })),
    );
  }

  async listParts(key: string, uploadId: string) {
    const { ListPartsCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    const parts: CompletedPart[] = [];
    let marker: string | undefined;
    // ListParts pages at 1000. A long recording has more than that, and a
    // truncated list would assemble a truncated video.
    do {
      const out = await client.send(
        new ListPartsCommand({
          Bucket: this.bucket,
          Key: assertSafeKey(key),
          UploadId: uploadId,
          PartNumberMarker: marker,
        }),
      );
      for (const part of out.Parts ?? []) {
        if (typeof part.PartNumber !== "number") continue;
        parts.push({
          partNumber: part.PartNumber,
          etag: (part.ETag ?? "").replaceAll('"', ""),
          bytes: part.Size ?? 0,
        });
      }
      marker = out.IsTruncated ? out.NextPartNumberMarker : undefined;
    } while (marker);
    return parts.sort(byNumber);
  }

  /**
   * What R2 is actually holding beats what the caller believes it uploaded.
   *
   * Two failures make that difference real, and both of them are silent. The
   * browser PUTs parts straight to the bucket, so it reads the ETag out of a
   * cross origin response and reports it back over a separate request: the ETag
   * is missing whenever the bucket CORS policy does not expose it, and the
   * report is dropped whenever that request fails. Completing with the caller's
   * list would then either be rejected for an empty ETag or quietly assemble a
   * video with a hole in it.
   *
   * If R2 cannot be asked, the caller's list is still better than nothing.
   */
  private async authoritativeParts(
    key: string,
    uploadId: string,
    claimed: CompletedPart[],
  ): Promise<CompletedPart[]> {
    let listed: CompletedPart[] = [];
    try {
      listed = await this.listParts(key, uploadId);
    } catch (error) {
      console.warn(
        `[storage] could not list parts for ${key}, completing with the reported list: ${String(error)}`,
      );
      return [...claimed].sort(byNumber);
    }
    if (listed.length === 0) return [...claimed].sort(byNumber);

    const known = new Set(claimed.map((p) => p.partNumber));
    const extra = listed.filter((p) => !known.has(p.partNumber));
    if (extra.length > 0) {
      console.warn(
        `[storage] ${key} has ${extra.length} part(s) in the bucket that were never reported; including them`,
      );
    }
    return listed;
  }

  async completeUpload(key: string, uploadId: string, parts: CompletedPart[]) {
    const { CompleteMultipartUploadCommand } = await import(
      "@aws-sdk/client-s3"
    );
    const ordered = await this.authoritativeParts(key, uploadId, parts);
    if (ordered.length === 0) {
      throw new Error(`no parts to complete for ${key}`);
    }
    await (await this.client()).send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: assertSafeKey(key),
        UploadId: uploadId,
        MultipartUpload: {
          Parts: ordered.map((p) => ({
            PartNumber: p.partNumber,
            ETag: `"${p.etag}"`,
          })),
        },
      }),
    );
    return { bytes: ordered.reduce((sum, p) => sum + p.bytes, 0) };
  }

  async salvage(key: string, uploadId: string) {
    const parts = await this.listParts(key, uploadId);
    if (parts.length === 0) return { bytes: 0, parts };
    const { bytes } = await this.completeUpload(key, uploadId, parts);
    return { bytes, parts };
  }

  async abortUpload(key: string, uploadId: string) {
    const { AbortMultipartUploadCommand } = await import("@aws-sdk/client-s3");
    await (await this.client()).send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: assertSafeKey(key),
        UploadId: uploadId,
      }),
    );
  }

  async getSignedUrl(key: string, expiresInSeconds: number) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    return getSignedUrl(
      await this.client(),
      new GetObjectCommand({ Bucket: this.bucket, Key: assertSafeKey(key) }),
      { expiresIn: clampTtl(expiresInSeconds) },
    );
  }

  async openStream(key: string, range?: { start: number; end: number }) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const out = await (await this.client()).send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: assertSafeKey(key),
        Range: range ? rangeHeader(range) : undefined,
      }),
    );
    if (!out.Body) throw new Error(`R2 object has no body: ${key}`);
    const bytes = out.ContentLength ?? 0;
    // "bytes 100-199/1234" when a range was served, otherwise the full length.
    const total = Number(out.ContentRange?.split("/")[1]);
    return {
      bytes,
      totalBytes: Number.isFinite(total) && total > 0 ? total : bytes,
      stream: out.Body.transformToWebStream() as ReadableStream<Uint8Array>,
    };
  }

  async delete(key: string) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    // DeleteObject on a key that is not there is a success in S3 semantics, so
    // the retention job can run twice without the second run failing.
    await (await this.client()).send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: assertSafeKey(key) }),
    );
    await this.abortAbandonedUploads(key);
  }

  /**
   * Deleting the object leaves any unfinished multipart upload for the same key
   * in the bucket, invisible to a listing and billed for ever. R2 has no
   * lifecycle rule for that by default, so the delete cleans up after itself.
   *
   * Best effort on purpose: the object is already gone, and a token without
   * ListBucketMultipartUploads must not turn a successful deletion into a
   * failure the retention job has to retry.
   */
  private async abortAbandonedUploads(key: string) {
    try {
      const { ListMultipartUploadsCommand } = await import(
        "@aws-sdk/client-s3"
      );
      const safe = assertSafeKey(key);
      const out = await (await this.client()).send(
        new ListMultipartUploadsCommand({ Bucket: this.bucket, Prefix: safe }),
      );
      const cutoff = Date.now() - ORPHAN_UPLOAD_AGE_MS;
      for (const upload of out.Uploads ?? []) {
        if (upload.Key !== safe || !upload.UploadId) continue;
        // Never touch an upload that could still be a recording in progress.
        if (upload.Initiated && upload.Initiated.getTime() > cutoff) continue;
        await this.abortUpload(safe, upload.UploadId);
      }
    } catch (error) {
      console.warn(
        `[storage] could not clean up multipart uploads for ${key}: ${String(error)}`,
      );
    }
  }
}

const R2_VARS = [
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
  "R2_BUCKET",
] as const;

/**
 * Which of the four R2 variables are set. Exported so a verification script can
 * say precisely what is missing instead of "no credentials".
 */
export function r2ConfigStatus(): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const name of R2_VARS) {
    if (process.env[name]) present.push(name);
    else missing.push(name);
  }
  return { present, missing };
}

/** The environment keys `resolveStorageMode()` reads. Nothing else is looked at. */
export type StorageEnv = Partial<
  Record<
    | (typeof R2_VARS)[number]
    | "NODE_ENV"
    | "STORAGE_REQUIRE_R2"
    | "STORAGE_ALLOW_LOCAL"
    | "AUTH_SECRET",
    string
  >
>;

export type StorageMode =
  | { provider: "r2"; bucket: string }
  | { provider: "local"; warning: string | null }
  | { provider: "refuse"; reason: string };

/**
 * Which provider the environment asks for. Pure, so the rules below are unit
 * tested against plain objects instead of by mutating NODE_ENV in a test.
 *
 * The rules, in order:
 *
 * 1. All four R2 variables set: R2.
 * 2. Production without a complete R2 configuration: refuse to start. Before
 *    this rule a production deploy with no bucket silently wrote every
 *    recording to the container disk, where the next deploy threw them away,
 *    and nothing in the logs said so unless the configuration was partial.
 *    `STORAGE_ALLOW_LOCAL=true` is the operator's explicit opt in ("I know
 *    the recordings live on this disk"), and even then `AUTH_SECRET` has to
 *    be real because local playback URLs are signed with it.
 * 3. `STORAGE_REQUIRE_R2` set anywhere: refuse, same as before. Kept for
 *    development and CI environments that want the production behaviour.
 * 4. Otherwise local disk, with a warning when the R2 configuration is partial
 *    (somebody tried to set it up and mistyped one variable).
 */
export function resolveStorageMode(env: StorageEnv): StorageMode {
  const present: string[] = [];
  const missing: string[] = [];
  for (const name of R2_VARS) {
    if (env[name]) present.push(name);
    else missing.push(name);
  }

  if (missing.length === 0) return { provider: "r2", bucket: env.R2_BUCKET! };

  const partial =
    present.length > 0
      ? `R2 is partly configured (${present.join(", ")}) but ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing`
      : `none of ${R2_VARS.join(", ")} are set`;

  if (env.NODE_ENV === "production") {
    if (env.STORAGE_ALLOW_LOCAL !== "true") {
      return {
        provider: "refuse",
        reason: `[storage] refusing to start in production without object storage: ${partial}. Recordings written to the container disk are lost on the next deploy. Set all four R2 variables, or set STORAGE_ALLOW_LOCAL=true to accept disk storage knowingly.`,
      };
    }
    if (!env.AUTH_SECRET) {
      return {
        provider: "refuse",
        reason:
          "[storage] STORAGE_ALLOW_LOCAL=true in production also needs AUTH_SECRET, because local playback URLs are signed with it and the development default is public.",
      };
    }
    return {
      provider: "local",
      warning: `[storage] STORAGE_ALLOW_LOCAL=true: production is writing recordings to the container disk (${partial}). They do not survive a redeploy.`,
    };
  }

  if (env.STORAGE_REQUIRE_R2) {
    return { provider: "refuse", reason: `[storage] STORAGE_REQUIRE_R2 is set but ${partial}` };
  }

  // A half configured bucket is the dangerous case: it looks like storage was
  // set up, and every recording quietly goes to disk instead.
  return {
    provider: "local",
    warning:
      present.length > 0 ? `[storage] ${partial}, so local disk storage is being used` : null,
  };
}

let cached: StorageProvider | null = null;

/** For tests and scripts that change the environment after this module loaded. */
export function resetStorageCache(): void {
  cached = null;
}

export function getStorage(): StorageProvider {
  if (cached) return cached;
  const mode = resolveStorageMode(process.env);

  if (mode.provider === "refuse") throw new Error(mode.reason);
  if (mode.provider === "r2") {
    cached = new R2StorageProvider(mode.bucket);
    return cached;
  }

  if (mode.warning) console.warn(mode.warning);
  cached = new LocalStorageProvider();
  return cached;
}

/** Storage keys are derived, never chosen by the client. */
export function mediaKey(input: {
  orgId: string;
  assessmentId: string;
  stageRunId: string;
  mediaId: string;
  mime: string;
}): string {
  const ext = mimeExtension(input.mime);
  return `media/${input.orgId}/${input.assessmentId}/${input.stageRunId}/${input.mediaId}.${ext}`;
}

/** Reverse of `mimeExtension`, for serving a stored object back. */
export function extensionMime(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const table: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    txt: "text/plain",
    csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
  };
  return table[ext] ?? "application/octet-stream";
}

export function mimeExtension(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  const table: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    // FILE_UPLOAD documents (DOCUMENT_MIME in candidate-media.ts). Without
    // these a .docx landed under a ".bin" key and was served back as an
    // opaque download with no usable name.
    "text/plain": "txt",
    "text/csv": "csv",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/zip": "zip",
  };
  return table[base] ?? "bin";
}

/**
 * `bytes=100-199`, or `bytes=100-` when the caller does not know where the
 * object ends. Handing S3 a literal Number.MAX_SAFE_INTEGER as the end works by
 * luck rather than by contract, and reads badly in a request log.
 */
function rangeHeader(range: { start: number; end: number }): string {
  const start = Math.max(0, Math.floor(range.start));
  const end = Math.floor(range.end);
  const bounded =
    Number.isFinite(end) && end >= start && end < Number.MAX_SAFE_INTEGER;
  return bounded ? `bytes=${start}-${end}` : `bytes=${start}-`;
}
