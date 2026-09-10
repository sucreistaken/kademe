/**
 * Development seed.
 *
 * Two jobs:
 *  1. Ship the library FULL. The biggest abandonment risk in this product is a
 *     manager opening an empty competency library, so eight competencies, a
 *     written 1-5 scale and seven observation chips per competency are part of
 *     the product, not demo dressing.
 *  2. Give every manager screen real rows to render: a dashboard queue, a
 *     candidate table with each status, a comparison table and a detail page.
 *
 * Run with: pnpm db:seed
 *
 * Ordering rule that is easy to get wrong: a PUBLISHED template_version is
 * frozen by a database trigger (drizzle/sql/0001_immutability.sql). Stages and
 * activities are therefore written while the version is still DRAFT, and the
 * status is flipped to PUBLISHED as the very last step of that block.
 */

import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash as argon2Hash } from "@node-rs/argon2";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { getStorage, mediaKey } from "../lib/storage";
import * as s from "./schema";
import type { I18nText } from "./schema";

/** Development password. Printed at the end of the run, never used in prod. */
const DEV_PASSWORD = "kademe-dev-2026";
const OWNER_EMAIL = "kadiraycareer@gmail.com";

const i18n = (tr: string, en: string): I18nText => ({ tr, en });
const sha256 = (raw: string) => createHash("sha256").update(raw).digest("hex");

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const now = Date.now();
const at = (offsetMs: number) => new Date(now + offsetMs);

/* ------------------------------------------------------------------ */
/* Placeholder media                                                   */
/* ------------------------------------------------------------------ */

const PLACEHOLDER_SECONDS = 6;

/**
 * A media_asset that says READY must have an object behind it, otherwise the
 * review screen spins forever and the seed is lying about the one thing the
 * status column exists to state. So the seed renders a real short clip and
 * writes it through the storage provider, exactly like the candidate recorder
 * would. If ffmpeg is missing we do not fake it: the rows stay UPLOADING and
 * the player says so.
 */
function makePlaceholderClip(): { bytes: Buffer; durationMs: number } | null {
  const target = join(tmpdir(), `kademe-seed-${randomUUID()}.webm`);
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi",
      "-i", `color=c=0x0E6A57:s=320x240:r=15:d=${PLACEHOLDER_SECONDS}`,
      "-c:v", "libvpx", "-b:v", "80k",
      target,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return null;
  try {
    const bytes = readFileSync(target);
    return { bytes, durationMs: PLACEHOLDER_SECONDS * 1000 };
  } catch {
    return null;
  } finally {
    rmSync(target, { force: true });
  }
}

/* ------------------------------------------------------------------ */
/* Reset                                                               */
/* ------------------------------------------------------------------ */

/**
 * TRUNCATE rather than DELETE on purpose: row level triggers do not fire on
 * TRUNCATE, so an already published version from a previous run does not block
 * the reset.
 *
 * The local media directory goes with it. Truncating media_assets without
 * deleting the objects would leave files on disk that nothing points at, which
 * is exactly the orphan state the retention job exists to prevent.
 */
async function reset() {
  const localRoot = process.env.LOCAL_STORAGE_DIR
    ? resolve(process.env.LOCAL_STORAGE_DIR)
    : resolve(process.cwd(), ".storage");
  rmSync(resolve(localRoot, "media"), { recursive: true, force: true });

  await db.execute(sql`
    TRUNCATE TABLE
      organizations, users, sessions, audit_logs,
      positions, templates, template_versions, stages, activities,
      stage_competencies, competencies, rating_scales, scale_levels,
      evaluation_options, weight_sets, weights,
      candidates, assessments, assessment_links, attempts, stage_runs,
      responses, media_assets, transcripts,
      evaluations, evaluation_items, stage_notes, decisions, retake_requests,
      consent_texts, consents, technical_events, ai_runs, message_outbox,
      deletion_requests
    RESTART IDENTITY CASCADE
  `);
}

/* ------------------------------------------------------------------ */
/* Library content                                                     */
/* ------------------------------------------------------------------ */

/**
 * The behavioural anchors. A bare 1-5 has weak predictive validity; the written
 * definition per level is what makes two managers score the same answer the
 * same way, so these are deliberately concrete about observable behaviour.
 */
const SCALE_LEVELS: Array<{ value: number; label: I18nText; anchor: I18nText }> = [
  {
    value: 1,
    label: i18n("1 · beklentinin çok altında", "1 · far below expectation"),
    anchor: i18n(
      "Soruyu ele almadı ya da konudan uzaklaştı. Somut örnek ve gerekçe yok. Bu düzey rol için yeterli değil.",
      "Did not engage with the question or drifted off topic. No concrete example, no reasoning. Not sufficient for the role.",
    ),
  },
  {
    value: 2,
    label: i18n("2 · beklentinin altında", "2 · below expectation"),
    anchor: i18n(
      "Konuya girdi ama yüzeyde kaldı. Örnekleri genel, gerekçesi zayıf. Yakın destekle gelişebilir.",
      "Engaged but stayed on the surface. Generic examples, thin reasoning. Could develop with close support.",
    ),
  },
  {
    value: 3,
    label: i18n("3 · beklendiği gibi", "3 · as expected"),
    anchor: i18n(
      "Sorunun istediğini karşıladı. Somut bir örnek verdi ve kararının gerekçesini açıkladı. Rolün beklediği düzey budur.",
      "Met what the question asked. Gave a concrete example and explained the reasoning behind the decision. This is the level the role expects.",
    ),
  },
  {
    value: 4,
    label: i18n("4 · beklentinin üstünde", "4 · above expectation"),
    anchor: i18n(
      "Beklenenden fazlasını yaptı. Varsayımlarını söyledi, alternatifleri tarttı, kendi kararının riskini kendisi belirtti.",
      "Went beyond what was asked. Stated assumptions, weighed alternatives, and named the risk in their own choice.",
    ),
  },
  {
    value: 5,
    label: i18n("5 · örnek gösterilecek düzeyde", "5 · exemplary"),
    anchor: i18n(
      "Soruyu yeniden çerçeveledi ve başkasının da kullanabileceği bir yaklaşım ortaya koydu. Başarı ölçütünü kendisi tanımladı.",
      "Reframed the question and offered an approach others could reuse. Defined the measure of success without being asked.",
    ),
  },
];

type CompetencySeed = {
  key: string;
  name: I18nText;
  description: I18nText;
  positive: I18nText[];
  negative: I18nText[];
};

