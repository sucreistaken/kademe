"use client";

import { createContext, useContext } from "react";
import type { ContentStage } from "@/solutions/hiring/rules/content";

/**
 * What the builder lends the question check in its bar (HIRING-UX 5.5): the
 * stages as the editor shows them (saved text plus anything still in the save
 * queue, in builder order), a way to save what was typed before the AI reads
 * the saved questions, and a way to open a question. The check never edits.
 */
export type BuilderCheck = {
  stages: ContentStage[];
  /** Sends what is waiting; false when something could not be saved, so the saved text would be stale. */
  saveFirst: () => Promise<boolean>;
  /** Selects the question and moves focus to its text. */
  focusActivity: (activityId: string) => void;
};

export const BuilderCheckContext = createContext<BuilderCheck | null>(null);

export function useBuilderCheck(): BuilderCheck | null {
  return useContext(BuilderCheckContext);
}
