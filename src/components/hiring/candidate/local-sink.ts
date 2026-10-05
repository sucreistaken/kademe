"use client";

import type { OpenTake, RecordingSink } from "./recording-sink";

/**
 * The warm-up's take (HIRING-UX 6.4, A4): kept in this tab's memory, played
 * back from a blob URL, never sent anywhere. A 30 second take is small enough
 * to hold; answers never use this.
 */
export function localSink(): RecordingSink & { release(): void } {
  const urls: string[] = [];
  return {
    async open(mime): Promise<OpenTake> {
      const chunks: Blob[] = [];
      return {
        push: (chunk) => void chunks.push(chunk),
        async finish() {
          // Fix round 1 (Minor 8): a new take replaces the one before it; its blob is freed now, not at the end.
          for (const old of urls.splice(0)) URL.revokeObjectURL(old);
          const url = URL.createObjectURL(new Blob(chunks, { type: mime }));
          urls.push(url);
          return { status: "READY", ref: null, localUrl: url };
        },
        abandon: () => {
          chunks.length = 0;
        },
      };
    },
    release: () => {
      for (const url of urls.splice(0)) URL.revokeObjectURL(url);
    },
  };
}
