import { authorFor, noParts, type LevelParts } from "../author";
import { cloze } from "../cloze";
import { wordBank } from "../wordbank";

/**
 * Round 3 additions to the B1 bank (formats from the model tests: see docs/research/formats-2026-10-25.md).
 * Built with the shared helpers in ../author.ts; the instruction lines come from ../instructions.ts.
 *
 * Listening: three "Wer sagt was" discussions and three short announcements.
 * Reading: two headline-matching sets and three comment threads answered with Ja / Nein.
 * Writing: a reply to a friend's e-mail and an enquiry that answers an advert.
 * Grammar: a formal letter cloze and an "advert and reply" Sprachbausteine text.
 */
const a = authorFor("B1");

// ================================================================ LISTENING

// ---- Who says what 1: the phone at the dinner table (moderator C, guests A, B, D)

const lHandy = a.clip(
  "handy-tisch",
  "Radiogespräch: Das Handy am Esstisch",
  "Familie und Medien",
  [
    { label: "Moderator", voice: "C" },
    { label: "Hannah", voice: "A" },
    { label: "Dirk", voice: "B" },
    { label: "Mira", voice: "D" },
  ],
  [
    "Moderator: Guten Abend bei „Mittendrin“! Heute fragen wir: Darf das Handy mit an den Esstisch? Zu Gast sind Hannah, Dirk und Mira.",
    "Hannah: Bei uns ganz klar nein. Neben der Haustür steht ein Korb, da kommen alle Handys rein, auch meins. Beim Essen reden wir nämlich wirklich miteinander.",
    "Dirk: Na ja, ich sehe das lockerer. Bei uns liegt es manchmal auf dem Tisch. Wenn wir über einen Film streiten, schauen wir schnell nach, wer da mitspielt. Und Verbote bringen bei Jugendlichen sowieso nichts, die machen es dann heimlich unter dem Tisch.",
    "Moderator: Mira, Sie leben in einer Wohngemeinschaft. Wie machen Sie das?",
    "Mira: Wir haben einen Kompromiss. Das Handy liegt mit dem Display nach unten auf dem Tisch. Wer es trotzdem nimmt, muss am nächsten Tag abwaschen. Und wenn jemand auf einen wichtigen Anruf wartet, sagt er das vorher, dann ist es in Ordnung.",
    "Hannah: Aber dann denkt man doch die ganze Zeit an das Ding!",
    "Mira: Manchmal schon. Aber bei uns klappt es.",
    "Dirk: Mir ist nur eins wichtig: Keiner soll allein im Internet verschwinden. Zusammen etwas nachschauen ist okay, allein scrollen nicht.",
    "Moderator: Danke Ihnen dreien. Gleich geht es weiter.",
  ],
);
const handy = a.forClip(lHandy);

// ---- Who says what 2: car or bike in the city (moderator B, guests A, C, D)

const lRad = a.clip(
  "auto-oder-rad",
  "Radiogespräch: Auto oder Fahrrad in der Stadt",
  "Verkehr und Stadt",
  [
    { label: "Moderator", voice: "B" },
    { label: "Katja", voice: "A" },
    { label: "Ömer", voice: "C" },
    { label: "Birgit", voice: "D" },
  ],
  [
    "Moderator: Willkommen zu „Stadtgespräch“! Heute geht es um die Frage: Brauchen wir in der Innenstadt weniger Parkplätze und dafür mehr Radwege? Bei mir sind Katja, Ömer und Birgit.",
    "Katja: Ich sage ja, auf jeden Fall. Mein Auto habe ich vor zwei Jahren verkauft und vermisse es kein bisschen. Ich spare im Monat hundertachtzig Euro. Nein, warten Sie, mit der Versicherung sind es sogar zweihundert.",
    "Ömer: Das glaube ich Ihnen. Aber ich wohne am Stadtrand, und abends fährt der Bus nur alle vierzig Minuten. Mit drei Kindern geht es ohne Auto nicht. Große Parkplätze am Stadtrand mit guter Busverbindung, das wäre für mich ideal.",
    "Moderator: Birgit, Sie haben einen Mittelweg gefunden?",
    "Birgit: Ich glaube schon. Ich habe kein eigenes Auto, aber ich bin beim Carsharing angemeldet. Wenn ich etwas Großes transportieren muss, leihe ich mir für ein paar Stunden eins. Sonst fahre ich Rad oder nehme die Straßenbahn.",
    "Katja: Genau, so geht es auch! Dafür braucht man aber sichere Radwege.",
    "Ömer: Da stimme ich zu. Nur dürfen die Radwege nicht auf Kosten der Familien gehen.",
    "Moderator: Vielen Dank, wir machen gleich weiter.",
  ],
);
const rad = a.forClip(lRad);

// ---- Who says what 3: eating less meat (moderator C, guests A, B, D)

const lFleisch = a.clip(
  "weniger-fleisch",
  "Radiogespräch: Weniger Fleisch essen",
  "Essen und Ernährung",
  [
    { label: "Moderator", voice: "C" },
    { label: "Franziska", voice: "A" },
    { label: "Gerd", voice: "B" },
    { label: "Ruth", voice: "D" },
  ],
  [
    "Moderator: Guten Tag bei „Mittagstisch“! Heute sprechen wir darüber, ob wir alle weniger Fleisch essen sollten. Zu Gast sind Franziska, Gerd und Ruth.",
    "Franziska: Ich esse seit drei Jahren gar kein Fleisch mehr und vermisse nichts. Im Gegenteil, ich koche heute viel abwechslungsreicher. Ich wünsche mir in der Schulkantine einen vegetarischen Tag pro Woche, damit schon Kinder es ausprobieren.",
    "Gerd: Also, ich lasse mir nicht vorschreiben, was auf meinen Teller kommt. Sonntags gibt es bei uns Braten, das ist Tradition. Aber unter der Woche esse ich tatsächlich seltener Fleisch, weil es einfach viel teurer geworden ist.",
    "Moderator: Ruth, Sie sind wahrscheinlich irgendwo dazwischen, oder?",
    "Ruth: Ja, so kann man das sagen. Ich esse Fleisch nur noch am Wochenende, und dann kaufe ich es beim Metzger im Nachbardorf. Das kostet mehr, aber dort weiß ich, woher es kommt. Lieber weniger und dafür besser, das ist mein Motto.",
    "Gerd: Das kann ich nachvollziehen. Aber bitte ohne Zwang.",
    "Franziska: Es geht doch nicht um Zwang, Gerd, nur um ein Angebot.",
    "Moderator: Das ist ein schönes Schlusswort. Danke Ihnen allen!",
  ],
);
const fleisch = a.forClip(lFleisch);

