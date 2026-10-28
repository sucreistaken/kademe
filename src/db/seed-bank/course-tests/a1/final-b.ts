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
 * Abschlusstest A1, Form B: Netzwerk neu A1, Kapitel 1-12; same structure and grammar phenomena as form A, new
 * texts and sentences (spec 2026-10-28).
 */

// ---------------------------------------------------------------- READING

const salzburgMail = readingText(
  "course-a1-b-r-salzburg-mail",
  "E-Mail von Daniel",
  "Reisen und Urlaub",
  `
Hallo Kim,

seit Montag bin ich mit meiner Freundin Lina in Salzburg. Wir sind mit dem Zug gekommen, die Fahrt hat nur zwei Stunden gedauert. Unser Hotel ist klein, aber sehr gemütlich, und das Frühstück ist super.

Am Dienstag hat es den ganzen Tag geregnet. Da waren wir zuerst im Museum und dann lange im Café. Gestern war das Wetter wieder schön, und wir sind auf einen Berg gewandert. Von dort sieht man die ganze Stadt! Heute kaufen wir noch Geschenke für unsere Familien.

Am Samstag fahren wir wieder nach Hause. Am Sonntag rufe ich dich an und erzähle dir alles!

Viele Grüße
Daniel
`,
);

const vierTexte = readingText(
  "course-a1-b-r-vier-texte",
  "Vier kurze Texte",
  "Arbeit, Alltag und Freizeit",
  `
Text A: Aushang in der Arztpraxis
Liebe Patientinnen und Patienten, unsere Praxis ist vom 2. bis 13. August geschlossen. In dieser Zeit gehen Sie bitte zu Frau Dr. Schulz, Bahnhofstraße 12. Ab Montag, den 16. August, sind wir wieder für Sie da. Ihr Praxisteam Dr. Keller

Text B: Nachricht von Sofia
Hallo Elias, ich habe eine neue Waschmaschine. Meine alte Maschine ist noch gut. Möchtest du sie haben? Sie kostet nichts. Du musst sie nur bis Freitag bei mir abholen. Sofia

Text C: Anzeige
Fahrradkurs für Erwachsene! Sie können nicht Fahrrad fahren? Kein Problem! Wir üben jeden Samstag von 10 bis 12 Uhr im Stadtpark. Der Kurs kostet 45 Euro. Anmeldung: Telefon 0221 47 11 80

Text D: Beitrag im Internetforum
Ich arbeite seit einem Monat an der Rezeption in einem Hotel. Ich fange jeden Tag um sechs Uhr an. Das ist früh, aber die Arbeit macht Spaß. Meine Kollegen sind sehr nett, und ich spreche viel Englisch und Deutsch. Nur am Wochenende muss ich oft arbeiten. Kemal
`,
);

const reading = [
  readingTfng(
    salzburgMail.key,
    "detail",
    "MID",
    [
      ["Daniel und Lina sind mit dem Auto nach Salzburg gefahren.", "F"],
      ["Daniel gefällt das Hotel.", "R"],
      ["Am Dienstag war das Wetter schlecht.", "R"],
      ["Gestern waren Daniel und Lina im Museum.", "F"],
      ["Daniel telefoniert am Sonntag mit Kim.", "R"],
    ],
    "Daniel und Lina sind mit dem Zug gekommen. Das Hotel ist „sehr gemütlich“, das Frühstück „super“. Am Dienstag hat es geregnet; an diesem Tag waren sie im Museum, gestern sind sie auf einen Berg gewandert. Am Sonntag ruft Daniel Kim an.",
  ),
  whichText(
    vierTexte.key,
    "detail",
    "MID",
    "In welchem Text kann man etwas ohne Geld bekommen?",
    ["Text C", "Text B", "Text D"],
    "Text B",
    "Sofias alte Waschmaschine „kostet nichts“ (Text B). Der Fahrradkurs in Text C kostet 45 Euro, in Text D geht es um eine Arbeit.",
  ),
  whichText(
    vierTexte.key,
    "gist",
    "EASY",
    "In welchem Text kann man etwas lernen?",
    ["Text A", "Text C", "Text D"],
    "Text C",
    "Text C bietet einen Fahrradkurs für Erwachsene an. Text A informiert über die Ferien einer Praxis, Kemal (Text D) erzählt von seiner Arbeit.",
  ),
  whichText(
    vierTexte.key,
    "gist",
    "EASY",
    "In welchem Text schreibt jemand über seinen Job?",
    ["Text B", "Text C", "Text D"],
    "Text D",
    "Kemal arbeitet an der Rezeption in einem Hotel und erzählt von seinem Arbeitstag (Text D). Sofia (Text B) verschenkt eine Waschmaschine, Text C ist eine Anzeige für einen Kurs.",
  ),
  whichText(
    vierTexte.key,
    "detail",
    "MID",
    "In welchem Text erfährt man, wann etwas wieder offen ist?",
    ["Text B", "Text A", "Text C"],
    "Text A",
    "Die Praxis ist ab dem 16. August wieder für die Patienten da (Text A). Text C nennt nur die Kurszeiten, Text B eine Frist zum Abholen.",
  ),
  whichText(
    vierTexte.key,
    "detail",
    "MID",
    "In welchem Text soll man bis Freitag etwas machen?",
    ["Text A", "Text D", "Text B"],
    "Text B",
    "Elias muss die Waschmaschine bis Freitag bei Sofia abholen (Text B). Text A nennt Daten im August, Text D das Wochenende.",
  ),
];

