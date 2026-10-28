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
 * Abschlusstest B1, Version A. Reading, Sprachbausteine and Schreiben are the school teacher's own written test
 * (Halil Bey, "Abschlusstest B1, Schriftlich, Version A"), word for word: only the paper instructions are
 * adapted to the screen and dashes are replaced. Listening is new; speaking uses his oral cards 2A (talk) and 3
 * (planning, turned into a monologue). Phenomena per item: his marking sheet ("geprüftes Grammatikphänomen").
 */

// ================================================================ READING

const rGarten = readingText(
  "course-b1-final-a-r-stadtteilgarten",
  "Der Stadtteilgarten in der Lindenstraße",
  "Stadtteilgarten und Nachbarschaft",
  `
Wo früher ein leerer Parkplatz war, wachsen heute Tomaten, Kräuter und Blumen. Vor vier Jahren wurde in der Lindenstraße ein Stadtteilgarten gegründet, in dem sich inzwischen mehr als sechzig Nachbarinnen und Nachbarn engagieren.

Die Idee hatte Ayse Demir, eine Lehrerin aus dem Viertel. „Nachdem ich einen Bericht über ein ähnliches Projekt in Leipzig gelesen hatte, habe ich sofort meine Nachbarn angesprochen“, erzählt sie. Zuerst war die Stadtverwaltung skeptisch, doch trotz einiger Probleme wurde das Grundstück schließlich für zehn Jahre kostenlos zur Verfügung gestellt.

Heute wird der Garten von einem kleinen Verein organisiert. Wer mitmachen möchte, muss kein Mitglied werden und auch nichts bezahlen. Nur eine Regel gilt für alle: Was geerntet wird, wird geteilt. Die gesamte Arbeit wird ehrenamtlich gemacht, Werkzeug und Pflanzen werden durch Spenden finanziert.

Besonders beliebt ist das Projekt bei Familien. Jeden Mittwochnachmittag werden Kinder aus der Grundschule betreut, die dort lernen, wie Gemüse angebaut wird. „Viele Kinder haben vorher noch nie eine Kartoffel aus der Erde geholt“, sagt Herr Kowalski, ein Rentner, der die Gruppe seit zwei Jahren begleitet.

Nicht alles läuft problemlos. Im letzten Sommer wurde wegen der großen Hitze ein Teil der Pflanzen zerstört. Außerdem fehlt dem Verein bis heute das Geld für ein festes Gartenhaus.

Trotzdem ist Ayse Demir zufrieden: „Hier kennt man seine Nachbarn wieder.“
`,
);

const rTexte = readingText(
  "course-b1-final-a-r-ehrenamt-texte",
  "Vier Texte zum Ehrenamt",
  "Ehrenamt und Verein",
  `
Text A - Vereinsaushang
Liebe Mitglieder, unser Sommerfest findet am 12. Juli ab 15 Uhr im Vereinsheim statt. Kuchen und Getränke werden vom Verein gestellt. Wer beim Aufbau der Zelte helfen kann, meldet sich bitte bis zum 5. Juli persönlich im Büro.
Der Vorstand

Text B - Forumsbeitrag eines Freiwilligen
Seit einem halben Jahr fahre ich einmal pro Woche für eine ältere Nachbarin einkaufen. Am Anfang war ich ziemlich unsicher, aber inzwischen freue ich mich jedes Mal auf das Gespräch mit ihr. Ich kann das wirklich jedem empfehlen!
Marek

Text C - Stellenanzeige (Ehrenamt)
Der Verein „Lesestart“ sucht ehrenamtliche Vorleserinnen und Vorleser für Kindergärten. Sie sollten einmal pro Woche zwei Stunden Zeit haben. Eine Schulung wird kostenlos angeboten. Ihre Bewerbung senden Sie bitte per E-Mail an unser Büro.

Text D - Blogeintrag einer Patin
Nachdem ich mein Studium beendet hatte, wollte ich endlich etwas Sinnvolles tun. Heute betreue ich einen Schüler bei den Hausaufgaben. Wir treffen uns meistens dienstags in der Bibliothek. Manchmal ist es anstrengend, aber es lohnt sich.
Lena
`,
);

