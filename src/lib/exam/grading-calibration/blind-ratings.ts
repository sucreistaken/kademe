import type { ResultLevel } from "../types";

/**
 * What an independent, blind rater gave each fixture (2026-10-25).
 *
 * Three Claude Opus agents rated the 85 answers without seeing the targets, the
 * fixtures file or the grader's output: they got the task, the answer, the
 * required length (or the timing figures of a spoken answer), the A0 and cap
 * rules and "rate like a strict Goethe / telc examiner", and no more. The
 * overall level they gave is below. It is not the fixture's target (the target
 * is the author's judgement and stays fixed); it shows which targets an
 * independent reader also holds. A fixture on which the two differ is
 * "contested": mostly the upper edge of B2 and C1, and the two conventions
 * (a memorised template or an off-topic text is credited less by the blind
 * rater than by the target).
 */
export const BLIND_RATINGS: Record<string, ResultLevel> = {
  "w-a1-tim/blank": "A0",
  "w-a1-tim/turkish": "A0",
  "w-a1-tim/words-only": "A0",
  "w-a1-tim/task-copied": "A0",
  "w-a1-tim/a1-clean": "A1",
  "w-a1-tim/a1-errors": "A1",
  "w-a1-tim/a2": "A2",
  "w-a1-tim/over-cap": "A2",
  "w-a1-krank/english": "A0",
  "w-a1-krank/memorised-intro": "A0",
  "w-a1-krank/a1-clean": "A1",
  "w-a1-krank/a1-errors": "A1",
  "w-a1-krank/a2-cap": "A2",
  "w-a2-umzug/dots-only": "A0",
  "w-a2-umzug/a1": "A1",
  "w-a2-umzug/a2": "A2",
  "w-a2-umzug/b1-cap": "B1",
  "w-a2-heizung/turkish-mixed": "A0",
  "w-a2-heizung/a1": "A1",
  "w-a2-heizung/a2": "A2",
  "w-a2-heizung/b2-over-cap": "B1",
  "w-b1-hanna/task-copied": "A0",
  "w-b1-hanna/a1-short": "A1",
  "w-b1-hanna/a2": "B1",
  "w-b1-hanna/b1": "B1",
  "w-b1-hanna/b2": "B2",
  "w-b1-hanna/c1-over-cap": "B2",
  "w-b1-hanna/long-errors": "A2",
  "w-b1-markt/b1": "B1",
  "w-b1-markt/memorised-template": "A2",
  "w-b1-markt/off-topic-fluent": "A0",
  "w-b1-markt/short-excellent": "B2",
  "w-b1-forum/a2": "A2",
  "w-b1-forum/b1": "B1",
  "w-b1-forum/b2": "B2",
  "w-b1-forum/task-copied": "A0",
  "w-b1-forum/memorised-template": "A1",
  "w-b2-homeoffice/english": "A0",
  "w-b2-homeoffice/a2": "A2",
  "w-b2-homeoffice/b1": "B1",
  "w-b2-homeoffice/b2": "C1",
  "w-b2-homeoffice/c1": "C1",
  "w-b2-homeoffice/memorised-template": "A1",
  "w-b2-homeoffice/long-errors": "B1",
  "w-b2-kurs/task-copied": "A0",
  "w-b2-kurs/b1": "B1",
  "w-b2-kurs/b2": "C1",
  "w-b2-kurs/off-topic-fluent": "B1",
  "w-b2-kurs/c1": "C1",
  "w-c1-noten/a1-short": "A1",
  "w-c1-noten/b1": "B1",
  "w-c1-noten/b2": "C1",
  "w-c1-noten/c1": "C2",
  "w-c1-online/task-copied": "A0",
  "w-c1-online/b2": "B2",
  "w-c1-online/c1": "C1",
  "w-c2-sievers/notes-pasted": "A0",
  "w-c2-sievers/a2": "A2",
  "w-c2-sievers/b2": "B2",
  "w-c2-sievers/c1": "C1",
  "w-c2-sievers/c2": "C2",
  "s-a1-intro/almost-silent": "A0",
  "s-a1-intro/turkish": "A0",
  "s-a1-intro/task-read-aloud": "A0",
  "s-a1-intro/a1-clean": "A1",
  "s-a1-intro/a1-errors": "A1",
  "s-a1-intro/a2-cap": "A2",
  "s-a2-alltag/english": "A0",
  "s-a2-alltag/a1": "A1",
  "s-a2-alltag/a2": "A2",
  "s-a2-alltag/b1-cap": "B1",
  "s-a2-chefin/a1": "A1",
  "s-a2-chefin/a2": "A2",
  "s-a2-chefin/b1-cap": "B1",
  "s-b1-abschied/a2": "A2",
  "s-b1-abschied/b1": "B1",
  "s-b1-abschied/b2-cap": "B2",
  "s-b1-abschied/off-topic-fluent": "B1",
  "s-b1-abschied/long-errors": "B1",
  "s-b2-grossraum/b1": "B1",
  "s-b2-grossraum/b2": "B2",
  "s-b2-grossraum/c1": "C1",
  "s-b2-grossraum/memorised-template": "B1",
  "s-c1-erreichbar/b2": "B2",
  "s-c1-erreichbar/c1": "C2",
};

/** Fixtures whose blind rating differs from the target. */
export function contestedFixtureIds(targets: Record<string, ResultLevel>): Set<string> {
  return new Set(Object.keys(targets).filter((id) => BLIND_RATINGS[id] !== targets[id]));
}
