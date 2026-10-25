import type { TfngValue } from "@/lib/exam/types";
import { cloze } from "../cloze";
import { cTest } from "../ctest";
import { wordBank } from "../wordbank";
import { img } from "../image";
import { LISTENING_RF, READING_RF, READING_YES_NO } from "../instructions";
import type { SeedBankPart, SeedItem, SeedStimulus } from "../types";

/*
 * A seed item's text is part of its seed key (seed-key.ts). Changing the
 * wording of an item here makes it a new item: the bank top-up then adds it
 * next to the old one in every organisation that already has the old one. To
 * fix wording, add a new item (and retire the old row) rather than editing.
 */

/**
 * B1 starter bank, written against docs/EXAM-BANK-RESEARCH.md (section B1).
 *
 * Grammar: 25 items (8 EASY, 11 MID, 6 HARD) plus three C-tests, three MC cloze
 * texts and three word banks (spec 2026-10-18). Reading: 6 texts with 3 items
 * each (richtig / falsch only, as in ÖSD and telc at B1). Listening: 5 clips
 * with 3 items each, one of them a note-taking task. Writing and speaking:
 * 7 prompts each. Single-choice items have 4 options (Goethe B1
 * uses three; d is an extra wrong distractor); the correct option is given first and placed at `pos`, so the key
 * positions are set explicitly and spread over a, b and c.
 */

const LEVEL = "B1" as const;

type Within = NonNullable<SeedItem["within"]>;
type Pos = 0 | 1 | 2 | 3;

const IDS = ["a", "b", "c", "d"] as const;

function options(correct: string, distractors: [string, string, string], pos: Pos) {
  const texts = [...distractors];
  texts.splice(pos, 0, correct);
  return {
    content: { kind: "CHOICE" as const, options: texts.map((text, i) => ({ id: IDS[i], text })) },
    key: { kind: "CHOICE" as const, correct: [IDS[pos]] },
  };
}

function gapChoices(correct: string, distractors: [string, string], pos: Pos): string[] {
  const texts = [...distractors];
  texts.splice(pos, 0, correct);
  return texts;
}

// ================================================================ GRAMMAR

function choice(
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
    ...options(correct, distractors, pos),
    explanation,
  };
}

/** One gap with a drop-down of three forms. */
function gapSelect(
  skill: string,
  within: Within,
  prompt: string,
  correct: string,
  distractors: [string, string],
  pos: Pos,
  explanation: string,
): SeedItem {
  return {
    section: "GRAMMAR",
    level: LEVEL,
    type: "GAP_FILL",
    skillTag: `grammar.${skill}`,
    within,
    prompt,
    content: { kind: "GAP", gaps: [{ id: "g1", choices: gapChoices(correct, distractors, pos) }] },
    key: { kind: "GAP", answers: { g1: [correct] } },
    explanation,
  };
}

/** One typed gap, used only where a single form is possible. */
function gapTyped(skill: string, within: Within, prompt: string, answers: string[], explanation: string): SeedItem {
  return {
    section: "GRAMMAR",
    level: LEVEL,
    type: "GAP_FILL",
    skillTag: `grammar.${skill}`,
    within,
    prompt,
    content: { kind: "GAP", gaps: [{ id: "g1" }] },
    key: { kind: "GAP", answers: { g1: answers } },
    explanation,
  };
}

const grammarItems: SeedItem[] = [
  // ---------------------------------------------------------------- EASY
  choice("praeteritum", "EASY",
    "Früher ___ meine Kollegin jeden Tag mit dem Fahrrad zur Arbeit.",
    "fuhr", ["fuhren", "fährt", "gefahren"], 1,
    "„fahren“ ist ein starkes Verb, das Präteritum lautet „fuhr“. „fuhren“ passt nicht zu „meine Kollegin“, „fährt“ ist Präsens (aber „früher“), „gefahren“ ist das Partizip und kann allein kein Prädikat sein."),
  choice("passiv.praesens", "EASY",
    "In unserer Firma ___ die Post jeden Morgen um neun Uhr verteilt.",
    "wird", ["werden", "hat", "wurden"], 0,
    "Vorgangspassiv Präsens: werden + Partizip II. „die Post“ ist Singular, also „wird“; „hat“ bildet kein Passiv."),
  choice("infinitiv.umzu", "EASY",
    "Sie spart seit Monaten Geld, ___ im Sommer eine lange Reise zu machen.",
    "um", ["damit", "dass", "weil"], 2,
    "Finalsatz mit Infinitiv: „um ... zu“. „damit“, „dass“ und „weil“ leiten einen Nebensatz mit konjugiertem Verb ein, nicht einen zu-Infinitiv."),
  choice("konnektor.als-wenn", "EASY",
    "___ ich vor drei Jahren nach Hamburg kam, kannte ich dort niemanden.",
    "Als", ["Wenn", "Wann", "Ob"], 1,
    "Ein einmaliges Ereignis in der Vergangenheit verlangt „als“. „wenn“ steht für Wiederholung oder Gegenwart/Zukunft, „wann“ ist ein Fragewort."),
  choice("konjunktiv2", "EASY",
    "Leider habe ich kein Auto. Wenn ich eins ___, könnte ich dich vom Bahnhof abholen.",
    "hätte", ["hatte", "hättest", "wäre"], 0,
    "Irrealer Bedingungssatz (es gibt kein Auto): Konjunktiv II „hätte“. „hatte“ ist Indikativ Präteritum, „hättest“ passt nicht zu „ich“."),
  choice("relativsatz", "EASY",
    "Das ist die Kollegin, ___ ich gestern in der Kantine getroffen habe.",
    "die", ["der", "den", "dem"], 2,
    "„treffen“ verlangt den Akkusativ; Bezugswort feminin („die Kollegin“), also Relativpronomen „die“. „der“ wäre Dativ, „den“ maskulin."),
  gapTyped("reflexivpronomen", "EASY",
    "Ergänzen Sie das fehlende Wort.\n\nIch interessiere {{g1}} sehr für Geschichte, deshalb lese ich viele Bücher darüber.",
    ["mich"],
    "„sich interessieren für“ ist reflexiv. Zu „ich“ gehört das Reflexivpronomen im Akkusativ: „mich“."),
  gapSelect("perfekt.hilfsverb", "EASY",
    "Wählen Sie das passende Wort.\n\nLetzte Woche {{g1}} wir drei Tage in Wien geblieben.",
    "sind", ["haben", "wurden"], 2,
    "„bleiben“ bildet das Perfekt mit „sein“, obwohl es keine Bewegung ausdrückt (wie „sein“ und „werden“); man muss es sich merken: „sind geblieben“. „haben“ ist die falsche Hilfsverbwahl, „wurden“ gehört zum Passiv."),

  // ---------------------------------------------------------------- MID
  choice("plusquamperfekt", "MID",
    "Nachdem wir das Formular ausgefüllt ___, gaben wir es am Schalter ab.",
    "hatten", ["haben", "waren", "hatte"], 0,
    "Hauptsatz im Präteritum, die frühere Handlung im nachdem-Satz steht im Plusquamperfekt. „ausfüllen“ bildet das Perfekt mit „haben“, also „hatten“."),
  choice("passiv.modal", "MID",
    "Die Rechnung muss bis Freitag ___ werden.",
    "bezahlt", ["bezahlen", "bezahlte", "zu bezahlen"], 1,
    "Passiv mit Modalverb: Modalverb + Partizip II + „werden“. Nach „muss“ steht kein Infinitiv, kein zu-Infinitiv und kein Präteritum, sondern das Partizip „bezahlt“."),
  choice("relativsatz.praeposition", "MID",
    "Das ist das Projekt, ___ wir seit Monaten arbeiten.",
    "an dem", ["an das", "dem", "an den"], 2,
    "„arbeiten an + Dativ“: Die Präposition steht vor dem Relativpronomen, „das Projekt“ ist neutral, also „an dem“."),
  gapSelect("konnektor.zweiteilig", "MID",
    "Wählen Sie das passende Wort.\n\nLeider habe ich {{g1}} Zeit noch Geld für einen langen Urlaub.",
    "weder", ["nicht", "kein"], 1,
    "Der zweiteilige Konnektor lautet „weder ... noch“ (= nicht A und nicht B). „noch“ im Satz verlangt „weder“."),
  choice("adjektivdeklination", "MID",
    "Sie wohnt jetzt in einer ___ Wohnung im Stadtzentrum.",
    "kleinen", ["kleine", "kleiner", "kleines"], 0,
    "„in“ + Dativ (wo?), feminin nach unbestimmtem Artikel „einer“: Adjektivendung „-en“."),
  choice("adjektiv.komparativ", "MID",
    "In diesem Jahr war der Sommer viel ___ als im letzten Jahr.",
    "heißer", ["heiß", "heißere", "am heißesten"], 3,
    "Prädikativ (nach „war“) steht der Komparativ ohne Endung: „heißer“. „heiß“ ist die Grundform, „heißere“ hat eine Attributendung, „am heißesten“ ist der Superlativ."),
  choice("pronominaladverb", "MID",
    "Freust du dich schon auf den Urlaub? Ja, ich freue mich sehr ___.",
    "darauf", ["worauf", "dafür", "daran"], 1,
    "„sich freuen auf“ + Sache wird durch „darauf“ ersetzt. „worauf“ ist ein Fragewort, „dafür“ und „daran“ haben die falsche Präposition."),
  choice("genitiv.praeposition", "MID",
    "___ des Regens haben wir einen langen Spaziergang gemacht.",
    "Trotz", ["Obwohl", "Trotzdem", "Weil"], 2,
    "Vor einer Nominalgruppe im Genitiv steht die Präposition „trotz“. „obwohl“ leitet einen Nebensatz ein, „trotzdem“ ist ein Adverb."),
  gapTyped("n-deklination", "MID",
    "Ergänzen Sie das Wort in Klammern in der richtigen Form.\n\nGestern habe ich lange mit unserem neuen {{g1}} (Kollege) gesprochen.",
    ["Kollegen"],
    "„mit“ + Dativ; „Kollege“ gehört zur n-Deklination und bekommt außer im Nominativ Singular die Endung -n: „dem Kollegen“."),

  choice("konnektor.konzessiv", "MID",
    "Er war sehr müde. ___ ging er nach der Arbeit noch ins Fitnessstudio.",
    "Trotzdem", ["Obwohl", "Weil", "Deshalb"], 2,
    "Das Verb steht direkt nach der Lücke (Position 2), also braucht man ein Adverb: „trotzdem“. „obwohl“ und „weil“ verlangen das Verb am Satzende; „deshalb“ nennt eine Folge und passt nicht zum Gegensatz zwischen Müdigkeit und Training."),
  choice("konjunktiv2", "MID",
    "Wenn ich du ___, würde ich das Angebot annehmen.",
    "wäre", ["bin", "war", "würde"], 2,
    "Ratschlag mit irrealer Bedingung: „Wenn ich du wäre, ...“ mit Konjunktiv II von „sein“, passend zu „würde“ im Hauptsatz."),

  // ---------------------------------------------------------------- HARD
  choice("infinitiv.ohnezu", "HARD",
    "Er hat den Vertrag unterschrieben, ___ ihn vorher genau zu lesen.",
    "ohne", ["ohne dass", "damit", "um"], 0,
    "Infinitivkonstruktion „ohne ... zu“. „ohne dass“ und „damit“ verlangen einen Nebensatz mit Subjekt und konjugiertem Verb; „um ... zu“ ergibt hier keinen Sinn."),
  choice("passiv.perfekt", "HARD",
    "Das alte Rathaus ist im Jahr 1890 gebaut ___.",
    "worden", ["geworden", "gewesen", "werden"], 1,
    "Passiv Perfekt: sein + Partizip II + „worden“. Im Passiv verliert das Partizip von „werden“ das ge-."),
  choice("relativsatz.was", "HARD",
    "Er hat die Prüfung beim ersten Mal bestanden, ___ alle überrascht hat.",
    "was", ["das", "dass", "wie"], 0,
    "Bezieht sich der Relativsatz auf den ganzen Hauptsatz, steht „was“. „dass“ hätte hier kein Subjekt, „das“ würde sich auf ein einzelnes Nomen beziehen (etwa „das Mal“), gemeint ist aber der ganze Hauptsatz."),
  choice("konnektor.modal", "HARD",
    "Man kann viel Energie sparen, ___ man abends alle Geräte ganz ausschaltet.",
    "indem", ["damit", "obwohl", "sodass"], 1,
    "„indem“ nennt das Mittel, mit dem etwas erreicht wird (Energie sparen durch Ausschalten). „damit“ nennt ein Ziel, „obwohl“ einen Gegensatz, „sodass“ eine Folge; keiner davon passt zum Sinn."),
  gapSelect("konjunktiv2.vergangenheit", "HARD",
    "Wählen Sie das passende Wort.\n\nWenn ich mehr Zeit gehabt {{g1}}, wäre ich gestern zur Party gekommen.",
    "hätte", ["hatte", "wäre"], 0,
    "Irreale Bedingung in der Vergangenheit: Konjunktiv II der Vergangenheit, „gehabt hätte“ (Hilfsverb „haben“). „hatte“ ist Indikativ und passt nicht zu „wäre“ im Hauptsatz, „wäre“ ist die falsche Hilfsverbwahl."),
  gapTyped("wortbildung", "HARD",
    "Bilden Sie aus dem Verb ein Nomen.\n\nWir müssen unsere Wohnung renovieren. Die {{g1}} dauert ungefähr drei Wochen.",
    ["Renovierung", "Renovation"],
    "Verben auf -ieren bilden das Nomen oft mit -ung: renovieren > die Renovierung (feminin, passt zu „Die“). Die schweizerische Form „Renovation“ wird ebenfalls akzeptiert."),

  // ---------------------------------------------------------------- C-test
  cTest(LEVEL, "MID", {
    first: "Viele Menschen lernen heute neben ihrem Beruf noch eine neue Sprache, zum Beispiel für die Arbeit oder für eine Reise.",
    body:
      "Manche besuchen am Abend einen Kurs in einer Sprachschule, andere lernen lieber mit einer App auf dem Handy. " +
      "Beide Wege haben Vorteile. " +
      "Im Kurs kann man direkt mit anderen Teilnehmern sprechen und bekommt sofort eine Antwort auf seine Fragen.",
    last: "Eine App ist dagegen oft billiger, und man kann sie jederzeit benutzen, zum Beispiel morgens im Bus auf dem Weg zur Arbeit.",
    // g15: gender-inclusive forms are equally correct.
    variants: { 15: ["ehmerinnen", "ehmenden"] },
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["cht"], 2: ["ends"], 3: ["rse"], 4: ["nen"],
      5: ["eren"], 6: ["be"], 7: ["nem"], 9: ["ndys"],
      10: ["gen"], 11: ["eil"], 14: ["ir"], 15: ["ehmer"],
      17: ["ern"], 18: ["worten"], 19: ["inen"],
    },
  }),
  // Joining a sports club.
  cTest(LEVEL, "MID", {
    first: "Seit einem halben Jahr bin ich Mitglied in einem Volleyballverein in meiner Stadt.",
    body:
      "Früher war ich eher unsportlich und habe meine Freizeit am liebsten zu Hause verbracht. " +
      "Dann hat mich eines Tages eine Freundin zu einem Probetraining eingeladen. " +
      "Am Anfang war ich ziemlich nervös, weil alle anderen viel besser spielten als ich.",
    last: "Doch die Gruppe hat mich sofort freundlich aufgenommen, und inzwischen freue ich mich jede Woche auf das Training.",
    // g16 "we...": "wenn" is as correct as "weil"; g17 "and...": "andern" is a standard variant of "anderen".
    variants: { 16: ["nn"], 17: ["ern"] },
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["aren"], 3: ["nter"], 4: ["inen"], 5: ["n"],
      7: ["rachte"], 8: ["abe"], 9: ["nem"], 10: ["nen"],
      12: ["rainings"], 14: ["ird"], 15: ["liche"], 16: ["gen"],
      17: ["ere"], 18: ["te"], 19: ["ber"],
    },
  }),
  // Cycling in the city.
  cTest(LEVEL, "MID", {
    first: "In vielen Städten fahren immer mehr Menschen mit dem Fahrrad zur Schule, zur Arbeit oder zum Einkaufen.",
    body:
      "Das Radfahren ist günstig, gesund und gut für die Umwelt. " +
      "Außerdem muss man keinen Parkplatz suchen und kommt oft schneller ans Ziel. " +
      "Trotzdem fühlen sich viele Menschen im Verkehr nicht sicher, denn in manchen Vierteln gibt es keine Radwege.",
    last: "Deshalb wünschen sich viele Bürgerinnen und Bürger, dass ihre Stadt mehr Geld für breite und sichere Radwege ausgibt.",
    // g10 "schn...": "kommt oft schnell ans Ziel" is as correct as "schneller".
    variants: { 10: ["ell"] },
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["ahrer"], 2: ["stige"], 3: ["nter"], 5: ["elten"],
      6: ["sst"], 7: ["nem"], 9: ["mmen"], 10: ["elle"],
      12: ["lt"], 13: ["elen"], 14: ["n"], 15: ["chts"],
      16: ["r"], 17: ["che"], 19: ["inen"],
    },
  }),
];

