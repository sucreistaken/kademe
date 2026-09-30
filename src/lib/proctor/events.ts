/**
 * Client event intake. Pure, no database.
 *
 * Everything the candidate's page sends is untrusted: it can be replayed,
 * forged, reordered or stamped with a wrong clock. This module turns a raw
 * batch into rows the server is willing to store, and silently drops what it
 * will not. A dropped event is counted, never echoed back, so a tampered
 * client learns nothing about which field tripped the check.
 */

import { z } from "zod";
import {
  TAXONOMY,
  effectiveSeverity,
  isProctorEventType,
  type ProctorEventType,
  type Severity,
  type Source,
} from "./taxonomy";

export const MAX_BATCH = 50;
export const MAX_META_BYTES = 2048;

export type NormalizedEvent = {
  clientEventId: string;
  type: ProctorEventType;
  source: Source;
  severity: Severity;
  /** Server clock, ms. */
  startedAt: number;
  endedAt: number | null;
  meta: Record<string, unknown> | null;
};

export type NormalizeContext = {
  now: number;
  attemptStartedAt: number;
  /** serverTime = clientTime + clientOffsetMs, measured at heartbeat. */
  clientOffsetMs: number;
};

const rawEventSchema = z.object({
  clientEventId: z.string().min(1).max(64),
  type: z.string(),
  at: z.number(),
  endedAt: z.number().optional(),
  meta: z.unknown().optional(),
});

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function metaOrNull(meta: unknown): Record<string, unknown> | null {
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) return null;
  let json: string;
  try {
    json = JSON.stringify(meta);
  } catch {
    return null; // cycles, BigInt
  }
  if (new TextEncoder().encode(json).length > MAX_META_BYTES) return null;
  // Round-trip so the stored value is plain JSON, not whatever object came in.
  return JSON.parse(json) as Record<string, unknown>;
}

function withSeverity(
  e: Omit<NormalizedEvent, "severity" | "source">,
): NormalizedEvent {
  const duration = e.endedAt === null ? null : e.endedAt - e.startedAt;
  return {
    ...e,
    source: TAXONOMY[e.type].source,
    severity: effectiveSeverity(e.type, duration),
  };
}

/**
 * Validate and normalise one batch. Only BROWSER and MODEL types are accepted:
 * SERVER types describe things the server observed itself, and letting the
 * client report them would let it forge (or pre-empt) its own heartbeat gaps.
 *
 * Items past the first MAX_BATCH are rejected, not queued. Two items with the
 * same clientEventId in one batch (start and end of an interval flushed
 * together) are merged.
 */
export function normalizeBatch(
  raw: unknown,
  ctx: NormalizeContext,
): { accepted: NormalizedEvent[]; rejected: number } {
  if (!Array.isArray(raw)) return { accepted: [], rejected: 1 };

  let rejected = Math.max(0, raw.length - MAX_BATCH);
  const byId = new Map<string, NormalizedEvent>();
  const lo = ctx.attemptStartedAt;
  const hi = Math.max(ctx.attemptStartedAt, ctx.now);

  for (const item of raw.slice(0, MAX_BATCH)) {
    const parsed = rawEventSchema.safeParse(item);
    if (!parsed.success) {
      rejected++;
      continue;
    }
    const r = parsed.data;
    if (!isProctorEventType(r.type) || TAXONOMY[r.type].source === "SERVER") {
      rejected++;
      continue;
    }
    const type = r.type;
    const startedAt = clamp(r.at + ctx.clientOffsetMs, lo, hi);
    // Point events have no end. An interval end before its start is clock
    // noise, not a negative duration, so it is pinned to the start.
    const endedAt =
      TAXONOMY[type].interval && r.endedAt !== undefined
        ? Math.max(startedAt, clamp(r.endedAt + ctx.clientOffsetMs, lo, hi))
        : null;

    const event = withSeverity({
      clientEventId: r.clientEventId,
      type,
      startedAt,
      endedAt,
      meta: metaOrNull(r.meta),
    });

    const prior = byId.get(event.clientEventId);
    if (prior && prior.type !== event.type) {
      rejected++;
      continue;
    }
    byId.set(event.clientEventId, prior ? mergeInterval(prior, event) : event);
  }

  return { accepted: [...byId.values()], rejected };
}

/**
 * Fold a later report of the same interval into the stored one. The client
 * sends an interval twice, once when it opens and once when it closes, and
 * either may arrive first or be retried. Keeping the earliest start and the
 * latest end makes the merge order-independent and idempotent.
 */
export function mergeInterval(
  existing: NormalizedEvent,
  incoming: NormalizedEvent,
): NormalizedEvent {
  if (existing.clientEventId !== incoming.clientEventId || existing.type !== incoming.type) {
    throw new Error("mergeInterval: events do not describe the same interval");
  }
  const ends = [existing.endedAt, incoming.endedAt].filter((x): x is number => x !== null);
  return withSeverity({
    clientEventId: existing.clientEventId,
    type: existing.type,
    startedAt: Math.min(existing.startedAt, incoming.startedAt),
    endedAt: ends.length > 0 ? Math.max(...ends) : null,
    meta: existing.meta ?? incoming.meta,
  });
}
