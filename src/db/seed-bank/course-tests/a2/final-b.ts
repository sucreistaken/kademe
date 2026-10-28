import type { SeedCourseForm } from "../types";
import { LIFE_TIME, INTRO_TIME, PROPOSAL_TIME, WRITING_WORDS, a, choice3, cloze3, finalSyllabus, stimuliOf, writingPrompt } from "./kit";

/**
 * Abschlusstest A2, form B (spec 2026-10-28). Netzwerk neu A2, Kapitel 1-12; parallel to form A (same grammar
 * phenomena in the same order, see final-a.ts) with other texts and sentences, and nothing shared with the
 * Zwischentest A2.1.
 */
const s = stimuliOf("ct-a2f-b");

// ================================================================ READING

const wohnenFuerHilfe = s.text(
  "wohnen-fuer-hilfe",
  "Wohnen für Hilfe",
  "Wohnen und Zusammenleben",
  `
Seit einem Jahr wohnt die Studentin Leonie Bauer bei Margarete Grabowski in Münster. Frau Grabowski ist Rentnerin und lebt schon lange allein in einem großen Haus mit Garten. Leonie hat ein Zimmer im ersten Stock und darf die Küche und das Bad benutzen.

Die Idee heißt „Wohnen für Hilfe“. Leonie bezahlt nur 150 Euro Miete im Monat, das ist sehr wenig für Münster. Dafür hilft sie Frau Grabowski: Sie kauft zweimal pro Woche ein, arbeitet im Garten und bringt den Müll raus. Putzen muss sie nicht, dafür kommt jeden Freitag eine Firma.

Am Anfang war das Zusammenleben nicht immer leicht. Frau Grabowski wollte ab zehn Uhr abends Ruhe haben, und Leonie hat oft spät mit ihren Freunden telefoniert. „Wir haben dann zusammen Regeln gemacht“, erzählt Leonie. Heute kochen die beiden am Sonntag oft zusammen, und Frau Grabowski erzählt Geschichten von früher. Leonie hilft ihr dafür am Computer.

Nach dem Studium möchte Leonie in Hamburg arbeiten. „Ich vermisse Frau Grabowski jetzt schon“, sagt sie. „Aber ich komme sie bestimmt oft besuchen.“
`,
);

const nachrichten = s.text(
  "nachrichten",
  "Aushang, Anzeige, Forum und Blog",
  "Alltag und Kultur",
  `
Text A - Aushang im Treppenhaus
Liebe Nachbarinnen und Nachbarn, ab Montag, 3. März, renovieren Handwerker die Treppe in unserem Haus. Bitte benutzen Sie in dieser Woche den Aufzug. Fahrräder und Kinderwagen dürfen nicht im Treppenhaus stehen, bitte stellen Sie sie in den Keller. Es kann laut werden, besonders am Vormittag. Vielen Dank für Ihr Verständnis! Ihre Hausverwaltung Sommer

Text B - Anzeige
Fahrrad zu verkaufen! Damenrad, drei Jahre alt, sehr guter Zustand, mit neuem Licht. Ich verkaufe es, weil ich nach München umziehe. Preis: 180 Euro. Sie können das Rad am Wochenende gern vorher Probe fahren. Schreiben Sie mir eine SMS: 0176 / 2345 678, Sofia

Text C - Beitrag im Forum
Hallo zusammen! Ich arbeite Vollzeit, habe zwei kleine Kinder und mache abends noch einen Deutschkurs. Ich habe nie Zeit für mich selbst und schlafe zu wenig. Wie organisiert ihr eure Woche? Habt ihr gute Tipps oder eine App für Termine? Danke! Hoang

Text D - Blogeintrag
Gestern war ich zum ersten Mal in der Oper! Ehrlich gesagt hatte ich ein bisschen Angst, dass es langweilig ist. Aber die Musik war wunderschön, und über der Bühne gab es den Text auf Deutsch, so konnte ich alles gut verstehen. Die Karte hat nur 15 Euro gekostet, weil ich Studentin bin. Ich gehe bestimmt bald wieder hin! Eure Paulina
`,
);

