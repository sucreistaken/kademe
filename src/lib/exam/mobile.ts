import type { BlueprintConfig } from "./blueprint";

/**
 * Whether an exam runs on a phone or a tablet. The language exam is desktop
 * only (user decision 2026-10-14); the one exception is an exam whose config
 * asks for phones (`allowMobile`, the public web check of 2026-11-09) and that
 * a phone can really take:
 *   - nothing is watched: preset OFF, and no camera, microphone, screen
 *     sharing or fullscreen switched on (a phone cannot share its screen and
 *     holds the camera at the wrong angle);
 *   - nothing is typed or spoken at length: no enabled writing or speaking
 *     section.
 * A config that asks for phones but breaks either rule stays desktop only, so
 * the flag can never put a watched exam or a writing task on a phone.
 */
export function mobileAllowed(cfg: Pick<BlueprintConfig, "allowMobile" | "proctoring" | "sections">): boolean {
  if (cfg.allowMobile !== true) return false;
  const p = cfg.proctoring;
  if (p.preset !== "OFF" || p.camera || p.microphone || p.screenShare || p.fullscreen) return false;
  return !cfg.sections.some((s) => s.enabled && (s.section === "WRITING" || s.section === "SPEAKING"));
}
