import type { ImageRef, ItemContent } from "./types";

/**
 * Every picture an item's content refers to, in reading order: the options of
 * a choice item, the targets of a matching item, or the pictures of a writing
 * or speaking task. Server side (it carries storage keys).
 */
export function imageRefsOf(content: ItemContent): ImageRef[] {
  switch (content.kind) {
    case "CHOICE":
      return content.options.flatMap((o) => (o.image ? [o.image] : []));
    case "MATCHING":
      return content.right.flatMap((r) => (r.image ? [r.image] : []));
    case "WRITING":
    case "SPEAKING":
      return content.images ?? [];
    default:
      return [];
  }
}

/** Storage keys of the bank's pictures: "bank/images/<16 hex>.webp". Anything else is refused on save. */
export const BANK_IMAGE_KEY = /^bank\/images\/[0-9a-f]{16}\.webp$/;
