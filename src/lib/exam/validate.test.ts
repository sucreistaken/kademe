import { describe, expect, it } from "vitest";
import screensTr from "@/i18n/messages/screens.tr.json";
import screensEn from "@/i18n/messages/screens.en.json";
import { ROW_PROBLEM_CODES } from "./bank-sheet";
import { ITEM_PROBLEM_CODES, itemProblems, validateItem, type ValidatableItem } from "./validate";

const matching = (over: Partial<{ left: Array<{ id: string; text: string }>; right: Array<{ id: string; text: string }>; pairs: Record<string, string> }> = {}): ValidatableItem => ({
  type: "MATCHING",
  prompt: "Ordnen Sie zu.",
  content: {
    kind: "MATCHING",
    left: over.left ?? [{ id: "l1", text: "Hund" }, { id: "l2", text: "Katze" }],
    right: over.right ?? [{ id: "r1", text: "bellt" }, { id: "r2", text: "miaut" }, { id: "r3", text: "muht" }],
  },
  key: { kind: "MATCHING", pairs: over.pairs ?? { l1: "r1", l2: "r2" } },
});

const gap = (answers: Record<string, string[]>, gaps: Array<{ id: string; choices?: string[] }> = [{ id: "g1" }]): ValidatableItem => ({
  type: "GAP_FILL",
  prompt: "Ich warte {{g1}} dich.",
  content: { kind: "GAP", gaps },
  key: { kind: "GAP", answers },
});

const codes = (item: ValidatableItem) => itemProblems(item).map((p) => p.code);

describe("validateItem: matching", () => {
  it("passes a sound item", () => {
    expect(validateItem(matching())).toEqual([]);
  });

  it("refuses empty or repeated target texts", () => {
    expect(codes(matching({ right: [{ id: "r1", text: "bellt" }, { id: "r2", text: " " }] }))).toContain("MATCH_TARGET_EMPTY");
    expect(codes(matching({ right: [{ id: "r1", text: "bellt" }, { id: "r2", text: "Bellt " }] }))).toEqual(["MATCH_TARGET_TEXT_REPEAT"]);
  });

  it("refuses empty or repeated row texts", () => {
    expect(codes(matching({ left: [{ id: "l1", text: "" }, { id: "l2", text: "Katze" }] }))).toEqual(["MATCH_ROW_EMPTY"]);
    expect(codes(matching({ left: [{ id: "l1", text: "Katze" }, { id: "l2", text: "katze" }] }))).toEqual(["MATCH_ROW_TEXT_REPEAT"]);
  });

  it("refuses pairs keyed by an id that is not a row, and a row without a pair", () => {
    const p = itemProblems(matching({ pairs: { l1: "r1", l2: "r2", l9: "r3" } }));
    expect(p).toEqual([{ code: "MATCH_KEY_UNKNOWN_ROW", ids: ["l9"] }]);
    expect(validateItem(matching({ pairs: { l1: "r1", l2: "r2", l9: "r3" } }))).toEqual(["key pairs unknown rows l9"]);
    expect(itemProblems(matching({ pairs: { l1: "r1" } }))).toEqual([{ code: "MATCH_ROW_NO_TARGET", n: 2, ids: ["l2"] }]);
    expect(codes(matching({ pairs: { l1: "r1", l2: "r9" } }))).toEqual(["MATCH_ROW_NO_TARGET"]);
  });
});

describe("validateItem: gap fill", () => {
  it("refuses answers for gaps the item does not have", () => {
    expect(itemProblems(gap({ g1: ["auf"], g7: ["an"] }))).toEqual([{ code: "GAP_KEY_UNKNOWN", ids: ["g7"] }]);
  });

  it("refuses an empty drop-down choice", () => {
    expect(codes(gap({ g1: ["auf"] }, [{ id: "g1", choices: ["auf", "", "an"] }]))).toEqual(["GAP_CHOICE_EMPTY"]);
  });

  it("keeps the English sentences the engine and the AI repair prompt read", () => {
    expect(validateItem(gap({}))).toEqual(["gap g1 has no accepted answer"]);
    expect(validateItem({ ...gap({ g1: ["x"] }), prompt: "Ohne Marker." })).toEqual(["gaps without a marker: g1"]);
  });
});

describe("validateItem: the other new checks", () => {
  it("true/false: an empty statement and answers for unknown statements", () => {
    const item: ValidatableItem = {
      type: "TRUE_FALSE_NG",
      prompt: "Richtig oder falsch?",
      content: { kind: "TFNG", statements: [{ id: "s1", text: "Eins." }, { id: "s2", text: "" }] },
      key: { kind: "TFNG", answers: { s1: "R", s2: "F", s3: "NG" } },
    };
    expect(codes(item)).toEqual(["TFNG_EMPTY", "TFNG_KEY_UNKNOWN"]);
  });

  it("short text: a sensible length", () => {
    const item: ValidatableItem = { type: "SHORT_TEXT", prompt: "Gegenteil von teuer?", content: { kind: "SHORT_TEXT", maxChars: 0 }, key: { kind: "SHORT_TEXT", accepted: ["billig"] } };
    expect(codes(item)).toEqual(["SHORT_LENGTH"]);
  });

  it("an unknown type answers alone", () => {
    expect(validateItem({ ...gap({ g1: ["x"] }), type: "ESSAY" as never })).toEqual(["unknown item type ESSAY"]);
  });
});

describe("every problem has its sentence in both languages", () => {
  const tr = screensTr.bankTools as Record<string, string>;
  const en = screensEn.bankTools as Record<string, string>;
  it.each([...ITEM_PROBLEM_CODES.map((c) => `p_${c}`), ...ROW_PROBLEM_CODES.map((c) => `r_${c}`)])("%s", (key) => {
    expect(tr[key], key).toBeTruthy();
    expect(en[key], key).toBeTruthy();
  });
});
