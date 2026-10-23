import { itemTally } from "@/components/panel/result/answer-tally";
import { gapOptions, pickedTextKind, type GapOption, type PickedTextKind } from "@/components/panel/result/review-cards";
import { responseState, reviewRows, type ReviewMark } from "@/components/panel/result/review-rows";
import { withPoolInstruction } from "@/lib/exam/ctest-instruction";
import { isFormatTopic, topicLabel, topicOf, type TopicId } from "@/lib/exam/topics";
import { isResultLevel } from "@/lib/exam/cefr";
import { isCTest, isObjectiveSection, type Cefr, type ItemAnswer, type ItemSnapshot, type ResultLevel, type Section } from "@/lib/exam/types";

/**
 * The detailed part of the printable report, as data: every question the
 * student was served, what they answered and what the key says, so the school
 * can show exactly what was wrong. Pure: the page loads the rows (org-scoped,
 * the same loaders as the result page), this decides what the sheet may print.
 *
 * What is deliberately left out: the reading passages and the listening
 * transcripts (only their titles), the AI's raw scores and rationale unless the
 * teacher adopted them, and anything about integrity or proctoring.
 */

export type DetailMark = ReviewMark;

/** One part of a gap text. `prefix` is the kept start of a C-test word ("Ha" of "Haus"). */
export type GapPart =
  | { kind: "text"; text: string }
  | {
      kind: "gap";
      n: number;
      prefix: string;
      /** What the student wrote, as typed ("" when empty). */
      given: string;
      /** The whole word the student produced (prefix + fill), "" when empty. */
      shown: string;
      /** The whole correct word, or the accepted spellings joined by " / " when the gap is not part of a word. */
      correct: string;
      mark: DetailMark;
      /** The gap's topic id from the key (`key.topics`), null for an old snapshot or a text without gap topics. */
      topic: string | null;
      /** MC cloze only: the four words with the student's pick and the key marked. Empty for every other gap. */
      options: GapOption[];
    };

export type DetailRow = { label: string; given: string; key: string; mark: DetailMark };

export type DetailQuestion =
  | { kind: "GAP"; n: number; level: Cefr; skillTag: string; cTest: boolean; /** MC cloze or word bank: gaps are picked words, listed gap by gap in the sheet. */ textKind: PickedTextKind | null; parts: GapPart[] }
  | { kind: "CHOICE"; n: number; level: Cefr; skillTag: string; stem: string; given: string; key: string; mark: DetailMark }
  | { kind: "ROWS"; n: number; level: Cefr; skillTag: string; variant: "TFNG" | "MATCHING"; stem: string; rows: DetailRow[] };

export type DetailBlock = {
  /** Title of the reading text or the recording the questions belong to; null for stand-alone items. */
  heading: string | null;
  questions: DetailQuestion[];
};

export type TeacherCriterion = { criterion: string; level: string; note: string | null };

export type DetailTask = {
  n: number;
  prompt: string;
  /** The student's text: the writing answer, or a speaking answer typed in place of a recording. */
  text: string | null;
  typedInstead: boolean;
  /** Speaking: the transcript of the recording, when one was made. */
  transcript: string | null;
  words: number | null;
  /** The level the teacher decided; null when no decision is stored. */
  level: string | null;
  decidedBy: string | null;
  /** The teacher's own words: the reason given when the level was changed. */
  teacherNote: string | null;
  /** Only when the teacher confirmed the proposal (so adopted it), or changed single criteria. */
  criteria: TeacherCriterion[];
  summary: string | null;
};

/** Right answers out of all answers asked for one topic; `format` marks a task format ("Text with gaps"), not a topic. */
export type TopicTally = { topic: TopicId; label: string; format: boolean; right: number; total: number };

export type DetailSection =
  | { section: Section; kind: "OBJECTIVE"; level: ResultLevel | null; correct: number; total: number; hasTfng: boolean; blocks: DetailBlock[]; topics: TopicTally[] }
  | { section: Section; kind: "PRODUCTIVE"; level: ResultLevel | null; tasks: DetailTask[] };

