/**
 * The ready message a manager pastes into WhatsApp or an e-mail: the exam link,
 * the last day, the device and the length. The wording is fixed Turkish text
 * (it goes to the student, not to the panel's reader), so it does not go
 * through the panel dictionary. The link is filled in on the click only.
 */

export type MessageParts = {
  /** The student's full name; the message greets the first name. */
  name: string;
  school: string;
  link: string;
  /** Already written out, see `formatDeadline`. */
  deadline: string;
  minutes: number;
};

/** "Ayşe Nur Yılmaz" greets "Ayşe"; a name without spaces is used whole. */
export function firstName(fullName: string): string {
  const name = fullName.replace(/\s+/g, " ").trim();
  return name.split(" ")[0] ?? name;
}

/** "14 Ekim 2026", in the school's day. */
export function formatDeadline(date: Date, timeZone = "Europe/Istanbul"): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone }).format(date);
}

export function fillMessage(p: MessageParts): string {
  return `Merhaba ${firstName(p.name)}, ${p.school} için Almanca seviye sınavınız hazır. Sınava bu linkten girebilirsiniz: ${p.link} . Son giriş tarihi: ${p.deadline}. Sınavı bilgisayardan (Chrome veya Edge) yapmanız gerekiyor, yaklaşık ${p.minutes} dakika sürer. Sorunuz olursa bu mesaja yanıt verebilirsiniz.`;
}

/** A row invited within the last day gets "Davet mesajını kopyala", an older one "Hatırlatma mesajı". */
export const FRESH_MS = 24 * 60 * 60 * 1000;
export const isFreshInvite = (invitedAt: Date, now: Date): boolean => now.getTime() - invitedAt.getTime() < FRESH_MS;
