/**
 * Exercises the whole R2 multipart lifecycle against a real bucket.
 *
 * Nothing in this repository proves the R2 path. The unit tests in
 * src/lib/storage.test.ts run against LocalStorageProvider, which has different
 * rules (no 5 MiB minimum part, a relative signed URL, parts on disk instead of
 * in a bucket), so a green test run says nothing about whether a recording
 * survives the switch. This script is the only thing that does, and it needs
 * credentials: with none it reports that nothing was verified and exits non
 * zero rather than printing a reassuring green line.
 *
 * It writes and then deletes one throwaway object under `verify/r2/`. It never
 * touches anything under `media/`.
 *
 * Run with: pnpm verify:r2
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  type CompletedPart,
  type StorageProvider,
  getStorage,
  r2ConfigStatus,
  resetStorageCache,
} from "../src/lib/storage";

let failed = 0;
const ok = (m: string) => console.log(`   ok   ${m}`);
const bad = (m: string) => {
  console.log(`   FAIL ${m}`);
  failed = 1;
};
const say = (m: string) => console.log(`\n== ${m}`);

/** Just over the 5 MiB floor R2 enforces on every part except the last. */
const FIRST_PART_BYTES = 5 * 1024 * 1024 + 1024;
const SECOND_PART_BYTES = 64 * 1024;

function filler(size: number, seed: number): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) out[i] = (i * 131 + seed * 7) % 256;
  return out;
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(Buffer.from(b));
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function refuse(): never {
  const { present, missing } = r2ConfigStatus();
  console.log("\n== R2 verification");
  console.log("   NOT VERIFIED: no R2 bucket is configured in this environment.");
  console.log(`   missing: ${missing.join(", ")}`);
  console.log(`   present: ${present.length > 0 ? present.join(", ") : "(none)"}`);
  console.log("");
  console.log("   Nothing was checked. Every claim about the R2 storage path is");
  console.log("   still unproven: this run touched no bucket at all.");
  console.log("");
  console.log("   To verify it, put all four variables in .env and run again:");
  console.log("     R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET");
  console.log("   See docs/STORAGE.md.\n");
  process.exit(1);
}