// MC cloze texts and word banks (spec 2026-10-18), each set easy to hard.
// Cloze options are real forms of one family (case series, same-stem verbs,
// competing connectors, preposition series), as in the telc Sprachbausteine.
// Word banks mix function words and content words; every distractor is a real
// word of the same class as an answer that nearly fits but fails on word
// order, government or meaning.
const grammarTexts: SeedItem[] = [
  cloze(LEVEL, "EASY", {
    title: "Ein Praktikum im Hotel",
    first: "Im letzten Sommer hat Elif ein Praktikum in einem Hotel am Bodensee gemacht.",
    body:
      "Sie hatte sich schon im Winter [[um|über|an|zu#verb_praeposition]] die Stelle beworben. " +
      "Das Hotel, in [[dem|das|den|der#relativsatz.praeposition]] sie gearbeitet hat, liegt direkt am Wasser. " +
      "Jeden Morgen [[musste|müsste|musstest|muss#praeteritum]] sie schon um sechs Uhr aufstehen, [[weil|denn|deshalb|trotzdem#konnektor]] das Frühstück für die Gäste um sieben Uhr begann. " +
      "Am Anfang hat sie vor allem in der Küche [[geholfen|helfen|half|hilft#perfekt.partizip]]. " +
      "Später durfte sie auch an der Rezeption arbeiten und [[die|den|dem|der#artikel.akkusativ]] Gäste begrüßen. " +
      "Viele Gäste kamen aus der Schweiz oder aus Österreich, und manche haben [[ihr|sie|ihre|ihn#dativ]] viel von ihrer Heimat erzählt. " +
      "Die Arbeit war anstrengend, aber Elif hat [[sich|ihr|ihm|ihnen#reflexiv]] nie gelangweilt. " +
      "Ihre Chefin war [[mit|von|bei|zu#rektion]] ihr sehr zufrieden. " +
      "Am letzten Tag hat sie Elif gefragt, [[ob|dass|wenn|als#nebensatz]] sie im nächsten Sommer wiederkommen möchte. " +
      "Elif [[würde|wurde|würden|geworden#konjunktiv2]] sehr gern zurückkommen, aber im nächsten Sommer muss sie ihre Abschlussprüfungen schreiben.",
    last: "Mit zwei Kolleginnen aus dem Hotel schreibt sie sich bis heute regelmäßig Nachrichten.",
    note: "sich bewerben um (g1), Relativpronomen nach Präposition (g2), Modalverb im Präteritum (g3), weil mit Verb am Ende gegen denn, deshalb, trotzdem (g4), Partizip II (g5), bestimmter Artikel im Akkusativ Plural (g6), erzählen + Dativ (g7), Reflexivpronomen (g8), zufrieden mit (g9), indirekte Frage mit ob (g10), höflicher Wunsch im Konjunktiv II (g11).",
  }),
  cloze(LEVEL, "MID", {
    title: "Die Wohnungssuche",
    first: "Seit drei Monaten suchen Jana und Tobias eine größere Wohnung in Leipzig.",
    body:
      "Sie brauchen ein zusätzliches Zimmer, [[weil|denn|deshalb|damit#konnektor]] im Herbst ihr erstes Kind auf die Welt kommt. " +
      "[[Jedes|Jeden|Jedem|Jeder#akkusativ]] Wochenende sehen sie sich Wohnungen an, die sie im Internet gefunden haben. " +
      "Leider sind die meisten Angebote entweder zu teuer [[oder|und|aber|sondern#konnektor.zweiteilig]] zu klein. " +
      "Letzten Samstag haben sie eine Altbauwohnung besichtigt, in [[die|der|dem|das#relativsatz.praeposition]] sie sich sofort verliebt haben. " +
      "Die Wohnung liegt in [[einer|einem|eine|einen#wechselpraeposition]] ruhigen Seitenstraße und hat einen großen Balkon. " +
      "Die Vermieterin war sehr nett und hat ihnen alle Räume [[gezeigt|zeigte|zeigen|zeigt#perfekt.partizip]]. " +
      "Jana fragte, [[ob|dass|wenn|was#nebensatz]] Haustiere erlaubt sind, denn sie haben eine Katze. " +
      "Die Vermieterin hatte nichts dagegen, aber [[viele|vielen|vieler|vieles#adjektivendung]] andere Paare wollten die Wohnung auch haben. " +
      "Deshalb [[haben|sind|werden|hat#perfekt.hilfsverb]] Jana und Tobias am Abend noch eine freundliche E-Mail an die Vermieterin geschrieben. " +
      "Darin stand, dass sie sich sehr freuen [[würden|wurden|wären|würdet#konjunktiv2]], wenn sie die Wohnung bekommen könnten. " +
      "Zwei Tage später kam endlich die Antwort, [[auf|für|an|nach#verb_praeposition]] die sie so ungeduldig gewartet hatten.",
    last: "Die Vermieterin hat sich für die beiden entschieden, und im Juni ziehen sie ein.",
    note: "weil mit Verb am Ende gegen damit, denn, deshalb (g1), Kasusreihe jeder (g2), entweder ... oder (g3), Relativpronomen im Akkusativ nach in (g4), Wechselpräposition mit Dativ (g5), Partizip II (g6), indirekte Frage mit ob (g7), Indefinitpronomen als Artikel (g8), Hilfsverb im Perfekt (g9), Konjunktiv II mit würde (g10), warten auf im Relativsatz (g11).",
  }),
  cloze(LEVEL, "HARD", {
    title: "Ärger mit der Heizung",
    first: "Mitte Dezember ist in der Wohnung von Herrn Yilmaz plötzlich die Heizung ausgefallen.",
    body:
      "Weil es draußen sehr kalt war, rief er sofort [[bei|an|zu|mit#rektion]] der Hausverwaltung an. " +
      "Eine Mitarbeiterin versprach, [[ihm|ihn|sein|er#dativ]] noch am selben Tag einen Techniker zu schicken. " +
      "Doch am Abend war immer noch niemand [[gekommen|kommen|kam|kommt#plusquamperfekt]]. " +
      "Herr Yilmaz schrieb deshalb eine E-Mail, in [[der|die|dem|den#relativsatz.praeposition]] er [[sich|sie|ihm|ihn#reflexiv]] über den schlechten Service beschwerte. " +
      "Am nächsten Morgen [[wurde|würde|hat|worden#passiv]] die Heizung endlich repariert. " +
      "Der Techniker war sehr freundlich und entschuldigte sich für [[die|der|dem|den#praeposition]] Verspätung. " +
      "Ein kleines Teil war kaputt, [[deshalb|weil|denn|obwohl#konnektor]] funktionierte die ganze Heizung nicht. " +
      "[[Wenn|Als|Ob|Dass#konjunktiv2.vergangenheit]] Herr Yilmaz die Nummer des Notdienstes gehabt hätte, hätte er dort sofort [[angerufen|anrufen|anruft|rief#konjunktiv2.vergangenheit]]. " +
      "Als Entschuldigung [[bot|bat|boten|geboten#trennbares_verb]] ihm die Hausverwaltung für Dezember eine kleine Mietminderung an.",
    last: "Damit war Herr Yilmaz am Ende einigermaßen zufrieden.",
    note: "bei jemandem anrufen (g1), schicken + Dativ (g2), Plusquamperfekt (g3), Relativpronomen nach in im Dativ (g4), Reflexivpronomen bei sich beschweren (g5), Passiv im Präteritum (g6), für + Akkusativ (g7), deshalb mit Inversion gegen weil, denn, obwohl (g8), Konjunktion des irrealen Bedingungssatzes (g9), Partizip II im Konjunktiv II der Vergangenheit (g10), trennbares Verb im Präteritum (g11).",
  }),
  wordBank(LEVEL, "EASY", {
    title: "Der erste Arbeitstag",
    first: "Am Montag hat Sofia als Bürokauffrau in einer Spedition angefangen.",
    body:
      "Sie war sehr [[aufgeregt#vocabulary]] und ist [[deshalb#konnektor]] schon um halb acht losgefahren. " +
      "Am Empfang hat ein freundlicher Kollege sie begrüßt und ihr das Gebäude gezeigt. " +
      "Ihr [[Schreibtisch#vocabulary]] steht in einem hellen Büro [[neben#praeposition]] der Kaffeeküche. " +
      "Am Vormittag musste Sofia viele [[Formulare#plural]] ausfüllen, [[bevor#vocabulary]] sie ihren eigenen Computer bekam. " +
      "Am Nachmittag durfte sie schon die ersten [[Kunden#plural]] am Telefon beraten. " +
      "Wenn sie eine Frage hatte, konnte sie jederzeit ihre Kollegin Frau Brandt [[fragen#modalverb.satzklammer]]. " +
      "Um vier Uhr war ihr erster Arbeitstag zu Ende.",
    last: "Am Abend hat sie ihren Eltern erzählt, dass ihr die neue Stelle sehr gut gefällt.",
    distractors: ["denn", "ob", "durch", "Büros", "gefragt"],
    note: "deshalb mit Inversion gegen denn (g2), neben + Dativ gegen durch (g4), bevor gegen ob (g6), Infinitiv gegen Partizip (g8).",
  }),
  wordBank(LEVEL, "MID", {
    title: "Ein Kochkurs für Anfänger",
    first: "Weil Daniel nicht mehr jeden Abend Fertiggerichte essen wollte, hat er sich für einen Kochkurs an der Volkshochschule angemeldet.",
    body:
      "Der Kurs findet jeden Donnerstag in einer großen [[Küche#vocabulary]] im Erdgeschoss statt. " +
      "Die Gruppe besteht aus zwölf Teilnehmern, [[von#relativsatz.praeposition]] denen die meisten Anfänger sind. " +
      "Der Kursleiter ist ein ehemaliger Koch, [[der#relativsatz]] jede Frage geduldig beantwortet. " +
      "Am ersten Abend haben sie gelernt, wie man Zwiebeln richtig [[schneidet#nebensatz]]. " +
      "Danach haben sie zusammen eine Gemüsesuppe gekocht, die allen sehr gut [[geschmeckt#perfekt.partizip]] hat. " +
      "Daniel war überrascht, wie [[einfach#adjektiv]] manche Gerichte eigentlich sind. " +
      "Nach jedem Abend bekommen die Teilnehmer die Rezepte, [[damit#konnektor]] sie zu Hause weiter üben können. " +
      "Inzwischen lädt Daniel am Wochenende manchmal Freunde zum [[Essen#vocabulary]] ein.",
    last: "Seine Freunde finden, dass er schon viel besser kocht als am Anfang.",
    distractors: ["mit", "dem", "geschnitten", "deshalb", "Herd"],
    note: "Präposition mit Dativ nach Partizip-Relativsatz (g2), Relativpronomen im Nominativ gegen Dativ (g3), finites Verb im Nebensatz gegen Partizip (g4), damit mit Verb am Ende gegen deshalb (g7).",
  }),
  wordBank(LEVEL, "HARD", {
    title: "Die Bewerbung",
    first: "Nach ihrer Ausbildung zur Pflegefachfrau wollte Nadine in eine andere Stadt ziehen und hat sich deshalb bei mehreren Kliniken beworben.",
    body:
      "Ihr Lebenslauf war schon zwei Jahre alt, [[deshalb#konnektor]] hat sie ihn sorgfältig überarbeitet. " +
      "Zu jeder Bewerbung hat sie außerdem ein persönliches [[Anschreiben#vocabulary]] verfasst. " +
      "Nach zwei Wochen bekam sie eine [[Einladung#vocabulary]] zu einem Vorstellungsgespräch in Hamburg. " +
      "Sie hat sich gründlich [[auf#verb_praeposition]] das Gespräch vorbereitet, [[weil#konnektor]] sie die Stelle unbedingt haben wollte. " +
      "Im Gespräch hat Nadine ehrlich geantwortet, [[ohne#infinitiv.ohnezu]] dabei zu übertreiben. " +
      "Am Ende hat sie selbst nach dem [[Gehalt#vocabulary]] gefragt, das in der Pflege oft nicht besonders hoch ist. " +
      "Eine Woche später rief die Klinik an und gab ihr die [[Zusage#vocabulary]] für die Stelle.",
    last: "Im Oktober fängt Nadine in Hamburg an und freut sich schon sehr auf die neue Aufgabe.",
    distractors: ["denn", "über", "um", "Lebenslauf", "dass"],
    note: "deshalb mit Inversion gegen weil und denn (g1, g5), sich vorbereiten auf (g4), ohne ... zu gegen um ... zu (g6).",
  }),

  // ---- Sprachbausteine-15: ten gaps, fifteen words (five distractors of the same family).
  // Family: prepositions. Every gap is fixed by a verb, a time expression or the case of its noun group.
  wordBank(LEVEL, "MID", {
    title: "Ein Tag im Kletterwald",
    first: "Letzten Samstag sind wir mit der ganzen Familie in einen Kletterwald gefahren.",
    body:
      "Wir sind [[um#praeposition.zeit]] sieben Uhr losgefahren und waren [[nach#praeposition.zeit]] einer Stunde am Ziel. " +
      "Der Weg zum Eingang führte [[durch#praeposition]] einen schmalen Tunnel unter der Straße. " +
      "Alle Kinder müssen [[mit#praeposition]] einem Helm klettern, und Erwachsene dürfen nicht [[ohne#praeposition]] Sicherheitsgurt in die Bäume steigen. " +
      "Mein Bruder klettert [[seit#praeposition.zeit]] drei Jahren in seiner Freizeit und kennt die Regeln gut. " +
      "Meine Schwester hat sich vorher lange [[über#verb_praeposition]] die Sicherheit informiert, weil sie Angst vor großer Höhe hat. " +
      "Meine Mutter hat die ganze Zeit [[auf#verb_praeposition]] die Kleinen aufgepasst. " +
      "Am Ende haben wir uns [[bei#verb_praeposition]] den Trainern [[für#verb_praeposition]] ihre Hilfe bedankt.",
    last: "Zum Abschied haben die Kinder gefragt, ob wir bald wiederkommen.",
    distractors: ["aus", "von", "zu", "wegen", "bis"],
    note: "Präpositionen: Uhrzeit, Zeitdauer, Richtung mit Akkusativ, feste Verbindungen (sich informieren über, aufpassen auf, sich bedanken bei und für); Distraktoren: Präpositionen, die in keine Lücke passen.",
  }),
  // Family: connectors. Word order and tense fix each gap (verb at the end, verb in second place, event order).
  wordBank(LEVEL, "MID", {
    title: "Eine Radtour mit Hindernissen",
    first: "Am Sonntag wollten Paula und ihr Mann mit den Kindern eine lange Radtour am Fluss machen.",
    body:
      "Paula hat belegte Brote gemacht, [[damit#konnektor]] die Kinder unterwegs nicht hungrig werden. " +
      "Das Wetter war schön, [[deshalb#konnektor]] sind alle schon um neun Uhr losgefahren. " +
      "Nach zwanzig Kilometern wurde der Himmel dunkel, [[obwohl#konnektor.konzessiv]] der Wetterbericht keinen Regen angekündigt hatte. " +
      "Der Regen wurde stärker, aber die Kinder wollten [[trotzdem#konnektor.konzessiv]] weiterfahren. " +
      "Paula wollte lieber umkehren, [[weil#konnektor]] ihr Mann seit dem Morgen Halsschmerzen hatte. " +
      "Ihr Mann sagte, [[dass#nebensatz]] eine heiße Suppe jetzt das Beste wäre. " +
      "Die Kinder fragten, [[ob#nebensatz]] es im nächsten Dorf ein Café gibt. " +
      "Im Café bestellten sie Suppe und Kakao, [[während#konnektor]] draußen der Regen gegen die Fenster klopfte. " +
      "Der Regen hörte erst auf, [[nachdem#konnektor]] sie zwei Stunden im Café gesessen hatten. " +
      "Dann kam sogar die Sonne heraus, [[sodass#konnektor]] sie den Rückweg ohne Regenjacke fahren konnten.",
    last: "Am Abend waren alle müde, aber auch ein bisschen stolz.",
    distractors: ["denn", "sondern", "falls", "bevor", "seitdem"],
    note: "Konnektoren: Verb am Ende (weil, damit, obwohl, dass, ob, während, nachdem, sodass) gegen Verb in Position 2 (deshalb, trotzdem); Distraktoren: denn, sondern, falls, bevor, seitdem passen in keine Lücke.",
  }),
  // Family: da-compounds. The verb in each sentence fixes the preposition.
  wordBank(LEVEL, "HARD", {
    title: "Gemeinsam gärtnern in der Straße",
    first: "In unserer Straße gibt es seit dem Frühjahr einen kleinen Gemeinschaftsgarten.",
    body:
      "Alle freuen sich [[darauf#praepositionaladverb]], im Sommer die ersten Tomaten zu ernten. " +
      "Eine Gruppe von Freiwilligen kümmert sich [[darum#praepositionaladverb]], dass die Beete genug Wasser bekommen. " +
      "Die Stadt sorgt [[dafür#praepositionaladverb]], dass wir Wasser aus einem Brunnen holen dürfen. " +
      "Am Anfang hat niemand [[damit#praepositionaladverb]] gerechnet, dass so viele Leute mitmachen würden. " +
      "Zur Eröffnung gab es ein kleines Fest, und alle Nachbarn konnten [[daran#praepositionaladverb]] teilnehmen. " +
      "Nur ein älterer Herr war zuerst [[dagegen#praepositionaladverb]], weil er mehr Lärm befürchtete. " +
      "Inzwischen gehört er selbst [[dazu#praepositionaladverb]] und gießt jeden Morgen die Pflanzen. " +
      "Die Kinder helfen gern [[dabei#praepositionaladverb]], neue Blumen zu pflanzen. " +
      "Letzte Woche haben wir uns [[darüber#praepositionaladverb]] geärgert, dass jemand Salat gestohlen hat. " +
      "Was halten Sie [[davon#praepositionaladverb]], uns einmal zu besuchen?",
    last: "Wer Lust hat, kann jederzeit vorbeikommen und einfach mitmachen.",
    distractors: ["darin", "daneben", "dahinter", "davor", "dazwischen"],
    note: "Präpositionaladverbien: Das Verb oder Adjektiv legt die Präposition fest (sich freuen auf, sich kümmern um, sorgen für, rechnen mit, teilnehmen an, gegen sein, gehören zu, helfen bei, sich ärgern über, halten von); Distraktoren sind örtliche da-Wörter ohne passende Lücke.",
  }),
];

