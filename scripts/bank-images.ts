/**
 * Convert raw catalog photos into the repo's exam bank picture catalog.
 *
 * Usage: tsx scripts/bank-images.ts [rawDir]   (or env BANK_IMAGES_RAW)
 *
 * Reads every raw file named `<id>.<ext>` (jpg, jpeg, png, webp, or svg for
 * `chart.<level>.<name>` charts, which need no sources.json entry) plus two JSON
 * files that live next to them:
 *   - sources.json: { [id]: { sourceUrl, license, author } }
 *   - alts.json:    { [id]: "short neutral German description" }
 * Writes `src/db/seed-bank/images/<id>.webp` and upserts `manifest.json`.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "src/db/seed-bank/images");
const MANIFEST = path.join(OUT_DIR, "manifest.json");
const RAW_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg"]);
const QUALITY = 78;
const OBJECT_WIDTH = 960;
const SCENE_WIDTH = 1200;
const CHART_SOURCE = { sourceUrl: "https://kademe.kadiray.com/original", license: "Original (Kademe)", author: "Kademe" };

type Kind = "object" | "scene" | "chart";

interface ManifestEntry {
  id: string;
  file: string;
  sha16: string;
  w: number;
  h: number;
  alt: string;
  kind: Kind;
  category: string;
  levels: string[];
  sourceUrl: string;
  license: string;
  author: string;
}

interface SourceInfo {
  sourceUrl: string;
  license: string;
  author: string;
}

/** Derive kind, category and CEFR levels from a catalog id like `obj.food.apples` or `scene.b1.volunteers`. */
export function describeId(id: string): { kind: Kind; category: string; levels: string[] } {
  const parts = id.split(".");
  if (parts[0] === "obj" && parts.length === 3) {
    return { kind: "object", category: parts[1], levels: ["A1", "A2"] };
  }
  if (parts[0] === "scene" && parts.length === 3) {
    return { kind: "scene", category: "speaking", levels: [parts[1].toUpperCase()] };
  }
  if (parts[0] === "chart" && parts.length === 3) {
    return { kind: "chart", category: "chart", levels: [parts[1].toUpperCase()] };
  }
  throw new Error(`Unrecognised catalog id: ${id}`);
}

function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : fallback;
}

async function main() {
  const rawDir = process.argv[2] ?? process.env.BANK_IMAGES_RAW;
  if (!rawDir) throw new Error("Pass the raw folder as argv[2] or BANK_IMAGES_RAW");

  const sources = readJson<Record<string, SourceInfo>>(path.join(rawDir, "sources.json"), {});
  const alts = readJson<Record<string, string>>(path.join(rawDir, "alts.json"), {});
  const existing = readJson<{ images: ManifestEntry[] }>(MANIFEST, { images: [] });
  const byId = new Map(existing.images.map((e) => [e.id, e]));

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const name of fs.readdirSync(rawDir).sort()) {
    const ext = path.extname(name).toLowerCase();
    if (!RAW_EXT.has(ext)) continue;
    const id = name.slice(0, -ext.length);
    const { kind, category, levels } = describeId(id);
    // Charts are drawn by us as SVG, so their provenance is fixed.
    const src = kind === "chart" ? CHART_SOURCE : sources[id];
    const alt = alts[id];
    if (!src) throw new Error(`Missing source data for ${id} in sources.json`);
    if (!alt) throw new Error(`Missing alt text for ${id} in alts.json`);

    const width = kind === "object" ? OBJECT_WIDTH : SCENE_WIDTH; // charts use the scene width
    // sharp strips metadata by default; rotate() applies EXIF orientation first.
    const buf = await sharp(path.join(rawDir, name), ext === ".svg" ? { density: 144 } : undefined)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
    const meta = await sharp(buf).metadata();
    const file = `${id}.webp`;
    fs.writeFileSync(path.join(OUT_DIR, file), buf);

    byId.set(id, {
      id,
      file,
      sha16: createHash("sha256").update(buf).digest("hex").slice(0, 16),
      w: meta.width ?? 0,
      h: meta.height ?? 0,
      alt,
      kind,
      category,
      levels,
      sourceUrl: src.sourceUrl,
      license: src.license,
      author: src.author,
    });
    console.log(`${id} -> ${file} ${meta.width}x${meta.height} ${(buf.length / 1024).toFixed(0)} KB`);
  }

  const images = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  fs.writeFileSync(MANIFEST, JSON.stringify({ images }, null, 2) + "\n");
  console.log(`manifest: ${images.length} images`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
