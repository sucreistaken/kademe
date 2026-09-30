import type { SeedBankPart, SeedItem } from "./types";

/**
 * Starter speaking tasks, three per CEFR level. The student thinks for
 * `thinkSeconds`, then records for up to `answerSeconds`. A teacher scores the
 * recording against the rubric. Students are addressed with Sie throughout.
 */

type Level = SeedItem["level"];
type Within = NonNullable<SeedItem["within"]>;

const TIMING: Record<Level, { thinkSeconds: number; answerSeconds: number; maxTakes: number }> = {
  A1: { thinkSeconds: 20, answerSeconds: 45, maxTakes: 2 },
  A2: { thinkSeconds: 30, answerSeconds: 60, maxTakes: 2 },
  B1: { thinkSeconds: 45, answerSeconds: 90, maxTakes: 2 },
  B2: { thinkSeconds: 60, answerSeconds: 120, maxTakes: 1 },
  C1: { thinkSeconds: 60, answerSeconds: 150, maxTakes: 1 },
  C2: { thinkSeconds: 60, answerSeconds: 180, maxTakes: 1 },
};

function task(
  level: Level,
  skill: "presentation" | "description" | "opinion" | "discussion",
  within: Within,
  prompt: string,
  contentPoints: string[],
  register?: string,
): SeedItem {
  return {
    section: "SPEAKING",
    level,
    type: "SPEAKING_PROMPT",
    skillTag: `speaking.${skill}`,
    within,
    prompt,
    content: { kind: "SPEAKING", ...TIMING[level] },
    key: { kind: "NONE" },
    rubric: register ? { contentPoints, register } : { contentPoints },
  };
}

