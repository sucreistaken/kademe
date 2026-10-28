import type { SeedCourseForm } from "./types";
import { B1_FINAL_A } from "./b1/final-a";
import { B1_FINAL_B } from "./b1/final-b";

/**
 * B1 course tests: Zwischentest B1.1 and Abschlusstest B1, forms A and B (spec 2026-10-28), in the order
 * INTERIM A, INTERIM B, FINAL A, FINAL B. This file holds the two Abschlusstest forms; the Zwischentest forms
 * (b1/interim-a.ts, b1/interim-b.ts) are written separately and go in front when the two are merged.
 */
export const B1_COURSE_FORMS: SeedCourseForm[] = [B1_FINAL_A, B1_FINAL_B];
