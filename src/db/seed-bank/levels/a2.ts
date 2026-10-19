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
 * A2 starter bank, written against docs/EXAM-BANK-RESEARCH.md (A2 section and
 * the item-writing rules). All texts are original. Grammar also holds three
 * MC cloze texts and three word banks (spec 2026-10-18).
 *
 * Single-choice items have four options (Goethe practice uses three; the
 * fourth, d, is an extra wrong distractor). The key position is given
 * explicitly and spread over a, b and c in every section.
 */

const LEVEL = "A2" as const;

type Within = NonNullable<SeedItem["within"]>;
type Pos = 0 | 1 | 2 | 3;
type Option4 = [string, string, string, string];

const IDS = ["a", "b", "c", "d"] as const;

function choiceContent(options: Option4, correct: Pos) {
  return {
    content: { kind: "CHOICE" as const, options: options.map((text, i) => ({ id: IDS[i], text })) },
    key: { kind: "CHOICE" as const, correct: [IDS[correct]] },
  };
}

function tfngContent(statements: Array<[string, TfngValue]>) {
  const ids = statements.map((_, i) => `s${i + 1}`);
  return {
    content: { kind: "TFNG" as const, statements: statements.map(([text], i) => ({ id: ids[i], text })), twoWay: true },
    key: { kind: "TFNG" as const, answers: Object.fromEntries(statements.map(([, v], i) => [ids[i], v])) },
  };
}

// ================================================================ GRAMMAR

function gChoice(skill: string, within: Within, prompt: string, options: Option4, correct: Pos, explanation: string): SeedItem {
  return {
    section: "GRAMMAR",
    level: LEVEL,
    type: "SINGLE_CHOICE",
    skillTag: `grammar.${skill}`,
    within,
    prompt,
    ...choiceContent(options, correct),
    explanation,
  };
}

/** One gap. With `choices` it is a drop-down, without it the student types. */
function gGap(
  skill: string,
  within: Within,
  prompt: string,
  answers: string[],
  choices: string[] | undefined,
  explanation: string,
): SeedItem {
  return {
    section: "GRAMMAR",
    level: LEVEL,
    type: "GAP_FILL",
    skillTag: `grammar.${skill}`,
    within,
    prompt,
    content: { kind: "GAP", gaps: [choices ? { id: "g1", choices } : { id: "g1" }] },
    key: { kind: "GAP", answers: { g1: answers } },
    explanation,
  };
}

const grammarItems: SeedItem[] = [
  // ---------------------------------------------------------------- EASY
  gChoice("perfekt", "EASY",
    "Am Samstag ___ wir mit dem Fahrrad an den See gefahren.",
    ["haben", "sind", "seid", "sein"], 1,
    "\"fahren\" ist ein Verb der Bewegung, das Perfekt bildet es mit \"sein\". Zu \"wir\" gehört \"sind\"; \"seid\" ist die ihr-Form."),
  gChoice("praeteritum", "EASY",
    "Gestern ___ ich keine Zeit, ich musste lange arbeiten.",
    ["habe", "hat", "hatte", "hattet"], 2,
    "\"Gestern\" verlangt Vergangenheit; bei \"haben\" nimmt man meist das Präteritum: ich hatte. \"habe\" ist Präsens, \"hat\" passt nicht zu \"ich\"."),
  gChoice("dativ", "EASY",
    "Kannst du ___ bitte den Zucker geben?",
    ["mir", "mich", "meiner", "ich"], 0,
    "\"geben\": Person im Dativ, Sache im Akkusativ (den Zucker). Dativ von \"ich\" ist \"mir\"; \"mich\" ist Akkusativ."),
  gChoice("wechselpraeposition", "EASY",
    "Der Schlüssel liegt ___ Tisch.",
    ["auf den", "auf das", "auf dem", "auf der"], 2,
    "\"liegen\" beschreibt eine Position (wo?), also Dativ: auf dem Tisch. \"auf den\" wäre Akkusativ (wohin?)."),
  gChoice("nebensatz", "EASY",
    "Meine Kollegin sagt, dass ___.",
    ["sie morgen später kommt", "sie kommt morgen später", "kommt sie morgen später", "sie morgen kommt später"], 0,
    "Im dass-Satz steht das konjugierte Verb am Ende. Die anderen Optionen haben das Verb an zweiter bzw. erster Stelle."),
  gChoice("konnektor", "EASY",
    "Mein Auto ist kaputt, deshalb ___ mit dem Bus.",
    ["fahre ich heute", "ich fahre heute", "ich heute fahre", "heute ich fahre"], 0,
    "Nach \"deshalb\" (Position 1) folgt das Verb, dann das Subjekt: deshalb fahre ich heute. \"deshalb\" leitet keinen Nebensatz ein, das Verb steht also nicht am Ende."),
  gChoice("komparativ", "EASY",
    "Im Sommer fahre ich ___ mit dem Fahrrad als mit dem Bus.",
    ["gerner", "am liebsten", "lieber", "gern"], 2,
    "Komparativ von \"gern\" ist unregelmäßig: gern, lieber, am liebsten. Mit \"als\" steht der Komparativ. \"gerner\" gibt es nicht."),
  gChoice("konjunktiv2", "EASY",
    "Kellner: Was möchten Sie trinken? Gast: Ich ___ gern ein Wasser.",
    ["hatte", "habe", "hätte", "wäre"], 2,
    "Höfliche Bestellung mit Konjunktiv II: Ich hätte gern ... \"hatte\" ist Präteritum, \"habe gern\" bedeutet etwas anderes (etwas mögen)."),

  // ---------------------------------------------------------------- MID
  gGap("perfekt", "MID",
    "Hast du die E-Mail von Frau Weber schon {{g1}}? (beantworten)",
    ["beantwortet"], undefined,
    "Verben mit untrennbarer Vorsilbe (be-, ver-, er- ...) bilden das Partizip II ohne ge-: beantwortet. Typische Fehler: gebeantwortet, beantwortest."),
  gChoice("praeteritum", "MID",
    "Letzte Woche ___ Samir nicht zum Kurs kommen, er war krank.",
    ["kann", "konnte", "könnte", "können"], 1,
    "Vergangenheit von Modalverben: Präteritum ohne Umlaut, er konnte. \"könnte\" ist Konjunktiv II, \"kann\" ist Präsens."),
  gGap("wechselpraeposition", "MID",
    "Stell die Flaschen bitte in {{g1}} Kühlschrank.",
    ["den"], ["dem", "der", "den"],
    "\"stellen\" zeigt eine Richtung (wohin?), also Akkusativ; \"Kühlschrank\" ist maskulin: in den Kühlschrank."),
  gChoice("nebensatz", "MID",
    "Die Kundin hat gefragt, ___ das Paket schon angekommen ist.",
    ["dass", "wenn", "ob", "was"], 2,
    "Indirekte Ja/Nein-Frage: \"ob\". Nach \"fragen\" steht kein \"dass\"; \"wenn\" ist eine Bedingung oder Zeitangabe, keine Frage."),
  gGap("konnektor", "MID",
    "Ich kann heute nicht kommen, {{g1}} ich arbeiten muss.",
    ["weil"], ["denn", "weil", "deshalb"],
    "Das Verb \"muss\" steht am Ende, also ein Nebensatz: \"weil\". Nach \"denn\" stünde \"denn ich muss arbeiten\", nach \"deshalb\" Verb an Position 2."),
  gGap("komparativ", "MID",
    "Mein Deutsch ist jetzt viel {{g1}} als vor einem Jahr. (gut)",
    ["besser"], undefined,
    "Unregelmäßiger Komparativ: gut, besser, am besten. Mit \"als\" steht der Komparativ."),
  gGap("verb-praeposition", "MID",
    "Wir warten schon zwanzig Minuten {{g1}} den Bus.",
    ["auf"], ["für", "an", "auf"],
    "Feste Verbindung: warten auf + Akkusativ. \"warten für\" ist ein typischer Fehler (Einfluss aus anderen Sprachen)."),
  gGap("adjektivendung", "MID",
    "Ich suche eine {{g1}} Wohnung mit Balkon.",
    ["kleine"], ["kleinen", "kleine", "kleiner"],
    "Unbestimmter Artikel, feminin, Akkusativ: eine kleine Wohnung (Endung -e wie im Nominativ)."),

  // ---------------------------------------------------------------- HARD
  gGap("praeteritum", "HARD",
    "Wo {{g1}} ihr letztes Wochenende? Ich habe euch oft angerufen. (sein)",
    ["wart"], undefined,
    "Präteritum von \"sein\", 2. Person Plural: ihr wart. \"seid\" ist Präsens und passt nicht zu \"letztes Wochenende\". \"ward\" ist ein häufiger Schreibfehler (eine veraltete Form von \"werden\", nicht von \"sein\")."),
  gGap("dativ", "HARD",
    "Ich schenke {{g1}} Vater ein Buch.",
    ["meinem"], ["meinen", "meinem", "meiner"],
    "\"schenken\": Person im Dativ, Sache im Akkusativ. \"Vater\" ist maskulin, Dativ: meinem. \"meinen\" ist Akkusativ."),
  gChoice("wechselpraeposition", "HARD",
    "Ich ___ die Jacke auf das Bett.",
    ["liege", "lege", "lag", "legt"], 1,
    "\"auf das Bett\" (Akkusativ) zeigt eine Richtung, also das Handlungsverb \"legen\". \"liegen\" (liege, lag) steht mit Dativ (wo?)."),
  gChoice("nebensatz", "MID",
    "Ich rufe dich an, wenn ___.",
    ["ich bin zu Hause", "ich zu Hause bin", "bin ich zu Hause", "zu Hause ich bin"], 1,
    "Im wenn-Satz steht das konjugierte Verb am Ende: wenn ich zu Hause bin."),
  gChoice("nebensatz", "HARD",
    "Wenn es morgen regnet, ___.",
    ["wir bleiben zu Hause", "bleiben wir zu Hause", "wir zu Hause bleiben", "zu Hause wir bleiben"], 1,
    "Steht der wenn-Satz am Anfang, ist er Position 1. Im Hauptsatz folgt sofort das Verb, dann das Subjekt: ..., bleiben wir zu Hause (Verb, Komma, Verb). Das Verb am Ende gehört nur in den Nebensatz."),
  gChoice("reflexiv", "HARD",
    "Vor dem Essen wasche ich ___ die Hände.",
    ["mir", "mich", "sich", "mein"], 0,
    "Gibt es schon ein Akkusativobjekt (die Hände), steht das Reflexivpronomen im Dativ: ich wasche mir die Hände. \"sich\" ist die 3. Person."),
  gChoice("adjektivendung", "HARD",
    "Ich habe einen ___ Laptop gekauft.",
    ["neuen", "neuer", "neues", "neue"], 0,
    "Unbestimmter Artikel, maskulin, Akkusativ (einen): Adjektivendung -en, einen neuen Laptop."),
  gGap("konjunktiv2", "HARD",
    "{{g1}} Sie mir bitte helfen? Die Tasche ist so schwer. (können, Konjunktiv II)",
    ["Könnten"], undefined,
    "Höfliche Bitte mit Konjunktiv II von \"können\": Könnten Sie ...? \"Konnten\" (Präteritum, ohne Umlaut) ist ein typischer Fehler."),
];

