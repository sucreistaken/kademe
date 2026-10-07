import type { TfngValue } from "@/lib/exam/types";
import { cTest } from "../ctest";
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
 * - Grammar: 24 items (8 EASY, 8 MID, 8 HARD) over the C1 inventory plus one C-test.
 * - Reading: 4 texts with 4 items each (word-level cloze, dense magazine article,
 *   commentary with sentence insertion, four positions to match).
 * - Listening: 3 clips with 4 items each (expert interview, lecture, discussion
 *   reduced to two voices).
 * - Writing: 3 forum contributions (about 230 words) and 3 semi-formal emails (about 120 words).
 * - Speaking: 3 talks from bullet points and 3 discussion turns reacting to an input text.
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
  "Wählen Sie die Form, die die indirekte Rede nach der Standardregel der Schriftsprache eindeutig kennzeichnet.";

const grammarItems: SeedItem[] = [
  // ------------------------------------------------ EASY
  gChoice("praepositionen", "EASY",
    "___ der hohen Kosten entschied sich die Geschäftsleitung gegen den Umzug in ein neues Bürogebäude.",
    "Angesichts", ["Obwohl", "Ungeachtet", "Infolgedessen"], 0,
    "„Angesichts“ + Genitiv nennt den Grund (= wegen). „Ungeachtet“ (= trotz) ergibt einen Widerspruch, „obwohl“ ist eine Konjunktion und braucht einen Nebensatz, „infolgedessen“ ist ein Adverb und kann kein Nomen anschließen."),
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
    "Setzen Sie das Verb im Konjunktiv I ein.\n\nDer Sprecher sagte: „Das Unternehmen hat die Zahlen sorgfältig geprüft.“\n→ Der Sprecher sagte, das Unternehmen {{g1}} die Zahlen sorgfältig geprüft.",
    ["habe"], undefined,
    "Konjunktiv I von „haben“ in der 3. Person Singular: „habe“. Er unterscheidet sich vom Indikativ „hat“ und ist deshalb hier die Standardform."),
  gChoice("konnektoren", "EASY",
    "Die Filiale in Köln hat ihr Umsatzziel übertroffen, ___ die Filiale in Leipzig deutlich darunter geblieben ist.",
    "wohingegen", ["zumal", "weshalb", "sobald"], 3,
    "„Wohingegen“ stellt zwei Sachverhalte gegenüber (adversativ). „Zumal“ begründet zusätzlich, „weshalb“ leitet eine Folge ein, „sobald“ ist temporal; alle drei passen inhaltlich nicht."),
  gChoice("praepositionen", "EASY",
    "___ ausreichender Anmeldungen musste der Kurs leider abgesagt werden.",
    "Mangels", ["Mittels", "Angesichts", "Hinsichtlich"], 0,
    "„Mangels“ + Genitiv bedeutet „weil etwas fehlt“. Nur so ergibt der Satz einen Sinn: Es gab nicht genug Anmeldungen. „Mittels“ (Instrument), „angesichts“ (Grund) und „hinsichtlich“ (Bezug) sind hier unlogisch."),
  gGap("funktionsverbgefuege", "EASY",
    "Die neue Regelung zur mobilen Arbeit tritt am ersten Januar in {{g1}}.",
    ["Kraft"], ["Wirkung", "Kraft", "Geltung", "Gültigkeit"],
    "Feste Verbindung: „in Kraft treten“. Die anderen Nomen sind bedeutungsähnlich, bilden mit „treten“ aber keine Kollokation."),
  gChoice("wortbildung", "EASY",
    "Leider ___ Sie die Anforderungen der Stelle nicht in allen Punkten.",
    "erfüllen", ["ausfüllen", "befüllen", "verfüllen"], 3,
    "Anforderungen, Bedingungen oder Wünsche „erfüllt“ man. „Ausfüllen“ passt zu Formularen, „befüllen“ zu Behältern, „verfüllen“ zu Löchern oder Gruben."),

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
    "Bilden Sie aus dem Verb „senken“ das passende Nomen.\n\nDie Firma will ihre Kosten senken.\n→ Die Firma strebt eine {{g1}} ihrer Kosten an.",
    ["Senkung"], undefined,
    "Zu „senken“ gehört das Nomen „die Senkung“ (Suffix -ung, feminin, passt zu „eine“)."),
  gGap("partizipialattribut", "MID",
    "Die von der Geschäftsleitung im Frühjahr {{g1}} Regeln gelten ab sofort für alle Abteilungen.",
    ["beschlossenen"], ["beschlossene", "beschließenden", "beschlossenen", "beschlossen"],
    "Erweitertes Partizipialattribut mit passivischer Bedeutung (die Regeln wurden beschlossen), also Partizip II. Nach dem bestimmten Artikel im Plural steht die schwache Endung -en: „die ... beschlossenen Regeln“."),
  gGap("partizipialattribut", "MID",
    "Ersetzen Sie den Relativsatz durch ein Partizipialattribut mit Partizip I.\n\ndie Kosten, die ständig steigen\n→ die ständig {{g1}} Kosten",
    ["steigenden"], undefined,
    "Aktiver, gleichzeitiger Vorgang: Partizip I „steigend“, nach „die“ im Plural mit der Endung -en: „die ständig steigenden Kosten“."),
  gChoice("konjunktiv_i", "MID",
    `${INDIRECT}\n\nDie Mitarbeiter erklärten, sie ___ keine Informationen über die Umstrukturierung erhalten.`,
    "hätten", ["haben", "habe", "hatten"], 1,
    "Der Konjunktiv I „sie haben“ ist mit dem Indikativ identisch, deshalb tritt der Konjunktiv II „hätten“ als Ersatzform ein. „Habe“ passt nicht zum Plural, „hatten“ ist Indikativ Präteritum."),
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
  gChoice("nominalisierung", "HARD",
    "Welcher Satz gibt die Bedeutung richtig wieder? „Bei Nichteinhaltung der Frist verfällt der Anspruch auf Erstattung.“",
    "Wer die Frist nicht einhält, verliert den Anspruch auf Erstattung.",
    [
      "Wer die Frist einhält, verliert den Anspruch auf Erstattung.",
      "Auch wer die Frist nicht einhält, behält den Anspruch auf Erstattung.",
      "Solange die Frist läuft, besteht noch kein Anspruch auf Erstattung.",
    ], 3,
    "Auflösung des Nominalstils: „bei Nichteinhaltung“ = konditional „wenn/wer ... nicht einhält“; „verfallen“ = ungültig werden, verloren gehen."),
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
    variants: {},
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
  "Die Autorinnen und Autoren der Studie warnen zudem davor, ihre Ergebnisse zu verallgemeinern. Untersucht wurden ausschließlich Tätigkeiten am Schreibtisch; ob sich die Befunde auf körperliche Arbeit übertragen lassen, ist offen. Dennoch sehen sie in ihren Daten einen klaren Hinweis darauf, dass die verbreitete Vorstellung, wer mehr Stunden am Stück arbeite, schaffe auch mehr, zumindest für geistige Arbeit nicht zutrifft.",
]);

