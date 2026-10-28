import type { SeedCourseForm } from "../types";
import {
  announcementQuestion,
  clip,
  cloze3,
  introductionTask,
  presentationTask,
  proposalTask,
  readingText,
  REGISTER,
  sentence,
  tfng,
  whichText,
  writingTask,
} from "./builders";
import { FINAL_SYLLABUS } from "./syllabus";

/**
 * Abschlusstest B2, Form A (spec 2026-10-28). Tests the whole B2 list, about half from each half: the cloze
 * has five gaps from the first half and five from the second, the sentences seven and eight. Form B has the
 * same structure (final-b.ts), no shared text or sentence, and the Zwischentest B2.1 shares no item with it.
 */

// ================================================================ READING (10)

const R1 = "course-b2-a-r1";
const R2 = "course-b2-a-r2";

const reading1 = readingText(
  R1,
  "Zeitungsartikel: Abschalten, bevor es zu viel wird",
  "Medien: Nachrichtenkonsum und Nachrichtenmüdigkeit",
  `
Wer morgens den Fernseher einschaltet oder aufs Handy schaut, bekommt oft zuerst schlechte Nachrichten: Kriege, Krisen, Katastrophen. Immer mehr Menschen reagieren darauf mit Rückzug. In einer internationalen Umfrage gab fast jeder Dritte an, Nachrichten manchmal oder sogar häufig zu meiden. Als Grund nannten viele Befragte, dass die Berichte sie belasteten und dass sie ohnehin nichts ändern könnten.

Die Kommunikationswissenschaftlerin Selma Yilmaz untersucht dieses Phänomen seit mehreren Jahren. Sie warnt davor, Nachrichtenmüdigkeit vorschnell als Desinteresse zu deuten. „Viele Menschen interessieren sich durchaus für das Weltgeschehen“, sagt sie. „Sie haben nur das Gefühl, dass die Menge an Informationen nicht mehr zu bewältigen ist.“ Besonders schwierig sei, dass Meldungen heute rund um die Uhr auf dem Smartphone eingingen, oft ohne Einordnung.

Medienhäuser reagieren auf diese Entwicklung unterschiedlich. Einige Redaktionen bieten inzwischen Zusammenfassungen am Morgen und am Abend an, damit sich niemand durch einen endlosen Strom von Eilmeldungen arbeiten muss. Andere setzen auf sogenannten lösungsorientierten Journalismus: Sie berichten nicht nur über ein Problem, sondern auch darüber, wie Menschen oder Städte es zu lösen versuchen. Erste Auswertungen zeigen, dass solche Beiträge von den Leserinnen und Lesern länger gelesen werden.

Kritiker bemängeln allerdings, dass dieser Ansatz die Realität verharmlosen könne. Journalismus solle nicht trösten, sondern informieren, heißt es. Yilmaz sieht das gelassener: Entscheidend sei die Qualität der Recherche, nicht die Stimmung des Textes. Sie rät, sich bewusst feste Zeiten für Nachrichten zu nehmen, statt ständig verfügbar zu sein, und Quellen zu bevorzugen, die Hintergründe erklären. Sie selbst lese morgens eine Zusammenfassung und habe die Eilmeldungen auf ihrem Handy ausgeschaltet. Wer so vorgehe, bleibe informiert, ohne sich überfordert zu fühlen.
`,
);