const grammarCTest = cTest(LEVEL, "MID", {
  first: "Seit einem Monat arbeite ich in einer kleinen Bäckerei in meiner Stadt.",
  body:
    "Ich stehe jeden Morgen sehr früh auf, denn wir beginnen schon um fünf Uhr. " +
    "Zuerst backen wir das Brot, dann die Kuchen. Um sieben kommen die ersten Kunden. " +
    "Nachmittags bin ich oft müde, aber ich habe früh Feierabend.",
  last: "Die Arbeit macht mir viel Spaß, und meine Kolleginnen und Kollegen helfen mir immer.",
  // g10 "da...": danach is as correct as dann; g14 "Kun...": Kundinnen is as correct as Kunden.
  variants: { 10: ["nach"], 14: ["dinnen"] },
  // Wrong parts by the gap whose stem they target.
  distractors: {
    1: ["eht"], 2: ["gens"], 3: ["ühe"], 4: ["r"],
    5: ["nnt"], 6: ["nd"], 7: ["hren"], 8: ["ke"],
    9: ["em"], 11: ["hens"], 12: ["bte"], 14: ["de"],
    15: ["ist"], 16: ["der"], 18: ["st"],
  },
});

// Moving into a new flat with a friend.
const grammarCTest2 = cTest(LEVEL, "MID", {
  first: "Letzten Monat bin ich mit meiner Freundin Sofia in eine neue Wohnung gezogen.",
  body:
    "Die Wohnung hat drei Zimmer, eine kleine Küche und einen Balkon. " +
    "Beim Umzug hat uns mein Bruder geholfen, weil die Möbel sehr schwer waren. " +
    "Am Abend waren wir ziemlich müde, aber wir haben noch zusammen auf dem Balkon gegessen.",
  last: "Jetzt fühlen wir uns schon wie zu Hause, und bald wollen wir unsere Freunde zu einem kleinen Fest einladen.",
  // Wrong parts by the gap whose stem they target.
  distractors: {
    1: ["nungen"], 2: ["itte"], 3: ["nem"], 4: ["chen"],
    5: ["ner"], 6: ["vor"], 7: ["aben"], 8: ["ine"],
    9: ["lft"], 12: ["r"], 13: ["ende"], 15: ["den"],
    16: ["er"], 18: ["us"], 19: ["kone"],
  },
});

// A day trip by train that went wrong.
const grammarCTest3 = cTest(LEVEL, "MID", {
  first: "Am Sonntag wollten Hao und seine Schwester Mei mit dem Zug ans Meer fahren, denn das Wetter sollte schön werden.",
  body:
    "Sie sind früh aufgestanden und pünktlich zum Bahnhof gegangen. Leider hatte ihr Zug eine Stunde Verspätung. " +
    "Unterwegs musste er zweimal lange halten, und die Fahrt hat vier Stunden gedauert. " +
    "Als sie endlich am Meer waren, hat es plötzlich angefangen zu regnen.",
  last: "Trotzdem haben sie in einem kleinen Café Kuchen gegessen und viel gelacht.",
  // g4 "Bah...": "zum Bahnsteig gegangen" is as correct as "zum Bahnhof gegangen".
  // g18 "h...": "Als sie endlich am Meer waren, hatte es ... angefangen" (als + Plusquamperfekt) is idiomatic too.
  variants: { 4: ["nsteig"], 18: ["atte"] },
  // Wrong parts by the gap whose stem they target.
  distractors: {
    1: ["ch"], 2: ["tehen"], 3: ["tliche"], 4: ["nhöfe"],
    6: ["hm"], 7: ["ner"], 8: ["ätungen"], 9: ["sten"],
    10: ["ite"], 11: ["te"], 12: ["as"], 13: ["aben"],
    15: ["ber"], 18: ["atten"], 20: ["um"],
  },
});

// MC cloze texts and word banks (spec 2026-10-18), each set easy to hard.
const grammarTexts: SeedItem[] = [
  cloze(LEVEL, "EASY", {
    title: "Ein Wochenende in Berlin",
    first: "Letztes Wochenende war ich mit meinem Bruder in Berlin.",
    body:
      "Wir [[sind|haben|hatten|seid]] [[am|um|im|an]] Freitagabend mit dem Zug gefahren. " +
      "Das Hotel lag nicht weit [[von|zu|bei|aus]] dem Bahnhof. " +
      "Am Samstag haben wir den Fernsehturm [[besucht|besuchen|besuche|besuchte]]. " +
      "Danach sind wir in [[ein|einem|einen|eine]] Museum gegangen. Das Museum war sehr [[interessant|interessiert|interessante|interessieren]]. " +
      "Am Abend haben wir in einem kleinen Restaurant gegessen. " +
      "Das Essen war gut und sogar [[billiger|billig|am billigsten|so billig]] als in München. " +
      "Wir [[wollten|wollen|wollte|gewollt]] danach noch ins Theater gehen, aber es gab keine Karten mehr. " +
      "Am Sonntag sind wir im Hotel geblieben, [[weil|denn|deshalb|obwohl]] es den ganzen Tag geregnet hat. " +
      "Ich habe [[meiner|meine|meinem|meinen]] Mutter eine Karte geschrieben. " +
      "Die Reise hat [[uns|wir|unser|unsere]] sehr gut gefallen.",
    last: "Im Sommer möchten wir noch einmal nach Berlin fahren.",
    note: "Hilfsverb sein im Perfekt (g1), Zeitangabe am + Wochentagsteil (g2), von nach weit (g3), Partizip II (g4), in + Akkusativ bei Richtung (g5), prädikatives Adjektiv (g6), Komparativ mit als (g7), Modalverb im Präteritum (g8), weil mit Verb am Ende (g9), Dativ der Person bei schreiben (g10), gefallen + Dativ (g11).",
  }),
  cloze(LEVEL, "MID", {
    title: "Die neue Stelle",
    first: "Seit zwei Wochen arbeitet Marco in einer großen Firma in Stuttgart.",
    body:
      "Früher [[musste|muss|müsste|musst]] er jeden Tag eine Stunde mit dem Bus fahren. Jetzt ist der Weg viel [[kürzer|kurz|kürzeste|kurzer]]. " +
      "Er freut [[sich|ihn|ihm|er]] jeden Morgen auf die Arbeit. " +
      "Am [[ersten|erste|erster|erstes]] Tag hat er [[den|dem|der|die]] Chef kennengelernt. " +
      "Der Chef hat gesagt, [[dass|das|wenn|ob]] Marco sehr gut ins Team passt. " +
      "Die Kollegen sind nett und helfen [[ihm|ihn|er|sein]] oft. Mittags essen alle zusammen [[in|im|auf|zu]] der Kantine. " +
      "Wenn Marco eine Frage hat, [[fragt|fragen|fragte|gefragt]] er seine Kollegin Anna, [[die|der|den|das]] schon [[seit|vor|für|ab]] zehn Jahren in der Firma arbeitet.",
    last: "Der Wechsel war für ihn die richtige Entscheidung.",
    note: "Modalverb im Präteritum (g1), Komparativ (g2), Reflexivpronomen (g3), Adjektivendung nach am (g4), Akkusativ bei kennenlernen (g5), dass-Satz (g6), helfen + Dativ (g7), in + Dativ (g8), Verb an erster Stelle nach dem Nebensatz (g9), Relativpronomen (g10), seit + Dativ (g11).",
  }),
  cloze(LEVEL, "HARD", {
    title: "Das Paket",
    first: "Letzte Woche hat Frau Berger im Internet eine neue Kaffeemaschine bestellt.",
    body:
      "Das Paket sollte [[am|um|im|an]] Dienstag kommen, aber sie hat den ganzen Tag umsonst [[gewartet|warten|wartete|erwartet]]. " +
      "Am Mittwoch war ein Zettel in [[ihrem|ihren|ihrer|ihr]] Briefkasten. " +
      "Auf dem Zettel stand, dass das Paket bei [[der|die|dem|den]] Nachbarin im dritten Stock ist. " +
      "Frau Berger wollte es sofort [[abholen|abgeholt|abholt|abholte]]. " +
      "Leider war die Nachbarin nicht da, [[deshalb|weil|denn|obwohl]] musste sie bis zum Abend warten. " +
      "Am Abend hat sie das Paket endlich bekommen. [[Als|Wenn|Wann|Ob]] sie es öffnete, war die Maschine kaputt. " +
      "Frau Berger hat [[sich|ihr|ihm|ihre]] sehr geärgert. " +
      "Sie hat beim Kundenservice angerufen und gefragt, [[ob|dass|wenn|weil]] sie die Maschine zurückschicken kann. " +
      "Der Mitarbeiter war sehr [[freundlich|freundlicher|Freundlichkeit|freundlichen]] und hat sofort eine neue Maschine geschickt. " +
      "Jetzt trinkt sie jeden Morgen einen [[heißen|heiße|heißer|heißes]] Kaffee.",
    last: "Beim nächsten Mal kauft sie aber lieber im Geschäft ein.",
    note: "Zeitangabe mit am (g1), Partizip II von warten (g2), Possessivartikel im Dativ (g3), bei + Dativ (g4), Modalverb mit Infinitiv (g5), deshalb mit Inversion (g6), als bei einem einmaligen Ereignis in der Vergangenheit (g7), Reflexivpronomen (g8), indirekte Ja/Nein-Frage mit ob (g9), prädikatives Adjektiv (g10), Adjektivendung im Akkusativ (g11).",
  }),
  wordBank(LEVEL, "EASY", {
    title: "Beim Arzt",
    first: "Vor zwei Wochen ist Jan mit starken Kopfschmerzen aufgewacht.",
    body:
      "Er hat sofort in der [[Praxis]] von Dr. Wolf angerufen. Die Frau am Telefon hat ihm einen [[Termin]] um zehn Uhr gegeben. " +
      "Im [[Wartezimmer]] waren schon viele Leute. Die Ärztin hat ihn genau [[untersucht]]. " +
      "Sie hat gesagt, dass er hohes [[Fieber]] hat. Er soll drei Tage im Bett [[bleiben]]. " +
      "Außerdem hat sie ihm ein [[Medikament]] verschrieben. Er muss es dreimal am Tag [[nehmen]].",
    last: "Nach einer Woche war Jan wieder gesund.",
    distractors: ["Krankenhaus", "Wartezeit", "untersuchen", "geblieben", "Husten"],
  }),
  wordBank(LEVEL, "MID", {
    title: "Der Umzug",
    first: "Im März ist Selin mit ihrer Familie in eine größere Wohnung umgezogen.",
    body:
      "Die alte Wohnung war zu [[eng]] für vier Personen. Die neue Wohnung liegt in einem ruhigen [[Stadtteil]] am Stadtrand. " +
      "Selin hat zwei Wochen lang viele [[Kartons]] gepackt. Am Samstag haben ihre Freunde beim Umzug [[geholfen]]. " +
      "Leider gibt es im Haus keinen Aufzug, [[deshalb]] mussten sie alles in den vierten Stock tragen. " +
      "Am Abend waren alle sehr [[müde]]. Selin hat für alle Pizza [[bestellt]]. Jetzt hat jedes Kind ein eigenes [[Zimmer]].",
    last: "Die ganze Familie fühlt sich in der neuen Wohnung sehr wohl.",
    distractors: ["Treppe", "weil", "gewaschen", "breit", "Küchen"],
  }),
  wordBank(LEVEL, "HARD", {
    title: "Eine Radtour",
    first: "Am letzten Wochenende haben Tom und Lisa eine Radtour an der Elbe gemacht.",
    body:
      "Vorher haben sie den [[Wetterbericht]] gelesen, [[denn]] sie wollten nicht nass werden. " +
      "Am Morgen war der Himmel noch [[bewölkt]], aber später hat die Sonne geschienen. " +
      "Insgesamt sind sie ungefähr fünfzig [[Kilometer]] gefahren. Unterwegs haben sie in einem kleinen Dorf eine [[Pause]] gemacht. " +
      "Dort haben sie Kaffee getrunken und frischen Kuchen gegessen. Am Nachmittag war plötzlich ein Reifen kaputt. " +
      "Zum Glück hatte Tom sein [[Werkzeug]] dabei, und er hat den Reifen schnell [[repariert]]. " +
      "Am Abend waren beide [[erschöpft]], aber sehr zufrieden.",
    last: "Im Sommer wollen sie eine längere Tour machen.",
    distractors: ["weil", "Fahrkarte", "geschwommen", "teuer", "Brille"],
  }),
];

