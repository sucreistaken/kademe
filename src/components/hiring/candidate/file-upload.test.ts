import { describe, expect, it, vi } from "vitest";
import type { UploaderStatus } from "@/lib/client/recorder";
import { serverMessage } from "./server-message";
import { cutUploadKey, markCutUpload, sendFile, SLICE_BYTES, takeCutUpload, type FileProgress, type FileUploadDeps, type FileUploaderLike } from "./file-upload";

const refusal = (code: string, status: number) => Object.assign(new Error(code), { code, status });
const instant = () => Promise.resolve();

function fakeUploader(over: { pendingBytes?: number; interrupted?: boolean } = {}) {
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

  it("remembers a cut upload in the tab once, for the screen after a reload", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const key = cutUploadKey("tok", 2, "run-1", "act-1");
    expect(key).not.toBe(cutUploadKey("tok", 2, "run-2", "act-1"));
    markCutUpload(storage, key, "Plan Taslağı.pdf");
    expect(takeCutUpload(storage, key)).toBe("Plan Taslağı.pdf");
    expect(takeCutUpload(storage, key)).toBeNull();
    expect(takeCutUpload(null, key)).toBeNull();
  });
});
