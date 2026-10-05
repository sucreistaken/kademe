import { describe, expect, it } from "vitest";
import { clearDraft, draftKey, lostWords, markLostWords, readDraft, restoreText, writeDraft, type DraftStorage } from "./draft-store";

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
  it("keys a draft by link, stage, the stage's run and question: another link, or a later run, never sees it", () => {
    const key = draftKey("tokA", 1, "2026-10-05T10:00:00.000Z", "q1");
    expect(key).not.toBe(draftKey("tokB", 1, "2026-10-05T10:00:00.000Z", "q1"));
    expect(key).not.toBe(draftKey("tokA", 2, "2026-10-05T10:00:00.000Z", "q1"));
    expect(key).not.toBe(draftKey("tokA", 1, "2026-10-06T09:00:00.000Z", "q1"));
  });

  it("writes, reads and clears a draft with the server text it was typed over", () => {
    const s = memory();
    const key = draftKey("tok", 1, "run", "q1");
    expect(readDraft(s, key)).toBeNull();
    writeDraft(s, key, { text: "Yarım cümle", base: "" });
    expect(readDraft(s, key)).toEqual({ text: "Yarım cümle", base: "" });
    clearDraft(s, key);
    expect(readDraft(s, key)).toBeNull();
    // Anything else under the key (an older format, a hand edit) is no draft.
    s.setItem(key, "plain text");
    expect(readDraft(s, key)).toBeNull();
    s.setItem(key, JSON.stringify({ text: 3, base: "" }));
    expect(readDraft(s, key)).toBeNull();
  });

  it("works without storage (private mode, blocked storage): nothing is restored, nothing throws", () => {
    expect(() => writeDraft(broken, "k", { text: "x", base: "" })).not.toThrow();
    expect(readDraft(broken, "k")).toBeNull();
    expect(() => clearDraft(null, "k")).not.toThrow();
    expect(readDraft(null, "k")).toBeNull();
  });
});

describe("restoring the copy only over the text it was typed on (review: base guard)", () => {
  it("restores the tab's newer typing when the server still holds the text the tab last knew (the reload race)", () => {
    expect(restoreText("Ekip ile çözdük.", { text: "Ekip ile çözdük. Hemen yenile.", base: "Ekip ile çözdük." })).toEqual({
      text: "Ekip ile çözdük. Hemen yenile.",
      restored: true,
      drop: false,
    });
    // A deletion is typing too.
    expect(restoreText("Silinecek", { text: "", base: "Silinecek" })).toEqual({ text: "", restored: true, drop: false });
  });

  it("keeps the server's text when it already is the copy (the beacon landed first)", () => {
    expect(restoreText("Aynı", { text: "Aynı", base: "Eski" })).toEqual({ text: "Aynı", restored: false, drop: false });
    expect(restoreText("Sunucuda", null)).toEqual({ text: "Sunucuda", restored: false, drop: false });
  });

  it("never overwrites newer text written elsewhere (another device): the server wins and the copy is dropped", () => {
    expect(restoreText("Telefondan yazılan yeni metin", { text: "Bu sekmenin eski metni", base: "Başlangıç" })).toEqual({
      text: "Telefondan yazılan yeni metin",
      restored: false,
      drop: true,
    });
  });
});

describe("words the server refused after the deadline (Minor 6)", () => {
  it("remembers, per link and stage, that the last words could not be saved, so the next intro says so", () => {
    const s = memory();
    expect(lostWords(s, "tok", 1)).toBe(false);
    markLostWords(s, "tok", 1);
    expect(lostWords(s, "tok", 1)).toBe(true);
    expect(lostWords(s, "tok", 2)).toBe(false);
    expect(lostWords(s, "other", 1)).toBe(false);
    expect(lostWords(broken, "tok", 1)).toBe(false);
    expect(() => markLostWords(broken, "tok", 1)).not.toThrow();
  });
});
