import type { SeedCourseForm } from "../types";
import {
  a1Form,
  announcementPick,
  CARD,
  clip,
  cloze3,
  INFORMAL,
  INTRO,
  listeningTfng,
  readingText,
  readingTfng,
  sentence,
  SYLLABUS_SOURCE,
  speakingTask,
  whichText,
  writingTask,
} from "./build";

/** Zwischentest A1.1, Form B: Netzwerk neu A1, Kapitel 1-6; same structure and phenomena as form A (spec 2026-10-28). */

// ---------------------------------------------------------------- READING

const alltag = readingText(
  "course-a1-1-b-r-marco-alltag",
  "Mein Alltag",
  "Beruf und Tagesablauf",
  `
Ich heiße Marco und bin Koch von Beruf. Ich arbeite in einem Restaurant in Leipzig. Mein Tag beginnt früh: Ich stehe um halb sechs auf und frühstücke mit meiner Frau und unseren zwei Kindern. Um sieben Uhr bringe ich die Kinder in die Schule. Dann fahre ich mit dem Fahrrad zur Arbeit.

Von zehn bis vierzehn Uhr kochen wir das Mittagessen, dann habe ich Pause. Am Abend arbeite ich noch einmal von 17 bis 22 Uhr. Das ist lang! Aber am Sonntag und Montag habe ich frei. Dann spielen wir im Park Fußball oder wir besuchen meine Eltern.
`,
);

const vierTexte = readingText(
  "course-a1-1-b-r-vier-texte",
  "Vier kurze Texte",
  "Alltag in der Stadt",
  `
Text A: Aushang in der Bäckerei
Frische Brötchen ab 6 Uhr! Die Bäckerei Hahn ist montags geschlossen. Dienstag bis Samstag sind wir von 6 bis 18 Uhr für Sie da. Am Sonntag ist offen von 7 bis 12 Uhr.

Text B: Nachricht von Paul
Hallo Anna, es tut mir leid, ich komme zehn Minuten später. Mein Bus hat Verspätung. Du kannst im Café warten. Bis gleich! Paul

Text C: Anzeige
Zimmer frei! Schönes Zimmer in einer WG, 14 qm, 300 Euro. Küche und Bad zusammen. Ab 1. Mai. Bitte rufen Sie an: 0341 88 71 20 (Frau Koch)

Text D: Beitrag im Internetforum
Hallo, ich spiele gern Fußball und suche eine Mannschaft in Leipzig. Ich kann am Dienstag und am Donnerstag am Abend spielen. Wer spielt mit? Danke! Amir
`,
);

const reading = [
  readingTfng(
    alltag.key,
    "detail",
    "EASY",
    [
      ["Marco steht um sieben Uhr auf.", "F"],
      ["Marco fährt mit dem Bus zur Arbeit.", "F"],
      ["Marco hat am Montag frei.", "R"],
    ],
    "Marco steht um halb sechs auf; um sieben Uhr bringt er die Kinder in die Schule. Er fährt mit dem Fahrrad, nicht mit dem Bus. Sonntag und Montag hat er frei.",
  ),
  whichText(
    vierTexte.key,
    "detail",
    "EASY",
    "In welchem Text steht eine Telefonnummer?",
    ["Text C", "Text A", "Text D"],
    "Text C",
    "Nur Text C nennt eine Telefonnummer (0341 88 71 20). Text A nennt Öffnungszeiten, Text B eine Verspätung, Text D sucht eine Mannschaft.",
  ),
  whichText(
    vierTexte.key,
    "gist",
    "MID",
    "In welchem Text sucht jemand eine Mannschaft?",
    ["Text B", "Text A", "Text D"],
    "Text D",
    "Amir spielt gern Fußball und sucht eine Mannschaft in Leipzig (Text D). In der Bäckerei (Text A) geht es um Öffnungszeiten, in Text B um eine Verspätung.",
  ),
  whichText(
    vierTexte.key,
    "gist",
    "MID",
    "In welchem Text entschuldigt sich jemand?",
    ["Text D", "Text B", "Text C"],
    "Text B",
    "Paul schreibt: „Es tut mir leid, ich komme zehn Minuten später.“ Er entschuldigt sich für seine Verspätung (Text B). In den Texten C und D steht keine Entschuldigung.",
  ),
];

// ---------------------------------------------------------------- GRAMMAR

