import { authorFor, noParts, type LevelParts } from "../author";
import { cloze } from "../cloze";

/**
 * Round 3 additions to the A2 bank (formats from the model tests: see docs/research/formats-2026-10-25.md).
 * Built with the shared helpers in ../author.ts; the instruction lines come from ../instructions.ts.
 *
 * Holds: two "four short statements" matching clips, three short announcements (one choice and one
 * richtig / falsch set each), two reply-to-a-message writing tasks and one letter-style cloze text.
 */
const a = authorFor("A2");

// ================================================================ LISTENING: four short statements

const lWeekend = a.clip(
  "wochenende-vier-personen",
  "Vier Personen: Das Wochenende",
  "Wochenende und Freizeit",
  [
    { label: "Katja", voice: "A" },
    { label: "Piotr", voice: "B" },
    { label: "Hakan", voice: "C" },
    { label: "Mia", voice: "D" },
  ],
  [
    "Katja: Hallo, ich bin Katja. Also, am Wochenende bin ich fast immer draußen. Ich gehe mit meinem Hund im Wald spazieren, am Samstag und am Sonntag, auch wenn es regnet. Das Wetter ist mir egal.",
    "Piotr: Guten Tag, mein Name ist Piotr. Na ja, am Samstagabend kommen oft Freunde zu mir, und ich koche für alle. Ins Kino gehe ich eigentlich nie, das ist mir zu teuer.",
    "Hakan: Ich bin Hakan. Am Samstag haben wir Training, und am Sonntag ist das Spiel. Ich spiele schon zehn Jahre Fußball im selben Verein. Das macht mir einfach Spaß.",
    "Mia: Hallo, hier ist Mia. Ich habe einen kleinen Garten hinter dem Haus. Dort pflanze ich Tomaten und Blumen, und am Wochenende bin ich oft von morgens bis abends da.",
  ],
);
const weekend = a.forClip(lWeekend);

const lBreakfast = a.clip(
  "fruehstueck-vier-personen",
  "Vier Personen: Das Frühstück",
  "Frühstück und Essen",
  [
    { label: "Greta", voice: "A" },
    { label: "Lukas", voice: "B" },
    { label: "Enes", voice: "C" },
    { label: "Ines", voice: "D" },
  ],
  [
    "Greta: Hallo, ich bin Greta. Zum Frühstück esse ich jeden Tag Müsli mit frischem Obst, meistens mit Äpfeln oder Beeren. Joghurt mag ich nicht so gern, der ist mir am Morgen zu schwer.",
    "Lukas: Mein Name ist Lukas. Am Sonntag gibt es bei uns zum Frühstück immer frische Brötchen. Ich esse sie mit Butter und Erdbeermarmelade, genau wie früher als Kind. Das ist für mich der schönste Teil der Woche.",
    "Enes: Ich bin Enes. Morgens brate ich mir zwei Eier mit Speck, das dauert nur fünf Minuten. Süßes am Morgen ist nichts für mich, ich mag es lieber herzhaft.",
    "Ines: Hallo, hier ist Ines. Na ja, morgens habe ich keinen Hunger. Ich trinke nur einen großen Kaffee mit Milch und gehe dann los. Essen kann ich später.",
  ],
);
const breakfast = a.forClip(lBreakfast);

// ================================================================ LISTENING: short announcements

const lMuseum = a.clip(
  "museum-fuehrung-durchsage",
  "Durchsage im Stadtmuseum",
  "Museum und Ausstellung",
  [{ label: "Durchsage", voice: "D" }],
  [
    "Durchsage: Liebe Besucherinnen und Besucher, herzlich willkommen im Stadtmuseum! Um halb drei beginnt heute die Führung durch die neue Ausstellung über alte Spielsachen. Wir treffen uns nicht im Café, sondern an der Kasse im Erdgeschoss. Die Führung kostet drei Euro, mit der Museumskarte ist sie kostenlos. Und noch etwas: Heute schließt das Museum schon um siebzehn Uhr. Ich wiederhole: schon um siebzehn Uhr. Vielen Dank!",
  ],
);
const museum = a.forClip(lMuseum);

