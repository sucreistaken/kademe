"use client";

import Link from "next/link";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";

/**
 * Where the manager is in building one template. The canvas asks for this as
 * "Adım 1/2" on the AI screen; it is three steps here because the manual path
 * has no suggestion step and would otherwise see no orientation at all.
 *
 * The steps are the same for both paths:
 *   1 content    the AI screen or the builder, whichever the manager chose
 *   2 review     the candidate preview
 *   3 publish    the version is frozen and can be invited against
 *
 * A step is a link only when it is reachable. Review needs something to look
 * at, and publish is a button in the builder rather than a page, so it is
 * never a link: it is the end of the road being named in advance.
 */
export function TemplateSteps({
  basePath,
  current,
  reviewable,
}: {
  basePath: string;
  current: 1 | 2 | 3;
  /** False while the template is empty: there is nothing to preview yet. */
  reviewable: boolean;
}) {
  const t = useMT("templateSteps");
  const steps = [
    { n: 1 as const, label: t("content"), href: `${basePath}/builder` },
    {
      n: 2 as const,
      label: t("review"),
      href: reviewable ? `${basePath}/preview` : null,
    },
    { n: 3 as const, label: t("publish"), href: null },
  ];

  return (
    <ol
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px]"
      aria-label={t("label")}
    >
      {steps.map((step, index) => {
        const active = step.n === current;
        const body = (
          <>
            <span className="tnum">{step.n}</span> {step.label}
          </>
        );
        return (
          <li key={step.n} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span className="text-line-strong" aria-hidden>
                ·
              </span>
            ) : null}
            {step.href && !active ? (
              <Link
                href={step.href}
                aria-current={undefined}
                className="text-muted hover:text-ink"
              >
                {body}
              </Link>
            ) : (
              <span
                aria-current={active ? "step" : undefined}
                className={cn(active ? "font-medium text-accent" : "text-muted")}
              >
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
