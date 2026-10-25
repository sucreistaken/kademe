/**
 * Which task formats the starter bank has per level and section, and how many different
 * formats and task patterns a first-time student meets in one form of the placement test and
 * of the level check (offline, no database). Prints Markdown for docs/research/formats-*.md.
 *
 *   pnpm exam:format-inventory          (FORMS=300 by default)
 *
 * "format" is the engine's item format (item-format.ts: what form drawing mixes). "pattern" is
 * finer and for people: the task as an ÖSD / telc / TestDaF candidate would name it (headline
 * matching, note taking, who-says-what ...). It is worked out here from the item type, the
 * content shape and the prompt, and is only used for this report.
 */
import { SEED_BANK } from "@/db/seed-bank";
import type { SeedItem } from "@/db/seed-bank/types";
import { mulberry32 } from "@/lib/exam/adaptive";
import { enabledSections } from "@/lib/exam/blueprint";
import { drawExamForm, seedPool, type DrawnSection } from "@/lib/exam/seed-forms";
import { EXAM_TEMPLATES } from "@/lib/exam/templates";
import { CEFR_LEVELS, textGapKindOf, type Cefr, type Section } from "@/lib/exam/types";

const FORMS = Number(process.env.FORMS ?? 300);
const SECTIONS: Section[] = ["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"];

const LETTER_START = /^(Liebe[rs]?|Sehr geehrte|Hallo|Guten Tag)\b/;

const stimulusByKey = new Map(SEED_BANK.stimuli.map((x) => [x.key, x]));
const wordsOf = (text: string) => text.replace(/^[^:\n]{1,40}:/gm, "").split(/\s+/).filter(Boolean).length;

/** A listening clip that is one short announcement or message: at most two voices, at most 110 words spoken. */
function isShortAnnouncement(item: SeedItem): boolean {
  const st = item.stimulusKey ? stimulusByKey.get(item.stimulusKey) : undefined;
  return !!st && st.section === "LISTENING" && (st.speakers?.length ?? 0) <= 2 && wordsOf(st.body) <= 110;
}

/** The task pattern of a seed item, for people. */
export function patternOf(item: SeedItem): string {
  const c = item.content;
  const tag = item.skillTag;
  if (item.section === "GRAMMAR") {
    const kind = textGapKindOf(item);
    if (kind) {
      const body = item.prompt.split("\n\n").slice(2).join("\n\n").trim();
      return kind === "CTEST" ? "text: C-Test" : `text: ${kind.toLowerCase()}${LETTER_START.test(body) ? " (letter)" : ""}`;
    }
    if (c.kind === "GAP") return c.gaps.some((g) => g.choices) ? "single gap: select" : "single gap: typed";
    return "single sentence: multiple choice";
  }
  if (item.section === "WRITING" || item.section === "SPEAKING") return tag.replace(/^(writing|speaking)\./, "");
  const p = item.prompt;
  switch (c.kind) {
    case "TFNG":
      if (c.wording === "JA_NEIN" && /Kommentare/.test(p)) return "yes/no: for or against (comments)";
      return `${c.wording === "JA_NEIN" ? "yes/no" : "true/false"}${c.twoWay ? "" : "/not given"}`;
    case "MATCHING": {
      if (c.right.some((r) => r.image)) return "matching: picture";
      if (/Überschrift/.test(p)) return "matching: headlines";
      if (/Lücke|fehlen|Absatz|Absätze/.test(p)) return "matching: insertion";
      if (/Anzeige|Kurs|Angebot|Stelle/.test(p)) return "matching: situation to advert";
      return "matching: who says what";
    }
    case "GAP":
      if (item.section === "LISTENING" && /Richtig ist/.test(p)) return "correct the printed details (typed table)";
      return item.section === "LISTENING" ? "note taking (typed gaps)" : "form completion (typed gaps)";
    case "SHORT_TEXT":
      return "note taking (short answer)";
    case "CHOICE": {
      if (c.pick !== undefined) return "tick n";
      if (c.options.some((o) => o.image)) return "picture choice";
      if (/Lücke \(\d\)/.test(p)) return "reading cloze (choice)";
      return "multiple choice";
    }
    default:
      return item.type;
  }
}

/** The patterns an item counts under: its own, and for a short listening clip also "short announcement (clip)". */
export function patternsOf(item: SeedItem): string[] {
  const own = patternOf(item);
  return item.section === "LISTENING" && isShortAnnouncement(item) ? [own, "clip: short announcement"] : [own];
}

const pool = seedPool();
const byId = new Map(pool.map((p) => [p.id, p]));
const out: string[] = [];
const pct = (x: number) => `${Math.round(100 * x)}%`;

