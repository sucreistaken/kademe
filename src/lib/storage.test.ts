import { mkdtemp, readdir, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LocalStorageProvider,
  RangeNotSatisfiableError,
  assertSafeKey,
  extensionMime,
  getStorage,
  mediaKey,
  mimeExtension,
  r2ConfigStatus,
  resetStorageCache,
  resolveSigningSecret,
  resolveStorageMode,
  signLocalKey,
  verifyLocalKeySignature,
} from "@/lib/storage";

/**
 * Everything here runs against LocalStorageProvider in a temporary directory.
 * The R2 implementation cannot be tested without a bucket, and faking one would
 * produce a green suite that proves nothing about the path that actually runs
 * in production. scripts/verify-r2.ts is where that is exercised, and it
 * refuses to report success without credentials.
 */

const roots: string[] = [];

async function freshRoot() {
  const dir = await mkdtemp(path.join(tmpdir(), "kademe-storage-"));
  roots.push(dir);
  return dir;
}

afterAll(async () => {
  for (const dir of roots) await rm(dir, { recursive: true, force: true });
});

const KEY = "media/org-1/assess-1/run-1/asset-1.webm";

function bytes(size: number, seed: number): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) out[i] = (i * 31 + seed) % 256;
  return out;
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("assertSafeKey", () => {
  it("accepts a key the server derived itself", () => {
    expect(assertSafeKey(KEY)).toBe(KEY);
  });

  it.each([
    ["", "empty"],
    ["/etc/passwd", "absolute"],
    ["media/../../etc/passwd", "traversal"],
    ["media\\org\\a.webm", "backslash"],
    ["media/org/a b.webm", "space"],
    ["media/org/a?x=1.webm", "query string"],
    ["media/org/ü.webm", "non ascii"],
  ])("rejects %s (%s)", (key) => {
    expect(() => assertSafeKey(key)).toThrow("unsafe storage key");
  });
});

describe("key and mime derivation", () => {
  it("derives a key from ids the server owns, never from the client", () => {
    const key = mediaKey({
      orgId: "org-1",
      assessmentId: "assess-1",
      stageRunId: "run-1",
      mediaId: "asset-1",
      mime: "video/webm;codecs=vp9",
    });
    expect(key).toBe(KEY);
    expect(() => assertSafeKey(key)).not.toThrow();
  });

  it("round trips the containers the recorder can produce", () => {
    for (const mime of [
      "video/mp4",
      "video/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "application/pdf",
    ]) {
      expect(extensionMime(`x.${mimeExtension(mime)}`)).toBe(mime);
    }
  });

  it("gives FILE_UPLOAD documents a real extension, not .bin", () => {
    // Every mime in DOCUMENT_MIME (src/lib/candidate-media.ts) has to map to a
    // named extension and back, so a CV lands as ".docx" and is served with
    // its own type instead of as an opaque download.
    const expected: Array<[string, string]> = [
      ["application/pdf", "pdf"],
      ["image/png", "png"],
      ["image/jpeg", "jpg"],
      ["image/webp", "webp"],
      ["image/gif", "gif"],
      ["text/plain", "txt"],
      ["text/csv", "csv"],
      ["application/msword", "doc"],
      ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
      ["application/vnd.ms-excel", "xls"],
      ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
      ["application/vnd.ms-powerpoint", "ppt"],
      ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
      ["application/zip", "zip"],
    ];
    for (const [mime, ext] of expected) {
      expect(mimeExtension(mime)).toBe(ext);
      expect(extensionMime(`media/o/a/r/id.${ext}`)).toBe(mime);
    }
    // A charset parameter, as browsers send for text uploads, does not matter.
    expect(mimeExtension("text/plain; charset=utf-8")).toBe("txt");
  });

  it("falls back rather than inventing a type", () => {
    expect(mimeExtension("application/x-nonsense")).toBe("bin");
    expect(extensionMime("x.bin")).toBe("application/octet-stream");
  });
});

describe("local signed url signatures", () => {
  it("accepts a signature it just made", () => {
    const expires = Date.now() + 60_000;
    expect(verifyLocalKeySignature(KEY, expires, signLocalKey(KEY, expires))).toBe(
      true,
    );
  });

  it("refuses an expired one", () => {
    const expires = Date.now() - 1;
    expect(verifyLocalKeySignature(KEY, expires, signLocalKey(KEY, expires))).toBe(
      false,
    );
  });

  it("refuses a signature made for a different key", () => {
    const expires = Date.now() + 60_000;
    const other = "media/org-1/assess-1/run-1/asset-2.webm";
    expect(verifyLocalKeySignature(KEY, expires, signLocalKey(other, expires))).toBe(
      false,
    );
  });

  it("refuses a signature of the wrong length without throwing", () => {
    const expires = Date.now() + 60_000;
    expect(verifyLocalKeySignature(KEY, expires, "short")).toBe(false);
    expect(verifyLocalKeySignature(KEY, Number.NaN, "")).toBe(false);
  });
});

