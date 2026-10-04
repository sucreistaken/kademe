import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { createOpening, positionOptions } from "./openings";

/**
 * The new-opening position picker (HIRING-UX 5.3) on a recording fake
 * database: only the caller's organisation, never an archived position
 * (archived positions are read-only and start nothing new, HIRING-UX 4.2).
 */
const ORG = "11111111-1111-4111-8111-111111111111";
const POS_A = "22222222-2222-4222-8222-222222222222";
const POS_B = "33333333-3333-4333-8333-333333333333";
const POS_C = "44444444-4444-4444-8444-444444444444";
const ACTOR = "55555555-5555-4555-8555-555555555555";
const OPENING = "66666666-6666-4666-8666-666666666666";
const VERSION = "77777777-7777-4777-8777-777777777777";

beforeEach(() => {
  fake.ops = [];
  fake.respond = () => [];
});

describe("positionOptions", () => {
  it("reads only active positions of the caller's organisation", async () => {
    await positionOptions(ORG);
    expect(fake.ops).toHaveLength(1);
    const [op] = fake.ops;
    expect(op.kind).toBe("select");
    expect(op.table).toBe("positions");
    expect(op.where).toContain('"positions"."org_id" = $');
    expect(op.where).toContain('"positions"."archived_at" is null');
    expect(op.params).toContain(ORG);
  });

  it("summarises the profile: equal weights when the profile has at most one distinct weight", async () => {
    fake.respond = () => [
      { id: POS_A, name: "Destek", hasJobAd: true, competencyCount: 3, distinctWeights: 1 },
      { id: POS_B, name: "Satış", hasJobAd: false, competencyCount: 2, distinctWeights: 2 },
      { id: POS_C, name: "Yeni", hasJobAd: false, competencyCount: 0, distinctWeights: 0 },
    ];
    expect(await positionOptions(ORG)).toEqual([
      { id: POS_A, name: "Destek", hasJobAd: true, competencyCount: 3, weightsEqual: true },
      { id: POS_B, name: "Satış", hasJobAd: false, competencyCount: 2, weightsEqual: false },
      { id: POS_C, name: "Yeni", hasJobAd: false, competencyCount: 0, weightsEqual: true },
    ]);
  });
});

describe("createOpening", () => {
  // Ruling C7: no link to a page that does not exist yet. Until the builder
  // (Task 15) and the AI screen (Task 17) are built, every start lands on the
  // opening's overview; those tasks point `next` at their own routes.
  it.each(["AI", "BLANK"] as const)("a %s start lands on the opening overview", async (start) => {
    fake.respond = (op) =>
      op.table === "users"
        ? [{ id: ACTOR }]
        : op.table === "positions"
          ? [{ id: POS_A, name: "Destek Uzmanı", jobDescription: "Müşteri sorularını yanıtlayacak bir uzman arıyoruz." }]
          : op.table === "hiring_openings"
            ? [{ id: OPENING }]
            : op.table === "hiring_versions"
              ? [{ id: VERSION }]
              : [];
    const result = await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start, copyFrom: null, locale: "tr" });
    expect(result).toEqual({ ok: true, openingId: OPENING, next: `/hiring/openings/${OPENING}` });
  });
});