// Text 2: information-dense magazine article.
const R_REPARATUR = text("reparatur", "Reparieren statt wegwerfen: ein Recht mit Hindernissen", "Umwelt und Wirtschaft", [
  "Ein Wasserkocher, der nach drei Jahren den Dienst versagt, landet in den meisten Haushalten im Müll. Eine Reparatur kommt selten infrage, und das liegt nicht unbedingt an mangelndem Willen. Häufig sind Ersatzteile schlicht nicht erhältlich, oder ihr Preis übersteigt den eines neuen Geräts. Hinzu kommt, dass viele Produkte so konstruiert sind, dass sie sich ohne Spezialwerkzeug gar nicht öffnen lassen. Die Folgen sind beträchtlich: Jahr für Jahr entstehen in Europa Millionen Tonnen Elektroschrott, von denen nur ein Teil fachgerecht verwertet wird.",
  "Mit neuen Vorschriften auf europäischer Ebene soll sich das ändern. Hersteller bestimmter Gerätegruppen, etwa von Waschmaschinen, Kühlschränken und Smartphones, werden verpflichtet, Ersatzteile über einen festgelegten Zeitraum bereitzuhalten und Reparaturanleitungen zugänglich zu machen. Außerdem dürfen sie unabhängige Werkstätten nicht mehr durch technische Tricks, etwa durch Software, die nur Originalteile akzeptiert, von der Reparatur ausschließen. Für die Kundschaft soll zudem leichter erkennbar werden, wie reparaturfreundlich ein Produkt ist. Vorgesehen ist eine Kennzeichnung, ähnlich den bekannten Angaben zum Energieverbrauch, die schon beim Kauf zeigt, wie leicht sich ein Gerät öffnen lässt und wie lange Ersatzteile erhältlich sind.",
  "Umweltverbände begrüßen die Regeln grundsätzlich, halten sie aber für unzureichend. Ihre Kritik richtet sich vor allem darauf, dass zwar die Verfügbarkeit von Ersatzteilen geregelt wird, nicht aber deren Preis. Solange ein neues Display fast so viel koste wie ein neues Telefon, entscheide sich kaum jemand für die Reparatur, argumentiert eine Sprecherin. Einige Länder setzen deshalb zusätzlich auf finanzielle Anreize: Wer ein Gerät reparieren lässt, erhält einen Zuschuss zu den Kosten. Erste Auswertungen deuten darauf hin, dass solche Programme die Zahl der Reparaturen erhöhen, wobei unklar bleibt, wie viele dieser Reparaturen ohnehin stattgefunden hätten.",
  "Die Hersteller wiederum verweisen auf zusätzliche Kosten. Ersatzteile über viele Jahre zu lagern, binde Kapital und Lagerfläche; diese Kosten würden letztlich an die Kundschaft weitergegeben. Zudem warnen sie vor Sicherheitsrisiken, wenn Laien sich an Geräten mit Akkus oder Hochspannungsteilen versuchen. Kritiker halten dem entgegen, dass dieses Argument seit Jahren vorgebracht werde, um den Markt für Reparaturen zu kontrollieren.",
  "Für das Handwerk könnten die neuen Regeln eine Chance sein. Reparaturbetriebe klagen allerdings schon jetzt über fehlenden Nachwuchs. Eine Ausbildung im Bereich Elektronik ist anspruchsvoll, die Bezahlung im Vergleich zur Industrie eher bescheiden. Ohne qualifizierte Fachkräfte, so die Befürchtung, bleibe das Recht auf Reparatur in vielen Regionen ein Recht auf dem Papier.",
  "Letztlich hängt der Erfolg auch von den Verbraucherinnen und Verbrauchern selbst ab. Umfragen zufolge befürworten zwar die meisten das Reparieren, im Alltag greifen jedoch viele zum Neugerät, weil es bequemer ist oder weil ein neues Modell schlicht attraktiver erscheint. Gesetze können Hindernisse beseitigen; Gewohnheiten ändern sie nicht automatisch.",
]);

// Text 3: commentary with sentence insertion (Goethe C1 Lesen Teil 3 style).
const R_WEITERBILDUNG = text("weiterbildung", "Kommentar: Lernen auf eigene Rechnung?", "Aus- und Weiterbildung", [
  "Kaum eine Festrede über die Zukunft der Arbeit kommt ohne den Begriff des lebenslangen Lernens aus. Technologien verändern sich schneller denn je, Berufsbilder entstehen und verschwinden, und wer den Anschluss nicht verlieren will, muss sich ständig weiterbilden. [1] ___ Wer genauer hinsieht, stellt nämlich fest, dass die Verantwortung dafür zunehmend bei den Einzelnen abgeladen wird. Die Bereitschaft zum Lernen gehört zwar längst zum Standardrepertoire jeder Stellenanzeige, die Zeit dafür jedoch nur selten zum Angebot.",
  "In vielen Betrieben gilt Weiterbildung als freiwillige Zusatzleistung, die man sich in guten Jahren gönnt und in schlechten als Erstes streicht. Kurse finden abends oder am Wochenende statt, die Gebühren tragen die Beschäftigten nicht selten selbst. [2] ___ Wer Kinder betreut, Angehörige pflegt oder im Schichtdienst arbeitet, hat schlicht weniger Gelegenheit, sich nach Feierabend in einen Kurs zu setzen.",
  "Das Ergebnis ist ein bekanntes Muster: Es bilden sich vor allem diejenigen weiter, die ohnehin gut qualifiziert sind. Beschäftigte in einfachen Tätigkeiten, deren Arbeitsplätze am ehesten von Automatisierung bedroht sind, nehmen dagegen deutlich seltener an Weiterbildungen teil. [3] ___ Die Kluft zwischen beiden Gruppen wächst, und mit ihr das Risiko, dass ganze Teile der Belegschaft beim nächsten technologischen Wandel auf der Strecke bleiben.",
  "Hinzu kommt, dass viele Angebote wenig mit dem tatsächlichen Arbeitsalltag zu tun haben. Ein Wochenendseminar über Zeitmanagement ist schnell gebucht, verändert aber oft wenig, wenn die Abläufe im Betrieb dieselben bleiben. Sinnvoller wären Formate, die an konkrete Aufgaben anknüpfen und bei denen sich das Gelernte sofort anwenden lässt.",
  "Dabei liegt es durchaus im Interesse der Unternehmen, hier gegenzusteuern. Fachkräfte sind knapp, und es ist in aller Regel günstiger, vorhandene Mitarbeitende für neue Aufgaben zu qualifizieren, als neue Leute auf einem leer gefegten Arbeitsmarkt zu suchen. [4] ___ Wer Lernzeit als Arbeitszeit anerkennt, signalisiert, dass Weiterbildung kein Privatvergnügen ist, sondern eine Investition, von der beide Seiten profitieren.",
  "Natürlich kann und soll niemand zum Lernen gezwungen werden, und auch die Beschäftigten selbst tragen Verantwortung für ihre berufliche Entwicklung. Doch wer lebenslanges Lernen fordert, muss auch die Bedingungen dafür schaffen. Solange das nicht geschieht, bleibt der schöne Begriff vor allem eines: ein Appell an andere.",
]);

