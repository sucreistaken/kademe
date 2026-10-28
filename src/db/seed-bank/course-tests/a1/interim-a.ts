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

/** Zwischentest A1.1, Form A: Netzwerk neu A1, Kapitel 1-6 (spec 2026-10-28). */

// ---------------------------------------------------------------- READING

const hamburgMail = readingText(
  "course-a1-1-a-r-hamburg-mail",
  "E-Mail aus Hamburg",
  "Stadt und Alltag",
  `
Hallo Nora,

jetzt wohne ich schon eine Woche in Hamburg. Die Stadt ist groß und schön! Meine Wohnung ist klein, aber sie ist ganz nah am Bahnhof. Im Haus gegenüber gibt es einen Supermarkt und eine Bäckerei. Das ist praktisch.

Ich arbeite in einem Café in der Stadt. Ich fahre mit dem Bus. Das dauert zwanzig Minuten. Ein Auto habe ich nicht. Am Samstag habe ich frei. Dann gehe ich auf den Markt, und am Abend gehe ich ins Kino.

Hast du am Wochenende Zeit? Kommst du nach Hamburg?

Liebe Grüße
Selin
`,
);

const vierTexte = readingText(
  "course-a1-1-a-r-vier-texte",
  "Vier kurze Texte",
  "Freizeit und Einkaufen",
  `
Text A: Aushang im Schwimmbad
Achtung! Das Schwimmbad ist am Mittwoch, den 12. Juni, geschlossen. Ab Donnerstag sind wir wieder von 8 bis 20 Uhr für Sie da. Die Sauna ist ab Freitag auch wieder offen.

Text B: Nachricht von Lea
Hallo Tim, wir gehen am Samstag ins Kino. Der Film beginnt um 20 Uhr. Wir treffen uns um halb acht am Bahnhof. Kommst du auch? Lea

Text C: Anzeige
Sofa zu verkaufen! Es ist grau und nur zwei Jahre alt. Preis: 60 Euro. Adresse: Gartenstraße 5. Telefon: 040 55 23 71 (Herr Baran)

Text D: Beitrag im Internetforum
Hallo zusammen, ich bin neu in Hamburg und möchte Deutsch lernen. Ich suche einen Kurs am Abend. Kennt jemand eine gute Sprachschule? Danke! Mehmet
`,
);

const reading = [
  readingTfng(
    hamburgMail.key,
    "detail",
    "EASY",
    [
      ["Selins Wohnung ist nicht weit vom Bahnhof.", "R"],
      ["Selin fährt mit dem Auto zur Arbeit.", "F"],
      ["Am Samstag arbeitet Selin nicht.", "R"],
    ],
    "Die Wohnung ist „ganz nah am Bahnhof“. Selin fährt mit dem Bus, ein Auto hat sie nicht. Am Samstag hat sie frei.",
  ),
  whichText(
    vierTexte.key,
    "detail",
    "EASY",
    "In welchem Text steht, wie viel etwas kostet?",
    ["Text B", "Text C", "Text D"],
    "Text C",
    "Nur Text C nennt einen Preis (60 Euro). Text A nennt Öffnungszeiten, Text B ein Treffen, Text D sucht einen Kurs.",
  ),
  whichText(
    vierTexte.key,
    "gist",
    "MID",
    "In welchem Text möchte jemand eine Sprache lernen?",
    ["Text A", "Text B", "Text D"],
    "Text D",
    "Mehmet möchte Deutsch lernen und sucht einen Kurs am Abend (Text D). Im Schwimmbad (Text A) geht es um Öffnungszeiten, in Text B um das Kino, in Text C um ein Sofa.",
  ),
  whichText(
    vierTexte.key,
    "detail",
    "EASY",
    "In welchem Text ist etwas geschlossen?",
    ["Text A", "Text C", "Text B"],
    "Text A",
    "Das Schwimmbad ist am Mittwoch geschlossen (Text A). In den Texten B und C steht nichts von „geschlossen“.",
  ),
];

// ---------------------------------------------------------------- GRAMMAR

