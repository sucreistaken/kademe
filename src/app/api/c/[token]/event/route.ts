import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import {
  currentStage,
  logTechnicalEvents,
  TECHNICAL_EVENT_TYPES,
  type TechnicalEventType,
} from "@/lib/candidate-flow";
import { withCandidate } from "@/lib/candidate-api";

const ALLOWED = new Set<string>(TECHNICAL_EVENT_TYPES);

type Incoming = { type?: string; at?: string; meta?: Record<string, unknown> };

/**
 * Only events a browser genuinely reports are stored, and none of them ever
 * fail a candidate: the manager reads the log and decides. Sent with
 * `navigator.sendBeacon` on unload, so the body arrives as text and is parsed
 * here rather than through the JSON helper.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      let incoming: Incoming[] = [];
      try {
        const raw = await request.text();
        const parsed = JSON.parse(raw) as { events?: Incoming[] } | Incoming[];
        incoming = Array.isArray(parsed) ? parsed : (parsed.events ?? []);
      } catch {
        incoming = [];
      }

      const events = incoming
        .filter((e): e is Incoming & { type: string } => !!e.type && ALLOWED.has(e.type))
        .slice(0, 50)
        .map((e) => ({
          type: e.type as TechnicalEventType,
          at: e.at,
          meta: e.meta,
        }));

      if (events.length === 0) return candidateJson({ logged: 0 });

      const current = await currentStage(ctx);
      const run = current?.target.run;
      // Events are hung off a stage run. Outside a stage there is nothing to
      // attach them to, so they are dropped rather than invented.
      if (!run) return candidateJson({ logged: 0 });

      await logTechnicalEvents(run.id, events);
      return candidateJson({ logged: events.length });
    },
    { limit: 300, windowMs: 60_000 },
  );
}
