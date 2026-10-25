"use client";

import { Fragment } from "react";
import { AD_TONE_CLASSES, adTone } from "@/lib/exam/ad-tone";
import { linkPassage } from "@/lib/exam/insertion-gaps";
import { passageBlocks, type PassageBlock } from "@/lib/exam/passage-blocks";
import type { CandidateItem } from "@/lib/exam/safe";
import type { ItemAnswer } from "@/lib/exam/types";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { InsertionSlot } from "./InsertionSlot";
import { cardTitles, pickerChoices, targetViews, withMatch } from "./match-targets";

type Card = Extract<PassageBlock, { kind: "card" }>;

const SHORT_CARD_WORDS = 60;
const wordCount = (card: Card) => card.lines.join(" ").split(/\s+/).filter(Boolean).length;

/**
 * One advert or notice part: a tinted card. The letter sits in a white disc on
 * the same header line as the title, and the title takes the rest of the
 * card's width, so it reads in one or two lines.
 */
function AdCard({ card, index }: { card: Card; index: number }) {
  const tone = AD_TONE_CLASSES[adTone(card.marker, index)];
  return (
    <section className={cn("rounded-[22px] border-2 p-5 text-ink", tone.card)}>
      {card.marker ? (
        <div className="flex items-center gap-3">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border-2 bg-surface text-label text-ink", tone.disc)}>
            {card.marker}
          </span>
          {card.title ? <h3 className="min-w-0 flex-1 text-[17px] font-black leading-[1.3] text-ink">{card.title}</h3> : null}
        </div>
      ) : (
        <h3 className="font-bold text-ink">{card.heading}</h3>
      )}
      {card.lines.map((line, j) => (
        <p key={j} className={card.marker || j > 0 ? "mt-2" : "mt-1"}>{line}</p>
      ))}
    </section>
  );
}

/** The matching item whose rows are the passage's gaps (text insertion): its gaps are drawn in the text as buttons. */
export type PassageMatch = {
  item: CandidateItem;
  answer: ItemAnswer;
  onChange: (next: ItemAnswer) => void;
  disabled?: boolean;
};

/**
 * The text of a reading passage: prose as paragraphs, numbered parts (Kurs 1,
 * Anzeige A) as tinted cards. With `match`, and when every gap of the item is
 * found in the text, each gap marker ("(1) ________") becomes a button that
 * opens the list of sentences.
 *
 * The cards sit in one column unless the text has room for two: the container
 * query looks at the passage's own width, which beside the questions is about
 * 500px, too narrow for two cards with a letter and a title each.
 */
export function PassageBody({ text, title, match }: { text: string; title: string; match?: PassageMatch }) {
  const ti = useT("examItems");
  const blocks = passageBlocks(text, title);
  const cards = blocks.filter((b): b is Card => b.kind === "card");
  const twoColumns = cards.length > 0 && cards.every((c) => wordCount(c) <= SHORT_CARD_WORDS);

  const content = match?.item.content.kind === "MATCHING" ? match.item.content : null;
  const link = content ? linkPassage(blocks, content.left) : null;
  const views = content && link ? targetViews(content.right, cardTitles(text, title)) : [];
  const matches = match?.answer.matches ?? {};
  const rowOrder = content?.left.map((l) => l.id) ?? [];
  const slot = (rowId: string, number: number) => {
    if (!match || !link) return null;
    const choices = pickerChoices(views, matches, rowId, rowOrder, (usedBy) => ti("insertUsedIn", { n: usedBy.map((id) => link.numbers.get(id)).join(", ") }));
    return (
      <InsertionSlot
        key={rowId}
        rowId={rowId}
        number={number}
        chosen={views.find((v) => v.id === matches[rowId])}
        choices={choices}
        disabled={match.disabled}
        // Every sentence is used once: one picked for this gap leaves the gap that held it.
        onPick={(targetId) => match.onChange({ matches: withMatch(matches, rowId, targetId, true) })}
      />
    );
  };

  const out: React.ReactNode[] = [];
  let run: Array<{ card: Card; index: number }> = [];
  const flush = (key: number) => {
    if (run.length === 0) return;
    out.push(
      <div key={`cards-${key}`} className={cn("grid gap-4", twoColumns && "@min-[46rem]:grid-cols-2")}>
        {run.map((r) => (
          <AdCard key={r.index} card={r.card} index={r.index} />
        ))}
      </div>,
    );
    run = [];
  };
  blocks.forEach((b, i) => {
    if (b.kind === "card") {
      run.push({ card: b, index: cards.indexOf(b) });
      return;
    }
    flush(i);
    const pieces = link?.pieces[i];
    out.push(
      <p key={i} className="whitespace-pre-line">
        {pieces
          ? pieces.map((piece, k) => (piece.kind === "text" ? <Fragment key={k}>{piece.text}</Fragment> : <Fragment key={k}>{slot(piece.rowId, piece.number)}</Fragment>))
          : b.lines.join("\n")}
      </p>,
    );
  });
  flush(blocks.length);
  return (
    <div lang="de" className="@container mt-3 flex flex-col gap-4 text-passage text-ink">
      {out}
    </div>
  );
}
