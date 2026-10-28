import type { SeedCourseForm } from "../types";
import { LIFE_TIME, INTRO_TIME, PROPOSAL_TIME, WRITING_WORDS, a, choice3, cloze3, finalSyllabus, stimuliOf, writingPrompt } from "./kit";

/**
 * Abschlusstest A2, form A (spec 2026-10-28). Netzwerk neu A2, Kapitel 1-12; shares no item or text with the
 * Zwischentest A2.1. Grammar blueprint shared with form B (same phenomena, same order): the cloze tests Perfekt mit
 * sein, Präteritum von sein, Wechselpräposition (wo?), als / wenn, Komparativ, reflexive Verben, deshalb / trotzdem,
 * Relativpronomen im Nominativ, Adjektivendung after ein and Dativ; the fifteen sentences Partizip II, Präteritum der
 * Modalverben, weil, dass, Inversion nach „wenn“, Superlativ, höfliche Bitte (Konjunktiv II), lokale Präposition,
 * Wechselpräposition, indirekte Frage, Ratschlag mit „sollte“, deshalb / trotzdem, Verb mit Präposition,
 * Relativpronomen im Akkusativ and Wunsch im Konjunktiv II.
 */
const s = stimuliOf("ct-a2f-a");

// ================================================================ READING

const ohneAuto = s.text(
  "ohne-auto",
  "Ein Jahr ohne Auto",
  "Verkehr und Alltag",
  `
Familie Hoffmann-Diallo wohnt in Bremen. Bis zum letzten Sommer hatte die Familie ein Auto, aber es war alt und musste oft in die Werkstatt. Da hatten Jana Hoffmann und ihr Mann Moussa eine Idee: Sie wollten ein Jahr ohne Auto leben.

Jetzt fährt Jana jeden Morgen mit dem Fahrrad zur Arbeit. Der Weg führt am Fluss entlang und dauert zwanzig Minuten. „Mit dem Auto war ich auch nicht schneller, weil es morgens immer Stau gab“, sagt sie. Moussa arbeitet in einem Krankenhaus am anderen Ende der Stadt. Er nimmt die Straßenbahn und liest unterwegs die Zeitung.

Für den Wocheneinkauf und für Ausflüge leiht die Familie manchmal ein Auto bei einer Carsharing-Firma. Das kostet etwa 60 Euro im Monat. Früher haben Versicherung, Benzin und Reparaturen zusammen fast 300 Euro im Monat gekostet.

Aber nicht alles ist einfacher. Wenn es im Winter regnet und kalt ist, möchte die Tochter Awa nicht mit dem Rad zur Schule fahren. Dann bringt Moussa sie mit dem Bus hin und kommt selbst oft zu spät zur Arbeit. Trotzdem möchte die Familie kein neues Auto kaufen. „Wir sparen Geld, und wir bewegen uns mehr“, sagt Jana.
`,
);

const angebote = s.text(
  "angebote",
  "Aushang, Forum, Anzeige und Blog",
  "Freizeit und Lernen",
  `
Text A - Aushang im Sportverein
Lauftreff für alle! Sie möchten mehr Sport machen, aber nicht allein? Dann kommen Sie zu unserem Lauftreff. Wir treffen uns jeden Dienstag und Donnerstag um 18.30 Uhr am Eingang vom Stadtpark. Wir laufen langsam, deshalb können auch Anfänger mitmachen. Die ersten vier Wochen sind kostenlos, danach kostet die Mitgliedschaft 8 Euro im Monat. TSV Lindenau

Text B - Beitrag im Forum
Hallo zusammen, ich mache im Juni meine Deutschprüfung und habe große Angst vor dem Hörtest. Ich verstehe die Leute oft nicht, wenn sie schnell sprechen. Ich höre schon jeden Tag Radio, aber das hilft nicht viel. Was habt ihr gemacht? Ich bin für jeden Tipp dankbar! Viele Grüße, Elif

Text C - Anzeige
Sommerfest im Stadtmuseum! Am Samstag, 12. Juli, ist das Museum von 10 bis 22 Uhr geöffnet, und der Eintritt ist frei. Am Nachmittag gibt es Führungen für Kinder, am Abend spielt eine Jazzband im Garten. Auch für Essen und Getränke ist gesorgt. Stadtmuseum Freiburg

Text D - Blogeintrag
Seit einem Monat arbeite ich nur noch vier Tage pro Woche. Am Freitag habe ich jetzt immer frei! Letzten Freitag war ich auf dem Markt und habe danach zum ersten Mal seit Langem in Ruhe gekocht. Ich verdiene jetzt zwar etwas weniger Geld, aber ich bin viel entspannter. Das war die beste Entscheidung in diesem Jahr! Euer Rafael
`,
);

