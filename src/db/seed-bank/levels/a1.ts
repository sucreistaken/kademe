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
 * - Reading: 7 short texts and ad sets (e-mail, job ads, practice sign, SMS,
 *   classified ads with a matching task, pool signs, supermarket flyer), 3 items
 *   each. The true/false sets are two-way (Richtig / Falsch), as in ÖSD and telc.
 * - Listening: 5 clips (station announcement, dialogue at work, two answerphone
 *   messages one of which is a note-taking task, weather report), 3 items each.
 *   A reworked script gets a new key ("-v3") because the audio is made from it.
 * - Writing: 2 forms with 5 slots, an answer to a quoted message with three
 *   questions and 3 short messages of about 30 words.
 * - Speaking: introduction, a topic-word card, two key-word questions, two
 *   requests, one short description.
 *
 * Single-choice items have 4 options. `choice` builders take the correct
 * option first and place it at `pos`, so the key positions are set explicitly
 * and spread over a to d. Personal details that touch protected
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
    "Nach dem Namen fragt man mit \"Wie heißt du?\". \"Was heißt du?\" ist ein typischer Fehler (Übertragung aus anderen Sprachen)."),
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
    "Der Kaffee hier kommt ___ Brasilien.",
    "aus", ["in", "nach", "von"], 2,
    "Herkunft einer Ware: kommen aus + Land. \"nach\" steht für die Richtung (Ich fahre nach ...), \"in\" für den Ort (Ich wohne in ...)."),
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
    "Ergänzen Sie den Plural von \"das Kind\".\n\nFrau Schulz hat zwei {{g1}}. Sie gehen beide in die Schule.",
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
    "Im Deutschen zählt \"halb\" zur nächsten vollen Stunde: 8:30 = halb neun. \"acht halb\" ist eine Übertragung aus anderen Sprachen."),
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
      11: ["chten"], 13: ["schen"], 14: ["s"], 15: ["me"],
      16: ["den"], 18: ["önen"], 19: ["pe"],
    },
  }),

  // ---------------------------------------------------------------- MC cloze
  cloze(LEVEL, "EASY", {
    title: "Einkaufen am Samstag",
    first: "Am Samstag gehe ich mit meiner Schwester einkaufen.",
    body:
      "Wir [[brauchen|brauche|gebraucht|benutzen]] Milch, Brot und Obst. " +
      "Der Supermarkt [[ist|bin|sein|hat]] nicht weit, wir gehen zu Fuß. " +
      "Meine Schwester nimmt [[einen|ein|eine|einem]] Korb. Ich kaufe heute [[kein|keine|nicht|nichts]] Fleisch. Ich nehme vier Äpfel. " +
      "Die Äpfel sind heute [[sehr|viel|viele|mehr]] billig. Der Käse ist teuer, [[aber|sondern|dass|wenn]] er schmeckt sehr gut. " +
      "Wir nehmen [[ihn|er|ihm|ihr]]. [[Um|Am|Im|In]] elf Uhr sind wir an der Kasse. " +
      "Ich bezahle mit [[meiner|meine|meinen|mein]] Karte. Dann gehen wir [[nach|zu|in|bei]] Hause.",
    last: "Am Abend kochen wir zusammen eine Suppe.",
    note: "Verb und Bedeutung (g1), sein (g2), Akkusativ des unbestimmten Artikels (g3), kein bei Nomen ohne Artikel (g4), sehr + Adjektiv (g5), aber mit Hauptsatz (g6), Personalpronomen im Akkusativ (g7), Uhrzeit mit um (g8), Possessivartikel im Dativ nach mit (g9), nach Hause (g10).",
  }),
  cloze(LEVEL, "MID", {
    title: "Ein Tag im Büro",
    first: "Herr Demir arbeitet in einem Büro in Hamburg.",
    body:
      "Das Büro ist [[im|in|ins|am]] ersten Stock. " +
      "Er [[fängt|fange|anfängt|anfangen]] jeden Tag um acht Uhr an. Zuerst liest er [[seine|sein|seinen|seiner]] E-Mails. " +
      "Um zehn Uhr telefoniert er [[mit|zu|an|für]] seiner Chefin. Mittags isst er in [[der|die|dem|den]] Kantine. " +
      "Das Essen dort [[schmeckt|schmecken|geschmeckt|fehlt]] gut und ist nicht teuer. " +
      "Am Nachmittag schreibt er noch einen Bericht. Der Bericht ist wichtig, [[denn|dass|deshalb|wenn]] die Chefin liest ihn morgen. " +
      "Heute hat er [[keine|kein|keinen|nicht]] Zeit für Sport. Um fünf Uhr [[ist|hat|sein|sind]] er fertig. " +
      "Er fährt mit dem Bus nach Hause. Dort wartet schon seine Katze. Er gibt [[ihr|sie|ihm|ihn]] etwas zu essen.",
    last: "Dann sitzt er auf dem Sofa und liest die Zeitung.",
    note: "Ort mit im (g1), trennbares Verb (g2), Possessivartikel im Plural (g3), telefonieren mit (g4), Dativ nach in (g5), Verb und Bedeutung (g6), denn mit Hauptsatz (g7), kein bei Nomen im Feminin (g8), sein (g9), Personalpronomen im Dativ (g10).",
  }),
  cloze(LEVEL, "HARD", {
    title: "Eine Einladung",
    first: "Liebe Mia, am Sonntag mache ich eine kleine Party.",
    body:
      "Ich schreibe dir, [[weil|denn|aber|ob]] ich dich einladen möchte. " +
      "[[Hast|Hat|Bist|Kannst]] du Zeit? Die Party beginnt [[um|am|im|in]] drei Uhr. " +
      "Wir sitzen [[im|in|ins|am]] Garten, er ist klein, aber [[sehr|viel|viele|vielen]] schön. " +
      "Ich lade auch [[meine|meinen|meiner|mein]] Freundinnen aus dem Deutschkurs ein. " +
      "Kannst du einen Salat [[mitbringen|mitgebracht|mitzubringen|mitbringst]]? " +
      "Ich habe leider [[keinen|kein|nicht|keine]] Grill, aber mein Nachbar gibt [[mir|mich|ich|mein]] seinen. " +
      "Bitte [[ruf|rufst|angerufen|anrufen]] mich bis Freitag an. Ich freue mich [[auf|an|mit|zu]] dich!",
    last: "Viele Grüße, deine Lena",
    note: "Nebensatz mit weil (g1), Frage mit haben (g2), Zeitangabe mit um (g3), Ort mit im (g4), sehr + Adjektiv (g5), Possessivartikel im Plural (g6), Modalverb + Infinitiv eines trennbaren Verbs (g7), kein bei maskulinem Nomen (g8), Dativpronomen (g9), du-Imperativ (g10), sich freuen auf (g11).",
  }),

  // ---------------------------------------------------------------- word bank
  wordBank(LEVEL, "EASY", {
    title: "Mein Zimmer",
    first: "Ich wohne mit zwei Freunden in einer Wohnung in Köln.",
    body:
      "Mein Zimmer ist klein, aber sehr [[hell]], [[denn]] es hat zwei große Fenster. " +
      "Am [[Schreibtisch]] lerne ich jeden Abend Deutsch. Im Regal stehen viele [[Bücher]]. " +
      "Ich schlafe gut: Mein [[Bett]] ist neu und bequem. " +
      "In der Küche [[koche]] ich am Wochenende für meine Freunde. Am Samstag essen wir immer zusammen. " +
      "Im [[Kühlschrank]] haben wir immer Milch und Käse. Die Miete [[kostet]] nur 400 Euro im Monat.",
    last: "Ich wohne sehr gern hier.",
    distractors: ["weil", "dunkel", "Lampe", "kochst", "kosten"],
    note: "Adjektiv, Konjunktion denn mit Hauptsatz (weil verlangt das Verb am Ende), Nomen mit Artikel und Plural, Verbformen zu ich und zu einem Singular-Subjekt.",
  }),
  wordBank(LEVEL, "MID", {
    title: "Paula im Café",
    first: "Paula arbeitet seit Mai in einem Café am Markt.",
    body:
      "Sie [[steht]] jeden Tag um fünf Uhr auf. Zum Frühstück trinkt sie nur einen [[Tee]]. " +
      "Das Café [[öffnet]] um sieben Uhr. Am Morgen kommen viele [[Gäste]]. Sie trinken Kaffee und essen [[Kuchen]]. " +
      "Paula ist immer [[freundlich]] und hilft gern. Die Arbeit [[gefällt]] ihr sehr. " +
      "Um zwei Uhr geht sie [[nach]] Hause.",
    last: "Am Abend ist sie müde, aber glücklich.",
    distractors: ["zu", "Tasse", "stehst", "teuer", "gefallen"],
    note: "Verbformen zu sie / es / die Arbeit, Nomen im Singular und Plural, Adjektiv, nach Hause (zu Hause passt nicht zu gehen).",
  }),
  wordBank(LEVEL, "HARD", {
    title: "Ein Tag in der Stadt",
    first: "Am Sonntag macht Familie Yilmaz einen Ausflug in die Stadt.",
    body:
      "Das Wetter ist [[kühl]] und trocken. Sie [[fahren]] mit der Straßenbahn, [[denn]] sie haben kein Auto. " +
      "Die Fahrt [[dauert]] zwanzig Minuten. Die Kinder [[sehen]] im Museum alte Autos. " +
      "Der Vater kauft eine [[Karte]], und die Mutter macht viele [[Fotos]]. " +
      "Am Mittag sind alle [[hungrig]]. Sie essen Suppe und Brot.",
    last: "Am Abend sind alle müde, aber sehr zufrieden.",
    distractors: ["weil", "regnet", "sieht", "Buch", "billig"],
    note: "Konjunktion denn mit Hauptsatz (weil verlangt das Verb am Ende), Verbformen im Plural und Singular, Nomen mit Genus (eine Karte, nicht eine Buch) und Plural, Adjektive.",
  }),
];

