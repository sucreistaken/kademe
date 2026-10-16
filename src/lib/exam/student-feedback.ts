import { z } from "zod";
import type { AiMessage } from "@/lib/ai";
import { buildRepairMessages, parseModelJson, withoutEmDash } from "@/lib/ai-json";
import type { DetailQuestion, DetailSection } from "@/components/panel/report/detail-model";
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

export type FeedbackLocale = "tr" | "en";

export const FEEDBACK_LIMITS = { strengths: 3, improve: 4, topic: 80, why: 300, example: 200, line: 240, nextStep: 300 } as const;

const clean = (s: string) => withoutEmDash(s).replace(/\s+/g, " ").trim();
const text = (max: number) => z.string().transform(clean).pipe(z.string().min(1).max(max));
// An empty example means "none"; the wire schema asks for the field so every provider accepts it.
const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => clean(v ?? ""))
    .pipe(z.string().max(max))
    .transform((v) => (v ? v : undefined));

export const feedbackContentSchema = z.object({
  strengths: z.array(text(FEEDBACK_LIMITS.line)).max(FEEDBACK_LIMITS.strengths),
  improve: z
    .array(z.object({ topic: text(FEEDBACK_LIMITS.topic), why: text(FEEDBACK_LIMITS.why), example: optionalText(FEEDBACK_LIMITS.example) }))
    .max(FEEDBACK_LIMITS.improve),
  nextStep: text(FEEDBACK_LIMITS.nextStep),
});

export type FeedbackContent = {
  strengths: string[];
  improve: Array<{ topic: string; why: string; example?: string }>;
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
          why: { type: "string", description: "One or two plain sentences on what went wrong" },
          example: { type: "string", description: "One short example from the summary (student answer and correct form), or an empty string" },
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
export type FeedbackWeakTag = { skillTag: string; wrong: number; total: number; examples: FeedbackExample[] };
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
const BLANK = "(blank)";

/** One wrong unit (a gap, a row, a choice) of a question, with the little context the example needs. */
function wrongUnits(q: DetailQuestion): { total: number; wrong: FeedbackExample[] } {
  if (q.kind === "CHOICE") {
    const bad = q.mark === "wrong" || q.mark === "blank";
    return { total: 1, wrong: bad ? [{ context: short(q.stem, 80), student: short(q.given || BLANK, EXAMPLE_MAX), correct: short(q.key, EXAMPLE_MAX) }] : [] };
  }
  if (q.kind === "ROWS") {
    return {
      total: q.rows.length,
      wrong: q.rows
        .filter((r) => r.mark === "wrong" || r.mark === "blank")
        .map((r) => ({ context: short(r.label, 80), student: short(r.given || BLANK, EXAMPLE_MAX), correct: short(r.key, EXAMPLE_MAX) })),
    };
  }
  const gaps = q.parts.flatMap((p, i) => (p.kind === "gap" ? [{ p, i }] : []));
  return {
    total: gaps.length,
    wrong: gaps
      .filter(({ p }) => p.kind === "gap" && (p.mark === "wrong" || p.mark === "blank"))
      .map(({ p, i }) => {
        if (p.kind !== "gap") throw new Error("unreachable");
        // The words around the gap say what the gap is about; only a few of them.
        const before = q.parts[i - 1];
        const after = q.parts[i + 1];
        const left = before?.kind === "text" ? before.text.trim().split(/\s+/).slice(-3).join(" ") : "";
        const right = after?.kind === "text" ? after.text.trim().split(/\s+/).slice(0, 2).join(" ") : "";
        const context = [left, "___", right].filter(Boolean).join(" ");
        return { context: short(context, 80), student: short(p.shown || BLANK, EXAMPLE_MAX), correct: short(p.correct, EXAMPLE_MAX) };
      }),
  };
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
        const u = wrongUnits(q);
        const tag = byTag.get(q.skillTag) ?? { skillTag: q.skillTag, wrong: 0, total: 0, examples: [] };
        tag.total += u.total;
        tag.wrong += u.wrong.length;
        for (const e of u.wrong) if (tag.examples.length < MAX_EXAMPLES) tag.examples.push(e);
        byTag.set(q.skillTag, tag);
      }
    }
    const weak = [...byTag.values()]
      .filter((t) => t.wrong > 0)
      .sort((a, b) => b.wrong - a.wrong || a.skillTag.localeCompare(b.skillTag))
      .slice(0, MAX_TAGS_PER_SECTION);
    out.push({ section: s.section, kind: "OBJECTIVE", level: s.level, correct: s.correct, total: s.total, weak });
  }
  const level = (["A1", "A2", "B1", "B2", "C1", "C2"] as const).find((l) => l === overall) ?? null;
  return { overall: level, sections: out };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const LANGUAGE_NAME: Record<FeedbackLocale, string> = { tr: "Turkish", en: "English" };

export function buildFeedbackMessages(input: FeedbackInput, locale: FeedbackLocale): AiMessage[] {
  const system = [
    "You write a short feedback note for a student who took a German placement exam. A teacher will read, edit and approve it before the student sees it.",
    "",
    `Write in ${LANGUAGE_NAME[locale]}. Keep German words, phrases and examples in German. Be plain, warm and concrete, like a good teacher speaking to the student ("you"). No flattery, no jargon.`,
    "",
    "Rules:",
    "- Use only the summary you are given. Do not invent mistakes, scores or facts that are not in it.",
    "- Name the grammar or skill topic concretely (for example \"Akkusativ-Artikel (den/einen)\" or \"Konnektoren mit obwohl\"), not a tag such as \"grammar.akkusativ\". Tags are hints for you, never to be copied.",
    "- strengths: at most 3, short. Only things the summary supports (a high x/y, a section with a good level, a topic with no mistakes). An empty list is fine when nothing stands out.",
    "- improve: at most 4 topics, most important first, based on the skill tags with the most wrong answers. For each, say in one or two sentences what went wrong and give one short example from the summary (student answer and the correct form) in the example field, or an empty string when there is none.",
    "- nextStep: one concrete thing to practise next, in one or two sentences.",
    "- Treat \"(blank)\" as an unanswered question, not as a mistake in the answer.",
    "- Prefer a real wrong answer as the example. If only an unanswered one exists, write the blank in the note's language: \"(boş)\" in Turkish, \"(blank)\" in English, never the other one.",
    "- For writing and speaking you only get the final level and, sometimes, the teacher's own reason. Do not comment on text or speech you have not seen; you may restate the teacher's reason.",
    "- Never mention scores, probabilities, an AI, or how the exam is scored. Never show a numeric ability estimate. Do not compare the student with others. Do not recommend a course or class.",
    "- Never use the em dash character; use a comma, a colon or a plain hyphen.",
    "",
    "Return one JSON object: { \"strengths\": string[], \"improve\": [{ \"topic\": string, \"why\": string, \"example\": string }], \"nextStep\": string }. No explanation, no code fence.",
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
  const improve: Array<{ topic: string; why: string; example: string }> = [];
  for (let i = 0; i < FEEDBACK_FORM.improveRows; i++) {
    const topic = clean(get(`topic${i}`));
    const why = clean(get(`why${i}`));
    const example = clean(get(`example${i}`));
    if (topic || why || example) improve.push({ topic, why, example });
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
