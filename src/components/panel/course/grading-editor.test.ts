import { createElement, type FC, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import de from "@/i18n/messages/screens.de.json";
import en from "@/i18n/messages/screens.en.json";
import { COMMON_WRITING_ERRORS, CRITERION_LABEL_DE, SPEAKING_CRITERIA, WRITING_CRITERIA, type CourseRubricProposal } from "@/lib/exam/course/types";
import { CourseGradingEditor } from "./grading-editor";
import { COMMON_ERROR_IDS, editorCriteria, type CourseGradingStatus } from "./grading-model";

// The real provider types `children` as required, which createElement's third argument cannot satisfy.
const Provider = NextIntlClientProvider as unknown as FC<{ locale: string; messages: Record<string, unknown>; children?: ReactNode }>;
const noop = () => {};

const writingProposal = (points: [number, number, number] = [3, 2, 1], commonErrors: CourseRubricProposal["commonErrors"] = ["SPELLING", "CASE"]): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section: "WRITING",
  criteria: WRITING_CRITERIA.map((id, i) => ({ id, points: points[i], max: 3, rationale: `Begründung ${id}` })),
  commonErrors,
  advice: "Nebensätze üben.",
});
const speakingProposal = (points: Array<number | null>): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section: "SPEAKING",
  criteria: SPEAKING_CRITERIA.map((id, i) => ({ id, points: points[i], max: 4, rationale: `Begründung ${id}` })),
  advice: "Mehr Verbindungswörter.",
});

type Props = Partial<Parameters<typeof CourseGradingEditor>[0]>;
function render(props: Props, locale: "de" | "en" = "de") {
  const section = props.section ?? "WRITING";
  const proposal = props.proposal === undefined ? writingProposal() : props.proposal;
  const messages = { courseResult: (locale === "de" ? de : en).courseResult };
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages },
      createElement(CourseGradingEditor, {
        gradingId: "g1",
        tab: section,
        section,
        status: "AI_PROPOSED" as CourseGradingStatus,
        proposal,
        decided: null,
        criteria: editorCriteria(section, proposal),
        boxes: section === "WRITING" ? COMMON_ERROR_IDS.map((id) => ({ id, label: COMMON_WRITING_ERRORS[id] })) : [],
        actions: { confirm: noop, change: noop, errors: noop },
        ...props,
      }),
    ),
  );
}

/** Every input of the markup with its name, value and checked state (React does not keep prop order). */
function inputs(html: string) {
  return [...html.matchAll(/<input\b[^>]*>/g)].map((m) => ({
    name: /name="([^"]*)"/.exec(m[0])?.[1] ?? "",
    type: /type="([^"]*)"/.exec(m[0])?.[1] ?? "",
    value: /value="([^"]*)"/.exec(m[0])?.[1] ?? "",
    checked: /\bchecked=""/.test(m[0]),
  }));
}
const picked = (html: string, criterion: string) => inputs(html).filter((i) => i.name === `points.${criterion}` && i.checked).map((i) => i.value);
/** The save button is disabled (the attribute, not the `disabled:` utility classes). */
const disabled = (html: string) => /<button\b[^>]*\sdisabled=""/.test(html);

