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
  gChoice("konnektoren", "EASY",
    "Können Sie mir bitte sagen, ___ der Kurs noch freie Plätze hat?",
    ["wenn", "dass", "weil", "ob"], 3,
    "Indirekte Ja/Nein-Frage: „ob“. „dass“ leitet einen Aussagesatz ein, „wenn“ und „weil“ nennen Bedingung bzw. Grund und ergeben nach „sagen“ keine Frage."),
  gChoice("funktionsverbgefuege", "EASY",
    "Bitte setzen Sie mich rechtzeitig in ___, falls sich der Termin ändert.",
    ["Kenntnis", "Wissen", "Erfahrung", "Gewissheit"], 0,
    "Feste Verbindung: jemanden von etwas in Kenntnis setzen (= informieren). Mit den anderen Nomen gibt es das Funktionsverbgefüge nicht (vgl. „in Erfahrung bringen“)."),
  gChoice("konnektoren", "EASY",
    "Das Angebot ist ___ günstig, aber die Lieferung dauert drei Wochen.",
    ["sowohl", "zwar", "weder", "entweder"], 1,
    "„zwar ... aber“ drückt einen Gegensatz aus. „sowohl ... als auch“, „weder ... noch“ und „entweder ... oder“ haben andere Partner; mit „aber“ ergeben sie keinen Satz."),
  gChoice("genitivpraepositionen", "EASY",
    "Die Abschiedsfeier findet bei gutem Wetter ___ des Gebäudes im Garten statt.",
    ["innerhalb", "oberhalb", "außerhalb", "unterhalb"], 2,
    "Der Garten liegt außerhalb des Gebäudes: „außerhalb“ + Genitiv. „innerhalb“ widerspricht „im Garten“, „oberhalb“ und „unterhalb“ beschreiben eine Lage über bzw. unter dem Gebäude."),
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
  // Wrong parts by the gap whose stem they target.
  distractors: {
    1: ["licht"], 2: ["ir"], 3: ["m"], 4: ["um"],
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
      "Viele dieser Lebensmittel [[werden|wird|worden|geworden]] schon in privaten Haushalten weggeworfen. " +
      "Manche Menschen kaufen mehr ein, [[als|wie|ob|dass]] sie wirklich brauchen. " +
      "Außerdem verwechseln viele das Mindesthaltbarkeitsdatum [[mit|von|zu|für]] dem Verbrauchsdatum. " +
      "Dabei sind die meisten Produkte auch nach [[dem|den|der|des]] angegebenen Datum noch in Ordnung. " +
      "Um das Problem zu verringern, [[haben|sind|wurden|werden]] einige Bäckereien eine einfache Idee entwickelt: " +
      "Sie verkaufen Brot vom Vortag [[zu|für|um|auf]] einem deutlich niedrigeren Preis. " +
      "Kunden, [[denen|die|deren|dessen]] es auf jeden Euro ankommt, sparen so Geld, und weniger Brot landet im Müll, [[was|wer|wo|dass]] auch der Umwelt hilft. " +
      "Auch in Restaurants [[gibt|ist|hat|wird]] es noch viel Spielraum. " +
      "Viele Gäste trauen sich nicht, nach einer Box [[für|zu|an|mit]] ihre Reste zu fragen. " +
      "[[Statt|Um|Außer|Bis]] das Essen auf dem Teller zu lassen, sollten sie ruhig fragen.",
    last: "Die meisten Restaurants geben ihren Gästen die Reste nämlich gern mit.",
    note: "Passiv im Präsens (g1), Vergleich mit als (g2), verwechseln mit (g3), nach + Dativ (g4), Perfekt mit haben (g5), zu einem Preis (g6), Relativpronomen im Dativ bei es kommt jemandem auf etwas an (g7), weiterführender Relativsatz mit was (g8), es gibt (g9), Box für + Akkusativ (g10), statt ... zu + Infinitiv (g11).",
  }),
  cloze(LEVEL, "MID", {
    title: "Ein Museum erfindet sich neu",
    first: "Das Stadtmuseum einer Kleinstadt am Rhein hatte lange mit sinkenden Besucherzahlen zu kämpfen.",
    body:
      "Vor zwei Jahren [[wurde|wird|würde|hat]] deshalb ein neues Konzept entwickelt. " +
      "Die seit Jahrzehnten kaum [[veränderte|verändernde|veränderten|verändert]] Ausstellung wurde komplett neu gestaltet, und das Museum blieb dafür ein Jahr lang geschlossen. " +
      "Heute dürfen Besucher viele Objekte selbst [[anfassen|angefasst|anzufassen|anfasst]] und ausprobieren. " +
      "Außerdem gibt es nun ein Café, [[in|an|auf|über]] dem regelmäßig Lesungen und Konzerte stattfinden. " +
      "Besonders beliebt sind die Führungen für Familien, bei [[denen|die|deren|dem]] Kinder in historische Kostüme schlüpfen dürfen. " +
      "[[Trotz|Wegen|Dank|Durch]] der hohen Kosten für den Umbau sind die Eintrittspreise kaum gestiegen. " +
      "Das liegt vor allem [[daran|darauf|dafür|davon]], dass die Stadt einen großen Teil der Kosten übernommen hat. " +
      "Seit der Wiedereröffnung kommen dreimal so viele Besucher [[wie|als|denn|wenn]] vorher. " +
      "Die Museumsleiterin freut sich [[über|auf|an|von]] diesen Erfolg und ist überzeugt, dass sich der Aufwand [[gelohnt|lohnte|lohnt|lohnen]] hat.",
    last: "Inzwischen interessieren sich auch andere Museen der Region für das Konzept.",
    note: "Passiv im Präteritum (g1), Partizipialattribut (g2), Modalverb + Infinitiv (g3), Relativsatz mit Präposition (g4), Präposition + Relativpronomen im Dativ Plural (g5), trotz + Genitiv (g6), liegen an mit Präpositionaladverb (g7), so viele ... wie (g8), sich freuen über (g9), Partizip II im Perfekt (g10).",
  }),
  cloze(LEVEL, "HARD", {
    title: "Die Rückkehr der Nachtzüge",
    first: "Lange Zeit galten Nachtzüge in Europa als altmodisch und unwirtschaftlich.",
    body:
      "[[Nachdem|Bevor|Obwohl|Solange]] viele Verbindungen in den vergangenen Jahrzehnten eingestellt worden waren, schien das Ende dieser Reiseform gekommen. " +
      "Doch seit einigen Jahren ist die Nachfrage wieder deutlich [[gestiegen|gestiegene|stieg|steigen]]. " +
      "Immer mehr Reisende verzichten bewusst [[auf|für|an|von]] Kurzstreckenflüge und wählen stattdessen die Bahn. " +
      "[[Je|Desto|Umso|Mehr]] länger die Strecke ist, desto attraktiver wird der Nachtzug im Vergleich zum Flugzeug. " +
      "Die Betreiber stehen allerdings [[vor|von|bei|aus]] großen Herausforderungen. " +
      "Viele der eingesetzten Waggons sind mehrere Jahrzehnte alt und müssen dringend [[ersetzt|ersetzen|ersetzten|ersetze]] werden. " +
      "Neue Schlafwagen sind jedoch so teuer, [[dass|damit|ob|wenn]] sich viele Unternehmen eine Bestellung gut überlegen. " +
      "Hinzu kommen hohe Gebühren für die Nutzung der Schienen, [[die|denen|deren|das]] in jedem Land anders ausfallen. " +
      "Fachleute fordern daher eine stärkere [[Förderung|Fördern|Förderer|fördernde]] durch den Staat. " +
      "Ob sich das Angebot langfristig [[durchsetzt|durchsetzen|durchgesetzt|durchzusetzen]], hängt also nicht zuletzt [[von|an|auf|für]] politischen Entscheidungen ab.",
    last: "Für viele Reisende ist die Nacht im Zug jedenfalls schon heute eine echte Alternative.",
    note: "nachdem mit Plusquamperfekt Passiv (g1), Perfekt mit sein (g2), verzichten auf (g3), je ... desto (g4), stehen vor (g5), Passiv mit Modalverb (g6), so ... dass (g7), Relativpronomen im Nominativ Plural (g8), Nominalisierung (g9), ob-Satz mit trennbarem Verb (g10), abhängen von (g11).",
  }),
  wordBank(LEVEL, "EASY", {
    title: "Das Repair-Café",
    first: "In vielen Städten gibt es inzwischen Repair-Cafés, in denen Freiwillige kaputte Geräte gemeinsam mit ihren Besitzern reparieren.",
    body:
      "Die Idee ist einfach: Man bringt einen defekten Toaster vorbei, [[anstatt]] ihn wegzuwerfen. " +
      "Häufig ist nur ein kleines [[Bauteil]] beschädigt, das sich problemlos austauschen lässt. " +
      "Die Freiwilligen haben viel [[Erfahrung]], weil viele von ihnen früher in einem Handwerk gearbeitet haben. " +
      "Die Hilfe selbst ist [[kostenlos]], man zahlt nur [[für]] die Materialien. " +
      "Viele Besucher [[genießen]] außerdem die Gelegenheit, mit Menschen aus der Nachbarschaft ins Gespräch zu kommen. " +
      "Für die Umwelt ist das Prinzip ein großer [[Gewinn]], [[denn]] jedes reparierte Gerät bedeutet weniger Müll. " +
      "Kritiker bemängeln allerdings, dass viele moderne Geräte kaum zu öffnen sind. " +
      "Sie fordern deshalb strengere Vorschriften für die Hersteller.",
    last: "Bis es so weit ist, bleibt das Repair-Café für viele eine gute Alternative zum Neukauf.",
    distractors: ["durch", "vermeiden", "obwohl", "Zeit", "teuer"],
  }),
  wordBank(LEVEL, "MID", {
    title: "Ein Garten für alle",
    first: "Auf einer ehemaligen Brachfläche mitten in Hannover ist vor drei Jahren ein Gemeinschaftsgarten entstanden.",
    body:
      "Rund vierzig Anwohnerinnen und Anwohner [[bewirtschaften]] die Beete gemeinsam und teilen sich die Ernte. " +
      "Wer mitmachen möchte, braucht kein [[Vorwissen]], [[da]] erfahrene Mitglieder den Neuen alles zeigen. " +
      "Die Aufgaben werden in einem Plan [[festgelegt]], damit jeder weiß, wann er mit dem Gießen an der Reihe ist. " +
      "Viele berichten, dass ihnen die Gartenarbeit nach einem [[stressigen]] Arbeitstag hilft abzuschalten. " +
      "Die Stadt [[unterstützt]] das Projekt, indem sie das Grundstück kostenlos zur Verfügung stellt. " +
      "[[Dank]] dieser Hilfe bleiben die Beiträge für die Mitglieder niedrig. " +
      "Allerdings ist der Vertrag mit der Stadt zunächst auf fünf Jahre befristet, und die Mitglieder hoffen [[darauf]], dass er verlängert wird.",
    last: "Ein Sommerfest soll zeigen, wie wichtig der Garten inzwischen für das ganze Viertel geworden ist.",
    distractors: ["obwohl", "vergessen", "mühelosen", "verhindert", "Trotz"],
  }),
  wordBank(LEVEL, "HARD", {
    title: "Lärm in der Stadt",
    first: "Verkehrslärm gehört in deutschen Großstädten zu den häufigsten Gründen für Beschwerden von Anwohnern.",
    body:
      "Dauerhafter Lärm ist [[keineswegs]] nur lästig, sondern kann auch der Gesundheit erheblich schaden. " +
      "Studien [[zufolge]] erhöht er unter anderem das Risiko für Bluthochdruck und Schlafstörungen. " +
      "Viele Städte haben deshalb Maßnahmen ergriffen, [[um]] die Belastung zu verringern. " +
      "Auf zahlreichen Hauptstraßen wurde die zulässige [[Geschwindigkeit]] nachts auf 30 km/h begrenzt. " +
      "Außerdem wird an besonders belasteten Stellen ein spezieller Asphalt [[verlegt]], der deutlich leiser ist. " +
      "Kritiker [[bezweifeln]] jedoch, dass solche Schritte ausreichen. " +
      "Sie verweisen darauf, dass der Lärm erst dann spürbar [[abnimmt]], wenn insgesamt weniger Autos unterwegs sind. " +
      "Eine dauerhafte [[Lösung]] sehen sie daher vor allem im Ausbau von Bus, Bahn und Radwegen.",
    last: "Ob sich diese Forderung politisch durchsetzen lässt, wird sich in den kommenden Jahren zeigen.",
    distractors: ["gelegentlich", "damit", "Lautstärke", "entfernt", "befürchten"],
  }),
];

