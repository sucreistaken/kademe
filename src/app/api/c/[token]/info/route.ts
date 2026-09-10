import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { candidateJson } from "@/lib/candidate-safe";
import { loadState } from "@/lib/candidate-flow";
import { badRequest, readJson, withCandidate } from "@/lib/candidate-api";

type InfoBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
};

const trim = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Personal details. The candidate row already exists; this fills it in. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (request, ctx) => {
    const body = (await readJson<InfoBody>(request)) ?? {};
    const fullName = trim(body.fullName, 120);
    const email = trim(body.email, 160);
    const phone = trim(body.phone, 40);
    const location = trim(body.location, 120);

    if (fullName.length < 2) return badRequest(ctx, "NAME_REQUIRED");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return badRequest(ctx, "EMAIL_INVALID");
    }

    await db
      .update(candidates)
      .set({ fullName, email, phone: phone || null, location: location || null })
      .where(eq(candidates.id, ctx.candidate.id));

    ctx.candidate = { ...ctx.candidate, fullName, email, phone, location };
    return candidateJson(await loadState(ctx));
  });
}
