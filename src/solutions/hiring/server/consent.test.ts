import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, writesOf } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { HIRING_CONSENT_EN, HIRING_CONSENT_TR } from "../consent-default";
import { ensureHiringConsentText } from "./consent";

const ORG = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  fake.ops = [];
});

describe("ensureHiringConsentText", () => {
  it("returns the organisation's newest hiring text without writing", async () => {
    fake.respond = (op) => (op.table === "consent_texts" && op.kind === "select" ? [{ id: "ct-1", version: 2 }] : []);
    expect(await ensureHiringConsentText(ORG)).toBe("ct-1");
    const read = fake.ops.find((o) => o.table === "consent_texts")!;
    expect(read.where).toContain('"consent_texts"."org_id" = $');
    expect(read.where).toContain('"consent_texts"."solution" = $');
    expect(read.params).toEqual(expect.arrayContaining([ORG, "HIRING"]));
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("writes the built-in hiring text once when the organisation has none, under the organisation's lock", async () => {
    fake.respond = (op) => (op.kind === "insert" ? [{ id: "ct-new" }] : op.table === "organizations" ? [{ id: ORG }] : []);
    expect(await ensureHiringConsentText(ORG)).toBe("ct-new");
    const lock = fake.ops.find((o) => o.table === "organizations")!;
    // NO KEY UPDATE: ensure calls still run one at a time, while the FOR KEY SHARE every foreign key insert takes on the org row is not blocked.
    expect(lock.lock).toBe("no key update");
    expect(lock.params).toEqual([ORG]);
    const [insert] = writesOf(fake.ops);
    expect(insert.values).toEqual({ orgId: ORG, solution: "HIRING", version: 1, body: { tr: HIRING_CONSENT_TR, en: HIRING_CONSENT_EN } });
  });

  it("takes a text another invitation wrote while it waited for the lock, and writes none", async () => {
    let reads = 0;
    fake.respond = (op) => {
      if (op.table === "consent_texts" && op.kind === "select") return reads++ === 0 ? [] : [{ id: "ct-race", version: 1 }];
      return op.table === "organizations" ? [{ id: ORG }] : [];
    };
    expect(await ensureHiringConsentText(ORG)).toBe("ct-race");
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("promises no monitoring, no AI scoring, and says who sees the answers", () => {
    expect(HIRING_CONSENT_TR).toContain("izlenmez");
    expect(HIRING_CONSENT_TR).toContain("puanlamaz");
    expect(HIRING_CONSENT_EN).toContain("not monitored");
    expect(HIRING_CONSENT_EN).toContain("does not score");
    for (const text of [HIRING_CONSENT_TR, HIRING_CONSENT_EN]) expect(text).not.toContain("\u2014");
  });
});
