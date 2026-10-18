import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { managerT } from "@/i18n/manager";
import type { ItemSnapshot } from "@/lib/exam/types";
import { buildDetail, type DetailSource } from "../report/detail-model";
import { DetailSheet } from "../report/detail-sheet";
import { reviewCard } from "./review-cards";
import { TextGapBody } from "./text-gap-review";

const base = { id: "i", section: "GRAMMAR", level: "A2", difficulty: 0, stimulusId: null, orderInStimulus: 0, rubric: null, points: 1, stimulus: null, type: "GAP_FILL" } as const;
const cloze = {
  ...base,
  skillTag: "grammar.cloze",
  prompt: "Ich gehe {{g1}} Hause und bleibe {{g2}} dem Sofa.",
  content: { kind: "GAP", gaps: [{ id: "g1", choices: ["nach", "zu", "in", "bei"] }, { id: "g2", choices: ["auf", "an", "über", "unter"] }] },
  key: { kind: "GAP", answers: { g1: ["nach"], g2: ["auf"] } },
} as ItemSnapshot;
const wordbank = {
  ...base,
  skillTag: "grammar.wordbank",
  prompt: "Wir {{g1}} morgen {{g2}} Hamburg.",
  content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] },
  key: { kind: "GAP", answers: { g1: ["fahren"], g2: ["nach"] }, distractors: ["fährt", "zu", "bei"] },
} as ItemSnapshot;

const tr = managerT("tr");
const en = managerT("en");
const body = (s: ItemSnapshot, answer: object, t = tr) => {
  const card = reviewCard(s, answer);
  if (card.kind !== "GAP") throw new Error("gap");
  return renderToStaticMarkup(createElement(TextGapBody, { card, t }));
};

describe("TextGapBody (teacher review of MC cloze and word bank)", () => {
  it("cloze: every gap lists the student's word, the key when wrong, and the four options", () => {
    const html = body(cloze, { gaps: { g1: "zu", g2: "auf" } });
    expect(html).toContain("Boşluk 1");
    expect(html).toContain("Boşluk 2");
    for (const w of ["nach", "zu", "in", "bei", "auf", "an", "über", "unter"]) expect(html).toContain(`>${w}`);
    expect(html).toContain("1 / 2 boşluk doğru");
    // The key of the wrong gap is named; the right gap needs no key column.
    expect(html.match(/Anahtar/g)).toHaveLength(1);
    expect(html).toContain("✓");
    expect(html).toContain("✗");
  });
  it("is never red and offers no accept control", () => {
    for (const html of [body(cloze, { gaps: { g1: "zu" } }), body(wordbank, { gaps: { g1: "fährt", g2: "nach" } })]) {
      expect(html).not.toMatch(/danger|text-red|bg-red/);
      expect(html).not.toContain("<form");
      expect(html).not.toContain("<button");
      expect(html).not.toContain(tr("resultReview.accept"));
    }
  });
  it("word bank: student word against the key, no option list", () => {
    const html = body(wordbank, { gaps: { g1: "fährt", g2: "nach" } });
    expect(html).toContain("fährt");
    expect(html).toContain("fahren");
    expect(html).not.toContain(tr("resultReview.options"));
  });
  it("speaks English with the English copy", () => {
    const html = body(cloze, { gaps: { g1: "zu", g2: "auf" } }, en);
    expect(html).toContain("Gap 1");
    expect(html).toContain("1 / 2 gaps correct");
    expect(html).toContain("Options");
  });
  it("a gap left empty shows the blank word and the key, with no tick or cross for it", () => {
    const html = body(wordbank, { gaps: { g1: "fahren" } });
    expect(html).toContain(tr("resultReview.blankWord"));
    expect(html.match(/✗/g)).toBeNull();
  });
});

describe("the printable report for an MC cloze and a word bank", () => {
  const src: DetailSource = {
    sections: ["GRAMMAR"],
    skillLevels: { GRAMMAR: "A2" },
    runs: [{ id: "g", section: "GRAMMAR", navigable: true }],
    responses: [
      { id: "c", sectionRunId: "g", sequence: 1, itemSnapshot: cloze, answer: { gaps: { g1: "zu", g2: "auf" } }, score: 0.5, notReached: false },
      { id: "w", sectionRunId: "g", sequence: 2, itemSnapshot: wordbank, answer: { gaps: { g1: "fahren", g2: "zu" } }, score: 0.5, notReached: false },
    ],
    gradings: [],
    acceptances: {},
    transcripts: {},
    nameOf: {},
  };
  const html = renderToStaticMarkup(createElement(DetailSheet, { sections: buildDetail(src), studentName: "Ayşe", t: tr, locale: "tr" }));
  it("lists gap by gap with the options of the cloze, and is never red", () => {
    expect(html).toContain(tr("resultReport.gapNo"));
    expect(html).toContain(tr("resultReport.options"));
    for (const w of ["nach", "zu", "fahren"]) expect(html).toContain(w);
    expect(html).not.toMatch(/danger/);
  });
});

describe("the title of a text", () => {
  const titled = {
    ...cloze,
    prompt: "Lesen Sie den Text. Wählen Sie für jede Lücke das passende Wort.\n\nMein Abend\n\nIch gehe {{g1}} Hause und bleibe {{g2}} dem Sofa.",
  } as ItemSnapshot;
  const answer = { gaps: { g1: "nach", g2: "auf" } };

  it("review: the title is a heading of its own and the text starts after it", () => {
    const html = body(titled, answer);
    expect(html).toMatch(/<h4 lang="de"[^>]*font-bold[^>]*>Mein Abend<\/h4>/);
    expect(html).toContain("Lesen Sie den Text.");
    expect(html.indexOf("Lesen Sie")).toBeLessThan(html.indexOf("Mein Abend"));
    expect(html.indexOf("Mein Abend")).toBeLessThan(html.indexOf("Ich gehe"));
    // The title is not repeated inside the running text.
    expect(html.match(/Mein Abend/g)).toHaveLength(1);
  });

  it("report: the title is a bold line of its own", () => {
    const src: DetailSource = {
      sections: ["GRAMMAR"],
      skillLevels: { GRAMMAR: "A2" },
      runs: [{ id: "g", section: "GRAMMAR", navigable: true }],
      responses: [{ id: "c", sectionRunId: "g", sequence: 1, itemSnapshot: titled, answer, score: 1, notReached: false }],
      gradings: [],
      acceptances: {},
      transcripts: {},
      nameOf: {},
    };
    const html = renderToStaticMarkup(createElement(DetailSheet, { sections: buildDetail(src), studentName: "Ayşe", t: tr, locale: "tr" }));
    expect(html).toMatch(/<p lang="de" class="mt-1 font-bold">Mein Abend<\/p>/);
    expect(html.match(/Mein Abend/g)).toHaveLength(1);
  });
});
