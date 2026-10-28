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
 * Abschlusstest B2, Form B (spec 2026-10-28). Parallel to form A (final-a.ts): the same grammar phenomena in
 * the same proportions (cloze five gaps from each half, sentences seven and eight), new texts and sentences,
 * no item shared with form A or the Zwischentest B2.1.
 */

// ================================================================ READING (10)

const R1 = "course-b2-b-r1";
const R2 = "course-b2-b-r2";

const reading1 = readingText(
  R1,
  "Zeitungsartikel: Die Vier-Tage-Woche im Test",
  "Arbeit: Arbeitszeit und Vier-Tage-Woche",
  `
Vier Tage arbeiten, drei Tage frei, und das bei vollem Gehalt: Was vor einigen Jahren noch wie ein Traum klang, wird inzwischen in vielen Unternehmen ernsthaft diskutiert. In einem Pilotprojekt haben rund fünfzig deutsche Firmen ein halbes Jahr lang ausprobiert, ob ihre Beschäftigten in weniger Zeit genauso viel schaffen können. Die meisten Betriebe wollen das Modell nach dem Test beibehalten oder zumindest weiter erproben.

Der Geschäftsführer eines Softwareunternehmens in Köln, Daniel Mensah, war anfangs skeptisch. „Ich hatte Sorge, dass Kunden uns freitags nicht erreichen und wir Aufträge verlieren“, erzählt er. Inzwischen sieht er das anders. Die Teams hätten Besprechungen gekürzt und Abläufe vereinfacht, und die Zahl der Krankheitstage sei deutlich gesunken. Damit Kunden trotzdem an jedem Werktag jemanden erreichen, arbeiten die Beschäftigten nun in zwei Gruppen mit unterschiedlichen freien Tagen.

Nicht in allen Branchen lässt sich das Modell jedoch so leicht übertragen. In Krankenhäusern, Pflegeheimen oder im Einzelhandel muss die Arbeit von Menschen erledigt werden, die vor Ort sind. Wenn dort jeder einen Tag weniger arbeitet, braucht man mehr Personal, das ohnehin schon fehlt. Einige Pflegeeinrichtungen setzen deshalb auf längere Schichten an vier Tagen, was aber nicht alle Beschäftigten als Entlastung empfinden.

Die Arbeitsforscherin Katharina Brandt warnt außerdem vor zu viel Druck: Wer dieselbe Arbeit in kürzerer Zeit erledigen solle, mache weniger Pausen und sei am Ende des Tages erschöpft. Entscheidend sei deshalb nicht nur die Zahl der Arbeitstage, sondern auch, wie viele Aufgaben realistisch zu schaffen seien. Ihr Rat an die Unternehmen: zuerst überflüssige Termine und Abläufe streichen und erst danach die Arbeitszeit verkürzen.
`,
);