// ---------------------------------------------------------------- READING

type ReadingSkill = "gist" | "detail" | "inference" | "vocabulary" | "structure";
const TFNG_PROMPT = "Richtig oder falsch? Entscheiden Sie für jede Aussage.";

const text = (key: string, title: string, topic: string, body: string): SeedStimulus => ({
  key,
  section: "READING",
  level: LEVEL,
  title,
  topic,
  body: body.trim(),
});

/** Statements of a two-way set: only Richtig / Falsch, as in ÖSD and telc A1. */
function twoWaySet(statements: Array<[string, TfngValue]>) {
  const ids = statements.map((_, i) => `s${i + 1}`);
  return {
    content: { kind: "TFNG" as const, twoWay: true, statements: statements.map(([t], i) => ({ id: ids[i], text: t })) },
    key: { kind: "TFNG" as const, answers: Object.fromEntries(statements.map(([, v], i) => [ids[i], v])) },
  };
}

const AD_LETTERS = ["Anzeige A", "Anzeige B", "Anzeige C", "Anzeige D"] as const;

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
    /** Options are the four ads in fixed order; `pos` is the matching ad. Every option is a real ad. */
    ad(skill: ReadingSkill, within: Within, prompt: string, pos: Pos, explanation: string): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "SINGLE_CHOICE",
        content: { kind: "CHOICE", options: AD_LETTERS.map((text, i) => ({ id: IDS[i], text })) },
        key: { kind: "CHOICE", correct: [IDS[pos]] },
      };
    },
    tfng(skill: ReadingSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      return {
        ...base(skill, within, TFNG_PROMPT, explanation),
        type: "TRUE_FALSE_NG",
        ...twoWaySet(statements),
      };
    },
    /**
     * Situations to ads. `pairs[i]` is the 1-based position in `right` of the target for situation i;
     * the last target is the leftover "no ad fits".
     */
    match(
      skill: ReadingSkill,
      within: Within,
      prompt: string,
      left: string[],
      right: string[],
      pairs: number[],
      explanation: string,
    ): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "MATCHING",
        content: {
          kind: "MATCHING",
          left: left.map((t, i) => ({ id: `l${i + 1}`, text: t })),
          right: right.map((t, i) => ({ id: `r${i + 1}`, text: t })),
        },
        key: { kind: "MATCHING", pairs: Object.fromEntries(pairs.map((r, i) => [`l${i + 1}`, `r${r}`])) },
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

