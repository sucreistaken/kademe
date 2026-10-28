import { describe, expect, it } from "vitest";
import { COURSE_KEYS, COURSE_FORMS } from "@/lib/exam/course/types";
import { SEED_BANK } from "./index";
import { COURSE_FORMS_SEED } from "./course-tests";
import { courseItemSeedKey, courseSeed, courseSeedPrefix, courseStimulusSeedKey, isCourseSeedKey } from "./course-seed";
import { fixtureCourseForm } from "./course-fixture";
import { seedItemKey } from "./seed-key";

describe("course seed keys", () => {
  it("name the form in a prefix that is the same for every row of the form and differs between forms", () => {
    expect(courseSeedPrefix("B1.1", "A")).toBe("course-b1-1-a-");
    expect(courseSeedPrefix("B1", "B")).toBe("course-b1-b-");
    const prefixes = COURSE_KEYS.flatMap((k) => COURSE_FORMS.map((f) => courseSeedPrefix(k, f)));
    expect(new Set(prefixes).size).toBe(16);
    // No prefix is the front of another one, so a key tells its form without guessing.
    for (const p of prefixes) for (const q of prefixes) if (p !== q) expect(q.startsWith(p)).toBe(false);
  });

  it("put the form in front of the bank's content hash for items and of the author's key for texts", () => {
    const form = fixtureCourseForm("B1.1", "A");
    const item = form.sections[0].items[0];
    expect(courseItemSeedKey("B1.1", "A", item)).toBe(`course-b1-1-a-${seedItemKey(item)}`);
    expect(courseItemSeedKey("B1.1", "A", item)).toMatch(/^course-b1-1-a-reading-b1-[0-9a-f]{16}$/);
    expect(courseStimulusSeedKey("B1.1", "A", "fx-r-reise")).toBe("course-b1-1-a-fx-r-reise");
  });

  it("never equal a bank key: no bank item or text key starts with the course prefix", () => {
    expect(SEED_BANK.items.filter((i) => isCourseSeedKey(seedItemKey(i)))).toEqual([]);
    expect(SEED_BANK.stimuli.filter((s) => isCourseSeedKey(s.key))).toEqual([]);
    const course = courseSeed([fixtureCourseForm()]);
    for (const r of [...course.items.map((i) => i.seedKey), ...course.stimuli.map((s) => s.seedKey)]) expect(isCourseSeedKey(r)).toBe(true);
    const bankKeys = new Set([...SEED_BANK.items.map(seedItemKey), ...SEED_BANK.stimuli.map((s) => s.key)]);
    for (const r of [...course.items.map((i) => i.seedKey), ...course.stimuli.map((s) => s.seedKey)]) expect(bankKeys.has(r)).toBe(false);
  });
});