const reading2 = readingText(
  R2,
  "Vier Texte zum Thema Gesundheit und Sport",
  "Gesundheit: Gesundheitstag, Laufen, Yogakurs, Fitnessuhr",
  `
Text A: Aushang in der Kantine
Gesundheitstag am 20. März. Liebe Kolleginnen und Kollegen, auf Anregung vieler von Ihnen veranstalten wir am Donnerstag, dem 20. März, von 10 bis 15 Uhr in der Kantine erstmals einen Gesundheitstag. Neben einer Blutdruckmessung und einer Ernährungsberatung bietet eine Physiotherapeutin ein halbstündiges Rückentraining an, das sich besonders an Beschäftigte mit Bildschirmarbeitsplatz richtet. Die Teilnahme ist kostenlos und wird als Arbeitszeit angerechnet. Da für das Rückentraining nur zwanzig Plätze zur Verfügung stehen, melden Sie sich hierfür bitte bis zum 14. März in der Personalabteilung an. Ihr Betriebsrat

Text B: Beitrag in einem Sportforum
Vor einem Jahr hat mir mein Arzt wegen ständiger Rückenschmerzen zu mehr Bewegung geraten, also habe ich mit dem Laufen angefangen. Den Fehler, den wohl fast alle Anfänger machen, habe ich natürlich auch gemacht: Ich bin viel zu schnell gestartet und hatte nach zwei Wochen Knieschmerzen und keine Lust mehr. Lauft lieber langsam, auch wenn es sich anfangs fast peinlich anfühlt, und legt zwischen zwei Trainingstagen immer eine Pause ein. Heute schaffe ich zehn Kilometer, und meine Rückenschmerzen sind so gut wie verschwunden. Tobias

Text C: Kursanzeige
Yoga für Einsteiger: Mit sanften Übungen werden Sie beweglicher und lernen, im Alltag besser mit Stress umzugehen. Der Kurs umfasst zehn Termine, jeweils mittwochs von 18 bis 19.30 Uhr in der Volkshochschule Mitte. Die Gebühr beträgt 95 Euro; viele Krankenkassen übernehmen bis zu 80 Prozent davon, vorausgesetzt, Sie haben an mindestens acht Terminen teilgenommen. Bitte bringen Sie eine Decke und bequeme Kleidung mit. Ein Einstieg ist jederzeit möglich, solange noch Plätze frei sind.

Text D: Blogeintrag
Einen Monat lang habe ich jeden Schritt, jede Stunde Schlaf und jeden Pulsschlag mit einer Fitnessuhr aufgezeichnet, die mich immerhin 250 Euro gekostet hatte. Eigentlich sollten mich die Zahlen motivieren. Tatsächlich habe ich schlechter geschlafen, weil ich abends immer wieder kontrolliert habe, ob ich mein Tagesziel erreicht hatte, und mich geärgert habe, wenn nicht. Inzwischen trage ich die Uhr nur noch beim Sport, und siehe da: Bewegung macht mir wieder Spaß. Amira
`,
);

// ================================================================ GRAMMAR (25)

const cloze = cloze3("MID", {
  title: "Leihen statt kaufen",
  first:
    "In einem Stadtteil von Bremen gibt es seit zwei Jahren eine ungewöhnliche Bibliothek: Statt Büchern kann man dort Bohrmaschinen, Zelte und Nähmaschinen ausleihen.",
  body:
    "Gegründet wurde sie von einem pensionierten [[Architekten|Architekt|Architektes#n_deklination]], der sich über volle Keller und ungenutzte Geräte ärgerte. " +
    "Ohne die Unterstützung der Stadt [[hätte|wäre|würde#konjunktiv2.vergangenheit]] der Verein allerdings keinen passenden Raum gefunden. " +
    "Mitglieder dürfen bis zu drei Gegenstände gleichzeitig ausleihen, [[solange|obwohl|sodass#konnektor]] sie diese pünktlich zurückbringen. " +
    "Alle [[zurückgegebenen|zurückgebenden|zurückgegeben#partizipattribut]] Geräte werden von Ehrenamtlichen geprüft, und kleine Schäden [[lassen|werden|müssen#passiversatz]] sich oft mit wenig Aufwand beheben. " +
    "Besonders gefragt ist ein Lastenfahrrad, [[mit dem|mit der|mit denen#relativsatz.praeposition]] Familien ihre Einkäufe transportieren. " +
    "Die Mitglieder sparen [[sowohl|weder|entweder#konnektor.zweiteilig]] Geld als auch Platz in ihren Wohnungen. " +
    "Viele achten inzwischen auch beim Einkaufen stärker [[darauf|daran|dafür#verb_praeposition]], nur noch Dinge zu kaufen, die sie wirklich brauchen. " +
    "Der Gründer erklärt, man [[könne|können|könnest#konjunktiv_i]] fast alles ausleihen, was man nur selten braucht. " +
    "Nach Angaben des Vereins [[sollen|wollen|dürfen#modalverb_subjektiv]] im letzten Jahr über dreitausend Gegenstände ausgeliehen worden sein.",
  last: "Nun plant der Verein eine zweite Ausleihstelle im Nachbarviertel.",
  note:
    "Lücke 1: n-Deklination (Dativ Singular nach „von einem“: Architekten). Lücke 2: Konjunktiv II der Vergangenheit („finden“ bildet das Perfekt mit „haben“). " +
    "Lücke 3: Konnektor „solange“ (Bedingung). Lücke 4: Partizip II als Attribut (Nominativ Plural nach „alle“: -en). " +
    "Lücke 5: Passiversatz mit „sich lassen“ + Infinitiv. Lücke 6: Relativsatz mit Präposition („mit“ + Dativ, neutrum: mit dem). " +
    "Lücke 7: zweiteiliger Konnektor „sowohl ... als auch“. Lücke 8: Verb mit Präposition („achten auf“, Präpositionaladverb „darauf“). " +
    "Lücke 9: Konjunktiv I in der indirekten Rede (3. Person Singular: „könne“). Lücke 10: subjektiver Gebrauch von „sollen“ (Aussage Dritter, „nach Angaben“).",
});

