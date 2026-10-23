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
 */

/**
 * C1 starter bank (v2), written against docs/EXAM-BANK-RESEARCH.md, section C1.
 *
 * - Grammar: 24 items (8 EASY, 8 MID, 8 HARD) over the C1 inventory plus three C-tests,
 *   three MC cloze texts and three word banks (spec 2026-10-18).
 * - Reading: 8 texts. Four long ones with 4 items each (word-level cloze, dense magazine
 *   article, commentary with sentence insertion, four positions to match) and four short
 *   ones (news item, report, forum post, six course ads to match) with 1 or 2 items each.
 * - Listening: 6 clips. Three long ones with 4 items each (expert interview, lecture with
 *   two questions, discussion in two voices) and three short ones (voicemail for note
 *   taking, radio report, service call).
 * - Writing: 3 forum contributions (about 230 words), 3 semi-formal emails (about 120 words)
 *   and a letter that describes and discusses a table (about 250 words).
 * - Speaking: 3 talks from bullet points, 2 discussion turns reacting to an input text and
 *   a talk from a handout with three sources.
 *
 * Single choice items have four options at C1. `choice` takes the correct
 * option first and puts it at position `pos`, so key positions are set
 * explicitly and spread over a, b, c and d.
 */

const LEVEL = "C1" as const;
type Within = NonNullable<SeedItem["within"]>;
const IDS = ["a", "b", "c", "d"] as const;
type Pos = 0 | 1 | 2 | 3;

function placeOptions(correct: string, distractors: [string, string, string], pos: Pos) {
  const texts: string[] = [...distractors];
  texts.splice(pos, 0, correct);
  return {
    content: { kind: "CHOICE" as const, options: texts.map((text, i) => ({ id: IDS[i], text })) },
    key: { kind: "CHOICE" as const, correct: [IDS[pos]] },
  };
}

// ---------------------------------------------------------------- GRAMMAR

function gChoice(
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

/** One gap called g1. With `choices` it is a drop-down, without it the gap is typed. */
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

const INDIRECT =
  "Welche Form verlangt die Standardregel der Schriftsprache in dieser indirekten Rede?";

const grammarItems: SeedItem[] = [
  // ------------------------------------------------ EASY
  gChoice("praepositionen", "EASY",
    "___ der hohen Kosten entschied sich die Geschäftsleitung gegen den Umzug in ein neues Bürogebäude.",
    "Angesichts", ["Ungeachtet", "Mangels", "Anlässlich"], 0,
    "„Angesichts“ + Genitiv nennt den Grund (= wegen). „Ungeachtet“ (= trotz) ergibt einen Widerspruch zur Entscheidung gegen den Umzug, „mangels“ meint ein Fehlen, „anlässlich“ nennt einen Anlass oder ein Ereignis und keinen Grund für die Entscheidung."),
  gChoice("modalverben_subjektiv", "EASY",
    "Was bedeutet der Satz? „Der Konzern soll bereits einen Käufer für die Sparte gefunden haben.“",
    "Es wird berichtet, dass der Konzern schon einen Käufer gefunden hat.",
    [
      "Der Konzern ist verpflichtet, bald einen Käufer zu finden.",
      "Der Konzern selbst behauptet, schon einen Käufer gefunden zu haben.",
      "Es steht fest, dass der Konzern schon einen Käufer gefunden hat.",
    ], 1,
    "Subjektives „sollen“ + Infinitiv Perfekt gibt eine fremde Behauptung wieder (Hörensagen). Die Eigenbehauptung des Subjekts wäre „wollen“, Pflicht wäre objektives „sollen“ mit Infinitiv Präsens."),
  gChoice("nominalisierung", "EASY",
    "Welcher Satz gibt den folgenden Satz korrekt im Nominalstil wieder? „Nachdem der Vertrag unterzeichnet worden war, begannen die Bauarbeiten.“",
    "Nach Unterzeichnung des Vertrags begannen die Bauarbeiten.",
    [
      "Nach Unterzeichnung den Vertrag begannen die Bauarbeiten.",
      "Nach Unterzeichnung dem Vertrag begannen die Bauarbeiten.",
      "Nach Unterzeichnung der Vertrag begannen die Bauarbeiten.",
    ], 2,
    "Das Objekt des Verbs (den Vertrag unterzeichnen) wird bei der Nominalisierung zum Genitivattribut: die Unterzeichnung des Vertrags. Die Distraktoren behalten Akkusativ, Dativ oder Nominativ."),
  gGap("konjunktiv_i", "EASY",
    "Ergänzen Sie das fehlende Wort.\n\nDie Sprecherin erklärte, die Maßnahmen {{g1}} bereits vor Monaten beschlossen worden.",
    ["seien"], undefined,
    "Indirekte Rede im Perfekt Passiv: Konjunktiv I von „sein“ in der 3. Person Plural, „seien“ (… beschlossen worden). Er unterscheidet sich vom Indikativ „sind“ und ist deshalb die Standardform; „wären“ wäre nur eine Ersatzform, wenn Konjunktiv I und Indikativ gleich lauteten."),
  gChoice("konnektoren", "EASY",
    "Die Filiale in Köln hat ihr Umsatzziel übertroffen, ___ die Filiale in Leipzig deutlich darunter geblieben ist.",
    "wohingegen", ["zumal", "sodass", "sofern"], 3,
    "„Wohingegen“ stellt zwei Sachverhalte gegenüber (adversativ). „Zumal“ ergänzt einen Grund, „sodass“ nennt eine Folge, „sofern“ eine Bedingung; alle drei leiten ebenfalls einen Nebensatz ein, passen inhaltlich aber nicht."),
  gChoice("praepositionen", "EASY",
    "___ ausreichender Anmeldungen musste der Kurs leider abgesagt werden.",
    "Mangels", ["Mittels", "Angesichts", "Hinsichtlich"], 0,
    "„Mangels“ + Genitiv bedeutet „weil etwas fehlt“. Nur so ergibt der Satz einen Sinn: Es gab nicht genug Anmeldungen. „Mittels“ (Instrument), „angesichts“ (Grund) und „hinsichtlich“ (Bezug) sind hier unlogisch."),
  gGap("funktionsverbgefuege", "EASY",
    "Der Vorschlag der Gemeinde fand bei den Anwohnern nur wenig {{g1}}.",
    ["Anklang"], ["Anlass", "Anklang", "Anreiz", "Anteil"],
    "Funktionsverbgefüge: „Anklang finden“ (= gut aufgenommen werden). „Anlass“, „Anreiz“ und „Anteil“ beginnen ähnlich, bilden mit „finden“ aber keine feste Verbindung."),
  gChoice("wortbildung", "EASY",
    "Die Genehmigung ist an die ___ sämtlicher Auflagen geknüpft.",
    "Einhaltung", ["Haltung", "Abhaltung", "Unterhaltung"], 3,
    "Auflagen, Fristen und Regeln „hält man ein“: die Einhaltung. „Haltung“ (Einstellung), „Abhaltung“ (einer Sitzung) und „Unterhaltung“ (Gespräch, Zerstreuung) gehören zum selben Wortstamm, bilden mit „Auflagen“ aber keine sinnvolle Verbindung."),

  // ------------------------------------------------ MID
  gChoice("modalverben_subjektiv", "MID",
    "Was bedeutet der Satz? „Die Verzögerung dürfte mit dem Personalmangel zusammenhängen.“",
    "Der Sprecher hält einen Zusammenhang mit dem Personalmangel für wahrscheinlich.",
    [
      "Es ist erlaubt, die Verzögerung mit dem Personalmangel zu erklären.",
      "Andere haben behauptet, dass die Verzögerung mit dem Personalmangel zusammenhängt.",
      "Es ist bewiesen, dass die Verzögerung mit dem Personalmangel zusammenhängt.",
    ], 2,
    "„Dürfte“ (Konjunktiv II von dürfen) drückt eine Vermutung mit hoher Wahrscheinlichkeit aus. Erlaubnis wäre „darf“, fremde Behauptung „soll“, Gewissheit gäbe der Indikativ wieder."),
  gGap("nominalisierung", "MID",
    "Formen Sie den Nebensatz in eine Nominalgruppe um.\n\nWeil die Preise kräftig gestiegen sind, haben viele Haushalte ihre Ausgaben eingeschränkt.\n→ Aufgrund des kräftigen {{g1}} der Preise haben viele Haushalte ihre Ausgaben eingeschränkt.",
    ["Anstiegs", "Anstieges", "Ansteigens", "Steigens"], undefined,
    "Nominalisierung von „steigen“: der Anstieg. Nach „aufgrund“ steht der Genitiv, das Nomen (maskulin, Singular) bekommt also die Endung -s oder -es: „des kräftigen Anstiegs / Anstieges der Preise“. Die substantivierten Infinitive „Ansteigens“ und „Steigens“ sind ebenfalls korrekt und werden akzeptiert."),
  gGap("partizipialattribut", "MID",
    "Die von der Geschäftsleitung im Frühjahr {{g1}} Regeln gelten ab sofort für alle Abteilungen.",
    ["beschlossenen"], ["beschlossene", "beschließenden", "beschlossenen", "zu beschließenden"],
    "Erweitertes Partizipialattribut mit passivischer Bedeutung (die Regeln wurden beschlossen), also Partizip II. Nach dem bestimmten Artikel im Plural steht die schwache Endung -en: „die ... beschlossenen Regeln“. „Beschließenden“ wäre aktiv, „zu beschließenden“ drückt etwas Künftiges aus, „beschlossene“ hat die falsche Endung."),
  gGap("partizipialattribut", "MID",
    "Ersetzen Sie den Relativsatz durch ein Partizipialattribut mit Partizip I.\n\ndie Beschäftigten, die in Teilzeit arbeiten\n→ die in Teilzeit {{g1}} Beschäftigten",
    ["arbeitenden"], undefined,
    "Aktiver, gleichzeitiger Vorgang: Partizip I „arbeitend“, nach „die“ im Plural mit der Endung -en: „die in Teilzeit arbeitenden Beschäftigten“."),
  gChoice("nominalisierung", "MID",
    "Welcher Satz gibt die Bedeutung richtig wieder? „Bei Nichteinhaltung der Frist verfällt der Anspruch auf Erstattung.“",
    "Wer die Frist nicht einhält, verliert den Anspruch auf Erstattung.",
    [
      "Wer die Frist einhält, verliert den Anspruch auf Erstattung.",
      "Auch wer die Frist nicht einhält, behält den Anspruch auf Erstattung.",
      "Solange die Frist läuft, besteht noch kein Anspruch auf Erstattung.",
    ], 3,
    "Auflösung des Nominalstils: „bei Nichteinhaltung“ = konditional „wenn/wer ... nicht einhält“; „verfallen“ = ungültig werden, verloren gehen."),
  gChoice("konnektoren", "MID",
    "Wir sollten die Einführung der neuen Software verschieben, ___ zwei Kollegen aus dem Projektteam ohnehin im Urlaub sind.",
    "zumal", ["wohingegen", "trotzdem", "damit"], 3,
    "„Zumal“ leitet einen zusätzlichen, verstärkenden Grund ein (Verb am Ende). „Trotzdem“ ist ein Adverb und verlangt Verbzweitstellung, „wohingegen“ ist adversativ, „damit“ final."),
  gGap("praepositionen", "MID",
    "Einer aktuellen Umfrage {{g1}} wünscht sich die Mehrheit der Beschäftigten flexiblere Arbeitszeiten.",
    ["zufolge"], ["hinsichtlich", "mangels", "zufolge", "bezüglich"],
    "„Zufolge“ steht nach dem Nomen (hier mit Dativ) und gibt eine Quelle an. „Hinsichtlich“, „mangels“ und „bezüglich“ stehen nur vor dem Nomen und passen auch inhaltlich nicht."),
  gGap("funktionsverbgefuege", "MID",
    "Die Vorschläge des Teams sollen bei der weiteren Planung Berücksichtigung {{g1}}.",
    ["finden"], ["nehmen", "bringen", "finden", "stellen"],
    "Funktionsverbgefüge: „Berücksichtigung finden“ (= berücksichtigt werden). Die anderen Verben bilden mit „Berücksichtigung“ keine feste Verbindung."),

  // ------------------------------------------------ HARD
  gChoice("modalverben_subjektiv", "HARD",
    "Was bedeutet der Satz? „Der Bewerber will das Programm in nur zwei Wochen gelernt haben.“",
    "Der Bewerber behauptet das, aber es ist nicht belegt.",
    [
      "Der Bewerber hat vor, das Programm in zwei Wochen zu lernen.",
      "Andere berichten, dass der Bewerber das Programm so schnell gelernt hat.",
      "Der Bewerber hätte das Programm gern in zwei Wochen gelernt.",
    ], 0,
    "Subjektives „wollen“ + Infinitiv Perfekt: Das Subjekt behauptet etwas über sich selbst, der Sprecher distanziert sich. Absicht (objektives „wollen“) hätte Infinitiv Präsens, Hörensagen wäre „soll“."),
  gChoice("konjunktiv_i", "HARD",
    `${INDIRECT}\n\nDie Befragten gaben an, sie ___ meistens mit dem Fahrrad zur Arbeit.`,
    "kämen", ["kommen", "komme", "kamen"], 1,
    "Der Konjunktiv I „sie kommen“ ist mit dem Indikativ identisch, deshalb tritt der Konjunktiv II „kämen“ als Ersatzform ein. „Komme“ passt nicht zum Plural, „kamen“ ist Indikativ Präteritum."),
  gChoice("partizipialattribut", "HARD",
    "Was bedeutet „der noch zu prüfende Antrag“?",
    "der Antrag, der noch geprüft werden muss",
    [
      "der Antrag, der gerade geprüft wird",
      "der Antrag, der bereits geprüft worden ist",
      "der Antrag, der nicht geprüft werden darf",
    ], 2,
    "„zu“ + Partizip I als Attribut (Gerundivum) hat passivische Bedeutung mit Notwendigkeit (oder Möglichkeit): „der zu prüfende Antrag“ = der Antrag, der geprüft werden muss. „Noch“ bestätigt: Die Prüfung steht aus."),
  gChoice("konjunktiv_i", "HARD",
    `${INDIRECT}\n\nDie Projektleiterin kündigte an, das Team ___ die Ergebnisse im Herbst vorstellen.`,
    "werde", ["würde", "wird", "wurde"], 0,
    "Futur in der indirekten Rede: Konjunktiv I „werde“ + Infinitiv. Er unterscheidet sich vom Indikativ „wird“, deshalb ist keine Ersatzform mit „würde“ nötig. „Wurde“ ist Indikativ Präteritum."),
  gChoice("konnektoren", "HARD",
    "Er kann kaum eine einfache E-Mail auf Englisch schreiben, ___ eine Verhandlung auf Englisch führen.",
    "geschweige denn", ["sondern auch", "vielmehr", "es sei denn"], 1,
    "„Geschweige denn“ steigert nach einer verneinten oder eingeschränkten Aussage (kaum): Das Zweite ist noch weniger möglich. „Sondern auch“ braucht „nicht nur“, „vielmehr“ korrigiert, „es sei denn“ leitet eine Ausnahmebedingung mit eigenem Satz ein."),
  gGap("konnektoren", "HARD",
    "Ergänzen Sie das fehlende Wort.\n\nDas Ergebnis ist insofern überraschend, {{g1}} kaum jemand mit einer so hohen Beteiligung gerechnet hatte.",
    ["als"], undefined,
    "Zweiteiliger Konnektor „insofern ... als“ (= in dem Maße, wie / weil). Standardsprachlich ist nur „als“ korrekt; „insofern ..., weil/dass“ gilt als umgangssprachlich."),
  gGap("praepositionen", "HARD",
    "Das Projekt wurde {{g1}} aller Bedenken des Betriebsrats fortgesetzt.",
    ["ungeachtet"], ["angesichts", "mangels", "infolge", "ungeachtet"],
    "„Ungeachtet“ + Genitiv bedeutet „trotz“: Die Bedenken bestanden, das Projekt ging trotzdem weiter. „Angesichts“ und „infolge“ nennen einen Grund, „mangels“ ein Fehlen; das ergibt hier keinen Sinn."),
  gChoice("funktionsverbgefuege", "HARD",
    "Mit den neuen Kontrollen soll dem Missbrauch von Firmenkreditkarten ein Riegel ___ werden.",
    "vorgeschoben", ["vorgeworfen", "vorgestellt", "vorgesetzt"], 2,
    "Feste Wendung: „einer Sache einen Riegel vorschieben“ (= etwas verhindern). Die Distraktoren sind Präfixverben mit demselben Präfix, bilden aber mit „Riegel“ keine Wendung."),

  // ------------------------------------------------ C-test
  cTest(LEVEL, "MID", {
    first:
      "Immer mehr Unternehmen setzen inzwischen auf flexible Arbeitszeitmodelle, um qualifizierte Fachkräfte zu gewinnen und langfristig zu halten.",
    body:
      "Was zunächst wie ein Zugeständnis an die Beschäftigten wirkt, erweist sich bei genauerer Betrachtung oft als wirtschaftlich sinnvoll. " +
      "Wer seine Arbeitszeit selbst einteilen kann, ist nachweislich seltener krank und bleibt dem Arbeitgeber länger treu. " +
      "Allerdings setzt ein solches Modell Vertrauen voraus.",
    last:
      "Führungskräfte müssen deshalb lernen, Ergebnisse statt bloßer Anwesenheit zu bewerten, und genau daran scheitern bislang viele Versuche.",
    // g11 selbst/selber are equally correct here.
    variants: { 11: ["ber"] },
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["chste"], 2: ["inem"], 3: ["m"], 4: ["ftigtem"],
      5: ["eisen"], 7: ["chtungen"], 9: ["volle"], 10: ["inen"],
      12: ["nnst"], 14: ["anke"], 15: ["iben"], 16: ["tgebern"],
      17: ["eue"], 18: ["tzen"], 20: ["rauens"],
    },
  }),
  // Why teenagers sleep too little.
  cTest(LEVEL, "MID", {
    first: "Dass Jugendliche morgens kaum aus dem Bett kommen, wird häufig als Bequemlichkeit missverstanden.",
    body:
      "Tatsächlich verschiebt sich während der Pubertät die innere Uhr, sodass das Schlafhormon erst deutlich später am Abend ausgeschüttet wird. " +
      "Hinzu kommt, dass viele Jugendliche bis spät in die Nacht auf leuchtende Bildschirme blicken, was das Einschlafen zusätzlich erschwert.",
    last:
      "Einige Schulen haben daraus bereits Konsequenzen gezogen und den Unterrichtsbeginn um eine Stunde nach hinten verlegt, mit spürbar positiven Folgen für Konzentration und Stimmung.",
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["hieben"], 4: ["eren"], 6: ["hormone"], 7: ["liche"],
      8: ["n"], 9: ["chüttete"], 10: ["nten"], 11: ["nn"],
      12: ["dlichen"], 13: ["äte"], 14: ["en"], 15: ["us"],
      16: ["chirm"], 17: ["elche"], 18: ["hlafens"],
    },
  }),
  // Urban gardens.
  cTest(LEVEL, "MID", {
    first:
      "Auf brachliegenden Flächen, Dächern und in Hinterhöfen entstehen in vielen Großstädten gemeinschaftlich bewirtschaftete Gärten.",
    body:
      "Was zunächst als Freizeitbeschäftigung einiger Idealisten belächelt wurde, hat sich mittlerweile zu einer ernst zu nehmenden Bewegung entwickelt. " +
      "Die Gärten verbessern nicht nur das Mikroklima, sondern bieten auch Bienen und anderen Insekten einen Lebensraum. " +
      "Zudem fördern sie den Austausch unter Nachbarn.",
    last:
      "Ob die Projekte langfristig bestehen können, hängt allerdings oft davon ab, ob die Städte die Flächen dauerhaft zur Verfügung stellen.",
    // g2 "Freizeitbe...": Freizeitbetätigung is as correct as Freizeitbeschäftigung.
    // g3 "Ideal...": Idealistinnen is as correct as Idealisten.
    variants: { 2: ["tätigung"], 3: ["istinnen"] },
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["chste"], 2: ["schäftigungen"], 3: ["ist"], 4: ["rden"],
      6: ["um"], 7: ["nste"], 9: ["ckeln"], 10: ["tens"],
      11: ["chts"], 12: ["er"], 15: ["ns"], 16: ["kt"],
      17: ["sräume"], 18: ["dert"], 19: ["em"],
    },
  }),
];

