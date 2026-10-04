import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { UsageGroup } from "@/lib/library/usage";

/** HIRING-UX 4.2 rule 2: "Nerede kullanılıyor", grouped by solution. */
export function UsageBlock({
  title,
  empty,
  groups,
  lineLabel,
}: {
  title: string;
  empty: string;
  groups: UsageGroup[];
  lineLabel: (group: UsageGroup) => string;
}) {
  return (
    <Card className="p-card">
      <h2 className="text-[16px] leading-6 font-semibold text-ink">{title}</h2>
      {groups.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map((g) => (
            <div key={g.solution}>
              <p className="tnum text-[13px] font-medium text-ink">{lineLabel(g)}</p>
              <ul className="mt-1 space-y-1">
                {g.entry.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-[13px] text-ink-2 underline decoration-underline underline-offset-2 hover:text-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
