import { describe, expect, it } from "vitest";
import type { StudentResult } from "@/lib/exam-flow";
import { studentNote, type FeedbackContent } from "./student-feedback";

const content: FeedbackContent = {
  strengths: ["Clear sentences"],
  improve: [{ topic: "Articles", why: "Gender is mixed up.", example: { student: "der Tisch", correct: "die Tisch" } }],
  nextStep: "Practise articles.",
};

describe("StudentResult.feedback accepts the student note only", () => {
  it("takes studentNote(content) and refuses a FeedbackContent that carries examples", () => {
    const note = studentNote(content);
    const ok: StudentResult["feedback"] = note;
    // @ts-expect-error a FeedbackContent (examples quote items) must not be assignable to the student-facing feedback
    const leaked: StudentResult["feedback"] = content;
    expect(ok?.improve[0]).toEqual({ topic: "Articles", why: "Gender is mixed up." });
    expect(leaked).toBe(content);
  });
});