// ================================================================ READING

type RSkill = "gist" | "detail" | "inference" | "vocabulary" | "structure";

function forText(stimulusKey: string) {
  const base = (skill: RSkill, within: Within, prompt: string, explanation: string) => ({
    section: "READING" as const,
    level: LEVEL,
    skillTag: `reading.${skill}`,
    within,
    stimulusKey,
    prompt,
    explanation,
  });
  return {
    choice(skill: RSkill, within: Within, prompt: string, options: Option4, correct: Pos, explanation: string): SeedItem {
      return { ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...choiceContent(options, correct) };
    },
    tfng(skill: RSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      return {
        ...base(skill, within, "Richtig oder falsch?", explanation),
        type: "TRUE_FALSE_NG",
        ...tfngContent(statements),
      };
    },
    match(
      skill: RSkill,
      within: Within,
      prompt: string,
      left: string[],
      right: string[],
      /** pairs[i] is the 1-based position in `right` that left row i belongs to. */
      pairs: number[],
      explanation: string,
    ): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "MATCHING",
        content: {
          kind: "MATCHING",
          left: left.map((text, i) => ({ id: `l${i + 1}`, text })),
          right: right.map((text, i) => ({ id: `r${i + 1}`, text })),
        },
        key: { kind: "MATCHING", pairs: Object.fromEntries(pairs.map((r, i) => [`l${i + 1}`, `r${r}`])) },
      };
    },
  };
}

const readingText = (key: string, title: string, topic: string, body: string): SeedStimulus => ({
  key,
  section: "READING",
  level: LEVEL,
  title,
  topic,
  body: body.trim(),
});

const R_EMAIL = "v2-r-a2-email-neue-stelle";
const R_BIB = "v2-r-a2-bibliothek-abends";
const R_KURS = "v2-r-a2-weiterbildung-programm";
const R_ANZ = "v2-r-a2-anzeigen";
const R_NEWS = "v3-r-a2-kurznachrichten";
const R_POOL = "v3-r-a2-hallenbad-hinweise";
const R_FERIEN = "v3-r-a2-ferienwohnung-bewertung";

const readingStimuli: SeedStimulus[] = [
  readingText(R_EMAIL, "Eine E-Mail von Lena", "Arbeit und Wohnen", `
Liebe Aylin,

wie geht es dir? Ich habe lange nichts geschrieben, aber bei mir war viel los. Seit dem ersten Oktober arbeite ich in einer neuen Firma. Ich bin jetzt im Büro von einem Möbelhaus und schreibe Rechnungen und E-Mails an Kunden. Die Arbeit gefällt mir gut, und meine Kolleginnen und Kollegen sind sehr freundlich.

Leider ist der Weg ziemlich lang. Ich fahre jeden Tag fast eine Stunde mit der S-Bahn. Deshalb suche ich jetzt eine Wohnung näher an der Firma. Am Wochenende habe ich zwei Wohnungen angesehen, aber beide waren zu teuer.

Hast du am Samstag, dem zwölften, Zeit? Ich möchte dich gern zum Essen einladen, denn ich habe meine neue Stelle noch nicht richtig gefeiert. Wir könnten um sieben Uhr in das neue Restaurant am Marktplatz gehen. Bitte schreib mir bis Donnerstag.

Liebe Grüße
Lena
`),
  readingText(R_BIB, "Neu in der Stadtbibliothek: Lernen nach der Arbeit", "Bibliothek und Lernen", `
Neu in der Stadtbibliothek: Lernen nach der Arbeit

Viele Menschen möchten etwas Neues lernen, haben aber tagsüber keine Zeit. Deshalb hat die Stadtbibliothek ab November auch abends geöffnet. Von Montag bis Donnerstag können Besucherinnen und Besucher bis 22 Uhr in der Bibliothek lernen. Am Freitag schließt sie wie bisher um 18 Uhr.

Im ersten Stock gibt es jetzt einen ruhigen Lernraum mit dreißig Plätzen und kostenlosem WLAN. Wer einen Computer braucht, kann dort einen Laptop für drei Stunden ausleihen. Dafür braucht man nur einen Bibliotheksausweis. Der Ausweis kostet für Erwachsene zehn Euro im Jahr. Für Schülerinnen, Schüler und Studierende ist er kostenlos.

Jeden Dienstag um 19 Uhr gibt es außerdem ein Sprachcafé. Dort sprechen Menschen aus vielen Ländern miteinander Deutsch. Eine Anmeldung ist nicht nötig. „Die Bibliothek soll ein Ort für alle sein“, sagt die Leiterin, Frau Brandt.
`),
  readingText(R_KURS, "Weiterbildung im Herbst", "Weiterbildung im Betrieb", `
Berger Logistik: Weiterbildung im Herbst

Kurs 1: Excel für Anfänger
Montag, 6. und 13. Oktober, 9 bis 12 Uhr, Raum 104
Tabellen und einfache Rechnungen am Computer. Bitte bringen Sie Ihren Laptop mit.

Kurs 2: Erste Hilfe im Betrieb
Mittwoch, 15. Oktober, 8 bis 16 Uhr, Kantine (Erdgeschoss)
Für alle neuen Mitarbeiterinnen und Mitarbeiter im Lager ist dieser Kurs Pflicht. Das Mittagessen ist inklusive.

Kurs 3: Deutsch am Telefon
Jeden Donnerstag im Oktober, 16 bis 17.30 Uhr, Raum 210
Für Mitarbeiterinnen und Mitarbeiter mit Deutsch als Fremdsprache. Nur acht Plätze.

Kurs 4: Gesund am Schreibtisch
Freitag, 24. Oktober, 13 bis 14 Uhr, online
Übungen für Rücken und Augen. Sie brauchen nur einen Computer mit Kamera.

Anmeldung bis zum 1. Oktober bei Frau Demir in der Personalabteilung, Telefon 233, oder per E-Mail.
`),
  readingText(R_ANZ, "Kleinanzeigen: Arbeit, Lernen, Wohnen", "Kleinanzeigen: Arbeit, Lernen, Wohnen", `
A
Café am Stadtpark sucht Aushilfe für Samstag und Sonntag, 10 bis 18 Uhr. Erfahrung nicht nötig, freundlich sein ist wichtig! Bewerbung bitte per E-Mail.

B
Wir suchen eine Fahrerin oder einen Fahrer für Lieferungen in der Stadt. Montag bis Freitag, 7 bis 15 Uhr. Führerschein nötig. Arbeitsbeginn: sofort.

C
Ich gebe Nachhilfe in Mathematik und Englisch für Schülerinnen und Schüler der Klassen 5 bis 10. Auch online möglich. 15 Euro pro Stunde.

D
Deutschkurs am Abend (Niveau A2): dienstags und donnerstags, 18.30 bis 20 Uhr. Kleine Gruppen, die erste Stunde ist kostenlos.

E
Schöne 2-Zimmer-Wohnung, 55 Quadratmeter, mit Balkon, nah am Bahnhof. Frei ab 1. Dezember. Keine Haustiere.

F
Arztpraxis sucht Mitarbeiterin oder Mitarbeiter für die Anmeldung, 20 Stunden pro Woche, nur vormittags. Gute Deutschkenntnisse und Computerkenntnisse nötig.
`),
  readingText(R_NEWS, "Kurznachrichten aus der Stadt", "Kurznachrichten aus der Stadt", `
Text 1
Eine Untersuchung zeigt: Wer jeden Tag mit dem Fahrrad zur Arbeit oder zur Schule fährt, ist seltener krank. Schon zwanzig Minuten pro Tag reichen aus, sagen die Ärzte. Besonders Rücken und Herz profitieren, wenn man regelmäßig fährt.

Text 2
Das Rad ist kaputt? In der Stadtteilwerkstatt in der Mühlenstraße helfen Freiwillige jeden Samstag von 10 bis 14 Uhr. Man bringt sein Fahrrad mit, und die Helferinnen und Helfer zeigen, wie man einen Reifen wechselt oder eine Bremse einstellt. Werkzeug ist vorhanden.

Text 3
Die Stadt Waldkirchen sucht Freiwillige für den Frühjahrsputz. Am ersten Samstag im April sollen Parks, Spielplätze und das Flussufer wieder sauber werden. Müllsäcke und Handschuhe gibt es vor Ort. Danach lädt die Stadt alle zu einer Suppe im Rathaus ein.

Text 4
Ab Montag fährt die Buslinie 14 nicht mehr zum Hauptbahnhof, sondern nur noch bis zum Marktplatz. Der Grund sind Bauarbeiten in der Bahnhofstraße. Fahrgäste steigen am Marktplatz in die Straßenbahn um. Die Arbeiten dauern voraussichtlich bis Ende Mai.

Text 5
Das Freibad am See hat seit gestern wieder geöffnet. Bei sonnigem Wetter ist es täglich von 9 bis 20 Uhr offen. Neu ist ein Kinderbecken mit einer Rutsche. Der Eintritt kostet vier Euro.
`),
  readingText(R_POOL, "Hinweise im Hallenbad", "Sport und Freizeit", `
Hallenbad Stadtgarten: Wichtige Hinweise

Öffnungszeiten: Montag bis Freitag 6.30 bis 21 Uhr, Samstag und Sonntag 9 bis 18 Uhr.

Bitte duschen Sie vor dem Schwimmen. Wer lange Haare hat, trägt im Wasser eine Badekappe.

Die Schließfächer funktionieren mit einer Ein-Euro-Münze. Sie bekommen die Münze zurück, wenn Sie den Schlüssel wieder abschließen.

Am Mittwoch von 12 bis 14 Uhr gehört das große Becken der Wassergymnastik für Gruppen. Einzelne Gäste können in dieser Zeit das kleine Becken benutzen.

Essen und Trinken ist nur im Café im Erdgeschoss erlaubt.
`),
  readingText(R_FERIEN, "Bewertung: Ferienwohnung Seeblick", "Reisen und Urlaub", `
Ferienwohnung Seeblick in Bad Wiesen: 4 von 5 Sternen

Wir waren im Mai eine Woche mit zwei Kindern in der Wohnung. Die Lage ist super: Der See ist nur fünf Minuten zu Fuß entfernt, und im Dorf gibt es einen Bäcker und einen kleinen Supermarkt. Die Wohnung war sauber, aber die Betten waren ziemlich hart, und das WLAN hat nur im Wohnzimmer funktioniert. Der Vermieter, Herr Keller, war sehr nett und hat uns Fahrräder geliehen. Wir kommen bestimmt wieder, aber dann im Juni, denn im Mai war das Wasser im See noch zu kalt.
`),
];