const lBookshop = a.clip(
  "buchhandlung-nachricht",
  "Nachricht von der Buchhandlung",
  "Buchhandlung und Einkaufen",
  [{ label: "Herr Sommer", voice: "C" }],
  [
    "Herr Sommer: Guten Tag, Frau Aksoy, hier ist die Buchhandlung am Markt, Sommer am Apparat. Das Buch, das Sie bestellt haben, ist da! Sie können es ab morgen abholen. Wir haben von Montag bis Freitag bis halb sieben geöffnet, am Samstag nur bis zwölf Uhr. Ach nein, Entschuldigung, bis dreizehn Uhr. Sie müssen nicht zurückrufen. Falls Sie eine Frage haben: Unsere Nummer ist null sechs eins eins, vier zwei drei, sieben acht. Noch einmal: null sechs eins eins, vier zwei drei, sieben acht. Auf Wiederhören!",
  ],
);
const bookshop = a.forClip(lBookshop);

const lSports = a.clip(
  "sporthaus-radiowerbung",
  "Radiowerbung: Sporthaus Lang",
  "Werbung und Sport",
  [{ label: "Sprecherin", voice: "A" }],
  [
    "Sprecherin: Sie laufen gern oder fahren Rad? Dann ist jetzt die beste Zeit für das Sporthaus Lang in der Bahnhofstraße! Diese Woche gibt es Laufschuhe mit dreißig Prozent Rabatt, und Rucksäcke bekommen Sie schon ab neunzehn Euro neunzig. Die Aktion dauert nicht nur bis Freitag, sondern sogar bis Sonntag! Und am Samstag bekommen alle Kinder eine kleine Überraschung. Sporthaus Lang, Bahnhofstraße zwölf. Noch einmal: Bahnhofstraße zwölf!",
  ],
);
const sports = a.forClip(lSports);

const listeningItems = [
  weekend.match(
    "detail",
    "MID",
    "Hören Sie die vier Aussagen. Was machen die Personen am Wochenende? Ordnen Sie jeder Person eine Aktivität zu. Eine Aktivität bleibt übrig.",
    ["Katja", "Piotr", "Hakan", "Mia"],
    ["Im Garten arbeiten", "Fußball spielen", "Ins Kino gehen", "Mit dem Hund spazieren gehen", "Freunde zum Essen einladen"],
    [4, 5, 2, 1],
    "Katja: mit dem Hund im Wald spazieren gehen. Piotr: Freunde kommen, er kocht für alle (ins Kino geht er nie, die übrige Aktivität kommt also vor, aber verneint). Hakan: Training und Spiel im Fußballverein. Mia: Tomaten und Blumen im eigenen Garten. Übrig bleibt \"Ins Kino gehen\".",
  ),
  breakfast.match(
    "detail",
    "HARD",
    "Hören Sie die vier Aussagen. Was essen oder trinken die Personen zum Frühstück? Ordnen Sie jeder Person ein Frühstück zu. Ein Frühstück bleibt übrig.",
    ["Greta", "Lukas", "Enes", "Ines"],
    ["Joghurt mit Honig", "Brötchen mit Marmelade", "Eier mit Speck", "Müsli mit Obst", "Nur ein Kaffee"],
    [4, 2, 3, 5],
    "Greta: Müsli mit frischem Obst (Joghurt mag sie nicht). Lukas: frische Brötchen mit Butter und Erdbeermarmelade. Enes: Eier mit Speck, nichts Süßes. Ines: nur Kaffee mit Milch, sie hat morgens keinen Hunger. Übrig bleibt \"Joghurt mit Honig\", der nur als Abneigung von Greta vorkommt.",
  ),

  museum.choice(
    "detail",
    "EASY",
    "Wo treffen sich die Besucher zur Führung?",
    "An der Kasse im Erdgeschoss.",
    ["Im Café des Museums.", "Vor dem Eingang des Museums.", "Im Raum mit den Spielsachen."],
    3,
    "\"Wir treffen uns nicht im Café, sondern an der Kasse im Erdgeschoss.\" Das Café ist der korrigierte Ort; Eingang und Ausstellungsraum werden nicht als Treffpunkt genannt.",
  ),
  museum.tfng(
    "detail",
    "MID",
    [
      ["Die Führung beginnt heute am frühen Nachmittag.", "R"],
      ["Mit der Museumskarte zahlt man für die Führung drei Euro.", "F"],
      ["Das Museum schließt heute um 17 Uhr.", "R"],
    ],
    "1 R: \"Um halb drei beginnt heute die Führung.\" 2 F: Drei Euro kostet die Führung ohne Karte, mit der Museumskarte ist sie kostenlos. 3 R: \"Heute schließt das Museum schon um siebzehn Uhr\" (wird wiederholt).",
  ),

  bookshop.notes(
    "notes",
    "MID",
    "Hören Sie die Nachricht. Ergänzen Sie die Notizen.\n\nBuch abholen ab: {{g1}}\nSamstag geöffnet bis: {{g2}}\nTelefonnummer der Buchhandlung: {{g3}}",
    [
      ["morgen", "ab morgen"],
      ["13 Uhr", "13", "dreizehn Uhr", "dreizehn", "1 Uhr", "ein Uhr", "um 13 Uhr"],
      ["0611 423 78", "061142378", "0611/42378", "0611 42378"],
    ],
    "g1: \"Sie können es ab morgen abholen.\" g2: Herr Sommer nennt zuerst zwölf Uhr und korrigiert sich: \"Ach nein, Entschuldigung, bis dreizehn Uhr.\" 12 Uhr ist der Wert vor der Korrektur, halb sieben (18.30 Uhr) gilt von Montag bis Freitag. g3: Die Nummer wird zweimal ziffernweise genannt: null sechs eins eins, vier zwei drei, sieben acht. Bei der Nummer zählen nur die Ziffern.",
  ),
  bookshop.tfng(
    "detail",
    "MID",
    [
      ["Frau Aksoy kann ihr Buch schon morgen abholen.", "R"],
      ["Frau Aksoy muss die Buchhandlung zuerst zurückrufen.", "F"],
    ],
    "1 R: \"Sie können es ab morgen abholen.\" 2 F: \"Sie müssen nicht zurückrufen.\" Die Nummer ist nur für Fragen gedacht.",
  ),

  sports.choice(
    "detail",
    "MID",
    "Bis wann gilt die Aktion im Sporthaus Lang?",
    "Bis Sonntag.",
    ["Bis Freitag.", "Bis Samstag.", "Bis Montag."],
    0,
    "\"Die Aktion dauert nicht nur bis Freitag, sondern sogar bis Sonntag.\" Freitag ist der Wert, der ersetzt wird; der Samstag kommt nur als Tag der Überraschung für Kinder vor, der Montag nicht.",
  ),
  sports.tfng(
    "detail",
    "MID",
    [
      ["Die Kinder bekommen am Sonntag eine kleine Überraschung.", "F"],
      ["Laufschuhe sind in dieser Woche billiger als sonst.", "R"],
    ],
    "1 F: Die Überraschung gibt es am Samstag. 2 R: Laufschuhe gibt es mit dreißig Prozent Rabatt.",
  ),
];

