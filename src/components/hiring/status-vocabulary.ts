import type { StatusTone } from "@/components/ui/status-dot";
import type { CandidateProgress } from "@/solutions/hiring/rules/invitation";

/**
 * HIRING-VISUAL-FLOW P9: one dictionary for every place an opening or a
 * candidate shows its status (dot plus word, never a badge). Accent only for
 * what is live (OPEN, IN_PROGRESS); a closed opening is the quietest grey; an
 * expired link is the one status said in bold ink, because someone must act.
 */
type Entry = { tone: StatusTone; strong: boolean };

export const OPENING_STATUS: Record<"DRAFT" | "OPEN" | "CLOSED", Entry> = {
  DRAFT: { tone: "neutral", strong: false },
  OPEN: { tone: "active", strong: false },
  CLOSED: { tone: "warn", strong: false },
};

export const CANDIDATE_STATUS: Record<CandidateProgress, Entry> = {
  INVITED: { tone: "neutral", strong: false },
  OPENED: { tone: "neutral", strong: false },
  IN_PROGRESS: { tone: "active", strong: false },
  COMPLETED: { tone: "done", strong: false },
  EXPIRED: { tone: "warn", strong: true },
};
