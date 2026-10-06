import { createHash } from "node:crypto";
import type { SeedItem } from "./types";

/**
 * Stable key of a seed item, stored on the item row so a later top-up can tell
 * which starter items an organisation already has. Derived from what makes the
 * item itself (section, level, type, its text or clip, prompt and content), so
 * it never has to be written by hand. Editing a seed item makes it a new item.
 *
 * Several reading items share the prompt "Richtig, falsch oder nicht im
 * Text?", so the stimulus key and the content are part of the hash. Content is
 * serialised with sorted keys: Postgres jsonb reorders keys, and a key computed
 * from a stored row has to equal the one computed from the source.
 */
export type SeedKeyInput = Pick<SeedItem, "section" | "level" | "type" | "prompt" | "content"> & {
  stimulusKey?: string | null;
};

export function seedItemKey(item: SeedKeyInput): string {
  const hash = createHash("sha256")
    .update(
      [item.section, item.level, item.type, item.stimulusKey ?? "", item.prompt, canonicalJson(item.content)].join("\n"),
    )
    .digest("hex")
    .slice(0, 16);
  return `${item.section.toLowerCase()}-${item.level.toLowerCase()}-${hash}`;
}

/** JSON with object keys sorted at every depth; arrays keep their order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