// ================================================================ READING

type ReadingSkill = "gist" | "detail" | "inference" | "vocabulary" | "structure";

const readingText = (key: string, title: string, topic: string, body: string): SeedStimulus => ({
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
      return { ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...options(correct, distractors, pos) };
    },
    /** Richtig / Falsch only, as in ÖSD and telc at B1. */
    tfng(
      skill: ReadingSkill,
      within: Within,
      statements: Array<[string, TfngValue]>,
      explanation: string,
      prompt = READING_RF,
    ): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", twoWay: true, statements: statements.map(([text], i) => ({ id: `s${i + 1}`, text })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, v], i) => [`s${i + 1}`, v])) },
      };
    },
    /** Ja / Nein wording (B1 and up): stored as R (Ja) and F (Nein). */
    jaNein(
      skill: ReadingSkill,
      within: Within,
      statements: Array<[string, TfngValue]>,
      explanation: string,
      prompt = READING_YES_NO,
    ): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", twoWay: true, wording: "JA_NEIN", statements: statements.map(([text], i) => ({ id: `s${i + 1}`, text })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, v], i) => [`s${i + 1}`, v])) },
      };
    },
    match(
      skill: ReadingSkill,
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

// ---- Text 1: personal email

const rEmail = readingText(
  "v2-r-b1-neue-stelle",
  "Eine E-Mail von Amira",
  "Arbeit",
  `
Lieber Jonas,

entschuldige, dass ich mich so lange nicht gemeldet habe. Seit dem ersten März arbeite ich bei einer Firma, die Fahrräder herstellt, und die ersten Wochen waren ziemlich anstrengend. Ich bin im Kundenservice und beantworte Anfragen von Fahrradgeschäften, vor allem am Telefon. Am Anfang hatte ich ein bisschen Angst vor diesen Gesprächen, weil die Kunden oft sehr schnell sprechen und viele Fachwörter benutzen. Inzwischen geht es aber viel besser.

Meine Kolleginnen und Kollegen sind sehr nett. In der ersten Woche hat mir eine erfahrene Kollegin, Frau Petrović, alles gezeigt. Sie arbeitet schon seit fünfzehn Jahren in der Firma und kennt jedes Produkt. Wenn ich eine Frage habe, kann ich immer zu ihr kommen. Das hilft mir sehr.

Was mir weniger gefällt, ist der Weg zur Arbeit. Die Firma liegt am Stadtrand, und mit Bus und Bahn brauche ich fast eine Stunde. Deshalb überlege ich, ob ich mir ein E-Bike kaufe. Mitarbeiter bekommen nämlich einen günstigen Preis, und mit dem Rad wäre ich in vierzig Minuten da. Außerdem hätte ich dann jeden Tag ein bisschen Bewegung.

Im Herbst soll ich an einer Weiterbildung teilnehmen. Dort lerne ich, wie man Reklamationen bearbeitet, also Beschwerden von Kunden. Ich bin gespannt, denn das ist für mich ein ganz neues Thema.

Und wie geht es dir? Hast du die Stelle in Leipzig bekommen, von der du mir im Winter erzählt hast? Wenn du im Sommer Zeit hast, kannst du mich gern besuchen. Dann zeige ich dir die Stadt, und vielleicht machen wir zusammen eine Radtour.

Liebe Grüße
Amira
`,
);
const email = forText(rEmail.key);

// ---- Text 2: press report

const rArtikel = readingText(
  "v2-r-b1-deutschkurs-betrieb",
  "Deutsch lernen in der Arbeitszeit",
  "Aus- und Weiterbildung",
  `
Deutsch lernen in der Arbeitszeit

Bei der Firma Nordlicht Logistik arbeiten 180 Mitarbeiterinnen und Mitarbeiter, im Lager, im Büro und im Fahrdienst. Viele von ihnen sprechen zu Hause eine andere Sprache als Deutsch, und im Arbeitsalltag führt das manchmal zu Missverständnissen.

Seit einem Jahr bietet die Firma einen eigenen Deutschkurs an. Zweimal pro Woche kommt eine Lehrerin ins Haus, und der Unterricht findet in der Arbeitszeit statt. „Nach einem langen Arbeitstag noch abends in einen Kurs zu gehen, ist für viele unmöglich“, erklärt Personalleiterin Sandra Meyer. „Viele haben Kinder oder einen zweiten Job. Deshalb haben wir den Kurs in den Arbeitstag gelegt.“ Die Gruppe hat acht Plätze, und das Interesse ist groß: Für den nächsten Kurs gibt es schon eine Warteliste.

Im Unterricht geht es nicht um Grammatik aus dem Lehrbuch, sondern um die Sprache, die man im Lager wirklich braucht: Sicherheitsregeln, Gespräche mit Fahrern, Formulare. Die Teilnehmer bringen oft auch eigene Fragen aus dem Alltag mit, zum Beispiel einen Brief vom Vermieter.

Am Anfang waren nicht alle Abteilungsleiter begeistert. Wenn acht Leute zwei Stunden fehlen, muss die Arbeit anders verteilt werden. Inzwischen sehen das die meisten anders. „Es gibt weniger Missverständnisse und weniger Fehler bei den Lieferungen“, sagt Lagerleiter Thomas Berger. „Das spart am Ende Zeit.“

Auch für die Teilnehmer hat sich viel verändert. Jusuf Haddad, der seit zwei Jahren im Lager arbeitet, hat mit Hilfe des Kurses eine wichtige Prüfung für seine Arbeit bestanden. „Vorher habe ich die Fragen gar nicht verstanden“, erzählt er. Nächstes Jahr möchte er sich als Schichtleiter bewerben.

Die Kosten für den Kurs trägt die Firma. Ganz billig ist das nicht, aber Sandra Meyer ist sicher, dass sich das Geld lohnt: „Wer sich bei uns wohlfühlt, bleibt auch länger.“ Im Herbst soll ein zweiter Kurs für Fortgeschrittene beginnen.
`,
);
const artikel = forText(rArtikel.key);

// ---- Text 3: ads, matching with "no ad fits"

const rAnzeigen = readingText(
  "v2-r-b1-kursanzeigen",
  "Kurse und Angebote für den Beruf",
  "Arbeitssuche und Weiterbildung",
  `
A  Computerkurs für Einsteiger
Word, Excel und E-Mail ohne Stress. Sechs Abende, immer dienstags von 18 bis 20 Uhr. Kleine Gruppen mit höchstens acht Personen. Bildungszentrum Mitte.

B  Fotostudio Klick
Professionelle Bewerbungsfotos in 15 Minuten, ohne Termin. Montag bis Samstag von 9 bis 19 Uhr.

C  Bewerbungsberatung
Wir lesen Ihren Lebenslauf und Ihr Anschreiben und geben Ihnen Tipps. Persönlich in unserem Büro oder online per Video. Für Arbeitssuchende kostenlos, bitte vereinbaren Sie einen Termin.

D  Deutsch für den Beruf (B1 bis B2)
Mit Kunden sprechen, E-Mails schreiben, an Besprechungen teilnehmen. Intensivkurs vormittags, Montag bis Freitag, vier Wochen lang.

E  Erste-Hilfe-Kurs
Was tun bei einem Unfall? Ein Tag, Samstag von 9 bis 17 Uhr. Viele Arbeitgeber verlangen diese Bescheinigung.

F  Englisch am Wochenende
Konversationskurs für Leute mit Grundkenntnissen. Samstags von 10 bis 13 Uhr. Die erste Stunde ist kostenlos.

G  Übersetzungsbüro Lingua
Offizielle Übersetzungen Ihrer Zeugnisse und Diplome für Behörden und Arbeitgeber. Über 30 Sprachen, schnell und zuverlässig.

H  Online-Kurs Buchhaltung
Lernen Sie in Ihrem eigenen Tempo, wann und wo Sie wollen. Zwölf Wochen Zugang, am Ende bekommen Sie ein Zertifikat.
`,
);
const anzeigen = forText(rAnzeigen.key);
const ADS = [
  "Anzeige A",
  "Anzeige B",
  "Anzeige C",
  "Anzeige D",
  "Anzeige E",
  "Anzeige F",
  "Anzeige G",
  "Anzeige H",
  "Keine Anzeige passt",
];

// ---- Text 4: terms and rules

const rRegeln = readingText(
  "v2-r-b1-teilnahmebedingungen",
  "Teilnahmebedingungen einer Sprachschule",
  "Sprachkurs und Anmeldung",
  `
Teilnahmebedingungen der Sprachschule Wortwerk

1. Anmeldung
Sie können sich online, telefonisch oder persönlich im Sekretariat anmelden. Die Anmeldung ist erst gültig, wenn Sie die Kursgebühr bezahlt haben. Bitte überweisen Sie den Betrag spätestens eine Woche vor Kursbeginn.

2. Einstufung
Wenn Sie schon Deutsch können, machen Sie vor der Anmeldung einen kostenlosen Einstufungstest. So finden wir den passenden Kurs für Sie. Der Test dauert etwa 45 Minuten und ist auch online möglich.

3. Abmeldung
Bis zehn Tage vor Kursbeginn können Sie sich kostenlos abmelden. Danach behalten wir eine Bearbeitungsgebühr von 50 Euro. Nach Kursbeginn zahlen wir nichts mehr zurück. Wenn Sie aber eine Person finden, die Ihren Platz übernimmt, entstehen Ihnen keine Kosten.

4. Fehlzeiten
Wer an mindestens 80 Prozent der Unterrichtsstunden teilnimmt, bekommt am Ende eine Teilnahmebescheinigung. Verpasste Stunden können nicht nachgeholt werden. Die Materialien jeder Stunde finden Sie aber in unserem Online-Kursraum.

5. Ausfall
Wenn sich weniger als sechs Personen anmelden, kann der Kurs nicht stattfinden. In diesem Fall informieren wir Sie spätestens drei Tage vor Kursbeginn und zahlen die ganze Gebühr zurück. Fällt eine Stunde aus, weil die Lehrkraft krank ist, wird sie am Ende des Kurses nachgeholt.

6. Prüfungen
Die Gebühr für eine Prüfung ist nicht in der Kursgebühr enthalten.
`,
);
const regeln = forText(rRegeln.key);

// ---- Text 5: forum post

const rForum = readingText(
  "v2-r-b1-nachbarschaftsforum",
  "Ein Beitrag im Nachbarschaftsforum",
  "Wohnen",
  `
Nachbarschaftsforum: Wer hat einen Rat bei Lärm?

Von Svenja, gestern, 21:14 Uhr

Hallo zusammen, ich wohne seit einem Jahr im dritten Stock, und eigentlich gefällt es mir hier sehr gut. Nur ein Problem nervt mich: Seit zwei Monaten spielt jemand aus dem Haus fast jeden Abend nach zehn Uhr Schlagzeug. Zuerst habe ich gedacht, dass das nur ein paar Mal vorkommt, aber inzwischen kann ich oft nicht einschlafen. Ich möchte keinen Streit anfangen, denn ich kenne die Leute noch nicht gut. Einen Zettel an die Haustür zu hängen, finde ich unfreundlich. Die Hausverwaltung möchte ich auch nicht anrufen, weil das schnell sehr streng wirken kann. Was würdet ihr an meiner Stelle tun? Und wisst ihr, ab wann nachts in unserer Stadt Ruhe sein muss?

Antwort von Marko: Ich würde einfach klingeln und freundlich fragen. Meistens wissen die Leute gar nicht, dass man sie so deutlich hört. Die Nachtruhe beginnt in den meisten Häusern um 22 Uhr, aber schau bitte in deine Hausordnung.
`,
);
const forum = forText(rForum.key);

// ---- Text 6: short news items, matching with headlines

const rNews = readingText(
  "v2-r-b1-kurznachrichten",
  "Kurznachrichten aus der Region",
  "Stadt und Umwelt",
  `
Kurznachrichten aus der Region

Text 1
Der Stadtpark bekommt im Frühjahr eine neue Wiese für Insekten. Statt Rasen sollen dort ab dem Sommer Wildblumen blühen. Freiwillige können am 12. April beim Säen helfen. Werkzeug ist vorhanden, gute Schuhe sollte man selbst mitbringen.

Text 2
Wegen Bauarbeiten an der Brücke über den Fluss fahren die Linien 4 und 7 zwei Wochen lang nicht in die Innenstadt. Ein Ersatzbus hält an allen wichtigen Stellen. Die Fahrt dauert etwa zehn Minuten länger als sonst.

Text 3
Die Stadtbibliothek verlängert ihre Öffnungszeiten. Vom 1. Mai an ist sie auch donnerstags bis 20 Uhr geöffnet. Viele Studierende und Berufstätige hatten sich das gewünscht, weil sie tagsüber keine Zeit zum Lernen haben.

Text 4
Der Fußballverein Eintracht Süd sucht dringend Trainer für seine Nachwuchsmannschaften. Wer Spaß am Training hat, bekommt eine Schulung vom Verband bezahlt. Interessierte melden sich beim Verein.
`,
);
const news = forText(rNews.key);

// ---- Text 7: forum post (Ja / Nein)

const rHund = readingText(
  "v3-r-b1-hund-forum",
  "Ein Hund für unsere Familie?",
  "Haustiere",
  `
Forum Haustiere: Ein Hund für unsere Familie?

Von Tamara, heute, 09:40 Uhr

Hallo zusammen, unsere beiden Kinder (acht und elf Jahre alt) wünschen sich seit Langem einen Hund. Mein Mann und ich sind noch nicht sicher. Wir wohnen in einer Mietwohnung im zweiten Stock, aber der Vermieter hat nichts dagegen, solange der Hund nicht den ganzen Tag bellt. Ich arbeite halbtags, mein Mann ist meistens ab 17 Uhr zu Hause. Ich habe Angst, dass die Kinder nach ein paar Wochen keine Lust mehr haben und dann alles an mir hängen bleibt. Eigentlich hatte ich an einen Hund aus dem Tierheim gedacht, weil viele Tiere dort ein neues Zuhause verdient haben. Mein Mann meint dagegen, ein Welpe vom Züchter sei leichter zu erziehen. Was sind eure Erfahrungen?

Antwort von Rolf: Wir haben seit fünf Jahren einen Hund aus dem Tierheim und sind sehr glücklich damit. Lasst euch vorher gut beraten, die Mitarbeiter dort kennen die Tiere genau. Und eure Kinder sollten wissen: Ein Hund bedeutet auch Pflichten, nicht nur Spaß.
`,
);
const hund = forText(rHund.key);

// ---- Text 8: letter to the editor (Ja / Nein)

const rMarkt = readingText(
  "v3-r-b1-wochenmarkt-leserbrief",
  "Leserbrief zum Wochenmarkt",
  "Stadt und Einkaufen",
  `
Leserbrief: Der Wochenmarkt muss im Zentrum bleiben

Zum Artikel „Wochenmarkt soll auf den Parkplatz am Stadtrand ziehen“ vom 3. Oktober

Sehr geehrte Damen und Herren,

mit Erstaunen habe ich gelesen, dass der Wochenmarkt vom Marktplatz auf den Parkplatz am Stadtrand verlegt werden soll. Ich gehe seit über zwanzig Jahren jeden Samstag auf den Markt, und ich bin nicht der Einzige. Viele ältere Menschen aus unserer Straße kaufen dort ein, weil sie nur einen kurzen Weg haben. Am Stadtrand müssten sie einen Bus nehmen, der samstags nur alle vierzig Minuten fährt.

Die Stadt sagt, auf dem Marktplatz sei im Sommer wegen der Cafés zu wenig Platz. Da hat die Stadt nicht ganz unrecht. Aber dann sollte man die Tische der Cafés verkleinern und nicht den Markt wegschicken. Ich schlage vor, dass die Händler und die Stadt zuerst gemeinsam nach einer Lösung suchen. Erst danach sollte der Gemeinderat entscheiden.

Mit freundlichen Grüßen
Walter Hofmann
`,
);
const markt = forText(rMarkt.key);

// ---- Text 9: personal letter (Ja / Nein)

const rChor = readingText(
  "v3-r-b1-chor-einladung",
  "Eine Einladung zur Chorprobe",
  "Musik und Freizeit",
  `
Liebe Marta,

danke für deine Nachricht! Ich freue mich, dass du dich für unseren Chor interessierst. Wir treffen uns jeden Mittwoch um 19 Uhr im Gemeindehaus in der Lindenstraße, und die Probe dauert etwa zwei Stunden. Du musst keine Noten lesen können: Die meisten von uns lernen die Lieder nach Gehör, und unsere Leiterin spielt jede Stimme auf dem Klavier vor. Ich selbst habe erst mit vierzig angefangen und bereue es bis heute nicht.

Im Dezember singen wir bei einem Weihnachtskonzert in der Kirche, und im Mai fahren wir als Chor für ein Wochenende nach Dresden. Der Beitrag beträgt acht Euro im Monat, aber die erste Probe ist für dich gratis. Komm doch einfach am nächsten Mittwoch vorbei. Wenn du nicht allein kommen möchtest, hole ich dich gern vor der Tür ab. Sag mir nur kurz Bescheid.

Viele Grüße
Henrik
`,
);
const chor = forText(rChor.key);

// ---- Text 10: who says what, a free Sunday

const rSonntag = readingText(
  "v3-r-b1-sonntag-meinungen",
  "Wie verbringen Sie einen freien Sonntag?",
  "Freizeit am Sonntag",
  `
Wie verbringen Sie am liebsten einen freien Sonntag? Fünf Leserinnen und Leser antworten.

Anna: Bei mir muss am Sonntag alles ruhig sein. Ich schlafe lange, koche in Ruhe und lese ein Buch. Ich verabrede mich nie, denn die Woche ist laut genug. Nur am Nachmittag gehe ich eine Stunde spazieren, aber immer allein.

Bernd: Ohne Sport geht bei mir nichts. Sonntags spiele ich mit Freunden Fußball, danach grillen wir zusammen. Zu Hause zu bleiben finde ich langweilig. Allerdings gebe ich zu, dass ich abends meistens zu müde für alles andere bin.

Clara: Sonntag ist bei uns Familientag. Wir frühstücken zusammen, und dann machen wir alle gemeinsam etwas: ein Museum, einen Ausflug oder einen Spieleabend. Meine Kinder entscheiden abwechselnd, was wir machen. Was ich schade finde: Der Tag ist immer so schnell vorbei.

Dennis: Ich nutze den Sonntag für Dinge, für die ich unter der Woche keine Zeit habe: Wäsche, Einkauf, Aufräumen. Das klingt nicht sehr schön, aber danach fühle ich mich gut, weil ich mit einer leeren Liste in die neue Woche starte. Am Abend treffe ich manchmal Freunde im Café.

Eva: Bei mir ist Sonntag ein ganz normaler Tag, denn ich helfe im Restaurant meiner Eltern. Das macht mir Spaß, auch wenn ich am Montag dann oft müde bin.
`,
);
const sonntag = forText(rSonntag.key);

// ---- Text 11: who says what, city or country

const rWohnen = readingText(
  "v3-r-b1-stadt-oder-land",
  "Stadt oder Land?",
  "Wohnen in Stadt und Land",
  `
Stadt oder Land? Fünf Menschen erzählen, wo sie am liebsten wohnen.

Franka: Ich bin vor drei Jahren aufs Land gezogen und würde nie zurückgehen. Mein Garten ist mir wichtiger als jedes Café. Nur das Auto nervt mich: Ohne eins kommt man hier kaum zum Arzt oder zum Einkaufen.

Gero: Ich liebe die Stadt, weil immer etwas los ist. Kino, Konzerte, Restaurants: Alles ist zu Fuß erreichbar. Dafür zahle ich gern mehr Miete, auch wenn meine Wohnung klein ist.

Hülya: Ich bin auf einem Dorf aufgewachsen und zum Studium in die Stadt gezogen. Heute bin ich unsicher. Die Stadt ist praktisch, aber ich vermisse die Ruhe und dass man seine Nachbarn kennt.

Ivo: Mir ist es ziemlich egal, wo ich wohne. Hauptsache, der Weg zur Arbeit ist kurz und die Wohnung nicht zu teuer. Im Moment wohne ich am Stadtrand, und das passt gut.

Jana: Mit Kindern ist das Land für mich ideal. Draußen können sie allein spielen, und die Schule ist im Nachbardorf. Allerdings sehe ich, seit wir aufs Land gezogen sind, meine Freunde aus der Stadt nur noch selten, weil sie kaum zu Besuch kommen.
`,
);
const wohnen = forText(rWohnen.key);

// ---- Text 12: who says what, holidays

const rUrlaub = readingText(
  "v3-r-b1-urlaub-meinungen",
  "Verreisen oder zu Hause bleiben?",
  "Urlaub und Reisen",
  `
Verreisen oder zu Hause bleiben? Das sagen fünf Leserinnen und Leser.

Kai: Jedes Jahr fliege ich in ein anderes Land. Ich will fremde Sprachen hören, neues Essen probieren und Menschen aus anderen Kulturen kennenlernen. Dass Fliegen schlecht für die Umwelt ist, weiß ich. Trotzdem verzichte ich lieber auf ein Auto als auf meine Reisen.

Lale: Mir reicht ein Urlaub in Deutschland, am liebsten mit dem Zug. Wir fahren seit Jahren an die Ostsee, weil es dort einfach so schön ist. Ich muss nicht jedes Jahr etwas Neues sehen.

Max: Ich bleibe im Urlaub meistens zu Hause. Eine Reise kostet meine Familie sehr viel Geld, und der Stress beim Packen und im Stau ist mir zu groß. Ich mache lieber Ausflüge in die Umgebung.

Nora: Dieses Jahr fahre ich zum ersten Mal allein weg, eine Woche in die Berge. Ich habe ein bisschen Angst, dass ich mich langweile, aber ich möchte es ausprobieren.

Olaf: Wir fahren mit dem Wohnwagen. So sind wir unabhängig und können spontan entscheiden, wohin es als Nächstes geht. Und die Kinder lieben es, draußen zu schlafen.
`,
);
const urlaub = forText(rUrlaub.key);

const readingItems: SeedItem[] = [
  // ---- Text 1
  email.tfng("detail", "MID",
    [
      ["Frau Petrović ist erst seit Kurzem in der Firma.", "F"],
      ["Manche Kunden waren für Amira am Telefon anfangs schwer zu verstehen.", "R"],
      ["Mit dem Thema der Weiterbildung im Herbst kennt sich Amira noch nicht aus.", "R"],
    ],
    "Frau Petrović arbeitet „seit fünfzehn Jahren“ dort (F). Die Kunden „sprechen sehr schnell“ und benutzen „viele Fachwörter“ (R). Reklamationen sind „ein ganz neues Thema“ (R)."),
  email.choice("detail", "MID",
    "Warum denkt Amira über ein E-Bike nach?",
    "Der Weg zur Arbeit dauert lang, und mit dem Rad ginge es schneller und gesünder.",
    [
      "Die Firma stellt Fahrräder her, und alle Mitarbeiter sollen sie im Alltag selbst testen.",
      "Frau Petrović fährt schon lange mit dem Rad und hat Amira dazu geraten.",
      "Amira möchte im Sommer mit Jonas eine Radtour machen und dafür üben.",
    ],
    2,
    "Mit Bus und Bahn braucht sie „fast eine Stunde“, mit dem Rad wäre sie „in vierzig Minuten da“; der günstige Preis für Mitarbeiter ist nur eine Erleichterung. Die Radtour mit Jonas ist eine spätere Idee, kein Grund."),
  email.choice("inference", "HARD",
    "Was erfährt man aus der E-Mail über Jonas?",
    "Er hat Amira im Winter von einer Stelle in Leipzig erzählt; ob er sie bekam, weiß sie nicht.",
    [
      "Er wohnt in derselben Stadt wie Amira und besucht sie deshalb im Sommer regelmäßig am Wochenende.",
      "Er hat die Stelle in Leipzig im Winter bekommen und arbeitet dort inzwischen schon sehr gern.",
      "Er arbeitet in derselben Firma wie Amira und kennt Frau Petrović deshalb schon seit vielen Jahren.",
    ],
    1,
    "Amira fragt, ob er „die Stelle in Leipzig bekommen“ hat, von der er im Winter erzählt hat; sie weiß es also nicht. Sie lädt ihn ein und will ihm „die Stadt zeigen“, also wohnt er nicht dort."),

  // ---- Text 2
  artikel.tfng("detail", "MID",
    [
      ["Im Kurs geht es vor allem um Wörter und Situationen aus dem Lageralltag.", "R"],
      ["Die Teilnehmer bezahlen einen Teil der Kurskosten selbst.", "F"],
      ["Im Herbst beginnt ein zweiter Kurs für Anfänger.", "F"],
    ],
    "Es geht um „die Sprache, die man im Lager wirklich braucht“ (R). „Die Kosten für den Kurs trägt die Firma“ (F). Der zweite Kurs ist für Fortgeschrittene, nicht für Anfänger (F)."),
  artikel.choice("detail", "MID",
    "Warum findet der Kurs während der Arbeitszeit statt?",
    "Weil viele Beschäftigte abends wegen ihrer Familie oder eines zweiten Jobs nicht kommen können.",
    [
      "Weil die Lehrerin nur vormittags Zeit hat und abends in einer anderen Firma unterrichtet.",
      "Weil mehrere Abteilungsleiter gewünscht haben, dass die Mitarbeiter während der Arbeit lernen.",
      "Weil im Lager zweimal in der Woche wenig zu tun ist und die Arbeitszeit der Mitarbeiter sonst verloren wäre.",
    ],
    3,
    "Die Personalleiterin sagt, ein Kurs am Abend sei „für viele unmöglich“ (Kinder, zweiter Job). Die Abteilungsleiter waren am Anfang sogar dagegen."),
  artikel.choice("structure", "HARD",
    "„Inzwischen sehen das die meisten anders.“ Worauf bezieht sich „das“?",
    "auf den Unterricht, bei dem acht Beschäftigte zwei Stunden nicht an ihrem Arbeitsplatz sind",
    [
      "auf die Missverständnisse, die im Arbeitsalltag der Firma manchmal entstehen",
      "auf die Fehler bei den Lieferungen, die seit Beginn des Kurses seltener vorkommen",
      "auf die eigenen Fragen aus dem Alltag, die die Teilnehmer in den Unterricht mitbringen",
    ],
    0,
    "Der Satz davor nennt das Problem der Abteilungsleiter: Wenn acht Leute zwei Stunden fehlen, muss die Arbeit anders verteilt werden. Die geringere Fehlerzahl ist der Grund für die neue Sicht, nicht ihr Gegenstand."),

  // ---- Text 3
  anzeigen.match("detail", "MID",
    "Lesen Sie die Situationen und die Anzeigen A bis H. Welche Anzeige passt zu welcher Situation? Jede Anzeige passt nur einmal. Wenn keine Anzeige passt, wählen Sie „Keine Anzeige passt“.",
    [
      "Elif muss in ihrer neuen Stelle mit Tabellen arbeiten, kennt sich aber mit dem Computer kaum aus. Sie hat nur abends Zeit.",
      "Marco möchte sich bewerben und ist unsicher, ob seine Unterlagen gut genug sind. Er hat zurzeit keine Arbeit.",
      "Frau Nowak braucht eine beglaubigte deutsche Fassung ihres Abschlusszeugnisses.",
      "Herr Osei beginnt bald in einem Kindergarten. Vorher soll er lernen, wie man Verletzten schnell hilft. Unter der Woche arbeitet er.",
      "Ayşe spricht schon gut Deutsch, möchte aber sicherer werden, wenn sie im Arbeitsalltag spricht und schreibt. Sie hat im Moment tagsüber viel Zeit.",
      "Daniel muss für seine Arbeit besser Englisch sprechen. Er hat aber nur sonntags frei.",
      "Lina arbeitet im Schichtdienst und möchte später die Finanzen einer Firma betreuen. Feste Kurszeiten passen nicht zu ihren Schichten.",
    ],
    ADS,
    [1, 3, 7, 5, 4, 9, 8],
    "Elif: A (Excel, abends; H ist Buchhaltung). Marco: C (Unterlagen prüfen, kostenlos für Arbeitssuchende; B macht nur Fotos). Frau Nowak: G (offizielle Übersetzung von Zeugnissen, beglaubigt für Behörden). Herr Osei: E (Erste Hilfe, samstags). Ayşe: D (Sprechen und Schreiben im Beruf, vormittags). Daniel: keine Anzeige, denn der Englischkurs F ist samstags. Lina: H (Online-Kurs Buchhaltung, „wann und wo Sie wollen“)."),
  anzeigen.tfng("detail", "EASY",
    [
      ["Der Computerkurs (A) ist für Gruppen mit weniger als neun Personen gedacht.", "R"],
      ["Der Online-Kurs (H) kann nur einen Monat lang genutzt werden.", "F"],
      ["Die Bewerbungsberatung (C) kostet für Menschen ohne Arbeit nichts.", "R"],
    ],
    "A: „höchstens acht Personen“ (R). H: „Zwölf Wochen Zugang“ (F). C: „Für Arbeitssuchende kostenlos“ (R)."),
  anzeigen.choice("detail", "MID",
    "Was bietet die Bewerbungsberatung (C) außer einem Gespräch im Büro noch an?",
    "Man kann die Beratung auch von zu Hause aus per Videoanruf machen.",
    [
      "Man kann sich vor Ort gleich für das Bewerbungsfoto fotografieren lassen.",
      "Man bekommt die Zeugnisse in mehr als dreißig Sprachen offiziell übersetzt.",
      "Man kann vormittags vier Wochen lang einen Deutschkurs für den Beruf besuchen.",
    ],
    1,
    "C: „Persönlich in unserem Büro oder online per Video.“ Fotos bietet B an, Übersetzungen G, den Intensivkurs D."),

  // ---- Text 4
  regeln.choice("detail", "EASY",
    "Wann ist Ihre Anmeldung gültig?",
    "wenn Sie die Kursgebühr an die Schule bezahlt haben",
    [
      "wenn Sie den Einstufungstest im Sekretariat abgelegt haben",
      "sobald Sie sich persönlich im Sekretariat gemeldet haben",
      "sobald Sie die erste Stunde im Kurs besucht haben",
    ],
    1,
    "Punkt 1: „Die Anmeldung ist erst gültig, wenn Sie die Kursgebühr bezahlt haben.“ Der Test und die Meldung im Sekretariat reichen nicht."),
  regeln.choice("inference", "HARD",
    "Sie haben sich angemeldet und bezahlt. Fünf Tage vor Kursbeginn merken Sie, dass Sie nicht teilnehmen können, und Sie finden niemanden, der Ihren Platz übernimmt. Was passiert?",
    "Die Schule behält 50 Euro Bearbeitungsgebühr und zahlt den Rest der Gebühr zurück.",
    [
      "Die Schule zahlt die ganze Kursgebühr zurück, weil der Kurs noch nicht begonnen hat.",
      "Die Schule zahlt nichts zurück, weil die Abmeldefrist von zehn Tagen schon vorbei ist.",
      "Die Schule zahlt den Betrag erst nach dem Kursende zurück, abzüglich der Prüfungsgebühr.",
    ],
    0,
    "Punkt 3: Kostenlos ist die Abmeldung nur bis zehn Tage vorher; danach (aber vor Kursbeginn) behält die Schule 50 Euro. Kein Geld gibt es erst nach Kursbeginn."),
  regeln.tfng("detail", "MID",
    [
      ["Wer eine Stunde verpasst, kann sie in einem anderen Kurs nachholen.", "F"],
      ["Den Einstufungstest kann man auch zu Hause am Computer machen.", "R"],
      ["Die Prüfungsgebühr ist im Preis des Kurses schon enthalten.", "F"],
    ],
    "Punkt 4: „Verpasste Stunden können nicht nachgeholt werden“ (F). Punkt 2: „auch online möglich“ (R). Punkt 6: Die Prüfungsgebühr ist „nicht in der Kursgebühr enthalten“ (F)."),

  // ---- Text 5
  forum.choice("gist", "EASY",
    "Warum schreibt Svenja ihren Beitrag?",
    "Sie fragt andere um Rat, wie sie den Lärm ohne Streit beenden kann.",
    [
      "Sie bittet die Hausverwaltung, dem Nachbarn das Schlagzeugspielen zu verbieten.",
      "Sie sucht eine neue Wohnung, weil sie sich in ihrem Stockwerk im Haus nicht mehr wohlfühlt.",
      "Sie lädt die Nachbarn zu einem Abend ein, an dem alle gemeinsam Musik machen.",
    ],
    2,
    "Svenja stellt eine Frage an die Leser („Was würdet ihr an meiner Stelle tun?“). Sie will keinen Streit, die Hausverwaltung möchte sie nicht anrufen, und die Wohnung gefällt ihr."),
  forum.choice("detail", "MID",
    "Seit wann stört der Lärm Svenja, und zu welcher Zeit?",
    "Seit etwa zwei Monaten, fast jeden Abend nach zehn Uhr",
    [
      "Seit etwa einem Jahr, fast jeden Abend nach zehn Uhr",
      "Seit etwa zwei Monaten, fast jeden Morgen vor sieben Uhr",
      "Seit etwa zwei Wochen, nur am Wochenende nach zehn Uhr",
    ],
    3,
    "„Seit zwei Monaten spielt jemand ... fast jeden Abend nach zehn Uhr Schlagzeug.“ Seit einem Jahr wohnt sie im Haus."),
  forum.tfng("detail", "MID",
    [
      ["Svenja hat sich bereits bei der Hausverwaltung über den Lärm beschwert.", "F"],
      ["Wegen der Musik kann Svenja häufig nur schwer einschlafen.", "R"],
      ["Nach Markos Meinung beginnt die Nachtruhe überall um 22 Uhr.", "F"],
    ],
    "Svenja möchte die Hausverwaltung gerade nicht anrufen (F). Sie kann „oft nicht einschlafen“ (R). Marko sagt „in den meisten Häusern“ und verweist auf die Hausordnung, nicht auf „überall“ (F)."),

  // ---- Text 6
  news.match("gist", "MID",
    "Lesen Sie die Kurzmeldungen und die Überschriften A bis G. Welche Überschrift passt zu welchem Text? Jede Überschrift passt nur einmal. Drei Überschriften bleiben übrig.",
    ["Text 1", "Text 2", "Text 3", "Text 4"],
    [
      "A: Neues Stadion für den Fußballverein: Bau beginnt im Herbst",
      "B: Ersatzbusse bringen Fahrgäste trotz Bauarbeiten in die Innenstadt",
      "C: Freiwillige gesucht: Wildblumen für den Stadtpark",
      "D: Neue Buslinie verbindet Bahnhof und Universität",
      "E: Verein sucht Trainer für seine Nachwuchsteams",
      "F: Konzert im Stadtpark: Straßen gesperrt",
      "G: Bibliothek bleibt donnerstags länger geöffnet",
    ],
    [3, 2, 7, 5],
    "Text 1 geht um Helfer für die Wiese im Stadtpark (C; F nennt zwar den Stadtpark, aber ein Konzert). Text 2 nennt Ersatzbusse während der Bauarbeiten (B; D spricht von einer neuen Linie). Text 3 verlängert die Bibliothekszeiten (G). Text 4 sucht Trainer für den Verein (E; A nennt zwar den Fußballverein, aber ein Stadion)."),
  news.choice("detail", "MID",
    "Was müssen Fahrgäste der Linien 4 und 7 in den nächsten Wochen beachten (Text 2)?",
    "Sie nehmen zwei Wochen lang einen Ersatzbus und brauchen dafür etwa zehn Minuten länger.",
    [
      "Sie nehmen zwei Wochen lang einen Ersatzbus, der aber nur an der Brücke hält.",
      "Sie steigen am Fluss um und gehen den Rest der Strecke etwa zehn Minuten zu Fuß weiter.",
      "Sie fahren vier Wochen lang mit dem Ersatzbus und sind dadurch etwas früher da.",
    ],
    0,
    "Text 2: Die Linien fahren „zwei Wochen lang“ nicht in die Innenstadt; der Ersatzbus „hält an allen wichtigen Stellen“, die Fahrt dauert „etwa zehn Minuten länger“."),
  news.tfng("detail", "MID",
    [
      ["Wer im Stadtpark mithelfen möchte, braucht kein eigenes Werkzeug.", "R"],
      ["Die Bibliothek ist ab Mai jeden Abend bis 20 Uhr geöffnet.", "F"],
      ["Neue Trainer müssen die Kosten ihrer Schulung nicht selbst tragen.", "R"],
    ],
    "Text 1: „Werkzeug ist vorhanden“ (R). Text 3: nur donnerstags bis 20 Uhr (F). Text 4: Der Verband bezahlt die Schulung (R)."),

  // ---- Text 7 (Ja / Nein)
  hund.jaNein("detail", "MID",
    [
      ["Tamara und ihr Mann sind sich einig, welchen Hund sie nehmen möchten.", "F"],
      ["Der Vermieter erlaubt im Prinzip einen Hund in der Wohnung.", "R"],
      ["Rolf hat mit seinem Hund aus dem Tierheim schlechte Erfahrungen gemacht.", "F"],
    ],
    "Tamara denkt an das Tierheim, ihr Mann an einen Welpen vom Züchter (Nein). Der Vermieter hat „nichts dagegen“, solange der Hund nicht ständig bellt (Ja). Rolf ist „sehr glücklich“ mit seinem Hund (Nein)."),
  hund.choice("gist", "EASY",
    "Warum schreibt Tamara ihren Beitrag?",
    "Sie möchte von anderen hören, was sie bei der Entscheidung für einen Hund bedenken soll.",
    [
      "Sie sucht für ihren Hund aus dem Tierheim eine Person, die ihn tagsüber betreut.",
      "Sie will dem Vermieter erklären, dass ein Hund in der Wohnung kein Problem ist.",
      "Sie sucht einen Züchter, bei dem sie für ihre Kinder einen jungen Hund kaufen kann.",
    ],
    1,
    "Tamara hat noch keinen Hund; sie fragt am Ende „Was sind eure Erfahrungen?“."),

  // ---- Text 8 (Ja / Nein)
  markt.jaNein("detail", "MID",
    [
      ["Herr Hofmann kauft schon sehr lange regelmäßig auf dem Wochenmarkt ein.", "R"],
      ["Er findet, dass die Stadt mit ihrem Argument völlig falsch liegt.", "F"],
      ["Er möchte, dass zuerst Händler und Stadt gemeinsam nach einer Lösung suchen.", "R"],
    ],
    "„seit über zwanzig Jahren jeden Samstag“ (Ja). Zum Platzargument sagt er „Da hat die Stadt nicht ganz unrecht“ (Nein). Erst danach soll der Gemeinderat entscheiden (Ja)."),
  markt.choice("detail", "MID",
    "Warum wäre der neue Platz für viele ältere Menschen ein Problem?",
    "Sie müssten mit dem Bus fahren, der samstags nur selten kommt.",
    [
      "Sie finden auf dem Parkplatz am Stadtrand keinen Platz für ihre Autos.",
      "Sie dürfen dort nicht mehr jeden Samstag einkaufen, sondern nur noch alle vierzig Minuten.",
      "Sie kennen die Händler am Stadtrand nicht und kaufen deshalb lieber im Supermarkt.",
    ],
    0,
    "Der Weg zum Stadtrand ist weit, und der Bus fährt samstags „nur alle vierzig Minuten“."),

  // ---- Text 9 (Ja / Nein)
  chor.jaNein("detail", "EASY",
    [
      ["Marta muss Noten lesen können, um im Chor mitzusingen.", "F"],
      ["Henrik hat erst relativ spät mit dem Singen im Chor begonnen.", "R"],
      ["Die erste Probe kostet für Marta nichts.", "R"],
    ],
    "„Du musst keine Noten lesen können“ (Nein). Henrik hat „erst mit vierzig angefangen“ (Ja). Die erste Probe ist „gratis“ (Ja)."),
  chor.choice("detail", "MID",
    "Was bietet Henrik Marta am Ende seines Briefes an?",
    "Er kann sie vor dem Gebäude abholen, wenn sie nicht allein kommen möchte.",
    [
      "Er kann ihr vor der ersten Probe die Noten der Lieder zum Üben nach Hause schicken.",
      "Er kann mit ihr im Mai zusammen für ein Wochenende nach Dresden fahren.",
      "Er kann sie der Leiterin vorstellen, damit sie ein Instrument vorspielen darf.",
    ],
    3,
    "„Wenn du nicht allein kommen möchtest, hole ich dich gern vor der Tür ab.“"),

  // ---- Text 10 (who says what)
  sonntag.match("detail", "MID",
    "Lesen Sie die Aussagen der fünf Personen. Wer sagt was? Ordnen Sie jeder Aussage eine Person zu. Eine Person kann mehrmals passen, eine Person passt zu keiner Aussage.",
    [
      "Diese Person treibt sonntags mit anderen Sport.",
      "Diese Person trifft sich am Sonntag nicht mit anderen.",
      "Diese Person verbringt den Sonntag mit den Kindern.",
      "Diese Person erledigt am Sonntag vor allem Hausarbeit.",
      "Diese Person wünscht sich, der Sonntag würde länger dauern.",
    ],
    ["Anna", "Bernd", "Clara", "Dennis", "Eva"],
    [2, 1, 3, 4, 3],
    "Bernd spielt mit Freunden Fußball. Anna verabredet sich nie. Clara macht Familientag und findet den Tag zu kurz (zweimal Clara). Dennis erledigt Wäsche, Einkauf und Aufräumen. Eva arbeitet im Restaurant und passt zu keiner Aussage."),

  // ---- Text 11 (who says what)
  wohnen.match("detail", "MID",
    "Lesen Sie die Aussagen der fünf Personen. Wer sagt was? Ordnen Sie jeder Aussage eine Person zu. Eine Person kann mehrmals passen, eine Person passt zu keiner Aussage.",
    [
      "Diese Person zahlt gern mehr Miete, um nah an Freizeitangeboten zu wohnen.",
      "Diese Person kann sich nicht entscheiden, ob Stadt oder Land besser ist.",
      "Diese Person kommt ohne eigenes Fahrzeug im Alltag kaum zurecht.",
      "Diese Person hat den Wohnort vor allem wegen der Kinder gewählt.",
      "Diese Person sieht Bekannte seltener, seit sie nicht mehr in der Stadt lebt.",
    ],
    ["Franka", "Gero", "Hülya", "Ivo", "Jana"],
    [2, 3, 1, 5, 5],
    "Gero zahlt „gern mehr Miete“. Hülya ist „unsicher“. Franka braucht ein Auto für Arzt und Einkauf. Jana wählt das Land wegen der Kinder und sieht ihre Freunde nur noch selten (zweimal Jana). Ivo passt zu keiner Aussage."),

  // ---- Text 12 (who says what)
  urlaub.match("detail", "MID",
    "Lesen Sie die Aussagen der fünf Personen. Wer sagt was? Ordnen Sie jeder Aussage eine Person zu. Eine Person kann mehrmals passen, eine Person passt zu keiner Aussage.",
    [
      "Diese Person nimmt die Belastung der Umwelt durch das Reisen bewusst in Kauf.",
      "Diese Person möchte im Urlaub andere Kulturen kennenlernen.",
      "Diese Person fährt seit Jahren immer an denselben Ort.",
      "Diese Person verreist wegen der hohen Kosten und der Mühe nicht.",
      "Diese Person möchte unterwegs flexibel bleiben.",
    ],
    ["Kai", "Lale", "Max", "Nora", "Olaf"],
    [1, 1, 2, 3, 5],
    "Kai fliegt trotz der Umweltfolgen und will fremde Kulturen sehen (zweimal Kai). Lale fährt seit Jahren an die Ostsee. Max nennt Kosten und Stress. Olaf will mit dem Wohnwagen spontan entscheiden. Nora passt zu keiner Aussage."),
];

// ================================================================ LISTENING

type ListeningSkill = "gist" | "detail" | "attitude" | "inference";

function clip(
  key: string,
  title: string,
  topic: string,
  speakers: Array<{ label: string; voice: "A" | "B" | "C" | "D" }>,
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
      return { ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...options(correct, distractors, pos) };
    },
    /** Richtig / Falsch only, as in ÖSD and telc at B1. */
    tfng(skill: ListeningSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      return {
        ...base(skill, within, LISTENING_RF, explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", twoWay: true, statements: statements.map(([text], i) => ({ id: `s${i + 1}`, text })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, v], i) => [`s${i + 1}`, v])) },
      };
    },
    /** Note-taking: typed gaps, every acceptable spelling listed per gap. */
    notes(skill: ListeningSkill, within: Within, prompt: string, answers: string[][], explanation: string): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "GAP_FILL",
        content: { kind: "GAP", gaps: answers.map((_, i) => ({ id: `g${i + 1}` })) },
        key: { kind: "GAP", answers: Object.fromEntries(answers.map((a, i) => [`g${i + 1}`, a])) },
      };
    },
  };
}

