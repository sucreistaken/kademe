/**
 * The answer tally moved to `@/lib/exam/answer-tally` so the server (course
 * test scoring) counts units exactly as the teacher screens do; this keeps the
 * panel's import path.
 */
export * from "@/lib/exam/answer-tally";
