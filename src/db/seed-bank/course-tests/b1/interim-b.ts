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
import { B1_INTERIM_SYLLABUS } from "./interim-a";

/*
 * Zwischentest B1.1, Version B: parallel to Version A (same sections, same fifteen grammar phenomena in the same
 * slots, comparable texts and tasks), new texts and sentences, Netzwerk neu B1, Kapitel 1-6 only.
 */

// ================================================================ READING

const rUnverpackt = readingText(
  "course-b1-interim-b-r-unverpackt",
  "Einkaufen ohne Verpackung",
  "Umwelt und Start-ups",
  `
Nudeln, Reis und Müsli aus großen Gläsern, Shampoo zum Selbstabfüllen: Im Laden „Volle Kiste“ in Erfurt gibt es fast nichts in Plastik. Die Kundinnen und Kunden bringen ihre eigenen Dosen, Gläser und Taschen mit und füllen genau die Menge ab, die sie brauchen.

Gegründet haben den Laden vor zwei Jahren die Freundinnen Mia Schulte und Aylin Kaya. „Nach jedem Einkauf im Supermarkt war unsere Mülltonne voll. Das hat uns gestört“, erzählt Mia Schulte. Weil die beiden keinen Kredit von der Bank bekommen haben, haben sie das Geld für den Laden im Internet gesammelt. Mehr als 300 Menschen haben ihnen dabei geholfen.

Am Anfang kamen vor allem junge Leute. Inzwischen kaufen auch viele Familien und ältere Menschen hier ein. Wer kein Glas dabeihat, kann im Laden für einen Euro ein Pfandglas bekommen. Die Produkte sind manchmal etwas teurer als im Supermarkt, aber man kauft nur so viel, wie man wirklich braucht. Deshalb werfen die Kunden weniger Lebensmittel weg.

Für die Zukunft haben die Gründerinnen große Pläne: Im nächsten Jahr wollen sie einen zweiten Laden eröffnen und Lebensmittel auch mit dem Fahrrad nach Hause liefern.
`,
);

const rNeuesJahr = readingText(
  "course-b1-interim-b-r-veraenderungen-texte",
  "Vier Texte zum Thema Veränderungen",
  "Pläne und Veränderungen",
  `
Text A - Aushang im Fitnessstudio
Neues Jahr, neues Glück! Im Januar bieten wir den Anfängerkurs „Fit in 30 Tagen“ an. Der Kurs findet dreimal pro Woche morgens um 7 Uhr statt. Mitglieder zahlen nichts, alle anderen 25 Euro. Bitte tragen Sie sich bis zum 20. Dezember in die Liste an der Rezeption ein.

Text B - Forumsbeitrag
Mein Vorsatz für das neue Jahr: weniger Zeit am Handy! Seit zwei Wochen lege ich es abends um neun Uhr in die Küche. Am Anfang war das schwer, aber jetzt schlafe ich viel besser und lese wieder Bücher. Wer macht mit?
Paula

Text C - Anzeige
Sie möchten eine neue Sprache lernen? Die Sprachschule Lingua bietet ab Februar Abendkurse in Spanisch, Italienisch und Arabisch an. Die Kurse finden einmal pro Woche statt. Kostenlose Probestunde: am 25. Januar um 18 Uhr. Information und Anmeldung unter 0351 482 17 30.

Text D - Blogeintrag
Vor einem Jahr bin ich mit meiner Familie aus Hamburg in ein kleines Dorf in der Nähe von Lüneburg gezogen. Manchmal vermisse ich die Cafés und Kinos der Großstadt. Aber unsere Kinder können jetzt draußen spielen, und ich fahre nur noch zweimal pro Woche ins Büro. Diese Veränderung war richtig für uns.
Jonas
`,
);

const TEXTE = "Lesen Sie die vier Texte A bis D. Wählen Sie die richtige Lösung.";

