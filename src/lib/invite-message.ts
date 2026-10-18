import type { CandidateLocale } from "@/i18n/locale";
import { ORG_TIMEZONE } from "@/lib/org-timezone";

/**
 * The ready invitation text a school pastes into WhatsApp or an e-mail: one
 * student, one link. Pure, so the invite result screen and the student list's
 * reminders say exactly the same thing. Times are in the school's zone.
 */

export type InviteMessageInput = {
  /** The student's full name as listed; the greeting uses the given name(s). */
  fullName: string;
  /** The school's name. */
  school: string;
  url: string;
  /** The last day to start. */
  expiresAt: Date;
  /** Set when the exam opens later than the invitation is sent. */
  notBefore?: Date | null;
  /** The exam's approximate length. */
  minutes: number;
  locale: CandidateLocale;
  timeZone?: string;
};

/** Arabic keeps Latin digits (-nu-latn), the same as the exam screens. */
const TAG: Record<CandidateLocale, string> = {
  tr: "tr-TR",
  en: "en-GB",
  de: "de-DE",
  es: "es-ES",
  ar: "ar-u-nu-latn",
};

/** "14 Ekim 2026 09:30" / "14 October 2026 09:30", in the zone. */
export function messageDateTime(at: Date, locale: CandidateLocale, timeZone: string = ORG_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat(TAG[locale], {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const p = (type: Intl.DateTimeFormatPartTypes) => parts.find((x) => x.type === type)?.value ?? "";
  return `${p("day")} ${p("month")} ${p("year")} ${p("hour")}:${p("minute")}`;
}

/**
 * The Turkish locative suffix after a clock time ("09:30'da", "14:45'te"):
 * it follows the last spoken word (otuz, kırk beş, sıfır), which the last
 * digits of the minutes decide.
 */
export function turkishTimeSuffix(minutes: number): "da" | "de" | "ta" | "te" {
  const m = ((Math.trunc(minutes) % 60) + 60) % 60;
  const unit = m % 10;
  if (unit === 0) return ({ 0: "da", 1: "da", 2: "de", 3: "da", 4: "ta", 5: "de" } as const)[(m / 10) as 0 | 1 | 2 | 3 | 4 | 5];
  // bir iki üç dört beş altı yedi sekiz dokuz
  return (["", "de", "de", "te", "te", "te", "da", "de", "de", "da"] as const)[unit] as "da" | "de" | "te";
}

/** "14 Ekim 2026 09:30'da" in Turkish; the plain date and time in every other language. */
export function openingMoment(at: Date, locale: CandidateLocale, timeZone: string = ORG_TIMEZONE): string {
  const text = messageDateTime(at, locale, timeZone);
  if (locale !== "tr") return text;
  const minutes = Number(text.slice(-2));
  return `${text}'${turkishTimeSuffix(minutes)}`;
}

/** The given name(s): everything but the last word of a full name, or the one word there is. */
export function givenName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? words.slice(0, -1).join(" ") : (words[0] ?? "");
}

export function inviteMessage(input: InviteMessageInput): string {
  const tz = input.timeZone ?? ORG_TIMEZONE;
  const name = givenName(input.fullName);
  const deadline = messageDateTime(input.expiresAt, input.locale, tz);
  const opensAt = input.notBefore ? openingMoment(input.notBefore, input.locale, tz) : "";
  const { school, url, minutes } = input;
  switch (input.locale) {
    case "en": {
      const opens = opensAt ? ` The exam opens on ${opensAt}.` : "";
      return `Hello${name ? ` ${name}` : ""}, your German level exam for ${school} is ready. You can enter the exam with this link: ${url} .${opens} Last entry: ${deadline}. You need to take the exam on a computer (Chrome or Edge); it takes about ${minutes} minutes. If you have any questions, you can reply to this message.`;
    }
    case "de": {
      const opens = opensAt ? ` Die Prüfung öffnet am ${opensAt}.` : "";
      return `Hallo${name ? ` ${name}` : ""}, Ihr Deutsch-Einstufungstest für ${school} ist bereit. Sie können die Prüfung über diesen Link starten: ${url} .${opens} Letzter Einstieg: ${deadline}. Sie müssen die Prüfung an einem Computer (Chrome oder Edge) ablegen; sie dauert etwa ${minutes} Minuten. Bei Fragen können Sie auf diese Nachricht antworten.`;
    }
    case "es": {
      const opens = opensAt ? ` El examen se abre el ${opensAt}.` : "";
      return `Hola${name ? ` ${name}` : ""}, su examen de nivel de alemán para ${school} está listo. Puede entrar al examen con este enlace: ${url} .${opens} Último acceso: ${deadline}. Debe hacer el examen en un ordenador (Chrome o Edge); dura unos ${minutes} minutos. Si tiene alguna pregunta, puede responder a este mensaje.`;
    }
    case "ar": {
      const opens = opensAt ? ` يفتح الامتحان في ${opensAt}.` : "";
      return `مرحباً${name ? ` ${name}` : ""}، امتحان تحديد مستوى اللغة الألمانية الخاص بك لدى ${school} جاهز. يمكنك دخول الامتحان عبر هذا الرابط: ${url} .${opens} آخر موعد للدخول: ${deadline}. يجب أداء الامتحان على جهاز كمبيوتر (Chrome أو Edge)، ويستغرق حوالي ${minutes} دقيقة. إذا كانت لديك أي أسئلة، يمكنك الرد على هذه الرسالة.`;
    }
    case "tr": {
      const opens = opensAt ? ` Sınav ${opensAt} açılacak.` : "";
      return `Merhaba${name ? ` ${name}` : ""}, ${school} için Almanca seviye sınavınız hazır. Sınava bu linkten girebilirsiniz: ${url} .${opens} Son giriş tarihi: ${deadline}. Sınavı bilgisayardan (Chrome veya Edge) yapmanız gerekiyor, yaklaşık ${minutes} dakika sürer. Sorunuz olursa bu mesaja yanıt verebilirsiniz.`;
    }
  }
}

/** Every student's text, one after the other, a rule between them. */
export function inviteMessages(list: readonly InviteMessageInput[]): string {
  return list.map(inviteMessage).join("\n\n----------\n\n");
}
