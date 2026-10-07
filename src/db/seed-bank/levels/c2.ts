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
 * C2 starter bank (Goethe-Zertifikat C2: Großes Deutsches Sprachdiplom as the
 * reference, see docs/EXAM-BANK-RESEARCH.md).
 *
 * - Grammar: 24 items (8 EASY, 8 MID, 8 HARD) plus one C-test. Single choice
 *   and gap choices have four options, as at C1 and C2 in Goethe.
 * - Reading: four texts (commentary, essay with sections, report with removed
 *   paragraphs, four job ads), four items each.
 * - Listening: three clips (radio feature, two-person debate, expert
 *   interview), four items each, at most two voices.
 * - Writing: six tasks, including a transformation set and two 350-word texts.
 * - Speaking: six tasks, including two five-minute monologues weighing three
 *   statements.
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
    "Herr Brandt ___ von den Plänen nichts gewusst haben. So jedenfalls stellt er es selbst dar.",
    ["soll", "muss", "will", "dürfte"], "c",
    "Subjektives \"wollen\": Der Satzgegenstand behauptet etwas über sich selbst (\"so stellt er es selbst dar\"). \"soll\" gibt dagegen die Behauptung anderer wieder, \"muss\" und \"dürfte\" eine Vermutung des Sprechers."),
  choice("konnektor", "EASY",
    "Er hat den Bericht nicht einmal gelesen, ___ ihn kommentiert.",
    ["geschweige denn", "zumal", "wohingegen", "vielmehr"], "a",
    "\"geschweige denn\" steigert eine verneinte Aussage (nicht einmal A, also erst recht nicht B) und steht ohne Verbendstellung. \"zumal\" und \"wohingegen\" verlangen einen Nebensatz mit Verbendstellung und passen inhaltlich nicht."),
  gap("praeposition_genitiv", "EASY",
    "{{g1}} aller Bemühungen konnte die Frist nicht eingehalten werden.",
    ["Ungeachtet"],
    "\"ungeachtet\" (+ Genitiv) ist konzessiv wie \"trotz\". \"angesichts\" ist kausal, \"mangels\" bedeutet \"weil etwas fehlt\", \"zufolge\" leitet eine Quelle ein; alle passen inhaltlich nicht.",
    ["Angesichts", "Ungeachtet", "Mangels", "Zufolge"]),
  choice("konditional_inversion", "EASY",
    "___ sich der Termin verschieben, informieren wir Sie umgehend.",
    ["Wenn", "Falls", "Würde", "Sollte"], "d",
    "Uneingeleiteter Konditionalsatz mit \"sollte\" + Infinitiv (Verb an erster Stelle). \"Wenn\"/\"Falls\" bräuchten \"verschiebt\"; \"Würde\" passt nicht zum Indikativ im Hauptsatz."),
  gap("konjunktiv_i", "EASY",
    "Die Pressesprecherin erklärte, das Unternehmen {{g1}} die Vorwürfe bereits intern geprüft. (haben, Konjunktiv I)",
    ["habe"],
    "Indirekte Rede, 3. Person Singular: Konjunktiv I von \"haben\" ist \"habe\" und unterscheidet sich vom Indikativ, daher kein Ersatz durch \"hätte\" nötig."),
  choice("funktionsverbgefuege", "EASY",
    "Der neue Tarifvertrag tritt am ersten Januar in ___.",
    ["Betrieb", "Kraft", "Wirkung", "Gültigkeit"], "b",
    "Feste Verbindung: \"in Kraft treten\". Die anderen Nomen sind bedeutungsnah, bilden aber mit \"treten\" keine feste Wendung."),
  choice("lexik_nuance", "EASY",
    "Die Aufgabe war nur ___ einfach; in Wahrheit steckten zahlreiche Fallstricke darin.",
    ["anscheinend", "offenbar", "scheinbar", "vermutlich"], "c",
    "\"scheinbar\" = es sieht so aus, ist aber nicht so (Kontrast \"in Wahrheit\"). \"anscheinend\", \"offenbar\" und \"vermutlich\" drücken aus, dass etwas wahrscheinlich tatsächlich so ist."),
  gap("irrealer_vergleich", "EASY",
    "Er spricht über das Projekt, als {{g1}} er es ganz allein geleitet.",
    ["hätte"],
    "Irrealer Vergleich mit \"als\" + Verb direkt danach: Konjunktiv II \"hätte\". \"hat\"/\"hatte\" sind Indikativ, \"würde\" verlangt einen Infinitiv.",
    ["hat", "hatte", "hätte", "würde"]),

  // ---------------------------------------------------------------- MID
  choice("konzessiv", "MID",
    "___ man es auch dreht und wendet, die Zahlen bleiben enttäuschend.",
    ["Wie", "So", "Was", "Wo"], "a",
    "Verallgemeinernd-konzessiver Satz \"wie ... auch\" (= egal wie). \"so ... auch\" braucht ein Adjektiv (\"so sehr\"), \"was\" kollidiert mit dem Objekt \"es\"."),
  gap("partizipialattribut", "MID",
    "Formen Sie den Relativsatz in ein Attribut um: „Die Unterlagen, die bis Freitag eingereicht werden müssen, liegen noch nicht vor.“\n→ Die bis Freitag {{g1}} Unterlagen liegen noch nicht vor.",
    ["einzureichenden"],
    "Gerundiv (zu + Partizip I) drückt Notwendigkeit im Passiv aus: \"die einzureichenden Unterlagen\" = die Unterlagen, die eingereicht werden müssen. Bei trennbaren Verben steht \"zu\" zwischen Präfix und Stamm."),
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
      "Der Fehler hatte ohne großen Aufwand zu beheben.",
      "Der Fehler ließ sich ohne großen Aufwand beheben.",
      "Der Fehler wurde ohne großen Aufwand zu beheben.",
      "Der Fehler ließ ohne großen Aufwand beheben.",
    ], "b",
    "Passiversatz \"sich lassen\" + Infinitiv = Passiv mit \"können\". \"haben zu\" bedeutet Notwendigkeit mit aktivem Subjekt; \"wurde zu\" ist ungrammatisch; ohne \"sich\" fehlt das Reflexivpronomen."),
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
    "Die Zentrale arbeitet bereits papierlos, {{g1}} die Filialen ihre Akten noch in Papierform führen.",
    ["wohingegen"],
    "\"wohingegen\" drückt einen Gegensatz zwischen zwei Sachverhalten aus. \"zumal\" ist begründend, \"sofern\" konditional, \"indem\" modal (Art und Weise).",
    ["zumal", "sofern", "indem", "wohingegen"]),
  choice("idiomatik", "MID",
    "Ob das Projekt im nächsten Jahr weiter finanziert wird, steht noch in den ___.",
    ["Wolken", "Sternen", "Karten", "Himmeln"], "b",
    "Redewendung \"in den Sternen stehen\" = völlig ungewiss sein. Die anderen Nomen bilden mit \"stehen\" keine feste Wendung dieser Bedeutung."),

  // ---------------------------------------------------------------- HARD
  choice("paraphrase", "HARD",
    "Welcher Satz gibt die Aussage „So sehr sie sich auch bemühte, sie fand keine Lösung.“ am genauesten wieder?",
    [
      "Weil sie sich so sehr bemühte, fand sie keine Lösung.",
      "Trotz all ihrer Bemühungen fand sie keine Lösung.",
      "Sie bemühte sich sehr, damit sie keine Lösung fand.",
      "Je mehr sie sich bemühte, desto weniger fand sie eine Lösung.",
    ], "b",
    "\"so sehr ... auch\" ist konzessiv, entspricht also \"trotz\". Die anderen Sätze machen daraus einen kausalen, finalen oder proportionalen Zusammenhang."),
  choice("konjunktiv_i", "HARD",
    "Welche Form verlangt die indirekte Rede in einem formellen Protokoll? Im Protokoll heißt es, die Beschäftigten ___ von der Änderung erst aus der Presse erfahren.",
    ["haben", "habe", "hatten", "hätten"], "d",
    "Konjunktiv I \"(sie) haben\" ist mit dem Indikativ identisch, deshalb wird er durch den Konjunktiv II \"hätten\" ersetzt. \"habe\" ist Singular, \"hatten\" Indikativ Präteritum."),
  gap("konjunktiv_i", "HARD",
    "Formen Sie die Anweisung in den Stil einer Gebrauchsanleitung um (Konjunktiv I mit „man“): „Beachten Sie, dass alle Angaben ohne Gewähr sind.“\n→ Man {{g1}}, dass alle Angaben ohne Gewähr sind.",
    ["beachte"],
    "Konjunktiv I als Aufforderung (Anleitungs- und Rezeptstil): \"man beachte\", gebildet aus Infinitivstamm + -e."),
  gap("partizipialattribut", "HARD",
    "Der Ausschuss diskutierte die von der Kommission bereits im Frühjahr {{g1}} und seither mehrfach überarbeiteten Vorschläge.",
    ["vorgelegten"],
    "Erweitertes Partizipialattribut: Partizip II (passivisch, abgeschlossen: \"bereits im Frühjahr\") mit Adjektivendung, wie das koordinierte \"überarbeiteten\". \"vorzulegenden\" (Zukunft/Notwendigkeit) widerspricht \"bereits\", \"vorlegenden\" ist aktivisch, \"vorgelegt\" ohne Endung ist falsch.",
    ["vorgelegt", "vorlegenden", "vorgelegten", "vorzulegenden"]),
  choice("lexik_nuance", "HARD",
    "Sein Verhalten in der Besprechung war ausgesprochen ___: Er schmollte, weil sein Vorschlag abgelehnt worden war.",
    ["kindisch", "kindlich", "kindhaft", "kinderhaft"], "a",
    "\"kindisch\" ist abwertend (unreif, bei Erwachsenen). \"kindlich\" und \"kindhaft\" sind neutral bis positiv (wie ein Kind), \"kinderhaft\" ist keine Standardform."),
  gap("rektion", "HARD",
    "Jede Änderung dieses Vertrags bedarf {{g1}} Schriftform.",
    ["der"],
    "\"bedürfen\" regiert den Genitiv: \"bedarf der Schriftform\" (feste juristische Formel). \"die\" (Akkusativ) und \"zur\" sind typische Fehler.",
    ["die", "der", "zur", "in"]),
  choice("konzessiv", "HARD",
    "___ der Vorschlag auch noch so durchdacht sein, er ist schlicht zu teuer.",
    ["Soll", "Will", "Mag", "Muss"], "c",
    "Konzessiv mit \"mögen\": \"Mag ... auch noch so ..., (Hauptsatz)\" = auch wenn er noch so durchdacht ist. Die anderen Modalverben haben keine konzessive Lesart."),
  choice("wortstellung", "HARD",
    "Sie wusste, dass er an der Sitzung nicht ___.",
    ["hat teilnehmen können", "teilnehmen können hat", "teilnehmen gekonnt hat", "hat teilgenommen gekonnt"], "a",
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
  }),
];