const grammar: SeedBankPart = {
  stimuli: [],
  items: [grammarCTest, grammarCTest2, grammarCTest3, ...grammarItems, ...grammarTexts],
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
      "Weil manche Beschäftigte am Anfang Mühe hatten, die neue Lern-App zu bedienen und zu nutzen.",
    ], 3,
    "Einige Beschäftigte hatten anfangs Schwierigkeiten mit der Technik, „deshalb“ gibt es Sprechstunden. Die Forderung der Gewerkschaften steht an anderer Stelle; Teilnahmequote und Kosten haben sich laut Text positiv entwickelt."),
  r2.choice("inference", "HARD",
    "Wozu dient der Hinweis auf mehr als zwanzig Stunden im Jahr am Ende des Textes?",
    [
      "Er belegt, dass tägliches Lernen mit der App für einen sicheren Lernerfolg ausreicht.",
      "Er zeigt, dass auch kurze Einheiten viel Zeit ergeben und deren Anerkennung wichtig ist.",
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
      "Die Beschäftigten fangen und hören zu sehr unterschiedlichen Zeiten mit der Arbeit auf.",
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
      ["Die meisten Unternehmen reservieren Parkplätze für Fahrgemeinschaften.", "F"],
    ],
    "1: „Beschäftigte mehrerer Firmen“. 2: „die Gespräche ... als angenehm zu empfinden“. 3: Taxi-Heimfahrt. 4: Nur „manche Unternehmen“ reservieren Parkplätze."),
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

