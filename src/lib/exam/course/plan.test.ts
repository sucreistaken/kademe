import { describe, expect, it } from "vitest";
import { coursePlanOf, type CoursePlanRow } from "./plan";

const row = (id: string, courseOrder: number | null, orderInStimulus = 0, audioKey: string | null = null): CoursePlanRow => ({ id, courseOrder, orderInStimulus, audioKey });

describe("coursePlanOf", () => {
  it("serves a section's items by course order, whatever order the database returned them in", () => {
    const rows = [row("c", 3), row("a", 1), row("d", 4), row("b", 2)];
    expect(coursePlanOf(rows, "READING")).toEqual(["a", "b", "c", "d"]);
    expect(coursePlanOf([...rows].reverse(), "READING")).toEqual(["a", "b", "c", "d"]);
    expect(coursePlanOf(rows, "GRAMMAR")).toEqual(["a", "b", "c", "d"]);
  });

  it("is the same plan every time: nothing drawn at random", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`item-${i}`, i + 1));
    const first = coursePlanOf(rows, "GRAMMAR");
    for (let k = 0; k < 20; k++) {
      const shuffled = [...rows].sort(() => Math.random() - 0.5);
      expect(coursePlanOf(shuffled, "GRAMMAR")).toEqual(first);
    }
  });

  it("puts an item without a position last, then breaks ties by its place in its text and by id", () => {
    const rows = [row("z-none", null), row("tie-b", 5, 2), row("tie-a", 5, 1), row("first", 1), row("a-none", null)];
    expect(coursePlanOf(rows, "READING")).toEqual(["first", "tie-a", "tie-b", "a-none", "z-none"]);
    // Same position and same place in the text: the id decides, so two reads agree.
    expect(coursePlanOf([row("b", 2, 1), row("a", 2, 1)], "READING")).toEqual(["a", "b"]);
  });

  it("serves writing and speaking tasks in order too", () => {
    expect(coursePlanOf([row("card", 2), row("intro", 1), row("proposal", 3)], "SPEAKING")).toEqual(["intro", "card", "proposal"]);
    expect(coursePlanOf([row("email", 1)], "WRITING")).toEqual(["email"]);
  });

  it("leaves out a listening item whose clip has no audio, and only there", () => {
    const rows = [row("heard-1", 1, 0, "audio/a.mp3"), row("silent", 2, 0, null), row("heard-2", 3, 0, "audio/b.mp3")];
    expect(coursePlanOf(rows, "LISTENING")).toEqual(["heard-1", "heard-2"]);
    // Reading and grammar items have no clip: a missing audio key is the normal case there.
    expect(coursePlanOf(rows, "READING")).toEqual(["heard-1", "silent", "heard-2"]);
  });

  it("does not change the rows it is given", () => {
    const rows = [row("b", 2), row("a", 1)];
    coursePlanOf(rows, "READING");
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("is empty for a section the form has nothing in", () => {
    expect(coursePlanOf([], "READING")).toEqual([]);
    expect(coursePlanOf([row("silent", 1, 0, null)], "LISTENING")).toEqual([]);
  });
});