// ------------------------------------------------------------------ reading

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
Wer in einer Besprechung einen Gedanken äußert, der noch nicht zu Ende gedacht ist, tut dies in vielen Organisationen mit einer entschuldigenden Vorbemerkung: „Das ist jetzt nur so eine Idee“ oder „Ich habe das noch nicht durchgerechnet“. Solche Floskeln verraten mehr über die Kultur eines Hauses als jedes Leitbild an der Wand. Sie zeigen, dass Unfertiges als Makel gilt, als etwas, das man eigentlich nicht vorzeigen sollte, bevor es poliert, abgesichert und von allen Seiten gegen Einwände verteidigt ist. Man kennt diese Formeln so gut, dass man sie kaum noch hört; dabei sind sie kleine Rituale der Selbstabsicherung, mit denen sich der Sprecher vorsorglich von seinem eigenen Gedanken distanziert.

B
Diese Haltung hat eine nachvollziehbare Herkunft. In Schule, Ausbildung und Studium werden fast ausschließlich Ergebnisse bewertet; der Weg dorthin, mit seinen Umwegen und Sackgassen, bleibt unsichtbar und bringt keine Punkte. Auch in Zeugnissen und Beurteilungen taucht der mühsame, tastende Teil der Arbeit selten auf; gelobt wird, wer liefert, nicht, wer klug gesucht hat. Wer jahrelang gelernt hat, dass nur das fertige Produkt zählt, überträgt dieses Muster später auf den Beruf. Hinzu kommt die Sorge um den eigenen Ruf: Ein halbgarer Vorschlag könnte, so die Befürchtung, das Bild der eigenen Kompetenz beschädigen, das man sich mühsam aufgebaut hat. Lieber schweigt man, bis man sicher ist.

C
Die Kosten dieser Vorsicht sind beträchtlich, auch wenn sie in keiner Bilanz auftauchen. Ideen, die zu lange im Verborgenen reifen, werden oft erst dann vorgestellt, wenn bereits viel Zeit und Mühe in sie geflossen sind. Stellt sich dann heraus, dass eine grundlegende Annahme nicht trägt, ist die Enttäuschung groß und die Bereitschaft, den Irrtum einzugestehen, entsprechend gering. Nicht selten wird ein Vorhaben dann weiterverfolgt, obwohl alle Beteiligten ahnen, dass es auf schwachen Füßen steht. Psychologisch ist das gut nachvollziehbar: Je mehr man investiert hat, desto schwerer fällt es, sich von einer Sache zu trennen, und desto eher sucht man nach Gründen, sie fortzusetzen. Das Verborgene schützt also nicht nur vor fremder Kritik, es macht auch unempfindlich gegen die eigene. Hätte man den Entwurf früher gezeigt, wäre der Denkfehler womöglich in einer Viertelstunde aufgefallen.

