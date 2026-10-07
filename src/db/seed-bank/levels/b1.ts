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
 * B1 starter bank, written against docs/EXAM-BANK-RESEARCH.md (section B1).
 *
 * Grammar: 24 items (8 EASY, 8 MID, 8 HARD) plus one C-test. Reading: 4 texts
 * with 4 items each. Listening: 3 clips with 4 items each. Writing and
 * speaking: 6 prompts each. Single-choice items have 3 options (Goethe B1
 * format); the correct option is given first and placed at `pos`, so the key
 * positions are set explicitly and spread over a, b and c.
 */

const LEVEL = "B1" as const;

type Within = NonNullable<SeedItem["within"]>;
type Pos = 0 | 1 | 2;

const IDS = ["a", "b", "c"] as const;

function options(correct: string, distractors: [string, string], pos: Pos) {
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
  distractors: [string, string],
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
    "fuhr", ["fahrte", "fährte"], 1,
    "„fahren“ ist ein starkes Verb, das Präteritum lautet „fuhr“. „fahrte“ und „fährte“ sind falsche Analogieformen."),
  choice("passiv.praesens", "EASY",
    "In unserer Firma ___ die Post jeden Morgen um neun Uhr verteilt.",
    "wird", ["werden", "hat"], 0,
    "Vorgangspassiv Präsens: werden + Partizip II. „die Post“ ist Singular, also „wird“; „hat“ bildet kein Passiv."),
  choice("infinitiv.umzu", "EASY",
    "Sie spart seit Monaten Geld, ___ im Sommer eine lange Reise zu machen.",
    "um", ["damit", "dass"], 2,
    "Finalsatz mit Infinitiv: „um ... zu“. „damit“ und „dass“ leiten einen Nebensatz mit konjugiertem Verb ein, nicht einen zu-Infinitiv."),
  choice("konnektor.als-wenn", "EASY",
    "___ ich vor drei Jahren nach Hamburg kam, kannte ich dort niemanden.",
    "Als", ["Wenn", "Wann"], 1,
    "Ein einmaliges Ereignis in der Vergangenheit verlangt „als“. „wenn“ steht für Wiederholung oder Gegenwart/Zukunft, „wann“ ist ein Fragewort."),
  choice("konjunktiv2", "EASY",
    "Leider habe ich kein Auto. Wenn ich eins ___, könnte ich dich vom Bahnhof abholen.",
    "hätte", ["hatte", "hättest"], 0,
    "Irrealer Bedingungssatz (es gibt kein Auto): Konjunktiv II „hätte“. „hatte“ ist Indikativ Präteritum, „hättest“ passt nicht zu „ich“."),
  choice("relativsatz", "EASY",
    "Das ist die Kollegin, ___ ich gestern in der Kantine getroffen habe.",
    "die", ["der", "den"], 2,
    "„treffen“ verlangt den Akkusativ; Bezugswort feminin („die Kollegin“), also Relativpronomen „die“. „der“ wäre Dativ, „den“ maskulin."),
  gapTyped("infinitiv.zu", "EASY",
    "Ergänzen Sie das fehlende Wort.\n\nHast du Lust, am Samstag mit uns ins Kino {{g1}} gehen?",
    ["zu"],
    "Nach „Lust haben“ folgt ein Infinitiv mit „zu“: „Lust haben, ... zu gehen“."),
  gapTyped("futur1", "EASY",
    "Ergänzen Sie die richtige Form des Verbs in Klammern.\n\nKeine Sorge, ich {{g1}} (werden) dir morgen beim Umzug helfen. Das verspreche ich dir.",
    ["werde"],
    "Futur I für ein Versprechen: werden + Infinitiv. Zu „ich“ gehört „werde“."),

  // ---------------------------------------------------------------- MID
  choice("plusquamperfekt", "MID",
    "Nachdem wir das Formular ausgefüllt ___, gaben wir es am Schalter ab.",
    "hatten", ["haben", "waren"], 0,
    "Hauptsatz im Präteritum, die frühere Handlung im nachdem-Satz steht im Plusquamperfekt. „ausfüllen“ bildet das Perfekt mit „haben“, also „hatten“."),
  choice("passiv.modal", "MID",
    "Die Rechnung muss bis Freitag ___ werden.",
    "bezahlt", ["bezahlen", "gebezahlt"], 1,
    "Passiv mit Modalverb: Modalverb + Partizip II + „werden“. Verben auf be- bilden das Partizip ohne ge-: „bezahlt“."),
  choice("relativsatz.praeposition", "MID",
    "Das ist das Projekt, ___ wir seit Monaten arbeiten.",
    "an dem", ["an das", "dem"], 2,
    "„arbeiten an + Dativ“: Die Präposition steht vor dem Relativpronomen, „das Projekt“ ist neutral, also „an dem“."),
  gapSelect("konnektor.zweiteilig", "MID",
    "Wählen Sie das passende Wort.\n\nLeider habe ich {{g1}} Zeit noch Geld für einen langen Urlaub.",
    "weder", ["nicht", "kein"], 1,
    "Der zweiteilige Konnektor lautet „weder ... noch“ (= nicht A und nicht B). „noch“ im Satz verlangt „weder“."),
  choice("adjektivdeklination", "MID",
    "Sie wohnt jetzt in einer ___ Wohnung im Stadtzentrum.",
    "kleinen", ["kleine", "kleiner"], 0,
    "„in“ + Dativ (wo?), feminin nach unbestimmtem Artikel „einer“: Adjektivendung „-en“."),
  choice("pronominaladverb", "MID",
    "Freust du dich schon auf den Urlaub? Ja, ich freue mich sehr ___.",
    "darauf", ["worauf", "dafür"], 1,
    "„sich freuen auf“ + Sache wird durch „darauf“ ersetzt. „worauf“ ist ein Fragewort, „dafür“ hat die falsche Präposition."),
  choice("genitiv.praeposition", "MID",
    "___ des Regens haben wir einen langen Spaziergang gemacht.",
    "Trotz", ["Obwohl", "Trotzdem"], 2,
    "Vor einer Nominalgruppe im Genitiv steht die Präposition „trotz“. „obwohl“ leitet einen Nebensatz ein, „trotzdem“ ist ein Adverb."),
  gapTyped("n-deklination", "MID",
    "Ergänzen Sie das Wort in Klammern in der richtigen Form.\n\nGestern habe ich lange mit unserem neuen {{g1}} (Kollege) gesprochen.",
    ["Kollegen"],
    "„mit“ + Dativ; „Kollege“ gehört zur n-Deklination und bekommt außer im Nominativ Singular die Endung -n: „dem Kollegen“."),

  // ---------------------------------------------------------------- HARD
  choice("konnektor.konzessiv", "HARD",
    "Er war sehr müde. ___ ging er nach der Arbeit noch ins Fitnessstudio.",
    "Trotzdem", ["Obwohl", "Weil"], 2,
    "Das Verb steht direkt nach der Lücke (Position 2), also braucht man ein Adverb: „trotzdem“. „obwohl“ und „weil“ verlangen das Verb am Satzende."),
  choice("infinitiv.ohnezu", "HARD",
    "Er hat den Vertrag unterschrieben, ___ ihn vorher genau zu lesen.",
    "ohne", ["ohne dass", "damit"], 0,
    "Infinitivkonstruktion „ohne ... zu“. „ohne dass“ und „damit“ verlangen einen Nebensatz mit Subjekt und konjugiertem Verb."),
  choice("passiv.perfekt", "HARD",
    "Das alte Rathaus ist im Jahr 1890 gebaut ___.",
    "worden", ["geworden", "gewesen"], 1,
    "Passiv Perfekt: sein + Partizip II + „worden“. Im Passiv verliert das Partizip von „werden“ das ge-."),
  choice("konjunktiv2", "HARD",
    "Wenn ich du ___, würde ich das Angebot annehmen.",
    "wäre", ["bin", "war"], 2,
    "Ratschlag als irrealer Vergleich: „Wenn ich du wäre, ...“ mit Konjunktiv II von „sein“."),
  choice("relativsatz.was", "HARD",
    "Er hat die Prüfung beim ersten Mal bestanden, ___ alle überrascht hat.",
    "was", ["das", "dass"], 0,
    "Bezieht sich der Relativsatz auf den ganzen Hauptsatz, steht „was“. „dass“ hätte hier kein Subjekt, „das“ hat kein neutrales Bezugswort."),
  choice("konnektor.temporal", "HARD",
    "___ ich in Deutschland lebe, spreche ich jeden Tag Deutsch.",
    "Seit", ["Als", "Bis"], 1,
    "Ein Zustand, der in der Vergangenheit begonnen hat und noch andauert: „seit“ mit Präsens. „als“ verlangt Vergangenheit, „bis“ nennt einen Endpunkt."),
  gapSelect("konnektor.temporal", "HARD",
    "Wählen Sie das passende Wort.\n\nBitte schalten Sie alle Computer aus, {{g1}} Sie am Abend das Büro verlassen.",
    "bevor", ["nachdem", "seit"], 2,
    "Das Ausschalten geschieht vor dem Verlassen des Büros: „bevor“. Nach dem Verlassen kann man nichts mehr ausschalten; „seit“ passt nicht zu einem einmaligen Ereignis."),
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
    // g8: "an dem Handy" is also possible; g15: gender-inclusive forms are equally correct.
    variants: { 8: ["n"], 15: ["ehmerinnen", "ehmenden"] },
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
      distractors: [string, string],
      pos: Pos,
      explanation: string,
    ): SeedItem {
      return { ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...options(correct, distractors, pos) };
    },
    tfng(
      skill: ReadingSkill,
      within: Within,
      statements: Array<[string, TfngValue]>,
      explanation: string,
      prompt = "Richtig (R), falsch (F) oder steht nicht im Text (NG)?",
    ): SeedItem {
      return {
        ...base(skill, within, prompt, explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", statements: statements.map(([text], i) => ({ id: `s${i + 1}`, text })) },
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

// ---- Text 1: personal email (Goethe B1 Lesen Teil 1 type)

const rEmail = readingText(
  "v2-r-b1-neue-stelle",
  "Eine E-Mail von Amira",
  "Arbeit",
  `
Lieber Jonas,

entschuldige, dass ich mich so lange nicht gemeldet habe. Seit dem ersten März arbeite ich bei einer Firma, die Fahrräder herstellt, und die ersten Wochen waren ziemlich anstrengend. Ich bin im Kundenservice und beantworte Anfragen von Fahrradgeschäften, vor allem am Telefon. Am Anfang hatte ich ein bisschen Angst vor diesen Gesprächen, weil die Kunden oft sehr schnell sprechen und viele Fachwörter benutzen. Inzwischen geht es aber viel besser.

Meine Kolleginnen und Kollegen sind sehr nett. In der ersten Woche hat mir eine ältere Kollegin, Frau Petrović, alles gezeigt. Sie arbeitet schon seit fünfzehn Jahren in der Firma und kennt jedes Produkt. Wenn ich eine Frage habe, kann ich immer zu ihr kommen. Das hilft mir sehr.

Was mir weniger gefällt, ist der Weg zur Arbeit. Die Firma liegt am Stadtrand, und mit Bus und Bahn brauche ich fast eine Stunde. Deshalb überlege ich, ob ich mir ein E-Bike kaufe. Mitarbeiter bekommen nämlich einen günstigen Preis, und mit dem Rad wäre ich in vierzig Minuten da. Außerdem hätte ich dann jeden Tag ein bisschen Bewegung.

Im Herbst soll ich an einer Weiterbildung teilnehmen. Dort lerne ich, wie man Reklamationen bearbeitet, also Beschwerden von Kunden. Ich bin gespannt, denn das ist für mich ein ganz neues Thema.

Und wie geht es dir? Hast du die Stelle in Leipzig bekommen, von der du mir im Winter erzählt hast? Wenn du im Sommer Zeit hast, kannst du mich gern besuchen. Dann zeige ich dir die Stadt, und vielleicht machen wir zusammen eine Radtour.

Liebe Grüße
Amira
`,
);
const email = forText(rEmail.key);

// ---- Text 2: press report (Goethe B1 Lesen Teil 2 type)

const rArtikel = readingText(
  "v2-r-b1-deutschkurs-betrieb",
  "Deutsch lernen in der Arbeitszeit",
  "Aus- und Weiterbildung",
  `
Deutsch lernen in der Arbeitszeit

Bei der Firma Nordlicht Logistik hört man in der Mittagspause viele Sprachen: Polnisch, Arabisch, Türkisch, Spanisch. Etwa ein Drittel der 180 Mitarbeiterinnen und Mitarbeiter ist erst in den letzten Jahren nach Deutschland gekommen. Viele von ihnen arbeiten im Lager, wo sie Pakete packen und Lieferungen kontrollieren.

Seit einem Jahr bietet die Firma einen eigenen Deutschkurs an. Zweimal pro Woche kommt eine Lehrerin ins Haus, und der Unterricht findet in der Arbeitszeit statt. „Nach einem langen Arbeitstag noch abends in einen Kurs zu gehen, ist für viele unmöglich“, erklärt Personalleiterin Sandra Meyer. „Viele haben Kinder oder einen zweiten Job. Deshalb haben wir den Kurs in den Arbeitstag gelegt.“ Die Gruppe hat acht Plätze, und das Interesse ist groß: Für den nächsten Kurs gibt es schon eine Warteliste.

Im Unterricht geht es nicht um Grammatik aus dem Lehrbuch, sondern um die Sprache, die man im Lager wirklich braucht: Sicherheitsregeln, Gespräche mit Fahrern, Formulare. Die Teilnehmer bringen oft auch eigene Fragen aus dem Alltag mit, zum Beispiel einen Brief vom Vermieter.

Am Anfang waren nicht alle Abteilungsleiter begeistert. Wenn acht Leute zwei Stunden fehlen, muss die Arbeit anders verteilt werden. Inzwischen sehen das die meisten anders. „Es gibt weniger Missverständnisse und weniger Fehler bei den Lieferungen“, sagt Lagerleiter Thomas Berger. „Das spart am Ende Zeit.“

Auch für die Teilnehmer hat sich viel verändert. Jusuf Haddad, der seit zwei Jahren im Lager arbeitet, hat mit Hilfe des Kurses eine wichtige Prüfung für seine Arbeit bestanden. „Vorher habe ich die Fragen gar nicht verstanden“, erzählt er. Nächstes Jahr möchte er sich als Schichtleiter bewerben.

Die Kosten für den Kurs trägt die Firma. Ganz billig ist das nicht, aber Sandra Meyer ist sicher, dass sich das Geld lohnt: „Wer sich bei uns wohlfühlt, bleibt auch länger.“ Im Herbst soll ein zweiter Kurs für Fortgeschrittene beginnen.
`,
);
const artikel = forText(rArtikel.key);

// ---- Text 3: ads, matching with "no ad fits" (Goethe B1 Lesen Teil 3 type)

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
Telefonieren, E-Mails schreiben, an Besprechungen teilnehmen. Intensivkurs vormittags, Montag bis Freitag, vier Wochen lang.

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

// ---- Text 4: terms and rules (Goethe B1 Lesen Teil 5 type)

const rRegeln = readingText(
  "v2-r-b1-teilnahmebedingungen",
  "Teilnahmebedingungen einer Sprachschule",
  "Aus- und Weiterbildung",
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

const readingItems: SeedItem[] = [
  // ---- Text 1
  email.choice("gist", "EASY",
    "Warum schreibt Amira diese E-Mail?",
    "Sie erzählt von ihrer neuen Arbeit und fragt, wie es Jonas geht.",
    [
      "Sie bittet Jonas um Hilfe bei der Suche nach einer neuen Stelle.",
      "Sie lädt Jonas zu einer Weiterbildung im Herbst ein.",
    ],
    0,
    "Der größte Teil der E-Mail beschreibt die neue Stelle; am Ende fragt Amira nach Jonas und seiner Bewerbung. Die Weiterbildung macht sie selbst."),
  email.tfng("detail", "MID",
    [
      ["Die Telefongespräche mit Kunden waren für Amira am Anfang schwierig.", "R"],
      ["Frau Petrović hat erst vor Kurzem in der Firma angefangen.", "F"],
      ["Die Weiterbildung findet in einer anderen Stadt statt.", "NG"],
    ],
    "Amira hatte „Angst vor diesen Gesprächen“ (R); Frau Petrović arbeitet „seit fünfzehn Jahren“ dort (F); wo die Weiterbildung stattfindet, steht nicht im Text (NG)."),
  email.choice("detail", "MID",
    "Warum denkt Amira über ein E-Bike nach?",
    "Sie wäre schneller bei der Arbeit und hätte mehr Bewegung.",
    [
      "Die Firma verlangt, dass alle Mitarbeiter mit dem Rad kommen.",
      "Es fahren am Stadtrand keine Busse mehr.",
    ],
    2,
    "Mit dem Rad wäre sie „in vierzig Minuten da“ statt fast einer Stunde, und sie „hätte jeden Tag ein bisschen Bewegung“. Der günstige Preis ist ein Angebot, keine Pflicht."),
  email.choice("inference", "HARD",
    "Was erfährt man aus der E-Mail über Jonas?",
    "Er hat sich vor einiger Zeit um eine Stelle beworben.",
    [
      "Er wohnt in derselben Stadt wie Amira.",
      "Er kennt Frau Petrović schon lange.",
    ],
    1,
    "Amira fragt, ob er „die Stelle in Leipzig bekommen“ hat, von der er im Winter erzählt hat. Sie lädt ihn zu einem Besuch ein und will ihm die Stadt zeigen, also wohnt er nicht dort."),

  // ---- Text 2
  artikel.choice("gist", "EASY",
    "Worum geht es in dem Artikel hauptsächlich?",
    "Um einen Deutschkurs, den eine Firma während der Arbeitszeit anbietet",
    [
      "Um Probleme von neuen Mitarbeitern bei der Wohnungssuche",
      "Um eine Sprachschule, die abends Kurse für Lagerarbeiter anbietet",
    ],
    1,
    "Der ganze Text beschreibt den firmeneigenen Deutschkurs „in der Arbeitszeit“. Der Brief vom Vermieter ist nur ein Beispiel; abends findet gerade kein Kurs statt."),
  artikel.choice("detail", "MID",
    "Warum findet der Kurs während der Arbeitszeit statt?",
    "Weil viele Mitarbeiter abends keine Zeit für einen Kurs haben.",
    [
      "Weil die Lehrerin abends in einer anderen Schule arbeitet.",
      "Weil die Abteilungsleiter das so gewünscht haben.",
    ],
    0,
    "Die Personalleiterin sagt, ein Kurs am Abend sei „für viele unmöglich“ (Kinder, zweiter Job). Die Abteilungsleiter waren am Anfang sogar dagegen."),
  artikel.choice("structure", "HARD",
    "„Inzwischen sehen das die meisten anders.“ Worauf bezieht sich „das“?",
    "darauf, dass Kursteilnehmer zwei Stunden bei der Arbeit fehlen",
    [
      "darauf, dass im Lager viele Sprachen gesprochen werden",
      "darauf, dass es weniger Fehler bei den Lieferungen gibt",
    ],
    2,
    "Der Satz davor nennt das Problem der Abteilungsleiter: Wenn acht Leute zwei Stunden fehlen, muss die Arbeit anders verteilt werden. Die weniger Fehler sind der Grund für die neue Sicht, nicht ihr Gegenstand."),
  artikel.tfng("detail", "MID",
    [
      ["Im Kurs lernen die Teilnehmer vor allem Deutsch, das sie im Beruf brauchen.", "R"],
      ["Die Teilnehmer bezahlen einen Teil der Kurskosten selbst.", "F"],
      ["Der neue Kurs im Herbst ist auch für Mitarbeiter anderer Firmen offen.", "NG"],
    ],
    "Es geht um „die Sprache, die man im Lager wirklich braucht“ (R); „Die Kosten für den Kurs trägt die Firma“ (F); wer am Herbstkurs teilnehmen darf, steht nicht im Text (NG)."),

  // ---- Text 3
  anzeigen.match("detail", "MID",
    "Lesen Sie die Situationen. Welche Anzeige passt? Jede Anzeige passt höchstens einmal. Wenn keine Anzeige passt, wählen Sie „Keine Anzeige passt“.",
    [
      "Elif muss in ihrer neuen Stelle mit Tabellen arbeiten, kennt sich aber mit dem Computer kaum aus. Sie hat nur abends Zeit.",
      "Marco möchte sich bewerben und ist unsicher, ob seine Unterlagen gut genug sind. Er hat zurzeit keine Arbeit.",
      "Frau Nowak hat ihr Diplom im Ausland gemacht. Ein Arbeitgeber möchte es auf Deutsch sehen.",
      "Herr Osei beginnt bald in einem Kindergarten. Vorher soll er lernen, was man bei einem Unfall tun muss. Unter der Woche arbeitet er.",
    ],
    ADS,
    [1, 3, 7, 5],
    "Elif: A (Excel, abends; H ist Buchhaltung). Marco: C (Unterlagen prüfen, kostenlos für Arbeitssuchende; B macht nur Fotos). Frau Nowak: G (Übersetzung von Diplomen). Herr Osei: E (Erste Hilfe, samstags)."),
  anzeigen.match("inference", "HARD",
    "Lesen Sie die Situationen. Welche Anzeige passt? Jede Anzeige passt höchstens einmal. Wenn keine Anzeige passt, wählen Sie „Keine Anzeige passt“.",
    [
      "Ayşe spricht schon gut Deutsch, möchte aber sicherer werden, wenn sie mit Kunden telefoniert. Sie hat im Moment tagsüber viel Zeit.",
      "Daniel muss für seine Arbeit besser Englisch sprechen. Er hat aber nur sonntags frei.",
      "Lina arbeitet im Schichtdienst und möchte später in der Buchhaltung arbeiten. Feste Kurszeiten passen nicht zu ihren Schichten.",
    ],
    ADS,
    [4, 9, 8],
    "Ayşe: D (Telefonieren, vormittags). Daniel: keine Anzeige, denn der Englischkurs F ist samstags. Lina: H (Online-Kurs, „wann und wo Sie wollen“)."),
  anzeigen.tfng("detail", "EASY",
    [
      ["Im Computerkurs (A) lernen nie mehr als acht Personen zusammen.", "R"],
      ["Für den Online-Kurs (H) hat man nur vier Wochen Zeit.", "F"],
      ["Der Erste-Hilfe-Kurs (E) kostet weniger als 50 Euro.", "NG"],
    ],
    "A: „höchstens acht Personen“ (R); H: „Zwölf Wochen Zugang“ (F); ein Preis für E wird nicht genannt (NG)."),
  anzeigen.choice("detail", "MID",
    "Was bietet die Bewerbungsberatung (C) außer einem Gespräch im Büro noch an?",
    "eine Beratung per Video",
    ["Fotos für die Bewerbung", "Übersetzungen der Unterlagen"],
    2,
    "C: „Persönlich in unserem Büro oder online per Video.“ Fotos bietet B an, Übersetzungen G."),

  // ---- Text 4
  regeln.choice("detail", "EASY",
    "Wann ist Ihre Anmeldung gültig?",
    "wenn Sie die Kursgebühr bezahlt haben",
    ["wenn Sie den Einstufungstest gemacht haben", "sobald Sie sich im Sekretariat gemeldet haben"],
    0,
    "Punkt 1: „Die Anmeldung ist erst gültig, wenn Sie die Kursgebühr bezahlt haben.“"),
  regeln.choice("inference", "HARD",
    "Sie haben sich angemeldet und bezahlt. Fünf Tage vor Kursbeginn merken Sie, dass Sie nicht teilnehmen können, und Sie finden niemanden, der Ihren Platz übernimmt. Was passiert?",
    "Sie bekommen die Kursgebühr ohne 50 Euro zurück.",
    ["Sie bekommen die ganze Kursgebühr zurück.", "Sie bekommen kein Geld zurück."],
    1,
    "Punkt 3: Kostenlos ist die Abmeldung nur bis zehn Tage vorher; danach (aber vor Kursbeginn) behält die Schule 50 Euro. Kein Geld gibt es erst nach Kursbeginn."),
  regeln.tfng("detail", "MID",
    [
      ["Den Einstufungstest kann man auch zu Hause am Computer machen.", "R"],
      ["Verpasste Stunden kann man in einem anderen Kurs nachholen.", "F"],
      ["Eine Prüfung kostet 150 Euro.", "NG"],
    ],
    "Punkt 2: „auch online möglich“ (R); Punkt 4: „Verpasste Stunden können nicht nachgeholt werden“ (F); Punkt 6 nennt keinen Preis (NG)."),
  regeln.choice("vocabulary", "MID",
    "„Verpasste Stunden können nicht nachgeholt werden.“ Was bedeutet „nachholen“ hier?",
    "etwas später machen, was man nicht machen konnte",
    ["etwas von einer anderen Person abholen lassen", "etwas noch einmal bezahlen"],
    2,
    "„nachholen“ = etwas Versäumtes zu einem späteren Zeitpunkt machen. Auch Punkt 5 benutzt das Wort so: Die ausgefallene Stunde wird am Ende des Kurses nachgeholt."),
];

// ================================================================ LISTENING

type ListeningSkill = "gist" | "detail" | "attitude" | "inference";

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
      distractors: [string, string],
      pos: Pos,
      explanation: string,
    ): SeedItem {
      return { ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...options(correct, distractors, pos) };
    },
    tfng(skill: ListeningSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      return {
        ...base(skill, within, "Richtig (R), falsch (F) oder wird nicht gesagt (NG)?", explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", statements: statements.map(([text], i) => ({ id: `s${i + 1}`, text })) },
        key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, v], i) => [`s${i + 1}`, v])) },
      };
    },
  };
}

