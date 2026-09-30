import { describe, expect, it } from "vitest";
import { toGeminiSchema } from "@/lib/ai";
import {
  FORBIDDEN_INFERENCE,
  PROCTOR_REVIEW_JSON_SCHEMA,
  buildProctorReviewMessages,
  parseProctorReview,
  reconcileVerdict,
  verdictMatchesClaim,
  type ProctorFrameFacts,
  type ProctorReview,
} from "./proctor-review";

const EM_DASH = "\u2014";

const webcam = (index: number, over: Partial<ProctorFrameFacts> = {}): ProctorFrameFacts => ({
  index,
  personCount: 1,
  faceVisible: true,
  phoneOrDeviceVisible: false,
  lookingAwayFromScreen: false,
  nonExamContentOnScreen: null,
  notes: "",
  ...over,
});

const screen = (index: number, nonExam: boolean): ProctorFrameFacts => ({
  index,
  personCount: 0,
  faceVisible: false,
  phoneOrDeviceVisible: false,
  lookingAwayFromScreen: false,
  nonExamContentOnScreen: nonExam,
  notes: "",
});

const wireFrame = (index: number, nonExam: "YES" | "NO" | "NOT_APPLICABLE" = "NOT_APPLICABLE") => ({
  index,
  personCount: 1,
  faceVisible: true,
  phoneOrDeviceVisible: false,
  lookingAwayFromScreen: false,
  nonExamContentOnScreen: nonExam,
  notes: "  Eine Person sitzt vor dem Bildschirm.  ",
});

describe("parseProctorReview", () => {
  it("parses, sorts frames and maps the screen enum", () => {
    const text = JSON.stringify({
      frames: [wireFrame(1, "YES"), wireFrame(0)],
      verdict: "CONFIRMED",
      summary: " ok ",
    });
    const r = parseProctorReview("```json\n" + text + "\n```", 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.review.frames.map((f) => f.index)).toEqual([0, 1]);
    expect(r.review.frames[0].nonExamContentOnScreen).toBeNull();
    expect(r.review.frames[1].nonExamContentOnScreen).toBe(true);
    expect(r.review.frames[0].notes).toBe("Eine Person sitzt vor dem Bildschirm.");
    expect(r.review.summary).toBe("ok");
  });

  it("accepts plain boolean or null for the screen field", () => {
    const text = JSON.stringify({
      frames: [{ ...wireFrame(0), nonExamContentOnScreen: false }, { ...wireFrame(1), nonExamContentOnScreen: null }],
      verdict: "UNCLEAR",
      summary: "",
    });
    const r = parseProctorReview(text, 2);
    expect(r.ok && r.review.frames.map((f) => f.nonExamContentOnScreen)).toEqual([false, null]);
  });

  it("rejects indices out of range, repeated indices, bad verdicts and broken JSON", () => {
    const make = (frames: unknown[], verdict = "CONFIRMED") => JSON.stringify({ frames, verdict, summary: "" });
    expect(parseProctorReview(make([wireFrame(2)]), 2).ok).toBe(false);
    expect(parseProctorReview(make([wireFrame(-1)]), 2).ok).toBe(false);
    expect(parseProctorReview(make([wireFrame(0), wireFrame(0)]), 2).ok).toBe(false);
    expect(parseProctorReview(make([wireFrame(0)], "GUILTY"), 1).ok).toBe(false);
    expect(parseProctorReview(make([]), 1).ok).toBe(false);
    expect(parseProctorReview("nope", 1).ok).toBe(false);
  });
});

