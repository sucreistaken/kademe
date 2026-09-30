import type { SeedBankPart, SeedItem, SeedStimulus } from "./types";

/**
 * Starter reading texts, three per CEFR level, each with three or four items.
 * All texts are original. Single-choice keys are spread evenly over a/b/c/d;
 * from B2 upward every level has at least one matching task.
 */

type Level = SeedItem["level"];
type Within = NonNullable<SeedItem["within"]>;
type OptionId = "a" | "b" | "c" | "d";
type Skill = "gist" | "detail" | "inference" | "vocabulary" | "structure";
type Tfng = "R" | "F" | "NG";

/** Item builders bound to one text, so level and stimulus key stay consistent. */
function forText(level: Level, stimulusKey: string) {
  const base = (skill: Skill, within: Within, prompt: string, explanation: string) => ({
    section: "READING" as const,
    level,
    skillTag: `reading.${skill}`,
    within,
    stimulusKey,
    prompt,
    explanation,
  });

  return {
    choice(
      skill: Skill,
      within: Within,
      prompt: string,
      options: [string, string, string, string],
      correct: OptionId,
      explanation: string,
    ): SeedItem {
      const ids: OptionId[] = ["a", "b", "c", "d"];
      return {
        ...base(skill, within, prompt, explanation),
        type: "SINGLE_CHOICE",
        content: { kind: "CHOICE", options: options.map((text, i) => ({ id: ids[i], text })) },
        key: { kind: "CHOICE", correct: [correct] },
      };
    },
    tfng(
      skill: Skill,
      within: Within,
      statements: Array<[string, Tfng]>,
      explanation: string,
      prompt = "Richtig (R), falsch (F) oder nicht im Text (NG)?",
    ): SeedItem {
      const ids = statements.map((_, i) => `s${i + 1}`);
      return {
        ...base(skill, within, prompt, explanation),
        type: "TRUE_FALSE_NG",
        content: { kind: "TFNG", statements: statements.map(([text], i) => ({ id: ids[i], text })) },
        key: {
          kind: "TFNG",
          answers: Object.fromEntries(statements.map(([, answer], i) => [ids[i], answer])),
        },
      };
    },
    match(
      skill: Skill,
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
        key: {
          kind: "MATCHING",
          pairs: Object.fromEntries(pairs.map((r, i) => [`l${i + 1}`, `r${r}`])),
        },
      };
    },
  };
}

const text = (
  key: string,
  level: Level,
  title: string,
  topic: string,
  body: string,
): SeedStimulus => ({ key, section: "READING", level, title, topic, body: body.trim() });

// ---------------------------------------------------------------- A1

const a1Notiz = text(
  "r-a1-notiz",
  "A1",
  "Eine Nachricht von Mama",
  "Familie und Alltag",
  `
Hallo Tim,

ich bin heute bis 18 Uhr im Büro. Das Essen ist im Kühlschrank: Nudeln mit Tomatensoße. Bitte kauf noch Brot und Milch. Das Geld liegt auf dem Tisch in der Küche.

Um 16 Uhr ruft Oma an. Sie hat morgen Geburtstag, bitte sag ihr „Alles Gute“! Und bitte mach deine Hausaufgaben vor dem Fernsehen.

Bis heute Abend!
Mama
`,
);

const a1Fahrrad = text(
  "r-a1-fahrrad",
  "A1",
  "Fahrrad zu verkaufen",
  "Kleinanzeigen",
  `
Fahrrad zu verkaufen!

Damenfahrrad, blau, drei Jahre alt, sehr guter Zustand. Mit Licht und Korb.
Preis: 120 Euro.

Das Fahrrad steht in der Gartenstraße 5 in Bonn. Sie können es am Samstag und am Sonntag von 10 bis 14 Uhr ansehen. Bitte rufen Sie vorher an: 0228 45 67 89 (Frau Weber).

Bitte keine E-Mails!
`,
);

const a1Bibliothek = text(
  "r-a1-bibliothek",
  "A1",
  "Stadtbibliothek Lindenau",
  "Freizeit und Stadt",
  `
Stadtbibliothek Lindenau

Öffnungszeiten:
Montag: geschlossen
Dienstag bis Freitag: 10 bis 19 Uhr
Samstag: 10 bis 14 Uhr
Sonntag: geschlossen

Sie können Bücher drei Wochen ausleihen. Für Kinder unter 12 Jahren ist der Bibliotheksausweis kostenlos. Erwachsene bezahlen 15 Euro im Jahr.

Bitte essen Sie nicht in der Bibliothek und telefonieren Sie nicht laut. Danke!
`,
);

const notiz = forText("A1", a1Notiz.key);
const fahrrad = forText("A1", a1Fahrrad.key);
const bibliothek = forText("A1", a1Bibliothek.key);

const a1Items: SeedItem[] = [
  notiz.choice(
    "gist",
    "EASY",
    "Warum schreibt die Mutter diese Nachricht?",
    [
      "Sie ist nicht zu Hause und sagt Tim, was er machen soll.",
      "Sie lädt Tim zu Omas Geburtstag ein.",
      "Sie ist krank und braucht Hilfe.",
      "Sie fährt heute in den Urlaub.",
    ],
    "a",
    "Die Mutter ist bis 18 Uhr im Büro und gibt Tim mehrere Aufgaben (einkaufen, Oma, Hausaufgaben).",
  ),
  notiz.choice(
    "detail",
    "EASY",
    "Was soll Tim kaufen?",
    ["Nudeln und Tomatensoße", "Brot und Milch", "Obst und Käse", "Ein Geschenk für Oma"],
    "b",
    "Im Text steht: „Bitte kauf noch Brot und Milch.“",
  ),
  notiz.tfng(
    "detail",
    "MID",
    [
      ["Die Mutter ist um 16 Uhr wieder zu Hause.", "F"],
      ["Oma hat morgen Geburtstag.", "R"],
    ],
    "Die Mutter ist bis 18 Uhr im Büro; um 16 Uhr ruft nur Oma an, und sie hat morgen Geburtstag.",
  ),
  notiz.choice(
    "detail",
    "MID",
    "Was soll Tim machen, bevor er fernsieht?",
    ["Oma anrufen", "Das Essen kochen", "Das Geld holen", "Die Hausaufgaben machen"],
    "d",
    "Im Text steht: „Bitte mach deine Hausaufgaben vor dem Fernsehen.“ Oma ruft selbst an.",
  ),

  fahrrad.choice(
    "gist",
    "EASY",
    "Was ist dieser Text?",
    [
      "Eine Einladung zu einer Fahrradtour",
      "Frau Weber sucht ein gebrauchtes Fahrrad.",
      "Frau Weber möchte ihr Fahrrad verkaufen.",
      "Ein Fahrradgeschäft macht Werbung.",
    ],
    "c",
    "Die Überschrift „Fahrrad zu verkaufen!“ und der Preis zeigen: Frau Weber verkauft ihr Fahrrad.",
  ),
  fahrrad.choice(
    "detail",
    "EASY",
    "Wann kann man das Fahrrad ansehen?",
    [
      "Jeden Tag von 10 bis 14 Uhr",
      "Nur am Samstag",
      "Am Montag nach 14 Uhr",
      "Am Wochenende von 10 bis 14 Uhr",
    ],
    "d",
    "Im Text steht: „am Samstag und am Sonntag von 10 bis 14 Uhr“.",
  ),
  fahrrad.tfng(
    "detail",
    "MID",
    [
      ["Das Fahrrad ist neu.", "F"],
      ["Man soll Frau Weber eine E-Mail schreiben.", "F"],
      ["Frau Weber hat noch ein zweites Fahrrad.", "NG"],
    ],
    "Das Fahrrad ist drei Jahre alt, man soll anrufen („Bitte keine E-Mails!“); ein zweites Fahrrad wird nicht erwähnt.",
  ),

  bibliothek.choice(
    "detail",
    "EASY",
    "An welchen Tagen ist die Bibliothek geschlossen?",
    [
      "Am Samstag und am Sonntag",
      "Am Montag und am Sonntag",
      "Nur am Montag",
      "Am Dienstag und am Freitag",
    ],
    "b",
    "Bei den Öffnungszeiten steht „geschlossen“ bei Montag und Sonntag.",
  ),
  bibliothek.choice(
    "detail",
    "EASY",
    "Wie lange kann man ein Buch ausleihen?",
    ["Eine Woche", "Zwei Wochen", "Drei Wochen", "Ein Jahr"],
    "c",
    "Im Text steht: „Sie können Bücher drei Wochen ausleihen.“",
  ),
  bibliothek.choice(
    "vocabulary",
    "MID",
    "Im Text steht: „Sie können Bücher drei Wochen ausleihen.“ Was bedeutet „ausleihen“?",
    [
      "Ein Buch für eine Zeit mitnehmen und dann zurückbringen",
      "Ein Buch kaufen",
      "Ein Buch selbst schreiben",
      "Ein Buch verschenken",
    ],
    "a",
    "Die Zeitangabe „drei Wochen“ zeigt, dass man das Buch nur für eine bestimmte Zeit bekommt.",
  ),
  bibliothek.tfng(
    "detail",
    "MID",
    [
      ["Ein Kind mit zehn Jahren bezahlt nichts für den Ausweis.", "R"],
      ["Am Samstag ist die Bibliothek bis 19 Uhr offen.", "F"],
      ["In der Bibliothek gibt es ein Café.", "NG"],
    ],
    "Für Kinder unter 12 ist der Ausweis kostenlos; samstags ist nur bis 14 Uhr offen; ein Café wird nicht genannt.",
  ),
];

