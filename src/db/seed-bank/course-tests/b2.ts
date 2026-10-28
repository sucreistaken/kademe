/*
 * B2 syllabus (spec 2026-10-28, ledger 6: there is no Netzwerk neu B2, "Kitapsız, CEFR B2 konuları").
 *
 * Sources (read for this split):
 *  - themes: Goethe-Zertifikat B2, Prüfungsziele/Testbeschreibung, Kap. 4.3 Prüfungsthemen
 *    https://www.goethe.de/pro/relaunch/prf/sr/Pruefungsziele_Testbeschreibung_B2.pdf
 *  - grammar: contents of telc Grammatiktraining Deutsch für B2 (12 chapters)
 *    https://shop.telc.net/media/catalog/product/file//v/0/v01-4004-tgr-1801a_grammatiktraining_b2.pdf
 *
 * B2.1 (Zwischentest, first half; topic id in brackets):
 *  Konnektoren und Nebensätze (konnektor, konnektor.konzessiv), Passiv mit Modalverben (passiv.modal) und
 *  Passiversatz (passiversatz), Konjunktiv II der Vergangenheit (konjunktiv2.vergangenheit,
 *  konjunktiv2.modal), Relativsätze mit Präposition und wo(r)-Anschluss (relativsatz.praeposition),
 *  Partizipialattribute (partizipattribut), Nominalisierung (nominalisierung) und Genitivpräpositionen
 *  (genitiv.praeposition). Themes: Arbeit, Bildung, Gesundheit, Wohnen und Umwelt, Medien.
 *
 * B2 (Abschlusstest, the whole list) = B2.1 plus the second half:
 *  Konjunktiv I in der indirekten Rede (konjunktiv_i), Nominal- und Verbalstil (nominal_verbalstil), Futur II
 *  und Vermutungen (futur2, modalverb_subjektiv), n-Deklination (n_deklination), Verben mit Präpositionen
 *  (verb_praeposition), Zweiteilige Konnektoren (konnektor.zweiteilig), Modalpartikeln (modalpartikel).
 *  Themes add Konsum, Klima, Sprache und Kommunikation, Gesellschaft. About half from each half: the cloze
 *  has 5 + 5 gaps, the 15 sentences 7 + 8.
 *
 * New topic ids (src/lib/exam/topics-course/b2.ts): futur2, modalpartikel, nominal_verbalstil. The shared
 * names and constants of both tests are in b2/syllabus.ts and b2/builders.ts (cloze3: three-choice cloze).
 */
import type { SeedCourseForm } from "./types";
import { INTERIM_A } from "./b2/interim-a";
import { INTERIM_B } from "./b2/interim-b";
import { FINAL_A } from "./b2/final-a";

/** B2 course tests (spec 2026-10-28): Zwischentest B2.1 and Abschlusstest B2, forms A and B each. */
export const B2_COURSE_FORMS: SeedCourseForm[] = [INTERIM_A, INTERIM_B, FINAL_A];
