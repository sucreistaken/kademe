import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CandidateIntl } from "@/components/candidate/Intl";
import { CANDIDATE_LOCALES, type CandidateLocale } from "@/i18n/locale";
import { candidateT } from "@/i18n/candidate";
import { EMPTY_FEEDBACK, ExamFeedback, FeedbackCard, feedbackBody, submitFeedback, type FeedbackDraft, type FeedbackPhase } from "./ExamFeedback";

const noop = () => undefined;

function card(opts: { locale?: CandidateLocale; phase?: FeedbackPhase; draft?: Partial<FeedbackDraft> } = {}) {
  const props: ComponentProps<typeof FeedbackCard> = {
    phase: opts.phase ?? "open",
    draft: { ...EMPTY_FEEDBACK, ...opts.draft },
    onChange: noop,
    onSend: noop,
    onSkip: noop,
  };
  return renderToStaticMarkup(
    createElement(CandidateIntl, { locale: opts.locale ?? "en", timeZone: "UTC" } as ComponentProps<typeof CandidateIntl>, createElement(FeedbackCard, props)),
  );
}

const radios = (html: string) => [...html.matchAll(/<input type="radio"[^>]*>/g)].map((m) => m[0]);

describe("the survey card, empty", () => {
  const html = card();

  it("asks for the stars only: five radios, the title, the optional tag and a way out, and no filled button yet", () => {
    expect(html).toContain("Rate the exam");
    expect(html).toContain("Optional");
    expect(html).toContain("How would you rate the exam overall?");
    expect(radios(html)).toHaveLength(5);
    expect(html).toContain("Not now");
    expect(html).not.toContain(">Send<");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("How clear were the instructions?");
  });

  it("makes the stars one radio group with a name each, reachable by keyboard", () => {
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    for (let n = 1; n <= 5; n++) expect(html).toContain(`${n} out of 5`);
    const names = new Set(radios(html).map((r) => /name="([^"]+)"/.exec(r)?.[1]));
    expect(names.size).toBe(1);
    // Native radios inside the label: Tab, the arrow keys and a screen reader work as everywhere.
    expect(html).not.toContain("tabindex=\"-1\" role=\"radio\"");
    expect(radios(html).every((r) => !r.includes("disabled"))).toBe(true);
  });

  it("is a calm card, not a dialog", () => {
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("aria-modal");
    expect(html).toContain("<section");
    expect(html).toContain("<h2");
  });
});

describe("the survey card, rated", () => {
  const html = card({ draft: { overall: 4 } });

  it("shows the chosen star as checked, with its word, and opens the rest", () => {
    const checked = radios(html).filter((r) => r.includes("checked"));
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('value="4"');
    expect(html).toContain(">Good<");
    expect(html).toContain("How clear were the instructions?");
    expect(html).toContain("How easy was the exam screen to use?");
    expect(html).toContain("Did you have a technical problem?");
    expect(html).toContain("Is there anything you would like to add? (optional)");
  });

  it("asks the two quick questions as 1-5 radios with their ends named, and the technical one as yes or no", () => {
    // 5 stars + 5 + 5 clarity/usability + 2 technical.
    expect(radios(html)).toHaveLength(5 + 5 + 5 + 2);
    expect(html).toContain("Not clear at all");
    expect(html).toContain("Very clear");
    expect(html).toContain("Very hard");
    expect(html).toContain("Very easy");
    expect(html).toContain(">Yes<");
    expect(html).toContain(">No<");
    expect(html).toContain("camera, sound, internet connection or screen");
  });

  it("limits the comment to 1000 characters and counts them", () => {
    expect(html).toMatch(/<textarea[^>]*maxLength="1000"/);
    expect(html).toContain("0 / 1000");
    expect(card({ draft: { overall: 2, comment: "Hello" } })).toContain("5 / 1000");
  });

  it("has the one filled button, Send", () => {
    expect(html).toContain("Send");
    expect(html.match(/data-variant="primary"/g)).toHaveLength(1);
    expect(html).toContain("Not now");
  });

  it("shows what was chosen on the quick questions", () => {
    const answered = card({ draft: { overall: 3, clarity: 2, usability: 5, technicalProblem: true } });
    const checked = radios(answered).filter((r) => r.includes("checked"));
    expect(checked.map((r) => /value="([^"]+)"/.exec(r)?.[1]).sort()).toEqual(["2", "3", "5", "yes"]);
  });
});