// ---------------------------------------------------------------- A2

const a2Umzug = text(
  "r-a2-umzug",
  "A2",
  "Eine E-Mail von Lena",
  "Wohnen",
  `
Liebe Sara,

wie geht es dir? Ich habe tolle Neuigkeiten: Ich habe endlich eine neue Wohnung gefunden! Sie liegt in der Nähe vom Stadtpark und hat zwei Zimmer, einen kleinen Balkon und eine große Küche. Die alte Wohnung war zu klein und zu laut, weil direkt vor dem Fenster die Straßenbahn gefahren ist.

Am Samstag, dem 14. Mai, ziehe ich um. Mein Bruder bringt einen Transporter mit, aber wir brauchen noch Hilfe beim Tragen. Hast du Zeit? Wir fangen um 9 Uhr an. Mittags gibt es Pizza für alle, und am Abend möchte ich mit allen Helfern auf dem Balkon grillen.

Bitte sag mir bis Mittwoch Bescheid.

Viele Grüße
Lena
`,
);

const a2Kochkurs = text(
  "r-a2-kochkurs",
  "A2",
  "Information der Volkshochschule",
  "Weiterbildung",
  `
Volkshochschule Neustadt: Wichtige Information

Der Kochkurs „Schnelle Küche aus Italien“ beginnt nicht wie geplant am 3. März, sondern erst eine Woche später, am 10. März. Der Grund: Unsere Kursleiterin, Frau Rossi, ist leider krank.

Der Kurs findet wie immer donnerstags von 18 bis 21 Uhr in der Schulküche (Raum 104) statt. Bitte bringen Sie eine Schürze und eine Dose für die Reste mit. Die Lebensmittel sind im Kurspreis von 85 Euro schon enthalten.

Wenn Sie am neuen Termin keine Zeit haben, bekommen Sie Ihr Geld zurück. Rufen Sie dafür bitte bis zum 5. März im Büro an: 06321 88 40.
`,
);

const a2Schulgarten = text(
  "r-a2-schulgarten",
  "A2",
  "Gemüse vom Schuldach",
  "Schule und Natur",
  `
Gemüse vom Schuldach

An der Goethe-Schule in Kassel lernen die Kinder nicht nur Mathe und Deutsch. Seit einem Jahr gibt es auf dem Dach der Schule einen Garten. Dort wachsen Tomaten, Salat, Kräuter und sogar Erdbeeren. Jede Klasse hat ein eigenes Beet und kümmert sich einmal pro Woche darum. In den Sommerferien gießen Eltern und Lehrer die Pflanzen.

„Viele Kinder wussten vorher nicht, wie eine Kartoffel wächst“, erzählt die Lehrerin Anja Brandt. Das Gemüse kocht die Schulküche für das Mittagessen. Im nächsten Jahr möchte die Schule auch Bienen auf das Dach holen.
`,
);

const umzug = forText("A2", a2Umzug.key);
const kochkurs = forText("A2", a2Kochkurs.key);
const schulgarten = forText("A2", a2Schulgarten.key);

const a2Items: SeedItem[] = [
  umzug.choice(
    "gist",
    "EASY",
    "Warum schreibt Lena diese E-Mail?",
    [
      "Sie lädt Sara zu ihrem Geburtstag ein.",
      "Sie sucht eine neue Wohnung.",
      "Sie möchte Sara in ihrer Stadt besuchen.",
      "Sie bittet Sara um Hilfe beim Umzug.",
    ],
    "d",
    "Lena zieht am 14. Mai um und fragt: „Hast du Zeit?“, weil sie Hilfe beim Tragen braucht.",
  ),
  umzug.choice(
    "detail",
    "MID",
    "Warum zieht Lena um?",
    [
      "Die Miete war zu hoch.",
      "Die alte Wohnung war zu klein und zu laut.",
      "Die alte Wohnung hatte keine Küche.",
      "Die alte Wohnung lag weit weg vom Park.",
    ],
    "b",
    "Im Text steht: „Die alte Wohnung war zu klein und zu laut“ (wegen der Straßenbahn).",
  ),
  umzug.choice(
    "vocabulary",
    "MID",
    "Lena schreibt: „Bitte sag mir bis Mittwoch Bescheid.“ Was soll Sara tun?",
    [
      "Lena am Mittwoch besuchen",
      "Am Mittwoch beim Tragen helfen",
      "Lena bis Mittwoch sagen, ob sie kommen kann",
      "Bis Mittwoch eine Pizza bestellen",
    ],
    "c",
    "„Bescheid sagen“ heißt informieren; Sara soll antworten, ob sie am Samstag Zeit hat.",
  ),
  umzug.tfng(
    "detail",
    "MID",
    [
      ["Lenas Bruder kommt mit einem Transporter.", "R"],
      ["Die neue Wohnung hat drei Zimmer.", "F"],
      ["Sara wohnt auch in der Nähe vom Stadtpark.", "NG"],
    ],
    "Der Bruder bringt einen Transporter mit; die Wohnung hat zwei Zimmer; über Saras Wohnort sagt der Text nichts.",
  ),

  kochkurs.choice(
    "gist",
    "EASY",
    "Was ist die wichtigste Information?",
    [
      "Der Kochkurs beginnt eine Woche später.",
      "Der Kochkurs fällt ganz aus.",
      "Der Kochkurs ist jetzt billiger.",
      "Der Kochkurs hat einen neuen Raum.",
    ],
    "a",
    "Der Kurs beginnt „nicht wie geplant am 3. März, sondern erst eine Woche später, am 10. März“.",
  ),
  kochkurs.choice(
    "detail",
    "EASY",
    "Was sollen die Teilnehmer mitbringen?",
    ["Lebensmittel für das Essen", "Ein Kochbuch", "Eine Schürze und eine Dose", "85 Euro in bar"],
    "c",
    "Im Text steht: „Bitte bringen Sie eine Schürze und eine Dose für die Reste mit.“",
  ),
  kochkurs.choice(
    "inference",
    "MID",
    "Eine Teilnehmerin hat am 10. März keine Zeit. Was muss sie tun?",
    [
      "Sie schreibt Frau Rossi eine E-Mail.",
      "Sie kommt einfach eine Woche später.",
      "Sie geht am 3. März in die Schulküche.",
      "Sie ruft bis zum 5. März im Büro an.",
    ],
    "d",
    "Wer am neuen Termin keine Zeit hat, soll „bis zum 5. März im Büro“ anrufen und bekommt das Geld zurück.",
  ),
  kochkurs.tfng(
    "detail",
    "MID",
    [
      ["Die Kursleiterin ist krank.", "R"],
      ["Die Lebensmittel muss man extra bezahlen.", "F"],
      ["Im Kurs kocht man nur vegetarische Gerichte.", "NG"],
    ],
    "Frau Rossi ist krank; die Lebensmittel sind im Kurspreis enthalten; über vegetarisches Essen steht nichts im Text.",
  ),

  schulgarten.choice(
    "gist",
    "EASY",
    "Worum geht es in dem Artikel?",
    [
      "Um ein neues Schulessen",
      "Um einen Garten auf dem Dach einer Schule",
      "Um einen Ausflug auf einen Bauernhof",
      "Um die Ferien von Lehrern und Eltern",
    ],
    "b",
    "Schon die Überschrift und der zweite Satz nennen den Garten auf dem Dach der Goethe-Schule.",
  ),
  schulgarten.choice(
    "detail",
    "MID",
    "Wer kümmert sich in den Sommerferien um die Pflanzen?",
    [
      "Eltern und Lehrer",
      "Die Kinder jeder Klasse",
      "Die Schulküche",
      "Niemand, die Pflanzen brauchen dann kein Wasser.",
    ],
    "a",
    "Im Text steht: „In den Sommerferien gießen Eltern und Lehrer die Pflanzen.“",
  ),
  schulgarten.tfng(
    "detail",
    "HARD",
    [
      ["Den Garten auf dem Dach gibt es seit einem Jahr.", "R"],
      ["Auf dem Dach leben schon Bienen.", "F"],
      ["Frau Brandt unterrichtet Biologie.", "NG"],
    ],
    "Der Garten besteht „seit einem Jahr“; Bienen sollen erst im nächsten Jahr kommen; Frau Brandts Fach wird nicht genannt.",
  ),
];

// ---------------------------------------------------------------- B1

const b1Homeoffice = text(
  "r-b1-homeoffice",
  "B1",
  "Ein Jahr im Homeoffice: Mein Fazit",
  "Arbeit",
  `
Ein Jahr im Homeoffice: Mein Fazit

Als meine Firma letzten Herbst angekündigt hat, dass wir dauerhaft von zu Hause arbeiten dürfen, war ich begeistert. Kein Stau mehr, keine überfüllten Züge, mehr Zeit zum Schlafen. Die ersten Wochen waren tatsächlich wunderbar. Ich habe morgens Sport gemacht und mittags selbst gekocht.

Doch nach ein paar Monaten habe ich gemerkt, dass mir etwas fehlt: die kurzen Gespräche mit den Kollegen in der Kaffeeküche. Im Videocall redet man nur über die Arbeit, und nach Feierabend bleibt der Laptop trotzdem auf dem Küchentisch stehen. Ich habe oft länger gearbeitet als im Büro, ohne es zu merken.

Deshalb habe ich einiges geändert. Ich habe mir in der kleinen Abstellkammer einen richtigen Arbeitsplatz eingerichtet, dessen Tür ich um 17 Uhr schließe. Außerdem fahre ich jetzt zweimal pro Woche in ein Coworking-Büro in meinem Viertel. Dort treffe ich Menschen aus ganz anderen Berufen, zum Beispiel eine Grafikerin und einen Übersetzer.

Mein Fazit: Homeoffice ist für mich immer noch die bessere Lösung, aber nur mit klaren Regeln. Wer ganz allein zu Hause arbeitet, sollte gut auf sich aufpassen.
`,
);

