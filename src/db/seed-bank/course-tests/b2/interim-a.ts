import type { SeedCourseForm } from "../types";
import {
  announcementQuestion,
  clip,
  cloze3,
  introductionTask,
  presentationTask,
  readingText,
  REGISTER,
  sentence,
  tfng,
  whichText,
  writingTask,
} from "./builders";
import { INTERIM_SYLLABUS } from "./syllabus";

/**
 * Zwischentest B2.1, Form A (spec 2026-10-28). Tests the first half of the B2 list: Konnektoren und
 * Nebensätze, Passiv mit Modalverben und Passiversatz, Konjunktiv II der Vergangenheit, Relativsätze mit
 * wo(r)-Anschluss, Partizipialattribute, Nominalisierung und Genitivpräpositionen. Form B has the same
 * structure (interim-b.ts), no shared text or sentence.
 */

// ================================================================ READING (6)

const R1 = "course-b2-1-a-r1";
const R2 = "course-b2-1-a-r2";

const reading1 = readingText(
  R1,
  "Zeitungsartikel: Später zur Schule?",
  "Bildung und Gesundheit: Schulbeginn",
  `
Um Viertel vor acht sitzen in den meisten deutschen Schulen die ersten Klassen schon im Unterricht. Für viele Jugendliche heißt das: Der Wecker klingelt um halb sechs. Schlafforscher kritisieren diesen frühen Beginn seit Jahren. Sie erklären, dass sich die innere Uhr in der Pubertät nach hinten verschiebt. Jugendliche werden abends später müde und kommen morgens nur schwer in Gang. Wer trotzdem früh aufstehen muss, schläft deshalb oft zu wenig.

Eine Realschule in Niedersachsen hat vor zwei Jahren einen Versuch gestartet: Der Unterricht beginnt dort seitdem für alle Klassen erst um 8.30 Uhr. Die Schulleiterin Hatice Kaya zieht eine positive Bilanz. „Die Schülerinnen und Schüler wirken morgens ausgeschlafener, und die Zahl der Fehlstunden ist deutlich zurückgegangen“, sagt sie. Auch die Lehrkräfte hätten bemerkt, dass in der ersten Stunde konzentrierter gearbeitet werde. Damit der Schultag nicht zu lang wird, wurden die Pausen etwas verkürzt, und einige Arbeitsgemeinschaften finden jetzt in der Mittagspause statt.

Allerdings gibt es auch Schwierigkeiten. Viele Eltern müssen selbst früh zur Arbeit und können ihre Kinder morgens nicht mehr ein Stück begleiten. Außerdem richten sich die Busse in der Region noch nach dem alten Fahrplan, sodass manche Jugendliche eine halbe Stunde an der Haltestelle warten müssen. Der Landkreis hat angekündigt, den Fahrplan zu überprüfen; eine Entscheidung steht aber noch aus.

Bildungsforscher mahnen trotz der guten Erfahrungen zur Vorsicht. Ein späterer Beginn allein löse nicht alle Probleme, sagt der Pädagoge Marek Nowak von der Universität Hannover. Entscheidend sei, ob die Jugendlichen abends tatsächlich früher ins Bett gingen, statt länger am Handy zu sitzen. Er empfiehlt den Schulen, den neuen Rhythmus gemeinsam mit Eltern und Schülern zu erproben und die Ergebnisse regelmäßig zu prüfen. Die Realschule will nach dem dritten Schuljahr entscheiden, ob die neue Zeit dauerhaft gilt.
`,
);

