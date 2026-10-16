"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type ChipDrag<K> = { key: K; x: number; y: number; over: string | null };

/**
 * Pointer drag for the answer chips (C-test parts, matching letters). Pointer
 * events rather than HTML5 drag and drop: they also work with touch, trackpads
 * and pen, and a press without movement stays a click.
 *
 * The move and release are heard on the window, not only on the pressed chip:
 * a proctor warning makes the page inert mid-drag, and then the chip never gets
 * its pointerup. Any release, a move with no button held, Escape, leaving the
 * window or the chips turning disabled ends the drag, so the chip never hangs
 * in the air.
 */
export function useChipDrag<K>({
  dropAt,
  onDrop,
  disabled,
}: {
  dropAt: (x: number, y: number) => string | null;
  onDrop: (key: K, target: string) => void;
  disabled: boolean;
}) {
  const [drag, setDrag] = useState<ChipDrag<K> | null>(null);
  const swallowClick = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  // The latest callbacks, so a drag started before a re-render drops with current answers.
  const latest = useRef({ dropAt, onDrop });
  useEffect(() => {
    latest.current = { dropAt, onDrop };
  });

  const end = useCallback(() => {
    stop.current?.();
    stop.current = null;
    setDrag(null);
  }, []);

  useEffect(() => {
    if (!disabled) return;
    stop.current?.();
    stop.current = null;
    queueMicrotask(() => setDrag(null));
  }, [disabled]);
  useEffect(
    () => () => {
      stop.current?.();
      stop.current = null;
    },
    [],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, key: K) => {
    if (disabled || e.button !== 0) return;
    end();
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer that is already gone: the window listeners still end the drag.
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      // Released somewhere we did not hear about.
      if (ev.buttons === 0) return end();
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
      moved = true;
      setDrag({ key, x: ev.clientX, y: ev.clientY, over: latest.current.dropAt(ev.clientX, ev.clientY) });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      end();
      if (!moved) return;
      // Only the click that belongs to this release is swallowed.
      swallowClick.current = true;
      window.setTimeout(() => (swallowClick.current = false), 0);
      const target = latest.current.dropAt(ev.clientX, ev.clientY);
      if (target) latest.current.onDrop(key, target);
    };
    const cancel = (ev: Event) => {
      if (ev instanceof PointerEvent && ev.pointerId !== e.pointerId) return;
      end();
    };
    const escape = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") end();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", escape);
    stop.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", escape);
    };
  };

  /** True when this click ends a drag and must not also place the chip. */
  const isDragClick = () => {
    if (!swallowClick.current) return false;
    swallowClick.current = false;
    return true;
  };

  return { drag: disabled ? null : drag, onPointerDown, isDragClick };
}