const reading = [
  readingTfng(
    rUnverpackt,
    "detail",
    "Lesen Sie den Zeitungsartikel. Sind die Aussagen richtig oder falsch? Kreuzen Sie an.",
    [
      ["Im Laden „Volle Kiste“ kann man Lebensmittel in mitgebrachte Behälter füllen.", "R"],
      ["Die beiden Gründerinnen haben das Geld für den Laden von einer Bank geliehen.", "F"],
      ["Heute kaufen im Laden nicht nur junge Leute ein.", "R"],
    ],
    "1 Richtig: „Die Kundinnen und Kunden bringen ihre eigenen Dosen, Gläser und Taschen mit und füllen ... ab“. 2 Falsch: „keinen Kredit von der Bank bekommen“, das Geld kam aus dem Internet. 3 Richtig: „Inzwischen kaufen auch viele Familien und ältere Menschen hier ein.“",
  ),
  readingChoice(
    rNeuesJahr,
    "detail",
    `${TEXTE}\n\nWer erzählt von einer neuen Gewohnheit und sucht Leute, die mitmachen?`,
    ["Text D", "Text A", "Text B"],
    2,
    "Text B: Paula legt ihr Handy abends weg und fragt „Wer macht mit?“. Text A ist ein Kursangebot des Studios, in Text D erzählt Jonas von seinem Umzug, sucht aber niemanden.",
  ),
  readingChoice(
    rNeuesJahr,
    "detail",
    `${TEXTE}\n\nWo kann man vor dem Kursbeginn eine Stunde ausprobieren, ohne etwas zu bezahlen?`,
    ["Text C", "Text A", "Text B"],
    0,
    "Text C: „Kostenlose Probestunde: am 25. Januar“, die Kurse beginnen im Februar. In Text A ist der ganze Kurs nur für Mitglieder kostenlos, eine Probestunde gibt es nicht.",
  ),
  readingChoice(
    rNeuesJahr,
    "inference",
    `${TEXTE}\n\nWer lebt heute an einem ruhigeren Ort als früher?`,
    ["Text B", "Text D", "Text C"],
    1,
    "Text D: Jonas ist aus Hamburg in ein kleines Dorf gezogen. Paula (Text B) ändert eine Gewohnheit, Text C ist eine Anzeige.",
  ),
];

// ================================================================ GRAMMAR (Sprachbausteine)

const cloze = abcCloze({
  instruction: "Lesen Sie den Forumsbeitrag. Wählen Sie für jede Lücke die richtige Lösung.",
  title: "Unser Wochenende in Dresden",
  text: `
Hallo ihr Lieben,

als wir am Freitag in Dresden ankamen, [[regnet|*regnete|geregnet#praeteritum]] es leider. Wir sind trotzdem gleich in die Altstadt gegangen, [[deshalb|denn|*weil#konnektor.kausal]] wir nach der langen Fahrt frische Luft brauchten. Wegen [[*des|dem|den#genitiv.praeposition]] schlechten Wetters waren nur wenige Touristen unterwegs.

Am Samstagabend waren wir in der Oper. Ich habe mich schon lange [[dafür|worauf|*darauf#praepositionaladverb]] gefreut, die Semperoper einmal von innen zu sehen. Der Sonntag war dann ein viel [[*schönerer|schöner|schönster#adjektiv.komparativ]] Tag als der Freitag: Die Sonne schien, und wir haben eine Radtour an der Elbe gemacht.

Nächstes Jahr [[haben|*werden|wurden#futur]] wir bestimmt wiederkommen!

Liebe Grüße
Hannah
`.trim(),
  note: "1 Präteritum nach „als“ (Vergangenheit); 2 Nebensatz mit „weil“ (Verb am Ende, „denn“ und „deshalb“ verlangen eine andere Wortstellung); 3 Genitiv nach „wegen“ („des schlechten Wetters“); 4 Pronominaladverb mit Infinitivsatz („sich darauf freuen, ... zu sehen“); 5 Komparativ vor dem Nomen („ein viel schönerer Tag als ...“); 6 Futur I („werden ... wiederkommen“).",
});