const reading: SeedBankPart = {
  stimuli: [rViertage, rMicrolearning, rPendeln, rCoworking, rWohnungen, rBibliothek, rRadtour],
  items: [
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
  speakers: Array<{ label: string; voice: "A" | "B" }>,
  lines: string[],
): SeedStimulus {
  return { key: `v2-l-b2-${slug}`, section: "LISTENING", level: LEVEL, title, topic, speakers, body: lines.join("\n") };
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
    "Moderatorin: Willkommen zu unserer Sendung. Heute geht es um Pausen. Mein Gast ist der Arbeitspsychologe Jonas Brandt. Guten Tag, Herr Brandt.",
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
    "1: Die Mittagspause soll mindestens dreißig Minuten dauern. 2: Genannt werden Aufstehen, Gehen, Fensterblick und Ortswechsel in Küche oder Flur, ein Vergleich Freiluft und Innenraum fehlt. 3: Pausen wie Termine in den Kalender eintragen. 4: Wo die Studie lief, sagt er nicht."),
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
    "Referentin: Was kann man nun tun? Erstens: große Aufgaben in sehr kleine Schritte zerlegen. Statt den ganzen Bericht schreiben lieber nur die Gliederung erstellen. Zweitens die Zwei-Minuten-Regel: Dauert eine Aufgabe weniger als zwei Minuten, erledigt man sie sofort. Und drittens: Ablenkungen verringern. Das Handy zum Beispiel in einen anderen Raum legen.",
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
    "Tarek: Donnerstag passt mir gut. Nachmittags habe ich zwar einen Arzttermin, aber um zehn sind wir ja längst fertig.",
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
      "Die Kundin hat am geplanten Tag einen anderen beruflichen Termin außerhalb der Stadt.",
      "Tarek hat am geplanten Tag einen Arzttermin und kann deshalb nicht teilnehmen.",
      "Die Kundin ist am geplanten Tag krank und möchte niemanden ansteckend treffen.",
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
      "Der Zahnarzt kann den vereinbarten Tag wegen einer Weiterbildung nicht einhalten.",
      "Die Praxis muss den Termin verschieben, weil ein Behandlungsgerät defekt ist.",
    ], 2,
    "Doktor Merz ist am Dienstag auf einer Fortbildung („Weiterbildung“), deshalb wird der Termin verschoben. Von einem Computerfehler, Bauarbeiten oder einem defekten Gerät ist keine Rede."),
  l4.notes("EASY",
    "Sie hören eine Nachricht auf dem Anrufbeantworter. Notieren Sie die Angaben.\n\nNeuer Termin: {{g1}}, {{g2}} Uhr\nRückruf unter der Nummer: {{g3}}",
    {
      g1: ["Donnerstag", "Do"],
      g2: ["14:30", "14.30", "14 30", "14:30 Uhr", "14.30 Uhr", "14 Uhr 30", "halb drei", "halb 3", "vierzehn Uhr dreißig", "vierzehn dreißig"],
      g3: ["0411 558732", "0411558732", "0411 558 732", "0411/558732", "0411-558732", "0411 55 87 32", "0411/558 732", "null vier eins eins fünf fünf acht sieben drei zwei"],
    },
    "Die Sprecherin korrigiert sich beim Tag: nicht Mittwoch, sondern Donnerstag. Uhrzeit: vierzehn Uhr dreißig, also halb drei (14:30). Telefonnummer: 0411 und dann 558732, zur Kontrolle wiederholt."),
];

