/**
 * How long the template forms are, measured offline on the starter bank: for
 * each template and level, STUDENTS returning students take three forms in a
 * row (each form avoids what the earlier ones served, as in the exam), and
 * every section of every form is counted:
 *   items   items served (a cloze text or word bank is one item)
 *   scored  scored parts: a gap, a true/false statement, a matching line, a
 *           choice question, a writing or speaking task
 *   read    words on screen: instructions, texts, options, statements, the
 *           word-bank pool, the points a task asks for
 *   heard   words of the listening scripts (listening only)
 * as p50 / p95 next to the section's minutes in the template. Placement
 * grammar, reading and listening do not depend on the provisional level, so
 * they print once ("*"); writing and speaking print per provisional level.
 * The level check prints per claimed level. No database, no template change.
 * Run: pnpm exam:form-timing   (STUDENTS=20 for a quick look)
 */
import { SEED_BANK } from "@/db/seed-bank";
import { mulberry32 } from "@/lib/exam/adaptive";
import { enabledSections } from "@/lib/exam/blueprint";
import { drawExamForm, seedPool, servedIn, type DrawnSection, type SeedPoolItem } from "@/lib/exam/seed-forms";
import { EXAM_TEMPLATES } from "@/lib/exam/templates";
import { CEFR_LEVELS, isObjectiveSection, WORD_BANK_SKILL_TAG, wordBankWords, type Cefr, type Section } from "@/lib/exam/types";

const STUDENTS = Number(process.env.STUDENTS ?? 100);
const FORMS = 3;

const pool = seedPool();
const byId = new Map(pool.map((p) => [p.id, p]));
const stimulusByKey = new Map(SEED_BANK.stimuli.map((s) => [s.key, s]));

/** Words with a letter or digit; gap markers ({{g1}}) and list dashes do not count. */
const words = (text: string): number => text.replace(/\{\{[^}]*\}\}/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const wordsIn = (texts: string[]): number => texts.reduce((n, t) => n + words(t), 0);

function readWords(item: SeedPoolItem): number {
  const { prompt, content, key, rubric } = item.seed;
  let n = words(prompt) + wordsIn(rubric?.studentPoints ?? []);
  switch (content.kind) {
    case "CHOICE":
      n += wordsIn(content.options.map((o) => o.text));
      break;
    case "TFNG":
      n += wordsIn(content.statements.map((s) => s.text));
      break;
    case "MATCHING":
      n += wordsIn([...content.left, ...content.right].map((x) => x.text));
      break;
    case "GAP": {
      n += wordsIn(content.gaps.flatMap((g) => g.choices ?? []));
      // A word bank shows its pool: the answers and the distractors.
      if (item.skillTag === WORD_BANK_SKILL_TAG && key.kind === "GAP")
        n += wordsIn(wordBankWords(content.gaps.map((g) => g.id), key.answers, key.distractors));
      break;
    }
  }
  return n;
}

function scoredParts(item: SeedPoolItem): number {
  const c = item.seed.content;
  if (c.kind === "GAP") return c.gaps.length;
  if (c.kind === "TFNG") return c.statements.length;
  if (c.kind === "MATCHING") return c.left.length;
  return 1;
}

type Measure = { items: number; scored: number; read: number; heard: number };

function measure(itemIds: string[]): Measure {
  const items = itemIds.map((id) => byId.get(id)!);
  const m: Measure = { items: items.length, scored: 0, read: 0, heard: 0 };
  const stimuli = new Set<string>();
  for (const item of items) {
    m.scored += scoredParts(item);
    m.read += readWords(item);
    if (item.stimulusId && !stimuli.has(item.stimulusId)) {
      stimuli.add(item.stimulusId);
      const st = stimulusByKey.get(item.stimulusId)!;
      m.read += words(st.title);
      // Listening: the script is heard, never shown. Speaker labels ("Anna:") are not spoken.
      if (st.section === "LISTENING") m.heard += words(st.body.replace(/^[^:\n]{1,40}:/gm, ""));
      else m.read += words(st.body);
    }
  }
  return m;
}

/** Nearest-rank percentile. */
function pct(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}
const pp = (xs: number[]) => `${pct(xs, 50)} / ${pct(xs, 95)}`.padEnd(11);

console.log(`Form timing on the starter bank: ${STUDENTS} returning students x ${FORMS} forms per row, p50 / p95.`);
console.log(`${"template".padEnd(13)}${"ctx".padEnd(4)}${"section".padEnd(10)}${"min".padStart(4)}  ${"items".padEnd(11)}${"scored".padEnd(11)}${"read".padEnd(11)}heard`);
for (const t of EXAM_TEMPLATES) {
  const contexts: Array<{ label: string; claimed: Cefr | null; provisional: Cefr }> =
    t.mode === "LEVEL_VERIFICATION"
      ? CEFR_LEVELS.map((claimed) => ({ label: claimed, claimed, provisional: claimed }))
      : CEFR_LEVELS.map((provisional) => ({ label: provisional, claimed: null, provisional }));
  const printed = new Set<string>();
  for (const ctx of contexts) {
    const samples = new Map<Section, Measure[]>();
    for (let s = 1; s <= STUDENTS; s++) {
      const forms: DrawnSection[][] = [];
      for (let n = 0; n < FORMS; n++) {
        const form = drawExamForm(t.config, t.mode, ctx.claimed, ctx.provisional, pool, mulberry32(s * 100 + n), servedIn(forms, pool));
        for (const f of form) samples.set(f.section, [...(samples.get(f.section) ?? []), measure(f.itemIds)]);
        forms.push(form);
      }
    }
    for (const sec of enabledSections(t.config)) {
      const label = t.mode === "PLACEMENT" && isObjectiveSection(sec.section) ? "*" : ctx.label;
      const rowKey = `${sec.section} ${label}`;
      if (printed.has(rowKey)) continue;
      printed.add(rowKey);
      const ms = samples.get(sec.section) ?? [];
      const heard = sec.section === "LISTENING" ? pp(ms.map((m) => m.heard)) : "";
      console.log(
        `${t.key.padEnd(13)}${label.padEnd(4)}${sec.section.padEnd(10)}${String(sec.durationMinutes).padStart(4)}  ${pp(ms.map((m) => m.items))}${pp(ms.map((m) => m.scored))}${pp(ms.map((m) => m.read))}${heard}`.trimEnd(),
      );
    }
  }
}