herzlich willkommen im Team! Ihr erster Arbeitstag ist am Montag. Bitte kommen Sie um neun Uhr, nicht um acht. Ich warte unten am Eingang auf Sie. Bringen Sie bitte Ihren Pass und ein Foto mit. Mittags essen wir zusammen, das bezahlt die Firma. Am Nachmittag lernen Sie Ihre Kollegen kennen.

Bis Montag!
Petra Berger
`,
);

const rJobs = text(
  "v2-r-a1-jobanzeigen",
  "Vier Jobanzeigen",
  "Arbeitssuche",
  `
Anzeige A
Café am Markt sucht Kellnerin oder Kellner. Nur Samstag und Sonntag, 10 bis 16 Uhr. Bitte rufen Sie an: 0341 22 80 17.

Anzeige B
Hotel Lindenhof sucht Mitarbeiterin oder Mitarbeiter für die Rezeption. Montag bis Freitag, 7 bis 13 Uhr. Schreiben Sie eine E-Mail: job@hotel-lindenhof.de

Anzeige C
Supermarkt Frischkauf sucht Hilfe an der Kasse. Montag bis Freitag, 18 bis 22 Uhr. Kommen Sie einfach vorbei: Bahnhofstraße 4.

Anzeige D
Bäckerei Hahn sucht Verkäuferin oder Verkäufer. Dienstag bis Samstag, 6 bis 12 Uhr. Rufen Sie an: 0341 70 21 33.
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

const rKleinanzeigen = text(
  "v3-r-a1-kleinanzeigen",
  "Kleinanzeigen aus der Stadt",
  "Freizeit und Wohnen",
  `
Anzeige A
Fahrrad zu verkaufen: blau, drei Jahre alt, 80 Euro. Tel. 030 23125 401

Anzeige B
Tanzkurs für Anfänger. Jeden Mittwoch um 19 Uhr in der Volkshochschule. Anmeldung online.

Anzeige C
Zimmer in WG frei: 14 qm, 280 Euro warm, ab 1. November. Tel. 030 23125 402

Anzeige D
Sprachcafé: Deutsch sprechen und neue Leute treffen. Freitag, 17 Uhr, Stadtbibliothek. Kostenlos!

Anzeige E
Schwimmkurs für Kinder. Samstag, 10 Uhr, Hallenbad. Sechs Wochen, 45 Euro.
`,
);

const rSchilder = text(
  "v3-r-a1-schilder-schwimmbad",
  "Schilder im Schwimmbad",
  "Freizeit und Sport",
  `
Schild 1 (am Beckenrand)
Achtung! Der Boden ist nass. Bitte nicht rennen.

Schild 2 (bei den Schließfächern)
Schließfach: 1 Euro. Sie bekommen den Euro zurück, wenn Sie das Fach wieder öffnen.

Schild 3 (an der Kasse)
Heute von 15 bis 17 Uhr Kinderschwimmen. Das große Becken ist in dieser Zeit geschlossen.
`,
);

const rAngebote = text(
  "v3-r-a1-supermarkt-angebote",
  "Angebote im Supermarkt",
  "Einkaufen",
  `
Supermarkt Grünberg: Angebote der Woche

Äpfel, 1 kg: 1,99 Euro (nur Montag bis Mittwoch)
Milch, 2 Liter: 1,50 Euro
Mineralwasser, 6 Flaschen: 2,99 Euro (nur Donnerstag und Freitag)
Brot: Montag bis Samstag, 17 bis 18 Uhr, zum halben Preis

Geöffnet: Montag bis Samstag, 8 bis 20 Uhr
`,
);

const arbeitstag = forText(rArbeitstag.key);
const jobs = forText(rJobs.key);
const praxis = forText(rPraxis.key);
const sms = forText(rSms.key);
const kleinanzeigen = forText(rKleinanzeigen.key);
const schilder = forText(rSchilder.key);
const angebote = forText(rAngebote.key);