const grammar = [
  cloze,
  sentence("partizipattribut", "HARD",
    "Der seit Stunden laut ____ Hund raubte den Nachbarn den Schlaf.",
    ["bellende", "gebellte", "bellenden", "zu bellende"], 0,
    "Erweitertes Partizipialattribut mit Partizip I (gleichzeitige, aktive Handlung; Nominativ Singular nach „der“: -e)"),
  sentence("konjunktiv_i", "MID",
    "Die Mieterin erklärte, sie ____ die Miete pünktlich überwiesen (Konjunktiv I).",
    ["hatte", "hätte", "hat", "habe"], 3,
    "Konjunktiv I in der indirekten Rede (3. Person Singular, Perfekt: habe + Partizip II)"),
  sentence("konnektor", "MID",
    "Der Zug hatte eine Stunde Verspätung. ____ verpasste Frau Okafor ihren Anschluss in Köln.",
    ["Dennoch", "Folglich", "Stattdessen", "Andernfalls"], 1,
    "Adverbkonnektor mit konsekutiver Bedeutung („folglich“) und Inversion"),
  sentence("konnektor.zweiteilig", "MID",
    "Sie haben zwei Möglichkeiten: Sie schicken die Unterlagen ____ per Post, ____ Sie bringen sie persönlich vorbei.",
    ["zwar ... aber", "entweder ... oder", "weder ... noch", "je ... desto"], 1,
    "Zweiteiliger Konnektor „entweder ... oder“ (Alternative)"),
  sentence("passiv.modal", "MID",
    "Es ist noch unklar, wann die Brücke wieder ____ darf.",
    ["wird befahren", "befahren wird", "befahren werden", "werden befahren"], 2,
    "Passiv mit Modalverb im Nebensatz (Satzklammer: befahren werden darf)"),
  sentence("futur2", "HARD",
    "Im Büro ist alles dunkel. Die Kollegen ____ wohl schon nach Hause gegangen sein.",
    ["haben", "hätten", "sind", "werden"], 3,
    "Futur II als Vermutung über Vergangenes (werden ... gegangen sein)"),
  sentence("relativsatz", "MID",
    "Die Firma, ____ Produkte wir seit Jahren vertreiben, hat einen neuen Besitzer.",
    ["deren", "dessen", "der", "die"], 0,
    "Relativsatz mit Genitivpronomen („deren“, Bezugswort feminin)"),
  sentence("verb_praeposition", "MID",
    "Wir müssen uns noch ____ das Hotel für die Konferenz kümmern.",
    ["an", "auf", "für", "um"], 3,
    "Verb mit Präposition („sich kümmern um“ + Akkusativ)"),
  sentence("konjunktiv2.vergangenheit", "MID",
    "An deiner Stelle ____ ich das Angebot sofort angenommen.",
    ["wäre", "hätte", "hatte", "würde"], 1,
    "Konjunktiv II der Vergangenheit für einen Rat im Nachhinein (hätte + Partizip II)"),
  sentence("n_deklination", "MID",
    "Haben Sie schon mit dem neuen ____ gesprochen?",
    ["Kollegen", "Kollege", "Kolleges", "Kollegens"], 0,
    "n-Deklination (Dativ Singular: dem Kollegen)"),
  sentence("konnektor", "MID",
    "Sie verbessert ihre Aussprache, ____ sie jeden Tag deutsche Podcasts nachspricht.",
    ["obwohl", "damit", "indem", "bis"], 2,
    "Modaler Nebensatz mit „indem“ (Mittel, mit dem ein Ziel erreicht wird)"),
  sentence("nominal_verbalstil", "MID",
    "Wegen der Erkrankung des Fahrers fiel die Fahrt aus. Anders gesagt: ____ der Fahrer erkrankt war, fiel die Fahrt aus.",
    ["Obwohl", "Weil", "Damit", "Bevor"], 1,
    "Nominalstil zu Verbalstil: „wegen der Erkrankung“ wird zum kausalen Nebensatz mit „weil“"),
  sentence("modalpartikel", "MID",
    "Überall liegen Scherben. Was ist ____ hier passiert?",
    ["ja", "halt", "denn", "mal"], 2,
    "Modalpartikel „denn“ in der W-Frage (Überraschung, Interesse)"),
  sentence("genitiv.praeposition", "MID",
    "____ der Öffnungszeiten erreichen Sie uns über die Notfallnummer.",
    ["Mithilfe", "Außerhalb", "Anstelle", "Trotz"], 1,
    "Genitivpräposition „außerhalb“ (zeitlich)"),
  sentence("konjunktiv_i", "HARD",
    "Der Bürgermeister kündigte an, die Stadt ____ im nächsten Jahr zwei neue Schulen bauen (Konjunktiv I).",
    ["würde", "wird", "werde", "wurde"], 2,
    "Konjunktiv I in der indirekten Rede (3. Person Singular von „werden“: werde, Zukunft)"),
];

