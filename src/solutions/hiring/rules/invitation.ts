import type { Locale } from "@/i18n/locale";

/** Inviting a candidate (HIRING-UX 5.11), pure. */

const EMAIL_RE = /^[^@\s<>",;]+@[^@\s<>",;.]+(\.[^@\s<>",;.]+)+$/;
const MAX_EMAIL_LENGTH = 254;
/** One cap for a person's name, in the pasted list and in the message. */
export const MAX_NAME_LENGTH = 120;
const MAX_ORG_LENGTH = 80;
const MAX_POSITION_LENGTH = 120;

export const isEmail = (value: string): boolean => {
  const v = value.trim();
  return v.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(v);
};
export const MAX_INVITE_ROWS = 50;
/** The overview shows the candidate experience only from this many survey answers (HIRING-UX 5.4: no noisy signal). */
export const SURVEY_MIN_ANSWERS = 5;

/**
 * Text that came from a person (a candidate's name, an organisation, a
 * position) made safe to drop into the plain text message: one line, no
 * angle brackets (so no markup survives if a mail client ever renders the
 * body as HTML), no control, zero width or bidi characters, no scheme:// run
 * (the e-mail carries one link, ours), no em dash, and a cap counted in
 * characters (never through a surrogate pair) so one field cannot swallow the
 * message.
 */
function plainText(value: string, max: number): string {
  const clean = value
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S*/gi, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\u2014/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(clean);
  return chars.length > max ? `${chars.slice(0, max).join("").trimEnd()}...` : clean;
}

/** The link goes in as one token: whitespace or angle brackets would break the line it sits on. */
const plainUrl = (value: string): string => value.replace(/[\s<>]+/g, "");

/**
 * The ready message the manager copies (and the outbox keeps): in the
 * candidate's language, "sen", with the name, the link, the deadline, the
 * expected time and a person to write to. The body is plain text; every
 * inserted value is cleaned by `plainText`.
 */
export function inviteMessage(input: {
  locale: Locale;
  candidateName: string;
  orgName: string;
  positionName: string;
  url: string;
  deadline: string;
  minutes: number;
  contactEmail: string | null;
}): { subject: string; body: string } {
  const name = plainText(input.candidateName, MAX_NAME_LENGTH);
  const org = plainText(input.orgName, MAX_ORG_LENGTH);
  const position = plainText(input.positionName, MAX_POSITION_LENGTH);
  const deadline = plainText(input.deadline, 80);
  const url = plainUrl(input.url);
  if (!url) throw new Error("inviteMessage needs the candidate's link");
  const minutes = Number.isFinite(input.minutes) ? Math.round(input.minutes) : 0;
  const contact = input.contactEmail && isEmail(input.contactEmail) ? plainText(input.contactEmail, MAX_EMAIL_LENGTH) : null;
  if (input.locale === "en") {
    const subject = org && position ? `${org}: ${position} assessment` : org ? `${org}: assessment` : position ? `${position} assessment` : "Assessment";
    const time = minutes >= 1 ? `, in about ${minutes} minutes` : "";
    return {
      subject,
      body: [
        name ? `Hi ${name},` : "Hi,",
        `We prepared a short assessment for your application for ${position || "this role"}${org ? ` at ${org}` : ""}. You can complete it in your own time${time}.`,
        `To start: ${url}`,
        `Deadline: ${deadline}. If you stop halfway, the same link brings you back to where you left off.`,
        ...(contact ? [`If anything goes wrong, write to ${contact}.`] : []),
      ].join("\n\n"),
    };
  }
  const subject = org && position ? `${org}: ${position} değerlendirmesi` : org ? `${org}: değerlendirme` : position ? `${position} değerlendirmesi` : "Değerlendirme";
  const lead = org ? `${org} bünyesindeki ${position || "bu pozisyon"}` : position || "Bu pozisyon";
  const time = minutes >= 1 ? `, yaklaşık ${minutes} dakikada` : "";
  return {
    subject,
    body: [
      name ? `Merhaba ${name},` : "Merhaba,",
      `${lead} başvurun için kısa bir değerlendirme hazırladık. Kendi zamanında${time} tamamlayabilirsin.`,
      `Başlamak için: ${url}`,
      `Son tarih: ${deadline}. Yarıda bırakırsan aynı linkten kaldığın yerden devam edersin.`,
      ...(contact ? [`Bir sorun olursa ${contact} adresine yazabilirsin.`] : []),
    ].join("\n\n"),
  };
}

export type InviteRow = { line: number; fullName: string; email: string; problem: "NAME" | "EMAIL" | "DUPLICATE" | null };

/** Splits one line on comma, semicolon or tab outside double quotes; a quoted cell loses its quotes ("" inside is one quote). */
function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (ch === "," || ch === ";" || ch === "\t")) {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean);
}

const ANGLE_EMAIL_RE = /<\s*([^<>\s,;]*@[^<>\s,;]*)\s*>/;
const LINE_BREAK_RE = /\r\n|[\r\n\u2028\u2029]/;

/**
 * "Birden fazla aday": one candidate per line, a name and an e-mail separated
 * by a comma, semicolon or tab in either order, or "Name <mail>" as a mail
 * client copies it. Quoted CSV cells, a byte order mark and Turkish letters
 * are fine. Blank lines are skipped; a row without a name, with a bad e-mail
 * or repeating an earlier e-mail (any letter case) is marked, never dropped,
 * so the manager sees which line to fix. At most MAX_INVITE_ROWS rows are
 * read; `tooMany` says there were more.
 */
