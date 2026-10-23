import type { TfngValue } from "@/lib/exam/types";
import { cloze } from "../cloze";
import { cTest } from "../ctest";
import { img } from "../image";
import { openCloze } from "../opencloze";
import { wordBank } from "../wordbank";
import type { SeedBankPart, SeedItem, SeedStimulus } from "../types";

/*
 * A seed item's text is part of its seed key (seed-key.ts). Changing the
 * wording of an item here makes it a new item: the bank top-up then adds it
 * next to the old one in every organisation that already has the old one. To
 * fix wording, add a new item (and retire the old row) rather than editing.
 */

/**
 * C2 starter bank (Goethe-Zertifikat C2: Großes Deutsches Sprachdiplom as the
 * reference, see docs/EXAM-BANK-RESEARCH.md).
 *
 * - Grammar: 24 items (7 EASY, 8 MID, 9 HARD) plus three C-tests, three MC cloze
 *   texts and three word banks (spec 2026-10-18). Single choice and gap choices
 *   have four options, as at C1 and C2 in Goethe.
 * - Reading: six texts (commentary, essay with sections, report with removed
 *   paragraphs, four job ads, an article on noise, an essay on museums), three
 *   items each. The topics are mixed: only four of the twelve texts and clips
 *   are about work.
 * - Listening: six clips (radio feature, two-person debate, expert interview,
 *   a sleep tip with note-taking, a travel agency voicemail with a typed phone
 *   number, a street survey on housing), three items each, at most two voices.
 *   The first three are spoken scripts (versioned keys, see below).
 * - Writing: seven tasks, including a transformation set, a reply to a
 *   journalist's questions from shorthand notes and two 350-word texts.
 * - Speaking: seven tasks, including two five-minute monologues weighing three
 *   statements and a role conflict with a rule to defend.
 *
 * All texts and items are original. Keys of single choice items are spread
 * over a, b, c and d.
 */

const LEVEL = "C2" as const;

type Within = NonNullable<SeedItem["within"]>;
type OptionId = "a" | "b" | "c" | "d";
const IDS: OptionId[] = ["a", "b", "c", "d"];

// ------------------------------------------------------------------ grammar

function choice(
  skill: string,
  within: Within,
  prompt: string,
  options: [string, string, string, string],
  correct: OptionId,
  explanation: string,
): SeedItem {
  return {
    section: "GRAMMAR",
    level: LEVEL,
    type: "SINGLE_CHOICE",
    skillTag: `grammar.${skill}`,
    within,
    prompt,
    content: { kind: "CHOICE", options: options.map((text, i) => ({ id: IDS[i], text })) },
    key: { kind: "CHOICE", correct: [correct] },
    explanation,
  };
}

/** One gap `{{g1}}`. With `choices` it is a drop-down, without it typed. */
function gap(
  skill: string,
  within: Within,
  prompt: string,
  answers: string[],
  explanation: string,
  choices?: string[],
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
  choice("modalverb_subjektiv", "EASY",
    "Formen Sie den Satz mit einem Modalverb um, ohne die Bedeutung zu verändern: „Herr Brandt behauptet, er habe von den Plänen nichts gewusst.“\n→ Herr Brandt ___ von den Plänen nichts gewusst haben.",
    ["soll", "muss", "will", "dürfte"], "c",
    "Subjektives \"wollen\" + Infinitiv Perfekt: Der Satzgegenstand behauptet etwas über sich selbst, wie in der Vorlage (\"Herr Brandt behauptet\"). \"soll\" gäbe die Behauptung anderer wieder, \"muss\" und \"dürfte\" eine Vermutung des Sprechers."),
  // Was "wenngleich" (a B2 connector): "zu ..., als dass" + Konjunktiv II is a genuine C1/C2 consecutive structure.
  choice("konnektor", "EASY",
    "Die Lage ist zu ernst, ___ man sie auf die leichte Schulter nehmen dürfte.",
    ["sodass", "als dass", "damit", "als ob"], "b",
    "\"zu + Adjektiv ..., als dass\" + Konjunktiv II nennt eine Folge, die wegen des Übermaßes gerade nicht eintritt (= so ernst, dass man sie nicht auf die leichte Schulter nehmen darf). \"sodass\" würde eine tatsächliche, bejahte Folge anschließen, die hier unsinnig wäre; \"damit\" ist final; \"als ob\" leitet einen irrealen Vergleich ein und verlangt ein anderes Satzgefüge."),
  gap("praeposition_genitiv", "EASY",
    "{{g1}} eines Stromausfalls stand die Produktion mehrere Stunden lang still.",
    ["Infolge"],
    "\"infolge\" (+ Genitiv) nennt eine Ursache, aus der etwas folgt. \"ungeachtet\" ist konzessiv (= trotz), \"anstelle\" bedeutet Ersatz, \"zwecks\" nennt einen Zweck; alle passen inhaltlich nicht.",
    ["Ungeachtet", "Infolge", "Anstelle", "Zwecks"]),
  // Was "Sollte ... verschieben" (B2, and "Würde" could pass as a second key). Now an unreal past conditional without "wenn".
  choice("konditional_inversion", "EASY",
    "___ der Vertrag rechtzeitig unterzeichnet worden, hätte die Förderung nicht verfallen müssen.",
    ["Hätte", "Würde", "Wäre", "Wurde"], "c",
    "Uneingeleiteter irrealer Konditionalsatz der Vergangenheit: \"Wäre ... unterzeichnet worden\" (Konjunktiv II Plusquamperfekt Passiv, Verb an erster Stelle) = Wenn der Vertrag unterzeichnet worden wäre. \"Hätte\" und \"Würde\" lassen sich nicht mit \"unterzeichnet worden\" verbinden; \"Wurde ...\" wäre eine Entscheidungsfrage im Indikativ."),
  gap("konjunktiv_i", "EASY",
    "Der Sprecher versicherte, man {{g1}} sich der Tragweite der Entscheidung durchaus bewusst. (sein, Konjunktiv I)",
    ["sei"],
    "Indirekte Rede, 3. Person Singular (\"man\"): Konjunktiv I von \"sein\" ist \"sei\" und unterscheidet sich vom Indikativ \"ist\", daher kein Ersatz durch \"wäre\" nötig."),
  choice("funktionsverbgefuege", "EASY",
    "Die Geschäftsleitung hat den Beschäftigten für das kommende Jahr eine Prämie in ___ gestellt.",
    ["Rechnung", "Aussicht", "Abrede", "Kraft"], "b",
    "Funktionsverbgefüge: \"etwas in Aussicht stellen\" (= ankündigen, versprechen). \"in Rechnung stellen\" (berechnen) und \"in Abrede stellen\" (bestreiten) ergeben hier keinen Sinn, \"in Kraft\" verbindet sich mit \"treten\" oder \"setzen\", nicht mit \"stellen\"."),
  choice("lexik_nuance", "EASY",
    "Die Aufgabe war nur ___ einfach; in Wahrheit steckten zahlreiche Fallstricke darin.",
    ["anscheinend", "offenbar", "scheinbar", "vermutlich"], "c",
    "\"scheinbar\" = es sieht so aus, ist aber nicht so (Kontrast \"in Wahrheit\"). \"anscheinend\", \"offenbar\" und \"vermutlich\" drücken aus, dass etwas wahrscheinlich tatsächlich so ist."),
  // Was "als hätte" (a B2 point). "geschweige denn" is a fixed C2 phrase that only one word completes.
  gap("geschweige_denn", "EASY",
    "Er hat sich nie für Verbandspolitik interessiert, {{g1}} für die Arbeit in einem Ausschuss.",
    ["geschweige denn"],
    "\"geschweige denn\" steigert eine Verneinung (= erst recht nicht). \"sondern auch\" setzt eine Verneinung mit \"nicht nur\" voraus, \"und zwar\" präzisiert nur, \"obgleich\" leitet einen Nebensatz ein und kann hier keine Wortgruppe anschließen.",
    ["geschweige denn", "sondern auch", "und zwar", "obgleich"]),

  // ---------------------------------------------------------------- MID
  choice("konzessiv", "MID",
    "___ man es auch dreht und wendet, die Zahlen bleiben enttäuschend.",
    ["Was", "Weil", "Als", "Wie"], "d",
    "Verallgemeinernd-konzessiver Satz \"wie ... auch\" (= egal wie). \"Was\" kollidiert mit dem Objekt \"es\"; \"Weil\" und \"Als\" ergeben mit \"auch\" keinen konzessiven Sinn."),
  // Was a metalinguistic question about indirect speech (and "wären" could pass as a second key). Now the fixed optative use of Konjunktiv I.
  choice("konjunktiv_i", "MID",
    "___ dem, wie ihm wolle: Die Entscheidung bleibt bestehen und wird nicht überprüft.",
    ["Ist", "Wäre", "Werde", "Sei"], "d",
    "Feste Wendung mit Konjunktiv I als Einräumung: \"Sei dem, wie ihm wolle\" (= wie es auch sein mag). Der zweite Teil \"wie ihm wolle\" steht ebenfalls im Konjunktiv I und verlangt \"sei\"; \"Ist\", \"Wäre\" und \"Werde\" bilden keine Wendung dieser Bedeutung."),
  choice("nominalstil", "MID",
    "Formen Sie den Nebensatz in eine Nominalgruppe um: „Nachdem die Firma die Preise erhöht hatte, sank der Absatz.“\n→ ___ sank der Absatz.",
    [
      "Nach der Erhöhung der Firma der Preise",
      "Nach der Firma Erhöhung der Preise",
      "Nach der Erhöhung die Preise durch die Firma",
      "Nach der Erhöhung der Preise durch die Firma",
    ], "d",
    "Im Nominalstil wird das Akkusativobjekt zum Genitivattribut (der Preise), das Subjekt (Agens) wird mit \"durch\" angeschlossen. Zwei Genitive hintereinander oder ein Akkusativ sind falsch."),
  choice("passiversatz", "MID",
    "Welcher Satz hat dieselbe Bedeutung wie „Der Fehler konnte ohne großen Aufwand behoben werden.“?",
    [
      "Der Fehler hatte ohne großen Aufwand behoben zu werden.",
      "Der Fehler ließ sich ohne großen Aufwand beheben.",
      "Der Fehler wurde ohne großen Aufwand zu beheben.",
      "Der Fehler ließ ohne großen Aufwand beheben.",
    ], "b",
    "Passiversatz \"sich lassen\" + Infinitiv = Passiv mit \"können\". \"haben zu\" bedeutet Notwendigkeit mit aktivem Subjekt (und verlangt ein Akkusativobjekt); \"wurde ... zu beheben\" ist ungrammatisch; ohne \"sich\" fehlt das Reflexivpronomen."),
  gap("rektion", "MID",
    "Mit dem Umzug ins Ausland hat sich der Schuldner {{g1}} Zugriff seiner Gläubiger entzogen.",
    ["dem"],
    "\"sich etwas (Dativ) entziehen\": dem Zugriff. Typischer Fehler: Genitiv (\"des\") in Analogie zu \"sich einer Sache enthalten/bedienen\".",
    ["dem", "des", "den", "der"]),
  choice("wortbildung", "MID",
    "Die Fahrerin hat das Hindernis rechtzeitig ___, sodass weder sie noch das Fahrzeug Schaden nahmen.",
    ["umgefahren", "überfahren", "umfahren", "durchgefahren"], "c",
    "Untrennbares \"umfahren\" (Betonung auf -fahren) = um etwas herumfahren, Partizip ohne ge-: \"umfahren\". Trennbares \"umfahren\" (umgefahren) und \"überfahren\" bedeuten, dass das Hindernis getroffen wird, was dem Kontext widerspricht."),
  gap("konnektor", "MID",
    "Die Kundendaten wurden an Dritte weitergegeben, {{g1}} die Betroffenen vorher gefragt worden wären.",
    ["ohne dass"],
    "\"ohne dass\" verneint einen erwarteten Begleitumstand; der Konjunktiv II (\"gefragt worden wären\") ist nach \"ohne dass\" üblich, weil der Sachverhalt nicht eingetreten ist. \"zumal\" ist begründend, \"sofern\" konditional, \"damit\" final; keines passt zu Sinn und Modus.",
    ["zumal", "sofern", "damit", "ohne dass"]),
  choice("idiomatik", "MID",
    "Ob das Projekt im nächsten Jahr weiter finanziert wird, steht noch in den ___.",
    ["Wolken", "Sternen", "Akten", "Händen"], "b",
    "Redewendung \"in den Sternen stehen\" = völlig ungewiss sein. \"in den Akten stehen\" heißt wörtlich, dass etwas festgehalten ist, \"in den Händen\" bildet mit \"stehen\" keine Wendung und \"in den Wolken\" keine mit \"stehen\" in dieser Bedeutung."),

  // ---------------------------------------------------------------- HARD
  choice("paraphrase", "HARD",
    "Welcher Satz gibt die Aussage „Die Maßnahme hätte nicht greifen können, selbst wenn man sie früher beschlossen hätte.“ am genauesten wieder?",
    [
      "Die Maßnahme wirkte nur deshalb nicht, weil sie erst viel zu spät beschlossen worden war.",
      "Auch ein früherer Beschluss hätte der Maßnahme nicht zur Wirkung verholfen.",
      "Mit einem früheren Beschluss hätte die Maßnahme vermutlich gegriffen.",
      "Die Maßnahme griff nicht, obwohl man sie schon früher beschlossen hatte.",
    ], "b",
    "\"selbst wenn ... hätte\" ist ein konzessiver Irrealis der Vergangenheit: Es wird ein früherer Beschluss angenommen und festgestellt, dass er nichts geändert hätte. (a) macht die Verspätung zur Ursache, (c) kehrt die Aussage um, (d) behauptet als Tatsache (Indikativ), dass früher beschlossen wurde."),
  // Was MID: a typed gerundive (zu inside a separable verb plus the adjective ending) is among the hardest C2 forms here.
  gap("partizipialattribut", "HARD",
    "Formen Sie den Relativsatz in ein Attribut um: „Die Unterlagen, die bis Freitag eingereicht werden müssen, liegen noch nicht vor.“\n→ Die bis Freitag {{g1}} Unterlagen liegen noch nicht vor.",
    ["einzureichenden"],
    "Gerundiv (zu + Partizip I) drückt Notwendigkeit im Passiv aus: \"die einzureichenden Unterlagen\" = die Unterlagen, die eingereicht werden müssen. Bei trennbaren Verben steht \"zu\" zwischen Präfix und Stamm."),
  gap("konjunktiv_i", "HARD",
    "Formen Sie die Anweisung in den Stil einer Gebrauchsanleitung um (Konjunktiv I mit „man“): „Beachten Sie, dass alle Angaben ohne Gewähr sind.“\n→ Man {{g1}}, dass alle Angaben ohne Gewähr sind.",
    ["beachte"],
    "Konjunktiv I als Aufforderung (Anleitungs- und Rezeptstil): \"man beachte\", gebildet aus Infinitivstamm + -e."),
  gap("partizipialattribut", "HARD",
    "Der Ausschuss diskutierte die von der Kommission bereits im Frühjahr {{g1}} Vorschläge erneut.",
    ["vorgelegten"],
    "Erweitertes Partizipialattribut: Partizip II (passivisch, abgeschlossen: \"bereits im Frühjahr\") mit Adjektivendung. \"vorzulegenden\" (Zukunft/Notwendigkeit) widerspricht \"bereits\", \"vorlegenden\" ist aktivisch, \"vorgelegt\" ohne Endung ist falsch.",
    ["vorgelegt", "vorlegenden", "vorgelegten", "vorzulegenden"]),
  choice("lexik_nuance", "HARD",
    "Sein Verhalten in der Besprechung war ausgesprochen ___: Er schmollte, weil sein Vorschlag abgelehnt worden war.",
    ["kindisch", "kindlich", "kindgerecht", "kinderleicht"], "a",
    "\"kindisch\" ist abwertend (unreif, bei Erwachsenen). \"kindlich\" ist neutral bis positiv (wie ein Kind), \"kindgerecht\" bedeutet für Kinder geeignet, \"kinderleicht\" sehr einfach; beides passt nicht zum Schmollen eines Erwachsenen."),
  gap("rektion", "HARD",
    "Jede Änderung dieses Vertrags bedarf {{g1}} Schriftform.",
    ["der"],
    "\"bedürfen\" regiert den Genitiv: \"bedarf der Schriftform\" (feste juristische Formel). \"die\" (Akkusativ) und \"zur\" sind typische Fehler.",
    ["die", "der", "zur", "in"]),
  choice("konzessiv", "HARD",
    "___ der Vorschlag auch noch so durchdacht sein, er ist schlicht zu teuer.",
    ["Darf", "Will", "Mag", "Muss"], "c",
    "Konzessiv mit \"mögen\": \"Mag ... auch noch so ..., (Hauptsatz)\" = auch wenn er noch so durchdacht ist. Die anderen Modalverben haben keine konzessive Lesart."),
  // Present main clause: after "wusste" the written norm prefers "hatte teilnehmen können".
  choice("wortstellung", "HARD",
    "Sie weiß, dass er an der Sitzung nicht ___.",
    ["hat teilnehmen können", "teilnehmen können hat", "hatte teilnehmen können", "hat teilgenommen gekonnt"], "a",
    "Perfekt mit Modalverb im Nebensatz: Ersatzinfinitiv (\"können\" statt \"gekonnt\"), und das finite \"hat\" steht vor dem doppelten Infinitiv, nicht am Ende."),

  // ---------------------------------------------------------------- C-test
  cTest(LEVEL, "MID", {
    first:
      "Wer heute einen Beruf erlernt, kann nicht mehr davon ausgehen, das erworbene Wissen ein Leben lang unverändert anwenden zu können.",
    body:
      "Vielmehr verlangt die rasche Entwicklung neuer Technologien, dass Beschäftigte ihre Kenntnisse fortwährend erweitern. " +
      "Unternehmen reagieren darauf zunehmend mit betriebsinternen Kursen, deren Wirksamkeit allerdings umstritten ist. " +
      "Kritiker bemängeln, dass solche Programme häufig eher der Außendarstellung dienen als der tatsächlichen Qualifizierung.",
    last: "Entscheidend dürfte daher sein, ob Lernen als fester Bestandteil der Arbeitszeit anerkannt wird.",
    // Equally correct completions: g2 rasante/rasende, g3 neuester/neuerer/neuartiger,
    // g7 Unternehmer, g13 Kritikerinnen.
    variants: { 2: ["ante", "ende"], 3: ["uester", "uerer", "uartiger"], 7: ["nehmer"], 13: ["ikerinnen"] },
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["angen"], 2: ["chen"], 4: ["nn"], 5: ["ren"],
      6: ["ährende"], 7: ["nehmens"], 8: ["an"], 9: ["ir"],
      10: ["se"], 11: ["ame"], 12: ["itt"], 13: ["ik"],
      14: ["rum"], 15: ["ramm"], 19: ["hliche"],
    },
  }),
  // How memory distorts what we remember.
  cTest(LEVEL, "MID", {
    first: "Gemeinhin behandeln wir unsere Erinnerungen so, als wären sie getreue Abbilder des tatsächlich Erlebten.",
    body:
      "Die Forschung legt jedoch nahe, dass jedes Abrufen einer Erinnerung zugleich deren Umgestaltung bedeutet. " +
      "Spätere Erfahrungen, Erwartungen und Stimmungen fließen unbemerkt ein, sodass sich das Gedächtnis fortwährend neu schreibt. " +
      "Besonders anfällig erweist es sich gegenüber suggestiven Nachfragen.",
    last: "Die Gewissheit, mit der jemand von einem Ereignis berichtet, verbürgt demnach keineswegs, dass es sich auch so zugetragen hat.",
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["cher"], 3: ["nn"], 4: ["ufe"], 5: ["erungen"],
      6: ["m"], 7: ["uten"], 8: ["rung"], 10: ["egen"],
      11: ["ine"], 13: ["htnisse"], 14: ["eue"], 15: ["ndere"],
      16: ["eisen"], 18: ["stive"],
    },
  }),
  // Dialects and identity.
  cTest(LEVEL, "MID", {
    first: "Lange galten Dialekte als Ausdruck mangelnder Bildung, und es hieß, die Schule müsse sie den Kindern möglichst früh abgewöhnen.",
    body:
      "Inzwischen hat sich dieses Urteil grundlegend gewandelt, nicht zuletzt weil die Sprachwissenschaft nachgewiesen hat, " +
      "dass Mundarten eigenständige Systeme mit einer eigenen Grammatik darstellen. " +
      "Für viele Sprecher verkörpert der Dialekt überdies ein Stück Heimat, auf das sie ungern verzichten würden.",
    last: "Gleichwohl wechseln die meisten mühelos zwischen Mundart und Standardsprache, je nachdem, was die Situation erfordert.",
    // g3 "grund...": grundsätzlich is as correct as grundlegend.
    // g13 "Spre...": Sprecherinnen and Sprechende are as correct as Sprecher.
    variants: { 3: ["sätzlich"], 13: ["cherinnen", "chende"] },
    // Wrong parts by the gap whose stem they target.
    distractors: {
      1: ["aben"], 2: ["ser"], 3: ["legende"], 4: ["chts"],
      5: ["gen"], 6: ["sen"], 8: ["art"], 9: ["tem"],
      10: ["nem"], 11: ["matiken"], 13: ["chern"], 14: ["as"],
      16: ["ücke"], 18: ["ind"], 19: ["chtet"],
    },
  }),
];