const reading2 = readingText(
  R2,
  "Vier Texte zum Thema Mobilität und Reisen",
  "Umwelt und Reisen: Mitfahrbörse, Verzicht auf Flüge, Regionalticket, Radurlaub",
  `
Text A: Aushang am Schwarzen Brett
Gemeinsam statt allein zur Arbeit: Ab Januar richtet das Umweltteam eine Mitfahrbörse ein. Wer bislang allein mit dem Auto pendelt, kann sich in eine Liste eintragen und Kolleginnen und Kollegen aus demselben Stadtteil mitnehmen; die Teilnahme ist selbstverständlich kostenlos. Wer mindestens dreimal pro Woche Mitfahrende hat, bekommt als Dankeschön einen reservierten Parkplatz direkt am Haupteingang. Wie die Vermittlung im Einzelnen funktioniert, erklären wir bei einer Informationsveranstaltung am 12. Dezember um 16 Uhr in Besprechungsraum 2. Da die Zahl der Plätze begrenzt ist, melden Sie sich bitte bis zum 9. Dezember im Büro des Umweltteams an.

Text B: Beitrag in einem Reiseforum
Seit zwei Jahren steige ich in kein Flugzeug mehr. Den Ausschlag hat ein CO2-Rechner gegeben, der mir vor Augen geführt hat, wie viel ein einziger Wochenendtrip mit dem Flugzeug verursacht. Früher habe ich solche Billigflüge gebucht, ohne lange nachzudenken; heute nehme ich den Zug, auch wenn ich dafür oft einen Tag länger unterwegs bin. Ich vermisse dabei kaum etwas. Wer im Zug ein gutes Buch dabeihat, erlebt die Fahrt nicht als verlorene Zeit, sondern als Teil des Urlaubs. Lena

Text C: Anzeige
Mit dem Regionalticket „Nordland“ sind Sie einen ganzen Monat lang in allen Bussen und Regionalzügen der Region unterwegs, so oft Sie wollen. Der Preis von 49 Euro rechnet sich bereits, wenn Sie mehr als zweimal pro Woche fahren. Studierende und Auszubildende zahlen lediglich 29 Euro, sofern sie einen gültigen Nachweis vorlegen. Das Ticket ist monatlich kündbar und in allen Kundenzentren sowie in unserer App erhältlich. Am Wochenende reist Ihr Fahrrad kostenlos mit.

Text D: Blogeintrag
Zwei Wochen mit dem Rad an der Donau entlang, das Gepäck wird von Hotel zu Hotel gebracht: Ich gebe zu, dass ich das für eine Art Pauschalurlaub für Bequeme hielt. Umso überraschter war ich, wie sehr mich schon die ersten Etappen gefordert haben, und wie angenehm es war, abends ohne schwere Taschen anzukommen. Billig war die Reise nicht, allein der Gepäcktransport kostete 150 Euro extra, aber das war es mir wert. Die Unterkünfte waren schlicht, das Essen dafür hervorragend. Ob ich es wiederholen würde? Unbedingt, allerdings nur mit vorherigem Training. Marek
`,
);

// ================================================================ GRAMMAR (25)

const cloze = cloze3("MID", {
  title: "Ein Laden für das ganze Dorf",
  first: "Als der letzte Supermarkt in einem kleinen Dorf in Thüringen schloss, mussten die Einwohner zum Einkaufen mehr als zehn Kilometer fahren.",
  body:
    "Besonders ältere Menschen ohne Auto hatten es schwer. Deshalb gründeten einige Einwohner eine Genossenschaft und eröffneten einen eigenen Laden. " +
    "Der Laden kann nur bestehen, [[sofern|obwohl|ohne dass#konnektor]] genügend Kundinnen und Kunden regelmäßig dort einkaufen. " +
    "Ohne die Spenden der Einwohner [[wäre|hätte|würde#konjunktiv2.vergangenheit]] das Projekt schon in den ersten Monaten gescheitert. " +
    "Die Genossenschaft hat inzwischen über zweihundert Mitglieder, [[von denen|von die|von deren#relativsatz.praeposition]] viele ehrenamtlich mithelfen. " +
    "Die [[angebotenen|anbietenden|angebotene#partizipattribut]] Produkte stammen überwiegend von Betrieben aus der Umgebung, und die Preise sind an einer Tafel am Eingang [[abzulesen|abgelesen|ablesen#passiversatz]]. " +
    "Der Laden verkauft [[nicht nur|entweder|weder#konnektor.zweiteilig]] Lebensmittel, sondern auch Zeitungen und Bastelmaterial. " +
    "Wer möchte, kann sich [[an|zu|in#verb_praeposition]] der Genossenschaft beteiligen. " +
    "Besonders freut sich die Ladenleiterin über den neuen [[Praktikanten|Praktikant|Praktikantes#n_deklination]], der jeden Samstag mithilft. " +
    "Der Vorsitzende betont, der Laden [[sei|seien|seiest#konjunktiv_i]] längst mehr als nur ein Geschäft, nämlich ein Treffpunkt für das ganze Dorf. " +
    "Nach Angaben der Genossenschaft [[soll|will|darf#modalverb_subjektiv]] der Umsatz im letzten Jahr um zehn Prozent gestiegen sein.",
  last: "Andere Dörfer in der Region prüfen deshalb, ob sie das Modell übernehmen können.",
  note:
    "Lücke 1: Konnektor „sofern“ (Bedingung). Lücke 2: Konjunktiv II der Vergangenheit („scheitern“ bildet das Perfekt mit „sein“). " +
    "Lücke 3: Relativsatz mit Präposition (partitiv „von denen“, Dativ Plural). Lücke 4: Partizip II als Attribut (Nominativ Plural: -en). " +
    "Lücke 5: Passiversatz sein + zu + Infinitiv (trennbares Verb). Lücke 6: zweiteiliger Konnektor „nicht nur ... sondern auch“. " +
    "Lücke 7: Verb mit Präposition („sich beteiligen an“ + Dativ). Lücke 8: n-Deklination (Akkusativ Singular: den Praktikanten). " +
    "Lücke 9: Konjunktiv I in der indirekten Rede (3. Person Singular: „sei“). Lücke 10: subjektiver Gebrauch von „sollen“ (Aussage Dritter, „nach Angaben“).",
});