// ---------------------------------------------------------------- GRAMMAR

const grammar = [
  cloze3("MID", {
    title: "Eine E-Mail aus Graz",
    first: "Lieber Lukas, vielen Dank für deine E-Mail!",
    body:
      "Ich [[bin|ist|habe#praesens.sein]] jetzt Krankenpfleger in einem Krankenhaus in Graz. " +
      "Meine Wohnung liegt in [[der|die|den#wechselpraeposition]] Altstadt. " +
      "Ich habe noch [[kein|keinen|nicht#negation.kein]] Auto. " +
      "Zur Arbeit fahre ich mit [[dem|den|der#dativ]] Fahrrad. " +
      "Ich arbeite von sechs [[bis|um|ab#praeposition.zeit]] vierzehn Uhr. " +
      "Mein Kollege Omar [[isst|esst|essen#praesens.vokalwechsel]] mittags immer mit mir in der Kantine. " +
      "Für die Küche brauche ich noch [[einen|ein|eine#artikel.akkusativ]] Kühlschrank. " +
      "Am Samstag [[bin|habe|ist#perfekt.hilfsverb]] ich mit Omar ins Kino gegangen. " +
      "Wir haben einen Film auf Deutsch [[gesehen|gesieht|sehen#perfekt.partizip]]. " +
      "Hast du im Juli Urlaub, [[oder|aber|und#konnektor]] arbeitest du den ganzen Sommer?",
    last: "Dann besuch mich doch in Graz!",
    note: "sein im Präsens (g1), Wechselpräposition mit Dativ auf die Frage Wo? (g2), kein bei einem neutralen Nomen (g3), mit + Dativ (g4), von ... bis (g5), Vokalwechsel e > i bei er/sie/es (g6), Akkusativ des unbestimmten Artikels (g7), Perfekt mit sein bei einer Bewegung (g8), unregelmäßiges Partizip II (g9), oder zwischen zwei Möglichkeiten (g10).",
  }),
  sentence(
    "plural",
    "MID",
    "In unserer Straße stehen viele alte ___.",
    "Häuser",
    ["Haus", "Hauser", "Häusern"],
    1,
    "Plural von „das Haus“: die Häuser (Umlaut + -er). „Haus“ ist der Singular, „Hauser“ eine falsche Form ohne Umlaut, „Häusern“ steht nur im Dativ Plural.",
  ),
  sentence(
    "imperativ.sie",
    "EASY",
    "Entschuldigung, ___ Sie bitte langsam!",
    "sprechen",
    ["sprich", "sprecht", "sprichst"],
    3,
    "Imperativ mit Sie: Infinitiv + Sie (Sprechen Sie ...). „sprich“ ist der Imperativ für du, „sprecht“ für ihr, „sprichst“ die Präsensform von du.",
  ),
  sentence(
    "possessiv.akkusativ",
    "MID",
    "Hast du ___ Vater schon gefragt?",
    "deinen",
    ["dein", "deine", "deinem"],
    0,
    "„fragen“ verlangt den Akkusativ; „Vater“ ist maskulin: deinen Vater. „dein“ wäre Nominativ, „deine“ feminin oder Plural, „deinem“ Dativ.",
  ),
  sentence(
    "modalverb.konjugation",
    "MID",
    "Mein Bruder ___ sehr gut kochen.",
    "kann",
    ["kannst", "können", "könnt"],
    2,
    "Modalverb können zu er/sie/es: er kann (ohne Endung). „kannst“ gehört zu du, „können“ zu wir/sie/Sie, „könnt“ zu ihr.",
  ),
  sentence(
    "trennbares_verb",
    "MID",
    "Ich rufe dich heute Abend ___.",
    "an",
    ["ein", "mit", "zu"],
    3,
    "Das trennbare Verb heißt „anrufen“; die Vorsilbe steht am Satzende. „einrufen“ und „mitrufen“ gibt es nicht, „zurufen“ verlangt den Dativ (dir) und bedeutet etwas anderes.",
  ),
  sentence(
    "personalpronomen",
    "MID",
    "Wir sind am Samstag zu Hause. Besuchst du ___?",
    "uns",
    ["wir", "unser", "ihnen"],
    1,
    "„besuchen“ verlangt den Akkusativ; gemeint sind „wir“: uns. „wir“ ist Nominativ, „unser“ ein Possessivartikel, „ihnen“ Dativ Plural der 3. Person.",
  ),
  sentence(
    "praeteritum",
    "MID",
    "Gestern ___ ich Kopfschmerzen. Heute geht es mir besser.",
    "hatte",
    ["habe", "war", "hattest"],
    2,
    "Präteritum von haben zu ich: ich hatte. „habe“ ist Präsens, „war“ die Form von sein, „hattest“ gehört zu du.",
  ),
  sentence(
    "wfrage",
    "MID",
    "___ hilfst du heute? - Meiner Nachbarin. Sie zieht um.",
    "Wem",
    ["Wer", "Wen", "Was"],
    0,
    "„helfen“ verlangt den Dativ; nach einer Person im Dativ fragt man mit „Wem“. „Wer“ fragt nach dem Subjekt, „Wen“ nach dem Akkusativ, „Was“ nach einer Sache.",
  ),
  sentence(
    "imperativ.du",
    "EASY",
    "Lea, du hast Halsschmerzen. ___ viel Tee!",
    "Trink",
    ["Trinkt", "Trinkst", "Trinken"],
    1,
    "Imperativ für du: Verbstamm ohne Endung (Trink ...!). „Trinkt“ ist der Imperativ für ihr, „Trinkst“ die Präsensform von du, „Trinken“ ohne „Sie“ ist kein Imperativ.",
  ),
  sentence(
    "modalverb.konjugation",
    "MID",
    "Hier ___ Sie nicht rauchen.",
    "dürfen",
    ["darf", "darfst", "dürft"],
    2,
    "Modalverb dürfen zu Sie: Sie dürfen. „darf“ gehört zu ich und er/sie/es, „darfst“ zu du, „dürft“ zu ihr.",
  ),
  sentence(
    "wechselpraeposition",
    "HARD",
    "Das Bild hängt an ___ Wand.",
    "der",
    ["die", "dem", "den"],
    0,
    "Auf die Frage Wo? steht nach „an“ der Dativ; „Wand“ ist feminin: an der Wand. „die“ wäre Akkusativ (Wohin?), „dem“ Dativ maskulin oder neutral, „den“ Akkusativ maskulin.",
  ),
  sentence(
    "personalpronomen",
    "MID",
    "Mein Sohn braucht eine neue Hose. Die alte Hose passt ___ nicht mehr.",
    "ihm",
    ["ihn", "er", "ihr"],
    3,
    "„passen“ verlangt den Dativ; „mein Sohn“ ist maskulin: ihm. „ihn“ ist Akkusativ, „er“ Nominativ, „ihr“ Dativ feminin.",
  ),
  sentence(
    "praeposition.zeit",
    "HARD",
    "Ich bin ___ zwei Jahren nach Hamburg gezogen.",
    "vor",
    ["seit", "um", "bis"],
    2,
    "Ein abgeschlossenes Ereignis in der Vergangenheit: vor + Dativ (vor zwei Jahren). „seit“ passt zu etwas, das noch dauert, nicht zu „gezogen“; „um“ und „bis“ passen nicht vor „zwei Jahren“.",
  ),
  sentence(
    "perfekt.partizip",
    "HARD",
    "Wann bist du heute ___?",
    "aufgestanden",
    ["geaufstanden", "aufstehen", "aufgesteht"],
    1,
    "Partizip II eines trennbaren Verbs: Vorsilbe + ge + Stamm (auf-ge-standen); „stehen“ ist unregelmäßig. „geaufstanden“ hat ge- an der falschen Stelle, „aufgesteht“ eine regelmäßige Endung, „aufstehen“ ist der Infinitiv.",
  ),
  sentence(
    "artikel",
    "HARD",
    "Ich nehme ___ Pullover hier. Er ist schön warm.",
    "diesen",
    ["dieser", "dieses", "diese"],
    0,
    "Demonstrativartikel dies- im Akkusativ: „Pullover“ ist maskulin und Objekt von „nehmen“: diesen Pullover. „dieser“ ist Nominativ maskulin, „dieses“ neutral, „diese“ feminin oder Plural.",
  ),
];