const TEXTE = "Lesen Sie die vier Texte A bis D. Kreuzen Sie die richtige Lösung an.";

const reading = [
  readingTfng(
    rGarten,
    "detail",
    "Lesen Sie den Magazinbericht. Kreuzen Sie an: Richtig oder Falsch.",
    [
      ["Den Stadtteilgarten gibt es seit vier Jahren.", "R"],
      ["Wer im Garten mitarbeiten möchte, muss Mitglied im Verein werden.", "F"],
      ["Die Stadtverwaltung war von Anfang an von der Idee begeistert.", "F"],
      ["Mittwochnachmittags werden Kinder aus der Grundschule im Garten betreut.", "R"],
      ["Im letzten Sommer wurden einige Pflanzen durch die Hitze zerstört.", "R"],
    ],
    "1 Richtig: „Vor vier Jahren wurde ... ein Stadtteilgarten gegründet“. 2 Falsch: „muss kein Mitglied werden“. 3 Falsch: „Zuerst war die Stadtverwaltung skeptisch“. 4 Richtig: „Jeden Mittwochnachmittag werden Kinder aus der Grundschule betreut“. 5 Richtig: „wurde wegen der großen Hitze ein Teil der Pflanzen zerstört“.",
  ),
  readingChoice(
    rTexte,
    "detail",
    `${TEXTE}\n\nWer sucht neue ehrenamtliche Mitarbeiterinnen und Mitarbeiter?`,
    ["Text A", "Text C", "Text D"],
    1,
    "Text C: Der Verein „Lesestart“ sucht ehrenamtliche Vorleserinnen und Vorleser. In Text A wird nur beim Aufbau der Zelte um Hilfe gebeten, in Text D erzählt eine Patin von ihrer Arbeit.",
  ),
  readingChoice(
    rTexte,
    "detail",
    `${TEXTE}\n\nWo wird um Unterstützung bei der Vorbereitung eines Festes gebeten?`,
    ["Text B", "Text D", "Text A"],
    2,
    "Text A: „Wer beim Aufbau der Zelte helfen kann, meldet sich bitte ... im Büro“ (Sommerfest).",
  ),
  readingChoice(
    rTexte,
    "attitude",
    `${TEXTE}\n\nWer empfiehlt anderen Menschen, ebenfalls ehrenamtlich aktiv zu werden?`,
    ["Text B", "Text C", "Text A"],
    0,
    "Text B: „Ich kann das wirklich jedem empfehlen!“ In Text D steht nur „es lohnt sich“, ohne Empfehlung an andere.",
  ),
  readingChoice(
    rTexte,
    "detail",
    `${TEXTE}\n\nWer unterstützt regelmäßig ein Kind bei den Aufgaben für die Schule?`,
    ["Text C", "Text D", "Text B"],
    1,
    "Text D: „Heute betreue ich einen Schüler bei den Hausaufgaben. Wir treffen uns meistens dienstags in der Bibliothek.“",
  ),
  readingChoice(
    rTexte,
    "detail",
    `${TEXTE}\n\nWo kann man sich per E-Mail für eine Aufgabe melden?`,
    ["Text D", "Text A", "Text C"],
    2,
    "Text C: „Ihre Bewerbung senden Sie bitte per E-Mail an unser Büro.“ In Text A meldet man sich persönlich im Büro.",
  ),
];

// ================================================================ GRAMMAR (Sprachbausteine)

