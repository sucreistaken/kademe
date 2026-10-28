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
 * Zwischentest B2.1, Form B (spec 2026-10-28). Same structure and the same grammar phenomena in the same
 * proportions as Form A (interim-a.ts), new texts and sentences.
 */

// ================================================================ READING (6)

const R1 = "course-b2-1-b-r1";
const R2 = "course-b2-1-b-r2";

const reading1 = readingText(
  R1,
  "Zeitungsartikel: Mehr Grün gegen die Hitze",
  "Umwelt und Stadt: Hitze und Stadtbäume",
  `
Im Sommer kann es in dicht bebauten Stadtvierteln um mehrere Grad wärmer sein als im Umland. Stadtplaner sprechen von „Hitzeinseln“: Asphalt und Beton speichern die Wärme tagsüber und geben sie nachts nur langsam wieder ab. Auch fehlen in solchen Vierteln oft Wiesen und Gärten, die die Luft abkühlen könnten. Besonders für ältere Menschen, Kleinkinder und Kranke können solche Nächte zur Belastung werden.

Eine mittelgroße Stadt im Rheinland hat deshalb vor drei Jahren ein Programm gestartet: Bis zum Jahr 2030 sollen mehr als fünftausend Bäume gepflanzt werden, vor allem in Straßen ohne Grün. Die Umweltdezernentin Katarina Horvat erklärt, ein ausgewachsener Baum könne die Temperatur in seiner Umgebung um bis zu drei Grad senken, weil er Schatten spendet und Wasser verdunstet. Außerdem binde er Staub und verbessere die Luft. Das Programm kostet insgesamt rund drei Millionen Euro, ein Teil davon wird vom Land gefördert.

Doch Bäume haben es in der Stadt schwer. Der Boden unter den Gehwegen ist oft verdichtet, und Leitungen für Wasser, Gas und Strom lassen kaum Platz für Wurzeln. Deshalb werden neue, größere Pflanzgruben angelegt, was die Kosten pro Baum deutlich erhöht. Hinzu kommt, dass junge Bäume in den ersten Jahren regelmäßig gegossen werden müssen. Dabei ist die Stadt auf Hilfe angewiesen: Anwohner können eine Patenschaft für einen Baum übernehmen und ihn in trockenen Wochen mit Wasser versorgen. Bisher haben sich mehr als dreihundert Haushalte gemeldet.

Nicht alle sind begeistert. Ein Verband der Einzelhändler befürchtet, dass für manche Bäume Parkplätze wegfallen und dadurch weniger Kundschaft in die Geschäfte kommt. Die Dezernentin hält dagegen: Untersuchungen in anderen Städten zeigten, dass schattige Einkaufsstraßen häufiger besucht würden als kahle. Wie viele Parkplätze tatsächlich entfallen, will die Stadt bis zum Herbst prüfen.
`,
);