const rWohnen = a.forText(wohnenFuerHilfe);

const reading = [
  rWohnen.tfng(
    "detail",
    "MID",
    [
      ["Für ein Zimmer in Münster ist Leonies Miete sehr niedrig.", "R"],
      ["Leonie muss jede Woche das Haus putzen.", "F"],
      ["Am Anfang hatten die beiden Probleme mit der Ruhe am Abend.", "R"],
      ["Frau Grabowski hilft Leonie am Computer.", "F"],
      ["Nach dem Studium möchte Leonie in Münster bleiben.", "F"],
    ],
    "1 R: 150 Euro im Monat, das ist sehr wenig für Münster. 2 F: Putzen muss sie nicht, dafür kommt eine Firma. 3 R: Frau Grabowski wollte ab zehn Uhr Ruhe, Leonie hat spät telefoniert. 4 F: Es ist umgekehrt, Leonie hilft Frau Grabowski am Computer. 5 F: Sie möchte in Hamburg arbeiten.",
  ),
  choice3(
    nachrichten,
    "detail",
    "MID",
    "Wo soll man etwas in den Keller bringen?",
    "Text A",
    ["Text B", "Text D"],
    0,
    "Text A: Fahrräder und Kinderwagen bitte in den Keller stellen. In Text B geht es zwar auch um ein Fahrrad, aber es wird verkauft. Text D erzählt von der Oper.",
  ),
  choice3(
    nachrichten,
    "detail",
    "MID",
    "Wer hat zu wenig Freizeit?",
    "Text C",
    ["Text A", "Text D"],
    1,
    "Text C: Hoang arbeitet, hat Kinder und einen Kurs und hat nie Zeit für sich selbst. Paulina in Text D hatte Zeit für die Oper, Text A ist eine Information der Hausverwaltung.",
  ),
  choice3(
    nachrichten,
    "detail",
    "MID",
    "Wo kann man etwas zuerst ausprobieren?",
    "Text B",
    ["Text A", "Text D"],
    1,
    "Text B: Man kann das Rad am Wochenende vorher Probe fahren. Text D erzählt von einem Opernbesuch, dort kann man nichts testen. Text A ist eine Bitte an die Nachbarn.",
  ),
  choice3(
    nachrichten,
    "detail",
    "MID",
    "Wer hat zum ersten Mal etwas Neues gemacht?",
    "Text D",
    ["Text B", "Text C"],
    2,
    "Text D: Paulina war gestern zum ersten Mal in der Oper. Hoang in Text C macht schon einen Deutschkurs, Sofia in Text B verkauft ihr Rad.",
  ),
  choice3(
    nachrichten,
    "detail",
    "MID",
    "Wo steht, dass es bald laut sein kann?",
    "Text A",
    ["Text B", "Text C"],
    0,
    "Text A: Handwerker renovieren die Treppe, es kann laut werden, besonders am Vormittag. Text B und Text C sprechen nicht von Lärm.",
  ),
];

// ================================================================ GRAMMAR

