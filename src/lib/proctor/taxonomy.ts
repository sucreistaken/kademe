/**
 * Proctoring event taxonomy. Pure data plus two helpers, no database.
 *
 * Every signal the proctor can raise is listed here once, with the facts the
 * rest of the pipeline needs: how serious it is by default, who is allowed to
 * report it, whether it has a duration, whether a second AI look at the
 * snapshot is worth paying for, and whether it describes a hole in our
 * coverage rather than candidate behaviour.
 *
 * Severity is a default, not a verdict. The teacher always decides; the
 * integrity score only orders the queue.
 */

export const PROCTOR_EVENT_TYPES = [
  // Browser: reported by the candidate's page.
  "FULLSCREEN_EXIT",
  "TAB_HIDDEN",
  "FOCUS_LOST",
  "SCREEN_SHARE_STOPPED",
  "SCREEN_SHARE_WRONG_SURFACE",
  "SECOND_SCREEN_DETECTED",
  "CAMERA_LOST",
  "MIC_LOST",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "CONTEXT_MENU",
  "BLOCKED_SHORTCUT",
  "PRINT_ATTEMPT",
  "LARGE_TEXT_INSERT",
  "WINDOW_RESIZED",
  "EXTENSION_INJECTED",
  "AUTOMATION",
  "VIRTUAL_CAMERA",
  "OFFLINE",
  "PAGE_UNLOAD",
  "RESUMED",
  "DUPLICATE_TAB",
  // Model: produced by the in-browser vision and audio models.
  "NO_FACE",
  "MULTIPLE_FACES",
  "GAZE_AWAY",
  "PHONE_DETECTED",
  "VOICE_DETECTED",
  "PROCTOR_MODEL_UNAVAILABLE",
  // Server: derived on the server, never accepted from the client.
  "HEARTBEAT_GAP",
  "SNAPSHOT_GAP",
  "DUPLICATE_SESSION",
  "IP_CHANGED",
  "TERMINATED",
] as const;

export type ProctorEventType = (typeof PROCTOR_EVENT_TYPES)[number];

export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH";
export type Source = "BROWSER" | "MODEL" | "SERVER";

export type TaxonomyEntry = {
  severity: Severity;
  source: Source;
  /** Has a start and an end; the duration matters, not just the count. */
  interval: boolean;
  /** Worth a second AI look at the snapshot around it. Audio is never sent. */
  aiReview: boolean;
  /** Describes a gap in what we could observe, not something the candidate did. */
  coverage: boolean;
};

function entry(
  severity: Severity,
  source: Source,
  flags: Partial<Pick<TaxonomyEntry, "interval" | "aiReview" | "coverage">> = {},
): TaxonomyEntry {
  return {
    severity,
    source,
    interval: flags.interval ?? false,
    aiReview: flags.aiReview ?? false,
    coverage: flags.coverage ?? false,
  };
}

export const TAXONOMY: Record<ProctorEventType, TaxonomyEntry> = {
  FULLSCREEN_EXIT: entry("MEDIUM", "BROWSER", { interval: true }),
  TAB_HIDDEN: entry("HIGH", "BROWSER", { interval: true, aiReview: true }),
  FOCUS_LOST: entry("LOW", "BROWSER", { interval: true, aiReview: true }),
  SCREEN_SHARE_STOPPED: entry("HIGH", "BROWSER", { interval: true }),
  SCREEN_SHARE_WRONG_SURFACE: entry("MEDIUM", "BROWSER"),
  SECOND_SCREEN_DETECTED: entry("HIGH", "BROWSER", { aiReview: true }),
  CAMERA_LOST: entry("HIGH", "BROWSER", { interval: true }),
  MIC_LOST: entry("HIGH", "BROWSER", { interval: true }),
  COPY_ATTEMPT: entry("LOW", "BROWSER"),
  PASTE_ATTEMPT: entry("LOW", "BROWSER"),
  CONTEXT_MENU: entry("LOW", "BROWSER"),
  BLOCKED_SHORTCUT: entry("LOW", "BROWSER"),
  PRINT_ATTEMPT: entry("LOW", "BROWSER"),
  LARGE_TEXT_INSERT: entry("MEDIUM", "BROWSER"),
  WINDOW_RESIZED: entry("LOW", "BROWSER"),
  EXTENSION_INJECTED: entry("LOW", "BROWSER"),
  AUTOMATION: entry("LOW", "BROWSER"),
  VIRTUAL_CAMERA: entry("MEDIUM", "BROWSER"),
  OFFLINE: entry("INFO", "BROWSER", { interval: true }),
  PAGE_UNLOAD: entry("MEDIUM", "BROWSER"),
  RESUMED: entry("INFO", "BROWSER"),
  DUPLICATE_TAB: entry("MEDIUM", "BROWSER"),

  NO_FACE: entry("MEDIUM", "MODEL", { interval: true, aiReview: true }),
  MULTIPLE_FACES: entry("HIGH", "MODEL", { interval: true, aiReview: true }),
  // Gaze is noisy and a snapshot cannot show where the eyes were pointing.
  GAZE_AWAY: entry("LOW", "MODEL", { interval: true }),
  PHONE_DETECTED: entry("HIGH", "MODEL", { aiReview: true }),
  // We never upload audio, so there is nothing for a reviewer model to look at.
  VOICE_DETECTED: entry("MEDIUM", "MODEL", { interval: true }),
  PROCTOR_MODEL_UNAVAILABLE: entry("INFO", "MODEL", { coverage: true }),

  HEARTBEAT_GAP: entry("MEDIUM", "SERVER"),
  SNAPSHOT_GAP: entry("MEDIUM", "SERVER"),
  DUPLICATE_SESSION: entry("HIGH", "SERVER"),
  IP_CHANGED: entry("LOW", "SERVER"),
  TERMINATED: entry("HIGH", "SERVER"),
};

const TYPE_SET: ReadonlySet<string> = new Set(PROCTOR_EVENT_TYPES);

export function isProctorEventType(x: unknown): x is ProctorEventType {
  return typeof x === "string" && TYPE_SET.has(x);
}

/** A glance away is normal; ten seconds in another window is not. */
export const FOCUS_LOST_ESCALATE_MS = 10_000;
/** Leaning out of frame briefly is normal; half a minute gone is not. */
export const NO_FACE_ESCALATE_MS = 30_000;

/**
 * Severity after taking the duration into account. Only two types escalate,
 * both because their default is set for the short, harmless case. An open
 * interval (duration null) keeps the default until it closes.
 */
export function effectiveSeverity(
  type: ProctorEventType,
  durationMs: number | null,
): Severity {
  const base = TAXONOMY[type].severity;
  if (durationMs === null) return base;
  if (type === "FOCUS_LOST" && durationMs > FOCUS_LOST_ESCALATE_MS) return "MEDIUM";
  if (type === "NO_FACE" && durationMs > NO_FACE_ESCALATE_MS) return "HIGH";
  return base;
}
