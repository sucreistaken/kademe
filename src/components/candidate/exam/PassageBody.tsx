import { passageBlocks } from "@/lib/exam/passage-blocks";

/** The text of a reading passage: prose as paragraphs, numbered parts (Kurs 1, Anzeige A) as boxes. */
export function PassageBody({ text, title }: { text: string; title: string }) {
  const blocks = passageBlocks(text, title);
  return (
    <div lang="de" className="mt-3 flex flex-col gap-4 text-[16px] leading-[1.75] text-ink">
      {blocks.map((b, i) =>
        b.kind === "card" ? (
          <section key={i} className="rounded-[16px] border border-line p-4">
            <h3 className="font-bold text-ink">{b.heading}</h3>
            {b.lines.map((line, j) => (
              <p key={j} className="mt-1">{line}</p>
            ))}
          </section>
        ) : (
          <p key={i} className="whitespace-pre-line">{b.lines.join("\n")}</p>
        ),
      )}
    </div>
  );
}
