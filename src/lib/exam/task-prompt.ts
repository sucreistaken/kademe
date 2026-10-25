/**
 * A writing or speaking prompt split into lines for the review card:
 * `Thema: Arbeit. Auf Ihrer Karte steht: "Mittagspause?"` becomes the topic
 * line and the card line. Existing line breaks stay; a prompt with neither
 * comes back as it was, one entry per line (a blank entry is a paragraph gap).
 */
export function splitTaskPrompt(prompt: string): string[] {
  const lines = prompt
    .replace(/\r\n?/g, "\n")
    .replace(/(^|\n)(Thema\s*:[^\n]*?[.!?])[ \t]+(?=\S)/g, "$1$2\n")
    .replace(/[ \t]+(?=Auf (?:Ihrer|Ihrem|deiner|deinem) \p{L}+ steht\b)/gu, "\n")
    .split("\n")
    .map((l) => l.trim());
  const out: string[] = [];
  for (const l of lines) {
    if (l === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    out.push(l);
  }
  while (out[out.length - 1] === "") out.pop();
  return out;
}

/** One block of the task text under the topic and card: sentences, one per line, or a list. */
export type TaskBlock = { kind: "text"; lines: string[] } | { kind: "list"; ordered: boolean; items: string[] };

/** The task as the candidate sees it: an optional topic, an optional prompt card, then the rest. */
export type ParsedTaskPrompt = {
  topic: string | null;
  card: { lead: string; text: string } | null;
  blocks: TaskBlock[];
};

const CARD_LINE = /^(Auf (?:Ihrer|Ihrem|deiner|deinem) \p{L}+ steht)\s*:\s*(.*)$/u;
const BULLET = /^[-•–*]\s+(.*)$/u;
const NUMBERED = /^\d+[.)]\s+(.*)$/u;
/** Words whose full stop does not end a sentence. */
const ABBREVIATION = /(?:^|[\s(])(?:ca|z|B|bzw|usw|etc|Nr|Dr|Hr|Fr|Str|ggf|evtl|vgl|inkl|u|a|d|h)\.$/u;

function stripQuotes(s: string): string {
  return s.replace(/^[„“"»«‚‘']+/u, "").replace(/[“”"»«‘’']+$/u, "").trim();
}

/** The quoted part of a `„Y“ rest` tail and whatever follows the closing mark. */
function splitQuoted(s: string): [string, string] {
  const m = s.match(/^["„“»«](.*?)["“”«»]\s*(.*)$/u);
  if (!m) return [stripQuotes(s), ""];
  return [m[1].trim(), m[2].trim()];
}

/** Sentences of one paragraph, never splitting inside quotation marks or after an abbreviation. */
function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  let depth = 0;
  let asciiOpen = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    let closed = false;
    if (c === "„" || c === "»" || c === "\u201a") depth++;
    else if ((c === "“" || c === "«" || c === "\u2018") && depth > 0) {
      depth--;
      closed = depth === 0;
    } else if (c === '"') {
      asciiOpen = !asciiOpen;
      // A closing straight quote ends the sentence when the quoted words did, like a closing typographic one.
      closed = !asciiOpen;
    }
    if (depth > 0) continue;
    // A sentence ends at . ! ? outside quotes, or at the closing mark of a quote that ended with one.
    const endsHere = asciiOpen ? false : closed ? /[.!?]/.test(text[i - 1] ?? "") : /[.!?]/.test(c);
    if (!endsHere) continue;
    // Closing quotes right after the sentence end belong to the sentence.
    let end = i + 1;
    while (end < text.length && /["”“»«’]/u.test(text[end])) end++;
    if (end >= text.length) break;
    if (!/^\s+[\p{Lu}„"»(]/u.test(text.slice(end, end + 3))) continue;
    if (c === "." && !closed && ABBREVIATION.test(text.slice(0, i + 1))) continue;
    out.push(text.slice(start, end).trim());
    start = end;
    i = end - 1;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** "Wählen Sie - Ort - Zeit - Preis" style inline points into a lead and items; null when it is not that shape. */
function inlineList(line: string): { lead: string; items: string[] } | null {
  const parts = line.split(/\s[-–]\s+(?=[\p{Lu}\d])/u);
  if (parts.length < 3) return null;
  // One word before the first dash is not a lead-in but the first of a list of words ("Freunde - Wohnung - Essen").
  if (!/\s/u.test(parts[0].trim())) return { lead: "", items: parts.map((p) => p.trim()) };
  return { lead: parts[0].trim(), items: parts.slice(1).map((p) => p.trim()) };
}

/**
 * Lays a task prompt out for the candidate: `Thema: X.` becomes a topic,
 * `Auf Ihrer Karte steht: "Y"` becomes the card text, bullet and numbered
 * lines become lists, and the remaining sentences get one line each. Blank
 * lines separate blocks. Pure, so it is tested against the real seed prompts.
 */
export function parseTaskPrompt(prompt: string): ParsedTaskPrompt {
  const lines = splitTaskPrompt(prompt);
  let topic: string | null = null;
  let card: ParsedTaskPrompt["card"] = null;
  const blocks: TaskBlock[] = [];
  let paragraph: string[] = [];
  let inList = false;

  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: "text", lines: paragraph.flatMap((p) => sentences(p)) });
    paragraph = [];
  };
  const pushItem = (ordered: boolean, item: string) => {
    flush();
    const last = blocks[blocks.length - 1];
    if (inList && last && last.kind === "list" && last.ordered === ordered) last.items.push(item);
    else blocks.push({ kind: "list", ordered, items: [item] });
    inList = true;
  };

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    if (line === "") {
      flush();
      inList = false;
      continue;
    }
    const topicMatch = n === 0 ? line.match(/^Thema\s*:\s*(.+)$/u) : null;
    if (topicMatch) {
      topic = topicMatch[1].replace(/\.$/, "").trim();
      continue;
    }
    const cardMatch: RegExpMatchArray | null = card === null ? line.match(CARD_LINE) : null;
    if (cardMatch && cardMatch[2]) {
      const [text, rest] = splitQuoted(cardMatch[2]);
      card = { lead: `${cardMatch[1]}:`, text };
      if (rest) paragraph.push(rest);
      continue;
    }
    const bullet = line.match(BULLET);
    const numbered = bullet ? null : line.match(NUMBERED);
    const marked = bullet ?? numbered;
    if (marked) {
      pushItem(!bullet, marked[1].trim());
      continue;
    }
    inList = false;
    const inline = inlineList(line);
    if (inline) {
      if (inline.lead) paragraph.push(inline.lead);
      flush();
      blocks.push({ kind: "list", ordered: false, items: inline.items });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return { topic, card, blocks };
}

/** The task as laid out on screen: situation in a soft box, task lines as an "Aufgabe" list. */
export type TaskSegment =
  | { kind: "situation"; lines: string[] }
  | { kind: "tasks"; items: Array<{ text: string; lists: Array<{ ordered: boolean; items: string[] }> }> }
  | { kind: "text"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] };

/**
 * A task line is a polite imperative ("Bitten Sie ...", "Sagen Sie ..."),
 * optionally led by "Dann", "Danach" and the like. Modal questions such as
 * "Können Sie ...?" are not tasks.
 */
const TASK_LINE =
  /^(?:(?:Dann|Danach|Zuerst|Zuletzt|Anschließend|Außerdem|Bitte|Nun|Am Ende|Zum Schluss)\s+)?\p{L}+(?:en|ln|rn) Sie\b/u;
const MODAL_QUESTION = /^(?:Können|Könnten|Dürfen|Möchten|Wollen|Würden|Sollen|Müssen|Mögen|Haben|Hätten|Wären)\b/u;

export function isTaskLine(line: string): boolean {
  const t = line.trim();
  return TASK_LINE.test(t) && !MODAL_QUESTION.test(t);
}

/**
 * Splits the text blocks of a parsed prompt into situation lines and task
 * lines, keeping the original order and every word. A list that follows a task
 * line ending in a colon ("Gehen Sie auf diese Punkte ein:") belongs to it; any
 * other list stays a list of its own. A prompt without a single task line comes
 * back as plain text and lists, as before.
 */
export function layoutTaskBlocks(blocks: TaskBlock[]): TaskSegment[] {
  const anyTask = blocks.some((b) => b.kind === "text" && b.lines.some(isTaskLine));
  const out: TaskSegment[] = [];
  for (const b of blocks) {
    if (b.kind === "list") {
      const last = out[out.length - 1];
      const lead = last?.kind === "tasks" ? last.items[last.items.length - 1] : null;
      if (lead && lead.text.endsWith(":") && lead.lists.length === 0) lead.lists.push({ ordered: b.ordered, items: b.items });
      else out.push({ kind: "list", ordered: b.ordered, items: b.items });
      continue;
    }
    for (const line of b.lines) {
      const last = out[out.length - 1];
      if (anyTask && isTaskLine(line)) {
        if (last?.kind === "tasks") last.items.push({ text: line, lists: [] });
        else out.push({ kind: "tasks", items: [{ text: line, lists: [] }] });
        continue;
      }
      // Before the first task a plain line is the situation; after it, a note in the running text.
      const kind = anyTask && !out.some((s) => s.kind === "tasks") ? "situation" : "text";
      if (last?.kind === kind) last.lines.push(line);
      else out.push({ kind, lines: [line] });
    }
  }
  return out;
}

/** A list item that asks for something: a task line or a question. */
const asks = (item: string) => isTaskLine(item) || item.trim().endsWith("?");

/**
 * The laid-out prompt already shows the candidate a list of what to do: two or
 * more task lines, a list of two or more under a task line ending in a colon
 * ("Gehen Sie auf diese Punkte ein:"), or a list of two or more task lines or
 * questions on its own. A list of material (form fields, quotations, sentences
 * to rewrite) does not count.
 */
export function promptListsTasks(segments: TaskSegment[]): boolean {
  return segments.some((s) => {
    if (s.kind === "tasks") return s.items.length >= 2 || s.items.some((it) => it.lists.some((l) => l.items.length >= 2));
    if (s.kind === "list") return s.items.length >= 2 && s.items.every(asks);
    return false;
  });
}

/**
 * The student points worth showing under a task: none when the prompt already
 * lists what to do (the box would only repeat it), else the non-blank points.
 */
export function coverPointsFor(prompt: string, points: string[] | undefined): string[] {
  const shown = (points ?? []).filter((p) => p.trim());
  if (shown.length === 0) return [];
  return promptListsTasks(layoutTaskBlocks(parseTaskPrompt(prompt).blocks)) ? [] : shown;
}

/**
 * One line of a task. A line that quotes an example ("..., zum Beispiel:
 * "1. Familienname: ..."") comes apart into the instruction and the example,
 * so the example can be set apart.
 */
export type TaskLine = { text: string; example?: string };

const EXAMPLE_LINE = /^(.*?\b(?:zum Beispiel|z\.\s?B\.)\s*:)\s*(["„“»‚].*)$/u;

export function splitExample(text: string): TaskLine {
  const m = text.trim().match(EXAMPLE_LINE);
  return m ? { text: m[1].trim(), example: m[2].trim() } : { text: text.trim() };
}

/**
 * A task as it is read on screen, one role per piece:
 * - situation: the scene (and the material that goes with it, such as notes);
 * - task: what to do, the lines that carry the weight;
 * - points: the points to cover or the fields to fill, a bulleted or numbered list;
 * - note: a requirement that follows the points ("Schreiben Sie auch eine Anrede und einen Gruß.");
 * - text: any other running text, such as a quoted question.
 */
export type TaskView =
  | { kind: "situation"; lines: string[]; list?: { ordered: boolean; items: string[] } }
  | { kind: "task"; lines: TaskLine[] }
  | { kind: "points"; ordered: boolean; items: string[] }
  | { kind: "note"; lines: TaskLine[] }
  | { kind: "text"; lines: string[] };

/** A question is not an instruction: "Fahren Sie selbst gern Fahrrad?" is guiding text, "Erzählen Sie von sich: Wer sind Sie?" is still a task. */
const isQuestion = (line: string) => line.trim().endsWith("?") && !line.includes(":");

/**
 * Arranges the segments of a laid-out prompt by role (presentation only; every
 * word stays, in order). A list right after the situation joins it (notes the
 * task refers to). A list right after the task is the points. Task lines that
 * come after those points are notes, so a prompt never goes bold, regular,
 * bold again. A prompt with no task line at all but a list under a lead-in that
 * ends in a colon takes that lead-in as its task.
 */
export function presentTask(segments: TaskSegment[]): TaskView[] {
  const out: TaskView[] = [];
  let taskShown = false;
  let pointsAfterTask = false;

  const pushText = (lines: string[]) => {
    const last = out[out.length - 1];
    if (last?.kind === "text") last.lines.push(...lines);
    else out.push({ kind: "text", lines });
  };

  for (const seg of segments) {
    if (seg.kind === "situation") {
      out.push({ kind: "situation", lines: [...seg.lines] });
    } else if (seg.kind === "text") {
      pushText(seg.lines);
    } else if (seg.kind === "list") {
      const last = out[out.length - 1];
      // After a lead-in that ends in a colon ("Ihre Notizen dazu:") the list is the scene's material and stays in its box.
      if (last?.kind === "situation" && !last.list && !taskShown && last.lines[last.lines.length - 1].trim().endsWith(":")) last.list = { ordered: seg.ordered, items: seg.items };
      else {
        // Only a list that follows the task line itself is "the points"; a list of material further down (notes, an advert) is not.
        if (last?.kind === "task") pointsAfterTask = true;
        out.push({ kind: "points", ordered: seg.ordered, items: seg.items });
      }
    } else {
      let run: TaskLine[] = [];
      const flush = () => {
        if (run.length === 0) return;
        out.push({ kind: pointsAfterTask ? "note" : "task", lines: run });
        if (!pointsAfterTask) taskShown = true;
        run = [];
      };
      for (const it of seg.items) {
        if (it.lists.length === 0 && isQuestion(it.text) && (taskShown || run.length > 0)) {
          flush();
          pushText([it.text]);
          continue;
        }
        run.push(splitExample(it.text));
        if (it.lists.length > 0) {
          flush();
          for (const l of it.lists) out.push({ kind: "points", ordered: l.ordered, items: l.items });
          pointsAfterTask = true;
        }
      }
      flush();
    }
  }

  if (!out.some((v) => v.kind === "task")) {
    const at = out.findIndex((v, i) => v.kind === "text" && out[i + 1]?.kind === "points" && v.lines[v.lines.length - 1].trim().endsWith(":"));
    const lead = at >= 0 ? out[at] : null;
    if (lead?.kind === "text") {
      const head = lead.lines.slice(0, -1);
      const task: TaskView = { kind: "task", lines: [splitExample(lead.lines[lead.lines.length - 1])] };
      out.splice(at, 1, ...(head.length > 0 ? [{ kind: "situation" as const, lines: head }, task] : [task]));
    }
  }
  return out;
}