const rEmail = forText(R_EMAIL);
const rBib = forText(R_BIB);
const rKurs = forText(R_KURS);
const rAnz = forText(R_ANZ);
const rNews = forText(R_NEWS);
const rPool = forText(R_POOL);
const rFerien = forText(R_FERIEN);

const readingItems: SeedItem[] = [
  // ---------------------------------------------------------------- E-Mail
  rEmail.choice("gist", "EASY",
    "Warum schreibt Lena die E-Mail?",
    [
      "Sie bittet Aylin um Hilfe bei der Suche nach einer neuen Wohnung.",
      "Sie sagt Aylin, dass sie am Samstag leider keine Zeit zum Essen hat.",
      "Sie erzählt von ihrer neuen Arbeit im Möbelhaus und lädt Aylin zu einem Essen ein.",
      "Sie fragt Aylin, ob sie in der Firma ihres Möbelhauses arbeiten möchte.",
    ], 2,
    "Lena berichtet von der neuen Stelle und lädt Aylin zum Essen ein. Die Wohnungssuche wird nur erwähnt, um Hilfe bittet sie nicht; das Treffen sagt sie nicht ab, sie schlägt es vor; eine Stelle für Aylin ist kein Thema."),
  rEmail.choice("detail", "MID",
    "Was macht Lena in der neuen Firma?",
    [
      "Sie berät Kundinnen und Kunden im Möbelhaus und verkauft Möbel.",
      "Sie arbeitet im Büro eines Möbelhauses und schreibt Rechnungen.",
      "Sie fährt Möbel mit dem Lieferwagen zu den Kundinnen und Kunden nach Hause.",
      "Sie repariert kaputte Möbel in der Werkstatt des Möbelhauses.",
    ], 1,
    "Im Text: \"Ich bin jetzt im Büro von einem Möbelhaus und schreibe Rechnungen und E-Mails.\" Beratung und Verkauf, Lieferung und Reparatur kommen nicht vor."),
  rEmail.tfng("detail", "MID",
    [
      ["Lena hat schon eine bezahlbare Wohnung in der Nähe der Firma gefunden.", "F"],
      ["Der Weg zur Arbeit dauert für Lena fast eine Stunde.", "R"],
      ["Aylin soll Lena bis Donnerstag antworten.", "R"],
    ],
    "1 F: Beide angesehenen Wohnungen waren zu teuer, Lena sucht noch. 2 R: \"fast eine Stunde mit der S-Bahn\". 3 R: \"Bitte schreib mir bis Donnerstag.\""),

  // ---------------------------------------------------------------- Bibliothek
  rBib.choice("gist", "EASY",
    "Worum geht es in dem Text?",
    [
      "Die Bibliothek hat ab November längere Öffnungszeiten und neue Angebote.",
      "Die Bibliothek sucht ab November neue Mitarbeiterinnen und Mitarbeiter für den Abend.",
      "Die Bibliothek bleibt im November am Abend geschlossen und öffnet erst später wieder.",
      "Die Bibliothek ändert ab November die Preise für den Ausweis und für die Laptops.",
    ], 0,
    "Der Text informiert über die Öffnung am Abend, den Lernraum, die Laptops und das Sprachcafé. Mitarbeitersuche und Preisänderung stehen nicht im Text; der Ausweis wird nur erklärt."),
  rBib.tfng("detail", "MID",
    [
      ["Für das Ausleihen eines Laptops muss man einen Ausweis der Bibliothek haben.", "R"],
      ["Am Freitag ist die Bibliothek genauso lange geöffnet wie an den anderen Tagen.", "F"],
      ["Studierende zahlen für den Ausweis kein Geld.", "R"],
    ],
    "1 R: \"Dafür braucht man nur einen Bibliotheksausweis.\" 2 F: Am Freitag schließt die Bibliothek um 18 Uhr, an den anderen Tagen um 22 Uhr. 3 R: Für Studierende ist der Ausweis kostenlos."),
  rBib.choice("detail", "MID",
    "Was gibt es jeden Dienstagabend in der Bibliothek?",
    [
      "Einen Kurs, in dem man mit dem Laptop der Bibliothek das Arbeiten am Computer lernt.",
      "Eine Führung durch den neuen Lernraum im ersten Stock mit der Leiterin Frau Brandt.",
      "Ein Treffen, bei dem Menschen aus verschiedenen Ländern zusammen Deutsch sprechen.",
      "Ein Fest für alle Kinder der Stadt mit Spielen im Lernraum und im Erdgeschoss.",
    ], 2,
    "Sprachcafé am Dienstag um 19 Uhr: Menschen aus vielen Ländern sprechen miteinander Deutsch. Das Wort \"Sprachcafé\" wird in der richtigen Option umschrieben. Laptops, Lernraum und Frau Brandt kommen im Text vor, gehören aber nicht zum Dienstagstermin."),

  // ---------------------------------------------------------------- Weiterbildung
  rKurs.choice("detail", "MID",
    "Wer muss den Kurs \"Erste Hilfe im Betrieb\" besuchen?",
    [
      "Alle Beschäftigten, die in der Kantine im Erdgeschoss arbeiten.",
      "Neue Mitarbeiterinnen und Mitarbeiter, die im Lager arbeiten.",
      "Alle, die im Oktober in der Personalabteilung neu anfangen.",
      "Jede Person, die auch am Excel-Kurs im Oktober teilnimmt.",
    ], 1,
    "\"Für alle neuen Mitarbeiterinnen und Mitarbeiter im Lager ist dieser Kurs Pflicht.\" Die Kantine ist nur der Kursort, die Personalabteilung nimmt nur die Anmeldungen an."),
  rKurs.tfng("detail", "MID",
    [
      ["Der Excel-Kurs hat zwei Termine.", "R"],
      ["Im Telefonkurs gibt es zwölf Plätze.", "F"],
      ["Den Kurs am 24. Oktober besucht man im Gebäude der Firma.", "F"],
    ],
    "1 R: Kurs 1 ist am 6. und am 13. Oktober. 2 F: \"Nur acht Plätze.\" 3 F: Kurs 4 ist online."),
  rKurs.choice("inference", "HARD",
    "Frau Okafor arbeitet nur am Donnerstag und am Freitag, immer von 8 bis 14 Uhr. Sie möchte einen Kurs in ihrer Arbeitszeit machen. Welcher Kurs passt?",
    ["Kurs 4", "Kurs 3", "Kurs 1", "Kurs 2"], 0,
    "Kurs 4 ist am Freitag von 13 bis 14 Uhr. Kurs 3 ist zwar donnerstags, aber erst von 16 bis 17.30 Uhr; Kurs 1 ist montags, Kurs 2 mittwochs."),

  // ---------------------------------------------------------------- Anzeigen
  rAnz.match("gist", "MID",
    "Welche Anzeige passt zu welcher Person? Für jede Person gibt es eine Anzeige. Drei Anzeigen bleiben übrig.",
    [
      "Jonas studiert von Montag bis Freitag. Am Wochenende möchte er Geld verdienen.",
      "Frau Nowak kann nur am Vormittag arbeiten. Sie kennt sich gut mit dem Computer aus.",
      "Herr Haddad arbeitet tagsüber und möchte nach der Arbeit sein Deutsch verbessern.",
    ],
    ["Anzeige A", "Anzeige B", "Anzeige C", "Anzeige D", "Anzeige E", "Anzeige F"],
    [1, 6, 4],
    "Jonas: A (Aushilfe Samstag und Sonntag). Frau Nowak: F (nur vormittags, Computerkenntnisse). Herr Haddad: D (Deutschkurs am Abend). B ist werktags, C ist ein Angebot für Schüler, E ist eine Wohnung."),
  rAnz.choice("detail", "EASY",
    "Was steht in Anzeige B?",
    [
      "Die Arbeit findet samstags und sonntags statt und beginnt sofort.",
      "Die Arbeit beginnt erst im Dezember und endet am späten Abend.",
      "Die Arbeit beginnt sofort und endet schon am frühen Nachmittag, ohne Wochenende.",
      "Die Arbeit beginnt sofort, aber man braucht keinen Führerschein.",
    ], 2,
    "\"Montag bis Freitag, 7 bis 15 Uhr\" und \"Arbeitsbeginn: sofort\": sofort anfangen, am frühen Nachmittag Feierabend. Ein Führerschein ist nötig; Dezember gehört zur Wohnung in Anzeige E."),
  rAnz.tfng("detail", "MID",
    [
      ["Die Wohnung in Anzeige E kann man ab dem ersten Dezember beziehen.", "R"],
      ["In der Wohnung aus Anzeige E darf man ein Haustier halten.", "F"],
    ],
    "1 R: \"Frei ab 1. Dezember.\" 2 F: \"Keine Haustiere.\""),

  // ---------------------------------------------------------------- Kurznachrichten (Überschriften)
  rNews.match("gist", "MID",
    "Welche Überschrift passt zu welchem Text? Für jeden Text gibt es eine Überschrift. Drei Überschriften bleiben übrig.",
    ["Text 1", "Text 2", "Text 3", "Text 4", "Text 5"],
    [
      "A: Fahrrad fahren hält gesund",
      "B: Fahrrad kaputt? Hier gibt es Hilfe",
      "C: Fahrräder im Bus: Das ändert sich ab Montag",
      "D: Freiwillige für einen sauberen Frühling gesucht",
      "E: Linie 14 endet am Marktplatz",
      "F: Freibad öffnet mit neuem Kinderbecken",
      "G: Neue Kurse im Hallenbad für Anfänger",
      "H: Sauberes Wasser: Stadt baut neue Kläranlage",
    ],
    [1, 2, 4, 5, 6],
    "Text 1 (Radfahren und Gesundheit): A. Text 2 (Reparaturhilfe für Fahrräder): B. Text 3 (Freiwillige für die Stadtreinigung): D. Text 4 (Buslinie endet früher): E. Text 5 (Freibad hat geöffnet): F. C teilt \"Fahrrad\" mit Text 1 und 2 und \"Bus\" mit Text 4, G teilt das Thema Schwimmbad mit Text 5, H teilt \"sauber\" mit Text 3; zum Hauptthema passt keine dieser Überschriften."),
  rNews.choice("detail", "MID",
    "Wann kann man in der Stadtteilwerkstatt Hilfe bekommen?",
    [
      "Jeden Samstag, am Vormittag und am frühen Nachmittag.",
      "Jeden Samstag von zwölf bis sechzehn Uhr in der Mühlenstraße.",
      "Am ersten Samstag im Monat von zehn bis vierzehn Uhr.",
      "Jeden Sonntag von zehn Uhr bis zum Abend im Stadtteil.",
    ], 0,
    "Text 2: \"jeden Samstag von 10 bis 14 Uhr\", das heißt vormittags und bis in den frühen Nachmittag. Der erste Samstag im April gehört zum Frühjahrsputz (Text 3)."),
  rNews.tfng("detail", "MID",
    [
      ["Der Eintritt ins Freibad kostet fünf Euro.", "F"],
      ["Wegen einer Baustelle fährt die Linie 14 vorerst nicht mehr bis zum Hauptbahnhof.", "R"],
      ["Das Freibad ist nur am Wochenende geöffnet.", "F"],
    ],
    "1 F: Der Eintritt kostet vier Euro. 2 R: Wegen Bauarbeiten in der Bahnhofstraße endet die Linie 14 am Marktplatz. 3 F: Das Freibad ist bei sonnigem Wetter täglich geöffnet."),

  // ---------------------------------------------------------------- Hallenbad
  rPool.choice("detail", "MID",
    "Sie möchten am Mittwoch um 13 Uhr allein schwimmen. Was gilt für Sie?",
    [
      "Sie müssen bis 14 Uhr warten, weil das ganze Hallenbad geschlossen ist.",
      "Sie dürfen im großen Becken schwimmen, wenn Sie eine Badekappe tragen.",
      "Sie können nur an der Wassergymnastik für Gruppen teilnehmen.",
      "Sie können in dieser Zeit nur das kleine Becken im Hallenbad benutzen.",
    ], 3,
    "Am Mittwoch von 12 bis 14 Uhr ist das große Becken für die Gruppen reserviert, einzelne Gäste dürfen das kleine Becken benutzen. Das Bad bleibt also geöffnet; die Badekappe ist keine Bedingung für das große Becken."),
  rPool.choice("detail", "MID",
    "Was gilt für die Schließfächer?",
    [
      "Man zahlt zwei Euro und bekommt davon einen Euro zurück, wenn man geht.",
      "Man zahlt einen Euro für jede Stunde, die man im Hallenbad bleibt.",
      "Man wirft eine Münze mit einem Euro ein und bekommt sie später wieder.",
      "Man zahlt einen Euro und bekommt dafür einen Gutschein für das Café.",
    ], 2,
    "Die Ein-Euro-Münze funktioniert wie ein Pfand: Wer den Schlüssel wieder abschließt, bekommt sie zurück. Von zwei Euro, einem Preis pro Stunde oder einem Gutschein steht nichts im Text."),
  rPool.tfng("detail", "MID",
    [
      ["Am Sonntag schließt das Hallenbad später als am Freitag.", "F"],
      ["Die Wassergymnastik für Gruppen gibt es jeden Tag um die Mittagszeit.", "F"],
      ["Wer im Hallenbad etwas essen möchte, kann das im Erdgeschoss tun.", "R"],
    ],
    "1 F: Sonntag bis 18 Uhr, Freitag bis 21 Uhr, also früher. 2 F: Die Gruppen haben nur am Mittwoch von 12 bis 14 Uhr das große Becken. 3 R: Essen und Trinken ist nur im Café im Erdgeschoss erlaubt."),

  // ---------------------------------------------------------------- Ferienwohnung
  rFerien.choice("detail", "MID",
    "Was hat den Gästen an der Wohnung nicht gefallen?",
    [
      "Der Weg zum See war ziemlich lang, und im Dorf gab es weder einen Bäcker noch einen Supermarkt.",
      "Die Betten waren ziemlich hart, und das Internet funktionierte nur in einem Zimmer.",
      "Die Wohnung war nicht sauber, und der Vermieter war am Wochenende nie zu erreichen.",
      "Das Wasser im See war noch kalt, und die Betten waren zu weich für die Kinder.",
    ], 1,
    "Kritik an der Wohnung: harte Betten und WLAN nur im Wohnzimmer. Der See liegt nah, im Dorf gibt es Bäcker und Supermarkt, die Wohnung war sauber. Das kalte Wasser betrifft den See, nicht die Wohnung, und die Betten waren hart, nicht weich."),
  rFerien.choice("detail", "HARD",
    "Wann möchte die Familie wiederkommen?",
    [
      "Im Juni, weil dann das Wasser im See wärmer ist.",
      "Im Mai, weil dann weniger Gäste im Dorf sind und alles ruhiger ist.",
      "Im Juli, weil dann die Fahrräder des Vermieters wieder frei sind.",
      "Im Juni, weil dann die Betten in der Wohnung neu sind.",
    ], 0,
    "\"Wir kommen bestimmt wieder, aber dann im Juni, denn im Mai war das Wasser im See noch zu kalt.\" Die anderen Gründe stehen nicht im Text."),
  rFerien.tfng("detail", "EASY",
    [
      ["Die Familie hat eine Woche in der Wohnung verbracht.", "R"],
      ["Herr Keller hat den Gästen Fahrräder zur Verfügung gestellt.", "R"],
      ["Zum See muss man mit dem Auto fahren.", "F"],
    ],
    "1 R: Die Familie war eine Woche dort. 2 R: Der Vermieter hat Fahrräder geliehen. 3 F: Der See ist nur fünf Minuten zu Fuß entfernt."),
];

