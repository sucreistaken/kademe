import { describe, expect, it, vi } from "vitest";

// The module opens a database client at import time for the row helpers; the
// mime rules under test never touch it.
vi.mock("@/db", () => ({ db: {} }));

import {
  normaliseFileMime,
  normaliseMime,
  OPAQUE_MIME,
  resolveOwnedMedia,
} from "./candidate-media";

describe("recording mime", () => {
  it("keeps a supported container and its codec parameters", () => {
    expect(normaliseMime("video/webm;codecs=vp9", "video/webm")).toBe(
      "video/webm;codecs=vp9",
    );
  });

  it("falls back for anything that is not a recording", () => {
    expect(normaliseMime("application/pdf", "video/webm")).toBe("video/webm");
    expect(normaliseMime(undefined, "audio/webm")).toBe("audio/webm");
  });
});

describe("file upload mime", () => {
  it("keeps a document's own type, so a PDF is stored as a PDF", () => {
    expect(normaliseFileMime("application/pdf", undefined)).toBe("application/pdf");
    expect(normaliseFileMime("application/pdf", [])).toBe("application/pdf");
  });

  it("never turns a file into a recording", () => {
    // The old path produced video/webm here and queued the file for transcription.
    const mime = normaliseFileMime("application/pdf", undefined);
    expect(mime?.startsWith("video/")).toBe(false);
    expect(mime?.startsWith("audio/")).toBe(false);
  });

  it("stores an unknown type opaque when the manager set no list", () => {
    expect(normaliseFileMime("application/x-sketch", undefined)).toBe(OPAQUE_MIME);
    expect(normaliseFileMime("", undefined)).toBe(OPAQUE_MIME);
    expect(normaliseFileMime(undefined, undefined)).toBe(OPAQUE_MIME);
  });

  it("enforces the manager's list when there is one", () => {
    const accepted = ["application/pdf", "image/png"];
    expect(normaliseFileMime("image/png", accepted)).toBe("image/png");
    expect(normaliseFileMime("image/jpeg", accepted)).toBeNull();
    expect(normaliseFileMime("video/webm", accepted)).toBeNull();
  });

  it("compares case and parameter insensitively", () => {
    expect(normaliseFileMime("Application/PDF; charset=binary", ["application/pdf"])).toBe(
      "application/pdf",
    );
  });
});

describe("resolveOwnedMedia", () => {
  const ctx = { assessment: { id: "a", orgId: "o", solution: "HIRING" } } as never;

  it("answers null for a reference that is not a uuid, before any query (a 36-character string is not enough)", async () => {
    // The mocked db has no select: a query here would throw, as Postgres throws 22P02 on `uuid = 'zzz...'`.
    for (const ref of ["z".repeat(36), "11111111-1111-4111-8111-11111111111g", "11111111_1111_4111_8111_111111111111", " ".repeat(36), null, 7]) {
      expect(await resolveOwnedMedia(ctx, ref)).toBeNull();
    }
  });
});
