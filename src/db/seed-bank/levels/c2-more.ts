import { authorFor, noParts, type LevelParts } from "../author";

/**
 * Round 3 additions to the C2 bank (formats from the model tests: see docs/research/formats-2026-10-25.md).
 * Built with the shared helpers in ../author.ts; the instruction lines come from ../instructions.ts.
 *
 * - Listening: two "Angaben korrigieren" clips (a printed programme is corrected, played once, typed table).
 * - Reading: two essay-style texts (artificial light at night; repair cafes).
 * - Writing: a data task with a table and a fact-sheet task (press release).
 * - Grammar: four single items (rektion, konzessiv, paraphrase, konjunktiv_i).
 */
const a = authorFor("C2");

// ------------------------------------------------------------------ listening

const lLiteratur = a.clip(
  "literaturtage-aenderungen",
  "Durchsage: Änderungen im Programm der Literaturtage",
  "Kultur, Literaturfest",
  [{ label: "Festivalleiterin", voice: "A" }],
  [
    "Festivalleiterin: Guten Morgen, liebe Gäste der Literaturtage Hallenfeld. Das gedruckte Programm stimmt leider nicht mehr in allen Punkten, deshalb sage ich Ihnen kurz, was sich geändert hat. Am besten schreiben Sie mit.",
    "Festivalleiterin: Die Eröffnung im Foyer bleibt, wie sie ist, also um zehn Uhr. Dann zur Lesung von Katharina Brenner. Die war nach zwei Tagen ausgebucht, und, na ja, damit hatten wir ehrlich gesagt nicht gerechnet. Wir wechseln deshalb den Raum: nicht mehr Saal zwei, sondern Saal drei, nein, Entschuldigung, Saal vier. Da passen doppelt so viele Leute hinein.",
    "Festivalleiterin: Für den Schreibworkshop am Samstag, der jetzt nicht mehr um vierzehn Uhr, sondern erst um fünfzehn Uhr beginnt, können Sie sich noch bis Freitag am Infotisch anmelden. Die Leiterin kommt nämlich mit einem späteren Zug an.",
    "Festivalleiterin: Die Abendlesung fängt eine halbe Stunde später an als gedruckt, damit nach dem Podiumsgespräch genug Zeit zum Umbauen bleibt. Und bitte merken Sie sich noch den Eintritt zur Abendlesung. Weil die Stadthalle ihre Saalmiete angehoben hat, beträgt er nicht mehr zwölf, sondern vierzehn Euro. Wer schon eine Karte hat, muss aber nichts nachzahlen.",
    "Festivalleiterin: Alles, was ich nicht erwähnt habe, findet wie gedruckt statt. Ich danke Ihnen und wünsche Ihnen schöne Tage bei uns.",
  ],
  1,
);

const lBuerger = a.clip(
  "buergerwerkstatt-hochwasser",
  "Nachricht: Änderungen zur Bürgerwerkstatt Hochwasserschutz",
  "Stadt, Bürgerbeteiligung",
  [{ label: "Reimers", voice: "B" }],
  [
    "Reimers: Guten Tag, hier spricht Jonas Reimers vom Bürgerbüro Rosenhain. Zur Bürgerwerkstatt über den Hochwasserschutz am Mühlbach gibt es ein paar Änderungen gegenüber dem Programm, das Sie per Post bekommen haben. Ich gehe sie der Reihe nach durch.",
    "Reimers: Der Informationsmarkt öffnet früher als gedruckt, nämlich nicht um halb sechs, sondern schon um siebzehn Uhr, weil zwei Fachleute vom Wasserverband eher kommen können.",
    "Reimers: Bitte denken Sie an festes Schuhwerk, denn der Rundgang am Mühlbach, der nicht mehr an der Mühlenbrücke, sondern am Sportplatz beginnt, führt über unbefestigte Wege. Die Brücke wird ja gerade saniert. Den Vortrag der Gutachterin hören Sie wie angekündigt im Bürgersaal, da ändert sich nichts.",
    "Reimers: Wir hatten mit etwa achtzig Anmeldungen gerechnet, jetzt sind es über zweihundert. Das freut uns natürlich sehr, auch wenn es uns organisatorisch einiges abverlangt. Deshalb arbeiten wir in den Arbeitsgruppen nicht wie geplant in vier Gruppen, sondern in sechs, nein, Moment, in fünf Gruppen. Sechs Räume haben wir gar nicht.",
    "Reimers: Wir hatten kurz überlegt, die Fragerunde auf sechzig Minuten zu verlängern. Davon sind wir aber wieder abgekommen, sonst bleibt für die Arbeitsgruppen zu wenig Zeit. Es bleibt also bei fünfundvierzig Minuten.",
    "Reimers: Und noch etwas zur Anmeldung: Wer noch dabei sein möchte, kann sich, weil wir die Frist verlängert haben, nicht nur bis Mittwoch, sondern noch bis Freitag anmelden, telefonisch oder online. Vielen Dank, wir sehen uns.",
  ],
  1,
);