// ---- Clip 1: answerphone message, one voice

const lMailbox = clip(
  "v2-l-b1-erster-arbeitstag-v3",
  "Nachricht vor dem ersten Arbeitstag",
  "Arbeit",
  [{ label: "Frau Jansen", voice: "A" }],
  [
    "Frau Jansen: Guten Tag, Herr Demir, hier spricht Katrin Jansen aus der Personalabteilung von Hellmann Medizintechnik.",
    "Frau Jansen: Ich rufe wegen Montag an, Ihrem ersten Arbeitstag. Wir hatten ja neun Uhr gesagt. Das ändert sich leider ein bisschen: Bitte kommen Sie schon um halb neun. Also, um halb neun, nicht um neun.",
    "Frau Jansen: Um neun beginnt nämlich eine Sicherheitsschulung für alle Neuen, und vorher bekommen Sie noch Ihre Zugangskarte.",
    "Frau Jansen: Gehen Sie bitte nicht zum Haupteingang. Sie melden sich am Empfang in Gebäude B, nein, Entschuldigung, in Gebäude C. Das ist das graue Haus direkt neben dem Parkplatz.",
    "Frau Jansen: Bringen Sie bitte Ihren Personalausweis mit und Ihre Kontonummer. Den Arbeitsvertrag haben wir schon, den brauchen Sie also nicht.",
    "Frau Jansen: Ach ja, und zum Mittagessen: Sie können bei uns in der Kantine essen. Am ersten Tag sind Sie natürlich unser Gast.",
    "Frau Jansen: Wenn Sie noch Fragen haben, rufen Sie mich einfach an. Ich bin heute bis sechzehn Uhr im Büro. Also dann, bis Montag um halb neun. Auf Wiederhören!",
  ],
);
const mailbox = forClip(lMailbox.key);

