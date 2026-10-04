import type { StatusTone } from "@/components/ui/status-dot";
import type { mediaAssets } from "@/db/schema";
import type { solution } from "@/db/schema/enums";
import type { Locale } from "@/i18n/locale";
import type { CandidateContext } from "@/lib/candidate-context";
import type { ProctoringPolicy } from "@/lib/proctor/policy";

/**
 * The solution contract (spec 3). Core code knows solutions only through
 * these types and the two registries; ESLint forbids importing a solution's
 * folder from anywhere else.
 */

/** The database value. A new solution adds one value to the `solution` enum. */
export type SolutionKind = (typeof solution.enumValues)[number];
export type SolutionKey = "language-exam" | "hiring";
export type I18nLabel = { tr: string; en: string };
export type NavLink = { href: string; label: I18nLabel };
/** The part of a solution's candidate state the core routes on. */
export type CandidateStepState = { step: string };

/** Library rows a screen asks about (HIRING-UX 4.2 "Nerede kullanılıyor"). */
export type LibraryRefs = { positionIds: string[]; competencyIds: string[] };
export type LibraryUsageEntry = {
  /** Everything in this solution that uses the row (e.g. openings). */
  total: number;
  /** Of those, the open openings whose published version uses the row. */
  live: number;
  /** Only what the viewer may open; total - items.length are counted but not named. */
  items: Array<{ label: string; href: string }>;
};
/** Who asks: a solution names and links only what this person may open. */
export type LibraryViewer = { id: string; role: "OWNER" | "MANAGER" | "REVIEWER" };
export type LibraryUsage = {
  positions: Record<string, LibraryUsageEntry>;
  competencies: Record<string, LibraryUsageEntry>;
};

/** Client-safe: plain data and pure functions only. */
export interface SolutionManifest {
  key: SolutionKey;
  dbKind: SolutionKind;
  basePath: "/exam" | "/hiring";
  /** Menu group header (shown only when more than one solution is registered). */
  label: I18nLabel;
  /** Menu entries, in menu order. Only routes that exist (RULES.md rule 7). */
  nav: NavLink[];
  /** Where "invite" on Today leads for this solution; null while it cannot invite yet. */
  inviteHref: string | null;
  /**
   * True once this solution's candidate screens and endpoints exist. Until
   * then every core candidate route and page answers its invitations exactly
   * like an unknown token, even though the panel already uses the module.
   */
  candidateFlowLive: boolean;
  /** An action this solution offers on a position page (the primary button there). */
  positionAction?: { label: I18nLabel; href(positionId: string): string };
  /** Where `/a/[token]` sends the candidate for a given state of this solution. */
  candidateStepPath(token: string, state: CandidateStepState): string;
}

export type TodayCell =
  | { kind: "text"; text: string }
  | { kind: "level"; text: string | null; final: boolean }
  | { kind: "dot"; tone: StatusTone; text: string };

/** One row on the shared Today screen. */
export type TodayItem = {
  id: string;
  solution: SolutionKey;
  /** "review": waiting for a person, oldest first. "running": in progress now. */
  lane: "review" | "running";
  title: string;
  subtitle: string | null;
  href: string;
  sortAt: Date | null;
  /** review: exactly four cells (detail, level, status, integrity). running: one dot. */
  cells: TodayCell[];
};

/** A running part of an attempt, as the solution names it (proctor_events.segment_*). */
export type SegmentRef = { kind: string; runId: string };
export type MediaAssetRow = typeof mediaAssets.$inferSelect;

/** Server-only: everything a solution answers for the core. */
export interface SolutionModule extends SolutionManifest {
  /** Rows for the shared Today screen. */
  today(orgId: string, userId: string, locale: Locale): Promise<TodayItem[]>;
  /** The proctoring policy frozen on this invitation; null when the solution has no proctoring. */
  proctorPolicy(assessmentId: string): Promise<ProctoringPolicy | null>;
  candidate: {
    /** The state document the candidate screens read; its `step` drives routing. */
    loadState(ctx: CandidateContext): Promise<CandidateStepState>;
    /** What the invitation is called, for problem reports. */
    title(ctx: CandidateContext): Promise<string>;
    /** Keeps the solution's clock alive; returns the running deadline, if any. */
    heartbeat(ctx: CandidateContext): Promise<{ deadlineAt: Date | null }>;
  };
  attempts: {
    /** The timed part of the attempt that is running now, for proctoring records. */
    openSegment(attemptId: string): Promise<SegmentRef | null>;
    /** Close whatever is open and finish the attempt (termination by policy). */
    terminate(attemptId: string): Promise<void>;
    /** A recording finished uploading; attach it wherever the solution keeps answers. */
    onMediaComplete(asset: MediaAssetRow): Promise<void>;
  };
  /** Where this solution uses library rows. Optional: a solution that never reads the library omits it. */
  library?: {
    /** `viewer` null asks for counts only (no names, no links), e.g. an "is it used" check. */
    usage(orgId: string, refs: LibraryRefs, viewer: LibraryViewer | null): Promise<LibraryUsage>;
  };
}
