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
 * B2 starter bank, written against docs/EXAM-BANK-RESEARCH.md (B2 section):
 * - Grammar: 24 items (8 EASY, 8 MID, 8 HARD) over the B2 inventory, plus one C-test.
 * - Reading: 4 texts with 4 items each (opinion set, article, sentence-gap text, rules).
 * - Listening: 3 clips with 4 items each (expert interview, short lecture, everyday conversation).
 * - Writing: 6 prompts (forum opinion about 150 words, semi-formal/formal message about 100 words).
 * - Speaking: 6 prompts (prepared talk, discussion against a counter-argument, report, message).
 *
 * Single-choice items have three options (A1 to B2 rule). The key position is
 * set explicitly per item and spread evenly over a, b and c in every section.
 */

const LEVEL = "B2" as const;

type Within = NonNullable<SeedItem["within"]>;
type Pos = 0 | 1 | 2;
const IDS = ["a", "b", "c"] as const;

function choiceContent(options: [string, string, string], correct: Pos) {
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
  options: [string, string, string],
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
  gChoice("passiv", "EASY",
    "Der Bericht ___ gestern vom Projektteam fertiggestellt.",
    ["hat", "wurde", "ist"], 1,
    "Vorgangspassiv im Präteritum: wurde + Partizip II. \"ist fertiggestellt\" ohne \"worden\" ist kein Perfekt Passiv, \"hat\" bildet kein Passiv."),
  gChoice("zustandspassiv", "EASY",
    "Keine Sorge, das Büro ___ schon abgeschlossen. Ich habe es vor fünf Minuten selbst gemacht.",
    ["wird", "hat", "ist"], 2,
    "Zustandspassiv (sein + Partizip II): Das Abschließen ist vorbei, beschrieben wird das Ergebnis. \"wird abgeschlossen\" wäre ein laufender Vorgang."),
  gChoice("passiversatz", "EASY",
    "Das Problem mit dem Drucker ___ sich zum Glück schnell beheben.",
    ["ließ", "wurde", "hatte"], 0,
    "Passiversatz mit \"sich lassen\" + Infinitiv (= konnte behoben werden). \"wurde sich\" und \"hatte sich ... beheben\" sind nicht möglich."),
  gChoice("konjunktiv2_vergangenheit", "EASY",
    "Wenn ich das gewusst ___, wäre ich früher gekommen.",
    ["wäre", "würde", "hätte"], 2,
    "Irrealer Bedingungssatz der Vergangenheit: hätte/wäre + Partizip II. \"wissen\" bildet das Perfekt mit \"haben\", also \"gewusst hätte\"."),
  gChoice("konjunktiv1", "EASY",
    "Direkte Rede: „Ich komme morgen später.“ Welche Form ist Konjunktiv I? Er sagte, er ___ morgen später.",
    ["komme", "käme", "kommt"], 0,
    "Konjunktiv I, 3. Person Singular: Stamm + e = \"komme\". \"käme\" ist Konjunktiv II, \"kommt\" Indikativ."),
  gChoice("funktionsverbgefuege", "EASY",
    "Die Firma hat uns für das Projekt drei Laptops zur Verfügung ___.",
    ["gestellt", "gegeben", "gemacht"], 0,
    "Feste Verbindung: etwas zur Verfügung stellen. \"zur Verfügung geben/machen\" gibt es nicht."),
  gGap("konnektoren", "EASY",
    "Je früher wir anfangen, {{g1}} eher sind wir fertig.",
    ["desto", "umso"], ["als", "wie", "desto"],
    "Zweiteiliger Konnektor \"je ... desto/umso\" + Komparativ. \"als\" und \"wie\" sind Vergleichspartikeln, keine Partner von \"je\"."),
  gChoice("genitivpraepositionen", "EASY",
    "___ des schlechten Wetters fand das Sommerfest im Saal statt.",
    ["Trotz", "Obwohl", "Wegen"], 2,
    "Grund für den Umzug in den Saal ist das Wetter: \"wegen\" + Genitiv. \"trotz\" widerspricht dem Sinn, \"obwohl\" ist eine Subjunktion und braucht einen Nebensatz."),

  // ------------------------------------------------------------ MID
  gGap("passiversatz", "MID",
    "Der Ausweis ist bei jedem Besuch am Empfang {{g1}}.",
    ["vorzuzeigen"], ["vorzeigen", "vorzuzeigen", "zu vorzeigen"],
    "Passiversatz sein + zu + Infinitiv (= muss vorgezeigt werden). Bei trennbaren Verben steht \"zu\" zwischen Präfix und Stamm: vorzuzeigen."),
  gGap("konjunktiv2_modal", "MID",
    "Ihr {{g1}} uns vorher Bescheid geben müssen. Jetzt ist es zu spät.",
    ["hättet"], undefined,
    "Konjunktiv II der Vergangenheit mit Modalverb: hätte + Infinitiv + Modalverb im Infinitiv (Ersatzinfinitiv). Zu \"ihr\" gehört \"hättet\"."),
  gChoice("partizipattribut", "MID",
    "Wegen der ständig ___ Mieten suchen viele Familien eine kleinere Wohnung.",
    ["steigende", "gestiegen", "steigenden"], 2,
    "Partizip I als Attribut wird wie ein Adjektiv dekliniert. Genitiv Plural nach bestimmtem Artikel: -en, also \"der steigenden Mieten\"."),
  gChoice("nominalisierung", "MID",
    "Welcher Satz hat dieselbe Bedeutung? „Weil der Zug Verspätung hatte, kam ich zu spät zur Arbeit.“",
    [
      "Trotz der Verspätung des Zuges kam ich zu spät zur Arbeit.",
      "Wegen der Verspätung des Zuges kam ich zu spät zur Arbeit.",
      "Seit der Verspätung des Zuges kam ich zu spät zur Arbeit.",
    ], 1,
    "Ein kausaler weil-Satz wird nominal mit \"wegen\" + Genitiv ausgedrückt. \"trotz\" ist konzessiv, \"seit\" temporal."),
  gChoice("funktionsverbgefuege", "MID",
    "Wir sollten auch eine Lösung ohne externe Beratung in Betracht ___.",
    ["nehmen", "ziehen", "bringen"], 1,
    "Feste Verbindung: etwas in Betracht ziehen (= erwägen). \"in Betracht nehmen\" ist eine typische Vermischung mit \"in Kauf nehmen\"."),
  gChoice("konnektoren", "MID",
    "Man kann im Büro viel Energie sparen, ___ man abends alle Geräte ausschaltet.",
    ["indem", "sodass", "damit"], 0,
    "\"indem\" nennt das Mittel bzw. die Art und Weise (Wie spart man Energie?). \"sodass\" (Folge) und \"damit\" (Zweck) ergeben hier keinen Sinn."),
  gChoice("genitivpraepositionen", "MID",
    "Die Abschiedsfeier findet bei gutem Wetter ___ des Gebäudes im Garten statt.",
    ["innerhalb", "außerhalb", "anstatt"], 1,
    "Der Garten liegt außerhalb des Gebäudes: \"außerhalb\" + Genitiv. \"innerhalb\" widerspricht \"im Garten\", \"anstatt des Gebäudes\" ergibt keinen Sinn."),
  gChoice("modalpartikeln", "MID",
    "„Du weißt doch, dass das Büro freitags früher schließt.“ Was drückt „doch“ in diesem Satz aus?",
    [
      "Der Sprecher widerspricht einer verneinten Frage.",
      "Der Sprecher ist sich nicht sicher, ob das stimmt.",
      "Der Sprecher erinnert an etwas, das der andere eigentlich kennt.",
    ], 2,
    "Unbetontes \"doch\" im Aussagesatz verweist auf bekanntes Wissen (Erinnerung, leichter Vorwurf). Das Antwort-\"doch\" auf eine verneinte Frage ist eine andere Funktion."),

  // ------------------------------------------------------------ HARD
  gChoice("passiv", "HARD",
    "Der Fehler hätte viel früher bemerkt werden ___.",
    ["müssen", "gemusst", "musste"], 0,
    "Konjunktiv II Vergangenheit Passiv mit Modalverb: hätte + Partizip II + werden + Modalverb im Infinitiv (Ersatzinfinitiv), nicht \"gemusst\"."),
  gGap("passiversatz", "HARD",
    "Ergänzen Sie ein Adjektiv auf -bar. Man kann dieses Problem nicht in einer Woche lösen. = Dieses Problem ist in einer Woche nicht {{g1}}.",
    ["lösbar"], undefined,
    "Passiversatz mit Adjektiv auf -bar: lösbar = kann gelöst werden."),
  gGap("konjunktiv2_vergangenheit", "HARD",
    "Wenn der Bus pünktlich gekommen {{g1}}, hätte ich den Termin nicht verpasst.",
    ["wäre"], ["hätte", "wäre", "würde"],
    "\"kommen\" bildet das Perfekt mit \"sein\", im irrealen Bedingungssatz der Vergangenheit also \"gekommen wäre\". \"würde\" bildet keine Vergangenheit."),
  gChoice("konjunktiv1", "HARD",
    "In der indirekten Rede steht Konjunktiv II, wenn Konjunktiv I und Indikativ gleich lauten. Welche Form passt? Die Bewerber sagten, sie ___ keine Erfahrung mit dem Programm.",
    ["haben", "hätten", "hatten"], 1,
    "Konjunktiv I \"sie haben\" ist mit dem Indikativ identisch, daher Ersatzform Konjunktiv II \"hätten\". \"hatten\" ist Indikativ Präteritum."),
  gChoice("partizipattribut", "HARD",
    "Was bedeutet: „die von der Abteilung im letzten Quartal eingeführten Regeln“?",
    [
      "die Regeln, die die Abteilung im letzten Quartal einführen sollte",
      "die Regeln, die für die Abteilung schon vor dem letzten Quartal galten",
      "die Regeln, die die Abteilung im letzten Quartal eingeführt hat",
    ], 2,
    "Erweitertes Partizipialattribut mit Partizip II: passivische, abgeschlossene Handlung; \"von der Abteilung\" nennt den Handelnden. Auflösung als Relativsatz im Aktiv."),
  gGap("nominalisierung", "HARD",
    "Ergänzen Sie das passende Nomen zu „ankommen“. Bei Ihrer {{g1}} im Hotel erhalten Sie sofort den Zimmerschlüssel.",
    ["Ankunft"], undefined,
    "Nominalisierung von \"ankommen\": die Ankunft (Femininum, passt zu \"Ihrer\" im Dativ)."),
  gChoice("konnektoren", "HARD",
    "Die Sitzung beginnt pünktlich um neun, ___ es gibt technische Probleme.",
    ["sofern", "es sei denn", "außer wenn"], 1,
    "Nach \"es sei denn\" kann ein Hauptsatz mit Verb an zweiter Stelle folgen (\"es gibt\"). \"sofern\" und \"außer wenn\" leiten Nebensätze ein und verlangen Verbendstellung."),
  gChoice("praepositionen", "HARD",
    "Unsere Firma legt großen Wert ___, dass alle Termine eingehalten werden.",
    ["darauf", "daran", "dafür"], 0,
    "Feste Verbindung: Wert legen auf etwas, als Präpositionaladverb vor dem dass-Satz: darauf."),
];