// MC cloze texts and word banks (spec 2026-10-18), each set easy to hard.
const grammarTexts: SeedItem[] = [
  cloze(LEVEL, "EASY", {
    title: "Vom Wert des Zögerns",
    first: "Wer zögert, gilt in einer auf Tempo getrimmten Gesellschaft rasch als entscheidungsschwach.",
    body:
      "Ist das Zögern [[etwa|eben|ja|halt#idiomatik]] nur ein Zeichen mangelnder Entschlusskraft? " +
      "Wer so urteilt, übersieht, dass sich so manche kluge Entscheidung gerade [[dem|den|des|der#rektion]] Umstand verdankt, dass jemand nicht sofort zugegriffen hat. " +
      "Erst das Innehalten verschafft jene Distanz, [[ohne die|ohne der|ohne deren|ohne denen#relativsatz.praeposition]] sich eine Lage kaum nüchtern beurteilen lässt. " +
      "Nicht von ungefähr [[rät|berät|verrät|errät#wortbildung]] eine alte Volksweisheit, wichtige Entscheidungen zu überschlafen. " +
      "Freilich ist [[zwischen|unter|bei|neben#praeposition]] besonnenem Abwägen und bloßem Aufschieben zu unterscheiden. " +
      "Das eine dient der Klärung, das andere der Vermeidung, [[wenngleich|weil|damit|sofern#konnektor.konzessiv]] sich beide von außen betrachtet zum Verwechseln ähneln. " +
      "Wer aufschiebt, hofft insgeheim, die Sache [[möge|mag|mögen|mochte#konjunktiv_i]] sich von selbst erledigen. " +
      "Der Besonnene hingegen wartet nicht [[mangels|ungeachtet|angesichts|zugunsten#genitiv.praeposition]] eines Plans, sondern um einen besseren zu finden. " +
      "Er nimmt die Ungewissheit des Wartens bewusst [[in Kauf|in Anspruch|in Angriff|zum Anlass#funktionsverbgefuege]], weil sich manche Dinge erst mit der Zeit [[erschließen|erschließt|erschlösse|erschließend#reflexiv]]. " +
      "[[Insofern|Sofern|Sodass|Inwiefern#konnektor]] ist das Zögern weniger ein Mangel als eine Form von Urteilskraft.",
    last: "Gefährlich wird es erst dort, wo aus dem Innehalten ein dauerhaftes Ausweichen wird.",
    note: "Modalpartikel etwa in der Entscheidungsfrage (g1), sich verdanken + Dativ (g2), Relativsatz mit ohne + Akkusativ (g3), Verben mit dem Stamm rat (g4), Präposition bei unterscheiden zwischen (g5), konzessives wenngleich (g6), Konjunktiv I für einen Wunsch in der indirekten Rede (g7), mangels + Genitiv (g8), Funktionsverbgefüge in Kauf nehmen (g9), Kongruenz bei sich erschließen (g10), insofern mit Verbzweitstellung (g11).",
  }),
  cloze(LEVEL, "MID", {
    title: "Über das Übersetzen",
    first: "Dass Übersetzen mehr ist als das Austauschen von Wörtern, weiß jeder, der es je ernsthaft versucht hat.",
    body:
      "Schon ein scheinbar schlichter Satz kann Anspielungen enthalten, [[für die|für deren|für denen|für welchen#relativsatz.praeposition]] es in der Zielsprache keine Entsprechung gibt. " +
      "Eine erfahrene Literaturübersetzerin bemerkte einmal, sie übertrage nie Wörter, sondern stets Wirkungen. " +
      "Ein Wortspiel etwa lässt sich selten wörtlich wiedergeben; [[vielmehr|zumal|obgleich|wohingegen#konnektor]] muss für den Leser ein neues gefunden werden, das ähnlich funktioniert. " +
      "Der im Original [[angelegte|anzulegende|anlegende|angelegten#partizipattribut]] Doppelsinn muss dann auf anderem Wege entstehen. " +
      "Dabei [[gerät|bringt|stellt|setzt#funktionsverbgefuege]] man leicht in Versuchung, sperrige Stellen zu glätten. " +
      "Doch ein sperriger Satz ist [[nun einmal|denn|ruhig|bitte#idiomatik]] nicht dasselbe wie ein misslungener. " +
      "Wer jede Unebenheit tilgt, [[bringt|nimmt|stellt|gibt#rektion]] den Text um seine Eigenart. " +
      "[[Ungeachtet|Mangels|Zufolge|Anhand#genitiv.praeposition]] aller Theorien bleibt das Übersetzen letztlich eine Abfolge einzelner Entscheidungen, [[die|denen|deren|das#relativsatz]] sich kaum in Regeln fassen lassen. " +
      "Eine gelungene Übersetzung liest sich, als [[wäre|ist|würde|hätte#konjunktiv2]] sie in der Zielsprache selbst entstanden. " +
      "Ihr eigentliches Verdienst [[besteht|beruht|basiert|bezieht#verb_praeposition]] darin, dass man sie als solche gar nicht bemerkt.",
    last: "Dass sie dennoch eine eigene schöpferische Leistung ist, wird darüber allzu oft vergessen.",
    note: "Relativsatz mit für + Akkusativ (g1), vielmehr nach Semikolon mit Inversion (g2), Partizipialattribut (g3), in Versuchung geraten (g4), Modalpartikel nun einmal (g5), jemanden um etwas bringen (g6), ungeachtet + Genitiv (g7), Relativpronomen im Plural (g8), irrealer Vergleich mit als + Konjunktiv II (g9), bestehen in (g10).",
  }),
  cloze(LEVEL, "HARD", {
    title: "Vom Verschwinden der Handschrift",
    first: "Kaum eine Kulturtechnik ist in so kurzer Zeit so weit an den Rand gedrängt worden wie das Schreiben mit der Hand.",
    body:
      "Was über Jahrhunderte als Ausweis von Bildung [[galt|gilt|gälte|gegolten#praeteritum]], fristet heute ein Schattendasein auf Einkaufszetteln und Glückwunschkarten. " +
      "[[So|Als|Wenn|Zu#konnektor.konzessiv]] bedauerlich man diesen Wandel auch finden mag, aufhalten lässt er sich kaum. " +
      "Neurowissenschaftler geben indes zu bedenken, beim Schreiben mit der Hand [[werde|werden|worden|wurde#konjunktiv_i]] das Gelernte nachhaltiger im Gedächtnis verankert als beim Tippen. " +
      "Die dabei unvermeidliche Verlangsamung zwinge [[zur|zum|auf|für#verb_praeposition]] Auswahl und fördere so das Verstehen. " +
      "Ein [[Verzicht|Entzug|Abschied|Ausstieg#nominalisierung]] auf die Schreibschrift im Unterricht sei daher voreilig. " +
      "[[Freilich|Folglich|Zumal|Sofern#konnektor]] beweist ein statistischer Zusammenhang noch keine Ursache. " +
      "Viele Studien beruhen auf kleinen Stichproben, und [[mangels|zufolge|seitens|kraft#genitiv.praeposition]] verlässlicher Langzeitdaten lässt sich über die Wirkung im Erwachsenenalter bislang nur spekulieren. " +
      "Ohnehin hieße es, die Handschrift zu unterschätzen, wollte man sie allein ihres Nutzens [[wegen|willen|zuliebe|anstatt#genitiv.praeposition]] verteidigen. " +
      "Wer von Hand schreibt, hinterlässt [[ja|etwa|denn|bloß#idiomatik]] stets auch eine Spur seiner selbst, die sich in keiner Schriftart [[nachbilden|nachbildet|nachgebildet|nachzubilden#infinitiv]] lässt. " +
      "Dass mit der Handschrift auch diese persönliche Note allmählich in Vergessenheit [[gerät|kommt|geht|tritt#funktionsverbgefuege]], wäre der eigentliche Verlust.",
    last: "Ihn vermag keine noch so ausgefeilte Software auszugleichen.",
    note: "Präteritum im Kontrast zu heute (g1), konzessives so ... auch (g2), Konjunktiv I Passiv in der indirekten Rede (g3), zwingen zu (g4), Nominalstil: Verzicht auf (g5), einräumendes freilich (g6), mangels + Genitiv (g7), nachgestelltes wegen nach dem Genitiv (g8), Modalpartikel ja (g9), sich lassen + Infinitiv (g10), in Vergessenheit geraten (g11).",
  }),
  wordBank(LEVEL, "EASY", {
    title: "Über die Höflichkeit",
    first: "Höflichkeit steht im Ruf, eine bloße Äußerlichkeit zu sein, ein Relikt aus Zeiten steifer Umgangsformen.",
    body:
      "Dieser Vorwurf [[verkennt#vocabulary]] jedoch, welche Aufgabe sie im Zusammenleben erfüllt. " +
      "Höfliche Formen schaffen einen [[Spielraum#vocabulary]], in dem Menschen einander begegnen können, [[ohne#infinitiv.ohnezu]] sich sogleich offenbaren zu müssen. " +
      "Wer einem Fremden die Tür aufhält, [[bekundet#vocabulary]] damit keine Zuneigung, sondern lediglich Respekt. " +
      "Gerade diese unverbindliche Form der Zuwendung macht Höflichkeit so wertvoll. " +
      "Sie erlaubt es, Spannungen zu [[entschärfen#vocabulary]], [[bevor#konnektor]] daraus offene Konflikte werden. " +
      "Wer hingegen jede Floskel als [[heuchlerisch#adjektiv]] abtut, übersieht, dass Offenheit ohne Takt leicht verletzend wirkt. " +
      "Nicht selten entpuppt sich die vielgepriesene Ehrlichkeit dann als bloße Rücksichtslosigkeit. " +
      "Höflichkeit ist insofern weniger eine Frage der Etikette als eine der [[Haltung#vocabulary]].",
    last: "Sie gesteht dem anderen zu, mehr zu sein als das, was er im Augenblick von sich zeigt.",
    // Function words (ohne, bevor) beside content words; damit nearly fits the two connector gaps, the rest nearly fit a verb, an adjective and a noun gap.
    distractors: ["damit", "aufrichtig", "Vertrauen", "verletzt"],
  }),
  wordBank(LEVEL, "MID", {
    title: "Die Ökonomie der Aufmerksamkeit",
    first: "Aufmerksamkeit ist zu einer der knappsten Ressourcen unserer Zeit geworden.",
    body:
      "Unzählige Anbieter [[buhlen#vocabulary]] um die wenigen Sekunden, die ein Nutzer einem Inhalt zu schenken bereit ist. " +
      "Viele Plattformen sind gezielt darauf [[ausgelegt#verb_praeposition]], den Blick möglichst lange an den Bildschirm zu binden. " +
      "Was dabei auf der Strecke bleibt, ist die Fähigkeit zur [[Versenkung#nominalisierung]] in eine einzige Sache. " +
      "Wer ständig zwischen Reizen hin- und herspringt, verlernt allmählich, Langeweile zu [[ertragen#infinitiv]]. " +
      "Dabei ist gerade sie häufig der Nährboden für eigenständige Gedanken. " +
      "Kritiker sprechen bereits von einer [[schleichenden#adjektivendung]] Entmündigung, die [[umso#konnektor]] wirksamer sei, als sie kaum bemerkt werde. " +
      "Andere halten solche Diagnosen für [[überzogen#adjektiv]] und verweisen darauf, dass schon jede neue Technik ähnliche Klagen hervorgerufen habe. " +
      "Unbestritten ist jedenfalls, dass sich Aufmerksamkeit nicht beliebig [[vermehren#vocabulary]] lässt.",
    last: "Wer sie verschenkt, sollte daher wenigstens wissen, an wen.",
    // dagegen: an adverb like umso, but no gap takes it; the others nearly fit a noun, a verb and a participle gap.
    distractors: ["Zerstreuung", "verzichten", "gesteigert", "dagegen"],
  }),
  wordBank(LEVEL, "HARD", {
    title: "Stadt im Morgengrauen",
    first: "Um diese Stunde gehört die Stadt noch niemandem.",
    body:
      "Die Straßen liegen [[verwaist#adjektiv]] da, als hätte man sie über Nacht geräumt. " +
      "Nur hin und wieder [[durchbricht#vocabulary]] das Rumpeln eines Lieferwagens die Stille. " +
      "Aus einer Bäckerei [[dringt#vocabulary]] der Geruch von frischem Brot, und hinter einzelnen Fenstern flackert bereits Licht. " +
      "In diesem [[Schwebezustand#wortbildung]] zwischen Nacht und Tag wirkt selbst das Vertraute seltsam fremd. " +
      "Die Fassaden, tagsüber kaum eines Blickes [[gewürdigt#partizipattribut]], treten plötzlich in ihrer ganzen Eigenart hervor. " +
      "Man meint, die Stadt [[atme#konjunktiv_i]] noch einmal tief durch, bevor sie sich dem Lärm des Tages überlässt. " +
      "Doch dieser Zauber ist [[flüchtig#adjektiv]]. " +
      "Wer ihn einmal bewusst erlebt hat, begegnet dem Gewohnten [[fortan#lexik_nuance]] mit größerer Achtsamkeit.",
    last: "Spätestens wenn die ersten Busse fahren, hat der Alltag die Stadt wieder in Besitz genommen.",
    // zuvor is an adverb like fortan but contradicts the tense; betrachtet nearly fits gewürdigt but takes no genitive.
    distractors: ["erwachen", "Dämmerung", "geschäftig", "zuvor", "betrachtet"],
  }),
];

// ------------------------------------------------------------------ reading

type RSkill = "gist" | "detail" | "inference" | "vocabulary" | "structure" | "attitude";

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
      options: [string, string, string, string],
      correct: OptionId,
      explanation: string,
    ): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "SINGLE_CHOICE",
        content: { kind: "CHOICE", options: options.map((text, i) => ({ id: IDS[i], text })) },
        key: { kind: "CHOICE", correct: [correct] },
      };
    },
    tfng(skill: RSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      const ids = statements.map((_, i) => `s${i + 1}`);
      return {
        ...base(skill, within, "Richtig (R), falsch (F) oder nicht im Text (NG)?", explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", statements: statements.map(([text], i) => ({ id: ids[i], text })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, v], i) => [ids[i], v])) },
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
          left: left.map((text, i) => ({ id: `l${i + 1}`, text })),
          right: right.map((text, i) => ({ id: `r${i + 1}`, text })),
        },
        key: { kind: "MATCHING", pairs: Object.fromEntries(pairs.map((r, i) => [`l${i + 1}`, `r${r}`])) },
      };
    },
  };
}

const R_KOMMENTAR = "v2-r-c2-kommentar-kennzahlen";
const R_ESSAY = "v2-r-c2-essay-unfertiges";
const R_BERICHT = "v2-r-c2-bericht-viertagewoche";
const R_ANZEIGEN = "v2-r-c2-stellenanzeigen";
const R_LAERM = "v2-r-c2-laerm-stadt";
const R_MUSEUM = "v2-r-c2-museum-original";

const readingStimuli: SeedStimulus[] = [
  {
    key: R_KOMMENTAR,
    section: "READING",
    level: LEVEL,
    title: "Was nicht gezählt wird, zählt nicht? Ein Kommentar",
    topic: "Arbeit",
    body: `Es gibt Sätze, die so einleuchtend klingen, dass man sie nicht mehr prüft. „Was man nicht messen kann, kann man nicht steuern“ gehört dazu. Er hängt, in wechselnden Schriftarten, in Besprechungsräumen, er ziert Präsentationsfolien und Jahresberichte, und wer ihm widerspricht, setzt sich dem Verdacht aus, etwas verbergen zu wollen. Dabei lohnt es sich, den Satz einmal von der anderen Seite zu lesen: Was man messen kann, das steuert irgendwann einen selbst.

Man muss kein Technikskeptiker sein, um das zu bemerken. In vielen Unternehmen werden inzwischen nicht nur Umsätze und Liefertermine erfasst, sondern auch die Zahl der beantworteten Mails, die durchschnittliche Dauer eines Kundengesprächs oder die Minuten, die zwischen zwei Tastatureingaben vergehen. Hinzu kommen Zufriedenheitsumfragen, deren Ergebnisse auf eine Nachkommastelle genau berichtet werden, als ließe sich Stimmung wiegen. Die Instrumente dafür sind billig geworden, und was billig ist, wird bekanntlich auch genutzt. Die Dashboards leuchten in beruhigendem Grün, solange die Kurven in die gewünschte Richtung zeigen, und kaum jemand fragt, ob die Kurven überhaupt abbilden, worauf es ankommt.

Genau hier liegt das Problem. Eine Kennzahl ist ein Stellvertreter: Sie steht für etwas, das man eigentlich wissen will, aber nicht direkt beobachten kann. Solange niemand von ihr abhängt, ist sie ein brauchbares Thermometer. Sobald jedoch Prämien, Beförderungen oder auch nur das Ansehen im Team an ihr hängen, beginnt sie, genau das Verhalten zu formen, das sie eigentlich nur messen sollte. Wer nach der Zahl erledigter Tickets beurteilt wird, zerlegt große Probleme in viele kleine. Wer kurze Gesprächszeiten vorweisen muss, beendet schwierige Telefonate eben früher, und der Kunde ruft am nächsten Tag ein zweites Mal an, was die Statistik erfreulicherweise als zwei erfolgreich bearbeitete Fälle verbucht.

Man könnte nun einwenden, das seien Kinderkrankheiten, die sich mit klügeren Kennzahlen beheben ließen. Dieser Einwand ist nicht falsch, aber er unterschätzt die Fantasie der Gemessenen. Jede neue Zahl erzeugt neue Ausweichbewegungen, und so entsteht ein Wettlauf, bei dem das Controlling stets einen Schritt zu spät kommt. Am Ende wird nicht mehr die Arbeit optimiert, sondern ihre Darstellung.

Neu ist diese Beobachtung übrigens nicht. Ein britischer Ökonom hat schon vor Jahrzehnten festgehalten, dass eine Kennzahl ihre Aussagekraft verliert, sobald man sie zum Ziel erklärt. Dass dieser Befund in Managementseminaren gern zitiert und im Alltag ebenso gern vergessen wird, gehört zu den kleineren Paradoxien des Berufslebens. Man nickt, wenn er an die Wand geworfen wird, und kehrt anschließend zu seinem Dashboard zurück, als hätte man nichts gehört.

Hinzu kommt ein subtilerer Effekt. Was sich zählen lässt, gewinnt an Gewicht, was sich nicht zählen lässt, verliert es, und zwar unabhängig davon, wie wichtig es tatsächlich ist. Die Kollegin, die neue Mitarbeiter einarbeitet, Konflikte entschärft, bevor sie eskalieren, oder ein Projekt rettet, indem sie im richtigen Moment die richtige Frage stellt, taucht in keiner Auswertung auf. Ihre Leistung ist nicht unsichtbar, weil sie gering wäre, sondern weil sie in den Zwischenräumen stattfindet, die keine Software erfasst. Es hätte schon eine gewisse Ironie, wenn ausgerechnet diejenigen, die eine Organisation zusammenhalten, bei der nächsten Sparrunde als Erste auffielen, weil ihre Kurven so blass aussehen.

Schließlich verändert die lückenlose Erfassung auch das Verhältnis zwischen denen, die messen, und denen, die gemessen werden. Wer weiß, dass jede Minute protokolliert wird, schließt daraus, dass Vertrauen offenbar nicht vorgesehen ist, und verhält sich entsprechend: vorsichtig, regelkonform, ohne Neigung zu jenen kleinen Abweichungen vom Plan, aus denen gelegentlich die besten Ideen entstehen. Viele Unternehmen beschwören in ihren Leitbildern genau das, was ihre Dashboards systematisch entmutigen: Eigeninitiative, Mut zum Risiko, unternehmerisches Denken. Man kann jedoch nicht gleichzeitig Selbstständigkeit verlangen und jeden Handgriff kontrollieren, ohne dass die Beschäftigten merken, welche der beiden Botschaften die Organisation tatsächlich ernst meint.

Nichts davon spricht dagegen, zu messen. Bei standardisierten Abläufen, in der Logistik etwa oder in der Fertigung, liefern Kennzahlen wertvolle Hinweise, und wer sie ignoriert, handelt fahrlässig. Fragwürdig wird es erst dort, wo Arbeit vor allem aus Urteilskraft besteht: in der Beratung, in der Forschung, in der Pflege von Beziehungen. Dort sind Zahlen bestenfalls Anlass für ein Gespräch, nicht dessen Ersatz.

Vielleicht wäre schon viel gewonnen, wenn Führungskräfte sich angewöhnten, bei jeder Kennzahl drei Fragen zu stellen: Wofür steht sie? Was würde jemand tun, der sie verbessern will, ohne die Sache selbst zu verbessern? Und was übersehen wir, weil wir auf sie schauen? Wer diese Fragen ehrlich beantwortet, wird manche Kurve aus seinem Dashboard entfernen. Das mag sich zunächst anfühlen wie ein Verlust an Kontrolle. Tatsächlich ist es oft das Gegenteil: der Moment, in dem man aufhört, die Landkarte mit der Landschaft zu verwechseln.`,
  },
  {
    key: R_ESSAY,
    section: "READING",
    level: LEVEL,
    title: "Lob des Unfertigen",
    topic: "Arbeitskultur",
    body: `A
Wer in einer Besprechung einen Gedanken äußert, der noch nicht zu Ende gedacht ist, tut dies in vielen Organisationen mit einer entschuldigenden Vorbemerkung: „Das ist jetzt nur so eine Idee“ oder „Ich habe das noch nicht durchgerechnet“. Solche Floskeln verraten mehr über die Kultur eines Hauses als jedes Leitbild an der Wand. Sie zeigen, dass Unfertiges als Makel gilt, als etwas, das man eigentlich nicht vorzeigen sollte, bevor es poliert, abgesichert und von allen Seiten gegen Einwände verteidigt ist. Man kennt diese Formeln so gut, dass man sie kaum noch hört; dabei sind sie kleine Rituale der Selbstabsicherung, mit denen sich der Sprecher vorsorglich von seinem eigenen Gedanken distanziert. Bemerkenswert ist, dass auch erfahrene Kräfte zu solchen Formeln greifen, also Menschen, deren Kompetenz eigentlich niemand in Zweifel zieht.

B
Diese Haltung hat eine nachvollziehbare Herkunft. In Schule, Ausbildung und Studium werden fast ausschließlich Ergebnisse bewertet; der Weg dorthin, mit seinen Umwegen und Sackgassen, bleibt unsichtbar und bringt keine Punkte. Auch in Zeugnissen und Beurteilungen taucht der mühsame, tastende Teil der Arbeit selten auf; gelobt wird, wer liefert, nicht, wer klug gesucht hat. Wer jahrelang gelernt hat, dass nur das fertige Produkt zählt, überträgt dieses Muster später auf den Beruf. Hinzu kommt die Sorge um den eigenen Ruf: Ein halbgarer Vorschlag könnte, so die Befürchtung, das Bild der eigenen Kompetenz beschädigen, das man sich mühsam aufgebaut hat. Lieber schweigt man, bis man sicher ist.

C
Die Kosten dieser Vorsicht sind beträchtlich, auch wenn sie in keiner Bilanz auftauchen. Ideen, die zu lange im Verborgenen reifen, werden oft erst dann vorgestellt, wenn bereits viel Zeit und Mühe in sie geflossen sind. Stellt sich dann heraus, dass eine grundlegende Annahme nicht trägt, ist die Enttäuschung groß und die Bereitschaft, den Irrtum einzugestehen, entsprechend gering. Nicht selten wird ein Vorhaben dann weiterverfolgt, obwohl alle Beteiligten ahnen, dass es auf schwachen Füßen steht. Psychologisch ist das gut nachvollziehbar: Je mehr man investiert hat, desto schwerer fällt es, sich von einer Sache zu trennen, und desto eher sucht man nach Gründen, sie fortzusetzen. Das Verborgene schützt also nicht nur vor fremder Kritik, es macht auch unempfindlich gegen die eigene. Hätte man den Entwurf früher gezeigt, wäre der Denkfehler womöglich in einer Viertelstunde aufgefallen.

D
Es wäre allerdings naiv, nun das Gegenteil zu fordern und jede spontane Eingebung sofort in die Runde zu werfen. Nicht jeder Gedanke verdient die Aufmerksamkeit von zehn Menschen, und wer seine Kolleginnen und Kollegen mit ungeordneten Einfällen überschüttet, verschiebt lediglich die Arbeit des Sortierens auf andere. Wer jede halbe Idee laut denkt, verliert zudem an Glaubwürdigkeit: Irgendwann hört man ihm nicht mehr genau zu, weil man gelernt hat, dass das meiste ohnehin wieder verworfen wird. Hinzu kommt, dass nicht jede Runde der richtige Ort dafür ist: In einer Sitzung, in der eine Entscheidung fallen muss, stiftet ein halber Gedanke eher Verwirrung als Klarheit. Offenheit ist also keine Tugend an sich, sondern ein Werkzeug, und wie jedes Werkzeug kann man es falsch einsetzen. Das Unfertige zu zeigen, ist nur dann ein Gewinn, wenn klar ist, wozu man es zeigt: um eine Richtung zu prüfen, eine Lücke zu entdecken, einen Einwand frühzeitig zu hören.

E
Damit dies gelingt, braucht es mehr als den gut gemeinten Appell, offener zu sein. Entscheidend ist, wie auf Unfertiges reagiert wird. Wenn ein erster Entwurf mit derselben Strenge beurteilt wird wie ein abgeschlossener Bericht, wird niemand ein zweites Mal etwas Unfertiges vorlegen. Einige Teams haben deshalb feste Formate eingeführt, in denen ausdrücklich nur Rohfassungen besprochen werden und in denen Kritik als Frage formuliert werden muss, nicht als Urteil. Das klingt nach einer Kleinigkeit, verändert aber spürbar den Ton. Auch Vorgesetzte haben hier eine Vorbildrolle: Wenn sie selbst gelegentlich einen unfertigen Gedanken zur Diskussion stellen und sich dabei korrigieren lassen, bewirkt das mehr als jedes Rundschreiben über Fehlerkultur.

F
Am Ende geht es um eine Verschiebung dessen, was als professionell gilt. Professionell ist nicht, wer nie etwas Unausgegorenes zeigt, sondern wer den richtigen Zeitpunkt und den richtigen Rahmen dafür findet. Das setzt voraus, dass man Professionalität nicht länger mit einer makellosen Oberfläche verwechselt, sondern sie in der Fähigkeit erkennt, Unsicherheit produktiv zu machen. Eine Organisation, die das versteht, wird deshalb nicht fehlerfrei arbeiten. Aber sie wird ihre Fehler früher machen, und das heißt: billiger.`,
  },
  {
    key: R_BERICHT,
    section: "READING",
    level: LEVEL,
    title: "Weniger Tage, gleiche Arbeit? Bilanz eines Pilotversuchs",
    topic: "Arbeitszeit",
    body: `Als die Geschäftsführung der Hallberg Messtechnik GmbH im vergangenen Frühjahr ankündigte, ein Jahr lang die Viertagewoche zu erproben, waren die Reaktionen gemischt. Für das Unternehmen, das Messinstrumente für Labore und Industriebetriebe herstellt, war der Versuch in erster Linie eine Antwort auf den Fachkräftemangel: Man hoffte, als Arbeitgeber attraktiver zu werden. Ein Teil der rund hundertachtzig Beschäftigten begrüßte die Aussicht auf ein verlängertes Wochenende, andere befürchteten, dieselbe Arbeit nun in kürzerer Zeit und unter größerem Druck erledigen zu müssen. Inzwischen liegt der Abschlussbericht vor, und er fällt differenzierter aus, als es Befürworter wie Gegner erwartet hatten.

[Lücke 1]

In der Fertigung zeigten sich die Effekte am deutlichsten. Weil die Anlagen nicht einfach einen Tag stillstehen können, mussten die Schichten neu verteilt werden, was in den ersten Wochen zu erheblichen Reibungen führte: Absprachen klappten nicht, Übergaben gingen verloren, und mancher Schichtleiter sprach offen von Chaos. Nach etwa drei Monaten hatte sich das neue System jedoch eingespielt. Die Ausschussquote sank leicht, die Zahl der Krankheitstage ging um knapp ein Fünftel zurück. Auffällig war zudem, dass sich mehrere Beschäftigte, die zuvor in Teilzeit gearbeitet hatten, für die nun verkürzte Vollzeit entschieden.

[Lücke 2]

Diese Beobachtung steht im Mittelpunkt der Schlussfolgerungen. Die Forschenden betonen, dass die gewonnene Zeit weniger aus einem schnelleren Arbeitstempo stamme als aus dem Wegfall von Tätigkeiten, deren Nutzen schon lange niemand mehr hinterfragt hatte: Berichte, die keiner las, Abstimmungsrunden, die aus Gewohnheit stattfanden, doppelte Freigaben. Die Viertagewoche habe gewissermaßen als Lupe gewirkt: Was unter dem Druck der kürzeren Woche wegfiel, hätte man im Grunde auch bei fünf Arbeitstagen streichen können, nur hatte niemand einen Anlass gesehen, danach zu suchen. Gleichwohl warnen sie davor, die Ergebnisse unbesehen auf alle Bereiche zu übertragen.

[Lücke 3]

Die Geschäftsführung hat inzwischen entschieden, das Modell fortzuführen, allerdings nicht mehr einheitlich. Jede Abteilung soll künftig selbst festlegen, wie sie die verkürzte Arbeitszeit organisiert. Der Betriebsrat begrüßt die Fortsetzung, mahnt aber, die unterschiedlichen Lösungen dürften nicht zu neuen Ungleichheiten innerhalb der Belegschaft führen. Ob dieser Ansatz trägt, wird sich zeigen. Fest steht, dass der Versuch eine Frage aufgeworfen hat, die über die Viertagewoche weit hinausreicht: wie viel von dem, was wir täglich tun, eigentlich getan werden muss.`,
  },
  {
    key: R_ANZEIGEN,
    section: "READING",
    level: LEVEL,
    title: "Stellenanzeigen",
    topic: "Arbeitssuche",
    body: `Anzeige A
Die Stadtwerke Lindenau suchen zum nächstmöglichen Zeitpunkt eine Referentin oder einen Referenten für Nachhaltigkeitsberichterstattung, unbefristet, in Voll- oder Teilzeit ab 28 Wochenstunden. Sie erstellen unseren jährlichen Nachhaltigkeitsbericht nach den geltenden gesetzlichen Vorgaben, koordinieren die Datenerhebung in allen Unternehmensbereichen und beraten die Geschäftsführung bei der Festlegung von Zielwerten. Wir erwarten ein abgeschlossenes Hochschulstudium der Wirtschafts-, Umwelt- oder Ingenieurwissenschaften, mehrjährige Erfahrung mit Berichtspflichten sowie ein ausgeprägtes Gespür für Zahlen und für deren verständliche Darstellung. Wir bieten flexible Arbeitszeiten, bis zu zwei Tage mobiles Arbeiten pro Woche und eine betriebliche Altersvorsorge.

Anzeige B
Die Kranbau Elmshagen AG sucht für ein auf zwei Jahre befristetes Digitalisierungsprojekt eine Technische Redakteurin oder einen Technischen Redakteur. Sie verfassen Betriebsanleitungen und Wartungshandbücher für unsere Hebetechnik, überführen die bestehende Dokumentation in ein neues Redaktionssystem und stimmen sich eng mit der Konstruktion ab. Voraussetzung sind ein technisches Studium oder eine vergleichbare Qualifikation, Erfahrung in der Dokumentation sowie verhandlungssichere Englischkenntnisse, da ein Teil der Handbücher für internationale Kunden entsteht. Die Stelle kann vollständig im Homeoffice besetzt werden; lediglich während der zweiwöchigen Einarbeitung erwarten wir Sie an unserem Standort.

Anzeige C
Die Velora Versicherungsgruppe sucht für ihr Servicecenter eine Teamleitung Kundenservice, unbefristet und in Vollzeit. Sie führen ein Team von zwölf Mitarbeitenden, planen die Schichten im Rahmen unserer Servicezeiten von sieben bis zwanzig Uhr und sind erste Ansprechperson, wenn Kundenanliegen eskalieren. Erfahrung in der Personalführung setzen wir voraus, die Branche ist für uns dagegen zweitrangig: Wer bereits Teams im Handel, in der Gastronomie oder in der Logistik geführt hat, ist herzlich willkommen. Da die Aufgabe ständige Ansprechbarkeit vor Ort erfordert, ist mobiles Arbeiten in dieser Position nicht möglich. Die fachliche Schulung übernehmen wir.

Anzeige D
Das Übersetzungsbüro Kessler & Partner erweitert seinen Pool freiberuflicher Übersetzerinnen und Übersetzer für die Sprachrichtungen Englisch-Deutsch und Deutsch-Englisch mit Schwerpunkt Recht: Verträge, Gutachten, Gerichtsentscheidungen. Sie bestimmen selbst, wie viele Aufträge Sie annehmen; eine feste Auftragsmenge können wir allerdings nicht zusagen. Voraussetzung sind juristische Fachkenntnisse, etwa durch ein Studium oder eine Tätigkeit in einer Kanzlei, sowie Englischkenntnisse auf höchstem Niveau. Die Vergütung erfolgt pro Normzeile, die Zahlung innerhalb von vierzehn Tagen nach Lieferung.`,
  },
  {
    key: R_LAERM,
    section: "READING",
    level: LEVEL,
    title: "Die Stadt, die nie schweigt",
    topic: "Umwelt, Lärm in der Stadt",
    body: `Wer in einer Großstadt aufwächst, lernt früh, einen Teil der Welt auszublenden. Das Rauschen der Straße, das Dröhnen eines Presslufthammers, das Quietschen der Straßenbahn: Nach einiger Zeit nimmt man es kaum noch wahr. Die Lärmforschung hegt allerdings Zweifel daran, dass dieses Ausblenden tatsächlich folgenlos bleibt. Messungen an Schlafenden zeigen, dass der Körper auf nächtlichen Verkehrslärm reagiert, selbst wenn die Betroffenen am Morgen schwören, tief und fest geschlafen zu haben: Der Puls steigt, der Blutdruck schwankt, und die Tiefschlafphasen werden kürzer. Gewöhnung, so der Befund, ist also eher eine Leistung der Wahrnehmung als des Organismus.

Besonders aufschlussreich sind Untersuchungen in der Nähe von Flughäfen, bei denen man Schulkinder, deren Klassenzimmer unter einer Einflugschneise lagen, mit Gleichaltrigen aus ruhigeren Vierteln verglich. Die Kinder aus den lauten Klassen lasen im Durchschnitt etwas langsamer und schnitten bei Gedächtnisaufgaben schlechter ab. Die Forschenden mahnen allerdings zur Vorsicht: Lärm gehe häufig mit anderen Belastungen einher, etwa mit beengten Wohnverhältnissen, und lasse sich deshalb nur schwer als alleinige Ursache isolieren. Zwischen Korrelation und Kausalität liege auch hier ein weiter Weg.

Umstritten ist, was daraus folgt. Die einen fordern strengere Grenzwerte und verweisen darauf, dass leisere Reifen und Fahrbahnbeläge die Belastung nachweislich senken, ohne dass jemand auf Mobilität verzichten müsste. Andere halten dagegen, dass sich nicht jeder Schall über einen Kamm scheren lasse: Das Lachen von Kindern auf einem Spielplatz werde von Anwohnern selten als Störung empfunden, ein gleich lauter Rasenmäher dagegen schon. Entscheidend sei nicht allein die Lautstärke, sondern die Frage, ob man den Klang als sinnvoll, vermeidbar oder aufgezwungen erlebe. Wer selbst bestimmen könne, wann es laut werde, ertrage mehr.

Dass sich ausgerechnet die Stille zu einem Luxusgut entwickelt, bleibt nicht ohne Ironie. In manchen Städten werben Immobilienanzeigen inzwischen mit „ruhiger Lage“ wie früher mit Seeblick, und in Hotels lässt sich gegen Aufpreis ein Zimmer zur Hofseite buchen. Eine Gruppe von Stadtplanern setzt deshalb auf sogenannte ruhige Gebiete: Grünflächen und Innenhöfe, die gezielt von Lärm freigehalten werden und zu denen alle Zugang haben sollen, nicht nur diejenigen, die es sich leisten können. Ob das ausreicht, ist offen. Fest steht nur, dass Ruhe ungleich verteilt ist, und zwar entlang der Linien, an denen auch sonst Vorteile und Nachteile in der Stadt verteilt werden.`,
  },
  {
    key: R_MUSEUM,
    section: "READING",
    level: LEVEL,
    title: "Muss man das Original noch sehen?",
    topic: "Kultur, Museen",
    body: `Wer heute vor einem berühmten Gemälde steht, hält fast immer ein Telefon in der Hand. Er fotografiert das Bild, prüft auf dem Display, ob die Aufnahme gelungen ist, und geht weiter, ohne es länger als wenige Sekunden betrachtet zu haben. Kulturkritiker beklagen diese Szene gern als Verflachung des Kunstgenusses. Dabei übersehen sie, dass sich das Verhältnis zum Original schon lange vor der Digitalisierung gewandelt hat: Wer im neunzehnten Jahrhundert ein Meisterwerk kennenlernen wollte, tat dies meist über einen Kupferstich, und niemand hielt es für einen Verrat an der Kunst.

Neu ist allerdings das Ausmaß. Viele große Häuser haben ihre Bestände inzwischen in hoher Auflösung ins Netz gestellt, und manche Sammlungen lassen sich dort bis auf die Pinselspuren vergrößern, was vor dem Original selbst nie möglich wäre. Wozu also noch die Reise, die Eintrittskarte, das Gedränge? Die Antwort der Museen lautet meist, das Original besitze eine „Aura“, ein Wort, das mehr beschwört als erklärt. Überzeugender ist ein nüchterneres Argument: Das Original ist ein Zeugnis. An ihm lassen sich Überarbeitungen, Beschädigungen und Materialien ablesen, die keine Abbildung vollständig wiedergibt, und es steht für eine Geschichte des Besitzes, des Streits und der Rettung, die zum Verständnis des Werks gehört.

Ob die Besucher dies suchen, ist eine andere Frage. Beobachtungen in Ausstellungshäusern legen nahe, dass die durchschnittliche Verweildauer vor einzelnen Werken bei weniger als einer halben Minute liegt. Manche Museen reagieren darauf, indem sie weniger zeigen: Sie verringern die Zahl der Objekte und lassen Platz zwischen ihnen, damit der Blick zur Ruhe kommen kann. Andere setzen auf das Gegenteil und bieten Führungen mit Kopfhörern, Rätselrallyes und eine Technik, die das Werk mit Zusatzinformationen überlagert. Beides hat seine Berechtigung; die Frage ist nur, ob die Technik die Betrachtung unterstützt oder an ihre Stelle tritt.

Vielleicht liegt der eigentliche Wert des Museumsbesuchs in etwas, das sich gerade nicht digitalisieren lässt: in der Begegnung des Körpers mit der Größe, der Farbe und der Stofflichkeit eines Gegenstands und in der Zeit, die man ihm widmet. Ein Foto lässt sich aufbewahren; die Aufmerksamkeit, mit der man ein Bild betrachtet, muss man jedes Mal neu aufbringen.`,
  },
];

