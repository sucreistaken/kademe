import { afterEach, describe, expect, it, vi } from "vitest";
import { ChunkedUploader, PATIENT_RETRY, type UploaderStatus } from "@/lib/client/recorder";
import { serverMessage } from "./server-message";
import {
  clearCutUpload,
  cutUploadKey,
  fileFailure,
  markCutUpload,
  readCutUpload,
  sendFile,
  SLICE_BYTES,
  type FileProgress,
  type FileUploadDeps,
  type FileUploaderLike,
} from "./file-upload";

const refusal = (code: string, status: number) => Object.assign(new Error(code), { code, status });
const instant = () => Promise.resolve();

function fakeUploader(over: { pendingBytes?: number; interrupted?: boolean } = {}): FileUploaderLike & {
  interrupted: boolean;
  push: ReturnType<typeof vi.fn<(chunk: Blob) => void>>;
  finish: ReturnType<typeof vi.fn<FileUploaderLike["finish"]>>;
} {
  const uploader = {
    uploadRef: "file-1",
    interrupted: false,
    pendingBytes: 0,
    push: vi.fn<(chunk: Blob) => void>(),
    finish: vi.fn<FileUploaderLike["finish"]>(async () => ({ status: "READY", bytes: 10 })),
    ...over,
  };
  return uploader;
}

function deps(uploader: FileUploaderLike) {
  let onStatus: ((s: UploaderStatus) => void) | null = null;
  let onHide: (() => void) | null = null;
  const unwatch = vi.fn();
  const d = {
    open: vi.fn<FileUploadDeps["open"]>(async (report) => {
      onStatus = report;
      return uploader;
    }),
    beacon: vi.fn<FileUploadDeps["beacon"]>(),
    complete: vi.fn<FileUploadDeps["complete"]>(async () => undefined),
    watchPageHide: vi.fn<NonNullable<FileUploadDeps["watchPageHide"]>>((hide) => {
      onHide = hide;
      return unwatch;
    }),
    onCut: vi.fn(),
    wait: vi.fn(instant),
  };
  return { d, unwatch, status: (s: UploaderStatus) => onStatus?.(s), hide: () => onHide?.() };
}

const fileOf = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: "application/pdf" });

