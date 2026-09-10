/**
 * The 4px bar that sits next to a score, from the Y4 and Y6 artboards.
 *
 * The number alone makes the manager compare rows in their head. The bar makes
 * two candidates comparable at a glance without turning the column into a
 * ranking: it is ink on a hairline track, never the accent, because a score is
 * not a call to action and the product does not rank people for you.
 *
 * The fill is `value / max`, matching the canvas (4,2 on a 1-5 scale fills 84%).
 * It is decorative: the number is always rendered next to it, so the bar is
 * hidden from assistive technology rather than read out twice.
 */
export function ScoreBar({ value, max }: { value: number; max: number }) {
  const filled = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <span
      aria-hidden
      className="block h-1 flex-1 overflow-hidden rounded-full bg-hairline"
    >
      <span
        className="block h-full rounded-full bg-ink"
        style={{ width: `${filled * 100}%` }}
      />
    </span>
  );
}
