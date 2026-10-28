import type { SeedCourseForm } from "../types";
import { INTRO_EXPLANATION, INTRO_POINTS, INTRO_PROMPT, INTRO_TIME, LIFE_TIME, WRITING_WORDS, a, choice3, cloze3, interimSyllabus, stimuliOf, writingPrompt } from "./kit";

/**
 * Zwischentest A2.1, form B (spec 2026-10-28). Parallel to form A: the same grammar blueprint in the same order
 * (cloze: Perfekt mit sein, Dativ, Präteritum der Modalverben, Komparativ, reflexive Verben, Adjektivendung;
 * sentences: Partizip II, weil, werden, Superlativ, dass, wenn, könnte, ohne + Akkusativ, Adjektive nach ein),
 * other texts, other sentences.
 */
const s = stimuliOf("ct-a2i-b");

// ================================================================ READING

const offline = s.text(
  "offline",
  "Ein Wochenende ohne Handy",
  "Medien und Familie",
  `
Familie Novak aus Leipzig hat im Mai ein Experiment gemacht: ein ganzes Wochenende ohne Handy, Fernseher und Computer. Die Idee hatte der Vater, Ivan Novak, weil alle in der Familie zu oft auf einen Bildschirm geschaut haben.

Am Freitagabend haben die Eltern und die beiden Kinder alle Geräte in eine Kiste gelegt. Am Anfang war es nicht einfach. „Ich wollte ständig auf mein Handy schauen“, erzählt die Tochter Mira. Ihr Bruder Lukas fand den Samstag am schwersten, denn seine Freunde konnten ihn nicht erreichen. Mira hat dafür ein Buch gelesen, das sie schon lange lesen wollte.

Dann hat die Familie einen Ausflug mit dem Fahrrad gemacht und am Abend Karten gespielt. Die Mutter, Petra Novak, sagt: „Wir haben so viel geredet wie schon lange nicht mehr.“ Am Sonntag haben alle zusammen gekocht. Das Experiment hat der Familie so gut gefallen, dass sie es im Sommer noch einmal machen möchte.
`,
);

const angebote = s.text(
  "angebote",
  "Anzeige, Aushang, Forum und Blog",
  "Wohnen und Freizeit",
  `
Text A - Anzeige
Zimmer frei in netter WG! Wir sind drei Studentinnen und suchen eine Mitbewohnerin oder einen Mitbewohner. Das Zimmer ist 14 Quadratmeter groß und kostet 380 Euro im Monat, alle Kosten sind dabei. Die Küche und das Bad teilen wir. Haustiere sind leider nicht erlaubt. Besichtigung: jeden Tag nach 18 Uhr. Kontakt: Nora, 0123 / 987 654

Text B - Aushang im Stadtteilzentrum
Computerkurs für Anfänger! Am Dienstag, 4. März, beginnt ein neuer Kurs. Sie lernen, wie man E-Mails schreibt und im Internet sucht. Der Kurs findet jeden Dienstag von 10 bis 11.30 Uhr statt, insgesamt sechsmal, und kostet 20 Euro. Bitte melden Sie sich im Büro an. Bringen Sie, wenn möglich, Ihren eigenen Laptop mit.

Text C - Beitrag im Forum
Hallo zusammen, ich habe nächsten Samstag Geburtstag und möchte mit zehn Freunden essen gehen. Kennt ihr ein gutes Restaurant in der Innenstadt? Es soll nicht zu teuer sein, und wir möchten gern draußen sitzen. Vegetarisches Essen ist wichtig, weil zwei Freundinnen kein Fleisch essen. Danke für eure Tipps! Dilara

Text D - Blogeintrag
Gestern war ich zum ersten Mal im Freiluftkino am Fluss. Wir haben Decken mitgebracht und Popcorn gegessen. Der Film war lustig, aber es war ziemlich kalt, deshalb habe ich nach der Hälfte meine Jacke angezogen. Nächstes Mal nehme ich einen dicken Pullover mit! Der Eintritt war billig, nur sechs Euro. Wer mitkommen möchte, schreibt mir einfach.
`,
);

const rOffline = a.forText(offline);

