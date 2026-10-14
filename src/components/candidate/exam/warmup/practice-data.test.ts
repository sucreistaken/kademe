import { describe, expect, it } from "vitest";
import { SECTIONS } from "@/lib/exam/types";
import { itemProblems } from "@/lib/exam/validate";
import { hintOf, PRACTICE, practiceItem } from "./practice-data";

describe("warm-up practice data", () => {
  it("has a practice for every section", () => {
    for (const s of SECTIONS) expect(PRACTICE[s].length, s).toBeGreaterThan(0);
  });

  it("passes the same structural checks as a bank item", () => {
    for (const s of SECTIONS) {
      PRACTICE[s].forEach((def, i) => expect(itemProblems(def), `${s} ${i}`).toEqual([]));
    }
  });

  it("follows the agreed shapes", () => {
    expect(PRACTICE.GRAMMAR.map((d) => d.type)).toEqual(["SINGLE_CHOICE", "GAP_FILL"]);
    const ctest = PRACTICE.GRAMMAR[1];
    expect(ctest.content.kind === "GAP" && ctest.content.gaps.length).toBe(3);
    expect(PRACTICE.READING.map((d) => d.type)).toEqual(["TRUE_FALSE_NG", "MATCHING"]);
    const tfng = PRACTICE.READING[0];
    expect(tfng.content.kind === "TFNG" && tfng.content.statements.length).toBe(2);
    expect(tfng.passage?.body.split(/(?<=\.)\s/).length).toBe(3);
    const match = PRACTICE.READING[1];
    expect(match.content.kind === "MATCHING" && match.content.left.length).toBe(2);
    // Listening has no recording: a written sample of two sentences with the true/false controls.
    const l = PRACTICE.LISTENING[0];
    expect(l.content.kind).toBe("TFNG");
    expect(l.sample?.text.split(/(?<=\.)\s/).length).toBe(2);
    expect(PRACTICE.WRITING[0].content.kind).toBe("WRITING");
    expect(PRACTICE.SPEAKING[0].content.kind).toBe("SPEAKING");
  });

  it("is drawn by the real item components through the candidate whitelist", () => {
    for (const s of SECTIONS) {
      PRACTICE[s].forEach((_, i) => {
        const item = practiceItem(s, i);
        expect(item.stimulus).toBeNull();
        expect(item.answer).toBeNull();
        expect(JSON.stringify(item)).not.toContain('"key"');
      });
    }
    const ctest = practiceItem("GRAMMAR", 1);
    expect(ctest.content.kind === "GAP" && ctest.content.attached).toBe(true);
  });

  it("names the hint from what the step shows", () => {
    expect(PRACTICE.GRAMMAR.map(hintOf)).toEqual(["choice", "ctest"]);
    expect(PRACTICE.READING.map(hintOf)).toEqual(["tfng", "matching"]);
    expect(PRACTICE.LISTENING.map(hintOf)).toEqual(["listening"]);
    expect(PRACTICE.WRITING.map(hintOf)).toEqual(["writing"]);
    expect(PRACTICE.SPEAKING.map(hintOf)).toEqual(["speaking"]);
  });
});
