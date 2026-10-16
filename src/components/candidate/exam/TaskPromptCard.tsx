import { parseTaskPrompt } from "@/lib/exam/task-prompt";

/**
 * A speaking or writing task laid out for the candidate: the topic as a small
 * label over a heading, the prompt card as a box of its own, the instructions
 * one sentence per line and the points as a list. The text is the same as the
 * old single paragraph, only arranged.
 */
export function TaskPromptCard({ text, id }: { text: string; id?: string }) {
  const { topic, card, blocks } = parseTaskPrompt(text);
  return (
    <div id={id} lang="de" className="flex flex-col gap-4 text-ink">
      {topic ? (
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Thema</div>
          <div className="mt-0.5 text-[22px] font-semibold leading-[1.3]">{topic}</div>
        </div>
      ) : null}
      {card ? (
        <div className="rounded-[16px] border border-line-strong bg-surface px-6 py-5 shadow-sm">
          <div className="text-[13px] font-medium text-muted">{card.lead}</div>
          <div className="mt-2 text-[26px] font-semibold leading-[1.3]">{card.text}</div>
        </div>
      ) : null}
      {blocks.map((b, i) =>
        b.kind === "text" ? (
          <div key={i} className="flex flex-col gap-1 text-[17px] leading-[1.6]">
            {b.lines.map((l, j) => (
              <p key={j}>{l}</p>
            ))}
          </div>
        ) : b.ordered ? (
          <ol key={i} className="flex list-decimal flex-col gap-1.5 pl-6 text-[17px] leading-[1.6] marker:font-semibold marker:text-muted">
            {b.items.map((l, j) => (
              <li key={j}>{l}</li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="flex list-disc flex-col gap-1.5 pl-6 text-[17px] leading-[1.6] marker:text-muted">
            {b.items.map((l, j) => (
              <li key={j}>{l}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
