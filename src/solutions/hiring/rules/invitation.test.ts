import { describe, expect, it } from "vitest";
import {
  addDays,
  candidateProgress,
  cleanInviteName,
  feedbackDay,
  firstInviteLines,
  formatInviteDay,
  formatInviteDeadline,
  inviteDeadlineParts,
  inviteMessage,
  isEmail,
  linkExpiryDay,
  MAX_INVITE_ROWS,
  MAX_INVITE_TEXT,
  MAX_NAME_LENGTH,
  parseInviteRows,
  releasedSurveyCount,
  sampleOf,
  seededRandom,
  SURVEY_BATCH,
  surveySeed,
} from "./invitation";
import { orgDay, zonedDayStart, zoneLabel } from "@/lib/org-timezone";

describe("the ready message (HIRING-UX 5.11)", () => {
  const base = { candidateName: "Elif Kaya", orgName: "Örnek A.Ş.", positionName: "Ürün Tasarımcısı", url: "https://kademe.test/a/abc", deadline: "14 Eki", minutes: 25, contactEmail: "deniz@ornek.com" };

  it("speaks to the candidate in Turkish with sen, with the name, the link, the deadline and a person to write to", () => {
    const { subject, body } = inviteMessage({ ...base, locale: "tr" });
    expect(subject).toBe("Örnek A.Ş.: Ürün Tasarımcısı değerlendirmesi");
    expect(body).toContain("Merhaba Elif Kaya,");
    expect(body).toContain("https://kademe.test/a/abc");
    expect(body).toContain("Son tarih: 14 Eki.");
    expect(body).toContain("yaklaşık 25 dakikada");
    expect(body).toContain("deniz@ornek.com");
    expect(body).not.toMatch(/sınız|siniz|iniz\b|ınız\b/);
  });

  it("has an English version and leaves the contact line out when there is none", () => {
    const { subject, body } = inviteMessage({ ...base, locale: "en", contactEmail: null, deadline: "14 Oct" });
    expect(subject).toBe("Örnek A.Ş.: Ürün Tasarımcısı assessment");
    expect(body).toContain("Hi Elif Kaya,");
    expect(body).toContain("Deadline: 14 Oct.");
    expect(body).not.toContain("write to");
  });

  it("never contains an em dash", () => {
    for (const locale of ["tr", "en"] as const) expect(JSON.stringify(inviteMessage({ ...base, locale }))).not.toContain("\u2014");
  });
});

describe("a pasted list of candidates", () => {
  it("reads name and e-mail in either order with comma, semicolon or tab, and skips blank lines", () => {
    const { rows, tooMany } = parseInviteRows('Elif Kaya, elif@example.com\n\n"ali@example.com";Ali Veli\nCan Demir\tcan@example.com\n');
    expect(tooMany).toBe(false);
    expect(rows).toEqual([
      { line: 1, fullName: "Elif Kaya", email: "elif@example.com", problem: null },
      { line: 3, fullName: "Ali Veli", email: "ali@example.com", problem: null },
      { line: 4, fullName: "Can Demir", email: "can@example.com", problem: null },
    ]);
  });

  it("marks a row without a name, with a bad e-mail, or repeating an e-mail", () => {
    const { rows } = parseInviteRows("elif@example.com\nAli, ali@\nElif Kaya, ELIF@example.com\nX, x@y.co");
    expect(rows.map((r) => r.problem)).toEqual(["NAME", "EMAIL", "DUPLICATE", "NAME"]);
  });

  it("takes at most 50 rows and says so", () => {
    const text = Array.from({ length: 51 }, (_, i) => `Aday ${i}, aday${i}@example.com`).join("\n");
    const { rows, tooMany } = parseInviteRows(text);
    expect(rows).toHaveLength(50);
    expect(tooMany).toBe(true);
  });

  it("checks e-mail the same way everywhere", () => {
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail("a b@c.co")).toBe(false);
  });
});

