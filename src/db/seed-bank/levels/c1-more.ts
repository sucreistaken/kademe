import { authorFor, noParts, type LevelParts } from "../author";

/**
 * Round 3 additions to the C1 bank (formats from the model tests: see docs/research/formats-2026-10-25.md).
 * Built with the shared helpers in ../author.ts; the instruction lines come from ../instructions.ts.
 *
 * Added here:
 *  - listening: two "Angaben korrigieren" clips (a printed leaflet or programme is corrected by an announcement;
 *    typed table, one clip played once)
 *  - reading: two headline-matching sets (five news items, ten headlines of one domain)
 *  - writing: a formal reply built from the candidate's own shorthand notes, and a complaint letter
 *  - speaking: a phone call that apologises for a missed appointment and negotiates a make-up date
 */
const a = authorFor("C1");

// ---------------------------------------------------------------- LISTENING

// Clip 1: a transport announcement corrects a printed leaflet, played once.
const lErsatzbus = a.clip(
  "ersatzbus-faltblatt",
  "Ansage: Ersatzverkehr auf der Linie 8",
  "Verkehr und Stadt",
  [{ label: "Ansage", voice: "A" }],
  [
    "Ansage: Guten Tag, hier ist die Fahrgastinformation der Stadtwerke Weidenfeld. Es geht um den Ersatzverkehr auf der Linie acht. Im gedruckten Faltblatt stehen ein paar Angaben, die nicht mehr stimmen. Ich gehe sie kurz der Reihe nach durch.",
    "Ansage: Also, erstens die Dauer. Im Faltblatt steht zwei Wochen. Bei den Gleisarbeiten hat man aber einen Schaden an den Weichen entdeckt, mit dem niemand gerechnet hatte. Deshalb dauert der Ersatzverkehr jetzt drei Wochen.",
    "Ansage: Zweitens der Einstieg. Die Busse fahren nicht am Bahnhofsvorplatz ab, wie gedruckt, sondern am Marktplatz, weil der Vorplatz wegen eines Krans gesperrt ist. Der Takt bleibt übrigens, wie er ist: alle zehn Minuten.",
    "Ansage: Drittens die letzte Fahrt am Abend. Im Faltblatt steht dreiundzwanzig Uhr zehn, aber das stimmt nicht mehr. Der letzte Bus fährt schon um zweiundzwanzig Uhr fünfzig, nein, Moment, um zweiundzwanzig Uhr vierzig. Und noch zum Preis: Eine Einzelfahrt kostet weiter zwei Euro fünfzig, und Monatskarten gelten natürlich auch im Ersatzbus. Wir bitten um Ihr Verständnis.",
  ],
  1,
);

// Clip 2: an organiser corrects a printed festival programme, default plays.
const lHerbstfest = a.clip(
  "herbstfest-programm",
  "Durchsage: Herbstfest im Botanischen Garten",
  "Freizeit und Natur",
  [{ label: "Herr Winkler", voice: "B" }],
  [
    "Herr Winkler: Guten Morgen, liebe Gäste, und herzlich willkommen zum Herbstfest im Botanischen Garten Rosenau. Bevor es losgeht, muss ich einiges am gedruckten Programm richtigstellen. In der Nacht hat es nämlich heftig gestürmt, und deshalb ist manches anders als geplant.",
    "Herr Winkler: Die Eröffnung bleibt bei zehn Uhr, daran ändert sich nichts. Die Führung durch das Palmenhaus beginnt aber nicht am Haupteingang, sondern am Teehaus, denn am Haupteingang liegt noch ein dicker Ast quer auf dem Weg. Dem Palmenhaus selbst ist zum Glück nichts passiert.",
    "Herr Winkler: Der Vortrag über Bienen dauert nicht fünfundvierzig Minuten, sondern nur dreißig, weil die Referentin wegen der gesperrten Bahnstrecke früher los muss. Die Pflanzenbörse beginnt wie geplant um dreizehn Uhr.",
    "Herr Winkler: Die Kinderrallye ist kürzer, weil ein Teil des Geländes gesperrt ist, und kostet deshalb nur zwei Euro. Im Programm steht drei. Und zuletzt das Abschlusskonzert: Es beginnt nicht um sechzehn Uhr, sondern um siebzehn Uhr, nein, Entschuldigung, um halb sechs, weil das Orchester wegen der gesperrten Straßen später ankommt. Ich wiederhole: halb sechs. Kommen Sie gut durch den Tag!",
  ],
);

const ersatzbus = a.forClip(lErsatzbus);
const herbstfest = a.forClip(lHerbstfest);