const cloze = cloze3("MID", {
  title: "Eine Radtour nach Potsdam",
  first: "Liebe Amira, vielen Dank für deine Nachricht!",
  body:
    "Am Sonntag [[bin|habe|hatte#perfekt.hilfsverb]] ich mit meinem Fahrradclub nach Potsdam gefahren. " +
    "Unterwegs [[hatte|war|hätte#praeteritum]] ich leider ein Problem mit dem Rad, aber ein Freund hat es schnell repariert. " +
    "Mittags haben wir [[auf der|auf die|auf den#wechselpraeposition]] Wiese an einem See gegessen. " +
    "[[Als|Wenn|Wann#konnektor.als_wenn]] wir am Nachmittag in Potsdam angekommen sind, hat es plötzlich stark geregnet. " +
    "Die Rückfahrt hat viel [[länger|lang|am längsten#adjektiv.komparativ]] gedauert als die Hinfahrt, und am Abend habe ich [[mich|mir|sich#reflexiv]] sofort aufs Sofa gelegt. " +
    "Ich war total nass und müde, [[trotzdem|deshalb|weil#konnektor]] war es ein toller Tag. " +
    "Unser Gruppenleiter, [[der|den|dem#relativsatz]] schon seit zwanzig Jahren im Club ist, kennt nämlich die schönsten Wege. " +
    "Im Mai machen wir einen [[langen|langer|langes#adjektivendung]] Ausflug an die Ostsee, und die Tour gefällt [[dir|dich|du#dativ]] bestimmt, denn du fährst doch so gern Rad.",
  last: "Komm doch einfach mit, ich freue mich!",
  note: "Perfekt mit „sein“ bei fahren (g1), Präteritum von „haben“ (g2), Wechselpräposition mit Dativ auf die Frage „wo?“ (g3), „als“ für ein einmaliges Ereignis in der Vergangenheit (g4), Komparativ mit „als“ (g5), Reflexivpronomen zu „ich“ (g6), „trotzdem“ für einen Gegensatz (g7), Relativpronomen im Nominativ (g8), Adjektivendung nach „einen“ (g9), Verb mit Dativ: gefallen (g10).",
});

const sentences = [
  a.grammarChoice(
    "perfekt.partizip",
    "EASY",
    "Hast du heute schon etwas ____?",
    "gegessen",
    ["essen", "aß", "isst"],
    2,
    "Perfekt: Partizip II eines unregelmäßigen Verbs (essen: gegessen)",
  ),
  a.grammarChoice(
    "praeteritum",
    "MID",
    "Als Kind ____ ich jeden Tag Klavier üben.",
    "musste",
    ["muss", "müsste", "gemusst"],
    1,
    "Präteritum der Modalverben (müssen: musste)",
  ),
  a.grammarChoice(
    "nebensatz",
    "MID",
    "Wir bleiben heute zu Hause, ____ es draußen sehr kalt ist.",
    "weil",
    ["denn", "deshalb", "trotzdem"],
    0,
    "Nebensatz mit „weil“: Das konjugierte Verb steht am Ende (nach „denn“ stünde es an zweiter Stelle)",
  ),
  a.grammarChoice(
    "nebensatz",
    "MID",
    "Unsere Lehrerin sagt, dass ____.",
    "wir mehr Deutsch sprechen sollen",
    ["wir sollen mehr Deutsch sprechen", "sollen wir mehr Deutsch sprechen", "wir mehr Deutsch sollen sprechen"],
    3,
    "Nebensatz mit „dass“: Das konjugierte Verb steht am Ende",
  ),
  a.grammarChoice(
    "wortstellung.inversion",
    "MID",
    "Wenn mein Zug Verspätung hat, ____.",
    "rufe ich im Büro an",
    ["ich rufe im Büro an", "ich im Büro anrufe", "im Büro rufe ich an"],
    2,
    "Hauptsatz nach einem vorangestellten „wenn“-Satz: Das Verb steht an erster Stelle des Hauptsatzes",
  ),
  a.grammarChoice(
    "adjektiv.superlativ",
    "MID",
    "Von allen Verkehrsmitteln ist das Fahrrad für mich ____.",
    "am praktischsten",
    ["praktischsten", "praktischer", "praktisch"],
    1,
    "Superlativ mit „am“ (am praktischsten)",
  ),
  a.grammarChoice(
    "konjunktiv2.modal",
    "MID",
    "____ du bitte das Fenster zumachen? Mir ist kalt.",
    "Würdest",
    ["Wurdest", "Würdet", "Geworden"],
    0,
    "Höfliche Bitte mit Konjunktiv II („würdest du“)",
  ),
  a.grammarChoice(
    "praeposition.ort",
    "MID",
    "Gehen Sie die Hauptstraße ____ bis zur Ampel.",
    "entlang",
    ["durch", "vorbei", "herum"],
    3,
    "Lokale Präposition: „entlang“ nach dem Akkusativ (die Hauptstraße entlang)",
  ),
  a.grammarChoice(
    "wechselpraeposition",
    "MID",
    "Dein Handy liegt doch auf ____ Sofa.",
    "dem",
    ["das", "den", "der"],
    2,
    "Wechselpräposition mit Dativ auf die Frage „wo?“ (auf dem Sofa liegen)",
  ),
  a.grammarChoice(
    "nebensatz",
    "MID",
    "Ich weiß nicht, ____.",
    "ob der Kurs morgen stattfindet",
    ["ob findet der Kurs morgen statt", "findet der Kurs morgen statt", "ob der Kurs morgen stattfinden"],
    1,
    "Indirekte Frage mit „ob“: Das konjugierte Verb steht am Ende",
  ),
  a.grammarChoice(
    "konjunktiv2.modal",
    "MID",
    "Sie sehen sehr müde aus. Sie ____ heute früher ins Bett gehen.",
    "sollten",
    ["sollte", "solltest", "solltet"],
    0,
    "Ratschlag mit „sollte“ (Konjunktiv II von „sollen“), Form zu „Sie“",
  ),
  a.grammarChoice(
    "konnektor",
    "MID",
    "Mein Fahrrad ist kaputt. ____ fahre ich heute mit dem Bus.",
    "Deshalb",
    ["Trotzdem", "Weil", "Denn"],
    3,
    "„deshalb“ für eine Folge, mit dem Verb direkt danach",
  ),
  a.grammarChoice(
    "verb_praeposition",
    "MID",
    "Interessierst du dich auch ____ Fußball?",
    "für",
    ["an", "auf", "über"],
    1,
    "Verb mit fester Präposition (sich interessieren für + Akkusativ)",
  ),
  a.grammarChoice(
    "relativsatz",
    "MID",
    "Der Kuchen, ____ du gebacken hast, schmeckt sehr gut.",
    "den",
    ["der", "das", "dem"],
    2,
    "Relativpronomen im Akkusativ (der Kuchen: den)",
  ),
  a.grammarChoice(
    "konjunktiv2",
    "MID",
    "Heute ist es so heiß! Ich ____ jetzt gern am Meer.",
    "wäre",
    ["war", "hätte", "würde"],
    0,
    "Wunsch mit Konjunktiv II („wäre gern“)",
  ),
];

