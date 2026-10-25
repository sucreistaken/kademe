import { authorFor, type LevelParts } from "../author";
import { cloze } from "../cloze";
import { wordBank } from "../wordbank";

/**
 * Round 3 additions to the B2 bank (formats from the model tests: see docs/research/formats-2026-10-25.md).
 * Built with the shared helpers in ../author.ts; the instruction lines come from ../instructions.ts.
 *
 * Units: 2 play-once short announcements, 1 "Angaben korrigieren" clip, 2 headline-matching news sets,
 * 2 comment sets (Ja / Nein), 3 writing tasks, 1 phone-call speaking task, 1 letter MC cloze text and
 * 1 "Anzeige und Antwort" Sprachbausteine word bank.
 */
const a = authorFor("B2");

// ================================================================ LISTENING

// ---------------------------------------------------------------- Kurzansage 1: hotline menu with a wait (play once)

const lHotline = a.clip(
  "hotline-nordnet-einmal",
  "Hotline-Ansage eines Internetanbieters",
  "Alltag: Kundenservice-Hotline",
  [{ label: "Ansage", voice: "A" }],
  [
    "Ansage: Guten Tag und herzlich willkommen beim Kundenservice von Nordnet. Zurzeit gibt es in mehreren Stadtteilen eine Störung im Netz. Ob auch Ihre Straße betroffen ist, sehen Sie sofort auf unserer Störungskarte im Internet. Dafür müssen Sie nicht warten.",
    "Ansage: Für Fragen zur Rechnung drücken Sie die Eins, für einen Umzug oder einen Tarifwechsel die Zwei. Bei allen anderen Anliegen bleiben Sie bitte in der Leitung. Die Wartezeit beträgt im Moment etwa zwölf Minuten.",
    "Ansage: Noch ein Hinweis: Heute sind wir nicht wie sonst bis achtzehn Uhr erreichbar, sondern nur bis sechzehn Uhr dreißig, also bis halb fünf. Morgen sind wir ab acht Uhr wieder für Sie da.",
  ],
  1,
);
const hotline = a.forClip(lHotline);
const hotlineItems = [
  hotline.choice(
    "gist",
    "MID",
    "Was können Kundinnen und Kunden tun, die nur wissen möchten, ob in ihrer Straße eine Störung vorliegt?",
    "Sie prüfen es selbst auf der Störungskarte im Internet, ohne in die Warteschleife zu müssen.",
    [
      "Sie drücken die Eins und werden mit dem Störungsdienst verbunden.",
      "Sie bleiben in der Leitung, bis ein Mitarbeiter ihre Straße geprüft hat.",
      "Sie rufen erst morgen ab acht Uhr an, weil heute niemand mehr erreichbar ist.",
    ],
    1,
    "Die Ansage sagt: Ob die eigene Straße betroffen ist, sieht man sofort auf der Störungskarte im Internet, dafür muss man nicht warten. Die Eins gehört zu Fragen zur Rechnung, nicht zur Störung. In der Leitung bleibt nur, wer ein anderes Anliegen hat. „Morgen ab acht Uhr“ betrifft nur die Erreichbarkeit der Hotline; sie ist heute noch bis sechzehn Uhr dreißig besetzt.",
  ),
  hotline.choice(
    "detail",
    "HARD",
    "Bis wann ist der Kundenservice heute erreichbar?",
    "bis 16.30 Uhr",
    ["bis 18.00 Uhr", "bis 16.00 Uhr", "bis 17.30 Uhr"],
    0,
    "Die übliche Zeit (achtzehn Uhr) wird ausdrücklich ersetzt: „nicht wie sonst bis achtzehn Uhr, sondern nur bis sechzehn Uhr dreißig“. 16.00 Uhr und 17.30 Uhr kommen im Text nicht vor.",
  ),
];

// ---------------------------------------------------------------- Kurzansage 2: tourist information (play once)

const lBootstour = a.clip(
  "tourist-bootstour-einmal",
  "Ansage der Tourist-Information",
  "Reisen: Bootstour auf dem See",
  [{ label: "Ansage", voice: "B" }],
  [
    "Ansage: Sie haben die Tourist-Information Seebach erreicht. Ein wichtiger Hinweis zu den Bootsrundfahrten auf dem Mühlsee: Wegen des niedrigen Wasserstands fährt diese Woche nicht das große Ausflugsschiff, sondern nur ein kleineres Boot mit vierzig Plätzen.",
    "Ansage: Die Abfahrten sind in dieser Woche nicht wie im Prospekt um zehn und um vierzehn Uhr, sondern um halb elf und um halb drei. Der Preis bleibt bei fünfzehn Euro, Karten gibt es nur noch am Kiosk am Hafen.",
    "Ansage: Wer sicher mitfahren möchte, kommt am besten eine halbe Stunde früher. Unser Büro ist wie immer von neun bis siebzehn Uhr für Sie da.",
  ],
  1,
);
const bootstour = a.forClip(lBootstour);
const bootstourItems = [
  bootstour.choice(
    "gist",
    "EASY",
    "Warum fährt diese Woche nur ein kleineres Boot?",
    "Der Wasserstand im Mühlsee ist für das große Schiff zu niedrig.",
    [
      "Das große Ausflugsschiff wird gerade repariert und gewartet.",
      "Für die Rundfahrten haben sich zu wenige Fahrgäste angemeldet.",
      "Die Stadt hat das große Schiff für eine andere Fahrt reserviert.",
    ],
    3,
    "„Wegen des niedrigen Wasserstands fährt diese Woche nicht das große Ausflugsschiff.“ Eine Reparatur, zu wenige Anmeldungen oder eine Reservierung werden nicht erwähnt.",
  ),
  bootstour.choice(
    "detail",
    "MID",
    "Wann fährt das Boot diese Woche am Nachmittag ab?",
    "um 14.30 Uhr",
    ["um 14.00 Uhr", "um 15.00 Uhr", "um 15.30 Uhr"],
    2,
    "Im Prospekt steht vierzehn Uhr, gesagt wird „um halb drei“, also 14.30 Uhr. 15.30 Uhr ist der typische Fehler, wenn man „halb drei“ als halb vier versteht; 15.00 Uhr kommt nicht vor.",
  ),
];

// ---------------------------------------------------------------- Angaben korrigieren: weekend programme