const reading2 = readingText(
  R2,
  "Vier Texte zum Thema Wohnen",
  "Wohnen: Hausmitteilung, Wohnform, Anzeige, Landleben",
  `
Text A: Aushang im Treppenhaus
Liebe Bewohnerinnen und Bewohner, vom 14. bis 18. Oktober wird die Fassade unseres Hauses erneuert. In dieser Zeit können die Balkone nicht benutzt werden. Bitte räumen Sie bis zum 13. Oktober alle Gegenstände von Ihrem Balkon, damit die Handwerker ungehindert arbeiten können. Die Haustür bleibt tagsüber unverschlossen, deshalb sollten Wertgegenstände nicht im Treppenhaus stehen. Wir bitten um Verständnis für den Lärm. Ihre Hausverwaltung

Text B: Beitrag in einem Wohnforum
Vor einem Monat bin ich in eine Wohngemeinschaft gezogen, und ich bereue es nicht. Meine Miete ist jetzt fast halb so hoch wie vorher, und abends ist immer jemand da, mit dem man kochen oder reden kann. Streit gibt es manchmal wegen des Putzplans, aber das lässt sich klären. Nur wer sehr empfindlich auf Lärm reagiert, sollte sich den Schritt gut überlegen. Jana

Text C: Wohnungsanzeige
Helle Zwei-Zimmer-Altbauwohnung, 58 Quadratmeter, in ruhiger Seitenstraße, zweiter Stock, Parkettboden, Einbauküche, Balkon zum Hof. Kaltmiete 640 Euro, dazu 150 Euro Nebenkosten. Vor dem Einzug ist eine Kaution von drei Monatsmieten zu hinterlegen. Haustiere sind nur nach Absprache erlaubt. Besichtigungen finden nur nach telefonischer Vereinbarung statt, werktags ab 17 Uhr.

Text D: Blogeintrag
Als ich vor drei Jahren aufs Land gezogen bin, war ich sicher, dass ich es nach einem Jahr bereuen würde: kein Kino, kaum Busse, und der nächste Supermarkt ist acht Kilometer entfernt. Heute sehe ich das anders. Ich habe einen Garten, kenne meine Nachbarn und fahre trotz der langen Wege viel entspannter zur Arbeit als früher in der überfüllten Stadtbahn. Natürlich ist nicht alles perfekt, aber zurück in die Stadt möchte ich nicht mehr. Murat
`,
);

// ================================================================ GRAMMAR (15)

const cloze = cloze3("MID", {
  title: "Das Café ohne Einwegbecher",
  first: "In Münster hat im vergangenen Jahr ein Café eröffnet, das ganz auf Einwegbecher verzichtet.",
  body:
    "Wer einen Kaffee zum Mitnehmen möchte, zahlt einen Euro Pfand für den Becher. " +
    "Viele Gäste kommen regelmäßig, [[obwohl|weil|damit#konnektor.konzessiv]] der Kaffee hier etwas teurer ist als anderswo. " +
    "Die Becher dürfen nach dem Gebrauch nicht einfach weggeworfen [[werden|worden|wurden#passiv.modal]], sondern werden zurückgebracht und gespült. " +
    "Die Besitzerin Sibel Arslan sagt, ohne ihre vielen Stammgäste [[hätte|wäre|würde#konjunktiv2.vergangenheit]] sie die ersten Monate nicht überstanden. " +
    "Besonders beliebt ist der frisch [[gebackene|backende|gebackenen#partizipattribut]] Kuchen von einem Bäcker aus der Nachbarschaft, [[mit dem|mit der|dessen#relativsatz.praeposition]] das Café eng zusammenarbeitet. " +
    "[[Aufgrund|Trotz|Anstelle#genitiv.praeposition]] des großen Erfolgs plant die Besitzerin bereits eine zweite Filiale.",
  last: "Ob das Konzept auch in anderen Städten funktioniert, wird sich bald zeigen.",
  note:
    "Lücke 1: konzessiver Nebensatz mit „obwohl“. Lücke 2: Passiv mit Modalverb (dürfen + Partizip II + werden). " +
    "Lücke 3: Konjunktiv II der Vergangenheit (hätte + Partizip II, „überstehen“ bildet das Perfekt mit „haben“). " +
    "Lücke 4: Partizip II als Attribut (Nominativ, bestimmter Artikel: -e). Lücke 5: Relativsatz mit Präposition („zusammenarbeiten mit“ + Dativ, maskulin). " +
    "Lücke 6: Genitivpräposition „aufgrund“.",
});