const reading = [
  rOffline.tfng(
    "detail",
    "MID",
    [
      ["Die Idee für das Experiment hatten die Kinder.", "F"],
      ["Lukas fiel der Samstag am schwersten, weil seine Freunde ihn nicht erreichen konnten.", "R"],
      ["Die Familie möchte das Experiment im Sommer noch einmal machen.", "R"],
    ],
    "1 F: Die Idee hatte der Vater, Ivan Novak. 2 R: Lukas fand den Samstag am schwersten, denn seine Freunde konnten ihn nicht erreichen. 3 R: Das Experiment hat der Familie so gut gefallen, dass sie es im Sommer noch einmal machen möchte.",
  ),
  choice3(
    angebote,
    "detail",
    "MID",
    "In welchem Text soll man etwas von zu Hause mitbringen?",
    "Text B",
    ["Text C", "Text D"],
    0,
    "Text B: \"Bringen Sie, wenn möglich, Ihren eigenen Laptop mit.\" In Text D haben die Besucher Decken mitgebracht, aber das ist eine Erzählung über gestern, keine Aufforderung. Text C nennt nichts, was man mitbringen soll.",
  ),
  choice3(
    angebote,
    "detail",
    "MID",
    "Wer sucht ein Restaurant für eine Feier?",
    "Text C",
    ["Text A", "Text D"],
    2,
    "Text C: Dilara möchte ihren Geburtstag mit zehn Freunden in einem Restaurant feiern und bittet um Tipps. In Text A geht es um ein Zimmer, in Text D um ein Kino.",
  ),
  choice3(
    angebote,
    "detail",
    "MID",
    "In welchem Text steht, wie viel man jeden Monat bezahlt?",
    "Text A",
    ["Text B", "Text D"],
    1,
    "Text A: 380 Euro im Monat. Text B nennt 20 Euro für den ganzen Kurs, Text D sechs Euro Eintritt für den Kinoabend.",
  ),
];

// ================================================================ GRAMMAR

const cloze = cloze3("MID", {
  title: "Mein erster Monat im neuen Büro",
  first: "Lieber Marco, jetzt arbeite ich schon einen Monat in der neuen Firma.",
  body:
    "Ich [[bin|habe|hatte#perfekt.hilfsverb]] am ersten Tag viel zu früh aufgestanden und war schon um sieben Uhr im Büro. " +
    "Jetzt arbeite ich viel mit [[meinem|mein|meinen#dativ]] Chef zusammen, er hilft mir bei allen Fragen. " +
    "Am Anfang [[konnte|kann|könnte#praeteritum]] ich meine Kollegen kaum verstehen, aber jetzt geht es schon viel besser. " +
    "Der Weg zur Arbeit ist [[kürzer|kurz|am kürzesten#adjektiv.komparativ]] als früher, nur zwanzig Minuten mit dem Bus. " +
    "Ich fühle [[mich|mir|sich#reflexiv]] im Team schon sehr wohl. " +
    "Am Freitag gehen wir oft in das [[kleine|kleinen|kleiner#adjektivendung]] Restaurant neben dem Büro.",
  last: "Besuch mich doch bald mal, dann zeige ich dir alles!",
  note: "Perfekt mit „sein“ bei aufstehen (g1), „mit“ + Dativ, Possessivartikel (g2), Modalverb im Präteritum (g3), Komparativ mit „als“ (g4), Reflexivpronomen bei „sich wohlfühlen“ (g5), Adjektivendung nach dem bestimmten Artikel (g6).",
});