// Text 4: four short positions on one question (Goethe C1 Lesen Teil 4 style).
const R_KI = text("ki-auswahl", "Software in der Personalauswahl: vier Stimmen", "Arbeit und Digitalisierung", [
  "A: Miriam Kessler, Arbeitspsychologin\nMenschen, die Bewerbungen sichten, lassen sich von Dingen beeinflussen, die mit der Stelle nichts zu tun haben: einem vertrauten Namen, einem sympathischen Foto, einer gemeinsamen Heimatstadt. Eine Software, die konsequent auf die Anforderungen der Stelle ausgerichtet ist, kann solche Verzerrungen verringern. Das gelingt allerdings nur, wenn ihre Ergebnisse in regelmäßigen Abständen daraufhin überprüft werden, ob bestimmte Gruppen systematisch schlechter abschneiden. Die endgültige Entscheidung muss in jedem Fall bei einem Menschen liegen. Ich sehe in solchen Programmen eher ein Werkzeug zur Selbstkontrolle als einen Ersatz für menschliches Urteilsvermögen.",
  "B: Tobias Hahn, Personalleiter in einem mittelständischen Unternehmen\nAuf eine Ausbildungsstelle bei uns kommen manchmal mehrere Hundert Bewerbungen. Ohne technische Unterstützung bei der Vorauswahl wäre das kaum zu bewältigen. Mit einem Programm, das Videointerviews automatisch auswertete, haben wir dagegen schlechte Erfahrungen gemacht. Viele Bewerberinnen und Bewerber empfanden das als befremdlich, einige zogen ihre Bewerbung zurück, darunter auch sehr vielversprechende. Wir haben das Verfahren nach wenigen Monaten wieder eingestellt. Für die Sichtung der schriftlichen Unterlagen nutzen wir die Software aber weiterhin, und die Rückmeldungen dazu sind überwiegend positiv.",
  "C: Leyla Aksoy, Professorin für Informatik\nLernende Systeme orientieren sich an den Entscheidungen der Vergangenheit. Wurden in einem Unternehmen jahrelang bestimmte Profile bevorzugt, so lernt die Software genau dieses Muster und setzt es fort, nur schneller und weniger sichtbar. Hinzu kommt, dass selbst die Entwickler oft nicht genau erklären können, warum ein System zu einem bestimmten Ergebnis gelangt. Ich halte es deshalb für unverzichtbar, dass Bewerbende darüber informiert werden, wenn ihre Unterlagen maschinell bewertet werden. Das ist kein Argument gegen solche Systeme, wohl aber eines für mehr Transparenz.",
  "D: Jonas Weber, Berater für Bewerbende\nIn meinen Beratungen erlebe ich, dass viele Menschen ihren Lebenslauf inzwischen vor allem für Maschinen schreiben. Sie übernehmen Schlagwörter aus der Stellenanzeige, in der Hoffnung, die automatische Vorauswahl zu überstehen. Das Ergebnis sind Unterlagen, die sich zum Verwechseln ähneln. Manche meiner Klientinnen und Klienten verbringen mehr Zeit damit, die vermeintlich richtigen Begriffe zu finden, als darüber nachzudenken, was sie eigentlich für die Stelle qualifiziert. Ich rate trotzdem dazu, individuell zu formulieren: Spätestens im Vorstellungsgespräch fällt auf, wenn hinter den richtigen Begriffen wenig Substanz steckt.",
]);

const rPausen = forText(R_PAUSEN.key);
const rReparatur = forText(R_REPARATUR.key);
const rWeiterbildung = forText(R_WEITERBILDUNG.key);
const rKi = forText(R_KI.key);

