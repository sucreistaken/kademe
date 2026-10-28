import type { SeedCourseForm } from "../types";
import { INTRO_EXPLANATION, INTRO_POINTS, INTRO_PROMPT, INTRO_TIME, LIFE_TIME, WRITING_WORDS, a, choice3, cloze3, interimSyllabus, stimuliOf, writingPrompt } from "./kit";

/**
 * Zwischentest A2.1, form A (spec 2026-10-28). Netzwerk neu A2, Kapitel 1-6. Grammar blueprint shared with form B
 * (same phenomena, same order): the cloze tests Perfekt mit sein, Dativ, Präteritum der Modalverben, Komparativ,
 * reflexive Verben and Adjektivendungen; the nine sentences Partizip II, weil, werden, Superlativ, dass, wenn,
 * höfliche Bitten mit könnte, mit + Dativ and Adjektive nach ein.
 */
const s = stimuliOf("ct-a2i-a");

// ================================================================ READING

const baeckerin = s.text(
  "baeckerin",
  "Von der Schulbank in die Backstube",
  "Schule und Beruf",
  `
Nilay Kaya arbeitet als Bäckerin in einer kleinen Bäckerei in Kassel. Sie steht jeden Morgen um vier Uhr auf, denn die ersten Kunden kommen schon um sechs.

In der Schule war Nilay nicht besonders gut. Mathe und Englisch mochte sie nicht, aber Kunst und Sport waren ihre Lieblingsfächer. Nach dem Abschluss wollte sie zuerst Erzieherin werden. Dann hat sie in den Ferien ein Praktikum in einer Bäckerei gemacht. „Das hat mir sofort gefallen“, erzählt sie, „weil man mit den Händen arbeitet und am Ende des Tages sieht, was man geschafft hat.“

Die Ausbildung hat drei Jahre gedauert. Im ersten Jahr musste Nilay viel lernen, zum Beispiel die Namen der Brotsorten und die Preise. Ihre Chefin, Frau Brandt, hat ihr oft geholfen. Heute ist Nilay froh, dass sie sich damals so entschieden hat. Nur das frühe Aufstehen findet sie noch immer schwer. Am Wochenende schläft sie deshalb lange und trifft danach ihre Freunde.
`,
);

const viertel = s.text(
  "viertel",
  "Aushang, Forum, Anzeige und Blog",
  "Nachbarschaft und Alltag",
  `
Text A - Aushang im Hausflur
Hoffest am Samstag, 15. Juni! Wir feiern ab 15 Uhr im Hof. Jede Familie bringt etwas zu essen mit, zum Beispiel einen Salat oder einen Kuchen. Getränke gibt es vom Hausmeister. Wenn es regnet, feiern wir im Keller. Bitte tragen Sie sich bis Mittwoch in die Liste an der Haustür ein. Familie Okafor, Hausnummer 14

Text B - Beitrag im Forum
Hallo zusammen, mein Handy ist drei Jahre alt und leider sehr langsam. Ich möchte ein neues kaufen, aber es soll nicht mehr als 300 Euro kosten. Wichtig ist mir eine gute Kamera, weil ich viele Fotos mache. Habt ihr einen Tipp für mich? Danke und viele Grüße, Tarik

Text C - Stellenanzeige
Café Sonne sucht eine Aushilfe! Sie bedienen unsere Gäste und arbeiten von Montag bis Freitag am Nachmittag. Sie sind freundlich und sprechen gut Deutsch? Erfahrung ist nicht nötig. Wir bezahlen 13 Euro pro Stunde. Rufen Sie uns an: 0123 / 456 789. Café Sonne, Bahnhofstraße 8

Text D - Blogeintrag
Heute war ich zum ersten Mal im Bürgeramt. Ich musste meine neue Adresse anmelden. Ohne Termin geht das nicht, das wusste ich nicht! Aber die Frau am Schalter war sehr nett und hat mir geholfen. Jetzt habe ich einen Termin für Donnerstag um 9 Uhr. Hoffentlich geht dann alles schnell. Mehr dazu im nächsten Beitrag! Eure Mei
`,
);