const b1Repaircafe = text(
  "r-b1-repaircafe",
  "B1",
  "Reparieren statt wegwerfen",
  "Umwelt und Nachbarschaft",
  `
Reparieren statt wegwerfen

Jeden ersten Samstag im Monat ist im Gemeindehaus von Freiburg-Haslach viel los. Menschen kommen mit kaputten Toastern, Lampen, Fahrrädern oder Jeans, die ein Loch haben. Sie alle wollen ihre Sachen nicht wegwerfen, sondern reparieren lassen. Im Repair-Café helfen ehrenamtliche Helferinnen und Helfer dabei, zum Beispiel ein pensionierter Elektriker und eine Schneiderin.

Wichtig ist: Die Besucher sollen nicht nur zusehen, sondern selbst mitarbeiten. „Wir wollen zeigen, dass Reparieren gar nicht so schwer ist“, sagt Organisator Markus Keller. Die Reparatur selbst kostet nichts, aber viele Gäste geben eine kleine Spende für Kaffee und Kuchen oder für Ersatzteile.

Nicht jede Reparatur klappt. Bei modernen Handys zum Beispiel fehlen oft die passenden Teile, oder die Geräte sind verklebt und lassen sich kaum öffnen. Trotzdem schaffen die Helfer etwa zwei Drittel aller Reparaturen. Das spart nicht nur Geld, sondern auch Müll. Im letzten Jahr kamen rund 600 Besucher. Weil die Warteschlange oft lang ist, kann man sich jetzt vorher online einen Termin reservieren.
`,
);

const b1Norwegen = text(
  "r-b1-norwegen",
  "B1",
  "Ein Brief aus Norwegen",
  "Auslandsaufenthalt",
  `
Liebe Frau Hoffmann,

ich hoffe, es geht Ihnen gut und die neue Klasse ist nicht zu anstrengend! Sie haben mich vor meiner Abreise gebeten, mich einmal aus Norwegen zu melden, und das mache ich jetzt endlich.

Seit drei Monaten arbeite ich nun als Freiwillige auf einem Bauernhof in der Nähe von Trondheim. Mein Tag beginnt um sechs Uhr im Stall, wo ich beim Füttern der Schafe helfe. Am Anfang war das ziemlich hart, vor allem wegen der Dunkelheit: Im Dezember wird es hier nur für wenige Stunden hell. Inzwischen habe ich mich aber daran gewöhnt, und die Nordlichter am Abend entschädigen für vieles.

Mit der Sprache klappt es besser, als ich gedacht habe. Die Familie spricht mit mir Norwegisch, und nur wenn ich gar nichts verstehe, wechseln wir ins Englische. Ihr Tipp, jeden Tag zehn neue Wörter in ein Heft zu schreiben, hilft mir sehr.

Im Sommer komme ich zurück und möchte dann Agrarwissenschaften studieren. Das hätte ich vor einem Jahr nie gedacht! Vielleicht darf ich Ihrer Klasse dann von meinen Erfahrungen erzählen?

Herzliche Grüße aus dem Norden
Ihre Mia Schuster
`,
);

const homeoffice = forText("B1", b1Homeoffice.key);
const repaircafe = forText("B1", b1Repaircafe.key);
const norwegen = forText("B1", b1Norwegen.key);

const b1Items: SeedItem[] = [
  homeoffice.choice(
    "gist",
    "EASY",
    "Was ist die Hauptaussage des Blogbeitrags?",
    [
      "Homeoffice ist anstrengender als die Arbeit im Büro.",
      "Die Person möchte zurück ins Büro ihrer Firma.",
      "Homeoffice ist gut, aber nur mit klaren Regeln.",
      "Coworking-Büros sind zu teuer.",
    ],
    "c",
    "Das Fazit lautet: „Homeoffice ist für mich immer noch die bessere Lösung, aber nur mit klaren Regeln.“",
  ),
  homeoffice.choice(
    "detail",
    "MID",
    "Was hat der Person nach einigen Monaten gefehlt?",
    [
      "Die Fahrt mit dem Zug",
      "Genug Zeit für Sport",
      "Ein eigenes Zimmer in der Firma",
      "Die kurzen Gespräche mit den Kollegen",
    ],
    "d",
    "Im zweiten Absatz: „dass mir etwas fehlt: die kurzen Gespräche mit den Kollegen in der Kaffeeküche“.",
  ),
  homeoffice.choice(
    "inference",
    "MID",
    "Warum schließt die Person um 17 Uhr die Tür ihres Arbeitsplatzes?",
    [
      "Weil dann die Kinder nach Hause kommen",
      "Um Arbeit und Freizeit klar zu trennen",
      "Weil das Coworking-Büro um 17 Uhr schließt",
      "Weil die Firma es so verlangt",
    ],
    "b",
    "Die Person hat vorher oft zu lange gearbeitet; die geschlossene Tür ist eine der „klaren Regeln“ gegen dieses Problem.",
  ),
  homeoffice.tfng(
    "detail",
    "HARD",
    [
      ["Die Person hat im Homeoffice oft länger gearbeitet als im Büro.", "R"],
      ["Im Coworking-Büro trifft die Person nur Kollegen aus der eigenen Firma.", "F"],
      ["Die Firma bezahlt den Platz im Coworking-Büro.", "NG"],
    ],
    "„Ich habe oft länger gearbeitet als im Büro“; dort trifft sie Menschen „aus ganz anderen Berufen“; wer das Büro bezahlt, steht nicht im Text.",
  ),

  repaircafe.choice(
    "gist",
    "EASY",
    "Worum geht es im Text?",
    [
      "Um ein Treffen, bei dem man kaputte Dinge gemeinsam repariert",
      "Um ein neues Geschäft für gebrauchte Elektrogeräte",
      "Um ein Café, das Kuchen aus Resten backt",
      "Um einen Kurs für Elektriker",
    ],
    "a",
    "Im Repair-Café lassen Menschen ihre kaputten Sachen reparieren und arbeiten dabei selbst mit.",
  ),
  repaircafe.choice(
    "detail",
    "MID",
    "Was müssen die Besucher bezahlen?",
    [
      "Fünf Euro pro Reparatur",
      "Einen festen Preis für Kaffee und Kuchen",
      "Einen Mitgliedsbeitrag für den Verein",
      "Nichts, viele geben aber freiwillig eine Spende.",
    ],
    "d",
    "Im Text steht: „Die Reparatur selbst kostet nichts, aber viele Gäste geben eine kleine Spende.“",
  ),
  repaircafe.choice(
    "vocabulary",
    "MID",
    "Im Text steht: „Nicht jede Reparatur klappt.“ Was bedeutet „klappt“ hier?",
    ["wird bezahlt", "dauert lange", "gelingt", "wird angemeldet"],
    "c",
    "Der folgende Satz erklärt, warum Handys oft nicht repariert werden können; „klappen“ heißt hier „gelingen“.",
  ),
  repaircafe.tfng(
    "detail",
    "HARD",
    [
      ["Die Besucher sollen bei der Reparatur selbst mitarbeiten.", "R"],
      ["Moderne Handys kann man leicht öffnen und reparieren.", "F"],
      ["Markus Keller war früher Elektriker.", "NG"],
    ],
    "Die Besucher sollen „selbst mitarbeiten“; Handys sind oft verklebt; welchen Beruf Markus Keller hatte, sagt der Text nicht.",
  ),

  norwegen.choice(
    "gist",
    "EASY",
    "Warum schreibt Mia den Brief?",
    [
      "Sie bittet ihre Lehrerin um eine Empfehlung für das Studium.",
      "Sie erzählt ihrer früheren Lehrerin von ihrem Jahr in Norwegen.",
      "Sie lädt Frau Hoffmann nach Norwegen ein.",
      "Sie beschwert sich über die Arbeit auf dem Bauernhof.",
    ],
    "b",
    "Frau Hoffmann hat sie gebeten, sich aus Norwegen zu melden, und Mia berichtet von Arbeit, Sprache und Plänen.",
  ),
  norwegen.choice(
    "inference",
    "HARD",
    "Was lässt sich über Mias Studienwunsch sagen?",
    [
      "Vor einem Jahr hatte sie diesen Plan noch nicht.",
      "Sie wollte schon immer Agrarwissenschaften studieren.",
      "Ihre Gastfamilie hat ihn ihr vorgeschlagen.",
      "Sie möchte in Norwegen studieren.",
    ],
    "a",
    "Mia schreibt über ihren Studienwunsch: „Das hätte ich vor einem Jahr nie gedacht!“",
  ),
  norwegen.tfng(
    "detail",
    "MID",
    [
      ["Mia spricht mit ihrer Gastfamilie meistens Englisch.", "F"],
      ["Frau Hoffmann hat Mia einen Tipp zum Wörterlernen gegeben.", "R"],
      ["Mia hat schon einen Studienplatz bekommen.", "NG"],
    ],
    "Die Familie spricht Norwegisch mit ihr; der Tipp mit den zehn Wörtern stammt von Frau Hoffmann; ein Studienplatz wird nicht erwähnt.",
  ),
];

// ---------------------------------------------------------------- B2