// ---- Clip 1: answerphone message (Goethe B1 Hören Teil 1 type), one voice

const lMailbox = clip(
  "v2-l-b1-erster-arbeitstag",
  "Nachricht vor dem ersten Arbeitstag",
  "Arbeit",
  [{ label: "Frau Jansen", voice: "A" }],
  [
    "Frau Jansen: Guten Tag, Herr Demir, hier spricht Katrin Jansen aus der Personalabteilung der Firma Hellmann Medizintechnik.",
    "Frau Jansen: Ich rufe wegen Ihres ersten Arbeitstages am Montag an. Wir hatten ja neun Uhr gesagt, aber bitte kommen Sie schon um halb neun. Um neun beginnt nämlich eine Sicherheitsschulung für alle neuen Mitarbeiter, und vorher bekommen Sie noch Ihre Zugangskarte.",
    "Frau Jansen: Gehen Sie bitte nicht zum Haupteingang, sondern zum Empfang in Gebäude C. Das ist das graue Haus direkt neben dem Parkplatz.",
    "Frau Jansen: Bringen Sie bitte Ihren Personalausweis und Ihre Kontonummer mit. Ihren Arbeitsvertrag haben wir schon, den brauchen Sie also nicht.",
    "Frau Jansen: Mittags können Sie in unserer Kantine essen. Am ersten Tag sind Sie natürlich unser Gast.",
    "Frau Jansen: Wenn Sie noch Fragen haben, rufen Sie mich einfach an, ich bin bis sechzehn Uhr im Büro. Bis Montag, auf Wiederhören!",
  ],
);
const mailbox = forClip(lMailbox.key);

