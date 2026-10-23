import { z } from "zod";
import type { AiMessage } from "@/lib/ai";
import { buildRepairMessages, parseModelJson, withoutEmDash } from "@/lib/ai-json";
import type { DetailQuestion, DetailSection } from "@/components/panel/report/detail-model";
import type { CandidateLocale } from "@/i18n/locale";
import { isFormatTopic, topicLabel, topicOf } from "./topics";
import type { Cefr, Section } from "./types";

/**
 * A short note for the student, drafted by the AI and approved by a teacher.
 * Pure, so it is tested without a key. The AI only proposes: nothing here is
 * shown to a student until a teacher has approved (and possibly rewritten) it,
 * and the AI's own scores never appear in it.
 *
 * What the model gets is a compact summary: levels, x/y per section, the wrong
 * answers grouped by skill tag with one or two short examples, and the
 * teacher's own reason for a writing or speaking level. It gets no passage,
 * transcript, answer text, name or e-mail.
 */

export type FeedbackLocale = CandidateLocale;

export const FEEDBACK_LIMITS = { strengths: 3, improve: 4, topic: 80, why: 300, example: 200, exampleSide: 80, line: 240, nextStep: 300 } as const;

const clean = (s: string) => withoutEmDash(s).replace(/\s+/g, " ").trim();

const stripPunct = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();

/**
 * Collapses a word the model said twice in a row ("die die" -> "die"). When the
 * second word starts with the first and is longer ("ifade ifadelerinin") the
 * longer one is kept. A comma or full stop after the first word means the
 * repeat is deliberate ("was ist, ist"), so it stays. The prefix rule only
 * applies to words of four letters or more, so "in intensiv" is left alone.
 */
export function collapseRepeatedWords(input: string): string {
  const out: string[] = [];
  for (const word of input.split(" ")) {
    const prev = out[out.length - 1];
    if (prev !== undefined && word) {
      const a = stripPunct(prev);
      const b = stripPunct(word);
      const prevEndsClean = /[\p{L}\p{N}]$/u.test(prev);
      if (a && b && prevEndsClean) {
        if (a === b) continue;
        if (a.length >= 4 && b.length > a.length && b.startsWith(a)) {
          out[out.length - 1] = word;
          continue;
        }
      }
    }
    out.push(word);
  }
  return out.join(" ");
}

const text = (max: number) =>
  z
    .string()
    .transform((s) => collapseRepeatedWords(clean(s)))
    .pipe(z.string().min(1).max(max));

/** A German example kept as written: trimmed and without em dashes, but a repeated word may be the student's real mistake. */
const exampleText = (max: number) => z.string().transform(clean).pipe(z.string().max(max));

const exampleParts = z
  .object({ student: exampleText(FEEDBACK_LIMITS.exampleSide), correct: exampleText(FEEDBACK_LIMITS.exampleSide) })
  .transform((e) => (e.student && e.correct ? e : null));

// An example is none (null, missing, or empty parts), a structured pair, or, in notes approved before the
// pair existed, a plain string that is shown as it is.
const exampleSchema = z
  .union([exampleParts, exampleText(FEEDBACK_LIMITS.example), z.null()])
  .optional()
  .transform((v) => (v ? v : undefined));

export const feedbackContentSchema = z.object({
  strengths: z.array(text(FEEDBACK_LIMITS.line)).max(FEEDBACK_LIMITS.strengths),
  improve: z
    .array(z.object({ topic: text(FEEDBACK_LIMITS.topic), why: text(FEEDBACK_LIMITS.why), example: exampleSchema }))
    .max(FEEDBACK_LIMITS.improve),
  nextStep: text(FEEDBACK_LIMITS.nextStep),
});

/** What the student wrote and the right form. A plain string only comes from a note approved before this shape existed. */
export type FeedbackExampleOut = { student: string; correct: string } | string;

export type FeedbackContent = {
  strengths: string[];
  improve: Array<{ topic: string; why: string; example?: FeedbackExampleOut }>;
  nextStep: string;
};

/** What `exam_results.student_feedback` holds. The report reads `approved` only. */
export type StudentFeedbackStore = {
  draft: FeedbackContent | null;
  draftedAt: string | null;
  draftRunId: string | null;
  approved: FeedbackContent | null;
  approvedBy: string | null;
  approvedAt: string | null;
  /** True when the teacher changed the AI draft before approving. */
  edited: boolean;
  locale: FeedbackLocale;
};

