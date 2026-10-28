import type { SeedCourseForm } from "../types";
import {
  abcCloze,
  formalEmail,
  grammarChoice,
  listeningChoice,
  listeningClip,
  listeningTfng,
  readingChoice,
  readingTfng,
  readingText,
  speakingTask,
} from "./build";

/*
 * Zwischentest B1.1, Version A: new content in the format of Halil Bey's Abschlusstest, cut to the INTERIM shape
 * (6 + 15 + 6 units, one email, two speaking tasks) and limited to Netzwerk neu B1, Kapitel 1-6. Both
 * Zwischentest forms test the same fifteen grammar phenomena in the same slots: cloze gaps Präteritum, weil,
 * Genitiv nach trotz/wegen, Pronominaladverb mit Nebensatz, Komparativ vor Nomen, Futur I; sentences so ... dass,
 * Infinitiv mit zu, obwohl, lassen, temporale Präposition mit Genitiv, irrealer Bedingungssatz, damit / um ... zu,
 * n-Deklination, Relativsatz mit Präposition.
 */

export const B1_INTERIM_SYLLABUS: SeedCourseForm["syllabus"] = {
  source:
    "Inhaltsverzeichnis Netzwerk neu B1.1 (Kapitel 1-6), Klett 2021, digitalisiert von der Deutschen Nationalbibliothek: https://d-nb.info/1226980031/04",
  chapters: "Netzwerk neu B1, Kapitel 1-6",
  topics: [
    "Infinitiv mit zu",
    "Nebensätze mit weil, da und obwohl",
    "Verb lassen",
    "Folgen ausdrücken: deshalb, sodass, so ... dass",
    "Genitiv, wegen und trotz",
    "Präteritum und Zeitangaben mit Präpositionen (Dativ und Genitiv)",
    "Konjunktiv II und irreale Bedingungssätze",
    "Pronominaladverbien und Verben mit Präposition",
    "Komparativ vor Nomen, damit und um ... zu",
    "Futur I, n-Deklination, Relativsätze im Dativ und mit Präposition",
    "Reisen, Technik und Reklamation, Arbeitswelt, Umwelt, Pläne und Vorsätze",
  ],
};

// ================================================================ READING

const rHaustausch = readingText(
  "course-b1-interim-a-r-haustausch",
  "Urlaub mit Haustausch",
  "Reisen und Urlaubsarten",
  `
Ferien in einer fremden Wohnung, ohne Miete zu bezahlen: Für immer mehr Familien ist der Haustausch eine interessante Alternative zum Hotel. Das Prinzip ist einfach. Man stellt die eigene Wohnung auf einer Internetplattform vor und sucht eine Familie, die zur gleichen Zeit Urlaub machen möchte. Dann tauscht man für ein bis drei Wochen die Wohnungen.

Familie Haddad aus Kassel hat das im letzten Sommer zum ersten Mal ausprobiert. Drei Wochen lang hat sie in einer Wohnung in Kopenhagen gewohnt, während eine dänische Familie in Kassel war. „Am Anfang waren wir ziemlich nervös“, erzählt Rana Haddad. „Wir hatten Angst, dass etwas kaputtgeht. Aber vorher haben wir oft mit der anderen Familie telefoniert, deshalb haben wir uns schnell sicher gefühlt.“

Für die Mitgliedschaft auf der Plattform bezahlt die Familie 130 Euro im Jahr. Dafür spart sie die Kosten für ein Hotel. Ein weiterer Vorteil: In einer Wohnung kann man selbst kochen, und die Kinder haben mehr Platz zum Spielen. Die dänische Familie hat sogar einen Zettel mit Tipps für Restaurants und Ausflüge hinterlassen.

Nicht alles war perfekt. Die Wohnung in Kopenhagen lag im vierten Stock, und es gab keinen Aufzug. Trotzdem möchte Familie Haddad auch im nächsten Jahr wieder tauschen, dieses Mal vielleicht mit einer Familie in Portugal.
`,
);