// ---- Clip 2: guided tour in front of a group (Goethe B1 Hören Teil 2 type), one voice

const lFuehrung = clip(
  "v2-l-b1-betriebsfuehrung",
  "Führung durch eine Bäckerei",
  "Ausbildung",
  [{ label: "Herr Brandt", voice: "B" }],
  [
    "Herr Brandt: Guten Morgen und herzlich willkommen bei der Bäckerei Sommer! Ich bin Martin Brandt, ich leite hier die Ausbildung, und ich zeige Ihnen heute unseren Betrieb.",
    "Herr Brandt: Zuerst ein paar Worte zu uns. Wir sind ein Familienbetrieb, aber inzwischen ziemlich groß: Wir haben zwölf Filialen in der Region und etwa zweihundert Mitarbeiter. Jedes Jahr beginnen bei uns zehn junge Leute eine Ausbildung, die meisten als Bäcker oder im Verkauf.",
    "Herr Brandt: So, wir stehen jetzt in der Backstube. Hier beginnt die Arbeit schon um drei Uhr nachts. Ich weiß, das klingt hart. Aber dafür ist man meistens am späten Vormittag fertig und hat den ganzen Nachmittag frei. Viele von unseren Auszubildenden finden das am Ende sogar gut.",
    "Herr Brandt: Bitte fassen Sie hier nichts an, die Öfen sind sehr heiß. Und noch etwas: Alle, die hier arbeiten, tragen aus Hygienegründen eine Mütze. Für Besucher liegen am Eingang Papiermützen, die haben Sie ja schon auf.",
    "Herr Brandt: Gehen wir weiter. Hier rechts ist unser Schulungsraum. Einmal im Monat treffen sich hier alle Auszubildenden, auch die aus den Filialen. Dann üben sie zum Beispiel Verkaufsgespräche oder lernen neue Rezepte.",
    "Herr Brandt: Und zum Schluss das Wichtigste für Sie: die Bewerbung. Wir brauchen keine Mappe aus Papier, schicken Sie uns Ihre Unterlagen einfach per E-Mail. Ein gutes Zeugnis ist schön, aber noch wichtiger ist uns, dass Sie motiviert sind. Deshalb laden wir alle Bewerber zuerst zu einem Probetag ein. Da sehen Sie, ob Ihnen die Arbeit gefällt, und wir lernen Sie kennen.",
    "Herr Brandt: So, jetzt haben Sie noch Zeit für Fragen, und danach gibt es frisches Gebäck für alle.",
  ],
);
const fuehrung = forClip(lFuehrung.key);

