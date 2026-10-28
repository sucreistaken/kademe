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
 * Abschlusstest B1, Version B: parallel to Version A (the school's written test) in every part. Same shape (a
 * report with five Richtig/Falsch statements, four texts with five "which text" questions, a ten-gap forum text
 * and 15 single sentences on the same 25 phenomena in the same order, a formal email, five announcements and a
 * conversation, three speaking tasks), different texts and sentences. The talk is the school's oral card 2B
 * ("Wohnen: Eigene Wohnung oder WG?"); the planning task is new.
 */

// ================================================================ READING

const rRepair = readingText(
  "course-b1-final-b-r-repair-cafe",
  "Das Repair-Café in der Mühlenstraße",
  "Repair-Café und Nachbarschaft",
  `
Wo früher eine Bäckerei war, werden heute Toaster, Lampen und Radios repariert. Vor drei Jahren wurde in der Mühlenstraße ein Repair-Café eröffnet, das inzwischen jeden Monat mehr als hundert Besucherinnen und Besucher anzieht.

Die Idee hatte Yusuf Karaca, ein Elektriker aus dem Viertel. „Nachdem mein alter Staubsauger kaputtgegangen war, wollte ich ihn nicht einfach wegwerfen“, erzählt er. Zuerst war der Vermieter skeptisch, doch trotz einiger Bedenken überließ er den Laden schließlich für ein Jahr zum halben Preis.

Heute wird das Café von einem kleinen Verein organisiert. Wer etwas reparieren lassen möchte, muss nichts bezahlen, aber über eine Spende freut sich der Verein. Die Helferinnen und Helfer arbeiten ehrenamtlich und bringen ihr eigenes Werkzeug mit.

Besonders beliebt ist die Lampenwerkstatt. Jeden Samstagvormittag zeigt Frau Lindqvist, eine Rentnerin, Jugendlichen, wie man eine Lampe repariert. „Viele wissen gar nicht, dass man das selbst kann“, sagt sie.

Nicht alles klappt. Ersatzteile sind oft teuer, und manche Geräte können nicht mehr repariert werden. Außerdem fehlt dem Verein bis heute ein zweiter Raum.

Trotzdem ist Yusuf Karaca zufrieden: „Was funktioniert, gehört nicht in den Müll.“
`,
);

const rRad = readingText(
  "course-b1-final-b-r-rad-im-alltag",
  "Vier Texte zum Fahrrad im Alltag",
  "Fahrrad und Stadt",
  `
Text A - Stellenanzeige
Die Fahrradwerkstatt „Pedal“ sucht ab sofort eine Aushilfe für den Verkauf (samstags, acht Stunden). Sie sollten freundlich sein und sich für Fahrräder interessieren. Erfahrung ist nicht nötig, wir zeigen Ihnen alles. Bitte rufen Sie uns an oder kommen Sie vorbei: Telefon 0711 55 66 77, Kirchstraße 8.

Text B - Aushang im Hausflur
Liebe Mieterinnen und Mieter, am Samstag, dem 14. September, wird der Hof gemeinsam aufgeräumt. Wir beginnen um 10 Uhr. Wer mithelfen möchte, trägt sich bitte bis zum 10. September in die Liste neben dem Briefkasten ein. Getränke und Brötchen bringt die Hausverwaltung mit.
Die Hausverwaltung

Text C - Blogeintrag eines Vaters
Seit einem Jahr habe ich kein Auto mehr, sondern ein Lastenrad. Damit bringe ich jeden Morgen meine Tochter in den Kindergarten und fahre danach weiter ins Büro. Manchmal ist es bergauf anstrengend, aber ich stehe nie mehr im Stau.
Tarek

Text D - Forumsbeitrag einer Radfahrerin
Seit zwei Jahren fahre ich nur noch mit dem Rad zur Arbeit, auch im Winter. Am Anfang hatte ich Angst vor Regen und Kälte, aber mit der richtigen Kleidung ist das kein Problem. Ich bin schneller als mit der Bahn und spare jeden Monat über fünfzig Euro. Probiert es doch einfach mal aus!
Selin
`,
);

