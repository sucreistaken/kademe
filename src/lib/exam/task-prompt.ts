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
    } else if (c === '"') asciiOpen = !asciiOpen;
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
      paragraph.push(inline.lead);
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
