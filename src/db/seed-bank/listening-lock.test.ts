import { describe, expect, it } from "vitest";
import { SEED_BANK } from "./index";
import { listeningScriptHash } from "./listening-lock";
import lock from "./listening-scripts.lock.json";

const locked = lock as Record<string, string>;
const clips = SEED_BANK.stimuli.filter((s) => s.section === "LISTENING");

describe("listening scripts keep their key only while they keep their words", () => {
  it("no locked script changed under the same key (give a changed script a new key)", () => {
    const changed = clips.filter((s) => locked[s.key] && locked[s.key] !== listeningScriptHash(s)).map((s) => s.key);
    expect(changed).toEqual([]);
  });

  it("every listening script is locked (run pnpm bank:lock-listening after adding one)", () => {
    expect(clips.filter((s) => !locked[s.key]).map((s) => s.key)).toEqual([]);
  });
});