const lFotowochenende = a.clip(
  "fotowochenende-aenderungen",
  "Nachricht zum Fotowochenende",
  "Freizeit: Fotokurs am Wochenende",
  [{ label: "Organisatorin", voice: "D" }],
  [
    "Organisatorin: Liebe Teilnehmerinnen und Teilnehmer, hier ist Petra vom Fotoclub. Zu unserem Wochenende im Naturpark gibt es leider ein paar Änderungen gegenüber dem gedruckten Programm.",
    "Organisatorin: Also, erstens: Wir fahren am Freitag nicht um sechzehn Uhr ab, sondern erst um halb sechs, weil der Bus später kommt. Zweitens: Die Jugendherberge ist überbucht, deshalb wohnen wir im Naturfreundehaus, das liegt ganz in der Nähe.",
    "Organisatorin: Drittens: Den Workshop zur Bildbearbeitung am Samstag leitet nicht Herr Kaya, er ist krank, sondern Frau Winkler. Das Abendessen am Samstag bleibt bei neunzehn Uhr, da ändert sich nichts.",
    "Organisatorin: Wegen der neuen Unterkunft wird das Wochenende etwas teurer. Statt fünfundachtzig kostet es jetzt neunzig, nein, Moment, fünfundneunzig Euro. Die Rückfahrt am Sonntag bleibt bei siebzehn Uhr. Bitte denken Sie an feste Schuhe und Ihre Kamera. Bis Freitag also!",
  ],
);
const foto = a.forClip(lFotowochenende);
const fotoItems = [
  foto.notes(
    "notes",
    "HARD",
    "Hören Sie die Nachricht. Das gedruckte Programm stimmt nicht mehr in allen Punkten. Tragen Sie in jede Zeile die richtige Angabe ein.\n\n" +
      "Veranstaltung | Im Programm | Richtig ist\n" +
      "Abfahrt am Freitag | 16 Uhr | {{g1}}\n" +
      "Unterkunft | Jugendherberge | {{g2}}\n" +
      "Workshop Bildbearbeitung | Herr Kaya | {{g3}}\n" +
      "Abendessen am Samstag | 19 Uhr | {{g4}}\n" +
      "Preis des Wochenendes | 85 Euro | {{g5}}\n" +
      "Rückfahrt am Sonntag | 17 Uhr | {{g6}}",
    [
      ["17.30", "17:30", "17.30 Uhr", "17:30 Uhr", "17 Uhr 30", "halb sechs", "halb 6", "um halb sechs", "um halb 6", "siebzehn Uhr dreißig", "siebzehn Uhr 30", "siebzehn dreißig"],
      ["Naturfreundehaus", "im Naturfreundehaus", "das Naturfreundehaus", "Naturfreunde-Haus", "Naturfreunde Haus"],
      ["Frau Winkler", "Winkler", "Fr. Winkler"],
      ["19 Uhr", "19", "19.00", "19:00", "19.00 Uhr", "neunzehn Uhr", "neunzehn", "um neunzehn Uhr"],
      ["95 Euro", "95", "95 €", "95€", "fünfundneunzig Euro", "fünfundneunzig"],
      ["17 Uhr", "17", "17.00", "17:00", "17.00 Uhr", "siebzehn Uhr", "siebzehn", "um siebzehn Uhr"],
    ],
    "Vier Angaben ändern sich (Abfahrt, Unterkunft, Kursleitung, Preis), zwei bleiben gleich (Abendessen, Rückfahrt). Abfahrt: „nicht um sechzehn Uhr, sondern erst um halb sechs“ (17.30 Uhr). Preis: Die Sprecherin korrigiert sich selbst („neunzig, nein, Moment, fünfundneunzig“); 85 und 90 sind die typischen Fehler. Abendessen und Rückfahrt werden ausdrücklich bestätigt und bleiben bei 19 und 17 Uhr.",
  ),
  foto.choice(
    "inference",
    "MID",
    "Warum wird das Wochenende teurer?",
    "Die neue Unterkunft ist teurer als die ursprünglich geplante.",
    [
      "Der Bus für die Anreise muss länger warten und kostet mehr.",
      "Die Ersatzkraft für den Workshop verlangt ein höheres Honorar.",
      "Das Abendessen am Samstag wird jetzt in einem Restaurant serviert.",
    ],
    0,
    "Die Sprecherin sagt: „Wegen der neuen Unterkunft wird das Wochenende etwas teurer.“ Der spätere Bus und die Krankheit von Herr Kaya werden begründet, aber nicht mit höheren Kosten in Verbindung gebracht; das Abendessen bleibt unverändert.",
  ),
];

// ================================================================ READING

// ---------------------------------------------------------------- Headline matching 1: science, culture, sport, local politics, consumer