const rArbeit = readingText(
  "course-b1-interim-a-r-arbeit-texte",
  "Vier Texte zum Thema Arbeit",
  "Arbeit und Bewerbung",
  `
Text A - Stellenanzeige
Die Bäckerei Sommer sucht ab dem 1. März eine freundliche Verkäuferin oder einen freundlichen Verkäufer in Teilzeit (20 Stunden pro Woche). Arbeitszeit: montags bis freitags von 6 bis 10 Uhr. Erfahrung im Verkauf ist nicht nötig, wir arbeiten Sie gern ein. Bitte kommen Sie mit Ihrem Lebenslauf persönlich in unserer Filiale am Marktplatz vorbei.

Text B - Forumsbeitrag
Morgen habe ich mein erstes Vorstellungsgespräch und bin total nervös. Was soll ich anziehen? Und was mache ich, wenn ich eine Frage nicht verstehe? Ich wäre für ein paar Tipps sehr dankbar!
Jana

Text C - Aushang der Volkshochschule
Bewerbungstraining für Erwachsene: An zwei Samstagen lernen Sie, wie man einen guten Lebenslauf schreibt und sich im Vorstellungsgespräch sicher präsentiert. Am zweiten Tag üben wir Gespräche vor der Videokamera. Kosten: 40 Euro. Anmeldung online bis zum 15. Februar.

Text D - Blogeintrag
Seit drei Wochen arbeite ich als Krankenpfleger in einem Krankenhaus in Freiburg. Am ersten Tag habe ich mich im Gebäude verlaufen und kam zehn Minuten zu spät auf die Station. Meine Kolleginnen und Kollegen haben aber nur gelacht und mir sofort geholfen. Die Arbeit ist anstrengend, aber ich habe meinen Traumjob gefunden!
Tarek
`,
);

const TEXTE = "Lesen Sie die vier Texte A bis D. Wählen Sie die richtige Lösung.";

const reading = [
  readingTfng(
    rHaustausch,
    "detail",
    "Lesen Sie den Zeitungsartikel. Sind die Aussagen richtig oder falsch? Kreuzen Sie an.",
    [
      ["Beim Haustausch zahlen sich die Familien gegenseitig nichts für die Wohnung.", "R"],
      ["Familie Haddad hatte vor dem Urlaub keinen Kontakt zu der dänischen Familie.", "F"],
      ["Familie Haddad plant für das nächste Jahr wieder einen Urlaub mit Haustausch.", "R"],
    ],
    "1 Richtig: „Ferien in einer fremden Wohnung, ohne Miete zu bezahlen“ (die 130 Euro sind für die Mitgliedschaft auf der Plattform). 2 Falsch: „vorher haben wir oft mit der anderen Familie telefoniert“. 3 Richtig: „möchte Familie Haddad auch im nächsten Jahr wieder tauschen“.",
  ),
  readingChoice(
    rArbeit,
    "detail",
    `${TEXTE}\n\nWer bittet andere Menschen um Rat?`,
    ["Text D", "Text B", "Text C"],
    1,
    "Text B: Jana fragt, was sie anziehen soll, und bittet um Tipps. Text C bietet ein Training an, in Text D erzählt Tarek von seiner Arbeit.",
  ),
  readingChoice(
    rArbeit,
    "detail",
    `${TEXTE}\n\nWo kann man üben, wie man sich bei einer Firma vorstellt?`,
    ["Text C", "Text A", "Text B"],
    0,
    "Text C: Im Bewerbungstraining „üben wir Gespräche vor der Videokamera“. In Text A soll man sich persönlich bewerben, in Text B hat Jana bald ein Vorstellungsgespräch, übt aber nicht.",
  ),
  readingChoice(
    rArbeit,
    "detail",
    `${TEXTE}\n\nWer war am Anfang der neuen Stelle nicht pünktlich?`,
    ["Text A", "Text B", "Text D"],
    2,
    "Text D: „Am ersten Tag ... kam zehn Minuten zu spät auf die Station.“ Text A nennt nur Arbeitszeiten, Text B spricht über ein Vorstellungsgespräch, nicht über eine neue Stelle.",
  ),
];

// ================================================================ GRAMMAR (Sprachbausteine)

