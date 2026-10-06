import type { AnswerExamples } from "@/db/schema/hiring";
import type { I18nText } from "@/db/schema/types";
import type { TemplateActivity, TemplateStage } from "./types";

export const t = (tr: string, en: string): I18nText => ({ tr, en });

type Open = {
  prompt: I18nText;
  note?: I18nText;
  competencies: string[];
  /** Team language (Turkish), 2-4 items. */
  expected: string[];
  /** Team language (Turkish), 1-3 items. */
  redFlags: string[];
  examples: AnswerExamples;
  internal?: string;
};

const open = (o: Open) => ({
  required: true,
  prompt: o.prompt,
  note: o.note ?? t("", ""),
  internalQuestion: o.internal ?? null,
  expectedBehaviours: o.expected,
  redFlags: o.redFlags,
  managerNotes: null,
  answerExamples: o.examples,
  competencyKeys: o.competencies,
});

type Recorded = Open & { think?: number; answer?: number; takes?: number };

export const video = (o: Recorded): TemplateActivity => ({
  ...open(o),
  type: "VIDEO",
  thinkSeconds: o.think ?? 60,
  flexibleThink: true,
  answerSeconds: o.answer ?? 120,
  maxTakes: o.takes ?? 2,
  config: { textAlternativeEnabled: false },
});

export const audio = (o: Recorded): TemplateActivity => ({ ...video(o), type: "AUDIO" });

export const longText = (o: Open & { minChars?: number; maxChars?: number }): TemplateActivity => ({
  ...open(o),
  type: "LONG_TEXT",
  thinkSeconds: 0,
  flexibleThink: true,
  answerSeconds: null,
  maxTakes: 1,
  config: { minChars: o.minChars ?? 300, maxChars: o.maxChars ?? 3000 },
});

export const shortText = (o: Open & { maxChars?: number }): TemplateActivity => ({
  ...longText(o),
  type: "SHORT_TEXT",
  config: { minChars: 0, maxChars: o.maxChars ?? 300 },
});

export const fileUpload = (o: Open & { mimeTypes: string[] }): TemplateActivity => ({
  ...open(o),
  type: "FILE_UPLOAD",
  thinkSeconds: 0,
  flexibleThink: true,
  answerSeconds: null,
  maxTakes: 1,
  config: { acceptedMimeTypes: o.mimeTypes, maxFileBytes: 20 * 1024 * 1024 },
});

/** A knowledge check with one right answer. It measures no competency (gate rule CHOICE_WITH_COMPETENCY). */
export const single = (o: { prompt: I18nText; note?: I18nText; options: I18nText[]; correct: number; internal?: string }): TemplateActivity => ({
  required: true,
  type: "SINGLE_CHOICE",
  prompt: o.prompt,
  note: o.note ?? t("", ""),
  internalQuestion: o.internal ?? null,
  expectedBehaviours: [],
  redFlags: [],
  managerNotes: null,
  answerExamples: {},
  thinkSeconds: 0,
  flexibleThink: true,
  answerSeconds: null,
  maxTakes: 1,
  config: { choices: o.options.map((label, i) => ({ id: String.fromCharCode(97 + i), label, ...(i === o.correct ? { correct: true } : {}) })) },
  competencyKeys: [],
});

export const stage = (s: { name: I18nText; description: I18nText; purpose: string; minutes: number; activities: TemplateActivity[] }): TemplateStage => ({
  name: s.name,
  description: s.description,
  internalPurpose: s.purpose,
  durationSeconds: s.minutes * 60,
  graceSeconds: 0,
  onTimeout: "AUTO_SUBMIT",
  backNavigation: false,
  activities: s.activities,
});
