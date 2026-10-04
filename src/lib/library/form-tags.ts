import type { I18nText } from "@/db/schema/types";

/** An observation tag row in the competency form. `key` is stable across edits; `id` is null until saved. */
export type FormTag = { key: string; id: string | null; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText };

/** Stored tags as form rows, keyed by id, so the next save sends the same ids back. */
export function formTags(saved: Array<{ id: string; polarity: FormTag["polarity"]; label: I18nText }>): FormTag[] {
  return saved.map((tag) => ({ key: tag.id, id: tag.id, polarity: tag.polarity, label: tag.label }));
}