// ---- A. The bank: items per pattern and level, texts and clips per level.
out.push(`## A. Bank (${SEED_BANK.items.length} items, ${SEED_BANK.stimuli.length} texts and clips)`, "");
for (const section of SECTIONS) {
  const items = SEED_BANK.items.filter((i) => i.section === section);
  const patterns = [...new Set(items.flatMap(patternsOf))].sort();
  out.push(`### ${section}`, "", `| pattern | ${CEFR_LEVELS.join(" | ")} |`, `|---|${CEFR_LEVELS.map(() => "---").join("|")}|`);
  for (const p of patterns) {
    out.push(`| ${p} | ${CEFR_LEVELS.map((l) => items.filter((i) => i.level === l && patternsOf(i).includes(p)).length || "").join(" | ")} |`);
  }
  out.push(`| **items** | ${CEFR_LEVELS.map((l) => items.filter((i) => i.level === l).length).join(" | ")} |`);
  if (section === "READING" || section === "LISTENING") {
    out.push(`| **${section === "READING" ? "texts" : "clips"}** | ${CEFR_LEVELS.map((l) => SEED_BANK.stimuli.filter((s) => s.section === section && s.level === l).length).join(" | ")} |`);
  }
  out.push("");
}

// ---- B. One first-time form: distinct formats and patterns, and how often each pattern shows.
type Ctx = { label: string; claimed: Cefr | null; provisional: Cefr };
const rows: string[] = [];
const freq: string[] = [];
for (const t of EXAM_TEMPLATES.filter((x) => x.key !== "quick-screen")) {
  const contexts: Ctx[] =
    t.mode === "LEVEL_VERIFICATION"
      ? CEFR_LEVELS.map((l) => ({ label: l, claimed: l, provisional: l }))
      : CEFR_LEVELS.map((l) => ({ label: l, claimed: null, provisional: l }));
  const placementSeen = new Set<string>();
  for (const ctx of contexts) {
    const formatSum = new Map<Section, number>();
    const patternSum = new Map<Section, number>();
    const patternForms = new Map<string, Map<string, number>>();
    for (let s = 1; s <= FORMS; s++) {
      const form: DrawnSection[] = drawExamForm(t.config, t.mode, ctx.claimed, ctx.provisional, pool, mulberry32(s * 7919 + 13), undefined);
      for (const f of form) {
        const items = f.itemIds.map((id) => byId.get(id)!);
        formatSum.set(f.section, (formatSum.get(f.section) ?? 0) + new Set(items.map((i) => i.format)).size);
        const pats = new Set(items.flatMap((i) => patternsOf(i.seed)));
        patternSum.set(f.section, (patternSum.get(f.section) ?? 0) + pats.size);
        const per = patternForms.get(f.section) ?? new Map<string, number>();
        for (const p of pats) per.set(p, (per.get(p) ?? 0) + 1);
        patternForms.set(f.section, per);
      }
    }
    const secs = enabledSections(t.config).map((x) => x.section);
    const cell = (sec: Section) => (secs.includes(sec) ? `${((formatSum.get(sec) ?? 0) / FORMS).toFixed(1)} / ${((patternSum.get(sec) ?? 0) / FORMS).toFixed(1)}` : "");
    rows.push(`| ${t.key} | ${ctx.label} | ${SECTIONS.map(cell).join(" | ")} |`);
    for (const sec of secs) {
      // Placement grammar, reading and listening do not depend on the provisional level: print once.
      if (t.mode === "PLACEMENT" && sec !== "WRITING" && sec !== "SPEAKING") {
        if (placementSeen.has(sec)) continue;
        placementSeen.add(sec);
      }
      const per = patternForms.get(sec) ?? new Map<string, number>();
      const list = [...per.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${pct(n / FORMS)}`);
      freq.push(`| ${t.key} | ${t.mode === "PLACEMENT" && sec !== "WRITING" && sec !== "SPEAKING" ? "*" : ctx.label} | ${sec} | ${list.join("; ")} |`);
    }
  }
}
out.push(
  `## B. One first-time form (${FORMS} draws per row): distinct item formats / distinct task patterns`,
  "",
  `| template | context | ${SECTIONS.join(" | ")} |`,
  `|---|---|${SECTIONS.map(() => "---").join("|")}|`,
  ...rows,
  "",
  "Context: the claimed level (level check) or the provisional level that places writing and speaking (placement).",
  "",
  `## C. Share of first-time forms that contain each task pattern`,
  "",
  "| template | context | section | patterns (share of forms) |",
  "|---|---|---|---|",
  ...freq,
  "",
);
console.log(out.join("\n"));
