import type { TfngValue } from "@/lib/exam/types";
import { cloze } from "../cloze";
import { cTest } from "../ctest";
import { wordBank } from "../wordbank";
import type { SeedBankPart, SeedItem, SeedStimulus } from "../types";

/*
 * A seed item's text is part of its seed key (seed-key.ts). Changing the
 * wording of an item here makes it a new item: the bank top-up then adds it
 * next to the old one in every organisation that already has the old one. To
 * fix wording, add a new item (and retire the old row) rather than editing.
 */

/**
 * A1 starter bank (v2), written against docs/EXAM-BANK-RESEARCH.md, section A1
 * (Goethe-Zertifikat A1: Start Deutsch 1).
 *
 * - Grammar: 24 items over the A1 inventory (8 EASY, 8 MID, 8 HARD) plus three
 *   C-tests, three MC cloze texts and three word banks (spec 2026-10-18).
 * - Reading: 4 short texts (note/email, job ads, door sign, SMS), 4 items each.
 * - Listening: 3 clips (station announcement, dialogue at work, answerphone
 *   message), 4 items each.
 * - Writing: 2 forms with 5 slots and 4 short messages of about 30 words.
 * - Speaking: introduction, two key-word questions, two requests, one short
 *   description.
 *
 * Single-choice items have 4 options. `choice` builders take the correct
 * option first and place it at `pos`, so the key positions are set explicitly
 * and spread over a, b and c (d is always a wrong distractor). Personal details that touch protected
 * characteristics (age, origin) are left out of forms and prompts on purpose,
 * because the bank is also used in hiring.
 */

const LEVEL = "A1" as const;
type Within = NonNullable<SeedItem["within"]>;
type Pos = 0 | 1 | 2 | 3;
const IDS = ["a", "b", "c", "d"] as const;

function placeOptions(correct: string, distractors: [string, string, string], pos: Pos) {
  const texts: string[] = [...distractors];
  texts.splice(pos, 0, correct);
  return {
    content: { kind: "CHOICE" as const, options: texts.map((text, i) => ({ id: IDS[i], text })) },
    key: { kind: "CHOICE" as const, correct: [IDS[pos]] },
  };
}

// ---------------------------------------------------------------- GRAMMAR

function sc(
  skill: string,
  within: Within,
  prompt: string,
  correct: string,
  distractors: [string, string, string],
  pos: Pos,
  explanation: string,
): SeedItem {
  return {
    section: "GRAMMAR",
    level: LEVEL,
    type: "SINGLE_CHOICE",
    skillTag: `grammar.${skill}`,
    within,
    prompt,
    ...placeOptions(correct, distractors, pos),
    explanation,
  };
}

type GapSpec = { id: string; answers: string[]; choices?: string[] };

function gap(skill: string, within: Within, prompt: string, gaps: GapSpec[], explanation: string): SeedItem {
  return {
    section: "GRAMMAR",
    level: LEVEL,
    type: "GAP_FILL",
    skillTag: `grammar.${skill}`,
    within,
    prompt,
    content: {
      kind: "GAP",
      gaps: gaps.map((g) => (g.choices ? { id: g.id, choices: g.choices } : { id: g.id })),
    },
    key: { kind: "GAP", answers: Object.fromEntries(gaps.map((g) => [g.id, g.answers])) },
    explanation,
  };
}