// ================================================================ LISTENING

const verkehr = s.clip("verkehr", "Verkehrsmeldungen im Radio", "Verkehr und Reisen", [{ label: "Moderator", voice: "B" }], [
  "Moderator: Und hier die Verkehrsmeldungen. Auf der A3 zwischen Köln und Frankfurt gibt es nach einem Unfall zehn Kilometer Stau. Wenn Sie nach Frankfurt wollen, fahren Sie lieber über die A61. In Köln ist außerdem die Brückenstraße wegen einer Baustelle bis Freitag gesperrt. Und auch bei der Bahn gibt es Probleme: Die S-Bahn zum Flughafen fährt heute nur alle dreißig Minuten. Gute Fahrt!",
]);

const schwimmbad = s.clip("schwimmbad", "Durchsage im Schwimmbad", "Sport und Freizeit", [{ label: "Durchsage", voice: "D" }], [
  "Durchsage: Liebe Badegäste, eine kurze Information: Ab fünfzehn Uhr trainiert der Schwimmverein im großen Becken. Das große Becken ist deshalb bis siebzehn Uhr geschlossen. Das kleine Becken und die Sauna sind aber wie immer geöffnet. Für Kinder gibt es um sechzehn Uhr ein Spiel im kleinen Becken. Und unser Café im ersten Stock hat heute bis neunzehn Uhr geöffnet. Vielen Dank!",
]);

