import type { ContentActivity, ContentStage } from "@/solutions/hiring/rules/content";
import type { SaveEntry } from "./save-queue";

const STAGE_FIELDS = new Set<string>(["name", "description", "internalPurpose", "durationSeconds"]);
const ACTIVITY_FIELDS = new Set<string>([
  "type",
  "required",
  "prompt",
  "note",
  "internalQuestion",
  "expectedBehaviours",
  "redFlags",
  "managerNotes",
  "answerExamples",
  "thinkSeconds",
  "flexibleThink",
  "answerSeconds",
  "maxTakes",
  "config",
]);

/**
 * The loaded stages with every value the save queue still holds laid over
 * them (waiting, on its way, failed, or replayed after a reload), so an editor
 * that opens again shows what was typed, not the older server text (carry 7,
 * review Important 1). Only known editable fields of items still on screen.
 */
export function withUnsaved(stages: ContentStage[], entries: SaveEntry[]): ContentStage[] {
  if (entries.length === 0) return stages;
  return stages.map((stage) => {
    let next: ContentStage = stage;
    for (const e of entries) {
      if (e.target.kind === "stage" && e.target.id === stage.id && STAGE_FIELDS.has(e.field)) next = { ...next, [e.field]: e.value };
    }
    const activities = next.activities.map((activity) => {
      let a: ContentActivity = activity;
      for (const e of entries) {
        if (e.target.id !== activity.id) continue;
        if (e.target.kind === "activity" && ACTIVITY_FIELDS.has(e.field)) a = { ...a, [e.field]: e.value };
        if (e.target.kind === "competencies" && e.field === "ids" && Array.isArray(e.value)) a = { ...a, competencyIds: e.value as string[] };
      }
      return a;
    });
    return { ...next, activities };
  });
}