// ---------------------------------------------------------------- LISTENING

const moebelhaus = clip(
  "course-a1-b-l-moebelhaus",
  "Durchsage im Möbelhaus",
  "Wohnen und Einkaufen",
  [{ label: "Ansage", voice: "B" }],
  [
    "Ansage: Liebe Kundinnen und Kunden! Heute sind alle Lampen billiger. Sie finden die Lampen im ersten Stock. Betten und Schränke gibt es im zweiten Stock. Unser Restaurant ist im Erdgeschoss. Wir haben heute bis einundzwanzig Uhr für Sie geöffnet.",
  ],
);

const bankKarte = clip(
  "course-a1-b-l-bank-karte",
  "Nachricht von der Bank",
  "Arbeitsalltag und Bank",
  [{ label: "Frau Schulte", voice: "A" }],
  [
    "Frau Schulte: Guten Tag, Herr Novak, hier ist Frau Schulte von der Bank am Marktplatz. Ihre neue Bankkarte ist da. Sie können die Karte ab Mittwoch bei uns abholen. Bitte bringen Sie Ihren Ausweis mit. Wir sind montags bis freitags von neun bis sechzehn Uhr für Sie da. Auf Wiederhören!",
  ],
);

const besprechung = clip(
  "course-a1-b-l-besprechung",
  "Nachricht vom Kollegen",
  "Arbeit und Termine",
  [{ label: "Herr Becker", voice: "C" }],
  [
    "Herr Becker: Hallo, Frau Lindner, hier ist Herr Becker. Unsere Besprechung ist morgen nicht um neun Uhr, sondern erst um elf Uhr. Um neun Uhr habe ich einen Termin beim Arzt. Um zwölf Uhr sind wir fertig, dann können wir zusammen in der Kantine essen. Bis morgen!",
  ],
);