// ---- Clip 3: conversation between colleagues (Goethe B1 Hören Teil 3 type), two voices

const lGespraech = clip(
  "v2-l-b1-teamausflug",
  "Zwei Kollegen planen einen Ausflug",
  "Arbeit",
  [
    { label: "Lena", voice: "A" },
    { label: "Murat", voice: "B" },
  ],
  [
    "Lena: Hallo Murat, hast du kurz Zeit? Es geht um den Teamausflug im Juni.",
    "Murat: Klar, setz dich. Ich dachte, Frau Weber organisiert das dieses Jahr?",
    "Lena: Eigentlich schon, aber sie ist ab nächster Woche drei Wochen im Urlaub. Deshalb hat sie mich gefragt, ob wir beide das übernehmen können.",
    "Murat: Na ja, okay. Wie viel Zeit haben wir denn?",
    "Lena: Der Ausflug ist am zwanzigsten Juni, also in gut vier Wochen. Das Budget ist dasselbe wie letztes Jahr: fünfzig Euro pro Person.",
    "Murat: Letztes Jahr waren wir doch Kanu fahren, oder? Das fanden viele toll, aber zwei Kollegen konnten nicht mitmachen, weil sie nicht schwimmen können. Das sollten wir dieses Mal besser machen.",
    "Lena: Genau, das finde ich auch. Ich hatte zuerst an einen Kletterpark gedacht, aber da gibt es das gleiche Problem. Nicht jeder klettert gern.",
    "Murat: Und wenn wir einen Kochkurs machen? Meine Schwester hat das mal mit ihrer Firma gemacht. Man kocht in kleinen Gruppen und isst am Ende zusammen. Da kann wirklich jeder mitmachen.",
    "Lena: Hm, die Idee gefällt mir. Aber wir sind fünfundzwanzig Leute. Gibt es Kochschulen für so große Gruppen?",
    "Murat: Das weiß ich nicht genau. Ich kann heute Nachmittag ein paar Kochschulen anrufen und fragen, was es kostet.",
    "Lena: Super. Und ich schicke allen eine kurze Umfrage. Wir müssen ja wissen, ob jemand kein Fleisch isst oder etwas nicht verträgt.",
    "Murat: Gute Idee. Ach, und der zwanzigste ist ein Freitag, oder? Da arbeiten einige nur bis mittags.",
    "Lena: Ja, deshalb dachte ich, wir fangen erst um vierzehn Uhr an. Dann können alle kommen.",
    "Murat: Passt. Sollen wir uns am Donnerstag noch mal treffen und alles besprechen?",
    "Lena: Donnerstag bin ich leider den ganzen Tag bei einem Kunden. Geht Mittwoch?",
    "Murat: Mittwoch nach der Teambesprechung, ja. Dann bringe ich die Preise mit.",
  ],
);
const gespraech = forClip(lGespraech.key);