const grammar = [
  cloze,
  sentence("partizipattribut", "HARD",
    "Die im Hof laut ____ Kinder störten den Unterricht.",
    ["spielende", "gespielten", "spielenden", "zu spielenden"], 2,
    "Erweitertes Partizipialattribut mit Partizip I (gleichzeitige, aktive Handlung)"),
  sentence("konjunktiv_i", "MID",
    "Der Zeuge sagte, er ____ den Mann nie zuvor gesehen (Konjunktiv I).",
    ["hatte", "habe", "hätte", "hat"], 1,
    "Konjunktiv I in der indirekten Rede (3. Person Singular, Perfekt: habe + Partizip II)"),
  sentence("konnektor", "MID",
    "Die Mieten in der Innenstadt sind stark gestiegen. ____ ziehen immer mehr Familien in die günstigeren Randbezirke.",
    ["Dennoch", "Andernfalls", "Stattdessen", "Infolgedessen"], 3,
    "Adverbkonnektor mit konsekutiver Bedeutung („infolgedessen“) und Inversion"),
  sentence("konnektor.zweiteilig", "MID",
    "Die Wohnung ist ____ klein, ____ sie liegt sehr zentral.",
    ["zwar ... aber", "entweder ... oder", "weder ... noch", "je ... desto"], 0,
    "Zweiteiliger Konnektor „zwar ... aber“ (Einräumung und Gegensatz)"),
  sentence("passiv.modal", "MID",
    "Ich weiß nicht, ob der Termin noch ____ kann.",
    ["wird verschoben", "werden verschoben", "verschoben werden", "verschoben wird"], 2,
    "Passiv mit Modalverb im Nebensatz (Satzklammer: verschoben werden kann)"),
  sentence("futur2", "HARD",
    "Kemal antwortet nicht auf meine Nachricht. Er ____ sie wohl noch nicht gelesen haben.",
    ["hat", "hätte", "ist", "wird"], 3,
    "Futur II als Vermutung über Vergangenes (wird ... gelesen haben)"),
  sentence("relativsatz", "MID",
    "Das ist der Kollege, ____ Idee uns den Auftrag gebracht hat.",
    ["dessen", "deren", "dem", "den"], 0,
    "Relativsatz mit Genitivpronomen („dessen“, Bezugswort maskulin)"),
  sentence("verb_praeposition", "MID",
    "Die Studie weist ____ einen Zusammenhang zwischen Schlaf und Lernerfolg hin.",
    ["an", "auf", "zu", "mit"], 1,
    "Verb mit Präposition („hinweisen auf“ + Akkusativ)"),
  sentence("konjunktiv2.vergangenheit", "MID",
    "Ich wünschte, ich ____ damals nicht so schnell aufgegeben.",
    ["wäre", "hatte", "würde", "hätte"], 3,
    "Konjunktiv II der Vergangenheit im irrealen Wunschsatz (hätte + Partizip II)"),
  sentence("n_deklination", "MID",
    "Der Service richtet sich nach den Wünschen des ____.",
    ["Kundes", "Kunde", "Kunden", "Kundens"], 2,
    "n-Deklination (Genitiv Singular: des Kunden)"),
  sentence("konnektor", "MID",
    "Die Stadt will den Verkehr verringern, ____ sie das Parken im Zentrum teurer macht.",
    ["indem", "damit", "falls", "obwohl"], 0,
    "Modaler Nebensatz mit „indem“ (Mittel, mit dem ein Ziel erreicht wird)"),
  sentence("nominal_verbalstil", "MID",
    "Nach der Ankunft der Gäste begann das Fest. Anders gesagt: ____ die Gäste angekommen waren, begann das Fest.",
    ["Bevor", "Nachdem", "Während", "Seitdem"], 1,
    "Nominalstil zu Verbalstil: „nach der Ankunft“ wird zum temporalen Nebensatz mit „nachdem“ und Plusquamperfekt"),
  sentence("modalpartikel", "MID",
    "Ich muss los, aber wo ist ____ mein Schlüssel?",
    ["ja", "mal", "halt", "denn"], 3,
    "Modalpartikel „denn“ in der W-Frage (Interesse, leichte Ungeduld)"),
  sentence("genitiv.praeposition", "MID",
    "____ eines Spezialprogramms lassen sich die Daten in wenigen Minuten auswerten.",
    ["Trotz", "Mithilfe", "Außerhalb", "Angesichts"], 1,
    "Genitivpräposition „mithilfe“ (Mittel)"),
  sentence("konjunktiv_i", "HARD",
    "Die Ministerin betonte, die Lage ____ nicht so ernst, wie viele glaubten (Konjunktiv I).",
    ["ist", "wäre", "sei", "war"], 2,
    "Konjunktiv I in der indirekten Rede (3. Person Singular von „sein“: sei)"),
];