export type DetailResponse = {
  id: string;
  sectionRunId: string;
  sequence: number;
  itemSnapshot: ItemSnapshot;
  answer: ItemAnswer | null;
  score: number | null;
  notReached: boolean;
};

export type DetailGrading = {
  itemResponseId: string;
  status: string;
  finalLevel: string | null;
  finalCriteria: Record<string, string> | null;
  reason: string | null;
  decidedBy: string | null;
  aiProposal: { criteria: Array<{ criterion: string; level: string; assessable: boolean; rationale: string }>; summary: string } | null;
};

export type DetailSource = {
  sections: string[];
  /** Final skill levels by section. */
  skillLevels: Record<string, string | null | undefined>;
  runs: Array<{ id: string; section: string; navigable: boolean }>;
  responses: DetailResponse[];
  gradings: DetailGrading[];
  /** Teacher acceptances by response id (`gapIds` empty: the whole short answer). */
  acceptances: Record<string, { gapIds: string[] }>;
  /** Transcript text by media asset id. */
  transcripts: Record<string, string>;
  nameOf: Record<string, string>;
};

/** A section's final level: A0 (Pre-A1) to C2. */
const asLevel = (v: string | null | undefined): ResultLevel | null => (isResultLevel(v) ? v : null);
const STEM_MAX = 220;

const squash = (s: string) => s.replace(/\{\{[^}]+\}\}/g, "___").replace(/\s+/g, " ").trim();
const stemOf = (s: string) => {
  const t = squash(s);
  return t.length > STEM_MAX ? `${t.slice(0, STEM_MAX - 1).trimEnd()}...` : t;
};

const wordsIn = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * The gap text with the student's fills in it. A C-test gap sits right after
 * the kept start of a word ("Ha{{g1}}"), and the student may type the missing
 * letters or the whole word; both are shown as the whole word. A gap that
 * follows a space (a plain gap item) is shown as typed.
 */
export function gapParts(s: ItemSnapshot, a: ItemAnswer | null, acceptedGaps: readonly string[]): GapPart[] | null {
  const rows = reviewRows(s, a, acceptedGaps);
  if (!rows || rows.variant !== "GAP" || s.key.kind !== "GAP") return null;
  const key = s.key;
  const prompt = isCTest(s) ? withPoolInstruction(s.prompt) : s.prompt;
  const textKind = pickedTextKind(s);
  const choicesOf = (id: string) => (s.content.kind === "GAP" ? s.content.gaps.find((g) => g.id === id)?.choices : undefined);
  const byId = new Map(rows.rows.map((r) => [r.id, r]));
  const parts: GapPart[] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let pos = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt))) {
    const row = byId.get(m[1]);
    let before = prompt.slice(pos, m.index);
    pos = m.index + m[0].length;
    if (!row) {
      parts.push({ kind: "text", text: before });
      continue;
    }
    n += 1;
    const prefix = /[^\s]*$/u.exec(before)?.[0] ?? "";
    // Only a word start counts as a prefix: it has to be letters ("Ha"), not "(" or a number.
    // A cloze or word-bank gap is a whole empty slot, never the end of a word.
    const isWordStart = !textKind && prefix.length > 0 && /^[\p{L}]+$/u.test(prefix);
    const kept = isWordStart ? prefix : "";
    if (kept) before = before.slice(0, before.length - kept.length);
    if (before) parts.push({ kind: "text", text: before });
    const accepted = key.answers[m[1]] ?? [];
    const given = (row.given ?? "").trim();
    let shown = given;
    let correct = accepted.join(" / ");
    if (kept) {
      const lower = kept.toLocaleLowerCase("de-DE");
      const whole = given.toLocaleLowerCase("de-DE").startsWith(lower) && given.length > kept.length;
      shown = given ? (whole ? given : kept + given) : "";
      const fulls = accepted.filter((x) => x.toLocaleLowerCase("de-DE").startsWith(lower)).sort((x, y) => y.length - x.length);
      correct = fulls[0] ?? kept + (accepted[0] ?? "");
    }
    const options = textKind === "CLOZE" ? gapOptions(choicesOf(m[1]), given, accepted) : [];
    parts.push({ kind: "gap", n, prefix: kept, given, shown, correct, mark: row.mark, topic: key.topics?.[m[1]] ?? null, options });
  }
  const rest = prompt.slice(pos);
  if (rest) parts.push({ kind: "text", text: rest });
  return parts;
}