export const FEEDBACK_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["strengths", "improve", "nextStep"],
  properties: {
    strengths: { type: "array", description: "At most 3 short things the student did well", items: { type: "string" } },
    improve: {
      type: "array",
      description: "At most 4 topics to work on, most important first",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "why", "example"],
        properties: {
          topic: { type: "string", description: "The grammar or skill topic, named concretely" },
          why: { type: "string", description: "One plain sentence on what went wrong" },
          example: {
            type: "object",
            description: "One real wrong answer from the summary. Both fields are empty strings when there is no such example",
            additionalProperties: false,
            required: ["student", "correct"],
            properties: {
              student: { type: "string", description: "What the student wrote, copied from the summary" },
              correct: { type: "string", description: "The correct form, copied from the summary" },
            },
          },
        },
      },
    },
    nextStep: { type: "string", description: "One concrete thing to practise next" },
  },
};

/** Validates a parsed object; the issues come back as one line for the repair message. */
export function validateFeedback(value: unknown): { ok: true; content: FeedbackContent } | { ok: false; error: string } {
  const parsed = feedbackContentSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
  }
  const d = parsed.data;
  return {
    ok: true,
    content: {
      strengths: d.strengths,
      improve: d.improve.map((i) => ({ topic: i.topic, why: i.why, ...(i.example ? { example: i.example } : {}) })),
      nextStep: d.nextStep,
    },
  };
}

/** A model answer as text: packaging tolerance first, then the schema. Too-long lists are cut, not rejected. */
export function parseFeedbackAnswer(textAnswer: string): { ok: true; content: FeedbackContent } | { ok: false; error: string } {
  const json = parseModelJson(textAnswer);
  if (!json.ok) return { ok: false, error: json.problem };
  const v = json.value;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.strengths)) o.strengths = o.strengths.slice(0, FEEDBACK_LIMITS.strengths);
    if (Array.isArray(o.improve)) o.improve = o.improve.slice(0, FEEDBACK_LIMITS.improve);
  }
  return validateFeedback(v);
}

// ---------------------------------------------------------------------------
// Input summary
// ---------------------------------------------------------------------------

export type FeedbackExample = { context?: string; student: string; correct: string };
/** `wrong` counts unanswered units too; `unanswered` says how many of those were left empty. Examples are answered mistakes only. */
export type FeedbackWeakTag = {
  /** The topic id (`topicOf` of the gap's topic or of the item's tag); old snapshots have no gap topics and use the tag. */
  skillTag: string;
  /** The topic in German for the model; the bare id when the catalog does not know it. */
  label: string;
  /** True for a task format ("Text with gaps"), which is not a topic. */
  format: boolean;
  wrong: number; total: number; unanswered: number; examples: FeedbackExample[] };
export type FeedbackSectionInput =
  | { section: Section; kind: "OBJECTIVE"; level: Cefr | null; correct: number; total: number; weak: FeedbackWeakTag[] }
  | { section: Section; kind: "PRODUCTIVE"; level: Cefr | null; teacherReasons: string[] };

export type FeedbackInput = { overall: Cefr | null; sections: FeedbackSectionInput[] };

const MAX_TAGS_PER_SECTION = 6;
const MAX_EXAMPLES = 2;
const EXAMPLE_MAX = 60;
const REASON_MAX = 300;

