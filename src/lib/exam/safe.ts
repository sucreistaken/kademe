import { buildCTestPool, buildWordBankPool, seedFromText } from "./ctest-pool";
import { textGapKindOf, type ItemAnswer, type ItemSnapshot, type Presentation, type Section, type ItemType } from "./types";

/**
 * The only way an item reaches the student's browser.
 *
 * It is a whitelist, built field by field per item type, so a new column on
 * `items` (a key, a rubric, a difficulty) can never ride along by accident.
 * Keys, rubrics, difficulty, skill tags, item and stimulus ids, and the
 * listening transcript are never copied. The student's own draft answer is,
 * and so are a writing or speaking task's `studentPoints`, the one rubric
 * field written for the student.
 *
 * `candidateSafe` in `src/lib/candidate-safe.ts` still strips known internal
 * field names from every candidate response as a second line of defence.
 */

export type CandidateContent =
  | { kind: "CHOICE"; multiple: boolean; options: Array<{ id: string; text: string }> }
  | { kind: "TFNG"; statements: Array<{ id: string; text: string }> }
  | {
      kind: "GAP";
      gaps: Array<{ id: string; choices: string[] | null }>;
      /** C-test: each input continues the word stem right before it. */
      attached?: true;
      /** MC cloze: every gap is an empty slot answered from its four choices in a side panel. */
      cloze?: true;
      /**
       * C-test (with `attached`): shuffled word parts to place, the missing parts plus decoys.
       * Word bank (without `attached`): shuffled whole words, the answers plus distractors.
       * Never says which fits where.
       */
      pool?: string[];
    }
  | {
      kind: "MATCHING";
      left: Array<{ id: string; text: string }>;
      right: Array<{ id: string; text: string }>;
    }
  | { kind: "SHORT_TEXT"; maxChars: number }
  | { kind: "WRITING"; minWords: number; maxWords: number; studentPoints?: string[] }
  | { kind: "SPEAKING"; thinkSeconds: number; answerSeconds: number; maxTakes: number; studentPoints?: string[] };

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

/** The letter a matching target names itself by: "Anzeige A", "Abschnitt C", "B: Tobias Hahn". */
function ownLetter(text: string): { letter: string; label: string } | null {
  const t = text.trim();
  const prefixed = t.match(/^([A-Z])\s*[:)]\s+(\S[\s\S]*)$/u);
  if (prefixed) return { letter: prefixed[1], label: prefixed[2] };
  const suffixed = t.match(/^(?:\p{L}+\s+)?([A-Z])$/u);
  if (suffixed) return { letter: suffixed[1], label: t };
  return null;
}

export type LetteredTarget<T> = T & { badge: string; label: string };

/**
 * A matching column whose targets carry their own letters (Anzeige A to H,
 * "B: Tobias Hahn"), in letter order, or null for any other column.
 *
 * The reading text refers to such targets by their letter, so they are shown
 * in that order instead of shuffled: the letter is visible anyway, so the
 * order gives nothing away. At most one target without a letter is allowed
 * ("Keine Anzeige passt"); it goes last with the badge 0, as in the Goethe
 * format.
 */
export function letteredTargets<T extends { text: string }>(xs: T[]): Array<LetteredTarget<T>> | null {
  const own = xs.map((x) => ownLetter(x.text));
  const letters = own.flatMap((o) => (o ? [o.letter] : []));
  if (letters.length < 2 || xs.length - letters.length > 1 || new Set(letters).size !== letters.length) return null;
  const withLetter = xs
    .flatMap((x, i) => {
      const o = own[i];
      return o ? [{ ...x, badge: o.letter, label: o.label }] : [];
    })
    .sort((a, b) => a.badge.localeCompare(b.badge));
  const rest = xs.filter((_, i) => !own[i]).map((x) => ({ ...x, badge: "0", label: x.text.trim() }));
  return [...withLetter, ...rest];
}

/** The right column as the student sees it: its own letters, or A, B, C by position. */
export function matchingTargets<T extends { text: string }>(xs: T[]): Array<LetteredTarget<T>> {
  return (
    letteredTargets(xs) ??
    xs.map((x, i) => ({ ...x, badge: i < 26 ? String.fromCharCode(65 + i) : String(i + 1), label: x.text }))
  );
}

/** Drop-down choices in their presented order; indexes the order does not name are appended. */
function orderedChoices(choices: string[], order: number[] | undefined): string[] {
  if (!order) return [...choices];
  const seen = new Set<number>();
  const out: string[] = [];
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= choices.length || seen.has(i)) continue;
    seen.add(i);
    out.push(choices[i]);
  }
  choices.forEach((c, i) => {
    if (!seen.has(i)) out.push(c);
  });
  return out;
}

