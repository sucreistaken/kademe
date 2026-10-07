import { beforeEach, describe, expect, it, vi } from "vitest";
import { managerT } from "@/i18n/manager";
import { content, stage, activity } from "@/solutions/hiring/rules/test-fixtures";
import type { OpeningDetail } from "@/solutions/hiring/server/openings";
import type { WorkingState } from "@/solutions/hiring/server/working";

/**
 * HIRING-VISUAL-FLOW 4.5: the one-line setup path under a draft's tabs. It is
 * there only for a draft its viewer may edit, and it reads nothing for anyone
 * else (a reviewer, a live or closed opening).
 */
// The database is never reached: the reads are the two mocked below.
vi.mock("@/db", () => ({ db: new Proxy({}, { get: () => () => { throw new Error("database reached"); } }) }));
const reads = vi.hoisted(() => ({ working: 0, people: 0 }));
vi.mock("@/solutions/hiring/server/working", () => ({
  workingState: async () => {
    reads.working += 1;
    return state;
  },
}));
vi.mock("@/server/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/settings")>()),
  loadPanelUsers: async () => {
    reads.people += 1;
    return [{ id: OWNER, name: "Sahip", email: "o@x.test", role: "OWNER", lastLoginAt: null, disabledAt: null }];
  },
}));

import { setupStrip } from "./setup-strip";

const ORG = "11111111-1111-4111-8111-111111111111";
const OPENING = "33333333-3333-4333-8333-333333333333";
const OWNER = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2026-10-05T09:00:00Z");
const DRAFT = { id: "d", number: 1, status: "DRAFT", publishedAt: null, previewedAt: null, updatedAt: NOW };

let state: WorkingState;
const t = managerT("tr");
const opening = (over: Partial<OpeningDetail> = {}) =>
  ({ id: OPENING, status: "DRAFT", memberIds: [], decisionMakerId: OWNER, ...over }) as unknown as OpeningDetail;

beforeEach(() => {
  reads.working = 0;
  reads.people = 0;
  // A draft with an empty question that measures one competency: anchors are done, the assessment is next.
  state = {
    list: [],
    draft: DRAFT,
    live: null,
    content: content([stage("s1", [activity("a1", { prompt: { tr: "", en: "" }, competencyIds: ["c1"] })])]),
    facts: new Map(),
    problems: [{ code: "EMPTY_PROMPT", activityId: "a1" }],
  } as unknown as WorkingState;
});

describe("setupStrip (4.5: the setup line on a draft's other pages)", () => {
  it("says where a draft's path stands and where its next step is, reading the people once", async () => {
    const strip = await setupStrip({ orgId: ORG, opening: opening(), access: { edit: true }, t, locale: "tr", state });
    expect(strip).not.toBeNull();
    expect(strip!.total).toBe(5);
    expect(strip!.done).toBe(1);
    expect(strip!.next.key).toBe("assessment");
    expect(strip!.next.href).toBe(`/hiring/openings/${OPENING}/setup#questions`);
    // The page's own working state is used; only the people are read.
    expect(reads).toEqual({ working: 0, people: 1 });
  });

  it("uses the people a page already read and reads nothing itself (B-M5)", async () => {
    const people = [{ id: OWNER, name: "Sahip", email: "o@x.test", role: "OWNER" as const, lastLoginAt: null, disabledAt: null }];
    const strip = await setupStrip({ orgId: ORG, opening: opening(), access: { edit: true }, t, locale: "tr", state, people });
    expect(strip!.next.key).toBe("assessment");
    expect(reads).toEqual({ working: 0, people: 0 });
  });

  it("reads the working state itself when the page did not", async () => {
    await setupStrip({ orgId: ORG, opening: opening(), access: { edit: true }, t, locale: "tr" });
    expect(reads).toEqual({ working: 1, people: 1 });
  });

  it("is null before any read for a viewer who may not edit, a live and a closed opening", async () => {
    expect(await setupStrip({ orgId: ORG, opening: opening(), access: { edit: false }, t, locale: "tr" })).toBeNull();
    expect(await setupStrip({ orgId: ORG, opening: opening({ status: "OPEN" }), access: { edit: true }, t, locale: "tr" })).toBeNull();
    expect(await setupStrip({ orgId: ORG, opening: opening({ status: "CLOSED" }), access: { edit: true }, t, locale: "tr" })).toBeNull();
    expect(reads).toEqual({ working: 0, people: 0 });
  });

  it("is null without a draft or its content, and then reads no people", async () => {
    state = { ...state, draft: null };
    expect(await setupStrip({ orgId: ORG, opening: opening(), access: { edit: true }, t, locale: "tr", state })).toBeNull();
    state = { ...state, draft: DRAFT, content: null } as unknown as WorkingState;
    expect(await setupStrip({ orgId: ORG, opening: opening(), access: { edit: true }, t, locale: "tr", state })).toBeNull();
    expect(reads.people).toBe(0);
  });
});
