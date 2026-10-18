/** candidate_requests.message is CHECKed to at most 2000 characters. */
export const REQUEST_MESSAGE_MAX = 2000;

/**
 * The text a PROBLEM request carries: where it was reported from, then what the
 * candidate wrote ("EXAM_END: the audio stopped"). A report with no words is
 * just its area. Cut to the table's 2000 limit (UTF-16 units, as the CHECK's
 * char_length counts them for text the routes bound), area first so the
 * teacher always sees where it came from.
 */
export function problemMessage(area: string, note: string): string {
  const text = note.trim() ? `${area}: ${note.trim()}` : area;
  return text.slice(0, REQUEST_MESSAGE_MAX);
}
