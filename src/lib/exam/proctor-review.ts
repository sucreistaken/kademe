import { z } from "zod";
import type { AiMessage } from "@/lib/ai";
import { parseModelJson, zodProblem } from "./grading";

/**
 * A second look by a vision model at the frames around a proctoring flag.
 * Pure: prompt, schema, parsing and a deterministic consistency check.
 *
 * The model reports observable facts per frame and says whether the frames
 * show what the flag claims. It never judges the person. The teacher decides;
 * this only helps order the queue and saves looking at frames that plainly
 * show nothing.
 */

export type FrameKind = "WEBCAM" | "SCREEN";
export type ReviewLocale = "tr" | "en";

export const VERDICTS = ["CONFIRMED", "NOT_CONFIRMED", "UNCLEAR"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Said in the prompt, word for word, and asserted by the tests. */
export const FORBIDDEN_INFERENCE =
  "NEVER infer emotion, stress, honesty, intent, identity, ethnicity, age, gender or any other personal attribute.";

/** What each reviewable flag claims, in terms of frame facts. */
export const CLAIMS: Record<string, string> = {
  MULTIPLE_FACES: "more than one person is visible in a webcam frame",
  NO_FACE: "no face is visible in a webcam frame",
  PHONE_DETECTED: "a phone or other device is visible in a webcam frame",
  TAB_HIDDEN: "a screen frame shows non-exam content",
  FOCUS_LOST: "a screen frame shows non-exam content",
  SECOND_SCREEN_DETECTED: "a screen frame shows non-exam content",
};

const SCREEN_EVENTS = new Set(["TAB_HIDDEN", "FOCUS_LOST", "SECOND_SCREEN_DETECTED"]);

/** The provider sends a string; the stored value is boolean or null. */
const screenContent = z
  .union([z.boolean(), z.null(), z.enum(["YES", "NO", "NOT_APPLICABLE"])])
  .optional()
  .transform((v): boolean | null => (v === true || v === "YES" ? true : v === false || v === "NO" ? false : null));

const frameSchema = z.object({
  index: z.number().int(),
  personCount: z.number().int().min(0).max(50),
  faceVisible: z.boolean(),
  phoneOrDeviceVisible: z.boolean(),
  lookingAwayFromScreen: z.boolean(),
  nonExamContentOnScreen: screenContent,
  notes: z.string().max(1000).default(""),
});

export const proctorReviewSchema = z.object({
  frames: z.array(frameSchema).min(1).max(50),
  verdict: z.enum(VERDICTS),
  summary: z.string().max(2000),
});

export type ProctorFrameFacts = z.infer<typeof frameSchema>;
export type ProctorReview = z.infer<typeof proctorReviewSchema>;

/**
 * Provider schema. `nonExamContentOnScreen` is an enum rather than a nullable
 * boolean because neither a type union nor `nullable` works on both the
 * OpenAI strict and the Gemini path.
 */
export const PROCTOR_REVIEW_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["frames", "verdict", "summary"],
  properties: {
    frames: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "index",
          "personCount",
          "faceVisible",
          "phoneOrDeviceVisible",
          "lookingAwayFromScreen",
          "nonExamContentOnScreen",
          "notes",
        ],
        properties: {
          index: { type: "integer" },
          personCount: { type: "integer" },
          faceVisible: { type: "boolean" },
          phoneOrDeviceVisible: { type: "boolean" },
          lookingAwayFromScreen: { type: "boolean" },
          nonExamContentOnScreen: { type: "string", enum: ["YES", "NO", "NOT_APPLICABLE"] },
          notes: { type: "string" },
        },
      },
    },
    verdict: { type: "string", enum: [...VERDICTS] },
    summary: { type: "string" },
  },
};

export type ProctorReviewInput = {
  eventType: string;
  frameKinds: FrameKind[];
  locale: ReviewLocale;
};