const grammarItems: SeedItem[] = [
  // ---------------------------------------------------------------- EASY
  sc("praesens.sein", "EASY",
    "Ich ___ Lehrerin von Beruf.",
    "bin", ["ist", "bist", "sind"], 0,
    "Zu \"ich\" gehört die Form \"bin\" von sein. \"ist\" ist er/sie/es, \"bist\" ist du."),
  sc("wfrage", "EASY",
    "___ heißt du? - Ich heiße Daniel.",
    "Wie", ["Was", "Wo", "Wer"], 1,
    "Nach dem Namen fragt man mit \"Wie heißt du?\". \"Was heißt du?\" ist ein typischer Fehler (vgl. Türkisch \"adın ne\")."),
  sc("praesens.regelmaessig", "EASY",
    "Wo ___ ihr? - Wir wohnen in Hamburg.",
    "wohnt", ["wohnen", "wohnst", "wohne"], 2,
    "Zu \"ihr\" gehört die Endung -t: ihr wohnt. \"wohnen\" ist wir/sie, \"wohnst\" ist du."),
  gap("praesens.haben", "EASY",
    "Wir {{g1}} heute leider keine Zeit.",
    [{ id: "g1", answers: ["haben"], choices: ["hat", "haben", "habt"] }],
    "Zu \"wir\" gehört \"haben\". \"hat\" ist er/sie/es, \"habt\" ist ihr."),
  sc("artikel.nominativ", "EASY",
    "___ Kaffee ist sehr heiß.",
    "Der", ["Die", "Das", "Den"], 0,
    "\"Kaffee\" ist maskulin; Subjekt im Nominativ, also \"der Kaffee\"."),
  sc("praeposition.ort", "EASY",
    "Woher kommen Sie? - Ich komme ___ Brasilien.",
    "aus", ["in", "nach", "von"], 2,
    "Herkunft: kommen aus + Land. \"nach\" steht für die Richtung (Ich fahre nach ...), \"in\" für den Ort (Ich wohne in ...)."),
  sc("negation.kein", "EASY",
    "Ich fahre immer mit dem Bus. Ich habe ___ Auto.",
    "kein", ["nicht", "keine", "keinen"], 1,
    "Ein Nomen mit unbestimmtem Artikel verneint man mit \"kein\". \"Auto\" ist neutral, Akkusativ: kein Auto. \"keine\" wäre feminin oder Plural."),
  gap("imperativ.sie", "EASY",
    "Bitte {{g1}} Sie hier Ihren Namen.",
    [{ id: "g1", answers: ["schreiben"], choices: ["schreibt", "schreib", "schreiben"] }],
    "Imperativ mit Sie: Infinitiv + Sie (Schreiben Sie ...). \"schreibt\" ist ihr-Form, \"schreib\" ist du-Imperativ."),

  // ---------------------------------------------------------------- MID
  sc("praesens.vokalwechsel", "MID",
    "Mein Bruder ___ gern Pizza.",
    "isst", ["esst", "essen", "esse"], 2,
    "\"essen\" hat bei du und er/sie/es den Vokalwechsel e > i: er isst. \"esst\" ist die ihr-Form."),
  gap("artikel.akkusativ", "MID",
    "Wir suchen {{g1}} Tisch für die Küche.",
    [{ id: "g1", answers: ["einen"], choices: ["einen", "ein", "einem"] }],
    "\"suchen\" hat ein Akkusativobjekt; \"Tisch\" ist maskulin, also \"einen Tisch\". \"ein\" wäre Nominativ, \"einem\" Dativ."),
  sc("modalverb.konjugation", "MID",
    "___ du morgen um zehn Uhr kommen?",
    "Kannst", ["Kann", "Können", "Könnt"], 0,
    "Modalverb \"können\" zu \"du\": kannst. \"kann\" ist ich/er, \"können\" ist wir/sie/Sie."),
  sc("verb.trennbar", "MID",
    "Ich kaufe am Samstag im Supermarkt ___.",
    "ein", ["an", "auf", "zu"], 1,
    "Das trennbare Verb heißt \"einkaufen\"; die Vorsilbe steht am Satzende: Ich kaufe ... ein."),
  sc("possessiv.nominativ", "MID",
    "Das ist Herr Weber. Und das ist ___ Frau, Lena Weber.",
    "seine", ["ihre", "sein", "seiner"], 2,
    "Besitzer ist Herr Weber (maskulin): sein-. \"Frau\" ist feminin: seine. \"ihre\" passt zu einer Besitzerin, \"sein\" zu einem maskulinen oder neutralen Nomen."),
  gap("praeposition.zeit", "MID",
    "Der Deutschkurs beginnt {{g1}} Montag.",
    [{ id: "g1", answers: ["am"], choices: ["um", "am", "im"] }],
    "Wochentage: am Montag. \"um\" steht bei der Uhrzeit, \"im\" bei Monaten und Jahreszeiten."),
  sc("wortstellung.inversion", "MID",
    "Welcher Satz ist richtig?",
    "Am Samstag gehe ich ins Kino.", ["Am Samstag ich gehe ins Kino.", "Am Samstag ins Kino gehe ich.", "Am Samstag ich ins Kino gehe."], 0,
    "Im Aussagesatz steht das Verb auf Position 2. Steht eine Zeitangabe vorne, folgt direkt das Verb und dann das Subjekt."),
  gap("plural", "MID",
    "Ergänzen Sie den Plural von \"das Kind\".\n\nFrau Schulz hat zwei {{g1}}. Sie sind sieben und neun Jahre alt.",
    [{ id: "g1", answers: ["Kinder"] }],
    "Plural von \"das Kind\": die Kinder (Endung -er)."),

  // ---------------------------------------------------------------- HARD
  sc("perfekt.hilfsverb", "HARD",
    "Wir ___ am Sonntag spät aufgestanden.",
    "sind", ["haben", "seid", "bin"], 1,
    "\"aufstehen\" bildet das Perfekt mit sein (Bewegung/Zustandswechsel). Zu \"wir\" gehört \"sind\"; \"seid\" ist die ihr-Form."),
  gap("perfekt.partizip", "HARD",
    "Was hast du am Wochenende gemacht? - Ich habe ein Buch {{g1}}.",
    [{ id: "g1", answers: ["gelesen"], choices: ["gelest", "gelesen", "lesen"] }],
    "\"lesen\" ist unregelmäßig: Partizip II \"gelesen\" (ge- ... -en). \"gelest\" ist eine falsche regelmäßige Bildung."),
  sc("modalverb.satzklammer", "HARD",
    "Welcher Satz ist richtig?",
    "Heute muss ich lange arbeiten.", ["Heute ich muss lange arbeiten.", "Ich muss arbeiten heute lange.", "Ich heute muss lange arbeiten."], 2,
    "Das Modalverb steht auf Position 2, der Infinitiv am Satzende (Satzklammer). Nach \"Heute\" folgt direkt das Verb."),
  gap("verb.trennbar", "HARD",
    "Ergänzen Sie das Verb \"aufmachen\" im Präsens.\n\nDer Supermarkt {{g1}} um acht Uhr {{g2}}.",
    [
      { id: "g1", answers: ["macht"] },
      { id: "g2", answers: ["auf"] },
    ],
    "Trennbares Verb im Präsens: Der Verbteil \"macht\" steht auf Position 2, die Vorsilbe \"auf\" am Satzende. (\"im Präsens\" steht in der Aufgabe, weil sonst auch \"machte ... auf\" und \"hat ... aufgemacht\" richtig wären.)"),
  sc("possessiv.akkusativ", "HARD",
    "Ich suche ___ Pass. Ich brauche ihn morgen.",
    "meinen", ["mein", "meine", "meinem"], 0,
    "\"suchen\" verlangt den Akkusativ; \"Pass\" ist maskulin (\"ihn\"): meinen Pass. \"mein\" wäre Nominativ. (Nicht \"Schlüssel\": im Plural wäre \"meine Schlüssel\" auch richtig.)"),
  sc("uhrzeit", "HARD",
    "Es ist 8:30 Uhr. Was sagt man?",
    "Es ist halb neun.", ["Es ist halb acht.", "Es ist acht halb.", "Es ist halb zehn."], 1,
    "Im Deutschen zählt \"halb\" zur nächsten vollen Stunde: 8:30 = halb neun. \"acht halb\" ist eine Übertragung aus anderen Sprachen (z. B. Türkisch \"sekiz buçuk\")."),
  sc("imperativ.du", "HARD",
    "Paul, ___ bitte langsam! Ich verstehe dich nicht.",
    "sprich", ["sprichst", "sprecht", "sprech"], 2,
    "du-Imperativ von \"sprechen\": sprich (mit e > i, ohne -st). \"sprecht\" ist der Imperativ für ihr, passt aber nicht zu einer Person."),
  gap("negation.akkusativ", "HARD",
    "Danke, ich habe {{g1}} Hunger. Ich esse später.",
    [{ id: "g1", answers: ["keinen"], choices: ["kein", "nicht", "keinen"] }],
    "\"Hunger\" ist maskulin und Akkusativobjekt von \"haben\": keinen Hunger. Nomen ohne Artikel verneint man mit kein-, nicht mit \"nicht\"."),

  // ---------------------------------------------------------------- C-test
  cTest(LEVEL, "MID", {
    first: "Elif wohnt seit einem Jahr in Leipzig.",
    body:
      "Jeden Morgen steht sie um sechs Uhr auf. Dann trinkt sie einen Kaffee und isst ein Brot. " +
      "Um sieben Uhr fährt sie mit dem Bus zur Arbeit. Sie arbeitet in einem Hotel. " +
      "Die Arbeit ist interessant, aber auch schwer.",
    last: "Am Abend kocht sie gern und liest ein Buch.",
    // "isst etwas Brot" is just as correct as "isst ein Brot".
    variants: { 8: ["twas"] },
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["gens"], 2: ["ich"], 3: ["chste"], 4: ["us"],
      5: ["nken"], 6: ["nem"], 7: ["nter"], 10: ["hren"],
      11: ["ind"], 12: ["er"], 13: ["u"], 15: ["st"],
      16: ["tels"], 17: ["eiten"], 19: ["s"],
    },
  }),
  // A family weekend at the lake.
  cTest(LEVEL, "MID", {
    first: "Am Samstag fährt Familie Okafor mit dem Auto an einen See.",
    body:
      "Das Wetter ist sehr schön, und die Sonne scheint. " +
      "Die Kinder schwimmen im Wasser, und der Vater spielt mit dem Hund. Die Mutter liest ein Buch. " +
      "Am Mittag essen alle zusammen Käse, Brot und Obst. Später machen sie einen Spaziergang.",
    last: "Am Abend fahren alle müde, aber glücklich nach Hause.",
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["tern"], 2: ["hen"], 3: ["nter"], 4: ["nnen"],
      6: ["immt"], 7: ["sers"], 8: ["es"], 9: ["elen"],
      10: ["en"], 11: ["as"], 12: ["egt"], 13: ["ches"],
      15: ["lem"], 16: ["sen"], 19: ["ich"],
    },
  }),
  // Shopping at the market for a birthday.
  cTest(LEVEL, "MID", {
    first: "Morgen hat Amira Geburtstag, und ihr Bruder Tarek kauft heute auf dem Markt ein.",
    body:
      "Er möchte für seine Schwester einen Obstsalat machen. Zuerst kauft er Äpfel, Bananen und Erdbeeren. " +
      "Alles ist heute sehr frisch und nicht teuer. Für den Tisch sucht er noch Blumen. " +
      "Am Ende findet er sehr schöne gelbe Tulpen.",
    last: "Jetzt hat Tarek alles und geht schnell nach Hause.",
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["hten"], 2: ["inem"], 3: ["nem"], 4: ["ht"],
      5: ["ufen"], 6: ["feln"], 8: ["ls"], 10: ["sche"],
      11: ["chts"], 13: ["schen"], 14: ["s"], 15: ["me"],
      16: ["den"], 18: ["önen"], 19: ["pe"],
    },
  }),

  // ---------------------------------------------------------------- MC cloze
  cloze(LEVEL, "EASY", {
    title: "Einkaufen am Samstag",
    first: "Am Samstag gehe ich mit meiner Schwester einkaufen.",
    body:
      "Wir [[brauchen|braucht|brauche|brauchst]] Milch, Brot und Obst. " +
      "Der Supermarkt [[ist|bin|bist|sind]] nicht weit, wir gehen [[zu|nach|in|an]] Fuß. " +
      "Meine Schwester nimmt [[einen|ein|eine|einem]] Korb. Ich kaufe [[ein|eine|einen|einem]] Brot und vier Äpfel. " +
      "Die Äpfel [[sind|ist|bist|seid]] heute sehr billig. Meine Schwester [[möchte|möchten|möchtest|möchtet]] auch Käse. " +
      "Der Käse ist teuer, [[aber|sondern|dass|wenn]] er schmeckt sehr gut. Wir nehmen [[ihn|er|ihm|ihr]]. " +
      "An der Kasse [[bezahle|bezahlst|bezahlt|bezahlen]] ich mit Karte. Dann gehen wir [[nach|zu|in|bei]] Hause.",
    last: "Am Abend kochen wir zusammen eine Suppe.",
    note: "Verbformen im Präsens (g1, g2, g6, g7, g10), zu Fuß / nach Hause (g3, g11), unbestimmter Artikel im Akkusativ (g4, g5), aber mit Hauptsatz (g8), Personalpronomen im Akkusativ (g9).",
  }),
  cloze(LEVEL, "MID", {
    title: "Ein Tag im Büro",
    first: "Herr Demir arbeitet in einem Büro in Hamburg.",
    body:
      "Er [[fängt|fange|fangt|fangen]] jeden Tag um acht Uhr an. Zuerst liest er [[seine|sein|seinen|seiner]] E-Mails. " +
      "Um zehn Uhr telefoniert er [[mit|zu|an|für]] seiner Chefin. Mittags isst er in [[der|die|dem|den]] Kantine. " +
      "Das Essen dort [[schmeckt|schmecke|schmecken|schmeckst]] gut und ist nicht teuer. " +
      "Am Nachmittag [[muss|müssen|musst|müsst]] er noch einen Bericht schreiben. " +
      "Der Bericht ist wichtig, [[denn|dass|deshalb|wenn]] die Chefin liest ihn morgen. " +
      "Um fünf Uhr [[ist|hat|sind|bist]] er fertig. Er fährt mit [[dem|der|den|das]] Bus nach Hause. " +
      "Dort wartet schon [[seine|sein|seinen|seinem]] Katze. Er gibt [[ihr|sie|ihm|ihn]] etwas zu essen.",
    last: "Dann sitzt er auf dem Sofa und liest die Zeitung.",
    note: "trennbares Verb (g1), Possessivartikel (g2, g10), Präpositionen mit Dativ (g3, g4, g9), Verbformen und Modalverb (g5, g6, g8), denn mit Hauptsatz (g7), Personalpronomen im Dativ (g11).",
  }),
  cloze(LEVEL, "HARD", {
    title: "Eine Einladung",
    first: "Liebe Mia, am Sonntag mache ich eine kleine Party.",
    body:
      "[[Hast|Hat|Habt|Habe]] du Zeit? Die Party beginnt [[um|am|im|in]] drei Uhr. " +
      "Wir sitzen [[im|in|ins|am]] Garten, er ist klein, aber [[sehr|viel|viele|vielen]] schön. " +
      "Ich lade auch [[meine|meinen|meiner|mein]] Freundinnen aus dem Deutschkurs ein. " +
      "Kannst du einen Salat [[mitbringen|mitbringst|bringst|mitgebracht]]? " +
      "Getränke [[brauchst|braucht|brauchen|brauche]] du nicht, ich habe genug. " +
      "Ich habe leider [[keinen|kein|nicht|keine]] Grill, aber mein Nachbar gibt [[mir|mich|ich|mein]] seinen. " +
      "Bitte [[ruf|rufst|ruft|rufen]] mich bis Freitag an. Ich freue mich [[auf|an|mit|zu]] dich!",
    last: "Viele Grüße, deine Lena",
    note: "Verbformen und Wortstellung (g1, g7), Zeitangabe mit um (g2), im Garten (g3), sehr + Adjektiv (g4), Possessivartikel im Plural (g5), Modalverb + Infinitiv (g6), kein (g8), Dativpronomen (g9), Imperativ (g10), sich freuen auf (g11).",
  }),

  // ---------------------------------------------------------------- word bank
  wordBank(LEVEL, "EASY", {
    title: "Mein Zimmer",
    first: "Ich wohne mit zwei Freunden in einer Wohnung in Köln.",
    body:
      "Mein Zimmer ist klein, aber sehr [[hell]], denn es hat zwei große Fenster. " +
      "Am [[Schreibtisch]] lerne ich jeden Abend Deutsch. Im Regal stehen viele [[Bücher]]. " +
      "Ich schlafe gut, denn mein [[Bett]] ist neu und bequem. " +
      "In der Küche [[koche]] ich am Wochenende für meine Freunde. Sie [[arbeiten]] beide in einem Hotel. " +
      "Im [[Kühlschrank]] haben wir immer Milch und Käse. Die Miete [[kostet]] nur 400 Euro im Monat.",
    last: "Ich wohne sehr gern hier.",
    distractors: ["Lampe", "Tasche", "schläfst", "liest", "dunkel"],
  }),
  wordBank(LEVEL, "MID", {
    title: "Paula im Café",
    first: "Paula arbeitet seit Mai in einem Café am Markt.",
    body:
      "Sie [[steht]] jeden Tag um fünf Uhr auf. Zum Frühstück trinkt sie nur einen [[Tee]]. " +
      "Das Café [[öffnet]] um sieben Uhr. Am Morgen kommen viele [[Gäste]]. Sie trinken Kaffee und essen [[Kuchen]]. " +
      "Paula ist immer [[freundlich]] und hilft gern. Die Arbeit [[gefällt]] ihr sehr. " +
      "Um zwei Uhr [[geht]] sie nach Hause.",
    last: "Am Abend ist sie müde, aber glücklich.",
    distractors: ["Tasse", "Tisch", "kaufen", "teuer", "wohnst"],
  }),
  wordBank(LEVEL, "HARD", {
    title: "Ein Ausflug",
    first: "Am Sonntag macht Familie Yilmaz einen Ausflug an einen See.",
    body:
      "Das Wetter ist [[sonnig]] und warm. Sie [[fahren]] mit dem Zug, denn sie haben kein Auto. " +
      "Die Fahrt [[dauert]] eine Stunde. Die Kinder [[schwimmen]] im See. " +
      "Der Vater liest eine [[Zeitung]], und die Mutter macht viele [[Fotos]]. " +
      "Am Mittag sind alle [[hungrig]]. Sie essen Brot, Käse und [[Obst]].",
    last: "Am Abend sind alle müde, aber sehr zufrieden.",
    distractors: ["Buch", "Bahnhof", "regnet", "schwimmt", "billig"],
  }),
];

