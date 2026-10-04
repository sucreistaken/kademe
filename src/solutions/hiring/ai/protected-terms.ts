/**
 * The word rule behind the question check's PROTECTED findings (HIRING-UX
 * 3.9). The grounds are those Turkish law forbids discriminating on in
 * employment: Law 6701 (Türkiye İnsan Hakları ve Eşitlik Kurumu Kanunu) art. 3
 * and Labour Law 4857 art. 5, plus sexual orientation and union membership,
 * which international hiring guidance treats the same way. It is a hint, not a
 * legal opinion: the screen says "may touch" and the person decides.
 *
 * Military service (askerlik) is deliberately absent: in Turkey it may be asked
 * when the job needs it (start date, travel), so flagging it every time would
 * be noise; the AI part may still note a question that asks it without reason.
 *
 * How a pattern matches:
 * - Text and patterns go through the same pipeline: NFC, curly apostrophes
 *   folded, lowercased in the field's language (Turkish İ/I come out right),
 *   then an ASCII skeleton (ç ğ ı ö ş ü â î û become c g i o s u a i u), so a
 *   question typed without Turkish letters ("Cocugun var mi") still matches.
 * - A pattern is one or more words. A word ending in `*` matches any word that
 *   starts with it (only for stems that are not the start of everyday job
 *   words); any other word must match exactly. Short or ambiguous stems are
 *   listed with their allowed endings ("yaş" only as "yaşın", "yaşınız", ...)
 *   or inside a phrase ("eşin ne", "engelin var"), which keeps "eş zamanlı",
 *   "yaş grubu", "engelleri aştın" and "office politics" out.
 * - Both languages' lists run on both fields: people paste English into the
 *   Turkish field and the other way round.
 */
export const PROTECTED_CATEGORIES = [
  "AGE",
  "GENDER",
  "FAMILY",
  "PREGNANCY",
  "HEALTH",
  "RELIGION",
  "ORIGIN",
  "POLITICS",
  "UNION",
  "ORIENTATION",
] as const;
export type ProtectedCategory = (typeof PROTECTED_CATEGORIES)[number];

/** `stem` followed by each ending, as exact words. */
const endings = (stem: string, list: string[]) => list.map((e) => `${stem}${e}`);

const TERMS: Record<ProtectedCategory, string[]> = {
  AGE: [
    ...endings("yaş", ["ın", "ınız", "ını", "ınızı", "ındasın", "ındasınız"]),
    "yaşında mısın*",
    "kaç yaş*",
    "doğum yıl*",
    "doğum tarih*",
    "emekli olma*",
    "how old",
    "your age",
    "date of birth",
    "year of birth",
    "birth year",
    "birthdate*",
    "what year were you born",
    "plan to retire*",
    "when will you retire",
    "retirement plan*",
  ],
  GENDER: [
    "cinsiyet*",
    "kadın mısın*",
    "kadın mısınız",
    "erkek misin*",
    "erkek misiniz",
    "kadın mı erkek*",
    "gender*",
    "your sex",
    "male or female",
    "female or male",
    "transgender*",
  ],
  FAMILY: [
    ...endings("evli", ["", "misin", "misiniz", "mi", "sin", "siniz", "yim"]),
    "evlenme*",
    "medeni hal*",
    "medeni durum*",
    ...endings("bekar", ["", "mısın", "mısınız", "mı", "sın", "sınız"]),
    "nişanlı*",
    "boşan*",
    ...endings("dul", ["", "musun", "musunuz"]),
    "eşin ne*",
    "eşiniz ne*",
    "eşin var*",
    "eşiniz var*",
    "eşinin*",
    "sevgilin*",
    "çocuğun var*",
    "çocuğunuz var*",
    "çocukların var*",
    "çocuklarınız var*",
    "çocuk sahibi*",
    "kaç çocuğ*",
    "çocuk yap*",
    "aile planı*",
    "aile kurma*",
    "married",
    "marital*",
    "are you single",
    "spouse*",
    "husband*",
    "wife",
    "fiance*",
    "girlfriend*",
    "boyfriend*",
    "divorc*",
    "maiden name",
    "do you have kids",
    "do you have children",
    "have any kids",
    "have any children",
    "how many kids",
    "how many children",
    // Only family phrases: "plan to have the release ready" is a job question.
    "plan to have kid*",
    "plan to have child*",
    "plan to have a baby",
    "plan to have babies",
    "plan to have a family",
    "start a family",
    "childcare arrangement*",
  ],
  PREGNANCY: [
    "hamile*",
    "gebe",
    "gebelik*",
    "doğum izn*",
    "doğum yapma*",
    "bebek bekl*",
    "pregnan*",
    "maternity*",
    "expecting a baby",
  ],
  HEALTH: [
    "sağlık sorun*",
    "sağlık durum*",
    "sağlık problem*",
    "sağlık geçmiş*",
    "kronik hastal*",
    "kronik rahatsız*",
    "hastalığın var*",
    "hastalığınız var*",
    "hastalık geçmiş*",
    "ilaç kullan*",
    "engelli*",
    "engel durum*",
    "engel oran*",
    "engelin var*",
    "engeliniz var*",
    "psikolojik tedavi*",
    "disabilit*",
    "are you disabled",
    "handicap*",
    "health condition*",
    "health issue*",
    "health problem*",
    "medical condition*",
    "medical history",
    "chronic illness*",
    "chronic condition*",
    "chronic disease*",
    "illness*",
    "any medication*",
    "take medication*",
  ],
  RELIGION: [
    ...endings("din", ["", "in", "iniz", "i", "ini", "inizi", "e", "ine", "den", "inden", "dar", "darsın", "dar mısın"]),
    "dindar mısın*",
    "mezhep*",
    "mezheb*",
    "inancın ne*",
    "inancınız ne*",
    "dini inanç*",
    ...endings("alevi", ["", "misin", "misiniz", "sin", "siniz"]),
    ...endings("sünni", ["", "misin", "misiniz", "sin", "siniz"]),
    "hristiyan*",
    "hıristiyan*",
    "müslüman*",
    "yahudi*",
    "ateist*",
    "namaz kıl*",
    "oruç tut*",
    "ibadet*",
    "cemevi*",
    "camiye*",
    "kiliseye*",
    "religio*",
    "do you pray",
    "your faith",
    "what faith",
    "which faith",
    "christian*",
    "muslim*",
    "jewish",
    "atheis*",
    "worship*",
  ],
  ORIGIN: [
    ...endings("ırk", ["", "ın", "ınız", "ı", "ını"]),
    "etnik*",
    "kökenin ne*",
    "kökeniniz ne*",
    "aslen nere*",
    "memleket*",
    "nereli*",
    "nerede doğ*",
    "doğum yer*",
    "doğduğun yer*",
    "ana dilin",
    "ana diliniz",
    "anadilin",
    "anadiliniz",
    "ten reng*",
    "kürt müsün*",
    "kürt müsünüz",
    "türk müsün*",
    "türk müsünüz",
    "your race",
    "racial*",
    "ethnic*",
    "skin colo*",
    "where are you from",
    "where were you born",
    "place of birth",
    "birthplace*",
    "country of birth",
    "national origin",
    "native language",
    "mother tongue",
  ],
  POLITICS: [
    "siyasi görüş*",
    "siyasal görüş*",
    "politik görüş*",
    "siyasi eğilim*",
    "siyasal eğilim*",
    "siyasi düşünce*",
    "siyasi parti*",
    "hangi parti*",
    "oy ver*",
    "oy kullan*",
    "partiye üye*",
    "parti üyesi*",
    "siyasetle ilgilen*",
    "political view*",
    "political opinion*",
    "political affiliation*",
    "political part*",
    "political belief*",
    "your politics",
    "vote for",
    "who did you vote*",
    "which party",
    "party member*",
  ],
  UNION: ["sendika*", "union member*", "labor union*", "labour union*", "trade union*", "unioniz*", "join a union"],
  ORIENTATION: [
    "cinsel yönelim*",
    "cinsel tercih*",
    "eşcinsel*",
    "heteroseksüel*",
    "homoseksüel*",
    "biseksüel*",
    "lgbt*",
    "gay",
    "lesbian*",
    "sexual orientation",
    "sexual preference*",
    "homosexual*",
    "heterosexual*",
    "bisexual*",
  ],
};

