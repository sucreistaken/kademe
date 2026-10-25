/**
 * The instruction line (Aufgabenstellung) of the starter bank's tasks.
 *
 * House style, after the ÖSD, telc, Goethe and TestDaF model tests (formulas only, no task is copied):
 * formal Sie, one to four short sentences, the verb first ("Lesen Sie ...", "Hören Sie ...", "Ordnen Sie
 * ... zu", "Kreuzen Sie an"), then the question ("Welche Anzeige passt zu welcher Person?"), then the rule of
 * the task ("Jede Anzeige passt nur einmal. Zwei Sätze passen nicht."). The candidate answers by clicking a
 * button or by choosing from a list, so no instruction says "ziehen" (drag) or "schreiben Sie den
 * Buchstaben". The answer labels on the screen are "Richtig / Falsch / Nicht im Text" and "Ja / Nein / Text
 * sagt dazu nichts" (tfng-labels.ts); the instruction uses those words and no abbreviations (R, F, NG).
 * instructions.test.ts pins the style and checks that the counts an instruction states are true.
 *
 * Changing an instruction changes the item's seed key (seed-key.ts), so the bank top-up adds the item anew
 * and, with --retire-stale, retires the old one. Write a new unit in this style from the start.
 *
 * | task                                   | instruction                                                                      |
 * |----------------------------------------|----------------------------------------------------------------------------------|
 * | single choice (reading, listening)     | the question itself ("Was soll Herr Okafor am Montag mitbringen?")                |
 * | richtig / falsch                       | READING_RF, LISTENING_RF                                                         |
 * | richtig / falsch / nicht im Text (B2+) | READING_RFN, LISTENING_RFN                                                       |
 * | Ja / Nein                              | READING_YES_NO; a task with its own question ("Ist die Person dafür?") says it   |
 * |                                        | and ends "Kreuzen Sie Ja oder Nein an."                                          |
 * | Ja / Nein / Text sagt dazu nichts (C1) | READING_YES_NO_NOT_SAID                                                          |
 * | tick n boxes                           | the question; the screen adds "Kreuzen Sie n Antworten an."                      |
 * | situation <-> advert                   | "Lesen Sie die Situationen und die Anzeigen A bis F. Welche Anzeige passt zu     |
 * |                                        | welcher Situation? Jede Anzeige passt nur einmal. Wenn keine Anzeige passt,      |
 * |                                        | wählen Sie „Keine Anzeige passt“."                                               |
 * | headline <-> text                      | "Lesen Sie die Texte 1 bis 5 und die Überschriften A bis H. Welche Überschrift   |
 * |                                        | passt zu welchem Text? Jede Überschrift passt nur einmal. Drei Überschriften     |
 * |                                        | bleiben übrig."                                                                  |
 * | sentence / paragraph insertion         | "Lesen Sie den Text. Fünf Sätze fehlen. Welcher Satz (A bis G) passt in welche   |
 * |                                        | Lücke (1 bis 5)? Jeder Satz passt nur einmal. Zwei Sätze passen nicht."          |
 * | who says what                          | "Lesen Sie die Beiträge der vier Personen. Wer sagt was? Ordnen Sie jeder        |
 * |                                        | Aussage eine Person zu. Eine Aussage passt zu keiner der vier Personen."         |
 * |                                        | (listening: "Hören Sie das Gespräch. Wer sagt was? ...")                         |
 * | picture <-> sign, note or message      | "Welches Bild passt zu welchem Schild? Ein Bild bleibt übrig."                   |
 * | note taking                            | "Hören Sie die Nachricht. Ergänzen Sie die Notizen." (+ "Schreiben Sie in jede   |
 * |                                        | Lücke ein Wort oder eine Zahl." where the key allows one word)                   |
 * | cloze text, word bank, open cloze      | fixed in cloze.ts, wordbank.ts and opencloze.ts ("Lesen Sie den Text. Wählen Sie  |
 * |                                        | für jede Lücke das passende Wort.", "... Setzen Sie die passenden Wörter in die  |
 * |                                        | Lücken ein.", "... Schreiben Sie in jede Lücke ein passendes Wort.")             |
 */

/** Reading, two answers (A1 to B1, as in ÖSD and telc). */
export const READING_RF = "Lesen Sie den Text. Sind die Aussagen richtig oder falsch? Kreuzen Sie an.";
/** Listening, two answers. */
export const LISTENING_RF = "Hören Sie den Text. Sind die Aussagen richtig oder falsch? Kreuzen Sie an.";
/** Reading, three answers (B2 and up, as in TestDaF). */
export const READING_RFN = "Lesen Sie den Text. Sind die Aussagen richtig, falsch oder nicht im Text? Kreuzen Sie an.";
/** Listening, three answers. */
export const LISTENING_RFN = "Hören Sie den Text. Sind die Aussagen richtig, falsch oder nicht im Text? Kreuzen Sie an.";
/** Reading, "Ja / Nein" wording with two answers (ÖSD B1 style). */
export const READING_YES_NO = "Lesen Sie den Text. Stimmen die Aussagen mit dem Text überein? Kreuzen Sie Ja oder Nein an.";
/** Reading, "Ja / Nein / Text sagt dazu nichts" (TestDaF style). */
export const READING_YES_NO_NOT_SAID = "Lesen Sie den Text. Was sagt der Text? Kreuzen Sie Ja, Nein oder „Text sagt dazu nichts“ an.";