const theater = s.clip("theater", "Telefonansage des Theaters", "Theater und Kultur", [{ label: "Ansage", voice: "C" }], [
  "Ansage: Herzlich willkommen beim Stadttheater Ulm. Unsere Theaterkasse ist von Dienstag bis Samstag von elf bis achtzehn Uhr geöffnet. Am Sonntag ist die Kasse nur eine Stunde vor der Vorstellung geöffnet, und am Montag ist das Theater geschlossen. Karten können Sie auch jederzeit im Internet kaufen. Schüler und Studenten bezahlen nur die Hälfte. Für Informationen zum Programm drücken Sie bitte die Eins.",
]);

const kursleiterin = s.clip("kursleiterin", "Nachricht der Kursleiterin", "Kurs und Lernen", [{ label: "Frau Vogel", voice: "A" }], [
  "Frau Vogel: Hallo, hier ist Katrin Vogel, Ihre Kursleiterin. Eine Info für morgen: Wir treffen uns nicht in Raum zwölf, sondern in Raum zwanzig im zweiten Stock, weil wir dort am Computer arbeiten. Bringen Sie bitte Ihre Kopfhörer mit. Die Hausaufgabe auf Seite fünfundvierzig machen wir erst am Donnerstag zusammen, die müssen Sie also noch nicht fertig haben. Bis morgen!",
]);

const umzug = s.clip("umzug", "Nachricht einer Freundin", "Umzug und Freunde", [{ label: "Sara", voice: "D" }], [
  "Sara: Hallo Tim, hier ist Sara. Du, wir ziehen ja am Samstag um. Kannst du vielleicht schon um neun kommen und nicht erst um elf? Der Transporter kommt nämlich schon um halb neun. Und hast du noch deine große Leiter? Die brauchen wir für die Lampen. Mittags gibt's bei uns Pizza für alle. Ruf mich bitte kurz zurück, ja? Tschüss!",
]);

const pruefung = s.clip(
  "pruefung",
  "Vor der Prüfung",
  "Lernen und Prüfungen",
  [
    { label: "Ibrahim", voice: "C" },
    { label: "Jana", voice: "A" },
  ],
  [
    "Ibrahim: Hallo Jana! Na, bist du bereit für die Prüfung am Freitag?",
    "Jana: Hallo Ibrahim! Ehrlich gesagt, nein. Ich habe ein bisschen Angst vor dem Schreiben.",
    "Ibrahim: Echt? Aber du schreibst doch so gute E-Mails!",
    "Jana: Im Kurs schon, aber in der Prüfung hat man nur zwanzig Minuten. Das ist so wenig Zeit.",
    "Ibrahim: Ich finde das Hören am schwierigsten. Die Leute sprechen so schnell.",
    "Jana: Hörst du denn manchmal deutsche Podcasts? Das hat mir sehr geholfen.",
    "Ibrahim: Nein, noch nie. Kennst du einen guten Podcast für Lernende?",
    "Jana: Ja, ich schicke dir heute Abend ein paar Links. Du solltest jeden Tag ein bisschen hören, zum Beispiel im Bus.",
    "Ibrahim: Gute Idee, das mache ich. Sag mal, wollen wir am Mittwoch zusammen lernen? In der Bibliothek?",
    "Jana: Am Mittwoch arbeite ich leider bis sechs. Aber am Donnerstag habe ich frei.",
    "Ibrahim: Super, dann treffen wir uns am Donnerstag um vier in der Bibliothek.",
    "Jana: Perfekt. Und danach gehen wir zusammen einen Kaffee trinken, okay?",
  ],
);

const lPruefung = a.forClip(pruefung);