const grammarCTest = cTest(LEVEL, "MID", {
  first: "Immer mehr Beschäftigte arbeiten heute zumindest teilweise von zu Hause aus.",
  body:
    "Für viele bedeutet das mehr Freiheit, weil sie sich ihre Zeit selbst einteilen können. " +
    "Gleichzeitig entstehen aber auch neue Probleme, denn die Grenze zwischen Beruf und Privatleben wird oft unscharf. " +
    "Wer nach Feierabend noch Nachrichten beantwortet, findet schwerer zur Ruhe.",
  last: "Fachleute empfehlen deshalb feste Arbeitszeiten und einen eigenen Arbeitsplatz in der Wohnung.",
  // g2 das/dies, g3 Freiheit/Freizeit, g6 selbst/selber are equally correct here.
  variants: { 2: ["ies"], 3: ["zeit"], 6: ["ber"] },
});

const grammar: SeedBankPart = { stimuli: [], items: [grammarCTest, ...grammarItems] };

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
      options: [string, string, string],
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
      "Diese Person möchte, dass Beschäftigte ihr Arbeitszeitmodell selbst wählen können.",
      "Diese Person befürchtet, dass der freie Tag nicht wirklich frei bleibt.",
      "Für diese Person hängt der Erfolg davon ab, wie man Leistung bewertet.",
      "Diese Person sieht im eigenen Betrieb vor allem ein Personalproblem.",
    ],
    ["Selin K.", "Jonas M.", "Amira H.", "Piotr W.", "Lena S."],
    [3, 4, 1, 2],
    "Amira wünscht sich, dass jede und jeder selbst wählen kann; Piotr sorgt sich um E-Mails am freien Freitag; Selin: Messen an Ergebnissen statt Stunden; Jonas findet keine Fachkräfte. Lena passt zu keiner Aussage."),
  r1.choice("inference", "MID",
    "Welche Haltung hat Lena S. zur Vier-Tage-Woche?",
    [
      "Sie lehnt sie ab, weil sie dann weniger verdienen würde.",
      "Sie ist skeptisch, weil längere Arbeitstage für sie belastend wären.",
      "Sie befürwortet sie, wenn die Dienstpläne früher feststehen.",
    ], 1,
    "Lena wäre schon nach acht Stunden müde; das Gehalt bliebe laut Text gleich. Verlässliche Dienstpläne sind ihr wichtiger als ein freier Tag, sie macht sie nicht zur Bedingung für die Vier-Tage-Woche."),
  r1.choice("vocabulary", "EASY",
    "Selin schreibt, man musste jede Besprechung „auf den Prüfstand stellen“. Was bedeutet das hier?",
    ["kritisch überprüfen", "endgültig abschaffen", "schriftlich festhalten"], 0,
    "\"auf den Prüfstand stellen\" = genau prüfen, ob etwas noch sinnvoll ist. Das Streichen ist erst die Folge der Prüfung (\"viele davon streichen\")."),
  r1.tfng("detail", "MID",
    [
      ["In Selins Team wurde während der Testphase genauso viel geleistet wie vorher.", "R"],
      ["Die Kundschaft von Jonas würde einen zusätzlichen geschlossenen Tag problemlos akzeptieren.", "F"],
      ["Piotrs Unternehmen plant, die Vier-Tage-Woche wieder abzuschaffen.", "NG"],
    ],
    "1: \"Die Arbeitsleistung ist gleich geblieben.\" 2: Die Kundschaft erwartet Erreichbarkeit an fünf Tagen. 3: Über eine Abschaffung sagt Piotr nichts."),
];