describe("the link's last day (decision 16)", () => {
  it("is the chosen day, else the opening's deadline while it is ahead, else 14 days from today", () => {
    expect(linkExpiryDay({ chosen: "2026-10-12", openingDeadlineDay: "2026-10-20", today: "2026-10-05" })).toBe("2026-10-12");
    expect(linkExpiryDay({ chosen: "2026-11-01", openingDeadlineDay: null, today: "2026-10-05" })).toBe("2026-11-01");
    expect(linkExpiryDay({ chosen: null, openingDeadlineDay: "2026-10-20", today: "2026-10-05" })).toBe("2026-10-20");
    expect(linkExpiryDay({ chosen: null, openingDeadlineDay: "2026-10-01", today: "2026-10-05" })).toBe("2026-10-19");
    expect(linkExpiryDay({ chosen: null, openingDeadlineDay: null, today: "2026-12-25" })).toBe("2027-01-08");
  });

  it("adds calendar days across month and year ends", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("where a candidate stands (the opening's Candidates tab)", () => {
  const now = new Date("2026-10-05T09:00:00Z");
  const future = new Date("2026-10-10T09:00:00Z");
  const base = { linkStatus: "NOT_STARTED" as const, linkExpiresAt: future, firstSeen: false, started: false, completed: false, now };
  it("moves from invited to opened to in progress to completed", () => {
    expect(candidateProgress(base)).toBe("INVITED");
    expect(candidateProgress({ ...base, firstSeen: true })).toBe("OPENED");
    expect(candidateProgress({ ...base, linkStatus: "IN_PROGRESS", firstSeen: true, started: true })).toBe("IN_PROGRESS");
    expect(candidateProgress({ ...base, linkStatus: "COMPLETED", started: true, completed: true })).toBe("COMPLETED");
  });

  it("calls an unopened link past its date expired, but never a started one", () => {
    expect(candidateProgress({ ...base, linkExpiresAt: new Date("2026-10-01T00:00:00Z") })).toBe("EXPIRED");
    expect(candidateProgress({ ...base, linkStatus: "EXPIRED" })).toBe("EXPIRED");
    expect(candidateProgress({ ...base, linkStatus: "IN_PROGRESS", started: true, linkExpiresAt: new Date("2026-10-01T00:00:00Z") })).toBe("IN_PROGRESS");
  });
});

describe("hostile text in the message (plain text body, no markup, no header injection)", () => {
  const base = { orgName: "Örnek A.Ş.", positionName: "Ürün Tasarımcısı", url: "https://kademe.test/a/abc", deadline: "14 Eki", minutes: 25, contactEmail: null };

  it("keeps a name with newlines and angle brackets on one plain line", () => {
    for (const locale of ["tr", "en"] as const) {
      const { subject, body } = inviteMessage({ ...base, locale, candidateName: "Elif\r\nBcc: x@evil.test <script>alert(1)</script>" });
      expect(body.split("\n\n")[0]).not.toMatch(/[\r\n<>]/);
      expect(body).not.toMatch(/[<>]/);
      expect(subject).not.toMatch(/[\r\n<>]/);
    }
  });

  it("strips hostile org and position names from the subject too", () => {
    const { subject, body } = inviteMessage({ ...base, locale: "en", candidateName: "Ali", orgName: "Acme\nSubject: spam", positionName: "<b>Dev</b>" });
    expect(subject).toBe("Acme Subject: spam: bDev/b assessment");
    expect(body).not.toMatch(/[<>]/);
  });

  it("cuts a very long name instead of letting it swallow the message", () => {
    const { subject, body } = inviteMessage({ ...base, locale: "tr", candidateName: "A".repeat(5000), orgName: "O".repeat(5000), positionName: "P".repeat(5000) });
    expect(subject.length).toBeLessThan(400);
    expect(body.length).toBeLessThan(1500);
    expect(body).toContain("https://kademe.test/a/abc");
    expect(body).toContain("Son tarih: 14 Eki.");
  });

  it("falls back to a neutral word when the name is empty after cleaning", () => {
    expect(inviteMessage({ ...base, locale: "tr", candidateName: " <> \n" }).body).toContain("Merhaba,");
    expect(inviteMessage({ ...base, locale: "en", candidateName: "" }).body).toContain("Hi,");
  });

  it("never carries an em dash even when a name does", () => {
    const { subject, body } = inviteMessage({ ...base, locale: "en", candidateName: "Ali \u2014 Veli", orgName: "A\u2014B" });
    expect(subject + body).not.toContain("\u2014");
  });
});

describe("a pasted list, the awkward shapes", () => {
  it("reads 'Name <mail>', 'mail, Name', quoted CSV with a comma in the name, Turkish letters and CRLF", () => {
    const text = 'Şebnem Çağlar <sebnem@example.com>\r\nonur@example.com, Öznur İşçi\r\n"Kaya, Elif","elif@example.com"\r\n\uFEFFİlker Ğ\tilker@example.com';
    const { rows } = parseInviteRows(text);
    expect(rows).toEqual([
      { line: 1, fullName: "Şebnem Çağlar", email: "sebnem@example.com", problem: null },
      { line: 2, fullName: "Öznur İşçi", email: "onur@example.com", problem: null },
      { line: 3, fullName: "Kaya, Elif", email: "elif@example.com", problem: null },
      { line: 4, fullName: "İlker Ğ", email: "ilker@example.com", problem: null },
    ]);
  });

  it("flags a repeated e-mail case-insensitively whatever shape it came in", () => {
    const { rows } = parseInviteRows("Ali Veli <Ali@Example.com>\nali@example.COM, Ali V.\nAyşe Fatma, ali@example.com");
    expect(rows.map((r) => r.problem)).toEqual([null, "DUPLICATE", "DUPLICATE"]);
  });

  it("flags a second address or an address-looking name instead of guessing", () => {
    const { rows } = parseInviteRows("a@example.com, b@example.com\nx@example.com, <b>");
    expect(rows.map((r) => r.problem)).toEqual(["NAME", "NAME"]);
  });

  it("marks, never drops, lines with a missing e-mail, an absurd length, or only separators", () => {
    const long = "N".repeat(300);
    const { rows } = parseInviteRows(`Ali Veli\n${long}, long@example.com\n,,;\nok name, ${"x".repeat(250)}@example.com`);
    expect(rows.map((r) => [r.line, r.problem])).toEqual([[1, "EMAIL"], [2, "NAME"], [3, "EMAIL"], [4, "EMAIL"]]);
  });

  it("counts the cap on non-blank lines, and exactly MAX_INVITE_ROWS is not too many", () => {
    const exact = Array.from({ length: MAX_INVITE_ROWS }, (_, i) => `Aday ${i}, a${i}@example.com`).join("\n\n");
    const out = parseInviteRows(exact);
    expect(out.rows).toHaveLength(MAX_INVITE_ROWS);
    expect(out.tooMany).toBe(false);
    expect(parseInviteRows("").rows).toEqual([]);
  });
});

describe("days are org days, not machine days", () => {
  it("expires 14 days out across a DST change in a zone west of UTC (Los Angeles, 2026-11-01)", () => {
    const zone = "America/Los_Angeles";
    const today = orgDay(new Date("2026-10-25T06:30:00Z"), zone);
    expect(today).toBe("2026-10-24");
    const expiry = linkExpiryDay({ chosen: null, openingDeadlineDay: null, today });
    expect(expiry).toBe("2026-11-07");
    expect(zonedDayStart(expiry, zone)?.toISOString()).toBe("2026-11-07T08:00:00.000Z");
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
  });

  it("uses the org's today near midnight: 23:30 in Los Angeles is already tomorrow in UTC", () => {
    const zone = "America/Los_Angeles";
    const instant = new Date("2026-03-08T07:30:00Z");
    const today = orgDay(instant, zone);
    expect(today).toBe("2026-03-07");
    expect(linkExpiryDay({ chosen: null, openingDeadlineDay: null, today })).toBe("2026-03-21");
    expect(zonedDayStart("2026-03-21", zone)?.toISOString()).toBe("2026-03-21T07:00:00.000Z");
  });

  it("crosses the European autumn change (Berlin, 2026-10-25) and a leap day", () => {
    expect(addDays("2026-10-20", 14)).toBe("2026-11-03");
    expect(zonedDayStart(addDays("2026-10-24", 2), "Europe/Berlin")?.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("ignores a malformed chosen or deadline day and refuses to add days to one", () => {
    expect(linkExpiryDay({ chosen: "soon", openingDeadlineDay: "2026-02-30", today: "2026-10-05" })).toBe("2026-10-19");
    expect(() => addDays("2026-13-01", 1)).toThrow(RangeError);
  });

  it("writes a deadline day for the candidate's language", () => {
    expect(formatInviteDay("2026-10-14", "tr")).toBe("14 Eki");
    expect(formatInviteDay("2026-10-14", "en")).toBe("14 Oct");
    expect(formatInviteDay("2026-09-03", "en")).toBe("3 Sep");
    expect(formatInviteDay("2026-09-03", "tr")).toBe("3 Eyl");
  });
});

describe("a chosen last day is held inside [today, the opening's deadline] (fix round 1)", () => {
  it("raises a day in the past to today and lowers a day past the deadline to the deadline", () => {
    expect(linkExpiryDay({ chosen: "2026-09-01", openingDeadlineDay: "2026-10-20", today: "2026-10-05" })).toBe("2026-10-05");
    expect(linkExpiryDay({ chosen: "2026-11-01", openingDeadlineDay: "2026-10-20", today: "2026-10-05" })).toBe("2026-10-20");
  });

  it("keeps today itself and the deadline itself, and has no upper bound without a deadline", () => {
    expect(linkExpiryDay({ chosen: "2026-10-05", openingDeadlineDay: "2026-10-20", today: "2026-10-05" })).toBe("2026-10-05");
    expect(linkExpiryDay({ chosen: "2026-10-20", openingDeadlineDay: "2026-10-20", today: "2026-10-05" })).toBe("2026-10-20");
    expect(linkExpiryDay({ chosen: "2030-01-01", openingDeadlineDay: null, today: "2026-10-05" })).toBe("2030-01-01");
  });

  it("ignores a deadline that is already behind today instead of clamping to a past day", () => {
    expect(linkExpiryDay({ chosen: "2026-10-12", openingDeadlineDay: "2026-10-01", today: "2026-10-05" })).toBe("2026-10-12");
  });
});

describe("candidateProgress, links that are not NOT_STARTED (fix round 1)", () => {
  const now = new Date("2026-10-05T09:00:00Z");
  const past = new Date("2026-10-01T00:00:00Z");
  const base = { linkStatus: "NOT_STARTED" as const, linkExpiresAt: new Date("2026-10-10T09:00:00Z"), firstSeen: false, started: false, completed: false, now };

  it("expires only an unstarted NOT_STARTED link, like the candidate context does", () => {
    expect(candidateProgress({ ...base, linkStatus: "RETAKE_AVAILABLE", linkExpiresAt: past })).toBe("INVITED");
    expect(candidateProgress({ ...base, linkStatus: "RETAKE_AVAILABLE", linkExpiresAt: past, firstSeen: true })).toBe("OPENED");
    expect(candidateProgress({ ...base, linkStatus: "RETAKE_AVAILABLE", started: true, linkExpiresAt: past })).toBe("IN_PROGRESS");
    expect(candidateProgress({ ...base, linkStatus: "IN_PROGRESS", firstSeen: true, linkExpiresAt: past })).toBe("OPENED");
  });

  it("is not yet expired at the very instant the link ends, and is a millisecond later", () => {
    expect(candidateProgress({ ...base, linkExpiresAt: now })).toBe("INVITED");
    expect(candidateProgress({ ...base, linkExpiresAt: new Date(now.getTime() - 1) })).toBe("EXPIRED");
  });
});

describe("message minor fixes (fix round 1)", () => {
  const base = { locale: "en" as const, candidateName: "Ali", orgName: "Acme", positionName: "Dev", url: "https://kademe.test/a/abc", deadline: "14 Oct", minutes: 25, contactEmail: null };

  it("strips bidi and zero width controls from inserted names", () => {
    const { subject, body } = inviteMessage({ ...base, candidateName: "Al\u202Ei\u200B\u2066 Ve\u200Fli", orgName: "Ac\u202Dme", positionName: "D\u2069ev" });
    expect(subject + body).not.toMatch(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/);
    expect(body).toContain("Hi Ali Veli,");
    expect(subject).toBe("Acme: Dev assessment");
  });

  it("removes scheme:// runs from names so the link appears once", () => {
    const { subject, body } = inviteMessage({ ...base, candidateName: "Ali https://evil.test/login?x=1 Veli", orgName: "Acme http://x.test", positionName: "ftp://a.b Dev" });
    expect(body.match(/:\/\//g)).toHaveLength(1);
    expect(subject).not.toContain("://");
    expect(body).toContain("Hi Ali Veli,");
  });

  it("does not let removing angle brackets or control characters rebuild a scheme:// run", () => {
    const probes = ["https<>://evil.test/x", "Ali https:<>//evil.test", "https:/<>/evil.test", "https:\u0001//evil.test", "ht<>tps<>:<>/<>/evil.test", "hhttps<>://a.test c://b.test"];
    for (const candidateName of probes) {
      const { subject, body } = inviteMessage({ ...base, candidateName, orgName: candidateName, positionName: candidateName });
      expect(body.match(/:\/\//g)).toHaveLength(1);
      expect(subject).not.toContain("://");
      expect(body).not.toContain("evil.test");
    }
  });

  it("cuts by characters, never through a surrogate pair", () => {
    const { body } = inviteMessage({ ...base, candidateName: "\u{1F600}".repeat(500) });
    const hi = body.split("\n\n")[0];
    expect(hi).toBe(`Hi ${"\u{1F600}".repeat(MAX_NAME_LENGTH)}...,`);
    expect(hi).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });

  it("uses the one name cap the pasted list uses", () => {
    const long = "N".repeat(MAX_NAME_LENGTH + 1);
    expect(parseInviteRows(`${long}, a@example.com`).rows[0].problem).toBe("NAME");
    expect(parseInviteRows(`${"N".repeat(MAX_NAME_LENGTH)}, a@example.com`).rows[0].problem).toBeNull();
    expect(inviteMessage({ ...base, candidateName: long }).body).toContain(`Hi ${"N".repeat(MAX_NAME_LENGTH)}...,`);
  });

  it("leaves the minutes out when they are not a usable number, and refuses an empty link", () => {
    for (const minutes of [Number.NaN, -5, 0, 0.2, Number.POSITIVE_INFINITY]) {
      for (const locale of ["tr", "en"] as const) {
        const { body } = inviteMessage({ ...base, locale, minutes });
        expect(body).not.toMatch(/NaN|Infinity|-5|\b0\b/);
        expect(body).not.toMatch(/minutes|dakika/);
      }
    }
    expect(inviteMessage({ ...base, minutes: 25.4 }).body).toContain("about 25 minutes");
    expect(() => inviteMessage({ ...base, url: "  <> " })).toThrow();
  });

  it("gives an empty organisation or position a neutral wording", () => {
    const noOrg = inviteMessage({ ...base, orgName: " <> " });
    expect(noOrg.subject).toBe("Dev assessment");
    expect(noOrg.body).toContain("application for Dev.");
    const noPos = inviteMessage({ ...base, positionName: "" });
    expect(noPos.subject).toBe("Acme: assessment");
    expect(noPos.body).toContain("application for this role at Acme.");
    const neither = inviteMessage({ ...base, locale: "tr", orgName: "", positionName: "" });
    expect(neither.subject).toBe("Değerlendirme");
    expect(neither.body).toContain("Bu pozisyon başvurun için kısa bir değerlendirme hazırladık.");
    expect(neither.body).not.toMatch(/undefined|null/);
  });

  it("says 'için' once in the Turkish opening line", () => {
    const { body } = inviteMessage({ ...base, locale: "tr", orgName: "Örnek A.Ş.", positionName: "Ürün Tasarımcısı" });
    expect(body).toContain("Örnek A.Ş. bünyesindeki Ürün Tasarımcısı başvurun için kısa bir değerlendirme hazırladık.");
    expect(body.split("\n\n")[1].match(/için/g)).toHaveLength(1);
  });
});

describe("the deadline as the end of the org's day", () => {
  it("names the time and the zone, in the candidate's language", () => {
    const tr = formatInviteDeadline("2026-10-14", "tr", zoneLabel("tr", "Europe/Istanbul"));
    const en = formatInviteDeadline("2026-10-14", "en", zoneLabel("en", "Europe/Istanbul"));
    expect(tr).toBe("14 Eki 23:59 (Türkiye Standart Saati)");
    expect(en).toBe("14 Oct, 23:59 (Türkiye Standard Time)");
    const { body } = inviteMessage({ locale: "tr", candidateName: "Ali", orgName: "Acme", positionName: "Dev", url: "https://kademe.test/a/abc", deadline: tr, minutes: 25, contactEmail: null });
    expect(body).toContain("Son tarih: 14 Eki 23:59 (Türkiye Standart Saati).");
  });

  it("gives the same words in two parts, the day and time apart from the zone, for a small tile (Task 5 review fix 6)", () => {
    expect(inviteDeadlineParts("2026-10-14", "tr", "Türkiye Standart Saati")).toEqual({ when: "14 Eki 23:59", zone: "Türkiye Standart Saati" });
    expect(inviteDeadlineParts("2026-10-14", "en", "Türkiye Standard Time")).toEqual({ when: "14 Oct, 23:59", zone: "Türkiye Standard Time" });
  });
});

describe("the reply promise's day (Task 16 fix round 1, I2)", () => {
  it("is the completion's day in the organisation's zone plus the opening's feedback days", () => {
    expect(feedbackDay(new Date("2026-10-05T09:00:00.000Z"), 7, "Europe/Istanbul")).toBe("2026-10-12");
    // 22:30 UTC is already the next day in Istanbul: the promise counts from that day.
    expect(feedbackDay(new Date("2026-10-05T22:30:00.000Z"), 7, "Europe/Istanbul")).toBe("2026-10-13");
    expect(feedbackDay(new Date("2026-10-05T22:30:00.000Z"), 7, "UTC")).toBe("2026-10-12");
    // By the calendar across a month end.
    expect(feedbackDay(new Date("2026-10-28T09:00:00.000Z"), 7, "Europe/Istanbul")).toBe("2026-11-04");
  });
});

describe("a long spreadsheet paste is cut to the rows that are read (Task 17 fix round 1)", () => {
  const sheet = Array.from({ length: 700 }, (_, i) => `Aday Numara ${i + 1}\taday${i + 1}@example.com\tİstanbul\t+90 555 000 00 00`).join("\r\n");

  it("keeps the lines up to the MAX_INVITE_ROWS-th non-blank one, blank lines and line numbers included", () => {
    const cut = firstInviteLines(`\n${sheet}`);
    expect(cut.split("\n")).toHaveLength(MAX_INVITE_ROWS + 1);
    const all = parseInviteRows(`\n${sheet}`);
    const kept = parseInviteRows(cut);
    expect(all.tooMany).toBe(true);
    expect(kept.tooMany).toBe(false);
    // The same rows, with the same line numbers, as the manager saw them.
    expect(kept.rows).toEqual(all.rows);
    expect(cut.length).toBeLessThanOrEqual(MAX_INVITE_TEXT);
  });

  it("leaves a short list as it is (line breaks normalised) and counts a byte order mark line as blank", () => {
    expect(firstInviteLines("Elif Kaya, elif@example.com\r\nCan, can@example.com")).toBe("Elif Kaya, elif@example.com\nCan, can@example.com");
    expect(firstInviteLines("")).toBe("");
    const withBom = `\uFEFF\n${Array.from({ length: 60 }, (_, i) => `A${i}, a${i}@example.com`).join("\n")}`;
    expect(parseInviteRows(firstInviteLines(withBom)).rows).toHaveLength(MAX_INVITE_ROWS);
  });

  it("has room for MAX_INVITE_ROWS rows of the longest name and e-mail, quoted", () => {
    const longest = `"${"ş".repeat(MAX_NAME_LENGTH)}", <${"a".repeat(64)}@${"b".repeat(180)}.com>`;
    const text = Array.from({ length: MAX_INVITE_ROWS }, () => longest).join("\n");
    expect(text.length).toBeLessThanOrEqual(MAX_INVITE_TEXT);
  });
});

describe("one name rule for the pasted list, the form and the server (Task 17 fix round 1)", () => {
  it("collapses spaces and refuses short, long, bracketed or address-like names, counting code points", () => {
    expect(cleanInviteName("  Elif   Kaya ")).toBe("Elif Kaya");
    expect(cleanInviteName("E")).toBeNull();
    expect(cleanInviteName("Elif <b>")).toBeNull();
    expect(cleanInviteName("elif@example")).toBeNull();
    expect(cleanInviteName("x".repeat(MAX_NAME_LENGTH))).toBe("x".repeat(MAX_NAME_LENGTH));
    expect(cleanInviteName("x".repeat(MAX_NAME_LENGTH + 1))).toBeNull();
    // Two code points, four UTF-16 units: a name, not a cut.
    expect(cleanInviteName("😀😀")).toBe("😀😀");
    expect(cleanInviteName("😀".repeat(MAX_NAME_LENGTH))).not.toBeNull();
  });

  it("is the rule the pasted list marks NAME with", () => {
    expect(parseInviteRows("Elif <b>, elif@example.com").rows[0].problem).toBe("NAME");
    expect(parseInviteRows("😀😀, elif@example.com").rows[0].problem).toBeNull();
  });
});

describe("the name is the cells before the e-mail (Task 17 fix round 2)", () => {
  it("drops the columns after the e-mail: a phone never becomes part of the name", () => {
    const [row] = parseInviteRows("Elif Kaya\telif@example.com\t+90 555 000 00 00").rows;
    expect(row).toEqual({ line: 1, fullName: "Elif Kaya", email: "elif@example.com", problem: null });
  });

  it("joins a first and a last name split over two cells", () => {
    expect(parseInviteRows("Elif\tKaya\telif@example.com\tİstanbul").rows[0].fullName).toBe("Elif Kaya");
  });

  it("takes the cells after the e-mail when the sheet starts with it", () => {
    expect(parseInviteRows("elif@example.com\tElif Kaya").rows[0]).toEqual({ line: 1, fullName: "Elif Kaya", email: "elif@example.com", problem: null });
    expect(parseInviteRows("elif@example.com, Elif, Kaya").rows[0].fullName).toBe("Elif Kaya");
  });

  it("leaves the angle-bracket form as it was, and keeps line numbers and problem codes", () => {
    expect(parseInviteRows('"Ece Arslan" <ece@example.com>').rows[0].fullName).toBe("Ece Arslan");
    const { rows } = parseInviteRows("\nElif Kaya\telif@example.com\t+90 555\nx\tkisa@example.com\t+90\nCan\tcan@\nElif K\tELIF@example.com\tnot");
    expect(rows.map((r) => [r.line, r.fullName, r.problem])).toEqual([
      [2, "Elif Kaya", null],
      [3, "x", "NAME"],
      [4, "Can", "EMAIL"],
      [5, "Elif K", "DUPLICATE"],
    ]);
  });
});

// Task 19 fix round 1, I1: the overview's survey moves in whole batches, so neither a reload
// nor the next answer tells the team whose comment or rating it is.
describe("the finish survey's batch release", () => {
  it("releases only whole batches of five", () => {
    expect(SURVEY_BATCH).toBe(5);
    expect([0, 1, 4, 5, 6, 9, 10, 14, 15].map(releasedSurveyCount)).toEqual([0, 0, 0, 5, 5, 5, 10, 10, 15]);
    expect(releasedSurveyCount(-1)).toBe(0);
    expect(releasedSurveyCount(Number.NaN)).toBe(0);
  });

  it("seeds from the opening and the released count only", () => {
    const a = "22222222-2222-4222-8222-222222222222";
    expect(surveySeed(a, 5)).toBe(surveySeed(a, 5));
    expect(surveySeed(a, 5)).not.toBe(surveySeed(a, 10));
    expect(surveySeed(a, 5)).not.toBe(surveySeed("33333333-3333-4333-8333-333333333333", 5));
    expect(Number.isInteger(surveySeed(a, 5)) && surveySeed(a, 5) >= 0).toBe(true);
  });

  it("draws the same numbers for the same seed, all in [0, 1)", () => {
    const one = seededRandom(42);
    const two = seededRandom(42);
    const draws = Array.from({ length: 50 }, () => one());
    expect(Array.from({ length: 50 }, () => two())).toEqual(draws);
    expect(draws.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(draws).size).toBeGreaterThan(40);
    expect(Array.from({ length: 5 }, seededRandom(43))).not.toEqual(draws.slice(0, 5));
  });

  it("samples distinct items from the pool, the same ones for the same seed", () => {
    const pool = Array.from({ length: 20 }, (_, i) => `c${i}`);
    const pick = sampleOf(pool, 3, seededRandom(7));
    expect(sampleOf(pool, 3, seededRandom(7))).toEqual(pick);
    expect(pick).toHaveLength(3);
    expect(new Set(pick).size).toBe(3);
    for (const c of pick) expect(pool).toContain(c);
    expect(sampleOf(["x"], 3, seededRandom(7))).toEqual(["x"]);
    expect(pool).toEqual(Array.from({ length: 20 }, (_, i) => `c${i}`));
  });
});
