import { describe, expect, it } from "vitest";
import { noticeOf, one, withoutParams } from "./url-notice";

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
