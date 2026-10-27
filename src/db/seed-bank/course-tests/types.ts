import type { CourseForm, CourseKey } from "@/lib/exam/course/types";
import type { Section } from "@/lib/exam/types";
import type { SeedItem, SeedStimulus } from "../types";

/**
 * One parallel form of a course test (spec 2026-10-28). Loaded by
 * `bank:topup` with `course_form` = "<key>:<form>" and `course_order` = the
 * item's position inside its section, so the form is served exactly in this
 * order and never mixes with the placement and level check bank.
 */
export type SeedCourseSection = {
  section: Section;
  /** Reading texts and listening scripts of this section, in serving order. */
  stimuli: SeedStimulus[];
  /** In serving order. Every item's `level` is the course's level. */
  items: SeedItem[];
};

export type SeedCourseForm = {
  key: CourseKey;
  form: CourseForm;
  /** What the form tests and where that comes from. */
  syllabus: {
    /** URL of the table of contents used (Klett Netzwerk neu), or the CEFR list for B2. */
    source: string;
    /** e.g. "Netzwerk neu B1, Kapitel 1-6". */
    chapters: string;
    /** Grammar and themes covered, German, short. */
    topics: string[];
  };
  /** In telc order: READING, GRAMMAR, LISTENING, WRITING, SPEAKING. */
  sections: SeedCourseSection[];
};