// ================================================================ LISTENING

type LSkill = "gist" | "detail" | "attitude" | "inference";

function clip(
  key: string,
  title: string,
  topic: string,
  speakers: Array<{ label: string; voice: "A" | "B" }>,
  lines: string[],
): SeedStimulus {
  return { key, section: "LISTENING", level: LEVEL, title, topic, speakers, body: lines.join("\n") };
}

function lChoice(
  stimulusKey: string,
  skill: LSkill,
  within: Within,
  prompt: string,
  options: Option4,
  correct: Pos,
  explanation: string,
): SeedItem {
  return {
    section: "LISTENING",
    level: LEVEL,
    type: "SINGLE_CHOICE",
    skillTag: `listening.${skill}`,
    within,
    stimulusKey,
    prompt,
    ...choiceContent(options, correct),
    explanation,
  };
}

function lTfng(
  stimulusKey: string,
  skill: LSkill,
  within: Within,
  statements: Array<[string, TfngValue]>,
  explanation: string,
): SeedItem {
  return {
    section: "LISTENING",
    level: LEVEL,
    type: "TRUE_FALSE_NG",
    skillTag: `listening.${skill}`,
    within,
    stimulusKey,
    prompt: "Richtig oder falsch? Entscheiden Sie für jede Aussage.",
    ...tfngContent(statements),
    explanation,
  };
}

/** A note-taking item: the student types what they hear into labelled gaps. */
function lGap(
  stimulusKey: string,
  within: Within,
  prompt: string,
  answers: Record<string, string[]>,
  explanation: string,
): SeedItem {
  return {
    section: "LISTENING",
    level: LEVEL,
    type: "GAP_FILL",
    skillTag: "listening.detail",
    within,
    stimulusKey,
    prompt,
    content: { kind: "GAP", gaps: Object.keys(answers).map((id) => ({ id })) },
    key: { kind: "GAP", answers },
    explanation,
  };
}

// A changed listening script gets a new key (audio is made from the script), hence the v3 keys.
const L_MAILBOX = "v3-l-a2-mailbox-vorstellungsgespraech";
const L_ABSCHIED = "v3-l-a2-abschied-planen";
const L_INT_A = "v3-l-a2-interview-gaertnerei-1";
const L_INT_B = "v3-l-a2-interview-gaertnerei-2";
const L_BAHNHOF = "v3-l-a2-ansage-regionalexpress";
const L_ARZT = "v3-l-a2-mailbox-arztpraxis";