const cloze = abcCloze({
  instruction: "Lesen Sie den Forumsbeitrag. Wählen Sie für jede Lücke die richtige Lösung.",
  title: "Mein erstes Jahr als Schülerpate",
  text: `
Hallo zusammen,

vor einem Jahr [[habe|*bin|wurde#perfekt.hilfsverb]] ich Schülerpate geworden. Nachdem ich einen Artikel über den Verein [[gelesen habe|*gelesen hatte|las#plusquamperfekt]], habe ich sofort dort angerufen. Wegen [[die|*der|den#genitiv.praeposition]] langen Warteliste musste ich allerdings drei Monate auf einen Platz warten.

Der Verein [[wird|*wurde|hat#passiv.praeteritum]] vor zwanzig Jahren von einem Lehrer gegründet. Am Anfang besucht jeder einen Kurs. Dort [[*wird|werden|wurden#passiv.praesens]] man auf die Arbeit mit den Kindern vorbereitet. Außerdem arbeitet jeder Pate eng mit [[einem Kollege|*einem Kollegen|einen Kollegen#n_deklination]] zusammen. Alle Termine [[*müssen|müsst|gemusst#passiv.modal]] vorher mit den Eltern abgesprochen werden.

Mein Patenkind heißt Emil. Trotz [[einige|*einiger|einigen#genitiv.praeposition]] Schwierigkeiten am Anfang läuft es heute sehr gut. Letzte Woche ist seine Mathearbeit endlich mit „gut“ [[bewertet werden|*bewertet worden|bewertet gewesen#passiv.perfekt]].

Ich kann wirklich jedem empfehlen, [[*sich|euch|ihm#reflexiv]] auch zu engagieren!

Viele Grüße
Tobias
`.trim(),
  note: "1 Perfekt mit „sein“; 2 Plusquamperfekt nach „nachdem“; 3 Genitiv nach der Präposition „wegen“; 4 Passiv Präteritum; 5 Passiv Präsens; 6 n-Deklination, Dativ; 7 Passiv mit Modalverb; 8 Genitiv Plural nach „trotz“; 9 Passiv Perfekt; 10 Reflexivpronomen im Infinitiv mit „zu“.",
});

