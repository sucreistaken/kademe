import { parseNotes, serializeNotes, capNotes, isEmptyNotes, type NotesData } from "@/components/candidate/exam/notes/notes-model";

/** The slice of Storage the notes use (sessionStorage in the browser, a fake in tests). */
export type NotesStorage = {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const PREFIX = "kademe.exam.notes.";

/** Small stable 32-bit FNV-1a hash as base 36 (candidates never receive stimulus ids, so the text itself keys the notes). */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export const notesKey = (token: string, sectionPosition: number, title: string, text: string): string =>
  `${PREFIX}${token}.${sectionPosition}.${fnv1a(`${title}\n${text}`)}`;

export function browserNotesStorage(): NotesStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadNotes(storage: NotesStorage | null, key: string): NotesData {
  try {
    return parseNotes(storage?.getItem(key));
  } catch {
    return parseNotes(null);
  }
}

/** Empty notes remove the key; storage that is full or missing loses the notes quietly. */
export function saveNotes(storage: NotesStorage | null, key: string, data: NotesData): void {
  try {
    if (!storage) return;
    if (isEmptyNotes(data)) storage.removeItem(key);
    else storage.setItem(key, serializeNotes(capNotes(data)));
  } catch {
    /* notes are a convenience only */
  }
}

/** Remove every note of one invitation (called when the exam is finished). */
export function clearAllNotes(token: string, storage: NotesStorage | null = browserNotesStorage()): void {
  try {
    if (!storage) return;
    const prefix = `${PREFIX}${token}.`;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) storage.removeItem(k);
  } catch {
    /* nothing to clear */
  }
}