const items: SeedItem[] = [
  // ---------------------------------------------------------------- A1
  task("A1", "presentation", "EASY",
    "Stellen Sie sich bitte vor. Sprechen Sie über diese Punkte: Name, Herkunft, Wohnort, Sprachen, Hobbys.",
    ["Name", "Herkunft und Wohnort", "Sprachen, die man spricht", "mindestens ein Hobby"]),
  task("A1", "description", "MID",
    "Erzählen Sie von Ihrer Familie. Wer gehört zu Ihrer Familie? Wo wohnen die Personen? Was machen sie?",
    ["mindestens zwei Familienmitglieder", "Wohnort der Personen", "Beruf oder Tätigkeit", "einfache, verständliche Sätze"]),
  task("A1", "description", "HARD",
    "Was essen und trinken Sie gern? Was essen Sie zum Frühstück? Was essen Sie nicht gern?",
    ["Lieblingsessen oder Lieblingsgetränk", "Frühstück", "etwas, das man nicht gern isst", "einfache Begründung oder Häufigkeit (z. B. oft, jeden Tag)"]),

  // ---------------------------------------------------------------- A2
  task("A2", "description", "EASY",
    "Beschreiben Sie einen normalen Arbeitstag oder Schultag. Wann stehen Sie auf? Was machen Sie am Vormittag, am Nachmittag und am Abend?",
    ["Uhrzeiten oder Tagesabschnitte", "Tätigkeiten in zeitlicher Reihenfolge", "Verbindungswörter (dann, danach, am Abend)", "trennbare Verben korrekt verwendet"]),
  task("A2", "description", "MID",
    "Erzählen Sie von Ihrem letzten Wochenende. Wo waren Sie? Mit wem? Was haben Sie gemacht, und wie hat es Ihnen gefallen?",
    ["Ort und Begleitung", "mindestens zwei Aktivitäten", "Bewertung (hat mir gefallen, weil ...)", "Perfekt überwiegend korrekt"]),
  task("A2", "description", "HARD",
    "Eine Freundin aus dem Ausland besucht Sie für ein Wochenende. Erzählen Sie, was man in Ihrer Stadt oder Region machen kann und was Sie ihr zeigen möchten.",
    ["mindestens zwei Sehenswürdigkeiten oder Aktivitäten", "Vorschlag für Essen oder Freizeit", "einfacher Plan (am Samstag ..., am Sonntag ...)", "kurze Begründung der Auswahl"]),

  // ---------------------------------------------------------------- B1
  task("B1", "opinion", "EASY",
    "Wohnen Sie lieber in der Stadt oder auf dem Land? Sagen Sie Ihre Meinung und begründen Sie sie. Nennen Sie auch einen Nachteil Ihrer Wahl.",
    ["klare Präferenz", "mindestens zwei Gründe", "ein Nachteil der eigenen Wahl", "Beispiele aus eigener Erfahrung"]),
  task("B1", "description", "MID",
    "Erzählen Sie von einer Situation, in der etwas nicht wie geplant gelaufen ist, zum Beispiel auf einer Reise, bei einem Fest oder bei der Arbeit. Was ist passiert, wie haben Sie reagiert, und was haben Sie daraus gelernt?",
    ["Beschreibung der Situation (wann, wo, wer)", "Verlauf des Problems", "eigene Reaktion und Lösung", "Rückblick: was man daraus gelernt hat"]),
  task("B1", "discussion", "HARD",
    "Ihre Lehrerin verlässt Ihre Sprachschule. Sie möchten mit der Klasse ein kleines Abschiedsfest organisieren. Erklären Sie Ihren Plan: Wann und wo soll das Fest stattfinden? Was soll es zu essen und zu trinken geben? Welches Geschenk schlagen Sie vor, und wer übernimmt welche Aufgabe?",
    ["Zeit und Ort mit Begründung", "Essen und Getränke", "Geschenkvorschlag", "Verteilung der Aufgaben"]),

  // ---------------------------------------------------------------- B2
  task("B2", "discussion", "MID",
    "Immer mehr Kurse werden online statt im Klassenzimmer angeboten. Erörtern Sie die Vor- und Nachteile von Online-Unterricht und sagen Sie, für wen er sich besonders eignet und für wen weniger.",
    ["mindestens zwei Vorteile", "mindestens zwei Nachteile", "Differenzierung nach Lernenden oder Fächern", "begründetes Fazit"],
    "neutral/sachlich"),
  task("B2", "presentation", "MID",
    "Halten Sie eine kurze Präsentation über ein Fest oder eine Tradition aus Ihrem Land oder Ihrer Region. Erklären Sie Herkunft und Ablauf, sagen Sie, welche Bedeutung es heute hat, und vergleichen Sie es mit einem Fest in einem deutschsprachigen Land.",
    ["klare Gliederung mit Einleitung und Schluss", "Herkunft und Ablauf", "heutige Bedeutung", "Vergleich mit einem Fest im deutschsprachigen Raum"],
    "neutral/sachlich"),
  task("B2", "opinion", "HARD",
    "Einige Städte haben den Eintritt in ihre öffentlichen Museen abgeschafft. Sollte der Museumsbesuch überall kostenlos sein? Nehmen Sie Stellung, gehen Sie auf mögliche Gegenargumente ein und begründen Sie Ihre Position.",
    ["klare eigene Position", "mindestens zwei Argumente mit Beispielen", "Auseinandersetzung mit einem Gegenargument (z. B. Finanzierung)", "zusammenfassender Schluss"],
    "neutral/sachlich"),

  // ---------------------------------------------------------------- C1
  task("C1", "opinion", "MID",
    "Viele Unternehmen verzichten bei Bewerbungen inzwischen auf Schul- und Hochschulzeugnisse und setzen stattdessen auf praktische Tests. Nehmen Sie differenziert Stellung: Unter welchen Umständen ist das sinnvoll, wo sehen Sie Grenzen und Risiken?",
    ["differenzierte Position statt pauschalem Ja oder Nein", "Chancen (z. B. Quereinsteiger, Fairness)", "Grenzen und Risiken (z. B. Aufwand, Aussagekraft)", "kohärente Argumentation mit passenden Konnektoren"],
    "neutral/sachlich"),
  task("C1", "discussion", "HARD",
    "Lesen Sie die folgende Aussage: „Städte sollten den Bau neuer Parkplätze stoppen und den frei werdenden Raum für Grünflächen und Radwege nutzen.“ Fassen Sie den Kern der Aussage mit eigenen Worten zusammen, bewerten Sie sie und beziehen Sie dabei die Interessen unterschiedlicher Gruppen ein.",
    ["knappe, zutreffende Zusammenfassung in eigenen Worten", "Interessen mehrerer Gruppen (z. B. Anwohner, Handel, Pendler)", "abwägende Bewertung", "begründetes Fazit"],
    "neutral/sachlich"),
  task("C1", "presentation", "MID",
    "Halten Sie einen kurzen Vortrag zu der Frage: Wie verändert die Digitalisierung die Art, wie Menschen Sprachen lernen? Gehen Sie auf Chancen und Grenzen ein und geben Sie ein konkretes Beispiel.",
    ["strukturierter Aufbau mit Einleitung, Hauptteil und Schluss", "Chancen digitaler Lernformen", "Grenzen oder Risiken", "konkretes Beispiel, präziser Wortschatz"],
    "neutral/sachlich"),

  // ---------------------------------------------------------------- C2
  task("C2", "opinion", "MID",
    "Ist Ehrlichkeit immer eine Tugend? Entwickeln Sie eine nuancierte Position. Beziehen Sie Situationen ein, in denen Offenheit und Rücksicht in Konflikt geraten, und ziehen Sie ein begründetes Fazit.",
    ["nuancierte These statt Schwarz-Weiß-Urteil", "Beispiele für Konflikte zwischen Offenheit und Rücksicht", "Abgrenzung von Begriffen (z. B. Lüge, Takt, Verschweigen)", "stilistisch souveräner, flüssiger Vortrag"],
    "neutral/sachlich"),
  task("C2", "presentation", "HARD",
    "Was bedeutet es, in einer Sprache zu Hause zu sein? Improvisieren Sie eine Stellungnahme. Beziehen Sie eigene Erfahrungen ein und denken Sie über das Verhältnis von Sprache, Identität und Zugehörigkeit nach.",
    ["eigene Deutung des Begriffs", "persönliche Erfahrungen, reflektiert statt nur erzählt", "Bezug zu Identität und Zugehörigkeit", "differenzierter Wortschatz und idiomatische Ausdrucksweise"],
    "neutral/sachlich"),
  task("C2", "discussion", "HARD",
    "Lässt sich gesellschaftlicher Fortschritt messen? Diskutieren Sie, woran man Fortschritt erkennen könnte, welche Maßstäbe dabei problematisch sind und wer darüber entscheiden sollte.",
    ["Vorschlag möglicher Maßstäbe", "kritische Reflexion der Maßstäbe", "Frage nach Deutungshoheit", "schlüssige Argumentation mit abgewogenem Schluss"],
    "neutral/sachlich"),
];

export const speaking: SeedBankPart = { stimuli: [], items };
