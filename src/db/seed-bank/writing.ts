import type { SeedBankPart, SeedItem } from "./types";

/*
 * A seed item's text is part of its seed key (seed-key.ts). Changing the
 * wording of an item here makes it a new item: the bank top-up then adds it
 * next to the old one in every organisation that already has the old one. To
 * fix wording, add a new item (and retire the old row) rather than editing.
 */

/**
 * Starter writing tasks, four per CEFR level. Scored by a teacher against the
 * rubric: the content points say what a complete answer covers, the register
 * says how the reader is addressed.
 */

type Level = SeedItem["level"];
type Within = NonNullable<SeedItem["within"]>;

const INFORMAL = "informell (du)";
const FORMAL = "formell (Sie)";
const NEUTRAL = "neutral/sachlich";

function task(
  level: Level,
  skill: string,
  within: Within,
  words: [number, number],
  prompt: string,
  contentPoints: string[],
  register: string,
): SeedItem {
  return {
    section: "WRITING",
    level,
    type: "WRITING_PROMPT",
    skillTag: `writing.${skill}`,
    within,
    prompt,
    content: { kind: "WRITING", minWords: words[0], maxWords: words[1] },
    key: { kind: "NONE" },
    rubric: { contentPoints, register },
  };
}

const items: SeedItem[] = [
  // ---------------------------------------------------------------- A1
  task("A1", "note", "EASY", [20, 40],
    "Sie können heute Abend nicht mit Ihrem Freund Paul ins Kino gehen. Schreiben Sie Paul eine kurze Nachricht.\n\n" +
      "- Sagen Sie, dass Sie nicht kommen können.\n" +
      "- Warum nicht?\n" +
      "- Schlagen Sie einen anderen Tag vor.",
    [
      "Absage: kann heute nicht ins Kino kommen",
      "ein einfacher Grund (z. B. krank, muss arbeiten)",
      "Vorschlag für einen anderen Tag",
      "Anrede und Gruß (Hallo Paul ... / Viele Grüße)",
    ],
    INFORMAL),
  task("A1", "postcard", "MID", [20, 40],
    "Sie sind im Urlaub. Schreiben Sie eine Postkarte an Ihre Freundin Julia.\n\n" +
      "- Wo sind Sie?\n" +
      "- Wie ist das Wetter?\n" +
      "- Was machen Sie jeden Tag?\n" +
      "- Wann kommen Sie zurück?",
    [
      "Ort des Urlaubs",
      "Wetter",
      "eine oder zwei tägliche Aktivitäten",
      "Tag oder Datum der Rückkehr",
    ],
    INFORMAL),
  task("A1", "invitation", "MID", [20, 40],
    "Sie haben am Samstag Geburtstag und machen eine Party. Schreiben Sie Ihrem Kollegen Tom eine kurze E-Mail.\n\n" +
      "- Laden Sie Tom ein.\n" +
      "- Wann und wo ist die Party?\n" +
      "- Was soll Tom mitbringen?",
    [
      "Einladung zur Geburtstagsparty",
      "Tag, Uhrzeit und Ort",
      "Bitte, etwas mitzubringen (z. B. Getränke, Salat, Musik)",
      "Anrede und Gruß (Hallo Tom ... / Bis Samstag)",
    ],
    INFORMAL),
  task("A1", "formal", "HARD", [20, 40],
    "Sie möchten an der Volkshochschule einen Deutschkurs machen. Schreiben Sie eine E-Mail an die Volkshochschule.\n\n" +
      "- Sagen Sie, welchen Kurs Sie suchen.\n" +
      "- Wann haben Sie Zeit?\n" +
      "- Fragen Sie nach dem Preis.",
    [
      "Kurswunsch (z. B. Deutsch A1, Anfänger)",
      "Wochentage oder Tageszeit, an denen man Zeit hat",
      "Frage nach dem Preis",
      "formelle Anrede und Gruß (Sehr geehrte Damen und Herren ... / Mit freundlichen Grüßen)",
    ],
    FORMAL),

  // ---------------------------------------------------------------- A2
  task("A2", "email", "MID", [40, 70],
    "Sie sind vor zwei Wochen in eine neue Wohnung umgezogen. Schreiben Sie Ihrer Freundin Sofia eine E-Mail.\n\n" +
      "- Beschreiben Sie die neue Wohnung.\n" +
      "- Was gefällt Ihnen in der neuen Umgebung, was nicht?\n" +
      "- Laden Sie Sofia zu einem Besuch ein und nennen Sie einen Termin.",
    [
      "Beschreibung der Wohnung (Zimmer, Größe, Lage o. Ä.)",
      "etwas Positives und etwas Negatives an der Umgebung",
      "Einladung mit konkretem Termin",
      "passende Anrede und Gruß",
    ],
    INFORMAL),
  task("A2", "email", "HARD", [40, 70],
    "Sie können nächste Woche nicht zum Deutschkurs kommen. Schreiben Sie Ihrer Kursleiterin, Frau Berger, eine E-Mail.\n\n" +
      "- Entschuldigen Sie sich.\n" +
      "- Nennen Sie den Grund.\n" +
      "- Fragen Sie nach den Hausaufgaben.\n" +
      "- Sagen Sie, wann Sie wieder kommen.",
    [
      "Entschuldigung",
      "Grund für das Fehlen",
      "Frage nach Hausaufgaben oder Material",
      "Angabe, ab wann man wieder teilnimmt",
    ],
    FORMAL),
  task("A2", "reply", "EASY", [40, 70],
    "Ihr Freund Jonas hat Sie zu seiner Grillparty am Samstag eingeladen. Sie können erst später kommen. Schreiben Sie Jonas eine E-Mail.\n\n" +
      "- Bedanken Sie sich für die Einladung.\n" +
      "- Sagen Sie, warum Sie später kommen und wann Sie da sind.\n" +
      "- Fragen Sie, was Sie mitbringen sollen.",
    [
      "Dank für die Einladung",
      "Grund für das spätere Kommen",
      "ungefähre Uhrzeit der Ankunft",
      "Frage, was man mitbringen soll; passende Anrede und Gruß",
    ],
    INFORMAL),
  task("A2", "application", "MID", [40, 70],
    "Sie haben eine Anzeige gelesen: Das Café Sonnenschein sucht eine Aushilfe für das Wochenende. Schreiben Sie eine E-Mail an das Café.\n\n" +
      "- Sagen Sie, dass Sie Interesse haben.\n" +
      "- Schreiben Sie etwas über sich (Alter, Erfahrung, Sprachen).\n" +
      "- Wann können Sie arbeiten?\n" +
      "- Fragen Sie nach dem Lohn.",
    [
      "Bezug auf die Anzeige und Interesse an der Stelle",
      "Angaben zur eigenen Person und Erfahrung",
      "mögliche Arbeitszeiten",
      "Frage nach dem Lohn; formelle Anrede und Gruß",
    ],
    FORMAL),

  // ---------------------------------------------------------------- B1
  task("B1", "forum", "MID", [80, 120],
    "In einem Online-Forum wird diskutiert: „Einkaufen im Internet oder im Geschäft, was ist besser?“ Schreiben Sie einen Beitrag.\n\n" +
      "- Wie kaufen Sie selbst meistens ein?\n" +
      "- Nennen Sie Vorteile des Online-Einkaufs.\n" +
      "- Nennen Sie Vorteile des Einkaufens im Geschäft.\n" +
      "- Was ist Ihre Meinung? Begründen Sie sie.",
    [
      "eigene Einkaufsgewohnheiten",
      "mindestens ein Vorteil des Online-Einkaufs",
      "mindestens ein Vorteil des Einkaufens im Geschäft",
      "eigene Meinung mit Begründung",
    ],
    NEUTRAL),
  task("B1", "complaint", "HARD", [80, 120],
    "Sie haben bei einem Online-Shop eine Kaffeemaschine bestellt. Die Lieferung kam eine Woche zu spät, und die Maschine funktioniert nicht richtig. Schreiben Sie eine Beschwerde an den Kundenservice.\n\n" +
      "- Beschreiben Sie, was Sie bestellt haben und wann.\n" +
      "- Erklären Sie die Probleme.\n" +
      "- Sagen Sie, was Sie jetzt erwarten.\n" +
      "- Bitten Sie um eine schnelle Antwort.",
    [
      "Angaben zur Bestellung (Produkt, Datum, ggf. Bestellnummer)",
      "beide Probleme: verspätete Lieferung und Defekt",
      "klare Forderung (Umtausch, Reparatur oder Geld zurück)",
      "Bitte um Antwort, formeller Briefschluss",
    ],
    FORMAL),
  task("B1", "email", "EASY", [80, 120],
    "Ihre Freundin Clara möchte nächstes Jahr für sechs Monate in Ihrer Stadt arbeiten und bittet Sie um Tipps. Schreiben Sie Clara eine E-Mail.\n\n" +
      "- Reagieren Sie auf Claras Plan.\n" +
      "- Geben Sie Tipps zur Wohnungssuche.\n" +
      "- Beschreiben Sie, was man in Ihrer Stadt in der Freizeit machen kann.\n" +
      "- Bieten Sie Ihre Hilfe an.",
    [
      "persönliche Reaktion auf den Plan",
      "mindestens ein konkreter Tipp zur Wohnungssuche",
      "Freizeitmöglichkeiten in der Stadt",
      "konkretes Hilfsangebot, passende Anrede und Gruß",
    ],
    INFORMAL),
  task("B1", "application", "MID", [80, 120],
    "Sie möchten in den Sommerferien vier Wochen in einem Hotel am Bodensee arbeiten. Schreiben Sie eine E-Mail an das Hotel Seeblick.\n\n" +
      "- Stellen Sie sich kurz vor.\n" +
      "- Erklären Sie, warum Sie sich für die Stelle interessieren.\n" +
      "- Beschreiben Sie Ihre Erfahrungen und Sprachkenntnisse.\n" +
      "- Fragen Sie nach Arbeitszeiten und Unterkunft.",
    [
      "kurze Vorstellung (Name, Alter, Ausbildung oder Beruf)",
      "Motivation für die Stelle",
      "Erfahrungen und Sprachkenntnisse",
      "Fragen zu Arbeitszeiten und Unterkunft; formeller Briefschluss",
    ],
    FORMAL),

  // ---------------------------------------------------------------- B2
  task("B2", "argument", "MID", [150, 200],
    "In Ihrem Land wird diskutiert, ob junge Menschen nach der Schule ein verpflichtendes soziales Jahr leisten sollen, zum Beispiel in einem Krankenhaus, einem Altenheim oder im Umweltschutz. Schreiben Sie einen argumentativen Text für die Schülerzeitung Ihrer ehemaligen Schule.\n\n" +
      "- Stellen Sie das Thema kurz vor.\n" +
      "- Nennen Sie Argumente dafür.\n" +
      "- Nennen Sie Argumente dagegen.\n" +
      "- Formulieren Sie Ihre eigene Position und begründen Sie sie.",
    [
      "Einleitung mit Hinführung zum Thema",
      "mindestens zwei Argumente für ein Pflichtjahr",
      "mindestens zwei Argumente gegen ein Pflichtjahr",
      "begründete eigene Position, logisch verknüpfter Aufbau",
    ],
    NEUTRAL),
  task("B2", "formal", "HARD", [150, 200],
    "Die Stadtbibliothek Ihrer Stadt will aus Kostengründen ab dem nächsten Monat samstags schließen und die Öffnungszeiten unter der Woche verkürzen. Schreiben Sie einen Brief an die Leitung der Bibliothek.\n\n" +
      "- Nennen Sie den Grund Ihres Schreibens.\n" +
      "- Erklären Sie, wofür Sie und andere die Bibliothek nutzen.\n" +
      "- Beschreiben Sie die Folgen der Schließung.\n" +
      "- Machen Sie einen konstruktiven Vorschlag.",
    [
      "Anlass des Schreibens klar benannt",
      "Nutzung der Bibliothek durch sich selbst und andere Gruppen",
      "mögliche Folgen der geplanten Änderungen",
      "realistischer Alternativvorschlag (z. B. Ehrenamt, andere Schließtage, Gebühren)",
    ],
    FORMAL),
  task("B2", "report", "EASY", [150, 200],
    "Ein Bildungsportal sammelt Erfahrungsberichte über Auslandsaufenthalte. Schreiben Sie einen Beitrag über einen längeren Aufenthalt im Ausland (Studium, Praktikum, Arbeit oder Sprachkurs).\n\n" +
      "- Beschreiben Sie, wo und wie lange Sie waren und warum.\n" +
      "- Vergleichen Sie Ihre Erwartungen mit der Wirklichkeit.\n" +
      "- Berichten Sie von einer Schwierigkeit und wie Sie sie gelöst haben.\n" +
      "- Geben Sie anderen eine begründete Empfehlung.",
    [
      "Ort, Dauer und Anlass des Aufenthalts",
      "Vergleich von Erwartungen und Wirklichkeit",
      "konkrete Schwierigkeit mit Lösung",
      "begründete Empfehlung, zusammenhängender Text mit passenden Konnektoren",
    ],
    NEUTRAL),
  task("B2", "request", "MID", [150, 200],
    "Sie möchten Ihre Arbeitszeit für ein Jahr auf 30 Stunden pro Woche reduzieren, um eine berufsbegleitende Weiterbildung zu machen. Schreiben Sie eine E-Mail an Ihre Vorgesetzte, Frau Dr. Lehmann.\n\n" +
      "- Nennen Sie Ihr Anliegen.\n" +
      "- Begründen Sie es und erklären Sie, welchen Nutzen die Weiterbildung auch für die Firma hat.\n" +
      "- Machen Sie einen Vorschlag, wie Ihre Aufgaben in dieser Zeit erledigt werden können.\n" +
      "- Bitten Sie um ein Gespräch.",
    [
      "klares Anliegen mit Zeitraum und Stundenzahl",
      "Begründung mit Nutzen für die Firma",
      "realistischer Vorschlag zur Verteilung der Aufgaben",
      "Bitte um ein Gespräch, höflicher und formeller Ton",
    ],
    FORMAL),

  // ---------------------------------------------------------------- C1
  task("C1", "essay", "MID", [200, 260],
    "Eine Umfrage hat ermittelt, wie viele Erwerbstätige in einem Land zumindest gelegentlich von zu Hause aus arbeiten: 2019 waren es 13 Prozent, 2021 25 Prozent, 2023 24 Prozent und 2025 23 Prozent. Schreiben Sie eine Stellungnahme für ein Wirtschaftsmagazin.\n\n" +
      "- Beschreiben Sie die Entwicklung, die die Zahlen zeigen.\n" +
      "- Nennen Sie mögliche Gründe für diese Entwicklung.\n" +
      "- Wägen Sie Vor- und Nachteile des Arbeitens von zu Hause ab.\n" +
      "- Formulieren Sie eine Einschätzung, wie sich die Arbeitswelt weiter verändern wird.",
    [
      "korrekte Beschreibung der Zahlen: starker Anstieg bis 2021, danach leichter Rückgang auf hohem Niveau",
      "plausible Gründe für Anstieg und Stabilisierung",
      "ausgewogene Abwägung von Vor- und Nachteilen",
      "begründete Prognose, klare Gliederung mit Einleitung und Schluss",
    ],
    NEUTRAL),
  task("C1", "essay", "HARD", [200, 260],
    "Sollten Arbeitgeber gesetzlich verpflichtet werden, allen Beschäftigten jedes Jahr mindestens fünf bezahlte Weiterbildungstage zu gewähren? Schreiben Sie eine Erörterung.\n\n" +
      "- Erläutern Sie, warum Weiterbildung heute an Bedeutung gewinnt.\n" +
      "- Stellen Sie Argumente von Beschäftigten und Arbeitgebern gegenüber.\n" +
      "- Gehen Sie auf mögliche Probleme kleiner Betriebe ein.\n" +
      "- Kommen Sie zu einem differenzierten Urteil.",
    [
      "Einordnung des Themas (z. B. technischer Wandel, Fachkräftemangel)",
      "Argumente beider Seiten, nicht nur aufgezählt, sondern gewichtet",
      "Berücksichtigung kleiner Betriebe",
      "differenziertes, begründetes Fazit; Kohärenz und präziser Wortschatz",
    ],
    NEUTRAL),
  task("C1", "forum", "EASY", [150, 200],
    "In einem Online-Forum einer Wochenzeitung wird die Frage diskutiert: „Sollte das Wahlalter bei allen Wahlen auf 16 Jahre gesenkt werden?“ Schreiben Sie einen Beitrag.\n\n" +
      "- Beziehen Sie sich auf die Frage und nehmen Sie eine klare Position ein.\n" +
      "- Stützen Sie Ihre Position mit mindestens zwei Argumenten.\n" +
      "- Gehen Sie auf ein mögliches Gegenargument ein.\n" +
      "- Schließen Sie mit einer Schlussfolgerung oder einem Vorschlag.",
    [
      "klare Position mit Bezug auf die Frage",
      "mindestens zwei tragfähige Argumente",
      "Auseinandersetzung mit einem Gegenargument",
      "pointierter Schluss; präziser, variierter Wortschatz",
    ],
    NEUTRAL),
  task("C1", "formal", "MID", [200, 260],
    "Ihre Hochschule plant, alle großen Vorlesungen der ersten Semester künftig nur noch online anzubieten. Schreiben Sie als Mitglied der Studierendenvertretung eine Stellungnahme an die Hochschulleitung.\n\n" +
      "- Nehmen Sie Bezug auf die geplante Änderung.\n" +
      "- Erläutern Sie die möglichen Folgen für Studienanfänger.\n" +
      "- Erkennen Sie nachvollziehbare Gründe der Hochschulleitung an.\n" +
      "- Unterbreiten Sie einen begründeten Gegenvorschlag.",
    [
      "sachlicher Bezug auf die geplante Änderung",
      "differenzierte Darstellung der Folgen für Studienanfänger",
      "Anerkennung nachvollziehbarer Gründe (z. B. Raumnot, Kosten, Flexibilität)",
      "begründeter Gegenvorschlag, durchgehend formelles Register",
    ],
    FORMAL),

  // ---------------------------------------------------------------- C2
  task("C2", "commentary", "MID", [250, 320],
    "Schreiben Sie für die Meinungsseite einer überregionalen Zeitung einen Kommentar zum Thema „Die ständige Erreichbarkeit“.\n\n" +
      "- Beginnen Sie mit einem pointierten Einstieg, etwa einer Beobachtung aus dem Alltag.\n" +
      "- Entwickeln Sie eine klare These und stützen Sie sie mit Argumenten und Beispielen.\n" +
      "- Nehmen Sie mindestens einen Gegeneinwand ernst und entkräften oder relativieren Sie ihn.\n" +
      "- Setzen Sie stilistische Mittel bewusst ein (z. B. rhetorische Frage, Kontrast, sparsame Ironie) und schließen Sie mit einer prägnanten Schlussfolgerung.",
    [
      "origineller, pointierter Einstieg",
      "klare These mit überzeugenden Argumenten und Beispielen",
      "ernsthafte Auseinandersetzung mit einem Gegenargument",
      "bewusster, textsortengerechter Stil und prägnanter Schluss",
    ],
    NEUTRAL),
  task("C2", "review", "HARD", [250, 320],
    "Ein Kulturmagazin sucht Rezensionen seiner Leserinnen und Leser. Besprechen Sie ein Buch, einen Film oder eine Ausstellung, die Sie gut kennen.\n\n" +
      "- Ordnen Sie das Werk kurz ein, ohne den Inhalt nur nachzuerzählen.\n" +
      "- Bewerten Sie Stärken und Schwächen anhand konkreter Beispiele.\n" +
      "- Richten Sie Ihre Bewertung an einem gebildeten, aber nicht fachkundigen Publikum aus.\n" +
      "- Formulieren Sie ein abgewogenes Urteil und sagen Sie, wem Sie das Werk empfehlen.",
    [
      "knappe Einordnung statt reiner Inhaltsangabe",
      "begründete Bewertung mit konkreten Beispielen",
      "stilistisch variierte, adressatengerechte Sprache",
      "abgewogenes Urteil mit Empfehlung für eine Zielgruppe",
    ],
    NEUTRAL),
  task("C2", "letter", "MID", [250, 320],
    "Eine Wochenzeitung hat einen Gastbeitrag mit der These veröffentlicht: „Die Geisteswissenschaften sind ein Luxus, den sich eine moderne Gesellschaft nicht mehr leisten kann.“ Schreiben Sie einen Leserbrief an die Redaktion.\n\n" +
      "- Geben Sie die Kernaussage des Beitrags knapp und fair wieder.\n" +
      "- Prüfen Sie die Voraussetzungen, auf denen die These beruht.\n" +
      "- Entwickeln Sie eine eigene, begründete Gegenposition oder eine differenzierte Zwischenposition.\n" +
      "- Wahren Sie bei aller Deutlichkeit einen sachlichen, gehobenen Ton.",
    [
      "knappe, faire Wiedergabe der These",
      "Prüfung der impliziten Voraussetzungen (z. B. Nutzenbegriff, Kostenargument)",
      "eigene, gut begründete Position mit Beispielen",
      "souveräner, gehobener Stil, der Schärfe und Sachlichkeit verbindet",
    ],
    FORMAL),
  task("C2", "argument", "HARD", [250, 320],
    "Schreiben Sie für eine Fachzeitschrift einen argumentativen Text zu der Frage: „Sollen Algorithmen bei der Vergabe von Studienplätzen, Krediten oder Arbeitsstellen mitentscheiden dürfen?“\n\n" +
      "- Klären Sie, was unter „mitentscheiden“ zu verstehen ist, und grenzen Sie die Frage ein.\n" +
      "- Wägen Sie Effizienz und Gleichbehandlung gegen Intransparenz und Verzerrungen ab.\n" +
      "- Beziehen Sie die Frage der Verantwortung bei Fehlentscheidungen ein.\n" +
      "- Formulieren Sie eine begründete Position mit konkreten Bedingungen.",
    [
      "begriffliche Klärung und Eingrenzung der Fragestellung",
      "ausgewogene Abwägung von Chancen und Risiken mit Beispielen",
      "Reflexion der Verantwortung bei Fehlentscheidungen",
      "präzise formulierte Position mit Bedingungen; stringente, stilistisch souveräne Argumentation",
    ],
    NEUTRAL),
];

export const writing: SeedBankPart = { stimuli: [], items };