// ---- Short announcement 1: museum

const lMuseum = a.clip(
  "durchsage-museum",
  "Durchsage: Führung zur Fotoausstellung",
  "Museum und Kultur",
  [{ label: "Durchsage", voice: "A" }],
  [
    "Durchsage: Liebe Besucherinnen und Besucher, wir haben ein paar Hinweise. Die Führung zur Fotoausstellung beginnt heute nicht um vierzehn Uhr, sondern erst um fünfzehn Uhr. Treffpunkt ist im Raum drei. Nein, Entschuldigung, im Raum acht. Die Führung kostet zwei Euro fünfzig. Ich wiederhole: zwei Euro fünfzig, Kinder zahlen nichts. Und noch etwas: Das Museumscafé schließt heute schon um siebzehn Uhr.",
  ],
);
const museum = a.forClip(lMuseum);

// ---- Short announcement 2: answerphone message from a doctor's office

const lPraxis = a.clip(
  "praxis-nachricht",
  "Nachricht aus der Arztpraxis",
  "Gesundheit",
  [{ label: "Frau Köhler", voice: "D" }],
  [
    "Frau Köhler: Guten Tag, hier ist die Praxis von Doktor Marek. Es geht um Ihren Termin am Dienstag. Wir müssen ihn leider verschieben, der Doktor ist krank. Der neue Termin ist am Donnerstag um zehn Uhr dreißig. Nein, Entschuldigung, um zehn Uhr fünfzehn. Bitte kommen Sie nüchtern, also ohne Frühstück, wir nehmen Blut ab. Wenn der Termin nicht passt, rufen Sie uns an: null, sieben, eins, vier, sieben, neun, zwei, eins, drei. Ich wiederhole: null, sieben, eins, vier, sieben, neun, zwei, eins, drei.",
  ],
);
const praxis = a.forClip(lPraxis);

// ---- Short announcement 3: weather and traffic on the radio

const lWetter = a.clip(
  "wetter-verkehr",
  "Wetter und Verkehr im Radio",
  "Wetter und Verkehr",
  [{ label: "Sprecherin", voice: "A" }],
  [
    "Sprecherin: Und nun das Wetter und der Verkehr. Heute Nachmittag wird es regnerisch und stürmisch, bei zwölf Grad. Nein, Entschuldigung, bei zehn Grad. Am Abend sind sogar Gewitter möglich. Morgen wird es wieder trockener, mit bis zu fünfzehn Grad. Zum Verkehr: Auf der A sieben zwischen den Abfahrten Süd und Mitte staut es sich auf fünf Kilometern. Rechnen Sie dort mit mindestens zwanzig Minuten mehr Fahrzeit. Die Fähre über den See fährt wegen des Sturms heute nicht.",
  ],
);
const wetter = a.forClip(lWetter);

