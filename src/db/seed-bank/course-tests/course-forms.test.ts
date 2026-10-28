import { describe, expect, it } from "vitest";
import { courseSections, COURSE_TESTS } from "@/lib/exam/course/catalog";
import { COURSE_FORMS, COURSE_KEYS, courseFormKey } from "@/lib/exam/course/types";
import { courseUnits } from "@/lib/exam/course/units";
import { topicOf, TOPICS } from "@/lib/exam/topics";
import { CLOZE_SKILL_TAG } from "@/lib/exam/types";
import { validateItem } from "@/lib/exam/validate";
import { seedItemKey } from "../seed-key";
import { COURSE_FORMS_SEED } from "./index";

/**
 * Every course test form follows the spec (2026-10-28, "Format"): telc
 * section order, the catalog's unit counts, the course's level, sound items,
 * topics the student analysis can name, and the bank's item-writing rules.
 */

const EM_DASH = "—";
const textsOf = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(textsOf) : v && typeof v === "object" ? Object.values(v).flatMap(textsOf) : []);

describe("course test forms", () => {
  it("has forms A and B of every course test", () => {
    const keys = COURSE_FORMS_SEED.map((f) => courseFormKey(f.key, f.form)).sort();
    expect(keys).toEqual(COURSE_KEYS.flatMap((k) => COURSE_FORMS.map((f) => courseFormKey(k, f))).sort());
  });

  it("has at most one form per course key and form letter", () => {
    const keys = COURSE_FORMS_SEED.map((f) => courseFormKey(f.key, f.form));
    expect(new Set(keys).size).toBe(keys.length);
  });

  for (const form of COURSE_FORMS_SEED) {
    const name = courseFormKey(form.key, form.form);
    const test = COURSE_TESTS[form.key];
    const plan = courseSections(form.key);

    describe(name, () => {
      it("names its syllabus source and topics", () => {
        expect(form.syllabus.source.trim().length, "source").toBeGreaterThan(5);
        expect(form.syllabus.chapters.trim().length, "chapters").toBeGreaterThan(3);
        expect(form.syllabus.topics.length, "topics").toBeGreaterThanOrEqual(3);
      });

      it("has the catalog's sections in telc order", () => {
        expect(form.sections.map((s) => s.section)).toEqual(plan.map((p) => p.section));
      });

      for (const p of plan) {
        it(`${p.section}: has the catalog's ${p.units} ${p.section === "WRITING" || p.section === "SPEAKING" ? "tasks" : "scored units"}`, () => {
          const s = form.sections.find((x) => x.section === p.section);
          expect(s, p.section).toBeDefined();
          const n = p.section === "WRITING" || p.section === "SPEAKING" ? s!.items.length : s!.items.reduce((a, i) => a + courseUnits(i), 0);
          expect(n).toBe(p.units);
        });
      }

      it("keeps every item and text in its section at the course's level", () => {
        for (const s of form.sections) {
          for (const i of s.items) {
            expect(i.section, i.prompt).toBe(s.section);
            expect(i.level, i.prompt).toBe(test.level);
          }
          for (const st of s.stimuli) {
            expect(st.section, st.key).toBe(s.section);
            expect(st.level, st.key).toBe(test.level);
          }
        }
      });

      it("has only valid items", () => {
        for (const s of form.sections) for (const i of s.items) expect(validateItem(i), `${s.section}: ${i.prompt.slice(0, 60)}`).toEqual([]);
      });

      it("points every item's text at a text of the same section, and every text is used", () => {
        for (const s of form.sections) {
          const keys = new Set(s.stimuli.map((x) => x.key));
          const used = new Set(s.items.flatMap((i) => (i.stimulusKey ? [i.stimulusKey] : [])));
          for (const k of used) expect(keys.has(k), `${s.section}: ${k}`).toBe(true);
          for (const k of keys) expect(used.has(k), `${s.section}: unused ${k}`).toBe(true);
        }
      });

      it("resolves every objective skill tag and every cloze gap topic to a topic the analysis can name", () => {
        for (const s of form.sections) {
          if (s.section === "WRITING" || s.section === "SPEAKING") continue;
          for (const i of s.items) {
            expect(TOPICS[topicOf(i.skillTag)], i.skillTag).toBeDefined();
            if (i.skillTag === CLOZE_SKILL_TAG) {
              expect(i.key.kind === "GAP" && i.key.topics, `${i.prompt.slice(0, 40)}: gap topics`).toBeTruthy();
              if (i.key.kind !== "GAP" || i.content.kind !== "GAP") continue;
              for (const g of i.content.gaps) {
                const t = i.key.topics?.[g.id];
                expect(t, `gap ${g.id} has a topic`).toBeDefined();
                expect(TOPICS[topicOf(t!)], `gap ${g.id}: ${t}`).toBeDefined();
                expect(TOPICS[topicOf(t!)].format, `gap ${g.id}: ${t} is a format`).toBeUndefined();
              }
            }
          }
        }
      });

      it("uses Richtig / Falsch up to B1 and adds Nicht im Text at B2", () => {
        for (const s of form.sections) {
          for (const i of s.items) {
            if (i.content.kind !== "TFNG" || i.key.kind !== "TFNG") continue;
            if (test.level === "B2") expect(i.content.twoWay, i.prompt).toBeFalsy();
            else {
              expect(i.content.twoWay, i.prompt).toBe(true);
              expect(Object.values(i.key.answers), i.prompt).not.toContain("NG");
            }
          }
        }
      });

      it("writes a rubric for the writing task and allows one take per speaking task", () => {
        const writing = form.sections.find((s) => s.section === "WRITING")!.items;
        for (const w of writing) {
          expect(w.type).toBe("WRITING_PROMPT");
          expect(w.rubric?.contentPoints.length, "Leitpunkte").toBeGreaterThanOrEqual(3);
          expect(w.rubric?.register, "register").toBeTruthy();
          expect(w.rubric?.studentPoints?.length, "student points").toBeGreaterThanOrEqual(3);
        }
        const speaking = form.sections.find((s) => s.section === "SPEAKING")!.items;
        for (const sp of speaking) {
          expect(sp.type).toBe("SPEAKING_PROMPT");
          expect(sp.content.kind === "SPEAKING" && sp.content.maxTakes, sp.prompt).toBe(1);
          expect(sp.rubric?.contentPoints.length, `${sp.prompt.slice(0, 40)}: points`).toBeGreaterThanOrEqual(2);
        }
      });

      it("never uses the em-dash", () => {
        for (const s of form.sections) {
          for (const t of [...textsOf(s.items), ...textsOf(s.stimuli)]) expect(t.includes(EM_DASH), t.slice(0, 60)).toBe(false);
        }
        for (const t of textsOf(form.syllabus)) expect(t.includes(EM_DASH), t.slice(0, 60)).toBe(false);
      });

      it("never asks about origin, age or religion", () => {
        const banned = /\b(herkunft|heimatland|herkunftsland|woher kommen sie|wie alt sind sie|religion|religiös)\b/i;
        for (const s of form.sections) for (const t of [...textsOf(s.items), ...textsOf(s.stimuli)]) expect(banned.test(t), t.slice(0, 80)).toBe(false);
      });
    });
  }

  it("gives every item a seed key that no other course item or bank item shares", () => {
    const keys = COURSE_FORMS_SEED.flatMap((f) => f.sections.flatMap((s) => s.items.map((i) => `${courseFormKey(f.key, f.form)}|${seedItemKey(i)}`)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every text a unique key", () => {
    const keys = COURSE_FORMS_SEED.flatMap((f) => f.sections.flatMap((s) => s.stimuli.map((x) => x.key)));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