// ---------------------------------------------------------------- READING

type ReadingSkill = "gist" | "detail" | "inference" | "vocabulary" | "structure";
const TFNG_PROMPT = "Richtig, falsch oder nicht im Text? Entscheiden Sie für jede Aussage.";

const text = (key: string, title: string, topic: string, body: string): SeedStimulus => ({
  key,
  section: "READING",
  level: LEVEL,
  title,
  topic,
  body: body.trim(),
});

function forText(stimulusKey: string) {
  const base = (skill: ReadingSkill, within: Within, prompt: string, explanation: string) => ({
    section: "READING" as const,
    level: LEVEL,
    skillTag: `reading.${skill}`,
    within,
    stimulusKey,
    prompt,
    explanation,
  });
  return {
    choice(
      skill: ReadingSkill,
      within: Within,
      prompt: string,
      correct: string,
      distractors: [string, string, string],
      pos: Pos,
      explanation: string,
    ): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "SINGLE_CHOICE",
        ...placeOptions(correct, distractors, pos),
      };
    },
    /** Options are the three ads in fixed order plus "Keine Anzeige"; `pos` is the matching ad. */
    ad(skill: ReadingSkill, within: Within, prompt: string, pos: Pos, explanation: string): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "SINGLE_CHOICE",
        content: {
          kind: "CHOICE",
          options: [
            { id: "a", text: "Anzeige A" },
            { id: "b", text: "Anzeige B" },
            { id: "c", text: "Anzeige C" },
            { id: "d", text: "Keine Anzeige" },
          ],
        },
        key: { kind: "CHOICE", correct: [IDS[pos]] },
      };
    },
    tfng(skill: ReadingSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      const ids = statements.map((_, i) => `s${i + 1}`);
      return {
        ...base(skill, within, TFNG_PROMPT, explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", statements: statements.map(([t], i) => ({ id: ids[i], text: t })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, v], i) => [ids[i], v])) },
      };
    },
  };
}