const literatur = a.forClip(lLiteratur);
const buerger = a.forClip(lBuerger);

const listeningItems = [
  literatur.notes(
    "notes",
    "HARD",
    "Hören Sie die Durchsage. Das gedruckte Programm stimmt nicht mehr in allen Punkten. Tragen Sie in jede Zeile die richtige Angabe ein.\n\n" +
      "Veranstaltung | Im Programm | Richtig ist\n" +
      "Eröffnung im Foyer | 10 Uhr | {{g1}}\n" +
      "Lesung Katharina Brenner | Saal 2 | {{g2}}\n" +
      "Schreibworkshop | 14 Uhr | {{g3}}\n" +
      "Podiumsgespräch | Lesesaal | {{g4}}\n" +
      "Abendlesung, Beginn | 19.30 Uhr | {{g5}}\n" +
      "Eintritt zur Abendlesung | 12 Euro | {{g6}}",
    [
      ["10 Uhr", "10", "zehn Uhr", "zehn", "um zehn Uhr", "um zehn"],
      ["Saal 4", "Saal vier", "im Saal 4", "im Saal vier", "in Saal 4", "in Saal vier", "4", "vier"],
      ["15 Uhr", "15", "fünfzehn Uhr", "fünfzehn", "um fünfzehn Uhr", "um fünfzehn", "3 Uhr", "drei Uhr", "um drei Uhr", "um drei"],
      ["Lesesaal", "im Lesesaal", "der Lesesaal"],
      ["20 Uhr", "20", "zwanzig Uhr", "zwanzig", "um zwanzig Uhr", "um zwanzig", "8 Uhr", "acht Uhr", "um acht Uhr", "um acht"],
      ["14 Euro", "14", "14 €", "14,00 Euro", "14,00 €", "14,00", "14,- Euro", "14 EUR", "EUR 14", "vierzehn Euro", "vierzehn"],
    ],
    "Zeile 1: Die Eröffnung \"bleibt, wie sie ist\", also unverändert um zehn Uhr. Zeile 2: Saal vier; die Sprecherin korrigiert sich unterwegs (\"Saal drei, nein, Entschuldigung, Saal vier\"), Saal zwei ist der gedruckte Wert. Zeile 3: Die Änderung steht im Relativsatz (\"der jetzt nicht mehr um vierzehn Uhr, sondern erst um fünfzehn Uhr beginnt\"); der Hauptsatz nennt nur die Anmeldung bis Freitag. Zeile 4: Zum Podiumsgespräch wird keine Änderung genannt (es kommt nur als Zeitpunkt für das Umbauen vor), und \"alles, was ich nicht erwähnt habe, findet wie gedruckt statt\"; die Antwort wiederholt den gedruckten Raum. Zeile 5: \"eine halbe Stunde später als gedruckt\" ergibt aus 19.30 Uhr zwanzig Uhr; die Uhrzeit wird nicht genannt. Zeile 6: Der neue Preis steht in einem eigenen Satz nach der Begründung (\"nicht mehr zwölf, sondern vierzehn Euro\"). Uhrzeiten in Ziffern werden in jeder Schreibweise akzeptiert, Zahlen und Beträge in Wörtern sind in der Liste aufgeführt.",
  ),
  literatur.choice(
    "inference",
    "MID",
    "Was lässt sich der Durchsage über die Lesung von Katharina Brenner entnehmen?",
    "Das Interesse an der Lesung war deutlich größer, als die Veranstalter vermutet hatten.",
    [
      "Die Autorin hat kurzfristig einen längeren Vortrag angekündigt, der mehr Platz braucht.",
      "Der ursprünglich vorgesehene Saal ist wegen eines Defekts nicht mehr nutzbar.",
      "Die Lesung findet jetzt am Abend statt, weil viele Gäste tagsüber keine Zeit haben.",
    ],
    1,
    "Die Lesung war \"nach zwei Tagen ausgebucht\", und die Sprecherin räumt ein: \"damit hatten wir ehrlich gesagt nicht gerechnet\"; der größere Saal soll \"doppelt so viele Leute\" fassen. Daraus folgt, dass die Veranstalter die Nachfrage unterschätzt hatten. Ein längerer Vortrag, ein Defekt und eine Verlegung in den Abend werden nicht erwähnt (die Abendlesung ist eine andere Veranstaltung).",
  ),

  buerger.notes(
    "notes",
    "HARD",
    "Hören Sie die Nachricht. Das gedruckte Programm stimmt nicht mehr in allen Punkten. Tragen Sie in jede Zeile die richtige Angabe ein.\n\n" +
      "Programmpunkt | Im Programm | Richtig ist\n" +
      "Informationsmarkt, Beginn | 17.30 Uhr | {{g1}}\n" +
      "Vortrag der Gutachterin | Bürgersaal | {{g2}}\n" +
      "Rundgang am Mühlbach, Beginn an | Mühlenbrücke | {{g3}}\n" +
      "Arbeitsgruppen | 4 Gruppen | {{g4}}\n" +
      "Fragerunde | 45 Minuten | {{g5}}\n" +
      "Anmeldeschluss | Mittwoch | {{g6}}",
    [
      ["17 Uhr", "17", "siebzehn Uhr", "siebzehn", "um siebzehn Uhr", "um siebzehn", "5 Uhr", "fünf Uhr", "um fünf Uhr", "um fünf"],
      ["Bürgersaal", "im Bürgersaal", "der Bürgersaal"],
      ["Sportplatz", "am Sportplatz", "der Sportplatz", "beim Sportplatz", "auf dem Sportplatz"],
      ["5 Gruppen", "5", "fünf Gruppen", "fünf", "in 5 Gruppen", "in fünf Gruppen"],
      ["45 Minuten", "45", "45 min", "fünfundvierzig Minuten", "fünfundvierzig", "Dreiviertelstunde", "eine Dreiviertelstunde", "dreiviertel Stunde", "eine dreiviertel Stunde"],
      ["Freitag", "bis Freitag", "bis zum Freitag", "am Freitag"],
    ],
    "Zeile 1: \"nicht um halb sechs, sondern schon um siebzehn Uhr\" (17.30 Uhr ist der gedruckte Wert). Zeile 2: Der Bürgersaal wird ausdrücklich bestätigt (\"da ändert sich nichts\"). Zeile 3: Der Sportplatz steht im Relativsatz (\"der nicht mehr an der Mühlenbrücke, sondern am Sportplatz beginnt\"), der Hauptsatz handelt von festem Schuhwerk. Zeile 4: Selbstkorrektur: \"in sechs, nein, Moment, in fünf Gruppen\" (vier ist der gedruckte Wert, sechs wird zurückgenommen). Zeile 5: Die Verlängerung auf sechzig Minuten wird erwogen, aber verworfen; es bleibt bei fünfundvierzig. Zeile 6: Die neue Frist steht in einem Nebensatzgefüge (\"kann sich, weil wir die Frist verlängert haben, nicht nur bis Mittwoch, sondern noch bis Freitag anmelden\"). Uhrzeiten in Ziffern werden in jeder Schreibweise akzeptiert.",
  ),
  buerger.choice(
    "attitude",
    "HARD",
    "Wie äußert sich Herr Reimers über die Zahl der Anmeldungen?",
    "Er freut sich über das große Interesse, räumt aber ein, dass es die Organisation erschwert.",
    [
      "Er ist enttäuscht, weil weniger Anmeldungen eingegangen sind, als die Stadt erwartet hatte.",
      "Er hält das große Interesse für ein Zeichen, dass viele Anwohner mit der Planung unzufrieden sind.",
      "Er bedauert, dass die Fragerunde wegen des Andrangs verkürzt werden muss.",
    ],
    3,
    "\"Das freut uns natürlich sehr, auch wenn es uns organisatorisch einiges abverlangt\": Freude mit einer Einschränkung. Die Zahlen (achtzig erwartet, über zweihundert angemeldet) widerlegen die Enttäuschung; eine Unzufriedenheit der Anwohner wird nicht angedeutet; die Fragerunde wird gerade nicht verkürzt, sondern bleibt bei fünfundvierzig Minuten.",
  ),
];