const sentences = [
  grammarChoice(
    "konnektor.konsekutiv",
    "Die Wanderung war ___ anstrengend, ___ wir danach sofort eingeschlafen sind.",
    ["so … dass", "sowohl … als auch", "weder … noch", "je … desto"],
    0,
    "Geprüftes Grammatikphänomen: Folgen ausdrücken mit „so ... dass“ (zweiteiliger Konnektor). Der zweite Teil ist ein Nebensatz mit dem Verb am Ende und nennt die Folge; „je ... desto“ verlangt einen Komparativ, „weder ... noch“ und „sowohl ... als auch“ verbinden zwei gleiche Satzteile.",
  ),
  grammarChoice(
    "infinitiv.zu",
    "Es ist nicht leicht, im Sommer ein günstiges Hotel ___.",
    ["gefunden", "finden", "findet", "zu finden"],
    3,
    "Geprüftes Grammatikphänomen: Infinitiv mit „zu“ nach „Es ist nicht leicht, ...“.",
  ),
  grammarChoice(
    "konnektor.konzessiv",
    "___ ich extra früh aufgestanden bin, habe ich den Zug verpasst.",
    ["Deshalb", "Weil", "Obwohl", "Denn"],
    2,
    "Geprüftes Grammatikphänomen: Nebensatz mit „obwohl“ (Gegengrund: früh aufgestanden, trotzdem den Zug verpasst). „Denn“ und „deshalb“ leiten keinen Nebensatz mit Verb am Ende ein.",
  ),
  grammarChoice(
    "lassen",
    "Frau Yılmaz ___ ihr Auto jedes Jahr in der Werkstatt prüfen.",
    ["macht", "hat", "gibt", "lässt"],
    3,
    "Geprüftes Grammatikphänomen: Verb „lassen“ + Infinitiv (die Werkstatt prüft das Auto).",
  ),
  grammarChoice(
    "praeposition.zeit",
    "___ eines Monats müssen Sie die Rechnung bezahlen.",
    ["Seit", "Innerhalb", "Nach", "Ab"],
    1,
    "Geprüftes Grammatikphänomen: Zeitangabe mit Präposition und Genitiv („innerhalb eines Monats“; „seit“, „nach“ und „ab“ stehen mit Dativ).",
  ),
  grammarChoice(
    "konjunktiv2",
    "Wenn wir ein Auto ___, könnten wir am Wochenende in die Berge fahren.",
    ["haben", "hätten", "hatten", "hätte"],
    1,
    "Geprüftes Grammatikphänomen: irrealer Bedingungssatz mit Konjunktiv II („Wenn wir ... hätten, könnten wir ...“).",
  ),
  grammarChoice(
    "konnektor.final",
    "Ich schalte das Licht immer aus, ___ wir weniger Strom verbrauchen.",
    ["damit", "um", "denn", "deshalb"],
    0,
    "Geprüftes Grammatikphänomen: Ziel ausdrücken mit „damit“ (anderes Subjekt im Nebensatz, Verb am Ende; „um“ verlangt einen Infinitiv mit „zu“).",
  ),
  grammarChoice(
    "n_deklination",
    "Ich habe ___ nach dem Weg zum Bahnhof gefragt.",
    ["den Polizist", "dem Polizisten", "den Polizisten", "der Polizist"],
    2,
    "Geprüftes Grammatikphänomen: n-Deklination im Akkusativ („fragen“ + Akkusativ: „den Polizisten“).",
  ),
  grammarChoice(
    "relativsatz.praeposition",
    "Der Freund, mit ___ ich nach Spanien gereist bin, wohnt jetzt in Leipzig.",
    ["den", "dem", "der", "dessen"],
    1,
    "Geprüftes Grammatikphänomen: Relativsatz mit Präposition und Dativ („mit dem Freund“: „mit dem“).",
  ),
];

// ================================================================ LISTENING

