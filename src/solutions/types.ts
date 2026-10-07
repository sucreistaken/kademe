import type { ReactNode } from "react";
import type { StatusTone } from "@/components/ui/status-dot";
import type { Executor } from "@/db/executor";
import type { consentTexts, mediaAssets } from "@/db/schema";
import type { solution } from "@/db/schema/enums";
import type { Locale } from "@/i18n/locale";
import type { Capability } from "@/lib/authorize";
import type { CandidateContext, ResolveResult } from "@/lib/candidate-context";
import type { ProctoringPolicy } from "@/lib/proctor/policy";
import type { CreationKind, CreationOutcome, CreationQuestion, CreationStatus } from "@/db/schema/create";
import type { AiPurpose } from "@/lib/ai-runs";
import type { SessionUser } from "@/lib/auth";

/**
 * The solution contract (spec 3). Core code knows solutions only through
 * these types and the two registries; ESLint forbids importing a solution's
 * folder from anywhere else.
 */

/** The database value. A new solution adds one value to the `solution` enum. */
export type SolutionKind = (typeof solution.enumValues)[number];
export type SolutionKey = "language-exam" | "hiring";
export type I18nLabel = { tr: string; en: string };
/** P1: the menu item's icon, by name (the menu is a client component; it maps the name to a lucide icon). */
export type NavIcon = "sun" | "briefcase" | "users" | "file-text" | "library" | "id-card" | "target" | "settings";
/** `activeFor`: other path prefixes under which the item counts as the current page. */
export type NavLink = { href: string; label: I18nLabel; icon: NavIcon; activeFor?: string[] };
/** The part of a solution's candidate state the core routes on. `position` is the running part's number, when the solution has one. */
export type CandidateStepState = { step: string; position?: number | null };

/** The pages `/a/[token]/*` hosts. A solution renders the ones its flow uses (renderPage). */
export type CandidatePageSlot = "landing" | "info" | "check" | "practice" | "stage" | "done";
export type CandidatePageInput = {
  token: string;
  /** The resolved link, problems included: the solution decides how an expired or finished link of its own looks. */
  resolved: ResolveResult & { ctx: CandidateContext };
  searchParams: Record<string, string | string[] | undefined>;
  /** Route parameters beyond the token, e.g. `{ n: "2" }` on /stage/[n]. */
  params: Record<string, string>;
};
export type ConsentTextRow = typeof consentTexts.$inferSelect;

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
  /** HIRING-VISUAL-FLOW H1: the solution's control view, linked from Today under "Dikkat isteyenler". */
  overview?: { href: string; label: I18nLabel };
  /** Where "invite" on Today leads for this solution; null while it cannot invite yet. */
  inviteHref: string | null;
  /** The words of this solution's invite on Today ("Aday davet et"), and who may use it. */
  inviteLabel: I18nLabel;
  inviteCapability: Capability;
  /**
   * True once this solution's candidate screens and endpoints exist. Until
   * then every core candidate route and page answers its invitations exactly
   * like an unknown token, even though the panel already uses the module.
   */
  candidateFlowLive: boolean;
  /** Language hint for transcribing this solution's recordings; null lets the provider detect it. */
  transcriptionHint: string | null;
  /**
   * True when this solution reads candidate requests (candidate_requests): an
   * accommodation (HIRING-UX 6.1 "Başka düzenleme") from the rights page and a
   * new link ("Yeni link iste") from the problem route. False: neither is filed.
   */
  accommodationRequests: boolean;
  /** An action this solution offers on a position page (the primary button there). */
  positionAction?: { label: I18nLabel; href(positionId: string): string };
  /** Where `/a/[token]` sends the candidate for a given state of this solution. */
  candidateStepPath(token: string, state: CandidateStepState): string;
}

export type TodayCell =
  | { kind: "text"; text: string }
  | { kind: "level"; text: string | null; final: boolean }
  | { kind: "dot"; tone: StatusTone; text: string };

/** K10: the kinds of request that may become Today's next task, in priority order. DATA_RIGHTS and DECISION are reserved for plan 3 (ruling C6). */
export type TodayTaskKind = "DATA_RIGHTS" | "ACCOMMODATION" | "DECISION";

