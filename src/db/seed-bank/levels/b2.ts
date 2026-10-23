import type { TfngValue } from "@/lib/exam/types";
import { cloze } from "../cloze";
import { cTest } from "../ctest";
import { openCloze } from "../opencloze";
import { img } from "../image";
import { wordBank } from "../wordbank";
import type { SeedBankPart, SeedItem, SeedStimulus } from "../types";

/*
 * A seed item's text is part of its seed key (seed-key.ts). Changing the
 * wording of an item here makes it a new item: the bank top-up then adds it
 * next to the old one in every organisation that already has the old one. To
 * fix wording, add a new item (and retire the old row) rather than editing.
 *
 * Listening scripts are never updated in place (the audio is made from them):
 * a rewritten script gets a new stimulus key (suffix -v3).
 */

/**
 * B2 starter bank, written against docs/EXAM-BANK-RESEARCH.md (B2 section) and the
 * ÖSD / telc / TestDaF findings of 2026-10-19 (docs/research/exam-sources-2026-10-19):
 * - Grammar: 24 single items (8 EASY, 11 MID, 5 HARD) over the B2 inventory, plus three C-tests,
 *   three MC cloze texts and three word banks (spec 2026-10-18).
 * - Reading: 7 texts (opinion set, article, sentence-gap text, rules, ads with a two-constraint
 *   matching task, news item, blog post).
 * - Listening: 6 clips (expert interview, short lecture, conversation, voicemail with typed notes,
 *   station announcement, street interview).
 * - Writing: 8 prompts (forum opinions, formal messages, a complaint built on an ad plus notes).
 * - Speaking: 7 prompts (talks, discussions, report, message, assigned-role debate).
 * - Round 2 additions: reading insertion 5/7 (x3) and opinion matching (x3); listening who-says-what
 *   with three voices (x3) and play-once clips (x3); Sprachbausteine-15 word banks (x3, 10 gaps,
 *   5 distractors); open cloze (x3); speaking picture tasks (x4). Every cloze and word-bank gap
 *   carries a #topic.
 *
 * Single-choice options are four; the key position is set explicitly per item and spread over
 * a to d. True/false/not-in-text sets differ in how many NG statements they hold and where.
 */

const LEVEL = "B2" as const;

type Within = NonNullable<SeedItem["within"]>;
type Pos = 0 | 1 | 2 | 3;
const IDS = ["a", "b", "c", "d"] as const;

function choiceContent(options: [string, string, string, string], correct: Pos) {
  return {
    content: { kind: "CHOICE" as const, options: options.map((text, i) => ({ id: IDS[i], text })) },
    key: { kind: "CHOICE" as const, correct: [IDS[correct]] },
  };
}

function tfngContent(statements: Array<[string, TfngValue]>) {
  const ids = statements.map((_, i) => `s${i + 1}`);
  return {
    content: { kind: "TFNG" as const, statements: statements.map(([text], i) => ({ id: ids[i], text })) },
    key: { kind: "TFNG" as const, answers: Object.fromEntries(statements.map(([, v], i) => [ids[i], v])) },
  };
}

function matchContent(left: string[], right: string[], pairs: number[]) {
  return {
    content: {
      kind: "MATCHING" as const,
      left: left.map((text, i) => ({ id: `l${i + 1}`, text })),
      right: right.map((text, i) => ({ id: `r${i + 1}`, text })),
    },
    /** pairs[i] is the 1-based position in `right` that left row i belongs to. */
    key: { kind: "MATCHING" as const, pairs: Object.fromEntries(pairs.map((r, i) => [`l${i + 1}`, `r${r}`])) },
  };
}

// ================================================================ GRAMMAR

function gChoice(
  skill: string,
  within: Within,
  prompt: string,
  options: [string, string, string, string],
  correct: Pos,
  explanation: string,
): SeedItem {
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

/** One gap `{{g1}}`. With `choices` it is a drop-down, without it the student types. */
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
  // ------------------------------------------------------------ EASY
  gChoice("passiversatz", "EASY",
    "Das Problem mit dem Drucker ___ sich zum Glück schnell beheben.",
    ["ließ", "wurde", "hatte", "konnte"], 0,
    "Passiversatz mit „sich lassen“ + Infinitiv (= konnte behoben werden). „wurde sich“, „hatte sich ... beheben“ und „konnte sich ... beheben“ sind ohne „lassen“ nicht möglich."),
  gChoice("passiv", "EASY",
    "Der Vertrag ist erst gestern unterschrieben ___.",
    ["werden", "worden", "geworden", "wurden"], 1,
    "Perfekt Passiv: ist + Partizip II + worden. „werden“ ist der Infinitiv, „geworden“ gehört zum Vollverb „werden“ (Zustandsveränderung), „wurden“ ist Präteritum und passt nicht zu „ist“."),
  gChoice("konjunktiv2_vergangenheit", "EASY",
    "Wenn ich das gewusst ___, wäre ich früher gekommen.",
    ["wäre", "würde", "hätte", "hatte"], 2,
    "Irrealer Bedingungssatz der Vergangenheit: hätte/wäre + Partizip II. „wissen“ bildet das Perfekt mit „haben“, also „gewusst hätte“. „hatte“ ist Indikativ."),
  gChoice("konnektoren", "MID",
    "Ob wir mit dem Rad oder mit dem Bus fahren, entscheiden wir je ___, wie das Wetter wird.",
    ["danach", "davon", "dann", "nachdem"], 3,
    "Feste Wendung „je nachdem, wie ...“ (= abhängig davon, wie). „danach“, „davon“ und „dann“ bilden mit „je“ keine Wendung."),
  gChoice("funktionsverbgefuege", "EASY",
    "Bitte setzen Sie mich rechtzeitig in ___, falls sich der Termin ändert.",
    ["Kenntnis", "Wissen", "Erfahrung", "Gewissheit"], 0,
    "Feste Verbindung: jemanden von etwas in Kenntnis setzen (= informieren). Mit den anderen Nomen gibt es das Funktionsverbgefüge nicht (vgl. „in Erfahrung bringen“)."),
  gChoice("konnektoren", "MID",
    "Er hat nicht einmal angerufen, geschweige ___ sich entschuldigt.",
    ["wenn", "denn", "weil", "dass"], 1,
    "Feste Wendung „geschweige denn“ (= erst recht nicht). „wenn“, „weil“ und „dass“ sind keine Partner von „geschweige“."),
  gChoice("genitivpraepositionen", "EASY",
    "Die Abschiedsfeier findet bei gutem Wetter ___ des Gebäudes auf der Terrasse statt.",
    ["innerhalb", "oberhalb", "außerhalb", "unterhalb"], 2,
    "Die Terrasse liegt außerhalb des Gebäudes: „außerhalb“ + Genitiv. „innerhalb“ widerspricht „auf der Terrasse“, „oberhalb“ und „unterhalb“ beschreiben eine Lage über bzw. unter dem Gebäude."),
  gGap("nominalisierung", "EASY",
    "Ergänzen Sie das passende Nomen zu „ankommen“. Bei Ihrer {{g1}} im Hotel erhalten Sie sofort den Zimmerschlüssel.",
    ["Ankunft"], undefined,
    "Nominalisierung von „ankommen“: die Ankunft (Femininum, passt zu „Ihrer“ im Dativ)."),

  // ------------------------------------------------------------ MID
  gGap("passiversatz", "MID",
    "Der Ausweis ist bei jedem Besuch am Empfang {{g1}}.",
    ["vorzuzeigen"], ["vorzeigen", "vorzuzeigen", "vorgezeigt"],
    "Passiversatz sein + zu + Infinitiv (= muss vorgezeigt werden). Bei trennbaren Verben steht „zu“ zwischen Präfix und Stamm: vorzuzeigen. „ist vorgezeigt“ beschreibt einen Zustand und passt nicht zu „bei jedem Besuch“."),
  gGap("konjunktiv2_modal", "MID",
    "Ergänzen Sie die passende Form von „haben“. Ihr {{g1}} uns vorher Bescheid geben müssen. Jetzt ist es zu spät.",
    ["hättet"], undefined,
    "Konjunktiv II der Vergangenheit mit Modalverb: hätte + Infinitiv + Modalverb im Infinitiv (Ersatzinfinitiv). Zu „ihr“ gehört „hättet“."),
  gChoice("partizipattribut", "MID",
    "Wegen der ständig ___ Mieten suchen viele Familien eine kleinere Wohnung.",
    ["steigende", "gestiegen", "steigenden", "steigender"], 2,
    "Partizip I als Attribut wird wie ein Adjektiv dekliniert. Genitiv Plural nach bestimmtem Artikel: -en, also „der steigenden Mieten“."),
  gChoice("nominalisierung", "MID",
    "Welcher Satz hat dieselbe Bedeutung? „Weil der Zug Verspätung hatte, kam ich zu spät zur Arbeit.“",
    [
      "Trotz der Verspätung des Zuges kam ich zu spät zur Arbeit.",
      "Wegen der Verspätung des Zuges kam ich zu spät zur Arbeit.",
      "Seit der Verspätung des Zuges kam ich zu spät zur Arbeit.",
      "Ohne die Verspätung des Zuges kam ich zu spät zur Arbeit.",
    ], 1,
    "Ein kausaler weil-Satz wird nominal mit „wegen“ + Genitiv ausgedrückt. „trotz“ ist konzessiv, „seit“ temporal, „ohne“ drückt das Fehlen aus."),
  gChoice("funktionsverbgefuege", "MID",
    "Wir sollten auch eine Lösung ohne externe Beratung in Betracht ___.",
    ["nehmen", "ziehen", "bringen", "setzen"], 1,
    "Feste Verbindung: etwas in Betracht ziehen (= erwägen). „in Betracht nehmen“ ist eine typische Vermischung mit „in Kauf nehmen“."),
  gChoice("konnektoren", "MID",
    "Man kann im Büro viel Energie sparen, ___ man abends alle Geräte ausschaltet.",
    ["indem", "sodass", "damit", "obwohl"], 0,
    "„indem“ nennt das Mittel bzw. die Art und Weise (Wie spart man Energie?). „sodass“ (Folge) und „damit“ (Zweck) ergeben hier keinen Sinn."),
  gChoice("konnektoren", "MID",
    "Einerseits möchte ich mehr Zeit mit meiner Familie verbringen, ___ brauche ich das zusätzliche Geld.",
    ["deshalb", "sonst", "also", "andererseits"], 3,
    "Zweiteiliger Konnektor „einerseits ... andererseits“ stellt zwei Gesichtspunkte gegenüber. „deshalb“ und „also“ nennen eine Folge, „sonst“ eine Bedingung; mit „brauche ich das Geld“ ergeben sie keinen logischen Zusammenhang."),
  gChoice("relativsaetze", "MID",
    "Die Kollegin, ___ Projekt wir übernehmen, ist bis Freitag im Urlaub.",
    ["deren", "dessen", "der", "die"], 0,
    "Genitivattribut im Relativsatz: Bezugswort „Kollegin“ (feminin), also „deren Projekt“. „dessen“ bezieht sich auf maskuline oder neutrale Nomen; „der“ (Dativ) und „die“ (Nominativ/Akkusativ) drücken kein Besitzverhältnis aus."),
  gChoice("reflexivpronomen", "MID",
    "Ich habe ___ fest vorgenommen, ab Montag früher aufzustehen.",
    ["mich", "mir", "uns", "sich"], 1,
    "„sich etwas vornehmen“: Das Reflexivpronomen steht im Dativ, weil „etwas“ (hier der Infinitivsatz) das Akkusativobjekt ist. „mich“ wäre Akkusativ, „uns“ und „sich“ passen nicht zur 1. Person Singular."),
  gChoice("genitivpraepositionen", "MID",
    "___ eines einfachen Beispiels erklärte der Dozent das Verfahren.",
    ["Infolge", "Trotz", "Anhand", "Wegen"], 2,
    "„anhand“ + Genitiv nennt das Hilfsmittel, an dem man etwas zeigt. „infolge“ (Folge), „trotz“ (Gegensatz) und „wegen“ (Grund) ergeben mit „erklärte ... das Verfahren“ keinen sinnvollen Satz."),
  gGap("konjunktiv1", "MID",
    "Ergänzen Sie die indirekte Rede im Konjunktiv I. „Ich habe den Brief nicht erhalten.“ Sie sagt, sie {{g1}} den Brief nicht erhalten.",
    ["habe"], undefined,
    "Konjunktiv I, 3. Person Singular von „haben“: Stamm + e = „habe“. Die Form ist vom Indikativ („hat“) unterscheidbar, deshalb ist keine Ersatzform (Konjunktiv II) nötig."),

  // ------------------------------------------------------------ HARD
  gChoice("passiv", "HARD",
    "Der Fehler hätte viel früher bemerkt werden ___.",
    ["müssen", "gemusst", "musste", "müsste"], 0,
    "Konjunktiv II Vergangenheit Passiv mit Modalverb: hätte + Partizip II + werden + Modalverb im Infinitiv (Ersatzinfinitiv), nicht „gemusst“."),
  gGap("passiversatz", "HARD",
    "Ergänzen Sie ein Adjektiv auf -bar. Man kann dieses Problem nicht in einer Woche lösen. = Dieses Problem ist in einer Woche nicht {{g1}}.",
    ["lösbar"], undefined,
    "Passiversatz mit Adjektiv auf -bar: lösbar = kann gelöst werden."),
  gChoice("partizipattribut", "HARD",
    "Was bedeutet: „die von der Abteilung im letzten Quartal eingeführten Regeln“?",
    [
      "die Regeln, die die Abteilung im letzten Quartal einführen sollte",
      "die Regeln, die für die Abteilung schon vor dem letzten Quartal galten",
      "die Regeln, die die Abteilung im letzten Quartal eingeführt hat",
      "die Regeln, die die Abteilung im letzten Quartal abgeschafft hat",
    ], 2,
    "Erweitertes Partizipialattribut mit Partizip II: passivische, abgeschlossene Handlung; „von der Abteilung“ nennt den Handelnden. Auflösung als Relativsatz im Aktiv."),
  gChoice("konnektoren", "HARD",
    "Die Sitzung beginnt pünktlich um neun, ___ es gibt technische Probleme.",
    ["sofern", "es sei denn", "außer wenn", "obwohl"], 1,
    "Nach „es sei denn“ kann ein Hauptsatz mit Verb an zweiter Stelle folgen („es gibt“). „sofern“ und „außer wenn“ leiten Nebensätze ein und verlangen Verbendstellung."),
  gChoice("praepositionaladverbien", "HARD",
    "Es kommt ___ an, ob wir den Termin einhalten können.",
    ["davon", "dafür", "daran", "darauf"], 3,
    "„ankommen auf“ + Akkusativ: Das Präpositionaladverb vor dem ob-Satz lautet „darauf“. „davon“, „dafür“ und „daran“ gehören zu anderen Verben (abhängen von, sorgen für, liegen an)."),
];


const grammarCTest = cTest(LEVEL, "MID", {
  first: "Immer mehr Beschäftigte arbeiten heute zumindest teilweise von zu Hause aus.",
  body:
    "Für viele bedeutet das mehr Freiheit, weil sie sich ihre Zeit selbst einteilen können. " +
    "Gleichzeitig entstehen aber auch neue Probleme, denn die Grenze zwischen Beruf und Privatleben wird oft unscharf. " +
    "Wer nach Feierabend noch Nachrichten beantwortet, findet schwerer zur Ruhe.",
  last: "Fachleute empfehlen deshalb feste Arbeitszeiten und einen eigenen Arbeitsplatz in der Wohnung.",
  // g2 das/dies, g3 Freiheit/Freiheiten/Freizeit/Freiraum, g6 selbst/selber are equally correct here.
  // g14 wird/wirkt: "die Grenze ... wirkt oft unscharf" is grammatical and fits the context.
  // g19 schwerer/schwer: "findet schwer zur Ruhe" is equally idiomatic.
  variants: { 2: ["ies"], 3: ["zeit", "raum", "heiten"], 6: ["ber"], 14: ["rkt"], 19: ["er"] },
  // Wrong parts by the gap whose stem they target.
  distractors: {
    1: ["el"], 2: ["ass"], 3: ["tag"], 4: ["ind"],
    5: ["ren"], 6: ["be"], 7: ["nt"], 8: ["teht"],
    10: ["lem"], 11: ["en"], 13: ["nter"], 14: ["rken"],
    15: ["harfe"], 16: ["chts"], 18: ["worten"],
  },
});

// Friendship and social media.
const grammarCTest2 = cTest(LEVEL, "MID", {
  first:
    "Für viele Jugendliche gehören soziale Medien heute ganz selbstverständlich zum Alltag, vom ersten Blick aufs Handy am Morgen bis spät in die Nacht.",
  body:
    "Sie ermöglichen es, mit Freunden in Kontakt zu bleiben, auch wenn man sich selten sieht. " +
    "Allerdings kann eine kurze Nachricht kein echtes Gespräch ersetzen. " +
    "Wer ständig das eigene Leben mit den scheinbar perfekten Bildern anderer vergleicht, fühlt sich zudem oft unzufrieden.",
  last: "Für echte Freundschaften bleiben gemeinsame Erlebnisse deshalb auch im digitalen Zeitalter unverzichtbar.",
  // g7 selten/seltener: "wenn man sich seltener sieht" is equally correct.
  variants: { 7: ["tener"] },
  // Wrong parts by the gap whose stem they target.
  distractors: {
    1: ["licht"], 2: ["ir"], 3: ["st"], 4: ["um"],
    6: ["ich"], 7: ["tene"], 9: ["nen"], 10: ["richten"],
    11: ["te"], 12: ["tzt"], 13: ["ndige"], 14: ["enes"],
    15: ["ehr"], 17: ["der"], 19: ["nd"],
  },
});

// Volunteering in the neighbourhood.
const grammarCTest3 = cTest(LEVEL, "MID", {
  first: "In vielen Stadtvierteln engagieren sich Menschen ehrenamtlich für ihre Nachbarschaft.",
  body:
    "Sie helfen älteren Menschen beim Einkaufen oder kümmern sich um den Spielplatz. " +
    "Obwohl sie dafür kein Geld bekommen, empfinden die meisten ihren Einsatz als Bereicherung. " +
    "Wer sich für andere einsetzt, gewinnt nämlich nicht nur neue Kontakte, sondern auch mehr Selbstvertrauen.",
  last:
    "Gerade für Jugendliche ist ein Ehrenamt daher eine gute Gelegenheit, Verantwortung zu übernehmen und herauszufinden, was ihnen wirklich wichtig ist.",
  // g3 "Eink...": "beim Einkauf" is as correct as "beim Einkaufen".
  // g8 "ke...": "keinerlei Geld" is as correct as "kein Geld".
  variants: { 3: ["auf"], 8: ["inerlei"] },
  // Wrong parts by the gap whose stem they target.
  distractors: {
    1: ["fe"], 2: ["che"], 3: ["äufe"], 4: ["mert"],
    5: ["nd"], 6: ["plätze"], 7: ["ich"], 8: ["inen"],
    9: ["mmt"], 10: ["as"], 11: ["rem"], 12: ["n"],
    13: ["enn"], 15: ["etzen"], 17: ["ach"],
  },
});

