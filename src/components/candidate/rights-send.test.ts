import { describe, expect, it } from "vitest";
import { sendRightsRequest } from "./rights-send";

const refusal = (code: string, status: number, message: string) => Object.assign(new Error(message), { code, status });

describe("sendRightsRequest", () => {
  it("is sent only when the server took the request", async () => {
    expect(await sendRightsRequest(async () => ({ received: true }))).toEqual({ status: "sent" });
  });

  it("fails without a reason on a dropped connection (the raw browser text is never shown)", async () => {
    expect(
      await sendRightsRequest(async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).toEqual({ status: "failed", reason: null });
  });

  it("fails with the server's own words for a refusal", async () => {
    expect(
      await sendRightsRequest(async () => {
        throw refusal("MESSAGE_TOO_LONG", 400, "Mesaj en fazla 2000 karakter olabilir.");
      }),
    ).toEqual({ status: "failed", reason: "Mesaj en fazla 2000 karakter olabilir." });
  });

  it("does not trust an error the client made up (no code from the server)", async () => {
    expect(
      await sendRightsRequest(async () => {
        throw refusal("UNKNOWN", 502, "Bir sorun oldu.");
      }),
    ).toEqual({ status: "failed", reason: null });
  });
});