const grammar = [
  cloze,
  sentence("konjunktiv2.vergangenheit", "MID",
    "Wenn der Bus gestern nicht ausgefallen ____, wäre ich pünktlich zur Besprechung gekommen.",
    ["war", "hätte", "wäre", "würde"], 2,
    "Konjunktiv II der Vergangenheit: „wäre“ + Partizip II („ausfallen“ bildet das Perfekt mit „sein“)"),
  sentence("konnektor", "MID",
    "Wir haben den Antrag rechtzeitig abgegeben. ____ wurde er abgelehnt.",
    ["Trotzdem", "Deshalb", "Außerdem", "Sonst"], 0,
    "Adverbkonnektor mit konzessiver Bedeutung („trotzdem“) und Inversion"),
  sentence("passiv.modal", "MID",
    "Der Fehler in der Abrechnung hat leider nicht mehr ____ werden können.",
    ["korrigieren", "zu korrigieren", "korrigierend", "korrigiert"], 3,
    "Passiv Perfekt mit Modalverb (hat ... korrigiert werden können)"),
  sentence("relativsatz.praeposition", "MID",
    "Im Anhang steht alles, ____ es in dem Vertrag geht.",
    ["wofür", "worum", "woran", "worauf"], 1,
    "Relativsatz mit wo(r)-Anschluss nach „alles“ („es geht um“ führt zu „worum“)"),
  sentence("partizipattribut", "HARD",
    "Die von der Kundin gestern ____ Unterlagen liegen auf Ihrem Schreibtisch.",
    ["eingereichten", "einreichenden", "einzureichenden", "eingereicht"], 0,
    "Erweitertes Partizipialattribut mit Partizip II (abgeschlossene Handlung, Passivbedeutung)"),
  sentence("konnektor", "MID",
    "Er tut so, ____ er alles verstanden hätte.",
    ["falls", "obwohl", "als ob", "damit"], 2,
    "Konnektor „als ob“ mit Konjunktiv II (irrealer Vergleich)"),
  sentence("passiversatz", "MID",
    "Die ausgefüllten Formulare sind ab sofort im Sekretariat ____.",
    ["abgeben", "abgegeben", "zu abgeben", "abzugeben"], 3,
    "Passiversatz: sein + zu + Infinitiv (trennbares Verb: „abzugeben“)"),
  sentence("konjunktiv2.modal", "MID",
    "Ich hätte dir die Wahrheit früher sagen ____.",
    ["gesollt", "sollen", "sollte", "sollend"], 1,
    "Konjunktiv II der Vergangenheit mit Modalverb (Ersatzinfinitiv: hätte ... sagen sollen)"),
  sentence("nominalisierung", "MID",
    "Die ____ der Anträge (bearbeiten) dauert in der Regel etwa zwei Wochen.",
    ["Bearbeiter", "Bearbeitete", "Bearbeitung", "Bearbeiten"], 2,
    "Nominalisierung: Verb „bearbeiten“ wird zum Nomen „die Bearbeitung“"),
];

// ================================================================ LISTENING (6)

const L1 = "course-b2-1-a-l1";
const L2 = "course-b2-1-a-l2";
const L3 = "course-b2-1-a-l3";
const L4 = "course-b2-1-a-l4";

const listening1 = clip(
  L1,
  "Ansage auf dem Anrufbeantworter einer Praxis",
  "Gesundheit: Praxis und Termine",
  [{ label: "Ansage", voice: "A" }],
  [
    "Ansage: Praxis Doktor Lindner, guten Tag. Sie sind außerhalb unserer Sprechzeiten verbunden. Vorab eine Änderung: Vom ersten bis zum fünfzehnten November ist die Praxis nachmittags geschlossen, weil sich das ganze Team fortbildet.",
    "Ansage: Vormittags sind wir wie gewohnt für Sie da, montags bis freitags von acht bis zwölf Uhr. Und noch etwas zur Grippeimpfung: Sie war für den zwölften November angekündigt, findet aber erst am neunzehnten statt.",
    "Ansage: Wenn Sie schon einen Termin für den zwölften haben, müssen Sie nicht zurückrufen. Wir melden uns bei Ihnen und nennen Ihnen eine neue Uhrzeit. In dringenden Fällen wählen Sie bitte die Nummer des ärztlichen Bereitschaftsdienstes: einhundertsechzehn einhundertsiebzehn.",
  ],
  2,
);

