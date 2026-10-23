import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createClipRegistry, type PausableClip } from "./audio-refs";

type RefCallback = (el: FakeClip | null) => void;

class FakeClip implements PausableClip {
  paused = 0;
  pause() {
    this.paused += 1;
  }
}

/**
 * What React does with a callback ref on each commit: when the callback is a
 * different function from the last render, the old one is called with null
 * and the new one with the element; the same function is left alone.
 */
function commitRef(previous: RefCallback | undefined, next: RefCallback, el: FakeClip) {
  if (previous === next) return;
  previous?.(null);
  next(el);
}

/** Renders the player's clip list `frames` times, as the per-frame clock does. */
function renderFrames(ids: string[], frames: number, refFor: (id: string) => RefCallback) {
  const clips = new Map(ids.map((id) => [id, new FakeClip()]));
  const last = new Map<string, RefCallback>();
  for (let frame = 0; frame < frames; frame += 1) {
    for (const id of ids) {
      const next = refFor(id);
      commitRef(last.get(id), next, clips.get(id)!);
      last.set(id, next);
    }
  }
  return clips;
}

describe("tutorial narration clip registry", () => {
  it("hands out the same ref callback for an id on every render", () => {
    const registry = createClipRegistry<FakeClip>();
    const first = registry.ref("intro");
    expect(registry.ref("intro")).toBe(first);
    expect(registry.ref("pick")).not.toBe(first);
  });

  it("never pauses a clip when the player re-renders", () => {
    const registry = createClipRegistry<FakeClip>();
    const clips = renderFrames(["intro", "pick", "outro"], 60, (id) => registry.ref(id));
    for (const clip of clips.values()) expect(clip.paused).toBe(0);
    expect(Object.keys(registry.current()).sort()).toEqual(["intro", "outro", "pick"]);
    for (const [id, clip] of clips) expect(registry.current()[id]).toBe(clip);
  });

  it("documents the regression: an inline callback that pauses on null stops the clip every frame", () => {
    const live: Record<string, FakeClip | null> = {};
    const inline = (id: string): RefCallback => (el) => {
      if (!el) live[id]?.pause();
      live[id] = el;
    };
    const clips = renderFrames(["intro"], 5, inline);
    expect(clips.get("intro")!.paused).toBe(4);
  });

  it("pauses every clip on unmount, also clips React already detached", () => {
    const registry = createClipRegistry<FakeClip>();
    const a = new FakeClip();
    const b = new FakeClip();
    registry.ref("a")(a);
    registry.ref("b")(b);
    registry.ref("a")(null);
    expect(registry.current().a).toBeNull();
    expect(a.paused).toBe(0);
    registry.pauseAll();
    expect(a.paused).toBe(1);
    expect(b.paused).toBe(1);
  });

  it("the player uses the registry, not an inline ref, for its audio elements", () => {
    const source = readFileSync(path.join(__dirname, "TutorialPlayer.tsx"), "utf8");
    expect(source).toContain("ref={clips.ref(s.id)}");
    expect(source).toMatch(/useEffect\(\(\) => \(\) => clips\.pauseAll\(\), \[clips\]\)/);
    const audioTag = source.slice(source.indexOf("<audio"), source.indexOf("/>", source.indexOf("<audio")));
    expect(audioTag).not.toMatch(/ref=\{\(/);
  });
});