const grammar = [
  cloze3("MID", {
    title: "Mein neuer Job",
    first: "Hallo Tom, ich habe einen neuen Job in einem Restaurant in Bremen.",
    body:
      "Mein Chef [[ist|bin|sind#praesens.sein]] sehr nett. " +
      "Er [[fährt|fahrt|fahren#praesens.vokalwechsel]] jeden Tag mit dem Fahrrad zur Arbeit. " +
      "[[Am|Um|Im#praeposition.zeit]] Wochenende arbeiten wir nicht. " +
      "Morgens trinke ich immer [[einen|ein|eine#artikel.akkusativ]] Tee. " +
      "Später [[möchte|möchtest|möchten#modalverb.konjugation]] ich selbst Koch werden. " +
      "Mittags habe ich leider [[keine|kein|nicht#negation.kein]] Pause.",
    last: "Wie geht es dir?",
    note: "sein im Präsens (g1), Vokalwechsel a > ä bei er/sie/es (g2), Zeitangabe mit am (g3), Akkusativ des unbestimmten Artikels (g4), Modalverb zu ich (g5), kein bei einem femininen Nomen (g6).",
  }),
  sentence(
    "wfrage",
    "EASY",
    "___ wohnst du? - In Berlin.",
    "Wo",
    ["Wer", "Was", "Wann"],
    0,
    "Nach dem Ort fragt man mit „Wo“. „Wer“ fragt nach einer Person, „Was“ nach einer Sache, „Wann“ nach der Zeit.",
  ),
  sentence(
    "praesens.regelmaessig",
    "EASY",
    "Wann ___ ihr heute Abend nach Hause? - Um acht Uhr.",
    "kommt",
    ["komme", "kommst", "kommen"],
    2,
    "Zu „ihr“ gehört die Endung -t: ihr kommt. „komme“ ist ich, „kommst“ ist du, „kommen“ ist wir/sie.",
  ),
  sentence(
    "plural",
    "MID",
    "Wir kaufen heute drei ___.",
    "Äpfel",
    ["Apfel", "Apfeln", "Äpfeln"],
    1,
    "Plural von „der Apfel“: die Äpfel (Umlaut). „Apfel“ ist der Singular, „Apfeln“ eine falsche Form, „Äpfeln“ steht nur im Dativ Plural.",
  ),
  sentence(
    "imperativ.sie",
    "MID",
    "Bitte ___ Sie das Fenster.",
    "öffnen",
    ["öffne", "öffnet", "öffnest"],
    3,
    "Imperativ mit Sie: Infinitiv + Sie (Öffnen Sie ...). „öffne“ ist ich oder der Imperativ für du, „öffnet“ für ihr, „öffnest“ ist du.",
  ),
  sentence(
    "possessiv.akkusativ",
    "MID",
    "Wo hast du ___ Rucksack?",
    "deinen",
    ["dein", "deine", "deinem"],
    2,
    "„haben“ verlangt den Akkusativ; „Rucksack“ ist maskulin: deinen Rucksack. „dein“ wäre Nominativ, „deinem“ Dativ.",
  ),
  sentence(
    "personalpronomen",
    "MID",
    "Meine Eltern wohnen weit weg. Ich besuche ___ nur selten.",
    "sie",
    ["ihnen", "ihr", "er"],
    0,
    "„besuchen“ verlangt den Akkusativ; „meine Eltern“ ist Plural: sie. „ihnen“ ist Dativ Plural, „ihr“ Dativ Singular, „er“ maskulin.",
  ),
  sentence(
    "trennbares_verb",
    "MID",
    "Wann kommt der Zug in Hamburg ___?",
    "an",
    ["ab", "auf", "mit"],
    1,
    "Das trennbare Verb heißt „ankommen“; die Vorsilbe steht am Satzende. „abkommen“, „aufkommen“ und „mitkommen“ passen nicht zu „in Hamburg“.",
  ),
  sentence(
    "modalverb.satzklammer",
    "HARD",
    "Welcher Satz ist richtig?",
    "Am Samstag will ich Fußball spielen.",
    ["Am Samstag ich will Fußball spielen.", "Am Samstag will ich spielen Fußball.", "Am Samstag will Fußball ich spielen."],
    3,
    "Das Modalverb steht auf Position 2, der Infinitiv am Satzende (Satzklammer). Nach „Am Samstag“ folgt direkt das Verb.",
  ),
  sentence(
    "praeteritum",
    "MID",
    "Letzte Woche ___ wir keine Zeit.",
    "hatten",
    ["waren", "haben", "sind"],
    0,
    "Präteritum von haben: wir hatten. „waren“ gehört zu sein, „haben“ und „sind“ stehen im Präsens.",
  ),
];

