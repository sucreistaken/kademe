import { splitTaskPrompt } from "@/components/panel/result/review-cards";

/**
 * The writing or speaking task as the student saw it, in a small card: the
 * topic and the card text on their own lines instead of one cramped run.
 */
export function TaskPrompt({ prompt, label }: { prompt: string; label: string }) {
  const lines = splitTaskPrompt(prompt);
  return (
    <div className="mt-2 rounded-[14px] border border-line bg-canvas px-4 py-3">
      <div className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-muted">{label}</div>
      <div lang="de" className="mt-1 flex flex-col text-[14.5px] leading-[1.65] text-ink">
        {lines.map((l, i) => (l === "" ? <span key={i} className="h-2" aria-hidden="true" /> : <p key={i}>{l}</p>))}
      </div>
    </div>
  );
}
