import type { Cefr, ProductiveSection } from "./types";

/**
 * Level descriptors for the productive sections.
 *
 * These are our own summaries written for the grader prompt, not the published
 * CEFR scales. Each line says what the level can do and, for the criteria a
 * grader tends to misjudge, which German structures and which kinds of error
 * belong to it: a model reading six levels for six criteria needs the contrast
 * between neighbouring levels and concrete signs, not a page of prose.
 * English, because the grader prompt is English whatever language the
 * rationale is written in.
 *
 * The anchors below are short model answers per level. They are written for
 * tasks that are not in the starter bank and not in the calibration fixtures,
 * so the calibration measures the prompt and not a memory of its examples.
 */

export const CRITERIA = [
  "TASK_ACHIEVEMENT",
  "COHERENCE",
  "RANGE",
  "ACCURACY",
  "FLUENCY",
  "PRONUNCIATION",
] as const;
export type Criterion = (typeof CRITERIA)[number];

export const CRITERIA_BY_SECTION: Record<ProductiveSection, readonly Criterion[]> = {
  WRITING: ["TASK_ACHIEVEMENT", "COHERENCE", "RANGE", "ACCURACY"],
  SPEAKING: ["TASK_ACHIEVEMENT", "COHERENCE", "RANGE", "ACCURACY", "FLUENCY", "PRONUNCIATION"],
};

/** What each criterion looks at, one line, for the prompt. */
export const CRITERION_FOCUS: Record<Criterion, string> = {
  TASK_ACHIEVEMENT:
    "Does the answer do what the task asks: covers the content points, fits the purpose, register and length. Judged with the same level descriptors as the other criteria, not by how completely an easy task was done.",
  COHERENCE:
    "How ideas are ordered and linked: sentence connection, paragraphing or turn structure, reference words.",
  RANGE:
    "Breadth and precision of vocabulary and of grammatical structures actually used. What the candidate commands, not how many errors there are.",
  ACCURACY:
    "Control of grammar, word forms, word order and spelling (or word choice when spoken), judged on the structures the candidate uses. Flawless simple language is still simple language.",
  FLUENCY: "Flow and length of stretches of speech, hesitation, reformulation, pace.",
  PRONUNCIATION: "Sounds, word stress and intonation. Needs audio.",
};