const listeningStimuli: SeedStimulus[] = [
  clip(L_MAILBOX, "Nachricht auf der Mailbox", "Arbeitssuche",
    [{ label: "Frau Kraus", voice: "A" }],
    [
      "Frau Kraus: Guten Tag, Herr Rahimi, hier ist Sabine Kraus von der Firma Lindner Elektro. Sie haben sich bei uns als Lagerarbeiter beworben, und wir möchten Sie gern kennenlernen.",
      "Frau Kraus: Also, wir wollten Sie erst am Dienstag einladen. Aber da ist unser Chef leider nicht im Haus. Können Sie auch am Mittwoch? Um halb zehn?",
      "Frau Kraus: Wir sind in der Hafenstraße siebzehn. Gehen Sie bitte zuerst zur Information, dort holt Sie dann jemand ab.",
      "Frau Kraus: Ach so, bringen Sie bitte Ihren Ausweis und Ihre Zeugnisse mit. Den Lebenslauf haben wir ja schon.",
      "Frau Kraus: Rufen Sie mich bitte kurz zurück, ob der Termin passt. Meine Nummer ist null vier null, fünf fünf, drei acht, zwei eins. Noch einmal: null vier null, fünf fünf, drei acht, zwei eins. Vielen Dank, auf Wiederhören!",
    ]),
  clip(L_ABSCHIED, "Eine Feier im Büro planen", "Feier und Geschenk",
    [
      { label: "Mira", voice: "A" },
      { label: "Daniel", voice: "B" },
    ],
    [
      "Mira: Daniel, hast du kurz Zeit? Paula hört Ende Oktober bei uns auf. Ich möchte etwas für sie organisieren.",
      "Daniel: Oh, schade! Aber gute Idee. Was denn? Ein Essen im Restaurant?",
      "Mira: Daran habe ich auch gedacht. Aber wir sind zwanzig Leute, das wird zu teuer. Ich glaube, ein Frühstück hier im Büro ist besser.",
      "Daniel: Na ja, stimmt. Und wann? Am letzten Freitag im Oktober?",
      "Mira: Nein, nein, da hat Paula schon frei. Besser am Donnerstag davor. Um neun Uhr, vor der Teambesprechung.",
      "Daniel: Gut. Soll ich das Essen einkaufen?",
      "Mira: Nein, das macht Ahmet. Kannst du ein Geschenk besorgen? Wir sammeln von jedem fünf Euro.",
      "Daniel: Klar. Paula fotografiert doch so gern. Wie wäre es mit einem Fotobuch? Mit Bildern aus der ganzen Welt?",
      "Mira: Genau, super Idee! Ich schreibe heute noch eine E-Mail an alle. Aber Paula darf natürlich nichts wissen.",
      "Daniel: Alles klar, ich sage kein Wort.",
    ]),
  clip(L_INT_A, "Radiointerview: Vom Supermarkt in die Gärtnerei", "Berufswechsel",
    [
      { label: "Moderatorin", voice: "A" },
      { label: "Herr Nowak", voice: "B" },
    ],
    [
      "Moderatorin: Guten Morgen und willkommen bei Arbeit heute. Bei mir im Studio ist Tomasz Nowak. Er hat den Beruf gewechselt und wird jetzt Gärtner. Herr Nowak, was haben Sie vorher gemacht?",
      "Herr Nowak: Guten Morgen. Ich habe zehn Jahre im Supermarkt gearbeitet, erst an der Kasse, dann im Lager. Die Arbeit war okay. Aber ich wollte schon immer lieber draußen arbeiten.",
      "Moderatorin: Und jetzt machen Sie eine Ausbildung zum Gärtner?",
      "Herr Nowak: Ja, genau. Ich bin im zweiten Jahr, insgesamt dauert sie drei Jahre. Vier Tage pro Woche arbeite ich in einer Gärtnerei, und ein Tag ist Berufsschule.",
      "Moderatorin: Und was machen Sie in der Gärtnerei?",
      "Herr Nowak: Na ja, im Moment pflanzen wir viele Bäume für einen neuen Park. Das heißt, nicht nur Bäume, auch Büsche und Blumen. Das macht mir großen Spaß.",
    ]),
  clip(L_INT_B, "Radiointerview: Schule, Geld und Pläne", "Berufswechsel",
    [
      { label: "Moderatorin", voice: "A" },
      { label: "Herr Nowak", voice: "B" },
    ],
    [
      "Moderatorin: Herr Nowak, ist es nicht schwer, wieder in die Schule zu gehen?",
      "Herr Nowak: Am Anfang schon. Ich hatte lange nichts mehr gelernt. Aber meine Mitschüler sind sehr nett. Manchmal helfe ich ihnen in Mathe, und dafür erklären sie mir die Computerprogramme.",
      "Moderatorin: Und wie ist es mit dem Geld?",
      "Herr Nowak: Ehrlich gesagt, das ist das größte Problem. In der Ausbildung verdiene ich viel weniger als im Supermarkt. Aber meine Frau arbeitet auch, und wir haben vorher etwas gespart. Es geht also.",
      "Moderatorin: Würden Sie es wieder machen?",
      "Herr Nowak: Ja, auf jeden Fall! Abends bin ich oft müde, aber ich bin zufrieden. Später möchte ich vielleicht einmal eine eigene kleine Gärtnerei haben.",
      "Moderatorin: Vielen Dank, Herr Nowak, und viel Erfolg!",
    ]),
  clip(L_BAHNHOF, "Ansage am Bahnhof", "Reisen",
    [{ label: "Ansage", voice: "A" }],
    [
      "Ansage: Achtung an Gleis vier! Der Regionalexpress nach Leipzig fährt heute nicht um vierzehn Uhr zwanzig ab, sondern erst um vierzehn Uhr fünfundvierzig. Ich wiederhole: erst um vierzehn Uhr fünfundvierzig. Der Zug hat ein technisches Problem und fährt nicht von Gleis vier, sondern von Gleis sechs. Bitte beachten Sie: Die Wagen für Fahrräder stehen am Ende des Zuges. Wir bitten um Entschuldigung.",
    ]),
  clip(L_ARZT, "Nachricht von der Arztpraxis", "Gesundheit",
    [{ label: "Frau Berg", voice: "B" }],
    [
      "Frau Berg: Guten Tag, Frau Aydin, hier ist die Praxis von Doktor Wolf, Berg am Apparat. Ihr Termin am Montag muss leider ausfallen, die Ärztin ist krank. Können Sie stattdessen am Mittwoch kommen? Ach nein, Entschuldigung, der Mittwoch ist schon voll. Am Donnerstag, um Viertel nach drei, also fünfzehn Uhr fünfzehn.",
      "Frau Berg: Bitte bringen Sie Ihre Versichertenkarte mit. Wenn der Termin nicht passt, rufen Sie uns an, morgens zwischen acht und zwölf Uhr. Unsere Nummer ist null zwei null drei, vier sieben, neun eins. Ich wiederhole: null zwei null drei, vier sieben, neun eins. Danke und bis bald!",
    ]),
];

const listeningItems: SeedItem[] = [
  // ---------------------------------------------------------------- Mailbox
  lChoice(L_MAILBOX, "detail", "MID",
    "Warum schlägt Frau Kraus einen anderen Tag vor?",
    [
      "Herr Rahimi hat gesagt, dass er am Dienstag arbeiten muss.",
      "Der Chef ist am zuerst geplanten Tag leider nicht in der Firma.",
      "Die Firma hat am Dienstag wegen eines Umzugs geschlossen.",
      "Frau Kraus hat am Dienstag selbst einen anderen Termin.",
    ], 1,
    "\"Wir wollten Sie erst am Dienstag einladen. Aber da ist unser Chef leider nicht im Haus.\" Von einem Umzug, einem Termin von Frau Kraus oder Herrn Rahimis Arbeit ist keine Rede."),
  lChoice(L_MAILBOX, "detail", "MID",
    "Was soll Herr Rahimi mitbringen?",
    [
      "Seinen Lebenslauf und seine Zeugnisse.",
      "Seinen Ausweis und seinen Lebenslauf.",
      "Seine Zeugnisse und ein Passfoto für die Firma.",
      "Seinen Ausweis und alle seine Zeugnisse.",
    ], 3,
    "Ausweis und Zeugnisse; den Lebenslauf hat die Firma schon (\"Den Lebenslauf haben wir ja schon\"), von einem Passfoto ist nicht die Rede."),
  lGap(L_MAILBOX, "HARD",
    "Notieren Sie die Angaben zum Gespräch und zum Rückruf.\n\nTag des Gesprächs: {{g1}}\nUhrzeit: {{g2}}\nTelefonnummer von Frau Kraus: {{g3}}",
    {
      g1: ["Mittwoch"],
      g2: [
        "9.30", "9:30", "9.30 Uhr", "9:30 Uhr", "09.30", "09:30", "09.30 Uhr", "09:30 Uhr",
        "9 Uhr 30", "neun Uhr dreißig", "halb zehn", "halb 10",
      ],
      g3: [
        "040553821", "040 553821", "040 55 38 21", "040 5538 21", "04055 3821", "040 553 821",
        "040-553821", "040-55 38 21", "040/553821", "040/55 38 21", "0405 53821",
      ],
    },
    "Die Firma hatte zuerst Dienstag gedacht, der Vorschlag gilt dann für Mittwoch (Korrektur im Text), und zwar um halb zehn. Die Nummer wird zweimal gesprochen: null vier null, fünf fünf, drei acht, zwei eins. Gezählt werden Ziffern in jeder üblichen Schreibweise."),

  // ---------------------------------------------------------------- Abschied
  lChoice(L_ABSCHIED, "detail", "EASY",
    "Wo soll die Feier für Paula stattfinden?",
    [
      "Im Büro, vor der Teambesprechung am Morgen.",
      "In einem Restaurant in der Nähe vom Büro.",
      "Bei Paula zu Hause am Donnerstagmorgen.",
      "In einem Café in der Stadt mit allen Kollegen.",
    ], 0,
    "Das Restaurant ist für zwanzig Leute zu teuer, deshalb machen sie ein Frühstück im Büro, um neun Uhr vor der Teambesprechung."),
  lTfng(L_ABSCHIED, "detail", "MID",
    [
      ["Das Frühstück findet vor der Teambesprechung statt.", "R"],
      ["Ahmet besorgt das Geschenk.", "F"],
      ["Paula soll vorher nichts von der Feier erfahren.", "R"],
    ],
    "1 R: Um neun Uhr, vor der Teambesprechung. 2 F: Ahmet kauft das Essen ein, Mira bittet Daniel um das Geschenk. 3 R: \"Paula darf natürlich nichts wissen.\""),
  lChoice(L_ABSCHIED, "inference", "HARD",
    "Warum möchte Daniel ein Fotobuch schenken?",
    [
      "Paula hat sich ein Fotobuch gewünscht, weil sie bald verreist.",
      "Das Fotobuch kostet nur fünf Euro und ist deshalb günstig.",
      "Paula fotografiert gern, das Geschenk passt zu ihrem Hobby.",
      "Daniel hat selbst viele Fotos aus aller Welt gemacht.",
    ], 2,
    "Daniel sagt, dass Paula gern fotografiert. Die fünf Euro gibt jede Person für das Geschenk, das ist nicht der Preis des Buches; von einem Wunsch oder von Daniels eigenen Fotos ist nicht die Rede."),

  // ---------------------------------------------------------------- Interview Teil 1
  lChoice(L_INT_A, "detail", "EASY",
    "Warum hat Herr Nowak den Beruf gewechselt?",
    [
      "Er hat im Lager zu viele Stunden gearbeitet und wenig Pausen gehabt.",
      "Er wollte nach zehn Jahren an der Kasse mehr Geld verdienen.",
      "Er wollte schon immer lieber draußen als drinnen im Lager oder an der Kasse arbeiten.",
      "Er hatte Streit mit den Kollegen und wollte in eine kleinere Firma.",
    ], 2,
    "\"Die Arbeit war okay. Aber ich wollte schon immer lieber draußen arbeiten.\" Mehr Geld verdient er in der Ausbildung nicht, im Gegenteil (siehe Teil 2); Streit oder zu lange Arbeitszeiten werden nicht genannt."),
  lChoice(L_INT_A, "detail", "MID",
    "Wie sieht Herrn Nowaks Woche in der Ausbildung aus?",
    [
      "Drei Tage arbeitet er in der Gärtnerei, zwei Tage lernt er in der Schule.",
      "Vier Tage lernt er in der Berufsschule, einen Tag arbeitet er im Supermarkt.",
      "Fünf Tage arbeitet er in der Gärtnerei, am Abend lernt er in der Schule.",
      "Vier Tage arbeitet er in der Gärtnerei, an einem Tag geht er in die Schule.",
    ], 3,
    "\"Vier Tage pro Woche arbeite ich in einer Gärtnerei, und ein Tag ist Berufsschule.\""),
  lTfng(L_INT_A, "detail", "MID",
    [
      ["Vor der Ausbildung hat Herr Nowak in einem Geschäft gearbeitet.", "R"],
      ["Die Ausbildung dauert insgesamt zwei Jahre.", "F"],
    ],
    "1 R: zehn Jahre im Supermarkt. 2 F: Er ist im zweiten Jahr, insgesamt dauert die Ausbildung drei Jahre."),

  // ---------------------------------------------------------------- Interview Teil 2
  lChoice(L_INT_B, "detail", "MID",
    "Was ist für Herrn Nowak das größte Problem?",
    [
      "Er verdient in der Ausbildung viel weniger als früher im Supermarkt.",
      "Er versteht die Computerprogramme in der Berufsschule nicht.",
      "Seine Frau findet die Ausbildung nicht gut und möchte, dass er aufhört.",
      "Seine Mitschüler in der Berufsschule helfen ihm nicht bei den Aufgaben.",
    ], 0,
    "\"Das ist das größte Problem. In der Ausbildung verdiene ich viel weniger als im Supermarkt.\" Bei den Computerprogrammen helfen ihm die Mitschüler, und seine Frau arbeitet auch."),
  lChoice(L_INT_B, "attitude", "HARD",
    "Wie denkt Herr Nowak heute über seine Entscheidung?",
    [
      "Er ist unsicher, ob die Ausbildung wirklich das Richtige für ihn ist.",
      "Er ist zufrieden und würde den Weg noch einmal gehen.",
      "Er möchte lieber wieder im Supermarkt arbeiten, weil er dort mehr verdient.",
      "Er will die Ausbildung bald beenden, weil sie ihn abends zu müde macht.",
    ], 1,
    "Er würde es \"auf jeden Fall\" wieder machen und ist zufrieden, auch wenn er abends oft müde ist."),
  lTfng(L_INT_B, "detail", "MID",
    [
      ["Herr Nowaks Frau hat keine Arbeit.", "F"],
      ["Herr Nowak und seine Mitschüler helfen sich gegenseitig.", "R"],
      ["Herr Nowak kann sich vorstellen, später einen eigenen kleinen Betrieb zu haben.", "R"],
    ],
    "1 F: \"Meine Frau arbeitet auch.\" 2 R: Er hilft in Mathe, sie erklären ihm die Computerprogramme. 3 R: \"Später möchte ich vielleicht einmal eine eigene kleine Gärtnerei haben.\""),

  // ---------------------------------------------------------------- Bahnhof
  lChoice(L_BAHNHOF, "detail", "EASY",
    "Wann fährt der Zug nach Leipzig heute ab?",
    ["Um 14.20 Uhr.", "Um 14.45 Uhr.", "Um 15.20 Uhr.", "Um 14.54 Uhr."], 1,
    "Nicht um 14.20 Uhr (die normale Zeit), sondern erst um 14.45 Uhr; die Zeit wird wiederholt."),
  lChoice(L_BAHNHOF, "detail", "MID",
    "Von welchem Gleis fährt der Zug heute?",
    ["Von Gleis 4.", "Von Gleis 5.", "Von Gleis 16.", "Von Gleis 6."], 3,
    "Die Ansage beginnt mit Gleis vier, korrigiert dann aber: \"nicht von Gleis vier, sondern von Gleis sechs\"."),
  lChoice(L_BAHNHOF, "detail", "MID",
    "Wo stehen die Wagen für Fahrräder?",
    [
      "Am Anfang des Zuges.",
      "In der Mitte des Zuges.",
      "Am Ende des Zuges.",
      "Direkt hinter der Lokomotive.",
    ], 2,
    "\"Die Wagen für Fahrräder stehen am Ende des Zuges.\" Anfang des Zuges und die Plätze hinter der Lokomotive sind dasselbe und werden nicht genannt."),

  // ---------------------------------------------------------------- Arztpraxis
  lChoice(L_ARZT, "gist", "EASY",
    "Warum ruft die Praxis an?",
    [
      "Die Ärztin hat am Montag einen anderen Termin im Krankenhaus.",
      "Frau Aydin hat ihren Termin am Montag vergessen und soll anrufen.",
      "Die Ärztin ist krank, deshalb fällt der Montagstermin aus.",
      "Die Praxis hat am Montag wegen Bauarbeiten geschlossen.",
    ], 2,
    "\"Ihr Termin am Montag muss leider ausfallen, die Ärztin ist krank.\" Die anderen Gründe werden nicht genannt."),
  lChoice(L_ARZT, "detail", "MID",
    "Was soll Frau Aydin mitbringen?",
    [
      "Ihre Versichertenkarte.",
      "Ihren Impfpass und die Karte.",
      "Die Überweisung vom Hausarzt.",
      "Die Ergebnisse vom letzten Mal.",
    ], 0,
    "\"Bitte bringen Sie Ihre Versichertenkarte mit.\""),
  lGap(L_ARZT, "HARD",
    "Notieren Sie die Angaben zum neuen Termin.\n\nTag: {{g1}}\nUhrzeit: {{g2}}\nTelefonnummer der Praxis: {{g3}}",
    {
      g1: ["Donnerstag"],
      g2: [
        "15.15", "15:15", "15.15 Uhr", "15:15 Uhr", "15 Uhr 15", "fünfzehn Uhr fünfzehn",
        "Viertel nach drei", "viertel nach 3", "3.15", "3:15", "3.15 Uhr", "3:15 Uhr",
      ],
      g3: [
        "02034791", "0203 4791", "0203 47 91", "0203-4791", "0203-47 91", "0203/4791", "0203/47 91", "020 34791", "02034 791",
      ],
    },
    "Der Mittwoch wird sofort zurückgenommen (Korrektur), der neue Termin ist Donnerstag um Viertel nach drei, also 15.15 Uhr. Die Nummer wird zweimal gesprochen: null zwei null drei, vier sieben, neun eins. Gezählt werden Ziffern in jeder üblichen Schreibweise."),
];

