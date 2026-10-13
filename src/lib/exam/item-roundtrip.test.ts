import { describe, expect, it, vi } from "vitest";

// sanitizeAnswer is pure; the database module is only loaded, never reached.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

import { sanitizeAnswer } from "@/lib/exam-flow";
import { mulberry32 } from "./adaptive";
import { scoreItem } from "./item-scoring";
import { makePresentation, toCandidateItem } from "./safe";
import type { ItemAnswer, ItemSnapshot } from "./types";

/**
 * What the browser sends back goes through the same path as in production:
 * toCandidateItem (what the student sees) -> an answer in the ids shown ->
 * sanitizeAnswer (unalias + whitelist, as the save and commit routes do) ->
 * scoreItem.
 */
const roundTrip = (snap: ItemSnapshot, seed: number, answerFor: (item: ReturnType<typeof toCandidateItem>) => ItemAnswer) => {
  const pres = makePresentation(snap, mulberry32(seed));
  const item = toCandidateItem(snap, pres, null, 1, { maxPlays: 2 });
  const stored = sanitizeAnswer(snap, JSON.parse(JSON.stringify(answerFor(item))), null, pres);
  return { pres, item, stored, score: scoreItem(snap.type, snap.content, snap.key, stored) };
};

const base = {
  id: "item-1",
  level: "B1" as const,
  difficulty: -0.5,
  stimulusId: null,
  orderInStimulus: 0,
  rubric: null,
  points: 1,
  stimulus: null,
};

const sentences: ItemSnapshot = {
  ...base,
  section: "READING",
  type: "MATCHING",
  skillTag: "reading.structure",
  prompt: "Welcher Satz passt in welche Lücke?",
  content: {
    kind: "MATCHING",
    left: [
      { id: "l1", text: "Lücke 1" },
      { id: "l2", text: "Lücke 2" },
      { id: "l3", text: "Lücke 3" },
    ],
    right: [
      { id: "r1", text: "Deshalb fahren viele mit dem Rad." },
      { id: "r2", text: "Das spart Zeit und Geld." },
      { id: "r3", text: "Am Ende waren alle zufrieden." },
      { id: "r4", text: "Niemand hatte damit gerechnet." },
    ],
  },
  key: { kind: "MATCHING", pairs: { l1: "r2", l2: "r4", l3: "r1" } },
};

const ads: ItemSnapshot = {
  ...sentences,
  prompt: "Welche Anzeige passt? Wenn keine Anzeige passt, wählen Sie „Keine Anzeige passt“.",
  content: {
    kind: "MATCHING",
    left: [
      { id: "l1", text: "Sie suchen einen Sprachkurs am Abend." },
      { id: "l2", text: "Sie möchten ein Fahrrad kaufen." },
    ],
    right: [
      { id: "r1", text: "Anzeige A" },
      { id: "r2", text: "Anzeige B" },
      { id: "r3", text: "Anzeige C" },
      { id: "r4", text: "Keine Anzeige passt" },
    ],
  },
  key: { kind: "MATCHING", pairs: { l1: "r3", l2: "r4" } },
};

const gaps: ItemSnapshot = {
  ...base,
  section: "GRAMMAR",
  type: "GAP_FILL",
  skillTag: "grammar.prepositions",
  prompt: "Ich fahre {{g1}} Bus und warte {{g2}} dich.",
  content: {
    kind: "GAP",
    gaps: [
      { id: "g1", choices: ["mit dem", "mit den", "mit der", "mit die"] },
      { id: "g2", choices: ["für", "auf", "an"] },
    ],
  },
  key: { kind: "GAP", answers: { g1: ["mit dem"], g2: ["auf"] } },
};

