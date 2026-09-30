import type { ItemAnswer, ItemSnapshot } from "@/lib/exam/types";

/**
 * Plain-text renderings of an answer and of a key, for the teacher's item
 * table. The student never sees any of this.
 */

const TF: Record<string, string> = { R: "R", F: "F", NG: "NG" };

export function answerText(s: ItemSnapshot, a: ItemAnswer | null): string {
  if (!a) return "";
  const c = s.content;
  if (c.kind === "CHOICE") return (a.choiceIds ?? []).map((id) => c.options.find((o) => o.id === id)?.text ?? id).join(", ");
  if (c.kind === "TFNG") return c.statements.map((st, i) => `${i + 1}: ${a.tfng?.[st.id] ? TF[a.tfng[st.id]] : "-"}`).join("  ");
  if (c.kind === "GAP") return c.gaps.map((g) => a.gaps?.[g.id] || "-").join(" | ");
  if (c.kind === "MATCHING") return c.left.map((l, i) => `${i + 1}→${c.right.find((r) => r.id === a.matches?.[l.id])?.text ?? "-"}`).join("  ");
  return a.text ?? "";
}

export function keyText(s: ItemSnapshot): string {
  const c = s.content;
  const k = s.key;
  if (c.kind === "CHOICE" && k.kind === "CHOICE") return k.correct.map((id) => c.options.find((o) => o.id === id)?.text ?? id).join(", ");
  if (c.kind === "TFNG" && k.kind === "TFNG") return c.statements.map((st, i) => `${i + 1}: ${TF[k.answers[st.id]]}`).join("  ");
  if (c.kind === "GAP" && k.kind === "GAP") return c.gaps.map((g) => (k.answers[g.id] ?? []).join(" / ")).join(" | ");
  if (c.kind === "MATCHING" && k.kind === "MATCHING") return c.left.map((l, i) => `${i + 1}→${c.right.find((r) => r.id === k.pairs[l.id])?.text ?? "-"}`).join("  ");
  if (k.kind === "SHORT_TEXT") return k.accepted.join(" / ");
  return "";
}

/** Marks every evidence quote inside the answer, case and spacing tolerant. */
export function Highlighted({ text, quotes }: { text: string; quotes: string[] }) {
  const ranges: Array<[number, number]> = [];
  const lower = text.toLocaleLowerCase("de-DE");
  for (const q of quotes) {
    const needle = q.trim().toLocaleLowerCase("de-DE");
    if (needle.length < 3) continue;
    const at = lower.indexOf(needle);
    if (at >= 0) ranges.push([at, at + needle.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], i) => {
    if (s < pos) return;
    parts.push(text.slice(pos, s));
    parts.push(
      <mark key={i} className="rounded-[3px] bg-accent-soft px-0.5 text-ink">
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  });
  parts.push(text.slice(pos));
  return (
    <p lang="de" className="whitespace-pre-line text-[15px] leading-[1.75] text-ink">
      {parts}
    </p>
  );
}

/** The engine's estimate after each objective answer, as a small line. */
export function Trajectory({ points }: { points: Array<{ theta: number; se: number }> }) {
  if (points.length < 2) return null;
  const w = 320;
  const h = 90;
  const y = (t: number) => h - ((Math.max(-3, Math.min(3, t)) + 3) / 6) * h;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const cuts = [-2, -1, 0, 1, 2];
  const labels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  return (
    <svg viewBox={`-26 -4 ${w + 30} ${h + 8}`} className="h-[100px] w-full max-w-[360px]" role="img" aria-label="theta">
      {cuts.map((c) => (
        <line key={c} x1={0} x2={w} y1={y(c)} y2={y(c)} className="stroke-line" strokeWidth={1} />
      ))}
      {labels.map((l, i) => (
        <text key={l} x={-24} y={y(-2.5 + i) + 3} className="fill-muted text-[9px]">
          {l}
        </text>
      ))}
      <polyline
        fill="none"
        className="stroke-ink"
        strokeWidth={1.5}
        points={points.map((p, i) => `${x(i)},${y(p.theta)}`).join(" ")}
      />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].theta)} r={3} className="fill-accent" />
    </svg>
  );
}
