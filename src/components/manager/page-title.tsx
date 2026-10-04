/** Page heading for the new screens (HIRING-UX 8.4: 26/32, 600, -0.01em). */
export function PageTitle({
  title,
  sub,
  action,
  eyebrow,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-[13px] text-muted">{eyebrow}</div> : null}
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {sub ? <p className="mt-1 text-[14px] leading-[22px] text-muted">{sub}</p> : null}
      </div>
      {action ? <div className="flex flex-col items-end gap-1">{action}</div> : null}
    </div>
  );
}