/** Eight competencies, each with four positive and three negative chips. */
const COMPETENCIES: CompetencySeed[] = [
  {
    key: "communication",
    name: i18n("İletişim", "Communication"),
    description: i18n(
      "Karmaşık bir düşünceyi dinleyicisine göre, sırayla ve örnekle anlatabilme.",
      "Explaining a complex idea in order, with examples, calibrated to the listener.",
    ),
    positive: [
      i18n("Net ve yapılandırılmış anlattı", "Clear and structured"),
      i18n("Dinleyiciye göre sadeleştirdi", "Adapted to the listener"),
      i18n("Örnekle somutlaştırdı", "Grounded it in an example"),
      i18n("Sorulanı doğru anladı", "Understood what was asked"),
    ],
    negative: [
      i18n("Soruyu dağıttı", "Drifted off the question"),
      i18n("Terimlerin arkasına saklandı", "Hid behind jargon"),
      i18n("Sorunun bir kısmını yanıtsız bıraktı", "Left part of the question unanswered"),
    ],
  },
  {
    key: "problem_solving",
    name: i18n("Problem Çözme", "Problem Solving"),
    description: i18n(
      "Sorunu doğru tanımlama, varsayımları görünür kılma ve seçenekleri gerekçeyle daraltma.",
      "Framing the real problem, surfacing assumptions, and narrowing options with stated reasoning.",
    ),
    positive: [
      i18n("Sorunu yeniden tanımladı", "Reframed the problem"),
      i18n("Varsayımlarını açıkça söyledi", "Stated assumptions out loud"),
      i18n("Birden fazla seçenek üretti", "Produced more than one option"),
      i18n("Kararının gerekçesini verdi", "Gave the reason behind the choice"),
    ],
    negative: [
      i18n("Tek çözüme erken kilitlendi", "Locked onto one solution too early"),
      i18n("Nedeni belirtiyle karıştırdı", "Confused cause with symptom"),
      i18n("Çözümü test edilebilir değil", "Solution is not testable"),
    ],
  },
  {
    key: "initiative",
    name: i18n("İnisiyatif", "Initiative"),
    description: i18n(
      "Belirsizlikte kendi kararıyla ilerleme ve sonucu sahiplenme.",
      "Moving forward under uncertainty on their own call, and owning the outcome.",
    ),
    positive: [
      i18n("Riski kendi söyledi", "Named the risk unprompted"),
      i18n("Sormadan bir sonraki adımı önerdi", "Proposed the next step unprompted"),
      i18n("Sahiplendiği bir iş anlattı", "Described work they owned"),
      i18n("Belirsizliğe rağmen ilerledi", "Moved forward despite ambiguity"),
    ],
    negative: [
      i18n("Onay beklediğini ima etti", "Implied they were waiting for approval"),
      i18n("Sorumluluğu devretti", "Handed responsibility elsewhere"),
      i18n("Kendi katkısını ayırt edemedi", "Could not separate their own contribution"),
    ],
  },
  {
    key: "commercial",
    name: i18n("Satış Bakışı", "Commercial Sense"),
    description: i18n(
      "İşi müşterinin kazancına bağlama, itirazı karşılama ve değeri ölçülebilir anlatma.",
      "Tying the work to customer gain, handling objections, and expressing value in measurable terms.",
    ),
    positive: [
      i18n("Müşterinin işine bağladı", "Connected it to the customer's business"),
      i18n("İtirazı doğrudan karşıladı", "Met the objection head on"),
      i18n("Değeri sayıyla ifade etti", "Expressed value as a number"),
      i18n("Bir sonraki adımı netleştirdi", "Made the next step explicit"),
    ],
    negative: [
      i18n("Özellik anlattı, fayda anlatmadı", "Described features, not benefit"),
      i18n("Fiyatı ilk savunma aracı yaptı", "Reached for price as the first defence"),
      i18n("Müşterinin bağlamını sormadı", "Never asked about the customer's context"),
    ],
  },
  {
    key: "technical",
    name: i18n("Teknik Bilgi", "Technical Knowledge"),
    description: i18n(
      "Alanın kavramlarını yerinde kullanma, sınırlarını ve ödünleşimlerini bilme.",
      "Using the field's concepts correctly, and knowing their limits and trade-offs.",
    ),
    positive: [
      i18n("Doğru kavramı doğru yerde kullandı", "Used the right concept in the right place"),
      i18n("Ödünleşimi adıyla anlattı", "Named the trade-off"),
      i18n("Uygulamadan örnek verdi", "Gave an example from practice"),
      i18n("Bilmediği yeri bilmediğini söyledi", "Said plainly what they did not know"),
    ],
    negative: [
      i18n("Tanım doğru, uygulaması yok", "Definition right, application missing"),
      i18n("Kavramları birbirine karıştırdı", "Mixed up the concepts"),
      i18n("Ezber cevap verdi", "Gave a memorised answer"),
    ],
  },
  {
    key: "organisation",
    name: i18n("Organizasyon", "Organisation"),
    description: i18n(
      "İşi adımlara bölme, önceliği gerekçeyle seçme ve takibini kurma.",
      "Breaking work into steps, choosing priority with a reason, and setting up follow-up.",
    ),
    positive: [
      i18n("İşi adımlara böldü", "Broke the work into steps"),
      i18n("Önceliği gerekçesiyle seçti", "Chose priority with a reason"),
      i18n("Süre ve kapsamı birlikte düşündü", "Considered time and scope together"),
      i18n("Takibi nasıl kuracağını söyledi", "Said how they would follow up"),
    ],
    negative: [
      i18n("Her şeyi aynı anda yapmayı önerdi", "Proposed doing everything at once"),
      i18n("Bağımlılıkları atladı", "Skipped the dependencies"),
      i18n("Planı takvimsiz kaldı", "Plan had no timeline"),
    ],
  },
  {
    key: "teamwork",
    name: i18n("Takım Çalışması", "Teamwork"),
    description: i18n(
      "Ortak sonucu birlikte üretme, anlaşmazlığı işi ilerletecek şekilde çözme.",
      "Producing a shared outcome together, and resolving disagreement in a way that moves work forward.",
    ),
    positive: [
      i18n("Başkasının katkısını adıyla andı", "Credited someone else's contribution"),
      i18n("Anlaşmazlığı örnekle çözdü", "Resolved disagreement with evidence"),
      i18n("Yardım istediği yeri anlattı", "Described where they asked for help"),
      i18n("Ortak kararı sahiplendi", "Owned the shared decision"),
    ],
    negative: [
      i18n("Başarıyı tek başına anlattı", "Told the success as a solo story"),
      i18n("Çatışmadan kaçındığını söyledi", "Said they avoided the conflict"),
      i18n("Ekibi suçladı", "Blamed the team"),
    ],
  },
  {
    key: "customer",
    name: i18n("Müşteri Odağı", "Customer Focus"),
    description: i18n(
      "Müşterinin gerçek sorununu anlama, beklentiyi yönetme ve sözünü takip etme.",
      "Understanding the customer's real problem, managing expectations, and following through.",
    ),
    positive: [
      i18n("Önce müşterinin sorununu anladı", "Understood the customer's problem first"),
      i18n("Geri bildirimi karara dönüştürdü", "Turned feedback into a decision"),
      i18n("Beklentiyi baştan netleştirdi", "Set expectations up front"),
      i18n("Kötü haberi zamanında verdi", "Delivered bad news in time"),
    ],
    negative: [
      i18n("Süreci müşterinin önüne koydu", "Put process ahead of the customer"),
      i18n("Şikayeti kişisel algıladı", "Took the complaint personally"),
      i18n("Sözünü takip etmedi", "Did not follow through on a promise"),
    ],
  },
];