const listening2 = clip(
  L2,
  "Durchsage im Bahnhof",
  "Reise: Zugverkehr",
  [{ label: "Durchsage", voice: "B" }],
  [
    "Durchsage: Meine Damen und Herren, eine Information für die Reisenden nach Hamburg. Der Intercity um vierzehn Uhr zwölf fährt pünktlich ab, die zuvor gemeldete Verspätung hat sich erledigt. Allerdings fährt der Zug nicht, wie angekündigt, von Gleis acht, sondern von Gleis elf. Ich wiederhole: von Gleis elf.",
    "Durchsage: Bitte beachten Sie, dass der Weg dorthin etwas länger dauert, weil der Aufzug zurzeit nicht in Betrieb ist. Reisende mit Gepäck benutzen bitte die Rolltreppe am Ende des Bahnsteigs. Einen Ersatzverkehr mit Bussen gibt es nicht, der Zug fährt ganz normal. Wir bitten um Entschuldigung für die Unannehmlichkeiten.",
  ],
  2,
);

const listening3 = clip(
  L3,
  "Hinweis der Stadtwerke im Radio",
  "Wohnen: Wasserversorgung",
  [{ label: "Sprecherin", voice: "D" }],
  [
    "Sprecherin: Und noch eine Meldung für alle Haushalte im Stadtteil Nordend. Wegen Bauarbeiten an einer Hauptleitung wird morgen zwischen neun und fünfzehn Uhr das Wasser abgestellt. Die Stadtwerke empfehlen, sich schon am Abend vorher einen Vorrat anzulegen, zum Beispiel zehn Liter pro Person zum Kochen und Trinken.",
    "Sprecherin: Wer aus gesundheitlichen Gründen auf Wasser angewiesen ist, kann sich unter der Nummer null vier null drei, acht acht, sieben sieben melden. Dann wird eine Notversorgung organisiert. Nach dem Ende der Arbeiten kann das Wasser eine Zeit lang bräunlich aussehen. Das ist ungefährlich, und abkochen müssen Sie es auch nicht. Lassen Sie es einfach einige Minuten laufen.",
  ],
  2,
);

const listening4 = clip(
  L4,
  "Gespräch: Eine Woche ohne soziale Netzwerke",
  "Medien: Digital Detox",
  [
    { label: "Leyla", voice: "D" },
    { label: "Jonas", voice: "C" },
  ],
  [
    "Leyla: Sag mal, Jonas, du bist seit einer Woche kaum online. Hast du mein Foto gar nicht gesehen?",
    "Jonas: Doch, doch, aber erst heute. Ich mache gerade einen Test: eine Woche lang keine sozialen Netzwerke, nur Nachrichten per Mail oder Anruf.",
    "Leyla: Echt? Und warum?",
    "Jonas: Mir ist aufgefallen, dass ich morgens als Erstes zum Handy greife, noch vor dem Zähneputzen. Und abends wird es oft Mitternacht, weil ich einfach weiterscrolle.",
    "Leyla: Kenn ich. Aber ist das nicht ein bisschen extrem, gleich alles zu löschen?",
    "Jonas: Ich habe gar nichts gelöscht, ich habe nur die Apps vom Handy genommen. Wenn ich unbedingt etwas sehen will, kann ich mich am Laptop einloggen. Das ist so umständlich, dass ich es fast nie tue.",
    "Leyla: Und, bringt es was?",
    "Jonas: Überraschend viel. Ich schlafe besser, und ich habe gestern zum ersten Mal seit Monaten ein ganzes Buch zu Ende gelesen. Allerdings ...",
    "Leyla: Allerdings?",
    "Jonas: Na ja, ich merke auch, wie viel ich verpasse. Meine Kollegen verabreden vieles in der Gruppe, zum Beispiel das Mittagessen. Gestern saß ich plötzlich allein in der Kantine.",
    "Leyla: Das kann ich mir vorstellen. Ich selbst könnte nicht ganz verzichten, weil ich über meine Konten Aufträge bekomme. Als Fotografin brauche ich die Sichtbarkeit.",
    "Jonas: Eben, bei dir ist das Arbeit. Bei mir ist es eher eine Gewohnheit. Deshalb behalte ich nach der Woche nur noch eine App, nämlich die für den Fotokurs.",
    "Leyla: Mutig. Ich würde mir eher feste Zeiten setzen, zum Beispiel eine Stunde am Tag.",
    "Jonas: Habe ich auch überlegt. Aber ich weiß genau, aus einer Stunde werden drei.",
    "Leyla: Okay, dann bin ich gespannt. Erzählst du mir in zwei Wochen, ob du durchgehalten hast?",
    "Jonas: Klar, und dann gehen wir zusammen essen. Persönlich, ohne Handy auf dem Tisch.",
  ],
  1,
);