describe("LocalStorageProvider multipart lifecycle", () => {
  let root: string;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    root = await freshRoot();
    storage = new LocalStorageProvider(root);
  });

  it("reports the contract the recorder branches on", () => {
    expect(storage.name).toBe("local");
    expect(storage.minPartBytes).toBe(0);
    expect(storage.publicSignedUrls).toBe(false);
  });

  it("assembles parts in part number order, not arrival order", async () => {
    const { uploadId } = await storage.initUpload(KEY, "video/webm");
    const first = bytes(1024, 1);
    const second = bytes(512, 2);

    const p2 = await storage.uploadPart(KEY, uploadId, 2, second);
    const p1 = await storage.uploadPart(KEY, uploadId, 1, first);
    expect(p1.bytes).toBe(1024);
    expect(p2.bytes).toBe(512);

    const { bytes: total } = await storage.completeUpload(KEY, uploadId, [p2, p1]);
    expect(total).toBe(1536);

    const { stream, totalBytes } = await storage.openStream(KEY);
    expect(totalBytes).toBe(1536);
    const read = await collect(stream);
    expect(Array.from(read.slice(0, 1024))).toEqual(Array.from(first));
    expect(Array.from(read.slice(1024))).toEqual(Array.from(second));
  });

  it("serves an exact byte range, which is how a player seeks", async () => {
    const { uploadId } = await storage.initUpload(KEY, "video/webm");
    const body = bytes(4096, 7);
    const part = await storage.uploadPart(KEY, uploadId, 1, body);
    await storage.completeUpload(KEY, uploadId, [part]);

    const ranged = await storage.openStream(KEY, { start: 100, end: 199 });
    expect(ranged.bytes).toBe(100);
    expect(ranged.totalBytes).toBe(4096);
    expect(Array.from(await collect(ranged.stream))).toEqual(
      Array.from(body.slice(100, 200)),
    );
  });

  it("clamps an open ended range to the end of the object", async () => {
    const { uploadId } = await storage.initUpload(KEY, "video/webm");
    const body = bytes(2048, 3);
    const part = await storage.uploadPart(KEY, uploadId, 1, body);
    await storage.completeUpload(KEY, uploadId, [part]);

    const open = await storage.openStream(KEY, {
      start: 2000,
      end: Number.MAX_SAFE_INTEGER,
    });
    expect(open.bytes).toBe(48);
    expect(open.totalBytes).toBe(2048);
    expect(Array.from(await collect(open.stream))).toEqual(
      Array.from(body.slice(2000)),
    );
  });

  it("refuses a range that starts past the end of the object", async () => {
    const { uploadId } = await storage.initUpload(KEY, "video/webm");
    const part = await storage.uploadPart(KEY, uploadId, 1, bytes(64, 1));
    await storage.completeUpload(KEY, uploadId, [part]);

    await expect(
      storage.openStream(KEY, { start: 64, end: 128 }),
    ).rejects.toBeInstanceOf(RangeNotSatisfiableError);
  });

  it("mints a relative url the media route can verify", async () => {
    const url = await storage.getSignedUrl(KEY, 300);
    expect(url.startsWith("/api/media/local/")).toBe(true);
    const parsed = new URL(url, "http://localhost:3100");
    const expires = Number(parsed.searchParams.get("expires"));
    expect(
      verifyLocalKeySignature(KEY, expires, parsed.searchParams.get("sig") ?? ""),
    ).toBe(true);
    expect(expires).toBeGreaterThan(Date.now());
    expect(expires).toBeLessThanOrEqual(Date.now() + 300_000);
  });

  it("deletes the object and answers a second delete without throwing", async () => {
    const { uploadId } = await storage.initUpload(KEY, "video/webm");
    const part = await storage.uploadPart(KEY, uploadId, 1, bytes(32, 5));
    await storage.completeUpload(KEY, uploadId, [part]);

    await storage.delete(KEY);
    await expect(storage.openStream(KEY)).rejects.toThrow();
    await expect(storage.delete(KEY)).resolves.toBeUndefined();
  });

  it("reports what is on disk and salvages it after a browser died", async () => {
    const { uploadId } = await storage.initUpload(KEY, "video/webm");
    await storage.uploadPart(KEY, uploadId, 1, bytes(300, 1));
    await storage.uploadPart(KEY, uploadId, 2, bytes(200, 2));
    // No completeUpload: this is the recording that never came back.

    const listed = await storage.listParts(KEY, uploadId);
    expect(listed.map((p) => p.partNumber)).toEqual([1, 2]);
    expect(listed.map((p) => p.bytes)).toEqual([300, 200]);

    const salvaged = await storage.salvage(KEY, uploadId);
    expect(salvaged.bytes).toBe(500);
    expect(salvaged.parts).toHaveLength(2);
    expect((await storage.openStream(KEY)).totalBytes).toBe(500);
  });

  it("salvages nothing when there is nothing, rather than failing", async () => {
    const salvaged = await storage.salvage(KEY, "no-such-upload");
    expect(salvaged).toEqual({ bytes: 0, parts: [] });
  });

  it("refuses to assemble a part that is not on disk", async () => {
    const { uploadId } = await storage.initUpload(KEY, "video/webm");
    const part = await storage.uploadPart(KEY, uploadId, 1, bytes(16, 1));
    await expect(
      storage.completeUpload(KEY, uploadId, [
        part,
        { partNumber: 2, etag: "", bytes: 16 },
      ]),
    ).rejects.toThrow(/part 2 .* is missing/);
  });

  it("deleting sweeps up an abandoned upload but leaves a fresh one alone", async () => {
    const stale = await storage.initUpload(KEY, "video/webm");
    await storage.uploadPart(KEY, stale.uploadId, 1, bytes(16, 1));
    const fresh = await storage.initUpload(KEY, "video/webm");
    await storage.uploadPart(KEY, fresh.uploadId, 1, bytes(16, 2));

    const dir = path.dirname(path.join(root, KEY));
    const staleDir = path.join(dir, `asset-1.webm.parts.${stale.uploadId}`);
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await utimes(staleDir, old, old);

    await storage.delete(KEY);

    const left = (await readdir(dir)).filter((n) => n.includes(".parts."));
    expect(left).toEqual([`asset-1.webm.parts.${fresh.uploadId}`]);
    await expect(stat(staleDir)).rejects.toThrow();
  });

  it("abortUpload throws away the parts", async () => {
    const { uploadId } = await storage.initUpload(KEY, "video/webm");
    await storage.uploadPart(KEY, uploadId, 1, bytes(16, 1));
    await storage.abortUpload(KEY, uploadId);
    expect(await storage.listParts(KEY, uploadId)).toEqual([]);
  });

  it("reads LOCAL_STORAGE_DIR at construction, so a script can redirect it", async () => {
    const other = await freshRoot();
    const previous = process.env.LOCAL_STORAGE_DIR;
    process.env.LOCAL_STORAGE_DIR = other;
    try {
      const redirected = new LocalStorageProvider();
      const { uploadId } = await redirected.initUpload(KEY, "video/webm");
      const part = await redirected.uploadPart(KEY, uploadId, 1, bytes(8, 1));
      await redirected.completeUpload(KEY, uploadId, [part]);
      await expect(stat(path.join(other, KEY))).resolves.toBeTruthy();
    } finally {
      if (previous === undefined) delete process.env.LOCAL_STORAGE_DIR;
      else process.env.LOCAL_STORAGE_DIR = previous;
    }
  });
});

