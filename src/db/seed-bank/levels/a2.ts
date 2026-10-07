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
 * A2 starter bank, written against docs/EXAM-BANK-RESEARCH.md (A2 section and
 * the item-writing rules). All texts are original.
 *
 * Closed items have three options (Goethe practice up to B2). The key position
 * is given explicitly and spread over a, b and c in every section.
 */

const LEVEL = "A2" as const;

type Within = NonNullable<SeedItem["within"]>;
type Pos = 0 | 1 | 2;
type Option3 = [string, string, string];

const IDS = ["a", "b", "c"] as const;

function choiceContent(options: Option3, correct: Pos) {
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

// ================================================================ GRAMMAR

function gChoice(skill: string, within: Within, prompt: string, options: Option3, correct: Pos, explanation: string): SeedItem {
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

/** One gap. With `choices` it is a drop-down, without it the student types. */
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
  // ---------------------------------------------------------------- EASY
  gChoice("perfekt", "EASY",
    "Am Samstag ___ wir mit dem Fahrrad an den See gefahren.",
    ["haben", "sind", "seid"], 1,
    "\"fahren\" ist ein Verb der Bewegung, das Perfekt bildet es mit \"sein\". Zu \"wir\" gehört \"sind\"; \"seid\" ist die ihr-Form."),
  gChoice("praeteritum", "EASY",
    "Gestern ___ ich keine Zeit, ich musste lange arbeiten.",
    ["habe", "hat", "hatte"], 2,
    "\"Gestern\" verlangt Vergangenheit; bei \"haben\" nimmt man meist das Präteritum: ich hatte. \"habe\" ist Präsens, \"hat\" passt nicht zu \"ich\"."),
  gChoice("dativ", "EASY",
    "Kannst du ___ bitte den Zucker geben?",
    ["mir", "mich", "meiner"], 0,
    "\"geben\": Person im Dativ, Sache im Akkusativ (den Zucker). Dativ von \"ich\" ist \"mir\"; \"mich\" ist Akkusativ."),
  gChoice("wechselpraeposition", "EASY",
    "Der Schlüssel liegt ___ Tisch.",
    ["auf den", "auf das", "auf dem"], 2,
    "\"liegen\" beschreibt eine Position (wo?), also Dativ: auf dem Tisch. \"auf den\" wäre Akkusativ (wohin?)."),
  gChoice("nebensatz", "EASY",
    "Meine Kollegin sagt, dass ___.",
    ["sie morgen später kommt", "sie kommt morgen später", "kommt sie morgen später"], 0,
    "Im dass-Satz steht das konjugierte Verb am Ende. Die anderen Optionen haben das Verb an zweiter bzw. erster Stelle."),
  gChoice("konnektor", "EASY",
    "Mein Auto ist kaputt, deshalb ___ heute mit dem Bus.",
    ["fahre ich", "ich fahre", "fahren ich"], 0,
    "Nach \"deshalb\" (Position 1) folgt das Verb, dann das Subjekt: deshalb fahre ich. \"fahren ich\" ist falsch konjugiert."),
  gChoice("komparativ", "EASY",
    "Im Sommer fahre ich ___ mit dem Fahrrad als mit dem Bus.",
    ["gerner", "am liebsten", "lieber"], 2,
    "Komparativ von \"gern\" ist unregelmäßig: gern, lieber, am liebsten. Mit \"als\" steht der Komparativ. \"gerner\" gibt es nicht."),
  gChoice("konjunktiv2", "EASY",
    "Kellner: Was möchten Sie trinken? Gast: Ich ___ gern ein Wasser.",
    ["hatte", "habe", "hätte"], 2,
    "Höfliche Bestellung mit Konjunktiv II: Ich hätte gern ... \"hatte\" ist Präteritum, \"habe gern\" bedeutet etwas anderes (etwas mögen)."),

  // ---------------------------------------------------------------- MID
  gGap("perfekt", "MID",
    "Hast du die E-Mail von Frau Weber schon {{g1}}? (lesen)",
    ["gelesen"], undefined,
    "Partizip II von \"lesen\": gelesen (ge- + Stamm + -en, unregelmäßiges Verb). Typische Fehler: gelest, gelesst."),
  gChoice("praeteritum", "MID",
    "Letzte Woche ___ Samir nicht zum Kurs kommen, er war krank.",
    ["kann", "konnte", "könnte"], 1,
    "Vergangenheit von Modalverben: Präteritum ohne Umlaut, er konnte. \"könnte\" ist Konjunktiv II, \"kann\" ist Präsens."),
  gGap("wechselpraeposition", "MID",
    "Stell die Flaschen bitte in {{g1}} Kühlschrank.",
    ["den"], ["dem", "der", "den"],
    "\"stellen\" zeigt eine Richtung (wohin?), also Akkusativ; \"Kühlschrank\" ist maskulin: in den Kühlschrank."),
  gChoice("nebensatz", "MID",
    "Die Kundin hat gefragt, ___ das Paket schon angekommen ist.",
    ["dass", "wenn", "ob"], 2,
    "Indirekte Ja/Nein-Frage: \"ob\". Nach \"fragen\" steht kein \"dass\"; \"wenn\" ist eine Bedingung oder Zeitangabe, keine Frage."),
  gGap("konnektor", "MID",
    "Ich kann heute nicht kommen, {{g1}} ich arbeiten muss.",
    ["weil"], ["denn", "weil", "deshalb"],
    "Das Verb \"muss\" steht am Ende, also ein Nebensatz: \"weil\". Nach \"denn\" stünde \"denn ich muss arbeiten\", nach \"deshalb\" Verb an Position 2."),
  gGap("komparativ", "MID",
    "Mein Deutsch ist jetzt viel {{g1}} als vor einem Jahr. (gut)",
    ["besser"], undefined,
    "Unregelmäßiger Komparativ: gut, besser, am besten. Mit \"als\" steht der Komparativ."),
  gGap("verb-praeposition", "MID",
    "Wir warten schon zwanzig Minuten {{g1}} den Bus.",
    ["auf"], ["für", "an", "auf"],
    "Feste Verbindung: warten auf + Akkusativ. \"warten für\" ist ein typischer Fehler (Einfluss aus anderen Sprachen)."),
  gGap("adjektivendung", "MID",
    "Ich suche eine {{g1}} Wohnung mit Balkon.",
    ["kleine"], ["kleinen", "kleine", "kleiner"],
    "Unbestimmter Artikel, feminin, Akkusativ: eine kleine Wohnung (Endung -e wie im Nominativ)."),

  // ---------------------------------------------------------------- HARD
  gGap("praeteritum", "HARD",
    "Wo {{g1}} ihr letztes Wochenende? Ich habe euch oft angerufen. (sein)",
    ["wart"], undefined,
    "Präteritum von \"sein\", 2. Person Plural: ihr wart. \"seid\" ist Präsens und passt nicht zu \"letztes Wochenende\"; \"ward\" ist veraltet."),
  gGap("dativ", "HARD",
    "Ich schenke {{g1}} Vater ein Buch.",
    ["meinem"], ["meinen", "meinem", "meiner"],
    "\"schenken\": Person im Dativ, Sache im Akkusativ. \"Vater\" ist maskulin, Dativ: meinem. \"meinen\" ist Akkusativ."),
  gChoice("wechselpraeposition", "HARD",
    "Ich ___ die Jacke auf das Bett.",
    ["liege", "lege", "lag"], 1,
    "\"auf das Bett\" (Akkusativ) zeigt eine Richtung, also das Handlungsverb \"legen\". \"liegen\" (liege, lag) steht mit Dativ (wo?)."),
  gChoice("nebensatz", "HARD",
    "Ich rufe dich an, wenn ___.",
    ["ich bin zu Hause", "ich zu Hause bin", "bin ich zu Hause"], 1,
    "Im wenn-Satz steht das konjugierte Verb am Ende: wenn ich zu Hause bin."),
  gChoice("konnektor", "HARD",
    "Das Wetter war schlecht. ___ sind wir spazieren gegangen.",
    ["Deshalb", "Trotzdem", "Weil"], 1,
    "Gegensatz (schlechtes Wetter, aber Spaziergang): \"trotzdem\". \"Deshalb\" drückt eine Folge aus und ergibt hier keinen Sinn; nach \"Weil\" müsste das Verb am Ende stehen."),
  gChoice("reflexiv", "HARD",
    "Vor dem Essen wasche ich ___ die Hände.",
    ["mir", "mich", "sich"], 0,
    "Gibt es schon ein Akkusativobjekt (die Hände), steht das Reflexivpronomen im Dativ: ich wasche mir die Hände. \"sich\" ist die 3. Person."),
  gChoice("adjektivendung", "HARD",
    "Ich habe einen ___ Laptop gekauft.",
    ["neuen", "neuer", "neues"], 0,
    "Unbestimmter Artikel, maskulin, Akkusativ (einen): Adjektivendung -en, einen neuen Laptop."),
  gGap("konjunktiv2", "HARD",
    "{{g1}} Sie mir bitte helfen? Die Tasche ist so schwer. (können, Konjunktiv II)",
    ["Könnten"], undefined,
    "Höfliche Bitte mit Konjunktiv II von \"können\": Könnten Sie ...? \"Konnten\" (Präteritum, ohne Umlaut) ist ein typischer Fehler."),
];

const grammarCTest = cTest(LEVEL, "MID", {
  first: "Seit einem Monat arbeite ich in einer kleinen Bäckerei in meiner Stadt.",
  body:
    "Ich stehe jeden Morgen sehr früh auf, denn wir beginnen schon um fünf Uhr. " +
    "Zuerst backen wir das Brot, dann die Kuchen. Um sieben kommen die ersten Kunden. " +
    "Nachmittags bin ich oft müde, aber ich habe früh Feierabend.",
  last: "Die Arbeit macht mir viel Spaß, und meine Kolleginnen und Kollegen helfen mir immer.",
});

// ================================================================ READING

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
    choice(skill: RSkill, within: Within, prompt: string, options: Option3, correct: Pos, explanation: string): SeedItem {
      return { ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...choiceContent(options, correct) };
    },
    tfng(skill: RSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string): SeedItem {
      return {
        ...base(skill, within, "Richtig (R), falsch (F) oder steht nicht im Text (NG)?", explanation),
        type: "TRUE_FALSE_NG",
        ...tfngContent(statements),
      };
    },
    match(
      skill: RSkill,
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

const readingText = (key: string, title: string, topic: string, body: string): SeedStimulus => ({
  key,
  section: "READING",
  level: LEVEL,
  title,
  topic,
  body: body.trim(),
});

const R_EMAIL = "v2-r-a2-email-neue-stelle";
const R_BIB = "v2-r-a2-bibliothek-abends";
const R_KURS = "v2-r-a2-weiterbildung-programm";
const R_ANZ = "v2-r-a2-anzeigen";

const readingStimuli: SeedStimulus[] = [
  readingText(R_EMAIL, "Eine E-Mail von Lena", "Arbeit", `
Liebe Aylin,

wie geht es dir? Ich habe lange nichts geschrieben, aber bei mir war viel los. Seit dem ersten Oktober arbeite ich in einer neuen Firma. Ich bin jetzt im Büro von einem Möbelhaus und schreibe Rechnungen und E-Mails an Kunden. Die Arbeit gefällt mir gut, und meine Kolleginnen und Kollegen sind sehr freundlich.

Leider ist der Weg ziemlich lang. Ich fahre jeden Tag fast eine Stunde mit der S-Bahn. Deshalb suche ich jetzt eine Wohnung näher an der Firma. Am Wochenende habe ich zwei Wohnungen angesehen, aber beide waren zu teuer.

Hast du am Samstag, dem zwölften, Zeit? Ich möchte dich gern zum Essen einladen, denn ich habe meine neue Stelle noch nicht richtig gefeiert. Wir könnten um sieben Uhr in das neue Restaurant am Marktplatz gehen. Bitte schreib mir bis Donnerstag.

Liebe Grüße
Lena
`),
  readingText(R_BIB, "Neu in der Stadtbibliothek: Lernen nach der Arbeit", "Aus- und Weiterbildung", `
Neu in der Stadtbibliothek: Lernen nach der Arbeit

Viele Menschen möchten etwas Neues lernen, haben aber tagsüber keine Zeit. Deshalb hat die Stadtbibliothek ab November auch abends geöffnet. Von Montag bis Donnerstag können Besucherinnen und Besucher bis 22 Uhr in der Bibliothek lernen. Am Freitag schließt sie wie bisher um 18 Uhr.

Im ersten Stock gibt es jetzt einen ruhigen Lernraum mit dreißig Plätzen und kostenlosem WLAN. Wer einen Computer braucht, kann dort einen Laptop für drei Stunden ausleihen. Dafür braucht man nur einen Bibliotheksausweis. Der Ausweis kostet für Erwachsene zehn Euro im Jahr. Für Schülerinnen, Schüler und Studierende ist er kostenlos.

Jeden Dienstag um 19 Uhr gibt es außerdem ein Sprachcafé. Dort sprechen Menschen aus vielen Ländern miteinander Deutsch. Eine Anmeldung ist nicht nötig. „Die Bibliothek soll ein Ort für alle sein“, sagt die Leiterin, Frau Brandt.
`),
  readingText(R_KURS, "Weiterbildung im Herbst", "Arbeit und Weiterbildung", `
Berger Logistik: Weiterbildung im Herbst

Kurs 1: Excel für Anfänger
Montag, 6. und 13. Oktober, 9 bis 12 Uhr, Raum 104
Sie lernen Tabellen und einfache Rechnungen am Computer. Bitte bringen Sie Ihren Laptop mit.

Kurs 2: Erste Hilfe im Betrieb
Mittwoch, 15. Oktober, 8 bis 16 Uhr, Kantine (Erdgeschoss)
Für alle neuen Mitarbeiterinnen und Mitarbeiter im Lager ist dieser Kurs Pflicht. Das Mittagessen ist inklusive.

Kurs 3: Deutsch am Telefon
Jeden Donnerstag im Oktober, 16 bis 17.30 Uhr, Raum 210
Für Mitarbeiterinnen und Mitarbeiter mit Deutsch als Fremdsprache. Höchstens acht Personen.

Kurs 4: Gesund am Schreibtisch
Freitag, 24. Oktober, 13 bis 14 Uhr, online
Übungen für Rücken und Augen. Sie brauchen nur einen Computer mit Kamera.

Anmeldung bis zum 1. Oktober bei Frau Demir in der Personalabteilung, Telefon 233, oder per E-Mail. Alle Kurse finden in der Arbeitszeit statt.
`),
  readingText(R_ANZ, "Kleinanzeigen: Arbeit, Lernen, Wohnen", "Arbeitssuche", `
A
Café am Stadtpark sucht Aushilfe für Samstag und Sonntag, 10 bis 18 Uhr. Erfahrung nicht nötig, freundlich sein ist wichtig! Bewerbung bitte per E-Mail.

B
Wir suchen eine Fahrerin oder einen Fahrer für Lieferungen in der Stadt. Montag bis Freitag, 7 bis 15 Uhr. Führerschein nötig. Arbeitsbeginn: sofort.

C
Ich gebe Nachhilfe in Mathematik und Englisch für Schülerinnen und Schüler der Klassen 5 bis 10. Auch online möglich. 15 Euro pro Stunde.

D
Deutschkurs am Abend (Niveau A2): dienstags und donnerstags, 18.30 bis 20 Uhr. Kleine Gruppen, die erste Stunde ist kostenlos.

E
Schöne 2-Zimmer-Wohnung, 55 Quadratmeter, mit Balkon, nah am Bahnhof. Frei ab 1. Dezember. Keine Haustiere.

F
Arztpraxis sucht Mitarbeiterin oder Mitarbeiter für die Anmeldung, 20 Stunden pro Woche, nur vormittags. Gute Deutschkenntnisse und Computerkenntnisse nötig.
`),
];

const rEmail = forText(R_EMAIL);
const rBib = forText(R_BIB);
const rKurs = forText(R_KURS);
const rAnz = forText(R_ANZ);

const readingItems: SeedItem[] = [
  // ---------------------------------------------------------------- E-Mail
  rEmail.choice("gist", "EASY",
    "Warum schreibt Lena die E-Mail?",
    [
      "Sie bittet Aylin um Hilfe bei der Wohnungssuche.",
      "Sie sagt ein Treffen am Samstag ab.",
      "Sie erzählt von ihrer Arbeit und lädt Aylin ein.",
    ], 2,
    "Lena berichtet von der neuen Stelle und lädt Aylin zum Essen ein. Die Wohnungssuche wird nur erwähnt, um Hilfe bittet sie nicht."),
  rEmail.choice("detail", "MID",
    "Was macht Lena in der neuen Firma?",
    [
      "Sie arbeitet im Büro des Möbelhauses.",
      "Sie verkauft im Geschäft Möbel an Kunden.",
      "Sie bringt Möbel zu den Kunden nach Hause.",
    ], 0,
    "Im Text: \"Ich bin jetzt im Büro von einem Möbelhaus und schreibe Rechnungen und E-Mails.\" Verkauf und Lieferung kommen nicht vor."),
  rEmail.tfng("detail", "MID",
    [
      ["Lena braucht für den Weg zur Arbeit ungefähr eine Stunde.", "R"],
      ["Lena hat schon eine günstige Wohnung gefunden.", "F"],
      ["Die Firma bezahlt Lenas Fahrkarte für die S-Bahn.", "NG"],
    ],
    "1 R: \"fast eine Stunde mit der S-Bahn\". 2 F: beide Wohnungen waren zu teuer, sie sucht noch. 3 NG: über die Fahrkarte steht nichts im Text."),
  rEmail.choice("inference", "HARD",
    "Warum möchte Lena mit Aylin essen gehen?",
    [
      "Aylin hat bald Geburtstag.",
      "Lena möchte die neue Stelle feiern.",
      "Lena möchte sich für Hilfe bedanken.",
    ], 1,
    "\"denn ich habe meine neue Stelle noch nicht richtig gefeiert\". Geburtstag und Dank werden nicht genannt."),

  // ---------------------------------------------------------------- Bibliothek
  rBib.choice("gist", "EASY",
    "Worum geht es in dem Text?",
    [
      "Die Bibliothek hat neue Öffnungszeiten und neue Angebote.",
      "Die Bibliothek sucht neue Mitarbeiterinnen und Mitarbeiter.",
      "Die Bibliothek ist ab November am Abend geschlossen.",
    ], 0,
    "Der Text informiert über längere Öffnungszeiten am Abend, den Lernraum, Laptops und das Sprachcafé."),
  rBib.tfng("detail", "MID",
    [
      ["Am Freitag kann man bis 22 Uhr in der Bibliothek lernen.", "F"],
      ["Wer einen Laptop leihen möchte, braucht einen Bibliotheksausweis.", "R"],
      ["Studierende müssen für den Ausweis nichts bezahlen.", "R"],
    ],
    "1 F: Am Freitag schließt die Bibliothek um 18 Uhr. 2 R: \"Dafür braucht man nur einen Bibliotheksausweis.\" 3 R: Für Studierende ist der Ausweis kostenlos."),
  rBib.choice("vocabulary", "MID",
    "Im Text steht: \"Eine Anmeldung ist nicht nötig.\" Was bedeutet das?",
    [
      "Man muss sich vorher telefonisch anmelden.",
      "Man kann einfach ohne Anmeldung kommen.",
      "Man kann sich leider nicht mehr anmelden.",
    ], 1,
    "\"nicht nötig\" heißt: man muss es nicht tun. Man kann also ohne Anmeldung zum Sprachcafé kommen."),
  rBib.choice("detail", "HARD",
    "Was gibt es jeden Dienstagabend in der Bibliothek?",
    [
      "Einen Kurs für Computer und Internet.",
      "Eine Führung durch die neuen Räume.",
      "Ein Treffen, bei dem man Deutsch spricht.",
    ], 2,
    "Sprachcafé am Dienstag um 19 Uhr: Menschen aus vielen Ländern sprechen miteinander Deutsch. Das Wort \"Sprachcafé\" wird in der Option umschrieben."),

  // ---------------------------------------------------------------- Weiterbildung
  rKurs.choice("detail", "EASY",
    "Sie möchten lernen, wie man am Computer mit Zahlen und Listen arbeitet. Wohin gehen Sie?",
    ["In die Kantine.", "In Raum 104.", "In Raum 210."], 1,
    "Kurs 1 (Excel, Tabellen und Rechnungen am Computer) findet in Raum 104 statt."),
  rKurs.choice("detail", "MID",
    "Wer muss den Kurs \"Erste Hilfe im Betrieb\" besuchen?",
    [
      "Alle Mitarbeiterinnen und Mitarbeiter der Firma.",
      "Nur die Mitarbeiterinnen und Mitarbeiter der Kantine.",
      "Neue Mitarbeiterinnen und Mitarbeiter im Lager.",
    ], 2,
    "\"Für alle neuen Mitarbeiterinnen und Mitarbeiter im Lager ist dieser Kurs Pflicht.\" Die Kantine ist nur der Kursort."),
  rKurs.tfng("detail", "MID",
    [
      ["Im Telefonkurs gibt es Platz für maximal acht Personen.", "R"],
      ["Für den Kurs am 24. Oktober muss man in die Firma kommen.", "F"],
      ["Die Kurse sind nach dem Ende der Arbeitszeit.", "F"],
    ],
    "1 R: \"Höchstens acht Personen.\" 2 F: Kurs 4 ist online. 3 F: \"Alle Kurse finden in der Arbeitszeit statt.\""),
  rKurs.choice("inference", "HARD",
    "Frau Okafor arbeitet donnerstags nur bis 14 Uhr und ist dann nicht mehr in der Firma. Welchen Kurs kann sie nicht besuchen?",
    ["Kurs 3", "Kurs 1", "Kurs 4"], 0,
    "Kurs 3 ist donnerstags von 16 bis 17.30 Uhr. Kurs 1 ist montags, Kurs 4 freitags und online."),

  // ---------------------------------------------------------------- Anzeigen
  rAnz.match("gist", "MID",
    "Welche Anzeige passt zu welcher Person? Für jede Person gibt es eine Anzeige. Drei Anzeigen bleiben übrig.",
    [
      "Jonas studiert von Montag bis Freitag. Am Wochenende möchte er Geld verdienen.",
      "Frau Nowak kann nur am Vormittag arbeiten. Sie kennt sich gut mit dem Computer aus.",
      "Herr Haddad arbeitet tagsüber und möchte nach der Arbeit sein Deutsch verbessern.",
    ],
    ["Anzeige A", "Anzeige B", "Anzeige C", "Anzeige D", "Anzeige E", "Anzeige F"],
    [1, 6, 4],
    "Jonas: A (Aushilfe Samstag und Sonntag). Frau Nowak: F (nur vormittags, Computerkenntnisse). Herr Haddad: D (Deutschkurs am Abend). B ist werktags, C ist ein Angebot für Schüler, E ist eine Wohnung."),
  rAnz.choice("detail", "EASY",
    "Was steht in Anzeige B?",
    [
      "Man kann sofort mit der Arbeit anfangen.",
      "Man arbeitet auch am Wochenende.",
      "Man braucht keinen Führerschein.",
    ], 0,
    "\"Arbeitsbeginn: sofort.\" Gearbeitet wird von Montag bis Freitag, ein Führerschein ist nötig."),
  rAnz.tfng("detail", "MID",
    [
      ["Die Wohnung in Anzeige E ist ab Dezember frei.", "R"],
      ["In dieser Wohnung darf man eine Katze haben.", "F"],
      ["Die Nachhilfe aus Anzeige C kann man auch am Computer machen.", "R"],
    ],
    "1 R: \"Frei ab 1. Dezember.\" 2 F: \"Keine Haustiere.\" 3 R: \"Auch online möglich.\""),
  rAnz.choice("vocabulary", "HARD",
    "In Anzeige A steht: \"Erfahrung nicht nötig\". Was bedeutet das?",
    [
      "Man muss nicht jeden Tag arbeiten.",
      "Man muss diese Arbeit vorher nicht gemacht haben.",
      "Man muss viele Jahre in einem Café gearbeitet haben.",
    ], 1,
    "\"Erfahrung\" = was man schon gemacht und gelernt hat. \"nicht nötig\": Man muss die Arbeit noch nicht kennen."),
];

// ================================================================ LISTENING

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

function lChoice(
  stimulusKey: string,
  skill: LSkill,
  within: Within,
  prompt: string,
  options: Option3,
  correct: Pos,
  explanation: string,
): SeedItem {
  return {
    section: "LISTENING",
    level: LEVEL,
    type: "SINGLE_CHOICE",
    skillTag: `listening.${skill}`,
    within,
    stimulusKey,
    prompt,
    ...choiceContent(options, correct),
    explanation,
  };
}

function lTfng(
  stimulusKey: string,
  skill: LSkill,
  within: Within,
  statements: Array<[string, TfngValue]>,
  explanation: string,
): SeedItem {
  return {
    section: "LISTENING",
    level: LEVEL,
    type: "TRUE_FALSE_NG",
    skillTag: `listening.${skill}`,
    within,
    stimulusKey,
    prompt: "Richtig, falsch oder nicht im Text? Entscheiden Sie für jede Aussage.",
    ...tfngContent(statements),
    explanation,
  };
}

const L_MAILBOX = "v2-l-a2-mailbox-vorstellungsgespraech";
const L_ABSCHIED = "v2-l-a2-abschied-planen";
const L_INTERVIEW = "v2-l-a2-interview-ausbildung";

const listeningStimuli: SeedStimulus[] = [
  clip(L_MAILBOX, "Nachricht auf der Mailbox", "Arbeitssuche",
    [{ label: "Frau Kraus", voice: "A" }],
    [
      "Frau Kraus: Guten Tag, Herr Rahimi, hier spricht Sabine Kraus von der Firma Lindner Elektro. Sie haben sich bei uns als Lagerarbeiter beworben, und wir möchten Sie gern persönlich kennenlernen.",
      "Frau Kraus: Wir hatten zuerst an Dienstag gedacht, aber da ist unser Chef leider nicht im Haus. Deshalb schlagen wir Mittwoch, den achten Oktober, vor, um halb zehn.",
      "Frau Kraus: Unsere Firma ist in der Hafenstraße siebzehn. Bitte melden Sie sich zuerst unten an der Information. Dann holt Sie jemand ab.",
      "Frau Kraus: Bringen Sie bitte Ihren Ausweis und Ihre Zeugnisse mit. Ihren Lebenslauf haben wir schon.",
      "Frau Kraus: Können Sie mich bitte kurz zurückrufen und sagen, ob der Termin passt? Meine Nummer ist null vier null, fünf fünf, drei acht, zwei eins. Ich wiederhole: null vier null, fünf fünf, drei acht, zwei eins. Vielen Dank und auf Wiederhören.",
    ]),
  clip(L_ABSCHIED, "Eine Feier im Büro planen", "Arbeit",
    [
      { label: "Mira", voice: "A" },
      { label: "Daniel", voice: "B" },
    ],
    [
      "Mira: Daniel, hast du kurz Zeit? Paula hört Ende Oktober bei uns auf, und ich möchte etwas für sie organisieren.",
      "Daniel: Gute Idee! Was möchtest du machen? Vielleicht ein Essen im Restaurant?",
      "Mira: Das habe ich auch gedacht, aber für zwanzig Leute ist das zu teuer. Ich denke, wir machen lieber ein Frühstück hier im Büro.",
      "Daniel: Okay. Und wann? Am letzten Freitag im Oktober?",
      "Mira: Nein, da hat Paula schon frei. Besser am Donnerstag davor, um neun Uhr, vor der Teambesprechung.",
      "Daniel: Gut. Soll ich das Essen einkaufen?",
      "Mira: Das macht schon Ahmet. Kannst du vielleicht ein Geschenk besorgen? Wir sammeln von allen fünf Euro.",
      "Daniel: Klar. Paula fotografiert doch so gern. Vielleicht ein schönes Buch mit Fotos aus der ganzen Welt?",
      "Mira: Super. Ich schreibe heute noch eine E-Mail an alle. Aber Paula darf natürlich nichts davon wissen.",
      "Daniel: Alles klar. Ich sage ihr kein Wort.",
    ]),
  clip(L_INTERVIEW, "Radiointerview: Eine Ausbildung mit fünfunddreißig", "Aus- und Weiterbildung",
    [
      { label: "Moderatorin", voice: "A" },
      { label: "Herr Nowak", voice: "B" },
    ],
    [
      "Moderatorin: Guten Morgen und willkommen zu unserer Sendung Arbeit heute. Bei mir im Studio ist Tomasz Nowak. Er ist fünfunddreißig Jahre alt und lernt gerade einen neuen Beruf.",
      "Moderatorin: Herr Nowak, eine Ausbildung mit fünfunddreißig, das ist nicht so typisch. Was haben Sie vorher gemacht?",
      "Herr Nowak: Ich habe zehn Jahre in einem Supermarkt gearbeitet, zuerst an der Kasse und später im Lager. Die Arbeit war okay, aber ich wollte immer gern draußen arbeiten.",
      "Moderatorin: Und jetzt werden Sie Gärtner?",
      "Herr Nowak: Ja, genau. Ich bin jetzt im zweiten Jahr, die Ausbildung dauert drei Jahre. Ich arbeite vier Tage pro Woche in einer Gärtnerei, und an einem Tag gehe ich in die Berufsschule.",
      "Moderatorin: Ist das nicht schwer, wieder in die Schule zu gehen?",
      "Herr Nowak: Am Anfang schon. Die anderen in meiner Klasse sind alle viel jünger, die meisten sind achtzehn oder neunzehn. Aber sie sind sehr nett. Manchmal helfe ich ihnen in Mathe, und dafür erklären sie mir die Programme am Computer.",
      "Moderatorin: Und wie ist es mit dem Geld?",
      "Herr Nowak: Das ist ehrlich gesagt das größte Problem. In der Ausbildung verdiene ich viel weniger als im Supermarkt. Meine Frau arbeitet aber auch, und wir haben vorher ein bisschen gespart. Es geht also.",
      "Moderatorin: Würden Sie es wieder machen?",
      "Herr Nowak: Ja, auf jeden Fall. Ich bin abends oft müde, aber ich bin zufrieden. Und später möchte ich vielleicht einmal eine eigene kleine Firma haben.",
      "Moderatorin: Vielen Dank, Herr Nowak, und viel Erfolg!",
    ]),
];

const listeningItems: SeedItem[] = [
  // ---------------------------------------------------------------- Mailbox
  lChoice(L_MAILBOX, "gist", "EASY",
    "Warum ruft Frau Kraus an?",
    [
      "Sie sagt ein Gespräch mit Herrn Rahimi ab.",
      "Sie bietet Herrn Rahimi sofort eine Stelle an.",
      "Sie möchte einen Termin für ein Gespräch machen.",
    ], 2,
    "Frau Kraus möchte Herrn Rahimi kennenlernen und schlägt einen Termin vor. Eine Absage oder ein Angebot gibt es nicht."),
  lChoice(L_MAILBOX, "detail", "MID",
    "Wann soll Herr Rahimi in die Firma kommen?",
    ["Am Dienstag um halb zehn.", "Am Mittwoch um halb zehn.", "Am Mittwoch um zehn Uhr."], 1,
    "Dienstag geht nicht, weil der Chef nicht da ist; der neue Vorschlag ist Mittwoch, halb zehn (9.30 Uhr)."),
  lChoice(L_MAILBOX, "detail", "MID",
    "Was soll Herr Rahimi mitbringen?",
    [
      "Seinen Ausweis und seine Zeugnisse.",
      "Seinen Lebenslauf und seine Zeugnisse.",
      "Nur seinen Lebenslauf.",
    ], 0,
    "Ausweis und Zeugnisse; den Lebenslauf hat die Firma schon."),
  lChoice(L_MAILBOX, "detail", "HARD",
    "Was soll Herr Rahimi machen, wenn er in der Firma ankommt?",
    [
      "Direkt ins Büro von Frau Kraus gehen.",
      "Im Lager auf den Chef warten.",
      "Zuerst zur Information gehen.",
    ], 2,
    "\"Bitte melden Sie sich zuerst unten an der Information. Dann holt Sie jemand ab.\""),

  // ---------------------------------------------------------------- Abschied
  lChoice(L_ABSCHIED, "gist", "EASY",
    "Worüber sprechen Mira und Daniel?",
    [
      "Über eine Feier für eine Kollegin.",
      "Über eine neue Kollegin im Team.",
      "Über einen Ausflug mit dem ganzen Team.",
    ], 0,
    "Paula verlässt die Firma, und die beiden planen ein Abschiedsfrühstück für sie."),
  lChoice(L_ABSCHIED, "detail", "MID",
    "Wo soll die Feier stattfinden?",
    ["In einem Restaurant.", "Im Büro.", "Bei Paula zu Hause."], 1,
    "Das Restaurant ist für zwanzig Leute zu teuer, deshalb machen sie ein Frühstück im Büro."),
  lTfng(L_ABSCHIED, "detail", "MID",
    [
      ["Die Feier ist am letzten Freitag im Oktober.", "F"],
      ["Daniel kümmert sich um ein Geschenk.", "R"],
      ["Paula soll vorher nichts von der Feier erfahren.", "R"],
    ],
    "1 F: Am Freitag hat Paula frei, die Feier ist am Donnerstag davor. 2 R: Daniel soll das Geschenk besorgen. 3 R: \"Paula darf natürlich nichts davon wissen.\""),
  lChoice(L_ABSCHIED, "inference", "HARD",
    "Warum möchte Daniel ein Buch mit Fotos schenken?",
    [
      "Paula hat sich dieses Buch gewünscht.",
      "Das Buch kostet nur fünf Euro.",
      "Das Geschenk passt zu Paulas Hobby.",
    ], 2,
    "Daniel sagt, dass Paula gern fotografiert. Die fünf Euro sammelt jede Person, das ist nicht der Preis des Buches."),

  // ---------------------------------------------------------------- Interview
  lTfng(L_INTERVIEW, "detail", "MID",
    [
      ["Herr Nowak hat früher in einem Geschäft gearbeitet.", "R"],
      ["Er ist jetzt fast am Ende seiner Ausbildung.", "F"],
      ["Er geht einmal pro Woche in die Schule.", "R"],
    ],
    "1 R: zehn Jahre im Supermarkt. 2 F: Er ist im zweiten von drei Jahren. 3 R: an einem Tag Berufsschule, vier Tage Gärtnerei."),
  lTfng(L_INTERVIEW, "detail", "MID",
    [
      ["Die anderen in seiner Klasse sind älter als er.", "F"],
      ["Herr Nowak und die jungen Leute helfen sich gegenseitig.", "R"],
    ],
    "1 F: Die anderen sind viel jünger (achtzehn oder neunzehn). 2 R: Er hilft in Mathe, sie erklären ihm die Computerprogramme."),
  lChoice(L_INTERVIEW, "detail", "MID",
    "Was ist für Herrn Nowak in der Ausbildung das größte Problem?",
    [
      "Er verdient jetzt weniger Geld als früher.",
      "Er versteht die Programme am Computer nicht.",
      "Seine Familie findet die Ausbildung nicht gut.",
    ], 0,
    "\"Das ist ehrlich gesagt das größte Problem\": Er verdient viel weniger als im Supermarkt. Bei den Computerprogrammen helfen ihm die anderen."),
  lChoice(L_INTERVIEW, "attitude", "HARD",
    "Wie denkt Herr Nowak heute über seine Entscheidung?",
    [
      "Er weiß nicht, ob sie richtig war.",
      "Er ist froh, dass er die Ausbildung macht.",
      "Er möchte wieder im Supermarkt arbeiten.",
    ], 1,
    "Er würde es \"auf jeden Fall\" wieder machen und ist zufrieden, auch wenn er abends müde ist."),
];

// ================================================================ WRITING

const INFORMAL = "informell (du)";
const SEMIFORMAL = "halbformell (Sie)";

function writingTask(
  skill: "message" | "email",
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

const INFORMAL_WORDS: [number, number] = [20, 30];
const SEMIFORMAL_WORDS: [number, number] = [30, 40];

const writingItems: SeedItem[] = [
  writingTask("message", "EASY", INFORMAL_WORDS,
    "Sie ziehen am Samstag in eine neue Wohnung. Schreiben Sie Ihrem Freund Jan eine Nachricht.\n\n" +
      "- Bitten Sie Jan um Hilfe beim Umzug.\n" +
      "- Sagen Sie, wann er kommen soll.\n" +
      "- Was machen Sie nach dem Umzug zusammen?\n\n" +
      "Schreiben Sie 20 bis 30 Wörter.",
    [
      "Bitte um Hilfe beim Umzug am Samstag",
      "Uhrzeit (und eventuell Ort/Adresse) nennen",
      "Vorschlag für danach (z. B. zusammen essen, Pizza bestellen)",
    ],
    INFORMAL,
    "Kontaktpflege wie im Goethe A2, Schreiben Teil 1. Alle drei Punkte müssen erkennbar sein; Anrede und Gruß gehören dazu."),
  writingTask("message", "EASY", INFORMAL_WORDS,
    "Ihre Kollegin Sara hat Sie für Freitagabend zum Essen eingeladen. Sie können nicht kommen. Schreiben Sie Sara eine Nachricht.\n\n" +
      "- Bedanken Sie sich für die Einladung.\n" +
      "- Warum können Sie nicht kommen?\n" +
      "- Schlagen Sie einen anderen Termin vor.\n\n" +
      "Schreiben Sie 20 bis 30 Wörter.",
    [
      "Dank für die Einladung",
      "Absage mit Grund (z. B. Termin, Besuch, krank)",
      "neuer Terminvorschlag (Tag und/oder Uhrzeit)",
    ],
    INFORMAL,
    "Erwartet werden einfache Sätze mit \"weil\" oder \"denn\" für den Grund. Fehlt ein Leitpunkt, ist die Aufgabe nur teilweise erfüllt."),
  writingTask("message", "MID", INFORMAL_WORDS,
    "Ihr Freund Can fragt: \"Wie ist deine neue Arbeit?\" Schreiben Sie Can eine Nachricht.\n\n" +
      "- Was machen Sie bei der Arbeit?\n" +
      "- Wie sind die Kolleginnen und Kollegen?\n" +
      "- Was gefällt Ihnen nicht so gut?\n\n" +
      "Schreiben Sie 20 bis 30 Wörter.",
    [
      "Tätigkeit bei der neuen Arbeit beschreiben",
      "etwas über Kolleginnen und Kollegen sagen",
      "einen Nachteil nennen (z. B. langer Weg, früh aufstehen)",
    ],
    INFORMAL,
    "Prüft Beschreiben und Bewerten im Alltag; Verben wie \"gefallen\" mit Dativ und \"aber\" oder \"trotzdem\" zeigen A2-Strukturen."),
  writingTask("email", "MID", SEMIFORMAL_WORDS,
    "Sie besuchen einen Deutschkurs bei Frau Lange. Nächste Woche können Sie nicht zum Kurs kommen. Schreiben Sie Frau Lange eine E-Mail.\n\n" +
      "- Entschuldigen Sie sich.\n" +
      "- Sagen Sie, warum Sie nicht kommen können.\n" +
      "- Fragen Sie nach den Hausaufgaben.\n\n" +
      "Schreiben Sie 30 bis 40 Wörter.",
    [
      "Entschuldigung, dass man nächste Woche fehlt",
      "Grund nennen (z. B. Arbeit, Termin, Reise)",
      "Frage nach Hausaufgaben oder Material",
    ],
    SEMIFORMAL,
    "Halbformelle Mitteilung wie im Goethe A2, Schreiben Teil 2: Anrede \"Liebe Frau Lange\" oder \"Sehr geehrte Frau Lange\", durchgehend Sie, passender Gruß."),
  writingTask("email", "HARD", SEMIFORMAL_WORDS,
    "In Ihrer Wohnung funktioniert die Heizung nicht. Schreiben Sie eine E-Mail an Ihren Vermieter, Herrn Schäfer.\n\n" +
      "- Beschreiben Sie das Problem.\n" +
      "- Seit wann gibt es das Problem?\n" +
      "- Bitten Sie um einen Termin mit einem Techniker.\n\n" +
      "Schreiben Sie 30 bis 40 Wörter.",
    [
      "Problem beschreiben (Heizung kalt / funktioniert nicht)",
      "Zeitangabe (z. B. seit Montag, seit zwei Tagen)",
      "höfliche Bitte um einen Termin, möglichst mit Konjunktiv II (Könnten Sie ...?)",
    ],
    SEMIFORMAL,
    "Handlungsregulierung im Bereich Wohnen. Für die volle Erfüllung braucht es eine klare Bitte und die formelle Anrede."),
  writingTask("email", "HARD", SEMIFORMAL_WORDS,
    "Sie möchten am nächsten Freitag einen Tag frei nehmen. Schreiben Sie eine E-Mail an Ihre Chefin, Frau Yıldız.\n\n" +
      "- Bitten Sie um einen freien Tag.\n" +
      "- Nennen Sie einen Grund.\n" +
      "- Machen Sie einen Vorschlag: Wann können Sie die Arbeit nachholen?\n\n" +
      "Schreiben Sie 30 bis 40 Wörter.",
    [
      "höfliche Bitte um einen freien Tag am Freitag",
      "Grund nennen",
      "Angebot, die Stunden oder Aufgaben an einem anderen Tag nachzuholen",
    ],
    SEMIFORMAL,
    "Arbeitskontext. Erwartet werden Höflichkeitsformen (Ich würde gern ..., Wäre das möglich?) und ein klarer Vorschlag."),
];

// ================================================================ SPEAKING

function speakingTask(
  skill: "introduction" | "monologue" | "planning" | "request",
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

const SHORT = { thinkSeconds: 30, answerSeconds: 60, maxTakes: 2 };
const LONG = { thinkSeconds: 45, answerSeconds: 90, maxTakes: 2 };

const speakingItems: SeedItem[] = [
  speakingTask("introduction", "EASY", SHORT,
    "Stellen Sie sich vor. Sprechen Sie über diese Punkte:\n\n" +
      "- Name und Wohnort\n" +
      "- Arbeit oder Ausbildung\n" +
      "- Sprachen\n" +
      "- Freizeit und Hobbys",
    [
      "Name und Wohnort",
      "Arbeit, Beruf oder Ausbildung",
      "Sprachen (welche, wie gut, seit wann Deutsch)",
      "Freizeit/Hobbys mit mindestens einem Detail",
    ],
    undefined,
    "Wie Goethe A2, Sprechen Teil 1, als Monolog. A2 zeigt sich an zusammenhängenden Sätzen und Details (seit wann, wie oft), nicht nur an Stichworten."),
  speakingTask("monologue", "MID", LONG,
    "Erzählen Sie über Ihren Alltag. Wie sieht ein normaler Arbeitstag oder Lerntag bei Ihnen aus?\n\n" +
      "- Wann stehen Sie auf?\n" +
      "- Wie kommen Sie zur Arbeit oder zum Kurs?\n" +
      "- Was machen Sie dort?\n" +
      "- Was machen Sie am Abend?",
    [
      "Tagesablauf in zeitlicher Reihenfolge (zuerst, dann, danach)",
      "Weg zur Arbeit oder zum Kurs",
      "Tätigkeiten bei der Arbeit oder im Kurs",
      "Abend oder Freizeit",
    ],
    undefined,
    "Entspricht Goethe A2, Sprechen Teil 2 (über das eigene Leben erzählen, etwa 90 Sekunden). Achten auf Verbindungswörter und trennbare Verben."),
  speakingTask("monologue", "MID", LONG,
    "Erzählen Sie über Ihr letztes Wochenende.\n\n" +
      "- Was haben Sie am Samstag gemacht?\n" +
      "- Was haben Sie am Sonntag gemacht?\n" +
      "- Mit wem waren Sie zusammen?\n" +
      "- Was hat Ihnen besonders gut gefallen?",
    [
      "Aktivitäten am Samstag im Perfekt",
      "Aktivitäten am Sonntag im Perfekt",
      "mit wem (Personen nennen)",
      "Bewertung: was gut gefallen hat und warum",
    ],
    undefined,
    "Prüft vor allem das Perfekt (haben/sein) und Präteritum von sein/haben. Häufige Fehler beim Hilfsverb sind A2-typisch, solange man versteht."),
  speakingTask("planning", "MID", SHORT,
    "Ihr Kollege Paul möchte mit Ihnen nach der Arbeit essen gehen. Er geht nicht ans Telefon. Sprechen Sie ihm eine Nachricht auf die Mailbox.\n\n" +
      "- Sagen Sie, dass Sie gern mitkommen.\n" +
      "- Schlagen Sie einen Tag und eine Uhrzeit vor.\n" +
      "- Schlagen Sie einen Ort vor.\n" +
      "- Bitten Sie Paul um eine Antwort.",
    [
      "Zusage, dass man gern mitkommt",
      "konkreter Tag und Uhrzeit",
      "Vorschlag für einen Ort (Restaurant, Kantine, Café ...)",
      "Bitte um Rückruf oder Nachricht",
    ],
    INFORMAL,
    "Ersatz für Goethe A2, Sprechen Teil 3 (gemeinsam planen) in Monologform. Vorschläge mit \"Wollen wir ...?\", \"Wie wäre es mit ...?\" oder \"Hast du Zeit ...?\"."),
  speakingTask("request", "HARD", SHORT,
    "Sie sollen am Samstag arbeiten, aber an diesem Tag haben Sie einen wichtigen Termin. Rufen Sie Ihre Chefin, Frau Berger, an.\n\n" +
      "- Erklären Sie das Problem.\n" +
      "- Bitten Sie höflich um einen anderen Arbeitstag.\n" +
      "- Machen Sie einen Vorschlag.",
    [
      "Problem nennen: Termin am Samstag",
      "höfliche Bitte, möglichst mit Konjunktiv II (Könnte ich ...? Wäre es möglich ...?)",
      "konkreter Gegenvorschlag (anderer Tag, Tausch mit Kollegin/Kollege)",
    ],
    "formell (Sie)",
    "Bitten und Vorschläge im Arbeitskontext. Volle Erfüllung nur mit erkennbar höflicher Form und konkretem Vorschlag."),
  speakingTask("monologue", "HARD", LONG,
    "Wohnen Sie lieber in der Stadt oder auf dem Land? Erzählen Sie.\n\n" +
      "- Wo wohnen Sie jetzt?\n" +
      "- Was gefällt Ihnen dort, was nicht?\n" +
      "- Wo möchten Sie später gern wohnen? Warum?",
    [
      "aktuelle Wohnsituation beschreiben",
      "Vor- und Nachteile nennen",
      "Wunsch für später mit Begründung (weil ..., denn ...)",
      "Vergleich mit Komparativ (ruhiger, teurer, lieber ...)",
    ],
    undefined,
    "Zusammenhängendes Sprechen mit Begründung und Vergleich. Komparativ und weil-Sätze sind die Zielstrukturen dieser Aufgabe."),
];

// ================================================================ EXPORT

export const A2_PARTS: {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
} = {
  grammar: { stimuli: [], items: [...grammarItems, grammarCTest] },
  reading: { stimuli: readingStimuli, items: readingItems },
  listening: { stimuli: listeningStimuli, items: listeningItems },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