const listeningItems: SeedItem[] = [
  // ---- Clip 1
  mailbox.choice("gist", "EASY",
    "Warum ruft Frau Jansen an?",
    "Sie ändert die Uhrzeit und gibt Informationen für den ersten Tag.",
    [
      "Sie lädt Herrn Demir zu einem Vorstellungsgespräch ein.",
      "Sie bittet Herrn Demir, seinen Vertrag zu unterschreiben.",
    ],
    1,
    "Herr Demir hat die Stelle schon (erster Arbeitstag, Vertrag liegt vor). Sie verschiebt den Beginn auf halb neun und erklärt, was er wissen muss."),
  mailbox.choice("detail", "EASY",
    "Wann soll Herr Demir am Montag da sein?",
    "um halb neun",
    ["um neun Uhr", "um acht Uhr"],
    0,
    "Neun Uhr war der alte Termin; jetzt soll er „schon um halb neun“ kommen, weil um neun die Schulung beginnt."),
  mailbox.choice("detail", "MID",
    "Wohin soll Herr Demir gehen?",
    "zum Empfang im Gebäude neben dem Parkplatz",
    ["zum Haupteingang der Firma", "direkt in die Personalabteilung"],
    2,
    "„nicht zum Haupteingang, sondern zum Empfang in Gebäude C ... direkt neben dem Parkplatz“."),
  mailbox.tfng("detail", "MID",
    [
      ["Herr Demir muss seinen Arbeitsvertrag mitbringen.", "F"],
      ["Am ersten Tag muss Herr Demir sein Mittagessen nicht bezahlen.", "R"],
      ["Die Sicherheitsschulung dauert bis zum Mittag.", "NG"],
    ],
    "Den Vertrag „brauchen Sie also nicht“ (F); am ersten Tag ist er „unser Gast“ (R); wie lange die Schulung dauert, wird nicht gesagt (NG)."),

  // ---- Clip 2
  fuehrung.choice("detail", "EASY",
    "Was sagt Herr Brandt über die Bäckerei?",
    "Sie hat mehrere Filialen in der Region.",
    [
      "Sie bildet jedes Jahr etwa zweihundert junge Leute aus.",
      "Sie gehört seit Kurzem zu einer großen Firma.",
    ],
    2,
    "„zwölf Filialen in der Region“. Zweihundert ist die Zahl der Mitarbeiter, Auszubildende beginnen zehn pro Jahr; es ist ein Familienbetrieb."),
  fuehrung.choice("attitude", "MID",
    "Wie beschreibt Herr Brandt die Arbeitszeit in der Backstube?",
    "Man beginnt sehr früh, hat aber dafür nachmittags frei.",
    [
      "Man arbeitet meistens bis zum späten Abend.",
      "Man kann den Beginn der Arbeit selbst wählen.",
    ],
    1,
    "Beginn um drei Uhr nachts, „dafür“ fertig am späten Vormittag und „den ganzen Nachmittag frei“. Er sieht also Nachteil und Vorteil."),
  fuehrung.tfng("detail", "MID",
    [
      ["Auch Auszubildende aus den Filialen kommen in den Schulungsraum.", "R"],
      ["Die Auszubildenden treffen sich jede Woche im Schulungsraum.", "F"],
      ["Die Treffen im Schulungsraum dauern einen ganzen Tag.", "NG"],
    ],
    "„alle Auszubildenden, auch die aus den Filialen“ (R); „Einmal im Monat“, nicht jede Woche (F); die Dauer wird nicht genannt (NG)."),
  fuehrung.choice("inference", "HARD",
    "Was ist der Bäckerei bei Bewerbern am wichtigsten?",
    "dass sie Lust auf die Arbeit haben",
    ["dass sie sehr gute Noten haben", "dass sie eine Bewerbungsmappe schicken"],
    0,
    "„Ein gutes Zeugnis ist schön, aber noch wichtiger ist uns, dass Sie motiviert sind.“ Eine Papiermappe braucht man ausdrücklich nicht."),

  // ---- Clip 3
  gespraech.choice("gist", "EASY",
    "Worüber sprechen Lena und Murat hauptsächlich?",
    "über die Planung eines gemeinsamen Ausflugs mit den Kollegen",
    [
      "über die Urlaubspläne ihrer Kollegin Frau Weber",
      "über einen Kochkurs, den Murat mit seiner Schwester machen möchte",
    ],
    0,
    "Die beiden übernehmen die Organisation des Teamausflugs. Frau Webers Urlaub ist nur der Grund dafür; die Schwester hat früher mit ihrer Firma gekocht."),
  gespraech.tfng("detail", "MID",
    [
      ["Lena und Murat organisieren den Ausflug, weil Frau Weber nicht da ist.", "R"],
      ["Für den Ausflug gibt es dieses Jahr mehr Geld pro Person als letztes Jahr.", "F"],
      ["Beim Kanufahren im letzten Jahr hat es geregnet.", "NG"],
    ],
    "Frau Weber ist „drei Wochen im Urlaub“ (R); das Budget ist „dasselbe wie letztes Jahr“ (F); über das Wetter wird nichts gesagt (NG)."),
  gespraech.choice("inference", "HARD",
    "Warum finden beide einen Kochkurs besser als Kanufahren oder einen Kletterpark?",
    "Weil wirklich alle Kollegen mitmachen können.",
    [
      "Weil ein Kochkurs weniger kostet.",
      "Weil Frau Weber einen Kochkurs vorgeschlagen hat.",
    ],
    2,
    "Beim Kanufahren konnten zwei Kollegen nicht mitmachen, und nicht jeder klettert gern; beim Kochkurs „kann wirklich jeder mitmachen“. Den Preis kennt Murat noch nicht."),
  gespraech.choice("detail", "MID",
    "Wann treffen sich Lena und Murat das nächste Mal?",
    "am Mittwoch nach der Teambesprechung",
    ["am Donnerstag", "am Freitag um vierzehn Uhr"],
    1,
    "Murat schlägt Donnerstag vor, aber Lena ist dann bei einem Kunden; sie einigen sich auf Mittwoch. Freitag um vierzehn Uhr beginnt der Ausflug."),
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
    INFORMAL,
    `Persönliche E-Mail (Goethe B1 Aufgabe 1): beschreiben, begründen, vorschlagen. ${RUBRIC_NOTE}`),
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
      "formelle Anrede (Sehr geehrte Frau Becker / Liebe Frau Becker) und Gruß",
    ],
    FORMAL,
    `Halbformelle E-Mail an eine Vorgesetzte (Goethe B1 Aufgabe 3): sich entschuldigen und um etwas bitten. ${RUBRIC_NOTE}`),
  writing("application", "MID", LONG,
    "Sie haben im Internet gelesen: Ein Supermarkt in Ihrer Stadt sucht Aushilfen für das Wochenende. Schreiben Sie eine E-Mail an Herrn Kraus von der Personalabteilung (circa 80 Wörter).\n\n" +
      "- Stellen Sie sich kurz vor.\n" +
      "- Erklären Sie, warum Sie die Stelle interessiert.\n" +
      "- Fragen Sie nach den Arbeitszeiten.\n" +
      "- Schreiben Sie, ab wann Sie anfangen können.",
    [
      "kurze Vorstellung (Person, Erfahrung oder Situation)",
      "Begründung des Interesses an der Stelle",
      "Frage nach den Arbeitszeiten",
      "möglicher Arbeitsbeginn",
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
    NEUTRAL,
    `Meinungsäußerung im Forum (Goethe B1 Aufgabe 2). ${RUBRIC_NOTE}`),
  writing("complaint", "HARD", LONG,
    "Sie haben bei einer Sprachschule einen Computerkurs gebucht. In der Anzeige stand: „kleine Gruppen, moderne Computer“. Im Kurs waren aber zwanzig Personen und viele Computer funktionierten nicht. Schreiben Sie eine Beschwerde an die Kursleitung (circa 80 Wörter).\n\n" +
      "- Beschreiben Sie, welchen Kurs Sie wann gebucht haben.\n" +
      "- Erklären Sie die Probleme.\n" +
      "- Schreiben Sie, was Sie jetzt erwarten.",
    [
      "Angaben zum gebuchten Kurs (Name, Zeitraum)",
      "beschreibt beide Probleme und den Unterschied zur Anzeige",
      "klare Forderung (z. B. Geld zurück, Ermäßigung, Ersatzkurs)",
      "formeller, sachlicher Ton mit Anrede und Schlussformel",
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

const SPEAK_NOTE = "Bewertung nach Goethe B1 Sprechen: Erfüllung, Interaktion bzw. Kohärenz, Wortschatz, Strukturen, Aussprache.";

const speakingItems: SeedItem[] = [
  speaking("introduction", "EASY", { thinkSeconds: 30, answerSeconds: 90, maxTakes: 2 },
    "Stellen Sie sich vor, Sie sind in einem Vorstellungsgespräch. Erzählen Sie etwas über sich: Wer sind Sie? Was haben Sie gelernt oder studiert? Wo haben Sie schon gearbeitet? Was können Sie besonders gut?",
    [
      "Angaben zur Person",
      "Ausbildung oder Studium",
      "bisherige Arbeitserfahrung",
      "mindestens eine Stärke mit Beispiel",
    ],
    `Monologische Selbstvorstellung im Handlungsfeld Arbeit, ca. 90 Sekunden. ${SPEAK_NOTE}`,
    FORMAL),
  speaking("request", "EASY", { thinkSeconds: 30, answerSeconds: 60, maxTakes: 2 },
    "Sie möchten nächste Woche zwei Tage frei nehmen, weil Sie einen wichtigen privaten Termin haben. Sprechen Sie mit Ihrer Teamleiterin: Bitten Sie höflich um die freien Tage, nennen Sie den Grund und machen Sie einen Vorschlag, wer Ihre Aufgaben übernehmen kann.",
    [
      "höfliche Bitte (z. B. Könnte ich ..., Wäre es möglich ...)",
      "nachvollziehbarer Grund",
      "Vorschlag zur Vertretung oder Organisation der Arbeit",
      "freundlicher Abschluss oder Frage nach der Antwort",
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
    `Gemeinsam etwas planen (Goethe B1 Sprechen Teil 1), Partnerbeitrag als Text vorgegeben. ${SPEAK_NOTE}`,
    INFORMAL),
  speaking("feedback", "MID", { thinkSeconds: 45, answerSeconds: 60, maxTakes: 2 },
    "Ein Kollege hat gerade eine kurze Präsentation gehalten: „Mit dem Fahrrad zur Arbeit“. Er hat gesagt, dass Radfahren gesund und billig ist, dass man aber bei schlechtem Wetter nass wird und in der Firma keine Dusche hat.\n\n" +
      "Geben Sie ihm eine Rückmeldung: Was hat Ihnen an seiner Präsentation gefallen? Stellen Sie ihm eine Frage zum Thema.",
    [
      "positive Rückmeldung mit Bezug auf den Inhalt",
      "eventuell eine eigene Erfahrung oder Ergänzung",
      "eine passende Frage zum Thema",
    ],
    `Rückmeldung und Frage zu einer Präsentation (Goethe B1 Sprechen Teil 3). ${SPEAK_NOTE}`,
    INFORMAL),
  speaking("presentation", "HARD", { thinkSeconds: 120, answerSeconds: 180, maxTakes: 1 },
    "Halten Sie eine kurze Präsentation zum Thema „Weiterbildung im Beruf: Sollte man regelmäßig Kurse besuchen?“ Sprechen Sie über diese fünf Punkte:\n\n" +
      "1. Stellen Sie das Thema vor.\n" +
      "2. Erzählen Sie von Ihren eigenen Erfahrungen mit Kursen oder Weiterbildungen.\n" +
      "3. Wie ist das in Ihrem Heimatland? Zahlen Firmen solche Kurse?\n" +
      "4. Nennen Sie Vor- und Nachteile und Ihre Meinung.\n" +
      "5. Schließen Sie die Präsentation ab und bedanken Sie sich.",
    [
      "Einleitung mit Thema und Aufbau",
      "eigene Erfahrung",
      "Situation im Heimatland",
      "Vor- und Nachteile mit eigener Meinung",
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
    `Meinung äußern und begründen, Diskussion im Arbeitskontext. ${SPEAK_NOTE}`),
];

export const B1_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = {
  grammar: { stimuli: [], items: grammarItems },
  reading: { stimuli: [rEmail, rArtikel, rAnzeigen, rRegeln], items: readingItems },
  listening: { stimuli: [lMailbox, lFuehrung, lGespraech], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
