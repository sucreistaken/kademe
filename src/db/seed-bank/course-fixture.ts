import type { CourseForm, CourseKey } from "@/lib/exam/course/types";
import type { SeedCourseForm } from "./course-tests/types";
import type { SeedItem } from "./types";

/**
 * A small course form for tests of the loader, the planner, the listening lock
 * and the blind-solve scripts. Not course content: the real forms live in
 * course-tests/a1.ts ... b2.ts and are never edited for a test. The same
 * content under two form letters is deliberate (the keys differ by prefix).
 */

const choice = (section: SeedItem["section"], prompt: string, correct: "a" | "b" | "c", extra: Partial<SeedItem> = {}): SeedItem => ({
  section,
  level: "B1",
  type: "SINGLE_CHOICE",
  skillTag: `${section.toLowerCase()}.detail`,
  prompt,
  content: { kind: "CHOICE", options: [{ id: "a", text: "Eins" }, { id: "b", text: "Zwei" }, { id: "c", text: "Drei" }] },
  key: { kind: "CHOICE", correct: [correct] },
  ...extra,
});

export function fixtureCourseForm(key: CourseKey = "B1.1", form: CourseForm = "A"): SeedCourseForm {
  return {
    key,
    form,
    syllabus: { source: "https://example.org/fixture", chapters: "Fixture, Kapitel 1-6", topics: ["Reisen", "Wohnen", "Arbeit"] },
    sections: [
      {
        section: "READING",
        stimuli: [{ key: "fx-r-reise", section: "READING", level: "B1", title: "Reise", body: "Anna fährt am Freitag nach Berlin.", topic: "Reisen" }],
        items: [
          {
            section: "READING",
            level: "B1",
            type: "TRUE_FALSE_NG",
            skillTag: "reading.tfng",
            stimulusKey: "fx-r-reise",
            prompt: "Richtig oder falsch?",
            content: { kind: "TFNG", twoWay: true, statements: [{ id: "s1", text: "Anna fährt nach Berlin." }, { id: "s2", text: "Anna fährt am Montag." }] },
            key: { kind: "TFNG", answers: { s1: "R", s2: "F" } },
          },
          choice("READING", "Welcher Text passt?", "b"),
          choice("READING", "Wann fährt Anna?", "c", { stimulusKey: "fx-r-reise" }),
        ],
      },
      {
        section: "GRAMMAR",
        stimuli: [],
        items: [
          choice("GRAMMAR", "Ich ___ müde.", "a", { within: "EASY" }),
          {
            section: "GRAMMAR",
            level: "B1",
            type: "GAP_FILL",
            skillTag: "grammar.cloze",
            within: "HARD",
            prompt: "Ich bleibe zu Hause, {{g1}} es regnet. Er {{g2}} müde.",
            content: { kind: "GAP", gaps: [{ id: "g1", choices: ["weil", "dass", "ob"] }, { id: "g2", choices: ["ist", "bin", "sind"] }] },
            key: { kind: "GAP", answers: { g1: ["weil"], g2: ["ist"] } },
          },
        ],
      },
      {
        section: "LISTENING",
        stimuli: [
          {
            key: "fx-l-durchsage",
            section: "LISTENING",
            level: "B1",
            title: "Durchsage",
            body: "A: Achtung, der Zug nach Berlin fährt heute von Gleis 4.\nB: Danke für die Information.",
            topic: "Reisen",
            speakers: [{ label: "A", voice: "A" }, { label: "B", voice: "B" }],
            maxPlays: 2,
          },
        ],
        items: [
          choice("LISTENING", "Von welchem Gleis fährt der Zug?", "b", { stimulusKey: "fx-l-durchsage" }),
          choice("LISTENING", "Wohin fährt der Zug?", "a", { stimulusKey: "fx-l-durchsage" }),
        ],
      },
      {
        section: "WRITING",
        stimuli: [],
        items: [
          {
            section: "WRITING",
            level: "B1",
            type: "WRITING_PROMPT",
            skillTag: "writing.email",
            prompt: "Schreiben Sie eine E-Mail an Frau Schneider.",
            content: { kind: "WRITING", minWords: 60, maxWords: 80 },
            key: { kind: "NONE" },
            rubric: { contentPoints: ["Anrede", "Grund", "Bitte"], register: "formell (Sie)", studentPoints: ["Anrede", "Grund nennen", "um etwas bitten"] },
          },
        ],
      },
      {
        section: "SPEAKING",
        stimuli: [],
        items: [
          {
            section: "SPEAKING",
            level: "B1",
            type: "SPEAKING_PROMPT",
            skillTag: "speaking.intro",
            prompt: "Stellen Sie sich vor.",
            content: { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 },
            key: { kind: "NONE" },
            rubric: { contentPoints: ["Name", "Beruf"], studentPoints: ["Name", "Beruf"] },
          },
        ],
      },
    ],
  };
}
