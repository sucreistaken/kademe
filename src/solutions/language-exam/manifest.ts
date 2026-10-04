import { stepPath } from "@/lib/candidate-routes";
import type { CandidateStepState, SolutionManifest } from "@/solutions/types";

const EXAM_STEPS = ["CONSENT", "INFO", "CHECK", "SECTION_INTRO", "ITEM", "DONE"] as const;
type ExamStep = (typeof EXAM_STEPS)[number];
const isExamStep = (step: string): step is ExamStep => (EXAM_STEPS as readonly string[]).includes(step);

export const languageExamManifest: SolutionManifest = {
  key: "language-exam",
  dbKind: "LANGUAGE_EXAM",
  basePath: "/exam",
  label: { tr: "Sınav", en: "Language exam" },
  nav: [
    { href: "/exam/students", label: { tr: "Öğrenciler", en: "Students" } },
    { href: "/exam/exams", label: { tr: "Sınavlar", en: "Exams" } },
    { href: "/exam/bank", label: { tr: "Soru bankası", en: "Question bank" } },
  ],
  inviteHref: "/exam/students/new",
  candidateFlowLive: true,
  candidateStepPath(token: string, state: CandidateStepState) {
    return isExamStep(state.step) ? stepPath(token, { step: state.step }) : `/a/${encodeURIComponent(token)}`;
  },
};