// ---- Clip 2: guided tour in front of a group, a visitor asks twice

const lFuehrung = clip(
  "v2-l-b1-betriebsfuehrung-v3",
  "Führung durch eine Bäckerei",
  "Ausbildung",
  [
    { label: "Herr Brandt", voice: "B" },
    { label: "Besucherin", voice: "A" },
  ],
  [
    "Herr Brandt: Guten Morgen und herzlich willkommen bei der Bäckerei Sommer! Mein Name ist Martin Brandt, ich leite hier die Ausbildung.",
    "Herr Brandt: Zuerst ein paar Worte zu uns. Wir sind ein Familienbetrieb, aber inzwischen ziemlich groß: zwölf Filialen in der Region und etwa zweihundert Mitarbeiter. Jedes Jahr fangen bei uns zehn neue Auszubildende an, die meisten als Bäcker oder im Verkauf.",
    "Herr Brandt: So, und hier sind wir in der Backstube. Hier geht es um drei Uhr nachts los. Ja, ich weiß, das klingt hart.",
    "Besucherin: Um drei Uhr nachts? Und wann ist dann Feierabend?",
    "Herr Brandt: Meistens am späten Vormittag. Dafür hat man den ganzen Nachmittag frei. Na ja, viele Auszubildende sagen am Ende sogar, dass ihnen das gefällt.",
    "Herr Brandt: Bitte fassen Sie hier nichts an, die Öfen sind sehr heiß. Und noch etwas: Alle tragen hier eine Mütze, aus Hygienegründen. Sie haben Ihre Papiermützen ja schon auf, sehr gut.",
    "Herr Brandt: Gehen wir weiter. Rechts ist unser Schulungsraum. Dort treffen sich alle Auszubildenden, auch die aus den Filialen, einmal im Monat. Also nicht jede Woche, nur einmal im Monat. Dann üben sie Verkaufsgespräche oder lernen neue Rezepte.",
    "Besucherin: Und wie bewirbt man sich bei Ihnen? Brauche ich eine Bewerbungsmappe?",
    "Herr Brandt: Gute Frage, das interessiert Sie ja sicher am meisten. Nein, keine Mappe aus Papier, schicken Sie uns einfach eine E-Mail. Ein gutes Zeugnis ist schön, aber wichtiger ist uns, dass Sie motiviert sind. Deshalb laden wir jeden Bewerber zuerst zu einem Probetag ein. Da sehen Sie, ob Ihnen die Arbeit gefällt, und wir lernen Sie kennen.",
    "Herr Brandt: So, jetzt haben Sie noch Zeit für Fragen, und danach gibt es frisches Gebäck für alle.",
  ],
);
const fuehrung = forClip(lFuehrung.key);

// ---- Clip 3: conversation between colleagues, two voices

const lGespraech = clip(
  "v2-l-b1-teamausflug-v3",
  "Zwei Kollegen planen einen Ausflug",
  "Ausflug und Freizeit",
  [
    { label: "Lena", voice: "A" },
    { label: "Murat", voice: "B" },
  ],
  [
    "Lena: Hallo Murat, hast du kurz Zeit? Es geht um den Teamausflug im Juni.",
    "Murat: Klar, setz dich. Ich dachte, Frau Weber organisiert das dieses Jahr?",
    "Lena: Eigentlich schon. Aber sie ist ab nächster Woche drei Wochen im Urlaub, und deshalb hat sie gefragt, ob wir das übernehmen.",
    "Murat: Ach so. Na ja, okay. Wie viel Zeit haben wir denn?",
    "Lena: Der Ausflug ist am zwanzigsten Juni, also in gut vier Wochen. Und das Budget ist wie letztes Jahr: fünfzig Euro pro Person.",
    "Murat: Letztes Jahr waren wir doch Kanu fahren, oder? Das fanden viele toll, aber zwei Kollegen konnten nicht mitmachen, weil sie nicht schwimmen können. Das sollten wir diesmal besser machen.",
    "Lena: Genau. Ich hatte zuerst an einen Kletterpark gedacht, aber da ist es dasselbe Problem. Nicht jeder klettert gern.",
    "Murat: Und wenn wir einen Kochkurs machen? Meine Schwester hat das mal mit ihrer Firma gemacht. Man kocht in kleinen Gruppen und isst am Ende zusammen. Da kann wirklich jeder mitmachen.",
    "Lena: Hm, die Idee gefällt mir. Aber wir sind fünfundzwanzig Leute. Gibt es Kochschulen für so große Gruppen?",
    "Murat: Keine Ahnung. Ich kann heute Nachmittag ein paar Kochschulen anrufen und nach dem Preis fragen.",
    "Lena: Super. Und ich schicke allen eine kurze Umfrage. Wir müssen ja wissen, ob jemand kein Fleisch isst oder etwas nicht verträgt.",
    "Murat: Gute Idee. Ach, und der zwanzigste ist ein Freitag, oder? Da arbeiten einige nur bis mittags.",
    "Lena: Stimmt, deshalb fangen wir erst um vierzehn Uhr an. Dann können alle kommen.",
    "Murat: Passt. Sollen wir uns am Donnerstag noch mal treffen?",
    "Lena: Donnerstag geht leider nicht, da bin ich den ganzen Tag bei einem Kunden. Wie wäre Mittwoch?",
    "Murat: Mittwoch, gern. Nach der Teambesprechung? Dann bringe ich die Preise mit.",
    "Lena: Perfekt, also Mittwoch nach der Teambesprechung.",
  ],
);
const gespraech = forClip(lGespraech.key);

