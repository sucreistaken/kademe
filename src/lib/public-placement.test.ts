import { describe, expect, it } from "vitest";
import { parsePlacementRequest } from "./public-placement";

/** The body of POST /api/public/placement, checked before any solution sees it (the web check, 2026-11-09). */

describe("parsePlacementRequest", () => {
  const body = (over: Record<string, unknown> = {}) => ({ name: "  Ada   Lovelace ", email: " ada@example.com ", locale: "en", consent: true, ...over });

  it("takes the fields, trims them and keeps only the five UTM tags", () => {
    expect(parsePlacementRequest(body({ phone: " +49 30 1 ", crmLeadId: " L-1 ", utm: { utm_source: "ig", medium: "social", other: "x", campaign: "" } }))).toEqual({
      ok: true,
      request: { fullName: "Ada Lovelace", email: "ada@example.com", phone: "+49 30 1", locale: "en", crmLeadId: "L-1", utm: { source: "ig", medium: "social" } },
    });
    expect(parsePlacementRequest(body())).toEqual({ ok: true, request: { fullName: "Ada Lovelace", email: "ada@example.com", phone: null, locale: "en", crmLeadId: null, utm: {} } });
  });

  it("needs consent to be exactly true", () => {
    for (const consent of [false, "true", 1, null, undefined]) expect(parsePlacementRequest(body({ consent })), String(consent)).toEqual({ ok: false, code: "CONSENT_REQUIRED" });
    const { consent: _drop, ...without } = body();
    void _drop;
    expect(parsePlacementRequest(without)).toEqual({ ok: false, code: "CONSENT_REQUIRED" });
  });

  it("names the field that is wrong", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ name: "A" }, "name"],
      [{ name: "x".repeat(121) }, "name"],
      [{ name: 7 }, "name"],
      [{ email: "not-an-email" }, "email"],
      [{ email: `${"a".repeat(150)}@example.com` }, "email"],
      [{ phone: 12345 }, "phone"],
      [{ phone: "1".repeat(41) }, "phone"],
      [{ locale: "fr" }, "locale"],
      [{ locale: undefined }, "locale"],
      [{ crmLeadId: 42 }, "crmLeadId"],
      [{ utm: "source=ig" }, "utm"],
      [{ utm: { source: 3 } }, "utm"],
    ];
    for (const [over, field] of cases) expect(parsePlacementRequest(body(over)), JSON.stringify(over)).toEqual({ ok: false, code: "INVALID_FIELD", field });
  });

  it("accepts every student language", () => {
    for (const locale of ["tr", "en", "de", "es", "ar"]) expect(parsePlacementRequest(body({ locale })).ok, locale).toBe(true);
  });

  it("refuses a body that is not an object", () => {
    for (const b of [null, "x", 3, [], undefined]) expect(parsePlacementRequest(b)).toEqual({ ok: false, code: "INVALID_BODY" });
  });
});