const reading2 = readingText(
  R2,
  "Vier Texte zum Thema Arbeit und Weiterbildung",
  "Arbeit und Weiterbildung: Betriebsmitteilung, Berufswechsel, Kursanzeige, Praktikum",
  `
Text A: Mitteilung im Intranet
Liebe Kolleginnen und Kollegen, die diesjährige Betriebsversammlung findet am Donnerstag, dem 21. November, um 15 Uhr in der Kantine statt. Auf der Tagesordnung stehen unter anderem der neue Schichtplan und die Pläne für den Umbau der Lagerhalle. Wer nicht teilnehmen kann, meldet sich bitte bis Dienstag bei der Abteilungsleitung ab. Schichtarbeitenden wird die Zeit der Versammlung als Arbeitszeit angerechnet. Das Protokoll wird anschließend im Intranet veröffentlicht. Der Betriebsrat

Text B: Beitrag in einem Karriereforum
Nach zwölf Jahren im Einzelhandel habe ich noch einmal umgesattelt und mache jetzt eine Umschulung zur Mediengestalterin. Es war die richtige Entscheidung, aber ich hatte vorher ein halbes Jahr lang gespart und alles mit meiner Familie durchgesprochen. Mein Rat an alle, die über einen Berufswechsel nachdenken: Überstürzen Sie nichts. Informieren Sie sich genau über Kosten und Dauer und sprechen Sie mit Leuten, die den Weg schon gegangen sind. Dann lohnt sich der Schritt meistens. Ewa

Text C: Kursanzeige
Fit fürs Projektmanagement: Abendkurs in Kleingruppen. Sie leiten bereits Teams oder möchten es bald tun? An zehn Abenden (dienstags und donnerstags, 18.30 bis 21 Uhr) lernen Sie praxisnah die wichtigsten Methoden kennen, vom Zeitplan bis zur Risikoanalyse. Auch wer arbeitssuchend ist, kann teilnehmen: Die Agentur für Arbeit übernimmt die Kursgebühr von 480 Euro unter bestimmten Voraussetzungen, wenn Sie einen Bildungsgutschein vorlegen. Anmeldung online oder telefonisch bis zum 1. Dezember.

Text D: Blogeintrag
Letzten Sommer habe ich vier Wochen lang ein Praktikum in einer Werbeagentur gemacht, und es war anders, als ich dachte. Ich habe viel gelernt, vor allem im Umgang mit Kunden, und das Team hat mich von Anfang an ernst genommen. Aber ehrlich gesagt hätte ich mich vorher besser informieren sollen: In der ersten Woche habe ich nur Kaffee gekocht und Termine verschickt, weil niemand wusste, was ich eigentlich machen sollte. Beim nächsten Mal frage ich vorher nach einem festen Aufgabenbereich. Tim
`,
);

// ================================================================ GRAMMAR (15)

const cloze = cloze3("MID", {
  title: "Ein neuer Arbeitsalltag im Team",
  first: "Vor einem Jahr hat eine Versicherungsagentur in Leipzig beschlossen, dass ihre Beschäftigten an drei Tagen pro Woche von zu Hause arbeiten dürfen.",
  body:
    "Die Mitarbeitenden können ihre Zeit jetzt freier einteilen, [[sodass|obwohl|bevor#konnektor]] sich viele leichter um ihre Familie kümmern können. " +
    "Die von der Firma zur Verfügung [[gestellten|stellenden|gestellte#partizipattribut]] Laptops sind mit einem Passwort geschützt, und neue Programme müssen vor dem Einsatz von der IT-Abteilung geprüft [[werden|geworden|worden#passiv.modal]]. " +
    "Besonders wichtig war die Teamleiterin Natalia Petrova, [[auf die|auf der|auf deren#relativsatz.praeposition]] sich alle verlassen konnten. " +
    "Sie sagt heute, ohne die Hilfe der Kolleginnen und Kollegen [[hätte|wäre|würde#konjunktiv2.vergangenheit]] sie die Umstellung nicht so schnell geschafft. " +
    "[[Angesichts|Anstelle|Entgegen#genitiv.praeposition]] der steigenden Spritpreise sparen viele Beschäftigte außerdem Geld, weil sie nicht mehr täglich ins Büro fahren müssen.",
  last: "Nur auf die gemeinsame Mittagspause im Büro möchte kaum jemand verzichten.",
  note:
    "Lücke 1: konsekutiver Nebensatz mit „sodass“. Lücke 2: Partizip II als Attribut (Nominativ Plural nach „die“: -en). " +
    "Lücke 3: Passiv mit Modalverb (müssen + Partizip II + werden). Lücke 4: Relativsatz mit Präposition („sich verlassen auf“ + Akkusativ, feminin). " +
    "Lücke 5: Konjunktiv II der Vergangenheit (hätte + Partizip II, „schaffen“ bildet das Perfekt mit „haben“). Lücke 6: Genitivpräposition „angesichts“.",
});