// ================================================================ WRITING

const INFORMAL = "informell (du)";
const SEMIFORMAL = "halbformell (Sie)";

function writingTask(
  skill: "message" | "email",
  within: Within,
  words: [number, number],
  prompt: string,
  contentPoints: string[],
  studentPoints: string[],
  register: string,
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
    rubric: { contentPoints, register, studentPoints },
    explanation,
  };
}

const INFORMAL_WORDS: [number, number] = [20, 30];
const SEMIFORMAL_WORDS: [number, number] = [30, 40];

const writingItems: SeedItem[] = [
  writingTask("message", "EASY", INFORMAL_WORDS,
    "Sie ziehen am Samstag in eine neue Wohnung. Schreiben Sie Ihrem Freund Jan eine Nachricht.\n\n" +
      "- Bitten Sie Jan um Hilfe beim Umzug.\n" +
      "- Sagen Sie, wann er kommen soll.\n" +
      "- Was machen Sie nach dem Umzug zusammen?\n\n" +
      "Schreiben Sie 20 bis 30 Wörter.",
    [
      "Bitte um Hilfe beim Umzug am Samstag",
      "Uhrzeit (und eventuell Ort/Adresse) nennen",
      "Vorschlag für danach (z. B. zusammen essen, Pizza bestellen)",
    ],
    [
      "um Hilfe beim Umzug bitten",
      "sagen, wann Jan kommen soll",
      "was Sie nach dem Umzug zusammen machen",
      "Anrede und Gruß",
    ],
    INFORMAL,
    "Kontaktpflege wie im Goethe A2, Schreiben Teil 1. Alle drei Punkte müssen erkennbar sein; Anrede und Gruß gehören dazu."),
  writingTask("message", "EASY", INFORMAL_WORDS,
    "Ihre Kollegin Sara hat Sie für Freitagabend zum Essen eingeladen. Sie können nicht kommen. Schreiben Sie Sara eine Nachricht.\n\n" +
      "- Bedanken Sie sich für die Einladung.\n" +
      "- Warum können Sie nicht kommen?\n" +
      "- Schlagen Sie einen anderen Termin vor.\n\n" +
      "Schreiben Sie 20 bis 30 Wörter.",
    [
      "Dank für die Einladung",
      "Absage mit Grund (z. B. Termin, Besuch, krank)",
      "neuer Terminvorschlag (Tag und/oder Uhrzeit)",
    ],
    [
      "sich für die Einladung bedanken",
      "sagen, warum Sie nicht kommen können",
      "einen anderen Termin vorschlagen",
      "Anrede und Gruß",
    ],
    INFORMAL,
    "Erwartet werden einfache Sätze mit \"weil\" oder \"denn\" für den Grund. Fehlt ein Leitpunkt, ist die Aufgabe nur teilweise erfüllt."),
  writingTask("message", "MID", INFORMAL_WORDS,
    "Ihr Freund Can fragt: \"Wie ist deine neue Arbeit?\" Schreiben Sie Can eine Nachricht.\n\n" +
      "- Was machen Sie bei der Arbeit?\n" +
      "- Wie sind die Kolleginnen und Kollegen?\n" +
      "- Was gefällt Ihnen nicht so gut?\n\n" +
      "Schreiben Sie 20 bis 30 Wörter.",
    [
      "Tätigkeit bei der neuen Arbeit beschreiben",
      "etwas über Kolleginnen und Kollegen sagen",
      "einen Nachteil nennen (z. B. langer Weg, früh aufstehen)",
    ],
    [
      "was Sie bei der Arbeit machen",
      "wie die Kolleginnen und Kollegen sind",
      "was Ihnen nicht so gut gefällt",
      "Anrede und Gruß",
    ],
    INFORMAL,
    "Prüft Beschreiben und Bewerten im Alltag; Verben wie \"gefallen\" mit Dativ und \"aber\" oder \"trotzdem\" zeigen A2-Strukturen."),
  writingTask("email", "MID", SEMIFORMAL_WORDS,
    "Sie besuchen einen Deutschkurs bei Frau Lange. Nächste Woche können Sie nicht zum Kurs kommen. Schreiben Sie Frau Lange eine E-Mail.\n\n" +
      "- Entschuldigen Sie sich.\n" +
      "- Sagen Sie, warum Sie nicht kommen können.\n" +
      "- Fragen Sie nach den Hausaufgaben.\n\n" +
      "Schreiben Sie 30 bis 40 Wörter.",
    [
      "Entschuldigung, dass man nächste Woche fehlt",
      "Grund nennen (z. B. Arbeit, Termin, Reise)",
      "Frage nach Hausaufgaben oder Material",
    ],
    [
      "sich entschuldigen",
      "sagen, warum Sie nicht kommen können",
      "nach den Hausaufgaben fragen",
      "Anrede und Gruß",
    ],
    SEMIFORMAL,
    "Halbformelle Mitteilung wie im Goethe A2, Schreiben Teil 2: Anrede \"Liebe Frau Lange\" oder \"Sehr geehrte Frau Lange\", durchgehend Sie, passender Gruß."),
  writingTask("email", "HARD", SEMIFORMAL_WORDS,
    "In Ihrer Wohnung funktioniert die Heizung nicht. Schreiben Sie eine E-Mail an Ihren Vermieter, Herrn Schäfer.\n\n" +
      "- Beschreiben Sie das Problem.\n" +
      "- Seit wann gibt es das Problem?\n" +
      "- Bitten Sie um einen Termin mit einem Techniker.\n\n" +
      "Schreiben Sie 30 bis 40 Wörter.",
    [
      "Problem beschreiben (Heizung kalt / funktioniert nicht)",
      "Zeitangabe (z. B. seit Montag, seit zwei Tagen)",
      "höfliche Bitte um einen Termin, möglichst mit Konjunktiv II (Könnten Sie ...?)",
    ],
    [
      "das Problem beschreiben",
      "sagen, seit wann es das Problem gibt",
      "um einen Termin mit einem Techniker bitten",
      "Anrede und Gruß",
    ],
    SEMIFORMAL,
    "Handlungsregulierung im Bereich Wohnen. Für die volle Erfüllung braucht es eine klare Bitte und die formelle Anrede."),
  writingTask("email", "HARD", SEMIFORMAL_WORDS,
    "Sie möchten am nächsten Freitag einen Tag freinehmen. Schreiben Sie eine E-Mail an Ihre Chefin, Frau Yıldız.\n\n" +
      "- Bitten Sie um einen freien Tag.\n" +
      "- Warum brauchen Sie den Tag?\n" +
      "- Machen Sie einen Vorschlag: An welchem anderen Tag können Sie die Arbeit machen?\n\n" +
      "Schreiben Sie 30 bis 40 Wörter.",
    [
      "höfliche Bitte um einen freien Tag am Freitag",
      "Grund nennen",
      "Angebot, die Stunden oder Aufgaben an einem anderen Tag nachzuholen",
    ],
    [
      "um einen freien Tag bitten",
      "sagen, warum Sie den Tag brauchen",
      "einen anderen Arbeitstag vorschlagen",
      "Anrede und Gruß",
    ],
    SEMIFORMAL,
    "Arbeitskontext. Erwartet werden Höflichkeitsformen (Ich würde gern ..., Wäre das möglich?) und ein klarer Vorschlag."),
  writingTask("message", "MID", [40, 60],
    "Ihr Freund Murat schreibt Ihnen:\n\n" +
      "\u201EHallo! Ich fahre am Sonntag mit dem Rad an den See und möchte nicht allein fahren. " +
      "Hast du Lust mitzukommen? Wann hast du Zeit? Hast du ein Fahrrad? " +
      "Was sollen wir mitnehmen? Und wo wollen wir uns treffen?\u201C\n\n" +
      "Schreiben Sie Murat eine Antwort. Beantworten Sie alle fünf Fragen und schreiben Sie etwa 50 Wörter.",
    [
      "sagen, ob man mitkommen möchte",
      "Zeit nennen (Uhrzeit oder ab wann man kann)",
      "sagen, ob man ein Fahrrad hat",
      "Vorschlag, was man mitnimmt (z. B. Essen, Getränke, Badesachen)",
      "Treffpunkt vorschlagen",
    ],
    [
      "sagen, ob Sie mitkommen",
      "sagen, wann Sie Zeit haben",
      "sagen, ob Sie ein Fahrrad haben",
      "vorschlagen, was Sie mitnehmen",
      "einen Treffpunkt vorschlagen",
      "Anrede und Gruß",
    ],
    INFORMAL,
    "Antwort auf eine Nachricht wie im ÖSD-A2-Schreiben: Alle fünf Fragen müssen beantwortet werden, dazu Anrede und Gruß. Fehlt eine Antwort, ist der Punkt nicht erfüllt. Etwa 50 Wörter; deutlich weniger als die Hälfte erfüllt die Aufgabe nicht."),
];

