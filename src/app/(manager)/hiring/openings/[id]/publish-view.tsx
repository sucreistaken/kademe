"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { flowFocusKey } from "@/components/manager/flow-model";
import { StepFooter } from "@/components/visual/step-footer";
import { stepFocusController, useKeepFocus } from "@/hooks/use-step-focus";
import { currentHash, leaveHashStep, noHash, subscribeHash } from "@/lib/client/hash-step";

const FIX = "inline-flex min-h-11 items-center text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";

/** The setup card's heading: where the focus lands when the summary goes back to the overview, or when a path action unmounts. */
export const SETUP_HEADING_ID = "setup-path-title";

/**
 * D13: the publish summary shows on `#publish` (the setup path's last step),
 * and only when the page drew one (an editor's draft with content on an
 * opening that is not closed); otherwise `#publish` leaves the overview as it
 * is. The overview reads its hash here, never through useFlowStep, so nothing
 * clears `#publish` from the address.
 */
export const publishShown = (hash: string, hasSummary: boolean): boolean => hasSummary && hash === "#publish";

function usePublishShown(hasSummary: boolean): boolean {
  return publishShown(useSyncExternalStore(subscribeHash, currentHash, noHash), hasSummary);
}

/**
 * HIRING-VISUAL-FLOW 4.5, D13: the overview and its publish summary are both
 * drawn on the server; the address's hash picks one. Opening the summary in
 * place moves the focus to its title and going back moves it to the setup
 * card's heading (W10); the first load, also on `#publish`, moves nothing
 * (the store hydrates without a hash, which is not a step change).
 */
export function PublishSwitch({ summary, children }: { summary: ReactNode; children?: ReactNode }) {
  const hasSummary = summary !== null && summary !== undefined;
  const shown = usePublishShown(hasSummary);
  const [heard, setHeard] = useState(false);
  useEffect(() => subscribeHash(() => setHeard(true)), []);
  const [focus] = useState(stepFocusController);
  const key = flowFocusKey(heard, shown ? "publish" : "overview");
  useEffect(() => {
    focus.onStep(key, shown ? document.querySelector<HTMLElement>("#publish-summary h1") : document.getElementById(SETUP_HEADING_ID));
  }, [focus, key, shown]);
  return <>{shown ? summary : children}</>;
}

/**
 * RULES 2, KG5: the header's filled button ("Kuruluma devam et", "Aday davet
 * et") steps aside while the summary shows, whose "Yayınla" is then the
 * screen's one filled button.
 */
export function OverviewOnly({ hasSummary, children }: { hasSummary: boolean; children?: ReactNode }) {
  return usePublishShown(hasSummary) ? null : <>{children}</>;
}

/**
 * The setup card. When the path's action a keyboard user pressed goes away
 * with the step it belonged to ("Atla ›" moves the current step), the focus
 * lands on the card's heading (`SETUP_HEADING_ID`, drawn by the page with
 * tabIndex -1) instead of the page's body (W10).
 */
export function SetupFocusArea({ children }: { children?: ReactNode }) {
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  const [heading] = useState(() => ({
    get current() {
      return typeof document === "undefined" ? null : document.getElementById(SETUP_HEADING_ID);
    },
  }));
  useKeepFocus(area, heading);
  return <div ref={setArea}>{children}</div>;
}

/**
 * The publish summary's footer (W6): "‹ Genel bakış" back, the one filled
 * "Yayınla" that sends the summary's form to publishOpeningAction (unchanged),
 * waiting with the gate's first problem in the existing words, a "Düzelt"
 * link under it. Once sent the button stays filled, says "Yayınlanıyor" and
 * takes no second click until the action's redirect changes the address's
 * query (`?published=` or `?publish=`); a refusal then frees it again.
 * PendingButton stays the one reader of a form's status (pending-button.test.ts).
 */
export function PublishFooter({
  formId,
  reason,
  fix,
  labels,
}: {
  formId: string;
  reason: string | null;
  fix: { label: string; href: string } | null;
  labels: { publish: string; publishing: string; back: string };
}) {
  const search = useSearchParams()?.toString() ?? "";
  // The query the form was sent from; a new query is the action's answer.
  const [sentFrom, setSentFrom] = useState<string | null>(null);
  if (sentFrom !== null && sentFrom !== search) setSentFrom(null);
  return (
    <StepFooter
      placement="sticky"
      back={{ label: labels.back, onClick: leaveHashStep }}
      primary={{
        kind: "button",
        id: "publish-opening",
        label: labels.publish,
        busy: sentFrom !== null,
        busyLabel: labels.publishing,
        waitReason: reason,
        onClick: () => {
          setSentFrom(search);
          document.querySelector<HTMLFormElement>(`#${formId}`)?.requestSubmit();
        },
      }}
      note={
        reason && fix ? (
          // A fix with a hash is a plain anchor, so the page it opens hears the hash (W3).
          fix.href.includes("#") ? (
            <a href={fix.href} className={FIX}>
              {fix.label}
            </a>
          ) : (
            <Link href={fix.href} className={FIX}>
              {fix.label}
            </Link>
          )
        ) : null
      }
    />
  );
}