// MC cloze texts and word banks (spec 2026-10-18), each set easy to hard.
const grammarTexts: SeedItem[] = [
  cloze(LEVEL, "EASY", {
    title: "Lebensmittel retten",
    first: "In Deutschland landen jedes Jahr Millionen Tonnen Lebensmittel im Müll, obwohl vieles davon noch genießbar wäre.",
    body:
      "Viele dieser Lebensmittel [[werden|wird|worden|geworden#passiv.praesens]] schon in privaten Haushalten weggeworfen. " +
      "Manche Menschen kaufen mehr ein, [[als|wie|ob|dass#konnektor]] sie wirklich brauchen. " +
      "Außerdem verwechseln viele das Mindesthaltbarkeitsdatum [[mit|von|zu|für#verb_praeposition]] dem Verbrauchsdatum. " +
      "Dabei sind die meisten Produkte auch nach [[dem|den|der|des#praeposition]] angegebenen Datum noch in Ordnung. " +
      "Um das Problem zu verringern, [[haben|sind|wurden|werden#perfekt.hilfsverb]] einige Bäckereien eine einfache Idee entwickelt: " +
      "Sie verkaufen Brot vom Vortag [[zu|für|um|auf#praeposition]] einem deutlich niedrigeren Preis. " +
      "Kunden, [[denen|die|deren|dessen#relativsatz]] es auf jeden Euro ankommt, sparen so Geld, und weniger Brot landet im Müll, [[was|wer|wo|dass#relativsatz.was]] auch der Umwelt hilft. " +
      "Auch in Restaurants [[gibt|ist|hat|wird#praesens.vokalwechsel]] es noch viel Spielraum. " +
      "Viele Gäste trauen sich nicht, nach einer Box [[für|zu|an|mit#praeposition]] ihre Reste zu fragen. " +
      "[[Statt|Um|Außer|Bis#infinitiv]] das Essen auf dem Teller zu lassen, sollten sie ruhig fragen.",
    last: "Die meisten Restaurants geben ihren Gästen die Reste nämlich gern mit.",
    note: "Passiv im Präsens (g1), Vergleich mit als (g2), verwechseln mit (g3), nach + Dativ (g4), Perfekt mit haben (g5), zu einem Preis (g6), Relativpronomen im Dativ bei es kommt jemandem auf etwas an (g7), weiterführender Relativsatz mit was (g8), es gibt (g9), Box für + Akkusativ (g10), statt ... zu + Infinitiv (g11).",
  }),
  cloze(LEVEL, "MID", {
    title: "Ein Museum erfindet sich neu",
    first: "Das Stadtmuseum einer Kleinstadt am Rhein hatte lange mit sinkenden Besucherzahlen zu kämpfen.",
    body:
      "Vor zwei Jahren [[wurde|wird|würde|hat#passiv]] deshalb ein neues Konzept entwickelt. " +
      "Die seit Jahrzehnten kaum [[veränderte|verändernde|veränderten|verändert#partizipattribut]] Ausstellung wurde komplett neu gestaltet, und das Museum blieb dafür ein Jahr lang geschlossen. " +
      "Heute dürfen Besucher viele Objekte selbst [[anfassen|angefasst|anzufassen|anfasst#modalverb.satzklammer]] und ausprobieren. " +
      "Außerdem gibt es nun ein Café, [[in|an|auf|über#relativsatz.praeposition]] dem regelmäßig Lesungen und Konzerte stattfinden. " +
      "Besonders beliebt sind die Führungen für Familien, bei [[denen|die|deren|dem#relativsatz.praeposition]] Kinder in historische Kostüme schlüpfen dürfen. " +
      "[[Trotz|Wegen|Dank|Durch#genitiv.praeposition]] der hohen Kosten für den Umbau sind die Eintrittspreise kaum gestiegen. " +
      "Das liegt vor allem [[daran|darauf|dafür|davon#praepositionaladverb]], dass die Stadt einen großen Teil der Kosten übernommen hat. " +
      "Seit der Wiedereröffnung kommen dreimal so viele Besucher [[wie|als|denn|wenn#adjektiv.komparativ]] vorher. " +
      "Die Museumsleiterin freut sich [[über|auf|an|von#verb_praeposition]] diesen Erfolg und ist überzeugt, dass sich der Aufwand [[gelohnt|lohnte|lohnt|lohnen#perfekt.partizip]] hat.",
    last: "Inzwischen interessieren sich auch andere Museen der Region für das Konzept.",
    note: "Passiv im Präteritum (g1), Partizipialattribut (g2), Modalverb + Infinitiv (g3), Relativsatz mit Präposition (g4), Präposition + Relativpronomen im Dativ Plural (g5), trotz + Genitiv (g6), liegen an mit Präpositionaladverb (g7), so viele ... wie (g8), sich freuen über (g9), Partizip II im Perfekt (g10).",
  }),
  cloze(LEVEL, "HARD", {
    title: "Die Rückkehr der Nachtzüge",
    first: "Lange Zeit galten Nachtzüge in Europa als altmodisch und unwirtschaftlich.",
    body:
      "[[Nachdem|Bevor|Obwohl|Solange#konnektor]] viele Verbindungen in den vergangenen Jahrzehnten eingestellt worden waren, schien das Ende dieser Reiseform gekommen. " +
      "Doch seit einigen Jahren ist die Nachfrage wieder deutlich [[gestiegen|gestiegene|stieg|steigen#perfekt.partizip]]. " +
      "Immer mehr Reisende verzichten bewusst [[auf|für|an|von#verb_praeposition]] Kurzstreckenflüge und wählen stattdessen die Bahn. " +
      "[[Je|Desto|Umso|Mehr#konnektor.zweiteilig]] länger die Strecke ist, desto attraktiver wird der Nachtzug im Vergleich zum Flugzeug. " +
      "Die Betreiber stehen allerdings [[vor|von|bei|aus#praeposition]] großen Herausforderungen. " +
      "Viele der eingesetzten Waggons sind mehrere Jahrzehnte alt und müssen dringend [[ersetzt|ersetzen|ersetzten|ersetze#passiv.modal]] werden. " +
      "Neue Schlafwagen sind jedoch so teuer, [[dass|damit|ob|wenn#konnektor]] sich viele Unternehmen eine Bestellung gut überlegen. " +
      "Hinzu kommen hohe Gebühren für die Nutzung der Schienen, [[die|denen|deren|das#relativsatz]] in jedem Land anders ausfallen. " +
      "Fachleute fordern daher eine stärkere [[Förderung|Fördern|Förderer|fördernde#nominalisierung]] durch den Staat. " +
      "Ob sich das Angebot langfristig [[durchsetzt|durchsetzen|durchgesetzt|durchzusetzen#trennbares_verb]], hängt also nicht zuletzt [[von|an|auf|für#verb_praeposition]] politischen Entscheidungen ab.",
    last: "Für viele Reisende ist die Nacht im Zug jedenfalls schon heute eine echte Alternative.",
    note: "nachdem mit Plusquamperfekt Passiv (g1), Perfekt mit sein (g2), verzichten auf (g3), je ... desto (g4), stehen vor (g5), Passiv mit Modalverb (g6), so ... dass (g7), Relativpronomen im Nominativ Plural (g8), Nominalisierung (g9), ob-Satz mit trennbarem Verb (g10), abhängen von (g11).",
  }),
  wordBank(LEVEL, "EASY", {
    title: "Das Repair-Café",
    first: "In vielen Städten gibt es inzwischen Repair-Cafés, in denen Freiwillige kaputte Geräte gemeinsam mit ihren Besitzern reparieren.",
    body:
      "Die Idee ist einfach: Man bringt einen defekten Toaster vorbei, [[anstatt#konnektor]] ihn wegzuwerfen. " +
      "Häufig ist nur ein kleines [[Bauteil#vocabulary]] beschädigt, das sich problemlos austauschen lässt. " +
      "Die Freiwilligen haben viel [[Erfahrung#vocabulary]], weil viele von ihnen früher in einem Handwerk gearbeitet haben. " +
      "Die Hilfe selbst ist [[kostenlos#vocabulary]], man zahlt nur [[für#praeposition]] die Materialien. " +
      "Viele Besucher [[genießen#vocabulary]] außerdem die Gelegenheit, mit Menschen aus der Nachbarschaft ins Gespräch zu kommen. " +
      "Für die Umwelt ist das Prinzip ein großer [[Gewinn#vocabulary]], [[denn#konnektor]] jedes reparierte Gerät bedeutet weniger Müll. " +
      "Kritiker bemängeln allerdings, dass viele moderne Geräte kaum zu öffnen sind. " +
      "Sie fordern deshalb strengere Vorschriften für die Hersteller.",
    last: "Bis es so weit ist, bleibt das Repair-Café für viele eine gute Alternative zum Neukauf.",
    distractors: ["durch", "vermeiden", "obwohl", "Müll", "teuer"],
  }),
  wordBank(LEVEL, "MID", {
    title: "Ein Garten für alle",
    first: "Auf einer ehemaligen Brachfläche mitten in Hannover ist vor drei Jahren ein Gemeinschaftsgarten entstanden.",
    body:
      "Rund vierzig Anwohnerinnen und Anwohner [[bewirtschaften#vocabulary]] die Beete gemeinsam und teilen sich die Ernte. " +
      "Wer mitmachen möchte, braucht kein [[Vorwissen#vocabulary]], [[da#konnektor]] erfahrene Mitglieder den Neuen alles zeigen. " +
      "Die Aufgaben werden in einem Plan [[festgelegt#vocabulary]], damit jeder weiß, wann er mit dem Gießen an der Reihe ist. " +
      "Viele berichten, dass ihnen die Gartenarbeit nach einem [[stressigen#vocabulary]] Arbeitstag hilft abzuschalten. " +
      "Die Stadt [[unterstützt#vocabulary]] das Projekt, indem sie das Grundstück kostenlos zur Verfügung stellt. " +
      "[[Dank#genitiv.praeposition]] dieser Hilfe bleiben die Beiträge für die Mitglieder niedrig. " +
      "Allerdings ist der Vertrag mit der Stadt zunächst auf fünf Jahre befristet, und die Mitglieder hoffen [[darauf#praepositionaladverb]], dass er verlängert wird.",
    last: "Ein Sommerfest soll zeigen, wie wichtig der Garten inzwischen für das ganze Viertel geworden ist.",
    distractors: ["obwohl", "vergessen", "mühelosen", "verhindert", "Trotz"],
  }),
  wordBank(LEVEL, "HARD", {
    title: "Lärm in der Stadt",
    first: "Verkehrslärm gehört in deutschen Großstädten zu den häufigsten Gründen für Beschwerden von Anwohnern.",
    body:
      "Dauerhafter Lärm ist [[keineswegs#negation]] nur lästig, sondern kann auch der Gesundheit erheblich schaden. " +
      "Studien [[zufolge#praeposition]] erhöht er unter anderem das Risiko für Bluthochdruck und Schlafstörungen. " +
      "Viele Städte haben deshalb Maßnahmen ergriffen, [[um#infinitiv.umzu]] die Belastung zu verringern. " +
      "Auf zahlreichen Hauptstraßen wurde die zulässige [[Geschwindigkeit#vocabulary]] nachts auf 30 km/h begrenzt. " +
      "Außerdem wird an besonders belasteten Stellen ein spezieller Asphalt [[verlegt#vocabulary]], der deutlich leiser ist. " +
      "Kritiker [[bezweifeln#vocabulary]] jedoch, dass solche Schritte ausreichen. " +
      "Sie verweisen darauf, dass der Lärm erst dann spürbar [[abnimmt#trennbares_verb]], wenn insgesamt weniger Autos unterwegs sind. " +
      "Eine dauerhafte [[Lösung#vocabulary]] sehen sie daher vor allem im Ausbau von Bus, Bahn und Radwegen.",
    last: "Ob sich diese Forderung politisch durchsetzen lässt, wird sich in den kommenden Jahren zeigen.",
    distractors: ["gelegentlich", "damit", "Lautstärke", "entfernt", "befürchten"],
  }),
];

// Sprachbausteine-15 (telc style): ten gaps, a pool of fifteen words (five do not fit), function-word families.
const grammarSprachbausteine: SeedItem[] = [
  wordBank(LEVEL, "EASY", {
    title: "Mehr Platz für Fahrräder",
    first: "Immer mehr Städte wollen den Radverkehr fördern.",
    body:
      "In vielen Rathäusern wird [[darüber#praepositionaladverb]] gestritten, wie viel Straßenfläche den Fahrrädern zustehen soll. " +
      "Befürworter verweisen [[darauf#praepositionaladverb]], dass breite Radwege die Zahl der Unfälle verringern. " +
      "[[Während#praeposition.zeit]] der Hauptverkehrszeit sind manche Straßen so voll, dass Radfahrer kaum vorankommen. " +
      "Viele Menschen würden häufiger aufs Rad steigen, [[wenn#konnektor]] sie sich sicherer fühlten. " +
      "Gegner fürchten allerdings, dass zu viele Parkplätze wegfallen, [[sodass#konnektor]] Anwohner und Geschäfte darunter leiden. " +
      "Wer sein Rad abstellen will, [[muss#modalverb.konjugation]] oft lange nach einem freien Bügel suchen. " +
      "Deshalb [[müssen#modalverb.konjugation]] die Städte auch mehr sichere Abstellplätze bauen. " +
      "Die Stadt hat [[dafür#praepositionaladverb]] bereits zwei Millionen Euro bereitgestellt. " +
      "[[Trotz#praeposition]] der hohen Kosten halten die meisten Verwaltungen an ihren Plänen fest. " +
      "Sie sind sich einig, [[dass#konnektor]] etwas geschehen muss.",
    last: "Wie schnell sich die Straßen verändern, hängt am Ende von den Wählerinnen und Wählern ab.",
    distractors: ["entlang", "darin", "bevor", "anstatt", "weder"],
    note: "Präpositionaladverbien (g1, g2, g8), Zeitpräposition (g3), wenn und sodass (g4, g5), Verbform nach Subjekt (g6, g7), trotz + Genitiv (g9), dass-Satz (g10).",
  }),
  wordBank(LEVEL, "MID", {
    title: "Gebraucht statt neu kaufen",
    first: "Der Handel mit gebrauchten Waren wächst seit einigen Jahren stark.",
    body:
      "Ein Grund liegt [[darin#praepositionaladverb]], dass viele Menschen nachhaltiger leben möchten. " +
      "[[Angesichts#genitiv.praeposition]] steigender Preise schauen viele zuerst auf Online-Plattformen für Gebrauchtes. " +
      "Manche Käufer verkaufen ihre alten Geräte, [[bevor#konnektor]] sie ein neues Modell bestellen. " +
      "Andere sparen Geld, [[indem#konnektor.modal]] sie Kleidung tauschen, statt sie neu zu kaufen. " +
      "Händler berichten, dass sie [[dadurch#praepositionaladverb]] neue Kundschaft gewinnen. " +
      "Kritiker weisen allerdings [[darauf#praepositionaladverb]] hin, dass nicht jedes Angebot seriös ist. " +
      "Man sollte beim Kauf vorsichtig sein, [[zumal#konnektor]] Fälschungen im Internet häufig vorkommen. " +
      "[[Mithilfe#genitiv.praeposition]] einer einfachen Checkliste lässt sich vieles schnell prüfen. " +
      "Das Angebot wächst so schnell, [[dass#konnektor]] kaum jemand den Überblick behält. " +
      "[[Seitdem#konnektor]] viele Plattformen eine Käufergarantie anbieten, ist das Vertrauen der Kunden jedoch gestiegen.",
    last: "Gebrauchtes zu kaufen ist damit für viele längst keine Notlösung mehr.",
    distractors: ["darüber", "gegenüber", "weder", "ob", "worauf"],
    note: "liegen in (g1), Genitivpräpositionen angesichts und mithilfe (g2, g8), bevor, indem, zumal, seitdem (g3, g4, g7, g10), dadurch und hinweisen auf (g5, g6), so ... dass (g9).",
  }),
  wordBank(LEVEL, "HARD", {
    title: "Hitze in der Stadt",
    first: "Im Sommer heizen sich Innenstädte deutlich stärker auf als das Umland.",
    body:
      "Das liegt vor allem [[daran#praepositionaladverb]], dass Beton und Asphalt die Wärme speichern und nachts nur langsam abgeben. " +
      "[[Aufgrund#genitiv.praeposition]] der dichten Bebauung kann die Luft kaum zirkulieren. " +
      "[[Folglich#konnektor]] kühlen viele Straßen auch nach Sonnenuntergang kaum ab. " +
      "Besonders ältere Menschen leiden [[darunter#praepositionaladverb]], weil sie schlechter schlafen und häufiger Kreislaufprobleme bekommen. " +
      "Mehrere Städte pflanzen deshalb neue Bäume, [[wohingegen#konnektor]] andere vor allem Fassaden und Dächer begrünen. " +
      "[[Dennoch#konnektor.konzessiv]] reichen diese Maßnahmen allein nicht aus. " +
      "Auch Hausbesitzer [[können#modalverb.konjugation]] ihren Beitrag leisten, etwa durch helle Fassadenfarben. " +
      "Viele Fachleute fordern, bei Neubauten künftig mehr Grünflächen einzuplanen, [[andernfalls#konnektor]] werde sich das Problem verschärfen. " +
      "Außerdem sollten Anwohner [[dazu#praepositionaladverb]] ermutigt werden, Innenhöfe zu entsiegeln. " +
      "[[Sofern#konnektor]] die Kommunen dafür genug Geld bekommen, könnte sich die Lage in einigen Jahren spürbar verbessern.",
    last: "Bis dahin bleibt vielen Stadtbewohnern vor allem der Gang in den nächsten Park.",
    distractors: ["kann", "daraus", "mithilfe", "wovon", "hierfür"],
    note: "liegen an, leiden unter, ermutigen zu (g1, g4, g9), aufgrund + Genitiv (g2), Satzadverbien folglich, dennoch, andernfalls (g3, g6, g8), wohingegen (g5), Verbform nach Subjekt (g7), sofern mit Verbendstellung (g10).",
  }),
];

// Open cloze (ÖSD ZB2 / ZC1 style): the student types one word per gap.
const grammarOpen: SeedItem[] = [
  openCloze(LEVEL, "EASY", {
    title: "Ein Tag ohne Auto",
    first: "Letzten Monat haben wir in unserer Familie einen Tag ohne Auto ausprobiert.",
    body:
      "Normalerweise bringe ich meine Tochter [[mit#praeposition]] dem Auto zur Schule. " +
      "Diesmal haben wir uns [[dazu#praepositionaladverb]] entschlossen, den Bus zu nehmen. " +
      "Der Bus fährt allerdings schon um 7.10 Uhr ab, [[sodass/weshalb/weswegen#konnektor]] wir früher aufstehen mussten. " +
      "Meine Tochter fand das zuerst nicht lustig, [[denn#konnektor]] sie schläft morgens gern lang. " +
      "Im Bus haben wir [[uns#reflexiv]] aber lange unterhalten, und sie hat mir von einem Streit mit ihrer Freundin erzählt, über [[den/welchen#relativsatz.praeposition]] sie sich schon lange ärgerte. " +
      "Abends war ich [[viel/deutlich/wesentlich/erheblich#adjektiv.komparativ]] weniger gestresst als sonst, weil ich keinen Parkplatz suchen [[musste#modalverb.konjugation]]. " +
      "Ich habe mir fest vorgenommen, das [[öfter/häufiger/regelmäßig/mehrmals#adjektiv.komparativ]] zu wiederholen.",
    last: "Nur das frühe Aufstehen werde ich wahrscheinlich nie lieben.",
    note: "mit dem Auto, sich dazu entschließen, sodass, denn mit Hauptsatz, Reflexivpronomen, Relativpronomen mit Präposition, Steigerung mit viel, Modalverb im Präteritum, Adverb der Häufigkeit.",
  }),
  openCloze(LEVEL, "MID", {
    title: "Ein Tag im Tierheim",
    first: "Im Tierheim am Stadtrand arbeiten mehr als sechzig Ehrenamtliche.",
    body:
      "Viele von ihnen kommen jede Woche, [[obwohl/obgleich/wenngleich#konnektor.konzessiv]] sie dafür kein Geld bekommen. " +
      "Sie füttern die Tiere, reinigen die Käfige und gehen mit Hunden spazieren, [[die/welche#relativsatz]] sonst kaum Auslauf hätten. " +
      "Wer mitmachen möchte, muss zuerst eine Schulung besuchen, [[in/bei#relativsatz.praeposition]] der gezeigt wird, wie man mit ängstlichen Tieren umgeht. " +
      "Das Tierheim ist [[auf#verb_praeposition]] Spenden angewiesen, weil es keine staatliche Unterstützung erhält. " +
      "Besonders gefragt sind Sachspenden, [[wie/etwa#konnektor]] Decken oder Futter. " +
      "Wenn es mehr Geld [[gäbe#konjunktiv2]], könnte man ein zweites Gebäude bauen. " +
      "Im vergangenen Jahr [[wurden#passiv]] über vierhundert Tiere erfolgreich vermittelt. " +
      "Die Mitarbeitenden freuen sich [[über#verb_praeposition]] jede Hilfe, denn das Wohl [[der/aller/unserer#artikel]] Tiere steht für alle an erster Stelle. " +
      "Wer [[sich#reflexiv]] dafür interessiert, kann einfach vorbeikommen.",
    last: "Die Tür steht jeden Samstagvormittag offen.",
    note: "konzessiver Nebensatz, Relativpronomen im Nominativ Plural, Relativsatz mit Präposition, angewiesen auf, Vergleich mit wie, irrealer Wunsch im Konjunktiv II, Passiv im Präteritum, sich freuen über, Genitiv Plural, Reflexivpronomen.",
  }),
  openCloze(LEVEL, "HARD", {
    title: "Das Ende der Postkarte",
    first: "Früher gehörte die Postkarte zu jedem Urlaub, heute wird sie immer seltener verschickt.",
    body:
      "Die meisten Reisenden schicken stattdessen ein Foto per Handy, [[was#relativsatz.was]] schneller und billiger ist. " +
      "Ein Grund [[dafür/hierfür#praepositionaladverb]] ist, dass Nachrichten innerhalb von Sekunden ankommen. " +
      "Eine Karte aus Spanien braucht [[dagegen/hingegen/jedoch/aber#konnektor]] oft mehr als eine Woche. " +
      "Die Zahl [[der#artikel]] verschickten Karten sinkt seit Jahren. " +
      "Viele Verlage haben [[deshalb/daher/darum/deswegen#konnektor]] neue Motive entwickelt, die man selbst gestalten kann. " +
      "Auf manchen Karten [[wird#passiv.praesens]] heute zusätzlich ein QR-Code gedruckt, der zu einem Video führt. " +
      "Sammler schätzen vor allem handgeschriebene Grüße, [[deren#relativsatz]] Wert für sie weit über dem Preis einer Briefmarke liegt. " +
      "Viele halten [[an#verb_praeposition]] dieser Tradition fest, denn ohne diese Karten [[wäre#konjunktiv2.vergangenheit]] manche Reise nur halb so schön gewesen. " +
      "[[Trotz/Ungeachtet#praeposition]] der digitalen Konkurrenz bleibt der Briefkasten für viele ein Ort der Vorfreude.",
    last: "Und gerade das macht die Postkarte für sie unersetzlich.",
    note: "weiterführender Relativsatz mit was, Präpositionaladverb, Konnektor des Gegensatzes, Genitiv Plural, Konnektor der Folge, Passiv Präsens, Relativpronomen im Genitiv, festhalten an, Konjunktiv II der Vergangenheit, trotz + Genitiv.",
  }),
];

const grammar: SeedBankPart = {
  stimuli: [],
  items: [grammarCTest, grammarCTest2, grammarCTest3, ...grammarItems, ...grammarTexts, ...grammarSprachbausteine, ...grammarOpen],
};

// ================================================================ READING

type RSkill = "gist" | "detail" | "inference" | "vocabulary" | "structure";

function readingText(slug: string, title: string, topic: string, body: string): SeedStimulus {
  return { key: `v2-r-b2-${slug}`, section: "READING", level: LEVEL, title, topic, body: body.trim() };
}