const rOhneAuto = a.forText(ohneAuto);

const reading = [
  rOhneAuto.tfng(
    "detail",
    "MID",
    [
      ["Das alte Auto der Familie hatte oft technische Probleme.", "R"],
      ["Mit dem Auto war Jana früher schneller bei der Arbeit.", "F"],
      ["Moussa fährt mit dem Fahrrad ins Krankenhaus.", "F"],
      ["Das Carsharing ist für die Familie billiger als das eigene Auto.", "R"],
      ["Die Familie möchte bald wieder ein eigenes Auto kaufen.", "F"],
    ],
    "1 R: Das Auto war alt und musste oft in die Werkstatt. 2 F: Mit dem Auto war sie auch nicht schneller, weil es morgens Stau gab. 3 F: Moussa nimmt die Straßenbahn. 4 R: Carsharing kostet etwa 60 Euro im Monat, das eigene Auto fast 300 Euro. 5 F: Die Familie möchte kein neues Auto kaufen.",
  ),
  choice3(
    angebote,
    "detail",
    "MID",
    "Wo kann man am Abend Musik hören?",
    "Text C",
    ["Text A", "Text D"],
    1,
    "Text C: Am Abend spielt eine Jazzband im Garten. Text A nennt auch eine Uhrzeit am Abend, aber dort geht es um Sport. Text D spricht nicht von Musik.",
  ),
  choice3(
    angebote,
    "detail",
    "MID",
    "Wo können auch Anfänger mitmachen?",
    "Text A",
    ["Text B", "Text C"],
    0,
    "Text A: Wir laufen langsam, deshalb können auch Anfänger mitmachen. Text C hat Führungen für Kinder, von Anfängern steht dort nichts. Text B ist eine Frage, kein Angebot.",
  ),
  choice3(
    angebote,
    "detail",
    "MID",
    "Wer bittet andere Leute um Rat?",
    "Text B",
    ["Text A", "Text D"],
    1,
    "Text B: Elif fragt „Was habt ihr gemacht?“ und bittet um Tipps. Text D erzählt nur von einer Entscheidung, Text A lädt zum Lauftreff ein.",
  ),
  choice3(
    angebote,
    "detail",
    "MID",
    "Wer hat jetzt mehr Freizeit als früher?",
    "Text D",
    ["Text B", "Text C"],
    2,
    "Text D: Rafael arbeitet nur noch vier Tage pro Woche und hat am Freitag frei. Text B spricht vom Lernen, Text C von einem Fest im Museum.",
  ),
  choice3(
    angebote,
    "detail",
    "MID",
    "Wo muss man nach einiger Zeit Geld bezahlen?",
    "Text A",
    ["Text C", "Text D"],
    0,
    "Text A: Die ersten vier Wochen sind kostenlos, danach kostet die Mitgliedschaft 8 Euro im Monat. In Text C ist der Eintritt frei. In Text D verdient Rafael weniger, er muss aber nichts bezahlen.",
  ),
];

// ================================================================ GRAMMAR