const b2Schlaf = text(
  "r-b2-schlaf",
  "B2",
  "Warum Jugendliche morgens nicht aus dem Bett kommen",
  "Gesundheit und Schule",
  `
Warum Jugendliche morgens nicht aus dem Bett kommen

(1) Wer Kinder im Teenageralter hat, kennt das Problem: Abends sind sie hellwach, morgens kaum ansprechbar. Lange galt das als Frage der Disziplin. Schlafforscher sehen das heute anders. In der Pubertät verschiebt sich die innere Uhr um bis zu zwei Stunden nach hinten. Das Schlafhormon Melatonin wird später ausgeschüttet, sodass viele Jugendliche vor 23 Uhr schlicht nicht müde sind.

(2) Das Problem: Der Schulbeginn richtet sich nicht nach dieser Biologie. Wer um 7.45 Uhr im Klassenzimmer sitzen muss, schläft unter der Woche oft nur sechs bis sieben Stunden, obwohl Fachleute für diese Altersgruppe acht bis zehn Stunden empfehlen. Am Wochenende wird das Defizit dann mit langem Ausschlafen ausgeglichen, was den Rhythmus zusätzlich durcheinanderbringt. Forscher sprechen von einem „sozialen Jetlag“.

(3) Einige Schulen haben daraus Konsequenzen gezogen. Ein Gymnasium in Nordrhein-Westfalen etwa erlaubt Schülerinnen und Schülern der Oberstufe seit einigen Jahren, selbst zu entscheiden, ob sie zur ersten Stunde kommen oder die verpasste Zeit später nacharbeiten. Eine Begleitstudie ergab, dass die Jugendlichen dadurch im Schnitt etwa eine Stunde mehr schliefen und sich tagsüber wacher fühlten. Bessere Noten ließen sich allerdings nicht eindeutig nachweisen.

(4) Kritiker wenden ein, dass ein späterer Unterrichtsbeginn den Familienalltag erschwert: Eltern müssen früh zur Arbeit, Busse fahren nach festen Plänen, und Nachmittagsaktivitäten würden sich nach hinten verschieben. Hinzu kommt, dass abendliches Licht von Smartphone-Bildschirmen die innere Uhr noch weiter verschiebt. Ein späterer Schulstart allein, so viele Experten, löse das Problem daher nicht, solange die Handys bis Mitternacht leuchten.
`,
);

const b2Langeweile = text(
  "r-b2-langeweile",
  "B2",
  "Lasst die Kinder sich langweilen!",
  "Erziehung und Freizeit",
  `
Lasst die Kinder sich langweilen!
Ein Kommentar von Julia Brenner

Montag Klavier, Dienstag Fußball, Mittwoch Chinesisch für Anfänger, Donnerstag Schwimmen: Der Wochenplan vieler Grundschulkinder erinnert heute an den Terminkalender einer Managerin. Hinzu kommen Hausaufgaben, Geburtstagsfeiern und Arzttermine. Die Absicht der Eltern ist verständlich. Sie wollen ihren Kindern möglichst viele Chancen eröffnen und keine Begabung ungenutzt lassen. Doch mit jedem zusätzlichen Kurs verschwindet etwas, das mindestens genauso wertvoll ist: freie Zeit, die niemand plant.

Psychologen weisen seit Langem darauf hin, dass Langeweile keineswegs schädlich ist. Im Gegenteil: Wer sich langweilt, ist gezwungen, selbst eine Beschäftigung zu finden. Genau in diesen Momenten entstehen Fantasiespiele, Baumhäuser aus Sperrmüll und erfundene Geschichten. Kinder lernen dabei, mit einem unangenehmen Gefühl umzugehen, statt sofort nach Ablenkung zu verlangen.

Ich gebe zu, dass es mir selbst schwerfällt, das auszuhalten. Wenn meine Tochter am Samstagvormittag mit hängenden Schultern durch die Wohnung schlurft und „Mir ist sooo langweilig“ stöhnt, würde ich ihr am liebsten das Tablet in die Hand drücken. Meistens widerstehe ich der Versuchung. Nach einer Viertelstunde Gejammer sitzt sie dann oft am Küchentisch und baut aus Klopapierrollen eine Burg für ihre Kuscheltiere.

Natürlich spricht nichts gegen einen Sportverein oder Musikunterricht. Aber vielleicht sollten wir Eltern bei der nächsten Anmeldung kurz innehalten und uns fragen, wessen Wunsch wir da eigentlich erfüllen: den des Kindes oder unseren eigenen. Manchmal ist der beste Termin der Woche nämlich der, der gar nicht im Kalender steht.
`,
);

const b2Stadtbaeume = text(
  "r-b2-stadtbaeume",
  "B2",
  "Wenn die Stadt schwitzt",
  "Stadt und Klima",
  `
Wenn die Stadt schwitzt

In heißen Sommern wird es in deutschen Innenstädten oft mehrere Grad wärmer als im Umland. Asphalt und Beton speichern die Hitze des Tages und geben sie nachts wieder ab. Stadtplaner sprechen von „Hitzeinseln“. Eine der wirksamsten Gegenmaßnahmen ist zugleich eine der ältesten: Bäume.

„Ein großer Straßenbaum verdunstet an einem Sommertag mehrere hundert Liter Wasser und kühlt so seine Umgebung wie eine natürliche Klimaanlage“, erklärt die Forstwissenschaftlerin Dr. Katrin Maurer. Doch gerade die Bäume selbst leiden unter der Trockenheit. Viele ältere Linden und Ahornbäume haben in den letzten Jahren Schäden erlitten.

Die Stadt Leipzig setzt deshalb zunehmend auf Arten aus wärmeren Regionen, etwa die Silberlinde aus Südosteuropa. „Wir pflanzen heute Bäume für das Klima von 2080“, sagt Thomas Richter vom Grünflächenamt. Jeder neue Baum kostet samt Pflege in den ersten Jahren rund 3.000 Euro.

Nicht alle sind begeistert. Hausbesitzer Peter Lang beklagt, dass die Wurzeln eines Baums vor seinem Haus die Wasserleitung beschädigt hätten, und im Herbst müsse er ständig Laub fegen. Auch manche Ladenbesitzer fürchten, dass Baumkronen ihre Schaufenster verdecken. Sie wünschen sich stattdessen begrünte Fassaden und Dachgärten.

Die Bürgerinitiative „Grüner Westen“ hat einen anderen Weg gefunden, sich zu beteiligen: Ihre Mitglieder übernehmen Gießpatenschaften für junge Bäume in ihrer Straße. „Zehn Eimer pro Woche, das schafft jeder“, meint Sprecherin Aylin Demir. Inzwischen haben sich über 200 Anwohner angeschlossen. Viele Paten befestigen sogar ein kleines Schild mit ihrem Vornamen am Stamm.
`,
);

const schlaf = forText("B2", b2Schlaf.key);
const langeweile = forText("B2", b2Langeweile.key);
const stadtbaeume = forText("B2", b2Stadtbaeume.key);