const rK = forText(R_KOMMENTAR);
const rE = forText(R_ESSAY);
const rB = forText(R_BERICHT);
const rA = forText(R_ANZEIGEN);
const rL = forText(R_LAERM);
const rM = forText(R_MUSEUM);

const readingItems: SeedItem[] = [
  // Kommentar: four-option MC, as in Goethe C2 Lesen Teil 1.
  rK.choice("gist", "MID",
    "Welche Haltung vertritt der Autor insgesamt?",
    [
      "Er hält Kennzahlen für ein Übel, das Unternehmen am besten ganz aus ihrem Arbeitsalltag und ihren Berichten verbannen sollten.",
      "Er hält Messen dort für sinnvoll, wo Abläufe standardisiert sind, bei Arbeit, die auf Urteilskraft beruht, dagegen nur als Anlass für ein Gespräch.",
      "Er sieht in den Kennzahlen ein brauchbares Mittel, das sich mit genaueren Messverfahren und besser gewählten Zielwerten verbessern lässt.",
      "Er meint, dass sich Beschäftigte gegen Messungen vor allem wehren, weil sie etwas vor der Leitung und den Kollegen verbergen wollen.",
    ], "b",
    "Vorletzter Absatz: \"Nichts davon spricht dagegen, zu messen\", problematisch nur dort, \"wo Arbeit vor allem aus Urteilskraft besteht\". (a) widerspricht diesem Absatz, (c) ist der Einwand, den der Autor im vierten Absatz als unzureichend zurückweist, (d) ist der Verdacht aus dem ersten Absatz, den er gerade nicht teilt."),
  rK.choice("inference", "HARD",
    "Was will der Autor ausdrücken, wenn er schreibt, die Statistik verbuche den zweiten Anruf „erfreulicherweise“ als zwei erfolgreich bearbeitete Fälle?",
    [
      "Die Statistik belegt, dass die Mitarbeitenden schneller arbeiten als früher.",
      "Kunden sind mit kurzen Gesprächen im Allgemeinen zufriedener als mit langen.",
      "Die Software zählt manche Anrufe aus technischen Gründen doppelt.",
      "Die Kennzahl lässt ein Versäumnis des Teams wie einen doppelten Erfolg erscheinen.",
    ], "d",
    "\"erfreulicherweise\" ist ironisch: Der Kunde musste wegen des zu früh beendeten Gesprächs erneut anrufen, die Zahl zeigt aber zwei Erfolge. Es geht um Fehlanreize, nicht um Technik oder Kundenzufriedenheit."),
  rK.choice("vocabulary", "HARD",
    "Was meint der Autor mit dem Bild, man solle aufhören, „die Landkarte mit der Landschaft zu verwechseln“?",
    [
      "Man sollte Zahlen nicht für die Wirklichkeit halten, die sie nur vereinfacht abbilden.",
      "Man sollte sich bei Entscheidungen stärker auf eigene Anschauung vor Ort verlassen.",
      "Man sollte Kennzahlen grafisch anschaulicher und übersichtlicher darstellen.",
      "Man sollte zwischen langfristigen und kurzfristigen Unternehmenszielen unterscheiden.",
    ], "a",
    "Die Landkarte steht für die Kennzahl (das Abbild), die Landschaft für die tatsächliche Arbeit. Das knüpft an \"Eine Kennzahl ist ein Stellvertreter\" an. (b) nimmt das Bild wörtlich, (c) und (d) haben keinen Bezug."),

  // Essay: statements to sections (Goethe C2 Lesen Teil 2), plus MC and R/F/NG.
  rE.match("structure", "MID",
    "Ordnen Sie jeder Aussage den Abschnitt (A bis F) zu, in dem dieser Gedanke ausgedrückt wird. Ein Abschnitt bleibt übrig.",
    [
      "Auch das Gegenteil der kritisierten Haltung hat Nachteile.",
      "Wer früher Einblick gewährt hätte, hätte sich Aufwand und Enttäuschung erspart.",
      "Sprachliche Gewohnheiten lassen Rückschlüsse auf die Arbeitskultur zu.",
      "Ob sich Offenheit durchsetzt, hängt von der Art der Rückmeldung ab.",
      "Prägungen aus der eigenen Lernbiografie wirken im Berufsleben fort.",
    ],
    ["Abschnitt A", "Abschnitt B", "Abschnitt C", "Abschnitt D", "Abschnitt E", "Abschnitt F"],
    [4, 3, 1, 5, 2],
    "D: \"naiv, nun das Gegenteil zu fordern\". C: früher gezeigter Entwurf, Fehler in einer Viertelstunde. A: entschuldigende Floskeln verraten die Kultur. E: \"Entscheidend ist, wie auf Unfertiges reagiert wird\". B: Schule und Studium bewerten nur Ergebnisse. F bleibt übrig (neuer Begriff von Professionalität)."),
  rE.choice("inference", "HARD",
    "Wie ist der Schluss des Textes („und das heißt: billiger“) zu verstehen?",
    [
      "Organisationen sollten bei Fehlern vor allem darauf achten, welche Kosten für die Beteiligten entstehen.",
      "Wer Unfertiges zeigt, macht insgesamt weniger Fehler als Kolleginnen, die nur Fertiges vorlegen.",
      "Fehler, die früh auffallen, verursachen weniger Aufwand und Kosten als solche, die erst spät auffallen.",
      "Erste Entwürfe sollten mit möglichst geringen Mitteln erstellt werden, damit ein Misserfolg wenig kostet.",
    ], "c",
    "Der Autor sagt ausdrücklich, die Organisation werde \"nicht fehlerfrei arbeiten\" (gegen b), aber Fehler früher machen; das verbindet sich mit Abschnitt C (spät entdeckte Fehler sind teuer). (a) und (d) deuten \"billiger\" als Sparvorgabe statt als Folge des früheren Erkennens."),
  // No NG here: every statement is answerable from sections B, E and the closing line of E.
  rE.tfng("detail", "MID",
    [
      ["Dem Autor zufolge zögern Menschen mit unfertigen Gedanken vor allem aus einer angeborenen Scheu.", "F"],
      ["Er hält es für hilfreich, wenn Führungskräfte selbst vorführen, wie man mit unausgereiften Gedanken umgeht.", "R"],
      ["Seiner Ansicht nach hängt der Erfolg offener Entwürfe davon ab, dass man sie nicht so streng prüft wie fertige Arbeiten.", "R"],
    ],
    "1 F: Abschnitt B führt die Haltung auf Schule, Ausbildung und Sorge um den Ruf zurück, nicht auf eine angeborene Scheu. 2 R: Abschnitt E, Vorbildrolle der Vorgesetzten, die sich korrigieren lassen. 3 R: Abschnitt E, ein Entwurf darf nicht \"mit derselben Strenge\" beurteilt werden wie ein abgeschlossener Bericht."),

  // Bericht: removed paragraphs (Goethe C2 Lesen Teil 3), plus MC and R/F/NG.
  rB.match("structure", "HARD",
    "In den Text wurden drei Absätze entfernt. Ordnen Sie jeder Lücke den passenden Absatz zu. Ein Absatz passt nicht.",
    ["Lücke 1", "Lücke 2", "Lücke 3"],
    [
      "Nicht verschwiegen wird im Bericht, dass der Kundendienst an seine Grenzen stieß. Da Kunden auch freitags eine Ansprechperson erwarten, musste dort ein rollierendes System eingeführt werden, das die Planung erheblich verkomplizierte. Die Zufriedenheit der Kunden blieb zwar stabil, im Team selbst wuchs jedoch der Unmut über die ständigen Absprachen.",
      "Die begleitende Hochschule kam zu dem Schluss, dass sich die Produktivität in sämtlichen Bereichen des Unternehmens verbessert habe, am deutlichsten im Kundendienst. Eine Übertragung auf andere Betriebe sei daher bedenkenlos möglich.",
      "Das Modell sah vor, die wöchentliche Arbeitszeit von achtunddreißig auf zweiunddreißig Stunden zu senken, bei vollem Lohnausgleich. Im Gegenzug verpflichteten sich die Teams, ihre Abläufe selbst zu überprüfen und Zeitfresser zu benennen. Begleitet wurde der Versuch von einer Hochschule, die Befragungen durchführte und Kennzahlen zu Produktivität und Krankmeldungen auswertete.",
      "Weniger eindeutig war das Bild in der Verwaltung. Dort berichteten viele Beschäftigte, sie seien zwar erholter, schafften ihr Pensum aber nur, indem sie Pausen verkürzten oder Besprechungen strichen. Gerade Letzteres wurde allerdings nicht nur negativ gesehen: Etliche Teams stellten fest, dass ein Teil ihrer regelmäßigen Sitzungen ohnehin entbehrlich gewesen war.",
    ],
    [3, 4, 1],
    "Lücke 1: Beschreibung des Modells nach der Einleitung, bevor die Ergebnisse folgen. Lücke 2: \"Diese Beobachtung\" im nächsten Absatz greift die entbehrlichen Sitzungen auf. Lücke 3: Nach der Warnung vor unbesehener Übertragung folgt der Kundendienst als Gegenbeispiel, der die uneinheitliche Fortführung begründet. Der zweite Absatz passt nirgends: Er behauptet Verbesserungen in allen Bereichen und widerspricht damit der Fertigung, der Verwaltung und der Warnung der Forschenden."),
  rB.choice("detail", "MID",
    "Worauf führen die Forschenden die gewonnene Zeit vor allem zurück?",
    [
      "auf ein höheres Arbeitstempo, das die Beschäftigten an nur vier Tagen pro Woche dauerhaft durchhalten",
      "darauf, dass überflüssig gewordene Abläufe gestrichen wurden, die zuvor niemand angezweifelt hatte",
      "auf die neue Verteilung der Schichten, durch die die Maschinen deutlich länger laufen konnten",
      "auf den Rückgang der Krankheitstage, durch den weniger Ausfälle ausgeglichen werden mussten",
    ], "b",
    "\"weniger aus einem schnelleren Arbeitstempo ... als aus dem Wegfall von Tätigkeiten, deren Nutzen ... niemand mehr hinterfragt hatte\". Schichten und Krankheitstage werden im Text genannt, aber nicht als Ursache der gewonnenen Zeit."),
  rB.tfng("detail", "MID",
    [
      ["Den Anstoß für den Versuch gaben Wünsche der Belegschaft nach längeren Wochenenden.", "F"],
      ["Die Forschenden sollen auch die Fortsetzung des Modells wissenschaftlich begleiten.", "NG"],
      ["In der Fertigung verlief die Anfangszeit mit dem neuen Schichtsystem holprig.", "R"],
    ],
    "1 F: Der Versuch war \"in erster Linie eine Antwort auf den Fachkräftemangel\", angekündigt von der Geschäftsführung; die Belegschaft reagierte gemischt. 2 NG: Der Text nennt die Fortsetzung, sagt aber nichts darüber, ob die Forschenden sie begleiten. 3 R: \"erhebliche Reibungen\" in den ersten Wochen."),

  // Stellenanzeigen: selective reading (Goethe C2 Lesen Teil 4).
  rA.match("detail", "MID",
    "Welche Anzeige passt zu welcher Person? Wenn keine Anzeige passt, wählen Sie „keine passende Anzeige“.",
    [
      "Eine Juristin mit hervorragenden Englischkenntnissen sucht eine Nebentätigkeit, deren Umfang sie selbst steuern kann.",
      "Ein Maschinenbauingenieur mit verhandlungssicherem Englisch möchte, ohne umzuziehen, im Homeoffice Anleitungen schreiben; eine kurze Präsenzphase zu Beginn wäre für ihn kein Problem.",
      "Ein Bewerber hat mehrere Jahre eine Filiale im Einzelhandel geleitet und möchte nun in einer anderen Branche Führungsverantwortung übernehmen.",
      "Eine Schulabgängerin ohne Berufserfahrung sucht einen Ausbildungsplatz im kaufmännischen Bereich.",
      "Ein Absolvent der Betriebswirtschaftslehre mit langjähriger Erfahrung in gesetzlichen Berichtspflichten möchte höchstens dreißig Stunden pro Woche arbeiten.",
    ],
    ["Anzeige A", "Anzeige B", "Anzeige C", "Anzeige D", "keine passende Anzeige"],
    [4, 2, 3, 5, 1],
    "Juristin, Umfang selbst bestimmt: D (freiberuflich, Auftragsmenge frei wählbar). Ingenieur, Homeoffice, Anleitungen: B (auch A erlaubt mobiles Arbeiten, aber nur zwei Tage und keine Anleitungen). Filialleiter, neue Branche: C (Branche zweitrangig, Führungserfahrung nötig). Ausbildungsplatz: keine Anzeige. Betriebswirtschaftler, Berichtspflichten, Teilzeit: A (ab 28 Stunden)."),
  rA.choice("detail", "MID",
    "Welche Aussage über die Stelle bei der Velora Versicherungsgruppe (Anzeige C) trifft zu?",
    [
      "Sie ist als einzige der vier Stellen unbefristet ausgeschrieben.",
      "Sie verlangt als einzige Stelle Erfahrung in der Branche des Arbeitgebers.",
      "Sie schließt als einzige Stelle mobiles Arbeiten ausdrücklich aus.",
      "Sie verlangt als einzige Stelle ein abgeschlossenes Hochschulstudium.",
    ], "c",
    "C: \"mobiles Arbeiten in dieser Position nicht möglich\"; A erlaubt zwei Tage mobiles Arbeiten, B vollständig Homeoffice, D sagt nichts über den Arbeitsort. (a) auch A ist unbefristet. (b) für C ist die Branche gerade zweitrangig. (d) A verlangt ebenfalls ein Hochschulstudium."),
  rA.tfng("detail", "MID",
    [
      ["Wer bei den Stadtwerken Lindenau weniger als die volle Wochenarbeitszeit arbeiten möchte, kann sich dennoch bewerben.", "R"],
      ["Die Velora Versicherungsgruppe zahlt Zuschläge für Abendschichten.", "NG"],
      ["Wer sich bei der Kranbau Elmshagen AG bewirbt, muss während der gesamten Vertragslaufzeit am Standort anwesend sein.", "F"],
      ["Das Übersetzungsbüro garantiert seinen freien Mitarbeitenden eine feste monatliche Auftragsmenge.", "F"],
    ],
    "1 R: Voll- oder Teilzeit ab 28 Wochenstunden. 2 NG: Servicezeiten bis zwanzig Uhr werden genannt, von Zuschlägen ist keine Rede. 3 F: Präsenz nur während der zweiwöchigen Einarbeitung. 4 F: Eine feste Auftragsmenge kann das Büro \"nicht zusagen\"; bezahlt wird pro Normzeile."),

  // Lärm: MC on detail and inference, R/F/NG with two NG statements.
  rL.choice("detail", "MID",
    "Was ergeben die Messungen an Schlafenden laut Text?",
    [
      "Bei nächtlichem Verkehrslärm reagiert der Körper auch dann, wenn die Schlafenden davon nichts bemerken.",
      "Wer in einem lauten Viertel wohnt, schläft nach einigen Jahren in der Regel tiefer als andere.",
      "Die Betroffenen unterschätzen, wie oft sie nachts aufwachen, obwohl ihr Körper dabei ruhig bleibt.",
      "Der Blutdruck sinkt bei Lärm kurzzeitig, während der Puls gleich bleibt und der Schlaf nicht kürzer wird.",
    ], "a",
    "Erster Absatz: Der Körper reagiert (Puls, Blutdruck, kürzere Tiefschlafphasen), selbst wenn die Betroffenen glauben, tief geschlafen zu haben. (b) Gewöhnung gibt es laut Text nur in der Wahrnehmung, nicht im Körper. (c) und (d) nennen Wirkungen, die im Text so nicht vorkommen oder ihm widersprechen."),
  rL.choice("inference", "HARD",
    "Was soll das Beispiel von Kinderlachen und Rasenmäher belegen?",
    [
      "Dass leise Geräusche in Wohngebieten häufiger stören als laute, sofern sie unregelmäßig auftreten.",
      "Dass sich die Belastung durch Schall vor allem nach der gemessenen Lautstärke richtet und weniger nach der Art des Geräuschs.",
      "Dass es für das Empfinden von Lärm auch darauf ankommt, was ein Geräusch bedeutet und ob man es steuern kann.",
      "Dass Anwohner von Spielplätzen auf Dauer weniger unter Lärm leiden als Menschen in anderen Vierteln.",
    ], "c",
    "Dritter Absatz: Gleich laute Geräusche werden unterschiedlich erlebt; entscheidend sei, ob der Klang \"sinnvoll, vermeidbar oder aufgezwungen\" wirke, und wer selbst bestimme, ertrage mehr. (b) ist das Gegenteil, (a) und (d) behaupten Aussagen, die der Text nicht macht."),
  rL.tfng("detail", "HARD",
    [
      ["Die Forschenden halten es für unsicher, ob Lärm allein die schlechteren Testergebnisse der Kinder erklärt.", "R"],
      ["Die Untersuchungen an Flughäfen wurden in mehreren Ländern gleichzeitig durchgeführt.", "NG"],
      ["Nach dem Konzept der Stadtplaner soll der Zugang zu ruhigen Gebieten von der Zahlung eines Beitrags abhängen.", "F"],
      ["Die Zahl der Haushalte, die wegen Lärms umziehen, ist in den letzten Jahren gestiegen.", "NG"],
    ],
    "1 R: Die Forschenden mahnen zur Vorsicht, weil Lärm mit anderen Belastungen zusammenhängt. 2 NG: Die Flughafenstudien werden erwähnt, über ihren Ort oder Zeitraum steht nichts im Text. 3 F: Die ruhigen Gebiete sollen allen offenstehen, \"nicht nur diejenigen, die es sich leisten können\". 4 NG: Umzüge wegen Lärms werden nirgends erwähnt."),

  // Museum: three MC items on attitude, a key term and the author's judgement.
  rM.choice("gist", "MID",
    "Welche Haltung nimmt der Verfasser gegenüber den Kulturkritikern ein?",
    [
      "Er schließt sich ihrer Kritik an, weil das Fotografieren das genaue Betrachten ganz verdrängt habe.",
      "Er hält ihre Klage für zu einseitig, weil Kunst schon lange über Abbildungen vermittelt worden ist.",
      "Er räumt ein, dass nur Besucher mit Vorbildung von der Betrachtung eines Originals profitieren.",
      "Er lehnt ihre Kritik ab, weil Museen die Digitalisierung ihrer Bestände selbst vorangetrieben haben.",
    ], "b",
    "Erster Absatz: Die Kritiker \"übersehen\", dass sich das Verhältnis zum Original schon früher gewandelt hat (Kupferstiche im neunzehnten Jahrhundert). (a) übernimmt die Kritik, (c) und (d) nennen Gründe, die im Text nicht vorkommen."),
  rM.choice("vocabulary", "MID",
    "Was meint der Verfasser mit der Aussage, das Original sei ein „Zeugnis“?",
    [
      "Es beweist durch eine Echtheitsprüfung, dass der Künstler das Werk eigenhändig geschaffen hat.",
      "Es dokumentiert, welche Besucherinnen und Besucher das Werk in den vergangenen Jahrzehnten besonders lange betrachtet haben.",
      "Es trägt ablesbare Spuren seiner Herstellung und seiner Besitzer, die sich auf Reproduktionen nur teilweise zeigen.",
      "Es entfaltet eine besondere Wirkung, die sich nur mit dem Wort „Aura“ beschreiben lässt.",
    ], "c",
    "Zweiter Absatz: Das Zeugnis-Argument ist das \"nüchternere\" im Gegensatz zur \"Aura\", die der Verfasser als wenig erklärend zurückweist (d). Überarbeitungen, Beschädigungen und die Besitzgeschichte sind am Original ablesbar. (a) und (b) kommen im Text nicht vor."),
  rM.choice("attitude", "HARD",
    "Wie beurteilt der Verfasser die beiden Strategien der Museen im dritten Absatz?",
    [
      "Er bevorzugt die Verringerung der Objekte, weil technische Zusätze grundsätzlich vom Werk ablenken.",
      "Er bevorzugt technische Zusätze, weil sie die kurze Verweildauer der Besucher spürbar verlängern.",
      "Er hält beide für unzureichend, weil sie das Verhalten der Besucher zu stark lenken und bevormunden.",
      "Er hält beide für vertretbar und fragt, ob die Technik die Betrachtung ergänzt oder ersetzt.",
    ], "d",
    "\"Beides hat seine Berechtigung; die Frage ist nur, ob die Technik die Betrachtung unterstützt oder an ihre Stelle tritt.\" (a) und (b) legen sich auf eine Seite fest, (c) behauptet eine Bevormundung, die der Text nicht erwähnt."),
];

