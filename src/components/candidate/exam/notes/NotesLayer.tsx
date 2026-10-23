"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";
import { addMark, eraseMarksAt, eraseStrokesAt, makeStroke, type MarkColor, type Point, type Stroke } from "@/components/candidate/exam/notes/notes-model";
import { isControlTarget, offsetAtPoint, offsetOfPoint, rangeOfOffsets, textNodesOf } from "@/components/candidate/exam/notes/dom-text";
import { removeLayer, setLayerRanges, type HighlightName } from "@/components/candidate/exam/notes/highlight-registry";
import type { NotesController } from "@/components/candidate/exam/notes/use-notes";

const PEN_COLOR = "#26418f";
const PEN_WIDTH = 2;
const MIN_STEP = 1.5;

const nameOf = (kind: "highlight" | "underline", color: MarkColor): HighlightName =>
  kind === "underline" ? "kademe-underline" : (`kademe-mark-${color === "ink" ? "yellow" : color}` as HighlightName);

function drawStroke(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  if (points.length === 1) ctx.lineTo(points[0][0] + 0.1, points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}

/**
 * Wraps the text the student may annotate. Highlight and underline turn a text
 * selection into a mark (and clear the selection at once, so the proctoring
 * drag guard never sees it); the pen draws on a canvas that covers only this
 * container and takes pointer events only while the pen or eraser is on.
 */
export function NotesLayer({
  controller,
  pen = false,
  marks = true,
  className,
  children,
}: {
  controller: NotesController;
  pen?: boolean;
  /** False for the scratch pad: pen and eraser only, no text marks (and no need for the Highlight API). */
  marks?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { supported, data, setData, tool, color } = controller;
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef<Point[] | null>(null);
  const erasing = useRef(false);
  const strokesRef = useRef<readonly Stroke[]>(data.strokes);
  const active = marks ? supported === true : supported !== null;

  // Paint the marks with the CSS Custom Highlight API.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active || !marks) return;
    let frame = 0;
    const paint = () => {
      const nodes = textNodesOf(root);
      const ranges = new Map<HighlightName, Range[]>();
      for (const m of data.marks) {
        const r = rangeOfOffsets(nodes, m.start, m.end);
        if (!r) continue;
        const name = nameOf(m.kind, m.color);
        ranges.set(name, [...(ranges.get(name) ?? []), r]);
      }
      setLayerRanges(id, ranges);
    };
    paint();
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
      removeLayer(id);
    };
  }, [data.marks, active, marks, id]);

  // Highlight and underline: a selection made inside the container becomes a mark.
  useEffect(() => {
    if (!active || !marks || (tool !== "highlight" && tool !== "underline")) return;
    const onUp = () => {
      const root = rootRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
      const start = offsetOfPoint(root, range.startContainer, range.startOffset);
      const end = offsetOfPoint(root, range.endContainer, range.endOffset);
      sel.removeAllRanges();
      if (start === null || end === null || end <= start) return;
      const kind = tool;
      setData((prev) => ({ ...prev, marks: addMark(prev.marks, { start, end, kind, color: kind === "underline" ? "ink" : color }) }));
    };
    document.addEventListener("pointerup", onUp);
    return () => document.removeEventListener("pointerup", onUp);
  }, [active, marks, tool, color, setData]);

  // Canvas: size to the container, keep it crisp, redraw.
  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = PEN_COLOR;
    ctx.lineWidth = PEN_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokesRef.current) drawStroke(ctx, s.points);
  };
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || !active || !pen) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(root.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(root.clientHeight * dpr));
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    return () => ro.disconnect();
  }, [active, pen]);
  useEffect(() => {
    strokesRef.current = data.strokes;
    redraw();
  }, [data.strokes]);

  const local = (e: React.PointerEvent): Point => {
    const r = rootRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const eraseAt = (e: React.PointerEvent) => {
    const root = rootRef.current;
    if (!root) return;
    const [x, y] = local(e);
    const canvas = canvasRef.current;
    const previous = canvas?.style.pointerEvents ?? "";
    if (canvas) canvas.style.pointerEvents = "none";
    const offset = offsetAtPoint(root, e.clientX, e.clientY);
    if (canvas) canvas.style.pointerEvents = previous;
    setData((prev) => {
      const marks = offset === null ? prev.marks : eraseMarksAt(prev.marks, offset);
      const strokes = eraseStrokesAt(prev.strokes, x, y);
      return marks.length === prev.marks.length && strokes.length === prev.strokes.length ? prev : { marks, strokes };
    });
  };

  const onRootDown = (e: React.PointerEvent) => {
    if (!active || tool !== "eraser" || e.button !== 0) return;
    // Answer buttons, inputs, chips and labels keep working: no capture, no erase.
    if (isControlTarget(e.target)) return;
    erasing.current = true;
    rootRef.current?.setPointerCapture(e.pointerId);
    eraseAt(e);
  };
  const onRootMove = (e: React.PointerEvent) => {
    if (!erasing.current) return;
    // A lost pointerup must not leave the eraser stuck on.
    if ((e.buttons & 1) === 0) {
      erasing.current = false;
      return;
    }
    eraseAt(e);
  };
  const onRootUp = (e: React.PointerEvent) => {
    if (!erasing.current) return;
    erasing.current = false;
    try {
      rootRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* capture already gone */
    }
  };

  const onPenDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool !== "pen" || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = [local(e)];
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) drawStroke(ctx, live.current);
  };
  const onPenMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pts = live.current;
    if (!pts) return;
    if ((e.buttons & 1) === 0) {
      onPenUp(e);
      return;
    }
    const ctx = e.currentTarget.getContext("2d");
    for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) {
      const r = rootRef.current!.getBoundingClientRect();
      const p: Point = [ev.clientX - r.left, ev.clientY - r.top];
      const last = pts[pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_STEP) continue;
      pts.push(p);
      if (ctx) drawStroke(ctx, [last, p]);
    }
  };
  const onPenUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pts = live.current;
    live.current = null;
    if (!pts) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* capture already gone */
    }
    const stroke = makeStroke(pts);
    setData((prev) => ({ ...prev, strokes: [...prev.strokes, stroke] }));
  };

  const penOn = active && pen && (tool === "pen" || tool === "eraser");
  return (
    <div
      ref={rootRef}
      data-notes-text=""
      className={cn("relative", tool === "eraser" && "select-none", className)}
      onPointerDown={onRootDown}
      onPointerMove={onRootMove}
      onPointerUp={onRootUp}
      onPointerCancel={onRootUp}
      onLostPointerCapture={onRootUp}
    >
      {children}
      {active && pen ? (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={cn("absolute inset-0 size-full select-none", tool === "pen" ? "cursor-crosshair" : "cursor-cell")}
          style={{ pointerEvents: penOn ? "auto" : "none", touchAction: tool === "pen" ? "none" : "auto" }}
          onPointerDown={onPenDown}
          onPointerMove={onPenMove}
          onPointerUp={onPenUp}
          onPointerCancel={onPenUp}
          onLostPointerCapture={onPenUp}
        />
      ) : null}
    </div>
  );
}