export const DESCRIPTORS: Record<Criterion, Record<Cefr, string>> = {
  TASK_ACHIEVEMENT: {
    A1: "Gives a few basic facts or fixed phrases; most content points only touched or missing; the right greeting or closing may be missing.",
    A2: "Handles a simple routine message: covers the main points briefly, with little or no detail; greeting and closing present; register mostly kept.",
    B1: "Covers all content points in a straightforward way, each with a little supporting detail or a reason; register mostly right; the text type is recognisable.",
    B2: "Covers every point with relevant detail, reasons or examples and some argument; register consistent; clear text type (introduction, development, closing).",
    C1: "Develops every point fully and selectively, with arguments and examples that suit the reader and the purpose; tone adapted throughout.",
    C2: "Fulfils the task with complete ease: content, emphasis and register are judged precisely and nothing is superfluous; goes beyond listing the points.",
  },
  COHERENCE: {
    A1: "Isolated words, phrases and sentences, linked at most with und or dann; no sign of a text structure.",
    A2: "Short simple sentences joined with basic connectors (und, aber, weil, dann, danach); the order follows the task; no paragraphing.",
    B1: "A linear sequence of points that is easy to follow; a limited but working set of linking words (denn, deshalb, außerdem, zuerst, dann); an introduction and a closing.",
    B2: "Clear structure with a range of connectors and reference words (einerseits, andererseits, trotzdem, deshalb, sodass); relations between ideas are signalled; some jumpiness at most.",
    C1: "Well organised, smooth text; varied cohesive devices used naturally (indes, zumal, nämlich, dabei); paragraphs build an argument.",
    C2: "Seamless, logically structured text that guides the reader without effort; cohesion goes unnoticed; rhetorical control of emphasis and rhythm.",
  },
  RANGE: {
    A1: "A very small stock of memorised words and fixed phrases for concrete personal needs; present tense main clauses only (Ich heiße, Ich habe, Ich komme); the same words repeated.",
    A2: "Basic everyday vocabulary and simple sentence patterns: modal verbs, separable verbs, Perfekt, a simple weil, dass or wenn clause, und and aber; frequent repetition; gaps filled with simple words.",
    B1: "Enough vocabulary for familiar topics, some circumlocution; main clauses plus common subordinate clauses (weil, dass, wenn, obwohl, damit), relative clauses, zu-infinitives, Konjunktiv II for wishes and polite requests; wording plain and repetitive.",
    B2: "Good range for general and familiar abstract topics; varies the formulation; handles complex sentences with ease: passive, Konjunktiv II and indirect speech, participial attributes, nominalisations, two-part connectors; some collocations and idiom.",
    C1: "Broad lexical repertoire including idiom and abstract vocabulary; nominal style, extended participial constructions, precise word choice; can say the same thing in several ways.",
    C2: "Very broad, precise, idiomatic repertoire; fine shades of meaning, irony, understatement and register shifts without restriction.",
  },
  ACCURACY: {
    A1: "Only a few memorised forms are correct; even simple sentences often have wrong verb forms (ich wohnen), missing verbs, articles or cases; meaning gets through with effort.",
    A2: "Simple main clauses mostly right; systematic basic errors: verb position after a time phrase or in weil and dass clauses, articles and cases, Perfekt forms, adjective endings.",
    B1: "Reasonably accurate in familiar patterns and common subordinate clauses; errors in complex forms (case after prepositions, adjective endings, indirect questions, agreement) but the meaning is always clear.",
    B2: "Good grammatical control, including subordinate clauses, passive and Konjunktiv II; occasional slips that rarely impede and are often self corrected; hardly any errors in simple language.",
    C1: "Consistently high accuracy; errors are rare, minor and hard to spot; complex structures are right.",
    C2: "Near complete grammatical control, even of complex and rare structures, with attention elsewhere; no pattern of error.",
  },
  FLUENCY: {
    A1: "Very short isolated utterances with long pauses (several seconds) to search for words; mostly fixed phrases; well under 60 words a minute.",
    A2: "Short phrases with evident pauses, false starts and reformulation; roughly 60 to 90 words a minute.",
    B1: "Keeps going comprehensibly; pausing for planning and repair is noticeable in longer stretches; roughly 80 to 115 words a minute.",
    B2: "Fairly even tempo over longer stretches; few noticeably long pauses; roughly 110 to 140 words a minute.",
    C1: "Flows almost effortlessly; only a conceptually hard topic slows the pace; roughly 130 to 160 words a minute.",
    C2: "Long, natural, effortless flow; pauses sound like those of a proficient speaker choosing content.",
  },
  PRONUNCIATION: {
    A1: "Pronunciation of a small repertoire can be understood with effort by a listener used to learners.",
    A2: "Generally clear enough despite a noticeable accent; listeners sometimes ask for repetition.",
    B1: "Clearly intelligible; foreign accent and occasional mispronunciation do not block understanding.",
    B2: "Clear, natural pronunciation and intonation in most stretches.",
    C1: "Can vary intonation and stress to express finer meaning; accent does not distract.",
    C2: "Full control of sounds, stress and intonation for nuance and emphasis.",
  },
};

export type Anchor = { level: Cefr; text: string; why: string };

/**
 * One short answer per level to the same invented task, so the scale can be
 * seen: "Schreiben Sie Ihrer Freundin Anna von Ihrem letzten Urlaub." The
 * grader is told they are for the scale only and are not the answer to grade.
 */