const listening = [
  choice3(
    verkehr,
    "detail",
    "MID",
    "Was sollen Autofahrer nach Frankfurt machen?",
    "Eine andere Autobahn nehmen.",
    ["Mit der S-Bahn fahren.", "Über die Brückenstraße fahren."],
    1,
    "\"Wenn Sie nach Frankfurt wollen, fahren Sie lieber über die A61.\" Die S-Bahn fährt zum Flughafen und hat selbst Probleme. Die Brückenstraße ist gesperrt.",
  ),
  choice3(
    schwimmbad,
    "detail",
    "MID",
    "Was können die Gäste ab fünfzehn Uhr nicht benutzen?",
    "Das große Becken.",
    ["Das kleine Becken.", "Die Sauna."],
    0,
    "\"Das große Becken ist deshalb bis siebzehn Uhr geschlossen.\" Das kleine Becken und die Sauna sind wie immer geöffnet.",
  ),
  choice3(
    theater,
    "detail",
    "MID",
    "Wann kann man am Sonntag an der Kasse Karten kaufen?",
    "Eine Stunde vor der Vorstellung.",
    ["Von elf bis achtzehn Uhr.", "Gar nicht, dann ist die Kasse geschlossen."],
    2,
    "\"Am Sonntag ist die Kasse nur eine Stunde vor der Vorstellung geöffnet.\" Von elf bis achtzehn Uhr gilt von Dienstag bis Samstag. Geschlossen ist das Theater am Montag.",
  ),
  choice3(
    kursleiterin,
    "detail",
    "MID",
    "Was sollen die Kursteilnehmer morgen mitbringen?",
    "Ihre Kopfhörer.",
    ["Einen Computer.", "Die fertige Hausaufgabe."],
    0,
    "\"Bringen Sie bitte Ihre Kopfhörer mit.\" Die Computer sind im Raum. Die Hausaufgabe machen alle erst am Donnerstag zusammen.",
  ),
  choice3(
    umzug,
    "detail",
    "MID",
    "Wann soll Tim am Samstag kommen?",
    "Um neun Uhr.",
    ["Um halb neun.", "Um elf Uhr."],
    1,
    "\"Kannst du vielleicht schon um neun kommen und nicht erst um elf?\" Um halb neun kommt der Transporter.",
  ),
  lPruefung.tfng(
    "detail",
    "MID",
    [
      ["Jana fühlt sich gut auf die Prüfung vorbereitet.", "F"],
      ["Jana findet die Zeit für das Schreiben in der Prüfung zu kurz.", "R"],
      ["Ibrahim hört schon oft deutsche Podcasts.", "F"],
      ["Jana will Ibrahim ein paar Links schicken.", "R"],
      ["Die beiden lernen am Mittwoch zusammen.", "F"],
    ],
    "1 F: Sie hat ein bisschen Angst vor dem Schreiben. 2 R: \"In der Prüfung hat man nur zwanzig Minuten. Das ist so wenig Zeit.\" 3 F: Er hat noch nie deutsche Podcasts gehört. 4 R: Sie schickt ihm heute Abend ein paar Links. 5 F: Am Mittwoch arbeitet Jana, sie lernen am Donnerstag zusammen.",
  ),
];

// ================================================================ WRITING

const writing = a.writing(
  "email",
  "MID",
  WRITING_WORDS,
  writingPrompt(
    "Sie haben Ihre Tasche im Zug vergessen. Schreiben Sie eine E-Mail an das Fundbüro der Bahn.",
    ["Schreiben Sie, wann und wohin Sie gefahren sind.", "Beschreiben Sie Ihre Tasche und sagen Sie, was darin ist.", "Bitten Sie um eine Antwort."],
    true,
  ),
  [
    "Sagen, wann (Tag oder Uhrzeit) UND wohin man gefahren ist (Strecke oder Zug)",
    "Die Tasche beschreiben (z. B. Farbe, Größe) UND mindestens einen Gegenstand darin nennen",
    "Um eine Antwort bitten (Frage oder höfliche Bitte; Telefonnummer oder E-Mail-Adresse ist gut, aber nicht nötig)",
  ],
  ["wann und wohin", "Tasche und Inhalt", "um eine Antwort bitten"],
  "formell (Sie)",
  "Formelle E-Mail an ein Fundbüro (Kapitel 7: Unterwegs, Reisen). Alle drei Punkte müssen erkennbar sein; formelle Anrede („Sehr geehrte Damen und Herren“) und Gruß gehören dazu. Erwartet werden das Perfekt, eine Beschreibung mit Adjektiven und eine höfliche Bitte („Könnten Sie ...?“).",
);