const rKurzA = a.text(
  "kurzmeldungen-forschung",
  "Kurzmeldungen aus Forschung, Kultur und Region",
  "Nachrichten: Wissenschaft und Gesellschaft",
  `
Text 1
Risse im Beton sind teuer, denn durch sie dringt Wasser ein und greift den Stahl im Inneren an. Ein Forschungsteam der Technischen Hochschule Lindau hat deshalb winzige Kapseln mit ruhenden Bakterien in den Beton gemischt. Sobald ein Riss entsteht und Feuchtigkeit eindringt, erwachen die Bakterien und bilden Kalk, der die Lücke verschließt. Im Labor schlossen sich Risse von einem halben Millimeter innerhalb von drei Wochen. Der neue Baustoff ist etwa ein Fünftel teurer als normaler Beton; im nächsten Jahr soll er auf einem Radweg getestet werden.

Text 2
Während das Stadttheater von Herbst an saniert wird, spielt das Ensemble nicht in einer Ausweichhalle, sondern in einem stillgelegten Straßenbahndepot am Stadtrand. Die Intendantin Hanna Berger sieht darin eine Chance: Die Bühne steht zwischen den Gleisen, das Publikum sitzt auf Tribünen, die nach jeder Vorstellung zur Seite gefahren werden. Für die erste Spielzeit sind fünf Stücke geplant, darunter eines über die Geschichte des Depots selbst. Der Vorverkauf beginnt im August. Die Eintrittspreise bleiben unverändert, und abends fährt die Linie neun bis vor die Tür.

Text 3
Die Handballerinnen des TSV Birkenau spielen ab dem Sommer in der dritten Liga. Mit einem 27:24 gegen den Tabellenzweiten sicherten sie sich am Samstag vor 800 Zuschauern den Aufstieg, auf den der Verein zwei Jahre lang gehofft hatte. Trainer Milan Kovač lobte vor allem die Abwehr in der zweiten Halbzeit. Allerdings muss der Verein, der ausschließlich von Ehrenamtlichen geführt wird, nun eine größere Halle mieten, weil die eigene Halle die Vorgaben des Verbands nicht erfüllt. Für die Suche nach Sponsoren bleiben dem Verein nur drei Monate.

Text 4
Die Einwohnerinnen und Einwohner von Lindenthal sollen künftig selbst entscheiden, wofür ein Teil des städtischen Haushalts ausgegeben wird. Der Gemeinderat beschloss am Dienstag mit 14 zu 9 Stimmen, jedes Jahr 100 000 Euro für Vorschläge aus der Bevölkerung bereitzustellen. Wer eine Idee hat, kann sie im Frühjahr einreichen, im Herbst stimmen alle online darüber ab. Die Opposition kritisierte, die Summe sei viel zu klein, um wirklich etwas zu bewegen. Die ersten Projekte sollen im übernächsten Frühjahr umgesetzt werden. Aus Sicht der Verwaltung soll das Verfahren das Vertrauen in die Politik stärken.

Text 5
Die Verbraucherzentrale hat bei 40 Onlineshops geprüft, ob die durchgestrichenen „Statt“-Preise echt sind. Bei fast jedem dritten Angebot hatte das Produkt in den Wochen davor nie so viel gekostet. Dabei schreibt das Gesetz vor, dass der niedrigste Preis der letzten dreißig Tage genannt werden muss. Die Verbraucherschützer raten, Preise über mehrere Wochen zu vergleichen und sich von Aktionen mit Countdown nicht unter Druck setzen zu lassen. Besonders häufig fiel das bei Kleidung und Möbeln auf. Gegen drei Händler läuft inzwischen eine Klage.
`,
);
const kurzA = a.forText(rKurzA);
const kurzAItems = [
  kurzA.match(
    "gist",
    "MID",
    "Lesen Sie die Texte 1 bis 5 und die Überschriften A bis J. Welche Überschrift passt zu welchem Text? Jede Überschrift passt nur einmal. Fünf Überschriften bleiben übrig.",
    ["Text 1", "Text 2", "Text 3", "Text 4", "Text 5"],
    [
      "A: Gemeinderat streicht Zuschüsse für Sportvereine und Kultur",
      "B: Bakterien sollen Risse im Beton von selbst verschließen",
      "C: Handballverein sucht dringend neue Trainerinnen für den Nachwuchs",
      "D: Viele Rabatte im Netz sind weniger wert, als sie versprechen",
      "E: Neuer Beton ist deutlich billiger und hält länger als bisher",
      "F: Theater zieht während der Sanierung ins alte Straßenbahndepot",
      "G: Onlineshops senken die Preise für Elektrogeräte deutlich",
      "H: Einwohner dürfen über einen Teil des Stadtbudgets mitentscheiden",
      "I: Straßenbahnlinie neun fährt wegen der Sanierung nur noch bis zum Stadtrand",
      "J: Handballerinnen steigen auf, brauchen aber eine größere Halle",
    ],
    [2, 6, 10, 8, 4],
    "Text 1 (Bakterien im Beton): B. E nennt auch Beton, behauptet aber, er sei billiger; der Text sagt, er ist ein Fünftel teurer. Text 2 (Theater im Depot): F. I teilt Straßenbahn, Sanierung und Stadtrand, meldet aber eine gekürzte Linie; im Text fährt die Linie neun bis vor die Tür. Text 3 (Aufstieg, größere Halle): J. C nennt ebenfalls den Handballverein, spricht aber von der Suche nach Trainerinnen. Text 4 (Mitentscheiden über Geld): H. A nennt Gemeinderat und Geld, meldet aber Kürzungen. Text 5 (Streichpreise): D. G nennt Onlineshops und Preise, meldet aber sinkende Preise für Elektrogeräte.",
  ),
  kurzA.choice(
    "detail",
    "MID",
    "Was kritisiert die Opposition in Text 4?",
    "Das bereitgestellte Geld reiche für spürbare Veränderungen nicht aus.",
    [
      "Die Abstimmung im Internet schließe viele ältere Einwohner aus.",
      "Der Gemeinderat habe den Beschluss ohne ausreichende Beratung gefasst.",
      "Die Einwohner bekämen zu wenig Zeit, um ihre Vorschläge einzureichen.",
    ],
    2,
    "„Die Opposition kritisierte, die Summe sei viel zu klein, um wirklich etwas zu bewegen.“ Zur Online-Abstimmung, zur Eile oder zur Frist für Vorschläge steht nichts im Text.",
  ),
];

// ---------------------------------------------------------------- Headline matching 2: environment, health, travel, technology, school meals

