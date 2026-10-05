/**
 * K4: the think and answer clocks are a ring. It shortens one step per second
 * (whole seconds, like the digits in its middle), never slides, never turns
 * red; the stroke sits inside the box.
 */
const STROKE = 6;

export function ringGeometry(input: { remainingMs: number; totalMs: number; size: 96 | 128 }) {
  const radius = input.size / 2 - STROKE;
  const circumference = 2 * Math.PI * radius;
  const seconds = Math.max(0, Math.ceil(input.remainingMs / 1000));
  const ratio = input.totalMs > 0 ? Math.min(1, (seconds * 1000) / input.totalMs) : 0;
  return { radius, circumference, offset: circumference * (1 - ratio), ratio, seconds };
}

/** 3.8: in the last ten seconds only the caption changes ("Son saniyeler"). */
export const lastSeconds = (ms: number) => ms > 0 && ms <= 10_000;

/**
 * HIRING-UX 8.7: the ring's time is spoken at milestones only (each whole
 * minute left, then 30 and 10 seconds), never every second and never at the
 * start, which the screen's own announcement already covers. Whole seconds,
 * like the digits.
 */
export function ringMilestone(input: { remainingMs: number; totalMs: number }): boolean {
  const seconds = Math.max(0, Math.ceil(input.remainingMs / 1000));
  const total = Math.max(0, Math.ceil(input.totalMs / 1000));
  if (seconds <= 0 || seconds >= total) return false;
  return seconds % 60 === 0 || seconds === 30 || seconds === 10;
}
