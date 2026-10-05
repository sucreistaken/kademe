import { describe, expect, it } from "vitest";
import { infoProblems, infoWaitReason } from "./info-model";

describe("the details step (3.12, Task 11 Minor 10 carry)", () => {
  it("waits for a name of two letters, then for an e-mail the server accepts, and says which", () => {
    expect(infoWaitReason({ fullName: " E ", email: "elif@ornek.test" })).toBe("name");
    expect(infoWaitReason({ fullName: "Elif Kaya", email: "elif@" })).toBe("email");
    expect(infoWaitReason({ fullName: "Elif Kaya", email: " elif@ornek.test " })).toBeNull();
  });

  it("names every field the server would refuse, so a field can show its own problem", () => {
    expect(infoProblems({ fullName: "E", email: "elif@" })).toEqual({ name: true, email: true });
    expect(infoProblems({ fullName: "Elif", email: "elif@" })).toEqual({ name: false, email: true });
    expect(infoProblems({ fullName: "Elif", email: "elif@ornek.test" })).toEqual({ name: false, email: false });
  });
});