describe("sendFile: a file answer's upload (HIRING-UX 6.9, ruling 3)", () => {
  it("sends the file in order, slice by slice, and finishes READY", async () => {
    const uploader = fakeUploader();
    const { d } = deps(uploader);
    const outcome = await sendFile(fileOf(SLICE_BYTES * 2 + 5), d, () => undefined);
    expect(outcome).toEqual({ ok: true });
    expect(uploader.push.mock.calls.map(([chunk]) => chunk.size)).toEqual([SLICE_BYTES, SLICE_BYTES, 5]);
    expect(uploader.finish).toHaveBeenCalledTimes(1);
  });

  it("reports the share uploaded and a stall", async () => {
    const uploader = fakeUploader();
    const seen: FileProgress[] = [];
    let release: () => void = () => undefined;
    uploader.finish.mockImplementation(() => new Promise((resolve) => (release = () => resolve({ status: "READY", bytes: 400 }))));
    const { d, status } = deps(uploader);
    const done = sendFile(fileOf(400), d, (p) => seen.push(p));
    await vi.waitFor(() => expect(uploader.finish).toHaveBeenCalled());
    status({ uploadedBytes: 100, queuedBytes: 300, stalled: false });
    status({ uploadedBytes: 100, queuedBytes: 300, stalled: true });
    status({ uploadedBytes: 400, queuedBytes: 0, stalled: false });
    release();
    await done;
    expect(seen).toEqual([
      { percent: 25, stalled: false },
      { percent: 25, stalled: true },
      { percent: 100, stalled: false },
    ]);
  });

  it("opens again when the connection drops on the way, and gives a refusal straight back", async () => {
    const uploader = fakeUploader();
    const dropped = deps(uploader);
    dropped.d.open.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockRejectedValueOnce(refusal("UNAVAILABLE", 503));
    await expect(sendFile(fileOf(10), dropped.d, () => undefined)).resolves.toEqual({ ok: true });
    expect(dropped.d.open).toHaveBeenCalledTimes(3);

    const refused = deps(fakeUploader());
    refused.d.open.mockRejectedValue(refusal("FILE_TYPE_REJECTED", 400));
    const outcome = await sendFile(fileOf(10), refused.d, () => undefined);
    expect(outcome).toMatchObject({ ok: false, error: { code: "FILE_TYPE_REJECTED" } });
    expect(refused.d.open).toHaveBeenCalledTimes(1);
  });

  it("stops opening again after a few tries, and says the upload did not happen", async () => {
    const { d } = deps(fakeUploader());
    d.open.mockRejectedValue(new TypeError("Failed to fetch"));
    const outcome = await sendFile(fileOf(10), d, () => undefined);
    expect(outcome.ok).toBe(false);
    expect(d.open.mock.calls.length).toBeGreaterThan(1);
    expect(d.open.mock.calls.length).toBeLessThan(10);
  });

  it("tries the completion again when the connection drops (never a lost file)", async () => {
    const uploader = fakeUploader();
    uploader.finish.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockRejectedValueOnce(refusal("UNAVAILABLE", 503));
    const { d } = deps(uploader);
    await expect(sendFile(fileOf(10), d, () => undefined)).resolves.toEqual({ ok: true });
    expect(uploader.finish).toHaveBeenCalledTimes(3);
  });

  it("never claims a file that did not arrive whole: INCOMPLETE and NO_PARTS are not uploaded", async () => {
    const cut = fakeUploader();
    cut.finish.mockResolvedValue({ status: "INCOMPLETE", bytes: 4 });
    const partial = await sendFile(fileOf(10), deps(cut).d, () => undefined);
    expect(partial.ok).toBe(false);
    // The screen says its own words for it, never the error's (no raw text, ruling 3).
    expect(serverMessage(partial.ok ? null : partial.error)).toBeNull();

    const none = fakeUploader();
    none.finish.mockRejectedValue(refusal("NO_PARTS", 409));
    const outcome = await sendFile(fileOf(10), deps(none).d, () => undefined);
    expect(outcome).toMatchObject({ ok: false, error: { code: "NO_PARTS" } });
    expect(none.finish).toHaveBeenCalledTimes(1);
  });

  it("on page hide with parts still waiting, completes it incomplete by beacon and remembers the cut", async () => {
    const uploader = fakeUploader({ pendingBytes: 10 });
    uploader.finish.mockImplementation(() => new Promise(() => undefined));
    const { d, hide } = deps(uploader);
    void sendFile(fileOf(10), d, () => undefined);
    await vi.waitFor(() => expect(uploader.finish).toHaveBeenCalled());
    hide();
    hide();
    expect(d.beacon).toHaveBeenCalledTimes(1);
    expect(d.beacon).toHaveBeenCalledWith({ uploadRef: "file-1", durationMs: 0, incomplete: true });
    expect(d.onCut).toHaveBeenCalledTimes(1);
  });

  it("on page hide after every part landed, completes it whole by beacon", async () => {
    const uploader = fakeUploader({ pendingBytes: 0 });
    uploader.finish.mockImplementation(() => new Promise(() => undefined));
    const { d, hide } = deps(uploader);
    void sendFile(fileOf(10), d, () => undefined);
    await vi.waitFor(() => expect(uploader.finish).toHaveBeenCalled());
    hide();
    expect(d.beacon).toHaveBeenCalledWith({ uploadRef: "file-1", durationMs: 0, incomplete: false });
    expect(d.onCut).not.toHaveBeenCalled();
  });

  it("stops listening for page hide once settled, so a finished file is never completed again", async () => {
    const { d, unwatch, hide } = deps(fakeUploader());
    await sendFile(fileOf(10), d, () => undefined);
    expect(unwatch).toHaveBeenCalled();
    hide();
    expect(d.beacon).not.toHaveBeenCalled();
  });

  it("remembers a cut upload in the tab: reading has no side effect, the next success clears it (fix round 1, M4)", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const key = cutUploadKey("tok", 2, "run-1", "act-1");
    expect(key).not.toBe(cutUploadKey("tok", 2, "run-2", "act-1"));
    markCutUpload(storage, key, "Plan Taslağı.pdf");
    expect(readCutUpload(storage, key)).toBe("Plan Taslağı.pdf");
    expect(readCutUpload(storage, key)).toBe("Plan Taslağı.pdf");
    clearCutUpload(storage, key);
    expect(readCutUpload(storage, key)).toBeNull();
    expect(readCutUpload(null, key)).toBeNull();
  });

  it("uses 2 MiB slices (fix round 1, I1)", () => {
    expect(SLICE_BYTES).toBe(2 * 1024 * 1024);
  });

  it("settles at once when a part is given up: completes it INCOMPLETE and says so (fix round 1, I1)", async () => {
    const uploader = fakeUploader();
    // The queue still holds later parts, each with its own long retry cycle: finish would wait for all of them.
    uploader.finish.mockImplementation(() => new Promise(() => undefined));
    const { d, status } = deps(uploader);
    const done = sendFile(fileOf(10), d, () => undefined);
    await vi.waitFor(() => expect(uploader.finish).toHaveBeenCalled());
    uploader.interrupted = true;
    status({ uploadedBytes: 0, queuedBytes: 10, stalled: true });
    await expect(done).resolves.toMatchObject({ ok: false });
    expect(d.complete).toHaveBeenCalledWith({ uploadRef: "file-1", durationMs: 0, incomplete: true });
  });

  it("reports no progress once settled: the given-up uploader's later tries never bring the bar back (fix round 1)", async () => {
    const uploader = fakeUploader();
    uploader.finish.mockImplementation(() => new Promise(() => undefined));
    const { d, status } = deps(uploader);
    const seen: FileProgress[] = [];
    const done = sendFile(fileOf(10), d, (p) => seen.push(p));
    await vi.waitFor(() => expect(uploader.finish).toHaveBeenCalled());
    uploader.interrupted = true;
    status({ uploadedBytes: 0, queuedBytes: 10, stalled: true });
    await done;
    const before = seen.length;
    status({ uploadedBytes: 0, queuedBytes: 10, stalled: true });
    expect(seen.length).toBe(before);
  });

  it("still says the file did not upload when that completion cannot be sent", async () => {
    const uploader = fakeUploader();
    uploader.finish.mockImplementation(() => new Promise(() => undefined));
    const { d, status } = deps(uploader);
    d.complete.mockRejectedValue(new TypeError("Failed to fetch"));
    const done = sendFile(fileOf(10), d, () => undefined);
    await vi.waitFor(() => expect(uploader.finish).toHaveBeenCalled());
    uploader.interrupted = true;
    status({ uploadedBytes: 0, queuedBytes: 10, stalled: true });
    await expect(done).resolves.toMatchObject({ ok: false });
    expect(serverMessage((await done).ok ? null : ((await done) as { error: unknown }).error)).toBeNull();
  });
});