const cloze = cloze3("MID", {
  title: "Endlich in Hamburg",
  first: "Hallo Tobias, endlich habe ich Zeit für eine lange E-Mail!",
  body:
    "Letzten Monat [[bin|habe|hatte#perfekt.hilfsverb]] ich mit meiner Familie nach Hamburg umgezogen. " +
    "Am Umzugstag [[war|hatte|wäre#praeteritum]] das Wetter leider sehr schlecht, und alle Kisten sind nass geworden. " +
    "Aber jetzt steht das Sofa endlich [[im|ins|in den#wechselpraeposition]] Wohnzimmer, und wir fühlen uns schon wohl. " +
    "[[Als|Wenn|Wann#konnektor.als_wenn]] ich die Wohnung zum ersten Mal gesehen habe, war ich sofort begeistert. " +
    "Sie ist viel [[heller|hell|am hellsten#adjektiv.komparativ]] als unsere alte Wohnung, und die Kinder freuen [[sich|uns|ihnen#reflexiv]] über ihre eigenen Zimmer. " +
    "Leider liegt das Haus direkt an einer großen Straße, [[deshalb|trotzdem|weil#konnektor]] ist es manchmal ziemlich laut. " +
    "Unsere Nachbarin, [[die|der|den#relativsatz]] im ersten Stock wohnt, hat uns am ersten Tag einen Kuchen gebracht. " +
    "Sie hat einen [[kleinen|kleiner|kleines#adjektivendung]] Hund, und meine Tochter geht jetzt jeden Abend mit [[dem|den|der#dativ]] Hund spazieren.",
  last: "Besuch uns doch bald einmal, dann zeige ich dir alles!",
  note: "Perfekt mit „sein“ bei umziehen (g1), Präteritum von „sein“ (g2), Wechselpräposition mit Dativ auf die Frage „wo?“ (g3), „als“ für ein einmaliges Ereignis in der Vergangenheit (g4), Komparativ mit „als“ (g5), Reflexivpronomen zu „die Kinder“ (g6), „deshalb“ für eine Folge (g7), Relativpronomen im Nominativ (g8), Adjektivendung nach „einen“ (g9), „mit“ und Dativ (g10).",
});