function forText(stimulus: SeedStimulus) {
  const base = (skill: RSkill, within: Within, prompt: string, explanation: string) => ({
    section: "READING" as const,
    level: LEVEL,
    skillTag: `reading.${skill}`,
    within,
    stimulusKey: stimulus.key,
    prompt,
    explanation,
  });
  return {
    choice: (
      skill: RSkill,
      within: Within,
      prompt: string,
      options: [string, string, string, string],
      correct: Pos,
      explanation: string,
    ): SeedItem => ({ ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...choiceContent(options, correct) }),
    tfng: (
      skill: RSkill,
      within: Within,
      statements: Array<[string, TfngValue]>,
      explanation: string,
      prompt = "Richtig (R), falsch (F) oder steht nicht im Text (NG)? Entscheiden Sie für jede Aussage.",
    ): SeedItem => ({ ...base(skill, within, prompt, explanation), type: "TRUE_FALSE_NG", ...tfngContent(statements) }),
    match: (
      skill: RSkill,
      within: Within,
      prompt: string,
      left: string[],
      right: string[],
      pairs: number[],
      explanation: string,
    ): SeedItem => ({ ...base(skill, within, prompt, explanation), type: "MATCHING", ...matchContent(left, right, pairs) }),
  };
}

// ---------------------------------------------------------------- Text 1: opinion set

const rViertage = readingText(
  "viertagewoche",
  "Forum: Vier Tage arbeiten, drei Tage frei?",
  "Arbeit: Arbeitszeitmodelle",
  `
Ein Wirtschaftsmagazin hat seine Leserinnen und Leser gefragt: Ist die Vier-Tage-Woche ein Modell für alle? Hier sind fünf Antworten.

Selin K., Teamleiterin in einem Softwareunternehmen
Wir haben die Vier-Tage-Woche in meinem Team ein halbes Jahr lang getestet. Das Ergebnis hat mich überrascht: Die Arbeitsleistung ist gleich geblieben, die Krankmeldungen sind sogar zurückgegangen. Allerdings mussten wir vorher jede regelmäßige Besprechung auf den Prüfstand stellen und viele davon streichen. Meine Erfahrung ist: Das Modell funktioniert nur, wenn eine Firma ihre Leute an den Ergebnissen misst und nicht an den Stunden, die sie am Schreibtisch sitzen.

Jonas M., Inhaber einer Tischlerei mit sechs Beschäftigten
In großen Büros mag das klappen, in einem Handwerksbetrieb wie meinem sieht es anders aus. Unsere Kundschaft erwartet, dass wir an fünf Tagen erreichbar sind und Aufträge pünktlich fertig werden. Dafür bräuchte ich mindestens zwei zusätzliche Fachkräfte. Wir suchen aber schon seit über einem Jahr eine weitere Tischlerin oder einen Tischler, bisher ohne Erfolg. Solange sich daran nichts ändert, kann ich meinem Team diesen Wunsch leider nicht erfüllen.

Amira H., Berufseinsteigerin im Marketing
Ich finde die Idee grundsätzlich gut, denn mit einem freien Tag mehr könnte ich endlich meine Weiterbildung abschließen. Trotzdem sollte man nicht so tun, als ob alle das Gleiche wollten. Manche Kolleginnen arbeiten lieber an fünf kürzeren Tagen, weil zehn Stunden am Stück für sie zu anstrengend sind. Ich wünsche mir deshalb, dass jede und jeder selbst wählen kann, statt dass ein Modell für die ganze Belegschaft vorgeschrieben wird.

Piotr W., Personalreferent bei einem Versicherungsunternehmen
Seit wir die Vier-Tage-Woche in unseren Stellenanzeigen nennen, bekommen wir deutlich mehr Bewerbungen. Für die Personalgewinnung ist das also ein echter Vorteil. Ich beobachte aber auch etwas, das mir Sorgen macht: Einige Kolleginnen und Kollegen lesen am freien Freitag trotzdem ihre E-Mails oder nehmen an Videokonferenzen teil, „nur kurz“, wie sie sagen. Wenn das zur Gewohnheit wird, hat am Ende niemand etwas gewonnen.

Lena S., Verkäuferin in einem Möbelhaus
Bei uns im Handel wird ohnehin im Schichtsystem gearbeitet. Eine Vier-Tage-Woche würde für mich bedeuten, dass ich an diesen vier Tagen deutlich länger im Geschäft stehe. Am Gehalt würde sich zwar nichts ändern, aber nach acht Stunden auf den Beinen bin ich jetzt schon müde. Viel wichtiger als ein zusätzlicher freier Tag wäre mir, dass die Dienstpläne früher feststehen und nicht ständig kurzfristig geändert werden.
`,
);

const r1 = forText(rViertage);
const rViertageItems: SeedItem[] = [
  r1.match("gist", "HARD",
    "Wer äußert diese Meinung? Ordnen Sie jeder Aussage eine Person zu. Eine Person passt zu keiner Aussage.",
    [
      "Diese Person hält eine einheitliche Regelung für alle im Betrieb für den falschen Weg.",
      "Diese Person sieht kritisch, dass manche den zusätzlichen freien Tag trotzdem dienstlich nutzen.",
      "Diese Person macht den Erfolg des Modells davon abhängig, woran die Leistung gemessen wird.",
      "Diese Person kann dem Wunsch der Belegschaft nicht nachkommen, solange geeignete Bewerber fehlen.",
    ],
    ["Selin K.", "Jonas M.", "Amira H.", "Piotr W.", "Lena S."],
    [3, 4, 1, 2],
    "Amira: Jede und jeder soll wählen können, kein Modell für alle. Piotr: Mails und Videokonferenzen am freien Freitag. Selin: Messen an Ergebnissen statt an Stunden. Jonas: findet seit über einem Jahr keine Fachkraft. Lena passt zu keiner Aussage (sie wünscht sich verlässliche Dienstpläne)."),
  r1.choice("inference", "MID",
    "Welche Haltung hat Lena S. zur Vier-Tage-Woche?",
    [
      "Sie lehnt sie ab, weil sie befürchtet, dass sich das Modell negativ auf ihr Gehalt auswirkt.",
      "Sie ist skeptisch, weil die Arbeitstage im Geschäft dadurch noch länger würden, als sie jetzt sind.",
      "Sie befürwortet sie grundsätzlich, verlangt aber zuerst gerechter verteilte Schichten im Geschäft.",
      "Sie ist begeistert, weil ein zusätzlicher freier Tag ihr deutlich mehr Zeit zur Erholung ließe.",
    ], 1,
    "Lena wäre schon nach acht Stunden müde und müsste an vier Tagen länger arbeiten; das Gehalt bliebe laut Text gleich. Verlässliche Dienstpläne sind ihr wichtiger als ein freier Tag, sie macht sie aber nicht zur Bedingung."),
  r1.choice("vocabulary", "EASY",
    "Selin schreibt: „Allerdings mussten wir vorher jede regelmäßige Besprechung auf den Prüfstand stellen.“ Was bedeutet „auf den Prüfstand stellen“ hier?",
    ["kritisch auf Sinn prüfen", "endgültig abschaffen", "schriftlich festhalten", "für alle sichtbar machen"], 0,
    "„auf den Prüfstand stellen“ = genau prüfen, ob etwas noch sinnvoll ist. Das Streichen ist erst die Folge der Prüfung („viele davon streichen“)."),
  r1.tfng("detail", "MID",
    [
      ["Selins Team hat nach dem Test beschlossen, die Vier-Tage-Woche dauerhaft einzuführen.", "NG"],
      ["Piotr W. sieht den Nutzen der Vier-Tage-Woche für sein Unternehmen vor allem bei den Krankmeldungen.", "F"],
      ["Selins Team hat während der Testphase nicht weniger geleistet als vorher.", "R"],
    ],
    "1: Ob Selins Team das Modell behält, wird nicht gesagt. 2: Der Vorteil, den Piotr nennt, sind mehr Bewerbungen; die geringeren Krankmeldungen berichtet Selin. 3: „Die Arbeitsleistung ist gleich geblieben.“"),
];

// ---------------------------------------------------------------- Text 2: article

const rMicrolearning = readingText(
  "microlearning",
  "Lernen in kleinen Portionen",
  "Aus- und Weiterbildung: digitales Lernen im Beruf",
  `
Fünf Minuten in der Straßenbahn, zehn Minuten nach der Mittagspause: Immer mehr Unternehmen setzen bei der Weiterbildung ihrer Beschäftigten auf sogenanntes Microlearning. Statt zwei Tage in einem Seminarraum zu verbringen, bearbeiten die Mitarbeitenden kurze Lerneinheiten am Smartphone oder Laptop, oft nur wenige Minuten lang. Die Idee klingt verlockend: Lernen soll sich nahtlos in den Arbeitsalltag einfügen, ohne dass jemand für längere Zeit am Arbeitsplatz fehlt.

Die Bildungsforscherin Miriam Altun beobachtet den Trend seit einigen Jahren. „Kurze Einheiten haben einen klaren Vorteil“, sagt sie. „Wer neues Wissen in Abständen wiederholt, behält es nachweislich länger als jemand, der alles an einem einzigen Tag aufnimmt.“ Dieses Prinzip des verteilten Lernens sei in der Gedächtnisforschung gut belegt. Allerdings warnt Altun davor, Microlearning als Wundermittel zu betrachten. Für überschaubare Inhalte, etwa neue Sicherheitsvorschriften oder die Funktionen einer Software, eigne es sich hervorragend. Komplexe Fähigkeiten wie Verhandlungsführung oder der Umgang mit Konflikten im Team ließen sich dagegen kaum in Fünf-Minuten-Häppchen vermitteln. „Dafür braucht man Übung, Rückmeldung und den Austausch mit anderen.“

Auch in der Praxis zeigt sich ein gemischtes Bild. Ein mittelständischer Logistikbetrieb hat vor zwei Jahren alle Pflichtschulungen auf eine Lern-App umgestellt. Die Personalleiterin zieht eine überwiegend positive Bilanz: Die Teilnahmequote sei deutlich gestiegen, und die Kosten für Reisen und Seminarräume seien gesunken. Gleichzeitig räumt sie ein, dass einige Beschäftigte anfangs Schwierigkeiten mit der Technik gehabt hätten. Das Unternehmen bietet deshalb inzwischen Sprechstunden an, in denen sich Kolleginnen und Kollegen gegenseitig helfen.

Kritisch sehen manche Gewerkschaften eine andere Entwicklung. Wenn Lernen jederzeit und überall möglich ist, verschwimmt die Grenze zwischen Arbeitszeit und Freizeit. „Es darf nicht passieren, dass Beschäftigte ihre Schulungen abends auf dem Sofa erledigen, weil im Arbeitsalltag keine Zeit dafür bleibt“, heißt es in einer Stellungnahme. Lernzeit müsse als Arbeitszeit gelten.

Altun teilt diese Sorge zumindest teilweise. Entscheidend sei, ob Unternehmen ihren Beschäftigten tatsächlich Freiräume zum Lernen schaffen. „Eine App allein verändert noch keine Lernkultur“, sagt sie. Am erfolgreichsten seien Betriebe, die kurze digitale Einheiten mit gelegentlichen Treffen vor Ort verbinden, bei denen das Gelernte angewendet und besprochen wird. So entstehe eine Mischung, die sowohl flexibel als auch nachhaltig sei.

Für die Beschäftigten selbst lohnt sich ein genauer Blick auf das Angebot. Wer eine Lern-App nutzt, sollte prüfen, ob die Inhalte wirklich zur eigenen Tätigkeit passen und ob die Lernzeit vom Arbeitgeber anerkannt wird. Denn auch wenige Minuten summieren sich: Bei täglicher Nutzung kommen im Jahr schnell mehr als zwanzig Stunden zusammen.
`,
);

const r2 = forText(rMicrolearning);
const rMicrolearningItems: SeedItem[] = [
  r2.choice("gist", "MID",
    "Welche Aussage fasst die Position von Miriam Altun am besten zusammen?",
    [
      "Kurze digitale Lerneinheiten sind bei fast allen Inhalten wirksamer als ein klassisches Seminar.",
      "Wissen aus kurzen Einheiten bleibt kaum im Gedächtnis, weshalb man Seminare vorziehen sollte.",
      "Microlearning passt gut zu überschaubaren Inhalten, ersetzt aber nicht jede andere Lernform.",
      "Microlearning wird Seminare in absehbarer Zeit vollständig ersetzen, weil es Kosten spart.",
    ], 2,
    "Altun nennt Vorteile (verteiltes Lernen), warnt aber vor dem „Wundermittel“ und empfiehlt eine Mischung mit Treffen vor Ort. Die übrigen Optionen übertreiben oder kehren ihre Aussage um."),
  r2.choice("detail", "EASY",
    "Warum bietet der Logistikbetrieb Sprechstunden an?",
    [
      "Weil die Gewerkschaft verlangt hatte, dass Lernzeit als Arbeitszeit anerkannt wird.",
      "Weil nach der Umstellung auf die App weniger Beschäftigte an den Pflichtschulungen teilnahmen.",
      "Weil die Kosten für Seminarräume und Reisen trotz der App weiter gestiegen waren.",
      "Weil manche Beschäftigte anfangs Probleme mit der Technik der neuen Lern-App hatten.",
    ], 3,
    "Einige Beschäftigte hatten anfangs Schwierigkeiten mit der Technik, „deshalb“ gibt es Sprechstunden. Die Forderung der Gewerkschaften steht an anderer Stelle; Teilnahmequote und Kosten haben sich laut Text positiv entwickelt."),
  r2.choice("inference", "HARD",
    "Wozu dient der Hinweis auf mehr als zwanzig Stunden im Jahr am Ende des Textes?",
    [
      "Er belegt, dass tägliches Lernen mit der App für einen sicheren Lernerfolg ausreicht.",
      "Er zeigt, dass auch kurze Einheiten viel Zeit ergeben und die Anerkennung der Lernzeit deshalb wichtig ist.",
      "Er erklärt, warum klassische Seminare mit mehr als zwanzig Stunden pro Jahr überflüssig werden.",
      "Er soll zeigen, dass Beschäftigte ihre Lernzeit meist freiwillig in der Freizeit verbringen.",
    ], 1,
    "Der Satz begründet („Denn“) den Rat, die Anerkennung der Lernzeit zu prüfen: Wenige Minuten summieren sich zu über zwanzig Stunden im Jahr. Zum Lernerfolg, zu Seminaren oder zur Freiwilligkeit sagt der Text hier nichts."),
  r2.tfng("detail", "MID",
    [
      ["Nach Aussage der Forscherin bleibt Wissen besser im Gedächtnis, wenn man es mehrfach in zeitlichem Abstand auffrischt.", "R"],
      ["Laut Altun eignet sich Microlearning besonders gut, um den Umgang mit Konflikten im Team zu üben.", "F"],
      ["Der Logistikbetrieb will die Lern-App künftig auch für freiwillige Fortbildungen nutzen.", "NG"],
      ["Die Gewerkschaften befürchten, dass Schulungen in die Freizeit der Beschäftigten verlagert werden könnten.", "R"],
    ],
    "1: verteiltes Lernen, „behält es nachweislich länger“. 2: Komplexe Fähigkeiten wie der Umgang mit Konflikten lassen sich laut Altun kaum in Häppchen vermitteln. 3: Pläne des Betriebs für die App werden nicht genannt. 4: „Schulungen abends auf dem Sofa“, Lernzeit soll Arbeitszeit sein."),
];

// ---------------------------------------------------------------- Text 3: sentence-gap text

const rPendeln = readingText(
  "fahrgemeinschaft",
  "Gemeinsam zur Arbeit",
  "Mobilität: Pendeln und Fahrgemeinschaften",
  `
Jeden Morgen dasselbe Bild: Im Berufsverkehr sitzen Tausende Menschen allein in ihren Autos, und neben ihnen bleibt der Beifahrersitz leer. Dabei wären Fahrgemeinschaften eine naheliegende Alternative. [Lücke 1] Trotzdem fahren nur wenige Beschäftigte regelmäßig gemeinsam zur Arbeit.

Woran liegt das? Eine Umfrage unter Pendlerinnen und Pendlern liefert einige Antworten. Am häufigsten nannten die Befragten unterschiedliche Arbeitszeiten. [Lücke 2] Wer dagegen feste Dienstzeiten hat, findet leichter jemanden mit demselben Weg.

Ein zweiter Grund ist überraschend persönlich: Viele schätzen die Fahrt im eigenen Auto als Zeit für sich. Sie hören Musik, telefonieren oder denken in Ruhe über den Tag nach. [Lücke 3] Das hat ein Pilotprojekt in einem Gewerbegebiet gezeigt, bei dem Beschäftigte mehrerer Firmen über eine gemeinsame App Mitfahrgelegenheiten suchen konnten. Nach einigen Wochen gaben viele Teilnehmende an, die Gespräche während der Fahrt als angenehm zu empfinden.

Damit solche Angebote funktionieren, müssen allerdings auch die Arbeitgeber mitmachen. [Lücke 4] Manche Unternehmen reservieren die besten Parkplätze direkt vor dem Eingang für Fahrgemeinschaften, andere garantieren eine Heimfahrt mit dem Taxi, falls die Fahrerin oder der Fahrer einmal unerwartet länger arbeiten muss. Solche Maßnahmen kosten wenig, nehmen den Beschäftigten aber eine wichtige Sorge.
`,
);

const r3 = forText(rPendeln);
const rPendelnItems: SeedItem[] = [
  r3.match("structure", "HARD",
    "Welcher Satz passt in welche Lücke? Zwei Sätze passen in keine Lücke.",
    ["Lücke 1", "Lücke 2", "Lücke 3", "Lücke 4"],
    [
      "Diese Vorteile kennen allerdings die wenigsten Pendlerinnen und Pendler.",
      "Viele fürchten außerdem, im Auto zum Gespräch mit Fremden gezwungen zu sein, doch diese Sorge ist oft unbegründet.",
      "Wer zu zweit oder zu dritt fährt, spart Geld, entlastet die Straßen und schont die Umwelt.",
      "Sie können Anreize schaffen, die den Beschäftigten das gemeinsame Fahren erleichtern.",
      "Viele Pendler haben dafür allerdings gar keine Zeit, weil sie morgens früh mit der Arbeit beginnen.",
      "Wer im Schichtdienst oder mit flexiblen Zeiten arbeitet, weiß morgens oft noch nicht, wann er abends heimfährt.",
    ],
    [3, 6, 2, 4],
    "1: Vorteile, danach „Trotzdem“. 2: erklärt das Problem unterschiedlicher Zeiten, Kontrast „Wer dagegen feste Dienstzeiten hat“. 3: „Das hat ein Pilotprojekt gezeigt“ bezieht sich auf die unbegründete Sorge vor Gesprächen. 4: „Sie“ = die Arbeitgeber, leitet zu den Beispielen über. Der Satz mit „Diese Vorteile“ passt in keine Lücke, weil vorher keine Vorteile genannt werden; der Zeit-Satz hat keinen Bezug zu „Wer dagegen feste Dienstzeiten hat“."),
  r3.choice("detail", "EASY",
    "Was war laut Umfrage der häufigste Grund, nicht in einer Fahrgemeinschaft zu fahren?",
    [
      "Viele Beschäftigte möchten die Fahrt im Auto als Zeit für sich nutzen, ohne jemanden zu treffen.",
      "Am Arbeitsplatz gibt es für Fahrgemeinschaften zu wenige reservierte Parkplätze in der Nähe.",
      "Die Beschäftigten beginnen und beenden ihre Arbeit zu sehr unterschiedlichen Zeiten.",
      "Der Weg zur Arbeit ist für die meisten Befragten für eine gemeinsame Fahrt zu weit.",
    ], 2,
    "„Am häufigsten nannten die Befragten unterschiedliche Arbeitszeiten.“ Die Zeit für sich ist der zweite Grund, Parkplätze werden nur als Maßnahme einiger Arbeitgeber genannt, zur Entfernung steht nichts im Text."),
  r3.choice("vocabulary", "MID",
    "Was bedeutet „naheliegend“ im ersten Absatz?",
    [
      "räumlich in der Nähe gelegen und leicht erreichbar",
      "als Lösung offensichtlich und leicht zu erkennen",
      "nur für kurze Zeit nutzbar und deshalb unsicher",
      "mit hohen Kosten und viel Aufwand verbunden",
    ], 1,
    "„naheliegend“ = sich als Lösung anbietend, offensichtlich. Die wörtliche räumliche Bedeutung ist der typische Fehlschluss."),
  r3.tfng("detail", "MID",
    [
      ["An dem Pilotprojekt beteiligten sich Beschäftigte aus einem einzelnen Unternehmen im Gewerbegebiet.", "F"],
      ["Nach einigen Wochen bewerteten viele Teilnehmende die Gespräche im Auto positiv.", "R"],
      ["Manche Arbeitgeber sorgen dafür, dass Mitfahrende sicher heimkommen, auch wenn die Fahrerin oder der Fahrer länger bleiben muss.", "R"],
      ["Manche Unternehmen reservieren für Fahrgemeinschaften Parkplätze am Rand des Betriebsgeländes.", "F"],
    ],
    "1: „Beschäftigte mehrerer Firmen“. 2: „die Gespräche ... als angenehm zu empfinden“. 3: Taxi-Heimfahrt. 4: Die Parkplätze liegen „direkt vor dem Eingang“, nicht am Rand des Geländes."),
];

// ---------------------------------------------------------------- Text 4: rules