// ================================================================ LISTENING (10)

const L1 = "course-b2-a-l1";
const L2 = "course-b2-a-l2";
const L3 = "course-b2-a-l3";
const L4 = "course-b2-a-l4";
const L5 = "course-b2-a-l5";
const L6 = "course-b2-a-l6";

const listening1 = clip(
  L1,
  "Telefonansage des Bürgeramts",
  "Dienstleistungen: Behörde und Termine",
  [{ label: "Ansage", voice: "B" }],
  [
    "Ansage: Sie haben das Bürgeramt Süd erreicht. Unsere Telefonzeiten sind montags bis freitags von acht bis zwölf Uhr. Bitte beachten Sie: Termine für Reisepässe und Personalausweise vergeben wir ausschließlich im Internet, auf der Seite der Stadt. Telefonisch können wir leider keine Termine mehr vereinbaren.",
    "Ansage: Für dringende Fälle, zum Beispiel wenn Ihr Pass innerhalb von zwei Tagen abläuft, gibt es eine offene Sprechstunde, montags bis mittwochs von acht bis zehn Uhr, ohne Termin. Fragen zur Anmeldung Ihres Wohnsitzes beantwortet Ihnen gern unser Team unter der Durchwahl zwei, drei, vier. Bitte halten Sie Ihren Personalausweis bereit.",
  ],
  2,
);

const listening2 = clip(
  L2,
  "Wetterbericht im Radio",
  "Klima und Wetter: Wettervorhersage",
  [{ label: "Sprecherin", voice: "D" }],
  [
    "Sprecherin: Und nun das Wetter für morgen. Im Norden bleibt es regnerisch, bei Temperaturen um zwölf Grad. In der Mitte Deutschlands wechseln sich Wolken und Sonne ab, hier werden bis zu achtzehn Grad erreicht. Im Süden scheint dagegen den ganzen Tag die Sonne, die Höchstwerte liegen bei zweiundzwanzig Grad.",
    "Sprecherin: Am Abend zieht dann von Westen her ein Gewitter auf. Den Süden erreicht es aber erst am Donnerstag. Der Wind weht überwiegend schwach. Am Freitag ist schließlich im ganzen Land mit Regen zu rechnen.",
  ],
  2,
);

