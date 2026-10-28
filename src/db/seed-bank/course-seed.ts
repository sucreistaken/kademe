import { courseFormKey, type CourseForm, type CourseFormKey, type CourseKey } from "@/lib/exam/course/types";
import type { SeedCourseForm } from "./course-tests/types";
import { seedItemKey, type SeedKeyInput } from "./seed-key";
import type { SeedItem, SeedStimulus } from "./types";

/**
 * How the course test forms (spec 2026-10-28) become database rows. Every
 * seed key of a form starts with the form ("course-b1-1-a-" for B1.1 form A),
 * so a course key can never equal a bank key (no bank key starts with
 * "course-"), the same sentence in two forms is two rows, and a form can be
 * retired or synced without touching another one.
 *
 * Pure: the importer (src/server/bank-import.ts), the top-up planner, the
 * listening lock and the blind-solve scripts all read the forms through here.
 */

const COURSE_KEY_PREFIX = "course-";

/** "B1.1" + "A" -> "course-b1-1-a-": the front of every seed key of that form. */
export function courseSeedPrefix(key: CourseKey, form: CourseForm): string {
  return `${COURSE_KEY_PREFIX}${courseFormKey(key, form).toLowerCase().replace(/[.:]/g, "-")}-`;
}

/** The seed key of a course item: the form's prefix in front of the bank's content hash. */
export const courseItemSeedKey = (key: CourseKey, form: CourseForm, item: SeedKeyInput): string => courseSeedPrefix(key, form) + seedItemKey(item);

/** The seed key of a course text or clip: the form's prefix in front of the key its author gave it. */
export const courseStimulusSeedKey = (key: CourseKey, form: CourseForm, stimulusKey: string): string => courseSeedPrefix(key, form) + stimulusKey;

export const isCourseSeedKey = (seedKey: string): boolean => seedKey.startsWith(COURSE_KEY_PREFIX);

export type CourseSeedStimulus = { seedKey: string; courseForm: CourseFormKey; stimulus: SeedStimulus };

export type CourseSeedItem = {
  seedKey: string;
  courseForm: CourseFormKey;
  /** 0-based position inside its section in the form: the form is served in this order. */
  courseOrder: number;
  /** 1-based among the items that read the same text, 0 without one (the bank's numbering). */
  orderInStimulus: number;
  /** Seed key of the item's text, when it has one. */
  stimulusSeedKey: string | null;
  item: SeedItem;
};

export type CourseSeed = { stimuli: CourseSeedStimulus[]; items: CourseSeedItem[] };

/**
 * Every text and item of the given forms, flat, in serving order (forms in
 * the order given, sections in the form's order). A form that cannot be
 * stored as written throws with the form named: an item in the wrong section,
 * an item whose text is not in its section, or two identical items or texts in
 * one form (the second would silently disappear behind the first).
 */
export function courseSeed(forms: readonly SeedCourseForm[]): CourseSeed {
  const out: CourseSeed = { stimuli: [], items: [] };
  const textKeys = new Set<string>();
  const itemKeys = new Set<string>();
  for (const form of forms) {
    const courseForm = courseFormKey(form.key, form.form);
    for (const section of form.sections) {
      const keyOfText = new Map<string, string>();
      for (const stimulus of section.stimuli) {
        if (stimulus.section !== section.section) throw new Error(`course form ${courseForm}: text "${stimulus.key}" is a ${stimulus.section} text in the ${section.section} section`);
        const seedKey = courseStimulusSeedKey(form.key, form.form, stimulus.key);
        if (textKeys.has(seedKey)) throw new Error(`course form ${courseForm}: text "${stimulus.key}" is defined twice`);
        textKeys.add(seedKey);
        keyOfText.set(stimulus.key, seedKey);
        out.stimuli.push({ seedKey, courseForm, stimulus });
      }
      const perText = new Map<string, number>();
      section.items.forEach((item, courseOrder) => {
        if (item.section !== section.section) throw new Error(`course form ${courseForm}: a ${item.section} item sits in the ${section.section} section ("${item.prompt.slice(0, 50)}")`);
        const seedKey = courseItemSeedKey(form.key, form.form, item);
        if (itemKeys.has(seedKey)) throw new Error(`course form ${courseForm}: two identical items ("${item.prompt.slice(0, 50)}")`);
        itemKeys.add(seedKey);
        let stimulusSeedKey: string | null = null;
        let orderInStimulus = 0;
        if (item.stimulusKey) {
          stimulusSeedKey = keyOfText.get(item.stimulusKey) ?? null;
          if (!stimulusSeedKey) throw new Error(`course form ${courseForm}: text "${item.stimulusKey}" is not in the ${section.section} section`);
          orderInStimulus = (perText.get(item.stimulusKey) ?? 0) + 1;
          perText.set(item.stimulusKey, orderInStimulus);
        }
        out.items.push({ seedKey, courseForm, courseOrder, orderInStimulus, stimulusSeedKey, item });
      });
    }
  }
  return out;
}