/** One row on the shared Today screen. */
export type TodayItem = {
  id: string;
  solution: SolutionKey;
  /**
   * "review": waiting for a person, oldest first (the exam's queue). "running": in progress now.
   * "attention": something to look at, listed under "Dikkat isteyenler". "task": one request that may
   * become "Sıradaki iş" (K10); tasks are not listed one by one (their opening's attention row counts them).
   */
  lane: "review" | "running" | "attention" | "task";
  title: string;
  subtitle: string | null;
  href: string;
  sortAt: Date | null;
  /** review: exactly four cells (detail, level, status, integrity). running: one dot. attention and task: none. */
  cells: TodayCell[];
  /** lane "review": who the row waits for. "ai" means nothing is asked of the manager yet; omitted means "you". */
  waitingOn?: "you" | "ai";
  /** lane "task": its kind (K10). */
  task?: TodayTaskKind;
  /** lane "task": the candidate's own words, shown quoted. lane "attention": a plain note under the title. */
  detail?: string | null;
  /** lane "attention": which icon the row carries (inbox, clock, file). */
  attention?: "requests" | "expiring" | "draft";
  /** lane "attention": the row's own action words (default "Aç"). */
  actionLabel?: string;
};

/** A running part of an attempt, as the solution names it (proctor_events.segment_*). */
export type SegmentRef = { kind: string; runId: string };
export type MediaAssetRow = typeof mediaAssets.$inferSelect;

// ---------------------------------------------------------------------------
// Advanced "create" (spec 2026-10-06-advanced-ai-create-design 5.1)
// ---------------------------------------------------------------------------

/** The creation_kind enum values. */
export type CreatorKind = CreationKind;
export type CreateQuestion = CreationQuestion;
/** Who builds, in which language, for which draft row. Always from the session, never from the browser. */
export type CreatorCtx = { orgId: string; userId: string; role: SessionUser["role"]; locale: Locale; draftId: string };
/** Missing or invalid parameters come back as questions, never as an error. */
export type CreatorValidation<P> = { ok: true; params: P } | { ok: false; questions: CreateQuestion[] };
export type DraftResult<D> = { ok: true; draft: D } | { ok: false; code: "AI_UNAVAILABLE" | "FAILED" };
export type ApplyResult = ({ ok: true } & CreationOutcome) | { ok: false; code: "INVALID" | "WEIGHTS" };
/** Every refusal an Advanced action answers with; each has its own sentence (advancedCreate.error_*). */
export type CreateRefusal = "INVALID" | "WEIGHTS" | "NOT_FOUND" | "STATE" | "RATE_LIMITED" | "AI_UNAVAILABLE" | "FAILED" | "FORBIDDEN";
/** `href` is set only when the screen should go there now. */
export type CreateActionResult = { ok: true; draftId: string; status: CreationStatus; href?: string } | { ok: false; code: CreateRefusal };
/** The core's server actions a review component calls; the page binds them. */
export type ReviewActions = {
  apply(draftId: string, edits: unknown): Promise<CreateActionResult>;
  discard(draftId: string): Promise<CreateActionResult>;
  revise(draftId: string, change: string): Promise<CreateActionResult>;
};
export type CreatorReviewInput<D> = { ctx: CreatorCtx; draft: D; summary: string; actions: ReviewActions };

/**
 * One thing the Advanced box can build. A solution contributes creators through
 * its server module; the core reaches them only through solutionModules().
 */
export interface Creator<P = unknown, D = unknown> {
  kind: CreatorKind;
  /** EXAM: blueprint:write, QUESTION_SET: bank:write, POSITION: library:write. */
  capability: Capability;
  /** The AI purpose the draft step spends, for the rate limit; null when only the router calls AI. */
  aiPurpose: AiPurpose | null;
  label: I18nLabel;
  /** Router guide: what the parameters mean, which are required, allowed values. Plain English. */
  routerGuide: string;
  /** JSON schema (the subset Gemini accepts) of this creator's parameters, placed inside the router schema. */
  paramsJsonSchema: Record<string, unknown>;
  /** `useDefaults`: the question rounds are used up; take documented defaults, ask only for what has none. */
  validate(raw: unknown, locale: Locale, opts: { useDefaults: boolean }): CreatorValidation<P>;
  /** Builds the draft. May call AI and may write DRAFT-only rows. Never publishes. */
  draft(ctx: CreatorCtx, params: P): Promise<DraftResult<D>>;
  /** Applies the accepted draft through existing write functions. */
  apply(ctx: CreatorCtx, draft: D, edits: unknown): Promise<ApplyResult>;
  /** Undoes what `draft` wrote, when the draft is discarded or replaced. Omitted: `draft` wrote nothing. */
  discard?(ctx: CreatorCtx, draft: D): Promise<void>;
  /** The review cards: loads what they show and returns this kind's client component. */
  renderReview(input: CreatorReviewInput<D>): Promise<ReactNode>;
}