const sentences = [
  a.grammarChoice(
    "perfekt.partizip",
    "EASY",
    "Hast du den Brief von der Bank schon ____?",
    "gelesen",
    ["lesen", "las", "liest"],
    1,
    "Perfekt: Partizip II eines unregelmäßigen Verbs (lesen: gelesen)",
  ),
  a.grammarChoice(
    "praeteritum",
    "MID",
    "Gestern ____ ich nicht zum Kurs kommen, weil mein Sohn krank war.",
    "konnte",
    ["kann", "könnte", "gekonnt"],
    0,
    "Präteritum der Modalverben (können: konnte)",
  ),
  a.grammarChoice(
    "nebensatz",
    "MID",
    "Ich lerne Deutsch, ____ ich in Wien studieren möchte.",
    "weil",
    ["denn", "deshalb", "trotzdem"],
    2,
    "Nebensatz mit „weil“: Das konjugierte Verb steht am Ende (nach „denn“ stünde es an zweiter Stelle)",
  ),
  a.grammarChoice(
    "nebensatz",
    "MID",
    "Ich hoffe, dass ____.",
    "du bald wieder gesund bist",
    ["du bist bald wieder gesund", "bist du bald wieder gesund", "du bald wieder gesund sein"],
    3,
    "Nebensatz mit „dass“: Das konjugierte Verb steht am Ende",
  ),
  a.grammarChoice(
    "wortstellung.inversion",
    "MID",
    "Wenn ich am Wochenende Zeit habe, ____.",
    "besuche ich meine Großeltern",
    ["ich besuche meine Großeltern", "ich meine Großeltern besuche", "meine Großeltern besuche ich"],
    1,
    "Hauptsatz nach einem vorangestellten „wenn“-Satz: Das Verb steht an erster Stelle des Hauptsatzes",
  ),
  a.grammarChoice(
    "adjektiv.superlativ",
    "MID",
    "Von allen Monaten ist der Juli bei uns ____.",
    "am wärmsten",
    ["wärmsten", "wärmer", "warm"],
    0,
    "Superlativ mit „am“ (am wärmsten)",
  ),
  a.grammarChoice(
    "konjunktiv2.modal",
    "MID",
    "Entschuldigung, ____ Sie mir bitte helfen? Ich finde den Ausgang nicht.",
    "könnten",
    ["konnten", "könntest", "gekonnt"],
    2,
    "Höfliche Bitte mit Konjunktiv II („könnten Sie“)",
  ),
  a.grammarChoice(
    "praeposition.ort",
    "MID",
    "Fahren Sie ____ den Park, dann sind Sie schneller am Bahnhof.",
    "durch",
    ["gegenüber", "vorbei", "bis zu"],
    3,
    "Lokale Präposition: „durch“ mit Akkusativ (durch den Park)",
  ),
  a.grammarChoice(
    "wechselpraeposition",
    "MID",
    "Stell die Milch bitte in ____ Kühlschrank.",
    "den",
    ["dem", "der", "die"],
    1,
    "Wechselpräposition mit Akkusativ auf die Frage „wohin?“ (in den Kühlschrank stellen)",
  ),
  a.grammarChoice(
    "nebensatz",
    "MID",
    "Können Sie mir sagen, ____?",
    "wo die nächste Apotheke ist",
    ["wo ist die nächste Apotheke", "die nächste Apotheke wo ist", "wo die nächste Apotheke sein"],
    0,
    "Indirekte Frage mit Fragewort: Das konjugierte Verb steht am Ende",
  ),
  a.grammarChoice(
    "konjunktiv2.modal",
    "MID",
    "Du hustest schon seit einer Woche. Du ____ wirklich zum Arzt gehen.",
    "solltest",
    ["sollte", "solltet", "sollten"],
    2,
    "Ratschlag mit „sollte“ (Konjunktiv II von „sollen“), Form zu „du“",
  ),
  a.grammarChoice(
    "konnektor",
    "MID",
    "Es hat den ganzen Tag geregnet. ____ sind wir joggen gegangen.",
    "Trotzdem",
    ["Deshalb", "Weil", "Denn"],
    3,
    "„trotzdem“ für einen Gegensatz, mit dem Verb direkt danach",
  ),
  a.grammarChoice(
    "verb_praeposition",
    "MID",
    "Ich warte schon seit zwanzig Minuten ____ den Bus.",
    "auf",
    ["für", "an", "über"],
    0,
    "Verb mit fester Präposition (warten auf + Akkusativ)",
  ),
  a.grammarChoice(
    "relativsatz",
    "MID",
    "Das ist der Film, ____ ich dir empfohlen habe.",
    "den",
    ["der", "dem", "die"],
    1,
    "Relativpronomen im Akkusativ (der Film: den)",
  ),
  a.grammarChoice(
    "konjunktiv2",
    "MID",
    "Ich arbeite sehr viel. Ich ____ gern mehr Zeit für meine Familie.",
    "hätte",
    ["hatte", "wäre", "würde"],
    2,
    "Wunsch mit Konjunktiv II („hätte gern“)",
  ),
];

// ================================================================ LISTENING

const strassenbahn = s.clip("strassenbahn", "Durchsage in der Straßenbahn", "Verkehr in der Stadt", [{ label: "Durchsage", voice: "A" }], [
  "Durchsage: Liebe Fahrgäste, eine Information zur Linie vier. Wegen einer Baustelle fährt die Bahn heute nicht bis zum Hauptbahnhof. Fahrgäste zum Hauptbahnhof steigen bitte am Rathausplatz aus und nehmen dort den Bus zwölf. Der Bus fährt alle zehn Minuten, direkt bis zum Hauptbahnhof. Fahrgäste zum Stadion bleiben bitte in der Bahn, Sie müssen nicht umsteigen. Vielen Dank für Ihr Verständnis.",
]);

const volleyball = s.clip("volleyball", "Nachricht vom Volleyballtrainer", "Sport im Verein", [{ label: "Kemal", voice: "B" }], [
  "Kemal: Hallo Leute, hier ist Kemal vom Volleyballteam. Kurze Info: Das Training am Mittwoch fällt aus, die Halle ist geschlossen. Wir trainieren dafür am Freitag, aber erst um halb acht, also nicht um sieben. Ach ja, und bringt bitte eure Hallenschuhe mit. Am Sonntag ist dann unser Spiel in Bergheim, Treffpunkt um neun am Parkplatz. Bis Freitag!",
]);