const listeningItems = [
  ersatzbus.notes(
    "notes",
    "HARD",
    "Hören Sie die Ansage. Das gedruckte Faltblatt stimmt nicht mehr in allen Punkten. Tragen Sie in jede Zeile die richtige Angabe ein.\n\n" +
      "Angabe | Im Faltblatt | Richtig ist\n" +
      "Dauer des Ersatzverkehrs | 2 Wochen | {{g1}}\n" +
      "Abfahrt der Ersatzbusse | Bahnhofsvorplatz | {{g2}}\n" +
      "Takt | alle 10 Minuten | {{g3}}\n" +
      "Letzte Fahrt am Abend | 23.10 Uhr | {{g4}}\n" +
      "Preis einer Einzelfahrt | 2,50 Euro | {{g5}}",
    [
      ["3 Wochen", "drei Wochen", "3", "drei", "3 Wochen lang", "drei Wochen lang"],
      ["Marktplatz", "am Marktplatz", "Haltestelle Marktplatz", "an der Haltestelle Marktplatz"],
      ["alle 10 Minuten", "alle zehn Minuten", "10 Minuten", "zehn Minuten", "10", "zehn"],
      ["22:40", "22 Uhr 40", "zweiundzwanzig Uhr vierzig", "um zweiundzwanzig Uhr vierzig", "zwanzig vor elf"],
      ["2,50 Euro", "2,50", "2.50", "2,50 €", "2,50€", "2,5 Euro", "2 Euro 50", "zwei Euro fünfzig"],
    ],
    "Drei Zeilen ändern sich, zwei bleiben. g1 Dauer: „Im Faltblatt steht zwei Wochen ... jetzt drei Wochen“ (Schaden an den Weichen). g2 Einstieg: nicht Bahnhofsvorplatz (wegen eines Krans gesperrt), sondern Marktplatz. g3 Takt: unverändert, „alle zehn Minuten“; die Zeile wird ausdrücklich bestätigt. g4 letzte Fahrt: gedruckt dreiundzwanzig Uhr zehn, dann Selbstkorrektur „zweiundzwanzig Uhr fünfzig, nein, Moment, zweiundzwanzig Uhr vierzig“; richtig ist 22:40. g5 Preis: unverändert zwei Euro fünfzig. Uhrzeiten in Ziffern wertet das System in jeder Schreibweise, Uhrzeit und Preis in Worten sind aufgeführt.",
  ),
  ersatzbus.choice(
    "inference",
    "MID",
    "Was folgt aus der Ansage für Fahrgäste, die sich nur nach dem Faltblatt richten?",
    "Sie warten am falschen Ort und können am Abend den letzten Bus verpassen.",
    [
      "Sie zahlen für eine Fahrt mit dem Ersatzbus mehr, als im Faltblatt steht.",
      "Sie müssen länger auf den Bus warten, weil er seltener fährt als gedruckt.",
      "Sie können am Abend noch eine halbe Stunde länger zurückfahren, als gedruckt ist.",
    ],
    1,
    "Wer dem Faltblatt folgt, geht zum Bahnhofsvorplatz (gesperrt, der Einstieg ist am Marktplatz) und rechnet mit der letzten Fahrt um 23.10 Uhr, obwohl der letzte Bus schon um 22.40 Uhr fährt. Preis (zwei Euro fünfzig) und Takt (alle zehn Minuten) bleiben unverändert, deshalb stimmen die Aussagen zu höherem Preis und seltenerer Abfahrt nicht; der letzte Bus fährt früher, nicht später als gedruckt.",
  ),

  herbstfest.notes(
    "notes",
    "MID",
    "Hören Sie die Durchsage. Das gedruckte Programm stimmt nicht mehr in allen Punkten. Tragen Sie in jede Zeile die richtige Angabe ein.\n\n" +
      "Programmpunkt | Im Programm | Richtig ist\n" +
      "Eröffnung (Beginn) | 10 Uhr | {{g1}}\n" +
      "Führung durch das Palmenhaus (Treffpunkt) | Haupteingang | {{g2}}\n" +
      "Vortrag über Bienen (Dauer) | 45 Minuten | {{g3}}\n" +
      "Pflanzenbörse (Beginn) | 13 Uhr | {{g4}}\n" +
      "Kinderrallye (Teilnahmegebühr) | 3 Euro | {{g5}}\n" +
      "Abschlusskonzert (Beginn) | 16 Uhr | {{g6}}",
    [
      ["10 Uhr", "10", "zehn Uhr", "zehn", "um zehn Uhr", "um 10"],
      ["Teehaus", "am Teehaus", "beim Teehaus", "Tee-Haus", "am Tee-Haus"],
      ["30 Minuten", "30", "dreißig Minuten", "dreißig", "30 Min.", "eine halbe Stunde", "halbe Stunde"],
      ["13 Uhr", "13", "dreizehn Uhr", "dreizehn", "1 Uhr", "ein Uhr", "um 13 Uhr"],
      ["2 Euro", "2", "zwei Euro", "zwei", "2,00 Euro", "2 €", "2€"],
      ["17:30", "5:30", "halb sechs", "halb 6", "um halb sechs", "siebzehn Uhr dreißig", "17 Uhr dreißig"],
    ],
    "Vier Zeilen ändern sich, zwei bleiben. g1 Eröffnung: „bleibt bei zehn Uhr“, unverändert. g2 Treffpunkt: nicht Haupteingang (dort liegt ein Ast), sondern Teehaus. g3 Dauer des Vortrags: nicht fünfundvierzig, sondern dreißig Minuten. g4 Pflanzenbörse: „wie geplant um dreizehn Uhr“, unverändert. g5 Kinderrallye: „im Programm steht drei“, richtig sind zwei Euro. g6 Konzert: gedruckt sechzehn Uhr, dann „nicht um sechzehn Uhr, sondern um siebzehn Uhr, nein, Entschuldigung, um halb sechs“ und noch einmal „halb sechs“; richtig ist 17:30. Wer nur „siebzehn Uhr“ mitschreibt, hat die Selbstkorrektur überhört. Uhrzeiten in Ziffern wertet das System in jeder Schreibweise.",
  ),
  herbstfest.choice(
    "gist",
    "MID",
    "Wie erklärt der Sprecher die Änderungen im Programm?",
    "Ein Sturm in der Nacht hat im Garten und auf den Zufahrten für Hindernisse gesorgt.",
    [
      "Mehrere Mitwirkende haben kurzfristig abgesagt und mussten durch andere ersetzt werden.",
      "Die Gartenleitung musste das Programm wegen höherer Kosten für das Fest verkleinern.",
      "Der Förderverein hat das Programm nach Rückmeldungen früherer Gäste überarbeitet.",
    ],
    3,
    "Gleich zu Beginn: „In der Nacht hat es heftig gestürmt, und deshalb ist manches anders als geplant.“ Danach folgen Ast auf dem Weg, gesperrte Bahnstrecke, gesperrtes Gelände und gesperrte Straßen. Absagen, Kosten oder Gästewünsche nennt der Sprecher nicht.",
  ),
];