const listening3 = clip(
  L3,
  "Ansage in der Stadtbibliothek",
  "Bildung und Freizeit: Bibliothek",
  [{ label: "Ansage", voice: "A" }],
  [
    "Ansage: Liebe Besucherinnen und Besucher der Stadtbibliothek, in zwanzig Minuten schließen wir. Bitte bringen Sie Ihre Medien jetzt zur Ausleihe, damit wir sie noch buchen können.",
    "Ansage: Eine Neuerung ab kommendem Montag: Bücher, CDs und Spiele können Sie dann rund um die Uhr an unserem neuen Rückgabeautomaten vor dem Eingang zurückgeben, auch wenn die Bibliothek geschlossen ist. Die Leihfrist bleibt bei vier Wochen, Verlängerungen sind weiterhin im Internet möglich. Und noch ein Hinweis: Am Samstag ist die Bibliothek wegen einer Veranstaltung erst ab zwölf Uhr geöffnet.",
  ],
  2,
);

const listening4 = clip(
  L4,
  "Verbraucherinformation im Radio",
  "Konsum: Rückruf eines Lebensmittels",
  [{ label: "Sprecher", voice: "C" }],
  [
    "Sprecher: Eine Verbraucherinformation. Der Hersteller Bergquell ruft Fruchtjoghurt der Sorte Kirsche mit dem Mindesthaltbarkeitsdatum zwölfter November zurück. In einzelnen Bechern können kleine Plastikteile enthalten sein. Betroffen sind nur Becher aus Supermärkten in Bayern und Baden-Württemberg. Verletzungen sind bisher nicht bekannt.",
    "Sprecher: Wer den Joghurt gekauft hat, isst ihn bitte nicht mehr. Sie können den Becher in jeder Filiale zurückgeben und bekommen den Kaufpreis erstattet, auch ohne Kassenbon. Alle anderen Sorten sind nicht betroffen.",
  ],
  2,
);

const listening5 = clip(
  L5,
  "Ansage im Kino",
  "Freizeit: Kino und Kundenservice",
  [{ label: "Ansage", voice: "D" }],
  [
    "Ansage: Guten Abend, meine Damen und Herren. Die Vorstellung im Kino Zwei beginnt mit etwa fünfzehn Minuten Verspätung. Der Grund ist ein technischer Defekt am Projektor, der gerade repariert wird.",
    "Ansage: Wer nicht warten möchte, kann sein Ticket an der Kasse zurückgeben und bekommt das Geld zurück. Wer wartet, erhält am Tresen ein kostenloses Getränk. Einen Gutschein für einen weiteren Kinobesuch können wir leider nicht anbieten. Die Vorstellung endet dadurch erst gegen dreiundzwanzig Uhr. Wir bitten um Ihr Verständnis.",
  ],
  2,
);

const listening6 = clip(
  L6,
  "Gespräch: Spanisch lernen mit App oder Kurs?",
  "Sprache und Kommunikation: Fremdsprachen lernen",
  [
    { label: "Elena", voice: "D" },
    { label: "Tomasz", voice: "C" },
  ],
  [
    "Elena: Na, Tomasz, wie läuft dein Spanisch? Ich habe gehört, du lernst jetzt jeden Tag.",
    "Tomasz: Ja, seit drei Monaten. Jeden Morgen zwanzig Minuten mit einer App, in der Bahn. Es macht wirklich Spaß, ich habe schon fast neunzig Tage ohne Pause geschafft.",
    "Elena: Beeindruckend. Und kannst du dich schon unterhalten?",
    "Tomasz: Na ja, eher nicht. Ich verstehe Texte ganz gut und kann Sätze bilden. Aber als ich neulich mit einer Kollegin gesprochen habe, die Spanisch als Muttersprache spricht, habe ich nach drei Sätzen den Faden verloren. Sie spricht viel schneller, als ich es aus der App kenne.",
    "Elena: Das ist typisch. Die Apps trainieren Vokabeln, aber kaum das Sprechen. Ich habe vor zwei Jahren Italienisch gelernt, erst auch nur mit einer App, und dann habe ich einen Abendkurs gebucht. Der Unterschied war riesig.",
    "Tomasz: Weil man dort mit Menschen redet?",
    "Elena: Genau. Und weil man Fehler macht, ohne dass es peinlich ist. Die Lehrerin hat mich ständig korrigiert, das hat anfangs genervt, aber es hat mich weitergebracht.",
    "Tomasz: Ein Kurs ist aber teurer. Und ich weiß nicht, ob ich nach der Arbeit noch zweimal pro Woche in einen Raum fahren will. Außerdem brauche ich Spanisch eigentlich nur für meinen Urlaub im Mai, in Andalusien. Bis dahin reicht es vielleicht auch so.",
    "Elena: Dann such dir doch einen Tandempartner. Es gibt Plattformen, da findest du jemanden, der Spanisch spricht und Deutsch lernen will. Ihr trefft euch online oder im Café und redet abwechselnd in beiden Sprachen.",
    "Tomasz: Das klingt nach einer guten Mischung. Kostenlos, flexibel, und ich müsste mich nicht in einen Kurs setzen.",
    "Elena: Ja, aber verlass dich nicht nur darauf. Eine Freundin von mir hat es versucht, und nach drei Wochen waren beide zu beschäftigt. Setzt euch feste Termine, sonst versandet das.",
    "Tomasz: Gut, dann probiere ich es aus. Ich schreibe heute Abend gleich ein Profil.",
  ],
  1,
);