const readingItems: SeedItem[] = [
  // E-Mail: erster Arbeitstag
  arbeitstag.choice("gist", "EASY",
    "Warum schreibt Frau Berger diese E-Mail?",
    "Sie sagt Herrn Okafor, was am ersten Tag passiert.",
    [
      "Herr Okafor soll am Montag um acht Uhr kommen.",
      "Sie fragt Herrn Okafor, ob er mit dem Team isst.",
      "Sie sucht einen neuen Kollegen für das Team.",
    ], 1,
    "Die E-Mail begrüßt Herrn Okafor im Team und sagt ihm, wann er kommen soll, was er mitbringt und was am ersten Tag passiert. Um acht Uhr soll er ausdrücklich nicht kommen; das Essen ist keine Frage, sondern eine Information; er ist selbst der neue Kollege."),
  arbeitstag.tfng("detail", "MID",
    [
      ["Herr Okafor soll am Montag erst um neun Uhr kommen.", "R"],
      ["Herr Okafor muss sein Mittagessen am ersten Tag selbst bezahlen.", "F"],
      ["Herr Okafor lernt seine Kollegen schon am Vormittag kennen.", "F"],
    ],
    "Er soll um neun Uhr kommen, \"nicht um acht\". Das Essen bezahlt die Firma, nicht er. Die Kollegen lernt er erst am Nachmittag kennen."),
  arbeitstag.choice("detail", "EASY",
    "Was soll Herr Okafor am Montag mitbringen?",
    "seinen Pass und ein Foto",
    [
      "seinen Pass und Geld für das Essen",
      "ein Foto und sein eigenes Mittagessen",
      "seinen Pass und eine Mappe mit Zeugnissen",
    ], 3,
    "Im Text: \"Bringen Sie bitte Ihren Pass und ein Foto mit.\" Das Essen bezahlt die Firma; von Zeugnissen steht nichts im Text."),

  // Vier Jobanzeigen
  jobs.ad("detail", "EASY",
    "Sie suchen Arbeit und haben nur am Wochenende Zeit. Welche Anzeige passt?",
    0,
    "Nur das Café sucht jemanden für Samstag und Sonntag. Die Bäckerei braucht auch Dienstag bis Freitag, Hotel und Supermarkt suchen von Montag bis Freitag."),
  jobs.ad("detail", "MID",
    "Sie möchten schon um sechs Uhr morgens anfangen. Welche Anzeige passt?",
    3,
    "Nur die Bäckerei beginnt um 6 Uhr (Dienstag bis Samstag, 6 bis 12 Uhr). Das Hotel beginnt um 7 Uhr, das Café um 10 Uhr, der Supermarkt um 18 Uhr."),
  jobs.ad("inference", "HARD",
    "Sie haben kein Telefon und keinen Computer. Welche Anzeige passt?",
    2,
    "Beim Café und bei der Bäckerei muss man anrufen, beim Hotel eine E-Mail schreiben. Beim Supermarkt kann man einfach vorbeikommen."),

  // Schild an der Arztpraxis
  praxis.tfng("detail", "EASY",
    [
      ["Im Urlaub von Dr. Yilmaz hilft ein anderer Arzt den Patienten.", "R"],
      ["Die Praxis hat am Mittwochnachmittag geöffnet.", "F"],
    ],
    "Vom 12. bis 23. August hilft Dr. Jonas Peters. Mittwoch und Freitag sind nur von 8 bis 12 Uhr Sprechzeiten, am Nachmittag ist die Praxis geschlossen."),
  praxis.choice("inference", "HARD",
    "Sie arbeiten bis 14 Uhr und möchten am Nachmittag zu Dr. Yilmaz. Wann können Sie in die Praxis gehen?",
    "am Donnerstag um 16 Uhr",
    ["am Mittwoch um 15 Uhr", "am Freitag um 16 Uhr", "am Dienstag um 13 Uhr"], 0,
    "Am Nachmittag (15 bis 18 Uhr) ist die Praxis nur am Montag, Dienstag und Donnerstag offen. Mittwoch und Freitag ist am Nachmittag geschlossen; um 13 Uhr ist Mittagspause (12 bis 15 Uhr)."),
  praxis.choice("detail", "MID",
    "Was sollen Patienten tun, bevor sie in die Praxis kommen?",
    "in der Praxis anrufen und einen Termin machen",
    [
      "zuerst eine E-Mail an Dr. Yilmaz schreiben",
      "vor acht Uhr morgens in die Praxis kommen",
      "ein Formular bei Dr. Peters abholen",
    ], 2,
    "Im Text: \"Bitte rufen Sie vor Ihrem Besuch an und machen Sie einen Termin.\" Von einer E-Mail oder einem Formular steht nichts im Text; Dr. Peters hilft nur im Urlaub der Praxis."),

  // SMS von Sami
  sms.choice("gist", "MID",
    "Was möchte Sami von Jana?",
    "Sie soll ihn mit dem Auto am Bahnhof abholen.",
    [
      "Sie soll ihm ein Taxi zum Bahnhof bestellen.",
      "Sie soll ihm später seinen schweren Koffer bringen.",
      "Sie soll ihn anrufen und die Zugzeit sagen.",
    ], 1,
    "Sami fragt: \"Kannst du mich bitte mit dem Auto abholen?\" Das Taxi nimmt er nur, wenn Jana nicht kann; er bittet um eine kurze Nachricht, nicht um einen Anruf."),
  sms.choice("detail", "MID",
    "Wann kommt Sami am Bahnhof an?",
    "um 7:15 Uhr",
    ["um 7:00 Uhr", "um 7:45 Uhr", "um 7:30 Uhr"], 2,
    "\"Viertel nach sieben\" ist 7:15 Uhr. 7:00 Uhr war die alte Zeit (\"nicht um sieben\"); 7:45 Uhr wäre \"Viertel vor acht\"."),
  sms.tfng("inference", "HARD",
    [
      ["Samis Koffer ist leicht.", "F"],
      ["Samis Zug kommt zu spät.", "R"],
      ["Für Sami ist ein Taxi ein großes Problem.", "F"],
    ],
    "Sein Koffer ist \"sehr schwer\". Der Zug hat Verspätung. Zum Taxi schreibt er: \"das ist kein Problem\"."),

  // Kleinanzeigen aus der Stadt
  kleinanzeigen.match("detail", "MID",
    "Welche Anzeige passt? Wenn keine Anzeige passt, wählen Sie \"Keine Anzeige passt\".",
    [
      "Sie möchten einen Computerkurs machen.",
      "Sie möchten ein gebrauchtes Fahrrad kaufen.",
      "Sie suchen ein Zimmer in einer Wohngemeinschaft.",
      "Sie möchten Deutsch üben und nichts bezahlen.",
      "Sie möchten tanzen lernen.",
    ],
    ["Anzeige A", "Anzeige B", "Anzeige C", "Anzeige D", "Anzeige E", "Keine Anzeige passt"],
    [6, 1, 3, 4, 2],
    "Fahrrad: A. Tanzkurs: B. Zimmer in der WG: C. Sprachcafé (kostenlos): D. Ein Computerkurs wird nirgends angeboten, auch wenn B und E ebenfalls Kurse sind. Anzeige E (Schwimmkurs) bleibt übrig."),
  kleinanzeigen.choice("detail", "EASY",
    "Wann kann man in das Zimmer einziehen?",
    "ab dem 1. November",
    ["ab dem 1. Oktober", "ab dem 14. November", "ab dem 1. Dezember"], 3,
    "Anzeige C: \"ab 1. November\". Die anderen Daten stehen nicht in der Anzeige."),
  kleinanzeigen.tfng("detail", "MID",
    [
      ["Der Tanzkurs findet abends statt.", "R"],
      ["Das Fahrrad ist ganz neu.", "F"],
      ["Der Schwimmkurs ist für Erwachsene.", "F"],
      ["Das Sprachcafé kostet kein Geld.", "R"],
    ],
    "Der Tanzkurs ist um 19 Uhr. Das Fahrrad ist drei Jahre alt. Der Schwimmkurs ist für Kinder. Das Sprachcafé ist kostenlos."),

  // Schilder im Schwimmbad
  schilder.choice("detail", "EASY",
    "Was bedeutet Schild 1?",
    "Man soll hier langsam gehen.",
    ["Man soll hier nicht schwimmen.", "Man soll hier Schuhe tragen.", "Man soll hier nichts essen."], 0,
    "\"Bitte nicht rennen\" heißt: langsam gehen, weil der Boden nass ist. Von Schwimmen, Schuhen oder Essen steht nichts auf dem Schild."),
  schilder.choice("detail", "MID",
    "Was gilt bei den Schließfächern?",
    "Man zahlt einen Euro und bekommt ihn zurück.",
    [
      "Man zahlt einen Euro für jede Stunde im Bad.",
      "Man zahlt zwei Euro und bekommt einen zurück.",
      "Man zahlt einen Euro und gibt das Fach morgen zurück.",
    ], 3,
    "Schild 2: ein Euro, und man bekommt ihn wieder, wenn man das Fach aufmacht. Der Preis gilt nicht pro Stunde und nicht pro Tag."),
  schilder.tfng("detail", "MID",
    [
      ["Um 16 Uhr können Erwachsene im großen Becken schwimmen.", "F"],
      ["Das Kinderschwimmen dauert zwei Stunden.", "R"],
    ],
    "Von 15 bis 17 Uhr ist das große Becken geschlossen; das Kinderschwimmen dauert zwei Stunden."),

  // Angebote im Supermarkt
  angebote.choice("detail", "EASY",
    "Sie möchten billige Äpfel kaufen. Wann gehen Sie in den Supermarkt?",
    "am Dienstag um 10 Uhr",
    ["am Freitag um 10 Uhr", "am Donnerstag um 10 Uhr", "am Samstag um 10 Uhr"], 1,
    "Äpfel sind nur von Montag bis Mittwoch im Angebot. Donnerstag und Freitag gilt das Angebot für Mineralwasser."),
  angebote.choice("detail", "MID",
    "Wann ist das Brot billiger?",
    "von Montag bis Samstag zwischen 17 und 18 Uhr",
    [
      "von Montag bis Samstag zwischen 8 und 9 Uhr",
      "nur am Samstag zwischen 17 und 18 Uhr",
      "von Montag bis Freitag zwischen 18 und 20 Uhr",
    ], 2,
    "Brot kostet Montag bis Samstag von 17 bis 18 Uhr den halben Preis. Die anderen Optionen ändern Zeit oder Tage."),
  angebote.tfng("detail", "MID",
    [
      ["Mineralwasser ist die ganze Woche billig.", "F"],
      ["Der Supermarkt hat auch am Sonntag geöffnet.", "F"],
      ["Zwei Liter Milch kosten weniger als zwei Euro.", "R"],
    ],
    "Das Wasser ist nur Donnerstag und Freitag im Angebot. Geöffnet ist Montag bis Samstag, also nicht am Sonntag. Milch kostet 1,50 Euro."),
];