const grammar = [
  cloze,
  sentence("konnektor", "MID",
    "Bitte melden Sie sich bis Freitag an. ____ können wir Ihren Platz nicht reservieren.",
    ["Andernfalls", "Trotzdem", "Deshalb", "Außerdem"], 0,
    "Adverbkonnektor mit konditionaler Bedeutung („andernfalls“) und Inversion"),
  sentence("passiv.modal", "MID",
    "Das Problem hat erst nach mehreren Wochen ____ werden können.",
    ["lösen", "lösend", "zu lösen", "gelöst"], 3,
    "Passiv Perfekt mit Modalverb (hat ... gelöst werden können)"),
  sentence("konjunktiv2.vergangenheit", "MID",
    "Ohne deine Hilfe ____ ich die Prüfung nicht bestanden.",
    ["wäre", "hatte", "würde", "hätte"], 3,
    "Konjunktiv II der Vergangenheit: „hätte“ + Partizip II („bestehen“ bildet das Perfekt mit „haben“)"),
  sentence("relativsatz.praeposition", "MID",
    "Auf der Messe gab es nichts, ____ er sich wirklich interessierte.",
    ["woran", "wovon", "wofür", "worauf"], 2,
    "Relativsatz mit wo(r)-Anschluss nach „nichts“ („sich interessieren für“ führt zu „wofür“)"),
  sentence("passiversatz", "MID",
    "Ein Unfall dieser Art ____ sich nie ganz verhindern.",
    ["wird", "kann", "lässt", "muss"], 2,
    "Passiversatz mit „sich lassen“ + Infinitiv (= kann nicht verhindert werden)"),
  sentence("konnektor", "MID",
    "Ich möchte lieber zu Hause bleiben, ____ ich morgen früh aufstehen muss.",
    ["sodass", "zumal", "obwohl", "bevor"], 1,
    "Kausaler Konnektor „zumal“ (zusätzlicher Grund)"),
  sentence("partizipattribut", "HARD",
    "Die von der Stadt letztes Jahr ____ Radwege werden gut genutzt.",
    ["bauenden", "zu bauenden", "gebauten", "gebaut"], 2,
    "Erweitertes Partizipialattribut mit Partizip II (abgeschlossene Handlung, Passivbedeutung)"),
  sentence("konjunktiv2.modal", "MID",
    "Du hättest mich ruhig anrufen ____.",
    ["konntest", "können", "könntest", "gekonnt"], 1,
    "Konjunktiv II der Vergangenheit mit Modalverb (Ersatzinfinitiv: hättest ... anrufen können)"),
  sentence("nominalisierung", "MID",
    "Die ____ der neuen Software (einführen) hat länger gedauert als geplant.",
    ["Einführung", "Einführen", "Einführer", "Eingeführte"], 0,
    "Nominalisierung: Verb „einführen“ wird zum Nomen „die Einführung“"),
];

// ================================================================ LISTENING (6)

const L1 = "course-b2-1-b-l1";
const L2 = "course-b2-1-b-l2";
const L3 = "course-b2-1-b-l3";
const L4 = "course-b2-1-b-l4";

const listening1 = clip(
  L1,
  "Nachricht von einer Fahrradwerkstatt",
  "Dienstleistungen: Reparatur und Kosten",
  [{ label: "Werkstatt", voice: "C" }],
  [
    "Werkstatt: Guten Tag, hier ist die Fahrradwerkstatt Mensah. Ihr Rad ist fertig. Es war am Ende etwas mehr zu tun, als wir am Telefon geschätzt hatten. Die Bremsbeläge haben wir wie besprochen erneuert, das kostet fünfunddreißig Euro.",
    "Werkstatt: Dazu kam aber die Kette. Die war so stark gelängt, dass wir sie ebenfalls austauschen mussten. Das Licht haben wir nur geprüft, es ist in Ordnung. Insgesamt macht das sechsundneunzig Euro statt der geschätzten sechzig.",
    "Werkstatt: Abholen können Sie das Rad ab morgen, montags bis freitags von neun bis achtzehn Uhr. Wenn Sie mit dem Preis nicht einverstanden sind, rufen Sie mich bitte zurück, dann besprechen wir das.",
  ],
  2,
);

