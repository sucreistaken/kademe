import { describe, expect, it } from "vitest";
import { adaptiveLevels, bankCoverage, productiveTaskLevels, type BankCount } from "../blueprint";
import { examTemplateByKey } from "../templates";
import { CEFR_LEVELS, SECTIONS, type ItemContent, type Section } from "../types";
import { COURSE_TESTS, courseSections } from "./catalog";
import { courseBlueprint } from "./config";
import { courseCoverage, foldCourseCounts, type CourseCountRow } from "./coverage";
import { COURSE_KEYS, courseFormKey, type CourseForm, type CourseKey } from "./types";

const choice = (): ItemContent => ({ kind: "CHOICE", options: [{ id: "a", text: "a" }, { id: "b", text: "b" }, { id: "c", text: "c" }] });
const tfng = (n: number): ItemContent => ({ kind: "TFNG", statements: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, text: "x" })), twoWay: true });
const gaps = (n: number): ItemContent => ({ kind: "GAP", gaps: Array.from({ length: n }, (_, i) => ({ id: `g${i}`, choices: ["a", "b", "c"] })) });
const matching = (n: number): ItemContent => ({ kind: "MATCHING", left: Array.from({ length: n }, (_, i) => ({ id: `l${i}`, text: "x" })), right: [{ id: "r0", text: "y" }] });
const writing = (): ItemContent => ({ kind: "WRITING", minWords: 60, maxWords: 80 });
const speaking = (): ItemContent => ({ kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 });

function row(courseForm: string | null, section: Section, content: ItemContent, over: Partial<CourseCountRow> = {}): CourseCountRow {
  return {
    courseForm,
    section,
    level: "B1",
    content,
    answerKey: { kind: "NONE" },
    stimulusId: section === "READING" || section === "LISTENING" ? `${courseForm}-${section}` : null,
    audioKey: section === "LISTENING" ? "audio/clip.mp3" : null,
    ...over,
  };
}

/** One form that has exactly the catalog's units in every section: a text with several statements, then single items. */
function formRows(key: CourseKey, form: CourseForm): CourseCountRow[] {
  const f = courseFormKey(key, form);
  const level = COURSE_TESTS[key].level;
  return courseSections(key).flatMap((p): CourseCountRow[] => {
    switch (p.section) {
      case "GRAMMAR": {
        const cloze = p.units === 15 ? 6 : 10;
        return [row(f, "GRAMMAR", gaps(cloze), { level }), ...Array.from({ length: p.units - cloze }, () => row(f, "GRAMMAR", choice(), { level }))];
      }
      case "READING":
      case "LISTENING": {
        const half = p.units / 2;
        return [row(f, p.section, tfng(half), { level }), ...Array.from({ length: half }, () => row(f, p.section, choice(), { level }))];
      }
      case "WRITING":
        return [row(f, "WRITING", writing(), { level })];
      case "SPEAKING":
        return Array.from({ length: p.units }, () => row(f, "SPEAKING", speaking(), { level }));
    }
  });
}

const bothForms = (key: CourseKey): CourseCountRow[] => [...formRows(key, "A"), ...formRows(key, "B")];
const coverageOf = (key: CourseKey, rows: CourseCountRow[]) => courseCoverage(foldCourseCounts(rows), courseBlueprint(key));
const failing = (r: ReturnType<typeof courseCoverage>) => r.rows.filter((x) => !x.ok).map((x) => `${x.courseForm} ${x.section} ${x.available}/${x.needed}`);

