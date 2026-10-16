"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { bulkApproveAction, type BulkApproveState } from "@/app/(manager)/exam/bank/actions";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";

export type BankListRow = {
  id: string;
  title: string | null;
  prompt: string;
  section: string;
  level: string;
  within: string;
  type: string;
  origin: string;
  originTone: "neutral" | "done";
};

const GRID = "md:grid-cols-[3fr_0.8fr_0.8fr_1.2fr_0.9fr]";
// A native box: a Radix checkbox inside a <label> toggles twice on one click.
const BOX = "size-4 cursor-pointer accent-[var(--color-accent)]";

/**
 * The bank's rows. Where something can still be approved (every tab but
 * "Onaylı") each row has a box, and "Seçilenleri onayla" approves the chosen
 * ones with the single approval's rules; the line under it says what
 * happened to each kind of row.
 */
export function BankItemList({ rows, selectable, more }: { rows: BankListRow[]; selectable: boolean; more: { href: string; label: string } | null }) {
  const t = useMT("bankTools");
  const [chosen, setChosen] = useState<string[]>([]);
  const [state, setState] = useState<BulkApproveState | null>(null);
  const [pending, start] = useTransition();
  const visible = new Set(rows.map((r) => r.id));
  const picked = chosen.filter((id) => visible.has(id));
  const all = rows.length > 0 && picked.length === rows.length;
  const allBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (allBox.current) allBox.current.indeterminate = picked.length > 0 && !all;
  }, [picked.length, all]);

  function approve() {
    if (picked.length === 0) return;
    setState(null);
    start(async () => {
      try {
        const res = await bulkApproveAction(picked);
        setState(res);
        if (res.ok) setChosen([]);
      } catch {
        setState({ ok: false, code: "FAILED" });
      }
    });
  }

  const summary =
    state === null
      ? null
      : state.ok
        ? [
            t("bulkDone", { n: state.result.approved }),
            state.result.invalid ? t("bulkInvalid", { n: state.result.invalid }) : null,
            state.result.noAudio ? t("bulkNoAudio", { n: state.result.noAudio }) : null,
            state.result.skipped ? t("bulkSkipped", { n: state.result.skipped }) : null,
          ]
            .filter(Boolean)
            .join(" ")
        : state.code === "NO_RIGHT"
          ? t("noApproveRight")
          : t("bulkFailed");

  return (
    <>
      {selectable ? (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-[12px] border border-line bg-surface px-5 py-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13.5px] text-ink">
            <input ref={allBox} type="checkbox" className={BOX} checked={all} onChange={(e) => setChosen(e.target.checked ? rows.map((r) => r.id) : [])} />
            {t("selectAll")}
          </label>
          <span className="tnum text-[13px] text-muted">{t("selected", { n: picked.length })}</span>
          <button
            type="button"
            onClick={approve}
            disabled={pending || picked.length === 0}
            aria-describedby={picked.length === 0 ? "bulk-why" : undefined}
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "ml-auto h-10 px-5")}
          >
            {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {pending ? t("approving") : t("approveSelected")}
          </button>
          {picked.length === 0 ? (
            <span id="bulk-why" className="w-full text-right text-[12.5px] text-muted">
              {t("noSelection")}
            </span>
          ) : null}
          {summary ? (
            <p role="status" className="w-full text-[13.5px] font-medium text-ink">
              {summary}
            </p>
          ) : null}
        </div>
      ) : null}

      <Card className="mt-4 divide-y divide-line">
        {rows.map((r) => {
          const on = picked.includes(r.id);
          return (
            <div key={r.id} className={cn("flex items-stretch hover:bg-canvas", on && "bg-accent-soft")}>
              {selectable ? (
                <label className="flex w-12 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    className={BOX}
                    checked={on}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setChosen((c) => (checked ? [...c, r.id] : c.filter((x) => x !== r.id)));
                    }}
                    aria-label={t("selectRow", { text: r.prompt.slice(0, 60) })}
                  />
                </label>
              ) : null}
              <Link href={`/exam/bank/${r.id}`} className={cn("grid min-w-0 flex-1 grid-cols-1 items-center gap-2 py-3 pr-5", selectable ? "pl-1" : "pl-5", GRID)}>
                <span lang="de" className="min-w-0 text-[13.5px] text-ink">
                  {r.title ? <span className="block text-[11.5px] text-muted">{r.title}</span> : null}
                  {r.prompt}
                </span>
                <span className="text-[13px] text-ink-2">{r.section}</span>
                <span className="tnum text-[13px] text-ink">
                  <span className="font-semibold">{r.level}</span> · {r.within}
                </span>
                <span className="text-[12.5px] text-muted">{r.type}</span>
                <StatusDot tone={r.originTone}>{r.origin}</StatusDot>
              </Link>
            </div>
          );
        })}
        {more ? (
          <Link href={more.href} className="block px-5 py-3 text-center text-[13px] text-ink underline underline-offset-2">
            {more.label}
          </Link>
        ) : null}
      </Card>
    </>
  );
}