D
Es wäre allerdings naiv, nun das Gegenteil zu fordern und jede spontane Eingebung sofort in die Runde zu werfen. Nicht jeder Gedanke verdient die Aufmerksamkeit von zehn Menschen, und wer seine Kolleginnen und Kollegen mit ungeordneten Einfällen überschüttet, verschiebt lediglich die Arbeit des Sortierens auf andere. Wer jede halbe Idee laut denkt, verliert zudem an Glaubwürdigkeit: Irgendwann hört man ihm nicht mehr genau zu, weil man gelernt hat, dass das meiste ohnehin wieder verworfen wird. Offenheit ist also keine Tugend an sich, sondern ein Werkzeug, und wie jedes Werkzeug kann man es falsch einsetzen. Das Unfertige zu zeigen, ist nur dann ein Gewinn, wenn klar ist, wozu man es zeigt: um eine Richtung zu prüfen, eine Lücke zu entdecken, einen Einwand frühzeitig zu hören.

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
    body: `Als die Geschäftsführung der Hallberg Messtechnik GmbH im vergangenen Frühjahr ankündigte, ein Jahr lang die Viertagewoche zu erproben, waren die Reaktionen gemischt. Für das Unternehmen, das Messinstrumente für Labore und Industriebetriebe herstellt, war der Versuch auch eine Antwort auf den Fachkräftemangel: Man hoffte, als Arbeitgeber attraktiver zu werden. Ein Teil der rund hundertachtzig Beschäftigten begrüßte die Aussicht auf ein verlängertes Wochenende, andere befürchteten, dieselbe Arbeit nun in kürzerer Zeit und unter größerem Druck erledigen zu müssen. Inzwischen liegt der Abschlussbericht vor, und er fällt differenzierter aus, als es Befürworter wie Gegner erwartet hatten.

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
Die Kranbau Severin AG sucht für ein auf zwei Jahre befristetes Digitalisierungsprojekt eine Technische Redakteurin oder einen Technischen Redakteur. Sie verfassen Betriebsanleitungen und Wartungshandbücher für unsere Hebetechnik, überführen die bestehende Dokumentation in ein neues Redaktionssystem und stimmen sich eng mit der Konstruktion ab. Voraussetzung sind ein technisches Studium oder eine vergleichbare Qualifikation, Erfahrung in der Dokumentation sowie verhandlungssichere Englischkenntnisse, da ein Teil der Handbücher für internationale Kunden entsteht. Die Stelle kann vollständig im Homeoffice besetzt werden; lediglich während der zweiwöchigen Einarbeitung erwarten wir Sie an unserem Standort.

Anzeige C
Die Velora Versicherungsgruppe sucht für ihr Servicecenter eine Teamleitung Kundenservice, unbefristet und in Vollzeit. Sie führen ein Team von zwölf Mitarbeitenden, planen die Schichten im Rahmen unserer Servicezeiten von sieben bis zwanzig Uhr und sind erste Ansprechperson, wenn Kundenanliegen eskalieren. Erfahrung in der Personalführung setzen wir voraus, die Branche ist für uns dagegen zweitrangig: Wer bereits Teams im Handel, in der Gastronomie oder in der Logistik geführt hat, ist herzlich willkommen. Da die Aufgabe ständige Ansprechbarkeit vor Ort erfordert, ist mobiles Arbeiten in dieser Position nicht möglich. Die fachliche Schulung übernehmen wir.

Anzeige D
Das Übersetzungsbüro Kessler & Partner erweitert seinen Pool freiberuflicher Übersetzerinnen und Übersetzer für die Sprachrichtungen Englisch-Deutsch und Deutsch-Englisch mit Schwerpunkt Recht: Verträge, Gutachten, Gerichtsentscheidungen. Sie bestimmen selbst, wie viele Aufträge Sie annehmen; eine Mindestabnahme gibt es nicht. Voraussetzung sind juristische Fachkenntnisse, etwa durch ein Studium oder eine Tätigkeit in einer Kanzlei, sowie Englischkenntnisse auf höchstem Niveau. Die Vergütung erfolgt pro Normzeile, die Zahlung innerhalb von vierzehn Tagen nach Lieferung.`,
  },
];

const rK = forText(R_KOMMENTAR);
const rE = forText(R_ESSAY);
const rB = forText(R_BERICHT);
const rA = forText(R_ANZEIGEN);