/** One answered unit (a gap, a row, a choice) with its topic: the gap's own topic, else the item's tag. */
export type TopicUnit = { topic: TopicId; mark: DetailMark };

export function topicUnits(q: DetailQuestion): TopicUnit[] {
  if (q.kind === "CHOICE") return [{ topic: topicOf(q.skillTag), mark: q.mark }];
  if (q.kind === "ROWS") return q.rows.map((r) => ({ topic: topicOf(q.skillTag), mark: r.mark }));
  return q.parts.flatMap((p) => (p.kind === "gap" ? [{ topic: topicOf(p.topic ?? q.skillTag), mark: p.mark }] : []));
}

/** Right / total per topic over the questions of a section, most missed first. */
export function topicTallies(blocks: DetailBlock[]): TopicTally[] {
  const by = new Map<TopicId, TopicTally>();
  for (const b of blocks) {
    for (const q of b.questions) {
      for (const u of topicUnits(q)) {
        const t = by.get(u.topic) ?? { topic: u.topic, label: topicLabel(u.topic, "de") ?? u.topic, format: isFormatTopic(u.topic), right: 0, total: 0 };
        t.total += 1;
        if (u.mark === "correct" || u.mark === "accepted") t.right += 1;
        by.set(u.topic, t);
      }
    }
  }
  return [...by.values()].sort((a, b) => b.total - b.right - (a.total - a.right) || a.topic.localeCompare(b.topic));
}

type Counted = { question: DetailQuestion; correct: number; total: number };

function objectiveQuestion(r: DetailResponse, n: number, acceptedGaps: readonly string[], wholeAccepted: boolean): Counted | null {
  const s = r.itemSnapshot;
  const a = r.answer;
  const rows = reviewRows(s, a, acceptedGaps);
  // The one answer tally (answer-tally.ts) so the report agrees with the result screen.
  const tally = itemTally(r, wholeAccepted ? { gapIds: [] } : acceptedGaps.length ? { gapIds: [...acceptedGaps] } : undefined) ?? { correct: 0, total: 0 };
  if (rows && rows.variant === "GAP") {
    const parts = gapParts(s, a, acceptedGaps);
    if (!parts) return null;
    return {
      question: { kind: "GAP", n, level: s.level, skillTag: s.skillTag, cTest: s.skillTag === "grammar.ctest", textKind: pickedTextKind(s), parts },
      ...tally,
    };
  }
  if (rows) {
    return {
      question: {
        kind: "ROWS",
        n,
        level: s.level,
        skillTag: s.skillTag,
        variant: rows.variant === "TFNG" ? "TFNG" : "MATCHING",
        stem: stemOf(s.prompt),
        rows: rows.rows.map((x) => ({ label: squash(x.label), given: x.given, key: x.key, mark: x.mark })),
      },
      ...tally,
    };
  }
  const c = s.content;
  const k = s.key;
  let given = "";
  let key = "";
  if (c.kind === "CHOICE" && k.kind === "CHOICE") {
    given = (a?.choiceIds ?? []).map((id) => c.options.find((o) => o.id === id)?.text ?? id).join(", ");
    key = k.correct.map((id) => c.options.find((o) => o.id === id)?.text ?? id).join(", ");
  } else if (c.kind === "SHORT_TEXT" && k.kind === "SHORT_TEXT") {
    given = (a?.text ?? "").trim();
    key = k.accepted.join(" / ");
  } else return null;
  const full = (r.score ?? 0) >= 1;
  const mark: DetailMark = !given ? "blank" : wholeAccepted ? "accepted" : full ? "correct" : "wrong";
  return {
    question: { kind: "CHOICE", n, level: s.level, skillTag: s.skillTag, stem: stemOf(s.prompt), given, key, mark },
    ...tally,
  };
}