// ------------------------------------------------------------------ listening

type LSkill = "gist" | "detail" | "attitude" | "inference" | "notes";

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
      options: [string, string, string, string],
      correct: OptionId,
      explanation: string,
    ): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "SINGLE_CHOICE",
        content: { kind: "CHOICE", options: options.map((text, i) => ({ id: IDS[i], text })) },
        key: { kind: "CHOICE", correct: [correct] },
      };
    },
    tfng(skill: LSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      const ids = statements.map((_, i) => `s${i + 1}`);
      return {
        ...base(skill, within, "Richtig (R), falsch (F) oder wird dazu nichts gesagt (NG)?", explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", statements: statements.map(([text], i) => ({ id: ids[i], text })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, v], i) => [ids[i], v])) },
      };
    },
    /** Note-taking: typed gaps `{{g1}}`..., each with every acceptable spelling (digits and words for numbers). */
    notes(skill: LSkill, within: Within, prompt: string, answers: string[][], explanation: string): SeedItem {
      const ids = answers.map((_, i) => `g${i + 1}`);
      return {
        ...base(skill, within, prompt, explanation),
        type: "GAP_FILL",
        content: { kind: "GAP", gaps: ids.map((id) => ({ id })) },
        key: { kind: "GAP", answers: Object.fromEntries(ids.map((id, i) => [id, answers[i]])) },
      };
    },
    /** Note-taking: one typed answer, every accepted spelling listed. */
    short(skill: LSkill, within: Within, prompt: string, accepted: string[], explanation: string): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "SHORT_TEXT",
        content: { kind: "SHORT_TEXT", maxChars: 40 },
        key: { kind: "SHORT_TEXT", accepted },
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
          left: left.map((text, i) => ({ id: `l${i + 1}`, text })),
          right: right.map((text, i) => ({ id: `r${i + 1}`, text })),
        },
        key: { kind: "MATCHING", pairs: Object.fromEntries(pairs.map((r, i) => [`l${i + 1}`, `r${r}`])) },
      };
    },
  };
}

// The three older clips were rewritten as spoken German: their keys carry a version suffix, because the sync never
// updates a script in place once audio exists for it.
const L_FEATURE = "v2-l-c2-feature-telefonieren-v3";
const L_DEBATTE = "v2-l-c2-debatte-probetag-v3";
const L_INTERVIEW = "v2-l-c2-interview-planung-v3";
const L_SCHLAF = "v2-l-c2-schlaf-tipp-v2";
const L_BAHN = "v2-l-c2-bahn-nachricht";
const L_WOHNEN = "v2-l-c2-umfrage-gemeinschaftsraum";

const listeningStimuli: SeedStimulus[] = [
  clip(L_FEATURE, "Radiofeature: Wer ruft heute noch an?", "Kommunikation am Arbeitsplatz",
    [
      { label: "Moderatorin", voice: "A" },
      { label: "Wendland", voice: "B" },
    ],
    [
      "Moderatorin: Es klingelt, und kaum einer geht ran. Das kennen Sie bestimmt auch. Früher galt das als unhöflich, heute ist es in vielen Büros fast normal: Wer etwas will, schreibt.",
      "Moderatorin: Eine Beratungsfirma hat dazu im letzten Herbst Berufstätige befragt. Das Ergebnis: Mehr als die Hälfte findet unangekündigte Anrufe störend. Nur eine kleine Minderheit greift bei beruflichen Fragen noch spontan zum Hörer. Bei mir im Studio sitzt der Kommunikationswissenschaftler Martin Wendland. Herr Wendland, ist das der Verfall der Sitten?",
      "Wendland: Nein, so einfach ist es nicht. Man muss sich erst mal klarmachen, was ein Anruf eigentlich ist. Ein Anruf sagt: Ich will jetzt deine Aufmerksamkeit, und zwar sofort. Eine Nachricht lässt dem anderen die Wahl, wann er antwortet. Der Rückgang ist also auch ein Stück Rücksicht, nicht nur Bequemlichkeit.",
      "Moderatorin: Aber das Schreiben hat doch seinen Preis, oder?",
      "Wendland: Ja, natürlich. Missverständnisse, die am Telefon nach zwei Sätzen geklärt wären, ziehen sich per Mail über Tage. Und der Ton wird schärfer, wenn man den anderen nicht hört. Deshalb werde ich hellhörig, wenn jemand sagt, Schreiben sei grundsätzlich effizienter. Bei einfachen Absprachen, ja, gar keine Frage, da stimmt das. Aber sobald es um Konflikte geht, um Verhandlungen, also überall, wo Zwischentöne zählen, verlieren wir mit dem Schreiben Information.",
      "Moderatorin: Was geht denn da verloren?",
      "Wendland: Die Stimme verrät Zögern, Ironie, Unsicherheit. In einer Mail müssen Sie das alles erraten. Und wir neigen dazu, im Zweifel das Ungünstigere anzunehmen.",
      "Moderatorin: Manche Firmen versuchen gegenzusteuern. In einer Werbeagentur gilt seit einem Jahr: Nach der vierten, ach nein, nach der dritten Mail zu einem Thema greift man zum Hörer. Die Erfahrungen sind gemischt. Es gibt weniger endlose Mailverläufe, aber einige im Team fühlen sich bevormundet. Was halten Sie davon?",
      "Wendland: Gut gemeint, aber, wie soll ich sagen, ein bisschen hilflos. Gesprächskultur lässt sich nicht verordnen. Was hilft, ist, dass Führungskräfte es vormachen: dass sie anrufen, wenn es heikel wird, und vorher kurz fragen, ob es gerade passt. Dann verliert der Anruf auch seinen Überfallcharakter.",
      "Moderatorin: Kommt das Telefon also zurück?",
      "Wendland: Das ist offen. Sicher ist nur: Ob man schreibt oder spricht, ist keine technische, sondern eine soziale Frage. Und die wird in jedem Team neu verhandelt.",
      "Moderatorin: Herr Wendland, vielen Dank.",
    ]),
  clip(L_DEBATTE, "Streitgespräch: Probetag statt Vorstellungsgespräch?", "Personalauswahl",
    [
      { label: "Seidel", voice: "A" },
      { label: "Okafor", voice: "B" },
    ],
    [
      "Seidel: Herr Okafor, Ihre Firma hat das Vorstellungsgespräch ja weitgehend abgeschafft. Stattdessen gibt es einen bezahlten Probetag. Wie kam es dazu?",
      "Okafor: Ganz ehrlich: Wir haben uns einfach zu oft getäuscht. Im Gespräch wirkten Leute brillant, und nach drei Wochen, na ja, eher nach vier, merkte man, dass sie mit den eigentlichen Aufgaben nicht klarkamen. Oder umgekehrt: Jemand war nervös, hat kaum ein Wort herausgebracht und war dann einer unserer Besten. So ein Gespräch, wie es meistens läuft, misst vor allem eins: wie gut sich jemand verkauft.",
      "Seidel: Da widerspreche ich gar nicht. Gespräche ohne feste Struktur sind unzuverlässig, das zeigt die Forschung seit Langem. Aber ob ein einziger Tag so viel aussagekräftiger ist, da habe ich meine Zweifel.",
      "Okafor: Da sind wir uns einig: Ein Plaudergespräch ohne Leitfaden sagt wenig. Aber was spricht gegen einen ganzen Tag?",
      "Seidel: Ein Probetag ist eine künstliche Situation. Man kennt die Abläufe nicht, die Kollegen nicht, die Werkzeuge nicht. Am Ende sehen Sie, wie jemand mit Fremdheit umgeht, und nicht, wie er arbeitet.",
      "Okafor: Deshalb schicken wir vorab Material, damit keiner ins kalte Wasser springt. Und, offen gesagt: Sich schnell in einer fremden Umgebung zurechtzufinden, ist bei unseren Stellen keine Nebensache. Das gehört zum Job.",
      "Seidel: Darüber kann man streiten. Mein größeres Problem ist ein anderes: Wer kann sich überhaupt einen ganzen Tag freinehmen? Wer noch in ungekündigter Stellung ist und das seinem Chef nicht sagen will, oder wer feste Verpflichtungen hat, der hat da schlechte Karten.",
      "Okafor: Das Argument kenne ich, und es ist berechtigt. Wir bieten den Probetag inzwischen auch samstags an, oder verteilt auf zwei Nachmittage. Perfekt ist das nicht, das gebe ich zu.",
      "Seidel: Ich würde trotzdem anders ansetzen. Statt das Gespräch abzuschaffen, sollte man es besser machen: feste Fragen, mehrere Beurteilende, Kriterien, die vorher feststehen. Wenn man das sauber macht, braucht man meiner Meinung nach keinen ganzen Tag.",
      "Okafor: Ich sehe das gar nicht als Entweder-oder. Am Ende des Probetags führen wir ja auch ein Gespräch, nur eben ein Gespräch über etwas Konkretes, nämlich über die Aufgabe, die jemand gerade gelöst hat. Das ist etwas ganz anderes als die Frage, wo man sich in fünf Jahren sieht.",
      "Seidel: Ach so. Gut, wenn es so läuft, liegen wir weniger weit auseinander, als ich dachte. Ich warne nur davor, den Probetag als Allheilmittel zu verkaufen. Es gibt Stellen, da lässt sich in acht Stunden schlicht nichts Sinnvolles zeigen. Denken Sie an strategische Aufgaben, deren Ergebnis man erst nach Monaten beurteilen kann.",
      "Okafor: Genau. Für solche Positionen würde ich ihn auch nicht empfehlen. Wir stellen vor allem Entwicklerinnen und Entwickler ein, und da passt es.",
    ]),
  clip(L_INTERVIEW, "Interview: Warum Projekte länger dauern als geplant", "Projektmanagement",
    [
      { label: "Moderator", voice: "B" },
      { label: "Brandstätter", voice: "A" },
    ],
    [
      "Moderator: Frau Doktor Brandstätter, Sie erforschen, warum große Vorhaben fast immer teurer werden und länger dauern als geplant. Ist das einfach Pech?",
      "Brandstätter: Nein, das glaube ich nicht. Wenn es Pech wäre, müssten sich die Abweichungen ja in beide Richtungen verteilen. Manche Projekte wären früher fertig, andere später. Tatsächlich liegen aber fast alle auf derselben Seite, nämlich auf der späteren. Das spricht für einen systematischen Fehler, nicht für Zufall.",
      "Moderator: Und der Fehler liegt wo?",
      "Brandstätter: Im Kern darin, dass wir aus der Innenperspektive planen. Wir schauen auf unser Vorhaben, zerlegen es in Schritte, schätzen jeden Schritt und zählen zusammen. Und was dabei fehlt, sind all die Dinge, die wir nicht vorhersehen können, gerade weil wir sie nicht kennen: die Lieferung, die ausbleibt, die Genehmigung, die sich verzögert, die Kollegin, die mitten im Projekt kündigt. Einzeln ist jedes dieser Ereignisse unwahrscheinlich. Dass gar keines eintritt, ist aber noch unwahrscheinlicher.",
      "Moderator: Was wäre die Alternative?",
      "Brandstätter: Man nimmt bewusst die Außenperspektive ein. Man fragt nicht zuerst: Wie lange brauchen wir? Sondern: Wie lange haben vergleichbare Projekte gedauert, und zwar nicht laut Plan, sondern bis zum tatsächlichen Abschluss? Diese Zahl ist meist ernüchternd, aber sie ist ein viel besserer Ausgangspunkt.",
      "Moderator: Haben Sie ein Beispiel?",
      "Brandstätter: Nehmen Sie eine Behörde, die ihre Software erneuern will. Intern schätzt man achtzehn Monate. Wenn man sich aber zwanzig ähnliche Vorhaben ansieht, dann haben die im Schnitt fast drei Jahre gedauert. Also, achtzehn Monate gegen fast drei Jahre. Und dann muss man sich fragen: Was genau berechtigt uns zu der Annahme, dass wir schneller sind? Meistens lautet die ehrliche Antwort: nicht viel.",
      "Moderator: Das klingt einleuchtend. Warum macht es dann kaum jemand?",
      "Brandstätter: Weil sich ein realistischer Plan schlecht verkauft. Wer in einer Sitzung sagt, das Projekt dauert vermutlich doppelt so lange wie erhofft, gilt schnell als Bedenkenträger. Wer dagegen einen ehrgeizigen Zeitplan präsentiert, bekommt den Zuschlag. Optimismus wird also belohnt, und zwar genau dann, wenn entschieden wird. Die Rechnung kommt später, und dann fühlt sich oft niemand mehr zuständig.",
      "Moderator: Lügen die Beteiligten also bewusst?",
      "Brandstätter: In den allermeisten Fällen nicht, nein, das wäre zu einfach. Die meisten glauben an ihre Zahlen. Genau das macht es so schwierig. Ich vergleiche das gern mit einem Navigationsgerät, das jeden Stau ignoriert. Es lügt nicht, es rechnet nur mit einer Welt, die es so nicht gibt.",
      "Moderator: Was raten Sie Unternehmen?",
      "Brandstätter: Erstens: Vergleichsdaten sammeln, auch über gescheiterte Projekte. Zweitens: Wer einen Plan aufstellt, sollte ihn nicht selbst genehmigen. Und drittens, das klingt banal: Reserven offen ausweisen, statt sie in einzelnen Positionen zu verstecken. Versteckte Reserven werden nämlich verbraucht, ob man sie braucht oder nicht.",
    ]),
  clip(L_SCHLAF, "Wissenschaftsmagazin: Schlaf und Lernen", "Gesundheit, Schlaf",
    [
      { label: "Moderatorin", voice: "A" },
      { label: "Lindqvist", voice: "D" },
    ],
    [
      "Moderatorin: Frau Lindqvist, es heißt ja gern, wer vor einer Prüfung durchlernt, statt zu schlafen, sei selber schuld. Stimmt das so pauschal?",
      "Lindqvist: Pauschal stimmt fast nichts in meinem Fach. Richtig ist: Im Schlaf sortiert das Gehirn, was tagsüber hängen geblieben ist. Aber, und das wird gern unterschlagen, das gilt vor allem für Stoff, den man vorher auch wirklich verstanden hat. Wer nur stur auswendig paukt, hat nach acht Stunden Schlaf nicht automatisch mehr im Kopf, er hat lediglich weniger vergessen.",
      "Moderatorin: Das klingt nach einem Trostpreis.",
      "Lindqvist: Je nachdem. Für eine Vokabelliste ist es ein Gewinn, für eine Argumentationskette eher nicht. Und dann gibt es ein Gegenargument, das mich selbst lange beschäftigt hat: Die berühmten Studien stammen fast alle von jungen, gesunden Probanden im Labor. Ob sich das auf eine Familie mit Neugeborenem übertragen lässt, wage ich zu bezweifeln.",
      "Moderatorin: Was raten Sie also?",
      "Lindqvist: Weder Durchlernen noch Schlafen um jeden Preis, sondern etwas Unspektakuläres. Wer unter Zeitdruck steht, sollte den Stoff abends noch einmal kurz durchgehen, sofern er nicht völlig erschöpft ist, und danach schlafen. Der Mittagsschlaf, auf den viele schwören, bringt übrigens nur etwas, wenn er unter einer halben Stunde bleibt. Alles darüber macht eher träge als klug.",
    ]),
  clip(L_BAHN, "Reiseradio: Nachtzug statt Flug?", "Reisen, Bahn",
    [
      { label: "Moderatorin", voice: "A" },
      { label: "Hartmann", voice: "B" },
    ],
    [
      "Moderatorin: Herr Hartmann, Sie sind gerade mit dem Nachtzug aus Wien zurückgekommen. Lohnt sich das, oder ist das Romantik für Leute, die Zeit haben?",
      "Hartmann: Beides, ehrlich gesagt. Man kommt ausgeruht an, sofern man ein Schlafwagenabteil bucht. Im Sitzwagen, na ja, da fühlt man sich am nächsten Morgen, als hätte man die Nacht auf einer Parkbank verbracht. Und der Preis: Das Ticket war nicht billiger als der Flug, aber wer die Stunden am Flughafen mitrechnet und das Hotel für die eine Nacht spart, für den kommt es ungefähr aufs Gleiche heraus.",
      "Moderatorin: Ungefähr gleich, das klingt vorsichtig.",
      "Hartmann: Ist es auch. Die Bahn wirbt gern mit dem Klimaschutz, und das stimmt ja auch. Nur: Verspätet sich der Zug um zwei Stunden, was nicht selten vorkommt, fehlt der Anschlusszug, und der Vorteil ist schnell dahin. Man muss die Reise also mögen. Wer sie nur als Mittel zum Zweck sieht, wird enttäuscht.",
      "Moderatorin: Und wem würden Sie sie trotzdem empfehlen?",
      "Hartmann: Allen, die flexibel sind. Und ein Tipp, den mir niemand gegeben hat: das Frühstück am besten schon abends bestellen. Morgens ist es nämlich meistens ausverkauft, und das ausgerechnet auf einer Fahrt, bei der man nichts anderes zu tun hat, als zu warten.",
    ]),
  clip(L_WOHNEN, "Streitgespräch: Den Innenhof bebauen?", "Wohnen, Stadtplanung",
    [
      { label: "Behrens", voice: "A" },
      { label: "Aydin", voice: "B" },
    ],
    [
      "Behrens: Wenn ich höre, der Innenhof dürfe auf keinen Fall bebaut werden, frage ich mich immer, wer dabei eigentlich gemeint ist. Die Bewohner der Altbauten, die heute den ruhigen Hof haben, oder die Familien, die seit Jahren eine bezahlbare Wohnung suchen?",
      "Aydin: Das ist eine geschickte Gegenüberstellung, aber sie unterschlägt etwas. Ein Hof ist ja nicht bloß Restfläche. Wenn wir ihn zubauen, verlieren hundertzwanzig Haushalte ihren einzigen Grünraum, und die neuen Wohnungen entstehen, zumindest nach dem aktuellen Entwurf, überwiegend im oberen Preissegment.",
      "Behrens: Das ließe sich regeln. Wir können Quoten festschreiben.",
      "Aydin: Festschreiben kann man vieles. Die Erfahrung der letzten Jahre lehrt eher, dass Quoten nach der Baugenehmigung nachverhandelt werden. Ich will nicht unterstellen, dass das hier geplant ist, aber ich möchte es vertraglich ausgeschlossen sehen.",
      "Behrens: Einverstanden, das nehme ich mit. Trotzdem bleibt mein Punkt: Wer jede Nachverdichtung ablehnt, sorgt dafür, dass die Preise weiter steigen, und das trifft nicht die, die schon eine Wohnung haben.",
      "Aydin: Da stimme ich zu, nur zieht daraus nicht jeder denselben Schluss. Ich würde Dächer aufstocken und Parkplätze überbauen, bevor ich einen Hof opfere.",
      "Behrens: Nett gesagt. Nur gehören die Dächer leider Eigentümern, die davon wenig halten.",
    ]),
];

const lF = forClip(L_FEATURE);
const lD = forClip(L_DEBATTE);
const lI = forClip(L_INTERVIEW);
const lS = forClip(L_SCHLAF);
const lB = forClip(L_BAHN);
const lW = forClip(L_WOHNEN);