const readingItems: SeedItem[] = [
  // Pausen
  rPausen.choice("vocabulary", "EASY", "Welches Wort passt in Lücke (1)?",
    "stieg", ["nahm", "legte", "kam"], 2,
    "„ansteigen“: Die Fehlerquote stieg an. „Zunehmen“ und „zulegen“ bräuchten die Partikel „zu“, „ankommen“ passt inhaltlich nicht."),
  rPausen.choice("vocabulary", "MID", "Welches Wort passt in Lücke (2)?",
    "zurück", ["hin", "ab", "an"], 0,
    "Feste Verbindung „etwas auf etwas zurückführen“ (= als Ursache nennen). Mit „hin“, „ab“ oder „an“ entsteht kein passendes Verb."),
  rPausen.choice("detail", "MID", "Was stellte die Studie unter anderem fest?",
    "Wer ohne Pause arbeitete, hielt die eigene Leistung trotz zunehmender Fehler für gut.",
    [
      "Die Fehlerquote der beiden Gruppen unterschied sich schon am Vormittag deutlich.",
      "Auch die Gruppe mit Pausen machte am Nachmittag erheblich mehr Fehler.",
      "Pausen wirkten nur, wenn sie länger als zehn Minuten dauerten.",
    ], 3,
    "Absatz 2: Die Durcharbeitenden „merkten kaum etwas“ und schätzten ihre Leistung „bis zuletzt als gut ein“. Am Vormittag war die Fehlerquote gleich; zur Pausengruppe am Nachmittag und zu längeren Pausen sagt der Text nichts."),
  rPausen.tfng("inference", "HARD",
    [
      ["Wer in der Pause Nachrichten auf dem Handy liest, erholt sich laut Text schlechter.", "R"],
      ["Feste Pausenzeiten haben sich in Unternehmen langfristig als wirksam erwiesen.", "F"],
      ["Die Teilnehmenden durften selbst wählen, zu welcher Gruppe sie gehören wollten.", "NG"],
    ],
    "1 R: Absatz 3 (dieselben geistigen Funktionen, weniger Erholung). 2 F: Absatz 4, die Wirkung lässt sich „nur schwer sagen“, Langzeitstudien fehlen. 3 NG: Wie die Gruppen gebildet wurden, steht nicht im Text."),

  // Reparatur
  rReparatur.choice("gist", "MID", "Welche Aussage fasst den Text am besten zusammen?",
    "Neue Regeln erleichtern Reparaturen, beseitigen aber nicht alle Hindernisse.",
    [
      "Durch die neuen Regeln werden Reparaturen künftig billiger als Neugeräte.",
      "Die Hersteller unterstützen die neuen Regeln, weil sie neue Geschäfte ermöglichen.",
      "Reparaturen scheitern vor allem daran, dass die Menschen sie grundsätzlich ablehnen.",
    ], 1,
    "Der Text beschreibt die neuen Pflichten und danach offene Probleme: Preise, Kosten der Hersteller, Nachwuchs im Handwerk, Gewohnheiten. Die Preise werden gerade nicht geregelt; die Hersteller sind skeptisch; die meisten befürworten das Reparieren."),
  rReparatur.choice("detail", "EASY", "Was kritisieren die Umweltverbände an den neuen Vorschriften vor allem?",
    "Sie legen nicht fest, wie viel Ersatzteile kosten dürfen.",
    [
      "Sie gelten nur für Smartphones, nicht für Haushaltsgeräte.",
      "Sie erlauben es weiterhin, unabhängige Werkstätten auszuschließen.",
      "Sie sehen keine Reparaturanleitungen vor.",
    ], 0,
    "Absatz 3: Geregelt wird die Verfügbarkeit, „nicht aber deren Preis“. Die anderen Optionen widersprechen Absatz 2."),
  rReparatur.choice("inference", "HARD", "Was lässt sich über die finanziellen Zuschüsse sagen, die einige Länder zahlen?",
    "Wie stark sie tatsächlich wirken, lässt sich noch nicht genau sagen.",
    [
      "Sie haben die Zahl der Reparaturen nicht erhöht.",
      "Sie werden von den Herstellern finanziert.",
      "Es gibt sie inzwischen in allen europäischen Ländern.",
    ], 2,
    "Absatz 3: Die Zahl der Reparaturen steigt, „wobei unklar bleibt, wie viele dieser Reparaturen ohnehin stattgefunden hätten“. Der tatsächliche Effekt ist also offen. Finanzierung und Verbreitung werden nicht genannt bzw. nur „einige Länder“."),
  rReparatur.tfng("detail", "MID",
    [
      ["Hersteller dürfen freie Werkstätten künftig nicht mehr mit technischen Mitteln von Reparaturen fernhalten.", "R"],
      ["Die Hersteller geben an, dass die Lagerung von Ersatzteilen keine zusätzlichen Kosten verursacht.", "F"],
      ["Viele Reparaturbetriebe planen wegen der neuen Regeln, mehr Personal einzustellen.", "NG"],
    ],
    "1 R: Absatz 2 (keine technischen Tricks wie Software, die nur Originalteile akzeptiert, um unabhängige Werkstätten auszuschließen). 2 F: Absatz 4, Lagerung „binde Kapital und Lagerfläche“. 3 NG: Der Text erwähnt nur fehlenden Nachwuchs, keine Einstellungspläne."),

  // Weiterbildung
  rWeiterbildung.match("structure", "HARD",
    "Welcher Satz passt in welche Lücke? Zwei Sätze passen nicht.",
    ["Lücke [1]", "Lücke [2]", "Lücke [3]", "Lücke [4]"],
    [
      "Automatisierung betrifft dagegen vor allem hoch qualifizierte Tätigkeiten.",
      "So weit, so richtig, doch die Sache hat einen Haken.",
      "Einige Unternehmen haben daraus bereits die Konsequenz gezogen und feste Lernzeiten in den Arbeitsalltag eingeplant.",
      "Abendkurse aber muss man sich zeitlich erst einmal leisten können.",
      "Wer sich weigert, sich weiterzubilden, verliert deshalb zu Recht seinen Arbeitsplatz.",
      "Das hat weniger mit fehlender Motivation zu tun als mit fehlenden Angeboten und mangelnder Ermutigung durch Vorgesetzte.",
    ],
    [2, 4, 6, 3],
    "[1] „Haken“ bereitet das „nämlich“ des Folgesatzes vor. [2] „Abendkurse“ greift die Kurse am Abend auf und leitet zu den Gruppen mit wenig Zeit über. [3] „Das“ bezieht sich auf die seltenere Teilnahme. [4] „feste Lernzeiten“ wird im nächsten Satz mit „Lernzeit als Arbeitszeit“ aufgenommen. Der Satz zur Automatisierung widerspricht Absatz 3, der Satz zum Arbeitsplatzverlust der Haltung des Kommentars."),
  rWeiterbildung.choice("inference", "MID", "Welche Position vertritt der Kommentar?",
    "Unternehmen sollten Weiterbildung als gemeinsame Aufgabe verstehen und Lernzeit ermöglichen.",
    [
      "Beschäftigte sollten gesetzlich zur Weiterbildung verpflichtet werden.",
      "Weiterbildung ist allein Sache der einzelnen Beschäftigten.",
      "Der Begriff des lebenslangen Lernens sollte nicht mehr verwendet werden.",
    ], 3,
    "Absätze 4 und 5: Lernzeit als Arbeitszeit, Investition für beide Seiten; wer Lernen fordert, muss Bedingungen schaffen. Zwang wird ausdrücklich abgelehnt („niemand gezwungen“); den Begriff kritisiert der Text nur, er will ihn nicht abschaffen."),
  rWeiterbildung.choice("vocabulary", "EASY", "Was bedeutet „auf der Strecke bleiben“ im dritten Absatz?",
    "nicht mithalten können und den Anschluss verlieren",
    [
      "unterwegs eine Pause einlegen",
      "am bisherigen Arbeitsplatz bleiben",
      "sich gegen Veränderungen wehren",
    ], 1,
    "Idiom „auf der Strecke bleiben“ = scheitern, zurückbleiben. Der Kontext (wachsende Kluft, Risiko beim technologischen Wandel) stützt diese Bedeutung."),
  rWeiterbildung.tfng("detail", "MID",
    [
      ["Laut Kommentar wird in wirtschaftlich schwierigen Zeiten oft zuerst bei der Weiterbildung gespart.", "R"],
      ["Gut qualifizierte Beschäftigte bilden sich seltener weiter als gering qualifizierte.", "F"],
      ["Die Gebühren für Weiterbildungskurse sind in den letzten Jahren deutlich gestiegen.", "NG"],
    ],
    "1 R: Absatz 2 („in schlechten als Erstes streicht“). 2 F: Absatz 3, es ist umgekehrt. 3 NG: Dass Beschäftigte Gebühren oft selbst tragen, steht im Text, eine Preisentwicklung nicht."),

  // KI-Auswahl
  rKi.match("gist", "MID",
    "Welche Aussage passt zu welcher Person? Eine Aussage passt zu keiner Person.",
    [
      "Bei sehr vielen Bewerbungen ist eine maschinelle Vorauswahl eine echte Entlastung.",
      "Bewerbende sollten erfahren, ob eine Maschine ihre Unterlagen prüft.",
      "Wer seine Bewerbung nur auf passende Schlagwörter ausrichtet, kommt damit am Ende nicht weit.",
      "Der Einsatz solcher Programme sollte gesetzlich verboten werden.",
    ],
    ["A: Miriam Kessler", "B: Tobias Hahn", "C: Leyla Aksoy", "D: Jonas Weber", "keine der Personen"],
    [2, 3, 4, 5],
    "1 → B (mehrere Hundert Bewerbungen, ohne Unterstützung kaum zu bewältigen). 2 → C (Information der Bewerbenden „unverzichtbar“). 3 → D (spätestens im Gespräch fällt fehlende Substanz auf). 4 → niemand fordert ein Verbot."),
  rKi.choice("detail", "MID", "Unter welcher Voraussetzung kann Software laut Miriam Kessler zu gerechteren Entscheidungen beitragen?",
    "wenn man ihre Ergebnisse immer wieder auf Benachteiligungen hin kontrolliert",
    [
      "wenn sie die endgültige Entscheidung über die Einstellung trifft",
      "wenn sie zusätzlich Fotos und Namen der Bewerbenden auswertet",
      "wenn sie aus den bisherigen Einstellungen des Unternehmens lernt",
    ], 3,
    "Text A: Nur bei regelmäßiger Überprüfung, ob Gruppen systematisch schlechter abschneiden. Die Entscheidung soll beim Menschen bleiben; Fotos und Namen sind gerade die Störfaktoren; das Lernen aus alten Entscheidungen kritisiert Leyla Aksoy (C)."),
  rKi.choice("inference", "HARD", "Worin stimmen Miriam Kessler und Leyla Aksoy überein?",
    "Programme können bestimmte Gruppen benachteiligen, wenn niemand genau hinsieht.",
    [
      "Programme urteilen grundsätzlich fairer als Menschen.",
      "Bewerbende sollten ihre Unterlagen an die Software anpassen.",
      "Videointerviews sollten nicht automatisch ausgewertet werden.",
    ], 2,
    "A verlangt Kontrollen, ob Gruppen „systematisch schlechter abschneiden“; C warnt, dass Software alte Bevorzugungen „weniger sichtbar“ fortsetzt. Fairness „grundsätzlich“ behauptet A nicht; Anpassung an Software thematisiert D, Videointerviews B."),
  rKi.tfng("detail", "EASY",
    [
      ["Das Unternehmen von Tobias Hahn wertet Videointerviews inzwischen nicht mehr automatisch aus.", "R"],
      ["Laut Leyla Aksoy können Entwickler immer nachvollziehen, wie ihr System zu einer Bewertung kommt.", "F"],
      ["Jonas Weber arbeitet selbst für einen Hersteller von Bewerbungssoftware.", "NG"],
    ],
    "1 R: Text B, das Verfahren wurde „wieder eingestellt“. 2 F: Text C, selbst Entwickler können es „oft nicht genau erklären“. 3 NG: Text D nennt nur seine Beratungstätigkeit."),
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
const L_QUEREINSTIEG = clip("quereinstieg", "Interview: Quereinstieg als Strategie", "Arbeit und Arbeitsmarkt",
  [
    { label: "Moderator", voice: "B" },
    { label: "Frau Hartmann", voice: "A" },
  ],
  [
    "Moderator: Herzlich willkommen zu unserer Sendung über die Arbeitswelt. Mein Gast ist heute die Arbeitsmarktforscherin Svenja Hartmann. Frau Hartmann, immer mehr Unternehmen werben gezielt um Quereinsteiger, also um Menschen, die ursprünglich etwas ganz anderes gelernt haben. Ist das eine Notlösung?",
    "Frau Hartmann: Also, ganz ehrlich, am Anfang war es das oft. Wenn man auf eine Stelle keine einzige passende Bewerbung bekommt, wird man eben flexibler. Inzwischen beobachten wir aber, dass viele Betriebe den Quereinstieg ganz bewusst als Strategie nutzen. Und zwar nicht nur, weil Fachkräfte fehlen, sondern weil Leute mit einem anderen Hintergrund oft Perspektiven mitbringen, die im Team bisher gefehlt haben.",
    "Moderator: Können Sie ein Beispiel nennen?",
    "Frau Hartmann: Na ja, nehmen Sie eine ehemalige Erzieherin, die heute in der Softwareentwicklung arbeitet. Die bringt eine Fähigkeit mit, die in der IT gar nicht so selbstverständlich ist: Sie kann komplizierte Dinge so erklären, dass auch Laien sie verstehen. In Projekten, in denen Entwickler eng mit Kunden zusammenarbeiten, ist das unglaublich wertvoll.",
    "Moderator: Gibt es Bereiche, in denen das besonders gut funktioniert?",
    "Frau Hartmann: Erstaunlich gut klappt es überall dort, wo man vieles in der Praxis lernt und schnell sichtbare Fortschritte macht, etwa in der IT oder im Handwerk. Schwieriger ist es in Berufen, für die man eine staatliche Anerkennung braucht. Da führt an einer formalen Qualifikation einfach kein Weg vorbei.",
    "Moderator: Das klingt fast zu schön. Wo liegen denn die Schwierigkeiten?",
    "Frau Hartmann: Die größte Hürde ist, anders als viele denken, nicht die fachliche Einarbeitung. Die lässt sich mit guten Programmen in ein bis zwei Jahren schaffen. Schwieriger ist, dass viele Quereinsteiger anfangs deutlich weniger verdienen als in ihrem alten Beruf, jedenfalls wenn sie dort schon Berufserfahrung hatten. Das muss man sich erst einmal leisten können. Und dann gibt es noch ein Problem, über das selten gesprochen wird: Manche Teams nehmen die Neuen nicht richtig ernst. Da heißt es dann schnell: Die hat ja nicht einmal Informatik studiert.",
    "Moderator: Was können Unternehmen dagegen tun?",
    "Frau Hartmann: Eine ganze Menge. Am besten funktioniert es nach unseren Daten, wenn jede Person, die quer einsteigt, eine feste Ansprechperson im Team bekommt. Also nicht die Führungskraft, sondern eine erfahrene Kollegin oder einen Kollegen auf derselben Ebene. Dort, wo es das gab, waren nach drei Jahren noch rund vier von fünf Quereinsteigern im Betrieb. Ohne diese Begleitung war es, grob gesagt, nur gut die Hälfte.",
    "Moderator: Würden Sie also jedem raten, den Schritt zu wagen?",
    "Frau Hartmann: Jedem? Nein. Ich würde sagen: Wer sich für ein neues Feld wirklich interessiert und eine finanziell schwierige Anfangszeit in Kauf nehmen kann, hat heute bessere Chancen als je zuvor. Wer dagegen vor allem auf ein schnelles höheres Gehalt hofft, wird wahrscheinlich enttäuscht.",
  ],
);

// Clip 2: lecture, one voice (Goethe C1 Hören Teil 4 style).
const L_GRUPPEN = clip("gruppenentscheidungen", "Vortrag: Wann Gruppen gut entscheiden", "Psychologie und Arbeit",
  [{ label: "Dozent", voice: "B" }],
  [
    "Dozent: Guten Morgen, meine Damen und Herren. In unserer heutigen Sitzung geht es um eine Annahme, die in fast allen Organisationen als selbstverständlich gilt, nämlich dass Gruppen bessere Entscheidungen treffen als Einzelne.",
    "Dozent: Auf den ersten Blick spricht vieles dafür. Mehrere Personen verfügen über mehr Wissen, sie können sich gegenseitig auf Fehler hinweisen, und eine gemeinsam getroffene Entscheidung wird später eher von allen mitgetragen. Die Forschung zeigt allerdings, dass sich diese Vorteile nur unter bestimmten Bedingungen tatsächlich einstellen.",
    "Dozent: Ein gut untersuchtes Phänomen ist das sogenannte Gruppendenken. Gemeint ist die Tendenz, in einer Gruppe möglichst schnell Einigkeit herzustellen. Wer Zweifel hat, behält sie lieber für sich, um die gute Stimmung nicht zu gefährden oder nicht als Störenfried zu gelten. Das Ergebnis ist eine scheinbare Übereinstimmung, hinter der sich in Wirklichkeit ganz unterschiedliche Einschätzungen verbergen. Bemerkenswerterweise tritt dieses Phänomen besonders häufig in Gruppen auf, die sich gut verstehen und schon lange zusammenarbeiten. Gerade der Zusammenhalt, den wir im Allgemeinen für etwas Positives halten, kann hier also zum Problem werden.",
    "Dozent: Besonders aufschlussreich finde ich Experimente, in denen jedes Gruppenmitglied vorab unterschiedliche Informationen erhielt. Um die richtige Lösung zu finden, hätten die Teilnehmenden ihr Wissen zusammentragen müssen. Was geschah stattdessen? Die Gruppen sprachen fast ausschließlich über die Informationen, die ohnehin alle kannten. Das, was nur eine einzelne Person wusste, kam kaum zur Sprache. Und so verfehlten viele Gruppen die beste Lösung, obwohl sie gemeinsam über alle nötigen Informationen verfügten.",
    "Dozent: Nun könnte man meinen, die Lösung liege darin, einfach länger zu diskutieren. Das ist aber nur bedingt richtig. Wirksamer sind nach dem bisherigen Stand der Forschung strukturelle Maßnahmen. Zum Beispiel kann man die Mitglieder bitten, ihre Einschätzung zunächst jeweils für sich schriftlich festzuhalten, bevor überhaupt diskutiert wird. Eine andere Möglichkeit besteht darin, eine Person ausdrücklich damit zu beauftragen, Gegenargumente vorzubringen. Diese Rolle sollte übrigens wechseln, damit niemand dauerhaft als Bremser wahrgenommen wird.",
    "Dozent: Auch die Reihenfolge der Wortmeldungen spielt eine Rolle. Wenn die ranghöchste Person zuerst ihre Meinung äußert, schließen sich die anderen häufig an, oft ohne es selbst zu bemerken. Ich empfehle Führungskräften daher, sich in Besprechungen zunächst zurückzuhalten und erst am Ende Stellung zu nehmen.",
    "Dozent: Ich möchte damit nicht sagen, dass Einzelentscheidungen grundsätzlich besser sind. Gruppen haben ein großes Potenzial. Sie schöpfen es aber nur aus, wenn die Bedingungen stimmen. In der nächsten Sitzung schauen wir uns an, wie sich das in Online-Besprechungen verhält.",
  ],
);

// Clip 3: radio discussion, reduced to two voices (Goethe C1 Hören Teil 3 style).
const L_GEHALT = clip("gehaltstransparenz", "Diskussion: Sollen Gehälter offengelegt werden?", "Arbeit und Gesellschaft",
  [
    { label: "Frau Demir", voice: "A" },
    { label: "Herr Lorenz", voice: "B" },
  ],
  [
    "Frau Demir: Herr Lorenz, Sie fordern, dass Unternehmen offenlegen, was ihre Beschäftigten verdienen. Ich muss gestehen, als Inhaberin eines kleinen Betriebs bereitet mir das ziemliche Bauchschmerzen.",
    "Herr Lorenz: Das verstehe ich, aber ich möchte gleich etwas klarstellen. Es geht mir nicht darum, dass jeder die Gehaltsabrechnung seiner Kollegen einsehen kann. Mir geht es um nachvollziehbare Gehaltsbänder: Für jede Stelle wird festgelegt, zwischen welchem Mindest- und welchem Höchstbetrag das Gehalt liegt, und die Kriterien dafür sind allen bekannt.",
    "Frau Demir: Na gut, das klingt schon weniger dramatisch. Trotzdem: In einem Betrieb mit zwölf Leuten weiß man doch sofort, wer gemeint ist. Und es gibt nun mal Gründe, warum jemand mehr verdient, die sich nicht in eine Tabelle pressen lassen. Etwa, weil jemand in einer schwierigen Phase geblieben ist, als andere gegangen sind.",
    "Herr Lorenz: Aber genau das wäre doch ein Kriterium, das man benennen kann, nämlich Betriebszugehörigkeit oder besonderer Einsatz. Das Problem entsteht ja erst, wenn solche Gründe unausgesprochen bleiben. Dann vermuten die Leute nämlich ganz andere Gründe, und die sind meistens weniger schmeichelhaft.",
    "Frau Demir: Und was ist mit denen, die bisher einfach besser verhandelt haben? Die wären dann doch die Verlierer.",
    "Herr Lorenz: Nicht unbedingt. Niemandem wird etwas weggenommen. Aber wer künftig neu verhandelt, muss sich an denselben Kriterien messen lassen wie alle anderen.",
    "Frau Demir: Das mag sein. Nur befürchte ich, dass die Offenlegung zunächst einmal vor allem eines erzeugt, und zwar Unruhe. Wer erfährt, dass er am unteren Ende seines Bandes liegt, ist doch erst mal frustriert.",
    "Herr Lorenz: Kurzfristig, ja, das will ich gar nicht bestreiten. Aus Unternehmen, die umgestellt haben, wissen wir aber, dass sich die Lage meist nach etwa einem Jahr beruhigt. Und dann passiert etwas Interessantes: Die Gespräche über Gehalt werden sachlicher. Man verhandelt nicht mehr darüber, wer am geschicktesten pokert, sondern darüber, was jemand konkret tun muss, um weiterzukommen.",
    "Frau Demir: Das gefällt mir, ehrlich gesagt. Gerade die Zurückhaltenden, die nie von sich aus nach einer Erhöhung fragen würden, hätten dann eine Chance. Wovon ich allerdings nicht überzeugt bin, ist, dass man das per Gesetz für alle Betriebe gleich regeln sollte. Für einen Konzern mit eigener Personalabteilung ist das etwas völlig anderes als für uns.",
    "Herr Lorenz: Da sind wir gar nicht so weit auseinander. Ich könnte mir gut vorstellen, dass kleinere Betriebe mehr Zeit für die Umstellung bekommen und Unterstützung bei der Einführung.",
  ],
);

const lQuer = forClip(L_QUEREINSTIEG.key);
const lGruppen = forClip(L_GRUPPEN.key);
const lGehalt = forClip(L_GEHALT.key);

const listeningItems: SeedItem[] = [
  // Quereinstieg
  lQuer.choice("gist", "EASY", "Wie hat sich die Haltung vieler Unternehmen zum Quereinstieg laut Frau Hartmann verändert?",
    "Aus einer Notlösung ist eine bewusste Personalstrategie geworden.",
    [
      "Sie stellen Quereinsteiger nur noch ein, wenn sich gar keine Fachkräfte finden.",
      "Sie ziehen Quereinsteiger inzwischen ausgebildeten Fachkräften grundsätzlich vor.",
      "Sie lehnen den Quereinstieg zunehmend ab, weil die Einarbeitung zu teuer ist.",
    ], 1,
    "„Am Anfang war es das oft [eine Notlösung] ... Inzwischen ... ganz bewusst als Strategie.“ Eine grundsätzliche Bevorzugung oder Ablehnung wird nicht genannt."),
  lQuer.choice("detail", "MID", "Was nennt Frau Hartmann als größte Hürde für Quereinsteiger?",
    "das zunächst niedrigere Einkommen",
    [
      "die fachliche Einarbeitung",
      "fehlende Abschlüsse in Informatik",
      "die mangelnde Unterstützung durch Führungskräfte",
    ], 3,
    "Die fachliche Einarbeitung wird ausdrücklich verneint („nicht die fachliche Einarbeitung“); „schwieriger ist“, dass man anfangs weniger verdient. Das fehlende Studium ist nur ein Vorurteil mancher Teams."),
  lQuer.choice("detail", "MID", "Was zeigen die Daten zur Begleitung durch eine feste Ansprechperson?",
    "Mit Begleitung bleiben deutlich mehr Quereinsteiger langfristig im Betrieb.",
    [
      "Die Ansprechperson sollte am besten die direkte Führungskraft sein.",
      "Ohne Begleitung verlassen fast alle Quereinsteiger den Betrieb im ersten Jahr.",
      "Mit Begleitung ist die Einarbeitung schon nach drei Monaten abgeschlossen.",
    ], 0,
    "Mit Ansprechperson sind nach drei Jahren rund vier von fünf noch im Betrieb, ohne nur gut die Hälfte. Die Führungskraft wird ausdrücklich ausgeschlossen („also nicht die Führungskraft“)."),
  lQuer.choice("attitude", "HARD", "Wie steht Frau Hartmann zu der Frage, ob jeder den Quereinstieg wagen sollte?",
    "Sie empfiehlt ihn nur unter bestimmten Voraussetzungen.",
    [
      "Sie rät grundsätzlich davon ab.",
      "Sie empfiehlt ihn vor allem wegen der besseren Verdienstmöglichkeiten.",
      "Sie hält ihn für alle sinnvoll, die sich weiterbilden möchten.",
    ], 2,
    "„Jedem? Nein.“ Es lohnt sich bei echtem Interesse und wenn man eine finanziell schwierige Anfangszeit tragen kann; wer auf schnelles Geld hofft, wird enttäuscht."),

  // Gruppenentscheidungen
  lGruppen.choice("gist", "MID", "Worum geht es dem Dozenten in seinem Vortrag vor allem?",
    "zu zeigen, unter welchen Bedingungen Gruppen ihre Stärken wirklich nutzen",
    [
      "zu beweisen, dass Einzelpersonen grundsätzlich klüger entscheiden",
      "zu erklären, wie man Besprechungen zeitlich kürzer gestaltet",
      "verschiedene Länder in ihrer Art zu entscheiden zu vergleichen",
    ], 2,
    "Die Vorteile von Gruppen stellen sich „nur unter bestimmten Bedingungen“ ein; am Ende: „Ich möchte nicht sagen, dass Einzelentscheidungen grundsätzlich besser sind.“"),
  lGruppen.choice("detail", "MID", "Was geschah in den Experimenten, in denen die Mitglieder unterschiedliche Informationen hatten?",
    "Die Gruppen sprachen vor allem über Wissen, das ohnehin alle hatten.",
    [
      "Die Gruppen fanden fast immer die beste Lösung.",
      "Die Gruppen brauchten deutlich länger als Einzelpersonen.",
      "Die Teilnehmenden tauschten ihr Wissen vollständig aus.",
    ], 0,
    "„fast ausschließlich über die Informationen, die ohnehin alle kannten“; Einzelwissen „kam kaum zur Sprache“, viele Gruppen „verfehlten die beste Lösung“. Zur Dauer sagt der Vortrag nichts."),
  lGruppen.tfng("detail", "HARD",
    [
      ["Laut Dozent genügt es meistens, in der Gruppe einfach länger zu diskutieren.", "F"],
      ["Die Aufgabe, Gegenargumente vorzubringen, sollte nicht immer dieselbe Person übernehmen.", "R"],
      ["In den meisten Unternehmen gibt es bereits feste Regeln gegen Gruppendenken.", "NG"],
    ],
    "1 F: „nur bedingt richtig“, wirksamer sind strukturelle Maßnahmen. 2 R: „Diese Rolle sollte übrigens wechseln.“ 3 NG: Über Regeln in Unternehmen spricht der Dozent nicht."),
  lGruppen.choice("detail", "EASY", "Was empfiehlt der Dozent Führungskräften?",
    "die eigene Meinung in Besprechungen erst zum Schluss zu äußern",
    [
      "Besprechungen mit der eigenen Einschätzung zu eröffnen",
      "wichtige Entscheidungen lieber allein zu treffen",
      "die Rolle des Bremsers dauerhaft selbst zu übernehmen",
    ], 3,
    "„sich in Besprechungen zunächst zurückzuhalten und erst am Ende Stellung zu nehmen“, weil sich sonst die anderen anschließen."),

  // Gehaltstransparenz
  lGehalt.match("attitude", "HARD",
    "Wer vertritt welche Ansicht?",
    [
      "Eine Offenlegung führt am Anfang zu Unzufriedenheit.",
      "Gehaltsunterschiede sollten an klar benannte Kriterien gebunden sein.",
      "In kleinen Betrieben lassen sich Gehaltsangaben leicht einzelnen Personen zuordnen.",
      "Über Gehälter sollte im Betrieb grundsätzlich nicht gesprochen werden.",
    ],
    ["Frau Demir", "Herr Lorenz", "beide", "keiner von beiden"],
    [3, 2, 1, 4],
    "1 beide: Frau Demir erwartet Unruhe und Frust, Herr Lorenz bestätigt: „Kurzfristig, ja.“ 2 Herr Lorenz: Kriterien benennen. 3 Frau Demir: „mit zwölf Leuten weiß man sofort, wer gemeint ist“. 4 vertritt niemand."),
  lGehalt.choice("detail", "EASY", "Was schlägt Herr Lorenz konkret vor?",
    "Für jede Stelle soll ein nachvollziehbarer Gehaltsrahmen festgelegt werden.",
    [
      "Alle sollen die Gehaltsabrechnungen ihrer Kollegen einsehen können.",
      "Alle auf derselben Stelle sollen genau gleich viel verdienen.",
      "Erhöhungen sollen nur noch nach Betriebszugehörigkeit vergeben werden.",
    ], 1,
    "Gehaltsbänder mit Mindest- und Höchstbetrag und bekannten Kriterien. Einsicht in einzelne Abrechnungen schließt er ausdrücklich aus; ein Band erlaubt Unterschiede; Betriebszugehörigkeit ist nur ein mögliches Kriterium."),
  lGehalt.choice("inference", "MID", "Welchen Vorteil der Offenlegung erkennt Frau Demir schließlich an?",
    "Auch wer sich nicht traut zu verhandeln, würde fairer bezahlt.",
    [
      "Die Unruhe im Betrieb würde sofort verschwinden.",
      "Kleine Betriebe könnten leichter Personal gewinnen.",
      "Ein Gesetz würde für alle Betriebe dieselben Bedingungen schaffen.",
    ], 3,
    "„Gerade die Zurückhaltenden, die nie ... nach einer Erhöhung fragen würden, hätten dann eine Chance.“ Eine einheitliche gesetzliche Regelung lehnt sie ab; Unruhe erwartet sie gerade."),
  lGehalt.choice("gist", "HARD", "Wie endet die Diskussion?",
    "Beide nähern sich bei der Frage an, wie kleinere Betriebe berücksichtigt werden könnten.",
    [
      "Herr Lorenz gibt seine Forderung vollständig auf.",
      "Frau Demir stimmt einer einheitlichen gesetzlichen Regelung zu.",
      "Beide halten an völlig gegensätzlichen Positionen fest.",
    ], 0,
    "„Da sind wir gar nicht so weit auseinander“: mehr Zeit und Unterstützung für kleinere Betriebe. Er hält an der Forderung fest, sie lehnt eine einheitliche Regelung ab."),
];

// ---------------------------------------------------------------- WRITING

const FORUM = "neutral bis formell (sachlicher Forumsbeitrag)";
const SEMI = "halbformell (Sie, höflich-sachlich)";
const FORMAL = "formell (Sie)";

function write(
  skill: "opinion" | "formal",
  within: Within,
  words: [number, number],
  prompt: string,
  contentPoints: string[],
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
    rubric: { contentPoints, register },
    explanation,
  };
}

