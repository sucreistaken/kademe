import type { Locale } from "@/i18n/locale";

/** Inviting a candidate (HIRING-UX 5.11), pure. */

const EMAIL_RE = /^[^@\s<>",;]+@[^@\s<>",;.]+(\.[^@\s<>",;.]+)+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 120;

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
 * body as HTML), no control characters, no em dash, and a length cap so one
 * field cannot swallow the message.
 */
function plainText(value: string, max: number): string {
  const clean = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\u2014/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}...` : clean;
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
  const name = plainText(input.candidateName, 80);
  const org = plainText(input.orgName, 80);
  const position = plainText(input.positionName, 120);
  const deadline = plainText(input.deadline, 40);
  const url = plainUrl(input.url);
  const minutes = Math.max(1, Math.round(input.minutes));
  const contact = input.contactEmail && isEmail(input.contactEmail) ? plainText(input.contactEmail, MAX_EMAIL_LENGTH) : null;
  if (input.locale === "en") {
    return {
      subject: `${org}: ${position} assessment`,
      body: [
        name ? `Hi ${name},` : "Hi,",
        `We prepared a short assessment for your application for ${position} at ${org}. You can complete it in your own time, in about ${minutes} minutes.`,
        `To start: ${url}`,
        `Deadline: ${deadline}. If you stop halfway, the same link brings you back to where you left off.`,
        ...(contact ? [`If anything goes wrong, write to ${contact}.`] : []),
      ].join("\n\n"),
    };
  }
  return {
    subject: `${org}: ${position} değerlendirmesi`,
    body: [
      name ? `Merhaba ${name},` : "Merhaba,",
      `${org} için yaptığın ${position} başvurusu için kısa bir değerlendirme hazırladık. Kendi zamanında, yaklaşık ${minutes} dakikada tamamlayabilirsin.`,
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
    const nameOk = fullName.length >= 2 && fullName.length <= MAX_NAME_LENGTH && !/[<>@]/.test(fullName);
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
 * Decision 16: the chosen day, else the opening's deadline while it is ahead,
 * else 14 days from today. `today` is the org's day (`orgDay`); a malformed
 * chosen or deadline day is ignored rather than trusted.
 */
export function linkExpiryDay(input: { chosen: string | null; openingDeadlineDay: string | null; today: string }): string {
  if (input.chosen && dayParts(input.chosen)) return input.chosen;
  if (input.openingDeadlineDay && dayParts(input.openingDeadlineDay) && input.openingDeadlineDay >= input.today) return input.openingDeadlineDay;
  return addDays(input.today, 14);
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

export type CandidateProgress = "INVITED" | "OPENED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

/** One word for the Candidates tab: an unopened link past its date is expired, a started one never is. */
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
  if (input.linkStatus === "EXPIRED" || input.linkExpiresAt.getTime() < input.now.getTime()) return "EXPIRED";
  return input.firstSeen ? "OPENED" : "INVITED";
}