// ---------------------------------------------------------------- READING

const READING_MATCH_PROMPT =
  "Lesen Sie die Texte 1 bis 5 und die Überschriften A bis J. Welche Überschrift passt zu welchem Text? Jede Überschrift passt nur einmal. Fünf Überschriften bleiben übrig.";
const TEXTS = ["Text 1", "Text 2", "Text 3", "Text 4", "Text 5"];

// Headline set 1: science news (every headline is about research).
const rForschung = a.text(
  "kurzmeldungen-forschung",
  "Kurzmeldungen aus der Forschung",
  "Wissenschaft und Forschung",
  `
Kurzmeldungen aus der Forschung

Text 1
Gelbliches Licht macht Straßenlaternen für Nachtfalter deutlich weniger attraktiv. Zu diesem Ergebnis kommt ein Feldversuch, den ein Biologenteam zwei Sommer lang im Mühlbachtal durchgeführt hat. Entlang einer Landstraße tauschten die Forschenden abschnittsweise kaltweiße gegen gelbliche Leuchten aus und zählten regelmäßig die Insekten, die sich unter den Lampen sammelten. Unter dem gelblichen Licht waren es im Schnitt gut ein Drittel weniger als unter dem weißen. Als Grund vermuten die Forschenden, dass die Tiere vor allem auf den hohen Blauanteil im kaltweißen Licht reagieren. Die Autoren betonen jedoch, dass die Zählungen nur zeigen, wie viele Tiere angelockt werden, nicht aber, ob der Bestand insgesamt profitiert. Die Gemeinde will trotzdem alle Laternen an der Strecke umrüsten.

Text 2
Die Herstellung von Zement verursacht einen erheblichen Teil der Kohlendioxid-Emissionen im Bauwesen. Ein Materialforschungsinstitut hat nun eine Betonmischung vorgestellt, die beim Aushärten selbst Kohlendioxid aus der Luft aufnimmt. Möglich wird das durch einen Zusatz aus Industrieabfällen, der einen Teil des Zements ersetzt und das Material porenreicher macht. Im Labor banden kleine Probekörper binnen vier Wochen ungefähr so viel davon, wie bei ihrer Herstellung freigesetzt worden war. Ob sich das Ergebnis auf Bauteile in voller Größe übertragen lässt, ist bislang offen. Erste Versuche auf einer Baustelle sind für das kommende Jahr geplant. Mit einem Einsatz im Wohnungsbau rechnen die Entwickler frühestens in fünf Jahren; zuvor müsse sich die Haltbarkeit des Materials über Jahrzehnte erweisen.

Text 3
Ein internationales Forschungsteam hat im Nordatlantik einen bisher unbekannten Gebirgszug am Meeresboden entdeckt. Der Rücken ist rund vierhundert Kilometer lang und ragt an manchen Stellen mehr als zweitausend Meter aus der umgebenden Tiefsee-Ebene auf. Das Gebiet liegt abseits der Schifffahrtsrouten und wird kaum befahren, außerdem herrscht dort fast das ganze Jahr raue See. Aufgefallen ist der Gebirgszug den Forschenden, als ihr Schiff auf der Rückfahrt von einem anderen Einsatzgebiet den Grund mit Schallwellen abtastete. Von den Ozeanen ist bislang nur ein kleiner Teil so genau vermessen, weshalb die Beteiligten von einem Zufallsfund sprechen, der kaum der letzte seiner Art sein dürfte. Gesteinsproben sollen bei einer weiteren Fahrt im kommenden Jahr entnommen werden.

Text 4
Eine Fachzeitschrift für Ernährungswissenschaft hat eine Studie zurückgezogen, die vor zwei Jahren großes Aufsehen erregt hatte. Darin hieß es, regelmäßiger Kaffeegenuss verbessere die Merkfähigkeit deutlich. Mehrere Ratgeber hatten die Ergebnisse aufgegriffen und Kaffee als Lernhilfe empfohlen. Bei einer Nachprüfung fiel auf, dass die Daten einer Versuchsgruppe versehentlich doppelt in die Auswertung eingegangen waren, wodurch der Effekt größer erschien, als er tatsächlich ist. Die Hauptautorin spricht von einem Fehler beim Zusammenführen der Tabellen und hat den Rückzug selbst beantragt. Ob die Grundaussage dennoch zutrifft, ist ungewiss; eine neue Auswertung ist in Arbeit. Hinweise auf Betrug gebe es nicht, teilte die Zeitschrift mit. Künftig will sie von den Autoren die Rohdaten verlangen.

Text 5
Für Wetter- und Klimaberechnungen steht den Forschenden der Universität Brenau ab Januar ein neuer Hochleistungsrechner zur Verfügung. Das Gerät, das ein Landesprogramm mit mehr als vierzig Millionen Euro finanziert, soll etwa zehnmal so schnell rechnen wie sein Vorgänger und dabei weniger Strom verbrauchen. Möglich wird das unter anderem durch eine neuartige Wasserkühlung, deren Abwärme künftig auch das Nachbargebäude des Instituts heizt. Nötig geworden ist die Anschaffung, weil der bisherige Rechner nach zwölf Jahren Dauerbetrieb nur noch mit hohem Wartungsaufwand läuft. Bis zum Jahresende läuft der alte Rechner parallel weiter. Kritik kommt von einem Zusammenschluss kleinerer Arbeitsgruppen, der befürchtet, dass die Rechenzeit vor allem an Großprojekte vergeben wird.
`,
);
const forschung = a.forText(rForschung);

