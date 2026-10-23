"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { capNotes, emptyNotes, isEmptyNotes, type MarkColor, type NotesData } from "@/components/candidate/exam/notes/notes-model";
import { browserNotesStorage, loadNotes, notesKey, saveNotes } from "@/components/candidate/exam/notes/notes-store";

export type NotesTool = "none" | "highlight" | "underline" | "pen" | "eraser";
export type HighlightColor = Exclude<MarkColor, "ink">;

export const UNDO_MS = 8000;

export type NotesController = {
  /** Null until mounted; false when the browser has no CSS Custom Highlight API (the toolbar stays hidden). */
  supported: boolean | null;
  data: NotesData;
  setData: (next: NotesData | ((prev: NotesData) => NotesData)) => void;
  tool: NotesTool;
  setTool: (t: NotesTool) => void;
  color: HighlightColor;
  setColor: (c: HighlightColor) => void;
  canUndo: boolean;
  clear: () => void;
  undo: () => void;
};

export const hasCustomHighlights = (): boolean =>
  typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";

/**
 * The notes of one passage: marks and strokes held in React state, mirrored to
 * sessionStorage under a key made from the invitation, section and text. They
 * are never sent anywhere.
 */
export function useNotes(token: string, sectionPosition: number, title: string, text: string): NotesController {
  const key = notesKey(token, sectionPosition, title, text);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [data, setDataState] = useState<NotesData>(emptyNotes);
  const [tool, setTool] = useState<NotesTool>("none");
  const [color, setColor] = useState<HighlightColor>("yellow");
  const [undoData, setUndoData] = useState<NotesData | null>(null);
  const keyRef = useRef(key);
  const dataRef = useRef(data);
  const undoTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    keyRef.current = key;
    const loaded = loadNotes(browserNotesStorage(), key);
    dataRef.current = loaded;
    // Storage and the Highlight API exist only in the browser, so they are read after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setDataState(loaded);
    setUndoData(null);
    setSupported(hasCustomHighlights());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [key]);
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const setData = useCallback((next: NotesData | ((prev: NotesData) => NotesData)) => {
    const value = capNotes(typeof next === "function" ? next(dataRef.current) : next);
    dataRef.current = value;
    setDataState(value);
    saveNotes(browserNotesStorage(), keyRef.current, value);
  }, []);

  const clear = useCallback(() => {
    if (isEmptyNotes(dataRef.current)) return;
    setUndoData(dataRef.current);
    setData(emptyNotes());
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoData(null), UNDO_MS);
  }, [setData]);

  const undo = useCallback(() => {
    if (!undoData) return;
    window.clearTimeout(undoTimer.current);
    setData(undoData);
    setUndoData(null);
  }, [undoData, setData]);

  return { supported, data, setData, tool, setTool, color, setColor, canUndo: undoData !== null, clear, undo };
}
