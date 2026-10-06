import { describe, expect, it } from "vitest";
import { SLOW_AFTER_SECONDS, waitingKey } from "./waiting";

describe("waiting line", () => {
  it("says the usual time until 40 seconds, then that it is still working (spec 5.5)", () => {
    expect(SLOW_AFTER_SECONDS).toBe(40);
    expect(waitingKey(0)).toBe("working");
    expect(waitingKey(39)).toBe("working");
    expect(waitingKey(40)).toBe("workingSlow");
    expect(waitingKey(600)).toBe("workingSlow");
  });
});