const rKurzB = a.text(
  "kurzmeldungen-umwelt",
  "Kurzmeldungen: Umwelt, Gesundheit, Verkehr",
  "Nachrichten: Umwelt und Alltag",
  `
Text 1
Der Wiesenbach in der Gemeinde Hohenau darf wieder Kurven machen: Auf drei Kilometern wurde das Betonbett entfernt, das Ufer abgeflacht und eine Auenlandschaft angelegt. Bei Starkregen kann sich das Wasser nun auf den Wiesen ausbreiten, statt die Keller im Ort zu überfluten. Schon im ersten Sommer kehrten Eisvögel zurück, und Biologen zählten zwölf Libellenarten. Die Kosten von 1,8 Millionen Euro trug zu 70 Prozent das Land. Auch Spaziergänger profitieren: Am Ufer entstand ein neuer Weg. Einige Landwirte klagen allerdings, dass sie dadurch Weideland verloren haben.

Text 2
Wer sich gegen Grippe impfen lassen möchte, muss dafür künftig nicht mehr zwingend zum Arzt. In mehr als hundert Apotheken des Landes darf ab Oktober geschultes Personal impfen. Die Krankenkassen übernehmen die Kosten für Menschen mit erhöhtem Risiko, alle anderen zahlen etwa 25 Euro selbst. Die Ärztekammer sieht das Angebot kritisch, weil Apotheken bei Notfällen schlechter vorbereitet seien als Praxen. Die Apothekerin Selma Öztürk hält das Verfahren dagegen für sicher: Alle Kunden müssten nach der Impfung eine Viertelstunde im Haus bleiben.

Text 3
Der Moorpfad im Nordwesten soll bis zum Frühjahr um vierzig Kilometer wachsen und dann erstmals zwei Landkreise verbinden. Entlang der neuen Strecke entstehen sechs einfache Hütten, die man online buchen kann; Verpflegung muss man selbst mitbringen. Die Tourismusverbände hoffen, dass dadurch auch außerhalb der Sommermonate mehr Gäste kommen. Naturschützer fordern allerdings, dass einzelne Abschnitte zwischen März und Juli gesperrt bleiben, weil dort seltene Vögel brüten. Eine Karte gibt es schon jetzt in den Touristeninformationen. Über die genaue Streckenführung entscheiden die Landkreise im Dezember.

Text 4
In Breitenau fährt seit Montag ein selbstfahrender Kleinbus zwischen dem Bahnhof und dem Neubaugebiet. Die Strecke ist 3,5 Kilometer lang und führt an Schule und Supermarkt vorbei. Im Bus finden acht Fahrgäste Platz; aus Sicherheitsgründen fährt eine Begleitperson mit, die jederzeit eingreifen kann. Das Fahrzeug fährt höchstens 15 Kilometer pro Stunde und bleibt stehen, sobald ein Hindernis auftaucht: Beim ersten Test genügte dafür schon ein Laubhaufen. Während des Probebetriebs ist die Fahrt kostenlos. Nach einem Jahr will der Kreis entscheiden, ob das Angebot dauerhaft eingerichtet wird.

Text 5
An den städtischen Grundschulen soll das Mittagessen ab dem neuen Schuljahr nicht mehr bei großen Lieferanten bestellt werden: Betroffen sind zwölf Schulen mit zusammen rund 3000 Kindern. Mindestens 40 Prozent der Zutaten müssen von Höfen im Umkreis von 50 Kilometern kommen. Zehn Landwirte haben sich dafür zu einer Genossenschaft zusammengeschlossen. Das Essen kostet pro Kind 20 Cent mehr, was die Stadt für die ersten zwei Jahre übernimmt. Die Elternvertretung begrüßt den Plan, wünscht sich aber, dass auch mehr vegetarische Gerichte auf den Speiseplan kommen.
`,
);
const kurzB = a.forText(rKurzB);
const kurzBItems = [
  kurzB.match(
    "gist",
    "HARD",
    "Lesen Sie die Texte 1 bis 5 und die Überschriften A bis J. Welche Überschrift passt zu welchem Text? Jede Überschrift passt nur einmal. Fünf Überschriften bleiben übrig.",
    ["Text 1", "Text 2", "Text 3", "Text 4", "Text 5"],
    [
      "A: Renaturierter Bach schützt vor Hochwasser und lockt Tiere an",
      "B: Hausärzte auf dem Land finden kaum Nachfolger",
      "C: Selbstfahrender Kleinbus wird ein Jahr lang erprobt",
      "D: Hochwasser überflutet Keller in drei Ortsteilen",
      "E: Schulmensa schließt wegen Personalmangels für eine Woche",
      "F: Fernwanderweg wächst und bekommt einfache Hütten",
      "G: Neue Buslinie verbindet Bahnhof und Neubaugebiet dauerhaft",
      "H: Grippeimpfung künftig auch in der Apotheke möglich",
      "I: Neue Übernachtungshütten am Alpenrand eröffnet",
      "J: Schulessen soll zu großen Teilen vom Hof in der Nähe kommen",
    ],
    [1, 8, 6, 3, 10],
    "Text 1 (Bach wird renaturiert): A. D teilt Hochwasser und Keller, meldet aber ein aktuelles Unglück; im Text verhindert der Bach es. Text 2 (Impfung in Apotheken): H. B nennt ebenfalls Ärzte, spricht aber von fehlenden Nachfolgern. Text 3 (Wanderweg wird länger): F. I teilt Hütten, nennt aber einen anderen Ort und eine Eröffnung. Text 4 (Probebetrieb des Kleinbusses): C. G teilt Bahnhof und Neubaugebiet, meldet aber eine dauerhafte Buslinie; im Text wird erst nach einem Jahr entschieden. Text 5 (regionale Zutaten im Schulessen): J. E nennt ebenfalls die Schulmensa, meldet aber eine Schließung.",
  ),
  kurzB.choice(
    "detail",
    "MID",
    "Welchen Einwand erhebt die Ärztekammer in Text 2?",
    "Bei einem Notfall sei man in der Apotheke schlechter versorgt als in der Praxis.",
    [
      "Das Impfen in Apotheken sei für die Patienten zu teuer geworden.",
      "Das Personal in den Apotheken sei für Impfungen nicht ausreichend geschult.",
      "Die Krankenkassen würden durch das neue Angebot zu stark belastet.",
    ],
    1,
    "„Die Ärztekammer sieht das Angebot kritisch, weil Apotheken bei Notfällen schlechter vorbereitet seien als Praxen.“ Das Personal ist laut Text geschult, die Kosten übernehmen die Kassen für Risikogruppen, andere zahlen etwa 25 Euro; von einer Belastung der Kassen ist keine Rede.",
  ),
];

// ---------------------------------------------------------------- Kommentare 1: Leih-E-Scooter ban