// ================================================================ WRITING (1)

const writing = writingTask(
  "opinion",
  "MID",
  "In einem Online-Forum Ihrer Stadt wird diskutiert: „Soll in allen Wohngebieten Tempo 30 gelten?“ Schreiben Sie einen Beitrag für das Forum.\n\n" +
    "- Äußern Sie Ihre Meinung und begründen Sie sie mit einem Beispiel.\n" +
    "- Nennen Sie ein Gegenargument und gehen Sie darauf ein.\n" +
    "- Machen Sie einen Vorschlag, wie man den Verkehr in Wohngebieten aus Ihrer Sicht sinnvoll regeln könnte, und erklären Sie, welchen Nutzen das hätte.\n\n" +
    "Schreiben Sie ca. 120-150 Wörter. Denken Sie an eine passende Einleitung und einen Schluss.",
  [
    "Eigene Meinung zu Tempo 30 klar formuliert UND mit einem konkreten Beispiel begründet (z. B. Sicherheit der Kinder, Lärm, Fahrzeit)",
    "Ein Gegenargument genannt (z. B. längere Fahrzeiten, mehr Stau, Nachteile für Handwerk und Handel) UND darauf eingegangen (entkräftet oder relativiert)",
    "Vorschlag zur Regelung des Verkehrs in Wohngebieten genannt, passend zur eigenen Meinung (z. B. Tempo 30 nur vor Schulen oder nachts, Probephase, mehr Kontrollen, Zebrastreifen, Tempo 50 beibehalten) UND den Nutzen des Vorschlags erklärt",
  ],
  [
    "Ihre Meinung mit einem Beispiel begründen",
    "ein Gegenargument nennen und darauf eingehen",
    "einen Vorschlag zur Regelung machen und seinen Nutzen erklären",
  ],
  REGISTER.forum,
  "Forumsbeitrag mit Meinung: drei Leitpunkte mit je zwei Teilaspekten, Einleitung und Schluss erwartet, keine formelle Anrede nötig. Erwartet werden Konnektoren, Nebensätze, Konjunktiv II für Vorschläge und abwägende Formulierungen.",
);

// ================================================================ SPEAKING (3)