const readingItems: SeedItem[] = [
  // Kommentar: four-option MC, as in Goethe C2 Lesen Teil 1.
  rK.choice("gist", "MID",
    "Welche Haltung vertritt der Autor insgesamt?",
    [
      "Er hält Kennzahlen grundsätzlich für schädlich und fordert, auf sie zu verzichten.",
      "Er hält Messen für nützlich, aber nicht als Maßstab für Arbeit, die auf Urteilskraft beruht.",
      "Er fordert, die vorhandenen Kennzahlen möglichst rasch durch genauere zu ersetzen.",
      "Er meint, dass vor allem Beschäftigte Messungen ablehnen, weil sie etwas zu verbergen haben.",
    ], "b",
    "Vorletzter Absatz: \"Nichts davon spricht dagegen, zu messen\", problematisch nur dort, \"wo Arbeit vor allem aus Urteilskraft besteht\". (a) widerspricht diesem Absatz, (c) ist der Einwand, den der Autor relativiert, (d) ist der Verdacht aus dem ersten Absatz, den er gerade nicht teilt."),
  rK.choice("inference", "HARD",
    "Was will der Autor ausdrücken, wenn er schreibt, die Statistik verbuche den zweiten Anruf „erfreulicherweise“ als zwei erfolgreich bearbeitete Fälle?",
    [
      "Die Statistik belegt, dass die Mitarbeitenden schneller arbeiten als früher.",
      "Kunden sind mit kurzen Gesprächen im Allgemeinen zufriedener als mit langen.",
      "Die Software zählt manche Anrufe aus technischen Gründen doppelt.",
      "Die Kennzahl lässt ein Versäumnis wie einen Erfolg aussehen.",
    ], "d",
    "\"erfreulicherweise\" ist ironisch: Der Kunde musste wegen des zu früh beendeten Gesprächs erneut anrufen, die Zahl zeigt aber zwei Erfolge. Es geht um Fehlanreize, nicht um Technik oder Kundenzufriedenheit."),
  rK.choice("detail", "MID",
    "Warum hält der Autor den Einwand, man brauche nur klügere Kennzahlen, für unzureichend?",
    [
      "Weil die Einführung klügerer Kennzahlen zu teuer wäre.",
      "Weil das Controlling neue Kennzahlen grundsätzlich ablehnt.",
      "Weil die Beschäftigten auch auf neue Kennzahlen mit Ausweichstrategien reagieren.",
      "Weil Kinderkrankheiten neuer Systeme ohnehin von selbst verschwinden.",
    ], "c",
    "Vierter Absatz: Der Einwand \"unterschätzt die Fantasie der Gemessenen. Jede neue Zahl erzeugt neue Ausweichbewegungen\". Kosten werden in diesem Zusammenhang nicht genannt; das Controlling \"kommt zu spät\", lehnt aber nichts ab."),
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
      "Organisationen sollten bei Fehlern vor allem auf die entstehenden Kosten achten.",
      "Wer Unfertiges zeigt, macht insgesamt weniger Fehler als andere.",
      "Früh erkannte Fehler verursachen weniger Aufwand als spät erkannte.",
      "Erste Entwürfe sollten mit möglichst geringen Mitteln erstellt werden.",
    ], "c",
    "Der Autor sagt ausdrücklich, die Organisation werde \"nicht fehlerfrei arbeiten\" (gegen b), aber Fehler früher machen; das verbindet sich mit Abschnitt C (spät entdeckte Fehler sind teuer). (a) und (d) deuten \"billiger\" wörtlich."),
  rE.choice("vocabulary", "MID",
    "Was bedeutet „ein halbgarer Vorschlag“ in Abschnitt B?",
    [
      "ein noch nicht ausgereifter Vorschlag",
      "ein nur halbherzig vertretener Vorschlag",
      "ein unehrlich gemeinter Vorschlag",
      "ein zur Hälfte umgesetzter Vorschlag",
    ], "a",
    "\"halbgar\" (übertragen) = nicht genügend durchdacht, unausgereift; vgl. \"unausgegoren\" in F. \"halbherzig\" ist ein ähnlich klingender, aber anderer Begriff."),
  rE.tfng("detail", "MID",
    [
      ["Nach Ansicht des Autors spielt der Lernweg bei Bewertungen in der Ausbildung kaum eine Rolle.", "R"],
      ["Der Autor empfiehlt, in Besprechungen jeden spontanen Einfall sofort zur Diskussion zu stellen.", "F"],
      ["Teams mit festen Formaten für Rohfassungen erzielen nachweislich bessere Ergebnisse.", "NG"],
    ],
    "1 R: Abschnitt B, der Weg \"bleibt unsichtbar und bringt keine Punkte\". 2 F: Abschnitt D lehnt genau das ab. 3 NG: In E steht nur, dass sich der Ton verändert; über Ergebnisse sagt der Text nichts."),

  // Bericht: removed paragraphs (Goethe C2 Lesen Teil 3), plus MC and R/F/NG.
  rB.match("structure", "HARD",
    "In den Text wurden drei Absätze entfernt. Ordnen Sie jeder Lücke den passenden Absatz zu. Ein Absatz passt nicht.",
    ["Lücke 1", "Lücke 2", "Lücke 3"],
    [
      "Nicht verschwiegen wird im Bericht, dass der Kundendienst an seine Grenzen stieß. Da Kunden auch freitags eine Ansprechperson erwarten, musste dort ein rollierendes System eingeführt werden, das die Planung erheblich verkomplizierte. Die Zufriedenheit der Kunden blieb zwar stabil, im Team selbst wuchs jedoch der Unmut über die ständigen Absprachen.",
      "Ähnliche Versuche in anderen Ländern hatten zuvor gezeigt, dass die Viertagewoche vor allem in kreativen Branchen funktioniert, in der Industrie dagegen regelmäßig scheitert. Die Geschäftsführung entschied sich deshalb, die Fertigung von vornherein auszunehmen.",
      "Das Modell sah vor, die wöchentliche Arbeitszeit von achtunddreißig auf zweiunddreißig Stunden zu senken, bei vollem Lohnausgleich. Im Gegenzug verpflichteten sich die Teams, ihre Abläufe selbst zu überprüfen und Zeitfresser zu benennen. Begleitet wurde der Versuch von einer Hochschule, die Befragungen durchführte und Kennzahlen zu Produktivität und Krankmeldungen auswertete.",
      "Weniger eindeutig war das Bild in der Verwaltung. Dort berichteten viele Beschäftigte, sie seien zwar erholter, schafften ihr Pensum aber nur, indem sie Pausen verkürzten oder Besprechungen strichen. Gerade Letzteres wurde allerdings nicht nur negativ gesehen: Etliche Teams stellten fest, dass ein Teil ihrer regelmäßigen Sitzungen ohnehin entbehrlich gewesen war.",
    ],
    [3, 4, 1],
    "Lücke 1: Beschreibung des Modells nach der Einleitung, bevor die Ergebnisse folgen. Lücke 2: \"Diese Beobachtung\" im nächsten Absatz greift die entbehrlichen Sitzungen auf. Lücke 3: Nach der Warnung vor unbesehener Übertragung folgt der Kundendienst als Gegenbeispiel, der die uneinheitliche Fortführung begründet. Der Absatz über die ausgenommene Fertigung widerspricht dem Text."),
  rB.choice("detail", "MID",
    "Worauf führen die Forschenden die gewonnene Zeit vor allem zurück?",
    [
      "auf ein höheres Arbeitstempo der Beschäftigten",
      "auf den Verzicht auf überflüssige Tätigkeiten",
      "auf die neue Verteilung der Schichten",
      "auf den Rückgang der Krankheitstage",
    ], "b",
    "\"weniger aus einem schnelleren Arbeitstempo ... als aus dem Wegfall von Tätigkeiten, deren Nutzen ... niemand mehr hinterfragt hatte\". Schichten und Krankheitstage werden genannt, aber nicht als Ursache der gewonnenen Zeit."),
  rB.choice("inference", "HARD",
    "Was lässt sich über die Entscheidung der Geschäftsführung sagen?",
    [
      "Sie kehrt wegen der Probleme in der Fertigung zur Fünftagewoche zurück.",
      "Sie überträgt das erprobte Modell unverändert auf alle Abteilungen.",
      "Sie macht die Fortführung von einer weiteren Studie der Hochschule abhängig.",
      "Sie zieht Konsequenzen aus den unterschiedlichen Erfahrungen der Bereiche.",
    ], "d",
    "Das Modell wird fortgeführt, \"allerdings nicht mehr einheitlich\"; jede Abteilung regelt es selbst. Das folgt aus den unterschiedlichen Ergebnissen und der Warnung der Forschenden."),
  rB.tfng("detail", "MID",
    [
      ["Vor Beginn des Versuchs stand die Belegschaft geschlossen hinter der Idee.", "F"],
      ["In der Fertigung verlief die Umstellung anfangs keineswegs reibungslos.", "R"],
      ["Die Hochschule empfiehlt allen Unternehmen der Branche, die Viertagewoche einzuführen.", "NG"],
    ],
    "1 F: Die Reaktionen waren \"gemischt\", manche befürchteten mehr Druck. 2 R: \"erhebliche Reibungen\" in den ersten Wochen. 3 NG: Die Forschenden warnen nur vor unbesehener Übertragung; eine Empfehlung für die Branche steht nicht im Text."),

  // Stellenanzeigen: selective reading (Goethe C2 Lesen Teil 4).
  rA.match("detail", "MID",
    "Welche Anzeige passt zu welcher Person? Wenn keine Anzeige passt, wählen Sie „keine passende Anzeige“.",
    [
      "Eine Juristin mit hervorragenden Englischkenntnissen sucht eine Nebentätigkeit, deren Umfang sie selbst steuern kann.",
      "Ein Maschinenbauingenieur möchte, ohne umzuziehen, im Homeoffice Anleitungen schreiben; eine kurze Präsenzphase zu Beginn wäre für ihn kein Problem.",
      "Ein Bewerber hat mehrere Jahre eine Filiale im Einzelhandel geleitet und möchte nun in einer anderen Branche Führungsverantwortung übernehmen.",
      "Eine Schulabgängerin ohne Berufserfahrung sucht einen Ausbildungsplatz im kaufmännischen Bereich.",
      "Ein Betriebswirt mit langjähriger Erfahrung in gesetzlichen Berichtspflichten möchte höchstens dreißig Stunden pro Woche arbeiten.",
    ],
    ["Anzeige A", "Anzeige B", "Anzeige C", "Anzeige D", "keine passende Anzeige"],
    [4, 2, 3, 5, 1],
    "Juristin, Umfang selbst bestimmt: D (freiberuflich, keine Mindestabnahme). Ingenieur, Homeoffice, Anleitungen: B. Filialleiter, neue Branche: C (Branche zweitrangig, Führungserfahrung nötig). Ausbildungsplatz: keine Anzeige. Betriebswirt, Berichtspflichten, Teilzeit: A (ab 28 Stunden)."),
  rA.choice("detail", "EASY",
    "In welcher Anzeige wird ausdrücklich ausgeschlossen, dass man von zu Hause aus arbeitet?",
    ["Anzeige A", "Anzeige B", "Anzeige C", "Anzeige D"], "c",
    "C: \"mobiles Arbeiten in dieser Position nicht möglich\". A erlaubt zwei Tage mobiles Arbeiten, B vollständig Homeoffice, D sagt nichts über den Arbeitsort."),
  rA.choice("vocabulary", "MID",
    "In Anzeige B werden „verhandlungssichere Englischkenntnisse“ verlangt. Was ist damit gemeint?",
    [
      "Grundkenntnisse, die für einfache Gespräche ausreichen",
      "sehr gute Kenntnisse, die auch für schwierige Fachgespräche reichen",
      "ein Nachweis über ein Training in Verhandlungsführung",
      "Erfahrung im Verkauf an englischsprachige Kunden",
    ], "b",
    "\"verhandlungssicher\" ist in Stellenanzeigen eine feste Niveaubezeichnung: so sicher, dass man auch in anspruchsvollen beruflichen Situationen (Verhandlungen) souverän kommuniziert. Es geht nicht um ein Verhandlungstraining oder Verkauf."),
  rA.tfng("detail", "MID",
    [
      ["Bei den Stadtwerken Lindenau ist die Stelle auch mit reduzierter Stundenzahl möglich.", "R"],
      ["Die Stelle bei der Kranbau Severin AG ist unbefristet.", "F"],
      ["Das Übersetzungsbüro zahlt ein festes monatliches Honorar.", "F"],
      ["Die Velora Versicherungsgruppe zahlt Zuschläge für Abendschichten.", "NG"],
    ],
    "1 R: Teilzeit ab 28 Wochenstunden. 2 F: auf zwei Jahre befristet. 3 F: Vergütung pro Normzeile. 4 NG: Schichten werden erwähnt, Zuschläge nicht."),
];