async function main() {
  if (r2ConfigStatus().missing.length > 0) refuse();

  resetStorageCache();
  const storage: StorageProvider = getStorage();

  say("provider selection");
  if (storage.name === "r2") ok(`getStorage() chose r2 (bucket ${process.env.R2_BUCKET})`);
  else {
    bad(`getStorage() chose ${storage.name} with the credentials present`);
    process.exit(1);
  }
  if (storage.minPartBytes === 5 * 1024 * 1024) ok("minPartBytes is 5 MiB");
  else bad(`minPartBytes is ${storage.minPartBytes}, expected 5242880`);
  if (storage.publicSignedUrls) ok("signed urls are declared fetchable by a third party");
  else bad("publicSignedUrls is false on the r2 provider");

  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const key = `verify/r2/${stamp}.bin`;
  const salvageKey = `verify/r2/${stamp}-salvage.bin`;
  const abortKey = `verify/r2/${stamp}-abort.bin`;

  const first = filler(FIRST_PART_BYTES, 1);
  const second = filler(SECOND_PART_BYTES, 2);
  const whole = new Uint8Array(FIRST_PART_BYTES + SECOND_PART_BYTES);
  whole.set(first, 0);
  whole.set(second, FIRST_PART_BYTES);

  try {
    say(`multipart upload of ${whole.byteLength} bytes to ${key}`);
    const { uploadId } = await storage.initUpload(key, "application/octet-stream");
    ok(`initUpload returned an upload id (${uploadId.slice(0, 12)}...)`);

    const p1 = await storage.uploadPart(key, uploadId, 1, first);
    const p2 = await storage.uploadPart(key, uploadId, 2, second);
    if (p1.etag && p2.etag) ok("both parts came back with an etag");
    else bad(`a part came back without an etag (1:${p1.etag} 2:${p2.etag})`);

    const listed = await storage.listParts(key, uploadId);
    if (listed.length === 2 && listed[0].partNumber === 1 && listed[1].partNumber === 2) {
      ok("listParts reports both parts, in order");
    } else {
      bad(`listParts returned ${JSON.stringify(listed.map((p) => p.partNumber))}`);
    }
    if (listed[0]?.bytes === FIRST_PART_BYTES && listed[1]?.bytes === SECOND_PART_BYTES) {
      ok("listParts reports the sizes R2 actually stored");
    } else {
      bad(`listParts sizes were ${listed.map((p) => p.bytes).join(", ")}`);
    }

    // Deliberately blank etags. This is what the browser reports on the direct
    // to bucket path when the bucket CORS policy does not expose ETag, and a
    // completeUpload that trusted them would be rejected with InvalidPart.
    const blank: CompletedPart[] = [
      { partNumber: 1, etag: "", bytes: 0 },
      { partNumber: 2, etag: "", bytes: 0 },
    ];
    const completed = await storage.completeUpload(key, uploadId, blank);
    ok("completeUpload succeeded even with etags the browser could not read");
    if (completed.bytes === whole.byteLength) {
      ok(`completeUpload reported ${completed.bytes} bytes, the size R2 holds`);
    } else {
      bad(`completeUpload reported ${completed.bytes}, expected ${whole.byteLength}`);
    }

    say("signed url, fetched over HTTP like a browser would");
    const url = await storage.getSignedUrl(key, 300);
    if (/^https?:\/\//.test(url)) ok(`absolute url (${new URL(url).host})`);
    else bad(`signed url is not absolute: ${url.slice(0, 60)}`);

    const res = await fetch(url);
    if (res.ok) ok(`GET returned ${res.status}`);
    else bad(`GET returned ${res.status}`);
    const fetched = new Uint8Array(await res.arrayBuffer());
    if (same(fetched, whole)) ok(`fetched ${fetched.byteLength} bytes identical to the upload`);
    else bad(`fetched ${fetched.byteLength} bytes that differ from the upload`);

    say("range request over the signed url, which is how a video seeks");
    // Deliberately across the part boundary: a multipart object that was
    // assembled wrongly reads fine inside part one and wrongly across the seam.
    const from = FIRST_PART_BYTES - 100;
    const to = FIRST_PART_BYTES + 99;
    const ranged = await fetch(url, { headers: { range: `bytes=${from}-${to}` } });
    if (ranged.status === 206) ok("206 Partial Content");
    else bad(`expected 206, got ${ranged.status}`);
    const contentRange = ranged.headers.get("content-range");
    if (contentRange === `bytes ${from}-${to}/${whole.byteLength}`) {
      ok(`content-range ${contentRange}`);
    } else {
      bad(`content-range was ${contentRange}`);
    }
    const rangedBytes = new Uint8Array(await ranged.arrayBuffer());
    if (same(rangedBytes, whole.slice(from, to + 1))) {
      ok("the ranged bytes match the same slice of the upload, across the part seam");
    } else {
      bad("the ranged bytes differ from that slice of the upload");
    }

    say("openStream");
    const full = await storage.openStream(key);
    if (full.totalBytes === whole.byteLength) ok(`totalBytes ${full.totalBytes}`);
    else bad(`totalBytes was ${full.totalBytes}, expected ${whole.byteLength}`);
    if (same(await drain(full.stream), whole)) ok("the whole object read back byte for byte");
    else bad("openStream without a range returned different bytes");

    const slice = await storage.openStream(key, { start: from, end: to });
    if (slice.bytes === to - from + 1) ok(`ranged openStream reported ${slice.bytes} bytes`);
    else bad(`ranged openStream reported ${slice.bytes}, expected ${to - from + 1}`);
    if (slice.totalBytes === whole.byteLength) ok(`ranged openStream knows the total (${slice.totalBytes})`);
    else bad(`ranged openStream totalBytes was ${slice.totalBytes}`);
    if (same(await drain(slice.stream), whole.slice(from, to + 1))) {
      ok("ranged openStream returned exactly that slice");
    } else {
      bad("ranged openStream returned the wrong bytes");
    }

    const openEnded = await storage.openStream(key, {
      start: whole.byteLength - 32,
      end: Number.MAX_SAFE_INTEGER,
    });
    if (openEnded.bytes === 32) ok("an unbounded range end is clamped to the object");
    else bad(`an unbounded range end returned ${openEnded.bytes} bytes, expected 32`);
    await drain(openEnded.stream);

    say("salvage: a recording whose browser never came back");
    const abandoned = await storage.initUpload(salvageKey, "application/octet-stream");
    await storage.uploadPart(salvageKey, abandoned.uploadId, 1, first);
    await storage.uploadPart(salvageKey, abandoned.uploadId, 2, second);
    // No completeUpload, exactly as if the tab had been closed mid record.
    const salvaged = await storage.salvage(salvageKey, abandoned.uploadId);
    if (salvaged.parts.length === 2) ok("salvage found both orphan parts without being told");
    else bad(`salvage found ${salvaged.parts.length} parts`);
    if (salvaged.bytes === whole.byteLength) ok(`salvage assembled ${salvaged.bytes} bytes`);
    else bad(`salvage assembled ${salvaged.bytes}, expected ${whole.byteLength}`);
    const salvagedRead = await storage.openStream(salvageKey);
    if (same(await drain(salvagedRead.stream), whole)) ok("the salvaged object is the recording");
    else bad("the salvaged object does not match what was uploaded");

    say("abort");
    const doomed = await storage.initUpload(abortKey, "application/octet-stream");
    await storage.uploadPart(abortKey, doomed.uploadId, 1, second);
    await storage.abortUpload(abortKey, doomed.uploadId);
    try {
      const left = await storage.listParts(abortKey, doomed.uploadId);
      if (left.length === 0) ok("an aborted upload holds no parts");
      else bad(`an aborted upload still lists ${left.length} part(s)`);
    } catch {
      ok("an aborted upload is gone (R2 no longer knows the upload id)");
    }

    say("delete, which is what the retention job calls");
    await storage.delete(key);
    const afterDelete = await fetch(url);
    if (afterDelete.status === 404 || afterDelete.status === 403) {
      ok(`the object is gone (GET now ${afterDelete.status})`);
    } else {
      bad(`the object is still fetchable after delete (${afterDelete.status})`);
    }
    let stillThere = true;
    try {
      const revived = await storage.openStream(key);
      await drain(revived.stream);
    } catch {
      stillThere = false;
    }
    if (!stillThere) ok("openStream refuses a deleted key");
    else bad("openStream still returns a deleted object");

    try {
      await storage.delete(key);
      ok("deleting twice is not an error, so the retention job is safe to re-run");
    } catch (error) {
      bad(`the second delete threw: ${String(error)}`);
    }
  } finally {
    // Leave nothing behind, even if a check above threw.
    for (const k of [key, salvageKey, abortKey]) {
      await storage.delete(k).catch(() => undefined);
    }
  }

  console.log(
    failed
      ? "\nSOME CHECKS FAILED. The R2 path is NOT verified.\n"
      : "\nALL CHECKS PASSED against a real bucket.\n",
  );
  process.exit(failed);
}

void main().catch((error) => {
  console.error(`\nverify-r2 crashed: ${String(error)}`);
  console.log("\nThe R2 path is NOT verified.\n");
  process.exit(1);
});