const listeningItems: SeedItem[] = [
  // Radiofeature
  lF.tfng("detail", "MID",
    [
      ["Die Werbeagentur will ihre Regel demnächst lockern.", "NG"],
      ["Laut der Umfrage empfindet die Mehrheit der Befragten unangekündigte Anrufe als lästig.", "R"],
      ["Wendland sieht im Rückgang des Telefonierens allein ein Zeichen von Bequemlichkeit.", "F"],
    ],
    "1 NG: Die Erfahrungen mit der Regel seien gemischt; über Pläne, sie zu ändern, wird nichts gesagt. 2 R: \"Mehr als die Hälfte\" findet sie störend. 3 F: Der Rückgang ist \"auch ein Stück Rücksicht, nicht nur Bequemlichkeit\"."),
  lF.choice("attitude", "MID",
    "Wie beurteilt Wendland die Behauptung, Schreiben sei effizienter als Telefonieren?",
    [
      "Er hält sie nur für einfache Absprachen für zutreffend, nicht für Konflikte.",
      "Er stimmt ihr zu, weil Nachrichten dem Empfänger mehr Zeit zum Antworten lassen.",
      "Er lehnt sie ab, weil Mails über Tage hinweg grundsätzlich mehr Arbeit machen.",
      "Er hält sie für nicht überprüfbar, weil die Forschung dazu keine Zahlen liefert.",
    ], "a",
    "\"Bei einfachen Absprachen, ja, gar keine Frage ... Aber sobald es um Konflikte geht ...\": eine eingeschränkte Zustimmung. (b) nimmt das Rücksichtsargument aus dem ersten Teil für die Effizienz, (c) verallgemeinert die Aussage über Missverständnisse, (d) kommt nicht vor."),
  lF.choice("attitude", "HARD",
    "Was hält Wendland von der Regel der Werbeagentur?",
    [
      "Er hält sie für die wirksamste Lösung des Problems und empfiehlt, sie anderswo ebenfalls einzuführen.",
      "Er lehnt sie ab, weil sie vor allem dazu dient, die Mitarbeitenden besser zu überwachen.",
      "Er erkennt die Absicht an, bezweifelt aber, dass sich Gesprächskultur durch Vorschriften verändern lässt.",
      "Er schlägt vor, die Zahl der erlaubten Mails zu einem Thema weiter zu senken, damit mehr telefoniert wird.",
    ], "c",
    "\"gut gemeint, aber ... ein bisschen hilflos. Gesprächskultur lässt sich nicht verordnen\". Er setzt stattdessen auf Vorbilder unter den Führungskräften."),

  // Streitgespräch: wer vertritt welche Meinung (Goethe C2 Hören Teil 2)
  lD.match("attitude", "HARD",
    "Wer vertritt die folgende Meinung: nur Frau Seidel, nur Herr Okafor, beide oder keiner von beiden?",
    [
      "Vorstellungsgespräche ohne feste Struktur sind ein unzuverlässiges Auswahlinstrument.",
      "Auf einen Probetag kann man verzichten, wenn das Gespräch professionell geführt wird.",
      "Sich rasch in einer ungewohnten Umgebung zurechtzufinden, ist für die ausgeschriebenen Stellen wichtig.",
      "Ein Probetag eignet sich für jede Art von Stelle gleichermaßen.",
    ],
    ["nur Frau Seidel", "nur Herr Okafor", "beide", "keiner von beiden"],
    [3, 1, 2, 4],
    "1 beide: Okafor (\"misst vor allem eins: wie gut sich jemand verkauft\"), Seidel (\"Da widerspreche ich gar nicht ... unzuverlässig\"). 2 nur Seidel: \"braucht man keinen ganzen Tag\"; Okafor sieht kein Entweder-oder. 3 nur Okafor: \"gehört zum Job\"; Seidel: \"Darüber kann man streiten.\" 4 keiner: Seidel nennt strategische Stellen als Gegenbeispiel, Okafor stimmt zu."),
  lD.choice("attitude", "MID",
    "Wie reagiert Herr Okafor auf den Einwand, ein Probetag benachteilige manche Bewerber?",
    [
      "Er bestreitet, dass Bewerber mit festen Verpflichtungen den Probetag in der Praxis ablehnen.",
      "Er gibt dem Einwand recht und verweist auf Termine am Samstag oder an zwei Nachmittagen.",
      "Er rät Bewerbern mit wenig Zeit, sich bei Firmen mit klassischem Auswahlverfahren zu bewerben.",
      "Er kündigt an, den Probetag deshalb in Zukunft nur noch auf Wunsch der Bewerber anzubieten.",
    ], "b",
    "\"Das Argument kenne ich, und es ist berechtigt\" + Samstag oder zwei Nachmittage + \"Perfekt ist das nicht\"."),
  lD.choice("detail", "MID",
    "Worum geht es im Gespräch am Ende des Probetags?",
    [
      "um die Karrierepläne der Bewerberin oder des Bewerbers für die nächsten Jahre",
      "um die Eindrücke, die die Kolleginnen und Kollegen vom Verlauf des Tages gewonnen haben",
      "um die Gehaltsvorstellungen und den frühestmöglichen Beginn der Zusammenarbeit",
      "um die Aufgabe, die die Bewerberin oder der Bewerber im Laufe des Tages gelöst hat",
    ], "d",
    "\"über die Aufgabe, die jemand gerade gelöst hat\". Die Frage nach den fünf Jahren nennt Okafor gerade als Gegenbeispiel (Distraktor a)."),

  // Experteninterview: MC (Goethe C2 Hören Teil 3)
  lI.choice("inference", "MID",
    "Warum hält Brandstätter Pech als Erklärung für unwahrscheinlich?",
    [
      "Weil große Vorhaben heute deutlich besser geplant werden als noch vor zwanzig Jahren.",
      "Weil unvorhergesehene Störungen nach ihrer Erfahrung selten auftreten und kaum ins Gewicht fallen.",
      "Weil die Abweichungen nahezu immer in dieselbe Richtung weisen, nämlich zu längeren Laufzeiten.",
      "Weil die meisten Vorhaben am Ende doch noch rechtzeitig und im Kostenrahmen abgeschlossen werden.",
    ], "c",
    "Zufall würde Abweichungen in beide Richtungen erzeugen; \"fast alle auf derselben Seite\" spricht für einen systematischen Fehler. (b) widerspricht ihrer späteren Aussage, dass unvorhergesehene Ereignisse gerade zusammengenommen sehr wahrscheinlich sind."),
  lI.choice("detail", "HARD",
    "Warum setzen sich realistische Zeitpläne laut Brandstätter selten durch?",
    [
      "Weil sie sich mit den üblichen Planungsmethoden kaum berechnen lassen und deshalb stets unsicher bleiben.",
      "Weil Projektleitungen für spätere Verzögerungen persönlich haften und deshalb vorsichtig kalkulieren.",
      "Weil Vergleichsdaten anderer Unternehmen meist nicht zugänglich sind und eigene Erfahrungen fehlen.",
      "Weil bei der Vergabe kühne Terminplanung honoriert wird, vorsichtige Planer aber als Miesmacher gelten.",
    ], "d",
    "\"Optimismus wird also belohnt, und zwar genau dann, wenn entschieden wird\"; wer realistisch plant, gilt als Bedenkenträger. (b) steht im Gegensatz zu \"dann fühlt sich oft niemand mehr zuständig\"."),
  lI.choice("inference", "HARD",
    "Was will Brandstätter mit dem Vergleich mit dem Navigationsgerät verdeutlichen?",
    [
      "Planende rechnen ehrlich, gehen aber von Bedingungen aus, die in der Wirklichkeit so nicht vorkommen.",
      "Planende verschweigen Risiken, die ihnen bekannt sind, um den Zuschlag für das Projekt zu erhalten.",
      "Technische Hilfsmittel führen bei der Planung großer Vorhaben häufig zu Fehlern, weil sie veraltet sind.",
      "Verzögerungen entstehen vor allem durch äußere Umstände, auf die niemand Einfluss nehmen kann.",
    ], "a",
    "\"Es lügt nicht, es rechnet nur mit einer Welt, die es so nicht gibt\" = keine Täuschung, aber eine verzerrte Annahme. (b) verneint sie ausdrücklich, (c) und (d) nehmen das Bild wörtlich."),

  // Schlaf und Lernen: note-taking of a qualification, an objection and a condition
  lS.notes("notes", "HARD",
    "Notieren Sie beim Hören die fehlenden Angaben in Stichworten.\n\nDer Schlaf festigt vor allem Stoff, der vorher {{g1}} wurde.\nEinwand gegen die Studien: Untersucht wurden fast nur {{g2}} im Labor.\nAbends noch einmal durchgehen, sofern man nicht völlig {{g3}} ist.",
    [
      ["verstanden", "wirklich verstanden", "richtig verstanden", "auch wirklich verstanden", "begriffen", "wirklich begriffen", "nachvollzogen", "durchdrungen", "verinnerlicht"],
      ["junge, gesunde Probanden", "junge gesunde Probanden", "junge und gesunde Probanden", "jungen, gesunden Probanden", "jungen gesunden Probanden", "junge, gesunde Menschen", "junge gesunde Menschen", "junge und gesunde Menschen", "junge, gesunde Leute", "junge gesunde Leute", "junge Menschen", "junge, gesunde Teilnehmer", "junge, gesunde Teilnehmende", "junge gesunde Teilnehmende", "junge Gesunde", "jung und gesund", "jung, gesund", "gesunde Probanden", "junge Probanden", "gesunde Versuchspersonen", "junge, gesunde Versuchspersonen"],
      ["erschöpft", "übermüdet", "müde", "ausgelaugt", "fertig", "kaputt", "am Ende", "ausgepowert"],
    ],
    "g1: Einschränkung: Der Effekt gilt \"vor allem für Stoff, den man vorher auch wirklich verstanden hat\" (nicht für stures Auswendiglernen). g2: Gegenargument: Die Studien stammen \"fast alle von jungen, gesunden Probanden im Labor\". g3: Bedingung: den Stoff abends kurz durchgehen, \"sofern er nicht völlig erschöpft ist\". Sinnverwandte Wörter und Wendungen werden akzeptiert."),
  lS.choice("attitude", "HARD",
    "Wie steht Frau Lindqvist zu der Behauptung, wer durchlerne, sei selber schuld?",
    [
      "Sie bestätigt sie, da Schlaf für jede Art von Lernstoff gleich wichtig ist.",
      "Sie hält sie für zu pauschal, erkennt aber an, dass durchaus etwas an ihr dran ist.",
      "Sie weist sie zurück, weil Schlaf nach ihrer Erfahrung beim Lernen kaum etwas bewirkt.",
      "Sie hält sie für überholt, seit neuere Studien auch Familien mit Neugeborenen untersucht haben.",
    ], "b",
    "\"Pauschal stimmt fast nichts in meinem Fach\", danach folgt aber die Bestätigung, dass das Gehirn im Schlaf sortiert, wenn der Stoff verstanden wurde. (a) und (c) sind Extrempositionen, (d) behauptet eine Studienlage, die sie gerade bezweifelt."),
  lS.choice("inference", "HARD",
    "Warum bezweifelt Frau Lindqvist, dass die Laborstudien auf jeden Alltag übertragbar sind?",
    [
      "Weil die Labore den Schlaf der Teilnehmenden durch Messgeräte nachweislich verkürzt haben.",
      "Weil zu wenige Menschen teilgenommen haben, um zuverlässige Durchschnittswerte zu liefern.",
      "Weil die Teilnehmenden kaum die Lebenslagen abbilden, in denen Schlaf im Alltag wirklich knapp ist.",
      "Weil im Labor überwiegend Leistungen gemessen wurden, die mit echten Prüfungen nichts zu tun haben.",
    ], "c",
    "Die Studien stammen von jungen, gesunden Probanden; die Familie mit Neugeborenem steht stellvertretend für Lebenslagen mit knappem, gestörtem Schlaf. Die Schlussfolgerung muss aus dem Beispiel gezogen werden, sie wird nicht ausgesprochen. (a), (b) und (d) kommen im Gespräch nicht vor."),

  // Nachtzug: note-taking, irony and a hedged price judgement
  lB.notes("notes", "HARD",
    "Notieren Sie beim Hören die fehlenden Angaben in Stichworten.\n\nGut ausgeruht kommt man an, sofern man ein {{g1}} bucht.\nPreislich etwa gleich, wenn man die Zeit am Flughafen mitrechnet und {{g2}} spart.\nBei zwei Stunden Verspätung fehlt der {{g3}}.",
    [
      ["Schlafwagenabteil", "Schlafwagen-Abteil", "Schlafwagen", "Abteil im Schlafwagen", "Schlafabteil", "Schlafwagenplatz", "Schlafplatz"],
      ["das Hotel", "das Hotel für die eine Nacht", "das Hotel für eine Nacht", "Hotel für eine Nacht", "eine Nacht im Hotel", "eine Hotelnacht", "die Hotelnacht", "Hotelnacht", "das Hotelzimmer", "Hotelzimmer", "ein Hotel", "Hotel", "die Hotelübernachtung", "eine Hotelübernachtung", "Hotelübernachtung", "die Übernachtung", "Übernachtung", "die Hotelkosten", "Hotelkosten", "die Übernachtungskosten", "Übernachtungskosten", "die Hotelnacht"],
      ["Anschlusszug", "Anschluss", "Anschlussverbindung", "Zuganschluss", "Anschlußzug"],
    ],
    "g1: Voraussetzung für Erholung: ein Schlafwagenabteil (im Sitzwagen nicht). g2: Das Ticket ist nicht billiger, aber rechnet man die Stunden am Flughafen mit und spart das Hotel für die Nacht, läuft es ungefähr aufs Gleiche hinaus. g3: Bei zwei Stunden Verspätung \"fehlt der Anschlusszug\". Sinnverwandte Wörter werden akzeptiert."),
  lB.choice("inference", "HARD",
    "Wie ist die Bemerkung gemeint, im Sitzwagen fühle man sich am Morgen, als hätte man die Nacht auf einer Parkbank verbracht?",
    [
      "Als Hinweis darauf, dass es im Sitzwagen keine Sitzplätze gibt und man draußen warten muss.",
      "Als scherzhafte Übertreibung für die geringe Erholung, die man im Sitzwagen findet.",
      "Als Beleg dafür, dass Bänke im Freien bequemer sind als Sitze in modernen Zügen.",
      "Als Kritik daran, dass die Bahn zu wenig auf die Sauberkeit in den Wagen achtet.",
    ], "b",
    "Das Bild ist eine ironische Zuspitzung: Gemeint ist, dass man im Sitzen kaum schläft und zerschlagen ankommt, im Gegensatz zum Schlafwagenabteil. (a), (c) und (d) nehmen das Bild wörtlich oder deuten es als Kritik, die nicht gemeint ist."),
  lB.choice("attitude", "HARD",
    "Wie vergleicht Herr Hartmann die Kosten von Nachtzug und Flug?",
    [
      "Er hält den Zug für deutlich günstiger, weil das Ticket weniger kostet als der Flug.",
      "Er hält beide nur dann für ungefähr gleich teuer, wenn man die Zeit am Flughafen und das Hotel einrechnet.",
      "Er hält den Zug für teurer, weil man für den Schlafwagen einen hohen Aufpreis zahlen muss.",
      "Er meint, der Preis spiele für die Entscheidung keine Rolle, solange man damit das Klima schont.",
    ], "b",
    "\"nicht billiger als der Flug\", aber mit Stunden am Flughafen und gespartem Hotel \"ungefähr gleich\"; die Moderatorin nennt das \"vorsichtig\", er bestätigt. (a) ist das Gegenteil, (c) und (d) werden nicht gesagt."),

  // Innenhof: stance, rhetorical question, polite objection
  lW.choice("attitude", "HARD",
    "Was will Frau Behrens mit ihrer Frage erreichen, wer bei der Forderung, den Hof nicht zu bebauen, \"eigentlich gemeint ist\"?",
    [
      "Sie will klären, welche Gruppen von der geplanten Bebauung tatsächlich betroffen sind.",
      "Sie will den Gegnern unterstellen, vor allem die eigenen Vorteile zu verteidigen.",
      "Sie will den Bewohnern der Altbauten zusichern, dass ihre Interessen Vorrang haben werden.",
      "Sie will Herrn Aydin auffordern, die genaue Zahl der betroffenen Haushalte zu nennen.",
    ], "b",
    "Die Frage ist rhetorisch: Sie stellt die Bewohner mit Hof den Wohnungssuchenden gegenüber und legt nahe, dass die Gegner eigentlich ihre eigene Lage schützen. Aydin nennt die Gegenüberstellung \"geschickt\". (a) und (d) fassen sie als echte Frage auf, (c) widerspricht ihrer Position."),
  lW.choice("detail", "HARD",
    "Was verlangt Herr Aydin im Hinblick auf die versprochenen Quoten?",
    [
      "Dass die Stadt die Quoten nach der Baugenehmigung selbst überprüft und die Ergebnisse veröffentlicht.",
      "Dass der Anteil bezahlbarer Wohnungen verbindlich vertraglich festgelegt wird.",
      "Dass die Zahl der Neubauwohnungen im oberen Preissegment ganz gestrichen wird.",
      "Dass Frau Behrens öffentlich erklärt, eine spätere Nachverhandlung sei nicht geplant.",
    ], "b",
    "\"Ich will nicht unterstellen, dass das hier geplant ist, aber ich möchte es vertraglich ausgeschlossen sehen.\" Gemeint ist die Nachverhandlung der Quoten; sie soll vertraglich unmöglich sein. (a), (c) und (d) werden nicht gefordert."),
  lW.choice("inference", "HARD",
    "Wie ist die letzte Bemerkung von Frau Behrens über die Dächer gemeint?",
    [
      "Als Zustimmung dazu, dass Aufstockungen den besten Kompromiss darstellen würden.",
      "Als Hinweis darauf, dass viele Dächer baulich für Aufstockungen gar nicht geeignet sind.",
      "Als skeptischen Einwand, dass Aydins Alternative an den Eigentümern scheitern dürfte.",
      "Als Angebot, mit den Eigentümern der Dächer selbst über eine Aufstockung zu verhandeln.",
    ], "c",
    "\"Nett gesagt. Nur gehören die Dächer leider Eigentümern, die davon wenig halten.\" Die Wendung \"Nett gesagt\" ist leicht ironisch und leitet einen skeptischen Einwand ein; die Alternative wird durch die Besitzverhältnisse in Frage gestellt. (a) widerspricht dem \"Nur\", (b) und (d) kommen nicht vor."),
];

// ------------------------------------------------------------------ writing

const FORMAL = "formell (Sie)";
const NEUTRAL = "neutral/sachlich";

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

const writingItems: SeedItem[] = [
  writingTask("summary", "EASY", [180, 260],
    "Lesen Sie den folgenden Auszug aus einer Fachzeitschrift. Fassen Sie die Kernaussagen mit eigenen Worten zusammen und nehmen Sie anschließend begründet Stellung, insbesondere zu den genannten Gegenmaßnahmen (insgesamt etwa 220 Wörter).\n\n" +
      "„Die Verlagerung von Besprechungen in Videokonferenzen hat die Zahl der Termine nicht verringert, sondern erhöht. Weil Wege entfallen, lassen sich mehr Sitzungen in einen Tag pressen, und die Hemmschwelle, jemanden einzuladen, ist gesunken. Gleichzeitig fehlen die informellen Minuten vor und nach einem Treffen, in denen früher vieles nebenbei geklärt wurde. Manche Unternehmen reagieren mit besprechungsfreien Tagen, andere mit der Regel, dass jede Einladung ein schriftliches Ziel enthalten muss. Ob solche Maßnahmen dauerhaft wirken, ist bislang kaum untersucht.“",
    [
      "Zusammenfassung der Kernaussagen ohne wörtliche Übernahme (mehr Termine, Gründe dafür, Verlust informeller Gespräche, Gegenmaßnahmen, fehlende Forschung)",
      "klare Trennung zwischen Wiedergabe und eigener Stellungnahme (z. B. Redewiedergabe, Konjunktiv I)",
      "begründete eigene Position zu mindestens einer der genannten Gegenmaßnahmen",
      "sachlicher, präziser Stil mit treffendem Wortschatz",
    ],
    [
      "die Kernaussagen mit eigenen Worten zusammenfassen",
      "anschließend begründet Stellung nehmen, besonders zu den Gegenmaßnahmen",
    ],
    NEUTRAL,
    "C2: Zusammenfassen und Bewerten eines Fachtextes. Entscheidend ist die Paraphrase mit eigenen Mitteln und die saubere Trennung von Referat und Kommentar."),
  // Was EASY: a diplomatic statement to the management is a MID task at C2.
  writingTask("formal", "MID", [250, 350],
    "Die Geschäftsleitung Ihres Unternehmens plant, eine Software einzuführen, die Tastatureingaben und Bildschirmaktivität aller Beschäftigten aufzeichnet, um „die Produktivität sichtbar zu machen“. Sie wurden als Mitglied einer Arbeitsgruppe um eine schriftliche Stellungnahme gebeten.\n\n" +
      "Schreiben Sie an die Geschäftsleitung (etwa 300 Wörter). Gehen Sie darauf ein,\n" +
      "- welche Ziele Sie hinter dem Vorhaben nachvollziehen können,\n" +
      "- welche Bedenken Sie haben (fachlich, rechtlich oder im Hinblick auf das Betriebsklima),\n" +
      "- welche Alternative Sie vorschlagen.",
    [
      "würdigt das Anliegen der Geschäftsleitung differenziert, statt es pauschal abzulehnen",
      "formuliert mindestens zwei klar begründete Bedenken",
      "macht einen konkreten, umsetzbaren Gegenvorschlag",
      "diplomatischer, formeller Ton mit passender Anrede, Einleitung und Schluss",
    ],
    [
      "welche Ziele Sie nachvollziehen können",
      "Ihre Bedenken",
      "eine Alternative",
      "Anrede, Einleitung und Schluss",
    ],
    FORMAL,
    "Formelle Stellungnahme mit Kritik nach oben: Bewertet werden Diplomatie (Abschwächung, Konjunktiv II), Argumentationsqualität und Register."),
  // Source-based reply: a journalist's four questions plus shorthand notes (the questions must all be answered).
  writingTask("reply", "MID", [220, 320],
    "Sie leiten das Besucherzentrum eines Naturparks. Eine Journalistin hat Ihnen geschrieben:\n\n" +
      "„Sehr geehrte Damen und Herren, für einen Beitrag über den Tourismus in Schutzgebieten recherchiere ich gerade. Ich hätte gern gewusst: Wie viele Gäste kommen im Jahr zu Ihnen, und wie hat sich diese Zahl entwickelt? Welche Regeln gelten für Wandernde, und wie werden sie durchgesetzt? Wie stehen Sie zu der Forderung, den Zugang an Spitzentagen zu begrenzen? Und könnte ich im Mai einen Ranger bei seiner Arbeit begleiten? Mit freundlichen Grüßen, Mara Sievers“\n\n" +
      "Ihre Notizen dazu:\n" +
      "- letztes Jahr rund 180 000 Gäste, seit 2019 etwa 40 Prozent mehr, meist Tagesgäste\n" +
      "- Regeln: Wege nicht verlassen, Hunde an die Leine, kein Feuer; Kontrolle durch Ranger, bei Verstoß Verwarnung, bei schweren Fällen Bußgeld\n" +
      "- Begrenzung an Spitzentagen: Reservierung für Parkplätze wird geprüft, Entscheidung im Herbst nach Gesprächen mit den Gemeinden; Ihre Meinung: nur als letztes Mittel, besser Bus plus Parkgebühr\n" +
      "- Mai: Begleitung nur am 12. und am 26. Mai möglich, Anmeldung bis 30. April, Fotos nur nach Absprache\n\n" +
      "Schreiben Sie Frau Sievers eine E-Mail (etwa 250 Wörter). Beantworten Sie alle ihre Fragen und verwenden Sie Ihre Notizen, ohne sie wörtlich zu übernehmen.",
    [
      "beantwortet alle vier Fragen der Journalistin vollständig und in sinnvoller Reihenfolge",
      "gibt Besucherzahl, Entwicklung, Regeln, Kontrolle und Folgen bei Verstößen zutreffend wieder",
      "bezieht zur Begrenzung des Zugangs Stellung und begründet die eigene Haltung, ohne der noch ausstehenden Entscheidung vorzugreifen",
      "nennt die möglichen Termine, die Anmeldefrist und die Bedingung für Fotos",
      "formelle E-Mail mit Anrede, Einleitung und Schluss; Notizen sind in eigene, vollständige Sätze umgesetzt",
    ],
    [
      "alle vier Fragen beantworten",
      "Ihre Notizen in eigenen Worten wiedergeben",
      "zur Begrenzung des Zugangs Ihre Haltung begründen",
      "alle Angaben zur Begleitung nennen",
      "Anrede, Einleitung und Schluss",
    ],
    FORMAL,
    "Quellengestützte Antwort auf eine Anfrage (Muster: ÖSD C2, Antwort anhand von Stichworten). Geprüft wird, ob jede Frage beantwortet ist und ob die Stichworte in eigenen Formulierungen und im passenden Register verarbeitet werden."),
  writingTask("transformation", "MID", [30, 150],
    "In einem internen Papier sollen die folgenden sechs Sätze stilistisch überarbeitet werden. Formulieren Sie jeden Satz so um, dass die Bedeutung gleich bleibt und das Wort in Klammern verwendet wird. Das Wort in Klammern darf nicht verändert werden. Schreiben Sie nur die sechs neuen Sätze.\n\n" +
      "1. Obwohl sich die Abteilung sehr bemühte, wurde die Frist nicht eingehalten. (trotz)\n" +
      "2. Wenn die Zahlen weiter sinken, muss das Projekt neu bewertet werden. (Sollten)\n" +
      "3. Man kann diesen Fehler nicht ohne Weiteres beheben. (lässt)\n" +
      "4. Man behauptet, dass der Bericht schon im Mai fertig gewesen sei. (soll)\n" +
      "5. Die Teilnehmenden, die sich angemeldet haben, erhalten die Unterlagen vorab. (angemeldeten)\n" +
      "6. Weil keine Mittel vorhanden waren, wurde die Schulung abgesagt. (mangels)",
    [
      "1: Trotz der großen Bemühungen der Abteilung wurde die Frist nicht eingehalten. 2: Sollten die Zahlen weiter sinken, muss das Projekt neu bewertet werden.",
      "3: Dieser Fehler lässt sich nicht ohne Weiteres beheben. 4: Der Bericht soll schon im Mai fertig gewesen sein.",
      "5: Die angemeldeten Teilnehmenden erhalten die Unterlagen vorab. 6: Mangels Mitteln (auch: mangels finanzieller Mittel) wurde die Schulung abgesagt.",
      "Bedeutung unverändert, vorgegebenes Wort unverändert, Satz grammatisch korrekt; je Satz ein Punkt, gleichwertige Lösungen gelten",
    ],
    [
      "jeden der sechs Sätze umformen",
      "das Wort in Klammern unverändert verwenden",
      "die Bedeutung beibehalten",
      "nur die sechs neuen Sätze schreiben",
    ],
    NEUTRAL,
    "Umformungsaufgabe wie Goethe C2 Schreiben Teil 1. Die Lösungen in den Inhaltspunkten sind Musterlösungen; jede bedeutungsgleiche, korrekte Lösung mit dem vorgegebenen Wort ist richtig."),
  writingTask("review", "MID", [300, 420],
    "Ein Magazin veröffentlicht Rezensionen seiner Leserinnen und Leser. Besprechen Sie ein Sachbuch, einen längeren Artikel, einen Vortrag, eine Dokumentation oder einen Podcast zu einem gesellschaftlichen Thema (zum Beispiel Arbeit, Bildung, Technik oder Umwelt), das oder den Sie kennen (etwa 350 Wörter).\n\n" +
      "Gehen Sie auf die folgenden drei Aspekte ein:\n" +
      "- Worum geht es, und welche zentrale These wird vertreten?\n" +
      "- Wie überzeugend sind Argumentation und Darstellung?\n" +
      "- Für wen lohnt sich die Lektüre beziehungsweise das Anhören, und für wen nicht?",
    [
      "knappe, zutreffende Wiedergabe von Thema und zentraler These",
      "begründete Bewertung von Argumentation und Darstellung mit Beispielen",
      "differenzierte Empfehlung für eine bestimmte Zielgruppe",
      "textsortengerechter Aufbau (Einleitung, Hauptteil, Fazit) und gewandter, variabler Stil",
    ],
    [
      "worum es geht und welche These vertreten wird",
      "wie überzeugend Argumentation und Darstellung sind",
      "für wen sich die Lektüre lohnt und für wen nicht",
      "Einleitung, Hauptteil und Fazit",
    ],
    NEUTRAL,
    "Rezension nach Goethe C2 Schreiben Teil 2. Die Wahl des Werks ist frei; bewertet wird die Erfüllung der drei Aspekte, nicht das Werk selbst."),
  writingTask("letter", "HARD", [320, 450],
    "In einer überregionalen Zeitung ist ein Artikel mit dem Titel „Immer erreichbar: Wer abends Mails liest, ist selbst schuld“ erschienen. Darin finden sich unter anderem diese drei Aussagen:\n\n" +
      "1. „Niemand wird gezwungen, nach Feierabend das Diensthandy einzuschalten.“\n" +
      "2. „Feste Sperrzeiten für dienstliche E-Mails sind eine bevormundende Lösung für ein individuelles Problem.“\n" +
      "3. „Wer flexibel arbeiten will, muss auch flexibel erreichbar sein.“\n\n" +
      "Schreiben Sie einen Leserbrief an die Zeitung (etwa 350 Wörter). Nehmen Sie zu allen drei Aussagen Stellung und entwickeln Sie dabei eine eigene, begründete Position.",
    [
      "bezieht sich erkennbar auf alle drei Aussagen",
      "entwickelt eine eigene Position mit stichhaltigen Argumenten und Beispielen",
      "setzt sich mit mindestens einem Gegenargument auseinander (Einräumung, Widerlegung)",
      "textsortengerechter Leserbrief (Bezug auf den Artikel, Schluss mit Fazit), stilistisch souverän",
    ],
    [
      "sich auf den Artikel beziehen",
      "zu allen drei Aussagen Stellung nehmen",
      "eine eigene, begründete Position entwickeln",
      "auf Gegenargumente eingehen",
      "mit einem Fazit schließen",
    ],
    "formell/sachlich (Leserbrief)",
    "Leserbrief mit drei Bezugsaussagen wie Goethe C2 Schreiben Teil 2. Für die Stufe C2 zählt neben dem Inhalt die souveräne Verknüpfung (Konzessivsätze, Nominal- und Verbalstil gezielt eingesetzt)."),
  writingTask("essay", "HARD", [320, 450],
    "Schreiben Sie eine Erörterung (etwa 350 Wörter) zu folgender Frage:\n\n" +
      "„Wird in der Arbeitswelt der Zukunft tiefes Spezialwissen oder breites Überblickswissen wertvoller sein?“\n\n" +
      "Wägen Sie beide Positionen ab, stützen Sie Ihre Argumente mit Beispielen und kommen Sie zu einem begründeten Urteil.",
    [
      "stellt beide Positionen fair und mit je mindestens zwei Argumenten dar",
      "stützt die Argumente mit konkreten Beispielen",
      "kommt zu einem eigenen, nachvollziehbar begründeten Urteil (auch ein differenziertes Sowohl-als-auch)",
      "klarer argumentativer Aufbau mit präzisen Überleitungen und breitem, idiomatischem Wortschatz",
    ],
    [
      "beide Positionen darstellen",
      "Argumente mit Beispielen stützen",
      "zu einem begründeten eigenen Urteil kommen",
    ],
    NEUTRAL,
    "Dialektische Erörterung auf C2-Niveau: Gewertet wird vor allem die Qualität der Abwägung, nicht die gewählte Position."),
];