const sentences = [
  a.grammarChoice(
    "perfekt.partizip",
    "EASY",
    "Am Freitag habe ich im Supermarkt ____.",
    "eingekauft",
    ["geeinkauft", "einkauft", "einkaufen"],
    1,
    "Perfekt: Partizip II eines trennbaren Verbs (einkaufen: eingekauft)",
  ),
  a.grammarChoice(
    "nebensatz",
    "MID",
    "Lena kommt heute zu spät, weil ihr Bus nicht ____.",
    "gefahren ist",
    ["ist gefahren", "gefahren", "gefahren sein"],
    0,
    "Nebensatz mit „weil“: Das konjugierte Verb steht am Ende, im Perfekt nach dem Partizip II",
  ),
  a.grammarChoice(
    "werden",
    "MID",
    "Meine Tochter will später Tierärztin ____.",
    "werden",
    ["wird", "geworden", "wurde"],
    2,
    "Das Verb „werden“ im Infinitiv nach einem Modalverb (Berufswunsch)",
  ),
  a.grammarChoice(
    "adjektiv.superlativ",
    "MID",
    "Von allen Handys im Laden ist dieses Modell ____.",
    "am teuersten",
    ["teuersten", "teurer", "am teuer"],
    3,
    "Superlativ mit „am“ (am teuersten)",
  ),
  a.grammarChoice(
    "nebensatz",
    "MID",
    "Meine Freundin findet, dass ____.",
    "man im Internet viel lernen kann",
    ["man kann im Internet viel lernen", "kann man im Internet viel lernen", "man im Internet viel kann lernen"],
    0,
    "Nebensatz mit „dass“: Das konjugierte Verb steht am Ende",
  ),
  a.grammarChoice(
    "wortstellung.inversion",
    "MID",
    "Wenn das Wetter schön ist, ____.",
    "fahren wir mit dem Rad",
    ["wir fahren mit dem Rad", "mit dem Rad fahren wir", "wir mit dem Rad fahren"],
    2,
    "Hauptsatz nach einem vorangestellten „wenn“-Satz: Das Verb steht an erster Stelle des Hauptsatzes",
  ),
  a.grammarChoice(
    "konjunktiv2.modal",
    "MID",
    "____ ihr bitte etwas leiser sein?",
    "Könntet",
    ["Könnte", "Könnten", "Könntest"],
    1,
    "Höfliche Bitte mit Konjunktiv II: „könntet“ gehört zu „ihr“",
  ),
  a.grammarChoice(
    "praeposition",
    "MID",
    "Ich gehe nie ohne ____ Schirm aus dem Haus.",
    "meinen",
    ["mein", "meinem", "meiner"],
    3,
    "Die Präposition „ohne“ verlangt den Akkusativ (ohne meinen Schirm)",
  ),
  a.grammarChoice(
    "adjektivendung",
    "MID",
    "Herr Berger ist ein sehr ____ Lehrer.",
    "netter",
    ["nette", "netten", "nettes"],
    1,
    "Adjektivendung nach dem unbestimmten Artikel (ein netter Lehrer, Maskulinum, Nominativ)",
  ),
];

// ================================================================ LISTENING

const bank = s.clip("bank", "Nachricht von der Bank", "Bank und Karte", [{ label: "Herr Schmidt", voice: "C" }], [
  "Herr Schmidt: Guten Tag, Herr Okonkwo, hier spricht die Stadtbank, Filiale am Markt, mein Name ist Schmidt. Ihre neue Bankkarte ist da. Sie können sie ab morgen bei uns abholen. Bitte bringen Sie Ihren Personalausweis mit, den Führerschein brauchen Sie nicht. Wir haben von Montag bis Donnerstag bis siebzehn Uhr geöffnet, am Freitag nur bis dreizehn Uhr. Wenn Sie nicht kommen können, schicken wir die Karte auch per Post, das kostet aber drei Euro. Rufen Sie dann einfach zurück. Unsere Filiale finden Sie direkt neben der Post. Ohne Ausweis können wir Ihnen die Karte leider nicht geben, bitte vergessen Sie das nicht. Bis bald!",
]);

const elektro = s.clip("elektro", "Radiowerbung eines Elektrogeschäfts", "Medien und Einkaufen", [{ label: "Sprecherin", voice: "A" }], [
  "Sprecherin: Elektro Berger in der Gartenstraße feiert Geburtstag! Nur in dieser Woche bekommen Sie bei uns Handys ab neunundneunzig Euro und Tablets mit zwanzig Prozent Rabatt. Das Angebot gilt nicht nur bis Freitag, sondern sogar bis Samstag. Am Sonntag ist unser Geschäft wie immer geschlossen. Und das Beste: Jeder Kunde bekommt eine Handyhülle gratis. Außerdem reparieren wir Ihr altes Handy schnell und günstig. Parken können Sie direkt hinter dem Haus. Wir sind von Montag bis Samstag von neun bis neunzehn Uhr für Sie da. Elektro Berger, Gartenstraße vierzehn. Bis bald!",
]);