const b2Items: SeedItem[] = [
  schlaf.choice(
    "gist",
    "EASY",
    "Worum geht es in dem Artikel vor allem?",
    [
      "Um die Frage, ob Jugendliche zu viel Zeit am Smartphone verbringen",
      "Um neue Regeln für Hausaufgaben an Gymnasien",
      "Um Tipps, wie Eltern ihre Kinder früher ins Bett bringen",
      "Um die Ursachen der morgendlichen Müdigkeit von Jugendlichen und mögliche Lösungen",
    ],
    "d",
    "Der Artikel erklärt die biologische Ursache (Absatz 1), die Folgen (2), einen Schulversuch (3) und Einwände (4).",
  ),
  schlaf.match(
    "structure",
    "MID",
    "Welche Überschrift passt zu welchem Absatz? Eine Überschrift bleibt übrig.",
    ["Absatz 1", "Absatz 2", "Absatz 3", "Absatz 4"],
    [
      "Streitpunkt Familienalltag und Bildschirm",
      "Ein Versuch mit freier erster Stunde",
      "Biologie statt Faulheit",
      "Zu wenig Schlaf unter der Woche",
      "Ausschlafen bringt bessere Noten",
    ],
    [3, 4, 2, 1],
    "Absatz 1 erklärt die innere Uhr, 2 das Schlafdefizit, 3 das Gymnasium-Modell, 4 die Kritik; bessere Noten ließen sich gerade nicht nachweisen.",
  ),
  schlaf.choice(
    "vocabulary",
    "HARD",
    "Was meinen Forscher mit dem „sozialen Jetlag“?",
    [
      "Die Müdigkeit nach Fernreisen in den Ferien",
      "Den Stress durch soziale Netzwerke",
      "Den Wechsel zwischen zu wenig Schlaf unter der Woche und langem Ausschlafen am Wochenende",
      "Die Zeitverschiebung zwischen Schulbeginn und Arbeitsbeginn der Eltern",
    ],
    "c",
    "Der Begriff folgt direkt auf die Beschreibung von kurzem Schlaf unter der Woche und Ausschlafen am Wochenende (Absatz 2).",
  ),
  schlaf.tfng(
    "detail",
    "HARD",
    [
      ["An dem Gymnasium beginnt der Unterricht für alle Klassen später.", "F"],
      ["Die Oberstufenschüler schliefen durch das Modell im Schnitt länger.", "R"],
      ["Das Modell wurde inzwischen von vielen anderen Schulen übernommen.", "NG"],
    ],
    "Das Modell gilt nur für die Oberstufe und ist freiwillig; die Studie zeigt etwa eine Stunde mehr Schlaf; über andere Schulen sagt der Text nichts.",
  ),

  langeweile.choice(
    "gist",
    "EASY",
    "Welche Meinung vertritt die Autorin?",
    [
      "Kinder brauchen neben Kursen auch freie Zeit, die niemand plant.",
      "Kinder sollten möglichst viele Kurse besuchen.",
      "Tablets sind das beste Mittel gegen Langeweile.",
      "Sportvereine schaden der Entwicklung von Kindern.",
    ],
    "a",
    "Schon im ersten Absatz: Mit jedem Kurs verschwindet „freie Zeit, die niemand plant“, und die Überschrift fordert Langeweile.",
  ),
  langeweile.choice(
    "detail",
    "MID",
    "Wie reagiert die Autorin meistens, wenn ihre Tochter sich langweilt?",
    [
      "Sie gibt ihr das Tablet.",
      "Sie lässt sie die Langeweile aushalten, statt ihr eine Beschäftigung zu geben.",
      "Sie meldet sie in einem neuen Kurs an.",
      "Sie baut mit ihr eine Burg für die Kuscheltiere.",
    ],
    "b",
    "„Meistens widerstehe ich der Versuchung“, danach beschäftigt sich die Tochter allein mit der Burg.",
  ),
  langeweile.choice(
    "vocabulary",
    "MID",
    "Was bedeutet „innehalten“ im letzten Absatz?",
    ["sich beeilen", "etwas festhalten", "sich anmelden", "kurz stoppen und nachdenken"],
    "d",
    "Die Eltern sollen „kurz innehalten und uns fragen“, also eine Pause machen und überlegen.",
  ),
  langeweile.tfng(
    "inference",
    "HARD",
    [
      ["Die Autorin lehnt Sportvereine und Musikunterricht grundsätzlich ab.", "F"],
      ["Die Tochter der Autorin lernt Chinesisch.", "NG"],
      ["Der Autorin fällt es selbst schwer, die Langeweile ihrer Tochter auszuhalten.", "R"],
    ],
    "„Natürlich spricht nichts gegen einen Sportverein“; der Chinesischkurs ist nur ein allgemeines Beispiel; „Ich gebe zu, dass es mir selbst schwerfällt“.",
  ),

  stadtbaeume.choice(
    "gist",
    "EASY",
    "Worum geht es hauptsächlich?",
    [
      "Um neue Regeln für Hausbesitzer in Leipzig",
      "Um die Geschichte der Linde in Deutschland",
      "Um Bäume als Schutz gegen Hitze in der Stadt und die Probleme dabei",
      "Um die Kosten von Klimaanlagen",
    ],
    "c",
    "Der Text stellt Bäume als Mittel gegen „Hitzeinseln“ vor und nennt Trockenheit, Kosten und Kritik von Anwohnern.",
  ),
  stadtbaeume.match(
    "detail",
    "MID",
    "Welche Aussage passt zu welcher Person? Eine Aussage bleibt übrig.",
    ["Dr. Katrin Maurer", "Thomas Richter", "Peter Lang", "Aylin Demir"],
    [
      "sieht vor allem Nachteile eines Baums für sein Haus",
      "erklärt, wie Bäume ihre Umgebung abkühlen",
      "setzt auf die Hilfe von Anwohnern",
      "berichtet, dass heute andere Baumarten gepflanzt werden",
      "fordert, weniger Straßen zu asphaltieren",
    ],
    [2, 4, 1, 3],
    "Maurer erklärt die Verdunstung, Richter die Silberlinde, Lang klagt über Wurzeln und Laub, Demir über Gießpatenschaften; niemand fordert weniger Asphalt.",
  ),
  stadtbaeume.tfng(
    "inference",
    "HARD",
    [
      ["Die Silberlinde kommt ursprünglich aus Südosteuropa.", "R"],
      ["Die Gießpaten bekommen von der Stadt Geld für ihre Arbeit.", "NG"],
      ["Nachts kühlen die Innenstädte schneller ab als das Umland.", "F"],
    ],
    "„die Silberlinde aus Südosteuropa“; über Bezahlung der Gießpaten steht nichts; Asphalt und Beton geben die Hitze nachts wieder ab.",
  ),
];

// ---------------------------------------------------------------- C1

const c1Mehrsprachigkeit = text(
  "r-c1-mehrsprachigkeit",
  "C1",
  "Mehrsprachigkeit: Was die Forschung wirklich weiß",
  "Sprache und Wissenschaft",
  `
Mehrsprachigkeit: Was die Forschung wirklich weiß

Noch vor wenigen Jahrzehnten rieten Kinderärzte und Lehrkräfte Eltern mit Migrationsgeschichte häufig davon ab, mit ihren Kindern die Familiensprache zu sprechen. Die Sorge: Zwei Sprachen gleichzeitig würden das Kind überfordern, seine Entwicklung verzögern und letztlich dazu führen, dass es keine der beiden Sprachen richtig beherrsche. Manche Familien gaben ihre Herkunftssprache daraufhin ganz auf, was viele Betroffene im Nachhinein bedauern. Diese Befürchtung gilt inzwischen als weitgehend widerlegt.

Zwar trifft es zu, dass mehrsprachig aufwachsende Kinder in jeder einzelnen Sprache mitunter einen kleineren Wortschatz aufweisen als einsprachige Gleichaltrige. Zählt man jedoch die Wörter beider Sprachen zusammen, ist der Gesamtwortschatz in der Regel mindestens gleich groß. Auch das gelegentliche Mischen von Sprachen innerhalb eines Satzes, das Außenstehende oft als Zeichen von Verwirrung deuten, folgt nachweislich grammatischen Regeln und wird von Sprachwissenschaftlern eher als Ausdruck sprachlicher Kompetenz betrachtet.

Umstrittener ist hingegen die These vom sogenannten kognitiven Vorteil. Eine Reihe viel beachteter Studien aus den 2000er-Jahren legte nahe, dass Zweisprachige Aufgaben, bei denen man störende Informationen ausblenden muss, schneller lösen. Spätere Untersuchungen mit größeren Stichproben konnten diesen Effekt jedoch häufig nicht bestätigen. Einige Forschende vermuten, dass frühere Ergebnisse auch auf andere Faktoren zurückgingen, etwa den sozioökonomischen Hintergrund der Versuchspersonen, oder dass Studien ohne eindeutiges Ergebnis seltener veröffentlicht wurden. Die Frage gilt daher bis heute als offen.

Für die Praxis ergibt sich daraus eine eher nüchterne Empfehlung. Eltern sollten mit ihren Kindern die Sprache sprechen, in der sie sich selbst am wohlsten fühlen und in der sie Gefühle, Witze und Geschichten am natürlichsten ausdrücken können. Entscheidend für den Spracherwerb ist weniger eine bestimmte Methode, etwa das oft empfohlene Prinzip „eine Person, eine Sprache“, als vielmehr die Menge und Qualität des sprachlichen Angebots. Ein Kind, das eine Sprache nur aus gelegentlichen Pflichtgesprächen kennt, wird sie kaum aktiv verwenden. Mehrsprachigkeit ist demnach weder ein Risiko noch ein Wundermittel, sondern schlicht eine Normalität, die in weiten Teilen der Welt ohnehin die Regel ist.
`,
);

const c1Nachtzug = text(
  "r-c1-nachtzug",
  "C1",
  "Die Renaissance der Nachtzüge",
  "Verkehr und Reisen",
  `
Die Renaissance der Nachtzüge

(1) Lange schien ihr Schicksal besiegelt. In den 2010er-Jahren stellten mehrere europäische Bahngesellschaften ihre Nachtverbindungen ein, weil die Wagen veraltet waren und die Konkurrenz durch Billigflieger übermächtig schien. Wer von Hamburg nach Wien wollte, stieg ins Flugzeug; der Schlafwagen galt als nostalgisches Relikt.

(2) Inzwischen hat sich das Blatt gewendet. Die Österreichischen Bundesbahnen übernahmen einen Teil des aufgegebenen Netzes und bauten es schrittweise aus. Heute verbinden Nachtzüge wieder zahlreiche Metropolen zwischen Brüssel, Rom und Warschau, und auf beliebten Strecken sind Liegeplätze an Ferienwochenenden oft Wochen im Voraus ausgebucht. Getragen wird die Nachfrage vor allem von Reisenden, die aus ökologischen Gründen aufs Fliegen verzichten möchten, aber auch von Geschäftsleuten, die die Fahrtzeit als gewonnene Nacht verbuchen. Auch jüngere Menschen, die mit einem Interrail-Pass durch Europa reisen, entdecken den Nachtzug zunehmend für sich.

(3) Wirtschaftlich bleibt der Betrieb dennoch ein Balanceakt. Ein Schlafwagen bietet deutlich weniger Plätze als ein gewöhnlicher Sitzwagen, zugleich fallen Kosten für Personal, Reinigung und Frühstück an. Hinzu kommen Trassengebühren, die in jedem durchfahrenen Land separat berechnet werden. Da die Züge tagsüber meist ungenutzt auf Abstellgleisen stehen, lässt sich das teure Material kaum effizient einsetzen. Ein Fahrpreis, der all diese Kosten deckt, wäre für viele Kunden wiederum kaum attraktiv.

(4) Auch Fahrgäste äußern Kritik. Verspätungen von mehreren Stunden sind keine Seltenheit, und wiederholt fielen ganze Verbindungen kurzfristig aus, weil Ersatzwagen fehlten. Hinzu kommen Klagen über defekte Klimaanlagen und fehlende Speisewagen. Wer im Liegewagen mit fünf Fremden das Abteil teilt, erlebt zudem nicht unbedingt die erholsame Nachtruhe, die in Werbeprospekten versprochen wird.

(5) Ob die Renaissance von Dauer ist, dürfte davon abhängen, ob es gelingt, moderne Fahrzeuge in ausreichender Zahl zu beschaffen und die grenzüberschreitende Planung zu vereinfachen. Mehrere Bahnunternehmen haben neue Wagen bestellt, deren Kabinen mehr Privatsphäre bieten sollen. Ob sich das Angebot am Ende ohne staatliche Förderung trägt, ist unter Fachleuten allerdings umstritten.
`,
);

