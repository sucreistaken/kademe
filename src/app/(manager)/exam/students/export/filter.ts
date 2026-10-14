import type { StudentRow } from "@/server/panel";

/**
 * The student list's filter, shared by the page and the download so the file is
 * exactly the rows on screen: a tab and a name/e-mail search. The page has no
 * exam or date filter.
 */
export const TABS = ["all", "review", "running", "final"] as const;
export type Tab = (typeof TABS)[number];

export const inTab = (r: Pick<StudentRow, "status">, tab: Tab) =>
  tab === "all"
    ? true
    : tab === "review"
      ? r.status === "AWAITING_REVIEW" || r.status === "AWAITING_GRADING"
      : tab === "running"
        ? r.status === "IN_EXAM" || r.status === "NOT_STARTED"
        : r.status === "FINAL" || r.status === "RELEASED";

export const parseTab = (value: string | null | undefined): Tab => ((TABS as readonly string[]).includes(value ?? "") ? (value as Tab) : "all");

export function filterStudents<T extends Pick<StudentRow, "status" | "name" | "email">>(all: readonly T[], tab: Tab, query: string, locale: string): T[] {
  const q = query.trim().toLocaleLowerCase(locale);
  return all.filter((r) => inTab(r, tab) && (!q || `${r.name} ${r.email}`.toLocaleLowerCase(locale).includes(q)));
}
