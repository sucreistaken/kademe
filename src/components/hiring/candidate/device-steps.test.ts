import { describe, expect, it } from "vitest";
import { candidateT } from "@/i18n/candidate";
import { footerButtonState } from "@/components/visual/footer-action";
import { deviceBlocker, fixKeyFor, type Permission, type Trial } from "./device-rows";
import {
  checkMemoryKey,
  contextStalled,
  deviceStep,
  focusLost,
  NO_REPORTS,
  quietCopy,
  readCheckMemory,
  rememberCheck,
  shouldAutoOpen,
  splitFix,
  unsupportedSteps,
  waitReasonKey,
  withReport,
  writeCheckMemory,
  type StepInput,
} from "./device-steps";

const base: StepInput = { camera: true, permission: "idle", heard: false, quiet: false, trial: "none", denied: null };

describe("the device check as three sub-steps (HIRING-VISUAL-FLOW 3.3, G2)", () => {
  it("A: turn the devices on; the filled button is that action, waiting only while the browser asks", () => {
    expect(deviceStep(base)).toEqual({ step: "open", primary: "open", wait: null });
    expect(deviceStep({ ...base, permission: "asking" })).toEqual({ step: "open", primary: "open", wait: "asking" });
  });

  it("a refusal offers Tekrar dene, except where asking again cannot help (no camera access at all)", () => {
    expect(deviceStep({ ...base, permission: "denied", denied: "notAllowed" })).toEqual({ step: "denied", primary: "retry", wait: null });
    expect(deviceStep({ ...base, permission: "denied", denied: "unsupported" })).toEqual({ step: "denied", primary: null, wait: null });
  });

  it("B: the test recording, waiting for a voice first; an unheard microphone lets the trial prove it (Task 12 ruling)", () => {
    const granted = { ...base, permission: "granted" as const };
    expect(deviceStep(granted)).toEqual({ step: "sound", primary: "trial", wait: "sound" });
    expect(deviceStep({ ...granted, heard: true })).toEqual({ step: "trial", primary: "trial", wait: null });
    expect(deviceStep({ ...granted, quiet: true })).toEqual({ step: "quiet", primary: "trial", wait: null });
    expect(deviceStep({ ...granted, heard: true, trial: "recording" })).toEqual({ step: "trial", primary: "trial", wait: "trialRecording" });
  });

  it("C: can you see and hear yourself; 'Evet, devam et' waits until the recording was played", () => {
    const granted = { ...base, permission: "granted" as const, heard: true };
    expect(deviceStep({ ...granted, trial: "ready" })).toEqual({ step: "listen", primary: "continue", wait: "trialListen" });
    expect(deviceStep({ ...granted, trial: "played" })).toEqual({ step: "listen", primary: "continue", wait: null });
  });

  it("goes on only where the plan 2 rows say nothing blocks (device-rows stays the rule)", () => {
    const permissions: Permission[] = ["idle", "asking", "granted", "denied"];
    const trials: Trial[] = ["none", "recording", "ready", "played"];
    for (const camera of [true, false])
      for (const permission of permissions)
        for (const heard of [true, false])
          for (const quiet of [true, false])
            for (const trial of trials) {
              const input = { camera, permission, heard, quiet, trial, denied: permission === "denied" ? ("notAllowed" as const) : null };
              const s = deviceStep(input);
              const free = s.primary === "continue" && s.wait === null;
              expect(free, JSON.stringify(input)).toBe(deviceBlocker(input) === null);
            }
  });
});