const rCoworking = readingText(
  "coworking-regeln",
  "Nutzungsbedingungen im Coworking-Space",
  "Arbeit: Regeln am Arbeitsplatz",
  `
Willkommen im Coworking-Space! Damit sich alle bei uns wohlfühlen, bitten wir Sie, die folgenden Regeln zu beachten.

Abschnitt 1
Mitglieder mit Monatskarte können die Räume rund um die Uhr nutzen. Mit einer Tageskarte ist der Zugang von 8 bis 20 Uhr möglich. Man betritt das Haus mit einer persönlichen Chipkarte, die nicht an andere Personen weitergegeben werden darf. Bei Verlust der Karte wird eine Gebühr von 25 Euro fällig.

Abschnitt 2
Feste Schreibtische sind Mitgliedern mit Monatskarte vorbehalten. Alle anderen Plätze im offenen Bereich können frei genutzt werden, sind aber am Ende des Tages vollständig zu räumen. Persönliche Gegenstände, die über Nacht liegen bleiben, werden von unserem Team eingesammelt und eine Woche lang am Empfang aufbewahrt.

Abschnitt 3
Die beiden Besprechungsräume können über unsere App für höchstens drei Stunden am Stück gebucht werden. Stornierungen sind bis 24 Stunden vor Beginn kostenlos; danach wird die Buchung voll berechnet. Bitte verlassen Sie den Raum so, wie Sie ihn vorgefunden haben.

Abschnitt 4
Telefonate und Videokonferenzen führen Sie bitte ausschließlich in den Telefonkabinen. Kurze Absprachen in normaler Lautstärke sind im offenen Bereich erlaubt. In der Ruhezone im ersten Stock sind Gespräche jeder Art zu vermeiden.

Abschnitt 5
Die Küche steht allen zur Verfügung, Kaffee und Tee sind im Preis enthalten. Benutztes Geschirr ist in die Spülmaschine zu stellen. Lebensmittel im Kühlschrank beschriften Sie bitte mit Namen und Datum, denn der Kühlschrank wird jeden Freitag geleert.
`,
);

const r4 = forText(rCoworking);
const rCoworkingItems: SeedItem[] = [
  r4.match("gist", "EASY",
    "Welche Überschrift passt zu welchem Abschnitt? Drei Überschriften bleiben übrig.",
    ["Abschnitt 1", "Abschnitt 2", "Abschnitt 3", "Abschnitt 4", "Abschnitt 5"],
    [
      "Beiträge und Rabatte für Mitglieder",
      "Plätze im offenen Bereich und Aufräumpflicht",
      "Mitgliedschaft beenden und Chipkarte zurückgeben",
      "Wann und womit man das Gebäude betreten darf",
      "Essen, Getränke und Geschirr",
      "Meetingräume buchen und absagen",
      "Besuch einladen und anmelden",
      "Wo man laut sprechen darf und wo nicht",
    ],
    [4, 2, 6, 8, 5],
    "Jeder Abschnitt hat genau ein Thema: Zugang (1), Plätze und liegen gebliebene Sachen (2), Buchung der Räume (3), Telefonate und Ruhezone (4), Küche (5). Beiträge, Kündigung und Besuch kommen im Text nicht vor; „Chipkarte“ und „Mitglieder“ kommen zwar in Abschnitt 1 und 2 vor, sind aber nicht deren Thema."),
  r4.choice("detail", "MID",
    "Was passiert mit Sachen, die über Nacht auf einem Platz im offenen Bereich liegen bleiben?",
    [
      "Das Team nimmt sie mit und bewahrt sie eine Woche lang am Empfang für die Besitzer auf.",
      "Sie bleiben liegen, bis die Mitglieder am nächsten Morgen wiederkommen und sie abholen.",
      "Sie werden in ein persönliches Fach gelegt, das nur mit der Chipkarte zu öffnen ist.",
      "Das Team schickt sie den Mitgliedern nach einer Woche per Post an die Wohnadresse.",
    ], 0,
    "Abschnitt 2: Das Team sammelt sie ein und bewahrt sie eine Woche am Empfang auf. Persönliche Fächer und Postversand werden nicht erwähnt."),
  r4.choice("inference", "HARD",
    "Herr Braun hat eine Tageskarte. Was ist für ihn nach den Regeln möglich?",
    [
      "um 21 Uhr noch an seinem Platz im offenen Bereich weiterarbeiten, wenn er leise bleibt",
      "sich einen festen Schreibtisch im Voraus für die ganze Woche reservieren",
      "in der Ruhezone im ersten Stock kurz mit einer Kundin telefonieren",
      "im offenen Bereich in normaler Lautstärke kurz etwas mit einer Kollegin absprechen",
    ], 3,
    "Kurze Absprachen in normaler Lautstärke sind im offenen Bereich für alle erlaubt (Abschnitt 4). Mit Tageskarte gilt der Zugang nur bis 20 Uhr, feste Schreibtische sind Monatskarten vorbehalten, in der Ruhezone sind Gespräche jeder Art zu vermeiden."),
];

// ---------------------------------------------------------------- Text 5: housing ads with a two-constraint matching

const rWohnungen = readingText(
  "wohnungsanzeigen",
  "Wohnungsanzeigen aus der Zeitung",
  "Wohnen: Anzeigen für Wohnungen und Zimmer",
  `
Anzeige A
Helle Zwei-Zimmer-Wohnung im Altbau, 58 m², dritter Stock ohne Aufzug, direkt am Hauptbahnhof. 780 Euro warm, Haustiere nach Absprache. Frei ab 1. Dezember, unbefristeter Vertrag.

Anzeige B
Zimmer (16 m²) in einer Vierer-WG in der Südstadt. 340 Euro warm mit Internet, Küche und Bad werden geteilt. Haustiere leider nicht möglich. Einzug sofort, unbefristet.

Anzeige C
Neubau mit Garten: drei Zimmer, 85 m², Erdgeschoss, ruhiger Vorort mit S-Bahn-Anschluss (25 Minuten bis zum Zentrum). 1.150 Euro kalt. Hunde und Katzen sind willkommen. Ab sofort frei.

Anzeige D
Möbliertes Apartment, 30 m², mitten in der Innenstadt, mit Aufzug und Waschmaschine im Haus. 650 Euro warm, Haustiere nicht gestattet. Mietvertrag befristet bis Ende Mai.

Anzeige E
Ruhige Wohnung in der Stadtmitte, 45 m², Souterrain, 520 Euro warm, Haustiere erlaubt. Kein Aufzug. Einzug ab 1. Januar, unbefristet.

Anzeige F
Zwei-Zimmer-Dachgeschosswohnung in der Innenstadt, 62 m², mit Balkon und Aufzug. 890 Euro warm. Keine Haustiere. Unbefristet, ab sofort.
`,
);

const r5 = forText(rWohnungen);
const rWohnungenItems: SeedItem[] = [
  r5.match("detail", "HARD",
    "Welche Anzeige passt zu welcher Person? Beide Bedingungen müssen erfüllt sein. Zu einer Person passt keine Anzeige, eine Anzeige bleibt übrig.",
    [
      "Ein Gastdozent bleibt nur bis Ende Mai in der Stadt und möchte zentral wohnen, ohne selbst Möbel zu kaufen.",
      "Herr Vogt hat einen großen Hund und wünscht sich eine Wohnung mit eigenem Garten.",
      "Frau Köhler will mit ihrer Katze in der Stadtmitte wohnen und höchstens 600 Euro warm bezahlen.",
      "Herr Weber transportiert täglich schwere Kisten und sucht eine unbefristete Wohnung in der Innenstadt mit Aufzug.",
      "Frau Lehmann möchte so günstig wie möglich wohnen, am liebsten in einer WG, und sofort einziehen.",
      "Frau Neumann sucht für ihre Wohngemeinschaft eine Wohnung mit vier Zimmern, die ab sofort frei ist.",
    ],
    ["Anzeige A", "Anzeige B", "Anzeige C", "Anzeige D", "Anzeige E", "Anzeige F", "Keine Anzeige passt"],
    [4, 3, 5, 6, 2, 7],
    "Gastdozent: zentral + befristet + möbliert = D (A, E, F sind zentral, aber unbefristet und unmöbliert). Vogt: Hund + Garten = C (A erlaubt Tiere nur nach Absprache und hat keinen Garten, E hat keinen Garten). Köhler: Stadtmitte + Katze + höchstens 600 Euro = E (A kostet 780, D erlaubt keine Tiere). Weber: Innenstadt + Aufzug + unbefristet = F (D hat Aufzug, ist aber befristet; A hat keinen Aufzug). Lehmann: günstiges WG-Zimmer, sofort = B. Neumann: kein Angebot mit vier Zimmern, also „Keine Anzeige passt“. Anzeige A bleibt übrig."),
];

// ---------------------------------------------------------------- Text 6: news item

const rBibliothek = readingText(
  "bibliothek-abendoeffnung",
  "Stadtbibliothek länger geöffnet",
  "Kultur: Öffnungszeiten der Stadtbibliothek",
  `
Rheinfeld. Die Stadtbibliothek am Marktplatz bleibt ab Oktober an zwei Abenden pro Woche bis 22 Uhr geöffnet. Zunächst gilt die Regelung für ein halbes Jahr als Testphase, danach entscheidet der Stadtrat über eine Verlängerung.

Auslöser war eine Umfrage unter Nutzerinnen und Nutzern: Fast jede zweite befragte Person gab an, wegen langer Wege oder fester Arbeitszeiten nur selten vor 18 Uhr in die Bibliothek zu kommen. Am Donnerstag und Freitag stehen deshalb auch die Lesesäle im ersten Stock offen, die bisher um 19 Uhr schlossen. Das Ausleihen und Zurückgeben ist abends allerdings nur an den Automaten im Erdgeschoss möglich, weil das Personal weiterhin um 19 Uhr Feierabend hat.

Bibliotheksleiterin Marta Kowal rechnet damit, dass vor allem Studierende und Berufstätige das neue Angebot nutzen. Wer abends lernen möchte, sollte seinen Ausweis dabeihaben, da der Eingang nach 19 Uhr nur mit Karte geöffnet wird.
`,
);

const r6 = forText(rBibliothek);
const rBibliothekItems: SeedItem[] = [
  r6.choice("detail", "MID",
    "Was ist an den neuen langen Abenden möglich?",
    [
      "Man kann Medien auch am Schalter ausleihen, weil das Personal bis 22 Uhr im Haus bleibt.",
      "Man kann die Lesesäle nutzen, muss sich dafür aber vorher beim Personal anmelden.",
      "Man kann in den Lesesälen lernen, Bücher aber nur selbst an den Automaten ausleihen.",
      "Man kann nur im Erdgeschoss bleiben, weil die oberen Räume weiterhin um 19 Uhr schließen.",
    ], 2,
    "Die Lesesäle im ersten Stock bleiben offen; Ausleihe und Rückgabe gehen abends nur an den Automaten, weil das Personal um 19 Uhr geht. Eine Anmeldung wird nicht verlangt, nur die Karte für den Eingang."),
  r6.tfng("detail", "MID",
    [
      ["Die längeren Öffnungszeiten werden zunächst nur ausprobiert.", "R"],
      ["Während der Abendöffnung sind auch Veranstaltungen für Kinder geplant.", "NG"],
      ["Auslöser der neuen Abendöffnung war eine Umfrage unter den Mitarbeitenden der Bibliothek.", "F"],
    ],
    "1: Testphase für ein halbes Jahr. 2: Über Veranstaltungen sagt der Text nichts. 3: Die Umfrage lief unter Nutzerinnen und Nutzern, nicht unter dem Personal."),
];

// ---------------------------------------------------------------- Text 7: blog post

const rRadtour = readingText(
  "radtour-blog",
  "Blog: Meine erste mehrtägige Radtour",
  "Reisen: Radurlaub an der Mosel",
  `
Vorletzte Woche habe ich meine erste mehrtägige Radtour gemacht, und ich muss gestehen: Ich hatte die Strecke unterschätzt. Geplant waren 60 Kilometer pro Tag am Fluss entlang, flach, hieß es im Reiseführer. Flach war es auch, aber der Gegenwind vom zweiten Tag an hat mir die Freude ordentlich verdorben. Gerettet hat mich eine Pension in Zell, deren Wirtin mir ungefragt eine Thermoskanne Kaffee in die Satteltasche gepackt hat. „Den brauchen Sie heute“, sagte sie. Sie hatte recht.

Was ich anderen raten würde? Erstens: das Gepäck vorausschicken. Viele Unterkünfte bieten das für zehn bis fünfzehn Euro an, und ich hätte mir einen halben Tag Schweiß erspart. Zweitens: die Tagesetappen lieber kürzer planen, als man denkt. Ich wollte unbedingt jeden Abend in einer anderen Stadt schlafen, habe aber am Ende kaum etwas gesehen, weil ich nur zum Ziel gehetzt bin. Drittens: Der Zug ist kein Zeichen von Schwäche. Auf dem letzten Stück bin ich mit dem Regionalzug gefahren. Das war kein Problem, denn die Räder dürfen kostenlos mitfahren, und ich habe es keine Minute bereut.

Nächstes Jahr komme ich wieder, dann mit besserer Planung und, wenn ich Glück habe, mit Rückenwind.
`,
);

const r7 = forText(rRadtour);
const rRadtourItems: SeedItem[] = [
  r7.choice("gist", "MID",
    "Wie bewertet der Autor seine Tour im Rückblick?",
    [
      "Sie war anstrengender als gedacht, aber er möchte sie mit besserer Planung wiederholen.",
      "Sie war insgesamt eine Enttäuschung, deshalb will er künftig lieber mit dem Zug reisen.",
      "Sie verlief genau wie im Reiseführer beschrieben, nur die Unterkünfte waren zu teuer.",
      "Sie war so leicht, dass er nächstes Jahr eine deutlich längere Strecke fahren will.",
    ], 0,
    "Er hat die Strecke unterschätzt (Gegenwind), plant aber, mit besserer Planung wiederzukommen. Eine Enttäuschung, ein Verlauf „wie beschrieben“ oder eine leichte Tour werden nicht gesagt."),
  r7.choice("inference", "HARD",
    "Warum erwähnt der Autor die Wirtin der Pension in Zell?",
    [
      "Sie hat ihm geraten, seine Tagesetappen kürzer zu planen und mehr Pausen zu machen.",
      "Sie hat sein Gepäck zum nächsten Ziel vorausgeschickt und ihm so Zeit gespart.",
      "Ihre Pension war nach seiner Meinung die beste Unterkunft der gesamten Tour.",
      "Ihre kleine Geste hat ihm an einem besonders anstrengenden Tag sehr geholfen.",
    ], 3,
    "Die Wirtin packte ungefragt Kaffee ein, das „hat ihn gerettet“. Die Tipps zu Etappen und Gepäck gibt der Autor selbst; ein Urteil über die beste Unterkunft steht nicht im Text."),
];

// ---------------------------------------------------------------- Insertion 5 of 7 (three texts, one per form)

/** Gap row labels and the lettered sentences of an insertion task: five places, seven sentences, two spare. */
const INSERT_PROMPT =
  "Lesen Sie den Text. Fünf Sätze fehlen. Welcher Satz (A bis G) passt in welche Lücke (1) bis (5)? Zwei Sätze passen in keine Lücke. Jeder Satz passt höchstens einmal.";
const INSERT_ROWS = ["Lücke (1)", "Lücke (2)", "Lücke (3)", "Lücke (4)", "Lücke (5)"];
const insertTargets = (sentences: string[]) => sentences.map((s, i) => `${String.fromCharCode(65 + i)}: ${s}`);

const rImker = readingText(
  "stadtimker-dach",
  "Honig vom Hotelhochhaus",
  "Natur: Bienen in der Stadt",
  `
Auf dem Dach eines Hotels in der Innenstadt stehen zwölf weiße Holzkästen, aus denen es leise summt. Seit drei Jahren hält die Hobbyimkerin Carla Demir hier Bienen. (1) ________ Auf den Feldern gibt es nach der Rapsblüte nämlich oft wochenlang kaum Nahrung, in der Stadt dagegen blüht vom Frühjahr bis in den Herbst immer irgendwo etwas.

Viele Menschen glauben, dass Stadthonig nach Abgasen schmeckt. (2) ________ Der Grund dafür ist einfach: Die Bienen sammeln Nektar aus Blüten und nicht von der Straße.

Ein einfaches Hobby ist die Imkerei auf dem Dach trotzdem nicht. (3) ________ Deshalb besucht Carla Demir ihre Völker im Sommer täglich und spannt Planen über die Kästen.

Das Hotel hat von dem Projekt gleich zwei Vorteile. (4) ________ Außerdem steht der Honig jeden Morgen auf dem Frühstücksbüfett, und viele Gäste fragen, ob sie ein Glas kaufen können.

Carla Demir will ihre Imkerei im nächsten Jahr vergrößern. (5) ________ Ob das klappt, entscheidet sich im Frühjahr.
`,
);
const rBuecher = readingText(
  "buecherschrank-ecke",
  "Ein Schrank voller Bücher",
  "Kultur: offene Bücherschränke",
  `
In vielen Städten stehen an Straßenecken und vor Bahnhöfen offene Bücherschränke, aus denen jeder Bücher mitnehmen darf. (1) ________ Die Regeln sind bewusst einfach gehalten: Wer ein Buch gelesen hat, stellt es zurück oder legt ein anderes hinein.

Dass die Schränke meist ordentlich aussehen, ist kein Zufall. (2) ________ Sie räumen auf, sortieren Beschädigtes aus und achten darauf, dass alles trocken bleibt.

Ganz ohne Probleme geht es allerdings nicht. (3) ________ In solchen Fällen helfen kleine Schilder, die erklären, was erwünscht ist.

Viele Nutzerinnen und Nutzer greifen zu Büchern, die sie sich nie gekauft hätten. (4) ________ Deshalb sehen manche Stadtbibliotheken die Schränke eher als willkommene Ergänzung denn als Konkurrenz.

Im nächsten Jahr sollen drei weitere Schränke dazukommen. (5) ________ Dafür hat die Stadt bereits einen Zuschuss bewilligt.
`,
);
const rSchlaf = readingText(
  "teenager-schlaf",
  "Warum Teenager morgens müde sind",
  "Gesundheit: Schlaf und Jugendliche",
  `
Um sieben Uhr morgens sitzen viele Jugendliche mit schweren Augen in der Schule, und Erwachsene erklären das gern mit einem Satz: zu spät ins Bett gegangen. (1) ________ In der Pubertät verschiebt sich nämlich die innere Uhr um etwa zwei Stunden nach hinten.

Das Hormon Melatonin, das müde macht, wird bei Jugendlichen abends später ausgeschüttet als bei Kindern. (2) ________ Wer um elf Uhr noch hellwach ist, handelt also nicht unvernünftig, sondern folgt seiner Biologie.

Der Unterricht beginnt aber an den meisten Schulen um acht Uhr oder früher. (3) ________ Die Folgen zeigen sich vor allem in der Konzentration am Vormittag.

Einige Schulen haben den Beginn deshalb auf neun Uhr verschoben. (4) ________ Auch die Noten verbesserten sich leicht, und weniger Jugendliche meldeten sich krank.

Für Eltern bedeutet das: Strenge Schlafenszeiten helfen wenig. (5) ________ Dazu gehört ein abgedunkeltes Zimmer und, so schwer es fällt, ein Handy, das nachts nicht neben dem Bett liegt.
`,
);