// ---------------------------------------------------------------- Text 2: article

const rMicrolearning = readingText(
  "microlearning",
  "Lernen in kleinen Portionen",
  "Aus- und Weiterbildung: digitales Lernen im Beruf",
  `
Fünf Minuten in der Straßenbahn, zehn Minuten nach der Mittagspause: Immer mehr Unternehmen setzen bei der Weiterbildung ihrer Beschäftigten auf sogenanntes Microlearning. Statt zwei Tage in einem Seminarraum zu verbringen, bearbeiten die Mitarbeitenden kurze Lerneinheiten am Smartphone oder Laptop, oft nur wenige Minuten lang. Die Idee klingt verlockend: Lernen soll sich nahtlos in den Arbeitsalltag einfügen, ohne dass jemand für längere Zeit am Arbeitsplatz fehlt.

Die Bildungsforscherin Miriam Altun beobachtet den Trend seit einigen Jahren. „Kurze Einheiten haben einen klaren Vorteil“, sagt sie. „Wer neues Wissen in Abständen wiederholt, behält es nachweislich länger als jemand, der alles an einem einzigen Tag aufnimmt.“ Dieses Prinzip des verteilten Lernens sei in der Gedächtnisforschung gut belegt. Allerdings warnt Altun davor, Microlearning als Wundermittel zu betrachten. Für überschaubare Inhalte, etwa neue Sicherheitsvorschriften oder die Funktionen einer Software, eigne es sich hervorragend. Komplexe Fähigkeiten wie Verhandlungsführung oder der Umgang mit Konflikten im Team ließen sich dagegen kaum in Fünf-Minuten-Häppchen vermitteln. „Dafür braucht man Übung, Rückmeldung und den Austausch mit anderen.“

Auch in der Praxis zeigt sich ein gemischtes Bild. Ein mittelständischer Logistikbetrieb hat vor zwei Jahren alle Pflichtschulungen auf eine Lern-App umgestellt. Die Personalleiterin zieht eine überwiegend positive Bilanz: Die Teilnahmequote sei deutlich gestiegen, und die Kosten für Reisen und Seminarräume seien gesunken. Gleichzeitig räumt sie ein, dass vor allem einige ältere Beschäftigte anfangs Schwierigkeiten mit der Technik gehabt hätten. Das Unternehmen bietet deshalb inzwischen Sprechstunden an, in denen sich Kolleginnen und Kollegen gegenseitig helfen.

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
      "Microlearning ist für die meisten Lerninhalte besser geeignet als ein Seminar.",
      "Microlearning bringt wenig, weil man das Gelernte schnell wieder vergisst.",
      "Microlearning ist nützlich, kann aber nicht alle anderen Lernformen ersetzen.",
    ], 2,
    "Altun nennt Vorteile (verteiltes Lernen), warnt aber vor dem \"Wundermittel\" und empfiehlt eine Mischung mit Treffen vor Ort."),
  r2.choice("detail", "EASY",
    "Warum bietet der Logistikbetrieb Sprechstunden an?",
    [
      "Weil einige Beschäftigte anfangs mit der Technik nicht zurechtkamen.",
      "Weil immer weniger Beschäftigte an den Schulungen teilnahmen.",
      "Weil die Kosten für Seminarräume zu hoch geworden waren.",
    ], 0,
    "Einige ältere Beschäftigte hatten Schwierigkeiten mit der Technik, \"deshalb\" gibt es Sprechstunden. Teilnahmequote und Kosten haben sich laut Text positiv entwickelt."),
  r2.choice("inference", "HARD",
    "Was will die Autorin oder der Autor mit dem letzten Satz des Textes zeigen?",
    [
      "Lern-Apps sollten nicht länger als fünf Minuten am Tag genutzt werden.",
      "Auch kurze Lerneinheiten ergeben zusammen viel Zeit, die anerkannt werden sollte.",
      "Arbeitgeber erkennen die Lernzeit mit Apps in der Regel nicht an.",
    ], 1,
    "Der Satz begründet (\"Denn\") den Rat, die Anerkennung der Lernzeit zu prüfen: Wenige Minuten summieren sich zu über zwanzig Stunden im Jahr. Eine Regel, dass Arbeitgeber nicht anerkennen, steht nicht im Text."),
  r2.tfng("detail", "MID",
    [
      ["Laut Altun behält man Wissen länger, wenn man es über einen längeren Zeitraum verteilt lernt.", "R"],
      ["Die Lern-App des Logistikbetriebs wurde von einer externen Firma entwickelt.", "NG"],
      ["Die Gewerkschaften verlangen, dass Lernzeit als Freizeit betrachtet wird.", "F"],
      ["Nach Altun sind Betriebe am erfolgreichsten, die digitale Einheiten und Treffen vor Ort kombinieren.", "R"],
    ],
    "1: verteiltes Lernen, \"behält es nachweislich länger\". 2: Wer die App entwickelt hat, wird nicht gesagt. 3: Gefordert wird das Gegenteil, Lernzeit soll Arbeitszeit sein. 4: steht im vorletzten Absatz."),
];

// ---------------------------------------------------------------- Text 3: sentence-gap text

const rPendeln = readingText(
  "fahrgemeinschaft",
  "Gemeinsam zur Arbeit",
  "Mobilität: Pendeln und Fahrgemeinschaften",
  `
Jeden Morgen dasselbe Bild: Auf den Straßen in die Städte sitzen Tausende Menschen allein in ihren Autos. Dabei wären Fahrgemeinschaften eine naheliegende Alternative. [Lücke 1] Trotzdem fahren nur wenige Beschäftigte regelmäßig gemeinsam zur Arbeit.

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
      "Deshalb fahren die meisten Beschäftigten inzwischen lieber mit dem Fahrrad zur Arbeit.",
      "Auf diese ruhigen Minuten möchten sie ungern verzichten, doch ihre Sorge vor einer unangenehmen Fahrt mit Fremden ist oft unbegründet.",
      "Sie sparen Benzinkosten, entlasten die Straßen und schonen die Umwelt.",
      "Ein einfacher Aushang am Schwarzen Brett reicht dafür meistens nicht aus.",
      "Die Kosten für eine solche App tragen in der Regel die Beschäftigten selbst.",
      "Wer im Schichtdienst arbeitet oder flexible Zeiten hat, weiß morgens oft noch nicht, wann er abends nach Hause fährt.",
    ],
    [3, 6, 2, 4],
    "1: Vorteile, danach \"Trotzdem\". 2: erklärt das Problem der unterschiedlichen Arbeitszeiten, Kontrast \"Wer dagegen feste Dienstzeiten hat\". 3: \"ruhige Minuten\" greift \"Zeit für sich\" auf, \"Das hat ein Pilotprojekt gezeigt\" bezieht sich auf die unbegründete Sorge. 4: leitet zu den Maßnahmen der Arbeitgeber über. Fahrrad- und App-Kosten-Satz passen nirgends."),
  r3.choice("detail", "EASY",
    "Was war laut Umfrage der häufigste Grund, nicht in einer Fahrgemeinschaft zu fahren?",
    [
      "Man möchte die Fahrt als Zeit für sich nutzen.",
      "Es gibt am Arbeitsplatz zu wenige Parkplätze.",
      "Die Arbeitszeiten der Beschäftigten passen nicht zusammen.",
    ], 2,
    "\"Am häufigsten nannten die Befragten unterschiedliche Arbeitszeiten.\" Die Zeit für sich ist der zweite Grund, Parkplätze werden nur als Maßnahme der Arbeitgeber genannt."),
  r3.choice("vocabulary", "MID",
    "Was bedeutet „naheliegend“ im ersten Absatz?",
    ["räumlich nicht weit entfernt", "leicht zu erkennen und sinnvoll", "nur für kurze Zeit möglich"], 1,
    "\"naheliegend\" = sich als Lösung anbietend, offensichtlich. Die wörtliche räumliche Bedeutung ist der typische Fehlschluss."),
  r3.tfng("detail", "MID",
    [
      ["Am Pilotprojekt konnten nur Beschäftigte einer einzigen Firma teilnehmen.", "F"],
      ["Viele Teilnehmende des Pilotprojekts fanden die gemeinsamen Fahrten nach einiger Zeit angenehm.", "R"],
      ["Einige Arbeitgeber sorgen dafür, dass Mitfahrende auch nach Hause kommen, wenn die Fahrerin oder der Fahrer länger bleiben muss.", "R"],
      ["Die meisten Unternehmen zahlen ihren Beschäftigten einen Zuschuss für Fahrgemeinschaften.", "NG"],
    ],
    "1: \"Beschäftigte mehrerer Firmen\". 2: \"die Gespräche während der Fahrt als angenehm zu empfinden\". 3: Taxi-Heimfahrt. 4: Ein Zuschuss wird nicht erwähnt."),
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
    "Welche Überschrift passt zu welchem Abschnitt? Zwei Überschriften bleiben übrig.",
    ["Abschnitt 1", "Abschnitt 2", "Abschnitt 3", "Abschnitt 4", "Abschnitt 5"],
    [
      "Gespräche und Lautstärke",
      "Mitgliedschaft kündigen",
      "Küche und Verpflegung",
      "Zugang und Öffnungszeiten",
      "Besprechungsräume reservieren",
      "Gäste und Besucher",
      "Arbeitsplätze und persönliche Sachen",
    ],
    [4, 7, 5, 1, 3],
    "Jeder Abschnitt hat genau ein Thema: Zugang (1), Plätze und liegen gebliebene Sachen (2), Buchung der Räume (3), Telefonate und Ruhezone (4), Küche (5). Kündigung und Gäste kommen nicht vor."),
  r4.choice("detail", "MID",
    "Was passiert mit Sachen, die über Nacht auf einem Platz im offenen Bereich liegen bleiben?",
    [
      "Sie werden eingesammelt und können am Empfang abgeholt werden.",
      "Sie bleiben bis zum nächsten Morgen am Platz liegen.",
      "Sie werden in ein persönliches Fach eingeschlossen.",
    ], 0,
    "Abschnitt 2: Das Team sammelt sie ein und bewahrt sie eine Woche am Empfang auf."),
  r4.choice("inference", "HARD",
    "Herr Ito hat eine Tageskarte. Was ist für ihn nach den Regeln möglich?",
    [
      "um 21 Uhr noch im Coworking-Space arbeiten",
      "an einem festen Schreibtisch arbeiten",
      "im offenen Bereich kurz etwas mit einer Kollegin besprechen",
    ], 2,
    "Kurze Absprachen in normaler Lautstärke sind im offenen Bereich für alle erlaubt (Abschnitt 4). Mit Tageskarte gilt der Zugang nur bis 20 Uhr, feste Schreibtische sind Monatskarten vorbehalten."),
  r4.tfng("detail", "EASY",
    [
      ["Wer eine Raumbuchung zwei Tage vorher absagt, muss nichts bezahlen.", "R"],
      ["Man darf seine Chipkarte einer Kollegin leihen, wenn man selbst nicht kommt.", "F"],
      ["Für die Nutzung der Telefonkabinen muss man extra bezahlen.", "NG"],
    ],
    "1: Stornierungen bis 24 Stunden vorher sind kostenlos. 2: Die Karte darf nicht weitergegeben werden. 3: Über Kosten der Telefonkabinen steht nichts im Text."),
];