const rBaeckerin = a.forText(baeckerin);

const reading = [
  rBaeckerin.tfng(
    "detail",
    "MID",
    [
      ["In der Schule gehörte Sport zu Nilays Lieblingsfächern.", "R"],
      ["Nach dem Abschluss wollte Nilay sofort Bäckerin werden.", "F"],
      ["Das frühe Aufstehen fällt Nilay auch heute noch schwer.", "R"],
    ],
    "1 R: Kunst und Sport waren ihre Lieblingsfächer. 2 F: Sie wollte zuerst Erzieherin werden, das Praktikum in der Bäckerei kam danach. 3 R: Nur das frühe Aufstehen findet sie noch immer schwer.",
  ),
  choice3(
    viertel,
    "detail",
    "MID",
    "In welchem Text steht, wie viel Geld man für eine Stunde Arbeit bekommt?",
    "Text C",
    ["Text A", "Text B"],
    2,
    "Text C nennt 13 Euro pro Stunde. In Text B steht auch ein Geldbetrag (300 Euro), aber das ist der Preis für ein Handy. Text A nennt kein Geld.",
  ),
  choice3(
    viertel,
    "detail",
    "MID",
    "Wo soll man etwas zu essen mitbringen?",
    "Text A",
    ["Text C", "Text D"],
    0,
    "Text A: Jede Familie bringt etwas zu essen mit. Text C ist ein Café, das Gäste bedient, und Text D erzählt von einem Amt. Von Essen zum Mitbringen steht dort nichts.",
  ),
  choice3(
    viertel,
    "detail",
    "MID",
    "Wer war heute in einer Behörde?",
    "Text D",
    ["Text B", "Text A"],
    1,
    "Text D: Die Schreiberin war im Bürgeramt und hat dort einen neuen Termin bekommen. Text A und Text B sprechen nicht von einem Amt.",
  ),
];

// ================================================================ GRAMMAR

const cloze = cloze3("MID", {
  title: "Eine Nachricht aus Wien",
  first: "Liebe Jana, ich wohne jetzt seit zwei Wochen in Wien.",
  body:
    "Ich [[bin|habe|hatte#perfekt.hilfsverb]] an einem Samstag mit dem Zug angekommen und wohne zuerst bei [[meiner|meine|meinem#dativ]] Tante. " +
    "In der ersten Woche [[musste|muss|müsste#praeteritum]] ich viele Formulare ausfüllen, aber jetzt ist alles fertig. " +
    "Wien ist viel [[größer|groß|am größten#adjektiv.komparativ]] als Graz, aber ich finde die Stadt sehr schön. " +
    "Am Wochenende treffen wir [[uns|euch|sich#reflexiv]] mit ein paar Kollegen und gehen in die [[neue|neuen|neues#adjektivendung]] Bar am Fluss.",
  last: "Schreib mir bald, wie es dir in Graz geht!",
  note: "Perfekt mit „sein“ bei ankommen (g1), Possessivartikel im Dativ nach „bei“ (g2), Modalverb im Präteritum (g3), Komparativ mit „als“ (g4), Reflexivpronomen zu „wir“ (g5), Adjektivendung nach dem bestimmten Artikel (g6).",
});