const cloze = abcCloze({
  instruction: "Lesen Sie den Forumsbeitrag. Wählen Sie für jede Lücke die richtige Lösung.",
  title: "Ärger mit meinem Staubsaugerroboter",
  text: `
Hallo zusammen,

als ich letzten Monat im Elektromarkt war, [[*zeigte|zeigt|gezeigt#praeteritum]] mir der Verkäufer einen Staubsaugerroboter. Ich habe ihn sofort gekauft, [[denn|*weil|deshalb#konnektor.kausal]] ich wenig Zeit für die Hausarbeit habe. Trotz [[dem|der|*des#genitiv.praeposition]] günstigen Preises funktioniert er eigentlich gut.

Nach zwei Wochen habe ich mich aber [[dafür|*darüber|darum#praepositionaladverb]] geärgert, dass er immer unter dem Sofa stecken bleibt. Jetzt brauche ich ein [[kleiner|kleinstes|*kleineres#adjektiv.komparativ]] Modell, das auch unter das Sofa passt. Morgen [[*werde|wurde|habe#futur]] ich den Roboter ins Geschäft zurückbringen und gegen ein anderes Modell umtauschen.

Hat jemand von euch einen Tipp?

Viele Grüße
Mehmet
`.trim(),
  note: "1 Präteritum nach „als“ (Vergangenheit); 2 Nebensatz mit „weil“ (Verb am Ende, „denn“ und „deshalb“ verlangen eine andere Wortstellung); 3 Genitiv nach „trotz“ („des günstigen Preises“); 4 Pronominaladverb mit Nebensatz („sich darüber ärgern, dass ...“); 5 Komparativ vor dem Nomen („ein kleineres Modell“); 6 Futur I („werde ... zurückbringen“).",
});

const sentences = [
  grammarChoice(
    "konnektor.konsekutiv",
    "Der neue Kühlschrank war ___ laut, ___ wir ihn nach einer Woche zurückgebracht haben.",
    ["weder … noch", "je … desto", "sowohl … als auch", "so … dass"],
    3,
    "Geprüftes Grammatikphänomen: Folgen ausdrücken mit „so ... dass“ (zweiteiliger Konnektor). Der zweite Teil ist ein Nebensatz mit dem Verb am Ende und nennt die Folge; „je ... desto“ verlangt einen Komparativ, „weder ... noch“ und „sowohl ... als auch“ verbinden zwei gleiche Satzteile.",
  ),
  grammarChoice(
    "infinitiv.zu",
    "Wir haben vor, im Sommer mit dem Zug nach Wien ___.",
    ["fahren", "fährt", "zu fahren", "gefahren"],
    2,
    "Geprüftes Grammatikphänomen: Infinitiv mit „zu“ („vorhaben“ + zu-Infinitiv).",
  ),
  grammarChoice(
    "konnektor.konzessiv",
    "___ ich eigentlich keine Lust auf Camping hatte, bin ich mit meinen Freunden an den See gefahren.",
    ["Obwohl", "Weil", "Denn", "Deshalb"],
    0,
    "Geprüftes Grammatikphänomen: Nebensatz mit „obwohl“ (Gegengrund: keine Lust, trotzdem mitgefahren). „Denn“ und „deshalb“ leiten keinen Nebensatz mit Verb am Ende ein.",
  ),
  grammarChoice(
    "lassen",
    "Mein Handy ist kaputt. Ich ___ es morgen im Geschäft reparieren.",
    ["mache", "habe", "gebe", "lasse"],
    3,
    "Geprüftes Grammatikphänomen: Verb „lassen“ + Infinitiv (jemand anders repariert das Handy).",
  ),
  grammarChoice(
    "praeposition.zeit",
    "___ des Studiums hat Selin in einem Café gearbeitet.",
    ["Seit", "Während", "Nach", "Vor"],
    1,
    "Geprüftes Grammatikphänomen: Zeitangabe mit Präposition und Genitiv („während des Studiums“; „seit“, „nach“ und „vor“ stehen mit Dativ).",
  ),
  grammarChoice(
    "konjunktiv2",
    "Wenn ich mehr Geld ___, würde ich eine Weltreise machen.",
    ["habe", "hatte", "hätten", "hätte"],
    3,
    "Geprüftes Grammatikphänomen: irrealer Bedingungssatz mit Konjunktiv II („Wenn ich ... hätte, würde ich ...“).",
  ),
  grammarChoice(
    "konnektor.final",
    "Ich fahre jeden Tag mit dem Fahrrad zur Arbeit, ___ die Umwelt zu schützen.",
    ["um", "damit", "weil", "dass"],
    0,
    "Geprüftes Grammatikphänomen: Ziel ausdrücken mit „um ... zu“ (gleiches Subjekt, Infinitiv mit „zu“; „damit“ verlangt einen Nebensatz mit konjugiertem Verb).",
  ),
  grammarChoice(
    "n_deklination",
    "Gestern habe ich ___ im Supermarkt getroffen.",
    ["unseren Nachbar", "unser Nachbar", "unseren Nachbarn", "unserem Nachbarn"],
    2,
    "Geprüftes Grammatikphänomen: n-Deklination im Akkusativ („treffen“ + Akkusativ: „unseren Nachbarn“).",
  ),
  grammarChoice(
    "relativsatz.praeposition",
    "Die Firma, bei ___ ich mich beworben habe, hat mich zu einem Gespräch eingeladen.",
    ["die", "der", "dem", "denen"],
    1,
    "Geprüftes Grammatikphänomen: Relativsatz mit Präposition und Dativ („bei der Firma“: „bei der“).",
  ),
];