const rEscooter = a.text(
  "forum-escooter",
  "Forum: Leih-E-Scooter in der Innenstadt",
  "Verkehr: Leih-E-Scooter in der Innenstadt",
  `
Die Stadt Lindenau will Leih-E-Scooter in der gesamten Innenstadt verbieten. Sechs Leserinnen und Leser haben zu dem Vorschlag geschrieben.

Lena K.
Zwar nerven falsch geparkte Roller auch mich, aber ein Verbot halte ich für übertrieben. Ich fahre jeden Morgen mit dem Roller vom Bahnhof ins Büro, weil der Bus um diese Zeit nur alle halbe Stunde kommt. Ohne die Roller müsste ich wieder das Auto nehmen. Man sollte lieber feste Abstellflächen einrichten und Falschparker bestrafen, statt alle Nutzer auszuschließen.

Herr Weber
Ich bin eindeutig für das Verbot. Letzte Woche musste ich auf dem Marktplatz zur Seite springen, weil ein Roller mit gut zwanzig Kilometern pro Stunde an mir vorbeifuhr. Die Fußgängerzone ist zum Gehen da, nicht für Fahrzeuge. Außerdem liegen die Roller überall herum; mein Nachbar, der im Rollstuhl sitzt, kommt an manchen Ecken kaum noch durch. Wer wirklich ein Verkehrsmittel braucht, kann am Stadtrand umsteigen.

Jonas P.
Ich verstehe den Ärger nicht. Autos stehen auch ständig im Weg und sind viel gefährlicher, trotzdem redet niemand von einem Autoverbot. Die meisten Roller-Fahrer, die ich kenne, sind vernünftig. Wenn überhaupt, sollte die Stadt das Tempo in der Fußgängerzone auf zehn Kilometer pro Stunde begrenzen. Ein Verbot würde vor allem Touristen und Leute treffen, die kein Auto besitzen.

Frau Demir
Zwar benutze ich die Roller selbst gern im Urlaub, aber in unserer engen Innenstadt funktioniert das nicht. Die Gassen sind schmal, und gerade abends sind viele Leute unterwegs, die schnell fahren und kaum Rücksicht nehmen. Ich habe schon zweimal erlebt, dass zwei Fahrer gleichzeitig auf einem Roller standen. Solange sich die Regeln nicht kontrollieren lassen, unterstütze ich ein Verbot in der Innenstadt.

Frau Lindner
Meine Mutter ist sehbehindert und traut sich seit einem Jahr kaum noch allein in die Stadt, weil die Roller leise von hinten kommen und mitten auf dem Gehweg stehen. Die Betreiber verdienen Geld und überlassen der Stadt die Probleme. Deshalb wäre ein Verbot für mich die ehrlichste Lösung. Wer fahren will, hat immer noch Rad und Bus.

Emre S.
Ich arbeite im Einzelhandel in der Innenstadt, und viele Kunden kommen mit dem Roller zu uns, weil sie keinen Parkplatz finden. Ein Verbot würde uns Umsatz kosten. Die Stadt sollte lieber mit den Anbietern sprechen: Zonen, in denen man langsamer fährt oder gar nicht parken darf, lassen sich per App festlegen. So bleibt das Angebot erhalten, und die Gehwege werden frei.
`,
);
const escooter = a.forText(rEscooter);
const escooterItems = [
  escooter.yesNo(
    "attitude",
    "MID",
    [
      ["Lena K.", "F"],
      ["Herr Weber", "R"],
      ["Jonas P.", "F"],
      ["Frau Demir", "R"],
      ["Frau Lindner", "R"],
      ["Emre S.", "F"],
    ],
    "Lena K.: „Zwar ... aber ein Verbot halte ich für übertrieben“ (Nein). Herr Weber: „eindeutig für das Verbot“ (Ja). Jonas P.: schlägt ein Tempolimit vor, ein Verbot träfe die Falschen (Nein). Frau Demir: beginnt mit einem Zugeständnis („Zwar benutze ich die Roller selbst gern“), unterstützt aber das Verbot (Ja). Frau Lindner: „ein Verbot wäre die ehrlichste Lösung“ (Ja). Emre S.: möchte Zonen per App statt eines Verbots (Nein).",
    "Lesen Sie die Kommentare zum Thema „Leih-E-Scooter in der Innenstadt“. Ist die Person für ein Verbot? Kreuzen Sie Ja oder Nein an.",
  ),
  escooter.choice(
    "detail",
    "EASY",
    "Was hat Frau Demir nach eigener Aussage schon erlebt?",
    "Zwei Fahrer haben sich einen einzigen Roller geteilt.",
    [
      "Ein Roller ist ihr beinahe vor die Füße gefahren.",
      "Ein Fahrer hat sie auf dem Marktplatz unabsichtlich angerempelt.",
      "Ein abgestellter Roller blockierte den Eingang ihres Hauses.",
    ],
    3,
    "Frau Demir: „Ich habe schon zweimal erlebt, dass zwei Fahrer gleichzeitig auf einem Roller standen.“ Den Beinahe-Unfall auf dem Marktplatz schildert Herr Weber; die übrigen Erlebnisse stehen nirgends im Forum.",
  ),
];

// ---------------------------------------------------------------- Kommentare 2: compulsory social year

const rPflichtjahr = a.text(
  "forum-pflichtjahr",
  "Forum: Soziales Pflichtjahr für alle?",
  "Gesellschaft: soziales Pflichtjahr",
  `
Eine Zeitung fragt ihre Leserschaft: Sollen alle Menschen nach der Schule ein Jahr lang einen sozialen Dienst leisten, zum Beispiel in einem Pflegeheim oder einem Kindergarten? Sechs Antworten.

Frau Hartmann
Ich bin dafür. In Pflegeheimen und Kindergärten fehlen überall Leute, und ein verpflichtendes Jahr könnte das zumindest ein Stück weit lindern. Mein Sohn hat freiwillig ein soziales Jahr gemacht und kam als anderer Mensch zurück: reifer, selbstständiger und mit einer klaren Vorstellung davon, was er später machen will. Solche Erfahrungen sollten nicht vom Zufall abhängen, sondern allen offenstehen.

Tim B.
Ich halte nichts davon. Wer zu etwas gezwungen wird, macht es ohne Lust, und im Pflegeheim merkt man das sofort. Außerdem verlieren die Leute ein Jahr, in dem sie studieren oder Geld verdienen könnten. Ein Pflichtjahr löst das Personalproblem nicht, es verschiebt es nur. Die Politik soll lieber dafür sorgen, dass soziale Berufe besser bezahlt werden. Dann melden sich genug Leute von allein.

Herr Aksoy
Zwar finde ich soziales Engagement wichtig, aber eine Pflicht ist der falsche Weg. Ein Dienst, zu dem man verpflichtet wird, widerspricht dem Gedanken der Freiheit. Wer sich freiwillig meldet, bringt Lust und Ausdauer mit, und genau das brauchen kranke und alte Menschen. Besser wäre es, die vorhandenen Freiwilligendienste auszubauen und mit Vorteilen zu verbinden: Pluspunkte bei der Studienplatzvergabe, kostenlose Fahrkarten oder ein Zuschuss zum Führerschein.

Sabine R.
Für mich ist das eine Frage der Gerechtigkeit. Alle profitieren davon, dass sich andere um Kranke, Alte und Kinder kümmern, aber nur wenige tun es. Ein Pflichtjahr für alle, unabhängig vom Einkommen der Eltern oder vom Schulabschluss, würde die Gesellschaft zusammenbringen. Wichtig ist mir nur, dass der Dienst fair bezahlt wird, sonst können sich ihn nicht alle leisten.

Nora F.
Ich bin dagegen, weil ich Sorge habe, dass dadurch reguläre Stellen ersetzt werden. Wenn Pflichtdienstleistende die Arbeit übernehmen, muss kein Heim mehr gut bezahlte Fachkräfte einstellen. Für die Beschäftigten wäre das eine Verschlechterung. Die Heime müssten jedes Jahr neue Leute einarbeiten, und das kostet Zeit. Zudem lernt man wenig, wenn man nur Hilfsarbeiten erledigt. Freiwillige Dienste mit guter Betreuung sind für mich der bessere Weg.

Herr Neumann
Ich habe damals Zivildienst in einem Altenheim geleistet. Zwar war ich anfangs alles andere als begeistert, aber im Rückblick möchte ich dieses Jahr nicht missen. Es hat mir gezeigt, wie viel Geduld und Kraft Pflege braucht. Ich weiß, dass das Thema die Gemüter erhitzt, aber ohne Verbindlichkeit passiert in der Gesellschaft zu wenig. Deshalb würde ich eine neue Pflicht begrüßen, auch wenn sie anfangs auf Widerstand stößt.
`,
);
const pflichtjahr = a.forText(rPflichtjahr);
const pflichtjahrItems = [
  pflichtjahr.yesNo(
    "attitude",
    "HARD",
    [
      ["Frau Hartmann", "R"],
      ["Tim B.", "F"],
      ["Herr Aksoy", "F"],
      ["Sabine R.", "R"],
      ["Nora F.", "F"],
      ["Herr Neumann", "R"],
    ],
    "Frau Hartmann: „Ich bin dafür“ (Ja). Tim B.: „Ich halte nichts davon“ (Nein). Herr Aksoy: Das Zugeständnis („Zwar finde ich soziales Engagement wichtig“) führt zur Ablehnung der Pflicht, er will mehr Freiwilligendienste (Nein). Sabine R.: Gerechtigkeit, ein Pflichtjahr für alle (Ja). Nora F.: „Ich bin dagegen“, sie befürchtet den Ersatz regulärer Stellen (Nein). Herr Neumann: Auch er beginnt mit einem Zugeständnis („Zwar war ich anfangs alles andere als begeistert“), begrüßt aber eine neue Pflicht (Ja).",
    "Lesen Sie die Kommentare zum Thema „Soziales Pflichtjahr“. Ist die Person für ein verpflichtendes soziales Jahr? Kreuzen Sie Ja oder Nein an.",
  ),
  pflichtjahr.choice(
    "detail",
    "MID",
    "Welchen Vorschlag macht Herr Aksoy?",
    "Freiwillige Dienste ausbauen und mit Vergünstigungen belohnen.",
    [
      "Die Bezahlung in sozialen Berufen spürbar verbessern.",
      "Das Pflichtjahr auf wenige Monate verkürzen und besser bezahlen.",
      "Den Dienst nur von Menschen ohne Ausbildung verlangen.",
    ],
    2,
    "Herr Aksoy: „Besser wäre es, die vorhandenen Freiwilligendienste auszubauen und mit Vorteilen zu verbinden.“ Bessere Bezahlung fordert Tim B.; eine Beschränkung auf Studierende oder eine kürzere Pflicht schlägt niemand vor.",
  ),
];