// Headline set 2: city planning news (every headline is about urban development).
const rStadt = a.text(
  "kurzmeldungen-stadtentwicklung",
  "Kurzmeldungen aus der Stadtentwicklung",
  "Stadtplanung und Verkehr",
  `
Kurzmeldungen aus der Stadtentwicklung

Text 1
Auf dem Radschnellweg zwischen Weidenfeld und Brenau können Pendlerinnen und Pendler seit dem Wochenende die ersten acht Kilometer nutzen. Die Strecke ist vier Meter breit, wird nachts beleuchtet und kreuzt befahrene Straßen nur noch an zwei Stellen, an denen Unterführungen gebaut wurden. Die Planer rechnen mit rund dreitausend Fahrten pro Tag, auch weil die Strecke an zwei Bahnhöfen vorbeiführt. Eröffnet wurde der Abschnitt ein halbes Jahr später als versprochen, weil bei den Bauarbeiten ein altes Wasserrohr auftauchte, das verlegt werden musste. Die restlichen sechzehn Kilometer sollen bis Ende nächsten Jahres folgen, sofern die beteiligten Gemeinden das Geld bereitstellen. Bis dahin müssen die Radfahrenden hinter dem fertigen Stück auf gewöhnliche Radwege ausweichen.

Text 2
Vor der Grundschule am Lindenhof bleibt die Straße ab Montag morgens für Autos gesperrt. Eine Elterninitiative hatte das seit Jahren gefordert. Von halb acht bis halb neun dürfen nur noch Anwohner mit Parkausweis einfahren. Die Stadt will damit das Gedränge der Elterntaxis entschärfen, das nach Angaben der Schulleitung wiederholt zu gefährlichen Situationen geführt hat. Der Versuch ist auf sechs Monate befristet und wird von Verkehrsplanern begleitet, die Zählungen und Befragungen auswerten. Danach entscheidet der Stadtrat, ob die Regel bleibt und ob sie auf weitere Schulen ausgedehnt wird. Im Elternbeirat ist das Echo geteilt: Einige begrüßen die Sperrung, andere fürchten längere Wege am Morgen.

Text 3
Im geplanten Wohnquartier am Alten Hafen soll Regenwasser nicht mehr in die Kanalisation abfließen, sondern vor Ort gespeichert werden. Vorgesehen sind Mulden zwischen den Häusern, begrünte Dächer und unterirdische Speicher, aus denen später die Grünflächen bewässert werden. Anlass sind die Überschwemmungen im Nachbarviertel, wo die Kanäle vor zwei Jahren einem Starkregen nicht standgehalten hatten. Das Konzept ist Teil eines Programms, mit dem die Stadt künftigen Überflutungen vorbeugen will. Die Mehrkosten gegenüber einer herkömmlichen Entwässerung beziffert die Stadt auf etwa fünf Prozent der Bausumme. Ob sich das Konzept auf bestehende Viertel übertragen lässt, sei offen, sagt der zuständige Planer: Dort fehle meist der Platz für Mulden und Speicher.

Text 4
Das seit drei Jahren leerstehende Kaufhaus am Marktplatz soll zum Stadtteilzentrum umgebaut werden. Die Eigentümerfamilie hatte das Haus zuletzt zum Verkauf angeboten, nachdem ein Möbelhaus als Mieter abgesprungen war. Der Stadtrat hat am Donnerstag beschlossen, das Gebäude zu kaufen und in den unteren Etagen eine Bibliothek, Werkstätten und einen Veranstaltungssaal einzurichten; in den oberen Geschossen sind Wohnungen vorgesehen. Die Kosten von rund zwölf Millionen Euro will die Stadt zur Hälfte mit Fördergeldern decken. Der Handelsverband äußerte Bedenken: Ohne Kaufhaus fehle den Geschäften in der Innenstadt womöglich die Laufkundschaft. Eine Bürgerinitiative, die sich seit Jahren für eine Nutzung des Hauses starkgemacht hat, begrüßt den Beschluss. Mit den Bauarbeiten soll frühestens im Herbst begonnen werden.

Text 5
Zum geplanten Bebauungsplan für das ehemalige Güterbahnhofsgelände können Bürgerinnen und Bürger noch bis Ende des Monats Stellung nehmen. Die Unterlagen liegen im Rathaus aus und stehen zusätzlich auf einer Online-Plattform, auf der sich Anmerkungen direkt in den Entwurf einzeichnen lassen und die schon von mehr als tausend Personen besucht wurde. Bisher sind etwa zweihundert Hinweise eingegangen, die meisten zur Frage, wie viel Grün zwischen den geplanten Häusern erhalten bleibt. Besonders strittig sind die fünfgeschossigen Gebäude entlang der Gleise, die einigen Anwohnern zu hoch erscheinen. Die Verwaltung will die Stellungnahmen auswerten und im Frühjahr einen überarbeiteten Entwurf vorlegen. Eine Verlängerung der Frist, wie sie ein Bürgerverein gefordert hat, lehnt sie ab.
`,
);
const stadt = a.forText(rStadt);

