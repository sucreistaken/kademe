import { hasGapLayout, splitGapLayout } from "@/lib/exam/gap-layout";

/** Gap markers shown as [g1] in the teacher's view. */
const show = (text: string) => text.replace(/\{\{([^}]+)\}\}/g, "[$1]");

/**
 * The prompt of a bank item for the teacher. A table or a form is drawn as one
 * instead of raw pipes; any other prompt is the same line-broken text as before.
 */
export function GapPromptPreview({ prompt }: { prompt: string }) {
  if (!hasGapLayout(prompt)) {
    return (
      <p lang="de" className="whitespace-pre-line text-[16px] font-medium leading-[1.6] text-ink">
        {show(prompt)}
      </p>
    );
  }
  return (
    <div lang="de" className="flex flex-col gap-3 text-[16px] font-medium leading-[1.6] text-ink">
      {splitGapLayout(prompt).map((b, i) => {
        if (b.kind === "prose") {
          return (
            <p key={i} className="whitespace-pre-line">
              {show(b.text)}
            </p>
          );
        }
        if (b.kind === "form") {
          return (
            <dl key={i} className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-[10px] border border-line px-3 py-2">
              {b.rows.map((r, ri) => (
                <div key={ri} className="contents">
                  <dt className="font-semibold">{r.label}</dt>
                  <dd>{show(r.rest)}</dd>
                </div>
              ))}
            </dl>
          );
        }
        return (
          <div key={i} className="overflow-x-auto">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr>
                  {b.header.map((h, ci) => (
                    <th key={ci} scope="col" className="border border-line bg-canvas px-3 py-1.5 text-start font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-line px-3 py-1.5">
                        {show(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