// ================================================================ WRITING: replies to an incoming message

const writingItems = [
  a.writing(
    "message",
    "MID",
    [40, 60],
    "Ihre Freundin Pia fährt nächste Woche in den Urlaub. Sie schreibt Ihnen:\n\n" +
      "„Hallo! Ich fliege am Montag für eine Woche weg und suche jemanden für meine Katze. " +
      "Hast du Zeit und Lust? Wann kannst du den Schlüssel bei mir abholen? " +
      "Kannst du auch meine Blumen gießen? Und was soll ich dir aus dem Urlaub mitbringen?“\n\n" +
      "Schreiben Sie Pia eine Antwort. Beantworten Sie alle vier Fragen und schreiben Sie etwa 50 Wörter. Vergessen Sie Anrede und Gruß nicht.",
    [
      "sagen, ob man Zeit hat und die Katze versorgen kann",
      "Zeit für das Abholen des Schlüssels nennen",
      "sagen, ob man auch die Blumen gießt",
      "einen Wunsch für ein Mitbringsel nennen",
      "Anrede und Gruß",
    ],
    [
      "sagen, ob Sie Zeit haben",
      "sagen, wann Sie den Schlüssel abholen",
      "sagen, ob Sie die Blumen gießen",
      "sagen, was Pia mitbringen soll",
      "Anrede und Gruß",
    ],
    "informell (du)",
    "Antwort auf eine Nachricht mit vier Fragen, wie im ÖSD-A2-Schreiben: Jede Frage muss beantwortet werden, dazu Anrede und Gruß. Fehlt eine Antwort, ist der Punkt nicht erfüllt. Etwa 50 Wörter; deutlich weniger als die Hälfte erfüllt die Aufgabe nicht. Erwartet werden einfache Sätze mit \"können\" und \"wollen\" sowie ein Terminvorschlag.",
  ),
  a.writing(
    "email",
    "MID",
    [30, 40],
    "Sie möchten gern kochen lernen und lesen diese Anzeige:\n\n" +
      "„Kochkurs für Anfänger! Wir kochen zusammen einfache Gerichte aus vielen Ländern, " +
      "jeden Donnerstag von 18 bis 21 Uhr im Gemeindehaus Süd. Der Kurs hat acht Abende und höchstens zehn Teilnehmer. " +
      "Anmeldung per E-Mail bei Frau Hartmann.“\n\n" +
      "Schreiben Sie Frau Hartmann eine E-Mail.\n\n" +
      "- Sagen Sie, dass Sie Interesse haben, und fragen Sie, wann der Kurs beginnt.\n" +
      "- Fragen Sie nach dem Preis.\n" +
      "- Fragen Sie, ob man etwas mitbringen muss.\n\n" +
      "Schreiben Sie 30 bis 40 Wörter. Vergessen Sie Anrede und Gruß nicht.",
    [
      "Interesse am Kochkurs äußern und fragen, wann der Kurs beginnt",
      "nach dem Preis für den Kurs fragen",
      "fragen, ob man etwas mitbringen muss (z. B. Zutaten, Schürze)",
      "Anrede und Gruß",
    ],
    [
      "Interesse zeigen und nach dem Beginn fragen",
      "nach dem Preis fragen",
      "fragen, ob Sie etwas mitbringen müssen",
      "höfliche Anrede und Gruß",
    ],
    "halbformell (Sie)",
    "Anfrage zu einer Anzeige, halbformell wie im Goethe A2, Schreiben Teil 2: Anrede \"Sehr geehrte Frau Hartmann\", durchgehend Sie, drei Fragen in höflicher Form (\"Könnten Sie mir bitte sagen, ...?\"). Alle drei Leitpunkte müssen erkennbar sein; der Kursbeginn ist in der Anzeige nicht genannt.",
  ),
];