const rArbeitstag = text(
  "v2-r-a1-erster-arbeitstag",
  "E-Mail: Ihr erster Arbeitstag",
  "Arbeit",
  `
Lieber Herr Okafor,

herzlich willkommen in unserem Team! Ihr erster Arbeitstag ist am Montag. Bitte kommen Sie um neun Uhr, nicht um acht. Ich warte unten am Eingang auf Sie. Bringen Sie bitte Ihren Pass und ein Foto mit. Mittags essen wir zusammen, das Essen bezahlt die Firma. Am Nachmittag lernen Sie dann Ihre Kollegen kennen.

Bis Montag!
Petra Berger
`,
);

const rJobs = text(
  "v2-r-a1-jobanzeigen",
  "Drei Jobanzeigen",
  "Arbeitssuche",
  `
Anzeige A
Café am Markt sucht Kellnerin oder Kellner. Nur am Samstag und Sonntag, 10 bis 16 Uhr. Bitte rufen Sie an: 0341 22 80 17.

Anzeige B
Hotel Lindenhof sucht Mitarbeiterin oder Mitarbeiter für die Rezeption. Montag bis Freitag, 7 bis 13 Uhr. Schreiben Sie uns eine E-Mail: job@hotel-lindenhof.de

Anzeige C
Supermarkt Frischkauf sucht Hilfe an der Kasse. Montag bis Freitag, 18 bis 22 Uhr. Kommen Sie einfach vorbei: Bahnhofstraße 4.
`,
);

const rPraxis = text(
  "v2-r-a1-arztpraxis",
  "Schild an der Arztpraxis",
  "Gesundheit",
  `
Praxis Dr. Sandra Yilmaz

Sprechzeiten:
Montag, Dienstag, Donnerstag: 8 bis 12 Uhr und 15 bis 18 Uhr
Mittwoch und Freitag: 8 bis 12 Uhr

Bitte rufen Sie vor Ihrem Besuch an und machen Sie einen Termin: 0761 34 55 20.

Urlaub: Vom 12. bis 23. August ist die Praxis geschlossen. In dieser Zeit hilft Ihnen Dr. Jonas Peters, Marktplatz 3.
`,
);

const rSms = text(
  "v2-r-a1-sms-zug",
  "SMS von Sami",
  "Reisen und Verkehr",
  `
Hallo Jana,
ich sitze noch im Zug. Er hat 15 Minuten Verspätung. Ich bin also erst um Viertel nach sieben am Bahnhof, nicht um sieben. Kannst du mich bitte mit dem Auto abholen? Mein Koffer ist sehr schwer. Oder ich nehme ein Taxi, das ist kein Problem. Schreib mir bitte kurz!
Liebe Grüße
Sami
`,
);

const arbeitstag = forText(rArbeitstag.key);
const jobs = forText(rJobs.key);
const praxis = forText(rPraxis.key);
const sms = forText(rSms.key);