const reading: SeedBankPart = {
  stimuli: [rViertage, rMicrolearning, rPendeln, rCoworking],
  items: [...rViertageItems, ...rMicrolearningItems, ...rPendelnItems, ...rCoworkingItems],
};

// ================================================================ LISTENING

type LSkill = "gist" | "detail" | "attitude" | "inference";

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
      options: [string, string, string],
      correct: Pos,
      explanation: string,
    ): SeedItem => ({ ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...choiceContent(options, correct) }),
    tfng: (skill: LSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem => ({
      ...base(skill, within, "Richtig, falsch oder nicht im Text? Entscheiden Sie für jede Aussage.", explanation),
      type: "TRUE_FALSE_NG",
      ...tfngContent(statements),
    }),
  };
}

// ---------------------------------------------------------------- Clip 1: expert interview

const lPausen = clip(
  "pausen-interview",
  "Radiointerview: Warum Pausen keine verlorene Zeit sind",
  "Arbeit: Gesundheit am Arbeitsplatz",
  [
    { label: "Moderatorin", voice: "B" },
    { label: "Dr. Brandt", voice: "A" },
  ],
  [
    "Moderatorin: Herzlich willkommen zu unserer Sendung über die Arbeitswelt. Mein Gast ist heute der Arbeitspsychologe Dr. Jonas Brandt, und wir sprechen über ein Thema, das viele unterschätzen.",
    "Moderatorin: Herr Brandt, viele Menschen arbeiten durch und essen mittags am Schreibtisch. Ist das wirklich so schlimm?",
    "Dr. Brandt: Na ja, schlimm ist vielleicht das falsche Wort. Aber klug ist es nicht. Unser Gehirn kann sich nur eine begrenzte Zeit voll konzentrieren. Nach etwa neunzig Minuten lässt die Aufmerksamkeit deutlich nach, auch wenn wir das selbst oft gar nicht merken. Wer dann keine Pause macht, arbeitet zwar weiter, aber langsamer und mit mehr Fehlern.",
    "Moderatorin: Viele sagen aber: Ich habe einfach keine Zeit für Pausen.",
    "Dr. Brandt: Das höre ich ständig, und ich verstehe es auch. Aber man muss es umgekehrt sehen. Gerade wer viel zu tun hat, kann sich den Verzicht auf Pausen eigentlich nicht leisten. In einer Studie, an der wir beteiligt waren, hatten Beschäftigte mit regelmäßigen kurzen Pausen am Ende des Tages nicht etwa weniger geschafft als die Vergleichsgruppe, sondern ungefähr gleich viel. Und sie waren deutlich weniger erschöpft.",
    "Moderatorin: Was heißt denn kurz? Reden wir von fünf Minuten oder von einer halben Stunde?",
    "Dr. Brandt: Beides hat seinen Platz. Die Mittagspause sollte schon mindestens eine halbe Stunde dauern. Dazwischen reichen oft kleine Unterbrechungen von drei bis fünf Minuten. Wichtig ist allerdings, was man in dieser Zeit macht. Wer in der Pause aufs Handy schaut und Nachrichten liest, gönnt dem Kopf keine echte Erholung. Besser ist es, aufzustehen, ein paar Schritte zu gehen oder einfach aus dem Fenster zu schauen.",
    "Moderatorin: Und im Homeoffice? Da ist man ja oft allein, und niemand erinnert einen an die Pause.",
    "Dr. Brandt: Genau das ist das Problem. Im Büro geht man mit den Kollegen zusammen in die Kantine, im Homeoffice fehlt dieser natürliche Rhythmus. Ich empfehle deshalb, Pausen wie Termine in den Kalender einzutragen. Das klingt vielleicht übertrieben, aber es funktioniert erstaunlich gut.",
    "Moderatorin: Und was können Führungskräfte tun?",
    "Dr. Brandt: Sehr viel. Wenn die Chefin selbst nie Pause macht und mittags E-Mails verschickt, verstehen die Mitarbeitenden das als Signal, auch wenn niemand es ausspricht. Führungskräfte sollten also mit gutem Beispiel vorangehen. Regeln allein helfen wenig, wenn sie nicht vorgelebt werden.",
    "Moderatorin: Herr Brandt, vielen Dank für das Gespräch.",
  ],
);