// ---- Clip 4: workshop voicemail, note-taking

const lWerkstatt = clip(
  "v2-l-b1-werkstatt-nachricht",
  "Nachricht von der Fahrradwerkstatt",
  "Fahrrad und Alltag",
  [{ label: "Herr Rieger", voice: "B" }],
  [
    "Herr Rieger: Guten Tag, hier ist die Fahrradwerkstatt Rieger. Es geht um Ihr Rad, das Sie am Montag bei uns abgegeben haben.",
    "Herr Rieger: Also, die gute Nachricht: Es wird früher fertig als gedacht. Sie können es ab Mittwoch abholen. Ab Mittwoch, nicht schon morgen, bis morgen schaffen wir es leider nicht.",
    "Herr Rieger: Wir haben von neun bis achtzehn Uhr geöffnet, am Samstag allerdings nur bis vierzehn Uhr.",
    "Herr Rieger: Die Reparatur kostet achtundsechzig Euro. Ja, das ist etwas mehr als gedacht. Wir müssen nicht nur den Reifen, sondern auch die Bremse wechseln. Ach ja, bringen Sie bitte den Abholschein mit.",
    "Herr Rieger: Falls Sie Fragen haben: Sie erreichen uns unter null vier zwei eins, achtunddreißig, siebenundzwanzig, sechsundfünfzig. Ich wiederhole: null vier zwei eins, achtunddreißig, siebenundzwanzig, sechsundfünfzig. Danke und bis bald!",
  ],
);
const werkstatt = forClip(lWerkstatt.key);

// ---- Clip 5: radio tip, two voices

const lFreibad = clip(
  "v2-l-b1-freibad-tipp-v3",
  "Freizeittipp im Radio",
  "Freizeit und Sport",
  [
    { label: "Tobias Kern", voice: "B" },
    { label: "Nina Roth", voice: "A" },
  ],
  [
    "Tobias Kern: Und jetzt unser Freizeittipp für das Wochenende. Meine Kollegin Nina Roth war für uns im Freibad am Südpark. Nina, was gibt es Neues?",
    "Nina Roth: Hallo Tobias. Also, das Freibad macht in diesem Jahr schon am ersten Mai auf, zwei Wochen früher als sonst. Und der Eintritt ist billiger geworden: vier Euro fünfzig statt fünf Euro. Kinder unter sechs Jahren kommen übrigens kostenlos rein.",
    "Tobias Kern: Das ist doch mal eine gute Nachricht. Und wann kann man schwimmen gehen?",
    "Nina Roth: Montag bis Freitag von zehn bis zwanzig Uhr, am Wochenende schon ab acht. Aber Achtung, bei Regen bleibt das Becken geschlossen. Dann kann man wenigstens in die Sauna, nein, Entschuldigung, die ist erst im Herbst wieder offen. Bei Regen ist also alles zu.",
    "Tobias Kern: Gut zu wissen. Danke dir, Nina!",
  ],
);
const freibad = forClip(lFreibad.key);

// ---- Clip 6: phone call to a dance studio, table completion, one self-correction

const lTanzkurs = clip(
  "v3-l-b1-tanzkurs-telefon",
  "Anruf im Tanzstudio",
  "Tanzen und Freizeit",
  [
    { label: "Jan Vogel", voice: "B" },
    { label: "Sandra", voice: "A" },
  ],
  [
    "Jan Vogel: Tanzstudio Rhythmus, guten Tag, Sie sprechen mit Jan Vogel.",
    "Sandra: Guten Tag, hier ist Sandra Kunz. Ich interessiere mich für Ihren Salsakurs für Anfänger. Wann geht der denn los?",
    "Jan Vogel: Also, der nächste Kurs beginnt am zwölften Oktober, nein, Entschuldigung, am vierzehnten Oktober. Der zwölfte ist ein Sonntag, da haben wir zu. Also am vierzehnten.",
    "Sandra: Am vierzehnten, gut. Und welcher Wochentag ist das?",
    "Jan Vogel: Das ist ein Dienstag. Der Kurs findet jeden Dienstag statt, zehn Abende lang.",
    "Sandra: Ach so. Und um wie viel Uhr?",
    "Jan Vogel: Na ja, von neunzehn Uhr dreißig bis einundzwanzig Uhr. Also halb acht, ja, halb acht bis neun.",
    "Sandra: Und was kostet das?",
    "Jan Vogel: Zehn Abende kosten hundertzwanzig Euro. Hundertzwanzig, genau. Bezahlen können Sie dann am ersten Abend.",
    "Sandra: Brauche ich einen festen Tanzpartner?",
    "Jan Vogel: Nein, nein, einen Partner brauchen Sie nicht, wir wechseln im Kurs ständig. Bringen Sie nur bequeme Schuhe mit, Straßenschuhe sind in der Halle nicht erlaubt. Sie können sich übrigens gleich am Telefon anmelden.",
    "Sandra: Prima, dann mache ich das sofort.",
  ],
);
const tanzkurs = forClip(lTanzkurs.key);

// ---- Clip 7: four housemates plan a party, table completion

const lGrillparty = clip(
  "v3-l-b1-hausparty-planung-v2",
  "Vier Mitbewohner planen ein Fest",
  "Wohnen und Feiern",
  [
    { label: "Mila", voice: "A" },
    { label: "Ole", voice: "B" },
    { label: "Pia", voice: "D" },
    { label: "Ruben", voice: "C" },
  ],
  [
    "Mila: So, wir müssen noch das Hausfest planen. Ole, wann war das nochmal? Samstag, oder?",
    "Ole: Ja, Samstag, der elfte, nein, Moment, der achtzehnte. Genau, der achtzehnte. Der elfte war ja schon letzte Woche.",
    "Pia: Und wo machen wir das? Im Garten ist es abends schon viel zu kalt, um lange zu sitzen.",
    "Ruben: Wir haben doch den Gemeinschaftsraum im Keller. Da passen dreißig Leute rein, und die Hausverwaltung hat schon zugesagt.",
    "Mila: Gut, dann also Gemeinschaftsraum. Wer bringt was mit? Ich mache einen großen Nudelsalat.",
    "Pia: Ich backe Kuchen. Zwei Kuchen, glaube ich, das reicht. Salat mache ich nicht, den macht ja Mila.",
    "Ole: Und ich besorge die Musikanlage von meinem Cousin. Ruben, was ist mit dir?",
    "Ruben: Ich kümmere mich um das Geschirr und die Becher. Ich habe noch welche vom letzten Mal.",
    "Mila: Super. Und wann fangen wir an? Um achtzehn Uhr?",
    "Ruben: Achtzehn Uhr passt. Ich bin bis fünf bei der Arbeit, das reicht gut.",
  ],
);
const grillparty = forClip(lGrillparty.key);

// ---- Clip 8: station information desk plus announcement, table completion

const lBahn = clip(
  "v3-l-b1-bahnauskunft",
  "Auskunft am Bahnhof",
  "Reisen mit der Bahn",
  [
    { label: "Durchsage", voice: "C" },
    { label: "Reisende", voice: "A" },
    { label: "Mitarbeiter", voice: "B" },
  ],
  [
    "Durchsage: Achtung an Gleis vier. Der Regionalzug nach Karlsruhe hat zehn Minuten Verspätung. Wir bitten um Ihr Verständnis.",
    "Reisende: Guten Tag, ich möchte morgen nach Freiburg fahren. Wann geht der nächste Zug am Vormittag?",
    "Mitarbeiter: Moment, ich schaue nach. Es gibt einen Zug um acht Uhr vierzig. Nein, Entschuldigung, den gibt es nur samstags. Morgen ist Freitag, da fährt er um neun Uhr zehn. Also neun Uhr zehn.",
    "Reisende: Neun Uhr zehn. Muss ich umsteigen?",
    "Mitarbeiter: Ja, in Mannheim. Dort haben Sie acht Minuten Zeit, also nicht sehr viel. Die Ankunft in Freiburg ist um zwölf Uhr vierzehn.",
    "Reisende: Und von welchem Gleis fährt der Zug ab?",
    "Mitarbeiter: Von Gleis neun. Das ist ganz hinten, gehen Sie hier links durch die Unterführung.",
    "Reisende: Gleis neun, gut. Danke Ihnen!",
  ],
);
const bahn = forClip(lBahn.key);

const listeningItems: SeedItem[] = [
  // ---- Clip 1
  mailbox.choice("detail", "EASY",
    "Wann soll Herr Demir am Montag in der Firma sein, und warum?",
    "Um halb neun, weil er vor der Schulung noch eine Zugangskarte bekommt.",
    [
      "Um neun Uhr, weil dann die Sicherheitsschulung für alle Neuen beginnt.",
      "Um halb neun, weil er vor der Schulung noch seinen Vertrag unterschreibt.",
      "Um zehn Uhr, weil bis dahin der Empfang in Gebäude C geschlossen ist.",
    ],
    3,
    "Neun Uhr war der alte Termin; jetzt soll er „schon um halb neun“ kommen. Um neun beginnt die Schulung, vorher gibt es die Zugangskarte. Den Vertrag haben sie schon."),
  mailbox.choice("detail", "MID",
    "Wohin soll Herr Demir gehen?",
    "zum Empfang in Gebäude C, dem grauen Haus neben dem Parkplatz",
    [
      "zum Haupteingang der Firma, wo ihn Frau Jansen persönlich abholt",
      "direkt in die Personalabteilung im Gebäude B neben der Kantine",
      "zur Kantine, wo er seine Zugangskarte für die Schulung bekommt",
    ],
    0,
    "„nicht zum Haupteingang“; Frau Jansen verbessert sich von Gebäude B zu „Gebäude C ... direkt neben dem Parkplatz“. Die Kantine ist nur für das Mittagessen."),
  mailbox.tfng("detail", "MID",
    [
      ["Herr Demir muss am Montag seinen Arbeitsvertrag mitbringen.", "F"],
      ["Am ersten Tag muss Herr Demir sein Mittagessen in der Kantine nicht bezahlen.", "R"],
      ["Herr Demir soll einen Ausweis und seine Kontonummer mitbringen.", "R"],
    ],
    "Den Vertrag „brauchen Sie also nicht“ (F); am ersten Tag ist er „unser Gast“ (R); Personalausweis und Kontonummer sollen mit (R)."),

  // ---- Clip 2
  fuehrung.tfng("detail", "MID",
    [
      ["Auch die Auszubildenden aus den Filialen kommen in den Schulungsraum.", "R"],
      ["Die Auszubildenden treffen sich jede Woche im Schulungsraum.", "F"],
      ["Auch Besucher tragen in der Backstube eine Kopfbedeckung.", "R"],
    ],
    "„alle Auszubildenden, auch die aus den Filialen“ (R); „einmal im Monat“, nicht jede Woche (F); Besucher haben Papiermützen auf (R)."),
  fuehrung.choice("detail", "MID",
    "Wie beschreibt Herr Brandt die Arbeitszeit in der Backstube?",
    "Der Tag beginnt sehr früh, dafür bleibt aber der ganze Nachmittag frei.",
    [
      "Der Tag beginnt erst gegen Mittag, dafür arbeitet man bis in die Nacht.",
      "Der Tag beginnt um drei Uhr, dafür dauert die Schicht nur drei Stunden.",
      "Der Beginn ist frei wählbar, dafür arbeitet man am Wochenende immer.",
    ],
    2,
    "Beginn um drei Uhr nachts, „dafür“ Feierabend am späten Vormittag und „den ganzen Nachmittag frei“. Er sieht also Nachteil und Vorteil."),
  fuehrung.choice("inference", "HARD",
    "Was ist der Bäckerei bei Bewerbern am wichtigsten?",
    "dass sie wirklich Lust auf den Beruf haben, auch wenn ihre Noten nicht perfekt sind",
    [
      "dass sie ein sehr gutes Zeugnis mit guten Noten in der Berufsschule vorlegen",
      "dass sie ihre Unterlagen als ordentliche Bewerbungsmappe aus Papier abgeben",
      "dass sie schon vor der Ausbildung Erfahrung in einer Backstube gesammelt haben",
    ],
    0,
    "„Ein gutes Zeugnis ist schön, aber wichtiger ist uns, dass Sie motiviert sind.“ Eine Papiermappe braucht man ausdrücklich nicht; alle Bewerber kommen zuerst zum Probetag."),

  // ---- Clip 3
  gespraech.tfng("detail", "MID",
    [
      ["Für den Ausflug gibt es dieses Jahr mehr Geld pro Person als letztes Jahr.", "F"],
      ["Lena und Murat organisieren den Ausflug, weil Frau Weber nicht da ist.", "R"],
      ["Der Ausflug findet an einem Wochenende statt.", "F"],
    ],
    "Das Budget ist „wie letztes Jahr“ (F). Frau Weber ist „drei Wochen im Urlaub“ (R). Der zwanzigste Juni ist „ein Freitag“ (F)."),
  gespraech.choice("inference", "HARD",
    "Warum finden beide einen Kochkurs besser als Kanufahren oder einen Kletterpark?",
    "Weil niemand wegen Schwimmen oder Klettern ausgeschlossen wäre und alle mitmachen können.",
    [
      "Weil ein Kochkurs für fünfundzwanzig Personen weniger kostet als ein Kletterpark.",
      "Weil Frau Weber im letzten Jahr schon einen Kochkurs für das Team vorgeschlagen hatte.",
      "Weil Murats Schwester die Kochschule gut kennt und einen günstigen Preis aushandeln kann.",
    ],
    0,
    "Beim Kanufahren konnten zwei Kollegen nicht mitmachen, und nicht jeder klettert gern; beim Kochkurs „kann wirklich jeder mitmachen“. Den Preis kennt Murat noch nicht."),
  gespraech.choice("detail", "MID",
    "Wann treffen sich Lena und Murat das nächste Mal?",
    "am Mittwoch, nachdem die Teambesprechung zu Ende ist",
    [
      "am Donnerstag, bevor Lena den ganzen Tag zu einem Kunden fährt",
      "am Freitag um vierzehn Uhr, direkt vor dem Ausflug",
      "am Mittwoch, bevor die Teambesprechung am Vormittag beginnt",
    ],
    2,
    "Murat schlägt Donnerstag vor, aber Lena ist dann bei einem Kunden; sie einigen sich auf Mittwoch nach der Teambesprechung. Freitag um vierzehn Uhr beginnt der Ausflug."),

  // ---- Clip 4
  werkstatt.notes("detail", "MID",
    "Hören Sie die Nachricht. Ergänzen Sie die Notizen.\n\n" +
      "Das Fahrrad kann ab {{g1}} abgeholt werden.\n" +
      "Die Reparatur kostet {{g2}} Euro.\n" +
      "Am Samstag ist die Werkstatt bis {{g3}} Uhr geöffnet.\n" +
      "Telefonnummer (nach der Vorwahl 0421): {{g4}}",
    [
      ["Mittwoch", "am Mittwoch", "ab Mittwoch", "Mi", "Mi."],
      ["68", "achtundsechzig", "68 Euro", "achtundsechzig Euro", "68,00", "68 €", "68€", "68 EUR", "68,00 €"],
      ["14", "vierzehn", "14.00", "14:00", "14 Uhr", "vierzehn Uhr", "14.00 Uhr", "14:00 Uhr", "um 14 Uhr", "um 14:00", "um 14.00"],
      ["38 27 56", "0421 38 27 56"],
    ],
    "Abholung „ab Mittwoch“ (wiederholt, mit Korrektur gegenüber „morgen“); „achtundsechzig Euro“; Samstag „nur bis vierzehn Uhr“; die Nummer wird zweimal genannt (Ziffern werden verglichen, Leerzeichen und Trennstriche zählen nicht): 38 27 56, mit Vorwahl 0421 38 27 56. Akzeptiert sind auch Wochentag mit „am“/„ab“ und Uhrzeit mit „um“, 14:00 oder 14.00."),
  werkstatt.choice("detail", "MID",
    "Warum kostet die Reparatur etwas mehr als erwartet?",
    "Weil nicht nur der Reifen, sondern auch die Bremse ersetzt werden musste.",
    [
      "Weil der neue Reifen besonders teuer war und das Rad zusätzlich gereinigt wurde.",
      "Weil die Werkstatt das Rad schneller als geplant fertig machen sollte.",
      "Weil das Rad am Montag abgegeben und erst am Mittwoch abgeholt wird.",
    ],
    3,
    "„Wir müssen nicht nur den Reifen, sondern auch die Bremse wechseln.“"),
  werkstatt.tfng("detail", "MID",
    [
      ["Das Fahrrad wird früher fertig, als die Werkstatt zuerst gedacht hat.", "R"],
      ["Am Samstag ist die Werkstatt genauso lange geöffnet wie an den anderen Tagen.", "F"],
      ["Zur Abholung soll man den Abholschein dabeihaben.", "R"],
    ],
    "„früher als gedacht“ (R); am Samstag „nur bis vierzehn Uhr“ statt achtzehn Uhr (F); „bringen Sie bitte den Abholschein mit“ (R)."),

  // ---- Clip 5
  freibad.choice("detail", "EASY",
    "Was ist im Freibad in diesem Jahr neu?",
    "Es öffnet zwei Wochen früher, und der Eintritt kostet etwas weniger.",
    [
      "Es hat jetzt auch eine Sauna, und der Eintritt kostet etwas weniger.",
      "Es öffnet zwei Wochen früher, dafür kostet der Eintritt jetzt fünf Euro fünfzig.",
      "Es ist ab Mai täglich bis Mitternacht offen, und der Eintritt kostet nur vier Euro.",
    ],
    2,
    "Das Freibad öffnet „zwei Wochen früher als sonst“, und der Eintritt kostet vier Euro fünfzig statt fünf Euro. Die Sauna ist erst im Herbst wieder offen."),
  freibad.choice("detail", "MID",
    "Was gilt im Freibad bei Regen?",
    "Man kann nicht schwimmen und auch sonst nichts im Bad nutzen.",
    [
      "Das Becken bleibt zu, aber die Sauna bleibt dann geöffnet.",
      "Das Bad öffnet erst später, und das Becken ist nur am Wochenende offen.",
      "Man darf nur am Wochenende ab acht Uhr ins Becken und in die Sauna.",
    ],
    0,
    "Nina Roth verbessert sich: Die Sauna ist erst im Herbst wieder offen, „bei Regen ist also alles zu“."),
  freibad.tfng("detail", "MID",
    [
      ["Unter der Woche kann man bis zwanzig Uhr schwimmen.", "R"],
      ["Am Wochenende kann man früher schwimmen gehen als unter der Woche.", "R"],
      ["Kleine Kinder müssen den vollen Eintritt bezahlen.", "F"],
    ],
    "Montag bis Freitag „von zehn bis zwanzig Uhr“ (R); am Wochenende „schon ab acht“, also früher (R); Kinder unter sechs Jahren „kostenlos“, also nicht voller Preis (F)."),

  // ---- Clip 6 (table completion)
  tanzkurs.notes("detail", "MID",
    "Hören Sie das Telefongespräch. Ergänzen Sie die Tabelle.\n\n" +
      "Kurs: Salsa für Anfänger\n" +
      "Beginn: {{g1}} Oktober\n" +
      "Wochentag: {{g2}}\n" +
      "Kursbeginn am Abend: {{g3}} Uhr\n" +
      "Preis für den ganzen Kurs: {{g4}} Euro",
    [
      ["14", "14.", "vierzehnten", "am 14.", "am vierzehnten", "der 14.", "der vierzehnte"],
      ["Dienstag", "dienstags", "am Dienstag", "Di", "Di."],
      ["19.30", "19:30", "19 30", "19 Uhr 30", "neunzehn Uhr dreißig", "halb acht", "19.30 Uhr", "19:30 Uhr", "um 19.30", "um 19:30", "19.30-21", "19:30-21:00", "19.30 bis 21", "19.30 bis 21 Uhr", "19:30 bis 21:00", "19.30-21.00", "19.30 bis 21.00 Uhr", "halb acht bis neun", "halb acht bis neun Uhr"],
      ["120", "hundertzwanzig", "120 Euro", "hundertzwanzig Euro", "120,00", "120 €", "120€", "120 EUR"],
    ],
    "Beginn: erst „zwölften“, dann Korrektur auf „vierzehnten“ Oktober; Dienstag; „neunzehn Uhr dreißig“ (= halb acht; auch die Angabe mit Ende, bis einundzwanzig Uhr, wird akzeptiert); „hundertzwanzig Euro“ für den ganzen Kurs, zweimal genannt."),
  tanzkurs.choice("detail", "MID",
    "Was braucht Sandra für den Kurs?",
    "Sie braucht nur bequeme Schuhe und muss keinen festen Partner mitbringen.",
    [
      "Sie braucht Tanzschuhe aus dem Studio und muss mit einer Partnerin kommen.",
      "Sie braucht keine besonderen Schuhe, muss aber ihren Partner mitbringen.",
      "Sie muss vorher einen Einstufungstest machen und Straßenschuhe tragen.",
    ],
    1,
    "„Einen Partner brauchen Sie nicht ... Bringen Sie nur bequeme Schuhe mit, Straßenschuhe sind in der Halle nicht erlaubt.“"),
  tanzkurs.tfng("detail", "MID",
    [
      ["Sandra kann sich gleich am Telefon für den Kurs anmelden.", "R"],
      ["Der Kurs besteht aus zehn Abenden.", "R"],
      ["Sandra muss die Gebühr noch heute am Telefon bezahlen.", "F"],
    ],
    "„Sie können sich übrigens gleich am Telefon anmelden“ (R). „zehn Abende lang“ (R). Bezahlt wird „am ersten Abend“ (F)."),

  // ---- Clip 7 (table completion, four voices)
  grillparty.notes("detail", "MID",
    "Hören Sie das Gespräch. Ergänzen Sie die Tabelle.\n\n" +
      "Datum des Fests: Samstag, der {{g1}}.\n" +
      "Ort: {{g2}}\n" +
      "Pia bringt mit: {{g3}}\n" +
      "Ruben bringt mit: {{g4}}",
    [
      ["18", "18.", "achtzehnten", "achtzehnte", "der 18.", "der achtzehnte"],
      ["Gemeinschaftsraum", "Keller", "im Keller", "im Gemeinschaftsraum", "Gemeinschaftsraum im Keller", "der Gemeinschaftsraum", "im Gemeinschaftsraum im Keller"],
      ["Kuchen", "zwei Kuchen", "2 Kuchen", "Kuchen backen"],
      ["Geschirr", "Becher", "Geschirr und Becher", "das Geschirr", "Becher und Geschirr", "Geschirr und die Becher", "das Geschirr und die Becher"],
    ],
    "Datum: Ole nennt erst den elften und korrigiert auf den achtzehnten; Ort: Gemeinschaftsraum im Keller; Pia backt zwei Kuchen (den Salat macht Mila); Ruben bringt Geschirr und Becher."),
  grillparty.choice("detail", "MID",
    "Warum feiern die Mitbewohner nicht im Garten?",
    "Weil es dort abends schon zu kalt ist, um lange zu sitzen.",
    [
      "Weil die Hausverwaltung den Garten für ein Fest nicht erlaubt hat.",
      "Weil im Garten nicht genug Platz für dreißig Gäste vorhanden ist.",
      "Weil sich die Nachbarn wegen der Musik im Garten beschweren würden.",
    ],
    2,
    "Pia: „Im Garten ist es abends schon viel zu kalt.“ Die Hausverwaltung hat dem Gemeinschaftsraum zugestimmt."),
  grillparty.tfng("detail", "MID",
    [
      ["Ole besorgt die Musikanlage für das Fest.", "R"],
      ["Das Fest beginnt um siebzehn Uhr.", "F"],
      ["Pia macht auch einen Salat für alle.", "F"],
    ],
    "Ole holt die Anlage von seinem Cousin (R). Es geht um „achtzehn Uhr“ (Ruben ist bis fünf bei der Arbeit) (F). Den Salat macht Mila (F)."),

  // ---- Clip 8 (table completion, announcement)
  bahn.notes("detail", "MID",
    "Hören Sie das Gespräch. Ergänzen Sie die Tabelle.\n\n" +
      "Zug nach Freiburg (morgen, Freitag)\n" +
      "Abfahrt: {{g1}} Uhr\n" +
      "Gleis: {{g2}}\n" +
      "Umsteigen in: {{g3}}\n" +
      "Ankunft in Freiburg: {{g4}} Uhr",
    [
      ["9.10", "9:10", "09:10", "09.10", "9 10", "9 Uhr 10", "neun Uhr zehn", "9.10 Uhr", "9:10 Uhr"],
      ["9", "neun", "Gleis 9", "Gleis neun"],
      ["Mannheim", "in Mannheim"],
      ["12.14", "12:14", "12 14", "12 Uhr 14", "zwölf Uhr vierzehn", "12.14 Uhr", "12:14 Uhr"],
    ],
    "Abfahrt: Der Zug um acht Uhr vierzig fährt nur samstags, am Freitag fährt er um neun Uhr zehn (Korrektur). Gleis neun; Umsteigen in Mannheim; Ankunft zwölf Uhr vierzehn."),
  bahn.choice("detail", "MID",
    "Wie viel Zeit hat die Reisende beim Umsteigen?",
    "Acht Minuten, sie muss also recht schnell zum Anschlusszug gehen.",
    [
      "Achtzehn Minuten, sie kann in Ruhe noch einen Kaffee trinken.",
      "Dreizehn Minuten, dafür fährt der Zug dort auf demselben Gleis weiter.",
      "Zwei Minuten, deshalb empfiehlt der Mitarbeiter einen späteren Zug.",
    ],
    0,
    "„Dort haben Sie acht Minuten Zeit, also nicht sehr viel.“"),
  bahn.tfng("detail", "MID",
    [
      ["Die Reisende muss auf dem Weg nach Freiburg einmal umsteigen.", "R"],
      ["Der Regionalzug nach Karlsruhe fährt pünktlich ab.", "F"],
      ["Die Fahrt nach Freiburg dauert etwa drei Stunden.", "R"],
    ],
    "Umsteigen in Mannheim (R). Die Durchsage nennt „zehn Minuten Verspätung“ (F). Von 9.10 Uhr bis 12.14 Uhr sind es gut drei Stunden (R)."),
];

