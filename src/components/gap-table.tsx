import type { ReactNode } from "react";

export type GapTableCell = { text: string; row: number; col: number; labelledBy: string };

/**
 * The one table renderer for pipe tables: gap prompts (cells hold inputs via
 * `renderCell`), the teacher's bank view and the read-only writing task.
 * Without `renderCell` a cell is its plain text. Logical classes only.
 */
export function GapTable({
  header,
  rows,
  idPrefix,
  renderCell,
  compact,
}: {
  header: string[];
  rows: string[][];
  idPrefix: string;
  renderCell?: (cell: GapTableCell) => ReactNode;
  compact?: boolean;
}) {
  const pad = compact ? "px-3 py-1.5" : "px-3 py-2";
  const hid = (c: number) => `${idPrefix}-h-${c}`;
  const rid = (r: number) => `${idPrefix}-r-${r}`;
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse ${compact ? "text-[15px]" : "text-[16px] leading-[1.5]"}`}>
        <thead>
          <tr>
            {header.map((h, ci) => (
              <th key={ci} id={hid(ci)} scope="col" className={`border border-line bg-canvas ${pad} text-start font-bold`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                // The row label (first cell, when it holds no gap) and the column header name every input of the cell.
                const rowLabel = !row[0].includes("{{") && ci > 0 ? `${rid(ri)} ` : "";
                const labelledBy = `${rowLabel}${hid(ci)}`;
                return ci === 0 && !cell.includes("{{") ? (
                  <th key={ci} id={rid(ri)} scope="row" className={`border border-line ${pad} text-start font-semibold`}>
                    {cell}
                  </th>
                ) : (
                  <td key={ci} className={`border border-line ${pad} align-middle`}>
                    {renderCell ? renderCell({ text: cell, row: ri, col: ci, labelledBy }) : cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