const CONSENT_BODY = i18n(
  [
    "Bu değerlendirmede verdiğiniz video ve yazılı cevaplar, yalnızca başvurduğunuz pozisyon için",
    "işe alım kararını vermek amacıyla kullanılır.",
    "",
    "Ne kaydediliyor: soruların cevapları olarak kaydettiğiniz video ve sesler, yazdığınız metinler,",
    "yüklediğiniz dosyalar, verdiğiniz kişisel bilgiler ve oturum sırasındaki teknik olaylar",
    "(sekme değişimi, bağlantı kopması gibi).",
    "",
    "Kimler görüyor: yalnızca bu pozisyonun işe alım ekibi. Cevaplarınız üçüncü taraflara satılmaz",
    "ve reklam amacıyla kullanılmaz.",
    "",
    "Yapay zeka: konuşmanız metne çevrilir ve değerlendiricinin kendi yazdığı notlar özetlenebilir.",
    "Yapay zeka sizi puanlamaz, sıralamaz ve elemez. Kararı her zaman bir insan verir. Sesinizden veya",
    "yüzünüzden duygu ya da kişilik çıkarımı yapılmaz.",
    "",
    "Saklama süresi: video ve ses kayıtları 180 gün, başvuru kayıtları 730 gün sonra silinir.",
    "",
    "Haklarınız: verilerinizin bir kopyasını isteyebilir veya silinmesini talep edebilirsiniz. Bunun için",
    "değerlendirme bağlantısındaki 'Veri haklarım' sayfasını kullanabilirsiniz. Talebiniz 30 gün içinde",
    "yanıtlanır. Onay vermemeyi seçerseniz değerlendirmeye devam edemezsiniz, ancak başvurunuzu",
    "başka bir yolla iletmek için işe alım ekibiyle iletişime geçebilirsiniz.",
  ].join("\n"),
  [
    "The video and written answers you give in this assessment are used only to make a hiring",
    "decision for the position you applied to.",
    "",
    "What is recorded: the video and audio you record as answers, the text you write, the files you",
    "upload, the personal details you provide, and technical events during the session (such as tab",
    "changes or a lost connection).",
    "",
    "Who sees it: only the hiring team for this position. Your answers are never sold to third parties",
    "and never used for advertising.",
    "",
    "Artificial intelligence: your speech is transcribed, and the reviewer's own written notes may be",
    "summarised. AI does not score you, rank you, or reject you. A human always makes the decision.",
    "No emotion or personality is inferred from your voice or face.",
    "",
    "Retention: video and audio are deleted after 180 days, application records after 730 days.",
    "",
    "Your rights: you may request a copy of your data or ask for it to be deleted, using the 'My data",
    "rights' page on your assessment link. Requests are answered within 30 days. If you choose not to",
    "consent you cannot continue with the assessment, but you may contact the hiring team to submit",
    "your application another way.",
  ].join("\n"),
);

/* ------------------------------------------------------------------ */
/* Demo template shapes                                                */
/* ------------------------------------------------------------------ */

type ActivitySeed = {
  type: (typeof s.activityType.enumValues)[number];
  candidatePrompt: I18nText;
  candidateNote?: I18nText;
  internalQuestion?: string;
  internalObjective?: string;
  expectedBehaviours?: string[];
  redFlags?: string[];
  thinkSeconds: number;
  answerSeconds?: number;
  maxTakes?: number;
  config?: s.ActivityConfig;
};

type StageSeed = {
  name: I18nText;
  description: I18nText;
  internalPurpose: string;
  durationSeconds: number;
  competencyKeys: string[];
  activities: ActivitySeed[];
};

type TemplateSeed = {
  positionName: string;
  shortDescription: string;
  jobDescription: string;
  requiredSkills: string[];
  preferredSkills: string[];
  templateName: string;
  introTitle: I18nText;
  introBody: I18nText;
  stages: StageSeed[];
};