const umsteigen = clip(
  "course-a1-b-l-umsteigen",
  "Durchsage im Zug",
  "Reisen",
  [{ label: "Ansage", voice: "D" }],
  [
    "Ansage: Liebe Fahrgäste, wir sind gleich in Köln. Fahrgäste nach Bonn steigen bitte in Köln um. Der Zug nach Bonn fährt von Gleis vier. Fahrgäste nach Aachen bleiben bitte in diesem Zug.",
  ],
);

const schwimmen = clip(
  "course-a1-b-l-schwimmen",
  "Nachricht von Paul",
  "Freizeit und Verabredung",
  [{ label: "Paul", voice: "B" }],
  [
    "Paul: Hallo Aylin, hier ist Paul. Am Samstag gehen wir ja zusammen schwimmen. Ich bin vorher noch bei meiner Oma in der Gartenstraße. Ich hole dich dann um drei Uhr bei dir zu Hause ab, und wir fahren zusammen zum Schwimmbad. Bis Samstag!",
  ],
);

const arzt = clip(
  "course-a1-b-l-arzt",
  "Gespräch beim Arzt",
  "Gesundheit",
  [
    { label: "Ärztin", voice: "A" },
    { label: "Herr Kaya", voice: "C" },
  ],
  [
    "Ärztin: Guten Tag, Herr Kaya. Was fehlt Ihnen denn?",
    "Herr Kaya: Guten Tag, Frau Doktor. Ich habe seit drei Tagen Halsschmerzen und Husten.",
    "Ärztin: Haben Sie auch Fieber?",
    "Herr Kaya: Gestern hatte ich ein bisschen Fieber, achtunddreißig Grad. Heute habe ich kein Fieber mehr.",
    "Ärztin: Gut. Machen Sie bitte den Mund auf. Ja, Ihr Hals ist sehr rot. Sie haben eine Erkältung.",
    "Herr Kaya: Brauche ich Tabletten?",
    "Ärztin: Nein, Tabletten brauchen Sie nicht. Trinken Sie viel Tee mit Honig und schlafen Sie viel.",
    "Herr Kaya: Kann ich morgen wieder arbeiten?",
    "Ärztin: Nein, bitte bleiben Sie bis Freitag zu Hause. Sie dürfen diese Woche nicht arbeiten.",
    "Herr Kaya: Und am Samstag? Da spiele ich immer Fußball.",
    "Ärztin: Am Samstag dürfen Sie noch keinen Sport machen. Aber Sie können spazieren gehen. Das ist gut für Sie.",
    "Herr Kaya: Und wann kann ich wieder Fußball spielen?",
    "Ärztin: Nächste Woche ist das kein Problem.",
    "Herr Kaya: Vielen Dank, Frau Doktor.",
    "Ärztin: Gute Besserung, Herr Kaya!",
  ],
);