const readingItems = [
  forschung.match(
    "gist",
    "HARD",
    READING_MATCH_PROMPT,
    TEXTS,
    [
      "A: Gefälschte Daten: Zeitschrift zieht Kaffeestudie zurück",
      "B: Neuer Hochleistungsrechner rechnet schneller und heizt nebenbei ein Nachbargebäude",
      "C: Beton nimmt CO2 auf: Labortest bestanden, Praxistest steht noch aus",
      "D: Weißes Straßenlicht gefährdet Insekten in ganz Europa",
      "E: Meeresboden weltweit in hoher Auflösung kartiert",
      "F: Zufallsfund in der Tiefsee: Unbekannter Gebirgszug vermessen",
      "G: Klimafreundlicher Beton ist schon im Wohnungsbau angekommen",
      "H: Gelbliches Licht zieht weniger Nachtfalter an als weißes",
      "I: Fehler in der Auswertung: Zeitschrift zieht Kaffeestudie zurück",
      "J: Neuer Hochleistungsrechner verbraucht doppelt so viel Strom wie sein Vorgänger",
    ],
    [8, 3, 6, 9, 2],
    "Text 1 gehört zu H: Der Versuch gilt einem Tal (D behauptet Europa) und einer Wirkung auf die Zahl der angelockten Falter, nicht auf den Bestand. Text 2 gehört zu C: Der Beton hat nur den Labortest bestanden, ein Einsatz im Wohnungsbau ist frühestens in fünf Jahren denkbar (G meldet ihn als Tatsache). Text 3 gehört zu F: Ein einzelner Gebirgszug wurde zufällig entdeckt, von den Ozeanen ist nur ein kleiner Teil genau vermessen (E behauptet das Gegenteil). Text 4 gehört zu I: Ursache ist ein Fehler beim Zusammenführen der Daten, Betrug schließt die Zeitschrift aus (A nennt Fälschung als Grund). Text 5 gehört zu B: Der Rechner soll schneller sein und weniger Strom brauchen, die Abwärme heizt ein Gebäude (J behauptet mehr Verbrauch). Die fünf übrigen Überschriften stehen jeweils zu einem Text in einem Gegensatz von Reichweite, Zeitstufe, Ursache oder Wirkung.",
  ),
  forschung.choice(
    "inference",
    "MID",
    "Was lässt sich aus Text 4 über das Verhalten der Hauptautorin schließen?",
    "Sie ist offen mit dem Fehler umgegangen und hat den Rückzug der Studie selbst angeregt.",
    [
      "Sie hat die Daten mit Absicht doppelt verwendet, damit der Effekt größer wirkt.",
      "Sie hat die Studie inzwischen mit bereinigten Daten wiederholt und das Ergebnis bestätigt.",
      "Sie hat den Fehler zunächst bestritten und erst auf Druck der Zeitschrift nachgegeben.",
    ],
    0,
    "Die Hauptautorin spricht von einem Fehler beim Zusammenführen der Tabellen und „hat den Rückzug selbst beantragt“. Absicht schließt die Zeitschrift aus („Hinweise auf Betrug gebe es nicht“), die neue Auswertung ist noch „in Arbeit“, und von Druck oder Bestreiten steht nichts im Text.",
  ),

  stadt.match(
    "gist",
    "MID",
    READING_MATCH_PROMPT,
    TEXTS,
    [
      "A: Neues Quartier soll Regenwasser speichern statt ableiten",
      "B: Stadt sperrt alle Straßen vor Schulen dauerhaft für Autos",
      "C: Kaufhäuser in Deutschland stehen immer häufiger leer",
      "D: Erste Etappe des Radschnellwegs ist freigegeben",
      "E: Bau des Radschnellwegs soll im Frühjahr beginnen",
      "F: Starkregen überflutet Nachbarviertel: Kanäle halten nicht stand",
      "G: Bebauungsplan: Stellungnahmen noch bis Monatsende möglich",
      "H: Nach Protesten zieht die Stadt den Bebauungsplan zurück",
      "I: Probe aufs Exempel: Schulstraße morgens für Autos gesperrt",
      "J: Leeres Kaufhaus soll Treffpunkt für den Stadtteil werden",
    ],
    [4, 9, 1, 10, 7],
    "Text 1 gehört zu D: Die ersten acht Kilometer sind bereits eröffnet (E kündigt einen Baubeginn an). Text 2 gehört zu I: Eine einzelne Schule, befristet auf sechs Monate (B behauptet alle Schulen und dauerhaft). Text 3 gehört zu A: Es geht um das Konzept für ein geplantes Quartier; die Überschwemmung vor zwei Jahren ist nur der Anlass (F macht sie zur aktuellen Meldung). Text 4 gehört zu J: Ein bestimmtes Kaufhaus wird umgebaut (C beschreibt einen allgemeinen Trend). Text 5 gehört zu G: Die Frist läuft noch, der Plan wird überarbeitet, nicht zurückgezogen (H nennt eine Folge, die der Text nicht erwähnt). Die fünf übrigen Überschriften stehen jeweils zu einem Text in einem Gegensatz von Reichweite, Zeitstufe, Ursache oder Wirkung.",
  ),
  stadt.choice(
    "inference",
    "MID",
    "Was lässt sich aus Text 2 über die Zukunft der Sperrung schließen?",
    "Ob sie bleibt, hängt von den Ergebnissen der sechsmonatigen Testphase ab.",
    [
      "Sie wird nach den sechs Monaten auf alle Schulen der Stadt ausgeweitet.",
      "Sie endet nach sechs Monaten automatisch, weil sie nur befristet genehmigt ist.",
      "Der Elternbeirat entscheidet nach der Testphase über ihr weiteres Schicksal.",
    ],
    2,
    "Der Versuch ist auf sechs Monate befristet und wird ausgewertet; „danach entscheidet der Stadtrat, ob die Regel bleibt“. Eine Ausweitung steht erst zur Diskussion, ein automatisches Ende ist nicht vorgesehen, und der Elternbeirat hat nur ein geteiltes Echo, aber kein Entscheidungsrecht.",
  ),
];