// ================================================================ GRAMMAR: letter-style cloze

const letterCloze = cloze("A2", "MID", {
  title: "Gruß von der Nordsee",
  first: "Liebe Kerstin, viele Grüße von der Nordsee!",
  body:
    "Ich [[bin|habe|bist|hat#perfekt.hilfsverb]] am Montag mit meinen Eltern ans Meer gefahren. " +
    "Die Ferienwohnung liegt nur fünf Minuten [[vom|zum|beim|im#praeposition]] Meer entfernt, und die Luft ist hier viel [[besser|gut|am besten|guter#adjektiv.komparativ]] als in der Stadt. " +
    "Das Frühstück gibt es [[um|am|im|an#praeposition.zeit]] acht Uhr auf dem Balkon. " +
    "Am Vormittag liegen wir [[am|an den|ans|an der#wechselpraeposition]] Strand und lesen. " +
    "Das Wasser ist noch kalt, deshalb [[können|kann|kannst|könnt#modalverb]] wir nur kurz schwimmen. " +
    "Mein Vater hat [[mir|mich|ich|er#dativ]] ein Fahrrad gemietet, und damit mache ich jeden Nachmittag eine Tour. " +
    "Heute besuchen wir eine kleine Insel, [[die|der|den|dem#relativsatz]] man nur mit dem Schiff erreichen kann. " +
    "Am Abend essen wir in einem [[gemütlichen|gemütliche|gemütlicher|gemütliches#adjektivendung]] Restaurant am Hafen. " +
    "Meine Eltern fühlen [[sich|uns|euch|ihnen#reflexiv]] hier sehr wohl. " +
    "Wenn es morgen regnet, [[dann|denn|weil|obwohl#konnektor]] besuchen wir das Museum in der Stadt.",
  last: "Ich schicke dir bald Fotos, und im September sehen wir uns hoffentlich wieder. Liebe Grüße, deine Nina",
  note: "Hilfsverb sein bei Bewegung (g1), vom + Dativ bei Entfernung (g2), Komparativ mit als (g3), Zeitangabe um + Uhrzeit (g4), an + Dativ bei Ort (g5), Modalverb mit wir nach deshalb (g6), Dativ der Person bei mieten (g7), Relativpronomen (g8), Adjektivendung nach in + einem (g9), Reflexivpronomen bei sich wohlfühlen (g10), dann mit Verb an zweiter Stelle gegen denn, weil und obwohl (g11).",
});

export const A2_MORE: LevelParts = {
  ...noParts(),
  grammar: { stimuli: [], items: [letterCloze] },
  listening: { stimuli: [lWeekend, lBreakfast, lMuseum, lBookshop, lSports], items: listeningItems },
  writing: { stimuli: [], items: writingItems },
};