describe("provider selection", () => {
  const saved = { ...process.env };

  afterEach(() => {
    for (const name of [
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_ENDPOINT",
      "R2_BUCKET",
      "STORAGE_REQUIRE_R2",
      "STORAGE_ALLOW_LOCAL",
    ]) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    resetStorageCache();
  });

  function setR2(partial = false) {
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_BUCKET = "kademe-media-test";
    if (partial) delete process.env.R2_ENDPOINT;
    else process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
  }

  it("names the variables that are missing", () => {
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_ENDPOINT;
    process.env.R2_BUCKET = "kademe-media-test";
    expect(r2ConfigStatus()).toEqual({
      present: ["R2_BUCKET"],
      missing: ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT"],
    });
  });

  it("chooses R2 when all four are set, and says its urls are public", () => {
    setR2();
    resetStorageCache();
    const storage = getStorage();
    expect(storage.name).toBe("r2");
    expect(storage.minPartBytes).toBe(5 * 1024 * 1024);
    expect(storage.publicSignedUrls).toBe(true);
  });

  it("falls back to local when a variable is missing", () => {
    setR2(true);
    resetStorageCache();
    expect(getStorage().name).toBe("local");
  });

  it("refuses to fall back silently when STORAGE_REQUIRE_R2 is set", () => {
    setR2(true);
    process.env.STORAGE_REQUIRE_R2 = "1";
    resetStorageCache();
    expect(() => getStorage()).toThrow(/R2_ENDPOINT/);
  });

  it("caches the provider until it is reset", () => {
    resetStorageCache();
    const first = getStorage();
    expect(getStorage()).toBe(first);
    resetStorageCache();
    expect(getStorage()).not.toBe(first);
  });
});