describe("sendFile with the real uploader: an outage longer than the retry window (fix round 1, I1)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fails within one part's retry cycle, and the later parts are refused at once instead of tried for minutes", async () => {
    vi.useFakeTimers();
    let closed = false;
    const putsByPart = new Map<string, number>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const u = new URL(url, "http://localhost");
        if (u.pathname.endsWith("/media/part")) {
          const part = u.searchParams.get("part") ?? "";
          putsByPart.set(part, (putsByPart.get(part) ?? 0) + 1);
          if (closed) return new Response(JSON.stringify({ error: "UPLOAD_CLOSED", message: "x" }), { status: 400 });
          // The part requests find no way through (the completion does).
          throw new TypeError("Failed to fetch");
        }
        if (u.pathname.endsWith("/media/complete")) {
          closed = true;
          const body = JSON.parse(String(init?.body)) as { incomplete: boolean };
          return new Response(JSON.stringify({ status: body.incomplete ? "INCOMPLETE" : "READY", bytes: 0, durationMs: null }), { status: 200 });
        }
        throw new Error(`unexpected ${url}`);
      }),
    );
    const init = { uploadRef: "file-1", mime: "application/pdf", minPartBytes: 0, proxy: true, partTargets: [1, 2, 3, 4].map((n) => ({ partNumber: n, url: "", proxy: true })) };
    const d: FileUploadDeps = {
      open: async (onStatus) => new ChunkedUploader("tok", init, onStatus, PATIENT_RETRY),
      beacon: () => undefined,
      complete: async (body) => {
        const res = await fetch("/api/c/tok/media/complete", { method: "POST", body: JSON.stringify(body) });
        return res.json();
      },
    };
    let settled: { ok: boolean } | null = null;
    void sendFile(fileOf(SLICE_BYTES * 4), d, () => undefined).then((o) => (settled = o));
    // One part's patient cycle is about 105 s (1, 2, 4, then every 8 s, 16 tries); four of them would be 7 minutes.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(settled).toEqual(expect.objectContaining({ ok: false }));
    await vi.advanceTimersByTimeAsync(20_000);
    // The upload is closed: the next try of part 2 is refused and the rest are refused once each.
    expect(putsByPart.get("2") ?? 0).toBeLessThanOrEqual(5);
    for (const part of ["3", "4"]) expect(putsByPart.get(part) ?? 0).toBeLessThanOrEqual(1);
  });
});