// ================================================================ LISTENING (10)

const L1 = "course-b2-b-l1";
const L2 = "course-b2-b-l2";
const L3 = "course-b2-b-l3";
const L4 = "course-b2-b-l4";
const L5 = "course-b2-b-l5";
const L6 = "course-b2-b-l6";

const listening1 = clip(
  L1,
  "Nachricht von der Volkshochschule",
  "Bildung und Arbeit: Weiterbildungskurs",
  [{ label: "Nachricht", voice: "A" }],
  [
    "Nachricht: Guten Tag, hier ist Petra Hoffmann von der Volkshochschule. Ich rufe wegen des Kurses „Bewerbungstraining“ an, für den Sie sich angemeldet haben. Der Kurs beginnt wie geplant am Dienstag, dem vierten März, um achtzehn Uhr. Wir mussten ihn allerdings verlegen: Er findet nicht im Hauptgebäude statt, sondern in der Schillerschule, Raum zwölf, gleich gegenüber vom Bahnhof.",
    "Nachricht: Bitte bringen Sie zum ersten Termin Ihren Lebenslauf mit, gern auf einem USB-Stick. Die Kursgebühr bleibt unverändert, und Sie müssen auch nichts weiter tun, Ihre Anmeldung gilt weiterhin. Bei Fragen erreichen Sie mich unter null vier zwei eins, fünf fünf, drei null.",
  ],
  2,
);

const listening2 = clip(
  L2,
  "Verkehrsmeldung im Radio",
  "Verkehr: Unfall und Umleitung",
  [{ label: "Sprecher", voice: "C" }],
  [
    "Sprecher: Und jetzt die Verkehrslage. Auf der A sieben in Richtung Hamburg ist nach einem Unfall zwischen Soltau-Ost und Bispingen die Fahrbahn voll gesperrt. Die Polizei rechnet damit, dass die Sperrung bis etwa vierzehn Uhr dauert. Bitte fahren Sie schon in Soltau-Ost ab und folgen Sie der Umleitung U zwölf.",
    "Sprecher: Auf die A eins sollten Sie nicht ausweichen, dort staut es sich wegen einer Baustelle bereits auf acht Kilometern. Und noch ein Hinweis für Pendler: Die Bahnstrecke zwischen Lüneburg und Hamburg ist wieder frei, die Züge fahren nach Plan.",
  ],
  2,
);

