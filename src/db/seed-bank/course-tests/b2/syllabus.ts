import type { SeedCourseForm } from "../types";
import { B2_SYLLABUS_SOURCE } from "./builders";

/**
 * The B2 syllabus (spec 2026-10-28, ledger 6: "Kitapsız, CEFR B2 konuları"):
 * the grammar of telc Grammatiktraining Deutsch für B2 and the themes of the
 * Goethe-Zertifikat B2, cut in two. B2.1 takes the first half, the
 * Abschlusstest B2 the whole list. Names only, no book text.
 */

const FIRST_HALF_GRAMMAR = [
  "Konnektoren und Nebensätze",
  "Passiv mit Modalverben und Passiversatz",
  "Konjunktiv II der Vergangenheit",
  "Relativsätze mit Präposition und wo(r)-Anschluss",
  "Partizipialattribute",
  "Nominalisierung und Genitivpräpositionen",
];

const SECOND_HALF_GRAMMAR = [
  "Konjunktiv I und indirekte Rede",
  "Nominal- und Verbalstil",
  "Futur II und Vermutungen",
  "n-Deklination und Verben mit Präpositionen",
  "Zweiteilige Konnektoren und Modalpartikeln",
];

export const INTERIM_SYLLABUS: SeedCourseForm["syllabus"] = {
  source: B2_SYLLABUS_SOURCE,
  chapters: "CEFR B2, erste Hälfte der Goethe/telc-Liste (B2.1), kein Lehrbuch",
  topics: [...FIRST_HALF_GRAMMAR, "Themen: Arbeit, Bildung, Gesundheit, Wohnen und Umwelt, Medien"],
};

export const FINAL_SYLLABUS: SeedCourseForm["syllabus"] = {
  source: B2_SYLLABUS_SOURCE,
  chapters: "CEFR B2, ganze Goethe/telc-Liste (B2.1 und zweite Hälfte), kein Lehrbuch",
  topics: [...FIRST_HALF_GRAMMAR, ...SECOND_HALF_GRAMMAR, "Themen: Arbeit, Bildung, Gesundheit, Umwelt und Klima, Medien, Konsum, Gesellschaft"],
};