// ================================================================ LISTENING

const lRaststaette = listeningClip(
  "course-b1-interim-a-l-reisebus",
  "Durchsage im Reisebus",
  "Reisen und Ausflüge",
  [{ label: "Reiseleiter", voice: "B" }],
  [
    "Reiseleiter: Liebe Gäste, in fünf Minuten erreichen wir die Raststätte. Dort machen wir eine Pause. Eigentlich wollten wir eine halbe Stunde bleiben, aber wegen des Staus vor Rosenheim haben wir etwas Verspätung. Deshalb haben wir heute nur zwanzig Minuten Zeit. Bitte seien Sie pünktlich um Viertel nach zwölf wieder hier am Bus. Das Restaurant ist mittags immer sehr voll, kaufen Sie sich also lieber etwas im Shop. Nehmen Sie bitte Ihre Wertsachen mit, denn der Bus bleibt während der Pause offen. In Salzburg kommen wir dann gegen fünfzehn Uhr an.",
  ],
);

const lHotel = listeningClip(
  "course-b1-interim-a-l-hotelzimmer",
  "Nachricht vom Hotel",
  "Reisen und Unterkunft",
  [{ label: "Frau Nowak", voice: "D" }],
  [
    "Frau Nowak: Guten Tag, Herr Mensah, hier spricht Nowak vom Hotel Seeblick. Sie haben bei uns vom zwölften bis zum fünfzehnten August ein Doppelzimmer mit Blick auf den See gebucht. Leider gibt es in diesen Zimmern gerade einen Wasserschaden, und die Reparatur dauert noch bis Ende August. Wir können Ihnen aber ein Zimmer zum Garten anbieten. Das Zimmer ist etwas kleiner, deshalb bekommen Sie zwanzig Prozent Rabatt. Das Frühstück ist wie immer im Preis inklusive. Wenn Sie lieber stornieren möchten, ist das natürlich kostenlos. Bitte rufen Sie uns kurz zurück. Vielen Dank und auf Wiederhören.",
  ],
);

const lUfer = listeningClip(
  "course-b1-interim-a-l-umweltaktion",
  "Tipp im Radio",
  "Umwelt und Engagement",
  [{ label: "Moderator", voice: "C" }],
  [
    "Moderator: Und hier noch ein Tipp für alle, die am Wochenende etwas für die Umwelt tun möchten: Am Samstag findet am Flussufer die Aktion „Sauberes Ufer“ statt. Treffpunkt ist um zehn Uhr an der alten Brücke. Gemeinsam sammeln wir dort Plastik und anderen Müll. Handschuhe und Müllsäcke bekommen alle am Treffpunkt, die müssen Sie also nicht mitbringen. Denken Sie aber bitte an feste Schuhe, denn am Ufer ist es oft rutschig. Zum Schluss gibt es für alle Helferinnen und Helfer eine warme Suppe, natürlich kostenlos. Eine Anmeldung ist nicht nötig. Nur bei Gewitter fällt die Aktion aus.",
  ],
);