const grammar = [
  cloze3("MID", {
    title: "Eine Nachricht an Pia",
    first: "Hallo Pia, ich mache jetzt einen Deutschkurs in Köln.",
    body:
      "Ich [[bin|ist|bist#praesens.sein]] schon zwei Wochen hier. " +
      "Meine Lehrerin [[spricht|sprecht|sprechen#praesens.vokalwechsel]] langsam und deutlich. " +
      "Der Kurs beginnt jeden Tag [[um|am|im#praeposition.zeit]] neun Uhr. " +
      "Mittags trinke ich oft [[einen|ein|eine#artikel.akkusativ]] Kaffee. " +
      "Am Nachmittag [[muss|musst|müssen#modalverb.konjugation]] ich arbeiten. " +
      "Am Abend habe ich leider [[keine|kein|nicht#negation.kein]] Zeit mehr.",
    last: "Hast du am Wochenende Zeit?",
    note: "sein im Präsens (g1), Vokalwechsel e > i bei er/sie/es (g2), Uhrzeit mit um (g3), Akkusativ des unbestimmten Artikels (g4), Modalverb zu ich (g5), kein bei einem femininen Nomen (g6).",
  }),
  sentence(
    "wfrage",
    "EASY",
    "___ trinkst du gern? - Kaffee und Tee.",
    "Was",
    ["Wer", "Wann", "Wo"],
    2,
    "Nach einer Sache fragt man mit „Was“. „Wer“ fragt nach einer Person, „Wann“ nach der Zeit, „Wo“ nach dem Ort.",
  ),
  sentence(
    "praesens.regelmaessig",
    "EASY",
    "Was ___ ihr am Samstag? - Wir gehen ins Kino.",
    "macht",
    ["mache", "machst", "machen"],
    0,
    "Zu „ihr“ gehört die Endung -t: ihr macht. „mache“ ist ich, „machst“ ist du, „machen“ ist wir/sie.",
  ),
  sentence(
    "plural",
    "MID",
    "Wir brauchen noch vier ___.",
    "Stühle",
    ["Stuhl", "Stuhle", "Stühlen"],
    3,
    "Plural von „der Stuhl“: die Stühle (Umlaut + -e). „Stuhl“ ist der Singular, „Stuhle“ eine falsche Form ohne Umlaut, „Stühlen“ steht nur im Dativ Plural.",
  ),
  sentence(
    "imperativ.sie",
    "MID",
    "Bitte ___ Sie morgen um neun Uhr.",
    "kommen",
    ["komm", "kommt", "kommst"],
    1,
    "Imperativ mit Sie: Infinitiv + Sie (Kommen Sie ...). „komm“ ist der Imperativ für du, „kommt“ für ihr.",
  ),
  sentence(
    "possessiv.akkusativ",
    "MID",
    "Ich besuche heute ___ Opa.",
    "meinen",
    ["mein", "meine", "meinem"],
    0,
    "„besuchen“ verlangt den Akkusativ; „Opa“ ist maskulin: meinen Opa. „mein“ wäre Nominativ, „meinem“ Dativ.",
  ),
  sentence(
    "personalpronomen",
    "MID",
    "Das ist unser Lehrer, Herr Sauer. Wir mögen ___ sehr.",
    "ihn",
    ["er", "ihm", "sie"],
    3,
    "„mögen“ verlangt den Akkusativ; Herr Sauer ist maskulin: ihn. „er“ ist Nominativ, „ihm“ Dativ, „sie“ feminin oder Plural.",
  ),
  sentence(
    "trennbares_verb",
    "MID",
    "Kommst du am Samstag ins Kino ___?",
    "mit",
    ["an", "auf", "zu"],
    2,
    "Das trennbare Verb heißt „mitkommen“; die Vorsilbe steht am Satzende. „ankommen“, „aufkommen“ und „zukommen“ passen nicht zu „ins Kino“.",
  ),
  sentence(
    "modalverb.satzklammer",
    "HARD",
    "Welcher Satz ist richtig?",
    "Morgen muss ich früh aufstehen.",
    ["Morgen ich muss früh aufstehen.", "Morgen muss ich aufstehen früh.", "Morgen muss früh ich aufstehen."],
    1,
    "Das Modalverb steht auf Position 2, der Infinitiv am Satzende (Satzklammer). Nach „Morgen“ folgt direkt das Verb.",
  ),
  sentence(
    "praeteritum",
    "MID",
    "Gestern ___ das Wetter sehr schön.",
    "war",
    ["ist", "bin", "hatte"],
    2,
    "Präteritum von sein: das Wetter war. „ist“ ist Präsens, „bin“ gehört zu ich, „hatte“ ist die Form von haben.",
  ),
];

