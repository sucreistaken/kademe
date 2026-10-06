import { describe, expect, it, vi } from "vitest";
import { clientKey, createFailureLimiter, panelPasswordHash } from "./panel-login";

const FAKE_PHC = "$argon2id$v=19$m=19456,t=2,p=1$ZmFrZXNhbHRmYWtl$ZmFrZWhhc2hmYWtlaGFzaGZha2VoYXNo";

describe("panelPasswordHash", () => {
  it("is off when unset or blank", () => {
    expect(panelPasswordHash({})).toBeNull();
    expect(panelPasswordHash({ PANEL_PASSWORD_HASH: "  " })).toBeNull();
  });

  it("accepts the raw hash and its base64url form", () => {
    expect(panelPasswordHash({ PANEL_PASSWORD_HASH: FAKE_PHC })).toBe(FAKE_PHC);
    expect(panelPasswordHash({ PANEL_PASSWORD_HASH: Buffer.from(FAKE_PHC).toString("base64url") })).toBe(FAKE_PHC);
  });

  it("treats a hash mangled by $-expansion as not configured", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(panelPasswordHash({ PANEL_PASSWORD_HASH: "=19=19456,t=2,p=1" })).toBeNull();
    expect(panelPasswordHash({ PANEL_PASSWORD_HASH: "$argon2id=19" })).toBeNull();
    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[0][0])).not.toContain("=19");
    error.mockRestore();
  });
});

describe("createFailureLimiter", () => {
  const options = { maxFailures: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };

  it("locks on the 5th failure and lifts after the lockout", () => {
    let t = 0;
    const limiter = createFailureLimiter(options, () => t);
    for (let i = 0; i < 4; i += 1) limiter.recordFailure("a");
    expect(limiter.isLocked("a")).toBe(false);
    limiter.recordFailure("a");
    expect(limiter.isLocked("a")).toBe(true);
    expect(limiter.isLocked("b")).toBe(false);
    t += options.lockoutMs - 1;
    expect(limiter.isLocked("a")).toBe(true);
    t += 1;
    expect(limiter.isLocked("a")).toBe(false);
  });

  it("forgets failures once the window has passed", () => {
    let t = 0;
    const limiter = createFailureLimiter(options, () => t);
    for (let i = 0; i < 4; i += 1) limiter.recordFailure("a");
    t += options.windowMs;
    limiter.recordFailure("a");
    expect(limiter.isLocked("a")).toBe(false);
  });

  it("starts over after a reset", () => {
    const limiter = createFailureLimiter(options, () => 0);
    for (let i = 0; i < 4; i += 1) limiter.recordFailure("a");
    limiter.reset("a");
    limiter.recordFailure("a");
    expect(limiter.isLocked("a")).toBe(false);
  });
});

describe("clientKey", () => {
  it("uses the last X-Forwarded-For entry, the one the proxy wrote", () => {
    expect(clientKey("1.1.1.1, 203.0.113.7", null)).toBe("203.0.113.7");
    expect(clientKey("203.0.113.7", null)).toBe("203.0.113.7");
    expect(clientKey(null, "198.51.100.1")).toBe("198.51.100.1");
    expect(clientKey(null, null)).toBe("unknown");
  });
});