// ================================================================ WRITING

const FORMAL = "formell (Sie)";
const LETTER = "neutral/sachlich (Leserbrief)";
const REPLY_WORDS: [number, number] = [100, 170];
const LETTER_WORDS: [number, number] = [120, 200];

const writingItems = [
  // (a) complaint on the basis of a short advert and four margin notes
  a.writing(
    "complaint",
    "MID",
    REPLY_WORDS,
    "Sie haben für Ihren Umzug eine Umzugsfirma beauftragt, die in einer Anzeige geworben hat. Leider ist nicht alles so gelaufen, wie versprochen. Lesen Sie die Anzeige und Ihre Notizen und schreiben Sie eine E-Mail an die Firma (ca. 120 Wörter).\n\n" +
      "Anzeige: „Kaiser Umzüge: Ihr Umzug zum Festpreis von 640 Euro! Unser Team ist pünktlich um 8 Uhr bei Ihnen, verpackt Ihre Möbel sorgfältig und ist in vier Stunden fertig. Alles versichert. Stornierung bis 48 Stunden vorher kostenlos.“\n\n" +
      "Ihre Notizen:\n" +
      "- Team erst um 10.15 Uhr gekommen\n" +
      "- Glasplatte vom Esstisch zerbrochen\n" +
      "- Umzug dauerte sieben Stunden, Zusatzrechnung über 190 Euro\n" +
      "- Anruf am nächsten Tag: niemand hat zurückgerufen\n\n" +
      "Gehen Sie auf alle vier Notizen ein und sagen Sie klar, was Sie jetzt von der Firma erwarten.",
    [
      "Bezug auf die Anzeige und den Auftrag (Festpreis, Pünktlichkeit, Versicherung)",
      "alle vier Mängel sachlich beschrieben (Verspätung, zerbrochene Glasplatte, Dauer und Zusatzrechnung, ausbleibender Rückruf)",
      "klare, höfliche Forderung mit Frist (z. B. Ersatz des Schadens, Rücknahme der Zusatzrechnung, Preisnachlass)",
      "formelle Anrede und Gruß, ruhiger Ton ohne Beleidigungen",
    ],
    [
      "sich auf die Anzeige beziehen",
      "alle vier Notizen aufgreifen",
      "sagen, was Sie von der Firma erwarten",
      "Anrede und Gruß",
    ],
    FORMAL,
    "Beschwerde auf der Grundlage einer Anzeige und von Randnotizen (Muster Schreiben 1). Bewertung: Erfüllung (alle vier Notizen aufgegriffen, Forderung genannt), Kohärenz, Wortschatz, Strukturen; Anrede und Gruß sind Pflicht. Weniger als die Hälfte der Wortzahl oder ein verfehltes Thema: Erfüllung E.",
  ),
  // (b) reply to a formal e-mail, with the answers given as margin notes
  a.writing(
    "reply",
    "MID",
    REPLY_WORDS,
    "Sie sind Vorsitzende oder Vorsitzender des Gartenvereins „Grüne Insel“. Eine Grundschule möchte Ihren Vereinsgarten besuchen und hat Ihnen eine E-Mail geschickt. Lesen Sie die E-Mail und Ihre Notizen und schreiben Sie die Antwort (ca. 120 Wörter).\n\n" +
      "E-Mail: „Sehr geehrte Damen und Herren, unsere Klasse 4b würde im Sachunterricht gern Ihren Gemeinschaftsgarten besichtigen. Könnten Sie uns bitte mitteilen, an welchen Tagen ein Besuch möglich wäre, wie viele Kinder Sie gleichzeitig betreuen können, ob Kosten entstehen und was wir mitbringen sollen? Wir freuen uns auf Ihre Antwort. Mit freundlichen Grüßen, Katrin Schneider, Grundschule Ahornstraße“\n\n" +
      "Ihre Notizen:\n" +
      "- Besuch nur dienstags oder donnerstags vormittags\n" +
      "- höchstens 25 Kinder, wegen der Sicherheit\n" +
      "- kostenlos, Spende für die Vereinskasse willkommen\n" +
      "- wetterfeste Kleidung und Brotzeit mitbringen, Toilette ist vorhanden\n\n" +
      "Beantworten Sie alle Punkte aus Ihren Notizen. Schreiben Sie eine formelle E-Mail mit Anrede und Gruß.",
    [
      "Dank für die Anfrage und Bezug auf den geplanten Besuch",
      "mögliche Besuchstage genannt (dienstags oder donnerstags, vormittags)",
      "Gruppengröße (höchstens 25 Kinder) mit Begründung (Sicherheit)",
      "Kosten: kostenlos, Spende willkommen",
      "was mitzubringen ist (wetterfeste Kleidung, Brotzeit); Toilette vorhanden",
      "formelle Anrede und Gruß",
    ],
    [
      "sich für die Anfrage bedanken",
      "die möglichen Besuchstage nennen",
      "die Gruppengröße begründen",
      "Kosten und Spende erwähnen",
      "sagen, was die Klasse mitbringen soll",
      "Anrede und Gruß",
    ],
    FORMAL,
    "Antwort auf eine formelle Anfrage; die Antworten stehen in den Notizen (Muster Schreiben 2). Bewertung: Erfüllung (alle vier Fragen beantwortet, Notizen in eigenen Worten), Kohärenz, Wortschatz, Strukturen; höfliche, formelle Wendungen (Konjunktiv II, Passiv) werden erwartet.",
  ),
  // (c) reader's letter on three numbered statements
  a.writing(
    "opinion",
    "HARD",
    LETTER_WORDS,
    "In einer Regionalzeitung lesen Sie unter der Überschrift „Frisch vom Feld oder aus dem Regal?“ drei Aussagen von Leserinnen und Lesern:\n\n" +
      "„1. Regionale Produkte sind gesünder und schmecken besser als Waren aus dem Supermarkt.“\n" +
      "„2. Wer regional einkaufen will, braucht mehr Zeit und mehr Geld, als die meisten Menschen haben.“\n" +
      "„3. Wochenmärkte sind für eine Innenstadt wichtiger als jedes Einkaufszentrum.“\n\n" +
      "Schreiben Sie einen Leserbrief (ca. 150 Wörter). Nehmen Sie zu allen drei Aussagen Stellung und schreiben Sie auch von Ihren eigenen Erfahrungen. Wie ist die Situation in Ihrer Stadt oder Region?\n\n" +
      "Schreiben Sie eine passende Einleitung und einen Schluss.",
    [
      "Stellung zu Aussage 1 (Gesundheit und Geschmack) mit Begründung",
      "Stellung zu Aussage 2 (Zeit und Kosten) mit Begründung",
      "Stellung zu Aussage 3 (Wochenmarkt und Innenstadt) mit Begründung",
      "eigene Erfahrungen beim Einkaufen",
      "Situation in der eigenen Stadt oder Region (Wochenmarkt, Hofläden, Einkaufszentren)",
      "Einleitung und Schluss",
    ],
    [
      "zur ersten Aussage Stellung nehmen",
      "zur zweiten Aussage Stellung nehmen",
      "zur dritten Aussage Stellung nehmen",
      "von eigenen Erfahrungen schreiben",
      "die Situation in Ihrer Stadt oder Region",
      "Einleitung und Schluss",
    ],
    LETTER,
    "Leserbrief zu drei Aussagen (Muster Schreiben, Leserbrief). Bewertung nach Erfüllung (alle drei Aussagen mit Begründung, eigene Erfahrung, Situation vor Ort), Kohärenz (Einleitung, Schluss, Verknüpfung), Wortschatz und Strukturen. Weniger als die Hälfte der Wortzahl oder Themaverfehlung: Erfüllung E, Aufgabe 0 Punkte.",
  ),
];

