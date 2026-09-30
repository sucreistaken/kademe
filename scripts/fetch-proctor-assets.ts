/**
 * Puts the in-browser proctoring models under public/proctor/<version>/ so
 * the exam never loads code or models from a third-party CDN during a test:
 * a CDN would see every student's IP address, school firewalls often block
 * them, and an outage there would silently switch detection off.
 *
 * Idempotent; checks every download against a pinned sha256.
 * Runs before `next build` (prebuild) and can be run by hand:
 *   npx tsx scripts/fetch-proctor-assets.ts
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const pkg = JSON.parse(readFileSync(resolve("node_modules/@mediapipe/tasks-vision/package.json"), "utf8"));
export const VERSION: string = pkg.version;
const OUT = resolve("public/proctor", VERSION);

const MODELS: Array<{ file: string; url: string; sha256: string | null }> = [
  {
    file: "face_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    sha256: "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",
  },
  {
    file: "efficientdet_lite0.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite",
    sha256: "0720bf247bd76e6594ea28fa9c6f7c5242be774818997dbbeffc4da460c723bb",
  },
];

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function main() {
  mkdirSync(join(OUT, "wasm"), { recursive: true });
  const wasmDir = resolve("node_modules/@mediapipe/tasks-vision/wasm");
  for (const f of readdirSync(wasmDir)) copyFileSync(join(wasmDir, f), join(OUT, "wasm", f));
  for (const m of MODELS) {
    const target = join(OUT, m.file);
    if (existsSync(target)) {
      const have = sha(readFileSync(target));
      if (!m.sha256 || have === m.sha256) {
        console.log(`ok     ${m.file} ${have}`);
        continue;
      }
    }
    const res = await fetch(m.url);
    if (!res.ok) throw new Error(`${m.file}: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const got = sha(bytes);
    if (m.sha256 && got !== m.sha256) throw new Error(`${m.file}: sha256 ${got} does not match the pinned ${m.sha256}`);
    writeFileSync(target, bytes);
    console.log(`fetched ${m.file} ${bytes.byteLength} bytes ${got}`);
  }
  writeFileSync(join(OUT, "VERSION"), VERSION);
  console.log(`proctor assets ready in public/proctor/${VERSION}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
