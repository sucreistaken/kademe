import { describe, expect, it } from "vitest";
import { managerT } from "@/i18n/manager";
import { inviteWaitReason } from "./invite-wait";

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