export function buildProctorReviewMessages(input: ProctorReviewInput): AiMessage[] {
  const language = input.locale === "tr" ? "Turkish" : "English";
  const claim = CLAIMS[input.eventType];
  const system = [
    "You check exam proctoring frames for observable facts only. The frames are images attached to this conversation, numbered from 0 in the order they are attached.",
    "",
    "For every frame report:",
    "- personCount: how many people are visible.",
    "- faceVisible: whether a face is visible.",
    "- phoneOrDeviceVisible: whether a phone, tablet, second computer or similar device is visible.",
    "- lookingAwayFromScreen: whether the person is clearly turned or looking away from the screen.",
    "- nonExamContentOnScreen, for SCREEN frames only: YES if any non-exam application is visible (translator, AI chat, search engine, notes, messaging or anything else that is not the exam page), NO if only the exam is visible. For WEBCAM frames always NOT_APPLICABLE.",
    "- For a SCREEN frame set personCount to 0 and the three person fields to false.",
    `- notes: at most one short factual sentence in ${language}, describing only what is visible.`,
    "",
    FORBIDDEN_INFERENCE,
    "Do not describe the person's appearance, clothing, surroundings beyond what the facts need, or what they might be thinking or doing off camera.",
    "",
    "The verdict answers only whether the frames show what the flag claims:",
    "- MULTIPLE_FACES: more than one person visible. NO_FACE: no face visible. PHONE_DETECTED: a device visible.",
    "- TAB_HIDDEN, FOCUS_LOST, SECOND_SCREEN_DETECTED: a screen frame shows non-exam content.",
    "- CONFIRMED if at least one frame clearly shows it, NOT_CONFIRMED if the frames clearly do not, UNCLEAR if the frames are too dark, blurred, cropped or do not cover it. For any other flag the verdict is UNCLEAR.",
    `- summary: one or two factual sentences in ${language}.`,
    "Never use the em dash character.",
    "Answer with a single JSON object that matches the schema. No code fence, no commentary.",
  ].join("\n");

  const user = [
    `Flag: ${input.eventType}`,
    claim ? `The flag claims: ${claim}.` : "This flag has no visual claim to check; the verdict is UNCLEAR.",
    `Frames attached: ${input.frameKinds.length}`,
    ...input.frameKinds.map((kind, i) => `- frame ${i}: ${kind}`),
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export type ProctorParseResult = { ok: true; review: ProctorReview } | { ok: false; error: string };

export function parseProctorReview(text: string, frameCount: number): ProctorParseResult {
  const json = parseModelJson(text);
  if (!json.ok) return json;
  const parsed = proctorReviewSchema.safeParse(json.json);
  if (!parsed.success) return { ok: false, error: zodProblem(parsed.error) };

  const indices = parsed.data.frames.map((f) => f.index);
  const outOfRange = indices.filter((i) => i < 0 || i >= frameCount);
  if (outOfRange.length)
    return { ok: false, error: `frame indices out of range 0..${frameCount - 1}: ${outOfRange.join(", ")}` };
  if (new Set(indices).size !== indices.length) return { ok: false, error: "a frame index repeats" };

  return {
    ok: true,
    review: {
      frames: [...parsed.data.frames]
        .sort((a, b) => a.index - b.index)
        .map((f) => ({ ...f, notes: f.notes.trim().slice(0, 300) })),
      verdict: parsed.data.verdict,
      summary: parsed.data.summary.trim(),
    },
  };
}

/**
 * Whether the frame facts show what the flag claims, decided without the
 * model's verdict. Null when the facts cannot answer it: an unknown flag, no
 * frames, or a screen flag without a screen frame. `frameKinds` (by index)
 * keeps screen frames out of the person checks when it is known.
 */
export function verdictMatchesClaim(
  eventType: string,
  frames: ProctorFrameFacts[],
  frameKinds?: FrameKind[],
): boolean | null {
  // Without kinds, a frame that answered the screen question is a screen frame.
  const isScreen = (f: ProctorFrameFacts): boolean => {
    const kind = frameKinds?.[f.index];
    return kind ? kind === "SCREEN" : f.nonExamContentOnScreen !== null;
  };
  const webcam = frames.filter((f) => !isScreen(f));

  switch (eventType) {
    case "MULTIPLE_FACES":
      return webcam.length ? webcam.some((f) => f.personCount >= 2) : null;
    case "NO_FACE":
      return webcam.length ? webcam.some((f) => !f.faceVisible) : null;
    case "PHONE_DETECTED":
      return webcam.length ? webcam.some((f) => f.phoneOrDeviceVisible) : null;
    default:
      if (SCREEN_EVENTS.has(eventType)) {
        const screen = frames.filter((f) => isScreen(f) && f.nonExamContentOnScreen !== null);
        return screen.length ? screen.some((f) => f.nonExamContentOnScreen === true) : null;
      }
      return null;
  }
}

/**
 * The model's verdict, unless the facts it reported disagree with it; then
 * UNCLEAR, because one of the two is wrong and a person has to look.
 */
export function reconcileVerdict(
  review: ProctorReview,
  eventType: string,
  frameKinds?: FrameKind[],
): { verdict: Verdict; downgraded: boolean } {
  if (review.verdict === "UNCLEAR") return { verdict: "UNCLEAR", downgraded: false };
  const facts = verdictMatchesClaim(eventType, review.frames, frameKinds);
  const consistent = facts !== null && (review.verdict === "CONFIRMED") === facts;
  return consistent
    ? { verdict: review.verdict, downgraded: false }
    : { verdict: "UNCLEAR", downgraded: true };
}