const listening = [
  announcementPick(
    moebelhaus.key,
    "detail",
    "EASY",
    "Wo sind die Lampen?",
    "im ersten Stock",
    ["im zweiten Stock", "im Erdgeschoss"],
    0,
    "Die Lampen sind im ersten Stock. Betten und Schränke gibt es im zweiten Stock, das Restaurant ist im Erdgeschoss.",
  ),
  announcementPick(
    bankKarte.key,
    "detail",
    "MID",
    "Ab wann kann Herr Novak die Karte abholen?",
    "ab Mittwoch",
    ["ab Montag", "ab Freitag"],
    1,
    "Die Karte liegt ab Mittwoch bereit. Montag bis Freitag sind nur die Öffnungstage der Bank.",
  ),
  announcementPick(
    besprechung.key,
    "detail",
    "MID",
    "Wann beginnt die Besprechung morgen?",
    "um 11 Uhr",
    ["um 9 Uhr", "um 12 Uhr"],
    2,
    "Die Besprechung beginnt nicht um neun, sondern erst um elf Uhr. Um neun Uhr hat Herr Becker einen Arzttermin, um zwölf Uhr sind sie fertig.",
  ),
  announcementPick(
    umsteigen.key,
    "detail",
    "EASY",
    "Wo steigen die Fahrgäste nach Bonn um?",
    "in Köln",
    ["in Bonn", "in Aachen"],
    1,
    "Fahrgäste nach Bonn steigen in Köln um. Die Fahrgäste nach Aachen bleiben im Zug.",
  ),
  announcementPick(
    schwimmen.key,
    "detail",
    "MID",
    "Wo treffen sich Paul und Aylin?",
    "bei Aylin zu Hause",
    ["bei Pauls Oma", "im Schwimmbad"],
    2,
    "Paul ist vorher bei seiner Oma; er holt Aylin um drei Uhr bei ihr zu Hause ab, dann fahren sie zusammen zum Schwimmbad.",
  ),
  listeningTfng(
    arzt.key,
    "detail",
    "MID",
    [
      ["Herr Kaya ist seit einer Woche krank.", "F"],
      ["Herr Kaya hat heute Fieber.", "F"],
      ["Die Ärztin gibt Herrn Kaya keine Tabletten.", "R"],
      ["Herr Kaya darf morgen wieder arbeiten.", "F"],
      ["Herr Kaya darf am Samstag spazieren gehen.", "R"],
    ],
    "Herr Kaya hat seit drei Tagen Halsschmerzen und Husten. Fieber hatte er gestern, heute nicht mehr. Tabletten braucht er nicht. Er bleibt bis Freitag zu Hause. Am Samstag darf er keinen Sport machen, aber spazieren gehen.",
  ),
];

// ---------------------------------------------------------------- WRITING and SPEAKING