// ------------------------------------------------------------------ reading

const rLicht = a.text(
  "kunstlicht-nacht",
  "Wenn die Nacht nicht mehr dunkel wird",
  "Umwelt, Kunstlicht",
  `Wer abends aus dem Fenster schaut, sieht über den meisten Städten einen Himmel von der Farbe schmutziger Milch. Sterne sind zur Ausnahme geworden, und das ist mehr als ein ästhetischer Verlust. Unter Biologen gilt künstliches Licht in der Nacht inzwischen als eigener Umweltfaktor, vergleichbar mit Lärm oder Schadstoffen, nur ungleich weniger beachtet.

Besonders deutlich zeigen sich die Folgen bei Insekten. Für viele Arten wirkt eine Straßenlaterne wie ein Magnet: Sie umkreisen das Licht, bis sie erschöpft sind oder gefressen werden. Eine Arbeitsgruppe der Universität Hohenmoor hat deshalb drei Sommer lang beleuchtete und unbeleuchtete Abschnitte desselben Feldwegs verglichen. An den hellen Abschnitten flogen im Schnitt nur halb so viele Nachtfalter wie an den dunklen. Gezählt wurden allerdings nur Tiere, die sich in der Umgebung der Lampen noch fangen ließen; die an den Laternen verendeten blieben unberücksichtigt. Die tatsächlichen Verluste dürften daher höher liegen, als die Zahlen vermuten lassen.

Die Gemeinde Brunnstedt hat aus solchen Befunden Konsequenzen gezogen und ihre Straßenbeleuchtung im vergangenen Jahr umgerüstet. Die neuen Leuchten strahlen in warmem Ton, ausschließlich nach unten, und werden zwischen Mitternacht und fünf Uhr auf ein Fünftel ihrer Helligkeit gedimmt. Der Stromverbrauch sank dadurch um mehr als die Hälfte, was den Gemeinderat zunächst stärker überzeugte als alle ökologischen Argumente. Skeptische Stimmen gab es dennoch: Manche Anwohner fürchteten, im Halbdunkel unsicherer unterwegs zu sein. Eine Umfrage nach einem Jahr ergab jedoch, dass sich der Anteil derer, die sich nachts unwohl fühlen, kaum verändert hatte.

Ob sich das Beispiel verallgemeinern lässt, ist offen. Brunnstedt ist ein Dorf mit wenigen hundert Straßenlaternen; in einer Großstadt, in der Schaufenster, Reklame und Bürotürme ebenfalls leuchten, wäre mit gedimmten Straßenlampen allein wenig gewonnen. Die Forschenden mahnen deshalb zur Zurückhaltung: Dunkelheit sei kein Selbstzweck, sondern ein Gut, das man gegen Sicherheitsbedürfnisse und Gewohnheiten abwägen müsse. Dass dieses Abwägen überhaupt beginnt, werten sie bereits als Fortschritt.`,
);

