import type { ItemAnswer, ItemSnapshot, Presentation, Section, ItemType } from "./types";

/**
 * The only way an item reaches the student's browser.
 *
 * It is a whitelist, built field by field per item type, so a new column on
 * `items` (a key, a rubric, a difficulty) can never ride along by accident.
 * Keys, rubrics, difficulty, skill tags, item and stimulus ids, and the
 * listening transcript are never copied. The student's own draft answer is.
 *
 * `candidateSafe` in `src/lib/candidate-safe.ts` still strips known internal
 * field names from every candidate response as a second line of defence.
 */

export type CandidateContent =
  | { kind: "CHOICE"; multiple: boolean; options: Array<{ id: string; text: string }> }
  | { kind: "TFNG"; statements: Array<{ id: string; text: string }> }
  | { kind: "GAP"; gaps: Array<{ id: string; choices: string[] | null }> }
  | {
      kind: "MATCHING";
      left: Array<{ id: string; text: string }>;
      right: Array<{ id: string; text: string }>;
    }
  | { kind: "SHORT_TEXT"; maxChars: number }
  | { kind: "WRITING"; minWords: number; maxWords: number }
  | { kind: "SPEAKING"; thinkSeconds: number; answerSeconds: number; maxTakes: number };

export type CandidateStimulus =
  | { kind: "READING"; title: string; text: string }
  | { kind: "LISTENING"; title: string; durationMs: number | null; playsLeft: number; maxPlays: number };

export type CandidateItem = {
  sequence: number;
  section: Section;
  type: ItemType;
  prompt: string;
  content: CandidateContent;
  stimulus: CandidateStimulus | null;
  /** The student's own saved draft, so a reload shows what they typed. */
  answer: ItemAnswer | null;
  /** Speaking: recordings already made for this task. */
  takesUsed?: number;
};

function ordered<T extends { id: string }>(xs: T[], order: string[] | undefined): T[] {
  if (!order) return xs;
  const byId = new Map(xs.map((x) => [x.id, x]));
  const out = order.map((id) => byId.get(id)).filter((x): x is T => !!x);
  // Anything the order does not name (should not happen) is appended, never dropped.
  for (const x of xs) if (!order.includes(x.id)) out.push(x);
  return out;
}

const pickAnswer = (a: ItemAnswer | null, al: (id: string) => string): ItemAnswer | null =>
  a
    ? {
        ...(a.choiceIds ? { choiceIds: a.choiceIds.map(al) } : {}),
        ...(a.gaps ? { gaps: { ...a.gaps } } : {}),
        ...(a.matches ? { matches: Object.fromEntries(Object.entries(a.matches).map(([k, v]) => [k, al(v)])) } : {}),
        ...(a.tfng ? { tfng: { ...a.tfng } } : {}),
        ...(a.text !== undefined ? { text: a.text } : {}),
        ...(a.usedTextAlternative ? { usedTextAlternative: true } : {}),
      }
    : null;

export function toCandidateItem(
  snapshot: ItemSnapshot,
  presentation: Presentation,
  answer: ItemAnswer | null,
  sequence: number,
  extras: { maxPlays: number; playsUsed?: number; takesUsed?: number },
): CandidateItem {
  const c = snapshot.content;
  const al = (id: string) => presentation.alias?.[id] ?? id;
  let content: CandidateContent;
  switch (c.kind) {
    case "CHOICE":
      content = {
        kind: "CHOICE",
        multiple: snapshot.type === "MULTI_CHOICE",
        options: ordered(c.options, presentation.order).map((o) => ({ id: al(o.id), text: o.text })),
      };
      break;
    case "TFNG":
      content = { kind: "TFNG", statements: c.statements.map((s) => ({ id: s.id, text: s.text })) };
      break;
    case "GAP":
      content = { kind: "GAP", gaps: c.gaps.map((g) => ({ id: g.id, choices: g.choices ? [...g.choices] : null })) };
      break;
    case "MATCHING":
      content = {
        kind: "MATCHING",
        left: c.left.map((l) => ({ id: l.id, text: l.text })),
        right: ordered(c.right, presentation.order).map((r) => ({ id: al(r.id), text: r.text })),
      };
      break;
    case "SHORT_TEXT":
      content = { kind: "SHORT_TEXT", maxChars: c.maxChars };
      break;
    case "WRITING":
      content = { kind: "WRITING", minWords: c.minWords, maxWords: c.maxWords };
      break;
    case "SPEAKING":
      content = {
        kind: "SPEAKING",
        thinkSeconds: c.thinkSeconds,
        answerSeconds: c.answerSeconds,
        maxTakes: c.maxTakes,
      };
      break;
  }

  let stimulus: CandidateStimulus | null = null;
  if (snapshot.stimulus?.section === "READING") {
    stimulus = { kind: "READING", title: snapshot.stimulus.title, text: snapshot.stimulus.body };
  } else if (snapshot.stimulus?.section === "LISTENING") {
    stimulus = {
      kind: "LISTENING",
      title: snapshot.stimulus.title,
      durationMs: snapshot.stimulus.audioDurationMs,
      playsLeft: Math.max(0, extras.maxPlays - (extras.playsUsed ?? 0)),
      maxPlays: extras.maxPlays,
    };
  }

  return {
    sequence,
    section: snapshot.section,
    type: snapshot.type,
    prompt: snapshot.prompt,
    content,
    stimulus,
    answer: pickAnswer(answer, al),
    ...(extras.takesUsed !== undefined ? { takesUsed: extras.takesUsed } : {}),
  };
}

/**
 * Fixed once, when the item is first served. Options and matching targets are
 * shuffled so the key's position says nothing; statements and gaps keep their
 * order because they follow the text.
 */
export function makePresentation(snapshot: ItemSnapshot, rng: () => number): Presentation {
  const shuffle = (ids: string[]) => {
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const c = snapshot.content;
  const aliasFor = (ids: string[]) => {
    const used = new Set<string>();
    const out: Record<string, string> = {};
    for (const id of ids) {
      let a = "";
      do a = `o${Math.floor(rng() * 36 ** 5).toString(36).padStart(5, "0")}`;
      while (used.has(a));
      used.add(a);
      out[id] = a;
    }
    return out;
  };
  if (c.kind === "CHOICE") {
    const ids = c.options.map((o) => o.id);
    return { order: shuffle(ids), alias: aliasFor(ids) };
  }
  if (c.kind === "MATCHING") {
    const ids = c.right.map((r) => r.id);
    return { order: shuffle(ids), alias: aliasFor(ids) };
  }
  return {};
}

/** Turns the student's aliased ids back into the bank's own. Unknown ids are dropped. */
export function unalias(presentation: Presentation, id: string): string | null {
  if (!presentation.alias) return id;
  for (const [orig, a] of Object.entries(presentation.alias)) if (a === id) return orig;
  return null;
}