const sentences = [
  grammarChoice(
    "konnektor.zweiteilig",
    "Unser Verein sucht ___ Helfer für den Garten ___ Vorleser für die Grundschule.",
    ["entweder … noch", "sowohl … als auch", "zwar … aber", "weder … noch"],
    1,
    "Geprüftes Grammatikphänomen: zweiteiliger Konnektor („sowohl … als auch“).",
  ),
  grammarChoice(
    "konnektor.zweiteilig",
    "Herr Berger hat ___ Zeit ___ Lust, am Samstag mitzumachen. Er bleibt lieber zu Hause.",
    ["sowohl … als auch", "nicht nur … sondern auch", "weder … noch", "je … desto"],
    2,
    "Geprüftes Grammatikphänomen: zweiteiliger Konnektor, Negation („weder … noch“). Hinweis: Der zweite Satz („Er bleibt lieber zu Hause.“) wurde zur Vorlage der Lehrkraft ergänzt, damit nur „weder … noch“ passt (ohne ihn passen auch „sowohl … als auch“ und „nicht nur … sondern auch“).",
  ),
  grammarChoice(
    "infinitiv.zu",
    "Die Kinder haben versprochen, pünktlich ___.",
    ["kommen", "zu kommen", "gekommen", "zu kamen"],
    1,
    "Geprüftes Grammatikphänomen: Infinitiv mit „zu“ („versprechen“ + zu-Infinitiv).",
  ),
  grammarChoice(
    "infinitiv.zu",
    "Ich habe leider vergessen, die Anmeldung ___.",
    ["abgeben", "abgegeben", "abzugeben", "zu abgeben"],
    2,
    "Geprüftes Grammatikphänomen: Infinitiv mit „zu“ bei einem trennbaren Verb („abzugeben“, „zu“ steht zwischen Präfix und Verb).",
  ),
  grammarChoice(
    "partizipattribut",
    "Die im Frühling ___ Blumen müssen jeden Tag gegossen werden.",
    ["gepflanzten", "pflanzenden", "pflanzen", "gepflanzt"],
    0,
    "Geprüftes Grammatikphänomen: Partizip II als Adjektiv vor dem Nomen („die gepflanzten Blumen“, die Blumen wurden gepflanzt).",
  ),
  grammarChoice(
    "partizipattribut",
    "Die ___ Kinder liefen sofort zum Gartenhaus.",
    ["gelacht", "lachen", "lachenden", "gelachten"],
    2,
    "Geprüftes Grammatikphänomen: Partizip I als Adjektiv vor dem Nomen („die lachenden Kinder“, die Kinder lachen).",
  ),
  grammarChoice(
    "reflexiv",
    "Nach der Arbeit im Garten wasche ___ immer die Hände.",
    ["mich", "mir", "sich", "mein"],
    1,
    "Geprüftes Grammatikphänomen: Reflexivpronomen im Dativ (mit Akkusativobjekt „die Hände“).",
  ),
  grammarChoice(
    "reflexiv",
    "Die neuen Mitglieder stellen ___ am ersten Abend kurz vor.",
    ["ihnen", "sich", "euch", "uns"],
    1,
    "Geprüftes Grammatikphänomen: Reflexivpronomen im Akkusativ (3. Person Plural: „sich“).",
  ),
  grammarChoice(
    "relativsatz",
    "Der Kollege, ___ ich das Werkzeug gegeben habe, ist heute nicht da.",
    ["den", "dem", "der", "dessen"],
    1,
    "Geprüftes Grammatikphänomen: Relativpronomen im Dativ („jemandem etwas geben“).",
  ),
  grammarChoice(
    "relativsatz.praeposition",
    "Das ist die Nachbarin, mit ___ ich den Garten seit drei Jahren pflege.",
    ["die", "der", "dem", "denen"],
    1,
    "Geprüftes Grammatikphänomen: Relativpronomen im Dativ nach Präposition („mit der Nachbarin“).",
  ),
  grammarChoice(
    "praepositionaladverb",
    "___ freust du dich am meisten? – Auf das Sommerfest im Juli.",
    ["Darauf", "Woran", "Worauf", "Daran"],
    2,
    "Geprüftes Grammatikphänomen: Pronominaladverb in der Frage („sich freuen auf“ + Akkusativ: „Worauf?“).",
  ),
  grammarChoice(
    "praepositionaladverb",
    "Wir haben lange über das Projekt gesprochen und viel ___ gelernt.",
    ["davon", "wovon", "darauf", "worauf"],
    0,
    "Geprüftes Grammatikphänomen: Pronominaladverb („lernen von“ + Dativ: „davon“).",
  ),
  grammarChoice(
    "passiv.praeteritum",
    "Nachdem der Verein das Grundstück bekommen hatte, ___ die Arbeit sofort begonnen.",
    ["war", "hatte", "ist", "wurde"],
    3,
    "Geprüftes Grammatikphänomen: Passiv Präteritum nach „nachdem“ + Plusquamperfekt („wurde ... begonnen“).",
  ),
  grammarChoice(
    "genitiv.praeposition",
    "Trotz ___ starken Regens sind viele Nachbarn gekommen.",
    ["dem", "des", "der", "den"],
    1,
    "Geprüftes Grammatikphänomen: Genitiv nach der Präposition „trotz“ (maskulin: „des Regens“).",
  ),
  grammarChoice(
    "n_deklination",
    "Gestern haben wir mit ___ über den neuen Plan gesprochen.",
    ["dem Praktikant", "der Praktikant", "den Praktikant", "dem Praktikanten"],
    3,
    "Geprüftes Grammatikphänomen: n-Deklination, Dativ („dem Praktikanten“).",
  ),
];

// ================================================================ LISTENING (new)

const lGleis = listeningClip(
  "course-b1-final-a-l-gleisaenderung",
  "Durchsage am Bahnhof",
  "Reisen und Bahn",
  [{ label: "Durchsage", voice: "A" }],
  [
    "Durchsage: Meine Damen und Herren, wir bitten um Ihre Aufmerksamkeit. Der Intercity nach Hamburg, planmäßige Abfahrt vierzehn Uhr zwanzig, fährt heute nicht von Gleis zwölf ab, sondern von Gleis vier. Ich wiederhole: von Gleis vier. Wegen einer Baustelle hat der Zug etwa zwanzig Minuten Verspätung. Der Weg zu Gleis vier führt durch die Unterführung neben dem Reisezentrum, bitte folgen Sie den Schildern. Reisende nach Bremen nehmen bitte den Regionalzug auf Gleis neun. Dieser Zug fährt pünktlich. Wir bitten um Ihr Verständnis.",
  ],
);

