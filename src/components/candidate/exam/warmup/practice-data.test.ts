import { describe, expect, it } from "vitest";
import { SECTIONS, TEXT_GAP_KINDS } from "@/lib/exam/types";
import { itemProblems } from "@/lib/exam/validate";
import { hintOf, PRACTICE, practiceFor, practiceItem } from "./practice-data";

describe("warm-up practice data", () => {
  it("has a practice for every section", () => {
    for (const s of SECTIONS) expect(PRACTICE[s].length, s).toBeGreaterThan(0);
  });

  it("passes the same structural checks as a bank item", () => {
    for (const s of SECTIONS) {
      PRACTICE[s].forEach((def, i) => expect(itemProblems(def), `${s} ${i}`).toEqual([]));
    }
    // The text samples follow the rules of their kind: four cloze choices, a word bank with enough distractors.
    practiceFor("GRAMMAR", TEXT_GAP_KINDS).forEach((def, i) => expect(itemProblems(def), `GRAMMAR text ${i}`).toEqual([]));
  });

  it("follows the agreed shapes", () => {
    expect(PRACTICE.GRAMMAR.map((d) => d.type)).toEqual(["SINGLE_CHOICE"]);
    // After the choice question a text section practises each kind of text it holds, three gaps each.
    expect(practiceFor("GRAMMAR", ["CLOZE", "WORDBANK"]).map((d) => d.type)).toEqual(["SINGLE_CHOICE", "GAP_FILL", "GAP_FILL"]);
    for (const def of practiceFor("GRAMMAR", TEXT_GAP_KINDS).slice(1)) expect(def.content.kind === "GAP" && def.content.gaps.length).toBe(3);
    expect(practiceFor("GRAMMAR")).toBe(PRACTICE.GRAMMAR);
    expect(practiceFor("READING", ["CLOZE"])).toBe(PRACTICE.READING);
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
    const ctest = practiceItem("GRAMMAR", 1, ["CTEST"]);
    expect(ctest.content.kind === "GAP" && ctest.content.attached).toBe(true);
    expect(ctest.content.kind === "GAP" && ctest.content.pool?.length).toBeGreaterThan(0);
    const cloze = practiceItem("GRAMMAR", 1, ["CLOZE"]);
    expect(cloze.content.kind === "GAP" && cloze.content.cloze).toBe(true);
    expect(cloze.content.kind === "GAP" && cloze.content.gaps.every((g) => g.choices?.length === 4)).toBe(true);
    const bank = practiceItem("GRAMMAR", 1, ["WORDBANK"]);
    expect(bank.content.kind === "GAP" && bank.content.attached).toBeUndefined();
    // Three answers and three distractors, as whole words.
    expect(bank.content.kind === "GAP" && bank.content.pool?.length).toBe(6);
    expect(JSON.stringify([cloze, bank])).not.toContain('"key"');
  });

  it("names the hint from what the step shows", () => {
    expect(PRACTICE.GRAMMAR.map(hintOf)).toEqual(["choice"]);
    expect(practiceFor("GRAMMAR", ["CLOZE", "WORDBANK"]).map(hintOf)).toEqual(["choice", "cloze", "wordbank"]);
    expect(practiceFor("GRAMMAR", ["CTEST"]).map(hintOf)).toEqual(["choice", "ctest"]);
    expect(practiceFor("GRAMMAR", ["OPEN"]).map(hintOf)).toEqual(["choice", "open"]);
    expect(PRACTICE.READING.map(hintOf)).toEqual(["tfng", "matching"]);
    expect(PRACTICE.LISTENING.map(hintOf)).toEqual(["listening"]);
    expect(PRACTICE.WRITING.map(hintOf)).toEqual(["writing"]);
    expect(PRACTICE.SPEAKING.map(hintOf)).toEqual(["speaking"]);
  });
});