const DESIGNER: TemplateSeed = {
  positionName: "Kıdemli Ürün Tasarımcısı",
  shortDescription: "Ürün ekibiyle birlikte akış tasarlayan, kararını veriyle savunan tasarımcı.",
  jobDescription:
    "Ürün ekibinin içinde çalışan, keşiften teslime kadar akışı sahiplenen bir tasarımcı arıyoruz. " +
    "Araştırma bulgusunu tasarım kararına çevirebilmesi, kararını ölçülebilir bir hipoteze bağlayabilmesi " +
    "ve mühendislikle beraber ödünleşim konuşabilmesi bekleniyor.",
  requiredSkills: ["Ürün tasarımı", "Kullanıcı araştırması", "Prototipleme", "Figma"],
  preferredSkills: ["Veri okuryazarlığı", "Tasarım sistemi kurma", "B2B SaaS"],
  templateName: "Ürün tasarımcısı standart değerlendirme",
  introTitle: i18n("Kıdemli Ürün Tasarımcısı değerlendirmesi", "Senior Product Designer assessment"),
  introBody: i18n(
    "Üç aşama, toplam yaklaşık 28 dakika. Kamera ve mikrofon gerekiyor. Sorular aşama başladığında görünür.",
    "Three stages, about 28 minutes in total. Camera and microphone required. Questions appear when the stage starts.",
  ),
  stages: [
    {
      name: i18n("Tanışma", "Introduction"),
      description: i18n(
        "Kısa bir tanışma. Rahat olun, bu bölüm ısınma amaçlıdır.",
        "A short introduction. Take it easy, this part is a warm-up.",
      ),
      internalPurpose: "İletişim için taban ölçüm. Bu aşamaya fazla ağırlık verme.",
      durationSeconds: 300,
      competencyKeys: ["communication", "teamwork"],
      activities: [
        {
          type: "VIDEO",
          candidatePrompt: i18n(
            "Kendinizi ve son bir yılda üzerinde çalıştığınız bir işi kısaca anlatın.",
            "Introduce yourself and one piece of work from the past year.",
          ),
          candidateNote: i18n("En fazla 2 dakika. Tek çekim.", "Two minutes at most. Single take."),
          internalQuestion: "Bir yıllık işi, özünü kaybetmeden iki dakikaya sığdırabiliyor mu?",
          internalObjective: "Süre altında akıcılık ve kurgu için taban ölçüm.",
          expectedBehaviours: [
            "Her şeyi saymak yerine tek bir işi seçiyor",
            "Kendisi sayesinde neyin değiştiğini söylüyor",
          ],
          redFlags: ["Hazırlanmış metni okuyor", "Kendi katkısını adlandıramıyor"],
          thinkSeconds: 30,
          answerSeconds: 120,
          maxTakes: 2,
        },
        {
          type: "SHORT_TEXT",
          candidatePrompt: i18n(
            "Şu an sizi en çok geliştiren şey ne? Tek cümleyle yazın.",
            "What is developing you most right now? One sentence.",
          ),
          internalQuestion: "Öz farkındalık kontrolü, ucuz sinyal.",
          thinkSeconds: 0,
          answerSeconds: 90,
          config: { minChars: 20, maxChars: 240 },
        },
      ],
    },
    {
      name: i18n("Vaka çalışması", "Case study"),
      description: i18n(
        "Gerçek bir üründen alınmış bir durum. Sizden çözüm değil, düşünme biçiminiz bekleniyor.",
        "A situation taken from a real product. We are after your reasoning, not a finished solution.",
      ),
      internalPurpose: "Sonucu asıl belirleyen aşama. Ağırlığı buna göre ver.",
      durationSeconds: 900,
      competencyKeys: ["problem_solving", "organisation", "communication"],
      activities: [
        {
          type: "VIDEO",
          candidatePrompt: i18n(
            "Bir üründe kayıt akışının ikinci adımında kullanıcıların yarısı düşüyor. İlk haftanızda ne yapardınız?",
            "In a product, half of the users drop off at the second step of the signup flow. What would you do in your first week?",
          ),
          candidateNote: i18n(
            "Elinizde henüz veri yok, ekibe sorabilirsiniz. En fazla 3 dakika.",
            "You have no data yet, you may ask the team. Three minutes at most.",
          ),
          internalQuestion: "Tasarlamadan önce teşhis koyuyor mu?",
          internalObjective: "Eksik bilgiyle problem çerçeveleme.",
          expectedBehaviours: [
            "Tek adımda yapılan iki işi birbirinden ayırıyor",
            "Ölçülebilir bir hipotez kuruyor",
            "Kendi önerisinin riskini kendisi söylüyor",
          ],
          redFlags: [
            "Hemen ekranı yeniden tasarlamaya başlıyor",
            "Düşüşü bir metin sorunu sanıyor",
          ],
          thinkSeconds: 60,
          answerSeconds: 180,
          maxTakes: 1,
        },
        {
          type: "LONG_TEXT",
          candidatePrompt: i18n(
            "Az önce anlattığınız yaklaşımın işe yaradığını nasıl ölçerdiniz? Ölçüm planınızı yazın.",
            "How would you measure whether the approach you just described worked? Write your measurement plan.",
          ),
          internalQuestion: "Ölçüm planı yanlışlanabilecek kadar somut mu?",
          internalObjective: "Ölçüm disiplini. Bu kez yazılı, kurguyu görebilelim diye.",
          expectedBehaviours: [
            "Bir ana metrik ve bir koruma metriği belirliyor",
            "Karar kuralını baştan koyuyor",
          ],
          redFlags: ["Sadece gösteriş metrikleri", "Zaman aralığı yok"],
          thinkSeconds: 0,
          answerSeconds: 420,
          config: { minChars: 200, maxChars: 2000 },
        },
      ],
    },
    {
      name: i18n("Kapanış", "Closing"),
      description: i18n(
        "Son bölüm. Bize sormak istediklerinizi de burada bırakabilirsiniz.",
        "The last part. You can also leave your own questions here.",
      ),
      internalPurpose: "İnisiyatif ve sahiplenme sinyali, bir de neyi sormayı seçtiği.",
      durationSeconds: 420,
      competencyKeys: ["initiative", "customer"],
      activities: [
        {
          type: "VIDEO",
          candidatePrompt: i18n(
            "Kimsenin sizden istemediği halde başlattığınız bir işi ve sonucunu anlatın.",
            "Describe something you started that nobody asked you to, and how it ended.",
          ),
          internalQuestion: "Gerçek inisiyatif mi, yoksa başkasının verdiği bir iş mi?",
          internalObjective: "Talimat yokken sahiplenme.",
          expectedBehaviours: [
            "Sonucu, olumsuz olsa bile söylüyor",
            "Neden yapmaya değer bulduğunu açıklıyor",
          ],
          redFlags: ["Anlattığı iş aslında kendisine verilmiş", "Hiçbir sonuç yok"],
          thinkSeconds: 45,
          answerSeconds: 180,
          maxTakes: 2,
        },
      ],
    },
  ],
};

