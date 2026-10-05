import { describe, expect, it } from "vitest";
import { can } from "@/lib/authorize";
import { inviteTargets, type InviteTarget } from "@/solutions/registry";
import { inviteChoice } from "./invite-choice";

const hiring: InviteTarget = { key: "hiring", href: "/hiring/invite", label: { tr: "Aday davet et", en: "Invite a candidate" }, capability: "opening:write" };
const exam: InviteTarget = { key: "language-exam", href: "/exam/students/new", label: { tr: "Öğrenci davet et", en: "Invite a student" }, capability: "student:invite" };

describe("Today's invite button (HIRING-UX 4.5)", () => {
  it("is one link with the solution's own label when one solution is allowed", () => {
    expect(inviteChoice([hiring, exam], (c) => c === "student:invite", "tr")).toEqual({ kind: "one", href: "/exam/students/new", label: "Öğrenci davet et" });
  });

  it("is a menu in menu order when more than one is allowed", () => {
    expect(inviteChoice([hiring, exam], () => true, "en")).toEqual({
      kind: "many",
      items: [
        { key: "hiring", href: "/hiring/invite", label: "Invite a candidate" },
        { key: "language-exam", href: "/exam/students/new", label: "Invite a student" },
      ],
    });
  });

  it("is nothing to click when none is allowed", () => {
    expect(inviteChoice([hiring, exam], () => false, "tr")).toEqual({ kind: "none" });
  });

  it("gives an owner and a manager the menu and a reviewer nothing, with the real roles and manifests", () => {
    const choiceFor = (role: "OWNER" | "MANAGER" | "REVIEWER") => inviteChoice(inviteTargets(), (c) => can({ role }, c), "tr");
    for (const role of ["OWNER", "MANAGER"] as const) {
      const choice = choiceFor(role);
      expect(choice.kind).toBe("many");
      if (choice.kind === "many") expect(choice.items.map((i) => i.href)).toEqual(["/hiring/invite", "/exam/students/new"]);
    }
    expect(choiceFor("REVIEWER")).toEqual({ kind: "none" });
  });
});