export const WRITING_ANCHOR_TASK = "Schreiben Sie Ihrer Freundin Anna von Ihrem letzten Urlaub.";
export const WRITING_ANCHORS: Anchor[] = [
  {
    level: "A1",
    text: "Hallo Anna. Ich war in Italien. Das Wetter war gut. Ich esse Pizza. Das Hotel groß. Viele Grüße, Mia",
    why: "Learned phrases and main clauses; a verb is missing; no connector; nothing beyond the facts.",
  },
  {
    level: "A2",
    text: "Hallo Anna, letzten Sommer bin ich mit meiner Familie nach Italien gefahren. Wir haben in einem kleinen Hotel gewohnt. Das Essen war sehr lecker, aber es war oft zu heiß, weil die Sonne den ganzen Tag scheint. Danach wir sind jeden Tag zum Strand gegangen. Ich möchte nächstes Jahr wieder fahren. Liebe Grüße, Mia",
    why: "Perfekt, a weil clause, aber; plain vocabulary; the basic error in verb position after a time word (Danach wir sind).",
  },
  {
    level: "B1",
    text: "Liebe Anna, ich bin gerade aus Italien zurück und möchte dir davon erzählen. Wir waren zehn Tage an der Küste, und obwohl das Wetter nicht immer schön war, hat es uns sehr gut gefallen. Besonders gern erinnere ich mich an einen Ausflug mit dem Boot, den wir spontan gemacht haben. Nächstes Mal würde ich aber ein Hotel in der Nähe vom Strand buchen, weil wir jeden Tag lange laufen mussten. Hast du Lust, bald vorbeizukommen? Dann zeige ich dir die Fotos. Liebe Grüße, Mia",
    why: "obwohl clause, relative clause, Konjunktiv II, a question to the reader; clear and mostly accurate but plain in wording; the slips are in complex forms.",
  },
  {
    level: "B2",
    text: "Liebe Anna, wie versprochen schreibe ich dir von meinem Urlaub, der leider schon wieder vorbei ist. Zehn Tage lang haben wir an der italienischen Küste verbracht, und obwohl es mehrmals regnete, haben wir mehr gesehen, als ich erwartet hatte. Am schönsten war ein spontaner Bootsausflug, der uns zu einer Bucht brachte, die auf keiner Karte verzeichnet ist. Allerdings würde ich beim nächsten Mal ein Hotel am Strand wählen, damit uns die langen Fußwege erspart bleiben. Wenn du magst, zeige ich dir die Fotos, sobald du Zeit hast. Herzliche Grüße, Mia",
    why: "Relative clauses, Plusquamperfekt, passive-like constructions, damit and sobald clauses, varied connectors and precise wording; no real errors; the argument stays at the level of an anecdote.",
  },
  {
    level: "C1",
    text: "Liebe Anna, kaum zurück, muss ich dir unbedingt von diesem Urlaub erzählen, der mir lange in Erinnerung bleiben dürfte. Zehn Tage an der italienischen Küste, bei durchwachsenem Wetter, das dem Ganzen allerdings keinen Abbruch tat: Gerade weil wir uns spontan treiben ließen, entdeckten wir eine Bucht, die in keinem Reiseführer steht. Würde ich etwas anders machen, dann die Unterkunft, denn die täglichen Fußwege zum Strand zehrten an den Nerven. Davon abgesehen war es ein rundum gelungener Aufenthalt, über den du dir bei einem Glas Wein mehr anhand der Fotos erzählen lassen solltest. Herzlich, Mia",
    why: "Dense, idiomatic and varied (Abbruch tun, zehren an, davon abgesehen), nominal and participial style, effortless complex syntax, hardly any slip; tone and rhythm are controlled.",
  },
  {
    level: "C2",
    text: "Liebe Anna, es fällt mir schwer, den Urlaub in Worte zu fassen, ohne ins Schwärmen zu geraten, und doch will ich es versuchen. Was als bescheidener Küstenaufenthalt gedacht war, entpuppte sich dank einer kurzerhand gebuchten Bootsfahrt als Entdeckungsreise: Wir landeten in einer Bucht, die auf keiner Karte verzeichnet ist und, wie ich vermute, noch eine Weile unverzeichnet bleiben wird, wenn die Einheimischen ihr Geheimnis weiterhin so eifersüchtig hüten. Der einzige Wermutstropfen war das Hotel, das zwar freundlich, aber so weit vom Strand entfernt lag, dass wir die Wege abends bereuten. Bei Gelegenheit zeige ich dir die Bilder; sie werden dem Ort nicht gerecht, aber sie sind ein Anfang. Deine Mia",
    why: "Complete ease: irony and understatement, subtle subordination, idiom (Wermutstropfen, entpuppen), long controlled sentences with a clear rhythm, no error pattern.",
  },
];