const readingItems: SeedItem[] = [
  // E-Mail: erster Arbeitstag
  arbeitstag.choice("gist", "EASY",
    "Warum schreibt Frau Berger diese E-Mail?",
    "Herr Okafor beginnt bald eine neue Arbeit.",
    ["Frau Berger sucht einen neuen Kollegen.", "Herr Okafor soll am Montag nicht kommen.", "Herr Okafor soll am Montag um acht Uhr kommen."], 1,
    "Die E-Mail begrüßt Herrn Okafor im Team und informiert über seinen ersten Arbeitstag am Montag."),
  arbeitstag.tfng("detail", "MID",
    [
      ["Herr Okafor beginnt am Montag um acht Uhr.", "F"],
      ["Herr Okafor trifft Frau Berger am Montag unten am Eingang.", "R"],
    ],
    "Er soll um neun Uhr kommen, \"nicht um acht\". Frau Berger wartet unten am Eingang auf ihn."),
  arbeitstag.choice("detail", "EASY",
    "Was soll Herr Okafor mitbringen?",
    "seinen Pass und ein Foto",
    ["Geld für das Mittagessen", "seinen Pass und einen Kuli", "sein Mittagessen und ein Foto"], 2,
    "Im Text: \"Bringen Sie bitte Ihren Pass und ein Foto mit.\" Das Essen bezahlt die Firma."),
  arbeitstag.tfng("detail", "MID",
    [
      ["Herr Okafor bezahlt das Mittagessen selbst.", "F"],
      ["Herr Okafor lernt am Vormittag seine Kollegen kennen.", "F"],
    ],
    "Das Mittagessen bezahlt die Firma. Die Kollegen lernt er am Nachmittag kennen, nicht am Vormittag."),

  // Drei Jobanzeigen (Wo finden Sie Informationen?)
  jobs.ad("detail", "EASY",
    "Sie suchen Arbeit und haben nur am Wochenende Zeit. Welche Anzeige passt?",
    0,
    "Nur das Café sucht jemanden für Samstag und Sonntag. Hotel und Supermarkt suchen von Montag bis Freitag."),
  jobs.ad("detail", "MID",
    "Sie können nur von Montag bis Freitag und nur bis 14 Uhr arbeiten. Welche Anzeige passt?",
    1,
    "Die Arbeit im Hotel ist von Montag bis Freitag, 7 bis 13 Uhr. Das Café sucht nur am Wochenende (und bis 16 Uhr), der Supermarkt am Abend (18 bis 22 Uhr)."),
  jobs.ad("inference", "HARD",
    "Sie haben kein Telefon und keinen Computer. Welche Anzeige passt?",
    2,
    "Beim Café muss man anrufen, beim Hotel eine E-Mail schreiben. Beim Supermarkt kann man einfach vorbeikommen."),
  jobs.tfng("detail", "MID",
    [
      ["Im Hotel arbeitet man auch am Wochenende.", "F"],
      ["Im Supermarkt arbeitet man am Abend.", "R"],
    ],
    "Das Hotel sucht von Montag bis Freitag. Die Arbeit im Supermarkt ist von 18 bis 22 Uhr, also am Abend."),

  // Schild an der Arztpraxis
  praxis.tfng("detail", "EASY",
    [["Die Praxis ist am Mittwochnachmittag offen.", "F"]],
    "Mittwoch und Freitag sind nur von 8 bis 12 Uhr Sprechzeiten, am Nachmittag ist die Praxis geschlossen."),
  praxis.choice("inference", "HARD",
    "Sie arbeiten jeden Tag bis 14 Uhr. An welchem Tag können Sie am Nachmittag in die Praxis gehen?",
    "am Dienstag",
    ["am Mittwoch", "am Freitag", "am Samstag"], 0,
    "Am Nachmittag (15 bis 18 Uhr) ist die Praxis nur am Montag, Dienstag und Donnerstag offen. Von den Optionen passt nur Dienstag."),
  praxis.choice("detail", "MID",
    "Was sollen die Patienten vor dem Besuch machen?",
    "in der Praxis anrufen",
    ["eine E-Mail schreiben", "zu Dr. Peters gehen", "einen Brief an die Praxis schreiben"], 1,
    "Im Text: \"Bitte rufen Sie vor Ihrem Besuch an und machen Sie einen Termin.\" Zu Dr. Peters geht man nur im Urlaub der Praxis."),
  praxis.tfng("detail", "MID",
    [["Im Urlaub von Dr. Yilmaz können die Patienten zu einem anderen Arzt gehen.", "R"]],
    "Vom 12. bis 23. August hilft Dr. Jonas Peters am Marktplatz 3."),

  // SMS von Sami
  sms.choice("detail", "EASY",
    "Wo ist Sami jetzt?",
    "im Zug",
    ["am Bahnhof", "im Taxi", "im Bus"], 2,
    "Sami schreibt: \"ich sitze noch im Zug\". Am Bahnhof ist er erst später, ein Taxi ist nur eine Möglichkeit."),
  sms.choice("detail", "MID",
    "Wann ist Sami am Bahnhof?",
    "um 7:15 Uhr",
    ["um 7:00 Uhr", "um 7:45 Uhr", "um 7:30 Uhr"], 0,
    "\"Viertel nach sieben\" ist 7:15 Uhr. 7:00 Uhr war die alte Zeit (\"nicht um sieben\"); 7:45 Uhr wäre \"Viertel vor acht\"."),
  sms.choice("gist", "MID",
    "Was möchte Sami von Jana?",
    "Sie soll ihn abholen.",
    ["Sie soll ein Taxi bestellen.", "Sie soll ihn anrufen.", "Sie soll ihm seinen Koffer schicken."], 1,
    "Sami fragt: \"Kannst du mich bitte mit dem Auto abholen?\" Das Taxi nimmt er nur, wenn Jana nicht kann; er bittet um eine kurze Nachricht, nicht um einen Anruf."),
  sms.tfng("inference", "HARD",
    [
      ["Samis Koffer ist nicht leicht.", "R"],
      ["Für Sami ist ein Taxi ein großes Problem.", "F"],
    ],
    "Sein Koffer ist sehr schwer. Zum Taxi schreibt er: \"das ist kein Problem\"."),
];

// ---------------------------------------------------------------- LISTENING

type ListeningSkill = "gist" | "detail" | "inference";
const LISTEN_TFNG_PROMPT = "Richtig, falsch oder nicht im Text? Entscheiden Sie für jede Aussage.";

function clip(
  key: string,
  title: string,
  topic: string,
  speakers: Array<{ label: string; voice: "A" | "B" }>,
  lines: string[],
): SeedStimulus {
  return { key, section: "LISTENING", level: LEVEL, title, topic, speakers, body: lines.join("\n") };
}

function forClip(stimulusKey: string) {
  const base = (skill: ListeningSkill, within: Within, prompt: string, explanation: string) => ({
    section: "LISTENING" as const,
    level: LEVEL,
    skillTag: `listening.${skill}`,
    within,
    stimulusKey,
    prompt,
    explanation,
  });
  return {
    choice(
      skill: ListeningSkill,
      within: Within,
      prompt: string,
      correct: string,
      distractors: [string, string, string],
      pos: Pos,
      explanation: string,
    ): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "SINGLE_CHOICE",
        ...placeOptions(correct, distractors, pos),
      };
    },
    tfng(skill: ListeningSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      const ids = statements.map((_, i) => `s${i + 1}`);
      return {
        ...base(skill, within, LISTEN_TFNG_PROMPT, explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", statements: statements.map(([t], i) => ({ id: ids[i], text: t })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, v], i) => [ids[i], v])) },
      };
    },
  };
}

// Announcement: one voice, played once in the Goethe format.
const lBahnhof = clip(
  "v2-l-a1-durchsage-gleis",
  "Durchsage am Bahnhof",
  "Mobilität",
  [{ label: "Ansage", voice: "A" }],
  [
    "Ansage: Achtung, bitte! Eine Information für alle Fahrgäste an Gleis vier.",
    "Ansage: Der Regionalzug nach Erfurt, Abfahrt neun Uhr zwanzig, hat heute fünfzehn Minuten Verspätung.",
    "Ansage: Er fährt also erst um neun Uhr fünfunddreißig.",
    "Ansage: Und Achtung: Der Zug fährt heute nicht von Gleis vier. Er fährt von Gleis sieben.",
    "Ansage: Die erste Klasse ist heute am Ende des Zuges.",
    "Ansage: Vielen Dank.",
  ],
);