const l1 = forClip(lPausen);
const lPausenItems: SeedItem[] = [
  l1.choice("detail", "EASY",
    "Was passiert laut Dr. Brandt, wenn man nach etwa anderthalb Stunden keine Pause macht?",
    [
      "Man merkt sofort, dass man müde wird.",
      "Man kann überhaupt nicht mehr weiterarbeiten.",
      "Man arbeitet weiter, aber weniger effizient.",
    ], 2,
    "\"arbeitet zwar weiter, aber langsamer und mit mehr Fehlern\". Dass man es merkt, wird ausdrücklich verneint (\"oft gar nicht merken\")."),
  l1.choice("detail", "MID",
    "Was hat die Studie gezeigt, an der Dr. Brandt beteiligt war?",
    [
      "Beschäftigte mit Pausen schafften ungefähr gleich viel und waren weniger erschöpft.",
      "Beschäftigte mit Pausen schafften deutlich mehr als die Vergleichsgruppe.",
      "Beschäftigte ohne Pausen waren am Ende des Tages weniger müde.",
    ], 0,
    "\"nicht etwa weniger ..., sondern ungefähr gleich viel. Und sie waren deutlich weniger erschöpft.\" \"Deutlich mehr\" ist eine Übertreibung der Aussage."),
  l1.tfng("detail", "MID",
    [
      ["Die Mittagspause sollte nach Dr. Brandt mindestens dreißig Minuten dauern.", "R"],
      ["Nachrichten auf dem Handy zu lesen, ist laut Dr. Brandt eine gute Form der Erholung.", "F"],
      ["Für das Homeoffice empfiehlt Dr. Brandt, Pausen fest einzuplanen.", "R"],
      ["Dr. Brandt arbeitet selbst überwiegend im Homeoffice.", "NG"],
    ],
    "1: \"mindestens eine halbe Stunde\". 2: Handy in der Pause = \"keine echte Erholung\". 3: Pausen wie Termine in den Kalender eintragen. 4: Über seine eigene Arbeitsweise sagt er nichts."),
  l1.choice("attitude", "HARD",
    "Welche Rolle spielen Führungskräfte nach Meinung von Dr. Brandt?",
    [
      "Sie sollten feste Pausenregeln einführen und deren Einhaltung kontrollieren.",
      "Sie beeinflussen das Pausenverhalten vor allem durch ihr eigenes Vorbild.",
      "Sie haben auf das Pausenverhalten ihrer Teams kaum Einfluss.",
    ], 1,
    "\"mit gutem Beispiel vorangehen\"; \"Regeln allein helfen wenig, wenn sie nicht vorgelebt werden\". Auf die Frage nach ihrem Einfluss antwortet er: \"Sehr viel.\""),
];