// ---------------------------------------------------------------- WRITING

const LETTER_WORDS: [number, number] = [125, 200];
const REPLY_NOTE =
  "Antwort auf eine formelle E-Mail, aus eigenen Stichwortnotizen entwickelt (nach dem Muster der Briefaufgaben der C1-Prüfungen). Bewertet werden Aufgabenerfüllung (alle Notizen, ein klares Anliegen trotz eigenen Fehlers), der Registerwechsel von knappen Stichworten zu höflichem, formellem Deutsch (Anrede, Gruß, höfliche Bitten, Konjunktiv II), Kohärenz sowie Wortschatz und Strukturen.";
const COMPLAINT_NOTE =
  "Beschwerdebrief auf der Grundlage eines Angebots und von vier Notizen (nach dem Muster der Briefaufgaben der C1-Prüfungen). Bewertet werden Aufgabenerfüllung (alle vier Mängel, konkrete Forderung, Frist), sachlicher und bestimmter Ton ohne Schärfe, Register (Anrede, Gruß, Konjunktiv II bei der Forderung), Kohärenz sowie Wortschatz und Strukturen.";

const writingItems = [
  a.writing(
    "reply",
    "HARD",
    LETTER_WORDS,
    "Sie haben bei einem Verleih ein Lastenrad für das Wochenende gemietet und am Montag zurückgebracht. Zwei Tage später erhalten Sie diese E-Mail:\n\n" +
      "„Betreff: Lastenrad Nr. 14, Schäden bei der Rückgabe\n\n" +
      "Sehr geehrte Mieterin, sehr geehrter Mieter,\n\n" +
      "bei der Rückgabe des Lastenrads Nr. 14 haben wir am Frontkorb eine Verbiegung und am Rücklicht einen Bruch festgestellt. Gemäß Ziffer 7 unserer Mietbedingungen behalten wir Ihre Kaution von 150 Euro daher vollständig ein, bis die Reparaturkosten feststehen. Ihre Buchung für den 22. November können wir erst bestätigen, wenn der Vorgang geklärt ist. Sollten Sie Einwände haben, bitten wir um eine schriftliche Stellungnahme bis zum 14. November.\n\n" +
      "Mit freundlichen Grüßen\nJonas Meyer\nRadwerk Weidenfeld“\n\n" +
      "Am Rand der E-Mail haben Sie sich schnell Stichworte gemacht:\n" +
      "- Schaden: ja, mein Fehler (Sturz, nasses Laub)\n" +
      "- Rücklicht: schon vorher locker?\n" +
      "- Reparatur zahle ich, aber Rechnung zeigen\n" +
      "- Kaution: Rest zurück, nicht alles einbehalten\n" +
      "- Buchung 22.11. unbedingt behalten (Umzug)\n\n" +
      "Schreiben Sie die Antwort an den Verleih (ca. 150 Wörter). Machen Sie aus den Stichworten einen höflichen, formellen Text und gehen Sie auf jeden Punkt ein.",
    [
      "räumt den Schaden an Korb und Rücklicht sachlich ein und entschuldigt sich knapp, ohne sich lange zu rechtfertigen; nennt den Grund (Sturz bei Nässe)",
      "weist höflich darauf hin, dass das Rücklicht schon vorher locker gewesen sein könnte, und bittet um Prüfung, ohne den Verleih zu beschuldigen",
      "erklärt sich bereit, die tatsächlichen Reparaturkosten zu übernehmen, und bittet um die Rechnung der Werkstatt als Beleg",
      "bittet darum, nur die Reparaturkosten von der Kaution abzuziehen und den Rest zurückzuzahlen",
      "bittet darum, die Buchung für den 22. November trotz des Vorfalls zu bestätigen, und nennt den Grund (Umzug)",
      "formelle Anrede und Schlussformel; aus den Stichworten werden vollständige, höflich abgetönte Sätze (Konjunktiv II, Bitte statt Forderung)",
    ],
    [
      "den Schaden eingestehen",
      "Ihre Zahlungsbereitschaft erklären",
      "um einen Beleg der Werkstatt bitten",
      "den Rest der Kaution zurückverlangen",
      "die Buchung für den Umzug sichern",
      "höfliche Sätze statt Stichworte",
    ],
    "formell (Sie), höflich-sachlich; vom knappen Stichwort zu vollständigen, höflich abgetönten Sätzen",
    REPLY_NOTE,
  ),
  a.writing(
    "complaint",
    "MID",
    LETTER_WORDS,
    "Sie haben für eine Familienfeier bei einem Partyservice ein Buffet bestellt. Das Angebot lautete:\n\n" +
      "„Angebot Nr. 2291, Festbuffet für 40 Personen: Lieferung und Aufbau am Samstag um 17 Uhr, drei warme Hauptgerichte, Salate und Dessert, Geschirr und Besteck inklusive. Gesamtpreis 1.240 Euro, zahlbar nach der Lieferung.“\n\n" +
      "Bei der Feier ist Ihnen Folgendes aufgefallen:\n" +
      "- Lieferung erst um 19.15 Uhr, die Gäste mussten warten\n" +
      "- nur zwei warme Hauptgerichte\n" +
      "- Geschirr: Pappteller statt Porzellan\n" +
      "- Essen nur lauwarm\n\n" +
      "Sie haben die Rechnung noch nicht bezahlt. Schreiben Sie einen Beschwerdebrief an den Partyservice (ca. 150 Wörter). Beschreiben Sie die Mängel sachlich, stellen Sie eine klare Forderung und setzen Sie eine Frist.",
    [
      "bezieht sich auf das Angebot (Nummer, Feier am Samstag) und stellt klar, dass die Rechnung noch offen ist",
      "nennt alle vier Mängel sachlich und im Vergleich mit dem Angebot: späte Lieferung, ein Hauptgericht fehlt, Pappteller statt Geschirr, lauwarmes Essen",
      "schildert knapp die Folgen für die Feier, ohne zu übertreiben",
      "stellt eine konkrete Forderung (Preisminderung mit Betrag oder Anteil, begründet) und setzt eine Frist mit Datum",
      "kündigt an, was sonst geschieht (zum Beispiel Kürzung der Zahlung oder Einschaltung der Verbraucherzentrale); formelle Anrede, bestimmter, aber höflicher Ton, Schlussformel",
    ],
    [
      "sich auf das Angebot beziehen",
      "die vier Mängel sachlich schildern",
      "eine konkrete Forderung stellen",
      "eine Frist setzen und Folgen nennen",
      "Anrede und Schlussformel",
    ],
    "formell (Sie), bestimmt-sachlich; höflicher Ton trotz berechtigter Kritik",
    COMPLAINT_NOTE,
  ),
];