const sentences = [
  a.grammarChoice(
    "perfekt.partizip",
    "EASY",
    "Am Samstag haben wir die ganze Wohnung ____.",
    "aufgeräumt",
    ["geaufräumt", "aufräumt", "aufräumen"],
    2,
    "Perfekt: Partizip II eines trennbaren Verbs (aufräumen: aufgeräumt)",
  ),
  a.grammarChoice(
    "nebensatz",
    "MID",
    "Ich bin heute sehr müde, weil ich gestern lange ____.",
    "gearbeitet habe",
    ["habe gearbeitet", "gearbeitet", "arbeite"],
    0,
    "Nebensatz mit „weil“: Das konjugierte Verb steht am Ende, im Perfekt nach dem Partizip II",
  ),
  a.grammarChoice(
    "werden",
    "MID",
    "Mein Sohn möchte später Pilot ____.",
    "werden",
    ["wird", "geworden", "wurde"],
    3,
    "Das Verb „werden“ im Infinitiv nach einem Modalverb (Berufswunsch)",
  ),
  a.grammarChoice(
    "adjektiv.superlativ",
    "MID",
    "Von allen Kindern in der Klasse läuft Lena ____.",
    "am schnellsten",
    ["schnellsten", "schneller", "am schnell"],
    1,
    "Superlativ mit „am“ (am schnellsten)",
  ),
  a.grammarChoice(
    "nebensatz",
    "MID",
    "Mein Bruder glaubt, dass ____.",
    "das Internet für Kinder gefährlich ist",
    ["das Internet ist für Kinder gefährlich", "ist das Internet für Kinder gefährlich", "das Internet für Kinder ist gefährlich"],
    1,
    "Nebensatz mit „dass“: Das konjugierte Verb steht am Ende",
  ),
  a.grammarChoice(
    "wortstellung.inversion",
    "MID",
    "Wenn ich müde bin, ____.",
    "gehe ich früh ins Bett",
    ["ich gehe früh ins Bett", "früh gehe ich ins Bett", "ich früh ins Bett gehe"],
    0,
    "Hauptsatz nach einem vorangestellten „wenn“-Satz: Das Verb steht an erster Stelle des Hauptsatzes",
  ),
  a.grammarChoice(
    "konjunktiv2.modal",
    "MID",
    "____ du mir bitte helfen?",
    "Könntest",
    ["Könnte", "Könnten", "Könntet"],
    2,
    "Höfliche Bitte mit Konjunktiv II: „könntest“ gehört zu „du“",
  ),
  a.grammarChoice(
    "praeposition",
    "MID",
    "Mein Vater fährt jeden Tag mit ____ Fahrrad zur Arbeit.",
    "seinem",
    ["sein", "seinen", "seiner"],
    3,
    "Die Präposition „mit“ verlangt den Dativ (mit seinem Fahrrad)",
  ),
  a.grammarChoice(
    "adjektivendung",
    "MID",
    "Wir suchen ein ____ Zimmer in der Stadtmitte.",
    "günstiges",
    ["günstige", "günstigen", "günstiger"],
    0,
    "Adjektivendung nach dem unbestimmten Artikel (ein günstiges Zimmer, Neutrum, Akkusativ)",
  ),
];

// ================================================================ LISTENING

const buergeramt = s.clip("buergeramt", "Nachricht vom Bürgeramt", "Behörde und Termin", [{ label: "Frau Weber", voice: "A" }], [
  "Frau Weber: Guten Tag, Frau Yilmaz, hier ist das Bürgeramt Nord, Weber am Apparat. Sie haben einen Termin für Ihren neuen Pass, am Dienstag um zehn Uhr. Leider ist meine Kollegin am Dienstag krank. Können Sie stattdessen am Mittwoch kommen, um halb zwölf? Wenn der Mittwoch nicht geht, rufen Sie mich bitte bis Montag an. Unsere Nummer ist null drei null, zwei zwei eins, vier vier. Ich wiederhole: null drei null, zwei zwei eins, vier vier. Bitte bringen Sie ein Foto mit. Vielen Dank und auf Wiederhören!",
]);

const kino = s.clip("kino", "Durchsage im Kino", "Kino und Film", [{ label: "Durchsage", voice: "B" }], [
  "Durchsage: Guten Abend, liebe Gäste, und herzlich willkommen im Kino Rex! Zuerst eine Änderung im Programm: Der Krimi um zweiundzwanzig Uhr fällt heute leider aus, weil der Film nicht rechtzeitig angekommen ist. Wer dafür schon eine Karte gekauft hat, bekommt das Geld an der Kasse zurück. Die Komödie „Das Geburtstagsgeschenk“ beginnt wie geplant um zwanzig Uhr, in Saal drei. Und noch ein Tipp für das Wochenende: Am Samstag und am Sonntag gibt es Popcorn und Getränke zum halben Preis. Wir wünschen Ihnen einen schönen Abend!",
]);

