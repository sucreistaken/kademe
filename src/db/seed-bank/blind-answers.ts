import type { ItemAnswer, ItemContent, TfngValue } from "@/lib/exam/types";

/**
 * Parsing the filled blind-solve answer file. One line per item:
 *
 *   <seedKey>: g1=dem, g2=den     (typed gaps, also open cloze)
 *   <seedKey>: choice=b           (single choice; several: choice=a,c)
 *   <seedKey>: s1=R, s2=F, s3=NG  (true / false / not given; Ja / Nein: J, N, T)
 *   <seedKey>: l1=B, l2=D         (matching: left id = letter of the right column)
 *
 * Lines that do not start with a seed key are ignored, so the file may keep
 * the surrounding Markdown. A value left empty counts as unanswered.
 */

export type RawAnswers = Map<string, Map<string, string>>;

const LINE = /^\s*(?:[-*]\s+)?`?([a-z]+-[a-z0-9]+-[0-9a-f]{16})`?\s*:\s*(.*)$/u;
/** Split on commas that start a new `id=` pair, so a gap value may itself contain commas. */
const PAIR_SPLIT = /,\s*(?=[A-Za-z0-9_]+\s*=)/u;

export function parseAnswerFile(text: string): RawAnswers {
  const out: RawAnswers = new Map();
  for (const line of text.split("\n")) {
    const m = LINE.exec(line);
    if (!m) continue;
    const pairs = out.get(m[1]) ?? new Map<string, string>();
    for (const part of m[2].split(PAIR_SPLIT)) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      pairs.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
    }
    out.set(m[1], pairs);
  }
  return out;
}

const TFNG_WORDS: Record<string, TfngValue> = {
  r: "R",
  richtig: "R",
  f: "F",
  falsch: "F",
  n: "NG",
  ng: "NG",
  "nicht im text": "NG",
};

/** Ja / Nein wording: J and N are yes and no, T is "Text sagt dazu nichts". */
const JA_NEIN_WORDS: Record<string, TfngValue> = {
  j: "R",
  ja: "R",
  n: "F",
  nein: "F",
  t: "NG",
  "text sagt dazu nichts": "NG",
  ng: "NG",
};

export function parseTfng(raw: string, wording?: "JA_NEIN"): TfngValue | undefined {
  const w = raw.trim().toLocaleLowerCase("de-DE");
  // The Ja / Nein words are also accepted under the Richtig / Falsch wording, except the clashing "n".
  if (wording === "JA_NEIN") return JA_NEIN_WORDS[w] ?? TFNG_WORDS[w];
  return TFNG_WORDS[w] ?? (w === "ja" || w === "nein" || w === "j" || w === "text sagt dazu nichts" || w === "t" ? JA_NEIN_WORDS[w] : undefined);
}

/** The template's placeholder values count as empty. */
const isBlank = (v: string) => v === "" || v === "..." || v === "…";

/**
 * Turns the raw pairs of one item into the engine's `ItemAnswer`.
 * `letterToRightId` maps the letter a matching row shows to the right column id.
 * Returns null when the solver gave nothing for this item.
 */
export function toItemAnswer(
  content: ItemContent,
  pairs: Map<string, string> | undefined,
  letterToRightId: Record<string, string> = {},
): ItemAnswer | null {
  if (!pairs) return null;
  const filled = [...pairs].filter(([, v]) => !isBlank(v));
  if (filled.length === 0) return null;
  switch (content.kind) {
    case "CHOICE": {
      const raw = filled.find(([k]) => k === "choice")?.[1];
      if (!raw) return null;
      return { choiceIds: raw.split(/[,+|\s]+/u).filter(Boolean) };
    }
    case "TFNG": {
      const tfng: Record<string, TfngValue> = {};
      for (const [k, v] of filled) {
        const t = parseTfng(v, content.wording);
        if (t) tfng[k] = t;
      }
      return Object.keys(tfng).length ? { tfng } : null;
    }
    case "GAP":
      return { gaps: Object.fromEntries(filled) };
    case "MATCHING": {
      const matches: Record<string, string> = {};
      for (const [k, v] of filled) {
        const id = letterToRightId[v.toUpperCase()] ?? letterToRightId[v];
        if (id) matches[k] = id;
      }
      return Object.keys(matches).length ? { matches } : null;
    }
    default:
      return null;
  }
}