// ---------------------------------------------------------------- Clip 2: short lecture

const lAufschieben = clip(
  "vortrag-aufschieben",
  "Kurzvortrag: Warum wir Aufgaben aufschieben",
  "Arbeit und Lernen: Selbstorganisation",
  [{ label: "Referentin", voice: "B" }],
  [
    "Referentin: Guten Tag, meine Damen und Herren. In meinem kurzen Vortrag geht es heute um eine Gewohnheit, die fast jeder von uns aus eigener Erfahrung kennt.",
    "Referentin: Gemeint ist das Aufschieben von Aufgaben. Ich möchte Ihnen zunächst erklären, was dahintersteckt, dann zwei verbreitete Irrtümer besprechen und Ihnen zum Schluss einige praktische Strategien vorstellen.",
    "Referentin: Lange Zeit galt Aufschieben als Zeichen von Faulheit oder schlechtem Zeitmanagement. Die neuere Forschung sieht das anders. Menschen schieben Aufgaben vor allem dann auf, wenn diese mit unangenehmen Gefühlen verbunden sind, zum Beispiel mit Unsicherheit, Langeweile oder der Angst, Fehler zu machen. Das Aufschieben ist also in erster Linie ein Versuch, diesen Gefühlen auszuweichen. Kurzfristig funktioniert das auch, langfristig wird der Druck allerdings immer größer.",
    "Referentin: Damit komme ich zum ersten Irrtum. Viele glauben, sie arbeiteten unter Zeitdruck besonders gut. Untersuchungen zeigen jedoch, dass die Ergebnisse unter Zeitdruck im Durchschnitt schlechter sind. Man fühlt sich zwar produktiv, weil man plötzlich sehr konzentriert ist, aber für Überarbeitungen und Korrekturen bleibt keine Zeit mehr.",
    "Referentin: Der zweite Irrtum betrifft die Motivation. Häufig hört man den Satz: Ich fange an, sobald ich motiviert bin. In Wirklichkeit ist es oft umgekehrt. Die Motivation kommt erst, wenn man bereits angefangen hat und erste Fortschritte sieht.",
    "Referentin: Was kann man also tun? Eine bewährte Methode besteht darin, große Aufgaben in sehr kleine Schritte zu zerlegen. Statt sich vorzunehmen, den ganzen Bericht zu schreiben, nimmt man sich nur vor, die Gliederung zu erstellen. Eine zweite Strategie ist die sogenannte Zwei-Minuten-Regel: Wenn eine Aufgabe weniger als zwei Minuten dauert, erledigt man sie sofort. Und drittens hilft es, Ablenkungen bewusst zu verringern, also zum Beispiel das Handy in einen anderen Raum zu legen.",
    "Referentin: Ein Punkt ist mir zum Schluss noch wichtig. Wer sich für das Aufschieben selbst heftig kritisiert, schiebt danach meist noch mehr auf. Ein freundlicherer Umgang mit sich selbst ist also nicht nur angenehmer, sondern auch wirksamer. Vielen Dank für Ihre Aufmerksamkeit.",
  ],
);

