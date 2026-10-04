import { describe, expect, it } from "vitest";
import { toCandidateVersion } from "./candidate-view";
import { activity, content, stage } from "./test-fixtures";

const SECRET = "SECRET";
const draft = content([
  stage(
    "s1",
    [
      activity("a1", {
        competencyIds: ["comp-secret"],
        internalQuestion: `${SECRET} purpose`,
        expectedBehaviours: [`${SECRET} behaviour`],
        redFlags: [`${SECRET} flag`],
        managerNotes: `${SECRET} note`,
        answerExamples: { 1: `${SECRET} one`, 3: `${SECRET} three`, 5: `${SECRET} five` },
        config: { textAlternativeEnabled: true },
      }),
      activity("a2", {
        type: "SINGLE_CHOICE",
        config: {
          choices: [
            { id: "x", label: { tr: "Evet", en: "Yes" }, correct: true },
            { id: "y", label: { tr: "Hayır", en: "No" } },
          ],
        },
      }),
    ],
    { internalPurpose: `${SECRET} stage purpose` },
  ),
]);

describe("candidate view (HIRING-UX 5.8, spec 7)", () => {
  it("never carries a team-only field, the competency mapping or the right answer", () => {
    const text = JSON.stringify(toCandidateVersion(draft));
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("comp-secret");
    expect(text).not.toContain("correct");
  });

  it("is built from a whitelist", () => {
    const view = toCandidateVersion(draft);
    expect(Object.keys(view.stages[0]).sort()).toEqual(["activities", "description", "durationSeconds", "id", "name"]);
    expect(Object.keys(view.stages[0].activities[0]).sort()).toEqual(
      [
        "acceptedMimeTypes",
        "answerSeconds",
        "choices",
        "flexibleThink",
        "id",
        "maxChars",
        "maxFileBytes",
        "maxTakes",
        "minChars",
        "note",
        "prompt",
        "required",
        "textAlternativeEnabled",
        "thinkSeconds",
        "type",
      ].sort(),
    );
    expect(view.stages[0].activities[1].choices).toEqual([
      { id: "x", label: { tr: "Evet", en: "Yes" } },
      { id: "y", label: { tr: "Hayır", en: "No" } },
    ]);
    expect(view.totalSeconds).toBe(600);
  });

  it("is a copy: editing the draft afterwards changes nothing in it", () => {
    const local = content([stage("s1", [activity("a1", { prompt: { tr: "önce", en: "" } })])]);
    const view = toCandidateVersion(local);
    local.stages[0].activities[0].prompt.tr = "sonra";
    expect(view.stages[0].activities[0].prompt.tr).toBe("önce");
  });

  it("copies the configured limits and drops options without text", () => {
    const view = toCandidateVersion(
      content([
        stage("s1", [
          activity("t", {
            type: "LONG_TEXT",
            config: { minChars: 50, maxChars: 900, acceptedMimeTypes: ["application/pdf"], maxFileBytes: 1024, textAlternativeEnabled: true },
          }),
          activity("c", {
            orderIndex: 1,
            type: "MULTI_CHOICE",
            config: {
              choices: [
                { id: "a", label: { tr: "Var", en: "" }, correct: true },
                { id: "b", label: { tr: " ", en: "" } },
                { id: "c", label: { tr: "", en: "Maybe" } },
              ],
            },
          }),
        ]),
      ]),
    );
    const [text, choice] = view.stages[0].activities;
    expect(text).toMatchObject({ minChars: 50, maxChars: 900, acceptedMimeTypes: ["application/pdf"], maxFileBytes: 1024, textAlternativeEnabled: true, choices: null });
    expect(choice.choices).toEqual([
      { id: "a", label: { tr: "Var", en: "" } },
      { id: "c", label: { tr: "", en: "Maybe" } },
    ]);
  });

  it("orders stages and questions by their order, whatever order they were loaded in", () => {
    const stages = [
      stage("s2", [activity("late", { orderIndex: 1 }), activity("early", { orderIndex: 0 })], { orderIndex: 1 }),
      stage("s1", [activity("only")], { orderIndex: 0 }),
    ];
    const one = toCandidateVersion(content(stages));
    const two = toCandidateVersion(content([...stages].reverse().map((s) => ({ ...s, activities: [...s.activities].reverse() }))));
    expect(JSON.stringify(two)).toBe(JSON.stringify(one));
    expect(one.stages.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(one.stages[1].activities.map((a) => a.id)).toEqual(["early", "late"]);
  });
});
