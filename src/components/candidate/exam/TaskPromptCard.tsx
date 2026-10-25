"use client";

import { useId } from "react";
import { useLocale } from "next-intl";
import { GapTable } from "@/components/gap-table";
import { splitGapLayout } from "@/lib/exam/gap-layout";
import { coverPointsFor, layoutTaskBlocks, parseTaskPrompt, presentTask, type TaskLine, type TaskView } from "@/lib/exam/task-prompt";
import { useT } from "@/i18n/candidate-client";
import { dirOf, isCandidateLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";

/*
 * One weight per role, so a task never jumps between bold and regular:
 *   situation  17px regular, in a soft box
 *   label      overline, muted ("Your task")
 *   task       17px semibold, the only heavy text of the card
 *   points     16px regular, bulleted or numbered, one gap between items
 *   note       16px regular, a requirement after the points
 *   example    15px italic, muted
 * The role is also written on each piece as data-role.
 */
// Not run through cn(): tailwind-merge does not know the text-overline size token and would drop it next to the colour.
const LABEL = "text-overline uppercase text-muted";

type UiText = { lang?: string; dir?: "ltr" | "rtl" };

/** Bullets or numbers by hand (not list-style) so every item lines up the same way and the number column stays tidy. */
function Points({ ordered, items, className }: { ordered: boolean; items: string[]; className?: string }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag role="list" className={cn("flex flex-col gap-2 text-[16px] leading-[1.5]", className)} data-role="items">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          {ordered ? (
            <span aria-hidden className="tnum w-6 shrink-0 text-end text-muted">
              {i + 1}.
            </span>
          ) : (
            // 16px text on a 24px line: the 6px dot sits 9px down, level with the middle of the first line.
            <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink-3" />
          )}
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </Tag>
  );
}

/** Task lines in one weight; a line that quotes an example puts it on its own muted italic line. */
function Lines({ lines, className, role, quiet = false }: { lines: TaskLine[]; className: string; role: "task" | "note"; quiet?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-role={role}>
      {lines.map((line, i) =>
        line.example ? (
          <div key={i} className="flex flex-col gap-1">
            {/* An instruction that carries an example is a detail, so it is regular even among semibold task lines. */}
            <p className={cn("font-normal", !quiet && "text-ink-2")}>{line.text}</p>
            <p className="ps-4 text-[15px] font-normal italic text-muted" data-role="example">
              {line.example}
            </p>
          </div>
        ) : (
          <p key={i}>{line.text}</p>
        ),
      )}
    </div>
  );
}

function View({ view, heading, ui }: { view: TaskView; heading: string | null; ui: UiText }) {
  switch (view.kind) {
    case "situation":
      // The scene, set in a soft box so it reads apart from what the candidate has to do.
      return (
        <div className="rounded-[14px] bg-cream px-5 py-4 text-[17px] font-normal leading-[1.6]" data-role="situation">
          <div className="flex flex-col gap-2">
            {view.lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
          {view.list ? <Points ordered={view.list.ordered} items={view.list.items} className="mt-3" /> : null}
        </div>
      );
    case "task":
      return (
        <div>
          {heading ? (
            <div {...ui} className={`${LABEL} mb-1.5`}>
              {heading}
            </div>
          ) : null}
          <Lines lines={view.lines} role="task" className="text-[17px] font-semibold leading-[1.5]" />
        </div>
      );
    case "points":
      return <Points ordered={view.ordered} items={view.items} />;
    case "note":
      return <Lines lines={view.lines} role="note" className="text-[16px] font-normal leading-[1.5] text-ink-2" quiet />;
    case "text":
      return (
        <div className="flex flex-col gap-1.5 text-[16px] font-normal leading-[1.55]" data-role="text">
          {view.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      );
  }
}

/**
 * "Cover these points": the item's own student points, German phrases naming
 * what to address. The label is the interface; the points stay German. Two
 * columns from medium width keep the task screen short. It sits beside the
 * card, not in it, so a field labelled by the card keeps a short name and can
 * point at the box with aria-describedby instead.
 */
function CoverPoints({ points, ui, id }: { points: string[]; ui: UiText; id?: string }) {
  const t = useT("examItems");
  return (
    <div id={id} className="mt-4 rounded-[12px] border border-line bg-surface px-5 py-3" data-role="cover">
      <div {...ui} className={LABEL}>
        {t("coverPoints")}
      </div>
      <ul lang="de" role="list" className={cn("mt-2 grid list-disc gap-x-8 gap-y-1.5 ps-5 text-[16px] leading-[1.5] text-ink marker:text-muted", points.length > 2 && "md:grid-cols-2")}>
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
 * soft box, then the task under a "Your task" label with its points as a list.
 * The text is the prompt's own, only arranged (`presentTask` gives each piece a
 * role). Under it, when the item has them and the prompt does not already list
 * what to do (`coverPointsFor`), the student points (`studentPoints`, the one
 * rubric field written for the student); nothing else from the key or rubric
 * is added.
 */
export function TaskPromptCard({ text, id, points, pointsId }: { text: string; id?: string; points?: string[]; pointsId?: string }) {
  const t = useT("examItems");
  // The card is German (left to right); the "Your task" label is the interface and keeps the student's language and direction.
  const uiLocale = useLocale();
  const ui: UiText = isCandidateLocale(uiLocale) ? { lang: uiLocale, dir: dirOf(uiLocale) } : {};
  const tableId = useId();
  // A pipe table in the task is shown as a read-only table; the prose around it is laid out as before.
  const parts = splitGapLayout(text);
  const parsed = parts.map((p) => {
    if (p.kind === "table") return null;
    const { topic, card, blocks } = parseTaskPrompt(p.kind === "prose" ? p.text : "");
    return { topic, card, views: presentTask(layoutTaskBlocks(blocks)) };
  });
  const lead = parsed.find((p) => p !== null) ?? null;
  const topic = lead?.topic ?? null;
  const card = lead?.card ?? null;
  // The "Your task" label goes over the first task, wherever a table sits.
  let headed = false;
  const cover = coverPointsFor(text, points);
  return (
    <>
      <div id={id} lang="de" className="flex flex-col gap-5 text-ink">
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
        {parts.map((p, pi) => {
          if (p.kind === "table") return <GapTable key={pi} header={p.header} rows={p.rows} idPrefix={`${tableId}-${pi}`} />;
          const views = parsed[pi]?.views ?? [];
          // The situation stands alone; the task and everything that follows it is one group with one rhythm.
          const groups: TaskView[][] = [];
          for (const v of views) {
            const last = groups[groups.length - 1];
            if (v.kind !== "situation" && last && last[0].kind !== "situation") last.push(v);
            else groups.push([v]);
          }
          return groups.map((g, gi) => (
            <div key={`${pi}-${gi}`} className={g[0].kind === "situation" ? undefined : "flex flex-col gap-3"}>
              {g.map((v, vi) => {
                const heading = !headed && v.kind === "task" ? t("taskHeading") : null;
                if (heading) headed = true;
                return <View key={vi} view={v} heading={heading} ui={ui} />;
              })}
            </div>
          ));
        })}
      </div>
      {cover.length > 0 ? <CoverPoints points={cover} ui={ui} id={pointsId} /> : null}
    </>
  );
}