// ------------------------------------------------------------------ speaking

function speakingTask(
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

const speakingItems: SeedItem[] = [
  speakingTask("mediation", "EASY", { thinkSeconds: 60, answerSeconds: 150, maxTakes: 1 },
    "Eine neue Kollegin ohne Fachkenntnisse in Ihrem Bereich soll morgen an einer Besprechung teilnehmen. Wählen Sie einen komplexen Ablauf oder Fachbegriff aus Ihrem Beruf, Ihrem Studium oder einem Fachgebiet, in dem Sie sich gut auskennen, und erklären Sie ihn der Kollegin in etwa zwei Minuten so, dass sie ihn versteht. Vermeiden Sie Fachjargon oder erklären Sie ihn.",
    [
      "wählt einen tatsächlich komplexen Sachverhalt und erklärt ihn sachlich richtig",
      "passt Wortwahl und Erklärtiefe an eine fachfremde Zuhörerin an (Beispiele, Vergleiche, Umschreibungen)",
      "klare Struktur (Überblick, Schritte, Zusammenfassung)",
      "flüssig, natürlich und kollegial im Ton",
    ],
    [
      "einen komplexen Ablauf oder Fachbegriff wählen",
      "ihn einer Kollegin ohne Fachkenntnisse verständlich erklären",
      "Fachjargon vermeiden oder erklären",
    ],
    "Sprachmittlung innerhalb des Deutschen: C2 zeigt sich in der Fähigkeit, Komplexes ohne Bedeutungsverlust zu vereinfachen.",
    "kollegial (du oder Sie)"),
  speakingTask("discussion", "EASY", { thinkSeconds: 30, answerSeconds: 120, maxTakes: 1 },
    "Sie haben in einer Präsentation dafür plädiert, dass Teams ihre Arbeitszeiten selbst festlegen. Ein Zuhörer wendet ein: „Das klingt schön, aber am Ende arbeitet jeder, wann er will, und niemand ist mehr erreichbar, wenn es brennt.“\n\nReagieren Sie auf diesen Einwand.",
    [
      "nimmt den Einwand ernst und gibt ihn treffend wieder",
      "räumt berechtigte Punkte ein, ohne die eigene Position aufzugeben",
      "entkräftet den Einwand mit einem Argument oder einem konkreten Lösungsvorschlag",
      "spontan, flüssig und höflich, mit idiomatischen Redemitteln der Diskussion",
    ],
    [
      "auf den Einwand eingehen",
      "Ihre Position mit einem Argument oder einer Lösung verteidigen",
    ],
    "Entspricht der Nachfrage nach dem Vortrag in Goethe C2 Sprechen Teil 1: kurze Bedenkzeit, spontane, aber differenzierte Reaktion.",
    FORMAL),
  speakingTask("presentation", "MID", { thinkSeconds: 240, answerSeconds: 360, maxTakes: 1 },
    "Halten Sie einen Vortrag von etwa fünf Minuten zum Thema „Soziale Medien und Aufmerksamkeit“. Gehen Sie von den folgenden drei Aussagen aus, setzen Sie sie zueinander in Beziehung und entwickeln Sie Ihre eigene Position.\n\n" +
      "1. „Wer ständig online ist, verlernt, sich zu langweilen, und verliert damit einen Teil seiner Kreativität.“\n" +
      "2. „Soziale Netzwerke haben Freundschaften nicht ersetzt, sondern nur sichtbarer gemacht.“\n" +
      "3. „Nicht das Medium bestimmt, wie wir damit umgehen, sondern die Regeln, die wir uns selbst setzen.“",
    [
      "gibt die drei Aussagen sinngemäß wieder und deutet sie",
      "setzt die Aussagen zueinander in Beziehung (Gemeinsamkeiten, Widersprüche)",
      "entwickelt eine eigene, begründete Position mit Beispielen",
      "klarer Aufbau mit Einleitung, Überleitungen und Schluss; flüssig, präzise, stilistisch variabel",
    ],
    [
      "die drei Aussagen wiedergeben und deuten",
      "die Aussagen zueinander in Beziehung setzen",
      "Ihre eigene Position mit Beispielen",
      "Einleitung und Schluss",
    ],
    "Monolog nach Goethe C2 Sprechen Teil 1 (Positionen mit Zitaten abwägen). Die Aussagen sind eigens für diese Aufgabe formuliert.",
    FORMAL),
  speakingTask("discussion", "MID", { thinkSeconds: 60, answerSeconds: 180, maxTakes: 1 },
    "Ihre Gesprächspartnerin in einer Diskussionsrunde vertritt folgende These: „Fachwissen kann man nachträglich lernen, Haltung nicht. Unternehmen sollten deshalb vor allem nach Persönlichkeit einstellen.“\n\n" +
      "Nehmen Sie Stellung. Gehen Sie auf die These ein, wägen Sie Vor- und Nachteile ab und machen Sie deutlich, wo Sie zustimmen und wo nicht.",
    [
      "nimmt erkennbar Bezug auf die These und ihre Begründung",
      "wägt Vor- und Nachteile ab und unterscheidet Zustimmung von Widerspruch",
      "stützt die Position mit Beispielen oder Erfahrungen",
      "souveräne Gesprächsstrategien (Einräumen, Relativieren, Zuspitzen) und sicheres Register",
    ],
    [
      "auf die These eingehen",
      "Vor- und Nachteile abwägen",
      "wo Sie zustimmen und wo nicht",
      "Beispiele oder Erfahrungen",
    ],
    "Interaktiver Teil nach Goethe C2 Sprechen Teil 2. Bewertet wird die Differenziertheit der Stellungnahme, nicht die Position.",
    FORMAL),
  speakingTask("presentation", "HARD", { thinkSeconds: 300, answerSeconds: 360, maxTakes: 1 },
    "Halten Sie einen Vortrag von etwa fünf Minuten zum Thema „Was ist gute Arbeit?“. Gehen Sie von den folgenden drei Aussagen aus, wägen Sie sie gegeneinander ab und kommen Sie zu einem eigenen Urteil.\n\n" +
      "1. „Gute Arbeit erkennt man daran, dass man sie messen kann.“\n" +
      "2. „Gute Arbeit ist die, die man auch dann sorgfältig erledigt, wenn niemand hinsieht.“\n" +
      "3. „Ob Arbeit gut ist, entscheidet nicht, wer sie tut, sondern wer auf sie angewiesen ist.“",
    [
      "erfasst die unterschiedlichen Perspektiven der drei Aussagen (Messbarkeit, Ethos, Nutzen für andere)",
      "wägt die Aussagen kritisch ab und zeigt Grenzen jeder Position auf",
      "kommt zu einem eigenen, differenziert begründeten Urteil mit Beispielen",
      "rhetorisch souverän: klare Gliederung, präzise Begriffe, idiomatische und stilistisch variable Sprache",
    ],
    [
      "die drei Aussagen gegeneinander abwägen",
      "zu einem eigenen Urteil kommen",
    ],
    "Anspruchsvollere Variante des C2-Monologs: abstraktes Thema, Aussagen mit unterschiedlichen Wertmaßstäben. Die Aussagen sind eigens formuliert und keinem Autor zugeordnet.",
    FORMAL),
  // Role conflict: defend a rule against a complaint (Goethe C2 Sprechen, rule to uphold plus a concession).
  speakingTask("role_conflict", "MID", { thinkSeconds: 60, answerSeconds: 150, maxTakes: 1 },
    "Sie leiten eine Stadtbibliothek. Seit Kurzem gilt in den Lesesälen die Regel, dass nicht gegessen und nur Wasser in verschlossenen Flaschen getrunken werden darf. Ein Stammbesucher, der fast täglich zum Lernen kommt, beschwert sich bei Ihnen: „Das ist unverschämt. Ich bin den ganzen Tag hier und soll nicht einmal einen Kaffee trinken dürfen. Andere Bibliotheken erlauben das längst.“\n\n" +
      "Sie halten die Regel für sinnvoll, weil Bücher durch Flecken beschädigt wurden und der Reinigungsdienst überlastet war. Verteidigen Sie die Regel gegenüber dem Besucher, zeigen Sie Verständnis für seinen Ärger und bieten Sie eine Lösung an.",
    [
      "zeigt Verständnis für den Ärger, ohne die Regel zurückzunehmen",
      "begründet die Regel sachlich mit Schutz der Bücher und Aufwand der Reinigung",
      "geht auf das Argument ein, andere Bibliotheken seien großzügiger",
      "bietet ein konkretes Entgegenkommen an, das die Regel nicht aushöhlt",
      "höflich, bestimmt und gesichtswahrend im Ton; flüssig und variabel im Ausdruck",
    ],
    [
      "Verständnis für den Ärger zeigen",
      "die Regel begründen",
      "auf das Argument der anderen Bibliotheken eingehen",
      "ein Entgegenkommen anbieten",
    ],
    "Rollenkonflikt mit einer Regel, die zu verteidigen ist: C2 zeigt sich darin, nachzugeben, ohne einzuknicken, und die Regel dennoch zu begründen.",
    FORMAL),
  speakingTask("negotiation", "HARD", { thinkSeconds: 60, answerSeconds: 150, maxTakes: 1 },
    "In einer Teambesprechung schlägt Ihre Vorgesetzte vor, ein wichtiges Projekt zwei Monate früher abzuschließen als geplant, um einen Kunden zu beeindrucken. Sie halten das für nicht machbar, ohne die Qualität zu gefährden.\n\n" +
      "Sprechen Sie Ihre Vorgesetzte direkt an: Widersprechen Sie diplomatisch, begründen Sie Ihre Einschätzung und schlagen Sie einen Kompromiss vor.",
    [
      "würdigt das Ziel der Vorgesetzten, bevor widersprochen wird",
      "begründet die Bedenken sachlich und konkret (Ressourcen, Risiken, Qualität)",
      "schlägt einen realistischen Kompromiss vor (z. B. Teillieferung, Prioritäten, zusätzliche Ressourcen)",
      "diplomatischer Ton: Abschwächungen, Konjunktiv II, angemessene Direktheit gegenüber einer Vorgesetzten",
    ],
    [
      "diplomatisch widersprechen",
      "Ihre Einschätzung begründen",
      "einen Kompromiss vorschlagen",
    ],
    "Soziolinguistische Angemessenheit auf C2-Niveau: Widerspruch nach oben, der klar in der Sache, aber gesichtswahrend in der Form ist.",
    FORMAL),
];

// Open cloze texts (OPEN): one typed word per gap, collocations and connectors.
const grammarOpenTexts: SeedItem[] = [
  openCloze(LEVEL, "EASY", {
    title: "Das Ehrenamt unter Druck",
    first: "Vereine, Rettungsdienste und Nachbarschaftsinitiativen leben von Menschen, die ihre Zeit unentgeltlich zur Verfügung stellen.",
    body:
      "Doch immer häufiger fehlt es [[an#praeposition]] Nachwuchs. " +
      "Viele Vereine müssen ihr Angebot einschränken, [[falls/sofern/wenn/sollten#konnektor]] sich nicht bald neue Freiwillige finden. " +
      "Wer heute eine Jugendgruppe leitet, muss Nachweise vorlegen, Fortbildungen besuchen und sich [[gegen#praeposition]] Haftungsrisiken absichern. " +
      "Manch einer fragt sich, [[ob#nebensatz]] der Aufwand überhaupt noch lohnt. " +
      "Wer ein Amt übernimmt, nimmt nicht selten erhebliche Mehrarbeit in [[Kauf#funktionsverbgefuege]]. " +
      "Bei Ehrungen und Neujahrsempfängen wird das Engagement zwar gewürdigt, [[doch/aber/jedoch#konnektor]] mit warmen Worten allein ist niemandem gedient. " +
      "Die Verbände fordern deshalb, den Freiwilligen bürokratische Hürden aus dem Weg [[zu#infinitiv]] räumen. " +
      "Auch Arbeitgeber sind gefragt: Sie könnten Beschäftigte, die ein Amt bekleiden, großzügiger freistellen, und zwar [[ohne#praeposition]] dass ihnen daraus Nachteile erwachsen. " +
      "Entscheidend ist letztlich, dass das Ehrenamt nicht als Selbstverständlichkeit gilt, [[sondern#konnektor]] als eine Leistung: Sie kommt der ganzen Gesellschaft [[zugute#idiomatik]].",
    last: "Wer das erkennt, wird die Engagierten künftig nicht nur loben, sondern entlasten.",
    note: "fehlen an (g1), konditionales falls/sofern (g2), sich absichern gegen (g3), indirekte Frage mit ob (g4), Funktionsverbgefüge in Kauf nehmen (g5), einräumendes zwar ... doch (g6), Infinitiv mit zu nach Verb (g7), ohne dass (g8), nicht ... sondern (g9), zugute kommen (g10).",
  }),
  openCloze(LEVEL, "MID", {
    title: "Wenn der Dorfladen schließt",
    first: "Wo früher morgens die Brötchen über den Tresen gingen, hängt heute ein Schild mit der Aufschrift „Zu vermieten“.",
    body:
      "Die Gründe sind vielfältig. [[Zum#konnektor.zweiteilig]] einen fehlt es an Nachfolgern, [[zum#konnektor.zweiteilig]] anderen lohnt sich der Betrieb kleiner Läden kaum noch. " +
      "Wer sich nicht [[mit#verb_praeposition]] der Rolle des bloßen Versorgers zufriedengeben wollte, versuchte es mit Postschalter, Café und Lieferdienst. " +
      "Das Angebot wuchs, der Umsatz [[hingegen/dagegen/indes/indessen/jedoch/aber/allerdings/wiederum#konnektor]] stagnierte. " +
      "Manche Gemeinden greifen den Betreibern [[unter#idiomatik]] die Arme, indem sie die Räume mietfrei zur Verfügung stellen. " +
      "Andernorts haben sich Bewohner zu Genossenschaften zusammengeschlossen, [[um#infinitiv.umzu]] den Laden in eigener Regie zu führen. " +
      "Solche Modelle funktionieren allerdings nur, [[wenn/sofern/solange/falls#konnektor]] genügend Menschen dort auch tatsächlich einkaufen. " +
      "Viele ältere Dorfbewohner sind [[darauf#praepositionaladverb]] angewiesen, dass der Laden um die Ecke bleibt. " +
      "Hinzu [[kommt#trennbares_verb]], dass er mehr ist als eine Verkaufsstelle: Hier trifft man sich, hier erfährt man, wer im Krankenhaus liegt. " +
      "Wo er fehlt, geht mit [[ihm#dativ]] auch ein Stück Dorfleben verloren.",
    last: "Mancherorts hat man daraus bereits Konsequenzen gezogen.",
    note: "zum einen ... zum anderen (g1, g2), sich zufriedengeben mit (g3), Gegensatz hingegen (g4), jemandem unter die Arme greifen (g5), Finalsatz um ... zu (g6), konditionales wenn/sofern (g7), angewiesen sein auf mit Pronominaladverb (g8), Hinzu kommt (g9), Personalpronomen im Dativ nach mit (g10).",
  }),
  openCloze(LEVEL, "HARD", {
    title: "Warum uns Ruinen faszinieren",
    first: "Kaum ein Reisender lässt eine Burgruine links liegen, und selten sind Besucher so andächtig wie zwischen halb eingestürzten Mauern.",
    body:
      "Streng [[genommen#idiomatik]] bewundern sie weniger das Bauwerk als seinen Verfall. " +
      "Der Reiz liegt [[darin#praepositionaladverb]], dass das Fehlende den Betrachter zum Ergänzen einlädt: Wo ein Dach fehlt, malt man sich eines aus. " +
      "Ein vollständig erhaltenes Schloss lässt dieser Fantasie dagegen kaum [[Raum/Platz/Spielraum/Freiraum#idiomatik]]. " +
      "Hinzu [[kommt#trennbares_verb]], dass Ruinen etwas Unaufdringliches haben: Sie erheben [[keinen#negation.kein]] Anspruch darauf, bewundert zu werden, und gerade deshalb tut man es. " +
      "Die Denkmalpflege steht daher [[vor#praeposition]] einem Dilemma. " +
      "[[Je#konnektor]] gründlicher saniert wird, [[desto/umso#konnektor]] stärker geht die Patina verloren, die Besucher so schätzen. " +
      "Wird dagegen nichts unternommen, droht binnen weniger Jahrzehnte der endgültige Einsturz. " +
      "Manche Fachleute plädieren deshalb für einen Mittelweg: [[So#konnektor.modal]] viel wie nötig sichern, so wenig wie möglich ergänzen. " +
      "Ob die Besucher in hundert Jahren noch dasselbe empfinden, steht [[dahin#idiomatik]]. " +
      "Sicher ist nur, dass die Ruine Besucher nicht [[trotz/ungeachtet#genitiv.praeposition]] ihres Verfalls anzieht, sondern seinetwegen.",
    last: "Ein Gebäude, das nichts mehr verbergen kann, wirkt auf viele ehrlicher als jedes restaurierte Schloss.",
    note: "streng genommen (g1), Pronominaladverb darin (g2), Raum/Spielraum lassen (g3), Hinzu kommt (g4), Anspruch erheben + Negation (g5), vor einem Dilemma stehen (g6), je ... desto (g7, g8), so viel ... so wenig (g9), dahinstehen (g10), trotz + Genitiv (g11).",
  }),
];

// ------------------------------------------------- reading: insertion 5/7 and opinion matching

const R_STREUOBST = "v3-r-c2-streuobstwiesen";
const R_HOERBUCH = "v3-r-c2-hoerbuch-lesen";
const R_STADTBAUM = "v3-r-c2-stadtbaeume-hitze";
const R_WIEDERAUFBAU = "v3-r-c2-meinungen-wiederaufbau";
const R_ANGLIZISMEN = "v3-r-c2-meinungen-anglizismen";
const R_TEMPO30 = "v3-r-c2-meinungen-tempo30";

const readingStimuliV3: SeedStimulus[] = [
  {
    key: R_STREUOBST,
    section: "READING",
    level: LEVEL,
    title: "Die Rückkehr der Streuobstwiese",
    topic: "Natur, Landschaft",
    body: `Wer im Spätsommer über die Hügel der Region fährt, sieht sie noch immer: hochstämmige Apfel-, Birnen- und Zwetschgenbäume, die verstreut auf extensiv gemähten Wiesen stehen. Streuobstwiesen prägten über Jahrhunderte das Landschaftsbild, bis sie in der zweiten Hälfte des zwanzigsten Jahrhunderts massenhaft gerodet wurden. Heute gelten sie als einer der artenreichsten Lebensräume Mitteleuropas, und vielerorts bemüht man sich, sie zu erhalten.

[Lücke 1]

Dass ausgerechnet das Unrentable heute als schützenswert gilt, hat mit der Vielfalt zu tun, die in solchen Beständen steckt. Auf einer einzigen Wiese können Dutzende Obstsorten wachsen, und in den Baumhöhlen nisten Steinkauz, Wendehals und Gartenrotschwanz. Biologen schätzen, dass mehrere tausend Tier- und Pflanzenarten auf diesen Lebensraum angewiesen sind.

[Lücke 2]

Einen Ausweg haben mehrere Landkreise in der Vermarktung gefunden. Der Saft von Streuobst wird unter einer eigenen Herkunftsbezeichnung verkauft, und die Keltereien zahlen den Bewirtschaftern einen Aufpreis, der über dem üblichen Marktpreis liegt. Ein Teil der Verbraucher ist bereit, dafür mehr auszugeben.

[Lücke 3]

Hier setzen Patenschaftsmodelle an. Städter können einen Baum „adoptieren“, erhalten dafür im Herbst einen Teil der Ernte und werden zu Schnittkursen eingeladen. Wer einmal selbst an einem Baum geschnitten hat, so die Erfahrung der Organisatoren, bleibt der Wiese meist über Jahre verbunden.

[Lücke 4]

Die Betreiber der Patenschaftsprogramme räumen das ein. Sie betonen jedoch, dass es ihnen weniger um die einzelne Ernte gehe als darum, Wissen weiterzugeben, das sonst verloren ginge. Auch der fachgerechte Obstbaumschnitt werde inzwischen wieder gelehrt, weil die Nachfrage steige.

[Lücke 5]

Ein hochstämmiger Apfelbaum trägt erst nach etwa zehn Jahren zuverlässig Früchte, und es dauert Jahrzehnte, bis aus einer Pflanzung ein Lebensraum wird. Wer heute pflanzt, tut es deshalb vor allem für diejenigen, die in dreißig Jahren darunter sitzen.`,
  },
  {
    key: R_HOERBUCH,
    section: "READING",
    level: LEVEL,
    title: "Hören statt Lesen? Das Hörbuch wird erwachsen",
    topic: "Literatur, Lesekultur",
    body: `Vor zwanzig Jahren galt das Hörbuch noch als Notbehelf für Autofahrer und Sehbehinderte. Inzwischen hört nach Umfragen jeder dritte Erwachsene in Deutschland zumindest gelegentlich Bücher, und die Abonnementdienste verzeichnen Zuwächse, von denen der gedruckte Buchmarkt nur träumen kann. Die Frage, ob damit das Lesen aussterbe, wird seit Jahren gestellt und fällt meist zu einfach aus.

[Lücke 1]

Das hängt mit den Situationen zusammen, in denen gehört wird. Beim Bügeln, auf dem Weg zur Bahn oder beim Joggen ist Lesen schlicht unmöglich; Hörbücher erschließen also Zeit, die dem gedruckten Buch ohnehin nie zur Verfügung stand.

[Lücke 2]

Erklären lässt sich das mit dem Tempo. Wer liest, bestimmt es selbst, kann zurückspringen und an einer schwierigen Stelle verweilen. Wer hört, folgt dem Rhythmus der Sprecherin, und ein unaufmerksamer Moment bedeutet, dass ein Gedanke verloren geht. Viele Hörer spulen deshalb häufiger zurück, als sie zugeben würden.

[Lücke 3]

Das kann ein Gewinn sein, etwa bei Lyrik oder Dramen, die ursprünglich für den Vortrag geschrieben wurden. Es kann aber auch bevormunden: Wer einen Roman liest, hört im Kopf seine eigene Figur, wer ihn hört, die der Sprecherin. Manche Autoren lehnen Hörfassungen ihrer Bücher deshalb ab.

[Lücke 4]

Manche haben darauf reagiert, indem sie Hörbuch und gedrucktes Buch im Paket anbieten oder auf eigene Plattformen ausweichen. Buchhandlungen wiederum verkaufen Gutscheine für Hörbuch-Abos und treten damit in ein Geschäft ein, das sie lange den Konzernen überlassen hatten.

[Lücke 5]

Die Ausleihzahlen widersprechen damit der Furcht vor einem Entweder-oder: Dieselben Menschen, die Streams abrufen, leihen weiterhin gedruckte Bücher aus. Das Hörbuch erweist sich so weniger als Konkurrent denn als zusätzlicher Zugang zur Literatur.`,
  },
  {
    key: R_STADTBAUM,
    section: "READING",
    level: LEVEL,
    title: "Bäume gegen die Hitze der Stadt",
    topic: "Stadtklima, Umwelt",
    body: `An Sommertagen mit über dreißig Grad kann der Temperaturunterschied zwischen einem dicht bebauten Stadtviertel und dem Umland bis zu zehn Grad betragen. Asphalt und Beton speichern die Wärme und geben sie nachts nur langsam wieder ab, sodass es sich auch zu später Stunde kaum abkühlt. Für alte und kranke Menschen kann das gefährlich werden, und viele Städte suchen deshalb nach Wegen, ihre Straßen zu kühlen.

[Lücke 1]

So einfach, wie es klingt, ist das Pflanzen allerdings nicht. Unter dem Pflaster verlaufen Leitungen, Kanäle und Kabel, und für die Wurzeln bleibt oft nur eine Fläche von der Größe eines Fußabtreters. Bäume, die unter solchen Bedingungen wachsen, werden selten alt.

[Lücke 2]

Das hat seinen Preis. Eine solche Grube kostet ein Mehrfaches dessen, was bisher für einen Straßenbaum veranschlagt wurde, und viele Kommunen scheuen die Investition. Befürworter halten dagegen, dass sich der Aufwand rechne, weil ein gesunder Baum jahrzehntelang kühle und kaum ersetzt werden müsse.

[Lücke 3]

Die Wirkung dieser Maßnahmen ist jedoch begrenzt. Ein Sprühnebel kühlt nur dort, wo er fällt, und eine Fassadenbegrünung braucht im Sommer viel Wasser, das in langen Trockenphasen selbst knapp wird. Klimaforscher sehen darin deshalb eher eine Ergänzung als einen Ersatz für Bäume.

[Lücke 4]

Städte setzen deshalb auf Beteiligung. Anwohner dürfen mitentscheiden, welche Baumart gepflanzt wird, und übernehmen in manchen Vierteln in den ersten Jahren eine Gießpatenschaft für die Jungbäume. Wo das geschieht, so berichten Verwaltungen, werden auffallend weniger Bäume beschädigt.

[Lücke 5]

Wer also heute pflanzt, schützt weniger die Menschen des nächsten Sommers als die der nächsten Generation. Das ist für die Politik ein unbequemes Rechenexempel, denn die Erfolge fallen in eine Zeit, in der die Verantwortlichen längst nicht mehr im Amt sind.`,
  },
  {
    key: R_WIEDERAUFBAU,
    section: "READING",
    level: LEVEL,
    title: "Soll ein zerstörtes Wahrzeichen wiederaufgebaut werden? Stimmen aus der Stadt",
    topic: "Stadtbild, Denkmalpflege",
    body: `Person A (Jonas Weber, Architekt)
Wer ein verlorenes Gebäude nachbaut, sollte das nicht verstecken. Ich habe nichts gegen eine Rekonstruktion, aber sie muss als solche erkennbar sein, etwa durch eine Tafel am Eingang oder eine bewusst andere Materialwahl im Inneren. Alles andere erweckt den Eindruck, die Geschichte habe nie eine Lücke gehabt.

Person B (Ilse Brandt, Rentnerin)
Ich bin in diesem Viertel aufgewachsen, und seit der Turm fehlt, erkenne ich es kaum wieder. Wenn ich ehrlich bin, ist mir egal, ob die Steine alt oder neu sind. Menschen brauchen ein Bild, an dem sie sich orientieren können, und dazu gehört ein Stadtbild, das ihnen vertraut ist.

Person C (Deniz Kaya, Historiker)
Die Zerstörung ist ein Teil dessen, was in dieser Stadt geschehen ist. Wer sie durch eine glatte Kopie überdeckt, tut so, als sei nichts passiert. Ich plädiere dafür, die Lücke auszuhalten und die Geschichte an dieser Stelle zu erzählen, statt sie zu überbauen.

Person D (Maren Stolz, Stadtplanerin)
Der Wiederaufbau würde nach den bisherigen Schätzungen rund achtzig Millionen Euro kosten. Mit diesem Betrag ließe sich eine ganze Wohnsiedlung für Menschen mit kleinem Einkommen errichten. Prestigeprojekte lösen die Probleme der Stadt nicht, sie verschieben sie nur.

Person E (Paul Lenk, Tourismusverband)
Schauen Sie sich andere Städte an, die ihr Wahrzeichen zurückbekommen haben: Die Besucherzahlen haben sich dort binnen weniger Jahre verdoppelt. Davon profitieren Gaststätten, Hotels und Läden, und wer sagt, das sei oberflächlich, übersieht, wie viele Arbeitsplätze daran hängen.

Person F (Sofia Marin, Studentin)
Ein nachgebautes Haus nützt nur dann etwas, wenn dort tatsächlich etwas stattfindet. Ich möchte keine Kulisse, in der nur Souvenirs verkauft werden. Mich würde überzeugen, wenn die Räume für Konzerte, Werkstätten und Treffen der Nachbarschaft offenstünden.`,
  },
  {
    key: R_ANGLIZISMEN,
    section: "READING",
    level: LEVEL,
    title: "Zu viel Englisch im Deutschen? Leserstimmen",
    topic: "Sprache, Anglizismen",
    body: `Person A (Katrin Obermann, Lektorin)
Sprachen haben immer Wörter ausgeliehen, das Deutsche nicht zuletzt aus dem Französischen und Lateinischen. Ich habe nichts gegen Anglizismen, wo sie eine Lücke füllen. Wo es ein deutsches Wort gibt, das genauso gut passt, sehe ich aber keinen Grund, es zu verdrängen. Dann ist es schlicht Bequemlichkeit.

Person B (Dr. Samuel Egger, Sprachwissenschaftler)
Die Aufregung ist aus meiner Sicht unbegründet. Entscheidend für den Zustand einer Sprache sind ihr Satzbau und ihre Formen, und die bleiben vom Einzug englischer Wörter unberührt. Auch „Computer“ wird nach deutschen Regeln dekliniert, und niemand käme auf die Idee, im Plural „computers“ zu sagen.

Person C (Helga Pfeiffer, Rentnerin)
Neulich stand am Bahnhof „Service Point“ über einem Schalter, und ich habe zehn Minuten gebraucht, um zu verstehen, dass man dort Auskünfte bekommt. Ich fühle mich von dieser Sprache ausgeschlossen, besonders dann, wenn es um Dinge geht, die alle betreffen.

Person D (Tobias Wern, IT-Berater)
In meinem Fach ist Englisch Arbeitssprache, und das hat seinen Grund: Die Begriffe sind präzise und weltweit verständlich. Wer „Cloud“ oder „Backup“ übersetzt, erhält Wortungetüme, die niemand benutzt und die ungenauer sind als das Original. Die Praxis entscheidet, nicht die Grammatik.

Person E (Leyla Sandmann, Lehrerin)
Jugendliche mischen die Sprachen, weil sie damit zeigen, wer sie sind und wo sie dazugehören. Das war schon bei früheren Generationen so, nur waren die Quellen andere. Ich finde, Erwachsene sollten sich beim Kommentieren zurückhalten, denn Sprache lässt sich nicht von oben lenken.

Person F (Reinhard Falk, Journalist)
Privat soll jeder reden, wie er will. Anders ist es bei Ämtern, Verkehrsbetrieben und Redaktionen, die sich an alle wenden. Dort sollte es Leitlinien geben, und die Medien sollten mit gutem Beispiel vorangehen, statt jeden Trend mitzumachen.`,
  },
  {
    key: R_TEMPO30,
    section: "READING",
    level: LEVEL,
    title: "Tempo 30 in der ganzen Stadt? Stimmen zur Debatte",
    topic: "Verkehr, Stadtleben",
    body: `Person A (Gerda Neumann, Anwohnerin)
Ich wohne seit dreißig Jahren an einer Hauptstraße. Nachts wache ich vom Dröhnen der Lastwagen auf, und bei geöffnetem Fenster kann ich mich im Wohnzimmer kaum unterhalten. Wenn Tempo 30 den Lärm auch nur halbiert, wäre das für mich der entscheidende Gewinn.

Person B (Fabian Roth, Taxifahrer)
Ich bin nicht gegen Sicherheit, aber ich fahre zehn Stunden am Tag und merke, wie sich die Wege ziehen. Gerade Fahrgäste, die einen Zug oder Flug erreichen müssen, haben wenig Verständnis, wenn die Fahrt länger dauert und mehr kostet. Wer so entscheidet, sollte auch Rücksicht auf diejenigen nehmen, die auf ihre Zeit angewiesen sind.

Person C (Prof. Ines Albrecht, Verkehrsforscherin)
Der Bremsweg wächst mit dem Quadrat der Geschwindigkeit. Das ist keine Meinung, sondern Physik. Die Auswertungen aus Städten, die Tempo 30 eingeführt haben, zeigen, dass die Zahl der Unfälle nur leicht zurückgeht, die der Schwerverletzten und Toten aber deutlich.

Person D (Stefan Mehl, Fahrradhändler)
Mich als Radfahrer interessiert nicht, ob neben mir mit dreißig oder fünfzig vorbeigefahren wird. Ich möchte nicht neben Autos fahren müssen. Was uns wirklich helfen würde, wären geschützte Radwege, die durchgehend befahrbar sind, statt Schildern am Straßenrand.

Person E (Amara Diallo, Busfahrerin)
Ein Bus, der im Schritttempo hinter Autos herfährt, hält keinen Fahrplan ein. Dann verpassen die Leute ihre Anschlüsse und steigen wieder ins Auto. Wenn Tempo 30 kommt, brauchen wir Busspuren, sonst schadet es dem Nahverkehr mehr, als es nützt.

Person F (Walter Henning, Bürgermeister)
Ich würde zunächst einzelne Straßen auswählen, in denen die Belastung am größten ist, und dort ein Jahr lang Erfahrungen sammeln. Danach kann man mit Zahlen entscheiden, statt mit Überzeugungen. Eine Stadt ist kein Labor, aber sie darf lernen.`,
  },
];

const INSERT_PROMPT = "In den Text wurden fünf Absätze entfernt. Ordnen Sie jeder Lücke den passenden Absatz zu. Zwei Absätze passen nicht.";
const GAPS_1_5 = ["Lücke 1", "Lücke 2", "Lücke 3", "Lücke 4", "Lücke 5"];
const OPINION_PROMPT = "Welche Person vertritt welche Meinung? Eine Person bleibt übrig.";
const PERSONS_A_F = ["Person A", "Person B", "Person C", "Person D", "Person E", "Person F"];

const readingItemsV3: SeedItem[] = [
  // Insertion 5/7: Streuobstwiese. Right order: r1 D1, r2 L3, r3 L1, r4 L5, r5 D2, r6 L2, r7 L4.
  forText(R_STREUOBST).match("structure", "MID", INSERT_PROMPT, GAPS_1_5,
    [
      "Auch der Klimawandel setzt den Wiesen zu. Trockene Sommer schwächen die alten Bäume, und Schädlinge, die früher im Winter erfroren, überleben nun häufiger und befallen vor allem die alten Hochstämme.",
      "Auf Dauer trägt dieses Modell jedoch nur, wenn sich genügend Menschen finden, die die Arbeit leisten. Die Besitzer der Flächen sind oft hochbetagt, ihre Kinder wohnen in der Stadt und haben mit dem Obstbau nichts im Sinn.",
      "Der Niedergang hatte wirtschaftliche Gründe. Niederstämmige Plantagen ließen sich maschinell bewirtschaften und lieferten verlässlichere Erträge, während der Pflege der hohen Bäume ein Aufwand gegenüberstand, den kaum jemand bezahlen wollte. Zeitweise gab es sogar Prämien für das Roden.",
      "Ein Problem bleibt freilich der Maßstab: Politik und Verbände denken in Förderperioden von fünf oder sieben Jahren, die Bäume in Jahrzehnten. Dieser Unterschied im Zeithorizont wird in den meisten Konzepten bislang unterschätzt.",
      "In Süddeutschland ist die Lage besonders günstig, da dort traditionell mehr Obst angebaut wurde als im Norden. Die Region gehört daher zu den Gebieten mit den größten zusammenhängenden Beständen.",
      "Doch Artenvielfalt allein erhält keine Wiese. Die Bäume müssen geschnitten, die Flächen gemäht und überalterte Bestände durch Jungbäume ergänzt werden, und das alles bei Erträgen, die auf dem freien Markt kaum konkurrenzfähig sind.",
      "Nicht jeder sieht darin eine Lösung. Kritiker wenden ein, dass Patenschaften zwar Aufmerksamkeit erzeugen, die laufende Pflege aber nicht ersetzen: Ein Baum, der nur einmal im Jahr besucht wird, wachse sich nicht von selbst zu einem gesunden Bestand aus.",
    ],
    [3, 6, 2, 7, 4],
    "Lücke 1: Gründe für die Rodung; \"das Unrentable\" im folgenden Absatz greift den kaum bezahlbaren Aufwand auf. Lücke 2: \"Doch\" schließt an die Artenvielfalt an, \"Einen Ausweg\" im nächsten Absatz setzt ein wirtschaftliches Problem voraus. Lücke 3: \"dieses Modell\" ist die Vermarktung mit Aufpreis, \"Hier setzen Patenschaftsmodelle an\" antwortet auf den fehlenden Nachwuchs. Lücke 4: Kritik an den Patenschaften, im folgenden Absatz \"räumen das ein\". Lücke 5: Zeithorizonte, vorbereitend für den Baum, der erst nach zehn Jahren trägt. Nicht passend: der Klimawandel (kein Bezug zu den Nachbarabsätzen) und die regionale Verteilung (ohne Verbindung)."),

  // Insertion 5/7: Hörbuch. Right order: r1 D1, r2 L4, r3 L2, r4 D2, r5 L5, r6 L1, r7 L3.
  forText(R_HOERBUCH).match("structure", "HARD", INSERT_PROMPT, GAPS_1_5,
    [
      "Der Begriff „Hörbuch“ selbst stammt aus den Fünfzigerjahren, als erste Schallplattenlabels vollständige Lesungen herausbrachten. Die Kassette machte das Format ab den Siebzigern massentauglich.",
      "Auch wirtschaftlich ist das Verhältnis der beiden Formen nicht spannungsfrei. Die großen Plattformen bezahlen die Verlage pro gehörter Stunde, und kleine Verlage klagen, dass die Beträge kaum die Produktionskosten decken, wenn ein Titel nur selten abgerufen wird.",
      "Weniger eindeutig ist die Frage, ob man beim Hören dasselbe aufnimmt wie beim Lesen. Studien kommen hier zu widersprüchlichen Ergebnissen: Bei einfachen Erzählungen schneiden beide Formen ähnlich ab, bei dichten Sachtexten haben Lesende meist die Nase vorn.",
      "Verlage rechnen deshalb damit, dass sich der Markt in den kommenden Jahren auf Hörbücher verlagern und der Druck gedruckter Bücher deutlich zurückgehen wird.",
      "Gerade die öffentlichen Büchereien beobachten diese Entwicklung genau. Sie verleihen Hörbücher inzwischen digital, bieten Hörclubs an und führen genau Buch darüber, wer was ausleiht.",
      "Die Zahlen sprechen zunächst für eine Ergänzung, nicht für eine Verdrängung. Wer viel hört, liest in der Regel auch viel: Die Gruppen überschneiden sich stärker, als man vermuten würde, und viele Befragte geben an, ein Hörbuch gerade deshalb zu wählen, weil sie sonst nicht zum Buch kämen.",
      "Hinzu kommt eine Eigenheit des Mediums, die beim Lesen keine Rolle spielt: Die Stimme deutet. Eine gute Sprecherin legt Ironie, Zögern oder Spannung in den Vortrag, die im Text nur angelegt sind, und nimmt dem Zuhörer damit einen Teil der Interpretationsarbeit ab.",
    ],
    [6, 3, 7, 2, 5],
    "Lücke 1: \"Das hängt mit den Situationen zusammen\" bezieht sich auf die Begründung, ein Hörbuch zu wählen, weil man sonst nicht zum Buch käme. Lücke 2: \"Erklären lässt sich das mit dem Tempo\" erklärt die unterschiedliche Aufnahme beim Hören und Lesen. Lücke 3: \"Das kann ein Gewinn sein\" bezieht sich auf die deutende Stimme. Lücke 4: \"darauf reagiert\" bezieht sich auf die geringen Vergütungen kleiner Verlage. Lücke 5: Büchereien als Beispiel; \"Die Ausleihzahlen\" folgen im Schlussabsatz. Nicht passend: der Begriff Hörbuch (Geschichte, ohne Bezug) und die Prognose zum Druck (widerspricht dem Tenor des Textes)."),

  // Insertion 5/7: Stadtbäume. Right order: r1 L4, r2 D1, r3 L2, r4 L5, r5 L1, r6 D2, r7 L3.
  forText(R_STADTBAUM).match("structure", "HARD", INSERT_PROMPT, GAPS_1_5,
    [
      "Ein weiteres Hindernis liegt in der Wahrnehmung der Anwohner. Wer vor dem Haus einen Baum bekommt, verliert womöglich einen Parkplatz, und Laub, Blütenstaub und klebrige Blattläuse sind keine Kleinigkeit für den, der darunter sein Auto abstellt.",
      "Auch in anderen Ländern wird mit begrünten Dächern experimentiert. In Kopenhagen etwa sind sie bei Neubauten seit Jahren vorgeschrieben, und in Singapur wachsen ganze Gärten an den Wolkenkratzern.",
      "Stadtplaner verfolgen daher inzwischen den Ansatz, den Wurzelraum bereits bei der Planung mitzudenken. Dazu gehören Baumgruben, die mehrere Kubikmeter groß sind, durchlässige Beläge und Rinnen, die Regenwasser gezielt zu den Wurzeln leiten.",
      "Wie viel das alles bringt, lässt sich erst in Jahren beurteilen. Ein junger Baum kühlt kaum; seine volle Wirkung entfaltet er erst, wenn sich die Krone nach zwanzig oder dreißig Jahren geschlossen hat, und bis dahin muss er sich gegen Trockenheit, Streusalz und Bauarbeiten behaupten.",
      "Der naheliegendste Weg ist der Baum. Eine große Linde verdunstet an einem heißen Tag mehrere hundert Liter Wasser und kühlt damit ihre Umgebung spürbar; zugleich wirft sie Schatten, der die Oberfläche der Straße um mehr als zwanzig Grad kühler hält, als die Sonne es täte.",
      "Die Hitzetage haben in den vergangenen Jahrzehnten deutlich zugenommen. Während in den Fünfzigerjahren im Schnitt drei Tage pro Jahr über dreißig Grad lagen, sind es heute mehr als zwanzig.",
      "Wo Bäume nicht möglich sind, behelfen sich manche Städte mit Alternativen. Begrünte Fassaden, helle Dachanstriche und Sprühnebel an Plätzen senken die gefühlte Temperatur, ohne dass dafür Wurzeln Platz brauchen.",
    ],
    [5, 3, 7, 1, 4],
    "Lücke 1: \"Der naheliegendste Weg\" beantwortet die Suche nach Wegen aus der Einleitung, im nächsten Absatz \"So einfach, wie es klingt\". Lücke 2: \"Stadtplaner ... daher\" reagiert auf die engen Wurzelbereiche, \"Das hat seinen Preis\" bezieht sich auf die großen Baumgruben. Lücke 3: Alternativen zum Baum, im nächsten Absatz \"Die Wirkung dieser Maßnahmen\". Lücke 4: \"Ein weiteres Hindernis\" mit Anwohnern, \"deshalb auf Beteiligung\". Lücke 5: Zeithorizont des Baumwachstums, im nächsten Absatz \"Wer also heute pflanzt\". Nicht passend: begrünte Dächer im Ausland (nur ein Teil der Alternativen, ohne Bezug zum Absatz danach) und die Zunahme der Hitzetage (wiederholt die Einleitung)."),

  // Opinion matching: Wiederaufbau (unused: F).
  forText(R_WIEDERAUFBAU).match("attitude", "MID", OPINION_PROMPT,
    [
      "Nachgebaute Gebäude sollten für alle als Nachbau kenntlich gemacht werden.",
      "Die Mittel wären im sozialen Wohnungsbau besser angelegt.",
      "Die Zerstörung gehört zur Geschichte der Stadt und sollte sichtbar bleiben.",
      "Wirtschaftlich zahlt sich ein wiederaufgebautes Wahrzeichen für die Stadt aus.",
      "Für die Verbundenheit der Bewohner mit ihrer Stadt zählt ein vertrautes Stadtbild mehr als die Echtheit der Bausubstanz.",
    ],
    PERSONS_A_F, [1, 4, 3, 5, 2],
    "A fordert Kennzeichnung (Tafel), D rechnet die Kosten gegen Wohnungsbau, C will die Lücke aushalten, E nennt Besucherzahlen und Arbeitsplätze, B nennt Vertrautheit des Stadtbildes bei gleichgültiger Echtheit. F (Nutzung statt Kulisse) wird von keiner Aussage gemeint."),

  // Opinion matching: Anglizismen (unused: E).
  forText(R_ANGLIZISMEN).match("attitude", "HARD", OPINION_PROMPT,
    [
      "Die Grammatik des Deutschen wird von englischen Wörtern nicht verändert.",
      "Öffentliche Stellen und Medien sollten bei der Wortwahl eine Vorbildfunktion übernehmen.",
      "Englische Wörter sind nur dort gerechtfertigt, wo das Deutsche keine gleichwertige Entsprechung hat.",
      "Englische Aufschriften im öffentlichen Raum erschweren manchen Menschen das Zurechtfinden.",
      "Übersetzte Fachbegriffe sind oft ungenauer und umständlicher als das englische Original.",
    ],
    PERSONS_A_F, [2, 6, 1, 3, 4],
    "B: Satzbau und Formen bleiben unberührt. F: Leitlinien für Ämter und Medien. A: nur dort, wo eine Lücke gefüllt wird. C: ausgeschlossen am Bahnhof. D: Wortungetüme, ungenauer. E (Jugendliche mischen die Sprachen, Erwachsene sollen sich zurückhalten) wird von keiner Aussage gemeint."),

  // Opinion matching: Tempo 30 (unused: B).
  forText(R_TEMPO30).match("attitude", "HARD", OPINION_PROMPT,
    [
      "Die Verminderung des Verkehrslärms ist der wichtigste Grund für die Maßnahme.",
      "Langsamerer Verkehr macht Busse und Bahnen unzuverlässiger.",
      "Entscheidend ist, wie schwer Unfälle ausgehen.",
      "Durchgehende Radwege bringen mehr als eine niedrigere Geschwindigkeit.",
      "Die Maßnahme sollte zuerst in einzelnen Straßen erprobt werden.",
    ],
    PERSONS_A_F, [1, 5, 3, 4, 6],
    "A schildert nächtlichen Lärm. E: Busse halten bei langsamem Verkehr den Fahrplan nicht ein. C: weniger Schwerverletzte und Tote. D: geschützte Radwege statt Schilder. F: einzelne Straßen, ein Jahr Erfahrungen. B (Taxifahrer, längere Fahrten) wird von keiner Aussage gemeint."),
];

// ------------------------------------------------- listening: group discussions (three or four voices, played once)

type Voice = "A" | "B" | "C" | "D";

function discussion(
  key: string,
  title: string,
  topic: string,
  speakers: Array<{ label: string; voice: Voice }>,
  lines: string[],
): SeedStimulus {
  return { key, section: "LISTENING", level: LEVEL, title, topic, speakers, body: lines.join("\n"), maxPlays: 1 };
}

const L_ZUCKER = "v3-l-c2-podium-zuckersteuer";
const L_LANDARZT = "v3-l-c2-landarzt-gemeinde";
const L_MUSIK = "v3-l-c2-musik-maschine";

const listeningStimuliV3: SeedStimulus[] = [
  discussion(L_ZUCKER, "Podiumsgespräch: Eine Abgabe auf Zucker?", "Gesundheit, Ernährung",
    [
      { label: "Moderatorin", voice: "A" },
      { label: "Kessel", voice: "B" },
      { label: "Yilmaz", voice: "C" },
      { label: "Lorenz", voice: "D" },
    ],
    [
      "Moderatorin: Guten Abend und willkommen zum Podiumsgespräch. Heute geht es um die Frage, ob der Staat auf stark gezuckerte Getränke eine Sonderabgabe erheben soll. Herr Doktor Kessel, Sie sind Ernährungsmediziner, Sie fangen an.",
      "Kessel: Ja, also, ich mache es kurz, weil die Daten ziemlich klar sind. In Ländern, die so eine Abgabe eingeführt haben, ist der Verbrauch von Limonaden innerhalb von zwei Jahren um etwa ein Fünftel gesunken, also um zwanzig Prozent, nicht um zwei. Und das wirkt, weil viele Menschen gar nicht wissen, wie viel Zucker in einer Flasche steckt. Bei der Halbliterflasche sind es ungefähr fünfzehn Stück Würfelzucker. Fünfzehn!",
      "Moderatorin: Herr Yilmaz, Sie stellen Getränke her. Teilen Sie die Zahlen?",
      "Yilmaz: Die Zahlen schon, die Schlussfolgerung nicht. Ich habe nichts gegen Aufklärung, aber so eine Steuer trifft, na ja, vor allem die, die ohnehin wenig Geld haben. Und wissen Sie, was wir getan haben, ohne dass jemand es verlangt hätte? Wir haben die Rezepturen in den letzten fünf, nein, in den letzten sechs Jahren um ein Drittel zuckerärmer gemacht. Das geht schneller und freiwillig, wenn man uns lässt.",
      "Lorenz: Freiwillig, das höre ich seit Jahren. Entschuldigung, dass ich dazwischengehe, aber als Mutter von drei Kindern sehe ich im Supermarkt, wie die Kleinen vor dem Regal stehen, genau auf Augenhöhe mit den bunten Flaschen. Da hilft keine Aufklärung. Mir wäre allerdings wichtig, dass die Einnahmen nicht im Haushalt verschwinden, sondern in Obst für die Kantinen fließen, sonst wird die Abgabe zur reinen Geldquelle.",
      "Kessel: Da widerspreche ich nur halb. Eine feste Zweckbindung ist politisch heikel, aber Frau Lorenz hat recht, dass die Akzeptanz steigt, wenn man sieht, wohin das Geld geht.",
      "Yilmaz: Und wenn der Preis steigt, kaufen die Leute eben im Nachbarland ein. Das erleben wir an den Grenzen schon heute.",
      "Moderatorin: Frau Lorenz, trifft die Abgabe nicht doch die Falschen?",
      "Lorenz: Kurzfristig ja, jeder Euro zählt bei einer Familie mit knappem Budget. Aber langfristig sind es genau diese Familien, die später mit Diabetes zu tun haben. Ich zahle lieber heute etwas mehr, als später zu pflegen, so hart sage ich das.",
      "Kessel: Und die Hersteller haben bisher immer dann Zucker reduziert, wenn Druck da war, Herr Yilmaz. Der Druck kam nie von allein.",
      "Yilmaz: Das ist unfair, aber gut, ich merke, wir kommen heute nicht zusammen.",
      "Moderatorin: Dann bedanke ich mich bei Ihnen dreien.",
    ]),
  discussion(L_LANDARZT, "Radiogespräch: Wer behandelt uns auf dem Land?", "Gesundheit, Landleben",
    [
      { label: "Moderatorin", voice: "A" },
      { label: "Hansen", voice: "B" },
      { label: "Schreiber", voice: "D" },
    ],
    [
      "Moderatorin: In vielen Landkreisen findet sich für frei werdende Hausarztpraxen kein Nachfolger. Ich spreche mit Frau Schreiber, Bürgermeisterin einer Gemeinde mit viertausend Einwohnern, und mit Doktor Hansen, der seit fünfunddreißig Jahren als Landarzt arbeitet. Frau Schreiber, wie ernst ist die Lage bei Ihnen?",
      "Schreiber: Sehr ernst. Von ursprünglich vier Praxen sind uns zwei geblieben, und von diesen beiden hört eine in zwei, höchstens drei Jahren auf. Wir haben, ach was, wir haben alles probiert: eine Anzeige geschaltet, Wohnungen angeboten, sogar einen Zuschuss zur Praxiseinrichtung, zwölftausend Euro. Gemeldet hat sich: niemand.",
      "Hansen: Das überrascht mich leider nicht. Wissen Sie, die jungen Kolleginnen und Kollegen scheuen nicht die Arbeit auf dem Land. Sie scheuen die Einzelpraxis. Wer allein in einer Praxis sitzt, hat keinen Urlaub, keine Vertretung, und nachts klingelt das Telefon. Ich habe das jahrzehntelang gemacht und würde es meinen Kindern, na ja, nicht unbedingt empfehlen.",
      "Moderatorin: Was wäre die Alternative?",
      "Hansen: Gemeinschaftspraxen. Drei, vier Ärzte, die sich abwechseln, dazu eine medizinische Fachangestellte mit erweiterten Aufgaben. Das funktioniert, aber es kostet eine Gemeinde Räume und Geduld.",
      "Schreiber: Räume hätten wir, die alte Grundschule steht seit Jahren leer. Meine Sorge ist eine andere: Wenn wir das aufbauen, und dann kommt wieder niemand, hat die Gemeinde viel Geld versenkt, und das müsste ich im Gemeinderat erklären.",
      "Hansen: Das Risiko bleibt, ja. Aber das Warten ist auch eine Entscheidung. Und ein Stück weit helfen Videosprechstunden. Bei Rezepten oder Befunden braucht niemand eine Stunde Fahrt. Für den Hausbesuch bei einer alten Dame ersetzt es allerdings nichts.",
      "Schreiber: Bei uns haben viele Ältere nicht einmal Internet, das muss man ehrlich sagen. Zweiunddreißig Prozent der Haushalte, so die letzte Erhebung, ach nein, zweiundvierzig Prozent. Das ist fast die Hälfte.",
      "Moderatorin: Herr Doktor Hansen, wie lange werden Sie selbst noch arbeiten?",
      "Hansen: Eigentlich wollte ich mit fünfundsechzig aufhören. Jetzt bin ich siebzig. Wenn bis Jahresende niemand kommt, mache ich noch ein Jahr, aber nicht länger.",
    ]),
  discussion(L_MUSIK, "Gesprächsrunde: Musik aus der Maschine", "Kultur, Musik und Technik",
    [
      { label: "Moderatorin", voice: "A" },
      { label: "Reuter", voice: "B" },
      { label: "Pohl", voice: "C" },
      { label: "Alvarez", voice: "D" },
    ],
    [
      "Moderatorin: Ein Computer komponiert ein Stück, das man für Klaviermusik des neunzehnten Jahrhunderts halten könnte. Ist das Kunst? Wir sprechen mit dem Komponisten Matthias Reuter, der Musikproduzentin Carla Alvarez und dem Musikwissenschaftler Doktor Pohl. Herr Reuter, Sie zuerst.",
      "Reuter: Ich versuche, nicht beleidigt zu sein. Nein, im Ernst: Ich benutze solche Programme selbst, um Ideen zu sammeln. Aber ein Stück wird für mich erst Kunst, wenn jemand etwas riskiert hat. Eine Maschine riskiert nichts. Sie rechnet aus, was wahrscheinlich gefällt.",
      "Alvarez: Das klingt schön, aber, Moment, Matthias, bei meiner Arbeit sieht es ganz anders aus. Ich produziere Musik für Werbung und Filme, und für Hintergrundmusik, die niemand bewusst hört, bestelle ich heute nur noch generierte Stücke. Es geht schneller und kostet ein Zehntel. Ob das Kunst ist, ist mir an dieser Stelle völlig gleichgültig.",
      "Pohl: Und genau da liegt das eigentliche Problem, finde ich, und nicht in der Frage nach der Kunst. Wovon sollen Komponistinnen und Komponisten künftig leben, wenn der Markt für Gebrauchsmusik wegbricht? Die Konzertmusik haben wir noch, aber die Berufsanfänger haben sich bisher durch genau diese Aufträge finanziert.",
      "Reuter: Das ist ein Argument, das ich ernst nehme. Ich war mit zwanzig auch froh um jeden Auftrag, auch für eine Zahnpasta-Werbung, ich gebe es zu.",
      "Moderatorin: Frau Alvarez, gäbe es einen Ausweg?",
      "Alvarez: Kennzeichnung. Wenn ein Stück generiert wurde, soll das draufstehen, und die Datenbanken, aus denen die Programme lernen, sollten die Urheber bezahlen. Aktuell lernt die Software an Musik, die irgendjemand geschrieben hat, und bekommt dafür nicht einen Cent. Nicht einen!",
      "Pohl: Da bin ich bei Ihnen. Rechtlich ist das übrigens offen. In dreißig Ländern, ach, in drei Dutzend Ländern, wird gerade darüber gestritten, und die Antworten fallen unterschiedlich aus.",
      "Reuter: Ich würde noch etwas ergänzen: Für das Publikum zählt auch die Geschichte hinter dem Stück. Warum hat jemand das geschrieben, nach dem Tod seiner Mutter, nach einem Streit? Bei einer Maschine gibt es keine Geschichte, und ich glaube, dass uns das auf Dauer fehlen wird.",
      "Pohl: Ob es fehlt oder ob wir uns daran gewöhnen, ist offen. Es gab dieselbe Debatte, als die Fotografie die Malerei bedrohte, und die Malerei hat sich verändert, nicht erledigt.",
      "Moderatorin: Ein gutes Schlusswort. Ich danke Ihnen dreien.",
    ]),
];

const lZ = forClip(L_ZUCKER);
const lA = forClip(L_LANDARZT);
const lM = forClip(L_MUSIK);

const listeningItemsV3: SeedItem[] = [
  lZ.match("attitude", "MID",
    "Wer vertritt die folgende Meinung: Herr Kessel, Herr Yilmaz, Frau Lorenz oder keiner von den dreien?",
    [
      "Die Einnahmen sollten zweckgebunden verwendet werden.",
      "Die Hersteller ändern ihre Rezepte nur unter äußerem Druck.",
      "Freiwillige Maßnahmen der Branche wirken schneller als staatliche Eingriffe.",
      "Die Abgabe sollte auf Süßigkeiten ausgedehnt werden.",
    ],
    ["Herr Kessel", "Herr Yilmaz", "Frau Lorenz", "keiner von den dreien"],
    [3, 1, 2, 4],
    "1 Lorenz: Obst für die Kantinen statt Haushalt. 2 Kessel: \"Der Druck kam nie von allein.\" 3 Yilmaz: \"schneller und freiwillig, wenn man uns lässt\". 4 niemand: Süßigkeiten werden nicht erwähnt."),
  lZ.choice("detail", "MID",
    "Um wie viel ist laut Herrn Kessel der Verbrauch von Limonade nach Einführung der Abgabe gesunken?",
    [
      "um etwa zwei Prozent",
      "um etwa zwanzig Prozent",
      "um etwa ein Drittel",
      "um etwa fünfzehn Prozent",
    ], "b",
    "\"um etwa ein Fünftel gesunken, also um zwanzig Prozent, nicht um zwei\". Ein Drittel nennt Herr Yilmaz für die Zuckerreduktion der Rezepte, fünfzehn sind die Würfelzucker in einer Halbliterflasche."),

  lA.tfng("detail", "MID",
    [
      ["Die Gemeinde hat bereits einen finanziellen Zuschuss für die Praxiseinrichtung in Aussicht gestellt.", "R"],
      ["Doktor Hansen empfiehlt Einzelpraxen, weil sie mehr Freiheit bieten.", "F"],
      ["Die Gemeinde plant, das leerstehende Schulgebäude zu verkaufen.", "NG"],
    ],
    "1 R: zwölftausend Euro Zuschuss. 2 F: Hansen nennt die Einzelpraxis als Grund, warum junge Ärzte abgeschreckt werden, und empfiehlt Gemeinschaftspraxen. 3 NG: Das Gebäude wird als mögliche Räumlichkeit genannt, ein Verkauf kommt nicht vor."),
  lA.short("notes", "HARD",
    "Wie viel Prozent der Haushalte haben laut Frau Schreiber kein Internet? Tragen Sie die Zahl ein.",
    ["42", "42 Prozent", "42%", "zweiundvierzig", "zweiundvierzig Prozent"],
    "Sie nennt erst zweiunddreißig, korrigiert sich dann aber: \"ach nein, zweiundvierzig Prozent\"."),

  lM.match("attitude", "HARD",
    "Wer vertritt die folgende Meinung: Herr Reuter, Frau Alvarez, Herr Pohl oder keiner von den dreien?",
    [
      "Für Hintergrundmusik ist die Frage, ob es Kunst ist, unwichtig.",
      "Der Einsatz solcher Programme sollte grundsätzlich verboten werden.",
      "Ein Stück wird erst durch ein künstlerisches Wagnis zur Kunst.",
      "Die wirtschaftliche Lage junger Komponisten ist das größere Problem.",
    ],
    ["Herr Reuter", "Frau Alvarez", "Herr Pohl", "keiner von den dreien"],
    [2, 4, 1, 3],
    "1 Alvarez: \"völlig gleichgültig\". 2 niemand: Alle benutzen oder akzeptieren die Programme. 3 Reuter: \"Eine Maschine riskiert nichts.\" 4 Pohl: Markt für Gebrauchsmusik bricht weg, Berufsanfänger verlieren Aufträge."),
  lM.choice("inference", "HARD",
    "Warum erwähnt Herr Pohl die Fotografie?",
    [
      "Um zu zeigen, dass neue Technik Kunstformen eher wandelt als beendet.",
      "Um zu belegen, dass Maschinen schon früher Künstler ersetzt haben.",
      "Um zu begründen, dass Urheber auch früher kein Geld bekamen.",
      "Um zu erklären, weshalb sich das Publikum heute wieder für Handwerk interessiert.",
    ], "a",
    "\"die Malerei hat sich verändert, nicht erledigt\": Die Fotografie ist ein Beispiel für eine Technik, die eine Kunstform nicht beendet, sondern verändert hat. Die anderen Optionen werden nicht gesagt."),
];

// ------------------------------------------------- speaking: pictures (describe, interpret, argue a position)

function pictureTask(
  imageId: string,
  within: Within,
  timing: { thinkSeconds: number; answerSeconds: number; maxTakes: number },
  prompt: string,
  contentPoints: string[],
  studentPoints: string[],
  explanation: string,
): SeedItem {
  return {
    section: "SPEAKING",
    level: LEVEL,
    type: "SPEAKING_PROMPT",
    skillTag: "speaking.picture",
    within,
    prompt,
    content: { kind: "SPEAKING", ...timing, images: [img(imageId)] },
    key: { kind: "NONE" },
    rubric: { contentPoints, studentPoints },
    explanation,
  };
}

const speakingPictureItems: SeedItem[] = [
  pictureTask("scene.c2.art-museum", "MID", { thinkSeconds: 60, answerSeconds: 150, maxTakes: 1 },
    "Sehen Sie sich das Bild an. Beschreiben Sie kurz, was zu sehen ist, und deuten Sie die Szene: Was sagt sie über den Umgang mit Kunst aus? Beziehen Sie dann Stellung zu der Frage, ob staatliche Museen kostenlos zugänglich sein sollten. Begründen Sie Ihre Position und gehen Sie auf einen möglichen Einwand ein.",
    [
      "beschreibt knapp und genau, was auf dem Bild zu sehen ist (Besucher betrachten Gemälde in einem Kunstmuseum)",
      "deutet die Szene, z. B. Aufmerksamkeit, Ruhe, Abstand, Bildung, kultureller Anspruch",
      "bezieht Position zum freien Eintritt und stützt sie mit mindestens zwei Argumenten (Zugang für alle, Finanzierung, Wertschätzung)",
      "geht auf einen Gegenstandpunkt ein und wägt ab, statt nur zu behaupten",
      "gegliederter, flüssiger Vortrag mit differenziertem Wortschatz",
    ],
    [
      "das Bild beschreiben",
      "die Szene deuten",
      "begründet zum Eintritt in staatliche Museen Stellung nehmen",
      "auf einen Einwand eingehen",
    ],
    "C2: vom Beschreiben über das Deuten zum Argumentieren. Gewertet wird, ob die Position mit Gründen und Gegenargument entwickelt wird."),
  pictureTask("scene.c2.coworking", "HARD", { thinkSeconds: 60, answerSeconds: 180, maxTakes: 1 },
    "Sehen Sie sich das Bild an. Beschreiben Sie die Situation und erklären Sie, was die Szene über die Veränderung von Arbeitsorten aussagt. Diskutieren Sie anschließend die These, dass Gemeinschaftsbüros die Grenze zwischen Arbeit und Privatleben verwischen. Vertreten Sie eine eigene Position und begründen Sie sie.",
    [
      "beschreibt, was zu sehen ist (mehrere Menschen arbeiten mit Laptops gemeinsam in einem Raum)",
      "deutet die Szene als Ausdruck eines Wandels der Arbeitswelt (Flexibilität, Gemeinschaft, Selbstorganisation)",
      "bewertet die These differenziert (z. B. räumliche Trennung von Wohnung und Arbeit gegenüber dem Homeoffice, aber Kollegen als Freundeskreis, Arbeit an Freizeitorten, ständige Erreichbarkeit)",
      "entwickelt eine eigene begründete Position und belegt sie mit Beispielen",
      "präziser Wortschatz zu Arbeit und Gesellschaft, Satzvariation und Kohärenz",
    ],
    [
      "das Bild beschreiben und deuten",
      "die These zur Grenze zwischen Arbeit und Privatleben erörtern",
      "eine eigene Position begründen",
    ],
    "C2: abstrakte gesellschaftliche These, zu der das Bild nur den Anlass bietet. Wichtig ist die Abwägung mit Belegen."),
  pictureTask("scene.c2.phones-at-dinner", "EASY", { thinkSeconds: 45, answerSeconds: 120, maxTakes: 1 },
    "Sehen Sie sich das Bild an. Beschreiben Sie, was die beiden Frauen tun, und überlegen Sie, was die Szene über die Rolle des Smartphones im Alltag verrät. Sagen Sie dann, ob Handys beim gemeinsamen Essen erlaubt sein sollten, und begründen Sie Ihre Meinung mit Beispielen aus Ihrer Erfahrung.",
    [
      "beschreibt die Szene (zwei Frauen sitzen im Restaurant am Tisch, eine zeigt der anderen lächelnd etwas auf dem Handy)",
      "deutet sie, z. B. Handy als Gesprächsanlass oder als Ablenkung, gemeinsames Erleben, Foto oder Nachricht zeigen",
      "nimmt klar Stellung und begründet mit mindestens einem Beispiel",
      "berücksichtigt unterschiedliche Situationen (Familie, Freunde, Geschäftsessen)",
      "natürlicher, flüssiger Ausdruck mit passenden Wendungen",
    ],
    [
      "das Bild beschreiben",
      "die Szene deuten",
      "begründet zum Handy beim gemeinsamen Essen Stellung nehmen",
    ],
    "Beschreiben und Deuten mit niedrigerer Abstraktion; die Position muss trotzdem begründet und differenziert sein."),
  pictureTask("scene.c2.traffic-and-bike-lane", "MID", { thinkSeconds: 60, answerSeconds: 150, maxTakes: 1 },
    "Sehen Sie sich das Bild an. Beschreiben Sie die Verkehrssituation und deuten Sie, welcher Konflikt in der Szene steckt. Nehmen Sie dann Stellung zu der Frage, ob Städte Autofahrern zugunsten von Radfahrenden Raum wegnehmen sollten. Wägen Sie die Interessen der Beteiligten ab und entscheiden Sie sich.",
    [
      "beschreibt die Szene (ein Radfahrer fährt neben Autos auf einer Straße in der Stadt)",
      "benennt den Konflikt um den begrenzten Straßenraum (Sicherheit, Tempo, Platz, Gleichberechtigung der Verkehrsarten)",
      "wägt die Interessen von Autofahrern, Radfahrenden, Anwohnern und Wirtschaft ab",
      "entscheidet sich für eine begründete Position und nennt konkrete Maßnahmen",
      "klare Struktur, treffende Konnektoren und differenzierter Wortschatz",
    ],
    [
      "das Bild beschreiben",
      "den Konflikt in der Szene deuten",
      "Interessen abwägen und eine Position begründen",
    ],
    "C2: Interessenabwägung in einer kommunalpolitischen Streitfrage; entscheidend sind Struktur und Begründungstiefe."),
  pictureTask("scene.c2.wind-farm", "HARD", { thinkSeconds: 90, answerSeconds: 180, maxTakes: 1 },
    "Sehen Sie sich das Bild an. Beschreiben Sie, was zu sehen ist, und deuten Sie, was die Szene über das Verhältnis von Energiegewinnung und Landschaft aussagt. Wer sollte Ihrer Meinung nach entscheiden, wo Windräder stehen dürfen: der Staat, die Gemeinde oder die Anwohner? Vertreten Sie eine Position und setzen Sie sich mit der Gegenseite auseinander.",
    [
      "beschreibt, was zu sehen ist (Windräder stehen auf einer grünen Wiese)",
      "deutet den Gegensatz oder die Verbindung von Natur, Landschaft und Energiewende",
      "bezieht Position zur Entscheidungsfrage und begründet sie (Verfahren, Beteiligung, Gemeinwohl, Eigeninteressen)",
      "setzt sich mit mindestens einem Gegenargument auseinander und zieht ein Fazit",
      "gehobener Wortschatz, komplexe Satzgefüge, überzeugender Aufbau",
    ],
    [
      "das Bild beschreiben und deuten",
      "begründet Stellung nehmen, wer über Windräder entscheiden soll",
      "sich mit der Gegenseite auseinandersetzen",
    ],
    "C2: Beschreiben, Deuten und Argumentieren zu einer gesellschaftlich umstrittenen Planungsfrage, mit Fazit."),
];

export const C2_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = {
  grammar: { stimuli: [], items: [...grammarItems, ...grammarTexts, ...grammarOpenTexts] },
  reading: { stimuli: [...readingStimuli, ...readingStimuliV3], items: [...readingItems, ...readingItemsV3] },
  listening: { stimuli: [...listeningStimuli, ...listeningStimuliV3], items: [...listeningItems, ...listeningItemsV3] },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: [...speakingItems, ...speakingPictureItems] },
};
