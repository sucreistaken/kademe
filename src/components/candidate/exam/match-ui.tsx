"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Which matching row's list is open. A text-insertion item draws its gaps in
 * the reading text (ReadingPane) and its sentence list in the question column
 * (ItemView), two siblings; this is the one thing they share, so the sentence
 * list knows which gap a click on a sentence is meant for. Everywhere else
 * (the warm-up, tests) there is no provider and the item keeps its own state.
 *
 * `inline`: the tutorial's stage draws the open list in place, no portal and
 * no focus handling, and `openRow` is then set by the script.
 */
export type MatchUi = {
  openRow: string | null;
  setOpenRow: (rowId: string | null) => void;
  inline: boolean;
};

const MatchUiContext = createContext<MatchUi | null>(null);

const noop = () => {};

/**
 * `scope` names the question the open row belongs to (its sequence): a row
 * opened on one question is not open on the next, though the pane showing the
 * passage stays mounted between questions of one text.
 */
export function MatchUiProvider({ children, openRow, inline = false, scope = 0 }: { children?: ReactNode; openRow?: string | null; inline?: boolean; scope?: number }) {
  const [own, setOwn] = useState<{ scope: number; row: string | null }>({ scope, row: null });
  const controlled = openRow !== undefined;
  const shown = controlled ? openRow : own.scope === scope ? own.row : null;
  const value = useMemo<MatchUi>(
    () => ({ openRow: shown, setOpenRow: controlled ? noop : (row) => setOwn({ scope, row }), inline }),
    [shown, controlled, inline, scope],
  );
  return <MatchUiContext.Provider value={value}>{children}</MatchUiContext.Provider>;
}

/** A div that is also the provider: one reading pane and its question, with the open list they share. */
export function MatchUiScope({ className, scope, children }: { className?: string; scope: number; children: ReactNode }) {
  return (
    <MatchUiProvider scope={scope}>
      <div className={className}>{children}</div>
    </MatchUiProvider>
  );
}

/** Whether a provider above shares the open list. A matching item with none (the warm-up, a listening page) makes its own. */
export function useHasMatchUi(): boolean {
  return useContext(MatchUiContext) !== null;
}

export function useMatchUi(): MatchUi {
  const shared = useContext(MatchUiContext);
  const [own, setOwn] = useState<string | null>(null);
  return shared ?? { openRow: own, setOpenRow: setOwn, inline: false };
}
