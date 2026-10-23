"use client";

import { NotesLayer } from "@/components/candidate/exam/notes/NotesLayer";
import { NotesToolbar } from "@/components/candidate/exam/notes/NotesToolbar";
import { useNotes } from "@/components/candidate/exam/notes/use-notes";

/** Highlight and underline for the question stems of a listening page (no pen: the pad sits under the player). */
export function StemNotes({
  token,
  sectionPosition,
  contentKey,
  children,
}: {
  token: string;
  sectionPosition: number;
  contentKey: string;
  children: React.ReactNode;
}) {
  const notes = useNotes(token, sectionPosition, "stems", contentKey);
  return (
    <div>
      <NotesToolbar controller={notes} className="mb-3" />
      <NotesLayer controller={notes}>{children}</NotesLayer>
    </div>
  );
}

/** The single-question listening page: stems get marks; any other page passes its children through untouched. */
export function ListeningStems({
  active,
  children,
  ...rest
}: {
  active: boolean;
  token: string;
  sectionPosition: number;
  contentKey: string;
  children: React.ReactNode;
}) {
  return active ? <StemNotes {...rest}>{children}</StemNotes> : <>{children}</>;
}
