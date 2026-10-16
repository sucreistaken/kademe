/** C-test instruction shown with the word-part pool, in the exam's language. */
export const CTEST_POOL_INSTRUCTION =
  "Ergänzen Sie die fehlenden Wortteile. Ziehen Sie die passenden Teile in die Lücken oder klicken Sie sie an. Einige Teile bleiben übrig.";

/**
 * A C-test prompt as the student sees it with the pool: the stored instruction
 * (first paragraph) asks to type letters, so it is replaced. Review screens and
 * the report use the same text, so teacher and student read the same task.
 */
export function withPoolInstruction(prompt: string): string {
  return `${CTEST_POOL_INSTRUCTION}\n\n${prompt.replace(/^[\s\S]*?\n\n/, "")}`;
}