const lVorsaetze = listeningClip(
  "course-b1-interim-a-l-vorsaetze",
  "Gespräch über gute Vorsätze",
  "Pläne und Vorsätze",
  [
    { label: "Leonie", voice: "A" },
    { label: "Amir", voice: "B" },
  ],
  [
    "Leonie: Na, Amir, wie war dein Wochenende?",
    "Amir: Gut, danke! Am Samstag war ich wieder beim Lauftreff im Stadtpark.",
    "Leonie: Beim Lauftreff? Seit wann läufst du denn?",
    "Amir: Seit Januar. Das war mein Vorsatz für dieses Jahr: mehr Sport und weniger Zeit vor dem Computer.",
    "Leonie: Und, klappt das? Ich habe jedes Jahr gute Vorsätze, aber nach zwei Wochen ist alles vorbei.",
    "Amir: Bis jetzt klappt es sehr gut. Allein hätte ich wahrscheinlich schon aufgehört, aber in der Gruppe macht es einfach mehr Spaß. Wir laufen jeden Samstag um acht Uhr.",
    "Leonie: Um acht Uhr am Samstag? Das wäre nichts für mich. Am Wochenende schlafe ich gern lange.",
    "Amir: Es gibt auch eine Gruppe am Mittwochabend. Die läuft etwas langsamer, das ist gut für Anfänger.",
    "Leonie: Hm, das klingt schon besser. Ich habe mir übrigens auch etwas vorgenommen: Ich fahre nicht mehr mit dem Auto ins Büro.",
    "Amir: Wirklich? Wie kommst du denn jetzt zur Arbeit?",
    "Leonie: Mit der Straßenbahn. Das dauert zwar zehn Minuten länger, aber ich kann unterwegs lesen. Und ich spare viel Geld für Benzin und den Parkplatz.",
    "Amir: Das finde ich super. Und gut für die Umwelt ist es auch.",
    "Leonie: Genau. Am Anfang habe ich das Auto ein bisschen vermisst, aber jetzt will ich es gar nicht mehr anders.",
    "Amir: Vielleicht kommst du ja auch mal am Mittwoch mit zum Laufen?",
    "Leonie: Mal sehen. Diese Woche habe ich keine Zeit, aber nächste Woche vielleicht.",
  ],
);

const listening = [
  listeningChoice(
    lRaststaette,
    "detail",
    "Wie lange dauert die Pause an der Raststätte?",
    ["eine halbe Stunde", "fünf Minuten", "zwanzig Minuten"],
    2,
    "Zwanzig Minuten: „Deshalb haben wir heute nur zwanzig Minuten Zeit.“ Eine halbe Stunde war nur geplant, in fünf Minuten erreicht der Bus die Raststätte.",
  ),
  listeningChoice(
    lHotel,
    "detail",
    "Warum bekommt Herr Mensah einen Rabatt?",
    ["Das Frühstück ist nicht inklusive.", "Das neue Zimmer ist kleiner.", "Er bleibt drei Nächte im Hotel."],
    1,
    "Das Zimmer zum Garten „ist etwas kleiner, deshalb bekommen Sie zwanzig Prozent Rabatt“. Das Frühstück ist inklusive, die drei Nächte sind kein Grund für den Rabatt.",
  ),
  listeningChoice(
    lUfer,
    "detail",
    "Was sollen die Teilnehmer zu der Aktion mitbringen?",
    ["feste Schuhe", "Handschuhe und Müllsäcke", "etwas zu essen"],
    0,
    "Feste Schuhe: „Denken Sie aber bitte an feste Schuhe.“ Handschuhe und Müllsäcke gibt es am Treffpunkt, eine Suppe bekommen alle zum Schluss kostenlos.",
  ),
  listeningTfng(
    lVorsaetze,
    "detail",
    "Hören Sie das Gespräch. Sind die Aussagen richtig oder falsch? Kreuzen Sie an.",
    [
      ["Amir läuft schon seit mehreren Jahren regelmäßig.", "F"],
      ["Der Lauftreff am Samstagmorgen ist Leonie zu früh.", "R"],
      ["Mit der Straßenbahn kommt Leonie schneller ins Büro als mit dem Auto.", "F"],
    ],
    "1 Falsch: Amir läuft „seit Januar“, es ist sein Vorsatz für dieses Jahr. 2 Richtig: „Um acht Uhr am Samstag? Das wäre nichts für mich. Am Wochenende schlafe ich gern lange.“ 3 Falsch: „Das dauert zwar zehn Minuten länger“.",
  ),
];

// ================================================================ WRITING