const konzert = s.clip("konzert", "Kulturtipp im Radio", "Musik und Kultur", [{ label: "Moderatorin", voice: "D" }], [
  "Moderatorin: Und jetzt unser Kulturtipp für das Wochenende: Am Samstag spielt die Band „Nordlicht“ im Stadtpark. Das Konzert beginnt um zwanzig Uhr, und der Eintritt ist frei. Aber Achtung: Wenn es regnet, ist das Konzert in der Stadthalle, und dann kosten die Karten zehn Euro. Die Karten gibt es dann nur an der Abendkasse, nicht im Internet. Kommen Sie am besten mit dem Fahrrad, Parkplätze gibt es nur wenige.",
]);

const sprachschule = s.clip("sprachschule", "Nachricht von der Sprachschule", "Kurs und Prüfung", [{ label: "Herr Albrecht", voice: "C" }], [
  "Herr Albrecht: Guten Tag, Frau Nguyen, hier spricht Albrecht von der Sprachschule Lingua. Sie haben sich ja für die Prüfung am zwölften Mai angemeldet, das hat geklappt. Bezahlt haben Sie auch schon, das ist alles in Ordnung. Aber leider fehlt noch eine Kopie von Ihrem Ausweis. Bitte bringen Sie die Kopie bis Freitag ins Sekretariat. Bei Fragen rufen Sie mich einfach an. Auf Wiederhören!",
]);

const nachbar = s.clip("nachbar", "Nachricht vom Nachbarn", "Nachbarschaft", [{ label: "Lukas", voice: "B" }], [
  "Lukas: Hallo Frau Brandt, hier ist Lukas Meier von nebenan. Ich fahre morgen für eine Woche zu meinen Eltern. Könnten Sie vielleicht meine Blumen gießen? Den Schlüssel gebe ich heute Abend Ihrem Mann, Sie sind ja im Moment nicht zu Hause. Meine Katze nehme ich übrigens mit, um die müssen Sie sich also nicht kümmern. Vielen Dank schon mal!",
]);

const landleben = s.clip(
  "landleben",
  "Leben auf dem Land",
  "Stadt und Land",
  [
    { label: "Aylin", voice: "A" },
    { label: "Marco", voice: "B" },
  ],
  [
    "Aylin: Hallo Marco! Lange nicht gesehen. Wie geht's dir in deinem Dorf?",
    "Marco: Hi Aylin! Ganz gut, danke. Wir wohnen jetzt seit März auf dem Land, und die Kinder sind sehr glücklich. Sie haben endlich einen Garten und spielen jeden Tag draußen.",
    "Aylin: Und du? Vermisst du die Stadt nicht?",
    "Marco: Na ja, manchmal schon. Das Kino und die Cafés fehlen mir. Und der Weg zur Arbeit ist viel länger. Ich brauche fast eine Stunde mit dem Zug.",
    "Aylin: Eine Stunde? Das wäre nichts für mich.",
    "Marco: Ach, im Zug lese ich oder höre Musik, das ist eigentlich ganz entspannt. Und zweimal pro Woche arbeite ich von zu Hause.",
    "Aylin: Das ist praktisch. Und wie sind die Nachbarn? Kennst du schon jemanden?",
    "Marco: Sehr nett! Am ersten Wochenende haben sie uns sogar zum Grillen eingeladen. In der Stadt kannten wir unsere Nachbarn kaum.",
    "Aylin: Klingt schön. Vielleicht besuche ich euch mal im Sommer.",
    "Marco: Ja, unbedingt! Komm doch im Juni, dann feiern wir Lenas Geburtstag im Garten.",
  ],
);

const lLandleben = a.forClip(landleben);