const TEXTE = "Lesen Sie die vier Texte A bis D. Kreuzen Sie die richtige Lösung an.";

const reading = [
  readingTfng(
    rRepair,
    "detail",
    "Lesen Sie den Magazinbericht. Kreuzen Sie an: Richtig oder Falsch.",
    [
      ["Das Repair-Café gibt es seit fünf Jahren.", "F"],
      ["Wer etwas reparieren lassen möchte, muss dafür nichts bezahlen.", "R"],
      ["Der Vermieter hat den Laden kostenlos zur Verfügung gestellt.", "F"],
      ["Samstagvormittags lernen Jugendliche, wie man eine Lampe repariert.", "R"],
      ["Dem Verein fehlt bis heute ein zweiter Raum.", "R"],
    ],
    "1 Falsch: „Vor drei Jahren wurde ... eröffnet“. 2 Richtig: „muss nichts bezahlen, aber über eine Spende freut sich der Verein“. 3 Falsch: Der Vermieter überließ den Laden „zum halben Preis“, nicht kostenlos. 4 Richtig: „Jeden Samstagvormittag zeigt Frau Lindqvist ... Jugendlichen, wie man eine Lampe repariert“. 5 Richtig: „Außerdem fehlt dem Verein bis heute ein zweiter Raum.“",
  ),
  readingChoice(
    rRad,
    "detail",
    `${TEXTE}\n\nWer sucht eine neue Mitarbeiterin oder einen neuen Mitarbeiter?`,
    ["Text B", "Text D", "Text A"],
    2,
    "Text A: Die Fahrradwerkstatt „Pedal“ sucht eine Aushilfe für den Verkauf. In Text B wird nur bei einer Aufräumaktion um Hilfe gebeten.",
  ),
  readingChoice(
    rRad,
    "detail",
    `${TEXTE}\n\nWo wird um Hilfe bei einer gemeinsamen Aufräumaktion gebeten?`,
    ["Text B", "Text A", "Text C"],
    0,
    "Text B: „Wer mithelfen möchte, trägt sich bitte ... in die Liste ... ein“ (der Hof wird gemeinsam aufgeräumt).",
  ),
  readingChoice(
    rRad,
    "attitude",
    `${TEXTE}\n\nWer rät anderen, etwas einfach auszuprobieren?`,
    ["Text C", "Text D", "Text B"],
    1,
    "Text D: „Probiert es doch einfach mal aus!“ In Text C erzählt Tarek nur von seiner eigenen Erfahrung.",
  ),
  readingChoice(
    rRad,
    "detail",
    `${TEXTE}\n\nWer bringt regelmäßig ein Kind in den Kindergarten?`,
    ["Text C", "Text D", "Text A"],
    0,
    "Text C: „Damit bringe ich jeden Morgen meine Tochter in den Kindergarten.“",
  ),
  readingChoice(
    rRad,
    "detail",
    `${TEXTE}\n\nWo kann man sich telefonisch melden?`,
    ["Text D", "Text A", "Text C"],
    1,
    "Text A: „Bitte rufen Sie uns an ...: Telefon 0711 55 66 77“. In Text B trägt man sich in eine Liste ein.",
  ),
];

// ================================================================ GRAMMAR (Sprachbausteine)

