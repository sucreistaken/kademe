import { AD_TONE_CLASSES, adTone } from "@/lib/exam/ad-tone";
import { passageBlocks, type PassageBlock } from "@/lib/exam/passage-blocks";
import { cn } from "@/lib/cn";

type Card = Extract<PassageBlock, { kind: "card" }>;

const SHORT_CARD_WORDS = 60;
const wordCount = (card: Card) => card.lines.join(" ").split(/\s+/).filter(Boolean).length;

/** One advert or notice part: a tinted card with its letter in a white disc, then the title and the text. */
function AdCard({ card, index }: { card: Card; index: number }) {
  const tone = AD_TONE_CLASSES[adTone(card.marker, index)];
  return (
    <section className={cn("rounded-[22px] border-2 p-5 text-ink", tone.card)}>
      {card.marker ? (
        <div className="flex items-center gap-3">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border-2 bg-surface text-label text-ink", tone.disc)}>
            {card.marker}
          </span>
          {card.title ? <h3 className="min-w-0 text-[17px] font-black text-ink">{card.title}</h3> : null}
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

/** The text of a reading passage: prose as paragraphs, numbered parts (Kurs 1, Anzeige A) as tinted cards. */
export function PassageBody({ text, title }: { text: string; title: string }) {
  const blocks = passageBlocks(text, title);
  const cards = blocks.filter((b): b is Card => b.kind === "card");
  const twoColumns = cards.length > 0 && cards.every((c) => wordCount(c) <= SHORT_CARD_WORDS);
  const out: React.ReactNode[] = [];
  let run: Array<{ card: Card; index: number }> = [];
  const flush = (key: number) => {
    if (run.length === 0) return;
    out.push(
      <div key={`cards-${key}`} className={cn("grid gap-4", twoColumns && "sm:grid-cols-2")}>
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
    out.push(
      <p key={i} className="whitespace-pre-line">
        {b.lines.join("\n")}
      </p>,
    );
  });
  flush(blocks.length);
  return (
    <div lang="de" className="mt-3 flex flex-col gap-4 text-passage text-ink">
      {out}
    </div>
  );
}
