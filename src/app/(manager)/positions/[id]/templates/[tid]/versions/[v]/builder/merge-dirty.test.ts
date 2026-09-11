import { describe, it, expect } from "vitest";
import { EMPTY_DIRTY, clearDirty, markDirty, mergeDirty } from "./merge-dirty";

type Activity = { id: string; prompt: string; seconds: number };
type Stage = { id: string; name: string; activities: Activity[] };

const server: Stage[] = [
  {
    id: "s1",
    name: "Server name",
    activities: [{ id: "a1", prompt: "Server prompt", seconds: 60 }],
  },
];

describe("dirty field merge", () => {
  it("returns the server tree untouched when nothing is dirty", () => {
    const local = structuredClone(server);
    local[0].name = "Typed but saved already";
    expect(mergeDirty(server, local, EMPTY_DIRTY)).toBe(server);
  });

  it("keeps a half typed field when the refresh lands", () => {
    const local = structuredClone(server);
    local[0].activities[0].prompt = "Half typed";
    const dirty = markDirty(EMPTY_DIRTY, "a1", ["prompt"]);
    const merged = mergeDirty(server, local, dirty);
    expect(merged[0].activities[0].prompt).toBe("Half typed");
    // The field that was not being edited takes the server's value.
    expect(merged[0].activities[0].seconds).toBe(60);
  });

  it("takes the server value again once the field has been saved", () => {
    const local = structuredClone(server);
    local[0].name = "Typed";
    let dirty = markDirty(EMPTY_DIRTY, "s1", ["name"]);
    dirty = clearDirty(dirty, "s1", ["name"]);
    expect(mergeDirty(server, local, dirty)[0].name).toBe("Server name");
  });

  it("lets the server win on structure: a stage deleted elsewhere stays deleted", () => {
    const local: Stage[] = [
      ...structuredClone(server),
      { id: "s2", name: "Gone on the server", activities: [] },
    ];
    const dirty = markDirty(EMPTY_DIRTY, "s2", ["name"]);
    expect(mergeDirty(server, local, dirty).map((s) => s.id)).toEqual(["s1"]);
  });

  it("never overlays the activities list itself", () => {
    const local = structuredClone(server);
    local[0].activities = [];
    const dirty = markDirty(EMPTY_DIRTY, "s1", ["activities"]);
    expect(mergeDirty(server, local, dirty)[0].activities).toHaveLength(1);
  });

  it("clearing an unknown key leaves the map alone", () => {
    const dirty = markDirty(EMPTY_DIRTY, "s1", ["name"]);
    expect(clearDirty(dirty, "s1", ["other"])).toBe(dirty);
    expect(clearDirty(dirty, "nobody", ["name"])).toBe(dirty);
  });
});