const listeningItems = [
  // ---- Who says what 1
  handy.match(
    "detail",
    "MID",
    "Hören Sie das Gespräch. Wer sagt was? Ordnen Sie jeder Aussage eine Person zu. Eine Aussage passt zu keiner der drei Personen.",
    [
      "Diese Person glaubt, dass Verbote bei Jugendlichen nichts bewirken.",
      "Diese Person wünscht sich ein Handyverbot in Restaurants.",
      "Diese Person sammelt alle Handys der Familie in einem Korb.",
      "Diese Person schaut beim Essen mit anderen gemeinsam etwas im Internet nach.",
    ],
    ["Hannah", "Dirk", "Mira", "Keine der drei Personen"],
    [2, 4, 1, 2],
    "Dirk hält Verbote bei Jugendlichen für nutzlos (Aussage 1) und schaut mit der Familie schnell nach, wer im Film mitspielt (4). Ein Verbot in Restaurants (2) fordert niemand. Hannah sammelt die Handys in einem Korb an der Tür (3). Eine Person kann zu mehreren Aussagen passen (Dirk zweimal), Mira passt zu keiner Aussage.",
  ),
  handy.choice(
    "detail",
    "EASY",
    "Wann darf man bei Mira das Handy am Tisch nehmen, ohne abwaschen zu müssen?",
    "wenn man einen wichtigen Anruf erwartet und es vorher sagt",
    [
      "wenn man damit gemeinsam etwas über einen Film nachschaut",
      "wenn das Handy mit dem Display nach oben auf dem Tisch liegt",
      "wenn man schon gegessen hat und nur noch Kaffee trinkt",
    ],
    2,
    "Mira: Wer auf einen wichtigen Anruf wartet, sagt das vorher, „dann ist es in Ordnung“. Das gemeinsame Nachschauen zu einem Film beschreibt Dirk. Bei Mira liegt das Handy mit dem Display nach unten, nicht nach oben. Vom Kaffee nach dem Essen ist keine Rede.",
  ),

  // ---- Who says what 2
  rad.match(
    "detail",
    "MID",
    "Hören Sie das Gespräch. Wer sagt was? Ordnen Sie jeder Aussage eine Person zu. Eine Aussage passt zu keiner der drei Personen.",
    [
      "Diese Person wünscht sich große Parkplätze außerhalb des Zentrums mit Busanschluss.",
      "Diese Person fährt auch bei Regen und Schnee mit dem Rad.",
      "Diese Person hat das eigene Auto abgegeben und spart dadurch Geld.",
      "Diese Person leiht sich nur bei Bedarf für einige Stunden ein Auto.",
    ],
    ["Katja", "Ömer", "Birgit", "Keine der drei Personen"],
    [2, 4, 1, 3],
    "Ömer möchte Parkplätze am Stadtrand mit Busverbindung (Aussage 1). Katja hat ihr Auto verkauft und spart Geld (3). Birgit besitzt kein Auto, mietet aber über Carsharing für ein paar Stunden eines (4). Dass jemand auch bei Regen und Schnee Rad fährt (2), sagt niemand.",
  ),
  rad.choice(
    "detail",
    "MID",
    "Wie viel Geld spart Katja im Monat, seit sie kein Auto mehr hat?",
    "zweihundert Euro",
    ["achtzig Euro", "hundertachtzig Euro", "zweihundertvierzig Euro"],
    1,
    "Katja nennt zuerst hundertachtzig Euro und verbessert sich: Mit der Versicherung sind es „sogar zweihundert“. Hundertachtzig ist der Wert vor der Korrektur; achtzig und zweihundertvierzig werden nicht genannt.",
  ),

  // ---- Who says what 3
  fleisch.match(
    "detail",
    "HARD",
    "Hören Sie das Gespräch. Wer sagt was? Ordnen Sie jeder Aussage eine Person zu. Zwei Aussagen passen zu keiner der drei Personen.",
    [
      "Diese Person baut das eigene Gemüse im Garten an.",
      "Diese Person kauft Fleisch nur am Wochenende bei einem Metzger.",
      "Diese Person kauft regelmäßig Fleischersatz im Supermarkt.",
      "Diese Person wünscht sich einmal pro Woche ein fleischloses Essen in der Schule.",
    ],
    ["Franziska", "Gerd", "Ruth", "Keine der drei Personen"],
    [4, 3, 4, 1],
    "Ruth isst Fleisch nur noch am Wochenende und kauft es beim Metzger im Nachbardorf (Aussage 2). Franziska fordert einen vegetarischen Tag in der Schulkantine (4). Von einem Gemüsegarten (1) und von Fleischersatz (3) spricht niemand. Gerd passt zu keiner dieser Aussagen.",
  ),
  fleisch.choice(
    "detail",
    "MID",
    "Warum isst Gerd unter der Woche seltener Fleisch?",
    "Weil Fleisch inzwischen sehr viel mehr kostet als früher.",
    [
      "Weil er Fleisch nur noch beim Metzger im Dorf kaufen möchte.",
      "Weil er für den Braten am Sonntag Geld sparen muss.",
      "Weil seine Kinder in der Schule jetzt vegetarisch essen.",
    ],
    3,
    "Gerd: „weil es einfach viel teurer geworden ist“. Der Metzger im Nachbardorf ist Ruths Lösung. Den Sonntagsbraten behält er als Tradition; er spart nicht dafür. Die Schulkantine erwähnt nur Franziska.",
  ),

  // ---- Short announcement 1: museum
  museum.choice(
    "detail",
    "EASY",
    "Wo treffen sich die Teilnehmer der Führung?",
    "im Raum acht",
    ["im Raum drei", "im Raum fünfzehn", "im Museumscafé"],
    0,
    "Die Sprecherin nennt zuerst den Raum drei und verbessert sich: „im Raum acht“. Fünfzehn ist die neue Uhrzeit, nicht ein Raum. Das Café schließt nur früher; ein Treffpunkt ist es nicht.",
  ),
  museum.tfng(
    "detail",
    "MID",
    [
      ["Die Führung beginnt eine Stunde später als geplant.", "R"],
      ["Auch Kinder müssen für die Führung bezahlen.", "F"],
      ["Das Museumscafé hat heute nur bis siebzehn Uhr geöffnet.", "R"],
    ],
    "Statt vierzehn Uhr gilt fünfzehn Uhr (R). Kinder „zahlen nichts“, der Preis von zwei Euro fünfzig gilt für die anderen (F). Das Café schließt „schon um siebzehn Uhr“ (R).",
  ),

  // ---- Short announcement 2: doctor's office
  praxis.notes(
    "notes",
    "MID",
    "Hören Sie die Nachricht. Ergänzen Sie die Notizen.\n\nNeuer Termin: {{g1}}, {{g2}} Uhr\nBitte beachten: {{g3}} kommen\nTelefonnummer der Praxis: {{g4}}",
    [
      ["Donnerstag", "am Donnerstag"],
      ["10.15", "10:15", "10 Uhr 15", "zehn Uhr fünfzehn", "viertel nach zehn", "Viertel nach 10", "10 Uhr fünfzehn"],
      ["nüchtern", "ohne Frühstück", "nüchtern kommen"],
      ["07147 921 3", "071479213", "07147/9213", "07147 9213"],
    ],
    "g1: Der Termin wird vom Dienstag auf den Donnerstag verschoben. g2: Frau Köhler nennt zuerst zehn Uhr dreißig und korrigiert sich: \"Nein, Entschuldigung, um zehn Uhr fünfzehn.\" g3: \"Bitte kommen Sie nüchtern, also ohne Frühstück.\" g4: Die Nummer wird zweimal ziffernweise genannt; bei der Nummer zählen nur die Ziffern.",
  ),
  praxis.tfng(
    "detail",
    "MID",
    [
      ["Vor dem Termin darf man ganz normal frühstücken.", "F"],
      ["Wer den neuen Termin nicht wahrnehmen kann, soll in der Praxis anrufen.", "R"],
    ],
    "Man soll „nüchtern“ kommen, „ohne Frühstück“ (F). Bei Problemen mit dem Termin gibt Frau Köhler die Telefonnummer an (R).",
  ),

  // ---- Short announcement 3: weather and traffic
  wetter.choice(
    "detail",
    "EASY",
    "Wie viel länger dauert die Fahrt auf der A 7 wegen des Staus mindestens?",
    "zwanzig Minuten",
    ["fünf Minuten", "eine halbe Stunde", "vierzig Minuten"],
    1,
    "Auf der A sieben staut es sich auf fünf Kilometern; die Sprecherin sagt: „Rechnen Sie dort mit mindestens zwanzig Minuten mehr Fahrzeit.“ Fünf Minuten verwechselt die Länge des Staus (fünf Kilometer) mit der Zeit; eine halbe Stunde und vierzig Minuten werden nicht genannt.",
  ),
  wetter.tfng(
    "detail",
    "MID",
    [
      ["Für heute Nachmittag sind zwölf Grad angekündigt.", "F"],
      ["Am Abend kann es ein Gewitter geben.", "R"],
      ["Die Fähre über den See fährt heute nicht.", "R"],
    ],
    "Die zwölf Grad nimmt die Sprecherin zurück: „bei zehn Grad“ (F). „Am Abend sind sogar Gewitter möglich“ (R). Wegen des Sturms fährt die Fähre heute nicht (R).",
  ),
];

// ================================================================ READING

// ---- Headline matching 1