describe("the survey card, while sending and after", () => {
  it("locks the form and says it is sending", () => {
    const html = card({ phase: "sending", draft: { overall: 5, comment: "ok" } });
    expect(html).toContain("Sending");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>(<[^>]+>)*Sending/);
    expect(radios(html).every((r) => r.includes("disabled"))).toBe(true);
    expect(html).toMatch(/<textarea[^>]*disabled/);
  });

  it("keeps the answer and offers a retry when the send failed, without a red box", () => {
    const html = card({ phase: "failed", draft: { overall: 5 } });
    expect(html).toContain('role="alert"');
    expect(html).toContain("It could not be sent. Check your connection and try again.");
    expect(html).toContain("Try again");
    expect(html).toContain("bg-yellow-soft");
    expect(html).not.toMatch(/bg-danger|text-danger|text-red|bg-red/);
    expect(radios(html).filter((r) => r.includes("checked"))).toHaveLength(1);
  });

  it("thanks the student once it is sent: no form, no button, a status line", () => {
    const html = card({ phase: "sent", draft: { overall: 5, comment: "private words" } });
    expect(html).toContain("Thank you. Your feedback has reached your school.");
    expect(html).toContain('role="status"');
    expect(radios(html)).toHaveLength(0);
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("private words");
    expect(html).not.toContain("Optional");
  });

  it("draws nothing once skipped", () => {
    expect(card({ phase: "skipped" })).toBe("");
  });
});

describe("the container", () => {
  const container = (props: { answered: boolean; locale?: CandidateLocale }) =>
    renderToStaticMarkup(
      createElement(CandidateIntl, { locale: props.locale ?? "en", timeZone: "UTC" } as ComponentProps<typeof CandidateIntl>, createElement(ExamFeedback, { token: "t".repeat(43), answered: props.answered })),
    );

  it("offers the card to a student who has not answered", () => {
    expect(container({ answered: false })).toContain("Rate the exam");
  });

  it("does not bring the card back once the server says it is answered (a reload)", () => {
    expect(container({ answered: true })).toBe("");
  });
});

describe("what is sent", () => {
  it("trims the comment and sends an empty one as null", () => {
    expect(feedbackBody({ ...EMPTY_FEEDBACK, overall: 4, comment: "  hi  " })).toEqual({ overall: 4, clarity: null, usability: null, technicalProblem: null, comment: "hi" });
    expect(feedbackBody({ ...EMPTY_FEEDBACK, overall: 4, comment: "   " }).comment).toBeNull();
  });

  it("posts to the exam's feedback route and reports sent", async () => {
    const post = vi.fn(async () => ({ received: true }));
    const out = await submitFeedback("tok", { ...EMPTY_FEEDBACK, overall: 5, technicalProblem: false }, post);
    expect(out).toBe("sent");
    expect(post).toHaveBeenCalledWith("tok", "/exam/feedback", { overall: 5, clarity: null, usability: null, technicalProblem: false, comment: null });
  });

  it("sends nothing without the one required answer", async () => {
    const post = vi.fn();
    expect(await submitFeedback("tok", { ...EMPTY_FEEDBACK, comment: "only words" }, post)).toBe("incomplete");
    expect(post).not.toHaveBeenCalled();
  });

  it("reports failed for any send that did not arrive, never sent", async () => {
    expect(await submitFeedback("tok", { ...EMPTY_FEEDBACK, overall: 3 }, async () => Promise.reject(new Error("offline")))).toBe("failed");
  });
});

describe("every candidate language", () => {
  it.each(CANDIDATE_LOCALES)("%s renders the empty and the rated card with its own words and no raw keys", (locale) => {
    const t = candidateT(locale);
    for (const html of [card({ locale }), card({ locale, draft: { overall: 3 } })]) {
      expect(html).toContain(t("feedback.title"));
      expect(html).toContain(t("feedback.overallLabel"));
      expect(html).not.toMatch(/feedback\.[a-zA-Z]+/);
      expect(html).not.toContain("\u2014");
    }
    expect(card({ locale, draft: { overall: 3 } })).toContain(t("feedback.technicalLabel"));
    expect(card({ locale, phase: "sent" })).toContain(t("feedback.thanks"));
  });

  it("does not ship an English sentence to the other languages", () => {
    const english = card({ locale: "en" });
    for (const locale of CANDIDATE_LOCALES.filter((l) => l !== "en")) {
      const html = card({ locale, draft: { overall: 3 } });
      expect(html, locale).not.toContain("Rate the exam");
      expect(html, locale).not.toContain("How would you rate");
      expect(html, locale).not.toBe(english);
    }
  });

  it("speaks formally: Sie in German, usted in Spanish, siz in Turkish", () => {
    expect(candidateT("de")("feedback.intro")).toMatch(/\bIhre\b/);
    expect(candidateT("es")("feedback.intro")).toMatch(/\bSu\b|\bsu\b/);
    expect(candidateT("tr")("feedback.technicalLabel")).toMatch(/yaşadınız/);
    expect(candidateT("de")("feedback.overallLabel")).toMatch(/\bSie\b/);
    expect(candidateT("es")("feedback.overallLabel")).toMatch(/valora\b/);
  });
});