const lKundendienst = listeningClip(
  "course-b1-final-a-l-waschmaschine",
  "Nachricht vom Kundendienst",
  "Technik und Reklamation",
  [{ label: "Frau Okafor", voice: "D" }],
  [
    "Frau Okafor: Guten Tag, Frau Petrović, hier spricht Okafor vom Kundendienst der Firma Elektro Lang. Es geht um Ihre Waschmaschine. Unser Techniker kann leider nicht am Dienstag kommen, wie wir es besprochen hatten, sondern erst am Donnerstag. Er ist dann zwischen acht und zwölf Uhr bei Ihnen. Die Reparatur kostet nichts, denn die Maschine hat noch Garantie. Damit der Techniker das gleich prüfen kann, legen Sie bitte die Rechnung vom Kauf bereit. Die Garantiekarte haben wir schon im System, und seinen Ausweis zeigt Ihnen der Techniker an der Tür. Wenn der Termin nicht passt, rufen Sie uns zurück: null, sieben, eins, eins, vier, zwei, sechs. Auf Wiederhören.",
  ],
);

const lBewerbung = listeningClip(
  "course-b1-final-a-l-vorstellungsgespraech",
  "Nachricht aus der Personalabteilung",
  "Arbeit und Bewerbung",
  [{ label: "Herr Brandt", voice: "B" }],
  [
    "Herr Brandt: Guten Tag, Frau Aydin, hier ist Brandt von der Firma Neumeier Logistik. Vielen Dank für Ihre Bewerbung als Lagerleiterin. Wir möchten Sie gern kennenlernen. Das Vorstellungsgespräch wäre am Mittwoch um neun Uhr möglich oder, wenn Ihnen das lieber ist, am Freitag um halb elf. Es dauert etwa eine Stunde, danach zeigen wir Ihnen noch die Lagerhalle. Bitte rufen Sie mich bis morgen Mittag zurück und sagen Sie mir, welcher Termin Ihnen passt. Meine Durchwahl ist die vier, sieben. Ich bin heute noch bis siebzehn Uhr erreichbar.",
  ],
);

const lWetter = listeningClip(
  "course-b1-final-a-l-wochenendwetter",
  "Wetter am Wochenende",
  "Wetter und Umwelt",
  [{ label: "Sprecher", voice: "C" }],
  [
    "Sprecher: Und nun zum Wetter am Wochenende. Am Samstag ist es im Norden trocken und sonnig, im Süden dagegen regnet es immer wieder, bei höchstens zwölf Grad. Am Sonntag bleibt es überall trocken, aber es wird deutlich kühler: Wir erwarten nur noch acht Grad, in der Nacht sogar Frost. Ab Montag steigen die Temperaturen wieder, dann kommt allerdings starker Wind auf. Und noch ein Hinweis für alle, die etwas für die Umwelt tun möchten: Am Samstag gibt es im Rathaus von zehn bis vierzehn Uhr einen Tauschmarkt für Kleidung und Bücher.",
  ],
);

const lErsatzbus = listeningClip(
  "course-b1-final-a-l-ersatzbus",
  "Durchsage der Verkehrsbetriebe",
  "Stadt und Verkehr",
  [{ label: "Durchsage", voice: "A" }],
  [
    "Durchsage: Liebe Fahrgäste, wegen einer Baustelle am Marktplatz fahren die Straßenbahnlinien zwölf und vierzehn bis zum fünfzehnten Mai nicht durch die Innenstadt. Bitte steigen Sie am Hauptbahnhof in den Ersatzbus um. Die Haltestelle des Ersatzbusses finden Sie hinter dem Theater. Die Fahrt dauert etwa zehn Minuten länger als sonst. Wer eine Monatskarte hat, fährt im Ersatzbus kostenlos. Alle anderen Fahrgäste kaufen beim Busfahrer ein Zusatzticket für einen Euro zwanzig. Eine Erstattung für die längere Fahrzeit ist leider nicht möglich. Aktuelle Informationen finden Sie auf unserer Internetseite.",
  ],
);

