import { longText, single, stage, t, video } from "./build";
import type { TemplateStage } from "./types";

/**
 * Stage 3 of every German-teacher template: the candidate's own German, target C1.
 * The e-mail measures german_proficiency plus the role's second competency, so
 * each template keeps exactly three weighted competencies.
 *
 * Timing is sized for the worst case: 8 singles (~8 min), one single-take video
 * (60 s think + 120 s answer, ~4 min) and the e-mail last (~8 min), because
 * AUTO_SUBMIT drops what is still open when the timer ends.
 */
export type ProficiencySecondKey = "communication" | "didactics";

const grammar = (item: string) =>
  t(`Dilbilgisi: boşluğa doğru gelen seçeneği seç.\n\n${item}`, `Grammar: choose the option that correctly fills the gap.\n\n${item}`);
const collocation = (item: string) =>
  t(`Kelime ve kalıp: boşluğu doğru Almanca kalıpla tamamlayan kelimeyi seç.\n\n${item}`, `Vocabulary: choose the word that completes the fixed German expression.\n\n${item}`);
const cTest = (item: string) =>
  t(
    `C-test tarzı: metinde sonu silinmiş kelimenin doğru tamamlanmış hâlini seç.\n\n${item}`,
    `C-test style: choose the correctly completed form of the word whose ending is missing.\n\n${item}`,
  );
/** German options read the same in both locales. */
const de = (...words: string[]) => words.map((w) => t(w, w));

const SECOND_KEY_BEHAVIOUR: Record<ProficiencySecondKey, string> = {
  communication: "Ana mesajı ilk paragrafta veriyor, olgulara dayalı ve tarafsız yazıyor, Frau Keller'in ne yapmasını istediğini açıkça söylüyor",
  didactics: "Telafi önerisi öğretimsel olarak somut: hangi içerik, hangi alıştırma, ne sıklıkla ve ilerlemenin nasıl ölçüleceği (ör. deneme sınavı)",
};