// MC cloze texts and word banks (spec 2026-10-18), each set easy to hard.
const grammarTexts: SeedItem[] = [
  cloze(LEVEL, "EASY", {
    title: "Bargeld auf dem Rückzug",
    first: "Lange galt Deutschland als ein Land, in dem man an der Kasse am liebsten mit Scheinen und Münzen bezahlt.",
    body:
      "Inzwischen hat sich das Bild jedoch spürbar [[gewandelt|gewandelte|wandelte|wandeln#perfekt.partizip]]. " +
      "Die Bundesbank teilte kürzlich mit, der Anteil der Barzahlungen im Einzelhandel [[sei|habe|wurde|werde#konjunktiv_i]] in den vergangenen fünf Jahren deutlich zurückgegangen. " +
      "Vor allem in den Städten greifen viele Kundinnen und Kunden an der Kasse immer häufiger [[zum|ins|beim|am#verb_praeposition]] Smartphone. " +
      "Diese Entwicklung ist durch die Pandemie zusätzlich beschleunigt [[worden|geworden|wurde|werden#passiv.perfekt]]. " +
      "Kritiker warnen allerdings davor, das Bargeld vorschnell [[abzuschaffen|abschaffen|abgeschafft|abzuschaffende#infinitiv]]. " +
      "Sie geben zu bedenken, dass vor allem Menschen, [[denen|die|deren|dessen#relativsatz]] der Umgang mit digitalen Zahlungsmitteln schwerfällt, benachteiligt würden. " +
      "Zudem schützt Bargeld die Privatsphäre, [[da|denn|deshalb|trotzdem#konnektor]] jede Kartenzahlung Datenspuren hinterlässt. " +
      "Hinzu kommt die Frage, wie widerstandsfähig ein vollständig [[auf|an|von|über#verb_praeposition]] Strom und Internet [[angewiesenes|angewiesen|anweisendes|anzuweisendes#partizipattribut]] Zahlungssystem im Krisenfall wäre. " +
      "Eine vollständige [[Abschaffung|Schaffung|Anschaffung|Abschaffens#nominalisierung]] des Bargelds ist in Deutschland derzeit nicht geplant. " +
      "Gleichzeitig gewöhnen sich auch viele kleine Geschäfte [[daran|darauf|damit|dafür#praepositionaladverb]], dass ihre Kundschaft selbst Kleinstbeträge mit der Karte bezahlt.",
    last: "Ob das Bargeld eines Tages ganz verschwindet, werden am Ende wohl die Kundinnen und Kunden selbst entscheiden.",
    note: "Perfekt eines reflexiven Verbs (g1), Konjunktiv I in der indirekten Rede (g2), greifen zu (g3), Perfekt Passiv mit worden (g4), warnen davor + zu-Infinitiv bei trennbarem Verb (g5), Relativpronomen im Dativ bei jemandem fällt etwas schwer (g6), da mit Verbendstellung (g7), angewiesen auf (g8), Partizipialattribut nach ein im Neutrum (g9), Nominalstil (g10), sich gewöhnen an mit Präpositionaladverb (g11).",
  }),
  cloze(LEVEL, "MID", {
    title: "Mehrsprachigkeit in der Kita",
    first: "Fast jedes dritte Kind, das in Deutschland eine Kita besucht, wächst mit mehr als einer Sprache auf.",
    body:
      "Lange [[wurde|hat|würde|worden#passiv]] angenommen, dass zwei Sprachen ein kleines Kind überfordern. " +
      "Neuere Studien legen jedoch [[nahe|zu|an|bei#idiomatik]], dass eher das Gegenteil zutrifft. " +
      "Eine Hamburger Sprachwissenschaftlerin betont, ein mehrsprachig aufwachsendes Kind [[entwickle|entwickeln|entwickelnd|zu entwickeln#konjunktiv_i]] oft sogar ein feineres Gespür für sprachliche Strukturen. " +
      "Entscheidend sei allerdings, [[dass|damit|sodass|sofern#konnektor]] beide Sprachen ausreichend gefördert würden. " +
      "Gerade bei Kindern, [[deren|dessen|denen|die#relativsatz]] Eltern zu Hause kaum Deutsch sprechen, kommt der Kita deshalb eine Schlüsselrolle zu. " +
      "Im Alltag [[lässt|lassen|wird|ist#passiversatz]] sich dieser Anspruch allerdings nicht immer einlösen. " +
      "Die meisten Fachkräfte sprechen selbst nur Deutsch, und Bilderbücher in anderen Sprachen sind oft nur schwer [[zu beschaffen|beschaffen|beschafft|beschaffend#passiversatz]]. " +
      "Einige Einrichtungen beziehen deshalb die Eltern gezielt [[in|an|auf|zu#verb_praeposition]] die Sprachförderung ein, [[indem|damit|sodass|obwohl#konnektor.modal]] sie diese bitten, Lieder und Geschichten in der Familiensprache vorzustellen. " +
      "Die Kinder erfahren so, dass auch diese Sprache geschätzt wird. " +
      "Solche Projekte stoßen bei den Familien [[auf|an|zu|bei#funktionsverbgefuege]] große Resonanz. " +
      "Ersten Auswertungen [[zufolge|laut|seitens|mittels#praeposition]] verbessern sich dadurch sogar die Deutschkenntnisse der Kinder.",
    last: "Mehrsprachigkeit erweist sich damit weniger als Hindernis denn als Chance, sofern sie gezielt begleitet wird.",
    note: "unpersönliches Passiv im Präteritum (g1), nahelegen (g2), Konjunktiv I in der indirekten Rede (g3), dass-Satz nach „entscheidend sei“ (g4), Relativpronomen im Genitiv Plural (g5), sich lassen + Infinitiv als Passiversatz (g6), sein + zu-Infinitiv als Passiversatz (g7), einbeziehen in (g8), indem (g9), auf Resonanz stoßen (g10), nachgestelltes zufolge (g11).",
  }),
  cloze(LEVEL, "HARD", {
    title: "Wenn Antibiotika versagen",
    first: "Antibiotika gehören zu den wichtigsten Errungenschaften der modernen Medizin.",
    body:
      "Ihre Wirksamkeit ist jedoch zunehmend [[gefährdet|gefährdend|gefährdete|Gefährdung#wortbildung]]. " +
      "Weltweit sterben jährlich über eine Million Menschen an Infektionen, gegen [[die|denen|deren|welchen#relativsatz.praeposition]] keines der gängigen Mittel mehr wirkt. " +
      "Die Weltgesundheitsorganisation warnt seit Jahren, ohne entschlossenes Handeln [[drohe|drohen|drohten|gedroht#konjunktiv_i]] eine Rückkehr in die Zeit vor der Entdeckung des Penicillins. " +
      "Eine Hauptursache ist der übermäßige [[Einsatz|Einsätze|Eingriff|Verzicht#vocabulary]] von Antibiotika in der Tiermast. " +
      "Die dort in großen Mengen [[verabreichten|verabreichenden|verabreicht|zu verabreichenden#partizipattribut]] Wirkstoffe gelangen über Gülle und Abwasser in die Umwelt. " +
      "Aber auch in Arztpraxen werden Antibiotika häufig verschrieben, [[obwohl|weil|sodass|damit#konnektor.konzessiv]] die Beschwerden von Viren verursacht werden, bei denen sie wirkungslos sind. " +
      "Die Entwicklung neuer Wirkstoffe [[gilt|lässt|hält|stellt#rektion]] zudem als wirtschaftlich wenig attraktiv. " +
      "[[Da|Denn|Weshalb|Sodass#konnektor]] ein neues Antibiotikum möglichst selten eingesetzt werden soll, um Resistenzen vorzubeugen, lassen sich damit kaum Gewinne erzielen. " +
      "Fachleute fordern daher, die Forschung durch staatliche Prämien wieder [[in Gang|zur Geltung|in Kraft|zur Sprache#funktionsverbgefuege]] zu bringen. " +
      "[[Angesichts|Ungeachtet|Mangels|Anstelle#genitiv.praeposition]] der wachsenden Bedrohung haben sich mehrere Staaten verpflichtet, den Einsatz in der Tiermast zu begrenzen. " +
      "Ob diese Zusagen tatsächlich eingehalten [[werden|wird|worden|wurde#passiv]], bleibt allerdings abzuwarten.",
    last: "Klar ist nur, dass jede unnötige Einnahme das Problem weiter verschärft.",
    note: "Zustandspassiv (g1), Relativpronomen nach gegen + Akkusativ (g2), Konjunktiv I in der indirekten Rede (g3), Nominalstil (g4), erweitertes Partizipialattribut (g5), obwohl (g6), gelten als (g7), da im vorangestellten Nebensatz (g8), Funktionsverbgefüge in Gang bringen (g9), angesichts + Genitiv (g10), ob-Satz mit Passiv im Präsens (g11).",
  }),
  wordBank(LEVEL, "EASY", {
    title: "Ehrenamt im Wandel",
    first: "Rund ein Drittel der Menschen in Deutschland engagiert sich in ihrer Freizeit ehrenamtlich.",
    body:
      "Doch die Art des Engagements hat sich in den letzten Jahren deutlich [[verändert#perfekt.partizip]]. " +
      "Immer weniger Menschen sind bereit, sich langfristig an einen Verein zu [[binden#infinitiv]]. " +
      "Stattdessen bevorzugen sie zeitlich [[begrenzte#partizipattribut]] Projekte, etwa die Organisation eines Stadtfestes. " +
      "Viele Vereine haben deshalb Schwierigkeiten, ihre Vorstandsposten zu [[besetzen#infinitiv]]. " +
      "Gleichzeitig wächst die Nachfrage [[nach#verb_praeposition]] Ehrenamtlichen in der Pflege und in der Flüchtlingshilfe. " +
      "Experten [[empfehlen#vocabulary]] den Vereinen daher, flexiblere Formen der Mitarbeit anzubieten, [[damit#konnektor]] auch Menschen mit wenig Zeit mitmachen können. " +
      "Auch eine offizielle [[Anerkennung#vocabulary]], zum Beispiel durch Bescheinigungen für spätere Bewerbungen, kann zusätzlich motivieren.",
    last: "Denn ohne freiwilliges Engagement wäre vieles im gesellschaftlichen Leben schlicht nicht möglich.",
    distractors: ["für", "obwohl", "Beteiligung", "gegründet", "investieren"],
  }),
  wordBank(LEVEL, "MID", {
    title: "Bibliotheken im Wandel",
    first: "Wer an eine Bibliothek denkt, sieht meist stille Lesesäle und lange Regale voller Bücher vor sich.",
    body:
      "Tatsächlich haben sich viele Häuser in den letzten Jahren stark [[gewandelt#perfekt.partizip]]. " +
      "Neben Büchern [[verleihen#vocabulary]] sie heute auch Werkzeug, Spiele und Saatgut. " +
      "Die Ausleihe klassischer Medien geht zwar zurück, [[dafür#konnektor]] nutzen mehr Menschen die Räume zum Lernen und zum Arbeiten. " +
      "Gefragt sind vor allem ruhige [[Arbeitsplätze#vocabulary]] mit schnellem Internet. " +
      "Ältere Gebäude stoßen dabei [[an#idiomatik]] ihre Grenzen, weil es an Steckdosen und Leitungen fehlt. " +
      "Viele Städte bauen die Bibliotheken deshalb um, [[sodass#konnektor]] künftig auch Kurse und Veranstaltungen stattfinden können. " +
      "Das kostet Geld, und nicht überall ist man bereit, es [[aufzubringen#infinitiv]]. " +
      "Befürworter betonen den [[Gewinn#vocabulary]] für die gesamte Nachbarschaft, weil dort Menschen zusammenkommen, die sich sonst nie begegnen würden.",
    last: "Ob der Umbau gelingt, entscheidet am Ende auch die Bereitschaft der Stadt, Bibliotheken als Treffpunkte ernst zu nehmen.",
    distractors: ["obwohl", "darauf", "Regale", "aufgebracht", "Verlust"],
  }),
  wordBank(LEVEL, "HARD", {
    title: "Moore als Klimaschützer",
    first: "Moore bedecken nur einen kleinen Teil der weltweiten Landfläche, speichern aber enorme Mengen Kohlenstoff.",
    body:
      "In Deutschland wurden die meisten Moore jedoch im Laufe der Jahrhunderte [[entwässert#passiv]], um Flächen für die Landwirtschaft zu gewinnen. " +
      "[[Sobald#konnektor]] der Torf mit Luft in Berührung kommt, zersetzt er sich und setzt große Mengen Kohlendioxid frei. " +
      "Trockengelegte Moore sind deshalb für einen [[erheblichen#adjektivendung]] Teil der Treibhausgasemissionen der Landwirtschaft verantwortlich. " +
      "Die Bundesregierung will daher in den kommenden Jahren zahlreiche Flächen wieder [[vernässen#infinitiv]]. " +
      "Für die betroffenen Landwirte ist das allerdings mit [[Einbußen#vocabulary]] verbunden, da sich nasse Böden kaum mit herkömmlichen Maschinen bearbeiten lassen. " +
      "Als Alternative gilt der Anbau von Schilf und Rohrkolben, die sich [[als#rektion]] Rohstoff für Dämmplatten oder Verpackungen eignen. " +
      "Noch fehlt es allerdings an [[Abnehmern#vocabulary]], die solche Produkte in größeren Mengen kaufen. " +
      "Fachleute [[plädieren#verb_praeposition]] deshalb für eine gezielte Förderung, bis sich ein Markt entwickelt hat.",
    last: "Ohne die Bereitschaft der Landwirte wird der Schutz der Moore jedenfalls kaum gelingen.",
    distractors: ["Obwohl", "geringen", "Erträge", "pflanzen", "Käufer"],
  }),
  // Open cloze: one typed word per gap (10 gaps each).
  openCloze(LEVEL, "EASY", {
    title: "Ein Dorf ohne Laden",
    first: "In vielen ländlichen Gemeinden ist in den letzten Jahren der letzte Laden geschlossen worden.",
    body:
      "Für die Bewohner bedeutet das, [[dass#konnektor]] sie für jede Kleinigkeit ins nächste größere Dorf fahren müssen. " +
      "Besonders schwer haben es ältere Menschen, [[die/welche#relativsatz]] kein Auto besitzen. " +
      "In einem Dorf im Allgäu wollten die Einwohner sich [[damit#praepositionaladverb]] nicht abfinden. " +
      "Sie gründeten eine Genossenschaft, [[der/welcher#relativsatz]] inzwischen mehr als zweihundert Mitglieder angehören. " +
      "Der Laden wird [[von/durch#passiv.praesens]] Freiwilligen geführt, die abwechselnd hinter der Theke stehen. " +
      "Zusätzlich [[gibt#praesens.vokalwechsel]] es einen kleinen Tisch, [[an/bei#praeposition]] dem man Kaffee trinken kann. " +
      "Anfangs zweifelten viele daran, [[ob#nebensatz]] sich ein solcher Laden überhaupt rechnen würde. " +
      "Mittlerweile arbeitet er [[nicht#negation]] nur kostendeckend, sondern erwirtschaftet sogar einen kleinen Überschuss. " +
      "Der Überschuss [[wird#passiv.praesens]] in die Dorfgemeinschaft investiert, zum Beispiel in einen Bus für Fahrten zum Arzt.",
    last: "Andere Gemeinden haben das Modell inzwischen übernommen.",
    note: "dass-Satz nach „bedeutet“ (g1), Relativpronomen im Nominativ (g2), Präpositionaladverb bei „sich abfinden mit“ (g3), Relativpronomen im Dativ bei „angehören“ (g4), Passiv mit Urheber (g5), es gibt (g6), Präposition im Relativsatz (g7), ob-Satz nach „zweifeln daran“ (g8), nicht nur ... sondern auch (g9), Passiv Präsens (g10).",
  }),
  openCloze(LEVEL, "MID", {
    title: "Der Wochenmarkt",
    first: "Jeden Samstagmorgen verwandelt sich der Platz vor dem Rathaus in einen Wochenmarkt.",
    body:
      "Der Markt, [[dessen#relativsatz]] Anfänge bis ins Mittelalter zurückreichen, gehört zu den ältesten Einrichtungen der Stadt. " +
      "Lange Zeit [[wurde#passiv]] dort fast nur Gemüse aus dem Umland verkauft. " +
      "Heute bieten die Händler dagegen vieles an, [[was/das#relativsatz.was]] man im Supermarkt vergeblich sucht, etwa Wildkräuter oder Honig aus eigener Imkerei. " +
      "Für viele Stammkunden ist der Einkauf weit mehr [[als#konnektor.modal]] eine Notwendigkeit, er gehört einfach zum Wochenende. " +
      "Weil die Standgebühren stark gestiegen sind, denken manche Händler [[daran#praepositionaladverb]], den Stand aufzugeben. " +
      "Die Stadt will [[sich#reflexiv]] deshalb dafür einsetzen, dass die Gebühren nicht mehr jedes Jahr steigen. " +
      "Ein Händler meinte, ohne seine Stammkundschaft [[hätte#konjunktiv2.vergangenheit]] er schon vor Jahren aufgeben müssen. " +
      "Dass er weitermacht, liegt [[an#verb_praeposition]] den Menschen, die jede Woche wiederkommen. " +
      "Neue Stände sind [[kaum/nicht#negation]] in Sicht, [[denn#konnektor]] der Platz ist schon jetzt bis zur letzten Ecke belegt.",
    last: "Wer am Samstag früh kommt, findet noch einen Parkplatz und die besten Äpfel.",
    note: "Relativpronomen im Genitiv (g1), Passiv Präteritum (g2), Relativsatz mit „was“ nach „vieles“ (g3), Vergleich nach „mehr“ (g4), Präpositionaladverb bei „denken an“ (g5), Reflexivpronomen bei „sich einsetzen“ (g6), Konjunktiv II der Vergangenheit bei „ohne“ (g7), „liegen an“ (g8), Negation (g9), denn mit Verbzweitstellung (g10).",
  }),
  openCloze(LEVEL, "HARD", {
    title: "Schlaf und Gedächtnis",
    first: "Dass ausreichender Schlaf für die Gesundheit wichtig ist, bezweifelt heute kaum noch jemand.",
    body:
      "Während des Schlafs werden Eindrücke des Tages, [[die/welche#relativsatz]] im Gehirn zunächst nur kurzzeitig gespeichert waren, in dauerhafte Erinnerungen überführt. " +
      "Probanden, [[denen#relativsatz]] nach dem Lernen eine Nachtruhe gegönnt wurde, erinnerten sich am nächsten Morgen an deutlich mehr Vokabeln als jene, die wach geblieben waren. " +
      "Der Effekt war [[umso/desto#konnektor.zweiteilig]] stärker, je mehr Tiefschlaf die Teilnehmenden hatten. " +
      "Daraus [[lässt#passiversatz]] sich allerdings nicht schließen, dass man den Schlaf beliebig durch Pausen ersetzen kann. " +
      "Forschende warnen [[davor#praepositionaladverb]], die Ergebnisse vorschnell zu verallgemeinern. " +
      "Die meisten Experimente wurden an jungen, gesunden Erwachsenen durchgeführt, [[weshalb/weswegen#konnektor]] offen bleibt, ob sie auch für Ältere gelten. " +
      "Offen ist zudem, [[ob/inwieweit/inwiefern#nebensatz]] ein kurzer Mittagsschlaf einen Teil der Nachtruhe ersetzen kann. " +
      "Wer unter Schlafmangel leidet, sollte [[nicht#negation]] zögern, ärztlichen Rat einzuholen. " +
      "Entscheidend ist ohnehin weniger die Dauer [[als#konnektor.modal]] die Regelmäßigkeit. " +
      "Ein fester Rhythmus trägt [[dazu#praepositionaladverb]] bei, dass der Körper zur Ruhe kommt.",
    last: "Am Ende bleibt die einfache Erkenntnis, dass ein guter Schlaf kein Luxus ist.",
    note: "Relativpronomen im Nominativ Plural (g1), Relativpronomen im Dativ (g2), je ... umso/desto (g3), sich lassen + Infinitiv als Passiversatz (g4), warnen davor (g5), weshalb als Konnektor (g6), indirekter Fragesatz (g7), Negation bei Aufforderung (g8), weniger ... als (g9), beitragen dazu (g10).",
  }),
];

