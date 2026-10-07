import { describe, expect, it } from "vitest";
import { emptyActivity, type StagePayload } from "@/solutions/hiring/rules/patches";
import { packReviseUndo, unpackReviseUndo } from "./revise-undo";

const SECRET = "test-secret";
const scope = { orgId: "o1", openingId: "op1", versionId: "v2" };
const ACT = "11111111-1111-4111-8111-111111111111";
const stage: StagePayload = {
  name: { tr: "Aşama", en: "" },
  description: { tr: "", en: "" },
  internalPurpose: null,
  durationSeconds: 600,
  graceSeconds: 0,
  onTimeout: "AUTO_SUBMIT",
  backNavigation: false,
  activities: [{ ...emptyActivity("VIDEO"), prompt: { tr: "Soru", en: "" } }],
};
const at = (now: number) => ({ secret: SECRET, now });

describe("revise undo tokens", () => {
  it("hands back exactly what was replaced, for the same draft, within ten minutes", () => {
    const all = packReviseUndo(scope, { kind: "all", stages: [stage] }, at(1_000));
    expect(unpackReviseUndo(scope, all, at(60_000))).toEqual({ kind: "all", stages: [stage] });
    const one = packReviseUndo(scope, { kind: "activity", activityId: ACT, payload: stage.activities[0] }, at(1_000));
    expect(unpackReviseUndo(scope, one, at(60_000))).toEqual({ kind: "activity", activityId: ACT, payload: stage.activities[0] });
  });

  it("refuses another draft, opening or organisation, an expired token and a changed body", () => {
    const token = packReviseUndo(scope, { kind: "all", stages: [stage] }, at(1_000));
    expect(unpackReviseUndo({ ...scope, versionId: "v3" }, token, at(2_000))).toBeNull();
    expect(unpackReviseUndo({ ...scope, openingId: "op2" }, token, at(2_000))).toBeNull();
    expect(unpackReviseUndo({ ...scope, orgId: "o2" }, token, at(2_000))).toBeNull();
    expect(unpackReviseUndo(scope, token, at(1_000 + 11 * 60_000))).toBeNull();
    const [, signature] = [token.slice(0, token.indexOf(".")), token.slice(token.indexOf(".") + 1)];
    const forged = Buffer.from(JSON.stringify({ kind: "all", stages: [] }), "utf8").toString("base64url");
    expect(unpackReviseUndo(scope, `${forged}.${signature}`, at(2_000))).toBeNull();
    expect(unpackReviseUndo(scope, "", at(2_000))).toBeNull();
    expect(unpackReviseUndo(scope, "garbage.1.2", at(2_000))).toBeNull();
  });

  it("never lets a whole-list token act as a one-question token", () => {
    const one = packReviseUndo(scope, { kind: "activity", activityId: ACT, payload: stage.activities[0] }, at(1_000));
    const signature = one.slice(one.indexOf(".") + 1);
    const swapped = Buffer.from(JSON.stringify({ kind: "all", stages: [stage] }), "utf8").toString("base64url");
    expect(unpackReviseUndo(scope, `${swapped}.${signature}`, at(2_000))).toBeNull();
  });
});
