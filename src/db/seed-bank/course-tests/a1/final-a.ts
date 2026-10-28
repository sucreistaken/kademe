import type { SeedCourseForm } from "../types";
import {
  a1Form,
  announcementPick,
  ASK,
  CARD,
  clip,
  cloze3,
  FORMAL,
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

/**
 * Abschlusstest A1, Form A: Netzwerk neu A1, Kapitel 1-12 (spec 2026-10-28). The grammar takes about half of its
 * points from A1.1 (Kapitel 1-6) and half from A1.2 (Kapitel 7-12: Dativ, Wechselpräpositionen, Imperativ mit du,
 * sollen/dürfen, Perfekt, Personalpronomen im Dativ, welch-, temporale Präpositionen mit Dativ, Wer/Wen/Wem).
 */

// ---------------------------------------------------------------- READING

const wohnungMail = readingText(
  "course-a1-a-r-wohnung-mail",
  "E-Mail von Nora",
  "Wohnen",
  `
Liebe Ines,

endlich habe ich eine eigene Wohnung! Sie liegt im dritten Stock und hat zwei Zimmer, eine Küche, ein Bad und einen kleinen Balkon. Das Wohnzimmer ist groß und hell, aber das Schlafzimmer ist sehr klein. Die Miete ist leider nicht billig: 650 Euro im Monat. Aber die U-Bahn ist nur fünf Minuten von hier, und ich bin schnell bei der Arbeit.

Am Wochenende habe ich Möbel gekauft. Das Sofa habe ich im Internet bestellt, den Tisch und die Stühle habe ich im Möbelhaus gefunden. Mein Bruder hat mir geholfen. Einen Kleiderschrank habe ich noch nicht.

Am Samstag mache ich eine kleine Party. Hast du Zeit? Komm doch auch!

Liebe Grüße
Nora
`,
);

const vierTexte = readingText(
  "course-a1-a-r-vier-texte",
  "Vier kurze Texte",
  "Nachbarn, Einkaufen und Urlaub",
  `
Text A: Aushang im Treppenhaus
Liebe Nachbarn, am Samstag, den 14. Juni, feiern wir im Hof ein Fest. Ab 16 Uhr grillen wir zusammen. Bitte bringen Sie einen Salat oder einen Kuchen mit. Schreiben Sie bis Mittwoch auf die Liste an der Haustür, was Sie mitbringen. Familie Weber, Wohnung 5

Text B: Beitrag im Internetforum
Hallo zusammen, ich ziehe am Sonntag in eine neue Wohnung. Ich habe nicht viele Möbel, nur ein Bett, einen Schrank und einen Tisch. Aber ich habe kein Auto. Wer kann mir helfen? Ich bezahle das Benzin. Danke! Ahmed

Text C: Anzeige
Warme Winterjacke zu verkaufen! Größe M, schwarz, erst ein Jahr alt. Preis: 40 Euro. Sie können die Jacke am Wochenende bei mir anprobieren. Handy: 0176 22 41 63

Text D: Blog
Unser Urlaub an der Ostsee war toll! Wir waren eine Woche dort. Das Wetter war meistens schön, und wir waren jeden Tag am Strand. Nur am Mittwoch hat es geregnet. Da sind wir ins Museum gegangen. Nächstes Jahr fahren wir wieder hin! Jana
`,
);

const reading = [
  readingTfng(
    wohnungMail.key,
    "detail",
    "MID",
    [
      ["Im Schlafzimmer ist nicht viel Platz.", "R"],
      ["Die Wohnung kostet wenig Geld.", "F"],
      ["Zur U-Bahn ist es nicht weit.", "R"],
      ["Nora hat alle Möbel im Internet gekauft.", "F"],
      ["Nora hat schon einen Kleiderschrank.", "F"],
    ],
    "Das Schlafzimmer ist „sehr klein“. Die Miete ist „nicht billig“ (650 Euro). Die U-Bahn ist nur fünf Minuten entfernt. Nur das Sofa kommt aus dem Internet, Tisch und Stühle aus dem Möbelhaus. Einen Kleiderschrank hat Nora noch nicht.",
  ),
  whichText(
    vierTexte.key,
    "gist",
    "EASY",
    "In welchem Text lädt jemand zu einer Feier ein?",
    ["Text C", "Text A", "Text B"],
    "Text A",
    "Familie Weber lädt die Nachbarn zu einem Fest im Hof ein (Text A). Ahmed (Text B) sucht Hilfe beim Umzug, Text C verkauft eine Jacke.",
  ),
  whichText(
    vierTexte.key,
    "detail",
    "EASY",
    "In welchem Text kann man Kleidung kaufen?",
    ["Text A", "Text B", "Text C"],
    "Text C",
    "Text C bietet eine Winterjacke für 40 Euro an. Ahmed (Text B) nennt seine Möbel, er verkauft sie nicht; in Text A geht es um ein Fest.",
  ),
  whichText(
    vierTexte.key,
    "detail",
    "MID",
    "In welchem Text erfährt man etwas über das Wetter?",
    ["Text D", "Text B", "Text A"],
    "Text D",
    "Nur der Blog (Text D) spricht vom Wetter: meistens schön, am Mittwoch Regen. Text A nennt nur, dass draußen im Hof gegrillt wird.",
  ),
  whichText(
    vierTexte.key,
    "gist",
    "MID",
    "In welchem Text braucht jemand Hilfe?",
    ["Text A", "Text C", "Text B"],
    "Text B",
    "Ahmed zieht um, hat kein Auto und fragt: „Wer kann mir helfen?“ (Text B). Familie Weber (Text A) bittet nur um Essen für ein Fest, Text C verkauft eine Jacke.",
  ),
  whichText(
    vierTexte.key,
    "detail",
    "MID",
    "In welchem Text sollen die Leser bis Mittwoch etwas aufschreiben?",
    ["Text B", "Text D", "Text A"],
    "Text A",
    "Die Nachbarn sollen bis Mittwoch auf die Liste an der Haustür schreiben, was sie mitbringen (Text A). In Text D ist der Mittwoch nur der Regentag im Urlaub.",
  ),
];

// ---------------------------------------------------------------- GRAMMAR

const grammar = [
  cloze3("MID", {
    title: "Eine E-Mail aus Wien",
    first: "Liebe Clara, seit zwei Wochen wohne ich jetzt in Wien.",
    body:
      "Die Stadt [[ist|sind|bist#praesens.sein]] wirklich schön. " +
      "Meine Sprachschule liegt direkt [[am|an|ans#wechselpraeposition]] Bahnhof. " +
      "Der Unterricht dauert [[von|um|am#praeposition.zeit]] neun bis zwölf Uhr. " +
      "Jeden Morgen fahre ich mit [[der|die|den#dativ]] U-Bahn dorthin. " +
      "Meine Mitbewohnerin Jana [[liest|lest|lesen#praesens.vokalwechsel]] am Abend gern Bücher. " +
      "Im Wohnzimmer gibt es noch [[kein|keinen|nicht#negation.kein]] Sofa. " +
      "Morgen kaufe ich [[einen|ein|eine#artikel.akkusativ]] Schreibtisch für mein Zimmer. " +
      "Am Sonntag [[bin|habe|ist#perfekt.hilfsverb]] ich mit Jana an die Donau gefahren. " +
      "Wir haben dort ein Picknick gemacht und viel [[gegessen|essen|geesst#perfekt.partizip]]. " +
      "Besuchst du mich im Mai, [[oder|aber|und#konnektor]] hast du erst im Juni Zeit?",
    last: "Schreib mir bald!",
    note: "sein im Präsens (g1), Wechselpräposition mit Dativ auf die Frage Wo? (g2), von ... bis (g3), mit + Dativ (g4), Vokalwechsel e > ie bei er/sie/es (g5), kein bei einem neutralen Nomen (g6), Akkusativ des unbestimmten Artikels (g7), Perfekt mit sein bei einer Fahrt (g8), unregelmäßiges Partizip II (g9), oder zwischen zwei Möglichkeiten (g10).",
  }),
  sentence(
    "plural",
    "MID",
    "Ich lese sehr gern. Zu Hause habe ich viele ___.",
    "Bücher",
    ["Buch", "Bucher", "Büchern"],
    2,
    "Plural von „das Buch“: die Bücher (Umlaut + -er). „Buch“ ist der Singular, „Bucher“ eine falsche Form ohne Umlaut, „Büchern“ steht nur im Dativ Plural.",
  ),
  sentence(
    "imperativ.sie",
    "EASY",
    "Herr Lang, ___ Sie bitte hier Ihren Namen.",
    "schreiben",
    ["schreibt", "schreib", "schreibst"],
    0,
    "Imperativ mit Sie: Infinitiv + Sie (Schreiben Sie ...). „schreib“ ist der Imperativ für du, „schreibt“ für ihr, „schreibst“ die Präsensform von du.",
  ),
  sentence(
    "possessiv.akkusativ",
    "MID",
    "Ich rufe heute Abend ___ Bruder an.",
    "meinen",
    ["mein", "meine", "meinem"],
    3,
    "„anrufen“ verlangt den Akkusativ; „Bruder“ ist maskulin: meinen Bruder. „mein“ wäre Nominativ, „meine“ feminin oder Plural, „meinem“ Dativ.",
  ),
  sentence(
    "modalverb.konjugation",
    "MID",
    "___ du heute Abend mit ins Kino kommen?",
    "Willst",
    ["Will", "Wollt", "Wollen"],
    1,
    "Modalverb wollen zu du: du willst. „will“ gehört zu ich und er/sie/es, „wollt“ zu ihr, „wollen“ zu wir/sie/Sie.",
  ),
  sentence(
    "trennbares_verb",
    "MID",
    "Der Film fängt um acht Uhr ___.",
    "an",
    ["auf", "aus", "ein"],
    1,
    "Das trennbare Verb heißt „anfangen“; die Vorsilbe steht am Satzende. „auffangen“ und „einfangen“ haben eine andere Bedeutung, „ausfangen“ gibt es nicht.",
  ),
  sentence(
    "personalpronomen",
    "MID",
    "Bist du morgen zu Hause? Dann besuche ich ___.",
    "dich",
    ["dir", "du", "dein"],
    0,
    "„besuchen“ verlangt den Akkusativ: dich. „dir“ ist Dativ, „du“ Nominativ, „dein“ ein Possessivartikel.",
  ),
  sentence(
    "praeteritum",
    "MID",
    "Wo ___ du gestern Abend? Ich habe dich nicht gesehen.",
    "warst",
    ["bist", "war", "hattest"],
    3,
    "Präteritum von sein zu du: du warst. „bist“ ist Präsens, „war“ gehört zu ich und er/sie/es, „hattest“ ist die Form von haben.",
  ),
  sentence(
    "wfrage",
    "MID",
    "___ besuchst du am Wochenende? - Meine Großeltern.",
    "Wen",
    ["Wer", "Wem", "Was"],
    2,
    "Nach einer Person im Akkusativ fragt man mit „Wen“ (besuchen + Akkusativ). „Wer“ fragt nach dem Subjekt, „Wem“ nach dem Dativ, „Was“ nach einer Sache.",
  ),
  sentence(
    "imperativ.du",
    "EASY",
    "Tim, du bist krank. ___ heute im Bett!",
    "Bleib",
    ["Bleibt", "Bleibst", "Bleiben"],
    0,
    "Imperativ für du: Verbstamm ohne Endung (Bleib ...!). „Bleibt“ ist der Imperativ für ihr, „Bleibst“ die Präsensform von du, „Bleiben“ ohne „Sie“ ist kein Imperativ.",
  ),
  sentence(
    "modalverb.konjugation",
    "MID",
    "Der Arzt sagt, ich ___ viel Wasser trinken.",
    "soll",
    ["sollst", "sollen", "sollt"],
    3,
    "Modalverb sollen zu ich: ich soll (ohne Endung). „sollst“ gehört zu du, „sollen“ zu wir/sie/Sie, „sollt“ zu ihr.",
  ),
  sentence(
    "wechselpraeposition",
    "HARD",
    "Die Lampe steht auf ___ Tisch.",
    "dem",
    ["den", "der", "das"],
    1,
    "Auf die Frage Wo? steht nach „auf“ der Dativ; „Tisch“ ist maskulin: auf dem Tisch. „den“ wäre Akkusativ (Wohin?), „der“ Dativ feminin, „das“ neutral.",
  ),
  sentence(
    "personalpronomen",
    "MID",
    "Wie gefällt ___ mein neues Kleid?",
    "dir",
    ["dich", "du", "dein"],
    2,
    "„gefallen“ verlangt den Dativ: dir. „dich“ ist Akkusativ, „du“ Nominativ, „dein“ ein Possessivartikel.",
  ),
  sentence(
    "praeposition.zeit",
    "HARD",
    "Ich wohne ___ drei Jahren in Köln.",
    "seit",
    ["vor", "um", "bis"],
    1,
    "Etwas hat vor drei Jahren begonnen und dauert noch: seit + Dativ mit Präsens. „vor drei Jahren“ passt nur zu einem Ereignis in der Vergangenheit, „um“ und „bis“ passen nicht vor „drei Jahren“.",
  ),
  sentence(
    "perfekt.partizip",
    "HARD",
    "Hast du deine Oma schon ___?",
    "angerufen",
    ["geanrufen", "anrufen", "angeruft"],
    0,
    "Partizip II eines trennbaren Verbs: Vorsilbe + ge + Stamm (an-ge-rufen); „rufen“ ist unregelmäßig (-en). „geanrufen“ hat ge- an der falschen Stelle, „angeruft“ eine regelmäßige Endung, „anrufen“ ist der Infinitiv.",
  ),
  sentence(
    "artikel",
    "HARD",
    "___ Rock möchtest du anprobieren?",
    "Welchen",
    ["Welcher", "Welches", "Welche"],
    3,
    "Fragewort welch- im Akkusativ: „Rock“ ist maskulin und Objekt von „anprobieren“: Welchen Rock? „Welcher“ ist Nominativ maskulin, „Welches“ neutral, „Welche“ feminin oder Plural.",
  ),
];

// ---------------------------------------------------------------- LISTENING

const kaufhaus = clip(
  "course-a1-a-l-kaufhaus",
  "Durchsage im Kaufhaus",
  "Kleidung und Einkaufen",
  [{ label: "Ansage", voice: "D" }],
  [
    "Ansage: Liebe Kundinnen und Kunden! Heute sind alle Winterjacken billiger. Sie finden die Jacken im dritten Stock. Mützen und Schals gibt es im zweiten Stock. Unser Café ist im Erdgeschoss. Wir haben heute bis zwanzig Uhr für Sie geöffnet.",
  ],
);

const praxisAnruf = clip(
  "course-a1-a-l-praxis-anruf",
  "Anruf von der Arztpraxis",
  "Gesundheit",
  [{ label: "Frau Kuhn", voice: "A" }],
  [
    "Frau Kuhn: Guten Tag, Herr Maurer, hier ist Frau Kuhn von der Praxis Doktor Hahn. Sie haben ja Rückenschmerzen. Der Doktor sagt: Nehmen Sie die Tabletten dreimal am Tag, morgens, mittags und abends. Die Creme brauchen Sie nur einmal am Tag, am Abend. Und gehen Sie zweimal in der Woche schwimmen. Gute Besserung!",
  ],
);

const kursAusfall = clip(
  "course-a1-a-l-kurs-ausfall",
  "Nachricht von der Sprachschule",
  "Deutschkurs",
  [{ label: "Herr Roth", voice: "C" }],
  [
    "Herr Roth: Liebe Kursteilnehmerinnen und Kursteilnehmer, hier ist Herr Roth von der Sprachschule. Der Deutschkurs am Dienstag fällt leider aus. Ihre Lehrerin ist krank. Wir sehen uns am Donnerstag. Am Donnerstag beginnt der Kurs nicht um achtzehn Uhr, sondern schon um siebzehn Uhr. Bis Donnerstag!",
  ],
);

const gleis = clip(
  "course-a1-a-l-gleis",
  "Durchsage am Bahnhof",
  "Reisen",
  [{ label: "Ansage", voice: "B" }],
  [
    "Ansage: Information für die Fahrgäste nach München: Ihr Zug fährt heute nicht von Gleis fünf. Bitte gehen Sie zu Gleis acht. Die Abfahrt ist wie immer um zehn Uhr fünfzehn. Der Zug nach Salzburg fährt heute von Gleis drei.",
  ],
);

const kinoNachricht = clip(
  "course-a1-a-l-kino-nachricht",
  "Nachricht von Lena",
  "Freizeit und Verabredung",
  [{ label: "Lena", voice: "A" }],
  [
    "Lena: Hallo Ben, hier ist Lena. Heute Abend gehen wir ja ins Kino. Der Film beginnt um acht. Ich bin vorher noch mit Mia im Café am Bahnhof. Wir treffen uns dann um halb acht vor dem Kino. Die Karten habe ich schon. Bis später!",
  ],
);

const wochenende = clip(
  "course-a1-a-l-wochenende",
  "Gespräch: Das Wochenende",
  "Freizeit und Reisen",
  [
    { label: "Tobias", voice: "C" },
    { label: "Sara", voice: "D" },
  ],
  [
    "Tobias: Guten Morgen, Sara! Wie war dein Wochenende?",
    "Sara: Hallo, Tobias! Sehr schön, danke. Ich war in Hamburg. Meine Schwester wohnt dort.",
    "Tobias: Toll! Bist du mit dem Auto gefahren?",
    "Sara: Nein, mit dem Zug. Das geht schneller, und ich kann im Zug lesen.",
    "Tobias: Und wie war das Wetter? Hier in Köln hat es am Samstag den ganzen Tag geregnet.",
    "Sara: In Hamburg auch. Am Samstag waren wir im Museum. Aber am Sonntag hat die Sonne geschienen, und wir haben eine Schifffahrt auf der Elbe gemacht.",
    "Tobias: Schön!",
    "Sara: Und du? Was hast du gemacht?",
    "Tobias: Ich war zu Hause. Am Samstag habe ich lange geschlafen und dann für meine Prüfung gelernt.",
    "Sara: Oh, du hast bald eine Prüfung?",
    "Tobias: Ja, am Freitag. Aber am Sonntag habe ich nicht gelernt. Da habe ich mit Freunden Fußball gespielt.",
    "Sara: Bei dem Regen?",
    "Tobias: Nein, am Sonntag war es hier auch schön. Am Abend haben wir noch zusammen gekocht.",
    "Sara: Das klingt gut. Oh, es ist schon neun Uhr. Ich muss ins Büro. Bis später!",
    "Tobias: Bis später, Sara!",
  ],
);

const listening = [
  announcementPick(
    kaufhaus.key,
    "detail",
    "EASY",
    "Wo sind die Winterjacken?",
    "im dritten Stock",
    ["im zweiten Stock", "im Erdgeschoss"],
    1,
    "Die Winterjacken sind im dritten Stock. Mützen und Schals gibt es im zweiten Stock, das Café ist im Erdgeschoss.",
  ),
  announcementPick(
    praxisAnruf.key,
    "detail",
    "MID",
    "Wie oft soll Herr Maurer die Tabletten nehmen?",
    "dreimal am Tag",
    ["einmal am Tag", "zweimal in der Woche"],
    2,
    "Die Tabletten nimmt er dreimal am Tag. Einmal am Tag gilt für die Creme, zweimal in der Woche soll er schwimmen gehen.",
  ),
  announcementPick(
    kursAusfall.key,
    "detail",
    "MID",
    "Wann ist der nächste Deutschkurs?",
    "am Donnerstag um 17 Uhr",
    ["am Dienstag um 17 Uhr", "am Donnerstag um 18 Uhr"],
    0,
    "Am Dienstag fällt der Kurs aus. Am Donnerstag beginnt er nicht um 18 Uhr, sondern schon um 17 Uhr.",
  ),
  announcementPick(
    gleis.key,
    "detail",
    "EASY",
    "Sie fahren nach München. Zu welchem Gleis gehen Sie?",
    "zu Gleis 8",
    ["zu Gleis 5", "zu Gleis 3"],
    0,
    "Der Zug nach München fährt heute nicht von Gleis 5, sondern von Gleis 8. Von Gleis 3 fährt der Zug nach Salzburg.",
  ),
  announcementPick(
    kinoNachricht.key,
    "detail",
    "MID",
    "Wo treffen sich Lena und Ben?",
    "vor dem Kino",
    ["im Café", "am Bahnhof"],
    2,
    "Lena ist vorher mit Mia im Café am Bahnhof; Ben trifft sie um halb acht vor dem Kino.",
  ),
  listeningTfng(
    wochenende.key,
    "detail",
    "MID",
    [
      ["Sara hat am Wochenende ihre Schwester besucht.", "R"],
      ["Sara ist mit dem Auto nach Hamburg gefahren.", "F"],
      ["In Hamburg war das Wetter am Samstag schlecht.", "R"],
      ["Tobias hat am Samstag Fußball gespielt.", "F"],
      ["Tobias hat am Sonntag für seine Prüfung gelernt.", "F"],
    ],
    "Saras Schwester wohnt in Hamburg, dort war Sara am Wochenende. Sie ist mit dem Zug gefahren. Am Samstag hat es auch in Hamburg geregnet. Tobias hat am Samstag gelernt und am Sonntag Fußball gespielt; am Sonntag hat er nicht gelernt.",
  ),
];

// ---------------------------------------------------------------- WRITING and SPEAKING

const writing = writingTask(
  "email",
  "Sie können morgen nicht zum Deutschkurs kommen. Schreiben Sie eine E-Mail an Ihre Kursleiterin, Frau Hoffmann.\n\n" +
    "Schreiben Sie zu allen drei Punkten:\n" +
    "- Warum können Sie nicht kommen?\n" +
    "- Wann kommen Sie wieder?\n" +
    "- Fragen Sie nach den Hausaufgaben.\n\n" +
    "Schreiben Sie ca. 25-40 Wörter. Vergessen Sie Anrede und Gruß nicht.",
  [
    "Grund: warum man morgen nicht kommt (z. B. Ich bin krank. Ich habe Fieber. / Ich habe einen Termin beim Arzt.)",
    "Wiederkommen: ein Tag oder Datum (z. B. Ich komme am Donnerstag wieder.)",
    "Frage nach den Hausaufgaben (z. B. Was sind die Hausaufgaben? Können Sie mir die Hausaufgaben schicken?)",
  ],
  ["warum Sie nicht kommen", "wann Sie wiederkommen", "nach den Hausaufgaben fragen"],
  FORMAL,
  "Bewertung A1: Aufgabenerfüllung (alle drei Punkte verständlich), passende Anrede und Gruß (z. B. Liebe Frau Hoffmann / Sehr geehrte Frau Hoffmann ... Viele Grüße), einfache Sätze. Duzen der Kursleiterin ist ein Registerfehler. Fehler zählen nur, wenn sie das Verständnis stören.",
);

const SPEAKING_NOTE =
  "Bewertung A1: Aufgabe erfüllt (alle Punkte angesprochen), verständlich gesprochen, einfache Strukturen weitgehend korrekt. Einzelwörter und kurze Sätze sind auf A1 ausreichend.";

const speaking = [
  speakingTask(
    "introduction",
    "EASY",
    INTRO,
    "Bitte stellen Sie sich vor.\n\n- Name\n- Wohnort (Stadt oder Region)\n- Familie\n- Beruf oder Tätigkeit\n- Hobbys",
    [
      "Name (Ich heiße ... / Mein Name ist ...)",
      "Wohnort (Ich wohne in ...)",
      "Familie, z. B. Partner, Geschwister oder Kinder (Ich habe ... / Ich bin verheiratet.)",
      "Beruf, Arbeit, Schule oder Ausbildung (Ich bin ... / Ich arbeite als ...)",
      "mindestens ein Hobby (Ich spiele gern ... / Mein Hobby ist ...)",
    ],
    SPEAKING_NOTE,
  ),
  speakingTask(
    "topiccard",
    "MID",
    CARD,
    "Sprechen Sie über Ihre Wohnung.\nSagen Sie zu jedem Wort ein bis zwei Sätze.\n\n- Zimmer\n- Möbel\n- Lieblingsplatz",
    [
      "Zu allen drei Wörtern (Zimmer, Möbel, Lieblingsplatz) mindestens ein verständlicher Satz",
      "Persönlicher Bezug, z. B. Meine Wohnung hat zwei Zimmer. Im Wohnzimmer steht ein Sofa. Mein Lieblingsplatz ist der Balkon.",
      "einfache Sätze mit dem Verb an Position 2; ein einzelnes Wort ohne Satz gibt nur wenige Punkte",
    ],
    SPEAKING_NOTE,
  ),
  speakingTask(
    "request",
    "MID",
    ASK,
    "Bitten Sie um etwas und bieten Sie etwas an.\nWas sagen Sie? Sagen Sie zu jeder Situation ein bis zwei Sätze.\n\n- Im Kurs: Sie haben keinen Stift.\n- Im Zug: Das Fenster ist offen, und Ihnen ist kalt.\n- Zu Hause: Ihr Besuch hat Durst.",
    [
      "Kurs: Bitte um einen Stift (z. B. Hast du einen Stift für mich? / Kann ich bitte deinen Stift haben?)",
      "Zug: höfliche Bitte an eine fremde Person, das Fenster zu schließen (z. B. Können Sie bitte das Fenster zumachen?)",
      "Zu Hause: Angebot an den Besuch (z. B. Möchtest du etwas trinken? Ich habe Wasser und Saft.)",
    ],
    SPEAKING_NOTE + " Höflichkeit (bitte, danke, Können Sie ...?) wird beachtet.",
  ),
];

export const FINAL_A: SeedCourseForm = a1Form(
  "A1",
  "A",
  {
    source: SYLLABUS_SOURCE,
    chapters: "Netzwerk neu A1, Kapitel 1-12",
    topics: [
      "Vorstellung, Familie und Hobbys",
      "Stadt, Verkehr und Reisen",
      "Essen, Einkaufen und Kleidung",
      "Tagesablauf, Arbeit und Termine",
      "Gesundheit und Körper",
      "Wohnen und Möbel",
      "Verben im Präsens, sein und haben, Modalverben, trennbare Verben",
      "Artikel, kein, Plural, Akkusativ, Possessivartikel, welch-",
      "Dativ, Wechselpräpositionen, Personalpronomen",
      "Perfekt und Präteritum von sein und haben",
      "Imperativ mit Sie und du",
      "und, oder, aber, Präpositionen der Zeit, W-Fragen",
    ],
  },
  {
    reading: { stimuli: [wohnungMail, vierTexte], items: reading },
    grammar,
    listening: { stimuli: [kaufhaus, praxisAnruf, kursAusfall, gleis, kinoNachricht, wochenende], items: listening },
    writing,
    speaking,
  },
);