const rReparatur = a.text(
  "reparaturcafes-mehr",
  "Mehr als ein Hobby für Bastler",
  "Konsum, Reparieren",
  `Vor einigen Jahren hätte man jemanden, der seinen Toaster zum Löten trägt, für einen Sonderling gehalten. Heute treffen sich in Gemeindesälen und Bibliotheken regelmäßig Freiwillige, die Kaffeemaschinen, Lampen und Kopfhörer wieder zum Laufen bringen, kostenlos und bei Filterkaffee. Reparaturcafés gibt es inzwischen auf dem Land wie in der Stadt. Spöttische Beobachter sehen darin eine Nostalgiewelle für Leute, die sich das Neukaufen leisten könnten und lieber basteln. Dieser Verdacht greift zu kurz.

Wer einmal eine Stunde in einem solchen Café verbracht hat, bemerkt, dass dort weniger Romantik als Pragmatismus herrscht. Die meisten Besucher kommen nicht, weil sie das Handwerk lieben, sondern weil ein Gerät kaputt ist, das sie weder ersetzen wollen noch können. Oft ist es ein Kabelbruch oder ein verschlissener Schalter, den ein Geübter in zehn Minuten behebt. Ärgerlich wird es, wenn der Rest scheitert: Der Hersteller hat Ersatzteile nie einzeln verkauft, das Gehäuse ist verklebt statt verschraubt, die Schaltpläne bleiben unter Verschluss. Das Ersatzteil ist das eigentliche Nadelöhr der Reparatur.

Hier liegt der Kern der Debatte. Solange Geräte so gebaut werden, dass ihre Reparatur teurer ist als ein Neukauf, bleibt das Reparaturcafé eine liebenswerte Notlösung, die an der Wegwerfmentalität wenig ändert. Man kann sogar argwöhnen, dass es ihr zuarbeitet: Wer sein Gewissen mit einem gelegentlichen Besuch beruhigt, kauft danach umso bedenkenloser neu. Dem halten Befürworter entgegen, dass die Cafés Daten liefern. Die Freiwilligen dokumentieren, welche Modelle wie oft und woran ausfallen, und Verbraucherverbände benutzen diese Listen inzwischen als Argument in der Gesetzgebung. Ein Recht auf Reparatur, wie es in mehreren Ländern diskutiert wird, stützt sich auf genau solche Erfahrungen.

Es wäre also verfehlt, die Bewegung auf ihr Bastelbild zu reduzieren. Wer an einem Samstagvormittag den Schraubenzieher in die Hand nimmt, tut etwas Bescheidenes. Doch er sammelt Belege dafür, dass vieles, was als Müll endet, nur an einem verklebten Gehäuse scheitert. Und das wäre, nähme man es ernst, ziemlich unbescheiden.`,
);

