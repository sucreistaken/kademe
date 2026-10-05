import { describe, expect, it, vi } from "vitest";
import { candidateLink, copyLink } from "./copy-link";

describe("Linki kopyala on the desktop-only screen", () => {
  it("copies the very link the candidate opened, no other token", () => {
    expect(candidateLink("https://kademe.example", "Rl7fS-f_x")).toBe("https://kademe.example/a/Rl7fS-f_x");
    expect(candidateLink("https://kademe.example", "a/b")).toBe("https://kademe.example/a/a%2Fb");
  });

  it("says copied only when the clipboard took it, otherwise offers the link to copy by hand", async () => {
    const ok = { writeText: vi.fn(async () => undefined) };
    expect(await copyLink("u", ok)).toBe("copied");
    expect(ok.writeText).toHaveBeenCalledWith("u");
    expect(await copyLink("u", { writeText: async () => Promise.reject(new Error("denied")) })).toBe("manual");
    expect(await copyLink("u", undefined)).toBe("manual");
  });
});