const c1CitizenScience = text(
  "r-c1-citizen-science",
  "C1",
  "Forschen ohne Doktortitel",
  "Wissenschaft und Gesellschaft",
  `
Forschen ohne Doktortitel

Wenn im Frühjahr Tausende Menschen in Deutschland eine Stunde lang die Vögel in ihrem Garten zählen und ihre Beobachtungen online melden, beteiligen sie sich an einem der größten wissenschaftlichen Projekte des Landes. Solche Vorhaben, bei denen Laien Daten erheben oder auswerten, werden unter dem Begriff „Citizen Science“ zusammengefasst, zu Deutsch etwa „Bürgerwissenschaft“.

Der Gedanke ist keineswegs neu. Bereits im 19. Jahrhundert trugen Pfarrer, Lehrer und Apotheker in ihrer Freizeit Wetterdaten, Pflanzenfunde und Fossilien zusammen, auf die sich die Forschung bis heute stützt. Neu ist allerdings das Ausmaß: Dank Smartphones und Online-Plattformen können heute Hunderttausende gleichzeitig mitwirken, etwa indem sie Fotos von Insekten hochladen, historische Handschriften entziffern oder die Lichtverschmutzung in ihrer Straße messen. Manche Plattformen verwandeln die Mitarbeit sogar in eine Art Spiel, bei dem man Punkte sammeln kann.

Für die Wissenschaft liegt der Nutzen auf der Hand. Kein Forschungsinstitut könnte es sich leisten, flächendeckend so viele Beobachtungen zu sammeln. Zudem gelangen Freiwillige an Orte, etwa private Gärten, zu denen Forschende sonst keinen Zugang hätten. Gerade in der Ökologie, wo Veränderungen über große Räume und lange Zeiträume erfasst werden müssen, wären viele Erkenntnisse ohne freiwillige Helfer kaum denkbar.

Gleichwohl gibt es Vorbehalte. Kritiker bemängeln, dass die Qualität der Daten schwanke, weil Laien etwa ähnliche Arten verwechselten oder bevorzugt dort beobachteten, wo es ohnehin viel zu sehen gebe. Die Projektverantwortlichen begegnen diesem Einwand mit Schulungen, Plausibilitätsprüfungen und statistischen Verfahren, die solche Verzerrungen herausrechnen sollen. Heikler ist eine andere Frage: Werden die Freiwilligen tatsächlich als Partner behandelt oder lediglich als kostenlose Arbeitskräfte eingesetzt, die an der Formulierung der Forschungsfragen und an der Veröffentlichung der Ergebnisse nicht beteiligt sind?

Einige Projekte versuchen inzwischen, genau das zu ändern, indem sie Bürgerinnen und Bürger von Anfang an in die Planung einbeziehen. Ob sich dieses anspruchsvollere Modell durchsetzt, bleibt abzuwarten. Fest steht, dass Citizen Science das Verhältnis zwischen Wissenschaft und Öffentlichkeit verändert hat: Forschung findet nicht mehr nur hinter Labortüren statt.
`,
);

const mehrsprachigkeit = forText("C1", c1Mehrsprachigkeit.key);
const nachtzug = forText("C1", c1Nachtzug.key);
const citizen = forText("C1", c1CitizenScience.key);

const c1Items: SeedItem[] = [
  mehrsprachigkeit.choice(
    "gist",
    "EASY",
    "Welche Position vertritt der Text insgesamt?",
    [
      "Zweisprachige Kinder sind einsprachigen geistig überlegen.",
      "Mehrsprachigkeit ist weder schädlich noch ein Wundermittel, sondern normal.",
      "Eltern sollten ihre Kinder nur in der Landessprache erziehen.",
      "Die Forschung zur Mehrsprachigkeit ist wertlos.",
    ],
    "b",
    "Der Schlusssatz fasst zusammen: „weder ein Risiko noch ein Wundermittel, sondern schlicht eine Normalität“.",
  ),
  mehrsprachigkeit.choice(
    "detail",
    "MID",
    "Was sagt der Text über den Wortschatz mehrsprachiger Kinder?",
    [
      "In beiden Sprachen zusammen ist er meist mindestens so groß wie bei einsprachigen Kindern.",
      "Er ist in jeder einzelnen Sprache größer als bei einsprachigen Kindern.",
      "Er ist insgesamt deutlich kleiner.",
      "Er wächst erst ab dem Schulalter.",
    ],
    "a",
    "Zweiter Absatz: Zählt man beide Sprachen zusammen, ist der Gesamtwortschatz „mindestens gleich groß“.",
  ),
  mehrsprachigkeit.choice(
    "inference",
    "HARD",
    "Was lässt sich aus dem Text über das Prinzip „eine Person, eine Sprache“ schließen?",
    [
      "Es ist die einzige wirksame Methode.",
      "Es schadet dem Spracherwerb.",
      "Es stammt aus den Studien der 2000er-Jahre.",
      "Es ist weniger entscheidend als Menge und Qualität des sprachlichen Angebots.",
    ],
    "d",
    "Letzter Absatz: Entscheidend ist „weniger eine bestimmte Methode ... als vielmehr die Menge und Qualität des sprachlichen Angebots“.",
  ),
  mehrsprachigkeit.tfng(
    "detail",
    "HARD",
    [
      ["Das Mischen von Sprachen in einem Satz gilt in der Sprachwissenschaft als Zeichen von Verwirrung.", "F"],
      ["Neuere Studien mit größeren Stichproben haben den kognitiven Vorteil häufig nicht bestätigt.", "R"],
      ["Die meisten Kinder weltweit wachsen mit genau drei Sprachen auf.", "NG"],
    ],
    "Sprachmischung gilt als „Ausdruck sprachlicher Kompetenz“; spätere Studien konnten den Effekt „häufig nicht bestätigen“; über drei Sprachen sagt der Text nichts.",
  ),

  nachtzug.choice(
    "gist",
    "EASY",
    "Welche Aussage fasst den Text am besten zusammen?",
    [
      "Nachtzüge sind inzwischen billiger als Flüge.",
      "Nachtzüge wurden in Europa endgültig abgeschafft.",
      "Nachtzüge erleben ein Comeback, kämpfen aber mit wirtschaftlichen und praktischen Problemen.",
      "Nachtzüge werden fast nur von Geschäftsleuten genutzt.",
    ],
    "c",
    "Nach dem Niedergang (Absatz 1) folgt die neue Nachfrage (2), danach Kosten (3), Kritik (4) und eine offene Zukunft (5).",
  ),
  nachtzug.match(
    "structure",
    "MID",
    "Welche Überschrift passt zu welchem Absatz? Eine Überschrift bleibt übrig.",
    ["Absatz 1", "Absatz 2", "Absatz 3", "Absatz 4", "Absatz 5"],
    [
      "Offene Zukunft",
      "Ein fast vergessenes Verkehrsmittel",
      "Warum sich der Betrieb kaum rechnet",
      "Neue Nachfrage, neue Strecken",
      "Ärger im Abteil",
      "Luxusreisen für wenige Wohlhabende",
    ],
    [2, 4, 3, 5, 1],
    "Die Absätze behandeln nacheinander Niedergang, Wiederbelebung, Kosten, Fahrgastkritik und Zukunft; von Luxusreisen ist nirgends die Rede.",
  ),
  nachtzug.choice(
    "detail",
    "MID",
    "Welcher Grund für die hohen Betriebskosten wird im Text genannt?",
    [
      "Die Wagen stehen tagsüber meist ungenutzt herum.",
      "Die Fahrpreise sind gesetzlich begrenzt.",
      "Die Züge verbrauchen nachts mehr Energie.",
      "Das Personal muss an jeder Grenze ausgetauscht werden.",
    ],
    "a",
    "Absatz 3: Die Züge stehen „tagsüber meist ungenutzt auf Abstellgleisen“; die anderen Gründe kommen nicht vor.",
  ),
  nachtzug.choice(
    "vocabulary",
    "MID",
    "„Inzwischen hat sich das Blatt gewendet.“ Was bedeutet das?",
    [
      "Die Zeitungen berichten anders.",
      "Die Lage hat sich grundlegend verändert.",
      "Die Fahrpläne wurden neu gedruckt.",
      "Die Bahn hat eine neue Werbekampagne gestartet.",
    ],
    "b",
    "Die Redewendung leitet vom Niedergang in Absatz 1 zur Wiederbelebung in Absatz 2 über.",
  ),

  citizen.choice(
    "gist",
    "EASY",
    "Was ist das Hauptthema des Textes?",
    [
      "Die Geschichte der Wetterbeobachtung im 19. Jahrhundert",
      "Wie man Vögel richtig bestimmt",
      "Warum Forschungsinstitute zu wenig Geld haben",
      "Chancen und Schwierigkeiten von Forschung, an der Laien mitwirken",
    ],
    "d",
    "Der Text definiert Citizen Science, beschreibt ihren Nutzen und diskutiert Vorbehalte gegen sie.",
  ),
  citizen.choice(
    "inference",
    "HARD",
    "Welchen Einwand hält der Autor für schwerwiegender als die schwankende Datenqualität?",
    [
      "Dass Laien ähnliche Arten verwechseln",
      "Dass Smartphones zu ungenau messen",
      "Dass Freiwillige oft nur als kostenlose Helfer ohne Mitsprache eingesetzt werden",
      "Dass zu wenige Menschen mitmachen",
    ],
    "c",
    "Nach dem Einwand zur Datenqualität heißt es: „Heikler ist eine andere Frage“, nämlich ob Freiwillige als Partner behandelt werden.",
  ),
  citizen.tfng(
    "detail",
    "HARD",
    [
      ["Citizen Science ist erst durch Smartphones entstanden.", "F"],
      ["Die Projektverantwortlichen versuchen, Verzerrungen in den Laiendaten mit statistischen Verfahren auszugleichen.", "R"],
      ["Die Vogelzählung im Frühjahr wird von einer Universität geleitet.", "NG"],
    ],
    "Schon im 19. Jahrhundert sammelten Laien Daten, neu ist nur das Ausmaß; statistische Verfahren werden genannt; wer die Vogelzählung leitet, steht nicht im Text.",
  ),
];

