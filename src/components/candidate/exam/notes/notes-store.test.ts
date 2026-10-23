import { describe, expect, it } from "vitest";
import { clearAllNotes, fnv1a, loadNotes, notesKey, saveNotes, stemsContentKey, type NotesStorage } from "@/components/candidate/exam/notes/notes-store";
import { MAX_TEXT } from "@/components/candidate/exam/notes/notes-model";

function fake(): NotesStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("notes store", () => {
  it("builds a stable key from token, section position and a text hash", () => {
    const k = notesKey("tok", 2, "Titel", "Text");
    expect(k).toBe(`kademe.exam.notes.tok.2.${fnv1a("Titel\nText")}`);
    expect(notesKey("tok", 2, "Titel", "Text")).toBe(k);
    expect(notesKey("tok", 2, "Titel", "Text!")).not.toBe(k);
  });
  it("saves, loads and removes empty notes", () => {
    const s = fake();
    const data = { marks: [{ start: 0, end: 3, kind: "highlight" as const, color: "yellow" as const }], strokes: [] };
    saveNotes(s, "k", data);
    expect(loadNotes(s, "k")).toEqual(data);
    saveNotes(s, "k", { marks: [], strokes: [] });
    expect(s.map.size).toBe(0);
  });
  it("clears only the keys of one token", () => {
    const s = fake();
    s.setItem(notesKey("a", 1, "t", "x"), "{}");
    s.setItem(notesKey("a", 2, "t", "y"), "{}");
    s.setItem(notesKey("ab", 1, "t", "x"), "{}");
    s.setItem("other", "1");
    clearAllNotes("a", s);
    expect([...s.map.keys()].sort()).toEqual([notesKey("ab", 1, "t", "x"), "other"].sort());
  });
  it("survives storage that throws or is missing", () => {
    const bad = { length: 0, key: () => null, getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    expect(loadNotes(bad, "k")).toEqual({ marks: [], strokes: [] });
    expect(() => saveNotes(bad, "k", { marks: [{ start: 0, end: 1, kind: "highlight", color: "pink" }], strokes: [] })).not.toThrow();
    expect(() => clearAllNotes("a", bad)).not.toThrow();
    expect(() => clearAllNotes("a", null)).not.toThrow();
    expect(loadNotes(null, "k")).toEqual({ marks: [], strokes: [] });
  });
});

describe("stems key", () => {
  it("gives two recordings that share a prompt different note keys", () => {
    const a = notesKey("tok", 2, "stems", stemsContentKey("group", 5));
    const b = notesKey("tok", 2, "stems", stemsContentKey("group", 9));
    expect(a).not.toBe(b);
    expect(notesKey("tok", 2, "stems", stemsContentKey("item", 5))).not.toBe(a);
    expect(notesKey("tok", 2, "stems", stemsContentKey("group", 5))).toBe(a);
  });
});

describe("typed pad text", () => {
  it("saves and loads the text, and text alone keeps the notes non-empty", () => {
    const s = fake();
    saveNotes(s, "k", { marks: [], strokes: [], text: "Wortschatz: die Reise" });
    expect(loadNotes(s, "k").text).toBe("Wortschatz: die Reise");
    saveNotes(s, "k", { marks: [], strokes: [], text: undefined });
    expect(s.map.size).toBe(0);
  });
  it("reads notes stored before the text field existed", () => {
    const s = fake();
    s.setItem("k", JSON.stringify({ marks: [], strokes: [{ tool: "pen", points: [[1, 2]] }] }));
    const d = loadNotes(s, "k");
    expect(d.strokes).toHaveLength(1);
    expect(d.text).toBeUndefined();
  });
  it("caps the stored text at 5,000 characters and drops a non-string text", () => {
    const s = fake();
    saveNotes(s, "k", { marks: [], strokes: [], text: "ä".repeat(MAX_TEXT + 50) });
    expect(loadNotes(s, "k").text).toHaveLength(MAX_TEXT);
    s.setItem("k", JSON.stringify({ marks: [], strokes: [], text: 42 }));
    expect(loadNotes(s, "k").text).toBeUndefined();
  });
});