// ---------------------------------------------------------------- LISTENING

type ListeningSkill = "gist" | "detail" | "inference" | "notes";
const LISTEN_TFNG_PROMPT = "Richtig oder falsch? Entscheiden Sie für jede Aussage.";

/*
 * Listening scripts are never changed in place: the audio is made from the
 * script. A reworked clip gets a new key ("-v3"), and its items point at it.
 */
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
      return {
        ...base(skill, within, LISTEN_TFNG_PROMPT, explanation),
        type: "TRUE_FALSE_NG",
        ...twoWaySet(statements),
      };
    },
    /** Note-taking: typed gaps, every accepted spelling listed per gap. */
    notes(within: Within, prompt: string, gaps: Array<{ id: string; answers: string[] }>, explanation: string): SeedItem {
      return {
        ...base("notes", within, prompt, explanation),
        type: "GAP_FILL",
        content: { kind: "GAP", gaps: gaps.map((g) => ({ id: g.id })) },
        key: { kind: "GAP", answers: Object.fromEntries(gaps.map((g) => [g.id, g.answers])) },
      };
    },
  };
}

// Announcement: one voice, played once in the Goethe format.
const lBahnhof = clip(
  "v2-l-a1-durchsage-gleis-v3",
  "Durchsage am Bahnhof",
  "Mobilität",
  [{ label: "Ansage", voice: "A" }],
  [
    "Ansage: Achtung, bitte! Eine Information für alle Reisenden nach Erfurt. Der Regionalzug nach Erfurt, planmäßige Abfahrt neun Uhr zwanzig, hat heute etwa fünfzehn Minuten Verspätung. Ich wiederhole: Abfahrt nicht um neun Uhr zwanzig, sondern erst um neun Uhr fünfunddreißig. Und noch etwas: Der Zug fährt nicht von Gleis vier, sondern von Gleis sieben. Die erste Klasse ist heute hinten, am Ende des Zuges. Vielen Dank für Ihr Verständnis.",
  ],
);