describe("Task 12 polish carries", () => {
  it("keeps a report's state per row: a report sent from one row is not 'sent' in another", () => {
    const after = withReport(NO_REPORTS, "quiet", "sent");
    expect(after).toEqual({ devices: "idle", quiet: "sent", recorder: "idle" });
    expect(NO_REPORTS.quiet).toBe("idle");
  });

  it("treats Safari's interrupted sound context like a suspended one", () => {
    expect(contextStalled("suspended")).toBe(true);
    expect(contextStalled("interrupted")).toBe(true);
    expect(contextStalled("running")).toBe(false);
    expect(contextStalled("closed")).toBe(false);
  });

  it("never says 'we could not hear you' where it could not listen at all (no sound context)", () => {
    expect(quietCopy(true)).toEqual({ mic: "micNoMeter", trial: "trialNoMeter" });
    expect(quietCopy(false)).toEqual({ mic: "micQuietHint", trial: "trialQuiet" });
  });

  it("sends only an in-app browser to 'open it in your browser'; another browser without camera access gets its own words", () => {
    expect(unsupportedSteps("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0", 5)).toBe("fixinApp");
    expect(unsupportedSteps("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", 0)).toBe("fixUnsupported");
  });

  it("knows TikTok and Snapchat as in-app browsers", () => {
    expect(fixKeyFor("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_32.5.0 JsSdk/2.0 NetType/WIFI")).toBe("inApp");
    expect(fixKeyFor("Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 trill_310503 BytedanceWebview/d8a21c6")).toBe("inApp");
    expect(fixKeyFor("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.80.0.35 (like Safari/8617.1.17.10.12, panda)")).toBe("inApp");
  });

  it("survives a remount (a language switch): the played trial and 'devices opened' are remembered in the tab", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const key = checkMemoryKey("tok");
    expect(readCheckMemory(storage, key)).toEqual({ trialPlayed: false, devicesOpened: false });
    writeCheckMemory(storage, key, { trialPlayed: true, devicesOpened: false });
    expect(readCheckMemory(storage, key)).toEqual({ trialPlayed: true, devicesOpened: false });
    writeCheckMemory(storage, key, { trialPlayed: false, devicesOpened: true });
    expect(readCheckMemory(storage, key)).toEqual({ trialPlayed: false, devicesOpened: true });
    writeCheckMemory(storage, key, { trialPlayed: true, devicesOpened: true });
    expect(readCheckMemory(storage, key)).toEqual({ trialPlayed: true, devicesOpened: true });
    expect(readCheckMemory({ getItem: () => "{broken" }, key)).toEqual({ trialPlayed: false, devicesOpened: false });
    expect(readCheckMemory({ getItem: () => '{"devicesOpened":"yes"}' }, key)).toEqual({ trialPlayed: false, devicesOpened: false });
    expect(readCheckMemory(null, key)).toEqual({ trialPlayed: false, devicesOpened: false });
    expect(() => writeCheckMemory(null, key, { trialPlayed: true, devicesOpened: true })).not.toThrow();
    expect(() =>
      writeCheckMemory(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        key,
        { trialPlayed: true, devicesOpened: true },
      ),
    ).not.toThrow();
  });

  it("reopens devices without a click only after this tab opened them, and only where the browser still allows them", () => {
    const opened = { openedBefore: true };
    expect(shouldAutoOpen({ ...opened, camera: true, cameraPermission: "granted", microphonePermission: "granted" })).toBe(true);
    expect(shouldAutoOpen({ ...opened, camera: true, cameraPermission: "prompt", microphonePermission: "granted" })).toBe(false);
    expect(shouldAutoOpen({ ...opened, camera: false, cameraPermission: null, microphonePermission: "granted" })).toBe(true);
    // Firefox cannot be asked about "camera": unknown is not granted.
    expect(shouldAutoOpen({ ...opened, camera: true, cameraPermission: null, microphonePermission: "granted" })).toBe(false);
    expect(shouldAutoOpen({ ...opened, camera: false, cameraPermission: null, microphonePermission: null })).toBe(false);
  });

  it("C3/G2: a granted browser on a first visit still waits for the click on 'Kameranı açalım'", () => {
    const granted = { camera: true, cameraPermission: "granted" as const, microphonePermission: "granted" as const };
    expect(shouldAutoOpen({ ...granted, openedBefore: false })).toBe(false);
    expect(shouldAutoOpen({ ...granted, openedBefore: true })).toBe(true);
    expect(shouldAutoOpen({ openedBefore: false, camera: false, cameraPermission: null, microphonePermission: "granted" })).toBe(false);
  });
});

describe("the refusal's two steps (3.3: browser first, the computer's settings behind 'Hâlâ olmuyor mu?')", () => {
  it("splits a fix at its first newline and keeps one-line fixes whole", () => {
    expect(splitFix("Adres çubuğu...\nHâlâ açılmıyorsa bilgisayarın...")).toEqual({ first: "Adres çubuğu...", rest: "Hâlâ açılmıyorsa bilgisayarın..." });
    expect(splitFix("Tek satır.")).toEqual({ first: "Tek satır.", rest: null });
  });
});