const lElektromarkt = listeningClip(
  "course-b1-interim-b-l-elektromarkt",
  "Durchsage im Elektromarkt",
  "Technik und Werbung",
  [{ label: "Durchsage", voice: "A" }],
  [
    "Durchsage: Liebe Kundinnen und Kunden, aufgepasst! Nur heute bis zwanzig Uhr bekommen Sie in unserer Abteilung für Haushaltsgeräte dreißig Prozent Rabatt auf alle Kaffeemaschinen. Auch Staubsauger sind heute günstiger, hier sparen Sie zehn Prozent. Fernseher und Handys sind leider nicht im Angebot. Und noch ein Tipp: Bringen Sie Ihr altes Gerät mit, wir entsorgen es kostenlos für Sie. Unsere Mitarbeiterinnen und Mitarbeiter beraten Sie gern im ersten Stock. Vielen Dank für Ihren Einkauf!",
  ],
);

const lBesprechung = listeningClip(
  "course-b1-interim-b-l-teambesprechung",
  "Nachricht von einem Kollegen",
  "Arbeit und Büro",
  [{ label: "Herr Albers", voice: "C" }],
  [
    "Herr Albers: Hallo Frau Rossi, hier ist Thomas Albers. Ich wollte Ihnen nur kurz sagen, dass die Teambesprechung morgen nicht um neun Uhr stattfindet, sondern erst um elf. Der Chef hat am Morgen noch einen Termin beim Kunden. Wir treffen uns auch nicht im kleinen Raum im zweiten Stock, sondern in der Kantine, weil wir mehr Platz brauchen. Bringen Sie bitte die Zahlen vom letzten Monat mit, die Präsentation mache ich. Nach der Besprechung essen wir dann alle zusammen zu Mittag. Bis morgen!",
  ],
);

const lSchiff = listeningClip(
  "course-b1-interim-b-l-schiffsfahrt",
  "Durchsage auf dem Schiff",
  "Reisen und Wetter",
  [{ label: "Durchsage", voice: "D" }],
  [
    "Durchsage: Liebe Fahrgäste, herzlich willkommen an Bord der „Seestern“. Wegen des starken Windes können wir heute leider nicht wie geplant nach Lindau fahren. Wir fahren stattdessen nur bis Meersburg und von dort zurück nach Konstanz. Wer eine Fahrkarte nach Lindau hat, bekommt den Unterschied an der Kasse im Hafen zurück. Bitte bleiben Sie während der Fahrt im Inneren des Schiffes, das obere Deck ist heute geschlossen. Warme und kalte Getränke bekommen Sie im Restaurant auf dem Hauptdeck. Wir wünschen Ihnen trotz des Wetters eine angenehme Fahrt.",
  ],
);

const lNeueStelle = listeningClip(
  "course-b1-interim-b-l-neue-stelle",
  "Gespräch über eine neue Stelle",
  "Arbeit und Veränderungen",
  [
    { label: "Sofia", voice: "D" },
    { label: "Daniel", voice: "B" },
  ],
  [
    "Sofia: Hallo Daniel! Lange nicht gesehen. Wie geht's dir?",
    "Daniel: Hallo Sofia! Mir geht's richtig gut. Ich habe doch vor zwei Monaten die Stelle gewechselt.",
    "Sofia: Ach ja, stimmt. Du warst doch vorher bei dieser großen Versicherung, oder?",
    "Daniel: Genau, acht Jahre lang. Jetzt arbeite ich in einer kleinen Firma mit fünfzehn Leuten. Wir entwickeln eine App für Carsharing.",
    "Sofia: Und? Gefällt es dir?",
    "Daniel: Sehr! Das Team ist jung und total nett, und ich kann viel mehr selbst entscheiden als früher.",
    "Sofia: Und das Gehalt? Bei der Versicherung hast du doch gut verdient.",
    "Daniel: Ja, das stimmt. Jetzt verdiene ich etwas weniger. Aber dafür kann ich zweimal pro Woche von zu Hause arbeiten. Und ins Büro fahre ich nur zehn Minuten mit dem Fahrrad. Früher stand ich jeden Tag eine Stunde im Stau.",
    "Sofia: Das klingt toll. Ich würde auch gern mal etwas Neues machen. In meinem Job passiert seit Jahren immer das Gleiche.",
    "Daniel: Dann bewirb dich doch bei uns! Wir suchen gerade jemanden für das Marketing.",
    "Sofia: Wirklich? Aber ich habe keine Erfahrung mit Apps.",
    "Daniel: Das ist kein Problem, das lernt man schnell. Wichtig ist, dass du gern im Team arbeitest und gute Ideen hast.",
    "Sofia: Das klingt fast zu schön, um wahr zu sein. Wie viele Tage Urlaub habt ihr denn?",
    "Daniel: Dreißig, genauso viele wie bei der Versicherung. Ich schicke dir heute Abend die Stellenanzeige.",
    "Sofia: Danke, das ist lieb! Dann lese ich sie mir am Wochenende in Ruhe durch.",
  ],
);

