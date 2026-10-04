import type { I18nText } from "@/db/schema/types";
import { hasText } from "@/lib/library/anchors";
import { orderedActivities, orderedStages, type ActivityType, type ContentStage } from "./content";

export type CandidateChoice = { id: string; label: I18nText };
export type CandidateActivity = {
  id: string;
  type: ActivityType;
  required: boolean;
  prompt: I18nText;
  note: I18nText;
  thinkSeconds: number;
  flexibleThink: boolean;
  answerSeconds: number | null;
  maxTakes: number;
  choices: CandidateChoice[] | null;
  minChars: number | null;
  maxChars: number | null;
  acceptedMimeTypes: string[] | null;
  maxFileBytes: number | null;
  textAlternativeEnabled: boolean;
};
export type CandidateStage = { id: string; name: I18nText; description: I18nText; durationSeconds: number; activities: CandidateActivity[] };
export type CandidateVersion = { stages: CandidateStage[]; totalSeconds: number };

/**
 * What a candidate may see of a version, built field by field (a whitelist,
 * like the exam's toCandidateItem). Team-only fields, answer examples, the
 * competency mapping and a choice question's right answer are never copied.
 * The preview renders exactly this (HIRING-UX 5.8); plan 2's candidate API
 * sends the same.
 */
export function toCandidateVersion(content: { stages: ContentStage[] }): CandidateVersion {
  const stages = orderedStages(content).map(
    (stage): CandidateStage => ({
    id: stage.id,
    name: stage.name,
    description: stage.description,
    durationSeconds: stage.durationSeconds,
    activities: orderedActivities(stage).map(
      (a): CandidateActivity => ({
        id: a.id,
        type: a.type,
        required: a.required,
        prompt: a.prompt,
        note: a.note,
        thinkSeconds: a.thinkSeconds,
        flexibleThink: a.flexibleThink,
        answerSeconds: a.answerSeconds,
        maxTakes: a.maxTakes,
        choices: a.config.choices
          ? a.config.choices.filter((c) => hasText(c.label)).map((c): CandidateChoice => ({ id: c.id, label: c.label }))
          : null,
        minChars: a.config.minChars ?? null,
        maxChars: a.config.maxChars ?? null,
        acceptedMimeTypes: a.config.acceptedMimeTypes ?? null,
        maxFileBytes: a.config.maxFileBytes ?? null,
        textAlternativeEnabled: a.config.textAlternativeEnabled ?? false,
      }),
    ),
    }),
  );
  return structuredClone({ stages, totalSeconds: stages.reduce((sum, s) => sum + s.durationSeconds, 0) });
}