// Dialogue at work: two voices, played twice in the Goethe format.
const lKollege = clip(
  "v2-l-a1-neuer-kollege",
  "Der erste Tag im Büro",
  "Arbeit",
  [
    { label: "Frau Schmidt", voice: "A" },
    { label: "Herr Haddad", voice: "B" },
  ],
  [
    "Frau Schmidt: Guten Morgen! Sind Sie der neue Kollege?",
    "Herr Haddad: Ja, guten Morgen. Ich bin Karim Haddad. Heute ist mein erster Tag hier.",
    "Frau Schmidt: Herzlich willkommen! Ich bin Anna Schmidt. Ihr Büro ist im zweiten Stock, Zimmer zweihundertvierzehn.",
    "Herr Haddad: Danke. Und gibt es hier auch Kaffee?",
    "Frau Schmidt: Ja, die Küche ist hier unten, gleich links. Der Kaffee kostet nichts.",
    "Herr Haddad: Super! Und wann ist hier Mittagspause?",
    "Frau Schmidt: Meistens um halb eins. Heute gehen wir zusammen essen. Kommen Sie mit?",
    "Herr Haddad: Ja, sehr gern!",
  ],
);

// Answerphone message: one voice, played twice in the Goethe format.
const lKurs = clip(
  "v2-l-a1-mailbox-sprachkurs",
  "Nachricht von der Sprachschule",
  "Aus- und Weiterbildung",
  [{ label: "Frau Novak", voice: "A" }],
  [
    "Frau Novak: Guten Tag, Herr Ramos, hier spricht Lucia Novak von der Sprachschule am Marktplatz.",
    "Frau Novak: Es geht um Ihren Deutschkurs. Der Kurs ist jeden Dienstag und Donnerstag, am Abend von sechs bis acht Uhr.",
    "Frau Novak: Wir haben aber ein neues Zimmer. Der Kurs ist jetzt im dritten Stock, Zimmer dreihundertzwölf. Er ist nicht mehr im ersten Stock.",
    "Frau Novak: Das Buch müssen Sie nicht kaufen. Sie bekommen es in der ersten Stunde von uns.",
    "Frau Novak: Bitte bezahlen Sie den Kurs bis Freitag. Haben Sie noch Fragen? Dann rufen Sie mich bitte an. Auf Wiederhören!",
  ],
);

const bahnhof = forClip(lBahnhof.key);
const kollege = forClip(lKollege.key);
const kurs = forClip(lKurs.key);

const listeningItems: SeedItem[] = [
  // Durchsage am Bahnhof
  bahnhof.choice("gist", "EASY",
    "Warum gibt es diese Durchsage?",
    "Der Zug kommt heute zu spät.",
    ["Heute fährt kein Zug nach Erfurt.", "Der Zug fährt heute früher ab.", "Der Zug hat heute weniger Wagen."], 2,
    "Der Zug hat fünfzehn Minuten Verspätung; er fährt, aber später."),
  bahnhof.choice("detail", "MID",
    "Wann fährt der Zug heute ab?",
    "um 9:35 Uhr",
    ["um 9:20 Uhr", "um 9:15 Uhr", "um 9:50 Uhr"], 0,
    "9:20 Uhr ist die normale Abfahrt; mit fünfzehn Minuten Verspätung fährt der Zug um 9:35 Uhr."),
  bahnhof.tfng("detail", "MID",
    [["Der Zug fährt heute von Gleis vier ab.", "F"]],
    "Die Fahrgäste warten an Gleis vier, aber der Zug fährt heute von Gleis sieben."),
  bahnhof.choice("detail", "HARD",
    "Wo ist heute die erste Klasse?",
    "hinten",
    ["vorne", "in der Mitte", "links"], 1,
    "\"am Ende des Zuges\" bedeutet hinten."),

  // Der erste Tag im Büro
  kollege.tfng("gist", "EASY",
    [["Herr Haddad arbeitet heute zum ersten Mal hier.", "R"]],
    "Herr Haddad sagt: \"Heute ist mein erster Tag hier.\""),
  kollege.choice("detail", "EASY",
    "Wo ist das Büro von Herrn Haddad?",
    "im zweiten Stock",
    ["im Erdgeschoss", "im ersten Stock", "im dritten Stock"], 2,
    "Frau Schmidt sagt: \"Ihr Büro ist im zweiten Stock.\" Die Küche ist unten."),
  kollege.tfng("detail", "MID",
    [["Herr Haddad muss für den Kaffee bezahlen.", "F"]],
    "\"Der Kaffee kostet nichts.\""),
  kollege.choice("detail", "HARD",
    "Wann ist meistens Mittagspause?",
    "um 12:30 Uhr",
    ["um 13:30 Uhr", "um 11:30 Uhr", "um 12:00 Uhr"], 0,
    "\"halb eins\" ist 12:30 Uhr. 13:30 Uhr ist ein typischer Fehler (englisch \"half one\" bzw. \"eins halb\")."),

  // Nachricht von der Sprachschule
  kurs.choice("detail", "EASY",
    "An welchen Tagen ist der Kurs?",
    "am Dienstag und Donnerstag",
    ["am Montag und Donnerstag", "am Dienstag und Freitag", "am Mittwoch und Freitag"], 1,
    "Der Kurs ist jeden Dienstag und Donnerstag. Freitag ist nur der Termin für die Bezahlung."),
  kurs.choice("detail", "MID",
    "Wo ist der Kurs jetzt?",
    "im dritten Stock",
    ["im ersten Stock", "im zweiten Stock", "im Erdgeschoss"], 2,
    "Der Kurs ist jetzt im dritten Stock, nicht mehr im ersten Stock."),
  kurs.tfng("detail", "MID",
    [["Herr Ramos muss das Kursbuch selbst kaufen.", "F"]],
    "Er muss das Buch nicht kaufen, er bekommt es in der ersten Stunde von der Schule."),
  kurs.choice("detail", "MID",
    "Was soll Herr Ramos bis Freitag machen?",
    "den Kurs bezahlen",
    ["das Buch kaufen", "Frau Novak anrufen", "ein Buch bestellen"], 0,
    "\"Bitte bezahlen Sie den Kurs bis Freitag.\" Anrufen soll er nur, wenn er Fragen hat."),
];

// ---------------------------------------------------------------- WRITING

const INFORMAL = "informell (du)";
const FORMAL = "formell (Sie)";

function writingTask(
  skill: string,
  within: Within,
  words: [number, number],
  prompt: string,
  contentPoints: string[],
  studentPoints: string[],
  register: string | undefined,
  explanation: string,
): SeedItem {
  return {
    section: "WRITING",
    level: LEVEL,
    type: "WRITING_PROMPT",
    skillTag: `writing.${skill}`,
    within,
    prompt,
    content: { kind: "WRITING", minWords: words[0], maxWords: words[1] },
    key: { kind: "NONE" },
    rubric: register ? { contentPoints, register, studentPoints } : { contentPoints, studentPoints },
    explanation,
  };
}