const vhs = s.clip("vhs", "Telefonansage der Volkshochschule", "Kurs und Schule", [{ label: "Ansage", voice: "D" }], [
  "Ansage: Herzlich willkommen bei der Volkshochschule Nord. Für den Abendkurs Deutsch gibt es zwei Änderungen. Erstens: Am Dienstag findet der Unterricht nicht im Raum zwölf statt, sondern im Raum einundzwanzig, weil der Boden in Raum zwölf repariert wird. Zweitens: Am Donnerstag fällt der Kurs aus, weil die Lehrerin eine Fortbildung hat. Den Termin holen wir am Samstag nach, von zehn bis dreizehn Uhr. Bitte sagen Sie es auch den anderen Teilnehmerinnen und Teilnehmern. Wenn Sie Fragen haben, rufen Sie das Sekretariat an. Es ist täglich von acht bis zwölf Uhr besetzt. Vielen Dank!",
]);

const gespraech = s.clip(
  "vorstellungsgespraech",
  "Ein Vorstellungsgespräch",
  "Arbeit und Bewerbung",
  [
    { label: "Frau Lang", voice: "D" },
    { label: "Herr Aydin", voice: "C" },
  ],
  [
    "Frau Lang: Guten Tag, Herr Aydin. Schön, dass Sie da sind. Setzen Sie sich bitte.",
    "Herr Aydin: Guten Tag, Frau Lang. Vielen Dank.",
    "Frau Lang: Sie möchten bei uns im Lager arbeiten. Haben Sie schon Erfahrung?",
    "Herr Aydin: Ja, ich habe zwei Jahre in einem Supermarkt gearbeitet. Ich habe die Regale eingeräumt und die Waren kontrolliert.",
    "Frau Lang: Sprechen Sie auch ein bisschen Englisch? Wir bekommen viele Lieferungen aus dem Ausland.",
    "Herr Aydin: Ja, ein bisschen. Ich lerne seit einem Jahr Englisch, aber mein Deutsch ist besser.",
    "Frau Lang: Und warum möchten Sie die Stelle wechseln?",
    "Herr Aydin: Der Supermarkt hat leider geschlossen. Außerdem möchte ich gern am Vormittag arbeiten, weil ich am Nachmittag einen Deutschkurs besuche.",
    "Frau Lang: Das passt gut. Bei uns beginnt die Arbeit um sechs Uhr und endet um vierzehn Uhr. Ist das ein Problem für Sie?",
    "Herr Aydin: Nein, früh aufstehen finde ich nicht schlimm. Aber ich habe kein Auto. Wie komme ich zu Ihnen?",
    "Frau Lang: Mit der Straßenbahn, Linie vier. Sie hält direkt vor der Firma. Und am Wochenende müssen Sie nicht arbeiten.",
    "Herr Aydin: Das ist prima. Und was ziehe ich bei der Arbeit an?",
    "Frau Lang: Arbeitskleidung bekommen Sie von uns. Nur die Schuhe müssen Sie selbst mitbringen.",
    "Herr Aydin: Kein Problem, Arbeitsschuhe habe ich schon. Und wie viel verdiene ich?",
    "Frau Lang: Am Anfang bezahlen wir vierzehn Euro pro Stunde. Nach drei Monaten bekommen Sie einen Euro mehr.",
    "Herr Aydin: Gut. Und wann kann ich anfangen?",
    "Frau Lang: Am ersten Juli. Sie bekommen noch einen Brief mit dem Vertrag. Bringen Sie ihn bitte unterschrieben zurück.",
    "Herr Aydin: Mache ich. Vielen Dank, Frau Lang, und auf Wiedersehen!",
    "Frau Lang: Auf Wiedersehen, Herr Aydin!",
  ],
);

const lGespraech = a.forClip(gespraech);