const listening = [
  choice3(
    strassenbahn,
    "detail",
    "MID",
    "Was sollen die Fahrgäste zum Hauptbahnhof machen?",
    "Am Rathausplatz in einen Bus umsteigen.",
    ["Bis zum Stadion in der Bahn bleiben.", "Zehn Minuten auf die nächste Bahn warten."],
    0,
    "\"Fahrgäste zum Hauptbahnhof steigen bitte am Rathausplatz aus und nehmen dort den Bus zwölf.\" In der Bahn bleiben nur die Fahrgäste zum Stadion. Alle zehn Minuten fährt der Bus, nicht die Bahn.",
  ),
  choice3(
    volleyball,
    "detail",
    "MID",
    "Wann ist das nächste Training?",
    "Am Freitag um halb acht.",
    ["Am Mittwoch um sieben.", "Am Sonntag um neun."],
    2,
    "\"Wir trainieren dafür am Freitag, aber erst um halb acht.\" Das Training am Mittwoch fällt aus. Am Sonntag um neun ist der Treffpunkt für das Spiel.",
  ),
  choice3(
    konzert,
    "detail",
    "MID",
    "Was ist anders, wenn es am Samstag regnet?",
    "Man muss für das Konzert bezahlen.",
    ["Man kann die Karten nur im Internet kaufen.", "Das Konzert ist trotzdem im Stadtpark."],
    1,
    "\"Wenn es regnet, ist das Konzert in der Stadthalle, und dann kosten die Karten zehn Euro.\" Die Karten gibt es dann nur an der Abendkasse, nicht im Internet, und das Konzert ist nicht im Stadtpark, sondern in der Stadthalle.",
  ),
  choice3(
    sprachschule,
    "detail",
    "MID",
    "Was muss Frau Nguyen noch abgeben?",
    "Eine Kopie von ihrem Ausweis.",
    ["Das Geld für die Prüfung.", "Das Formular für die Anmeldung."],
    0,
    "\"Leider fehlt noch eine Kopie von Ihrem Ausweis.\" Angemeldet hat sie sich schon, und bezahlt hat sie auch schon.",
  ),
  choice3(
    nachbar,
    "detail",
    "MID",
    "Was soll Frau Brandt für Herrn Meier tun?",
    "Sie soll seine Blumen gießen.",
    ["Sie soll seine Katze füttern.", "Sie soll ihm ihren Schlüssel geben."],
    1,
    "\"Könnten Sie vielleicht meine Blumen gießen?\" Die Katze nimmt er mit. Den Schlüssel gibt er selbst ihrem Mann.",
  ),
  lLandleben.tfng(
    "detail",
    "MID",
    [
      ["Den Kindern gefällt das Leben auf dem Land.", "R"],
      ["Marco fährt jeden Tag mit dem Zug zur Arbeit.", "F"],
      ["Marco findet die Fahrt mit dem Zug anstrengend.", "F"],
      ["In der Stadt hat Marco seine Nachbarn gut gekannt.", "F"],
      ["Aylin möchte Marco vielleicht besuchen.", "R"],
    ],
    "1 R: Die Kinder sind sehr glücklich, sie haben endlich einen Garten. 2 F: Zweimal pro Woche arbeitet er von zu Hause. 3 F: Im Zug liest er oder hört Musik, das ist ganz entspannt. 4 F: In der Stadt kannte er seine Nachbarn kaum. 5 R: \"Vielleicht besuche ich euch mal im Sommer.\"",
  ),
];

// ================================================================ WRITING

const writing = a.writing(
  "email",
  "MID",
  WRITING_WORDS,
  writingPrompt(
    "In Ihrer Wohnung ist etwas kaputt. Schreiben Sie Ihrem Vermieter, Herrn Wolf, eine E-Mail.",
    ["Schreiben Sie, was in Ihrer Wohnung kaputt ist.", "Sagen Sie, seit wann das so ist und warum das ein Problem ist.", "Fragen Sie, wann ein Handwerker kommen kann."],
    true,
  ),
  [
    "Sagen, was kaputt ist (z. B. Heizung, Dusche, Fenster)",
    "Seit wann das Problem besteht UND warum es ein Problem ist (z. B. kalt, kein warmes Wasser)",
    "Nach einem Termin für die Reparatur fragen (Frage oder höfliche Bitte)",
  ],
  ["was kaputt ist", "seit wann, und warum das ein Problem ist", "nach einem Termin fragen"],
  "formell (Sie)",
  "Formelle E-Mail an den Vermieter (Kapitel 10: Zusammen leben, Bitten und Beschwerden). Alle drei Punkte müssen erkennbar sein; formelle Anrede („Sehr geehrter Herr Wolf“) und Gruß gehören dazu. Erwartet werden einfache Sätze mit „seit“, „weil“ und eine höfliche Bitte („Könnten Sie ...?“).",
);

