import { afterEach, describe, expect, it } from "vitest";
import { openTracked, stopAllStreams, trackStream } from "./streams";

const fakeStream = () => {
  const tracks = [{ stopped: false, readyState: "live", stop() { this.stopped = true; this.readyState = "ended"; } }, { stopped: false, readyState: "live", stop() { this.stopped = true; this.readyState = "ended"; } }];
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks };
};

afterEach(() => {
  stopAllStreams();
});

describe("streams the hiring screens opened", () => {
  it("stops every live track they opened, once, and says how many", () => {
    const a = fakeStream();
    const b = fakeStream();
    trackStream(a.stream);
    trackStream(b.stream);
    expect(stopAllStreams()).toBe(4);
    expect([...a.tracks, ...b.tracks].every((t) => t.stopped)).toBe(true);
    expect(stopAllStreams()).toBe(0);
  });

  it("does not count a track that had already ended, nor a stream registered twice", () => {
    const a = fakeStream();
    a.tracks[0].stop();
    trackStream(a.stream);
    trackStream(a.stream);
    expect(stopAllStreams()).toBe(1);
  });

  it("registers a stream the screen still wants", async () => {
    const a = fakeStream();
    const got = await openTracked(async () => a.stream, () => true);
    expect(got).toBe(a.stream);
    expect(a.tracks.some((t) => t.stopped)).toBe(false);
    expect(stopAllStreams()).toBe(2);
  });

  it("stops at once a stream that arrives after the screen was left, and never registers it", async () => {
    const a = fakeStream();
    const got = await openTracked(async () => a.stream, () => false);
    expect(got).toBeNull();
    expect(a.tracks.every((t) => t.stopped)).toBe(true);
    expect(stopAllStreams()).toBe(0);
  });

  it("passes a refusal on, with nothing registered", async () => {
    const refusal = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    await expect(openTracked(async () => Promise.reject(refusal), () => true)).rejects.toBe(refusal);
    expect(stopAllStreams()).toBe(0);
  });
});
