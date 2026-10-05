/**
 * Every camera or microphone stream a hiring screen opens is registered here,
 * so leaving a screen (or the finish screen) can stop what is still live and
 * truthfully say "Kamera ve mikrofon kapatıldı" (HIRING-UX 6.13). Module
 * state: one tab, one set.
 */
const open = new Set<MediaStream>();

export function trackStream(stream: MediaStream): MediaStream {
  open.add(stream);
  return stream;
}

export function stopAllStreams(): number {
  let stopped = 0;
  for (const stream of open) {
    for (const track of stream.getTracks()) {
      if (track.readyState !== "ended") {
        track.stop();
        stopped += 1;
      }
    }
  }
  open.clear();
  return stopped;
}

/**
 * Asks for a stream and registers it. The permission prompt can outlive the
 * screen that asked (the candidate navigates away while it is open): a stream
 * that arrives when `stillWanted()` is false is stopped at once and never
 * registered, so no camera light stays on behind a page that is gone.
 */
export async function openTracked(request: () => Promise<MediaStream>, stillWanted: () => boolean): Promise<MediaStream | null> {
  const stream = await request();
  if (!stillWanted()) {
    for (const track of stream.getTracks()) track.stop();
    return null;
  }
  return trackStream(stream);
}