export function germanProficiencyStage(secondKey: ProficiencySecondKey): TemplateStage {
  return stage({
    name: t("Almanca yeterlik", "German proficiency"),
    description: t(
      "Sekiz kısa Almanca sorusu, iki dakikalık bir Almanca video ve Almanca resmî bir e-posta. E-posta en sonda, kalan süre onun için. En fazla 20 dakika.",
      "Eight short German questions, a two-minute video in German and a formal e-mail in German. The e-mail comes last and the remaining time is for it. At most 20 minutes.",
    ),
    purpose:
      "Adayın Almanca seviyesi: hedef C1. Süre en kötü duruma göre: 8 soru (~8 dk), tek çekimli video (~4 dk), e-posta (~8 dk). Video tek çekim, çünkü kendiliğinden konuşma örneği isteniyor.",
    minutes: 20,
    activities: [
      single({
        prompt: grammar("„Wenn der Zug pünktlich gewesen wäre, ___ wir den Anschluss in Köln nicht verpasst.“"),
        options: de("wären", "hätten", "würden", "hatten"),
        correct: 1,
        internal:
          "Doğru: hätten. Konjunktiv II Vergangenheit = hätte/wäre + Partizip II; verpassen Perfekt'i haben ile kurar (Akkusativ nesnesi var). Çeldiriciler: wären (yardımcı fiil hatası, sein ile kurmak); würden (würde + Partizip II, haben eksik; doğrusu 'würden ... verpasst haben' olurdu); hatten (Indikativ Plusquamperfekt, Umlaut'u unutmak; wenn cümlesindeki Konjunktiv ile uyuşmaz).",
      }),
      single({
        prompt: grammar("„Die Unterlagen hätten eigentlich schon gestern ___ müssen.“"),
        options: de("eingereicht worden", "einreichen werden", "eingereicht geworden", "eingereicht werden"),
        correct: 3,
        internal:
          "Doğru: eingereicht werden. Modalverb'li Passiv'in Konjunktiv II geçmişi: hätten + Partizip II + werden + müssen (Ersatzinfinitiv, yan yana iki mastar). Çeldiriciler: eingereicht worden (worden yalnızca sein ile Perfekt Passiv'de, burada mastar gerekir); einreichen werden (etken mastar, Passiv kurulmamış); eingereicht geworden (geworden tam fiil werden'in ortacıdır, Passiv'de kullanılmaz).",
      }),
      single({
        prompt: grammar("„Frau Becker ist eine Kollegin, ___ ich mich in jeder Situation verlassen kann.“"),
        options: de("auf die", "auf der", "worauf", "der"),
        correct: 0,
        internal:
          "Doğru: auf die. sich verlassen auf + Akkusativ; ilgi zamiri Kollegin'e göre dişil ve Akkusativ: auf die. Çeldiriciler: auf der (auf'u Dativ ile kullanmak, Wechselpräposition karışıklığı); worauf (wo- birleşimi standart dilde kişiler için kullanılmaz, nesne ya da cümle için kullanılır); der (edatı düşürmek, fiilin edat istediğini bilmemek).",
      }),
      single({
        prompt: collocation("„Ich möchte dieses Problem in der nächsten Teamsitzung zur Sprache ___.“"),
        options: de("kommen", "stellen", "bringen", "nehmen"),
        correct: 2,
        internal:
          "Doğru: bringen (etwas zur Sprache bringen = bir konuyu gündeme getirmek). Çeldiriciler: kommen ('etwas kommt zur Sprache' geçişsizdir, nesne alamaz; en sık karışıklık); stellen ('zur Diskussion stellen', 'zur Verfügung stellen' kalıplarından aktarma); nehmen (Nomen-Verb kalıplarında nehmen'i genelleştirmek: 'in Kauf nehmen' gibi). Seviye: C1.",
      }),
      single({
        prompt: collocation("„Bitte ___ Sie mehr Rücksicht auf die Teilnehmenden, die gerade erst mit dem Kurs angefangen haben.“"),
        options: de("machen", "halten", "geben", "nehmen"),
        correct: 3,
        internal:
          "Doğru: nehmen (Rücksicht nehmen auf + Akkusativ). Çeldiriciler: machen (İngilizce ve Türkçe kalıplardan genelleme); halten ('Abstand halten', 'Rücksprache halten' ile karıştırmak); geben (Türkçe 'önem vermek' gibi kalıplardan aktarma). Seviye: B2.",
      }),
      single({
        prompt: collocation("„Wir müssen alle Teilnehmenden rechtzeitig über die Raumänderung in ___ setzen.“"),
        options: de("Kenntnis", "Wissen", "Bescheid", "Information"),
        correct: 0,
        internal:
          "Doğru: Kenntnis (jemanden über etwas in Kenntnis setzen = resmî bilgilendirmek). Çeldiriciler: Wissen (anlamca yakın ama kalıpta yok); Bescheid ('Bescheid geben/sagen' ile karıştırmak, 'in Bescheid setzen' yok); Information (Türkçe ve İngilizceden düz çeviri). Seviye: C1, resmî yazışma dili.",
      }),
      single({
        prompt: cTest("„Nicht alle Teilnehmenden lernen im gleichen Tempo. Deshalb sollte die Lehrkraft die Aufgaben an das jeweilige Niveau an___.“"),
        options: de("anpasst", "anzupassen", "anpassen", "angepasst"),
        correct: 2,
        internal:
          "Doğru: anpassen. Modalverb (sollte) yalın mastar ister ve mastar cümle sonunda durur. Çeldiriciler: anpasst (çekimli fiili cümle sonuna koymak, yan cümle kuralıyla karıştırmak); anzupassen (modalverb'den sonra zu kullanmak, sık yapılan hata); angepasst (ortacı yardımcı fiilsiz kullanmak; 'angepasst werden/haben' olurdu).",
      }),
      single({
        prompt: cTest("„Die Diskussion über das neue Lehrbuch war sehr lebhaft. Alle haben mit groß___ Interesse teilgenommen.“"),
        options: de("großen", "großem", "großes", "großer"),
        correct: 1,
        internal:
          "Doğru: großem. mit + Dativ, das Interesse nötr, artikelsiz: güçlü çekim -em (mit großem Interesse). Çeldiriciler: großen (her yerde -en kullanma genellemesi, en sık hata); großes (Nominativ ya da Akkusativ nötr çekimi, mit'in Dativ istediğini atlamak); großer (dişil Dativ çekimi, cinsiyet hatası).",
      }),
      video({
        prompt: t(
          "Almanca, 2 dakika konuş. Görev:\n\n„Erklären Sie einer Kollegin, wie Sie mit sehr unterschiedlichen Niveaus in einer Gruppe umgehen.“\n\nBir meslektaşınla konuşur gibi, doğal bir dille anlat. Bu soruda tek çekim hakkın var.",
          "Speak German for 2 minutes. Task:\n\n„Erklären Sie einer Kollegin, wie Sie mit sehr unterschiedlichen Niveaus in einer Gruppe umgehen.“\n\nTalk naturally, as you would to a colleague. You have one take for this question.",
        ),
        competencies: ["german_proficiency"],
        takes: 1,
        expected: [
          "İki dakika boyunca akıcı ve büyük ölçüde duraksamadan konuşuyor",
          "Meslek dilini doğal kullanıyor (Binnendifferenzierung, gestufte Aufgaben, Lernstand gibi) ve yan cümleleri, bağlaçları çeşitli kuruyor",
          "Hatalar seyrek ve anlamı bozmuyor; meslektaşa uygun bir üslup kullanıyor",
          "Düşünceyi bir örnekle somutlaştırıyor ve tartıyor (Vorteil, Nachteil, ich würde ...)",
        ],
        redFlags: ["Kısa ve basit cümlelerde kalıyor, sık duraksıyor ya da Türkçeye geçiyor", "Fiil yeri, çekim ve artikel hataları anlamı bozuyor"],
        examples: {
          1: "B1 civarı: „Ich mache Gruppen. Die gute Schüler helfen die schwache Schüler. Ich gebe andere Aufgabe.“ Kısa cümleler, sık duraksama, temel hatalar (artikel, Dativ), soyut bir düşünceyi açamıyor.",
          3: "C1: „Bei sehr gemischten Gruppen arbeite ich viel mit gestuften Aufgaben: Alle bearbeiten denselben Text, aber die Stärkeren bekommen zusätzlich offene Fragen, während ich mit den Schwächeren den Wortschatz sichere.“ Akıcı, çeşitli yapılar, seyrek ve küçük hatalar.",
          5: "C2'ye yakın: „Ehrlich gesagt sehe ich Heterogenität inzwischen eher als Chance: Wenn die Lernstände weit auseinanderliegen, lasse ich die Fortgeschrittenen Aufgaben selbst formulieren, was ihnen und den anderen gleichermaßen zugutekommt.“ Zahmetsiz akış, ince anlam ve üslup farkları, deyimsel dil, hata neredeyse yok.",
        },
      }),
      longText({
        prompt: t(
          "Son görev: Almanca resmî bir e-posta yaz (en az 600 karakter).\n\nDurum: Okulunda Berger Logistik GmbH çalışanları için bir B1 şirket kursu veriyorsun, salı ve perşembe 17:00-18:30. Kursu şirket ödüyor ve katılımcılar sözleşmede devam durumlarının şirkete bildirilmesini kabul etti. Katılımcı Herr Novak son 8 dersin 5'ine gelmedi; altı hafta sonra telc Deutsch B1 sınavına girecek. Şirketteki muhatabın insan kaynaklarından Frau Keller.\n\nE-postada şu dört noktaya değin:\n1. Devamsızlığı somut ve tarafsız biçimde bildir.\n2. Bunun sınav hedefine etkisini açıkla.\n3. Kaçırılan konuları telafi etmek için somut bir öneri sun.\n4. Kısa bir görüşme için bir zaman öner.",
          "Last task: write a formal e-mail in German (at least 600 characters).\n\nSituation: at your school you teach a B1 company course for employees of Berger Logistik GmbH, Tuesdays and Thursdays 17:00-18:30. The company pays for the course, and in their contract the participants agreed that their attendance is reported to the company. Participant Herr Novak missed 5 of the last 8 lessons; he takes the telc Deutsch B1 exam in six weeks. Your contact at the company is Frau Keller from human resources.\n\nCover these four points in the e-mail:\n1. Report the absences concretely and neutrally.\n2. Explain the effect on the exam goal.\n3. Make a concrete proposal for catching up on the missed content.\n4. Suggest a time for a short meeting.",
        ),
        competencies: ["german_proficiency", secondKey],
        minChars: 600,
        maxChars: 3000,
        expected: [
          "Dört içerik noktasının hepsini işliyor: devamsızlık (8 dersin 5'i), sınav hedefine etkisi, somut telafi önerisi, görüşme zamanı",
          "Resmî e-posta kalıplarını doğru ve tutarlı kullanıyor (Sehr geehrte Frau Keller, Sie-Form, Mit freundlichen Grüßen)",
          "Hatalar seyrek ve anlamı bozmuyor; çeşitli yapılar kullanıyor (yan cümle, Konjunktiv II ile kibar öneri, Nomen-Verb-Verbindungen)",
          SECOND_KEY_BEHAVIOUR[secondKey],
        ],
        redFlags: [
          "Devamsızlığın özel nedenleri hakkında tahmin yürütüyor ya da katılımcıyı suçluyor",
          "Üslup karışık (du ve Sie, gündelik kalıplar) ya da hatalar anlamı bozuyor",
          "İçerik noktalarından birini ya da birkaçını atlıyor",
        ],
        examples: {
          1: "„Sehr geehrte Frau Keller, ich schreibe Ihnen wegen Herr Novak. Er war in die letzte acht Stunden fünf Mal nicht da. Das ist schlecht für die Prüfung, weil er viel verpasst hat. Vielleicht er kann mehr Hausaufgaben machen. Können wir telefonieren? Mit freundliche Grüße“ (B1 civarı: noktalar yüzeysel, zaman yok, temel hatalar: wegen Herr, in die letzte acht Stunden, Vielleicht er kann, freundliche Grüße.)",
          3: "„Sehr geehrte Frau Keller, ich wende mich an Sie, weil Herr Novak in den letzten vier Wochen an fünf von acht Kursterminen nicht teilgenommen hat. Da er in sechs Wochen die Prüfung telc Deutsch B1 ablegen soll, sehe ich das Prüfungsziel gefährdet. Ich schlage vor, dass er bis zur Prüfung wöchentlich zusätzliche Übungen erhält, die ich korrigiere. Hätten Sie am Dienstag um 15 Uhr Zeit für ein kurzes Telefonat? Mit freundlichen Grüßen“ (C1)",
          5: "„Sehr geehrte Frau Keller, ich möchte Sie auf die Fehlzeiten von Herrn Novak aufmerksam machen: Von den letzten acht Kursterminen hat er fünf versäumt. Über die Gründe möchte ich nicht spekulieren; fest steht jedoch, dass ihm bis zur Prüfung in sechs Wochen zentrale Inhalte fehlen. Ich würde ihm daher einen Nachholplan anbieten: zwei korrigierte Übungstexte pro Woche und eine Probeprüfung in vier Wochen. Passt Ihnen ein kurzes Gespräch am Donnerstag um 16 Uhr? Mit freundlichen Grüßen“ (C2'ye yakın)",
        },
        internal:
          "german_proficiency örnekleri: 1 = B1 civarı, 3 = C1, 5 = C2'ye yakın. Dört nokta, Sie-Form ve resmî kalıplar zorunlu. Devam bildirimi sözleşmeyle kabul edildiği için şirkete yazmak meşru; ama devamsızlığın nedenlerine dair yorum ya da tahmin gizlilik açısından hata sayılır. Örnekler 600 karakter sınırı nedeniyle kısaltılmış özetlerdir; adayın cevabı yine en az 600 karakter olmalı. Uzunluk değil dört noktanın işlenişi ve dil kalitesi puanlanır.",
      }),
    ],
  });
}