// ---------------------------------------------------------------- C2

const c2Warten = text(
  "r-c2-warten",
  "C2",
  "Vom Warten",
  "Feuilleton",
  `
Vom Warten

Es gibt kaum eine Tätigkeit, die so verrufen ist wie das Warten. Wir warten an Supermarktkassen, in Arztpraxen, auf verspätete Züge und auf Antworten, die nicht kommen, und fast immer empfinden wir diese Zeit als gestohlen. Eine ganze Industrie lebt davon, uns das Warten zu ersparen: Expresslieferungen versprechen die Ware noch am selben Tag, Streamingdienste haben die Vorfreude auf die nächste Folge abgeschafft, indem sie alle Episoden auf einmal bereitstellen.

Dabei lohnt es sich, einen Moment innezuhalten und zu fragen, was mit dem Warten eigentlich verloren ginge. Wer als Kind wochenlang auf einen Geburtstag hingefiebert hat, weiß, dass die Vorfreude bisweilen schöner war als das Fest selbst. Das Warten dehnt das Ereignis in die Zeit hinein, es verleiht ihm Gewicht, gerade weil es sich entzieht. Ein Brief, auf den man zehn Tage gewartet hat, wird anders gelesen als eine Nachricht, die im Sekundentakt eintrifft. Und wer je auf einem Bahnsteig einen geliebten Menschen erwartet hat, kennt jene gespannte Aufmerksamkeit, mit der man jeden einfahrenden Zug mustert.

Freilich wäre es wohlfeil, das Warten zu verklären. Wer stundenlang in einer Behörde ausharrt oder bang auf einen ärztlichen Befund wartet, dem erscheint jedes Lob der Langsamkeit wie Hohn. Auch ist Wartezeit ungleich verteilt: Wer über Geld und Beziehungen verfügt, kann sich den Platz in der Schlange häufig erkaufen, während andere sie nie verlassen. Das Warten, so könnte man zuspitzen, ist nicht zuletzt eine Frage der Macht: Wer andere warten lässt, demonstriert, dass seine Zeit kostbarer ist als die ihre.

Und doch scheint uns mit der Fähigkeit zu warten etwas abhandenzukommen, das über bloße Geduld hinausgeht. In den leeren Minuten an der Bushaltestelle, die früher niemand zu füllen vermochte, schweiften die Gedanken ab, formten sich Einfälle, meldete sich bisweilen auch das Unbehagen, dem man sonst geschickt ausweicht. Heute greifen wir reflexhaft zum Telefon, sobald sich eine Lücke auftut. Die Leere wird nicht mehr ausgehalten, sondern sofort verwaltet.

Vielleicht ist die eigentliche Kunst also nicht, weniger zu warten, sondern anders: das Warten nicht als verlorene Zeit zu begreifen, sondern als eine Zeit, die ausnahmsweise niemandem gehört, nicht dem Arbeitgeber, nicht den Algorithmen, nicht einmal den eigenen Plänen. Wer das vermag, dem wird die Schlange an der Kasse zwar nicht kürzer, aber womöglich weniger lang.
`,
);

const c2Uebersetzen = text(
  "r-c2-uebersetzen",
  "C2",
  "Die Unsichtbaren",
  "Literatur und Übersetzung",
  `
Die Unsichtbaren

Übersetzerinnen und Übersetzer literarischer Werke führen ein merkwürdiges Doppelleben. Gelingt ihre Arbeit, bemerkt sie niemand; man lobt den Stil des Autors, als hätte er selbst auf Deutsch geschrieben. Misslingt sie, fällt der Makel sofort auf sie zurück. Diese Unsichtbarkeit galt lange als Tugend des Berufs, gar als sein Ideal: Die beste Übersetzung sei jene, die sich nicht als solche zu erkennen gebe.

Seit maschinelle Übersetzungsprogramme Texte in Sekundenschnelle und in erstaunlicher Qualität übertragen, gewinnt diese alte Frage eine unerwartete Brisanz. Wenn eine Übersetzung umso besser ist, je weniger man ihr die Übersetzerin anmerkt, was spräche dann dagegen, sie gleich ganz durch eine Software zu ersetzen, die per Definition keine Handschrift hat?

Die Antwort liegt in einem Missverständnis dessen, was Übersetzen eigentlich bedeutet. Wer einen Roman überträgt, trifft auf jeder Seite Dutzende Entscheidungen, für die es keine richtige Lösung gibt, sondern nur mehr oder minder vertretbare. Soll der Dialekt einer Figur durch einen deutschen Dialekt wiedergegeben werden, der unweigerlich falsche regionale Assoziationen weckt, oder durch eine neutrale Sprache, die den sozialen Abstand zwischen den Figuren einebnet? Soll ein Wortspiel erhalten bleiben, auch wenn dafür die wörtliche Bedeutung geopfert werden muss? Und wie überträgt man einen Satz, dessen Rhythmus im Original ebenso viel trägt wie sein Inhalt? Jede dieser Entscheidungen ist eine Interpretation, und Interpretation setzt ein Verständnis des Ganzen voraus, das über die statistische Wahrscheinlichkeit von Wortfolgen hinausgeht.

Das heißt nicht, dass die Programme nutzlos wären. Viele Übersetzerinnen setzen sie längst als Werkzeug ein, etwa für einen ersten Rohentwurf, den sie anschließend Satz für Satz überarbeiten. Manche berichten allerdings, dass gerade dieses Verfahren tückisch sei: Der glatte maschinelle Vorschlag wirke so plausibel, dass man ihn leicht übernehme, obwohl man selbst anders formuliert hätte. Die Maschine prägt damit unmerklich den Ton, und das Ergebnis klingt zwar fehlerfrei, aber seltsam austauschbar.

So könnte die Konkurrenz durch die Software paradoxerweise dazu führen, dass die Unsichtbarkeit der Übersetzer als Ideal ausgedient hat. Verlage beginnen bereits, die Namen der Übersetzenden auf den Buchumschlag zu drucken, und in Rezensionen wird ihre Arbeit zunehmend eigens gewürdigt. Manche Übersetzer treten inzwischen sogar gemeinsam mit den Autoren bei Lesungen auf. Was bislang als Makel galt, die eigene Stimme im fremden Text, erscheint nun als das, was den menschlichen Übersetzer unersetzlich macht.
`,
);

const c2Glueck = text(
  "r-c2-glueck",
  "C2",
  "Das Glück in Zahlen",
  "Gesellschaft und Forschung",
  `
Das Glück in Zahlen

Seit einigen Jahrzehnten versuchen Ökonomen, etwas zu messen, das sich der Messung hartnäckig zu entziehen scheint: das Glück. Die Methode ist denkbar schlicht. Man fragt Menschen, wie zufrieden sie auf einer Skala von null bis zehn mit ihrem Leben insgesamt sind, und vergleicht die Antworten über Länder, Einkommensgruppen und Jahre hinweg. Zusätzlich werden Faktoren wie Gesundheit, Einkommen und soziale Beziehungen erfasst, um die Unterschiede zu erklären. Aus solchen Umfragen entstehen die alljährlich veröffentlichten Ranglisten, in denen skandinavische Länder verlässlich die vorderen Plätze belegen.

Die Einwände liegen nahe. Kann man einer Zahl trauen, die jemand spontan am Telefon nennt, womöglich an einem verregneten Montag? Erstaunlicherweise erweisen sich die Angaben als recht stabil, und sie korrelieren mit Einschätzungen von Freunden und Angehörigen ebenso wie mit gesundheitlichen Daten. Grundsätzlicher ist ein anderer Einwand: Die Frage nach der Lebenszufriedenheit misst weniger, wie sich Menschen im Alltag fühlen, als vielmehr, wie sie ihr Leben rückblickend bewerten. Beides fällt keineswegs zusammen. Eltern kleiner Kinder etwa berichten häufig von anstrengenden, wenig vergnüglichen Tagen und bezeichnen ihr Leben dennoch als sinnerfüllt.

Hinzu kommt ein kulturelles Problem. In manchen Sprachen und Gesellschaften gilt es als unbescheiden, sich als rundum glücklich zu bezeichnen, in anderen gehört demonstrativer Optimismus gewissermaßen zum guten Ton. Ob ein Unterschied von einem halben Punkt zwischen zwei Ländern tatsächlich unterschiedliche Lebensverhältnisse abbildet oder lediglich unterschiedliche Antwortgewohnheiten, lässt sich kaum entscheiden. Selbst die Übersetzung der Frage kann das Ergebnis beeinflussen, zumal das deutsche Wort „Glück“ sowohl den glücklichen Zufall als auch die Zufriedenheit bezeichnet.

Gleichwohl wäre es voreilig, die Glücksforschung deshalb als Zahlenspielerei abzutun. Ihr eigentlicher Ertrag liegt weniger in den Ranglisten als in den Zusammenhängen, die sie innerhalb von Gesellschaften sichtbar macht: etwa dass Arbeitslosigkeit die Zufriedenheit weit stärker und dauerhafter mindert, als der bloße Einkommensverlust erwarten ließe, oder dass lange Pendelwege Menschen erstaunlich unglücklich machen, obwohl sie sich scheinbar freiwillig dafür entschieden haben. Solche Befunde haben mit der romantischen Vorstellung vom Glück wenig zu tun, sind aber für die Gestaltung von Städten, Arbeitsmärkten und Sozialsystemen von erheblichem Wert.

Die Zahl auf der Skala, so ließe sich resümieren, sagt wenig darüber aus, was Glück ist. Sie verrät aber einiges darüber, was ihm im Wege steht.
`,
);

