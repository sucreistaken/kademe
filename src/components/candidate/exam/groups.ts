import type { MoveTo } from "@/lib/exam/navigation";

/**
 * Moving around when one recording and all its questions share a page.
 * Pure, so it is tested without a browser. The server decides what a group is
 * (every item of one listening recording); the screen only knows the sequences.
 */

/** The sequences on screen, ascending: the group, or just the one item. */
export function memberSequences(group: ReadonlyArray<{ sequence: number }> | null | undefined, anchor: number): number[] {
  const own = group && group.length > 0 ? group.map((g) => g.sequence) : [anchor];
  return [...new Set(own)].sort((a, b) => a - b);
}

/** The first item after the group, or null when the group ends the section ("Next" then opens the review). */
export function nextAfterGroup(sequences: readonly number[], members: readonly number[]): number | null {
  if (members.length === 0) return null;
  const last = Math.max(...members);
  const inGroup = new Set(members);
  const after = sequences.filter((s) => s > last && !inGroup.has(s));
  return after.length ? Math.min(...after) : null;
}

/** The item before the group, or null at the start of the section. */
export function prevBeforeGroup(sequences: readonly number[], members: readonly number[]): number | null {
  if (members.length === 0) return null;
  const first = Math.min(...members);
  const inGroup = new Set(members);
  const before = sequences.filter((s) => s < first && !inGroup.has(s));
  return before.length ? Math.max(...before) : null;
}

/** Whether a move leaves the page the student is on (a jump inside the group does not). */
export function leavesGroup(members: readonly number[], to: MoveTo): boolean {
  return to === "REVIEW" || !members.includes(to);
}

/** The first and last number shown in the header, e.g. questions 5 to 8. */
export function memberRange(members: readonly number[]): { from: number; to: number } {
  return { from: Math.min(...members), to: Math.max(...members) };
}