const rKurz1 = a.text(
  "kurz-gemeldet",
  "Kurz gemeldet",
  "Alltag, Gesundheit und Natur",
  `
Kurz gemeldet

Text 1
In diesem Herbst können sich Erwachsene auch in vielen Apotheken gegen Grippe impfen lassen. Einen Termin braucht man dafür nicht, es genügt, zu den normalen Öffnungszeiten vorbeizukommen. Die Impfung selbst dauert nur wenige Minuten. Menschen mit bestimmten Vorerkrankungen müssen nichts bezahlen, für alle anderen kostet sie etwa 25 Euro.

Text 2
Beim Herbstlauf am Flussufer sind am Sonntag mehr als 800 Läuferinnen und Läufer gestartet. Die Zehn-Kilometer-Strecke führte vom Stadion bis zur alten Mühle und zurück. Trotz leichten Regens war die Stimmung gut. Das Startgeld von acht Euro pro Person geht in diesem Jahr an ein Kinderhospiz in der Region.

Text 3
Eine Supermarktkette testet in drei Filialen Mehrwegschalen für Salat und Obst. Kunden zahlen einen Euro Pfand und bringen die Schale beim nächsten Einkauf zurück. So soll weniger Plastik im Müll landen. Wenn der Test gut läuft, gibt es die Schalen ab dem Frühjahr in allen Filialen.

Text 4
Dieses Jahr fliegen die Kraniche früher nach Süden als sonst. Vogelkundler haben schon Ende September die ersten großen Gruppen über der Region gesehen. Der Grund ist wahrscheinlich das kalte Wetter im Norden. Wer die Vögel beobachten will, sollte morgens und abends zum Moor fahren, dort rasten sie gern.

Text 5
Die Stadtbibliothek verleiht ab sofort nicht nur Bücher, sondern auch Werkzeug. Bohrmaschinen, Leitern und Nähmaschinen kann man für eine Woche kostenlos mitnehmen. Man braucht nur einen Bibliotheksausweis. Die Idee kam von Bürgern, die sich ein teures Gerät für eine einzige Reparatur nicht kaufen wollten.
`,
);
const kurz1 = a.forText(rKurz1);

// ---- Headline matching 2

const rKurz2 = a.text(
  "woche-kompakt",
  "Das war die Woche",
  "Kultur, Schule und Umwelt",
  `
Das war die Woche

Text 1
Beim Schulfilmfest in der Aula des Gymnasiums laufen in dieser Woche zwanzig Kurzfilme, die Jugendliche selbst gedreht haben. Der Eintritt ist frei, die Vorführungen beginnen jeden Abend um 19 Uhr. Am Samstag stimmt das Publikum darüber ab, welcher Film den Publikumspreis bekommt. Die Gewinner dürfen im Sommer an einem Workshop teilnehmen.

Text 2
An der Grundschule am Park gehen seit Montag zwölf Kinder gemeinsam zu Fuß zur Schule. Der „Laufbus“ startet an drei festen Haltestellen, und ein Elternteil begleitet die Gruppe. So sollen morgens weniger Autos vor dem Schulhof stehen. Die Kinder sind begeistert und freuen sich, ihre Freunde schon auf dem Weg zu treffen.

Text 3
Die Obstbauern am See erwarten in diesem Jahr nur halb so viele Äpfel wie sonst. Schuld ist der Frost im April, der viele Blüten zerstört hat. Die Preise für Äpfel aus der Region steigen deshalb leicht. Wer selbst pflücken möchte, kann das bis Ende Oktober an den Wochenenden auf dem Hof Lindner tun.

Text 4
Im ehemaligen Lagerhaus am Hafen hat am Samstag eine neue Kletterhalle eröffnet. Auf 1200 Quadratmetern gibt es Wände für Anfänger und für erfahrene Kletterer, außerdem eigene Kurse für Kinder. Am ersten Wochenende ist der Eintritt für alle frei. Danach kostet ein Tagesticket zwölf Euro.

Text 5
Wer ein altes Handy zu Hause hat, kann es ab sofort im Rathaus abgeben. In der Eingangshalle steht dafür eine große Sammelbox. Die Geräte werden von einer Fachfirma recycelt, wertvolle Metalle werden wiederverwendet. Die Stadt bittet darum, vorher die Daten auf dem Handy zu löschen.
`,
);
const kurz2 = a.forText(rKurz2);

// ---- Comments 1: a rule in a club

const rVerein = a.text(
  "elterndienst",
  "Pflichtstunden für Eltern im Verein",
  "Sport und Verein",
  `
Forum „Unser Verein“: Müssen Eltern im Verein helfen?

Der Kinderturnverein Rot-Weiß möchte im nächsten Jahr eine neue Regel einführen: Jede Familie soll zehn Stunden im Jahr beim Sommerfest, beim Kuchenverkauf oder bei Turnieren mithelfen. Wer nicht hilft, zahlt 60 Euro mehr. Das schreiben Mitglieder dazu:

Katrin: Zwar habe ich selbst wenig Zeit, aber die Regel finde ich richtig. Bisher machen immer dieselben fünf Leute alles. Mit einer festen Zahl von Stunden wird die Arbeit gerecht verteilt, und der Verein muss nicht ständig um Hilfe betteln.

Murat: Ich bin dagegen. Ich arbeite im Schichtdienst und weiß oft erst am Vortag, wann ich frei habe. Dann zahle ich eben die 60 Euro, aber das fühlt sich wie eine Strafe an. Hilfe sollte freiwillig bleiben, denn ein Verein lebt vom guten Willen.

Sabine: Zwar verstehe ich, dass der Verein Helfer braucht, aber Zwang vertreibt gerade die Familien, die wenig Geld haben. Besser wäre ein Dankeschön: Wer hilft, zahlt ein Jahr lang weniger Beitrag. Das wäre fair und würde viele motivieren.

Jens: Ich finde die Regel gut. In meinem früheren Verein gab es sie auch, und es hat prima funktioniert. Man lernt die anderen Eltern kennen, und die Kinder sind stolz, wenn Mutter oder Vater mitmachen. Zehn Stunden im Jahr sind wirklich nicht viel.

Olga: Meine zwei Kinder turnen hier, und ich helfe schon jetzt oft. Gerade deshalb ärgert mich die Pflicht: Wer immer geholfen hat, fühlt sich plötzlich kontrolliert. Ich melde mich lieber freiwillig, wenn man mich nett fragt, und nicht, weil es in der Satzung steht.

Peter: Das Wort Pflicht hat mich zuerst auch gestört. Aber der Vorstand hat erklärt, dass der Beitrag steigen muss, wenn die Eltern nicht helfen. Dann helfe ich lieber zehn Stunden im Jahr, als jeden Monat mehr zu bezahlen. Deshalb stimme ich der Regel zu.
`,
);
const verein = a.forText(rVerein);