// ================================================================ SPEAKING

const NEGOTIATION = { thinkSeconds: 60, answerSeconds: 180, maxTakes: 1 };

const speakingItems = [
  a.speaking(
    "negotiation",
    "MID",
    NEGOTIATION,
    "Rollengespräch am Telefon. Vor fünf Wochen haben Sie in einem Elektromarkt eine neue Waschmaschine bestellt. Die Lieferung war für letzten Montag zugesagt, ist aber nicht gekommen. Ihre alte Maschine ist seit zwei Wochen kaputt. Sie haben deshalb eine E-Mail an den Kundenservice geschrieben. Frau Lang ruft Sie zurück und sagt:\n\n" +
      "„Guten Tag, hier ist Lang vom Elektromarkt Kramer. Ich rufe wegen Ihrer E-Mail zur Waschmaschine an. Leider liefert der Hersteller erst in drei Wochen nach. Ich kann Ihnen anbieten, die Bestellung zu stornieren, oder Sie warten bis dahin.“\n\n" +
      "- Schildern Sie Ihr Problem und erklären Sie, warum Sie nicht drei Wochen warten können.\n" +
      "- Lehnen Sie die beiden Vorschläge höflich ab und machen Sie einen eigenen Vorschlag.\n" +
      "- Einigen Sie sich mit Frau Lang auf eine Lösung und sagen Sie am Ende, was vereinbart ist.",
    [
      "Problem und Folgen klar geschildert (alte Maschine defekt, Wäsche, Alltag)",
      "beide Vorschläge höflich und mit Begründung abgelehnt",
      "eigener, realistischer Vorschlag (z. B. Leihgerät, Ersatzmodell, früherer Termin, Preisnachlass)",
      "auf Einwände der Partnerin eingegangen, Kompromiss gefunden",
      "Einigung am Ende zusammengefasst (Gerät, Termin, Preis)",
    ],
    [
      "Ihr Problem schildern",
      "die Vorschläge höflich ablehnen",
      "einen eigenen Vorschlag machen",
      "sich auf eine Lösung einigen",
      "am Ende zusammenfassen, was vereinbart ist",
    ],
    "Rollengespräch am Telefon mit Aushandeln einer Lösung (Muster Sprechen 3). Bewertung: Erfüllung (alle drei Aufgaben), Interaktion (auf die Partnerin eingehen, Vorschläge begründen), Register (Sie, Konjunktiv II), Wortschatz, Strukturen, Aussprache.",
    FORMAL,
  ),
];