const l2 = forClip(lAufschieben);
const lAufschiebenItems: SeedItem[] = [
  l2.choice("gist", "MID",
    "Wie erklärt die neuere Forschung laut Vortrag das Aufschieben?",
    [
      "als Folge von Faulheit und fehlender Disziplin",
      "als Versuch, unangenehmen Gefühlen auszuweichen",
      "als Zeichen dafür, dass man zu viele Aufgaben hat",
    ], 1,
    "Die frühere Sicht (Faulheit, Zeitmanagement) wird genannt und verworfen; neu ist: Aufschieben vermeidet unangenehme Gefühle."),
  l2.choice("detail", "MID",
    "Was sagt die Referentin über das Arbeiten unter Zeitdruck?",
    [
      "Die Ergebnisse sind meist schlechter, obwohl man sich produktiv fühlt.",
      "Unter Zeitdruck kann man sich schlechter konzentrieren.",
      "Viele Menschen arbeiten unter Zeitdruck tatsächlich besser.",
    ], 0,
    "Ergebnisse \"im Durchschnitt schlechter\", man \"fühlt sich zwar produktiv\". Konzentriert ist man laut Vortrag gerade sehr; besser arbeiten ist der Irrtum."),
  l2.choice("detail", "EASY",
    "Was sagt die Referentin über die Motivation?",
    [
      "Man sollte mit einer Aufgabe warten, bis man motiviert ist.",
      "Sie hängt vor allem davon ab, wie schwierig eine Aufgabe ist.",
      "Sie entsteht oft erst, nachdem man mit einer Aufgabe begonnen hat.",
    ], 2,
    "\"Die Motivation kommt erst, wenn man bereits angefangen hat.\" Option a ist der zitierte Irrtum."),
  l2.tfng("detail", "HARD",
    [
      ["Die Referentin rät, große Aufgaben in kleine Teilschritte aufzuteilen.", "R"],
      ["Nach der Zwei-Minuten-Regel sammelt man kurze Aufgaben und erledigt sie später gemeinsam.", "F"],
      ["Strenge Selbstkritik hilft laut Referentin, weniger aufzuschieben.", "F"],
      ["Die Referentin hat die vorgestellten Strategien selbst entwickelt.", "NG"],
    ],
    "1: \"in sehr kleine Schritte zerlegen\". 2: Kurze Aufgaben erledigt man sofort. 3: Wer sich heftig kritisiert, schiebt noch mehr auf. 4: Wer die Strategien entwickelt hat, sagt sie nicht."),
];

// ---------------------------------------------------------------- Clip 3: everyday conversation

