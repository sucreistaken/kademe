import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Versions from "@/solutions/hiring/server/versions";
import { HiringConflict, HiringNotFound } from "@/solutions/hiring/server/errors";

/**
 * The preview's stamp (Task 19 carry 4): the action asks for the right to edit
 * this opening first (organisation-scoped load, role, CLOSED), so a reviewer's
 * visit stamps nothing; it stamps with the session's organisation, never one
 * from the browser; every refusal is a code, never a raw error.
 */
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/db", () => ({ db: {} }));

const OPENING = "33333333-3333-4333-8333-333333333333";
const DRAFT = "44444444-4444-4444-8444-444444444444";

type Gate = { ok: true } | { ok: false; code: "NOT_FOUND" | "CLOSED" | "FORBIDDEN" };
let gate: Gate = { ok: true };
const editableOpening = vi.fn(async (id: string) =>
  gate.ok ? { ok: true as const, user: { id: "u1", orgId: "o1", email: "", name: "", role: "OWNER" }, opening: { id, status: "DRAFT" } } : gate,
);
vi.mock("../../access", () => ({ editableOpening: (id: string) => editableOpening(id) }));

const markPreviewed = vi.hoisted(() => vi.fn<typeof Versions.markPreviewed>());
vi.mock("@/solutions/hiring/server/versions", () => ({ markPreviewed: (...a: Parameters<typeof Versions.markPreviewed>) => markPreviewed(...a) }));

import { markPreviewedAction } from "./actions";

beforeEach(() => {
  gate = { ok: true };
  editableOpening.mockClear();
  revalidatePath.mockClear();
  markPreviewed.mockReset();
  markPreviewed.mockResolvedValue(true);
});

describe("markPreviewedAction", () => {
  it("asks for the right to edit this opening; a viewer who may not edit (a reviewer), a closed and an unknown opening stamp nothing", async () => {
    for (const code of ["NOT_FOUND", "CLOSED", "FORBIDDEN"] as const) {
      gate = { ok: false, code };
      await expect(markPreviewedAction(OPENING, DRAFT)).resolves.toEqual({ ok: false, code });
    }
    expect(editableOpening).toHaveBeenCalledWith(OPENING);
    expect(markPreviewed).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("stamps the draft the preview showed with the session's organisation and refreshes the overview", async () => {
    await expect(markPreviewedAction(OPENING, DRAFT)).resolves.toEqual({ ok: true, stamped: true });
    expect(markPreviewed).toHaveBeenCalledWith("o1", OPENING, DRAFT);
    expect(revalidatePath).toHaveBeenCalledWith("/hiring/openings/[id]", "page");
  });

  it("a version that is no longer the draft is not stamped, and nothing is refreshed", async () => {
    markPreviewed.mockResolvedValueOnce(false);
    await expect(markPreviewedAction(OPENING, DRAFT)).resolves.toEqual({ ok: true, stamped: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("a malformed request is INVALID before anything is read or written", async () => {
    await expect(markPreviewedAction(42 as unknown as string, DRAFT)).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(markPreviewedAction(OPENING, "not-an-id")).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(markPreviewedAction(OPENING, undefined as unknown as string)).resolves.toEqual({ ok: false, code: "INVALID" });
    expect(editableOpening).not.toHaveBeenCalled();
    expect(markPreviewed).not.toHaveBeenCalled();
  });

  it("a draft published meanwhile (NO_DRAFT, the freeze refusal), a closed and a vanished opening are codes, not errors", async () => {
    markPreviewed.mockRejectedValueOnce(new HiringConflict("NO_DRAFT"));
    await expect(markPreviewedAction(OPENING, DRAFT)).resolves.toEqual({ ok: false, code: "NO_DRAFT" });
    markPreviewed.mockRejectedValueOnce(new HiringConflict("CLOSED"));
    await expect(markPreviewedAction(OPENING, DRAFT)).resolves.toEqual({ ok: false, code: "CLOSED" });
    markPreviewed.mockRejectedValueOnce(new HiringNotFound("opening"));
    await expect(markPreviewedAction(OPENING, DRAFT)).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("any other error is a real error and is not swallowed", async () => {
    markPreviewed.mockRejectedValueOnce(new Error("connection lost"));
    await expect(markPreviewedAction(OPENING, DRAFT)).rejects.toThrow("connection lost");
  });
});