/** One "What you have" card on the Advanced page, already in the viewer's language. */
export type AdvancedCard = { key: string; title: string; lines: string[]; href: string };

/** Server-only: everything a solution answers for the core. */
export interface SolutionModule extends SolutionManifest {
  /** Rows for the shared Today screen. */
  today(orgId: string, userId: string, locale: Locale): Promise<TodayItem[]>;
  /** The proctoring policy frozen on this invitation; null when the solution has no proctoring. */
  proctorPolicy(assessmentId: string): Promise<ProctoringPolicy | null>;
  candidate: {
    /**
     * False when this invitation lacks the solution's own terms (no row of its
     * own); the core then answers it exactly like an unknown token. Omitted:
     * every invitation of this solution is served. Contract: returns false for
     * a missing or partial row; throws only on infrastructure failure.
     */
    serves?(ctx: CandidateContext): Promise<boolean>;
    /** The state document the candidate screens read; its `step` drives routing. */
    loadState(ctx: CandidateContext): Promise<CandidateStepState>;
    /** What the invitation is called, for problem reports. */
    title(ctx: CandidateContext): Promise<string>;
    /** Keeps the solution's clock alive; returns the running deadline, if any. */
    heartbeat(ctx: CandidateContext): Promise<{ deadlineAt: Date | null }>;
    /** The consent copy this invitation shows and records (a consent_texts row). */
    consentText(ctx: CandidateContext): Promise<ConsentTextRow>;
    /**
     * Whom a candidate is told to write to after a request (a new link, a
     * rights request), in place of a promise of a reply; null when there is
     * no address. Omitted: the core's own wording, which promises a reply (the exam's).
     */
    requestContact?(ctx: CandidateContext): Promise<string | null>;
    /** Renders a core candidate page for this solution. Omitted: the core's own pages (the exam's) render. */
    renderPage?(slot: CandidatePageSlot, input: CandidatePageInput): Promise<ReactNode>;
  };
  attempts: {
    /** The timed part of the attempt that is running now, for proctoring records. */
    openSegment(attemptId: string): Promise<SegmentRef | null>;
    /** Close whatever is open and finish the attempt (termination by policy). */
    terminate(attemptId: string): Promise<void>;
    /** A recording finished uploading; attach it wherever the solution keeps answers. */
    onMediaComplete(asset: MediaAssetRow): Promise<void>;
    /**
     * An upload failed for good (the asset is FAILED, e.g. completed with no
     * parts); the solution decides its answer again (an older finished take may
     * become it). Omitted: nothing to decide.
     */
    onMediaFailed?(asset: MediaAssetRow): Promise<void>;
    /** Cron: close this solution's timed parts whose clock ran out. Omitted: the core's own sweep covers it. */
    closeExpired?(now: Date, limit: number): Promise<{ scanned: number; closed: number }>;
  };
  /** Where this solution uses library rows. Optional: a solution that never reads the library omits it. */
  library?: {
    /**
     * `viewer` null asks for counts only (no names, no links), e.g. an "is it used" check.
     * `x`: the caller's transaction when it holds one; every read goes through it
     * (a read on the global db inside a transaction can starve the pool). Omitted: the global db.
     */
    usage(orgId: string, refs: LibraryRefs, viewer: LibraryViewer | null, x?: Executor): Promise<LibraryUsage>;
  };
  /** Advanced "create" (spec 5.1): what this solution builds from one sentence. Omitted: nothing. */
  creators?: Creator[];
  /** Advanced page, "What you have": this solution's area cards. Omitted: none. */
  advancedCards?(orgId: string, locale: Locale): Promise<AdvancedCard[]>;
}