// ---------------------------------------------------------------- LISTENING

const erdbeeren = clip(
  "course-a1-1-a-l-erdbeeren",
  "Durchsage im Supermarkt",
  "Einkaufen",
  [{ label: "Ansage", voice: "D" }],
  [
    "Ansage: Liebe Kunden, heute haben wir frische Erdbeeren. Ein Kilo kostet nur zwei Euro fünfzig, nicht drei Euro fünfzig wie sonst. Auch die Äpfel sind billig: Ein Kilo kostet einen Euro neunzig.",
  ],
);

const praxis = clip(
  "course-a1-1-a-l-praxis",
  "Nachricht von der Arztpraxis",
  "Termin",
  [{ label: "Herr Weiß", voice: "B" }],
  [
    "Herr Weiß: Guten Tag, Frau Demir, hier ist die Praxis von Doktor Lenz. Ihr Termin am Dienstag um neun Uhr geht leider nicht. Bitte kommen Sie am Mittwoch um zehn Uhr. Also, Mittwoch, zehn Uhr. Auf Wiederhören!",
  ],
);

const bus = clip(
  "course-a1-1-a-l-bus",
  "Durchsage im Bus",
  "Verkehr",
  [{ label: "Ansage", voice: "A" }],
  [
    "Ansage: Achtung, liebe Fahrgäste! Der Bus Linie zwölf fährt heute nicht über den Marktplatz. Bitte steigen Sie an der Haltestelle Schillerstraße aus. Von dort sind es zu Fuß nur fünf Minuten bis zum Marktplatz. Der Bus hält dann wieder am Bahnhof.",
  ],
);

const party = clip(
  "course-a1-1-a-l-party",
  "Gespräch: Eine Einladung",
  "Geburtstag und Freunde",
  [
    { label: "Mira", voice: "A" },
    { label: "Jonas", voice: "C" },
  ],
  [
    "Mira: Hallo, Jonas! Wie geht's?",
    "Jonas: Hallo, Mira! Gut, danke. Und dir?",
    "Mira: Auch gut, danke. Du, am Samstag habe ich Geburtstag. Ich mache eine kleine Party. Kommst du?",
    "Jonas: Oh, herzlichen Glückwunsch! Wann ist die Party?",
    "Mira: Um sieben Uhr, bei mir zu Hause.",
    "Jonas: Hm. Am Samstag arbeite ich bis sechs Uhr. Aber ich kann um halb acht kommen. Ist das okay?",
    "Mira: Ja, super! Das ist kein Problem. Wir essen erst um acht.",
    "Jonas: Gut. Kann ich etwas mitbringen? Kuchen oder Salat?",
    "Mira: Einen Salat, gern. Den Kuchen kaufe ich schon.",
    "Jonas: Okay. Ich mache einen Nudelsalat. Wie viele Gäste kommen denn?",
    "Mira: Zehn Personen. Meine Schwester kommt auch, und zwei Freunde aus dem Deutschkurs.",
    "Jonas: Toll! Dann sehe ich alle wieder. Also, bis Samstag!",
    "Mira: Bis Samstag, Jonas. Tschüss!",
    "Jonas: Tschüss!",
  ],
);