const listening3 = clip(
  L3,
  "Durchsage im Hafen",
  "Reise: Fähre und Wetter",
  [{ label: "Durchsage", voice: "B" }],
  [
    "Durchsage: Liebe Fahrgäste, wegen des starken Sturms fällt die Fähre nach Norderney um fünfzehn Uhr leider aus. Ob die Fähre um siebzehn Uhr fahren kann, entscheiden wir gegen sechzehn Uhr, je nachdem, wie sich der Wind entwickelt.",
    "Durchsage: Ihre Fahrkarten müssen Sie nicht umtauschen. Sie gelten automatisch für die nächste Fähre, die fährt. Wer heute nicht mehr reisen möchte, kann sich den Fahrpreis am Schalter erstatten lassen. Im Hafenrestaurant bekommen wartende Fahrgäste bis dahin einen kostenlosen Kaffee.",
  ],
  2,
);

const listening4 = clip(
  L4,
  "Information der Stadtreinigung im Radio",
  "Umwelt und Wohnen: Müllabfuhr",
  [{ label: "Sprecherin", voice: "D" }],
  [
    "Sprecherin: Eine Information der Stadtreinigung. Wegen des Feiertags am Freitag, dem dritten Oktober, werden die Tonnen, die sonst freitags geleert werden, erst am Samstag abgeholt. Für alle anderen Wochentage ändert sich nichts.",
    "Sprecherin: Bitte stellen Sie die Tonnen am Samstag bis sieben Uhr an die Straße. Der Sperrmüll im Stadtteil Ost wird dagegen nicht verschoben, er wird wie geplant am zehnten Oktober abgeholt. Gelbe Säcke erhalten Sie weiterhin kostenlos im Bürgerbüro.",
  ],
  2,
);

const listening5 = clip(
  L5,
  "Durchsage im Kaufhaus",
  "Konsum: Einkaufen und Öffnungszeiten",
  [{ label: "Durchsage", voice: "A" }],
  [
    "Durchsage: Liebe Kundinnen und Kunden, wegen unserer jährlichen Inventur schließt unser Kaufhaus heute bereits um achtzehn Uhr. Morgen sind wir wieder wie gewohnt bis zwanzig Uhr für Sie da.",
    "Durchsage: Bitte beachten Sie außerdem, dass die Rolltreppe in den zweiten Stock wegen Wartungsarbeiten außer Betrieb ist. Benutzen Sie bitte die Aufzüge neben dem Haupteingang. Und vergessen Sie nicht: Unsere Rabattaktion in der Sportabteilung läuft noch bis Samstag.",
  ],
  2,
);

const listening6 = clip(
  L6,
  "Gespräch: Ohne eigenes Auto leben?",
  "Konsum und Umwelt: Carsharing",
  [
    { label: "Sofia", voice: "D" },
    { label: "Emre", voice: "B" },
  ],
  [
    "Sofia: Emre, ich habe gehört, du hast dein Auto verkauft? Stimmt das?",
    "Emre: Ja, seit letztem Monat. Ich habe es kaum noch gebraucht. Zur Arbeit fahre ich mit dem Fahrrad, und am Wochenende stand es meistens nur vor dem Haus.",
    "Sofia: Und wenn du doch mal ein Auto brauchst? Zum Beispiel für einen Großeinkauf?",
    "Emre: Dann nehme ich ein Carsharing-Auto. Hier im Viertel gibt es drei Stationen, die nächste ist fünf Minuten zu Fuß entfernt. Ich buche das Auto per App und bezahle nach Stunden und Kilometern.",
    "Sofia: Ist das nicht teuer?",
    "Emre: Im Gegenteil. Ich habe nachgerechnet: Versicherung, Steuer, Reparaturen und der Platz in der Tiefgarage, das waren fast dreihundert Euro im Monat. Jetzt zahle ich vielleicht fünfzig.",
    "Sofia: Das klingt gut. Aber für mich wäre das nichts. Ich fahre jeden Tag zu meiner Mutter aufs Land, und da fährt kaum ein Bus.",
    "Emre: Klar, in deinem Fall lohnt sich das nicht. Carsharing ist eigentlich nur sinnvoll, wenn man selten fährt.",
    "Sofia: Und gibt es keine Nachteile?",
    "Emre: Doch, schon. Am Freitagabend sind die Autos oft alle ausgebucht. Letzte Woche wollte ich spontan an den See fahren und habe keins mehr bekommen. Seitdem plane ich solche Ausflüge ein paar Tage im Voraus.",
    "Sofia: Das wäre mir zu umständlich. Ich bin gern spontan.",
    "Emre: Am Anfang fand ich das auch. Aber man gewöhnt sich daran. Und ehrlich gesagt bin ich jetzt viel öfter draußen, weil ich mehr zu Fuß gehe.",
    "Sofia: Na gut, vielleicht überlege ich es mir, wenn ich irgendwann wieder in der Stadt arbeite.",
    "Emre: Dann zeige ich dir gern die App. Die erste Fahrt ist übrigens kostenlos.",
  ],
  1,
);