const listening2 = clip(
  L2,
  "Ansage im Stadtmuseum",
  "Freizeit und Kultur: Museumsführung",
  [{ label: "Ansage", voice: "A" }],
  [
    "Ansage: Liebe Besucherinnen und Besucher, willkommen im Stadtmuseum. Die Führung durch die Sonderausstellung beginnt heute um elf Uhr. Entschuldigung, ich muss mich korrigieren: Wegen einer angemeldeten Schulklasse beginnt sie erst um halb zwölf. Treffpunkt ist wie immer an der Kasse im Erdgeschoss.",
    "Ansage: Die Führung dauert etwa eine Stunde und kostet nichts, Sie zahlen nur den normalen Eintritt. Falls Sie später dazukommen möchten: Die nächste Führung gibt es um dreizehn Uhr dreißig. Garderobe und Schließfächer finden Sie im Untergeschoss, das Museumscafé ist bis siebzehn Uhr geöffnet.",
  ],
  2,
);

const listening3 = clip(
  L3,
  "Telefonansage einer Krankenkasse",
  "Dienstleistungen: Versicherung und Service",
  [{ label: "Ansage", voice: "B" }],
  [
    "Ansage: Willkommen bei der Gesundheitskasse Nordland. Unsere Servicezeiten sind montags bis donnerstags von acht bis sechzehn Uhr und freitags von acht bis dreizehn Uhr. Bitte wählen Sie jetzt: Für Fragen zu Ihrem Beitrag drücken Sie die Eins.",
    "Ansage: Wenn Sie eine Rechnung einreichen möchten oder Ihre Bescheinigung für den Arbeitgeber verloren haben, drücken Sie die Zwei. Für Fragen zur Familienversicherung drücken Sie die Drei. Für alle anderen Anliegen bleiben Sie bitte in der Leitung, wir verbinden Sie mit dem nächsten freien Mitarbeiter. Noch ein Hinweis: Anträge auf Krankengeld können Sie auch online stellen, das geht schneller.",
  ],
  2,
);

const listening4 = clip(
  L4,
  "Gespräch: Studium oder Ausbildung?",
  "Bildung: Studienabbruch und Ausbildung",
  [
    { label: "Mara", voice: "A" },
    { label: "Karim", voice: "B" },
  ],
  [
    "Mara: Hey Karim, na, wie war dein Gespräch mit der Studienberatung?",
    "Karim: Ehrlich gesagt ernüchternd. Die Beraterin hat mir erklärt, dass ich noch mindestens vier Semester brauche, und realistisch gesehen wird es eher ein Jahr länger.",
    "Mara: Und willst du das noch durchziehen? Du hast doch schon im zweiten Semester gesagt, dass dir das Fach nicht liegt.",
    "Karim: Stimmt, Informatik ist nicht das, was ich mir vorgestellt habe. Zu viel Theorie, zu wenig Praxis. Aber ich bin auch nicht sicher, ob ein Abbruch klug ist. Meine Eltern würden das nicht gut finden.",
    "Mara: Hast du mit ihnen darüber gesprochen?",
    "Karim: Noch nicht. Erst wollte ich mir selbst klar werden. Die Beraterin hat mir übrigens vorgeschlagen, ein Praktikum in einer Firma zu machen, bevor ich entscheide.",
    "Mara: Das klingt vernünftig. Mein Cousin hat damals genauso angefangen. Er hat im Studium gemerkt, dass er lieber mit den Händen arbeitet, und hat dann eine Ausbildung als Mechatroniker gemacht. Heute ist er froh, dass er nicht bis zum Abschluss durchgehalten hat.",
    "Karim: Der Vorteil bei einer Ausbildung ist ja auch, dass man von Anfang an Geld verdient. Das reizt mich schon. Aber ich weiß nicht, ob ich mit einundzwanzig noch bei null anfangen will.",
    "Mara: Bei null fängst du ja nicht an. Mit Abitur und zwei Jahren Studium bekommst du in manchen Betrieben die Ausbildung verkürzt.",
    "Karim: Ach, das wusste ich gar nicht. Das muss ich unbedingt nachfragen.",
    "Mara: Und ein Studium kannst du später immer noch wieder aufnehmen, zum Beispiel berufsbegleitend.",
    "Karim: Stimmt. Okay, ich mache erst mal das Praktikum, dann sehe ich weiter. Danke, Mara, das hat mir wirklich geholfen.",
  ],
  1,
);