// ================================================================ SPEAKING

function speakingTask(
  skill: "introduction" | "monologue" | "planning" | "request",
  within: Within,
  timing: { thinkSeconds: number; answerSeconds: number; maxTakes: number },
  prompt: string,
  contentPoints: string[],
  studentPoints: string[],
  register: string | undefined,
  explanation: string,
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
    explanation,
  };
}

const SHORT = { thinkSeconds: 30, answerSeconds: 60, maxTakes: 2 };
const LONG = { thinkSeconds: 45, answerSeconds: 90, maxTakes: 2 };

const speakingItems: SeedItem[] = [
  speakingTask("introduction", "EASY", SHORT,
    "Stellen Sie sich vor. Sprechen Sie über diese Punkte:\n\n" +
      "- Name und Wohnort\n" +
      "- Arbeit, Schule oder Ausbildung\n" +
      "- Sprachen\n" +
      "- Freizeit und Hobbys",
    [
      "Name und Wohnort",
      "Arbeit, Schule oder Ausbildung",
      "Sprachen (welche, wie gut, seit wann Deutsch)",
      "Freizeit/Hobbys mit mindestens einem Detail",
    ],
    [
      "Name und Wohnort",
      "Arbeit, Schule oder Ausbildung",
      "Sprachen",
      "Freizeit und Hobbys",
    ],
    undefined,
    "Wie Goethe A2, Sprechen Teil 1, als Monolog. A2 zeigt sich an zusammenhängenden Sätzen und Details (seit wann, wie oft), nicht nur an Stichworten."),
  speakingTask("monologue", "MID", LONG,
    "Erzählen Sie über Ihren Alltag. Wie sieht ein normaler Tag bei Ihnen aus?\n\n" +
      "- Wann stehen Sie auf?\n" +
      "- Wie kommen Sie zur Arbeit, zur Schule oder zum Kurs?\n" +
      "- Was machen Sie dort?\n" +
      "- Was machen Sie am Abend?",
    [
      "Tagesablauf in zeitlicher Reihenfolge (zuerst, dann, danach)",
      "Weg zur Arbeit, zur Schule oder zum Kurs",
      "Tätigkeiten dort (Arbeit, Schule oder Kurs)",
      "Abend oder Freizeit",
    ],
    [
      "wann Sie aufstehen",
      "wie Sie zur Arbeit, zur Schule oder zum Kurs kommen",
      "was Sie dort machen",
      "was Sie am Abend machen",
    ],
    undefined,
    "Entspricht Goethe A2, Sprechen Teil 2 (über das eigene Leben erzählen, etwa 90 Sekunden). Achten auf Verbindungswörter und trennbare Verben."),
  speakingTask("monologue", "MID", LONG,
    "Erzählen Sie über Ihr letztes Wochenende.\n\n" +
      "- Was haben Sie am Samstag gemacht?\n" +
      "- Was haben Sie am Sonntag gemacht?\n" +
      "- Mit wem waren Sie zusammen?\n" +
      "- Was hat Ihnen besonders gut gefallen?",
    [
      "Aktivitäten am Samstag im Perfekt",
      "Aktivitäten am Sonntag im Perfekt",
      "mit wem (Personen nennen)",
      "Bewertung: was gut gefallen hat und warum",
    ],
    [
      "was Sie am Samstag gemacht haben",
      "was Sie am Sonntag gemacht haben",
      "mit wem Sie zusammen waren",
      "was Ihnen besonders gut gefallen hat",
    ],
    undefined,
    "Prüft vor allem das Perfekt (haben/sein) und Präteritum von sein/haben. Häufige Fehler beim Hilfsverb sind A2-typisch, solange man versteht."),
  speakingTask("planning", "MID", SHORT,
    "Ihr Kollege Paul möchte mit Ihnen nach der Arbeit essen gehen. Er geht nicht ans Telefon. Sprechen Sie ihm eine Nachricht auf die Mailbox.\n\n" +
      "- Sagen Sie, dass Sie gern mitkommen.\n" +
      "- Schlagen Sie einen Tag und eine Uhrzeit vor.\n" +
      "- Schlagen Sie einen Ort vor.\n" +
      "- Bitten Sie Paul um eine Antwort.",
    [
      "Zusage, dass man gern mitkommt",
      "konkreter Tag und Uhrzeit",
      "Vorschlag für einen Ort (Restaurant, Kantine, Café ...)",
      "Bitte um Rückruf oder Nachricht",
    ],
    [
      "sagen, dass Sie gern mitkommen",
      "einen Tag und eine Uhrzeit vorschlagen",
      "einen Ort vorschlagen",
      "Paul um eine Antwort bitten",
    ],
    INFORMAL,
    "Ersatz für Goethe A2, Sprechen Teil 3 (gemeinsam planen) in Monologform. Vorschläge mit \"Wollen wir ...?\", \"Wie wäre es mit ...?\" oder \"Hast du Zeit ...?\"."),
  speakingTask("request", "HARD", SHORT,
    "Sie sollen am Samstag arbeiten, aber an diesem Tag haben Sie einen wichtigen Termin. Rufen Sie Ihre Chefin, Frau Berger, an.\n\n" +
      "- Erklären Sie das Problem.\n" +
      "- Bitten Sie höflich um einen anderen Arbeitstag.\n" +
      "- Machen Sie einen Vorschlag.",
    [
      "Problem nennen: Termin am Samstag",
      "höfliche Bitte, möglichst mit Konjunktiv II (Könnte ich ...? Wäre es möglich ...?)",
      "konkreter Gegenvorschlag (anderer Tag, Tausch mit Kollegin/Kollege)",
    ],
    [
      "das Problem erklären",
      "höflich um einen anderen Arbeitstag bitten",
      "einen Vorschlag machen",
    ],
    "formell (Sie)",
    "Bitten und Vorschläge im Arbeitskontext. Volle Erfüllung nur mit erkennbar höflicher Form und konkretem Vorschlag."),
  speakingTask("monologue", "HARD", LONG,
    "Wohnen Sie lieber in der Stadt oder auf dem Land? Erzählen Sie.\n\n" +
      "- Wo wohnen Sie jetzt?\n" +
      "- Was gefällt Ihnen dort, was nicht?\n" +
      "- Wo möchten Sie später gern wohnen? Warum?",
    [
      "aktuelle Wohnsituation beschreiben",
      "Vor- und Nachteile nennen",
      "Wunsch für später mit Begründung (weil ..., denn ...)",
      "Vergleich mit Komparativ (ruhiger, teurer, lieber ...)",
    ],
    [
      "wo Sie jetzt wohnen",
      "was Ihnen dort gefällt und was nicht",
      "wo Sie später gern wohnen möchten, und warum",
    ],
    undefined,
    "Zusammenhängendes Sprechen mit Begründung und Vergleich. Komparativ und weil-Sätze sind die Zielstrukturen dieser Aufgabe."),
  speakingTask("planning", "MID", LONG,
    "Ihre Deutschklasse macht am Ende des Monats einen gemeinsamen Ausflug. Sie planen ihn mit einer Partnerin oder einem Partner. " +
      "Auf der Karte stehen Vorschläge. Sprechen Sie über alle vier Punkte und einigen Sie sich. Sie können auch eigene Ideen nennen.\n\n" +
      "Wohin? Freizeitpark, Museum, Wanderung, Schwimmbad\n" +
      "Wann? Samstag, Sonntag, nach dem Kurs unter der Woche\n" +
      "Wie kommen wir hin? Bus, Zug, Fahrgemeinschaft mit dem Auto\n" +
      "Was nehmen wir mit? Essen, Getränke, Kamera, Regenjacke",
    [
      "einen Ort vorschlagen und begründen",
      "Tag und Uhrzeit vorschlagen",
      "sagen, wie die Gruppe hinkommt",
      "sagen, was alle mitnehmen",
      "auf Vorschläge reagieren (zustimmen oder höflich etwas anderes vorschlagen)",
    ],
    [
      "einen Ort vorschlagen",
      "Tag und Uhrzeit vorschlagen",
      "sagen, wie Sie hinkommen",
      "sagen, was Sie mitnehmen",
      "auf Vorschläge reagieren",
    ],
    INFORMAL,
    "Gemeinsames Planen mit Optionskarte wie im ÖSD-A2-Sprechen (Teil 2). Prüft Vorschläge (Wollen wir ...? Wie wäre es mit ...?), Zustimmung und Gegenvorschlag, dazu Begründungen mit weil. Die Karte nennt die Punkte, nicht die Entscheidung."),
];

// ================================================================ EXPORT

export const A2_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = {
  grammar: { stimuli: [], items: [...grammarItems, grammarCTest, grammarCTest2, grammarCTest3, ...grammarTexts] },
  reading: { stimuli: readingStimuli, items: readingItems },
  listening: { stimuli: listeningStimuli, items: listeningItems },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
