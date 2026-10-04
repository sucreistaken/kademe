import { z } from "zod";
import type { I18nText } from "@/db/schema/types";
import type { AiMessage } from "@/lib/ai";
import { parseModelJson, withoutEmDash } from "@/lib/ai-json";
import { ANCHOR_LEVELS, hasText, REQUIRED_ANCHOR_LEVELS } from "./anchors";

/**
 * ANCHOR_DRAFT (HIRING-UX 3.9, 5.10): proposed 1-5 behavioural anchors for one
 * competency. A proposal: the person reads it, edits it and saves it, or not.
 * It never describes a real candidate.
 */
const KEYS = [1, 2, 3, 4, 5].flatMap((l) => [`level${l}Tr`, `level${l}En`]);
const line = z.string().max(600);
const anchorDraftSchema = z.object(Object.fromEntries(KEYS.map((k) => [k, line])) as Record<string, typeof line>);

export const ANCHOR_DRAFT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: KEYS,
  properties: Object.fromEntries(KEYS.map((k) => [k, { type: "string" }])),
};

export type AnchorProposal = Record<1 | 2 | 3 | 4 | 5, I18nText>;
export type AnchorDraftRequest = {
  name: I18nText;
  description: I18nText;
  levels: Array<{ value: number; label: I18nText }>;
};

const SYSTEM_PROMPT = `You write behavioural anchors for one competency on a 1 to 5 rating scale. A hiring team will read your proposal, edit it and decide whether to use it.

Rules:
- Each level describes what a reviewer can observe in a candidate's answer: what the candidate says or does. Never a personality trait, never an adjective about the person.
- Level 1 is a clear gap, 3 meets the bar for the role, 5 is exceptional. Levels 2 and 4 sit between their neighbours.
- One or two concrete sentences per level.
- Nothing about age, gender, family, health, religion, origin, politics or any other protected characteristic.
- You never score, rank or judge a real person; you only describe levels.
- Turkish fields are natural Turkish, not translated English. English fields are plain English.
- Never use the em dash character.`;

export function buildAnchorMessages(request: AnchorDraftRequest): AiMessage[] {
  const levels = request.levels.map((l) => `${l.value}: ${l.label.tr} / ${l.label.en}`).join("\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `Yetkinlik / Competency: ${request.name.tr} / ${request.name.en}`,
        `Tanım / Definition: ${request.description.tr || "-"} / ${request.description.en || "-"}`,
        "",
        "Seviye adları / Level names:",
        levels,
        "",
        "Fill level1Tr ... level5En. Every field must be filled.",
      ].join("\n"),
    },
  ];
}

export function parseAnchorAnswer(text: string): { ok: true; anchors: AnchorProposal } | { ok: false; problem: string } {
  const json = parseModelJson(text);
  if (!json.ok) return json;
  const parsed = anchorDraftSchema.safeParse(json.value);
  if (!parsed.success) {
    return { ok: false, problem: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const value = parsed.data;
  const anchors = Object.fromEntries(
    ([1, 2, 3, 4, 5] as const).map((l) => [
      l,
      { tr: withoutEmDash(value[`level${l}Tr`].trim()), en: withoutEmDash(value[`level${l}En`].trim()) },
    ]),
  ) as AnchorProposal;
  const missing = REQUIRED_ANCHOR_LEVELS.filter((l) => !hasText(anchors[l]));
  if (missing.length) return { ok: false, problem: `levels ${missing.join(", ")} are empty` };
  return { ok: true, anchors };
}

/**
 * Copying a proposal into the form (C19): only the levels the AI actually wrote
 * replace the field. An empty optional level 2 or 4 leaves what the person typed.
 */
export function mergeAnchorProposal(current: Record<number, I18nText>, proposal: AnchorProposal): Record<number, I18nText> {
  const next = { ...current };
  for (const level of ANCHOR_LEVELS) {
    if (hasText(proposal[level])) next[level] = proposal[level];
  }
  return next;
}