const listening = [
  announcementPick(
    erdbeeren.key,
    "detail",
    "EASY",
    "Was kostet ein Kilo Erdbeeren heute?",
    "2,50 Euro",
    ["3,50 Euro", "1,90 Euro"],
    1,
    "Heute kosten die Erdbeeren 2,50 Euro, sonst 3,50 Euro. 1,90 Euro kosten die Äpfel.",
  ),
  announcementPick(
    praxis.key,
    "detail",
    "MID",
    "Wann hat Frau Demir jetzt einen Termin?",
    "am Mittwoch um 10 Uhr",
    ["am Dienstag um 9 Uhr", "am Mittwoch um 9 Uhr"],
    2,
    "Der alte Termin (Dienstag, neun Uhr) geht nicht. Der neue Termin ist am Mittwoch um zehn Uhr, die Nachricht wiederholt ihn.",
  ),
  announcementPick(
    bus.key,
    "detail",
    "MID",
    "Sie möchten zum Marktplatz. Wo steigen Sie aus?",
    "an der Schillerstraße",
    ["am Marktplatz", "am Bahnhof"],
    0,
    "Der Bus fährt heute nicht über den Marktplatz. Man steigt an der Haltestelle Schillerstraße aus und geht zu Fuß. Am Bahnhof hält der Bus erst danach wieder.",
  ),
  listeningTfng(
    party.key,
    "detail",
    "MID",
    [
      ["Mira macht am Freitag eine Party.", "F"],
      ["Jonas kann um halb acht kommen.", "R"],
      ["Jonas bringt einen Kuchen mit.", "F"],
    ],
    "Mira hat am Samstag Geburtstag, nicht am Freitag. Jonas arbeitet bis sechs Uhr und kommt um halb acht. Er bringt einen Salat mit; den Kuchen kauft Mira.",
  ),
];

// ---------------------------------------------------------------- WRITING and SPEAKING

const writing = writingTask(
  "message",
  "Sie haben am Samstag Geburtstag und machen eine Party. Schreiben Sie eine Nachricht an Ihre Freundin Mira.\n\n" +
    "Schreiben Sie zu allen drei Punkten:\n" +
    "- Laden Sie Mira zur Party ein.\n" +
    "- Wann und wo ist die Party?\n" +
    "- Was kann Mira mitbringen?\n\n" +
    "Schreiben Sie ca. 25-40 Wörter. Vergessen Sie Anrede und Gruß nicht.",
  [
    "Einladung: Mira wird zur Party eingeladen (z. B. Ich lade dich ein. Kommst du?)",
    "Wann UND wo: Tag oder Uhrzeit sowie Ort der Party (z. B. am Samstag um 18 Uhr, bei mir zu Hause)",
    "Mitbringen: ein bestimmtes Essen oder Getränk, das Mira mitbringen kann (z. B. einen Salat, etwas zu trinken)",
  ],
  ["Mira einladen", "wann und wo", "was Mira mitbringen kann"],
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
    "Stellen Sie sich bitte kurz vor.\n\n- Name\n- Wohnort (Stadt oder Region)\n- Beruf oder Tätigkeit\n- Freizeit\n- Sprachen",
    [
      "Name (Ich heiße ... / Mein Name ist ...)",
      "Wohnort (Ich wohne in ...)",
      "Beruf, Arbeit, Schule oder Ausbildung (Ich bin ... / Ich arbeite als ...)",
      "mindestens eine Freizeitbeschäftigung (Ich spiele gern ...)",
      "Sprachen, die man spricht (Ich spreche ...)",
    ],
    SPEAKING_NOTE,
  ),
  speakingTask(
    "topiccard",
    "MID",
    CARD,
    "Sprechen Sie über Essen und Trinken.\nSagen Sie zu jedem Wort ein bis zwei Sätze.\n\n- Frühstück\n- Lieblingsessen\n- Einkaufen",
    [
      "Zu allen drei Wörtern (Frühstück, Lieblingsessen, Einkaufen) mindestens ein verständlicher Satz",
      "Persönlicher Bezug, z. B. Zum Frühstück esse ich Brot. Mein Lieblingsessen ist Pizza. Ich kaufe im Supermarkt ein.",
      "einfache Sätze mit dem Verb an Position 2; ein einzelnes Wort ohne Satz gibt nur wenige Punkte",
    ],
    SPEAKING_NOTE,
  ),
];

export const INTERIM_A: SeedCourseForm = a1Form(
  "A1.1",
  "A",
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
  { reading: { stimuli: [hamburgMail, vierTexte], items: reading }, grammar, listening: { stimuli: [erdbeeren, praxis, bus, party], items: listening }, writing, speaking },
);
