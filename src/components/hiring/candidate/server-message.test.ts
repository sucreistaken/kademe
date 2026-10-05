import { describe, expect, it } from "vitest";
import { serverMessage } from "./server-message";

/** Task 11 review, Minor 6: the candidate reads the server's words for a refusal, never raw network text. */
describe("serverMessage", () => {
  it("passes on the server's message for a refusal with a code", () => {
    const refusal = Object.assign(new Error("Bir aşama sürerken ek süre değişmez."), { code: "EXTRA_TIME_LOCKED", status: 409 });
    expect(serverMessage(refusal)).toBe("Bir aşama sürerken ek süre değişmez.");
  });

  it("gives nothing for a dropped connection or an answer without a code", () => {
    expect(serverMessage(new TypeError("Failed to fetch"))).toBeNull();
    expect(serverMessage(Object.assign(new Error("Bir sorun oldu."), { code: "UNKNOWN", status: 502 }))).toBeNull();
    expect(serverMessage("boom")).toBeNull();
  });
});