const cloze = abcCloze({
  instruction: "Lesen Sie den Forumsbeitrag. Wählen Sie für jede Lücke die richtige Lösung.",
  title: "Mein erstes Jahr im Stadtchor",
  text: `
Hallo zusammen,

vor einem Jahr [[*bin|habe|wurde#perfekt.hilfsverb]] ich in den Stadtchor eingetreten. Nachdem ich einen Zettel in der Bibliothek [[gefunden habe|gefunden wurde|*gefunden hatte#plusquamperfekt]], schrieb ich sofort eine E-Mail. Wegen [[dem|*des|der#genitiv.praeposition]] großen Interesses musste ich allerdings zwei Monate auf einen Platz warten.

Unser Chor [[hat|wird|*wurde#passiv.praeteritum]] vor dreißig Jahren von einer Musiklehrerin gegründet. Heute leitet ihn ein junger Dirigent. Zurzeit [[*wird|werden|wurden#passiv.praesens]] jeden Mittwoch zwei Stunden lang geprobt. Außerdem spricht jeder Neue in der ersten Woche mit [[dem Dirigent|den Dirigent|*dem Dirigenten#n_deklination]]. Neue Lieder [[kann|*können|könnt#passiv.modal]] nur gemeinsam ausgesucht werden.

Mein Sitznachbar heißt Karim. Trotz [[viele|*vieler|vielem#genitiv.praeposition]] Schwierigkeiten am Anfang singe ich heute sehr gern. Letzte Woche ist unser Konzert endlich im Radio [[gesendet gewesen|gesendet werden|*gesendet worden#passiv.perfekt]].

Ich kann euch nur empfehlen, [[*euch|sich|mich#reflexiv]] einmal ein Konzert von uns anzuhören!

Viele Grüße
Leyla
`.trim(),
  note: "1 Perfekt mit „sein“; 2 Plusquamperfekt nach „nachdem“; 3 Genitiv nach der Präposition „wegen“; 4 Passiv Präteritum; 5 Passiv Präsens; 6 n-Deklination, Dativ; 7 Passiv mit Modalverb; 8 Genitiv Plural nach „trotz“; 9 Passiv Perfekt; 10 Reflexivpronomen im Infinitiv mit „zu“.",
});

const sentences = [
  grammarChoice(
    "konnektor.zweiteilig",
    "Unser Dirigent spielt ___ Klavier ___ Geige, er unterrichtet also beides.",
    ["weder … noch", "entweder … oder", "sowohl … als auch", "zwar … aber"],
    2,
    "Geprüftes Grammatikphänomen: zweiteiliger Konnektor („sowohl … als auch“); „unterrichtet also beides“ schließt „entweder … oder“ und „weder … noch“ aus.",
  ),
  grammarChoice(
    "konnektor.zweiteilig",
    "Wir haben im Moment ___ Geld ___ Platz für ein Klavier, deshalb kaufen wir keins.",
    ["weder … noch", "sowohl … als auch", "nicht nur … sondern auch", "je … desto"],
    0,
    "Geprüftes Grammatikphänomen: zweiteiliger Konnektor, Negation („weder … noch“); „deshalb kaufen wir keins“ passt nur zur Verneinung.",
  ),
  grammarChoice(
    "infinitiv.zu",
    "Der Chor hat beschlossen, im Mai ein Konzert ___.",
    ["geben", "zu geben", "gegeben", "zu gegeben"],
    1,
    "Geprüftes Grammatikphänomen: Infinitiv mit „zu“ („beschließen“ + zu-Infinitiv).",
  ),
  grammarChoice(
    "infinitiv.zu",
    "Ich habe leider vergessen, die Noten ___.",
    ["mitbringen", "mitgebracht", "mitzubringen", "zu mitbringen"],
    2,
    "Geprüftes Grammatikphänomen: Infinitiv mit „zu“ bei einem trennbaren Verb („mitzubringen“, „zu“ steht zwischen Präfix und Verb).",
  ),
  grammarChoice(
    "partizipattribut",
    "Die im Herbst ___ Lieder singen wir beim Weihnachtskonzert.",
    ["geprobt", "proben", "probenden", "geprobten"],
    3,
    "Geprüftes Grammatikphänomen: Partizip II als Adjektiv vor dem Nomen („die geprobten Lieder“, die Lieder wurden geprobt).",
  ),
  grammarChoice(
    "partizipattribut",
    "Die ___ Besucher bekamen am Eingang einen Tee.",
    ["gewartet", "wartenden", "warten", "gewarteten"],
    1,
    "Geprüftes Grammatikphänomen: Partizip I als Adjektiv vor dem Nomen („die wartenden Besucher“, die Besucher warten).",
  ),
  grammarChoice(
    "reflexiv",
    "Vor dem Konzert putze ich ___ immer die Zähne.",
    ["mir", "mich", "uns", "mein"],
    0,
    "Geprüftes Grammatikphänomen: Reflexivpronomen im Dativ (mit Akkusativobjekt „die Zähne“).",
  ),
  grammarChoice(
    "reflexiv",
    "Die Sänger stellen ___ vor dem Auftritt in zwei Reihen auf.",
    ["ihnen", "euch", "uns", "sich"],
    3,
    "Geprüftes Grammatikphänomen: Reflexivpronomen im Akkusativ (3. Person Plural: „sich“).",
  ),
  grammarChoice(
    "relativsatz",
    "Die Sängerin, ___ ich die Noten geliehen habe, ist heute krank.",
    ["die", "der", "dem", "deren"],
    1,
    "Geprüftes Grammatikphänomen: Relativpronomen im Dativ, feminin („jemandem etwas leihen“).",
  ),
  grammarChoice(
    "relativsatz.praeposition",
    "Das ist der Dirigent, von ___ ich so viel gelernt habe.",
    ["denen", "den", "dem", "dessen"],
    2,
    "Geprüftes Grammatikphänomen: Relativpronomen im Dativ nach Präposition („von dem Dirigenten“).",
  ),
  grammarChoice(
    "praepositionaladverb",
    "___ interessierst du dich am meisten? – Für alte Musik.",
    ["Wofür", "Dafür", "Worauf", "Darauf"],
    0,
    "Geprüftes Grammatikphänomen: Pronominaladverb in der Frage („sich interessieren für“ + Akkusativ: „Wofür?“).",
  ),
  grammarChoice(
    "praepositionaladverb",
    "Die neuen Noten sind noch nicht da, und wir warten schon seit Wochen ___.",
    ["darüber", "davon", "daran", "darauf"],
    3,
    "Geprüftes Grammatikphänomen: Pronominaladverb („warten auf“ + Akkusativ: „darauf“).",
  ),
  grammarChoice(
    "passiv.praeteritum",
    "Nachdem der Chor einen Probenraum gefunden hatte, ___ sofort mit den Proben begonnen.",
    ["wurde", "war", "hatte", "ist"],
    0,
    "Geprüftes Grammatikphänomen: Passiv Präteritum nach „nachdem“ + Plusquamperfekt (unpersönliches Passiv: „wurde ... begonnen“, ohne Subjekt).",
  ),
  grammarChoice(
    "genitiv.praeposition",
    "Trotz ___ hohen Preises waren alle Karten sofort verkauft.",
    ["dem", "der", "des", "den"],
    2,
    "Geprüftes Grammatikphänomen: Genitiv nach der Präposition „trotz“ (maskulin: „des Preises“).",
  ),
  grammarChoice(
    "n_deklination",
    "Nach dem Konzert habe ich lange mit ___ aus dem Chor gesprochen.",
    ["dem Student", "dem Studenten", "der Student", "den Student"],
    1,
    "Geprüftes Grammatikphänomen: n-Deklination, Dativ („dem Studenten“).",
  ),
];