describe("the production storage rule, as a pure decision", () => {
  // resolveStorageMode is tested on plain objects so that no test has to
  // mutate NODE_ENV, which vitest and Next both read.
  const r2 = {
    R2_ACCESS_KEY_ID: "k",
    R2_SECRET_ACCESS_KEY: "s",
    R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
    R2_BUCKET: "kademe-media",
  };

  it("chooses R2 whenever all four variables are set, in any environment", () => {
    expect(resolveStorageMode({ ...r2, NODE_ENV: "production" })).toEqual({
      provider: "r2",
      bucket: "kademe-media",
    });
    expect(resolveStorageMode({ ...r2, NODE_ENV: "development" })).toMatchObject({
      provider: "r2",
    });
  });

  it("refuses to start in production with no R2 configuration at all", () => {
    // The bug this guards: production with no bucket used to fall back to the
    // container disk without a word, and every recording died on redeploy.
    const mode = resolveStorageMode({ NODE_ENV: "production", AUTH_SECRET: "x" });
    expect(mode.provider).toBe("refuse");
    if (mode.provider === "refuse") {
      expect(mode.reason).toMatch(/production/);
      expect(mode.reason).toMatch(/STORAGE_ALLOW_LOCAL/);
    }
  });

  it("refuses to start in production with a partial R2 configuration, naming the gap", () => {
    const { R2_ENDPOINT: _dropped, ...partial } = r2;
    void _dropped;
    const mode = resolveStorageMode({ ...partial, NODE_ENV: "production" });
    expect(mode.provider).toBe("refuse");
    if (mode.provider === "refuse") expect(mode.reason).toMatch(/R2_ENDPOINT/);
  });

  it("lets an operator opt into disk storage in production, loudly", () => {
    const mode = resolveStorageMode({
      NODE_ENV: "production",
      STORAGE_ALLOW_LOCAL: "true",
      AUTH_SECRET: "real-secret",
    });
    expect(mode.provider).toBe("local");
    if (mode.provider === "local") expect(mode.warning).toMatch(/redeploy/);
  });

  it("only accepts the literal string true as the opt in", () => {
    for (const value of ["1", "yes", "TRUE", ""]) {
      expect(
        resolveStorageMode({
          NODE_ENV: "production",
          STORAGE_ALLOW_LOCAL: value,
          AUTH_SECRET: "x",
        }).provider,
      ).toBe("refuse");
    }
  });

  it("still requires AUTH_SECRET when disk storage is allowed in production", () => {
    const mode = resolveStorageMode({ NODE_ENV: "production", STORAGE_ALLOW_LOCAL: "true" });
    expect(mode.provider).toBe("refuse");
    if (mode.provider === "refuse") expect(mode.reason).toMatch(/AUTH_SECRET/);
  });

  it("keeps development on local disk with no warning when nothing is configured", () => {
    expect(resolveStorageMode({ NODE_ENV: "development" })).toEqual({
      provider: "local",
      warning: null,
    });
    expect(resolveStorageMode({})).toEqual({ provider: "local", warning: null });
  });

  it("warns in development about a partial configuration instead of refusing", () => {
    const mode = resolveStorageMode({ R2_BUCKET: "kademe-media", NODE_ENV: "development" });
    expect(mode.provider).toBe("local");
    if (mode.provider === "local") expect(mode.warning).toMatch(/R2_ACCESS_KEY_ID/);
  });

  it("honours STORAGE_REQUIRE_R2 outside production too", () => {
    expect(
      resolveStorageMode({ NODE_ENV: "test", STORAGE_REQUIRE_R2: "1" }).provider,
    ).toBe("refuse");
  });
});

describe("the local signing secret", () => {
  it("uses AUTH_SECRET when it is set", () => {
    expect(resolveSigningSecret({ AUTH_SECRET: "abc", NODE_ENV: "production" })).toBe("abc");
  });

  it("falls back to the development string only outside production", () => {
    expect(resolveSigningSecret({ NODE_ENV: "development" })).toBe("dev-only-storage-secret");
    expect(resolveSigningSecret({})).toBe("dev-only-storage-secret");
  });

  it("refuses to sign with the development string in production", () => {
    expect(() => resolveSigningSecret({ NODE_ENV: "production" })).toThrow(/AUTH_SECRET/);
  });
});