// ---------------------------------------------------------------- SPEAKING

const NEGOTIATION = { thinkSeconds: 120, answerSeconds: 180, maxTakes: 1 };

const speakingItems = [
  a.speaking(
    "negotiation",
    "MID",
    NEGOTIATION,
    "Sie haben vor einigen Tagen einen Termin in einer Physiotherapiepraxis verpasst, weil Ihr Zug ausgefallen ist und Sie nicht mehr rechtzeitig anrufen konnten. Sie rufen jetzt in der Praxis an. Die Mitarbeiterin ist freundlich, aber zunächst zurückhaltend. Sie sagt:\n\n" +
      "„Der Termin war für Sie reserviert, und wir haben die Zeit freigehalten. Normalerweise berechnen wir bei einer Absage am selben Tag vierzig Euro. Und neue Termine sind knapp: In den nächsten zwei Wochen habe ich nur noch Dienstag um halb acht frei.“\n\n" +
      "Wenn Sie Ihre Gründe überzeugend erklären, zeigt sie sich kompromissbereit, möchte die Gebühr aber nicht ohne Begründung streichen. Sprechen Sie etwa drei Minuten, als wären Sie am Telefon:\n" +
      "- Entschuldigen Sie sich und erklären Sie kurz, was passiert ist.\n" +
      "- Bitten Sie darum, die Gebühr zu erlassen oder zu senken, und begründen Sie Ihre Bitte.\n" +
      "- Handeln Sie einen neuen Termin aus: Der Dienstagtermin passt Ihnen nicht, schlagen Sie eine Alternative vor.",
    [
      "beginnt mit einer Begrüßung, nennt den Anlass des Anrufs und entschuldigt sich glaubhaft; erklärt den Zugausfall knapp",
      "bittet begründet um Erlass oder Senkung der Gebühr (zum Beispiel Umstände außerhalb der eigenen Kontrolle, bisherige Zuverlässigkeit) und bleibt dabei höflich",
      "geht auf die Einwände der Mitarbeiterin ein (reservierte Zeit, knappe Termine), statt nur die Bitte zu wiederholen",
      "begründet, warum der Dienstagtermin nicht passt, schlägt eine realistische Alternative vor und einigt sich auf einen Termin",
      "Telefonstil: höfliche Bitten im Konjunktiv II, Bestätigung des vereinbarten Termins, Verabschiedung",
    ],
    [
      "sich entschuldigen und den Grund nennen",
      "um Entgegenkommen bei der Gebühr bitten",
      "auf die Einwände der Mitarbeiterin eingehen",
      "einen neuen Termin aushandeln",
      "das Gespräch höflich beenden",
    ],
    "Telefonische Aushandlung als aufgezeichneter Gesprächsbeitrag; die Reaktionen der Gesprächspartnerin stehen in der Aufgabe, nach dem Muster der Interaktionsaufgaben der C1-Sprechprüfungen. Bewertet werden Aufgabenerfüllung (alle drei Punkte, Eingehen auf die Reaktionen), Register (höflich, Konjunktiv II), Flüssigkeit, Wortschatz, Strukturen und Aussprache.",
    "formell (Sie), höflich; Telefongespräch mit Entschuldigung, Bitte und Kompromissvorschlag",
  ),
];

export const C1_MORE: LevelParts = {
  ...noParts(),
  reading: { stimuli: [rForschung, rStadt], items: readingItems },
  listening: { stimuli: [lErsatzbus, lHerbstfest], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
  speaking: { stimuli: [], items: speakingItems },
};
