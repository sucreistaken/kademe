import { describe, expect, it } from "vitest";
import { SEED_BANK } from "./index";
import {
  LISTENING_RF,
  LISTENING_RFN,
  READING_RF,
  READING_RFN,
  READING_YES_NO,
  READING_YES_NO_NOT_SAID,
} from "./instructions";
import type { SeedItem } from "./types";

/**
 * The instruction line of every task follows the house style in instructions.ts: formal Sie, the answer
 * words of the screen, no drag wording, counts that are true.
 */

const tasks = SEED_BANK.items.filter((i) => i.section === "GRAMMAR" || i.section === "READING" || i.section === "LISTENING");
const where = (i: SeedItem) => `${i.level} ${i.section} ${i.skillTag}: ${i.prompt.slice(0, 70)}`;

const NUMBERS: Record<string, number> = { ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7 };

describe("instructions: true/false tasks", () => {
  const tfng = tasks.filter((i) => i.content.kind === "TFNG");

  it("every set uses the standard instruction of its wording, or a custom one that names the reading or listening and ends in 'Kreuzen Sie ... an.'", () => {
    const custom = /^(Lesen|Hören) Sie .*Kreuzen Sie .* an\.$/u;
    const bad = tfng
      .filter((i) => {
        if (i.content.kind !== "TFNG") return false;
        const standard =
          i.content.wording === "JA_NEIN"
            ? i.content.twoWay
              ? [READING_YES_NO]
              : [READING_YES_NO_NOT_SAID]
            : i.content.twoWay
              ? [READING_RF, LISTENING_RF]
              : [READING_RFN, LISTENING_RFN];
        return !standard.includes(i.prompt) && !custom.test(i.prompt);
      })
      .map(where);
    expect(bad).toEqual([]);
  });

  it("a listening set says Hören, a reading set says Lesen", () => {
    const wrong = tfng
      .filter((i) => !i.prompt.startsWith(i.section === "LISTENING" ? "Hören Sie" : "Lesen Sie"))
      .map(where);
    expect(wrong).toEqual([]);
  });
});

describe("instructions: the words of the screen", () => {
  it("names no answer by its stored letter (R, F, NG) and never asks to drag", () => {
    // The first paragraph is the instruction; a text after it may talk about moving house ("ziehen ... um").
    const hits = tasks
      .filter((i) => /\((?:R|F|NG)\)|\bziehen\b|\bziehe\b|\bdrag/iu.test(i.prompt.split("\n\n")[0]))
      .map(where);
    expect(hits).toEqual([]);
  });

  it("a tick-n item leaves 'Kreuzen Sie n Antworten an.' to the screen, which adds it", () => {
    const doubled = SEED_BANK.items
      .filter((i) => i.content.kind === "CHOICE" && i.content.pick !== undefined && /Kreuzen Sie/u.test(i.prompt))
      .map(where);
    expect(doubled).toEqual([]);
  });

  it("every matching task has an instruction: a verb first or a who/which question", () => {
    const bad = tasks
      .filter((i) => i.content.kind === "MATCHING")
      .filter((i) => !/^(Lesen|Hören|Wer|Welch)\p{L}*\b/u.test(i.prompt))
      .map(where);
    expect(bad).toEqual([]);
  });
});

describe("instructions: the counts they state are true", () => {
  const matching = tasks.filter((i) => i.content.kind === "MATCHING" && i.key.kind === "MATCHING");

  it('"nur einmal" means no target is used twice', () => {
    const bad = matching
      .filter((i) => /passt nur einmal/u.test(i.prompt))
      .filter((i) => {
        if (i.key.kind !== "MATCHING") return false;
        const used = Object.values(i.key.pairs);
        return new Set(used).size !== used.length;
      })
      .map(where);
    expect(bad).toEqual([]);
  });

  it('"Zwei Sätze passen nicht" / "Drei Überschriften bleiben übrig" match the targets nobody needs', () => {
    const spare = /(Ein|Eine|Zwei|Drei|Vier|Fünf)\s+\p{L}+\s+(?:bleibt|bleiben)\s+übrig|(Ein|Eine|Zwei|Drei|Vier|Fünf)\s+\p{L}+\s+(?:passt|passen)\s+nicht/u;
    const bad: string[] = [];
    for (const i of matching) {
      const m = spare.exec(i.prompt);
      if (!m || i.content.kind !== "MATCHING" || i.key.kind !== "MATCHING") continue;
      const stated = NUMBERS[(m[1] ?? m[2]).toLowerCase()];
      const actual = i.content.right.length - new Set(Object.values(i.key.pairs)).size;
      if (stated !== actual) bad.push(`${where(i)} (says ${stated}, key leaves ${actual})`);
    }
    expect(bad).toEqual([]);
  });

  it('"Fünf Sätze fehlen" matches the number of gaps', () => {
    const bad: string[] = [];
    for (const i of matching) {
      const m = /(Zwei|Drei|Vier|Fünf|Sechs)\s+(?:Sätze|Absätze)\s+fehlen/u.exec(i.prompt);
      if (!m || i.content.kind !== "MATCHING") continue;
      if (NUMBERS[m[1].toLowerCase()] !== i.content.left.length) bad.push(where(i));
    }
    expect(bad).toEqual([]);
  });
});
