import type { SeedCourseForm } from "./types";
import { B1_FINAL_A } from "./b1/final-a";
import { B1_FINAL_B } from "./b1/final-b";
import { B1_INTERIM_A } from "./b1/interim-a";
import { B1_INTERIM_B } from "./b1/interim-b";

/**
 * B1 course tests: Zwischentest B1.1 and Abschlusstest B1, forms A and B (spec 2026-10-28), in the order
 * INTERIM A, INTERIM B, FINAL A, FINAL B.
 */
export const B1_COURSE_FORMS: SeedCourseForm[] = [B1_INTERIM_A, B1_INTERIM_B, B1_FINAL_A, B1_FINAL_B];