// ================================================================ WRITING (1)

const writing = writingTask(
  "formal",
  "MID",
  "Sie haben vor zehn Tagen bei dem Online-Händler „Technikwelt24“ einen Wasserkocher bestellt. Das Gerät ist beschädigt angekommen. Schreiben Sie eine E-Mail an den Kundenservice.\n\n" +
    "- Schildern Sie das Problem und erklären Sie, welche Folgen es für Sie hat.\n" +
    "- Berichten Sie, was Sie bisher unternommen haben, und erklären Sie, warum das nicht geholfen hat.\n" +
    "- Schlagen Sie eine Lösung vor und bitten Sie um eine Antwort bis zu einem bestimmten Termin.\n\n" +
    "Schreiben Sie ca. 120-150 Wörter. Vergessen Sie die formelle Anrede und die Grußformel nicht.",
  [
    "Problem schildern (Wasserkocher beschädigt angekommen, konkret beschrieben) UND Folgen für die Person nennen (z. B. Gerät unbrauchbar, Mehraufwand, fehlender Ersatz)",
    "Bisherige Schritte nennen (z. B. Anruf bei der Hotline, E-Mail, Rücksendeversuch) UND erklären, warum das nicht geholfen hat (z. B. niemand erreichbar, keine Antwort, kein Rücksendeschein)",
    "Lösung vorschlagen (Ersatzlieferung oder Erstattung) UND um eine Antwort bis zu einem genannten Termin bitten (konkrete Frist)",
  ],
  [
    "Problem und Folgen schildern",
    "bisherige Schritte und warum sie nicht halfen",
    "Lösung vorschlagen und Frist nennen",
  ],
  REGISTER.formal,
  "Formelle Beschwerde-E-Mail: drei Leitpunkte mit je zwei Teilaspekten, formelle Anrede und Grußformel, durchgehend Sie. Erwartet werden Konnektoren, Nebensätze und höfliche Formen (Konjunktiv II).",
);

// ================================================================ SPEAKING (2)

const speaking = [
  introductionTask(
    ["Name", "Wohnort (Stadt oder Region)", "Beruf, Studium oder Tätigkeit", "Freizeit und Interessen", "Sprachen und Deutsch lernen"],
    [
      "Name und Wohnort (Stadt oder Region) genannt",
      "Beruf, Studium oder Tätigkeit genannt und kurz beschrieben",
      "Freizeit oder Interessen mit mindestens einem Beispiel",
      "Sprachen genannt, Grund für das Deutschlernen",
    ],
  ),
  presentationTask(
    "Gesund leben im Alltag",
    [
      "Was gehört für Sie zu einem gesunden Alltag? Nennen Sie Beispiele.",
      "Welche Hindernisse gibt es im Berufs- oder Studienalltag?",
      "Wie können Arbeitgeber oder Schulen die Gesundheit unterstützen? Was wäre noch sinnvoll?",
      "Was würden Sie jemandem raten, der gesünder leben möchte? Begründen Sie Ihre Meinung.",
    ],
    [
      "Thema vorgestellt, eigene Beispiele für einen gesunden Alltag",
      "Hindernisse im Berufs- oder Studienalltag mit Beispiel",
      "Unterstützung durch Arbeitgeber oder Schulen, eigene Ideen",
      "Ratschlag mit Begründung und Schluss",
    ],
  ),
];

