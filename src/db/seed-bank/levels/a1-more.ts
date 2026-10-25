import { authorFor, noParts, type LevelParts } from "../author";

/**
 * Round 3 additions to the A1 bank (formats from the model tests: see docs/research/formats-2026-10-25.md).
 * Built with the shared helpers in ../author.ts; the instruction lines come from ../instructions.ts.
 *
 * - Listening: two short announcements (Kurzansage), one speaker each, two items each (one single choice, one
 *   richtig / falsch set). In each script a value is corrected after it is first said, and the right one is
 *   repeated once.
 * - Writing: two replies to a quoted incoming text (a message to a friend, an e-mail to a neighbour).
 * - Grammar: four single items (three single choice, one drop-down) on four different skills.
 */
const a = authorFor("A1");

// ---------------------------------------------------------------- LISTENING

// Supermarket announcement: the price on the sign is wrong and the right price is repeated.
const lErdbeeren = a.clip(
  "supermarkt-erdbeeren",
  "Durchsage im Supermarkt",
  "Einkaufen im Supermarkt",
  [{ label: "Durchsage", voice: "D" }],
  [
    "Durchsage: Achtung, liebe Kundinnen und Kunden! Heute gibt es frische Erdbeeren. Auf dem Schild steht: drei Euro fünfzig. Das stimmt nicht. Das Kilo kostet nur zwei Euro fünfzig. Ich wiederhole: zwei Euro fünfzig das Kilo. Sie finden die Erdbeeren gleich neben dem Eingang. Der Supermarkt schließt heute um zwanzig Uhr. Vielen Dank!",
  ],
);

// Radio advertisement: the start of the flea market is earlier than usual and the new time is repeated.
const lFlohmarkt = a.clip(
  "flohmarkt-werbung",
  "Radiowerbung für einen Flohmarkt",
  "Freizeit und Flohmarkt",
  [{ label: "Sprecher", voice: "C" }],
  [
    "Sprecher: Was machen Sie am Samstag? Kommen Sie doch zum großen Flohmarkt im Stadtpark! Wichtig: Diesmal beginnt der Flohmarkt nicht um acht Uhr, sondern schon um sieben Uhr. Es gibt Bücher, Kleidung und Spielzeug, alles sehr billig. Der Eintritt kostet nichts. Also noch einmal: Samstag, Stadtpark, ab sieben Uhr. Bis bald!",
  ],
);

const erdbeeren = a.forClip(lErdbeeren);
const flohmarkt = a.forClip(lFlohmarkt);

const listeningItems = [
  // Durchsage im Supermarkt
  erdbeeren.choice("detail", "MID",
    "Was kostet heute ein Kilo Erdbeeren?",
    "2,50 Euro",
    ["3,50 Euro", "2,00 Euro", "1,50 Euro"], 2,
    "Auf dem Schild steht 3,50 Euro, aber die Durchsage sagt: Das stimmt nicht. Das Kilo kostet nur 2,50 Euro, und die Zahl wird wiederholt. 3,50 Euro ist der falsche Preis vom Schild. 2,00 und 1,50 Euro kommen in der Durchsage nicht vor."),
  erdbeeren.tfng("detail", "EASY",
    [
      ["Die Erdbeeren sind neben dem Eingang.", "R"],
      ["Der Supermarkt schließt heute um 18 Uhr.", "F"],
    ],
    "Die Erdbeeren sind gleich neben dem Eingang: richtig. Der Supermarkt schließt um zwanzig Uhr, also um 20 Uhr, nicht um 18 Uhr: falsch."),

  // Radiowerbung für einen Flohmarkt
  flohmarkt.choice("detail", "EASY",
    "Wann beginnt der Flohmarkt am Samstag?",
    "um 7 Uhr",
    ["um 8 Uhr", "um 9 Uhr", "um 6 Uhr"], 0,
    "Der Sprecher sagt: nicht um acht Uhr, sondern schon um sieben Uhr, und wiederholt am Ende: ab sieben Uhr. 8 Uhr ist die Zeit, die nicht mehr gilt. 9 und 6 Uhr kommen im Text nicht vor."),
  flohmarkt.tfng("detail", "MID",
    [
      ["Der Flohmarkt ist am Sonntag.", "F"],
      ["Für den Eintritt muss man nichts bezahlen.", "R"],
    ],
    "Der Flohmarkt ist am Samstag, nicht am Sonntag: falsch. \"Der Eintritt kostet nichts\" heißt, man bezahlt keinen Eintritt: richtig."),
];

// ---------------------------------------------------------------- WRITING

const MESSAGE_WORDS: [number, number] = [20, 40];
const INFORMAL = "informell (du)";
const FORMAL = "formell (Sie)";
const MESSAGE_NOTE =
  "Bewertung (Goethe A1, Schreiben Teil 2): Aufgabenerfüllung (alle drei Fragen verständlich beantwortet) und kommunikative Gestaltung (Anrede, Gruß, einfache verständliche Sätze). Fehler zählen nur, wenn sie das Verständnis stören.";

