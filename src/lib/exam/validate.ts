import type { ItemContent, ItemKey, ItemRubric, ItemType } from "./types";

/**
 * Structural checks every item passes before it may enter the bank, whether a
 * person wrote it, the seed ships it or a model generated it.
 *
 * The checks are about the item being answerable and scoreable, not about it
 * being good German. That part is the teacher's approval.
 */

export type ValidatableItem = {
  type: ItemType;
  prompt: string;
  content: ItemContent;
  key: ItemKey;
  rubric?: ItemRubric | null;
};

const EXPECTED: Record<ItemType, { content: ItemContent["kind"]; key: ItemKey["kind"] }> = {
  SINGLE_CHOICE: { content: "CHOICE", key: "CHOICE" },
  MULTI_CHOICE: { content: "CHOICE", key: "CHOICE" },
  TRUE_FALSE_NG: { content: "TFNG", key: "TFNG" },
  GAP_FILL: { content: "GAP", key: "GAP" },
  MATCHING: { content: "MATCHING", key: "MATCHING" },
  SHORT_TEXT: { content: "SHORT_TEXT", key: "SHORT_TEXT" },
  WRITING_PROMPT: { content: "WRITING", key: "NONE" },
  SPEAKING_PROMPT: { content: "SPEAKING", key: "NONE" },
};

const GAP_MARKER = /\{\{([A-Za-z0-9_-]+)\}\}/g;

export function gapMarkers(prompt: string): string[] {
  return [...prompt.matchAll(GAP_MARKER)].map((m) => m[1]);
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) {
    const k = v.trim().toLowerCase();
    if (seen.has(k)) dup.add(v);
    seen.add(k);
  }
  return [...dup];
}

export function validateItem(item: ValidatableItem): string[] {
  const errors: string[] = [];
  const expected = EXPECTED[item.type];
  if (!expected) return [`unknown item type ${item.type}`];
  if (!item.prompt || item.prompt.trim().length < 3) errors.push("prompt is empty");
  if (item.content.kind !== expected.content)
    errors.push(`content kind ${item.content.kind} does not fit ${item.type}`);
  if (item.key.kind !== expected.key) errors.push(`key kind ${item.key.kind} does not fit ${item.type}`);
  if (errors.length > 0) return errors;

  const content = item.content;
  const key = item.key;

  if (content.kind === "CHOICE" && key.kind === "CHOICE") {
    const ids = content.options.map((o) => o.id);
    if (content.options.length < 3) errors.push("a choice item needs at least three options");
    if (duplicates(ids).length) errors.push("option ids repeat");
    if (duplicates(content.options.map((o) => o.text)).length) errors.push("option texts repeat");
    if (content.options.some((o) => !o.text.trim())) errors.push("an option is empty");
    const unknown = key.correct.filter((c) => !ids.includes(c));
    if (unknown.length) errors.push(`key names unknown options ${unknown.join(",")}`);
    if (item.type === "SINGLE_CHOICE" && key.correct.length !== 1)
      errors.push("a single choice item has exactly one correct option");
    if (item.type === "MULTI_CHOICE" && (key.correct.length < 1 || key.correct.length >= ids.length))
      errors.push("a multi choice item has at least one correct and one wrong option");
  }

  if (content.kind === "TFNG" && key.kind === "TFNG") {
    if (content.statements.length < 1) errors.push("no statements");
    for (const s of content.statements) {
      const v = key.answers[s.id];
      if (v !== "R" && v !== "F" && v !== "NG") errors.push(`statement ${s.id} has no answer`);
    }
    if (duplicates(content.statements.map((s) => s.id)).length) errors.push("statement ids repeat");
  }

  if (content.kind === "GAP" && key.kind === "GAP") {
    const markers = gapMarkers(item.prompt);
    const ids = content.gaps.map((g) => g.id);
    if (ids.length === 0) errors.push("no gaps");
    if (duplicates(markers).length) errors.push("a gap marker repeats in the prompt");
    const missingMarker = ids.filter((id) => !markers.includes(id));
    const strayMarker = markers.filter((m) => !ids.includes(m));
    if (missingMarker.length) errors.push(`gaps without a marker: ${missingMarker.join(",")}`);
    if (strayMarker.length) errors.push(`markers without a gap: ${strayMarker.join(",")}`);
    for (const g of content.gaps) {
      const accepted = key.answers[g.id];
      if (!accepted || accepted.length === 0 || accepted.some((a) => !a.trim()))
        errors.push(`gap ${g.id} has no accepted answer`);
      else if (g.choices) {
        if (g.choices.length < 3) errors.push(`gap ${g.id} needs at least three choices`);
        if (duplicates(g.choices).length) errors.push(`gap ${g.id} choices repeat`);
        if (!accepted.some((a) => g.choices!.includes(a)))
          errors.push(`gap ${g.id} answer is not among its choices`);
      }
    }
  }

  if (content.kind === "MATCHING" && key.kind === "MATCHING") {
    const left = content.left.map((l) => l.id);
    const right = content.right.map((r) => r.id);
    if (left.length < 2) errors.push("matching needs at least two rows");
    if (right.length < left.length) errors.push("matching needs at least as many targets as rows");
    for (const l of left) {
      const target = key.pairs[l];
      if (!target || !right.includes(target)) errors.push(`row ${l} has no valid target`);
    }
    if (duplicates([...left, ...right]).length) errors.push("matching ids repeat");
  }

  if (content.kind === "SHORT_TEXT" && key.kind === "SHORT_TEXT") {
    if (key.accepted.length === 0 || key.accepted.some((a) => !a.trim()))
      errors.push("short text needs accepted answers");
  }

  if (content.kind === "WRITING") {
    if (content.minWords < 10 || content.maxWords <= content.minWords)
      errors.push("writing word range is not sensible");
    if (!item.rubric || item.rubric.contentPoints.length === 0)
      errors.push("writing needs content points");
  }

  if (content.kind === "SPEAKING") {
    if (content.answerSeconds < 20 || content.answerSeconds > 600)
      errors.push("speaking answer time must be 20 to 600 seconds");
    if (content.thinkSeconds < 0 || content.thinkSeconds > 300)
      errors.push("speaking think time must be 0 to 300 seconds");
    if (content.maxTakes < 1 || content.maxTakes > 3) errors.push("speaking takes must be 1 to 3");
    if (!item.rubric || item.rubric.contentPoints.length === 0)
      errors.push("speaking needs content points");
  }

  return errors;
}
