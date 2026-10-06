import { describe, expect, it } from "vitest";
import { CANDIDATE_STATUS, OPENING_STATUS } from "./status-vocabulary";

describe("one status dictionary (P9): the same dot and word everywhere, accent only for what is live", () => {
  it("opening: Taslak grey, Yayında accent, Kapalı a light grey, no longer the darkest", () => {
    expect(OPENING_STATUS).toEqual({ DRAFT: { tone: "neutral", strong: false }, OPEN: { tone: "active", strong: false }, CLOSED: { tone: "warn", strong: false } });
  });

  it("candidate: in progress is the only accent; an expired link is ink and bold", () => {
    expect(CANDIDATE_STATUS).toEqual({
      INVITED: { tone: "neutral", strong: false },
      OPENED: { tone: "neutral", strong: false },
      IN_PROGRESS: { tone: "active", strong: false },
      COMPLETED: { tone: "done", strong: false },
      EXPIRED: { tone: "warn", strong: true },
    });
  });
});
