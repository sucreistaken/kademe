/** Where a take's bytes go: the server while recording (answers), or this tab's memory (the warm-up). */
export type RecordingResult = { status: "READY" | "INCOMPLETE"; ref: string | null; localUrl?: string };
export type TakeProgress = { ratio: number; stalled: boolean };
export interface OpenTake {
  push(chunk: Blob): void;
  finish(durationMs: number): Promise<RecordingResult>;
  /** The tab is going away mid-take: keep what landed (an INCOMPLETE answer, never nothing). */
  abandon(durationMs: number): void;
}
export interface RecordingSink {
  open(mime: string, onProgress?: (p: TakeProgress) => void): Promise<OpenTake>;
}