const listening = [
  choice3(
    bank,
    "detail",
    "MID",
    "Was soll Herr Okonkwo zur Bank mitbringen?",
    "Seinen Personalausweis.",
    ["Seinen Führerschein.", "Drei Euro für die Post."],
    0,
    "\"Bitte bringen Sie Ihren Personalausweis mit, den Führerschein brauchen Sie nicht.\" Die drei Euro kosten nur den Versand per Post, wenn er die Karte nicht abholen kann.",
  ),
  choice3(
    elektro,
    "detail",
    "MID",
    "Bis wann gibt es die Angebote?",
    "Bis Samstag.",
    ["Bis Freitag.", "Bis Sonntag."],
    1,
    "\"Das Angebot gilt nicht nur bis Freitag, sondern sogar bis Samstag.\" Am Sonntag ist das Geschäft geschlossen.",
  ),
  choice3(
    vhs,
    "detail",
    "MID",
    "Warum findet der Kurs am Dienstag in einem anderen Raum statt?",
    "Weil der Boden im Kursraum repariert wird.",
    ["Weil die Lehrerin eine Fortbildung hat.", "Weil am Samstag ein Termin nachgeholt wird."],
    0,
    "Der Boden in Raum zwölf wird repariert, deshalb ist der Unterricht in Raum einundzwanzig. Die Fortbildung der Lehrerin ist der Grund, warum der Kurs am Donnerstag ausfällt; der Samstag ist der Nachholtermin.",
  ),
  lGespraech.tfng(
    "detail",
    "MID",
    [
      ["Herr Aydin hat zwei Jahre in einem Supermarkt gearbeitet.", "R"],
      ["Herr Aydin muss auch am Wochenende arbeiten.", "F"],
      ["Herr Aydin bekommt von Anfang an fünfzehn Euro pro Stunde.", "F"],
    ],
    "1 R: \"Ich habe zwei Jahre in einem Supermarkt gearbeitet.\" 2 F: \"Am Wochenende müssen Sie nicht arbeiten.\" 3 F: Am Anfang sind es vierzehn Euro, erst nach drei Monaten einen Euro mehr.",
  ),
];

// ================================================================ WRITING

const writing = a.writing(
  "email",
  "MID",
  WRITING_WORDS,
  writingPrompt(
    "Sie haben seit einer Woche eine neue Arbeit. Schreiben Sie Ihrem Freund Can eine E-Mail.",
    ["Sagen Sie, wo Sie jetzt arbeiten und was Sie dort machen.", "Schreiben Sie, was Ihnen an der Arbeit gefällt.", "Schlagen Sie Can ein Treffen vor."],
    false,
  ),
  [
    "Arbeitsort UND Tätigkeit nennen (z. B. in einem Café, Gäste bedienen)",
    "Etwas nennen, das an der Arbeit gefällt (gern mit kurzer Begründung)",
    "Ein Treffen vorschlagen (Tag oder Uhrzeit, eventuell Ort)",
  ],
  ["wo und was Sie arbeiten", "was Ihnen gefällt", "ein Treffen vorschlagen"],
  "informell (du)",
  "Neuigkeiten per E-Mail an einen Freund (Kapitel 6: Arbeitswelten). Alle drei Punkte müssen erkennbar sein; Anrede und Gruß gehören dazu. Erwartet werden einfache Sätze mit „weil“ und ein Vorschlag, zum Beispiel mit „Wollen wir ...?“.",
);

// ================================================================ SPEAKING

const speaking = [
  a.speaking("introduction", "EASY", INTRO_TIME, INTRO_PROMPT, INTRO_POINTS, [], INTRO_EXPLANATION),
  a.speaking(
    "monologue",
    "MID",
    LIFE_TIME,
    "Erzählen Sie bitte, wie Sie Handy und Internet benutzen.\n\n- Wie oft benutzen Sie Ihr Handy, und wofür?\n- Was benutzen Sie am liebsten, und warum?\n- Was ist gut, was ist nicht so gut?\n- Wie war das früher, ohne Handy?",
    [
      "Sagen, wie oft und wofür man Handy und Internet benutzt (mit Beispielen)",
      "Eine App, ein Gerät oder ein Programm nennen, das man am liebsten benutzt, mit Grund",
      "Vorteile und Nachteile nennen (zum Beispiel praktisch, aber teuer oder zu viel Zeit)",
      "Früher und heute vergleichen",
    ],
    [],
    "Über das eigene Leben sprechen (Kapitel 3: Medien im Alltag). Erwartet werden Vergleiche (Komparativ, Superlativ, „als“, „wie“) und Meinungen mit „dass“ oder „weil“.",
  ),
];

export const A2_INTERIM_B: SeedCourseForm = {
  key: "A2.1",
  form: "B",
  syllabus: interimSyllabus(),
  sections: [
    { section: "READING", stimuli: [offline, angebote], items: reading },
    { section: "GRAMMAR", stimuli: [], items: [cloze, ...sentences] },
    { section: "LISTENING", stimuli: [bank, elektro, vhs, gespraech], items: listening },
    { section: "WRITING", stimuli: [], items: [writing] },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