const writing = [
  formalEmail({
    situation: "Sie haben vor einer Woche im Online-Shop „Technikwelt“ eine Kaffeemaschine bestellt. Jetzt ist das Gerät da, aber es funktioniert nicht richtig. Schreiben Sie eine E-Mail an den Kundenservice.",
    points: [
      "Nennen Sie Ihre Bestellung und beschreiben Sie das Problem genau.",
      "Schreiben Sie, was Sie jetzt möchten (zum Beispiel Umtausch oder Geld zurück), und begründen Sie Ihren Wunsch.",
      "Fragen Sie, wie Sie das Gerät zurückschicken sollen und wer die Versandkosten bezahlt.",
    ],
    contentPoints: [
      "Leitpunkt 1: die Bestellung nennen (Gerät, wann bestellt) UND das Problem genau beschreiben (nur „es ist kaputt“ ohne Beschreibung erfüllt den Punkt nur teilweise)",
      "Leitpunkt 2: sagen, was man jetzt möchte (Reparatur, Umtausch oder Geld zurück), UND den Wunsch begründen (ein Wunsch ohne Grund: Punkt nur teilweise erfüllt)",
      "Leitpunkt 3: fragen, wie man das Gerät zurückschicken soll, UND fragen, wer die Versandkosten bezahlt (nur eine der beiden Fragen: Punkt nur teilweise erfüllt)",
    ],
    studentPoints: ["Bestellung und Problem", "Ihr Wunsch und der Grund", "Fragen zu Rücksendung und Kosten"],
    explanation:
      "Formelle E-Mail, Reklamation (Netzwerk neu B1, Kapitel 2). Bewertung: Inhalt, Wortschatz und Grammatik je 0 bis 3 Punkte. Inhalt 0 Punkte bedeutet: Zwischentest nicht bestanden.",
  }),
];

// ================================================================ SPEAKING

const speaking = [
  speakingTask(
    "introduction",
    "Wir möchten Sie kennenlernen: Bitte stellen Sie sich kurz vor.\n\nSprechen Sie über diese Punkte:\n- Ihr Name\n- Die Stadt oder Region, in der Sie wohnen\n- Ihr Beruf oder Ihre Tätigkeit\n- Ihre Freizeit\n- Ihre Sprachen\n- Ihr letzter Urlaub",
    [
      "nennt den Namen und die Stadt oder Region, in der man wohnt",
      "sagt, was man beruflich macht oder lernt",
      "erzählt von der Freizeit und nennt die Sprachen, die man spricht",
      "erzählt kurz vom letzten Urlaub (wohin, was man dort gemacht hat)",
    ],
    "Selbstvorstellung, ca. eine Minute; der letzte Punkt greift Kapitel 1 (Reisen) auf. Bewertung: Kommunikation, Wortschatz, Grammatik, Aussprache, Kohärenz je 0 bis 4 Punkte.",
  ),
  speakingTask(
    "presentation",
    "Halten Sie jetzt bitte einen kurzen Vortrag.\n\nThema: „Urlaub: Pauschalreise oder selbst geplant?“\nSprechen Sie ungefähr zwei Minuten zu allen vier Punkten:\n- Was ist eine Pauschalreise, und was bedeutet „selbst geplant“? Nennen Sie kurze Beispiele.\n- Welche Vorteile hat eine Pauschalreise, zum Beispiel wenig Arbeit bei der Planung oder ein fester Preis?\n- Welche Vorteile hat eine selbst geplante Reise, zum Beispiel Freiheit oder Kontakt zu Menschen vor Ort?\n- Was ist Ihre persönliche Meinung: Wie reisen Sie am liebsten, und warum?",
    [
      "erklärt „Pauschalreise“ und „selbst geplante Reise“ mit kurzen Beispielen",
      "nennt Vorteile einer Pauschalreise (z. B. wenig Planung, fester Preis)",
      "nennt Vorteile einer selbst geplanten Reise (z. B. Freiheit, Kontakt zu Menschen vor Ort)",
      "sagt die eigene Meinung und begründet sie (weil, da, deshalb)",
    ],
    "Präsentation mit vier Leitpunkten zu Kapitel 1 (Urlaubsarten, Reiseangebote), ca. zwei Minuten. Bewertung: Kommunikation, Wortschatz, Grammatik, Aussprache, Kohärenz je 0 bis 4 Punkte.",
  ),
];

export const B1_INTERIM_A: SeedCourseForm = {
  key: "B1.1",
  form: "A",
  syllabus: B1_INTERIM_SYLLABUS,
  sections: [
    { section: "READING", stimuli: [rHaustausch, rArbeit], items: reading },
    { section: "GRAMMAR", stimuli: [], items: [cloze, ...sentences] },
    { section: "LISTENING", stimuli: [lRaststaette, lHotel, lUfer, lVorsaetze], items: listening },
    { section: "WRITING", stimuli: [], items: writing },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