const writingItems = [
  a.writing("message", "MID", MESSAGE_WORDS,
    "Ihre Freundin Mila schickt Ihnen diese Nachricht:\n\n" +
      "„Hallo! Am Sonntag hat unsere Freundin Eva Geburtstag. Was schenken wir ihr? Wann gehen wir zusammen einkaufen? Und wo treffen wir uns? Liebe Grüße, Mila“\n\n" +
      "Schreiben Sie Mila eine Antwort (circa 30 Wörter). Beantworten Sie alle drei Fragen. Schreiben Sie auch eine Anrede und einen Gruß.",
    [
      "Antwort auf die erste Frage: eine Geschenkidee (ein einfaches Nomen genügt: Buch, Blumen, Schal)",
      "Antwort auf die zweite Frage: Tag oder Uhrzeit für den gemeinsamen Einkauf",
      "Antwort auf die dritte Frage: Treffpunkt (Bahnhof, Café, vor dem Kaufhaus)",
      "Anrede und Gruß (Hallo Mila ... / Liebe Grüße)",
    ],
    [
      "eine Idee für das Geschenk nennen",
      "sagen, wann Sie einkaufen gehen",
      "sagen, wo Sie sich treffen",
      "Anrede und Gruß",
    ],
    INFORMAL,
    MESSAGE_NOTE + " Die Geschenkidee darf ein einzelnes Wort sein; ein Satz wie \"Wir kaufen Blumen.\" ist ausreichend."),
  a.writing("email", "MID", MESSAGE_WORDS,
    "Ihre Nachbarin, Frau Brandt, schickt Ihnen diese E-Mail:\n\n" +
      "„Guten Tag, hier ist Anja Brandt aus dem zweiten Stock. Ich habe meinen Schlüssel verloren. Haben Sie einen Schlüssel gesehen? Wann haben Sie morgen Zeit? Dann suchen wir zusammen. Wo können wir uns treffen? Viele Grüße, Anja Brandt“\n\n" +
      "Schreiben Sie Frau Brandt eine Antwort (circa 30 Wörter). Beantworten Sie alle drei Fragen. Schreiben Sie auch eine Anrede und einen Gruß.",
    [
      "Antwort auf die erste Frage: Schlüssel gesehen oder nicht (bei Ja: wo)",
      "Antwort auf die zweite Frage: Uhrzeit für morgen (bei einer Absage ein einfacher Grund)",
      "Antwort auf die dritte Frage: Treffpunkt (vor dem Haus, im Hof, an der Haustür)",
      "formelle Anrede und Gruß mit Sie (Guten Tag, Frau Brandt ... / Viele Grüße)",
    ],
    [
      "sagen, ob Sie einen Schlüssel gesehen haben",
      "sagen, wann Sie morgen Zeit haben",
      "einen Treffpunkt nennen",
      "Anrede und Gruß",
    ],
    FORMAL,
    MESSAGE_NOTE + " Die Nachbarin wird mit Sie angesprochen; wer du schreibt, verfehlt das Register."),
];

// ---------------------------------------------------------------- GRAMMAR

const grammarItems = [
  a.grammarChoice("wfrage", "EASY",
    "___ kommt der Bus? - Um acht Uhr.",
    "Wann", ["Warum", "Wo", "Wer"], 1,
    "Nach der Uhrzeit fragt man mit \"Wann\". \"Warum\" fragt nach dem Grund, \"Wo\" nach dem Ort, \"Wer\" nach einer Person."),
  a.grammarSelect("negation.kein", "EASY",
    "Auf dem Markt gibt es heute leider {{g1}} Tomaten.",
    "keine", ["kein", "nicht"], 1,
    "\"Tomaten\" steht im Plural ohne Artikel; man verneint mit \"keine\". \"kein\" gehört zu einem Nomen im Singular (kein Brot). \"nicht\" verneint ein Verb oder Adjektiv, nicht ein Nomen ohne Artikel."),
  a.grammarChoice("modalverb.konjugation", "MID",
    "Morgen ___ wir ins Kino gehen.",
    "wollen", ["will", "willst", "wollt"], 3,
    "Zu \"wir\" gehört \"wollen\" (wie der Infinitiv). \"will\" ist ich/er/sie/es, \"willst\" ist du, \"wollt\" ist ihr."),
  a.grammarChoice("praeposition.ort", "MID",
    "Der Hund schläft gern ___ Wohnzimmer.",
    "im", ["ins", "zum", "in"], 2,
    "Die Frage ist \"Wo?\" (Ort): in + Dativ, also \"im\" (in dem) Wohnzimmer. \"ins\" und \"zum\" zeigen eine Richtung (Wohin?: Der Hund geht ins Wohnzimmer). \"in Wohnzimmer\" ohne Artikel ist falsch."),
];

export const A1_MORE: LevelParts = {
  ...noParts(),
  grammar: { stimuli: [], items: grammarItems },
  listening: { stimuli: [lErdbeeren, lFlohmarkt], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
};
