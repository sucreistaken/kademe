import { describe, expect, it } from "vitest";
import { validateItem } from "@/lib/exam/validate";
import { authorFor, choiceOptions, noParts, withParts } from "./author";
import { LISTENING_RF, LISTENING_RFN, READING_RF, READING_RFN, READING_YES_NO } from "./instructions";

describe("authoring helpers", () => {
  it("places the correct option and points the key at it", () => {
    for (const pos of [0, 1, 2, 3] as const) {
      const { content, key } = choiceOptions("richtig", ["a", "b", "c"], pos);
      expect(content.options[pos].text).toBe("richtig");
      expect(key.correct).toEqual([content.options[pos].id]);
    }
  });

  it("builds items that pass the engine's own validation", () => {
    const a = authorFor("B1");
    const text = a.text("probe", "Probe", "Test", "Ein kurzer Text.");
    const t = a.forText(text);
    const clip = a.clip("probe", "Probe", "Test", [{ label: "A", voice: "A" }], ["A: Hallo."]);
    const c = a.forClip(clip);
    const items = [
      t.choice("detail", "MID", "Frage?", "ja", ["nein", "vielleicht", "nie"], 2, "x"),
      t.tfng("detail", "MID", [["a", "R"], ["b", "F"]], "x"),
      t.yesNo("detail", "MID", [["Anna", "R"], ["Ben", "F"]], "x"),
      t.match("gist", "MID", "Welche passt?", ["Text 1", "Text 2"], ["A: eins", "B: zwei", "C: drei"], [2, 1], "x"),
      t.form("detail", "MID", "Lesen Sie den Text. Ergänzen Sie.\n\nName: {{g1}}\nTag: {{g2}}", [["Anna"], ["Montag", "am Montag"]], "x"),
      c.tfng("detail", "MID", [["a", "F"], ["b", "R"]], "x"),
      c.notes("notes", "MID", "Hören Sie die Nachricht. Ergänzen Sie die Notizen.\n\nTag: {{g1}}\nUhrzeit: {{g2}}", [["Montag"], ["14 Uhr"]], "x"),
      c.match("detail", "MID", "Wer sagt was?", ["Diese Person lacht.", "Diese Person weint."], ["Anna", "Ben", "Keine Person"], [1, 3], "x"),
      c.pick("detail", "MID", "Was ist dabei?", ["a1", "b1", "c1", "d1", "e1", "f1"], [0, 2, 4], "x"),
    ];
    for (const item of items) expect(validateItem(item), item.prompt).toEqual([]);
  });

  it("fills the standard instruction line by level and section", () => {
    const rf = (level: "A2" | "B2", reading: boolean) => {
      const a = authorFor(level);
      if (reading) return a.forText(a.text("x", "x", "x", "x")).tfng("detail", "MID", [["a", "R"]], "x").prompt;
      return a.forClip(a.clip("x", "x", "x", [{ label: "A", voice: "A" }], ["A: x"])).tfng("detail", "MID", [["a", "R"]], "x").prompt;
    };
    expect(rf("A2", true)).toBe(READING_RF);
    expect(rf("A2", false)).toBe(LISTENING_RF);
    expect(rf("B2", true)).toBe(READING_RFN);
    expect(rf("B2", false)).toBe(LISTENING_RFN);
    const b1 = authorFor("B1");
    expect(b1.forText(b1.text("y", "y", "y", "y")).yesNo("detail", "MID", [["Anna", "R"]], "x").prompt).toBe(READING_YES_NO);
  });

  it("refuses what the bank rules forbid", () => {
    const a1 = authorFor("A1");
    const t = a1.forText(a1.text("x", "x", "x", "x"));
    expect(() => t.tfng("detail", "MID", [["a", "NG"]], "x")).toThrow(/nicht im Text/);
    expect(() => t.yesNo("detail", "MID", [["Anna", "R"]], "x")).toThrow(/Ja \/ Nein/);
    expect(() => a1.clip("x", "x", "x", [{ label: "A", voice: "A" }], ["A: x"], 1)).toThrow(/B2/);
    const b2 = authorFor("B2");
    const c = b2.forClip(b2.clip("x", "x", "x", [{ label: "A", voice: "A" }], ["A: x"], 1));
    expect(() => c.pick("detail", "MID", "q", ["a", "b", "c", "d"], [0, 1], "x")).toThrow(/6 to 8/);
    expect(() => c.match("detail", "MID", "q", ["a"], ["x", "y"], [3], "x")).toThrow(/outside/);
  });

  it("merges parts section by section", () => {
    const a = authorFor("A1");
    const extra = noParts();
    extra.writing.items.push(a.writing("message", "EASY", [20, 45], "p", ["c"], ["s", "t"], "informell (du)", "e"));
    const merged = withParts(noParts(), extra);
    expect(merged.writing.items).toHaveLength(1);
    expect(merged.reading.items).toHaveLength(0);
  });
});
