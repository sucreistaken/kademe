import { describe, expect, it } from "vitest";
import { COURSE_FORMS_SEED } from "./course-tests";
import { fixtureCourseForm } from "./course-fixture";
import { SEED_BANK } from "./index";
import { listeningScriptHash, listeningScripts, lockProblems } from "./listening-lock";
import lock from "./listening-scripts.lock.json";

const locked = lock as Record<string, string>;
// The bank's clips and the clips of the course test forms, each under its database seed key.
const clips = listeningScripts(SEED_BANK, COURSE_FORMS_SEED);

describe("listening scripts keep their key only while they keep their words", () => {
  it("no locked script changed under the same key (give a changed script a new key)", () => {
    expect(lockProblems(locked, clips).changed).toEqual([]);
  });

  it("every listening script is locked (run pnpm bank:lock-listening after adding one)", () => {
    expect(lockProblems(locked, clips).unlocked).toEqual([]);
  });

  it("covers every clip of the bank", () => {
    const bankClips = SEED_BANK.stimuli.filter((s) => s.section === "LISTENING");
    expect(bankClips.length).toBeGreaterThan(0);
    expect(clips.map((c) => c.key)).toEqual(expect.arrayContaining(bankClips.map((s) => s.key)));
  });
});

describe("the lock covers the clips of the course test forms", () => {
  const form = fixtureCourseForm("B1.1", "A");
  const scripts = listeningScripts({ stimuli: [], items: [] }, [form]);
  const clip = form.sections[2].stimuli[0];

  it("lists a course clip under its form's database seed key with the hash of its words and voices", () => {
    expect(scripts).toEqual([{ key: "course-b1-1-a-fx-l-durchsage", hash: listeningScriptHash(clip) }]);
  });

  it("leaves out reading texts, and keeps the bank's clips under their own keys next to the course clips", () => {
    expect(scripts.map((s) => s.key)).not.toContain("course-b1-1-a-fx-r-reise");
    expect(listeningScripts(SEED_BANK, [form])).toEqual([...listeningScripts(SEED_BANK, []), ...scripts]);
  });

  it("flags a locked course script whose words changed under the same key, and an unlocked one", () => {
    const lockOf = Object.fromEntries(scripts.map((s) => [s.key, s.hash]));
    expect(lockProblems(lockOf, scripts)).toEqual({ changed: [], unlocked: [] });
    expect(lockProblems({}, scripts)).toEqual({ changed: [], unlocked: ["course-b1-1-a-fx-l-durchsage"] });

    const edited = fixtureCourseForm("B1.1", "A");
    edited.sections[2].stimuli[0] = { ...edited.sections[2].stimuli[0], body: "A: Achtung, der Zug fährt heute von Gleis 5." };
    expect(lockProblems(lockOf, listeningScripts({ stimuli: [], items: [] }, [edited]))).toEqual({ changed: ["course-b1-1-a-fx-l-durchsage"], unlocked: [] });

    const otherVoices = fixtureCourseForm("B1.1", "A");
    otherVoices.sections[2].stimuli[0] = { ...otherVoices.sections[2].stimuli[0], speakers: [{ label: "A", voice: "C" }, { label: "B", voice: "B" }] };
    expect(lockProblems(lockOf, listeningScripts({ stimuli: [], items: [] }, [otherVoices])).changed).toEqual(["course-b1-1-a-fx-l-durchsage"]);
  });

  it("treats the same clip in the other form as a clip of its own", () => {
    const both = listeningScripts({ stimuli: [], items: [] }, [form, fixtureCourseForm("B1.1", "B")]);
    expect(both.map((s) => s.key)).toEqual(["course-b1-1-a-fx-l-durchsage", "course-b1-1-b-fx-l-durchsage"]);
    expect(both[0].hash).toBe(both[1].hash);
  });

  it("does not depend on the play limit, which the sync may change without new audio", () => {
    const limited = fixtureCourseForm("B1.1", "A");
    limited.sections[2].stimuli[0] = { ...limited.sections[2].stimuli[0], maxPlays: 1 };
    expect(listeningScripts({ stimuli: [], items: [] }, [limited])).toEqual(scripts);
  });
});
