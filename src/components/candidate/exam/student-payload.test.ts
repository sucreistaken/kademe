import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SEED_BANK } from "@/db/seed-bank";
import { buildStudentAnalysis } from "@/lib/exam/student-analysis";
import { studentFacingFeedback, type StudentFeedbackStore } from "@/lib/exam/student-feedback";
import type { ItemSnapshot } from "@/lib/exam/types";
import type { StudentResult } from "@/lib/exam-flow";
import { StudentSheet } from "./student-sheet";

/**
 * Payload level: everything a student's browser or printed sheet receives for a released
 * result, built from real bank items and an approved note that has examples. None of the
 * items' prompts, options or keys, and none of the note's examples, may be in it.
 */
const snapshots: ItemSnapshot[] = SEED_BANK.items
  .filter((i) => (i.content.kind === "GAP" || i.content.kind === "CHOICE"))
  .slice(0, 120)
  .map((i, n) => ({
    id: `item-${n}`,
    section: i.section,
    level: i.level,
    difficulty: 0,
    skillTag: i.skillTag,
    stimulusId: null,
    orderInStimulus: 0,
    prompt: i.prompt,
    rubric: null,
    points: 1,
    stimulus: null,
    type: i.type,
    content: i.content,
    key: i.key,
  }));

const store: StudentFeedbackStore = {
  draft: null,
  draftedAt: null,
  draftRunId: null,
  approved: {
    strengths: ["You read carefully."],
    improve: [
      { topic: "Dativ", why: "Mind the case.", example: { student: "BADFORM-ZZ", correct: "GOODFORM-ZZ" } },
      { topic: "Konnektoren", why: "Use the right link word.", example: "OLDSTRING-ZZ" },
    ],
    nextStep: "Practise daily.",
  },
  approvedBy: "u1",
  approvedAt: "2026-10-23T10:00:00.000Z",
  edited: false,
  locale: "en",
};

/** Every string a student must never receive from the items. */
function secrets(): string[] {
  const out = new Set<string>();
  for (const s of snapshots) {
    out.add(s.prompt.slice(0, 40));
    if (s.content.kind === "CHOICE") for (const o of s.content.options) if (o.text.length >= 12) out.add(o.text);
    if (s.key.kind === "GAP") for (const a of Object.values(s.key.answers)) for (const x of a) if (x.length >= 7) out.add(x);
  }
  return [...out].filter((x) => x.trim().length >= 7);
}

describe("student payload", () => {
  const responses = snapshots.map((s, n) => ({
    id: `r${n}`,
    sectionRunId: `run-${s.section}`,
    sequence: n,
    itemSnapshot: s,
    // A wrong answer for every gap or choice, a blank for every third item.
    answer: n % 3 === 0 ? null : s.content.kind === "GAP" ? { gaps: Object.fromEntries(s.content.gaps.map((g) => [g.id, "zzqx"])) } : { choiceIds: ["none"] },
    score: 0,
    notReached: false,
  }));
  const sections = [...new Set(snapshots.map((s) => s.section))];
  const analysis = buildStudentAnalysis(
    { sections, runs: sections.map((s) => ({ id: `run-${s}`, section: s, navigable: false })), responses, acceptances: {} },
    "en",
  );
  const result: StudentResult = {
    visibility: "FULL",
    released: true,
    awaitingTeacher: false,
    levelShown: true,
    overall: "B1",
    outcome: "PASS",
    skills: [{ section: "GRAMMAR", level: "B1" }],
    analysis,
    feedback: studentFacingFeedback(store),
  };

  it("has real content to check against", () => {
    expect(secrets().length).toBeGreaterThan(50);
    expect(analysis.sections.some((s) => s.wrong + s.blank > 0)).toBe(true);
    expect(analysis.missedTopics.length).toBeGreaterThan(0);
  });

  it("the finished payload carries no example, key, prompt or option", () => {
    const json = JSON.stringify(result);
    expect(json).not.toContain("example");
    for (const x of ["BADFORM-ZZ", "GOODFORM-ZZ", "OLDSTRING-ZZ", "choices", "answers", "options", "prompt"]) expect(json).not.toContain(x);
    for (const x of secrets()) expect(json, x).not.toContain(x);
    expect(JSON.parse(json).feedback.improve).toEqual([
      { topic: "Dativ", why: "Mind the case." },
      { topic: "Konnektoren", why: "Use the right link word." },
    ]);
  });

  it("the print sheet carries none of it either", () => {
    const html = renderToStaticMarkup(
      createElement(StudentSheet, { schoolName: "School", studentName: "Ada", examName: "Placement", date: null, result, locale: "en" }),
    );
    expect(html).toContain("Practise daily.");
    for (const x of ["BADFORM-ZZ", "GOODFORM-ZZ", "OLDSTRING-ZZ"]) expect(html).not.toContain(x);
    for (const x of secrets()) expect(html, x).not.toContain(x);
  });

  it("shows the outcome line in the level box only when the level is shown", () => {
    const shown = renderToStaticMarkup(createElement(StudentSheet, { schoolName: "S", studentName: "A", examName: "E", date: null, result, locale: "en" }));
    expect(shown).toContain("Your stated level was confirmed.");
    const hidden = renderToStaticMarkup(
      createElement(StudentSheet, { schoolName: "S", studentName: "A", examName: "E", date: null, result: { ...result, levelShown: false }, locale: "en" }),
    );
    expect(hidden).not.toContain("Your stated level was confirmed.");
  });
});
