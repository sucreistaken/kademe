import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Publish from "@/solutions/hiring/server/publish";
import { HiringConflict, HiringInvalid, HiringNotFound } from "@/solutions/hiring/server/errors";

/**
 * "Yayınla" answers every server refusal with its own notice on the overview
 * (carry 5): the gate's problems, a closed opening, a draft published in
 * another tab, an invalid value, a missing row. Anything else is a real
 * failure and reaches the error boundary.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
const OPENING = "33333333-3333-4333-8333-333333333333";
vi.mock("./access", () => ({
  openingFor: async () => ({ user: { id: "u1", orgId: "o1", role: "OWNER" }, opening: { id: OPENING }, access: { view: true, edit: true } }),
}));
const publishDraft = vi.fn<typeof Publish.publishDraft>();
vi.mock("@/solutions/hiring/server/publish", () => ({
  publishDraft: (...a: Parameters<typeof Publish.publishDraft>) => publishDraft(...a),
}));

import { publishOpeningAction } from "./actions";

const form = (back?: string) => {
  const f = new FormData();
  f.set("openingId", OPENING);
  if (back) f.set("back", back);
  return f;
};
const base = `/hiring/openings/${OPENING}`;

beforeEach(() => {
  publishDraft.mockReset();
});

describe("publishOpeningAction", () => {
  it("returns to the overview with the published number", async () => {
    publishDraft.mockResolvedValue({ ok: true, versionId: "v", number: 2 });
    await expect(publishOpeningAction(form())).rejects.toThrow(`redirect:${base}?published=2`);
    expect(publishDraft).toHaveBeenCalledWith("o1", OPENING, "u1");
  });

  it("says the gate refused", async () => {
    publishDraft.mockResolvedValue({ ok: false, problems: [{ code: "NO_STAGE" }] });
    await expect(publishOpeningAction(form())).rejects.toThrow(`redirect:${base}?publish=refused`);
  });

  it.each([
    [new HiringConflict("CLOSED"), "closed"],
    [new HiringConflict("NO_DRAFT"), "nodraft"],
    [new HiringInvalid([{ path: "x", message: "bad" }]), "invalid"],
    [new HiringNotFound("user"), "failed"],
  ])("maps %s to its notice", async (error, notice) => {
    publishDraft.mockRejectedValue(error);
    await expect(publishOpeningAction(form())).rejects.toThrow(`redirect:${base}?publish=${notice}`);
  });

  it("lets an unexpected error reach the error boundary", async () => {
    publishDraft.mockRejectedValue(new Error("connection lost"));
    await expect(publishOpeningAction(form())).rejects.toThrow("connection lost");
  });
});