// ================================================================ WRITING (1)

const writing = writingTask(
  "opinion",
  "MID",
  "In einem Online-Forum Ihrer Stadt wird diskutiert: „Sollen Supermärkte verpflichtet werden, Lebensmittel, die sie nicht verkaufen, zu spenden?“ Schreiben Sie einen Beitrag für das Forum.\n\n" +
    "- Äußern Sie Ihre Meinung und begründen Sie sie.\n" +
    "- Beschreiben Sie, wer davon profitieren würde und welche Schwierigkeiten es geben könnte.\n" +
    "- Machen Sie einen Vorschlag, wie Geschäfte und Kundschaft gemeinsam weniger Lebensmittel wegwerfen könnten, und erklären Sie, warum er funktionieren würde.\n\n" +
    "Schreiben Sie ca. 120-150 Wörter. Denken Sie an eine passende Einleitung und einen Schluss.",
  [
    "Eigene Meinung zur Spendenpflicht klar formuliert UND begründet (z. B. Verschwendung, Hilfe für Bedürftige, Freiheit der Geschäfte)",
    "Nennen, wer profitieren würde (z. B. Tafeln, Menschen mit wenig Geld, Umwelt) UND mögliche Schwierigkeiten beschreiben (z. B. Hygiene, Transport, Kosten, Haftung)",
    "Vorschlag für Geschäfte und Kundschaft genannt (z. B. Rabatte kurz vor Ladenschluss, krummes Obst, Einkaufsliste) UND begründet, warum er funktionieren würde",
  ],
  [
    "Ihre Meinung begründen",
    "wer profitiert und welche Schwierigkeiten es gibt",
    "einen Vorschlag machen und begründen",
  ],
  REGISTER.forum,
  "Forumsbeitrag mit Meinung: drei Leitpunkte mit je zwei Teilaspekten, Einleitung und Schluss erwartet, keine formelle Anrede nötig. Erwartet werden Konnektoren, Nebensätze, Konjunktiv II für Vorschläge und abwägende Formulierungen.",
);

// ================================================================ SPEAKING (3)