// ================================================================ WRITING (1)

const writing = writingTask(
  "formal",
  "MID",
  "Sie haben im September einen Intensivkurs an der Sprachschule „Lingua Nord“ begonnen. Seit drei Wochen fällt der Unterricht häufig aus, und die Termine werden kurzfristig geändert. Schreiben Sie eine E-Mail an die Leitung der Schule.\n\n" +
    "- Schildern Sie das Problem und erklären Sie, welche Folgen es für Sie hat.\n" +
    "- Berichten Sie, was Sie bisher unternommen haben, und erklären Sie, warum das nicht geholfen hat.\n" +
    "- Schlagen Sie eine Lösung vor und bitten Sie um eine Antwort bis zu einem bestimmten Termin.\n\n" +
    "Schreiben Sie ca. 120-150 Wörter. Vergessen Sie die formelle Anrede und die Grußformel nicht.",
  [
    "Problem schildern (Unterricht fällt häufig aus, Termine werden kurzfristig geändert) UND Folgen für die Person nennen (z. B. Lernfortschritt, Terminplanung, Mehrkosten)",
    "Bisherige Schritte nennen (z. B. Gespräch mit der Lehrkraft, Nachfrage im Sekretariat, frühere E-Mail) UND erklären, warum das nicht geholfen hat (z. B. keine Antwort, Zusagen nicht eingehalten)",
    "Lösung vorschlagen (z. B. fester Stundenplan, Nachholtermine, teilweise Erstattung der Gebühr) UND um eine Antwort bis zu einem genannten Termin bitten (konkrete Frist)",
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
    ["Name", "Wohnsituation (Stadt oder Region)", "aktuelle Tätigkeit oder Ausbildung", "Hobbys", "Pläne für die nächsten Jahre"],
    [
      "Name und Wohnsituation (Stadt oder Region) genannt",
      "aktuelle Tätigkeit oder Ausbildung genannt und kurz beschrieben",
      "Hobbys oder Interessen mit mindestens einem Beispiel",
      "Pläne für die nächsten Jahre genannt",
    ],
  ),
  presentationTask(
    "Wohnen: Stadt oder Land?",
    [
      "Wo wohnen Sie jetzt, und was gefällt Ihnen daran besonders?",
      "Welche Vorteile hat das Leben in der Stadt, welche das Leben auf dem Land?",
      "Welche Probleme gibt es, zum Beispiel beim Verkehr, bei den Kosten oder bei Freizeitangeboten?",
      "Wo möchten Sie in zehn Jahren am liebsten leben? Begründen Sie Ihre Meinung.",
    ],
    [
      "Thema vorgestellt, eigene Wohnsituation und was daran gefällt",
      "Vor- und Nachteile von Stadt und Land mit Beispielen",
      "Probleme (Verkehr, Kosten, Freizeitangebote) genannt",
      "eigener Wunsch für die Zukunft mit Begründung und Schluss",
    ],
  ),
];