describe("C2: the filled button waits on every blocker, with that blocker's reason", () => {
  const granted = { ...base, permission: "granted" as const };

  it("maps a wait to its block* copy key; 'asking' is the open step's busy state, not a reason", () => {
    expect(waitReasonKey(null)).toBeNull();
    expect(waitReasonKey("asking")).toBeNull();
    for (const blocker of ["permission", "permissionMic", "sound", "trialNone", "trialRecording", "trialListen"] as const) {
      const key = waitReasonKey(blocker);
      expect(key).toBe(`block${blocker}`);
      if (!key) continue;
      for (const locale of ["tr", "en"] as const) expect(candidateT(locale)(`hiringDevice.${key}`), `${locale} ${key}`).not.toBe(`hiringDevice.${key}`);
    }
  });

  it("remount case: trial remembered as played, sound not heard yet, 'Evet, devam et' waits with the sound reason", () => {
    const step = deviceStep({ ...granted, trial: "played" });
    expect(step).toEqual({ step: "listen", primary: "continue", wait: "sound" });
    const key = waitReasonKey(step.wait);
    const reason = key ? candidateT("tr")(`hiringDevice.${key}`) : null;
    const state = footerButtonState({ kind: "button", id: "check-next", label: "Evet, devam et", onClick: () => undefined, waitReason: reason });
    expect(state).toEqual({ mode: "waiting", label: "Evet, devam et", reason: "Sesini duymayı bekliyoruz. Birkaç kelime söyle.", describedBy: "check-next-why" });
  });

  it("holds the continue button for every blocker deviceBlocker can name, and frees it only at null", () => {
    const permissions: Permission[] = ["idle", "asking", "granted", "denied"];
    const trials: Trial[] = ["none", "recording", "ready", "played"];
    for (const permission of permissions)
      for (const heard of [true, false])
        for (const quiet of [true, false])
          for (const trial of trials) {
            const input = { camera: true, permission, heard, quiet, trial, denied: permission === "denied" ? ("notAllowed" as const) : null };
            const s = deviceStep(input);
            if (s.primary !== "continue") continue;
            const key = waitReasonKey(s.wait);
            const state = footerButtonState({ kind: "button", id: "check-next", label: "x", onClick: () => undefined, waitReason: key ? "reason" : null });
            expect(state.mode, JSON.stringify(input)).toBe(deviceBlocker(input) === null ? "ready" : "waiting");
          }
  });

  it("the trial button waits for the sound with its reason and is busy while recording", () => {
    const sound = deviceStep(granted);
    expect(waitReasonKey(sound.wait)).toBe("blocksound");
    const recording = deviceStep({ ...granted, heard: true, trial: "recording" });
    expect(recording.wait).toBe("trialRecording");
    const state = footerButtonState({ kind: "button", id: "check-trial", label: "x", busy: true, busyLabel: "Kaydediliyor", waitReason: "reason", onClick: () => undefined });
    expect(state).toEqual({ mode: "busy", label: "Kaydediliyor", reason: null, describedBy: undefined });
  });
});

describe("C3: the tab's memory keeps both fields when one is written", () => {
  it("rememberCheck reads first and writes the other field along", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const key = checkMemoryKey("tok");
    rememberCheck(storage, key, "devicesOpened");
    expect(readCheckMemory(storage, key)).toEqual({ trialPlayed: false, devicesOpened: true });
    rememberCheck(storage, key, "trialPlayed");
    expect(readCheckMemory(storage, key)).toEqual({ trialPlayed: true, devicesOpened: true });
    expect(() => rememberCheck(null, key, "trialPlayed")).not.toThrow();
  });
});

describe("fix round 1: a browser without a recorder (G2, plan 2)", () => {
  const granted = { ...base, permission: "granted" as const };

  it("offers no filled trial button where the browser cannot record; every other step is unchanged", () => {
    expect(deviceStep({ ...granted, recorder: false })).toEqual({ step: "sound", primary: null, wait: "sound" });
    expect(deviceStep({ ...granted, heard: true, recorder: false })).toEqual({ step: "trial", primary: null, wait: null });
    expect(deviceStep({ ...granted, quiet: true, recorder: false })).toEqual({ step: "quiet", primary: null, wait: null });
    expect(deviceStep({ ...base, recorder: false })).toEqual({ step: "open", primary: "open", wait: null });
    expect(deviceStep({ ...granted, heard: true, recorder: true })).toEqual({ step: "trial", primary: "trial", wait: null });
    expect(deviceStep({ ...granted, heard: true })).toEqual({ step: "trial", primary: "trial", wait: null });
  });
});

describe("fix round 1: when a step change takes the focus to the new title", () => {
  const none = { present: true, onBody: false, inStepArea: false, inFooter: false, disabled: false };

  it("moves focus when nothing holds it, or it sat on <body> or inside the step's own area", () => {
    expect(focusLost({ ...none, present: false })).toBe(true);
    expect(focusLost({ ...none, onBody: true })).toBe(true);
    expect(focusLost({ ...none, inStepArea: true })).toBe(true);
  });

  it("moves focus off a footer button that stays mounted and turns disabled (open -> sound, trial -> listen)", () => {
    expect(focusLost({ ...none, inFooter: true })).toBe(true);
    expect(focusLost({ ...none, disabled: true })).toBe(true);
  });

  it("leaves focus alone where the candidate put it elsewhere", () => {
    expect(focusLost(none)).toBe(false);
  });
});