function objectiveSection(src: DetailSource, section: Section, runId: string | undefined, navigable: boolean): DetailSection {
  const responses = src.responses.filter((r) => r.sectionRunId === runId).sort((a, b) => a.sequence - b.sequence);
  const blocks: DetailBlock[] = [];
  let lastStimulus: string | null | undefined;
  let correct = 0;
  let total = 0;
  let n = 0;
  let hasTfng = false;
  for (const r of responses) {
    // An item the student never reached was not part of what they were asked.
    if (responseState(r, { navigable }) === "NOT_REACHED") continue;
    const acc = src.acceptances[r.id];
    const counted = objectiveQuestion(r, n + 1, acc?.gapIds ?? [], !!acc && acc.gapIds.length === 0);
    if (!counted) continue;
    n += 1;
    correct += counted.correct;
    total += counted.total;
    if (counted.question.kind === "ROWS" && counted.question.variant === "TFNG") hasTfng = true;
    const stimulusId = r.itemSnapshot.stimulusId;
    const heading = r.itemSnapshot.stimulus?.title ?? null;
    if (!blocks.length || stimulusId !== lastStimulus || !stimulusId) blocks.push({ heading, questions: [] });
    lastStimulus = stimulusId;
    blocks[blocks.length - 1].questions.push(counted.question);
  }
  return { section, kind: "OBJECTIVE", level: asLevel(src.skillLevels[section]), correct, total, hasTfng, blocks, topics: topicTallies(blocks) };
}

function productiveSection(src: DetailSource, section: Section, runId: string | undefined): DetailSection {
  const responses = src.responses.filter((r) => r.sectionRunId === runId).sort((a, b) => a.sequence - b.sequence);
  const tasks: DetailTask[] = responses.map((r, i) => {
    const g = src.gradings.find((x) => x.itemResponseId === r.id);
    const decided = g?.status === "CONFIRMED" || g?.status === "OVERRIDDEN";
    const text = r.answer?.text?.trim() ? r.answer.text : null;
    const mediaId = r.answer?.mediaAssetId;
    const transcript = section === "SPEAKING" && mediaId ? (src.transcripts[mediaId]?.trim() || null) : null;
    const criteria: TeacherCriterion[] = [];
    if (decided && g?.aiProposal) {
      for (const c of g.aiProposal.criteria) {
        if (!c.assessable) continue;
        // A per-criterion level the teacher set wins; the AI's wording is only kept when the teacher confirmed the proposal.
        const own = g.finalCriteria?.[c.criterion];
        if (g.status === "CONFIRMED") criteria.push({ criterion: c.criterion, level: own ?? c.level, note: c.rationale || null });
        else if (own) criteria.push({ criterion: c.criterion, level: own, note: null });
      }
    } else if (decided && g?.finalCriteria) {
      for (const [criterion, level] of Object.entries(g.finalCriteria)) criteria.push({ criterion, level, note: null });
    }
    return {
      n: i + 1,
      prompt: r.itemSnapshot.prompt.trim(),
      text,
      typedInstead: !!r.answer?.usedTextAlternative,
      transcript,
      words: text ? wordsIn(text) : null,
      level: decided ? (g?.finalLevel ?? null) : null,
      decidedBy: decided && g?.decidedBy ? (src.nameOf[g.decidedBy] ?? null) : null,
      teacherNote: g?.status === "OVERRIDDEN" && g.reason?.trim() ? g.reason.trim() : null,
      criteria,
      summary: g?.status === "CONFIRMED" && g.aiProposal?.summary ? g.aiProposal.summary : null,
    };
  });
  return { section, kind: "PRODUCTIVE", level: asLevel(src.skillLevels[section]), tasks };
}

/** The detailed sections in exam order. Skips a section that has no run (nothing was served). */
export function buildDetail(src: DetailSource): DetailSection[] {
  const out: DetailSection[] = [];
  for (const name of src.sections) {
    const section = name as Section;
    const run = src.runs.find((r) => r.section === name);
    if (!run) continue;
    const d = isObjectiveSection(section) ? objectiveSection(src, section, run.id, run.navigable) : productiveSection(src, section, run.id);
    if (d.kind === "OBJECTIVE" ? d.blocks.length === 0 : d.tasks.length === 0) continue;
    out.push(d);
  }
  return out;
}