const listening = [
  listeningChoice(
    lElektromarkt,
    "detail",
    "Was ist heute um dreißig Prozent billiger?",
    ["Staubsauger", "Kaffeemaschinen", "Fernseher"],
    1,
    "Kaffeemaschinen: „dreißig Prozent Rabatt auf alle Kaffeemaschinen“. Staubsauger sind nur zehn Prozent günstiger, Fernseher sind nicht im Angebot.",
  ),
  listeningChoice(
    lBesprechung,
    "detail",
    "Wo findet die Teambesprechung morgen statt?",
    ["in der Kantine", "im kleinen Raum im zweiten Stock", "beim Kunden"],
    0,
    "In der Kantine: „nicht im kleinen Raum im zweiten Stock, sondern in der Kantine“. Beim Kunden hat nur der Chef am Morgen einen Termin.",
  ),
  listeningChoice(
    lSchiff,
    "detail",
    "Was ist heute auf dem Schiff nicht möglich?",
    ["nach Meersburg fahren", "Getränke kaufen", "auf das obere Deck gehen"],
    2,
    "Das obere Deck „ist heute geschlossen“. Das Schiff fährt nach Meersburg, Getränke gibt es im Restaurant auf dem Hauptdeck.",
  ),
  listeningTfng(
    lNeueStelle,
    "detail",
    "Hören Sie das Gespräch. Sind die Aussagen richtig oder falsch? Kreuzen Sie an.",
    [
      ["Daniel arbeitet seit zwei Monaten in einer kleinen Firma.", "R"],
      ["Daniel verdient in der neuen Firma mehr als früher.", "F"],
      ["Für die Stelle im Marketing muss man schon Erfahrung mit Apps haben.", "F"],
    ],
    "1 Richtig: „vor zwei Monaten die Stelle gewechselt“, „in einer kleinen Firma mit fünfzehn Leuten“. 2 Falsch: „Jetzt verdiene ich etwas weniger.“ 3 Falsch: „Das ist kein Problem, das lernt man schnell.“",
  ),
];

// ================================================================ WRITING

const writing = [
  formalEmail({
    situation: "Sie möchten im Sommer mit Freunden ein langes Wochenende an der Ostsee verbringen. Im Internet haben Sie die Pension „Strandhaus“ gefunden. Schreiben Sie eine E-Mail an die Inhaberin, Frau Lange.",
    points: [
      "Schreiben Sie, wann Sie kommen möchten und für wie viele Personen Sie Zimmer brauchen.",
      "Fragen Sie, ob das Frühstück im Preis inklusive ist und ob es Parkplätze gibt.",
      "Nennen Sie einen besonderen Wunsch für Ihren Aufenthalt und begründen Sie ihn.",
    ],
    contentPoints: [
      "Leitpunkt 1: den Zeitraum nennen (Anreise und Abreise oder Zahl der Nächte) UND die Zahl der Personen nennen (nur eine der beiden Angaben: Punkt nur teilweise erfüllt)",
      "Leitpunkt 2: fragen, ob das Frühstück im Preis inklusive ist, UND fragen, ob es Parkplätze gibt (nur eine der beiden Fragen: Punkt nur teilweise erfüllt)",
      "Leitpunkt 3: einen besonderen Wunsch nennen (z. B. ruhiges Zimmer, Zimmer mit Meerblick, Fahrräder leihen) UND ihn begründen (ein Wunsch ohne Grund: Punkt nur teilweise erfüllt)",
    ],
    studentPoints: ["Reisezeit und Personen", "Fragen zu Frühstück und Parkplatz", "Besonderer Wunsch mit Grund"],
    explanation:
      "Formelle E-Mail, Anfrage an eine Unterkunft (Netzwerk neu B1, Kapitel 1), parallel zu Version A (zwei Angaben, zwei Fragen, ein Wunsch mit Grund). Bewertung: Inhalt, Wortschatz und Grammatik je 0 bis 3 Punkte. Inhalt 0 Punkte bedeutet: Zwischentest nicht bestanden.",
  }),
];