// ---------------------------------------------------------------- READING

type RSkill = "gist" | "detail" | "inference" | "vocabulary" | "structure";

function text(slug: string, title: string, topic: string, paragraphs: string[]): SeedStimulus {
  return {
    key: `v2-r-c1-${slug}`,
    section: "READING",
    level: LEVEL,
    title,
    topic,
    body: paragraphs.join("\n\n"),
  };
}

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
    choice(
      skill: RSkill,
      within: Within,
      prompt: string,
      correct: string,
      distractors: [string, string, string],
      pos: Pos,
      explanation: string,
    ): SeedItem {
      return { ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...placeOptions(correct, distractors, pos) };
    },
    tfng(skill: RSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      const ids = statements.map((_, i) => `s${i + 1}`);
      return {
        ...base(skill, within, "Richtig (R), falsch (F) oder steht nicht im Text (NG)?", explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", statements: statements.map(([t], i) => ({ id: ids[i], text: t })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, a], i) => [ids[i], a])) },
      };
    },
    /** Ja / Nein / Text sagt dazu nichts: stored as R / F / NG, shown with the Ja/Nein wording. */
    jaNein(skill: RSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      const ids = statements.map((_, i) => `s${i + 1}`);
      return {
        ...base(skill, within, "Lesen Sie den Text. Sagt der Text Ja, Nein oder nichts dazu?", explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", wording: "JA_NEIN", statements: statements.map(([t], i) => ({ id: ids[i], text: t })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, a], i) => [ids[i], a])) },
      };
    },
    /** pairs[i] is the 1-based position in `right` that left row i belongs to. */
    match(
      skill: RSkill,
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

// Text 1: popular-science article with a word-level cloze (Goethe C1 Lesen Teil 1 style).
const R_PAUSEN = text("pausen", "Warum Pausen die Konzentration retten", "Wissenschaft und Arbeit", [
  "Wer an einem anspruchsvollen Projekt arbeitet, neigt dazu, Pausen als verlorene Zeit zu betrachten. Die Abgabefrist rückt näher, der Posteingang quillt über, und der Gedanke an eine Kaffeepause löst eher ein schlechtes Gewissen aus als Erleichterung. Gerade in Phasen hoher Belastung verzichten viele Beschäftigte auf Unterbrechungen, weil sie befürchten, sonst in Rückstand zu geraten. Die arbeitspsychologische Forschung legt jedoch nahe, dass diese Strategie auf Dauer eher schadet als nützt.",
  "Ein Forschungsteam einer Universität hat über mehrere Wochen hinweg die Konzentrationsleistung von Büroangestellten untersucht. Die Teilnehmenden lösten in regelmäßigen Abständen kurze Aufgaben am Bildschirm, bei denen es auf Genauigkeit ankam. Eine Gruppe legte alle neunzig Minuten eine Pause von etwa zehn Minuten ein, die andere arbeitete durch, solange sie sich dazu in der Lage fühlte. Das Ergebnis fiel deutlicher aus als erwartet: Während die Fehlerquote in beiden Gruppen am Vormittag nahezu gleich war, (1) ___ sie bei den Durcharbeitenden im Laufe des Nachmittags erheblich an. Bemerkenswert ist, dass die Betroffenen selbst davon kaum etwas merkten. Sie schätzten ihre eigene Leistung bis zuletzt als gut ein.",
  "Die Forschenden führen dies auf die begrenzte Kapazität der Aufmerksamkeit (2) ___. Wer sich über längere Zeit auf eine Aufgabe konzentriert, verbraucht eine Ressource, die sich nur in Phasen der Entspannung wieder auffüllt. Entscheidend sei dabei nicht allein die Länge der Pause, sondern auch, wie sie verbracht werde. Wer in der Pause E-Mails beantwortet oder Nachrichten auf dem Smartphone liest, beansprucht dieselben geistigen Funktionen wie bei der Arbeit und erholt sich entsprechend weniger. Deutlich wirksamer seien Tätigkeiten, die mit der eigentlichen Arbeit nichts zu tun haben, etwa ein kurzer Spaziergang oder ein Gespräch über ein ganz anderes Thema. Lang müssen solche Pausen übrigens nicht sein. Andere Untersuchungen deuten darauf hin, dass bereits mehrere Unterbrechungen von wenigen Minuten einen messbaren Effekt haben können, sofern sie regelmäßig eingelegt werden. Wer dagegen erst aufhört, wenn die Erschöpfung deutlich spürbar ist, braucht erheblich länger, um wieder zur vollen Leistungsfähigkeit zurückzufinden.",
  "Für Unternehmen ergeben sich daraus Konsequenzen, die über individuelle Ratschläge hinausgehen. Solange Pausen als Zeichen mangelnden Engagements gelten, werden viele Beschäftigte sie weiterhin auslassen, selbst wenn sie es besser wissen. Einige Firmen haben deshalb begonnen, feste Pausenzeiten in den Kalender aufzunehmen und Besprechungen so zu planen, dass dazwischen Zeit zum Durchatmen bleibt. Auch Führungskräfte spielen eine wichtige Rolle: Wer selbst nie eine Pause macht, sendet ein deutliches Signal an das Team, selbst wenn er das Gegenteil beteuert. Ob solche Maßnahmen dauerhaft Wirkung zeigen, lässt sich bislang allerdings nur schwer sagen, denn entsprechende Langzeitstudien fehlen noch.",
  "Besonders schwer fällt das Pausieren offenbar dort, wo der Arbeitstag keine äußere Struktur mehr vorgibt. Wer allein zu Hause arbeitet, wird weder von Kolleginnen zum Mittagessen abgeholt noch durch den Weg zur nächsten Besprechung unterbrochen. Manche Beschäftigte behelfen sich mit kleinen Ritualen, etwa einem festen Spaziergang nach dem Mittagessen oder einem Wecker, der sie an die nächste Unterbrechung erinnert. Solche Gewohnheiten wirken unscheinbar, doch gerade ihre Regelmäßigkeit scheint den Unterschied zu machen.",
  "Die Autorinnen und Autoren der Studie warnen zudem davor, ihre Ergebnisse zu verallgemeinern. Untersucht wurden ausschließlich Tätigkeiten am Schreibtisch; ob sich die Befunde auf körperliche Arbeit übertragen lassen, ist offen. Dennoch sehen sie in ihren Daten einen klaren Hinweis darauf, dass die verbreitete Vorstellung, wer mehr Stunden am Stück arbeite, schaffe auch mehr, zumindest für geistige Arbeit nicht zutrifft.",
]);

// Text 2: information-dense magazine article.
const R_REPARATUR = text("reparatur", "Reparieren statt wegwerfen: ein Recht mit Hindernissen", "Umwelt und Wirtschaft", [
  "Ein Wasserkocher, der nach drei Jahren den Dienst versagt, landet in den meisten Haushalten im Müll. Eine Reparatur kommt selten infrage, und das liegt nicht unbedingt an mangelndem Willen. Häufig sind Ersatzteile schlicht nicht erhältlich, oder ihr Preis übersteigt den eines neuen Geräts. Hinzu kommt, dass viele Produkte so konstruiert sind, dass sie sich ohne Spezialwerkzeug gar nicht öffnen lassen. Die Folgen sind beträchtlich: Jahr für Jahr entstehen in Europa Millionen Tonnen Elektroschrott, von denen nur ein Teil fachgerecht verwertet wird.",
  "Mit neuen Vorschriften auf europäischer Ebene soll sich das ändern. Hersteller bestimmter Gerätegruppen, etwa von Waschmaschinen, Kühlschränken und Smartphones, werden verpflichtet, Ersatzteile über einen festgelegten Zeitraum bereitzuhalten und Reparaturanleitungen zugänglich zu machen. Außerdem dürfen sie unabhängige Werkstätten nicht mehr durch technische Tricks, etwa durch Software, die nur Originalteile akzeptiert, von der Reparatur ausschließen. Für die Kundschaft soll zudem leichter erkennbar werden, wie reparaturfreundlich ein Produkt ist. Vorgesehen ist eine Kennzeichnung, ähnlich den bekannten Angaben zum Energieverbrauch, die schon beim Kauf zeigt, wie leicht sich ein Gerät öffnen lässt und wie lange Ersatzteile erhältlich sind.",
  "Umweltverbände begrüßen die Regeln grundsätzlich, halten sie aber für unzureichend. Ihre Kritik richtet sich vor allem darauf, dass zwar die Verfügbarkeit von Ersatzteilen geregelt wird, nicht aber deren Preis. Solange ein neues Display fast so viel koste wie ein neues Telefon, entscheide sich kaum jemand für die Reparatur, argumentiert eine Sprecherin. Einige Länder setzen deshalb zusätzlich auf finanzielle Anreize: Wer ein Gerät reparieren lässt, erhält einen Zuschuss zu den Kosten. Erste Auswertungen deuten darauf hin, dass solche Programme die Zahl der Reparaturen erhöhen, wobei unklar bleibt, wie viele dieser Reparaturen ohnehin stattgefunden hätten.",
  "Die Hersteller wiederum verweisen auf zusätzliche Kosten. Ersatzteile über viele Jahre zu lagern, binde Kapital und Lagerfläche; diese Kosten würden letztlich an die Kundschaft weitergegeben. Zudem warnen sie vor Sicherheitsrisiken, wenn Laien sich an Geräten mit Akkus oder Hochspannungsteilen versuchen. Kritiker halten dem entgegen, dass dieses Argument seit Jahren vorgebracht werde, um den Markt für Reparaturen zu kontrollieren.",
  "Für das Handwerk könnten die neuen Regeln eine Chance sein. Reparaturbetriebe klagen allerdings schon jetzt über fehlenden Nachwuchs. Eine Ausbildung im Bereich Elektronik ist anspruchsvoll, die Bezahlung im Vergleich zur Industrie eher bescheiden. Ohne qualifizierte Fachkräfte, so die Befürchtung, bleibe das Recht auf Reparatur in vielen Regionen ein Recht auf dem Papier.",
  "Unabhängig von der Gesetzgebung ist in vielen Städten zudem eine Bewegung entstanden, die das Reparieren aus der Nische holen will. In sogenannten Reparaturcafés helfen Ehrenamtliche dabei, defekte Toaster, Lampen oder Fahrräder wieder instand zu setzen. Dort geht es nicht nur um das einzelne Gerät, sondern auch darum, Wissen weiterzugeben, das in vielen Familien verloren gegangen ist. Solche Initiativen können professionelle Werkstätten allerdings nicht ersetzen, zumal die Ehrenamtlichen bei komplexer Elektronik schnell an ihre Grenzen stoßen.",
  "Letztlich hängt der Erfolg auch von den Verbraucherinnen und Verbrauchern selbst ab. Umfragen zufolge befürworten zwar die meisten das Reparieren, im Alltag greifen jedoch viele zum Neugerät, weil es bequemer ist oder weil ein neues Modell schlicht attraktiver erscheint. Gesetze können Hindernisse beseitigen; Gewohnheiten ändern sie nicht automatisch.",
]);

// Text 3: commentary with sentence insertion (Goethe C1 Lesen Teil 3 style).
const R_WEITERBILDUNG = text("weiterbildung", "Kommentar: Lernen auf eigene Rechnung?", "Aus- und Weiterbildung", [
  "Kaum eine Festrede über die Zukunft der Arbeit kommt ohne den Begriff des lebenslangen Lernens aus. Technologien verändern sich schneller denn je, Berufsbilder entstehen und verschwinden, und wer den Anschluss nicht verlieren will, muss sich ständig weiterbilden. [1] ___ Wer genauer hinsieht, stellt nämlich fest, dass die Verantwortung dafür zunehmend bei den Einzelnen abgeladen wird. Die Bereitschaft zum Lernen gehört zwar längst zum Standardrepertoire jeder Stellenanzeige, die Zeit dafür jedoch nur selten zum Angebot.",
  "In vielen Betrieben gilt Weiterbildung als freiwillige Zusatzleistung, die man sich in guten Jahren gönnt und in schlechten als Erstes streicht. Kurse finden abends oder am Wochenende statt, die Gebühren tragen die Beschäftigten nicht selten selbst. [2] ___ Wer Kinder betreut, Angehörige pflegt oder im Schichtdienst arbeitet, hat schlicht weniger Gelegenheit, sich nach Feierabend in einen Kurs zu setzen.",
  "Das Ergebnis ist ein bekanntes Muster: Es bilden sich vor allem diejenigen weiter, die ohnehin gut qualifiziert sind. Beschäftigte in einfachen Tätigkeiten, deren Arbeitsplätze am ehesten von Automatisierung bedroht sind, nehmen dagegen deutlich seltener an Weiterbildungen teil. [3] ___ Die Kluft zwischen beiden Gruppen wächst, und mit ihr das Risiko, dass ganze Teile der Belegschaft beim nächsten technologischen Wandel auf der Strecke bleiben.",
  "Hinzu kommt, dass viele Angebote wenig mit dem tatsächlichen Arbeitsalltag zu tun haben. Ein Wochenendseminar über Zeitmanagement ist schnell gebucht, verändert aber oft wenig, wenn die Abläufe im Betrieb dieselben bleiben. Sinnvoller wären Formate, die an konkrete Aufgaben anknüpfen und bei denen sich das Gelernte sofort anwenden lässt.",
  "Auch die Form der Angebote verdient einen kritischen Blick. Viele Unternehmen setzen inzwischen auf Lernplattformen, auf denen Beschäftigte jederzeit Kurse abrufen können. Das klingt nach Freiheit, verlagert das Lernen aber oft in die Randzeiten des Tages. Wer zwischen zwei Besprechungen ein Lernvideo ansehen soll, findet selten die nötige Ruhe. Eine Plattform ersetzt eben keine Zeit, die ausdrücklich für das Lernen vorgesehen ist.",
  "Dabei liegt es durchaus im Interesse der Unternehmen, hier gegenzusteuern. Fachkräfte sind knapp, und es ist in aller Regel günstiger, vorhandene Mitarbeitende für neue Aufgaben zu qualifizieren, als neue Leute auf einem leer gefegten Arbeitsmarkt zu suchen. [4] ___ Wer Lernzeit als Arbeitszeit anerkennt, signalisiert, dass Weiterbildung kein Privatvergnügen ist, sondern eine Investition, von der beide Seiten profitieren.",
  "Dass sich das lohnen kann, zeigen Beispiele aus dem Handwerk und aus der Pflege. Dort werden Beschäftigte zum Teil während der Arbeitszeit für Kurse freigestellt, und erfahrene Kolleginnen und Kollegen geben ihr Wissen in kurzen Einheiten direkt am Arbeitsplatz weiter. Solche Modelle sind nicht kostenlos, doch sie zahlen sich häufig aus: Die Beschäftigten bleiben länger, und ihr Wissen bleibt im Betrieb.",
  "Natürlich kann und soll niemand zum Lernen gezwungen werden, und auch die Beschäftigten selbst tragen Verantwortung für ihre berufliche Entwicklung. Doch wer lebenslanges Lernen fordert, muss auch die Bedingungen dafür schaffen. Solange das nicht geschieht, bleibt der schöne Begriff vor allem eines: ein Appell an andere.",
]);

// Text 4: four short positions on one question (Goethe C1 Lesen Teil 4 style).
const R_KI = text("ki-auswahl", "Software in der Personalauswahl: vier Stimmen", "Arbeit und Digitalisierung", [
  "A: Miriam Kessler, Arbeitspsychologin\nMenschen, die Bewerbungen sichten, lassen sich von Dingen beeinflussen, die mit der Stelle nichts zu tun haben: einem vertrauten Namen, einem sympathischen Foto, einer gemeinsamen Heimatstadt. Eine Software, die konsequent auf die Anforderungen der Stelle ausgerichtet ist, kann solche Verzerrungen verringern. Das gelingt allerdings nur, wenn ihre Ergebnisse in regelmäßigen Abständen daraufhin überprüft werden, ob bestimmte Gruppen systematisch schlechter abschneiden. Die endgültige Entscheidung muss in jedem Fall bei einem Menschen liegen. Ich sehe in solchen Programmen eher ein Werkzeug zur Selbstkontrolle als einen Ersatz für menschliches Urteilsvermögen.",
  "B: Tobias Hahn, Personalleiter in einem mittelständischen Unternehmen\nAuf eine Ausbildungsstelle bei uns kommen manchmal mehrere Hundert Bewerbungen. Ohne technische Unterstützung bei der Vorauswahl wäre das kaum zu bewältigen. Mit einem Programm, das Videointerviews automatisch auswertete, haben wir dagegen schlechte Erfahrungen gemacht. Viele Bewerberinnen und Bewerber empfanden das als befremdlich, einige zogen ihre Bewerbung zurück, darunter auch sehr vielversprechende. Wir haben das Verfahren nach wenigen Monaten wieder eingestellt. Für die Sichtung der schriftlichen Unterlagen nutzen wir die Software aber weiterhin, und die Rückmeldungen dazu sind überwiegend positiv.",
  "C: Leyla Aksoy, Professorin für Informatik\nLernende Systeme orientieren sich an den Entscheidungen der Vergangenheit. Wurden in einem Unternehmen jahrelang bestimmte Profile bevorzugt, so lernt die Software genau dieses Muster und setzt es fort, nur schneller und weniger sichtbar. Hinzu kommt, dass selbst die Entwickler oft nicht genau erklären können, warum ein System zu einem bestimmten Ergebnis gelangt. Ich halte es deshalb für unverzichtbar, dass Bewerbende darüber informiert werden, wenn ihre Unterlagen maschinell bewertet werden. Das ist kein Argument gegen solche Systeme, wohl aber eines für mehr Transparenz.",
  "D: Jonas Weber, Berater für Bewerbende\nIn meinen Beratungen erlebe ich, dass viele Menschen ihren Lebenslauf inzwischen vor allem für Maschinen schreiben. Sie übernehmen Schlagwörter aus der Stellenanzeige, in der Hoffnung, die automatische Vorauswahl zu überstehen. Das Ergebnis sind Unterlagen, die sich zum Verwechseln ähneln. Manche meiner Klientinnen und Klienten verbringen mehr Zeit damit, die vermeintlich richtigen Begriffe zu finden, als darüber nachzudenken, was sie eigentlich für die Stelle qualifiziert. Ich rate trotzdem dazu, individuell zu formulieren: Spätestens im Vorstellungsgespräch fällt auf, wenn hinter den richtigen Begriffen wenig Substanz steckt.",
]);

// Text 5: short news item.
const R_STADTBAEUME = text("stadtbaeume", "Hitzeinseln in der Innenstadt", "Stadtklima und Umwelt", [
  "Wenn sich im Hochsommer die Innenstädte aufheizen, liegt die Temperatur zwischen den Häuserschluchten oft um mehrere Grad über der im Umland. Forschende sprechen von Hitzeinseln. Eine Untersuchung in sechs deutschen Großstädten hat nun gezeigt, dass Straßen mit älteren Laubbäumen an heißen Tagen spürbar kühler bleiben als baumlose Straßen, selbst wenn dort die Fassaden hell gestrichen sind. Entscheidend sei weniger der Schatten als die Verdunstung: Ein großer Baum gibt über seine Blätter an einem Sommertag mehrere Hundert Liter Wasser ab und entzieht der Umgebung dabei Wärme.",
  "Der Effekt hängt allerdings von der Wasserversorgung ab. Bäume, die in verdichtetem Boden stehen und kaum Regen erhalten, stellen die Verdunstung bei Trockenheit weitgehend ein und kühlen dann deutlich weniger. Mehrere Städte erproben deshalb sogenannte Schwammstraßen, bei denen Regenwasser unter dem Pflaster gespeichert und zu den Wurzeln geleitet wird. Ob sich diese Technik im großen Maßstab bezahlt macht, ist noch offen, denn Umbau und Pflege sind teuer. Die Forschenden raten daher, zunächst vorhandene Altbäume zu schützen, statt allein auf junge Pflanzungen zu setzen, die erst nach Jahrzehnten ihre volle Wirkung entfalten.",
]);

// Text 6: report on a museum.
const R_MUSEUM = text("museum", "Eintritt frei: Was ein Stadtmuseum erlebt hat", "Kultur und Museen", [
  "Als das Stadtmuseum vor zwei Jahren beschloss, den Eintritt für alle abzuschaffen, rechnete die Leitung mit einem Ansturm und mit leeren Kassen. Eingetreten ist nur das Erste. Die Besucherzahl stieg im ersten Jahr um knapp die Hälfte. Die Einnahmen aus dem Kartenverkauf fielen weg, wurden aber zum Teil durch höhere Umsätze im Museumscafé und durch Spenden aufgefangen.",
  "Interessanter als die Zahlen ist für die Direktorin, wer seitdem kommt. Früher besuchten vor allem Menschen das Haus, die ohnehin regelmäßig Ausstellungen sehen. Heute stehen häufiger Familien aus der Nachbarschaft in der Halle, die „mal eben für eine halbe Stunde“ hereinschauen. Das verändert die Arbeit: Die Texte an den Wänden werden kürzer, Führungen finden häufiger spontan statt. Eine Besucherbefragung zeigt allerdings, dass sich viele der Neuen kaum länger als eine Stunde im Haus aufhalten und seltener wiederkommen als frühere Gäste, die Eintritt bezahlt haben.",
  "Kritiker meinen, Kultur, die nichts koste, werde auch nicht mehr wertgeschätzt. Die Direktorin hält dagegen, dass sich Wertschätzung nicht am Preis ablesen lasse. Sie räumt aber ein, dass das Museum nun stärker um Stammgäste werben müsse.",
]);

// Text 7: forum post.
const R_GENOSSENSCHAFT = text("genossenschaft", "Erfahrungen mit einer Wohngenossenschaft", "Wohnen und Nachbarschaft", [
  "Beitrag von Lena_K: Ich wollte kurz berichten, wie es uns seit dem Einzug in eine Wohngenossenschaft ergangen ist. Vor der Entscheidung hatte ich viele Fragen und habe kaum Erfahrungsberichte gefunden.",
  "Man kauft keine Wohnung, sondern erwirbt Anteile an der Genossenschaft. Bei uns waren das einmalig rund zehntausend Euro, die man beim Auszug zurückbekommt. Die laufende Miete liegt etwa fünfzehn Prozent unter dem, was vergleichbare Wohnungen in der Gegend kosten, und sie kann nicht einfach erhöht werden, ohne dass die Mitglieder in der Versammlung zustimmen. Das ist der große Vorteil.",
  "Der Preis dafür ist, dass man mitreden muss. Zwei Abende im Jahr gehören der Mitgliederversammlung, dazu kommen Arbeitsgruppen, etwa für den Garten oder die Hausordnung. Manche Nachbarn finden das lästig. Mir gefällt, dass dadurch Konflikte früh zur Sprache kommen, bevor sie sich aufstauen. Wer allerdings häufig umzieht, sollte es sich gut überlegen: Der Anteil bindet Geld, und die Wartelisten sind lang, sodass man nach einem schnellen Wohnungswechsel kaum neu anfangen kann. Ich würde es trotzdem wieder machen.",
]);

// Text 8: six course ads for a matching task (needs with two constraints).
const R_FOTOKURSE = text("fotokurse", "Fotografie-Kurse an der Volkshochschule", "Freizeit und Kurse", [
  "A: Naturfotografie mit der Spiegelreflexkamera\nDieser Kurs richtet sich an alle, die ihre Kamera bereits besitzen und die manuellen Einstellungen verstehen wollen. An sechs Dienstagabenden lernen Sie Blende, Belichtungszeit und Lichtführung kennen. Die Übungen finden in der Dämmerung in der näheren Umgebung statt. Die Gruppe ist auf zehn Personen begrenzt.",
  "B: Fotografieren im Moor, Wochenendworkshop\nZwei Samstage im Mai, jeweils von neun bis sechzehn Uhr, im Naturschutzgebiet. Sie arbeiten mit Ihrer eigenen Kamera und lernen, Blende und Belichtungszeit bei wechselndem Licht selbst einzustellen. Vorkenntnisse sind nicht nötig. Feste Schuhe sind erforderlich.",
  "C: Bessere Bilder im Alltag\nIn einem einzigen Vormittag lernen Sie, Bildaufbau, Licht und einfache Bearbeitung gezielt einzusetzen. Eine Kamera brauchen Sie nicht, bringen Sie nur Ihr Telefon mit. Der Kurs findet an einem Samstag im Seminarraum der Volkshochschule statt, Vorkenntnisse sind nicht nötig.",
  "D: Bildbearbeitung für Fotofreunde\nAn einem Wochenende bearbeiten Sie Ihre eigenen Aufnahmen am Computer. Die Rechner stehen im Schulungsraum bereit, Ihre Fotos bringen Sie auf einem Speichermedium mit. Der Kurs ist für Teilnehmende gedacht, die schon regelmäßig fotografieren, und behandelt Farbkorrektur und Retusche.",
  "E: Porträts im Atelier\nEin Kurs an vier Donnerstagabenden. Sie lernen, Menschen im Studio mit Dauerlicht und Blitz zu fotografieren. Ausrüstung kann ausgeliehen werden, Vorkenntnisse sind nicht erforderlich. Zum Kurs gehört ein gemeinsames Abschlussshooting.",
  "F: Analoge Fotografie und Dunkelkammer\nEin Intensivkurs in den Herbstferien, werktags jeweils vormittags, mit Filmentwicklung und Abzügen in der Dunkelkammer. Filmkameras stehen zur Verfügung. Plätze sind begrenzt, bitte melden Sie sich frühzeitig an.",
]);

// Text 9: magazine feature with five missing paragraphs (insertion 5/7, paragraph level).
const R_LAUFEN = text("laufen", "Laufen: vom Sonderling zum Volkssport", "Sport und Freizeit", [
  "Vor dreißig Jahren galt noch als Sonderling, wer frühmorgens im Trainingsanzug durch den Stadtpark lief. Heute gehört das Laufen zum Alltag fast jeder Großstadt: Auf den Wegen am Fluss herrscht schon vor sieben Uhr reger Betrieb, und an Wochenenden sperren Veranstalter ganze Straßenzüge für Volksläufe.",
  "[1] ___",
  "Dabei hat das Laufen gegenüber anderen Sportarten einen unschätzbaren Vorteil: Es erfordert kaum Ausrüstung, keine Mitgliedschaft und keinen festen Termin. Wer ein Paar passende Schuhe besitzt, kann im Grunde sofort loslegen.",
  "[2] ___",
  "Gleichzeitig hat sich rund um das Laufen eine ganze Industrie entwickelt. Spezialgeschäfte analysieren den Gang ihrer Kundschaft auf dem Laufband, Uhren zeichnen jeden Schritt auf, und Anwendungen auf dem Telefon vergleichen die eigene Leistung mit der von Tausenden Unbekannten.",
  "[3] ___",
  "Sportmediziner sehen diese Entwicklung mit gemischten Gefühlen. Einerseits bewege sich so eine Bevölkerungsgruppe, die früher kaum Sport getrieben habe. Andererseits beobachteten sie, dass Anfänger sich häufiger verletzen, weil sie zu schnell zu viel wollen.",
  "[4] ___",
  "Auch die Kommunen haben das Thema entdeckt. Einige Städte beleuchten inzwischen Laufstrecken, andere bauen an beliebten Startpunkten Umkleiden mit Duschen. Nicht überall stößt das auf Begeisterung: Anwohner beschweren sich über Lärm und über Hobbyläufer, die Fußwege blockieren.",
  "[5] ___",
  "Ob der Trend anhält, lässt sich schwer vorhersagen. Sicher ist nur, dass sich das Bild des einsamen Läufers gewandelt hat: Laufen ist zu einer gemeinsamen Beschäftigung geworden.",
]);

// Text 10: feature with five missing sentences (insertion 5/7, sentence level).
const R_BIBER = text("biber", "Der Biber kehrt in die Stadt zurück", "Natur und Tiere", [
  "Er galt in Mitteleuropa lange als ausgestorben: Im neunzehnten Jahrhundert war der Biber wegen seines Pelzes so stark bejagt worden, dass nur kleine Restbestände überlebten. [1] ___ Heute leben allein in Deutschland wieder mehr als dreißigtausend Tiere, und sie haben nicht nur abgelegene Flusstäler besiedelt, sondern auch die Ränder großer Städte.",
  "Für Menschen, die in der Nähe eines Gewässers wohnen, ist der Biber mal Attraktion, mal Ärgernis. [2] ___ Wo ein Damm entsteht, staut sich das Wasser, und Wiesen, Wege und Keller können überflutet werden. Mehrere Gemeinden zahlen deshalb Entschädigungen an Landwirte.",
  "Naturschützer betonen dagegen den ökologischen Nutzen. [3] ___ In solchen Tümpeln finden Libellen, Amphibien und seltene Fischarten einen Lebensraum, der vielerorts verloren gegangen ist.",
  "Wie lässt sich das Zusammenleben organisieren? [4] ___ Wo ein Damm zum Problem wird, kann ein Rohr durch den Damm den Wasserstand senken, ohne dass der Biber seinen Bau aufgibt. Auch Schutzzäune um einzelne Obstbäume haben sich bewährt.",
  "In Städten stellt sich die Frage noch einmal anders. [5] ___ Deshalb kontrollieren Mitarbeiter der Grünflächenämter regelmäßig Uferbäume, die der Biber angenagt hat, bevor sie auf Spaziergänger stürzen können.",
  "Ob der Biber in der Großstadt dauerhaft heimisch wird, hängt auch davon ab, wie viel Wildnis die Menschen zulassen wollen.",
]);

// Text 11: essay on dialects (insertion 5/7, sentence level).
const R_DIALEKT = text("dialekt", "Dialekte: totgesagt und doch lebendig", "Sprache und Gesellschaft", [
  "Seit Jahrzehnten sagen manche Sprachforscher voraus, dass die deutschen Dialekte bald verschwinden werden. [1] ___ Statt zu verschwinden, wandeln sie sich: Sie verlieren seltene Wörter und besonders auffällige Lautungen, bleiben aber im Alltag erstaunlich lebendig.",
  "Besonders deutlich zeigt sich das bei jungen Leuten. [2] ___ Viele wechseln mühelos zwischen beiden Sprachformen, je nachdem, mit wem sie gerade sprechen.",
  "Dabei galt Dialekt lange als Zeichen mangelnder Bildung. [3] ___ Studien belegen inzwischen, dass Kinder, die mit einer Mundart aufwachsen, sich in der Regel nicht schlechter ausdrücken, oft sogar sicherer.",
  "Auch in der Öffentlichkeit ist der Ton milder geworden. [4] ___ Sie setzen die Mundart gezielt ein, um Nähe zu schaffen, etwa in der Werbung einer Brauerei oder im Liedtext einer Popband.",
  "Skeptiker weisen jedoch darauf hin, dass nicht jeder Dialekt gleich gute Chancen hat. [5] ___ Für sie sinkt die Zahl der Sprecher spürbar, und ohne Weitergabe in den Familien ist ihre Zukunft ungewiss.",
  "Sprachwissenschaftler erwarten deshalb weniger ein Verschwinden als einen dauerhaften Wandel.",
]);

const rPausen = forText(R_PAUSEN.key);
const rReparatur = forText(R_REPARATUR.key);
const rWeiterbildung = forText(R_WEITERBILDUNG.key);
const rKi = forText(R_KI.key);
const rBaeume = forText(R_STADTBAEUME.key);
const rMuseum = forText(R_MUSEUM.key);
const rGeno = forText(R_GENOSSENSCHAFT.key);
const rFoto = forText(R_FOTOKURSE.key);
const rLaufen = forText(R_LAUFEN.key);
const rBiber = forText(R_BIBER.key);
const rDialekt = forText(R_DIALEKT.key);

const readingItems: SeedItem[] = [
  // Pausen
  rPausen.choice("vocabulary", "EASY", "Welches Wort passt in Lücke (1)?",
    "stieg", ["nahm", "legte", "kam"], 2,
    "„ansteigen“: Die Fehlerquote stieg an. „Zunehmen“ und „zulegen“ bräuchten die Partikel „zu“, „annehmen“, „anlegen“ und „ankommen“ ergeben mit „Fehlerquote“ keinen Sinn."),
  rPausen.choice("vocabulary", "MID", "Welches Wort passt in Lücke (2)?",
    "zurück", ["heraus", "hervor", "hinauf"], 0,
    "Feste Verbindung „etwas auf etwas zurückführen“ (= als Ursache nennen). Mit „heraus“, „hervor“ oder „hinauf“ entsteht kein Verb, das zu „auf die begrenzte Kapazität“ passt."),
  rPausen.choice("detail", "MID", "Was stellte die Studie unter anderem fest?",
    "Wer ohne Pause arbeitete, hielt die eigene Leistung trotz zunehmender Fehler für gut.",
    [
      "Wer regelmäßig Pausen machte, arbeitete am Vormittag schon deutlich fehlerfreier als die anderen.",
      "Wer ohne Pause arbeitete, merkte am Nachmittag selbst, dass die Genauigkeit nachließ.",
      "Wer in der Pause spazieren ging, machte anschließend weniger Fehler als nach jeder anderen Pause.",
    ], 3,
    "Absatz 2: Die Durcharbeitenden „merkten kaum etwas“ und schätzten ihre Leistung „bis zuletzt als gut ein“. Am Vormittag war die Fehlerquote in beiden Gruppen nahezu gleich. Der Spaziergang wird in Absatz 3 nur als wirksamer als Handy oder E-Mail genannt, nicht als Ergebnis der Studie; auch kurze Pausen von wenigen Minuten wirken."),
  rPausen.tfng("inference", "HARD",
    [
      ["Wer ohne Unterbrechung arbeitete, bemerkte den Leistungsabfall am Nachmittag rasch und stellte sich darauf ein.", "F"],
      ["Wer erst aufhört, wenn er sich bereits stark erschöpft fühlt, braucht danach deutlich mehr Zeit zur Erholung.", "R"],
      ["Die Büroangestellten erhielten für die Teilnahme an der Untersuchung eine Bezahlung von ihren Arbeitgebern.", "NG"],
      ["Wer in der Pause Nachrichten auf dem Handy liest, erholt sich dabei ebenso gut wie bei einem Spaziergang.", "F"],
    ],
    "1 F: Absatz 2, die Betroffenen „merkten kaum etwas“ und hielten ihre Leistung für gut. 2 R: Absatz 3, wer erst bei deutlich spürbarer Erschöpfung aufhört, braucht „erheblich länger“ für die Rückkehr zur vollen Leistung. 3 NG: Die Teilnehmenden und ihre Aufgaben werden beschrieben, eine Bezahlung wird nicht erwähnt. 4 F: Absatz 3, Handy und Nachrichten beanspruchen dieselben geistigen Funktionen wie die Arbeit, ein Spaziergang ist „deutlich wirksamer“."),

  // Reparatur
  rReparatur.choice("gist", "MID", "Welche Aussage fasst den Text am besten zusammen?",
    "Die neuen Vorschriften erleichtern Reparaturen, lassen aber Preise, Nachwuchsmangel und Gewohnheiten weiter ungelöst.",
    [
      "Die neuen Vorschriften machen Reparaturen für Verbraucher künftig günstiger als den Kauf neuer Geräte.",
      "Die Hersteller begrüßen die Vorschriften, weil sich mit Ersatzteilen und Reparaturdiensten mehr verdienen lässt.",
      "Reparaturen scheitern heute vor allem am Willen der Verbraucher und weniger an Teilen oder Preisen.",
    ], 1,
    "Der Text beschreibt die neuen Pflichten und danach offene Probleme: Preise, Kosten und Bedenken der Hersteller, Nachwuchs im Handwerk, Gewohnheiten. Die Preise werden gerade nicht geregelt; die Hersteller verweisen auf Kosten und Risiken; schon der erste Absatz sagt, das Problem liege „nicht unbedingt an mangelndem Willen“."),
  rReparatur.choice("detail", "EASY", "Was kritisieren die Umweltverbände an den neuen Vorschriften vor allem?",
    "Sie regeln die Verfügbarkeit von Ersatzteilen, aber nicht, wie viel diese kosten dürfen.",
    [
      "Sie gelten zunächst nur für Smartphones und Waschmaschinen, aber nicht für Kühlschränke.",
      "Sie verbieten keine Software, die freie Werkstätten von der Reparatur ausschließt.",
      "Sie verpflichten die Hersteller nicht, Reparaturanleitungen zugänglich zu machen.",
    ], 0,
    "Absatz 3: Geregelt wird die Verfügbarkeit, „nicht aber deren Preis“. Die anderen Optionen widersprechen Absatz 2: Dort sind Kühlschränke genannt, die Software-Sperre wird untersagt, Anleitungen werden Pflicht."),
  rReparatur.choice("inference", "HARD", "Was lässt sich über die finanziellen Zuschüsse sagen, die einige Länder zahlen?",
    "Ob die Zuschüsse zusätzliche Reparaturen auslösen, ist bisher nicht sicher zu sagen.",
    [
      "Sie haben bisher kaum jemanden dazu bewegt, ein defektes Gerät reparieren zu lassen.",
      "Sie werden in den betreffenden Ländern vor allem von den Herstellern der Geräte bezahlt.",
      "Sie gelten inzwischen als wichtigste Maßnahme, auf die sich die Länder Europas geeinigt haben.",
    ], 2,
    "Absatz 3: Die Zahl der Reparaturen steigt, „wobei unklar bleibt, wie viele dieser Reparaturen ohnehin stattgefunden hätten“. Der tatsächliche Effekt ist also offen. Zur Finanzierung durch die Hersteller und zu einer europaweiten Einigung steht nichts im Text."),
  rReparatur.tfng("detail", "MID",
    [
      ["Cafés, in denen Ehrenamtliche beim Reparieren helfen, werden in den meisten Städten von der Kommune bezuschusst.", "NG"],
      ["Software, die ausschließlich Originalteile zulässt und freie Werkstätten dadurch ausbremst, soll künftig nicht mehr erlaubt sein.", "R"],
      ["Die Umweltverbände lehnen die neuen Vorschriften grundsätzlich ab.", "F"],
      ["Bei komplizierter Elektronik können Cafés mit freiwilligen Helfern eine Fachwerkstatt nicht ersetzen.", "R"],
    ],
    "1 NG: Reparaturcafés werden beschrieben (Absatz 6), von einer Förderung durch Kommunen ist keine Rede. 2 R: Absatz 2, Hersteller dürfen unabhängige Werkstätten nicht durch technische Tricks wie Software, die nur Originalteile akzeptiert, ausschließen. 3 F: Absatz 3, die Verbände „begrüßen die Regeln grundsätzlich“, halten sie aber für unzureichend. 4 R: Absatz 6, solche Initiativen können professionelle Werkstätten nicht ersetzen, bei komplexer Elektronik stoßen die Ehrenamtlichen schnell an ihre Grenzen."),

  // Weiterbildung
  rWeiterbildung.match("structure", "HARD",
    "Welcher Satz passt in welche Lücke? Zwei Sätze passen nicht.",
    ["Lücke [1]", "Lücke [2]", "Lücke [3]", "Lücke [4]"],
    [
      "Digitale Lernangebote haben in den letzten Jahren stark zugenommen.",
      "Gegen diesen Gedanken ist im Grundsatz nichts einzuwenden, nur die Umsetzung ist fragwürdig.",
      "Es spricht deshalb einiges dafür, Lernzeiten fest in den Arbeitsalltag einzuplanen.",
      "Ausgerechnet sie wären auf neues Wissen am stärksten angewiesen.",
      "Kritiker bemängeln, dass Zertifikate aus Kursen auf dem Arbeitsmarkt oft kaum beachtet werden.",
      "Doch wer abends einen Kurs besuchen soll, muss dafür erst einmal Kraft und freie Zeit haben.",
    ],
    [2, 6, 4, 3],
    "[1] Der Einwand („im Grundsatz nichts einzuwenden, nur ...“) bereitet das „nämlich“ des Folgesatzes vor: Die Verantwortung wird abgeladen. [2] „Doch“ setzt die Kosten- und Zeitfrage fort, der Folgesatz nennt Gruppen mit wenig Zeit. [3] „Sie“ bezieht sich auf die Beschäftigten in einfachen Tätigkeiten; „beiden Gruppen“ im Folgesatz setzt diese Aussage voraus. [4] „deshalb“ zieht die Folgerung aus den Vorteilen für Unternehmen; der nächste Satz spricht von „Lernzeit als Arbeitszeit“. Der Satz zu digitalen Angeboten und der zu den Zertifikaten sind zum Thema passend, schließen aber an keiner der vier Stellen an."),
  rWeiterbildung.choice("inference", "MID", "Welche Position vertritt der Kommentar?",
    "Unternehmen sollten Weiterbildung als gemeinsame Aufgabe verstehen und Lernzeit ausdrücklich in der Arbeitszeit einplanen.",
    [
      "Beschäftigte sollten gesetzlich zu regelmäßiger Weiterbildung verpflichtet werden, damit niemand zurückbleibt.",
      "Weiterbildung muss Sache der Einzelnen bleiben, weil nur sie ihren eigenen Bedarf genau einschätzen können.",
      "Der Begriff des lebenslangen Lernens sollte aufgegeben werden, weil er vor allem Druck erzeugt.",
    ], 3,
    "Absatz 6 und Schluss: Lernzeit als Arbeitszeit, Investition für beide Seiten; wer Lernen fordert, muss Bedingungen schaffen. Zwang wird ausdrücklich abgelehnt („niemand gezwungen“); die Verantwortung der Beschäftigten ist nur ein Teil; den Begriff kritisiert der Text, er will ihn nicht abschaffen."),
  rWeiterbildung.choice("vocabulary", "EASY", "Was bedeutet „auf der Strecke bleiben“ im dritten Absatz?",
    "nicht mehr mithalten können und den Anschluss verlieren",
    [
      "unterwegs eine Pause einlegen und dann weitermachen",
      "im alten Betrieb bleiben und keine neue Stelle suchen",
      "sich gegen den Wandel wehren und alle Neuerungen blockieren",
    ], 1,
    "Idiom „auf der Strecke bleiben“ = scheitern, zurückbleiben. Der Kontext (wachsende Kluft, Risiko beim technologischen Wandel) stützt diese Bedeutung. Die anderen Optionen lesen die Wendung wörtlich oder passen nicht zur Rolle der Betroffenen."),
  rWeiterbildung.tfng("detail", "MID",
    [
      ["Wenn die Wirtschaft schlecht läuft, werden Weiterbildungsangebote in vielen Betrieben als Erstes gekürzt.", "R"],
      ["Ein Seminar zum Zeitmanagement bringt wenig, solange sich an den Abläufen im Betrieb nichts ändert.", "R"],
      ["Der Autor meint, Lernplattformen lösten das Zeitproblem der Beschäftigten, weil man dort jederzeit lernen kann.", "F"],
    ],
    "1 R: Absatz 2 („in schlechten als Erstes streicht“). 2 R: Absatz 4, das Wochenendseminar verändert „oft wenig“, wenn die Abläufe gleich bleiben. 3 F: Absatz 5, die Plattformen verlagern das Lernen „in die Randzeiten des Tages“ und ersetzen keine eigene Lernzeit."),

  // KI-Auswahl
  rKi.match("gist", "MID",
    "Welche Aussage passt zu welcher Person? Eine Aussage passt zu keiner Person.",
    [
      "Wenn sich sehr viele Menschen auf eine Stelle bewerben, hilft ein Programm bei der ersten Sichtung.",
      "Wer sich bewirbt, sollte wissen, ob ein Mensch oder ein System die Unterlagen beurteilt.",
      "Wer seine Unterlagen nur nach Stichwörtern ausrichtet, fällt spätestens im persönlichen Gespräch auf.",
      "Programme zur Vorauswahl sollten gesetzlich untersagt werden.",
    ],
    ["A: Miriam Kessler", "B: Tobias Hahn", "C: Leyla Aksoy", "D: Jonas Weber", "keine der Personen"],
    [2, 3, 4, 5],
    "1 → B (mehrere Hundert Bewerbungen, ohne Unterstützung kaum zu bewältigen). 2 → C (Information der Bewerbenden „unverzichtbar“). 3 → D (spätestens im Vorstellungsgespräch fällt fehlende Substanz auf). 4 → niemand fordert ein Verbot; C sagt ausdrücklich, ihr Argument richte sich nicht gegen solche Systeme."),
  rKi.choice("detail", "MID", "Unter welcher Voraussetzung kann Software laut Miriam Kessler zu gerechteren Entscheidungen beitragen?",
    "wenn ihre Ergebnisse regelmäßig darauf geprüft werden, ob bestimmte Gruppen benachteiligt sind",
    [
      "wenn sie zusätzlich Fotos und Namen der Bewerbenden auswertet, um ein vollständigeres Bild zu bekommen",
      "wenn sie aus den früheren Einstellungen des Unternehmens lernt und deren Muster fortführt",
      "wenn sie die endgültige Entscheidung trifft, damit persönliche Vorlieben keine Rolle mehr spielen",
    ], 3,
    "Text A: Nur bei regelmäßiger Überprüfung, ob Gruppen systematisch schlechter abschneiden. Die Entscheidung soll beim Menschen bleiben; Fotos und Namen sind gerade die Störfaktoren; das Lernen aus alten Entscheidungen kritisiert Leyla Aksoy (C)."),
  rKi.choice("inference", "HARD", "Worin stimmen Miriam Kessler und Leyla Aksoy überein?",
    "Programme können bestimmte Gruppen benachteiligen, wenn niemand ihre Ergebnisse genau kontrolliert.",
    [
      "Menschen urteilen bei der Personalauswahl grundsätzlich fairer als jede Software.",
      "Bewerbende sollten ihre Unterlagen gezielt an die Stichwörter der Software anpassen.",
      "Videointerviews sollten in Unternehmen grundsätzlich nicht automatisch ausgewertet werden.",
    ], 2,
    "A verlangt Kontrollen, ob Gruppen „systematisch schlechter abschneiden“; C warnt, dass Software alte Bevorzugungen „weniger sichtbar“ fortsetzt. Beide halten Software nicht für schlechter als Menschen; Anpassung an Software thematisiert D, Videointerviews B."),
  rKi.tfng("detail", "EASY",
    [
      ["Nach Ansicht von Miriam Kessler darf eine Software die Auswahl unterstützen, aber nicht endgültig entscheiden.", "R"],
      ["Leyla Aksoy lehnt den Einsatz lernender Systeme in der Personalauswahl grundsätzlich ab.", "F"],
      ["Das Unternehmen von Tobias Hahn hat die Software für die Sichtung der Unterlagen bei einem externen Anbieter gekauft.", "NG"],
    ],
    "1 R: Text A, die Entscheidung „muss in jedem Fall bei einem Menschen liegen“. 2 F: Text C, ihre Kritik sei „kein Argument gegen solche Systeme“, sondern eines für mehr Transparenz. 3 NG: Text B nennt die Software und ihren Nutzen, woher sie stammt, steht nicht im Text."),

  // Stadtbäume
  rBaeume.choice("detail", "MID", "Wovon hängt die kühlende Wirkung eines Stadtbaums nach der Untersuchung vor allem ab?",
    "davon, ob der Baum genug Wasser bekommt und an heißen Tagen viel davon verdunsten kann",
    [
      "davon, wie dicht seine Krone ist und wie viel Schatten sie auf Straße und Fassaden wirft",
      "davon, wie jung der Baum ist und wie schnell er in den ersten Jahren in die Höhe wächst",
      "davon, ob die Häuser in der Umgebung hell gestrichen sind und Sonnenlicht zurückwerfen",
    ], 0,
    "Absatz 1 und 2: Entscheidend sei „weniger der Schatten als die Verdunstung“, und der Effekt hänge von der Wasserversorgung ab. Junge Pflanzungen entfalten ihre Wirkung erst nach Jahrzehnten; helle Fassaden sind in der Untersuchung gerade kein Ersatz für Bäume."),
  rBaeume.choice("inference", "MID", "Was raten die Forschenden den Städten?",
    "zuerst die vorhandenen alten Bäume zu schützen, bevor sie viele junge Bäume pflanzen",
    [
      "überall sofort Schwammstraßen zu bauen, weil sich deren Nutzen bereits eindeutig belegen lässt",
      "bevorzugt junge Bäume zu pflanzen, weil diese schneller und stärker kühlen als alte Bäume",
      "vor allem die Fassaden hell zu streichen, weil dadurch der Wasserbedarf der Bäume sinkt",
    ], 2,
    "Letzter Satz: „zunächst vorhandene Altbäume zu schützen, statt allein auf junge Pflanzungen zu setzen“. Ob sich Schwammstraßen bezahlt machen, sei „noch offen“; junge Bäume wirken erst nach Jahrzehnten; helle Fassaden werden nur als Vergleichswert erwähnt."),

  // Museum
  rMuseum.choice("detail", "EASY", "Was ist seit der Abschaffung des Eintritts geschehen?",
    "Es kommen mehr Menschen, und ein Teil der fehlenden Einnahmen wird anderweitig ausgeglichen.",
    [
      "Die Besucherzahl hat sich verdoppelt, und die Gesamteinnahmen des Museums sind trotzdem gestiegen.",
      "Das Publikum ist im Wesentlichen gleich geblieben, doch die Gäste bleiben jetzt deutlich länger.",
      "Die Zahl der Stammgäste ist gestiegen, weil es jetzt häufiger spontane Führungen gibt.",
    ], 1,
    "Absatz 1: Die Besucherzahl stieg „um knapp die Hälfte“ (nicht verdoppelt), die Ticketeinnahmen fielen weg und wurden „zum Teil“ durch Café und Spenden aufgefangen. Absatz 2: Die Neuen bleiben kürzer und kommen seltener wieder."),
  rMuseum.choice("inference", "MID", "Wie reagiert die Direktorin auf den Einwand der Kritiker?",
    "Sie weist ihn zurück, räumt aber ein, dass sich Besucher schwerer an das Haus binden lassen.",
    [
      "Sie stimmt den Kritikern zu und will den Eintritt in absehbarer Zeit wieder einführen.",
      "Sie bestreitet, dass die Besucherbefragung eine kürzere Aufenthaltsdauer der Neuen zeigt.",
      "Sie hält den Einwand für berechtigt, weil kostenlose Angebote grundsätzlich weniger genutzt werden.",
    ], 0,
    "Absatz 3: Wertschätzung lasse sich „nicht am Preis ablesen“ (Zurückweisung), aber das Museum müsse „stärker um Stammgäste werben“ (Eingeständnis eines Bindungsproblems). Eine Rückkehr zum Eintritt ist nicht erwähnt; die Befragung wird nicht bestritten."),

  // Genossenschaft
  rGeno.choice("detail", "MID", "Was nennt die Verfasserin als Gegenleistung für die vergleichsweise niedrige Miete?",
    "Die Bewohner müssen sich an Entscheidungen beteiligen und Aufgaben in der Gemeinschaft übernehmen.",
    [
      "Die Bewohner müssen beim Auszug einen Teil ihres Anteils dauerhaft in der Genossenschaft lassen.",
      "Die Bewohner müssen für Garten und Gemeinschaftsräume zusätzlich zur Miete einen festen Betrag zahlen.",
      "Die Bewohner müssen damit rechnen, dass die Miete nach jeder Versammlung schrittweise angehoben wird.",
    ], 1,
    "Absatz 3: „Der Preis dafür ist, dass man mitreden muss“ (Versammlung, Arbeitsgruppen). Der Anteil wird beim Auszug zurückgezahlt; zusätzliche Beträge werden nicht genannt; Mieterhöhungen brauchen die Zustimmung der Mitglieder."),
  rGeno.choice("inference", "HARD", "Für wen ist das Modell nach der Einschätzung der Verfasserin weniger geeignet?",
    "für Menschen, die voraussichtlich in absehbarer Zeit wieder umziehen müssen",
    [
      "für Menschen, die sich in Konflikten lieber zurückhalten und Streit meiden",
      "für Menschen, die dringend auf eine dauerhaft niedrige und stabile Miete angewiesen sind",
      "für Menschen, die gern in Gärten arbeiten und Gemeinschaft ausdrücklich suchen",
    ], 3,
    "Letzter Absatz: Wer häufig umzieht, sollte es sich überlegen, weil der Anteil Geld bindet und die Wartelisten lang sind. Konflikte sieht die Verfasserin eher als Vorteil (sie kommen früh zur Sprache); der Anteil wird eingezahlt und zurückgezahlt, nicht umgekehrt; Garten-Arbeitsgruppen werden positiv erwähnt."),

  // Fotokurse
  rFoto.match("detail", "HARD",
    "Welcher Kurs passt zu welcher Person? Zwei Kurse passen zu niemandem.",
    [
      "Herr Berger besitzt eine Kamera und will lernen, sie manuell einzustellen. Unter der Woche hat er abends keine Zeit, nur am Wochenende kann er teilnehmen.",
      "Frau Köhler besitzt keine Kamera und will auch keine kaufen. Ihre Alltagsfotos möchte sie trotzdem verbessern, und sie kann sich dafür nur einen einzigen Vormittag freinehmen.",
      "Herr Lindner fotografiert seit Jahren regelmäßig und will seine vorhandenen Aufnahmen nachträglich aufwerten. Ein leistungsfähiger Computer steht ihm zu Hause nicht zur Verfügung.",
      "Frau Schulz möchte lernen, Menschen professionell zu fotografieren. Sie hat weder Vorkenntnisse noch Ausrüstung und kann nur abends.",
    ],
    [
      "A: Naturfotografie mit der Spiegelreflexkamera",
      "B: Fotografieren im Moor",
      "C: Bessere Bilder im Alltag",
      "D: Bildbearbeitung für Fotofreunde",
      "E: Porträts im Atelier",
      "F: Analoge Fotografie und Dunkelkammer",
    ],
    [2, 3, 4, 5],
    "1 → B: Eigene Kamera und manuelle Einstellungen (Blende, Belichtungszeit) passen zu A und B, nur B liegt am Wochenende (A dienstagabends). 2 → C: Ohne eigene Kamera kommen C, E (Ausrüstung leihbar) und F (Filmkameras gestellt) in Frage, nur C dauert genau einen Vormittag. 3 → D: nachträgliche Bearbeitung mit Rechnern im Schulungsraum. 4 → E: Porträts im Studio, Ausrüstung leihbar, keine Vorkenntnisse, donnerstagabends. A und F bleiben übrig."),

  // Laufen: insertion of five paragraphs (5 of 7), then Ja / Nein
  rLaufen.match("structure", "HARD",
    "Welcher Absatz passt in welche Lücke? Zwei Absätze passen nicht.",
    ["Lücke [1]", "Lücke [2]", "Lücke [3]", "Lücke [4]", "Lücke [5]"],
    [
      "Der erste Marathon der Neuzeit wurde 1896 in Athen ausgetragen. Seitdem hat sich die Strecke mehrfach geändert, bis sie 1921 auf 42,195 Kilometer festgelegt wurde.",
      "Die Folgen dieser Aufrüstung sind nicht zu unterschätzen. Wer sich ständig mit anderen vergleicht, überschreitet leichter die eigenen Grenzen. Mancher Hobbyläufer trainiert inzwischen nach einem Plan, der eher an einen Leistungssportler erinnert.",
      "Die Gründe für den Boom sind vielfältig. Viele Menschen suchen einen Ausgleich zum Alltag am Bildschirm, andere wollen etwas für ihre Gesundheit tun. Außerdem lässt sich der Sport bequem in den eigenen Tagesablauf einfügen.",
      "Die ersten organisierten Volksläufe in Deutschland fanden in den Sechzigerjahren statt. Damals nahmen oft nur ein paar Dutzend Unentwegte teil, die von Passanten neugierig beäugt wurden.",
      "Das zeigt, dass das Laufen längst auch ein Thema der Stadtplanung ist. Parks und Uferwege sollen künftig so gestaltet werden, dass Läufer, Radfahrer und Spaziergänger einander möglichst wenig stören. Das ist leichter gesagt als getan, denn der Platz ist begrenzt.",
      "Vor allem aber hat das Laufen eine soziale Seite, die lange unterschätzt wurde. In fast jedem Stadtteil haben sich Gruppen gegründet, die sich zu festen Zeiten treffen und gemeinsam durch die Straßen ziehen. Für manche Teilnehmende ist das Beisammensein wichtiger als die zurückgelegte Strecke.",
      "In einem Punkt sind sich die Fachleute dennoch einig: Entscheidend ist nicht das Tempo, sondern die Regelmäßigkeit. Wer mit kurzen Strecken beginnt und die Belastung langsam steigert, bleibt dem Sport meist über Jahre treu.",
    ],
    [3, 6, 2, 7, 5],
    "[1] Der Absatz nennt die Gründe für den Boom; „Dabei“ im Folgeabsatz knüpft an den bequemen Einstieg an. [2] „Vor allem aber ... soziale Seite“ führt zu „Gleichzeitig hat sich ... eine ganze Industrie entwickelt“. [3] „Aufrüstung“ greift die Ausrüstung aus dem Absatz davor auf, und „diese Entwicklung“ im Folgeabsatz bezieht sich darauf. [4] „dennoch“ antwortet auf die gemischten Gefühle der Mediziner und leitet zu den Kommunen über. [5] „Das zeigt“ bezieht sich auf die Maßnahmen und Beschwerden im Absatz davor. Der Marathon und die frühen Volksläufe sind Geschichte und knüpfen an keine Lücke an."),
  rLaufen.jaNein("detail", "MID",
    [
      ["Laut Text lässt sich das Laufen leichter beginnen als viele andere Sportarten.", "R"],
      ["Der Text nennt, wie viele Menschen in Deutschland regelmäßig laufen.", "NG"],
      ["Sportmediziner bewerten die Entwicklung des Laufens durchweg positiv.", "F"],
      ["Die Einrichtungen, die Städte für Läufer schaffen, werden von allen Anwohnern begrüßt.", "F"],
    ],
    "1 Ja: Absatz 3, kaum Ausrüstung, keine Mitgliedschaft, kein fester Termin. 2 nichts dazu: Es gibt keine Zahlen zu den Läuferinnen und Läufern. 3 Nein: Absatz 7, die Mediziner haben „gemischte Gefühle“. 4 Nein: Absatz 9, „nicht überall stößt das auf Begeisterung“, Anwohner beschweren sich."),

  // Biber: insertion of five sentences (5 of 7), then Ja / Nein
  rBiber.match("structure", "HARD",
    "Welcher Satz passt in welche Lücke? Zwei Sätze passen nicht.",
    ["Lücke [1]", "Lücke [2]", "Lücke [3]", "Lücke [4]", "Lücke [5]"],
    [
      "Der Biber ist das größte Nagetier Europas und kann bis zu dreißig Kilogramm wiegen.",
      "Durch die Dämme entstehen in begradigten Bächen wieder flache Wasserflächen und feuchte Wiesen.",
      "Dort kommen sich Mensch und Tier besonders nah, und angenagte Bäume können zur Gefahr werden.",
      "Erst gezielte Wiederansiedlungen und ein strenger Schutz ab den Sechzigerjahren ließen die Bestände langsam wieder wachsen.",
      "Biber ernähren sich ausschließlich von Rinde, Zweigen und Wasserpflanzen.",
      "Dabei setzen die meisten Fachleute zunächst auf Lösungen, bei denen das Tier bleiben darf.",
      "Seine Bauwerke sind imposant, haben aber ihren Preis.",
    ],
    [4, 7, 2, 6, 3],
    "[1] Nur die Wiederansiedlung erklärt den Sprung von den „kleinen Restbeständen“ zu „heute wieder mehr als dreißigtausend Tieren“. [2] „Bauwerke ... Preis“ führt zu „Wo ein Damm entsteht ...“. [3] „Wasserflächen und feuchte Wiesen“ werden mit „In solchen Tümpeln“ wieder aufgenommen. [4] „Dabei“ beantwortet die Frage nach dem Zusammenleben, das Rohr im Damm ist ein Beispiel für eine Lösung, bei der der Biber bleibt. [5] „Dort“ meint die Städte, „Deshalb kontrollieren ...“ nennt die Folge der Gefahr durch angenagte Bäume. Die Nahrung und die Größe des Tieres haben mit keiner Lücke zu tun."),
  rBiber.jaNein("detail", "MID",
    [
      ["Der Biber lebt in Deutschland bis heute nur in abgelegenen Flusstälern.", "F"],
      ["Einige Gemeinden gleichen Schäden aus, die der Biber bei Landwirten verursacht.", "R"],
      ["Man kann den Wasserstand an einem Damm senken, ohne dass der Biber seinen Bau verlässt.", "R"],
      ["Der Text sagt, wie viele Biber heute in deutschen Städten leben.", "NG"],
    ],
    "1 Nein: Absatz 1, die Tiere besiedeln auch die Ränder großer Städte. 2 Ja: Absatz 2, mehrere Gemeinden zahlen Entschädigungen an Landwirte. 3 Ja: Absatz 4, ein Rohr durch den Damm senkt den Wasserstand, ohne dass der Biber seinen Bau aufgibt. 4 nichts dazu: Genannt wird nur die Zahl für ganz Deutschland."),

  // Dialekt: insertion of five sentences (5 of 7), then Ja / Nein
  rDialekt.match("structure", "HARD",
    "Welcher Satz passt in welche Lücke? Zwei Sätze passen nicht.",
    ["Lücke [1]", "Lücke [2]", "Lücke [3]", "Lücke [4]", "Lücke [5]"],
    [
      "Vor allem kleine Mundarten in dünn besiedelten Regionen sind in Gefahr.",
      "Im Süden des Sprachraums sind die Unterschiede zwischen den Mundarten traditionell größer als im Norden.",
      "Sie sprechen in der Schule und im Alltag Standardsprache, im Freundeskreis aber häufig die Mundart ihrer Region.",
      "Sprachwissenschaftler unterscheiden allein im deutschen Sprachraum mehrere hundert Ortsdialekte.",
      "Diese Prognose hat sich bislang nur teilweise bewahrheitet.",
      "Radiosender, Zeitungen und Unternehmen entdecken zunehmend den Wert des regionalen Klangs.",
      "Lehrkräfte rieten Eltern früher häufig, zu Hause nur Hochdeutsch zu sprechen.",
    ],
    [5, 3, 7, 6, 1],
    "[1] „Diese Prognose“ greift die Voraussage auf; „Statt zu verschwinden“ nennt, was stattdessen geschieht. [2] „Sie“ sind die jungen Leute, „beiden Sprachformen“ im Folgesatz sind Standardsprache und Mundart. [3] „früher“ steht im Gegensatz zu „Studien belegen inzwischen“. [4] „Sie setzen die Mundart gezielt ein“ gehört zu Radiosendern, Zeitungen und Unternehmen. [5] „Für sie“ bezieht sich auf die kleinen Mundarten. Die Zahl der Ortsdialekte und der Nord-Süd-Unterschied passen an keine Stelle."),
  rDialekt.jaNein("detail", "MID",
    [
      ["Der Text nennt den Anteil der Jugendlichen, die regelmäßig Dialekt sprechen.", "NG"],
      ["Kinder, die mit einer Mundart aufwachsen, drücken sich laut Text meist unsicherer aus.", "F"],
      ["Nach Ansicht der Skeptiker sind nicht alle Dialekte gleichermaßen in ihrem Bestand gesichert.", "R"],
    ],
    "1 nichts dazu: Prozentzahlen werden nicht genannt. 2 Nein: Absatz 3, Kinder mit Mundart drücken sich „nicht schlechter, oft sogar sicherer“ aus. 3 Ja: Absatz 5, „nicht jeder Dialekt hat gleich gute Chancen“."),
];

// ---------------------------------------------------------------- LISTENING

type LSkill = "gist" | "detail" | "attitude" | "inference";

function clip(
  slug: string,
  title: string,
  topic: string,
  speakers: Array<{ label: string; voice: "A" | "B" }>,
  lines: string[],
): SeedStimulus {
  return { key: `v2-l-c1-${slug}`, section: "LISTENING", level: LEVEL, title, topic, speakers, body: lines.join("\n") };
}

function forClip(stimulusKey: string) {
  const base = (skill: LSkill, within: Within, prompt: string, explanation: string) => ({
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
      skill: LSkill,
      within: Within,
      prompt: string,
      correct: string,
      distractors: [string, string, string],
      pos: Pos,
      explanation: string,
    ): SeedItem {
      return { ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...placeOptions(correct, distractors, pos) };
    },
    tfng(skill: LSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      const ids = statements.map((_, i) => `s${i + 1}`);
      return {
        ...base(skill, within, "Richtig (R), falsch (F) oder wird nicht gesagt (NG)?", explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", statements: statements.map(([t], i) => ({ id: ids[i], text: t })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, a], i) => [ids[i], a])) },
      };
    },
    /** Note taking: one typed gap per entry of `answers`, each with every accepted spelling. */
    notes(skill: LSkill, within: Within, prompt: string, answers: string[][], explanation: string): SeedItem {
      const ids = answers.map((_, i) => `g${i + 1}`);
      return {
        ...base(skill, within, prompt, explanation),
        type: "GAP_FILL",
        content: { kind: "GAP", gaps: ids.map((id) => ({ id })) },
        key: { kind: "GAP", answers: Object.fromEntries(ids.map((id, i) => [id, answers[i]])) },
      };
    },
    match(
      skill: LSkill,
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

// Clip 1: expert interview (Goethe C1 Hören Teil 2 style).
const L_QUEREINSTIEG = clip("quereinstieg-v3", "Interview: Quereinstieg als Strategie", "Arbeit und Arbeitsmarkt",
  [
    { label: "Moderator", voice: "B" },
    { label: "Frau Hartmann", voice: "A" },
  ],
  [
    "Moderator: Willkommen zu „Arbeitswelt aktuell“. Heute geht es um Quereinsteiger, also um Leute, die in einem Beruf arbeiten, den sie ursprünglich gar nicht gelernt haben. Bei mir im Studio ist die Arbeitsmarktforscherin Svenja Hartmann. Frau Hartmann, ist der Quereinstieg nicht eher eine Notlösung?",
    "Frau Hartmann: Na ja, am Anfang war er das oft. Wenn auf eine Stelle keine einzige passende Bewerbung kommt, wird man eben flexibel. Aber das hat sich geändert. Viele Betriebe setzen heute ganz bewusst auf Quereinsteiger, und zwar nicht nur, weil Fachkräfte fehlen. Diese Leute bringen oft eine Sicht mit, die im Team bisher gefehlt hat.",
    "Moderator: Haben Sie ein Beispiel?",
    "Frau Hartmann: Klar. Eine ehemalige Erzieherin, die jetzt in der Softwareentwicklung arbeitet. Sie kann komplizierte Dinge erklären, ohne dass sich jemand dumm vorkommt. Das ist in der IT, ach, wie soll ich sagen, nicht gerade selbstverständlich. Gerade wenn Entwickler eng mit Kunden zusammenarbeiten, ist das Gold wert.",
    "Moderator: Klappt das in jeder Branche?",
    "Frau Hartmann: Nein. Gut klappt es dort, wo man viel in der Praxis lernt, also in der IT oder im Handwerk. Schwierig wird es bei Berufen mit staatlicher Anerkennung. Da kommt man an einem formalen Abschluss einfach nicht vorbei.",
    "Moderator: Und wo hakt es sonst? Das klingt ja fast zu schön.",
    "Frau Hartmann: Die größte Hürde ist, anders als viele denken, nicht die Einarbeitung. Die schafft man mit guten Programmen in ein, zwei Jahren. Schwierig ist das Geld. Viele verdienen anfangs deutlich weniger als in ihrem alten Beruf, jedenfalls wenn sie dort schon Erfahrung hatten. Das muss man sich erst mal leisten können. Und dann gibt es noch etwas, worüber kaum jemand spricht: Manche Teams nehmen die Neuen nicht ernst. Da heißt es dann schnell: Die hat ja nicht mal Informatik studiert.",
    "Moderator: Was können Betriebe dagegen tun?",
    "Frau Hartmann: Einiges. Am besten funktioniert eine feste Ansprechperson im Team. Nicht die Chefin, nicht der Chef, sondern jemand auf derselben Ebene, also eine erfahrene Kollegin oder ein Kollege. Wo es das gab, waren nach drei Jahren noch rund vier von fünf Quereinsteigern im Betrieb. Ohne diese Begleitung war es nur gut die Hälfte. Also: vier von fünf mit Begleitung, gut die Hälfte ohne.",
    "Moderator: Würden Sie denn jedem raten, den Schritt zu wagen?",
    "Frau Hartmann: Jedem? Nein, nicht jedem. Wer sich wirklich für ein neues Feld interessiert und eine knappe Anfangszeit finanziell durchhalten kann, hat heute bessere Chancen als je zuvor. Wer dagegen nur schnell mehr Gehalt will, wird wahrscheinlich enttäuscht.",
  ],
);

// Clip 2: lecture with two questions from the audience (Goethe C1 Hören Teil 4 style).
const L_GRUPPEN = clip("gruppenentscheidungen-v3", "Vortrag: Wann Gruppen gut entscheiden", "Psychologie und Arbeit",
  [
    { label: "Dozent", voice: "B" },
    { label: "Studentin", voice: "A" },
  ],
  [
    "Dozent: Guten Morgen zusammen. Heute geht es um eine Annahme, die fast jede Organisation für selbstverständlich hält: dass Gruppen bessere Entscheidungen treffen als Einzelne.",
    "Dozent: Auf den ersten Blick spricht ja auch einiges dafür. Mehr Köpfe, mehr Wissen, man deckt gegenseitig Fehler auf, und was gemeinsam beschlossen wird, tragen hinterher meist alle mit. Die Forschung zeigt aber: Diese Vorteile stellen sich nur unter bestimmten Bedingungen ein.",
    "Dozent: Fangen wir mit dem Gruppendenken an. Gemeint ist die Tendenz, möglichst schnell Einigkeit herzustellen. Wer Zweifel hat, behält sie für sich, um die Stimmung nicht zu stören. Am Ende sieht es nach Übereinstimmung aus, aber in Wirklichkeit denken alle etwas anderes. Und jetzt kommt das Überraschende: Das passiert besonders oft in Gruppen, die sich gut verstehen und schon lange zusammenarbeiten. Also ausgerechnet der Zusammenhalt, den wir sonst für etwas Gutes halten, wird dann zum Problem.",
    "Dozent: Besonders aufschlussreich finde ich eine Reihe von Experimenten. Jedes Gruppenmitglied bekam vorab andere Informationen. Um die richtige Lösung zu finden, hätten alle ihr Wissen zusammentragen müssen. Und was passierte? Die Gruppen redeten fast nur über das, was ohnehin alle wussten. Was nur eine Person wusste, kam kaum zur Sprache. Viele Gruppen verfehlten deshalb die beste Lösung, obwohl sie gemeinsam alle nötigen Informationen hatten.",
    "Studentin: Entschuldigung, darf ich kurz nachfragen? Woran liegt das denn?",
    "Dozent: Gute Frage. Eine naheliegende Erklärung ist: Geteiltes Wissen wird bestätigt. Wenn ich etwas sage, was alle wissen, nicken die anderen, und ich wirke kompetent. Bringe ich dagegen etwas ein, das nur ich weiß, kann es niemand bestätigen, und ich wirke vielleicht unsicher. Also hält man sich lieber an das Bekannte.",
    "Studentin: Und dann hilft es doch, einfach länger zu diskutieren, oder?",
    "Dozent: Nur bedingt. Das ist ein verbreiteter Gedanke, aber wirksamer sind nach heutigem Stand strukturelle Maßnahmen. Man kann zum Beispiel die Mitglieder bitten, ihre Einschätzung erst für sich aufzuschreiben, bevor diskutiert wird. Oder man bestimmt eine Person, die ausdrücklich Gegenargumente vorbringt. Diese Rolle sollte übrigens wechseln, sonst gilt jemand dauerhaft als Bremser.",
    "Dozent: Auch die Reihenfolge der Wortmeldungen zählt. Spricht die ranghöchste Person zuerst, schließen sich die anderen oft an, ohne es zu merken. Ich rate Führungskräften deshalb, sich zurückzuhalten und erst am Ende Stellung zu nehmen.",
    "Dozent: Damit keine Missverständnisse entstehen: Einzelentscheidungen sind nicht grundsätzlich besser. Gruppen haben großes Potenzial, aber sie schöpfen es nur aus, wenn die Bedingungen stimmen. Nächste Woche, ach nein, in der übernächsten Sitzung, schauen wir uns an, wie das in Online-Besprechungen aussieht.",
  ],
);

// Clip 3: radio discussion, reduced to two voices (Goethe C1 Hören Teil 3 style).
const L_GEHALT = clip("gehaltstransparenz-v3", "Diskussion: Sollen Gehälter offengelegt werden?", "Arbeit und Gesellschaft",
  [
    { label: "Frau Demir", voice: "A" },
    { label: "Herr Lorenz", voice: "B" },
  ],
  [
    "Frau Demir: Herr Lorenz, Sie wollen, dass Firmen offenlegen, was ihre Leute verdienen. Ehrlich gesagt, als Inhaberin eines kleinen Betriebs bekomme ich dabei Bauchschmerzen.",
    "Herr Lorenz: Das kann ich verstehen. Aber ich muss kurz etwas klarstellen: Niemand soll die Gehaltsabrechnung der Kollegen einsehen. Mir geht es um Gehaltsbänder. Für jede Stelle steht fest, zwischen welchem Mindest- und welchem Höchstbetrag das Gehalt liegt, und die Kriterien kennt jeder.",
    "Frau Demir: Na gut, das klingt schon weniger dramatisch. Trotzdem: In einem Betrieb mit zwölf Leuten weiß doch sofort jeder, wer gemeint ist. Und manche Gründe passen nun mal in keine Tabelle. Zum Beispiel, wenn jemand in einer schwierigen Phase geblieben ist, als andere gegangen sind.",
    "Herr Lorenz: Aber das kann man doch benennen! Betriebszugehörigkeit, besonderer Einsatz, das sind Kriterien. Das Problem entsteht erst, wenn solche Gründe unausgesprochen bleiben. Dann vermuten die Leute ganz andere Gründe, und die sind selten schmeichelhaft.",
    "Frau Demir: Hm. Und die, die bisher einfach besser verhandelt haben? Die wären dann die Verlierer.",
    "Herr Lorenz: Nicht unbedingt. Niemand verliert etwas. Aber wer künftig neu verhandelt, wird an denselben Kriterien gemessen wie alle anderen.",
    "Frau Demir: Das mag sein. Ich befürchte nur, dass die Offenlegung erst einmal vor allem Unruhe bringt. Wer erfährt, dass er am unteren Ende seines Bandes liegt, ist doch frustriert.",
    "Herr Lorenz: Kurzfristig ja, das bestreite ich gar nicht. Aber Firmen, die umgestellt haben, berichten: Nach etwa einem Jahr beruhigt sich das meistens. Und dann werden die Gespräche sachlicher. Man verhandelt nicht mehr darüber, wer am besten pokert, sondern darüber, was man konkret tun muss, um weiterzukommen.",
    "Frau Demir: Das gefällt mir, ehrlich gesagt. Gerade die Zurückhaltenden, die nie von sich aus nach mehr Geld fragen würden, hätten dann eine Chance. Aber per Gesetz für alle Betriebe gleich? Da bin ich nicht überzeugt. Für einen Konzern mit eigener Personalabteilung ist das etwas völlig anderes als für uns.",
    "Herr Lorenz: Da liegen wir gar nicht so weit auseinander. Ich könnte mir gut vorstellen, dass kleinere Betriebe mehr Zeit bekommen und Unterstützung bei der Einführung.",
  ],
);

// Clip 4: short lecture for note taking (content under time pressure).
const L_PHYSIO = clip("laerm-schlaf", "Kurzvortrag: Lärm und Schlaf", "Gesundheit und Lärm",
  [{ label: "Dozentin", voice: "A" }],
  [
    "Dozentin: Bei Verkehrslärm denken die meisten sofort an den Dauerpegel, also an den Mittelwert über die Nacht. Für den Schlaf entscheidend ist aber etwas anderes, nämlich einzelne laute Ereignisse, ein vorbeifahrender Lastwagen zum Beispiel oder ein Motorrad. Solche Lärmspitzen lösen Aufwachreaktionen aus, und zwar auch dann, wenn man sich am nächsten Morgen an nichts erinnert. Der Körper reagiert trotzdem, der Puls steigt.",
    "Dozentin: Viele Städte versuchen deshalb, genau diese Spitzen zu senken. Am häufigsten setzt man bei der Geschwindigkeit an: Nachts darf dann nur noch deutlich langsamer gefahren werden. Ob das tatsächlich hilft, hängt allerdings davon ab, ob sich jemand um die Einhaltung kümmert. Wo niemand misst und niemand bestraft, fährt die Mehrheit wie gewohnt weiter.",
    "Dozentin: Wer selbst etwas tun will, hat weniger Spielraum, als man denkt. Schallschutzfenster sind teuer und helfen nur, solange sie geschlossen bleiben. Wirksamer und oft kostenlos ist es, das Schlafzimmer in einen Raum zu verlegen, der nicht zur Straße liegt.",
  ],
);

// Clip 5: radio commentary with hedged argument.
const L_NACHTZUG = clip("nachtzug-kommentar", "Radiokommentar: Nachtzüge", "Reisen und Verkehr",
  [
    { label: "Moderator", voice: "B" },
    { label: "Frau Wolf", voice: "A" },
  ],
  [
    "Moderator: Nachtzüge sind wieder im Gespräch. Sie haben sich die Entwicklung angesehen, Frau Wolf, und sind skeptisch?",
    "Frau Wolf: Skeptisch würde ich nicht sagen, eher vorsichtig. Dass die Leute die Nachtzüge annehmen, ist ja unübersehbar: Auf der Strecke von Berlin nach Wien sind die Betten im Sommer Wochen vorher weg. Aber genau da liegt für mich der Haken. Die Nachfrage beweist zunächst nur, dass das Angebot knapp ist. Viele Wagen sind über vierzig Jahre alt, und wer neue bestellt, wartet Jahre. Solange das so bleibt, bleibt der Nachtzug ein Produkt für Leute, die früh planen.",
    "Moderator: Aber die Politik fördert doch.",
    "Frau Wolf: Ja, mit Anschubhilfen. Nur ersetzt eine Anschubhilfe keine Fabrik. Ich halte es für ehrlicher, nicht so zu tun, als stünde der Nachtzug kurz davor, den Flug zu verdrängen. Auf ein paar Strecken kann er eine echte Alternative werden. Mehr würde ich vorerst nicht erwarten.",
  ],
);

// Clip 6: advice call with hedged information.
const L_HEIZUNG = clip("mietminderung-beratung", "Beratungsgespräch: Heizungsausfall und Miete", "Wohnen und Recht",
  [
    { label: "Herr Berger", voice: "B" },
    { label: "Frau Kramer", voice: "A" },
  ],
  [
    "Herr Berger: Guten Tag. Bei uns funktioniert seit zehn Tagen die Heizung nicht, und mein Vermieter hat schon zweimal einen Handwerker versprochen, aber es kam niemand. Kann ich einfach weniger Miete zahlen?",
    "Frau Kramer: Grundsätzlich ja, aber der Teufel steckt im Detail. Eine Minderung setzt voraus, dass Sie dem Vermieter den Mangel gemeldet haben, und zwar so, dass Sie es auch belegen können. Haben Sie das schriftlich?",
    "Herr Berger: Ehrlich gesagt nur telefonisch.",
    "Frau Kramer: Dann würde ich noch heute eine E-Mail schicken und darin die bisherigen Anrufe mit Datum aufführen. Das ersetzt die Meldung nicht, aber es dokumentiert sie. Zur Höhe kann ich Ihnen keine feste Zahl nennen. Das hängt davon ab, wie stark Ihre Wohnung betroffen ist und wie kalt es draußen ist. Bei einem Totalausfall im Winter geht es um deutlich mehr als bei einer Wohnung, die zwar kühl, aber noch nutzbar bleibt.",
    "Herr Berger: Dann ziehe ich einfach einen Betrag ab, der mir angemessen erscheint.",
    "Frau Kramer: Das würde ich Ihnen nicht raten. Zahlen Sie lieber unter Vorbehalt und lassen Sie die Höhe prüfen. Wenn Sie zu viel einbehalten, riskieren Sie im schlimmsten Fall eine Kündigung wegen Zahlungsrückstands.",
  ],
);

const lQuer = forClip(L_QUEREINSTIEG.key);
const lGruppen = forClip(L_GRUPPEN.key);
const lGehalt = forClip(L_GEHALT.key);
const lPhysio = forClip(L_PHYSIO.key);
const lNachtzug = forClip(L_NACHTZUG.key);
const lHeizung = forClip(L_HEIZUNG.key);

const listeningItems: SeedItem[] = [
  // Quereinstieg
  lQuer.choice("gist", "EASY", "Wie hat sich die Haltung vieler Unternehmen zum Quereinstieg laut Frau Hartmann verändert?",
    "Aus einer früheren Notlösung ist inzwischen eine ganz bewusste Strategie der Personalgewinnung geworden.",
    [
      "Sie stellen Quereinsteiger inzwischen nur noch ein, wenn sich gar keine Fachkräfte finden lassen.",
      "Sie ziehen Quereinsteiger inzwischen ausgebildeten Fachkräften grundsätzlich vor, weil diese billiger sind.",
      "Sie lehnen den Quereinstieg zunehmend ab, weil die Einarbeitung zu teuer und zu langwierig ist.",
    ], 1,
    "„Am Anfang war er das oft [eine Notlösung] ... Aber das hat sich geändert ... ganz bewusst.“ Eine grundsätzliche Bevorzugung oder Ablehnung wird nicht genannt."),
  lQuer.choice("detail", "MID", "Was nennt Frau Hartmann als größte Hürde für Quereinsteiger?",
    "dass viele anfangs deutlich weniger Geld verdienen als in ihrem früheren Beruf",
    [
      "dass die fachliche Einarbeitung mehrere Jahre dauert und kaum zu schaffen ist",
      "dass für viele Berufe ein Studium der Informatik zwingend vorgeschrieben ist",
      "dass die Führungskräfte den Quereinstieg im Team grundsätzlich nicht unterstützen",
    ], 3,
    "Die fachliche Einarbeitung wird ausdrücklich verneint („nicht die Einarbeitung“, ein, zwei Jahre); „schwierig ist das Geld“. Das fehlende Studium ist nur eine Bemerkung mancher Teams, staatliche Anerkennung betrifft nur bestimmte Berufe."),
  lQuer.choice("detail", "MID", "Was zeigen die Daten zur Begleitung durch eine feste Ansprechperson?",
    "Mit einer festen Ansprechperson im Team bleiben deutlich mehr Quereinsteiger langfristig im Betrieb.",
    [
      "Die Begleitung gelingt am besten, wenn die direkte Führungskraft die Betreuung selbst übernimmt.",
      "Ohne feste Begleitung verlässt ein Großteil der Quereinsteiger schon im ersten Jahr den Betrieb.",
      "Mit Begleitung ist die fachliche Einarbeitung der Quereinsteiger schon nach wenigen Monaten abgeschlossen.",
    ], 0,
    "Mit Ansprechperson sind nach drei Jahren rund vier von fünf noch im Betrieb, ohne nur gut die Hälfte. Die Führungskraft wird ausdrücklich ausgeschlossen („nicht die Chefin, nicht der Chef“); Zahlen zum ersten Jahr oder zu Monaten der Einarbeitung nennt sie nicht."),
  lQuer.choice("attitude", "HARD", "Wie steht Frau Hartmann zu der Frage, ob jeder den Quereinstieg wagen sollte?",
    "Sie empfiehlt ihn nur Menschen mit echter Neugier auf das neue Fach und ausreichenden finanziellen Reserven.",
    [
      "Sie rät grundsätzlich davon ab, solange man dabei weniger verdient als im bisherigen Beruf.",
      "Sie empfiehlt ihn vor allem denen, die schnell ein höheres Gehalt erreichen wollen.",
      "Sie hält ihn für alle sinnvoll, die sich fachlich weiterentwickeln und Neues lernen möchten.",
    ], 2,
    "„Jedem? Nein, nicht jedem.“ Es lohnt sich bei echtem Interesse und wenn man eine knappe Anfangszeit finanziell trägt; wer auf schnell mehr Gehalt hofft, wird enttäuscht."),

  // Gruppenentscheidungen
  lGruppen.choice("gist", "MID", "Worum geht es dem Dozenten in seinem Vortrag vor allem?",
    "zu zeigen, unter welchen Bedingungen Gruppen ihre Stärken wirklich nutzen und wann nicht",
    [
      "zu beweisen, dass Einzelpersonen in den meisten Fällen die klügeren Entscheidungen treffen",
      "zu erklären, mit welchen Methoden man Besprechungen zeitlich kürzer und effizienter gestaltet",
      "zu erklären, warum Gruppen in Online-Besprechungen schlechtere Entscheidungen treffen",
    ], 2,
    "Die Vorteile von Gruppen stellen sich „nur unter bestimmten Bedingungen“ ein; am Ende: „Einzelentscheidungen sind nicht grundsätzlich besser.“ Online-Besprechungen werden nur als Thema der übernächsten Sitzung angekündigt."),
  lGruppen.choice("detail", "MID", "Was geschah in den Experimenten, in denen die Mitglieder unterschiedliche Informationen hatten?",
    "Die Gruppen sprachen vor allem über Informationen, die ohnehin alle Mitglieder schon kannten.",
    [
      "Die Gruppen fanden fast immer die beste Lösung, weil sie ihr Wissen zusammentrugen.",
      "Die Gruppen brauchten für ihre Entscheidung deutlich länger als die Einzelpersonen.",
      "Die Teilnehmenden tauschten ihre unterschiedlichen Informationen vollständig untereinander aus.",
    ], 0,
    "„fast nur über das, was ohnehin alle wussten“; Einzelwissen „kam kaum zur Sprache“, viele Gruppen „verfehlten die beste Lösung“. Zur Dauer sagt der Vortrag nichts."),
  lGruppen.tfng("detail", "HARD",
    [
      ["Gruppendenken tritt laut Dozent vor allem in Gruppen auf, deren Mitglieder sich kaum kennen.", "F"],
      ["In dem beschriebenen Experiment bestanden die Gruppen aus jeweils vier Personen.", "NG"],
      ["Die Methode, Einschätzungen vorab schriftlich festzuhalten, wurde bereits in mehreren Firmen getestet.", "NG"],
      ["Wer als Gegenredner auftritt, sollte diese Rolle nicht dauerhaft behalten, damit er nicht als Bremser gilt.", "R"],
    ],
    "1 F: Das Gruppendenken tritt „besonders oft“ in Gruppen auf, die sich gut verstehen und lange zusammenarbeiten. 2 NG: Das Experiment wird beschrieben, die Gruppengröße nicht genannt. 3 NG: Die Methode wird genannt, ob sie schon getestet wurde, sagt der Dozent nicht. 4 R: „Diese Rolle sollte übrigens wechseln, sonst gilt jemand dauerhaft als Bremser.“"),
  lGruppen.choice("detail", "EASY", "Was empfiehlt der Dozent Führungskräften?",
    "ihre eigene Meinung erst zum Schluss der Besprechung zu äußern, nach den anderen",
    [
      "Besprechungen mit der eigenen Einschätzung zu eröffnen, damit alle sich orientieren können",
      "wichtige Entscheidungen lieber allein zu treffen, um Gruppendenken zu vermeiden",
      "die Rolle des Gegenredners dauerhaft selbst zu übernehmen, damit niemand sonst als Bremser gilt",
    ], 3,
    "„sich zurückzuhalten und erst am Ende Stellung zu nehmen“, weil sich sonst die anderen anschließen. Einzelentscheidungen empfiehlt er nicht, und die Gegenrede soll wechseln."),

  // Gehaltstransparenz
  lGehalt.match("attitude", "HARD",
    "Wer vertritt welche Ansicht?",
    [
      "Zu Beginn sorgt eine Offenlegung für Frust im Betrieb.",
      "Werden Gründe für unterschiedliche Gehälter verschwiegen, reimen sich die Leute eigene, oft wenig schmeichelhafte Erklärungen zusammen.",
      "In einem Kleinbetrieb ist schnell klar, wessen Gehalt gemeint ist.",
      "Gehälter sollten im Betrieb kein Gesprächsthema sein.",
    ],
    ["Frau Demir", "Herr Lorenz", "beide", "keiner von beiden"],
    [3, 2, 1, 4],
    "1 beide: Frau Demir erwartet Unruhe und Frust, Herr Lorenz bestätigt: „Kurzfristig ja.“ 2 Herr Lorenz: Das Problem entsteht, „wenn solche Gründe unausgesprochen bleiben“, dann vermuten die Leute „ganz andere Gründe“. 3 Frau Demir: „mit zwölf Leuten weiß doch sofort jeder, wer gemeint ist“. 4 vertritt niemand."),
  lGehalt.choice("detail", "EASY", "Was schlägt Herr Lorenz konkret vor?",
    "Für jede Stelle soll ein nachvollziehbarer Gehaltsrahmen mit bekannten Kriterien gelten.",
    [
      "Jede Beschäftigte soll die Gehaltsabrechnungen der übrigen Kolleginnen und Kollegen einsehen dürfen.",
      "Alle Beschäftigten auf derselben Stelle sollen künftig genau dasselbe Gehalt erhalten.",
      "Gehaltserhöhungen sollen künftig ausschließlich nach der Dauer der Betriebszugehörigkeit vergeben werden.",
    ], 1,
    "Gehaltsbänder mit Mindest- und Höchstbetrag und bekannten Kriterien. Einsicht in einzelne Abrechnungen schließt er ausdrücklich aus; ein Band erlaubt Unterschiede; Betriebszugehörigkeit ist nur ein mögliches Kriterium."),
  lGehalt.choice("inference", "MID", "Welchen Vorteil der Offenlegung erkennt Frau Demir schließlich an?",
    "Wer sich bisher nie getraut hat, mehr Gehalt zu fordern, würde künftig fairer behandelt als heute.",
    [
      "Die Unruhe im Betrieb würde sich nach der Einführung innerhalb weniger Wochen legen.",
      "Kleine Betriebe könnten dadurch leichter neue Beschäftigte gewinnen, weil die Gehälter bekannt sind.",
      "Eine gesetzliche Pflicht würde für alle Betriebe dieselben Bedingungen schaffen und wäre deshalb gerecht.",
    ], 3,
    "„Gerade die Zurückhaltenden, die nie von sich aus nach mehr Geld fragen würden, hätten dann eine Chance.“ Eine einheitliche gesetzliche Regelung lehnt sie ab; die Dauer bis zur Beruhigung nennt Herr Lorenz (etwa ein Jahr)."),
  lGehalt.choice("gist", "HARD", "Wie endet die Diskussion?",
    "Beide halten eine längere Übergangsfrist samt Hilfe bei der Umstellung für kleine Firmen für vorstellbar.",
    [
      "Herr Lorenz zieht seine Forderung zurück, weil er die Bedenken der Inhaberin teilt.",
      "Frau Demir stimmt zu, dass eine einheitliche gesetzliche Regelung für alle Betriebe gelten sollte.",
      "Beide bleiben bei ihren Positionen und beenden das Gespräch ohne jede Annäherung.",
    ], 0,
    "„Da liegen wir gar nicht so weit auseinander“: mehr Zeit und Unterstützung für kleinere Betriebe. Er hält an der Forderung fest, sie lehnt eine einheitliche Regelung ab."),

  // Lärm und Schlaf: note taking
  lPhysio.notes("detail", "HARD",
    "Sie hören einen Kurzvortrag. Ergänzen Sie die Notizen mit je einem Wort, das die Sprecherin sagt.\n\nGrößtes Problem: nicht der Dauerpegel, sondern kurze {{g1}}\nMaßnahme vieler Städte: nachts die {{g2}} senken\nWirkt nur, wenn sich jemand um die {{g3}} kümmert\nGünstigste Lösung für Betroffene: das {{g4}} in einen Raum abseits der Straße verlegen",
    [
      ["Lärmspitzen", "Lärmspitze", "Spitzen", "Spitze"],
      ["Geschwindigkeit", "Geschwindigkeiten", "Fahrgeschwindigkeit", "Tempo"],
      ["Einhaltung", "Überwachung", "Kontrolle"],
      ["Schlafzimmer", "Schlafraum", "Schlafzimmers"],
    ],
    "Wie im ÖSD-Notizenformat steht in jeder Zeile genau eine Lücke für ein Wort, das die Sprecherin sagt. Lücke 1: „Solche Lärmspitzen lösen Aufwachreaktionen aus“ (nicht der Dauerpegel). Lücke 2: „bei der Geschwindigkeit ansetzen“, nachts nur noch langsamer fahren. Lücke 3: „ob sich jemand um die Einhaltung kümmert“; als Synonyme gelten Überwachung und Kontrolle. Lücke 4: das Schlafzimmer verlegen; die Zeile nennt die günstigste Lösung, Schallschutzfenster sind laut Text teuer und scheiden deshalb aus. Jede Lücke zählt einzeln, Groß- und Kleinschreibung und ae/oe/ue werden toleriert."),

  // Nachtzug
  lNachtzug.choice("attitude", "HARD", "Wie beurteilt Frau Wolf die Zukunft der Nachtzüge?",
    "Sie sieht auf einzelnen Strecken eine echte Chance, erwartet aber keinen breiten Ersatz für Flüge.",
    [
      "Sie hält die Rückkehr für eine Modeerscheinung, die ohne dauerhafte Förderung wieder endet.",
      "Sie rechnet damit, dass Nachtzüge bald auf den meisten Strecken mit Flügen konkurrieren.",
      "Sie sieht das Hauptproblem darin, dass Fahrgäste lange Fahrzeiten kaum akzeptieren.",
    ], 0,
    "„Auf ein paar Strecken kann er eine echte Alternative werden. Mehr würde ich vorerst nicht erwarten.“ Sie wendet sich ausdrücklich dagegen, den Nachtzug als baldigen Verdränger des Flugs darzustellen; die Fahrzeit und eine Modeerscheinung sprechen weder sie noch der Moderator an."),
  lNachtzug.choice("inference", "HARD", "Welche Rolle spielen die ausgebuchten Betten auf der Strecke nach Wien in ihrer Argumentation?",
    "Sie zeigen, dass die Nachfrage das vorhandene Angebot übersteigt, nicht dass es schon ausreicht.",
    [
      "Sie zeigen, dass Nachtzüge inzwischen auch ohne öffentliche Förderung wirtschaftlich arbeiten.",
      "Sie zeigen, dass Reisende bereit sind, für Nachtzüge deutlich höhere Preise zu zahlen.",
      "Sie zeigen, dass die neue Wagengeneration bereits auf den wichtigen Strecken im Einsatz ist.",
    ], 2,
    "„Die Nachfrage beweist zunächst nur, dass das Angebot knapp ist.“ Preise, Wirtschaftlichkeit ohne Förderung und neue Wagen werden nicht behauptet; die Wagen sind alt, neue lassen auf sich warten."),

  // Mietminderung
  lHeizung.choice("detail", "HARD", "Was sagt Frau Kramer zur Höhe einer Mietminderung?",
    "Sie lasse sich nicht pauschal angeben, sondern hänge vom Ausmaß des Ausfalls und von der Witterung ab.",
    [
      "Sie betrage bei jedem Heizungsausfall einen festen Anteil der Monatsmiete.",
      "Sie hänge davon ab, wie oft der Vermieter schon einen Handwerker versprochen habe.",
      "Sie dürfe Herr Berger selbst festlegen, um den Vermieter unter Druck zu setzen.",
    ], 1,
    "„Zur Höhe kann ich Ihnen keine feste Zahl nennen. Das hängt davon ab, wie stark Ihre Wohnung betroffen ist und wie kalt es draußen ist.“ Die Zahl der Versprechen des Vermieters spielt dafür keine Rolle; vom Selbstfestlegen rät sie ausdrücklich ab."),
  lHeizung.choice("inference", "HARD", "Wovor warnt Frau Kramer Herrn Berger?",
    "Wenn er eigenmächtig zu viel einbehält, kann er selbst in Schwierigkeiten kommen.",
    [
      "Eine Mietminderung ist aussichtslos, weil der Mangel nicht schriftlich belegt ist.",
      "Der Vermieter darf die Reparatur verweigern, solange noch Miete einbehalten wird.",
      "Eine Meldung per E-Mail ist ungültig, wenn vorher schon telefoniert wurde.",
    ], 3,
    "„Grundsätzlich ja“ zur Minderung, schriftliche Dokumentation hilft nur; vor dem eigenmächtigen Abzug warnt sie mit dem Hinweis auf eine mögliche Kündigung wegen Zahlungsrückstands. Die anderen Aussagen macht sie nicht."),
];

// ---------------------------------------------------------------- WRITING

const FORUM = "neutral bis formell (sachlicher Forumsbeitrag)";
const SEMI = "halbformell (Sie, höflich-sachlich)";
const FORMAL = "formell (Sie)";

function write(
  skill: "opinion" | "formal" | "data",
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

const FORUM_WORDS: [number, number] = [200, 280];
const EMAIL_WORDS: [number, number] = [100, 160];
const FORUM_NOTE =
  "Goethe C1 Schreiben Teil 1: Forumsbeitrag von etwa 230 Wörtern. Bewertet werden Aufgabenerfüllung (alle vier Punkte, Textsorte), Kohärenz, Wortschatz und Strukturen; unter 50 % der Wortzahl oder Themaverfehlung führt zu 0 Punkten.";
const EMAIL_NOTE =
  "Goethe C1 Schreiben Teil 2: E-Mail von etwa 120 Wörtern, formell oder halbformell je nach Empfänger (siehe Register). Wichtig sind alle Leitpunkte, ein angemessenes Register (Anrede, Gruß, höfliche Distanz) und ein klares Anliegen.";

const TABLE_NOTE =
  "Aufgabe mit Tabelle (Muster ÖSD C1 und TestDaF): Daten beschreiben, Gründe und Folgen erörtern, mit dem eigenen Land vergleichen und Stellung nehmen. Bewertet werden Aufgabenerfüllung (alle Punkte, treffende Wiedergabe der Daten), Kohärenz, Wortschatz für Veränderungen und Vergleiche sowie Register.";

const writingItems: SeedItem[] = [
  write("data", "HARD", [200, 300],
    "Eine Stadtzeitung veröffentlicht die Ergebnisse einer Befragung zur Verkehrsmittelwahl in der Stadt Lindental und bittet um Leserbriefe. In beiden Jahren wurden rund 2000 Einwohner befragt, mit welchem Verkehrsmittel sie ihre alltäglichen Wege überwiegend zurücklegen.\n\n" +
      "Verkehrsmittel | 2014 | 2024\n" +
      "Auto | 41 % | 33 %\n" +
      "Öffentlicher Nahverkehr | 22 % | 24 %\n" +
      "Fahrrad | 14 % | 25 %\n" +
      "zu Fuß | 23 % | 18 %\n\n" +
      "Schreiben Sie einen Leserbrief (etwa 250 Wörter):\n" +
      "- Beschreiben Sie die wichtigsten Veränderungen in der Tabelle.\n" +
      "- Nennen Sie mögliche Gründe für diese Entwicklung.\n" +
      "- Erläutern Sie, welche Folgen sie für die Stadt haben kann.\n" +
      "- Vergleichen Sie die Lage mit der in Ihrer Stadt oder in einer Stadt, die Sie gut kennen, und nehmen Sie begründet Stellung.",
    [
      "beschreibt die zentralen Veränderungen zutreffend (Auto Rückgang, Fahrrad deutlicher Zuwachs, Nahverkehr leicht höher, Fußwege geringer) und wählt die wichtigsten aus",
      "nennt plausible Gründe (z. B. Radwege, Kosten, Umweltbewusstsein, Parkraum)",
      "erörtert Folgen für Verkehr, Flächennutzung, Umwelt oder Wirtschaft",
      "vergleicht mit der eigenen Stadt oder einer gut bekannten Stadt und nimmt begründet Stellung; Daten werden gedeutet, nicht nur aufgezählt",
    ],
    [
      "die wichtigsten Veränderungen in der Tabelle",
      "mögliche Gründe für die Entwicklung",
      "Folgen für die Stadt",
      "ein Vergleich mit einer Stadt, die Sie kennen",
      "Ihre begründete Meinung",
    ],
    "neutral bis formell (Leserbrief)", TABLE_NOTE),
  write("opinion", "MID", FORUM_WORDS,
    "Im Onlineforum einer Wirtschaftszeitschrift wird diskutiert: „Sollten Unternehmen bei der Personalauswahl auf Zeugnisnoten und formale Abschlüsse verzichten?“\n\n" +
      "Schreiben Sie einen Beitrag (etwa 230 Wörter). Gehen Sie auf folgende Punkte ein:\n" +
      "- Erläutern Sie, welche Rolle Noten und Abschlüsse heute bei Bewerbungen spielen.\n" +
      "- Nennen Sie Vorteile eines Verzichts.\n" +
      "- Nennen Sie mögliche Nachteile oder Risiken.\n" +
      "- Nehmen Sie begründet Stellung und veranschaulichen Sie Ihre Meinung mit einem Beispiel.",
    [
      "erläutert die heutige Bedeutung von Noten und Abschlüssen",
      "nennt und begründet Vorteile eines Verzichts",
      "nennt Nachteile oder Risiken",
      "eigene, begründete Position mit Beispiel; klarer Aufbau mit Einleitung und Schluss",
    ],
    [
      "die Rolle von Noten und Abschlüssen heute",
      "Vorteile eines Verzichts",
      "Nachteile oder Risiken",
      "Ihre begründete Meinung mit einem Beispiel",
      "Einleitung und Schluss",
    ],
    FORUM, FORUM_NOTE),
  write("opinion", "MID", FORUM_WORDS,
    "In einem Forum zum Thema Arbeitswelt lautet die Frage: „Sollten Arbeitgeber festlegen dürfen, an wie vielen Tagen pro Woche die Beschäftigten im Büro anwesend sein müssen?“\n\n" +
      "Schreiben Sie einen Beitrag (etwa 230 Wörter). Gehen Sie auf folgende Punkte ein:\n" +
      "- Beschreiben Sie, wie die Arbeit zwischen Büro und Zuhause heute häufig organisiert ist.\n" +
      "- Erklären Sie, warum Arbeitgeber feste Bürotage wünschen.\n" +
      "- Erklären Sie, was aus Sicht der Beschäftigten dagegen spricht.\n" +
      "- Machen Sie einen begründeten Vorschlag für eine faire Lösung.",
    [
      "beschreibt die heutige Organisation von Büro- und Heimarbeit",
      "Gründe aus Sicht der Arbeitgeber",
      "Gegenargumente aus Sicht der Beschäftigten",
      "begründeter eigener Lösungsvorschlag; Argumente sind verknüpft und gewichtet",
    ],
    [
      "wie Arbeit zwischen Büro und Zuhause heute organisiert ist",
      "warum Arbeitgeber feste Bürotage wünschen",
      "was aus Sicht der Beschäftigten dagegen spricht",
      "eine faire Lösung vorschlagen und begründen",
      "Einleitung und Schluss",
    ],
    FORUM, FORUM_NOTE),
  write("opinion", "HARD", FORUM_WORDS,
    "Im Forum eines Fachmagazins wird diskutiert: „Sollten Beschäftigte offenlegen müssen, wenn sie Texte oder Analysen mit Hilfe von KI-Werkzeugen erstellt haben?“\n\n" +
      "Schreiben Sie einen Beitrag (etwa 230 Wörter). Gehen Sie auf folgende Punkte ein:\n" +
      "- Erläutern Sie, wofür KI-Werkzeuge im Berufsalltag bereits genutzt werden.\n" +
      "- Nennen Sie Argumente für eine Pflicht zur Offenlegung.\n" +
      "- Nennen Sie Argumente dagegen.\n" +
      "- Beziehen Sie Stellung und machen Sie deutlich, unter welchen Bedingungen Sie eine solche Regel für sinnvoll halten.",
    [
      "Beispiele für die Nutzung von KI-Werkzeugen im Beruf",
      "Argumente für eine Offenlegungspflicht",
      "Argumente gegen eine Offenlegungspflicht",
      "differenzierte eigene Position mit Bedingungen; abwägende Sprachmittel (zwar ... aber, sofern, insofern)",
    ],
    [
      "wofür KI-Werkzeuge im Berufsalltag genutzt werden",
      "Argumente für eine Pflicht zur Offenlegung",
      "Argumente dagegen",
      "Ihre Position: unter welchen Bedingungen die Regel sinnvoll ist",
      "Einleitung und Schluss",
    ],
    FORUM, FORUM_NOTE),
  write("formal", "EASY", EMAIL_WORDS,
    "Sie haben bei einem Weiterbildungsanbieter einen Präsenzkurs „Projektmanagement“ gebucht. Eine Woche vor Beginn erfahren Sie zufällig auf der Website, dass der Kurs nur noch online stattfindet. Man hat Sie darüber nicht informiert.\n\n" +
      "Schreiben Sie eine E-Mail an den Anbieter (etwa 120 Wörter):\n" +
      "- Schildern Sie das Problem.\n" +
      "- Zeigen Sie Verständnis für mögliche Gründe der Änderung.\n" +
      "- Erklären Sie, warum ein Onlinekurs für Sie schwierig ist.\n" +
      "- Schlagen Sie eine Lösung vor.",
    [
      "schildert sachlich die Änderung und die fehlende Information",
      "zeigt Verständnis für mögliche Gründe",
      "begründet, warum das Onlineformat für sie/ihn ein Problem ist",
      "konkreter Lösungsvorschlag (z. B. Umbuchung, Erstattung, späterer Präsenztermin); passende Anrede und Schlussformel",
    ],
    [
      "das Problem schildern",
      "Verständnis für mögliche Gründe zeigen",
      "warum ein Onlinekurs für Sie schwierig ist",
      "eine Lösung vorschlagen",
      "Anrede und Schlussformel",
    ],
    FORMAL, EMAIL_NOTE),
  write("formal", "MID", EMAIL_WORDS,
    "Ihre Teamleiterin, Frau Brandt, hat Sie gebeten, zusätzlich zu Ihren laufenden Aufgaben ein neues Projekt zu übernehmen. Sie finden das Projekt interessant, sind aber bereits stark ausgelastet.\n\n" +
      "Schreiben Sie Frau Brandt eine E-Mail (etwa 120 Wörter):\n" +
      "- Bedanken Sie sich für das Vertrauen.\n" +
      "- Beschreiben Sie Ihre aktuelle Arbeitsbelastung.\n" +
      "- Schlagen Sie vor, wie man die Aufgaben neu verteilen oder priorisieren könnte.\n" +
      "- Bitten Sie um ein kurzes Gespräch.",
    [
      "Dank und grundsätzliches Interesse am Projekt",
      "sachliche Beschreibung der aktuellen Auslastung",
      "konstruktiver Vorschlag zur Priorisierung oder Umverteilung",
      "Bitte um ein Gespräch; diplomatischer Ton gegenüber der Vorgesetzten",
    ],
    [
      "sich für das Vertrauen bedanken",
      "Ihre aktuelle Arbeitsbelastung beschreiben",
      "vorschlagen, wie man die Aufgaben verteilen oder priorisieren könnte",
      "um ein kurzes Gespräch bitten",
      "Anrede und Schlussformel",
    ],
    SEMI, EMAIL_NOTE),
  write("formal", "HARD", EMAIL_WORDS,
    "Sie sollen auf einer Fachtagung einen Vortrag halten. Im endgültigen Programm, das Sie gerade erhalten haben, steht Ihr Vortrag zur selben Zeit wie ein anderer Vortrag zu einem sehr ähnlichen Thema. Außerdem ist die Redezeit von dreißig auf fünfzehn Minuten gekürzt worden.\n\n" +
      "Schreiben Sie eine E-Mail an das Organisationsteam (etwa 120 Wörter):\n" +
      "- Weisen Sie höflich auf die beiden Probleme hin.\n" +
      "- Zeigen Sie Verständnis für die schwierige Planung.\n" +
      "- Erläutern Sie, welche Folgen die Änderungen für Ihren Vortrag hätten.\n" +
      "- Schlagen Sie eine Lösung vor.",
    [
      "benennt beide Probleme (Zeitüberschneidung, gekürzte Redezeit)",
      "zeigt Verständnis für die Planung",
      "erläutert die Folgen für den eigenen Vortrag",
      "realistischer Lösungsvorschlag; höflich-indirekte Formulierungen (Konjunktiv II, Bitte statt Forderung)",
    ],
    [
      "höflich auf beide Probleme hinweisen",
      "Verständnis für die Planung zeigen",
      "die Folgen für Ihren Vortrag erläutern",
      "eine Lösung vorschlagen",
      "Anrede und Schlussformel",
    ],
    FORMAL, EMAIL_NOTE),
];

// ---------------------------------------------------------------- SPEAKING

const TALK = { thinkSeconds: 240, answerSeconds: 360, maxTakes: 1 };
const DISCUSS = { thinkSeconds: 120, answerSeconds: 180, maxTakes: 1 };

function speak(
  skill: "presentation" | "discussion" | "handout",
  within: Within,
  prompt: string,
  contentPoints: string[],
  studentPoints: string[],
  explanation: string,
): SeedItem {
  return {
    section: "SPEAKING",
    level: LEVEL,
    type: "SPEAKING_PROMPT",
    skillTag: `speaking.${skill}`,
    within,
    prompt,
    content: { kind: "SPEAKING", ...(skill === "discussion" ? DISCUSS : TALK) },
    key: { kind: "NONE" },
    rubric: { contentPoints, register: skill === "discussion" ? "sachlich; Sie oder du (unter Kollegen ist beides richtig)" : "formell (Sie), sachlich", studentPoints },
    explanation,
  };
}

const TALK_NOTE =
  "Goethe C1 Sprechen Teil 1: Vortrag von etwa vier bis fünf Minuten. Bewertet werden Aufgabenerfüllung, Kohärenz und Flüssigkeit, Wortschatz, Strukturen und Aussprache.";
const HANDOUT_NOTE =
  "Muster ÖSD C1 Sprechen 3 und TestDaF: Vortrag auf der Grundlage eines Handouts mit mehreren Quellen. Bewertet werden Zusammenfassung der Quellen, Stellungnahme, Vergleich mit dem eigenen Land, Gliederung, Wortschatz und Strukturen.";
const DISCUSS_NOTE =
  "Goethe C1 Sprechen Teil 2 (als aufgezeichneter Gesprächsbeitrag): auf einen Impuls reagieren, Position beziehen, Gegenargumente aufgreifen. Bewertet wird zusätzlich die Fähigkeit, auf andere Meinungen einzugehen.";

const speakingItems: SeedItem[] = [
  speak("presentation", "MID",
    "Halten Sie einen Vortrag von etwa vier bis fünf Minuten zum Thema „Lebenslanges Lernen im Beruf“.\n\n" +
      "- Erklären Sie, was man unter lebenslangem Lernen versteht und warum es heute wichtig ist.\n" +
      "- Beschreiben Sie, wie Weiterbildung in Ihrem beruflichen Umfeld oder in einem Beruf, den Sie gut kennen, organisiert ist.\n" +
      "- Nennen Sie Vor- und Nachteile verschiedener Lernformen (z. B. Kurse, Onlinelernen, Lernen am Arbeitsplatz).\n" +
      "- Sagen Sie Ihre eigene Meinung und schließen Sie den Vortrag mit einem Fazit ab.",
    [
      "Begriffsklärung und Begründung der Aktualität",
      "Beschreibung der Weiterbildung im eigenen oder einem gut bekannten beruflichen Umfeld",
      "Vor- und Nachteile mehrerer Lernformen",
      "eigene Meinung, Fazit; erkennbare Gliederung mit Einleitung, Überleitungen und Schluss",
    ],
    [
      "was lebenslanges Lernen ist und warum es wichtig ist",
      "Weiterbildung in Ihrem beruflichen Umfeld",
      "Vor- und Nachteile verschiedener Lernformen",
      "Ihre Meinung und ein Fazit",
    ],
    TALK_NOTE),
  speak("presentation", "MID",
    "Halten Sie einen Vortrag von etwa vier bis fünf Minuten zum Thema „Nachrichten im Netz: Chancen und Risiken“.\n\n" +
      "- Beschreiben Sie, wie sich die Art verändert hat, in der Menschen sich über das Tagesgeschehen informieren.\n" +
      "- Erläutern Sie, welche Rolle klassische Medien künftig spielen könnten.\n" +
      "- Stellen Sie Chancen und Risiken dieser Entwicklung für die Leserschaft und für die Gesellschaft dar.\n" +
      "- Beziehen Sie Stellung und runden Sie den Vortrag mit einem Ausblick ab.",
    [
      "Beschreibung der veränderten Mediennutzung",
      "Einschätzung der künftigen Rolle klassischer Medien",
      "Chancen und Risiken aus zwei Perspektiven",
      "begründete eigene Position und Ausblick; flüssiger, zusammenhängender Vortrag",
    ],
    [
      "wie sich die Information über das Tagesgeschehen verändert hat",
      "welche Rolle klassische Medien künftig spielen könnten",
      "Chancen und Risiken für Leserschaft und Gesellschaft",
      "Ihre Position und ein Ausblick",
    ],
    TALK_NOTE),
  speak("presentation", "HARD",
    "Halten Sie einen Vortrag von etwa vier bis fünf Minuten zum Thema „Fachkräftemangel: Ursachen und Lösungswege“.\n\n" +
      "- Erklären Sie, was man unter Fachkräftemangel versteht.\n" +
      "- Nennen Sie mögliche Ursachen.\n" +
      "- Stellen Sie zwei oder drei Lösungswege vor und bewerten Sie diese.\n" +
      "- Erläutern Sie, welchen Weg Sie für den vielversprechendsten halten, und begründen Sie das.",
    [
      "Begriffsklärung",
      "mehrere Ursachen, sachlich verknüpft",
      "zwei bis drei Lösungswege mit Bewertung",
      "begründete Gewichtung und Schluss; differenzierter Wortschatz (z. B. Nominalstil, Abwägung)",
    ],
    [
      "was Fachkräftemangel bedeutet",
      "mögliche Ursachen",
      "zwei oder drei Lösungswege und ihre Bewertung",
      "welcher Weg Ihnen am besten erscheint, und warum",
    ],
    TALK_NOTE),
  speak("discussion", "EASY",
    "Lesen Sie die Meldung und nehmen Sie Stellung.\n\n" +
      "„Ein Unternehmen begrenzt alle internen Besprechungen auf höchstens dreißig Minuten. Die Geschäftsleitung verspricht sich davon effizientere Abläufe.“\n\n" +
      "Ein Kollege sagt: „Wichtige Themen lassen sich doch nicht in dreißig Minuten klären.“\n\n" +
      "- Sagen Sie, was Sie von der Regel halten, und begründen Sie Ihre Meinung.\n" +
      "- Gehen Sie auf das Argument des Kollegen ein.\n" +
      "- Nennen Sie ein Beispiel aus Ihrer Erfahrung.\n" +
      "- Machen Sie einen Kompromissvorschlag.",
    [
      "klare, begründete Stellungnahme zur Regel",
      "geht ausdrücklich auf das Gegenargument ein (zustimmen, einschränken oder widerlegen)",
      "Beispiel aus eigener Erfahrung",
      "Kompromissvorschlag; Redemittel der Diskussion (Einerseits ..., Ich gebe Ihnen recht, aber ...)",
    ],
    [
      "Ihre Meinung zur Regel mit Begründung",
      "auf das Argument des Kollegen eingehen",
      "ein Beispiel aus Ihrer Erfahrung",
      "ein Kompromissvorschlag",
    ],
    DISCUSS_NOTE),
  speak("discussion", "MID",
    "Lesen Sie die Meldung und nehmen Sie Stellung.\n\n" +
      "„Ein Unternehmen führt ein ‚Recht auf Nichterreichbarkeit‘ ein: Nach achtzehn Uhr und am Wochenende werden keine dienstlichen E-Mails mehr an die Beschäftigten weitergeleitet.“\n\n" +
      "Eine Kollegin sagt: „Dann bleibt am Montag einfach doppelt so viel Arbeit liegen.“\n\n" +
      "- Sagen Sie, wie Sie die Regel einschätzen, und begründen Sie das.\n" +
      "- Reagieren Sie auf den Einwand der Kollegin.\n" +
      "- Erläutern Sie, für welche Berufe oder Situationen die Regel schwierig sein könnte.\n" +
      "- Formulieren Sie ein Fazit.",
    [
      "begründete Einschätzung der Regel",
      "geht auf den Einwand ein und entkräftet oder relativiert ihn",
      "nennt Grenzen der Regel (Berufe, Situationen)",
      "abwägendes Fazit; Gesprächsbeitrag ist zusammenhängend und adressatengerecht",
    ],
    [
      "Ihre Einschätzung der Regel mit Begründung",
      "auf den Einwand der Kollegin reagieren",
      "Berufe oder Situationen, in denen die Regel schwierig ist",
      "ein Fazit",
    ],
    DISCUSS_NOTE),
  speak("handout", "HARD",
    "Sie erhalten ein Handout zum Thema „Smartphones in der Schule“. Halten Sie anschließend einen Vortrag von etwa vier bis fünf Minuten.\n\n" +
      "Quelle 1, Umfrage unter Eltern: Mehr als die Hälfte der Befragten möchte die private Handynutzung während des Schultags einschränken. Nur eine Minderheit fordert ein vollständiges Verbot.\n\n" +
      "Quelle 2, Studie einer Universität: Schülerinnen und Schüler, die ihr Handy tagsüber in der Tasche lassen, erreichen in Konzentrationstests etwas bessere Werte. Bei den Leistungen in den Abschlussklassen fanden die Forschenden keinen eindeutigen Unterschied.\n\n" +
      "Quelle 3, Auszug aus einem Zeitungsartikel: „Wer Jugendlichen das Gerät wegnimmt, nimmt ihnen auch ein Werkzeug zum Lernen. Entscheidend ist, dass die Schule den Umgang damit beibringt, statt ihn zu verbieten.“\n\n" +
      "- Fassen Sie die Informationen der drei Quellen zusammen.\n" +
      "- Sagen Sie, welche Regel Sie für sinnvoll halten, und begründen Sie das.\n" +
      "- Vergleichen Sie mit der Situation an Schulen, die Sie kennen (zum Beispiel aus Ihrer Stadt oder aus Ihrer eigenen Schulzeit).\n" +
      "- Berichten Sie, wie Sie selbst mit dem Handy beim Lernen oder Arbeiten umgehen.",
    [
      "gibt die drei Quellen sachlich und vollständig wieder, ohne sie wörtlich vorzulesen",
      "bezieht begründet Stellung zu einer Regelung und greift dabei Informationen aus den Quellen auf",
      "Vergleich mit Schulen, die die Person kennt",
      "persönliche Erfahrung; klare Gliederung, Überleitungen und ein abschließendes Fazit",
    ],
    [
      "die drei Quellen zusammenfassen",
      "Ihre Meinung mit Begründung",
      "ein Vergleich mit Schulen, die Sie kennen",
      "Ihr eigener Umgang mit dem Handy",
    ],
    HANDOUT_NOTE),
];

export const C1_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = {
  grammar: { stimuli: [], items: [...grammarItems, ...grammarTexts] },
  reading: { stimuli: [R_PAUSEN, R_REPARATUR, R_WEITERBILDUNG, R_KI, R_STADTBAEUME, R_MUSEUM, R_GENOSSENSCHAFT, R_FOTOKURSE, R_LAUFEN, R_BIBER, R_DIALEKT], items: readingItems },
  listening: { stimuli: [L_QUEREINSTIEG, L_GRUPPEN, L_GEHALT, L_PHYSIO, L_NACHTZUG, L_HEIZUNG], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