const warten = forText("C2", c2Warten.key);
const uebersetzen = forText("C2", c2Uebersetzen.key);
const glueck = forText("C2", c2Glueck.key);

const c2Items: SeedItem[] = [
  warten.choice(
    "gist",
    "EASY",
    "Welche Haltung nimmt der Autor zum Warten ein?",
    [
      "Er fordert, Wartezeiten mit moderner Technik abzuschaffen.",
      "Er verteidigt den Wert des Wartens, ohne dessen Schattenseiten zu leugnen.",
      "Er hält Warten für reine Zeitverschwendung.",
      "Er beschreibt Warten ausschließlich als Machtinstrument.",
    ],
    "b",
    "Der Autor lobt die Vorfreude und die leeren Minuten, räumt aber im dritten Absatz ein, es wäre „wohlfeil, das Warten zu verklären“.",
  ),
  warten.choice(
    "vocabulary",
    "MID",
    "„Freilich wäre es wohlfeil, das Warten zu verklären.“ Was bedeutet „wohlfeil“ in diesem Zusammenhang?",
    ["mutig und originell", "wissenschaftlich belegt", "gesundheitlich bedenklich", "allzu billig und bequem"],
    "d",
    "„Wohlfeil“ bedeutet ursprünglich „billig“; hier ist ein Argument gemeint, das man sich zu leicht macht, wie die folgenden Gegenbeispiele zeigen.",
  ),
  warten.choice(
    "inference",
    "HARD",
    "Wie ist der letzte Satz des Textes zu verstehen?",
    [
      "Die Wartezeit bleibt objektiv gleich, wird aber subjektiv anders erlebt.",
      "Wer geduldig ist, kommt tatsächlich schneller an die Reihe.",
      "Der Autor widerspricht sich absichtlich, um die Leser zu verwirren.",
      "Die Schlangen an den Kassen werden in Zukunft kürzer werden.",
    ],
    "a",
    "„Nicht kürzer“ meint die gemessene Zeit, „weniger lang“ das Empfinden dessen, der das Warten als freie Zeit begreift.",
  ),
  warten.tfng(
    "detail",
    "HARD",
    [
      ["Der Autor hält Wartezeit für gerecht zwischen allen Menschen verteilt.", "F"],
      ["Streamingdienste stellen laut Text oft alle Folgen einer Serie auf einmal bereit.", "R"],
      ["Der Autor selbst lässt an der Bushaltestelle sein Telefon in der Tasche.", "NG"],
    ],
    "„Auch ist Wartezeit ungleich verteilt“; Streamingdienste stellen „alle Episoden auf einmal“ bereit; über das eigene Verhalten des Autors sagt der Text nichts.",
  ),

  uebersetzen.choice(
    "gist",
    "EASY",
    "Welche These vertritt der Text?",
    [
      "Maschinelle Übersetzung wird literarische Übersetzer bald vollständig ersetzen.",
      "Übersetzer sollten Wortspiele grundsätzlich wörtlich übertragen.",
      "Weil Übersetzen Interpretation ist, wird die eigene Stimme der Übersetzer zu ihrem entscheidenden Wert.",
      "Verlage sollten ganz auf maschinelle Übersetzung verzichten.",
    ],
    "c",
    "Der dritte Absatz nennt jede Entscheidung „eine Interpretation“; der Schluss erklärt die eigene Stimme zu dem, was Übersetzer „unersetzlich macht“.",
  ),
  uebersetzen.choice(
    "inference",
    "HARD",
    "Warum kann es laut Text tückisch sein, mit einem maschinellen Rohentwurf zu arbeiten?",
    [
      "Weil die Programme viele grammatische Fehler machen",
      "Weil der plausible Vorschlag unmerklich die eigene Formulierung verdrängt",
      "Weil Verlage solche Entwürfe nicht akzeptieren",
      "Weil die Überarbeitung länger dauert als eine eigene Übersetzung",
    ],
    "b",
    "Vierter Absatz: Der glatte Vorschlag wird übernommen, „obwohl man selbst anders formuliert hätte“; das Ergebnis ist fehlerfrei, aber austauschbar.",
  ),
  uebersetzen.match(
    "vocabulary",
    "HARD",
    "Ordnen Sie den Ausdrücken aus dem Text die passende Bedeutung zu. Eine Bedeutung bleibt übrig.",
    ["Doppelleben", "Brisanz", "einebnen", "tückisch"],
    [
      "Aktualität und Sprengkraft",
      "Unterschiede verschwinden lassen",
      "mit verborgenen Gefahren",
      "zwei gegensätzliche Rollen zugleich",
      "große Beliebtheit bei Lesern",
    ],
    [4, 1, 2, 3],
    "Doppelleben: unsichtbar bei Erfolg, schuldig bei Misserfolg; Brisanz: die alte Frage wird plötzlich heikel; einebnen: den sozialen Abstand aufheben; tückisch: scheinbar harmlos, aber gefährlich.",
  ),
  uebersetzen.tfng(
    "detail",
    "HARD",
    [
      ["Lange galt es als Ideal, dass man einer Übersetzung die Übersetzerin nicht anmerkt.", "R"],
      ["Der Autor hält maschinelle Übersetzungsprogramme für nutzlos.", "F"],
      ["Für die Überarbeitung maschineller Entwürfe werden Übersetzer schlechter bezahlt.", "NG"],
    ],
    "Die Unsichtbarkeit galt als „Ideal“; „Das heißt nicht, dass die Programme nutzlos wären“; über Honorare sagt der Text nichts.",
  ),

  glueck.choice(
    "gist",
    "EASY",
    "Welche Bilanz zieht der Autor?",
    [
      "Die Ranglisten sind fragwürdig, die Forschung zeigt aber, was dem Glück im Weg steht.",
      "Glücksforschung ist eine bloße Zahlenspielerei.",
      "Die Ranglisten zeigen zuverlässig, wo die glücklichsten Menschen leben.",
      "Glück lässt sich nur über das Einkommen messen.",
    ],
    "a",
    "Der Schluss: Die Zahl sagt wenig darüber, was Glück ist, „verrät aber einiges darüber, was ihm im Wege steht“.",
  ),
  glueck.match(
    "structure",
    "HARD",
    "Wofür dient das jeweilige Beispiel im Text als Beleg? Eine Aussage bleibt übrig.",
    ["der verregnete Montag", "Eltern kleiner Kinder", "Arbeitslosigkeit", "lange Pendelwege"],
    [
      "Menschen wählen freiwillig etwas, das ihre Zufriedenheit mindert.",
      "Rückblickende Bewertung und Alltagsgefühl fallen auseinander.",
      "Zweifel an der Verlässlichkeit spontaner Angaben",
      "Ein Verlust wiegt schwerer als das fehlende Einkommen allein.",
      "Reiche Länder sind grundsätzlich glücklicher.",
    ],
    [3, 2, 4, 1],
    "Jedes Beispiel steht direkt beim jeweiligen Argument (Absätze 2 und 4); ein Zusammenhang zwischen Reichtum und Glück wird nicht behauptet.",
  ),
  glueck.choice(
    "vocabulary",
    "MID",
    "Was bedeutet „zum guten Ton gehören“ im dritten Absatz?",
    ["laut ausgesprochen werden", "musikalisch begabt sein", "als unhöflich gelten", "als angemessen und üblich gelten"],
    "d",
    "Der Ausdruck steht im Gegensatz zu „gilt es als unbescheiden“: In manchen Kulturen ist Optimismus sozial erwartet.",
  ),
  glueck.tfng(
    "detail",
    "HARD",
    [
      ["Laut Text schwanken die Angaben zur Lebenszufriedenheit stark von Tag zu Tag.", "F"],
      ["Unterschiedliche Antwortgewohnheiten können Vergleiche zwischen Ländern verzerren.", "R"],
      ["Skandinavische Länder haben laut Text die niedrigste Arbeitslosigkeit.", "NG"],
    ],
    "Die Angaben erweisen sich „als recht stabil“; der dritte Absatz nennt Antwortgewohnheiten; zur Arbeitslosigkeit in Skandinavien steht nichts im Text.",
  ),
];

export const reading: SeedBankPart = {
  stimuli: [
    a1Notiz,
    a1Fahrrad,
    a1Bibliothek,
    a2Umzug,
    a2Kochkurs,
    a2Schulgarten,
    b1Homeoffice,
    b1Repaircafe,
    b1Norwegen,
    b2Schlaf,
    b2Langeweile,
    b2Stadtbaeume,
    c1Mehrsprachigkeit,
    c1Nachtzug,
    c1CitizenScience,
    c2Warten,
    c2Uebersetzen,
    c2Glueck,
  ],
  items: [...a1Items, ...a2Items, ...b1Items, ...b2Items, ...c1Items, ...c2Items],
};
