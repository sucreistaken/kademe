"use client";

import { useLocale } from "next-intl";
import { layoutTaskBlocks, parseTaskPrompt, type TaskSegment } from "@/lib/exam/task-prompt";
import { useT } from "@/i18n/candidate-client";
import { dirOf, isCandidateLocale } from "@/i18n/locale";

const LABEL = "text-[12px] font-semibold uppercase tracking-[0.06em] text-muted";
const BODY = "text-[17px] leading-[1.6]";

function List({ ordered, items, className }: { ordered: boolean; items: string[]; className?: string }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={`flex flex-col gap-1.5 ps-6 ${ordered ? "list-decimal marker:font-semibold" : "list-disc"} marker:text-muted ${BODY} ${className ?? ""}`}
    >
      {items.map((l, j) => (
        <li key={j}>{l}</li>
      ))}
    </Tag>
  );
}

type UiText = { lang?: string; dir?: "ltr" | "rtl" };

function Segment({ seg, heading, ui }: { seg: TaskSegment; heading: string | null; ui: UiText }) {
  switch (seg.kind) {
    case "situation":
      // The scene, set in a soft box so it reads apart from what the candidate has to do.
      return (
        <div className="flex flex-col gap-1 rounded-[12px] bg-cream px-5 py-4 text-[16px] leading-[1.6]">
          {seg.lines.map((l, j) => (
            <p key={j}>{l}</p>
          ))}
        </div>
      );
    case "tasks":
      return (
        <div>
          {heading ? (
            <div {...ui} className={LABEL}>
              {heading}
            </div>
          ) : null}
          <ul className={`${heading ? "mt-2" : ""} flex list-disc flex-col gap-2 ps-6 font-semibold marker:text-muted ${BODY}`}>
            {seg.items.map((it, j) => (
              <li key={j}>
                {it.text}
                {it.lists.map((l, k) => (
                  <List key={k} ordered={l.ordered} items={l.items} className="mt-1.5 font-normal" />
                ))}
              </li>
            ))}
          </ul>
        </div>
      );
    case "text":
      return (
        <div className={`flex flex-col gap-1 ${BODY}`}>
          {seg.lines.map((l, j) => (
            <p key={j}>{l}</p>
          ))}
        </div>
      );
    case "list":
      return <List ordered={seg.ordered} items={seg.items} />;
  }
}

/**
 * "Cover these points": the item's own student points, German phrases naming
 * what to address. The label is the interface; the points stay German. Two
 * columns from medium width keep the task screen short.
 */
function CoverPoints({ points, ui }: { points: string[]; ui: UiText }) {
  const t = useT("examItems");
  return (
    <div className="rounded-[12px] border border-line bg-surface px-5 py-3">
      <div {...ui} className={LABEL}>
        {t("coverPoints")}
      </div>
      <ul
        lang="de"
        className={`mt-1.5 grid list-disc gap-x-8 gap-y-1 ps-5 text-[16px] leading-[1.5] marker:text-muted ${points.length > 2 ? "md:grid-cols-2" : ""}`}
      >
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A speaking or writing task laid out for the candidate: the topic as a small
 * label over a heading, the prompt card as a box of its own, the situation in a
 * soft box and the task lines as a bulleted list under "Göreviniz". The text is
 * the prompt's own, only arranged. Under it, when the item has them, the
 * student points (`studentPoints`, the one rubric field written for the
 * student); nothing else from the key or rubric is added.
 */
export function TaskPromptCard({ text, id, points }: { text: string; id?: string; points?: string[] }) {
  const t = useT("examItems");
  // The card is German (left to right); the "Your task" label is the interface and keeps the student's language and direction.
  const uiLocale = useLocale();
  const ui: UiText = isCandidateLocale(uiLocale) ? { lang: uiLocale, dir: dirOf(uiLocale) } : {};
  const { topic, card, blocks } = parseTaskPrompt(text);
  const segments = layoutTaskBlocks(blocks);
  const firstTasks = segments.findIndex((s) => s.kind === "tasks");
  return (
    <div id={id} lang="de" className="flex flex-col gap-4 text-ink">
      {topic ? (
        <div>
          <div className={LABEL}>Thema</div>
          <div className="mt-0.5 text-[22px] font-semibold leading-[1.3]">{topic}</div>
        </div>
      ) : null}
      {card ? (
        <div className="rounded-[16px] border border-line-strong bg-surface px-6 py-5 shadow-sm">
          <div className="text-[13px] font-medium text-muted">{card.lead}</div>
          <div className="mt-2 text-[26px] font-semibold leading-[1.3]">{card.text}</div>
        </div>
      ) : null}
      {segments.map((seg, i) => (
        <Segment key={i} seg={seg} heading={i === firstTasks ? t("taskHeading") : null} ui={ui} />
      ))}
      {points && points.length > 0 ? <CoverPoints points={points} ui={ui} /> : null}
    </div>
  );
}