const lTheater = listeningClip(
  "course-b1-final-a-l-theaterkurs",
  "Gespräch über einen Kurs",
  "Kurse und Freizeit",
  [
    { label: "Nadia", voice: "A" },
    { label: "Jonas", voice: "C" },
  ],
  [
    "Nadia: Hallo Jonas! Schön, dich zu sehen. Du siehst müde aus.",
    "Jonas: Ach, hallo Nadia. Ja, ich war gestern lange im Büro. Und du? Du strahlst ja richtig.",
    "Nadia: Ich komme gerade vom Theaterkurs! Ich mache seit drei Wochen einen Kurs für Improtheater an der Volkshochschule.",
    "Jonas: Improtheater? Das klingt spannend. Was macht man da genau?",
    "Nadia: Man spielt kleine Szenen, ganz ohne Text. Die Kursleiterin gibt ein Thema vor, und dann muss man einfach loslegen. Am Anfang war mir das richtig peinlich, aber jetzt macht es mir riesigen Spaß.",
    "Jonas: Und braucht man dafür Erfahrung? Ich habe noch nie Theater gespielt.",
    "Nadia: Nein, überhaupt nicht. Von den zehn Leuten in meiner Gruppe hat nur einer schon einmal auf einer Bühne gestanden. Für alle anderen ist es neu.",
    "Jonas: Aha. Und wann findet der Kurs statt?",
    "Nadia: Immer mittwochs um halb sieben, zwei Stunden lang. Er geht noch bis Ende Mai und kostet fünfundachtzig Euro.",
    "Jonas: Mittwochs? Mist, da habe ich meinen Spanischkurs. Das ist schade.",
    "Nadia: Warte mal, es gibt noch einen zweiten Kurs, am Samstagvormittag. Der beginnt aber erst im Juni.",
    "Jonas: Samstagvormittag wäre sogar besser für mich. Hast du die Nummer von der Volkshochschule?",
    "Nadia: Du kannst dich auch im Internet anmelden. Aber beeil dich, die Plätze sind schnell weg. Bei meinem Kurs war nach zwei Tagen alles ausgebucht.",
    "Jonas: Dann melde ich mich heute Abend an. Und vielleicht schaue ich bei dir mal zu?",
    "Nadia: Das geht leider nicht, Zuschauer sind im Kurs nicht erlaubt. Aber ich erzähle dir nächste Woche, was wir gemacht haben.",
    "Jonas: Super, das machen wir. Danke für den Tipp!",
  ],
);

const listening = [
  listeningChoice(
    lGleis,
    "detail",
    "Von welchem Gleis fährt der Intercity nach Hamburg heute ab?",
    ["Gleis 4", "Gleis 9", "Gleis 12"],
    0,
    "Gleis 4: Der Intercity fährt nicht wie geplant von Gleis 12, sondern von Gleis 4 ab. Gleis 9 gilt für den Regionalzug nach Bremen.",
  ),
  listeningChoice(
    lKundendienst,
    "detail",
    "Was soll Frau Petrović für den Termin bereitlegen?",
    ["die Garantiekarte des Geräts", "die Rechnung vom Kauf", "ihren Personalausweis"],
    1,
    "Die Rechnung vom Kauf: „legen Sie bitte die Rechnung vom Kauf bereit“. Die Garantiekarte hat die Firma schon im System, den Ausweis zeigt der Techniker.",
  ),
  listeningChoice(
    lBewerbung,
    "detail",
    "Bis wann soll Frau Aydin zurückrufen?",
    ["bis heute um 17 Uhr", "bis Mittwoch um 9 Uhr", "bis morgen Mittag"],
    2,
    "Bis morgen Mittag: „Bitte rufen Sie mich bis morgen Mittag zurück.“ 17 Uhr ist nur die Erreichbarkeit heute, Mittwoch um 9 Uhr ist ein möglicher Termin.",
  ),
  listeningChoice(
    lWetter,
    "detail",
    "Wie wird das Wetter am Sonntag?",
    ["Im Süden regnet es immer wieder, bei zwölf Grad.", "Es bleibt trocken, wird aber kühler.", "Es wird wärmer, aber windig."],
    1,
    "Sonntag: überall trocken, nur noch acht Grad. Regen im Süden gilt für Samstag, wärmer und windig ab Montag.",
  ),
  listeningChoice(
    lErsatzbus,
    "detail",
    "Was gilt für Fahrgäste mit einer Monatskarte?",
    ["Sie fahren im Ersatzbus ohne Zusatzkosten.", "Sie kaufen beim Busfahrer ein Zusatzticket.", "Sie bekommen Geld für die längere Fahrzeit zurück."],
    0,
    "Mit Monatskarte ist der Ersatzbus kostenlos. Das Zusatzticket kaufen alle anderen Fahrgäste, eine Erstattung für die längere Fahrzeit ist nicht möglich.",
  ),
  listeningTfng(
    lTheater,
    "detail",
    "Hören Sie das Gespräch. Sind die Aussagen richtig oder falsch? Kreuzen Sie an.",
    [
      ["Nadia besucht den Kurs seit drei Wochen.", "R"],
      ["Für den Kurs braucht man Erfahrung mit Theater.", "F"],
      ["Der Kurs kostet 85 Euro.", "R"],
      ["Jonas kann mittwochs nicht an dem Kurs teilnehmen.", "R"],
      ["Jonas darf bei Nadias Kurs zuschauen.", "F"],
    ],
    "1 Richtig: „seit drei Wochen“. 2 Falsch: „Nein, überhaupt nicht“ (nur einer hat Bühnenerfahrung). 3 Richtig: „kostet fünfundachtzig Euro“. 4 Richtig: mittwochs hat Jonas seinen Spanischkurs. 5 Falsch: „Zuschauer sind im Kurs nicht erlaubt“.",
  ),
];