// ================================================================ LISTENING (new)

const lFlughafen = listeningClip(
  "course-b1-final-b-l-boarding",
  "Durchsage am Flughafen",
  "Reisen und Flughafen",
  [{ label: "Durchsage", voice: "D" }],
  [
    "Durchsage: Guten Tag, meine Damen und Herren. Eine Information für die Passagiere des Fluges nach Lissabon, planmäßiger Abflug um zwölf Uhr dreißig. Der Flug geht heute nicht von Gate B sieben ab, sondern von Gate B zwölf. Ich wiederhole: von Gate B zwölf. Das Boarding beginnt um zwölf Uhr. Die Gepäckabgabe schließt schon um elf Uhr dreißig, bitte beeilen Sie sich. Halten Sie Ihre Bordkarte und Ihren Ausweis bereit. Passagiere nach Madrid warten bitte weiter an Gate A drei. Vielen Dank.",
  ],
);

const lReparatur = listeningClip(
  "course-b1-final-b-l-laptop",
  "Nachricht vom Reparaturservice",
  "Technik und Reklamation",
  [{ label: "Herr Hoffmann", voice: "B" }],
  [
    "Herr Hoffmann: Guten Tag, Herr Lindner, hier ist Hoffmann von der Firma Technik Hoffmann. Ihr Laptop ist fertig. Eigentlich sollte die Reparatur sechzig Euro kosten, aber wir mussten auch den Akku tauschen. Deshalb kostet sie jetzt neunzig Euro. Hundertzwanzig Euro wären es gewesen, wenn wir auch den Bildschirm hätten ersetzen müssen, aber das war zum Glück nicht nötig. Sie können den Laptop ab morgen abholen, montags bis freitags von zehn bis achtzehn Uhr, samstags nur bis dreizehn Uhr. Bitte bringen Sie die Quittung mit, die Sie bei der Abgabe bekommen haben. Auf Wiederhören.",
  ],
);