const ANALYST: TemplateSeed = {
  positionName: "Veri Analisti",
  shortDescription: "Soruyu veriye çeviren, bulgusunu karar diline aktaran analist.",
  jobDescription:
    "Ürün ve operasyon ekiplerinin sorularını analiz edilebilir hale getiren, SQL ile kendi verisini çeken " +
    "ve bulgusunu karar verecek kişinin diline çevirebilen bir analist arıyoruz.",
  requiredSkills: ["SQL", "İstatistik temelleri", "Veri görselleştirme"],
  preferredSkills: ["Python", "dbt", "A/B test tasarımı"],
  templateName: "Veri analisti standart değerlendirme",
  introTitle: i18n("Veri Analisti değerlendirmesi", "Data Analyst assessment"),
  introBody: i18n(
    "Üç aşama, toplam yaklaşık 25 dakika. İlk ve son aşamada kamera gerekiyor.",
    "Three stages, about 25 minutes in total. Camera is needed in the first and last stage.",
  ),
  stages: [
    {
      name: i18n("Tanışma", "Introduction"),
      description: i18n(
        "Kısa bir tanışma bölümü.",
        "A short introduction.",
      ),
      internalPurpose: "Isınma ve iletişim taban ölçümü.",
      durationSeconds: 300,
      competencyKeys: ["communication"],
      activities: [
        {
          type: "VIDEO",
          candidatePrompt: i18n(
            "Kendinizi tanıtın ve en çok işe yaradığını düşündüğünüz analizinizi anlatın.",
            "Introduce yourself and describe the analysis you think was most useful.",
          ),
          internalQuestion: "Etkiyi mi anlatıyor, yöntemi mi?",
          thinkSeconds: 30,
          answerSeconds: 120,
          maxTakes: 2,
        },
        {
          type: "SHORT_TEXT",
          candidatePrompt: i18n(
            "En sık kullandığınız üç aracı yazın.",
            "Write the three tools you use most.",
          ),
          thinkSeconds: 0,
          answerSeconds: 60,
          config: { minChars: 5, maxChars: 160 },
        },
      ],
    },
    {
      name: i18n("Veri vakası", "Data case"),
      description: i18n(
        "Bir metrik beklenmedik şekilde düştü. Nasıl ilerlediğinizi görmek istiyoruz.",
        "A metric dropped unexpectedly. We want to see how you proceed.",
      ),
      internalPurpose: "Belirleyici aşama: teşhis disiplini ve sorgu kurma biçimi.",
      durationSeconds: 900,
      competencyKeys: ["problem_solving", "technical", "organisation"],
      activities: [
        {
          type: "LONG_TEXT",
          candidatePrompt: i18n(
            "Haftalık aktif kullanıcı sayısı bir haftada yüzde 12 düştü. İlk 48 saatte hangi adımları atarsınız ve neden?",
            "Weekly active users dropped 12 percent in one week. What do you do in the first 48 hours, and why?",
          ),
          internalQuestion: "Ürüne bakmadan önce veri hattını kontrol ediyor mu?",
          internalObjective: "Davranış teorisi kurmadan önce ölçüm hatasını eliyor.",
          expectedBehaviours: [
            "Önce veri toplamayı kontrol ediyor",
            "Sonuca varmadan önce kırılım alıyor",
            "Hipotezini neyin çürüteceğini söylüyor",
          ],
          redFlags: ["Doğrudan ürün açıklamasına atlıyor", "Hiç kırılım almıyor"],
          thinkSeconds: 0,
          answerSeconds: 600,
          config: { minChars: 300, maxChars: 3000 },
        },
        {
          type: "SINGLE_CHOICE",
          candidatePrompt: i18n(
            "Bir A/B testinde p değeri 0,04 çıktı. Bu tek başına ne anlama gelir?",
            "An A/B test returns a p value of 0.04. On its own, what does that mean?",
          ),
          internalQuestion: "Temel istatistik okuryazarlığı. Otomatik puanlanır, yetkinlik ortalamasına girmez.",
          thinkSeconds: 0,
          answerSeconds: 120,
          config: {
            choices: [
              {
                id: "a",
                label: i18n(
                  "Etkinin gerçek olma olasılığı yüzde 96",
                  "There is a 96 percent chance the effect is real",
                ),
              },
              {
                id: "b",
                label: i18n(
                  "Sıfır hipotezi doğruyken bu kadar uç bir sonuç görme olasılığı yüzde 4",
                  "If the null hypothesis were true, seeing a result this extreme has 4 percent probability",
                ),
                correct: true,
              },
              {
                id: "c",
                label: i18n("Varyant yüzde 4 daha iyi", "The variant is 4 percent better"),
              },
              {
                id: "d",
                label: i18n("Test yeterli örneklem büyüklüğüne ulaştı", "The test reached sufficient sample size"),
              },
            ],
          },
        },
      ],
    },
    {
      name: i18n("Kapanış", "Closing"),
      description: i18n("Son bölüm.", "The last part."),
      internalPurpose: "Teknik olmayan bir dinleyiciye anlatım, bir de inisiyatif.",
      durationSeconds: 420,
      competencyKeys: ["initiative", "customer"],
      activities: [
        {
          type: "VIDEO",
          candidatePrompt: i18n(
            "Teknik olmayan bir yöneticiye, bulduğunuz bir sonucu nasıl anlattığınızı örnekle anlatın.",
            "Give an example of how you explained a finding to a non-technical manager.",
          ),
          internalQuestion: "Bulguyu karara çevirebiliyor mu?",
          expectedBehaviours: ["Yöntemle değil kararla başlıyor", "Belirsizliği dürüstçe söylüyor"],
          redFlags: ["Bulgu yerine sorguyu anlatıyor"],
          thinkSeconds: 45,
          answerSeconds: 180,
          maxTakes: 2,
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

type BuiltTemplate = {
  positionId: string;
  templateId: string;
  versionId: string;
  weightSetId: string;
  stageIds: string[];
  /** stage index -> activity ids in order */
  activityIds: string[][];
  /** stage index -> activity types, parallel to activityIds */
  activityTypes: Array<Array<(typeof s.activityType.enumValues)[number]>>;
  /** stage index -> competency ids measured there */
  stageCompetencyIds: string[][];
};

async function main() {
  console.log("Resetting tables...");
  await reset();

  /* ---- organisation and owner ---- */
  const orgId = randomUUID();
  await db.insert(s.organizations).values({
    id: orgId,
    name: "Kademe",
    mediaRetentionDays: 180,
    candidateRetentionDays: 730,
  });

  const ownerId = randomUUID();
  await db.insert(s.users).values({
    id: ownerId,
    orgId,
    email: OWNER_EMAIL,
    name: "Deniz Arslan",
    passwordHash: await argon2Hash(DEV_PASSWORD),
    role: "OWNER",
    lastLoginAt: at(-2 * HOUR),
  });

  /* ---- rating scale ---- */
  const scaleId = randomUUID();
  await db.insert(s.ratingScales).values({
    id: scaleId,
    orgId,
    name: "Standart 1-5",
    minValue: 1,
    maxValue: 5,
  });
  await db.insert(s.scaleLevels).values(
    SCALE_LEVELS.map((level) => ({
      id: randomUUID(),
      scaleId,
      value: level.value,
      label: level.label,
      anchor: level.anchor,
    })),
  );

  /* ---- competencies and their observation chips ---- */
  const competencyIdByKey = new Map<string, string>();
  const optionIdByLabel = new Map<string, string>();

  for (const competency of COMPETENCIES) {
    const id = randomUUID();
    competencyIdByKey.set(competency.key, id);
    await db.insert(s.competencies).values({
      id,
      orgId,
      name: competency.name,
      description: competency.description,
      scaleId,
    });

    const options = [
      ...competency.positive.map((label, index) => ({
        id: randomUUID(),
        competencyId: id,
        polarity: "POSITIVE" as const,
        label,
        orderIndex: index,
      })),
      ...competency.negative.map((label, index) => ({
        id: randomUUID(),
        competencyId: id,
        polarity: "NEGATIVE" as const,
        label,
        orderIndex: competency.positive.length + index,
      })),
    ];
    await db.insert(s.evaluationOptions).values(options);
    for (const option of options) {
      optionIdByLabel.set(`${competency.key}:${option.label.tr}`, option.id);
    }
  }

  /* ---- consent text ---- */
  const consentTextId = randomUUID();
  await db.insert(s.consentTexts).values({
    id: consentTextId,
    orgId,
    version: 1,
    body: CONSENT_BODY,
  });

  /* ---- positions, templates, published versions ---- */
  async function buildTemplate(seed: TemplateSeed): Promise<BuiltTemplate> {
    const positionId = randomUUID();
    await db.insert(s.positions).values({
      id: positionId,
      orgId,
      name: seed.positionName,
      shortDescription: seed.shortDescription,
      jobDescription: seed.jobDescription,
      requiredSkills: seed.requiredSkills,
      preferredSkills: seed.preferredSkills,
      languages: ["tr", "en"],
      createdAt: at(-21 * DAY),
    });

    const templateId = randomUUID();
    await db.insert(s.templates).values({
      id: templateId,
      orgId,
      positionId,
      name: seed.templateName,
      createdAt: at(-21 * DAY),
    });

    // DRAFT first. The immutability trigger rejects any stage or activity write
    // once this row says PUBLISHED, so the flip happens at the end of this
    // function and not a line earlier.
    const versionId = randomUUID();
    await db.insert(s.templateVersions).values({
      id: versionId,
      orgId,
      templateId,
      versionNumber: 1,
      status: "DRAFT",
      defaultLocale: "tr",
      localeSet: ["tr", "en"],
      introTitle: seed.introTitle,
      introBody: seed.introBody,
      consentTextId,
      createdAt: at(-21 * DAY),
    });

    const stageIds: string[] = [];
    const activityIds: string[][] = [];
    const activityTypes: Array<Array<(typeof s.activityType.enumValues)[number]>> = [];
    const stageCompetencyIds: string[][] = [];

    for (const [stageIndex, stage] of seed.stages.entries()) {
      const stageId = randomUUID();
      stageIds.push(stageId);
      await db.insert(s.stages).values({
        id: stageId,
        versionId,
        orderIndex: stageIndex,
        name: stage.name,
        description: stage.description,
        internalPurpose: stage.internalPurpose,
        durationSeconds: stage.durationSeconds,
        graceSeconds: 60,
        onTimeout: "AUTO_SUBMIT",
        backNavigation: false,
        allowedAttempts: 1,
      });

      const ids: string[] = [];
      for (const [activityIndex, activity] of stage.activities.entries()) {
        const activityId = randomUUID();
        ids.push(activityId);
        await db.insert(s.activities).values({
          id: activityId,
          stageId,
          orderIndex: activityIndex,
          type: activity.type,
          isRequired: true,
          candidatePrompt: activity.candidatePrompt,
          candidateNote: activity.candidateNote ?? null,
          internalQuestion: activity.internalQuestion ?? null,
          internalObjective: activity.internalObjective ?? null,
          expectedBehaviours: activity.expectedBehaviours ?? [],
          redFlags: activity.redFlags ?? [],
          thinkSeconds: activity.thinkSeconds,
          answerSeconds: activity.answerSeconds ?? null,
          maxTakes: activity.maxTakes ?? 1,
          config: activity.config ?? {},
        });
      }
      activityIds.push(ids);
      activityTypes.push(stage.activities.map((activity) => activity.type));

      const competencyIds = stage.competencyKeys.map((key) => {
        const id = competencyIdByKey.get(key);
        if (!id) throw new Error(`Unknown competency key: ${key}`);
        return id;
      });
      stageCompetencyIds.push(competencyIds);
      await db.insert(s.stageCompetencies).values(
        competencyIds.map((competencyId, index) => ({
          stageId,
          competencyId,
          orderIndex: index,
        })),
      );
    }

    // Weights are snapshotted per version but stay inactive: a plain average is
    // the default, weighting is opt-in.
    const weightSetId = randomUUID();
    await db.insert(s.weightSets).values({
      id: weightSetId,
      versionId,
      label: "default",
      isActive: 0,
    });
    const usedCompetencies = [...new Set(stageCompetencyIds.flat())];
    const share = (100 / usedCompetencies.length).toFixed(2);
    await db.insert(s.weights).values(
      usedCompetencies.map((competencyId) => ({
        weightSetId,
        competencyId,
        percentage: share,
      })),
    );

    // Last step: freeze it.
    await db
      .update(s.templateVersions)
      .set({
        status: "PUBLISHED",
        publishedAt: at(-20 * DAY),
        publishedBy: ownerId,
      })
      .where(eq(s.templateVersions.id, versionId));

    return {
      positionId,
      templateId,
      versionId,
      weightSetId,
      stageIds,
      activityIds,
      activityTypes,
      stageCompetencyIds,
    };
  }

  console.log("Building templates...");
  const designer = await buildTemplate(DESIGNER);
  const analyst = await buildTemplate(ANALYST);

  // A third position with no published template, so the dashboard has a draft
  // row and the empty-template path is visible in development.
  await db.insert(s.positions).values({
    id: randomUUID(),
    orgId,
    name: "Müşteri Başarı Uzmanı",
    shortDescription: "Henüz şablonu hazırlanmadı.",
    jobDescription: null,
    requiredSkills: [],
    preferredSkills: [],
    languages: ["tr"],
    createdAt: at(-3 * DAY),
  });

  /* ---- demo candidates ---- */
  console.log("Building candidates...");
  const storage = getStorage();
  const clip = makePlaceholderClip();
  if (!clip) {
    console.warn(
      "  ffmpeg not found: media rows will be written as UPLOADING with no object, " +
        "so nothing claims to be playable when it is not.",
    );
  }
  const printedLinks: Array<{ name: string; url: string }> = [];

  type CandidateSeed = {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    template: BuiltTemplate;
    invitedAgo: number;
    linkStatus: (typeof s.linkStatus.enumValues)[number];
    expiresIn: number;
    /** How many stages the candidate actually finished. */
    completedStages: number;
    /** Set when the last touched stage ran out of time instead of finishing. */
    lastStageExpired?: boolean;
    inProgress?: boolean;
    /** Scores per stage index, keyed by competency key. Absent stage = not scored. */
    scores?: Array<Record<string, number> | null>;
    chips?: Record<string, string[]>;
    evaluationSubmitted?: boolean;
    decision?: (typeof s.decisionStatus.enumValues)[number];
    decisionNote?: string;
    /** Mert has a second attempt after a dropped connection, as in the canvas. */
    hasBrokenFirstAttempt?: boolean;
  };

  const candidateSeeds: CandidateSeed[] = [
    {
      fullName: "Mert Toprak",
      email: "mert@ornek.com",
      phone: "+90 532 000 00 01",
      location: "İstanbul",
      template: designer,
      invitedAgo: 5 * DAY,
      linkStatus: "COMPLETED",
      expiresIn: 9 * DAY,
      completedStages: 3,
      hasBrokenFirstAttempt: true,
      // Half scored: stage 1 and 2 done, stage 3 untouched. Canvas Y1 calls
      // this "Yarım puanlandı".
      scores: [
        { communication: 4, teamwork: 5 },
        { problem_solving: 5, organisation: 4, communication: 4 },
        null,
      ],
      chips: {
        problem_solving: ["Sorunu yeniden tanımladı", "Riski kendi söyledi"],
        communication: ["Net ve yapılandırılmış anlattı"],
      },
      evaluationSubmitted: false,
    },
    {
      fullName: "Elif Kaya",
      email: "elif@ornek.com",
      phone: "+90 532 000 00 02",
      location: "Ankara",
      template: designer,
      invitedAgo: 4 * DAY,
      linkStatus: "COMPLETED",
      expiresIn: 10 * DAY,
      completedStages: 2,
      lastStageExpired: true,
    },
    {
      fullName: "Selin Bilgin",
      email: "selin@ornek.com",
      phone: "+90 532 000 00 03",
      location: "İzmir",
      template: analyst,
      invitedAgo: 3 * DAY,
      linkStatus: "COMPLETED",
      expiresIn: 11 * DAY,
      completedStages: 3,
      scores: [
        { communication: 3 },
        { problem_solving: 3, technical: 4, organisation: 4 },
        { initiative: 3, customer: 4 },
      ],
      chips: {
        technical: ["Ödünleşimi adıyla anlattı"],
        customer: ["Geri bildirimi karara dönüştürdü"],
      },
      evaluationSubmitted: true,
      decision: "SHORTLISTED",
      decisionNote: "Ölçüm tarafı sağlam. Sonraki turda ürün ekibiyle vaka konuşulsun.",
    },
    {
      fullName: "Can Özdemir",
      email: "can@ornek.com",
      phone: "+90 532 000 00 04",
      location: "Bursa",
      template: analyst,
      invitedAgo: 3 * DAY,
      linkStatus: "COMPLETED",
      expiresIn: 11 * DAY,
      completedStages: 3,
      scores: [
        { communication: 3 },
        { problem_solving: 2, technical: 3, organisation: 3 },
        { initiative: 3, customer: 3 },
      ],
      chips: {
        problem_solving: ["Tek çözüme erken kilitlendi", "Nedeni belirtiyle karıştırdı"],
      },
      evaluationSubmitted: true,
      decision: "REJECTED",
      decisionNote: "Teşhis adımı zayıf kaldı. Bu turda devam etmiyoruz, ileride tekrar bakılabilir.",
    },
    {
      fullName: "Zeynep Aydın",
      email: "zeynep@ornek.com",
      phone: "+90 532 000 00 05",
      location: "İstanbul",
      template: designer,
      invitedAgo: 1 * DAY,
      linkStatus: "IN_PROGRESS",
      expiresIn: 13 * DAY,
      completedStages: 1,
      inProgress: true,
    },
    {
      fullName: "Ayşe Demir",
      email: "ayse@ornek.com",
      phone: "+90 532 000 00 06",
      location: "Antalya",
      template: analyst,
      invitedAgo: 13 * DAY,
      linkStatus: "NOT_STARTED",
      expiresIn: 7 * HOUR,
      completedStages: 0,
    },
    {
      fullName: "Burak Şen",
      email: "burak@ornek.com",
      phone: "+90 532 000 00 07",
      location: "İstanbul",
      template: designer,
      invitedAgo: 13 * DAY,
      linkStatus: "NOT_STARTED",
      expiresIn: 19 * HOUR,
      completedStages: 0,
    },
  ];

  const TRANSCRIPT_LINES = [
    { startMs: 42_000, text: "Yani ilk hafta hiçbir şey tasarlamazdım. Önce düşüşün gerçekten ikinci adımda mı olduğunu görmek isterdim." },
    { startMs: 67_000, text: "Çünkü ikinci adımda iki farklı şey oluyor: hesap doğrulama ve takım davet etme. İkisi tek ekranda. Önce bunları ayırıp hangisinin düşürdüğünü ölçerdim." },
    { startMs: 91_000, text: "Hipotezim davet adımının erken gelmesi. Bunu ölçmek için tek metrik yeterli değil, hem adım tamamlama hem yedi günlük dönüş oranına bakardım." },
    { startMs: 124_000, text: "Riski şu: davet adımını sona atarsam takım kurulumu hiç olmayabilir. O yüzden bunu kalıcı değişiklik değil, iki haftalık test olarak kurardım." },
  ];

  const WRITTEN_ANSWER =
    "Adım tamamlama oranını iki gruba ayırıp, davet adımını sona alan grupta yedi günlük dönüş oranını izlerdim. " +
    "Karar kriterim şu olurdu: adım tamamlama en az beş puan artmalı ve yedi günlük dönüş oranı düşmemeli. " +
    "İki hafta sonunda bu iki koşul birlikte sağlanmıyorsa değişikliği geri alırım. Koruma metriği olarak takım " +
    "kurulmuş hesap oranını izlerim, çünkü asıl risk orada.";

  for (const seed of candidateSeeds) {
    const candidateId = randomUUID();
    await db.insert(s.candidates).values({
      id: candidateId,
      orgId,
      fullName: seed.fullName,
      email: seed.email,
      phone: seed.phone,
      location: seed.location,
      lastContactAt: at(-seed.invitedAgo),
      createdAt: at(-seed.invitedAgo),
    });

    const assessmentId = randomUUID();
    await db.insert(s.assessments).values({
      id: assessmentId,
      orgId,
      candidateId,
      versionId: seed.template.versionId,
      locale: "tr",
      invitedBy: ownerId,
      createdAt: at(-seed.invitedAgo),
    });

    // The raw token exists only in the URL. We print it once so a developer can
    // actually open the candidate side.
    const rawToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    await db.insert(s.assessmentLinks).values({
      id: randomUUID(),
      assessmentId,
      tokenHash: sha256(rawToken),
      status: seed.linkStatus,
      expiresAt: at(seed.expiresIn),
      attemptsAllowed: 1,
      firstSeenIp: seed.linkStatus === "NOT_STARTED" ? null : "89.19.0.1",
      firstSeenUserAgent:
        seed.linkStatus === "NOT_STARTED"
          ? null
          : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0",
      createdAt: at(-seed.invitedAgo),
    });
    printedLinks.push({ name: seed.fullName, url: `/a/${rawToken}` });

    await db.insert(s.messageOutbox).values({
      id: randomUUID(),
      orgId,
      kind: "INVITE",
      toEmail: seed.email,
      subject: `Değerlendirme daveti`,
      body: `Merhaba ${seed.fullName}, değerlendirme bağlantınız: /a/${rawToken}`,
      sentAt: at(-seed.invitedAgo),
      createdAt: at(-seed.invitedAgo),
    });

    if (seed.linkStatus === "NOT_STARTED") continue;

    await db.insert(s.consents).values({
      id: randomUUID(),
      assessmentId,
      consentTextId,
      locale: "tr",
      acceptedAt: at(-seed.invitedAgo + HOUR),
      ip: "89.19.0.1",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0",
    });

    // Mert's first attempt dropped mid-recording; it is kept, not deleted, and
    // is not the primary one.
    if (seed.hasBrokenFirstAttempt) {
      const brokenAttemptId = randomUUID();
      await db.insert(s.attempts).values({
        id: brokenAttemptId,
        assessmentId,
        attemptNumber: 1,
        scope: "FULL",
        isPrimary: false,
        createdReason: "bağlantı koptu",
        startedAt: at(-seed.invitedAgo + 2 * HOUR),
        createdAt: at(-seed.invitedAgo + 2 * HOUR),
      });
      const brokenRunId = randomUUID();
      await db.insert(s.stageRuns).values({
        id: brokenRunId,
        attemptId: brokenAttemptId,
        stageId: seed.template.stageIds[0],
        startedAt: at(-seed.invitedAgo + 2 * HOUR),
        deadlineAt: at(-seed.invitedAgo + 2 * HOUR + 5 * MINUTE),
        lastHeartbeatAt: at(-seed.invitedAgo + 2 * HOUR + 3 * MINUTE),
        completion: "PARTIAL",
      });
      await db.insert(s.technicalEvents).values([
        { id: randomUUID(), stageRunId: brokenRunId, type: "OFFLINE", at: at(-seed.invitedAgo + 2 * HOUR + 3 * MINUTE), meta: { seconds: 21 } },
        { id: randomUUID(), stageRunId: brokenRunId, type: "PAGE_UNLOAD", at: at(-seed.invitedAgo + 2 * HOUR + 4 * MINUTE), meta: null },
      ]);
    }

    const attemptNumber = seed.hasBrokenFirstAttempt ? 2 : 1;
    const attemptId = randomUUID();
    const attemptStart = at(-seed.invitedAgo + 3 * HOUR);
    await db.insert(s.attempts).values({
      id: attemptId,
      assessmentId,
      attemptNumber,
      scope: "FULL",
      isPrimary: true,
      createdReason: seed.hasBrokenFirstAttempt ? "bağlantı sonrası yeniden başlatıldı" : "ilk deneme",
      startedAt: attemptStart,
      completedAt:
        seed.completedStages === seed.template.stageIds.length && !seed.inProgress
          ? at(-seed.invitedAgo + 4 * HOUR)
          : null,
      createdAt: attemptStart,
    });

    const runIds: string[] = [];
    for (const [stageIndex, stageId] of seed.template.stageIds.entries()) {
      const touched = stageIndex < seed.completedStages;
      const isCurrent = seed.inProgress && stageIndex === seed.completedStages;
      const isExpired = seed.lastStageExpired && stageIndex === seed.completedStages;

      if (!touched && !isCurrent && !isExpired) {
        // Never reached. No stage_run row at all, which is what the candidate
        // API will see as "not started yet".
        runIds.push("");
        continue;
      }

      const runId = randomUUID();
      runIds.push(runId);
      const startedAt = at(-seed.invitedAgo + 3 * HOUR + stageIndex * 20 * MINUTE);
      await db.insert(s.stageRuns).values({
        id: runId,
        attemptId,
        stageId,
        startedAt,
        deadlineAt: new Date(startedAt.getTime() + 15 * MINUTE),
        submittedAt: touched ? new Date(startedAt.getTime() + 12 * MINUTE) : null,
        lastHeartbeatAt: isCurrent ? at(-2 * MINUTE) : new Date(startedAt.getTime() + 12 * MINUTE),
        completion: touched ? "COMPLETE" : isExpired ? "EXPIRED" : "PENDING",
        wasLate: false,
      });

      if (!touched) continue;

      // Responses for the activities in this stage. The payload shape follows
      // the activity type, so the review screen gets what it expects.
      for (const [activityIndex, activityId] of seed.template.activityIds[stageIndex].entries()) {
        const type = seed.template.activityTypes[stageIndex][activityIndex];
        let payload: s.ResponsePayload;

        if (type === "VIDEO" || type === "AUDIO") {
          const mediaId = randomUUID();
          const mime = type === "VIDEO" ? "video/webm" : "audio/webm";
          const key = mediaKey({ orgId, assessmentId, stageRunId: runId, mediaId, mime });

          // Write the object first, then describe it. bytes and status report
          // what is actually on disk, never a plausible looking number.
          let storedBytes: number | null = null;
          if (clip) {
            const upload = await storage.initUpload(key, mime);
            const part = await storage.uploadPart(key, upload.uploadId, 1, clip.bytes);
            const done = await storage.completeUpload(key, upload.uploadId, [part]);
            storedBytes = done.bytes;
          }

          await db.insert(s.mediaAssets).values({
            id: mediaId,
            orgId,
            stageRunId: runId,
            activityId,
            storageKey: key,
            mime,
            durationMs: clip ? clip.durationMs : null,
            bytes: storedBytes,
            checksum: clip ? createHash("sha256").update(clip.bytes).digest("hex") : null,
            status: clip ? "READY" : "UPLOADING",
            createdAt: startedAt,
          });
          // Only the case-study video carries a transcript in the seed; that is
          // the one the review screen renders next to the player.
          if (stageIndex === 1) {
            await db.insert(s.transcripts).values({
              id: randomUUID(),
              mediaAssetId: mediaId,
              language: "tr",
              text: TRANSCRIPT_LINES.map((line) => line.text).join(" "),
              words: TRANSCRIPT_LINES.map((line) => ({
                text: line.text,
                startMs: line.startMs,
                endMs: line.startMs + 20_000,
              })),
              provider: "elevenlabs-scribe",
            });
          }
          payload = { mediaAssetId: mediaId };
        } else if (type === "SINGLE_CHOICE" || type === "MULTI_CHOICE") {
          payload = { choiceIds: [seed.fullName === "Can Özdemir" ? "a" : "b"] };
        } else if (type === "LONG_TEXT") {
          payload = { text: WRITTEN_ANSWER };
        } else {
          payload = { text: "Ölçüm, ürün analitiği ve ekip içi geri bildirim." };
        }

        await db.insert(s.responses).values({
          id: randomUUID(),
          stageRunId: runId,
          activityId,
          payload,
          answeredAt: new Date(startedAt.getTime() + (activityIndex + 1) * 4 * MINUTE),
        });
      }
    }

    if (!seed.scores) continue;

    /* ---- evaluation ---- */
    const evaluationId = randomUUID();
    const items: Array<typeof s.evaluationItems.$inferInsert> = [];
    const allScores: number[] = [];

    for (const [stageIndex, stageScores] of seed.scores.entries()) {
      if (!stageScores) continue;
      for (const [key, score] of Object.entries(stageScores)) {
        const competencyId = competencyIdByKey.get(key);
        if (!competencyId) throw new Error(`Unknown competency key: ${key}`);
        const chipLabels = seed.chips?.[key] ?? [];
        items.push({
          id: randomUUID(),
          evaluationId,
          competencyId,
          stageId: seed.template.stageIds[stageIndex],
          score,
          selectedOptionIds: chipLabels
            .map((label) => optionIdByLabel.get(`${key}:${label}`))
            .filter((id): id is string => Boolean(id)),
          note: null,
        });
        allScores.push(score);
      }
    }

    const overall = allScores.reduce((sum, n) => sum + n, 0) / allScores.length;
    await db.insert(s.evaluations).values({
      id: evaluationId,
      attemptId,
      evaluatorId: ownerId,
      weightSetId: seed.template.weightSetId,
      overallScore: overall.toFixed(2),
      knowledgeScore:
        seed.template === analyst ? (seed.fullName === "Can Özdemir" ? "0.00" : "100.00") : null,
      submittedAt: seed.evaluationSubmitted ? at(-6 * HOUR) : null,
      updatedAt: at(-6 * HOUR),
    });
    await db.insert(s.evaluationItems).values(items);

    await db.insert(s.stageNotes).values({
      id: randomUUID(),
      evaluationId,
      stageRunId: runIds[1],
      body:
        "Davet adımını ayırma fikri iyi. Ölçüm tarafı biraz genel kaldı, ikinci turda A/B kurulumunu sorarız.",
      updatedAt: at(-6 * HOUR),
    });

    if (seed.decision) {
      await db.insert(s.decisions).values([
        {
          id: randomUUID(),
          assessmentId,
          status: "IN_REVIEW",
          note: null,
          decidedBy: ownerId,
          at: at(-8 * HOUR),
        },
        {
          id: randomUUID(),
          assessmentId,
          status: seed.decision,
          note: seed.decisionNote ?? null,
          decidedBy: ownerId,
          at: at(-5 * HOUR),
        },
      ]);
    }
  }

  /* ---- report ---- */
  console.log("\nSeed complete.");
  console.log(`  Manager login : ${OWNER_EMAIL}`);
  console.log(`  Password      : ${DEV_PASSWORD}   (development only)`);
  console.log("\n  Candidate links (raw tokens are shown only here):");
  for (const link of printedLinks) {
    console.log(`    ${link.name.padEnd(16)} ${link.url}`);
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
