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
    { href: "/exam/students", label: { tr: "Öğrenciler", en: "Students" }, icon: "users" },
    { href: "/exam/exams", label: { tr: "Sınavlar", en: "Exams" }, icon: "file-text" },
    { href: "/exam/bank", label: { tr: "Soru bankası", en: "Question bank" }, icon: "library" },
  ],
  inviteHref: "/exam/students/new",
  inviteLabel: { tr: "Öğrenci davet et", en: "Invite a student" },
  inviteCapability: "student:invite",
  candidateFlowLive: true,
  // Speaking answers are German whatever the interface language is (unchanged behaviour).
  transcriptionHint: "de",
  accommodationRequests: false,
  candidateStepPath(token: string, state: CandidateStepState) {
    return isExamStep(state.step) ? stepPath(token, { step: state.step }) : `/a/${encodeURIComponent(token)}`;
  },
};