// ------------------------------------------------------------------ listening

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

const L_FEATURE = "v2-l-c2-feature-telefonieren";
const L_DEBATTE = "v2-l-c2-debatte-probetag";
const L_INTERVIEW = "v2-l-c2-interview-planung";

const listeningStimuli: SeedStimulus[] = [
  clip(L_FEATURE, "Radiofeature: Wer ruft heute noch an?", "Kommunikation am Arbeitsplatz",
    [
      { label: "Sprecherin", voice: "A" },
      { label: "Wendland", voice: "B" },
    ],
    [
      "Sprecherin: Es klingelt, und kaum jemand geht ran. Was vor zwanzig Jahren als unhöflich gegolten hätte, ist in vielen Büros längst zur stillen Übereinkunft geworden: Wer etwas will, der schreibt.",
      "Sprecherin: Eine Umfrage unter Berufstätigen, die ein Beratungsunternehmen im vergangenen Herbst durchgeführt hat, zeichnet ein deutliches Bild. Mehr als die Hälfte der Befragten gab an, unangekündigte Anrufe als störend zu empfinden. Nur eine kleine Minderheit greift bei beruflichen Fragen noch spontan zum Hörer. Der Kommunikationswissenschaftler Martin Wendland beobachtet diese Entwicklung seit Jahren, und er warnt davor, sie vorschnell als Verfall der Sitten zu deuten.",
      "Wendland: Na ja, man muss sich erst mal klarmachen, was ein Anruf eigentlich ist. Ein Anruf ist eine Forderung: Ich will jetzt deine Aufmerksamkeit, und zwar sofort. Eine Nachricht dagegen lässt dem anderen die Wahl, wann er antwortet. Insofern ist der Rückgang des Telefonierens auch ein Ausdruck von Rücksicht, nicht nur von Bequemlichkeit.",
      "Sprecherin: Doch die schriftliche Kommunikation hat ihren Preis. Missverständnisse, die am Telefon nach zwei Sätzen ausgeräumt wären, ziehen sich per Mail oft über Tage. Und der Ton, so berichten viele, werde schärfer, wenn man das Gegenüber nicht hört.",
      "Wendland: Das ist der Punkt, an dem ich hellhörig werde, wenn jemand behauptet, Schreiben sei grundsätzlich effizienter. Bei einfachen Absprachen, ja, gar keine Frage. Aber sobald es um Konflikte geht, um Verhandlungen, um alles, wo Zwischentöne zählen, verlieren wir mit dem Schreiben Information. Die Stimme verrät Zögern, Ironie, Unsicherheit. In einer Mail müssen Sie das alles erraten, und wir neigen dazu, im Zweifel das Ungünstigere anzunehmen.",
      "Sprecherin: Einige Unternehmen versuchen gegenzusteuern. In einer Werbeagentur etwa gilt seit einem Jahr die Regel, dass spätestens nach der dritten Mail zu einem Thema zum Hörer gegriffen wird. Die Erfahrungen seien gemischt, heißt es dort: Die Zahl der endlosen Mailverläufe sei zwar gesunken, manche Mitarbeitende empfänden die Regel aber als Bevormundung.",
      "Wendland: Ich halte solche Regeln für gut gemeint, aber, wie soll ich sagen, ein bisschen hilflos. Gesprächskultur lässt sich nicht verordnen. Was hilft, ist eher, dass Führungskräfte es vormachen: dass sie anrufen, wenn es heikel wird, und dass sie vorher kurz fragen, ob es gerade passt. Dann verliert der Anruf auch seinen Überfallcharakter.",
      "Sprecherin: Ob das Telefon ein Comeback erlebt, ist offen. Sicher ist nur: Die Frage, wann man schreibt und wann man spricht, ist keine technische, sondern eine soziale. Und sie wird in jedem Team neu verhandelt.",
    ]),
  clip(L_DEBATTE, "Streitgespräch: Probetag statt Vorstellungsgespräch?", "Personalauswahl",
    [
      { label: "Seidel", voice: "A" },
      { label: "Okafor", voice: "B" },
    ],
    [
      "Seidel: Herr Okafor, Ihre Firma hat das klassische Vorstellungsgespräch weitgehend abgeschafft und lädt Bewerber stattdessen zu einem bezahlten Probetag ein. Was war der Anlass?",
      "Okafor: Ganz ehrlich: Wir haben uns zu oft getäuscht. Im Gespräch wirkten Leute brillant, und nach drei Wochen merkte man, dass sie mit den eigentlichen Aufgaben nicht zurechtkamen. Oder umgekehrt: Jemand war nervös, hat kaum ein Wort herausgebracht und war dann einer unserer Besten. So ein Gespräch, wie es meistens geführt wird, misst vor allem, wie gut sich jemand verkauft.",
      "Seidel: Da widerspreche ich Ihnen gar nicht. Gespräche ohne klare Struktur sind ein ziemlich unzuverlässiges Instrument, das zeigt die Forschung seit Langem. Nur, ob ein einziger Tag so viel aussagekräftiger ist, wage ich zu bezweifeln. Ein Probetag ist eine künstliche Situation. Man kennt die Abläufe nicht, die Kollegen nicht, die Werkzeuge nicht. Am Ende beobachten Sie, wie jemand mit Fremdheit umgeht, und nicht, wie er arbeitet.",
      "Okafor: Deshalb schicken wir vorab Material, damit niemand ins kalte Wasser springt. Und, offen gesagt: Sich schnell in einer unbekannten Umgebung zurechtzufinden, ist bei den Stellen, die wir besetzen, keine Nebensache. Das gehört zum Job.",
      "Seidel: Darüber kann man streiten. Mein größeres Problem ist aber ein anderes: Wer kann sich überhaupt einen ganzen Tag freinehmen, um sich irgendwo vorzustellen? Wer in ungekündigter Stellung ist und seinem Arbeitgeber nichts sagen will oder feste Verpflichtungen hat, hat da schlechte Karten.",
      "Okafor: Das Argument kenne ich, und es ist berechtigt. Wir bieten den Probetag inzwischen auch samstags an oder aufgeteilt auf zwei Nachmittage. Perfekt ist das nicht, das gebe ich zu.",
      "Seidel: Ich würde trotzdem anders ansetzen. Statt das Gespräch abzuschaffen, sollte man es besser machen: feste Fragen, mehrere Beurteilende, Kriterien, die vorher feststehen. Wenn das sauber gemacht wird, brauchen Sie meiner Meinung nach keinen ganzen Tag.",
      "Okafor: Ich sehe das gar nicht als Entweder-oder. Wir führen am Ende des Probetags ja auch ein Gespräch, nur eben eines, in dem wir über etwas Konkretes reden können, nämlich über die Aufgabe, die jemand gerade gelöst hat. Das ist ein ganz anderes Gespräch als die Frage, wo man sich in fünf Jahren sieht.",
      "Seidel: Gut, wenn das so läuft, liegen wir weniger weit auseinander, als ich dachte. Ich warne nur davor, den Probetag als Allheilmittel zu verkaufen. Es gibt Stellen, da lässt sich in acht Stunden schlicht nichts Sinnvolles zeigen. Denken Sie an strategische Aufgaben, deren Ergebnis man erst nach Monaten beurteilen kann.",
      "Okafor: Für solche Positionen würde ich ihn auch nicht empfehlen. Wir stellen vor allem Entwicklerinnen und Entwickler ein, und da passt es.",
    ]),
  clip(L_INTERVIEW, "Interview: Warum Projekte länger dauern als geplant", "Projektmanagement",
    [
      { label: "Moderator", voice: "B" },
      { label: "Brandstätter", voice: "A" },
    ],
    [
      "Moderator: Frau Doktor Brandstätter, Sie erforschen, warum große Vorhaben fast immer teurer werden und länger dauern als geplant. Ist das nicht einfach Pech?",
      "Brandstätter: Wenn es Pech wäre, müssten sich die Abweichungen ja in beide Richtungen verteilen. Manche Projekte wären früher fertig, andere später. Tatsächlich liegen aber fast alle auf derselben Seite. Das spricht für einen systematischen Fehler, nicht für Zufall.",
      "Moderator: Und worin besteht dieser Fehler?",
      "Brandstätter: Im Kern darin, dass wir aus der Innenperspektive planen. Wir schauen auf unser Vorhaben, zerlegen es in Schritte, schätzen jeden Schritt und zählen zusammen. Was dabei fehlt, sind all die Dinge, die wir nicht vorhersehen können, gerade weil wir sie nicht kennen: die Lieferung, die ausbleibt, die Genehmigung, die sich verzögert, die Kollegin, die mitten im Projekt das Unternehmen verlässt. Einzeln ist jedes dieser Ereignisse unwahrscheinlich. Dass gar keines eintritt, ist aber noch unwahrscheinlicher.",
      "Moderator: Was wäre die Alternative?",
      "Brandstätter: Man nimmt bewusst die Außenperspektive ein. Man fragt also nicht zuerst: Wie lange brauchen wir für dieses Projekt? Sondern: Wie lange haben vergleichbare Projekte tatsächlich gedauert, und zwar nicht laut Plan, sondern bis zum tatsächlichen Abschluss? Diese Zahl ist meist ernüchternd, aber sie ist ein viel besserer Ausgangspunkt. Erst danach passt man an, was am eigenen Vorhaben wirklich anders ist.",
      "Moderator: Das klingt einleuchtend. Warum machen es dann so wenige?",
      "Brandstätter: Weil sich ein realistischer Plan schlecht verkauft. Wer in einer Sitzung sagt, das Projekt werde vermutlich doppelt so lange dauern wie erhofft, gilt schnell als Bedenkenträger. Wer dagegen einen ehrgeizigen Zeitplan präsentiert, bekommt den Zuschlag. Optimismus wird also belohnt, und zwar genau in dem Moment, in dem entschieden wird. Die Rechnung kommt später, und dann fühlt sich oft niemand mehr zuständig.",
      "Moderator: Heißt das, die Beteiligten täuschen bewusst?",
      "Brandstätter: In den allermeisten Fällen nicht, nein, das wäre zu einfach. Die meisten glauben an ihre Zahlen. Gerade das macht es so schwierig: Man kann niemandem Unehrlichkeit vorwerfen, und trotzdem ist das Ergebnis verzerrt. Ich vergleiche das gern mit einem Navigationsgerät, das grundsätzlich jeden Stau ignoriert. Es lügt nicht, es rechnet nur mit einer Welt, die es so nicht gibt.",
      "Moderator: Was raten Sie Unternehmen konkret?",
      "Brandstätter: Erstens: Vergleichsdaten sammeln, auch über gescheiterte Projekte, und zwar systematisch. Zweitens: Wer einen Plan aufstellt, sollte nicht derselbe sein, der ihn genehmigt. Und drittens, das klingt vielleicht banal: Reserven offen ausweisen, statt sie in einzelnen Positionen zu verstecken. Versteckte Reserven werden nämlich verbraucht, ob man sie braucht oder nicht.",
    ]),
];