// ---- Comments 2: a plan in a village

const rBaugebiet = a.text(
  "baugebiet",
  "Neues Baugebiet auf der Streuobstwiese",
  "Wohnen im Dorf",
  `
Forum der Gemeinde Brunnenau: Neues Baugebiet auf der Streuobstwiese?

Die Gemeinde möchte am Ortsrand auf der Streuobstwiese zwanzig neue Häuser bauen lassen. Im Forum sagen die Einwohner ihre Meinung:

Brigitte: Zwar brauchen wir neue Wohnungen, aber doch nicht auf der Wiese! Dort blühen im Frühling die Obstbäume, und im Herbst ernten wir gemeinsam die Äpfel. Im Ort stehen mehrere Häuser leer. Die sollte man zuerst nutzen.

Emre: Ich bin dafür. Meine Frau und ich suchen seit einem Jahr ein Haus im Ort, aber es gibt nichts. Wenn nicht gebaut wird, ziehen junge Familien weg, und irgendwann schließt die Schule. Das ist mir wichtiger als ein paar Bäume.

Gisela: Ich wohne seit vierzig Jahren am Rand der Wiese und mag den Blick. Ich bin nicht grundsätzlich gegen neue Häuser, aber die schmale Straße hält zwanzig zusätzliche Autos nicht aus. Solange es dafür keine Lösung gibt, sage ich Nein.

Holger: Die Gemeinde verspricht, neue Bäume zu pflanzen. Aber ein junger Baum ist noch keine alte Streuobstwiese. Außerdem steht nirgends, ob die Häuser für normale Familien bezahlbar sein werden. So kann ich dem Plan leider nicht zustimmen. Die Gemeinde müsste das zuerst klären.

Ina: Zwar tut es mir um die Obstbäume leid, aber ich bin trotzdem für das Baugebiet. Ein Dorf, in dem keine Kinder mehr spielen, ist auch kein Naturparadies. Die Gemeinde soll nur darauf achten, dass die Häuser nicht zu groß werden.

Jonas: Ich habe als Kind oft auf dieser Wiese gespielt und bin trotzdem dafür. Dörfer müssen sich verändern, sonst sterben sie aus. Wichtig ist mir nur, dass auch kleine, günstige Häuser gebaut werden und nicht nur große.
`,
);
const baugebiet = a.forText(rBaugebiet);

// ---- Comments 3: a consumer question

const rKleidung = a.text(
  "kleidung-online",
  "Kleidung im Internet kaufen",
  "Einkaufen und Konsum",
  `
Forum „Einkaufen heute“: Kleidung im Internet kaufen

Immer mehr Menschen bestellen ihre Kleidung im Internet, und in vielen Innenstädten schließen Geschäfte. Wie machen Sie es?

Tabea: Ich kaufe Kleidung nur im Laden. Ich muss den Stoff fühlen und alles anprobieren, sonst passt es nachher nicht. Das Zurückschicken ist mir viel zu lästig. Außerdem gehe ich samstags gern durch die Stadt und trinke dabei einen Kaffee.

Vincent: Für mich ist das perfekt. In unserer Kleinstadt gibt es nur zwei Kleidungsgeschäfte, und die haben kaum Größen für mich. Im Internet bestelle ich ein Teil in drei Größen und schicke zurück, was nicht passt. Das kostet mich nichts.

Wiebke: Zwar mag ich es, in Geschäften zu stöbern, aber meistens bestelle ich trotzdem online. Bei Jeans und T-Shirts weiß ich genau, welche Größe ich brauche, und ich vergleiche gern die Preise von mehreren Anbietern. Das Paket bringt mir dann der Postbote bis an die Tür.

Yusuf: Zwar sind die Preise im Internet oft niedriger, aber ich kaufe trotzdem lieber im Laden. Die Verkäuferin kennt mich und berät mich ehrlich. Außerdem finde ich es traurig, wenn in unserer Straße immer mehr Geschäfte schließen.

Zoe: Ich bestelle fast alles im Netz, auch Kleidung. Abends in Ruhe auszusuchen ist einfach bequemer, als samstags durch volle Läden zu laufen. Nur bei Sachen, die ich noch nie getragen habe, bin ich vorsichtig und lese vorher viele Bewertungen.

Anton: Ich habe es ausprobiert, aber ehrlich gesagt war es ein Reinfall. Drei von vier Teilen passten nicht, und die Rücksendung hat zwei Wochen gedauert, bis ich das Geld wiederbekam. Seitdem gehe ich wieder in die Stadt.
`,
);
const kleidung = a.forText(rKleidung);

const HEADLINE_PROMPT =
  "Lesen Sie die Texte 1 bis 5 und die Überschriften A bis H. Welche Überschrift passt zu welchem Text? Jede Überschrift passt nur einmal. Drei Überschriften bleiben übrig.";
const TEXTS = ["Text 1", "Text 2", "Text 3", "Text 4", "Text 5"];

