import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HIRING-UX A4: the warm-up sends nothing. The warm-up page, its in-memory
 * sink and the shared recorder component never reach for the network; the
 * answer upload is injected only on the stage page. (The browser check also
 * reads the network list.)
 */
const NETWORK = /@\/lib\/client\/api|fetch\(|sendBeacon|apiSend|apiGet|apiBeacon|ChunkedUploader|upload-sink/;

describe("the warm-up", () => {
  it.each(["practice.tsx", "local-sink.ts", "recorded-activity.tsx", "take.ts"])("%s has no way to the network", (file) => {
    const text = readFileSync(path.join(process.cwd(), "src/components/hiring/candidate", file), "utf8");
    expect(text).not.toMatch(NETWORK);
  });

  it("the check itself sees the network in the answer's sink (positive control)", () => {
    const text = readFileSync(path.join(process.cwd(), "src/components/hiring/candidate/upload-sink.ts"), "utf8");
    expect(text).toMatch(NETWORK);
  });
});