// ---------------------------------------------------------------- LISTENING

const stadtfest = clip(
  "course-a1-1-b-l-stadtfest",
  "Veranstaltungstipp im Radio",
  "Veranstaltungen",
  [{ label: "Moderator", voice: "C" }],
  [
    "Moderator: Und jetzt noch ein Tipp für das Wochenende. Am Samstag ist Stadtfest auf dem Marktplatz. Das Fest beginnt um elf Uhr. Um fünfzehn Uhr spielt eine Band, und um zwanzig Uhr gibt es ein Feuerwerk. Der Eintritt ist frei.",
  ],
);

const verspaetung = clip(
  "course-a1-1-b-l-verspaetung",
  "Nachricht auf dem Anrufbeantworter",
  "Arbeit und Termine",
  [{ label: "Frau Reuter", voice: "D" }],
  [
    "Frau Reuter: Guten Morgen, Herr Koch, hier ist Frau Reuter. Es tut mir leid, ich komme heute später. Mein Zug hat Verspätung und kommt erst um neun Uhr an. Dann nehme ich ein Taxi. Ich bin um halb zehn im Büro. Bitte sagen Sie das Frau Berger. Danke!",
  ],
);

const weg = clip(
  "course-a1-1-b-l-weg",
  "Wegbeschreibung",
  "Stadt und Wege",
  [{ label: "Frau Böhm", voice: "A" }],
  [
    "Frau Böhm: Hallo, Herr Yilmaz, hier ist Frau Böhm von der Sprachschule. Sie möchten zu uns kommen? Das ist einfach. Vom Bahnhof gehen Sie geradeaus bis zur Post. An der Post gehen Sie nach links, nicht nach rechts. Dann sehen Sie schon die Schule. Bis morgen!",
  ],
);

const cafe = clip(
  "course-a1-1-b-l-cafe",
  "Gespräch im Café",
  "Essen und Trinken",
  [
    { label: "Kellner", voice: "B" },
    { label: "Frau Said", voice: "D" },
  ],
  [
    "Kellner: Guten Tag! Was möchten Sie trinken?",
    "Frau Said: Guten Tag. Ich möchte einen Tee, bitte. Und meine Freundin möchte einen Kaffee.",
    "Kellner: Sehr gern. Möchten Sie auch etwas essen? Heute haben wir Suppe und Kuchen.",
    "Frau Said: Die Suppe möchte ich nicht. Haben Sie auch einen Salat?",
    "Kellner: Ja, einen Salat mit Käse. Er kostet fünf Euro.",
    "Frau Said: Dann nehme ich einen Salat und ein Stück Kuchen.",
    "Kellner: Welchen Kuchen? Wir haben Apfelkuchen und Schokoladenkuchen.",
    "Frau Said: Den Apfelkuchen, bitte.",
    "Kellner: Gut. Ein Tee, ein Kaffee, ein Salat und ein Apfelkuchen. Kommt sofort!",
    "Frau Said: Entschuldigung, wir möchten bezahlen.",
    "Kellner: Das macht zusammen elf Euro vierzig.",
    "Frau Said: Hier sind fünfzehn Euro. Stimmt so.",
    "Kellner: Vielen Dank! Einen schönen Tag noch.",
  ],
);

const listening = [
  announcementPick(
    stadtfest.key,
    "detail",
    "EASY",
    "Wann beginnt das Stadtfest?",
    "um 11 Uhr",
    ["um 15 Uhr", "um 20 Uhr"],
    0,
    "Das Fest beginnt um elf Uhr. Um fünfzehn Uhr spielt eine Band, um zwanzig Uhr ist das Feuerwerk.",
  ),
  announcementPick(
    verspaetung.key,
    "detail",
    "MID",
    "Wann ist Frau Reuter im Büro?",
    "um 9:30 Uhr",
    ["um 9:00 Uhr", "um 10:30 Uhr"],
    2,
    "Der Zug kommt um neun Uhr an, und Frau Reuter ist dann um halb zehn (9:30 Uhr) im Büro. „halb zehn“ ist nicht 10:30 Uhr.",
  ),
  announcementPick(
    weg.key,
    "detail",
    "EASY",
    "Wohin geht man an der Post?",
    "nach links",
    ["geradeaus", "nach rechts"],
    1,
    "Vom Bahnhof geht man geradeaus bis zur Post. An der Post geht man nach links, ausdrücklich nicht nach rechts.",
  ),
  listeningTfng(
    cafe.key,
    "detail",
    "MID",
    [
      ["Die Frau möchte einen Tee.", "R"],
      ["Die Frau bestellt einen Apfelkuchen.", "R"],
      ["Die Rechnung kostet fünfzehn Euro.", "F"],
    ],
    "Frau Said bestellt für sich einen Tee und den Apfelkuchen. Die Rechnung ist elf Euro vierzig; fünfzehn Euro gibt sie dem Kellner, mit „Stimmt so“.",
  ),
];