const lServicetelefon = listeningClip(
  "course-b1-final-b-l-servicetelefon",
  "Telefonansage der Arbeitsagentur",
  "Arbeit und Behörde",
  [{ label: "Ansage", voice: "A" }],
  [
    "Ansage: Willkommen bei der Agentur für Arbeit, Servicetelefon für die Region Süd. Wenn Sie sich arbeitslos melden möchten, drücken Sie die Eins. Wenn Sie einen Termin ändern möchten, drücken Sie die Zwei. Für Fragen zu Ihrem Geld drücken Sie die Drei. Für alle anderen Anliegen bleiben Sie bitte in der Leitung. Unser Telefon ist montags bis donnerstags von acht bis sechzehn Uhr besetzt, freitags nur von acht bis zwölf Uhr. Das Büro vor Ort ist freitags bis vierzehn Uhr geöffnet.",
  ],
);

const lKonzert = listeningClip(
  "course-b1-final-b-l-wochenendtipp",
  "Wochenendtipp im Radio",
  "Musik und Freizeit",
  [{ label: "Sprecher", voice: "C" }],
  [
    "Sprecher: Und zum Schluss unser Wochenendtipp. Am Sonntag spielt um sechzehn Uhr die Schulband im Stadtpark, der Eintritt ist frei. Bitte beachten Sie: Bei Regen findet das Konzert nicht im Park statt, sondern in der Stadthalle. Dort kostet der Eintritt drei Euro. Schon ab vierzehn Uhr gibt es auf dem Rathausplatz einen Flohmarkt mit Kinderkleidung und Spielzeug. Wer einen Kuchen für den Flohmarkt backen möchte, kann sich im Rathaus melden. Das Wetter am Sonntag? Laut Vorhersage bleibt es trocken, aber ein bisschen kühl.",
  ],
);

const lTueten = listeningClip(
  "course-b1-final-b-l-tragetaschen",
  "Durchsage im Supermarkt",
  "Einkaufen und Umwelt",
  [{ label: "Durchsage", voice: "D" }],
  [
    "Durchsage: Liebe Kundinnen und Kunden, ab dem ersten Oktober gibt es bei uns keine Plastiktüten mehr. Eine stabile Stofftasche kostet einen Euro fünfzig, eine Papiertüte kostet zwanzig Cent. Wer seine eigene Tasche oder seinen eigenen Korb mitbringt, bekommt an der Kasse zehn Cent zurück. Das gilt für jeden Einkauf, auch für kleine. Die Aktion läuft zunächst bis Ende des Jahres. Leere Mehrwegflaschen nehmen wir weiterhin am Eingang zurück. Bei Fragen helfen Ihnen unsere Mitarbeiterinnen und Mitarbeiter gern weiter.",
  ],
);