export const INTERIM_A: SeedCourseForm = {
  key: "B2.1",
  form: "A",
  syllabus: INTERIM_SYLLABUS,
  sections: [
    {
      section: "READING",
      stimuli: [reading1, reading2],
      items: [
        tfng("READING", R1, "detail", "MID",
          [
            ["Weil sich die innere Uhr in der Pubertät verschiebt, fällt vielen Jugendlichen das frühe Aufstehen schwer.", "R"],
            ["Seit der Umstellung schreiben die Schülerinnen und Schüler der Realschule bessere Noten.", "NG"],
            ["An der Realschule fehlen seit der Umstellung mehr Schülerinnen und Schüler im Unterricht als vorher.", "F"],
          ],
          "1: „die innere Uhr ... nach hinten verschiebt“, morgens nur schwer in Gang. 2: Von Noten ist im Text nicht die Rede (konzentrierteres Arbeiten ist keine Aussage über Noten). 3: „die Zahl der Fehlstunden ist deutlich zurückgegangen“."),
        whichText(R2, "detail", "MID",
          "Wo wird angekündigt, dass etwas vorübergehend nicht genutzt werden kann?",
          ["Text A", "Text C", "Text D"], 0,
          "Text A: Die Balkone können vom 14. bis 18. Oktober nicht benutzt werden. Text C nennt Bedingungen (Haustiere, Besichtigung), aber keine zeitlich begrenzte Sperrung."),
        whichText(R2, "inference", "MID",
          "Wer beurteilt seinen Wohnort heute anders als zu Beginn?",
          ["Text B", "Text C", "Text D"], 2,
          "Text D: „Heute sehe ich das anders“ nach der früheren Erwartung, es zu bereuen. Text B bereut den Umzug nicht, beschreibt aber keinen Meinungswechsel."),
        whichText(R2, "detail", "EASY",
          "Welcher Text nennt eine finanzielle Voraussetzung für den Einzug?",
          ["Text A", "Text C", "Text D"], 1,
          "Text C: Kaution von drei Monatsmieten vor dem Einzug. In Text B geht es nur um die niedrigere Miete, nicht um eine Voraussetzung."),
      ],
    },
    {
      section: "GRAMMAR",
      stimuli: [],
      items: grammar,
    },
    {
      section: "LISTENING",
      stimuli: [listening1, listening2, listening3, listening4],
      items: [
        announcementQuestion(L1, "detail", "MID",
          "Was sollen Patienten tun, die für den zwölften November einen Impftermin haben?",
          [
            "Sie sollen in der Praxis anrufen und einen neuen Termin vereinbaren.",
            "Sie müssen nichts unternehmen, die Praxis meldet sich bei ihnen.",
            "Sie sollen sich an den ärztlichen Bereitschaftsdienst wenden.",
          ], 1,
          "„Wenn Sie schon einen Termin für den zwölften haben, müssen Sie nicht zurückrufen. Wir melden uns bei Ihnen.“ Der Bereitschaftsdienst gilt nur für dringende Fälle."),
        announcementQuestion(L2, "gist", "MID",
          "Was ändert sich für die Reisenden nach Hamburg?",
          [
            "Der Zug fährt später ab als angekündigt.",
            "Die Reisenden müssen in einen Ersatzbus umsteigen.",
            "Der Zug fährt von einem anderen Gleis ab.",
          ], 2,
          "Der Zug fährt von Gleis elf statt von Gleis acht. Die Verspätung hat sich erledigt, einen Ersatzverkehr gibt es nicht."),
        announcementQuestion(L3, "detail", "MID",
          "Was empfehlen die Stadtwerke den Haushalten für den Abend vor den Bauarbeiten?",
          [
            "Sie sollen sich einen Vorrat an Trinkwasser anlegen.",
            "Sie sollen das Wasser vor dem Trinken abkochen.",
            "Sie sollen bei den Stadtwerken eine Notversorgung anmelden.",
          ], 0,
          "„Sich schon am Abend vorher einen Vorrat anzulegen.“ Die Notversorgung betrifft nur Haushalte, die aus gesundheitlichen Gründen auf Wasser angewiesen sind; zum Abkochen sagt die Meldung nichts."),
        tfng("LISTENING", L4, "detail", "MID",
          [
            ["Jonas hat seine Konten in den sozialen Netzwerken gelöscht.", "F"],
            ["Jonas schläft seit dem Verzicht besser.", "R"],
            ["Leyla kann nicht ganz auf soziale Netzwerke verzichten, weil sie sie für ihre Arbeit braucht.", "R"],
          ],
          "1: „Ich habe gar nichts gelöscht, ich habe nur die Apps vom Handy genommen.“ 2: „Ich schlafe besser.“ 3: Leyla bekommt über ihre Konten Aufträge und braucht als Fotografin die Sichtbarkeit."),
      ],
    },
    { section: "WRITING", stimuli: [], items: [writing] },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
