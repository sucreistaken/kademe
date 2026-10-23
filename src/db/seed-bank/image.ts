import path from "node:path";
import manifest from "./images/manifest.json";
import { imageRefsOf } from "@/lib/exam/image-refs";
import type { ImageRef, ItemContent } from "@/lib/exam/types";

/**
 * Seed authors refer to a catalog picture by its manifest id:
 *
 *   img("obj.activity.cooking")
 *
 * The result is an `ImageRef` whose storage key is content addressed
 * ("bank/images/<sha16>.webp"), like listening audio. The importer uploads
 * the files (see `seedImageFiles`) before it inserts the items.
 */

type ManifestEntry = { id: string; file: string; sha16: string; w: number; h: number; alt: string; reserved?: string };

const ENTRIES: ManifestEntry[] = manifest.images;
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

export const IMAGES_DIR = path.join(process.cwd(), "src", "db", "seed-bank", "images");

export const imageStorageKey = (sha16: string) => `bank/images/${sha16}.webp`;

export function img(id: string): ImageRef {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`unknown seed picture "${id}" (see src/db/seed-bank/images/manifest.json)`);
  // The how-it-works demos show these pictures (public/tutorial/img): a student must never meet them in a real item.
  if (e.reserved) throw new Error(`seed picture "${id}" is reserved for the ${e.reserved} and cannot be used in an item`);
  return { storageKey: imageStorageKey(e.sha16), w: e.w, h: e.h, alt: e.alt };
}

/** Every catalog file with the key it is stored under, for the importer. */
export function seedImageFiles(): Array<{ storageKey: string; path: string; mime: "image/webp" }> {
  return ENTRIES.map((e) => ({ storageKey: imageStorageKey(e.sha16), path: path.join(IMAGES_DIR, e.file), mime: "image/webp" as const }));
}

/** The catalog files that the given items refer to (each once), so the importer uploads only what is used. */
export function seedImageFilesUsedBy(contents: ItemContent[]): ReturnType<typeof seedImageFiles> {
  const used = new Set(contents.flatMap((c) => imageRefsOf(c).map((r) => r.storageKey)));
  return seedImageFiles().filter((f) => used.has(f.storageKey));
}