const speaking = [
  introductionTask(
    ["Name", "Wohnort (Stadt oder Region) und was Ihnen dort gefällt", "Ihr Arbeits- oder Studienalltag", "Sport, Kultur oder Engagement in Ihrer Freizeit", "Ihre Erfahrungen mit dem Deutschlernen"],
    [
      "Name und Wohnort (Stadt oder Region) genannt, mit etwas, das gefällt",
      "Arbeits- oder Studienalltag kurz beschrieben",
      "Freizeit (Sport, Kultur oder Engagement) mit mindestens einem Beispiel",
      "Erfahrungen mit dem Deutschlernen geschildert",
    ],
  ),
  presentationTask(
    "Klimaschutz im Alltag",
    [
      "Was tun Sie selbst für den Klimaschutz? Nennen Sie Beispiele.",
      "Was fällt vielen Menschen dabei schwer, und warum?",
      "Welche Rolle sollten Staat und Unternehmen spielen?",
      "Lohnt sich der Einsatz jedes Einzelnen? Begründen Sie Ihre Meinung.",
    ],
    [
      "Thema vorgestellt, eigene Beispiele für Klimaschutz im Alltag",
      "Schwierigkeiten genannt und erklärt",
      "Rolle von Staat und Unternehmen beschrieben",
      "eigene Meinung zum Einsatz des Einzelnen mit Begründung und Schluss",
    ],
  ),
  proposalTask(
    "Sprechen Sie bitte über einen Vorschlag. Ihre Firma möchte die festen Schreibtische abschaffen: Wer ins Büro kommt, sucht sich jeden Morgen einen freien Platz. Was halten Sie davon?",
    [
      "Was spricht für diesen Vorschlag?",
      "Was spricht dagegen?",
      "Welche Lösung könnte für alle passen? Machen Sie einen eigenen Vorschlag.",
      "Kommen Sie zu einem Ergebnis und begründen Sie es.",
    ],
    [
      "mindestens zwei Argumente dafür (z. B. weniger Bürofläche, Kontakt zu anderen Teams, Kosten)",
      "mindestens zwei Argumente dagegen (z. B. Platzsuche, persönliche Sachen, Lärm, Gewohnheit)",
      "eigener Vorschlag oder Kompromiss (z. B. Buchung per App, feste Teambereiche, Schließfächer)",
      "klares Ergebnis mit Begründung",
    ],
  ),
];