const bahnhof = s.clip("bahnhof", "Ansage am Bahnhof", "Reisen mit der Bahn", [{ label: "Ansage", voice: "D" }], [
  "Ansage: Achtung an Gleis fünf! Der Regionalexpress nach Würzburg fährt heute nicht von Gleis fünf, sondern von Gleis zwei. Ich wiederhole: von Gleis zwei. Bitte gehen Sie über die Treppe oder mit dem Aufzug zum anderen Gleis. Der Zug hat etwa zehn Minuten Verspätung, weil ein Zug vor ihm technische Probleme hatte. Reisende nach Fulda nehmen bitte nicht diesen Zug, sondern den Zug auf Gleis neun. Er fährt pünktlich ab. Wir bitten um Entschuldigung und wünschen Ihnen eine gute Reise.",
]);

const geburtstag = s.clip(
  "geburtstag",
  "Ein Geburtstag im Restaurant",
  "Feiern und Essen gehen",
  [
    { label: "Selin", voice: "A" },
    { label: "Jonas", voice: "B" },
  ],
  [
    "Selin: Hallo Jonas, hier ist Selin. Hast du kurz Zeit?",
    "Jonas: Hallo Selin! Ja, klar. Ich sitze gerade im Bus, aber ich kann gut telefonieren.",
    "Selin: Du hast ja bald Geburtstag. Wie feierst du denn?",
    "Jonas: Am Samstag, mit ein paar Freunden. Zu Hause ist die Wohnung leider zu klein, also gehen wir essen.",
    "Selin: Gute Idee! Weißt du schon, wohin?",
    "Jonas: Ja, ins „Da Luigi“. Dort gibt es die beste Pizza der Stadt. Ich habe gestern angerufen, aber niemand hat abgenommen. Ich probiere es morgen noch einmal.",
    "Selin: Hm, ich war letzte Woche im „Da Luigi“. Das Essen war gut, aber es war sehr laut. Und die Pizza war ziemlich teuer.",
    "Jonas: Wirklich? Das wusste ich nicht. Dann vielleicht lieber das chinesische Restaurant am Markt. Das ist billiger, glaube ich.",
    "Selin: Das kenne ich nicht, aber ich komme heute Nachmittag sowieso daran vorbei. Soll ich dort anrufen?",
    "Jonas: Ja, gern! Wir sind acht Personen. Kommt dein Bruder auch?",
    "Selin: Leider nicht, er muss am Samstag arbeiten. Aber ich komme gern, und ich bringe einen Kuchen mit.",
    "Jonas: Oh, das ist nett! Aber bitte keinen Schokoladenkuchen, den hatte ich letztes Jahr schon.",
    "Selin: Na gut, dann backe ich einen Apfelkuchen. Wann treffen wir uns eigentlich?",
    "Jonas: Um sieben Uhr, glaube ich. Ist das für dich okay?",
    "Selin: Ja, perfekt. Ich schreibe dir, wenn ich einen Tisch habe.",
    "Jonas: Prima, danke dir! Bis Samstag!",
  ],
);

const lGeburtstag = a.forClip(geburtstag);

