import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { imageRefsOf } from "@/lib/exam/image-refs";
import { IMAGES_DIR, imageStorageKey } from "./image";
import manifest from "./images/manifest.json";
import { SEED_BANK } from "./index";

/**
 * The how-it-works demos show their own pictures (public/tutorial/img). A student who watched a demo must
 * never meet the same picture in a real item, where it would hint at the demo's answer. The catalog is
 * content addressed (bank/images/<sha16>.webp, sha16 = the first 16 hex of the file's sha256), so a bank
 * item shows a demo picture exactly when it refers to a key made from a demo file's hash.
 */

const TUTORIAL_DIR = path.join(process.cwd(), "public", "tutorial", "img");
const sha256 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

const tutorialFiles = readdirSync(TUTORIAL_DIR)
  .filter((f) => f.endsWith(".webp"))
  .map((f) => ({ file: f, hash: sha256(path.join(TUTORIAL_DIR, f)) }));

const used = SEED_BANK.items.flatMap((item) =>
  imageRefsOf(item.content).map((ref) => ({ ref: `${item.level} ${item.section} ${item.stimulusKey ?? ""} "${item.prompt.slice(0, 40)}"`, key: ref.storageKey })),
);

describe("tutorial pictures are never bank pictures in use", () => {
  it("finds the demo pictures and the bank's pictures", () => {
    expect(tutorialFiles.length).toBeGreaterThan(0);
    expect(used.length).toBeGreaterThan(0);
  });

  it("no seed item refers to a picture with the same bytes as a demo picture", () => {
    const demoKeys = new Map(tutorialFiles.map((t) => [imageStorageKey(t.hash.slice(0, 16)), t.file]));
    const hits = used.filter((u) => demoKeys.has(u.key)).map((u) => `${demoKeys.get(u.key)}: ${u.ref}`);
    expect(hits).toEqual([]);
  });

  it("no catalog file an item uses has the same full hash as a demo picture", () => {
    const fileByKey = new Map(manifest.images.map((e) => [imageStorageKey(e.sha16), e.file]));
    const demoHashes = new Map(tutorialFiles.map((t) => [t.hash, t.file]));
    const usedFiles = new Set(used.map((u) => fileByKey.get(u.key)).filter((f): f is string => Boolean(f)));
    const hits = [...usedFiles].filter((f) => demoHashes.has(sha256(path.join(IMAGES_DIR, f))));
    expect(hits).toEqual([]);
  });

  it("the catalog marks exactly the demo pictures as reserved, so img() refuses them while a level loads", () => {
    const demoSha16 = new Set(tutorialFiles.map((t) => t.hash.slice(0, 16)));
    const sameBytes = manifest.images.filter((e) => demoSha16.has(e.sha16)).map((e) => e.id).sort();
    const reserved = manifest.images.filter((e) => "reserved" in e && e.reserved === "tutorial").map((e) => e.id).sort();
    expect(reserved).toEqual(sameBytes);
  });
});