// ================================================================ SPEAKING

const speaking = [
  a.speaking(
    "introduction",
    "EASY",
    INTRO_TIME,
    "Erzählen Sie bitte ein bisschen über sich.\n\n- Name\n- Stadt oder Region, in der Sie wohnen\n- Beruf oder Tätigkeit\n- Was Sie gern in Ihrer Freizeit machen\n- Welche Sprachen Sie sprechen",
    [
      "Name nennen",
      "Wohnort nennen (Stadt oder Region)",
      "Beruf, Ausbildung, Studium oder Tätigkeit nennen",
      "Freizeit oder Hobbys nennen, mit mindestens einem Detail",
      "Sprachen nennen, die man spricht oder lernt",
    ],
    [],
    "Sich vorstellen als Monolog. Ausreichend sind zusammenhängende Sätze zu den fünf Stichwörtern; weitere persönliche Angaben, die nicht auf der Karte stehen, werden weder verlangt noch bewertet.",
  ),
  a.speaking(
    "monologue",
    "MID",
    LIFE_TIME,
    "Erzählen Sie bitte von Sport und Bewegung in Ihrem Alltag.\n\n- Welchen Sport machen Sie, oder wie bewegen Sie sich im Alltag?\n- Wie oft und wo?\n- Allein oder mit anderen?\n- Warum ist Bewegung für Sie wichtig, oder warum nicht?",
    [
      "Eine Sportart oder Bewegung im Alltag nennen (z. B. Fahrrad fahren, zu Fuß gehen)",
      "Sagen, wie oft und wo",
      "Sagen, ob allein oder mit anderen, gern mit einem Grund",
      "Begründen, warum Bewegung wichtig oder nicht so wichtig ist",
    ],
    [],
    "Über das eigene Leben sprechen (Kapitel 9: Sport). Erwartet werden Sätze im Präsens, Begründungen mit „weil“ oder „deshalb“ und Häufigkeitsangaben.",
  ),
  a.speaking(
    "proposal",
    "MID",
    PROPOSAL_TIME,
    "Sie möchten am Wochenende mit zwei Freunden einen Ausflug machen.\n\nMachen Sie Vorschläge und sagen Sie, warum Sie das gut finden:\n- Wohin?\n- Wann treffen Sie sich?\n- Wie fahren Sie dorthin?\n- Was nehmen Sie mit?",
    [
      "Zu jedem der vier Punkte einen Vorschlag machen",
      "Mindestens zwei Vorschläge begründen",
      "Redemittel für Vorschläge benutzen (z. B. „Wir könnten ...“, „Wie wäre es mit ...?“, „Ich schlage vor, ...“)",
      "Zum Schluss den Plan kurz zusammenfassen",
    ],
    [],
    "Vorschläge machen und gemeinsam etwas planen, als Monolog (Kapitel 9, 11 und 12: Verabredungen, Pläne, einen Ausflug planen). Erwartet werden Konjunktiv II („Wir könnten ...“) und Begründungen mit „weil“ oder „denn“.",
  ),
];

export const A2_FINAL_B: SeedCourseForm = {
  key: "A2",
  form: "B",
  syllabus: finalSyllabus(),
  sections: [
    { section: "READING", stimuli: [wohnenFuerHilfe, nachrichten], items: reading },
    { section: "GRAMMAR", stimuli: [], items: [cloze, ...sentences] },
    { section: "LISTENING", stimuli: [verkehr, schwimmbad, theater, kursleiterin, umzug, pruefung], items: listening },
    { section: "WRITING", stimuli: [], items: [writing] },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