describe("sendFile with the real uploader on object storage (5 MiB part floor)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends parts at or above the floor, only the last one smaller", async () => {
    const sizes: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("https://bucket")) {
          sizes.push((init?.body as Blob).size);
          return new Response("", { status: 200, headers: { etag: `"e${sizes.length}"` } });
        }
        if (url.includes("/media/part-done")) return new Response("{}", { status: 200 });
        if (url.includes("/media/complete")) return new Response(JSON.stringify({ status: "READY", bytes: 0, durationMs: null }), { status: 200 });
        throw new Error(`unexpected ${url}`);
      }),
    );
    const init = { uploadRef: "file-1", mime: "application/pdf", minPartBytes: 5 * 1024 * 1024, proxy: false, partTargets: [1, 2, 3].map((n) => ({ partNumber: n, url: `https://bucket/p${n}`, proxy: false })) };
    const d: FileUploadDeps = { open: async (onStatus) => new ChunkedUploader("tok", init, onStatus, PATIENT_RETRY), beacon: () => undefined, complete: async () => undefined };
    await expect(sendFile(fileOf(13 * 1024 * 1024), d, () => undefined)).resolves.toEqual({ ok: true });
    expect(sizes).toEqual([6 * 1024 * 1024, 6 * 1024 * 1024, 1024 * 1024]);
  });
});

describe("fileFailure: what a file question says when an upload ends without the file (fix round 1, I2)", () => {
  it("names the file's own problems in the question's words, without a retry", () => {
    expect(fileFailure(refusal("FILE_TOO_LARGE", 400), true)).toEqual({ key: "tooBig", retry: false });
    expect(fileFailure(refusal("FILE_TYPE_REJECTED", 400), true)).toEqual({ key: "wrongType", retry: false });
    expect(fileFailure(refusal("NOT_A_FILE", 400), true)).toEqual({ key: "wrongType", retry: false });
    expect(fileFailure(refusal("FILE_EMPTY", 400), true)).toEqual({ key: "empty", retry: false });
  });

  it("says the file did not upload, with a retry, for the core upload routes' refusals (never recording words)", () => {
    for (const code of ["NO_PARTS", "UPLOAD_CLOSED", "UPLOAD_NOT_FOUND", "RATE_LIMITED"]) {
      expect(fileFailure(Object.assign(new Error("Hiç kayıt parçası ulaşmadı."), { code, status: 409 }), true)).toEqual({ key: "failed", retry: true });
    }
  });

  it("says the file did not upload, with a retry, for a dropped connection or a cut file", () => {
    expect(fileFailure(new TypeError("Failed to fetch"), true)).toEqual({ key: "failed", retry: true });
    expect(fileFailure(Object.assign(new Error("incomplete"), { completion: "INCOMPLETE" }), true)).toEqual({ key: "failed", retry: true });
  });

  it("passes another refusal on in the server's own words (the candidate's language)", () => {
    expect(fileFailure(Object.assign(new Error("Bu aşama kapandı."), { code: "SOMETHING_ELSE", status: 409 }), true)).toEqual({ server: "Bu aşama kapandı.", retry: false });
    expect(fileFailure(Object.assign(new Error("Sunucu meşgul."), { code: "UNAVAILABLE", status: 503 }), true)).toEqual({ server: "Sunucu meşgul.", retry: true });
  });

  it("without a type list a type refusal is said in the server's words", () => {
    expect(fileFailure(Object.assign(new Error("Bu dosya türü kabul edilmiyor."), { code: "FILE_TYPE_REJECTED", status: 400 }), false)).toEqual({ server: "Bu dosya türü kabul edilmiyor.", retry: false });
  });
});
