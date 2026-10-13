"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";

/**
 * What the candidate route's boundaries (error, not found, loading) need and
 * cannot read themselves: they render in place of a page, so the page's own
 * dictionary provider and the server's data are gone. The [token] layout
 * resolves this once and keeps it above them.
 */
export type CandidateFrame = {
  token: string;
  locale: Locale;
  /** ORG_TIMEZONE, read on the server: the browser has no access to it. */
  timeZone: string;
  orgName: string | null;
  contactEmail: string | null;
};

const FrameContext = createContext<CandidateFrame | null>(null);

export function CandidateFrameProvider({ value, children }: { value: CandidateFrame; children: React.ReactNode }) {
  return <FrameContext.Provider value={value}>{children}</FrameContext.Provider>;
}

/** The frame, or a Turkish one with no school when a boundary renders outside the layout. */
export function useCandidateFrame(): CandidateFrame {
  return useContext(FrameContext) ?? { token: "", locale: DEFAULT_LOCALE, timeZone: "Europe/Istanbul", orgName: null, contactEmail: null };
}
