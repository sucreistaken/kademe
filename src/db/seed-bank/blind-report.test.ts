import { describe, expect, it } from "vitest";
import { parseAnswerFile } from "./blind-answers";
import { courseComparison, courseExports } from "./blind-course";
import { compareBlind, formatSectionTally, renderBlindFile } from "./blind-report";
import { courseBlindFileName, courseBlindItems, selectCourseForms } from "./blind-items";
import { courseItemSeedKey } from "./course-seed";
import { fixtureCourseForm } from "./course-fixture";

const form = fixtureCourseForm("B1.1", "A");
const items = courseBlindItems(form);
const key = (n: number) => items[n].seedKey;

describe("courseBlindItems", () => {
  it("lists the objective items of the form in serving order, writing and speaking left out", () => {
    expect(items.map((i) => [i.item.section, i.item.prompt])).toEqual([
      ["READING", "Richtig oder falsch?"],
      ["READING", "Welcher Text passt?"],
      ["READING", "Wann fährt Anna?"],
      ["GRAMMAR", "Ich ___ müde."],
      ["GRAMMAR", "Ich bleibe zu Hause, {{g1}} es regnet. Er {{g2}} müde."],
      ["LISTENING", "Von welchem Gleis fährt der Zug?"],
      ["LISTENING", "Wohin fährt der Zug?"],
    ]);
  });

  it("names each item by the seed key its database row has", () => {
    expect(items[0].seedKey).toBe(courseItemSeedKey("B1.1", "A", form.sections[0].items[0]));
    expect(items[0].seedKey).toMatch(/^course-b1-1-a-reading-b1-[0-9a-f]{16}$/);
    expect(new Set(items.map((i) => i.seedKey)).size).toBe(items.length);
  });

  it("gives each item its own text, the script of a clip included, and numbers them as served", () => {
    expect(items.map((i) => i.stimulus?.key ?? null)).toEqual(["fx-r-reise", null, "fx-r-reise", null, null, "fx-l-durchsage", "fx-l-durchsage"]);
    expect(items.map((i) => i.candidate.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("is empty for a form with no objective items", () => {
    const empty = fixtureCourseForm();
    for (const s of empty.sections) if (s.section !== "WRITING" && s.section !== "SPEAKING") s.items = [];
    expect(courseBlindItems(empty)).toEqual([]);
  });
});

describe("selectCourseForms", () => {
  const forms = [fixtureCourseForm("B1.1", "A"), fixtureCourseForm("B1.1", "B"), fixtureCourseForm("B1", "A")];

  it("takes one form by key and letter, in any case", () => {
    expect(selectCourseForms("B1.1:A", forms)).toEqual([forms[0]]);
    expect(selectCourseForms("b1.1:b", forms)).toEqual([forms[1]]);
    expect(selectCourseForms(" b1:a ", forms)).toEqual([forms[2]]);
  });

  it("takes every form for all, and none when the seed has none", () => {
    expect(selectCourseForms("all", forms)).toEqual(forms);
    expect(selectCourseForms("ALL", [])).toEqual([]);
  });

  it("refuses a form the seed lacks and says which it has", () => {
    expect(() => selectCourseForms("A2:B", forms)).toThrow("course form A2:B is not in the seed (forms in the seed: B1.1:A, B1.1:B, B1:A)");
    expect(() => selectCourseForms("A2:B", [])).toThrow(/forms in the seed: none yet/);
  });

  it("refuses anything that is not a form key", () => {
    for (const bad of ["B1", "B1.1", "B1.1:C", "B3:A", "true", ""]) expect(() => selectCourseForms(bad, forms)).toThrow(/--course must be <key>:<form>/);
  });

  it("names the export file after the form", () => {
    expect(courseBlindFileName({ key: "B1.1", form: "A" })).toBe("blind-course-b1-1-a.md");
    expect(courseBlindFileName({ key: "A1", form: "B" })).toBe("blind-course-a1-b.md");
  });
});

describe("renderBlindFile for a course form", () => {
  const text = renderBlindFile("Blind solve: Zwischentest B1.1, Form A (B1.1:A)", items, ["A note for the solver."]);

  it("has the title, the note and the items in serving order", () => {
    expect(text.split("\n")[0]).toBe("# Blind solve: Zwischentest B1.1, Form A (B1.1:A)");
    expect(text).toContain("A note for the solver.");
    const headings = text.split("\n").filter((l) => l.startsWith("## "));
    expect(headings).toEqual(["## 1. READING", "## 2. READING", "## 3. READING", "## 4. GRAMMAR", "## 5. GRAMMAR", "## 6. LISTENING", "## 7. LISTENING"]);
  });

  it("shows a text once and the script of a clip, and gives each item a template line under its seed key", () => {
    expect(text.match(/### Text: Reise/g)).toHaveLength(1);
    expect(text).toContain("(Text wie oben: Reise)");
    expect(text).toContain("### Hörtext (Skript): Durchsage");
    for (const i of items) expect(text).toMatch(new RegExp(`^${i.seedKey}: `, "m"));
  });

  it("does not show the key", () => {
    expect(text).not.toContain('"correct"');
    expect(text).not.toMatch(/Schlüssel|answers/i);
  });

  it("is the bank's file when there is no note: title, intro, items", () => {
    const plain = renderBlindFile("Blind solve: B1", items);
    expect(plain.split("\n").slice(0, 4)).toEqual(["# Blind solve: B1", "", "Answer every item below without any key. Fill the answer template block of each item (replace `...`), keep the line format, and save the file.", ""]);
    expect(plain.split("\n")[4]).toBe("## 1. READING");
  });
});

describe("compareBlind for a course form", () => {
  /** The answer lines of a solver who knows the key, with the given items wrong or left out. */
  function answers(wrong: number[] = [], blank: number[] = [], halfWrong: number[] = []): string {
    return items
      .map((it, n) => {
        if (blank.includes(n)) return `${it.seedKey}: ...`;
        const k = it.item.key;
        if (k.kind === "CHOICE") return `${it.seedKey}: choice=${wrong.includes(n) ? "z" : k.correct.join(",")}`;
        if (k.kind === "TFNG")
          return `${it.seedKey}: ${Object.entries(k.answers)
            .map(([id, v], j) => `${id}=${wrong.includes(n) || (halfWrong.includes(n) && j === 0) ? (v === "R" ? "F" : "R") : v}`)
            .join(", ")}`;
        if (k.kind === "GAP") return `${it.seedKey}: ${Object.entries(k.answers).map(([id, v]) => `${id}=${wrong.includes(n) ? "xyz" : v[0]}`).join(", ")}`;
        return `${it.seedKey}: ...`;
      })
      .join("\n");
  }

  it("agrees with every item when the solver gave the key's answers", () => {
    const r = compareBlind(items, parseAnswerFile(answers()));
    expect(r).toMatchObject({ agree: 7, disagree: 0, unanswered: 0, unknown: [] });
    expect(r.lines).toEqual(items.map((i) => `agree       ${i.seedKey} (${i.item.skillTag})`));
  });

  it("reports a disagreement with the solver's answer and the key next to each other", () => {
    const r = compareBlind(items, parseAnswerFile(answers([1])));
    expect(r).toMatchObject({ agree: 6, disagree: 1, unanswered: 0 });
    expect(r.lines[1]).toBe(`DISAGREE    ${key(1)} (reading.detail)  score=0\n              solver: z\n              key:    b`);
  });

  it("counts a half-right statement list as one unit right and one wrong, in the section's tally", () => {
    const r = compareBlind(items, parseAnswerFile(answers([], [], [0])));
    expect(r.lines[0]).toContain("DISAGREE");
    expect(r.lines[0]).toContain("score=0.5");
    expect(r.sections[0]).toEqual({ section: "READING", items: 3, units: 4, agreeUnits: 3, disagreeUnits: 1, unansweredUnits: 0 });
    expect(formatSectionTally(r.sections[0])).toBe("READING: 4 units in 3 items, 3 agree, 1 disagree, 0 unanswered");
  });

  it("tallies the sections in serving order, with a gap text counted in its gaps and a blank item as unanswered", () => {
    const r = compareBlind(items, parseAnswerFile(answers([3], [4])));
    expect(r.sections.map((s) => [s.section, s.items, s.units, s.agreeUnits, s.disagreeUnits, s.unansweredUnits])).toEqual([
      ["READING", 3, 4, 4, 0, 0],
      ["GRAMMAR", 2, 3, 0, 1, 2],
      ["LISTENING", 2, 2, 2, 0, 0],
    ]);
    expect(r).toMatchObject({ agree: 5, disagree: 1, unanswered: 1 });
  });

  it("lists keys the answers name that are not among the items, such as another form's", () => {
    const other = courseBlindItems(fixtureCourseForm("B1.1", "B"));
    const r = compareBlind(items, parseAnswerFile(`${answers()}\n${other[0].seedKey}: s1=R, s2=F`));
    expect(r.unknown).toEqual([other[0].seedKey]);
  });
});

describe("courseExports", () => {
  const forms = [fixtureCourseForm("B1.1", "A"), fixtureCourseForm("B1.1", "B"), fixtureCourseForm("B1", "A")];

  it("writes one named file for one form, with the form in its title and a note on the tasks that are not solved", () => {
    const [f] = courseExports("B1.1:A", forms);
    expect(f).toMatchObject({ formKey: "B1.1:A", file: "blind-course-b1-1-a.md", items: 7 });
    expect(f.text.split("\n")[0]).toBe("# Blind solve: Zwischentest B1.1, Form A (B1.1:A)");
    expect(f.text).toContain("Its 2 writing and speaking tasks have no key and are not part of the blind solve.");
    expect(courseExports("b1:a", forms)[0].text.split("\n")[0]).toBe("# Blind solve: Abschlusstest B1, Form A (B1:A)");
  });

  it("writes a file per form for all, into the folder asked for", () => {
    const files = courseExports("all", forms, { outDir: "blind" });
    expect(files.map((f) => f.file)).toEqual(["blind/blind-course-b1-1-a.md", "blind/blind-course-b1-1-b.md", "blind/blind-course-b1-a.md"]);
    expect(courseExports("all", forms).map((f) => f.file)[0]).toBe("blind-course-b1-1-a.md");
  });

  it("lets --out name the file of one form, and refuses it for several", () => {
    expect(courseExports("B1.1:B", forms, { out: "my.md" })[0].file).toBe("my.md");
    expect(() => courseExports("all", forms, { out: "my.md" })).toThrow(/--out names one file/);
  });

  it("writes nothing when there are no forms for all, and refuses a form that is not there", () => {
    expect(courseExports("all", [])).toEqual([]);
    expect(() => courseExports("A1:A", [])).toThrow(/not in the seed/);
  });

  it("gives a form's answer template lines that the answers parser reads back", () => {
    const [f] = courseExports("B1.1:A", forms);
    const template = f.text.split("\n").filter((l) => /^course-b1-1-a-\S+: /.test(l));
    expect(template).toHaveLength(7);
    expect([...parseAnswerFile(template.join("\n")).keys()]).toEqual(items.map((i) => i.seedKey));
  });
});

describe("courseComparison", () => {
  const forms = [fixtureCourseForm("B1.1", "A"), fixtureCourseForm("B1.1", "B")];
  const aItems = courseBlindItems(forms[0]);
  const rightLines = (list: typeof aItems) =>
    list
      .map((it) => {
        const k = it.item.key;
        if (k.kind === "CHOICE") return `${it.seedKey}: choice=${k.correct.join(",")}`;
        if (k.kind === "TFNG") return `${it.seedKey}: ${Object.entries(k.answers).map(([id, v]) => `${id}=${v}`).join(", ")}`;
        if (k.kind === "GAP") return `${it.seedKey}: ${Object.entries(k.answers).map(([id, v]) => `${id}=${v[0]}`).join(", ")}`;
        return `${it.seedKey}: ...`;
      })
      .join("\n");

  it("prints one form with its items, section tallies in units and the totals", () => {
    const out = courseComparison("B1.1:A", forms, parseAnswerFile(rightLines(aItems)));
    expect(out[0]).toBe("\n== Zwischentest B1.1, Form A (B1.1:A)");
    expect(out.filter((l) => l.startsWith("agree"))).toHaveLength(7);
    expect(out).toContain("  READING: 4 units in 3 items, 4 agree, 0 disagree, 0 unanswered");
    expect(out).toContain("  GRAMMAR: 3 units in 2 items, 3 agree, 0 disagree, 0 unanswered");
    expect(out).toContain("  LISTENING: 2 units in 2 items, 2 agree, 0 disagree, 0 unanswered");
    expect(out.at(-1)).toBe("  7 items: 7 agree, 0 disagree, 0 unanswered");
  });

  it("compares every form for all, and names an answer line of no selected form", () => {
    const bItems = courseBlindItems(forms[1]);
    const answers = parseAnswerFile(`${rightLines(aItems)}\n${rightLines(bItems.slice(0, 3))}\ncourse-b1-a-reading-b1-0123456789abcdef: s1=R`);
    const out = courseComparison("all", forms, answers);
    expect(out.filter((l) => l.startsWith("\n== "))).toEqual(["\n== Zwischentest B1.1, Form A (B1.1:A)", "\n== Zwischentest B1.1, Form B (B1.1:B)"]);
    expect(out.filter((l) => l.startsWith("  7 items"))).toEqual(["  7 items: 7 agree, 0 disagree, 0 unanswered", "  7 items: 3 agree, 0 disagree, 4 unanswered"]);
    expect(out.at(-1)).toBe("UNKNOWN KEY in answers file (not an objective item of the selected course forms): course-b1-a-reading-b1-0123456789abcdef");
  });

  it("says so when there are no forms", () => {
    expect(courseComparison("all", [], new Map())).toEqual(["There are no course forms in the seed yet. Nothing to compare."]);
  });
});
