/**
 * The invite form's exam picker value: a ready template (src/lib/exam/templates)
 * or one of the organisation's own published exams, in one select.
 */
export type ExamChoice = { kind: "template"; key: string } | { kind: "blueprint"; id: string };

export const examChoiceValue = (c: ExamChoice) => (c.kind === "template" ? `template:${c.key}` : `blueprint:${c.id}`);

export function parseExamChoice(raw: string): ExamChoice | null {
  const at = raw.indexOf(":");
  if (at < 0) return null;
  const kind = raw.slice(0, at);
  const value = raw.slice(at + 1);
  if (!value) return null;
  if (kind === "template") return { kind, key: value };
  if (kind === "blueprint") return { kind, id: value };
  return null;
}
