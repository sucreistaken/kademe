import { describe, expect, it } from "vitest";
import { candidatesNotice } from "./notices";

/** Task 18 fix round 1 (Minor 4): a refusal or a failure does not look like a success. */
describe("candidatesNotice", () => {
  it("reads the tab's success notices as plain status lines", () => {
    expect(candidatesNotice({ handled: "1" })).toEqual({ key: "requestHandled", warn: false });
    expect(candidatesNotice({ extended: "1" })).toEqual({ key: "extended", warn: false });
  });

  it("marks every refusal and failure as a warning", () => {
    expect(candidatesNotice({ extend: "closed" })).toEqual({ key: "extendClosed", warn: true });
    expect(candidatesNotice({ extend: "failed" })).toEqual({ key: "extendFailed", warn: true });
    expect(candidatesNotice({ extend: "started" })).toEqual({ key: "extendStarted", warn: true });
    expect(candidatesNotice({ request: "closed" })).toEqual({ key: "requestClosed", warn: true });
    expect(candidatesNotice({ request: "notfound" })).toEqual({ key: "requestNotFound", warn: true });
  });

  it("ignores unknown or repeated values", () => {
    expect(candidatesNotice({})).toBeNull();
    expect(candidatesNotice({ extend: "toString" })).toBeNull();
    expect(candidatesNotice({ handled: ["1", "1"] })).toBeNull();
    expect(candidatesNotice({ handled: "2" })).toBeNull();
  });
});