const licht = a.forText(rLicht);
const reparatur = a.forText(rReparatur);

const readingItems = [
  licht.choice(
    "detail",
    "MID",
    "Was blieb bei der Zählung der Arbeitsgruppe der Universität Hohenmoor unberücksichtigt?",
    "die Insekten, die unmittelbar an den Laternen verendet waren",
    [
      "die Nachtfalter an den unbeleuchteten Abschnitten des Feldwegs",
      "die Messergebnisse aus dem ersten der drei Sommer",
      "die Tiere, die in der Nähe der Lampen noch zu fangen waren",
    ],
    2,
    "Zweiter Absatz: Gezählt wurden \"nur Tiere, die sich in der Umgebung der Lampen noch fangen ließen; die an den Laternen verendeten blieben unberücksichtigt\". Die dunklen Abschnitte und die Tiere in der Nähe der Lampen wurden also gezählt; von einem ausgeschlossenen Sommer ist keine Rede.",
  ),
  licht.choice(
    "inference",
    "HARD",
    "Was lässt sich aus der Umfrage in Brunnstedt schließen?",
    "Das Dimmen der Lampen hat das Unsicherheitsgefühl der Anwohner kaum verstärkt.",
    [
      "Die meisten Anwohner haben den Wechsel zu warmem Licht ausdrücklich begrüßt.",
      "Die Sorge der Anwohner war unbegründet, weil nachts ohnehin kaum jemand unterwegs ist.",
      "Die Mehrzahl der Anwohner fühlt sich nachts nach wie vor unwohl auf den Straßen.",
    ],
    0,
    "Dritter Absatz: Der Anteil derer, die sich nachts unwohl fühlen, hatte sich \"kaum verändert\". Daraus folgt, dass die befürchtete Verunsicherung durch das Dimmen ausblieb. Dass die Anwohner das warme Licht begrüßten, dass nachts kaum jemand unterwegs ist und dass sich die Mehrheit unwohl fühlt, steht nicht im Text; der Befund betrifft nur die Veränderung des Anteils.",
  ),
  licht.tfng(
    "detail",
    "MID",
    [
      ["Nach den Zahlen der Arbeitsgruppe fliegen an hell beleuchteten Wegabschnitten deutlich weniger Nachtfalter als an dunklen.", "R"],
      ["Der Stromverbrauch der Straßenbeleuchtung in Brunnstedt ist nach der Umrüstung nur geringfügig gesunken.", "F"],
      ["Seit der Umrüstung hat die Zahl der Verkehrsunfälle in Brunnstedt abgenommen.", "NG"],
      ["Der Gemeinderat ließ sich zunächst eher vom Sparen als von ökologischen Gründen überzeugen.", "R"],
    ],
    "1 R: \"nur halb so viele Nachtfalter\" an den hellen Abschnitten. 2 F: Der Verbrauch sank \"um mehr als die Hälfte\". 3 NG: Sicherheitsbedenken der Anwohner werden erwähnt, Unfallzahlen aber nirgends genannt. 4 R: Die Einsparung überzeugte den Gemeinderat \"zunächst stärker als alle ökologischen Argumente\".",
  ),

  reparatur.choice(
    "gist",
    "MID",
    "Worum geht es in dem Text im Kern?",
    "Reparaturcafés sind mehr als ein Trend für Nostalgiker, denn sie zeigen, woran Reparaturen scheitern.",
    [
      "Reparaturcafés werden überflüssig, sobald Hersteller ihre Geräte wieder mit einzelnen Ersatzteilen anbieten.",
      "Reparaturcafés sprechen vor allem Menschen an, die Freude am Handwerk haben und sich Neukäufe leisten können.",
      "Reparaturcafés verändern das Konsumverhalten ihrer Besucher, weil diese danach seltener Geräte neu kaufen.",
    ],
    0,
    "Der Text weist den Verdacht der \"Nostalgiewelle\" zurück (erster und letzter Absatz) und führt aus, dass die Cafés Belege dafür sammeln, woran Reparaturen scheitern (Ersatzteile, Verklebung, Schaltpläne). Dass die Cafés überflüssig würden, dass sie vor allem Bastler mit Geld ansprächen oder dass Besucher danach seltener neu kauften, sagt der Text nicht: Das Ende der Cafés wird nirgends vorhergesagt, die Bastler-These wird als Verdacht zurückgewiesen, und das Kaufverhalten erscheint nur als geäußerter Verdacht des Gegenteils.",
  ),
  reparatur.choice(
    "attitude",
    "HARD",
    "Wie geht der Text mit dem Einwand um, Reparaturcafés bestärkten die Wegwerfmentalität?",
    "Er räumt ihn als möglich ein, sieht aber im Nutzen der gesammelten Daten ein starkes Gegengewicht.",
    [
      "Er weist ihn zurück, weil Besucher von Reparaturcafés danach in der Regel seltener neu kaufen.",
      "Er teilt ihn vollständig und verlangt deshalb, die Cafés durch gesetzliche Vorgaben zu ersetzen.",
      "Er hält ihn für nebensächlich, da die Cafés vor allem der Geselligkeit der Freiwilligen dienen.",
    ],
    2,
    "Dritter Absatz: \"Man kann sogar argwöhnen, dass es ihr zuarbeitet\" räumt die Möglichkeit ein, \"Dem halten Befürworter entgegen ...\" und der Schluss (\"verfehlt, die Bewegung auf ihr Bastelbild zu reduzieren\") zeigen, dass die Autorin den Einwand ernst nimmt, den Nutzen der Daten aber höher gewichtet. Eine Zurückweisung als Unterstellung, eine vollständige Zustimmung mit Ersatzforderung und die Abwertung als Unterhaltung kommen im Text nicht vor.",
  ),
  reparatur.choice(
    "vocabulary",
    "MID",
    "Was meint der Text mit der Aussage, das Ersatzteil sei „das eigentliche Nadelöhr der Reparatur“?",
    "Ob eine Reparatur gelingt, hängt vor allem davon ab, ob Ersatzteile überhaupt zu bekommen sind.",
    [
      "Ersatzteile sind meist so klein, dass sie sich nur mit Spezialwerkzeug einbauen lassen.",
      "Der Einbau von Ersatzteilen dauert in den meisten Fällen länger als die eigentliche Fehlersuche.",
      "Die Freiwilligen müssen für jedes Ersatzteil eine eigene Anleitung lesen, bevor sie arbeiten.",
    ],
    1,
    "Ein Nadelöhr ist ein Engpass, durch den alles hindurch muss. Der Satz fasst den Absatz zusammen: Wo es Ersatzteile nicht einzeln zu kaufen gibt, scheitert die Reparatur, obwohl der Fehler selbst klein ist. Die anderen Optionen nehmen das Bild wörtlich (Größe, Dauer, Anleitung) und stehen nicht im Text.",
  ),
];