describe("courseSeed", () => {
  const seed = courseSeed([fixtureCourseForm("B1.1", "A")]);

  it("lists the items in serving order: sections in the form's order, items as written", () => {
    expect(seed.items.map((i) => [i.item.section, i.item.prompt])).toEqual([
      ["READING", "Richtig oder falsch?"],
      ["READING", "Welcher Text passt?"],
      ["READING", "Wann fährt Anna?"],
      ["GRAMMAR", "Ich ___ müde."],
      ["GRAMMAR", "Ich bleibe zu Hause, {{g1}} es regnet. Er {{g2}} müde."],
      ["LISTENING", "Von welchem Gleis fährt der Zug?"],
      ["LISTENING", "Wohin fährt der Zug?"],
      ["WRITING", "Schreiben Sie eine E-Mail an Frau Schneider."],
      ["SPEAKING", "Stellen Sie sich vor."],
    ]);
  });

  it("numbers course_order from 0 inside each section", () => {
    expect(seed.items.map((i) => [i.item.section, i.courseOrder])).toEqual([
      ["READING", 0],
      ["READING", 1],
      ["READING", 2],
      ["GRAMMAR", 0],
      ["GRAMMAR", 1],
      ["LISTENING", 0],
      ["LISTENING", 1],
      ["WRITING", 0],
      ["SPEAKING", 0],
    ]);
  });

  it("numbers order_in_stimulus like the bank: 1-based among the items of one text, 0 without a text", () => {
    expect(seed.items.map((i) => i.orderInStimulus)).toEqual([1, 0, 2, 0, 0, 1, 2, 0, 0]);
  });

  it("points each item at the seed key of its own text", () => {
    const keys = seed.items.map((i) => i.stimulusSeedKey);
    expect(keys).toEqual([
      "course-b1-1-a-fx-r-reise",
      null,
      "course-b1-1-a-fx-r-reise",
      null,
      null,
      "course-b1-1-a-fx-l-durchsage",
      "course-b1-1-a-fx-l-durchsage",
      null,
      null,
    ]);
    expect(seed.stimuli.map((s) => [s.seedKey, s.courseForm, s.stimulus.section])).toEqual([
      ["course-b1-1-a-fx-r-reise", "B1.1:A", "READING"],
      ["course-b1-1-a-fx-l-durchsage", "B1.1:A", "LISTENING"],
    ]);
    for (const i of seed.items) expect(i.courseForm).toBe("B1.1:A");
  });

  it("stores the same content of two forms under different keys, texts included", () => {
    const both = courseSeed([fixtureCourseForm("B1.1", "A"), fixtureCourseForm("B1.1", "B")]);
    const keys = [...both.items.map((i) => i.seedKey), ...both.stimuli.map((s) => s.seedKey)];
    expect(new Set(keys).size).toBe(keys.length);
    expect(both.items).toHaveLength(18);
    expect(both.items.filter((i) => i.courseForm === "B1.1:B").map((i) => i.courseOrder)).toEqual(both.items.filter((i) => i.courseForm === "B1.1:A").map((i) => i.courseOrder));
  });

  it("starts the order again in each form and each course", () => {
    const all = courseSeed([fixtureCourseForm("B1.1", "A"), fixtureCourseForm("B1", "A")]);
    for (const form of ["B1.1:A", "B1:A"]) {
      expect(all.items.filter((i) => i.courseForm === form && i.item.section === "READING").map((i) => i.courseOrder)).toEqual([0, 1, 2]);
    }
  });

  it("is empty for no forms, and for today's course content", () => {
    expect(courseSeed([])).toEqual({ stimuli: [], items: [] });
    // Content authors fill COURSE_FORMS_SEED; whatever it holds must be storable as written.
    expect(() => courseSeed(COURSE_FORMS_SEED)).not.toThrow();
  });

  it("refuses a form it could not store faithfully", () => {
    const wrongSection = fixtureCourseForm();
    wrongSection.sections[1].items.push({ ...wrongSection.sections[0].items[1], prompt: "Falscher Abschnitt" });
    expect(() => courseSeed([wrongSection])).toThrow(/B1\.1:A: a READING item sits in the GRAMMAR section/);

    const missingText = fixtureCourseForm();
    missingText.sections[0].stimuli = [];
    expect(() => courseSeed([missingText])).toThrow(/text "fx-r-reise" is not in the READING section/);

    const otherSection = fixtureCourseForm();
    otherSection.sections[2].items[0] = { ...otherSection.sections[2].items[0], stimulusKey: "fx-r-reise" };
    expect(() => courseSeed([otherSection])).toThrow(/text "fx-r-reise" is not in the LISTENING section/);

    const twinItems = fixtureCourseForm();
    twinItems.sections[1].items.push({ ...twinItems.sections[1].items[0] });
    expect(() => courseSeed([twinItems])).toThrow(/two identical items/);

    const twinTexts = fixtureCourseForm();
    twinTexts.sections[0].stimuli.push({ ...twinTexts.sections[0].stimuli[0] });
    expect(() => courseSeed([twinTexts])).toThrow(/text "fx-r-reise" is defined twice/);

    const wrongKind = fixtureCourseForm();
    wrongKind.sections[0].stimuli[0] = { ...wrongKind.sections[0].stimuli[0], section: "LISTENING" };
    expect(() => courseSeed([wrongKind])).toThrow(/is a LISTENING text in the READING section/);

    expect(() => courseSeed([fixtureCourseForm("B1.1", "A"), fixtureCourseForm("B1.1", "A")])).toThrow(/defined twice/);
  });
});
