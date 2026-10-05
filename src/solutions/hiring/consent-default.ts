/**
 * The hiring consent text an organisation gets when it has none (decision 3).
 * It describes exactly what plan 2 records: answers, files, video and audio of
 * recorded questions, and the technical records (C24 ruling): IP address and
 * browser information at the first open and at consent, stage start and
 * finish times, whether time ran out, upload and connection facts; no
 * monitoring. A level with monitoring (plan 4) needs a new text version.
 */
export const HIRING_CONSENT_TR =
  "Bu değerlendirme, bu pozisyona yaptığın başvuruyu değerlendirmek için hazırlandı. Cevapların (yazdıkların, seçimlerin, yüklediğin dosyalar ve video ya da ses sorularında görüntün ve sesin) ve teknik kayıtlar (linki ilk açtığında ve onay verdiğinde IP adresin ve tarayıcı bilgin, aşamaları başlattığın ve bitirdiğin zamanlar, sürenin dolup dolmadığı, yüklemelerin tamamlanıp tamamlanmadığı, bağlantının son görüldüğü an) saklanır. Bu değerlendirmede ekranın, sekmelerin ya da pencere hareketlerin izlenmez. Cevaplarını yalnızca bu pozisyonun işe alım ekibi görür; ekipteki değerlendiriciler aynı sorular ve aynı ölçütlerle, birbirinden bağımsız puanlar. Yapay zekâ seni puanlamaz, sıralamaz ya da elemez; yalnızca video ve ses cevaplarını yazıya döker (bunun için kayıtlar ElevenLabs'e gönderilir). Duygu, kişilik ya da yüz tanıma yapılmaz. Hiçbir kayıt seni otomatik olarak elemez; kararı insanlar verir. Kayıtlar kurumun belirlediği süre boyunca saklanır, sonra silinir. Verilerinle ilgili taleplerini bu sayfadaki veri hakları bağlantısından iletebilirsin.";

export const HIRING_CONSENT_EN =
  "This assessment was prepared to evaluate your application for this role. Your answers (what you write, your choices, the files you upload, and your picture and voice in video or audio questions) and technical records (your IP address and browser information when you first open the link and when you consent, when you start and finish each stage, whether time ran out, whether uploads completed, when the connection was last seen) are kept. Your screen, tabs and windows are not monitored in this assessment. Only this role's hiring team sees your answers; the evaluators on the team score them independently, with the same questions and the same criteria. AI does not score, rank or reject you; it only transcribes your video and audio answers (the recordings are sent to ElevenLabs for that). No emotion, personality or face recognition is used. Nothing here rejects you automatically; people make the decision. Records are kept for the period the organisation sets and then deleted. You can send requests about your data from the data rights link on this page.";

/**
 * Built-in texts an organisation may still hold as its newest version, oldest
 * first. ensureHiringConsentText replaces one of these with the current text
 * (a new version; invitations keep the text they froze). A text that is not
 * the built-in one, now or before, is the organisation's own and is kept.
 * When the built-in text changes, the old one is added here.
 */
export const HIRING_CONSENT_PREVIOUS: ReadonlyArray<{ tr: string; en: string }> = [
  {
    tr: "Bu değerlendirme, bu pozisyona yaptığın başvuruyu değerlendirmek için hazırlandı. Cevapların (yazdıkların, seçimlerin, yüklediğin dosyalar ve video ya da ses sorularında görüntün ve sesin) ve teknik kayıtlar (yüklemelerin tamamlanıp tamamlanmadığı, bağlantının son görüldüğü an) saklanır. Bu değerlendirmede ekranın, sekmelerin ya da pencere hareketlerin izlenmez. Cevaplarını yalnızca bu pozisyonun işe alım ekibi görür; ekipteki değerlendiriciler aynı sorular ve aynı ölçütlerle, birbirinden bağımsız puanlar. Yapay zekâ seni puanlamaz, sıralamaz ya da elemez; yalnızca video ve ses cevaplarını yazıya döker (bunun için kayıtlar ElevenLabs'e gönderilir). Duygu, kişilik ya da yüz tanıma yapılmaz. Hiçbir kayıt seni otomatik olarak elemez; kararı insanlar verir. Kayıtlar kurumun belirlediği süre boyunca saklanır, sonra silinir. Verilerinle ilgili taleplerini bu sayfadaki veri hakları bağlantısından iletebilirsin.",
    en: "This assessment was prepared to evaluate your application for this role. Your answers (what you write, your choices, the files you upload, and your picture and voice in video or audio questions) and technical records (whether uploads completed, when the connection was last seen) are kept. Your screen, tabs and windows are not monitored in this assessment. Only this role's hiring team sees your answers; the evaluators on the team score them independently, with the same questions and the same criteria. AI does not score, rank or reject you; it only transcribes your video and audio answers (the recordings are sent to ElevenLabs for that). No emotion, personality or face recognition is used. Nothing here rejects you automatically; people make the decision. Records are kept for the period the organisation sets and then deleted. You can send requests about your data from the data rights link on this page.",
  },
];