const writing = writingTask(
  "email",
  "Sie möchten im Juli mit Ihrer Familie ein paar Tage nach Konstanz fahren. Schreiben Sie eine E-Mail an das Hotel am See.\n\n" +
    "Schreiben Sie zu allen drei Punkten:\n" +
    "- Für wann brauchen Sie ein Zimmer?\n" +
    "- Fragen Sie nach dem Preis.\n" +
    "- Fragen Sie nach dem Frühstück.\n\n" +
    "Schreiben Sie ca. 25-40 Wörter. Vergessen Sie Anrede und Gruß nicht.",
  [
    "Zeitraum: für wann man ein Zimmer braucht (z. B. vom 10. bis 13. Juli / für drei Nächte im Juli)",
    "Frage nach dem Preis (z. B. Was kostet ein Zimmer für eine Nacht?)",
    "Frage nach dem Frühstück (z. B. Gibt es Frühstück? Ist das Frühstück im Preis?)",
  ],
  ["für wann Sie ein Zimmer brauchen", "nach dem Preis fragen", "nach dem Frühstück fragen"],
  FORMAL,
  "Bewertung A1: Aufgabenerfüllung (alle drei Punkte verständlich), formelle Anrede und Gruß (z. B. Sehr geehrte Damen und Herren ... Mit freundlichen Grüßen / Viele Grüße), einfache Sätze. Duzen ist ein Registerfehler. Fehler zählen nur, wenn sie das Verständnis stören.",
);

const SPEAKING_NOTE =
  "Bewertung A1: Aufgabe erfüllt (alle Punkte angesprochen), verständlich gesprochen, einfache Strukturen weitgehend korrekt. Einzelwörter und kurze Sätze sind auf A1 ausreichend.";

const speaking = [
  speakingTask(
    "introduction",
    "EASY",
    INTRO,
    "Sagen Sie bitte etwas über sich.\n\n- Name\n- Stadt oder Region, wo Sie wohnen\n- Arbeit oder Ausbildung\n- Sprachen\n- Freizeit",
    [
      "Name (Ich heiße ... / Mein Name ist ...)",
      "Wohnort (Ich wohne in ...)",
      "Arbeit, Schule, Studium oder Ausbildung (Ich bin ... / Ich arbeite als ... / Ich lerne ...)",
      "Sprachen, die man spricht (Ich spreche ...)",
      "mindestens eine Freizeitbeschäftigung (In meiner Freizeit ... / Ich ... gern.)",
    ],
    SPEAKING_NOTE,
  ),
  speakingTask(
    "topiccard",
    "MID",
    CARD,
    "Sprechen Sie über Urlaub und Reisen.\nSagen Sie zu jedem Wort ein bis zwei Sätze.\n\n- Urlaub\n- Verkehrsmittel\n- Wetter",
    [
      "Zu allen drei Wörtern (Urlaub, Verkehrsmittel, Wetter) mindestens ein verständlicher Satz",
      "Persönlicher Bezug, z. B. Im Urlaub fahre ich gern ans Meer. Ich fahre am liebsten mit dem Zug. Im Sommer ist das Wetter oft schön.",
      "einfache Sätze mit dem Verb an Position 2; ein einzelnes Wort ohne Satz gibt nur wenige Punkte",
    ],
    SPEAKING_NOTE,
  ),
  speakingTask(
    "request",
    "MID",
    ASK,
    "Bitten Sie um etwas und bieten Sie etwas an.\nWas sagen Sie? Sagen Sie zu jeder Situation ein bis zwei Sätze.\n\n- Im Restaurant: Sie möchten die Speisekarte.\n- Auf der Straße: Sie suchen den Bahnhof.\n- Im Kurs: Ihre Nachbarin hat kein Wörterbuch.",
    [
      "Restaurant: höfliche Bitte um die Speisekarte (z. B. Die Speisekarte, bitte. / Können Sie mir bitte die Karte bringen?)",
      "Straße: höfliche Frage an eine fremde Person nach dem Weg (z. B. Entschuldigung, wo ist der Bahnhof, bitte?)",
      "Kurs: Angebot an die Nachbarin (z. B. Möchtest du mein Wörterbuch? Du kannst mein Wörterbuch haben.)",
    ],
    SPEAKING_NOTE + " Höflichkeit (bitte, danke, Entschuldigung, Können Sie ...?) wird beachtet.",
  ),
];

export const FINAL_B: SeedCourseForm = a1Form(
  "A1",
  "B",
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
      "Artikel, kein, Plural, Akkusativ, Possessivartikel, dies-",
      "Dativ, Wechselpräpositionen, Personalpronomen",
      "Perfekt und Präteritum von sein und haben",
      "Imperativ mit Sie und du",
      "und, oder, aber, Präpositionen der Zeit, W-Fragen",
    ],
  },
  {
    reading: { stimuli: [salzburgMail, vierTexte], items: reading },
    grammar,
    listening: { stimuli: [moebelhaus, bankKarte, besprechung, umsteigen, schwimmen, arzt], items: listening },
    writing,
    speaking,
  },
);