/** NFC, one apostrophe, lowercased the way the field's language does it. */
export function foldText(text: string, locale: "tr" | "en"): string {
  return text.normalize("NFC").replace(/[‘’ʼ`´]/g, "'").toLocaleLowerCase(locale);
}

/** The ASCII skeleton of an already lowercased word: marks dropped, dotless ı as i. */
const skeleton = (word: string) => word.normalize("NFD").replace(/\p{M}/gu, "").replace(/ı/g, "i");

type Spec = { word: string; prefix: boolean };
const compiled: Array<{ category: ProtectedCategory; specs: Spec[] }> = PROTECTED_CATEGORIES.flatMap((category) =>
  TERMS[category].map((term) => ({
    category,
    specs: term.split(" ").map((w) => ({ word: skeleton(w.replace(/\*$/, "").toLocaleLowerCase("tr")), prefix: w.endsWith("*") })),
  })),
);

type Token = { start: number; end: number; skel: string };

function tokens(original: string, locale: "tr" | "en"): Token[] {
  const out: Token[] = [];
  for (const m of original.matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
    out.push({ start: m.index, end: m.index + m[0].length, skel: skeleton(m[0].toLocaleLowerCase(locale)) });
  }
  return out;
}

export type ProtectedHit = { category: ProtectedCategory; excerpt: string; at: number };
type Span = { category: ProtectedCategory; start: number; end: number };

/** Every protected term in one text, with the words as written and where they start. */
export function protectedHits(text: string, locale: "tr" | "en"): ProtectedHit[] {
  const original = text.normalize("NFC").replace(/[‘’ʼ`´]/g, "'");
  const words = tokens(original, locale);
  const spans: Span[] = [];
  for (const { category, specs } of compiled) {
    for (let i = 0; i + specs.length <= words.length; i++) {
      const match = specs.every((s, j) => (s.prefix ? words[i + j].skel.startsWith(s.word) : words[i + j].skel === s.word));
      if (match) spans.push({ category, start: words[i].start, end: words[i + specs.length - 1].end });
    }
  }
  // "kaç yaşındasın" and "yaşındasın" are one hit: a span inside another of its category goes.
  const kept = spans.filter(
    (s, i) => !spans.some((o, j) => j !== i && o.category === s.category && o.start <= s.start && o.end >= s.end && (o.end - o.start > s.end - s.start || j < i)),
  );
  return kept
    .map((s) => ({ category: s.category, excerpt: original.slice(s.start, s.end), at: s.start }))
    .sort((a, b) => a.at - b.at);
}
