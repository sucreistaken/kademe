import { isCandidateLocale } from "@/i18n/locale";
import type { PublicPlacementRequest, UtmTag } from "@/solutions/types";

/**
 * The body of POST /api/public/placement (the website's level-test link,
 * 2026-11-09), checked before any solution sees it. Pure.
 */

export const UTM_TAGS: readonly UtmTag[] = ["source", "medium", "campaign", "term", "content"];

export type PlacementField = "name" | "email" | "phone" | "locale" | "crmLeadId" | "utm";

export type ParsedPlacement =
  | { ok: true; request: PublicPlacementRequest }
  | { ok: false; code: "INVALID_BODY" | "CONSENT_REQUIRED" }
  | { ok: false; code: "INVALID_FIELD"; field: PlacementField };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A trimmed string with inner whitespace collapsed; null when absent or blank; undefined when not a string. */
function text(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const v = value.replace(/\s+/g, " ").trim();
  return v === "" ? null : v;
}

/**
 * The request, with the limits of the student's own info step
 * (api/c/[token]/info): a name of 2 to 120 characters, an e-mail of the same
 * shape and at most 160, a phone of at most 40. `locale` is one of the five
 * student languages. `consent` must be exactly true: the website asked for it
 * and the visitor gave it. `utm` takes the five UTM tags, with or without the
 * `utm_` prefix; anything else in it is ignored.
 */
export function parsePlacementRequest(body: unknown): ParsedPlacement {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, code: "INVALID_BODY" };
  const b = body as Record<string, unknown>;
  if (b.consent !== true) return { ok: false, code: "CONSENT_REQUIRED" };
  const invalid = (field: PlacementField): ParsedPlacement => ({ ok: false, code: "INVALID_FIELD", field });

  const fullName = text(b.name);
  if (!fullName || fullName.length < 2 || fullName.length > 120) return invalid("name");
  const email = text(b.email);
  if (!email || email.length > 160 || !EMAIL.test(email)) return invalid("email");
  const phone = text(b.phone);
  if (phone === undefined || (phone && phone.length > 40)) return invalid("phone");
  if (!isCandidateLocale(b.locale)) return invalid("locale");
  const crmLeadId = text(b.crmLeadId);
  if (crmLeadId === undefined || (crmLeadId && crmLeadId.length > 120)) return invalid("crmLeadId");

  const utm: PublicPlacementRequest["utm"] = {};
  if (b.utm !== undefined && b.utm !== null) {
    if (typeof b.utm !== "object" || Array.isArray(b.utm)) return invalid("utm");
    for (const [rawKey, rawValue] of Object.entries(b.utm as Record<string, unknown>)) {
      const key = rawKey.replace(/^utm_/, "");
      if (!(UTM_TAGS as readonly string[]).includes(key)) continue;
      const value = text(rawValue);
      if (value === undefined || (value && value.length > 200)) return invalid("utm");
      if (value) utm[key as UtmTag] = value;
    }
  }
  return { ok: true, request: { fullName, email, phone, locale: b.locale, crmLeadId, utm } };
}