const FORUM_WORDS: [number, number] = [200, 280];
const EMAIL_WORDS: [number, number] = [100, 160];
const FORUM_NOTE =
  "Goethe C1 Schreiben Teil 1: Forumsbeitrag von etwa 230 Wörtern. Bewertet werden Aufgabenerfüllung (alle vier Punkte, Textsorte), Kohärenz, Wortschatz und Strukturen; unter 50 % der Wortzahl oder Themaverfehlung führt zu 0 Punkten.";
const EMAIL_NOTE =
  "Goethe C1 Schreiben Teil 2: halbformelle E-Mail von etwa 120 Wörtern. Wichtig sind alle Leitpunkte, ein angemessenes Register (Anrede, Gruß, höfliche Distanz) und ein klares Anliegen.";

const writingItems: SeedItem[] = [
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
    FORUM, FORUM_NOTE),
  write("formal", "EASY", EMAIL_WORDS,
    "Sie haben bei einem Weiterbildungsanbieter einen Präsenzkurs „Projektmanagement“ gebucht. Eine Woche vor Beginn erfahren Sie zufällig auf der Website, dass der Kurs nur noch online stattfindet. Eine Information haben Sie nicht erhalten.\n\n" +
      "Schreiben Sie eine E-Mail an die Kursleitung (etwa 120 Wörter):\n" +
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
    FORMAL, EMAIL_NOTE),
];