const MESSAGE_WORDS: [number, number] = [20, 40];
const FORM_WORDS: [number, number] = [10, 40];
const MESSAGE_NOTE =
  "Bewertung (Goethe A1, Schreiben Teil 2): Aufgabenerfüllung, je Leitpunkt verständlich behandelt, plus kommunikative Gestaltung (Anrede, Gruß, einfache verständliche Sätze). Fehler zählen nur, wenn sie das Verständnis stören.";

const writingItems: SeedItem[] = [
  writingTask("form", "EASY", FORM_WORDS,
    "Ihre Kollegin Maria Costa möchte im Fitnessstudio \"Aktiv\" trainieren. Sie spricht noch nicht gut Deutsch. Sie helfen ihr mit dem Formular.\n\n" +
      "Maria Costa wohnt mit ihrem Mann in der Hafenstraße 9 in 28195 Bremen. Sie arbeitet am Tag in einem Büro und möchte nur am Abend trainieren. Sie bezahlt nicht bar, sie bezahlt mit Karte.\n\n" +
      "Schreiben Sie die fünf Angaben für das Formular. Schreiben Sie immer die Nummer und die Angabe, zum Beispiel: \"1. Familienname: ...\"\n\n" +
      "1. Familienname\n" +
      "2. Straße und Hausnummer\n" +
      "3. Postleitzahl und Wohnort\n" +
      "4. Trainingszeit (Vormittag / Nachmittag / Abend)\n" +
      "5. Bezahlung (bar / Karte)",
    [
      "1. Familienname: Costa",
      "2. Straße und Hausnummer: Hafenstraße 9",
      "3. Postleitzahl und Wohnort: 28195 Bremen",
      "4. Trainingszeit: Abend",
      "5. Bezahlung: Karte",
    ],
    [
      "Familienname",
      "Straße und Hausnummer",
      "Postleitzahl und Wohnort",
      "Trainingszeit",
      "Bezahlung",
      "immer die Nummer und die Angabe schreiben",
    ],
    "Formular (Stichworte)",
    "Formular mit fünf Feldern (Goethe A1, Schreiben Teil 1). Je Feld ein Punkt; kleine Rechtschreibfehler, die das Verständnis nicht stören, sind kein Fehler."),
  writingTask("form", "MID", FORM_WORDS,
    "Ihr Kollege Tarek Mansour möchte einen Deutschkurs machen. Sie helfen ihm mit der Anmeldung.\n\n" +
      "Tarek wohnt in der Lindenallee 21 in 04109 Leipzig. Seine Handynummer ist 0176 55 23 88. Er arbeitet von Montag bis Freitag bis 17 Uhr. Er hat nur am Abend Zeit. Er möchte zweimal pro Woche lernen.\n\n" +
      "Schreiben Sie die fünf Angaben für die Anmeldung. Schreiben Sie immer die Nummer und die Angabe, zum Beispiel: \"1. Vorname und Familienname: ...\"\n\n" +
      "1. Vorname und Familienname\n" +
      "2. Telefonnummer\n" +
      "3. Postleitzahl und Wohnort\n" +
      "4. Kurszeit (Vormittag / Abend)\n" +
      "5. Wie oft pro Woche? (einmal / zweimal / fünfmal)",
    [
      "1. Vorname und Familienname: Tarek Mansour",
      "2. Telefonnummer: 0176 55 23 88",
      "3. Postleitzahl und Wohnort: 04109 Leipzig",
      "4. Kurszeit: Abend",
      "5. Wie oft pro Woche: zweimal",
    ],
    [
      "Vorname und Familienname",
      "Telefonnummer",
      "Postleitzahl und Wohnort",
      "Kurszeit",
      "wie oft pro Woche",
      "immer die Nummer und die Angabe schreiben",
    ],
    "Formular (Stichworte)",
    "Formular mit fünf Feldern (Goethe A1, Schreiben Teil 1). Je Feld ein Punkt. Die Straße wird nicht gefragt; wer sie statt des Wohnorts einträgt, bekommt für Feld 3 keinen Punkt."),
  writingTask("message", "EASY", MESSAGE_WORDS,
    "Ihr Freund Leon lädt Sie am Freitag um 19 Uhr zum Essen ein. Sie kommen gern, aber erst um 20 Uhr. Schreiben Sie Leon eine kurze Nachricht (circa 30 Wörter).\n\n" +
      "- Danken Sie für die Einladung.\n" +
      "- Sie kommen später. Warum?\n" +
      "- Fragen Sie: Was sollen Sie mitbringen?\n\n" +
      "Schreiben Sie auch eine Anrede und einen Gruß.",
    [
      "Dank für die Einladung",
      "Information: kommt erst später (um 20 Uhr), mit einem einfachen Grund",
      "Frage, was man mitbringen soll",
      "Anrede und Gruß (Hallo Leon ... / Viele Grüße)",
    ],
    [
      "für die Einladung danken",
      "sagen, dass Sie später kommen, und warum",
      "fragen, was Sie mitbringen sollen",
      "Anrede und Gruß",
    ],
    INFORMAL,
    MESSAGE_NOTE),
  writingTask("email", "MID", MESSAGE_WORDS,
    "Sie sind krank und können morgen nicht in den Deutschkurs kommen. Schreiben Sie eine E-Mail an Ihre Kursleiterin, Frau Wagner (circa 30 Wörter).\n\n" +
      "- Sagen Sie: Sie kommen morgen nicht.\n" +
      "- Warum nicht?\n" +
      "- Fragen Sie nach den Hausaufgaben.\n\n" +
      "Schreiben Sie auch eine Anrede und einen Gruß.",
    [
      "Information: kommt morgen nicht in den Kurs",
      "Grund (krank)",
      "Frage nach den Hausaufgaben",
      "passende Anrede und Gruß mit Sie (Liebe Frau Wagner / Sehr geehrte Frau Wagner ... Viele Grüße)",
    ],
    [
      "sagen, dass Sie morgen nicht kommen",
      "einen Grund nennen",
      "nach den Hausaufgaben fragen",
      "Anrede und Gruß",
    ],
    FORMAL,
    MESSAGE_NOTE),
  writingTask("message", "MID", MESSAGE_WORDS,
    "Sie haben eine neue Arbeit. Schreiben Sie Ihrer Freundin Nina eine Nachricht (circa 30 Wörter).\n\n" +
      "- Wo arbeiten Sie jetzt?\n" +
      "- Was machen Sie bei der Arbeit?\n" +
      "- Wann arbeiten Sie?\n\n" +
      "Schreiben Sie auch eine Anrede und einen Gruß.",
    [
      "Arbeitsort (Firma, Geschäft, Stadt o. Ä.)",
      "Tätigkeit oder Beruf, in einfachen Worten",
      "Arbeitszeit (Tage oder Uhrzeit)",
      "Anrede und Gruß (Hallo Nina ... / Liebe Grüße)",
    ],
    [
      "wo Sie jetzt arbeiten",
      "was Sie bei der Arbeit machen",
      "wann Sie arbeiten",
      "Anrede und Gruß",
    ],
    INFORMAL,
    MESSAGE_NOTE),
  writingTask("email", "HARD", MESSAGE_WORDS,
    "Sie lesen eine Anzeige: \"Café Sonne sucht Kellnerin oder Kellner.\" Sie möchten dort arbeiten. Schreiben Sie eine E-Mail an das Café (circa 30 Wörter).\n\n" +
      "- Wer sind Sie? Was machen Sie jetzt?\n" +
      "- Wann können Sie arbeiten?\n" +
      "- Fragen Sie: Wie viel Geld bekommen Sie pro Stunde?\n\n" +
      "Schreiben Sie auch eine Anrede und einen Gruß.",
    [
      "kurze Vorstellung (Name, jetzige Arbeit oder Situation)",
      "Tage oder Uhrzeiten, an denen man arbeiten kann",
      "Frage nach dem Lohn pro Stunde",
      "formelle Anrede und Gruß (Sehr geehrte Damen und Herren ... Mit freundlichen Grüßen)",
    ],
    [
      "wer Sie sind und was Sie jetzt machen",
      "wann Sie arbeiten können",
      "nach dem Lohn pro Stunde fragen",
      "Anrede und Gruß",
    ],
    FORMAL,
    MESSAGE_NOTE),
];