const lBank = listeningClip(
  "course-b1-final-b-l-kontoeroeffnung",
  "Gespräch in der Bank",
  "Geld und Bank",
  [
    { label: "Frau Weber", voice: "A" },
    { label: "Herr Tran", voice: "B" },
  ],
  [
    "Frau Weber: Guten Morgen, Herr Tran. Was kann ich für Sie tun?",
    "Herr Tran: Guten Morgen. Ich bin vor drei Wochen nach Köln gezogen und möchte gern bei Ihnen ein Konto eröffnen.",
    "Frau Weber: Sehr gern. Haben Sie Ihren Ausweis und die Anmeldung für Ihre neue Wohnung dabei?",
    "Herr Tran: Den Ausweis ja, aber die Anmeldung habe ich leider zu Hause vergessen. Geht es auch ohne?",
    "Frau Weber: Kein Problem, die können Sie später per E-Mail schicken. Und noch etwas: Das Konto kostet fünf Euro im Monat. Für Studenten und Auszubildende ist es kostenlos.",
    "Herr Tran: Ich arbeite seit Januar in einer Softwarefirma, also gilt das leider nicht für mich. Aber fünf Euro sind in Ordnung. Bekomme ich dafür auch eine Karte?",
    "Frau Weber: Natürlich, Sie bekommen eine Girocard. Sie kommt in etwa zehn Tagen mit der Post. Die Geheimzahl schicken wir aus Sicherheitsgründen extra, also einen Tag später.",
    "Herr Tran: Alles klar. Und kann ich mein Konto auch online benutzen?",
    "Frau Weber: Ja, mit unserer App geht das ganz einfach, Überweisungen und Kontostand sind jederzeit möglich.",
    "Herr Tran: Ist das denn sicher? Man hört ja immer wieder von falschen E-Mails.",
    "Frau Weber: Da haben Sie recht, man muss aufpassen. Wir schreiben Ihnen nie per E-Mail, dass Sie Ihre Geheimzahl eingeben sollen. Wenn Sie so eine Nachricht bekommen, rufen Sie uns bitte sofort an.",
    "Herr Tran: Gut zu wissen, danke.",
    "Frau Weber: Zahlen Sie jeden Monat Miete?",
    "Herr Tran: Ja, sechshundertzwanzig Euro.",
    "Frau Weber: Dann würde ich Ihnen einen Dauerauftrag empfehlen. So müssen Sie nicht jeden Monat daran denken, und die Miete kommt immer pünktlich an.",
    "Herr Tran: Gute Idee, das machen wir so. Kann das Geld am Ersten des Monats abgebucht werden?",
    "Frau Weber: Selbstverständlich, das stellen wir gleich ein. Dann brauche ich nur noch Ihre Unterschrift hier. Vielen Dank, Herr Tran, und herzlich willkommen bei uns!",
  ],
);

const listening = [
  listeningChoice(
    lFlughafen,
    "detail",
    "Wann beginnt das Boarding für den Flug nach Lissabon?",
    ["um 11.30 Uhr", "um 12.00 Uhr", "um 12.30 Uhr"],
    1,
    "Um 12.00 Uhr: „Das Boarding beginnt um zwölf Uhr.“ 11.30 Uhr ist der Schluss der Gepäckabgabe, 12.30 Uhr der planmäßige Abflug.",
  ),
  listeningChoice(
    lReparatur,
    "detail",
    "Wie viel muss Herr Lindner für die Reparatur bezahlen?",
    ["60 Euro", "120 Euro", "90 Euro"],
    2,
    "90 Euro: „Deshalb kostet sie jetzt neunzig Euro.“ 60 Euro war der erste Preis, 120 Euro wären es mit neuem Bildschirm gewesen.",
  ),
  listeningChoice(
    lServicetelefon,
    "detail",
    "Bis wann ist das Servicetelefon freitags besetzt?",
    ["bis 12 Uhr", "bis 14 Uhr", "bis 16 Uhr"],
    0,
    "Bis 12 Uhr: „freitags nur von acht bis zwölf Uhr“. 16 Uhr gilt montags bis donnerstags, 14 Uhr für das Büro vor Ort.",
  ),
  listeningChoice(
    lKonzert,
    "detail",
    "Wo findet das Konzert statt, wenn es regnet?",
    ["im Stadtpark", "auf dem Rathausplatz", "in der Stadthalle"],
    2,
    "In der Stadthalle: „Bei Regen findet das Konzert nicht im Park statt, sondern in der Stadthalle.“ Auf dem Rathausplatz ist der Flohmarkt.",
  ),
  listeningChoice(
    lTueten,
    "detail",
    "Was gilt für Kundinnen und Kunden, die ihre eigene Tasche mitbringen?",
    ["Sie bekommen an der Kasse zehn Cent zurück.", "Sie kaufen eine Stofftasche für 1,50 Euro.", "Sie müssen eine Papiertüte für 20 Cent kaufen."],
    0,
    "Wer eine eigene Tasche mitbringt, bekommt zehn Cent zurück. Stofftasche und Papiertüte kaufen die anderen Kundinnen und Kunden.",
  ),
  listeningTfng(
    lBank,
    "detail",
    "Hören Sie das Gespräch. Sind die Aussagen richtig oder falsch? Kreuzen Sie an.",
    [
      ["Herr Tran ist vor einem Jahr nach Köln gezogen.", "F"],
      ["Herr Tran hat seinen Ausweis dabei.", "R"],
      ["Für Herrn Tran kostet das Konto fünf Euro im Monat.", "R"],
      ["Die Geheimzahl kommt zusammen mit der Karte.", "F"],
      ["Frau Weber empfiehlt einen Dauerauftrag für die Miete.", "R"],
    ],
    "1 Falsch: „vor drei Wochen“. 2 Richtig: „Den Ausweis ja“. 3 Richtig: Nur Studenten und Auszubildende zahlen nichts, Herr Tran arbeitet schon. 4 Falsch: Die Geheimzahl kommt „extra, also einen Tag später“. 5 Richtig: „Dann würde ich Ihnen einen Dauerauftrag empfehlen.“",
  ),
];