// ================================================================ GRAMMAR

const grammarTexts = [
  // (a) formal letter, MC cloze, 11 gaps
  cloze("B2", "MID", {
    title: "Reklamation eines Staubsaugers",
    first:
      "Sehr geehrte Damen und Herren,\nwie ich Ihnen bereits am Telefon mitgeteilt habe, bin ich mit dem Staubsauger, den ich Anfang September bei Ihnen bestellt habe, nicht zufrieden.",
    body:
      "Ich habe [[mir|mich|sich|uns#reflexiv]] das Gerät vor allem wegen der starken Saugleistung gekauft. " +
      "Nachdem ich es [[ausgepackt|auszupacken|auspackte|auspacken#plusquamperfekt]] hatte, funktionierte es zunächst einwandfrei. " +
      "Schon nach drei Wochen ließ die Leistung jedoch spürbar nach, und inzwischen schaltet sich der Motor nach wenigen Minuten von selbst ab. " +
      "[[Aufgrund|Trotz|Anhand|Innerhalb#genitiv.praeposition]] dieses Mangels ist das Gerät für mich nicht mehr brauchbar. " +
      "Ich habe den Kundendienst zweimal angerufen. " +
      "[[Obwohl|Weil|Damit|Falls#konnektor.konzessiv]] man mir zugesagt hatte, dass sich ein Techniker bei mir meldet, habe ich bisher nichts gehört. " +
      "Meiner Einschätzung nach ist das Gerät nicht mehr zu [[reparieren|repariert|reparierend|reparierte#passiversatz]]. " +
      "Ich bestehe daher [[auf|an|bei|für#verb_praeposition]] einem [[einwandfreien|einwandfreie|einwandfreiem|einwandfreier#adjektivendung]] Ersatzgerät. " +
      "Das defekte Gerät schicke ich Ihnen gern zurück, [[um|damit|dass|ob#infinitiv.umzu]] Ihnen die Prüfung des Fehlers zu erleichtern. " +
      "[[Sollte|Wenn|Falls|Ob#konditional_inversion]] das Gerät nicht innerhalb von vierzehn Tagen ersetzt werden, werde ich den Kaufpreis zurückverlangen. " +
      "Ich bitte Sie außerdem, mir schriftlich [[mitzuteilen|mitteilen|mitgeteilt|mitzuteilt#trennbares_verb]], wohin ich das Gerät schicken soll. " +
      "Es enttäuscht mich, dass ausgerechnet eine Firma, [[deren|dessen|denen|der#relativsatz]] Werbung hohe Qualität verspricht, so wenig Interesse an ihren Kunden zeigt.",
    last: "Ich erwarte Ihre Antwort bis Ende des Monats.\nMit freundlichen Grüßen\nMarkus Lindner",
    note: "Reflexivpronomen im Dativ (g1), Plusquamperfekt nach nachdem (g2), Genitivpräposition aufgrund (g3), konzessiver Nebensatz mit obwohl (g4), Passiversatz sein + zu + Infinitiv (g5), bestehen auf (g6), Adjektivendung im Dativ nach ein-Wort (g7), um ... zu + Infinitiv (g8), Konditionalsatz ohne Konjunktion mit sollte (g9), zu-Infinitiv eines trennbaren Verbs (g10), Relativpronomen im Genitiv (g11).",
  }),
  // (b) "Anzeige und Antwort": advert and reply, 10 gaps and 5 spare words
  wordBank("B2", "HARD", {
    title: "Anmeldung zum Kochkurs",
    first:
      "Kochkurs „Italienisch für Anfänger“: Sechs Abende, jeweils donnerstags von 18 bis 21 Uhr in der Lehrküche der Volkshochschule Heidebach. Die Kursgebühr beträgt 96 Euro und enthält alle Zutaten. Anmeldung bis zum 15. Oktober per E-Mail bei Frau Heidemann.\nSehr geehrte Frau Heidemann,\nin der Zeitung bin ich auf Ihr Angebot aufmerksam geworden und möchte mich gern zu Ihrem Kochkurs anmelden.",
    body:
      "Ich interessiere mich schon lange [[für#verb_praeposition]] die italienische Küche, und das Programm gefällt mir sehr, [[zumal#konnektor]] die Volkshochschule bei mir um die Ecke liegt. " +
      "Leider arbeite ich donnerstags bis halb sieben, [[weshalb#konnektor]] ich frühestens um neunzehn Uhr bei Ihnen sein könnte. " +
      "[[Dennoch#konnektor.konzessiv]] würde ich den Kurs gern besuchen. " +
      "Ich möchte Sie deshalb [[darum#praepositionaladverb]] bitten, mir mitzuteilen, [[ob#nebensatz]] ein späterer Einstieg am ersten Abend möglich ist oder ob ich ihn ganz verpassen würde. " +
      "[[Sofern#konnektor]] ich bis Freitag eine Bestätigung erhalte, melde ich mich verbindlich an. " +
      "Da ich keine Nüsse vertrage, [[müsste#konjunktiv2.modal]] ich außerdem wissen, in welchen Gerichten sie vorkommen. " +
      "Ich verlasse mich [[darauf#praepositionaladverb]], dass Sie mich rechtzeitig informieren, und würde [[es#akkusativ]] sehr begrüßen, wenn ich vorab das Rezeptheft erhalten könnte.",
    last: "Ich danke Ihnen schon jetzt für Ihre Mühe.\nMit freundlichen Grüßen\nSabine Roth",
    distractors: ["dafür", "Obwohl", "musste", "über", "Daher"],
    note: "sich interessieren für (g1), zumal als zusätzlicher Grund (g2), weshalb als Folge (g3), Dennoch am Satzanfang (g4), bitten um mit darum (g5), ob im indirekten Fragesatz (g6), Sofern mit Verbendstellung (g7), müsste als Konjunktiv II des Modalverbs (g8), sich verlassen auf mit darauf (g9), es als Akkusativobjekt von begrüßen (g10).",
  }),
];

export const B2_MORE: LevelParts = {
  grammar: { stimuli: [], items: grammarTexts },
  reading: {
    stimuli: [rKurzA, rKurzB, rEscooter, rPflichtjahr],
    items: [...kurzAItems, ...kurzBItems, ...escooterItems, ...pflichtjahrItems],
  },
  listening: {
    stimuli: [lHotline, lBootstour, lFotowochenende],
    items: [...hotlineItems, ...bootstourItems, ...fotoItems],
  },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
