import type { CheckStep, Issue, Wait } from "@/components/candidate/proctor/check-steps";
import type { IllustrationName } from "@/components/visual/illustrations";

/**
 * Which explanatory picture a proctoring block screen shows, so a student who
 * reads the UI language poorly still sees what to do. A state card carries no
 * mascot (DESIGN.md), so a screen with no fitting picture shows none at all.
 */

type CheckPicture = Extract<IllustrationName, "secondScreen" | "shareEntireScreen" | "cameraFrame">;

/** The system check: only the screens that stop the student (a blocked start or a step that needs fixing). */
export function checkPicture(step: CheckStep, wait: Wait | null, issue: Issue | null): CheckPicture | null {
  if (step === "blocked") return wait === "secondScreen" ? "secondScreen" : null;
  if (step === "devices" && (issue === "denied" || issue === "lost")) return "cameraFrame";
  if (step === "screen" && (issue === "wrongSurface" || issue === "screenDenied")) return "shareEntireScreen";
  return null;
}

/** The recover panel during the exam: what the student has to turn back on. */
export const RECOVER_PICTURE = {
  FULLSCREEN: "fullscreen",
  SCREEN: "shareEntireScreen",
  CAMERA: "cameraFrame",
} as const satisfies Record<"FULLSCREEN" | "SCREEN" | "CAMERA", IllustrationName>;