// ---------------------------------------------------------------- WRITING and SPEAKING

const writing = writingTask(
  "message",
  "Sie machen am Sonntag ein Picknick im Park. Schreiben Sie eine Nachricht an Ihren Freund Ali.\n\n" +
    "Schreiben Sie zu allen drei Punkten:\n" +
    "- Laden Sie Ali zum Picknick ein.\n" +
    "- Wann und wo ist das Picknick?\n" +
    "- Was kann Ali mitbringen?\n\n" +
    "Schreiben Sie ca. 25-40 Wörter. Vergessen Sie Anrede und Gruß nicht.",
  [
    "Einladung: Ali wird zum Picknick eingeladen (z. B. Ich lade dich ein. Kommst du?)",
    "Wann UND wo: Tag oder Uhrzeit sowie Ort des Picknicks (z. B. am Sonntag um 12 Uhr, im Stadtpark)",
    "Mitbringen: ein bestimmtes Essen oder Getränk, das Ali mitbringen kann (z. B. Obst, Brot, etwas zu trinken)",
  ],
  ["Ali einladen", "wann und wo", "was Ali mitbringen kann"],
  INFORMAL,
  "Bewertung A1: Aufgabenerfüllung (alle drei Punkte verständlich), Anrede und Gruß, einfache Sätze. Fehler zählen nur, wenn sie das Verständnis stören.",
);

const SPEAKING_NOTE =
  "Bewertung A1: Aufgabe erfüllt (alle Punkte angesprochen), verständlich gesprochen, einfache Strukturen weitgehend korrekt. Einzelwörter und kurze Sätze sind auf A1 ausreichend.";

const speaking = [
  speakingTask(
    "introduction",
    "EASY",
    INTRO,
    "Erzählen Sie bitte etwas über sich.\n\n- Name\n- Stadt oder Region, wo Sie wohnen\n- Arbeit, Schule oder Studium\n- Hobbys\n- Sprachen",
    [
      "Name (Ich heiße ... / Mein Name ist ...)",
      "Wohnort (Ich wohne in ...)",
      "Arbeit, Schule, Studium oder Ausbildung (Ich bin ... / Ich studiere ...)",
      "mindestens ein Hobby (Ich lese gern ... / Mein Hobby ist ...)",
      "Sprachen, die man spricht (Ich spreche ...)",
    ],
    SPEAKING_NOTE,
  ),
  speakingTask(
    "topiccard",
    "MID",
    CARD,
    "Sprechen Sie über Ihre Freizeit.\nSagen Sie zu jedem Wort ein bis zwei Sätze.\n\n- Wochenende\n- Hobby\n- Freunde",
    [
      "Zu allen drei Wörtern (Wochenende, Hobby, Freunde) mindestens ein verständlicher Satz",
      "Persönlicher Bezug, z. B. Am Wochenende schlafe ich lange. Mein Hobby ist Fußball. Ich treffe meine Freunde im Park.",
      "einfache Sätze mit dem Verb an Position 2; ein einzelnes Wort ohne Satz gibt nur wenige Punkte",
    ],
    SPEAKING_NOTE,
  ),
];

export const INTERIM_B: SeedCourseForm = a1Form(
  "A1.1",
  "B",
  {
    source: SYLLABUS_SOURCE,
    chapters: "Netzwerk neu A1, Kapitel 1-6",
    topics: [
      "Begrüßung und Vorstellung",
      "Hobbys, Berufe und Familie",
      "Stadt und Verkehrsmittel",
      "Essen und Einkaufen",
      "Tagesablauf und Uhrzeit",
      "Freizeit, Datum und Einladung",
      "Verben im Präsens, sein und haben, Präteritum von sein und haben",
      "Artikel, kein, Plural, Akkusativ",
      "Modalverben, trennbare Verben, Satzklammer",
      "W-Fragen, Possessivartikel, Imperativ mit Sie",
    ],
  },
  { reading: { stimuli: [alltag, vierTexte], items: reading }, grammar, listening: { stimuli: [stadtfest, verspaetung, weg, cafe], items: listening }, writing, speaking },
);
