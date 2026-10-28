import { describe, expect, it } from "vitest";
import { MASCOT_LINE_MAX, bubbleState, isTalking, lettersShown, mascotLine, typingStepMs } from "./mascot-line";

describe("what the mascot says", () => {
  it("is the first sentence of the task", () => {
    expect(mascotLine("Stellen Sie sich bitte vor. Sagen Sie Ihren Namen und woher Sie kommen.")).toBe("Stellen Sie sich bitte vor.");
    expect(mascotLine("Sie sind im Büro. Ihr Kollege Herr Braun hat einen Kuli.\n\nBitten Sie Herrn Braun um den Kuli.")).toBe("Sie sind im Büro.");
  });

  it("skips the topic and the card line, which the card shows in its own boxes", () => {
    const prompt = 'Thema: Arbeit. Auf Ihrer Karte steht: „Mittagspause“.\n\nStellen Sie einer Kollegin eine Frage mit diesem Wort. Antworten Sie dann selbst.';
    expect(mascotLine(prompt)).toBe("Stellen Sie einer Kollegin eine Frage mit diesem Wort.");
  });

  it("keeps a lead-in that ends in a colon as it is, and a question mark or a quote with its sentence", () => {
    expect(mascotLine("Erzählen Sie von Ihrer Wohnung oder Ihrem Zimmer:\n- Wo wohnen Sie?\n- Wie groß ist es?")).toBe("Erzählen Sie von Ihrer Wohnung oder Ihrem Zimmer:");
    expect(mascotLine("Wohnen Sie lieber in der Stadt oder auf dem Land? Begründen Sie.")).toBe("Wohnen Sie lieber in der Stadt oder auf dem Land?");
    expect(mascotLine('Ein Kollege sagt: „Das ist gut. Das ist neu.“ Was meinen Sie?')).toBe('Ein Kollege sagt: „Das ist gut. Das ist neu.“');
  });

  it("falls back to the card, then the topic, when the prompt has no running text", () => {
    expect(mascotLine('Thema: Freizeit.\nAuf Ihrer Karte steht: „Hobbys“')).toBe("Hobbys");
    expect(mascotLine("Thema: Freizeit.")).toBe("Freizeit");
  });

  it("is null when there is nothing to say, so the screen shows no mascot", () => {
    expect(mascotLine("")).toBeNull();
    expect(mascotLine("  \n \n")).toBeNull();
  });

  it("cuts a long sentence at a word and marks the cut, so the bubble stays short", () => {
    const long = "Halten Sie einen kurzen Vortrag zum Thema „Lebenslanges Lernen im Beruf“ und gehen Sie dabei auf die vier Punkte ein, die Sie auf der Karte sehen, ohne etwas abzulesen.";
    const line = mascotLine(long);
    expect(line).not.toBeNull();
    expect(line!.length).toBeLessThanOrEqual(MASCOT_LINE_MAX);
    expect(line!.endsWith("…")).toBe(true);
    // The part that is kept is the start of the sentence, whole words only (a comma at the cut is dropped).
    const kept = line!.slice(0, -1);
    expect(long.startsWith(kept)).toBe(true);
    expect(long.charAt(kept.length)).toMatch(/[ ,;:.]/);
    expect(kept).not.toMatch(/[\s,;:.]$/);
  });

  it("leaves a sentence of the limit's length alone", () => {
    const exact = `${"a".repeat(MASCOT_LINE_MAX - 1)}.`;
    expect(exact).toHaveLength(MASCOT_LINE_MAX);
    expect(mascotLine(exact)).toBe(exact);
  });

  it("says the same words the card shows: no line of a real prompt gains a word", () => {
    const prompt = "Sie sollen am Samstag arbeiten, aber an diesem Tag haben Sie einen wichtigen Termin. Sprechen Sie mit Ihrem Chef.";
    expect(prompt.startsWith(mascotLine(prompt) ?? "")).toBe(true);
  });
});

describe("typing the line in", () => {
  it("takes a calm 38 ms a letter for a short line and never more than 4.5 s for a long one", () => {
    expect(typingStepMs(27)).toBe(38);
    expect(typingStepMs(100)).toBe(38);
    expect(typingStepMs(120)).toBeCloseTo(37.5, 5);
    expect(typingStepMs(300) * 300).toBeCloseTo(4500, 5);
    for (const n of [1, 27, 80, MASCOT_LINE_MAX, 400]) expect(typingStepMs(n) * n).toBeLessThanOrEqual(4500 + 1e-9);
  });

  it("has no step for an empty line", () => {
    expect(typingStepMs(0)).toBe(0);
  });

  it("shows no more letters than the line has, and none before the first step", () => {
    expect(lettersShown(0, 10)).toBe(0);
    expect(lettersShown(4, 10)).toBe(4);
    expect(lettersShown(10, 10)).toBe(10);
    expect(lettersShown(99, 10)).toBe(10);
    expect(lettersShown(-3, 10)).toBe(0);
  });

  it("moves the mouth from the first letter until the last one is typed, then stops", () => {
    expect(isTalking(0, 10)).toBe(true);
    expect(isTalking(9, 10)).toBe(true);
    expect(isTalking(10, 10)).toBe(false);
    expect(isTalking(40, 10)).toBe(false);
    expect(isTalking(0, 0)).toBe(false);
  });
});

describe("what the bubble shows (reduced motion and the other phases)", () => {
  const base = { length: 27, talk: true, reducedMotion: false };

  it("types the line in while the student prepares: nothing at first, the mouth moving, the whole line at the end and the mouth shut", () => {
    expect(bubbleState({ ...base, typed: 0 })).toEqual({ shown: 0, talking: true });
    expect(bubbleState({ ...base, typed: 13 })).toEqual({ shown: 13, talking: true });
    expect(bubbleState({ ...base, typed: 26 })).toEqual({ shown: 26, talking: true });
    expect(bubbleState({ ...base, typed: 27 })).toEqual({ shown: 27, talking: false });
    expect(bubbleState({ ...base, typed: 500 })).toEqual({ shown: 27, talking: false });
  });

  it("under prefers-reduced-motion shows the whole line at once and never moves the mouth, whatever has been typed", () => {
    for (const typed of [0, 1, 13, 27]) {
      expect(bubbleState({ ...base, typed, reducedMotion: true }), String(typed)).toEqual({ shown: 27, talking: false });
    }
  });

  it("shows the whole line and a closed mouth once the student records or has recorded (talk off), even half way through typing", () => {
    for (const typed of [0, 5, 27]) {
      expect(bubbleState({ ...base, typed, talk: false }), String(typed)).toEqual({ shown: 27, talking: false });
    }
  });

  it("has nothing to move for an empty line", () => {
    expect(bubbleState({ length: 0, typed: 0, talk: true, reducedMotion: false })).toEqual({ shown: 0, talking: false });
  });
});