const readingItems = [
  // ---- Headline matching 1
  kurz1.match(
    "gist",
    "MID",
    HEADLINE_PROMPT,
    TEXTS,
    [
      "A: Kraniche sind früh dran",
      "B: Stadtlauf wegen Dauerregens verschoben",
      "C: Statt kaufen einfach leihen: Bibliothek verleiht Geräte",
      "D: Grippeschutz jetzt auch in der Apotheke ohne Anmeldung",
      "E: Supermarkt verteuert Plastiktüten",
      "F: Läufer sammeln Geld für einen guten Zweck",
      "G: Kinder müssen sich künftig vor der Einschulung impfen lassen",
      "H: Weniger Plastik: Supermarkt probiert Pfandschalen aus",
    ],
    [4, 6, 8, 1, 3],
    "Text 1 berichtet über die Grippeimpfung in Apotheken ohne Termin (D; G nennt zwar eine Impfung, aber für Schulkinder und als Pflicht). Text 2 über den Herbstlauf, dessen Startgeld gespendet wird (F; B nennt den Lauf, aber Regen verschiebt ihn nicht: er fand statt). Text 3 über Pfandschalen im Supermarkt (H; E nennt den Supermarkt, aber Plastiktüten). Text 4 über die früh ziehenden Kraniche (A). Text 5 über die Bibliothek, die Werkzeug verleiht (C). B, E und G bleiben übrig.",
  ),
  kurz1.choice(
    "detail",
    "EASY",
    "Was müssen Kunden tun, wenn sie die Schalen aus Text 3 benutzen?",
    "Sie geben einen Euro als Pfand und bekommen ihn bei der Rückgabe der Schale zurück.",
    [
      "Sie leihen die Schale eine Woche lang kostenlos aus und bringen sie dann zurück.",
      "Sie kaufen die Schale einmal und können sie danach zu Hause immer wieder neu benutzen.",
      "Sie bringen ihre eigene Schale mit, die im Supermarkt für sie gefüllt wird.",
    ],
    3,
    "Text 3: „Kunden zahlen einen Euro Pfand und bringen die Schale beim nächsten Einkauf zurück.“ Das kostenlose Ausleihen für eine Woche beschreibt Text 5 (Bibliothek). Von einem Kauf oder von mitgebrachten Behältern ist keine Rede.",
  ),

  // ---- Headline matching 2
  kurz2.match(
    "gist",
    "HARD",
    HEADLINE_PROMPT,
    TEXTS,
    [
      "A: Kletterwand in der Turnhalle bleibt vorerst gesperrt",
      "B: Ausgedient: Rathaus sammelt alte Mobiltelefone",
      "C: Frostschäden: Land zahlt Hilfen an Obstbauern",
      "D: Nachwuchsfilmer zeigen ihre Werke, Eintritt frei",
      "E: Neue Schulbuslinie soll Eltern entlasten",
      "F: Kalter Frühling: Obsternte am See fällt mager aus",
      "G: Morgens zusammen laufen statt im Auto vorfahren",
      "H: Hoch hinaus im früheren Lagerhaus am Hafen",
    ],
    [4, 7, 6, 8, 2],
    "Text 1 (Schulfilmfest mit Kurzfilmen von Jugendlichen) gehört zu D. Text 2 (Laufbus: Kinder gehen gemeinsam zu Fuß) zu G; E nennt zwar die Schule, aber eine neue Buslinie. Text 3 (halbe Apfelernte nach dem Frost) zu F; C nennt den Frost, aber Hilfen vom Land stehen nicht im Text. Text 4 (neue Kletterhalle im Lagerhaus) zu H; A nennt eine Kletterwand, aber in einer Turnhalle und gesperrt. Text 5 (Handys im Rathaus abgeben) zu B. A, C und E bleiben übrig.",
  ),
  kurz2.choice(
    "detail",
    "MID",
    "Was erfährt man in Text 1 über das Schulfilmfest?",
    "Das Publikum wählt am Samstag seinen Lieblingsfilm.",
    [
      "Eine Jury aus Lehrern entscheidet über den besten Film.",
      "Die Filme laufen nur am Samstagabend in der Aula.",
      "Der Eintritt kostet für Erwachsene einen kleinen Betrag.",
    ],
    0,
    "Text 1: „Am Samstag stimmt das Publikum darüber ab, welcher Film den Publikumspreis bekommt.“ Eine Jury wird nicht erwähnt; die Filme laufen die ganze Woche jeden Abend; der Eintritt ist frei.",
  ),

  // ---- Comments 1: club rule (answers R F F R F R)
  verein.yesNo(
    "attitude",
    "MID",
    [
      ["Katrin", "R"],
      ["Murat", "F"],
      ["Sabine", "F"],
      ["Jens", "R"],
      ["Olga", "F"],
      ["Peter", "R"],
    ],
    "Katrin beginnt mit „Zwar ... aber“, ist aber dafür, weil die Arbeit dann gerecht verteilt wird (Ja). Murat lehnt die Pflicht ab (Nein). Sabine versteht den Verein, ist aber gegen den Zwang (Nein). Jens findet die Regel gut (Ja). Olga hilft schon jetzt, doch die Pflicht ärgert sie (Nein). Peter war zuerst skeptisch, hilft aber lieber, als mehr Beitrag zu zahlen (Ja).",
    "Lesen Sie die Kommentare zum Thema „Pflichtstunden für Eltern im Verein“. Ist die Person für die neue Regel? Kreuzen Sie Ja oder Nein an.",
  ),
  verein.choice(
    "detail",
    "MID",
    "Was schlägt Sabine statt der Pflicht vor?",
    "Wer mithilft, soll als Dank ein Jahr lang einen geringeren Beitrag zahlen.",
    [
      "Familien mit wenig Geld sollen die 60 Euro nicht bezahlen müssen.",
      "Der Verein soll die Pflichtstunden von zehn auf fünf Stunden pro Jahr senken.",
      "Alle Eltern sollen statt der Mithilfe einen höheren Mitgliedsbeitrag bezahlen.",
    ],
    1,
    "Sabine: „Wer hilft, zahlt ein Jahr lang weniger Beitrag.“ Die 60 Euro sind die Gebühr für alle, die nicht helfen; mit wenig Geld begründet sie nur ihre Kritik am Zwang. Weniger Pflichtstunden schlägt niemand vor. Einen höheren Beitrag erwähnt Peter als Folge, wenn Eltern nicht helfen.",
  ),

  // ---- Comments 2: village plan (answers F R F F R R)
  baugebiet.yesNo(
    "attitude",
    "HARD",
    [
      ["Brigitte", "F"],
      ["Emre", "R"],
      ["Gisela", "F"],
      ["Holger", "F"],
      ["Ina", "R"],
      ["Jonas", "R"],
    ],
    "Brigitte sieht den Bedarf, will aber nicht auf der Wiese bauen (Nein). Emre ist dafür (Ja). Gisela ist nicht grundsätzlich gegen Häuser, stimmt dem Plan wegen der Straße aber nicht zu (Nein). Holger traut dem Versprechen neuer Bäume nicht und zweifelt an bezahlbaren Häusern (Nein). Ina hat Bedenken, ist aber trotzdem dafür (Ja). Jonas ist trotz seiner Kindheitserinnerungen dafür (Ja).",
    "Lesen Sie die Kommentare zum Thema „Neues Baugebiet auf der Streuobstwiese“. Ist die Person für das Baugebiet? Kreuzen Sie Ja oder Nein an.",
  ),
  baugebiet.choice(
    "detail",
    "EASY",
    "Welche Folge befürchtet Emre, wenn nicht gebaut wird?",
    "Junge Familien ziehen weg, und die Schule könnte schließen.",
    [
      "Die Obstbäume werden nicht mehr gepflegt und sterben mit der Zeit ab.",
      "Die Preise für Häuser im Ort steigen immer weiter.",
      "Die Gemeinde muss die Steuern für alle Einwohner erhöhen.",
    ],
    2,
    "Emre: „Wenn nicht gebaut wird, ziehen junge Familien weg, und irgendwann schließt die Schule.“ Von der Pflege der Bäume, steigenden Preisen oder Steuern spricht er nicht.",
  ),

  // ---- Comments 3: consumer question (answers F R R F R F)
  kleidung.yesNo(
    "attitude",
    "MID",
    [
      ["Tabea", "F"],
      ["Vincent", "R"],
      ["Wiebke", "R"],
      ["Yusuf", "F"],
      ["Zoe", "R"],
      ["Anton", "F"],
    ],
    "Tabea kauft nur im Laden (Nein). Vincent bestellt gern, weil es im Ort kaum Auswahl gibt (Ja). Wiebke mag zwar Geschäfte, bestellt aber meistens online (Ja). Yusuf nennt niedrige Preise im Internet, kauft aber lieber im Laden (Nein). Zoe bestellt fast alles im Netz (Ja). Anton hat schlechte Erfahrungen gemacht und geht wieder in die Stadt (Nein).",
    "Lesen Sie die Kommentare zum Thema „Kleidung im Internet kaufen“. Kauft die Person gern online? Kreuzen Sie Ja oder Nein an.",
  ),
  kleidung.choice(
    "detail",
    "HARD",
    "Was ist Anton bei seiner Bestellung passiert?",
    "Die meisten Teile passten nicht, und das Geld kam erst nach zwei Wochen zurück.",
    [
      "Das Paket ist nie bei ihm angekommen, und sein Geld hat er nicht wiederbekommen.",
      "Er hat alles behalten, weil ihm die Rücksendung viel zu teuer gewesen wäre.",
      "Die Teile waren kaputt, aber die Firma hat sie ihm sofort kostenlos ersetzt.",
    ],
    0,
    "Anton: „Drei von vier Teilen passten nicht, und die Rücksendung hat zwei Wochen gedauert, bis ich das Geld wiederbekam.“ Das Paket kam an, das Geld kam zurück, und von kaputten Teilen oder Ersatz ist keine Rede.",
  ),
];