describe("verdictMatchesClaim", () => {
  it("MULTIPLE_FACES needs a frame with two or more people", () => {
    expect(verdictMatchesClaim("MULTIPLE_FACES", [webcam(0), webcam(1, { personCount: 2 })])).toBe(true);
    expect(verdictMatchesClaim("MULTIPLE_FACES", [webcam(0), webcam(1)])).toBe(false);
  });

  it("NO_FACE and PHONE_DETECTED look at webcam frames only", () => {
    expect(verdictMatchesClaim("NO_FACE", [webcam(0), screen(1, false)])).toBe(false);
    expect(verdictMatchesClaim("NO_FACE", [webcam(0, { faceVisible: false, personCount: 0 })])).toBe(true);
    expect(verdictMatchesClaim("PHONE_DETECTED", [webcam(0, { phoneOrDeviceVisible: true })])).toBe(true);
    expect(verdictMatchesClaim("PHONE_DETECTED", [screen(0, true)])).toBeNull();
  });

  it("screen flags need a screen frame with non-exam content", () => {
    expect(verdictMatchesClaim("TAB_HIDDEN", [webcam(0), screen(1, true)])).toBe(true);
    expect(verdictMatchesClaim("FOCUS_LOST", [screen(0, false)])).toBe(false);
    expect(verdictMatchesClaim("SECOND_SCREEN_DETECTED", [webcam(0)])).toBeNull();
  });

  it("uses frame kinds when given", () => {
    // A frame the model left NOT_APPLICABLE but which is a screen frame is not a webcam frame.
    const f = webcam(0, { faceVisible: false, personCount: 0 });
    expect(verdictMatchesClaim("NO_FACE", [f], ["SCREEN"])).toBeNull();
    expect(verdictMatchesClaim("NO_FACE", [f], ["WEBCAM"])).toBe(true);
  });

  it("returns null for flags without a visual claim and for no frames", () => {
    expect(verdictMatchesClaim("COPY_ATTEMPT", [webcam(0)])).toBeNull();
    expect(verdictMatchesClaim("MULTIPLE_FACES", [])).toBeNull();
  });
});

describe("reconcileVerdict", () => {
  const review = (verdict: ProctorReview["verdict"], frames: ProctorFrameFacts[]): ProctorReview => ({
    frames,
    verdict,
    summary: "",
  });

  it("keeps a verdict the facts support", () => {
    expect(reconcileVerdict(review("CONFIRMED", [webcam(0, { personCount: 3 })]), "MULTIPLE_FACES")).toEqual({
      verdict: "CONFIRMED",
      downgraded: false,
    });
    expect(reconcileVerdict(review("NOT_CONFIRMED", [webcam(0)]), "MULTIPLE_FACES").verdict).toBe(
      "NOT_CONFIRMED",
    );
  });

  it("downgrades an inconsistent verdict to UNCLEAR", () => {
    expect(reconcileVerdict(review("CONFIRMED", [webcam(0)]), "MULTIPLE_FACES")).toEqual({
      verdict: "UNCLEAR",
      downgraded: true,
    });
    expect(reconcileVerdict(review("NOT_CONFIRMED", [webcam(0, { phoneOrDeviceVisible: true })]), "PHONE_DETECTED").verdict).toBe(
      "UNCLEAR",
    );
    expect(reconcileVerdict(review("CONFIRMED", [webcam(0)]), "TAB_HIDDEN").verdict).toBe("UNCLEAR");
  });

  it("leaves UNCLEAR alone", () => {
    expect(reconcileVerdict(review("UNCLEAR", [webcam(0, { personCount: 2 })]), "MULTIPLE_FACES")).toEqual({
      verdict: "UNCLEAR",
      downgraded: false,
    });
  });
});

describe("buildProctorReviewMessages", () => {
  it("states the forbidden inferences, the claim, the frames and the locale, with no em dash", () => {
    const msgs = buildProctorReviewMessages({
      eventType: "TAB_HIDDEN",
      frameKinds: ["WEBCAM", "SCREEN"],
      locale: "tr",
    });
    expect(msgs.map((m) => m.role)).toEqual(["system", "user"]);
    expect(msgs[0].content).toContain(FORBIDDEN_INFERENCE);
    expect(msgs[0].content).toContain("NEVER infer emotion, stress, honesty, intent, identity, ethnicity, age, gender");
    expect(msgs[0].content).toContain("Turkish");
    expect(msgs[0].content).toContain("translator, AI chat, search engine, notes, messaging");
    expect(msgs[1].content).toContain("non-exam content");
    expect(msgs[1].content).toContain("frame 1: SCREEN");
    expect(msgs.map((m) => m.content).join("\n")).not.toContain(EM_DASH);
  });

  it("the schema survives the Gemini conversion", () => {
    const text = JSON.stringify(toGeminiSchema(PROCTOR_REVIEW_JSON_SCHEMA));
    expect(text).not.toMatch(/oneOf|anyOf|additionalProperties/);
    expect(text).toContain("NOT_APPLICABLE");
  });
});