// ------------------------------------------------------------------ writing

const writingItems = [
  a.writing(
    "data",
    "HARD",
    [220, 320],
    "Die Regionalzeitung der Region Hochmark hat die Ergebnisse einer Befragung zu den Nachrichtenquellen der Einwohner veröffentlicht und bittet um Leserbeiträge. In jedem Jahr wurden rund 1500 Einwohner gefragt, welche Quelle sie für Informationen über das Geschehen in Politik und Gesellschaft am häufigsten nutzen.\n\n" +
      "Am häufigsten genutzte Quelle | 2015 | 2020 | 2025\n" +
      "gedruckte Tageszeitung | 31 % | 22 % | 14 %\n" +
      "Nachrichtenseiten und Apps der Zeitungen | 12 % | 17 % | 20 %\n" +
      "Radio und Fernsehen | 41 % | 36 % | 29 %\n" +
      "soziale Netzwerke und Videoplattformen | 11 % | 20 % | 30 %\n" +
      "Podcasts und Newsletter | 5 % | 5 % | 7 %\n\n" +
      "Schreiben Sie einen Leserbeitrag (etwa 250 Wörter):\n" +
      "- Beschreiben Sie die wichtigsten Entwicklungen und setzen Sie die Zahlen zueinander in Beziehung.\n" +
      "- Nennen Sie mögliche Ursachen für diese Entwicklung.\n" +
      "- Gehen Sie darauf ein, was sie für die Meinungsbildung in der Region bedeuten kann, und weisen Sie auf Grenzen der Aussagekraft einer solchen Befragung hin.\n" +
      "- Nehmen Sie begründet Stellung: Wie sollte die Region mit dieser Entwicklung umgehen?",
    [
      "beschreibt die zentralen Entwicklungen zutreffend (gedruckte Zeitung und Radio/Fernsehen rückläufig, soziale Netzwerke und Videoplattformen am stärksten gewachsen, Zeitungsangebote im Netz leicht gestiegen, Podcasts und Newsletter nahezu stabil) und wählt das Wesentliche aus",
      "setzt Zahlen zueinander in Beziehung (z. B. gedruckte und digitale Zeitungsangebote zusammen: 43, 39 und 34 Prozent; Rückgang der gedruckten Zeitung um 17 Punkte gegenüber einem Zuwachs der sozialen Netzwerke um 19 Punkte)",
      "nennt plausible Ursachen (Nutzung unterwegs, Kosten von Abonnements, Empfehlungsalgorithmen, Wandel der Gewohnheiten, schwächere Zustellung im ländlichen Raum)",
      "erörtert Folgen für die regionale Meinungsbildung (Lokaljournalismus, gemeinsame Gesprächsgrundlage, Filterblasen) und benennt Grenzen der Erhebung (nur eine Hauptquelle, Stichprobe, Selbstauskunft, keine Aussage zu Vertrauen oder Nutzungsdauer)",
      "nimmt begründet Stellung mit einem konkreten Vorschlag; Daten werden gedeutet, nicht nur aufgezählt; klarer Aufbau und variabler Wortschatz für Veränderungen und Vergleiche",
    ],
    [
      "die wichtigsten Entwicklungen der Tabelle",
      "Zahlen zueinander in Beziehung setzen",
      "mögliche Ursachen",
      "Folgen für die Meinungsbildung und Grenzen der Befragung",
      "Ihre begründete Position",
    ],
    "neutral bis formell (Leserbeitrag)",
    "Datenbeschreibung mit Ursachen, Folgen und begründeter Stellungnahme. Bewertet werden Aufgabenerfüllung (treffende Wiedergabe der Zahlen, alle vier Leitpunkte), Kohärenz, Wortschatz für Veränderungen und Vergleiche sowie Register. Auf C2-Niveau gehört die kritische Einordnung der Erhebung dazu. Die Daten sind erfunden.",
  ),
  a.writing(
    "promo",
    "MID",
    [220, 320],
    "Das Museum für Stadtgeschichte Altenfeld eröffnet im Mai eine neue Ausstellung. Sie arbeiten in der Öffentlichkeitsarbeit des Museums und erhalten das folgende Faktenblatt.\n\n" +
      "Faktenblatt zur Ausstellung\n" +
      "- Titel: „Sprung ins Blaue. Hundert Jahre Freibad in Altenfeld“\n" +
      "- Zeitraum: 14. Mai bis 30. September; Eröffnung am 13. Mai um 19 Uhr bei freiem Eintritt\n" +
      "- Ort: Sonderausstellungshalle im Erdgeschoss des Museums\n" +
      "- Öffnungszeiten: Dienstag bis Sonntag von 10 bis 18 Uhr, donnerstags bis 20 Uhr\n" +
      "- Eintritt: 9 Euro, ermäßigt 5 Euro, Schulklassen frei\n" +
      "- Inhalt: rund 300 Objekte aus den Jahren 1925 bis 1995 (Badekleidung, Eintrittskarten, Werbeplakate, Fotoalben) und Erinnerungen Altenfelder Familien\n" +
      "- Besonderheit 1: ein nachgebauter Zehn-Meter-Sprungturm, dessen oberste Plattform man besteigen kann (je 15 Minuten, Platz vorher reservieren)\n" +
      "- Besonderheit 2: die Aktion „Mein Sommer“: Besucher bringen Fotos oder Erinnerungsstücke mit, sie werden erfasst und in einer Wandgalerie gezeigt\n" +
      "- Begleitprogramm: öffentliche Führung jeden Samstag um 15 Uhr; Siebdruckworkshop „Plakate wie damals“ am 6. Juni (Anmeldung nötig)\n" +
      "- Kuratorin: Dr. Hanna Vollmer; zitierbar: „Im Freibad waren alle Altenfelder einmal gleich: nass und gut gelaunt.“\n" +
      "- Presseanfragen: presse@museum-altenfeld.example\n\n" +
      "Schreiben Sie auf dieser Grundlage eine Pressemitteilung für die regionale Presse (etwa 250 Wörter). Sie beginnt mit einer Überschrift und einem einleitenden Satz (Lead), der das Wichtigste zusammenfasst. Übernehmen Sie die Angaben nicht als Aufzählung, sondern verarbeiten Sie sie zu einem zusammenhängenden, einladenden Text.",
    [
      "Überschrift und Lead nennen Anlass, Ort und Zeitraum knapp und wecken Interesse",
      "gibt die praktischen Angaben vollständig und richtig wieder (Zeitraum, Eröffnung, Öffnungszeiten, Eintritt, Reservierung für den Sprungturm, Anmeldung für den Workshop)",
      "beschreibt Inhalt und die beiden Besonderheiten anschaulich und in eigenen Worten, ohne sie als Liste zu übernehmen",
      "bindet die Aussage der Kuratorin als direktes Zitat oder als indirekte Rede korrekt ein",
      "werbender, aber sachlicher Pressestil; wichtigste Information zuerst; Hinweis für Presseanfragen am Schluss",
    ],
    [
      "Überschrift und einleitender Satz",
      "Zeitraum, Ort und Eintritt",
      "Inhalt und Besonderheiten der Ausstellung",
      "das Begleitprogramm",
      "die Aussage der Kuratorin",
      "Hinweis für Presseanfragen",
    ],
    "sachlich-werbend (Pressemitteilung)",
    "Werbende Textsorte nach einem Faktenblatt: Überschrift und Lead, dann absteigende Wichtigkeit. Bewertet werden Aufgabenerfüllung (richtige und vollständige Angaben, Auswahl), Textsorte und Stil (anschaulich, einladend, aber sachlich), Kohärenz und sprachliche Mittel (Umformung der Stichpunkte in zusammenhängende Sätze, Redewiedergabe). Alle Angaben sind erfunden.",
  ),
];