const short = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}...` : t;
};

/** One answered unit (a gap, a row, a choice) of a question: its topic id, whether it was left blank, and the mistake as an example. */
type FeedbackUnit = { topic: string; blank: boolean; wrong: FeedbackExample | null };

/**
 * The units of a question. A text-gap unit takes the gap's own topic (`key.topics`, which an old snapshot
 * lacks) and falls back to the item's tag; every other unit takes the item's tag.
 */
function feedbackUnits(q: DetailQuestion): FeedbackUnit[] {
  const itemTopic = topicOf(q.skillTag);
  if (q.kind === "CHOICE") {
    if (q.mark === "blank") return [{ topic: itemTopic, blank: true, wrong: null }];
    return [{ topic: itemTopic, blank: false, wrong: q.mark === "wrong" ? { context: short(q.stem, 80), student: short(q.given, EXAMPLE_MAX), correct: short(q.key, EXAMPLE_MAX) } : null }];
  }
  if (q.kind === "ROWS") {
    return q.rows.map((r) => ({
      topic: itemTopic,
      blank: r.mark === "blank",
      wrong: r.mark === "wrong" ? { context: short(r.label, 80), student: short(r.given, EXAMPLE_MAX), correct: short(r.key, EXAMPLE_MAX) } : null,
    }));
  }
  const units: FeedbackUnit[] = [];
  q.parts.forEach((p, i) => {
    if (p.kind !== "gap") return;
    const topic = topicOf(p.topic ?? q.skillTag);
    if (p.mark === "blank") return void units.push({ topic, blank: true, wrong: null });
    if (p.mark !== "wrong") return void units.push({ topic, blank: false, wrong: null });
    // The words around the gap say what the gap is about; only a few of them.
    const before = q.parts[i - 1];
    const after = q.parts[i + 1];
    const left = before?.kind === "text" ? before.text.trim().split(/\s+/).slice(-3).join(" ") : "";
    const right = after?.kind === "text" ? after.text.trim().split(/\s+/).slice(0, 2).join(" ") : "";
    const context = [left, "___", right].filter(Boolean).join(" ");
    units.push({ topic, blank: false, wrong: { context: short(context, 80), student: short(p.shown, EXAMPLE_MAX), correct: short(p.correct, EXAMPLE_MAX) } });
  });
  return units;
}

/**
 * The compact summary the model sees, from the detail model of the report (so
 * it counts exactly what the report prints: a teacher-accepted answer is right,
 * a question the student never reached is not counted).
 */
export function buildFeedbackInput(overall: string | null | undefined, sections: DetailSection[]): FeedbackInput {
  const out: FeedbackSectionInput[] = [];
  for (const s of sections) {
    if (s.kind === "PRODUCTIVE") {
      const reasons = s.tasks.map((t) => t.teacherNote).filter((x): x is string => !!x).map((x) => short(x, REASON_MAX));
      out.push({ section: s.section, kind: "PRODUCTIVE", level: s.level, teacherReasons: reasons });
      continue;
    }
    const byTag = new Map<string, FeedbackWeakTag>();
    for (const block of s.blocks) {
      for (const q of block.questions) {
        for (const u of feedbackUnits(q)) {
          const tag = byTag.get(u.topic) ?? { skillTag: u.topic, label: topicLabel(u.topic, "de") ?? u.topic, format: isFormatTopic(u.topic), wrong: 0, total: 0, unanswered: 0, examples: [] };
          tag.total += 1;
          if (u.blank) {
            tag.wrong += 1;
            tag.unanswered += 1;
          } else if (u.wrong) {
            tag.wrong += 1;
            if (tag.examples.length < MAX_EXAMPLES) tag.examples.push(u.wrong);
          }
          byTag.set(u.topic, tag);
        }
      }
    }
    const weak = [...byTag.values()]
      .filter((t) => t.wrong > 0)
      // A task format ("Text with gaps") is not a topic to study: it sorts last so it never crowds a real topic out.
      .sort((a, b) => Number(a.format) - Number(b.format) || b.wrong - a.wrong || a.skillTag.localeCompare(b.skillTag))
      .slice(0, MAX_TAGS_PER_SECTION);
    out.push({ section: s.section, kind: "OBJECTIVE", level: s.level, correct: s.correct, total: s.total, weak });
  }
  const level = (["A1", "A2", "B1", "B2", "C1", "C2"] as const).find((l) => l === overall) ?? null;
  return { overall: level, sections: out };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const LANGUAGE_NAME: Record<FeedbackLocale, string> = {
  tr: "Turkish",
  en: "English",
  de: "German",
  es: "Spanish",
  ar: "Arabic",
};

export function buildFeedbackMessages(input: FeedbackInput, locale: FeedbackLocale): AiMessage[] {
  const system = [
    "You write a short feedback note for a student who took a German placement exam. A teacher will read, edit and approve it before the student sees it.",
    "",
    `Write in ${LANGUAGE_NAME[locale]}. Keep German words, phrases and examples in German. Be plain, warm and concrete, like a good teacher speaking to the student ("you"). No flattery, no jargon.`,
    "",
    "Rules:",
    "- Use only the summary you are given. Do not invent mistakes, scores or facts that are not in it.",
    "- Name the grammar or skill topic concretely (for example \"Akkusativ-Artikel (den/einen)\" or \"Konnektoren mit obwohl\"), not a tag such as \"grammar.akkusativ\". Each entry has a German \"label\" for its topic; \"skillTag\" is an id for you, never to be copied.",
    "- An entry with \"format\": true is a task format (for example a text with gaps), not a topic. Never name it as a topic to improve; you may still use its examples when they show a concrete mistake.",
    "- strengths: at most 3, short. Only things the summary supports (a high x/y, a section with a good level, a topic with no mistakes). An empty list is fine when nothing stands out.",
    "- improve: at most 4 topics, most important first, based on the skill tags with the most wrong answers. For each, say in one sentence what went wrong and fill the example field with one real wrong answer from the summary: student is what the student wrote, correct is the right form, both copied from the summary. When a topic has no example in the summary, leave both example fields as empty strings.",
    "- Keep each why to one sentence.",
    "- nextStep: one concrete thing to practise next, in one or two sentences.",
    "- \"unanswered\" counts the questions of a skill tag that the student left empty; they are included in \"wrong\". Never use an unanswered question as an example. If a tag has unanswered questions, you may say the student left some questions blank (in Turkish, for example, \"boş bıraktığın sorular\"), and give no example for a tag that only has blanks.",
    "- For writing and speaking you only get the final level and, sometimes, the teacher's own reason. Do not comment on text or speech you have not seen; you may restate the teacher's reason.",
    "- Never mention scores, probabilities, an AI, or how the exam is scored. Never show a numeric ability estimate. Do not compare the student with others. Do not recommend a course or class.",
    "- Never use the em dash character; use a comma, a colon or a plain hyphen.",
    "- Proofread every sentence once before answering; no repeated words.",
    "",
    "Return one JSON object: { \"strengths\": string[], \"improve\": [{ \"topic\": string, \"why\": string, \"example\": { \"student\": string, \"correct\": string } }], \"nextStep\": string }. No explanation, no code fence.",
  ].join("\n");
  const user = ["Exam summary (JSON):", JSON.stringify(input, null, 1)].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export const buildFeedbackRepairMessages = buildRepairMessages;

// ---------------------------------------------------------------------------
// Teacher form, store and report
// ---------------------------------------------------------------------------

export const FEEDBACK_FORM = { strengthRows: FEEDBACK_LIMITS.strengths, improveRows: FEEDBACK_LIMITS.improve } as const;

/** The teacher's edited fields as content: empty rows are dropped, the same checks as the AI answer apply. */
export function feedbackFromForm(get: (name: string) => string): { ok: true; content: FeedbackContent } | { ok: false; error: string } {
  const strengths: string[] = [];
  for (let i = 0; i < FEEDBACK_FORM.strengthRows; i++) {
    const v = clean(get(`strength${i}`));
    if (v) strengths.push(v);
  }
  const improve: Array<{ topic: string; why: string; example: { student: string; correct: string } }> = [];
  for (let i = 0; i < FEEDBACK_FORM.improveRows; i++) {
    const topic = clean(get(`topic${i}`));
    const why = clean(get(`why${i}`));
    const example = { student: clean(get(`exampleStudent${i}`)), correct: clean(get(`exampleCorrect${i}`)) };
    if (topic || why || example.student || example.correct) improve.push({ topic, why, example });
  }
  return validateFeedback({ strengths, improve, nextStep: get("nextStep") });
}

const same = (a: FeedbackContent, b: FeedbackContent) => JSON.stringify(a) === JSON.stringify(b);

/** The store after a teacher approved `content`; `edited` compares with the draft it came from. */
export function approveFeedback(prev: StudentFeedbackStore | null, content: FeedbackContent, userId: string, now: Date, locale: FeedbackLocale): StudentFeedbackStore {
  return {
    draft: null,
    draftedAt: prev?.draftedAt ?? null,
    draftRunId: prev?.draftRunId ?? null,
    approved: content,
    approvedBy: userId,
    approvedAt: now.toISOString(),
    edited: prev?.draft ? !same(prev.draft, content) : true,
    locale: prev?.locale ?? locale,
  };
}

/**
 * What a student-facing report may print: the approved text, never a draft.
 * The stored value is checked again, so a row written by hand cannot put
 * anything unapproved or malformed on the sheet.
 */
export function approvedFeedback(store: StudentFeedbackStore | null | undefined): FeedbackContent | null {
  if (!store?.approved || !store.approvedAt || !store.approvedBy) return null;
  const v = validateFeedback(store.approved);
  if (!v.ok) return null;
  const c = v.content;
  return c.strengths.length || c.improve.length ? c : null;
}