export const INTERIM_B: SeedCourseForm = {
  key: "B2.1",
  form: "B",
  syllabus: INTERIM_SYLLABUS,
  sections: [
    {
      section: "READING",
      stimuli: [reading1, reading2],
      items: [
        tfng("READING", R1, "detail", "MID",
          [
            ["Weil Asphalt und Beton Wärme speichern, kühlen dicht bebaute Viertel nachts nur langsam ab.", "R"],
            ["Die Pflege der jungen Bäume übernimmt ausschließlich die Stadt.", "F"],
            ["Die Umweltdezernentin verweist auf Untersuchungen, nach denen schattige Einkaufsstraßen häufiger besucht werden.", "R"],
          ],
          "1: Asphalt und Beton „geben sie nachts nur langsam wieder ab“. 2: Anwohner können eine Patenschaft übernehmen und die Bäume gießen, die Stadt ist auf Hilfe angewiesen. 3: „Untersuchungen in anderen Städten zeigten, dass schattige Einkaufsstraßen häufiger besucht würden“."),
        whichText(R2, "detail", "MID",
          "Wo wird erwähnt, dass eine Behörde unter bestimmten Bedingungen die Kosten übernimmt?",
          ["Text A", "Text C", "Text D"], 1,
          "Text C: Die Agentur für Arbeit übernimmt die Kursgebühr, wenn ein Bildungsgutschein vorliegt. Text A erwähnt keine Kosten, Text D auch nicht."),
        whichText(R2, "detail", "MID",
          "Wer warnt davor, einen Berufswechsel zu überstürzen?",
          ["Text B", "Text C", "Text D"], 0,
          "Text B: „Überstürzen Sie nichts.“ Text C wirbt für einen Kurs, Text D berichtet von einem Praktikum, nicht von einem Berufswechsel."),
        whichText(R2, "inference", "HARD",
          "Wer sagt im Rückblick, dass er etwas anders hätte machen sollen?",
          ["Text A", "Text B", "Text D"], 2,
          "Text D: „hätte ich mich vorher besser informieren sollen“. Text B nennt den Wechsel eine „richtige Entscheidung“."),
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
          "Warum ist die Reparatur teurer geworden als geschätzt?",
          [
            "Weil die Bremsbeläge mehr gekostet haben als besprochen.",
            "Weil auch die Lichtanlage repariert werden musste.",
            "Weil zusätzlich die Kette ausgetauscht werden musste.",
          ], 2,
          "Die Bremsbeläge wurden „wie besprochen“ erneuert (fünfunddreißig Euro), das Licht „nur geprüft“. Teurer wurde es, weil auch die Kette ausgetauscht werden musste."),
        announcementQuestion(L2, "detail", "MID",
          "Wann beginnt die Führung durch die Sonderausstellung heute?",
          [
            "Sie beginnt erst um halb zwölf.",
            "Sie beginnt wie angekündigt um elf Uhr.",
            "Sie beginnt am Nachmittag um halb zwei.",
          ], 0,
          "Der Sprecher korrigiert sich: Wegen einer Schulklasse beginnt die Führung erst um halb zwölf. Um dreizehn Uhr dreißig gibt es die nächste Führung."),
        announcementQuestion(L3, "detail", "MID",
          "Was müssen Anrufer tun, die ihre Bescheinigung für den Arbeitgeber verloren haben?",
          [
            "Sie drücken die Eins.",
            "Sie drücken die Zwei.",
            "Sie bleiben in der Leitung.",
          ], 1,
          "Die Zwei gilt für Rechnungen und verlorene Bescheinigungen. Die Eins betrifft den Beitrag, in der Leitung bleiben nur Anrufer mit anderen Anliegen."),
        tfng("LISTENING", L4, "detail", "MID",
          [
            ["Karim hat sich schon entschieden, sein Studium abzubrechen.", "F"],
            ["Karims Cousin arbeitet heute bei einem großen Industrieunternehmen.", "NG"],
            ["Mit Abitur und Studienerfahrung kann die Ausbildung in manchen Betrieben verkürzt werden.", "R"],
          ],
          "1: „Ich bin auch nicht sicher, ob ein Abbruch klug ist.“ 2: Der Cousin hat eine Ausbildung als Mechatroniker gemacht, wo er heute arbeitet, sagt Mara nicht. 3: „Mit Abitur und zwei Jahren Studium bekommst du in manchen Betrieben die Ausbildung verkürzt.“"),
      ],
    },
    { section: "WRITING", stimuli: [], items: [writing] },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
