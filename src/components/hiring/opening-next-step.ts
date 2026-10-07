/**
 * HIRING-VISUAL-FLOW 4.4 (KG1-KG5, H8, H9): the openings' control view as
 * pure rules. Each opening is one row with one next step, chosen here by one
 * rule (KG2); each step opens the flow or page that fixes it (KG3).
 */
export type OpeningNextKind = "setup" | "continueSetup" | "requests" | "team" | "expiring" | "draft" | "deadline" | "invite" | "candidates" | "open";
export type OpeningNext<K extends string = string> = { kind: OpeningNextKind; href: string; setupKey?: K };

/**
 * KG2: the one next step of an opening's row.
 * - Someone who does not run openings (a reviewer, H9) and every closed opening: "Aç ›" (KG1: one action;
 *   the overview of a closed opening carries "Ekip ve kurallarda yeniden aç").
 * - Draft: the setup path's next step ("Sıradaki: Ekibi ata ›"); "Kuruluma devam et ›" to the overview when
 *   the step was not computed (the time budget, D14). A live opening's waiting draft says "Kuruluma devam et ›"
 *   to its setup path's next step the same way (B-M10).
 * - Live, in this order: open candidate requests (data-rights requests are only counted, ruling C6),
 *   a team with no active evaluator (the invite form's noEvaluators), links expiring within 48 hours, a draft version waiting,
 *   the opening's last day passed (no invitation can be opened, B-M3: to the contact flow's last day),
 *   no invitation yet, else the candidates.
 */
export function openingNextStep<K extends string>(input: {
  id: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  runs: boolean;
  setup?: { key: K; href: string } | null;
  facts?: { invited: number; expiringSoon: number; requests?: { open: number; rights: number } } | null;
  /** No active evaluator on the live opening: no invitation can be opened (NO_EVALUATORS). */
  noTeam?: boolean;
  draftWaiting?: boolean;
  /** The opening's last day is before today in the organisation's zone (the invite form's openingDeadline). */
  deadlinePassed?: boolean;
}): OpeningNext<K> {
  const base = `/hiring/openings/${input.id}`;
  if (!input.runs || input.status === "CLOSED") return { kind: "open", href: base };
  if (input.status === "DRAFT") return input.setup ? { kind: "setup", href: input.setup.href, setupKey: input.setup.key } : { kind: "continueSetup", href: base };
  const facts = input.facts ?? { invited: 0, expiringSoon: 0 };
  if ((facts.requests?.open ?? 0) > 0) return { kind: "requests", href: `${base}/candidates` };
  if (input.noTeam) return { kind: "team", href: `${base}/settings#team-members` };
  if (facts.expiringSoon > 0) return { kind: "expiring", href: `${base}/candidates` };
  // B-M10 (KG3): a live opening's new version continues at its next setup step when that was computed (D14), else at the overview.
  if (input.draftWaiting) return { kind: "draft", href: input.setup?.href ?? base };
  if (input.deadlinePassed) return { kind: "deadline", href: `${base}/settings#contact-deadline` };
  if (facts.invited === 0) return { kind: "invite", href: `/hiring/invite?opening=${input.id}` };
  return { kind: "candidates", href: `${base}/candidates` };
}

/** H8: the old route tabs become groups; `?tab=` keeps working (draft and open scroll to their group, closed opens the closed ones). */
export function cockpitTab(value: string | string[] | undefined): "draft" | "open" | "closed" | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "draft" || v === "open" || v === "closed" ? v : null;
}

/** KG4: the one-sentence summary's numbers: openings under way, in setup, and those whose next step waits for the viewer. */
export function cockpitCounts(rows: ReadonlyArray<{ status: "DRAFT" | "OPEN" | "CLOSED"; next: { kind: OpeningNextKind } }>): { running: number; setup: number; waiting: number } {
  const live = rows.filter((r) => r.status !== "CLOSED");
  return {
    running: live.length,
    setup: live.filter((r) => r.status === "DRAFT").length,
    waiting: live.filter((r) => r.status === "OPEN" && (["requests", "team", "expiring", "draft", "deadline"] as OpeningNextKind[]).includes(r.next.kind)).length,
  };
}