// ================================================================ WRITING

const INFORMAL = "informell (du)";
const FORMAL = "formell (Sie)";
const RUBRIC_NOTE =
  "Bewertung nach Goethe B1: Erfüllung (alle Punkte, Textsorte, Register, Länge), Kohärenz, Wortschatz, Strukturen.";
/** Same pair as the other B1 tasks of about 80 to 100 words. */
const LONG: [number, number] = [70, 110];

const writingItems = [
  a.writing(
    "reply",
    "MID",
    LONG,
    "Sie haben diese E-Mail von Ihrem Freund Lukas bekommen:\n\n" +
      "„Hallo! Ich habe mir vorgenommen, endlich mit dem Laufen anzufangen. Kennst du eine schöne Strecke, auf der man gut laufen kann? Welche Schuhe soll ich kaufen, und wo bekomme ich sie günstig? Ist es besser, morgens oder abends zu laufen? Und hast du Lust, am Samstag mit mir eine erste Runde zu drehen? Schreib mir bald! Viele Grüße, Lukas“\n\n" +
      "Antworten Sie Lukas (circa 90 bis 100 Wörter). Gehen Sie auf alle vier Fragen ein.",
    [
      "empfiehlt eine konkrete Strecke oder einen Ort zum Laufen",
      "gibt einen Rat zu den Schuhen (Art oder Geschäft)",
      "nennt die bessere Tageszeit und begründet sie",
      "reagiert auf die Einladung für Samstag (Zusage mit Zeitvorschlag oder Absage mit Grund)",
      "persönliche E-Mail mit Anrede und Gruß",
    ],
    [
      "eine Strecke zum Laufen empfehlen",
      "einen Rat zu den Schuhen geben",
      "sagen, ob morgens oder abends besser ist, und warum",
      "auf den Vorschlag für Samstag antworten",
      "Anrede und Gruß",
    ],
    INFORMAL,
    `Antwort auf eine E-Mail mit vier Fragen (Rat geben, Vorschlag beantworten): Alle vier Punkte müssen vorkommen. Du-Form, persönlicher Ton. ${RUBRIC_NOTE}`,
  ),
  a.writing(
    "email",
    "HARD",
    LONG,
    "Sie haben diese Anzeige in der Stadtzeitung gelesen:\n\n" +
      "„Repair-Café Nordstadt sucht Helferinnen und Helfer! Jeden zweiten Samstag reparieren wir mit unseren Gästen kaputte Lampen, Radios und Kleidung. Wer gern bastelt, ist willkommen, Vorkenntnisse sind nicht nötig. Treffpunkt ist das Gemeindehaus am Kastanienweg. Auskunft: Frau Brandt“\n\n" +
      "Sie möchten mitmachen und schreiben Frau Brandt eine E-Mail (circa 90 bis 100 Wörter).\n\n" +
      "- Stellen Sie sich kurz vor und sagen Sie, warum Sie mithelfen möchten.\n" +
      "- Fragen Sie, wie viel Zeit Sie ungefähr einplanen müssen.\n" +
      "- Fragen Sie, ob Sie eigenes Werkzeug mitbringen sollen.\n" +
      "- Schlagen Sie einen Termin vor, an dem Sie einmal vorbeikommen können.",
    [
      "stellt sich kurz vor (Alter, Herkunft o. Ä. werden nicht erwartet) und begründet das Interesse",
      "fragt nach dem Zeitaufwand",
      "fragt, ob eigenes Werkzeug nötig ist",
      "schlägt einen konkreten Termin zum Vorbeikommen vor",
      "formelle E-Mail mit Anrede „Sehr geehrte Frau Brandt“ und Schlussformel",
    ],
    [
      "sich kurz vorstellen",
      "warum Sie mithelfen möchten",
      "nach dem Zeitaufwand fragen",
      "nach dem Werkzeug fragen",
      "einen Termin vorschlagen",
      "Anrede und Gruß",
    ],
    FORMAL,
    `Formelle Anfrage zu einer Anzeige (ehrenamtliche Mitarbeit): vier Leitpunkte, Sie-Form, höfliche Fragen. ${RUBRIC_NOTE}`,
  ),
];

