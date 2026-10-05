import { describe, expect, it } from "vitest";
import { clearDraft, draftKey, readDraft, restoreText, writeDraft, type DraftStorage } from "./draft-store";

function memory(): DraftStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}
const broken: DraftStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("the tab's own copy of a typed answer (a reload races the last save)", () => {
  it("keys a draft by link, stage and question, so another candidate's link in the same tab never sees it", () => {
    expect(draftKey("tokA", 1, "q1")).not.toBe(draftKey("tokB", 1, "q1"));
    expect(draftKey("tokA", 1, "q1")).not.toBe(draftKey("tokA", 2, "q1"));
  });

  it("writes, reads and clears a draft", () => {
    const s = memory();
    const key = draftKey("tok", 1, "q1");
    expect(readDraft(s, key)).toBeNull();
    writeDraft(s, key, "Yarım cümle");
    expect(readDraft(s, key)).toBe("Yarım cümle");
    writeDraft(s, key, "");
    expect(readDraft(s, key)).toBe("");
    clearDraft(s, key);
    expect(readDraft(s, key)).toBeNull();
  });

  it("works without storage (private mode, blocked storage): nothing is restored, nothing throws", () => {
    expect(() => writeDraft(broken, "k", "x")).not.toThrow();
    expect(readDraft(broken, "k")).toBeNull();
    expect(() => clearDraft(null, "k")).not.toThrow();
    expect(readDraft(null, "k")).toBeNull();
  });

  it("restores the tab's newer typing over what the server read before the last save landed", () => {
    expect(restoreText("Ekip ile çözdük.", "Ekip ile çözdük. Hemen yenile.")).toEqual({ text: "Ekip ile çözdük. Hemen yenile.", restored: true });
    // The tab's copy is its latest typing, a deletion included.
    expect(restoreText("Silinecek", "")).toEqual({ text: "", restored: true });
    expect(restoreText("Aynı", "Aynı")).toEqual({ text: "Aynı", restored: false });
    expect(restoreText("Sunucuda", null)).toEqual({ text: "Sunucuda", restored: false });
  });
});