const rIm1 = forText(rImker);
const rIm2 = forText(rBuecher);
const rIm3 = forText(rSchlaf);
const insertionItems: SeedItem[] = [
  rIm1.match("structure", "MID", INSERT_PROMPT, INSERT_ROWS,
    insertTargets([
      "Wer Honig kaufen möchte, sollte auf das Etikett und das Siegel achten.",
      "Zum einen bestäuben die Bienen die Pflanzen auf der Terrasse, die dadurch deutlich mehr Früchte tragen.",
      "Das überrascht viele: In der Stadt geht es Bienen oft besser als auf dem Land.",
      "Im Winter bleiben die Bienen in ihren Kästen und leben von ihren Vorräten.",
      "Auf der Dachfläche wird es im Sommer so heiß, dass die Völker ohne Schutz kaum überleben würden.",
      "Dafür sucht sie jetzt weitere Dächer in der Nachbarschaft.",
      "Messungen in mehreren Städten haben jedoch gezeigt, dass der Honig nicht stärker belastet ist als Honig vom Land.",
    ]),
    [3, 7, 5, 2, 6],
    "1: „nämlich“ begründet die Aussage über Stadt und Land. 2: Gegensatz („jedoch“) zur Befürchtung, „Der Grund dafür“ erklärt das Messergebnis. 3: Hitze auf dem Dach, „Deshalb ... täglich“. 4: „Zum einen“ wird von „Außerdem“ fortgesetzt. 5: „Dafür“ bezieht sich auf die geplante Vergrößerung. Die Sätze über Etikett und Winter haben keinen Bezug zu den Nachbarsätzen."),
  rIm1.choice("detail", "EASY",
    "Warum besucht Carla Demir ihre Bienen im Sommer täglich?",
    [
      "Sie verkauft den frischen Honig jeden Tag an die Gäste des Hotels.",
      "Sie sucht für die Holzkästen laufend neue Plätze auf anderen Dächern.",
      "Sie muss die Völker vor der starken Hitze auf dem Dach schützen.",
      "Sie kontrolliert regelmäßig, ob die Tiere Schadstoffe sammeln.",
    ], 2,
    "Auf der Dachfläche wird es im Sommer sehr heiß, deshalb besucht sie die Völker täglich und spannt Planen über die Kästen. Verkauf, Suche nach Dächern und Schadstoffkontrolle sind nicht der Grund."),
  rIm2.match("structure", "HARD", INSERT_PROMPT, INSERT_ROWS,
    insertTargets([
      "Wer einen besonders wertvollen Band findet, kann ihn von der Stadtbibliothek schätzen lassen.",
      "Manchmal landen dort aber auch kaputte Elektrogeräte oder alte Zeitschriften.",
      "Kinderbücher sind meist schnell vergriffen, Fachbücher bleiben dagegen lange stehen.",
      "Eine Gebühr, einen Ausweis oder eine Leihfrist gibt es dabei nicht.",
      "Einer davon soll in einer ausgedienten Telefonzelle entstehen.",
      "Fast jeder Schrank hat Paten, die ihn regelmäßig kontrollieren.",
      "Einer Befragung zufolge ist die Mehrheit von ihnen zugleich Mitglied einer Bibliothek.",
    ]),
    [4, 6, 2, 7, 5],
    "1: „Die Regeln sind bewusst einfach“ knüpft an das Fehlen von Gebühr, Ausweis und Frist an. 2: „Sie“ in der Folge sind die Paten. 3: „In solchen Fällen“ meint den Müll im Schrank. 4: Weil viele Nutzer auch Bibliotheksmitglieder sind, gibt es keine Konkurrenz („Deshalb“). 5: „Einer davon“ gehört zu den drei neuen Schränken, „Dafür“ nennt den Zuschuss. Die Sätze über den wertvollen Band und über Kinderbücher haben keinen Anschluss."),
  rIm2.choice("detail", "MID",
    "Was hilft, wenn Müll in einem Bücherschrank landet?",
    [
      "Die Paten schließen den Schrank dauerhaft ab, bis er gereinigt ist.",
      "Kleine Schilder erklären, welche Dinge in den Schrank gehören.",
      "Die Stadt entfernt jeden Schrank, in dem Müll gefunden wird.",
      "Nutzer zahlen eine kleine Gebühr, wenn sie etwas hineinlegen.",
    ], 1,
    "„In solchen Fällen helfen kleine Schilder, die erklären, was erwünscht ist.“ Abschließen, Entfernen und Gebühren kommen im Text nicht vor (Gebühren gibt es ausdrücklich nicht)."),
  rIm3.match("structure", "MID", INSERT_PROMPT, INSERT_ROWS,
    insertTargets([
      "Wichtiger ist, dass das Schlafzimmer ein Ort der Ruhe bleibt.",
      "Erwachsene brauchen im Durchschnitt sieben bis acht Stunden Schlaf pro Nacht.",
      "Die Schlafforschung sieht das inzwischen differenzierter.",
      "Nach dem Wechsel schliefen die Jugendlichen im Durchschnitt fast eine Stunde länger pro Nacht.",
      "Viele Sportvereine legen ihre Trainingszeiten deshalb auf den späten Nachmittag.",
      "Viele Jugendliche können deshalb vor Mitternacht schlicht nicht einschlafen, selbst wenn sie es versuchen.",
      "Studien zufolge schlafen sie dadurch an Schultagen im Schnitt ein bis zwei Stunden weniger, als sie bräuchten.",
    ]),
    [3, 6, 7, 4, 1],
    "1: „differenzierter“ wird durch „nämlich“ begründet. 2: „deshalb“ folgt aus dem späten Melatonin. 3: „sie“ sind die Jugendlichen, „Die Folgen“ nennt die Wirkung des frühen Unterrichts. 4: „Auch die Noten“ setzt eine erste Verbesserung voraus. 5: „Wichtiger ist“ vergleicht mit den Schlafenszeiten, „Dazu“ führt es aus. Die Sätze über Erwachsene und Sportvereine passen zu keinem Nachbarsatz."),
  rIm3.choice("detail", "MID",
    "Was hat sich an den Schulen verbessert, die den Unterrichtsbeginn nach hinten verlegten?",
    [
      "Die Jugendlichen gingen früher ins Bett und schliefen weniger lang.",
      "Die Jugendlichen schliefen länger, und es gab weniger Krankmeldungen.",
      "Die Eltern bestimmten die Schlafenszeiten nun streng und gemeinsam.",
      "Die Unterrichtsstunden wurden kürzer, damit der Tag früher endete.",
    ], 1,
    "Nach dem Wechsel schliefen sie länger; die Noten wurden leicht besser und weniger Jugendliche meldeten sich krank. Die Schlafenszeiten werden im Text sogar als wenig hilfreich genannt."),
];

// ---------------------------------------------------------------- Opinion matching (comments under an article)

const OPINION_PROMPT =
  "Wer äußert diese Meinung? Ordnen Sie jeder Aussage eine Person zu. Eine Aussage passt zu keiner der vier Personen.";

const rTempo = readingText(
  "kommentare-tempolimit",
  "Kommentare: Tempolimit auf Autobahnen?",
  "Verkehr: Tempolimit auf Autobahnen",
  `
Unter einem Zeitungsartikel zum Thema „Tempolimit auf Autobahnen?“ haben Leserinnen und Leser kommentiert.

Heike R.
Ich fahre jeden Tag fünfzig Kilometer zur Arbeit und mag es, wenn es zügig vorangeht. Aber im letzten Winter wäre ich im Nebel fast in ein Stauende gefahren, bei Tempo hundertvierzig. Seitdem sehe ich das anders: Ein festes Limit würde nur wenige Minuten kosten, und im Gegenzug fährt der ganze Verkehr gleichmäßiger.

Dirk F.
Ein einheitliches Limit für das ganze Land halte ich für zu grob. Nachts auf einer leeren Strecke ist hundertdreißig sinnvoll, bei Regen oder in Baustellen dagegen viel zu schnell. Besser wären elektronische Schilder, die das erlaubte Tempo je nach Wetter und Verkehr anpassen. Dann würden die Regeln auch eher akzeptiert.

Mirjam T.
Ich glaube, dass die Debatte vom eigentlichen Problem ablenkt. Ein Limit würde den Ausstoß von Abgasen nur geringfügig senken. Wer wirklich etwas für Klima und Sicherheit tun will, sollte das Geld lieber in bessere Bahnverbindungen stecken, damit weniger Leute überhaupt das Auto nehmen müssen.

Jonas B.
Es gibt längst viele Begrenzungen, an die sich kaum jemand hält. Mehr Schilder bringen also nichts. Ich wünsche mir, dass vorhandene Regeln endlich ernst genommen werden: mehr Kontrollen, auch mit Blitzern an unauffälligen Stellen, und spürbare Strafen für Raser.
`,
);
const rBargeld = readingText(
  "kommentare-bargeld",
  "Kommentare: Nur noch Kartenzahlung?",
  "Alltag: Bargeld und Kartenzahlung",
  `
Ein Café in der Innenstadt nimmt seit Kurzem kein Bargeld mehr an. Unter dem Bericht der Lokalzeitung haben Leserinnen und Leser kommentiert.

Renate L.
Ich zahle bewusst mit Münzen und Scheinen. Wenn ich sehe, wie das Geld im Portemonnaie weniger wird, überlege ich mir jeden Kauf zweimal. Mit der Karte verliere ich schnell den Überblick und schaue am Monatsende überrascht auf den Kontostand.

Tim S.
Ich habe seit Jahren kein Bargeld mehr dabei. Mit dem Handy bezahle ich in zwei Sekunden, das spart vor allem an der Kasse Zeit, wenn hinter einem zehn Leute warten. Das Café macht es richtig, und ich verstehe die Aufregung nicht.

Sofia M.
Mich stört, dass jeder Kauf gespeichert wird. Aus den Daten kann man ablesen, wo ich bin, was ich esse und wie oft ich ausgehe. Bargeld ist anonym, und ich möchte selbst entscheiden, wer das alles erfährt.

Wolfgang E.
Ich führe selbst einen kleinen Laden. Jede Kartenzahlung kostet mich eine Gebühr, und bei Kleinbeträgen bleibt kaum etwas übrig. Trotzdem biete ich beides an, weil ich meine Kundschaft nicht ausschließen möchte. Entscheiden sollten die Kunden und nicht die Betreiber.
`,
);
const rBildschirm = readingText(
  "kommentare-bildschirmzeit",
  "Kommentare: Bildschirmzeit bei Kindern",
  "Familie: Bildschirmzeit bei Kindern",
  `
Unter dem Artikel „Wie viel Bildschirmzeit ist für Kinder in Ordnung?“ schreiben Eltern und andere Leserinnen und Leser:

Katrin V.
Bei uns gelten feste Regeln: eine Stunde pro Tag, kein Handy am Esstisch, keine Geräte im Schlafzimmer. Das funktioniert aber nur, weil wir Eltern uns auch daran halten. Wer selbst beim Abendessen auf das Telefon schaut, kann von den Kindern nichts anderes verlangen.

Lukas H.
Ich finde die Frage nach den Minuten zweitrangig. Mein Sohn baut auf dem Tablet Modelle und lernt Programmieren, das ist etwas völlig anderes, als zwei Stunden lang Videos anzuschauen. Entscheidend ist, was die Kinder mit der Zeit anfangen.

Petra W.
Als Kind habe ich ganze Nachmittage im Garten verbracht und mich manchmal gelangweilt. Genau daraus sind meine besten Ideen entstanden. Heute sind die Terminkalender der Kinder voll, und wenn doch Zeit bleibt, greifen sie zum Gerät. Ich wünsche mir für sie mehr Stunden ohne Programm und ohne Technik.

Mehmet K.
Mein Sohn nutzt das Handy fast nur, um sich mit Freunden zu verabreden. Als wir es ihm eine Woche lang weggenommen haben, wurde er aus der Klassengruppe ausgeschlossen. Seitdem setze ich lieber auf Gespräche und Vertrauen als auf Verbote.
`,
);

const rOp1 = forText(rTempo);
const rOp2 = forText(rBargeld);
const rOp3 = forText(rBildschirm);
const opinionItems: SeedItem[] = [
  rOp1.match("inference", "MID", OPINION_PROMPT,
    [
      "Diese Person hält ein Tempolimit für wenig wirksam und will lieber andere Verkehrsmittel stärken.",
      "Diese Person schlägt vor, auf Autobahnen eine eigene Spur für Lastwagen einzurichten.",
      "Diese Person begründet ihre Meinung mit einem eigenen Erlebnis.",
      "Diese Person verlangt, dass bestehende Vorschriften strenger überwacht werden.",
      "Diese Person möchte das erlaubte Tempo nicht pauschal festlegen, sondern der Lage anpassen.",
    ],
    ["Heike R.", "Dirk F.", "Mirjam T.", "Jonas B.", "Keine der vier Personen"],
    [3, 5, 1, 4, 2],
    "Mirjam: Limit senkt Abgase kaum, besser Bahn. Lastwagenspur: wird von niemandem genannt. Heike: Beinaheunfall im Nebel. Jonas: mehr Kontrollen und Strafen. Dirk: elektronische Schilder, die das Tempo je nach Wetter und Verkehr anpassen."),
  rOp2.match("inference", "MID", OPINION_PROMPT,
    [
      "Diese Person sorgt sich um den Schutz persönlicher Daten.",
      "Diese Person nennt die Kosten, die Kartenzahlungen für Geschäfte verursachen.",
      "Diese Person rät dazu, nach jeder Kartenzahlung einen Beleg zu verlangen.",
      "Diese Person schätzt vor allem, dass das Bezahlen schneller geht.",
      "Diese Person behält mit Münzen und Scheinen besser den Überblick über die eigenen Ausgaben.",
    ],
    ["Renate L.", "Tim S.", "Sofia M.", "Wolfgang E.", "Keine der vier Personen"],
    [3, 4, 5, 2, 1],
    "Sofia: Kaufdaten werden gespeichert. Wolfgang: Gebühr pro Kartenzahlung. Belege: werden nicht erwähnt. Tim: spart Zeit an der Kasse. Renate: Überblick durch Münzen und Scheine."),
  rOp3.match("inference", "HARD", OPINION_PROMPT,
    [
      "Diese Person warnt davor, dass ein Verbot Kinder sozial ausgrenzen kann.",
      "Diese Person hält die Art der Nutzung für wichtiger als deren Dauer.",
      "Diese Person fordert, dass Hersteller Kinder-Apps besser auf Sicherheit prüfen lassen.",
      "Diese Person wünscht sich für Kinder mehr freie Zeit ohne Programm und Technik.",
      "Diese Person verlangt, dass auch die Erwachsenen die Regeln einhalten.",
    ],
    ["Katrin V.", "Lukas H.", "Petra W.", "Mehmet K.", "Keine der vier Personen"],
    [4, 2, 5, 3, 1],
    "Mehmet: Ausschluss aus der Klassengruppe nach dem Handyentzug. Lukas: „was die Kinder mit der Zeit anfangen“. Sicherheit von Apps: wird nicht erwähnt. Petra: Stunden ohne Programm und Technik. Katrin: Eltern halten sich auch an die Regeln."),
];

const reading: SeedBankPart = {
  stimuli: [
    rViertage, rMicrolearning, rPendeln, rCoworking, rWohnungen, rBibliothek, rRadtour,
    rImker, rBuecher, rSchlaf, rTempo, rBargeld, rBildschirm,
  ],
  items: [
    ...insertionItems,
    ...opinionItems,
    ...rViertageItems,
    ...rMicrolearningItems,
    ...rPendelnItems,
    ...rCoworkingItems,
    ...rWohnungenItems,
    ...rBibliothekItems,
    ...rRadtourItems,
  ],
};

// ================================================================ LISTENING

type LSkill = "gist" | "detail" | "attitude" | "inference" | "notes";

/** A rewritten script gets a new key (suffix -v3): the bank sync never edits a script in place. */
function clip(
  slug: string,
  title: string,
  topic: string,
  speakers: Array<{ label: string; voice: "A" | "B" | "C" | "D" }>,
  lines: string[],
  maxPlays?: 1 | 2 | 3,
): SeedStimulus {
  return {
    key: `v2-l-b2-${slug}`,
    section: "LISTENING",
    level: LEVEL,
    title,
    topic,
    speakers,
    body: lines.join("\n"),
    ...(maxPlays ? { maxPlays } : {}),
  };
}