// ================================================================ SPEAKING

const speaking = [
  speakingTask(
    "introduction",
    "Erzählen Sie bitte ein wenig von sich und Ihrem Alltag.\n\nSprechen Sie über diese Punkte:\n- Ihr Name\n- Die Stadt oder Region, in der Sie leben\n- Was Sie beruflich machen oder lernen\n- Ihre Hobbys\n- Ihre Sprachen\n- Ein Plan für die Zukunft",
    [
      "nennt den Namen und die Stadt oder Region, in der man lebt",
      "sagt, was man beruflich macht oder lernt",
      "erzählt von den Hobbys und nennt die Sprachen, die man spricht",
      "nennt einen Plan für die Zukunft (z. B. mit Futur I oder „ich möchte ...“)",
    ],
    "Selbstvorstellung, ca. eine Minute; der letzte Punkt greift Kapitel 6 (Pläne und Vorsätze) auf. Bewertung: Kommunikation, Wortschatz, Grammatik, Aussprache, Kohärenz je 0 bis 4 Punkte.",
  ),
  speakingTask(
    "presentation",
    "Sprechen Sie jetzt bitte kurz über ein Thema.\n\nThema: „Arbeiten: Im Büro oder im Homeoffice?“\nSprechen Sie ungefähr zwei Minuten zu allen vier Punkten:\n- Was verstehen Sie unter „Arbeit im Büro“ und „Homeoffice“? Nennen Sie kurze Beispiele.\n- Welche Vorteile hat die Arbeit im Büro, zum Beispiel Kontakt zu Kollegen oder eine klare Trennung von Arbeit und Freizeit?\n- Welche Vorteile hat das Homeoffice, zum Beispiel kein Arbeitsweg oder flexible Arbeitszeiten?\n- Was ist Ihre persönliche Meinung: Wo würden Sie lieber arbeiten, und warum?",
    [
      "erklärt „Arbeit im Büro“ und „Homeoffice“ mit kurzen Beispielen",
      "nennt Vorteile der Arbeit im Büro (z. B. Kontakt zu Kollegen, Trennung von Arbeit und Freizeit)",
      "nennt Vorteile des Homeoffice (z. B. kein Arbeitsweg, flexible Arbeitszeiten)",
      "sagt die eigene Meinung und begründet sie (Konjunktiv II: „Ich würde lieber ...“)",
    ],
    "Präsentation mit vier Leitpunkten zu Kapitel 4 (Arbeitswelt), ca. zwei Minuten. Bewertung: Kommunikation, Wortschatz, Grammatik, Aussprache, Kohärenz je 0 bis 4 Punkte.",
  ),
];

export const B1_INTERIM_B: SeedCourseForm = {
  key: "B1.1",
  form: "B",
  syllabus: B1_INTERIM_SYLLABUS,
  sections: [
    { section: "READING", stimuli: [rUnverpackt, rNeuesJahr], items: reading },
    { section: "GRAMMAR", stimuli: [], items: [cloze, ...sentences] },
    { section: "LISTENING", stimuli: [lElektromarkt, lBesprechung, lSchiff, lNeueStelle], items: listening },
    { section: "WRITING", stimuli: [], items: writing },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