describe("the writing form", () => {
  it("has a row of 0-3 boxes per criterion with the AI's points ticked, under the German criterion names", () => {
    const html = render({});
    for (const id of WRITING_CRITERIA) {
      expect(inputs(html).filter((i) => i.name === `points.${id}`).map((i) => i.value), id).toEqual(["0", "1", "2", "3"]);
      expect(html).toContain(CRITERION_LABEL_DE[id]);
    }
    expect([picked(html, "INHALT"), picked(html, "WORTSCHATZ"), picked(html, "GRAMMATIK")]).toEqual([["3"], ["2"], ["1"]]);
  });

  it("shows the AI's proposal and rationale under each criterion", () => {
    const html = render({});
    expect(html).toContain("KI-Vorschlag: 3");
    expect(html).toContain("Begründung INHALT");
    expect(render({}, "en")).toContain("AI proposal: 3");
  });

  it("offers the sixteen Häufigste Fehler boxes with the AI's ticks, and marks that they were part of the form", () => {
    const html = render({});
    const boxes = inputs(html).filter((i) => i.name === "commonErrors");
    expect(boxes.map((b) => b.value)).toEqual(COMMON_ERROR_IDS);
    expect(boxes.filter((b) => b.checked).map((b) => b.value)).toEqual(["CASE", "SPELLING"].sort((a, b) => COMMON_ERROR_IDS.indexOf(a as never) - COMMON_ERROR_IDS.indexOf(b as never)));
    expect(inputs(html).some((i) => i.name === "commonErrorsSent" && i.value === "1")).toBe(true);
    expect(html).toContain("Nicht alle Leitpunkte bearbeitet");
    expect(html).toContain("2 angekreuzt");
  });

  it("confirms with no reason while the pickers still hold the AI's points", () => {
    const html = render({});
    expect(html).not.toContain('name="reason"');
    expect(disabled(html)).toBe(false);
    expect(html).toContain("Vorschlag bestätigen");
    expect(html).toContain("Summe: 6 von 9 Punkten");
  });

  it("carries the grading and the tab for the action", () => {
    const html = render({});
    expect(inputs(html).find((i) => i.name === "gradingId")?.value).toBe("g1");
    expect(inputs(html).find((i) => i.name === "tab")?.value).toBe("WRITING");
  });
});

describe("the speaking form", () => {
  const section = "SPEAKING" as const;

  it("has five criteria with 0-4 boxes and no common-error boxes", () => {
    const html = render({ section, proposal: speakingProposal([3, 3, 2, 3, 3]) });
    for (const id of SPEAKING_CRITERIA) expect(inputs(html).filter((i) => i.name === `points.${id}`).map((i) => i.value), id).toEqual(["0", "1", "2", "3", "4"]);
    expect(inputs(html).filter((i) => i.name === "commonErrors")).toEqual([]);
    expect(inputs(html).some((i) => i.name === "commonErrorsSent")).toBe(false);
    expect(html).toContain("Summe: 14 von 20 Punkten");
  });

  it("leaves AUSSPRACHE empty when the AI could not judge it, says why, and waits for the teacher", () => {
    const html = render({ section, proposal: speakingProposal([3, 3, 2, null, 3]) });
    expect(picked(html, "AUSSPRACHE")).toEqual([]);
    expect(picked(html, "KOMMUNIKATION")).toEqual(["3"]);
    expect(html).toContain("Aus dem Transkript nicht beurteilbar");
    expect(disabled(html)).toBe(true);
    expect(html).toContain("Wählen Sie für jedes Kriterium eine Punktzahl.");
    // Filling it in is not a change of the AI's points: no reason is asked.
    expect(html).not.toContain('name="reason"');
  });
});

describe("grading without a proposal", () => {
  it.each(["PENDING", "AI_FAILED"] as const)("asks for the points and a reason when the status is %s", (status) => {
    const html = render({ status, proposal: null, boxes: [] });
    expect(inputs(html).filter((i) => i.checked && i.name.startsWith("points."))).toEqual([]);
    expect(html).toContain('name="reason"');
    expect(html).toContain("Begründung (erforderlich)");
    expect(disabled(html)).toBe(true);
  });
});

describe("a decided grading", () => {
  const decided = { points: { INHALT: 2, WORTSCHATZ: 2, GRAMMATIK: 2 }, commonErrors: ["TOO_SHORT" as const] };

  it("starts from the teacher's points and boxes, not the AI's", () => {
    const html = render({ status: "CONFIRMED", decided });
    expect([picked(html, "INHALT"), picked(html, "WORTSCHATZ"), picked(html, "GRAMMATIK")]).toEqual([["2"], ["2"], ["2"]]);
    expect(inputs(html).filter((i) => i.name === "commonErrors" && i.checked).map((i) => i.value)).toEqual(["TOO_SHORT"]);
    expect(html).toContain("Summe: 6 von 9 Punkten");
  });

  it("has nothing to save until something changes", () => {
    const html = render({ status: "OVERRIDDEN", decided });
    expect(disabled(html)).toBe(true);
    expect(html).toContain("Nichts geändert.");
    expect(html).not.toContain('name="reason"');
  });
});

describe("the form speaks the panel's language", () => {
  it("reads English", () => {
    const html = render({}, "en");
    expect(html).toContain("Confirm proposal");
    expect(html).toContain("Most common errors");
    expect(html).toContain("Total: 6 of 9 points");
  });
});