const speaking = [
  introductionTask(
    ["Name", "Stadt oder Region, in der Sie leben", "beruflicher Werdegang (Ausbildung, Stationen)", "ein Hobby, das Ihnen wichtig ist", "Sprachen und Ihre Ziele mit Deutsch"],
    [
      "Name und Stadt oder Region genannt",
      "beruflicher Werdegang mit Ausbildung und mindestens einer Station",
      "ein Hobby genannt und erklärt, warum es wichtig ist",
      "Sprachen genannt, Ziele mit Deutsch beschrieben",
    ],
  ),
  presentationTask(
    "Reparieren oder neu kaufen?",
    [
      "Was haben Sie zuletzt reparieren lassen oder neu gekauft? Erzählen Sie kurz.",
      "Welche Vor- und Nachteile hat es, defekte Dinge zu reparieren?",
      "Welche Rolle spielen Preis, Umwelt und Bequemlichkeit bei Ihrer Entscheidung?",
      "Was sollten Hersteller und Politik tun, damit sich Reparaturen mehr lohnen? Begründen Sie Ihre Meinung.",
    ],
    [
      "Thema vorgestellt, eigenes Beispiel für Reparatur oder Neukauf",
      "Vor- und Nachteile des Reparierens mit Beispielen",
      "Preis, Umwelt und Bequemlichkeit abgewogen",
      "Vorschläge an Hersteller oder Politik mit Begründung und Schluss",
    ],
  ),
  proposalTask(
    "Sprechen Sie bitte über einen Vorschlag. Ihr Team möchte einmal im Quartal einen Freiwilligentag einführen: An diesem Tag helfen alle während der Arbeitszeit bei einem sozialen Projekt. Was halten Sie davon?",
    [
      "Nennen Sie Argumente dafür.",
      "Nennen Sie Argumente dagegen.",
      "Machen Sie einen eigenen Vorschlag, wie man beide Seiten berücksichtigen könnte.",
      "Kommen Sie zu einem Ergebnis: Würden Sie den Vorschlag unterstützen? Warum?",
    ],
    [
      "mindestens zwei Argumente für den Vorschlag (z. B. Teamgeist, gesellschaftliche Verantwortung)",
      "mindestens zwei Argumente dagegen (z. B. Arbeitszeit, Kosten, Terminplanung)",
      "eigener Vorschlag oder Kompromiss (z. B. freiwillige Teilnahme, kleinere Gruppen)",
      "klares Ergebnis mit Begründung",
    ],
  ),
];

