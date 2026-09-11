/**
 * The one time zone the organisation's calendar days are counted in.
 *
 * Every timestamp is stored in UTC, but a manager typing "8 September" into a
 * date filter means their own day, not the day of whatever zone the server
 * process happens to run in (UTC on Cloud Run, the laptop's zone in dev). The
 * product serves one company in one place, so a single configured zone is
 * the honest answer; per user zones would be a settings feature this does not
 * have.
 *
 * `ORG_TIMEZONE` (an IANA name) overrides the default. An unknown name falls
 * back to the default rather than taking the audit screen down.
 */

const DEFAULT_ORG_TIMEZONE = "Europe/Istanbul";

export const ORG_TIMEZONE = resolveTimeZone(process.env.ORG_TIMEZONE);

export function resolveTimeZone(candidate: string | undefined): string {
  const name = candidate?.trim();
  if (!name) return DEFAULT_ORG_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return name;
  } catch {
    return DEFAULT_ORG_TIMEZONE;
  }
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The instant at which the given calendar day starts in `timeZone`, or null
 * for anything that is not a real YYYY-MM-DD. `dayOffset` shifts the day
 * (1 gives the start of the next day, the exclusive end of a "to" filter),
 * with the zone rule applied to the shifted day, so a DST switch in between
 * is handled.
 */
export function zonedDayStart(
  value: string,
  timeZone: string = ORG_TIMEZONE,
  dayOffset = 0,
): Date | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);

  // Date.UTC rolls "2026-02-30" over to March; a date that does not survive
  // the round trip was never a date.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  // The wall clock midnight, written as if it were UTC, then shifted by the
  // zone's offset. Two passes: the offset at the guess and at the answer can
  // differ when the day sits on a DST switch.
  const wall = Date.UTC(year, month - 1, day + dayOffset);
  const first = wall - offsetMs(timeZone, new Date(wall));
  return new Date(wall - offsetMs(timeZone, new Date(first)));
}

/** Offset of `timeZone` from UTC at `at`, in milliseconds (positive east). */
function offsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    n("year"),
    n("month") - 1,
    n("day"),
    n("hour"),
    n("minute"),
    n("second"),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}
