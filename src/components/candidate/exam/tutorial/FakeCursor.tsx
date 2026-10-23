"use client";

/**
 * The tutorial's pointer: an arrow that glides to the middle of the next
 * target in 300-600 ms (longer trips take longer), a ring where it presses,
 * and the dragged letter riding under it. It jumps without gliding under
 * prefers-reduced-motion and when the player seeks. Positions are stage
 * pixels, measured from the stage's top left corner (pointer coordinates,
 * not a layout side, so they stay physical in an Arabic page).
 */

export const glideMs = (distance: number) => Math.round(Math.min(600, Math.max(300, 300 + distance * 0.5)));

export function FakeCursor({
  x,
  y,
  glide,
  pressKey,
  carry,
}: {
  x: number;
  y: number;
  /** Milliseconds to glide to (x, y); 0 jumps. */
  glide: number;
  /** Changes on every press, so the ring plays again; null shows none. */
  pressKey: number | null;
  /** The dragged chip's text while a drag is under way. */
  carry: string | null;
}) {
  return (
    <div
      aria-hidden
      data-tutorial-cursor
      className="pointer-events-none absolute z-50"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px)`,
        transition: glide > 0 ? `transform ${glide}ms cubic-bezier(0.33, 0, 0.2, 1)` : "none",
      }}
    >
      {pressKey !== null ? (
        <span
          key={pressKey}
          className="absolute size-11 rounded-full border-[3px] border-brand bg-brand/15 motion-safe:animate-[tutorial-press_550ms_ease-out_forwards] motion-reduce:opacity-0"
          style={{ left: -22, top: -22 }}
        />
      ) : null}
      {carry !== null ? (
        <span
          className="absolute flex h-9 items-center rounded-[8px] border border-accent bg-surface px-3 text-[14px] font-semibold text-ink shadow-lg"
          style={{ left: 10, top: 18 }}
        >
          {carry}
        </span>
      ) : null}
      <svg width="26" height="30" viewBox="0 0 26 30" className="relative drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]" style={{ left: -3, top: -2 }}>
        <path d="M3 2 L3 25 L9.2 19.4 L13.4 28.2 L17.6 26.3 L13.5 17.6 L21.8 17.2 Z" fill="#1D2127" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