function forClip(stimulus: SeedStimulus) {
  const base = (skill: LSkill, within: Within, prompt: string, explanation: string) => ({
    section: "LISTENING" as const,
    level: LEVEL,
    skillTag: `listening.${skill}`,
    within,
    stimulusKey: stimulus.key,
    prompt,
    explanation,
  });
  return {
    choice: (
      skill: LSkill,
      within: Within,
      prompt: string,
      options: [string, string, string, string],
      correct: Pos,
      explanation: string,
    ): SeedItem => ({ ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...choiceContent(options, correct) }),
    /** "Who says what": statements (rows) matched to speakers (targets, a speaker may take two rows). */
    match: (
      skill: LSkill,
      within: Within,
      prompt: string,
      left: string[],
      right: string[],
      pairs: number[],
      explanation: string,
    ): SeedItem => ({ ...base(skill, within, prompt, explanation), type: "MATCHING", ...matchContent(left, right, pairs) }),
    tfng: (skill: LSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem => ({
      ...base(skill, within, "Richtig, falsch oder nicht im Text? Entscheiden Sie für jede Aussage.", explanation),
      type: "TRUE_FALSE_NG",
      ...tfngContent(statements),
    }),
    /** Note-taking: typed gaps, every acceptable spelling listed per gap. */
    notes: (within: Within, prompt: string, answers: Record<string, string[]>, explanation: string): SeedItem => ({
      ...base("notes", within, prompt, explanation),
      type: "GAP_FILL",
      content: { kind: "GAP", gaps: Object.keys(answers).map((id) => ({ id })) },
      key: { kind: "GAP", answers },
    }),
  };
}

// ---------------------------------------------------------------- Clip 1: expert interview

const lPausen = clip(
  "pausen-interview-v3",
  "Radiointerview: Warum Pausen keine verlorene Zeit sind",
  "Gesundheit: Pausen und Erholung",
  [
    { label: "Moderatorin", voice: "B" },
    { label: "Dr. Brandt", voice: "A" },
  ],
  [
    "Moderatorin: Willkommen zu unserer Sendung. Heute geht es um Pausen. Mein Gast ist der Arbeitspsychologe Doktor Jonas Brandt. Guten Tag, Herr Brandt.",
    "Dr. Brandt: Guten Tag.",
    "Moderatorin: Viele essen mittags am Schreibtisch und arbeiten einfach durch. Ist das wirklich so schlimm?",
    "Dr. Brandt: Na ja, schlimm ist vielleicht das falsche Wort. Aber klug ist es nicht. Das Gehirn kann sich nicht ewig konzentrieren. Nach etwa sechzig, nein, nach etwa neunzig Minuten lässt die Aufmerksamkeit deutlich nach.",
    "Moderatorin: Und das merkt man dann?",
    "Dr. Brandt: Eben oft nicht. Man arbeitet ja weiter. Nur langsamer und mit mehr Fehlern.",
    "Moderatorin: Viele sagen trotzdem: Ich habe keine Zeit für Pausen.",
    "Dr. Brandt: Das höre ich ständig. Aber man muss es umgekehrt sehen. In einer Studie haben wir Beschäftigte mit regelmäßigen kurzen Pausen mit einer Gruppe ohne Pausen verglichen. Am Abend hatten beide Gruppen ungefähr gleich viel geschafft. Aber die Gruppe mit den Pausen war deutlich weniger erschöpft.",
    "Moderatorin: Was heißt denn kurz? Fünf Minuten? Eine halbe Stunde?",
    "Dr. Brandt: Beides. Die Mittagspause sollte mindestens eine halbe Stunde dauern, also dreißig Minuten, nicht weniger. Dazwischen reichen drei bis fünf Minuten. Wichtig ist, was man dann macht. Aufs Handy schauen und Nachrichten lesen ist keine Erholung. Besser: aufstehen, ein paar Schritte gehen, aus dem Fenster schauen.",
    "Moderatorin: Und der schnelle Kaffee am Schreibtisch?",
    "Dr. Brandt: Hm, nur bedingt. Der Kaffee ist nicht das Problem, sondern der Ort. Man sitzt vor dem Bildschirm, und nach zwei Minuten liest man doch wieder die nächste E-Mail. Schon ein Ortswechsel hilft, zum Beispiel in die Küche. Ach so, und noch etwas: Wenn man dort mit jemandem über etwas ganz anderes spricht, umso besser.",
    "Moderatorin: Und im Homeoffice? Da erinnert einen ja niemand.",
    "Dr. Brandt: Genau das ist das Problem. Im Büro geht man zusammen in die Kantine, zu Hause fehlt dieser Rhythmus. Ich empfehle deshalb: Pausen wie Termine in den Kalender eintragen. Klingt übertrieben, funktioniert aber erstaunlich gut.",
    "Moderatorin: Und was können Führungskräfte tun?",
    "Dr. Brandt: Sehr viel. Wenn die Chefin selbst nie Pause macht und mittags noch E-Mails verschickt, verstehen die anderen das als Signal. Auch wenn es niemand ausspricht. Also: mit gutem Beispiel vorangehen. Regeln allein helfen wenig, wenn sie niemand vorlebt.",
    "Moderatorin: Herr Brandt, vielen Dank für das Gespräch.",
    "Dr. Brandt: Gern.",
  ],
);

const l1 = forClip(lPausen);
const lPausenItems: SeedItem[] = [
  l1.choice("detail", "EASY",
    "Was passiert laut Dr. Brandt, wenn man nach etwa anderthalb Stunden keine Pause macht?",
    [
      "Man bemerkt sofort, dass die Konzentration nachlässt, und hört von selbst auf.",
      "Man kann nach kurzer Zeit überhaupt nicht mehr weiterarbeiten und wird krank.",
      "Man arbeitet zwar weiter, aber langsamer und macht dabei mehr Fehler als zu Beginn.",
      "Man bekommt Kopfschmerzen und muss die Arbeit für den Rest des Tages beenden.",
    ], 2,
    "„Man arbeitet ja weiter. Nur langsamer und mit mehr Fehlern.“ Dass man es merkt, wird verneint („Eben oft nicht“). Die Zahl wird korrigiert: nicht sechzig, sondern neunzig Minuten."),
  l1.choice("detail", "MID",
    "Was hat die Studie gezeigt, an der Dr. Brandt beteiligt war?",
    [
      "Beschäftigte mit Pausen schafften etwa so viel wie die Vergleichsgruppe und waren weniger erschöpft.",
      "Beschäftigte mit Pausen schafften deutlich mehr als die Vergleichsgruppe und waren genauso erschöpft.",
      "Beschäftigte ohne Pausen waren am Ende des Tages weniger müde als die Gruppe mit Pausen.",
      "Beschäftigte mit Pausen schafften deutlich weniger als die Vergleichsgruppe, waren aber zufriedener.",
    ], 0,
    "„Am Abend hatten beide Gruppen ungefähr gleich viel geschafft. Aber die Gruppe mit den Pausen war deutlich weniger erschöpft.“ „Deutlich mehr“ ist eine Übertreibung, „zufriedener“ wird nicht gesagt."),
  l1.tfng("detail", "MID",
    [
      ["Dr. Brandt hält es für ausreichend, wenn die Mittagspause nur etwa zehn Minuten dauert.", "F"],
      ["Nach Dr. Brandt erholt man sich bei einer Pause im Freien besser als in einem geschlossenen Raum.", "NG"],
      ["Für das Homeoffice empfiehlt Dr. Brandt, Pausen fest einzuplanen.", "R"],
      ["Die Studie, an der Dr. Brandt beteiligt war, wurde in mehreren Ländern durchgeführt.", "NG"],
    ],
    "1: Die Mittagspause soll mindestens dreißig Minuten dauern. 2: Genannt werden Aufstehen, Gehen, Fensterblick und Ortswechsel zum Beispiel in die Küche, ein Vergleich Freiluft und Innenraum fehlt. 3: Pausen wie Termine in den Kalender eintragen. 4: Wo die Studie lief, sagt er nicht."),
  l1.choice("attitude", "HARD",
    "Welche Rolle spielen Führungskräfte nach Meinung von Dr. Brandt?",
    [
      "Sie sollten die Pausenzeiten verbindlich festlegen und täglich kontrollieren, ob sie eingehalten werden.",
      "Ihr eigenes Verhalten prägt, wie die Mitarbeitenden Pausen einschätzen und tatsächlich nutzen.",
      "Sie haben auf das Pausenverhalten kaum Einfluss, solange die Arbeitsmenge hoch bleibt.",
      "Sie sollten die Mittagspause für alle verlängern, damit niemand mehr am Schreibtisch isst.",
    ], 1,
    "„mit gutem Beispiel vorangehen“; „Regeln allein helfen wenig, wenn sie niemand vorlebt“. Auf die Frage nach ihrem Einfluss antwortet er: „Sehr viel.“"),
];

// ---------------------------------------------------------------- Clip 2: short lecture

const lAufschieben = clip(
  "vortrag-aufschieben-v3",
  "Kurzvortrag: Warum wir Aufgaben aufschieben",
  "Psychologie: Selbstorganisation",
  [{ label: "Referentin", voice: "B" }],
  [
    "Referentin: Guten Tag, meine Damen und Herren. Heute geht es um etwas, das fast jeder kennt: das Aufschieben.",
    "Referentin: Ich erkläre zuerst, was dahintersteckt. Dann besprechen wir zwei verbreitete Irrtümer. Und am Ende gibt es ein paar praktische Strategien.",
    "Referentin: Lange galt Aufschieben als Faulheit. Oder als schlechtes Zeitmanagement. Die neuere Forschung sieht das anders. Wir schieben vor allem das auf, was mit unangenehmen Gefühlen verbunden ist. Unsicherheit zum Beispiel. Oder Langeweile. Oder die Angst, Fehler zu machen. Aufschieben ist also ein Versuch, diesen Gefühlen auszuweichen. Kurzfristig klappt das sogar. Langfristig wird der Druck aber größer.",
    "Referentin: Damit zum ersten Irrtum. Viele sagen: Unter Zeitdruck arbeite ich am besten. Na ja. Die Untersuchungen zeigen: Die Ergebnisse sind im Durchschnitt schlechter. Man fühlt sich produktiv, ja, weil man plötzlich sehr konzentriert ist. Aber für Korrekturen bleibt keine Zeit mehr.",
    "Referentin: Der zweite Irrtum betrifft die Motivation. Ich fange an, sobald ich motiviert bin, heißt es oft. Meistens ist es umgekehrt. Die Motivation kommt erst, wenn man schon angefangen hat und erste Fortschritte sieht.",
    "Referentin: Ein Beispiel. Eine Studentin muss eine Hausarbeit schreiben. Wochenlang öffnet sie die Datei nicht, weil ihr das Thema riesig vorkommt. Dann nimmt sie sich vor, nur zehn Minuten Stichpunkte zu sammeln. Am Ende schreibt sie zwei Stunden. Also: Nicht die Motivation bringt uns zum Anfangen, sondern das Anfangen bringt die Motivation.",
    "Referentin: Was kann man nun tun? Erstens: große Aufgaben in sehr kleine Schritte zerlegen. Statt gleich den ganzen Bericht zu schreiben, erstellt man erst mal nur die Gliederung. Zweitens die Zwei-Minuten-Regel: Dauert eine Aufgabe weniger als zwei Minuten, erledigt man sie sofort. Und drittens: Ablenkungen verringern. Das Handy zum Beispiel in einen anderen Raum legen.",
    "Referentin: Ein Punkt noch, der mir wichtig ist. Wer sich für das Aufschieben heftig kritisiert, schiebt danach meist noch mehr auf. Ein freundlicher Umgang mit sich selbst ist also nicht nur angenehmer, sondern auch wirksamer. Vielen Dank für Ihre Aufmerksamkeit.",
  ],
);

const l2 = forClip(lAufschieben);
const lAufschiebenItems: SeedItem[] = [
  l2.choice("gist", "MID",
    "Wie erklärt die neuere Forschung laut Vortrag das Aufschieben?",
    [
      "als Folge von Faulheit und fehlender Selbstdisziplin im Alltag",
      "als Versuch, unangenehmen Gefühlen vorerst aus dem Weg zu gehen",
      "als Anzeichen dafür, dass jemand zu viele Aufgaben gleichzeitig hat",
      "als Ergebnis eines schlechten Zeitmanagements, das man lernen kann",
    ], 1,
    "Die frühere Sicht (Faulheit, Zeitmanagement) wird genannt und verworfen; neu ist: Aufschieben vermeidet unangenehme Gefühle."),
  l2.choice("detail", "MID",
    "Was sagt die Referentin über das Arbeiten unter Zeitdruck?",
    [
      "Man arbeitet konzentrierter und macht daher am Ende deutlich weniger Fehler.",
      "Man kann sich schlechter konzentrieren, hat dafür aber mehr Zeit für Korrekturen.",
      "Nur Menschen mit wenig Erfahrung leiden darunter, alle anderen arbeiten besser.",
      "Die Ergebnisse fallen im Durchschnitt schlechter aus, obwohl man sich produktiv fühlt.",
    ], 3,
    "Ergebnisse „im Durchschnitt schlechter“, man „fühlt sich produktiv“. Konzentriert ist man laut Vortrag gerade sehr, Korrekturzeit bleibt aber keine; besser arbeiten ist der Irrtum."),
  l2.choice("detail", "EASY",
    "Was sagt die Referentin über die Motivation?",
    [
      "Sie ist die Voraussetzung dafür, dass man überhaupt mit einer Aufgabe anfangen kann.",
      "Sie hängt vor allem davon ab, wie groß und schwierig das Thema wirkt.",
      "Sie entsteht oft erst, nachdem man mit der Aufgabe schon begonnen hat.",
      "Sie wächst vor allem durch Lob und Rückmeldungen anderer Menschen.",
    ], 2,
    "„Die Motivation kommt erst, wenn man schon angefangen hat.“ Option a ist der zitierte Irrtum."),
  l2.tfng("detail", "HARD",
    [
      ["Eine empfohlene Strategie ist, ein großes Vorhaben in sehr kleine Abschnitte aufzuteilen.", "R"],
      ["Nach der Zwei-Minuten-Regel notiert man kurze Aufgaben und erledigt sie gesammelt am Abend.", "F"],
      ["Die Referentin empfiehlt, schwierige Aufgaben möglichst am frühen Morgen zu erledigen.", "NG"],
      ["Wer sich für das Aufschieben streng kritisiert, schafft danach laut Referentin mehr.", "F"],
    ],
    "1: „in sehr kleine Schritte zerlegen“. 2: Kurze Aufgaben erledigt man sofort. 3: Zur Tageszeit sagt sie nichts. 4: Wer sich heftig kritisiert, schiebt danach noch mehr auf."),
];

// ---------------------------------------------------------------- Clip 3: everyday conversation

const lTermin = clip(
  "kollegen-termin-v3",
  "Gespräch unter Kollegen: Ein Termin wird verschoben",
  "Arbeit: Termine und Absprachen",
  [
    { label: "Nina", voice: "B" },
    { label: "Tarek", voice: "A" },
  ],
  [
    "Nina: Hallo Tarek, hast du kurz Zeit? Es geht um den Kundentermin nächste Woche.",
    "Tarek: Klar. Ich dachte, da ist alles geklärt.",
    "Nina: Eigentlich schon. Aber die Kundin hat heute Morgen angerufen. Dienstag klappt doch nicht, sie ist an dem Tag auf einer Messe.",
    "Tarek: Ach so. Hat sie einen anderen Tag vorgeschlagen?",
    "Nina: Zuerst Montag. Aber da ist ja unsere Teambesprechung, die können wir nicht verschieben. Dann haben wir uns auf Donnerstag geeinigt. Donnerstag um zehn.",
    "Tarek: Donnerstag passt mir gut. Nachmittags habe ich zwar einen Arzttermin, aber bis dahin sind wir ja längst fertig.",
    "Nina: Eben. Das Problem ist ein anderes. Die Kundin will jetzt auch die Zahlen vom letzten Quartal sehen. Die haben wir bisher gar nicht in der Präsentation.",
    "Tarek: Hm. Die Zahlen hat doch Sabine aus der Buchhaltung. Soll ich sie fragen?",
    "Nina: Das wäre super. Ich kümmere mich solange um die Folien und baue die Struktur um. Mit dem Schluss war ich sowieso nicht zufrieden.",
    "Tarek: Ja, der war ein bisschen lang. Sollen wir uns am Mittwoch noch mal zusammensetzen und alles durchgehen?",
    "Nina: Gute Idee. Mittwoch um drei? Nein, warte, um drei habe ich noch die Besprechung mit der Technik. Lieber um vier.",
    "Tarek: Okay, Mittwoch um vier. Ich schreibe dir, sobald ich die Zahlen habe.",
    "Nina: Danke dir.",
  ],
);

const l3 = forClip(lTermin);
const lTerminItems: SeedItem[] = [
  l3.choice("detail", "EASY",
    "Warum muss der Termin mit der Kundin verschoben werden?",
    [
      "Am geplanten Tag findet für Nina und Tarek eine wichtige Teambesprechung statt.",
      "Die Kundin hat am geplanten Tag einen anderen beruflichen Termin, nämlich eine Messe.",
      "Tarek hat am geplanten Tag einen Arzttermin und kann deshalb nicht teilnehmen.",
      "Die Kundin ist am geplanten Tag krank und möchte niemanden anstecken.",
    ], 1,
    "Die Kundin ist am Dienstag auf einer Messe. Die Teambesprechung ist am Montag, der Arzttermin am Donnerstagnachmittag."),
  l3.choice("detail", "MID",
    "Wann soll die Präsentation bei der Kundin jetzt stattfinden?",
    ["am Donnerstagvormittag", "am Montagvormittag", "am Mittwochnachmittag", "am Dienstagnachmittag"], 0,
    "Einigung auf „Donnerstag um zehn“. Montag wurde abgelehnt, Mittwoch ist nur das interne Vorbereitungstreffen, Dienstag fällt wegen der Messe aus."),
  l3.choice("inference", "HARD",
    "Wann treffen sich Nina und Tarek, um die Präsentation gemeinsam durchzugehen?",
    ["Mittwoch um drei", "Donnerstag um zehn", "Dienstag um vier", "Mittwoch um vier"], 3,
    "Nina schlägt erst Mittwoch um drei vor, korrigiert sich aber wegen einer anderen Besprechung: Mittwoch um vier. Donnerstag um zehn ist der Kundentermin."),
];

// ---------------------------------------------------------------- Clip 4: voicemail with typed notes

const lZahnarzt = clip(
  "voicemail-zahnarzt",
  "Nachricht auf dem Anrufbeantworter",
  "Gesundheit: Termin in der Zahnarztpraxis",
  [{ label: "Frau Winter", voice: "B" }],
  [
    "Frau Winter: Guten Tag, hier ist die Zahnarztpraxis Doktor Merz, mein Name ist Winter. Ich rufe wegen Ihres Termins am Dienstag an. Leider ist Doktor Merz an dem Tag auf einer Fortbildung. Wir müssen Ihren Termin deshalb verschieben.",
    "Frau Winter: Wir könnten Ihnen Mittwoch anbieten, nein, Entschuldigung, Donnerstag. Donnerstag um vierzehn Uhr dreißig, also halb drei. Bitte sagen Sie uns bis morgen Mittag Bescheid, ob das bei Ihnen passt.",
    "Frau Winter: Sie erreichen uns unter null vier eins eins, fünf fünf acht, sieben drei zwei. Ich wiederhole: null vier eins eins, fünf fünf acht, sieben drei zwei. Wir sind täglich bis siebzehn Uhr da. Auf Wiederhören.",
  ],
);

const l4 = forClip(lZahnarzt);
const lZahnarztItems: SeedItem[] = [
  l4.choice("gist", "EASY",
    "Warum ruft die Praxis an?",
    [
      "Die Praxis hat den Termin im Computer versehentlich doppelt vergeben.",
      "Die Praxis bleibt am vereinbarten Tag wegen Bauarbeiten im Haus geschlossen.",
      "Der Zahnarzt ist am vereinbarten Tag auf einer Weiterbildung.",
      "Die Praxis muss den Termin verschieben, weil ein Behandlungsgerät defekt ist.",
    ], 2,
    "Doktor Merz ist am Dienstag auf einer Fortbildung („Weiterbildung“), deshalb wird der Termin verschoben. Von einem Computerfehler, Bauarbeiten oder einem defekten Gerät ist keine Rede."),
  l4.notes("EASY",
    "Sie hören eine Nachricht auf dem Anrufbeantworter. Notieren Sie die Angaben.\n\nNeuer Termin: {{g1}}, {{g2}} Uhr\nRückruf unter der Nummer: {{g3}}",
    {
      g1: ["Donnerstag", "Do", "am Donnerstag", "am Do"],
      g2: ["14:30", "14.30", "14 30", "14:30 Uhr", "14.30 Uhr", "14 Uhr 30", "halb drei", "halb 3", "vierzehn Uhr dreißig", "vierzehn dreißig", "um 14:30", "um 14.30", "um 14:30 Uhr", "um 14.30 Uhr", "um halb drei", "um halb 3", "halb drei", "halb drei Uhr", "halb 3 Uhr", "14.30h"],
      g3: ["0411 558732"],
    },
    "Die Sprecherin korrigiert sich beim Tag: nicht Mittwoch, sondern Donnerstag. Uhrzeit: vierzehn Uhr dreißig, also halb drei (14:30). Telefonnummer: 0411 558732, zur Kontrolle wiederholt (der Scorer vergleicht Ziffern, Leerzeichen und Striche sind egal). Akzeptiert werden außerdem Tag und Uhrzeit mit „am“ bzw. „um“ sowie 14:30, 14.30 und halb drei."),
];

// ---------------------------------------------------------------- Clip 5: station announcement

const lDurchsage = clip(
  "bahn-durchsage",
  "Durchsage am Bahnhof",
  "Reisen: Zugausfall und Ersatzverkehr",
  [{ label: "Durchsage", voice: "A" }],
  [
    "Durchsage: Achtung auf Gleis vier! Der Regionalexpress nach Hannover, planmäßige Abfahrt vierzehn Uhr zwölf, fällt heute aus. Grund ist ein technischer Defekt am Zug.",
    "Durchsage: Reisende nach Hannover nutzen bitte den Intercity auf Gleis sieben. Der Zug fährt zwanzig Minuten später, um vierzehn Uhr zweiunddreißig. Ihre Fahrkarte gilt ohne Aufpreis. Ich wiederhole: Intercity nach Hannover, Gleis sieben, vierzehn Uhr zweiunddreißig.",
    "Durchsage: Für Reisende nach Celle gilt: Der Ersatzbus fährt wie geplant um vierzehn Uhr fünfzehn von Haltestelle B vor dem Bahnhof. Wir bitten um Ihr Verständnis.",
  ],
);

const l5 = forClip(lDurchsage);
const lDurchsageItems: SeedItem[] = [
  l5.choice("detail", "MID",
    "Was sollen Reisende nach Hannover tun?",
    [
      "Auf Gleis vier den nächsten Regionalexpress um vierzehn Uhr fünfzehn abwarten.",
      "Mit ihrer Fahrkarte in den Intercity auf Gleis sieben einsteigen.",
      "Den Ersatzbus von Haltestelle B vor dem Bahnhof nehmen.",
      "Für den Intercity auf Gleis sieben am Schalter einen Aufpreis bezahlen.",
    ], 1,
    "Der Intercity auf Gleis sieben ist der Ersatz, die Fahrkarte gilt ohne Aufpreis. Der Bus gilt nur für Reisende nach Celle."),
  l5.choice("inference", "HARD",
    "Frau Sander will nach Celle und kommt um 14.20 Uhr am Bahnhof an. Was bedeutet das für sie?",
    [
      "Sie kann in den Intercity auf Gleis sieben einsteigen, der nach Celle fährt.",
      "Sie muss auf Gleis vier auf den nächsten Regionalexpress nach Celle warten.",
      "Sie erreicht den Ersatzbus von Haltestelle B vor dem Bahnhof noch pünktlich.",
      "Sie hat den Ersatzbus knapp verpasst und muss auf eine spätere Verbindung warten.",
    ], 3,
    "Der Ersatzbus nach Celle fährt „wie geplant“ um 14.15 Uhr; wer um 14.20 Uhr ankommt, hat ihn verpasst. Der Intercity fährt nach Hannover, ein Regionalexpress nach Celle wird nicht erwähnt."),
];

// ---------------------------------------------------------------- Clip 6: street interview

const lUmfrage = clip(
  "umfrage-nachrichten",
  "Straßenumfrage: Wie informieren Sie sich?",
  "Medien: Nachrichten und Podcasts",
  [
    { label: "Reporter", voice: "A" },
    { label: "Frau Berger", voice: "B" },
  ],
  [
    "Reporter: Wir fragen heute auf dem Marktplatz: Wie informieren Sie sich über das Tagesgeschehen? Entschuldigung, haben Sie kurz Zeit?",
    "Frau Berger: Ja, gern.",
    "Reporter: Zeitung, Fernsehen, Podcasts?",
    "Frau Berger: Hauptsächlich Podcasts. Morgens auf dem Rad höre ich zwanzig Minuten Nachrichten, nein, eher dreißig, ich fahre ja eine ganze Weile. Abends höre ich noch mal rein. Zeitung lese ich kaum noch, höchstens am Wochenende. Und Fernsehen? Nein, eigentlich gar nicht.",
    "Reporter: Warum Podcasts?",
    "Frau Berger: Weil ich dabei etwas anderes machen kann. Beim Zeitunglesen muss ich still sitzen, und das schaffe ich nicht.",
    "Reporter: Und Nachrichten im Internet?",
    "Frau Berger: Da bin ich skeptisch. Man weiß nie, wer dahintersteckt. Bei meinem Podcast weiß ich wenigstens, wer spricht.",
    "Reporter: Vielen Dank Ihnen.",
  ],
);

const l6 = forClip(lUmfrage);
const lUmfrageItems: SeedItem[] = [
  l6.choice("detail", "MID",
    "Warum hört Frau Berger lieber Podcasts, als Zeitung zu lesen?",
    [
      "Sie findet die Beiträge dort sorgfältiger recherchiert als in gedruckten Zeitungen.",
      "Sie hat auf dem Weg zur Arbeit keine Möglichkeit, eine Zeitung zu kaufen.",
      "Sie möchte vor allem Nachrichten aus der Region verfolgen, die nicht gedruckt werden.",
      "Beim Hören kann sie nebenbei etwas anderes tun, statt lange still zu sitzen.",
    ], 3,
    "„Weil ich dabei etwas anderes machen kann. Beim Zeitunglesen muss ich still sitzen.“ Qualität der Recherche oder regionale Themen nennt sie nicht."),
  l6.choice("detail", "HARD",
    "Wie lange hört Frau Berger morgens Nachrichten?",
    ["etwa zwanzig Minuten", "etwa vierzig Minuten", "etwa dreißig Minuten", "etwa sechzig Minuten"], 2,
    "Sie nennt zuerst zwanzig Minuten und korrigiert sich: „eher dreißig“. Vierzig und sechzig Minuten werden nicht genannt."),
];

// ---------------------------------------------------------------- Who says what (three voices, one clip per form)

const WSW_PROMPT =
  "Wer sagt was? Hören Sie das Gespräch. Ordnen Sie jeder Aussage eine Person zu. Eine Aussage passt zu keiner der drei Personen.";

const lUrlaub = clip(
  "urlaub-wer-sagt-was",
  "Gespräch unter Freunden: Wohin im Herbst?",
  "Reisen: Urlaubsplanung unter Freunden",
  [
    { label: "Lena", voice: "A" },
    { label: "Murat", voice: "B" },
    { label: "Josefine", voice: "D" },
  ],
  [
    "Lena: Also, wir müssen langsam mal entscheiden. Wohin fahren wir im Herbst? Ich hätte ja Lust auf Portugal.",
    "Murat: Portugal, na ja. Da war ich letztes Jahr, und ehrlich gesagt war es mir zu voll. Ich würde gern mal etwas ganz Neues sehen. Wie heißt das noch, dieses Land zwischen Österreich und Kroatien? Ach so, Slowenien!",
    "Josefine: Slowenien? Da kann man doch bestimmt viel wandern.",
    "Murat: Genau, deshalb finde ich es ja so spannend. Seen, Berge, kleine Dörfer.",
    "Josefine: Hm, Wandern ist nicht so meins, das wisst ihr. Mir wäre ein Ort am Wasser am liebsten, wo ich einfach nur liegen und lesen kann und nichts organisieren muss.",
    "Lena: Dann passt Portugal doch! Ich war schon dreimal dort und kenne ein paar ruhige Strände. Und ich habe gestern schon mal nachgesehen: Der Flug nach Faro kostet hin und zurück hundertachtzig, nein, hundertachtundachtzig Euro.",
    "Josefine: Hundertachtundachtzig, okay. Aber dazu kommt ja noch die Unterkunft. Ich kann in diesem Monat höchstens fünfhundert Euro für die ganze Reise ausgeben, also fünfhundert, mehr ist wirklich nicht drin.",
    "Murat: Nach Slowenien käme man mit dem Zug, das wäre billiger. Die Fahrt dauert allerdings fast zwölf Stunden, nein, vierzehn, wegen des Umsteigens in Wien.",
    "Lena: Vierzehn Stunden? Dann lieber fliegen.",
    "Josefine: Lasst uns erst mal die Unterkünfte vergleichen. Ich schicke euch heute Abend ein paar Links, und dann entscheiden wir am Wochenende.",
    "Lena: Gut, so machen wir es.",
    "Murat: Einverstanden.",
  ],
);
const lw1 = forClip(lUrlaub);
const lUrlaubItems: SeedItem[] = [
  lw1.match("detail", "MID", WSW_PROMPT,
    [
      "Diese Person muss bei den Kosten auf eine feste Obergrenze achten.",
      "Diese Person würde am liebsten mit dem eigenen Auto fahren.",
      "Diese Person wünscht sich ein Reiseziel, das sie noch nicht kennt.",
      "Diese Person hat sich schon über den Preis eines Flugs informiert.",
    ],
    ["Lena", "Murat", "Josefine", "Keine der drei Personen"],
    [3, 4, 2, 1],
    "Josefine: höchstens fünfhundert Euro. Auto: wird von niemandem gewünscht (Murat nennt den Zug). Murat: „etwas ganz Neues sehen“, Portugal kennt er schon. Lena: Flug nach Faro, hundertachtundachtzig Euro (nach Selbstkorrektur)."),
  lw1.choice("detail", "HARD",
    "Wie lange dauert die Zugfahrt nach Slowenien nach Murats Angabe?",
    ["etwa zwölf Stunden", "etwa vierzehn Stunden", "etwa sechzehn Stunden", "etwa zehn Stunden"], 1,
    "Murat sagt erst „fast zwölf Stunden“ und korrigiert sich: „nein, vierzehn“, wegen des Umsteigens in Wien."),
];

const lHof = clip(
  "hausversammlung-hof-wer-sagt-was",
  "Hausversammlung: Was soll in den Innenhof?",
  "Wohnen: Gestaltung des Innenhofs",
  [
    { label: "Frau Albers", voice: "A" },
    { label: "Herr Lindner", voice: "B" },
    { label: "Frau Seidel", voice: "D" },
  ],
  [
    "Frau Albers: So, dann kommen wir zum Innenhof. Die Hausverwaltung hat uns sechshundert Euro für die Gestaltung zugesagt, und wir sollen vorschlagen, was damit passiert.",
    "Herr Lindner: Dann muss ich gleich etwas sagen. Seit Monaten stehen die Fahrräder im Hausflur, und ich stolpere jeden Morgen darüber. Ich habe gezählt: vierzehn Räder, nein, sechzehn, wenn man die Kinderräder dazurechnet. Ein Fahrradständer im Hof wäre für mich das Wichtigste.",
    "Frau Albers: Ein Ständer ist sinnvoll, keine Frage. Aber ich hätte gern auch Hochbeete. Tomaten, Kräuter, vielleicht Salat. Das Gießen könnten wir im Wechsel machen, ich schreibe einen Plan.",
    "Frau Seidel: Ehrlich gesagt, ich würde am liebsten eine Bank oder zwei aufstellen. Einen Ort, wo man abends in Ruhe sitzen kann. Einen Spielplatz fände ich zu laut, das sage ich gleich.",
    "Herr Lindner: Einen Spielplatz brauchen wir sowieso nicht, der Park ist nur zwei Minuten entfernt.",
    "Frau Albers: Mit sechshundert Euro bekommen wir nicht alles. Ein Ständer für zwanzig Räder kostet schon etwa vierhundert.",
    "Frau Seidel: Dann nehmen wir zuerst den Ständer und im Frühjahr die Beete, und die Bänke kommen, wenn wieder Geld da ist?",
    "Herr Lindner: Damit kann ich leben.",
    "Frau Albers: Gut, dann stimmen wir gleich ab.",
  ],
);
const lw2 = forClip(lHof);
const lHofItems: SeedItem[] = [
  lw2.match("detail", "MID", WSW_PROMPT,
    [
      "Diese Person will, dass im Hof Gemüse und Kräuter angebaut werden.",
      "Diese Person wünscht sich vor allem einen ruhigen Platz zum Sitzen.",
      "Diese Person stört sich daran, dass Fahrräder im Hausflur im Weg stehen.",
      "Diese Person möchte im Hof einen Spielplatz für Kinder anlegen.",
    ],
    ["Frau Albers", "Herr Lindner", "Frau Seidel", "Keine der drei Personen"],
    [1, 3, 2, 4],
    "Frau Albers: Hochbeete mit Tomaten, Kräutern, Salat. Frau Seidel: Bänke für ruhige Abende. Herr Lindner: Räder im Flur, Fahrradständer. Spielplatz: Frau Seidel findet ihn zu laut, Herr Lindner braucht ihn nicht, niemand wünscht ihn."),
  lw2.choice("detail", "HARD",
    "Wie viele Fahrräder stehen laut Herrn Lindner im Hausflur, wenn man die Kinderräder mitzählt?",
    ["vierzehn", "zwölf", "zwanzig", "sechzehn"], 3,
    "Herr Lindner korrigiert sich: „vierzehn Räder, nein, sechzehn, wenn man die Kinderräder dazurechnet“. Zwanzig ist die Größe des geplanten Ständers."),
];

const lFilm = clip(
  "kino-wer-sagt-was",
  "Nach dem Kino: Eine Romanverfilmung",
  "Kultur: Verfilmung eines Romans",
  [
    { label: "Nora", voice: "A" },
    { label: "Ben", voice: "B" },
    { label: "Cem", voice: "C" },
  ],
  [
    "Nora: So, das war er also, der Film. Ich war ja gespannt, weil ich das Buch schon vor Jahren gelesen habe.",
    "Ben: Ich kannte die Geschichte gar nicht. Aber das Ende hat mich ehrlich gesagt ziemlich mitgenommen.",
    "Cem: Mich auch. Nur die Szene am Bahnhof, ach, die war mir fast zu kitschig. Und die Hauptrolle, na ja, der Schauspieler war für mich zu blass, ich habe ihm das alles nicht richtig geglaubt.",
    "Nora: Stimmt, im Buch ist die Figur viel vielschichtiger. Das haben sie im Film ziemlich zusammengestrichen. Dafür fand ich die Musik wunderbar.",
    "Ben: Was mich gestört hat, war die Länge. Der Film dauert fast hundertsechzig Minuten, nein, hundertfünfzig, ich habe vorhin auf die Karte geschaut. Ab der Hälfte habe ich dauernd auf die Uhr gesehen.",
    "Cem: Mir ist das gar nicht so lang vorgekommen. Aber ich glaube, ich hole mir jetzt das Buch. Wenn die Figur dort so viel mehr Tiefe hat, will ich das lesen.",
    "Nora: Mach das, ich leihe dir meins gern.",
    "Ben: Und wir gehen danach noch etwas essen, oder?",
  ],
);
const lw3 = forClip(lFilm);
const lFilmItems: SeedItem[] = [
  lw3.match("detail", "HARD", WSW_PROMPT,
    [
      "Diese Person will sich jetzt die Buchvorlage besorgen.",
      "Diese Person lobt die schauspielerische Leistung der Hauptrolle.",
      "Diese Person kannte die Geschichte schon vor dem Kinobesuch.",
      "Diese Person kritisiert vor allem die Länge des Films.",
    ],
    ["Nora", "Ben", "Cem", "Keine der drei Personen"],
    [3, 4, 1, 2],
    "Cem: „ich hole mir jetzt das Buch“. Lob für den Hauptdarsteller: niemand, Cem findet ihn zu blass. Nora: hat das Buch vor Jahren gelesen. Ben: „Was mich gestört hat, war die Länge“."),
  lw3.choice("detail", "MID",
    "Wie lange dauert der Film nach Bens Angabe?",
    ["etwa hundertvierzig Minuten", "etwa hundertsechzig Minuten", "etwa hundertfünfzig Minuten", "etwa hundertachtzig Minuten"], 2,
    "Ben sagt erst „fast hundertsechzig Minuten“ und korrigiert: „nein, hundertfünfzig“."),
];

// ---------------------------------------------------------------- Play once (announcements and news, one per form)

const lBruecke = clip(
  "nachrichten-bruecke-einmal",
  "Radionachrichten: Brücke gesperrt",
  "Verkehr: Brückensperrung",
  [{ label: "Nachrichtensprecher", voice: "B" }],
  [
    "Nachrichtensprecher: Und nun zum Verkehr. Die Rheinbrücke zwischen Rheinfeld und Auenau wird ab kommendem Montag für voraussichtlich drei Wochen gesperrt. Grund sind Reparaturen an den Fahrbahnplatten, die bei einer Kontrolle im Frühjahr als beschädigt aufgefallen waren.",
    "Nachrichtensprecher: Der Autoverkehr wird über die Umleitung am Hafen geführt. Das verlängert die Fahrzeit nach Angaben der Stadt um etwa fünfzehn Minuten. Lastwagen über siebeneinhalb Tonnen dürfen die Umleitung nicht benutzen und werden über die Autobahn geleitet.",
    "Nachrichtensprecher: Fußgänger und Radfahrer können die Brücke weiterhin überqueren, für sie bleibt ein schmaler Streifen frei. Die Buslinien sieben und zwölf fahren während der Sperrung nur bis zur Haltestelle Rheinufer, von dort pendelt ein Ersatzbus. Weitere Informationen finden Sie auf der Internetseite der Stadt.",
  ],
  1,
);
const lo1 = forClip(lBruecke);
const lBrueckeItems: SeedItem[] = [
  lo1.choice("gist", "EASY",
    "Warum wird die Rheinbrücke gesperrt?",
    [
      "Die Fahrbahn der Brücke muss repariert werden, weil Platten beschädigt sind.",
      "Auf der Brücke soll eine neue Straßenbahnlinie gebaut werden.",
      "Nach einem Unfall muss die Brücke auf Schäden untersucht werden.",
      "Das Hochwasser des Flusses hat die Zufahrt zur Brücke überspült.",
    ], 0,
    "Reparaturen an den Fahrbahnplatten, die bei einer Kontrolle als beschädigt aufgefallen waren. Von Straßenbahn, Unfall oder Hochwasser ist keine Rede."),
  lo1.choice("detail", "MID",
    "Was gilt während der Sperrung für Radfahrer?",
    [
      "Sie müssen wie die Autos die Umleitung am Hafen nehmen.",
      "Sie dürfen die Brücke auf einem schmalen Streifen weiter benutzen.",
      "Sie werden mit einem Ersatzbus auf die andere Seite gebracht.",
      "Sie dürfen die Brücke nur zu bestimmten Tageszeiten überqueren.",
    ], 1,
    "„Fußgänger und Radfahrer können die Brücke weiterhin überqueren, für sie bleibt ein schmaler Streifen frei.“ Umleitung und Ersatzbus gelten für Autos bzw. Busfahrgäste."),
];

const lSchwimmbad = clip(
  "durchsage-schwimmbad-einmal",
  "Durchsage im Schwimmbad",
  "Freizeit: Schwimmbad und Öffnungszeiten",
  [{ label: "Durchsage", voice: "A" }],
  [
    "Durchsage: Liebe Badegäste, wir informieren Sie über eine Änderung im heutigen Programm. Das Sportbecken ist zwischen vierzehn und sechzehn Uhr wegen eines Schulschwimmkurses nur eingeschränkt nutzbar. Zwei Bahnen stehen Ihnen weiterhin zur Verfügung.",
    "Durchsage: Der Aqua-Fitness-Kurs um fünfzehn Uhr findet nicht wie geplant im Sportbecken statt, sondern im Lehrschwimmbecken im Untergeschoss. Treffpunkt ist wie gewohnt am Eingang der Umkleiden.",
    "Durchsage: Außerdem bitten wir Sie, Wertsachen in den Schließfächern aufzubewahren. Für nicht abgeschlossene Spinde übernehmen wir keine Haftung. Das Bistro schließt heute schon um achtzehn Uhr, also eine Stunde früher als sonst. Vielen Dank für Ihr Verständnis.",
  ],
  1,
);
const lo2 = forClip(lSchwimmbad);
const lSchwimmbadItems: SeedItem[] = [
  lo2.choice("detail", "MID",
    "Wo findet der Aqua-Fitness-Kurs heute statt?",
    [
      "im Sportbecken, aber nur auf zwei der Bahnen",
      "im Freibecken, falls das Wetter es erlaubt",
      "im Lehrschwimmbecken im Untergeschoss",
      "in der Sporthalle neben dem Eingang",
    ], 2,
    "„nicht wie geplant im Sportbecken, sondern im Lehrschwimmbecken im Untergeschoss“. Zwei Bahnen im Sportbecken stehen den normalen Badegästen zur Verfügung."),
  lo2.choice("detail", "EASY",
    "Was gilt heute für das Bistro?",
    [
      "Es bleibt wegen der Schulschwimmkurse den ganzen Tag geschlossen.",
      "Es schließt eine Stunde früher als an anderen Tagen.",
      "Es öffnet erst am späten Nachmittag, nach dem Aqua-Fitness-Kurs.",
      "Es bietet heute nur noch Getränke und keine Speisen an.",
    ], 1,
    "„Das Bistro schließt heute schon um achtzehn Uhr, also eine Stunde früher als sonst.“"),
];

const lStadtfest = clip(
  "radiotipp-stadtfest-einmal",
  "Radiotipp: Das Altstadtfest",
  "Kultur: Stadtfest am Wochenende",
  [{ label: "Moderatorin", voice: "D" }],
  [
    "Moderatorin: Und noch ein Tipp fürs Wochenende: In Rheinfeld beginnt am Freitagabend das Altstadtfest. Eröffnet wird es um neunzehn Uhr auf dem Marktplatz, der Eintritt ist an allen drei Tagen frei. Auf vier Bühnen spielen mehr als dreißig Bands, am Samstag gibt es außerdem einen Flohmarkt am Fluss.",
    "Moderatorin: Wegen des erwarteten Andrangs bittet die Stadt, nicht mit dem Auto anzureisen. Am Samstag und Sonntag fahren die Straßenbahnen im Zehn-Minuten-Takt, und am Bahnhof gibt es einen kostenlosen Fahrradparkplatz. Wer doch mit dem Auto kommt, findet Plätze auf dem Messegelände, von dort fährt ein Shuttlebus.",
    "Moderatorin: Bei Regen wird das Programm nicht abgesagt, die Bühnen sind überdacht. Nur der Flohmarkt fällt dann aus.",
  ],
  1,
);
const lo3 = forClip(lStadtfest);
const lStadtfestItems: SeedItem[] = [
  lo3.choice("detail", "MID",
    "Wie bittet die Stadt die Besucher anzureisen?",
    [
      "mit den Straßenbahnen oder mit dem Fahrrad, nicht mit dem Auto",
      "mit dem Auto, weil die Straßenbahnen am Wochenende nicht fahren",
      "mit dem Shuttlebus, der alle zehn Minuten am Bahnhof abfährt",
      "mit dem Zug, weil es am Marktplatz keine Parkplätze gibt",
    ], 0,
    "Die Stadt bittet, nicht mit dem Auto anzureisen; Straßenbahn im Zehn-Minuten-Takt, kostenloser Fahrradparkplatz am Bahnhof. Der Shuttlebus fährt vom Messegelände."),
  lo3.choice("detail", "HARD",
    "Was passiert bei Regen?",
    [
      "Das gesamte Programm wird auf den nächsten Tag verschoben.",
      "Die Bühnen bleiben geschlossen, nur der Flohmarkt findet statt.",
      "Das Programm läuft weiter, aber der Flohmarkt entfällt.",
      "Der Eintritt wird in diesem Fall für alle Besucher ermäßigt.",
    ], 2,
    "„Bei Regen wird das Programm nicht abgesagt, die Bühnen sind überdacht. Nur der Flohmarkt fällt dann aus.“"),
];

const listening: SeedBankPart = {
  stimuli: [
    lPausen, lAufschieben, lTermin, lZahnarzt, lDurchsage, lUmfrage,
    lUrlaub, lHof, lFilm, lBruecke, lSchwimmbad, lStadtfest,
  ],
  items: [
    ...lPausenItems, ...lAufschiebenItems, ...lTerminItems, ...lZahnarztItems, ...lDurchsageItems, ...lUmfrageItems,
    ...lUrlaubItems, ...lHofItems, ...lFilmItems, ...lBrueckeItems, ...lSchwimmbadItems, ...lStadtfestItems,
  ],
};

// ================================================================ WRITING

const FORUM = "neutral/sachlich (Forumsbeitrag)";
const FORMAL = "formell (Sie)";

function writingTask(
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

const FORUM_WORDS: [number, number] = [120, 200];
const MESSAGE_WORDS: [number, number] = [80, 140];
const COMPLAINT_WORDS: [number, number] = [100, 170];
const FORUM_EXPLANATION =
  "Bewertung nach Erfüllung (alle vier Punkte, Textsorte, Länge ca. 150 Wörter), Kohärenz (Einleitung, Schluss, Verknüpfung), Wortschatz und Strukturen. Weniger als die Hälfte der Wortzahl oder Themaverfehlung: Erfüllung E, Aufgabe 0 Punkte.";
const MESSAGE_EXPLANATION =
  "Bewertung nach Erfüllung (alle Punkte, formelle Anrede und Gruß, Länge ca. 100 Wörter), Kohärenz, Wortschatz und Strukturen; höfliche Bitten (Konjunktiv II) werden erwartet.";

const writingItems: SeedItem[] = [
  writingTask("opinion", "MID", FORUM_WORDS,
    "Sie lesen in einem Online-Forum die Frage: „Sollen alle Beschäftigten das Recht haben, von zu Hause aus zu arbeiten?“\n\n" +
      "Schreiben Sie einen Forumsbeitrag (ca. 150 Wörter). Gehen Sie auf die folgenden Punkte ein:\n" +
      "- Äußern Sie Ihre Meinung zu einem Recht auf Homeoffice.\n" +
      "- Nennen Sie Vor- und Nachteile des Homeoffice für Beschäftigte.\n" +
      "- Für welche Berufe kommt Homeoffice nicht in Frage? Nennen Sie Beispiele.\n" +
      "- Schlagen Sie eine andere Möglichkeit vor, Arbeit flexibler zu gestalten.\n\n" +
      "Schreiben Sie eine passende Einleitung und einen Schluss.",
    [
      "eigene, begründete Meinung zu einem Recht auf Homeoffice",
      "mindestens ein Vorteil und ein Nachteil für Beschäftigte",
      "Berufe, in denen Homeoffice nicht möglich ist, mit Beispiel",
      "Vorschlag für eine andere flexible Arbeitsform (z. B. Gleitzeit, Teilzeit, Arbeitszeitkonto)",
    ],
    [
      "Ihre Meinung zu einem Recht auf Homeoffice",
      "Vor- und Nachteile für Beschäftigte",
      "Berufe ohne Homeoffice, mit Beispielen",
      "eine andere Möglichkeit für flexibles Arbeiten",
      "Einleitung und Schluss",
    ],
    FORUM, FORUM_EXPLANATION),
  writingTask("opinion", "HARD", FORUM_WORDS,
    "In einem Forum für Berufstätige wird diskutiert: „Wer soll für berufliche Weiterbildung bezahlen: die Beschäftigten selbst oder die Arbeitgeber?“\n\n" +
      "Schreiben Sie einen Forumsbeitrag (ca. 150 Wörter). Gehen Sie auf die folgenden Punkte ein:\n" +
      "- Warum ist Weiterbildung heute im Beruf wichtig?\n" +
      "- Welche Vorteile haben Arbeitgeber von gut ausgebildeten Beschäftigten?\n" +
      "- Nennen Sie ein Beispiel aus Ihrer eigenen Erfahrung oder Ihrem Umfeld.\n" +
      "- Wer sollte Ihrer Meinung nach die Kosten tragen? Begründen Sie.\n\n" +
      "Schreiben Sie eine passende Einleitung und einen Schluss.",
    [
      "Bedeutung von Weiterbildung heute (z. B. Digitalisierung, neue Anforderungen)",
      "Nutzen für Arbeitgeber",
      "konkretes Beispiel aus eigener Erfahrung oder Umfeld",
      "eigene begründete Position zur Kostenfrage, ggf. mit Kompromiss",
    ],
    [
      "warum Weiterbildung heute wichtig ist",
      "Vorteile für Arbeitgeber",
      "ein Beispiel aus Ihrer Erfahrung oder Ihrem Umfeld",
      "wer die Kosten tragen sollte, mit Begründung",
      "Einleitung und Schluss",
    ],
    FORUM, FORUM_EXPLANATION),
  writingTask("opinion", "MID", FORUM_WORDS,
    "In einem Online-Forum wird gefragt: „Sollen Geschäfte auch sonntags öffnen dürfen?“\n\n" +
      "Schreiben Sie einen Forumsbeitrag (ca. 150 Wörter). Gehen Sie auf die folgenden Punkte ein:\n" +
      "- Welche Vorteile hätten offene Geschäfte am Sonntag für Kundinnen und Kunden?\n" +
      "- Welche Nachteile könnte das für die Beschäftigten im Handel haben?\n" +
      "- Wie ist die Situation in Ihrer Stadt oder Region?\n" +
      "- Wie sollte eine gute Regelung Ihrer Meinung nach aussehen?\n\n" +
      "Schreiben Sie eine passende Einleitung und einen Schluss.",
    [
      "Vorteile für Kundschaft (z. B. Flexibilität, Zeit zum Einkaufen)",
      "Nachteile für Beschäftigte (z. B. Familienzeit, Erholung, Schichtarbeit)",
      "Situation in der eigenen Stadt oder Region (Öffnungszeiten, Gewohnheiten)",
      "eigener Vorschlag für eine Regelung mit Begründung",
    ],
    [
      "Vorteile für die Kundschaft",
      "Nachteile für die Beschäftigten",
      "die Situation in Ihrer Stadt oder Region",
      "Ihr Vorschlag für eine gute Regelung",
      "Einleitung und Schluss",
    ],
    FORUM, FORUM_EXPLANATION),
  writingTask("formal", "EASY", MESSAGE_WORDS,
    "Sie besuchen einen Weiterbildungskurs zum Thema Projektmanagement. Wegen einer Dienstreise können Sie an den nächsten beiden Terminen nicht teilnehmen. Schreiben Sie eine E-Mail an die Kursleiterin, Frau Lorenz (ca. 100 Wörter).\n\n" +
      "- Erklären Sie Ihre Situation.\n" +
      "- Fragen Sie, wie Sie den verpassten Stoff nachholen können.\n" +
      "- Machen Sie einen Vorschlag, wie Sie trotzdem teilnehmen könnten.\n" +
      "- Fragen Sie, ob Sie das Zertifikat trotzdem bekommen.",
    [
      "Erklärung: Dienstreise, zwei Termine verpasst",
      "Frage nach dem Nachholen des Stoffes (z. B. Unterlagen, Aufzeichnung)",
      "konkreter Vorschlag (z. B. Online-Teilnahme, Zusatzaufgabe)",
      "Frage nach dem Zertifikat; formelle Anrede und Gruß",
    ],
    [
      "Ihre Situation erklären",
      "fragen, wie Sie den Stoff nachholen können",
      "vorschlagen, wie Sie trotzdem teilnehmen könnten",
      "nach dem Zertifikat fragen",
      "Anrede und Gruß",
    ],
    FORMAL, MESSAGE_EXPLANATION),
  writingTask("formal", "MID", MESSAGE_WORDS,
    "Sie möchten ab dem nächsten Monat einen Abendkurs besuchen, der zweimal pro Woche um 17 Uhr beginnt. Schreiben Sie Ihrem Vorgesetzten, Herrn Okafor, eine E-Mail (ca. 100 Wörter).\n\n" +
      "- Bitten Sie um eine Änderung Ihrer Arbeitszeiten.\n" +
      "- Beschreiben Sie den Kurs und warum er für Sie wichtig ist.\n" +
      "- Machen Sie einen konkreten Vorschlag für Ihre neuen Arbeitszeiten.\n" +
      "- Erklären Sie, wie Ihre Aufgaben im Team trotzdem erledigt werden.",
    [
      "höfliche Bitte um geänderte Arbeitszeiten",
      "Kurs beschrieben und Nutzen begründet",
      "konkreter Zeitvorschlag (z. B. früher anfangen, früher gehen)",
      "Lösung für das Team (Vertretung, Erreichbarkeit); formelle Anrede und Gruß",
    ],
    [
      "um eine Änderung der Arbeitszeiten bitten",
      "den Kurs beschreiben und warum er wichtig ist",
      "neue Arbeitszeiten konkret vorschlagen",
      "wie die Aufgaben im Team erledigt werden",
      "Anrede und Gruß",
    ],
    FORMAL, MESSAGE_EXPLANATION),
  writingTask("formal", "HARD", MESSAGE_WORDS,
    "Sie haben im Auftrag Ihrer Firma an einer zweitägigen Fachtagung teilgenommen. Leider gab es einige organisatorische Probleme. Schreiben Sie eine E-Mail an den Veranstalter (ca. 100 Wörter).\n\n" +
      "- Beschreiben Sie, welche Probleme es gab.\n" +
      "- Zeigen Sie Verständnis für die Situation des Veranstalters.\n" +
      "- Fordern Sie eine angemessene Lösung, zum Beispiel eine teilweise Erstattung.\n" +
      "- Machen Sie einen Vorschlag für zukünftige Veranstaltungen.",
    [
      "mindestens zwei konkrete Probleme sachlich beschrieben",
      "Verständnis gezeigt, ohne die Kritik zurückzunehmen",
      "klare, höfliche Forderung (z. B. teilweise Erstattung, Gutschein)",
      "konstruktiver Vorschlag für die Zukunft; formelle Anrede und Gruß",
    ],
    [
      "die Probleme beschreiben",
      "Verständnis für den Veranstalter zeigen",
      "eine angemessene Lösung fordern",
      "einen Vorschlag für künftige Veranstaltungen machen",
      "Anrede und Gruß",
    ],
    FORMAL, MESSAGE_EXPLANATION),
  writingTask("complaint", "MID", COMPLAINT_WORDS,
    "Sie haben ein Wellness-Wochenende gebucht, das in einer Anzeige beworben wurde. Leider war nicht alles so, wie versprochen. Lesen Sie die Anzeige und Ihre Notizen und schreiben Sie eine E-Mail an das Hotel (ca. 120 Wörter).\n\n" +
      "Anzeige: „Seehotel Seeblick: Wellness-Wochenende für 189 Euro pro Person. Zwei Nächte im Doppelzimmer mit Seeblick, reichhaltiges Frühstücksbuffet bis 11 Uhr, freier Eintritt in die Saunalandschaft. Garantiert ruhige Lage!“\n\n" +
      "Ihre Notizen:\n" +
      "- Zimmer zur Straße, kein Seeblick\n" +
      "- ab 7 Uhr Baulärm vor dem Haus\n" +
      "- Frühstücksbuffet um 10 Uhr fast leer\n" +
      "- Sauna wegen Reparatur geschlossen\n\n" +
      "Beschreiben Sie alle vier Punkte aus Ihren Notizen und sagen Sie, was Sie vom Hotel erwarten.",
    [
      "Bezug auf die Anzeige und das gebuchte Angebot",
      "alle vier Mängel sachlich beschrieben (Zimmer, Lärm, Frühstück, Sauna)",
      "klare, höfliche Forderung (z. B. teilweise Erstattung, Gutschein) mit Begründung",
      "formelle Anrede und Gruß, ruhiger Ton ohne Beleidigungen",
    ],
    [
      "sich auf die Anzeige beziehen",
      "alle vier Mängel aus Ihren Notizen beschreiben",
      "eine Lösung verlangen",
      "Anrede und Gruß",
    ],
    FORMAL,
    "Beschwerde auf der Grundlage einer Anzeige und von Randnotizen (ÖSD-Muster Schreiben 1). Bewertung: Erfüllung (alle Notizen aufgegriffen), Kohärenz, Wortschatz, Strukturen; Anrede und Gruß sind Pflicht."),
  writingTask("opinion", "MID", FORUM_WORDS,
    "In einer Zeitschrift lesen Sie die Überschrift: „Immer mehr Menschen verzichten auf ein eigenes Auto.“ Schreiben Sie dazu einen Leserbrief (ca. 150 Wörter). Gehen Sie auf die folgenden Punkte ein:\n" +
      "- Wie finden Sie diese Entwicklung?\n" +
      "- Welche Erfahrungen haben Sie oder Ihr Umfeld mit Bus, Bahn, Fahrrad oder Carsharing?\n" +
      "- Wie ist die Situation in Ihrer Stadt oder Region?\n" +
      "- Was sollte sich ändern, damit mehr Menschen auf das Auto verzichten?\n\n" +
      "Schreiben Sie eine passende Einleitung und einen Schluss.",
    [
      "eigene, begründete Meinung zur Entwicklung",
      "konkrete Erfahrung mit anderen Verkehrsmitteln",
      "Vergleich mit der Situation in der eigenen Stadt oder Region (Verkehrsangebot, Gewohnheiten)",
      "Vorschlag, was sich ändern sollte, mit Begründung",
    ],
    [
      "Ihre Meinung zu dieser Entwicklung",
      "eigene Erfahrungen mit anderen Verkehrsmitteln",
      "die Situation in Ihrer Stadt oder Region",
      "ein Vorschlag, was sich ändern sollte",
      "Einleitung und Schluss",
    ],
    "neutral/sachlich (Leserbrief)", FORUM_EXPLANATION),
];

const writing: SeedBankPart = { stimuli: [], items: writingItems };

// ================================================================ SPEAKING

const TALK = { thinkSeconds: 180, answerSeconds: 300, maxTakes: 1 };
const DEBATE = { thinkSeconds: 60, answerSeconds: 180, maxTakes: 1 };
const DISCUSSION = { thinkSeconds: 60, answerSeconds: 150, maxTakes: 1 };
const SHORT = { thinkSeconds: 60, answerSeconds: 120, maxTakes: 2 };

function speakingTask(
  skill: string,
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

const TALK_EXPLANATION =
  "Vortrag mit Struktur (Einleitung, Beschreibung, Argumentation, Schluss). Bewertung: Erfüllung, Kohärenz, Wortschatz, Strukturen, Aussprache.";
const DISCUSSION_EXPLANATION =
  "Diskussionsbeitrag als Reaktion auf eine Gegenposition. Bewertung: Erfüllung, Interaktion (auf das Argument eingehen), Wortschatz, Strukturen, Aussprache.";

const speakingItems: SeedItem[] = [
  speakingTask("presentation", "MID", TALK,
    "Halten Sie einen kurzen Vortrag (3 bis 4 Minuten) zum Thema „Lebenslanges Lernen: Muss man im Beruf ständig dazulernen?“\n\n" +
      "- Stellen Sie das Thema vor und erklären Sie, worum es geht.\n" +
      "- Berichten Sie von Ihren eigenen Erfahrungen mit Lernen oder Weiterbildung.\n" +
      "- Nennen Sie Vor- und Nachteile und geben Sie Beispiele.\n" +
      "- Sagen Sie Ihre Meinung und kommen Sie zu einem Schluss.",
    [
      "Einleitung: Thema genannt und kurz erklärt",
      "eigene Erfahrung mit Lernen oder Weiterbildung",
      "Vor- und Nachteile mit Beispielen",
      "begründete Meinung und klarer Schluss",
    ],
    [
      "das Thema vorstellen und erklären",
      "eigene Erfahrungen mit Lernen oder Weiterbildung",
      "Vor- und Nachteile mit Beispielen",
      "Ihre Meinung und ein Schluss",
    ],
    undefined, TALK_EXPLANATION),
  speakingTask("presentation", "HARD", TALK,
    "Halten Sie einen kurzen Vortrag (3 bis 4 Minuten) zum Thema „Mehrmals im Leben den Beruf wechseln: Chance oder Risiko?“\n\n" +
      "- Stellen Sie das Thema vor.\n" +
      "- Beschreiben Sie, warum Menschen heute ihren Beruf wechseln.\n" +
      "- Wägen Sie Chancen und Risiken gegeneinander ab.\n" +
      "- Sagen Sie Ihre Meinung und fassen Sie am Ende zusammen.",
    [
      "Einleitung mit Thema und Aufbau des Vortrags",
      "Gründe für einen Berufswechsel (z. B. Technik, Interessen, Arbeitsmarkt)",
      "Chancen und Risiken gegeneinander abgewogen",
      "eigene Position und Zusammenfassung",
    ],
    [
      "das Thema vorstellen",
      "warum Menschen heute den Beruf wechseln",
      "Chancen und Risiken abwägen",
      "Ihre Meinung und eine Zusammenfassung",
    ],
    undefined, TALK_EXPLANATION),
  speakingTask("discussion", "MID", DISCUSSION,
    "Ein Kollege sagt in einer Diskussion: „Großraumbüros sind modern und fördern die Zusammenarbeit. Einzelbüros sind nicht mehr zeitgemäß.“\n\n" +
      "Reagieren Sie auf diese Aussage. Sagen Sie, ob Sie zustimmen, begründen Sie Ihre Position mit Argumenten und Beispielen, gehen Sie auf sein Argument ein und machen Sie einen Kompromissvorschlag.",
    [
      "klare Reaktion auf die Aussage (Zustimmung, Widerspruch oder teilweise)",
      "mindestens zwei Argumente mit Beispiel",
      "Eingehen auf das Argument der Zusammenarbeit",
      "Kompromissvorschlag (z. B. Ruhezonen, Mischformen)",
    ],
    [
      "ob Sie zustimmen",
      "Argumente und Beispiele",
      "auf das Argument des Kollegen eingehen",
      "ein Kompromissvorschlag",
    ],
    undefined, DISCUSSION_EXPLANATION),
  speakingTask("discussion", "HARD", DISCUSSION,
    "Eine Gesprächspartnerin sagt: „Bei der Auswahl neuer Mitarbeiter sollten Unternehmen mehr auf die Persönlichkeit achten als auf Zeugnisse und Abschlüsse.“\n\n" +
      "Nehmen Sie Stellung. Begründen Sie Ihre Meinung, nennen Sie ein Gegenargument und entkräften oder relativieren Sie es, und fassen Sie Ihre Position am Ende zusammen.",
    [
      "eigene Position klar formuliert",
      "Begründung mit Argumenten und Beispiel",
      "Gegenargument genannt und darauf reagiert",
      "Zusammenfassung der Position",
    ],
    [
      "Ihre Meinung mit Begründung",
      "ein Gegenargument nennen und darauf reagieren",
      "Ihre Position am Ende zusammenfassen",
    ],
    undefined, DISCUSSION_EXPLANATION),
  speakingTask("description", "EASY", SHORT,
    "Erzählen Sie von einer schwierigen Situation in Ihrem Berufs-, Studien- oder Schulalltag. Was ist passiert? Wie haben Sie reagiert? Was war das Ergebnis, und was haben Sie daraus gelernt?",
    [
      "Situation verständlich beschrieben",
      "eigene Reaktion und Vorgehen",
      "Ergebnis der Situation",
      "Lehre oder Rückblick (z. B. was man heute anders machen würde)",
    ],
    [
      "was passiert ist",
      "wie Sie reagiert haben",
      "was das Ergebnis war",
      "was Sie daraus gelernt haben",
    ],
    undefined,
    "Zusammenhängende Erzählung in der Vergangenheit; erwartet werden Zeitformen (Perfekt, Präteritum), Konnektoren und ggf. Konjunktiv II (\"würde heute anders ...\")."),
  speakingTask("message", "MID", SHORT,
    "Ihnen ist im Team ein Problem im Arbeitsablauf aufgefallen (zum Beispiel doppelte Arbeit oder lange Wartezeiten). Hinterlassen Sie Ihrer Teamleiterin, Frau Rossi, eine Sprachnachricht.\n\n" +
      "- Beschreiben Sie das Problem.\n" +
      "- Schlagen Sie eine Lösung vor.\n" +
      "- Erklären Sie, welche Vorteile Ihre Lösung hätte.\n" +
      "- Bitten Sie um einen Gesprächstermin.",
    [
      "Problem konkret beschrieben",
      "realistischer Lösungsvorschlag",
      "Vorteile der Lösung begründet",
      "höfliche Bitte um einen Termin, passende Begrüßung und Verabschiedung",
    ],
    [
      "das Problem beschreiben",
      "eine Lösung vorschlagen",
      "die Vorteile Ihrer Lösung erklären",
      "um einen Gesprächstermin bitten",
      "Begrüßung und Verabschiedung",
    ],
    FORMAL,
    "Höfliche, formelle Sprachnachricht an eine Vorgesetzte. Bewertung: Erfüllung, Kohärenz, Register (Sie, Konjunktiv II), Wortschatz, Strukturen, Aussprache."),
  speakingTask("debate", "HARD", DEBATE,
    "Rollengespräch. Die Stadt plant, die Innenstadt für private Autos zu sperren. Sie nehmen an einer Diskussion teil und vertreten die Position DAFÜR. Ihr Gesprächspartner sagt: „Die Geschäfte verlieren ihre Kundschaft, Lieferungen werden teurer, und wer vom Land kommt, fährt künftig lieber gleich in die Stadt nebenan.“\n\n" +
      "Bleiben Sie in Ihrer Rolle. Gehen Sie auf alle drei Einwände ein und bringen Sie mindestens zwei neue Argumente, die Ihr Gesprächspartner noch nicht genannt hat. Nennen Sie ein Beispiel aus einer Stadt, die Sie kennen, und machen Sie am Ende einen Kompromissvorschlag.",
    [
      "Rolle (dafür) klar eingehalten",
      "auf die drei Einwände eingegangen",
      "mindestens zwei neue Argumente mit Begründung",
      "Beispiel aus einer bekannten Stadt",
      "Kompromissvorschlag am Ende",
    ],
    [
      "Ihre Position vertreten",
      "auf alle drei Einwände reagieren",
      "neue Argumente nennen",
      "ein Beispiel aus einer Stadt, die Sie kennen",
      "einen Kompromiss vorschlagen",
    ],
    undefined,
    "Rollengebundene Diskussion (ÖSD-Muster Sprechen 3): Die Rolle ist vorgegeben, bewertet wird auch, ob neue Argumente statt bloßer Wiederholung kommen. Bewertung: Erfüllung, Interaktion, Wortschatz, Strukturen, Aussprache."),
];

// ---------------------------------------------------------------- Picture tasks (describe, interpret, give an opinion)

const PICTURE = { thinkSeconds: 60, answerSeconds: 150, maxTakes: 2 };
const PICTURE_EXPLANATION =
  "Bildbeschreibung mit Deutung und Meinung. Bewertung: Erfüllung (beschreiben, deuten, Stellung nehmen), Kohärenz, Wortschatz, Strukturen, Aussprache. Die Bewertung stützt sich auf die Bildbeschreibung in den Inhaltspunkten.";

function pictureTask(
  within: Within,
  imageId: string,
  prompt: string,
  contentPoints: string[],
  studentPoints: string[],
): SeedItem {
  return {
    section: "SPEAKING",
    level: LEVEL,
    type: "SPEAKING_PROMPT",
    skillTag: "speaking.picture",
    within,
    prompt,
    content: { kind: "SPEAKING", ...PICTURE, images: [img(imageId)] },
    key: { kind: "NONE" },
    rubric: { contentPoints, studentPoints },
    explanation: PICTURE_EXPLANATION,
  };
}

const pictureItems: SeedItem[] = [
  pictureTask("MID", "scene.b2.car-sharing",
    "Sehen Sie sich das Bild an und sprechen Sie etwa zwei Minuten.\n\n" +
      "- Beschreiben Sie, was Sie auf dem Bild sehen.\n" +
      "- Erklären Sie, wofür das Bild stehen könnte.\n" +
      "- Nennen Sie Vor- und Nachteile von Elektroautos.\n" +
      "- Wie ist die Situation in Ihrer Stadt oder Region, und was ist Ihre Meinung dazu?",
    [
      "Beschreibung: ein Elektroauto wird an einer Ladesäule aufgeladen",
      "Deutung: Wandel in der Mobilität, Klimaschutz, Alternative zum Verbrennungsmotor",
      "Vorteile (z. B. weniger Abgase, leise) und Nachteile (z. B. Ladezeit, Reichweite, Preis)",
      "Situation in der eigenen Stadt oder Region (Ladestationen, Nutzung von Elektroautos)",
      "eigene, begründete Meinung",
    ],
    [
      "beschreiben, was auf dem Bild zu sehen ist",
      "erklären, wofür das Bild stehen könnte",
      "Vor- und Nachteile nennen",
      "die Situation in Ihrer Stadt oder Region",
      "Ihre Meinung mit Begründung",
    ]),
  pictureTask("MID", "scene.b2.crowded-tram",
    "Sehen Sie sich das Bild an und sprechen Sie etwa zwei Minuten.\n\n" +
      "- Beschreiben Sie die Situation auf dem Bild.\n" +
      "- Was könnte der Grund dafür sein, dass der Bus so voll ist?\n" +
      "- Welche Folgen hat das für die Fahrgäste?\n" +
      "- Was sollte sich Ihrer Meinung nach im öffentlichen Nahverkehr ändern? Wie ist es in Ihrer Stadt oder Region?",
    [
      "Beschreibung: Fahrgäste stehen dicht gedrängt in einem vollen Bus",
      "mögliche Gründe (z. B. Berufsverkehr, zu wenige Fahrzeuge, seltene Verbindungen)",
      "Folgen für die Fahrgäste (z. B. Stress, Verspätung, kein Sitzplatz, Ansteckungsgefahr)",
      "eigener Vorschlag für Verbesserungen (z. B. dichtere Takte, mehr Busse, günstigere Tickets)",
      "Vergleich mit der Situation in der eigenen Stadt oder Region",
    ],
    [
      "die Situation beschreiben",
      "mögliche Gründe für den vollen Bus nennen",
      "Folgen für die Fahrgäste erklären",
      "Verbesserungen vorschlagen",
      "die Situation in Ihrer Stadt oder Region",
    ]),
  pictureTask("HARD", "scene.b2.senior-with-tablet",
    "Sehen Sie sich das Bild an und sprechen Sie etwa zwei Minuten.\n\n" +
      "- Beschreiben Sie, was Sie sehen.\n" +
      "- Was kann ein Tablet oder Smartphone im Alltag für Menschen bedeuten, die nicht mit digitalen Geräten aufgewachsen sind?\n" +
      "- Welche Chancen und welche Probleme sehen Sie dabei?\n" +
      "- Wer sollte helfen, damit alle digitale Angebote nutzen können? Nehmen Sie Stellung.",
    [
      "Beschreibung: ein älterer Mann sitzt auf dem Sofa und benutzt ein Tablet",
      "Deutung: Technik im Alltag, Kontakt zur Familie, Information, Unterhaltung",
      "Chancen (z. B. Verbindung mit anderen, Selbstständigkeit) und Probleme (z. B. Überforderung, Betrug, fehlende Hilfe)",
      "Vorschlag, wer unterstützen sollte (Familie, Kurse, Bibliotheken, Stadt)",
      "begründete eigene Stellungnahme, ggf. Beispiel aus der Stadt oder Region",
    ],
    [
      "beschreiben, was auf dem Bild zu sehen ist",
      "was digitale Geräte im Alltag bedeuten können",
      "Chancen und Probleme abwägen",
      "wer helfen sollte",
      "Ihre Stellungnahme mit Begründung",
    ]),
  pictureTask("EASY", "scene.b2.waste-sorting",
    "Sehen Sie sich das Bild an und sprechen Sie etwa zwei Minuten.\n\n" +
      "- Beschreiben Sie, was auf dem Bild zu sehen ist.\n" +
      "- Wofür ist diese Einrichtung gedacht, und wie funktioniert sie?\n" +
      "- Warum ist Mülltrennung sinnvoll, und wo gibt es Schwierigkeiten?\n" +
      "- Wie wird in Ihrer Stadt oder Region mit Müll umgegangen, und was ist Ihre Meinung dazu?",
    [
      "Beschreibung: vier bunte Mülltonnen stehen nebeneinander zur Mülltrennung",
      "Erklärung: verschiedene Tonnen für verschiedene Abfälle (z. B. Papier, Glas, Verpackungen, Restmüll)",
      "Vorteile der Mülltrennung (Recycling, Umweltschutz) und mögliche Schwierigkeiten (z. B. Unsicherheit, falsch sortierter Müll)",
      "Situation in der eigenen Stadt oder Region",
      "eigene, begründete Meinung oder Verbesserungsvorschlag",
    ],
    [
      "beschreiben, was auf dem Bild zu sehen ist",
      "erklären, wie die Einrichtung funktioniert",
      "Vorteile und Schwierigkeiten nennen",
      "die Situation in Ihrer Stadt oder Region",
      "Ihre Meinung mit Begründung",
    ]),
];

const speaking: SeedBankPart = { stimuli: [], items: [...speakingItems, ...pictureItems] };

export const B2_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = { grammar, reading, listening, writing, speaking };
