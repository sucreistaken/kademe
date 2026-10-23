import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import type { StudentStatus } from "@/server/panel";
import { PanelHeader } from "@/components/manager/panel-header";
import { intlTag } from "@/lib/format";
import { levelLabel } from "@/lib/exam/level-label";

/**
 * Small shared pieces of the teacher panel (soft look, 2026-10-14). A status
 * is a soft pill with a dot and a word; a level is a small rounded chip. The
 * word always carries the meaning, the colour only helps a glance.
 */

export const STATUS_TONE: Record<StudentStatus, StatusTone> = {
  NOT_STARTED: "neutral",
  IN_EXAM: "active",
  AWAITING_GRADING: "neutral",
  AWAITING_REVIEW: "warn",
  FINAL: "done",
  RELEASED: "done",
  EXPIRED: "neutral",
};

export const INTEGRITY_TONE: Record<string, StatusTone> = {
  CLEAR: "done",
  REVIEW: "warn",
  ATTENTION: "warn",
  NONE: "neutral",
  PENDING: "neutral",
};

/** `strong` (the row the manager must act on) draws the pill's word in extra bold. */
export function Dot({ tone, children, strong }: { tone: StatusTone; children: React.ReactNode; strong?: boolean }) {
  return (
    <StatusDot tone={tone} pill className={strong ? "font-extrabold" : undefined}>
      {children}
    </StatusDot>
  );
}

/** `preA1`: how A0 reads ("A0 (Pre-A1)", `resultLevel.A0`); without it the chip shows the bare level. */
export function Level({ level, muted, preA1 }: { level: string | null; muted?: boolean; preA1?: string }) {
  if (!level) return <span className="tnum text-[14px] font-bold text-muted">-</span>;
  return (
    <span
      className={`tnum inline-grid min-w-9 place-items-center whitespace-nowrap rounded-md border-2 px-1.5 py-px text-[13px] font-extrabold ${muted ? "border-hairline bg-subtle text-muted" : "border-line bg-surface text-ink"}`}
    >
      {preA1 ? levelLabel(level, preA1) : level}
    </span>
  );
}

/** The exam pages' head: since plan 2b the shared PanelHeader (P2); same title, sub line and action. */
export function PageHead({ title, sub, action }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return <PanelHeader title={title} meta={sub} primary={action} />;
}

export const shortDateTime = (d: Date | null, locale: string) =>
  d ? d.toLocaleString(intlTag(locale), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }) : "-";
