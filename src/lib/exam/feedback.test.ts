import { describe, expect, it } from "vitest";
import { cleanComment, FEEDBACK_COMMENT_MAX, parseFeedbackBody } from "./feedback";
import { formatAverage, technicalPercent } from "./feedback-stats";

describe("parseFeedbackBody", () => {
  it("takes the rating alone: everything else is optional and stays null", () => {
    expect(parseFeedbackBody({ overall: 4 })).toEqual({
      ok: true,
      value: { overall: 4, clarity: null, usability: null, technicalProblem: null, comment: null },
    });
  });

  it("takes a full answer, trimming the comment", () => {
    expect(parseFeedbackBody({ overall: 5, clarity: 3, usability: 1, technicalProblem: true, comment: "  Das Bild war zu dunkel.  " })).toEqual({
      ok: true,
      value: { overall: 5, clarity: 3, usability: 1, technicalProblem: true, comment: "Das Bild war zu dunkel." },
    });
  });

  it("reads null and a blank comment as skipped", () => {
    expect(parseFeedbackBody({ overall: 2, clarity: null, usability: null, technicalProblem: null, comment: "   " })).toEqual({
      ok: true,
      value: { overall: 2, clarity: null, usability: null, technicalProblem: null, comment: null },
    });
  });

  it.each([[undefined], [null], [0], [6], [3.5], ["4"], [true], [-1]])("refuses an overall rating of %s with SURVEY_INVALID", (overall) => {
    expect(parseFeedbackBody({ overall })).toEqual({ ok: false, code: "SURVEY_INVALID" });
  });

  it("refuses an empty object like a missing rating: SURVEY_INVALID, not a malformed request", () => {
    expect(parseFeedbackBody({})).toEqual({ ok: false, code: "SURVEY_INVALID" });
  });

  it.each([[{ clarity: 0 }], [{ clarity: 6 }], [{ usability: 2.5 }], [{ usability: "3" }]])("refuses a sub rating outside 1-5 (%j) with SURVEY_INVALID", (extra) => {
    expect(parseFeedbackBody({ overall: 3, ...extra })).toEqual({ ok: false, code: "SURVEY_INVALID" });
  });

  it.each([[null], [undefined], ["text"], [42], [[]], [{ overall: 3, technicalProblem: "yes" }], [{ overall: 3, comment: 7 }], [{ overall: 3, comment: ["a"] }]])(
    "refuses a body that is not the survey's shape (%j) with REQUEST_INVALID",
    (body) => {
      const parsed = parseFeedbackBody(body);
      // Not an object, or a flag or comment of the wrong kind: a malformed request. (A rating that is merely wrong is the survey's own refusal, above.)
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.code).toBe("REQUEST_INVALID");
    },
  );

  it("accepts a comment of exactly the limit and refuses one character more", () => {
    expect(parseFeedbackBody({ overall: 3, comment: "x".repeat(FEEDBACK_COMMENT_MAX) }).ok).toBe(true);
    expect(parseFeedbackBody({ overall: 3, comment: "x".repeat(FEEDBACK_COMMENT_MAX + 1) })).toEqual({ ok: false, code: "REQUEST_INVALID" });
  });

  it("keeps the database limit: 1000 UTF-16 units never exceed 1000 characters", () => {
    // Postgres counts characters; a pair of UTF-16 units (an emoji) is one character, so the unit limit is the safe one.
    const emoji = "\u{1F600}".repeat(500);
    expect(emoji.length).toBe(1000);
    expect(Array.from(emoji).length).toBe(500);
    expect(parseFeedbackBody({ overall: 3, comment: emoji }).ok).toBe(true);
  });

  it("ignores fields it does not know (no score, level or assessment id can ride along)", () => {
    const parsed = parseFeedbackBody({ overall: 3, assessmentId: "other", orgId: "other", level: "C2" });
    expect(parsed).toEqual({ ok: true, value: { overall: 3, clarity: null, usability: null, technicalProblem: null, comment: null } });
  });
});

describe("cleanComment", () => {
  it("trims and turns empty into null", () => {
    expect(cleanComment(" a ")).toBe("a");
    expect(cleanComment("")).toBeNull();
    expect(cleanComment(undefined)).toBeNull();
    expect(cleanComment(null)).toBeNull();
  });
});

describe("overview wording", () => {
  it("writes an average with one decimal in the panel's language", () => {
    expect(formatAverage(4.25, "en")).toBe("4.3");
    expect(formatAverage(4.3, "de")).toBe("4,3");
    expect(formatAverage(5, "tr")).toBe("5,0");
  });

  it("writes nothing for an empty average", () => {
    expect(formatAverage(null, "de")).toBe("-");
    expect(formatAverage(Number.NaN, "de")).toBe("-");
  });

  it("gives the technical share as a whole percent of those who answered, and null when nobody did", () => {
    expect(technicalPercent(8, 2)).toBe(25);
    expect(technicalPercent(3, 1)).toBe(33);
    expect(technicalPercent(0, 0)).toBeNull();
    expect(technicalPercent(5, 9)).toBe(100);
  });
});