// ================================================================ WRITING

const writing = [
  formalEmail({
    situation: "Sie waren gestern beim Infoabend des Vereins „Miteinander e. V.“ und möchten sich dort ehrenamtlich engagieren. Schreiben Sie eine E-Mail an die Koordinatorin, Frau Neumann.",
    points: [
      "Nennen Sie Ihr Interesse und begründen Sie, warum Sie sich ehrenamtlich engagieren möchten.",
      "Beschreiben Sie, welche Erfahrungen oder Fähigkeiten Sie mitbringen und wie viel Zeit Sie pro Woche haben.",
      "Fragen Sie nach, wie die Bewerbung abläuft und ob eine Schulung angeboten wird.",
    ],
    contentPoints: [
      "Leitpunkt 1: das Interesse am Ehrenamt nennen UND begründen, warum man sich engagieren möchte (ein bloßes „Ich möchte helfen“ ohne Begründung erfüllt den Punkt nicht)",
      "Leitpunkt 2: Erfahrungen oder Fähigkeiten beschreiben UND das Zeitbudget pro Woche nennen (konkret in Stunden oder Tagen, „ich habe Zeit“ genügt nicht)",
      "Leitpunkt 3: nachfragen, wie die Bewerbung abläuft UND ob eine Schulung angeboten wird (nur eine der beiden Fragen: Punkt nur teilweise erfüllt)",
    ],
    studentPoints: ["Interesse nennen und begründen", "Erfahrungen und Zeit pro Woche", "Fragen zu Bewerbung und Schulung"],
    explanation:
      "Formelle E-Mail (Halil Bey, Abschlusstest B1 Version A, Teil 3). Bewertung: Inhalt, Wortschatz und Grammatik je 0 bis 3 Punkte. Inhalt 0 Punkte bedeutet: Teil 3 nicht bestanden.",
  }),
];

// ================================================================ SPEAKING

