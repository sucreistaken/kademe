import { describe, expect, it } from "vitest";
import { problemMessage } from "./problem-message";

describe("problemMessage", () => {
  it("puts the area first, then the trimmed note", () => {
    expect(problemMessage("EXAM_END", "  Audio stopped.\n")).toBe("EXAM_END: Audio stopped.");
  });

  it("is the area alone when the candidate wrote nothing", () => {
    expect(problemMessage("SYSTEM_CHECK", "   ")).toBe("SYSTEM_CHECK");
  });

  it("is cut to the 2000 the table allows, keeping the area", () => {
    const message = problemMessage("EXAM_END", "y".repeat(2000));
    expect(message).toHaveLength(2000);
    expect(message.startsWith("EXAM_END: y")).toBe(true);
  });
});