// ================================================================ WRITING

const INFORMAL = "informell (du)";
const FORMAL = "formell (Sie)";
const SEMIFORMAL = "halbformell (Sie, freundlich)";
const NEUTRAL = "neutral/sachlich (Forumsbeitrag)";

function writing(
  skill: string,
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

/** Goethe B1: about 80 words for Aufgabe 1 and 2, about 40 words for Aufgabe 3. */
const LONG: [number, number] = [70, 110];
const SHORT: [number, number] = [35, 60];

const RUBRIC_NOTE =
  "Bewertung nach Goethe B1: Erfüllung (alle Punkte, Textsorte, Register, Länge), Kohärenz, Wortschatz, Strukturen.";

const writingItems: SeedItem[] = [
  writing("email", "EASY", LONG,
    "Sie haben letztes Wochenende an einem Kurs teilgenommen (zum Beispiel Kochen, Fotografieren oder Erste Hilfe). Ihre Freundin Mira interessiert sich auch für so einen Kurs. Schreiben Sie Mira eine E-Mail (circa 80 Wörter).\n\n" +
      "- Beschreiben Sie: Wie war der Kurs?\n" +
      "- Begründen Sie: Was hat Ihnen besonders gut gefallen?\n" +
      "- Machen Sie einen Vorschlag, was Sie zusammen machen könnten.",
    [
      "beschreibt den Kurs (Art, Ablauf oder Eindruck)",
      "nennt, was gut gefallen hat, mit Begründung (weil, denn ...)",
      "macht einen konkreten Vorschlag für etwas Gemeinsames",
      "persönliche E-Mail mit Anrede und Gruß an Mira",
    ],
    [
      "wie der Kurs war",
      "was Ihnen besonders gut gefallen hat, und warum",
      "etwas Gemeinsames vorschlagen",
      "Anrede und Gruß",
    ],
    INFORMAL,
    `Persönliche E-Mail (Goethe B1 Aufgabe 1): beschreiben, begründen, vorschlagen. ${RUBRIC_NOTE}`),
  writing("reply", "MID", LONG,
    "Sie haben diese E-Mail von Ihrer Bekannten Hanna bekommen:\n\n" +
      "„Hallo! Ich bin letzten Monat umgezogen und möchte meine neue Wohnung mit ein paar Leuten einweihen. Hast du am 14. Mai abends Zeit? Ich koche für alle. Was isst du besonders gern? Möchtest du etwas mitbringen, zum Beispiel einen Nachtisch? Und wie kommst du zu mir, mit dem Bus oder mit dem Auto? Schreib mir bald! Liebe Grüße, Hanna“\n\n" +
      "Antworten Sie Hanna (circa 80 bis 100 Wörter). Sagen Sie zu und gehen Sie auf alle vier Fragen ein.",
    [
      "bedankt sich für die Einladung und sagt zu",
      "beantwortet die Frage nach der Zeit am Abend",
      "beantwortet die Frage nach dem Lieblingsessen",
      "sagt, ob und was mitgebracht wird",
      "sagt, wie die Anreise erfolgt",
      "persönliche E-Mail mit Anrede und Gruß",
    ],
    [
      "für die Einladung danken und zusagen",
      "ob Sie an dem Abend Zeit haben",
      "was Sie besonders gern essen",
      "ob und was Sie mitbringen",
      "wie Sie zu Hanna kommen",
      "Anrede und Gruß",
    ],
    INFORMAL,
    `Antwort auf eine vorgegebene E-Mail: Alle vier Fragen der Einladung müssen beantwortet werden (Goethe B1 Aufgabe 1, ÖSD und telc mit Leitpunkten). ${RUBRIC_NOTE}`),
  writing("message", "EASY", SHORT,
    "Ihre Nachbarin, Frau Albers, hat gestern ein Paket für Sie angenommen. Schreiben Sie ihr eine kurze Nachricht (circa 40 Wörter).\n\n" +
      "- Bedanken Sie sich.\n" +
      "- Schreiben Sie, wann Sie das Paket abholen können.\n" +
      "- Fragen Sie, ob Sie ihr auch einmal helfen können.",
    [
      "Dank für die Annahme des Pakets",
      "konkreter Zeitpunkt zum Abholen",
      "höfliches Angebot oder Frage nach Gegenhilfe",
      "Anrede „Liebe Frau Albers“ oder „Sehr geehrte Frau Albers“ und passender Gruß",
    ],
    [
      "sich bedanken",
      "wann Sie das Paket abholen können",
      "fragen, ob Sie ihr auch einmal helfen können",
      "Anrede und Gruß",
    ],
    SEMIFORMAL,
    `Kurze halbformelle Nachricht (Goethe B1 Aufgabe 3, Handlungsfeld Wohnen). ${RUBRIC_NOTE}`),
  writing("formal", "MID", SHORT,
    "Sie haben morgen um 10 Uhr einen Termin mit Ihrer Teamleiterin, Frau Becker. Sie können aber nicht kommen. Schreiben Sie Frau Becker eine E-Mail (circa 40 Wörter).\n\n" +
      "- Entschuldigen Sie sich höflich.\n" +
      "- Nennen Sie den Grund.\n" +
      "- Schlagen Sie einen neuen Termin vor.",
    [
      "höfliche Entschuldigung bzw. Absage",
      "nachvollziehbarer Grund",
      "konkreter Vorschlag für einen neuen Termin",
      "passende Anrede (Sehr geehrte Frau Becker / Liebe Frau Becker) und Gruß",
    ],
    [
      "sich höflich entschuldigen",
      "den Grund nennen",
      "einen neuen Termin vorschlagen",
      "Anrede und Gruß",
    ],
    SEMIFORMAL,
    `Halbformelle E-Mail an eine Vorgesetzte (Goethe B1 Aufgabe 3): sich entschuldigen, einen Grund nennen und einen neuen Termin vorschlagen. ${RUBRIC_NOTE}`),
  writing("application", "MID", LONG,
    "Sie haben im Internet gelesen: Ein Supermarkt in Ihrer Stadt sucht Aushilfen für das Wochenende. Schreiben Sie eine E-Mail an Herrn Kraus von der Personalabteilung (circa 80 Wörter).\n\n" +
      "- Stellen Sie sich kurz vor.\n" +
      "- Erklären Sie, warum Sie die Stelle interessiert.\n" +
      "- Fragen Sie nach den Arbeitszeiten.\n" +
      "- Schreiben Sie, ab wann Sie anfangen können.",
    [
      "kurze Vorstellung (Person, Erfahrung oder Situation; Alter, Herkunft o. Ä. werden nicht erwartet)",
      "Begründung des Interesses an der Stelle",
      "Frage nach den Arbeitszeiten",
      "möglicher Arbeitsbeginn",
    ],
    [
      "sich kurz vorstellen",
      "warum Sie die Stelle interessiert",
      "nach den Arbeitszeiten fragen",
      "ab wann Sie anfangen können",
      "Anrede und Gruß",
    ],
    FORMAL,
    `Formelle E-Mail im Handlungsfeld Arbeitssuche; Anrede „Sehr geehrter Herr Kraus“ und Schlussformel erwartet. ${RUBRIC_NOTE}`),
  writing("opinion", "HARD", LONG,
    "In einem Online-Forum wird gefragt: „Sollten Firmen ihren Mitarbeitern erlauben, zwei Tage pro Woche zu Hause zu arbeiten?“\n\n" +
      "Paula schreibt: „Ich arbeite lieber im Büro. Zu Hause fehlen mir die Kollegen, und ich kann Arbeit und Freizeit nicht gut trennen.“\n\n" +
      "Schreiben Sie Ihre Meinung (circa 80 Wörter). Reagieren Sie auch auf Paulas Beitrag.",
    [
      "klare eigene Meinung zur Frage",
      "mindestens zwei Gründe oder ein Beispiel aus eigener Erfahrung",
      "Reaktion auf Paulas Argument (Zustimmung oder Widerspruch mit Begründung)",
      "Forumsbeitrag: kurze Einleitung und ein Schluss",
    ],
    [
      "Ihre Meinung zur Frage",
      "Gründe oder ein Beispiel",
      "auf Paulas Beitrag reagieren",
      "Einleitung und Schluss",
    ],
    NEUTRAL,
    `Meinungsäußerung im Forum (Goethe B1 Aufgabe 2). ${RUBRIC_NOTE}`),
  writing("complaint", "HARD", LONG,
    "Sie haben bei einem Bildungszentrum einen Computerkurs gebucht. In der Anzeige stand: „kleine Gruppen, moderne Computer“. Im Kurs waren aber zwanzig Personen und viele Computer funktionierten nicht. Schreiben Sie eine Beschwerde an das Bildungszentrum (circa 80 Wörter).\n\n" +
      "- Beschreiben Sie, welchen Kurs Sie wann gebucht haben.\n" +
      "- Erklären Sie die Probleme.\n" +
      "- Schreiben Sie, was Sie jetzt erwarten.",
    [
      "Angaben zum gebuchten Kurs (Name, Zeitraum)",
      "beschreibt beide Probleme und den Unterschied zur Anzeige",
      "klare Forderung (z. B. Geld zurück, Ermäßigung, Ersatzkurs)",
      "formeller, sachlicher Ton mit Anrede und Schlussformel",
    ],
    [
      "welchen Kurs Sie wann gebucht haben",
      "die Probleme erklären",
      "was Sie jetzt erwarten",
      "Anrede und Schlussformel",
    ],
    FORMAL,
    `Beschwerde (formell): Sachverhalt, Problem, Forderung. ${RUBRIC_NOTE}`),
];

// ================================================================ SPEAKING

function speaking(
  skill: string,
  within: Within,
  timing: { thinkSeconds: number; answerSeconds: number; maxTakes: number },
  prompt: string,
  contentPoints: string[],
  studentPoints: string[],
  explanation: string,
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
    explanation,
  };
}

