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
});
