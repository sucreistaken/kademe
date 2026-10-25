import { SEED_PARTS } from "@/db/seed-bank";
import type { SeedItem } from "@/db/seed-bank/types";
import type { CalibrationTask, ResolvedTask } from "./types";

/**
 * The tasks the calibration fixtures answer: twelve writing and six speaking
 * tasks of the starter bank, two per level where the bank has them. They are
 * looked up in the bank itself, so the grader sees exactly the prompt, content
 * points and register that a candidate's grading row would carry.
 */
export const CALIBRATION_TASKS: CalibrationTask[] = [
  { id: "w-a1-tim", section: "WRITING", level: "A1", skillTag: "writing.message", promptStart: "Ihr Freund Tim hat Ihnen diese Nachricht geschickt" },
  { id: "w-a1-krank", section: "WRITING", level: "A1", skillTag: "writing.email", promptStart: "Sie sind krank und können morgen nicht in den Deutschkurs" },
  { id: "w-a2-umzug", section: "WRITING", level: "A2", skillTag: "writing.message", promptStart: "Sie ziehen am Samstag in eine neue Wohnung" },
  { id: "w-a2-heizung", section: "WRITING", level: "A2", skillTag: "writing.email", promptStart: "In Ihrer Wohnung funktioniert die Heizung nicht" },
  { id: "w-b1-hanna", section: "WRITING", level: "B1", skillTag: "writing.reply", promptStart: "Sie haben diese E-Mail von Ihrer Bekannten Hanna" },
  { id: "w-b1-markt", section: "WRITING", level: "B1", skillTag: "writing.application", promptStart: "Sie haben im Internet gelesen: Ein Supermarkt" },
  { id: "w-b1-forum", section: "WRITING", level: "B1", skillTag: "writing.opinion", promptStart: "In einem Online-Forum wird gefragt: „Sollten Firmen" },
  { id: "w-b2-homeoffice", section: "WRITING", level: "B2", skillTag: "writing.opinion", promptStart: "Sie lesen in einem Online-Forum die Frage: „Sollen alle Beschäftigten" },
  { id: "w-b2-kurs", section: "WRITING", level: "B2", skillTag: "writing.formal", promptStart: "Sie möchten ab dem nächsten Monat einen Abendkurs" },
  { id: "w-c1-noten", section: "WRITING", level: "C1", skillTag: "writing.opinion", promptStart: "Im Onlineforum einer Wirtschaftszeitschrift" },
  { id: "w-c1-online", section: "WRITING", level: "C1", skillTag: "writing.formal", promptStart: "Sie haben bei einem Weiterbildungsanbieter einen Präsenzkurs" },
  { id: "w-c2-sievers", section: "WRITING", level: "C2", skillTag: "writing.reply", promptStart: "Sie leiten das Besucherzentrum eines Naturparks" },
  { id: "s-a1-intro", section: "SPEAKING", level: "A1", skillTag: "speaking.introduction", promptStart: "Stellen Sie sich bitte vor." },
  { id: "s-a2-alltag", section: "SPEAKING", level: "A2", skillTag: "speaking.monologue", promptStart: "Erzählen Sie über Ihren Alltag." },
  { id: "s-a2-chefin", section: "SPEAKING", level: "A2", skillTag: "speaking.request", promptStart: "Sie sollen am Samstag arbeiten" },
  { id: "s-b1-abschied", section: "SPEAKING", level: "B1", skillTag: "speaking.planning", promptStart: "Ihre Kollegin Jana verlässt" },
  { id: "s-b2-grossraum", section: "SPEAKING", level: "B2", skillTag: "speaking.discussion", promptStart: "Ein Kollege sagt in einer Diskussion" },
  { id: "s-c1-erreichbar", section: "SPEAKING", level: "C1", skillTag: "speaking.discussion", promptStart: "Lesen Sie die Meldung und nehmen Sie Stellung.\n\n„Ein Unternehmen führt" },
];

const TASK_BY_ID = new Map(CALIBRATION_TASKS.map((t) => [t.id, t]));

function seedItems(section: "WRITING" | "SPEAKING"): SeedItem[] {
  return section === "WRITING" ? SEED_PARTS.writing.items : SEED_PARTS.speaking.items;
}

/** Every seed item the task description names. Exactly one is the contract (tests). */
export function matchingSeedItems(task: CalibrationTask): SeedItem[] {
  return seedItems(task.section).filter(
    (item) => item.level === task.level && item.skillTag === task.skillTag && item.prompt.startsWith(task.promptStart),
  );
}

export function calibrationTask(id: string): CalibrationTask {
  const task = TASK_BY_ID.get(id);
  if (!task) throw new Error(`unknown calibration task: ${id}`);
  return task;
}

/** The task as the grader gets it: prompt, content points, register, length or recording time. */
export function resolveTask(id: string): ResolvedTask {
  const task = calibrationTask(id);
  const matches = matchingSeedItems(task);
  if (matches.length !== 1) throw new Error(`calibration task ${id} matches ${matches.length} seed items`);
  const item = matches[0];
  const content = item.content;
  return {
    id,
    section: task.section,
    taskLevel: task.level,
    prompt: item.prompt,
    contentPoints: item.rubric?.contentPoints ?? [],
    register: item.rubric?.register,
    ...(content.kind === "WRITING" ? { minWords: content.minWords, maxWords: content.maxWords } : {}),
    ...(content.kind === "SPEAKING" ? { answerSeconds: content.answerSeconds } : {}),
  };
}