// ---------------------------------------------------------------- SPEAKING

const TALK = { thinkSeconds: 240, answerSeconds: 300, maxTakes: 1 };
const DISCUSS = { thinkSeconds: 120, answerSeconds: 180, maxTakes: 1 };

function speak(
  skill: "presentation" | "discussion",
  within: Within,
  prompt: string,
  contentPoints: string[],
  explanation: string,
): SeedItem {
  return {
    section: "SPEAKING",
    level: LEVEL,
    type: "SPEAKING_PROMPT",
    skillTag: `speaking.${skill}`,
    within,
    prompt,
    content: { kind: "SPEAKING", ...(skill === "presentation" ? TALK : DISCUSS) },
    key: { kind: "NONE" },
    rubric: { contentPoints, register: "formell (Sie), sachlich" },
    explanation,
  };
}

const TALK_NOTE =
  "Goethe C1 Sprechen Teil 1: Vortrag von etwa vier bis fünf Minuten. Bewertet werden Aufgabenerfüllung, Kohärenz und Flüssigkeit, Wortschatz, Strukturen und Aussprache.";
const DISCUSS_NOTE =
  "Goethe C1 Sprechen Teil 2 (als aufgezeichneter Gesprächsbeitrag): auf einen Impuls reagieren, Position beziehen, Gegenargumente aufgreifen. Bewertet wird zusätzlich die Fähigkeit, auf andere Meinungen einzugehen.";

