import { z } from "zod";
import {
  competencySuggestionSchema,
  hiringDraftSchema,
  stageSuggestionSchema,
  type CompetencySuggestion,
  type HiringDraft,
  type StageSuggestion,
} from "@/solutions/hiring/ai/draft";

/**
 * The AI screen's proposals in this tab's sessionStorage, one entry per opening
 * and draft version (fix round 1, Important 4): a reload shows the same cards
 * with their accepted marks instead of asking the model again, and a card
 * accepted before the reload cannot be accepted a second time. The stored
 * proposal is browser data, so it passes the strict schema again on load; the
 * server validates every accepted card anyway.
 */
export const SESSION_PREFIX = "kademe.hiring.ai.";

/** One proposal and what the manager did with its cards; accepted marks are keyed by generationId + card key. */
export type Generation = {
  generationId: string;
  draft: HiringDraft;
  /** The ad this proposal was made from (its quotes are checked against it). */
  jobAd: string;
  budgetWarning: boolean;
  /** stage card key -> stage id in the draft */
  acceptedStages: Record<string, string>;
  /** competency card key -> library row, and whether this acceptance created it */
  acceptedCompetencies: Record<string, { id: string; created: boolean }>;
  /** "s:<key>" / "c:<key>" of removed cards */
  removed: Record<string, true>;
  stageEdits: Record<string, StageSuggestion>;
  competencyEdits: Record<string, CompetencySuggestion>;
};

export type AiSession = {
  openingId: string;
  versionNumber: number;
  /** The ad in the text box when it differs from the position's (minor 10); null otherwise. */
  jobAd: string | null;
  /** At most two: the previous proposal stays restorable after a new one; none while only an ad was pasted. */
  generations: Generation[];
  current: number;
};

export function sessionKey(openingId: string, versionNumber: number): string {
  return `${SESSION_PREFIX}${openingId}.v${versionNumber}`;
}

const id = z.uuid();
const generationSchema = z.object({
  generationId: z.string().min(1).max(100),
  draft: hiringDraftSchema,
  jobAd: z.string().max(20_000),
  budgetWarning: z.boolean(),
  acceptedStages: z.record(z.string().max(40), id),
  acceptedCompetencies: z.record(z.string().max(40), z.object({ id, created: z.boolean() })),
  removed: z.record(z.string().max(50), z.literal(true)),
  stageEdits: z.record(z.string().max(40), stageSuggestionSchema),
  competencyEdits: z.record(z.string().max(40), competencySuggestionSchema),
});
const sessionSchema = z.object({
  openingId: z.string(),
  versionNumber: z.number().int(),
  jobAd: z.string().max(20_000).nullable(),
  generations: z.array(generationSchema).max(2),
  current: z.number().int().min(0),
});

/** The stored entry when it is this opening's and this version's and still valid; null otherwise. */
export function parseSession(raw: string | null, openingId: string, versionNumber: number): AiSession | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = sessionSchema.safeParse(value);
  if (!parsed.success) return null;
  const s = parsed.data;
  if (s.openingId !== openingId || s.versionNumber !== versionNumber) return null;
  if (s.current >= Math.max(1, s.generations.length)) return null;
  return s;
}

/** A new proposal becomes current; the one on screen before it stays as the restorable previous. */
export function withGeneration(session: AiSession | null, openingId: string, versionNumber: number, generation: Generation): AiSession {
  const shown = session ? session.generations[session.current] : undefined;
  const generations = shown ? [shown, generation] : [generation];
  return { openingId, versionNumber, jobAd: session?.jobAd ?? null, generations, current: generations.length - 1 };
}

/** This opening's entries other than `keep` (all of them when keep is null: not in draft mode). */
export function staleKeys(keys: readonly string[], openingId: string, keep: string | null): string[] {
  const prefix = `${SESSION_PREFIX}${openingId}.v`;
  return keys.filter((k) => k.startsWith(prefix) && k !== keep);
}