// ================================================================ WRITING

const writing = [
  formalEmail({
    situation: "Sie haben im Programm der Volkshochschule einen Fotokurs für Anfänger gefunden und möchten daran teilnehmen. Schreiben Sie eine E-Mail an den Kursleiter, Herrn Roth.",
    points: [
      "Nennen Sie Ihr Interesse am Kurs und begründen Sie, warum Sie Fotografieren lernen möchten.",
      "Beschreiben Sie, welche Vorkenntnisse Sie haben und an welchen Tagen Sie Zeit haben.",
      "Fragen Sie nach, wie viel der Kurs kostet und ob Sie eine eigene Kamera mitbringen müssen.",
    ],
    contentPoints: [
      "Leitpunkt 1: das Interesse am Fotokurs nennen UND begründen, warum man Fotografieren lernen möchte (ein bloßes „Ich möchte teilnehmen“ ohne Begründung erfüllt den Punkt nicht)",
      "Leitpunkt 2: Vorkenntnisse beschreiben (auch „keine Vorkenntnisse“ mit einem weiteren Satz) UND konkret nennen, an welchen Tagen man Zeit hat („ich habe Zeit“ genügt nicht)",
      "Leitpunkt 3: nach den Kosten fragen UND fragen, ob man eine eigene Kamera mitbringen muss (nur eine der beiden Fragen: Punkt nur teilweise erfüllt)",
    ],
    studentPoints: ["Interesse nennen und begründen", "Vorkenntnisse und freie Tage", "Fragen zu Kosten und Kamera"],
    explanation:
      "Formelle E-Mail an einen Kursleiter, parallel zu Version A (Interesse und Grund, Voraussetzungen und Zeit, zwei Nachfragen). Bewertung: Inhalt, Wortschatz und Grammatik je 0 bis 3 Punkte. Inhalt 0 Punkte bedeutet: Teil 3 nicht bestanden.",
  }),
];

// ================================================================ SPEAKING