export const FINAL_B: SeedCourseForm = {
  key: "B2",
  form: "B",
  syllabus: FINAL_SYLLABUS,
  sections: [
    {
      section: "READING",
      stimuli: [reading1, reading2],
      items: [
        tfng("READING", R1, "detail", "MID",
          [
            ["Die Firmen des Pilotprojekts haben die Vier-Tage-Woche ein halbes Jahr lang getestet.", "R"],
            ["Daniel Mensah hat die Vier-Tage-Woche von Anfang an begeistert unterstützt.", "F"],
            ["In Mensahs Firma haben alle Beschäftigten am selben Tag frei.", "F"],
            ["In der Pflege lehnen die Gewerkschaften die Vier-Tage-Woche ab.", "NG"],
            ["Katharina Brandt empfiehlt, die Arbeitszeit erst zu verkürzen, wenn überflüssige Termine gestrichen sind.", "R"],
          ],
          "1: „ein halbes Jahr lang ausprobiert“. 2: Mensah „war anfangs skeptisch“. 3: Die Beschäftigten arbeiten „in zwei Gruppen mit unterschiedlichen freien Tagen“. 4: Gewerkschaften werden im Text nicht erwähnt. 5: „zuerst überflüssige Termine und Abläufe streichen und erst danach die Arbeitszeit verkürzen“."),
        whichText(R2, "gist", "MID",
          "Welcher Text wendet sich an die Belegschaft eines Unternehmens?",
          ["Text A", "Text B", "Text D"], 0,
          "Text A: Aushang des Betriebsrats an die Kolleginnen und Kollegen. Text B richtet sich an Laufanfänger im Forum, Text D ist ein persönlicher Blog."),
        whichText(R2, "detail", "MID",
          "Wo kann man einen Teil des Geldes zurückbekommen?",
          ["Text A", "Text C", "Text D"], 1,
          "Text C: Viele Krankenkassen übernehmen bis zu 80 Prozent der Gebühr. Text A ist kostenlos, Text D nennt nur den Preis der Uhr."),
        whichText(R2, "inference", "MID",
          "Wer berichtet, dass ein Hilfsmittel eine andere Wirkung hatte als erhofft?",
          ["Text B", "Text C", "Text D"], 2,
          "Text D: Die Fitnessuhr sollte motivieren, stattdessen schlief die Verfasserin schlechter. Text B beschreibt einen falschen Start beim Laufen, aber kein Hilfsmittel."),
        whichText(R2, "detail", "MID",
          "Wer warnt Einsteiger vor einem typischen Fehler?",
          ["Text A", "Text B", "Text D"], 1,
          "Text B: Den Fehler „viel zu schnell gestartet“ machen fast alle Anfänger, deshalb: „Lauft lieber langsam.“ Text D berichtet nur von eigenen Erfahrungen, Text A lädt zu einem Gesundheitstag ein."),
        whichText(R2, "detail", "MID",
          "Wo ist eine Teilnahme nur nach rechtzeitiger Rückmeldung möglich?",
          ["Text A", "Text C", "Text D"], 0,
          "Text A: Für das Rückentraining muss man sich bis zum 14. März anmelden. In Text C ist ein Einstieg jederzeit möglich, solange Plätze frei sind."),
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
          "Was ändert sich am Kurs „Bewerbungstraining“?",
          [
            "Der Kurs beginnt an einem anderen Tag.",
            "Der Kurs findet an einem anderen Ort statt.",
            "Die Kursgebühr wird erhöht.",
          ], 1,
          "Der Kurs ist in die Schillerschule verlegt. Er beginnt „wie geplant“ am vierten März, und die Kursgebühr „bleibt unverändert“."),
        announcementQuestion(L2, "detail", "MID",
          "Was empfiehlt der Sprecher den Autofahrern auf der A sieben?",
          [
            "Sie sollen auf die A eins ausweichen.",
            "Sie sollen auf die Bahn umsteigen.",
            "Sie sollen der Umleitung folgen.",
          ], 2,
          "„Fahren Sie schon in Soltau-Ost ab und folgen Sie der Umleitung U zwölf.“ Von der A eins rät er ab (Stau), der Hinweis zur Bahn gilt den Pendlern."),
        announcementQuestion(L3, "detail", "MID",
          "Was gilt für die Fahrkarten der ausgefallenen Fähre?",
          [
            "Sie gelten für die nächste Fähre, die fährt.",
            "Sie müssen am Schalter umgetauscht werden.",
            "Der Fahrpreis wird automatisch zurückgezahlt.",
          ], 0,
          "„Sie gelten automatisch für die nächste Fähre, die fährt.“ Umtauschen muss man sie nicht, und erstattet wird der Fahrpreis nur am Schalter für alle, die nicht mehr reisen möchten."),
        announcementQuestion(L4, "detail", "MID",
          "Was ändert sich für Haushalte, deren Tonnen sonst am Freitag geleert werden?",
          [
            "Ihr Sperrmüll wird später abgeholt.",
            "Ihre Tonnen werden erst am Samstag geleert.",
            "Sie bekommen ab jetzt kostenlose gelbe Säcke.",
          ], 1,
          "Die Freitagstonnen werden „erst am Samstag abgeholt“. Der Sperrmüll wird nicht verschoben, und gelbe Säcke gibt es „weiterhin“ kostenlos, das ist keine Änderung."),
        announcementQuestion(L5, "gist", "MID",
          "Warum schließt das Kaufhaus heute früher?",
          [
            "Wegen Wartungsarbeiten.",
            "Weil eine Rabattaktion endet.",
            "Wegen der Inventur.",
          ], 2,
          "„Wegen unserer jährlichen Inventur schließt unser Kaufhaus heute bereits um achtzehn Uhr.“ Die Wartung betrifft nur die Rolltreppe, die Rabattaktion läuft noch bis Samstag."),
        tfng("LISTENING", L6, "detail", "MID",
          [
            ["Emre hat sein Auto verkauft, weil er es kaum noch benutzt hat.", "R"],
            ["Emre hat sein Auto an einen Nachbarn verkauft.", "NG"],
            ["Mit Carsharing gibt Emre heute mehr Geld aus als früher für sein eigenes Auto.", "F"],
            ["Sofia fährt ein Elektroauto.", "NG"],
            ["Emre plant Ausflüge mit dem Carsharing-Auto inzwischen einige Tage im Voraus.", "R"],
          ],
          "1: „Ich habe es kaum noch gebraucht.“ 2: An wen Emre das Auto verkauft hat, wird nicht gesagt. 3: Früher fast dreihundert Euro im Monat, jetzt „vielleicht fünfzig“. 4: Sofia fährt täglich aufs Land, über ihr Auto sagt sie nichts. 5: „Seitdem plane ich solche Ausflüge ein paar Tage im Voraus.“"),
      ],
    },
    { section: "WRITING", stimuli: [], items: [writing] },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