const SPEAK_NOTE = "Bewertung nach Goethe B1 Sprechen: Erfüllung, Interaktion bzw. Kohärenz, Wortschatz, Strukturen, Aussprache.";

const speakingItems: SeedItem[] = [
  speaking("introduction", "EASY", { thinkSeconds: 30, answerSeconds: 90, maxTakes: 2 },
    "Stellen Sie sich vor, Sie sind in einem Vorstellungsgespräch. Erzählen Sie etwas über sich: Wer sind Sie? Was haben Sie gelernt oder studiert? Wo haben Sie schon gearbeitet oder ein Praktikum gemacht? Was können Sie besonders gut?",
    [
      "Name und kurz die aktuelle Situation (Alter, Herkunft o. Ä. werden nicht erwartet)",
      "Schule, Ausbildung oder Studium",
      "bisherige Arbeits- oder Praktikumserfahrung (wer noch keine hat, sagt das und nennt z. B. einen Wunsch)",
      "mindestens eine Stärke mit Beispiel",
    ],
    [
      "wer Sie sind",
      "was Sie gelernt oder studiert haben",
      "wo Sie schon gearbeitet oder ein Praktikum gemacht haben",
      "was Sie besonders gut können",
    ],
    `Monologische Selbstvorstellung im Handlungsfeld Arbeit, ca. 90 Sekunden. ${SPEAK_NOTE}`,
    FORMAL),
  speaking("request", "EASY", { thinkSeconds: 30, answerSeconds: 60, maxTakes: 2 },
    "Sie möchten nächste Woche zwei Tage freinehmen, weil Sie einen wichtigen privaten Termin haben. Sprechen Sie mit Ihrer Teamleiterin: Bitten Sie höflich um die freien Tage, nennen Sie den Grund und machen Sie einen Vorschlag, wer Ihre Aufgaben übernehmen kann.",
    [
      "höfliche Bitte (z. B. Könnte ich ..., Wäre es möglich ...)",
      "nachvollziehbarer Grund",
      "Vorschlag zur Vertretung oder Organisation der Arbeit",
      "freundlicher Abschluss oder Frage nach der Antwort",
    ],
    [
      "höflich um die freien Tage bitten",
      "den Grund nennen",
      "vorschlagen, wer Ihre Aufgaben übernimmt",
    ],
    `Bitte im Arbeitskontext mit Konjunktiv II der Höflichkeit. ${SPEAK_NOTE}`,
    FORMAL),
  speaking("planning", "MID", { thinkSeconds: 60, answerSeconds: 120, maxTakes: 2 },
    "Ihre Kollegin Jana verlässt nächsten Monat die Firma. Ihr Kollege Paul sagt: „Lass uns für Jana eine kleine Abschiedsfeier organisieren. Ich dachte an Freitagabend in einem Restaurant.“\n\n" +
      "Antworten Sie Paul. Reagieren Sie auf seinen Vorschlag und sprechen Sie über diese Punkte: Wann und wo? Essen und Getränke? Geschenk? Wer kümmert sich um was?",
    [
      "reagiert auf Pauls Vorschlag (Zustimmung oder begründete Gegenidee)",
      "eigene Vorschläge zu mindestens drei der vier Punkte",
      "begründet die Vorschläge",
      "schlägt eine Aufgabenverteilung vor",
    ],
    [
      "auf Pauls Vorschlag reagieren",
      "wann und wo",
      "Essen und Getränke",
      "Geschenk",
      "wer sich um was kümmert",
    ],
    `Gemeinsam etwas planen (Goethe B1 Sprechen Teil 1), Partnerbeitrag als Text vorgegeben. ${SPEAK_NOTE}`,
    INFORMAL),
  speaking("planning.open", "MID", { thinkSeconds: 60, answerSeconds: 120, maxTakes: 2 },
    "Sie und Ihr Freund Leon möchten am Samstag zusammen einen Ausflug machen. Leon sagt: „Ich würde gern etwas in der Natur machen. Hast du eine Idee?“\n\n" +
      "Machen Sie Leon Vorschläge. Sprechen Sie über diese Punkte:\n" +
      "- Wohin?\n" +
      "- Wann und wo treffen?\n" +
      "- Wie hinkommen?\n" +
      "- Essen und Trinken\n" +
      "- eine eigene Idee",
    [
      "reagiert auf Leons Frage mit einer eigenen Idee",
      "eigene Vorschläge zu mindestens drei der Punkte",
      "begründet die Vorschläge und geht auf Leons Reaktionen ein",
      "bringt mindestens eine eigene Idee zum offenen Punkt ein",
    ],
    [
      "auf Leons Frage antworten",
      "wohin Sie fahren",
      "wann und wo Sie sich treffen",
      "wie Sie hinkommen",
      "was Sie essen und trinken",
      "eine eigene Idee ergänzen",
    ],
    `Gemeinsam etwas planen mit offenem letzten Punkt (ÖSD B1 Sprechen Teil 1, telc B1 Teil 3), Partnerbeitrag als Text vorgegeben. ${SPEAK_NOTE}`,
    INFORMAL),
  speaking("feedback", "MID", { thinkSeconds: 45, answerSeconds: 60, maxTakes: 2 },
    "Ein Kollege hat gerade eine kurze Präsentation gehalten: „Mit dem Fahrrad zur Arbeit“. Er hat gesagt, dass Radfahren gesund und billig ist, dass man aber bei schlechtem Wetter nass wird und in der Firma keine Dusche hat.\n\n" +
      "Geben Sie ihm eine Rückmeldung: Was hat Ihnen an seiner Präsentation gefallen? Stellen Sie ihm eine Frage zum Thema.",
    [
      "positive Rückmeldung mit Bezug auf den Inhalt",
      "eventuell eine eigene Erfahrung oder Ergänzung",
      "eine passende Frage zum Thema",
    ],
    [
      "was Ihnen an der Präsentation gefallen hat",
      "eine Frage zum Thema stellen",
    ],
    `Rückmeldung und Frage zu einer Präsentation (Goethe B1 Sprechen Teil 3). ${SPEAK_NOTE}`,
    "du oder Sie (unter Kollegen ist beides richtig)"),
  speaking("presentation", "HARD", { thinkSeconds: 120, answerSeconds: 180, maxTakes: 1 },
    "Halten Sie eine kurze Präsentation zum Thema „Weiterbildung im Beruf: Sollte man regelmäßig Kurse besuchen?“ Sprechen Sie über diese fünf Punkte:\n\n" +
      "1. Stellen Sie das Thema vor.\n" +
      "2. Erzählen Sie von Ihren eigenen Erfahrungen mit Kursen oder Weiterbildungen.\n" +
      "3. Wie ist das an Ihrem Arbeitsplatz oder in Ihrem Umfeld? Bezahlen Firmen solche Kurse?\n" +
      "4. Nennen Sie Vor- und Nachteile und Ihre Meinung.\n" +
      "5. Schließen Sie die Präsentation ab und bedanken Sie sich.",
    [
      "Einleitung mit Thema und Aufbau",
      "eigene Erfahrung",
      "Situation am Arbeitsplatz oder im eigenen Umfeld",
      "Vor- und Nachteile mit eigener Meinung",
      "Abschluss und Dank",
    ],
    [
      "das Thema vorstellen",
      "eigene Erfahrungen mit Kursen oder Weiterbildungen",
      "die Situation am Arbeitsplatz oder in Ihrem Umfeld",
      "Vor- und Nachteile und Ihre Meinung",
      "Abschluss und Dank",
    ],
    `Präsentation über fünf Folien (Goethe B1 Sprechen Teil 2); Kohärenz A nur, wenn alle fünf Punkte angemessen behandelt werden. ${SPEAK_NOTE}`),
  speaking("opinion", "HARD", { thinkSeconds: 60, answerSeconds: 120, maxTakes: 1 },
    "In Ihrer Firma wird diskutiert. Eine Kollegin sagt: „Handys sollten in Besprechungen verboten sein. Alle schauen nur noch auf ihr Telefon.“\n\n" +
      "Sagen Sie Ihre Meinung dazu. Begründen Sie sie, nennen Sie ein Beispiel und machen Sie einen Kompromissvorschlag.",
    [
      "klare eigene Position",
      "mindestens zwei Gründe",
      "ein konkretes Beispiel",
      "Kompromissvorschlag (z. B. feste Regeln, Ausnahmen)",
    ],
    [
      "Ihre Meinung",
      "Gründe",
      "ein Beispiel",
      "ein Kompromissvorschlag",
    ],
    `Meinung äußern und begründen, Diskussion im Arbeitskontext. ${SPEAK_NOTE}`),
  ...pictureTasks(),
  ...slideTalks(),
];

/** Picture task: describe the scene, compare it with the candidate's own city or region, give an opinion. */
function pictureTask(
  imageId: string,
  within: Within,
  question: string,
  contentPoints: string[],
  studentPoints: string[],
): SeedItem {
  return {
    section: "SPEAKING",
    level: LEVEL,
    type: "SPEAKING_PROMPT",
    skillTag: "speaking.picture",
    within,
    prompt:
      "Sehen Sie sich das Bild an. Beschreiben Sie, was Sie sehen, und vergleichen Sie es mit Ihren eigenen Erfahrungen in Ihrer Stadt oder Region.\n\n" + question,
    content: { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 90, maxTakes: 2, images: [img(imageId)] },
    key: { kind: "NONE" },
    rubric: { contentPoints, studentPoints },
    explanation: `Bildbeschreibung mit Vergleich zur eigenen Erfahrung (B1): beschreiben, vergleichen, Meinung begründen. ${SPEAK_NOTE}`,
  };
}

function pictureTasks(): SeedItem[] {
  return [
    pictureTask("scene.b1.city-cycling", "EASY",
      "Wie kommen die Menschen in Ihrer Stadt oder Region meistens zur Arbeit, zur Schule oder zum Einkaufen? Was spricht für oder gegen das Fahrrad in der Stadt? Fahren Sie selbst gern Fahrrad? Warum (nicht)?",
      [
        "beschreibt das Bild: viele Menschen fahren in einer Stadt mit dem Fahrrad",
        "vergleicht mit der eigenen Stadt oder Region (Radwege, Verkehrsmittel, Wege im Alltag)",
        "nennt mindestens einen Vor- oder Nachteil des Radfahrens in der Stadt",
        "äußert und begründet eine eigene Meinung",
      ],
      ["was auf dem Bild zu sehen ist", "wie die Menschen in Ihrer Stadt oder Region unterwegs sind", "Vor- und Nachteile des Fahrrads in der Stadt", "Ihre Meinung"]),
    pictureTask("scene.b1.home-office", "MID",
      "Haben Sie schon einmal zu Hause gearbeitet oder gelernt? Wie ist das bei Menschen in Ihrer Stadt oder Region? Was sind Vor- und Nachteile?",
      [
        "beschreibt das Bild: eine junge Frau arbeitet zu Hause am Laptop",
        "berichtet von eigener Erfahrung oder von Erfahrungen in der Stadt oder Region",
        "nennt Vorteile und Nachteile der Arbeit oder des Lernens zu Hause",
        "äußert und begründet eine eigene Meinung",
      ],
      ["was auf dem Bild zu sehen ist", "Ihre eigene Erfahrung", "Vor- und Nachteile", "Ihre Meinung"]),
    pictureTask("scene.b1.library-study-group", "MID",
      "Wo lernen Sie am liebsten? Gibt es in Ihrer Stadt oder Region Orte zum gemeinsamen Lernen? Lernen Sie lieber allein oder in der Gruppe? Warum?",
      [
        "beschreibt das Bild: eine Gruppe von Studierenden lernt zusammen an einem Tisch",
        "erzählt, wo man selbst am liebsten lernt",
        "beschreibt Orte zum Lernen in der eigenen Stadt oder Region",
        "nennt Vor- oder Nachteile des Lernens in der Gruppe und begründet die eigene Meinung",
      ],
      ["was auf dem Bild zu sehen ist", "wo Sie am liebsten lernen", "Orte zum Lernen in Ihrer Stadt oder Region", "allein oder in der Gruppe: Ihre Meinung mit Gründen"]),
    pictureTask("scene.b1.open-air-concert", "MID",
      "Waren Sie schon einmal bei einem Konzert oder einem Fest im Freien? Was gibt es in Ihrer Stadt oder Region für Veranstaltungen? Gehen Sie gern hin?",
      [
        "beschreibt das Bild: eine große Menschenmenge hört ein Konzert im Freien",
        "erzählt von eigenen Erfahrungen mit Konzerten oder Festen",
        "nennt Veranstaltungen in der eigenen Stadt oder Region",
        "begründet, ob man gern zu solchen Veranstaltungen geht",
      ],
      ["was auf dem Bild zu sehen ist", "Ihre Erfahrung mit Veranstaltungen im Freien", "Veranstaltungen in Ihrer Stadt oder Region", "Ihre Meinung"]),
    pictureTask("scene.b1.volunteers", "HARD",
      "Haben Sie oder Menschen in Ihrer Umgebung schon einmal freiwillig bei so einer Aktion geholfen? Was gibt es in Ihrer Stadt oder Region? Warum ist das wichtig?",
      [
        "beschreibt das Bild: Freiwillige in hellblauen Hemden sammeln Müll mit Müllsäcken",
        "erzählt von eigener Erfahrung mit freiwilliger Hilfe oder von Aktionen in der Stadt oder Region",
        "erklärt, warum solche Aktionen wichtig sind (Umwelt, Gemeinschaft)",
        "äußert und begründet eine eigene Meinung",
      ],
      ["was auf dem Bild zu sehen ist", "Erfahrungen mit freiwilliger Hilfe", "Aktionen in Ihrer Stadt oder Region", "warum das wichtig ist", "Ihre Meinung"]),
  ];
}

/** Slide talk: a short presentation along five given slide titles. */
function slideTalk(
  within: Within,
  timing: { thinkSeconds: number; answerSeconds: number },
  topic: string,
  contentPoints: string[],
  studentPoints: string[],
): SeedItem {
  const slideTitles =
    "Folie 1: Einleitung\n" +
    "Folie 2: Eigene Erfahrung\n" +
    "Folie 3: Situation in Ihrer Stadt oder Region\n" +
    "Folie 4: Vor- und Nachteile, Ihre Meinung\n" +
    "Folie 5: Schluss und Dank";
  return {
    section: "SPEAKING",
    level: LEVEL,
    type: "SPEAKING_PROMPT",
    skillTag: "speaking.slidetalk",
    within,
    prompt:
      `Halten Sie eine kurze Präsentation zum Thema „${topic}“. Sie haben fünf Folien mit diesen Titeln:\n\n${slideTitles}\n\n` +
      "Sprechen Sie zu jeder Folie ein paar Sätze und halten Sie die ganze Präsentation in der vorgegebenen Zeit.",
    content: { kind: "SPEAKING", ...timing, maxTakes: 1 },
    key: { kind: "NONE" },
    rubric: { contentPoints, studentPoints },
    explanation: `Präsentation entlang von fünf vorgegebenen Folientiteln (Goethe B1 Sprechen Teil 2); alle fünf Folien müssen angemessen behandelt werden. ${SPEAK_NOTE}`,
  };
}

function slideTalks(): SeedItem[] {
  const points = (topic: string) => [
    `Einleitung: stellt das Thema „${topic}“ vor`,
    "eigene Erfahrung mit dem Thema",
    "Situation in der eigenen Stadt oder Region",
    "Vor- und Nachteile, mit eigener Meinung",
    "Schluss und Dank",
  ];
  const student = [
    "das Thema vorstellen",
    "Ihre eigene Erfahrung",
    "die Situation in Ihrer Stadt oder Region",
    "Vor- und Nachteile, Ihre Meinung",
    "Schluss und Dank",
  ];
  return [
    slideTalk("MID", { thinkSeconds: 90, answerSeconds: 150 }, "Mit dem Fahrrad durch die Stadt", points("Fahrrad in der Stadt"), student),
    slideTalk("MID", { thinkSeconds: 90, answerSeconds: 150 }, "Freiwillige Arbeit im Verein oder in der Nachbarschaft", points("freiwillige Arbeit"), student),
    slideTalk("HARD", { thinkSeconds: 120, answerSeconds: 180 }, "Bücher lesen: Papier oder Bildschirm?", points("Lesen auf Papier oder Bildschirm"), student),
  ];
}

export const B1_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = {
  grammar: { stimuli: [], items: [...grammarItems, ...grammarTexts] },
  reading: { stimuli: [rEmail, rArtikel, rAnzeigen, rRegeln, rForum, rNews, rHund, rMarkt, rChor, rSonntag, rWohnen, rUrlaub], items: readingItems },
  listening: { stimuli: [lMailbox, lFuehrung, lGespraech, lWerkstatt, lFreibad, lTanzkurs, lGrillparty, lBahn], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