export function parseInviteRows(text: string): { rows: InviteRow[]; tooMany: boolean } {
  const rows: InviteRow[] = [];
  const seen = new Set<string>();
  let tooMany = false;
  const lines = text.replace(/\uFEFF/g, "").split(LINE_BREAK_RE);
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    if (rows.length === MAX_INVITE_ROWS) {
      tooMany = true;
      break;
    }
    let rest = lines[i];
    let email = "";
    const angle = ANGLE_EMAIL_RE.exec(rest);
    if (angle) {
      email = angle[1];
      rest = rest.replace(angle[0], " ");
    }
    const cells = splitCells(rest);
    if (!email) {
      email = cells.find((c) => c.includes("@")) ?? "";
      cells.splice(cells.indexOf(email), email ? 1 : 0);
    }
    email = email.replace(/^mailto:/i, "").trim();
    const fullName = cells.join(" ").replace(/\s+/g, " ").trim();
    const key = email.toLowerCase();
    const nameOk = Array.from(fullName).length >= 2 && Array.from(fullName).length <= MAX_NAME_LENGTH && !/[<>@]/.test(fullName);
    const problem: InviteRow["problem"] = !isEmail(email) ? "EMAIL" : !nameOk ? "NAME" : seen.has(key) ? "DUPLICATE" : null;
    if (isEmail(email)) seen.add(key);
    rows.push({ line: i + 1, fullName, email, problem });
  }
  return { rows, tooMany };
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The parts of a real YYYY-MM-DD, or null (a day that does not survive the round trip, like 2026-02-30, was never a day). */
function dayParts(day: string): [number, number, number] | null {
  const match = DAY_RE.exec(day);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return [y, m, d];
}

/**
 * A calendar day (YYYY-MM-DD) plus `days`, by the calendar: the arithmetic is
 * on the date itself in UTC, so no zone and no DST change can move it by a
 * day. Pair it with `orgDay` (today) and `zonedDayStart` (the instant) from
 * org-timezone for the organisation's days.
 */
export function addDays(day: string, days: number): string {
  const parts = dayParts(day);
  if (!parts || !Number.isInteger(days)) throw new RangeError(`Not a calendar day: ${day}`);
  const [y, m, d] = parts;
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Decision 16: the chosen day, held inside [today, the opening's deadline],
 * else the opening's deadline while it is ahead, else 14 days from today.
 * `today` is the org's day (`orgDay`). A chosen day in the past becomes today,
 * one past the deadline becomes the deadline; the upper bound exists only
 * while a deadline is ahead (a deadline already behind today is ignored, as
 * in the default). A malformed chosen or deadline day is ignored rather than
 * trusted.
 */
export function linkExpiryDay(input: { chosen: string | null; openingDeadlineDay: string | null; today: string }): string {
  const deadline = input.openingDeadlineDay && dayParts(input.openingDeadlineDay) && input.openingDeadlineDay >= input.today ? input.openingDeadlineDay : null;
  if (input.chosen && dayParts(input.chosen)) {
    const lifted = input.chosen < input.today ? input.today : input.chosen;
    return deadline && lifted > deadline ? deadline : lifted;
  }
  return deadline ?? addDays(input.today, 14);
}

const MONTHS: Record<Locale, readonly string[]> = {
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** A calendar day as the candidate reads it ("14 Eki", "14 Oct"); a day has no zone, so none is applied. */
export function formatInviteDay(day: string, locale: Locale): string {
  const parts = dayParts(day);
  if (!parts) throw new RangeError(`Not a calendar day: ${day}`);
  return `${parts[2]} ${MONTHS[locale][parts[1] - 1]}`;
}

/**
 * The deadline the way the message states it: the end of the org's day with
 * the zone named ("14 Eki 23:59 (Türkiye Standart Saati)", "14 Oct, 23:59
 * (Türkiye Standard Time)"). `zoneName` is `zoneLabel(locale)` from
 * org-timezone, passed in so these rules stay free of environment reads.
 */
export function formatInviteDeadline(day: string, locale: Locale, zoneName: string): string {
  const date = formatInviteDay(day, locale);
  return locale === "en" ? `${date}, 23:59 (${zoneName})` : `${date} 23:59 (${zoneName})`;
}

export type CandidateProgress = "INVITED" | "OPENED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

/**
 * One word for the Candidates tab. Only a NOT_STARTED link past its date is
 * expired (the same rule as candidate-context: anyone already inside, or with
 * a retake open, is not cut off by the link); a started one never is. A link
 * ending exactly now is not yet expired.
 */
export function candidateProgress(input: {
  linkStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "RETAKE_AVAILABLE";
  linkExpiresAt: Date;
  firstSeen: boolean;
  started: boolean;
  completed: boolean;
  now: Date;
}): CandidateProgress {
  if (input.completed) return "COMPLETED";
  if (input.started) return "IN_PROGRESS";
  if (input.linkStatus === "EXPIRED") return "EXPIRED";
  if (input.linkStatus === "NOT_STARTED" && input.linkExpiresAt.getTime() < input.now.getTime()) return "EXPIRED";
  return input.firstSeen ? "OPENED" : "INVITED";
}