const speaking = [
  speakingTask(
    "introduction",
    "Stellen Sie sich bitte kurz vor.\n\nSprechen Sie über diese Punkte:\n- Ihr Name\n- Die Stadt oder Region, in der Sie wohnen\n- Ihr Beruf oder Ihre Tätigkeit\n- Ihre Freizeit\n- Ihre Sprachen",
    [
      "nennt den Namen und die Stadt oder Region, in der man lebt",
      "sagt, was man beruflich oder in der Ausbildung macht",
      "erzählt von der Freizeit mit mindestens einem Detail",
      "nennt die Sprachen, die man spricht oder lernt",
    ],
    "Selbstvorstellung, ca. eine Minute (Kennenlernen wie in Teil 1 der mündlichen Prüfung). Bewertung: Kommunikation, Wortschatz, Grammatik, Aussprache, Kohärenz je 0 bis 4 Punkte.",
  ),
  speakingTask(
    "presentation",
    "Halten Sie bitte eine kurze Präsentation.\n\nThema: „Einkaufen: Vor Ort oder im Internet?“\nSprechen Sie ungefähr zwei Minuten zu allen vier Punkten:\n- Was verstehen Sie unter „vor Ort einkaufen“ und „online einkaufen“? Nennen Sie kurze Beispiele.\n- Welche Vorteile hat das Einkaufen vor Ort, zum Beispiel Beratung oder Anprobieren?\n- Welche Vorteile hat das Einkaufen im Internet, zum Beispiel Auswahl oder Zeitersparnis?\n- Was ist Ihre persönliche Meinung: Wie kaufen Sie am liebsten ein, und warum?",
    [
      "erklärt „vor Ort einkaufen“ und „online einkaufen“ mit kurzen Beispielen",
      "nennt Vorteile des Einkaufens vor Ort (z. B. Beratung, Anprobieren)",
      "nennt Vorteile des Einkaufens im Internet (z. B. Auswahl, Zeitersparnis)",
      "sagt die eigene Meinung und begründet sie",
    ],
    "Präsentation mit vier Leitpunkten (Karte 2A der mündlichen Prüfung, Halil Bey), ca. zwei Minuten. Bewertung: Kommunikation, Wortschatz, Grammatik, Aussprache, Kohärenz je 0 bis 4 Punkte.",
  ),
  speakingTask(
    "planning",
    "Machen Sie bitte Vorschläge für ein Abschiedsfest.\n\nEine Kollegin verlässt bald die Firma. Sie planen ein Abschiedsfest für sie. Machen Sie Vorschläge und sagen Sie, warum Sie das gut finden:\n- Wann und wo soll das Fest stattfinden?\n- Was soll es zu essen und zu trinken geben?\n- Soll es ein gemeinsames Geschenk geben?\n- Welcher Punkt ist Ihnen am wichtigsten, und warum?",
    [
      "macht Vorschläge zu mindestens zwei der drei Planungspunkte (Zeit und Ort, Essen und Trinken, Geschenk)",
      "begründet die Vorschläge (weil, denn, deshalb)",
      "benutzt Formen für Vorschläge (Wir könnten ..., Ich schlage vor, ..., Wie wäre es, wenn ...)",
      "sagt, welcher Punkt am wichtigsten ist, und warum",
    ],
    "Gemeinsam planen als Monolog (Karte 3 der mündlichen Prüfung, Halil Bey, gekürzt auf drei Planungspunkte und eine Meinung): Vorschläge machen und eine Meinung äußern. Bewertung: Kommunikation, Wortschatz, Grammatik, Aussprache, Kohärenz je 0 bis 4 Punkte.",
  ),
];

export const B1_FINAL_A: SeedCourseForm = {
  key: "B1",
  form: "A",
  syllabus: {
    source:
      "Inhaltsverzeichnisse Netzwerk neu B1.1 (Kapitel 1-6) und B1.2 (Kapitel 7-12), Klett 2021, bei der Deutschen Nationalbibliothek: https://d-nb.info/1226980031/04 und https://d-nb.info/1228099243/04. Produktseite: https://www.klett-sprachen.de/netzwerk-neu-b1/t-0/9783126071741",
    chapters: "Netzwerk neu B1, Kapitel 1-12",
    topics: [
      "Infinitiv mit zu",
      "Nebensätze mit weil, da, obwohl, damit, um ... zu",
      "Genitiv, wegen und trotz",
      "Präteritum und Plusquamperfekt, temporale Nebensätze",
      "Passiv (Präsens, Präteritum, Perfekt, mit Modalverb)",
      "n-Deklination und Relativsätze",
      "Reflexivpronomen und Pronominaladverbien",
      "zweiteilige Konnektoren",
      "Partizip I und II als Adjektiv",
      "Ehrenamt, Verein und Gesellschaft",
    ],
  },
  sections: [
    { section: "READING", stimuli: [rGarten, rTexte], items: reading },
    { section: "GRAMMAR", stimuli: [], items: [cloze, ...sentences] },
    { section: "LISTENING", stimuli: [lGleis, lKundendienst, lBewerbung, lWetter, lErsatzbus, lTheater], items: listening },
    { section: "WRITING", stimuli: [], items: writing },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
