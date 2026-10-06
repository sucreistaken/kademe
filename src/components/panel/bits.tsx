import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import type { StudentStatus } from "@/server/panel";
import { PanelHeader } from "@/components/manager/panel-header";

/**
 * Small shared pieces of the teacher panel. Status is always a dot and a word;
 * a level is plain bold text, never a pill.
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

export function Dot({ tone, children, strong }: { tone: StatusTone; children: React.ReactNode; strong?: boolean }) {
  return (
    <StatusDot tone={tone} className={strong ? "font-semibold text-ink" : undefined}>
      {children}
    </StatusDot>
  );
}

export function Level({ level, muted }: { level: string | null; muted?: boolean }) {
  return <span className={`tnum text-[14px] font-bold ${muted ? "text-muted" : "text-ink"}`}>{level ?? "-"}</span>;
}

/** The exam pages' head: since plan 2b the shared PanelHeader (P2); same title, sub line and action. */
export function PageHead({ title, sub, action }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return <PanelHeader title={title} meta={sub} primary={action} />;
}

export const shortDateTime = (d: Date | null, locale: string) =>
  d ? d.toLocaleString(locale === "en" ? "en-GB" : "tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }) : "-";