function ordered<T extends { id: string }>(xs: T[], order: string[] | undefined): T[] {
  if (!order) return xs;
  const byId = new Map(xs.map((x) => [x.id, x]));
  const out = order.map((id) => byId.get(id)).filter((x): x is T => !!x);
  // Anything the order does not name (should not happen) is appended, never dropped.
  for (const x of xs) if (!order.includes(x.id)) out.push(x);
  return out;
}

/**
 * Writing and speaking: the rubric's `studentPoints` and nothing else from the
 * rubric (its content points can hold answers and grader notes). Copied as
 * plain strings, and only when there is at least one.
 */
function studentPointsOf(snapshot: ItemSnapshot): { studentPoints: string[] } | Record<string, never> {
  if (snapshot.type !== "WRITING_PROMPT" && snapshot.type !== "SPEAKING_PROMPT") return {};
  const points = (snapshot.rubric?.studentPoints ?? []).filter((p): p is string => typeof p === "string" && p.trim() !== "").map((p) => p.trim());
  return points.length ? { studentPoints: points } : {};
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
    case "GAP": {
      const kind = textGapKindOf(snapshot);
      const gapIds = c.gaps.map((g) => g.id);
      const seed = presentation.poolSeed ?? seedFromText(snapshot.prompt);
      content = {
        kind: "GAP",
        gaps: c.gaps.map((g) => ({
          id: g.id,
          choices: g.choices ? orderedChoices(g.choices, presentation.choiceOrder?.[g.id]) : null,
        })),
        // Only the rendering hints leave the server, never the skill tag itself.
        ...(kind === "CTEST" ? { attached: true as const } : {}),
        ...(kind === "CLOZE" ? { cloze: true as const } : {}),
        ...(kind === "CTEST" && snapshot.key.kind === "GAP"
          ? { pool: buildCTestPool(gapIds, snapshot.key.answers, seed, snapshot.key.distractors) }
          : {}),
        ...(kind === "WORDBANK" && snapshot.key.kind === "GAP"
          ? { pool: buildWordBankPool(gapIds, snapshot.key.answers, seed, snapshot.key.distractors) }
          : {}),
      };
      break;
    }
    case "MATCHING":
      content = {
        kind: "MATCHING",
        left: c.left.map((l) => ({ id: l.id, text: l.text })),
        // Lettered targets are shown in letter order even where an older
        // presentation stored a shuffle for them.
        right: ordered(c.right, letteredTargets(c.right)?.map((r) => r.id) ?? presentation.order).map((r) => ({
          id: al(r.id),
          text: r.text,
        })),
      };
      break;
    case "SHORT_TEXT":
      content = { kind: "SHORT_TEXT", maxChars: c.maxChars };
      break;
    case "WRITING":
      content = { kind: "WRITING", minWords: c.minWords, maxWords: c.maxWords, ...studentPointsOf(snapshot) };
      break;
    case "SPEAKING":
      content = {
        kind: "SPEAKING",
        thinkSeconds: c.thinkSeconds,
        answerSeconds: c.answerSeconds,
        maxTakes: c.maxTakes,
        ...studentPointsOf(snapshot),
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
 * Fixed once, when the item is first served. Options, matching targets and
 * the choices of a drop-down or cloze gap are shuffled so the key's position says
 * nothing; statements and gaps keep their order because they follow the text,
 * and matching targets that carry their own letter keep letter order (see
 * `letteredTargets`).
 */
export function makePresentation(snapshot: ItemSnapshot, rng: () => number): Presentation {
  const shuffle = <T>(xs: T[]): T[] => {
    const a = [...xs];
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
    return { order: letteredTargets(c.right)?.map((r) => r.id) ?? shuffle(ids), alias: aliasFor(ids) };
  }
  if (c.kind === "GAP") {
    const choiceOrder: Record<string, number[]> = {};
    for (const g of c.gaps) {
      if (g.choices && g.choices.length > 1) choiceOrder[g.id] = shuffle(g.choices.map((_, i) => i));
    }
    const kind = textGapKindOf(snapshot);
    return {
      ...(Object.keys(choiceOrder).length ? { choiceOrder } : {}),
      ...(kind === "CTEST" || kind === "WORDBANK" ? { poolSeed: Math.floor(rng() * 2 ** 31) } : {}),
    };
  }
  return {};
}

/** Turns the student's aliased ids back into the bank's own. Unknown ids are dropped. */
export function unalias(presentation: Presentation, id: string): string | null {
  if (!presentation.alias) return id;
  for (const [orig, a] of Object.entries(presentation.alias)) if (a === id) return orig;
  return null;
}