const lF = forClip(L_FEATURE);
const lD = forClip(L_DEBATTE);
const lI = forClip(L_INTERVIEW);

const listeningItems: SeedItem[] = [
  // Radiofeature
  lF.tfng("detail", "MID",
    [
      ["Laut der Umfrage empfindet die Mehrheit der Befragten unangekündigte Anrufe als lästig.", "R"],
      ["Wendland sieht im Rückgang des Telefonierens allein ein Zeichen von Bequemlichkeit.", "F"],
      ["Die Werbeagentur hat ihre Regel inzwischen wieder abgeschafft.", "NG"],
    ],
    "1 R: \"Mehr als die Hälfte\" empfindet sie als störend. 2 F: \"auch ein Ausdruck von Rücksicht, nicht nur von Bequemlichkeit\". 3 NG: Erfahrungen sind gemischt, über eine Abschaffung wird nichts gesagt."),
  lF.choice("attitude", "MID",
    "Wie beurteilt Wendland die Behauptung, Schreiben sei effizienter als Telefonieren?",
    [
      "Er hält sie nur für einfache Absprachen für zutreffend.",
      "Er stimmt ihr ohne Einschränkung zu.",
      "Er lehnt sie ab, weil Mails grundsätzlich mehr Zeit kosten.",
      "Er hält sie für unbeweisbar, weil es dazu keine Studien gibt.",
    ], "a",
    "\"Bei einfachen Absprachen, ja, gar keine Frage. Aber sobald es um Konflikte geht ...\": eine eingeschränkte Zustimmung."),
  lF.choice("detail", "HARD",
    "Warum ist schriftliche Kommunikation laut Wendland bei Konflikten problematisch?",
    [
      "Weil schriftliche Aussagen später gegen einen verwendet werden können.",
      "Weil Konflikte am Telefon erfahrungsgemäß schneller eskalieren.",
      "Weil man Zwischentöne erraten muss und sie eher ungünstig deutet.",
      "Weil Mails häufig von unbeteiligten Dritten mitgelesen werden.",
    ], "c",
    "Die Stimme verrät Zögern, Ironie, Unsicherheit; in der Mail muss man das erraten und \"im Zweifel das Ungünstigere anzunehmen\". (b) dreht die Aussage um, (a) und (d) kommen nicht vor."),
  lF.choice("attitude", "HARD",
    "Was hält Wendland von der Regel der Werbeagentur?",
    [
      "Er hält sie für die wirksamste Lösung des Problems.",
      "Er lehnt sie ab, weil sie der Überwachung der Mitarbeitenden dient.",
      "Er schlägt vor, sie auf weitere Unternehmen auszuweiten.",
      "Er erkennt die Absicht an, bezweifelt aber, dass Vorschriften etwas bewirken.",
    ], "d",
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
    "1 beide: Okafor (\"misst vor allem, wie gut sich jemand verkauft\"), Seidel (\"Da widerspreche ich Ihnen gar nicht ... unzuverlässiges Instrument\"). 2 nur Seidel: \"brauchen Sie keinen ganzen Tag\"; Okafor sieht kein Entweder-oder. 3 nur Okafor: \"gehört zum Job\"; Seidel: \"Darüber kann man streiten.\" 4 keiner: Seidel nennt strategische Stellen als Gegenbeispiel, Okafor stimmt zu."),
  lD.choice("attitude", "MID",
    "Wie reagiert Herr Okafor auf den Einwand, ein Probetag benachteilige manche Bewerber?",
    [
      "Er bestreitet, dass dieses Problem in der Praxis vorkommt.",
      "Er räumt das Problem ein und verweist auf Teillösungen.",
      "Er meint, betroffene Personen sollten sich anderswo bewerben.",
      "Er kündigt an, den Probetag deshalb wieder abzuschaffen.",
    ], "b",
    "\"Das Argument kenne ich, und es ist berechtigt\" + Samstag oder zwei Nachmittage + \"Perfekt ist das nicht\"."),
  lD.choice("detail", "MID",
    "Worum geht es im Gespräch am Ende des Probetags?",
    [
      "um die langfristigen Karrierepläne der Bewerberin oder des Bewerbers",
      "um die Eindrücke der Kolleginnen und Kollegen aus dem Team",
      "um die Gehaltsvorstellungen und den möglichen Arbeitsbeginn",
      "um die Aufgabe, die gerade bearbeitet worden ist",
    ], "d",
    "\"über die Aufgabe, die jemand gerade gelöst hat\". Die Frage nach den fünf Jahren nennt Okafor gerade als Gegenbeispiel (Distraktor a)."),
  lD.choice("gist", "HARD",
    "Wie lässt sich der Verlauf des Gesprächs insgesamt beschreiben?",
    [
      "Die Standpunkte rücken zusammen, ohne dass alle Unterschiede verschwinden.",
      "Die Positionen bleiben bis zum Schluss unvereinbar.",
      "Frau Seidel übernimmt am Ende die Position von Herrn Okafor vollständig.",
      "Herr Okafor gibt zu, dass sein Modell gescheitert ist.",
    ], "a",
    "Seidel: \"liegen wir weniger weit auseinander, als ich dachte\", warnt aber weiter vor dem \"Allheilmittel\". Also Annäherung mit verbleibenden Vorbehalten."),

  // Experteninterview: MC (Goethe C2 Hören Teil 3)
  lI.choice("inference", "MID",
    "Warum hält Brandstätter Pech als Erklärung für unwahrscheinlich?",
    [
      "Weil Projekte heute deutlich besser geplant werden als früher.",
      "Weil unvorhergesehene Ereignisse in Projekten kaum vorkommen.",
      "Weil die Abweichungen fast immer in dieselbe Richtung gehen.",
      "Weil die meisten Projekte am Ende doch rechtzeitig fertig werden.",
    ], "c",
    "Zufall würde Abweichungen in beide Richtungen erzeugen; \"fast alle auf derselben Seite\" spricht für einen systematischen Fehler. (b) widerspricht ihrer späteren Aussage."),
  lI.choice("detail", "MID",
    "Was versteht Brandstätter unter der Außenperspektive?",
    [
      "Man lässt das Vorhaben von externen Fachleuten planen.",
      "Man geht von der tatsächlichen Dauer abgeschlossener ähnlicher Projekte aus.",
      "Man fragt die Auftraggeber, wie lange sie zu warten bereit sind.",
      "Man schätzt jeden einzelnen Arbeitsschritt besonders vorsichtig.",
    ], "b",
    "\"Wie lange haben vergleichbare Projekte tatsächlich gedauert ... bis zum tatsächlichen Abschluss?\". (d) beschreibt gerade die Innenperspektive."),
  lI.choice("inference", "HARD",
    "Was will Brandstätter mit dem Vergleich mit dem Navigationsgerät verdeutlichen?",
    [
      "Planende rechnen ehrlich, gehen aber von unrealistischen Bedingungen aus.",
      "Planende verschweigen bewusst Risiken, die ihnen bekannt sind.",
      "Technische Hilfsmittel führen bei der Planung häufig in die Irre.",
      "Verzögerungen entstehen vor allem durch äußere Umstände wie den Verkehr.",
    ], "a",
    "\"Es lügt nicht, es rechnet nur mit einer Welt, die es so nicht gibt\" = keine Täuschung, aber eine verzerrte Annahme. (b) verneint sie ausdrücklich, (c) und (d) nehmen das Bild wörtlich."),
  lI.choice("detail", "HARD",
    "Warum setzen sich realistische Zeitpläne laut Brandstätter selten durch?",
    [
      "Weil sie sich mit den üblichen Methoden kaum berechnen lassen.",
      "Weil Projektleitungen für Verzögerungen persönlich haften.",
      "Weil Vergleichsdaten anderer Unternehmen meist nicht zugänglich sind.",
      "Weil bei der Entscheidung zuversichtliche Prognosen honoriert werden.",
    ], "d",
    "\"Optimismus wird also belohnt, und zwar genau in dem Moment, in dem entschieden wird\"; wer realistisch plant, gilt als Bedenkenträger."),
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

const writingItems: SeedItem[] = [
  writingTask("summary", "EASY", [180, 260],
    "Lesen Sie den folgenden Auszug aus einer Fachzeitschrift. Fassen Sie die Kernaussagen mit eigenen Worten zusammen und nehmen Sie anschließend begründet Stellung.\n\n" +
      "„Die Verlagerung von Besprechungen in Videokonferenzen hat die Zahl der Termine nicht verringert, sondern erhöht. Weil Wege entfallen, lassen sich mehr Sitzungen in einen Tag pressen, und die Hemmschwelle, jemanden einzuladen, ist gesunken. Gleichzeitig fehlen die informellen Minuten vor und nach einem Treffen, in denen früher vieles nebenbei geklärt wurde. Manche Unternehmen reagieren mit besprechungsfreien Tagen, andere mit der Regel, dass jede Einladung ein schriftliches Ziel enthalten muss. Ob solche Maßnahmen dauerhaft wirken, ist bislang kaum untersucht.“",
    [
      "Zusammenfassung der Kernaussagen ohne wörtliche Übernahme (mehr Termine, Gründe dafür, Verlust informeller Gespräche, Gegenmaßnahmen, fehlende Forschung)",
      "klare Trennung zwischen Wiedergabe und eigener Stellungnahme (z. B. Redewiedergabe, Konjunktiv I)",
      "begründete eigene Position zu mindestens einer der genannten Gegenmaßnahmen",
      "sachlicher, präziser Stil mit treffendem Wortschatz",
    ],
    NEUTRAL,
    "C2: Zusammenfassen und Bewerten eines Fachtextes. Entscheidend ist die Paraphrase mit eigenen Mitteln und die saubere Trennung von Referat und Kommentar."),
  writingTask("formal", "EASY", [250, 350],
    "Die Geschäftsleitung Ihres Unternehmens plant, eine Software einzuführen, die Tastatureingaben und Bildschirmaktivität aller Beschäftigten aufzeichnet, um „die Produktivität sichtbar zu machen“. Sie wurden als Mitglied einer Arbeitsgruppe um eine schriftliche Stellungnahme gebeten.\n\n" +
      "Schreiben Sie an die Geschäftsleitung. Gehen Sie darauf ein,\n" +
      "- welche Ziele Sie hinter dem Vorhaben nachvollziehen können,\n" +
      "- welche Bedenken Sie haben (fachlich, rechtlich oder im Hinblick auf das Betriebsklima),\n" +
      "- welche Alternative Sie vorschlagen.",
    [
      "würdigt das Anliegen der Geschäftsleitung differenziert, statt es pauschal abzulehnen",
      "formuliert mindestens zwei klar begründete Bedenken",
      "macht einen konkreten, umsetzbaren Gegenvorschlag",
      "diplomatischer, formeller Ton mit passender Anrede, Einleitung und Schluss",
    ],
    FORMAL,
    "Formelle Stellungnahme mit Kritik nach oben: Bewertet werden Diplomatie (Abschwächung, Konjunktiv II), Argumentationsqualität und Register."),
  writingTask("transformation", "MID", [50, 150],
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
    NEUTRAL,
    "Umformungsaufgabe wie Goethe C2 Schreiben Teil 1. Die Lösungen in den Inhaltspunkten sind Musterlösungen; jede bedeutungsgleiche, korrekte Lösung mit dem vorgegebenen Wort ist richtig."),
  writingTask("review", "MID", [300, 420],
    "Eine Fachzeitschrift für Ihre Branche veröffentlicht Rezensionen ihrer Leserinnen und Leser. Besprechen Sie ein Sachbuch, einen längeren Fachartikel oder einen Vortrag zu einem Thema aus der Arbeitswelt, das oder den Sie kennen.\n\n" +
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
    NEUTRAL,
    "Rezension nach Goethe C2 Schreiben Teil 2. Die Wahl des Werks ist frei; bewertet wird die Erfüllung der drei Aspekte, nicht das Werk selbst."),
  writingTask("letter", "HARD", [320, 450],
    "In einer überregionalen Zeitung ist ein Artikel mit dem Titel „Immer erreichbar: Wer abends Mails liest, ist selbst schuld“ erschienen. Darin finden sich unter anderem diese drei Aussagen:\n\n" +
      "1. „Niemand wird gezwungen, nach Feierabend das Diensthandy einzuschalten.“\n" +
      "2. „Feste Abschaltzeiten für Server sind eine bevormundende Lösung für ein individuelles Problem.“\n" +
      "3. „Wer flexibel arbeiten will, muss auch flexibel erreichbar sein.“\n\n" +
      "Schreiben Sie einen Leserbrief an die Zeitung. Nehmen Sie zu allen drei Aussagen Stellung und entwickeln Sie dabei eine eigene, begründete Position.",
    [
      "bezieht sich erkennbar auf alle drei Aussagen",
      "entwickelt eine eigene Position mit stichhaltigen Argumenten und Beispielen",
      "setzt sich mit mindestens einem Gegenargument auseinander (Einräumung, Widerlegung)",
      "textsortengerechter Leserbrief (Bezug auf den Artikel, Schluss mit Fazit), stilistisch souverän",
    ],
    "formell/sachlich (Leserbrief)",
    "Leserbrief mit drei Bezugsaussagen wie Goethe C2 Schreiben Teil 2. Für die Stufe C2 zählt neben dem Inhalt die souveräne Verknüpfung (Konzessivsätze, Nominal- und Verbalstil gezielt eingesetzt)."),
  writingTask("essay", "HARD", [320, 450],
    "Schreiben Sie eine Erörterung zu folgender Frage:\n\n" +
      "„Wird in der Arbeitswelt der Zukunft tiefes Spezialwissen oder breites Überblickswissen wertvoller sein?“\n\n" +
      "Wägen Sie beide Positionen ab, stützen Sie Ihre Argumente mit Beispielen und kommen Sie zu einem begründeten Urteil.",
    [
      "stellt beide Positionen fair und mit je mindestens zwei Argumenten dar",
      "stützt die Argumente mit konkreten Beispielen",
      "kommt zu einem eigenen, nachvollziehbar begründeten Urteil (auch ein differenziertes Sowohl-als-auch)",
      "klarer argumentativer Aufbau mit präzisen Überleitungen und breitem, idiomatischem Wortschatz",
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
    rubric: register ? { contentPoints, register } : { contentPoints },
    explanation,
  };
}

const speakingItems: SeedItem[] = [
  speakingTask("mediation", "EASY", { thinkSeconds: 60, answerSeconds: 150, maxTakes: 1 },
    "Eine neue Kollegin ohne Fachkenntnisse in Ihrem Bereich soll morgen an einer Besprechung teilnehmen. Erklären Sie ihr in etwa zwei Minuten einen komplexen Arbeitsablauf oder Fachbegriff aus Ihrem Beruf so, dass sie ihn versteht. Vermeiden Sie Fachjargon oder erklären Sie ihn.",
    [
      "wählt einen tatsächlich komplexen Sachverhalt und erklärt ihn sachlich richtig",
      "passt Wortwahl und Erklärtiefe an eine fachfremde Zuhörerin an (Beispiele, Vergleiche, Umschreibungen)",
      "klare Struktur (Überblick, Schritte, Zusammenfassung)",
      "flüssig, natürlich und kollegial im Ton",
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
    "Entspricht der Nachfrage nach dem Vortrag in Goethe C2 Sprechen Teil 1: kurze Bedenkzeit, spontane, aber differenzierte Reaktion.",
    FORMAL),
  speakingTask("presentation", "MID", { thinkSeconds: 240, answerSeconds: 300, maxTakes: 1 },
    "Halten Sie einen Vortrag von etwa fünf Minuten zum Thema „Ständige Erreichbarkeit im Beruf“. Gehen Sie von den folgenden drei Aussagen aus, setzen Sie sie zueinander in Beziehung und entwickeln Sie Ihre eigene Position.\n\n" +
      "1. „Erreichbarkeit ist heute eine Grundqualifikation, so wie Pünktlichkeit früher.“\n" +
      "2. „Wer nie abschaltet, arbeitet nicht mehr, sondern nur länger.“\n" +
      "3. „Nicht die Technik ist das Problem, sondern die unausgesprochenen Erwartungen.“",
    [
      "gibt die drei Aussagen sinngemäß wieder und deutet sie",
      "setzt die Aussagen zueinander in Beziehung (Gemeinsamkeiten, Widersprüche)",
      "entwickelt eine eigene, begründete Position mit Beispielen",
      "klarer Aufbau mit Einleitung, Überleitungen und Schluss; flüssig, präzise, stilistisch variabel",
    ],
    "Monolog nach Goethe C2 Sprechen Teil 1 (Positionen mit Zitaten abwägen). Die Aussagen sind eigens für diese Aufgabe formuliert.",
    FORMAL),
  speakingTask("discussion", "MID", { thinkSeconds: 60, answerSeconds: 180, maxTakes: 1 },
    "Ihre Gesprächspartnerin in einer Diskussionsrunde vertritt folgende These: „Fachkenntnisse kann man nachschulen, Haltung nicht. Unternehmen sollten deshalb vor allem nach Persönlichkeit einstellen.“\n\n" +
      "Nehmen Sie Stellung. Gehen Sie auf die These ein, wägen Sie Vor- und Nachteile ab und machen Sie deutlich, wo Sie zustimmen und wo nicht.",
    [
      "nimmt erkennbar Bezug auf die These und ihre Begründung",
      "wägt Vor- und Nachteile ab und unterscheidet Zustimmung von Widerspruch",
      "stützt die Position mit Beispielen oder Erfahrungen",
      "souveräne Gesprächsstrategien (Einräumen, Relativieren, Zuspitzen) und sicheres Register",
    ],
    "Interaktiver Teil nach Goethe C2 Sprechen Teil 2. Bewertet wird die Differenziertheit der Stellungnahme, nicht die Position.",
    FORMAL),
  speakingTask("presentation", "HARD", { thinkSeconds: 300, answerSeconds: 300, maxTakes: 1 },
    "Halten Sie einen Vortrag von etwa fünf Minuten zum Thema „Was ist gute Arbeit?“. Gehen Sie von den folgenden drei Aussagen aus, wägen Sie sie gegeneinander ab und kommen Sie zu einem eigenen Urteil.\n\n" +
      "1. „Gute Arbeit erkennt man daran, dass man sie messen kann.“\n" +
      "2. „Gute Arbeit ist die, die man auch dann sorgfältig erledigt, wenn niemand hinsieht.“\n" +
      "3. „Ob Arbeit gut ist, entscheidet nicht, wer sie tut, sondern wer von ihr lebt.“",
    [
      "erfasst die unterschiedlichen Perspektiven der drei Aussagen (Messbarkeit, Ethos, Nutzen für andere)",
      "wägt die Aussagen kritisch ab und zeigt Grenzen jeder Position auf",
      "kommt zu einem eigenen, differenziert begründeten Urteil mit Beispielen",
      "rhetorisch souverän: klare Gliederung, präzise Begriffe, idiomatische und stilistisch variable Sprache",
    ],
    "Anspruchsvollere Variante des C2-Monologs: abstraktes Thema, Aussagen mit unterschiedlichen Wertmaßstäben. Die Aussagen sind eigens formuliert und keinem Autor zugeordnet.",
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
    "Soziolinguistische Angemessenheit auf C2-Niveau: Widerspruch nach oben, der klar in der Sache, aber gesichtswahrend in der Form ist.",
    FORMAL),
];

export const C2_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = {
  grammar: { stimuli: [], items: grammarItems },
  reading: { stimuli: readingStimuli, items: readingItems },
  listening: { stimuli: listeningStimuli, items: listeningItems },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