const speaking = [
  speakingTask(
    "introduction",
    "Erzählen Sie uns bitte etwas über sich.\n\nSprechen Sie über diese Punkte:\n- Ihr Name\n- Die Stadt oder Region, in der Sie wohnen\n- Was Sie beruflich machen oder lernen\n- Was Sie in Ihrer Freizeit gern tun\n- Welche Sprachen Sie sprechen",
    [
      "nennt den Namen und die Stadt oder Region, in der man wohnt",
      "sagt, was man beruflich macht oder lernt",
      "erzählt von der Freizeit mit mindestens einem Detail",
      "nennt die Sprachen, die man spricht",
    ],
    "Selbstvorstellung, ca. eine Minute. Bewertung: Kommunikation, Wortschatz, Grammatik, Aussprache, Kohärenz je 0 bis 4 Punkte.",
  ),
  speakingTask(
    "presentation",
    "Halten Sie bitte eine kurze Präsentation.\n\nThema: „Wohnen: Eigene Wohnung oder WG?“\nSprechen Sie ungefähr zwei Minuten zu allen vier Punkten:\n- Was verstehen Sie unter „eigene Wohnung“ und „Wohngemeinschaft (WG)“?\n- Welche Vorteile hat eine eigene Wohnung, zum Beispiel Ruhe oder Unabhängigkeit?\n- Welche Vorteile hat eine WG, zum Beispiel Kosten oder Gesellschaft?\n- Was ist Ihre persönliche Meinung: Was würden Sie bevorzugen, und warum?",
    [
      "erklärt „eigene Wohnung“ und „Wohngemeinschaft (WG)“",
      "nennt Vorteile einer eigenen Wohnung (z. B. Ruhe, Unabhängigkeit)",
      "nennt Vorteile einer WG (z. B. Kosten, Gesellschaft)",
      "sagt die eigene Meinung und begründet sie (Konjunktiv II: „Ich würde ... bevorzugen“)",
    ],
    "Präsentation mit vier Leitpunkten (Karte 2B der mündlichen Prüfung, Halil Bey), ca. zwei Minuten. Bewertung: Kommunikation, Wortschatz, Grammatik, Aussprache, Kohärenz je 0 bis 4 Punkte.",
  ),
  speakingTask(
    "planning",
    "Machen Sie bitte Vorschläge für einen Ausflug.\n\nSie und Ihre Kolleginnen und Kollegen möchten am Wochenende gemeinsam einen Ausflug machen. Machen Sie Vorschläge und sagen Sie, warum Sie das gut finden:\n- Wohin soll der Ausflug gehen, und wann fahren Sie los?\n- Wie kommen Sie dorthin, und was kostet das?\n- Was soll es zu essen und zu trinken geben, und wer bringt etwas mit?\n- Wer organisiert was, und wer muss noch informiert werden?\nSagen Sie am Schluss, welcher Punkt Ihnen am wichtigsten ist.",
    [
      "macht Vorschläge zu mindestens drei der vier Punkte (Ziel und Zeit, Anreise und Kosten, Essen und Trinken, Organisation)",
      "begründet die Vorschläge (weil, denn, deshalb)",
      "benutzt Formen für Vorschläge (Wir könnten ..., Ich schlage vor, ..., Wie wäre es, wenn ...)",
      "sagt am Schluss, welcher Punkt am wichtigsten ist, und warum",
    ],
    "Gemeinsam planen als Monolog, parallel zu Version A (Abschiedsfest): Vorschläge machen und eine Meinung äußern. Bewertung: Kommunikation, Wortschatz, Grammatik, Aussprache, Kohärenz je 0 bis 4 Punkte.",
  ),
];

export const B1_FINAL_B: SeedCourseForm = {
  key: "B1",
  form: "B",
  syllabus: {
    source:
      "Inhaltsverzeichnisse Netzwerk neu B1.1 (Kapitel 1-6) und B1.2 (Kapitel 7-12), Klett 2021, bei der Deutschen Nationalbibliothek: https://d-nb.info/1226980031/04 und https://d-nb.info/1228099243/04. Produktseite: https://www.klett-sprachen.de/netzwerk-neu-b1/t-0/9783126071741",
    chapters: "Netzwerk neu B1, Kapitel 1-12",
    topics: [
      "Infinitiv mit zu",
      "Nebensätze mit nachdem, weil, da, obwohl",
      "Genitiv, wegen und trotz",
      "Präteritum und Plusquamperfekt",
      "Passiv (Präsens, Präteritum, Perfekt, mit Modalverb)",
      "n-Deklination und Relativsätze",
      "Reflexivpronomen und Pronominaladverbien",
      "zweiteilige Konnektoren",
      "Partizip I und II als Adjektiv",
      "Technik, Umwelt, Arbeit und Geld",
    ],
  },
  sections: [
    { section: "READING", stimuli: [rRepair, rRad], items: reading },
    { section: "GRAMMAR", stimuli: [], items: [cloze, ...sentences] },
    { section: "LISTENING", stimuli: [lFlughafen, lReparatur, lServicetelefon, lKonzert, lTueten, lBank], items: listening },
    { section: "WRITING", stimuli: [], items: writing },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
