import { describe, expect, it } from "vitest";
import { recomputeLine, recomputeRefusal } from "./recompute-verification";

const url = "postgresql://kademe:secret@127.0.0.1:5434/kademe_verif";

describe("recomputeRefusal", () => {
  it("refuses without a confirmation or with the wrong one", () => {
    expect(recomputeRefusal(url, undefined)).toContain("--confirm-db=127.0.0.1:5434/kademe_verif");
    expect(recomputeRefusal(url, "127.0.0.1:5434/kademe")).toContain("does not match");
    expect(recomputeRefusal(undefined, "x")).toContain("DATABASE_URL");
  });
  it("allows the exact target and never prints the password", () => {
    expect(recomputeRefusal(url, "127.0.0.1:5434/kademe_verif")).toBeNull();
    expect(recomputeRefusal(url, undefined)).not.toContain("secret");
  });
});

describe("recomputeLine", () => {
  it("shows the outcome before and after with the reasons", () => {
    expect(recomputeLine({ attemptId: "a1", claimed: "A2", before: "FAIL", after: "INCONCLUSIVE", reasons: ["TRUNCATED_TAKE:SPEAKING"] })).toBe("a1 claim A2: FAIL -> INCONCLUSIVE (TRUNCATED_TAKE:SPEAKING)");
  });
});