// ================================================================ GRAMMAR

const grammarItems = [
  // Letter cloze, HARD: an enquiry to a guest house. Each gap's four options are forms of one family.
  cloze("B1", "HARD", {
    title: "Eine Anfrage an die Pension",
    first: "Sehr geehrte Frau Hoffmann, vor zwei Jahren haben wir ein Wochenende in Ihrer Pension Seeblick verbracht und uns dort sehr wohlgefühlt.",
    body:
      "Deshalb interessieren wir uns [[für|auf|um|über#verb_praeposition]] einen weiteren Aufenthalt im Mai, [[falls|obwohl|damit|sondern#konnektor]] Sie dann noch ein Zimmer frei haben. " +
      "Wir sind zu viert und brauchen ein Familienzimmer, [[in dem|in das|in der|in denen#relativsatz.praeposition]] vier Personen bequem schlafen können. " +
      "Ich [[wäre|hätte|würde|wurde#konjunktiv2]] Ihnen sehr dankbar, wenn Sie mir die Preise für ein Familienzimmer mitteilen könnten. " +
      "[[Während|Wegen|Trotz|Statt#genitiv.praeposition]] unseres Aufenthalts würden wir gern eine Bootsfahrt auf dem See machen. " +
      "Meine Frau und ich essen [[weder|entweder|sowohl|zwar#konnektor.zweiteilig]] Fleisch noch Fisch, deshalb fragen wir, ob abends auch vegetarische Gerichte [[angeboten|anbietet|anbot|anzubieten#passiv.praesens]] werden. " +
      "Wichtig ist uns außerdem ein Zimmer mit [[eigenem|eigenen|eigener|eigene#adjektivendung]] Bad. " +
      "Wir würden Sie bitten, uns ein Kinderbett [[bereitzustellen|bereitstellen|bereitgestellt|bereitzustellend#infinitiv]]. " +
      "Bitte schreiben Sie uns kurz, [[sobald|bevor|obwohl|damit#konnektor]] Sie unsere Anfrage geprüft haben. " +
      "Wir danken Ihnen schon jetzt [[dafür|darauf|darüber|dazu#praepositionaladverb]], dass Sie uns bald antworten.",
    last: "Wir würden uns sehr freuen, Sie bald wiederzusehen. Mit freundlichen Grüßen, Mark Jensen",
    note: "sich interessieren für (g1), falls mit Verb am Ende gegen obwohl, damit, sondern (g2), Relativpronomen nach in mit Dativ (g3), wäre dankbar im Konjunktiv II (g4), während mit Genitiv gegen wegen, trotz, statt (g5), weder ... noch (g6), Vorgangspassiv angeboten werden (g7), Adjektivendung nach mit ohne Artikel (g8), zu-Infinitiv mit trennbarem Verb (g9), sobald mit Verb am Ende gegen bevor, obwohl, damit (g10), danken für mit dafür (g11).",
  }),

  // Advert and reply (Sprachbausteine): ten gaps, fifteen words, five near-fit distractors.
  wordBank("B1", "MID", {
    title: "Ein Sofa aus zweiter Hand",
    first:
      "Zu verkaufen: graues Sofa mit drei Sitzplätzen, zwei Jahre alt, in sehr gutem Zustand. Preis: 180 Euro, nur Abholung in der Weststadt. Kontakt: Herr Bauer, Anrufe bitte erst nach 18 Uhr.\n\n" +
      "Sehr geehrter Herr Bauer, ich habe Ihre Anzeige gelesen und möchte Ihr Sofa gern ansehen.",
    body:
      "Ich suche [[für#praeposition]] mein kleines Wohnzimmer ein Sofa, [[das#relativsatz]] nicht zu groß sein soll, [[weil#konnektor]] der Platz an der Wand begrenzt ist. " +
      "Leider stehen in der Anzeige keine Maße, und ich möchte mich gern [[nach#verb_praeposition]] der Breite und der Tiefe erkundigen. " +
      "Außerdem würde mich interessieren, [[ob#nebensatz]] man den Bezug abnehmen und waschen kann. " +
      "Ich habe nämlich eine Katze, [[deshalb#konnektor]] muss der Stoff pflegeleicht sein. " +
      "Ein Auto besitze ich nicht, aber mein Bruder [[kann#modalverb.konjugation]] mit einem Transporter kommen. " +
      "Wenn Sie möchten, schicke ich [[Ihnen#dativ]] vorher ein Foto von meinem Wohnzimmer. " +
      "Darf ich [[Sie#akkusativ]] morgen Abend anrufen? " +
      "Ich bedanke mich schon jetzt [[dafür#praepositionaladverb]], dass Sie sich Zeit nehmen.",
    last: "Ich freue mich auf Ihre Antwort. Mit freundlichen Grüßen, Mara Keller",
    distractors: ["dem", "denn", "können", "um", "darauf"],
    note: "Anzeige und Antwort (Sprachbausteine): für + Akkusativ (g1), Relativpronomen das gegen dem (g2), weil mit Verb am Ende gegen denn (g3), sich erkundigen nach gegen um (g4), indirekte Frage mit ob (g5), deshalb mit Verb an zweiter Stelle gegen denn (g6), kann gegen können bei Singular (g7), Dativ Ihnen gegen Akkusativ Sie (g8, g9), sich bedanken für gegen darauf (g10).",
  }),
];

export const B1_MORE: LevelParts = {
  ...noParts(),
  grammar: { stimuli: [], items: grammarItems },
  reading: { stimuli: [rKurz1, rKurz2, rVerein, rBaugebiet, rKleidung], items: readingItems },
  listening: { stimuli: [lHandy, lRad, lFleisch, lMuseum, lPraxis, lWetter], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
};
