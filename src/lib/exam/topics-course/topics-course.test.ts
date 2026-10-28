import { describe, expect, it } from "vitest";
import { A1_COURSE_TOPICS } from "./a1";
import { A2_COURSE_TOPICS } from "./a2";
import { B1_COURSE_TOPICS } from "./b1";
import { B2_COURSE_TOPICS } from "./b2";
import { TOPICS } from "../topics";

describe("course topic files", () => {
  const files = { A1_COURSE_TOPICS, A2_COURSE_TOPICS, B1_COURSE_TOPICS, B2_COURSE_TOPICS };
  const courseIds = Object.values(files).flatMap((f) => Object.keys(f));

  it("never repeat an id between levels (a spread would silently keep only the last)", () => {
    expect(new Set(courseIds).size).toBe(courseIds.length);
  });

  it("never redefine an id of the base catalog", () => {
    const base = Object.keys(TOPICS).length - courseIds.length;
    expect(base).toBeGreaterThan(30);
    for (const [name, f] of Object.entries(files)) for (const [id, topic] of Object.entries(f)) expect(TOPICS[id], `${name}: ${id}`).toBe(topic);
  });

  it("label every course topic in all five candidate languages", () => {
    for (const f of Object.values(files)) for (const [id, t] of Object.entries(f)) for (const l of ["tr", "en", "de", "es", "ar"] as const) expect(t.label[l]?.trim(), `${id} ${l}`).toBeTruthy();
  });
});
