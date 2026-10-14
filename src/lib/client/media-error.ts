/**
 * Which kind of camera or microphone failure an error is, so the screen can say
 * it in the student's language instead of showing the browser's English text.
 * "permission": the student or the browser said no. "noDevice": nothing to
 * record with, or another application holds it. "generic": anything else.
 */
export type MediaErrorKind = "permission" | "noDevice" | "generic";

export function mediaErrorKind(err: unknown): MediaErrorKind {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "permission";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "NotReadableError" || name === "TrackStartError" || name === "OverconstrainedError") {
    return "noDevice";
  }
  return "generic";
}

export const MEDIA_ERROR_KEY = {
  permission: "mediaPermission",
  noDevice: "mediaNoDevice",
  generic: "mediaGeneric",
} as const;