// Dialogue at work: two voices, played twice in the Goethe format.
const lKollege = clip(
  "v2-l-a1-neuer-kollege-v3",
  "Der erste Tag im Büro",
  "Arbeit",
  [
    { label: "Frau Schmidt", voice: "A" },
    { label: "Herr Haddad", voice: "B" },
  ],
  [
    "Frau Schmidt: Guten Morgen! Sind Sie der neue Kollege?",
    "Herr Haddad: Ja, guten Morgen. Haddad, Karim Haddad. Heute ist mein erster Tag.",
    "Frau Schmidt: Ach so, herzlich willkommen! Ich bin Anna Schmidt. Ihr Büro ist im ersten Stock. Nein, Moment, im zweiten Stock. Zimmer zweihundertvierzehn.",
    "Herr Haddad: Zweiter Stock, Zimmer zweihundertvierzehn. Gut. Gibt es hier auch Kaffee?",
    "Frau Schmidt: Ja, die Küche ist gleich hier unten, links. Der Kaffee kostet nichts.",
    "Herr Haddad: Na super! Und wann ist hier Mittagspause?",
    "Frau Schmidt: Meistens um halb eins. Aber heute essen wir schon um zwölf, mit dem ganzen Team. Kommen Sie mit?",
    "Herr Haddad: Ja, sehr gern!",
  ],
);

// Answerphone message: one voice, played twice in the Goethe format.
const lKurs = clip(
  "v2-l-a1-mailbox-sprachkurs-v3",
  "Nachricht von der Sprachschule",
  "Sprachkurs",
  [{ label: "Frau Novak", voice: "A" }],
  [
    "Frau Novak: Guten Tag, Herr Ramos, hier ist Lucia Novak von der Sprachschule am Marktplatz. Es geht um Ihren Deutschkurs. Der Kurs ist jeden Dienstag und Donnerstag, am Abend, von sechs bis acht Uhr. Ach ja, wir haben ein neues Zimmer: Der Kurs ist jetzt im dritten Stock, Zimmer dreihundertzwölf, nicht mehr im ersten Stock. Das Buch müssen Sie nicht kaufen, Sie bekommen es in der ersten Stunde von uns. Und bitte bezahlen Sie den Kurs bis Freitag. Noch einmal: bis Freitag. Haben Sie Fragen? Dann rufen Sie mich an. Auf Wiederhören!",
  ],
);

// Answerphone message with a change of day: the student takes notes.
const lZahnarzt = clip(
  "v3-l-a1-mailbox-zahnarzt",
  "Nachricht von der Zahnarztpraxis",
  "Gesundheit",
  [{ label: "Frau Keller", voice: "A" }],
  [
    "Frau Keller: Guten Tag, Frau Aydin, hier ist Frau Keller von der Zahnarztpraxis Dr. Behrens. Ihr Termin am Montag geht leider nicht, Dr. Behrens ist krank. Wir haben aber einen neuen Termin für Sie: am Mittwoch, nein, Entschuldigung, am Donnerstag um vierzehn Uhr dreißig. Also Donnerstag, vierzehn Uhr dreißig. Wenn das nicht passt, rufen Sie uns bitte an. Unsere Nummer ist: null drei null, zwei drei eins zwei fünf, vier null drei. Ich wiederhole: null drei null, zwei drei eins zwei fünf, vier null drei. Auf Wiederhören!",
  ],
);

// Radio tip: weather for the weekend.
const lWetter = clip(
  "v3-l-a1-radio-wetter",
  "Das Wetter am Wochenende",
  "Wetter und Freizeit",
  [{ label: "Moderator", voice: "B" }],
  [
    "Moderator: Und jetzt das Wetter für das Wochenende. Am Samstag scheint am Vormittag die Sonne, und es wird schön warm, bis zu zweiundzwanzig Grad. Am Nachmittag kommt aber Regen. Also, nehmen Sie einen Schirm mit! Am Sonntag ist es kühler, nur fünfzehn Grad, aber es regnet nicht mehr. Ein Tipp für Sonntag: Im Zoo ist Familientag. Kinder zahlen keinen Eintritt. Der Zoo öffnet schon um neun Uhr. Das war das Wetter. Jetzt wieder Musik.",
  ],
);

const bahnhof = forClip(lBahnhof.key);
const kollege = forClip(lKollege.key);
const kurs = forClip(lKurs.key);
const zahnarzt = forClip(lZahnarzt.key);
const wetter = forClip(lWetter.key);