// ------------------------------------------------------------------ grammar

const grammarItems = [
  a.grammarChoice(
    "rektion",
    "MID",
    "Einer Meldung der Nachrichtenagentur ___ sind bei dem Unglück keine Personen zu Schaden gekommen.",
    "zufolge",
    ["zuliebe", "zugunsten", "zuzüglich"],
    2,
    "\"zufolge\" (= laut) steht fast immer nach seinem Bezugswort und verlangt den Dativ: \"Einer Meldung zufolge\". \"zuliebe\" steht ebenfalls nachgestellt, nennt aber Zuneigung oder Rücksicht (\"dem Frieden zuliebe\"), \"zugunsten\" bedeutet \"zum Vorteil von\", \"zuzüglich\" bedeutet \"plus\" und steht vor dem Genitiv; alle drei ergeben im Satz keinen Sinn.",
  ),
  a.grammarChoice(
    "konzessiv",
    "MID",
    "___ sich die Verantwortlichen auch bemühten, ließ sich die Frist nicht mehr halten.",
    "So sehr",
    ["Soweit", "Solange", "Sobald"],
    0,
    "Konzessiver Nebensatz \"So sehr ... auch\" (= egal wie sehr, obwohl sie sich bemühten); das finite Verb steht am Satzende. \"Soweit\" begrenzt einen Umfang, \"Solange\" und \"Sobald\" sind temporal und lassen sich nicht mit \"auch\" zu einer Einräumung verbinden.",
  ),
  a.grammarChoice(
    "paraphrase",
    "HARD",
    "Welcher Satz gibt die Aussage „Der Ausschuss konnte nicht umhin, den Antrag zu bewilligen.“ am genauesten wieder?",
    "Dem Ausschuss blieb nichts anderes übrig, als den Antrag zu bewilligen.",
    [
      "Der Ausschuss war nicht in der Lage, den vorliegenden Antrag zu bewilligen.",
      "Der Ausschuss bewilligte den Antrag, ohne ihn vorher geprüft zu haben.",
      "Der Ausschuss hätte den Antrag gern bewilligt, durfte es aber nicht.",
    ],
    3,
    "\"nicht umhin können, zu ...\" bedeutet \"keine andere Wahl haben, als zu ...\": Der Antrag wird bewilligt, weil es unvermeidlich ist. Die erste Option liest die Verneinung als Unvermögen und kehrt damit die Aussage um, die dritte kehrt sie ebenfalls um (nicht bewilligen dürfen), die zweite erfindet einen Zusammenhang mit einer fehlenden Prüfung.",
  ),
  a.grammarTyped(
    "konjunktiv_i",
    "HARD",
    "Setzen Sie die Form von „dürfen“ ein, an der man die indirekte Rede eindeutig erkennt.\n\nDie Sprecherin versicherte, die Beschäftigten {{g1}} sich jederzeit mit Fragen an die Personalabteilung wenden.",
    ["dürften"],
    "Der Konjunktiv I von \"dürfen\" lautet in der dritten Person Plural \"dürfen\" und ist damit mit dem Indikativ identisch. In diesem Fall tritt der Konjunktiv II als Ersatzform ein: \"dürften\". \"dürfe\" gehört zum Singular.",
  ),
];

export const C2_MORE: LevelParts = {
  ...noParts(),
  grammar: { stimuli: [], items: grammarItems },
  reading: { stimuli: [rLicht, rReparatur], items: readingItems },
  listening: { stimuli: [lLiteratur, lBuerger], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
};
