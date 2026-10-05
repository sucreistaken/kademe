import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { saveResponse } from "@/solutions/hiring/server/candidate";
import { AnswerBody, readBody, refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

async function save(req: NextRequest, params: Promise<{ token: string }>) {
  return withHiringCandidate(
    req,
    params,
    async (request, h) => {
      const body = await readBody(request, AnswerBody);
      if (!body) return refuse(h, "REQUEST_INVALID", 400);
      const saved = await saveResponse(h, { position: body.stagePosition, activityId: body.activityId, answer: body.answer });
      if (!saved.ok) return refuse(h, saved.code, statusOf(saved.code));
      return candidateJson({ saved: true, at: saved.at });
    },
    // Autosave runs while the candidate types, like the exam's answer autosave.
    { limit: 600 },
  );
}

/** Autosave of the open question (HIRING-UX 6.7 "Kaydedildi"). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return save(req, params);
}

/** The same, for navigator.sendBeacon on page hide (beacons can only POST). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return save(req, params);
}