const speakingItems: SeedItem[] = [
  speak("presentation", "MID",
    "Halten Sie einen Vortrag von etwa vier bis fünf Minuten zum Thema „Lebenslanges Lernen im Beruf“.\n\n" +
      "- Erklären Sie, was man unter lebenslangem Lernen versteht und warum es heute wichtig ist.\n" +
      "- Beschreiben Sie, wie Weiterbildung in Ihrem beruflichen Umfeld organisiert ist.\n" +
      "- Nennen Sie Vor- und Nachteile verschiedener Lernformen (z. B. Kurse, Onlinelernen, Lernen am Arbeitsplatz).\n" +
      "- Sagen Sie Ihre eigene Meinung und schließen Sie den Vortrag mit einem Fazit ab.",
    [
      "Begriffsklärung und Begründung der Aktualität",
      "Beschreibung der Weiterbildung im eigenen Umfeld",
      "Vor- und Nachteile mehrerer Lernformen",
      "eigene Meinung, Fazit; erkennbare Gliederung mit Einleitung, Überleitungen und Schluss",
    ],
    TALK_NOTE),
  speak("presentation", "MID",
    "Halten Sie einen Vortrag von etwa vier bis fünf Minuten zum Thema „Das Büro der Zukunft“.\n\n" +
      "- Beschreiben Sie, wie sich Arbeitsorte in den letzten Jahren verändert haben.\n" +
      "- Erläutern Sie, welche Rolle das Büro künftig spielen könnte.\n" +
      "- Stellen Sie Chancen und Risiken dieser Entwicklung für Beschäftigte und Unternehmen dar.\n" +
      "- Beziehen Sie Stellung und runden Sie den Vortrag mit einem Ausblick ab.",
    [
      "Beschreibung der Veränderungen von Arbeitsorten",
      "Einschätzung der künftigen Rolle des Büros",
      "Chancen und Risiken aus zwei Perspektiven",
      "begründete eigene Position und Ausblick; flüssiger, zusammenhängender Vortrag",
    ],
    TALK_NOTE),
  speak("presentation", "HARD",
    "Halten Sie einen Vortrag von etwa vier bis fünf Minuten zum Thema „Fachkräftemangel: Ursachen und Lösungswege“.\n\n" +
      "- Erklären Sie, was man unter Fachkräftemangel versteht.\n" +
      "- Nennen Sie mögliche Ursachen.\n" +
      "- Stellen Sie zwei oder drei Lösungswege vor und bewerten Sie diese.\n" +
      "- Erläutern Sie, welchen Weg Sie für am vielversprechendsten halten, und begründen Sie das.",
    [
      "Begriffsklärung",
      "mehrere Ursachen, sachlich verknüpft",
      "zwei bis drei Lösungswege mit Bewertung",
      "begründete Gewichtung und Schluss; differenzierter Wortschatz (z. B. Nominalstil, Abwägung)",
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
    DISCUSS_NOTE),
  speak("discussion", "HARD",
    "Lesen Sie die Meldung und nehmen Sie Stellung.\n\n" +
      "„Immer mehr Firmen ersetzen mehrtägige Präsenzschulungen durch kurze Lernvideos, die die Beschäftigten jederzeit am Arbeitsplatz ansehen können.“\n\n" +
      "Ein Personalleiter sagt: „Das spart Zeit und Geld, und jeder lernt in seinem eigenen Tempo.“\n\n" +
      "- Bewerten Sie diese Entwicklung.\n" +
      "- Gehen Sie auf die Argumente des Personalleiters ein und nennen Sie mögliche Gegenargumente.\n" +
      "- Erläutern Sie, für welche Lerninhalte Videos gut oder weniger gut geeignet sind.\n" +
      "- Schlagen Sie vor, wie man beide Formen sinnvoll verbinden könnte.",
    [
      "begründete Bewertung der Entwicklung",
      "greift die Argumente des Personalleiters auf und stellt Gegenargumente dar",
      "differenziert nach Lerninhalten",
      "konstruktiver Vorschlag zur Kombination; nuancierte Redemittel (Hypothesen, Einschränkungen)",
    ],
    DISCUSS_NOTE),
];

export const C1_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = {
  grammar: { stimuli: [], items: grammarItems },
  reading: { stimuli: [R_PAUSEN, R_REPARATUR, R_WEITERBILDUNG, R_KI], items: readingItems },
  listening: { stimuli: [L_QUEREINSTIEG, L_GRUPPEN, L_GEHALT], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