// ---------------------------------------------------------------- SPEAKING

type Timing = { thinkSeconds: number; answerSeconds: number; maxTakes: number };
const INTRO: Timing = { thinkSeconds: 30, answerSeconds: 60, maxTakes: 2 };
const SHORT: Timing = { thinkSeconds: 20, answerSeconds: 30, maxTakes: 2 };
const LONGER: Timing = { thinkSeconds: 30, answerSeconds: 60, maxTakes: 2 };
const SPEAKING_NOTE =
  "Bewertung A1: Aufgabe erfüllt (alle Punkte angesprochen), verständlich gesprochen, einfache Strukturen weitgehend korrekt. Einzelwörter und kurze Sätze sind auf A1 ausreichend.";

function speakingTask(
  skill: string,
  within: Within,
  timing: Timing,
  prompt: string,
  contentPoints: string[],
  studentPoints: string[],
  register?: string,
): SeedItem {
  return {
    section: "SPEAKING",
    level: LEVEL,
    type: "SPEAKING_PROMPT",
    skillTag: `speaking.${skill}`,
    within,
    prompt,
    content: { kind: "SPEAKING", ...timing },
    key: { kind: "NONE" },
    rubric: register ? { contentPoints, register, studentPoints } : { contentPoints, studentPoints },
    explanation: SPEAKING_NOTE,
  };
}

const speakingItems: SeedItem[] = [
  speakingTask("introduction", "EASY", INTRO,
    "Stellen Sie sich bitte vor. Sprechen Sie über diese Punkte:\n\n" +
      "- Name\n- Wohnort\n- Sprachen\n- Beruf, Arbeit oder Schule\n- Hobbys",
    [
      "Name",
      "Wohnort",
      "Sprachen, die man spricht",
      "Beruf, Arbeit, Schule oder Ausbildung (z. B. Ich bin Schülerin.)",
      "mindestens ein Hobby",
    ],
    [
      "Name",
      "Wohnort",
      "Sprachen",
      "Beruf, Arbeit oder Schule",
      "Hobbys",
    ]),
  speakingTask("question", "EASY", SHORT,
    "Thema: Arbeit. Auf Ihrer Karte steht: \"Mittagspause?\"\n\n" +
      "Stellen Sie einer Kollegin eine Frage mit diesem Wort. Dann antworten Sie selbst auf Ihre Frage.",
    [
      "eine verständliche Frage zum Wort \"Mittagspause\" (z. B. Wann machst du / machen Sie Mittagspause?)",
      "korrekte Frageform (W-Frage oder Verb an Position 1)",
      "eine passende kurze Antwort",
      "du oder Sie: unter Kollegen ist beides richtig",
    ],
    [
      "eine Frage mit dem Wort auf der Karte stellen",
      "selbst auf die Frage antworten",
    ]),
  speakingTask("question", "MID", SHORT,
    "Thema: Einkaufen. Auf Ihrer Karte steht: \"Supermarkt?\"\n\n" +
      "Stellen Sie einem Freund eine Frage mit diesem Wort. Dann antworten Sie selbst auf Ihre Frage.",
    [
      "eine verständliche Frage zum Wort \"Supermarkt\" (z. B. Wo ist hier ein Supermarkt? Wann gehst du in den Supermarkt?)",
      "korrekte Frageform (W-Frage oder Verb an Position 1)",
      "eine passende kurze Antwort",
    ],
    [
      "eine Frage mit dem Wort auf der Karte stellen",
      "selbst auf die Frage antworten",
    ],
    INFORMAL),
  speakingTask("request", "MID", SHORT,
    "Sie sind im Büro. Sie möchten etwas schreiben, aber Sie haben keinen Kuli. Ihr Kollege Herr Braun hat einen Kuli.\n\n" +
      "Bitten Sie Herrn Braun um den Kuli. Sagen Sie auch danke.",
    [
      "höfliche Bitte (z. B. Können Sie mir bitte ... geben? / Haben Sie bitte ...?)",
      "Gegenstand genannt (Kuli)",
      "Dank",
    ],
    [
      "höflich um den Kuli bitten",
      "sich bedanken",
    ],
    FORMAL),
  speakingTask("request", "HARD", SHORT,
    "Ihre Chefin, Frau Lang, sagt: \"Können Sie morgen schon um sieben Uhr kommen? Wir haben viel Arbeit.\" Sie können morgen nicht um sieben Uhr kommen.\n\n" +
      "Antworten Sie höflich. Sagen Sie, warum Sie nicht können, und machen Sie einen Vorschlag.",
    [
      "höfliche Absage (z. B. Das tut mir leid, ich kann nicht ...)",
      "einfacher Grund",
      "Vorschlag (andere Uhrzeit oder anderer Tag)",
    ],
    [
      "höflich absagen",
      "einen Grund nennen",
      "einen Vorschlag machen",
    ],
    FORMAL),
  speakingTask("description", "HARD", LONGER,
    "Erzählen Sie von Ihrem Tag:\n\n" +
      "- Wann stehen Sie auf?\n" +
      "- Was machen Sie am Vormittag und am Nachmittag?\n" +
      "- Was machen Sie am Abend?",
    [
      "Uhrzeit des Aufstehens",
      "Tätigkeiten am Vormittag und am Nachmittag",
      "Tätigkeiten am Abend",
      "einfache Zeitangaben und Satzverbindungen (dann, danach, um ... Uhr)",
    ],
    [
      "wann Sie aufstehen",
      "was Sie am Vormittag und am Nachmittag machen",
      "was Sie am Abend machen",
    ]),
];

export const A1_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = {
  grammar: { stimuli: [], items: grammarItems },
  reading: { stimuli: [rArbeitstag, rJobs, rPraxis, rSms], items: readingItems },
  listening: { stimuli: [lBahnhof, lKollege, lKurs], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