const lTermin = clip(
  "kollegen-termin",
  "Gespräch unter Kollegen: Ein Termin wird verschoben",
  "Arbeit: Termine und Absprachen",
  [
    { label: "Nina", voice: "B" },
    { label: "Tarek", voice: "A" },
  ],
  [
    "Nina: Hallo Tarek, hast du einen Moment? Ich muss mit dir über unseren Kundentermin in der nächsten Woche sprechen.",
    "Tarek: Klar, worum geht's? Ich dachte, da ist alles geklärt.",
    "Nina: Eigentlich schon. Aber die Kundin hat heute Morgen angerufen. Sie kann am Dienstag doch nicht, weil sie an dem Tag auf einer Messe ist.",
    "Tarek: Oh, das ist ärgerlich. Hat sie einen anderen Tag vorgeschlagen?",
    "Nina: Sie hat zuerst Montag gesagt, aber da haben wir ja unsere Teambesprechung, und die können wir nicht so einfach verschieben. Wir haben uns dann auf Donnerstag um zehn geeinigt.",
    "Tarek: Donnerstag passt mir eigentlich ganz gut. Nachmittags habe ich zwar einen Arzttermin, aber das ist ja kein Problem, wenn wir vormittags fertig sind.",
    "Nina: Eben. Das Problem ist ein anderes. Die Kundin möchte jetzt auch die Zahlen vom letzten Quartal sehen, und die haben wir bisher gar nicht in der Präsentation.",
    "Tarek: Hm. Die Zahlen hat doch Sabine aus der Buchhaltung. Soll ich sie fragen?",
    "Nina: Das wäre super. Ich kümmere mich in der Zwischenzeit um die Folien und baue die Struktur ein bisschen um. Ehrlich gesagt war ich mit dem Schluss sowieso nicht ganz zufrieden.",
    "Tarek: Ja, der war ein bisschen lang. Sollen wir uns am Mittwoch noch mal zusammensetzen und alles einmal durchgehen?",
    "Nina: Gute Idee. Mittwoch um drei? Dann haben wir noch genug Zeit, falls etwas fehlt.",
    "Tarek: Passt. Ich schreib dir, sobald ich die Zahlen habe.",
  ],
);

const l3 = forClip(lTermin);
const lTerminItems: SeedItem[] = [
  l3.choice("detail", "EASY",
    "Warum muss der Termin mit der Kundin verschoben werden?",
    [
      "Am geplanten Tag haben Nina und Tarek eine Teambesprechung.",
      "Die Kundin hat am geplanten Tag einen anderen beruflichen Termin.",
      "Tarek hat am geplanten Tag einen Arzttermin.",
    ], 1,
    "Die Kundin ist am Dienstag auf einer Messe. Die Teambesprechung ist am Montag, der Arzttermin am Donnerstagnachmittag."),
  l3.choice("detail", "MID",
    "Wann soll die Präsentation bei der Kundin jetzt stattfinden?",
    ["am Donnerstagvormittag", "am Montagvormittag", "am Mittwochnachmittag"], 0,
    "Einigung auf \"Donnerstag um zehn\". Montag wurde abgelehnt, Mittwoch um drei ist nur das interne Vorbereitungstreffen."),
  l3.tfng("detail", "MID",
    [
      ["Die Kundin möchte in der Präsentation zusätzliche Informationen sehen.", "R"],
      ["Tarek hat die Zahlen vom letzten Quartal bereits vorbereitet.", "F"],
      ["Sabine wird bei der Präsentation dabei sein.", "NG"],
    ],
    "1: Sie möchte die Quartalszahlen sehen. 2: Die Zahlen hat Sabine, Tarek will sie erst fragen. 3: Ob Sabine teilnimmt, wird nicht gesagt."),
  l3.choice("inference", "HARD",
    "Was hat Nina bis zum nächsten Treffen mit Tarek vor?",
    [
      "Sie will Sabine um die fehlenden Zahlen bitten.",
      "Sie will die Kundin noch einmal anrufen.",
      "Sie will die Präsentation überarbeiten, besonders den Schluss.",
    ], 2,
    "Nina kümmert sich um die Folien und die Struktur und war mit dem Schluss unzufrieden. Sabine fragt Tarek."),
];

const listening: SeedBankPart = {
  stimuli: [lPausen, lAufschieben, lTermin],
  items: [...lPausenItems, ...lAufschiebenItems, ...lTerminItems],
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

const FORUM_WORDS: [number, number] = [120, 200];
const MESSAGE_WORDS: [number, number] = [80, 140];
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
    FORUM, FORUM_EXPLANATION),
  writingTask("opinion", "MID", FORUM_WORDS,
    "Ein Unternehmen überlegt, nach Feierabend keine dienstlichen E-Mails mehr an die Beschäftigten weiterzuleiten. In einem Forum wird gefragt: „Ist das eine gute Idee?“\n\n" +
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
    FORMAL, MESSAGE_EXPLANATION),
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
    rubric: register ? { contentPoints, register } : { contentPoints },
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
      "- Berichten Sie von Ihren eigenen Erfahrungen mit Weiterbildung.\n" +
      "- Nennen Sie Vor- und Nachteile und geben Sie Beispiele.\n" +
      "- Sagen Sie Ihre Meinung und kommen Sie zu einem Schluss.",
    [
      "Einleitung: Thema genannt und kurz erklärt",
      "eigene Erfahrung mit Lernen oder Weiterbildung",
      "Vor- und Nachteile mit Beispielen",
      "begründete Meinung und klarer Schluss",
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
    undefined, DISCUSSION_EXPLANATION),
  speakingTask("description", "EASY", SHORT,
    "Erzählen Sie von einer schwierigen Situation in Ihrem Berufs- oder Studienalltag. Was ist passiert? Wie haben Sie reagiert? Was war das Ergebnis, und was haben Sie daraus gelernt?",
    [
      "Situation verständlich beschrieben",
      "eigene Reaktion und Vorgehen",
      "Ergebnis der Situation",
      "Lehre oder Rückblick (z. B. was man heute anders machen würde)",
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
    FORMAL,
    "Höfliche, formelle Sprachnachricht an eine Vorgesetzte. Bewertung: Erfüllung, Kohärenz, Register (Sie, Konjunktiv II), Wortschatz, Strukturen, Aussprache."),
];

const speaking: SeedBankPart = { stimuli: [], items: speakingItems };

export const B2_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = { grammar, reading, listening, writing, speaking };
