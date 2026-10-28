import { courseUnits } from "@/lib/exam/course/units";
import { scoreItem } from "@/lib/exam/item-scoring";
import type { ItemAnswer, ItemKey, Section } from "@/lib/exam/types";
import { SHORT_TEXT_ID, toItemAnswer, type RawAnswers } from "./blind-answers";
import { renderSlots, type BlindItem } from "./blind-items";

/**
 * The text of a blind-solve file and the comparison of a filled one, shared by
 * the bank's and the course forms' scripts (scripts/bank-blind-export.ts and
 * bank-blind-compare.ts). Pure: the scripts do the file access.
 */

/** The Markdown file a solver answers WITHOUT the keys: every item as the candidate sees it, then an answer template. */
export function renderBlindFile(title: string, items: BlindItem[], notes: string[] = []): string {
  const out: string[] = [
    `# ${title}`,
    "",
    "Answer every item below without any key. Fill the answer template block of each item (replace `...`), keep the line format, and save the file.",
    "",
    ...(notes.length ? [...notes, ""] : []),
  ];
  const shown = new Set<string>();
  let n = 0;
  for (const it of items) {
    n++;
    const st = it.stimulus;
    out.push(`## ${n}. ${it.item.section}`, "");
    if (st) {
      if (!shown.has(st.key)) {
        shown.add(st.key);
        out.push(st.section === "LISTENING" ? `### Hörtext (Skript): ${st.title}` : `### Text: ${st.title}`, "", st.body.trim(), "");
      } else {
        out.push(`(${st.section === "LISTENING" ? "Hörtext" : "Text"} wie oben: ${st.title})`, "");
      }
    }
    out.push(`**Aufgabe:** ${it.candidate.prompt.replace(/\{\{\s*([^}\s]+)\s*\}\}/gu, "[$1]")}`, "");
    const { lines, template } = renderSlots(it);
    if (lines.length) out.push(...lines, "");
    out.push("```", template, "```", "");
  }
  return out.join("\n");
}

function show(answer: ItemAnswer | null): string {
  if (!answer) return "-";
  if (answer.choiceIds) return answer.choiceIds.join(",");
  if (answer.tfng) return Object.entries(answer.tfng).map(([k, v]) => `${k}=${v}`).join(", ");
  if (answer.gaps) return Object.entries(answer.gaps).map(([k, v]) => `${k}=${v}`).join(", ");
  if (answer.matches) return Object.entries(answer.matches).map(([k, v]) => `${k}=${v}`).join(", ");
  if (answer.text !== undefined) return `${SHORT_TEXT_ID}=${answer.text}`;
  return "-";
}

function showKey(key: ItemKey): string {
  switch (key.kind) {
    case "CHOICE":
      return key.correct.join(",");
    case "TFNG":
      return Object.entries(key.answers).map(([k, v]) => `${k}=${v}`).join(", ");
    case "GAP":
      return Object.entries(key.answers).map(([k, v]) => `${k}=${v.join("/")}`).join(", ");
    case "MATCHING":
      return Object.entries(key.pairs).map(([k, v]) => `${k}=${v}`).join(", ");
    case "SHORT_TEXT":
      return key.accepted.join("/");
    default:
      return "-";
  }
}

function solverView(it: BlindItem, answer: ItemAnswer | null): string {
  const c = it.item.content;
  if (c.kind === "MATCHING" && answer?.matches) {
    const byId = Object.fromEntries(Object.entries(it.letterToRightId).map(([letter, id]) => [id, letter]));
    return Object.entries(answer.matches).map(([k, v]) => `${k}=${byId[v] ?? v}`).join(", ");
  }
  return show(answer);
}

/** Items and scored units of one section of a form, by how the solver's answers compare with the key. */
export type SectionTally = { section: Section; items: number; units: number; agreeUnits: number; disagreeUnits: number; unansweredUnits: number };

export type BlindComparison = {
  /** One report entry per item, in the order given. */
  lines: string[];
  agree: number;
  disagree: number;
  unanswered: number;
  /** Per section, in the order the sections first appear. A unit is a point of the course test (courseUnits). */
  sections: SectionTally[];
  /** Keys in the answers file that are not among the items. */
  unknown: string[];
};

/** Compares a solver's answers with the keys, using the engine's own scoring. */
export function compareBlind(items: BlindItem[], raw: RawAnswers): BlindComparison {
  const known = new Set(items.map((i) => i.seedKey));
  const result: BlindComparison = { lines: [], agree: 0, disagree: 0, unanswered: 0, sections: [], unknown: [] };
  const tally = (section: Section): SectionTally => {
    let t = result.sections.find((x) => x.section === section);
    if (!t) {
      t = { section, items: 0, units: 0, agreeUnits: 0, disagreeUnits: 0, unansweredUnits: 0 };
      result.sections.push(t);
    }
    return t;
  };
  for (const it of items) {
    const pairs = raw.get(it.seedKey);
    const answer = toItemAnswer(it.item.content, pairs, it.letterToRightId);
    const label = `${it.seedKey} (${it.item.skillTag})`;
    const t = tally(it.item.section);
    const units = courseUnits(it.item);
    t.items += 1;
    t.units += units;
    if (!answer) {
      result.unanswered++;
      t.unansweredUnits += units;
      result.lines.push(`UNANSWERED  ${label}`);
      continue;
    }
    const s = scoreItem(it.item.type, it.item.content, it.item.key, answer);
    // Scores are fractions of the item; a unit is one gap, statement or row.
    const right = Math.round((s?.score ?? 0) * units);
    t.agreeUnits += right;
    t.disagreeUnits += units - right;
    if (s?.correct) {
      result.agree++;
      result.lines.push(`agree       ${label}`);
    } else {
      result.disagree++;
      const keyView =
        it.item.content.kind === "MATCHING"
          ? Object.entries(it.item.key.kind === "MATCHING" ? it.item.key.pairs : {})
              .map(([k, v]) => `${k}=${Object.entries(it.letterToRightId).find(([, id]) => id === v)?.[0] ?? v}`)
              .join(", ")
          : showKey(it.item.key);
      result.lines.push(`DISAGREE    ${label}  score=${s?.score ?? 0}\n              solver: ${solverView(it, answer)}\n              key:    ${keyView}`);
    }
  }
  for (const k of raw.keys()) if (!known.has(k)) result.unknown.push(k);
  return result;
}

/** "READING: 6 units in 3 items, 5 agree, 1 disagree, 0 unanswered": how one section of a form came out. */
export const formatSectionTally = (t: SectionTally): string =>
  `${t.section}: ${t.units} units in ${t.items} items, ${t.agreeUnits} agree, ${t.disagreeUnits} disagree, ${t.unansweredUnits} unanswered`;