const listening = [
  choice3(
    buergeramt,
    "detail",
    "MID",
    "Was soll Frau Yilmaz tun, wenn sie am Mittwoch keine Zeit hat?",
    "Sie soll bis Montag im Bürgeramt anrufen.",
    ["Sie soll am Dienstag trotzdem um zehn Uhr kommen.", "Sie soll ein Foto per Post schicken."],
    2,
    "\"Wenn der Mittwoch nicht geht, rufen Sie mich bitte bis Montag an.\" Der Dienstagstermin fällt aus, weil die Kollegin krank ist. Das Foto soll sie zum Termin mitbringen, nicht schicken.",
  ),
  choice3(
    kino,
    "detail",
    "MID",
    "Was passiert heute mit dem Krimi?",
    "Er wird heute Abend leider nicht gezeigt.",
    ["Er beginnt später als geplant.", "Er kostet am Wochenende nur den halben Preis."],
    1,
    "\"Der Krimi um zweiundzwanzig Uhr fällt heute leider aus.\" Der halbe Preis gilt am Wochenende für Popcorn und Getränke, von einer späteren Anfangszeit ist keine Rede.",
  ),
  choice3(
    bahnhof,
    "detail",
    "MID",
    "Wo steigen die Reisenden nach Würzburg ein?",
    "Auf Gleis zwei.",
    ["Auf Gleis fünf.", "Auf Gleis neun."],
    0,
    "Der Zug nach Würzburg fährt nicht von Gleis fünf (das Gleis der Ansage), sondern von Gleis zwei. Gleis neun gilt für die Reisenden nach Fulda.",
  ),
  lGeburtstag.tfng(
    "detail",
    "MID",
    [
      ["Jonas hat schon einen Tisch im Restaurant reserviert.", "F"],
      ["Selin findet die Pizza im „Da Luigi“ ziemlich teuer.", "R"],
      ["Selins Bruder kommt am Samstag mit.", "F"],
    ],
    "1 F: Niemand hat abgenommen, Jonas will es morgen noch einmal versuchen. 2 R: \"Die Pizza war ziemlich teuer.\" 3 F: Er muss am Samstag arbeiten.",
  ),
];

// ================================================================ WRITING

const writing = a.writing(
  "email",
  "MID",
  WRITING_WORDS,
  writingPrompt(
    "Sie haben eine neue Wohnung und möchten am Samstag mit Freunden feiern. Schreiben Sie Ihrer Freundin Lara eine E-Mail.",
    ["Laden Sie Lara zur Party ein.", "Sagen Sie, wann und wo die Party ist.", "Fragen Sie Lara, was sie mitbringen kann."],
    false,
  ),
  [
    "Lara zur Party einladen (die Einladung ist klar erkennbar)",
    "Zeit UND Ort der Party nennen (Samstag mit Uhrzeit, Adresse oder Wohnung)",
    "Lara fragen, was sie mitbringen kann (Frage oder Bitte zu Essen, Getränken o. Ä.)",
  ],
  ["zur Party einladen", "Wann und wo?", "Was kann Lara mitbringen?"],
  "informell (du)",
  "Einladung per E-Mail an eine Freundin (Kapitel 4: Feste, Einladen). Alle drei Punkte müssen erkennbar sein; Anrede und Gruß gehören dazu. Erwartet werden einfache Sätze mit „weil“ oder „wenn“ und ein Fragesatz.",
);

// ================================================================ SPEAKING

const speaking = [
  a.speaking("introduction", "EASY", INTRO_TIME, INTRO_PROMPT, INTRO_POINTS, [], INTRO_EXPLANATION),
  a.speaking(
    "monologue",
    "MID",
    LIFE_TIME,
    "Erzählen Sie bitte von Ihrer Schulzeit.\n\n- Welche Schule haben Sie besucht?\n- Welche Fächer mochten Sie gern, welche nicht?\n- Was war schwierig, was war schön?\n- Was haben Sie nach der Schule gemacht?",
    [
      "Die Schule nennen (Art der Schule, Dauer oder Ort)",
      "Lieblingsfächer und Fächer, die man nicht mochte, mit einem Grund",
      "Etwas Schwieriges und etwas Schönes aus der Schulzeit nennen",
      "Sagen, was nach der Schule kam (Ausbildung, Studium oder Arbeit)",
    ],
    [],
    "Über das eigene Leben sprechen (Kapitel 2: Schulzeit). Erwartet werden Vergangenheitsformen (Präteritum von sein und haben, Modalverben, Perfekt) und Begründungen mit „weil“.",
  ),
];

export const A2_INTERIM_A: SeedCourseForm = {
  key: "A2.1",
  form: "A",
  syllabus: interimSyllabus(),
  sections: [
    { section: "READING", stimuli: [baeckerin, viertel], items: reading },
    { section: "GRAMMAR", stimuli: [], items: [cloze, ...sentences] },
    { section: "LISTENING", stimuli: [buergeramt, kino, bahnhof, geburtstag], items: listening },
    { section: "WRITING", stimuli: [], items: [writing] },
    { section: "SPEAKING", stimuli: [], items: speaking },
  ],
};
