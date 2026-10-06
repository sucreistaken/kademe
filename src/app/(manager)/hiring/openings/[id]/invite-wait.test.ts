import { describe, expect, it } from "vitest";
import { managerT } from "@/i18n/manager";
import { inviteBlock, inviteWaitReason } from "./invite-wait";

/**
 * Task 19 fix round 1, M1: the overview and the Candidates tab give the same
 * reason when "Aday davet et" waits (RULES 5), from one place.
 */
describe("why 'Aday davet et' waits", () => {
  it("says closed first, then the role, then that the assessment is not published", () => {
    const t = managerT("tr");
    expect(inviteWaitReason(true, true, t)).toBe("Bu alım kapalı. Yeni davet yapılamaz.");
    expect(inviteWaitReason(true, false, t)).toBe("Bu alım kapalı. Yeni davet yapılamaz.");
    expect(inviteWaitReason(false, false, t)).toBe("Rolün aday davet edemez.");
    expect(inviteWaitReason(false, true, t)).toBe("Aday davet etmek için önce değerlendirmeyi yayınla.");
  });

  it("speaks the manager's language", () => {
    const t = managerT("en");
    const reasons = [inviteWaitReason(true, true, t), inviteWaitReason(false, false, t), inviteWaitReason(false, true, t)];
    expect(new Set(reasons).size).toBe(3);
    for (const r of reasons) expect(r).toMatch(/^[\x20-\x7E]+$/);
  });
});

/** B-M3: an invitable opening the invite form would refuse anyway: the header's button waits with the form's own reason. */
describe("an opening's own invite blockers", () => {
  const opening = { id: "o1", name: "O", live: true, evaluators: 1, minEvaluations: 2, deadlineDay: "2026-10-10" as string | null };
  it("waits while no active evaluator is on the team, or once the opening's last day passed; a short team still invites", () => {
    expect(inviteBlock(opening, "2026-10-06")).toBeNull();
    expect(inviteBlock({ ...opening, evaluators: 0 }, "2026-10-06")).toBe("noEvaluators");
    expect(inviteBlock(opening, "2026-10-10")).toBeNull();
    expect(inviteBlock(opening, "2026-10-11")).toBe("openingDeadline");
    expect(inviteBlock({ ...opening, deadlineDay: null }, "2030-01-01")).toBeNull();
    expect(inviteBlock(null, "2026-10-06")).toBeNull();
  });
});
