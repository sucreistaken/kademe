/**
 * Standard German exam-instruction phrases. Every exam in the world words its
 * tasks this way, so a shingle that lies entirely inside occurrences of these
 * phrases in a bank string is not evidence of copying (see findHits). Phrases
 * are matched after the same normalisation as shingles (case, punctuation).
 * Keep to task wording only, never content sentences.
 */
export const ALLOWED_INSTRUCTIONS: readonly string[] = [
  "und begründen Sie Ihre Meinung",
  "Begründen Sie Ihre Meinung",
  "Gehen Sie auf folgende Punkte ein",
  "Gehen Sie auf",
  "Lesen Sie den Text",
  "Lesen Sie die Situationen",
  "Schreiben Sie eine E-Mail",
  "Schreiben Sie einen Text",
  "Hören Sie den Text",
  "Kreuzen Sie die richtige Lösung an",
  "Richtig oder falsch",
];