export const FINAL_A: SeedCourseForm = {
  key: "B2",
  form: "A",
  syllabus: FINAL_SYLLABUS,
  sections: [
    {
      section: "READING",
      stimuli: [reading1, reading2],
      items: [
        tfng("READING", R1, "detail", "MID",
          [
            ["Viele Menschen, die Nachrichten meiden, begründen das damit, dass die Berichte sie belasten.", "R"],
            ["Die Umfrage wurde in mehr als zehn Ländern durchgeführt.", "NG"],
            ["Selma Yilmaz sieht in der Nachrichtenmüdigkeit vor allem mangelndes Interesse am Weltgeschehen.", "F"],
            ["Lösungsorientierte Beiträge sind für die Redaktionen aufwendiger als herkömmliche Berichte.", "NG"],
            ["Beiträge, die auch Lösungsansätze zeigen, werden nach ersten Auswertungen länger gelesen.", "R"],
          ],
          "1: „Als Grund nannten viele Befragte, dass die Berichte sie belasteten.“ 2: Der Text nennt die Umfrage „international“, aber keine Zahl von Ländern. 3: Yilmaz warnt davor, Nachrichtenmüdigkeit „als Desinteresse zu deuten“. 4: Über den Aufwand für die Redaktionen sagt der Text nichts. 5: „Erste Auswertungen zeigen, dass solche Beiträge ... länger gelesen werden.“"),
        whichText(R2, "detail", "MID",
          "Welcher Text nennt eine Ermäßigung für bestimmte Personengruppen?",
          ["Text A", "Text B", "Text C"], 2,
          "Text C: Studierende und Auszubildende zahlen lediglich 29 statt 49 Euro. Text A nennt eine kostenlose Teilnahme für alle, Text B erwähnt Billigflüge, aber keinen Preisnachlass für eine Gruppe."),
        whichText(R2, "detail", "MID",
          "Welcher Text nennt einen Termin, für den man rechtzeitig Bescheid geben muss?",
          ["Text A", "Text B", "Text D"], 0,
          "Text A: Informationsveranstaltung am 12. Dezember, Anmeldung bis zum 9. Dezember. Text B und Text D nennen keinen Termin."),
        whichText(R2, "inference", "MID",
          "Wessen Vorstellung von einer Reise hat sich als falsch erwiesen?",
          ["Text A", "Text C", "Text D"], 2,
          "Text D: Der Verfasser hielt die Radreise „für eine Art Pauschalurlaub für Bequeme“ und war überrascht, wie anstrengend sie war. Text A und Text C sind Mitteilung und Anzeige ohne eigene Erfahrung."),
        whichText(R2, "gist", "MID",
          "Wer hat seine Reisegewohnheiten aus ökologischen Gründen umgestellt?",
          ["Text A", "Text B", "Text C"], 1,
          "Text B: Die Verfasserin fliegt nach einem Blick in einen CO2-Rechner nicht mehr und fährt mit dem Zug. Text A ruft erst zu Fahrgemeinschaften auf, Text C wirbt für ein Ticket."),
        whichText(R2, "detail", "MID",
          "Wo werden Personen belohnt, die ihr Auto mit anderen teilen?",
          ["Text A", "Text C", "Text D"], 0,
          "Text A: Wer mindestens dreimal pro Woche Mitfahrende hat, bekommt einen reservierten Parkplatz. In Text C reist nur das Fahrrad kostenlos mit."),
      ],
    },
    {
      section: "GRAMMAR",
      stimuli: [],
      items: grammar,
    },
    {
      section: "LISTENING",
      stimuli: [listening1, listening2, listening3, listening4, listening5, listening6],
      items: [
        announcementQuestion(L1, "detail", "MID",
          "Wie bekommen Bürger einen Termin für einen neuen Reisepass?",
          [
            "Sie buchen den Termin im Internet.",
            "Sie rufen unter der Durchwahl zwei, drei, vier an.",
            "Sie kommen in die offene Sprechstunde.",
          ], 0,
          "Termine für Pässe gibt es „ausschließlich im Internet“. Die Durchwahl gilt für Fragen zur Anmeldung des Wohnsitzes, die offene Sprechstunde nur für dringende Fälle ohne Termin."),
        announcementQuestion(L2, "detail", "MID",
          "Wann erreicht das Gewitter den Süden Deutschlands?",
          [
            "Schon morgen Abend.",
            "Am Donnerstag.",
            "Am Freitag.",
          ], 1,
          "Morgen Abend zieht das Gewitter von Westen auf, den Süden erreicht es „erst am Donnerstag“. Für Freitag ist Regen im ganzen Land angekündigt."),
        announcementQuestion(L3, "detail", "MID",
          "Was ändert sich ab Montag in der Stadtbibliothek?",
          [
            "Medien können rund um die Uhr zurückgegeben werden.",
            "Die Leihfrist wird auf vier Wochen verlängert.",
            "Die Bibliothek öffnet samstags später.",
          ], 0,
          "Ab Montag gibt es einen Rückgabeautomaten. Die Leihfrist bleibt bei vier Wochen, und die späte Öffnung am Samstag betrifft nur eine einzelne Veranstaltung."),
        announcementQuestion(L4, "detail", "MID",
          "Was sollen Kunden mit dem betroffenen Joghurt tun?",
          [
            "Sie sollen ihn bis zum Haltbarkeitsdatum aufbrauchen.",
            "Sie sollen ihn nur mit Kassenbon umtauschen.",
            "Sie sollen ihn in einer Filiale zurückgeben.",
          ], 2,
          "Der Joghurt soll nicht mehr gegessen werden; man kann ihn in jeder Filiale zurückgeben, auch ohne Kassenbon."),
        announcementQuestion(L5, "detail", "MID",
          "Was bekommen Besucher, die auf den Beginn der Vorstellung warten?",
          [
            "Einen Gutschein für einen weiteren Kinobesuch.",
            "Den Preis des Tickets zurück.",
            "Ein kostenloses Getränk.",
          ], 2,
          "Wer wartet, erhält am Tresen ein kostenloses Getränk. Das Geld zurück bekommt nur, wer das Ticket zurückgibt; einen Gutschein gibt es nicht."),
        tfng("LISTENING", L6, "detail", "MID",
          [
            ["Tomasz lernt seit drei Monaten täglich mit einer App Spanisch.", "R"],
            ["Tomasz kann sich schon gut auf Spanisch unterhalten.", "F"],
            ["Elena meint, dass ein Kurs mehr Sprechpraxis bringt als eine App allein.", "R"],
            ["Elena hat ihren Italienischkurs mit einer Prüfung abgeschlossen.", "NG"],
            ["Elena hält feste Termine mit einem Tandempartner für überflüssig.", "F"],
          ],
          "1: „seit drei Monaten ... jeden Morgen zwanzig Minuten mit einer App“. 2: „Na ja, eher nicht.“ 3: „Der Unterschied war riesig“, weil man im Kurs mit Menschen redet. 4: Von einer Prüfung am Ende des Kurses ist nicht die Rede. 5: „Setzt euch feste Termine, sonst versandet das.“"),
      ],
    },
    { section: "WRITING", stimuli: [], items: [writing] },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