describe("foldCourseCounts", () => {
  it("counts a form's items, texts and scored units per section and level", () => {
    const counts = foldCourseCounts(formRows("B1", "A"));
    const reading = counts.find((c) => c.section === "READING")!;
    expect(reading).toMatchObject({ courseForm: "B1:A", level: "B1", items: 6, points: 10, stimuli: 1 });
    const grammar = counts.find((c) => c.section === "GRAMMAR")!;
    // One cloze text of 10 gaps and 15 single sentences: 16 items, 25 points.
    expect(grammar).toMatchObject({ items: 16, points: 25 });
    expect(counts.find((c) => c.section === "WRITING")).toMatchObject({ items: 1, points: 0 });
    expect(counts.find((c) => c.section === "SPEAKING")).toMatchObject({ items: 3, points: 0 });
  });

  it("keeps forms apart", () => {
    const counts = foldCourseCounts([...formRows("B1", "A"), ...formRows("B1.1", "A"), ...formRows("B1", "B")]);
    expect(new Set(counts.map((c) => c.courseForm))).toEqual(new Set(["B1:A", "B1.1:A", "B1:B"]));
    expect(counts.filter((c) => c.courseForm === "B1:A")).toHaveLength(5);
  });

  it("counts matching rows and leaves out a listening item without audio", () => {
    const f = "A2:A";
    const counts = foldCourseCounts([
      row(f, "READING", matching(5)),
      row(f, "LISTENING", choice(), { audioKey: "audio/a.mp3" }),
      row(f, "LISTENING", choice(), { audioKey: null }),
    ]);
    expect(counts.find((c) => c.section === "READING")).toMatchObject({ items: 1, points: 5 });
    expect(counts.find((c) => c.section === "LISTENING")).toMatchObject({ items: 1, points: 1 });
    expect(foldCourseCounts([row(f, "LISTENING", choice(), { audioKey: null })])).toEqual([]);
  });

  it("ignores the bank's rows and rows whose form is not a course form", () => {
    expect(foldCourseCounts([row(null, "READING", choice()), row("B1", "READING", choice()), row("B1:C", "READING", choice()), row("X9:A", "READING", choice()), row("B1:A:extra", "READING", choice())])).toEqual([]);
  });
});

describe("courseCoverage", () => {
  it.each(COURSE_KEYS)("%s is covered when both forms hold the catalog's units in every section", (key) => {
    const r = coverageOf(key, bothForms(key));
    expect(failing(r)).toEqual([]);
    expect(r.ok).toBe(true);
    // One row per form and section.
    expect(r.rows).toHaveLength(2 * courseSections(key).length);
    expect(new Set(r.rows.map((x) => x.courseForm))).toEqual(new Set([courseFormKey(key, "A"), courseFormKey(key, "B")]));
    expect(r.rows.every((x) => x.level === COURSE_TESTS[key].level)).toBe(true);
  });

  it("is not covered while a form does not exist yet", () => {
    const r = coverageOf("B1.1", formRows("B1.1", "A"));
    expect(r.ok).toBe(false);
    expect(failing(r).every((x) => x.startsWith("B1.1:B"))).toBe(true);
    expect(failing(r)).toHaveLength(5);
  });

  it("is not covered by the other course's forms", () => {
    expect(coverageOf("B1", bothForms("B1.1")).ok).toBe(false);
    expect(coverageOf("B1", bothForms("A1")).ok).toBe(false);
  });

  it("refuses a form that is one unit short, or one over: the maximum points are the catalog's", () => {
    const short = bothForms("B1.1");
    const at = short.findIndex((r) => r.courseForm === "B1.1:A" && r.section === "GRAMMAR" && r.content.kind === "CHOICE");
    short.splice(at, 1);
    expect(failing(coverageOf("B1.1", short))).toEqual(["B1.1:A GRAMMAR 14/15"]);

    const over = [...bothForms("B1.1"), row("B1.1:B", "READING", choice(), { level: "B1" })];
    expect(failing(coverageOf("B1.1", over))).toEqual(["B1.1:B READING 7/6"]);
  });

  it("counts a text's gaps, not its items", () => {
    // 15 grammar units as 15 single items instead of a 6-gap text and 9 sentences is the same form size.
    const f = "B1.1:A";
    const rows = [...bothForms("B1.1").filter((r) => !(r.courseForm === f && r.section === "GRAMMAR")), ...Array.from({ length: 15 }, () => row(f, "GRAMMAR", choice()))];
    expect(coverageOf("B1.1", rows).ok).toBe(true);
    // 6 gaps in one item and nothing else is 6 units, not 1.
    const onlyText = [...bothForms("B1.1").filter((r) => !(r.courseForm === f && r.section === "GRAMMAR")), row(f, "GRAMMAR", gaps(6))];
    expect(failing(coverageOf("B1.1", onlyText))).toEqual(["B1.1:A GRAMMAR 6/15"]);
  });

  it("does not count a listening item whose clip has no audio", () => {
    const rows = bothForms("A1.1");
    const at = rows.findIndex((r) => r.courseForm === "A1.1:B" && r.section === "LISTENING" && r.content.kind === "CHOICE");
    rows[at] = { ...rows[at], audioKey: null };
    expect(failing(coverageOf("A1.1", rows))).toEqual(["A1.1:B LISTENING 5/6"]);
  });

  it("counts writing and speaking as tasks", () => {
    const rows = bothForms("B2").filter((r) => !(r.courseForm === "B2:B" && r.section === "SPEAKING"));
    expect(failing(coverageOf("B2", rows))).toEqual(["B2:B SPEAKING 0/3"]);
    const two = [...rows, row("B2:B", "SPEAKING", speaking()), row("B2:B", "SPEAKING", speaking())];
    expect(failing(coverageOf("B2", two))).toEqual(["B2:B SPEAKING 2/3"]);
  });

  it("cannot cover a COURSE_TEST that does not say which course it is", () => {
    const cfg = courseBlueprint("B1");
    delete cfg.course;
    expect(courseCoverage(foldCourseCounts(bothForms("B1")), cfg)).toEqual({ ok: false, rows: [] });
  });

  it("only asks for the sections the exam has enabled", () => {
    const cfg = courseBlueprint("A2.1");
    cfg.sections = cfg.sections.map((s) => (s.section === "SPEAKING" ? { ...s, enabled: false } : s));
    const rows = bothForms("A2.1").filter((r) => r.section !== "SPEAKING");
    const r = courseCoverage(foldCourseCounts(rows), cfg);
    expect(r.ok).toBe(true);
    expect(r.rows.some((x) => x.section === "SPEAKING")).toBe(false);
  });
});

