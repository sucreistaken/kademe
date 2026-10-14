/**
 * The consent text shown before every exam. Shared by the development seed and
 * the production setup, so both promise the same thing.
 *
 * Version 2 (2026-10-14) says that the whole exam is recorded: the camera with
 * its sound, and the screen when it is shared (src/lib/client/proctor/recording.ts).
 * Version 1 only promised frames at intervals. The migration
 * `*_exam_consent_recording.sql` writes version 2 as the next version for every
 * organisation whose newest exam text is still the unedited version 1; a text a
 * school wrote itself is left alone. Invitations keep the text they were
 * accepted under.
 *
 * Whether a text announces the recording is stored on the row
 * (consent_texts.covers_recording), not read from its version: a new
 * organisation gets this text as its version 1. `*_consent_covers_recording.sql`
 * sets it for every row carrying exactly this text; the seed and the production
 * setup set it when they write it. An invitation accepted under any other text
 * is not recorded.
 */

export const CONSENT_TR = `Bu sınav Almanca seviyenizi ölçmek içindir. Sınav boyunca kameranız ve mikrofonunuz açık kalır, ekranınızın tamamı paylaşılır ve sınav tam ekranda yapılır. Sınavın tamamı kaydedilir: kameranızın görüntüsü ve sesi, ekranınız paylaşılıyorsa ekranınız da. Bu kaydı yalnızca okulunuzun yetkili kullanıcıları izleyebilir. Pencere veya sekme değiştirme, kopyala-yapıştır denemeleri ve benzeri olaylar kaydedilir. Belirli aralıklarla ve şüpheli anlarda kameranızdan ve ekranınızdan kareler alınır; bu kareler yapay zekâ ile ikinci kez kontrol edilebilir. Yapay zekâ yalnızca görülen olguları not eder (kaç kişi var, bir cihaz görünüyor mu gibi), duygu veya kişilik çıkarımı yapmaz. Hiçbir işaret sizi otomatik olarak başarısız saymaz: hepsini öğretmeniniz inceler. Yazma ve konuşma cevaplarınız için yapay zekâ bir seviye önerir, nihai kararı öğretmeniniz verir. Kayıtlar okulun belirlediği süre boyunca saklanır ve sonra silinir. Verilerinizle ilgili taleplerinizi bu sayfadaki bağlantıdan iletebilirsiniz.`;
export const CONSENT_EN = `This exam measures your German. During the exam your camera and microphone stay on, your whole screen is shared and the exam runs in full screen. The whole exam is recorded: the picture and sound from your camera, and your screen when it is shared. Only authorised staff of your school can watch this recording. Switching windows or tabs, copy and paste attempts and similar events are recorded. Frames from your camera and screen are taken at intervals and at suspicious moments; these frames may be checked a second time by AI. The AI only notes what can be seen (how many people, whether a device is visible), never emotions or personality. No flag fails you automatically: your teacher reviews all of them. For your writing and speaking answers the AI suggests a level; your teacher makes the final decision. Recordings are kept for the period your school sets and then deleted. You can send requests about your data from the link on this page.`;

/** Version 1, before the continuous recording. Kept so the migration can tell an unedited text from a school's own. */
export const CONSENT_V1_TR = `Bu sınav Almanca seviyenizi ölçmek içindir. Sınav boyunca kameranız ve mikrofonunuz açık kalır, ekranınızın tamamı paylaşılır ve sınav tam ekranda yapılır. Pencere veya sekme değiştirme, kopyala-yapıştır denemeleri ve benzeri olaylar kaydedilir. Belirli aralıklarla ve şüpheli anlarda kameranızdan ve ekranınızdan kareler alınır; bu kareler yapay zekâ ile ikinci kez kontrol edilebilir. Yapay zekâ yalnızca görülen olguları not eder (kaç kişi var, bir cihaz görünüyor mu gibi), duygu veya kişilik çıkarımı yapmaz. Hiçbir işaret sizi otomatik olarak başarısız saymaz: hepsini öğretmeniniz inceler. Yazma ve konuşma cevaplarınız için yapay zekâ bir seviye önerir, nihai kararı öğretmeniniz verir. Kayıtlar okulun belirlediği süre boyunca saklanır ve sonra silinir. Verilerinizle ilgili taleplerinizi bu sayfadaki bağlantıdan iletebilirsiniz.`;
export const CONSENT_V1_EN = `This exam measures your German. During the exam your camera and microphone stay on, your whole screen is shared and the exam runs in full screen. Switching windows or tabs, copy and paste attempts and similar events are recorded. Frames from your camera and screen are taken at intervals and at suspicious moments; these frames may be checked a second time by AI. The AI only notes what can be seen (how many people, whether a device is visible), never emotions or personality. No flag fails you automatically: your teacher reviews all of them. For your writing and speaking answers the AI suggests a level; your teacher makes the final decision. Recordings are kept for the period your school sets and then deleted. You can send requests about your data from the link on this page.`;