describe("matching: alias round trip", () => {
  it("scores 1 when every row is answered with the aliased id shown for the key", () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      const { pres, item, stored, score } = roundTrip(sentences, seed, (item) => {
        // The student picks by text; the browser only knows the aliased ids.
        const right = item.content.kind === "MATCHING" ? item.content.right : [];
        const idOf = (text: string) => right.find((r) => r.text === text)!.id;
        return {
          matches: {
            l1: idOf("Das spart Zeit und Geld."),
            l2: idOf("Niemand hatte damit gerechnet."),
            l3: idOf("Deshalb fahren viele mit dem Rad."),
          },
        };
      });
      const shown = item.content.kind === "MATCHING" ? item.content.right.map((r) => r.id) : [];
      expect(shown.some((id) => /^r\d$/.test(id))).toBe(false);
      expect(shown).toEqual((pres.order ?? []).map((id) => pres.alias![id]));
      expect(stored.matches).toEqual({ l1: "r2", l2: "r4", l3: "r1" });
      expect(score).toEqual({ score: 1, correct: true });
    }
  });

  it("drops a cleared row and unknown ids, and scores the rest per row", () => {
    const { stored, score } = roundTrip(sentences, 7, (item) => {
      const right = item.content.kind === "MATCHING" ? item.content.right : [];
      return { matches: { l1: right.find((r) => r.text === "Das spart Zeit und Geld.")!.id, l2: "", l3: "r1" } };
    });
    // "" and the bank's own id "r1" are not ids the student was shown.
    expect(stored.matches).toEqual({ l1: "r2" });
    expect(score!.score).toBeCloseTo(1 / 3);
  });

  it("keeps lettered targets in letter order, still aliased, and scores them", () => {
    const { pres, item, stored, score } = roundTrip(ads, 5, (item) => {
      const right = item.content.kind === "MATCHING" ? item.content.right : [];
      return {
        matches: {
          l1: right.find((r) => r.text === "Anzeige C")!.id,
          l2: right.find((r) => r.text === "Keine Anzeige passt")!.id,
        },
      };
    });
    expect(pres.order).toEqual(["r1", "r2", "r3", "r4"]);
    expect(item.content.kind === "MATCHING" && item.content.right.map((r) => r.text)).toEqual([
      "Anzeige A",
      "Anzeige B",
      "Anzeige C",
      "Keine Anzeige passt",
    ]);
    expect(item.content.kind === "MATCHING" && item.content.right.every((r) => r.id.startsWith("o"))).toBe(true);
    expect(stored.matches).toEqual({ l1: "r3", l2: "r4" });
    expect(score).toEqual({ score: 1, correct: true });
  });

  it("shows lettered targets in letter order even when an older presentation stored a shuffle", () => {
    const item = toCandidateItem(ads, { order: ["r3", "r1", "r4", "r2"] }, null, 1, { maxPlays: 2 });
    expect(item.content.kind === "MATCHING" && item.content.right.map((r) => r.text)).toEqual([
      "Anzeige A",
      "Anzeige B",
      "Anzeige C",
      "Keine Anzeige passt",
    ]);
  });
});

describe("gap choices: shuffle round trip", () => {
  it("shuffles each drop-down per presentation and the chosen text still scores", () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const { item, stored, score } = roundTrip(gaps, seed, () => ({ gaps: { g1: "mit dem", g2: "auf" } }));
      const shown = item.content.kind === "GAP" ? item.content.gaps : [];
      expect([...shown[0].choices!].sort()).toEqual(["mit dem", "mit den", "mit der", "mit die"]);
      expect([...shown[1].choices!].sort()).toEqual(["an", "auf", "für"]);
      orders.add(shown[0].choices!.join("|"));
      expect(stored.gaps).toEqual({ g1: "mit dem", g2: "auf" });
      expect(score).toEqual({ score: 1, correct: true });
    }
    // 40 presentations of 4 choices land in more than one order, and the key is not always first.
    expect(orders.size).toBeGreaterThan(5);
    expect([...orders].some((o) => !o.startsWith("mit dem|"))).toBe(true);
  });

  it("is the same order for the same seed, so a reload changes nothing", () => {
    const a = makePresentation(gaps, mulberry32(11));
    const b = makePresentation(gaps, mulberry32(11));
    expect(a).toEqual(b);
    expect(Object.keys(a.choiceOrder ?? {})).toEqual(["g1", "g2"]);
    const item1 = toCandidateItem(gaps, a, null, 1, { maxPlays: 2 });
    const item2 = toCandidateItem(gaps, a, null, 1, { maxPlays: 2 });
    expect(item1.content).toEqual(item2.content);
  });

  it("an older presentation without choiceOrder shows the bank order", () => {
    const item = toCandidateItem(gaps, {}, null, 1, { maxPlays: 2 });
    expect(item.content.kind === "GAP" && item.content.gaps[0].choices).toEqual(["mit dem", "mit den", "mit der", "mit die"]);
  });

  it("leaves typed gaps alone", () => {
    const typed: ItemSnapshot = { ...gaps, content: { kind: "GAP", gaps: [{ id: "g1" }] }, key: { kind: "GAP", answers: { g1: ["dem"] } } };
    expect(makePresentation(typed, mulberry32(3))).toEqual({});
  });
});
