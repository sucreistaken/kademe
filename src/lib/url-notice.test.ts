import { describe, expect, it, vi } from "vitest";
import { noticeOf, one, scheduleNoticeCleanup, withoutParams, type NoticeWindow } from "./url-notice";

/**
 * A notice that arrives in the URL (after a redirect: "v1 yayınlandı",
 * "yayınlanamadı", the close undo strip) is read once, shown, and its
 * parameters taken out of the address, so a reload does not show it again.
 */
describe("URL notices", () => {
  it("reads one string value; repeated or missing parameters are nothing", () => {
    expect(one("refused")).toBe("refused");
    expect(one(["a", "b"])).toBeUndefined();
    expect(one(undefined)).toBeUndefined();
  });

  it("maps a known value to its notice and ignores anything else, including inherited keys", () => {
    const table = { refused: "publishRefused", closed: "publishClosed" } as const;
    expect(noticeOf({ publish: "refused" }, "publish", table)).toBe("publishRefused");
    expect(noticeOf({ publish: "toString" }, "publish", table)).toBeNull();
    expect(noticeOf({ publish: ["refused", "closed"] }, "publish", table)).toBeNull();
    expect(noticeOf({}, "publish", table)).toBeNull();
  });

  it("takes only the notice parameters out of the address, keeping the rest and the hash", () => {
    expect(withoutParams("/hiring/openings/o1?publish=refused&tab=x#top", ["publish", "published"])).toBe("/hiring/openings/o1?tab=x#top");
    expect(withoutParams("/hiring/openings/o1/settings?closed=1", ["closed"])).toBe("/hiring/openings/o1/settings");
    // Nothing to take out: no history entry is rewritten.
    expect(withoutParams("/hiring/openings/o1?tab=x", ["publish"])).toBeNull();
  });
});

describe("taking the notice out of the address (plan 1 carry)", () => {
  function fakeWindow(href: string) {
    const calls: string[] = [];
    const win: NoticeWindow = {
      location: { pathname: href.split("?")[0], search: href.includes("?") ? `?${href.split("?")[1].split("#")[0]}` : "", hash: "" },
      history: { state: { __NA: true }, replaceState: (_s: unknown, _t: string, url?: string | URL | null) => void calls.push(String(url)) },
      setTimeout: (fn: () => void, ms?: number) => globalThis.setTimeout(fn, ms) as unknown as number,
      clearTimeout: (id: number) => globalThis.clearTimeout(id as unknown as NodeJS.Timeout),
    };
    return { win, calls };
  }

  it("waits a tick, so Next's own history write on a full page load cannot bring the parameter back", () => {
    vi.useFakeTimers();
    const { win, calls } = fakeWindow("/hiring/openings/o1/candidates?handled=1");
    scheduleNoticeCleanup(win, ["handled"]);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(0);
    expect(calls).toEqual(["/hiring/openings/o1/candidates"]);
    vi.useRealTimers();
  });

  it("hands Next's patched replaceState no state of its own, and does nothing when unmounted first or when there is nothing to take out", () => {
    vi.useFakeTimers();
    const a = fakeWindow("/x?handled=1");
    let given: unknown = "untouched";
    a.win.history.replaceState = (state: unknown) => void (given = state);
    scheduleNoticeCleanup(a.win, ["handled"]);
    vi.advanceTimersByTime(0);
    // A state with `__NA` reads to Next as its own write: the router would keep the old address (Task 18 browser check).
    expect(given).toBeNull();
    const b = fakeWindow("/x?handled=1");
    scheduleNoticeCleanup(b.win, ["handled"])();
    vi.advanceTimersByTime(0);
    expect(b.calls).toEqual([]);
    const c = fakeWindow("/x?tab=1");
    scheduleNoticeCleanup(c.win, ["handled"]);
    vi.advanceTimersByTime(0);
    expect(c.calls).toEqual([]);
    vi.useRealTimers();
  });
});
