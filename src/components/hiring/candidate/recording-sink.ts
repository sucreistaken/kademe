/** Where a take's bytes go: the server while recording (answers), or this tab's memory (the warm-up). */
export type RecordingResult = { status: "READY" | "INCOMPLETE"; ref: string | null; localUrl?: string };
export type TakeProgress = { ratio: number; stalled: boolean };
export interface OpenTake {
  push(chunk: Blob): void;
  finish(durationMs: number): Promise<RecordingResult>;
  /**
   * The tab is going away: keep what landed (never nothing). `cut`: the
   * recorder had not handed all its data over yet, so the take is INCOMPLETE
   * whatever landed; otherwise it is INCOMPLETE only if something is missing.
   */
  abandon(durationMs: number, cut?: boolean): void;
}
export interface RecordingSink {
  open(mime: string, onProgress?: (p: TakeProgress) => void): Promise<OpenTake>;
}
