import { describe, expect, it } from "vitest";
import { clearDraft, draftAfterSaved, draftAfterSend, draftKey, lostWords, markLostWords, readDraft, restoreText, writeDraft, type Draft, type DraftStorage } from "./draft-store";

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

describe("a reload while a save is on its way (fix round 2: the copy also knows what was sent)", () => {
  /** The text field's steps, as it writes its copy: type, send, type again. */
  const typed = (d: Draft, text: string): Draft => ({ ...d, text });

  it("restores ABC when the server holds AB that was sent but not confirmed before the reload", () => {
    // The field opened on "A" (the server's text).
    let d: Draft = { text: "A", base: "A" };
    d = typed(d, "AB");
    d = draftAfterSend(d, "AB"); // PUT "AB" leaves; no answer yet
    d = typed(d, "ABC"); // "C" typed; reload before the PUT answers
    expect(d).toEqual({ text: "ABC", base: "A", pending: "AB" });
    // The PUT landed before the reloaded page read the database.
    expect(restoreText("AB", d)).toEqual({ text: "ABC", restored: true, drop: false });
    // It had not landed yet: the old base still matches.
    expect(restoreText("A", d)).toEqual({ text: "ABC", restored: true, drop: false });
  });

  it("still lets another device's text win over a copy with a save on its way", () => {
    const d: Draft = { text: "ABC", base: "A", pending: "AB" };
    expect(restoreText("Written on the phone", d)).toEqual({ text: "Written on the phone", restored: false, drop: true });
  });

  it("moves the base on a confirmed save and forgets the copy when nothing is left unsaved", () => {
    const sent = draftAfterSend({ text: "ABC", base: "A" }, "AB");
    expect(draftAfterSaved(sent, "AB")).toEqual({ text: "ABC", base: "AB" });
    expect(draftAfterSaved({ text: "AB", base: "A", pending: "AB" }, "AB")).toBeNull();
    // An older save confirmed after a newer one left keeps the newer one pending.
    expect(draftAfterSaved({ text: "ABCD", base: "A", pending: "ABC" }, "AB")).toEqual({ text: "ABCD", base: "AB", pending: "ABC" });
  });

  it("reads and writes the pending text with the copy", () => {
    const s = memory();
    writeDraft(s, "k", { text: "ABC", base: "A", pending: "AB" });
    expect(readDraft(s, "k")).toEqual({ text: "ABC", base: "A", pending: "AB" });
    s.setItem("k", JSON.stringify({ text: "x", base: "", pending: 4 }));
    expect(readDraft(s, "k")).toEqual({ text: "x", base: "" });
  });
});

describe("an older save that lands after a newer one (Task 13 residual, plan decision 15)", () => {
  it("keeps the two earlier sent texts, so a reload still restores the tab's newest typing over either", () => {
    let copy = { text: "A", base: "" } as Draft;
    copy = draftAfterSend(copy, "A");
    copy = draftAfterSend({ ...copy, text: "AB" }, "AB");
    copy = { ...copy, text: "ABC" };
    expect(copy).toMatchObject({ pending: "AB", older: ["A"] });
    // The server's last write was the older "A" (it landed after "AB").
    expect(restoreText("A", copy)).toEqual({ text: "ABC", restored: true, drop: false });
    // Another device's text still wins.
    expect(restoreText("X", copy)).toEqual({ text: "X", restored: false, drop: true });
  });

  it("keeps at most two older texts and reads them back from storage", () => {
    let copy = { text: "", base: "" } as Draft;
    for (const sent of ["1", "12", "123", "1234"]) copy = draftAfterSend({ ...copy, text: sent }, sent);
    expect(copy.older).toEqual(["123", "12"]);
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    writeDraft(storage, "k", copy);
    expect(readDraft(storage, "k")).toEqual(copy);
  });
});

describe("words the server refused after the deadline (Minor 6)", () => {
  it("remembers, per link and stage, that the last change could not be saved, and whether it was text or a choice", () => {
    const s = memory();
    expect(lostWords(s, "tok", 1)).toBeNull();
    markLostWords(s, "tok", 1, "text");
    expect(lostWords(s, "tok", 1)).toBe("text");
    markLostWords(s, "tok", 3, "choice");
    expect(lostWords(s, "tok", 3)).toBe("choice");
    expect(lostWords(s, "tok", 2)).toBeNull();
    expect(lostWords(s, "other", 1)).toBeNull();
    expect(lostWords(broken, "tok", 1)).toBeNull();
    expect(() => markLostWords(broken, "tok", 1, "text")).not.toThrow();
  });
});