/**
 * One short spoken answer per level (up to C1) to the same invented task, as
 * a recogniser would write it down: "Erzählen Sie von Ihrem letzten Urlaub."
 */
export const SPEAKING_ANCHOR_TASK = "Erzählen Sie von Ihrem letzten Urlaub.";
export const SPEAKING_ANCHORS: Anchor[] = [
  {
    level: "A1",
    text: "Urlaub. Ich war in Italien. Wetter gut. Ich esse Pizza. Hotel groß.",
    why: "Single phrases with long pauses; verbs missing; nothing connected.",
  },
  {
    level: "A2",
    text: "Letzten Sommer bin ich mit meiner Familie nach Italien gefahren. Wir haben in einem Hotel gewohnt. Das Essen war sehr lecker. Danach wir sind zum Strand gegangen und haben viel geschwommen.",
    why: "Perfekt and war, und; short sentences with pauses; the basic error in verb position after danach.",
  },
  {
    level: "B1",
    text: "Im Sommer war ich zehn Tage in Italien, an der Küste. Obwohl das Wetter nicht immer schön war, hat es mir sehr gut gefallen. Wir haben zum Beispiel einen Ausflug mit dem Boot gemacht, den wir nicht geplant hatten. Das nächste Mal würde ich ein Hotel am Strand buchen, weil wir jeden Tag so weit laufen mussten.",
    why: "Keeps going; obwohl, relative clause, Konjunktiv II, weil; plain wording; small slips in complex forms; some planning pauses.",
  },
  {
    level: "B2",
    text: "Letzten Sommer habe ich zehn Tage an der italienischen Küste verbracht, und ehrlich gesagt hat mich der Urlaub positiv überrascht. Obwohl es mehrmals geregnet hat, haben wir viel unternommen, besonders ein spontaner Bootsausflug zu einer Bucht, die kaum jemand kennt, ist mir in Erinnerung geblieben. Beim nächsten Mal würde ich allerdings eine Unterkunft am Strand wählen, damit man nicht jeden Tag lange laufen muss.",
    why: "Even tempo; varied subordination and connectors, precise vocabulary (positiv überraschen, unternehmen), accurate; the content stays at the level of an anecdote.",
  },
  {
    level: "C1",
    text: "Mein letzter Urlaub, zehn Tage an der italienischen Küste, hat mich ehrlich gesagt mehr überzeugt, als ich erwartet hatte. Das Wetter war durchwachsen, aber gerade weil wir uns spontan treiben ließen, haben wir eine Bucht entdeckt, die in keinem Reiseführer steht. Würde ich etwas ändern, dann die Unterkunft: Die täglichen Wege zum Strand haben mit der Zeit an den Nerven gezehrt. Davon abgesehen war es ein rundum gelungener Aufenthalt.",
    why: "Almost effortless flow; idiom (an den Nerven zehren, davon abgesehen), concessive and conditional structures without inversion errors, precise and compact.",
  },
];