describe("bankCoverage with course rows", () => {
  const bank = (): BankCount[] =>
    SECTIONS.flatMap((section) => CEFR_LEVELS.map((level) => ({ section, level, items: 200, stimuli: 50, cTests: 5, clozeTexts: 5, wordBanks: 5, openTexts: 5 })));

  it("answers for a COURSE_TEST with its two forms", () => {
    const counts = [...bank(), ...foldCourseCounts(bothForms("B1"))];
    const cfg = courseBlueprint("B1");
    expect(bankCoverage(counts, cfg, "COURSE_TEST", null)).toEqual(courseCoverage(counts, cfg));
    expect(bankCoverage(counts, cfg, "COURSE_TEST", null).ok).toBe(true);
    // The bank alone does not cover a course test.
    expect(bankCoverage(bank(), cfg, "COURSE_TEST", null).ok).toBe(false);
  });

  it("never lets a course form's rows cover the placement or the level check", () => {
    const placement = examTemplateByKey("placement")!;
    const levelCheck = examTemplateByKey("level-check")!;
    const courseOnly = foldCourseCounts([...bothForms("B1"), ...bothForms("B1.1"), ...bothForms("A1"), ...bothForms("B2")]);
    // Course rows exist at A1 to B2 in every section, yet the bank behind them is empty.
    expect(bankCoverage(courseOnly, placement.config, placement.mode, null).ok).toBe(false);
    expect(bankCoverage(courseOnly, levelCheck.config, levelCheck.mode, "B1").ok).toBe(false);
  });

  it("gives the bank the same answer with or without the course rows next to it", () => {
    const placement = examTemplateByKey("placement")!;
    const withCourse = [...foldCourseCounts(bothForms("B1")), ...bank()];
    for (const t of [placement, examTemplateByKey("quick-screen")!]) {
      expect(bankCoverage(withCourse, t.config, t.mode, null)).toEqual(bankCoverage(bank(), t.config, t.mode, null));
    }
    // A thin bank with a course row listed first is still thin: the course row is not read as the bank's.
    const thin = [...foldCourseCounts(bothForms("B1")), ...bank().map((c) => (c.section === "READING" && c.level === "B1" ? { ...c, items: 1, stimuli: 1 } : c))];
    expect(bankCoverage(thin, placement.config, placement.mode, null).ok).toBe(false);
  });
});

describe("the other mode switches", () => {
  it("a course test has no adaptive levels", () => {
    expect(adaptiveLevels("COURSE_TEST", null)).toEqual([]);
    expect(adaptiveLevels("COURSE_TEST", "B1")).toEqual([]);
    expect(adaptiveLevels("PLACEMENT", null)).toEqual([...CEFR_LEVELS]);
  });

  it("a course test asks every task at the course's own level, whatever the objective sections showed", () => {
    expect(productiveTaskLevels("COURSE_TEST", null, "B1", 3)).toEqual(["B1", "B1", "B1"]);
    expect(productiveTaskLevels("COURSE_TEST", "C1", "A2", 2)).toEqual(["A2", "A2"]);
    expect(productiveTaskLevels("COURSE_TEST", null, "B2", 1)).toEqual(["B2"]);
    // The old modes are unchanged.
    expect(productiveTaskLevels("PLACEMENT", null, "B1", 3)).toEqual(["A2", "B1", "B2"]);
    expect(productiveTaskLevels("LEVEL_VERIFICATION", "B2", "A1", 2)).toEqual(["B2", "B2"]);
  });
});