const listeningItems: SeedItem[] = [
  // Durchsage am Bahnhof
  bahnhof.choice("gist", "EASY",
    "Worüber informiert die Durchsage?",
    "Der Zug fährt später ab und von einem anderen Gleis.",
    [
      "Der Zug fährt früher ab und von einem anderen Gleis.",
      "Der Zug fährt später ab, aber von Gleis vier wie immer.",
      "Der Zug fällt aus und ein Bus fährt nach Erfurt.",
    ], 2,
    "Der Zug hat Verspätung und fährt von Gleis sieben statt von Gleis vier. Früher fährt er nicht; er fällt auch nicht aus."),
  bahnhof.choice("detail", "MID",
    "Wann fährt der Zug heute ab?",
    "um 9:35 Uhr",
    ["um 9:20 Uhr", "um 9:15 Uhr", "um 9:50 Uhr"], 0,
    "9:20 Uhr ist die normale Abfahrt; mit fünfzehn Minuten Verspätung fährt der Zug um 9:35 Uhr, die Ansage wiederholt das ausdrücklich."),
  bahnhof.tfng("detail", "HARD",
    [
      ["Der Zug fährt heute von Gleis sieben ab.", "R"],
      ["Die erste Klasse ist heute vorne.", "F"],
    ],
    "Die Ansage sagt: nicht Gleis vier, sondern Gleis sieben. Die erste Klasse ist heute hinten, am Ende des Zuges, nicht vorne."),

  // Der erste Tag im Büro
  kollege.choice("detail", "EASY",
    "Wo ist das Büro von Herrn Haddad?",
    "im zweiten Stock",
    ["im Erdgeschoss", "im ersten Stock", "im dritten Stock"], 1,
    "Frau Schmidt korrigiert sich: erst \"im ersten Stock\", dann \"im zweiten Stock\". Die Küche ist unten."),
  kollege.choice("detail", "MID",
    "Wann essen Frau Schmidt und Herr Haddad heute zu Mittag?",
    "um 12 Uhr",
    ["um 12:30 Uhr", "um 13 Uhr", "um 11:30 Uhr"], 3,
    "Meistens ist die Pause um halb eins (12:30 Uhr), aber heute essen sie schon um zwölf."),
  kollege.tfng("gist", "EASY",
    [
      ["Herr Haddad arbeitet schon lange in dieser Firma.", "F"],
      ["Für den Kaffee in der Küche muss Herr Haddad nichts bezahlen.", "R"],
    ],
    "Herr Haddad sagt, heute sei sein erster Tag. Frau Schmidt sagt: \"Der Kaffee kostet nichts.\""),

  // Nachricht von der Sprachschule
  kurs.choice("detail", "EASY",
    "An welchen Tagen ist der Kurs?",
    "am Dienstag und Donnerstag",
    ["am Montag und Donnerstag", "am Dienstag und Freitag", "am Mittwoch und Freitag"], 1,
    "Der Kurs ist jeden Dienstag und Donnerstag. Freitag ist nur der Termin für die Bezahlung."),
  kurs.choice("detail", "MID",
    "Wo ist der Kurs jetzt?",
    "im dritten Stock",
    ["im ersten Stock", "im zweiten Stock", "im Erdgeschoss"], 3,
    "Der Kurs ist jetzt im dritten Stock, nicht mehr im ersten Stock."),
  kurs.tfng("detail", "MID",
    [
      ["Herr Ramos muss das Kursbuch selbst kaufen.", "F"],
      ["Herr Ramos soll den Kurs spätestens am Freitag bezahlen.", "R"],
      ["Der Kurs findet am Vormittag statt.", "F"],
    ],
    "Er muss das Buch nicht kaufen, er bekommt es in der ersten Stunde. Bezahlen soll er bis Freitag. Der Kurs ist am Abend, von sechs bis acht Uhr."),

  // Nachricht von der Zahnarztpraxis (Notizen)
  zahnarzt.notes("MID",
    "Hören Sie die Nachricht. Ergänzen Sie die Notizen.\n\nNeuer Termin bei Dr. Behrens\nTag: {{g1}}\nUhrzeit: {{g2}}\nTelefonnummer der Praxis: {{g3}}",
    [
      { id: "g1", answers: ["Donnerstag", "am Donnerstag", "Do", "Do.", "am Do", "am Do."] },
      {
        id: "g2",
        answers: [
          "14:30", "14.30", "14:30 Uhr", "14.30 Uhr", "14 Uhr 30", "14:30h", "14.30h", "14h30", "vierzehn Uhr dreißig", "vierzehn Uhr dreissig", "vierzehn dreißig", "halb drei", "halb 3", "2:30", "2.30", "2:30 Uhr", "2.30 Uhr",
          "um 14:30", "um 14.30", "um 14:30 Uhr", "um 14.30 Uhr", "um 14 Uhr 30", "um vierzehn Uhr dreißig", "um halb drei", "um halb 3",
        ],
      },
      { id: "g3", answers: ["030 23125 403"] },
    ],
    "Frau Keller nennt erst Mittwoch und korrigiert sich zu Donnerstag (\"am Donnerstag\" ist auch richtig). Die Uhrzeit ist 14:30 Uhr (auch \"vierzehn Uhr dreißig\", \"halb drei\", mit \"um\" davor). Die Nummer wird zweimal genannt: 030 23125 403. Bei der Nummer zählen nur die Ziffern; Leerzeichen, Bindestriche und Schrägstriche sind egal."),
  zahnarzt.choice("gist", "EASY",
    "Warum ruft die Praxis an?",
    "Der alte Termin geht nicht, es gibt einen neuen.",
    [
      "Frau Aydin soll ihren Termin am Montag absagen.",
      "Frau Aydin hat ihren Termin am Montag vergessen.",
      "Der Doktor möchte Frau Aydin am Montag früher sehen.",
    ], 0,
    "Der Doktor ist krank, deshalb fällt der Termin am Montag aus, und die Praxis bietet einen neuen an."),
  zahnarzt.tfng("detail", "MID",
    [
      ["Frau Aydin soll am Mittwoch in die Praxis kommen.", "F"],
      ["Frau Aydin soll anrufen, wenn der Termin nicht passt.", "R"],
    ],
    "Mittwoch war ein Versprecher; der Termin ist am Donnerstag. Anrufen soll sie, wenn der Termin nicht passt."),

  // Das Wetter am Wochenende
  wetter.choice("detail", "EASY",
    "Wann regnet es am Wochenende?",
    "am Samstagnachmittag",
    ["am Samstagvormittag", "am Sonntagvormittag", "den ganzen Sonntag"], 1,
    "Am Samstag scheint am Vormittag die Sonne; am Nachmittag kommt der Regen. Am Sonntag regnet es nicht mehr."),
  wetter.choice("detail", "MID",
    "Wie warm wird es am Sonntag?",
    "15 Grad",
    ["22 Grad", "12 Grad", "25 Grad"], 0,
    "Am Samstag sind es bis zu 22 Grad, am Sonntag nur 15 Grad."),
  wetter.tfng("detail", "MID",
    [
      ["Im Zoo zahlen Kinder am Sonntag keinen Eintritt.", "R"],
      ["Der Zoo öffnet am Sonntag um zehn Uhr.", "F"],
    ],
    "Familientag: Kinder zahlen nichts. Der Zoo öffnet schon um neun Uhr."),
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
    "Ihr Freund Tim hat Ihnen diese Nachricht geschickt:\n\n" +
      "\"Hallo! Am Samstag mache ich eine Grillparty im Park. Hast du Zeit? Wann kannst du kommen? Kannst du einen Salat mitbringen? Liebe Grüße, Tim\"\n\n" +
      "Schreiben Sie Tim eine Antwort (circa 30 Wörter). Beantworten Sie alle drei Fragen. Schreiben Sie auch eine Anrede und einen Gruß.",
    [
      "Antwort auf die erste Frage: hat Zeit oder nicht",
      "Antwort auf die zweite Frage: Uhrzeit, zu der man kommen kann (bei einer Absage ein einfacher Grund)",
      "Antwort auf die dritte Frage: bringt einen Salat mit oder nicht",
      "Anrede und Gruß (Hallo Tim ... / Viele Grüße)",
    ],
    [
      "sagen, ob Sie Zeit haben",
      "sagen, wann Sie kommen können",
      "sagen, ob Sie einen Salat mitbringen",
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
      "- Fragen Sie: Wie viel Geld bekommt man pro Stunde?\n\n" +
      "Schreiben Sie auch eine Anrede und einen Gruß.",
    [
      "kurze Vorstellung (Name, jetzige Arbeit oder Situation); Alter, Herkunft o. Ä. werden nicht erwartet",
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
      "Alter, Herkunft o. Ä. werden nicht erwartet",
    ],
    [
      "Name",
      "Wohnort",
      "Sprachen",
      "Beruf, Arbeit oder Schule",
      "Hobbys",
    ]),
  speakingTask("topiccard", "MID", LONGER,
    "Auf Ihrer Karte stehen sieben Wörter:\n\n" +
      "Freunde - Wohnung - Essen - Hobby - Reisen - Sprachen - Wochenende\n\n" +
      "Wählen Sie vier Wörter. Sagen Sie zu jedem Wort ein oder zwei Sätze über sich.",
    [
      "vier Wörter von der Karte gewählt",
      "zu jedem Wort mindestens ein verständlicher Satz über sich",
      "einfache Sätze mit Verb an Position 2 (Ich wohne ... / Am Wochenende spiele ich ...)",
    ],
    [
      "vier Wörter von der Karte wählen",
      "zu jedem Wort ein oder zwei Sätze sagen",
    ]),
  speakingTask("question", "EASY", SHORT,
    "Thema: Arbeit. Auf Ihrer Karte steht: \"Mittagspause?\"\n\n" +
      "Stellen Sie einer Kollegin eine Frage mit diesem Wort. Dann antworten Sie selbst auf Ihre Frage.",
    [
      "eine verständliche Frage zum Wort \"Mittagspause\" (z. B. Wann machst du / machen Sie Mittagspause?)",
      "korrekte Frageform (W-Frage oder Verb an Position 1)",
      "eine passende kurze Antwort",
    ],
    [
      "eine Frage mit dem Wort auf der Karte stellen",
      "selbst auf die Frage antworten",
    ],
    "du oder Sie (unter Kollegen ist beides richtig)"),
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
    "Sie sind im Büro. Sie möchten etwas schreiben, aber Sie haben keinen Kugelschreiber. Ihr Kollege Herr Braun hat einen Kugelschreiber.\n\n" +
      "Bitten Sie Herrn Braun um den Kugelschreiber. Sagen Sie auch danke.",
    [
      "höfliche Bitte (z. B. Können Sie mir bitte ... geben? / Haben Sie bitte ...?)",
      "Gegenstand genannt (Kugelschreiber)",
      "Dank",
    ],
    [
      "höflich um den Kugelschreiber bitten",
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
    "Erzählen Sie von Ihrer Wohnung oder Ihrem Zimmer:\n\n" +
      "- Wie viele Zimmer gibt es? Was steht im Zimmer?\n" +
      "- Was gefällt Ihnen besonders gut?\n" +
      "- Was machen Sie dort gern?",
    [
      "Zimmer oder Räume der Wohnung genannt",
      "Möbel oder Gegenstände im Zimmer genannt",
      "etwas, das gefällt (mit einfachem Adjektiv)",
      "eine Tätigkeit, die man dort gern macht",
    ],
    [
      "welche Zimmer es gibt und was im Zimmer steht",
      "was Ihnen besonders gut gefällt",
      "was Sie dort gern machen",
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
  reading: { stimuli: [rArbeitstag, rJobs, rPraxis, rSms, rKleinanzeigen, rSchilder, rAngebote], items: readingItems },
  listening: { stimuli: [lBahnhof, lKollege, lKurs, lZahnarzt, lWetter], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
