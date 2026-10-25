"use client";

import { PassageBody, type PassageMatch } from "@/components/candidate/exam/PassageBody";
import { NotesLayer } from "@/components/candidate/exam/notes/NotesLayer";
import { NotesToolbar } from "@/components/candidate/exam/notes/NotesToolbar";
import { useNotes } from "@/components/candidate/exam/notes/use-notes";

/**
 * The reading passage beside its questions: stays in view while the questions scroll. Carries the student's note tools.
 * `match`: the text-insertion item shown beside it, whose gaps are drawn in the text.
 */
export function ReadingPane({
  title,
  text,
  token,
  sectionPosition,
  match,
}: {
  title: string;
  text: string;
  token: string;
  sectionPosition: number;
  match?: PassageMatch;
}) {
  const notes = useNotes(token, sectionPosition, title, text);
  return (
    <article className="rounded-[14px] border border-line bg-surface p-6 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem-var(--step-footer-space,112px)-var(--step-notice-space,0px))] lg:overflow-y-auto">
      {notes.supported ? (
        // lg:-top-6: inside the scrolling article a sticky child sticks within its padding, so top-0 would sit 24px low, over the title.
        <div className="sticky top-0 z-10 -mx-6 -mt-6 lg:-top-6 mb-3 border-b border-line bg-surface px-5 py-2">
          <NotesToolbar controller={notes} pen />
        </div>
      ) : null}
      <div lang="de" className="text-title-lg text-ink">{title}</div>
      <NotesLayer controller={notes} pen>
        <PassageBody text={text} title={title} match={match} />
      </NotesLayer>
    </article>
  );
}