// ================================================================ SPEAKING

const speaking = [
  a.speaking(
    "introduction",
    "EASY",
    INTRO_TIME,
    "Bitte stellen Sie sich vor.\n\n- Name\n- Wohnort (Stadt oder Region)\n- Arbeit, Ausbildung oder Studium\n- Freizeit und Hobbys\n- Sprachen",
    [
      "Name nennen",
      "Wohnort nennen (Stadt oder Region)",
      "Arbeit, Ausbildung, Studium oder Tätigkeit nennen",
      "Freizeit oder Hobbys nennen, mit mindestens einem Detail",
      "Sprachen nennen, die man spricht oder lernt",
    ],
    [],
    "Sich vorstellen als Monolog. Ausreichend sind zusammenhängende Sätze zu den fünf Stichwörtern; weitere persönliche Angaben, die nicht auf der Karte stehen, werden weder verlangt noch bewertet.",
  ),
  a.speaking(
    "monologue",
    "MID",
    LIFE_TIME,
    "Erzählen Sie bitte, wie Sie Deutsch lernen.\n\n- Wann und wo lernen Sie?\n- Was machen Sie gern im Kurs, was nicht so gern?\n- Was ist für Sie schwierig?\n- Welchen Tipp haben Sie für andere Lernende?",
    [
      "Sagen, wann und wo man lernt (Kurs, zu Hause, unterwegs)",
      "Etwas nennen, das man gern macht, und etwas, das man nicht so gern macht",
      "Eine Schwierigkeit nennen (z. B. Hören, Grammatik, Aussprache)",
      "Einen Tipp geben, gern mit „Man sollte ...“ oder „Du solltest ...“",
    ],
    [],
    "Über das eigene Leben sprechen (Kapitel 8: Lernen). Erwartet werden Sätze im Präsens, Begründungen mit „weil“ und ein Ratschlag mit „sollte“.",
  ),
  a.speaking(
    "proposal",
    "MID",
    PROPOSAL_TIME,
    "Ihr Deutschkurs ist bald zu Ende, und Sie planen zusammen ein kleines Fest.\n\nMachen Sie Vorschläge und sagen Sie, warum Sie das gut finden:\n- Wann und wo?\n- Essen und Getränke\n- Was machen alle zusammen?\n- Wer bringt was mit?",
    [
      "Zu jedem der vier Punkte einen Vorschlag machen",
      "Mindestens zwei Vorschläge begründen",
      "Redemittel für Vorschläge benutzen (z. B. „Wir könnten ...“, „Wie wäre es mit ...?“, „Ich schlage vor, ...“)",
      "Zum Schluss den Plan kurz zusammenfassen",
    ],
    [],
    "Vorschläge machen und gemeinsam etwas planen, als Monolog (Kapitel 9 und 11: Vorschläge machen, etwas zusammen planen). Erwartet werden Konjunktiv II („Wir könnten ...“) und Begründungen mit „weil“ oder „denn“.",
  ),
];

export const A2_FINAL_A: SeedCourseForm = {
  key: "A2",
  form: "A",
  syllabus: finalSyllabus(),
  sections: [
    { section: "READING", stimuli: [ohneAuto, angebote], items: reading },
    { section: "GRAMMAR", stimuli: [], items: [cloze, ...sentences] },
    { section: "LISTENING", stimuli: [strassenbahn, volleyball, konzert, sprachschule, nachbar, landleben], items: listening },
    { section: "WRITING", stimuli: [], items: [writing] },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
