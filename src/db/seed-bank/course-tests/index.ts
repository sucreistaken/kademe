import { A1_COURSE_FORMS } from "./a1";
import { A2_COURSE_FORMS } from "./a2";
import { B1_COURSE_FORMS } from "./b1";
import { B2_COURSE_FORMS } from "./b2";
import type { SeedCourseForm } from "./types";

/** Every course test form, one file per level (spec 2026-10-28). */
export const COURSE_FORMS_SEED: SeedCourseForm[] = [...A1_COURSE_FORMS, ...A2_COURSE_FORMS, ...B1_COURSE_FORMS, ...B2_COURSE_FORMS];