// ---------------------------------------------------------------- Clip 5: station announcement

const lDurchsage = clip(
  "bahn-durchsage",
  "Durchsage am Bahnhof",
  "Reisen: Zugausfall und Ersatzverkehr",
  [{ label: "Durchsage", voice: "A" }],
  [
    "Durchsage: Achtung auf Gleis vier! Der Regionalexpress nach Hannover, planmäßige Abfahrt vierzehn Uhr zwölf, fällt heute aus. Grund ist ein technischer Defekt am Zug.",
    "Durchsage: Reisende nach Hannover nutzen bitte den Intercity auf Gleis sieben. Der Zug fährt um vierzehn Uhr zweiunddreißig, nicht um vierzehn Uhr zwölf. Ihre Fahrkarte gilt ohne Aufpreis. Ich wiederhole: Intercity nach Hannover, Gleis sieben, vierzehn Uhr zweiunddreißig.",
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
  l5.choice("detail", "HARD",
    "Wann und von welchem Gleis fährt der Zug, den die Reisenden nach Hannover nehmen sollen?",
    ["Gleis sieben, 14.32 Uhr", "Gleis vier, 14.12 Uhr", "Gleis sieben, 14.15 Uhr", "Gleis vier, 14.32 Uhr"], 0,
    "Gleis sieben, Abfahrt vierzehn Uhr zweiunddreißig (14.32 Uhr). 14.12 Uhr ist die ausgefallene Verbindung, 14.15 Uhr der Bus nach Celle."),
];

// ---------------------------------------------------------------- Clip 6: street interview

const lUmfrage = clip(
  "umfrage-nachrichten",
  "Straßenumfrage: Wie informieren Sie sich?",
  "Medien: Nachrichten und Podcasts",
  [
    { label: "Reporter", voice: "A" },
    { label: "Frau Berger", voice: "B" },
    { label: "Herr Sommer", voice: "A" },
  ],
  [
    "Reporter: Wir fragen heute auf dem Marktplatz: Wie informieren Sie sich über das Tagesgeschehen? Entschuldigung, haben Sie kurz Zeit?",
    "Frau Berger: Ja, gern.",
    "Reporter: Zeitung, Fernsehen, Podcasts?",
    "Frau Berger: Hauptsächlich Podcasts. Morgens auf dem Rad höre ich zwanzig Minuten Nachrichten, abends noch mal. Zeitung lese ich kaum noch, höchstens am Wochenende. Und Fernsehen? Nein, eigentlich gar nicht.",
    "Reporter: Warum Podcasts?",
    "Frau Berger: Weil ich dabei etwas anderes machen kann. Beim Zeitunglesen muss ich still sitzen, und das schaffe ich nicht.",
    "Reporter: Und bei Ihnen?",
    "Herr Sommer: Ich bin da altmodisch. Ich lese jeden Morgen die gedruckte Zeitung, mit Kaffee, dreißig Minuten, das ist mein Ritual. Nein, warten Sie, eher vierzig Minuten. Podcasts habe ich mal probiert, aber ich schweife zu leicht ab. Wenn jemand redet und ich nebenbei koche, habe ich nach fünf Minuten nicht mehr zugehört.",
    "Reporter: Und Nachrichten im Internet?",
    "Herr Sommer: Da bin ich skeptisch. Man weiß nie, wer dahintersteckt. Bei meiner Zeitung weiß ich, wer schreibt.",
    "Reporter: Vielen Dank Ihnen beiden.",
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
    "Wie viel Zeit nimmt sich Herr Sommer morgens für die Zeitung?",
    ["etwa dreißig Minuten", "etwa zwanzig Minuten", "etwa vierzig Minuten", "etwa sechzig Minuten"], 2,
    "Er nennt zuerst dreißig Minuten und korrigiert sich: „eher vierzig Minuten“. Zwanzig Minuten hört Frau Berger Nachrichten."),
];

const listening: SeedBankPart = {
  stimuli: [lPausen, lAufschieben, lTermin, lZahnarzt, lDurchsage, lUmfrage],
  items: [...lPausenItems, ...lAufschiebenItems, ...lTerminItems, ...lZahnarztItems, ...lDurchsageItems, ...lUmfrageItems],
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
    "Ein Unternehmen überlegt, nach Feierabend keine dienstlichen E-Mails mehr auf die Diensthandys der Beschäftigten weiterzuleiten. In einem Forum wird gefragt: „Ist das eine gute Idee?“\n\n" +
      "Schreiben Sie einen Forumsbeitrag (ca. 150 Wörter). Gehen Sie auf die folgenden Punkte ein:\n" +
      "- Warum sind viele Beschäftigte auch nach Feierabend erreichbar?\n" +
      "- Welche Folgen kann das für das Privatleben haben?\n" +
      "- Welche Nachteile könnte eine solche Regel haben?\n" +
      "- Wie sollte eine gute Regelung Ihrer Meinung nach aussehen?\n\n" +
      "Schreiben Sie eine passende Einleitung und einen Schluss.",
    [
      "Gründe für ständige Erreichbarkeit",
      "Folgen für Privatleben und Erholung",
      "mögliche Nachteile der E-Mail-Sperre (z. B. Notfälle, Zeitzonen, weniger Flexibilität)",
      "eigener Vorschlag für eine Regelung mit Begründung",
    ],
    [
      "warum viele nach Feierabend erreichbar sind",
      "Folgen für das Privatleben",
      "Nachteile einer solchen Regel",
      "Ihr Vorschlag für eine gute Regelung",
      "Einleitung und Schluss",
    ],
    FORUM, FORUM_EXPLANATION),
  writingTask("semiformal", "EASY", MESSAGE_WORDS,
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
  writingTask("semiformal", "MID", MESSAGE_WORDS,
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
      "Anzeige: „Seehotel Weserblick: Wellness-Wochenende für 189 Euro pro Person. Zwei Nächte im Doppelzimmer mit Seeblick, reichhaltiges Frühstücksbuffet bis 11 Uhr, freier Eintritt in die Saunalandschaft. Garantiert ruhige Lage!“\n\n" +
      "Ihre Notizen:\n" +
      "- Zimmer zur Straße, kein Seeblick\n" +
      "- ab 7 Uhr Baulärm vor dem Haus\n" +
      "- Frühstücksbuffet um 10 Uhr fast leer\n" +
      "- Sauna wegen Reparatur geschlossen\n\n" +
      "Beschreiben Sie, was nicht in Ordnung war, und sagen Sie, was Sie vom Hotel erwarten.",
    [
      "Bezug auf die Anzeige und das gebuchte Angebot",
      "alle vier Mängel sachlich beschrieben (Zimmer, Lärm, Frühstück, Sauna)",
      "klare, höfliche Forderung (z. B. teilweise Erstattung, Gutschein) mit Begründung",
      "formelle Anrede und Gruß, ruhiger Ton ohne Beleidigungen",
    ],
    [
      "sich auf die Anzeige beziehen",
      "die Mängel beschreiben",
      "eine Lösung verlangen",
      "Anrede und Gruß",
    ],
    FORMAL,
    "Beschwerde auf der Grundlage einer Anzeige und von Randnotizen (ÖSD-Muster Schreiben 1). Bewertung: Erfüllung (alle Notizen aufgegriffen), Kohärenz, Wortschatz, Strukturen; Anrede und Gruß sind Pflicht."),
  writingTask("opinion", "MID", FORUM_WORDS,
    "In einer Zeitschrift lesen Sie die Überschrift: „Immer mehr Menschen verzichten auf ein eigenes Auto.“ Schreiben Sie dazu einen Leserbrief (ca. 150 Wörter). Gehen Sie auf die folgenden Punkte ein:\n" +
      "- Wie finden Sie diese Entwicklung?\n" +
      "- Welche Erfahrungen haben Sie oder Ihr Umfeld mit Bus, Bahn, Fahrrad oder Carsharing?\n" +
      "- Wie ist die Situation in Ihrem Land?\n" +
      "- Was sollte sich ändern, damit mehr Menschen auf das Auto verzichten?\n\n" +
      "Schreiben Sie eine passende Einleitung und einen Schluss.",
    [
      "eigene, begründete Meinung zur Entwicklung",
      "konkrete Erfahrung mit anderen Verkehrsmitteln",
      "Vergleich mit der Situation im eigenen Land (Verkehrsangebot, Gewohnheiten)",
      "Vorschlag, was sich ändern sollte, mit Begründung",
    ],
    [
      "Ihre Meinung zu dieser Entwicklung",
      "eigene Erfahrungen mit anderen Verkehrsmitteln",
      "die Situation in Ihrem Land",
      "ein Vorschlag, was sich ändern sollte",
      "Einleitung und Schluss",
    ],
    "neutral/sachlich (Leserbrief)", FORUM_EXPLANATION),
];

const writing: SeedBankPart = { stimuli: [], items: writingItems };

// ================================================================ SPEAKING

const TALK = { thinkSeconds: 180, answerSeconds: 240, maxTakes: 1 };
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
  speakingTask("debate", "HARD", DISCUSSION,
    "Rollengespräch. Die Stadt plant, die Innenstadt für private Autos zu sperren. Sie nehmen an einer Diskussion teil und vertreten die Position DAFÜR. Ihr Gesprächspartner sagt: „Die Geschäfte verlieren ihre Kundschaft, Lieferungen werden teurer, und wer vom Land kommt, fährt künftig lieber gleich in die Stadt nebenan.“\n\n" +
      "Bleiben Sie in Ihrer Rolle. Gehen Sie auf die Einwände ein und bringen Sie mindestens zwei neue Argumente, die Ihr Gesprächspartner noch nicht genannt hat. Nennen Sie ein Beispiel aus einer Stadt, die Sie kennen, und machen Sie am Ende einen Kompromissvorschlag.",
    [
      "Rolle (dafür) klar eingehalten",
      "auf die drei Einwände eingegangen",
      "mindestens zwei neue Argumente mit Begründung",
      "Beispiel aus einer bekannten Stadt",
      "Kompromissvorschlag am Ende",
    ],
    [
      "Ihre Position vertreten",
      "auf die Einwände reagieren",
      "neue Argumente nennen",
      "ein Beispiel aus einer Stadt, die Sie kennen",
      "einen Kompromiss vorschlagen",
    ],
    undefined,
    "Rollengebundene Diskussion (ÖSD-Muster Sprechen 3): Die Rolle ist vorgegeben, bewertet wird auch, ob neue Argumente statt bloßer Wiederholung kommen. Bewertung: Erfüllung, Interaktion, Wortschatz, Strukturen, Aussprache."),
];

const speaking: SeedBankPart = { stimuli: [], items: speakingItems };

export const B2_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = { grammar, reading, listening, writing, speaking };
